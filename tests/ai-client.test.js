const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('cliente acompanha trabalho e devolve o resultado sem repetir o upload', async () => {
  const source = fs.readFileSync('appbudfinance/js/bud-utils.js', 'utf8');
  const code = source.slice(source.indexOf('  window.budAIRequest ='), source.lastIndexOf('})();'));
  const calls = [], progress = { textContent: '' };
  const responses = [
    new Response(JSON.stringify({ jobId: 'abc' }), { status: 202 }),
    new Response(JSON.stringify({ state: 'running', message: 'Lendo página 2...' })),
    new Response(JSON.stringify({ state: 'completed', status: 200, result: { transacoes: [{ valor: 10 }] } })),
  ];
  const context = { window: { dispatchEvent() {} }, document: { getElementById: () => progress }, Headers, Response, URL, DOMException,
    AbortController, clearTimeout() {}, CustomEvent: class {}, setTimeout: (callback, ms) => { if (ms === 1500) callback(); }, fetch: async (url, options) => { calls.push({ url, options }); return responses.shift(); } };
  vm.runInNewContext(code, context);
  const response = await context.window.budAIRequest('http://localhost:3000/api/extrair-fatura', { method: 'POST', headers: { Authorization: 'Bearer teste' }, body: 'arquivo' });
  assert.equal((await response.json()).transacoes[0].valor, 10);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers.get('X-Bud-Async'), '1');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer teste');
  assert.equal(calls[1].url, 'http://localhost:3000/api/ia/jobs/abc');
  assert.equal(calls[1].options.body, undefined);
  assert.equal(progress.textContent, 'Lendo página 2...');
});

function client(fetchImpl, timers) {
  const source=fs.readFileSync('appbudfinance/js/bud-utils.js','utf8');
  const code=source.slice(source.indexOf('  window.budAIRequest ='),source.lastIndexOf('})();'));
  const context={window:{dispatchEvent(){}},document:{getElementById:()=>null},Headers,Response,URL,DOMException,AbortController,
    CustomEvent:class{},setTimeout:timers,clearTimeout(){},fetch:fetchImpl};
  vm.runInNewContext(code,context);return context.window.budAIRequest;
}

test('acompanhamento sempre running encerra no prazo global, sem novo upload', async()=>{
  let deadline,calls=0;
  const request=client(async()=>{
    if(++calls===1)return new Response(JSON.stringify({jobId:'test'}),{status:202});
    deadline();return new Response(JSON.stringify({state:'running'}));
  },(fn,ms)=>{if(ms===210000)deadline=fn;if(ms===1500)fn();});
  await assert.rejects(request('https://backend.test/api/extrair-fatura',{}),/excedeu o tempo/);assert.equal(calls,2);
});

test('conexão sem resposta encerra e apresenta indisponibilidade',async()=>{
  const request=client(async(_,options)=>{if(options.signal.aborted)throw new DOMException('timeout','AbortError');return new Promise(()=>{});},(fn,ms)=>{if(ms===30000)fn();});
  await assert.rejects(request('https://backend.test/api/extrair-fatura',{}),/serviço de leitura não respondeu/);
});

