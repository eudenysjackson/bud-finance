const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('backend/server.js','utf8');
const code=source.slice(source.indexOf("app.post('/mercadopago/create-subscription'"),source.indexOf("app.post('/api/push/token'"));
function setup({providerError=false,lookupError=false}={}){
 const routes=new Map(),calls=[];
 const profile={email:'qa@example.test',nome:'Pessoa teste',plano:'free'};
 const sub={external_reference:'owner|starter',payer_email:'qa@example.test',status:'authorized'};
 const payment={status:'rejected',preapproval_id:'sub-1'};
 const invoice={preapproval_id:'sub-1',payment:{id:1234,status:'approved'}};
 const update=async data=>{for(const [key,value] of Object.entries(data)){if(value==='__delete')delete profile[key];else profile[key]=value;}};
 const ref={get:async()=>({exists:true,data:()=>({...profile})}),update,set:update};
 let transactionTail=Promise.resolve();
 const db={collection:()=>({doc:uid=>{assert.equal(uid,'owner');return ref;}}),runTransaction(fn){const work=transactionTail.then(()=>fn({get:r=>r.get(),update:(_,data)=>update(data)}));transactionTail=work.catch(()=>{});return work;}};
 const context={createSubscriptionChange:require('../backend/subscription-change').createSubscriptionChange,crypto,Buffer,AbortSignal,app:{post:(route,...handlers)=>routes.set(route,handlers.at(-1))},express:{json:()=>()=>{}},
  auth:{verifyIdToken:async token=>{assert.equal(token,'test-token');return{uid:'owner',email:'qa@example.test'};}},db,
  MP_ACCESS_TOKEN:'TEST-fake-token',MP_WEBHOOK_SECRET:'test-secret',MP_WEBHOOK_URL:'https://backend.test/webhook/mercadopago',MP_INDICACAO_DESCONTO:.1,
  MP_PLANS:{starter:{title:'Bud Finance Starter',amount:9.99},pro:{amount:29.90},plus:{amount:49.90}},FRONTEND_URL:'https://budsolucoes.com.br/appbudfinance',
  admin:{firestore:{FieldValue:{delete:()=>'__delete',serverTimestamp:()=>1},Timestamp:{fromDate:date=>date.toISOString()}}},
  process:{env:{BUD_USE_EMULATOR:'true'}},require:name=>{assert.equal(name,'crypto');return crypto;},console:{log(){},warn(){},error(){}},
  fetch:async(url,options={})=>{calls.push({url,options});if(options.method==='POST')return{ok:!providerError,json:async()=>providerError?{message:'Provider unavailable'}:{id:'sub-1',init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub-1'}};if(options.method==='PUT'){if(!providerError)Object.assign(sub,JSON.parse(options.body));return{ok:!providerError,json:async()=>sub};}return{ok:!lookupError,status:lookupError?503:200,json:async()=>url.includes('/authorized_payments/')?invoice:url.includes('/v1/payments/')?payment:sub};}};
 vm.runInNewContext(code,context);
 async function invoke(route,body={},headers={authorization:'Bearer test-token'},query={}){
  const response={statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;},sendStatus(n){this.statusCode=n;return this;}};
  await routes.get(route)({body,headers,query},response);return response;
 }
 async function webhook(type='subscription_preapproval',valid=true){
  const id='sub-1',requestId='request-1',ts='1710000000';
  const signature=crypto.createHmac('sha256','test-secret').update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  return invoke('/webhook/mercadopago',{type,data:{id}},{'x-request-id':requestId,'x-signature':`ts=${ts},v1=${valid?signature:'invalid'}`});
 }
 return{profile,sub,payment,invoice,calls,invoke,webhook};
}
test('checkout requires authentication and uses server price and identity',async()=>{
 const s=setup();assert.equal((await s.invoke('/mercadopago/create-subscription',{},{})).statusCode,401);assert.equal(s.calls.length,0);
 const result=await s.invoke('/mercadopago/create-subscription',{planKey:'starter',uid:'other',amount:0,email:'other@example.test'});
 assert.equal(result.statusCode,200);assert.match(result.data.init_point,/mercadopago/);
 const payload=JSON.parse(s.calls[0].options.body);assert.equal(payload.external_reference,'owner|starter');assert.equal(payload.payer_email,'qa@example.test');assert.equal(payload.auto_recurring.transaction_amount,9.99);assert.equal(payload.status,'pending');assert.equal(s.profile.plano,'free');
 assert.equal(payload.auto_recurring.frequency,1);assert.equal(payload.auto_recurring.frequency_type,'months');assert.equal(payload.auto_recurring.currency_id,'BRL');assert.equal(payload.auto_recurring.end_date,undefined);
});
test('provider failure returns an error without granting a paid plan',async()=>{
 const s=setup({providerError:true});const result=await s.invoke('/mercadopago/create-subscription',{planKey:'starter'});
 assert.equal(result.statusCode,502);assert.equal(s.profile.plano,'free');
});

test('an existing authorized subscription cannot create a second checkout',async()=>{
 const s=setup();s.profile.plano='starter';s.profile.mpSubscriptionId='sub-1';s.profile.assinaturaStatus='authorized';
 const result=await s.invoke('/mercadopago/create-subscription',{planKey:'pro'});
 assert.equal(result.statusCode,409);assert.equal(s.calls.filter(c=>c.options.method==='POST').length,0);assert.equal(s.profile.plano,'starter');
});

test('each paid plan uses its own server price and leaves access unchanged until approval',async()=>{
 for(const [planKey,amount] of [['starter',9.99],['pro',29.90],['plus',49.90]]){
  const s=setup();assert.equal((await s.invoke('/mercadopago/create-subscription',{planKey,amount:0})).statusCode,200);
  const payload=JSON.parse(s.calls.find(c=>c.options.method==='POST').options.body);
  assert.equal(payload.auto_recurring.transaction_amount,amount);assert.equal(payload.external_reference,'owner|'+planKey);assert.equal(s.profile.plano,'free');
 }
});

test('concurrent checkout requests create only one subscription and pending retry reuses its link',async()=>{
 const s=setup();const results=await Promise.all([s.invoke('/mercadopago/create-subscription',{planKey:'starter'}),s.invoke('/mercadopago/create-subscription',{planKey:'starter'})]);
 assert.equal(results.filter(r=>r.statusCode===200).length,1);assert.equal(s.calls.filter(c=>c.options.method==='POST').length,1);
 const retry=await s.invoke('/mercadopago/create-subscription',{planKey:'starter'});assert.equal(retry.statusCode,200);assert.equal(retry.data.init_point,results.find(r=>r.statusCode===200).data.init_point);
 assert.equal((await s.invoke('/mercadopago/create-subscription',{planKey:'pro'})).statusCode,409);assert.equal(s.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(s.profile.plano,'free');
});

test('an unknown creation result blocks a second provider request until reconciliation',async()=>{
 const s=setup({providerError:true});assert.equal((await s.invoke('/mercadopago/create-subscription',{planKey:'starter'})).statusCode,502);
 assert.equal((await s.invoke('/mercadopago/create-subscription',{planKey:'starter'})).statusCode,409);assert.equal(s.calls.filter(c=>c.options.method==='POST').length,1);
});

test('a pending checkout can be canceled while access is still free, allowing a different plan',async()=>{
 const s=setup();await s.invoke('/mercadopago/create-subscription',{planKey:'starter'});assert.equal(s.profile.plano,'free');
 assert.equal((await s.invoke('/mercadopago/cancelar-assinatura')).statusCode,200);assert.equal(s.profile.mpCheckout,undefined);
 assert.equal((await s.invoke('/mercadopago/create-subscription',{planKey:'pro'})).statusCode,200);
});
test('invalid webhook cannot activate a plan',async()=>{
 const s=setup();assert.equal((await s.webhook('subscription_preapproval',false)).statusCode,401);assert.equal(s.calls.length,0);assert.equal(s.profile.plano,'free');
});

test('late cancellation from an older subscription preserves the current paid plan',async()=>{
 const s=setup();Object.assign(s.profile,{plano:'pro',mpSubscriptionId:'current-sub',assinaturaStatus:'authorized'});s.sub.status='cancelled';
 assert.equal((await s.webhook()).statusCode,200);assert.equal(s.profile.plano,'pro');assert.equal(s.profile.mpSubscriptionId,'current-sub');assert.equal(s.profile.assinaturaStatus,'authorized');
});
test('old subscription events preserve a newer pending checkout',async()=>{
 const s=setup();Object.assign(s.profile,{mpSubscriptionId:'new-sub',assinaturaStatus:'pending',mpCheckout:{state:'pending',subscriptionId:'new-sub',planKey:'pro'}});s.sub.status='cancelled';
 assert.equal((await s.webhook()).statusCode,200);assert.equal(s.profile.mpCheckout.subscriptionId,'new-sub');assert.equal(s.profile.mpSubscriptionId,'new-sub');assert.equal(s.profile.assinaturaStatus,'pending');
});
test('old rejected payment cannot flag the current subscription as past due',async()=>{
 const s=setup();Object.assign(s.profile,{plano:'pro',mpSubscriptionId:'current-sub',assinaturaStatus:'authorized',pagamentoPendente:false});
 assert.equal((await s.webhook('payment')).statusCode,200);assert.equal(s.profile.pagamentoPendente,false);assert.equal(s.profile.assinaturaStatus,'authorized');assert.equal(s.profile.mpSubscriptionId,'current-sub');
});

test('automatic checkout payment links its subscription through provider transaction_data',async()=>{
 const s=setup();delete s.payment.preapproval_id;s.payment.status='approved';s.payment.point_of_interaction={transaction_data:{subscription_id:'sub-1'}};
 assert.equal((await s.webhook('payment')).statusCode,200);assert.equal(s.profile.plano,'starter');assert.equal(s.profile.mpSubscriptionId,'sub-1');assert.equal(s.profile.assinaturaStatus,'authorized');
});
test('rejected checkout payment links through provider transaction_data',async()=>{
 const s=setup();delete s.payment.preapproval_id;s.payment.point_of_interaction={transaction_data:{subscription_id:'sub-1'}};
 assert.equal((await s.webhook('payment')).statusCode,200);assert.equal(s.profile.pagamentoPendente,true);assert.equal(s.profile.assinaturaStatus,'past_due');
});
test('conflicting provider subscription links are retryable and never activate a plan',async()=>{
 const s=setup();s.payment.status='approved';s.payment.point_of_interaction={transaction_data:{subscription_id:'another-sub'}};
 assert.equal((await s.webhook('payment')).statusCode,503);assert.equal(s.profile.plano,'free');assert.equal(s.profile.mpSubscriptionId,undefined);
});
test('event racing an unbound checkout is retryable without clearing its reservation',async()=>{
 const s=setup();s.profile.mpCheckout={state:'creating',nonce:'new-checkout'};s.sub.status='cancelled';
 assert.equal((await s.webhook()).statusCode,503);assert.equal(s.profile.mpCheckout.nonce,'new-checkout');assert.equal(s.profile.mpSubscriptionId,undefined);
});
test('signed approval activates the correct plan and clears an earlier payment failure',async()=>{
 const s=setup();s.profile.pagamentoPendente=true;await s.webhook();
 assert.equal(s.profile.plano,'starter');assert.equal(s.profile.mpSubscriptionId,'sub-1');assert.equal(s.profile.pagamentoPendente,false);assert.equal(s.profile.assinaturaStatus,'authorized');assert.ok(s.profile.planoExpira);
});
test('rejection remains pending; cancellation downgrades the plan',async()=>{
 const s=setup();await s.webhook('payment');assert.equal(s.profile.plano,'free');assert.equal(s.profile.pagamentoPendente,true);assert.equal(s.profile.assinaturaStatus,'past_due');
 s.sub.status='cancelled';await s.webhook();assert.equal(s.profile.plano,'free');assert.equal(s.profile.assinaturaStatus,'cancelled');
});
test('local approval and cancellation never call the payment provider',async()=>{
 const s=setup();await s.invoke('/mercadopago/local-test-payment',{planKey:'pro',status:'approved'});assert.equal(s.profile.plano,'pro');
 assert.equal((await s.invoke('/mercadopago/cancelar-assinatura')).statusCode,200);assert.equal(s.profile.plano,'free');assert.equal(s.profile.mpSubscriptionId,undefined);assert.equal(s.calls.length,0);
});

test('recurring invoice approval resolves its subscription even if payment lacks preapproval_id',async()=>{
 const s=setup();delete s.payment.preapproval_id;s.payment.status='approved';
 assert.equal((await s.webhook('subscription_authorized_payment')).statusCode,200);
 assert.ok(s.calls.some(call=>call.url.includes('/authorized_payments/')));assert.equal(s.profile.plano,'starter');assert.equal(s.profile.pagamentoPendente,false);
});
test('recurring invoice rejection marks the subscription as past due',async()=>{
 const s=setup();delete s.payment.preapproval_id;
 await s.webhook('subscription_authorized_payment');assert.equal(s.profile.pagamentoPendente,true);assert.equal(s.profile.assinaturaStatus,'past_due');assert.equal(s.profile.plano,'free');
});
test('provider lookup failure returns a retryable webhook response without activating a plan',async()=>{
 const s=setup({lookupError:true});assert.equal((await s.webhook()).statusCode,503);assert.equal(s.profile.plano,'free');
});
test('query id and body id must identify the same signed resource',async()=>{
 const s=setup();const signature=crypto.createHmac('sha256','test-secret').update('id:signed-id;request-id:r;ts:1;').digest('hex');
 assert.equal((await s.invoke('/webhook/mercadopago',{type:'subscription_preapproval',data:{id:'changed-id'}},{'x-request-id':'r','x-signature':'ts=1,v1='+signature},{'data.id':'signed-id'})).statusCode,401);
 assert.equal(s.calls.length,0);
});

test('billing expiry follows the date reported by Mercado Pago',async()=>{
 const s=setup();s.sub.next_payment_date='2027-01-28T12:00:00Z';await s.webhook();assert.equal(s.profile.planoExpira,'2027-01-28T12:00:00.000Z');
});
test('duplicate subscription notifications preserve the existing billing period',async()=>{
 const s=setup();s.profile.mpSubscriptionId='sub-1';s.profile.planoExpira='2027-02-01T12:00:00.000Z';await s.webhook();assert.equal(s.profile.planoExpira,'2027-02-01T12:00:00.000Z');
});

function activeSubscription(s,plan='starter'){
 s.profile.plano=plan;s.profile.mpSubscriptionId='sub-1';s.profile.assinaturaStatus='authorized';
 s.sub.next_payment_date=new Date(Date.now()+30*86400000).toISOString();s.profile.planoExpira=s.sub.next_payment_date;
 s.sub.auto_recurring={transaction_amount:plan==='plus'?49.9:plan==='pro'?29.9:9.99,currency_id:'BRL'};
}

test('successive monthly renewals extend the same subscription without another checkout',async()=>{
 const s=setup();activeSubscription(s);s.payment.status='approved';s.payment.transaction_amount=9.99;
 for(const nextDate of ['2027-01-01T15:00:00.000Z','2027-02-01T15:00:00.000Z','2027-03-01T15:00:00.000Z']){
  s.sub.next_payment_date=nextDate;
  assert.equal((await s.webhook('subscription_authorized_payment')).statusCode,200);
  assert.equal(s.profile.plano,'starter');assert.equal(s.profile.mpSubscriptionId,'sub-1');assert.equal(s.profile.planoExpira,nextDate);
  await s.webhook('subscription_authorized_payment');assert.equal(s.profile.planoExpira,nextDate);
 }
 assert.equal(s.calls.filter(c=>['POST','PUT'].includes(c.options.method)).length,0);
});

test('failed renewal does not extend access and later approval restores the same subscription',async()=>{
 const s=setup();activeSubscription(s);const originalExpiry=s.profile.planoExpira;
 assert.equal((await s.webhook('subscription_authorized_payment')).statusCode,200);
 assert.equal(s.profile.pagamentoPendente,true);assert.equal(s.profile.assinaturaStatus,'past_due');assert.equal(s.profile.planoExpira,originalExpiry);
 s.payment.status='approved';s.payment.transaction_amount=9.99;s.sub.next_payment_date='2027-03-01T15:00:00.000Z';
 assert.equal((await s.webhook('subscription_authorized_payment')).statusCode,200);
 assert.equal(s.profile.pagamentoPendente,false);assert.equal(s.profile.assinaturaStatus,'authorized');assert.equal(s.profile.planoExpira,s.sub.next_payment_date);assert.equal(s.profile.mpSubscriptionId,'sub-1');
 assert.equal(s.calls.filter(c=>['POST','PUT'].includes(c.options.method)).length,0);
});

test('plan upgrade updates the same subscription at server price while retaining current access',async()=>{
 const s=setup();activeSubscription(s);const expiry=s.profile.planoExpira;
 const result=await s.invoke('/mercadopago/change-subscription',{planKey:'pro',amount:0,uid:'other'});
 assert.equal(result.statusCode,200);assert.equal(result.data.scheduled,true);assert.equal(s.profile.plano,'starter');assert.equal(s.profile.planoExpira,expiry);
 assert.equal(s.profile.mpSubscriptionId,'sub-1');assert.equal(s.profile.planoTroca.planKey,'pro');assert.equal(s.profile.planoTroca.status,'scheduled');
 assert.equal(s.calls.filter(c=>c.options.method==='POST').length,0);
 const change=s.calls.find(c=>c.options.method==='PUT');assert.ok(change.url.endsWith('/sub-1'));assert.equal(JSON.parse(change.options.body).auto_recurring.transaction_amount,29.9);
});

test('downgrade preserves Plus until the next approved charge and can be withdrawn',async()=>{
 const s=setup();activeSubscription(s,'plus');
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'starter'})).statusCode,200);assert.equal(s.profile.plano,'plus');assert.equal(s.profile.planoTroca.amount,9.99);
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'plus'})).data.scheduled,false);assert.equal(s.sub.auto_recurring.transaction_amount,49.9);assert.equal(s.profile.planoTroca,null);
});

test('status events and replayed old payments cannot activate a scheduled plan early',async()=>{
 const s=setup();activeSubscription(s);await s.invoke('/mercadopago/change-subscription',{planKey:'pro'});
 await s.webhook();assert.equal(s.profile.plano,'starter');
 s.payment.status='approved';s.payment.transaction_amount=29.9;s.payment.date_approved=new Date().toISOString();
 await s.webhook('payment');assert.equal(s.profile.plano,'starter');assert.equal(s.profile.planoTroca.planKey,'pro');
 s.payment.date_approved=new Date(Date.now()+31*86400000).toISOString();s.payment.transaction_amount=9.99;
 await s.webhook('payment');assert.equal(s.profile.plano,'starter');
 s.payment.transaction_amount=29.9;await s.webhook('payment');assert.equal(s.profile.plano,'pro');assert.equal(s.profile.planoTroca,undefined);
 await s.webhook();assert.equal(s.profile.plano,'pro');
});

test('failed scheduled-plan update retains current plan and recoverable intent',async()=>{
 const s=setup({providerError:true});activeSubscription(s);
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'pro'})).statusCode,503);
 assert.equal(s.profile.plano,'starter');assert.equal(s.profile.planoTroca.status,'confirming');assert.equal(s.profile.planoTrocaLock,null);
});

test('plan change rejects another owner, a processing charge and concurrent changes',async()=>{
 const s=setup();activeSubscription(s);s.sub.external_reference='other|starter';
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'pro'})).statusCode,403);
 s.sub.external_reference='owner|starter';s.sub.next_payment_date=new Date(Date.now()-1000).toISOString();
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'pro'})).statusCode,409);
 s.profile.planoTrocaLock={id:'another',until:Date.now()+60000};
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'pro'})).statusCode,409);
 assert.equal(s.calls.filter(c=>c.options.method==='PUT').length,0);
});

test('local plan scheduling uses only emulators and never calls the provider',async()=>{
 const s=setup();activeSubscription(s);s.profile.mpSubscriptionId='LOCAL_TEST_1';
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'plus'})).statusCode,200);
 assert.equal(s.profile.plano,'starter');assert.equal(s.profile.planoTroca.planKey,'plus');assert.equal(s.calls.length,0);
});

test('provider may omit payer email when subscription binding and payer ID identify the owner',async()=>{
 const s=setup();activeSubscription(s);delete s.sub.payer_email;s.sub.payer_id=123;s.profile.mpPayerId='123';
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'pro'})).statusCode,200);
 s.sub.payer_id=456;
 assert.equal((await s.invoke('/mercadopago/change-subscription',{planKey:'plus'})).statusCode,403);
});
