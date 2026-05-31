// js/theme-manager.js — Bud Finance Theme Manager
// Applies saved theme immediately on load to prevent flash.
// Must be loaded as a regular <script> (NOT module) in <head>.

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DOS TEMAS — DT-008
// Edite aqui para adicionar ou modificar temas sem tocar na lógica abaixo.
// Campos obrigatórios: todos os listados. errorColor: cor de erro/alerta (DT-005).
// Para tema Dark (hbo), errorColor deve ser suave (#f87171) pois #ef4444
// fica muito saturado sobre fundo preto.
// ═══════════════════════════════════════════════════════════════════════════════
var BUD_THEMES_CONFIG = {
  padrao: {
    label: 'Gelo', color: '#e2e8f0', activeRing: '#2563eb', blobOpacity: '1',
    bg: '#f4f7fb', text: '#1e293b', sec: '#475569',
    glass: 'rgba(255,255,255,0.85)', border: 'rgba(255,255,255,0.9)',
    cardText: '#1e293b', cardTextSec: '#64748b',
    btnBg: '#2563eb', btnText: '#ffffff',
    inputBg: '#f8fafc', inputBorder: '#f1f5f9', inputFocus: '#3b82f6',
    balFrom: '#4f75ff', balTo: '#375ee3', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.15)',
    sidebarBg: 'rgba(255,255,255,0.85)', sidebarUserBg: '#f8fafc',
    sidebarLinkHoverBg: 'rgba(59,130,246,0.08)', sidebarLinkHoverColor: '#2563eb',
    sidebarLinkActiveBg: 'rgba(59,130,246,0.12)', sidebarLinkActiveColor: '#2563eb',
    accent: '#2563eb', errorColor: '#ef4444',
    chartCores: ['#2563eb','#3b82f6','#60a5fa','#93c5fd','#1d4ed8','#6366f1','#8b5cf6','#a78bfa','#cbd5e1']
  },
  hbo: {
    label: 'Dark', color: '#0f172a', activeRing: '#e2e8f0', blobOpacity: '0.4',
    bg: '#000000', text: '#ffffff', sec: '#94a3b8',
    glass: 'rgba(15,20,25,0.95)', border: 'rgba(255,255,255,0.1)',
    cardText: '#e2e8f0', cardTextSec: '#94a3b8',
    btnBg: '#ffffff', btnText: '#000000',
    inputBg: 'rgba(255,255,255,0.08)', inputBorder: 'rgba(255,255,255,0.15)', inputFocus: '#ffffff',
    balFrom: '#1e293b', balTo: '#0f172a', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.08)',
    sidebarBg: 'rgba(15,20,25,0.95)', sidebarUserBg: 'rgba(255,255,255,0.06)',
    sidebarLinkHoverBg: 'rgba(255,255,255,0.08)', sidebarLinkHoverColor: '#ffffff',
    sidebarLinkActiveBg: 'rgba(255,255,255,0.12)', sidebarLinkActiveColor: '#e2e8f0',
    accent: '#e2e8f0', errorColor: '#f87171', // DT-005: vermelho suave p/ fundo preto
    chartCores: ['#e2e8f0','#94a3b8','#64748b','#475569','#cbd5e1','#f1f5f9','#7c8fa4','#b0c0d0','#334155']
  },
  azul: {
    label: 'Azul', color: '#005BAA', activeRing: '#005BAA', blobOpacity: '0',
    bg: '#005BAA', text: '#ffffff', sec: '#dbeafe',
    glass: 'rgba(255,255,255,0.92)', border: 'rgba(255,255,255,0.5)',
    cardText: '#1e293b', cardTextSec: '#475569',
    btnBg: '#ffffff', btnText: '#005BAA',
    inputBg: '#f8fafc', inputBorder: '#e2e8f0', inputFocus: '#005BAA',
    balFrom: '#004a91', balTo: '#003b75', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.18)',
    sidebarBg: 'rgba(255,255,255,0.18)', sidebarUserBg: 'rgba(255,255,255,0.12)',
    sidebarLinkHoverBg: 'rgba(255,255,255,0.15)', sidebarLinkHoverColor: '#ffffff',
    sidebarLinkActiveBg: 'rgba(255,255,255,0.22)', sidebarLinkActiveColor: '#ffffff',
    accent: '#005BAA', errorColor: '#ef4444',
    chartCores: ['#005BAA','#1a75c4','#3d8ed4','#60a8e4','#0073d1','#2186c8','#4399d5','#66ace0','#004a91']
  },
  roxo: {
    label: 'Roxo', color: '#7C3AED', activeRing: '#7C3AED', blobOpacity: '0',
    bg: '#7C3AED', text: '#ffffff', sec: '#ede9fe',
    glass: 'rgba(255,255,255,0.92)', border: 'rgba(255,255,255,0.5)',
    cardText: '#1e293b', cardTextSec: '#475569',
    btnBg: '#ffffff', btnText: '#7C3AED',
    inputBg: '#f8fafc', inputBorder: '#e2e8f0', inputFocus: '#7C3AED',
    balFrom: '#6929d4', balTo: '#5521b5', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.18)',
    sidebarBg: 'rgba(255,255,255,0.18)', sidebarUserBg: 'rgba(255,255,255,0.12)',
    sidebarLinkHoverBg: 'rgba(255,255,255,0.15)', sidebarLinkHoverColor: '#ffffff',
    sidebarLinkActiveBg: 'rgba(255,255,255,0.22)', sidebarLinkActiveColor: '#ffffff',
    accent: '#7C3AED', errorColor: '#ef4444',
    chartCores: ['#7C3AED','#9461f5','#a87bf7','#bc96f9','#6929d4','#8b5cf6','#a78bfa','#c4b5fd','#5521b5']
  },
  rosa: {
    label: 'Rosa', color: '#ff4d94', activeRing: '#ff4d94', blobOpacity: '0',
    bg: '#ff4d94', text: '#ffffff', sec: '#fce7f3',
    glass: 'rgba(255,255,255,0.92)', border: 'rgba(255,255,255,0.5)',
    cardText: '#1e293b', cardTextSec: '#475569',
    btnBg: '#ffffff', btnText: '#ff4d94',
    inputBg: '#f8fafc', inputBorder: '#e2e8f0', inputFocus: '#ff4d94',
    balFrom: '#d4407d', balTo: '#b83568', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.18)',
    sidebarBg: 'rgba(255,255,255,0.18)', sidebarUserBg: 'rgba(255,255,255,0.12)',
    sidebarLinkHoverBg: 'rgba(255,255,255,0.15)', sidebarLinkHoverColor: '#ffffff',
    sidebarLinkActiveBg: 'rgba(255,255,255,0.22)', sidebarLinkActiveColor: '#ffffff',
    accent: '#ff4d94', errorColor: '#ef4444',
    chartCores: ['#ff4d94','#ff70a8','#ff93bc','#ffb6d0','#e0307a','#d4407d','#c8506a','#f472b6','#b83568']
  },
  amarelo: {
    label: 'Amarelo', color: '#ffc700', activeRing: '#ffc700', blobOpacity: '0',
    bg: '#ffc700', text: '#1a1a1a', sec: '#78716c',
    glass: 'rgba(255,255,255,0.93)', border: 'rgba(255,255,255,0.7)',
    cardText: '#1a1a1a', cardTextSec: '#57534e',
    btnBg: '#1a1a1a', btnText: '#ffc700',
    inputBg: '#fffcf0', inputBorder: '#e2e8f0', inputFocus: '#1a1a1a',
    balFrom: '#1a1a1a', balTo: '#2d3748', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.12)',
    sidebarBg: 'rgba(255,255,255,0.22)', sidebarUserBg: 'rgba(255,255,255,0.15)',
    sidebarLinkHoverBg: 'rgba(0,0,0,0.08)', sidebarLinkHoverColor: '#1a1a1a',
    sidebarLinkActiveBg: 'rgba(0,0,0,0.12)', sidebarLinkActiveColor: '#1a1a1a',
    accent: '#ffc700', errorColor: '#dc2626',
    chartCores: ['#ffc700','#e6a800','#f59e0b','#d97706','#b45309','#fbbf24','#fcd34d','#fde68a','#92400e']
  },
  verde: {
    label: 'Verde', color: '#11c76f', activeRing: '#11c76f', blobOpacity: '0',
    bg: '#11c76f', text: '#ffffff', sec: '#dcfce7',
    glass: 'rgba(255,255,255,0.92)', border: 'rgba(255,255,255,0.5)',
    cardText: '#1e293b', cardTextSec: '#475569',
    btnBg: '#ffffff', btnText: '#11c76f',
    inputBg: '#f8fafc', inputBorder: '#e2e8f0', inputFocus: '#11c76f',
    balFrom: '#0ea55c', balTo: '#0b8a4c', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.18)',
    sidebarBg: 'rgba(255,255,255,0.18)', sidebarUserBg: 'rgba(255,255,255,0.12)',
    sidebarLinkHoverBg: 'rgba(255,255,255,0.15)', sidebarLinkHoverColor: '#ffffff',
    sidebarLinkActiveBg: 'rgba(255,255,255,0.22)', sidebarLinkActiveColor: '#ffffff',
    accent: '#11c76f', errorColor: '#ef4444',
    chartCores: ['#11c76f','#34d888','#57e9a1','#7af4ba','#0ea55c','#059c52','#047842','#10b981','#065f46']
  },
  vermelho: {
    label: 'Vermelho', color: '#ed1c24', activeRing: '#ed1c24', blobOpacity: '0',
    bg: '#ed1c24', text: '#ffffff', sec: '#fee2e2',
    glass: 'rgba(255,255,255,0.92)', border: 'rgba(255,255,255,0.5)',
    cardText: '#1e293b', cardTextSec: '#475569',
    btnBg: '#ffffff', btnText: '#ed1c24',
    inputBg: '#f8fafc', inputBorder: '#e2e8f0', inputFocus: '#ed1c24',
    balFrom: '#c8171e', balTo: '#a71219', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.18)',
    sidebarBg: 'rgba(255,255,255,0.18)', sidebarUserBg: 'rgba(255,255,255,0.12)',
    sidebarLinkHoverBg: 'rgba(255,255,255,0.15)', sidebarLinkHoverColor: '#ffffff',
    sidebarLinkActiveBg: 'rgba(255,255,255,0.22)', sidebarLinkActiveColor: '#ffffff',
    accent: '#ed1c24', errorColor: '#ef4444',
    chartCores: ['#ed1c24','#f44','#f97316','#f59e0b','#c8171e','#dc2626','#ef4444','#fca5a5','#a71219']
  }
};

// Expõe para uso externo (preview-temas.html, dev tools)
window.BUD_THEMES_CONFIG = BUD_THEMES_CONFIG;

(function () {
  'use strict';
  var THEMES = BUD_THEMES_CONFIG;

  var _current = 'padrao';

  function _setVars(t) {
    var r = document.documentElement.style;
    r.setProperty('--bg-page', t.bg);
    r.setProperty('--text-main', t.text);
    r.setProperty('--text-sec', t.sec);
    r.setProperty('--card-bg', t.glass);
    r.setProperty('--card-border', t.border);
    r.setProperty('--card-text', t.cardText);
    r.setProperty('--card-text-sec', t.cardTextSec);
    r.setProperty('--btn-bg', t.btnBg);
    r.setProperty('--btn-text', t.btnText);
    r.setProperty('--input-bg', t.inputBg);
    r.setProperty('--input-border', t.inputBorder);
    r.setProperty('--input-focus', t.inputFocus);
    r.setProperty('--balance-from', t.balFrom);
    r.setProperty('--balance-to', t.balTo);
    r.setProperty('--balance-text', t.balText);
    r.setProperty('--balance-mini-bg', t.balMiniBg);
    r.setProperty('--blob-opacity', t.blobOpacity);
    r.setProperty('--sidebar-bg', t.sidebarBg);
    r.setProperty('--sidebar-user-bg', t.sidebarUserBg);
    r.setProperty('--sidebar-link-hover-bg', t.sidebarLinkHoverBg);
    r.setProperty('--sidebar-link-hover-color', t.sidebarLinkHoverColor);
    r.setProperty('--sidebar-link-active-bg', t.sidebarLinkActiveBg);
    r.setProperty('--sidebar-link-active-color', t.sidebarLinkActiveColor);
    r.setProperty('--theme-accent', t.accent);
    r.setProperty('--error-color', t.errorColor || '#ef4444'); // DT-005
    // A2 fix: garantir que o texto do <body> herde a variável correta do tema
    // (sem isso, em Dark o texto solto fica preto sobre fundo preto).
    r.setProperty('--text-main', t.text);
    r.setProperty('--text-sec', t.sec);
    document.body && (document.body.style.color = t.text);
  }

  function _updateBubbles(name) {
    var t = THEMES[name] || THEMES.padrao;
    document.querySelectorAll('[data-theme-key]').forEach(function (el) {
      var isActive = el.dataset.themeKey === name;
      if (isActive) {
        el.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px ' + t.activeRing;
        el.style.transform = 'scale(1.18)';
      } else {
        el.style.boxShadow = 'none';
        el.style.transform = 'scale(1)';
      }
    });
  }

  function applyTheme(name) {
    var t = THEMES[name];
    if (!t) { name = 'padrao'; t = THEMES.padrao; }
    _current = name;
    _setVars(t);
    // A4 fix: localStorage pode falhar (Safari private, cota cheia, etc).
    try { localStorage.setItem('bud_theme', name); } catch (_) {}
    _updateBubbles(name);
    try {
      document.dispatchEvent(new CustomEvent('bud:themechange', { detail: { name: name } }));
    } catch (_) {}
  }

  // Render theme bubbles when DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('themeBubbles');
    if (!container) return;

    Object.keys(THEMES).forEach(function (key) {
      var t = THEMES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.themeKey = key;
      btn.title = t.label;
      btn.setAttribute('aria-label', 'Tema ' + t.label);

      var bgValue = key === 'padrao'
        ? 'linear-gradient(135deg, #e2e8f0, #f8fafc)'
        : t.color;

      btn.style.cssText = [
        'width:22px', 'height:22px', 'border-radius:50%',
        'background:' + bgValue,
        'border:2px solid rgba(255,255,255,0.7)',
        'cursor:pointer', 'flex-shrink:0', 'padding:0',
        'transition:transform .15s ease, box-shadow .15s ease',
        'outline:none'
      ].join(';');

      btn.addEventListener('click', function () { applyTheme(key); });
      container.appendChild(btn);
    });

    // Sync active state on bubbles after rendering
    _updateBubbles(_current);
  });

  // Apply saved theme immediately on script load (prevents flash)
  var saved = 'padrao';
  try { saved = localStorage.getItem('bud_theme') || 'padrao'; } catch (_) {}
  applyTheme(saved);

  // M11 fix: sincronizar tema entre abas (preview-temas + tela principal)
  window.addEventListener('storage', function (ev) {
    if (ev.key === 'bud_theme' && ev.newValue && ev.newValue !== _current) {
      applyTheme(ev.newValue);
    }
  });

  window.budThemeManager = {
    apply: applyTheme,
    themes: THEMES,
    getCurrent: function () { return _current; },
    getChartCores: function () { return (THEMES[_current] || THEMES.padrao).chartCores.slice(); }
  };
}());
