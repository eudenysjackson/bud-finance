/**
 * js/graficos.js — Bud Finance · Gráficos
 * Firebase SDK Modular v10.8.1 — sem compat layer.
 *
 * Bugs do cérebro corrigidos preventivamente:
 * BUG 1  — getDocs sem limit(5000), todos os dados carregados
 * BUG 2  — setDate(1) antes de setMonth() para evitar salto em meses curtos
 * BUG 3  — filtra status !== 'pendente' em todos os gráficos e tendência
 * BUG 4  — null safety no resolvePlan() + try/catch no bloco de plano
 * BUG 5  — tooltips respeitam valoresOcultos (callbacks em todos os 4 charts)
 * BUG 6  — getDocs (leitura única), não onSnapshot permanente
 * BUG 7  — Number(t.valor)||0 em todos os acumuladores (NaN-safe)
 * BUG 8  — downgrade de plano persistido no Firestore via updateDoc
 * BUG 9  — sincronizarDados() re-busca do Firestore de verdade
 * BUG 10 — normalizarData() aceita string "YYYY-MM-DD" e Firestore Timestamp
 */

import { initializeApp, getApps }   from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, getDocs, getDoc, doc, updateDoc, query, where,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ─────────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ───────────────────────────────────────────────────────────────────
let currentUser    = null;
let transacoes     = [];
let cartoesCredito = [];
let dataFiltro     = (() => { const d = new Date(); d.setDate(1); return d; })();
let anoSeletor     = dataFiltro.getFullYear();
let valoresOcultos = false;
let charts         = { cat: null, rd: null, tend: null, dia: null, fat: null };
let splashHidden   = false;
let _filtroTend    = 'ambos'; // 'ambos' | 'receitas' | 'despesas'

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// BUG 10 — aceita string "YYYY-MM-DD" e Firestore Timestamp
function normalizarData(dr) {
  if (!dr) return null;
  if (typeof dr === 'string') return dr;
  if (typeof dr.toDate === 'function') {
    const d = dr.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return null;
}

// BUG 7 — NaN-safe + privacidade
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

// BUG 5 — Tooltip callbacks respeitam valoresOcultos
const tooltipCallbacks = {
  label(ctx) {
    if (valoresOcultos) return (ctx.dataset.label || '') + ': •••••';
    const val = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : (ctx.parsed || 0);
    return (ctx.dataset.label || '') + ': ' +
      (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
};

const tooltipDoughnutCallbacks = {
  label(ctx) {
    if (valoresOcultos) return ctx.label + ': •••••';
    return ctx.label + ': ' +
      (Number(ctx.parsed) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

// Atualiza só o primeiro nó de texto do elemento (preserva filhos span)
function setKpiVal(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  for (const node of el.childNodes) {
    if (node.nodeType === 3) { node.textContent = text; return; }
  }
  el.insertBefore(document.createTextNode(text), el.firstChild);
}

// ─── Navegação de mês ─────────────────────────────────────────────────────────
function atualizarMes() {
  const el = document.getElementById('textoMes');
  if (el) el.textContent = MESES_FULL[dataFiltro.getMonth()] + ' ' + dataFiltro.getFullYear();
}

window.mudarMes = function(d) {
  dataFiltro.setDate(1); // BUG 2 fix
  dataFiltro.setMonth(dataFiltro.getMonth() + d);
  atualizarMes();
  renderizar();
};

window.toggleOcultarValores = function() {
  valoresOcultos = !valoresOcultos;
  const btn = document.getElementById('btnOcultarValores');
  if (btn) btn.textContent = valoresOcultos ? '🙈 Valores' : '👁 Valores';
  renderizar();
};

// Melhoria 7 — exportar PDF
window.exportarPDF = function() {
  window.print();
};

// Melhoria 7 — filtro tendência
window.filtrarTend = function(filtro) {
  _filtroTend = filtro;
  document.querySelectorAll('.chip-tend').forEach(c =>
    c.classList.toggle('chip-tend-ativo', c.dataset.filtro === filtro)
  );
  renderTendencia();
};

// BUG 9 — sincronizarDados re-busca do Firestore
window.sincronizarDados = async function() {
  if (!currentUser) return;
  try {
    const [snapTx, snapCart] = await Promise.all([
      getDocs(collection(db, 'usuarios', currentUser.uid, 'transacoes')),
      getDocs(query(collection(db, 'usuarios', currentUser.uid, 'carteira'), where('tipo', '==', 'credito'))),
    ]);
    transacoes = snapTx.docs.map(d => {
      const data = d.data();
      return { ...data, id: d.id, dataReferencia: normalizarData(data.dataReferencia) };
    });
    cartoesCredito = snapCart.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizar();
    showToast('Dados atualizados!', 'sucesso');
  } catch(e) {
    console.error('[Gráficos] sincronizarDados:', e);
    showToast('Erro ao atualizar dados.', 'erro');
  }
};

// ─── Seletor de mês (mobile) ──────────────────────────────────────────────────
window.abrirSeletorMes = function() {
  anoSeletor = dataFiltro.getFullYear();
  const label = document.getElementById('anoSeletorLabel');
  if (label) label.textContent = anoSeletor;
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
  const label = document.getElementById('anoSeletorLabel');
  if (label) label.textContent = anoSeletor;
  renderizarGridMeses();
};

function renderizarGridMeses() {
  const grid = document.getElementById('gridMesesSeletor');
  if (!grid) return;
  grid.innerHTML = MESES_ABR.map((n, i) => {
    const isAtivo = anoSeletor === dataFiltro.getFullYear() && i === dataFiltro.getMonth();
    return `<button class="bs-mes-btn${isAtivo ? ' ativo' : ''}" onclick="window.selecionarMes(${i})">${escapeHTML(n)}</button>`;
  }).join('');
}

window.selecionarMes = function(mes) {
  dataFiltro.setDate(1); // BUG 2 fix
  dataFiltro.setFullYear(anoSeletor);
  dataFiltro.setMonth(mes);
  atualizarMes();
  renderizar();
  window.fecharSeletorMes();
};

// ─── Helpers de cálculo de variação (Melhoria 5) ─────────────────────────────
function calcVariacao(vAtual, vAnterior) {
  if (vAnterior === 0 && vAtual === 0) return { txt: '=', cor: '#64748b' };
  if (vAnterior === 0) return { txt: 'Novo', cor: '#d97706' };
  const pct = ((vAtual - vAnterior) / vAnterior) * 100;
  if (Math.abs(pct) < 0.5) return { txt: '=', cor: '#64748b' };
  if (pct > 0) return { txt: '+' + pct.toFixed(0) + '%', cor: '#16a34a' };
  return { txt: pct.toFixed(0) + '%', cor: '#dc2626' };
}

function renderBadge(id, vAtual, vAnterior) {
  const el = document.getElementById(id);
  if (!el) return;
  if (valoresOcultos) { el.textContent = ''; return; }
  const v = calcVariacao(vAtual, vAnterior);
  el.textContent = v.txt;
  el.style.cssText = `display:inline-block;font-size:0.625rem;font-weight:800;padding:0.1rem 0.35rem;border-radius:0.375rem;margin-left:0.375rem;background:${v.cor}22;color:${v.cor};vertical-align:middle;`;
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
function destroyChart(key) {
  if (charts[key]) {
    try { charts[key].destroy(); } catch(e) {}
    charts[key] = null;
  }
}

// PEND-078: ao trocar de tema na sessão, atualiza cores de legend/ticks de todos os charts ativos
document.addEventListener('bud:themechange', () => {
  const textMain = cssVar('--text-main') || '#1e293b';
  const textSec  = cssVar('--text-sec')  || '#64748b';
  Object.values(charts).forEach(ch => {
    if (!ch) return;
    try {
      // Legend labels
      if (ch.options?.plugins?.legend?.labels) {
        ch.options.plugins.legend.labels.color = textMain;
      }
      // Escalas (ticks)
      if (ch.options?.scales) {
        Object.values(ch.options.scales).forEach(scale => {
          if (scale?.ticks) scale.ticks.color = textSec;
        });
      }
      ch.update();
    } catch(e) {}
  });
});



// Restaura o canvas se foi substituído por placeholder de estado vazio
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

// ─── Render ───────────────────────────────────────────────────────────────────
function renderizar() {
  const prefixo   = dataFiltro.getFullYear() + '-' + String(dataFiltro.getMonth() + 1).padStart(2, '0');
  const diasNaMes = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 0).getDate();

  // BUG 1 + BUG 3 — sem limit, sem pendentes
  const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente'
  );

  let receitas = 0, despesas = 0;
  const porCategoria = {};
  const porDia       = {};

  for (let d = 1; d <= diasNaMes; d++) {
    porDia[String(d).padStart(2, '0')] = 0;
  }

  doMes.forEach(t => {
    const val = Number(t.valor) || 0; // BUG 7 fix
    if (t.tipo === 'receita') {
      receitas += val;
    } else {
      despesas += val;
      const cat = t.categoria || 'Outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + val;
      const partes = t.dataReferencia ? t.dataReferencia.split('-') : [];
      const dia    = partes[2] || '01';
      porDia[dia]  = (porDia[dia] || 0) + val;
    }
  });

  const saldo = receitas - despesas;

  // ── Mês anterior para badges de variação (Melhoria 5) ─────────────────────
  const dAnt     = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 1, 1);
  const prefAnt  = dAnt.getFullYear() + '-' + String(dAnt.getMonth() + 1).padStart(2, '0');
  const doMesAnt = transacoes.filter(t =>
    t.dataReferencia && t.dataReferencia.startsWith(prefAnt) && t.status !== 'pendente'
  );
  let recAnt = 0, depAnt = 0;
  doMesAnt.forEach(t => {
    const val = Number(t.valor) || 0;
    if (t.tipo === 'receita') recAnt += val; else depAnt += val;
  });
  const saldoAnt = recAnt - depAnt;

  // ── KPI summary ─────────────────────────────────────────────────────────────
  setText('kpiTrans',    String(doMes.length));
  setKpiVal('kpiReceitas', fmt(receitas));
  setKpiVal('kpiDespesas', fmt(despesas));
  renderBadge('kpiRecBadge',  receitas, recAnt);
  renderBadge('kpiDepBadge',  despesas, depAnt);
  renderBadge('kpiSaldoBadge', Math.abs(saldo), Math.abs(saldoAnt));
  const saldoEl = document.getElementById('kpiSaldo');
  if (saldoEl) {
    setKpiVal('kpiSaldo', fmt(Math.abs(saldo)));
    saldoEl.style.color  = saldo >= 0 ? '#16a34a' : '#dc2626';
  }
  const saldoLbl = document.getElementById('kpiSaldoLabel');
  if (saldoLbl) saldoLbl.textContent = saldo >= 0 ? 'Saldo Positivo' : 'Saldo Negativo';

  // ── Insight automático (Melhoria 1) ───────────────────────────────────────
  renderInsight(receitas, despesas, saldo, recAnt, depAnt, porCategoria);

  // ── Chart 1: Doughnut — Despesas por Categoria ──────────────────────────────
  destroyChart('cat');
  const catWrap    = document.getElementById('wrapCategoria');
  const catEntries = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (catWrap) {
    if (catEntries.length === 0) {
      catWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:260px;font-size:0.875rem;font-weight:600;color:var(--card-text-sec);">Sem despesas neste mês</div>';
    } else {
      const canvas  = ensureCanvas('wrapCategoria', 'chartCategoria');
      const cores12 = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4',
                       '#f97316','#6366f1','#84cc16','#ef4444','#14b8a6','#a855f7'];
      const pad     = window.BUD_CATEGORIAS_PADRAO || { despesa: [], receita: [] };
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
              backgroundColor: cores12.slice(0, catEntries.length),
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
              // Melhoria 2 — percentual na tooltip
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
            // Melhoria 3 — clique na fatia abre detalhes
            onClick(evt, elements) {
              if (!elements.length) return;
              const idx   = elements[0].index;
              const [catNome] = catEntries[idx];
              abrirDetalheCategoria(catNome, cores12[idx % cores12.length], prefixo);
            },
          },
        });
      }
    }
  }

  // ── Chart 2: Bar — Receitas vs Despesas ─────────────────────────────────────
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

  // ── Chart 3: Line — Tendência 6 Meses ───────────────────────────────────────
  renderTendencia();

  // ── Chart 4: Bar — Gastos por Dia ───────────────────────────────────────────
  destroyChart('dia');
  const diaCanvas = ensureCanvas('wrapDiario', 'chartDiario');
  if (diaCanvas) {
    const diasLabels = Object.keys(porDia).sort();
    const diasVals   = diasLabels.map(d => valoresOcultos ? null : porDia[d]);
    charts.dia = new Chart(diaCanvas, {
      type: 'bar',
      data: {
        labels: diasLabels,
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

  // Guardar snapshot para modal de detalhe
  renderizar._lastDoMes = doMes;

  // ── Chart 5: Line — Comparativo de Faturas por Cartão ───────────────────────
  renderFaturas();
}

// ─── Melhoria 1 — Insight automático ─────────────────────────────────────────
function renderInsight(rec, dep, saldo, recAnt, depAnt, porCategoria) {
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
  if (!msg && depAnt > 0) {
    const pct = ((dep - depAnt) / depAnt) * 100;
    if (pct >= 20) {
      emoji = '⚠️';
      msg   = `Despesas subiram <strong>${pct.toFixed(0)}%</strong> em relação ao mês anterior.`;
    } else if (pct <= -20) {
      emoji = '✅';
      msg   = `Despesas reduziram <strong>${Math.abs(pct).toFixed(0)}%</strong> em relação ao mês anterior.`;
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

  if (!msg) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  const em   = el.querySelector('.insight-emoji');
  const span = el.querySelector('.insight-text');
  if (em)   em.textContent = emoji;
  if (span) span.innerHTML  = msg;
}

// ─── Melhoria 3 — Modal detalhe categoria ─────────────────────────────────────
function abrirDetalheCategoria(catNome, cor) {
  const modal = document.getElementById('modalDetalheCat');
  if (!modal) return;

  const transDoMes = (renderizar._lastDoMes || []).filter(t =>
    (t.categoria || 'Outros') === catNome && t.tipo !== 'receita'
  );
  const total = transDoMes.reduce((s, t) => s + (Number(t.valor) || 0), 0);

  const titulo  = modal.querySelector('.modal-cat-titulo');
  const subtit  = modal.querySelector('.modal-cat-subtit');
  const lista   = modal.querySelector('.modal-cat-lista');
  const barraEl = modal.querySelector('.modal-cat-barra');

  if (titulo)  titulo.textContent = catNome;
  if (subtit)  subtit.textContent = `${transDoMes.length} lançamento(s) — Total: ${fmt(total)}`;
  if (barraEl) barraEl.style.background = cor;

  if (lista) {
    if (transDoMes.length === 0) {
      lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-sec);font-size:0.875rem;">Sem lançamentos</div>';
    } else {
      lista.innerHTML = transDoMes
        .sort((a, b) => (b.dataReferencia || '').localeCompare(a.dataReferencia || ''))
        .map(t => {
          const val  = Number(t.valor) || 0;
          const data = t.dataReferencia ? t.dataReferencia.split('-').reverse().join('/') : '—';
          const desc = escapeHTML(t.descricao || t.categoria || 'Sem descrição');
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.625rem 0;border-bottom:1px solid var(--input-border);gap:0.5rem;">
            <div>
              <div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);">${desc}</div>
              <div style="font-size:0.6875rem;color:var(--text-sec);margin-top:0.125rem;">${data}</div>
            </div>
            <div style="font-size:0.875rem;font-weight:800;color:#dc2626;white-space:nowrap;">${fmt(val)}</div>
          </div>`;
        }).join('');
    }
  }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

window.fecharModalDetalheCat = function() {
  const modal = document.getElementById('modalDetalheCat');
  if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
};

// ─── Chart 5 — Comparativo de Faturas por Cartão (últimos 6 meses) ─────────
function renderFaturas() {
  destroyChart('fat');
  const wrapFat = document.getElementById('wrapFaturas');
  if (!wrapFat) return;

  if (cartoesCredito.length === 0) {
    wrapFat.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;font-size:0.875rem;font-weight:600;color:var(--card-text-sec);">Nenhum cartão de crédito cadastrado</div>';
    return;
  }

  const canvasFat = ensureCanvas('wrapFaturas', 'chartFaturas');
  if (!canvasFat) return;

  const labels6  = [];
  const fatPorCartao = cartoesCredito.map(() => []);
  const cores    = ['#8b5cf6','#3b82f6','#ec4899','#f59e0b','#10b981','#ef4444','#06b6d4','#f97316'];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - i, 1);
    const p = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    labels6.push(MESES_ABR[d.getMonth()] + '/' + String(d.getFullYear()).slice(2));
    cartoesCredito.forEach((cartao, ci) => {
      const total = transacoes
        .filter(t =>
          t.cartaoId === cartao.id &&
          t.dataReferencia && t.dataReferencia.startsWith(p) &&
          t.status !== 'pendente' &&
          !t.pagamentoFatura
        )
        .reduce((s, t) => s + (Number(t.valor) || 0), 0);
      fatPorCartao[ci].push(valoresOcultos ? null : total);
    });
  }

  // Só exibir cartões que têm ao menos 1 mês com fatura > 0
  const cartoesCom = cartoesCredito.filter((_, ci) => fatPorCartao[ci].some(v => v > 0));
  const dadosCom   = cartoesCredito
    .map((c, ci) => ({ cartao: c, dados: fatPorCartao[ci], cor: cores[ci % cores.length] }))
    .filter((_, ci) => fatPorCartao[ci].some(v => v > 0));

  if (dadosCom.length === 0) {
    wrapFat.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;font-size:0.875rem;font-weight:600;color:var(--card-text-sec);">Sem lançamentos nos últimos 6 meses</div>';
    return;
  }

  const canvasFat2 = ensureCanvas('wrapFaturas', 'chartFaturas');
  if (!canvasFat2) return;

  const datasets = dadosCom.map(({ cartao, dados, cor }) => ({
    label: cartao.nome || 'Cartão',
    data: dados,
    borderColor: cor,
    backgroundColor: cor + '18',
    fill: true, tension: 0.35,
    pointRadius: dados.map((_, j) => j === 5 ? 7 : 4),
    pointHoverRadius: 8, borderWidth: 2.5,
    pointBackgroundColor: dados.map((_, j) => j === 5 ? cor : cor + 'aa'),
    spanGaps: true,
  }));

  charts.fat = new Chart(canvasFat2, {
    type: 'line',
    data: { labels: labels6, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { size: 11, weight: '700', family: "'Inter',sans-serif" },
            padding: 12, boxWidth: 14,
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

// ─── Melhoria 7 — Render tendência separado (chips) ──────────────────────────
function renderTendencia() {
  destroyChart('tend');
  const tendCanvas = ensureCanvas('wrapTendencia', 'chartTendencia');
  if (!tendCanvas) return;

  const labels6 = [], rec6 = [], dep6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - i, 1);
    const p = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    labels6.push(MESES_ABR[d.getMonth()] + '/' + String(d.getFullYear()).slice(2));
    let r = 0, dep = 0;
    transacoes
      .filter(t => t.dataReferencia && t.dataReferencia.startsWith(p) && t.status !== 'pendente')
      .forEach(t => {
        const val = Number(t.valor) || 0;
        if (t.tipo === 'receita') r += val; else dep += val;
      });
    rec6.push(valoresOcultos ? null : r);
    dep6.push(valoresOcultos ? null : dep);
  }

  // Melhoria 4 — ponto destacado no mês atual (índice 5)
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
      pointBackgroundColor: pointBgRec,
      spanGaps: true,
    });
  }
  if (_filtroTend !== 'receitas') {
    datasets.push({
      label: 'Despesas',
      data: dep6,
      borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)',
      fill: true, tension: 0.4,
      pointRadius: pointRadiiDep, pointHoverRadius: 7, borderWidth: 2.5,
      pointBackgroundColor: pointBgDep,
      spanGaps: true,
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
function setupSidebar(user, userData) {
  const avatar   = document.getElementById('sidebarAvatar');
  const userName = document.getElementById('sidebarUserName');
  const userId   = document.getElementById('sidebarUserId');
  if (avatar)   avatar.textContent  = (userData.nome || user.email || 'U').charAt(0).toUpperCase();
  if (userName) userName.textContent = userData.nome || user.email || 'Usuário';
  if (userId)   userId.textContent   = userData.matricula || user.uid.slice(0, 8);
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(userData.photoURL || null, userData.nome || user.email || '');

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.onclick = () =>
      signOut(auth).then(() => { window.location.href = 'index.html'; }).catch(console.error);
  }

  const sidebar    = document.getElementById('sidebar');
  const dashMain   = document.getElementById('dashMain');
  const btnCollapse = document.getElementById('btnSidebarCollapse');
  if (btnCollapse && sidebar && dashMain) {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      dashMain.classList.add('sidebar-collapsed');
      btnCollapse.textContent = '›';
    }
    btnCollapse.onclick = () => {
      const c = sidebar.classList.toggle('collapsed');
      dashMain.classList.toggle('sidebar-collapsed', c);
      btnCollapse.textContent = c ? '›' : '‹';
      localStorage.setItem('sidebar_collapsed', c);
    };
  }

  const btnHamburger = document.getElementById('btnHamburger');
  const overlay      = document.getElementById('sidebarOverlay');
  if (btnHamburger && sidebar) {
    btnHamburger.onclick = () => sidebar.classList.toggle('open');
  }
  if (overlay && sidebar) {
    overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };
  }
}

// ─── Auth & Init ──────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;

  try {
    const userDoc  = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    // ── Plan check (BUG 4 + BUG 8) ───────────────────────────────────────────
    if (window.NexoPlanos) {
      try {
        const resolved = window.NexoPlanos.resolvePlan(userData);
        if (resolved && resolved.shouldDowngrade) {
          userData.plano = 'free';
          // BUG 8 — persistir downgrade no Firestore
          updateDoc(doc(db, 'usuarios', user.uid), { plano: 'free' }).catch(console.error);
        }
        if (typeof window.NexoPlanos.canUseFeature === 'function' &&
            !window.NexoPlanos.canUseFeature(userData, 'evolutionChart')) {
          const paywall  = document.getElementById('paywallContainer');
          const conteudo = document.getElementById('conteudoPrincipal');
          if (paywall)  paywall.style.display  = 'block';
          if (conteudo) conteudo.style.display = 'none';
          if (!splashHidden) { hideSplash(); splashHidden = true; }
          setupSidebar(user, userData);
          return;
        }
      } catch(e) {
        console.warn('[Gráficos] Plano check error:', e);
      }
    }

    setupSidebar(user, userData);

    // ── Fetch (BUG 1 + BUG 6 — getDocs, sem limit, sem onSnapshot) ──────────
    const [snap, snapCart] = await Promise.all([
      getDocs(collection(db, 'usuarios', user.uid, 'transacoes')),
      getDocs(query(collection(db, 'usuarios', user.uid, 'carteira'), where('tipo', '==', 'credito'))),
    ]);
    transacoes = snap.docs.map(d => {
      const data = d.data();
      return { ...data, id: d.id, dataReferencia: normalizarData(data.dataReferencia) };
    });
    cartoesCredito = snapCart.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!splashHidden) { hideSplash(); splashHidden = true; }
    atualizarMes();
    renderizar();

  } catch(e) {
    console.error('[Gráficos] init error:', e);
    if (!splashHidden) { hideSplash(); splashHidden = true; }
  }
});
