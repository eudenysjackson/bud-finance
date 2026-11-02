const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readPDF } = require('../backend/ai-reader');
const { readNubankInvoice } = require('../backend/invoice-reader');

const invoice = rows => `Nu Pagamentos S.A.\nFATURA 08 JAN 2026\nRESUMO DA FATURA ATUAL\nTotal a pagar R$ 20,00\nPRÓXIMAS FATURAS\nTRANSAÇÕES\nDE 01 DEZ A 01 JAN\n${rows}\n1 de 1`;
test('preserves repeated purchases, refunds and December year rollover', () => {
  const result = readNubankInvoice(invoice('02 DEZ\nLoja R$ 20,00\n02 DEZ\nLoja R$ 20,00\n03 DEZ\nEstorno de Loja −R$ 20,00'));
  assert.deepEqual(result.transacoes.map(t => t.valor), [20,20,-20]);
  assert.ok(result.transacoes.every(t => t.data.startsWith('2025-12')));
});
test('unreconciled or unknown layout falls back, never invents an adjustment', () => {
  assert.equal(readNubankInvoice(invoice('02 DEZ\nLoja R$ 19,00')), null);
  assert.equal(readNubankInvoice(invoice('02 DEZ\nLoja R$ 20,00').replace('Nu Pagamentos S.A.', 'Outro banco')), null);
});

test('adjacent currency and one-cent discrepancy preserve source rows for explicit review', () => {
  const text = invoice('02 DEZ\nLoja R$ 19,99').replace('Total a pagar R$', 'Total a pagarR$');
  const result = readNubankInvoice(text);
  assert.equal(result.transacoes.length, 1);
  assert.equal(result.transacoes[0].valor, 19.99);
  assert.equal(result.meta.totalAPagar, 20);
  assert.equal(result.meta.totalLancamentos, 19.99);
  assert.equal(result.meta.differenceCents, -1);
  assert.equal(result.meta.requiresReview, true);
  assert.equal(readNubankInvoice(text.replace('19,99', '19,98')), null);
  assert.equal(readNubankInvoice(text.replace('19,99', '20,01')).meta.differenceCents, 1);
});
test('multi-page PDF extracts 24 purchases without an AI request', async () => {
  const pages = await readPDF(fs.readFileSync('tests/fixtures/ia/nubank-layout.pdf'));
  const result = readNubankInvoice(pages.map(p => p.text).join('\n'));
  assert.equal(result.transacoes.length, 24);
  assert.equal(result.transacoes.reduce((sum,t) => sum+t.valor,0),300);
});
test('review does not fabricate balancing items or infer refunds from totals', () => {
  const source = fs.readFileSync('appbudfinance/js/cartoes.js','utf8');
  assert.ok(!source.includes("desc: 'Saldo anterior e ajustes da fatura'"));
  assert.ok(!source.includes('[BudAI] Auto-correção:'));
});

test('validated PDF keeps purchases and signed credits even when amounts repeat', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync('appbudfinance/js/cartoes.js','utf8');
  const start=source.indexOf('function processarItensIA(itens)');
  const end=source.indexOf('\nfunction ',start+10);
  const context={_importMetaIA:{signedAmounts:true,estornos:[20]},detectarCategoriaIA:()=> 'Outros',window:{BudInvoiceRefunds:require('../appbudfinance/js/invoice-refunds')}};
  vm.createContext(context);
  vm.runInContext(source.slice(start,end)+'; result=processarItensIA([{desc:"Loja",valor:20,data:"2026-01-02"},{desc:"Loja",valor:20,data:"2026-01-02"},{desc:"Estorno de Loja",valor:-20,data:"2026-01-03"}]);',context);
  assert.deepEqual(Array.from(context.result,x=>x.valor),[20,20,-20]);
  assert.ok(context.result.every(x=>x.selecionado));
  assert.equal(context.result[2].status,'credito');
  assert.equal(context.result.reduce((s,x)=>s+x.valor,0),20);
});

test('purchases remain active; explicit refunds reduce the persisted invoice', async () => {
  const vm=require('node:vm'), refunds=require('../appbudfinance/js/invoice-refunds');
  const source=fs.readFileSync('appbudfinance/js/cartoes.js','utf8');
  const extract=start=>{const i=source.indexOf(start);return source.slice(i,source.indexOf('\nfunction ',i+start.length));};
  const saved=[];
  const ctx={window:{BudInvoiceRefunds:refunds},_importMetaIA:{signedAmounts:true,totalAPagar:40},detectarCategoriaIA:()=> 'Outros',
    document:{getElementById:id=>id==='iaMes'?{value:'11'}:id==='iaAno'?{value:'2026'}:{}},uid:'test',cartaoImportIA:'card',db:{},
    collection:()=>({}),doc:()=>({}),writeBatch:()=>({set:(ref,data)=>saved.push(data),commit:async()=>{}}),
    budSanitize:x=>x,Timestamp:{fromDate:d=>d},serverTimestamp:()=>null,showToast:()=>{},fecharModalReviewIA:()=>{},
    cartoesGlobal:[],transacoesGlobal:[],itensIAExtraidos:[]};
  vm.createContext(ctx);
  vm.runInContext(extract('function processarItensIA(itens)')+extract('async function salvarTransacoesIA()')+extract('function calcularFatura(cartaoId, mesKey)'),ctx);
  ctx.rows=[{desc:'Loja',valor:20,data:'2026-10-02'},{desc:'Estorno de Loja',valor:-20,data:'2026-10-02'},{desc:'Mercado',valor:50,data:'2026-10-03'},{desc:'Estorno de Outra Loja',valor:-10,data:'2026-10-03'}];
  vm.runInContext('itensIAExtraidos=processarItensIA(rows)',ctx);
  assert.deepEqual(Array.from(ctx.itensIAExtraidos,x=>x.selecionado),[true,true,true,true]);
  assert.deepEqual(Array.from(ctx.itensIAExtraidos,x=>x.status),['ativa','credito','ativa','credito']);
  await vm.runInContext('salvarTransacoesIA()',ctx);
  assert.equal(saved.length,4);
  assert.deepEqual(saved.map(x=>x.valor),[20,-20,50,-10]);
  ctx.transacoesGlobal=saved;
  assert.equal(vm.runInContext('calcularFatura("card","2026-11")',ctx),40);
  ctx.transacoesGlobal=saved.map(x=>({...x}));
  ctx.cartaoImportIA='card';
  ctx._importMetaIA={signedAmounts:true,totalAPagar:40};
  vm.runInContext('itensIAExtraidos=processarItensIA(rows)',ctx);
  await vm.runInContext('salvarTransacoesIA()',ctx);
  assert.equal(saved.length,4,'an existing imported invoice must not be imported twice');
  ctx.transacoesGlobal=[];
  saved.length=0;ctx._importMetaIA={signedAmounts:true,totalAPagar:40};ctx.itensIAExtraidos=[{valor:50,selecionado:true,status:'ativa'}];
  await vm.runInContext('salvarTransacoesIA()',ctx);
  assert.equal(saved.length,0,'mismatched selection must not be persisted');
  ctx._importMetaIA={signedAmounts:true,totalAPagar:20};
  ctx.rows=[{desc:'Loja',valor:20,_fitIdOFX:'old'},{desc:'Estorno Loja',valor:-20,_fitIdOFX:'old'},{desc:'Loja',valor:20,_fitIdOFX:'new'}];
  vm.runInContext('itensIAExtraidos=processarItensIA(rows)',ctx);
  assert.deepEqual(Array.from(ctx.itensIAExtraidos,x=>x.selecionado),[false,false,true]);
  await vm.runInContext('salvarTransacoesIA()',ctx);
  assert.equal(saved.length,1);assert.equal(saved[0].valor,20);
  ctx.transacoesGlobal=saved;
  assert.equal(vm.runInContext('calcularFatura("card","2026-11")',ctx),20);

});

test('refund amount alone or ambiguous purchases never identify a cancelled pair', () => {
  const {classify}=require('../appbudfinance/js/invoice-refunds');
  assert.deepEqual(classify([{desc:'A',valor:20,data:'2026-10-01'},{desc:'Estorno de B',valor:-20,data:'2026-10-01'}]),['ativa','credito']);
  assert.deepEqual(classify([{desc:'A',valor:20,data:'2026-10-01'},{desc:'A',valor:20,data:'2026-10-01'},{desc:'Estorno de A',valor:-20,data:'2026-10-01'}]),['ativa','ativa','credito']);
});

test('source identifier excludes only the original pair, preserving a repeat purchase', () => {
  const {pairs}=require('../appbudfinance/js/invoice-refunds');
  const rows=[{desc:'Loja',valor:20,_fitIdOFX:'original'},{desc:'Estorno Loja',valor:-20,_fitIdOFX:'original'},{desc:'Loja',valor:20,_fitIdOFX:'new'}];
  assert.deepEqual(pairs(rows),{0:1,1:0});
  assert.deepEqual(pairs(rows.map(x=>({...x,_fitIdOFX:'ambiguous'}))),{});
  assert.deepEqual(pairs([{valor:20,_fitIdOFX:'a'},{valor:-10,_fitIdOFX:'a'}]),{});
});

test('reconciliation bar follows selection, catches overbilling and never claims accuracy', () => {
  const vm=require('node:vm'),source=fs.readFileSync('appbudfinance/js/cartoes.js','utf8');
  const start=source.indexOf('function _renderConfiabilidadeBadge()'),end=source.indexOf('\nfunction ',start+10);
  const badge={style:{},innerHTML:''},els={iaConfiabilidadeBadge:badge,iaFaturaTotalPdf:{style:{}},iaFaturaTotalPdfValor:{},iaFaturaTotalPdfLabel:{}};
  const ctx={document:{getElementById:id=>els[id]},_importMetaIA:{fonte:'pdf',totalAPagar:20},itensIAExtraidos:[{valor:40,status:'ativa',selecionado:true},{valor:-20,status:'credito',selecionado:true}]};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end)+';_renderConfiabilidadeBadge()',ctx);
  assert.match(badge.innerHTML,/Soma selecionada confere/);assert.match(badge.innerHTML,/role="progressbar"/);
  assert.doesNotMatch(badge.innerHTML,/precisão 100%/);
  ctx.itensIAExtraidos[1].selecionado=false;vm.runInContext('_renderConfiabilidadeBadge()',ctx);
  assert.match(badge.innerHTML,/20,00 acima/);
  ctx._importMetaIA.totalAPagar=40.01;vm.runInContext('_renderConfiabilidadeBadge()',ctx);
  assert.match(badge.innerHTML,/0,01 abaixo/);assert.doesNotMatch(badge.innerHTML,/Soma selecionada confere/);
});

test('structured invoice payment is excluded while an unmatched refund remains signed', () => {
  const vm=require('node:vm'),source=fs.readFileSync('appbudfinance/js/cartoes.js','utf8');
  const start=source.indexOf('function processarItensIA(itens)'),end=source.indexOf('\nfunction ',start+10);
  const ctx={_importMetaIA:{fonte:'ofx'},window:{BudInvoiceRefunds:require('../appbudfinance/js/invoice-refunds')},detectarCategoriaIA:()=> 'Outros'};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'; result=processarItensIA([{desc:"Pagamento recebido",valor:-100},{desc:"Estorno de Loja",valor:-10},{desc:"Loja",valor:20}])',ctx);
  assert.deepEqual(Array.from(ctx.result,x=>x.selecionado),[false,true,true]);
  assert.equal(ctx.result.filter(x=>x.selecionado).reduce((s,x)=>s+x.valor,0),10);
});

