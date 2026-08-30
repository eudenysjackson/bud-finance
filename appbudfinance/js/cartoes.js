// js/cartoes.js — Cartões de Crédito
// DEC-034: Persiste em usuarios/{uid}/carteira com tipo:'credito'
// Fatura calculada dinamicamente (sem campos denormalizados)
// Firebase Modular SDK 10.8.1

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, deleteDoc, getDocs, getDoc, where, doc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { connectEmulators } from './bud-emulator-connect.js';

// ─── Constantes ──────────────────────────────────────────────────────────────

const CARD_GRADIENTS = {
  roxo:     'linear-gradient(135deg,#7c3aed 0%,#4c1d95 100%)',
  azul:     'linear-gradient(135deg,#2563eb 0%,#1e3a8a 100%)',
  teal:     'linear-gradient(135deg,#0d9488 0%,#134e4a 100%)',
  verde:    'linear-gradient(135deg,#16a34a 0%,#14532d 100%)',
  laranja:  'linear-gradient(135deg,#f97316 0%,#c2410c 100%)',
  vermelho: 'linear-gradient(135deg,#ef4444 0%,#991b1b 100%)',
  rosa:     'linear-gradient(135deg,#ec4899 0%,#9d174d 100%)',
  amarelo:  'linear-gradient(135deg,#d97706 0%,#78350f 100%)',
  cyan:     'linear-gradient(135deg,#0891b2 0%,#164e63 100%)',
  preto:    'linear-gradient(135deg,#374151 0%,#111827 100%)',
};

const BANDEIRA_LABELS = {
  visa:       'VISA',
  mastercard: 'MC',
  elo:        'ELO',
  amex:       'AMEX',
  hipercard:  'HIPER',
  outro:      '••••',
};

// CATEGORIAS_PADRAO removido — usa window.BUD_CATEGORIAS_PADRAO (categorias-padrao.js)

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Estado ──────────────────────────────────────────────────────────────────

let db, auth, uid;
let cartoesGlobal   = [];
let transacoesGlobal = [];
let categoriasGlobal = [];
let _filtroCartaoId  = '';   // PEND-010: '' = todos

let mesVisualizando  = new Date().getMonth();    // 0-based
let anoVisualizando  = new Date().getFullYear();

let cartaoEditandoId = null;
let cartaoParaGasto  = null;  // id ao abrir modal gasto
let gastoEditandoId  = null;  // id ao editar gasto (null = novo)
let cartaoParaExcluir = null;
let gastoParaExcluir  = null;
let gastoParaStatus   = null;  // { id, desc } ao abrir modal status
let cartaoParaPagar   = null;
let contaParaPagarId  = null;  // conta selecionada no modal Pagar Fatura (null = só marcar)
let cartaoImportIA    = null;  // id ao abrir modal import IA
let itensIAExtraidos  = [];    // transações extraídas pela IA
let _importMetaIA     = null;  // meta do PDF (totalCompras) para barra de confiabilidade

let dpGastoMes  = new Date().getMonth();
let dpGastoAno  = new Date().getFullYear();
let dpGastoData = null; // 'YYYY-MM-DD'

let unsubs = [];

// ─── Auth Guard ──────────────────────────────────────────────────────────────

(async () => {
  try {
    if (!window.BUD_FIREBASE_CONFIG) throw new Error('config missing');
    const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
    auth = getAuth(app);
    db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();
    connectEmulators(auth, db);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try { await user.reload(); user = auth.currentUser; } catch (_) { user = null; }
      }
      if (!user || !user.emailVerified) {
        window.location.href = 'index.html';
        return;
      }
      try {
        await user.getIdToken(); // usa cache; Firebase renova quando expirado
      } catch {
        window.location.href = 'index.html';
        return;
      }
      uid = user.uid;
      // DT-002: carregar plano real do usuário para limite de cartões
      try {
        const _ud = await getDoc(doc(db, 'usuarios', uid));
        const _udData = _ud.data() || {};
        window._cartoesUserPlano = _udData.plano || null;
        window._cartoesUserPhotoURL = _udData.photoURL || null;
        window._cartoesUserNome = _udData.nome || null;
      } catch (_) { window._cartoesUserPlano = null; }
      setupUI(user);
      setupListeners();
      window.addEventListener('beforeunload', cleanupListeners, { once: true });
    });
  } catch {
    window.location.href = 'index.html';
  }
})();

// ─── UI Setup ────────────────────────────────────────────────────────────────

function setupUI(user) {
  // Data de hoje
  const hoje = new Date();
  const el = document.getElementById('dataHoje');
  if (el) el.textContent = hoje.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  // Sidebar: avatar e nome
  const name = user.displayName || user.email?.split('@')[0] || 'Usuário';
  const av = document.getElementById('sidebarAvatar');
  const nm = document.getElementById('sidebarUserName');
  const id = document.getElementById('sidebarUserId');
  if (av) av.textContent = name.charAt(0).toUpperCase();
  if (nm) nm.textContent = name;
  if (id) id.textContent = user.email || '';
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(window._cartoesUserPhotoURL || null, window._cartoesUserNome || name);

  setupSidebar();
  setupMesNav();
  setupModais();
  setupFormCartao();
  setupFormGasto();
  setupCorPicker();
  setupBandeiraSelect();
  setupCatGastoSelect();
  setupDatepickerGasto();
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function setupSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const btn      = document.getElementById('btnSidebarCollapse');
  const main     = document.getElementById('dashMain');
  const overlay  = document.getElementById('sidebarOverlay');
  const hamburger= document.getElementById('btnHamburger');
  const logout   = document.getElementById('btnLogout');

  // Collapse state
  const collapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true' && window.innerWidth > 768;
  if (collapsed) {
    sidebar.classList.add('collapsed');
    main.classList.add('sidebar-collapsed');
    btn.textContent = '›';
  }

  btn?.addEventListener('click', () => {
    const isNowCollapsed = sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed', isNowCollapsed);
    btn.textContent = isNowCollapsed ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', String(isNowCollapsed));
  });

  hamburger?.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.style.display = 'block';
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
  });

  logout?.addEventListener('click', async () => {
    cleanupListeners();
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ─── Navegação de Mês ────────────────────────────────────────────────────────

function setupMesNav() {
  atualizarLabelMes();

  document.getElementById('btnMesAnterior')?.addEventListener('click', () => {
    if (mesVisualizando === 0) { mesVisualizando = 11; anoVisualizando--; }
    else mesVisualizando--;
    atualizarLabelMes();
    renderizarCartoes();
  });

  document.getElementById('btnProximoMes')?.addEventListener('click', () => {
    if (mesVisualizando === 11) { mesVisualizando = 0; anoVisualizando++; }
    else mesVisualizando++;
    atualizarLabelMes();
    renderizarCartoes();
  });

  document.getElementById('btnHoje')?.addEventListener('click', () => {
    const now = new Date();
    if (mesVisualizando === now.getMonth() && anoVisualizando === now.getFullYear()) return;
    mesVisualizando = now.getMonth();
    anoVisualizando = now.getFullYear();
    atualizarLabelMes();
    renderizarCartoes();
  });
}

function atualizarLabelMes() {
  const el = document.getElementById('labelMesAtual');
  if (el) el.textContent = `${MESES_PT[mesVisualizando]} ${anoVisualizando}`;
}

function getMesKey() {
  return `${anoVisualizando}-${String(mesVisualizando + 1).padStart(2, '0')}`;
}

// ─── Listeners Firestore ─────────────────────────────────────────────────────

function setupListeners() {
  cleanupListeners();

  // Carteira (tipo:'credito') — DEC-034
  const carteiraRef = collection(db, 'usuarios', uid, 'carteira');
  // DEC-034: sem orderBy para evitar exigência de índice composto — ordena client-side
  const qCartoes = query(
    carteiraRef,
    where('tipo', '==', 'credito'),
    limit(100)
  );
  const u1 = onSnapshot(qCartoes, (snap) => {
    cartoesGlobal = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.dataCriacao?.toMillis?.() ?? 0;
        const tb = b.dataCriacao?.toMillis?.() ?? 0;
        return ta - tb;
      });
    renderizarCartoes();
  });

  // Transações
  const txRef = collection(db, 'usuarios', uid, 'transacoes');
  const qTx = query(txRef, orderBy('dataCriacao', 'desc'), limit(5000));
  const u2 = onSnapshot(qTx, (snap) => {
    transacoesGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarCartoes();
  });

  // Categorias personalizadas
  const catRef = collection(db, 'usuarios', uid, 'categorias');
  const qCat = query(catRef, limit(200));
  const u3 = onSnapshot(qCat, (snap) => {
    categoriasGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarDropdownCategorias();
  });

  unsubs = [u1, u2, u3];
}

function cleanupListeners() {
  unsubs.forEach(u => u && u());
  unsubs = [];
}

// ─── Cálculos ────────────────────────────────────────────────────────────────

// DEC-034: Fatura calculada dinamicamente — sem campos denormalizados
function calcularFatura(cartaoId, mesKey) {
  return transacoesGlobal
    .filter(t =>
      t.cartaoId === cartaoId &&
      typeof t.dataReferencia === 'string' &&
      t.dataReferencia.startsWith(mesKey) &&
      t.status !== 'estornado' &&
      t.status !== 'cancelado' &&
      !t.pagamentoFatura
    )
    .reduce((s, t) => s + (t.valor || 0), 0);
}

function calcularStatusFatura(cartao, mesKey, temGastos) {
  if (cartao.faturasPagas?.[mesKey]) {
    return { label: 'Paga', cor: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  }
  if (!temGastos) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [anoStr, mesStr] = mesKey.split('-');
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStr) - 1; // 0-based

  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  // Mês passado sem pagamento → Vencida
  if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) {
    return { label: 'Vencida', cor: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  }

  // Mês atual
  if (ano === anoAtual && mes === mesAtual) {
    const diaHoje = hoje.getDate();
    const diaVenc = cartao.vencimento || 10;
    const diaFech = cartao.fechamento || 1;
    if (diaHoje >= diaVenc) return { label: 'Vencida', cor: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    if (diaHoje >= diaFech) {
      // Fatura fechada: mostrar countdown até vencimento
      const diasVenc = diaVenc - diaHoje;
      const labelVenc = diasVenc === 0 ? 'Vence hoje' : diasVenc <= 3 ? `Vence em ${diasVenc}d` : 'Fechada';
      return { label: labelVenc, cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    }
    // Fatura aberta: mostrar countdown até fechamento
    const diasFech = diaFech - diaHoje;
    const labelFech = diasFech === 0 ? 'Fecha hoje' : diasFech <= 5 ? `Fecha em ${diasFech}d` : 'Aberta';
    return { label: labelFech, cor: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  }

  // Mês futuro
  return { label: 'Aberta', cor: '#64748b', bg: 'rgba(100,116,139,0.10)' };
}

// ─── Renderização ─────────────────────────────────────────────────────────────

function renderizarCartoes() {
  const grid    = document.getElementById('cartoesGrid');
  const empty   = document.getElementById('cartoesEmpty');
  const loading = document.getElementById('cartoesLoading');

  loading.style.display = 'none';

  if (cartoesGlobal.length === 0) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    atualizarBanner([]);
    return;
  }

  grid.style.display  = 'grid';
  empty.style.display = 'none';

  // PEND-010: chips de filtro por cartão
  _renderizarChipsFiltro();

  const mesKey = getMesKey();
  const dadosCartoes = cartoesGlobal.map(c => {
    const fatura = calcularFatura(c.id, mesKey);
    const temGastos = fatura > 0;
    const status  = calcularStatusFatura(c, mesKey, temGastos);
    const limite  = c.limite || 0;
    const dispPct = limite > 0 ? Math.max(0, Math.min(100, ((limite - fatura) / limite) * 100)) : 100;
    const gastos  = transacoesGlobal.filter(t =>
      t.cartaoId === c.id &&
      typeof t.dataReferencia === 'string' &&
      t.dataReferencia.startsWith(mesKey) &&
      !t.pagamentoFatura
    ).sort((a, b) => {
      const da = a.dataReferencia || '';
      const db_ = b.dataReferencia || '';
      return db_ > da ? 1 : db_ < da ? -1 : 0;
    });
    return { cartao: c, fatura, temGastos, status, limite, dispPct, gastos };
  });

  atualizarBanner(dadosCartoes);

  grid.innerHTML = '';
  const exibidos = _filtroCartaoId
    ? dadosCartoes.filter(d => d.cartao.id === _filtroCartaoId)
    : dadosCartoes;
  exibidos.forEach(({ cartao, fatura, status, limite, dispPct, gastos }, idx) => {
    grid.appendChild(buildCartaoEl(cartao, fatura, status, limite, dispPct, gastos, mesKey, idx));
  });

  // Badge de mês histórico (G)
  const agora = new Date();
  const isMesAtual = mesVisualizando === agora.getMonth() && anoVisualizando === agora.getFullYear();
  const alertaEl = document.getElementById('alertaMesHistorico');
  const alertaNomeEl = document.getElementById('alertaMesNome');
  if (alertaEl) alertaEl.style.display = isMesAtual ? 'none' : '';
  if (alertaNomeEl) alertaNomeEl.textContent = `${MESES_PT[mesVisualizando]} ${anoVisualizando}`;
}

function atualizarBanner(dadosCartoes) {
  const totalFat = dadosCartoes.reduce((s, d) => s + d.fatura, 0);
  const totalLim = cartoesGlobal.reduce((s, c) => s + (c.limite || 0), 0);
  const dispTotal = totalLim - totalFat;
  const mesKey = getMesKey();
  const pagas = cartoesGlobal.filter(c => c.faturasPagas?.[mesKey]).length;
  const comGastos = dadosCartoes.filter(d => d.temGastos).length;

  document.getElementById('totalFaturas').textContent         = formatBRL(totalFat);
  document.getElementById('totalFaturasSub').textContent      = `${comGastos} ${comGastos !== 1 ? 'cartões' : 'cartão'} com gastos`;
  document.getElementById('limiteDisponivel').textContent     = formatBRL(Math.max(0, dispTotal));
  document.getElementById('limiteDisponivelSub').textContent  = `de ${formatBRL(totalLim)} total`;
  document.getElementById('faturasPagasCount').textContent    = `${pagas} / ${cartoesGlobal.length}`;
  document.getElementById('faturasPagasSub').textContent      = 'neste mês';
}

// PEND-010: chips de filtro rápido por cartão
function _renderizarChipsFiltro() {
  const bar = document.getElementById('chipsFiltroCartao');
  if (!bar) return;
  if (cartoesGlobal.length < 2) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = '';

  const chipStyle = (ativo) =>
    `padding:0.3125rem 0.75rem;border-radius:9999px;border:1.5px solid ${ativo ? '#2563eb' : 'var(--card-border)'};` +
    `background:${ativo ? '#eff6ff' : 'var(--card-bg)'};color:${ativo ? '#2563eb' : 'var(--card-text-sec)'};` +
    `font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;`;

  // chip "Todos"
  const todos = document.createElement('button');
  todos.textContent = 'Todos';
  todos.style.cssText = chipStyle(!_filtroCartaoId);
  todos.onclick = () => { _filtroCartaoId = ''; renderizarCartoes(); };
  bar.appendChild(todos);

  cartoesGlobal.forEach(c => {
    const chip = document.createElement('button');
    chip.textContent = c.nome || 'Cartão';
    chip.style.cssText = chipStyle(_filtroCartaoId === c.id);
    chip.onclick = () => { _filtroCartaoId = (_filtroCartaoId === c.id) ? '' : c.id; renderizarCartoes(); };
    bar.appendChild(chip);
  });
}

function buildCartaoEl(cartao, fatura, status, limite, dispPct, gastos, mesKey, idx = 0) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cartao-wrapper';
  wrapper.dataset.id = cartao.id;
  wrapper.style.animationDelay = `${idx * 0.07}s`;

  const grad = CARD_GRADIENTS[cartao.cor] || CARD_GRADIENTS.roxo;
  const band = BANDEIRA_LABELS[cartao.bandeira] || '••••';
  const lastFour = cartao.id.slice(-4).toUpperCase();
  const nome = (cartao.nome || 'Cartão').toUpperCase();
  const limiteDisp = Math.max(0, limite - fatura);
  const barCor = dispPct < 20 ? '#ef4444' : dispPct < 50 ? '#f59e0b' : '#10b981';
  const isPago = cartao.faturasPagas?.[mesKey];
  const ultimoDia = new Date(anoVisualizando, mesVisualizando + 1, 0).getDate();
  const extURL = `extrato.html?inicio=${mesKey}-01&fim=${mesKey}-${String(ultimoDia).padStart(2,'0')}`;
  const faturaValorCor = status?.label === 'Paga' ? '#10b981' : status?.cor === '#ef4444' ? '#ef4444' : 'var(--card-text)';

  let statusHTML = '';
  if (status) {
    statusHTML = `<span class="cartao-status-badge" style="background:${status.bg};color:${status.cor};">${status.label}</span>`;
  }

  // Gastos list
  const gastosHTML = gastos.length > 0
    ? gastos.slice(0, 10).map(g => {
        const isEst = g.status === 'estornado';
        const isCan = g.status === 'cancelado';
        const riscado = isEst || isCan;
        const badgeHTML = isEst
          ? `<span style="font-size:0.6rem;font-weight:700;background:rgba(245,158,11,0.15);color:#d97706;border-radius:0.25rem;padding:0.1rem 0.3rem;vertical-align:middle;">Estorno</span> `
          : isCan
          ? `<span style="font-size:0.6rem;font-weight:700;background:rgba(239,68,68,0.13);color:#dc2626;border-radius:0.25rem;padding:0.1rem 0.3rem;vertical-align:middle;">Cancelado</span> `
          : '';
        return `
        <div class="gasto-item" style="${riscado ? 'opacity:0.6;' : ''}">
          <div class="gasto-desc">
            <div class="gasto-desc-text" style="${riscado ? 'text-decoration:line-through;' : ''}">${badgeHTML}${escHtml(g.descricao || '—')}</div>
            <div class="gasto-desc-cat">${escHtml(g.categoria || 'Outros')} · ${formatData(g.dataReferencia)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:0.25rem;">
            <span class="gasto-valor" style="${riscado ? 'text-decoration:line-through;color:var(--card-text-sec);' : ''}">${formatBRL(g.valor || 0)}</span>
            <button class="gasto-edit-btn" data-edit-gasto-id="${g.id}" title="Editar gasto">✏️</button>
            <button class="gasto-status-btn" data-status-gasto-id="${g.id}" data-status-gasto-desc="${escHtml(g.descricao || '')}" data-status-atual="${g.status || 'ativa'}" title="Estornar/Cancelar">↩</button>
            <button class="gasto-del-btn" data-gasto-id="${g.id}" data-gasto-desc="${escHtml(g.descricao || '')}" title="Excluir gasto">🗑</button>
          </div>
        </div>
      `;
      }).join('')
    : `<div style="padding:0.625rem;font-size:0.8125rem;font-weight:500;color:var(--card-text-sec);text-align:center;">Nenhum gasto neste mês</div>`;

  const maisGastos = gastos.length > 10
    ? `<div style="padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:600;color:var(--card-text-sec);text-align:center;">+${gastos.length - 10} gastos não exibidos — <a href="${extURL}&cartaoId=${cartao.id}" style="color:var(--btn-bg);text-decoration:none;font-weight:700;">ver todos no Extrato →</a></div>`
    : '';

  wrapper.innerHTML = `
    <!-- Visual do Cartão -->
    <div class="credit-card" style="background:${grad};">
      <div class="card-top">
        <div class="card-bandeira">${band}</div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <button class="gasto-del-btn" data-edit-id="${cartao.id}" title="Editar cartão" style="color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.12);">✏️</button>
        </div>
      </div>
      <div class="card-middle">
        <div class="card-chip"></div>
        <div class="card-number" style="margin-top:0.75rem;">•••• •••• •••• ${lastFour}</div>
      </div>
      <div class="card-bottom">
        <div class="card-name">${escHtml(nome)}</div>
        <div class="card-valid">
          <div class="card-valid-label">Fecha / Vence</div>
          <div class="card-valid-value">dia ${cartao.fechamento || '—'} / ${cartao.vencimento || '—'}</div>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="cartao-info">
      <div class="cartao-fatura-row">
        <div>
          <div class="cartao-fatura-label">Fatura ${MESES_PT[mesVisualizando]}</div>
          <div class="cartao-fatura-valor" style="color:${faturaValorCor};transition:color 0.2s;">${formatBRL(fatura)}</div>
        </div>
        <div style="text-align:right;">
          ${statusHTML}
          <div style="font-size:0.6875rem;font-weight:600;color:var(--card-text-sec);margin-top:0.25rem;">Limite: ${formatBRL(limite)}</div>
        </div>
      </div>

      <!-- Barra de limite -->
      <div class="limite-wrap">
        <div class="limite-bar-bg">
          <div class="limite-bar-fill" style="width:${(100 - dispPct).toFixed(1)}%;background:${barCor};"></div>
        </div>
        <div class="limite-labels">
          <span class="limite-label">${formatBRL(fatura)} usado de ${formatBRL(limite)}</span>
          <span class="limite-label" style="color:${barCor};font-weight:700;">${(100 - dispPct).toFixed(0)}%</span>
        </div>
      </div>

      <!-- Botões de ação -->
      <div class="cartao-actions">
        <button class="cartao-btn" data-add-gasto="${cartao.id}">+ Gasto</button>
        <button class="cartao-btn" data-import-ia="${cartao.id}" title="Importar fatura com IA">📥 Fatura IA</button>
        <button class="cartao-btn cartao-btn-cta" data-pagar="${cartao.id}" style="${isPago ? 'border-color:#10b981;color:#10b981;' : ''}">
          ${isPago ? '✓ Paga' : 'Pagar Fatura'}
        </button>
        <a class="cartao-btn cartao-btn-icon" href="${extURL}" title="Ver no Extrato" style="text-decoration:none;display:flex;align-items:center;justify-content:center;">📊</a>
        <button class="cartao-btn cartao-btn-icon cartao-btn-danger" data-del-cartao="${cartao.id}" title="Excluir cartão">🗑</button>
      </div>

      <!-- Lista de gastos expansível -->
      <button class="gastos-toggle" data-toggle-gastos="${cartao.id}">
        <span>🧾 ${gastos.length} gasto${gastos.length !== 1 ? 's' : ''} neste mês</span>
        <span style="font-size:0.75rem;color:var(--card-text-sec);">▼</span>
      </button>
      <div class="gastos-lista" id="gastosList-${cartao.id}">
        ${gastosHTML}
        ${maisGastos}
      </div>
    </div>
  `;

  // Eventos
  wrapper.querySelector(`[data-edit-id="${cartao.id}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirModalCartao(cartao.id);
  });
  wrapper.querySelector(`[data-add-gasto="${cartao.id}"]`)?.addEventListener('click', () => {
    abrirModalGasto(cartao.id);
  });
  wrapper.querySelector(`[data-import-ia="${cartao.id}"]`)?.addEventListener('click', () => {
    abrirModalImportIA(cartao.id);
  });
  wrapper.querySelector(`[data-pagar="${cartao.id}"]`)?.addEventListener('click', () => {
    abrirModalPagarFatura(cartao.id, fatura);
  });
  wrapper.querySelector(`[data-del-cartao="${cartao.id}"]`)?.addEventListener('click', () => {
    abrirModalExcluirCartao(cartao.id, cartao.nome);
  });
  wrapper.querySelector(`[data-toggle-gastos="${cartao.id}"]`)?.addEventListener('click', (e) => {
    const lista = document.getElementById(`gastosList-${cartao.id}`);
    const btn = e.currentTarget;
    lista?.classList.toggle('open');
    const arrow = btn.querySelector('span:last-child');
    if (arrow) arrow.style.transform = lista?.classList.contains('open') ? 'rotate(180deg)' : '';
  });

  // Botões de excluir gasto
  wrapper.querySelectorAll('[data-gasto-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid  = btn.dataset.gastoId;
      const desc = btn.dataset.gastoDesc || 'este gasto';
      abrirModalExcluirGasto(gid, desc);
    });
  });

  // Botões de editar gasto
  wrapper.querySelectorAll('[data-edit-gasto-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editarGasto(btn.dataset.editGastoId);
    });
  });

  // Botões de estornar/cancelar gasto
  wrapper.querySelectorAll('[data-status-gasto-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModalStatusGasto(
        btn.dataset.statusGastoId,
        btn.dataset.statusGastoDesc || 'este gasto',
        btn.dataset.statusAtual || 'ativa'
      );
    });
  });

  return wrapper;
}

// ─── Modal Cartão ────────────────────────────────────────────────────────────

function setupModais() {
  // Modal Cartão
  document.getElementById('btnNovoCartao')?.addEventListener('click', () => abrirModalCartao());
  document.getElementById('btnNovoCartaoEmpty')?.addEventListener('click', () => abrirModalCartao());
  document.getElementById('btnFecharModalCartao')?.addEventListener('click', fecharModalCartao);
  document.getElementById('btnCancelarCartao')?.addEventListener('click', fecharModalCartao);

  // Modal Gasto
  document.getElementById('btnFecharModalGasto')?.addEventListener('click', fecharModalGasto);
  document.getElementById('btnCancelarGasto')?.addEventListener('click', fecharModalGasto);

  // Modal Pagar Fatura
  document.getElementById('btnCancelarPagarFatura')?.addEventListener('click', fecharModalPagarFatura);
  document.getElementById('btnConfirmarPagarFatura')?.addEventListener('click', confirmarPagarFatura);

  // Modal Excluir Cartão
  document.getElementById('btnCancelarExcluirCartao')?.addEventListener('click', fecharModalExcluirCartao);
  document.getElementById('btnConfirmarExcluirCartao')?.addEventListener('click', confirmarExcluirCartao);
  const checkExcl = document.getElementById('checkConfirmarExclusaoCartao');
  checkExcl?.addEventListener('change', () => {
    document.getElementById('btnConfirmarExcluirCartao').disabled = !checkExcl.checked;
  });

  // Modal Excluir Gasto
  document.getElementById('btnCancelarExcluirGasto')?.addEventListener('click', fecharModalExcluirGasto);
  document.getElementById('btnConfirmarExcluirGasto')?.addEventListener('click', confirmarExcluirGasto);

  // Modal Status Gasto (Estornar/Cancelar)
  document.getElementById('btnFecharModalStatusGasto')?.addEventListener('click', fecharModalStatusGasto);
  document.getElementById('btnCancelarStatusGasto')?.addEventListener('click', fecharModalStatusGasto);
  document.getElementById('btnEstornarGasto')?.addEventListener('click', () => confirmarStatusGasto('estornado'));
  document.getElementById('btnCancelarGastoStatus')?.addEventListener('click', () => confirmarStatusGasto('cancelado'));
  document.getElementById('btnReativarGasto')?.addEventListener('click', () => confirmarStatusGasto('ativa'));

  // Modal Import IA
  document.getElementById('btnFecharModalImportIA')?.addEventListener('click', fecharModalImportIA);
  document.getElementById('btnCancelarImportIA')?.addEventListener('click', fecharModalImportIA);
  document.getElementById('btnEnviarImportIA')?.addEventListener('click', enviarParaIA);
  document.getElementById('inputArquivoIA')?.addEventListener('change', onArquivoIAChange);

  // Drag-and-drop na área de upload
  const uploadArea = document.getElementById('importIA-upload-area');
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--btn-bg)';
    uploadArea.style.background = 'rgba(37,99,235,0.04)';
  });
  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--input-border)';
    uploadArea.style.background = '';
  });
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--input-border)';
    uploadArea.style.background = '';
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('inputArquivoIA');
      if (input) {
        input.files = dt.files;
        onArquivoIAChange({ target: { files: dt.files } });
      }
    }
  });

  // Modal Review IA
  document.getElementById('btnFecharModalReviewIA')?.addEventListener('click', fecharModalReviewIA);
  document.getElementById('btnVoltarReviewIA')?.addEventListener('click', () => { const cid = cartaoImportIA; fecharModalReviewIA(); abrirModalImportIA(cid, true); });
  document.getElementById('btnSalvarTransacoesIA')?.addEventListener('click', salvarTransacoesIA);

  // Month dropdown: iaMes
  _initIaMesDropdown();
  // Ano: atualizar banner ao digitar
  document.getElementById('iaAno')?.addEventListener('input', _atualizarBannerMes);

  // ESC fecha modais / Enter confirma
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      if (document.getElementById('modalPagarFatura')?.classList.contains('open')) {
        const btnP = document.getElementById('btnConfirmarPagarFatura');
        if (btnP && !btnP.disabled) { btnP.click(); return; }
      }
    }
    if (e.key !== 'Escape') return;
    if (document.getElementById('modalStatusGasto')?.classList.contains('open')) {
      fecharModalStatusGasto(); return;
    }
    if (document.getElementById('modalImportIA')?.classList.contains('open')) {
      fecharModalImportIA(); return;
    }
    if (document.getElementById('modalReviewIA')?.classList.contains('open')) {
      fecharModalReviewIA(); return;
    }
    if (document.getElementById('modalExcluirCartao')?.classList.contains('open')) {
      fecharModalExcluirCartao(); return;
    }
    if (document.getElementById('modalExcluirGasto')?.classList.contains('open')) {
      fecharModalExcluirGasto(); return;
    }
    if (document.getElementById('modalPagarFatura')?.classList.contains('open')) {
      fecharModalPagarFatura(); return;
    }
    if (document.getElementById('modalCartao')?.classList.contains('open')) {
      fecharModalCartao(); return;
    }
    if (document.getElementById('modalGasto')?.classList.contains('open')) {
      fecharModalGasto(); return;
    }
  });
}

function abrirModalCartao(id = null) {
  cartaoEditandoId = id;
  const title = document.getElementById('titleModalCartao');
  const form  = document.getElementById('formCartao');
  form.reset();

  document.getElementById('hiddenCor').value = 'roxo';
  document.querySelectorAll('.cor-pill').forEach(p => p.classList.remove('selected'));
  document.querySelector('.cor-pill[data-cor="roxo"]')?.classList.add('selected');

  // Reset selects
  setSelectValue('triggerBandeiraText', 'hiddenBandeira', '', 'Selecione...');
  document.querySelectorAll('#dropdownBandeira .custom-select-option').forEach(o => o.classList.remove('selected'));

  if (id) {
    const c = cartoesGlobal.find(x => x.id === id);
    if (!c) return;
    title.textContent = '✏️ Editar Cartão';
    document.getElementById('inputNomeCartao').value    = c.nome || '';
    document.getElementById('inputLimite').value        = formatBRL(c.limite || 0);
    document.getElementById('inputDiaFechamento').value = c.fechamento || '';
    document.getElementById('inputDiaVencimento').value = c.vencimento || '';

    const cor = c.cor || 'roxo';
    document.getElementById('hiddenCor').value = cor;
    document.querySelectorAll('.cor-pill').forEach(p => p.classList.toggle('selected', p.dataset.cor === cor));

    const bandLabel = { visa:'Visa',mastercard:'Mastercard',elo:'Elo',amex:'American Express',hipercard:'Hipercard',outro:'Outro' }[c.bandeira] || c.bandeira;
    setSelectValue('triggerBandeiraText', 'hiddenBandeira', c.bandeira || '', bandLabel);
  } else {
    title.textContent = '💳 Novo Cartão';
  }

  document.getElementById('modalCartao').classList.add('open');
  document.getElementById('inputNomeCartao').focus();
}

function fecharModalCartao() {
  document.getElementById('modalCartao').classList.remove('open');
  cartaoEditandoId = null;
}

// ─── Form Cartão ─────────────────────────────────────────────────────────────

function setupFormCartao() {
  document.getElementById('formCartao')?.addEventListener('submit', handleSubmitCartao);

  // Máscara BRL no limite
  document.getElementById('inputLimite')?.addEventListener('blur', (e) => {
    e.target.value = maskBRL(e.target.value);
  });

  // Auto-detect bandeira e cor pelo nome (PEND-016)
  const AUTO_BANCOS = [
    { match: /nubank|nu\s/i,              bandeira: 'mastercard', cor: 'roxo',     label: 'Mastercard' },
    { match: /ita[uú]|iti\b/i,            bandeira: 'mastercard', cor: 'laranja',  label: 'Mastercard' },
    { match: /bradesco/i,                 bandeira: 'mastercard', cor: 'vermelho', label: 'Mastercard' },
    { match: /santander/i,               bandeira: 'mastercard', cor: 'vermelho', label: 'Mastercard' },
    { match: /banco do brasil|cartao bb/i,bandeira: 'visa',       cor: 'amarelo',  label: 'Visa' },
    { match: /caixa|cef\b/i,              bandeira: 'visa',       cor: 'azul',     label: 'Visa' },
    { match: /inter\b|banco inter/i,      bandeira: 'mastercard', cor: 'laranja',  label: 'Mastercard' },
    { match: /xp\b|xp invest/i,           bandeira: 'visa',       cor: 'preto',    label: 'Visa' },
    { match: /c6\b|c6 bank/i,             bandeira: 'mastercard', cor: 'preto',    label: 'Mastercard' },
    { match: /sicoob|sicredi/i,           bandeira: 'visa',       cor: 'verde',    label: 'Visa' },
    { match: /elo\b/i,                    bandeira: 'elo',        cor: null,       label: 'Elo' },
    { match: /amex|american express/i,    bandeira: 'amex',       cor: 'azul',     label: 'American Express' },
    { match: /hiper(card)?/i,             bandeira: 'hipercard',  cor: 'vermelho', label: 'Hipercard' },
  ];

  document.getElementById('inputNomeCartao')?.addEventListener('input', (e) => {
    // Só auto-preenche se estiver criando (não editando)
    if (cartaoEditandoId) return;
    const nome = e.target.value.trim();
    if (!nome) return;

    const match = AUTO_BANCOS.find(b => b.match.test(nome));
    if (!match) return;

    // Auto-setar bandeira se ainda não selecionada
    const bandAtual = document.getElementById('hiddenBandeira').value;
    if (!bandAtual) {
      const bandLabels = { visa:'Visa', mastercard:'Mastercard', elo:'Elo', amex:'American Express', hipercard:'Hipercard', outro:'Outro' };
      setSelectValue('triggerBandeiraText', 'hiddenBandeira', match.bandeira, bandLabels[match.bandeira] || match.label);
      document.querySelectorAll('#dropdownBandeira .custom-select-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.value === match.bandeira);
      });
    }

    // Auto-setar cor se ainda não selecionada (mantém "roxo" se nenhuma foi clicada)
    if (match.cor) {
      const corAtual = document.getElementById('hiddenCor').value;
      // "roxo" é o default — só sobrescreve se for o default (não clicado pelo user)
      const isDefault = !corAtual || corAtual === 'roxo';
      if (isDefault) {
        document.getElementById('hiddenCor').value = match.cor;
        document.querySelectorAll('.cor-pill').forEach(p => {
          p.classList.toggle('selected', p.dataset.cor === match.cor);
        });
      }
    }
  });
}

async function handleSubmitCartao(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSalvarCartao');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const nome       = budSanitize(document.getElementById('inputNomeCartao').value.trim());
    const bandeira   = document.getElementById('hiddenBandeira').value;
    const limite     = parseBRL(document.getElementById('inputLimite').value);
    const fechamento = parseInt(document.getElementById('inputDiaFechamento').value, 10);
    const vencimento = parseInt(document.getElementById('inputDiaVencimento').value, 10);
    const cor        = document.getElementById('hiddenCor').value || 'roxo';

    if (!nome)                             { showToast('Informe o nome do cartão.', 'erro'); return; }
    if (!bandeira)                         { showToast('Selecione a bandeira.', 'erro'); return; }
    if (!limite || limite <= 0)            { showToast('Informe um limite válido.', 'erro'); return; }
    if (!fechamento || fechamento < 1 || fechamento > 31) { showToast('Dia de fechamento inválido (1–31).', 'erro'); return; }
    if (!vencimento || vencimento < 1 || vencimento > 31) { showToast('Dia de vencimento inválido (1–31).', 'erro'); return; }

    // Verificar limite de plano
    if (!cartaoEditandoId && window.NexoPlanos) {
      const perfilPlano = window._cartoesUserPlano || null;
      const limiteCartoes = window.NexoPlanos.getCardsLimit?.(perfilPlano);
      if (Number.isFinite(limiteCartoes) && cartoesGlobal.length >= limiteCartoes) {
        showToast(`Limite de ${limiteCartoes} cartão(ões) atingido no plano atual.`, 'erro');
        return;
      }
    }

    const payload = { nome, bandeira, limite, fechamento, vencimento, cor, tipo: 'credito' };

    if (cartaoEditandoId) {
      const ref = doc(db, 'usuarios', uid, 'carteira', cartaoEditandoId);
      await updateDoc(ref, { ...payload, dataModificacao: serverTimestamp() });
      showToast('Cartão atualizado!', 'ok');
    } else {
      await addDoc(collection(db, 'usuarios', uid, 'carteira'), {
        ...payload,
        saldoInicial: 0,
        saldo: 0,
        faturasPagas: {},
        faturasMetodo: {},
        dataCriacao: serverTimestamp(),
      });
      showToast('Cartão adicionado!', 'ok');
    }

    fecharModalCartao();
  } catch {
    showToast('Erro ao salvar cartão. Tente novamente.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Cartão';
  }
}

// ─── Modal Gasto ─────────────────────────────────────────────────────────────

function abrirModalGasto(cartaoId, gastoObj = null) {
  cartaoParaGasto = cartaoId;
  gastoEditandoId = gastoObj ? gastoObj.id : null;

  const c = cartoesGlobal.find(x => x.id === cartaoId);
  const sub   = document.getElementById('subtitleModalGasto');
  const title = document.getElementById('titleModalGasto');
  const btnSalvar = document.getElementById('btnSalvarGasto');

  if (gastoObj) {
    if (title)    title.textContent    = 'Editar Gasto';
    if (btnSalvar) btnSalvar.textContent = 'Salvar Alterações';
  } else {
    if (title)    title.textContent    = 'Novo Gasto';
    if (btnSalvar) btnSalvar.textContent = 'Registrar Gasto';
  }
  if (sub) sub.textContent = c ? `💳 ${c.nome}` : '—';

  document.getElementById('formGasto').reset();

  if (gastoObj) {
    document.getElementById('inputDescGasto').value  = gastoObj.descricao || '';
    document.getElementById('inputValorGasto').value = formatBRL(gastoObj.valor || 0);
    const dataRef = gastoObj.dataReferencia || toISODate(new Date());
    dpGastoMes  = parseInt(dataRef.substring(5, 7)) - 1;
    dpGastoAno  = parseInt(dataRef.substring(0, 4));
    dpGastoData = dataRef;
    document.getElementById('dpGastoHidden').value = dpGastoData;
    document.getElementById('dpGastoLabel').textContent = formatDataLabel(dpGastoData);
    renderCalendarioGasto();
    // Buscar emoji da categoria para exibir no trigger (padrão + personalizadas)
    const catNome = gastoObj.categoria || '';
    let catObj = (window.BUD_CATEGORIAS_PADRAO && window.BUD_CATEGORIAS_PADRAO.despesa || [])
      .find(c => (typeof c === 'object' ? c.nome : c) === catNome);
    if (!catObj) {
      catObj = categoriasGlobal.find(c => c.tipo === 'despesa' && (c.nome || c.id) === catNome);
    }
    const catEmoji = catObj && (typeof catObj === 'object') ? catObj.emoji : '';
    const catLabel = catEmoji ? catEmoji + ' ' + catNome : (catNome || 'Selecione...');
    setSelectValue('triggerCatGastoText', 'hiddenCatGasto', catNome, catLabel);
    document.querySelectorAll('#dropdownCatGasto .custom-select-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.value === (gastoObj.categoria || ''));
    });
  } else {
    // Reset datepicker para hoje
    const hoje = new Date();
    dpGastoMes  = hoje.getMonth();
    dpGastoAno  = hoje.getFullYear();
    dpGastoData = toISODate(hoje);
    document.getElementById('dpGastoHidden').value = dpGastoData;
    document.getElementById('dpGastoLabel').textContent = formatDataLabel(dpGastoData);
    renderCalendarioGasto();
    setSelectValue('triggerCatGastoText', 'hiddenCatGasto', '', 'Selecione...');
    document.querySelectorAll('#dropdownCatGasto .custom-select-option').forEach(o => o.classList.remove('selected'));
  }

  // Parcelamento: reset e esconder se edição
  const parcWrap = document.getElementById('wrapParcelamento');
  const toggleParc = document.getElementById('toggleParcelado');
  const nParcelasWrap = document.getElementById('wrapNParcelas');
  if (toggleParc) { toggleParc.checked = false; }
  if (nParcelasWrap) nParcelasWrap.style.display = 'none';
  if (parcWrap) parcWrap.style.display = gastoObj ? 'none' : '';  // esconde parcelamento na edição

  document.getElementById('modalGasto').classList.add('open');
  document.getElementById('inputDescGasto').focus();
}

function fecharModalGasto() {
  document.getElementById('modalGasto').classList.remove('open');
  cartaoParaGasto = null;
  gastoEditandoId = null;
  document.getElementById('dpGastoCalendar').classList.remove('open');
}

// ─── Form Gasto ──────────────────────────────────────────────────────────────

function setupFormGasto() {
  document.getElementById('formGasto')?.addEventListener('submit', handleSubmitGasto);

  document.getElementById('inputValorGasto')?.addEventListener('blur', (e) => {
    e.target.value = maskBRL(e.target.value);
  });

  document.getElementById('toggleParcelado')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('wrapNParcelas');
    const btn  = document.getElementById('btnSalvarGasto');
    if (wrap) wrap.style.display = e.target.checked ? '' : 'none';
    if (btn)  btn.textContent    = e.target.checked ? 'Parcelar' : 'Registrar Gasto';
  });
}

async function handleSubmitGasto(e) {
  e.preventDefault();
  if (!cartaoParaGasto) return;

  const btn = document.getElementById('btnSalvarGasto');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const descricao  = budSanitize(document.getElementById('inputDescGasto').value.trim()).substring(0, 100);
    const valor      = parseBRL(document.getElementById('inputValorGasto').value);
    const dataRef    = document.getElementById('dpGastoHidden').value;
    const categoria  = document.getElementById('hiddenCatGasto').value || 'Outros';

    if (!descricao)           { showToast('Informe a descrição.', 'erro'); return; }
    if (!valor || valor <= 0) { showToast('Informe um valor válido.', 'erro'); return; }
    if (!dataRef)             { showToast('Selecione a data do gasto.', 'erro'); return; }

    // ── Modo Edição ──────────────────────────────────────────────────────────
    if (gastoEditandoId) {
      const [_ey, _em, _ed] = dataRef.split('-').map(Number);
      await updateDoc(doc(db, 'usuarios', uid, 'transacoes', gastoEditandoId), {
        descricao,
        valor,
        categoria,
        dataReferencia: dataRef,
        data: Timestamp.fromDate(new Date(_ey, _em - 1, _ed, 12, 0, 0)),
      });
      showToast('Gasto atualizado!', 'ok');
      fecharModalGasto();
      return;
    }

    // ── Parcelamento ─────────────────────────────────────────────────────────
    const isParcelado = document.getElementById('toggleParcelado')?.checked;
    const nParcelas   = isParcelado ? Math.max(2, Math.min(48, parseInt(document.getElementById('inputNParcelas')?.value || '2') || 2)) : 1;

    const baseData = {
      tipo: 'despesa',
      descricao,
      categoria,
      cartaoId: cartaoParaGasto,
      formaPagamento: 'Crédito',
      pagamentoFatura: false,
      origem: 'manual',
      status: 'ativa',
      dataCriacao: serverTimestamp(),
    };

    if (nParcelas === 1) {
      const [_sy, _sm, _sd] = dataRef.split('-').map(Number);
      await addDoc(collection(db, 'usuarios', uid, 'transacoes'), {
        ...baseData,
        valor,
        dataReferencia: dataRef,
        data: Timestamp.fromDate(new Date(_sy, _sm - 1, _sd, 12, 0, 0)),
      });
    } else {
      const valorParcela = parseFloat((valor / nParcelas).toFixed(2));
      // _addMesesData garante datas válidas (ex: fev-28 em vez de fev-31)
      for (let i = 0; i < nParcelas; i++) {
        const dataParc = _addMesesData(dataRef, i);
        const [_py, _pm, _pd] = dataParc.split('-').map(Number);

        // Ajuste de centavos na primeira parcela
        const valorParc = i === 0 ? parseFloat((valor - valorParcela * (nParcelas - 1)).toFixed(2)) : valorParcela;

        await addDoc(collection(db, 'usuarios', uid, 'transacoes'), {
          ...baseData,
          valor: valorParc,
          dataReferencia: dataParc,
          data: Timestamp.fromDate(new Date(_py, _pm - 1, _pd, 12, 0, 0)),
          parcelado: true,
          parcelaAtual: i + 1,
          totalParcelas: nParcelas,
          descricao: `${descricao} (${i + 1}/${nParcelas})`,
        });
      }
    }

    showToast(nParcelas > 1 ? `${nParcelas} parcelas registradas!` : 'Gasto registrado!', 'ok');
    fecharModalGasto();
  } catch {
    showToast('Erro ao registrar gasto. Tente novamente.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = gastoEditandoId ? 'Salvar Alterações' : (document.getElementById('toggleParcelado')?.checked ? 'Parcelar' : 'Registrar Gasto');
  }
}

// ─── Modal Pagar Fatura ──────────────────────────────────────────────────────

function abrirModalPagarFatura(cartaoId, fatura) {
  const c = cartoesGlobal.find(x => x.id === cartaoId);
  cartaoParaPagar = { cartaoId, fatura };
  contaParaPagarId = null;
  const mesKey = getMesKey();
  const isPago = c?.faturasPagas?.[mesKey];

  const title = document.getElementById('titlePagarFatura');
  const sub   = document.getElementById('subPagarFatura');
  const info  = document.getElementById('infoPagarFatura');
  const btn   = document.getElementById('btnConfirmarPagarFatura');
  const wrapConta = document.getElementById('wrapContaFatura');

  if (isPago) {
    title.textContent = 'Desfazer pagamento?';
    sub.textContent   = 'A fatura voltará ao status anterior.';
    info.textContent  = `Fatura de ${MESES_PT[mesVisualizando]}: ${formatBRL(fatura)}`;
    info.style.color  = '#d97706';
    info.style.background = 'rgba(217,119,6,0.08)';
    info.style.borderColor = 'rgba(217,119,6,0.2)';
    btn.textContent   = '↩ Desfazer';
    btn.style.background = '#f59e0b';
    if (wrapConta) wrapConta.style.display = 'none';
    document.getElementById('modalPagarFatura').classList.add('open');
    return;
  }

  // Modo: pagar fatura
  title.textContent = 'Pagar Fatura';
  info.textContent  = `Fatura de ${MESES_PT[mesVisualizando]}: ${formatBRL(fatura)}`;
  info.style.color  = '#059669';
  info.style.background = 'rgba(16,185,129,0.08)';
  info.style.borderColor = 'rgba(16,185,129,0.2)';
  btn.textContent   = '✓ Confirmar Pagamento';
  btn.style.background = '#10b981';

  document.getElementById('modalPagarFatura').classList.add('open');

  if (!wrapConta || fatura <= 0) {
    if (wrapConta) wrapConta.style.display = 'none';
    sub.textContent = fatura <= 0
      ? 'A fatura está em zero. Você pode marcá-la como paga mesmo assim.'
      : 'Esta ação marcará a fatura como paga.';
    return;
  }

  // Carregar contas de débito assincronamente
  wrapConta.style.display = 'none';
  sub.textContent = 'Carregando contas...';
  btn.disabled = true;

  getDocs(query(
    collection(db, 'usuarios', uid, 'carteira'),
    where('tipo', '!=', 'credito'),
    limit(50)
  )).then(snap => {
    const contas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    btn.disabled = false;

    if (contas.length === 0) {
      sub.textContent = 'Nenhuma conta de débito cadastrada. Fatura será apenas marcada como paga. Adicione contas em Carteira para registrar o débito automaticamente.';
      wrapConta.style.display = 'none';
      return;
    }

    sub.textContent = 'Selecione de qual conta deseja pagar a fatura.';
    const sel = document.getElementById('selectContaFatura');
    const TIPO_ICONS = { dinheiro:'💵', debito:'🏦', vale_refeicao:'🍽️', vale_alimentacao:'🛒', transporte:'🚌' };

    sel.innerHTML = contas.map(conta => {
      const icon = TIPO_ICONS[conta.tipo] || '🏦';
      const id   = escHtml(conta.id);
      return `<label style="display:flex;align-items:center;gap:0.625rem;padding:0.625rem;border-radius:0.625rem;cursor:pointer;border:1.5px solid var(--card-border);background:var(--input-bg);transition:border-color .15s;">
        <input type="radio" name="contaPagamento" value="${id}" style="accent-color:var(--btn-bg);flex-shrink:0;">
        <span>${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(conta.nome || conta.tipo)}</div>
          <div style="font-size:0.75rem;color:var(--card-text-sec);">Saldo: ${formatBRL(conta.saldo || 0)}</div>
        </div>
      </label>`;
    }).join('') + `<label style="display:flex;align-items:center;gap:0.625rem;padding:0.625rem;border-radius:0.625rem;cursor:pointer;border:1.5px solid var(--card-border);background:var(--input-bg);">
      <input type="radio" name="contaPagamento" value="" style="accent-color:var(--btn-bg);flex-shrink:0;">
      <span>📋</span>
      <div style="flex:1;">
        <div style="font-size:0.8125rem;font-weight:600;color:var(--card-text);">Apenas marcar como paga</div>
        <div style="font-size:0.75rem;color:var(--card-text-sec);">Não descontar de nenhuma conta</div>
      </div>
    </label>`;

    sel.querySelectorAll('input[name="contaPagamento"]').forEach(r => {
      r.addEventListener('change', (e) => { contaParaPagarId = e.target.value || null; });
    });

    wrapConta.style.display = '';
  }).catch(() => {
    btn.disabled = false;
    sub.textContent = 'Esta ação marcará a fatura como paga.';
    wrapConta.style.display = 'none';
  });
}

function fecharModalPagarFatura() {
  document.getElementById('modalPagarFatura').classList.remove('open');
  cartaoParaPagar = null;
  contaParaPagarId = null;
}

async function confirmarPagarFatura() {
  if (!cartaoParaPagar) return;
  const { cartaoId, fatura } = cartaoParaPagar;
  const mesKey = getMesKey();
  const c = cartoesGlobal.find(x => x.id === cartaoId);
  const isPago = c?.faturasPagas?.[mesKey];

  const btn = document.getElementById('btnConfirmarPagarFatura');
  btn.disabled = true;

  try {
    const cartaoRef = doc(db, 'usuarios', uid, 'carteira', cartaoId);
    const novasFaturas = { ...(c.faturasPagas || {}) };
    const batch = writeBatch(db);

    if (isPago) {
      // ── Desfazer pagamento ──────────────────────────────────────────
      const pagInfo = typeof isPago === 'object' && isPago !== null ? isPago : null;
      if (pagInfo?.txId) {
        // Deletar transação de pagamento criada anteriormente
        batch.delete(doc(db, 'usuarios', uid, 'transacoes', pagInfo.txId));
        // Restaurar saldo da conta debitada
        if (pagInfo.carteiraId) {
          const contaSnap = await getDoc(doc(db, 'usuarios', uid, 'carteira', pagInfo.carteiraId));
          if (contaSnap.exists()) {
            batch.update(contaSnap.ref, { saldo: (contaSnap.data().saldo || 0) + pagInfo.valor });
          }
        }
      }
      delete novasFaturas[mesKey];
      batch.update(cartaoRef, { faturasPagas: novasFaturas });
      await batch.commit();
      showToast('Pagamento desfeito.', 'ok');
    } else {
      // ── Confirmar pagamento ─────────────────────────────────────────
      if (contaParaPagarId && fatura > 0) {
        // Criar transação de pagamento de fatura
        const txRef = doc(collection(db, 'usuarios', uid, 'transacoes'));
        const hoje = new Date();
        const dataRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        batch.set(txRef, {
          tipo: 'despesa',
          descricao: `Pagamento fatura ${c.nome || 'Cartão'} — ${MESES_PT[mesVisualizando]} ${anoVisualizando}`,
          categoria: 'Cartão de Crédito',
          valor: fatura,
          dataReferencia: dataRef,
          data: Timestamp.fromDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0)),
          carteiraId: contaParaPagarId,
          pagamentoFatura: true,
          origem: 'pagamento_fatura',
          status: 'ativa',
          dataCriacao: serverTimestamp(),
        });
        // Decrementar saldo da conta
        const contaSnap = await getDoc(doc(db, 'usuarios', uid, 'carteira', contaParaPagarId));
        if (contaSnap.exists()) {
          batch.update(contaSnap.ref, { saldo: (contaSnap.data().saldo || 0) - fatura });
        }
        // Guardar txId para poder desfazer depois
        novasFaturas[mesKey] = { txId: txRef.id, carteiraId: contaParaPagarId, valor: fatura };
      } else {
        // Apenas marcar como paga sem débito
        novasFaturas[mesKey] = true;
      }
      batch.update(cartaoRef, { faturasPagas: novasFaturas });
      await batch.commit();
      showToast(
        contaParaPagarId && fatura > 0 ? 'Fatura paga e débito registrado!' : 'Fatura marcada como paga!',
        'ok'
      );
    }

    fecharModalPagarFatura();
  } catch {
    showToast('Erro ao atualizar fatura.', 'erro');
  } finally {
    btn.disabled = false;
  }
}

// ─── Modal Excluir Cartão ────────────────────────────────────────────────────

function abrirModalExcluirCartao(cartaoId, nomeCartao) {
  cartaoParaExcluir = cartaoId;
  const sub = document.getElementById('subExcluirCartao');
  if (sub) sub.textContent = `"${nomeCartao || 'Cartão'}" e todos seus gastos serão excluídos permanentemente.`;

  const check = document.getElementById('checkConfirmarExclusaoCartao');
  const btn   = document.getElementById('btnConfirmarExcluirCartao');
  if (check) check.checked = false;
  if (btn)   btn.disabled  = true;

  document.getElementById('modalExcluirCartao').classList.add('open');
}

function fecharModalExcluirCartao() {
  document.getElementById('modalExcluirCartao').classList.remove('open');
  cartaoParaExcluir = null;
}

async function confirmarExcluirCartao() {
  if (!cartaoParaExcluir) return;

  const btn = document.getElementById('btnConfirmarExcluirCartao');
  btn.disabled = true;
  btn.textContent = 'Excluindo...';

  try {
    // Buscar todas as transações do cartão (em lotes de 500 — limite do writeBatch).
    // Loop para deletar mais de 500 sem trunc silenciosa (A5 fix).
    const txRef = collection(db, 'usuarios', uid, 'transacoes');
    let totalDeletadas = 0;
    let snap;
    do {
      const qTx = query(txRef, where('cartaoId', '==', cartaoParaExcluir), limit(500));
      snap = await getDocs(qTx);
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalDeletadas += snap.size;
    } while (snap.size === 500);

    // Deletar o cartão em si
    await deleteDoc(doc(db, 'usuarios', uid, 'carteira', cartaoParaExcluir));

    showToast('Cartão excluído.', 'ok');
    fecharModalExcluirCartao();
  } catch {
    showToast('Erro ao excluir cartão.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Excluir';
  }
}

// ─── Modal Excluir Gasto ─────────────────────────────────────────────────────

function abrirModalExcluirGasto(gastoId, desc) {
  gastoParaExcluir = gastoId;
  const sub = document.getElementById('subExcluirGasto');
  if (sub) sub.textContent = `"${desc}" será excluído permanentemente.`;
  document.getElementById('modalExcluirGasto').classList.add('open');
}

function fecharModalExcluirGasto() {
  document.getElementById('modalExcluirGasto').classList.remove('open');
  gastoParaExcluir = null;
}

async function confirmarExcluirGasto() {
  if (!gastoParaExcluir) return;

  const btn = document.getElementById('btnConfirmarExcluirGasto');
  btn.disabled = true;

  try {
    await deleteDoc(doc(db, 'usuarios', uid, 'transacoes', gastoParaExcluir));
    showToast('Gasto excluído.', 'ok');
    fecharModalExcluirGasto();
  } catch {
    showToast('Erro ao excluir gasto.', 'erro');
  } finally {
    btn.disabled = false;
  }
}

// ─── Editar Gasto ─────────────────────────────────────────────────────────────

async function editarGasto(gastoId) {
  if (!gastoId) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid, 'transacoes', gastoId));
    if (!snap.exists()) { showToast('Gasto não encontrado.', 'erro'); return; }
    const g = { id: snap.id, ...snap.data() };
    abrirModalGasto(g.cartaoId, g);
  } catch {
    showToast('Erro ao carregar gasto.', 'erro');
  }
}

// ─── Status Gasto (Estornar / Cancelar) ──────────────────────────────────────

function abrirModalStatusGasto(gastoId, desc, statusAtual) {
  gastoParaStatus = { id: gastoId, desc, statusAtual };

  const sub    = document.getElementById('subStatusGasto');
  const btnEst = document.getElementById('btnEstornarGasto');
  const btnCan = document.getElementById('btnCancelarGastoStatus');
  const btnRea = document.getElementById('btnReativarGasto');

  if (sub) sub.textContent = `"${desc}"`;

  // Mostrar/ocultar botões conforme status atual
  if (statusAtual === 'ativa') {
    if (btnEst) btnEst.style.display = '';
    if (btnCan) btnCan.style.display = '';
    if (btnRea) btnRea.style.display = 'none';
  } else {
    if (btnEst) btnEst.style.display = 'none';
    if (btnCan) btnCan.style.display = 'none';
    if (btnRea) btnRea.style.display = '';
  }

  document.getElementById('modalStatusGasto').classList.add('open');
}

function fecharModalStatusGasto() {
  document.getElementById('modalStatusGasto')?.classList.remove('open');
  gastoParaStatus = null;
}

async function confirmarStatusGasto(novoStatus) {
  if (!gastoParaStatus) return;
  try {
    await updateDoc(doc(db, 'usuarios', uid, 'transacoes', gastoParaStatus.id), { status: novoStatus });
    const msgs = { ativa: 'Gasto reativado.', estornado: 'Gasto marcado como estorno.', cancelado: 'Gasto cancelado.' };
    showToast(msgs[novoStatus] || 'Status atualizado.', 'ok');
    fecharModalStatusGasto();
  } catch {
    showToast('Erro ao atualizar status.', 'erro');
  }
}

// ─── Custom Select: Bandeira ─────────────────────────────────────────────────

function setupBandeiraSelect() {
  const trigger  = document.getElementById('triggerBandeira');
  const dropdown = document.getElementById('dropdownBandeira');

  trigger?.addEventListener('click', () => {
    const isOpen = dropdown.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
  });

  dropdown?.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const val   = opt.dataset.value;
      const label = opt.textContent;
      setSelectValue('triggerBandeiraText', 'hiddenBandeira', val, label);
      dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o === opt));
      dropdown.classList.remove('open');
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!trigger?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown?.classList.remove('open');
      trigger?.classList.remove('open');
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── Custom Select: Categoria Gasto ──────────────────────────────────────────

function setupCatGastoSelect() {
  const trigger  = document.getElementById('triggerCatGasto');
  const dropdown = document.getElementById('dropdownCatGasto');

  atualizarDropdownCategorias();

  trigger?.addEventListener('click', () => {
    const isOpen = dropdown.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!trigger?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown?.classList.remove('open');
      trigger?.classList.remove('open');
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });
}

function atualizarDropdownCategorias() {
  const dropdown = document.getElementById('dropdownCatGasto');
  if (!dropdown) return;

  // Padrão de despesa (fonte única de verdade) com emojis
  const padraoBruto = (window.BUD_CATEGORIAS_PADRAO && window.BUD_CATEGORIAS_PADRAO.despesa)
    ? window.BUD_CATEGORIAS_PADRAO.despesa
    : [];
  const padraoItens = padraoBruto.map(c => typeof c === 'object' ? c : { nome: c, emoji: '' });
  const padraoNomes = padraoItens.map(c => c.nome);

  // Personalizadas filtradas por tipo despesa (preserva emoji do usuário)
  const personalizadas = categoriasGlobal
    .filter(c => c.tipo === 'despesa')
    .map(c => ({ nome: c.nome || c.id, emoji: c.emoji || '🏷️' }))
    .filter(c => c.nome && !padraoNomes.includes(c.nome));

  const todas = [...padraoItens, ...personalizadas];

  dropdown.innerHTML = todas.map(cat => `
    <div class="custom-select-option" role="option" data-value="${escHtml(cat.nome)}">${cat.emoji ? escHtml(cat.emoji) + ' ' : ''}${escHtml(cat.nome)}</div>
  `).join('');

  dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.dataset.value;
      const label = opt.textContent.trim();
      setSelectValue('triggerCatGastoText', 'hiddenCatGasto', val, label);
      dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o === opt));
      dropdown.classList.remove('open');
      const trigger = document.getElementById('triggerCatGasto');
      trigger?.classList.remove('open');
      trigger?.setAttribute('aria-expanded', 'false');
    });
  });
}

// ─── Seletor de Cor ───────────────────────────────────────────────────────────

function setupCorPicker() {
  document.querySelectorAll('.cor-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cor-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      document.getElementById('hiddenCor').value = pill.dataset.cor;
    });
  });
}

// ─── Importação com IA ────────────────────────────────────────────────────────

// Helper: define o mês selecionado no custom dropdown #iaMesBtn
const _MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function _setIaMes(value) {
  const idx = parseInt(value, 10) - 1;
  const hidden  = document.getElementById('iaMes');
  const texto   = document.getElementById('iaMesTexto');
  const btn     = document.getElementById('iaMesBtn');
  if (hidden) hidden.value = value;
  if (texto)  texto.textContent = _MESES_NOMES[idx] || value;
  if (btn)    btn.classList.toggle('has-value', !!value);
  document.querySelectorAll('#iaMesDropdown .custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === value);
  });
  _atualizarBannerMes();
}

function _atualizarBannerMes() {
  const banner = document.getElementById('iaBannerMesTexto');
  if (!banner) return;
  const mes  = document.getElementById('iaMesTexto')?.textContent || '';
  const ano  = document.getElementById('iaAno')?.value || '';
  banner.textContent = mes && ano ? `${mes} ${ano}` : '—';
}

// Helper: inicializa o custom dropdown de mês no modal Review IA
function _initIaMesDropdown() {
  const btn = document.getElementById('iaMesBtn');
  const dd  = document.getElementById('iaMesDropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Smart positioning
    dd.classList.remove('open-up');
    const rect       = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const ddH        = Math.min(dd.scrollHeight || 220, 220);
    if (spaceBelow < ddH && spaceAbove > spaceBelow) dd.classList.add('open-up');
    dd.classList.toggle('open');
    btn.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(dd.classList.contains('open')));
  });

  dd.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    _setIaMes(opt.dataset.value);
    dd.classList.remove('open', 'open-up');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dd.contains(e.target)) {
      dd.classList.remove('open', 'open-up');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// Helper: renderiza barra de confiabilidade no modal Review IA
function _renderConfiabilidadeBadge() {
  const badge = document.getElementById('iaConfiabilidadeBadge');
  if (!badge) return;

  const meta = _importMetaIA;
  const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Label dinâmico baseado na fonte do import
  const fonte = meta?.fonte || 'ia';
  const labelFonte = fonte === 'pdf' ? 'PDF' : fonte === 'imagem' ? 'Imagem' : fonte === 'ofx' ? 'OFX' : 'Fatura';
  const iconeFonte = fonte === 'imagem' ? '🖼️' : fonte === 'ofx' ? '📋' : '📄';

  // OFX é dado estruturado — precisão garantida, sem necessidade de validação
  if (fonte === 'ofx') {
    document.getElementById('iaFaturaTotalPdf')?.style?.setProperty('display', 'none');
    const totalOFX = itensIAExtraidos.length;
    const ativosOFX = itensIAExtraidos.filter(i => i.status === 'ativa').length;
    const estornosOFX = itensIAExtraidos.filter(i => i.status === 'estornado').length;
    const detOFX = estornosOFX > 0 ? ` · ${estornosOFX} estorno${estornosOFX > 1 ? 's' : ''}` : '';
    badge.style.cssText = 'display:block;font-size:0.7rem;font-weight:700;padding:0.35rem 0.75rem;border-radius:8px;white-space:normal;line-height:1.5;background:#dcfce7;color:#15803d;margin-bottom:0.75rem;';
    badge.textContent = `✅ OFX — ${totalOFX} transações lidas (${ativosOFX} ativas${detOFX}) · dados estruturados, precisão 100%`;
    return;
  }

  // 1) Exibe linha de referência do total declarado na fatura
  const refBox   = document.getElementById('iaFaturaTotalPdf');
  const refVal   = document.getElementById('iaFaturaTotalPdfValor');
  const refLabel = document.getElementById('iaFaturaTotalPdfLabel');
  // Para imagem: usar totalCompras (compras brutas) como referência primária,
  // pois totalAPagar inclui saldo anterior/juros que distorcem a comparação.
  // Para PDF/OFX: totalAPagar é o valor cobrado real, preferível.
  const isImagem = fonte === 'imagem';
  const alvoPdf = isImagem
    ? (meta && meta.totalCompras > 0 ? meta.totalCompras
       : meta && meta.totalAPagar > 0 ? meta.totalAPagar : null)
    : (meta && meta.totalAPagar > 0 ? meta.totalAPagar
       : meta && meta.totalCompras > 0 ? meta.totalCompras : null);
  if (refBox && refVal) {
    if (alvoPdf !== null) {
      if (refLabel) refLabel.textContent = `${iconeFonte} Total da fatura (${labelFonte})`;
      const labelAlvo = isImagem
        ? (meta.totalCompras > 0 ? ' (Total de compras)' : ' (Total a pagar)')
        : (meta.totalAPagar > 0 ? ' (Total a pagar)' : ' (Total de compras)');
      refVal.textContent = fmt(alvoPdf) + labelAlvo;
      refBox.style.display = 'flex';
    } else {
      refBox.style.display = 'none';
    }
  }

  let badgeBg, badgeColor, badgeText;

  if (alvoPdf !== null && alvoPdf > 0) {
    // Soma TODOS os itens ativos extraídos (independente de seleção)
    // para mostrar quanto a IA capturou vs o total declarado no PDF
    const somaAtivos = itensIAExtraidos
      .filter(i => i.status === 'ativa')
      .reduce((s, i) => s + i.valor, 0);
    const pct    = Math.min(somaAtivos / alvoPdf, 1.05);
    const pctStr = Math.round(pct * 100) + '%';
    const diff   = somaAtivos - alvoPdf;
    const diffStr = (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff));
    const det    = `IA: ${fmt(somaAtivos)} · ${labelFonte}: ${fmt(alvoPdf)} · dif ${diffStr}`;

    if (pct < 0.70) {
      badgeBg = '#fee2e2'; badgeColor = '#b91c1c';
      badgeText = `❌ Resultado NÃO confiável — ${pctStr} capturado · ${det}`;
    } else if (pct < 0.95 || pct > 1.05) {
      badgeBg = '#fff7ed'; badgeColor = '#c2410c';
      badgeText = `⚠️ Precisão parcial — ${pctStr} · ${det} · revise antes de salvar`;
    } else {
      badgeBg = '#dcfce7'; badgeColor = '#15803d';
      badgeText = `✅ Valores batem com a fatura — ${pctStr} · ${det}`;
    }
  } else {
    // Sem total de referência — mostra contagem real extraída
    const totalSemMeta = itensIAExtraidos.length;
    const ativosSemMeta = itensIAExtraidos.filter(i => i.status === 'ativa').length;
    const somaExtraida = itensIAExtraidos
      .filter(i => i.status === 'ativa')
      .reduce((s, i) => s + i.valor, 0);
    badgeBg = '#fef3c7'; badgeColor = '#92400e';
    badgeText = `⚠️ ${labelFonte} — ${ativosSemMeta} de ${totalSemMeta} itens ativos · total extraído: ${fmt(somaExtraida)} · sem total de fatura para validar automaticamente`;
  }

  badge.style.cssText = `display:block;font-size:0.7rem;font-weight:700;padding:0.35rem 0.75rem;border-radius:8px;white-space:normal;line-height:1.5;background:${badgeBg};color:${badgeColor};margin-bottom:0.75rem;`;
  badge.textContent = badgeText;
}

function abrirModalImportIA(cartaoId, manterArquivo = false) {
  if (window.budFeatureEnabled && !window.budFeatureEnabled('importacao_ia')) {
    if (window.budShowToast) window.budShowToast('Importação por IA indisponível.', 'warning');
    return;
  }
  if (!cartaoId) return;
  cartaoImportIA = cartaoId;
  const c = cartoesGlobal.find(x => x.id === cartaoId);

  const sub = document.getElementById('subtitleModalImportIA');
  if (sub) sub.textContent = c ? `💳 ${c.nome}` : '—';

  if (!manterArquivo) {
    // Reset do formulário
    const input = document.getElementById('inputArquivoIA');
    if (input) input.value = '';
    const filename = document.getElementById('importIA-filename');
    if (filename) { filename.textContent = ''; filename.style.display = 'none'; }
    const btn = document.getElementById('btnEnviarImportIA');
    if (btn) btn.disabled = true;
    const progress = document.getElementById('importIA-progress');
    if (progress) progress.style.display = 'none';
    const uploadArea = document.getElementById('importIA-upload-area');
    if (uploadArea) uploadArea.style.display = '';
    const btnEnviar = document.getElementById('btnEnviarImportIA');
    if (btnEnviar) { btnEnviar.textContent = 'Analisar com IA'; btnEnviar.disabled = true; }
    _importMetaIA = null;
  }

  // Preencher mês/ano com o PRÓXIMO mês (mês de pagamento da fatura)
  // A fatura que você importa hoje vence no mês seguinte, não no atual
  const anoEl = document.getElementById('iaAno');
  const proxMes = mesVisualizando === 11 ? 0 : mesVisualizando + 1;
  const proxAno = mesVisualizando === 11 ? anoVisualizando + 1 : anoVisualizando;
  _setIaMes(String(proxMes + 1).padStart(2, '0'));
  if (anoEl) anoEl.value = String(proxAno);

  document.getElementById('modalImportIA').classList.add('open');
}

function fecharModalImportIA() {
  document.getElementById('modalImportIA')?.classList.remove('open');
}

function fecharModalReviewIA() {
  document.getElementById('modalReviewIA')?.classList.remove('open');
  itensIAExtraidos = [];
  _importMetaIA = null;
  cartaoImportIA = null;
}

function onArquivoIAChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const maxMB = 10;
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`Arquivo muito grande. Máximo ${maxMB}MB.`, 'erro');
    e.target.value = '';
    return;
  }

  const ext = file.name.toLowerCase().split('.').pop();
  const isOFX = ext === 'ofx' || ext === 'qfx';

  const filename = document.getElementById('importIA-filename');
  if (filename) {
    filename.textContent = `${isOFX ? '📋' : '📄'} ${file.name}`;
    filename.style.display = 'block';
  }

  const btn = document.getElementById('btnEnviarImportIA');
  if (btn) {
    btn.disabled = false;
    btn.textContent = isOFX ? 'Importar OFX' : 'Analisar com IA';
  }
}

// ─── Parser OFX client-side ───────────────────────────────────────────────────

function parseOFXLocal(text) {
  function getTag(body, tag) {
    const m = body.match(new RegExp('<' + tag + '>([^\\n<]+)', 'i'));
    return m ? m[1].trim() : '';
  }

  const results = [];
  // Dividir em blocos de transação (SGML e XML)
  const parts = text.split(/<STMTTRN>/gi);
  for (let i = 1; i < parts.length; i++) {
    const body = parts[i].split('</STMTTRN>')[0];

    const trntype  = getTag(body, 'TRNTYPE').toUpperCase();
    const dtposted = getTag(body, 'DTPOSTED') || getTag(body, 'DTUSER') || '';
    const trnamt   = getTag(body, 'TRNAMT');
    const fitid    = getTag(body, 'FITID');
    const memo     = getTag(body, 'MEMO') || getTag(body, 'NAME') || '';

    if (!trnamt || !memo) continue;

    const valor = parseFloat(trnamt.replace(',', '.'));
    if (isNaN(valor)) continue;

    // Parsear data YYYYMMDDHHMMSS[tz]
    let data = '';
    if (dtposted.length >= 8) {
      data = `${dtposted.slice(0,4)}-${dtposted.slice(4,6)}-${dtposted.slice(6,8)}`;
    }

    results.push({
      desc: memo.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim(),
      valor: Math.abs(valor),
      data,
      // CREDIT/DEP = crédito/pagamento (marcar como estornado)
      _tipoOFX: trntype,
      _fitIdOFX: fitid,
    });
  }
  const balMatch = text.match(/<BALAMT>([^\n<]+)/i);
  const ledgerBalance = balMatch ? parseFloat(balMatch[1].trim().replace(',', '.')) : null;
  return {
    transactions: results,
    ledgerBalance: Number.isFinite(ledgerBalance) ? Math.abs(ledgerBalance) : null,
  };
}

async function processarOFXLocal(file) {
  // OFX brasileiro pode usar Windows-1252 — detectar e decodificar corretamente
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  // Alguns bancos declaram Windows-1252 no cabeçalho, mas entregam o arquivo
  // em UTF-8. Só aplica o fallback quando a decodificação UTF-8 for inválida.
  if (text.includes('\uFFFD') && /CHARSET\s*[=:]\s*(1252|iso-?8859)/i.test(text.substring(0, 600))) {
    try { text = new TextDecoder('windows-1252').decode(buf); } catch (_e) { /* mantém utf-8 */ }
  }
  const parsedOFX = parseOFXLocal(text);
  const raw = parsedOFX.transactions;
  if (raw.length === 0) throw new Error('Nenhuma transação encontrada no arquivo OFX.');

  // O BALAMT do cartão representa o valor líquido oficial da fatura.
  _importMetaIA = {
    fonte: 'ofx',
    totalAPagar: parsedOFX.ledgerBalance,
    totalCompras: null,
  };

  // Pós-processar: OFX CREDIT/DEP = crédito → forçar status estornado
  const itens = processarItensIA(raw.map(r => {
    if (['CREDIT','DEP','INT','DIV'].includes(r._tipoOFX)) {
      r.valor = -Math.abs(r.valor); // sinaliza como crédito para processarItensIA detectar
    }
    return r;
  }));

  itensIAExtraidos = itens;
  fecharModalImportIA();
  abrirModalReviewIA();
}

// ─── Envio para backend (PDF / Imagem) ───────────────────────────────────────

const BUD_BACKEND_URL = (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/, '');

// Extrai "Total a pagar" e "Total de compras" do PDF direto no browser via pdf.js.
// Funciona como fallback quando o backend ainda não retorna meta (deploy não saiu)
// ou quando o regex do servidor falha em layouts incomuns.
async function _extrairMetaPdfClientSide(file) {
  if (!window.pdfjsLib) return null;
  try {
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let texto = '';
    const maxPag = Math.min(pdf.numPages, 15); // primeiras 15 pgs cobrem o sumário
    for (let p = 1; p <= maxPag; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      texto += content.items.map(it => it.str).join(' ') + '\n';
    }
    const parseVal = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
    const meta = { totalCompras: null, totalAPagar: null };

    // Helper: dentro de uma janela de texto após uma frase âncora,
    // retorna o MAIOR valor monetário encontrado (evita pegar IOF/conversão USD
    // que aparece como primeiro decimal logo após "total a pagar" em PDFs Nubank).
    function maiorValorAposAncora(ancoraRegex, janelaChars = 400) {
      const m = texto.match(ancoraRegex);
      if (!m) return null;
      const inicio = m.index + m[0].length;
      const trecho = texto.substring(inicio, inicio + janelaChars);
      // Captura valores no formato 1.234,56 ou 12,34 (exige vírgula decimal)
      const candidatos = [...trecho.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)]
        .map(x => parseVal(x[1]))
        .filter(v => v > 0);
      if (!candidatos.length) return null;
      return Math.max(...candidatos);
    }

    // "Total a pagar" — tentar primeiro a frase mais específica do Nubank
    // ("Pagamento total da fatura"), que aparece no card de opções de pagamento
    // e está sempre próxima do valor correto. Fallback: "total a pagar".
    meta.totalAPagar =
      maiorValorAposAncora(/pagamento\s+total\s+d[ao]\s+fatura/i, 200) ||
      maiorValorAposAncora(/total\s+a\s+pagar/i, 400);

    // "Total de compras (de todos os cartões)" — pega o maior na janela
    meta.totalCompras = maiorValorAposAncora(
      /total\s+d[eo]?\s*compras?(?:\s+de\s+todos\s+os\s+cart[õo]es)?/i,
      300
    );

    if (meta.totalAPagar === null && meta.totalCompras === null) return null;

    // Extrai valores de estorno/crédito do texto do PDF.
    // O Nubank marca estornos com "Estorno de X −R$ Y,ZZ" — extraímos os valores
    // para que processarItensIA possa identificar quais itens da IA são estornos
    // (a IA frequentemente perde o prefixo "Estorno de" e retorna valor positivo).
    // ── Extração dupla de estornos/créditos ─────────────────────────────────
    // Método 1 — keyword: captura valor após "Estorno de X..."
    // [\ s\S] permite cruzar vírgulas/aspas em nomes como "Mp *Duxnutrition,"
    const estornos = [];
    const reEstorno = /estorno[\s\S]{0,300}?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
    let em;
    while ((em = reEstorno.exec(texto)) !== null) {
      const ev = parseVal(em[1]);
      if (!isNaN(ev) && ev > 0) estornos.push(ev);
    }

    // Método 2 — sinal negativo: captura QUALQUER "-R$ X,XX" no PDF
    // Complementar ao método 1: apanha estornos sem prefixo "Estorno de"
    // e também serve de fallback para casos onde o keyword não foi detectado
    const reNegativo = /[\u2212\-]\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    while ((em = reNegativo.exec(texto)) !== null) {
      const cv = parseVal(em[1]);
      // Filtrar: ignora se já está na lista ou se é maior que totalAPagar (evita capturar o próprio total)
      const jaPresente = estornos.some(e => Math.abs(e - cv) < 0.02);
      const ehTotalOuGrande = meta.totalAPagar && cv >= meta.totalAPagar * 0.8;
      if (!isNaN(cv) && cv > 0 && !jaPresente && !ehTotalOuGrande) {
        estornos.push(cv);
      }
    }

    if (estornos.length) meta.estornos = estornos;

    return meta;
  } catch (err) {
    console.warn('[pdf.js client-side] falhou:', err.message);
    return null;
  }
}

async function enviarParaIA() {
  if (window.budFeatureEnabled && !window.budFeatureEnabled('importacao_ia')) return;
  const input = document.getElementById('inputArquivoIA');
  const file = input?.files?.[0];
  if (!file) { showToast('Selecione um arquivo.', 'erro'); return; }

  // ── OFX: processamento client-side, sem backend ───────────────────
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'ofx' || ext === 'qfx') {
    const btn = document.getElementById('btnEnviarImportIA');
    const progress = document.getElementById('importIA-progress');
    const progressText = document.getElementById('importIA-progress-text');
    const uploadArea = document.getElementById('importIA-upload-area');
    btn.disabled = true;
    btn.textContent = 'Processando...';
    if (uploadArea) uploadArea.style.display = 'none';
    if (progress) { progress.style.display = 'block'; }
    if (progressText) progressText.textContent = 'Lendo arquivo OFX...';
    _importMetaIA = { fonte: 'ofx' }; // dados estruturados, precisão garantida
    try {
      await processarOFXLocal(file);
    } catch (err) {
      showToast(`Erro ao ler OFX: ${err.message}`, 'erro');
      if (uploadArea) uploadArea.style.display = '';
      if (progress) progress.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Importar OFX';
    }
    return;
  }

  // ── PDF / Imagem: enviar ao backend ──────────────────────────────
  const btn = document.getElementById('btnEnviarImportIA');
  const progress = document.getElementById('importIA-progress');
  const progressText = document.getElementById('importIA-progress-text');
  const progressBar = document.getElementById('importIA-progress-bar');
  const uploadArea = document.getElementById('importIA-upload-area');

  btn.disabled = true;
  btn.textContent = 'Enviando...';
  if (uploadArea) uploadArea.style.display = 'none';
  if (progress) progress.style.display = 'block';
  if (progressText) progressText.textContent = 'Enviando arquivo...';
  if (progressBar) progressBar.style.width = '15%';

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    if (progressText) progressText.textContent = 'Lendo fatura...';
    if (progressBar) progressBar.style.width = '40%';

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tipo', 'fatura'); // informa backend que é fatura de cartão, não extrato

    const resp = await fetch(`${BUD_BACKEND_URL}/api/extrair-fatura`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (progressBar) progressBar.style.width = '80%';

    if (!resp.ok) {
      let errMsg = 'Erro no servidor.';
      try { const j = await resp.json(); errMsg = j.error || errMsg; } catch { /* ok */ }
      throw new Error(errMsg);
    }

    if (progressText) progressText.textContent = 'Processando transações...';
    if (progressBar) progressBar.style.width = '95%';

    const dados = await resp.json();
    const itens = Array.isArray(dados) ? dados : (dados.transacoes || []);
    _importMetaIA = (dados && !Array.isArray(dados) && dados.meta) ? dados.meta : null;

    // Marca a fonte do import para uso nos labels do modal de revisão
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImg = !isPdf && (file.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp|heic|heif)$/i.test(file.name));
    if (_importMetaIA) {
      _importMetaIA.fonte = isPdf ? 'pdf' : isImg ? 'imagem' : 'ia';
    }

    // Fallback / reforço: tenta extrair totais do PDF direto no browser via pdf.js.
    // Cobre o caso de o backend ainda não estar atualizado (sem totalAPagar) ou
    // não ter conseguido localizar os totais no layout do PDF.
    if (isPdf) {
      const metaCliente = await _extrairMetaPdfClientSide(file);
      if (metaCliente) {
        _importMetaIA = _importMetaIA || {};
        if (!_importMetaIA.totalAPagar && metaCliente.totalAPagar) {
          _importMetaIA.totalAPagar = metaCliente.totalAPagar;
        }
        if (!_importMetaIA.totalCompras && metaCliente.totalCompras) {
          _importMetaIA.totalCompras = metaCliente.totalCompras;
        }
        // Sempre mescla estornos detectados no PDF (sobrescreve — PDF é autoritativo)
        if (metaCliente.estornos && metaCliente.estornos.length) {
          _importMetaIA.estornos = metaCliente.estornos;
        }
      }
    }

    if (!itens.length) {
      throw new Error('Nenhuma transação encontrada. Tente com um arquivo mais legível ou use OFX.');
    }

    if (progressBar) progressBar.style.width = '100%';

    itensIAExtraidos = processarItensIA(itens);
    fecharModalImportIA();
    abrirModalReviewIA();

  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err.name === 'AbortError'
      ? 'Tempo limite excedido (45s). Tente um arquivo menor ou use OFX.'
      : (err.message || 'Falha ao processar arquivo.');
    showToast(msg, 'erro');
    if (uploadArea) uploadArea.style.display = '';
    if (progress) progress.style.display = 'none';
    btn.disabled = false;
    btn.textContent = 'Analisar com IA';
  }
}

// ─── Pós-processador IA ───────────────────────────────────────────────────────

// Helper: avança N meses numa data YYYY-MM-DD (respeita fim de mês)
function _addMesesData(dateStr, n) {
  const [ano, mes, dia] = dateStr.split('-').map(Number);
  let novoMes = mes - 1 + n;
  const novoAno = ano + Math.floor(novoMes / 12);
  novoMes = ((novoMes % 12) + 12) % 12;
  const maxDia = new Date(novoAno, novoMes + 1, 0).getDate();
  return `${novoAno}-${String(novoMes + 1).padStart(2, '0')}-${String(Math.min(dia, maxDia)).padStart(2, '0')}`;
}

function processarItensIA(itens) {
  // No OFX do Nubank, compra e estorno compartilham o mesmo FITID. Quando há
  // esse par, ambos devem sair da fatura; somente desmarcar o crédito mantém
  // a compra original e infla o total.
  const fitIdsEstornadosOFX = new Set(
    itens
      .filter(item => ['CREDIT','DEP'].includes(String(item._tipoOFX || '').toUpperCase()))
      .filter(item => !/PAGAMENTO RECEBIDO|PAGTO RECEBIDO|PAYMENT RECEIVED|PAGAMENTO DE FATURA|PGTO FATURA/.test(
        String(item.desc || item.descricao || '').toUpperCase()
      ))
      .map(item => item._fitIdOFX)
      .filter(Boolean)
  );
  // Valores de estorno extraídos do PDF (determinístico — independente da IA).
  // Dois-passes: primeiro mapeia qual ÍNDICE de item (na lista da IA) será o estorno,
  // escolhendo o ÚLTIMO item com aquele valor — a IA segue a ordem do PDF, onde
  // a compra original vem antes do "Estorno de X" no mesmo dia.
  const estornosParaMarcar = new Set();
  const pendingEstornos = (_importMetaIA?.estornos || []).map(v => +v);
  if (pendingEstornos.length > 0) {
    // Para cada valor de estorno, encontra o ÚLTIMO índice na lista com aquele valor
    const remaining = [...pendingEstornos];
    // Percorre de trás pra frente para pegar a última ocorrência
    for (let i = itens.length - 1; i >= 0; i--) {
      const v = Math.abs(parseFloat(String(itens[i].valor || itens[i].value || itens[i].amount || 0).replace(',', '.')) || 0);
      const idx = remaining.findIndex(ev => Math.abs(v - ev) < 0.02);
      if (idx >= 0) {
        estornosParaMarcar.add(i);
        remaining.splice(idx, 1);
        if (!remaining.length) break;
      }
    }
  }

  const itensProcessados = itens.map((item, itemIdx) => {
    const desc = String(item.desc || item.descricao || item.description || '').trim();
    const valor = Math.abs(parseFloat(String(item.valor || item.value || item.amount || 0).replace(',', '.')) || 0);
    const dataRaw = String(item.data || item.date || '').trim();
    const valorOriginal = parseFloat(String(item.valor || item.value || item.amount || 0).replace(',', '.')) || 0;

    let status = 'ativa';
    const descUpper = desc.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Pagamento de fatura / crédito / seção de sumário — excluir do total
    if (/PAGAMENTO RECEBIDO|PAGTO RECEBIDO|PAYMENT RECEIVED|PAGAMENTO DE FATURA|PGTO FATURA/.test(descUpper)) {
      status = 'estornado';
    }
    // "Pagamento em DD MMM" — linha de pagamento dentro de "Pagamentos e Financiamentos"
    if (/^PAGAMENTO\s+EM\s+\d/.test(descUpper)) {
      status = 'estornado';
    }
    // Valor negativo = crédito/estorno
    if (valorOriginal < 0) {
      status = 'estornado';
    }
    if (item._fitIdOFX && fitIdsEstornadosOFX.has(item._fitIdOFX)) {
      status = 'estornado';
    }
    // Palavras de estorno — incluindo "Estorno de X" (prefixo Nubank para estornos)
    if (/\bESTORNO\b|^ESTORNO\s+DE\s+|DEVOLUC|DEVOLUCAO|REEMBOLSO|CHARGEBACK|CREDITO FATURA|RESSARCIMENTO/.test(descUpper)) {
      status = 'estornado';
    }
    // Linhas de subtotal/seção do Nubank — NÃO são transações individuais
    // Ex: "Outros lançamentos", "Fatura anterior", "Saldo restante da fatura anterior",
    // "Pagamentos e Financiamentos", "Total de compras de todos os cartões",
    // "Pagamento mínimo", "Total a pagar"
    if (/^(OUTROS\s+LAN[CÇ]AMENTOS?|FATURA\s+ANTERIOR|SALDO\s+RESTANTE|PAGAMENTOS\s+E\s+FINANCIAMENTOS?|TOTAL\s+D[EO]\s+COMPRAS|TOTAL\s+A\s+PAGAR|PAGAMENTO\s+MINIMO|PAGAMENTO\s+M[ÍI]NIMO|RESUMO\s+DA\s+FATURA|FATURA\s+ATUAL|PROXIMO\s+FATURA|PR[ÓO]XIMA\s+FATURA|SALDO\s+EM\s+ABERTO|LIMITE|FECHAMENTO)/.test(descUpper)) {
      status = 'estornado';
    }
    // Detecção por valor: se o PDF declarou um estorno com este valor exato,
    // e este item foi pré-selecionado como estorno (último com aquele valor na lista),
    // marca como estornado.
    if (status === 'ativa' && estornosParaMarcar.has(itemIdx)) {
      status = 'estornado';
    }

    // Cancelamento (só se não for estorno — else if)
    if (!/ESTORNO|DEVOLUC|DEVOLUCAO|REEMBOLSO|CHARGEBACK/.test(descUpper)) {
      if (/CANCELAD|CANCELAMENTO/.test(descUpper)) {
        status = 'cancelado';
      }
    }

    // Encargos bancários (multas, juros, IOF de atraso) — auto-deselecionados
    // OBS: Renegociação NUNCA é encargo — é parcela de dívida real (faz parte das compras da fatura)
    if (status === 'ativa') {
      if (/\b(JUROS|MULTA|IOF)\s+DE\s+(ATRASO|MORA)|\bMULTA\s+DE\s+ATRASO\b|\bJUROS\s+DE\s+ATRASO\b|\bIOF\s+DE\s+ATRASO\b|SALDO\s+EM\s+ATRASO|JUROS\s+ROTATIVO|JUROS\s+DE\s+DIVIDA|JUROS\s+DE\s+PARCELAMENTO|ENCERRAMENTO\s+DE\s+DIVIDA|CREDITO\s+DE\s+ATRASO/.test(descUpper)) {
        status = 'encargo';
      }
    }

    // Parcelamento
    let parcelado = false;
    let parcelaAtual = null;
    let totalParcelas = null;

    const regexParcela1 = /(\d{1,2})\s*[\/]\s*(\d{1,2})/;
    const regexParcela2 = /PARCELA\s+(\d+)\s+DE\s+(\d+)/i;
    const m1 = desc.match(regexParcela1);
    const m2 = desc.match(regexParcela2);

    if (m1) {
      parcelado = true;
      parcelaAtual = parseInt(m1[1]);
      totalParcelas = parseInt(m1[2]);
    } else if (m2) {
      parcelado = true;
      parcelaAtual = parseInt(m2[1]);
      totalParcelas = parseInt(m2[2]);
    }

    const cat = detectarCategoriaIA(desc);

    return {
      desc,
      valor,
      dataRaw,
      status,
      categoria: cat,
      parcelado,
      parcelaAtual,
      totalParcelas,
      // Se parcelado E ainda há parcelas futuras, ativa "expandir" por padrão
      expandirParcelas: parcelado && totalParcelas > parcelaAtual,
      selecionado: status === 'ativa',  // estornados/cancelados vêm desmarcados
    };
  }).filter(item => item.valor > 0 || item.status !== 'ativa'); // remove itens com valor 0 que não são especiais

  // ── Auto-correção de discrepância ─────────────────────────────────────────
  // Para imagem: usa totalCompras como ref (compras brutas, sem juros/saldo ant.).
  // Para PDF/OFX: usa totalAPagar (valor real cobrado).
  const _fonte = _importMetaIA?.fonte || 'ia';
  const totalAPagarRef = _fonte === 'imagem'
    ? (_importMetaIA?.totalCompras || _importMetaIA?.totalAPagar)
    : (_importMetaIA?.totalAPagar || _importMetaIA?.totalCompras);
  if (totalAPagarRef) {
    const computado = itensProcessados
      .filter(i => i.status === 'ativa')
      .reduce((s, i) => s + i.valor, 0);
    let diff = Math.round((computado - totalAPagarRef) * 100) / 100;
    if (diff > 0.01) {
      // Tenta 1 item de cada vez (do fim para o início)
      for (let i = itensProcessados.length - 1; i >= 0 && diff > 0.01; i--) {
        const it = itensProcessados[i];
        if (it.status !== 'ativa') continue;
        if (Math.abs(it.valor - diff) < 0.02) {
          it.status = 'estornado';
          it.selecionado = false;
          diff = 0;
          console.warn(`[BudAI] Auto-correção: "${it.desc}" R$ ${it.valor.toFixed(2)} → estorno (diff R$ ${(computado - totalAPagarRef).toFixed(2)})`);
        }
      }
    }
  }

  return itensProcessados;
}

// ─── Auto-categorização ───────────────────────────────────────────────────────

function detectarCategoriaIA(desc) {
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/pagamento recebido|pagamento de fatura|pagto recebido|pgto fatura/.test(d)) return 'Pagamento de Fatura';
  if (/pix no credito/.test(d)) return 'Pix no Crédito';
  if (/^99\s*-?\s*nupay\b/.test(d)) return 'Uber/Táxi';

  const regras = [
    // Transporte / Uber
    { cat: 'Uber/Táxi',         words: ['uber', '99pop', '99 pop', '99 tecnologia', 'cabify', 'indrive', 'in drive', 'taxi', 'táxi'] },
    // Delivery
    { cat: 'Delivery/Ifood',    words: ['ifood', 'ifd*', 'rappi', 'ze delivery', 'zé delivery', 'delivery'] },
    // Streaming / Assinaturas
    { cat: 'Assinaturas/Streaming', words: ['netflix', 'spotify', 'amazon prime', 'amazon music', 'youtube premium', 'youtube music', 'globoplay', 'disney', 'hbo', 'paramount', 'apple tv', 'apple one', 'chatgpt', 'openai', 'github', 'notion', 'figma', 'canva', 'adobe', 'office 365', 'google one', 'dropbox', 'icloud', 'deezer', 'assinatura mensal', 'assinatura anual'] },
    // Mercado / Supermercado
    { cat: 'Mercado',           words: ['carrefour', 'assai', 'assaí', 'pao de acucar', 'pão de açúcar', 'extra mercado', 'atacadao', 'atacadão', 'aldi', 'lidl', 'walmart', 'sam\'s club', 'costco', 'makro', 'supermercado', 'supermarket', 'hortifruti', 'prezunic', 'guanabara', 'mundial'] },
    // Farmácia / Saúde
    { cat: 'Farmácia',          words: ['drogaria', 'drogasil', 'drogasmil', 'pacheco', 'pague menos', 'ultrafarma', 'farmacia', 'farmácia', 'droga', 'pharma', 'lifemed', 'sempre viva'] },
    { cat: 'Plano de Saúde',    words: ['unimed', 'bradesco saude', 'amil', 'sulamerica saude', 'hapvida', 'notredame', 'plano de saude'] },
    { cat: 'Dentista',          words: ['dentista', 'odontologia', 'odonto'] },
    { cat: 'Academia/Esportes', words: ['academia', 'smart fit', 'smartfit', 'bluefit', 'crossfit', 'wellhub', 'gympass'] },
    { cat: 'Consultas/Exames',  words: ['hospital', 'clinica', 'clínica', 'laboratorio', 'laboratório', 'exame', 'consulta', 'fisioterapia', 'biomedicina'] },
    // Restaurante / Lanchonete
    { cat: 'Restaurante',       words: ['restaurante', 'pizzaria', 'hamburgueria', 'churrascaria', 'mcdonalds', 'mcdonald', 'burger king', 'bk', 'subway', 'kfc', 'dominos', 'domino\'s', 'giraffas', 'habib', 'outback', 'ciao', 'sushi', 'temakeria', 'cantina', 'bistro', 'bistrô', 'bar e', 'choperia', 'taberna', 'trattoria'] },
    // Padaria / Café
    { cat: 'Padaria/Café',      words: ['starbucks', 'padaria', 'panificadora', 'confeitaria', 'cafe', 'café', 'bakery', 'pao', 'pão', 'nespresso', 'tres coracoes', '3 corações'] },
    // Combustível
    { cat: 'Combustível',       words: ['shell', 'ipiranga', 'petrobras', 'br posto', 'posto', 'combustivel', 'combustível', 'gasolina', 'etanol', 'diesel', 'gnv', 'rede ipiranga', 'vibra'] },
    // Roupas / Moda
    { cat: 'Roupas/Sapatos',    words: ['renner', 'riachuelo', 'marisa', 'cea modas', 'c&a', 'zara', 'h&m', 'arezzo', 'schutz', 'shein', 'dafiti', 'privalia', 'netshoes', 'nike', 'adidas', 'puma', 'track field', 'lupo', 'hering', 'dudalina', 'loja de roupa', 'boutique'] },
    // Eletrônicos / Tecnologia
    { cat: 'Eletrônicos',       words: ['amazon', 'magalu', 'magazine luiza', 'americanas', 'casas bahia', 'kabum', 'pichau', 'terabyte', 'fast shop', 'apple store', 'samsung', 'lg', 'lenovo', 'dell', 'hp', 'eletronico', 'eletrônico', 'informatica', 'informática', 'celular', 'smartphone', 'notebook', 'tablet', 'iphone', 'ipad'] },
    { cat: 'Faculdade/Escola',  words: ['faculdade', 'universidade', 'escola', 'colegio', 'colégio', 'estacio', 'anhanguera', 'unip'] },
    { cat: 'Material Escolar',  words: ['material escolar', 'papelaria', 'caderno', 'livraria', 'saraiva', 'livro didatico'] },
    { cat: 'Cursos',            words: ['cursinho', 'curso online', 'alura', 'udemy', 'coursera', 'duolingo', 'rocketseat', 'origamid'] },
    // Pet
    { cat: 'Pet',               words: ['petz', 'cobasi', 'petlove', 'petshop', 'pet shop', 'veterinario', 'veterinário', 'veterinaria', 'clinica vet', 'racao', 'ração', 'bichinho'] },
    // Viagem / Hospedagem
    { cat: 'Viagens',           words: ['airbnb', 'booking', 'hotel', 'pousada', 'hostel', 'hoteis', 'hotéis', 'decolar', 'azul linhas', 'latam', 'gol linhas', 'passagem aerea', 'aeroporto', 'voo', 'turismo', 'trivago'] },
    // Beleza
    { cat: 'Salão/Barbearia',   words: ['salao', 'salão', 'barbearia', 'barber', 'cabeleireiro'] },
    { cat: 'Cosméticos',        words: ['cosmetico', 'cosmético', 'perfumaria', 'sephora', 'manicure', 'pedicure', 'depilacao', 'depilação', 'clinica estetica'] },
    { cat: 'Aluguel',           words: ['aluguel'] },
    { cat: 'Condomínio',        words: ['condominio', 'condomínio'] },
    { cat: 'Luz',               words: ['conta de luz', 'energia eletrica', 'enel', 'cemig', 'copel', 'celpe', 'coelba', 'eletropaulo', 'light servicos'] },
    { cat: 'Água',              words: ['conta de agua', 'sabesp', 'cedae', 'copasa', 'saneamento'] },
    { cat: 'Gás',               words: ['comgas', 'copagaz', 'ultragaz', 'supergasbras', 'conta de gas'] },
    { cat: 'Internet/TV',       words: ['internet', 'vivo fibra', 'claro net', 'oi fibra', 'tim live', 'net combo'] },
    { cat: 'IPVA/Seguro',       words: ['ipva', 'seguro auto', 'seguro veiculo', 'detran', 'multa de transito'] },
    { cat: 'Taxas Bancárias',   words: ['tarifa bancaria', 'taxa bancaria', 'anuidade cartao', 'juros rotativo', 'encargo financeiro', 'iof operacao'] },
    { cat: 'Impostos/IRPF',     words: ['imposto de renda', 'irpf', 'darf', 'iptu'] },
    { cat: 'Pagamento de Fatura', words: ['pagamento fatura', 'pagamento do cartao', 'pagto fatura', 'pgto fatura'] },
  ];

  for (const regra of regras) {
    if (regra.words.some(w => d.includes(w))) return regra.cat;
  }

  return 'Outros';
}

// ─── Modal Review IA ─────────────────────────────────────────────────────────

function abrirModalReviewIA() {
  const c = cartoesGlobal.find(x => x.id === cartaoImportIA);
  const sub = document.getElementById('subtitleModalReviewIA');
  if (sub) sub.textContent = c ? `💳 ${c.nome} — ${itensIAExtraidos.length} transações encontradas` : `${itensIAExtraidos.length} transações encontradas`;

  _atualizarBannerMes();
  renderListaReviewIA();
  _renderConfiabilidadeBadge();
  document.getElementById('modalReviewIA')?.classList.add('open');
}

function renderListaReviewIA() {
  const lista = document.getElementById('iaListaItens');
  if (!lista) return;

  const _catsPadrao = (window.BUD_CATEGORIAS_PADRAO && window.BUD_CATEGORIAS_PADRAO.despesa || []);
  // Mapa categoria → emoji para visualização no select
  const _catEmojiMap = {};
  _catsPadrao.forEach(c => {
    if (c && c.nome) _catEmojiMap[c.nome] = c.emoji || '';
  });
  const _nomesPadrao = _catsPadrao.map(c => c.nome || c).filter(Boolean);
  const _nomesUser   = categoriasGlobal.map(c => c.nome || c.id).filter(Boolean);
  const CATS_IA = [...new Set([..._nomesPadrao, ..._nomesUser])];

  const qtdEncargos = itensIAExtraidos.filter(i => i.status === 'encargo').length;
  const notaEncargosHTML = qtdEncargos > 0
    ? `<div style="padding:0.5rem 0.75rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:0.5rem;font-size:0.75rem;color:var(--card-text-sec);margin-bottom:0.5rem;line-height:1.5;">⚠️ <b>${qtdEncargos}</b> encargo${qtdEncargos !== 1 ? 's' : ''} bancário${qtdEncargos !== 1 ? 's' : ''} (juros, multas, IOF) deselecionados automaticamente. Ative manualmente se necessário.</div>`
    : '';

  // Barra de ações em massa
  const acoesHTML = `<div style="display:flex;gap:0.375rem;flex-wrap:wrap;margin-bottom:0.625rem;padding:0.5rem;background:var(--input-bg);border:1px solid var(--card-border);border-radius:0.625rem;">
    <span style="font-size:0.75rem;font-weight:700;color:var(--card-text-sec);align-self:center;margin-right:0.25rem;">Seleção:</span>
    <button type="button" onclick="window._iaSelAll(true)" style="padding:0.3125rem 0.625rem;border:1.5px solid var(--card-border);border-radius:0.5rem;background:var(--card-bg);color:var(--card-text);font-size:0.6875rem;font-weight:700;cursor:pointer;font-family:inherit;">✓ Todos</button>
    <button type="button" onclick="window._iaSelAll(false)" style="padding:0.3125rem 0.625rem;border:1.5px solid var(--card-border);border-radius:0.5rem;background:var(--card-bg);color:var(--card-text);font-size:0.6875rem;font-weight:700;cursor:pointer;font-family:inherit;">✕ Nenhum</button>
    <button type="button" onclick="window._iaSelCompras()" style="padding:0.3125rem 0.625rem;border:1.5px solid var(--card-border);border-radius:0.5rem;background:var(--card-bg);color:var(--card-text);font-size:0.6875rem;font-weight:700;cursor:pointer;font-family:inherit;">🛒 Apenas compras</button>
    <button type="button" onclick="window._iaSelInv()" style="padding:0.3125rem 0.625rem;border:1.5px solid var(--card-border);border-radius:0.5rem;background:var(--card-bg);color:var(--card-text);font-size:0.6875rem;font-weight:700;cursor:pointer;font-family:inherit;">⇄ Inverter</button>
  </div>`;

  lista.innerHTML = acoesHTML + notaEncargosHTML + itensIAExtraidos.map((item, i) => {
    const isEstornado = item.status === 'estornado';
    const isCancelado = item.status === 'cancelado';
    const isEncargo  = item.status === 'encargo';

    let badgesHTML = '';
    if (isEstornado) badgesHTML += `<span style="font-size:0.6875rem;font-weight:700;background:rgba(245,158,11,0.15);color:#d97706;border-radius:0.375rem;padding:0.125rem 0.375rem;">Estorno</span>`;
    if (isCancelado) badgesHTML += `<span style="font-size:0.6875rem;font-weight:700;background:rgba(239,68,68,0.13);color:#dc2626;border-radius:0.375rem;padding:0.125rem 0.375rem;">Cancelado</span>`;
    if (isEncargo)   badgesHTML += `<span style="font-size:0.6875rem;font-weight:700;background:rgba(107,114,128,0.12);color:#6b7280;border-radius:0.375rem;padding:0.125rem 0.375rem;">Encargo</span>`;
    if (item.parcelado) badgesHTML += `<span style="font-size:0.6875rem;font-weight:700;background:rgba(59,130,246,0.13);color:#2563eb;border-radius:0.375rem;padding:0.125rem 0.375rem;">${item.parcelaAtual}/${item.totalParcelas}x</span>`;

    // Toggle expandir parcelas restantes (só quando há parcelas futuras)
    const expandirHTML = item.parcelado && item.totalParcelas > item.parcelaAtual
      ? `<label style="display:flex;align-items:center;gap:0.375rem;margin-top:0.375rem;cursor:pointer;font-size:0.75rem;font-weight:600;color:var(--card-text-sec);">
          <input type="checkbox" id="iaExpandir_${i}" ${item.expandirParcelas ? 'checked' : ''} style="accent-color:var(--btn-bg);width:0.875rem;height:0.875rem;" onchange="window._iaExpandirChange(${i}, this.checked)">
          <span>📅 Criar ${item.totalParcelas - item.parcelaAtual} parcela${item.totalParcelas - item.parcelaAtual !== 1 ? 's' : ''} restante${item.totalParcelas - item.parcelaAtual !== 1 ? 's' : ''} (${item.parcelaAtual + 1}/${item.totalParcelas} até ${item.totalParcelas}/${item.totalParcelas})</span>
         </label>`
      : '';

    const opcoesCategoria = CATS_IA.map(cat => {
      const emj = _catEmojiMap[cat] || '';
      const label = emj ? `${emj} ${cat}` : cat;
      const sel = cat === item.categoria ? ' selected' : '';
      return `<div class="custom-select-option${sel}" role="option" data-value="${escHtml(cat)}">${escHtml(label)}</div>`;
    }).join('');

    const triggerLabel = (() => {
      const emj = _catEmojiMap[item.categoria] || '';
      return emj ? `${emj} ${item.categoria}` : item.categoria;
    })();

    return `
      <div style="display:flex;gap:0.625rem;align-items:flex-start;padding:0.75rem;background:var(--card-bg);border:1.5px solid var(--card-border);border-radius:0.875rem;opacity:${item.selecionado ? '1' : '0.55'};" id="ia-item-${i}">
        <input type="checkbox" id="iaCheck_${i}" ${item.selecionado ? 'checked' : ''} style="margin-top:0.25rem;width:1rem;height:1rem;accent-color:var(--btn-bg);flex-shrink:0;cursor:pointer;" onchange="window._iaToggle(${i}, this.checked)">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.375rem;flex-wrap:wrap;margin-bottom:0.375rem;">
            ${badgesHTML}
          </div>
          <input type="text" value="${escHtml(item.desc)}" maxlength="100" style="width:100%;padding:0.375rem 0.5rem;border:1.5px solid var(--input-border);border-radius:0.5rem;font-size:0.8125rem;font-weight:600;color:var(--card-text);background:var(--input-bg);font-family:inherit;outline:none;margin-bottom:0.375rem;" oninput="window._iaDescChange(${i}, this.value)" onfocus="this.style.borderColor='var(--input-focus)'" onblur="this.style.borderColor='var(--input-border)'">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.375rem;">
            <div class="custom-select-wrap" data-ia-cat="${i}">
              <button type="button" class="custom-select-trigger ia-cat-trigger" style="padding:0.4375rem 1.75rem 0.4375rem 0.625rem;font-size:0.75rem;border-radius:0.5rem;" onclick="window._iaToggleCatDropdown(${i}, event)">
                <span class="ia-cat-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(triggerLabel)}</span>
                <span class="custom-select-arrow">▼</span>
              </button>
              <div class="custom-select-dropdown" id="iaCatDrop_${i}" role="listbox" style="font-size:0.75rem;" onclick="window._iaPickCat(${i}, event)">
                ${opcoesCategoria}
              </div>
            </div>
            <input type="text" value="${formatBRL(item.valor)}" style="padding:0.375rem 0.5rem;border:1.5px solid var(--input-border);border-radius:0.5rem;font-size:0.75rem;font-weight:700;color:var(--card-text);background:var(--input-bg);font-family:inherit;outline:none;text-align:right;" oninput="window._iaValorChange(${i}, this.value)" onfocus="this.style.borderColor='var(--input-focus)'" onblur="this.style.borderColor='var(--input-border)'">
          </div>
          ${expandirHTML}
        </div>
      </div>
    `;
  }).join('');

  // Handlers inline (window._ para acesso no HTML)
  window._iaToggle = (i, checked) => {
    itensIAExtraidos[i].selecionado = checked;
    const el = document.getElementById(`ia-item-${i}`);
    if (el) el.style.opacity = checked ? '1' : '0.55';
    atualizarResumoReviewIA();
  };
  window._iaDescChange = (i, val) => { itensIAExtraidos[i].desc = val; };
  window._iaCatChange  = (i, val) => { itensIAExtraidos[i].categoria = val; };
  window._iaValorChange = (i, val) => {
    const v = parseBRL(val);
    if (v > 0) itensIAExtraidos[i].valor = v;
    atualizarResumoReviewIA();
  };
  // Custom select de categoria (sem <select> nativo)
  window._iaToggleCatDropdown = (i, ev) => {
    ev.stopPropagation();
    const drop = document.getElementById(`iaCatDrop_${i}`);
    if (!drop) return;
    const trig = drop.previousElementSibling;
    const wasOpen = drop.classList.contains('open');
    // fechar todos os outros
    document.querySelectorAll('.custom-select-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.custom-select-trigger.open').forEach(t => t.classList.remove('open'));
    if (!wasOpen) {
      drop.classList.add('open');
      trig?.classList.add('open');
    }
  };
  window._iaPickCat = (i, ev) => {
    const opt = ev.target.closest('.custom-select-option');
    if (!opt) return;
    const val = opt.dataset.value;
    itensIAExtraidos[i].categoria = val;
    // atualizar label sem re-render completo
    const wrap = document.querySelector(`[data-ia-cat="${i}"]`);
    if (wrap) {
      const lbl = wrap.querySelector('.ia-cat-label');
      if (lbl) lbl.textContent = opt.textContent;
      wrap.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o === opt));
    }
    document.querySelectorAll('.custom-select-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.custom-select-trigger.open').forEach(t => t.classList.remove('open'));
  };
  // Fechar dropdowns IA ao clicar fora (registrado uma única vez)
  if (!window._iaOutsideClickRegistered) {
    window._iaOutsideClickRegistered = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-ia-cat]')) {
        document.querySelectorAll('[data-ia-cat] .custom-select-dropdown.open').forEach(d => d.classList.remove('open'));
        document.querySelectorAll('[data-ia-cat] .custom-select-trigger.open').forEach(t => t.classList.remove('open'));
      }
    });
  }
  window._iaExpandirChange = (i, checked) => {
    itensIAExtraidos[i].expandirParcelas = checked;
    atualizarResumoReviewIA();
  };
  // Seleções em massa
  window._iaSelAll = (val) => {
    itensIAExtraidos.forEach(it => { it.selecionado = !!val; });
    renderListaReviewIA();
  };
  window._iaSelCompras = () => {
    itensIAExtraidos.forEach(it => { it.selecionado = (it.status === 'ativa'); });
    renderListaReviewIA();
  };
  window._iaSelInv = () => {
    itensIAExtraidos.forEach(it => { it.selecionado = !it.selecionado; });
    renderListaReviewIA();
  };

  atualizarResumoReviewIA();
}

function atualizarResumoReviewIA() {
  const selecionados = itensIAExtraidos.filter(i => i.selecionado);
  const total = selecionados
    .filter(i => i.status !== 'estornado') // encargos selecionados manualmente também contam
    .reduce((s, i) => s + (i.valor || 0), 0);

  // Contar transações totais incluindo parcelas expandidas
  const totalTx = selecionados.reduce((s, i) => {
    if (i.selecionado && i.expandirParcelas && i.totalParcelas > i.parcelaAtual) {
      return s + 1 + (i.totalParcelas - i.parcelaAtual);
    }
    return s + 1;
  }, 0);

  const countEl = document.getElementById('iaResumoCount');
  const totalEl = document.getElementById('iaResumoTotal');
  if (countEl) countEl.textContent = `${totalTx} transa${totalTx !== 1 ? 'ções' : 'ção'}`;
  if (totalEl) {
    // Para importação de fatura PDF, o total relevante é o declarado pela fatura,
    // não a soma calculada das transações (que pode divergir por detecção imprecisa de estornos)
    const totalFatura = _importMetaIA?.totalAPagar;
    if (totalFatura) {
      totalEl.textContent = `Total da fatura: ${formatBRL(totalFatura)}`;
    } else {
      totalEl.textContent = `Total: ${formatBRL(total)}`;
    }
  }
}

async function salvarTransacoesIA() {
  const btn = document.getElementById('btnSalvarTransacoesIA');
  const mesEl = document.getElementById('iaMes');
  const anoEl = document.getElementById('iaAno');

  if (!mesEl?.value || !anoEl?.value) { showToast('Informe o mês e ano da fatura.', 'erro'); return; }

  const anoMes = `${anoEl.value}-${mesEl.value}`;
  const itensSelecionados = itensIAExtraidos.filter(i => i.selecionado);

  if (!itensSelecionados.length) { showToast('Selecione ao menos uma transação.', 'erro'); return; }

  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    // writeBatch atômico em chunks de 400 (limite Firestore: 500 ops/batch)
    // Garante que a importação é tudo-ou-nada: sem risco de fatura parcialmente salva
    const CHUNK = 400;
    const colRef = collection(db, 'usuarios', uid, 'transacoes');

    // Expandir itens com parcelamento inteligente (PEND-012)
    const itensExpandidos = [];
    for (const item of itensSelecionados) {
      // Derivar dataReferencia base para este item
      // SEMPRE usa o mês de faturamento (anoMes) como YYYY-MM.
      // Apenas o DIA vem do dataRaw para preservar a ordem cronológica dentro da fatura.
      // Isso garante que compras de abril numa fatura de maio apareçam em maio.
      let dataBase = `${anoMes}-15`;
      if (item.dataRaw) {
        const m  = item.dataRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const m2 = item.dataRaw.match(/^(\d{1,2})[\/\-](\d{1,2})/);
        const m3 = item.dataRaw.match(/^(\d{1,2})$/);
        if (m)       dataBase = `${anoMes}-${m[3]}`; // usa só o DIA, força YYYY-MM da fatura
        else if (m2) dataBase = `${anoMes}-${m2[1].padStart(2, '0')}`;
        else if (m3) dataBase = `${anoMes}-${m3[1].padStart(2, '0')}`;
      }

      itensExpandidos.push({ ...item, dataReferencia: dataBase });

      // Se parcelado e usuário ativou "expandir", gerar parcelas futuras
      if (item.expandirParcelas && item.parcelado && item.parcelaAtual && item.totalParcelas && item.totalParcelas > item.parcelaAtual) {
        for (let p = item.parcelaAtual + 1; p <= item.totalParcelas; p++) {
          const offset = p - item.parcelaAtual;
          const novaData = _addMesesData(dataBase, offset);
          // Substituir "N/M" na descrição pela nova parcela
          const novaDesc = item.desc
            .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/, `${p}/${item.totalParcelas}`)
            .replace(/PARCELA\s+\d+\s+DE\s+\d+/i, `PARCELA ${p} DE ${item.totalParcelas}`);
          itensExpandidos.push({
            ...item,
            desc: novaDesc,
            dataReferencia: novaData,
            parcelaAtual: p,
            expandirParcelas: false, // evitar recursão acidental
          });
        }
      }
    }

    for (let ci = 0; ci < itensExpandidos.length; ci += CHUNK) {
      const chunk = itensExpandidos.slice(ci, ci + CHUNK);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const [_iy, _im, _id] = (item.dataReferencia || '2000-01-01').split('-').map(Number);
        const docData = {
          tipo: 'despesa',
          descricao: budSanitize(item.desc).substring(0, 100),
          valor: item.valor,
          categoria: item.categoria.replace(/\p{Emoji}/gu, '').trim() || 'Outros',
          cartaoId: cartaoImportIA,
          dataReferencia: item.dataReferencia,
          data: Timestamp.fromDate(new Date(_iy, _im - 1, _id, 12, 0, 0)),
          formaPagamento: 'Crédito',
          pagamentoFatura: false,
          origem: 'importacao_ia',
          status: item.status || 'ativa',
          dataCriacao: serverTimestamp(),
        };

        if (item.parcelado && item.parcelaAtual && item.totalParcelas) {
          docData.parcelado = true;
          docData.parcelaAtual = item.parcelaAtual;
          docData.totalParcelas = item.totalParcelas;
        }

        batch.set(doc(colRef), docData);
      }

      await batch.commit();
    }

    const salvos = itensExpandidos.length;
    showToast(`${salvos} transaç${salvos !== 1 ? 'ões importadas' : 'ão importada'} com sucesso!`, 'ok');
    fecharModalReviewIA();
    itensIAExtraidos = [];
    cartaoImportIA = null;
    _importMetaIA = null;

  } catch {
    showToast('Erro ao salvar. Nenhuma transação foi importada. Tente novamente.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Salvar Selecionados';
  }
}

// ─── Custom Datepicker (Gasto) ────────────────────────────────────────────────

function setupDatepickerGasto() {
  const trigger  = document.getElementById('dpGastoTrigger');
  const calendar = document.getElementById('dpGastoCalendar');

  // Default: hoje
  const hoje = new Date();
  dpGastoData = toISODate(hoje);
  dpGastoMes  = hoje.getMonth();
  dpGastoAno  = hoje.getFullYear();
  document.getElementById('dpGastoHidden').value = dpGastoData;
  document.getElementById('dpGastoLabel').textContent = 'Hoje';

  renderCalendarioGasto();

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !calendar.classList.contains('open');
    if (willOpen) {
      // Smart positioning: abrir para cima se espaço abaixo insuficiente
      calendar.classList.remove('open-up');
      const rect = trigger.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 280) calendar.classList.add('open-up');
    }
    calendar.classList.toggle('open');
    trigger.classList.toggle('open', calendar.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!trigger?.contains(e.target) && !calendar?.contains(e.target)) {
      calendar?.classList.remove('open');
      trigger?.classList.remove('open');
    }
  });
}

function renderCalendarioGasto() {
  const cal = document.getElementById('dpGastoCalendar');
  if (!cal) return;

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const primeiroDia = new Date(dpGastoAno, dpGastoMes, 1).getDay();
  const diasNoMes   = new Date(dpGastoAno, dpGastoMes + 1, 0).getDate();
  const hoje = toISODate(new Date());

  let html = `
    <div class="dp-header">
      <button type="button" class="dp-nav-btn" id="dpGastoPrev">‹</button>
      <span class="dp-month-label">${MESES_PT[dpGastoMes]} ${dpGastoAno}</span>
      <button type="button" class="dp-nav-btn" id="dpGastoNext">›</button>
    </div>
    <div class="dp-weekdays">
      ${diasSemana.map(d => `<div class="dp-weekday">${d}</div>`).join('')}
    </div>
    <div class="dp-days">
      ${Array(primeiroDia).fill('<button type="button" class="dp-day empty" disabled></button>').join('')}
      ${Array.from({length: diasNoMes}, (_, i) => {
        const d = i + 1;
        const dateStr = `${dpGastoAno}-${String(dpGastoMes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const sel  = dateStr === dpGastoData ? 'selected' : '';
        const tod  = dateStr === hoje ? 'today' : '';
        return `<button type="button" class="dp-day ${sel} ${tod}" data-date="${dateStr}">${d}</button>`;
      }).join('')}
    </div>
    <button type="button" class="dp-clear" id="dpGastoClear">Hoje</button>
  `;

  cal.innerHTML = html;

  cal.querySelector('#dpGastoPrev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dpGastoMes === 0) { dpGastoMes = 11; dpGastoAno--; } else dpGastoMes--;
    renderCalendarioGasto();
  });
  cal.querySelector('#dpGastoNext')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dpGastoMes === 11) { dpGastoMes = 0; dpGastoAno++; } else dpGastoMes++;
    renderCalendarioGasto();
  });
  cal.querySelector('#dpGastoClear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = new Date();
    dpGastoMes  = now.getMonth();
    dpGastoAno  = now.getFullYear();
    dpGastoData = toISODate(now);
    document.getElementById('dpGastoHidden').value = dpGastoData;
    document.getElementById('dpGastoLabel').textContent = 'Hoje';
    renderCalendarioGasto();
    cal.classList.remove('open');
    document.getElementById('dpGastoTrigger')?.classList.remove('open');
  });
  cal.querySelectorAll('.dp-day[data-date]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dpGastoData = btn.dataset.date;
      document.getElementById('dpGastoHidden').value = dpGastoData;
      document.getElementById('dpGastoLabel').textContent = formatDataLabel(dpGastoData);
      cal.classList.remove('open');
      document.getElementById('dpGastoTrigger')?.classList.remove('open');
      renderCalendarioGasto();
    });
  });
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function maskBRL(val) {
  const reais = parseBRL(val);
  if (!Number.isFinite(reais)) return '';
  return reais.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function parseBRL(str) {
  if (!str) return 0;
  const raw = String(str).replace(/R\$|\s/g, '');
  const clean = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  return Number(clean) || 0;
}

function formatBRL(val) {
  return (val || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function formatData(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr; // formato inválido — retorna como veio
  const [, m, d] = parts;
  return `${d}/${m}`;
}

function formatDataLabel(dateStr) {
  if (!dateStr) return '—';
  const hoje = toISODate(new Date());
  if (dateStr === hoje) return 'Hoje';
  const [a, m, d] = dateStr.split('-');
  return `${d}/${m}/${a}`;
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function setSelectValue(labelId, hiddenId, value, label) {
  const lEl = document.getElementById(labelId);
  const hEl = document.getElementById(hiddenId);
  if (lEl) lEl.textContent = label;
  if (hEl) hEl.value = value;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, tipo = 'ok') {
  const existing = document.getElementById('budToast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'budToast';
  const bg = tipo === 'ok' ? '#10b981' : '#ef4444';
  t.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
    background:${bg}; color:#fff; padding:0.75rem 1.25rem;
    border-radius:0.875rem; font-size:0.875rem; font-weight:700;
    box-shadow:0 8px 24px -4px rgba(0,0,0,0.25);
    animation:fadeInUp .25s ease; font-family:inherit;
    max-width:320px;
  `;
  t.textContent = msg;
  document.body.appendChild(t);

  const styleId = 'budToastStyle';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(s);
  }

  setTimeout(() => t.remove(), 3500);
}
