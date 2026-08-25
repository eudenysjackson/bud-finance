// bud-utils.js — Bud Finance global utilities
// Exposes: window.budShowToast(message, type)

(function () {
  'use strict';

  // ─── Feature flags ────────────────────────────────────────────────────
  // Para reativar WhatsApp: trocar whatsapp para true e remover este bloco
  // de CSS abaixo. Backend e demais arquivos seguem intactos.
  var FEATURE_ROUTES = {
    compras: ['mercado.html'],
    assistente_ia: ['assistente-ia.html'], whatsapp: ['assistente-whatsapp.html'],
    limites_gastos: ['limites.html'], cartoes_credito: ['cartoes.html'], metas: ['metas.html'],
    relatorios: ['relatorios.html'], recorrencias: ['recorrentes.html'], comparativo: ['comparativo.html'],
    dividas: ['dividas.html'], investimentos: ['investimentos.html'],
    balanco: ['balanco-mensal.html'], extrato: ['extrato.html'], insights: ['insights.html'],
    graficos: ['graficos.html']
  };
  var FEATURE_SELECTORS = {
    grupo_bud_plus: ['[data-feature-group="grupo_bud_plus"]'],
    dashboard_avancado: ['#secComparativo','#secCarteiraWidget','#secLimitesWidget','#secDividasAtraso','#secMetaProxima','#secInvestimentosWidget','#secEconomiaPotencial','#secSaudeFinanceira','#secDicaDia','#graficoCategorias','#graficoContainer'],
    importacao_ia: ['[data-import-ia]','#modalImportIA'],
    limites_gastos: ['#secLimitesWidget'],
    comparativo: ['#secComparativo'],
    metas: ['#secMetaProxima'],
    dividas: ['#secDividasAtraso'],
    investimentos: ['#secInvestimentosWidget'],
    insights: ['#secEconomiaPotencial','#secSaudeFinanceira','#secDicaDia'],
    dark_mode: ['[data-theme-key="hbo"]'],
    push_notifications: ['#pushSettingsRow','#btnBell']
  };
  var cachedFeatures = {};
  var cachedRules = {};
  try { cachedFeatures = JSON.parse(localStorage.getItem('bud_feature_flags') || '{}'); } catch (_) {}
  try { cachedRules = JSON.parse(localStorage.getItem('bud_feature_rules') || '{}'); } catch (_) {}
  window.BUD_FEATURES = Object.assign({ whatsapp: false }, cachedFeatures, window.BUD_FEATURES || {});
  window.BUD_FEATURE_RULES = Object.assign({}, cachedRules, window.BUD_FEATURE_RULES || {});
  window.BUD_USER_PLAN = window.BUD_USER_PLAN || null;

  window.budFeatureEnabled = function (key) {
    var rule = window.BUD_FEATURE_RULES[key];
    if (window.BUD_FEATURES[key] === false || (rule && rule.enabled === false)) return false;
    return true;
  };

  // Consulta separada para paywalls; não interfere na visibilidade da sidebar.
  window.budFeatureAllowedForPlan = function (key, plan) {
    if (!window.budFeatureEnabled(key)) return false;
    var rule = window.BUD_FEATURE_RULES[key];
    var plans = rule && Array.isArray(rule.planos) ? rule.planos.map(function (p) { return String(p).toLowerCase(); }) : [];
    return !plans.length || plans.indexOf(String(plan || window.BUD_USER_PLAN || 'free').toLowerCase()) !== -1;
  };

  function applyFeatureFlags() {
    document.querySelectorAll('.sidebar-group-label').forEach(function (label) {
      if (label.textContent.trim().toLowerCase() === 'bud plus') {
        label.setAttribute('data-feature-group', 'grupo_bud_plus');
      }
    });
    var selectors = [];
    var keys = new Set(Object.keys(FEATURE_ROUTES).concat(Object.keys(FEATURE_SELECTORS)));
    keys.forEach(function (key) {
      if (window.budFeatureEnabled(key)) return;
      (FEATURE_ROUTES[key] || []).forEach(function (page) {
        selectors.push('a[href="' + page + '"]', 'a[href$="/' + page + '"]');
        if (location.pathname.split('/').pop().toLowerCase() === page) {
          location.replace('dashboard.html?recurso_indisponivel=' + encodeURIComponent(key));
        }
      });
      (FEATURE_SELECTORS[key] || []).forEach(function (selector) { selectors.push(selector); });
    });
    var style = document.getElementById('bud-feature-flags-style') || document.createElement('style');
    style.id = 'bud-feature-flags-style';
    style.textContent = selectors.length ? selectors.join(',') + '{display:none !important;}' : '';
    if (!style.parentNode) (document.head || document.documentElement).appendChild(style);
    if (!window.budFeatureEnabled('dark_mode') && window.budThemeManager && window.budThemeManager.getCurrent() === 'hbo') {
      window.budThemeManager.apply('padrao');
    }
    window.dispatchEvent(new CustomEvent('bud:features-updated', { detail: window.BUD_FEATURES }));
  }

  applyFeatureFlags();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFeatureFlags, { once: true });
  }

  // Rolagem discreta em popups: trilho invisível e indicador fino, estilo macOS.
  (function addOverlayModalScrollbars() {
    var style = document.createElement('style');
    style.id = 'bud-overlay-modal-scrollbars';
    style.textContent = ''
      + '.modal-overlay .modal-card,.modal-overlay .modal-box,.confirm-modal-overlay .modal-card,'
      + '.modal-scroll-body,[role="dialog"] .modal-card,[role="dialog"] .modal-box{'
      + 'scrollbar-width:thin;scrollbar-color:rgba(100,116,139,.42) transparent;'
      + 'overscroll-behavior:contain;}'
      + '@supports (overflow:overlay){.modal-overlay .modal-card,.modal-overlay .modal-box,'
      + '.confirm-modal-overlay .modal-card,.modal-scroll-body,[role="dialog"] .modal-card,'
      + '[role="dialog"] .modal-box{overflow-y:overlay;}}'
      + '.modal-overlay .modal-card::-webkit-scrollbar,.modal-overlay .modal-box::-webkit-scrollbar,'
      + '.confirm-modal-overlay .modal-card::-webkit-scrollbar,.modal-scroll-body::-webkit-scrollbar,'
      + '[role="dialog"] .modal-card::-webkit-scrollbar,[role="dialog"] .modal-box::-webkit-scrollbar{width:7px;height:7px;}'
      + '.modal-overlay .modal-card::-webkit-scrollbar-track,.modal-overlay .modal-box::-webkit-scrollbar-track,'
      + '.confirm-modal-overlay .modal-card::-webkit-scrollbar-track,.modal-scroll-body::-webkit-scrollbar-track,'
      + '[role="dialog"] .modal-card::-webkit-scrollbar-track,[role="dialog"] .modal-box::-webkit-scrollbar-track{background:transparent;}'
      + '.modal-overlay .modal-card::-webkit-scrollbar-thumb,.modal-overlay .modal-box::-webkit-scrollbar-thumb,'
      + '.confirm-modal-overlay .modal-card::-webkit-scrollbar-thumb,.modal-scroll-body::-webkit-scrollbar-thumb,'
      + '[role="dialog"] .modal-card::-webkit-scrollbar-thumb,[role="dialog"] .modal-box::-webkit-scrollbar-thumb{background:rgba(100,116,139,.42);border:2px solid transparent;background-clip:padding-box;border-radius:999px;}'
      + '.modal-overlay .modal-card::-webkit-scrollbar-thumb:hover,.modal-overlay .modal-box::-webkit-scrollbar-thumb:hover,'
      + '.confirm-modal-overlay .modal-card::-webkit-scrollbar-thumb:hover,.modal-scroll-body::-webkit-scrollbar-thumb:hover,'
      + '[role="dialog"] .modal-card::-webkit-scrollbar-thumb:hover,[role="dialog"] .modal-box::-webkit-scrollbar-thumb:hover{background-color:rgba(71,85,105,.66);}';
    (document.head || document.documentElement).appendChild(style);
  }());

  // Mantém outras abas do app sincronizadas quando o admin altera uma flag.
  window.addEventListener('storage', function (event) {
    if (event.key !== 'bud_feature_flags' || !event.newValue) return;
    try {
      window.BUD_FEATURES = Object.assign({}, window.BUD_FEATURES, JSON.parse(event.newValue));
      try { window.BUD_FEATURE_RULES = JSON.parse(localStorage.getItem('bud_feature_rules') || '{}'); } catch (_) {}
      applyFeatureFlags();
    } catch (_) {}
  });

  window.BUD_FEATURES_READY = new Promise(function (resolve) {
    function loadRemoteFlags() {
      if (!window.BUD_FIREBASE_CONFIG) { resolve(window.BUD_FEATURES); return; }
      Promise.all([
        import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js'),
        import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js')
      ]).then(function (mods) {
        var appMod = mods[0], fs = mods[1], authMod = mods[2];
        var app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(window.BUD_FIREBASE_CONFIG);
        var auth = authMod.getAuth(app);
        return new Promise(function (done, fail) {
          var unsubscribe = authMod.onAuthStateChanged(auth, async function (user) {
            unsubscribe();
            if (user) {
              try {
                var userSnap = await fs.getDoc(fs.doc(fs.getFirestore(app), 'usuarios', user.uid));
                window.BUD_USER_PLAN = userSnap.exists() ? String(userSnap.data().plano || 'free').toLowerCase() : 'free';
              } catch (_) { window.BUD_USER_PLAN = 'free'; }
            }
            var firstSnapshot = true;
            fs.onSnapshot(fs.collection(fs.getFirestore(app), 'featureFlags'), function (snap) {
              var remote = {};
              var rules = {};
              snap.forEach(function (item) {
                var data = item.data();
                if (!data || !data.key) return;
                // Se houver documentos antigos duplicados, "desligado" prevalece.
                remote[data.key] = remote[data.key] === false ? false : data.enabled !== false;
                var previous = rules[data.key];
                rules[data.key] = {
                  enabled: previous && previous.enabled === false ? false : data.enabled !== false,
                  planos: Array.isArray(data.planos) ? data.planos : []
                };
              });
              window.BUD_FEATURES = Object.assign({}, window.BUD_FEATURES, remote);
              window.BUD_FEATURE_RULES = rules;
              try { localStorage.setItem('bud_feature_flags', JSON.stringify(window.BUD_FEATURES)); } catch (_) {}
              try { localStorage.setItem('bud_feature_rules', JSON.stringify(rules)); } catch (_) {}
              applyFeatureFlags();
              if (firstSnapshot) { firstSnapshot = false; done(null); }
            }, fail);
          });
        });
      }).then(function () {
        resolve(window.BUD_FEATURES);
      }).catch(function (error) {
        console.warn('[Bud Finance] Não foi possível atualizar feature flags:', error.message);
        resolve(window.BUD_FEATURES);
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadRemoteFlags, { once: true });
    else loadRemoteFlags();
  });

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

  // DT-007: parseMoeda centralizado (converte "R$ 1.234,56" → 1234.56)
  window.budParseMoeda = function(str) {
    return parseFloat(String(str || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
  };

  // DT-009: Labels de plano centralizados
  window.BUD_PLAN_LABELS = {
    free:    'Free',
    trial:   'Trial',
    starter: 'Starter',
    plus:    'Plus',
    pro:     'Pro',
  };

  // ─── Push permission popup ───────────────────────────────────────────────
  // O Service Worker (firebase-messaging-sw.js) é registrado automaticamente
  // pelo Firebase SDK quando getToken() é chamado pela primeira vez.
  // Popup customizado exibido ANTES do dialog nativo do browser.
  function _showPushPopup() {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText =
        'position:fixed;inset:0;background:rgba(15,23,42,0.55);' +
        'backdrop-filter:blur(4px);z-index:9990;display:flex;' +
        'align-items:center;justify-content:center;padding:1rem;';

      var card = document.createElement('div');
      card.style.cssText =
        'background:var(--card-bg,#fff);border-radius:1.25rem;padding:1.75rem 1.5rem;' +
        'max-width:360px;width:100%;border:1px solid var(--card-border,#e2e8f0);' +
        'box-shadow:0 24px 64px rgba(0,0,0,0.25);text-align:center;';

      var ico = document.createElement('div');
      ico.textContent = '🔔';
      ico.style.cssText = 'font-size:2.5rem;margin-bottom:1rem;';

      var h3 = document.createElement('h3');
      h3.textContent = 'Ativar notificações do Buddy?';
      h3.style.cssText =
        'font-weight:800;font-size:1.0625rem;color:var(--card-text,#1e293b);' +
        'margin:0 0 0.5rem;';

      var p = document.createElement('p');
      p.textContent =
        'Receba alertas de vencimentos, lembretes personalizados e dicas do Buddy direto no seu dispositivo.';
      p.style.cssText =
        'font-size:0.8125rem;color:var(--card-text-sec,#64748b);' +
        'line-height:1.5;margin:0 0 1.25rem;';

      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:0.75rem;';

      var deny = document.createElement('button');
      deny.textContent = 'Agora não';
      deny.style.cssText =
        'flex:1;padding:0.625rem;border:none;border-radius:0.625rem;' +
        'font-size:0.875rem;font-weight:600;cursor:pointer;' +
        'background:var(--input-bg,#f1f5f9);color:var(--card-text,#1e293b);';

      var allow = document.createElement('button');
      allow.textContent = '✅ Ativar';
      allow.style.cssText =
        'flex:1;padding:0.625rem;border:none;border-radius:0.625rem;' +
        'font-size:0.875rem;font-weight:700;cursor:pointer;color:#fff;' +
        'background:linear-gradient(135deg,#2563eb,#4f46e5);';

      btns.appendChild(deny);
      btns.appendChild(allow);
      card.appendChild(ico);
      card.appendChild(h3);
      card.appendChild(p);
      card.appendChild(btns);
      ov.appendChild(card);
      document.body.appendChild(ov);

      allow.onclick = function () { ov.remove(); resolve(true); };
      deny.onclick  = function () { ov.remove(); resolve(false); };
    });
  }

  // Exposto para uso em dashboard.js (que tem acesso ao Firebase user)
  window.BudPush = {
    /**
     * Solicita permissão de push e registra o token no backend.
     * Mostra popup customizado primeiro, depois o dialog nativo.
     * Deve ser chamado com o Firebase user autenticado.
     * @param {object} user — Firebase Auth user
     */
    requestIfNeeded: function (user) {
      if (!window.budFeatureEnabled('push_notifications')) return;
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
      if (localStorage.getItem('bud_push_asked') === 'granted') return;
      // Se já negou mais de 7 dias atrás, perguntar de novo
      var denied = localStorage.getItem('bud_push_asked');
      if (denied === 'denied' || denied === 'default') {
        var ts = parseInt(localStorage.getItem('bud_push_asked_ts') || '0', 10);
        if (ts && Date.now() - ts < 7 * 86400000) return; // só re-perguntar após 7 dias
      }
      // Mostrar popup customizado antes do dialog nativo
      _showPushPopup().then(function (accepted) {
        if (!accepted) {
          localStorage.setItem('bud_push_asked', 'denied');
          localStorage.setItem('bud_push_asked_ts', String(Date.now()));
          return;
        }
        // Delegar para dashboard.js que tem Firebase Messaging importado
        if (window._budRequestPushToken && user) {
          window._budRequestPushToken(user);
        }
      });
    }
  };

  // ─── Foto de perfil na sidebar (compartilhado entre todas as telas) ──────
  window.budAplicarFotoSidebar = function (photoURL, nome) {
    var el = document.getElementById('sidebarAvatar');
    if (!el) return;
    if (photoURL) {
      el.innerHTML = '';
      var img = document.createElement('img');
      img.src = photoURL;
      img.alt = 'Foto de perfil';
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
      el.appendChild(img);
    } else if (nome) {
      el.innerHTML = '';
      el.textContent = (nome.trim().split(/\s+/).map(function(p){return p[0];}).join('').slice(0,2) || '?').toUpperCase();
    }
  };

})();
