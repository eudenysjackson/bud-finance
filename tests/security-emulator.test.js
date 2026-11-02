const {test,after}=require('node:test'),assert=require('node:assert/strict');
const enabled=process.env.RUN_SECURITY_EMULATOR==='1';
if(enabled){
 if(process.env.GCLOUD_PROJECT!=='demo-bud-security'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19199')throw Error('Security tests only run against named local demo emulators.');
 const admin=require('../backend/node_modules/firebase-admin'),express=require('../backend/node_modules/express');
 const {createAccountLifecycle,TOKEN_DRAIN_MS}=require('../backend/account-lifecycle'),{createSecurityGuard}=require('../backend/security-guard');
 admin.initializeApp({projectId:'demo-bud-security'});const db=admin.firestore(),auth=admin.auth(),tag=Date.now().toString(36);let server;
 const a='alice-'+tag,b='bob-'+tag;
 async function login(uid){const email=uid+'@example.invalid',password='Fictitious-only-9!';await auth.createUser({uid,email,password,emailVerified:true});const r=await fetch('http://127.0.0.1:19199/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.equal(r.status,200);return(await r.json()).idToken;}
 let tokenA,tokenB;
 const base='http://127.0.0.1:18080/v1/projects/demo-bud-security/databases/(default)/documents/';
 async function request(path,token,method='GET',fields){return fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(fields?{'Content-Type':'application/json'}:{})},...(fields?{body:JSON.stringify({fields})}:{})});}
 test('emulated intrusion: anonymous access, cross-user read/write, privilege escalation and private jobs are denied',async()=>{
  tokenA=await login(a);tokenB=await login(b);
  await db.doc('usuarios/'+a).set({nome:'Alice',plano:'free'});await db.doc('usuarios/'+b).set({nome:'Bob',plano:'free'});await db.doc('usuarios/'+a+'/_seguranca/test').set({secret:'fictional'});await db.doc('usuarios/'+a+'/uso-ia/2026-11').set({total:1});
  assert.equal((await request('usuarios/'+a,null)).status,403);
  assert.equal((await request('usuarios/'+a,tokenA)).status,200);
  assert.equal((await request('usuarios/'+b,tokenA)).status,403);
  assert.equal((await request('usuarios/'+b,tokenA,'PATCH',{nome:{stringValue:'attacker'}})).status,403);
  assert.equal((await request('usuarios/'+a+'?updateMask.fieldPaths=plano',tokenA,'PATCH',{plano:{stringValue:'plus'}})).status,403);
  assert.equal((await request('admins/'+a,tokenA,'PATCH',{role:{stringValue:'admin'}})).status,403);
  assert.equal((await request('usuarios/'+a+'/_seguranca/test',tokenA)).status,403);
  assert.equal((await request('usuarios/'+a+'/uso-ia/2026-11',tokenA,'PATCH',{total:{integerValue:'0'}})).status,403);
 });
 test('emulated deletion removes all known links, preserves other user finances, rejects stale tokens and prevents recreation',async()=>{
  assert(tokenA);const profile=db.doc('usuarios/'+a),other=db.doc('usuarios/'+b);
  await profile.collection('metas').doc('goal').collection('depositos').doc('deposit').set({valor:1});
  await profile.collection('_ai_jobs').doc('job').collection('_ai_job_chunks').doc('input').set({bytes:'fictional'});
  await db.doc('chamados/'+a).set({uid:a,emailUsuario:'fictional@example.invalid'});await db.doc('alertas_financeiros/'+a).set({uid:a,alertas:['fictional']});
  await other.collection('indicacoes').doc(a).set({indicadoUid:a});await other.update({indicadoPor:{uid:a,codigo:'TEST'},beneficioIndicacao50:{indicadoUid:a,status:'pending',percent:50}});
  await other.collection('transacoes').doc('keep').set({valor:123});await db.doc('plano_historico/'+a).set({uid:a,oldPlan:'free'});await db.doc('plano_historico/keep-'+tag).set({uid:b,alteredBy:a,newPlan:'free'});await db.doc('notificacoes-globais/keep-'+tag).set({titulo:'Mensagem pública fictícia',criadoPor:a});
  let time=Date.now();const service=createAccountLifecycle({auth,db,fieldValue:admin.firestore.FieldValue,now:()=>time,authenticate:async(req,res)=>{try{return await auth.verifyIdToken(req.headers.authorization.slice(7),true);}catch(_){res.status(401).json({error:'Invalid session'});return null;}}});
  const app=express();app.use(express.json());app.use(createSecurityGuard({auth,db,secret:'test-secret'}));app.get('/api/session',(req,res)=>res.json({uid:req.budUser.uid}));app.delete('/api/account',service.handler);
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
  const r=await fetch(url+'/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'application/json'},body:JSON.stringify({confirmation:'EXCLUIR',uid:b})});assert.equal(r.status,200);
  assert.equal((await profile.get()).exists,false);assert.equal((await profile.collection('metas').doc('goal').collection('depositos').doc('deposit').get()).exists,false);assert.equal((await db.doc('chamados/'+a).get()).exists,false);assert.equal((await db.doc('alertas_financeiros/'+a).get()).exists,false);assert.equal((await db.doc('plano_historico/'+a).get()).exists,false);assert.equal((await db.doc('plano_historico/keep-'+tag).get()).data().alteredBy,undefined);assert.equal((await db.doc('notificacoes-globais/keep-'+tag).get()).data().criadoPor,undefined);assert.equal((await other.collection('indicacoes').doc(a).get()).exists,false);
  const remaining=(await other.get()).data();assert.equal(remaining.indicadoPor,undefined);assert.equal(remaining.beneficioIndicacao50.indicadoUid,undefined);assert.equal(remaining.beneficioIndicacao50.percent,50);assert.equal((await other.collection('transacoes').doc('keep').get()).data().valor,123);
  assert.equal((await fetch(url+'/api/session',{headers:{Authorization:'Bearer '+tokenA}})).status,401);
  assert.equal((await request('usuarios/'+a,tokenA,'PATCH',{nome:{stringValue:'recreated'}})).status,403);
  assert.equal((await request('usuarios/'+b,tokenB)).status,200);
  const lock=db.doc('_account_deletions/'+a);assert.equal((await lock.get()).exists,true);assert.equal((await request('_account_deletions/'+a,tokenB)).status,403);
  await profile.collection('transacoes').doc('delayed-write').set({valor:999});
  time+=5*60_000+1;await service.resume();assert.equal((await profile.collection('transacoes').doc('delayed-write').get()).exists,false);
  time+=TOKEN_DRAIN_MS+1;await service.resume();assert.equal((await lock.get()).exists,false);
 });
 test('emulated rate limit survives creating a new middleware instance and isolates different callers',async()=>{
  let time=Date.now();const options={auth,db,secret:'persistent-test-'+tag,now:()=>time,maxRequests:3};
  async function invoke(guard,ip,token){let next=false;const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(){return this;}};await guard({path:'/api/test',ip,headers:token?{authorization:'Bearer '+token}:{}} ,res,()=>next=true);return{status:res.statusCode,next};}
  const first=createSecurityGuard(options);for(let i=0;i<3;i++)assert.equal((await invoke(first,'fictional-ip-a')).next,true);
  assert.equal((await invoke(createSecurityGuard(options),'fictional-ip-a')).status,429);assert.equal((await invoke(first,'fictional-ip-b')).next,true);time+=60_001;assert.equal((await invoke(first,'fictional-ip-a')).next,true);const tokenC=await login('rate-'+tag);for(let i=0;i<3;i++)assert.equal((await invoke(first,'shared-peer',tokenB)).next,true);assert.equal((await invoke(first,'shared-peer',tokenB)).status,429);assert.equal((await invoke(first,'shared-peer',tokenC)).next,true);
 });

 test('full backend in demo emulator denies forged login, non-admin access and unsigned webhook; future integration stays disabled',async()=>{
  const {spawn}=require('node:child_process');const child=spawn(process.execPath,['backend/server.js'],{cwd:process.cwd(),env:{...process.env,BUD_USE_EMULATOR:'true',GOOGLE_CLOUD_PROJECT:'demo-bud-security',PORT:'13091',NODE_ENV:'production',EMAIL_VERIFICATION_SECRET:'fictitious-test-secret',MP_ACCESS_TOKEN:'',MP_WEBHOOK_SECRET:'fictitious-webhook-secret',GROQ_API_KEY:'',EMAILJS_PRIVATE_KEY:'',EMAILJS_PUBLIC_KEY:''},stdio:'ignore'});
  try{
   const root='http://127.0.0.1:13091';let ready=false;for(let i=0;i<40;i++){try{const r=await fetch(root+'/api/ping');if(r.ok){ready=true;break;}}catch(_){}await new Promise(r=>setTimeout(r,250));}assert(ready,'isolated backend started');
   const forged=await fetch(root+'/api/extrair-fatura',{method:'POST',headers:{Authorization:'Bearer forged-token'}});assert.equal(forged.status,401);
   const adminOnly=await fetch(root+'/api/chamados',{headers:{Authorization:'Bearer '+tokenB}});assert.equal(adminOnly.status,403);
   const webhook=await fetch(root+'/webhook/mercadopago',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'payment',data:{id:'fictitious'}})});assert.equal(webhook.status,401);
   assert.equal((await fetch(root+'/webhook/evolution',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
   assert.equal((await fetch(root+'/mercadopago/create-subscription',{method:'POST',headers:{Authorization:'Bearer forged-token','Content-Type':'application/json'},body:'{}'})).status,401);
  }finally{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}
 });
 test('updated upload parser accepts ordinary documents and bounds file/field counts',async()=>{
  const multer=require('../backend/node_modules/multer');const app=express();const upload=multer({storage:multer.memoryStorage(),limits:{files:1,fields:16,parts:17,fileSize:1024}});app.post('/file',upload.single('arquivo'),(req,res)=>res.json({size:req.file.buffer.length}));app.use((e,req,res,next)=>res.status(400).json({code:e.code||'invalid-upload'}));const local=app.listen(0,'127.0.0.1');await new Promise(r=>local.once('listening',r));
  try{const url='http://127.0.0.1:'+local.address().port+'/file',form=new FormData();form.append('arquivo',new Blob(['fictitious PDF'],{type:'application/pdf'}),'test.pdf');const ok=await fetch(url,{method:'POST',body:form});assert.equal(ok.status,200);assert.equal((await ok.json()).size,14);const bad=new FormData();bad.append('arquivo',new Blob(['a']),'a.pdf');bad.append('arquivo',new Blob(['b']),'b.pdf');assert.equal((await fetch(url,{method:'POST',body:bad})).status,400);}finally{await new Promise(r=>local.close(r));}
 });
 after(async()=>{if(server)await new Promise(r=>server.close(r));await db.terminate();await admin.app().delete();});
}else test('emulated security suite requires explicit local demo environment',{skip:true},()=>{});

