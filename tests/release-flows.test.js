const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('reports load credit cards from the current wallet and ignore debit accounts', async()=>{
  const source=fs.readFileSync('appbudfinance/js/relatorios.js','utf8');
  const code=source.slice(source.indexOf('async function buscarERenderi()'),source.indexOf('// ─── Render dispatcher'));
  const rows={carteira:[{id:'cc',tipo:'credito',nome:'Cartão atual'},{id:'debit',tipo:'debito'}],cartoes:[{id:'legacy'}],dividas:[],transacoes:[]};
  const context={currentUser:{uid:'qa'},dataFiltro:new Date('2026-10-01'),db:{},
    collection:(_,users,uid,name)=>({name}),where:(key,op,value)=>({key,op,value}),orderBy:()=>({}),query:(collection,...filters)=>({...collection,filters}),
    getDocs:async q=>({docs:(rows[q.name]||[]).filter(row=>(q.filters||[]).every(f=>!f.key||row[f.key]===f.value)).map(row=>({id:row.id,data:()=>row}))}),
    normalizarData:value=>value,renderTudo(){},showToast:message=>{throw Error(message);},console};
  vm.runInNewContext(code,context);await context.buscarERenderi();
  assert.deepEqual(Array.from(context.cartoesCredito,t=>t.id),['cc']);
});

test('goal deposit form delegates one dated account operation to the atomic service',async()=>{
 const source=fs.readFileSync('appbudfinance/js/metas.js','utf8');const start=source.indexOf('let _aporteAttempt='),end=source.indexOf('function setupModalHistorico()',start);const calls=[];
 const controls={btnConfirmarAporte:{disabled:false},aporteValor:{value:'200'},aporteData:{value:'2026-11-02'},aporteCarteiraId:{value:'account'}};
 const context={metasGlobal:[{id:'goal',nome:'QA',valorAtual:0,valorAlvo:600}],metaAportandoId:'goal',currentUser:{uid:'qa'},db:{},parseBRL:Number,document:{getElementById:id=>controls[id]},crypto:{randomUUID:()=> 'op'},doc(){},collection(){},runTransaction(){},serverTimestamp(){},Timestamp:{},window:{BudGoalPurchase:{createService:()=>({deposit:async request=>calls.push(request)})},budShowToast(){}},fecharModalAporte(){}};
 vm.runInNewContext(source.slice(start,end),context);await context.handleSubmitAporte({preventDefault(){}});assert.equal(calls.length,1);assert.equal(calls[0].value,200);assert.equal(calls[0].date,'2026-11-02');assert.equal(calls[0].accountId,'account');assert.equal(calls[0].operationId,'op');
});

