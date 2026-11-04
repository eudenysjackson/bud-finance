const crypto = require('node:crypto');
function createGestorAPI({db,auth,now=Date.now}) {
  async function authorize(req,res) {
    const user=req.budUser;
    if(!user?.email_verified) {res.status(403).json({error:'Entre com uma conta administrativa verificada.'});return null;}
    const role=await db.collection('admins').doc(user.uid).get();
    if(!role.exists || role.data().role!=='admin'){res.status(403).json({error:'Acesso administrativo necessário.'});return null;}
    return user;
  }
  async function devices(req,res) {
    try {
      const user=await authorize(req,res);if(!user)return;
      const token=req.body?.token;
      if(typeof token!=='string'||token.length<20||token.length>4096)return res.status(400).json({error:'Dispositivo inválido.'});
      const id=crypto.createHash('sha256').update(token).digest('hex');
      const ref=db.collection('_gestor_devices').doc(user.uid);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref),data=snap.data()||{},tokens={...(data.tokens||{})};
        if(req.method==='DELETE')delete tokens[id];
        else {if(req.body.consent!==true)return;tokens[id]={token,registeredAt:now()};if(Object.keys(tokens).length>20)throw Error('device-limit');}
        tx.set(ref,{tokens,updatedAt:now()});
      });
      if(req.method!=='DELETE'&&req.body.consent!==true)return res.status(400).json({error:'Autorize os avisos neste dispositivo.'});
      return res.json({ok:true});
    } catch(_){return res.status(503).json({error:'Não foi possível atualizar o dispositivo.'});}
  }
  async function events(req,res) {
    try {
      if(!await authorize(req,res))return;
      const snap=await db.collectionGroup('_owner_events').orderBy('createdAt','desc').limit(50).get();
      const events=[];
      for(const event of snap.docs){
        const data=event.data(),profile=await event.ref.parent.parent.get();
        if(!profile.exists)continue;
        events.push({id:event.id,product:'Bud Finance',type:data.type,plan:data.plan,createdAt:data.createdAt,name:String(profile.data().nome||'Cliente').slice(0,100),uid:profile.id});
      }
      res.json({events});
    }catch(_){res.status(503).json({error:'Não foi possível carregar os eventos.'});}
  }
  return {devices,events};
}
module.exports={createGestorAPI};
