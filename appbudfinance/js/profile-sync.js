import { getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
export function observeProfile({auth,db,watchAuth,watchProfile,profileRef,apply}) {
 let stopProfile=null,epoch=0;
 const stopAuth=watchAuth(auth,user=>{
  const current=++epoch;stopProfile?.();stopProfile=null;
  if(!user)return;
  apply({nome:user.displayName||'Usuário',photoURL:user.photoURL||null,email:user.email||'',creationTime:user.metadata?.creationTime,pending:true});
  stopProfile=watchProfile(profileRef(db,'usuarios',user.uid),snap=>{
   if(current!==epoch||!snap.exists())return;
   const data=snap.data();apply({photoURL:data.photoURL||null,nome:data.nome||user.displayName||'Usuário',email:data.email||user.email||'',matricula:data.matricula||'',revoked:data.pushConsentRevoked===true});
  },()=>console.warn('[Perfil] Não foi possível sincronizar o perfil.'));
 });
 return ()=>{epoch++;stopProfile?.();stopAuth();};
}
let bootRetries=0;
function start(){
 const app=getApps()[0];if(!app){if(bootRetries++<100)setTimeout(start,100);return;}if(!document.getElementById('sidebarAvatar'))return;
 observeProfile({auth:getAuth(app),db:getFirestore(app),watchAuth:onAuthStateChanged,watchProfile:onSnapshot,profileRef:doc,apply:profile=>{
  window.budAplicarFotoSidebar?.(profile.photoURL,profile.nome);
  const name=document.getElementById('sidebarUserName');if(name)name.textContent=profile.nome;
  const id=document.getElementById('sidebarUserId');if(id)id.textContent=profile.matricula||profile.email||'—';
  const display=document.getElementById('avatarNomeExibido');if(display)display.textContent=profile.nome;
  if(profile.pending){const email=document.getElementById('perfilEmail');if(email)email.textContent=profile.email||'—';const date=document.getElementById('perfilCriacao');if(date&&profile.creationTime)date.textContent=new Date(profile.creationTime).toLocaleDateString('pt-BR');}
  if(!profile.pending)window.BUD_PUSH_CONSENT_REVOKED=profile.revoked;
 }});
}
if(document.readyState!=='loading')start();else document.addEventListener('DOMContentLoaded',start,{once:true});

