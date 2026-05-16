// js/cartoes.js — Cartões de Crédito
// DEC-034: Persiste em usuarios/{uid}/carteira com tipo:'credito'
// Fatura calculada dinamicamente (sem campos denormalizados)
// Firebase Modular SDK 10.8.1

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, deleteDoc, getDocs, getDoc, where, doc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

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
    db   = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      if (!user || !user.emailVerified) {
        window.location.href = 'index.html';
        return;
      }
      try {
        await user.getIdToken(true);
      } catch {
        window.location.href = 'index.html';
        return;
      }
      uid = user.uid;
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
  dadosCartoes.forEach(({ cartao, fatura, status, limite, dispPct, gastos }, idx) => {
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
    ? `<div style="padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:600;color:var(--card-text-sec);text-align:center;">+${gastos.length - 10} gastos não exibidos</div>`
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

  // Modal Review IA
  document.getElementById('btnFecharModalReviewIA')?.addEventListener('click', fecharModalReviewIA);
  document.getElementById('btnVoltarReviewIA')?.addEventListener('click', () => { fecharModalReviewIA(); abrirModalImportIA(cartaoImportIA, true); });
  document.getElementById('btnSalvarTransacoesIA')?.addEventListener('click', salvarTransacoesIA);

  // Month dropdown: iaMes
  _initIaMesDropdown();

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
  document.getElementById('inputLimite')?.addEventListener('input', (e) => {
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
      const perfilPlano = null; // será obtido do perfil real em sprint futura
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

  document.getElementById('inputValorGasto')?.addEventListener('input', (e) => {
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
  let badgeBg, badgeColor, badgeText;

  if (meta && meta.totalCompras > 0) {
    // Soma TODOS os itens ativos extraídos (independente de seleção)
    // para mostrar quanto a IA capturou vs o total declarado no PDF
    const somaAtivos = itensIAExtraidos
      .filter(i => i.status === 'ativa')
      .reduce((s, i) => s + i.valor, 0);
    const pct    = Math.min(somaAtivos / meta.totalCompras, 1.05);
    const pctStr = Math.round(pct * 100) + '%';
    const fmt    = v => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const det    = `compras: ${fmt(somaAtivos)} de ${fmt(meta.totalCompras)} (${pctStr})`;

    if (pct < 0.70) {
      badgeBg = '#fee2e2'; badgeColor = '#b91c1c';
      badgeText = `❌ Resultado NÃO confiável — IA capturou ${pctStr} · ${det}`;
    } else if (pct < 0.90) {
      badgeBg = '#fff7ed'; badgeColor = '#c2410c';
      badgeText = `⚠️ Precisão parcial — IA capturou ${pctStr} · ${det}`;
    } else {
      badgeBg = '#dcfce7'; badgeColor = '#15803d';
      badgeText = `✅ Alta precisão — ${pctStr} capturado · ${det}`;
    }
  } else {
    // Sem totalCompras → não verificável
    badgeBg = '#fef3c7'; badgeColor = '#92400e';
    badgeText = '⚠️ PDF/IA — precisão não verificável · confira cada linha manualmente';
  }

  badge.style.cssText = `display:block;font-size:0.7rem;font-weight:700;padding:0.35rem 0.75rem;border-radius:8px;white-space:normal;line-height:1.5;background:${badgeBg};color:${badgeColor};margin-bottom:0.75rem;`;
  badge.textContent = badgeText;
}

function abrirModalImportIA(cartaoId, manterArquivo = false) {
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
    });
  }
  return results;
}

async function processarOFXLocal(file) {
  const text = await file.text();
  const raw = parseOFXLocal(text);
  if (raw.length === 0) throw new Error('Nenhuma transação encontrada no arquivo OFX.');

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

async function enviarParaIA() {
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
    _importMetaIA = null; // OFX não tem meta
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
  return itens.map((item) => {
    const desc = String(item.desc || item.descricao || item.description || '').trim();
    const valor = Math.abs(parseFloat(String(item.valor || item.value || item.amount || 0).replace(',', '.')) || 0);
    const dataRaw = String(item.data || item.date || '').trim();
    const valorOriginal = parseFloat(String(item.valor || item.value || item.amount || 0).replace(',', '.')) || 0;

    let status = 'ativa';
    const descUpper = desc.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Pagamento de fatura / crédito
    if (/PAGAMENTO RECEBIDO|PAGTO RECEBIDO|PAYMENT RECEIVED|PAGAMENTO DE FATURA|PGTO FATURA/.test(descUpper)) {
      status = 'estornado';
    }
    // Valor negativo = crédito/estorno
    if (valorOriginal < 0) {
      status = 'estornado';
    }
    // Palavras de estorno
    if (/ESTORNO|DEVOLUC|DEVOLUCAO|REEMBOLSO|CHARGEBACK|CREDITO FATURA|RESSARCIMENTO/.test(descUpper)) {
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
}

// ─── Auto-categorização ───────────────────────────────────────────────────────

function detectarCategoriaIA(desc) {
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const regras = [
    // Transporte / Uber
    { cat: 'Uber/Táxi',         words: ['uber', '99pop', '99 pop', 'cabify', 'indrive', 'in drive', 'taxi', 'táxi', 'transfer'] },
    // Delivery
    { cat: 'Delivery',          words: ['ifood', 'ifd*', 'rappi', 'ze delivery', 'zé delivery', 'loggi', 'delivery', 'entrega'] },
    // Streaming / Assinaturas
    { cat: 'Assinaturas',       words: ['netflix', 'spotify', 'amazon prime', 'amazon music', 'youtube premium', 'youtube music', 'globoplay', 'disney', 'hbo', 'paramount', 'apple tv', 'apple one', 'chatgpt', 'openai', 'github', 'notion', 'figma', 'canva', 'adobe', 'microsoft', 'office 365', 'google one', 'dropbox', 'icloud', 'nubank assinatura', 'plano anual', 'plano mensal'] },
    // Mercado / Supermercado
    { cat: 'Mercado',           words: ['carrefour', 'assai', 'assaí', 'pao de acucar', 'pão de açúcar', 'extra', 'cia', 'atacadao', 'atacadão', 'aldi', 'lidl', 'walmart', 'sam\'s', 'costco', 'makro', 'supermercado', 'supermarket', 'hortifruti', 'prezunic', 'guanabara', 'mundial'] },
    // Farmácia / Saúde
    { cat: 'Farmácia',          words: ['drogaria', 'drogasil', 'drogasmil', 'pacheco', 'pague menos', 'ultrafarma', 'farmacia', 'farmácia', 'droga', 'pharma', 'lifemed', 'sempre viva'] },
    // Saúde
    { cat: 'Saúde',             words: ['hospital', 'clinica', 'clínica', 'laboratorio', 'laboratório', 'exame', 'consulta', 'dentista', 'odonto', 'unimed', 'bradesco saude', 'amil', 'sulamerica', 'hapvida', 'notredame', 'plano de saude', 'academia', 'smart fit', 'bluefit', 'wellness', 'biomedicina'] },
    // Restaurante / Lanchonete
    { cat: 'Restaurante',       words: ['restaurante', 'pizzaria', 'hamburgueria', 'churrascaria', 'mcdonalds', 'mcdonald', 'burger king', 'bk', 'subway', 'kfc', 'dominos', 'domino\'s', 'giraffas', 'habib', 'outback', 'ciao', 'sushi', 'temakeria', 'cantina', 'bistro', 'bistrô', 'bar e', 'choperia', 'taberna', 'trattoria'] },
    // Padaria / Café
    { cat: 'Padaria/Café',      words: ['starbucks', 'padaria', 'panificadora', 'confeitaria', 'cafe', 'café', 'bakery', 'pao', 'pão', 'nespresso', 'tres coracoes', '3 corações'] },
    // Combustível
    { cat: 'Combustível',       words: ['shell', 'ipiranga', 'petrobras', 'br posto', 'posto', 'combustivel', 'combustível', 'gasolina', 'etanol', 'diesel', 'gnv', 'rede ipiranga', 'vibra'] },
    // Roupas / Moda
    { cat: 'Roupas',            words: ['renner', 'riachuelo', 'marisa', 'cea', 'c&a', 'zara', 'h&m', 'hm', 'farm', 'arezzo', 'schutz', 'shein', 'shopee', 'dafiti', 'privalia', 'netshoes', 'nike', 'adidas', 'puma', 'track field', 'lupo', 'hering', 'dudalina', 'loja de roupa', 'boutique'] },
    // Eletrônicos / Tecnologia
    { cat: 'Eletrônicos',       words: ['amazon', 'magalu', 'magazine luiza', 'americanas', 'casas bahia', 'kabum', 'pichau', 'terabyte', 'fast shop', 'apple store', 'samsung', 'lg', 'lenovo', 'dell', 'hp', 'eletronico', 'eletrônico', 'informatica', 'informática', 'celular', 'smartphone', 'notebook', 'tablet', 'iphone', 'ipad'] },
    // Educação
    { cat: 'Educação',          words: ['faculdade', 'universidade', 'escola', 'colegio', 'colégio', 'cursinho', 'curso', 'alura', 'udemy', 'coursera', 'duolingo', 'rocketseat', 'dio', 'origamid', 'estacio', 'kroton', 'anhanguera', 'unip', 'livro', 'livraria', 'saraiva', 'cultura', 'fnac'] },
    // Pet
    { cat: 'Pet',               words: ['petz', 'cobasi', 'petlove', 'petshop', 'pet shop', 'veterinario', 'veterinário', 'veterinaria', 'clinica vet', 'racao', 'ração', 'bichinho'] },
    // Viagem / Hospedagem
    { cat: 'Viagem',            words: ['airbnb', 'booking', 'hotel', 'pousada', 'hostel', 'hoteis', 'hotéis', 'decolar', 'azul', 'latam', 'gol linhas', 'tam', 'passagem', 'aeroporto', 'voo', 'mala', 'luggage', 'turismo', 'trip', 'trivago'] },
    // Beleza
    { cat: 'Beleza',            words: ['salao', 'salão', 'barbearia', 'barber', 'beauty', 'estetica', 'estética', 'manicure', 'pedicure', 'spa', 'waxing', 'depilacao', 'depilação', 'botox', 'clinica estetica'] },
    // Moradia / Serviços domésticos
    { cat: 'Moradia',           words: ['aluguel', 'condominio', 'condomínio', 'iptu', 'energia', 'enel', 'cemig', 'copel', 'celpe', 'coelba', 'eletropaulo', 'agua', 'água', 'sabesp', 'cedae', 'copasa', 'saneamento', 'gas', 'gás', 'comgas', 'copagaz', 'ultragaz', 'supergasbras', 'internet', 'vivo fibra', 'claro', 'oi fibra', 'tim live', 'net combo'] },
    // Serviços / Outros recorrentes
    { cat: 'Serviços',          words: ['correios', 'cartorio', 'cartório', 'seguro', 'detran', 'ipva', 'multa', 'notario', 'tabeliao'] },
    // Pagamento de fatura (especial)
    { cat: 'Cartão de Crédito', words: ['pagamento fatura', 'pagamento do cartao', 'pagto fatura', 'pgto fatura'] },
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
  if (totalEl) totalEl.textContent = `Total: ${formatBRL(total)}`;
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
  const num = val.replace(/\D/g, '');
  if (!num) return '';
  const cents = parseInt(num, 10);
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function parseBRL(str) {
  if (!str) return 0;
  const clean = str.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatBRL(val) {
  return (val || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function formatData(dateStr) {
  if (!dateStr) return '—';
  const [, m, d] = dateStr.split('-');
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
