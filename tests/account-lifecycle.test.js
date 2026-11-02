const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAccountLifecycle,TOKEN_DRAIN_MS}=require('../backend/account-lifecycle');
function fixture({age=0,subscription,fail=false}={}){
 let time=1_000_000,failNext=fail;const calls=[],state=new Map([['usuarios/owner',{mpSubscriptionId:subscription}]]);
 const snapshot=path=>({exists:state.has(path),data:()=>structuredClone(state.get(path))});
 const ref=path=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),update:async p=>state.set(path,{...state.get(path),...p}),delete:async()=>state.delete(path)});
 const empty={limit(){return this;},get:async()=>({empty:true,docs:[],size:0})};
 const db={collection:name=>({doc:id=>ref(name+'/'+id),where:()=>name==='_account_deletions'?{limit(){return this;},get:async()=>{const docs=[...state].filter(([p,d])=>p.startsWith(name+'/')&&d.nextRunAt<=time).map(([p])=>({...snapshot(p),ref:ref(p),id:p.split('/').at(-1)}));return{docs,size:docs.length,empty:!docs.length};}}:empty}),collectionGroup:()=>({where:()=>empty}),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>state.set(r.path,v),update:(r,v)=>r.update(v)}),recursiveDelete:async r=>{calls.push('erase:'+r.path);if(failNext){failNext=false;throw Error('offline');}for(const p of state.keys())if(p===r.path||p.startsWith(r.path+'/'))state.delete(p);}};
 const auth={updateUser:async uid=>calls.push('disable:'+uid),revokeRefreshTokens:async uid=>calls.push('revoke:'+uid),deleteUser:async uid=>calls.push('auth:'+uid)};
 const service=createAccountLifecycle({authenticate:async()=>({uid:'owner',auth_time:1000-age}),auth,db,fieldValue:{delete:()=>null},now:()=>time});
 const res=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(d){this.data=d;return this;}});
 return{service,state,calls,res,advance:n=>time+=n};
}
test('deletion requires recent login and confirmation before touching any data',async()=>{
 const f=fixture({age:301}),r=f.res();await f.service.handler({body:{confirmation:'EXCLUIR'}},r);assert.equal(r.statusCode,401);assert.equal(f.calls.length,0);
 const g=fixture(),s=g.res();await g.service.handler({body:{confirmation:'no'}},s);assert.equal(s.statusCode,400);assert.equal(g.calls.length,0);
});
test('active subscription prevents closing the account or disabling login',async()=>{const f=fixture({subscription:'real-subscription'}),r=f.res();await f.service.handler({body:{confirmation:'EXCLUIR'}},r);assert.equal(r.statusCode,409);assert.equal(f.calls.length,0);assert(!f.state.has('_account_deletions/owner'));});
test('deletion locks the authenticated owner and removes content before Auth',async()=>{
 const f=fixture(),r=f.res();f.state.set('usuarios/owner/metas/m/depositos/d',{valor:1});await f.service.handler({body:{confirmation:'EXCLUIR',uid:'other'}},r);assert.equal(r.statusCode,200);assert(!f.state.has('usuarios/owner'));assert(!f.state.has('usuarios/owner/metas/m/depositos/d'));assert.equal(f.calls[0],'disable:owner');assert(f.calls.indexOf('erase:usuarios/owner')<f.calls.indexOf('auth:owner'));const lock=f.state.get('_account_deletions/owner');assert.equal(lock.status,'draining');assert.deepEqual(Object.keys(lock).sort(),['expiresAt','leaseUntil','nextRunAt','requestedAt','settleAt','status']);
});
test('cleanup failure remains durably queued and resumes without requiring disabled user login',async()=>{const f=fixture({fail:true}),r=f.res();await f.service.handler({body:{confirmation:'EXCLUIR'}},r);assert.equal(r.statusCode,202);assert.equal(f.state.get('_account_deletions/owner').status,'pending');f.advance(60_001);assert.equal((await f.service.resume()).failures,0);assert(!f.state.has('usuarios/owner'));assert(f.calls.includes('auth:owner'));});
test('temporary security reference is removed after token window and a final sweep',async()=>{const f=fixture(),r=f.res();await f.service.handler({body:{confirmation:'EXCLUIR'}},r);f.advance(TOKEN_DRAIN_MS+1);await f.service.resume();assert(!f.state.has('_account_deletions/owner'));});

