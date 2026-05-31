// firebase-messaging-sw.js — Bud Finance Service Worker
// =============================================================================
// ATENÇÃO: Este arquivo usa Firebase Compat SDK propositalmente.
// Service Workers não suportam ES Modules de forma confiável em Safari/Firefox.
// Isso é uma exceção obrigatória à regra "NUNCA SDK Compat" do projeto.
// Referência: DECISIONS_LOG.md → DEC-050
// =============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyButVkGdicSWMBSeNJCfO01DQ3HXQR1O3Q',
  authDomain:        'bud-finance.firebaseapp.com',
  projectId:         'bud-finance',
  storageBucket:     'bud-finance.firebasestorage.app',
  messagingSenderId: '825768884924',
  appId:             '1:825768884924:web:551a6da252d8d249dd2eb9'
});

var messaging = firebase.messaging();

// ── Notificações recebidas com app em background / tela bloqueada ──────────
messaging.onBackgroundMessage(function (payload) {
  var d = payload.data         || {};
  var n = payload.notification || {};   // fallback para mensagens com campo notification
  var title   = d.title   || n.title || 'Bud Finance';
  var body    = d.body    || n.body  || '';
  var url     = d.url     || n.click_action || './dashboard.html';
  var tag     = d.tag     || 'bud-notif-' + Date.now();
  var actions = [];
  try { if (d.actions) actions = JSON.parse(d.actions); } catch (_) {}

  return self.registration.showNotification(title, {
    body:     body,
    icon:     './icons/icon-192.png',
    badge:    './icons/icon-192.png',
    data:     { url: url },
    vibrate:  [200, 100, 200],
    tag:      tag,
    renotify: true,
    actions:  actions.length ? actions : [{ action: 'open', title: 'Abrir app' }]
  });
});

// ── Click em notificação ──────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : './dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      // Se o app já está aberto, focar e navegar
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf('appbudfinance') !== -1 && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      // Caso contrário, abrir nova janela
      return clients.openWindow(url);
    })
  );
});

// ── Lifecycle ─────────────────────────────────────────────────────────────
self.addEventListener('install',  function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(clients.claim()); });
