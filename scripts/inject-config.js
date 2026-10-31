const fs=require('node:fs'),path=require('node:path');
const required=['FIREBASE_API_KEY','FIREBASE_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_STORAGE_BUCKET','FIREBASE_MESSAGING_SENDER_ID','FIREBASE_APP_ID','BACKEND_URL'];
function buildConfig(template,env){
  const values=Object.fromEntries(Object.entries(env).filter(([,value])=>typeof value==='string').map(([key,value])=>[key,value.trim()]));
  const missing=required.filter(key=>!values[key]);if(missing.length)throw Error('Variáveis ausentes: '+missing.join(', '));
  for(const key of required)if(/[\r\n]/.test(values[key]))throw Error('Configuração inválida em '+key);
  const backend=new URL(values.BACKEND_URL);if(backend.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(backend.hostname))throw Error('BACKEND_URL precisa usar HTTPS.');
  values.BACKEND_URL=values.BACKEND_URL.replace(/\/$/,'');
  let result=template.replace(/"__([A-Z0-9_]+)__"/g,(_,key)=>JSON.stringify(values[key]||''));
  if(values.FCM_VAPID_KEY)result=result.replace(/window\.BUD_FCM_VAPID_KEY\s*=\s*'[^']*';/,()=> 'window.BUD_FCM_VAPID_KEY = '+JSON.stringify(values.FCM_VAPID_KEY)+';');
  return result;
}
if(require.main===module){const root=path.resolve(__dirname,'..');const template=fs.readFileSync(path.join(root,'appbudfinance/js/firebase-config.example.js'),'utf8');fs.writeFileSync(path.join(root,'appbudfinance/js/firebase-config.js'),buildConfig(template,process.env));console.log('Configuração pública gerada e validada, sem exibir valores.');}
module.exports={buildConfig};
