const crypto=require('node:crypto');
function createSecurityGuard({auth,db,secret,now=Date.now,maxRequests=300}){
 return async(req,res,next)=>{
  if(req.path==='/api/ping')return next();
  if(!req.path.startsWith('/api/')&&!req.path.startsWith('/mercadopago/')&&!['/reset-senha','/admin-register'].includes(req.path))return next();
  if(!auth||!db)return next();
  try{
   const header=String(req.headers.authorization||'');
   if(header.startsWith('Bearer ')){
    const user=await auth.verifyIdToken(header.slice(7),true);
    if((await db.collection('_account_deletions').doc(user.uid).get()).exists)return res.status(403).json({error:'Conta em encerramento.'});
    req.budUser=user;
   }
  }catch(_){return res.status(401).json({error:'Sessão inválida. Entre novamente.'});}
  if(!secret)return res.status(503).json({error:'Proteção temporariamente indisponível.'});
  try{
   const key=crypto.createHmac('sha256',secret).update(req.budUser ? 'uid:'+req.budUser.uid : 'peer:'+String(req.socket?.remoteAddress||req.ip||'unknown')).digest('hex');
   const ref=db.collection('_security_limits').doc(key),time=now();
   const allowed=await db.runTransaction(async tx=>{
    const s=await tx.get(ref),old=s.data()||{},fresh=!old.expiresAt||old.expiresAt<=time;
    const count=fresh?1:Number(old.count||0)+1;
    if(count>maxRequests)return false;
    tx.set(ref,{count,expiresAt:fresh?time+60_000:old.expiresAt});return true;
   });
   if(!allowed){res.setHeader('Retry-After','60');return res.status(429).json({error:'Muitas solicitações. Aguarde um minuto.'});}
   next();
  }catch(_){return res.status(503).json({error:'Proteção temporariamente indisponível.'});}
 };
}
async function pruneSecurityLimits(db,now=Date.now){
 const s=await db.collection('_security_limits').where('expiresAt','<=',now()).limit(200).get();
 if(s.empty)return;const batch=db.batch();for(const d of s.docs)batch.delete(d.ref);await batch.commit();
}
module.exports={createSecurityGuard,pruneSecurityLimits};

