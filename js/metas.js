/**
 * metas.js — Lógica da tela de Metas Financeiras
 * Bud Finance · Firebase 10.8.1 Modular SDK
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore,
  doc, collection,
  addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

/* ─────────────────────────────────────────────────────────────────
   Firebase init
───────────────────────────────────────────────────────────────── */
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─────────────────────────────────────────────────────────────────
   Estado global
───────────────────────────────────────────────────────────────── */
let currentUser    = null;
let metasGlobal    = [];       // cache local das metas (onSnapshot)
let carteirasGlobal = [];      // cache local das carteiras
let metaEditandoId = null;     // null = nova meta; string = editando
let metaAportandoId = null;    // id da meta que receberá aporte
let _metaListenerUnsubscribe = null;
let _carteiraListenerUnsubscribe = null;

// Datepicker — prazo da meta
let dpMetaDate = null;   // Date | null
let dpMetaViewYear  = new Date().getFullYear();
let dpMetaViewMonth = new Date().getMonth();

// Datepicker — data do aporte
let dpAporteDate = new Date();
let dpAporteViewYear  = new Date().getFullYear();
let dpAporteViewMonth = new Date().getMonth();

// Custom select — carteira
let carteiraSelectedId   = null;
let carteiraSelectedLabel = 'Selecione uma conta';

/* ─────────────────────────────────────────────────────────────────
   Constantes de UI
───────────────────────────────────────────────────────────────── */
const SUGESTOES_POPULARES = [
  'Viagem dos sonhos', 'Reserva de emergência', 'Novo celular',
  'Carro próprio', 'Casa própria', 'Casamento', 'Faculdade',
  'Aposentadoria', 'Intercâmbio', 'Reformar a casa'
];

const EMOJIS_META = [...new Set([
  '🎯','🏆','✈️','🚗','🏠','💍','🎓','💰','📱','💻',
  '🌴','⛺','🎸','🎨','🏋️','🚀','💪','🌟','🔑','🏖️',
  '🐶','🐱','🌱','🎮','📚','🎵','🏄','⚽','🎭','🍕',
  '🎂','🎁','🛍️','⌚','👗','🧳','🚢','🚁','🎪','🏔️',
  '🌍','🌈','🌊','🏡','🏗️','💎','👑','🎖️','🥇','🥂',
  '🌺','🦋','🐬','🦄','🦁','🐘','🦊','🦅','🌙','☀️',
  '⚡','🔥','💫','✨','🌈','🎉','🎊','🎀','🎗️','🎟️',
  '🍦','🍫','🍷','☕','🍵','🥗','🍱','🎃','🎄','🎆',
  '🏃','🤸','🏊','🎻','🥁','🎤','📷','🎥','🔭','🔬',
  '🌿','🌵','🍀','🌾','🌸','🌼','🌻','🪴','🌳','🌲',
  '💡','🔨','⚙️','🧩','🗺️','🧭','📌','📋','🗓️','💼',
  '🧸','🎠','🎡','🎢','🪄','🧲','🪙','💳','🏦','📈'
])];

const BADGE_CONFIG = [
  { threshold: 100, emoji: '🏆', label: 'Conquistado!', bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  { threshold:  75, emoji: '🚀', label: 'Quase lá!',    bg: 'rgba(6,182,212,0.12)',  color: '#0284c7' },
  { threshold:  50, emoji: '⭐', label: 'Na metade!',   bg: 'rgba(245,158,11,0.12)', color: '#92400e' },
  { threshold:  25, emoji: '🔥', label: 'Aquecendo!',   bg: 'rgba(239,68,68,0.10)',  color: '#dc2626' },
  { threshold:   0, emoji: '🌱', label: 'Iniciando',    bg: 'rgba(99,102,241,0.10)', color: '#4338ca' },
];

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
function formatBRL(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function maskBRL(input) {
  let v = input.value.replace(/\D/g, '');
  if (!v) { input.value = ''; return; }
  let num = parseInt(v, 10) / 100;
  input.value = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getBadge(pct) {
  for (const b of BADGE_CONFIG) {
    if (pct >= b.threshold) return b;
  }
  return BADGE_CONFIG[BADGE_CONFIG.length - 1];
}

function calcSugestaoAporte(prazoStr, falta) {
  if (!prazoStr || falta <= 0) return null;
  const hoje = new Date();
  const prazo = new Date(prazoStr + 'T00:00:00');
  const diffMs = prazo - hoje;
  if (diffMs <= 0) return null;
  const diffDias = Math.ceil(diffMs / 86400000);
  if (diffDias <= 7)  return `Faltam ${diffDias} dia(s) — aporte o restante.`;
  if (diffDias <= 30) return `Aporte semanal sugerido: ${formatBRL(falta / Math.ceil(diffDias / 7))}`;
  const meses = Math.ceil(diffDias / 30.44);
  return `Aporte mensal sugerido: ${formatBRL(falta / meses)} por ${meses} mês(es)`;
}

function dateToISO(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateBR(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

/* ─────────────────────────────────────────────────────────────────
   Cleanup de listeners (ERR-015)
───────────────────────────────────────────────────────────────── */
function cleanupListeners() {
  if (_metaListenerUnsubscribe)     { _metaListenerUnsubscribe();     _metaListenerUnsubscribe = null; }
  if (_carteiraListenerUnsubscribe) { _carteiraListenerUnsubscribe(); _carteiraListenerUnsubscribe = null; }
}

/* ─────────────────────────────────────────────────────────────────
   Auth guard
───────────────────────────────────────────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  if (!user || !user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }
  try {
    await user.getIdToken(true);  // DEC-019
  } catch {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  initPage();
});

/* ─────────────────────────────────────────────────────────────────
   Inicialização da página
───────────────────────────────────────────────────────────────── */
function initPage() {
  setupSidebar();
  setupDateHeader();
  setupSummaryCards();
  setupModalMeta();
  setupModalAporte();
  setupModalHistorico();
  setupEmojiGrid();
  setupSugestoes();
  cleanupListeners();
  setupListeners();
  // Inicializar datepicker do aporte com hoje
  dpAporteDate = new Date();
  dpAporteViewYear  = dpAporteDate.getFullYear();
  dpAporteViewMonth = dpAporteDate.getMonth();
  document.getElementById('dpAporteLabel').textContent = formatDateBR(dateToISO(dpAporteDate));
  document.getElementById('aporteData').value = dateToISO(dpAporteDate);
}

function setupDateHeader() {
  const hoje = new Date();
  const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
  const str = hoje.toLocaleDateString('pt-BR', opts);
  document.getElementById('dataHoje').textContent = str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─────────────────────────────────────────────────────────────────
   Sidebar
───────────────────────────────────────────────────────────────── */
function setupSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const dashMain  = document.getElementById('dashMain');
  const overlay   = document.getElementById('sidebarOverlay');
  const btnHamb   = document.getElementById('btnHamburger');
  const btnCollapse = document.getElementById('btnSidebarCollapse');
  const btnLogout = document.getElementById('btnLogout');

  // Restaurar estado colapsado (desktop apenas)
  if (window.innerWidth > 768 && localStorage.getItem('bud_sidebar_collapsed') === '1') {
    sidebar.classList.add('collapsed');
    dashMain.classList.add('sidebar-collapsed');
    btnCollapse.textContent = '›';
  }

  btnCollapse.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    dashMain.classList.toggle('sidebar-collapsed', isCollapsed);
    btnCollapse.textContent = isCollapsed ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', isCollapsed ? '1' : '0');
  });

  btnHamb.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.style.display = 'block';
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
  });

  // Preencher dados do usuário no sidebar
  const nome = currentUser.displayName || '';
  const uid  = currentUser.uid || '';
  const avatar = document.getElementById('sidebarAvatar');
  if (nome) {
    avatar.textContent = nome.charAt(0).toUpperCase();
    document.getElementById('sidebarUserName').textContent = nome;
  }
  document.getElementById('sidebarUserId').textContent = uid.slice(0, 8) + '...';

  btnLogout.addEventListener('click', async () => {
    cleanupListeners();
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

/* ─────────────────────────────────────────────────────────────────
   onSnapshot listeners
───────────────────────────────────────────────────────────────── */
function setupListeners() {
  const uid = currentUser.uid;

  // Metas
  const metasRef = collection(db, 'usuarios', uid, 'metas');
  _metaListenerUnsubscribe = onSnapshot(
    query(metasRef, orderBy('criadoEm', 'desc')),
    (snap) => {
      metasGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMetas();
      renderSummary();
    },
    (err) => {
      window.budShowToast('Erro ao carregar metas.', 'error');
    }
  );

  // Carteiras (para dropdown de aporte)
  const cartRef = collection(db, 'usuarios', uid, 'carteiras');
  _carteiraListenerUnsubscribe = onSnapshot(
    query(cartRef, orderBy('nome', 'asc')),
    (snap) => {
      carteirasGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    () => {}
  );
}

/* ─────────────────────────────────────────────────────────────────
   Render — Summary cards
───────────────────────────────────────────────────────────────── */
function renderSummary() {
  const ativas      = metasGlobal.filter(m => (m.valorAtual || 0) < m.valorAlvo).length;
  const totalGuard  = metasGlobal.reduce((s, m) => s + (m.valorAtual || 0), 0);
  const totalAlvo   = metasGlobal.reduce((s, m) => s + (m.valorAlvo || 0), 0);
  const falta       = Math.max(0, totalAlvo - totalGuard);
  const progresso   = totalAlvo > 0 ? Math.round((totalGuard / totalAlvo) * 100) : 0;

  document.getElementById('summaryAtivas').textContent    = ativas;
  document.getElementById('summaryGuardado').textContent  = formatBRL(totalGuard);
  document.getElementById('summaryFalta').textContent     = formatBRL(falta);
  document.getElementById('summaryProgresso').textContent = `${Math.min(100, progresso)}%`;
}

/* ─────────────────────────────────────────────────────────────────
   Render — Grid de metas
───────────────────────────────────────────────────────────────── */
function renderMetas() {
  const grid  = document.getElementById('metasGrid');
  const empty = document.getElementById('metasEmpty');
  grid.innerHTML = '';

  if (metasGlobal.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  metasGlobal.forEach(meta => {
    const valorAtual = meta.valorAtual || 0;
    const valorAlvo  = meta.valorAlvo  || 0;
    const pct        = valorAlvo > 0 ? Math.min(100, Math.round((valorAtual / valorAlvo) * 100)) : 0;
    const badge      = getBadge(pct);
    const falta      = Math.max(0, valorAlvo - valorAtual);
    const sugestao   = calcSugestaoAporte(meta.prazo || null, falta);

    const card = document.createElement('div');
    card.className = 'meta-card';
    card.setAttribute('data-id', meta.id);

    // Header
    const header = document.createElement('div');
    header.className = 'meta-card-header';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'meta-card-icon';
    iconDiv.textContent = meta.emoji || '🎯';

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex:1;min-width:0;';

    const title = document.createElement('div');
    title.className = 'meta-card-title';
    title.textContent = meta.nome || 'Meta';

    // Badge
    const badgeEl = document.createElement('span');
    badgeEl.className = 'meta-badge';
    badgeEl.style.cssText = `background:${badge.bg};color:${badge.color};margin-top:0.25rem;`;
    badgeEl.textContent = `${badge.emoji} ${badge.label}`;

    infoDiv.appendChild(title);
    infoDiv.appendChild(badgeEl);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'meta-card-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'meta-icon-btn';
    btnEdit.title = 'Editar';
    btnEdit.textContent = '✏️';
    btnEdit.addEventListener('click', () => abrirModalEditar(meta.id));

    const btnDel = document.createElement('button');
    btnDel.className = 'meta-icon-btn danger';
    btnDel.title = 'Excluir';
    btnDel.textContent = '🗑️';
    btnDel.addEventListener('click', () => confirmarExclusao(meta.id, meta.nome || 'Meta'));

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);

    header.appendChild(iconDiv);
    header.appendChild(infoDiv);
    header.appendChild(actions);

    // Barra de progresso
    const progressWrap = document.createElement('div');
    progressWrap.className = 'meta-progress-wrap';

    const barBg = document.createElement('div');
    barBg.className = 'meta-progress-bar-bg';
    const bar = document.createElement('div');
    bar.className = 'meta-progress-bar' + (pct >= 100 ? ' done' : '');
    bar.style.width = '0%';
    setTimeout(() => { bar.style.width = `${pct}%`; }, 80);
    barBg.appendChild(bar);

    const labelsRow = document.createElement('div');
    labelsRow.className = 'meta-progress-labels';

    const pctLabel = document.createElement('span');
    pctLabel.className = 'meta-progress-pct';
    pctLabel.textContent = `${pct}%`;

    const valsLabel = document.createElement('span');
    valsLabel.className = 'meta-progress-vals';
    valsLabel.textContent = `${formatBRL(valorAtual)} / ${formatBRL(valorAlvo)}`;

    labelsRow.appendChild(pctLabel);
    labelsRow.appendChild(valsLabel);
    progressWrap.appendChild(barBg);
    progressWrap.appendChild(labelsRow);

    // Prazo
    let deadlineEl = null;
    if (meta.prazo) {
      deadlineEl = document.createElement('div');
      deadlineEl.className = 'meta-deadline';
      deadlineEl.textContent = `⏰ Prazo: ${formatDateBR(meta.prazo)}`;
    }

    // Sugestão de aporte mensal
    let sugestaoEl = null;
    if (sugestao && pct < 100) {
      sugestaoEl = document.createElement('div');
      sugestaoEl.className = 'meta-sugestao';
      sugestaoEl.textContent = `💡 ${sugestao}`;
    }

    // Botões de ação inferiores
    const btnsRow = document.createElement('div');
    btnsRow.style.cssText = 'display:flex;gap:0.5rem;';

    const btnAportar = document.createElement('button');
    btnAportar.className = 'btn-aportar';
    btnAportar.style.cssText = 'flex:1;';
    btnAportar.textContent = '💰 Depositar';
    btnAportar.addEventListener('click', () => abrirModalAporte(meta.id, meta.nome));

    const btnHistorico = document.createElement('button');
    btnHistorico.style.cssText = 'padding:0.625rem 0.75rem;border-radius:0.75rem;border:1.5px solid var(--input-border);background:transparent;font-size:0.8125rem;font-weight:700;color:var(--card-text-sec);cursor:pointer;font-family:inherit;transition:background .15s;white-space:nowrap;';
    btnHistorico.textContent = '📋';
    btnHistorico.title = 'Histórico';
    btnHistorico.addEventListener('click', () => abrirHistorico(meta.id, meta.nome));

    btnsRow.appendChild(btnAportar);
    btnsRow.appendChild(btnHistorico);

    // Montar card
    card.appendChild(header);
    card.appendChild(progressWrap);
    if (deadlineEl) card.appendChild(deadlineEl);
    if (sugestaoEl) card.appendChild(sugestaoEl);
    card.appendChild(btnsRow);

    grid.appendChild(card);

    // Confetti se chegou a 100% nesta renderização
    if (pct >= 100 && !meta._confettiShown) {
      dispararConfetti();
      // Marcar para não disparar de novo nesta sessão
      meta._confettiShown = true;
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   Confetti
───────────────────────────────────────────────────────────────── */
function dispararConfetti() {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left:${Math.random() * 100}vw;
      top:-20px;
      width:${6 + Math.random() * 6}px;
      height:${10 + Math.random() * 6}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      transform:rotate(${Math.random() * 360}deg);
      animation-duration:${2 + Math.random() * 2}s;
      animation-delay:${Math.random() * 0.8}s;
    `;
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}

/* ─────────────────────────────────────────────────────────────────
   Emoji grid
───────────────────────────────────────────────────────────────── */
function setupEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  EMOJIS_META.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn';
    btn.textContent = em;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-btn.selected').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('emojiSelecionado').textContent = em;
    });
    grid.appendChild(btn);
  });
  // Selecionar primeiro por padrão
  if (grid.firstChild) grid.firstChild.classList.add('selected');
}

/* ─────────────────────────────────────────────────────────────────
   Sugestões populares
───────────────────────────────────────────────────────────────── */
function setupSugestoes() {
  const container = document.getElementById('sugestoesGrid');
  SUGESTOES_POPULARES.forEach(s => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sugestao-chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      document.getElementById('metaNome').value = s;
      container.querySelectorAll('.sugestao-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
    container.appendChild(chip);
  });
}

/* ─────────────────────────────────────────────────────────────────
   Modal — Nova / Editar Meta
───────────────────────────────────────────────────────────────── */
function setupModalMeta() {
  const modal  = document.getElementById('modalMeta');
  const form   = document.getElementById('formMeta');
  const btnNova    = document.getElementById('btnNovaMeta');
  const btnFechar  = document.getElementById('btnFecharModalMeta');
  const btnCancel  = document.getElementById('btnCancelarMeta');

  btnNova.addEventListener('click', () => abrirModalNova());
  btnFechar.addEventListener('click', () => fecharModalMeta());
  btnCancel.addEventListener('click', () => fecharModalMeta());
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModalMeta(); });

  // Máscara BRL nos campos de valor
  document.getElementById('metaValorAlvo').addEventListener('input', function() { maskBRL(this); });
  document.getElementById('metaValorAtual').addEventListener('input', function() { maskBRL(this); });

  form.addEventListener('submit', handleSubmitMeta);

  // Datepicker prazo
  setupDatepicker({
    triggerId:   'dpMetaTrigger',
    calendarId:  'dpMetaCalendar',
    labelId:     'dpMetaLabel',
    daysId:      'dpMetaDays',
    monthLabelId:'dpMetaMonthLabel',
    prevId:      'dpMetaPrev',
    nextId:      'dpMetaNext',
    clearId:     'dpMetaClear',
    hiddenId:    'metaPrazo',
    getDate:     () => dpMetaDate,
    setDate:     (d) => { dpMetaDate = d; },
    getViewYear: () => dpMetaViewYear,
    setViewYear: (y) => { dpMetaViewYear = y; },
    getViewMonth:() => dpMetaViewMonth,
    setViewMonth:(m) => { dpMetaViewMonth = m; },
    emptyLabel:  'Sem prazo',
    allowPast:   false,
  });
}

function abrirModalNova() {
  metaEditandoId = null;
  document.getElementById('modalMetaTitle').textContent = 'Nova Meta';
  document.getElementById('formMeta').reset();
  document.getElementById('metaId').value = '';
  document.getElementById('emojiSelecionado').textContent = '🎯';
  document.querySelectorAll('.emoji-btn.selected').forEach(b => b.classList.remove('selected'));
  const firstEmoji = document.querySelector('#emojiGrid .emoji-btn');
  if (firstEmoji) firstEmoji.classList.add('selected');
  document.querySelectorAll('.sugestao-chip.selected').forEach(c => c.classList.remove('selected'));
  document.getElementById('metaValorAtual').disabled = false;
  // Reset datepicker prazo
  dpMetaDate = null;
  dpMetaViewYear  = new Date().getFullYear();
  dpMetaViewMonth = new Date().getMonth();
  document.getElementById('dpMetaLabel').textContent = 'Sem prazo';
  document.getElementById('metaPrazo').value = '';
  document.getElementById('modalMeta').classList.add('open');
}

function abrirModalEditar(id) {
  const meta = metasGlobal.find(m => m.id === id);
  if (!meta) return;
  metaEditandoId = id;
  document.getElementById('modalMetaTitle').textContent = 'Editar Meta';
  document.getElementById('metaId').value = id;
  document.getElementById('metaNome').value = meta.nome || '';
  document.getElementById('metaValorAlvo').value = formatBRL(meta.valorAlvo || 0);
  document.getElementById('metaValorAtual').value = formatBRL(meta.valorAtual || 0);
  document.getElementById('metaValorAtual').disabled = true; // DEC — campo bloqueado em edição
  document.getElementById('emojiSelecionado').textContent = meta.emoji || '🎯';
  // Selecionar emoji no grid
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    if (btn.textContent === (meta.emoji || '🎯')) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
  document.querySelectorAll('.sugestao-chip.selected').forEach(c => c.classList.remove('selected'));
  // Prazo
  if (meta.prazo) {
    const d = new Date(meta.prazo + 'T00:00:00');
    dpMetaDate = d;
    dpMetaViewYear  = d.getFullYear();
    dpMetaViewMonth = d.getMonth();
    document.getElementById('dpMetaLabel').textContent = formatDateBR(meta.prazo);
    document.getElementById('metaPrazo').value = meta.prazo;
  } else {
    dpMetaDate = null;
    dpMetaViewYear  = new Date().getFullYear();
    dpMetaViewMonth = new Date().getMonth();
    document.getElementById('dpMetaLabel').textContent = 'Sem prazo';
    document.getElementById('metaPrazo').value = '';
  }
  document.getElementById('modalMeta').classList.add('open');
}

function fecharModalMeta() {
  document.getElementById('modalMeta').classList.remove('open');
  document.getElementById('dpMetaCalendar').classList.remove('open');
  document.getElementById('dpMetaTrigger').classList.remove('open');
  metaEditandoId = null;
}

async function handleSubmitMeta(e) {
  e.preventDefault();
  const nome = window.budSanitize(document.getElementById('metaNome').value.trim());
  if (!nome) {
    window.budShowToast('Informe o nome da meta.', 'error');
    return;
  }
  const valorAlvo = parseBRL(document.getElementById('metaValorAlvo').value);
  if (valorAlvo <= 0) {
    window.budShowToast('O valor da meta deve ser maior que zero.', 'error');
    return;
  }
  const emoji = document.getElementById('emojiSelecionado').textContent || '🎯';
  const prazo = document.getElementById('metaPrazo').value || null;

  const btn = document.getElementById('btnSalvarMeta');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const uid = currentUser.uid;
    if (metaEditandoId) {
      // Editar — valorAtual NÃO é atualizado aqui (apenas via aporte)
      await updateDoc(doc(db, 'usuarios', uid, 'metas', metaEditandoId), {
        nome, emoji, valorAlvo, prazo,
        atualizadoEm: serverTimestamp(),
      });
      window.budShowToast('Meta atualizada!', 'success');
    } else {
      const valorAtual = parseBRL(document.getElementById('metaValorAtual').value);
      await addDoc(collection(db, 'usuarios', uid, 'metas'), {
        nome, emoji, valorAlvo, valorAtual, prazo,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      window.budShowToast('Meta criada! 🎯', 'success');
    }
    fecharModalMeta();
  } catch {
    window.budShowToast('Erro ao salvar. Verifique sua conexão.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Meta';
  }
}

/* ─────────────────────────────────────────────────────────────────
   Modal — Aporte (Depositar)
───────────────────────────────────────────────────────────────── */
function setupModalAporte() {
  const modal     = document.getElementById('modalAporte');
  const form      = document.getElementById('formAporte');
  const btnFechar = document.getElementById('btnFecharModalAporte');
  const btnCancel = document.getElementById('btnCancelarAporte');

  btnFechar.addEventListener('click', () => fecharModalAporte());
  btnCancel.addEventListener('click', () => fecharModalAporte());
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModalAporte(); });

  document.getElementById('aporteValor').addEventListener('input', function() { maskBRL(this); });

  form.addEventListener('submit', handleSubmitAporte);

  // Datepicker aporte
  setupDatepicker({
    triggerId:   'dpAporteTrigger',
    calendarId:  'dpAporteCalendar',
    labelId:     'dpAporteLabel',
    daysId:      'dpAporteDays',
    monthLabelId:'dpAporteMonthLabel',
    prevId:      'dpAportePrev',
    nextId:      'dpAporteNext',
    clearId:     null,
    hiddenId:    'aporteData',
    getDate:     () => dpAporteDate,
    setDate:     (d) => { dpAporteDate = d; },
    getViewYear: () => dpAporteViewYear,
    setViewYear: (y) => { dpAporteViewYear = y; },
    getViewMonth:() => dpAporteViewMonth,
    setViewMonth:(m) => { dpAporteViewMonth = m; },
    emptyLabel:  'Selecione a data',
    allowPast:   true,
  });

  // Custom select de carteira
  setupCarteiraSelect();
}

function abrirModalAporte(metaId, metaNome) {
  metaAportandoId = metaId;
  document.getElementById('aporteMetaId').value  = metaId;
  document.getElementById('modalAporteTitle').textContent = `💰 Depositar — ${metaNome}`;
  document.getElementById('aporteValor').value = '';
  // Resetar carteira
  carteiraSelectedId    = null;
  carteiraSelectedLabel = 'Selecione uma conta';
  document.getElementById('carteiraSelectLabel').textContent = carteiraSelectedLabel;
  document.getElementById('aporteCarteiraId').value = '';
  // Data: hoje
  dpAporteDate = new Date();
  dpAporteViewYear  = dpAporteDate.getFullYear();
  dpAporteViewMonth = dpAporteDate.getMonth();
  document.getElementById('dpAporteLabel').textContent = formatDateBR(dateToISO(dpAporteDate));
  document.getElementById('aporteData').value = dateToISO(dpAporteDate);
  // Popular dropdown de carteiras
  popularDropdownCarteiras();
  document.getElementById('modalAporte').classList.add('open');
}

function fecharModalAporte() {
  document.getElementById('modalAporte').classList.remove('open');
  document.getElementById('dpAporteCalendar').classList.remove('open');
  document.getElementById('dpAporteTrigger').classList.remove('open');
  document.getElementById('carteiraSelectDropdown').classList.remove('open');
  document.getElementById('carteiraSelectTrigger').classList.remove('open');
  metaAportandoId = null;
}

function popularDropdownCarteiras() {
  const dropdown = document.getElementById('carteiraSelectDropdown');
  dropdown.innerHTML = '';
  // Excluir cartões de crédito (DEC — metas.md bug #11)
  const contas = carteirasGlobal.filter(c => c.tipo !== 'credito');
  if (contas.length === 0) {
    const item = document.createElement('div');
    item.className = 'custom-select-option';
    item.style.cssText = 'color:var(--card-text-sec);font-style:italic;';
    item.textContent = 'Nenhuma conta encontrada';
    dropdown.appendChild(item);
    return;
  }
  contas.forEach(c => {
    const item = document.createElement('div');
    item.className = 'custom-select-option';
    item.setAttribute('role', 'option');
    item.textContent = `${c.icone || '🏦'} ${c.nome || 'Conta'}`;
    item.addEventListener('click', () => {
      carteiraSelectedId    = c.id;
      carteiraSelectedLabel = item.textContent;
      document.getElementById('carteiraSelectLabel').textContent = carteiraSelectedLabel;
      document.getElementById('aporteCarteiraId').value = c.id;
      dropdown.classList.remove('open');
      document.getElementById('carteiraSelectTrigger').classList.remove('open');
    });
    dropdown.appendChild(item);
  });
}

function setupCarteiraSelect() {
  const trigger  = document.getElementById('carteiraSelectTrigger');
  const dropdown = document.getElementById('carteiraSelectDropdown');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('carteiraSelectWrap').contains(e.target)) {
      dropdown.classList.remove('open');
      trigger.classList.remove('open');
    }
  });
}

async function handleSubmitAporte(e) {
  e.preventDefault();
  const valor = parseBRL(document.getElementById('aporteValor').value);
  if (valor <= 0) {
    window.budShowToast('Informe um valor válido para o depósito.', 'error');
    return;
  }
  const dataISO = document.getElementById('aporteData').value;
  if (!dataISO) {
    window.budShowToast('Selecione a data do depósito.', 'error');
    return;
  }
  const carteiraId = document.getElementById('aporteCarteiraId').value;
  if (!carteiraId) {
    window.budShowToast('Selecione a conta de origem.', 'error');
    return;
  }

  const meta = metasGlobal.find(m => m.id === metaAportandoId);
  if (!meta) { window.budShowToast('Meta não encontrada.', 'error'); return; }

  const btn = document.getElementById('btnConfirmarAporte');
  btn.disabled = true;
  btn.textContent = 'Confirmando...';

  try {
    const uid = currentUser.uid;
    const batch = writeBatch(db);

    // 1. Atualizar valorAtual da meta
    const metaRef = doc(db, 'usuarios', uid, 'metas', metaAportandoId);
    const novoValor = (meta.valorAtual || 0) + valor;
    batch.update(metaRef, {
      valorAtual: novoValor,
      atualizadoEm: serverTimestamp(),
    });

    // 2. Registrar transação vinculada
    const txRef = doc(collection(db, 'usuarios', uid, 'transacoes'));
    batch.set(txRef, {
      tipo: 'despesa',
      descricao: `Aporte: ${meta.nome}`.substring(0, 100),
      valor,
      data: dataISO,
      carteiraId,
      origem: 'meta',
      metaId: metaAportandoId,
      dataCriacao: serverTimestamp(),
    });

    // 3. Debitar saldo da carteira
    const cartRef = doc(db, 'usuarios', uid, 'carteiras', carteiraId);
    batch.update(cartRef, { saldo: increment(-valor) });

    await batch.commit();

    // 4. Registrar no histórico de aportes (subcoleção) — após batch
    await addDoc(collection(db, 'usuarios', uid, 'metas', metaAportandoId, 'depositos'), {
      valor,
      data: dataISO,
      carteiraId,
      dataCriacao: serverTimestamp(),
    });

    window.budShowToast('Depósito registrado! 💰', 'success');
    fecharModalAporte();
  } catch {
    window.budShowToast('Erro ao registrar depósito. Verifique sua conexão.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Aporte';
  }
}

/* ─────────────────────────────────────────────────────────────────
   Modal — Histórico de aportes
───────────────────────────────────────────────────────────────── */
function setupModalHistorico() {
  const modal     = document.getElementById('modalHistorico');
  const btnFechar = document.getElementById('btnFecharHistorico');
  btnFechar.addEventListener('click', () => fecharHistorico());
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharHistorico(); });
}

async function abrirHistorico(metaId, metaNome) {
  document.getElementById('modalHistoricoTitle').textContent = `📋 ${metaNome}`;
  document.getElementById('historicoList').innerHTML = '<p style="text-align:center;color:var(--card-text-sec);font-size:0.875rem;padding:2rem 0;">Carregando...</p>';
  document.getElementById('modalHistorico').classList.add('open');

  try {
    const uid = currentUser.uid;
    const snap = await getDocs(
      query(
        collection(db, 'usuarios', uid, 'metas', metaId, 'depositos'),
        orderBy('dataCriacao', 'desc')
      )
    );
    const list = document.getElementById('historicoList');
    if (snap.empty) {
      list.innerHTML = '<p style="text-align:center;color:var(--card-text-sec);font-size:0.875rem;padding:2rem 0;">Nenhum depósito registrado ainda.</p>';
      return;
    }
    list.innerHTML = '';
    snap.docs.forEach(d => {
      const dep = d.data();
      const item = document.createElement('div');
      item.className = 'historico-item';

      const left = document.createElement('div');
      const valor = document.createElement('div');
      valor.className = 'historico-valor';
      valor.textContent = formatBRL(dep.valor || 0);
      const dataEl = document.createElement('div');
      dataEl.className = 'historico-meta';
      dataEl.textContent = dep.data ? formatDateBR(dep.data) : '—';
      left.appendChild(valor);
      left.appendChild(dataEl);
      item.appendChild(left);
      list.appendChild(item);
    });
  } catch {
    document.getElementById('historicoList').innerHTML = '<p style="text-align:center;color:#ef4444;font-size:0.875rem;padding:1rem 0;">Erro ao carregar histórico.</p>';
  }
}

function fecharHistorico() {
  document.getElementById('modalHistorico').classList.remove('open');
}

/* ─────────────────────────────────────────────────────────────────
   Excluir meta
───────────────────────────────────────────────────────────────── */
function confirmarExclusao(metaId, metaNome) {
  // Mini-modal inline via style.cssText (DEC-006, DEC-022)
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--card-bg);border:1px solid var(--card-border);border-radius:1.25rem;padding:1.75rem;width:100%;max-width:360px;box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);';

  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:2.5rem;text-align:center;margin-bottom:0.75rem;';
  icon.textContent = '🗑️';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:1rem;font-weight:800;color:var(--card-text);text-align:center;margin-bottom:0.375rem;';
  title.textContent = 'Excluir meta?';

  const desc = document.createElement('div');
  desc.style.cssText = 'font-size:0.8125rem;font-weight:500;color:var(--card-text-sec);text-align:center;margin-bottom:1.5rem;line-height:1.5;';
  desc.textContent = `"${metaNome}" e todo o histórico de aportes serão excluídos. Esta ação não pode ser desfeita.`;

  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:0.75rem;';

  const btnCancel = document.createElement('button');
  btnCancel.style.cssText = 'flex:1;padding:0.625rem;border-radius:0.75rem;border:none;background:rgba(0,0,0,0.06);font-size:0.875rem;font-weight:700;color:var(--card-text);cursor:pointer;font-family:inherit;';
  btnCancel.textContent = 'Cancelar';
  btnCancel.addEventListener('click', () => overlay.remove());

  const btnConfirm = document.createElement('button');
  btnConfirm.style.cssText = 'flex:1;padding:0.625rem;border-radius:0.75rem;border:none;background:#dc2626;font-size:0.875rem;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;';
  btnConfirm.textContent = 'Excluir';
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.textContent = 'Excluindo...';
    btnConfirm.disabled = true;
    try {
      await excluirMeta(metaId);
      window.budShowToast('Meta excluída.', 'success');
    } catch {
      window.budShowToast('Erro ao excluir. Tente novamente.', 'error');
    }
    overlay.remove();
  });

  btns.appendChild(btnCancel);
  btns.appendChild(btnConfirm);
  box.appendChild(icon);
  box.appendChild(title);
  box.appendChild(desc);
  box.appendChild(btns);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

async function excluirMeta(metaId) {
  const uid = currentUser.uid;
  const batch = writeBatch(db);

  // 1. Excluir todos os depósitos da subcoleção
  const deposSnap = await getDocs(collection(db, 'usuarios', uid, 'metas', metaId, 'depositos'));
  deposSnap.docs.forEach(d => batch.delete(d.ref));

  // 2. Excluir transações vinculadas
  const txSnap = await getDocs(
    query(collection(db, 'usuarios', uid, 'transacoes'),
      where('origem', '==', 'meta'),
      where('metaId', '==', metaId)
    )
  );
  txSnap.docs.forEach(d => batch.delete(d.ref));

  // 3. Excluir o doc da meta
  batch.delete(doc(db, 'usuarios', uid, 'metas', metaId));

  await batch.commit();
}

/* ─────────────────────────────────────────────────────────────────
   Custom Datepicker (DEC-018 — nunca input[type="date"] nativo)
───────────────────────────────────────────────────────────────── */
function setupDatepicker({
  triggerId, calendarId, labelId, daysId, monthLabelId,
  prevId, nextId, clearId, hiddenId,
  getDate, setDate,
  getViewYear, setViewYear, getViewMonth, setViewMonth,
  emptyLabel, allowPast
}) {
  const trigger   = document.getElementById(triggerId);
  const calendar  = document.getElementById(calendarId);
  const labelEl   = document.getElementById(labelId);
  const daysEl    = document.getElementById(daysId);
  const monthLabel= document.getElementById(monthLabelId);
  const prevBtn   = document.getElementById(prevId);
  const nextBtn   = document.getElementById(nextId);
  const hiddenEl  = document.getElementById(hiddenId);

  function render() {
    const y = getViewYear();
    const m = getViewMonth();
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    monthLabel.textContent = `${MONTHS[m]} ${y}`;
    daysEl.innerHTML = '';
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    // Empty slots
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('button');
      empty.type = 'button'; empty.className = 'dp-day empty'; empty.disabled = true;
      daysEl.appendChild(empty);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.className = 'dp-day';
      dayBtn.textContent = d;
      const thisDate = new Date(y, m, d);
      const isToday = thisDate.toDateString() === today.toDateString();
      const selected = getDate();
      const isSelected = selected && thisDate.toDateString() === selected.toDateString();
      if (isToday) dayBtn.classList.add('today');
      if (isSelected) dayBtn.classList.add('selected');
      if (!allowPast && thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        dayBtn.disabled = true;
        dayBtn.classList.add('empty');
      } else {
        dayBtn.addEventListener('click', () => {
          setDate(new Date(y, m, d));
          const iso = dateToISO(getDate());
          labelEl.textContent = formatDateBR(iso);
          hiddenEl.value = iso;
          calendar.classList.remove('open');
          trigger.classList.remove('open');
          render();
        });
      }
      daysEl.appendChild(dayBtn);
    }
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = calendar.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
    if (isOpen) render();
  });

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let m = getViewMonth() - 1;
    let y = getViewYear();
    if (m < 0) { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
    render();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let m = getViewMonth() + 1;
    let y = getViewYear();
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
    render();
  });

  if (clearId) {
    document.getElementById(clearId).addEventListener('click', (e) => {
      e.stopPropagation();
      setDate(null);
      labelEl.textContent = emptyLabel;
      hiddenEl.value = '';
      calendar.classList.remove('open');
      trigger.classList.remove('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (!calendar.contains(e.target) && e.target !== trigger) {
      calendar.classList.remove('open');
      trigger.classList.remove('open');
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   Keyboard — fechar modais com Escape
───────────────────────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('modalHistorico').classList.contains('open')) {
    fecharHistorico(); return;
  }
  if (document.getElementById('modalAporte').classList.contains('open')) {
    fecharModalAporte(); return;
  }
  if (document.getElementById('modalMeta').classList.contains('open')) {
    fecharModalMeta(); return;
  }
});

/* ─────────────────────────────────────────────────────────────────
   Placeholder cards de resumo durante carregamento
───────────────────────────────────────────────────────────────── */
function setupSummaryCards() {
  // já inicializados com valores "0" no HTML — nada a fazer aqui
}
