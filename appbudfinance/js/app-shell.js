// Rotas públicas sem extensão; links antigos continuam válidos no GitHub Pages.
(function(){
 'use strict';
 function cleanURL(value){const u=new URL(value,location.href);if(u.origin!==location.origin||!u.pathname.startsWith('/appbudfinance/'))return u.href;u.pathname=u.pathname.replace(/\/index\.html$/,'/').replace(/\.html$/,'');return u.href;}
 window.budCleanURL=cleanURL;
 window.BUD_PAGE_FILE=location.pathname.split('/').pop()||'index.html';
 if(!window.BUD_PAGE_FILE.includes('.'))window.BUD_PAGE_FILE+='.html';
 const clean=cleanURL(location.href);if(clean!==location.href)history.replaceState(history.state,'',clean);
 document.addEventListener('click',function(event){const a=event.target.closest?.('a[href]');if(a&&!a.hasAttribute('download'))a.href=cleanURL(a.href);},true);
 function ready(){
  const date=document.getElementById('welcomeDate');if(date)date.textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const month=document.getElementById('navMesAno');if(month&&/carregando/i.test(month.textContent))month.textContent=new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
