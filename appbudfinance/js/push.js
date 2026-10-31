// js/push.js — Bud Finance — Módulo de Notificações Push
// =============================================================================
// Módulo ES6 centralizado para registro e escuta de notificações FCM.
// Importado em configuracoes.js e dashboard.js.
//
// Estratégia:
//   SW registrado manualmente com path RELATIVO ao HTML
//   ('firebase-messaging-sw.js'), funcionando em prod (budsolucoes.com.br/appbudfinance/)
//   e em dev local (live-server na pasta appbudfinance/ servida como root).
//
// Referência: DECISIONS_LOG.md → DEC-050 (SW usa Compat SDK)
// =============================================================================

import { getMessaging, getToken, onMessage, deleteToken }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js';

// ─── Constantes ─────────────────────────────────────────────────────────────
const LS_KEY = 'bud_push_asked'; // 'granted' | 'denied' | ausente

// ─── registerPushToken ───────────────────────────────────────────────────────
/**
 * Solicita permissão de notificação (se ainda não concedida), obtém o token FCM
 * e salva no backend.
 *
 * Firebase localiza firebase-messaging-sw.js automaticamente; não é necessário
 * passar serviceWorkerRegistration.
 *
 * @param {FirebaseApp} app
 * @param {import('firebase/auth').User} user  — Firebase Auth user autenticado
 * @returns {Promise<string>} token FCM registrado
 * @throws {Error} com mensagem descritiva em caso de falha
 */
export async function registerPushToken(app, user) {
  const vapidKey = window.BUD_FCM_VAPID_KEY;

  // Guard: VAPID key precisa estar configurada
  if (!vapidKey || vapidKey.startsWith('__')) {
    throw new Error('[Push] BUD_FCM_VAPID_KEY não configurado.');
  }

  // Guard: browser precisa suportar as APIs necessárias
  if (!('Notification'    in window))    throw new Error('[Push] Browser não suporta Notifications API.');
  if (!('serviceWorker'   in navigator)) throw new Error('[Push] Browser não suporta Service Worker.');
  if (!('PushManager'     in window))    throw new Error('[Push] Browser não suporta Push API.');

  // 1. Solicitar permissão nativa (só pergunta se ainda for 'default')
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') {
    throw new Error('[Push] Permissão de notificação negada. Verifique as configurações do navegador.');
  }

  // 2. Registrar o Service Worker com path relativo e aguardar via
  //    navigator.serviceWorker.ready (forma nativa — evita race condition).
  let swReg;
  try {
    await navigator.serviceWorker.register('firebase-messaging-sw.js', {
      updateViaCache: 'none'
    });
    swReg = await navigator.serviceWorker.ready;
  } catch (err) {
    throw new Error('[Push] Falha ao registrar Service Worker: ' + err.message);
  }

  // 3. Obter token FCM
  const messaging = getMessaging(app);
  let token;

  async function _getTokenOnce() {
    let timeoutId;
    const tokenPromise = getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    const timeoutPromise = new Promise(function (_, reject) {
      timeoutId = setTimeout(function () { reject(new Error('[Push] getToken timeout 30s — verifique conexão e VAPID key')); }, 30000);
    });
    try { return await Promise.race([tokenPromise, timeoutPromise]); }
    finally { clearTimeout(timeoutId); }
  }
  try {
    token = await _getTokenOnce();
  } catch (err) {
    throw new Error('[Push] getToken falhou: ' + ((err && err.code) || '') + ' — ' + ((err && err.message) || err));
  }

  if (!token) {
    throw new Error('[Push] getToken retornou vazio. Verifique VAPID key e firebase-messaging-sw.js.');
  }

  // 4. Salvar token no backend
  const idToken = await user.getIdToken();
  const baseUrl = (window.BUD_FUNCTIONS_URL || '').replace(/\/$/, '');

  const res = await fetch(baseUrl + '/api/push/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + idToken
    },
    body: JSON.stringify({ token, platform: 'web' })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error('[Push] Backend retornou ' + res.status + ': ' + (body.error || 'erro desconhecido'));
  }

  // Marca localmente que o usuário já concedeu permissão
  try { localStorage.setItem(LS_KEY, 'granted'); } catch (_) {}

  return token;
}

// ─── listenForeground ────────────────────────────────────────────────────────
/**
 * Registra listener para mensagens recebidas com o app em foreground (tela aberta).
 * Chame uma vez por sessão, após o usuário ter ativado as notificações.
 *
 * @param {FirebaseApp} app
 * @param {function(import('firebase/messaging').MessagePayload): void} onNotif
 */
const foregroundListeners = new WeakMap();
export async function showForegroundNotification(payload) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const data = payload.data || payload.notification || {};
  const registration = await navigator.serviceWorker.getRegistration(new URL('firebase-messaging-sw.js', window.location.href).href);
  if (!registration) return;
  const base = new URL('./', window.location.href);
  const target = new URL(data.url || 'dashboard.html', base);
  const url = target.origin === base.origin && target.pathname.startsWith(base.pathname) ? target.href : new URL('dashboard.html', base).href;
  await registration.showNotification(data.title || 'Bud Finance', {
    body: data.body || '', icon: new URL('icons/icon-192.png', base).href,
    tag: data.tag || payload.messageId || 'bud-finance', data: { url }
  });
}
export function listenForeground(app, onNotif) {
  try {
    const messaging = getMessaging(app);
    foregroundListeners.get(app)?.();
    foregroundListeners.set(app, onMessage(messaging, onNotif));
  } catch (_) {
    // Não lança — listener em foreground não é crítico
  }
}

// ─── revokePushToken — PEND-002 ──────────────────────────────────────────────
/**
 * Revoga o token FCM do dispositivo atual: remove do browser e limpa no backend.
 * Deve ser chamado antes de signOut().
 *
 * @param {FirebaseApp} app
 * @param {import('firebase/auth').User} user
 */
export async function revokePushToken(app, user) {
  try {
    let currentToken = null;
    const registration = await navigator.serviceWorker?.getRegistration(new URL('firebase-messaging-sw.js', window.location.href).href);
    if (registration && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      currentToken = await getToken(getMessaging(app), { vapidKey: window.BUD_FCM_VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => null);
    }
    // 1. Deletar token no browser (FCM)
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      const messaging = getMessaging(app);
      await deleteToken(messaging).catch(() => {});
    }

    // 2. Limpar token no backend (Firestore via server)
    const idToken = await user.getIdToken().catch(() => null);
    if (idToken && currentToken) {
      const baseUrl = (window.BUD_FUNCTIONS_URL || '').replace(/\/$/, '');
      await fetch(baseUrl + '/api/push/token', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + idToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken })
      }).catch(() => {});
    }

    // 3. NÃO limpar flag local (bud_push_asked): a preferência do usuário
    //    sobre notificações é persistente no dispositivo. Apenas o token
    //    FCM precisa ser revogado — o usuário não deve ser perguntado de
    //    novo apenas porque fez logout/login.
  } catch (_) {
    // Revogação não é crítica — não impede logout
  }
}
