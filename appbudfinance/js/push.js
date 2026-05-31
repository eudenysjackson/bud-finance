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

import { getMessaging, getToken, onMessage }
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

  // Limpar subscription antiga antes de pedir token:
  // subscription cacheada com VAPID diferente faz getToken travar indefinidamente.
  try {
    const oldSub = await swReg.pushManager.getSubscription();
    if (oldSub) await oldSub.unsubscribe();
  } catch (_) {}

  async function _getTokenOnce() {
    const tokenPromise = getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    const timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('[Push] getToken timeout 30s — verifique conexão e VAPID key')); }, 30000);
    });
    return Promise.race([tokenPromise, timeoutPromise]);
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
export function listenForeground(app, onNotif) {
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, onNotif);
  } catch (_) {
    // Não lança — listener em foreground não é crítico
  }
}
