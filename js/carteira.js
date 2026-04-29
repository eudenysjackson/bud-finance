/**
 * js/carteira.js — Minhas Contas
 * Hub para contas não-crédito (débito, dinheiro, benefícios) + importação de extratos
 * Firebase SDK Modular v10.8.1 | ES Module
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, query, where, orderBy, getDocs,
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
let currentCarteiraId = null;
let currentContaObj = null;
let previewPage = 0;
let globalTipo = 'auto';
let globalCat = '';
let dedupIds = new Set();
let excluirContaId = null;

// ── Tipo config ───────────────────────────────────────────
const TIPO_CONFIG = {
  dinheiro:        { icon: '💵', label: 'Dinheiro',            color: '#16a34a', bg: '#f0fdf4' },
  debito:          { icon: '🏦', label: 'Conta Bancária',      color: '#2563eb', bg: '#eff6ff' },
  vale_refeicao:   { icon: '🍽️', label: 'Vale Refeição',       color: '#ea580c', bg: '#fff7ed' },
  vale_alimentacao:{ icon: '🛒', label: 'Vale Alimentação',    color: '#16a34a', bg: '#f0fdf4' },
  transporte:      { icon: '🚌', label: 'Transporte / VT',     color: '#7c3aed', bg: '#f5f3ff' },
};

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
      btnSync.style.opacity = '';
      btnSync.style.pointerEvents = '';
    });
  }

  // Nova conta
  const btnNova = document.getElementById('btnNovaConta');
  if (btnNova) btnNova.addEventListener('click', () => abrirModalConta(null));
}

// ── Carregar Contas ───────────────────────────────────────
async function carregarContas() {
  try {
    const q = query(
      collection(db, 'usuarios', currentUser.uid, 'carteira'),
      where('tipo', '!=', 'credito'),
      orderBy('tipo'),
      orderBy('criadaEm')
    );
    const snap = await getDocs(q);
    contasGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Erro ao carregar contas:', err);
    // Se índice não existir, fallback sem orderBy
    try {
      const q2 = query(collection(db, 'usuarios', currentUser.uid, 'carteira'));
      const snap2 = await getDocs(q2);
      contasGlobal = snap2.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.tipo !== 'credito');
    } catch (err2) {
      console.error('Fallback também falhou:', err2);
      contasGlobal = [];
    }
  }
  renderContas();
  renderKPIs();
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

  if (contador) contador.textContent = `${contasGlobal.length} conta${contasGlobal.length !== 1 ? 's' : ''}`;

  grid.innerHTML = contasGlobal.map(conta => buildContaCard(conta)).join('');

  // Attach event listeners
  contasGlobal.forEach(conta => {
    const btnEdit = document.getElementById(`btnEdit_${conta.id}`);
    const btnImport = document.getElementById(`btnImport_${conta.id}`);
    const btnDel = document.getElementById(`btnDel_${conta.id}`);
    if (btnEdit) btnEdit.addEventListener('click', () => abrirModalConta(conta.id));
    if (btnImport) btnImport.addEventListener('click', () => abrirModalImport(conta.id));
    if (btnDel) btnDel.addEventListener('click', () => abrirModalExcluir(conta.id));
  });
}

function buildContaCard(conta) {
  const cfg = TIPO_CONFIG[conta.tipo] || { icon: '💳', label: conta.tipo, color: '#64748b', bg: '#f8fafc' };
  const saldo = getSaldoExibido(conta);
  const saldoStr  = valoresOcultos ? '••••••' : fmtBRL(saldo);
  const saldoColor = saldo < 0 ? '#dc2626' : 'var(--card-text)'; // vermelho se negativo
  const confirmacao = conta.ultimaConfirmacao?.data
    ? `Última confirmação: ${fmtDataBR(conta.ultimaConfirmacao.data)}`
    : 'Sem confirmação — saldo inicial';

  return `
    <div class="conta-card">
      <div class="conta-card-header">
        <div class="conta-tipo-icon" style="background:${cfg.bg};">${cfg.icon}</div>
        <div style="flex:1;padding-left:0.625rem;">
          <div class="conta-tipo-nome">${escapeHtml(conta.nome)}</div>
          <span class="conta-tipo-badge" style="background:${cfg.bg};color:${cfg.color};">${cfg.label}</span>
        </div>
        <div class="conta-card-actions">
          <button class="conta-action-btn" id="btnEdit_${conta.id}" title="Editar conta">✏️</button>
          <button class="conta-action-btn danger" id="btnDel_${conta.id}" title="Excluir conta">🗑️</button>
        </div>
      </div>
      <div class="conta-saldo" style="color:${saldoColor};">${saldoStr}</div>
      <div class="conta-confirmacao">${confirmacao}</div>
      <button class="conta-import-btn" id="btnImport_${conta.id}">📥 Importar Extrato</button>
    </div>`;
}

function getSaldoExibido(conta) {
  if (conta.ultimaConfirmacao?.saldo != null) return conta.ultimaConfirmacao.saldo;
  return conta.saldoInicial ?? conta.saldo ?? 0;
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

  if (id) {
    const conta = contasGlobal.find(c => c.id === id);
    if (!conta) return;
    titulo.textContent = '✏️ Editar Conta';
    editId.value = id;
    document.getElementById('contaNome').value = conta.nome || '';
    document.getElementById('contaSaldoInicial').value = fmtBRLInput(getSaldoExibido(conta));
    setContaTipoSelect(conta.tipo);
  } else {
    titulo.textContent = '➕ Nova Conta';
    editId.value = '';
  }

  modal.classList.add('open');

  // Saldo format
  const inputSaldo = document.getElementById('contaSaldoInicial');
  inputSaldo.addEventListener('input', function() { formatarInputValor(this); }, { once: false });

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

  // Close on outside click
  document.addEventListener('click', function handler(e) {
    if (!btn.contains(e.target) && !dd.contains(e.target)) {
      btn.classList.remove('open');
      dd.classList.remove('open');
      document.removeEventListener('click', handler);
    }
  });
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
    if (editId) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'carteira', editId), {
        nome, tipo, atualizadaEm: serverTimestamp(),
      });
    } else {
      await addDoc(ref, {
        nome, tipo,
        saldoInicial: saldo,
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
  document.getElementById('btnImportConcluir').onclick = () => {
    modal.classList.remove('open');
    carregarContas();
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
    let rows = [];

    if (ext === 'csv' || ext === 'txt') {
      const text = await readFileAsText(file);
      rows = parseCSV(text);
    } else if (ext === 'ofx' || ext === 'qfx') {
      const text = await readFileAsText(file);
      rows = parseOFX(text);
    } else if (ext === 'pdf' || ['jpg', 'jpeg', 'png'].includes(ext)) {
      // Backend: mostrar feedback de progressão
      btn.textContent = '🤖 Analisando com IA… pode levar até 2 min';
      rows = await processarViaBackend(file);
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
    return data.transacoes || data.rows || [];
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

  return rows;
}

// ── Mapear Transações ─────────────────────────────────────
function mapearTransacoes(rows) {
  return rows.map((r, idx) => {
    // BUG #1 fix: detectarTipo nunca retorna 'Transferência' como tipo
    const tipo = detectarTipo(r.descricao, r.tipoOrigem);
    const categoria = r.categoria || detectarCategoria(r.descricao, tipo);
    return {
      _idx: idx,
      data: r.data,
      descricao: r.descricao,
      valor: r.valor,
      tipo,
      categoria,
      fitId: r.fitId || null,
      selecionado: true,
      duplicata: false,
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
// BUG #10 fix: regras unificadas em uma única lista (sem duplicatas)
const REGRAS_CAT = [
  { cat: 'Mercado',          words: ['mercado','supermercado','hipermercado','atacadao','assai','carrefour','extra','pao de acucar','hortifruti','sacolao','feira'] },
  { cat: 'Restaurante',      words: ['restaurante','lanchonete','hamburger','pizza','sushi','churrascaria','ifood','rappi','delivery','uber eats'] },
  { cat: 'Transporte',       words: ['uber','taxi','99pop','cabify','onibus','metro','trem','combustivel','gasolina','etanol','estacionamento','pedagio','metrô'] },
  { cat: 'Farmácia',         words: ['farmacia','drogaria','ultrafarma','droga raia','drogasil','pacheco','medifarma'] },
  { cat: 'Saúde',            words: ['hospital','clinica','medico','consulta','plano de saude','dentista','fisioterapia','laboratorio','exame'] },
  { cat: 'Educação',         words: ['faculdade','universidade','escola','curso','mensalidade','udemy','coursera','alura','livro'] },
  { cat: 'Streaming',        words: ['netflix','spotify','amazon prime','disney','globoplay','hbo','paramount','youtube premium','deezer'] },
  { cat: 'Assinaturas',      words: ['assinatura','subscricao','plano'] },
  { cat: 'Compras Online',   words: ['mercadolivre','amazon','shopee','aliexpress','americanas','magazine luiza','casas bahia','submarino','shein'] },
  { cat: 'Roupas',           words: ['roupa','calcado','zara','renner','riachuelo','marisa','c&a','trick','calvin','lacoste'] },
  { cat: 'Moradia',          words: ['aluguel','condominio','agua','luz','energia','gas','iptu','internet','telefone','celular','vivo','claro','tim','oi'] },
  { cat: 'Investimentos',    words: ['aplicacao','investimento','cdb','rdb','lci','lca','tesouro direto','acoes','fundo','bovespa'] },
  { cat: 'Salário',          words: ['salario','proventos','folha de pagamento','holerite'] },
  { cat: 'Transferência',    words: ['transferencia','pix','ted','doc','tev'] },
  { cat: 'Pets',             words: ['pet','veterinario','racao','petshop','petz','cobasi'] },
  { cat: 'Beleza',           words: ['salao','cabelereiro','estetica','manicure','barbearia','perfumaria','sephora'] },
  { cat: 'Academia',         words: ['academia','ginasio','crossfit','smartfit','bluefit'] },
  { cat: 'Padaria/Café',     words: ['padaria','cafe','cafeteria','starbucks','bobs','mcdonalds','burger king','kfc','subway'] },
  { cat: 'Viagem',           words: ['hotel','hospedagem','passagem','voo','airbnb','booking','decolar','latam','gol','azul'] },
  { cat: 'Lazer',            words: ['cinema','teatro','show','ingresso','parque','diversao'] },
];

function detectarCategoria(desc, tipo) {
  if (!desc) return tipo === 'receita' ? 'Outros' : 'Outros';
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const regra of REGRAS_CAT) {
    for (const w of regra.words) {
      if (d.includes(w)) return regra.cat;
    }
  }
  return tipo === 'receita' ? 'Renda' : 'Outros';
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

    // BUG #3 fix: dedup por data + valor + carteiraId + desc normalizada (30 chars)
    const existentes = new Set(
      snap.docs.map(d => {
        const tx = d.data();
        const desc30 = normDesc(tx.descricao || '');
        return `${tx.dataReferencia}|${tx.valor}|${desc30}`;
      })
    );

    parsedRows.forEach(r => {
      const key = `${r.data}|${r.valor}|${normDesc(r.descricao)}`;
      r.duplicata = existentes.has(key);
      if (r.duplicata) r.selecionado = false; // deselect duplicatas
    });

    const qtdDupl = parsedRows.filter(r => r.duplicata).length;
    const badge = document.getElementById('previewDedupBadge');
    if (badge) {
      if (qtdDupl > 0) {
        badge.textContent = `⚠️ ${qtdDupl} prováve${qtdDupl > 1 ? 'is duplicatas' : 'l duplicata'}`;
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

// ── buildCatOptions ───────────────────────────────────────
function buildCatOptions(selected) {
  const p = window.BUD_CATEGORIAS_PADRAO || { despesa: [], receita: [] };
  const all = [...(p.despesa || []), ...(p.receita || [])];
  let html = '<option value="">-- Categoria --</option>';
  all.forEach(function(c) {
    const sel = c.nome === selected ? ' selected' : '';
    html += '<option value="' + escapeHtml(c.nome) + '"' + sel + '>' + (c.emoji || '') + ' ' + escapeHtml(c.nome) + '</option>';
  });
  return html;
}

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
    const trClass = r.duplicata ? 'style="opacity:0.5;"' : '';
    const dupBadge = r.duplicata
      ? '<span title="Transação já existe no período — desmarcada automaticamente" style="font-size:0.6rem;background:#fef9c3;color:#854d0e;padding:0.1rem 0.3rem;border-radius:3px;font-weight:700;margin-left:4px;cursor:help;">DUP ⚠️</span>'
      : '';

    return `<tr ${trClass}>
      <td><input type="checkbox" data-idx="${globalIdx}" ${r.selecionado ? 'checked' : ''} onchange="toggleRowSelect(${globalIdx}, this.checked)"></td>
      <td style="white-space:nowrap;font-size:0.75rem;">${r.data}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.descricao)}">${escapeHtml(r.descricao)}${dupBadge}</td>
      <td><button class="tipo-pill ${tipoClass}" onclick="toggleRowTipo(${globalIdx})">${tipoLabel}</button></td>
      <td style="text-align:right;font-weight:700;white-space:nowrap;color:${r.tipo === 'receita' ? '#16a34a' : '#dc2626'};">${fmtBRL(r.valor)}</td>
      <td><select onchange="setRowCategoria(${globalIdx}, this.value)" style="border:1px solid var(--input-border);border-radius:0.375rem;padding:0.2rem 0.375rem;font-size:0.75rem;background:var(--input-bg);color:var(--card-text);font-family:inherit;width:160px;cursor:pointer;">${buildCatOptions(r.categoria)}</select></td>
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
        renderPreview();
      }
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
          data: r.data,
          dataReferencia: r.data,
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

    // Atualizar ultimaConfirmacao no carteira document (snapshot)
    const ultimaData = selecionados.map(r => r.data).sort().reverse()[0];
    const receitas = selecionados.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.valor, 0);
    const despesas = selecionados.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0);
    const netDelta = receitas - despesas;
    const saldoAtual = getSaldoExibido(currentContaObj);
    const novoSaldo = saldoAtual + netDelta;

    await updateDoc(doc(db, 'usuarios', uid, 'carteira', currentCarteiraId), {
      ultimaConfirmacao: {
        data: ultimaData,
        saldo: novoSaldo,
        origem: 'extrato_importado',
      },
      atualizadaEm: serverTimestamp(),
    });

    // UI resultado
    document.getElementById('importResultIcon').textContent = '✅';
    document.getElementById('importResultTitle').textContent = `${salvos} transações importadas!`;
    document.getElementById('importResultSub').textContent = `Saldo atualizado: ${fmtBRL(novoSaldo)}`;
    document.getElementById('importResultDetails').style.display = 'block';
    document.getElementById('importResultDetails').innerHTML = `
      <div>📈 Receitas: <strong style="color:#16a34a;">${fmtBRL(receitas)}</strong></div>
      <div>📉 Despesas: <strong style="color:#dc2626;">${fmtBRL(despesas)}</strong></div>
      <div>💰 Delta: <strong style="color:${netDelta >= 0 ? '#16a34a' : '#dc2626'};">${netDelta >= 0 ? '+' : ''}${fmtBRL(netDelta)}</strong></div>
      <div>📅 Última data: <strong>${fmtDataBR(ultimaData)}</strong></div>
    `;
    document.getElementById('btnImportConcluir').style.display = 'block';

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
