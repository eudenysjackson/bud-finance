const { test } = require('node:test'), assert = require('node:assert/strict');
const { privateHeaders, safeError, revokeSessions } = require('../backend/security-controls');
const { createSecurityGuard } = require('../backend/security-guard');
const res = () => ({ statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;} });
test('API responses are not cacheable and failures cannot echo secrets or stack traces', () => {
  const r=res();privateHeaders({},r,()=>{});assert.match(r.headers['Cache-Control'],/no-store/);assert.equal(r.headers['X-Frame-Options'],'DENY');
  safeError(Object.assign(Error('secret-token'),{body:'private data'}),{},r,()=>{});assert.equal(r.statusCode,500);assert(!JSON.stringify(r.body).includes('secret'));
  const big=res();safeError({type:'entity.too.large'}, {},big,()=>{});assert.equal(big.statusCode,413);
});
test('security middleware fails closed if authentication infrastructure is unavailable',async()=>{
  const r=res();await createSecurityGuard({})({path:'/api/financial/write'},r,()=>assert.fail());assert.equal(r.statusCode,503);
});
test('session revocation requires recent login and atomically disables push before revoking tokens',async()=>{
  const calls=[],ref=name=>({name}),db={collection:name=>({doc:uid=>ref(name+'/'+uid)}),batch:()=>({set:(r,v)=>calls.push([r.name,v]),update:(r,v)=>calls.push([r.name,v]),commit:async()=>calls.push('commit')})};
  const handler=revokeSessions({auth:{revokeRefreshTokens:async uid=>calls.push('revoke:'+uid)},db,now:()=>1000000});
  const old=res();await handler({budUser:{uid:'owner',auth_time:1},body:{confirmation:'ENCERRAR'}},old);assert.equal(old.statusCode,401);assert.equal(calls.length,0);
  const fresh=res();await handler({budUser:{uid:'owner',auth_time:990},body:{confirmation:'ENCERRAR',uid:'victim'}},fresh);
  assert.equal(fresh.statusCode,200);assert.equal(calls[0][0],'_session_revocations/owner');assert.equal(calls[1][1].pushConsentRevoked,true);assert.deepEqual(calls.slice(2),['commit','revoke:owner']);
});
