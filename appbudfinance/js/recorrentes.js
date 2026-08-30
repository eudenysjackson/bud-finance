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

import { initializeApp, getApps }    from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, getIdToken }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, orderBy, limit,
  onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { connectEmulators } from './bud-emulator-connect.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();
connectEmulators(auth, db);

// ─── Estado ────────────────────────────────────────────────────────────────
let currentUser       = null;
let recorrentes       = [];          // array de {id, ...dados}
let tipoAtual         = 'despesa';   // tipo selecionado no modal
let categoriasCustom  = [];          // personalizadas do Firestore
let carteiraItems     = [];          // contas e cartões do usuário
let valoresOcultos    = false;
let _unsubs           = [];
let _salvando         = false;       // guard anti-duplo-submit (#7)

let filtroTexto  = '';          // texto de busca livre
let filtroTipo   = 'todos';     // 'todos' | 'despesa' | 'receita'
let filtroStatus = 'todas';     // 'todas' | 'ativas' | 'pausadas'
let filtroOrdem  = 'nome';      // 'nome' | 'valor' | 'proxima'

// ─── Planos com acesso ──────────────────────────────────────────────────────
const PLANOS_PERMITIDOS = ['pro', 'plus', 'trial'];

// ─── Helpers de formato ────────────────────────────────────────────────────
const MESES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function formatBRL(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(s) {
  if (!s) return null;
  const raw = String(s).replace(/R\$|\s/g, '');
  const normalizado = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalizado);
  return isNaN(n) ? null : n;
}

function formatarInputValor(input) {
  const num = parseBRL(input.value);
  if (!Number.isFinite(num)) return;
  input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ─── popularContaDropdown ────────────────────────────────────────────────────
// Preenche o dropdown de Conta/Cartão com as contas e cartões do usuário.
function popularContaDropdown(valorAtualId) {
  const dropdown  = document.getElementById('csContaDropdown');
  const hiddenId  = document.getElementById('recContaId');
  const hiddenNome = document.getElementById('recContaNome');
  const hiddenTipo = document.getElementById('recContaTipo');
  if (!dropdown) return;

  dropdown.innerHTML = '';

  if (carteiraItems.length === 0) {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option';
    opt.textContent = 'Nenhuma conta cadastrada';
    opt.style.cssText = 'color:var(--text-sec);cursor:default;pointer-events:none;';
    dropdown.appendChild(opt);
    return;
  }

  const iconeTipo = { corrente:'🏦', poupanca:'💰', investimento:'📈', dinheiro:'💵', credito:'💳' };

  const addGrupo = (items, rotulo) => {
    if (items.length === 0) return;
    const sep = document.createElement('div');
    sep.style.cssText = 'padding:0.25rem 0.875rem;font-size:0.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--card-text-sec);background:var(--input-bg);pointer-events:none;';
    sep.textContent = rotulo;
    dropdown.appendChild(sep);
    items.forEach(c => {
      const icone = iconeTipo[c.tipo] || '🏦';
      const opt = document.createElement('div');
      opt.className = 'custom-select-option' + (c.id === valorAtualId ? ' selected' : '');
      opt.textContent = icone + ' ' + (c.nome || 'Conta');
      opt.dataset.value = c.id;
      opt.addEventListener('click', () => {
        hiddenId.value   = c.id;
        hiddenNome.value = c.nome || '';
        hiddenTipo.value = c.tipo || '';
        document.getElementById('csContaLabel').textContent = icone + ' ' + (c.nome || 'Conta');
        document.getElementById('csContaTrigger').classList.add('has-value');
        document.getElementById('csContaTrigger').classList.remove('error');
        fecharTodosDropdowns();
      });
      dropdown.appendChild(opt);
    });
  };

  addGrupo(carteiraItems.filter(c => c.tipo !== 'credito'), 'Contas');
  addGrupo(carteiraItems.filter(c => c.tipo === 'credito'),  'Cartões de Crédito');

  // pré-selecionar valor atual no label
  if (valorAtualId) {
    const found = carteiraItems.find(c => c.id === valorAtualId);
    if (found) {
      const icone = iconeTipo[found.tipo] || '🏦';
      document.getElementById('csContaLabel').textContent = icone + ' ' + (found.nome || 'Conta');
      document.getElementById('csContaTrigger').classList.add('has-value');
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
function abrirModal(rec, isDuplicar = false) {
  const isEditar  = !!(rec && rec.id);
  const isPopular = isEditar || isDuplicar; // preenche campos ao editar OU ao duplicar
  const titulo = isDuplicar ? 'Duplicar Recorrente' : (isEditar ? 'Editar Recorrente' : 'Nova Recorrente');
  document.getElementById('modalRecTitulo').textContent = titulo;
  document.getElementById('recId').value            = isEditar ? rec.id : ''; // ID vazio ao duplicar (nova entrada)
  document.getElementById('recDescricao').value     = isPopular ? rec.descricao : '';
  document.getElementById('recDia').value           = isPopular ? (rec.diaVencimento || 1) : 1;

  // tipo
  window.recSetTipo(isPopular ? (rec.tipo || 'despesa') : 'despesa');

  // valor
  const valorInput = document.getElementById('recValor');
  if (isPopular && rec.valor) {
    const cents = Math.round(rec.valor * 100);
    const reais = Math.floor(cents / 100);
    const centsStr = String(cents % 100).padStart(2, '0');
    valorInput.value = reais.toLocaleString('pt-BR') + ',' + centsStr;
  } else {
    valorInput.value = '';
  }

  // conta / cartão
  const contaId = isPopular ? (rec.contaId || rec.cartaoId || '') : '';
  document.getElementById('recContaId').value   = contaId;
  document.getElementById('recContaNome').value = isPopular ? (rec.contaNome || rec.cartaoNome || '') : '';
  document.getElementById('recContaTipo').value = isPopular ? (rec.contaTipo || (rec.cartaoId && !rec.contaId ? 'credito' : '')) : '';
  if (!contaId) {
    document.getElementById('csContaLabel').textContent = 'Selecione…';
    document.getElementById('csContaTrigger').classList.remove('has-value');
  }
  popularContaDropdown(contaId);

  // periodicidade
  const periodoVal = isPopular ? (rec.periodicidade || 'mensal') : 'mensal';
  popularSelectSimples('csPeriodoTrigger', 'csPeriodoLabel', 'csPeriodoDropdown', 'recPeriodo', PERIODICIDADES, periodoVal);
  document.getElementById('recPeriodo').value = periodoVal;

  popularCategorias();
  if (isPopular && rec.categoria) {
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

  // observação
  const elObs = document.getElementById('recObservacao');
  if (elObs) elObs.value = rec ? (rec.observacao || '') : '';

  // limpar erros
  ['recDescricao','recValor'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });
  document.getElementById('csCatTrigger')?.classList.remove('error');
  document.getElementById('csContaTrigger')?.classList.remove('error');

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
  const periodicidade = document.getElementById('recPeriodo').value;
  const diaVencimento = Math.min(31, Math.max(1, parseInt(document.getElementById('recDia').value, 10) || 1));
  const contaId     = document.getElementById('recContaId')?.value   || null;
  const contaNome   = document.getElementById('recContaNome')?.value  || null;
  const contaTipo   = document.getElementById('recContaTipo')?.value  || null;
  const observacao  = document.getElementById('recObservacao')
    ? (window.budSanitize(document.getElementById('recObservacao').value.trim()) || null)
    : null;

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
        contaId,
        contaNome,
        contaTipo,
        cartaoId:   contaTipo === 'credito' ? contaId   : null,
        cartaoNome: contaTipo === 'credito' ? contaNome : null,
        periodicidade,
        diaVencimento,
        observacao,
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
        contaId,
        contaNome,
        contaTipo,
        cartaoId:   contaTipo === 'credito' ? contaId   : null,
        cartaoNome: contaTipo === 'credito' ? contaNome : null,
        periodicidade,
        diaVencimento,
        observacao,
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
async function toggleAtivo(id, novoValor, checkbox) {
  try {
    await updateDoc(doc(db, 'usuarios', currentUser.uid, 'recorrentes', id), {
      ativa: novoValor,
      atualizadoEm: serverTimestamp(),
    });
  } catch (err) {
    if (checkbox) checkbox.checked = !novoValor; // reverte estado visual
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

  const saldo = totalRec - totalDesp;
  const elSaldo = document.getElementById('cardSaldo');
  if (elSaldo) {
    elSaldo.textContent  = valoresOcultos ? '••••' : formatBRL(Math.abs(saldo));
    elSaldo.style.color  = saldo >= 0 ? '#16a34a' : '#dc2626';
  }
  const elSaldoSub = document.getElementById('cardSaldoSub');
  if (elSaldoSub) elSaldoSub.textContent = saldo >= 0 ? 'saldo positivo mensal' : 'déficit mensal';

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

  // Aplicar filtros
  let filtradas = [...recorrentes];
  if (filtroTexto) {
    const t = filtroTexto.toLowerCase();
    filtradas = filtradas.filter(r =>
      (r.descricao || '').toLowerCase().includes(t) ||
      (r.categoria || '').toLowerCase().includes(t)
    );
  }
  if (filtroTipo !== 'todos') filtradas = filtradas.filter(r => r.tipo === filtroTipo);
  if (filtroStatus === 'ativas')   filtradas = filtradas.filter(r => r.ativa !== false);
  else if (filtroStatus === 'pausadas') filtradas = filtradas.filter(r => r.ativa === false);

  // Atualizar contador
  const elContagem = document.getElementById('recContagem');
  if (elContagem) {
    const total = recorrentes.length;
    const mostrando = filtradas.length;
    elContagem.textContent = mostrando < total
      ? mostrando + ' de ' + total
      : total + ' recorrente' + (total !== 1 ? 's' : '');
  }

  // Calcular "hoje" para urgência
  const hojeRef = new Date(); hojeRef.setHours(0, 0, 0, 0);

  // Ordenar
  const ordenadas = [...filtradas].sort((a, b) => {
    if (filtroOrdem === 'valor')   return (b.valor || 0) - (a.valor || 0);
    if (filtroOrdem === 'proxima') {
      const toDate = x => x ? (x.toDate ? x.toDate() : new Date(x)) : new Date(9999, 0);
      return toDate(a.proximaData) - toDate(b.proximaData);
    }
    return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR');
  });

  if (ordenadas.length === 0 && recorrentes.length > 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:2rem 1rem;';
    empty.innerHTML = '<div style="font-size:1.5rem;margin-bottom:0.5rem;">🔍</div><div style="font-size:0.875rem;font-weight:700;color:var(--card-text);">Nenhum resultado encontrado</div><div style="font-size:0.8125rem;color:var(--card-text-sec);margin-top:0.25rem;">Tente mudar os filtros ou a busca.</div>';
    lista.appendChild(empty);
    return;
  }

  ordenadas.forEach((rec, idx) => {
    const isAtiva    = rec.ativa !== false;
    const emoji      = emojiCategoria(rec.categoria, rec.tipo);
    const badgeCls   = rec.periodicidade === 'semanal' ? 'rec-badge-semanal' : rec.periodicidade === 'diaria' ? 'rec-badge-diaria' : 'rec-badge-mensal';
    const badgeLabel = rec.periodicidade === 'semanal' ? 'Semanal' : rec.periodicidade === 'diaria' ? 'Diária' : 'Mensal';
    const valorLabel = valoresOcultos ? '••••' : (rec.tipo === 'receita' ? '+' : '-') + formatBRL(rec.valor || 0).replace('R$ ', 'R$ ');
    const proxData   = rec.proximaData ? 'Próximo: ' + formatarData(rec.proximaData) : '';

    // Urgente: vencimento em ≤ 3 dias
    const proxDate = rec.proximaData ? (rec.proximaData.toDate ? rec.proximaData.toDate() : new Date(rec.proximaData)) : null;
    let diasAteVenc = null;
    if (proxDate) { const d = new Date(proxDate); d.setHours(0,0,0,0); diasAteVenc = Math.ceil((d - hojeRef) / 86400000); }
    const isUrgente = isAtiva && diasAteVenc !== null && diasAteVenc >= 0 && diasAteVenc <= 3;

    const card = document.createElement('div');
    card.className = 'rec-card' + (isAtiva ? '' : ' inativa');
    card.style.cssText = `margin-bottom:0.625rem;animation:fadeInUp .3s ease both;animation-delay:${idx * 0.04}s;`;
    if (isUrgente) card.classList.add('rec-card-urgente');

    const safeTitle  = window.budSanitize(rec.descricao || '').replace(/"/g, '&quot;');
    const _iconeTipo = { corrente:'🏦', poupanca:'💰', investimento:'📈', dinheiro:'💵', credito:'💳' };
    const _ctNome = rec.contaNome || rec.cartaoNome || null;
    const _ctTipo = rec.contaTipo || (rec.cartaoId ? 'credito' : null);
    const formaLabel = _ctNome
      ? `${_iconeTipo[_ctTipo] || '🏦'} ${window.budSanitize(_ctNome)}`
      : (rec.formaPagamento ? window.budSanitize(rec.formaPagamento) : '');
    const safeObs = rec.observacao ? window.budSanitize(rec.observacao) : '';
    const urgBadge = isUrgente
      ? `<span class="rec-badge" style="background:#fef3c7;color:#b45309;">⚠️ ${diasAteVenc === 0 ? 'hoje' : diasAteVenc === 1 ? 'amanhã' : diasAteVenc + ' dias'}</span>`
      : '';

    card.innerHTML = `
      <div class="rec-icon ${rec.tipo === 'receita' ? 'rec-icon-receita' : 'rec-icon-despesa'}">${emoji}</div>
      <div class="rec-body">
        <div class="rec-desc" title="${safeTitle}">${window.budSanitize(rec.descricao || '—')}</div>
        <div class="rec-meta">
          <span class="rec-badge ${badgeCls}">${badgeLabel}</span>
          ${!isAtiva ? `<span class="rec-badge" style="background:#fef9c3;color:#a16207;">Pausada</span>` : ''}
          ${urgBadge}
          ${rec.categoria ? `<span class="rec-cat">${window.budSanitize(rec.categoria)}</span>` : ''}
          ${formaLabel ? `<span class="rec-cat">${formaLabel}</span>` : ''}
          ${proxData ? `<span class="rec-proxima">${proxData}</span>` : ''}
          ${safeObs ? `<span class="rec-cat" title="${safeObs.replace(/"/g,'&quot;')}" style="font-style:italic;">📝 ${safeObs.length > 28 ? safeObs.slice(0,28)+'…' : safeObs}</span>` : ''}
        </div>
      </div>
      <div class="rec-valor ${rec.tipo === 'receita' ? 'rec-valor-receita' : 'rec-valor-despesa'}">${valorLabel}</div>
      <div class="rec-actions">
        <label class="toggle-pill" title="${isAtiva ? 'Pausar' : 'Ativar'}">
          <input type="checkbox" ${isAtiva ? 'checked' : ''} data-id="${rec.id}">
          <div class="toggle-pill-track"></div>
          <div class="toggle-pill-thumb"></div>
        </label>
        <button class="action-btn" data-dup="${rec.id}" title="Duplicar">📋</button>
        <button class="action-btn" data-edit="${rec.id}" title="Editar">✏️</button>
        <button class="action-btn delete" data-del="${rec.id}" title="Excluir">🗑️</button>
      </div>
    `;

    // eventos
    card.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      toggleAtivo(rec.id, e.target.checked, e.target);
    });
    card.querySelector('[data-dup]').addEventListener('click', () => {
      duplicarRec(rec);
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

// ─── Duplicar ────────────────────────────────────────────────────────────────
function duplicarRec(rec) {
  abrirModal({ ...rec, id: '' }, true);
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

  if (user) {
    try { await user.reload(); user = auth.currentUser; } catch (_) { user = null; }
  }
  if (!user || !user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }

  // reforça token fresco
  try { await user.getIdToken(); } catch (_) { /* ignora */ } // usa cache; Firebase renova quando expirado

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
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(userData.photoURL || null, userData.nome || user.displayName || '');

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

  // listener carteira: todas as contas e cartões do usuário
  const qCarteira = query(
    collection(db, 'usuarios', user.uid, 'carteira'),
    limit(100)
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

// ─── Processar recorrentes de hoje ────────────────────────────────────────
const BUD_BACKEND_URL = window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com';

async function processarHoje() {
  if (!currentUser) return;

  const btn = document.getElementById('btnProcessarHoje');
  const status = document.getElementById('processingStatus');

  if (btn) { btn.disabled = true; btn.querySelector('span:last-child').textContent = 'Processando…'; }
  if (status) { status.style.display = 'none'; }

  try {
    const token = await getIdToken(currentUser, /* forceRefresh= */ false);
    const resp = await fetch(BUD_BACKEND_URL + '/api/processar-recorrentes', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'Erro desconhecido');
    }

    if (status) {
      const cor = data.processadas > 0 ? '#16a34a' : '#64748b';
      const bg  = data.processadas > 0 ? '#f0fdf4' : '#f8fafc';
      const bd  = data.processadas > 0 ? '#bbf7d0' : '#e2e8f0';
      status.style.cssText = `display:block;background:${bg};border:1px solid ${bd};color:${cor};padding:0.625rem 1rem;border-radius:0.75rem;font-size:0.8125rem;font-weight:600;margin-bottom:1.25rem;`;
      status.textContent = data.processadas > 0
        ? '✓ ' + data.mensagem
        : 'ℹ️ ' + data.mensagem;
    }

    if (data.processadas > 0 && window.budSuccess) {
      window.budSuccess(data.mensagem);
    }

  } catch (err) {
    if (status) {
      status.style.cssText = 'display:block;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.625rem 1rem;border-radius:0.75rem;font-size:0.8125rem;font-weight:600;margin-bottom:1.25rem;';
      status.textContent = '⚠ ' + (err.message || 'Erro ao processar recorrentes.');
    }
    (window.budError || console.error)('processarHoje:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('span:last-child').textContent = 'Processar Hoje'; }
  }
}

// ─── Bindings de UI ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();

  // Botão Nova Recorrente
  document.getElementById('btnNovaRec')?.addEventListener('click', () => abrirModal(null));

  // Botão Processar Hoje
  document.getElementById('btnProcessarHoje')?.addEventListener('click', processarHoje);

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
  document.getElementById('recValor')?.addEventListener('blur', function() {
    formatarInputValor(this);
  });

  // Triggers dos custom selects
  setupDropdownTrigger('csCatTrigger',    'csCatDropdown');
  setupDropdownTrigger('csContaTrigger',  'csContaDropdown');
  setupDropdownTrigger('csPeriodoTrigger','csPeriodoDropdown');

  // Popular selects estáticos
  popularSelectSimples('csPeriodoTrigger','csPeriodoLabel','csPeriodoDropdown','recPeriodo', PERIODICIDADES, 'mensal');

  // Fechar dropdowns ao clicar fora
  document.addEventListener('click', () => fecharTodosDropdowns());

  // Expor funções globais necessárias para onclick inline
  window.recAbrirModal = () => abrirModal(null);

  // Filtro de busca
  document.getElementById('recBusca')?.addEventListener('input', e => {
    filtroTexto = e.target.value;
    renderizar();
  });

  // Chips de filtro
  window.recFiltroTipo = (tipo) => {
    filtroTipo = tipo;
    document.querySelectorAll('[id^="rct-"]').forEach(b => b.classList.toggle('active', b.id === 'rct-' + tipo));
    renderizar();
  };
  window.recFiltroStatus = (status) => {
    filtroStatus = status;
    document.querySelectorAll('[id^="rcs-"]').forEach(b => b.classList.toggle('active', b.id === 'rcs-' + status));
    renderizar();
  };
  window.recOrdem = (ordem) => {
    filtroOrdem = ordem;
    document.querySelectorAll('[id^="rco-"]').forEach(b => b.classList.toggle('active', b.id === 'rco-' + ordem));
    renderizar();
  };
});
