/**
 * js/extrato.js — Extrato Completo
 *
 * Bugs do cérebro corrigidos desde o início:
 * BUG 1  — overlay estático no HTML (não usa Tailwind dinâmico)
 * BUG 2  — query server-side por mês via where("data", >=/<= Timestamps) — fim do limit(5000)
 * BUG 3  — usa window.BUD_CATEGORIAS_PADRAO (não lista local)
 * BUG 4  — resumo separa receitas e despesas corretamente (sem campo `pago` no MVP)
 * BUG 5  — parse robusto do valor BRL via regex
 * BUG 7  — getAnoMes / formatadores no escopo do módulo
 * BUG 9  — sem estiloCategorias morto
 * BUG 10 — flag _dadosCarregados para evitar render duplo
 * BUG 11 — debounce 200ms na busca
 * BUG 13 — PDF via iframe (sem popup)
 * BUG 14 — emoji via BUD_CATEGORIAS_PADRAO
 *
 * Modelo de dados atual (salvo pelo dashboard.js):
 *   { descricao, valor, categoria, data: Timestamp, tipo, dataCriacao: Timestamp }
 */

import { initializeApp, getApps }    from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, where, orderBy,
  onSnapshot, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ────────────────────────────────────────────────────────────────
let usuarioAtualId     = null;
let transacoesGlobais  = [];   // transações do mês atual
let transacoesMesAnterior = []; // transações do mês anterior (para variação)
let categoriasCustom   = [];   // personalizadas do Firestore
let dataFiltro         = new Date();   // mês/ano exibido
let filtroTipo         = 'todos';      // 'todos'|'receita'|'despesa'
let catFiltroAtual     = '';           // nome da categoria ('' = todas)
let buscaQuery         = '';           // texto da busca
let valoresOcultos     = false;
let modoFiltro         = 'mes';        // 'mes' | 'intervalo'
let filtroDataInicio   = null;         // Date — início do intervalo
let filtroDataFim      = null;         // Date — fim do intervalo
let _unsubCategorias   = null;
let _unsubTransacoes   = null;
let _unsubMesAnt       = null;
let _excluirId         = null;         // id da transação a excluir
let _buscaTimer        = null;         // debounce
let _txPaginaSize      = 50;           // transações exibidas por vez (paginação)

// Datepicker do modal de edição
let _dpMes = new Date().getMonth();
let _dpAno = new Date().getFullYear();
let _dpDataSelecionada = '';

// Flag para evitar render duplo (BUG 10)
let _dadosCarregados = { categorias: false, transacoes: false, mesAnterior: false };

// ─── Helpers de variação ─────────────────────────────────────────────────────
function calcVariacao(atual, anterior) {
  if (anterior === 0 && atual === 0) return null;
  if (anterior === 0) return null; // sem base de comparação
  return ((atual - anterior) / anterior) * 100;
}

function renderBadge(elId, pct, inversao) {
  // inversao=true: queda é positiva (ex: despesas)
  const el = document.getElementById(elId);
  if (!el || pct === null) { if (el) el.style.display = 'none'; return; }
  const sobe = pct > 0;
  const positivo = inversao ? !sobe : sobe;
  el.className = 'card-badge ' + (positivo ? 'card-badge-up' : pct === 0 ? 'card-badge-neutral' : 'card-badge-down');
  el.textContent = (sobe ? '▲ +' : '▼ ') + Math.abs(pct).toFixed(1) + '% vs mês ant.';
  el.style.display = 'inline-flex';
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA_PT = ['domingo','segunda-feira','terça-feira','quarta-feira',
                        'quinta-feira','sexta-feira','sábado'];

function fmtBRL(v) {
  if (valoresOcultos) return '••••••';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** BUG 7 — fora do render, aceita apenas Timestamp do Firestore */
function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

function formatDataLabel(date) {
  if (!date) return '—';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function formatDataLonga(date) {
  if (!date) return '—';
  return `${DIAS_SEMANA_PT[date.getDay()]}, ${date.getDate()} de ${MESES_PT[date.getMonth()].toLowerCase()}`;
}

/** BUG 14 — emoji via BUD_CATEGORIAS_PADRAO + personalizadas */
function getEmoji(nome) {
  if (window.BUD_CATEGORIAS_PADRAO) {
    const padrao = [...(window.BUD_CATEGORIAS_PADRAO.despesa || []),
                   ...(window.BUD_CATEGORIAS_PADRAO.receita || [])];
    const found = padrao.find(c => c.nome === nome);
    if (found && found.emoji) return found.emoji;
  }
  const custom = categoriasCustom.find(c => c.nome === nome);
  if (custom && custom.emoji) return custom.emoji;
  return '📦';
}

/** BUG 5 — parse robusto do valor BRL */
function parseBRL(str) {
  const clean = String(str)
    .replace(/[^\d,.-]/g, '')   // remove tudo menos dígito, vírgula, ponto, menos
    .replace(/\./g, '')          // remove pontos (milhar BR)
    .replace(',', '.');          // vírgula → ponto decimal
  const v = parseFloat(clean);
  return isNaN(v) || v < 0 ? null : v;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Atualizar textos de data ───────────────────────────────────────────────
function atualizarTextosData() {
  const label = `${MESES_PT[dataFiltro.getMonth()]} de ${dataFiltro.getFullYear()}`;
  const el = document.getElementById('navMesAno');
  if (el) el.textContent = label;
  const hd = document.getElementById('headerData');
  if (hd) {
    const hoje = new Date();
    const mesAno = `${MESES_PT[hoje.getMonth()].toLowerCase()} de ${hoje.getFullYear()}`;
    hd.textContent = `${DIAS_SEMANA_PT[hoje.getDay()]}, ${hoje.getDate()} de ${mesAno}`;
  }
}

// ─── Navegar mês ───────────────────────────────────────────────────────────
window.mudarMes = function(dir) {
  if (modoFiltro !== 'mes') return;
  dataFiltro = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + dir, 1);
  _txPaginaSize = 50;
  atualizarTextosData();
  if (usuarioAtualId) subscribeTransacoes(usuarioAtualId);
};

window.irParaHoje = function() {
  if (modoFiltro === 'intervalo') {
    limparIntervalo();
    return;
  }
  const hoje = new Date();
  if (dataFiltro.getFullYear() === hoje.getFullYear() && dataFiltro.getMonth() === hoje.getMonth()) return;
  dataFiltro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  _txPaginaSize = 50;
  atualizarTextosData();
  if (usuarioAtualId) subscribeTransacoes(usuarioAtualId);
};

// ─── Modo Intervalo ────────────────────────────────────────────────────────
window.ativarModoIntervalo = function() {
  const mesNav = document.getElementById('mesNavBar');
  const bar = document.getElementById('intervaloBar');
  if (mesNav) mesNav.style.display = 'none';
  if (bar) bar.style.display = 'flex';
  // Preencher inputs com o mês atual como default
  const ini = document.getElementById('filtroDataInicio');
  const fim = document.getElementById('filtroDataFim');
  if (ini && !ini.value) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), 1);
    ini.value = d.toISOString().slice(0, 10);
  }
  if (fim && !fim.value) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 0);
    fim.value = d.toISOString().slice(0, 10);
  }
};

window.aplicarIntervalo = function() {
  const iniStr = document.getElementById('filtroDataInicio')?.value;
  const fimStr = document.getElementById('filtroDataFim')?.value;
  if (!iniStr || !fimStr) {
    if (window.budShowToast) window.budShowToast('Selecione data de início e fim.', 'warning');
    return;
  }
  const ini = new Date(iniStr + 'T00:00:00');
  const fim = new Date(fimStr + 'T23:59:59');
  if (ini > fim) {
    if (window.budShowToast) window.budShowToast('A data de início deve ser anterior à data de fim.', 'warning');
    return;
  }
  modoFiltro = 'intervalo';
  filtroDataInicio = ini;
  filtroDataFim = fim;
  const lbl = document.getElementById('labelIntervalo');
  if (lbl) lbl.textContent = `📅 ${iniStr.split('-').reverse().join('/')} → ${fimStr.split('-').reverse().join('/')}`;
  _txPaginaSize = 50;
  if (usuarioAtualId) subscribeTransacoes(usuarioAtualId);
};

window.limparIntervalo = function() {
  modoFiltro = 'mes';
  filtroDataInicio = null;
  filtroDataFim = null;
  const mesNav = document.getElementById('mesNavBar');
  const bar = document.getElementById('intervaloBar');
  if (mesNav) mesNav.style.display = '';
  if (bar) bar.style.display = 'none';
  const lbl = document.getElementById('labelIntervalo');
  if (lbl) lbl.textContent = '';
  _txPaginaSize = 50;
  if (usuarioAtualId) subscribeTransacoes(usuarioAtualId);
};

// ─── Toggle valores ocultos ────────────────────────────────────────────────
window.toggleValues = function() {
  valoresOcultos = !valoresOcultos;
  const btn = document.getElementById('btnToggleValues');
  if (btn) btn.textContent = valoresOcultos ? '🙈' : '👁️';
  renderizarExtrato();
};

// ─── Filtro tipo (pills) ───────────────────────────────────────────────────
window.setFiltroTipo = function(tipo) {
  filtroTipo = tipo;
  document.getElementById('pillTodos')?.classList.toggle('active-todos', tipo === 'todos');
  document.getElementById('pillReceita')?.classList.toggle('active-receita', tipo === 'receita');
  document.getElementById('pillDespesa')?.classList.toggle('active-despesa', tipo === 'despesa');
  ['pillTodos','pillReceita','pillDespesa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const isActive = el.classList.contains('active-todos') ||
                       el.classList.contains('active-receita') ||
                       el.classList.contains('active-despesa');
      if (!isActive) el.className = 'filter-pill';
    }
  });
  _txPaginaSize = 50;
  renderizarExtrato();
};

// ─── Busca (BUG 11 — debounce) ────────────────────────────────────────────
window.onBuscaInput = function() {
  clearTimeout(_buscaTimer);
  _buscaTimer = setTimeout(() => {
    buscaQuery = (document.getElementById('inputBusca')?.value || '').toLowerCase().trim();
    _txPaginaSize = 50;
    renderizarExtrato();
  }, 200);
};

// ─── Filtro categoria ──────────────────────────────────────────────────────
window.toggleCatFiltro = function() {
  const dd = document.getElementById('catFiltroDropdown');
  const btn = document.getElementById('btnCatFiltro');
  if (!dd) return;
  const open = dd.classList.contains('open');
  // Fechar todos os dropdowns
  document.querySelectorAll('.cat-filter-dropdown.open, .export-dropdown.open').forEach(el => el.classList.remove('open'));
  if (!open) {
    dd.classList.add('open');
    btn?.classList.add('open');
  } else {
    btn?.classList.remove('open');
  }
};

window.setCatFiltro = function(valor, label) {
  catFiltroAtual = valor;
  const lbl = document.getElementById('catFiltroLabel');
  if (lbl) lbl.textContent = label || 'Categoria';
  const btn = document.getElementById('btnCatFiltro');
  if (btn) btn.classList.toggle('has-value', !!valor);
  document.querySelectorAll('#catFiltroDropdown .cat-filter-option').forEach(o => {
    o.classList.toggle('selected', (o.dataset.valor || '') === valor);
  });
  document.getElementById('catFiltroDropdown')?.classList.remove('open');
  btn?.classList.remove('open');
  _txPaginaSize = 50;
  renderizarExtrato();
};

function popularCatFiltroDropdown() {
  const dd = document.getElementById('catFiltroDropdown');
  if (!dd) return;
  // Categorias usadas no mês atual
  const usadas = [...new Set(transacoesGlobais.map(t => t.categoria).filter(Boolean))].sort();
  dd.innerHTML = `<div class="cat-filter-option${catFiltroAtual === '' ? ' selected' : ''}" data-valor="" onclick="setCatFiltro('','Categoria')">Todas</div>`;
  usadas.forEach(nome => {
    const emoji = getEmoji(nome);
    const isSelected = catFiltroAtual === nome;
    const div = document.createElement('div');
    div.className = 'cat-filter-option' + (isSelected ? ' selected' : '');
    div.setAttribute('data-valor', nome);
    div.textContent = emoji + ' ' + nome;
    div.addEventListener('click', function() { setCatFiltro(nome, emoji + ' ' + nome); });
    dd.appendChild(div);
  });
}

// ─── Export dropdown ───────────────────────────────────────────────────────
window.toggleExportDD = function() {
  const dd = document.getElementById('exportDropdown');
  if (!dd) return;
  const open = dd.classList.contains('open');
  document.querySelectorAll('.cat-filter-dropdown.open, .export-dropdown.open').forEach(el => el.classList.remove('open'));
  if (!open) dd.classList.add('open');
};

// Fechar dropdowns ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.cat-filter-wrap') && !e.target.closest('.export-wrap') &&
      !e.target.closest('.custom-select') && !e.target.closest('.custom-datepicker')) {
    document.querySelectorAll('.cat-filter-dropdown.open, .export-dropdown.open').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.cat-filter-btn.open').forEach(el => el.classList.remove('open'));
  }
});

// ─── Obter transações com todos os filtros ─────────────────────────────────
function obterTransacoesFiltradas() {
  return transacoesGlobais.filter(t => {
    if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;
    if (catFiltroAtual && t.categoria !== catFiltroAtual) return false;
    if (buscaQuery) {
      const desc = (t.descricao || '').toLowerCase();
      const cat  = (t.categoria || '').toLowerCase();
      if (!desc.includes(buscaQuery) && !cat.includes(buscaQuery)) return false;
    }
    return true;
  });
}

// ─── Renderizar extrato ────────────────────────────────────────────────────
function renderizarExtrato() {
  const container = document.getElementById('listaExtrato');
  if (!container) return;

  // ─ Resumo (usa transacoesGlobais inteiras do mês, sem filtros de UI)
  let totalReceitas = 0, cntReceitas = 0, totalDespesas = 0, cntDespesas = 0;
  transacoesGlobais.forEach(t => {
    if (t.tipo === 'receita') { totalReceitas += (t.valor || 0); cntReceitas++; }
    else                      { totalDespesas += (t.valor || 0); cntDespesas++; }
  });
  const saldo = totalReceitas - totalDespesas;

  // Totais do mês anterior
  let antRec = 0, antDes = 0;
  transacoesMesAnterior.forEach(t => {
    if (t.tipo === 'receita') antRec += (t.valor || 0);
    else antDes += (t.valor || 0);
  });
  const antSaldo = antRec - antDes;

  const elRec  = document.getElementById('cardReceitas');
  const elDes  = document.getElementById('cardDespesas');
  const elSal  = document.getElementById('cardSaldo');
  if (elRec) elRec.textContent   = fmtBRL(totalReceitas);
  if (elDes) elDes.textContent   = fmtBRL(totalDespesas);
  if (elSal) {
    // Melhoria 2: sinal explícito no saldo
    if (valoresOcultos) {
      elSal.textContent = '••••••';
      elSal.style.color = 'var(--card-text)';
    } else {
      elSal.textContent = (saldo >= 0 ? '+' : '-') + Math.abs(saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      elSal.style.color = saldo >= 0 ? '#16a34a' : '#dc2626';
    }
  }
  const elRecSub = document.getElementById('cardReceitasSub');
  const elDesSub = document.getElementById('cardDespesasSub');
  const elSalSub = document.getElementById('cardSaldoSub');
  if (elRecSub) elRecSub.textContent = cntReceitas === 1 ? '1 transação' : `${cntReceitas} transações`;
  if (elDesSub) elDesSub.textContent = cntDespesas === 1 ? '1 transação' : `${cntDespesas} transações`;
  if (elSalSub) elSalSub.textContent = saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo';

  // Melhoria 4: badges de variação vs mês anterior (só após meses anteriores carregados)
  if (_dadosCarregados.mesAnterior) {
    renderBadge('cardReceitasBadge', calcVariacao(totalReceitas, antRec), false);
    renderBadge('cardDespesasBadge', calcVariacao(totalDespesas, antDes), true);
    renderBadge('cardSaldoBadge',    calcVariacao(Math.abs(saldo), Math.abs(antSaldo)), false);
  }

  // ─ Popular dropdown de categorias
  popularCatFiltroDropdown();

  // ─ Aplicar filtros de UI
  const filtradas = obterTransacoesFiltradas();
  const total = transacoesGlobais.length;
  const cntEl = document.getElementById('txContador');
  const avisoEl = document.getElementById('txFiltroAviso');
  const filtroAtivo = filtradas.length !== total || filtroTipo !== 'todos' || catFiltroAtual || buscaQuery;
  if (cntEl) cntEl.textContent = filtradas.length === 1 ? '1 transação' : `${filtradas.length} transações`;
  // Melhoria 5: contador exibindo/total
  if (avisoEl) {
    if (filtroAtivo && filtradas.length !== total) {
      avisoEl.textContent = `🔍 exibindo ${filtradas.length} de ${total}`;
      avisoEl.style.display = 'block';
    } else {
      avisoEl.style.display = 'none';
    }
  }

  if (filtradas.length === 0) {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="empty-state-icon">📭</div>'
      + '<div class="empty-state-title">Nenhuma transação encontrada</div>'
      + '<div class="empty-state-sub">Tente ajustar os filtros ou registre uma transação no Dashboard.</div>';
    container.appendChild(empty);
    renderBreakdown(); // Breakdown usa transacoesGlobais (não filtradas), deve sempre atualizar
    return;
  }

  // ─ Agrupar por dia (apenas os itens desta página)
  const paginadas = filtradas.slice(0, _txPaginaSize);
  const grupos = {};
  paginadas.forEach(t => {
    const d = tsToDate(t.data);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push({ ...t, _date: d });
  });
  const chaves = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  // ─ Renderizar (DEC-006: só style.cssText em elementos dinâmicos)
  const frag = document.createDocumentFragment();

  chaves.forEach(key => {
    const txsDia = grupos[key];
    const dataDia = txsDia[0]._date;
    let diaRec = 0, diaDes = 0;
    txsDia.forEach(t => { if (t.tipo === 'receita') diaRec += (t.valor||0); else diaDes += (t.valor||0); });

    // Header do dia
    const hdr = document.createElement('div');
    hdr.className = 'tx-day-header';
    const diaLabel = document.createElement('span');
    diaLabel.className = 'tx-day-label';
    diaLabel.textContent = formatDataLonga(dataDia);
    const totais = document.createElement('span');
    totais.className = 'tx-day-totals';
    if (diaRec > 0) {
      const sp = document.createElement('span');
      sp.className = 'tx-day-pos';
      sp.textContent = '+' + fmtBRL(diaRec);
      totais.appendChild(sp);
    }
    if (diaDes > 0) {
      const sp = document.createElement('span');
      sp.className = 'tx-day-neg';
      sp.textContent = '-' + fmtBRL(diaDes);
      totais.appendChild(sp);
    }
    hdr.appendChild(diaLabel);
    hdr.appendChild(totais);
    frag.appendChild(hdr);

    // Linhas de transação
    txsDia.forEach(t => {
      const emoji = getEmoji(t.categoria || '');
      const isRec = t.tipo === 'receita';

      const row = document.createElement('div');
      row.className = 'tx-row ' + (isRec ? 'tx-row-receita' : 'tx-row-despesa');

      // Emoji circle
      const circle = document.createElement('div');
      circle.className = isRec ? 'tx-emoji-circle tx-emoji-receita' : 'tx-emoji-circle tx-emoji-despesa';
      circle.textContent = emoji;
      row.appendChild(circle);

      // Info
      const info = document.createElement('div');
      info.className = 'tx-info';
      const desc = document.createElement('div');
      desc.className = 'tx-desc';
      desc.textContent = t.descricao || '—';
      const meta = document.createElement('div');
      meta.className = 'tx-meta';
      meta.textContent = (t.categoria || 'Sem categoria') + ' · ' + formatDataLabel(t._date);
      info.appendChild(desc);
      info.appendChild(meta);
      row.appendChild(info);

      // Valor + ações
      const valCol = document.createElement('div');
      valCol.className = 'tx-value-col';

      const valor = document.createElement('span');
      valor.className = isRec ? 'tx-valor tx-valor-pos' : 'tx-valor tx-valor-neg';
      valor.textContent = (isRec ? '+' : '-') + fmtBRL(t.valor || 0);
      valCol.appendChild(valor);

      const actions = document.createElement('div');
      actions.className = 'tx-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'tx-action-btn';
      btnEdit.title = 'Editar';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', function(e) { e.stopPropagation(); abrirModalEditar(t.id); });

      const btnDel = document.createElement('button');
      btnDel.className = 'tx-action-btn delete';
      btnDel.title = 'Excluir';
      btnDel.textContent = '🗑️';
      btnDel.addEventListener('click', function(e) { e.stopPropagation(); pedirExclusao(t.id); });

      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
      valCol.appendChild(actions);
      row.appendChild(valCol);

      // Clicar na row abre o editar
      row.addEventListener('click', function() { abrirModalEditar(t.id); });

      frag.appendChild(row);
    });
  });

  // ─ Botão "Ver mais" se há itens além desta página
  if (filtradas.length > _txPaginaSize) {
    const restante = filtradas.length - _txPaginaSize;
    const btnVerMais = document.createElement('button');
    btnVerMais.style.cssText = 'display:block;width:100%;margin-top:1rem;padding:0.75rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);font-size:0.875rem;font-weight:700;color:var(--card-text-sec);cursor:pointer;font-family:inherit;';
    btnVerMais.textContent = `Ver mais ${Math.min(50, restante)} transações  (mostrando ${_txPaginaSize} de ${filtradas.length})`;
    btnVerMais.addEventListener('click', function() { _txPaginaSize += 50; renderizarExtrato(); });
    frag.appendChild(btnVerMais);
  }

  container.innerHTML = '';
  container.appendChild(frag);

  // Melhoria 3: Breakdown de top categorias (sempre baseado no mês completo)
  renderBreakdown();
}

// ─── Breakdown top categorias ─────────────────────────────────────────────
function renderBreakdown() {
  const section = document.getElementById('sectionBreakdown');
  const lista   = document.getElementById('breakdownLista');
  const total   = document.getElementById('breakdownTotal');
  if (!section || !lista) return;

  // Agrupa despesas por categoria (mês completo)
  const porCat = {};
  transacoesGlobais.forEach(t => {
    if (t.tipo !== 'despesa' || !t.valor) return;
    const c = t.categoria || 'Sem categoria';
    porCat[c] = (porCat[c] || 0) + t.valor;
  });

  const allEntries = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const entries = allEntries.slice(0, 5);
  if (entries.length === 0) { section.style.display = 'none'; return; }
  const outrosEntries = allEntries.slice(5);
  const outrosTotal = outrosEntries.reduce((s, [, v]) => s + v, 0);

  const maximo = entries[0][1];
  const totalDes = Object.values(porCat).reduce((s, v) => s + v, 0);
  section.style.display = 'block';
  if (total) total.textContent = 'Total: ' + fmtBRL(totalDes);

  lista.innerHTML = '';
  const COR_BARRAS = ['#3b82f6','#8b5cf6','#f59e0b','#ec4899','#14b8a6'];

  entries.forEach(([nome, valor], i) => {
    const pct = maximo > 0 ? (valor / maximo) * 100 : 0;
    const pctTotal = totalDes > 0 ? ((valor / totalDes) * 100).toFixed(1) : '0';
    const emoji = getEmoji(nome);
    const cor = COR_BARRAS[i % COR_BARRAS.length];

    const rowEl = document.createElement('div');
    rowEl.className = 'breakdown-row';
    rowEl.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;cursor:pointer;';
    rowEl.title = 'Filtrar por ' + nome;
    rowEl.addEventListener('click', function() { setCatFiltro(nome, emoji + ' ' + nome); window.scrollTo({ top: document.getElementById('listaExtrato')?.offsetTop - 80, behavior: 'smooth' }); });

    const emojiEl = document.createElement('div');
    emojiEl.className = 'breakdown-emoji';
    emojiEl.textContent = emoji;

    const infoEl = document.createElement('div');
    infoEl.className = 'breakdown-info';
    infoEl.style.cssText = 'flex:1;min-width:0;';

    const nomeRow = document.createElement('div');
    nomeRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
    const nomeEl = document.createElement('span');
    nomeEl.className = 'breakdown-nome';
    nomeEl.textContent = nome;
    const valEl = document.createElement('span');
    valEl.className = 'breakdown-valor';
    valEl.textContent = fmtBRL(valor);
    nomeRow.appendChild(nomeEl);
    nomeRow.appendChild(valEl);

    const pctEl = document.createElement('div');
    pctEl.className = 'breakdown-pct';
    pctEl.textContent = pctTotal + '% do total de despesas';

    const barBg = document.createElement('div');
    barBg.className = 'breakdown-bar-bg';
    const barFill = document.createElement('div');
    barFill.className = 'breakdown-bar-fill';
    barFill.style.cssText = `width:0%;background:${cor};`;
    barBg.appendChild(barFill);
    // Animação com delay leve
    setTimeout(() => { barFill.style.width = pct + '%'; }, 50 + i * 80);

    infoEl.appendChild(nomeRow);
    infoEl.appendChild(pctEl);
    infoEl.appendChild(barBg);

    rowEl.appendChild(emojiEl);
    rowEl.appendChild(infoEl);
    lista.appendChild(rowEl);
  });

  // Linha “Outros” para categorias além do top 5
  if (outrosEntries.length > 0) {
    const pct = maximo > 0 ? (outrosTotal / maximo) * 100 : 0;
    const pctTotal = totalDes > 0 ? ((outrosTotal / totalDes) * 100).toFixed(1) : '0';
    const rowEl = document.createElement('div');
    rowEl.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-top:1px dashed var(--input-border);';
    const emojiEl = document.createElement('div');
    emojiEl.className = 'breakdown-emoji';
    emojiEl.textContent = '📦';
    const infoEl = document.createElement('div');
    infoEl.className = 'breakdown-info';
    infoEl.style.cssText = 'flex:1;min-width:0;';
    const nomeRow = document.createElement('div');
    nomeRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
    const nomeEl = document.createElement('span');
    nomeEl.className = 'breakdown-nome';
    nomeEl.style.cssText = 'opacity:0.7;font-style:italic;';
    nomeEl.textContent = `Outros (${outrosEntries.length} ${outrosEntries.length === 1 ? 'categoria' : 'categorias'})`;
    const valEl = document.createElement('span');
    valEl.className = 'breakdown-valor';
    valEl.style.cssText = 'opacity:0.7;';
    valEl.textContent = fmtBRL(outrosTotal);
    nomeRow.appendChild(nomeEl);
    nomeRow.appendChild(valEl);
    const pctEl = document.createElement('div');
    pctEl.className = 'breakdown-pct';
    pctEl.textContent = pctTotal + '% do total de despesas';
    const barBg = document.createElement('div');
    barBg.className = 'breakdown-bar-bg';
    const barFill = document.createElement('div');
    barFill.className = 'breakdown-bar-fill';
    barFill.style.cssText = 'width:0%;background:#94a3b8;';
    barBg.appendChild(barFill);
    setTimeout(() => { barFill.style.width = pct + '%'; }, 50 + 5 * 80);
    infoEl.appendChild(nomeRow);
    infoEl.appendChild(pctEl);
    infoEl.appendChild(barBg);
    rowEl.appendChild(emojiEl);
    rowEl.appendChild(infoEl);
    lista.appendChild(rowEl);
  }
}

// ─── Exclusão ────────────────────────────────────────────────────────────────
function pedirExclusao(id) {
  _excluirId = id;
  document.getElementById('modalExcluir')?.classList.add('open');
}

window.fecharModalExcluir = function() {
  _excluirId = null;
  document.getElementById('modalExcluir')?.classList.remove('open');
};

window.confirmarExclusao = async function() {
  if (!_excluirId || !usuarioAtualId) return;
  const btn = document.getElementById('btnConfirmarExclusao');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await deleteDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', _excluirId));
    fecharModalExcluir();
    if (window.budShowToast) window.budShowToast('Transação excluída.', 'success');
  } catch (_e) {
    if (window.budShowToast) window.budShowToast('Erro ao excluir. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }
};

// ─── Modal Editar ──────────────────────────────────────────────────────────
window.abrirModalEditar = function(id) {
  const t = transacoesGlobais.find(tx => tx.id === id);
  if (!t) return;
  document.getElementById('editId').value = id;

  // Tipo
  editSetTipo(t.tipo || 'despesa');

  // Descrição
  const desc = document.getElementById('editDescricao');
  if (desc) desc.value = t.descricao || '';

  // Valor
  const val = document.getElementById('editValor');
  if (val) val.value = (t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Categoria
  preencherCatDropdownModal(t.tipo || 'despesa', t.categoria || '');

  // Data
  const d = tsToDate(t.data) || new Date();
  _dpAno = d.getFullYear();
  _dpMes = d.getMonth();
  _dpDataSelecionada = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  document.getElementById('editDataHidden').value = _dpDataSelecionada;
  const dpLbl = document.getElementById('editDpLabel');
  if (dpLbl) { dpLbl.textContent = formatDataLabel(d); dpLbl.style.color = 'var(--card-text)'; }

  document.getElementById('modalEditar')?.classList.add('open');
};

window.fecharModalEditar = function() {
  document.getElementById('modalEditar')?.classList.remove('open');
  document.getElementById('editCatDropdown')?.classList.remove('open');
  document.getElementById('editCatBtn')?.classList.remove('open');
  document.getElementById('editDpDropdown')?.classList.remove('open');
  document.getElementById('editDpBtn')?.classList.remove('open');
};

window.editSetTipo = function(tipo) {
  const btnR = document.getElementById('editBtnReceita');
  const btnD = document.getElementById('editBtnDespesa');
  if (btnR) { btnR.className = 'tipo-btn' + (tipo === 'receita' ? ' active-receita' : ''); }
  if (btnD) { btnD.className = 'tipo-btn' + (tipo === 'despesa' ? ' active-despesa' : ''); }
  // Re-popular dropdown ao trocar tipo
  const catAtual = document.getElementById('editCategoria')?.value || '';
  preencherCatDropdownModal(tipo, catAtual);
};

function preencherCatDropdownModal(tipo, catAtual) {
  const dd = document.getElementById('editCatDropdown');
  const hidden = document.getElementById('editCategoria');
  const texto = document.getElementById('editCatTexto');
  const trigger = document.getElementById('editCatBtn');
  if (!dd) return;

  const padrao = (window.BUD_CATEGORIAS_PADRAO && window.BUD_CATEGORIAS_PADRAO[tipo]) || [];
  const padraoNomes = padrao.map(c => c.nome);
  const personalizadas = categoriasCustom
    .filter(c => c.tipo === tipo)
    .filter(c => !padraoNomes.includes(c.nome))
    .map(c => ({ nome: c.nome, emoji: c.emoji || '🏷️' }));
  const todas = [...padrao, ...personalizadas];

  dd.innerHTML = '';
  let labelAtual = 'Selecione...';

  todas.forEach(cat => {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option' + (cat.nome === catAtual ? ' selected' : '');
    opt.setAttribute('role', 'option');
    opt.setAttribute('data-value', cat.nome);
    const label = (cat.emoji ? cat.emoji + ' ' : '') + cat.nome;
    opt.textContent = label;
    if (cat.nome === catAtual) { labelAtual = label; }
    opt.addEventListener('click', function(e) {
      e.stopPropagation();
      dd.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      if (hidden) hidden.value = cat.nome;
      if (texto) texto.textContent = label;
      trigger?.classList.add('has-value');
      trigger?.classList.remove('open');
      dd.classList.remove('open');
    });
    dd.appendChild(opt);
  });

  if (hidden) hidden.value = catAtual;
  if (texto) texto.textContent = catAtual ? labelAtual : 'Selecione...';
  if (trigger) trigger.classList.toggle('has-value', !!catAtual);
}

window.toggleEditCatDropdown = function() {
  const dd = document.getElementById('editCatDropdown');
  const btn = document.getElementById('editCatBtn');
  if (!dd) return;
  const open = dd.classList.contains('open');
  // fechar datepicker se aberto
  document.getElementById('editDpDropdown')?.classList.remove('open');
  document.getElementById('editDpBtn')?.classList.remove('open');
  dd.classList.toggle('open', !open);
  btn?.classList.toggle('open', !open);
};

// ─── Datepicker do modal ───────────────────────────────────────────────────
window.toggleEditDp = function() {
  const dd = document.getElementById('editDpDropdown');
  const btn = document.getElementById('editDpBtn');
  if (!dd) return;
  const open = dd.classList.contains('open');
  // fechar cat dropdown se aberto
  document.getElementById('editCatDropdown')?.classList.remove('open');
  document.getElementById('editCatBtn')?.classList.remove('open');
  if (!open) {
    renderDpModal();
    dd.classList.add('open');
    btn?.classList.add('open');
  } else {
    dd.classList.remove('open');
    btn?.classList.remove('open');
  }
};

window.editDpNavMes = function(dir) {
  _dpMes += dir;
  if (_dpMes < 0)  { _dpMes = 11; _dpAno--; }
  if (_dpMes > 11) { _dpMes = 0;  _dpAno++; }
  renderDpModal();
};

function renderDpModal() {
  const mesAnoEl = document.getElementById('editDpMesAno');
  if (mesAnoEl) mesAnoEl.textContent = `${MESES_PT[_dpMes]} ${_dpAno}`;

  const diasEl = document.getElementById('editDpDias');
  if (!diasEl) return;

  diasEl.innerHTML = '';
  const hoje = new Date();
  const primeiroDia = new Date(_dpAno, _dpMes, 1).getDay(); // 0=domingo
  const diasNoMes  = new Date(_dpAno, _dpMes + 1, 0).getDate();
  const diasMesAnt = new Date(_dpAno, _dpMes, 0).getDate();

  // Dias do mês anterior
  for (let i = 0; i < primeiroDia; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-day dp-other-month';
    btn.textContent = String(diasMesAnt - primeiroDia + 1 + i);
    diasEl.appendChild(btn);
  }

  // Dias do mês atual
  for (let d = 1; d <= diasNoMes; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isoStr = `${_dpAno}-${String(_dpMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let cls = 'dp-day';
    if (d === hoje.getDate() && _dpMes === hoje.getMonth() && _dpAno === hoje.getFullYear()) cls += ' dp-today';
    if (isoStr === _dpDataSelecionada) cls += ' dp-selected';
    btn.className = cls;
    btn.textContent = String(d);
    btn.addEventListener('click', function() { selecionarDiaModal(d, isoStr); });
    diasEl.appendChild(btn);
  }

  // Completar grade com dias do mês seguinte
  const total = primeiroDia + diasNoMes;
  const resto = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= resto; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-day dp-other-month';
    btn.textContent = String(i);
    diasEl.appendChild(btn);
  }
}

function selecionarDiaModal(dia, isoStr) {
  _dpDataSelecionada = isoStr;
  document.getElementById('editDataHidden').value = isoStr;
  const d = new Date(isoStr + 'T12:00:00');
  const lbl = document.getElementById('editDpLabel');
  if (lbl) { lbl.textContent = formatDataLabel(d); lbl.style.color = 'var(--card-text)'; }
  document.getElementById('editDpDropdown')?.classList.remove('open');
  document.getElementById('editDpBtn')?.classList.remove('open');
}

// ─── Formatar input de valor em tempo real (máscara BRL) ──────────────────
window.formatarInputValor = function(input) {
  const raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  const num = parseInt(raw, 10) / 100;
  input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Salvar edição (BUG 5 — parse robusto) ────────────────────────────────
window.salvarEdicao = async function() {
  const id = document.getElementById('editId')?.value;
  if (!id || !usuarioAtualId) return;

  const descricao  = window.budSanitize
    ? window.budSanitize((document.getElementById('editDescricao')?.value || '').trim())
    : (document.getElementById('editDescricao')?.value || '').trim();
  const valorRaw   = document.getElementById('editValor')?.value || '';
  const categoria  = document.getElementById('editCategoria')?.value || '';
  const dataStr    = document.getElementById('editDataHidden')?.value || '';
  const tipo = document.getElementById('editBtnReceita')?.classList.contains('active-receita')
    ? 'receita' : 'despesa';

  // Validações
  const erros = [];
  if (!descricao) erros.push(document.getElementById('editDescricao'));
  const valor = parseBRL(valorRaw);
  if (valor === null || valor <= 0) erros.push(document.getElementById('editValor'));
  if (!categoria) erros.push(document.getElementById('editCatBtn'));
  if (!dataStr) erros.push(document.getElementById('editDpBtn'));

  erros.forEach(el => el?.classList.add('error'));
  setTimeout(() => erros.forEach(el => el?.classList.remove('error')), 2000);

  if (erros.length > 0) {
    if (window.budShowToast) window.budShowToast('Preencha os campos obrigatórios.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSalvarEdicao');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    const dataTimestamp = Timestamp.fromDate(new Date(dataStr + 'T12:00:00'));
    await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', id), {
      descricao,
      valor,
      categoria,
      tipo,
      data: dataTimestamp,
      atualizadoEm: serverTimestamp()
    });
    fecharModalEditar();
    if (window.budShowToast) window.budShowToast('Transação atualizada!', 'success');
  } catch (_e) {
    if (window.budShowToast) window.budShowToast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Alterações'; }
  }
};

// ─── Exportar CSV ──────────────────────────────────────────────────────────
window.exportarCSV = function() {
  document.getElementById('exportDropdown')?.classList.remove('open');
  const dados = obterTransacoesFiltradas();
  if (!dados.length) {
    if (window.budShowToast) window.budShowToast('Nenhuma transação para exportar.', 'warning');
    return;
  }
  const linhas = ['Data;Descrição;Tipo;Categoria;Valor'];
  dados.forEach(t => {
    const d = tsToDate(t.data);
    linhas.push([
      d ? formatDataLabel(d) : '—',
      '"' + (t.descricao || '').replace(/"/g, '""') + '"',
      t.tipo === 'receita' ? 'Receita' : 'Despesa',
      '"' + (t.categoria || '').replace(/"/g, '""') + '"',
      (t.valor || 0).toFixed(2).replace('.', ',')
    ].join(';'));
  });
  const csv  = '\uFEFF' + linhas.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const mesLabel = modoFiltro === 'intervalo' && filtroDataInicio && filtroDataFim
    ? `${filtroDataInicio.toISOString().slice(0,10)}_${filtroDataFim.toISOString().slice(0,10)}`
    : `${MESES_PT[dataFiltro.getMonth()]}-${dataFiltro.getFullYear()}`.toLowerCase();
  a.href = url; a.download = `extrato-${mesLabel}.csv`; a.click();
  URL.revokeObjectURL(url);
};

// ─── Exportar PDF (BUG 13 — iframe, sem popup) ────────────────────────────
window.exportarPDF = function() {
  document.getElementById('exportDropdown')?.classList.remove('open');
  const dados = obterTransacoesFiltradas();
  if (!dados.length) {
    if (window.budShowToast) window.budShowToast('Nenhuma transação para exportar.', 'warning');
    return;
  }
  let totalRec = 0, totalDes = 0;
  dados.forEach(t => { t.tipo === 'receita' ? totalRec += t.valor : totalDes += t.valor; });
  const saldo = totalRec - totalDes;
  const fmtPDF = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const mesAno = modoFiltro === 'intervalo' && filtroDataInicio && filtroDataFim
    ? `${fmtDate(filtroDataInicio)} a ${fmtDate(filtroDataFim)}`
    : `${MESES_PT[dataFiltro.getMonth()]} de ${dataFiltro.getFullYear()}`;
  // (usando mesAno para label do PDF abaixo)

  // Agrupar por dia
  const grupos = {};
  dados.forEach(t => {
    const d = tsToDate(t.data);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push({ ...t, _date: d });
  });
  const chaves = Object.keys(grupos).sort((a,b) => b.localeCompare(a));

  let rowsHtml = '';
  chaves.forEach(key => {
    const txs = grupos[key];
    rowsHtml += `<tr style="background:#f8fafc;"><td colspan="4" style="padding:8px 12px;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">${formatDataLonga(txs[0]._date)}</td></tr>`;
    txs.forEach(t => {
      const isRec = t.tipo === 'receita';
      rowsHtml += `<tr>
        <td style="padding:8px 12px;">${getEmoji(t.categoria||'')} ${(t.descricao||'').replace(/</g,'&lt;')}</td>
        <td style="padding:8px 12px;color:#64748b;">${(t.categoria||'—')}</td>
        <td style="padding:8px 12px;font-weight:700;color:${isRec?'#16a34a':'#dc2626'};">${isRec?'+':'-'}${fmtPDF(t.valor||0)}</td>
      </tr>`;
    });
  });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Extrato ${mesAno}</title>
  <style>body{font-family:Inter,sans-serif;margin:0;padding:24px;color:#1e293b;}
  h1{font-size:20px;font-weight:800;margin:0 0 4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:20px;}
  .cards{display:flex;gap:16px;margin-bottom:20px;}
  .card{background:#f8fafc;border-radius:12px;padding:14px 20px;flex:1;}
  .card-label{font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;}
  .card-value{font-size:20px;font-weight:800;margin-top:4px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{padding:8px 12px;text-align:left;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;}
  tr{border-bottom:1px solid #f1f5f9;}
  .footer{margin-top:24px;font-size:11px;color:#94a3b8;text-align:center;}
  @media print{body{padding:12px;}}</style></head><body>
  <h1>📋 Extrato Completo</h1>
  <div class="sub">${mesAno} — gerado em ${new Date().toLocaleString('pt-BR')}</div>
  <div class="cards">
    <div class="card"><div class="card-label">Receitas</div><div class="card-value" style="color:#16a34a;">${fmtPDF(totalRec)}</div></div>
    <div class="card"><div class="card-label">Despesas</div><div class="card-value" style="color:#dc2626;">${fmtPDF(totalDes)}</div></div>
    <div class="card"><div class="card-label">Saldo</div><div class="card-value" style="color:${saldo>=0?'#16a34a':'#dc2626'};">${fmtPDF(Math.abs(saldo))}</div></div>
  </div>
  <table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
  <tbody>${rowsHtml}</tbody></table>
  <div class="footer">Bud Finance — ${new Date().toLocaleString('pt-BR')}</div>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    try { iframe.contentWindow.print(); } catch (_e) {}
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 400);
};

// ─── Subscriptions ─────────────────────────────────────────────────────────
function subscribeTransacoes(uid) {
  // Cancela listener anterior (BUG 2 — sem limit(5000))
  if (_unsubTransacoes) { _unsubTransacoes(); _unsubTransacoes = null; }
  if (_unsubMesAnt)     { _unsubMesAnt();     _unsubMesAnt = null; }
  _dadosCarregados.transacoes = false;
  _dadosCarregados.mesAnterior = false;

  const ano = dataFiltro.getFullYear();
  const mes = dataFiltro.getMonth();
  let inicio, fim;
  if (modoFiltro === 'intervalo' && filtroDataInicio && filtroDataFim) {
    inicio = Timestamp.fromDate(filtroDataInicio);
    fim    = Timestamp.fromDate(filtroDataFim);
  } else {
    inicio = Timestamp.fromDate(new Date(ano, mes, 1, 0, 0, 0));
    fim    = Timestamp.fromDate(new Date(ano, mes + 1, 0, 23, 59, 59));
  }

  const q = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    where('data', '>=', inicio),
    where('data', '<=', fim),
    orderBy('data', 'desc')
  );

  _unsubTransacoes = onSnapshot(q, function(snap) {
    transacoesGlobais = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _dadosCarregados.transacoes = true;
    hideSplash();
    if (_dadosCarregados.categorias) renderizarExtrato();
  }, function(err) {
    (window.budError||console.error)('[extrato] onSnapshot transações:', err);
    hideSplash();
    if (window.budShowToast) window.budShowToast('Erro ao carregar transações.', 'error');
  });

  // Melhoria 4: buscar mês anterior para comparação
  const mesAntData = new Date(ano, mes - 1, 1);
  const anoAnt = mesAntData.getFullYear();
  const mesAnt = mesAntData.getMonth();
  const inicioAnt = Timestamp.fromDate(new Date(anoAnt, mesAnt, 1, 0, 0, 0));
  const fimAnt    = Timestamp.fromDate(new Date(anoAnt, mesAnt + 1, 0, 23, 59, 59));
  const qAnt = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    where('data', '>=', inicioAnt),
    where('data', '<=', fimAnt)
  );
  _unsubMesAnt = onSnapshot(qAnt, function(snap) {
    transacoesMesAnterior = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _dadosCarregados.mesAnterior = true;
    if (_dadosCarregados.transacoes && _dadosCarregados.categorias) renderizarExtrato();
  }, function() {
    _dadosCarregados.mesAnterior = true; // não bloqueia render se falhar
  });
}

function subscribeAll(uid) {
  // Categorias (BUG 10 — só renderiza quando ambos chegaram)
  _dadosCarregados = { categorias: false, transacoes: false, mesAnterior: false };

  const catRef = collection(db, 'usuarios', uid, 'categorias');
  _unsubCategorias = onSnapshot(catRef, function(snap) {
    categoriasCustom = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _dadosCarregados.categorias = true;
    // Re-renderiza apenas se transações já chegaram
    if (_dadosCarregados.transacoes) renderizarExtrato();
  }, function(_err) {});

  subscribeTransacoes(uid);
}

// ─── Splash ────────────────────────────────────────────────────────────────
function hideSplash() {
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => { splash.style.display = 'none'; }, 500); }
}

// ─── Sidebar (mesmos helpers do dashboard) ─────────────────────────────────
function setupSidebar(user, userData) {
  const nome = userData?.nome || user.displayName || user.email || '?';
  const matricula = userData?.matricula || '—';
  const inicial = nome.charAt(0).toUpperCase();
  const av = document.getElementById('sidebarAvatar'); if (av) av.textContent = inicial;
  const nm = document.getElementById('sidebarUserName'); if (nm) nm.textContent = nome;
  const id = document.getElementById('sidebarUserId'); if (id) id.textContent = matricula;

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mainEl  = document.getElementById('dashMain');
  const hamburger = document.getElementById('btnHamburger');
  const collapseBtn = document.getElementById('btnSidebarCollapse');

  function openSidebar()  { sidebar?.classList.add('open'); overlay?.classList.add('open'); }
  function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); }
  hamburger?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);

  function applyCollapsed(v) {
    sidebar?.classList.toggle('collapsed', v);
    mainEl?.classList.toggle('sidebar-collapsed', v);
    if (collapseBtn) collapseBtn.textContent = v ? '›' : '‹';
  }
  const saved = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (window.innerWidth > 768) applyCollapsed(saved);
  collapseBtn?.addEventListener('click', function() {
    if (window.innerWidth <= 768) return;
    const c = sidebar?.classList.contains('collapsed');
    localStorage.setItem('bud_sidebar_collapsed', !c);
    applyCollapsed(!c);
  });

  document.getElementById('btnLogout')?.addEventListener('click', async function() {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ─── Inicialização ─────────────────────────────────────────────────────────
// Melhoria G: aplicar filtro de intervalo via URL params (?inicio=2025-01-01&fim=2025-01-31)
(function() {
  const p = new URLSearchParams(window.location.search);
  const pIni = p.get('inicio');
  const pFim = p.get('fim');
  if (pIni && pFim && /^\d{4}-\d{2}-\d{2}$/.test(pIni) && /^\d{4}-\d{2}-\d{2}$/.test(pFim)) {
    modoFiltro = 'intervalo';
    filtroDataInicio = new Date(pIni + 'T00:00:00');
    filtroDataFim    = new Date(pFim + 'T23:59:59');
    const ini = document.getElementById('filtroDataInicio');
    const fim = document.getElementById('filtroDataFim');
    if (ini) ini.value = pIni;
    if (fim) fim.value = pFim;
    const mesNav = document.getElementById('mesNavBar');
    const bar = document.getElementById('intervaloBar');
    if (mesNav) mesNav.style.display = 'none';
    if (bar) bar.style.display = 'flex';
    const lbl = document.getElementById('labelIntervalo');
    if (lbl) lbl.textContent = `📅 ${pIni.split('-').reverse().join('/')} → ${pFim.split('-').reverse().join('/')}`;
  }
})();

atualizarTextosData();

document.getElementById('btnMesAnterior')?.addEventListener('click', function() { window.mudarMes(-1); });
document.getElementById('btnProximoMes')?.addEventListener('click', function() { window.mudarMes(1); });
document.getElementById('btnToggleValues')?.addEventListener('click', window.toggleValues);

// Fechar modais ao clicar fora
document.getElementById('modalEditar')?.addEventListener('click', window.fecharModalEditar);
document.getElementById('modalExcluir')?.addEventListener('click', window.fecharModalExcluir);

window.addEventListener('beforeunload', function() {
  if (_unsubTransacoes) _unsubTransacoes();
  if (_unsubMesAnt)     _unsubMesAnt();
  if (_unsubCategorias) _unsubCategorias();
});

onAuthStateChanged(auth, async function(user) {
  if (!user) { window.location.href = 'index.html'; return; }

  usuarioAtualId = user.uid;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = snap.exists() ? snap.data() : {};
    setupSidebar(user, userData);
  } catch (_e) {
    setupSidebar(user, {});
  }

  subscribeAll(user.uid);
});
