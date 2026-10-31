// Real Auth/Firestore rules and backend checks, restricted to local emulators.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
if (process.env.BUD_USE_EMULATOR !== 'true') throw Error('Exige BUD_USE_EMULATOR=true.');
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require('../backend/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'bud-finance-local' });
const db = admin.firestore(), auth = admin.auth();
const base = 'http://127.0.0.1:8080/v1/projects/bud-finance-local/databases/(default)/documents/';
const created = [];
async function session() {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local', {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa-release-'+randomUUID()+'@bud.local',password:randomUUID(),returnSecureToken:true}),
  });
  const data = await response.json(); assert.equal(response.status,200);
  created.push(data.localId); return {uid:data.localId, token:data.idToken, email:data.email};
}
async function firestore(user, route, method='GET', fields) {
  return fetch(base+route,{method,headers:{Authorization:'Bearer '+user.token,'Content-Type':'application/json'},...(fields?{body:JSON.stringify({fields})}:{})});
}
async function api(user, route, method='DELETE', body) {
  return fetch('http://127.0.0.1:3000'+route,{method,headers:{Authorization:'Bearer '+user.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
}
async function main() {
  const owner=await session(), other=await session();
  const resetUser=await session();
  const source=fs.readFileSync('backend/server.js','utf8');
  const routeCode=source.slice(source.indexOf("app.post('/reset-senha'"),source.indexOf("app.get('/',"));
  let resetHandler, emailParams;
  const routeContext={app:{post:(_,fn)=>{resetHandler=fn;}},auth,db,isRateLimited:()=>false,sanitizeStr:value=>value,
    FRONTEND_URL:'http://127.0.0.1:3001/appbudfinance',sendCommunicationEmail:async params=>{emailParams=params;},URL,console};
  vm.runInNewContext(routeCode,routeContext);
  await resetHandler({body:{email:resetUser.email}},{json:data=>assert.equal(data.success,true)});
  const actionUrl=new URL(emailParams.action_url);
  assert.equal(actionUrl.searchParams.get('mode'),'resetPassword');
  const resetResponse=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=local',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:actionUrl.searchParams.get('oobCode'),newPassword:randomUUID()}),
  });
  assert.equal(resetResponse.status,200);
  assert.equal((await resetResponse.json()).email,resetUser.email);
  const reuse=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=local',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:actionUrl.searchParams.get('oobCode')}),
  });
  assert.equal(reuse.status,400);
  console.log('PASS updated reset route: valid action, disposable password reset and single-use code');
  const billingUser=await session();
  await db.doc('usuarios/'+billingUser.uid).set({nome:'QA checkout',email:billingUser.email,plano:'free'});
  for(const status of ['pending','rejected','approved']){
    assert.equal((await api(billingUser,'/mercadopago/local-test-payment','POST',{planKey:'pro',status})).status,200);
    const profile=(await db.doc('usuarios/'+billingUser.uid).get()).data();
    assert.equal(profile.pagamentoPendente,status!=='approved');
    assert.equal(profile.assinaturaStatus,status==='approved'?'authorized':status==='rejected'?'past_due':'pending');
  }
  const schedule=await api(billingUser,'/mercadopago/change-subscription','POST',{planKey:'plus'});
  assert.equal(schedule.status,200);assert.equal((await schedule.json()).scheduled,true);
  const scheduledProfile=(await db.doc('usuarios/'+billingUser.uid).get()).data();
  assert.equal(scheduledProfile.plano,'pro');assert.equal(scheduledProfile.planoTroca.planKey,'plus');
  assert.equal((await api(billingUser,'/mercadopago/cancelar-assinatura','POST',{})).status,200);
  assert.equal((await db.doc('usuarios/'+billingUser.uid).get()).data().plano,'free');
  assert.equal((await db.doc('usuarios/'+billingUser.uid).get()).data().planoTroca,undefined);
  console.log('PASS updated HTTP checkout: pending, rejected, approved, next-cycle change and cancellation');
  const prefix='usuarios/'+owner.uid;
  await db.doc(prefix).set({nome:'QA descartável',plano:'plus',pushEnabled:true,fcmToken:'ficticio'});
  await db.doc(prefix+'/carteira/conta').set({tipo:'debito',saldo:100});
  await db.doc(prefix+'/metas/meta').set({nome:'Teste',valorAtual:0});
  const deposit=prefix+'/metas/meta/depositos/teste';
  assert.equal((await firestore(owner,deposit,'PATCH',{valor:{doubleValue:10}})).status,200);
  assert.equal((await firestore(owner,deposit)).status,200);
  assert.equal((await firestore(other,deposit)).status,403);
  assert.equal((await firestore(other,deposit,'PATCH',{valor:{doubleValue:99}})).status,403);
  assert.equal((await firestore(owner,prefix+'/uso-ia/2026-10','PATCH',{processamentos:{integerValue:'0'}})).status,403);
  assert.equal((await firestore(owner,prefix,'PATCH',{plano:{stringValue:'starter'}})).status,403);
  for(const key of ['planoTroca','planoTrocaLock','mpPayerId','mpCheckout','fcmTokens'])assert.equal((await firestore(owner,prefix,'PATCH',{[key]:{stringValue:'forged'}})).status,403);
  assert.equal((await firestore(owner,prefix+'/_seguranca/verificacao-email','PATCH',{tentativas:{integerValue:'0'}})).status,403);
  assert.equal((await firestore(owner,prefix+'/_seguranca/verificacao-email')).status,403);
  console.log('PASS rules: goal deposits owner-only; quotas and billing protected');

  const documentName = relative => 'projects/bud-finance-local/databases/(default)/documents/'+relative;
  const rejectedBatch = await fetch(base.slice(0,-1)+':commit', {
    method:'POST',headers:{Authorization:'Bearer '+owner.token,'Content-Type':'application/json'},
    body:JSON.stringify({writes:[
      {update:{name:documentName(prefix+'/metas/meta'),fields:{valorAtual:{doubleValue:20}}},updateMask:{fieldPaths:['valorAtual']}},
      {update:{name:documentName('usuarios/'+other.uid+'/carteira/proibida'),fields:{saldo:{doubleValue:999}}}},
    ]}),
  });
  assert.equal(rejectedBatch.status,403);
  assert.equal((await db.doc(prefix+'/metas/meta').get()).data().valorAtual,0);
  console.log('PASS rejected financial batch rolls back all writes');

  const preflight=await fetch('http://127.0.0.1:3000/api/push/token',{method:'OPTIONS',headers:{Origin:'https://www.budsolucoes.com.br','Access-Control-Request-Method':'DELETE','Access-Control-Request-Headers':'authorization'}});
  assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-methods'),/DELETE/);
  assert.equal((await api(owner,'/api/push/token')).status,200);
  const updated=(await db.doc(prefix).get()).data();
  assert.equal(updated.pushEnabled,false);assert.equal(updated.fcmToken,undefined);
  console.log('PASS CORS DELETE and authenticated push-token revocation');

  await db.doc(prefix+'/uso-ia/2026-10').set({processamentos:3});
  await db.doc('usuarios/'+other.uid).set({nome:'Outro titular'});
  assert.equal((await api(owner,'/api/account','DELETE',{confirmation:'EXCLUIR',uid:other.uid})).status,200);
  assert.equal((await db.doc(prefix).get()).exists,false);
  assert.equal((await db.doc(deposit).get()).exists,false);
  assert.equal((await db.doc(prefix+'/uso-ia/2026-10').get()).exists,false);
  await assert.rejects(auth.getUser(owner.uid),e=>e.code==='auth/user-not-found');
  assert.equal((await db.doc('usuarios/'+other.uid).get()).exists,true);
  assert.ok(await auth.getUser(other.uid));
  console.log('PASS recursive account deletion and isolation from another user');
  await db.doc('usuarios/'+other.uid).update({mpSubscriptionId:'real-subscription-fictitious'});
  assert.equal((await api(other,'/api/account','DELETE',{confirmation:'EXCLUIR'})).status,409);
  assert.equal((await db.doc('usuarios/'+other.uid).get()).exists,true);
  console.log('PASS active subscription blocks deletion without contacting Mercado Pago');
}
main().finally(async()=>{
  // Clean up only the disposable users allocated by this invocation.
  for(const uid of created){await db.recursiveDelete(db.doc('usuarios/'+uid));await auth.deleteUser(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e;});}
  await admin.app().delete();
}).catch(error=>{console.error(error.message);process.exitCode=1;});

