const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {sendFinancialPush}=require('../backend/financial-notifications');
function setup(){
 const profile={plano:'free'},routes=new Map(),sent=[];
 const ref={get:async()=>({exists:true,data:()=>({...profile})}),update:async patch=>{for(const [key,value] of Object.entries(patch)){if(value==='DELETE')delete profile[key];else profile[key]=value;}}};
 let tail=Promise.resolve();const db={collection:()=>({doc:uid=>{assert.equal(uid,'owner');return ref;}}),runTransaction(fn){const result=tail.then(()=>fn({get:r=>r.get(),update:(_,patch)=>ref.update(patch)}));tail=result.catch(()=>{});return result;}};
 const source=fs.readFileSync('backend/server.js','utf8'),code=source.slice(source.indexOf("app.post('/api/push/token'"),source.indexOf("app.post('/api/push/admin-broadcast'"));
 new Function('app','auth','db','admin','sanitizeStr','FRONTEND_URL','console',code)(
  {post:(p,h)=>routes.set('POST '+p,h),delete:(p,h)=>routes.set('DELETE '+p,h)},
  {verifyIdToken:async()=>({uid:'owner'})},db,{firestore:{FieldValue:{delete:()=>'DELETE',serverTimestamp:()=>1}},messaging:()=>({send:async message=>sent.push(message)})},String,'https://budsolucoes.com.br/appbudfinance',{error(){}}
 );
 async function invoke(method,path,body,authorized=true){const res={statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};await routes.get(method+' '+path)({headers:authorized?{authorization:'Bearer fictitious'}:{},body:body||{}},res);return res;}
 return{profile,invoke,sent};
}
test('phone and computer remain registered together; revocation removes only the selected device',async()=>{
 const s=setup();assert.equal((await s.invoke('POST','/api/push/token',{token:'phone'})).statusCode,200);assert.equal((await s.invoke('POST','/api/push/token',{token:'computer'})).statusCode,200);
 assert.deepEqual(s.profile.fcmTokens,['phone','computer']);await s.invoke('DELETE','/api/push/token',{token:'computer'});assert.deepEqual(s.profile.fcmTokens,['phone']);assert.equal(s.profile.fcmToken,'phone');assert.equal(s.profile.pushEnabled,true);
 await s.invoke('DELETE','/api/push/token',{token:'phone'});assert.equal(s.profile.pushEnabled,false);assert.equal(s.profile.fcmToken,undefined);
});
test('self-test rejects unregistered target devices and unauthenticated registrations',async()=>{
 const s=setup();assert.equal((await s.invoke('POST','/api/push/token',{token:'phone'},false)).statusCode,401);await s.invoke('POST','/api/push/token',{token:'phone'});
 assert.equal((await s.invoke('POST','/api/push/test',{token:'another-user-device'})).statusCode,400);assert.equal(s.sent.length,0);
 assert.equal((await s.invoke('POST','/api/push/test',{token:'phone'})).statusCode,200);assert.equal(s.sent[0].token,'phone');
});
test('financial push fans out once per device, expires after one hour and identifies invalid devices individually',async()=>{
 let message;const transport={sendEachForMulticast:async m=>{message=m;return{successCount:1,responses:[{success:true},{success:false,error:{code:'messaging/registration-token-not-registered'}}]};}};
 const result=await sendFinancialPush(transport,['phone','phone','computer'],{title:'Fatura amanhã',body:'R$ 20',tag:'bill-test',url:'cartoes.html'},'https://budsolucoes.com.br/appbudfinance');
 assert.deepEqual(message.tokens,['phone','computer']);assert.equal(message.webpush.headers.TTL,'3600');assert.equal(message.notification,undefined);assert.equal(message.webpush.fcmOptions.link,'https://budsolucoes.com.br/appbudfinance/cartoes.html');assert.deepEqual(result,{successCount:1,invalid:['computer']});
});
