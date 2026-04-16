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
    apiKey:            "AIzaSyCQTUUZqlentDVWc4nJUubmNSu5ucdn5Jw",
    authDomain:        "meuappfinancas-982ea.firebaseapp.com",
    projectId:         "meuappfinancas-982ea",
    storageBucket:     "meuappfinancas-982ea.firebasestorage.app",
    messagingSenderId: "620239464929",
    appId:             "1:620239464929:web:2bc6aa2c45c33932f28aa0"
  };

  // Validate — fail fast if placeholders are still present
  const placeholders = Object.entries(config).filter(([, v]) => v.startsWith('__'));
  if (placeholders.length > 0) {
    console.warn(
      '[Bud Finance] Firebase config contains placeholders. ' +
      'Replace them in js/firebase-config.js before deploying.'
    );
  }

  // ─── Cloud Functions URL ──────────────────────────────────────────────
  // Base URL for Firebase Cloud Functions (used by recuperar-senha, etc.)
  window.BUD_FUNCTIONS_URL = "__CLOUD_FUNCTIONS_URL__";

  // ─── EmailJS protected config ─────────────────────────────────────────
  // In production, move email sending to a Cloud Function (server-side).
  // These are kept here as placeholders for the client-side fallback.
  window.BUD_EMAILJS_CONFIG = Object.freeze({
    publicKey:  "H6fMBL3s0Npuw8OO0e",
    serviceId:  "service_tg3mlvh",
    templates: Object.freeze({
      boasVindas:     "template_pdch2ip",
      recuperarSenha: "template_2mp7qgq"
    })
  });

  // ─── reCAPTCHA v3 site key ────────────────────────────────────────────
  window.BUD_RECAPTCHA_SITE_KEY = "__RECAPTCHA_SITE_KEY__";

  // Expose Firebase config as a frozen object
  window.BUD_FIREBASE_CONFIG = Object.freeze(config);
})();
