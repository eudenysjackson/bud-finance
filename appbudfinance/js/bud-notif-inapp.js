// bud-notif-inapp.js — Bud Finance In-App Notification Banners
// =============================================================================
// Exibe banners de notificação personalizados (localStorage-based, sem FCM).
// NUNCA usa classes Tailwind dinâmicas — todos os estilos são inline (style.cssText).
// Expõe: window.BudInAppNotif = { init, openPanel, addExternal }
// =============================================================================

(function () {
  'use strict';

  var STORE_KEY = 'bud_notif_v2';
  var MAX_HIST  = 30;

  // ── Persistência ─────────────────────────────────────────────────────────

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (_) { return []; }
  }

  function _save(h) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(h.slice(0, MAX_HIST))); } catch (_) {}
  }

  function _has(key)         { return _load().some(function (n) { return n.key === key; }); }
  function _isDismissed(key) { return _load().some(function (n) { return n.key === key && n.dismissed; }); }

  function _add(notif) {
    var h = _load();
    var existing = h.find(function (n) { return n.key === notif.key; });
    if (existing) {
      // Atualiza dados vindos do servidor, preservando leitura e descarte do usuário.
      existing.emoji = notif.emoji;
      existing.msg = notif.msg;
      existing.link = notif.link;
      existing.linkLabel = notif.linkLabel;
      existing.ts = notif.ts || existing.ts;
      _save(h);
      return;
    }
    h.unshift(notif);
    _save(h);
  }

  function _dismiss(key) {
    var h = _load();
    h.forEach(function (n) { if (n.key === key) n.dismissed = true; });
    _save(h);
  }

  // Remove avisos vinculados a contas locais antigas. No emulator o UID pode
  // mudar ao recriar o usuário, mas o localStorage do navegador permanece.
  function _pruneAccountNotifications(uid) {
    var accountPrefixes = ['welcome_v2_', 'trial_', 'expire_1d_'];
    var h = _load().filter(function (n) {
      var key = String(n.key || '');
      var scoped = accountPrefixes.some(function (prefix) { return key.startsWith(prefix); });
      return !scoped || key.endsWith('_' + uid);
    });
    h.forEach(function (n) {
      if (n.key === 'welcome_v2_' + uid) {
        n.link = '#tutorial-dashboard';
        n.linkLabel = 'Ver tutorial';
      }
    });
    _save(h);
  }

  function _handleInternalLink(event, link) {
    if (link !== '#tutorial-dashboard') return false;
    event.preventDefault();
    var panel = document.getElementById('budNotifPanel');
    var overlay = document.getElementById('budNotifOverlay');
    if (panel) panel.remove();
    if (overlay) overlay.remove();
    if (window.BudTutorial) window.BudTutorial.show('dashboard');
    return true;
  }

  function _reconcileGlobals(validKeys) {
    var allowed = new Set(validKeys || []);
    var h = _load().filter(function (n) {
      return !String(n.key || '').startsWith('global_') || allowed.has(n.key);
    });
    _save(h);

    var banner = document.getElementById('bud-banner');
    if (banner && banner.dataset.key && !allowed.has(banner.dataset.key)) banner.remove();
    var panel = document.getElementById('budNotifPanel');
    var overlay = document.getElementById('budNotifOverlay');
    if (panel) panel.remove();
    if (overlay) overlay.remove();
    _updateBadge();
  }

  function _markAllRead() {
    var h = _load();
    h.forEach(function (n) { n.read = true; });
    _save(h);
  }

  function _unreadCount() {
    return _load().filter(function (n) { return !n.read && !n.dismissed; }).length;
  }

  // ── Bell badge ────────────────────────────────────────────────────────────

  function _updateBadge() {
    var el = document.getElementById('bellBadge');
    var c  = _unreadCount();
    if (!el) return;
    if (c > 0) {
      el.textContent = c > 9 ? '9+' : String(c);
      el.style.display = 'flex';
      if (navigator.setAppBadge)    navigator.setAppBadge(c).catch(function () {});
    } else {
      el.style.display = 'none';
      if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
    }
  }

  // ── Inject CSS once ───────────────────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById('bud-notif-css')) return;
    var s = document.createElement('style');
    s.id = 'bud-notif-css';
    s.textContent =
      '@keyframes _budBannerIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes _budBannerOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-10px)}}' +
      '@keyframes _budPanelIn{from{transform:translateX(100%)}to{transform:translateX(0)}}';
    document.head.appendChild(s);
  }

  // ── Show banner above .mes-nav ────────────────────────────────────────────

  function _showBanner(key, emoji, msg, link, linkLabel) {
    _injectCSS();
    var anchor = document.querySelector('.mes-nav');
    if (!anchor) return;

    var old = document.getElementById('bud-banner');
    if (old) old.remove();

    var bar = document.createElement('div');
    bar.id = 'bud-banner';
    bar.dataset.key = key;
    bar.style.cssText =
      'display:flex;align-items:center;gap:0.75rem;' +
      'background:linear-gradient(135deg,#1e40af,#4338ca);color:#fff;' +
      'border-radius:0.875rem;padding:0.75rem 1rem;margin-bottom:0.875rem;' +
      'font-size:0.875rem;font-weight:600;line-height:1.4;' +
      'box-shadow:0 4px 20px rgba(30,64,175,0.4);' +
      'animation:_budBannerIn 0.3s ease;';

    var ico = document.createElement('span');
    ico.textContent = emoji;
    ico.style.cssText = 'font-size:1.25rem;flex-shrink:0;';

    var txt = document.createElement('span');
    txt.textContent = msg;
    txt.style.cssText = 'flex:1;';

    bar.appendChild(ico);
    bar.appendChild(txt);

    if (link && linkLabel) {
      var a = document.createElement('a');
      a.href = link;
      a.textContent = linkLabel;
      a.onclick = function (event) { _handleInternalLink(event, link); };
      a.style.cssText =
        'background:rgba(255,255,255,0.2);color:#fff;padding:0.3rem 0.75rem;' +
        'border-radius:0.5rem;font-size:0.75rem;font-weight:700;' +
        'text-decoration:none;white-space:nowrap;flex-shrink:0;' +
        'border:1px solid rgba(255,255,255,0.3);';
      bar.appendChild(a);
    }

    var x = document.createElement('button');
    x.textContent = '×';
    x.setAttribute('aria-label', 'Fechar notificação');
    x.style.cssText =
      'background:rgba(255,255,255,0.15);border:none;color:#fff;' +
      'width:24px;height:24px;border-radius:50%;cursor:pointer;' +
      'font-size:1rem;font-weight:800;flex-shrink:0;line-height:1;';
    x.onclick = function () {
      _dismiss(key);
      bar.style.animation = '_budBannerOut 0.25s ease forwards';
      setTimeout(function () { if (bar.parentNode) bar.remove(); }, 250);
    };
    bar.appendChild(x);

    anchor.parentNode.insertBefore(bar, anchor);
  }

  // ── Time ago ──────────────────────────────────────────────────────────────

  function _timeAgo(ts) {
    var m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1)  return 'agora';
    if (m < 60) return m + 'min atrás';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h atrás';
    var d = Math.floor(h / 24);
    return d + 'd atrás';
  }

  // ── Notification panel (slide-in from right) ──────────────────────────────

  function _openPanel() {
    _injectCSS();

    // Toggle: if open, close
    var existing = document.getElementById('budNotifPanel');
    if (existing) {
      var ov = document.getElementById('budNotifOverlay');
      if (existing) existing.remove();
      if (ov) ov.remove();
      return;
    }

    _markAllRead();
    _updateBadge();

    var hist = _load().filter(function (n) { return !n.dismissed; });

    // Overlay (transparent — click outside closes)
    var overlay = document.createElement('div');
    overlay.id = 'budNotifOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:4000;';
    overlay.onclick = function (e) {
      if (e.target === overlay) {
        var p = document.getElementById('budNotifPanel');
        if (p) p.remove();
        overlay.remove();
      }
    };
    document.body.appendChild(overlay);

    var panel = document.createElement('div');
    panel.id = 'budNotifPanel';
    panel.style.cssText =
      'position:fixed;top:0;right:0;width:min(360px,100vw);height:100%;' +
      'background:var(--bg-page,#f4f7fb);border-left:1px solid var(--card-border,#e2e8f0);' +
      'z-index:4001;overflow-y:auto;box-shadow:-8px 0 40px rgba(0,0,0,0.15);' +
      'animation:_budPanelIn 0.28s ease;display:flex;flex-direction:column;';
    overlay.appendChild(panel);

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:1.25rem 1rem 1rem;border-bottom:1px solid var(--card-border,#e2e8f0);' +
      'position:sticky;top:0;background:var(--bg-page,#f4f7fb);z-index:1;flex-shrink:0;';

    var title = document.createElement('span');
    title.textContent = '🔔 Notificações';
    title.style.cssText = 'font-weight:800;font-size:1rem;color:var(--card-text,#1e293b);';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Fechar painel');
    closeBtn.style.cssText =
      'background:none;border:none;font-size:1.125rem;cursor:pointer;' +
      'color:var(--card-text-sec,#64748b);padding:0.25rem 0.5rem;';
    closeBtn.onclick = function () { panel.remove(); overlay.remove(); };

    hdr.appendChild(title);
    hdr.appendChild(closeBtn);
    panel.appendChild(hdr);

    // Body
    var body = document.createElement('div');
    body.style.cssText = 'padding:1rem;display:flex;flex-direction:column;gap:0.625rem;flex:1;';

    if (hist.length === 0) {
      var emp = document.createElement('div');
      emp.style.cssText = 'text-align:center;padding:3rem 1rem;color:var(--card-text-sec,#64748b);';
      emp.innerHTML =
        '<div style="font-size:2.5rem;margin-bottom:0.75rem;">🔕</div>' +
        '<div style="font-weight:700;font-size:0.9375rem;">Nenhuma notificação</div>' +
        '<div style="font-size:0.8125rem;margin-top:0.375rem;">O Buddy vai te avisar por aqui</div>';
      body.appendChild(emp);
    } else {
      hist.forEach(function (n) {
        var card = document.createElement('div');
        card.style.cssText =
          'background:var(--card-bg,rgba(255,255,255,0.85));' +
          'border:1px solid var(--card-border,#e2e8f0);border-radius:0.875rem;' +
          'padding:0.875rem 1rem;display:flex;gap:0.75rem;align-items:flex-start;';

        var eico = document.createElement('div');
        eico.textContent = n.emoji || '📢';
        eico.style.cssText = 'font-size:1.25rem;flex-shrink:0;margin-top:0.1rem;';

        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';

        var mEl = document.createElement('div');
        mEl.textContent = n.msg;
        mEl.style.cssText =
          'font-size:0.875rem;font-weight:600;color:var(--card-text,#1e293b);' +
          'line-height:1.4;word-break:break-word;';

        var tEl = document.createElement('div');
        tEl.textContent = n.ts ? _timeAgo(n.ts) : '';
        tEl.style.cssText = 'font-size:0.75rem;color:var(--card-text-sec,#64748b);margin-top:0.25rem;';

        info.appendChild(mEl);
        info.appendChild(tEl);

        if (n.link && n.linkLabel) {
          var aEl = document.createElement('a');
          aEl.href = n.link;
          aEl.textContent = n.linkLabel + ' →';
          aEl.onclick = function (event) { _handleInternalLink(event, n.link); };
          aEl.style.cssText =
            'display:inline-block;margin-top:0.5rem;font-size:0.75rem;' +
            'font-weight:700;color:#2563eb;text-decoration:none;';
          info.appendChild(aEl);
        }

        card.appendChild(eico);
        card.appendChild(info);

        var dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.textContent = '✕';
        dismissBtn.setAttribute('aria-label', 'Descartar notificação');
        dismissBtn.style.cssText =
          'background:none;border:none;color:var(--card-text-sec,#64748b);' +
          'cursor:pointer;font-size:0.9rem;padding:0.1rem 0.25rem;flex-shrink:0;';
        dismissBtn.onclick = function () {
          _dismiss(n.key);
          card.remove();
          _updateBadge();
        };
        card.appendChild(dismissBtn);
        body.appendChild(card);
      });
    }

    panel.appendChild(body);
  }

  // ── Conditions check on init ──────────────────────────────────────────────

  function _check(user, userData) {
    var plano = (userData.plano || 'free').toLowerCase();
    var uid   = user.uid;
    var nome  = (userData.nome || '').split(' ')[0];

    // 1. Boas-vindas — usuário criado há ≤48h (apenas uma vez)
    var kWelcome = 'welcome_v2_' + uid;
    if (!_has(kWelcome) && user.metadata && user.metadata.creationTime) {
      var age = Date.now() - new Date(user.metadata.creationTime).getTime();
      if (age < 172800000) { // 48h
        var wMsg = 'Bem-vindo(a) ao Bud Finance' + (nome ? ', ' + nome : '') + '! Explore o tutorial para começar 🎉';
        _add({
          key: kWelcome, emoji: '👋', msg: wMsg,
          link: '#tutorial-dashboard', linkLabel: 'Ver tutorial',
          ts: Date.now(), read: false, dismissed: false
        });
        if (!_isDismissed(kWelcome)) {
          _showBanner(kWelcome, '👋', wMsg, '#tutorial-dashboard', 'Ver tutorial');
          _updateBadge();
          return; // uma notificação por vez
        }
      }
    }

    // 2. Plano expirando amanhã (priority)
    var expField = userData.planoExpira || userData.assinaturaExpira;
    if (expField && plano !== 'free' && plano !== 'trial') {
      try {
        var expDate = expField.toDate ? expField.toDate() : new Date(expField);
        var diffDias = Math.ceil((expDate - new Date()) / 86400000);
        if (diffDias === 1) {
          var lblP = { starter: 'Starter', pro: 'Pro', plus: 'Plus' }[plano] || plano;
          var kExp = 'expire_1d_' + expDate.toISOString().slice(0, 10) + '_' + uid;
          var eMsg = 'Seu plano ' + lblP + ' expira amanhã. Renove para não perder o acesso.';
          _add({
            key: kExp, emoji: '🔔', msg: eMsg,
            link: '../index.html?checkout=' + plano, linkLabel: 'Renovar',
            ts: Date.now(), read: false, dismissed: false
          });
          if (!_isDismissed(kExp)) {
            _showBanner(kExp, '🔔', eMsg, '../index.html?checkout=' + plano, 'Renovar');
            _updateBadge();
            return;
          }
        }
      } catch (_) {}
    }

    // 3. Trial acabando em ≤3 dias
    if (plano === 'trial' && userData.trialFim) {
      try {
        var tf   = userData.trialFim.toDate ? userData.trialFim.toDate() : new Date(userData.trialFim);
        var dtTrial = Math.ceil((tf - new Date()) / 86400000);
        if (dtTrial > 0 && dtTrial <= 3) {
          var kTrial = 'trial_' + dtTrial + 'd_' + uid;
          var tMsg = 'Seu trial acaba em ' + dtTrial + ' dia' + (dtTrial > 1 ? 's' : '') + '. Escolha um plano para continuar.';
          _add({
            key: kTrial, emoji: '⏳', msg: tMsg,
            link: '../index.html?checkout=pro', linkLabel: 'Ver planos',
            ts: Date.now(), read: false, dismissed: false
          });
          if (!_isDismissed(kTrial)) {
            _showBanner(kTrial, '⏳', tMsg, '../index.html?checkout=pro', 'Ver planos');
            _updateBadge();
            return;
          }
        }
      } catch (_) {}
    }

    _updateBadge();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.BudInAppNotif = {
    /**
     * Chame após autenticação do usuário. Verifica condições e exibe banners.
     * @param {object} user     — Firebase Auth user
     * @param {object} userData — Firestore /usuarios/{uid} data
     */
    init: function (user, userData) {
      _pruneAccountNotifications(user.uid);
      _updateBadge();
      _check(user, userData);
    },

    /** Abre/fecha o painel lateral de notificações */
    openPanel: _openPanel,

    /**
     * Adiciona notificação externa (ex: push foreground via FCM onMessage).
     * @param {string} key       — chave única (para evitar duplicatas)
     * @param {string} emoji     — emoji da notificação
     * @param {string} msg       — mensagem
     * @param {string} [link]    — URL de destino
     * @param {string} [lbl]     — rótulo do link
     */
    addExternal: function (key, emoji, msg, link, lbl, timestamp) {
      if (_isDismissed(key)) return;
      _add({ key: key, emoji: emoji, msg: msg, link: link, linkLabel: lbl, ts: timestamp || Date.now(), read: false, dismissed: false });
      _showBanner(key, emoji, msg, link, lbl);
      _updateBadge();
    },

    // Remove do cache notificações globais que já não são válidas para o usuário.
    reconcileGlobals: _reconcileGlobals
  };

}());
