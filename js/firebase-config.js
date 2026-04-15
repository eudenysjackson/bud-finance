// firebase-config.js — Bud Finance
// Firebase configuration loaded from environment / protected config.
// In production, these values should be injected via a build step or server-side template.
// NEVER commit real API keys to version control.

(function () {
  'use strict';

  // ─── Placeholder config ─────────────────────────────────────────────
  // Replace these values with your actual Firebase project credentials.
  // For local development you can fill them in directly.
  // For production, inject via CI/CD environment variables or server-side rendering.
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

  // Expose as a frozen object on window so other modules can consume it
  window.BUD_FIREBASE_CONFIG = Object.freeze(config);
})();
