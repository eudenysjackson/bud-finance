importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');
importScripts('/budgestor/config.js');
firebase.initializeApp(self.BUD_GESTOR_FIREBASE_CONFIG);


firebase.messaging().onBackgroundMessage(payload=>{const d=payload.data||{};return self.registration.showNotification(d.title||'Bud Gestor',{body:d.body||'Novo evento administrativo.',tag:d.tag||'bud-gestor',icon:'/appbudfinance/logo.png',data:{url:'/budgestor/'}});});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const target=new URL('/budgestor/',self.location.origin).href;const found=list.find(c=>c.url.startsWith(target));return found?found.focus():clients.openWindow(target);}));});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
