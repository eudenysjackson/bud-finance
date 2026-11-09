const DRAIN=65*60_000,SETTLE=5*60_000;
function createAccountLifecycle({authenticate,auth,db,fieldValue,emulator=false,now=Date.now}){
 const lock=uid=>db.collection('_account_deletions').doc(uid);
 async function erase(query){for(;;){const s=await query.limit(100).get();if(s.empty)return;for(const d of s.docs)await db.recursiveDelete(d.ref);}}
 async function purge(uid){
  for(const name of ['chamados','alertas_financeiros','plano_historico'])await erase(db.collection(name).where('uid','==',uid));
  await erase(db.collectionGroup('indicacoes').where('indicadoUid','==',uid));
  for(const [field,patch]of [['indicadoPor.uid',{indicadoPor:fieldValue.delete()}],['beneficioIndicacao50.indicadoUid',{'beneficioIndicacao50.indicadoUid':fieldValue.delete()}]]){
   for(;;){const s=await db.collection('usuarios').where(field,'==',uid).limit(100).get();if(s.empty)break;for(const d of s.docs)await db.runTransaction(async tx=>{const current=await tx.get(d.ref);let value=current.data();for(const key of field.split('.'))value=value?.[key];if(value===uid)tx.update(d.ref,patch);});}
  }
  for(const [collection,field]of [['plano_historico','alteredBy'],['notificacoes-globais','criadoPor']]){
   for(;;){const s=await db.collection(collection).where(field,'==',uid).limit(100).get();if(s.empty)break;for(const d of s.docs)await db.runTransaction(async tx=>{const fresh=await tx.get(d.ref);if(fresh.data()?.[field]===uid)tx.update(d.ref,{[field]:fieldValue.delete()});});}
  }
  for(const name of ['admins','admin','_gestor_devices'])await db.recursiveDelete(db.collection(name).doc(uid));
  await db.recursiveDelete(db.collection('usuarios').doc(uid));
 }
 async function process(uid){
  const ref=lock(uid),time=now();
  const task=await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists||s.data().leaseUntil>time)return null;tx.update(ref,{leaseUntil:time+SETTLE});return s.data();});if(!task)return;
  try{
   try{await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
   await purge(uid);
   try{await auth.deleteUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
   if(time>=task.expiresAt){await db.collection('_session_revocations').doc(uid).delete();await ref.delete();return;}
   await ref.update({status:'draining',leaseUntil:0,nextRunAt:time<task.settleAt?task.settleAt:task.expiresAt});
  }catch(e){await ref.update({status:'pending',leaseUntil:0,nextRunAt:now()+60_000});throw e;}
 }
 async function resume(){const s=await db.collection('_account_deletions').where('nextRunAt','<=',now()).limit(20).get();let failures=0;for(const d of s.docs){try{await process(d.id);}catch(_){failures++;}}return{processed:s.size,failures};}
 async function handler(req,res){
  const user=await authenticate(req,res);if(!user)return;
  if(req.body?.confirmation!=='EXCLUIR')return res.status(400).json({error:'Confirme a exclusão da conta.'});
  const age=now()/1000-Number(user.auth_time);if(!Number.isFinite(age)||age>300||age< -60)return res.status(401).json({code:'auth/requires-recent-login',error:'Faça login novamente antes de excluir sua conta.'});
  if(!auth||!db)return res.status(503).json({error:'Serviço indisponível.'});
  try{
   await db.runTransaction(async tx=>{
    const profile=db.collection('usuarios').doc(user.uid),ref=lock(user.uid);const [s,prior]=await Promise.all([tx.get(profile),tx.get(ref)]);if(prior.exists)return;
    const data=s.data()||{},sub=data.mpSubscriptionId,local=emulator&&/^(LOCAL_TEST_|SANDBOX_TEST_)/.test(String(sub));
    if((sub&&!local)||['creating','unknown'].includes(data.mpCheckout?.state))throw Object.assign(Error('Cancele a assinatura ou conclua a conferência da contratação antes de excluir a conta.'),{status:409});
    const time=now();tx.set(ref,{status:'pending',requestedAt:time,settleAt:time+SETTLE,expiresAt:time+DRAIN,nextRunAt:time});
    if(s.exists)tx.update(profile,{_deletionPending:true,pushEnabled:false});
   });
   try{await process(user.uid);return res.json({ok:true,cleanup:'draining'});}catch(_){return res.status(202).json({ok:true,cleanup:'pending',message:'Conta bloqueada. A remoção será retomada automaticamente.'});}
  }catch(e){return res.status(e.status||503).json({error:e.status===409?e.message:'Não foi possível iniciar a exclusão. Tente novamente.'});}
 }
 return{handler,resume,purge,process};
}
function createDeleteAccount(options){return createAccountLifecycle(options).handler;}
module.exports={createAccountLifecycle,createDeleteAccount,TOKEN_DRAIN_MS:DRAIN,SETTLE_MS:SETTLE};

