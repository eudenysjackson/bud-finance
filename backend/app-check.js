function createAppCheckGuard({verify,appIds=[],mode='off',timeoutMs=1500}={}){
  const stats={valid:0,missing:0,invalid:0};
  const supported=new Set(['off','observe','enforce']);
  if(!supported.has(mode))throw Error('Invalid App Check mode');
  // Enforcement is opt-in and requires an explicit application allowlist.
  if(mode==='enforce'&&(!verify||!appIds.length))throw Error('App Check enforcement requires verifier and app IDs');
  return {stats,async middleware(req,res,next){
    if(mode==='off')return next();
    const protectedPath=req.path==='/api/financial/write'||/^\/api\/(extrair|ler|analisar|ia\/jobs)/.test(req.path);
    if(!protectedPath)return next();
    const token=req.headers['x-firebase-appcheck'];let status=token?'invalid':'missing';
    if(typeof token==='string'&&token.length<=8192){let timer;try{
      const claims=await Promise.race([verify(token),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('App Check timeout')),timeoutMs);})]);
      status=claims?.appId&&(!appIds.length||appIds.includes(claims.appId))?'valid':'invalid';
    }catch(_){status='invalid';}finally{clearTimeout(timer);}}
    stats[status]=Math.min(Number.MAX_SAFE_INTEGER,stats[status]+1);req.budAppCheck=status;
    if(mode==='enforce'&&status!=='valid')return res.status(401).json({code:'APP_CHECK_REQUIRED',error:'Atualize o aplicativo e tente novamente.'});
    next();
  }};
}
module.exports={createAppCheckGuard};
