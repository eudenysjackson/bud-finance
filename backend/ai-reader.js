const { report, currentJob } = require('./ai-jobs');

// Uma fila por processo evita que importações concorrentes esgotem a cota juntas.
function createReader({ fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), model, key, maxTokens = 900 } = {}) {
  let queue = Promise.resolve();
  let outputBudget = maxTokens;
  async function complete(messages) {
    const job = currentJob();
    const task = queue.then(async () => {
      let waited = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        job?.signal?.throwIfAborted();
        report('Lendo documento...');
        const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ model, messages, reasoning_effort: 'none', temperature: 0, max_tokens: outputBudget, response_format: { type: 'json_object' } }),
          signal: job?.signal ? AbortSignal.any([job.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
        });
        if (response.status === 429) {
          const data = await response.json();
          const message = data.error?.message || '';
          // Não adianta esperar uma janela se a própria solicitação excede a capacidade.
          const limit = message.match(/Limit\s+(\d+)/i);
          if (/request too large/i.test(message)) {
            if (/output tokens/i.test(message) && limit && Number(limit[1]) < outputBudget) {
              outputBudget = Math.max(150, Math.floor(Number(limit[1]) * 0.85));
              continue;
            }
            const error = new Error('Trecho maior que a capacidade da IA.'); error.code = 'AI_SPLIT'; throw error;
          }
          const seconds = Number(response.headers.get('retry-after')) || Number(message.match(/try again in\s+([\d.]+)s/i)?.[1]) || 60;
          const waitMs = Math.ceil(seconds * 1000) + 250;
          if (attempt === 2 || seconds > 15 || waited + waitMs > 20_000) throw Object.assign(new Error('O serviço de IA está temporariamente sem capacidade. A leitura foi encerrada; tente novamente em alguns minutos.'), { code: 'AI_RATE_LIMIT' });
          waited += waitMs;
          report('Serviço de IA ocupado. Nova tentativa em ' + Math.ceil(seconds) + ' segundos (' + (attempt + 1) + '/2)...');
          if (job?.signal) {
            await new Promise((resolve, reject) => {
              const onAbort = () => reject(job.signal.reason || new Error('Leitura encerrada.'));
              job.signal.addEventListener('abort', onAbort, { once: true });
              Promise.resolve(sleep(waitMs)).then(resolve, reject).finally(() => job.signal.removeEventListener('abort', onAbort));
            });
          } else await sleep(waitMs);
          continue;
        }
        if (!response.ok) throw new Error('Groq API [' + response.status + ']: ' + await response.text());
        const data = await response.json();
        const choice = data.choices?.[0];
        if (choice?.finish_reason === 'length') {
          const error = new Error('Repartir trecho para concluir a leitura.'); error.code = 'AI_SPLIT'; throw error;
        }
        try { return JSON.parse(choice?.message?.content || ''); }
        catch { const error = new Error('Resposta de leitura incompleta.'); error.code = 'AI_SPLIT'; throw error; }
      }
      throw Object.assign(new Error('O provedor de IA continua sem capacidade disponível após as tentativas de leitura. Tente novamente mais tarde.'), { code: 'AI_RATE_LIMIT' });
    });
    queue = task.catch(() => {});
    return task;
  }
  function merge(parts, field) {
    const result = { [field]: [] };
    for (const part of parts) {
      if (!Array.isArray(part[field])) throw new Error('A IA retornou uma estrutura de documento inválida.');
      // Os trechos não se sobrepõem: compras iguais em linhas diferentes são preservadas.
      result[field].push(...part[field]);
      for (const [name, value] of Object.entries(part)) {
        if (name === field || value == null || value === '') continue;
        if (name === 'meta') result.meta = { ...(result.meta || {}), ...Object.fromEntries(Object.entries(value).filter(([,v]) => v != null)) };
        else if (result[name] == null || result[name] === '') result[name] = value;
      }
    }
    return result;
  }
  function divide(text) {
    const middle = Math.floor(text.length / 2);
    const after = text.indexOf('\n', middle);
    const before = text.lastIndexOf('\n', middle);
    const at = after > 0 && after < text.length * .85 ? after + 1 : before > text.length * .15 ? before + 1 : middle;
    return [text.slice(0, at), text.slice(at)];
  }
  async function readText(text, prompt, field = 'transacoes') {
    const context = text.slice(0, 500);
    async function read(part, depth = 0) {
      currentJob()?.signal?.throwIfAborted();
      if (part.length > 1800) {
        const halves = divide(part);
        return merge([await read(halves[0], depth + 1), await read(halves[1], depth + 1)], field);
      }
      try {
        const result = await complete([
          { role: 'system', content: prompt + '\nEste é um trecho do documento. Extraia somente as linhas do TRECHO, nunca as do CONTEXTO. Não tente completar o total do documento inventando linhas. Preserve compras repetidas em linhas distintas.' },
          { role: 'user', content: 'CONTEXTO (apenas referência de datas e titular):\n' + context + '\nFIM DO CONTEXTO\nTRECHO A EXTRAIR:\n' + part },
        ]);
        if (!Array.isArray(result[field])) throw Object.assign(new Error('Estrutura inválida'), { code: 'AI_SPLIT' });
        return result;
      } catch (error) {
        if (error.code !== 'AI_SPLIT' || part.length < 80 || depth > 16) throw error;
        const halves = divide(part);
        return merge([await read(halves[0], depth + 1), await read(halves[1], depth + 1)], field);
      }
    }
    return read(text);
  }
  async function readImage(buffer, mime, prompt, field = 'transacoes', depth = 0) {
    currentJob()?.signal?.throwIfAborted();
    if (buffer.length > 3 * 1024 * 1024) {
      buffer = await require('sharp')(buffer).rotate().resize({ width: 2400, height: 3600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
      mime = 'image/jpeg';
    }
    try {
      const result = await complete([{ role: 'user', content: [
        { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + buffer.toString('base64') } },
        { type: 'text', text: prompt },
      ] }]);
      if (!Array.isArray(result[field])) throw Object.assign(new Error('Estrutura inválida'), { code: 'AI_SPLIT' });
      return result;
    } catch (error) {
      if (error.code !== 'AI_SPLIT' || depth > 10) throw error;
      // Recortes com sobreposição pequena; o centro da linha determina o dono.
      const sharp = require('sharp');
      const meta = await sharp(buffer).metadata();
      if (meta.height < 160) throw new Error('Não foi possível ler esta região da imagem com segurança.');
      const middle = Math.floor(meta.height / 2), overlap = Math.min(48, Math.floor(meta.height * .05));
      const parts = [];
      for (const region of [{ top: 0, height: middle + overlap, lower: 0, upper: middle }, { top: middle - overlap, height: meta.height - middle + overlap, lower: overlap, upper: meta.height - middle + overlap }]) {
        const crop = await sharp(buffer).extract({ left: 0, top: region.top, width: meta.width, height: region.height }).png().toBuffer();
        const positionPrompt = prompt + '\nEm cada item inclua _y: coordenada vertical do CENTRO da linha de valor (0 no topo, 1000 no fundo desta imagem).';
        const part = await readImage(crop, 'image/png', positionPrompt, field, depth + 1);
        // Ao subdividir, readImage devolve itens já filtrados na região de origem.
        part[field] = part[field].filter(item => {
          if (!Number.isFinite(Number(item._y))) throw new Error('Não foi possível localizar as linhas da imagem com segurança.');
          const y = Number(item._y) * region.height / 1000;
          return y >= region.lower && y < region.upper;
        }).map(item => ({ ...item, _y: ((Number(item._y) * region.height / 1000 + region.top) / meta.height) * 1000 }));
        parts.push(part);
      }
      return merge(parts, field);
    }
  }
  return { readText, readImage, merge, complete };
}

async function readPDF(buffer) {
  const pdf = require('pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js');
  pdf.disableWorker = true;
  const loading = pdf.getDocument({ data: new Uint8Array(buffer), disableFontFace: true });
  const doc = await (loading.promise || loading);
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      currentJob()?.signal?.throwIfAborted();
      report('Lendo página ' + i + ' de ' + doc.numPages + '...');
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let lastY;
      let text = '';
      for (const item of content.items) {
        text += lastY === item.transform[5] ? ' ' : '\n'; text += item.str; lastY = item.transform[5];
      }
      if (text.trim().length > 30) pages.push({ text });
      else {
        const { createCanvas } = require('@napi-rs/canvas');
        const viewport = page.getViewport(1.7);
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const canvasFactory = {
          create(width, height) { const c = createCanvas(Math.ceil(width), Math.ceil(height)); return { canvas: c, context: c.getContext('2d') }; },
          reset(target, width, height) { target.canvas.width = Math.ceil(width); target.canvas.height = Math.ceil(height); },
          destroy(target) { target.canvas.width = 0; target.canvas.height = 0; target.canvas = null; target.context = null; },
        };
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvasFactory }).promise;
        pages.push({ image: canvas.toBuffer('image/png') });
      }
    }
    return pages;
  } finally { await doc.destroy(); }
}

module.exports = { createReader, readPDF };

