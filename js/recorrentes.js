/**
 * js/recorrentes.js — Transações Recorrentes
 *
 * Bugs do cérebro corrigidos desde o início:
 * BUG 1 — proximaData NÃO recalculada ao editar se periodicidade/dia não mudaram
 * BUG 2 — Cloud Function: filtragem por plano (front-end gate + comentário na CF)
 * BUG 3 — calcPrimeiraData é distinta de calcProximaDataServer (nomes diferentes)
 *
 * Subcoleção: usuarios/{uid}/recorrentes
 * Integra com window.BUD_CATEGORIAS_PADRAO para emojis.
 * Feature gate: planos pro, plus, trial.
 */

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Estado ────────────────────────────────────────────────────────────────
let currentUser       = null;
let recorrentes       = [];          // array de {id, ...dados}
let tipoAtual         = 'despesa';   // tipo selecionado no modal
let categoriasCustom  = [];          // personalizadas do Firestore
let carteiraItems     = [];          // cartões de crédito do usuário (#8)
let valoresOcultos    = false;
let _unsubs           = [];
let _salvando         = false;       // guard anti-duplo-submit (#7)

// ─── Planos com acesso ──────────────────────────────────────────────────────
const PLANOS_PERMITIDOS = ['pro', 'plus', 'trial'];

// ─── Helpers de formato ────────────────────────────────────────────────────
const MESES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function formatBRL(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function formatarInputValor(input) {
  let raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  const num = parseInt(raw, 10);
  const reais   = Math.floor(num / 100);
  const centavos = num % 100;
  input.value = reais.toLocaleString('pt-BR') + ',' + String(centavos).padStart(2, '0');
}

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : ts.toDate();
  return d.getDate() + ' ' + MESES_CURTO[d.getMonth()];
}

// ─── Emojis por categoria ──────────────────────────────────────────────────
function emojiCategoria(nome, tipo) {
  if (!nome) return tipo === 'receita' ? '↑' : '↓';
  const todas = [
    ...(window.BUD_CATEGORIAS_PADRAO?.despesa || []),
    ...(window.BUD_CATEGORIAS_PADRAO?.receita || []),
    ...categoriasCustom,
  ];
  const found = todas.find(c => c.nome === nome);
  return found ? found.emoji : (tipo === 'receita' ? '💰' : '📦');
}

// ─── calcPrimeiraData (client-side) ────────────────────────────────────────
// Calcula a primeira data de vencimento ao CRIAR uma nova recorrente.
// Diferente do server-side que avança a partir da proximaData anterior.
function calcPrimeiraData(periodicidade, diaVencimento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (periodicidade === 'diaria') return hoje;
  if (periodicidade === 'semanal') return hoje;

  // mensal: calcula o próximo dia de vencimento a partir de hoje
  const dia = Math.min(Math.max(1, parseInt(diaVencimento, 10) || 1), 31);
  let ano  = hoje.getFullYear();
  let mes  = hoje.getMonth();

  // tentativa no mês atual
  const maxDia = new Date(ano, mes + 1, 0).getDate();
  const diaReal = Math.min(dia, maxDia);
  let candidata = new Date(ano, mes, diaReal);
  candidata.setHours(0, 0, 0, 0);

  // se já passou, avança um mês
  if (candidata < hoje) {
    mes++;
    if (mes > 11) { mes = 0; ano++; }
    const maxDia2 = new Date(ano, mes + 1, 0).getDate();
    candidata = new Date(ano, mes, Math.min(dia, maxDia2));
    candidata.setHours(0, 0, 0, 0);
  }

  return candidata;
}

// ─── Categorias: popular dropdown ─────────────────────────────────────────
function popularCategorias() {
  const padrao   = window.BUD_CATEGORIAS_PADRAO?.[tipoAtual] || [];
  const custom   = categoriasCustom.filter(c => c.tipo === tipoAtual);
  const todas    = [...padrao, ...custom].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const dropdown = document.getElementById('csCatDropdown');
  const hiddenInput = document.getElementById('recCategoria');
  if (!dropdown) return;

  dropdown.innerHTML = '';
  todas.forEach(c => {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option';
    opt.textContent = c.emoji + ' ' + c.nome;
    opt.dataset.value = c.nome;
    opt.addEventListener('click', () => {
      hiddenInput.value = c.nome;
      document.getElementById('csCatLabel').textContent = c.emoji + ' ' + c.nome;
      document.getElementById('csCatTrigger').classList.add('has-value');
      document.getElementById('csCatTrigger').classList.remove('error');
      fecharTodosDropdowns();
    });
    dropdown.appendChild(opt);
  });
}

// ─── Custom selects genérico ───────────────────────────────────────────────
const FORMAS_PAGAMENTO = [
  { value: 'PIX',             label: '⚡ PIX' },
  { value: 'Débito',          label: '💳 Débito' },
  { value: 'Crédito',         label: '💳 Crédito' },
  { value: 'Dinheiro',        label: '💵 Dinheiro' },
  { value: 'Transferência',   label: '🔄 Transferência' },
  { value: 'Débito automático', label: '🔁 Déb. automático' },
];

const PERIODICIDADES = [
  { value: 'mensal',  label: '📅 Mensal' },
  { value: 'semanal', label: '🗓️ Semanal' },
  { value: 'diaria',  label: '📆 Diária' },
];

function popularSelectSimples(triggerId, labelId, dropdownId, hiddenId, opcoes, valorAtual) {
  const dropdown = document.getElementById(dropdownId);
  const hidden   = document.getElementById(hiddenId);
  if (!dropdown) return;

  dropdown.innerHTML = '';
  opcoes.forEach(op => {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option' + (op.value === valorAtual ? ' selected' : '');
    opt.textContent = op.label;
    opt.dataset.value = op.value;
    opt.addEventListener('click', () => {
      hidden.value = op.value;
      document.getElementById(labelId).textContent = op.label;
      document.getElementById(triggerId).classList.add('has-value');
      fecharTodosDropdowns();
      // evento especial para periodicidade
      if (hiddenId === 'recPeriodo') toggleDiaVencimento();
      // evento especial para forma de pagamento (#8)
      if (hiddenId === 'recForma')   toggleFieldCartao();
    });
    dropdown.appendChild(opt);
  });

  // setar valor atual no label
  const found = opcoes.find(o => o.value === valorAtual);
  if (found) {
    document.getElementById(labelId).textContent = found.label;
    document.getElementById(triggerId).classList.add('has-value');
  }
}

function fecharTodosDropdowns() {
  document.querySelectorAll('.custom-select-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.custom-select-trigger.open').forEach(t => t.classList.remove('open'));
  document.querySelectorAll('.custom-select-trigger[aria-expanded="true"]')
    .forEach(t => t.setAttribute('aria-expanded', 'false'));
}

function setupDropdownTrigger(triggerId, dropdownId) {
  const trigger  = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    fecharTodosDropdowns();
    if (!isOpen) {
      dropdown.classList.add('open');
      trigger.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
}

// ─── toggleDiaVencimento ───────────────────────────────────────────────────
function toggleDiaVencimento() {
  const periodo = document.getElementById('recPeriodo')?.value;
  const field   = document.getElementById('fieldDiaVenc');
  if (!field) return;
  field.style.display = periodo === 'mensal' ? '' : 'none';
}

// ─── toggleFieldCartao (#8) ─────────────────────────────────────────────────
// Exibe/esconde o seletor de cartão quando forma = 'Crédito'.
function toggleFieldCartao() {
  const forma  = document.getElementById('recForma')?.value;
  const field  = document.getElementById('fieldCartao');
  if (!field) return;
  if (forma === 'Crédito') {
    field.style.display = '';
    popularCartaoDropdown(document.getElementById('recCartaoId').value);
  } else {
    field.style.display = 'none';
    document.getElementById('recCartaoId').value   = '';
    document.getElementById('recCartaoNome').value = '';
    const lbl = document.getElementById('csCartaoLabel');
    const trg = document.getElementById('csCartaoTrigger');
    if (lbl) lbl.textContent = 'Selecione o cartão…';
    if (trg) trg.classList.remove('has-value');
  }
}

// ─── popularCartaoDropdown (#8) ─────────────────────────────────────────────
function popularCartaoDropdown(valorAtual) {
  const dropdown  = document.getElementById('csCartaoDropdown');
  const hiddenId  = document.getElementById('recCartaoId');
  const hiddenNome = document.getElementById('recCartaoNome');
  if (!dropdown) return;

  dropdown.innerHTML = '';

  if (carteiraItems.length === 0) {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option';
    opt.textContent = 'Nenhum cartão cadastrado';
    opt.style.cssText = 'color:var(--text-sec);cursor:default;pointer-events:none;';
    dropdown.appendChild(opt);
    return;
  }

  carteiraItems.forEach(c => {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option' + (c.id === valorAtual ? ' selected' : '');
    opt.textContent = '\uD83D\uDCB3 ' + (c.nome || 'Cartão');
    opt.dataset.value = c.id;
    opt.addEventListener('click', () => {
      hiddenId.value   = c.id;
      hiddenNome.value = c.nome || '';
      document.getElementById('csCartaoLabel').textContent = '\uD83D\uDCB3 ' + (c.nome || 'Cartão');
      document.getElementById('csCartaoTrigger').classList.add('has-value');
      fecharTodosDropdowns();
    });
    dropdown.appendChild(opt);
  });

  // pré-selecionar valor atual no label
  if (valorAtual) {
    const found = carteiraItems.find(c => c.id === valorAtual);
    if (found) {
      document.getElementById('csCartaoLabel').textContent = '\uD83D\uDCB3 ' + (found.nome || 'Cartão');
      document.getElementById('csCartaoTrigger').classList.add('has-value');
    }
  }
}

// ─── Tipo (Receita / Despesa) ──────────────────────────────────────────────
window.recSetTipo = function(tipo) {
  tipoAtual = tipo;
  const btnD = document.getElementById('btnTipoDespesa');
  const btnR = document.getElementById('btnTipoReceita');
  if (!btnD || !btnR) return;

  if (tipo === 'despesa') {
    btnD.className = 'tipo-btn active-despesa';
    btnR.className = 'tipo-btn';
  } else {
    btnD.className = 'tipo-btn';
    btnR.className = 'tipo-btn active-receita';
  }

  // #13 fix: preserva categoria selecionada se ela ainda existe na nova lista
  const categoriaAtual = document.getElementById('recCategoria').value;
  popularCategorias(); // reconstrói dropdown para o novo tipo

  const novaLista = [
    ...(window.BUD_CATEGORIAS_PADRAO?.[tipo] || []),
    ...categoriasCustom.filter(c => c.tipo === tipo),
  ];
  const aindaExiste = categoriaAtual && novaLista.some(c => c.nome === categoriaAtual);
  if (!aindaExiste) {
    document.getElementById('recCategoria').value = '';
    document.getElementById('csCatLabel').textContent = 'Selecione…';
    document.getElementById('csCatTrigger').classList.remove('has-value', 'error');
  }
};

// ─── Modal Abrir/Fechar ────────────────────────────────────────────────────
function abrirModal(rec) {
  const isEditar = !!rec;

  document.getElementById('modalRecTitulo').textContent = isEditar ? 'Editar Recorrente' : 'Nova Recorrente';
  document.getElementById('recId').value            = isEditar ? rec.id : '';
  document.getElementById('recDescricao').value     = isEditar ? rec.descricao : '';
  document.getElementById('recDia').value           = isEditar ? (rec.diaVencimento || 1) : 1;

  // tipo
  window.recSetTipo(isEditar ? (rec.tipo || 'despesa') : 'despesa');

  // valor
  const valorInput = document.getElementById('recValor');
  if (isEditar && rec.valor) {
    const cents = Math.round(rec.valor * 100);
    const reais = Math.floor(cents / 100);
    const centsStr = String(cents % 100).padStart(2, '0');
    valorInput.value = reais.toLocaleString('pt-BR') + ',' + centsStr;
  } else {
    valorInput.value = '';
  }

  // forma de pagamento
  const formaVal = isEditar ? (rec.formaPagamento || '') : '';
  popularSelectSimples('csFormaTrigger', 'csFormaLabel', 'csFormaDropdown', 'recForma', FORMAS_PAGAMENTO, formaVal);
  document.getElementById('recForma').value = formaVal;
  if (!formaVal) {
    document.getElementById('csFormaLabel').textContent = 'Selecione…';
    document.getElementById('csFormaTrigger').classList.remove('has-value');
  }

  // periodicidade
  const periodoVal = isEditar ? (rec.periodicidade || 'mensal') : 'mensal';
  popularSelectSimples('csPeriodoTrigger', 'csPeriodoLabel', 'csPeriodoDropdown', 'recPeriodo', PERIODICIDADES, periodoVal);
  document.getElementById('recPeriodo').value = periodoVal;

  // cartão (#8): visível só quando forma = 'Crédito'
  const cartaoId = isEditar ? (rec.cartaoId || '') : '';
  document.getElementById('recCartaoId').value   = cartaoId;
  document.getElementById('recCartaoNome').value = isEditar ? (rec.cartaoNome || '') : '';
  toggleFieldCartao();
  if (cartaoId) popularCartaoDropdown(cartaoId);

  popularCategorias();
  if (isEditar && rec.categoria) {
    const emoji = emojiCategoria(rec.categoria, rec.tipo || 'despesa');
    document.getElementById('recCategoria').value = rec.categoria;
    document.getElementById('csCatLabel').textContent = emoji + ' ' + rec.categoria;
    document.getElementById('csCatTrigger').classList.add('has-value');
  } else {
    document.getElementById('recCategoria').value = '';
    document.getElementById('csCatLabel').textContent = 'Selecione…';
    document.getElementById('csCatTrigger').classList.remove('has-value');
  }

  toggleDiaVencimento();

  // limpar erros
  ['recDescricao','recValor'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });
  ['csCatTrigger','csFormaTrigger'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });

  document.getElementById('modalRec').classList.add('open');
}

function fecharModal() {
  document.getElementById('modalRec').classList.remove('open');
  fecharTodosDropdowns();
}

// ─── Salvar ────────────────────────────────────────────────────────────────
async function salvarRecorrente() {
  if (_salvando) return; // #7 guard anti-duplo-submit
  _salvando = true;

  const id          = document.getElementById('recId').value;
  const descricao   = window.budSanitize(document.getElementById('recDescricao').value.trim());
  const valorRaw    = parseBRL(document.getElementById('recValor').value);
  const categoria   = document.getElementById('recCategoria').value;
  const forma       = document.getElementById('recForma').value;
  const periodicidade = document.getElementById('recPeriodo').value;
  const diaVencimento = parseInt(document.getElementById('recDia').value, 10) || 1;
  const cartaoId    = document.getElementById('recCartaoId')?.value  || null;  // #8
  const cartaoNome  = document.getElementById('recCartaoNome')?.value || null; // #8

  // Validação
  let erros = false;
  if (!descricao) {
    document.getElementById('recDescricao').classList.add('error');
    erros = true;
  } else {
    document.getElementById('recDescricao').classList.remove('error');
  }
  if (!valorRaw || valorRaw <= 0) {
    document.getElementById('recValor').classList.add('error');
    erros = true;
  } else {
    document.getElementById('recValor').classList.remove('error');
  }
  if (!categoria) {
    document.getElementById('csCatTrigger').classList.add('error');
    erros = true;
  } else {
    document.getElementById('csCatTrigger').classList.remove('error');
  }
  if (erros) { _salvando = false; return; }

  const btn = document.getElementById('btnSalvarRec');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    const ref = collection(db, 'usuarios', currentUser.uid, 'recorrentes');

    if (id) {
      // ── EDITAR ──
      // BUG 1 FIX: só recalcula proximaData se periodicidade ou dia mudaram
      const recOriginal = recorrentes.find(r => r.id === id);
      const mudouPeriodo = !recOriginal ||
        recOriginal.periodicidade !== periodicidade ||
        recOriginal.diaVencimento !== diaVencimento;

      const dados = {
        descricao,
        tipo: tipoAtual,
        valor: valorRaw,
        categoria,
        formaPagamento: forma,
        cartaoId:   forma === 'Crédito' ? (cartaoId || null) : null,   // #8
        cartaoNome: forma === 'Crédito' ? (cartaoNome || null) : null, // #8
        periodicidade,
        diaVencimento,
        atualizadoEm: serverTimestamp(),
      };

      if (mudouPeriodo) {
        dados.proximaData = Timestamp.fromDate(calcPrimeiraData(periodicidade, diaVencimento));
      }
      // se não mudou periodicidade/dia, mantém a proximaData existente (não tocamos)

      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'recorrentes', id), dados);
    } else {
      // ── CRIAR ──
      const proximaData = calcPrimeiraData(periodicidade, diaVencimento);
      await addDoc(ref, {
        descricao,
        tipo: tipoAtual,
        valor: valorRaw,
        categoria,
        formaPagamento: forma,
        cartaoId:   forma === 'Crédito' ? (cartaoId || null) : null,   // #8
        cartaoNome: forma === 'Crédito' ? (cartaoNome || null) : null, // #8
        periodicidade,
        diaVencimento,
        proximaData: Timestamp.fromDate(proximaData),
        ativa: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
    }

    fecharModal();
    window.budShowToast(id ? 'Recorrente atualizada!' : 'Recorrente criada!', 'success');
  } catch (err) {
    (window.budError||console.error)('recorrentes/salvar:', err);
    window.budShowToast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Recorrente';
    _salvando = false; // #7
  }
}

// ─── Toggle ativo ─────────────────────────────────────────────────────────
async function toggleAtivo(id, novoValor) {
  try {
    await updateDoc(doc(db, 'usuarios', currentUser.uid, 'recorrentes', id), {
      ativa: novoValor,
      atualizadoEm: serverTimestamp(),
    });
  } catch (err) {
    (window.budError||console.error)('recorrentes/toggleAtivo:', err);
    window.budShowToast('Erro ao atualizar status.', 'error');
  }
}

// ─── Excluir ───────────────────────────────────────────────────────────────
function excluirRec(id) {
  // Overlay de confirmação via style.cssText (não usa Tailwind dinâmico — DEC-006)
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:90;display:flex;align-items:center;justify-content:center;padding:1rem;';

  const card = document.createElement('div');
  card.style.cssText = 'background:var(--bg-page);border:1px solid var(--card-border);border-radius:1.25rem;padding:1.75rem;max-width:380px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);animation:modal-in .2s ease;';

  card.innerHTML = `
    <div style="font-size:1.5rem;margin-bottom:0.75rem;">🗑️</div>
    <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">Excluir Recorrente?</div>
    <div style="font-size:0.875rem;font-weight:500;color:var(--text-sec);margin-bottom:1.5rem;">Os lançamentos já gerados no Extrato <strong>não serão removidos</strong>.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;">
      <button id="btnCancelExcl" style="padding:0.625rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text-sec);transition:background .15s;">Cancelar</button>
      <button id="btnConfExcl"  style="padding:0.625rem;border:none;border-radius:0.75rem;background:#dc2626;color:#fff;font-size:0.875rem;font-weight:800;cursor:pointer;font-family:inherit;transition:opacity .2s;">Excluir</button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('btnCancelExcl').onclick = () => overlay.remove();
  document.getElementById('btnConfExcl').onclick   = async () => {
    try {
      await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'recorrentes', id));
      window.budShowToast('Recorrente excluída.', 'success');
    } catch (err) {
      (window.budError||console.error)('recorrentes/excluir:', err);
      window.budShowToast('Erro ao excluir.', 'error');
    } finally {
      overlay.remove();
    }
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ─── Renderizar ────────────────────────────────────────────────────────────
function renderizar() {
  // Calcular resumo (só ativas)
  const ativas = recorrentes.filter(r => r.ativa !== false);
  let totalDesp = 0;
  let totalRec  = 0;

  ativas.forEach(r => {
    const mult = r.periodicidade === 'diaria' ? 30 : r.periodicidade === 'semanal' ? 4.3 : 1;
    if (r.tipo === 'despesa')  totalDesp += (r.valor || 0) * mult;
    else                       totalRec  += (r.valor || 0) * mult;
  });

  document.getElementById('cardAtivas').textContent   = ativas.length;
  document.getElementById('cardDespesas').textContent  = valoresOcultos ? '••••' : formatBRL(totalDesp);
  document.getElementById('cardReceitas').textContent  = valoresOcultos ? '••••' : formatBRL(totalRec);

  // Renderizar lista
  const lista = document.getElementById('listaRecorrentes');
  if (!lista) return;

  if (recorrentes.length === 0) {
    lista.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:3rem 1rem;';
    empty.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">🔄</div>
      <div style="font-size:0.9375rem;font-weight:700;color:var(--card-text);">Nenhuma recorrente ainda</div>
      <div style="font-size:0.8125rem;font-weight:500;color:var(--card-text-sec);margin-top:0.25rem;">Crie sua primeira recorrente para automatizar suas contas fixas.</div>
      <button onclick="window.recAbrirModal()" style="margin-top:1.25rem;padding:0.625rem 1.25rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;">+ Criar Primeira Recorrente</button>
    `;
    lista.appendChild(empty);
    return;
  }

  lista.innerHTML = '';
  const ordenadas = [...recorrentes].sort((a, b) =>
    (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR')
  );

  ordenadas.forEach((rec, idx) => {
    const isAtiva    = rec.ativa !== false;
    const emoji      = emojiCategoria(rec.categoria, rec.tipo);
    const badgeCls   = rec.periodicidade === 'semanal' ? 'rec-badge-semanal' : rec.periodicidade === 'diaria' ? 'rec-badge-diaria' : 'rec-badge-mensal';
    const badgeLabel = rec.periodicidade === 'semanal' ? 'Semanal' : rec.periodicidade === 'diaria' ? 'Diária' : 'Mensal';
    const valorLabel = valoresOcultos ? '••••' : (rec.tipo === 'receita' ? '+' : '-') + formatBRL(rec.valor || 0).replace('R$ ', 'R$ ');
    const proxData   = rec.proximaData ? 'Próximo: ' + formatarData(rec.proximaData) : '';

    const card = document.createElement('div');
    card.className = 'rec-card' + (isAtiva ? '' : ' inativa');
    card.style.cssText = `margin-bottom:0.625rem;animation:fadeInUp .3s ease both;animation-delay:${idx * 0.04}s;`;

    card.innerHTML = `
      <div class="rec-icon ${rec.tipo === 'receita' ? 'rec-icon-receita' : 'rec-icon-despesa'}">${emoji}</div>
      <div class="rec-body">
        <div class="rec-desc" title="${window.budSanitize(rec.descricao || '')}">${window.budSanitize(rec.descricao || '—')}</div>
        <div class="rec-meta">
          <span class="rec-badge ${badgeCls}">${badgeLabel}</span>
          ${rec.categoria ? `<span class="rec-cat">${window.budSanitize(rec.categoria)}</span>` : ''}
          ${proxData ? `<span class="rec-proxima">${proxData}</span>` : ''}
        </div>
      </div>
      <div class="rec-valor ${rec.tipo === 'receita' ? 'rec-valor-receita' : 'rec-valor-despesa'}">${valorLabel}</div>
      <div class="rec-actions">
        <label class="toggle-pill" title="${isAtiva ? 'Pausar' : 'Ativar'}">
          <input type="checkbox" ${isAtiva ? 'checked' : ''} data-id="${rec.id}">
          <div class="toggle-pill-track"></div>
          <div class="toggle-pill-thumb"></div>
        </label>
        <button class="action-btn" data-edit="${rec.id}" title="Editar">✏️</button>
        <button class="action-btn delete" data-del="${rec.id}" title="Excluir">🗑️</button>
      </div>
    `;

    // eventos
    card.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      toggleAtivo(rec.id, e.target.checked);
    });
    card.querySelector('[data-edit]').addEventListener('click', () => {
      abrirModal(rec);
    });
    card.querySelector('[data-del]').addEventListener('click', () => {
      excluirRec(rec.id);
    });

    lista.appendChild(card);
  });
}

// ─── Sidebar: comportamentos ───────────────────────────────────────────────
function setupSidebar() {
  const sidebar        = document.getElementById('sidebar');
  const dashMain       = document.getElementById('dashMain');
  const btnCollapse    = document.getElementById('btnSidebarCollapse');
  const btnHamburger   = document.getElementById('btnHamburger');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // estado collapse (desktop)
  const collapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (collapsed) {
    sidebar?.classList.add('collapsed');
    dashMain?.classList.add('sidebar-collapsed');
    if (btnCollapse) btnCollapse.textContent = '›';
  }

  btnCollapse?.addEventListener('click', () => {
    const isCollapsed = sidebar?.classList.toggle('collapsed');
    dashMain?.classList.toggle('sidebar-collapsed', isCollapsed);
    if (btnCollapse) btnCollapse.textContent = isCollapsed ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  });

  btnHamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('open');
  });
  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    _unsubs.forEach(u => u && u());
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ─── Auth & inicialização ──────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  _unsubs.forEach(u => u && u());
  _unsubs = [];

  if (!user || !user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }

  // reforça token fresco
  try { await user.getIdToken(true); } catch (_) { /* ignora */ }

  currentUser = user;

  // carrega dados do usuário
  let userData = {};
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    userData = snap.exists() ? snap.data() : {};
  } catch (err) {
    (window.budError||console.error)('recorrentes/userData:', err);
  }

  // avatar / nome
  const nome = window.budSanitize(userData.nome || user.displayName || 'Usuário');
  const matricula = window.budSanitize(userData.matricula || '---');
  const iniciais = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const elAvatar = document.getElementById('sidebarAvatar');
  const elNome   = document.getElementById('sidebarUserName');
  const elId     = document.getElementById('sidebarUserId');
  if (elAvatar) elAvatar.textContent = iniciais;
  if (elNome)   elNome.textContent   = nome;
  if (elId)     elId.textContent     = matricula;

  // feature gate: verificar plano
  const plano = (userData.plano || 'free').toLowerCase();
  const temAcesso = PLANOS_PERMITIDOS.includes(plano);

  const btnNova     = document.getElementById('btnNovaRec');
  const planGate    = document.getElementById('planGate');
  const mainContent = document.getElementById('mainContent');

  if (!temAcesso) {
    if (planGate)    planGate.style.display    = '';
    if (mainContent) mainContent.style.display = 'none';
    if (btnNova)     btnNova.style.display     = 'none';
    // esconde splash
    const splash = document.getElementById('splash');
    if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 500); }
    return;
  }

  if (planGate)    planGate.style.display    = 'none';
  if (mainContent) mainContent.style.display = '';

  // listener categorias custom
  const qCat = query(
    collection(db, 'usuarios', user.uid, 'categorias'),
    limit(200)
  );
  const unsubCat = onSnapshot(qCat, snap => {
    categoriasCustom = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, err => (window.budError||console.error)('recorrentes/categorias:', err));
  _unsubs.push(unsubCat);

  // listener carteira (#8): cartões de crédito do usuário
  const qCarteira = query(
    collection(db, 'usuarios', user.uid, 'carteira'),
    where('tipo', '==', 'credito'),
    limit(50)
  );
  const unsubCarteira = onSnapshot(qCarteira, snap => {
    carteiraItems = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, err => (window.budError||console.error)('recorrentes/carteira:', err));
  _unsubs.push(unsubCarteira);

  // listener recorrentes
  const qRec = query(
    collection(db, 'usuarios', user.uid, 'recorrentes'),
    orderBy('criadoEm', 'desc'),
    limit(500)
  );
  const unsubRec = onSnapshot(qRec, snap => {
    recorrentes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizar();
    // esconde splash após primeiro carregamento
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('hide')) {
      splash.classList.add('hide');
      setTimeout(() => splash.style.display = 'none', 500);
    }
  }, err => {
    (window.budError||console.error)('recorrentes/snapshot:', err);
    window.budShowToast('Erro ao carregar recorrentes.', 'error');
  });
  _unsubs.push(unsubRec);
});

// ─── keyframe fadeInUp ─────────────────────────────────────────────────────
(function injectFadeInUp() {
  if (document.getElementById('rec-keyframes')) return;
  const st = document.createElement('style');
  st.id = 'rec-keyframes';
  st.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}';
  document.head.appendChild(st);
})();

// ─── Bindings de UI ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();

  // Botão Nova Recorrente
  document.getElementById('btnNovaRec')?.addEventListener('click', () => abrirModal(null));

  // Fechar modal
  document.getElementById('btnFecharModalRec')?.addEventListener('click', fecharModal);
  document.getElementById('btnCancelarRec')?.addEventListener('click', fecharModal);
  document.getElementById('modalRec')?.addEventListener('click', e => {
    if (e.target.id === 'modalRec') fecharModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

  // Salvar
  document.getElementById('btnSalvarRec')?.addEventListener('click', salvarRecorrente);

  // Máscara BRL no valor
  document.getElementById('recValor')?.addEventListener('input', function() {
    formatarInputValor(this);
  });

  // Triggers dos custom selects
  setupDropdownTrigger('csCatTrigger',    'csCatDropdown');
  setupDropdownTrigger('csFormaTrigger',  'csFormaDropdown');
  setupDropdownTrigger('csPeriodoTrigger','csPeriodoDropdown');
  setupDropdownTrigger('csCartaoTrigger', 'csCartaoDropdown'); // #8

  // Popular selects estáticos
  popularSelectSimples('csFormaTrigger',  'csFormaLabel',  'csFormaDropdown',  'recForma',   FORMAS_PAGAMENTO, '');
  popularSelectSimples('csPeriodoTrigger','csPeriodoLabel','csPeriodoDropdown','recPeriodo',  PERIODICIDADES,   'mensal');

  // Fechar dropdowns ao clicar fora
  document.addEventListener('click', () => fecharTodosDropdowns());

  // Expor funções globais necessárias para onclick inline
  window.recAbrirModal = () => abrirModal(null);
});
