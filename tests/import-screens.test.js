const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Contas sends bearer authentication and preserves a provider error', async () => {
  const source = fs.readFileSync('appbudfinance/js/carteira.js','utf8');
  const code = source.slice(source.indexOf('async function processarViaBackend('), source.indexOf('// ── CSV Parser'));
  let request;
  const context = { auth: { currentUser: { getIdToken: async () => 'local-test-token' } },
    FormData, AbortController, clearTimeout, BACKEND_URL: 'http://local', _importMeta: null,
    window: { budAIRequest: async (url, options) => { request = {url,options}; return new Response(JSON.stringify({error:'Arquivo inválido.'}),{status:422}); } } };
  vm.runInNewContext(code, context);
  await assert.rejects(context.processarViaBackend(new Blob(['ficticio'],{type:'application/pdf'})), /Arquivo inválido/);
  assert.equal(request.options.headers.Authorization,'Bearer local-test-token');
  assert.equal(request.options.body.get('tipo'),'extrato');
});

test('Dívidas reads all six PDF pages and destroys the PDF document', async () => {
  const source = fs.readFileSync('appbudfinance/js/dividas.js','utf8');
  const code = source.slice(source.indexOf('window.processarArquivoIA ='), source.indexOf('window.processarTextoIA ='));
  const pages = []; let destroyed = false; let extracted;
  const pdfDoc = { numPages:6, getPage: async p => { pages.push(p); return { getTextContent: async () => ({items:[{str:p===6?'Valor total financiado R$ 1.200,00':'Página '+p}]}), cleanup(){} }; }, destroy:async()=>{destroyed=true;} };
  const nodes = new Map();
  const context = { salvandoBlocos:false, window: { pdfjsLib:{GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(pdfDoc)})} },
    document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{style:{}});return nodes.get(id);}}, animarStepsIA(){},
    processarTextoExtraido:async text=>{extracted=text;}, mostrarErroIA:message=>{throw Error(message);} };
  vm.runInNewContext(code,context);
  await context.window.processarArquivoIA({files:[{name:'contrato.pdf',type:'application/pdf',arrayBuffer:async()=>new ArrayBuffer(0)}]});
  assert.deepEqual(pages,[1,2,3,4,5,6]);
  assert.match(extracted,/Valor total financiado/);
  assert.equal(destroyed,true);
});

