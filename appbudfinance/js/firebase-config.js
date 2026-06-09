// firebase-config.js — Bud Finance
// Firebase configuration loaded from environment / protected config.
// In production, these values should be injected via a build step or server-side template.
// NEVER commit real API keys to version control.

(function () {
  'use strict';

  // ─── Firebase placeholder config ─────────────────────────────────────
  // Replace these values with your actual Firebase project credentials.
  // For local development you can fill them in directly.
  // For production, inject via CI/CD environment variables or server-side rendering.
  const config = {
    apiKey:            "AIzaSyButVkGdicSWMBSeNJCfO01DQ3HXQR1O3Q",
    authDomain:        "bud-finance.firebaseapp.com",
    projectId:         "bud-finance",
    storageBucket:     "bud-finance.firebasestorage.app",
    messagingSenderId: "825768884924",
    appId:             "1:825768884924:web:551a6da252d8d249dd2eb9"
  };

  // Validate — fail fast if placeholders are still present
  const placeholders = Object.entries(config).filter(([, v]) => v.startsWith('__'));
  if (placeholders.length > 0) {
    console.warn(
      '[Bud Finance] Firebase config contains placeholders. ' +
      'Replace them in js/firebase-config.js before deploying.'
    );
  }

  // ─── Detecção de ambiente (local vs produção) ─────────────────────────
  var _hostname = window.location.hostname;
  var _isLocal  = (_hostname === 'localhost' || _hostname === '127.0.0.1' || _hostname === '');
  window.BUD_IS_LOCAL = _isLocal;

  // ─── Emulator: ativado APENAS via localStorage explícito ────────────
  // Emulators NÃO são ativados por padrão — precisam ser explicitamente habilitados.
  // Para usar emulators locais (requer `npm run emulators` rodando):
  //   localStorage.setItem('bud_use_emulator', 'true')   → ativa emulators
  //   localStorage.removeItem('bud_use_emulator')         → volta para produção
  var _emulatorOverride = null;
  try { _emulatorOverride = localStorage.getItem('bud_use_emulator'); } catch (_) {}
  window.BUD_USE_EMULATOR = _emulatorOverride === 'true';

  // ─── Cloud Functions URL ──────────────────────────────────────────────
  window.BUD_FUNCTIONS_URL = (window.BUD_USE_EMULATOR && _isLocal)
    ? 'http://127.0.0.1:5001/bud-finance/us-central1'
    : 'https://bud-finance-backend.onrender.com';

  // ─── EmailJS protected config ─────────────────────────────────────────
  // In production, move email sending to a Cloud Function (server-side).
  // These are kept here as placeholders for the client-side fallback.
  window.BUD_EMAILJS_CONFIG = Object.freeze({
    publicKey:  "H6fMBL3s0Npuw8O0e",
    serviceId:  "service_tg3mlvh",
    templates: Object.freeze({
      boasVindas:     "template_pdch2ip",
      recuperarSenha: "template_2mp7qgq"
    })
  });

  // ─── reCAPTCHA v3 site key ────────────────────────────────────────────
  window.BUD_RECAPTCHA_SITE_KEY = "__RECAPTCHA_SITE_KEY__";

  // ─── FCM Web Push VAPID Key ──────────────────────────────────────────────
  // Para ativar push notifications:
  //   1. Acesse Firebase Console → Project Settings → Cloud Messaging
  //   2. Em "Web Push certificates", clique em "Generate key pair"
  //   3. Copie o valor da chave e substitua abaixo
  window.BUD_FCM_VAPID_KEY = 'BI068YABPMnualEC3exPyfCdgPjoAhIIznZ94JNEvEWyaSB1NWQGsfpJ0zZ4v3rDghMceaubWxhIG3mJfbLRFkQ';

  // Expose Firebase config as a frozen object
  window.BUD_FIREBASE_CONFIG = Object.freeze(config);
})();
