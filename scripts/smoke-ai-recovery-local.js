// Real Firestore Emulator checks; no provider calls or production credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
if(process.env.BUD_USE_EMULATOR!=='true')throw Error('Exige BUD_USE_EMULATOR=true.');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const admin=require('../backend/node_modules/firebase-admin');admin.initializeApp({projectId:'bud-finance-local'});
const db=admin.firestore(),auth=admin.auth();
const {createFirestoreJobStore}=require('../backend/ai-job-store');
const {createJobs,currentJob}=require('../backend/ai-jobs');
const uid='qa-ai-recovery-'+randomUUID();
function response(){return{statusCode:200,status(n){this.statusCode=n;return this;},set(){return this;},json(d){this.data=d;return this;}};}
async function main(){
 await auth.createUser({uid,email:uid+'@bud.local',password:randomUUID()});await db.doc('usuarios/'+uid).set({plano:'plus'});
 let clock=Date.now();const first=createFirestoreJobStore(db,{now:()=>clock}),second=createFirestoreJobStore(db,{now:()=>clock});
 const id=randomUUID(), bytes=Buffer.from('Documento fictício — leitura após reinício.\n'.repeat(35000));
 await first.create(uid,id,'invoice',{body:{tipo:'fatura'},file:{mimetype:'application/pdf',originalname:'ficticio.pdf',buffer:bytes.toString('base64')},files:[],contentType:'multipart/form-data; boundary=test'});
 const claimed=await first.claim(uid,id);assert.ok(claimed);assert.equal(await second.claim(uid,id),null);
 const saved=await first.payload(uid,id,await first.read(uid,id));assert.equal(JSON.stringify(saved).includes('Bearer'),false);assert.equal(Buffer.from(saved.file.buffer,'base64').length,bytes.length);
 console.log('PASS persistent payload larger than 1MiB survives storage; no bearer token stored; lease excludes a second worker');
 clock+=16000;
 const source=fs.readFileSync('backend/server.js','utf8');
 // Firestore checks native Promise identity; compile in this realm to match the real server.
 const quota={incrementarQuotaIA:new Function('db','currentJob','require',source.slice(source.indexOf('async function incrementarQuotaIA('),source.indexOf("app.post('/api/extrair-cupom'"))+';return incrementarQuotaIA;')(db,currentJob,n=>{assert.equal(n,'firebase-admin');return admin;})};
 let calls=0;
 const jobs=createJobs(async req=>({uid:req.uid}),{store:second});
 jobs.wrap(async(req,out)=>{calls++;try{assert.equal(req.budUser.uid,uid);assert.equal(req.headers.authorization,undefined);assert.ok(req.file.buffer.equals(bytes));await quota.incrementarQuotaIA(uid);await quota.incrementarQuotaIA(uid);return out.json({items:'resultado com acentos çã'.repeat(70000)});}catch(e){console.error('TEST HANDLER:',e.message);throw e;}},'invoice');
 const denied=response();await jobs.poll({uid:'another-user',params:{id}},denied);assert.equal(denied.statusCode,404);assert.equal(calls,0);
 let done;
 const deadline=Date.now()+15000;
 do{const res=response();await jobs.poll({uid,params:{id}},res);assert.equal(res.statusCode,200);assert.notEqual(res.data.state,'failed','recovered handler failed');if(res.data.state==='completed'){done=res.data;break;}await new Promise(r=>setTimeout(r,30));}while(Date.now()<deadline);
 assert.ok(done,'recovered job must complete');assert.equal(calls,1);assert.equal(done.result.items.length,'resultado com acentos çã'.repeat(70000).length);
 const usage=await db.collection('usuarios').doc(uid).collection('uso-ia').get();assert.equal(usage.size,1);assert.equal(usage.docs[0].data().processamentos,1);
 const chunks=await second.ref(uid,id).collection('_ai_job_chunks').get();assert.equal(chunks.docs.some(d=>d.id.startsWith('input-')),false);
 const stale=await first.finish(uid,id,{state:'completed',status:200,message:'stale',result:{items:'wrong'}});assert.equal(stale,false);
 const third=createJobs(async req=>({uid:req.uid}),{store:createFirestoreJobStore(db,{now:()=>clock})});third.wrap(()=>{throw Error('completed jobs must not execute again');},'invoice');
 const afterRestart=response();await third.poll({uid,params:{id}},afterRestart);assert.equal(afterRestart.data.result.items,done.result.items);
 console.log('PASS expired worker lease recovers from persisted file; owner isolation; result larger than 1MiB survives another restart; quota counted once; stale worker fenced');
 const queued=[randomUUID(),randomUUID()];for(const next of queued)await second.create(uid,next,'invoice',{body:{},files:[],file:null,contentType:'application/json'});
 await assert.rejects(second.create(uid,randomUUID(),'invoice',{body:{},files:[],file:null,contentType:'application/json'}),e=>e.status===409);
 clock+=31*60_000;assert.equal(await second.read(uid,id),null);
 assert.equal((await second.ref(uid,id).collection('_ai_job_chunks').get()).size,0);
 console.log('PASS two-job admission applies across instances; expired results and nested chunks are deleted');
 const customToken=await auth.createCustomToken(uid);const sessionResponse=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:customToken,returnSecureToken:true})});const session=await sessionResponse.json();assert.ok(session.idToken);
 const base='http://127.0.0.1:8080/v1/projects/bud-finance-local/databases/(default)/documents/usuarios/'+uid;
 for(const path of ['/_ai_jobs/'+queued[0],'/_ai_jobs/'+queued[0]+'/_ai_job_chunks/input-0']){
  const denied=await fetch(base+path,{headers:{Authorization:'Bearer '+session.idToken}});assert.equal(denied.status,403);
 }
 console.log('PASS raw AI files and job metadata are inaccessible directly from the authenticated Firebase client');
}
main().finally(async()=>{await db.recursiveDelete(db.doc('usuarios/'+uid));await auth.deleteUser(uid).catch(()=>{});await admin.app().delete();}).catch(e=>{console.error(e.message);process.exitCode=1;});
