const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReader, readPDF } = require('../backend/ai-reader');

const ok = content => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });
const truncated = () => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"transacoes":[' } }] }) });
function part(options) { return JSON.parse(options.body).messages[1].content.split('TRECHO A EXTRAIR:\n')[1]; }

test('documento com mais de 30 mil caracteres preserva todas as linhas e repetições', async () => {
  const lines = Array.from({ length: 700 }, (_, i) => String(i).padStart(4, '0') + ' COMPRA TESTE LOJA COM DESCRICAO COMPLETA 10,00');
  lines.splice(100, 0, lines[99]);
  const reader = createReader({ fetchImpl: async (_, options) => ok({ transacoes: part(options).split('\n').filter(Boolean).map(desc => ({ desc, valor: 10 })) }) });
  const result = await reader.readText(lines.join('\n'), 'Extraia as compras em JSON');
  assert.deepEqual(result.transacoes.map(t => t.desc), lines);
});

test('resposta truncada é repartida automaticamente sem aceitar dados parciais', async () => {
  let splits = 0;
  const reader = createReader({ fetchImpl: async (_, options) => {
    const text = part(options);
    if (text.length > 200) { splits++; return truncated(); }
    return ok({ transacoes: text.split('\n').filter(Boolean).map(desc => ({ desc, valor: 1 })) });
  } });
  const lines = Array.from({ length: 30 }, (_, i) => 'COMPRA ' + i + ' 10,00');
  const result = await reader.readText(lines.join('\n'), 'Extraia em JSON');
  assert.ok(splits > 0);
  assert.deepEqual(result.transacoes.map(t => t.desc), lines);
});

test('429 aguarda o tempo informado e continua; solicitações são serializadas', async () => {
  const waits = []; let calls = 0; let active = 0; let maximum = 0;
  const reader = createReader({ sleep: async ms => waits.push(ms), fetchImpl: async () => {
    active++; maximum = Math.max(maximum, active); await Promise.resolve(); active--;
    if (++calls === 1) return { status: 429, headers: new Headers({ 'retry-after': '2' }), json: async () => ({ error: { message: 'Rate limit reached.' } }) };
    return ok({ transacoes: [{ desc: 'teste', valor: 1 }] });
  } });
  await Promise.all([reader.readText('teste', 'JSON'), reader.readText('outro', 'JSON')]);
  assert.deepEqual(waits, [2250]); assert.equal(calls, 3); assert.equal(maximum, 1);
});

test('limite por solicitação ajusta orçamento automaticamente', async () => {
  const budgets = [];
  const reader = createReader({ maxTokens: 8192, fetchImpl: async (_, options) => {
    budgets.push(JSON.parse(options.body).max_tokens);
    if (budgets.length === 1) return { status: 429, headers: new Headers(), json: async () => ({ error: { message: 'Request too large on output tokens per minute: Limit 1000, Requested 8192.' } }) };
    return ok({ transacoes: [] });
  } });
  await reader.readText('sem compras', 'JSON');
  assert.deepEqual(budgets, [8192, 850]);
});

test('limite persistente encerra após no máximo duas esperas curtas e libera a fila', async () => {
  let calls = 0;const waits = [];
  const reader = createReader({ sleep: async ms => waits.push(ms), fetchImpl: async () => {
    calls++;
    if (calls <= 3) return { status: 429, headers: new Headers({ 'retry-after': '1' }), json: async () => ({ error: {} }) };
    return ok({ transacoes: [] });
  } });
  await assert.rejects(reader.readText('teste', 'JSON'), error => error.code === 'AI_RATE_LIMIT');
  assert.equal(calls, 3);assert.equal(waits.length, 2);
  assert.deepEqual(await reader.readText('novo', 'JSON'), { transacoes: [] });
});

test('espera longa do provedor encerra imediatamente sem dormir minutos', async () => {
  const reader = createReader({ sleep: async () => assert.fail('não deve aguardar'), fetchImpl: async () => ({
    status: 429, headers: new Headers({ 'retry-after': '60' }), json: async () => ({ error: {} })
  }) });
  await assert.rejects(reader.readText('teste', 'JSON'), error => error.code === 'AI_RATE_LIMIT');
});

test('imagem truncada é dividida em regiões e recombinada', async () => {
  const sharp = require('../backend/node_modules/sharp');
  const image = await sharp({ create: { width: 200, height: 500, channels: 3, background: 'white' } }).png().toBuffer();
  let calls = 0;
  const reader = createReader({ fetchImpl: async () => ++calls === 1 ? truncated() : ok({ transacoes: [{ desc: 'regiao ' + calls, valor: 1, _y: 500 }] }) });
  const result = await reader.readImage(image, 'image/png', 'Extraia JSON');
  assert.equal(calls, 3); assert.equal(result.transacoes.length, 2);
  assert.ok(result.transacoes[0]._y < result.transacoes[1]._y);
});

test('PDF de texto e PDF escaneado possuem caminho de leitura', async () => {
  const fs = require('node:fs');
  const text = await readPDF(fs.readFileSync('tests/fixtures/ia/fatura.pdf'));
  assert.match(text[0].text, /MERCADO TESTE/);
  const scan = await readPDF(fs.readFileSync('tests/fixtures/ia/escaneado.pdf'));
  assert.ok(scan[0].image?.length > 100);
});

