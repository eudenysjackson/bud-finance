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
    apiKey:            "__FIREBASE_API_KEY__",
    authDomain:        "__PROJECT_ID__.firebaseapp.com",
    projectId:         "__PROJECT_ID__",
    storageBucket:     "__PROJECT_ID__.firebasestorage.app",
    messagingSenderId: "__MESSAGING_SENDER_ID__",
    appId:             "__APP_ID__"
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
  window.BUD_FUNCTIONS_URL = "__BACKEND_URL__";

  // ─── EmailJS protected config ─────────────────────────────────────────
  // In production, move email sending to a Cloud Function (server-side).
  // These are kept here as placeholders for the client-side fallback.
  window.BUD_EMAILJS_CONFIG = Object.freeze({
    publicKey:  "__EMAILJS_PUBLIC_KEY__",
    serviceId:  "__EMAILJS_SERVICE_ID__",
    templates: Object.freeze({
      boasVindas:     "__EMAILJS_TEMPLATE_BOAS_VINDAS__",
      recuperarSenha: "__EMAILJS_TEMPLATE_RECUPERAR_SENHA__"
    })
  });

  // ─── reCAPTCHA v3 site key ────────────────────────────────────────────
  window.BUD_RECAPTCHA_SITE_KEY = "__RECAPTCHA_SITE_KEY__";

  // Expose Firebase config as a frozen object
  window.BUD_FIREBASE_CONFIG = Object.freeze(config);
})();
