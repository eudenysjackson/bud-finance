const { test } = require('node:test'), assert = require('node:assert/strict');
const { createOwnerNotifications, cancellationEvent } = require('../backend/owner-notifications');
function fixture() {
  let clock = 10000000; const store = new Map(), sent = []; let tail = Promise.resolve(), fail = false;
  const ref = path => ({ path, id: path.split('/').at(-1), collection: name => collection(path + '/' + name), get: async () => ({ exists: store.has(path), data: () => structuredClone(store.get(path)) }) });
  const collection = path => ({ doc: id => ref(path + '/' + id) });
  const db = { collection, runTransaction(fn) { const pending = tail.then(() => fn({ get: r => r.get(), set: (r,v) => store.set(r.path,v), update: (r,v) => store.set(r.path,{ ...store.get(r.path), ...v }) })); tail = pending.catch(()=>{}); return pending; } };
  store.set('admins/owner', {role:'admin'}); store.set('_gestor_devices/owner', { tokens: {phone:{token:'owner-phone'},pc:{token:'owner-pc'}} });
  const service = createOwnerNotifications({ db, auth: { getUser: async () => ({ emailVerified: true }) }, ownerUid: 'owner', frontendUrl: 'https://example.invalid/app', now: () => clock,
    messaging: () => ({ sendEachForMulticast: async message => { sent.push(message); return { responses: message.tokens.map(t => fail && t === 'owner-pc' ? { success:false, error:{code:'unavailable'} } : {success:true}) }; } }) });
  async function queue(type = 'subscribed', id = 'subscription-1') { let r; await db.runTransaction(async tx => {const e=await service.prepare(tx,'customer',type,id,'pro');service.commit(tx,e);r=e?.ref;});return r; }
  return { store, sent, service, queue, advance:()=>clock+=200000, failing:v=>fail=v };
}
test('owner events deduplicate concurrent webhook repeats and never notify customers', async () => {
  const f=fixture(), refs=await Promise.all([f.queue(),f.queue()]);assert.equal(refs.filter(Boolean).length,1);
  await Promise.all([f.service.deliver(refs[0]),f.service.deliver(refs[0])]);
  assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0].tokens,['owner-phone','owner-pc']);
  assert(!JSON.stringify(f.sent[0].data).includes('customer'));assert.match(f.sent[0].data.body,/Pro/);
});
test('no Gestor devices or removed admin role prevents owner delivery', async () => {
  for (const kind of ['role','consent']) {const f=fixture(),r=await f.queue();if(kind==='role')f.store.delete('admins/owner');else f.store.set('_gestor_devices/owner',{tokens:{}});await f.service.deliver(r);assert.equal(f.sent.length,0);assert.equal(f.store.get(r.path).state,'pending');}
});
test('partial delivery retries only the device that failed, surviving new worker attempts', async () => {
  const f=fixture(),r=await f.queue();f.failing(true);await f.service.deliver(r);f.advance();f.failing(false);await f.service.deliver(r);
  assert.deepEqual(f.sent[1].tokens,['owner-pc']);assert.equal(f.store.get(r.path).state,'sent');
});
test('pending abandonment, paused plans and repeated cancellations are not cancellation events', () => {
  const profile={plano:'pro',assinaturaStatus:'authorized'};
  assert(cancellationEvent(profile,'cancelled'));
  assert(!cancellationEvent({...profile,assinaturaStatus:'pending',mpCheckout:{state:'pending'}},'cancelled'));
  assert(!cancellationEvent({...profile,assinaturaStatus:'cancelled'},'cancelled'));
  assert(!cancellationEvent(profile,'paused'));
});
test('configured owner email resolves through Auth and never trusts a customer profile email', async () => {
  const f=fixture(), sent=[];
  // Shared fixture still supplies the transaction store; deliver via email resolution.
  const ref=await f.queue();
  const db={collection:name=>({doc:id=>({get:async()=>({exists:f.store.has(name+'/'+id),data:()=>f.store.get(name+'/'+id)})})}),runTransaction:async fn=>fn({get:async r=>({exists:f.store.has(r.path),data:()=>f.store.get(r.path)}),update:(r,v)=>f.store.set(r.path,{...f.store.get(r.path),...v})})};
  const service=createOwnerNotifications({db,ownerEmail:'support@example.invalid',auth:{getUserByEmail:async email=>{assert.equal(email,'support@example.invalid');return{uid:'owner',emailVerified:true};}},frontendUrl:'https://example.invalid',now:()=>10000000,messaging:()=>({sendEachForMulticast:async message=>{sent.push(message);return{responses:message.tokens.map(()=>({success:true}))};}})});
  await service.deliver(ref);assert.equal(sent.length,1);assert.deepEqual(sent[0].tokens,['owner-phone','owner-pc']);
});
