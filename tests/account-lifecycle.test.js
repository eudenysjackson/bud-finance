const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDeleteAccount } = require('../backend/account-lifecycle');
function setup({age = 0, subscription, emulator = false, fail = false} = {}) {
  const calls = [];
  const profile = { get: async () => ({ data: () => ({mpSubscriptionId:subscription}) }) };
  const db = { collection: () => ({ doc: uid => { assert.equal(uid,'owner'); return profile; } }), recursiveDelete:async () => { calls.push('data'); if(fail)throw Error('offline'); } };
  const auth = { deleteUser:async uid => { calls.push('auth:'+uid); } };
  const handler = createDeleteAccount({ authenticate:async()=>({uid:'owner',auth_time:1000-age}), auth, db, emulator, now:()=>1_000_000 });
  const response = { statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;} };
  return { handler, response, calls };
}
test('account deletion checks recent sign-in before touching data', async()=>{
  const s=setup({age:301});await s.handler({body:{confirmation:'EXCLUIR',uid:'other'}},s.response);
  assert.equal(s.response.statusCode,401);assert.deepEqual(s.calls,[]);
});
test('account deletion blocks subscriptions outside local simulation',async()=>{
  const s=setup({subscription:'real-subscription'});await s.handler({body:{confirmation:'EXCLUIR'}},s.response);
  assert.equal(s.response.statusCode,409);assert.deepEqual(s.calls,[]);
});
test('deletes nested data before Auth, ignoring a uid in the request',async()=>{
  const s=setup();await s.handler({body:{confirmation:'EXCLUIR',uid:'other'}},s.response);
  assert.equal(s.response.statusCode,200);assert.deepEqual(s.calls,['data','auth:owner']);
});
test('failed data cleanup keeps Auth for retry',async()=>{
  const s=setup({fail:true});await s.handler({body:{confirmation:'EXCLUIR'}},s.response);
  assert.equal(s.response.statusCode,500);assert.deepEqual(s.calls,['data']);
});
