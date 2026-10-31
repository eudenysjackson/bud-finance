// Somente avisos atuais da assinatura. Lembretes financeiros são entregues por push.
(function (root) {
  'use strict';
  function date(value) {
    if (!value) return null;
    var result = typeof value.toDate === 'function' ? value.toDate() : new Date(value.seconds != null ? value.seconds * 1000 : value);
    return Number.isFinite(result.getTime()) ? result : null;
  }
  function subscriptionNotice(profile, now) {
    profile = profile || {};now = now || new Date();
    var plan = String(profile.plano || 'free').toLowerCase();
    var status = String(profile.assinaturaStatus || '').toLowerCase();
    var end = date(plan === 'trial' ? profile.trialFim : profile.planoExpira || profile.assinaturaExpira);
    var paid = ['starter', 'pro', 'plus'].includes(plan);
    var overdue = status === 'past_due' || status === 'expired' || ((paid || plan === 'trial') && end && end <= now);
    if (overdue) return { key: 'expired', color: 'red', emoji: '⚠️', message: plan === 'trial' ? 'Seu período de testes terminou. Escolha um plano para continuar.' : 'Sua assinatura está vencida. Confira o pagamento para regularizar o acesso.', label: 'Ver assinatura', link: 'configuracoes.html' };
    if (end && (paid || plan === 'trial') && end - now <= 3 * 86400000) {
      var days = Math.max(1, Math.ceil((end - now) / 86400000));
      var period = days + (days === 1 ? ' dia' : ' dias');
      return { key: 'due-' + end.toISOString(), color: 'blue', emoji: '🔔', message: plan === 'trial' ? 'Seu período de testes termina em ' + period + '.' : 'Sua próxima cobrança é em ' + period + '. Confira sua assinatura.', label: 'Ver assinatura', link: 'configuracoes.html' };
    }
    if (plan === 'free') return { key: 'upgrade', color: 'blue', emoji: '✨', message: 'Conheça os planos e libere mais recursos para suas finanças.', label: 'Fazer upgrade', link: 'configuracoes.html' };
    return null;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { subscriptionNotice };
  if (!root || !root.document) return;
  var document = root.document, current = null, profile = {}, timer;
  function remove(id) { var node = document.getElementById(id);if (node) node.remove(); }
  function closePanel() { remove('budNotifPanel');remove('budNotifOverlay'); }
  function render() {
    current = subscriptionNotice(profile);
    remove('bud-banner');
    var badge = document.getElementById('bellBadge');
    if (badge) { badge.textContent = current ? '1' : '';badge.style.display = current ? 'flex' : 'none'; }
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
    if (!current) return;
    var anchor = document.querySelector('.mes-nav');if (!anchor) return;
    var bar = document.createElement('div');bar.id = 'bud-banner';bar.setAttribute('role', 'status');bar.dataset.kind = current.key;
    bar.style.cssText = 'display:flex;align-items:center;gap:.75rem;border-radius:.875rem;padding:.85rem 1rem;margin-bottom:.875rem;font-size:.875rem;line-height:1.45;flex-wrap:wrap;' +
      (current.color === 'red' ? 'background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;' : 'background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;');
    var text = document.createElement('span');text.textContent = current.emoji + ' ' + current.message;text.style.cssText = 'flex:1;min-width:150px;font-weight:600;';
    var link = document.createElement('a');link.href = current.link;link.textContent = current.label;
    link.style.cssText = 'font-weight:700;color:inherit;text-decoration:underline;padding:.3rem 0;';
    bar.appendChild(text);bar.appendChild(link);anchor.parentNode.insertBefore(bar, anchor);
  }
  function openPanel() {
    if (document.getElementById('budNotifPanel')) { closePanel();return; }
    render();
    var overlay = document.createElement('div');overlay.id = 'budNotifOverlay';overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.2);z-index:4000;';
    overlay.onclick = closePanel;document.body.appendChild(overlay);
    var panel = document.createElement('aside');panel.id = 'budNotifPanel';panel.setAttribute('aria-label','Avisos da assinatura');
    panel.style.cssText = 'position:fixed;right:0;top:0;width:min(360px,100vw);height:100%;background:var(--bg-page,#f4f7fb);color:var(--card-text,#1e293b);padding:1.25rem;box-sizing:border-box;overflow:auto;z-index:4001;box-shadow:-8px 0 40px #0002;';
    var close = document.createElement('button');close.textContent = '✕';close.setAttribute('aria-label','Fechar painel');close.style.cssText = 'float:right;background:none;border:0;color:inherit;font-size:1.1rem;cursor:pointer;';close.onclick = closePanel;
    var title = document.createElement('h2');title.textContent = '🔔 Assinatura';title.style.cssText = 'font-size:1rem;font-weight:800;margin:0 0 1.5rem;';
    var text = document.createElement('p');text.textContent = current ? current.message : 'Nenhum aviso de assinatura no momento.';text.style.cssText = 'line-height:1.5;font-size:.9rem;';
    panel.appendChild(close);panel.appendChild(title);panel.appendChild(text);
    if (current) { var link = document.createElement('a');link.href = current.link;link.textContent = current.label;link.style.cssText = 'display:inline-block;margin-top:1rem;color:#2563eb;font-weight:700;';panel.appendChild(link); }
    document.body.appendChild(panel);close.focus();
  }
  root.BudInAppNotif = {
    init: function (user, data) {
      try { localStorage.removeItem('bud_notif_v2'); } catch (_) {}
      closePanel();profile = data || {};render();
      if (timer) clearInterval(timer);timer = setInterval(render, 60000);
    },
    openPanel: openPanel
  };
}(typeof window !== 'undefined' ? window : null));
