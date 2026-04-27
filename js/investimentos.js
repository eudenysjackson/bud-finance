/**
 * js/investimentos.js — Bud Finance Investimentos
 * Firebase SDK Modular v10.8.1 — NO compat layer.
 *
 * Bugs do cérebro corrigidos desde o início:
 * BUG 1  — overlay exclusão usa style.cssText (não Tailwind dinâmico — DEC-006)
 * BUG 2  — fmt() com Number() fallback — sem crash em null/undefined
 * BUG 3  — form submit com try/catch completo + btn disabled
 * BUG 4  — tipo validado antes do save
 * BUG 5  — BENCHMARKS centralizado em único objeto (sem duplicação)
 * BUG 6  — indicadores sinalizados como "referência" (não "tempo real")
 * BUG 7  — onSnapshot com orderBy('criadoEm','desc') + limit(500)
 * BUG 8  — n/a (sem downgrade de plano nesta tela)
 * BUG 10 — sort() usa [...arr].sort() sem mutar array original
 * BUG 12 — annualização só para ativos com >30 dias (evita distorção)
 * BUG 14 — escapeHTML em todos os dados da API externa
 * BUG 17 — Chart reutiliza instância com chart.update() (não destroy/recreate)
 */

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, query, orderBy, limit,
  onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Benchmarks (BUG 5 — fonte única de verdade) ──────────────────────────
const BENCHMARKS = { selic: 14.75, cdi: 14.65, ipca: 5.53, poupanca: 7.49 };

// ─── Tipos de investimento ────────────────────────────────────────────────
const TIPOS_INVEST = [
  { valor: 'Renda Fixa',      emoji: '📜', cor: '#2563eb' },
  { valor: 'Ações',           emoji: '📊', cor: '#10b981' },
  { valor: 'FIIs',            emoji: '🏢', cor: '#8b5cf6' },
  { valor: 'Cripto',          emoji: '₿',  cor: '#f59e0b' },
  { valor: 'Poupança',        emoji: '🐷', cor: '#06b6d4' },
  { valor: 'CDB',             emoji: '🏦', cor: '#3b82f6' },
  { valor: 'Tesouro Direto',  emoji: '🇧🇷', cor: '#22c55e' },
  { valor: 'Outro',           emoji: '💎', cor: '#94a3b8' },
];

// ─── Liquidez ──────────────────────────────────────────────────────────────
const OPCOES_LIQUIDEZ = [
  'Diária', 'No vencimento', '30 dias', '60 dias', '90 dias', 'Sem liquidez'
];

// ─── Estado ────────────────────────────────────────────────────────────────
let currentUser      = null;
let investimentos    = [];
let _unsub           = null;
let _salvando        = false;
let _editandoId      = null;
let valoresOcultos   = false;
let _filtroAtivo     = '';
let _chartAlocacao   = null;  // BUG 17 — instância reutilizável

// ─── Helpers ───────────────────────────────────────────────────────────────
// escapeHTML: precisa escapar TODAS as aspas (budSanitize() apenas remove tags).
const escapeHTML = (typeof window.budEscapeHTML === 'function')
  ? window.budEscapeHTML
  : s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// BUG 2 — fmt() com Number() fallback
const fmt = v => valoresOcultos
  ? 'R$ •••••'
  : (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = v => (Number(v) || 0).toFixed(2).replace('.', ',') + '%';

function getTipoObj(tipo) {
  return TIPOS_INVEST.find(t => t.valor === tipo) || { emoji: '💎', cor: '#94a3b8' };
}

function showToast(msg, tipo = 'ok') {
  if (typeof window.budShowToast === 'function') window.budShowToast(msg, tipo);
}

function hideSplash() {
  const s = document.getElementById('splash');
  if (s) { s.classList.add('hide'); setTimeout(() => s.remove(), 600); }
}

// ─── Toggle valores ocultos ────────────────────────────────────────────────
window.toggleOcultarValores = function () {
  valoresOcultos = !valoresOcultos;
  const btn = document.getElementById('btnOcultarValores');
  if (btn) btn.textContent = valoresOcultos ? '🙈 Valores' : '👁 Valores';
  renderizar();
};

// ─── Filtro de tipo ────────────────────────────────────────────────────────
window.setFiltro = function (tipo) {
  _filtroAtivo = tipo;
  document.querySelectorAll('[id^="filtro"]').forEach(b => {
    b.style.background = 'var(--input-bg)';
    b.style.color = 'var(--text-sec)';
    b.style.borderColor = 'var(--input-border)';
  });
  const map = { '': 'filtroTodos', 'Renda Fixa': 'filtroRendaFixa', 'Ações': 'filtroAcoes', 'Cripto': 'filtroCripto' };
  const btn = document.getElementById(map[tipo]);
  if (btn) {
    btn.style.background = '#eff6ff';
    btn.style.color = '#2563eb';
    btn.style.borderColor = '#bfdbfe';
  }
  renderizarLista();
};

// ─── Mask BRL ─────────────────────────────────────────────────────────────
window._maskBRL = function (el) {
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  v = (parseInt(v, 10) / 100).toFixed(2);
  el.value = 'R$ ' + v.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

function parseBRL(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── DATEPICKER (DEC-018) ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const _dpState = {};

function _buildDP(dpId, hiddenId, labelId) {
  const hoje = new Date();
  if (!_dpState[dpId]) {
    _dpState[dpId] = { ano: hoje.getFullYear(), mes: hoje.getMonth(), sel: null };
  }
  _renderDP(dpId, hiddenId, labelId);
}

function _renderDP(dpId, hiddenId, labelId) {
  const panel = document.getElementById(dpId);
  if (!panel) return;
  const st = _dpState[dpId];
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DIAS  = ['D','S','T','Q','Q','S','S'];
  const hoje  = new Date();
  const primeiroDia = new Date(st.ano, st.mes, 1).getDay();
  const totalDias   = new Date(st.ano, st.mes + 1, 0).getDate();

  let cells = DIAS.map(d => `<div class="dp-dow">${d}</div>`).join('');
  for (let i = 0; i < primeiroDia; i++) cells += `<div class="dp-day empty"></div>`;
  for (let d = 1; d <= totalDias; d++) {
    const isHoje = hoje.getFullYear() === st.ano && hoje.getMonth() === st.mes && hoje.getDate() === d;
    const isSel  = st.sel && st.sel.getFullYear() === st.ano && st.sel.getMonth() === st.mes && st.sel.getDate() === d;
    const cls    = ['dp-day', isHoje ? 'today' : '', isSel ? 'selected' : ''].filter(Boolean).join(' ');
    cells += `<div class="${cls}" onclick="window._dpSelectDay('${dpId}','${hiddenId}','${labelId}',${d})">${d}</div>`;
  }

  panel.innerHTML = `
    <div class="dp-header">
      <button class="dp-nav" onclick="window._dpNav('${dpId}','${hiddenId}','${labelId}',-1)">‹</button>
      <span class="dp-month-label">${MESES[st.mes]} ${st.ano}</span>
      <button class="dp-nav" onclick="window._dpNav('${dpId}','${hiddenId}','${labelId}',1)">›</button>
    </div>
    <div class="dp-grid">${cells}</div>
    <div class="dp-actions">
      <button class="dp-btn dp-btn-today" onclick="window._dpHoje('${dpId}','${hiddenId}','${labelId}')">Hoje</button>
      <button class="dp-btn dp-btn-clear" onclick="window._dpClear('${dpId}','${hiddenId}','${labelId}')">Limpar</button>
    </div>`;
}

window._toggleDP = function (dpId, hiddenId) {
  const labelId = hiddenId + 'Label';
  const panel = document.getElementById(dpId);
  if (!panel) return;
  const open = panel.classList.contains('open');
  // fecha todos
  document.querySelectorAll('.dp-panel.open').forEach(p => p.classList.remove('open'));
  if (!open) {
    _buildDP(dpId, hiddenId, labelId);
    panel.classList.add('open');
  }
};
window._dpNav = function (dpId, hiddenId, labelId, dir) {
  const st = _dpState[dpId];
  if (!st) return;
  st.mes += dir;
  if (st.mes > 11) { st.mes = 0; st.ano++; }
  if (st.mes < 0)  { st.mes = 11; st.ano--; }
  _renderDP(dpId, hiddenId, labelId);
};
window._dpSelectDay = function (dpId, hiddenId, labelId, d) {
  const st = _dpState[dpId];
  if (!st) return;
  st.sel = new Date(st.ano, st.mes, d);
  const iso = `${st.ano}-${String(st.mes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const label = `${String(d).padStart(2,'0')}/${String(st.mes + 1).padStart(2,'0')}/${st.ano}`;
  const hi = document.getElementById(hiddenId);
  const la = document.getElementById(labelId);
  if (hi) hi.value = iso;
  if (la) la.value = label;
  document.getElementById(dpId).classList.remove('open');
};
window._dpHoje = function (dpId, hiddenId, labelId) {
  const hoje = new Date();
  window._dpSelectDay(dpId, hiddenId, labelId + '_HOJE_FAKE', hoje.getDate());
  // re-impl direta
  const st = _dpState[dpId];
  if (!st) return;
  st.ano = hoje.getFullYear(); st.mes = hoje.getMonth(); st.sel = hoje;
  const iso   = hoje.toISOString().split('T')[0];
  const label = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
  const hi = document.getElementById(hiddenId);
  const la = document.getElementById(labelId);
  if (hi) hi.value = iso;
  if (la) la.value = label;
  document.getElementById(dpId).classList.remove('open');
};
window._dpClear = function (dpId, hiddenId, labelId) {
  const st = _dpState[dpId];
  if (st) st.sel = null;
  const hi = document.getElementById(hiddenId);
  const la = document.getElementById(labelId);
  if (hi) hi.value = '';
  if (la) la.value = '';
  document.getElementById(dpId).classList.remove('open');
};

// Fecha datepickers ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.dp-wrap')) {
    document.querySelectorAll('.dp-panel.open').forEach(p => p.classList.remove('open'));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ── DROPDOWN TIPO ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function _buildTipoDropdown() {
  const dd = document.getElementById('tipoDropdown');
  if (!dd) return;
  dd.innerHTML = TIPOS_INVEST.map(t => `
    <div class="custom-select-item" onclick="window._selectTipo('${t.valor}','${t.emoji}')">
      <span>${t.emoji}</span><span>${escapeHTML(t.valor)}</span>
    </div>`).join('');
}

window._toggleTipoDD = function () {
  const dd = document.getElementById('tipoDropdown');
  const tr = document.getElementById('tipoTrigger');
  if (!dd) return;
  _fecharOutrosDropdowns('tipoDropdown');
  dd.classList.toggle('open');
  if (tr) tr.classList.toggle('open', dd.classList.contains('open'));
};
window._selectTipo = function (val, emoji) {
  document.getElementById('investTipo').value = val;
  document.getElementById('tipoLabel').textContent = emoji + ' ' + val;
  document.getElementById('tipoLabel').style.color = 'var(--card-text)';
  document.getElementById('tipoDropdown').classList.remove('open');
  document.getElementById('tipoTrigger').classList.remove('open');
  document.getElementById('errTipo').style.display = 'none';
};

// ─── Dropdown liquidez ────────────────────────────────────────────────────
function _buildLiquidezDropdown() {
  const dd = document.getElementById('liquidezDropdown');
  if (!dd) return;
  dd.innerHTML = OPCOES_LIQUIDEZ.map(o => `
    <div class="custom-select-item" onclick="window._selectLiquidez('${o}')">
      <span>${escapeHTML(o)}</span>
    </div>`).join('');
}

window._toggleLiquidezDD = function () {
  const dd = document.getElementById('liquidezDropdown');
  const tr = document.getElementById('liquidezTrigger');
  if (!dd) return;
  _fecharOutrosDropdowns('liquidezDropdown');
  dd.classList.toggle('open');
  if (tr) tr.classList.toggle('open', dd.classList.contains('open'));
};
window._selectLiquidez = function (val) {
  document.getElementById('investLiquidez').value = val;
  document.getElementById('liquidezLabel').textContent = val;
  document.getElementById('liquidezLabel').style.color = 'var(--card-text)';
  document.getElementById('liquidezDropdown').classList.remove('open');
  document.getElementById('liquidezTrigger').classList.remove('open');
};

function _fecharOutrosDropdowns(exceto) {
  ['tipoDropdown','liquidezDropdown'].forEach(id => {
    if (id !== exceto) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    }
  });
  // fecha triggers
  ['tipoTrigger','liquidezTrigger'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.custom-select-wrap')) _fecharOutrosDropdowns('');
});

// ═══════════════════════════════════════════════════════════════════════════
// ── MODAL ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
window.abrirModalPorId = function (id) {
  const inv = id ? investimentos.find(i => i.id === id) || null : null;
  window.abrirModal(inv);
};

window.abrirModal = function (inv) {
  _editandoId = inv ? inv.id : null;
  document.getElementById('modalInvestTitulo').textContent = inv ? '✏️ Editar Investimento' : '+ Novo Investimento';
  document.getElementById('investId').value          = inv ? inv.id : '';
  document.getElementById('investNome').value        = inv ? inv.nome : '';
  document.getElementById('investCorretora').value   = inv ? inv.corretora : '';
  document.getElementById('investTipo').value        = inv ? inv.tipo : '';
  document.getElementById('investLiquidez').value    = inv ? inv.liquidez : '';
  document.getElementById('investData').value        = inv ? (inv.data || '') : '';
  document.getElementById('investVenc').value        = inv ? (inv.vencimento || '') : '';
  document.getElementById('errTipo').style.display   = 'none';

  // Labels dos dropdowns
  if (inv && inv.tipo) {
    const t = getTipoObj(inv.tipo);
    document.getElementById('tipoLabel').textContent  = t.emoji + ' ' + inv.tipo;
    document.getElementById('tipoLabel').style.color  = 'var(--card-text)';
  } else {
    document.getElementById('tipoLabel').textContent  = 'Selecione o tipo';
    document.getElementById('tipoLabel').style.color  = 'var(--card-text-sec)';
  }
  if (inv && inv.liquidez) {
    document.getElementById('liquidezLabel').textContent  = inv.liquidez;
    document.getElementById('liquidezLabel').style.color  = 'var(--card-text)';
  } else {
    document.getElementById('liquidezLabel').textContent  = 'Selecione a liquidez';
    document.getElementById('liquidezLabel').style.color  = 'var(--card-text-sec)';
  }

  // Valores BRL
  const fmtEdit = v => v ? 'R$ ' + (Number(v)||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  document.getElementById('investValor').value     = inv ? fmtEdit(inv.valor) : '';
  document.getElementById('investValorAtual').value = inv ? fmtEdit(inv.valorAtual) : '';

  // Dates labels
  const isoToLabel = iso => {
    if (!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  document.getElementById('investDataLabel').value = isoToLabel(inv?.data);
  document.getElementById('investVencLabel').value  = isoToLabel(inv?.vencimento);

  // Reinicia DP state
  ['dpInvestData','dpInvestVenc'].forEach(id => { delete _dpState[id]; });

  _atualizarRendCalc();

  document.getElementById('btnExcluirInvest').style.display = inv ? 'block' : 'none';
  document.getElementById('modalInvestimento').classList.add('open');
};

window.fecharModal = function () {
  document.getElementById('modalInvestimento').classList.remove('open');
  _fecharOutrosDropdowns('');
};

// Fecha ao clicar no overlay
document.getElementById('modalInvestimento').addEventListener('click', e => {
  if (e.target === document.getElementById('modalInvestimento')) window.fecharModal();
});

// ─── Preview rendimento no modal ──────────────────────────────────────────
window._atualizarRendCalc = function () {
  const val  = parseBRL(document.getElementById('investValor').value);
  const atu  = parseBRL(document.getElementById('investValorAtual').value);
  const el   = document.getElementById('rendCalcPreview');
  if (!el) return;
  if (val <= 0 || atu <= 0) { el.style.display = 'none'; return; }
  const rend = ((atu - val) / val) * 100;
  const diff = atu - val;
  el.style.display = 'block';
  const cor = rend >= 0 ? '#16a34a' : '#dc2626';
  el.innerHTML = `Rendimento: <strong style="color:${cor}">${fmtPct(rend)}</strong> (${diff >= 0 ? '+' : ''}${(Number(diff)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})`;
};

// ─── Salvar investimento (BUG 3 — try/catch completo) ────────────────────
window.salvarInvestimento = async function () {
  if (_salvando) return;

  const tipo = document.getElementById('investTipo').value;
  // BUG 4 — validar tipo
  if (!tipo) {
    const errEl = document.getElementById('errTipo');
    errEl.textContent = 'Selecione o tipo do investimento.';
    errEl.style.display = 'block';
    return;
  }

  const nome = document.getElementById('investNome').value.trim();
  if (!nome) { showToast('Informe o nome do investimento.', 'erro'); return; }

  const valorInv = parseBRL(document.getElementById('investValor').value);
  if (valorInv <= 0) { showToast('Informe o valor aportado.', 'erro'); return; }

  const valorAt = parseBRL(document.getElementById('investValorAtual').value) || valorInv;
  const rendCalc = valorInv > 0 ? ((valorAt - valorInv) / valorInv) * 100 : 0;

  const btn = document.getElementById('btnSalvarInvest');
  const txtOrig = btn.textContent;
  _salvando = true;
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const dados = {
      nome:       nome,
      tipo:       tipo,
      corretora:  document.getElementById('investCorretora').value.trim(),
      valor:      valorInv,
      valorAtual: valorAt,
      rendimento: rendCalc,
      liquidez:   document.getElementById('investLiquidez').value || '',
      vencimento: document.getElementById('investVenc').value || '',
      data:       document.getElementById('investData').value || '',
      atualizadoEm: serverTimestamp(),
    };

    const id = document.getElementById('investId').value;
    if (id) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'investimentos', id), dados);
      showToast('Investimento atualizado!', 'ok');
    } else {
      await addDoc(collection(db, 'usuarios', currentUser.uid, 'investimentos'), {
        ...dados, criadoEm: serverTimestamp()
      });
      showToast('Investimento registrado!', 'ok');
    }
    window.fecharModal();
  } catch (err) {
    (window.budError||console.error)('Erro ao salvar investimento:', err);
    showToast('Erro ao salvar. Verifique sua conexão.', 'erro');
  } finally {
    _salvando = false;
    btn.disabled = false;
    btn.textContent = txtOrig;
  }
};

// ─── Excluir investimento (BUG 1 — style.cssText) ────────────────────────
window.excluirInvestimento = async function () {
  const id = document.getElementById('investId').value;
  if (!id) return;

  const ok = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-page);border:1px solid var(--card-border);border-radius:1.25rem;padding:1.75rem;max-width:380px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);animation:modal-in .2s ease;';
    card.innerHTML = `
      <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">Excluir investimento?</div>
      <div style="font-size:0.875rem;font-weight:500;color:var(--text-sec);margin-bottom:1.5rem;">Esta ação não pode ser desfeita.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;">
        <button data-res="0" style="padding:0.625rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text-sec);">Cancelar</button>
        <button data-res="1" style="padding:0.625rem;border:none;border-radius:0.75rem;background:#dc2626;color:#fff;font-size:0.875rem;font-weight:800;cursor:pointer;font-family:inherit;">Excluir</button>
      </div>`;
    ov.appendChild(card);
    document.body.appendChild(ov);
    card.querySelector('[data-res="0"]').onclick = () => { ov.remove(); resolve(false); };
    card.querySelector('[data-res="1"]').onclick = () => { ov.remove(); resolve(true); };
    ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); resolve(false); } });
  });

  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'investimentos', id));
    window.fecharModal();
    showToast('Investimento excluído.', 'ok');
  } catch (err) {
    (window.budError||console.error)('Erro ao excluir:', err);
    showToast('Erro ao excluir. Tente novamente.', 'erro');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ── RENDERIZAÇÃO ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// BUG 12 — annualizar só para ativos com >30 dias
function calcRendAnual(inv) {
  if (!inv.data || !inv.valor || !inv.valorAtual) return null;
  const inicio = new Date(inv.data + 'T12:00:00');
  const hoje   = new Date();
  const dias   = Math.max(0, (hoje - inicio) / 86400000);
  if (dias < 30) return null;  // evita distorção em posições muito recentes
  const anos = dias / 365;
  const vAtu = Number(inv.valorAtual) || 0;
  const vInv = Number(inv.valor)      || 0;
  if (vInv <= 0) return null;
  return (Math.pow(vAtu / vInv, 1 / anos) - 1) * 100;
}

function renderizarKPIs() {
  const total  = investimentos.reduce((s, i) => s + (Number(i.valor)      || 0), 0);
  const atual  = investimentos.reduce((s, i) => s + (Number(i.valorAtual) || 0), 0);
  const rend   = atual - total;
  const rendPct = total > 0 ? (rend / total) * 100 : 0;

  document.getElementById('kpiInvestido').textContent    = fmt(total);
  document.getElementById('kpiInvestidoSub').textContent = `${investimentos.length} investimento${investimentos.length !== 1 ? 's' : ''}`;
  document.getElementById('kpiAtual').textContent        = fmt(atual);
  document.getElementById('kpiAtualSub').textContent     = total > 0 ? (rend >= 0 ? '▲ acima do aporte' : '▼ abaixo do aporte') : 'patrimônio atual';
  document.getElementById('kpiRendimento').textContent   = fmt(rend);

  const cor = rendPct >= 0 ? '#16a34a' : '#dc2626';
  document.getElementById('kpiRendimentoPct').innerHTML =
    `<span style="color:${cor};font-weight:700;">${rendPct >= 0 ? '+' : ''}${fmtPct(rendPct)} total</span>`;
}

function renderizarAlertaDiversificacao() {
  if (investimentos.length === 0) {
    document.getElementById('alertaDiversificacao').style.display = 'none';
    return;
  }
  const total = investimentos.reduce((s, i) => s + (Number(i.valorAtual) || 0), 0);
  if (total <= 0) { document.getElementById('alertaDiversificacao').style.display = 'none'; return; }

  // Agrega por tipo
  const porTipo = {};
  investimentos.forEach(i => {
    porTipo[i.tipo] = (porTipo[i.tipo] || 0) + (Number(i.valorAtual) || 0);
  });

  const tipoMax = Object.entries(porTipo).sort((a,b) => b[1]-a[1])[0];
  if (!tipoMax) return;
  const pct = (tipoMax[1] / total) * 100;
  const al  = document.getElementById('alertaDiversificacao');

  if (pct > 60) {
    al.style.display  = 'block';
    al.style.cssText  = 'display:block;border-radius:1rem;padding:0.875rem 1rem;font-size:0.875rem;font-weight:600;margin-bottom:1rem;background:#fffbeb;border:1.5px solid #fde68a;color:#92400e;';
    al.innerHTML      = `⚠️ <strong>${escapeHTML(tipoMax[0])}</strong> representa ${pct.toFixed(0)}% da sua carteira. Considere diversificar para reduzir riscos.`;
  } else {
    al.style.display = 'none';
  }
}

// BUG 17 — reutiliza instância do Chart
function renderizarGrafico() {
  if (investimentos.length === 0) {
    if (_chartAlocacao) { _chartAlocacao.data.labels = []; _chartAlocacao.data.datasets[0].data = []; _chartAlocacao.update(); }
    document.getElementById('legendaAlocacao').innerHTML = '<div style="font-size:0.8125rem;color:var(--text-sec);text-align:center;padding:1rem;">Nenhum investimento</div>';
    return;
  }

  const porTipo = {};
  investimentos.forEach(i => {
    const k = i.tipo || 'Outro';
    porTipo[k] = (porTipo[k] || 0) + (Number(i.valorAtual) || 0);
  });
  const entries = Object.entries(porTipo).sort((a,b) => b[1]-a[1]);
  const labels  = entries.map(([t]) => t);
  const data    = entries.map(([,v]) => v);
  const cores   = labels.map(t => getTipoObj(t).cor);
  const total   = data.reduce((s,v) => s+v, 0);

  const canvas = document.getElementById('chartAlocacao');

  if (_chartAlocacao) {
    // BUG 17 — update sem destruir
    _chartAlocacao.data.labels              = labels;
    _chartAlocacao.data.datasets[0].data    = data;
    _chartAlocacao.data.datasets[0].backgroundColor = cores;
    _chartAlocacao.update();
  } else {
    _chartAlocacao = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: cores,
          borderWidth: 2,
          borderColor: 'transparent',
          hoverOffset: 8,
        }]
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v   = ctx.raw || 0;
                const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
                return ` ${(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} (${pct}%)`;
              }
            }
          }
        },
        animation: { duration: 400 },
      }
    });
  }

  // Legenda
  document.getElementById('legendaAlocacao').innerHTML = entries.map(([tipo, val]) => {
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
    const cor  = getTipoObj(tipo).cor;
    const emo  = getTipoObj(tipo).emoji;
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;font-size:0.8125rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0;"></div>
        <span style="font-weight:600;color:var(--card-text);">${emo} ${escapeHTML(tipo)}</span>
      </div>
      <div style="text-align:right;">
        <span style="font-weight:700;color:var(--card-text);">${fmtPct(pct)}</span>
        <span style="font-size:0.6875rem;font-weight:500;color:var(--card-text-sec);margin-left:0.25rem;">${valoresOcultos ? '•••' : (Number(val)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
      </div>
    </div>`;
  }).join('');
}

function renderizarLista() {
  const container = document.getElementById('listaInvestimentos');
  // BUG 10 — sort sem mutar array original
  let lista = [...investimentos];
  if (_filtroAtivo) lista = lista.filter(i => i.tipo === _filtroAtivo);

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📈</div>
        <div class="empty-title">${_filtroAtivo ? 'Nenhum investimento do tipo ' + escapeHTML(_filtroAtivo) : 'Nenhum investimento cadastrado'}</div>
        <div class="empty-sub">${_filtroAtivo ? 'Tente outro filtro.' : 'Clique em "+ Novo Investimento" para começar.'}</div>
      </div>`;
    return;
  }

  container.innerHTML = lista.map((inv, idx) => {
    const t        = getTipoObj(inv.tipo);
    const vAtu     = Number(inv.valorAtual) || 0;
    const vInv     = Number(inv.valor)      || 0;
    const rend     = vInv > 0 ? ((vAtu - vInv) / vInv) * 100 : 0;
    const rendAnual = calcRendAnual(inv);
    const rendCls   = rend > 0 ? 'pos' : rend < 0 ? 'neg' : 'neu';
    const rendSinal = rend >= 0 ? '+' : '';

    // BUG 12 — badges benchmark só se rendAnual disponível (>30 dias)
    let badges = '';
    if (rendAnual !== null) {
      if (rendAnual > BENCHMARKS.cdi)  badges += `<span class="badge-benchmark badge-cdi">▲ CDI</span>`;
      if (rendAnual > BENCHMARKS.ipca) badges += `<span class="badge-benchmark badge-ipca">▲ IPCA</span>`;
    }

    const meta = [inv.corretora, inv.liquidez].filter(Boolean).join(' · ');

    return `<div class="inv-item" onclick="window.abrirModalPorId('${escapeHTML(inv.id)}')" style="animation:fadeInUp .25s ease ${idx * 0.04}s both;">
      <div class="inv-emoji">${t.emoji}</div>
      <div class="inv-info">
        <div class="inv-nome">${escapeHTML(inv.nome || '—')}</div>
        <div class="inv-meta">${escapeHTML(meta || inv.tipo || '—')}${badges}</div>
      </div>
      <div class="inv-valores">
        <div class="inv-atual">${fmt(vAtu)}</div>
        <div class="inv-rend ${rendCls}">${rendSinal}${fmtPct(rend)}</div>
      </div>
      <button title="Editar" style="background:none;border:1.5px solid var(--input-border);cursor:pointer;color:var(--text-sec);font-size:0.875rem;padding:0.375rem 0.5rem;border-radius:0.625rem;flex-shrink:0;transition:background .15s,border-color .15s;line-height:1;">✏️</button>
    </div>`;
  }).join('');
}

function renderizar() {
  renderizarKPIs();
  renderizarAlertaDiversificacao();
  renderizarGrafico();
  renderizarLista();
}

// ═══════════════════════════════════════════════════════════════════════════
// ── MERCADO (AwesomeAPI) ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
let _mercadoCache = null;
let _mercadoCacheTs = 0;
const MERCADO_TTL = 5 * 60 * 1000; // 5 min

window.carregarMercado = async function (forcar = false) {
  const agora = Date.now();
  if (!forcar && _mercadoCache && (agora - _mercadoCacheTs < MERCADO_TTL)) {
    _renderMercado(_mercadoCache);
    return;
  }

  const container = document.getElementById('cotacoesContainer');
  container.innerHTML = '<div style="text-align:center;color:var(--text-sec);font-size:0.8125rem;padding:1rem;grid-column:span 3;">Carregando...</div>';

  try {
    // AwesomeAPI — câmbio + cripto
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL', {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    _mercadoCache   = json;
    _mercadoCacheTs = Date.now();
    _renderMercado(json);
  } catch (err) {
    (window.budWarn||console.warn)('Erro ao buscar cotações:', err);
    container.innerHTML = '<div style="text-align:center;color:var(--text-sec);font-size:0.8125rem;padding:1rem;grid-column:span 3;">Cotações indisponíveis no momento.</div>';
  }
};

function _renderMercado(json) {
  const moedas = [
    { key: 'USDBRL', nome: 'USD',   emoji: '🇺🇸' },
    { key: 'EURBRL', nome: 'EUR',   emoji: '🇪🇺' },
    { key: 'BTCBRL', nome: 'BTC',   emoji: '₿'   },
  ];

  const container = document.getElementById('cotacoesContainer');
  const hora      = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horaEl    = document.getElementById('cotacaoHora');
  if (horaEl) horaEl.textContent = 'Atualizado às ' + hora;

  container.innerHTML = moedas.map(m => {
    const d = json[m.key];
    if (!d) return '';
    // BUG 14 — escapeHTML em dados da API
    const val  = (Number(d.bid) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const pct  = parseFloat(d.pctChange) || 0;
    const sinal = pct >= 0 ? '+' : '';
    const cls   = pct >= 0 ? 'pos' : 'neg';
    return `<div class="cotacao-card">
      <div class="cotacao-label">${escapeHTML(m.emoji)} ${escapeHTML(m.nome)}</div>
      <div class="cotacao-valor">${escapeHTML(val)}</div>
      <div class="cotacao-var ${cls}">${sinal}${escapeHTML(String(pct.toFixed(2)))}% hoje</div>
    </div>`;
  }).join('');

  // BUG 5 + BUG 6 — indicadores de REFERÊNCIA (não "tempo real"), fonte única BENCHMARKS
  const indicadores = document.getElementById('indicadoresContainer');
  if (indicadores) {
    indicadores.innerHTML = [
      { e: '🏛️', n: 'Selic',    v: BENCHMARKS.selic.toFixed(2).replace('.',',') + '% a.a.',    s: 'Ref. Copom' },
      { e: '📊', n: 'CDI',      v: BENCHMARKS.cdi.toFixed(2).replace('.',',') + '% a.a.',      s: 'Renda fixa' },
      { e: '📈', n: 'IPCA',     v: BENCHMARKS.ipca.toFixed(2).replace('.',',') + '% a.a.',     s: 'Inflação' },
      { e: '🐷', n: 'Poupança', v: BENCHMARKS.poupanca.toFixed(2).replace('.',',') + '% a.a.', s: 'Poupança' },
    ].map(i => `
      <div class="indicador-card">
        <div class="indicador-emoji">${i.e}</div>
        <div class="indicador-nome">${escapeHTML(i.n)}</div>
        <div class="indicador-valor">${escapeHTML(i.v)}</div>
        <div class="indicador-sub">${escapeHTML(i.s)}</div>
      </div>`).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SIDEBAR ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function setupSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const dashMain = document.getElementById('dashMain');
  const btnCol   = document.getElementById('btnSidebarCollapse');
  const btnHamb  = document.getElementById('btnHamburger');
  const overlay  = document.getElementById('sidebarOverlay');

  if (localStorage.getItem('bud_sidebar_collapsed') === '1') {
    sidebar.classList.add('collapsed');
    dashMain.classList.add('sidebar-collapsed');
    if (btnCol) btnCol.textContent = '›';
  }

  if (btnCol) {
    btnCol.addEventListener('click', () => {
      const col = sidebar.classList.toggle('collapsed');
      dashMain.classList.toggle('sidebar-collapsed', col);
      btnCol.textContent = col ? '›' : '‹';
      localStorage.setItem('bud_sidebar_collapsed', col ? '1' : '0');
    });
  }
  if (btnHamb) {
    btnHamb.addEventListener('click', () => {
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

// ═══════════════════════════════════════════════════════════════════════════
// ── AUTH + INIT ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
_buildTipoDropdown();
_buildLiquidezDropdown();
setupSidebar();
window.setFiltro('');  // inicializa botão "Todos" ativo

onAuthStateChanged(auth, async user => {
  if (!user || !user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  // Sidebar user info
  const nome = user.displayName || '';
  const mat  = typeof window.budSanitize === 'function' ? window.budSanitize(user.email || '') : (user.email || '');
  document.getElementById('sidebarUserName').textContent = nome || 'Usuário';
  document.getElementById('sidebarUserId').textContent   = mat;
  document.getElementById('sidebarAvatar').textContent   = (nome[0] || '?').toUpperCase();

  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    if (_unsub) _unsub();
    await signOut(auth);
    window.location.href = 'index.html';
  });

  // Listener Firestore — BUG 7: orderBy + limit
  _unsub = onSnapshot(
    query(
      collection(db, 'usuarios', user.uid, 'investimentos'),
      orderBy('criadoEm', 'desc'),
      limit(500)
    ),
    snap => {
      investimentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      hideSplash();
      renderizar();
    },
    err => {
      (window.budError||console.error)('Erro no listener de investimentos:', err);
      hideSplash();
      showToast('Erro ao carregar investimentos.', 'erro');
    }
  );

  // Carrega mercado (sem forçar — usa cache se disponível)
  window.carregarMercado(false);
});
