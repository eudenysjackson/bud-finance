// bud-utils.js — Bud Finance global utilities
// Exposes: window.budShowToast(message, type)

(function () {
  'use strict';

  // ─── Toast container (created once, reused) ──────────────────────────
  let toastContainer = null;

  function ensureContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'bud-toast-container';
    toastContainer.style.cssText =
      'position:fixed;top:1rem;right:1rem;z-index:99999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  // ─── Color map ────────────────────────────────────────────────────────
  const TOAST_STYLES = {
    success: { bg: '#10b981', icon: '✓' },
    error:   { bg: '#ef4444', icon: '✕' },
    warning: { bg: '#f59e0b', icon: '!' },
    info:    { bg: '#3b82f6', icon: 'i' }
  };

  /**
   * Show a toast notification.
   * @param {string} message  — Text to display (will be escaped)
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} [duration=3500] — ms before auto-dismiss
   */
  function budShowToast(message, type, duration) {
    if (typeof type !== 'string') type = 'info';
    type = type.toLowerCase();
    duration = typeof duration === 'number' ? duration : 3500;

    const style = TOAST_STYLES[type] || TOAST_STYLES.info;
    const container = ensureContainer();
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim() || '#2563eb';

    const toast = document.createElement('div');
    toast.style.cssText =
      'pointer-events:auto;display:flex;align-items:center;gap:0.625rem;' +
      'padding:0.75rem 1.125rem;border-radius:0.75rem;color:#fff;font-size:0.875rem;' +
      'font-weight:600;font-family:Inter,system-ui,sans-serif;' +
      'box-shadow:0 10px 25px -5px rgba(0,0,0,0.15);min-width:220px;max-width:380px;' +
      'opacity:0;transform:translateX(1rem);transition:opacity .3s,transform .3s;' +
      'border-left:3px solid ' + accent + ';' +
      'background:' + style.bg + ';';

    // Icon badge
    const badge = document.createElement('span');
    badge.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;' +
      'border-radius:50%;background:rgba(255,255,255,0.25);font-size:0.7rem;font-weight:800;flex-shrink:0;';
    badge.textContent = style.icon;

    // Message (text-only, safe against XSS)
    const msg = document.createElement('span');
    msg.textContent = message;

    toast.appendChild(badge);
    toast.appendChild(msg);
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto-dismiss
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(1rem)';
      setTimeout(function () { toast.remove(); }, 350);
    }, duration);
  }

  // ─── Sanitize helper ─────────────────────────────────────────────────
  /**
   * Sanitize a string by stripping HTML tags and trimming.
   * Use on all user inputs before sending to Firestore.
   * @param {string} str
   * @returns {string}
   */
  function budSanitize(str) {
    if (typeof str !== 'string') return '';
    // Remove any HTML/script tags
    var clean = str.replace(/<[^>]*>/g, '');
    // Collapse whitespace and trim
    return clean.replace(/\s+/g, ' ').trim();
  }

  // ─── Common weak passwords blocklist ───────────────────────────────
  var BUD_SENHAS_COMUNS = [
    '123456','12345678','123456789','1234567890','password','qwerty',
    '111111','abc123','000000','654321','admin','welcome','abcdef',
    'senha123','mudar123','trocar123'
  ];

  // ─── Password strength calculator ────────────────────────────────────
  function budCalcStrength(pw) {
    var s = 0;
    if (pw.length >= 6)  s++;
    if (pw.length >= 8)  s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  // ─── Exports ──────────────────────────────────────────────────────────
  window.budShowToast  = budShowToast;
  window.budSanitize   = budSanitize;
  window.budCalcStrength  = budCalcStrength;
  window.BUD_SENHAS_COMUNS = BUD_SENHAS_COMUNS;
})();
