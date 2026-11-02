(function(root) {
  'use strict';
  const normalize = text => String(text || '').normalize('NFKC').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const plain = text => normalize(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const amount = value => Number(String(value).replace(/\./g,'').replace(',','.'));
  const money = /(?:R\$\s*)+([\d.]+,\d{1,2})(?!\d)/i;
  function date(value) {
    if (!value) return null;
    const [d,m,y] = value.split('/').map(Number), iso = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const parsed = new Date(iso+'T12:00:00Z');
    return y >= 1900 && y <= 2100 && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === iso ? iso : null;
  }
  function firstDate(text) { return date(text.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0]); }
  function missing(data) {
    const fields = [];
    if (!Number.isFinite(data?.valorTotal) || data.valorTotal <= 0) fields.push('valor total');
    if (!Number.isInteger(data?.parcelas) || data.parcelas < 1) fields.push('quantidade de parcelas');
    if (!Number.isFinite(data?.valorParcela) || data.valorParcela <= 0) fields.push('valor da parcela');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.vencimento || '') || !date(data.vencimento.split('-').reverse().join('/'))) fields.push('data da primeira parcela');
    return fields;
  }
  function read(input) {
    const text = normalize(input), t = plain(input);
    // Contractual summary wins over guides, illustrative examples and appendices.
    const start = t.search(/5\s*\)\s*do preco do imovel e forma de pagamento/);
    if (start >= 0 && /parcela\s+tenda\s+pre\s*-?\s*chaves/.test(t)) {
      const tail = t.slice(start), end = tail.search(/6\s*\)\s*da correcao/);
      const summary = end >= 0 ? tail.slice(0,end) : tail;
      const components = [];
      const price = summary.match(/preco a vista[\s\S]{0,250}?(?:R\$\s*)+([\d.]+,\d{1,2})/i);
      const sections = summary.split(/(?=parcela\s+(?:ato\s*:|financiamento\s*:|tenda\s+(?:pre|pos)\s*-?\s*(?:chaves|obra)))/);
      for (const section of sections) {
        const title = section.match(/^parcela\s+(ato|financiamento|tenda\s+(?:pre|pos)\s*-?\s*(?:chaves|obra)(?:\s+intermediaria)?)/)?.[1];
        if (!title) continue;
        if (/intermediaria/.test(title)) {
          const schedule = [...section.matchAll(/vencimento\s*(\d{2}\/\d{2}\/\d{4})\s*(?:R\$\s*)+([\d.]+,\d{1,2})/gi)];
          schedule.forEach((m,i) => components.push({label:`Intermediária ${i+1}`,dados:{nomeCliente:`Tenda — Intermediária ${i+1}`,instituicao:'Tenda',tipo:'Financiamento',parcelas:1,valorTotal:amount(m[2]),valorParcela:amount(m[2]),vencimento:date(m[1])}}));
          continue;
        }
        const value = section.match(money);
        if (!value) continue;
        if (title === 'financiamento') {
          components.push({label:'Financiamento bancário — condições a confirmar',dados:{nomeCliente:'Financiamento bancário',tipo:'Financiamento',valorTotal:amount(value[1])},aviso:'Valor previsto no contrato de compra, sujeito aos abatimentos de subsídio e FGTS. Confirme o saldo com o banco: este documento não define a prestação nem o prazo bancário. Não usar os exemplos do guia como condições contratadas.'});
        } else if (title === 'ato') {
          components.push({label:'Entrada / ato',dados:{nomeCliente:'Tenda — Entrada',instituicao:'Tenda',tipo:'Financiamento',parcelas:1,valorTotal:amount(value[1]),valorParcela:amount(value[1])},aviso:'Entrada prevista não significa pagamento realizado. Confirme o vencimento.'});
        } else {
          const count = section.match(/(?:por\s+)?(\d+)\s*parcela\s*\(s\)\s*mensal\s*\(is\)/);
          if (!count) continue;
          const monthly = amount(value[1]), n = Number(count[1]), post = /pos/.test(title);
          const due = firstDate(section.slice(section.search(/primeira em/)));
          components.push({label:post?'Parcelas pós-obra':'Parcelas pré-chaves',dados:{nomeCliente:post?'Tenda — Pós-obra':'Tenda — Pré-chaves',instituicao:'Tenda',tipo:'Financiamento',parcelas:n,valorParcela:monthly,valorTotal:Math.round(n*monthly*100)/100,vencimento:due},aviso:'Total nominal deste bloco. Os valores estão sujeitos aos reajustes previstos no contrato; não inclui os outros blocos nem a prestação do banco.'});
        }
      }
      return {tipo:'Financiamento',dados:{},components,precoImovel:price?amount(price[1]):null,avisos:['Contrato com diferentes obrigações. Escolha um bloco para revisar; não somamos entrada, construtora e financiamento como uma única prestação.']};
    }
    if (/loca[cç][aã]o|locacao/.test(t) && /aluguel/.test(t)) {
      const rental = t.match(/aluguel\s+(?:inicial\s+)?(?:ajustado[\s\S]{0,100}?)?(?:e\s+de|no\s+valor\s+de|:|de)\s*(?:R\$\s*)+([\d.]+,\d{1,2})/i);
      const term = t.match(/prazo\s+(?:da\s+locacao\s+)?(?:e\s+de\s+|de\s+|:\s*)?\(?\s*(\d+)\s*\)?\s*(?:[a-z]+\s+){0,4}meses/);
      const data = {nomeCliente:'Aluguel',tipo:'Aluguel'};
      if (rental) data.valorParcela = amount(rental[1]);
      if (term) data.parcelas = Number(term[1]);
      if (data.valorParcela && data.parcelas) data.valorTotal = Math.round(data.valorParcela*data.parcelas*100)/100;
      const beginning = t.match(/(?:a iniciar em|inicio\s*(?:em|:))\s*(\d{2}\/\d{2}\/\d{4})/);
      if (beginning) data.inicioContrato = date(beginning[1]);
      const warnings = ['Total base dos aluguéis do prazo inicial; não inclui reajustes, condomínio, tributos ou encargos. O contrato não comprova parcelas já pagas.'];
      if (/ultimo dia util/.test(t)) warnings.push('Vencimento no último dia útil. A tolerância não é o vencimento. Informe a primeira data efetiva antes de salvar; feriados e reajustes futuros precisam de revisão.');
      else {
        const due = t.match(/primeiro\s+(?:aluguel|vencimento)[\s\S]{0,45}?(\d{2}\/\d{2}\/\d{4})/);
        if (due) data.vencimento = date(due[1]);
        else warnings.push('O início da locação não determina o primeiro vencimento. Confirme a data antes de salvar.');
      }
      return {tipo:'Aluguel',dados:data,components:[],avisos:warnings};
    }
    return null;
  }
  async function fingerprint(text) {
    const bytes = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalize(text)));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
  }
  function pending(data) {
    const fields = missing(data);
    const paid = data.parcelasPagas ?? 0;
    if (!Number.isInteger(paid) || paid < 0 || paid > data.parcelas) fields.push('parcelas já pagas válidas');
    return fields;
  }
  function plan(items) {
    const ready = [], incomplete = [];
    items.forEach((item,index) => {
      if (!item.selecionado || item.salvo) return;
      const fields = pending(item.dados);
      if (fields.length) incomplete.push({index,fields});
      else ready.push({index,dados:{...item.dados}});
    });
    return {ready,incomplete};
  }
  const api = {read,missing,normalize,fingerprint,pending,plan};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BudContractReader = api;
})(typeof window === 'undefined'?globalThis:window);



