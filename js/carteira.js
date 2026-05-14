/**
 * js/carteira.js — Minhas Contas
 * Hub para contas não-crédito (débito, dinheiro, benefícios) + importação de extratos
 * Firebase SDK Modular v10.8.1 | ES Module
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, query, where, orderBy, getDocs, limit,
  getDoc, addDoc, updateDoc, deleteDoc, doc, writeBatch,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ── Init Firebase ─────────────────────────────────────────
const app = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const BACKEND_URL = (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com');
const PER_PAGE = 25;
const MAX_BATCH = 400;

// ── State ─────────────────────────────────────────────────
let currentUser = null;
let userData = null;
let contasGlobal = [];
let valoresOcultos = false;
let parsedRows = [];       // rows after parse + map
let _importSourceType = null; // 'ofx' | 'csv' | 'pdf' | 'imagem'
let _importMeta = null;       // {totalEntradas, totalSaidas, saldoFinal} do PDF — para barra de confiança
let _importFileHash = null;   // SHA-256 do arquivo importado — para detectar reimportação do mesmo arquivo
let _importFileName = null;   // nome do arquivo (para gravação no histórico)
let currentCarteiraId = null;
let currentContaObj = null;
let previewPage = 0;
let globalTipo = 'auto';
let globalCat = '';
let dedupIds = new Set();
let excluirContaId = null;
let contaCorSelecionada = 'sem_cor';
let _rowCatDdTargetIdx = null;
let _rowCatDdBtn = null;
let _contaTipoClickHandler = null;

// ── Sort / Filter state ───────────────────────────────────
let _contasSortBy = 'criado';   // 'criado' | 'nome' | 'saldo' | 'atualizado'
let _contasFiltroTipo = 'todos'; // 'todos' | 'debito' | 'dinheiro' | 'beneficio' | 'transporte'

const _SORT_LABELS = { criado: '↕ Criação', nome: '↕ Nome A-Z', saldo: '↕ Maior Saldo', atualizado: '↕ Recente' };
const _SORT_CYCLE  = ['criado', 'nome', 'saldo', 'atualizado'];

// ── Cores map ─────────────────────────────────────────────
const CORES_MAP = {
  sem_cor:  null,
  roxo:     '#7c3aed',
  azul:     '#2563eb',
  teal:     '#0d9488',
  verde:    '#16a34a',
  laranja:  '#f97316',
  vermelho: '#ef4444',
  rosa:     '#ec4899',
  amarelo:  '#d97706',
  cyan:     '#0891b2',
  preto:    '#374151',
};

// ── Tipo config ───────────────────────────────────────────
const TIPO_CONFIG = {
  dinheiro:        { icon: '💵', label: 'Dinheiro',            color: '#16a34a', bg: '#f0fdf4' },
  debito:          { icon: '🏦', label: 'Conta Bancária',      color: '#2563eb', bg: '#eff6ff' },
  vale_refeicao:   { icon: '🍽️', label: 'Vale Refeição',       color: '#ea580c', bg: '#fff7ed' },
  vale_alimentacao:{ icon: '🛒', label: 'Vale Alimentação',    color: '#16a34a', bg: '#f0fdf4' },
  transporte:      { icon: '🚌', label: 'Transporte / VT',     color: '#7c3aed', bg: '#f5f3ff' },
};

// ── Bancos (logo + cor de marca) ──────────────────────────
const BANCOS_LOOKUP = [
  { match: /nubank|nu\b/i,                     abbrev: 'Nu',     bg: '#820AD1', text: '#fff', label: 'Nubank' },
  { match: /ita[uú]|iti\b/i,                   abbrev: 'Itaú',   bg: '#EC7000', text: '#fff', label: 'Itaú' },
  { match: /bradesco/i,                         abbrev: 'Brad',   bg: '#CC092F', text: '#fff', label: 'Bradesco' },
  { match: /santander/i,                        abbrev: 'Sant',   bg: '#EC0000', text: '#fff', label: 'Santander' },
  { match: /banco do brasil|bb\b|cartao bb/i,   abbrev: 'BB',     bg: '#F7B801', text: '#1a1a1a', label: 'Banco do Brasil' },
  { match: /caixa|cef\b/i,                      abbrev: 'CEF',    bg: '#0070AF', text: '#fff', label: 'Caixa' },
  { match: /inter\b|banco inter/i,              abbrev: 'Inter',  bg: '#FF7A00', text: '#fff', label: 'Inter' },
  { match: /c6\b|c6 bank/i,                     abbrev: 'C6',     bg: '#242424', text: '#fff', label: 'C6 Bank' },
  { match: /xp\b|xp invest/i,                   abbrev: 'XP',     bg: '#1A1A1A', text: '#fff', label: 'XP Investimentos' },
  { match: /sicoob/i,                           abbrev: 'Sic',    bg: '#005EA6', text: '#fff', label: 'Sicoob' },
  { match: /sicredi/i,                          abbrev: 'Scr',    bg: '#009E44', text: '#fff', label: 'Sicredi' },
  { match: /picpay/i,                           abbrev: 'PP',     bg: '#21C25E', text: '#fff', label: 'PicPay' },
  { match: /btg/i,                              abbrev: 'BTG',    bg: '#003087', text: '#fff', label: 'BTG Pactual' },
  { match: /neon/i,                             abbrev: 'Neon',   bg: '#00B7DC', text: '#fff', label: 'Neon' },
  { match: /original/i,                         abbrev: 'Orig',   bg: '#00B050', text: '#fff', label: 'Banco Original' },
  { match: /mercado pago|pagbank|pag\b/i,        abbrev: 'MP',     bg: '#009EE3', text: '#fff', label: 'Mercado Pago' },
  { match: /next\b/i,                           abbrev: 'Next',   bg: '#00CF72', text: '#fff', label: 'Next' },
  { match: /pan\b|banco pan/i,                  abbrev: 'Pan',    bg: '#0070B8', text: '#fff', label: 'Banco Pan' },
  { match: /agi\b|agibank/i,                    abbrev: 'Agi',    bg: '#FF4500', text: '#fff', label: 'Agibank' },
  { match: /will bank/i,                        abbrev: 'Will',   bg: '#4B0082', text: '#fff', label: 'Will Bank' },
  { match: /votorantim|bv\b/i,                  abbrev: 'BV',     bg: '#005BAC', text: '#fff', label: 'Banco BV' },
];

function detectarBanco(nome) {
  if (!nome) return null;
  return BANCOS_LOOKUP.find(b => b.match.test(nome)) || null;
}

// ── Auth guard ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    userData = snap.exists() ? snap.data() : {};
  } catch (_) { userData = {}; }
  initSidebar();
  initLogout();
  initSidebarToggle();
  initToggles();
  await carregarContas();
  await carregarHistoricoImportacoes();
  ocultarSplash();
});

// ── Splash ────────────────────────────────────────────────
function ocultarSplash() {
  const s = document.getElementById('splash');
  if (s) { s.classList.add('hide'); setTimeout(() => { s.style.display = 'none'; }, 500); }
}

// ── Sidebar user ──────────────────────────────────────────
function initSidebar() {
  const nome = userData?.nome || currentUser.displayName || 'Usuário';
  const email = currentUser.email || '';
  const av = document.getElementById('sidebarAvatar');
  if (av) av.textContent = nome.charAt(0).toUpperCase();
  const nm = document.getElementById('sidebarUserName');
  if (nm) nm.textContent = nome;
  const id = document.getElementById('sidebarUserId');
  if (id) id.textContent = email;
}

function initLogout() {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => signOut(auth).then(() => { window.location.href = 'index.html'; }));
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const dashMain = document.getElementById('dashMain');
  const btnCollapse = document.getElementById('btnSidebarCollapse');
  const btnHamburger = document.getElementById('btnHamburger');
  const overlay = document.getElementById('sidebarOverlay');

  if (btnCollapse) {
    btnCollapse.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      dashMain.classList.toggle('sidebar-collapsed');
      btnCollapse.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
    });
  }
  if (btnHamburger) {
    btnHamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
}

function initToggles() {
  // Ocultar/mostrar valores
  const btnV = document.getElementById('btnToggleValues');
  if (btnV) {
    btnV.addEventListener('click', () => {
      valoresOcultos = !valoresOcultos;
      btnV.textContent = valoresOcultos ? '🙈' : '👁️';
      renderContas();
      renderKPIs();
    });
  }

  // Sync
  const btnSync = document.getElementById('btnSync');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.style.opacity = '0.5';
      btnSync.style.pointerEvents = 'none';
      await carregarContas();
      await carregarHistoricoImportacoes();
      btnSync.style.opacity = '';
      btnSync.style.pointerEvents = '';
    });
  }

  // Nova conta
  const btnNova = document.getElementById('btnNovaConta');
  if (btnNova) btnNova.addEventListener('click', () => abrirModalConta(null));

  // Botão transferência no header
  const btnTransfHeader = document.getElementById('btnTransferencia');
  if (btnTransfHeader) btnTransfHeader.addEventListener('click', () => abrirModalTransferencia(null));

  initFiltroOrdem();
}

// ── Filtro e Ordenação de Contas ──────────────────────────
function initFiltroOrdem() {
  // Filter pills
  const pillsContainer = document.getElementById('contaFilterPills');
  if (pillsContainer) {
    pillsContainer.addEventListener('click', e => {
      const pill = e.target.closest('.conta-filter-pill');
      if (!pill) return;
      pillsContainer.querySelectorAll('.conta-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _contasFiltroTipo = pill.dataset.tipo;
      renderContas();
    });
  }

  // Sort button — cycles through sort modes
  const btnSort = document.getElementById('btnSortContas');
  if (btnSort) {
    btnSort.addEventListener('click', () => {
      const idx = _SORT_CYCLE.indexOf(_contasSortBy);
      _contasSortBy = _SORT_CYCLE[(idx + 1) % _SORT_CYCLE.length];
      btnSort.textContent = _SORT_LABELS[_contasSortBy];
      renderContas();
    });
  }
}

// ── Carregar Contas ───────────────────────────────────────
async function carregarContas() {
  try {
    const snap = await getDocs(collection(db, 'usuarios', currentUser.uid, 'carteira'));
    contasGlobal = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.tipo !== 'credito')
      .sort((a, b) => (a.criadaEm?.toMillis?.() ?? 0) - (b.criadaEm?.toMillis?.() ?? 0));
  } catch (err) {
    console.error('Erro ao carregar contas:', err);
    contasGlobal = [];
  }
  renderContas();
  renderKPIs();
}

// ── Histórico de Importações ──────────────────────────────
async function carregarHistoricoImportacoes() {
  const section = document.getElementById('sectionHistoricoImport');
  if (!section) return;
  try {
    const q = query(
      collection(db, 'usuarios', currentUser.uid, 'importacoes'),
      orderBy('dataImportacao', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Migrar dados legados de arquivosImportados (campo do doc da conta) para a sub-coleção
    if (items.length === 0) {
      items = await _migrarArquivosImportados();
    }

    renderHistoricoImportacoes(items);
    // Melhoria: atualizar KPI com a importação mais recente da sub-coleção
    if (items.length > 0 && items[0].dataImportacao?.toDate) {
      const kpiImport = document.getElementById('kpiUltImport');
      const kpiImportSub = document.getElementById('kpiUltImportSub');
      if (kpiImport) kpiImport.textContent = items[0].dataImportacao.toDate().toLocaleDateString('pt-BR');
      if (kpiImportSub) {
        const banco = items[0].contaNome || '';
        let subText = banco;
        if (items[0].periodoInicio && items[0].periodoFim) {
          const [, mi, di] = items[0].periodoInicio.split('-');
          const [, mf, df] = items[0].periodoFim.split('-');
          subText += ` · ${di}/${mi} – ${df}/${mf}`;
        } else if (items[0].periodoInicio) {
          const [, mi, di] = items[0].periodoInicio.split('-');
          subText += ` · a partir de ${di}/${mi}`;
        }
        kpiImportSub.textContent = subText || 'Último extrato importado';
      }
    }
  } catch (err) {
    console.warn('[histórico] Erro ao carregar:', err);
    renderHistoricoImportacoes([]);
  }
}

async function _migrarArquivosImportados() {
  const migrados = [];
  for (const conta of contasGlobal) {
    const arqs = conta.arquivosImportados;
    if (!arqs) continue;
    for (const [, info] of Object.entries(arqs)) {
      if (!info || !info.data) continue;
      try {
        const ref = await addDoc(collection(db, 'usuarios', currentUser.uid, 'importacoes'), {
          contaId:        conta.id,
          contaNome:      conta.nome || '',
          nomeArquivo:    info.nome || 'arquivo',
          origem:         info.origem || 'desconhecido',
          qtdTransacoes:  info.totalTransacoes || 0,
          receitas:       0,
          despesas:       0,
          periodoInicio:  null,
          periodoFim:     null,
          dataImportacao: Timestamp.fromDate(new Date(info.data)),
        });
        migrados.push({ id: ref.id, contaId: conta.id, contaNome: conta.nome, nomeArquivo: info.nome, origem: info.origem, qtdTransacoes: info.totalTransacoes, dataImportacao: { toDate: () => new Date(info.data) } });
      } catch (_) { /* silencioso */ }
    }
  }
  // Ordena mais recente primeiro
  migrados.sort((a, b) => b.dataImportacao.toDate() - a.dataImportacao.toDate());
  return migrados;
}

function renderHistoricoImportacoes(items) {
  const section = document.getElementById('sectionHistoricoImport');
  const lista   = document.getElementById('historicoImportLista');
  const vazio   = document.getElementById('historicoImportVazio');
  if (!section || !lista) return;

  if (!items.length) {
    lista.style.display = 'none';
    if (vazio) vazio.style.display = 'block';
    return;
  }

  lista.style.display = 'block';
  if (vazio) vazio.style.display = 'none';

  const ORIGEM_LABEL = { pdf: 'PDF', ofx: 'OFX', csv: 'CSV', imagem: 'Imagem', desconhecido: '—' };

  lista.innerHTML = '';
  items.forEach(item => {
    let dataStr = '—';
    if (item.dataImportacao?.toDate) {
      const d = item.dataImportacao.toDate();
      dataStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    let periodoStr = '—';
    if (item.periodoInicio && item.periodoFim) {
      const [yi, mi, di] = item.periodoInicio.split('-');
      const [yf, mf, df] = item.periodoFim.split('-');
      periodoStr = `${di}/${mi}/${yi} → ${df}/${mf}/${yf}`;
    } else if (item.periodoInicio) {
      const [yi, mi, di] = item.periodoInicio.split('-');
      periodoStr = `${di}/${mi}/${yi}`;
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-top:1px solid var(--input-border);flex-wrap:wrap;';

    const origemLabel = ORIGEM_LABEL[item.origem] || item.origem || '—';
    const origemBg = item.origem === 'pdf' ? '#ede9fe' : item.origem === 'ofx' ? '#dbeafe' : item.origem === 'csv' ? '#dcfce7' : '#f1f5f9';
    const origemColor = item.origem === 'pdf' ? '#5b21b6' : item.origem === 'ofx' ? '#1d4ed8' : item.origem === 'csv' ? '#15803d' : '#475569';

    const recStr = (item.receitas > 0 || item.despesas > 0)
      ? `<div style="font-size:0.6875rem;font-weight:600;margin-top:2px;"><span style="color:#16a34a;">↑ ${fmtBRL(item.receitas||0)}</span>&nbsp;&nbsp;<span style="color:#dc2626;">↓ ${fmtBRL(item.despesas||0)}</span></div>`
      : '';
    row.innerHTML = `
      <div style="width:2.25rem;height:2.25rem;border-radius:0.625rem;background:${origemBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.75rem;font-weight:800;color:${origemColor};">${origemLabel}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.nomeArquivo || '')}">${escapeHtml(item.nomeArquivo || 'arquivo')}</div>
        <div style="font-size:0.75rem;color:var(--card-text-sec);margin-top:0.125rem;">${escapeHtml(item.contaNome || '—')} · Período: ${periodoStr}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);">${item.qtdTransacoes || 0} transações</div>
        ${recStr}
        <div style="font-size:0.6875rem;color:var(--card-text-sec);">${dataStr}</div>
      </div>`;
    if (item.periodoInicio && item.periodoFim) {
      const linkEl = document.createElement('a');
      linkEl.href = `extrato.html?inicio=${item.periodoInicio}&fim=${item.periodoFim}`;
      linkEl.style.cssText = 'font-size:0.75rem;color:#2563eb;font-weight:600;padding:0.25rem 0.625rem;border-radius:0.375rem;border:1px solid #bfdbfe;background:#eff6ff;text-decoration:none;white-space:nowrap;flex-shrink:0;align-self:center;';
      linkEl.textContent = '📋 Ver';
      row.appendChild(linkEl);
    }
    lista.appendChild(row);
  });
}

// ── Render KPIs ───────────────────────────────────────────
function renderKPIs() {
  const total = contasGlobal.reduce((s, c) => s + getSaldoExibido(c), 0);
  const qtd = contasGlobal.length;

  const kpiTotal = document.getElementById('kpiTotal');
  if (kpiTotal) kpiTotal.textContent = valoresOcultos ? '••••••' : fmtBRL(total);

  const kpiTotalSub = document.getElementById('kpiTotalSub');
  if (kpiTotalSub) kpiTotalSub.textContent = `${qtd} conta${qtd !== 1 ? 's' : ''}`;

  const kpiContas = document.getElementById('kpiContas');
  if (kpiContas) kpiContas.textContent = qtd;

  const kpiContasSub = document.getElementById('kpiContasSub');
  if (kpiContasSub) {
    if (!qtd) { kpiContasSub.textContent = 'Nenhuma conta cadastrada'; }
    else {
      const tipos = [...new Set(contasGlobal.map(c => TIPO_CONFIG[c.tipo]?.label || c.tipo))];
      kpiContasSub.textContent = tipos.slice(0, 3).join(', ');
    }
  }

  // Última importação
  let lastImport = null;
  contasGlobal.forEach(c => {
    if (c.ultimaConfirmacao?.data) {
      const d = c.ultimaConfirmacao.data;
      if (!lastImport || d > lastImport) lastImport = d;
    }
  });
  const kpiImport = document.getElementById('kpiUltImport');
  const kpiImportSub = document.getElementById('kpiUltImportSub');
  if (kpiImport) kpiImport.textContent = lastImport ? fmtDataBR(lastImport) : '—';
  if (kpiImportSub) kpiImportSub.textContent = lastImport ? 'Data do último extrato' : 'Nenhum extrato importado';
}

// ── Render Contas Grid ────────────────────────────────────
function getContasFiltradas() {
  let lista = [...contasGlobal];

  // Filtro por tipo
  if (_contasFiltroTipo !== 'todos') {
    if (_contasFiltroTipo === 'beneficio') {
      lista = lista.filter(c => c.tipo === 'vale_refeicao' || c.tipo === 'vale_alimentacao');
    } else {
      lista = lista.filter(c => c.tipo === _contasFiltroTipo);
    }
  }

  // Ordenação
  if (_contasSortBy === 'nome') {
    lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  } else if (_contasSortBy === 'saldo') {
    lista.sort((a, b) => getSaldoExibido(b) - getSaldoExibido(a));
  } else if (_contasSortBy === 'atualizado') {
    lista.sort((a, b) => {
      const da = a.ultimaConfirmacao?.data ? new Date(a.ultimaConfirmacao.data).getTime() : 0;
      const db_ = b.ultimaConfirmacao?.data ? new Date(b.ultimaConfirmacao.data).getTime() : 0;
      return db_ - da;
    });
  } else {
    // criado — preserva a ordem original (já ordenada por criadaEm)
  }

  return lista;
}

function renderContas() {
  const grid = document.getElementById('contasGrid');
  const contador = document.getElementById('contasContador');
  if (!grid) return;

  if (!contasGlobal.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🏦</div>
        <div class="empty-state-title">Nenhuma conta cadastrada</div>
        <div class="empty-state-sub">Clique em "+ Nova Conta" para começar</div>
      </div>`;
    if (contador) contador.textContent = '0 contas';
    return;
  }

  const filtradas = getContasFiltradas();

  if (contador) {
    const n = filtradas.length;
    const total = contasGlobal.length;
    contador.textContent = n === total
      ? `${n} conta${n !== 1 ? 's' : ''}`
      : `${n} de ${total} conta${total !== 1 ? 's' : ''}`;
  }

  if (!filtradas.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Nenhuma conta neste tipo</div></div>`;
    return;
  }

  grid.innerHTML = filtradas.map(conta => buildContaCard(conta)).join('');

  // Attach event listeners
  filtradas.forEach(conta => {
    const btnEdit    = document.getElementById(`btnEdit_${conta.id}`);
    const btnImport  = document.getElementById(`btnImport_${conta.id}`);
    const btnDel     = document.getElementById(`btnDel_${conta.id}`);
    const btnConfirm = document.getElementById(`btnConfirm_${conta.id}`);
    const btnTransf  = document.getElementById(`btnTransf_${conta.id}`);
    if (btnEdit)    btnEdit.addEventListener('click', () => abrirModalConta(conta.id));
    if (btnImport)  btnImport.addEventListener('click', () => abrirModalImport(conta.id));
    if (btnDel)     btnDel.addEventListener('click', () => abrirModalExcluir(conta.id));
    if (btnConfirm) btnConfirm.addEventListener('click', () => abrirSaldoRapido(conta.id));
    if (btnTransf)  btnTransf.addEventListener('click', () => abrirModalTransferencia(conta.id));
  });
}

function buildContaCard(conta) {
  const cfg = TIPO_CONFIG[conta.tipo] || { icon: '💳', label: conta.tipo, color: '#64748b', bg: '#f8fafc' };
  const saldo = getSaldoExibido(conta);
  const saldoStr  = valoresOcultos ? '••••••' : fmtBRL(saldo);
  const saldoColor = saldo < 0 ? '#dc2626' : 'var(--card-text)';

  // ── Linha de confirmação + badge de dias sem atualizar ────
  let confirmacaoHtml;
  const dataConf = conta.ultimaConfirmacao?.data;
  if (dataConf) {
    const dateObj = new Date(typeof dataConf === 'string' ? dataConf + (dataConf.length === 10 ? 'T12:00:00' : '') : dataConf);
    const dias = Math.floor((Date.now() - dateObj.getTime()) / 86400000);
    let badgeHtml = '';
    if (dias > 30) {
      badgeHtml = `&nbsp;<span style="display:inline-block;background:#fee2e2;color:#dc2626;font-size:0.625rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:999px;">⚠️ ${dias}d sem atualizar</span>`;
    } else if (dias > 7) {
      badgeHtml = `&nbsp;<span style="display:inline-block;background:#fef9c3;color:#854d0e;font-size:0.625rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:999px;">• ${dias}d sem atualizar</span>`;
    }
    confirmacaoHtml = `<div class="conta-confirmacao">Última confirmação: ${fmtDataBR(dataConf)}${badgeHtml}</div>`;
  } else {
    confirmacaoHtml = `<div class="conta-confirmacao"><span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:0.625rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:999px;">• sem dados de extrato</span></div>`;
  }

  const corHex = CORES_MAP[conta.cor] || null;
  const banco = detectarBanco(conta.nome);

  let cardStyle, iconHtml, badgeStyle, btnStyle;

  if (banco) {
    cardStyle = `background:linear-gradient(145deg,${banco.bg}77 0%,${banco.bg}33 100%),var(--card-bg);border:1px solid ${banco.bg}66;border-left:4px solid ${banco.bg};box-shadow:0 4px 24px -6px ${banco.bg}55;`;
    iconHtml = `<div style="width:44px;height:44px;border-radius:10px;background:${banco.bg};display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:${banco.text};letter-spacing:-0.5px;flex-shrink:0;box-shadow:0 2px 8px ${banco.bg}66;">${banco.abbrev}</div>`;
    badgeStyle = `background:rgba(255,255,255,0.22);color:var(--card-text);`;
    btnStyle = `border-color:${banco.bg};color:${banco.bg};`;
  } else {
    const bordaCor = corHex;
    cardStyle = bordaCor ? `border-left:4px solid ${bordaCor};` : '';
    const iconBg = corHex ? `background:${corHex}18;` : `background:${cfg.bg};`;
    iconHtml = `<div class="conta-tipo-icon" style="${iconBg}">${cfg.icon}</div>`;
    badgeStyle = `background:${cfg.bg};color:${cfg.color};`;
    btnStyle = '';
  }

  return `
    <div class="conta-card" style="${cardStyle}">
      <div class="conta-card-header">
        ${iconHtml}
        <div style="flex:1;padding-left:0.625rem;">
          <div class="conta-tipo-nome">${escapeHtml(conta.nome)}</div>
          <span class="conta-tipo-badge" style="${badgeStyle}">${cfg.label}</span>
        </div>
        <div class="conta-card-actions">
          <button class="conta-action-btn" id="btnConfirm_${conta.id}" title="Confirmar saldo rápido">💰</button>
          <button class="conta-action-btn" id="btnTransf_${conta.id}" title="Transferir">↔️</button>
          <button class="conta-action-btn" id="btnEdit_${conta.id}" title="Editar conta">✏️</button>
          <button class="conta-action-btn danger" id="btnDel_${conta.id}" title="Excluir conta">🗑️</button>
        </div>
      </div>
      <div class="conta-saldo" style="color:${saldoColor};">${saldoStr}</div>
      ${confirmacaoHtml}
      <div class="conta-btns-grid">
        <button class="conta-import-btn" id="btnImport_${conta.id}" style="${btnStyle}">📥 Importar</button>
        <a href="extrato.html" class="conta-import-btn" style="text-decoration:none;text-align:center;${btnStyle}">📋 Extrato</a>
      </div>
    </div>`;
}

function getSaldoExibido(conta) {
  if (conta.ultimaConfirmacao?.saldo != null) return conta.ultimaConfirmacao.saldo;
  return conta.saldoInicial ?? conta.saldo ?? 0;
}

// ══ CONFIRMAR SALDO RÁPIDO ════════════════════════════════

function abrirSaldoRapido(contaId) {
  const conta = contasGlobal.find(c => c.id === contaId);
  if (!conta) return;
  const modal = document.getElementById('modalSaldoRapido');
  if (!modal) return;

  document.getElementById('saldoRapidoContaId').value = contaId;
  document.getElementById('saldoRapidoContaNome').textContent = conta.nome || 'Conta';
  const inputSaldo = document.getElementById('inputSaldoRapido');
  inputSaldo.value = fmtBRLInput(getSaldoExibido(conta));
  inputSaldo.oninput = function() { formatarInputValor(this); };

  document.getElementById('btnConfirmarSaldoRapido').onclick = confirmarSaldoRapido;
  document.getElementById('btnCancelarSaldoRapido').onclick = () => modal.classList.remove('open');
  document.getElementById('btnFecharSaldoRapido').onclick = () => modal.classList.remove('open');

  modal.classList.add('open');
  setTimeout(() => inputSaldo.focus(), 80);
}

async function confirmarSaldoRapido() {
  const contaId = document.getElementById('saldoRapidoContaId').value;
  const raw = document.getElementById('inputSaldoRapido').value;
  const saldo = parseValorBR(raw);
  const btn = document.getElementById('btnConfirmarSaldoRapido');

  if (!contaId) return;
  if (isNaN(saldo)) { budToast('Valor inválido.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    const hojeISO = new Date().toISOString().slice(0, 10);
    await updateDoc(doc(db, 'usuarios', currentUser.uid, 'carteira', contaId), {
      ultimaConfirmacao: { data: hojeISO, saldo, origem: 'manual' },
    });
    // Atualizar local
    const idx = contasGlobal.findIndex(c => c.id === contaId);
    if (idx !== -1) contasGlobal[idx].ultimaConfirmacao = { data: hojeISO, saldo, origem: 'manual' };
    document.getElementById('modalSaldoRapido').classList.remove('open');
    budToast('Saldo confirmado! ✓', 'success');
    renderContas();
    renderKPIs();
  } catch (err) {
    console.error('[saldo rápido]', err);
    budToast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Confirmar Saldo';
  }
}

// ══ TRANSFERÊNCIA ENTRE CONTAS ════════════════════════════

function abrirModalTransferencia(contaOrigemId) {
  const modal = document.getElementById('modalTransferencia');
  if (!modal) return;

  // Resetar estado dos selects
  const hidO = document.getElementById('hiddenContaOrigem');
  const hidD = document.getElementById('hiddenContaDestino');
  const txtO = document.getElementById('textoContaOrigem');
  const txtD = document.getElementById('textoContaDestino');
  const btnO = document.getElementById('btnOrigemTrigger');
  const btnD = document.getElementById('btnDestinoTrigger');
  const ddO  = document.getElementById('dropdownOrigem');
  const ddD  = document.getElementById('dropdownDestino');

  hidO.value = ''; hidD.value = '';
  txtO.textContent = 'Selecione a conta de origem...';
  txtD.textContent = 'Selecione a conta de destino...';
  btnO.classList.remove('has-value', 'open');
  btnD.classList.remove('has-value', 'open');
  ddO.classList.remove('open');
  ddD.classList.remove('open');

  // Preencher dropdowns
  const optsHtml = contasGlobal.map(c =>
    `<div class="custom-select-option" data-id="${c.id}" data-nome="${escapeHtml(c.nome)}">${escapeHtml(c.nome)}</div>`
  ).join('');
  ddO.innerHTML = optsHtml;
  ddD.innerHTML = optsHtml;

  // Se chamado com conta de origem pré-selecionada
  if (contaOrigemId) {
    const conta = contasGlobal.find(c => c.id === contaOrigemId);
    if (conta) {
      hidO.value = contaOrigemId;
      txtO.textContent = conta.nome;
      btnO.classList.add('has-value');
      ddO.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.id === contaOrigemId));
    }
  }

  // Data padrão = hoje
  document.getElementById('inputDataTransf').value = new Date().toISOString().slice(0, 10);
  document.getElementById('inputValorTransf').value = '';
  document.getElementById('inputDescTransf').value = '';
  const valInput = document.getElementById('inputValorTransf');
  valInput.oninput = function() { formatarInputValor(this); };

  // Listeners dos selects
  btnO.onclick = () => { btnO.classList.toggle('open'); ddO.classList.toggle('open'); };
  btnD.onclick = () => { btnD.classList.toggle('open'); ddD.classList.toggle('open'); };

  ddO.onclick = e => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    hidO.value = opt.dataset.id;
    txtO.textContent = opt.dataset.nome;
    btnO.classList.add('has-value');
    btnO.classList.remove('open');
    ddO.classList.remove('open');
    ddO.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o === opt));
  };
  ddD.onclick = e => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    hidD.value = opt.dataset.id;
    txtD.textContent = opt.dataset.nome;
    btnD.classList.add('has-value');
    btnD.classList.remove('open');
    ddD.classList.remove('open');
    ddD.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o === opt));
  };

  document.getElementById('btnConfirmarTransferencia').onclick = confirmarTransferencia;
  document.getElementById('btnCancelarTransferencia').onclick = () => modal.classList.remove('open');
  document.getElementById('btnFecharTransferencia').onclick = () => modal.classList.remove('open');

  modal.classList.add('open');
}

async function confirmarTransferencia() {
  const origemId  = document.getElementById('hiddenContaOrigem').value;
  const destinoId = document.getElementById('hiddenContaDestino').value;
  const valorRaw  = document.getElementById('inputValorTransf').value;
  const dataStr   = document.getElementById('inputDataTransf').value;
  const descRaw   = document.getElementById('inputDescTransf').value.trim();
  const desc      = budSanitize(descRaw) || 'Transferência entre contas';

  const valor = parseValorBR(valorRaw);

  if (!origemId || !destinoId) { budToast('Selecione as contas de origem e destino.', 'error'); return; }
  if (origemId === destinoId) { budToast('A conta de origem e destino devem ser diferentes.', 'error'); return; }
  if (isNaN(valor) || valor <= 0) { budToast('Informe um valor válido.', 'error'); return; }
  if (!dataStr) { budToast('Informe a data da transferência.', 'error'); return; }

  const btn = document.getElementById('btnConfirmarTransferencia');
  btn.disabled = true;
  btn.textContent = 'Transferindo...';

  try {
    const uid = currentUser.uid;
    const dataTS = Timestamp.fromDate(new Date(dataStr + 'T12:00:00'));
    const batch = writeBatch(db);

    // Saída na conta de origem
    batch.set(doc(collection(db, 'usuarios', uid, 'transacoes')), {
      descricao: desc, valor, tipo: 'despesa', categoria: 'Transferência',
      data: dataTS, carteiraId: origemId, transferencia: true,
      dataCriacao: serverTimestamp(), pago: true, confirmado: true, pagamentoFatura: false,
    });
    // Entrada na conta de destino
    batch.set(doc(collection(db, 'usuarios', uid, 'transacoes')), {
      descricao: desc, valor, tipo: 'receita', categoria: 'Transferência',
      data: dataTS, carteiraId: destinoId, transferencia: true,
      dataCriacao: serverTimestamp(), pago: true, confirmado: true, pagamentoFatura: false,
    });

    await batch.commit();
    document.getElementById('modalTransferencia').classList.remove('open');
    budToast(`Transferência de ${fmtBRL(valor)} realizada! ✓`, 'success');
  } catch (err) {
    console.error('[transferência]', err);
    budToast('Erro ao transferir. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '↔️ Transferir';
  }
}

// ══ MODAL NOVA / EDITAR CONTA ════════════════════════════

function abrirModalConta(id) {
  const modal = document.getElementById('modalConta');
  const titulo = document.getElementById('modalContaTitulo');
  const editId = document.getElementById('contaEditId');

  // Reset form
  document.getElementById('contaNome').value = '';
  document.getElementById('contaSaldoInicial').value = '';
  document.getElementById('contaTipoValue').value = '';
  document.getElementById('contaTipoTexto').textContent = 'Selecione o tipo...';
  document.getElementById('contaTipoBtn').classList.remove('has-value');
  document.getElementById('contaNome').classList.remove('error');
  document.getElementById('contaSaldoInicial').classList.remove('error');
  document.getElementById('contaTipoBtn').classList.remove('error');

  // Reset cor
  contaCorSelecionada = 'sem_cor';
  document.querySelectorAll('.conta-cor-pill').forEach(p => p.classList.remove('selected'));
  const pillSemCor = document.querySelector('.conta-cor-pill[data-cor="sem_cor"]');
  if (pillSemCor) pillSemCor.classList.add('selected');

  if (id) {
    const conta = contasGlobal.find(c => c.id === id);
    if (!conta) return;
    titulo.textContent = '✏️ Editar Conta';
    editId.value = id;
    document.getElementById('contaNome').value = conta.nome || '';
    document.getElementById('contaSaldoInicial').value = fmtBRLInput(getSaldoExibido(conta));
    setContaTipoSelect(conta.tipo);
    // Restore cor
    const corSalva = conta.cor || 'sem_cor';
    contaCorSelecionada = corSalva;
    document.querySelectorAll('.conta-cor-pill').forEach(p => p.classList.toggle('selected', p.dataset.cor === corSalva));
  } else {
    titulo.textContent = '➕ Nova Conta';
    editId.value = '';
  }

  // Init cor-picker
  document.querySelectorAll('.conta-cor-pill').forEach(pill => {
    pill.onclick = () => {
      document.querySelectorAll('.conta-cor-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      contaCorSelecionada = pill.dataset.cor;
    };
  });

  modal.classList.add('open');

  // Saldo format
  const inputSaldo = document.getElementById('contaSaldoInicial');
  inputSaldo.oninput = function() { formatarInputValor(this); };

  document.getElementById('btnSalvarConta').onclick = salvarConta;
  document.getElementById('btnCancelarConta').onclick = () => modal.classList.remove('open');
  document.getElementById('btnFecharModalConta').onclick = () => modal.classList.remove('open');

  // Tipo select
  initContaTipoSelect();
}

function setContaTipoSelect(valor) {
  document.getElementById('contaTipoValue').value = valor;
  const cfg = TIPO_CONFIG[valor];
  if (cfg) {
    document.getElementById('contaTipoTexto').textContent = `${cfg.icon} ${cfg.label}`;
    document.getElementById('contaTipoBtn').classList.add('has-value');
  }
  // Mark option as selected
  document.querySelectorAll('#contaTipoDropdown .custom-select-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === valor);
  });
}

function initContaTipoSelect() {
  const btn = document.getElementById('contaTipoBtn');
  const dd = document.getElementById('contaTipoDropdown');

  btn.onclick = () => {
    btn.classList.toggle('open');
    dd.classList.toggle('open');
  };

  dd.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.onclick = () => {
      setContaTipoSelect(opt.dataset.value);
      btn.classList.remove('open');
      dd.classList.remove('open');
      btn.classList.remove('error');
    };
  });

  // Close on outside click (remove handler anterior para evitar acumulação)
  if (_contaTipoClickHandler) {
    document.removeEventListener('click', _contaTipoClickHandler);
  }
  _contaTipoClickHandler = function(e) {
    if (!btn.contains(e.target) && !dd.contains(e.target)) {
      btn.classList.remove('open');
      dd.classList.remove('open');
      document.removeEventListener('click', _contaTipoClickHandler);
      _contaTipoClickHandler = null;
    }
  };
  document.addEventListener('click', _contaTipoClickHandler);
}

async function salvarConta() {
  const editId = document.getElementById('contaEditId').value;
  const tipo = document.getElementById('contaTipoValue').value;
  const nome = budSanitize(document.getElementById('contaNome').value.trim());
  const saldoRaw = document.getElementById('contaSaldoInicial').value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const saldo = parseFloat(saldoRaw) || 0;

  let ok = true;
  if (!tipo) { document.getElementById('contaTipoBtn').classList.add('error'); ok = false; }
  if (!nome) { document.getElementById('contaNome').classList.add('error'); ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btnSalvarConta');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const ref = collection(db, 'usuarios', currentUser.uid, 'carteira');
    const corValue = contaCorSelecionada === 'sem_cor' ? null : contaCorSelecionada;
    if (editId) {
      // Atualizar conta existente — saldo digitado vira ultimaConfirmacao manual
      const hojeISO = new Date().toISOString().slice(0, 10);
      const updateData = {
        nome, tipo,
        ultimaConfirmacao: { data: hojeISO, saldo, origem: 'manual' },
        atualizadaEm: serverTimestamp(),
      };
      if (corValue !== undefined) updateData.cor = corValue;
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'carteira', editId), updateData);
    } else {
      await addDoc(ref, {
        nome, tipo,
        saldoInicial: saldo,
        cor: corValue,
        criadaEm: serverTimestamp(),
        atualizadaEm: serverTimestamp(),
      });
    }
    document.getElementById('modalConta').classList.remove('open');
    await carregarContas();
    budToast('Conta salva com sucesso! ✓', 'success');
  } catch (err) {
    console.error(err);
    budToast('Erro ao salvar conta. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Conta';
  }
}

// ── Excluir Conta ─────────────────────────────────────────
function abrirModalExcluir(id) {
  const conta = contasGlobal.find(c => c.id === id);
  if (!conta) return;
  excluirContaId = id;
  document.getElementById('excluirContaNome').textContent = `"${conta.nome}"`;
  const modal = document.getElementById('modalExcluir');
  modal.classList.add('open');
  document.getElementById('btnCancelarExcluir').onclick = () => modal.classList.remove('open');
  document.getElementById('btnConfirmarExcluir').onclick = () => confirmarExcluir();
}

async function confirmarExcluir() {
  if (!excluirContaId) return;
  const btn = document.getElementById('btnConfirmarExcluir');
  btn.disabled = true;
  btn.textContent = 'Excluindo...';
  try {
    await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'carteira', excluirContaId));
    document.getElementById('modalExcluir').classList.remove('open');
    await carregarContas();
    budToast('Conta excluída.', 'info');
  } catch (err) {
    console.error(err);
    budToast('Erro ao excluir conta.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Excluir';
    excluirContaId = null;
  }
}

// ══ MODAL IMPORTAR EXTRATO ═══════════════════════════════

function abrirModalImport(contaId) {
  const conta = contasGlobal.find(c => c.id === contaId);
  if (!conta) return;

  currentCarteiraId = contaId;
  currentContaObj = conta;
  parsedRows = [];
  previewPage = 0;
  globalTipo = 'auto';
  globalCat = '';
  dedupIds.clear();

  // Pré-carregar fitIds existentes para detectar duplicatas
  (async () => {
    try {
      const txSnap = await getDocs(
        query(collection(db, 'usuarios', currentUser.uid, 'transacoes'),
          where('carteiraId', '==', contaId),
          where('origem', '==', 'importacao')
        )
      );
      txSnap.forEach(d => {
        const fitId = d.data().fitId;
        if (fitId) dedupIds.add(fitId);
      });
    } catch (_) { /* sem índice, dedupIds fica vazio — tudo bem */ }
  })();

  // Reset UI
  resetImportModal();
  document.getElementById('importContaNome').textContent = conta.nome;
  goImportStep(1);

  const modal = document.getElementById('modalImport');
  modal.classList.add('open');

  initDropZone();
  initGlobalCatSelect();

  document.getElementById('btnFecharModalImport').onclick = () => modal.classList.remove('open');
  document.getElementById('btnCancelarImport').onclick = () => modal.classList.remove('open');
  document.getElementById('btnImportStep2Back').onclick = () => goImportStep(1);
  document.getElementById('btnImportStep1Next').onclick = () => processarArquivo();
  document.getElementById('btnImportStep2Next').onclick = () => confirmarImport();
  document.getElementById('btnImportConcluir').onclick = async () => {
    const btn = document.getElementById('btnImportConcluir');
    // Ler saldo editado pelo usuário
    const saldoInputEl = document.getElementById('importSaldoFinalInput');
    let saldoFinal = btn._pendingSaldo ?? 0;
    if (saldoInputEl && saldoInputEl.value) {
      // Converter "R$ 1.454,50" ou "1454.50" → número
      const raw = saldoInputEl.value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) saldoFinal = parsed;
    }
    // Salvar saldo confirmado no Firestore
    try {
      await updateDoc(doc(db, 'usuarios', btn._pendingUid, 'carteira', btn._pendingId), {
        ultimaConfirmacao: {
          data: btn._pendingData,
          saldo: saldoFinal,
          origem: 'extrato_importado',
        },
        atualizadaEm: serverTimestamp(),
      });
    } catch (e) { console.warn('Erro ao salvar saldo:', e); }
    modal.classList.remove('open');
    window._ofxLedgerBal = null;
    carregarContas();
    carregarHistoricoImportacoes();
  };

  // chkAll
  const chkAll = document.getElementById('chkAll');
  if (chkAll) chkAll.onchange = (e) => {
    parsedRows.forEach(r => { r.selecionado = e.target.checked; });
    renderPreview();
  };
}

function resetImportModal() {
  document.getElementById('fileInput').value = '';
  document.getElementById('fileChosen').classList.remove('visible');
  document.getElementById('fileChosenName').textContent = '';
  document.getElementById('importStep1Error').style.display = 'none';
  document.getElementById('btnImportStep1Next').disabled = true;
  document.getElementById('dropZone').classList.remove('drag-over');
}

function initDropZone() {
  const zone = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  const removeBtn = document.getElementById('btnRemoveFile');

  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  };

  input.onchange = () => { if (input.files[0]) setFile(input.files[0]); };

  if (removeBtn) {
    removeBtn.onclick = () => {
      input.value = '';
      document.getElementById('fileChosen').classList.remove('visible');
      document.getElementById('fileChosenName').textContent = '';
      document.getElementById('btnImportStep1Next').disabled = true;
    };
  }
}

function setFile(file) {
  const ALLOWED_EXT = ['csv', 'ofx', 'qfx', 'pdf', 'jpg', 'jpeg', 'png'];
  const ext = file.name.split('.').pop().toLowerCase();

  if (!ALLOWED_EXT.includes(ext)) {
    showStep1Error('Formato não suportado. Use CSV, OFX, QFX, PDF ou imagem.');
    return;
  }
  // Limite 10 MB (igual ao backend)
  if (file.size > 10 * 1024 * 1024) {
    showStep1Error('Arquivo muito grande. Máximo 10 MB.');
    return;
  }

  document.getElementById('importStep1Error').style.display = 'none';
  document.getElementById('fileChosenName').textContent = file.name;
  document.getElementById('fileChosen').classList.add('visible');
  document.getElementById('btnImportStep1Next').disabled = false;
  document.getElementById('fileInput')._selectedFile = file;
}

function showStep1Error(msg) {
  const el = document.getElementById('importStep1Error');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('btnImportStep1Next').disabled = true;
}

async function processarArquivo() {
  const input = document.getElementById('fileInput');
  const file = input._selectedFile || input.files[0];
  if (!file) return;

  const btn = document.getElementById('btnImportStep1Next');
  btn.disabled = true;
  btn.textContent = '⏳ Processando...';

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    _importMeta = null;
    _importFileName = file.name;

    // ── Hash SHA-256 do arquivo — para detectar reimportação do mesmo arquivo
    try {
      const buf = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      _importFileHash = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_hashErr) {
      _importFileHash = null;
    }

    // Se o mesmo arquivo já foi importado nesta carteira, avisa o usuário
    if (_importFileHash && currentContaObj) {
      const historico = currentContaObj.arquivosImportados || {};
      const previo = historico[_importFileHash];
      if (previo) {
        const dataPrev = previo.data ? new Date(previo.data).toLocaleDateString('pt-BR') : 'data desconhecida';
        const ok = window.confirm(
          `⚠️ Esse arquivo já foi importado nessa conta em ${dataPrev}` +
          (previo.totalTransacoes ? ` (${previo.totalTransacoes} transações).` : '.') +
          `\n\nImportar novamente vai criar duplicatas. Continuar mesmo assim?`
        );
        if (!ok) {
          btn.disabled = false;
          btn.textContent = 'Continuar →';
          return;
        }
      }
    }

    let rows = [];

    if (ext === 'csv' || ext === 'txt') {
      _importSourceType = 'csv';
      const text = await readFileAsText(file);
      rows = parseCSV(text);
    } else if (ext === 'ofx' || ext === 'qfx') {
      _importSourceType = 'ofx';
      const text = await readFileAsText(file);
      const ofxResult = parseOFX(text);
      rows = ofxResult.rows;
      // Guardar saldo final do extrato OFX se disponível
      if (ofxResult.ledgerBal != null) window._ofxLedgerBal = ofxResult.ledgerBal;
      else window._ofxLedgerBal = null;
    } else if (ext === 'pdf' || ['jpg', 'jpeg', 'png'].includes(ext)) {
      _importSourceType = ['jpg', 'jpeg', 'png'].includes(ext) ? 'imagem' : 'pdf';

      // ── PDF: extrai LOCALMENTE com pdf.js — sem depender do backend
      let processadoLocalmente = false;
      if (ext === 'pdf') {
        // Aguarda pdf.js ficar disponível (UMD carrega síncrono mas garante)
        if (!window.pdfjsLib) {
          await new Promise(r => setTimeout(r, 500));
        }
        if (window.pdfjsLib) {
          btn.textContent = '📄 Lendo PDF localmente…';
          try {
            const pdfText = await extractPDFTextLocal(file);
            console.log('[PDF local] texto extraído:', pdfText.length, 'chars');
            console.log('[PDF local] === TEXTO BRUTO (copie e me envie) ===\n' + pdfText + '\n=== FIM ===');
            window.__lastPdfText = pdfText; // disponível em window pra inspeção
            if (pdfText && pdfText.length > 100) {
              const localRows = parseBankStatementTextLocal(pdfText);
              const metaLocal = extractMetaFromTextLocal(pdfText);
              console.log('[PDF local] meta:', metaLocal, 'transações:', localRows.length);
              console.table(localRows.map(r => ({ data: r.data, tipo: r.tipoOrigem, valor: r.valor, desc: r.descricao.substring(0, 60) })));
              const score = computeScoreLocal(localRows, metaLocal);
              console.log('[PDF local] score:', score);
              if (localRows.length >= 2) {
                rows = localRows;
                if (metaLocal) _importMeta = metaLocal;
                processadoLocalmente = true;
                console.log('[PDF local] ✅ USANDO parser local (score=' + (score !== null ? Math.round(score*100)+'%' : 'sem meta') + ')');
              }
            }
          } catch (pdfErr) {
            console.warn('[PDF local] FALHOU:', pdfErr);
          }
        } else {
          console.warn('[PDF local] window.pdfjsLib indisponível — cairá no backend');
        }
      }

      // Fallback: backend (PDF protegido por senha, imagem, ou local falhou)
      if (!processadoLocalmente) {
        btn.textContent = '🤖 Analisando com IA… pode levar até 2 min';
        rows = await processarViaBackend(file);
      }
    }

    if (!rows || !rows.length) {
      showStep1Error('Nenhuma transação encontrada no arquivo. Verifique o formato.');
      return;
    }

    parsedRows = mapearTransacoes(rows);
    if (!parsedRows.length) {
      showStep1Error('Não foi possível ler transações válidas do arquivo.');
      return;
    }

    await verificarDuplicatas();
    renderPreview();
    goImportStep(2);
  } catch (err) {
    console.error('Erro ao processar arquivo:', err);
    showStep1Error('Erro ao processar arquivo: ' + (err.message || 'tente outro formato.'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continuar →';
  }
}

// ── Backend (PDF / imagem) ────────────────────────────────
async function processarViaBackend(file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000); // BUG #8 fix: 120s timeout

  try {
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tipo', 'extrato');

    const resp = await fetch(`${BACKEND_URL}/api/extrair-fatura`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) throw new Error(`Servidor retornou ${resp.status}`);
    const data = await resp.json();
    // Backend retorna {transacoes:[...], meta:{...}} — guardar meta para barra de confiança
    _importMeta = (data && !Array.isArray(data) && data.meta) ? data.meta : null;
    const raw = Array.isArray(data) ? data : (data.transacoes || data.rows || []);
    return raw.map(r => ({
      descricao: r.descricao || r.desc || '',
      valor: r.valor,
      data: r.data,
      tipoOrigem: r.tipoOrigem || r.tipo || null,
      fitId: r.fitId || null,
    }));
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Tempo esgotado (120s). Tente um arquivo menor.');
    throw err;
  }
}

// ── CSV Parser ────────────────────────────────────────────
function parseCSV(text) {
  // Remove BOM
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detectar separador: tab > ponto-e-vírgula > vírgula
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

  const headers = splitCSVLine(lines[0], sep).map(h =>
    h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_')
  );

  // Normalizar nomes de colunas
  const colMap = {
    data: ['data', 'date', 'dt', 'data_lancamento', 'data_transacao', 'data_movimento'],
    descricao: ['descricao', 'description', 'desc', 'historico', 'memo', 'titulo', 'title', 'lancamento'],
    valor: ['valor', 'value', 'amount', 'quantia', 'credito', 'debito', 'vlr', 'montante'],
    tipo: ['tipo', 'type', 'natureza', 'movimento'],
    categoria: ['categoria', 'category', 'cat'],
  };

  function findCol(keys) {
    for (const k of keys) {
      const idx = headers.findIndex(h => h === k || h.startsWith(k));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const iData = findCol(colMap.data);
  const iDesc = findCol(colMap.descricao);
  const iValor = findCol(colMap.valor);
  const iTipo = findCol(colMap.tipo);
  const iCat = findCol(colMap.categoria);

  if (iData === -1 || iDesc === -1 || iValor === -1) {
    // Fallback: tentar as 3 primeiras colunas como data, desc, valor
    if (headers.length >= 3) {
      return parseCSVFallback(lines, sep);
    }
    throw new Error('Colunas obrigatórias não encontradas (data, descrição, valor).');
  }

  const rows = [];
  for (let i = 1; i < lines.length && i < 10001; i++) {
    const cols = splitCSVLine(lines[i], sep);
    if (cols.length < 2) continue;
    const dataStr = (cols[iData] || '').trim().replace(/"/g, '');
    const desc = (cols[iDesc] || '').trim().replace(/"/g, '');
    const valorStr = (cols[iValor] || '').trim().replace(/"/g, '');
    if (!dataStr || !valorStr || !desc) continue;

    const data = parseDataBR(dataStr);
    if (!data) continue;

    const valor = parseValorBR(valorStr);
    if (isNaN(valor)) continue;

    rows.push({
      data,
      descricao: desc.substring(0, 200),
      valor: Math.abs(valor),
      tipoOrigem: iTipo !== -1 ? (cols[iTipo] || '').trim() : (valor < 0 ? 'debito' : 'credito'),
      categoria: iCat !== -1 ? (cols[iCat] || '').trim() : '',
    });
  }
  return rows;
}

function parseCSVFallback(lines, sep) {
  const rows = [];
  for (let i = 1; i < lines.length && i < 10001; i++) {
    const cols = splitCSVLine(lines[i], sep);
    if (cols.length < 3) continue;
    const data = parseDataBR(cols[0].trim().replace(/"/g, ''));
    const desc = cols[1].trim().replace(/"/g, '');
    const valor = parseValorBR(cols[2].trim().replace(/"/g, ''));
    if (!data || !desc || isNaN(valor)) continue;
    rows.push({ data, descricao: desc.substring(0, 200), valor: Math.abs(valor), tipoOrigem: valor < 0 ? 'debito' : 'credito', categoria: '' });
  }
  return rows;
}

function splitCSVLine(line, sep) {
  const result = [];
  let inQ = false, cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === sep && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

// ── OFX Parser ────────────────────────────────────────────
function parseOFX(text) {
  // Remover BOM e normalizar
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extrair LEDGERBAL (saldo final do extrato, se disponível)
  const ledgerMatch = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([\d\.\-]+)/i);
  const ledgerBal = ledgerMatch ? parseFloat(ledgerMatch[1]) : null;

  const rows = [];
  const txBlocks = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];

  txBlocks.forEach(block => {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };

    const trnType = get('TRNTYPE').toUpperCase();
    const dtPosted = get('DTPOSTED');
    const amtStr = get('TRNAMT');
    const memo = get('MEMO') || get('NAME') || '';
    const fitId = get('FITID');

    if (!dtPosted || !amtStr) return;

    const data = parseDataOFX(dtPosted);
    if (!data) return;

    const valor = parseFloat(amtStr.replace(',', '.'));
    if (isNaN(valor)) return;

    rows.push({
      data,
      descricao: memo.substring(0, 200),
      valor: Math.abs(valor),
      tipoOrigem: valor < 0 ? 'debito' : 'credito',
      fitId,
    });
  });

  return { rows, ledgerBal };
}

// ── Detectar Movimentos Internos ──────────────────────────
// Retorna string com motivo se for investimento/transferência interna, null se for gasto real.
// Esses itens são desmarcados automaticamente no review para evitar dupla contagem.
function detectarMovimentoInterno(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Investimentos: RDB, CDB, LCI, LCA, Tesouro, Poupança
  if (/\brdb\b/.test(d)) return 'Investimento';
  if (/\bcdb\b|\blci\b|\blca\b|tesouro direto|poupanca/.test(d)) return 'Investimento';
  // Pagamento de fatura de cartão (já contabilizado pelas transações do cartão)
  if (/pagamento de fatura/.test(d)) return 'Pgto Fatura CC';
  // Parcela/resgate de empréstimo Nubank (registrar em Dívidas para controle completo)
  if (/resgate de emprestimo/.test(d)) return 'Parcela Emp.';
  return null;
}

// ── Mapear Transações ─────────────────────────────────────
function mapearTransacoes(rows) {
  return rows.map((r, idx) => {
    // BUG #1 fix: detectarTipo nunca retorna 'Transferência' como tipo
    const tipo = detectarTipo(r.descricao, r.tipoOrigem);
    const categoria = r.categoria || detectarCategoria(r.descricao, tipo);
    const _avisoIgnorar = detectarMovimentoInterno(r.descricao);
    return {
      _idx: idx,
      data: r.data,
      descricao: r.descricao,
      valor: r.valor,
      tipo,
      categoria,
      fitId: r.fitId || null,
      selecionado: !_avisoIgnorar, // desmarca automaticamente movimentos internos/investimentos
      duplicata: false,
      _avisoIgnorar,               // string com motivo ou null
    };
  });
}

// ── Detectar Tipo ─────────────────────────────────────────
// BUG #1 fix: PIX/Transferência → tipo receita/despesa (NUNCA 'Transferência' como tipo)
function detectarTipo(desc, tipoOrigem) {
  if (!desc) return tipoOrigem === 'credito' ? 'receita' : 'despesa';
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Empréstimos/financiamentos → sempre despesa ("Resgate de empréstimo" = pagamento da dívida)
  if (/emprestimo|financiamento|prestacao/.test(d)) return 'despesa';

  // Padrões de receita explícitos
  if (/pix receb|transferencia receb|credito receb|deposito receb|estorno|reembolso|devolucao|resgate|rendimento|dividendo|salario|proventos/.test(d)) return 'receita';
  if (/\bsalario\b|\bpagamento receb|\bbonus\b|\b13o\b/.test(d)) return 'receita';

  // Padrões de despesa explícitos
  if (/pix env|transferencia env|enviado|pagamento|compra|debito|tarifa|taxa|anuidade|mensalidade|aluguel|seguro/.test(d)) return 'despesa';
  if (/ted env|doc env|saque|retirada/.test(d)) return 'despesa';

  // Fallback pelo campo tipoOrigem do arquivo
  if (tipoOrigem === 'credito') return 'receita';
  if (tipoOrigem === 'debito') return 'despesa';

  return 'despesa'; // default conservador
}

// ── Detectar Categoria ────────────────────────────────────
// Nomes devem ser idênticos aos de BUD_CATEGORIAS_PADRAO para seleção correta no <select>
const REGRAS_CAT = [
  { cat: 'Mercado',                 words: ['mercado','supermercado','hipermercado','atacadao','assai','carrefour','extra','pao de acucar','hortifruti','sacolao','feira'] },
  { cat: 'Restaurante',             words: ['restaurante','lanchonete','hamburger','pizza','sushi','churrascaria'] },
  { cat: 'Delivery/Ifood',          words: ['ifood','rappi','delivery','uber eats','deliway'] },
  { cat: 'Padaria/Café',            words: ['padaria','cafe','cafeteria','starbucks','bobs','mcdonalds','burger king','kfc','subway','panificacao'] },
  { cat: 'Uber/Táxi',               words: ['uber','taxi','99pop','99 tecnologia','cabify'] },
  { cat: 'Ônibus/Metrô',            words: ['onibus','metro','trem'] },
  { cat: 'Combustível',             words: ['combustivel','gasolina','etanol','posto','shell','ipiranga'] },
  { cat: 'Estacionamento',          words: ['estacionamento','pedagio'] },
  { cat: 'Farmácia',                words: ['farmacia','drogaria','ultrafarma','droga raia','drogasil','pacheco','medifarma','boa fe'] },
  { cat: 'Plano de Saúde',          words: ['plano de saude','supermed','unimed','amil','bradesco saude'] },
  { cat: 'Consultas/Exames',        words: ['hospital','clinica','medico','consulta','dentista','fisioterapia','laboratorio','exame'] },
  { cat: 'Faculdade/Escola',        words: ['faculdade','universidade','escola','mensalidade escolar'] },
  { cat: 'Cursos',                  words: ['curso','udemy','coursera','alura'] },
  { cat: 'Assinaturas/Streaming',   words: ['netflix','spotify','amazon prime','disney','globoplay','hbo','paramount','youtube premium','deezer','assinatura','subscricao'] },
  { cat: 'Roupas/Sapatos',          words: ['roupa','calcado','zara','renner','riachuelo','marisa','c&a','trick','calvin','lacoste','shein'] },
  { cat: 'Salão/Barbearia',         words: ['salao','cabelereiro','barbearia'] },
  { cat: 'Cosméticos',              words: ['estetica','manicure','perfumaria','sephora','bela ferraz'] },
  { cat: 'Viagens',                 words: ['hotel','hospedagem','passagem','voo','airbnb','booking','decolar','latam','gol','azul'] },
  { cat: 'Cinema/Teatro',           words: ['cinema','teatro'] },
  { cat: 'Shows/Eventos',           words: ['show','ingresso','parque','diversao'] },
  { cat: 'Academia/Esportes',       words: ['academia','ginasio','crossfit','smartfit','bluefit'] },
  { cat: 'Aluguel',                 words: ['aluguel'] },
  { cat: 'Internet/TV',             words: ['claro','vivo','tim','oi','internet','telefone'] },
  { cat: 'Luz',                     words: ['light servicos','eletricidade','cemig','copel','energisa','cpfl','enel'] },
  { cat: 'Gás',                     words: ['ceg','comgas'] },
  { cat: 'Pet',                     words: ['pet','veterinario','racao','petshop','petz','cobasi','apetit'] },
  { cat: 'Eletrônicos',             words: ['shpp','shoptime','americanas','magazine luiza','casas bahia','kabum','terabyte'] },
  { cat: 'Compras Online',          words: ['mercadolivre','amazon','shopee','aliexpress','submarino'] },
  { cat: 'Empréstimos/Dívidas',     words: ['emprestimo','financiamento','prestacao','resgate de emprestimo'] },
  { cat: 'Salário',                 words: ['salario','proventos','folha de pagamento','holerite'] },
  { cat: 'Rendimentos/Dividendos',  words: ['rendimento','dividendo','resgate rdb','resgate cdb'] },
  { cat: 'Outros',                  words: ['transferencia','pix','ted','doc','tev'] },
];

function detectarCategoria(desc, tipo) {
  if (!desc) return tipo === 'receita' ? 'Outros' : 'Outros';
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const regra of REGRAS_CAT) {
    for (const w of regra.words) {
      if (d.includes(w)) return regra.cat;
    }
  }
  return 'Outros';
}

// ── Verificar Duplicatas ──────────────────────────────────
// BUG #2 fix: query por range de meses, não full collection scan
async function verificarDuplicatas() {
  if (!parsedRows.length || !currentCarteiraId) return;

  try {
    // Encontrar range de datas do batch
    const datas = parsedRows.map(r => r.data).filter(Boolean).sort();
    if (!datas.length) return;

    const dataMin = datas[0].substring(0, 7); // YYYY-MM
    const dataMax = datas[datas.length - 1].substring(0, 7);

    const q = query(
      collection(db, 'usuarios', currentUser.uid, 'transacoes'),
      where('carteiraId', '==', currentCarteiraId),
      where('dataReferencia', '>=', dataMin + '-01'),
      where('dataReferencia', '<=', dataMax + '-31')
    );
    const snap = await getDocs(q);

    // Dedup primário: data|valor|normDesc(30) → duplicata certa (desmarcada automaticamente)
    // Dedup secundário: data|valor → possível duplicata (mesma data+valor, desc diferente — ex: OFX vs PDF)
    const existentesExatos = new Set();
    const existentesValorData = new Set();
    snap.docs.forEach(d => {
      const tx = d.data();
      existentesExatos.add(`${tx.dataReferencia}|${tx.valor}|${normDesc(tx.descricao || '')}`);
      existentesValorData.add(`${tx.dataReferencia}|${tx.valor}`);
    });

    parsedRows.forEach(r => {
      const keyExato   = `${r.data}|${r.valor}|${normDesc(r.descricao)}`;
      const keyParcial = `${r.data}|${r.valor}`;
      r.duplicata        = existentesExatos.has(keyExato);
      r.duplicataPossivel = !r.duplicata && existentesValorData.has(keyParcial);
      if (r.duplicata) r.selecionado = false;
    });

    const qtdDupl = parsedRows.filter(r => r.duplicata).length;
    const qtdPoss = parsedRows.filter(r => r.duplicataPossivel).length;
    const badge = document.getElementById('previewDedupBadge');
    if (badge) {
      if (qtdDupl > 0 || qtdPoss > 0) {
        const parts = [];
        if (qtdDupl > 0) parts.push(`${qtdDupl} duplicata${qtdDupl > 1 ? 's' : ''}`);
        if (qtdPoss > 0) parts.push(`${qtdPoss} possível${qtdPoss > 1 ? 'is' : ''}`);
        badge.textContent = `⚠️ ${parts.join(' · ')}`;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Aviso: não foi possível verificar duplicatas:', err);
  }
}

function normDesc(desc) {
  return desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().substring(0, 30);
}

// ── Custom row-category dropdown ──────────────────────────
function buildCatOptions(selected) { return ''; } // compat stub

function getCatDisplay(catNome) {
  if (!catNome) return '＋ Categoria';
  const p = window.BUD_CATEGORIAS_PADRAO || { despesa: [], receita: [] };
  const all = [...(p.despesa || []), ...(p.receita || [])];
  const found = all.find(c => c.nome === catNome);
  return found ? (found.emoji ? found.emoji + ' ' + escapeHtml(catNome) : escapeHtml(catNome)) : escapeHtml(catNome);
}

function closeRowCatDd() {
  const dd = document.getElementById('rowCatSharedDd');
  if (dd) { dd.innerHTML = ''; dd.style.display = 'none'; }
  if (_rowCatDdBtn) { _rowCatDdBtn.classList.remove('open'); _rowCatDdBtn = null; }
  _rowCatDdTargetIdx = null;
}

window.toggleRowCatDd = function(idx, btn) {
  if (_rowCatDdTargetIdx === idx) { closeRowCatDd(); return; }
  closeRowCatDd();
  _rowCatDdTargetIdx = idx;
  _rowCatDdBtn = btn;
  btn.classList.add('open');

  const p = window.BUD_CATEGORIAS_PADRAO || { despesa: [], receita: [] };
  const all = [...(p.despesa || []), ...(p.receita || [])];
  const currentCat = parsedRows[idx] ? parsedRows[idx].categoria : '';

  let html = '<div class="row-cat-option" onclick="selectRowCat(' + idx + ', \'\')">＋ Categoria</div>';
  all.forEach(function(c) {
    const active = c.nome === currentCat ? ' active' : '';
    html += '<div class="row-cat-option' + active + '" onclick="selectRowCat(' + idx + ', \'' + escapeHtml(c.nome).replace(/'/g, '\\\'') + '\')">' + (c.emoji ? c.emoji + ' ' : '') + escapeHtml(c.nome) + '</div>';
  });

  const dd = document.getElementById('rowCatSharedDd');
  dd.innerHTML = html;
  dd.style.display = 'block';
  const rect = btn.getBoundingClientRect();
  dd.style.top = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
};

window.selectRowCat = function(idx, val) {
  if (parsedRows[idx]) parsedRows[idx].categoria = val || null;
  const btn = document.getElementById('rowcatbtn-' + idx);
  if (btn) btn.innerHTML = getCatDisplay(val || null);
  closeRowCatDd();
};

document.addEventListener('click', function(e) {
  if (_rowCatDdTargetIdx === null) return;
  const dd = document.getElementById('rowCatSharedDd');
  if (!dd) return;
  if (!dd.contains(e.target) && !e.target.classList.contains('row-cat-btn')) {
    closeRowCatDd();
  }
});

// ── Render Preview ────────────────────────────────────────
function renderPreview() {
  const totalPages = Math.max(1, Math.ceil(parsedRows.length / PER_PAGE));
  if (previewPage >= totalPages) previewPage = totalPages - 1;

  const start = previewPage * PER_PAGE;
  const pageRows = parsedRows.slice(start, start + PER_PAGE);
  const selecionados = parsedRows.filter(r => r.selecionado).length;

  const tbody = document.getElementById('previewTableBody');
  if (!tbody) return;

  tbody.innerHTML = pageRows.map((r, i) => {
    const globalIdx = start + i;
    const tipoClass = r.tipo === 'receita' ? 'tipo-pill-receita' : 'tipo-pill-despesa';
    const tipoLabel = r.tipo === 'receita' ? '↑ Receita' : '↓ Despesa';
    const rowOpacity = (r.duplicata || r._avisoIgnorar) ? 'style="opacity:0.55;"' : (r.duplicataPossivel ? 'style="opacity:0.8;"' : '');
    const dupBadge = r.duplicata
      ? '<span title="Transação já existe no período — desmarcada automaticamente" style="font-size:0.6rem;background:#fef9c3;color:#854d0e;padding:0.1rem 0.3rem;border-radius:3px;font-weight:700;margin-left:4px;cursor:help;">DUP ⚠️</span>'
      : '';
    const dupPossBadge = r.duplicataPossivel
      ? '<span title="Mesmo valor e data já existem com outra descrição — verifique se é duplicata" style="font-size:0.6rem;background:#fff7ed;color:#c2410c;padding:0.1rem 0.3rem;border-radius:3px;font-weight:700;margin-left:4px;cursor:help;">~DUP?</span>'
      : '';
    const ignorarBadge = r._avisoIgnorar
      ? `<span title="${r._avisoIgnorar === 'Pgto Fatura CC' ? 'Pagamento de fatura do cartão — já contabilizado nas transações do cartão' : r._avisoIgnorar === 'Parcela Emp.' ? 'Parcela de empréstimo — use a tela Dívidas para controle' : 'Investimento/aplicacao — não é gasto corrente'}" style="font-size:0.6rem;background:#dbeafe;color:#1e40af;padding:0.1rem 0.3rem;border-radius:3px;font-weight:700;margin-left:4px;cursor:help;">${r._avisoIgnorar}</span>`
      : '';

    return `<tr ${rowOpacity}>
      <td><input type="checkbox" data-idx="${globalIdx}" ${r.selecionado ? 'checked' : ''} onchange="toggleRowSelect(${globalIdx}, this.checked)"></td>
      <td style="white-space:nowrap;font-size:0.75rem;">${r.data}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.descricao)}">${escapeHtml(r.descricao)}${dupBadge}${dupPossBadge}${ignorarBadge}</td>
      <td><button class="tipo-pill ${tipoClass}" onclick="toggleRowTipo(${globalIdx})">${tipoLabel}</button></td>
      <td style="text-align:right;font-weight:700;white-space:nowrap;color:${r.tipo === 'receita' ? '#16a34a' : '#dc2626'};">${fmtBRL(r.valor)}</td>
      <td><button class="row-cat-btn" id="rowcatbtn-${globalIdx}" onclick="toggleRowCatDd(${globalIdx}, this)">${getCatDisplay(r.categoria)}</button></td>
    </tr>`;
  }).join('');

  // Atualizar contadores
  const countBadge = document.getElementById('previewCount');
  if (countBadge) countBadge.textContent = `${selecionados} selecionada${selecionados !== 1 ? 's' : ''} / ${parsedRows.length}`;

  const pageInfo = document.getElementById('previewPageInfo');
  if (pageInfo) pageInfo.textContent = `Página ${previewPage + 1} de ${totalPages}`;

  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  if (btnPrev) btnPrev.disabled = previewPage === 0;
  if (btnNext) btnNext.disabled = previewPage >= totalPages - 1;

  // chkAll state
  const chkAll = document.getElementById('chkAll');
  if (chkAll) {
    const allSel = parsedRows.every(r => r.selecionado);
    chkAll.checked = allSel;
    chkAll.indeterminate = !allSel && parsedRows.some(r => r.selecionado);
  }

  // Barra de confiabilidade
  const confiaBadge = document.getElementById('importConfiabilidadeBadge');
  if (confiaBadge) {
    let badgeBg, badgeColor, badgeText;
    const isPdfIa = (_importSourceType === 'pdf' || _importSourceType === 'imagem');

    if (isPdfIa) {
      const meta = _importMeta;
      const temMeta = meta && (meta.totalEntradas || meta.totalSaidas);

      if (temMeta) {
        const somaRec = parsedRows.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.valor, 0);
        const somaDes = parsedRows.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0);
        const pctE = meta.totalEntradas > 0 ? Math.min(somaRec / meta.totalEntradas, 1.05) : null;
        const pctS = meta.totalSaidas  > 0 ? Math.min(somaDes / meta.totalSaidas,  1.05) : null;
        const scores = [pctE, pctS].filter(x => x !== null);
        const score  = scores.length ? Math.min(...scores) : null;

        const fmt    = v => v != null ? 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '?';
        const pctStr = v => v != null ? Math.round(v * 100) + '%' : '?';

        const linhas = [];
        if (meta.totalEntradas) linhas.push(`entradas: ${fmt(somaRec)} de ${fmt(meta.totalEntradas)} (${pctStr(pctE)})`);
        if (meta.totalSaidas)   linhas.push(`saídas: ${fmt(somaDes)} de ${fmt(meta.totalSaidas)} (${pctStr(pctS)})`);

        if (score === null || score < 0.70) {
          badgeBg = '#fee2e2'; badgeColor = '#b91c1c';
          badgeText = `❌ Resultado NÃO confiável — IA capturou ${pctStr(score)} · ${linhas.join(' · ')}`;
        } else if (score < 0.90) {
          badgeBg = '#fff7ed'; badgeColor = '#c2410c';
          badgeText = `⚠️ Precisão parcial — IA capturou ${pctStr(score)} · ${linhas.join(' · ')}`;
        } else {
          badgeBg = '#dcfce7'; badgeColor = '#15803d';
          badgeText = `✅ Alta precisão — ${pctStr(score)} capturado · ${linhas.join(' · ')}`;
        }
      } else {
        // PDF mas sem totais declarados visíveis no documento
        badgeBg = '#fee2e2'; badgeColor = '#b91c1c';
        badgeText = '⚠️ PDF/IA — precisão não verificável · confira cada linha manualmente';
      }
    } else if (_importSourceType === 'csv') {
      badgeBg = '#fef9c3'; badgeColor = '#854d0e';
      badgeText = '⚡ Média confiabilidade — CSV';
    } else if (_importSourceType === 'ofx') {
      badgeBg = '#dcfce7'; badgeColor = '#15803d';
      badgeText = '🔒 Alta confiabilidade — OFX';
    }

    if (badgeText) {
      confiaBadge.style.cssText = `display:inline-block;font-size:0.7rem;font-weight:700;padding:0.3rem 0.7rem;border-radius:8px;white-space:normal;line-height:1.5;background:${badgeBg};color:${badgeColor};margin-top:4px;`;
      confiaBadge.textContent = badgeText;
    } else {
      confiaBadge.style.display = 'none';
    }
  }
}

// Expor funções para onclick inline
window.previewNavPage = function(dir) {
  previewPage += dir;
  renderPreview();
};
window.toggleRowSelect = function(idx, val) {
  if (parsedRows[idx]) { parsedRows[idx].selecionado = val; renderPreview(); }
};
window.toggleRowTipo = function(idx) {
  if (parsedRows[idx]) {
    parsedRows[idx].tipo = parsedRows[idx].tipo === 'receita' ? 'despesa' : 'receita';
    renderPreview();
  }
};
window.setRowCategoria = function(idx, val) {
  if (parsedRows[idx]) parsedRows[idx].categoria = val.trim();
};
window.setGlobalTipo = function(t) {
  globalTipo = t;
  if (t !== 'auto') {
    parsedRows.forEach(r => { r.tipo = t; });
  } else {
    // re-detectar
    parsedRows.forEach(r => { r.tipo = detectarTipo(r.descricao, r.valor < 0 ? 'debito' : 'credito'); });
  }
  renderPreview();
};

// ── Global Categoria Select ───────────────────────────────
function initGlobalCatSelect() {
  const btn = document.getElementById('globalCatBtn');
  const dd = document.getElementById('globalCatDropdown');

  // Construir opções com emojis via BUD_CATEGORIAS_PADRAO
  const padroes = window.BUD_CATEGORIAS_PADRAO || { despesa: [], receita: [] };
  const allCats = [...padroes.despesa, ...padroes.receita];
  dd.innerHTML =
    `<div class="custom-select-option" style="font-size:0.8125rem;" data-value="">🔍 Auto-detectar</div>` +
    allCats.map(c =>
      `<div class="custom-select-option" style="font-size:0.8125rem;" data-value="${escapeHtml(c.nome)}">${c.emoji} ${escapeHtml(c.nome)}</div>`
    ).join('');

  btn.onclick = (e) => { e.stopPropagation(); btn.classList.toggle('open'); dd.classList.toggle('open'); };

  dd.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.onclick = () => {
      globalCat = opt.dataset.value;
      document.getElementById('globalCatTexto').textContent = opt.textContent;
      btn.classList.add('has-value');
      btn.classList.remove('open');
      dd.classList.remove('open');
      if (globalCat) {
        parsedRows.forEach(r => { r.categoria = globalCat; });
      } else {
        // Auto-detectar: recalcular categoria de cada linha
        parsedRows.forEach(r => { r.categoria = detectarCategoria(r.descricao, r.tipo); });
      }
      renderPreview();
    };
  });
}

// ── Confirmar Import ──────────────────────────────────────
// BUG #4 fix: transacoes com origem:'importacao' não são adicionadas ao saldo — apenas o snapshot muda
async function confirmarImport() {
  const selecionados = parsedRows.filter(r => r.selecionado);
  if (!selecionados.length) {
    budToast('Nenhuma transação selecionada.', 'warning');
    return;
  }

  const btn = document.getElementById('btnImportStep2Next');
  btn.disabled = true;
  btn.textContent = '⏳ Importando...';

  goImportStep(3);

  try {
    const uid = currentUser.uid;
    const txCol = collection(db, 'usuarios', uid, 'transacoes');

    // Salvar em batches de 400 (Firestore max 500, usamos 400 com margem)
    let salvos = 0;
    for (let i = 0; i < selecionados.length; i += MAX_BATCH) {
      const chunk = selecionados.slice(i, i + MAX_BATCH);
      const batch = writeBatch(db);
      chunk.forEach(r => {
        const txRef = doc(txCol);
        batch.set(txRef, {
          tipo: r.tipo,                          // 'receita' | 'despesa' — NUNCA 'Transferência'
          valor: r.valor,
          descricao: budSanitize(r.descricao.substring(0, 200)),
          categoria: budSanitize(r.categoria || 'Outros'),
          carteiraId: currentCarteiraId,
          carteiraNome: currentContaObj.nome,
          carteiraTipo: currentContaObj.tipo,
          dataReferencia: r.data,
          data: (function(s) { const [y,m,d] = s.split('-').map(Number); return Timestamp.fromDate(new Date(y, m-1, d, 12, 0, 0)); })(r.data),
          dataCriacao: serverTimestamp(),
          origem: 'importacao',                  // BUG #4: não soma ao saldo calculado
          pago: true,
          confirmado: true,
          pagamentoFatura: false,
        });
      });
      await batch.commit();
      salvos += chunk.length;

      // Update progress
      document.getElementById('importResultSub').textContent = `Salvando... ${salvos} de ${selecionados.length}`;
    }

    // Registrar o hash do arquivo importado no doc da carteira (para detectar reimportação)
    if (_importFileHash) {
      try {
        await updateDoc(doc(db, 'usuarios', uid, 'carteira', currentCarteiraId), {
          [`arquivosImportados.${_importFileHash}`]: {
            nome: _importFileName || 'arquivo',
            data: new Date().toISOString(),
            totalTransacoes: salvos,
            origem: _importSourceType || 'desconhecido',
          }
        });
      } catch (_e) {
        console.warn('Não foi possível registrar hash do arquivo:', _e);
      }
    }

    // Calcular receitas/despesas antes do addDoc (evita TDZ ReferenceError)
    const receitas = selecionados.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.valor, 0);
    const despesas = selecionados.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0);

    // Salvar na sub-coleção 'importacoes' para o histórico
    try {
      const periodoInicio = selecionados.map(r => r.data).sort()[0] || null;
      const periodoFim    = selecionados.map(r => r.data).sort().reverse()[0] || null;
      await addDoc(collection(db, 'usuarios', uid, 'importacoes'), {
        contaId:         currentCarteiraId,
        contaNome:       budSanitize(currentContaObj.nome || ''),
        nomeArquivo:     budSanitize(_importFileName || 'arquivo'),
        origem:          _importSourceType || 'desconhecido',
        qtdTransacoes:   salvos,
        receitas:        receitas,
        despesas:        despesas,
        periodoInicio:   periodoInicio,
        periodoFim:      periodoFim,
        dataImportacao:  serverTimestamp(),
      });
    } catch (_e) {
      console.warn('Não foi possível salvar histórico de importação:', _e);
    }

    // Atualizar ultimaConfirmacao no carteira document (snapshot)
    const ultimaData = selecionados.map(r => r.data).sort().reverse()[0];
    const netDelta = receitas - despesas;

    // Movimentos internos (foram desmarcados no review — não somam ao extrato pessoal mas constam no PDF)
    const ignorados = parsedRows.filter(r => !r.selecionado && r._avisoIgnorar);
    const ignReceitas = ignorados.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.valor, 0);
    const ignDespesas = ignorados.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0);
    const totalReceitasBruto = receitas + ignReceitas;
    const totalDespesasBruto = despesas + ignDespesas;

    const saldoAtual = getSaldoExibido(currentContaObj);
    const saldoSugerido = window._ofxLedgerBal != null
      ? window._ofxLedgerBal                            // OFX com LEDGERBAL: saldo real do banco
      : (_importMeta && _importMeta.saldoFinal != null)
        ? _importMeta.saldoFinal                        // PDF/extrato com saldo declarado no documento
        : saldoAtual + netDelta;                        // fallback: saldo atual + delta desta importação
    const novoSaldo = saldoSugerido;

    // NÃO salvar saldo aqui — será salvo no clique do Concluído após confirmação do usuário

    // UI resultado
    document.getElementById('importResultIcon').textContent = '✅';
    document.getElementById('importResultTitle').textContent = `${salvos} transações importadas!`;
    document.getElementById('importResultSub').textContent = `Saldo calculado: ${fmtBRL(novoSaldo)}`;
    document.getElementById('importResultDetails').style.display = 'block';

    let ignoradosHtml = '';
    if (ignorados.length) {
      // Agrupa por motivo pra explicar o que foi ignorado
      const grupos = {};
      ignorados.forEach(r => {
        const m = r._avisoIgnorar;
        if (!grupos[m]) grupos[m] = { qtd: 0, valor: 0 };
        grupos[m].qtd += 1;
        grupos[m].valor += r.valor;
      });
      const partes = Object.entries(grupos).map(([m, g]) => `${g.qtd}× ${m} (${fmtBRL(g.valor)})`);
      ignoradosHtml = `
        <div style="margin-top:8px;padding:8px;background:#fef3c7;border-radius:6px;font-size:0.85em;color:#92400e;">
          <div style="font-weight:600;margin-bottom:4px;">ℹ️ ${ignorados.length} movimento(s) interno(s) ignorado(s):</div>
          <div>${partes.join(' · ')}</div>
          <div style="margin-top:4px;font-size:0.85em;opacity:0.85;">São movimentações que já estão contabilizadas em outro lugar (cartão, dívidas, investimentos) — incluí-las dobraria sua contagem.</div>
        </div>`;
    }

    const totalLine = (ignorados.length)
      ? `<div style="font-size:0.85em;color:#64748b;margin-top:4px;">Total no extrato: <strong>${fmtBRL(totalReceitasBruto)}</strong> entradas · <strong>${fmtBRL(totalDespesasBruto)}</strong> saídas (com movimentos internos)</div>`
      : '';

    document.getElementById('importResultDetails').innerHTML = `
      <div>📈 Receitas: <strong style="color:#16a34a;">${fmtBRL(receitas)}</strong></div>
      <div>📉 Despesas: <strong style="color:#dc2626;">${fmtBRL(despesas)}</strong></div>
      <div>💰 Delta: <strong style="color:${netDelta >= 0 ? '#16a34a' : '#dc2626'};">${netDelta >= 0 ? '+' : ''}${fmtBRL(netDelta)}</strong></div>
      <div>📅 Última data: <strong>${fmtDataBR(ultimaData)}</strong></div>
      ${totalLine}
      ${ignoradosHtml}
    `;

    // Mostrar campo de confirmação de saldo
    const saldoConfirmDiv = document.getElementById('importSaldoConfirm');
    const saldoInput = document.getElementById('importSaldoFinalInput');
    if (saldoConfirmDiv && saldoInput) {
      saldoConfirmDiv.style.display = 'block';
      saldoInput.value = fmtBRL(novoSaldo);
    }

    // Salvar saldo ao clicar Concluído (lê o valor editado pelo usuário)
    const btnConcluir = document.getElementById('btnImportConcluir');
    btnConcluir._pendingSaldo = novoSaldo;
    btnConcluir._pendingData  = ultimaData;
    btnConcluir._pendingUid   = uid;
    btnConcluir._pendingId    = currentCarteiraId;
    btnConcluir.style.display = 'block';

  } catch (err) {
    console.error('Erro na importação:', err);
    document.getElementById('importResultIcon').textContent = '❌';
    document.getElementById('importResultTitle').textContent = 'Erro na importação';
    document.getElementById('importResultSub').textContent = err.message || 'Tente novamente.';
    document.getElementById('btnImportConcluir').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Importar Selecionados →';
  }
}

// ── Import Stepper ────────────────────────────────────────
function goImportStep(n) {
  [1, 2, 3].forEach(i => {
    const step = document.getElementById(`importStep${i}`);
    if (step) step.classList.toggle('active', i === n);

    const dot = document.getElementById(`stepDot${i}`);
    if (dot) {
      dot.classList.remove('done', 'current', 'pending');
      if (i < n) dot.classList.add('done');
      else if (i === n) dot.classList.add('current');
      else dot.classList.add('pending');
    }
  });
  [1, 2].forEach(i => {
    const line = document.getElementById(`stepLine${i}`);
    if (line) line.classList.toggle('done', i < n);
  });
}

// ══ UTILITÁRIOS ══════════════════════════════════════════

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsText(file, 'UTF-8');
  });
}

function parseDataBR(s) {
  if (!s) return null;
  s = s.trim();
  // DD/MM/YYYY ou DD-MM-YYYY
  let m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function parseDataOFX(s) {
  // YYYYMMDD ou YYYYMMDDHHMMSS
  if (!s) return null;
  const clean = s.substring(0, 8);
  if (!/^\d{8}$/.test(clean)) return null;
  return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
}

function parseValorBR(s) {
  if (!s) return NaN;
  s = s.trim().replace(/\s/g, '');
  // Remove R$, símbolo
  s = s.replace(/R\$\s?/i, '');
  // Verificar formato: 1.234,56 (BR) vs 1,234.56 (US)
  if (/^\-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''));
  }
  // Último fallback: substituir vírgula por ponto
  return parseFloat(s.replace(',', '.'));
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtBRLInput(v) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

function fmtDataBR(s) {
  if (!s) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatarInputValor(el) {
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  v = (parseInt(v, 10) / 100).toFixed(2);
  el.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(v));
}

function budSanitize(s) {
  if (typeof window.budSanitize === 'function') return window.budSanitize(s);
  return String(s).replace(/[<>]/g, '').trim();
}

function budToast(msg, type) {
  if (typeof window.budToast === 'function') { window.budToast(msg, type); return; }
  // Fallback simples
  const d = document.createElement('div');
  const colors = { success:'#16a34a', error:'#dc2626', info:'#2563eb', warning:'#d97706' };
  d.textContent = msg;
  d.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;padding:0.75rem 1.25rem;border-radius:0.75rem;background:${colors[type]||'#1e293b'};color:#fff;font-family:inherit;font-size:0.875rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:opacity .4s;`;
  document.body.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, 3000);
}

// =============================================================================
// PDF LOCAL — extração de texto via pdf.js + parser idêntico ao backend
// Cura para a dependência do backend; precisão equivalente ao OFX.
// =============================================================================

async function extractPDFTextLocal(file) {
  if (!window.pdfjsLib) throw new Error('pdf.js não carregado');
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Reconstrói linhas usando coordenada Y dos itens
    const items = content.items;
    const lines = {};
    items.forEach(it => {
      const y = Math.round(it.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push({ x: it.transform[4], str: it.str });
    });
    const ys = Object.keys(lines).map(Number).sort((a, b) => b - a);
    ys.forEach(y => {
      const line = lines[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (line) fullText += line + '\n';
    });
    fullText += '\n';
  }
  return fullText;
}

const _MESES_PT = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };

function _parseValorBRL(str) {
  if (!str) return 0;
  const s = String(str).trim();
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d+,\d{2}$/.test(s)) return parseFloat(s.replace(',', '.'));
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

function extractMetaFromTextLocal(text) {
  const meta = { totalEntradas: null, totalSaidas: null, saldoFinal: null };
  const mE = text.match(/total\s+d[eo]?\s*entradas?[\s\S]{0,40}?(\d[\d\.]*,\d{2})/i);
  if (mE) meta.totalEntradas = _parseValorBRL(mE[1]);
  const mS = text.match(/total\s+d[eo]?\s*sa[ií]das?[\s\S]{0,40}?(\d[\d\.]*,\d{2})/i);
  if (mS) meta.totalSaidas = _parseValorBRL(mS[1]);
  // Saldo: busca INLINE na mesma linha (tabela direita "Saldo final do período  218,65")
  // [^\n\r]+ impede capturar número de linha diferente (caixa esquerda tem label e valor em linhas separadas)
  const mSaldo = text.match(/saldo\s+(?:final|do\s+per[ií]odo)[^\n\r]+?(\d[\d\.]*,\d{2})/i);
  if (mSaldo) meta.saldoFinal = _parseValorBRL(mSaldo[1]);
  // Fallback: calcula saldo_inicial + entradas - saídas se não achou inline
  if (meta.saldoFinal === null && meta.totalEntradas !== null && meta.totalSaidas !== null) {
    const mIni = text.match(/saldo\s+inicial[^\n\r]*?(\d[\d\.]*,\d{2})/i);
    if (mIni) meta.saldoFinal = Math.round(((_parseValorBRL(mIni[1]) + meta.totalEntradas - meta.totalSaidas) * 100)) / 100;
  }
  if (meta.totalEntradas === null && meta.totalSaidas === null && meta.saldoFinal === null) return null;
  return meta;
}

function computeScoreLocal(transacoes, meta) {
  if (!meta) return null;
  let cre = 0, deb = 0;
  (transacoes || []).forEach(t => {
    const v = parseFloat(t.valor) || 0;
    if (t.tipo === 'credito' || t.tipoOrigem === 'credito') cre += v;
    else if (t.tipo === 'debito' || t.tipoOrigem === 'debito') deb += v;
  });
  const scores = [];
  if (meta.totalEntradas > 0) scores.push(Math.min(cre / meta.totalEntradas, 1.05));
  if (meta.totalSaidas  > 0) scores.push(Math.min(deb / meta.totalSaidas,  1.05));
  return scores.length ? Math.min(...scores) : null;
}

// Parser principal — adaptado da Estratégia 6 do backend (Nubank conta corrente)
// Formato Nubank: data isolada → "Total de saídas/entradas" → linhas de descrição → valor
function parseBankStatementTextLocal(rawText) {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  const results = [];
  const seen = new Set();
  function addTx(desc, valor, data, tipo) {
    if (!desc || valor <= 0 || valor > 999999) return;
    const key = desc.toLowerCase() + '|' + valor + '|' + data;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ descricao: desc, valor: valor, data: data, tipoOrigem: tipo || null });
  }

  // ── Estratégia Nubank conta corrente (formato vertical) ───────────
  const RE_HDR  = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})$/i;
  const RE_SUB  = /Total de (sa[ií]das?|entradas?)/i;
  const RE_VAL  = /^[\d\.]+,\d{2}$/;
  const RE_SKIP = /^(saldo\b|rendimento\b|movimenta|cpf\b|tem alguma|caso a\b|extrato gerado|asseguramos|nu (financeira|pagamentos)|cnpj:|o saldo l[ií]quido|n[ãa]o nos|valores em|•••|p[áa]gina|de \d|\d+ de \d+$|idenilson|ag[êe]ncia\s+\d|conta\s*\d)/i;
  const RE_ONLYNUMS = /^[\d\.\-]+$/;
  const RE_PERIODO  = /^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\s+a\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}$/i;

  let curData = null;
  let curTipo = null;
  let descBuf = [];

  function flushTx(valor) {
    if (descBuf.length > 0 && curData && curTipo) {
      const desc = descBuf.join(' ').replace(/\s+/g, ' ').trim();
      addTx(desc, valor, curData, curTipo);
    }
    descBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Linha de data isolada: "01 MAI 2026"
    const hm = line.match(RE_HDR);
    if (hm) {
      descBuf = [];
      const mes = _MESES_PT[hm[2].toLowerCase()];
      if (mes) {
        curData = hm[3] + '-' + String(mes).padStart(2, '0') + '-' + String(parseInt(hm[1])).padStart(2, '0');
        curTipo = null;
      }
      continue;
    }

    // "01 MAI 2026 Total de saídas - 116,88" ou "Total de saídas - 116,88"
    if (RE_SUB.test(line)) {
      descBuf = [];
      curTipo = /sa[ií]da/i.test(line) ? 'debito' : 'credito';
      // Caso o cabeçalho de data esteja na MESMA linha do "Total de saídas"
      const hmInline = line.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/i);
      if (hmInline) {
        const mes = _MESES_PT[hmInline[2].toLowerCase()];
        if (mes) curData = hmInline[3] + '-' + String(mes).padStart(2, '0') + '-' + String(parseInt(hmInline[1])).padStart(2, '0');
      }
      continue;
    }

    if (RE_PERIODO.test(line) || RE_SKIP.test(line)) { continue; }
    if (!curData || !curTipo) { continue; }

    // Linha de valor puro → fecha transação
    if (RE_VAL.test(line)) {
      const valor = _parseValorBRL(line);
      flushTx(valor);
      continue;
    }

    // Linha que termina com valor: "Resgate RDB 711,16" ou "DescriçãoR$ 1.234,56"
    const inlineVal = line.match(/^(.+?)\s*R?\$?\s*([\d\.]+,\d{2})\s*$/);
    if (inlineVal && inlineVal[1].length >= 2) {
      const descPart = inlineVal[1].replace(/R\$$/, '').trim();
      const valor = _parseValorBRL(inlineVal[2]);
      // Acumula a descrição inline e fecha
      if (descPart && !RE_SKIP.test(descPart) && !RE_ONLYNUMS.test(descPart)) {
        descBuf.push(descPart);
      }
      flushTx(valor);
      continue;
    }

    // Acumula descrição
    if (line.length >= 2 && line.length <= 200 && !RE_ONLYNUMS.test(line)) {
      descBuf.push(line);
    }
  }

  return results;
}

