const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('appbudfinance/js/dashboard.js','utf8');
const start=source.indexOf('await runTransaction(db, async function(transaction)',source.indexOf('function abrirConfirmacaoPendente'));
const body=source.slice(start,source.indexOf('      overlay.remove();',start));
test('recurring receipt credits actual amount exactly once with the same atomic transaction',async()=>{
 const docs={tx:{tipo:'receita',confirmado:false,pendenteConfirmacao:true,mesReferencia:'2026-11'},wallet:{tipo:'corrente',saldo:-200}};
 const execute=()=>vm.runInNewContext('(async()=>{'+body+'})()',{
  db:{},usuarioAtualId:'demo',tx:{id:'tx'},contaId:'wallet',valor:350,previsto:300,data:'2026-11-09',dataObj:new Date(),
  doc:(_db,_users,_uid,_collection,id)=>id,Timestamp:{fromDate:d=>d},serverTimestamp:()=>new Date(),
  runTransaction:async(_db,cb)=>{const writes=[];await cb({get:async id=>({exists:()=>!!docs[id],data:()=>({...docs[id]})}),update:(id,value)=>writes.push([id,value])});for(const [id,value]of writes)Object.assign(docs[id],value);}
 });
 await execute();assert.equal(docs.wallet.saldo,150);assert.equal(docs.tx.valor,350);assert.equal(docs.tx.valorPrevisto,300);assert.equal(docs.tx.mesRecorrencia,'2026-11');assert.equal(docs.tx.pendenteConfirmacao,false);
 await execute();assert.equal(docs.wallet.saldo,150);
});
test('dashboard renders pending receipts across the selected month and binds visible confirmation',()=>{
 const html=fs.readFileSync('appbudfinance/dashboard.html','utf8');
 assert(html.includes('id="secPrioridadesHoje"'));assert(html.includes('id="listaPrioridadesHoje"'));
 const section=source.slice(source.indexOf('function atualizarPrioridadesHoje()'),source.indexOf('function abrirConfirmacaoPendente'));
 assert(section.includes('pendenciasRecorrentes.filter'));assert(section.includes('abrirConfirmacaoPendente(item._lembrete.pendencia)'));
 assert(!section.includes('mesVisualizado'));
});

test('all reminder buttons resolve persisted pending data and use the atomic confirmation',()=>{
 const route=source.slice(source.indexOf('function marcarLembretePago'),source.indexOf('// ─── Modal: Confirmar recorrências pendentes'));
 assert(route.includes('conferirRecorrencia(lembrete)'));assert(route.includes('abrirConfirmacaoPendente(pendente)'));assert(!route.includes('await addDoc'));assert(!source.includes('pmgContaSel'));
 const activities=source.slice(source.indexOf('function renderizarAtividades'));
 assert(activities.includes('t.pendenteConfirmacao !== true'));
});
