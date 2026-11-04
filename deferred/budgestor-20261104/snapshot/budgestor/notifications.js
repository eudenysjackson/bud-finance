import { getMessaging, getToken, onMessage, deleteToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js';
export function setupGestorNotifications(app,auth) {
  let timer,off,generation=0,deviceToken=null;
  const status=message=>{document.getElementById('gestorPushStatus').textContent=message;};
  async function api(path,method='GET',body) {
    const user=auth.currentUser;if(!user)throw Error('Entre no Bud Gestor.');
    const response=await fetch((window.BUD_FUNCTIONS_URL||'https://bud-finance-backend.onrender.com')+path,{method,headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Serviço indisponível.');return result;
  }
  async function refresh() {
    const current=generation;
    try {
      const {events}=await api('/api/gestor/events');if(current!==generation)return;
      const box=document.getElementById('gestorEvents');box.replaceChildren();
      if(!events.length){box.textContent='Nenhum evento registrado ainda.';return;}
      const labels={signup:'Novo cadastro',subscribed:'Assinatura confirmada',cancelled:'Assinatura cancelada'};
      for(const event of events){const item=document.createElement('div');item.style.cssText='padding:12px;margin-top:8px;border:1px solid #dbeafe;border-radius:12px;overflow-wrap:anywhere';item.textContent=`${event.product} · ${labels[event.type]||'Evento'}${event.plan?' · '+event.plan.toUpperCase():''} — ${event.name} · ${new Date(event.createdAt).toLocaleString('pt-BR')}`;box.append(item);}
    }catch(e){if(current===generation)document.getElementById('gestorEvents').textContent=e.message;}
  }
  async function register() {
    const owner=auth.currentUser?.uid;
    if(!owner)throw Error('Entre no Bud Gestor.');
    if(app.options.appId===window.BUD_FIREBASE_CONFIG.appId)throw Error('Configuração independente do Bud Gestor indisponível.');
    if(!await isSupported())throw Error('Este navegador não oferece push. No iPhone, abra o Bud Gestor instalado na tela inicial.');
    if(await Notification.requestPermission()!=='granted')throw Error('Permita notificações para receber os avisos.');
    const registration=await navigator.serviceWorker.register('/budgestor/sw.js',{scope:'/budgestor/',updateViaCache:'none'});
    await new Promise((resolve,reject)=>{if(registration.active)return resolve();const worker=registration.installing||registration.waiting;if(!worker)return reject(Error('Atualize a página e tente novamente.'));const timeout=setTimeout(()=>reject(Error('Ativação demorou. Tente novamente.')),15000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timeout);resolve();}});});
    deviceToken=await getToken(getMessaging(app),{vapidKey:window.BUD_FCM_VAPID_KEY,serviceWorkerRegistration:registration});
    if(auth.currentUser?.uid!==owner)throw Error('A sessão mudou. Entre novamente.');
    await api('/api/gestor/devices','POST',{token:deviceToken,consent:true});
    localStorage.setItem('budgestor:push:'+auth.currentUser.uid,'enabled');
    status('Avisos administrativos ativados neste dispositivo. Sua sessão no Bud Finance não foi alterada.');
  }
  async function unregister() {
    if(await isSupported()){
      const registration=await navigator.serviceWorker.getRegistration('/budgestor/');
      if(registration&&Notification.permission==='granted'){
        const token=deviceToken||await getToken(getMessaging(app),{vapidKey:window.BUD_FCM_VAPID_KEY,serviceWorkerRegistration:registration});
        try {if(token)await api('/api/gestor/devices','DELETE',{token});}
        finally {await deleteToken(getMessaging(app));deviceToken=null;}
      }
    }
    if(auth.currentUser)localStorage.removeItem('budgestor:push:'+auth.currentUser.uid);
    status('Avisos administrativos desativados neste dispositivo.');
  }
  document.getElementById('gestorEnablePush').onclick=()=>register().catch(e=>status(e.message));
  document.getElementById('gestorDisablePush').onclick=()=>unregister().catch(e=>status(e.message));
  function stop(){generation++;clearInterval(timer);off?.();off=null;document.getElementById('gestorEvents').replaceChildren();}
  async function start(){stop();const current=generation;refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);if(await isSupported()){if(current!==generation)return;off=onMessage(getMessaging(app),payload=>{status(payload.data?.title||'Novo evento administrativo.');refresh();});if(Notification.permission==='granted'&&localStorage.getItem('budgestor:push:'+auth.currentUser.uid)==='enabled')register().catch(e=>status(e.message));}}
  return{start,stop,unregister};
}
