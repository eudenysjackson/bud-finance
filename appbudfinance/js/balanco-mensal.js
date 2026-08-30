/**
 * js/balanco-mensal.js — Bud Finance · Balanço Mensal
 * Firebase SDK Modular v10.8.1 — sem compat layer.
 *
 * Bugs do cérebro corrigidos preventivamente:
 * BUG 1  — query filtrada por range de data no servidor (não limit(5000) sem orderBy)
 * BUG 2  — setDate(1) antes de setMonth() para evitar salto de meses curtos (Fevereiro, etc.)
 * BUG 3  — filtra status !== 'pendente' antes de calcular totais
 * BUG 4  — getDocs (leitura única), não onSnapshot (desnecessário para tela read-only)
 * BUG 5  — separa receitas e despesas no ranking de categorias
 * BUG 6  — sincronizarDados() re-busca do Firestore de verdade
 * BUG 7  — downgrade de plano persistido no Firestore via updateDoc
 * BUG 9  — Number(t.valor)||0 em todos os cálculos (NaN-safe)
 * BUG 10 — normalizarData() aceita string e Firestore Timestamp
 */

import { initializeApp, getApps }   from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { connectEmulators } from './bud-emulator-connect.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, where, orderBy,
  getDocs, getDoc, doc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ────────────────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();
connectEmulators(auth, db);

// ─── Estado ───────────────────────────────────────────────────────────────
let currentUser    = null;
let transacoes     = [];          // cache do mês buscado
let transacoesAnterior = [];      // cache do mês anterior (variação KPIs)
let dataFiltro     = new Date();  // mês/ano selecionado
let anoSeletor     = new Date().getFullYear();
let valoresOcultos = false;
let _carregando    = false;
let _filtroDiaDia  = 'tudo';      // 'tudo' | 'receitas' | 'despesas'

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

const fmt = v => valoresOcultos
  ? 'R$ •••••'
  : (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABR  = ['Jan','Fev','Mar','Abr','Mai','Jun',
                    'Jul','Ago','Set','Out','Nov','Dez'];

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

function getPrefixo() {
  return `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}`;
}

function getCatInfo(nome) {
  const pad = window.BUD_CATEGORIAS_PADRAO || {};
  const cats = [...(pad.despesa || []), ...(pad.receita || [])];
  const found = cats.find(c => c.nome === nome || c.nome?.toLowerCase() === nome?.toLowerCase());
  return found || { nome: nome || 'Outros', emoji: '🏷️', cor: '#64748b' };
}

// ─── Navegação de mês ─────────────────────────────────────────────────────
function atualizarMes() {
  const txt = `${MESES_FULL[dataFiltro.getMonth()]} ${dataFiltro.getFullYear()}`;
  const el = document.getElementById('textoMes');
  if (el) el.textContent = txt;
}

// BUG 2 — setDate(1) ANTES de setMonth para evitar salto em meses curtos
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
  renderizar();
};

// BUG 6 — re-busca do Firestore de verdade
window.sincronizarDados = async function() {
  await buscarERenderi();
  showToast('Dados atualizados!', 'ok');
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
  fecharSeletorMes();
  buscarERenderi();
};

// ─── Busca Firestore (BUG 1 — query filtrada por range, BUG 4 — getDocs) ──
async function buscarERenderi() {
  if (!currentUser || _carregando) return;
  _carregando = true;
  try {
    const prefixo = getPrefixo();
    const dataIni = prefixo + '-01';
    const dataFim = prefixo + '-31'; // Firestore aceita datas inválidas como string; o filtro é lexicográfico

    // Mês anterior (para variação nos KPIs)
    const prevDate = new Date(dataFiltro);
    prevDate.setDate(1);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevPrefixo = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

    const [snap, snapAnt] = await Promise.all([
      getDocs(query(
        collection(db, 'usuarios', currentUser.uid, 'transacoes'),
        where('dataReferencia', '>=', dataIni),
        where('dataReferencia', '<=', dataFim),
        orderBy('dataReferencia', 'asc'),
      )),
      getDocs(query(
        collection(db, 'usuarios', currentUser.uid, 'transacoes'),
        where('dataReferencia', '>=', prevPrefixo + '-01'),
        where('dataReferencia', '<=', prevPrefixo + '-31'),
        orderBy('dataReferencia', 'asc'),
      )),
    ]);
    transacoes         = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    transacoesAnterior = snapAnt.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizar();
  } catch (e) {
    console.error('[Balanço] Erro ao buscar:', e);
    showToast('Erro ao carregar transações', 'error');
  } finally {
    _carregando = false;
  }
}

// ─── Render principal ─────────────────────────────────────────────────────
function renderizar() {
  const prefixo = getPrefixo();

  // BUG 3 — filtra pendentes; BUG 10 — normalizarData()
  const doMes = transacoes.filter(t => {
    const dr = normalizarData(t.dataReferencia);
    return dr && dr.startsWith(prefixo) && t.status !== 'pendente' && !t.transferencia;
  });

  // ── Estado vazio global ──────────────────────────────
  const estadoVazio = document.getElementById('estadoVazioGlobal');
  const secoes      = document.getElementById('secoesPrincipais');
  if (doMes.length === 0) {
    const tituloEl = document.getElementById('estadoVazioTitulo');
    if (tituloEl) tituloEl.textContent = `Nenhuma transação em ${MESES_FULL[dataFiltro.getMonth()]} ${dataFiltro.getFullYear()}`;
    if (estadoVazio) estadoVazio.style.display = 'block';
    if (secoes) secoes.style.display = 'none';
    return;
  }
  if (estadoVazio) estadoVazio.style.display = 'none';
  if (secoes) secoes.style.display = '';

  // BUG 5 — separa receitas e despesas; BUG 9 — Number() || 0
  let totalRec = 0, totalDep = 0;
  const porCatRec = {}, porCatDep = {};
  const porDia    = {};

  doMes.forEach(t => {
    const val = Number(t.valor) || 0;
    const cat = t.categoria || 'Outros';
    const dr  = normalizarData(t.dataReferencia);
    const dia = dr ? dr.split('-')[2] : '01';

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

  const saldo  = totalRec - totalDep;
  const qtdRec = doMes.filter(t => t.tipo === 'receita').length;
  const qtdDep = doMes.filter(t => t.tipo !== 'receita').length;

  // ── Variação vs mês anterior ─────────────────────────
  const prevDate = new Date(dataFiltro);
  prevDate.setDate(1);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevPrefixo = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
  const prevMesAbrv = MESES_ABR[prevDate.getMonth()];

  let totalRecAnt = 0, totalDepAnt = 0;
  transacoesAnterior.forEach(t => {
    const dr = normalizarData(t.dataReferencia);
    if (!dr || !dr.startsWith(prevPrefixo) || t.status === 'pendente') return;
    const val = Number(t.valor) || 0;
    if (t.tipo === 'receita') totalRecAnt += val; else totalDepAnt += val;
  });
  const saldoAnt = totalRecAnt - totalDepAnt;

  function renderVariacaoBadge(elId, atual, anterior, maiorEPior) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (anterior === 0) { el.style.cssText = 'display:none;'; return; }
    const pct  = ((atual - anterior) / Math.abs(anterior)) * 100;
    const bom  = maiorEPior ? pct <= 0 : pct >= 0;
    const seta = pct >= 0 ? '▲' : '▼';
    el.style.cssText = `display:inline-flex;align-items:center;gap:0.2rem;font-size:0.6875rem;font-weight:800;padding:0.15rem 0.45rem;border-radius:0.375rem;margin-top:0.3rem;background:${bom ? '#dcfce7' : '#fef2f2'};color:${bom ? '#16a34a' : '#dc2626'};`;
    el.textContent = `${seta} ${Math.abs(pct).toFixed(0)}% vs ${prevMesAbrv}`;
  }
  renderVariacaoBadge('kpiReceitasVar', totalRec, totalRecAnt, false);
  renderVariacaoBadge('kpiDespesasVar', totalDep, totalDepAnt, true);
  renderVariacaoBadge('kpiSaldoVar',    saldo,    saldoAnt,    false);

  // ── KPIs ──────────────────────────────────────────────
  setText('kpiReceitas',    fmt(totalRec));
  setText('kpiDespesas',    fmt(totalDep));
  setText('kpiSaldo',       fmt(Math.abs(saldo)));
  setText('kpiReceitasSub', `${qtdRec} ${qtdRec === 1 ? 'entrada' : 'entradas'}`);
  setText('kpiDespesasSub', `${qtdDep} ${qtdDep === 1 ? 'saída' : 'saídas'}`);

  const kpiSaldoEl = document.getElementById('kpiSaldo');
  if (kpiSaldoEl) kpiSaldoEl.style.color = saldo >= 0 ? '#16a34a' : '#dc2626';
  setText('kpiSaldoSub', saldo >= 0 ? 'resultado positivo ✅' : 'resultado negativo ⚠️');

  // ── Insight maior categoria de gasto ─────────────────
  const insightEl = document.getElementById('insightDestaque');
  if (insightEl) {
    const catDepEntries = Object.entries(porCatDep).sort((a, b) => b[1] - a[1]);
    if (catDepEntries.length && totalDep > 0) {
      const [topCat, topVal] = catDepEntries[0];
      const topInfo = getCatInfo(topCat);
      const topPct  = (topVal / totalDep * 100).toFixed(0);
      insightEl.style.display = 'flex';
      setText('insightCatEmoji', topInfo.emoji || '💸');
      setText('insightCatNome',  topInfo.nome || topCat);
      setText('insightCatValor', valoresOcultos ? '•••••' : topVal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
      setText('insightCatPct',   topPct + '%');
    } else {
      insightEl.style.display = 'none';
    }
  }

  // ── Comparativo ─────────────────────────────────────
  const total  = totalRec + totalDep;
  const pctRec = total > 0 ? (totalRec / total) * 100 : 50;
  const pctDep = total > 0 ? (totalDep / total) * 100 : 50;
  setStyle('compBarRec', `width:${pctRec.toFixed(1)}%;`);
  setStyle('compBarDep', `width:${pctDep.toFixed(1)}%;`);
  setText('compPctRec', pctRec.toFixed(0) + '%');
  setText('compPctDep', pctDep.toFixed(0) + '%');

  const comprEl = document.getElementById('compComprometimento');
  if (comprEl) {
    if (totalRec > 0) {
      const comprPct = (totalDep / totalRec) * 100;
      comprEl.style.display = '';
      comprEl.textContent = `⚠️ ${comprPct.toFixed(0)}% da renda comprometida`;
      comprEl.style.color = comprPct >= 90 ? '#dc2626' : comprPct >= 70 ? '#d97706' : '#16a34a';
    } else {
      comprEl.style.display = 'none';
    }
  }

  // ── Ranking de categorias ─────────────────────────────
  renderCats('catDespesasContainer', porCatDep, totalDep, '#dc2626', '💸 Nenhuma despesa no período');
  renderCats('catReceitasContainer', porCatRec, totalRec, '#16a34a', '💰 Nenhuma receita no período');

  // ── Dias sem gasto ────────────────────────────────────
  const diasDoMes    = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth()+1, 0).getDate();
  const diasComGasto = Object.keys(porDia).filter(d => porDia[d].dep > 0).length;
  const diasSemGasto = diasDoMes - diasComGasto;
  const dsgEl = document.getElementById('diasSemGastoInfo');
  if (dsgEl) dsgEl.textContent = diasSemGasto > 0 ? `📅 ${diasSemGasto} ${diasSemGasto === 1 ? 'dia' : 'dias'} sem despesas` : '';

  // ── Dia a dia ─────────────────────────────────────────
  renderDiaDia(porDia, _filtroDiaDia);
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function setStyle(id, cssText) {
  const el = document.getElementById(id);
  if (el) el.style.cssText = cssText;
}

function renderCats(containerId, porCat, total, cor, emptyMsg) {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  const entradas = Object.entries(porCat)
    .map(([cat, val]) => ({ cat, val }))
    .sort((a, b) => b.val - a.val);

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
    return `
      <div class="dia-row">
        <div class="dia-num">${escapeHTML(dia)}</div>
        <div class="dia-rec">${rec > 0 ? (valoresOcultos ? '•••••' : rec.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})) : '<span style="color:var(--card-text-sec)">—</span>'}</div>
        <div class="dia-dep">${dep > 0 ? (valoresOcultos ? '•••••' : dep.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})) : '<span style="color:var(--card-text-sec)">—</span>'}</div>
        <div class="dia-saldo ${salCls}">${valoresOcultos ? '•••••' : salSign + saldo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
      </div>`;
  });

  cont.innerHTML = header + linhas.join('');
}
// ─── Filtro dia a dia ─────────────────────────────────────────────
window.filtrarDiaDia = function(filtro) {
  _filtroDiaDia = filtro;
  ['tudo', 'receitas', 'despesas'].forEach(f => {
    const chip = document.getElementById('chip' + f.charAt(0).toUpperCase() + f.slice(1));
    if (chip) chip.className = 'chip-filtro' + (f === filtro ? ' ativo' : '');
  });
  const prefixo = getPrefixo();
  const porDia  = {};
  transacoes
    .filter(t => {
      const dr = normalizarData(t.dataReferencia);
      return dr && dr.startsWith(prefixo) && t.status !== 'pendente' && !t.transferencia;
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

// ─── Exportar PDF ─────────────────────────────────────────────────
window.exportarPDF = function() {
  window.print();
};
// ─── Sidebar: collapse + logout + hamburger ───────────────────────────────
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
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(null, user.displayName || user.email || '');
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
atualizarMes();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try { await user.reload(); user = auth.currentUser; } catch (_) { user = null; }
  }
  if (!user) { window.location.href = 'index.html'; return; }
  if (!user.emailVerified) { window.location.href = 'index.html'; return; }

  currentUser = user;
  preencherSidebarUser(user);

  // ── Verificar plano ────────────────────────────────────
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = snap.exists() ? snap.data() : {};
    if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(userData.photoURL || null, userData.nome || user.displayName || '');
    // BUG 7 — persiste downgrade no Firestore
    if (typeof window.NexoPlanos?.resolvePlan === 'function') {
      const resolved = window.NexoPlanos.resolvePlan(userData);
      if (resolved?.shouldDowngrade) {
        userData.plano = 'free';
        updateDoc(doc(db, 'usuarios', user.uid), {
          plano: 'free',
          atualizadoEm: serverTimestamp(),
        }).catch(e => console.warn('[Balanço] Erro ao persistir downgrade:', e));
      }
    }

    // Verifica feature gate 'advancedDashboard'
    const temAcesso = typeof window.NexoPlanos?.canUseFeature === 'function'
      ? window.NexoPlanos.canUseFeature(userData, 'advancedDashboard')
      : true; // fallback permissivo se NexoPlanos não carregar

    hideSplash();

    if (!temAcesso) {
      mostrarPaywall();
      return;
    }

    esconderPaywall();
    await buscarERenderi();

  } catch (e) {
    console.error('[Balanço] Erro ao carregar plano:', e);
    hideSplash();
    // Fallback: mostra conteúdo mesmo sem verificação de plano
    esconderPaywall();
    await buscarERenderi();
  }
});
