const {test}=require('node:test'),assert=require('node:assert/strict');
const {CATALOG,LEGACY,preparePriceChange,createPriceMigration,paidCycleBase}=require('../backend/subscription-pricing');
const {quoteProration}=require('../backend/subscription-upgrade');
const fs=require('node:fs'),vm=require('node:vm');
const now=Date.parse('2026-11-26T12:00:00Z'),next='2026-12-05T12:00:00Z';
test('server catalogue matches migration values and price state is protected from client writes',()=>{
  const server=fs.readFileSync('backend/server.js','utf8');
  const configured=vm.runInNewContext('('+server.match(/const MP_PLANS = (\{[\s\S]+?\n\});/)[1]+')');
  assert.deepEqual(JSON.parse(JSON.stringify(configured)),CATALOG);
  const rules=fs.readFileSync('firestore.rules','utf8').match(/function billingFields\(\) \{([\s\S]+?)\}/)[1];
  for(const field of ['planoPreco','cicloPrecoBase'])assert(rules.includes("'"+field+"'"));
});
function fixture(plan='plus'){
  let profile={plano:plan,email:'test@example.invalid',mpSubscriptionId:'sub',assinaturaStatus:'authorized'};
  const sub={external_reference:'u|'+plan,payer_email:profile.email,status:'authorized',next_payment_date:next,auto_recurring:{currency_id:'BRL',frequency:1,frequency_type:'months',transaction_amount:LEGACY[plan]}};
  const ref={get:async()=>({exists:true,data:()=>structuredClone(profile)}),update:async data=>Object.assign(profile,structuredClone(data))};
  const db={collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn({get:ref.get,update:(_,data)=>ref.update(data)})};
  const calls=[];
  const fetch=async(url,opts)=>{calls.push({url,...opts});if(opts.method==='PUT'){const body=JSON.parse(opts.body);Object.assign(sub.auto_recurring,body.auto_recurring);sub.reason=body.reason;}return{ok:true,json:async()=>structuredClone(sub)}};
  return {profile,sub,calls,migrate:createPriceMigration({db,fetch,token:'TEST-fixture',now:()=>now})};
}
test('new catalogue has the requested amounts; next renewal preserves plans and billing dates',async()=>{
  assert.deepEqual(Object.values(CATALOG).map(p=>p.amount),[4.99,14.99,29.99]);
  for(const key of ['starter','pro','plus']){
    const f=fixture(key),result=await f.migrate('u',{apply:true});
    assert.equal(result.status,'updated');assert.equal(f.sub.auto_recurring.transaction_amount,CATALOG[key].amount);
    assert.equal(f.sub.next_payment_date,next);assert.equal(f.profile.plano,key);
    assert.equal(f.profile.cicloPrecoBase,LEGACY[key]);assert.equal(f.profile.planoPreco.confirmed,true);
    assert(f.calls.every(c=>!c.method||c.method==='PUT'));assert(f.calls.every(c=>c.url.endsWith('/preapproval/sub')));
    assert.equal((await f.migrate('u',{apply:true})).reason,'already-current');
  }
});
test('dry-run never modifies profile/provider; foreign subscriptions and unknown prices are rejected',async()=>{
  const f=fixture(),before=structuredClone(f.profile);
  assert.equal((await f.migrate('u')).status,'ready');assert.deepEqual(f.profile,before);assert.equal(f.calls.filter(c=>c.method).length,0);
  f.sub.external_reference='other|plus';await assert.rejects(f.migrate('u',{apply:true}),/owner mismatch/);
  f.sub.external_reference='u|plus';f.sub.auto_recurring.transaction_amount=123;await assert.rejects(f.migrate('u',{apply:true}),/Unrecognized/);
});
test('scheduled downgrade and referral reward use the new target price once, without granting the plan early',async()=>{
  const f=fixture();f.profile.planoTroca={planKey:'pro',subscriptionId:'sub',status:'scheduled',effectiveAt:next,amount:14.95};
  f.profile.beneficioIndicacao50={status:'scheduled',subscriptionId:'sub',effectiveAt:next,baseAmount:29.90,discountAmount:14.95};f.sub.auto_recurring.transaction_amount=14.95;
  assert.equal((await f.migrate('u',{apply:true})).status,'updated');
  assert.equal(f.profile.plano,'plus');assert.equal(f.profile.planoTroca.planKey,'pro');assert.equal(f.profile.planoTroca.amount,7.50);
  assert.equal(f.profile.beneficioIndicacao50.baseAmount,14.99);assert.equal(f.profile.beneficioIndicacao50.discountAmount,7.50);
});
test('unfinished payments/upgrades and imminent renewals remain pending rather than being altered',()=>{
  const f=fixture();
  assert.equal(preparePriceChange('u',{...f.profile,planoUpgrade:{state:'pending',validUntil:next}},f.sub,now).skip,'upgrade-in-progress');
  assert.equal(preparePriceChange('u',f.profile,{...f.sub,next_payment_date:new Date(now+1000).toISOString()},now).skip,'billing-in-progress');
  assert.equal(preparePriceChange('u',{...f.profile,descontoIndicacaoPrimeiroMes:{status:'awaiting_payment'}},f.sub,now).skip,'first-payment-in-progress');
});
test('an uncertain provider update is reconciled on retry without a new payment',async()=>{
  const f=fixture();let failed=false;
  const original=f.sub.auto_recurring;
  Object.defineProperty(f.sub,'reason',{set(){if(!failed){failed=true;throw Error('timeout after provider accepted')}}});
  await assert.rejects(f.migrate('u',{apply:true}),/timeout/);assert.equal(f.profile.planoTrocaLock,null);
  assert.equal(original.transaction_amount,29.99);assert.equal((await f.migrate('u',{apply:true})).status,'updated');
});
test('upgrade credits the old paid cycle; new renewals replace the cycle base',()=>{
  const profile={plano:'starter',mpSubscriptionId:'sub',ultimaCobrancaAprovadaEm:'2026-11-20T12:00:00Z',cicloPrecoBase:9.99};
  const q=quoteProration(profile,{next_payment_date:'2026-12-20T12:00:00Z'},'pro',CATALOG,Date.parse('2026-12-05T12:00:00Z'));
  assert.equal(q.amount,2.50);assert.equal(q.monthlyAmount,14.99);
  assert.equal(paidCycleBase('starter',{transaction_amount:4.99},profile),4.99);
  assert.equal(paidCycleBase('starter',{transaction_amount:9.99},profile),9.99);
  assert.equal(paidCycleBase('pro',{transaction_amount:7.50,date_approved:next},{...profile,beneficioIndicacao50:{status:'scheduled',subscriptionId:'sub',effectiveAt:next}}),14.99);
});
