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
    CustomEvent: class {}, setTimeout: callback => callback(), fetch: async (url, options) => { calls.push({ url, options }); return responses.shift(); } };
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
