const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFirestoreJobStore}=require('../backend/ai-job-store');

test('job antigo com heartbeat ativo termina com falha e libera admissão',async()=>{
  const records=new Map([
    ['usuarios/u/_ai_jobs/j',{createdAt:0,expiresAt:10000,state:'running',owner:'old',leaseUntil:99999}],
    ['usuarios/u/_seguranca/ia-jobs',{active:{j:10000}}]
  ]);
  const ref=p=>({path:p,collection:n=>collection(p+'/'+n),get:async()=>({exists:records.has(p),data:()=>records.get(p),ref:ref(p)})});
  const collection=p=>({doc:id=>ref(p+'/'+id)});
  const db={collection,runTransaction:async fn=>fn({get:r=>r.get(),update:(r,d)=>records.set(r.path,{...records.get(r.path),...d}),set:(r,d)=>records.set(r.path,d)})};
  const store=createFirestoreJobStore(db,{now:()=>1000,maxDurationMs:100});
  const data=await store.read('u','j');assert.equal(data.state,'failed');assert.equal(data.status,504);
  assert.equal((await store.result('u','j',data)).code,'AI_JOB_TIMEOUT');
  assert.deepEqual(records.get('usuarios/u/_seguranca/ia-jobs').active,{});
  assert.equal(await store.heartbeat('u','j','Aguardando...'),false);
});

