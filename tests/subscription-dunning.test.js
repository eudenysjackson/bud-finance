const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {subscriptionDunningStage}=require('../backend/financial-notifications');

const server=fs.readFileSync('backend/server.js','utf8');
function toDate(value){if(!value)return null;if(typeof value.toDate==='function')return value.toDate();const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function keyBR(date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function formatBR(date){return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);}

test('dunning milestones are stable at days 0, 3, 7 and 10',()=>{
 const profile={pagamentoPendente:true,pagamentoPendenteDesde:'2026-11-01T12:00:00.000Z'};
 for(const [day,stage] of [[0,0],[2,0],[3,3],[6,3],[7,7],[9,7],[10,10],[20,10]]){
  const today=new Date(Date.parse('2026-11-01T12:00:00.000Z')+day*86400000).toISOString().slice(0,10);
  assert.equal(subscriptionDunningStage(profile,today).stage,stage);
 }
 assert.equal(subscriptionDunningStage({...profile,pagamentoPendente:false},'2026-11-11'),null);
});

test('subscription reminder emails send once at each configured milestone',async()=>{
 const start=new Date('2026-11-01T12:00:00.000Z');
 const user={email:'qa@example.test',nome:'Pessoa Teste',plano:'starter',pagamentoPendente:true,pagamentoPendenteDesde:start,assinaturaStatus:'past_due',mpSubscriptionId:'sub-1',emailAssinaturaAvisos:{}};
 const userDoc={id:'owner',data:()=>user,ref:{update:async patch=>{for(const [path,value] of Object.entries(patch)){const key=path.split('.').at(-1);user.emailAssinaturaAvisos[key]=value;}}}};
 const sent=[];
 const db={collection:()=>({where:()=>({limit:()=>({get:async()=>({docs:[userDoc],size:1})})})})};
 const begin=server.indexOf('async function enviarLembretesDeAssinatura('),end=server.indexOf('async function cancelarAssinaturasForaDaTolerancia(');
 const code=server.slice(begin,end);
 const context={db,EMAILJS_TEMPLATE_COMUNICACAO:'template',EMAILJS_PUBLIC_KEY:'public',EMAILJS_SERVICE_ID:'service',FRONTEND_URL:'https://budsolucoes.com.br/appbudfinance',
  _toDate:toDate,_dateKeyBR:keyBR,_formatDateBR:formatBR,subscriptionDunningStage,subscriptionEmailProof: (uid,email) => { assert.equal(uid,"owner"); assert.equal(email,"qa@example.test"); return "proof"; },sendCommunicationEmail:async params=>sent.push(params),sanitizeStr:value=>value,console:{error(...args){process.stderr.write(args.map(String).join(' ')+'\n');}}};
 vm.runInNewContext(code,context);
 for(const day of [0,3,7,10]){
  const now=new Date(start.getTime()+day*86400000);
  const result=await context.enviarLembretesDeAssinatura(now);
  assert.equal(result.sent,1);
  assert.equal((await context.enviarLembretesDeAssinatura(now)).sent,0,'same milestone must not resend');
 }
 assert.equal(sent.length,4);
 assert.equal(new URL(sent[0].action_url).searchParams.get("aviso"), "proof");
 assert.deepEqual(sent.map(mail=>mail.action_label),Array(4).fill('Regularizar assinatura'));
 assert.match(sent[0].email_body,/tolerância de 10 dias/);
 assert.match(sent[3].email_body,/retornará ao plano Gratuito/);
 assert.match(sent[3].email_body,/não negativará/);
});

function cancellationHarness(day=11){
 const start=new Date('2026-11-01T12:00:00.000Z');
 const profile={plano:'pro',planoExpira:'2026-12-01T12:00:00.000Z',pagamentoPendente:true,pagamentoPendenteDesde:start,pagamentoPendentePagamentoId:'pay-1',assinaturaStatus:'past_due',mpSubscriptionId:'sub-1'};
 let providerStatus='authorized';const calls=[];
 const userDoc={id:'owner',data:()=>profile,ref:{get:async()=>({exists:true,data:()=>({...profile})})}};
 const db={collection:()=>({where:()=>({equals:()=>({limit:()=>({get:async()=>({docs:[userDoc],size:1})})}),limit:()=>({get:async()=>({docs:[userDoc],size:1})})})})};
 const sentinel='__delete__';
 async function fetch(url,options={}){
  calls.push({url,method:options.method||'GET'});
  if(url.includes('/authorized_payments/search'))return{ok:true,json:async()=>({results:[]})};
  if(url.includes('/v1/payments/'))return{ok:true,json:async()=>({id:'pay-1',status:'rejected',preapproval_id:'sub-1'})};
  if(url.includes('/preapproval/sub-1')){
   if(options.method==='PUT')providerStatus='cancelled';
   return{ok:true,json:async()=>({id:'sub-1',external_reference:'owner|pro',status:providerStatus})};
  }
  throw Error('Unexpected provider URL '+url);
 }
 const begin=server.indexOf('async function cancelarAssinaturasForaDaTolerancia('),end=server.indexOf("app.get('/api/notifications/daily'",begin);
 const code=server.slice(begin,end);
 const context={MP_ACCESS_TOKEN:'TEST-token',db,fetch,process:{env:{BUD_USE_EMULATOR:'false'}},AbortSignal,URL,encodeURIComponent,
  PAYMENT_GRACE_DAYS:10,_pendingDayCount:(p,now)=>Math.floor((Date.parse(keyBR(now)+'T12:00:00Z')-Date.parse(keyBR(p.pagamentoPendenteDesde)+'T12:00:00Z'))/86400000),
  _toDate:toDate,console:{error(){}},_mpHandlePayment:async()=>{},_mpHandleSubscription:async()=>{},
  _mpUpdateSubscriptionProfile:async(uid,id,patch)=>{assert.equal(uid,'owner');assert.equal(id,'sub-1');for(const[key,value]of Object.entries(patch)){if(value===sentinel)delete profile[key];else profile[key]=value;}return true;},
  admin:{firestore:{FieldValue:{delete:()=>sentinel,serverTimestamp:()=>new Date()}}}};
 vm.runInNewContext(code,context);
 const now=new Date(start.getTime()+day*86400000);
 return{run:()=>context.cancelarAssinaturasForaDaTolerancia(now),profile,calls};
}

test('subscription is not cancelled on the last grace day',async()=>{
 const s=cancellationHarness(10);const result=await s.run();assert.equal(result.cancelled,0);assert.equal(s.calls.length,0);assert.equal(s.profile.plano,'pro');
});

test('after grace, a still-rejected same subscription is cancelled and downgraded',async()=>{
 const s=cancellationHarness(11);const result=await s.run();
 assert.equal(result.cancelled,1);assert.equal(s.profile.plano,'free');assert.equal(s.profile.assinaturaStatus,'cancelled');assert.equal(s.profile.pagamentoPendente,false);
 assert.deepEqual(s.calls.map(call=>call.method),['GET','GET','GET','PUT','GET']);
});


test('subscription notice proof requires the original UID and verified recipient email', async () => {
  const crypto = require('node:crypto');
  const code = server.slice(server.indexOf('function subscriptionEmailProof('), server.indexOf('function safeSecretEquals('));
  let route;
  let user = { uid: 'recipient', email: 'recipient@example.test', email_verified: true };
  const context = { crypto, EMAIL_VERIFICATION_SECRET: 'test-only',
    app: {post: (_, handler) => { route = handler; }},
    getBearerUser: async () => user,
    safeSecretEquals: (a,b) => a === b };
  vm.runInNewContext(code, context);
  const proof = context.subscriptionEmailProof(user.uid, user.email);
  const validate = async () => {
    let code;
    await route({body:{proof}}, {sendStatus: status => { code = status; }});
    return code;
  };
  assert.equal(await validate(), 204);
  user.uid = 'other';
  assert.equal(await validate(), 403);
  user.uid = 'recipient';
  user.email = 'changed@example.test';
  assert.equal(await validate(), 403);
  user.email = 'recipient@example.test';
  user.email_verified = false;
  assert.equal(await validate(), 403);
});
