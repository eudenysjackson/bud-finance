// bud-utils.js — Bud Finance global utilities
// Exposes: window.budShowToast(message, type)

(function () {
  'use strict';

  // ─── Feature flags ────────────────────────────────────────────────────
  // Para reativar WhatsApp: trocar whatsapp para true e remover este bloco
  // de CSS abaixo. Backend e demais arquivos seguem intactos.
  window.BUD_FEATURES = window.BUD_FEATURES || { whatsapp: false };

  if (!window.BUD_FEATURES.whatsapp) {
    var injectHide = function () {
      var css = ''
        + 'a.sidebar-link[href="assistente-whatsapp.html"]{display:none !important;}'
        + '#cardWhatsApp{display:none !important;}';
      var style = document.createElement('style');
      style.id = 'bud-feature-hide-whatsapp';
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.head) injectHide();
    else document.addEventListener('DOMContentLoaded', injectHide);

    // Redirecionar quem cair direto na página dedicada
    if (/\/assistente-whatsapp\.html(\?|#|$)/i.test(location.pathname + location.search)) {
      location.replace('dashboard.html');
    }
  }

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

  /**
   * Escape ALL HTML-significant characters (including quotes) for safe interpolation
   * inside HTML attributes and onclick="" handlers.
   * Use this when injecting user data into innerHTML / template literals.
   * @param {*} str
   * @returns {string}
   */
  function budEscapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  /**
   * Format a number as BRL currency.
   * @param {number} v
   * @param {object} [opts]
   * @param {boolean} [opts.showSymbol=true]
   * @returns {string}
   */
  function budFormatarValor(v, opts) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    var showSymbol = !opts || opts.showSymbol !== false;
    var s = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return showSymbol ? 'R$ ' + s : s;
  }

  /**
   * Portuguese-BR pluralization helper.
   * @param {number} n
   * @param {string} singular
   * @param {string} [plural] — defaults to singular + "s"
   * @returns {string} "N singular|plural"
   */
  function budPluralize(n, singular, plural) {
    var c = Number(n) || 0;
    var word = c === 1 ? singular : (plural || singular + 's');
    return c + ' ' + word;
  }

  /**
   * Safe logger — only logs to console in development.
   * Production = window.location.hostname is not localhost / 127.0.0.1.
   */
  var BUD_IS_DEV = (function () {
    try {
      var h = window.location.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '' || h.endsWith('.local');
    } catch (e) { return false; }
  })();
  function budLog()   { if (BUD_IS_DEV && window.console) console.log.apply(console, arguments); }
  function budWarn()  { if (BUD_IS_DEV && window.console) console.warn.apply(console, arguments); }
  function budError() { if (BUD_IS_DEV && window.console) console.error.apply(console, arguments); }

  /**
   * Safe localStorage wrapper — never throws (handles Safari private mode, quota exceeded, etc).
   */
  var budStorage = {
    get: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); return true; } catch (e) { return false; }
    }
  };

  /**
   * Safe URL param reader — handles malformed URIs.
   * @param {string} name
   * @returns {string|null}
   */
  function budGetUrlParam(name) {
    try {
      var p = new URLSearchParams(window.location.search);
      return p.get(name);
    } catch (e) { return null; }
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

  // ─── Sidebar groups: collapsible + scrollable ───────────────────────
  function initSidebarGroups() {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    // Inject runtime CSS once (overrides static rules; safe re-injection guarded)
    if (!document.getElementById('bud-sidebar-groups-style')) {
      var st = document.createElement('style');
      st.id = 'bud-sidebar-groups-style';
      st.textContent =
        '.sidebar-nav{overflow-y:auto;overflow-x:hidden;min-height:0;padding-right:0.25rem;}' +
        '.sidebar-nav::-webkit-scrollbar{width:6px;}' +
        '.sidebar-nav::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:3px;}' +
        '.sidebar-group-label{display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;transition:opacity .2s;}' +
        '.sidebar-group-label:hover{opacity:0.8 !important;}' +
        '.sidebar-group-chevron{font-size:0.65rem;opacity:0.7;transition:transform .25s ease;display:inline-block;margin-left:0.5rem;}' +
        '.sidebar-group-label.collapsed .sidebar-group-chevron{transform:rotate(-90deg);}' +
        '.sidebar-group-item-hidden{display:none !important;}' +
        '.sidebar.collapsed .sidebar-group-label{display:none;}';
      document.head.appendChild(st);
    }

    var labels = nav.querySelectorAll('.sidebar-group-label');
    labels.forEach(function (label) {
      // Skip if already initialized
      if (label.dataset.budGroupInit === '1') return;
      label.dataset.budGroupInit = '1';

      var key = 'bud-sidebar-group:' + (label.textContent || '').trim();
      var chev = document.createElement('span');
      chev.className = 'sidebar-group-chevron';
      chev.textContent = '▾';
      label.appendChild(chev);

      // Collect items belonging to this group: every sibling until next group label or end
      var members = [];
      var sib = label.nextElementSibling;
      while (sib && !sib.classList.contains('sidebar-group-label')) {
        // Stop at the final divider that precedes Configurações (if present after Bud Plus group)
        members.push(sib);
        sib = sib.nextElementSibling;
      }

      function applyState(collapsed) {
        if (collapsed) label.classList.add('collapsed');
        else label.classList.remove('collapsed');
        members.forEach(function (m) {
          if (collapsed) m.classList.add('sidebar-group-item-hidden');
          else m.classList.remove('sidebar-group-item-hidden');
        });
      }

      var saved = null;
      try { saved = localStorage.getItem(key); } catch (e) {}
      applyState(saved === '1');

      label.addEventListener('click', function () {
        var nowCollapsed = !label.classList.contains('collapsed');
        applyState(nowCollapsed);
        try { localStorage.setItem(key, nowCollapsed ? '1' : '0'); } catch (e) {}
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarGroups);
  } else {
    initSidebarGroups();
  }

  // ─── Versão do app ───────────────────────────────────────────────────────────
  var BUD_VERSION = '1.0.0';

  // ─── Ocultar Saldo — modo privacidade ────────────────────────────────────────
  function budGetOcultarSaldo() {
    return budStorage.get('bud_ocultar_saldo') === '1';
  }

  function budSetOcultarSaldo(ocultar) {
    budStorage.set('bud_ocultar_saldo', ocultar ? '1' : '0');
    if (ocultar) {
      document.documentElement.classList.add('saldo-oculto');
    } else {
      document.documentElement.classList.remove('saldo-oculto');
    }
  }

  // Injetar CSS e aplicar preferência salva imediatamente (antes do DOMContentLoaded)
  (function () {
    if (document.head && !document.getElementById('bud-ocultar-saldo-style')) {
      var stOcultar = document.createElement('style');
      stOcultar.id = 'bud-ocultar-saldo-style';
      stOcultar.textContent =
        '.bud-saldo-privado{transition:filter 0.3s ease;}' +
        '.saldo-oculto .bud-saldo-privado{filter:blur(10px)!important;user-select:none!important;pointer-events:none;}';
      document.head.appendChild(stOcultar);
    }
    if (budGetOcultarSaldo()) {
      document.documentElement.classList.add('saldo-oculto');
    }
  })();

  // ─── Exports ─────────────────────────────────────────────────────────────────────────────────────
  window.budShowToast  = budShowToast;
  window.budSanitize   = budSanitize;
  window.budEscapeHTML = budEscapeHTML;
  window.budFormatarValor = budFormatarValor;
  window.budPluralize  = budPluralize;
  window.budLog        = budLog;
  window.budWarn       = budWarn;
  window.budError      = budError;
  window.budStorage    = budStorage;
  window.budGetUrlParam = budGetUrlParam;
  window.BUD_IS_DEV    = BUD_IS_DEV;
  window.budCalcStrength  = budCalcStrength;
  window.BUD_SENHAS_COMUNS = BUD_SENHAS_COMUNS;
  window.budInitSidebarGroups = initSidebarGroups;
  window.BUD_VERSION        = BUD_VERSION;
  window.budGetOcultarSaldo = budGetOcultarSaldo;
  window.budSetOcultarSaldo = budSetOcultarSaldo;
})();
