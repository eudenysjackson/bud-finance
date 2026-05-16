/**
 * js/comparativo.js — Bud Finance · Comparativo de Meses
 * Firebase SDK Modular v10.8.1 — sem compat layer.
 *
 * Bugs do cérebro corrigidos preventivamente:
 * BUG 1  — sem limit(5000) aleatório; usamos getDocs de todas as transações
 * BUG 2  — charts destruídos quando valoresOcultos (privacidade)
 * BUG 3  — filtra status !== 'pendente' em getDados()
 * BUG 4  — populaSelects(preservarSelecao) não reseta escolha do usuário
 * BUG 5  — getDocs (leitura única), não onSnapshot pesado
 * BUG 6  — diffLabel trata zero: "Novo" ao invés de "+100%"
 * BUG 7  — catsDespesa e catsReceita separados (não apenas despesas)
 * BUG 8  — downgrade de plano persistido no Firestore via updateDoc
 * BUG 9  — Number(t.valor)||0 em todos os cálculos (NaN-safe)
 * BUG 10 — sincronizarDados() re-busca do Firestore de verdade
 * BUG 11 — normalizarData() aceita string e Firestore Timestamp
 */

import { initializeApp, getApps }   from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, getDocs, getDoc, doc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ────────────────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ───────────────────────────────────────────────────────────────
let currentUser    = null;
let transacoes     = [];          // cache de TODAS as transações
let valoresOcultos = false;
let charts         = { comp: null, cats: null };
let _filtroGrafico = 'tudo';      // 'tudo' | 'receitas' | 'despesas'

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

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// BUG 11 — aceita string "YYYY-MM-DD" e Firestore Timestamp
function normalizarData(dr) {
  if (!dr) return null;
  if (typeof dr === 'string') return dr;
  if (typeof dr.toDate === 'function') {
    const d = dr.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return null;
}

// BUG 9 — formata com proteção NaN
const fmt = v => valoresOcultos
  ? 'R$ •••••'
  : (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function nomeMes(prefixo) {
  if (!prefixo || !prefixo.includes('-')) return prefixo || '—';
  const [ano, mes] = prefixo.split('-');
  return `${MESES_FULL[parseInt(mes, 10) - 1]} ${ano}`;
}

function getCatInfo(nome) {
  const pad = window.BUD_CATEGORIAS_PADRAO || {};
  const cats = [...(pad.despesa || []), ...(pad.receita || [])];
  return cats.find(c => c.nome === nome || c.nome?.toLowerCase() === nome?.toLowerCase())
    || { nome: nome || 'Outros', emoji: '🏷️', cor: '#64748b' };
}

// ─── getDados: retorna totais + categorias de um mês ──────────────────────
// BUG 3 — filtra pendentes | BUG 7 — separa catsDespesa/catsReceita | BUG 9 — Number()
function getDados(prefixo) {
  const doMes = transacoes.filter(t => {
    const dr = normalizarData(t.dataReferencia);     // BUG 11
    return dr && dr.startsWith(prefixo) && t.status !== 'pendente'; // BUG 3
  });

  let rec = 0, desp = 0;
  const catsDespesa = {}, catsReceita = {};

  doMes.forEach(t => {
    const val = Number(t.valor) || 0;                // BUG 9
    const cat = t.categoria || 'Outros';
    if (t.tipo === 'receita') {
      rec += val;
      catsReceita[cat] = (catsReceita[cat] || 0) + val;
    } else {
      desp += val;
      catsDespesa[cat] = (catsDespesa[cat] || 0) + val;
    }
  });

  return { rec, desp, saldo: rec - desp, trans: doMes.length, catsDespesa, catsReceita };
}

// ─── Popula os 4 selects com meses únicos ─────────────────────────────────
// BUG 4 — preserva seleção do usuário ao recarregar
function populaSelects(preservarSelecao = false) {
  // BUG 11 — usa normalizarData para obter prefixo
  const meses = new Set();
  transacoes.forEach(t => {
    const dr = normalizarData(t.dataReferencia);
    if (dr && dr.length >= 7) meses.add(dr.substring(0, 7));
  });
  const sorted = Array.from(meses).sort().reverse();
  if (!sorted.length) return;

  // Salvar seleções atuais se preservar
  const sel1Atual = preservarSelecao ? document.getElementById('mes1')?.value : null;
  const sel2Atual = preservarSelecao ? document.getElementById('mes2')?.value : null;

  const opts = sorted.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(nomeMes(m))}</option>`).join('');
  ['mes1','mes2','mes1Mobile','mes2Mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });

  // Restaurar ou aplicar defaults
  const default1 = sorted.length >= 2 ? sorted[1] : sorted[0];
  const default2 = sorted[0];

  const v1 = (preservarSelecao && sel1Atual && sorted.includes(sel1Atual)) ? sel1Atual : default1;
  const v2 = (preservarSelecao && sel2Atual && sorted.includes(sel2Atual)) ? sel2Atual : default2;

  ['mes1','mes1Mobile'].forEach(id => { const el = document.getElementById(id); if (el) el.value = v1; });
  ['mes2','mes2Mobile'].forEach(id => { const el = document.getElementById(id); if (el) el.value = v2; });

  // Registrar eventos .onchange (idempotente — sobrescreve)
  const onChange = id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = () => {
      // Sincronizar par desktop/mobile
      if (id === 'mes1')       { const m = document.getElementById('mes1Mobile'); if (m) m.value = el.value; }
      if (id === 'mes1Mobile') { const m = document.getElementById('mes1');       if (m) m.value = el.value; }
      if (id === 'mes2')       { const m = document.getElementById('mes2Mobile'); if (m) m.value = el.value; }
      if (id === 'mes2Mobile') { const m = document.getElementById('mes2');       if (m) m.value = el.value; }
      comparar();
    };
  };
  ['mes1','mes2','mes1Mobile','mes2Mobile'].forEach(onChange);

  buildCustomSelects();
}

// ─── Custom Select IDV ────────────────────────────────────────────────────
const CS_PARTNER = { mes1:'mes1Mobile', mes1Mobile:'mes1', mes2:'mes2Mobile', mes2Mobile:'mes2' };

function _csUpdateLabel(id) {
  const native = document.getElementById(id);
  const cs     = document.getElementById('cs-' + id);
  if (!native || !cs) return;
  const label = cs.querySelector('.custom-select-label');
  const sel   = native.options[native.selectedIndex];
  if (label) label.textContent = sel ? sel.text : '—';
  cs.querySelectorAll('.custom-select-option').forEach(optEl => {
    optEl.classList.toggle('selected', optEl.dataset.value === native.value);
  });
}

function buildCustomSelects() {
  ['mes1','mes2','mes1Mobile','mes2Mobile'].forEach(id => {
    const native = document.getElementById(id);
    const cs     = document.getElementById('cs-' + id);
    if (!native || !cs) return;
    const dropdown = cs.querySelector('.custom-select-dropdown');
    if (dropdown) {
      dropdown.innerHTML = Array.from(native.options).map(opt =>
        `<div class="custom-select-option${opt.value === native.value ? ' selected' : ''}" data-value="${escapeHTML(opt.value)}">${escapeHTML(opt.text)}</div>`
      ).join('');
      dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
        optEl.onclick = e => {
          e.stopPropagation();
          const val       = optEl.dataset.value;
          native.value    = val;
          const partnerId = CS_PARTNER[id];
          const partner   = document.getElementById(partnerId);
          if (partner) partner.value = val;
          _csUpdateLabel(id);
          _csUpdateLabel(partnerId);
          cs.classList.remove('open');
          comparar();
        };
      });
    }
    _csUpdateLabel(id);
    const btn = cs.querySelector('.custom-select-btn');
    if (btn) {
      btn.onclick = e => {
        e.stopPropagation();
        const wasOpen = cs.classList.contains('open');
        document.querySelectorAll('.custom-select.open').forEach(c => c.classList.remove('open'));
        if (!wasOpen) cs.classList.add('open');
      };
    }
  });
}

// ─── BUG 6 — diffLabel trata base zero ─────────────────────────────────────
function calcDiffLabel(v1, v2) {
  if (v1 === 0 && v2 === 0) return { label: '=',    cls: 'neutro' };
  if (v1 === 0)             return { label: 'Novo', cls: 'novo' };
  if (v2 === 0)             return { label: 'Zerou', cls: 'neutro' };
  const pct = Math.round(((v2 - v1) / Math.abs(v1)) * 100);
  const sinal = pct > 0 ? '+' : '';
  return { label: `${sinal}${pct}%`, cls: pct > 0 ? 'positivo' : pct < 0 ? 'negativo' : 'neutro' };
}
// ─── Badge de variação M2 vs M1 ───────────────────────────────────────────
function renderKpiBadge(elId, v1, v2) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (valoresOcultos || (v1 === 0 && v2 === 0)) { el.style.display = 'none'; return; }
  const diff = calcDiffLabel(v1, v2);
  el.textContent = diff.label;
  el.className = 'var-badge ' + diff.cls;
  el.style.display = 'inline-flex';
}
// ─── Renderiza seção de categorias lado a lado ─────────────────────────────
function renderCatComp(containerId, catsM1, catsM2, cor1, cor2, emptyMsg) {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  // União de categorias de ambos os meses
  const todasCats = Array.from(new Set([...Object.keys(catsM1), ...Object.keys(catsM2)]));
  if (!todasCats.length) {
    cont.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--card-text-sec);font-size:0.8125rem;">${emptyMsg}</div>`;
    return;
  }

  // Ordenar pelo maior valor entre os dois meses, top 10
  const ordenadas = todasCats
    .map(cat => ({ cat, maxVal: Math.max(catsM1[cat] || 0, catsM2[cat] || 0) }))
    .sort((a, b) => b.maxVal - a.maxVal)
    .slice(0, 10);

  const maxGlobal = ordenadas[0]?.maxVal || 1;

  const linhas = ordenadas.map(({ cat }) => {
    const v1    = catsM1[cat] || 0;
    const v2    = catsM2[cat] || 0;
    const info  = getCatInfo(cat);
    const pct1  = ((Math.max(v1, 0) / maxGlobal) * 100).toFixed(1);
    const pct2  = ((Math.max(v2, 0) / maxGlobal) * 100).toFixed(1);
    const diff  = calcDiffLabel(v1, v2);
    const nomeSafe = escapeHTML(info.nome || cat);
    const emojiSafe = escapeHTML(info.emoji || '🏷️');

    return `
      <div class="cat-comp-row">
        <div class="cat-comp-head">
          <span class="cat-comp-emoji">${emojiSafe}</span>
          <span class="cat-comp-name">${nomeSafe}</span>
          <span class="var-badge ${diff.cls}">${escapeHTML(diff.label)}</span>
        </div>
        <div class="cat-bar-pair">
          <div class="cat-bar-line">
            <div class="cat-bar-dot" style="background:${cor1};"></div>
            <div class="cat-bar-wrap">
              <div class="cat-bar-fill" style="width:${pct1}%;background:${cor1};"></div>
            </div>
            <div class="cat-bar-val">${valoresOcultos ? '•••••' : (v1||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div class="cat-bar-line">
            <div class="cat-bar-dot" style="background:${cor2};"></div>
            <div class="cat-bar-wrap">
              <div class="cat-bar-fill" style="width:${pct2}%;background:${cor2};"></div>
            </div>
            <div class="cat-bar-val">${valoresOcultos ? '•••••' : (v2||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
        </div>
      </div>`;
  });

  cont.innerHTML = linhas.join('');
}

// ─── Core: comparar() ──────────────────────────────────────────────────────
function comparar() {
  const p1 = document.getElementById('mes1')?.value;
  const p2 = document.getElementById('mes2')?.value;
  if (!p1 || !p2) return;

  const d1 = getDados(p1);
  const d2 = getDados(p2);
  const nome1 = nomeMes(p1);
  const nome2 = nomeMes(p2);

  // ── KPI cards ─────────────────────────────────────────
  setText('nomeM1', nome1);
  setText('nomeM2', nome2);
  setText('m1Rec',   fmt(d1.rec));
  setText('m1Dep',   fmt(d1.desp));
  setText('m1Trans', d1.trans);
  setText('m2Rec',   fmt(d2.rec));
  setText('m2Dep',   fmt(d2.desp));
  setText('m2Trans', d2.trans);

  const saldo1El = document.getElementById('m1Saldo');
  const saldo2El = document.getElementById('m2Saldo');
  if (saldo1El) {
    saldo1El.textContent   = fmt(Math.abs(d1.saldo));
    saldo1El.style.color   = d1.saldo >= 0 ? '#16a34a' : '#dc2626';
  }
  if (saldo2El) {
    saldo2El.textContent   = fmt(Math.abs(d2.saldo));
    saldo2El.style.color   = d2.saldo >= 0 ? '#16a34a' : '#dc2626';
  }

  // ── Badges de variação M2 vs M1 ──────────────────────────────
  renderKpiBadge('m2RecBadge',   d1.rec,   d2.rec);
  renderKpiBadge('m2DepBadge',   d1.desp,  d2.desp);
  renderKpiBadge('m2SaldoBadge', d1.saldo, d2.saldo);

  // ── Estado vazio por mês ────────────────────────────────────
  const av1 = document.getElementById('avisoVazioM1');
  const av2 = document.getElementById('avisoVazioM2');
  if (av1) av1.style.display = d1.trans === 0 ? 'flex' : 'none';
  if (av2) av2.style.display = d2.trans === 0 ? 'flex' : 'none';

  // ── Chips filtro gráfico ──────────────────────────────────────
  ['chipGraficoTudo','chipGraficoReceitas','chipGraficoDespesas'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  const activeChipId = _filtroGrafico === 'receitas' ? 'chipGraficoReceitas'
    : _filtroGrafico === 'despesas' ? 'chipGraficoDespesas' : 'chipGraficoTudo';
  document.getElementById(activeChipId)?.classList.add('active');

  // ── Insight textual ──────────────────────────────────────────
  const insightEl   = document.getElementById('insightDestaque');
  const insightTit  = document.getElementById('insightTitulo');
  const insightDesc = document.getElementById('insightDesc');
  if (insightEl) {
    if (!valoresOcultos) {
      const todasCatsDep = new Set([...Object.keys(d1.catsDespesa), ...Object.keys(d2.catsDespesa)]);
      let maiorDelta = 0, maiorCat = null, iV1 = 0, iV2 = 0;
      todasCatsDep.forEach(cat => {
        const c1 = d1.catsDespesa[cat] || 0;
        const c2 = d2.catsDespesa[cat] || 0;
        const delta = c2 - c1;
        if (delta > maiorDelta) { maiorDelta = delta; maiorCat = cat; iV1 = c1; iV2 = c2; }
      });
      if (maiorCat && maiorDelta > 0) {
        const info = getCatInfo(maiorCat);
        const diff = calcDiffLabel(iV1, iV2);
        if (insightTit)  insightTit.textContent  = `${info.emoji || '🏷️'} ${info.nome || maiorCat} — maior alta de despesas`;
        if (insightDesc) insightDesc.textContent = `${fmt(iV2)} em ${nome2} vs ${fmt(iV1)} em ${nome1} (${diff.label})`;
        insightEl.style.display = 'flex';
      } else {
        insightEl.style.display = 'none';
      }
    } else {
      insightEl.style.display = 'none';
    }
  }

  // Atualizar legenda do gráfico
  const lgEl = document.getElementById('legendaGrafico');
  if (lgEl) lgEl.textContent = `${nome1} vs ${nome2}`;

  // ── BUG 2 — charts ocultos quando valoresOcultos ──────
  const chartCompWrap = document.getElementById('chartComparativoWrap');
  const chartCatsWrap = document.getElementById('chartCategoriasWrap');

  if (valoresOcultos) {
    if (charts.comp) { charts.comp.destroy(); charts.comp = null; }
    if (charts.cats) { charts.cats.destroy(); charts.cats = null; }
    const ph = '<div class="chart-placeholder">👁 Desative "Valores" para ver os gráficos</div>';
    if (chartCompWrap) chartCompWrap.innerHTML = ph;
    if (chartCatsWrap) chartCatsWrap.innerHTML = ph;
    // Ainda renderiza categorias (apenas texto, já usa fmt)
    renderCatComp('catDepContainer', d1.catsDespesa, d2.catsDespesa, '#3b82f6', '#8b5cf6', 'Nenhuma despesa nos períodos selecionados');
    renderCatComp('catRecContainer', d1.catsReceita,  d2.catsReceita,  '#3b82f6', '#8b5cf6', 'Nenhuma receita nos períodos selecionados');
    return;
  }

  // ── Filtro do gráfico principal ─────────────────────────────────
  let chartLabels, chartD1Data, chartD2Data;
  if (_filtroGrafico === 'receitas') {
    chartLabels = ['Receitas'];             chartD1Data = [d1.rec];          chartD2Data = [d2.rec];
  } else if (_filtroGrafico === 'despesas') {
    chartLabels = ['Despesas'];             chartD1Data = [d1.desp];         chartD2Data = [d2.desp];
  } else {
    chartLabels = ['Receitas', 'Despesas', 'Saldo'];
    chartD1Data = [d1.rec, d1.desp, d1.saldo];
    chartD2Data = [d2.rec, d2.desp, d2.saldo];
  }

  // ── Gráfico Totais (barras agrupadas) ─────────────────
  if (chartCompWrap) chartCompWrap.innerHTML = '<div class="chart-wrap"><canvas id="chartComparativo"></canvas></div>';
  if (charts.comp) { charts.comp.destroy(); charts.comp = null; }
  const ctx1 = document.getElementById('chartComparativo');
  if (ctx1 && typeof Chart !== 'undefined') {
    charts.comp = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: nome1,
            data: chartD1Data,
            backgroundColor: 'rgba(59,130,246,0.75)',
            borderRadius: 6,
          },
          {
            label: nome2,
            data: chartD2Data,
            backgroundColor: 'rgba(139,92,246,0.75)',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'top', labels: { font: { family: "'Inter',sans-serif", size: 12, weight: '700' } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              font: { family: "'Inter',sans-serif", size: 11 },
              callback: v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            },
            grid: { color: 'rgba(148,163,184,0.15)' },
          },
          x: {
            ticks: { font: { family: "'Inter',sans-serif", size: 12, weight: '700' } },
            grid: { display: false },
          },
        },
      },
    });
  }

  // ── Categorias texto ──────────────────────────────────
  renderCatComp('catDepContainer', d1.catsDespesa, d2.catsDespesa, '#3b82f6', '#8b5cf6', 'Nenhuma despesa nos períodos selecionados');
  renderCatComp('catRecContainer', d1.catsReceita,  d2.catsReceita,  '#3b82f6', '#8b5cf6', 'Nenhuma receita nos períodos selecionados');

  // ── Gráfico top despesas por categoria ────────────────
  if (chartCatsWrap) chartCatsWrap.innerHTML = '<div class="chart-wrap"><canvas id="chartCategorias"></canvas></div>';
  if (charts.cats) { charts.cats.destroy(); charts.cats = null; }
  const ctx2 = document.getElementById('chartCategorias');
  if (ctx2 && typeof Chart !== 'undefined') {
    // Union top 8 categorias de despesas
    const todasDep = Array.from(new Set([...Object.keys(d1.catsDespesa), ...Object.keys(d2.catsDespesa)]));
    const topDep = todasDep
      .map(cat => ({ cat, max: Math.max(d1.catsDespesa[cat] || 0, d2.catsDespesa[cat] || 0) }))
      .sort((a, b) => b.max - a.max)
      .slice(0, 8);

    if (topDep.length) {
      const labels    = topDep.map(({ cat }) => getCatInfo(cat).emoji + ' ' + (getCatInfo(cat).nome || cat));
      const dataM1    = topDep.map(({ cat }) => d1.catsDespesa[cat] || 0);
      const dataM2    = topDep.map(({ cat }) => d2.catsDespesa[cat] || 0);

      charts.cats = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: nome1, data: dataM1, backgroundColor: 'rgba(59,130,246,0.75)', borderRadius: 5 },
            { label: nome2, data: dataM2, backgroundColor: 'rgba(139,92,246,0.75)', borderRadius: 5 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top', labels: { font: { family: "'Inter',sans-serif", size: 12, weight: '700' } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                font: { family: "'Inter',sans-serif", size: 11 },
                callback: v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
              },
              grid: { color: 'rgba(148,163,184,0.15)' },
            },
            x: {
              ticks: { font: { family: "'Inter',sans-serif", size: 11 } },
              grid: { display: false },
            },
          },
        },
      });
    } else {
      chartCatsWrap.innerHTML = '<div class="chart-placeholder">Sem despesas para comparar por categoria</div>';
    }
  }
}

// ─── Helpers DOM ──────────────────────────────────────────────────────────
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

// ─── Globals ──────────────────────────────────────────────────────────────
window.toggleOcultarValores = function () {
  valoresOcultos = !valoresOcultos;
  const btn = document.getElementById('btnOcultarValores');
  if (btn) btn.textContent = valoresOcultos ? '🙈 Valores' : '👁 Valores';
  comparar();
};

// BUG 10 — re-busca do Firestore de verdade
window.sincronizarDados = async function () {
  if (!currentUser) return;
  try {
    const snap = await getDocs(collection(db, 'usuarios', currentUser.uid, 'transacoes'));
    transacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populaSelects(true); // BUG 4 — preserva seleção
    comparar();
    showToast('Dados atualizados!', 'ok');
  } catch (e) {
    console.error('[Comparativo] Erro ao sincronizar:', e);
    showToast('Erro ao atualizar dados', 'error');
  }
};
window.inverterMeses = function () {
  const v1 = document.getElementById('mes1')?.value;
  const v2 = document.getElementById('mes2')?.value;
  if (!v1 || !v2) return;
  ['mes1','mes1Mobile'].forEach(id => { const el = document.getElementById(id); if (el) el.value = v2; });
  ['mes2','mes2Mobile'].forEach(id => { const el = document.getElementById(id); if (el) el.value = v1; });
  ['mes1','mes2','mes1Mobile','mes2Mobile'].forEach(_csUpdateLabel);
  comparar();
};

window.vsAnoPassado = function () {
  const el2 = document.getElementById('mes2');
  if (!el2 || !el2.options.length) return;
  const latestPrefixo = el2.options[0]?.value;
  if (!latestPrefixo) return;
  const [ano, mes] = latestPrefixo.split('-').map(Number);
  const prefixoPassado = `${ano - 1}-${String(mes).padStart(2, '0')}`;
  const opcoes = Array.from(el2.options).map(o => o.value);
  if (!opcoes.includes(prefixoPassado)) {
    showToast(`Sem dados de ${nomeMes(prefixoPassado)}`, 'error');
    return;
  }
  ['mes2','mes2Mobile'].forEach(id => { const el = document.getElementById(id); if (el) el.value = latestPrefixo; });
  ['mes1','mes1Mobile'].forEach(id => { const el = document.getElementById(id); if (el) el.value = prefixoPassado; });
  ['mes1','mes2','mes1Mobile','mes2Mobile'].forEach(_csUpdateLabel);
  comparar();
};

window.filtrarGrafico = function (filtro) {
  _filtroGrafico = filtro;
  comparar();
};
// ─── Sidebar ──────────────────────────────────────────────────────────────
function setupSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const main     = document.getElementById('dashMain');
  const btnCol   = document.getElementById('btnSidebarCollapse');
  const btnHam   = document.getElementById('btnHamburger');
  const overlay  = document.getElementById('sidebarOverlay');
  const btnLogout = document.getElementById('btnLogout');

  const collapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (collapsed && window.innerWidth > 768) {
    sidebar.classList.add('collapsed');
    main.classList.add('sidebar-collapsed');
    if (btnCol) btnCol.textContent = '›';
  }

  btnCol?.addEventListener('click', () => {
    const isCol = sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed', isCol);
    btnCol.textContent = isCol ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', isCol);
  });

  btnHam?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // Fechar custom selects ao clicar fora
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach(cs => cs.classList.remove('open'));
  });

  btnLogout?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

function preencherSidebarUser(user) {
  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
  const avatar  = document.getElementById('sidebarAvatar');
  const nome    = document.getElementById('sidebarUserName');
  const uid     = document.getElementById('sidebarUserId');
  const esc     = typeof window.budSanitize === 'function' ? window.budSanitize : s => String(s ?? '');
  if (avatar) avatar.textContent = initial;
  if (nome)   nome.textContent   = esc(user.displayName || user.email?.split('@')[0] || 'Usuário');
  if (uid)    uid.textContent    = esc(user.email || '');
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
setupSidebar();

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (!user.emailVerified) { window.location.href = 'index.html'; return; }

  currentUser = user;
  preencherSidebarUser(user);

  // ── Verificar plano ────────────────────────────────────
  try {
    const snap     = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = snap.exists() ? snap.data() : {};

    // BUG 8 — persiste downgrade no Firestore
    if (typeof window.NexoPlanos?.resolvePlan === 'function') {
      const resolved = window.NexoPlanos.resolvePlan(userData);
      if (resolved?.shouldDowngrade) {
        userData.plano = 'free';
        updateDoc(doc(db, 'usuarios', user.uid), {
          plano: 'free',
          atualizadoEm: serverTimestamp(),
        }).catch(e => console.warn('[Comparativo] Erro ao persistir downgrade:', e));
      }
    }

    // Verificar feature gate (fallback permissivo se NexoPlanos não carregou)
    const temAcesso = typeof window.NexoPlanos?.canUseFeature === 'function'
      ? window.NexoPlanos.canUseFeature(userData, 'monthlyComparative')
      : true;

    if (!temAcesso) {
      mostrarPaywall();
      hideSplash();
      return;
    }

    esconderPaywall();

    // BUG 1/5 — getDocs (leitura única, não onSnapshot)
    const tSnap = await getDocs(collection(db, 'usuarios', user.uid, 'transacoes'));
    transacoes  = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    hideSplash();
    populaSelects();  // primeira vez — sem preservar seleção
    comparar();

  } catch (e) {
    console.error('[Comparativo] Erro no init:', e);
    showToast('Erro ao carregar dados', 'error');
    hideSplash();
  }
});
