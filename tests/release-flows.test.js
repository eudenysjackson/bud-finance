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

test('a goal deposit commits history, transaction and balance as one operation',async()=>{
  const source=fs.readFileSync('appbudfinance/js/metas.js','utf8');
  const start=source.indexOf('async function handleSubmitAporte(');
  const end=source.indexOf('function setupModalHistorico()',start);
  const code=source.slice(start,end);
  const writes=[];let committed=false;
  const context={metasGlobal:[{id:'goal',nome:'QA',valorAtual:0}],metaAportandoId:'goal',currentUser:{uid:'qa'},db:{},
    parseBRL:()=>10,document:{getElementById:id=>({value:id==='aporteData'?'2026-10-27':id==='aporteCarteiraId'?'account':'10'})},
    doc:(...parts)=>({path:parts}),collection:(...parts)=>({path:parts}),serverTimestamp:()=>1,increment:value=>({increment:value}),Timestamp:{fromDate:value=>value},
    writeBatch:()=>({update:(ref,data)=>writes.push({kind:'update',ref,data}),set:(ref,data)=>writes.push({kind:'set',ref,data}),commit:async()=>{committed=true;}}),
    window:{budShowToast(){}},fecharModalAporte(){}};
  vm.runInNewContext(code,context);await context.handleSubmitAporte({preventDefault(){}});
  assert.equal(committed,true);assert.equal(writes.length,4);
  assert.equal(writes.find(w=>w.data.origem==='meta').data.dataReferencia,'2026-10-27');
  assert.equal(writes.filter(w=>w.data.valor===10).length,2);
  assert.equal(writes.find(w=>w.data.saldo).data.saldo.increment,-10);
});
