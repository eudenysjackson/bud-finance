import { getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
export function observeProfile({auth,db,watchAuth,watchProfile,profileRef,apply}) {
 let stopProfile=null,epoch=0;
 const stopAuth=watchAuth(auth,user=>{
  const current=++epoch;stopProfile?.();stopProfile=null;
  if(!user)return;
  stopProfile=watchProfile(profileRef(db,'usuarios',user.uid),snap=>{
   if(current!==epoch||!snap.exists())return;
   const data=snap.data();apply({photoURL:data.photoURL||null,nome:data.nome||user.displayName||'Usuário',revoked:data.pushConsentRevoked===true});
  },()=>console.warn('[Perfil] Não foi possível sincronizar o perfil.'));
 });
 return ()=>{epoch++;stopProfile?.();stopAuth();};
}
function start(){
 const app=getApps()[0];if(!app||!document.getElementById('sidebarAvatar'))return;
 observeProfile({auth:getAuth(app),db:getFirestore(app),watchAuth:onAuthStateChanged,watchProfile:onSnapshot,profileRef:doc,apply:profile=>{
  window.budAplicarFotoSidebar?.(profile.photoURL,profile.nome);
  const name=document.getElementById('sidebarUserName');if(name)name.textContent=profile.nome;
  window.BUD_PUSH_CONSENT_REVOKED=profile.revoked;
 }});
}
if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});

