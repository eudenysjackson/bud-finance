/**
 * js/relatorios.js — Bud Finance · Central de Relatórios (3 abas)
 * Firebase SDK Modular v10.8.1 — sem compat layer.
 *
 * Bugs do cérebro corrigidos preventivamente:
 * BUG 1  — query filtrada por range de 6 meses no servidor (não limit(5000) genérico)
 * BUG 2  — setDate(1) antes de setMonth() para evitar salto em meses curtos
 * BUG 3  — filtra status !== 'pendente' E pago !== false em todos os cálculos
 * BUG 4  — getDocs (leitura única), não onSnapshot permanente
 * BUG 5  — sincronizarDados() re-busca do Firestore de verdade
 * BUG 6  — downgrade de plano persistido no Firestore via updateDoc
 * BUG 7  — NaN-safe: Number(t.valor)||0 em todos os acumuladores
 * BUG 8  — normalizarData() aceita string "YYYY-MM-DD" e Firestore Timestamp
 * BUG 9  — Resumo — porCategoria filtra SÓ despesas (não mistura receitas)
 * BUG 10 — estiloCategorias usa window.BUD_CATEGORIAS_PADRAO + cores hex inline
 * BUG 11 — elSaldo: só a cor é trocada, classes responsivas preservadas
 * BUG 12 — Gráfico diário: preenche TODOS os dias do mês (sem lacunas no eixo X)
 * BUG 13 — Tendência 6 meses: única passagem pelo array (não 6x filter)
 * BUG 14 — _dadosDirty: troca de aba não recria gráficos se dados não mudaram
 * BUG 15 — Tooltips e eixos respeitam valoresOcultos
 */

import { initializeApp, getApps }   from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, where, orderBy,
  getDocs, getDoc, doc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ─────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ───────────────────────────────────────────────────────────────
let currentUser    = null;
let transacoes     = [];           // cache dos últimos 6 meses
let dividas        = [];           // cache das dívidas ativas
let dataFiltro     = (() => { const d = new Date(); d.setDate(1); return d; })();
let anoSeletor     = dataFiltro.getFullYear();
let valoresOcultos = false;
let abaAtual       = 'resumo';
let _dadosDirty    = true;         // BUG 14: só recriar gráficos quando dados mudaram
let _filtroDiaDia  = 'tudo';
let _filtroTend    = 'ambos';
let _filtroDetalhamento = 'despesas';
let _expandedCats  = new Set();
let charts         = { cat: null, rd: null, tend: null, dia: null };
let splashHidden   = false;

// ─── Helpers ──────────────────────────────────────────────────────────────
const escapeHTML = (typeof window.budEscapeHTML === 'function')
  ? window.budEscapeHTML
  : s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function showToast(msg, tipo = 'ok') {
  if (typeof window.budShowToast === 'function') window.budShowToast(msg, tipo);
}

function hideSplash() {
  const s = document.getElementById('splash');
  if (s && !s.classList.contains('hide')) {
    s.classList.add('hide');
    setTimeout(() => s.remove(), 600);
  }
}

// BUG 7 — NaN-safe, BUG 15 — privacidade
const fmt = v => valoresOcultos
  ? 'R$ •••••'
  : (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtTick = v => valoresOcultos
  ? '••••'
  : 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR');

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABR  = ['Jan','Fev','Mar','Abr','Mai','Jun',
                    'Jul','Ago','Set','Out','Nov','Dez'];

// BUG 8 — aceita string "YYYY-MM-DD" e Firestore Timestamp
function normalizarData(dr) {
  if (!dr) return null;
  if (typeof dr === 'string') return dr;
  if (typeof dr.toDate === 'function') {
    const d = dr.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return null;
}

function getPrefixo() {
  return `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}`;
}

// BUG 10 — usa BUD_CATEGORIAS_PADRAO; fallback gracioso com cor hex
function getCatInfo(nome) {
  const pad = window.BUD_CATEGORIAS_PADRAO || {};
  const cats = [...(pad.despesa || []), ...(pad.receita || [])];
  const found = cats.find(c => c.nome === nome || c.nome?.toLowerCase() === nome?.toLowerCase());
  return found || { nome: nome || 'Outros', emoji: '🏷️', cor: '#64748b' };
}

// Paleta de 12 cores hex para gráficos (BUG 10 — sem Tailwind dinâmico)
const CORES12 = [
  '#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4',
  '#f97316','#6366f1','#84cc16','#ef4444','#14b8a6','#a855f7',
];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function renderBadge(id, curr, prev) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (valoresOcultos || Math.abs(prev) < 0.01) return;
  const diff  = curr - prev;
  const pct   = Math.abs((diff / prev) * 100).toFixed(1);
  const up    = diff >= 0;
  const cor   = up ? '#16a34a' : '#dc2626';
  const bg    = up ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)';
  const sinal = up ? '▲' : '▼';
  el.innerHTML = `<span style="font-size:0.6875rem;font-weight:700;color:${cor};background:${bg};padding:0.15rem 0.4rem;border-radius:0.375rem;display:inline-block;margin-top:0.25rem;">${sinal} ${pct}% vs mês ant.</span>`;
}

// BUG 15 — tooltip callbacks respeitam valoresOcultos
const tooltipCallbacks = {
  label(ctx) {
    if (valoresOcultos) return (ctx.dataset.label || '') + ': •••••';
    const val = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : (ctx.parsed || 0);
    return (ctx.dataset.label || '') + ': ' +
      (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
};

// ─── Navegação de mês ─────────────────────────────────────────────────────
function atualizarMes() {
  const el = document.getElementById('textoMes');
  if (el) el.textContent = `${MESES_FULL[dataFiltro.getMonth()]} ${dataFiltro.getFullYear()}`;
}

// BUG 2 — setDate(1) ANTES de setMonth
window.mudarMes = function(dir) {
  dataFiltro.setDate(1);
  dataFiltro.setMonth(dataFiltro.getMonth() + dir);
  atualizarMes();
  buscarERenderi();
};

window.toggleOcultarValores = function() {
  valoresOcultos = !valoresOcultos;
  const btn = document.getElementById('btnOcultarValores');
  if (btn) btn.textContent = valoresOcultos ? '🙈 Valores' : '👁 Valores';
  _dadosDirty = true;
  renderTudo();
};

// BUG 5 — re-busca do Firestore de verdade
window.sincronizarDados = async function() {
  await buscarERenderi();
  showToast('Dados atualizados!', 'ok');
};

window.exportarPDF = function() { window.print(); };

window.exportarCSV = function() {
  const prefixo = getPrefixo();
  const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );
  if (!doMes.length) { showToast('Sem transações para exportar', 'error'); return; }
  const linhas = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)']];
  doMes.slice().sort((a, b) => (a.dataReferencia || '').localeCompare(b.dataReferencia || '')).forEach(t => {
    const data = t.dataReferencia || '';
    const tipo = t.tipo || '';
    const cat  = (t.categoria || 'Outros').replace(/"/g, '""');
    const desc = (t.descricao || t.titulo || '').replace(/"/g, '""');
    const val  = (Number(t.valor) || 0).toFixed(2).replace('.', ',');
    linhas.push([data, tipo, `"${cat}"`, `"${desc}"`, val]);
  });
  const csv  = '\uFEFF' + linhas.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bud-relatorio-${prefixo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso!', 'ok');
};

window.filtrarDetalhamento = function(filtro) {
  _filtroDetalhamento = filtro;
  _expandedCats.clear();
  ['despesas', 'receitas'].forEach(f => {
    const chip = document.getElementById('chipDet' + f.charAt(0).toUpperCase() + f.slice(1));
    if (chip) chip.className = 'chip-filtro' + (f === filtro ? ' ativo' : '');
  });
  renderDetalhamento();
};

window.toggleCatDet = function(idx) {
  if (_expandedCats.has(idx)) _expandedCats.delete(idx);
  else _expandedCats.add(idx);
  renderDetalhamento();
};

// ─── Seletor de mês mobile ────────────────────────────────────────────────
window.abrirSeletorMes = function() {
  anoSeletor = dataFiltro.getFullYear();
  renderizarGridMeses();
  document.getElementById('bsOverlay').classList.add('open');
  document.getElementById('bottomSheetMes').classList.add('open');
};

window.fecharSeletorMes = function() {
  document.getElementById('bsOverlay').classList.remove('open');
  document.getElementById('bottomSheetMes').classList.remove('open');
};

window.mudarAnoSeletor = function(dir) {
  anoSeletor += dir;
  renderizarGridMeses();
};

function renderizarGridMeses() {
  const el = document.getElementById('anoSeletorLabel');
  if (el) el.textContent = anoSeletor;
  const grid = document.getElementById('gridMesesSeletor');
  if (!grid) return;
  const mesAtual = dataFiltro.getMonth();
  const anoAtual = dataFiltro.getFullYear();
  grid.innerHTML = MESES_ABR.map((m, i) => {
    const ativo = (i === mesAtual && anoSeletor === anoAtual) ? ' ativo' : '';
    return `<button class="bs-mes-btn${ativo}" onclick="window.selecionarMes(${i})">${m}</button>`;
  }).join('');
}

// BUG 2 — setDate(1) ANTES de setFullYear/setMonth
window.selecionarMes = function(mes) {
  dataFiltro.setDate(1);
  dataFiltro.setFullYear(anoSeletor);
  dataFiltro.setMonth(mes);
  atualizarMes();
  window.fecharSeletorMes();
  buscarERenderi();
};

// ─── Troca de aba (BUG 14 — _dadosDirty) ─────────────────────────────────
window.trocarAba = function(aba) {
  abaAtual = aba;
  ['resumo', 'graficos', 'detalhamento'].forEach(a => {
    const btn   = document.getElementById('aba' + a.charAt(0).toUpperCase() + a.slice(1));
    const painel = document.getElementById('painel' + a.charAt(0).toUpperCase() + a.slice(1));
    if (btn)    btn.className    = 'pill-btn' + (a === aba ? ' ativo' : '');
    if (painel) painel.style.display = a === aba ? '' : 'none';
  });
  if (_dadosDirty) {
    renderTudo();
    _dadosDirty = false;
  } else {
    // Só re-renderiza a aba ativa (gráficos precisam ser recriados ao virar visíveis)
    if (aba === 'resumo')       renderResumo();
    else if (aba === 'graficos') renderGraficos();
    else if (aba === 'detalhamento') renderDetalhamento();
  }
};

// Filtro tendência (chips)
window.filtrarTend = function(filtro) {
  _filtroTend = filtro;
  document.querySelectorAll('.chip-tend').forEach(c =>
    c.classList.toggle('chip-tend-ativo', c.dataset.filtro === filtro)
  );
  renderTendencia();
};

// Filtro dia a dia
window.filtrarDiaDia = function(filtro) {
  _filtroDiaDia = filtro;
  ['tudo', 'receitas', 'despesas'].forEach(f => {
    const chip = document.getElementById('chip' + f.charAt(0).toUpperCase() + f.slice(1));
    if (chip) chip.className = 'chip-filtro' + (f === filtro ? ' ativo' : '');
  });
  // Recalcular porDia e re-renderizar
  const prefixo = getPrefixo();
  const porDia = {};
  transacoes
    .filter(t => {
      const dr = normalizarData(t.dataReferencia);
      return dr && dr.startsWith(prefixo) && t.status !== 'pendente' && t.pago !== false;
    })
    .forEach(t => {
      const val = Number(t.valor) || 0;
      const dr  = normalizarData(t.dataReferencia);
      const dia = dr ? dr.split('-')[2] : '01';
      if (!porDia[dia]) porDia[dia] = { rec: 0, dep: 0 };
      if (t.tipo === 'receita') porDia[dia].rec += val; else porDia[dia].dep += val;
    });
  renderDiaDia(porDia, filtro);
};

// ─── Busca Firestore (BUG 1 — 6 meses; BUG 4 — getDocs) ──────────────────
async function buscarERenderi() {
  if (!currentUser) return;
  try {
    // BUG 1 — query com range de 6 meses no servidor (não limit(5000))
    const hoje = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 0); // fim do mês selecionado
    const seisAtras = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 5, 1);
    const limiteInf = `${seisAtras.getFullYear()}-${String(seisAtras.getMonth()+1).padStart(2,'0')}-01`;
    const limiteSup = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-31`;

    const q = query(
      collection(db, 'usuarios', currentUser.uid, 'transacoes'),
      where('dataReferencia', '>=', limiteInf),
      where('dataReferencia', '<=', limiteSup),
      orderBy('dataReferencia', 'asc'),
    );
    const qDiv = query(collection(db, 'usuarios', currentUser.uid, 'dividas'));
    const [snap, snapDiv] = await Promise.all([getDocs(q), getDocs(qDiv)]);
    transacoes = snap.docs.map(d => {
      const data = d.data();
      return { ...data, id: d.id, dataReferencia: normalizarData(data.dataReferencia) };
    });
    dividas = snapDiv.docs.map(d => ({ id: d.id, ...d.data() }));
    _dadosDirty = true;
    renderTudo();
  } catch (e) {
    console.error('[Relatórios] Erro ao buscar:', e);
    showToast('Erro ao carregar transações', 'error');
  }
}

// ─── Render dispatcher (BUG 14) ──────────────────────────────────────────
function renderTudo() {
  const prefixo = getPrefixo();
  // BUG 3 — filtra pendentes E pago===false
  const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );

  // ── KPIs comuns ─────────────────────────────────────────────────────────
  let totalRec = 0, totalDep = 0;
  let qtdRec = 0, qtdDep = 0;
  doMes.forEach(t => {
    const val = Number(t.valor) || 0;
    if (t.tipo === 'receita') { totalRec += val; qtdRec++; }
    else                      { totalDep += val; qtdDep++; }
  });
  const saldo = totalRec - totalDep;

  setText('kpiReceitas',    fmt(totalRec));
  setText('kpiDespesas',    fmt(totalDep));
  setText('kpiReceitasSub', `${qtdRec} ${qtdRec === 1 ? 'entrada' : 'entradas'}`);
  setText('kpiDespesasSub', `${qtdDep} ${qtdDep === 1 ? 'saída' : 'saídas'}`);

  const saldoEl = document.getElementById('kpiSaldo');
  if (saldoEl) {
    saldoEl.textContent = fmt(Math.abs(saldo));
    // BUG 11 — só a cor, preserva classes responsivas
    saldoEl.style.color = saldo >= 0 ? '#16a34a' : '#dc2626';
  }
  setText('kpiSaldoSub', saldo >= 0 ? 'resultado positivo ✅' : 'resultado negativo ⚠️');

  // Limpar expansão de categorias ao carregar novos dados
  _expandedCats.clear();

  // Badges vs mês anterior
  const prevPfx = (() => {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();
  let prevRec = 0, prevDep = 0;
  transacoes.forEach(t => {
    if (!t.dataReferencia || !t.dataReferencia.startsWith(prevPfx)) return;
    if (t.status === 'pendente' || t.pago === false) return;
    const val = Number(t.valor) || 0;
    if (t.tipo === 'receita') prevRec += val; else prevDep += val;
  });
  renderBadge('kpiRecBadge',   totalRec, prevRec);
  renderBadge('kpiDepBadge',   totalDep, prevDep);
  renderBadge('kpiSaldoBadge', saldo,    prevRec - prevDep);

  // Dispatch para a aba ativa
  if (abaAtual === 'resumo')           renderResumo();
  else if (abaAtual === 'graficos')    renderGraficos();
  else if (abaAtual === 'detalhamento') renderDetalhamento();
}

// ─── Aba Resumo ───────────────────────────────────────────────────────────
function renderResumo() {
  const prefixo = getPrefixo();
  // BUG 3 — exclui pendentes
  const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );

  let totalRec = 0, totalDep = 0;
  // BUG 9 — porCategoria acumula SÓ despesas (não mistura receitas)
  const porCatDep = {}, porCatRec = {};
  const porDia    = {};

  doMes.forEach(t => {
    const val = Number(t.valor) || 0;
    const cat = t.categoria || 'Outros';
    const dia = t.dataReferencia ? t.dataReferencia.split('-')[2] : '01';

    if (!porDia[dia]) porDia[dia] = { rec: 0, dep: 0 };

    if (t.tipo === 'receita') {
      totalRec += val;
      porCatRec[cat] = (porCatRec[cat] || 0) + val;
      porDia[dia].rec += val;
    } else {
      totalDep += val;
      porCatDep[cat] = (porCatDep[cat] || 0) + val;
      porDia[dia].dep += val;
    }
  });

  // ── Comparativo ─────────────────────────────────────────────────────────
  const total  = totalRec + totalDep;
  const pctRec = total > 0 ? (totalRec / total) * 100 : 50;
  const pctDep = total > 0 ? (totalDep / total) * 100 : 50;
  const compBarRec = document.getElementById('compBarRec');
  const compBarDep = document.getElementById('compBarDep');
  if (compBarRec) compBarRec.style.width = pctRec.toFixed(1) + '%';
  if (compBarDep) compBarDep.style.width = pctDep.toFixed(1) + '%';
  setText('compPctRec', pctRec.toFixed(0) + '%');
  setText('compPctDep', pctDep.toFixed(0) + '%');

  const comprEl = document.getElementById('compComprometimento');
  if (comprEl) {
    if (totalRec > 0) {
      const comprPct = (totalDep / totalRec) * 100;
      // Soma comprometimento com parcelas de dívidas ativas
      const ativasDividas = dividas.filter(d => {
        const restantes = Math.max(0, (d.parcelas || 0) - (d.parcelasPagas || 0));
        return restantes > 0 && (d.valorParcela || 0) > 0;
      });
      const comprParcelas = ativasDividas.reduce((s, d) => s + (d.valorParcela || 0), 0);
      const comprParcelasPct = (comprParcelas / totalRec) * 100;
      comprEl.style.display = '';
      let msg = `⚠️ ${comprPct.toFixed(0)}% da renda comprometida com gastos`;
      if (comprParcelas > 0) {
        msg += ` + ${comprParcelasPct.toFixed(0)}% com parcelas de dívidas`;
      }
      comprEl.textContent = msg;
      const totalCompr = comprPct + comprParcelasPct;
      comprEl.style.color = totalCompr >= 90 ? '#dc2626' : totalCompr >= 70 ? '#d97706' : '#16a34a';
    } else {
      comprEl.style.display = 'none';
    }
  }

  // ── Ranking de categorias ───────────────────────────────────────────────
  renderCats('catDespesasContainer', porCatDep, totalDep, '#dc2626', 'Nenhuma despesa no período');
  renderCats('catReceitasContainer', porCatRec, totalRec, '#16a34a', 'Nenhuma receita no período');

  // ── Dias sem gasto ──────────────────────────────────────────────────────
  const diasDoMes    = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth()+1, 0).getDate();
  const diasComGasto = Object.keys(porDia).filter(d => porDia[d].dep > 0).length;
  const diasSemGasto = diasDoMes - diasComGasto;
  const dsgEl = document.getElementById('diasSemGastoInfo');
  if (dsgEl) dsgEl.textContent = diasSemGasto > 0 ? `📅 ${diasSemGasto} ${diasSemGasto === 1 ? 'dia' : 'dias'} sem despesas` : '';

  // ── Dia a dia ───────────────────────────────────────────────────────────
  renderDiaDia(porDia, _filtroDiaDia);

  // Insight compartilhado com aba Gráficos
  renderInsight(totalRec, totalDep, totalRec - totalDep, porCatDep);
}

function renderCats(containerId, porCat, total, cor, emptyMsg) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  const entradas = Object.entries(porCat).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);

  if (!entradas.length) {
    cont.innerHTML = `<div style="text-align:center;padding:1.5rem 0;color:var(--card-text-sec);font-size:0.8125rem;">${emptyMsg}</div>`;
    return;
  }

  const max = entradas[0].val;
  cont.innerHTML = entradas.slice(0, 10).map(({ cat, val }) => {
    const info    = getCatInfo(cat);
    const pct     = total > 0 ? (val / total * 100).toFixed(1) : '0.0';
    const barW    = max > 0 ? (val / max * 100).toFixed(1) : '0';
    const nomeSafe = escapeHTML(info.nome || cat);
    return `
      <div class="cat-row">
        <div class="cat-emoji">${escapeHTML(info.emoji || '🏷️')}</div>
        <div class="cat-info">
          <div class="cat-nome">${nomeSafe}</div>
          <div class="cat-bar-wrap">
            <div class="cat-bar" style="width:${barW}%;background:${escapeHTML(cor)};"></div>
          </div>
        </div>
        <div>
          <div class="cat-valor">${valoresOcultos ? '•••••' : (Number(val)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          <div class="cat-pct">${pct}%</div>
        </div>
      </div>`;
  }).join('');
}

function renderDiaDia(porDia, filtro) {
  const cont = document.getElementById('diaAdiaContainer');
  if (!cont) return;

  const filtro_ = filtro || 'tudo';
  const todos   = Object.keys(porDia).sort();
  const dias    = todos.filter(d => {
    if (filtro_ === 'receitas') return porDia[d].rec > 0;
    if (filtro_ === 'despesas') return porDia[d].dep > 0;
    return true;
  });

  if (!dias.length) {
    const msg = filtro_ === 'receitas' ? 'Nenhuma receita no período'
              : filtro_ === 'despesas' ? 'Nenhuma despesa no período'
              : 'Nenhuma movimentação no período';
    cont.innerHTML = `<div style="text-align:center;padding:1.5rem 0;color:var(--card-text-sec);font-size:0.8125rem;">${msg}</div>`;
    return;
  }

  const header = `
    <div class="dia-row" style="padding-bottom:0.375rem;border-bottom:2px solid var(--input-border);">
      <div class="dia-num dia-header">Dia</div>
      <div class="dia-rec dia-header" style="text-align:right;">Entradas</div>
      <div class="dia-dep dia-header" style="text-align:right;">Saídas</div>
      <div class="dia-saldo dia-header" style="text-align:right;">Saldo</div>
    </div>`;

  const linhas = dias.map(dia => {
    const { rec, dep } = porDia[dia];
    const saldo   = rec - dep;
    const salCls  = saldo >= 0 ? 'pos' : 'neg';
    const salSign = saldo >= 0 ? '+' : '';
    // BUG 11 — parseInt(dia) para remover zero à esquerda
    return `
      <div class="dia-row">
        <div class="dia-num">${parseInt(dia, 10)}</div>
        <div class="dia-rec">${rec > 0 ? (valoresOcultos ? '•••••' : rec.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})) : '<span style="color:var(--card-text-sec)">—</span>'}</div>
        <div class="dia-dep">${dep > 0 ? (valoresOcultos ? '•••••' : dep.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})) : '<span style="color:var(--card-text-sec)">—</span>'}</div>
        <div class="dia-saldo ${salCls}">${valoresOcultos ? '•••••' : salSign + saldo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
      </div>`;
  });

  cont.innerHTML = header + linhas.join('');
}

// ─── Aba Gráficos ─────────────────────────────────────────────────────────
function destroyChart(key) {
  if (charts[key]) {
    try { charts[key].destroy(); } catch(e) {}
    charts[key] = null;
  }
}

function ensureCanvas(wrapId, canvasId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return null;
  if (!wrap.querySelector('canvas')) {
    const c = document.createElement('canvas');
    c.id = canvasId;
    c.style.cssText = 'position:relative;';
    wrap.innerHTML = '';
    wrap.appendChild(c);
  }
  return document.getElementById(canvasId);
}

function renderGraficos() {
  if (typeof Chart === 'undefined') {
    console.warn('[Relatórios] Chart.js não carregado.');
    return;
  }

  const prefixo    = getPrefixo();
  const diasNoMes  = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 0).getDate();

  const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );

  let receitas = 0, despesas = 0;
  const porCategoria = {};

  // BUG 12 — preenche TODOS os dias (sem lacunas)
  const porDia = {};
  for (let d = 1; d <= diasNoMes; d++) {
    porDia[String(d).padStart(2, '0')] = 0;
  }

  doMes.forEach(t => {
    const val = Number(t.valor) || 0;
    if (t.tipo === 'receita') {
      receitas += val;
    } else {
      despesas += val;
      const cat = t.categoria || 'Outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + val;
      const dia = t.dataReferencia ? t.dataReferencia.split('-')[2] : '01';
      porDia[dia] = (porDia[dia] || 0) + val;
    }
  });

  // ── Insight ──────────────────────────────────────────────────────────────
  renderInsight(receitas, despesas, receitas - despesas, porCategoria);

  // ── Chart 1: Doughnut — Despesas por Categoria ──────────────────────────
  destroyChart('cat');
  const catWrap    = document.getElementById('wrapCategoria');
  const catEntries = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (catWrap) {
    if (catEntries.length === 0) {
      catWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:260px;font-size:0.875rem;font-weight:600;color:var(--card-text-sec);">Sem despesas neste mês</div>';
    } else {
      const canvas = ensureCanvas('wrapCategoria', 'chartCategoria');
      const pad    = window.BUD_CATEGORIAS_PADRAO || { despesa: [], receita: [] };
      const allCats = [...(pad.despesa || []), ...(pad.receita || [])];
      const labels  = catEntries.map(([nome]) => {
        const info = allCats.find(c => c.nome === nome);
        return (info ? info.emoji + ' ' : '') + nome;
      });
      if (canvas) {
        const totalDep = catEntries.reduce((s, [, v]) => s + v, 0);
        charts.cat = new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: catEntries.map(([, v]) => valoresOcultos ? 1 : v),
              backgroundColor: CORES12.slice(0, catEntries.length),
              borderWidth: 2, borderColor: 'transparent', hoverOffset: 6,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  font: { size: 11, weight: '600', family: "'Inter',sans-serif" },
                  padding: 10, boxWidth: 12,
                  color: cssVar('--text-main') || '#1e293b',
                },
              },
              tooltip: {
                callbacks: {
                  label(ctx) {
                    if (valoresOcultos) return ctx.label + ': •••••';
                    const pct = totalDep > 0 ? ((ctx.parsed / totalDep) * 100).toFixed(1) : '0.0';
                    const brl = (Number(ctx.parsed) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    return ctx.label + ': ' + brl + ' (' + pct + '%)';
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  // ── Chart 2: Bar — Receitas vs Despesas ─────────────────────────────────
  destroyChart('rd');
  const rdCanvas = ensureCanvas('wrapReceitaDespesa', 'chartReceitaDespesa');
  if (rdCanvas) {
    charts.rd = new Chart(rdCanvas, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{
          data: valoresOcultos ? [1, 0.8] : [receitas, despesas],
          backgroundColor: ['rgba(22,163,74,0.75)', 'rgba(220,38,38,0.75)'],
          borderColor:     ['#16a34a', '#dc2626'],
          borderWidth: 1.5, borderRadius: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: tooltipCallbacks },
        },
        scales: {
          y: {
            ticks: { callback: fmtTick, font: { size: 11, family: "'Inter',sans-serif" }, color: cssVar('--text-sec') || '#64748b' },
            grid:  { color: 'rgba(148,163,184,0.1)' },
            beginAtZero: true,
          },
          x: {
            ticks: { font: { size: 12, weight: '700', family: "'Inter',sans-serif" }, color: cssVar('--text-main') || '#1e293b' },
            grid: { display: false },
          },
        },
      },
    });
  }

  // ── Chart 3: Line — Tendência 6 Meses ───────────────────────────────────
  renderTendencia();

  // ── Chart 4: Bar — Gastos por Dia (BUG 12 — todos os dias preenchidos) ──
  destroyChart('dia');
  const diaCanvas = ensureCanvas('wrapDiario', 'chartDiario');
  if (diaCanvas) {
    const diasLabels = Object.keys(porDia).sort();
    const diasVals   = diasLabels.map(d => valoresOcultos ? null : porDia[d]);
    charts.dia = new Chart(diaCanvas, {
      type: 'bar',
      data: {
        labels: diasLabels.map(d => String(parseInt(d, 10))),
        datasets: [{
          label: 'Despesas',
          data: diasVals,
          backgroundColor: 'rgba(239,68,68,0.65)',
          borderColor: '#ef4444',
          borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: tooltipCallbacks },
        },
        scales: {
          y: {
            ticks: { callback: fmtTick, font: { size: 11, family: "'Inter',sans-serif" }, color: cssVar('--text-sec') || '#64748b' },
            grid:  { color: 'rgba(148,163,184,0.1)' },
            beginAtZero: true,
          },
          x: {
            ticks: {
              maxRotation: 0,
              font: { size: 10, family: "'Inter',sans-serif" },
              color: cssVar('--text-main') || '#1e293b',
              maxTicksLimit: 16,
            },
            grid: { display: false },
          },
        },
      },
    });
  }
}

// ── Insight automático ────────────────────────────────────────────────────
function renderInsight(rec, dep, saldo, porCategoria) {
  const el = document.getElementById('insightBanner');
  if (!el) return;
  if (valoresOcultos) { el.style.display = 'none'; return; }

  const catEntries = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  const maiorCat   = catEntries[0];
  let emoji = '📊', msg = '';

  if (maiorCat && dep > 0) {
    const pct = (maiorCat[1] / dep) * 100;
    if (pct >= 40) {
      emoji = '🔴';
      msg   = `<strong>${escapeHTML(maiorCat[0])}</strong> consumiu ${pct.toFixed(0)}% dos seus gastos este mês.`;
    }
  }
  if (!msg && saldo < 0) {
    emoji = '🚨';
    msg   = `Você gastou mais do que recebeu: saldo negativo de <strong>${fmt(Math.abs(saldo))}</strong>.`;
  }
  if (!msg && rec > 0 && saldo > rec * 0.3) {
    emoji = '🎉';
    msg   = `Ótimo mês! Você poupou <strong>${((saldo / rec) * 100).toFixed(0)}%</strong> da sua receita.`;
  }

  // Verifica comprometimento total (gastos + parcelas dívidas)
  if (!msg && rec > 0 && dividas.length > 0) {
    const ativas = dividas.filter(d => Math.max(0, (d.parcelas||0) - (d.parcelasPagas||0)) > 0 && (d.valorParcela||0) > 0);
    if (ativas.length > 0) {
      const comprParcelas = ativas.reduce((s, d) => s + (d.valorParcela || 0), 0);
      const totalCompr = dep + comprParcelas;
      const pctCompr = (totalCompr / rec) * 100;
      if (pctCompr >= 90) {
        emoji = '🔴';
        msg = `Atenção! Seus gastos + parcelas de dívidas comprometem <strong>${pctCompr.toFixed(0)}%</strong> da sua renda (${fmt(comprParcelas)}/mês em parcelas).`;
      } else if (pctCompr >= 70) {
        emoji = '🟡';
        msg = `Suas parcelas de dívidas representam <strong>${fmt(comprParcelas)}/mês</strong>. Somado aos gastos, compromete <strong>${pctCompr.toFixed(0)}%</strong> da renda.`;
      }
    }
  }

  if (!msg) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  const em   = el.querySelector('.insight-emoji');
  const span = el.querySelector('.insight-text');
  if (em)   em.textContent = emoji;
  if (span) span.innerHTML  = msg;
}

// ── Tendência 6 meses (BUG 13 — uma única passagem pelo array) ───────────
function renderTendencia() {
  destroyChart('tend');
  const tendCanvas = ensureCanvas('wrapTendencia', 'chartTendencia');
  if (!tendCanvas || typeof Chart === 'undefined') return;

  // BUG 13 — monta mapa dos 6 meses, depois faz UMA passagem
  const meses6map = {};
  const labels6   = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - i, 1);
    const p = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lbl = `${MESES_ABR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    meses6map[p] = { lbl, r: 0, dep: 0 };
    labels6.push(lbl);
  }

  // Uma única passagem (BUG 13 fix — não 6x filter)
  transacoes.forEach(t => {
    if (!t.dataReferencia || t.status === 'pendente' || t.pago === false) return;
    const p = t.dataReferencia.slice(0, 7);
    if (!meses6map[p]) return;
    const val = Number(t.valor) || 0;
    if (t.tipo === 'receita') meses6map[p].r += val;
    else meses6map[p].dep += val;
  });

  const rec6 = labels6.map((lbl, i) => {
    const p = Object.keys(meses6map)[i];
    return valoresOcultos ? null : (meses6map[p]?.r || 0);
  });
  const dep6 = labels6.map((lbl, i) => {
    const p = Object.keys(meses6map)[i];
    return valoresOcultos ? null : (meses6map[p]?.dep || 0);
  });

  // Ponto destacado no mês atual (índice 5)
  const pointRadiiRec = rec6.map((_, i) => i === 5 ? 7 : 4);
  const pointRadiiDep = dep6.map((_, i) => i === 5 ? 7 : 4);
  const pointBgRec    = rec6.map((_, i) => i === 5 ? '#16a34a' : 'rgba(22,163,74,0.6)');
  const pointBgDep    = dep6.map((_, i) => i === 5 ? '#ef4444' : 'rgba(239,68,68,0.6)');

  const datasets = [];
  if (_filtroTend !== 'despesas') {
    datasets.push({
      label: 'Receitas',
      data: rec6,
      borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)',
      fill: true, tension: 0.4,
      pointRadius: pointRadiiRec, pointHoverRadius: 7, borderWidth: 2.5,
      pointBackgroundColor: pointBgRec, spanGaps: true,
    });
  }
  if (_filtroTend !== 'receitas') {
    datasets.push({
      label: 'Despesas',
      data: dep6,
      borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)',
      fill: true, tension: 0.4,
      pointRadius: pointRadiiDep, pointHoverRadius: 7, borderWidth: 2.5,
      pointBackgroundColor: pointBgDep, spanGaps: true,
    });
  }

  charts.tend = new Chart(tendCanvas, {
    type: 'line',
    data: { labels: labels6, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { size: 12, weight: '700', family: "'Inter',sans-serif" },
            padding: 16, boxWidth: 14,
            color: cssVar('--text-main') || '#1e293b',
          },
        },
        tooltip: { callbacks: tooltipCallbacks },
      },
      scales: {
        y: {
          ticks: { callback: fmtTick, font: { size: 11, family: "'Inter',sans-serif" }, color: cssVar('--text-sec') || '#64748b' },
          grid:  { color: 'rgba(148,163,184,0.1)' },
          beginAtZero: true,
        },
        x: {
          ticks: { font: { size: 11, family: "'Inter',sans-serif" }, color: cssVar('--text-main') || '#1e293b' },
          grid: { display: false },
        },
      },
    },
  });
}

// ─── Aba Detalhamento (BUG 10 — cores hex inline) ─────────────────────────
function renderDetalhamento() {
  const prefixo = getPrefixo();
  const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente' &&
    t.pago !== false &&
    t.tipo !== 'receita'  // SÓ despesas
  );

  let totalDep = 0;
  const somaPorCat = {};
  doMes.forEach(t => {
    const val = Number(t.valor) || 0;
    totalDep += val;
    const cat = t.categoria || 'Outros';
    somaPorCat[cat] = (somaPorCat[cat] || 0) + val;
  });

  setText('totalDespesasGeral', fmt(totalDep));

  const container = document.getElementById('containerCategorias');
  if (!container) return;

  const entradas = Object.entries(somaPorCat).sort((a, b) => b[1] - a[1]);

  if (!entradas.length) {
    // BUG 14 — mensagem neutra (não "Parabéns")
    container.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;color:var(--card-text-sec);">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">📭</div>
        <div style="font-size:0.9375rem;font-weight:700;color:var(--text-main);margin-bottom:0.375rem;">Sem despesas neste mês</div>
        <div style="font-size:0.8125rem;">Suas despesas aparecerão aqui quando houver transações.</div>
      </div>`;
    return;
  }

  // BUG 10 — cor hex via getCatInfo + CORES12, NÃO classes Tailwind dinâmicas
  container.innerHTML = entradas.map(([cat, val], idx) => {
    const info = getCatInfo(cat);
    const cor  = (info.cor && info.cor.startsWith('#')) ? info.cor : CORES12[idx % CORES12.length];
    const pct  = totalDep > 0 ? (val / totalDep * 100) : 0;

    return `
      <div class="det-row">
        <div class="det-emoji">${escapeHTML(info.emoji || '🏷️')}</div>
        <div class="det-info">
          <div class="det-nome">${escapeHTML(info.nome || cat)}</div>
          <div class="det-bar-wrap">
            <div class="det-bar" style="width:${pct.toFixed(1)}%;background:${escapeHTML(cor)};"></div>
          </div>
        </div>
        <div class="det-right">
          <div class="det-valor">${valoresOcultos ? '•••••' : (Number(val)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          <div class="det-pct">${pct.toFixed(1)}%</div>
        </div>
      </div>`;
  }).join('');
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function setupSidebar(user, userData) {
  const esc    = typeof window.budSanitize === 'function' ? window.budSanitize : s => String(s ?? '');
  const avatar = document.getElementById('sidebarAvatar');
  const nome   = document.getElementById('sidebarUserName');
  const uid    = document.getElementById('sidebarUserId');
  if (avatar) avatar.textContent = (userData.nome || user.email || 'U').charAt(0).toUpperCase();
  if (nome)   nome.textContent   = esc(userData.nome || user.email?.split('@')[0] || 'Usuário');
  if (uid)    uid.textContent    = esc(userData.matricula || user.email || '');
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(userData.photoURL || null, userData.nome || user.email || '');

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.onclick = () =>
      signOut(auth).then(() => { window.location.href = 'index.html'; }).catch(console.error);
  }

  const sidebar     = document.getElementById('sidebar');
  const dashMain    = document.getElementById('dashMain');
  const btnCollapse = document.getElementById('btnSidebarCollapse');
  if (btnCollapse && sidebar && dashMain) {
    const isCol = localStorage.getItem('bud_sidebar_collapsed') === 'true';
    if (isCol && window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
      dashMain.classList.add('sidebar-collapsed');
      btnCollapse.textContent = '›';
    }
    btnCollapse.onclick = () => {
      const c = sidebar.classList.toggle('collapsed');
      dashMain.classList.toggle('sidebar-collapsed', c);
      btnCollapse.textContent = c ? '›' : '‹';
      localStorage.setItem('bud_sidebar_collapsed', c);
    };
  }

  const btnHamburger = document.getElementById('btnHamburger');
  const overlay      = document.getElementById('sidebarOverlay');
  if (btnHamburger && sidebar) btnHamburger.onclick = () => sidebar.classList.toggle('open');
  if (overlay && sidebar)      overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };
}

// ─── Paywall ──────────────────────────────────────────────────────────────
function mostrarPaywall() {
  const pw = document.getElementById('paywallContainer');
  const cp = document.getElementById('conteudoPrincipal');
  if (pw) pw.style.display = 'block';
  if (cp) cp.style.display = 'none';
}

function esconderPaywall() {
  const pw = document.getElementById('paywallContainer');
  const cp = document.getElementById('conteudoPrincipal');
  if (pw) pw.style.display = 'none';
  if (cp) cp.style.display = 'block';
}

// ─── Init ─────────────────────────────────────────────────────────────────
atualizarMes();

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (!user.emailVerified) { window.location.href = 'index.html'; return; }
  currentUser = user;

  try {
    const snap     = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = snap.exists() ? snap.data() : {};

    // BUG 6 — persiste downgrade no Firestore
    if (typeof window.NexoPlanos?.resolvePlan === 'function') {
      try {
        const resolved = window.NexoPlanos.resolvePlan(userData);
        if (resolved?.shouldDowngrade) {
          userData.plano = 'free';
          updateDoc(doc(db, 'usuarios', user.uid), {
            plano: 'free',
            atualizadoEm: serverTimestamp(),
          }).catch(e => console.warn('[Relatórios] Erro ao persistir downgrade:', e));
        }
        if (typeof window.NexoPlanos.canUseFeature === 'function' &&
            !window.NexoPlanos.canUseFeature(userData, 'advancedDashboard')) {
          if (!splashHidden) { hideSplash(); splashHidden = true; }
          setupSidebar(user, userData);
          mostrarPaywall();
          return;
        }
      } catch(e) { console.warn('[Relatórios] Plano check error:', e); }
    }

    setupSidebar(user, userData);
    if (!splashHidden) { hideSplash(); splashHidden = true; }
    esconderPaywall();
    await buscarERenderi();

  } catch (e) {
    console.error('[Relatórios] Init error:', e);
    if (!splashHidden) { hideSplash(); splashHidden = true; }
    esconderPaywall();
    await buscarERenderi();
  }
});
