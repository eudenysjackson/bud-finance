// js/dashboard.js — Bud Finance Dashboard
// Auth guard + session management + summary rendering

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, collection, query, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase init ──────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── State ──────────────────────────────────────────────────────────────
let usuarioAtualId = null;
let transacoesGlobais = [];
let valoresOcultos = localStorage.getItem('bud_valores_ocultos') === 'true';
let dataFiltro = new Date();
const _unsubs = [];

// ─── Formatação ─────────────────────────────────────────────────────────
function formatarValor(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getIniciais(nome) {
  if (!nome) return '?';
  var partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function getSaudacao() {
  var h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarDataHoje() {
  var opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  var str = new Date().toLocaleDateString('pt-BR', opts);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getMesAnoLabel() {
  var opts = { month: 'long', year: 'numeric' };
  var str = dataFiltro.toLocaleDateString('pt-BR', opts);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Toggle valores ocultos ─────────────────────────────────────────────
function atualizarVisibilidadeValores() {
  var els = document.querySelectorAll('#cardSaldo, #cardEntradas, #cardSaidas');
  if (valoresOcultos) {
    els.forEach(function (el) {
      el.textContent = 'R$ •••••';
    });
  }
  // Quando não oculto, renderizarDashboard já definiu os valores reais
  var btn = document.getElementById('btnToggleValues');
  if (btn) btn.textContent = valoresOcultos ? '🙈' : '👁️';
}

// ─── Renderizar dashboard ───────────────────────────────────────────────
function renderizarDashboard() {
  var mesAtual = dataFiltro.getMonth();
  var anoAtual = dataFiltro.getFullYear();

  var transacoesDoMes = transacoesGlobais.filter(function (t) {
    if (!t.data) return false;
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  var entradas = 0;
  var saidas = 0;

  transacoesDoMes.forEach(function (t) {
    var valor = t.valor || 0;
    if (t.tipo === 'receita' && t.confirmado !== false) {
      entradas += valor;
    } else if (t.tipo === 'despesa') {
      var ehCC = Boolean(t.cartaoId) && !t.pagamentoFatura;
      if (!ehCC) saidas += valor;
    }
  });

  var saldo = entradas - saidas;

  // Update cards
  var cardSaldo = document.getElementById('cardSaldo');
  var cardEntradas = document.getElementById('cardEntradas');
  var cardSaidas = document.getElementById('cardSaidas');

  if (cardSaldo) cardSaldo.textContent = formatarValor(saldo);
  if (cardEntradas) cardEntradas.textContent = formatarValor(entradas);
  if (cardSaidas) cardSaidas.textContent = formatarValor(saidas);

  // Sub labels
  var cardSaldoSub = document.getElementById('cardSaldoSub');
  var cardEntradasSub = document.getElementById('cardEntradasSub');
  var cardSaidasSub = document.getElementById('cardSaidasSub');
  if (cardSaldoSub) cardSaldoSub.textContent = getMesAnoLabel();
  if (cardEntradasSub) cardEntradasSub.textContent = transacoesDoMes.filter(function (t) { return t.tipo === 'receita'; }).length + ' transações';
  if (cardSaidasSub) cardSaidasSub.textContent = transacoesDoMes.filter(function (t) { return t.tipo === 'despesa'; }).length + ' transações';

  // Color saldo
  if (cardSaldo) {
    cardSaldo.style.color = saldo >= 0 ? '#1e293b' : '#dc2626';
  }

  // Atividades recentes (últimas 5)
  renderizarAtividades(transacoesDoMes);

  // Apply visibility toggle (sempre — atualiza icon e oculta se necessário)
  atualizarVisibilidadeValores();
}

// ─── Atividades recentes ────────────────────────────────────────────────
function renderizarAtividades(transacoesDoMes) {
  var container = document.getElementById('atividadesLista');
  if (!container) return;

  var ultimas = transacoesDoMes.sort(function (a, b) {
    var da = a.dataCriacao ? (a.dataCriacao.toDate ? a.dataCriacao.toDate() : new Date(a.dataCriacao)) : new Date(0);
    var db2 = b.dataCriacao ? (b.dataCriacao.toDate ? b.dataCriacao.toDate() : new Date(b.dataCriacao)) : new Date(0);
    return db2 - da;
  }).slice(0, 5);

  if (ultimas.length === 0) {
    container.innerHTML = '';
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'dash-empty';
    emptyDiv.innerHTML = '';

    var iconDiv = document.createElement('div');
    iconDiv.className = 'dash-empty-icon';
    iconDiv.textContent = '📝';
    emptyDiv.appendChild(iconDiv);

    var pEl = document.createElement('p');
    pEl.textContent = 'Nenhuma transação este mês. Comece adicionando uma receita ou despesa!';
    emptyDiv.appendChild(pEl);

    container.appendChild(emptyDiv);
    return;
  }

  container.innerHTML = '';
  ultimas.forEach(function (t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid #f1f5f9;';

    var left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:0.75rem;';

    var icon = document.createElement('div');
    icon.style.cssText = 'width:2rem;height:2rem;border-radius:0.5rem;display:flex;align-items:center;justify-content:center;font-size:0.875rem;';
    if (t.tipo === 'receita') {
      icon.style.background = '#dcfce7';
      icon.style.color = '#16a34a';
      icon.textContent = '↑';
    } else {
      icon.style.background = '#fee2e2';
      icon.style.color = '#dc2626';
      icon.textContent = '↓';
    }

    var info = document.createElement('div');
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:0.8125rem;font-weight:600;color:#1e293b;';
    nameEl.textContent = window.budSanitize ? window.budSanitize(t.descricao || t.categoria || 'Sem descrição') : (t.descricao || t.categoria || 'Sem descrição');

    var catEl = document.createElement('div');
    catEl.style.cssText = 'font-size:0.6875rem;font-weight:500;color:#94a3b8;';
    catEl.textContent = t.categoria || '';

    info.appendChild(nameEl);
    info.appendChild(catEl);
    left.appendChild(icon);
    left.appendChild(info);

    var valorEl = document.createElement('div');
    valorEl.style.cssText = 'font-size:0.875rem;font-weight:700;';
    valorEl.style.color = t.tipo === 'receita' ? '#16a34a' : '#dc2626';
    var prefix = t.tipo === 'receita' ? '+' : '-';
    valorEl.textContent = valoresOcultos ? '•••' : prefix + ' ' + formatarValor(t.valor || 0);

    row.appendChild(left);
    row.appendChild(valorEl);
    container.appendChild(row);
  });
}

// ─── Banner Trial ───────────────────────────────────────────────────────
function configurarBannerPlano(userData) {
  var banner = document.getElementById('trialBanner');
  var bannerText = document.getElementById('trialBannerText');
  if (!banner || !bannerText) return;

  var plano = userData.plano || 'free';

  if (plano === 'trial') {
    var trialFim = userData.trialFim;
    if (!trialFim) { banner.classList.remove('show'); return; }

    var fimDate = trialFim.toDate ? trialFim.toDate() : new Date(trialFim);
    var agora = new Date();
    var diffMs = fimDate - agora;
    var diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias <= 0) {
      banner.style.background = 'linear-gradient(135deg, #fee2e2, #fecaca)';
      banner.style.borderColor = '#f87171';
      banner.style.color = '#991b1b';
      bannerText.textContent = 'Período de testes encerrado. Faça upgrade para continuar usando todas as funcionalidades.';
      banner.querySelector('.trial-banner-icon').textContent = '⚠️';
      banner.classList.add('show');
    } else if (diffDias <= 3) {
      bannerText.textContent = 'Seu trial termina em ' + diffDias + (diffDias === 1 ? ' dia' : ' dias') + '! Aproveite para conhecer todas as funcionalidades.';
      banner.classList.add('show');
    } else {
      bannerText.textContent = diffDias + ' dias restantes no seu período de testes.';
      banner.classList.add('show');
    }
  } else if (plano === 'free') {
    banner.style.background = 'linear-gradient(135deg, #eff6ff, #dbeafe)';
    banner.style.borderColor = '#93c5fd';
    banner.style.color = '#1e40af';
    bannerText.textContent = 'Plano gratuito ativo. Faça upgrade para desbloquear funcionalidades premium.';
    banner.querySelector('.trial-banner-icon').textContent = '💡';
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}

// ─── Sidebar mobile ─────────────────────────────────────────────────────
function setupSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var btnHamburger = document.getElementById('btnHamburger');

  if (btnHamburger) {
    btnHamburger.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // "Em breve" links
  document.querySelectorAll('[data-soon]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.budShowToast) window.budShowToast('Em breve!', 'info');
    });
  });
}

// ─── Setup listeners Firestore ──────────────────────────────────────────
function setupListeners(uid) {
  // Transações — onSnapshot com orderBy (fix BUG 1 do cérebro)
  var transRef = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    orderBy('dataCriacao', 'desc'),
    limit(1000)
  );
  _unsubs.push(onSnapshot(transRef, function (snapshot) {
    transacoesGlobais = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    renderizarDashboard();
  }, function (err) {
    console.warn('[Dashboard] Erro ao ouvir transações:', err);
  }));
}

// ─── Cleanup listeners ─────────────────────────────────────────────────
function cleanupListeners() {
  _unsubs.forEach(function (fn) { fn(); });
  _unsubs.length = 0;
}

// ═══ AUTH GUARD ══════════════════════════════════════════════════════════
onAuthStateChanged(auth, async function (user) {
  if (!user) {
    // Não logado → redireciona para login
    window.location.href = 'index.html';
    return;
  }

  usuarioAtualId = user.uid;

  // ── Buscar dados do usuário no Firestore ──────────────────────────
  try {
    var userSnap = await getDoc(doc(db, 'usuarios', user.uid));
    var userData = userSnap.exists() ? userSnap.data() : {};

    // Guard: primeiroLogin → redirect trocar senha (fix BUG 3 do cérebro)
    if (userData.primeiroLogin === true) {
      window.location.href = 'trocar-senha.html';
      return;
    }

    // ── Nome + avatar na sidebar ────────────────────────────────────
    var nome = userData.nome || user.email || 'Usuário';
    var nomeSeguro = window.budSanitize ? window.budSanitize(nome) : nome;
    var matricula = userData.matricula || '';

    var sidebarName = document.getElementById('sidebarUserName');
    var sidebarId = document.getElementById('sidebarUserId');
    var sidebarAvatar = document.getElementById('sidebarAvatar');

    if (sidebarName) sidebarName.textContent = nomeSeguro;
    if (sidebarId) sidebarId.textContent = matricula || user.email;
    if (sidebarAvatar) sidebarAvatar.textContent = getIniciais(nomeSeguro);

    // ── Welcome text ────────────────────────────────────────────────
    var welcomeText = document.getElementById('welcomeText');
    var welcomeDate = document.getElementById('welcomeDate');
    var firstName = nomeSeguro.split(' ')[0];
    if (welcomeText) welcomeText.textContent = getSaudacao() + ', ' + firstName + '! 👋';
    if (welcomeDate) welcomeDate.textContent = formatarDataHoje();

    // ── Banner de plano/trial ───────────────────────────────────────
    configurarBannerPlano(userData);

    // ── Setup listeners de dados ────────────────────────────────────
    setupListeners(user.uid);

  } catch (err) {
    console.error('[Dashboard] Erro ao carregar dados:', err);
    if (window.budShowToast) window.budShowToast('Erro ao carregar dados.', 'error');
  }
});

// ─── Logout ─────────────────────────────────────────────────────────────
var btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async function () {
    try {
      cleanupListeners();
      await signOut(auth);
      window.location.href = 'index.html';
    } catch (err) {
      console.error('[Dashboard] Erro ao sair:', err);
      if (window.budShowToast) window.budShowToast('Erro ao sair. Tente novamente.', 'error');
    }
  });
}

// ─── Toggle valores ocultos ─────────────────────────────────────────────
var btnToggle = document.getElementById('btnToggleValues');
if (btnToggle) {
  btnToggle.addEventListener('click', function () {
    valoresOcultos = !valoresOcultos;
    localStorage.setItem('bud_valores_ocultos', valoresOcultos);
    renderizarDashboard();
  });
}

// ─── Sync ───────────────────────────────────────────────────────────────
var btnSync = document.getElementById('btnSync');
if (btnSync) {
  btnSync.addEventListener('click', function () {
    if (!usuarioAtualId) return;
    cleanupListeners();
    setupListeners(usuarioAtualId);
    if (window.budShowToast) window.budShowToast('Dados sincronizados!', 'success');
  });
}

// ─── Quick actions (placeholder — em breve) ─────────────────────────────
var btnNovaReceita = document.getElementById('btnNovaReceita');
var btnNovaDespesa = document.getElementById('btnNovaDespesa');
if (btnNovaReceita) {
  btnNovaReceita.addEventListener('click', function () {
    if (window.budShowToast) window.budShowToast('Modal de nova receita em breve!', 'info');
  });
}
if (btnNovaDespesa) {
  btnNovaDespesa.addEventListener('click', function () {
    if (window.budShowToast) window.budShowToast('Modal de nova despesa em breve!', 'info');
  });
}

// ─── Init sidebar ───────────────────────────────────────────────────────
setupSidebar();

// ─── Apply initial toggle state (oculta valores do HTML se necessário) ──
atualizarVisibilidadeValores();
