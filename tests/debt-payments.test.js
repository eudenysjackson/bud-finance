const {test}=require('node:test');
const assert=require('node:assert/strict');
const payments=require('../appbudfinance/js/debt-payments');

// In-memory transactional adapter: reads precede writes, failed commits leave no effects.
function fixture(debt={}) {
 const key=(name,id)=>`usuarios/u/${name}/${id}`;
 const state=new Map([[key('dividas','d'),{nome:'Empréstimo',valorTotal:300,valorParcela:100,parcelas:3,parcelasPagas:0,valorPago:0,vencimento:'2026-01-31',...debt}],
 [key('carteira','a'),{nome:'Conta A',saldo:1000}],[key('carteira','b'),{nome:'Conta B',saldo:800}]]);
 let next=0,fail=false;
 const service=payments.createService({db:{},collection:(_, ...parts)=>parts.join('/'),doc:(...parts)=>parts.length===1?{path:parts[0]+'/auto'+(++next),id:'auto'+next}:{path:parts.slice(1).join('/')},
 Timestamp:{fromDate:d=>d.toISOString()},serverTimestamp:()=>({seconds:123}),
 runTransaction:async(_,callback)=>{const pending=[];let written=false;
 const tx={get:async ref=>{assert.equal(written,false,'Firestore requires all reads before writes');const value=state.get(ref.path);return {exists:()=>value!==undefined,data:()=>structuredClone(value)};},
 set:(r,v)=>{written=true;pending.push(['set',r.path,v]);},update:(r,v)=>{written=true;pending.push(['update',r.path,v]);},delete:r=>{written=true;pending.push(['delete',r.path]);}};
 const result=await callback(tx);if(fail)throw Error('network commit failed');
 for(const [op,path,value]of pending){if(op==='delete')state.delete(path);else state.set(path,op==='update'?{...state.get(path),...structuredClone(value)}:structuredClone(value));}return result;}});
 return {service,state,key,get:(name,id)=>state.get(key(name,id)),rows:name=>[...state].filter(([k])=>k.includes('/'+name+'/')).map(([,v])=>v),fail:()=>{fail=true;}};
}
const request={uid:'u',debtId:'d',index:0,date:'2026-11-02',expectedPaid:0,expectedAmount:100};

test('account payment debits once, records actual date separately from due date and audits account',async()=>{
 const f=fixture();await f.service.confirm({...request,accountId:'a'});
 assert.equal(f.get('carteira','a').saldo,900);assert.equal(f.get('dividas','d').parcelasPagas,1);
 const [expense]=f.rows('transacoes');assert.equal(expense.dataReferencia,'2026-11-02');assert.equal(expense.dataVencimento,'2026-01-31');assert.equal(expense.valor,100);
 assert.equal(f.rows('pagamentos-dividas')[0].contaNome,'Conta A');
 assert.equal((await f.service.confirm({...request,accountId:'a'})).already,true);
 assert.equal(f.rows('transacoes').length,1);assert.equal(f.get('carteira','a').saldo,900);
});
test('mark-only stores debt history without expense or changing any account',async()=>{
 const f=fixture();await f.service.confirm(request);
 assert.equal(f.rows('transacoes').length,0);assert.equal(f.get('carteira','a').saldo,1000);
 assert.equal(f.get('dividas','d').parcelasPagamentos[0].modo,'sem_conta');assert.equal(f.rows('pagamentos-dividas').length,1);
 await f.service.reverse({uid:'u',debtId:'d',index:0});
 assert.equal(f.get('dividas','d').parcelasPagas,0);assert.equal(f.rows('pagamentos-dividas').length,2);assert.equal(f.get('carteira','a').saldo,1000);
});
test('later installment explicitly covers contiguous prefix and total',async()=>{
 const f=fixture();assert.deepEqual(payments.model(f.get('dividas','d'),2),{paid:0,total:3,installment:100,count:3,amount:300});
 await f.service.confirm({...request,index:2,expectedAmount:300,accountId:'a'});
 assert.equal(f.rows('transacoes').length,3);assert.equal(f.get('carteira','a').saldo,700);assert.equal(f.get('dividas','d').valorPago,300);
 assert.equal(f.get('dividas','d').parcelasPagamentos[1].vencimento,'2026-02-28');
 await assert.rejects(f.service.reverse({uid:'u',debtId:'d',index:0}),/última/);
});
test('undo uses original payment account even after changing debt default and preserves audit',async()=>{
 const f=fixture();await f.service.confirm({...request,accountId:'a'});f.get('dividas','d').contaId='b';
 await f.service.reverse({uid:'u',debtId:'d',index:0});
 assert.equal(f.get('carteira','a').saldo,1000);assert.equal(f.get('carteira','b').saldo,800);assert.equal(f.rows('transacoes').length,0);
 assert.equal(f.rows('pagamentos-dividas').at(-1).acao,'desmarcado');assert.equal(f.rows('pagamentos-dividas').at(-1).contaNome,'Conta A');
 assert.equal((await f.service.reverse({uid:'u',debtId:'d',index:0})).already,true);
});
test('missing legacy account never credits the current default account on undo',async()=>{
 const f=fixture({parcelasPagas:1,valorPago:100,contaId:'b'});await f.service.reverse({uid:'u',debtId:'d',index:0});
 assert.equal(f.get('carteira','b').saldo,800);assert.equal(f.rows('pagamentos-dividas')[0].modo,'legado');
});
test('stale values, unavailable account, insufficient balance and failed commit are atomic',async()=>{
 for(const [options,pattern]of [[{expectedAmount:90},/valor/],[{expectedPaid:1},/outra tela/],[{accountId:'missing'},/conta disponível/],[{accountId:'b'},/Saldo insuficiente/]]){
  const f=fixture();f.get('carteira','b').saldo=50;const before=structuredClone([...f.state]);
  await assert.rejects(f.service.confirm({...request,...options}),pattern);assert.deepEqual([...f.state],before);
 }
 const f=fixture();const before=structuredClone([...f.state]);f.fail();await assert.rejects(f.service.confirm({...request,accountId:'a'}),/network/);assert.deepEqual([...f.state],before);
});
test('card reserved release is capped and undo restores exact release',async()=>{
 const f=fixture({tipo:'parcelamento_fatura',cartaoId:'card'});f.state.set(f.key('carteira','card'),{tipo:'credito',limiteReservado:25});
 await f.service.confirm(request);assert.equal(f.get('carteira','card').limiteReservado,0);
 await f.service.reverse({uid:'u',debtId:'d',index:0});assert.equal(f.get('carteira','card').limiteReservado,25);
});
test('invalid dates do not become another calendar day',async()=>{
 assert.equal(payments.validDate('2026-02-29'),false);assert.equal(payments.validDate('2028-02-29'),true);
 const f=fixture();await assert.rejects(f.service.confirm({...request,date:'2026-02-30'}),/data válida/);assert.equal(f.rows('pagamentos-dividas').length,0);
});


test('debt status follows outstanding installments when the recorded principal is too low', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync('appbudfinance/js/dividas.js', 'utf8');
  const code = source.slice(source.indexOf('function dividaQuitada('), source.indexOf('// Retorna quantas parcelas'));
  const { dividaQuitada, calcularSaldoDevedor, progressoParcelas } = new Function(code + '\nreturn { dividaQuitada, calcularSaldoDevedor, progressoParcelas };')();
  const debt = { valorTotal: 3.99, valorParcela: 3.99, parcelas: 3, parcelasPagas: 2 };
  assert.equal(dividaQuitada(debt), false);
  assert.equal(progressoParcelas(debt), 67);
  assert.equal(calcularSaldoDevedor(debt), 3.99);
  assert.equal(calcularSaldoDevedor({ ...debt, valorTotal: 11.97 }), 3.99);
  const paid = { ...debt, valorTotal: 12, parcelasPagas: 3 };
  assert.equal(dividaQuitada(paid), true);
  assert.equal(progressoParcelas(paid), 100);
  assert.equal(calcularSaldoDevedor(paid), 0);
});
