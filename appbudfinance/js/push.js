// js/push.js — Bud Finance — Módulo de Notificações Push
// =============================================================================
// Módulo ES6 centralizado para registro e escuta de notificações FCM.
// Importado em configuracoes.js e dashboard.js.
//
// Estratégia:
//   Firebase localiza '/appbudfinance/firebase-messaging-sw.js' automaticamente
//   (arquivo nomeado conforme o padrão do Firebase SDK — nenhum registro manual
//   de SW necessário aqui).
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

  // 2. Registrar o Service Worker explicitamente no path correto.
  //    (Firebase SDK por padrão busca '/firebase-messaging-sw.js' na raiz do
  //    domínio, mas hospedamos em '/appbudfinance/' — então passamos a
  //    registration manualmente para o getToken.)
  const SW_PATH  = '/appbudfinance/firebase-messaging-sw.js';
  const SW_SCOPE = '/appbudfinance/';
  let swReg;
  try {
    swReg = await navigator.serviceWorker.register(SW_PATH, {
      scope: SW_SCOPE,
      updateViaCache: 'none'
    });
    // Aguardar o SW ficar ativo antes de prosseguir
    await navigator.serviceWorker.ready;
  } catch (err) {
    throw new Error('[Push] Falha ao registrar Service Worker: ' + err.message);
  }

  // 3. Obter token FCM (passando a SW registration explicitamente)
  const messaging = getMessaging(app);
  let token;
  try {
    token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg
    });
  } catch (err) {
    // Re-lança com contexto adicional para facilitar diagnóstico
    throw new Error('[Push] getToken falhou: ' + (err.code || '') + ' — ' + err.message);
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
