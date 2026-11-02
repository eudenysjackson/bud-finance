const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createSubscriptionUpgrade,quoteProration}=require('../backend/subscription-upgrade');
const plans={starter:{amount:9.99,title:'Starter'},pro:{amount:29.9,title:'Pro'},plus:{amount:49.9,title:'Plus'}};
function setup(){
 let time=Date.parse('2026-11-16T00:00:00Z'),seq=0,failCreate=false,failUpdate=false;
 const state=new Map([['usuarios/u',{email:'u@example.invalid',plano:'starter',mpSubscriptionId:'sub',assinaturaStatus:'authorized',ultimaCobrancaAprovadaEm:'2026-11-01T00:00:00Z',planoExpira:'2026-12-01T00:00:00Z'}]]),calls=[],preferences=new Map();
 const sub={status:'authorized',external_reference:'u|starter',payer_email:'u@example.invalid',payer_id:'buyer',next_payment_date:'2026-12-01T00:00:00Z',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:9.99}};
 const ref=path=>({path,get:async()=>({exists:state.has(path),data:()=>structuredClone(state.get(path))}),update:async v=>state.set(path,{...state.get(path),...v}),set:async(v,o)=>state.set(path,o?.merge?{...state.get(path),...v}:v),collection:n=>({doc:id=>ref(path+'/'+n+'/'+id)})});
 let tail=Promise.resolve();const db={collection:n=>({doc:id=>ref(n+'/'+id)}),runTransaction(fn){const work=tail.then(async()=>{const writes=[];const result=await fn({get:r=>r.get(),set:(r,v)=>writes.push(()=>r.set(v)),update:(r,v)=>writes.push(()=>r.update(v))});for(const w of writes)await w();return result;});tail=work.catch(()=>{});return work;}};
 const fake=async(url,options={})=>{const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;calls.push({path,method:options.method||'GET',body,headers:options.headers});let data={};
  if(path==='/preapproval/sub'&&options.method==='PUT'){if(failUpdate){failUpdate=false;return{ok:false,status:503,json:async()=>({})};}Object.assign(sub.auto_recurring,body.auto_recurring);data=sub;}
  else if(path==='/preapproval/sub')data=sub;
  else if(path==='/checkout/preferences'&&options.method==='POST'){data={...body,id:'pref'+(++seq),init_point:'https://www.mercadopago.com.br/checkout/'+seq};preferences.set(data.id,structuredClone(data));if(failCreate){failCreate=false;throw Error('uncertain-response');}}
  else if(path==='/checkout/preferences/search')data={elements:[...preferences.values()]};
  else if(path.startsWith('/checkout/preferences/')){data=preferences.get(path.split('/').at(-1));if(options.method==='PUT')Object.assign(data,body);}
  else if(path.endsWith('/refunds'))data={id:'refund',status:'approved'};
  else if(path==='/authorized_payments/search')data={results:[]};
  else throw Error('Unexpected provider endpoint '+path);
  return{ok:true,status:200,json:async()=>structuredClone(data)};
 };
 const service=createSubscriptionUpgrade({auth:{verifyIdToken:async()=>({uid:'u',email:'u@example.invalid'})},db,token:'TEST-fictitious',plans,frontend:'https://example.invalid/app',webhook:'https://example.invalid/webhook',fieldValue:{serverTimestamp:()=>time},now:()=>time,fetch:fake});
 const invoke=async body=>{const r={statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};await service.handler({body,headers:{authorization:'Bearer fictitious'}},r);return r;};
 const payment=q=>({id:'pay1',status:'approved',transaction_amount:q.amount,currency_id:'BRL',date_approved:new Date(time).toISOString(),payer:{id:'buyer'},external_reference:'bud-upgrade|u|'+q.quoteId});
 return{service,invoke,payment,state,calls,sub,profile:()=>state.get('usuarios/u'),advance:n=>time+=n,failCreate:()=>failCreate=true,failUpdate:()=>failUpdate=true};
}
test('proration uses actual cycle dates, cents, first-month discount and remaining period',()=>{
 const profile={plano:'starter',mpSubscriptionId:'sub',ultimaCobrancaAprovadaEm:'2026-11-01T00:00:00Z'},sub={next_payment_date:'2026-12-01T00:00:00Z'},time=Date.parse('2026-11-16T00:00:00Z');
 assert.equal(quoteProration(profile,sub,'pro',plans,time).amount,9.96);
 profile.descontoIndicacaoPrimeiroMes={status:'used',subscriptionId:'sub',usadoEm:'2026-11-01T00:00:01Z'};assert.equal(quoteProration(profile,sub,'pro',plans,time).amount,8.46);
 const leap={...profile,ultimaCobrancaAprovadaEm:'2028-02-01T00:00:00Z',descontoIndicacaoPrimeiroMes:null};assert.equal(quoteProration(leap,{next_payment_date:'2028-03-01T00:00:00Z'},'pro',plans,Date.parse('2028-02-15T12:00:00Z')).amount,9.96);
 assert.throws(()=>quoteProration(profile,sub,'pro',plans,Date.parse('2026-12-01T00:00:00Z')));
});
test('quote and checkout do not grant access, alter renewal or create another subscription',async()=>{
 const s=setup(),q=await s.invoke({action:'quote',planKey:'pro',amount:0,uid:'another'});assert.equal(q.statusCode,200);assert.equal(q.data.amount,9.96);assert.equal(s.profile().plano,'starter');
 const result=await s.invoke({action:'checkout',quoteId:q.data.quoteId});assert.equal(result.statusCode,200);assert.match(result.data.init_point,/mercadopago/);assert.equal(s.profile().plano,'starter');assert.equal(s.sub.auto_recurring.transaction_amount,9.99);assert.equal(s.calls.filter(c=>c.path==='/preapproval'&&c.method==='POST').length,0);
 const created=s.calls.find(c=>c.path==='/checkout/preferences'&&c.method==='POST');assert.equal(created.body.items[0].unit_price,9.96);assert.equal(created.body.items[0].quantity,1);
});
test('approved payment applies upgrade on the same subscription and preserves renewal date; replay is idempotent',async()=>{
 const s=setup(),q=(await s.invoke({planKey:'pro'})).data;await s.invoke({action:'checkout',quoteId:q.quoteId});const pay=s.payment(q);await s.service.processPayment(pay);assert.equal(s.profile().plano,'pro');assert.equal(s.profile().mpSubscriptionId,'sub');assert.equal(s.profile().planoExpira,'2026-12-01T00:00:00Z');assert.equal(s.sub.auto_recurring.transaction_amount,29.9);
 const updates=s.calls.filter(c=>c.path==='/preapproval/sub'&&c.method==='PUT').length;await s.service.processPayment(pay);assert.equal(s.calls.filter(c=>c.path==='/preapproval/sub'&&c.method==='PUT').length,updates);
});
test('rejected or pending payment never changes plan; duplicate approved payment is refunded once',async()=>{
 const s=setup(),q=(await s.invoke({planKey:'pro'})).data;await s.service.processPayment({...s.payment(q),status:'rejected'});assert.equal(s.profile().plano,'starter');await s.service.processPayment(s.payment(q));const duplicate={...s.payment(q),id:'pay2'};await s.service.processPayment(duplicate);await s.service.processPayment(duplicate);assert.equal(s.calls.filter(c=>c.path.endsWith('/pay2/refunds')).length,1);assert.equal(s.profile().plano,'pro');
});
test('uncertain preference creation is reconciled rather than generating another checkout',async()=>{
 const s=setup(),q=(await s.invoke({planKey:'pro'})).data;s.failCreate();assert.equal((await s.invoke({action:'checkout',quoteId:q.quoteId})).statusCode,503);assert.equal((await s.invoke({action:'checkout',quoteId:q.quoteId})).statusCode,200);assert.equal(s.calls.filter(c=>c.path==='/checkout/preferences'&&c.method==='POST').length,1);
});
test('wrong amount, expired quote and changed cycle refund without granting or double refunding',async()=>{
 for(const reason of ['amount','expiry','cycle']){const s=setup(),q=(await s.invoke({planKey:'pro'})).data;const p=s.payment(q);if(reason==='amount')p.transaction_amount=1;if(reason==='expiry'){s.advance(16*60000);p.date_approved=new Date(Date.parse(p.date_approved)+16*60000).toISOString();}if(reason==='cycle')s.sub.next_payment_date='2027-01-01T00:00:00Z';await s.service.processPayment(p);await s.service.processPayment(p);assert.equal(s.profile().plano,'starter');assert.equal(s.calls.filter(c=>c.path.endsWith('/pay1/refunds')).length,1);}
});
test('provider failure after approval retries safely and scheduled referral benefit stays on next renewal',async()=>{
 const s=setup();s.profile().beneficioIndicacao50={status:'scheduled',subscriptionId:'sub',percent:50,baseAmount:9.99,discountAmount:5,effectiveAt:'2026-12-01T00:00:00Z'};const q=(await s.invoke({planKey:'pro'})).data;s.failUpdate();await assert.rejects(s.service.processPayment(s.payment(q)));assert.equal(s.profile().plano,'starter');await s.service.processPayment(s.payment(q));assert.equal(s.profile().plano,'pro');assert.equal(s.sub.auto_recurring.transaction_amount,14.95);assert.equal(s.profile().beneficioIndicacao50.baseAmount,29.9);
});
test('canceling an unpaid upgrade preserves subscription and a late approval is refunded',async()=>{
 const s=setup(),q=(await s.invoke({planKey:'pro'})).data;await s.invoke({action:'checkout',quoteId:q.quoteId});assert.equal((await s.invoke({action:'cancel',quoteId:q.quoteId})).statusCode,200);await s.service.processPayment(s.payment(q));assert.equal(s.profile().plano,'starter');assert.equal(s.sub.status,'authorized');assert.equal(s.sub.auto_recurring.transaction_amount,9.99);
});
test('client opens authenticated checkout directly and rejects a non-provider redirect',async()=>{
 const text=fs.readFileSync('appbudfinance/js/checkout-client.js','utf8').replace(/export /g,'');const api=new Function(text+';return {openAuthenticatedCheckout,validCheckoutURL};')();let target,request;
 await api.openAuthenticatedCheckout({getIdToken:async()=>'fictitious'},'pro',{base:'https://backend.invalid',refCode:'BUDTEST',fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>({init_point:'https://www.mercadopago.com.br/checkout/test'})};},navigate:u=>target=u});assert.match(target,/mercadopago/);assert.equal(request.options.headers.Authorization,'Bearer fictitious');assert.equal(JSON.parse(request.options.body).planKey,'pro');assert.equal(JSON.parse(request.options.body).ref,'BUDTEST');assert.throws(()=>api.validCheckoutURL('https://evil.invalid/'));
});

test('approval after account deletion is refunded without recreating customer data',async()=>{const s=setup(),q=(await s.invoke({planKey:'pro'})).data;s.state.clear();await s.service.processPayment(s.payment(q));assert.equal(s.state.size,0);assert.equal(s.calls.filter(c=>c.path.endsWith('/pay1/refunds')).length,1);});

test('quote rejects a different payer or a nonmonthly recurring contract',async()=>{
 for(const scenario of ['payer','frequency','currency']){const s=setup();if(scenario==='payer')s.profile().mpPayerId='different-buyer';if(scenario==='frequency')s.sub.auto_recurring.frequency=12;if(scenario==='currency')s.sub.auto_recurring.currency_id='USD';assert.equal((await s.invoke({planKey:'pro'})).statusCode,403);assert.equal(s.calls.some(c=>c.method==='POST'),false);}
});
test('already authenticated login entry sends checkout intent directly without a dashboard detour',async()=>{
 const source=fs.readFileSync('appbudfinance/js/index.js','utf8');const body=source.slice(source.indexOf('onAuthStateChanged(auth, async function (user) {')+'onAuthStateChanged(auth, async function (user) {'.length,source.indexOf('\n});',source.indexOf('onAuthStateChanged(auth, async function (user) {')));
 let called;const window={location:{search:'?checkout=pro&ref=BUDTEST',href:''}};
 const run=new Function('window','URLSearchParams','openAuthenticatedCheckout','mostrarFalhaCheckout','abrirCheckoutTesteLocal','return async function(user){let _loginInProgress=false,_magicLoginInProgress=false;'+body+'}')(window,URLSearchParams,async(u,p,o)=>called={u,p,o},()=>{},()=>{});
 await run({uid:'fake'});assert.equal(called.p,'pro');assert.equal(called.o.refCode,'BUDTEST');assert.equal(window.location.href,'');
});
