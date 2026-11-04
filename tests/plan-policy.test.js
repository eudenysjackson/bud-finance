const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const policy = require('../backend/plan-policy');
const { createFinancialWrite, parsePath, same } = require('../backend/financial-write');
function fixture(plan = 'free', extra = {}) {
  const state = new Map([['usuarios/u',{plano:plan,...extra}]]);
  const ref = path => ({path,id:path.split('/').at(-1),collection:name=>collection(path+'/'+name)});
  const collection = path => ({path,query:true,doc:id=>ref(path+'/'+id)});
  const snapshot = path => ({exists:state.has(path),data:()=>state.get(path)});
  let tail = Promise.resolve();
  const db={doc:ref,runTransaction:cb=>{
    const run=tail.then(async()=>{
      const writes=[];
      const value=await cb({get:async r=>r.query?{docs:[...state].filter(([p])=>p.startsWith(r.path+'/')&&p.split('/').length===r.path.split('/').length+1).map(([p,v])=>({id:p.split('/').at(-1),data:()=>v}))}:snapshot(r.path),set:(r,v,o)=>writes.push(()=>state.set(r.path,o?.merge?{...state.get(r.path),...v}:v)),update:(r,v)=>writes.push(()=>state.set(r.path,{...state.get(r.path),...v})),delete:r=>writes.push(()=>state.delete(r.path))});
      writes.forEach(fn=>fn());return value;
    });tail=run.catch(()=>{});return run;
  }};
  const admin={firestore:{FieldValue:{serverTimestamp:()=>Date.now()},Timestamp:{fromMillis:value=>({toMillis:()=>value})}}};
  const handler=createFinancialWrite({db,admin});
  async function save(operations, options={}) {
    const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await handler({budUser:{uid:'u'},body:{operations,operationId:crypto.randomUUID(),...options}},res);return res;
  }
  return {state,save};
}
const set=(category,id,data={})=>({type:'set',path:`usuarios/u/${category}/${id}`,data});
test('authoritative caps match requested plans and trial is exactly Plus until expiry',()=>{
  for(const [plan,values] of Object.entries({free:[1,1,5,0,0],starter:[1,1,10,0,0],pro:[2,2,15,5,5],plus:[Infinity,Infinity,Infinity,Infinity,Infinity]}))assert.deepEqual(Object.values(policy.limits({plano:plan})),values);
  assert.equal(policy.effectivePlan({plano:'trial',trialFim:new Date(2000)},1999),'trial');
  assert.equal(policy.effectivePlan({plano:'trial',trialFim:new Date(2000)},2000),'free');
  assert.equal(policy.effectivePlan({plano:'trial'}),'free');
  assert.deepEqual(policy.limits({plano:'trial',trialFim:new Date(Date.now()+10000)}),policy.LIMITS.plus);
});
test('monthly transaction quota rejects overflow atomically and deletion does not restore quota',async()=>{
  const f=fixture();assert.equal((await f.save(Array.from({length:5},(_,i)=>set('transacoes','t'+i)))).statusCode,200);
  const before=[...f.state];assert.equal((await f.save([set('transacoes','six'),set('metas','bad')])).statusCode,403);assert.deepEqual([...f.state],before);
  await f.save([{type:'delete',path:'usuarios/u/transacoes/t0'}]);assert.equal((await f.save([set('transacoes','six')])).statusCode,403);
  assert.equal((await f.save([{type:'update',path:'usuarios/u/transacoes/t1',data:{descricao:'Editada'}}])).statusCode,200);
});
test('parallel submissions cannot exceed quota and repeated operation cannot duplicate effects',async()=>{
  const f=fixture(),results=await Promise.all(Array.from({length:8},(_,i)=>f.save([set('transacoes','t'+i)])));
  assert.equal(results.filter(r=>r.statusCode===200).length,5);
  const g=fixture(),operationId=crypto.randomUUID(),ops=[set('transacoes','once')];
  await g.save(ops,{operationId});assert.equal((await g.save(ops,{operationId})).body.repeated,true);
  assert.equal(g.state.get('usuarios/u/_plan_usage/'+policy.month()).transactions,1);
});
test('account/card limits are independent; excess after trial remains stored but cannot be modified',async()=>{
  const f=fixture();assert.equal((await f.save([set('carteira','a',{tipo:'debito'}),set('carteira','c',{tipo:'credito'})])).statusCode,200);
  assert.equal((await f.save([set('carteira','b',{tipo:'debito'})])).statusCode,403);
  f.state.set('usuarios/u/carteira/z',{tipo:'debito',saldo:500});
  assert.equal((await f.save([{type:'update',path:'usuarios/u/carteira/z',data:{saldo:0}}])).statusCode,403);
  assert.equal(f.state.get('usuarios/u/carteira/z').saldo,500);
  assert.equal((await f.save([set('transacoes','t',{contaId:'z'})])).statusCode,403);
});
test('imports forbidden for Free/Starter and Pro imports counted once with its history record',async()=>{
  for(const plan of ['free','starter'])assert.equal((await fixture(plan).save([set('transacoes','i',{origem:'importacao'})])).statusCode,403);
  const f=fixture('pro');
  for(let i=0;i<5;i++){
    assert.equal((await f.save([set('transacoes','i'+i,{origem:'importacao',importacaoId:'file'+i})])).statusCode,200);
    assert.equal((await f.save([set('importacoes','i'+i,{importacaoId:'file'+i})])).statusCode,200);
  }
  assert.equal((await f.save([set('transacoes','six',{origem:'importacao',importacaoId:'six'})])).statusCode,403);
});
test('expired trial cannot write premium data, active trial and Plus accept large batches',async()=>{
  const expired=fixture('trial',{trialFim:new Date(Date.now()-1)});
  assert.equal((await expired.save([set('metas','g')])).statusCode,403);
  for(const f of [fixture('plus'),fixture('trial',{trialFim:new Date(Date.now()+10000)})])assert.equal((await f.save(Array.from({length:50},(_,i)=>set('transacoes','t'+i)))).statusCode,200);
});
test('cross-user/private paths and stale reads rejected without writes',async()=>{
  assert.throws(()=>parsePath('usuarios/other/transacoes/t','u'));
  assert.throws(()=>parsePath('usuarios/u/_plan_usage/2026-11','u'));
  assert(same({b:1,a:{toMillis:()=>123}},{a:{$bud:'timestamp',value:123},b:1}));
  const f=fixture();f.state.set('usuarios/u/metas/g',{valorAtual:20});
  assert.equal((await f.save([set('transacoes','x')],{reads:[{path:'usuarios/u/metas/g',data:{valorAtual:10}}]})).statusCode,409);
  assert.equal(f.state.has('usuarios/u/transacoes/x'),false);
});
test('installments count in each invoice month and a full future month rejects the entire batch',async()=>{
  const f=fixture();
  const installments=Array.from({length:6},(_,i)=>set('transacoes','p'+i,{dataReferencia:`2027-0${i+1}-10`,valor:20}));
  assert.equal((await f.save(installments)).statusCode,200);
  for(let i=1;i<=6;i++) assert.equal(f.state.get(`usuarios/u/_plan_usage/2027-0${i}`).transactions,1);
  await f.save(Array.from({length:4},(_,i)=>set('transacoes','more'+i,{dataReferencia:'2027-03-10'})));
  const before=[...f.state];
  assert.equal((await f.save([set('transacoes','new1',{dataReferencia:'2027-02-10'}),set('transacoes','new2',{dataReferencia:'2027-03-10'})])).statusCode,403);
  assert.deepEqual([...f.state],before);
});
