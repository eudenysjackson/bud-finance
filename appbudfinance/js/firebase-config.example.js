// firebase-config.example.js — Bud Finance
// Arquivo de TEMPLATE — pode ser commitado no repositório.
// Para uso local: copie este arquivo para js/firebase-config.js e preencha os valores reais.
// Em produção: o script inject-env.sh substitui os placeholders automaticamente via variáveis de ambiente.
// NUNCA commite js/firebase-config.js com valores reais.

(function () {
  'use strict';

  // ─── Firebase ─────────────────────────────────────────────────────────
  // Variáveis de ambiente esperadas: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN,
  // FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
  const config = {
    apiKey:            "__FIREBASE_API_KEY__",
    authDomain:        "__FIREBASE_AUTH_DOMAIN__",
    projectId:         "__FIREBASE_PROJECT_ID__",
    storageBucket:     "__FIREBASE_STORAGE_BUCKET__",
    messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
    appId:             "__FIREBASE_APP_ID__"
  };

  // Validate — fail fast if placeholders are still present
  const placeholders = Object.entries(config).filter(([, v]) => v.startsWith('__'));
  if (placeholders.length > 0) {
    console.warn(
      '[Bud Finance] Firebase config contains placeholders. ' +
      'Replace them in js/firebase-config.js before deploying.'
    );
  }

  // ─── Backend URL ──────────────────────────────────────────────────────
  // Variável de ambiente: BACKEND_URL (ex: https://bud-finance-backend.onrender.com)
  window.BUD_FUNCTIONS_URL = "__BACKEND_URL__";

  // ─── EmailJS ───────────────────────────────────────────────────────────
  // Usado no cadastro (email de boas-vindas). Reset de senha é server-side.
  // Variáveis: EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID,
  //            EMAILJS_TEMPLATE_BOAS_VINDAS, EMAILJS_TEMPLATE_RECUPERAR_SENHA
  window.BUD_EMAILJS_CONFIG = Object.freeze({
    publicKey:  "__EMAILJS_PUBLIC_KEY__",
    serviceId:  "__EMAILJS_SERVICE_ID__",
    templates: Object.freeze({
      boasVindas:     "__EMAILJS_TEMPLATE_BOAS_VINDAS__",
      recuperarSenha: "__EMAILJS_TEMPLATE_RECUPERAR_SENHA__"
    })
  });

  // ─── reCAPTCHA v3 ─────────────────────────────────────────────────────
  // Variável de ambiente: RECAPTCHA_SITE_KEY
  window.BUD_RECAPTCHA_SITE_KEY = "__RECAPTCHA_SITE_KEY__";

  // ─── FCM Web Push VAPID Key ──────────────────────────────────────────────
  // Chave pública do FCM Web Push — segura para expor no client.
  // Obter em: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
  window.BUD_FCM_VAPID_KEY = 'BPoKCYZJukhQbcnO7xUbUQJ_RJC4Q1vgcJfscmHlgnnvz_qP7vkuacOnuAUNqCZjYfKigs6bcosO8xg5NQ66dA4';

  window.BUD_FIREBASE_CONFIG = Object.freeze(config);
})();
