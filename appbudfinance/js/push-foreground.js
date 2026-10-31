// Alertas do sistema também quando outra tela do app está aberta.
import { getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { listenForeground, showForegroundNotification } from './push.js';
function start() {
  const app = getApps()[0];
  if (!app || typeof Notification === 'undefined') return;
  onAuthStateChanged(getAuth(app), user => {
    if (user && Notification.permission === 'granted') listenForeground(app, showForegroundNotification);
  });
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
