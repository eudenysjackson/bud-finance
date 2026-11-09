const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
function fixture() {
 const requests=[],docs=new Map([['usuarios/u/carteira/a',{saldo:20}]]);
 const source=fs.readFileSync('appbudfinance/js/financial-firestore.js','utf8').replace(/^export \*.*$/m,'').replace(/^import .*$/gm,'').replaceAll('export ','');
 const ctx={crypto,AbortSignal,console,window:{BUD_FUNCTIONS_URL:'http://fixture'},getAuth:()=>({currentUser:{getIdToken:async()=>'fictitious'}}),sdk:{
  doc:collection=>({path:collection.path+'/new'}),getDocFromServer:async ref=>({exists:()=>docs.has(ref.path),data:()=>docs.get(ref.path)}),
  serverTimestamp:()=>({}),increment:()=>({}),deleteField:()=>({}),arrayUnion:()=>({}),arrayRemove:()=>({})
 },fetch:async(url,init)=>{requests.push(JSON.parse(init.body));return{ok:true,json:async()=>({ok:true})};}};
 vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.api={writeBatch,runTransaction,serverTimestamp,increment};',ctx);
 return{ctx,requests,api:ctx.api};
}
test('financial batch sends one atomic server request preserving transforms and dates',async()=>{
 const f=fixture(),b=f.api.writeBatch({});b.set({path:'usuarios/u/transacoes/t'},{data:f.api.serverTimestamp(),valor:10});b.update({path:'usuarios/u/carteira/a'},{saldo:f.api.increment(-10)});await b.commit();
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].operations.length,2);assert.deepEqual(f.requests[0].operations[1].data.saldo,{$bud:'increment',value:-10});
 await b.commit();assert.equal(f.requests[0].operationId,f.requests[1].operationId);
});
test('transaction sends its read version and returns callback result only after commit',async()=>{
 const f=fixture();const value=await f.api.runTransaction({},async tx=>{const ref={path:'usuarios/u/carteira/a'},s=await tx.get(ref);tx.update(ref,{saldo:s.data().saldo-5});return 'saved';});
 assert.equal(value,'saved');assert.deepEqual(f.requests[0].reads,[{path:'usuarios/u/carteira/a',data:{saldo:20}}]);assert.equal(f.requests[0].operations[0].data.saldo,15);
});
test('server quota rejection propagates and never falls back to direct Firestore write',async()=>{
 const f=fixture();f.ctx.fetch=async()=>({ok:false,json:async()=>({code:'PLAN_LIMIT',error:'Limite atingido'})});
 const b=f.api.writeBatch({});b.set({path:'usuarios/u/transacoes/t'},{valor:10});await assert.rejects(b.commit(),/Limite atingido/);
});
