// js/theme-manager.js — Bud Finance Theme Manager
// Applies saved theme immediately on load to prevent flash.
// Must be loaded as a regular <script> (NOT module) in <head>.

// Todas as telas autenticadas carregam este arquivo no <head>. Mantemos aqui
// a inclusão da base mobile compartilhada para evitar regras divergentes por página.
(function loadSharedMobileStyles() {
  if (document.querySelector('link[data-bud-mobile-uniform]')) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/mobile-uniform.css?v=20260912-5';
  link.setAttribute('data-bud-mobile-uniform', '');
  document.head.appendChild(link);
})();

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
    label: 'Azul Safira', color: '#2563EB', activeRing: '#2563EB', blobOpacity: '0.45',
    bg: '#EEF4FF', text: '#172554', sec: '#52627E',
    glass: 'rgba(255,255,255,0.86)', border: 'rgba(191,219,254,0.88)',
    cardText: '#172554', cardTextSec: '#64748B',
    btnBg: '#1D4ED8', btnText: '#ffffff',
    inputBg: '#F8FAFF', inputBorder: '#DBEAFE', inputFocus: '#2563EB',
    balFrom: '#3159B9', balTo: '#1E3A8A', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.16)',
    sidebarBg: 'rgba(238,244,255,0.92)', sidebarUserBg: '#E4EEFF',
    sidebarLinkHoverBg: 'rgba(37,99,235,0.09)', sidebarLinkHoverColor: '#1D4ED8',
    sidebarLinkActiveBg: 'rgba(37,99,235,0.14)', sidebarLinkActiveColor: '#1E40AF',
    accent: '#2563EB', errorColor: '#DC3D5B',
    chartCores: ['#2563EB','#4F46E5','#0891B2','#3B82F6','#6366F1','#0E7490','#1D4ED8','#7C3AED','#94A3B8']
  },
  roxo: {
    label: 'Roxo Imperial', color: '#7C3AED', activeRing: '#6D3FD1', blobOpacity: '0.42',
    bg: '#F5F2FC', text: '#2D1F4A', sec: '#665A7C',
    glass: 'rgba(255,255,255,0.87)', border: 'rgba(221,214,254,0.88)',
    cardText: '#2D1F4A', cardTextSec: '#776C8B',
    btnBg: '#6D3FD1', btnText: '#ffffff',
    inputBg: '#FBFAFF', inputBorder: '#E9E2FB', inputFocus: '#7C3AED',
    balFrom: '#7650C8', balTo: '#45217F', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.16)',
    sidebarBg: 'rgba(248,246,255,0.92)', sidebarUserBg: '#EFE9FC',
    sidebarLinkHoverBg: 'rgba(109,63,209,0.09)', sidebarLinkHoverColor: '#6135C4',
    sidebarLinkActiveBg: 'rgba(109,63,209,0.14)', sidebarLinkActiveColor: '#542BA8',
    accent: '#6D3FD1', errorColor: '#D13D63',
    chartCores: ['#6D3FD1','#8B5CF6','#A855F7','#C084FC','#4C1D95','#7E4CCB','#B06EEA','#D8B4FE','#7C3AED']
  },
  rosa: {
    label: 'Rosa Framboesa', color: '#C43A70', activeRing: '#C43A70', blobOpacity: '0.36',
    bg: '#FFF3F7', text: '#4A1F33', sec: '#7B5A68',
    glass: 'rgba(255,255,255,0.88)', border: 'rgba(253,205,222,0.9)',
    cardText: '#4A1F33', cardTextSec: '#8A6675',
    btnBg: '#B52D62', btnText: '#ffffff',
    inputBg: '#FFF9FB', inputBorder: '#FCE0EA', inputFocus: '#C43A70',
    balFrom: '#C34B78', balTo: '#7E1F48', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.17)',
    sidebarBg: 'rgba(255,246,249,0.93)', sidebarUserBg: '#FDECF2',
    sidebarLinkHoverBg: 'rgba(181,45,98,0.09)', sidebarLinkHoverColor: '#B52D62',
    sidebarLinkActiveBg: 'rgba(181,45,98,0.14)', sidebarLinkActiveColor: '#941E4D',
    accent: '#B52D62', errorColor: '#D33B5D',
    chartCores: ['#B52D62','#D9467C','#E879A5','#9D174D','#BE185D','#F472B6','#C24178','#DB2777','#FDA4AF']
  },
  amarelo: {
    label: 'Dourado', color: '#D6A20A', activeRing: '#B98008', blobOpacity: '0.38',
    bg: '#FFFBEA', text: '#3D2D08', sec: '#776333',
    glass: 'rgba(255,255,255,0.89)', border: 'rgba(253,230,138,0.78)',
    cardText: '#3B2A13', cardTextSec: '#806B4C',
    btnBg: '#B98008', btnText: '#ffffff',
    inputBg: '#FFFDF5', inputBorder: '#F8E6A7', inputFocus: '#D6A20A',
    balFrom: '#D6A20A', balTo: '#7A5505', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.16)',
    sidebarBg: 'rgba(255,252,237,0.94)', sidebarUserBg: '#FFF4C9',
    sidebarLinkHoverBg: 'rgba(214,162,10,0.10)', sidebarLinkHoverColor: '#9D6900',
    sidebarLinkActiveBg: 'rgba(214,162,10,0.16)', sidebarLinkActiveColor: '#7A5505',
    accent: '#B98008', errorColor: '#C9374C',
    chartCores: ['#B98008','#D6A20A','#EAB308','#F59E0B','#9A6700','#F4C95D','#CA8A04','#FDE68A','#A16207']
  },
  verde: {
    label: 'Verde Esmeralda', color: '#0F8A67', activeRing: '#087A5B', blobOpacity: '0.36',
    bg: '#EFFAF6', text: '#123B31', sec: '#5A746B',
    glass: 'rgba(255,255,255,0.87)', border: 'rgba(167,243,208,0.72)',
    cardText: '#123B31', cardTextSec: '#668278',
    btnBg: '#087A5B', btnText: '#ffffff',
    inputBg: '#F9FEFC', inputBorder: '#D6F4E6', inputFocus: '#0F8A67',
    balFrom: '#17866B', balTo: '#07513E', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.16)',
    sidebarBg: 'rgba(243,252,248,0.94)', sidebarUserBg: '#E4F6EE',
    sidebarLinkHoverBg: 'rgba(8,122,91,0.09)', sidebarLinkHoverColor: '#087A5B',
    sidebarLinkActiveBg: 'rgba(8,122,91,0.14)', sidebarLinkActiveColor: '#05664C',
    accent: '#087A5B', errorColor: '#CD3D58',
    chartCores: ['#087A5B','#0F9D78','#14B88A','#059669','#0F766E','#34B27B','#2DD4A0','#047857','#6EE7B7']
  },
  vermelho: {
    label: 'Vermelho Rubi', color: '#D91E3A', activeRing: '#C71632', blobOpacity: '0.36',
    bg: '#FFF5F5', text: '#4B1520', sec: '#805761',
    glass: 'rgba(255,255,255,0.89)', border: 'rgba(254,205,211,0.88)',
    cardText: '#4B1520', cardTextSec: '#8D626B',
    btnBg: '#C71632', btnText: '#ffffff',
    inputBg: '#FFF9F9', inputBorder: '#FDE0E3', inputFocus: '#D91E3A',
    balFrom: '#D91E3A', balTo: '#7F1024', balText: '#ffffff', balMiniBg: 'rgba(255,255,255,0.17)',
    sidebarBg: 'rgba(255,248,248,0.94)', sidebarUserBg: '#FDECEE',
    sidebarLinkHoverBg: 'rgba(217,30,58,0.10)', sidebarLinkHoverColor: '#C71632',
    sidebarLinkActiveBg: 'rgba(217,30,58,0.15)', sidebarLinkActiveColor: '#9F1028',
    accent: '#C71632', errorColor: '#B91C35',
    chartCores: ['#C71632','#E11D48','#EF4444','#B91C1C','#F43F5E','#DC2626','#FB7185','#991B1B','#FDA4AF']
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
