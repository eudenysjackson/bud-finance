/**
 * js/insights.js — Bud Finance · Insights e Análises (Fase 2 · Item 5)
 * Firebase SDK Modular v10.8.1 — sem compat layer.
 *
 * Bugs do cérebro corrigidos:
 * BUG 1  — sincronizarDados() re-busca Firestore (não location.reload)
 * BUG 2  — query range 6 meses no servidor (não limit(5000))
 * BUG 3  — getDocs (não onSnapshot) — sem race condition
 * BUG 4  — filtra pago !== false para score/alertas
 * BUG 5  — fmt() respeita valoresOcultos
 * BUG 6  — paywall usa #paywallContainer; hideSplash sempre chamado
 * BUG 7  — shouldDowngrade persiste via updateDoc + serverTimestamp
 * BUG 8  — variação comparativo → 'novo' quando v1===0 e v2>0
 * BUG 10 — sem variável dead charts={}
 * BUG 11 — semana começa na segunda (getDay()===0 → offset 6)
 * BUG 12 — saldoCarteira ajustado pelas despesas já pagas
 * BUG 13 — sem @keyframes slideRight
 * BUG 17 — insight frequência guarda getDate() <= 1
 */

import { initializeApp, getApps }   from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, where, orderBy,
  getDocs, getDoc, doc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
// firebase-messaging importado de forma dinâmica em ativarNotifPush() para não bloquear o módulo em file://

// ─── Firebase ─────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ───────────────────────────────────────────────────────────────
let currentUser     = null;
let transacoes      = [];
let limites         = [];
let dividas         = [];   // ← novo
let carteiraGlobal  = [];
let userData        = {};
let valoresOcultos  = false;
let abaAtual        = 'analises';
let compVal1        = '';
let compVal2        = '';
let compCharts      = {};
let _simState       = null;
let splashHidden    = false;

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
  splashHidden = true;
}

// BUG 5 — fmt respeita valoresOcultos
const fmt = v => valoresOcultos
  ? 'R$ •••••'
  : (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

function getPrefixoAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function getCatInfo(nome) {
  const pad  = window.BUD_CATEGORIAS_PADRAO || {};
  const cats = [...(pad.despesa || []), ...(pad.receita || [])];
  const found = cats.find(c => (c.nome || '').toLowerCase() === (nome || '').toLowerCase());
  return found || { nome: nome || 'Outros', emoji: '🏷️', cor: '#64748b' };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

// PEND-078: atualiza cores de legend/ticks ao trocar tema na sessão
document.addEventListener('bud:themechange', () => {
  const textMain = cssVar('--text-main') || '#1e293b';
  const textSec  = cssVar('--text-sec')  || '#64748b';
  const todos = [
    window._scoreHistChartInst,
    compCharts.bar,
    compCharts.cat,
  ].filter(Boolean);
  todos.forEach(ch => {
    try {
      if (ch.options?.plugins?.legend?.labels) {
        ch.options.plugins.legend.labels.color = textMain;
      }
      if (ch.options?.scales) {
        Object.values(ch.options.scales).forEach(scale => {
          if (scale?.ticks) scale.ticks.color = textSec;
        });
      }
      ch.update();
    } catch(e) {}
  });
});



// ─── Sidebar / layout helpers ──────────────────────────────────────────────
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const btnH     = document.getElementById('btnHamburger');
  const btnC     = document.getElementById('btnSidebarCollapse');

  if (btnH) btnH.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  if (overlay) overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
  if (btnC) btnC.addEventListener('click', () => {
    const main = document.getElementById('dashMain');
    sidebar.classList.toggle('collapsed');
    main && main.classList.toggle('sidebar-collapsed');
    btnC.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
  });
}

function initLogout() {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => signOut(auth).then(() => { window.location.href = 'index.html'; }));
}

function renderSidebarUser(u, ud) {
  const name = ud.nome || u.email || 'Usuário';
  const id   = ud.matricula || u.uid.slice(0, 8).toUpperCase();
  const el   = document.getElementById('sidebarUserName');
  const eli  = document.getElementById('sidebarUserId');
  const ava  = document.getElementById('sidebarAvatar');
  if (el)  el.textContent  = name;
  if (eli) eli.textContent = id;
  if (ava) ava.textContent = name.charAt(0).toUpperCase();
}

// ─── Busca de dados ────────────────────────────────────────────────────────
// BUG 2 — query 6 meses; BUG 3 — getDocs
async function buscarERenderi() {
  const uid = currentUser.uid;

  // BUG 2 — range 6 meses usando string YYYY-MM-DD
  const agora = new Date();
  // BUG 7 — setDate(1) antes de setMonth para evitar saltos
  const dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const pfxInicio  = `${dataInicio.getFullYear()}-${String(dataInicio.getMonth()+1).padStart(2,'0')}-01`;
  const pfxFim     = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-31`;

  const qTx = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    where('data', '>=', pfxInicio),
    where('data', '<=', pfxFim),
    orderBy('data', 'desc')
  );
  const qLim  = query(collection(db, 'usuarios', uid, 'limites'));
  const qCart = query(collection(db, 'usuarios', uid, 'carteira'));
  const qDiv  = query(collection(db, 'usuarios', uid, 'dividas'));

  const [snapTx, snapLim, snapCart, snapDiv] = await Promise.all([
    getDocs(qTx),
    getDocs(qLim),
    getDocs(qCart),
    getDocs(qDiv),
  ]);

  transacoes     = snapTx.docs.map(d => ({ id: d.id, ...d.data() }));
  limites        = snapLim.docs.map(d => ({ id: d.id, ...d.data() }));
  carteiraGlobal = snapCart.docs.map(d => ({ id: d.id, ...d.data() }));
  dividas        = snapDiv.docs.map(d => ({ id: d.id, ...d.data() }));

  renderTudo();
}

// ─── Render principal ─────────────────────────────────────────────────────
function renderTudo() {
  const pfx = getPrefixoAtual();

  // Transações do mês atual — BUG 4: filtra pago !== false
  const doMes = transacoes.filter(t =>
    (normalizarData(t.data) || '').startsWith(pfx) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );

  // Mês anterior
  const agora = new Date();
  const prevDate = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const pfxPrev  = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
  const doMesPrev = transacoes.filter(t =>
    (normalizarData(t.data) || '').startsWith(pfxPrev) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );

  renderAlertas(doMes, doMesPrev);
  renderEconomia(doMes);
  renderResumoSemanal(doMes);
  renderScore(doMes, doMesPrev);
  renderInsights(doMes, doMesPrev);
  renderSimulador(doMes);
  renderPushStatus();
  popularDropdownsComp();

  const now = new Date();
  const nomeMes = MESES_FULL[now.getMonth()];
  const el = document.getElementById('headerSubtitle');
  if (el) el.textContent = `Insights de ${nomeMes} ${now.getFullYear()}`;
}

// ─── Alertas ───────────────────────────────────────────────────────────────
function renderAlertas(doMes, doMesPrev) {
  const el = document.getElementById('alertasContainer');
  if (!el) return;

  const alertas = gerarAlertas(doMes, doMesPrev, limites);
  if (!alertas.length) {
    el.innerHTML = '<div class="alert-card alert-card-ok"><span class="alert-icon">✅</span><div class="alert-body"><div class="alert-title">Tudo certo!</div><div class="alert-desc">Nenhum alerta financeiro este mês. Continue assim!</div></div></div>';
    return;
  }
  el.innerHTML = alertas.map(a => `
    <div class="alert-card alert-card-${a.tipo}">
      <span class="alert-icon">${escapeHTML(a.icone)}</span>
      <div class="alert-body">
        <div class="alert-title">${escapeHTML(a.titulo)}</div>
        <div class="alert-desc">${escapeHTML(a.desc)}</div>
      </div>
    </div>`).join('');
}

function gerarAlertas(doMes, doMesPrev, lims) {
  const alertas = [];
  const totalDep = doMes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const totalRec = doMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const totalDepPrev = doMesPrev.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);

  // Sem receita no mês
  if (totalRec === 0 && doMes.length > 0) {
    alertas.push({ tipo:'warn', icone:'⚠️', titulo:'Sem receitas registradas', desc:'Você ainda não registrou nenhuma receita este mês.' });
  }

  // Saldo negativo
  if (totalRec > 0 && totalDep > totalRec) {
    alertas.push({ tipo:'danger', icone:'🚨', titulo:'Despesas acima das receitas', desc:`Você gastou ${fmt(totalDep - totalRec)} a mais do que recebeu este mês.` });
  }

  // Aumento >20% nas despesas vs mês anterior
  if (totalDepPrev > 0 && totalDep > 0) {
    const aumento = ((totalDep - totalDepPrev) / totalDepPrev) * 100;
    if (aumento > 20) {
      alertas.push({ tipo:'warn', icone:'📈', titulo:'Despesas crescendo', desc:`Seus gastos subiram ${aumento.toFixed(0)}% em relação ao mês passado.` });
    }
  }

  // Limites excedidos
  if (lims.length > 0) {
    const porCat = {};
    doMes.filter(t => t.tipo === 'despesa').forEach(t => {
      const cat = t.categoria || 'Outros';
      porCat[cat] = (porCat[cat] || 0) + (Number(t.valor) || 0);
    });
    lims.forEach(l => {
      const gasto = porCat[l.categoria] || 0;
      const limite = Number(l.valor) || 0;
      if (limite > 0 && gasto > limite) {
        alertas.push({ tipo:'danger', icone:'🔴', titulo:`Limite excedido: ${l.categoria}`, desc:`Você gastou ${fmt(gasto)} de um limite de ${fmt(limite)}.` });
      } else if (limite > 0 && gasto >= limite * 0.85) {
        alertas.push({ tipo:'warn', icone:'🟡', titulo:`Limite próximo: ${l.categoria}`, desc:`${fmt(gasto)} usados de ${fmt(limite)} (${Math.round((gasto/limite)*100)}%).` });
      }
    });
  }

  // Dívidas: comprometimento mensal, atraso e juros abusivos
  const ativasDividas = dividas.filter(d => _calcSaldoDiv(d) > 0.01);
  if (ativasDividas.length > 0) {
    const comprMensal = ativasDividas.reduce((s, d) => s + (d.valorParcela || 0), 0);
    if (totalRec > 0) {
      const pctCompr = (comprMensal / totalRec) * 100;
      if (pctCompr >= 35) {
        alertas.push({ tipo:'danger', icone:'💸', titulo:'Endividamento crítico', desc:`Suas parcelas mensais (${fmt(comprMensal)}) comprometem ${pctCompr.toFixed(0)}% da sua renda. Risco alto de inadimplência.` });
      } else if (pctCompr >= 20) {
        alertas.push({ tipo:'warn', icone:'📅', titulo:'Comprometimento com dívidas', desc:`${pctCompr.toFixed(0)}% da sua renda (${fmt(comprMensal)}/mês) está comprometida com parcelas de empréstimos.` });
      }
    }
    const abusivos = ativasDividas.filter(d => (d.juros || 0) > 5);
    if (abusivos.length > 0) {
      const maiores = abusivos.sort((a,b) => b.juros - a.juros).slice(0,2).map(d => `${d.nome||'?'} (${(d.juros).toFixed(1)}% a.m.)`).join(', ');
      alertas.push({ tipo:'warn', icone:'🔥', titulo:'Juros abusivos detectados', desc:`Dívidas com taxas acima de 5% a.m.: ${maiores}. Considere renegociar ou quitar com prioridade.` });
    }
    const emAtraso = ativasDividas.filter(d => {
      if (!d.vencimento || !d.parcelas) return false;
      const base = new Date(d.vencimento + 'T12:00:00');
      const pagas = d.parcelasPagas || 0;
      if (pagas >= d.parcelas) return false;
      const proxVenc = new Date(base.getFullYear(), base.getMonth() + pagas, base.getDate());
      return proxVenc < new Date();
    });
    if (emAtraso.length > 0) {
      alertas.push({ tipo:'danger', icone:'🔴', titulo:`${emAtraso.length} parcela(s) em atraso`, desc:`${emAtraso.map(d => d.nome||'?').join(', ')} têm parcelas vencidas. Parcelas em atraso geram multa e prejudicam o score.` });
    }
  }

  return alertas;
}

// ─── Economia ──────────────────────────────────────────────────────────────
function renderEconomia(doMes) {
  const el = document.getElementById('economiaContainer');
  if (!el) return;

  const porCat = {};
  doMes.filter(t => t.tipo === 'despesa').forEach(t => {
    const cat = t.categoria || 'Outros';
    porCat[cat] = (porCat[cat] || 0) + (Number(t.valor) || 0);
  });

  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!cats.length) {
    el.innerHTML = '<div style="text-align:center;padding:1rem 0;color:var(--card-text-sec);font-size:0.8125rem;">Sem despesas registradas.</div>';
    return;
  }

  el.innerHTML = cats.map(([cat, val]) => {
    const info = getCatInfo(cat);
    const economia = val * 0.1; // sugestão: 10% de redução
    return `<div style="display:flex;align-items:center;gap:0.625rem;padding:0.5rem 0;border-bottom:1px solid var(--input-border);">
      <span style="font-size:1.125rem;">${escapeHTML(info.emoji)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);">${escapeHTML(cat)}</div>
        <div style="font-size:0.75rem;color:var(--card-text-sec);">${fmt(val)} gasto · economia possível: ${fmt(economia)}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Resumo Semanal ────────────────────────────────────────────────────────
// BUG 11 — semana começa segunda
function getInicioSemana(agora) {
  const dow    = agora.getDay(); // 0=dom
  const offset = dow === 0 ? 6 : dow - 1;
  const d = new Date(agora);
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function renderResumoSemanal(doMes) {
  const el = document.getElementById('resumoSemanalContainer');
  if (!el) return;

  const agora = new Date();
  const inicioSemana = getInicioSemana(agora);
  const pfxSem = inicioSemana.toISOString().slice(0, 10);

  const semana = doMes.filter(t => {
    const d = normalizarData(t.data) || '';
    return d >= pfxSem;
  });

  const recSem = semana.filter(t => t.tipo === 'receita').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const depSem = semana.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const saldoSem = recSem - depSem;
  const cor = saldoSem >= 0 ? '#16a34a' : '#dc2626';

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.625rem;">
      <div style="background:rgba(22,163,74,0.07);border-radius:0.75rem;padding:0.75rem;text-align:center;">
        <div style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#16a34a;margin-bottom:0.25rem;">Receitas</div>
        <div style="font-size:1rem;font-weight:800;color:#16a34a;">${fmt(recSem)}</div>
      </div>
      <div style="background:rgba(220,38,38,0.07);border-radius:0.75rem;padding:0.75rem;text-align:center;">
        <div style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#dc2626;margin-bottom:0.25rem;">Despesas</div>
        <div style="font-size:1rem;font-weight:800;color:#dc2626;">${fmt(depSem)}</div>
      </div>
    </div>
    <div style="background:var(--input-bg);border-radius:0.75rem;padding:0.625rem;text-align:center;border:1px solid var(--input-border);">
      <div style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--card-text-sec);margin-bottom:0.25rem;">Saldo Semanal</div>
      <div style="font-size:1.125rem;font-weight:800;color:${cor};">${fmt(saldoSem)}</div>
    </div>
    <div style="font-size:0.75rem;color:var(--card-text-sec);margin-top:0.5rem;text-align:center;">${semana.length} transação(ões) desde segunda-feira</div>`;
}

// Calcula saldo devedor simplificado (parcelas restantes × valorParcela)
function _calcSaldoDiv(d) {
  const restantes = Math.max(0, (d.parcelas || 0) - (d.parcelasPagas || 0));
  if (d.valorParcela && restantes > 0) return restantes * d.valorParcela;
  return Math.max(0, (d.valorTotal || 0) - (d.valorPago || 0));
}

// ─── Score de Saúde ────────────────────────────────────────────────────────
function calcularScore(doMes, doMesPrev, lims) {
  let score = 50;

  const rec  = doMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const dep  = doMes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const depP = doMesPrev.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);

  // Taxa de poupança
  if (rec > 0) {
    const taxa = (rec - dep) / rec;
    if (taxa >= 0.3) score += 25;
    else if (taxa >= 0.1) score += 15;
    else if (taxa >= 0)   score += 5;
    else score -= 20;
  }

  // Despesas vs mês anterior
  if (depP > 0 && dep > 0) {
    const delta = (dep - depP) / depP;
    if (delta < -0.1) score += 10;
    else if (delta > 0.2) score -= 10;
  }

  // Quantidade de transações (atividade)
  if (doMes.length >= 5)  score += 5;
  if (doMes.length >= 15) score += 5;

  // Limites respeitados
  if (lims.length > 0) {
    const porCat = {};
    doMes.filter(t => t.tipo === 'despesa').forEach(t => {
      const cat = t.categoria || 'Outros';
      porCat[cat] = (porCat[cat] || 0) + (Number(t.valor) || 0);
    });
    const excedidos = lims.filter(l => (porCat[l.categoria] || 0) > (Number(l.valor) || 0)).length;
    score -= excedidos * 8;
    if (excedidos === 0 && lims.length > 0) score += 5;
  }

  // Dívidas: penaliza comprometimento e juros abusivos
  const ativasDividas = dividas.filter(d => _calcSaldoDiv(d) > 0.01);
  if (rec > 0 && ativasDividas.length > 0) {
    const comprMensal = ativasDividas.reduce((s, d) => s + (d.valorParcela || 0), 0);
    const pctCompr    = (comprMensal / rec) * 100;
    if (pctCompr > 40) score -= 20;
    else if (pctCompr > 25) score -= 10;
    else if (pctCompr > 10) score -= 5;
  }
  const temJurosAbusivos = ativasDividas.some(d => (d.juros || 0) > 5);
  if (temJurosAbusivos) score -= 10;
  const temAtraso = ativasDividas.some(d => {
    if (!d.vencimento || !d.parcelas) return false;
    const base = new Date(d.vencimento + 'T12:00:00');
    const pagas = d.parcelasPagas || 0;
    if (pagas >= d.parcelas) return false;
    const proxVenc = new Date(base.getFullYear(), base.getMonth() + pagas, base.getDate());
    return proxVenc < new Date();
  });
  if (temAtraso) score -= 15;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function renderScore(doMes, doMesPrev) {
  const score    = calcularScore(doMes, doMesPrev, limites);
  const progress = document.getElementById('scoreProgress');
  const numEl    = document.getElementById('scoreNum');
  const labelEl  = document.getElementById('scoreLabel');
  const descEl   = document.getElementById('scoreDesc');
  const tagsEl   = document.getElementById('scoreTags');

  if (progress) {
    progress.setAttribute('stroke-dasharray', `${score} 100`);
    const cor = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626';
    progress.setAttribute('stroke', cor);
  }
  if (numEl) numEl.textContent = score;

  let label, desc, tags;
  if (score >= 80) {
    label = '🟢 Excelente';
    desc  = 'Suas finanças estão em ótima forma! Você está poupando bem, controlando gastos e respeitando seus limites.';
    tags  = [{ txt: 'Poupança ok', cls: 'score-tag-good' }, { txt: 'Gastos ok', cls: 'score-tag-good' }];
  } else if (score >= 60) {
    label = '🟡 Bom';
    desc  = 'Boa saúde financeira! Ainda há espaço para melhorar a taxa de poupança e controlar melhor algumas categorias.';
    tags  = [{ txt: 'Melhorar poupança', cls: 'score-tag-warn' }];
  } else if (score >= 40) {
    label = '🟠 Regular';
    desc  = 'Atenção: seus gastos estão altos em relação às receitas. Identifique as categorias críticas e reduza.';
    tags  = [{ txt: 'Gastos altos', cls: 'score-tag-warn' }, { txt: 'Revisar limites', cls: 'score-tag-warn' }];
  } else {
    label = '🔴 Crítico';
    desc  = 'Situação crítica! Despesas acima das receitas. Corte gastos não essenciais imediatamente.';
    tags  = [{ txt: 'Déficit', cls: 'score-tag-bad' }, { txt: 'Ação urgente', cls: 'score-tag-bad' }];
  }

  if (labelEl) labelEl.textContent = label;
  if (descEl)  descEl.textContent  = desc;
  if (tagsEl)  tagsEl.innerHTML    = tags.map(t => `<span class="score-tag ${t.cls}">${escapeHTML(t.txt)}</span>`).join('');

  renderScoreHistorico();
}

// ─── Score Histórico (linha 6 meses) ──────────────────────────────────────
function renderScoreHistorico() {
  const canvas = document.getElementById('scoreHistChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const agora = new Date();
  const labels  = [];
  const scores  = [];

  for (let i = 5; i >= 0; i--) {
    const d    = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const pfx  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const dP   = new Date(agora.getFullYear(), agora.getMonth() - i - 1, 1);
    const pfxP = `${dP.getFullYear()}-${String(dP.getMonth()+1).padStart(2,'0')}`;

    const doMes     = transacoes.filter(t =>
      (normalizarData(t.data)||'').startsWith(pfx)  && t.status !== 'pendente' && t.pago !== false);
    const doMesPrev = transacoes.filter(t =>
      (normalizarData(t.data)||'').startsWith(pfxP) && t.status !== 'pendente' && t.pago !== false);

    labels.push(MESES_ABR[d.getMonth()]);
    scores.push(calcularScore(doMes, doMesPrev, limites));
  }

  // Destrói instância anterior
  if (window._scoreHistChartInst) {
    window._scoreHistChartInst.destroy();
    window._scoreHistChartInst = null;
  }

  const last  = scores[scores.length - 1];
  const cor   = last >= 70 ? '#16a34a' : last >= 40 ? '#f59e0b' : '#dc2626';
  const fill  = last >= 70 ? 'rgba(22,163,74,0.08)' : last >= 40 ? 'rgba(245,158,11,0.08)' : 'rgba(220,38,38,0.08)';
  const textC = cssVar('--card-text-sec') || '#64748b';
  const grid  = cssVar('--input-border')  || 'rgba(0,0,0,0.06)';

  window._scoreHistChartInst = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: scores,
        borderColor: cor,
        backgroundColor: fill,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        pointBackgroundColor: cor,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `Score: ${ctx.raw}/100` },
        },
      },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { color: textC, font: { size: 10 }, stepSize: 25, maxTicksLimit: 5 },
          grid:  { color: grid },
        },
        x: {
          ticks: { color: textC, font: { size: 10 } },
          grid:  { display: false },
        },
      },
    },
  });
}

// ─── Insights detalhados ──────────────────────────────────────────────────
function renderInsights(doMes, doMesPrev) {
  const el = document.getElementById('insightsContainer');
  if (!el) return;

  const insights = gerarInsights(doMes, doMesPrev);
  if (!insights.length) {
    el.innerHTML = '<div style="text-align:center;padding:1.25rem 0;color:var(--card-text-sec);font-size:0.8125rem;">Sem dados suficientes para gerar insights este mês.</div>';
    return;
  }

  el.innerHTML = insights.map((ins, i) => `
    <div class="insight-card anim-card" style="animation-delay:${i * 0.05 + 0.1}s">
      <div class="insight-card-header">
        <span class="insight-emoji">${escapeHTML(ins.emoji)}</span>
        <span class="insight-title">${escapeHTML(ins.titulo)}</span>
      </div>
      <div class="insight-text">${escapeHTML(ins.texto)}</div>
    </div>`).join('');
}

function gerarInsights(doMes, doMesPrev) {
  const insights = [];
  const rec  = doMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const dep  = doMes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const depP = doMesPrev.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);

  // Taxa de poupança
  if (rec > 0) {
    const taxa = ((rec - dep) / rec * 100).toFixed(1);
    const emoji = Number(taxa) >= 20 ? '💚' : Number(taxa) >= 0 ? '💛' : '❤️';
    insights.push({ emoji, titulo: 'Taxa de Poupança', texto: `Você poupou ${taxa}% das suas receitas este mês (${fmt(rec - dep)}).` });
  }

  // Categoria que mais gastou
  const porCat = {};
  doMes.filter(t => t.tipo === 'despesa').forEach(t => {
    const cat = t.categoria || 'Outros';
    porCat[cat] = (porCat[cat] || 0) + (Number(t.valor) || 0);
  });
  const topCat = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat && dep > 0) {
    const info = getCatInfo(topCat[0]);
    const pct  = ((topCat[1] / dep) * 100).toFixed(0);
    insights.push({ emoji: info.emoji, titulo: `${topCat[0]} é seu maior gasto`, texto: `${fmt(topCat[1])} representam ${pct}% das suas despesas.` });
  }

  // Comparativo mês anterior
  if (depP > 0 && dep > 0) {
    const delta = dep - depP;
    const pct   = Math.abs((delta / depP) * 100).toFixed(1);
    if (delta > 0) {
      insights.push({ emoji: '📈', titulo: 'Gastos maiores que o mês passado', texto: `Você gastou ${fmt(delta)} a mais (+${pct}%) comparado ao mês anterior.` });
    } else {
      insights.push({ emoji: '📉', titulo: 'Gastos menores que o mês passado', texto: `Ótimo! Você reduziu seus gastos em ${fmt(Math.abs(delta))} (-${pct}%) vs. mês passado.` });
    }
  }

  // Média diária — BUG 17: guarda getDate() <= 1
  const agora = new Date();
  const diaDoMes = agora.getDate();
  if (diaDoMes > 1 && dep > 0) {
    const mediaDia = dep / diaDoMes;
    insights.push({ emoji: '📅', titulo: 'Média de Gastos Diária', texto: `Você está gastando em média ${fmt(mediaDia)}/dia. Projeção para o mês: ${fmt(mediaDia * 30)}.` });
  }

  // Frequência de transações
  if (doMes.length > 0) {
    const freq = diaDoMes > 1 ? (doMes.length / diaDoMes).toFixed(1) : doMes.length;
    insights.push({ emoji: '🔢', titulo: 'Frequência de Transações', texto: `${doMes.length} transações registradas (${freq} por dia em média).` });
  }

  // Dívidas: comprometimento mensal e estratégia de quitção
  const ativasDividas = dividas.filter(d => _calcSaldoDiv(d) > 0.01);
  if (ativasDividas.length > 0) {
    const comprMensal  = ativasDividas.reduce((s, d) => s + (d.valorParcela || 0), 0);
    const saldoTotal   = ativasDividas.reduce((s, d) => s + _calcSaldoDiv(d), 0);
    if (comprMensal > 0) {
      const pctCompr = rec > 0 ? ((comprMensal / rec) * 100).toFixed(0) + '%' : 'N/D';
      insights.push({ emoji: '💸', titulo: 'Comprometimento com Dívidas', texto: `Você tem ${ativasDividas.length} dívida(s) ativa(s) com ${fmt(comprMensal)}/mês em parcelas (${pctCompr} da renda). Saldo devedor total: ${fmt(saldoTotal)}.` });
    }
    const comJuros = ativasDividas.filter(d => (d.juros || 0) > 0).sort((a, b) => b.juros - a.juros);
    if (comJuros.length > 0) {
      const topo = comJuros[0];
      insights.push({ emoji: '🎯', titulo: 'Estratégia Avalanche Recomendada', texto: `Priorize quitar “${topo.nome||'?'}” primeiro: taxa de ${(topo.juros).toFixed(2)}% a.m. é a mais cara. Eliminar essa dívida economiza mais em juros.` });
    }
  }

  return insights;
}

// ─── Simulador ─────────────────────────────────────────────────────────────
// BUG 12 — saldoCarteira ajustado pelas despesas já pagas
function renderSimulador(doMes) {
  const agora    = new Date();
  const diaAtual = agora.getDate();
  const diasMes  = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diasRest = diasMes - diaAtual;

  // Saldo bruto das contas carteira
  const saldoBruto = carteiraGlobal.reduce((s, c) => s + (Number(c.saldo) || 0), 0);

  // BUG 12 — desconta despesas já pagas no mês
  const despJaPagas = doMes
    .filter(t => t.tipo === 'despesa' && t.pago !== false)
    .reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const dep = doMes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const saldoCarteira = saldoBruto - despJaPagas;

  const ritmoDia = diaAtual > 0 ? dep / diaAtual : 0;
  const limiteDia = diasRest > 0 ? saldoCarteira / diasRest : saldoCarteira;

  const elDias  = document.getElementById('simDiasLabel');
  const elSaldo = document.getElementById('simSaldoAtual');
  const elRitmo = document.getElementById('simRitmoDia');
  const elLim   = document.getElementById('simLimiteDia');

  if (elDias)  elDias.textContent  = `Dia ${diaAtual} de ${diasMes} — faltam ${diasRest} dias no mês`;
  if (elSaldo) elSaldo.textContent = fmt(saldoCarteira);
  if (elRitmo) elRitmo.textContent = fmt(ritmoDia);
  if (elLim)   elLim.textContent   = fmt(Math.max(0, limiteDia));

  _simState = { saldoCarteira, ritmoDia };

  // dispara render inicial do slider
  window.atualizarSimulador();
}

window.atualizarSimulador = function() {
  if (!_simState) return;
  const slider = document.getElementById('simSlider');
  const box    = document.getElementById('simProjecaoBox');
  const sem    = document.getElementById('simSemanas');
  const lbl    = document.getElementById('simDiasValor');
  if (!slider || !box || !sem) return;

  const dias = Number(slider.value) || 30;
  if (lbl) lbl.textContent = dias;

  const { saldoCarteira, ritmoDia } = _simState;
  let saldoProj = saldoCarteira;
  const semanas = Math.ceil(dias / 7);
  const linhas  = [];

  for (let s = 1; s <= semanas; s++) {
    const diasSemana = Math.min(7, dias - (s - 1) * 7);
    saldoProj -= ritmoDia * diasSemana;
    const cor = saldoProj >= 0 ? '#16a34a' : '#dc2626';
    linhas.push(`Semana ${s}: <strong style="color:${cor};">${fmt(saldoProj)}</strong>`);
  }

  box.style.display = 'block';
  sem.innerHTML = linhas.join('<br>');
};

// ─── Push Notifications ────────────────────────────────────────────────────
function renderPushStatus() {
  const elStatus = document.getElementById('notifStatus');
  const btnPush  = document.getElementById('btnPush');
  if (!elStatus) return;

  // Sem VAPID_KEY: feature não configurada no backend — oculta botão
  const VAPID = window.BUD_FIREBASE_CONFIG && window.BUD_FIREBASE_CONFIG.VAPID_KEY;
  if (!VAPID) {
    elStatus.textContent = 'Em breve';
    if (btnPush) btnPush.style.display = 'none';
    return;
  }

  if (!('Notification' in window)) {
    elStatus.textContent = 'Não suportado neste navegador';
    if (btnPush) btnPush.style.display = 'none';
    return;
  }
  if (Notification.permission === 'granted') {
    elStatus.textContent = '✅ Ativo';
    if (btnPush) btnPush.textContent = 'Reativar';
  } else if (Notification.permission === 'denied') {
    elStatus.textContent = '🚫 Bloqueado pelo navegador';
    if (btnPush) btnPush.style.display = 'none';
  } else {
    elStatus.textContent = 'Não ativado';
  }
}

window.ativarNotifPush = async function() {
  const elStatus = document.getElementById('notifStatus');
  const VAPID    = window.BUD_FIREBASE_CONFIG && window.BUD_FIREBASE_CONFIG.VAPID_KEY;

  if (!VAPID) {
    showToast('Push não configurado (sem VAPID_KEY)', 'erro');
    return;
  }

  try {
    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID });
    if (token) {
      if (elStatus) elStatus.textContent = '✅ Ativo';
      showToast('Notificações push ativadas!');
    }
  } catch (err) {
    console.error('Push error:', err);
    showToast('Erro ao ativar notificações.', 'erro');
  }
};

// ─── Comparativo ──────────────────────────────────────────────────────────
function popularDropdownsComp() {
  const agora = new Date();
  const opcoes = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const pfx   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = `${MESES_FULL[d.getMonth()]} ${d.getFullYear()}`;
    opcoes.push({ pfx, label });
  }

  ['comp1Items', 'comp2Items'].forEach((id, idx) => {
    const cont = document.getElementById(id);
    if (!cont) return;
    const num = idx + 1;
    cont.innerHTML = opcoes.map(o => `
      <div class="comp-dd-opt" onclick="window.selecionarCompMes(${num},'${o.pfx}','${escapeHTML(o.label)}')">${escapeHTML(o.label)}</div>
    `).join('');
  });
}

window.toggleCompDD = function(num) {
  const btn  = document.getElementById(`btnComp${num}`);
  const list = document.getElementById(`comp${num}Items`);
  if (!btn || !list) return;
  const isOpen = list.classList.contains('open');
  // Fechar todos
  document.querySelectorAll('.comp-dd-list').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.comp-dd-btn').forEach(el => el.classList.remove('open'));
  if (!isOpen) {
    list.classList.add('open');
    btn.classList.add('open');
  }
};

window.selecionarCompMes = function(num, pfx, label) {
  if (num === 1) compVal1 = pfx; else compVal2 = pfx;
  const lbl = document.getElementById(`labelComp${num}`);
  if (lbl) lbl.textContent = label;
  // Marcar selected
  const listId = `comp${num}Items`;
  document.querySelectorAll(`#${listId} .comp-dd-opt`).forEach(el => {
    el.classList.toggle('selected', el.textContent.trim() === label.trim());
  });
  // Fechar dropdown
  document.querySelectorAll('.comp-dd-list').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.comp-dd-btn').forEach(el => el.classList.remove('open'));
  // Comparar se ambos selecionados
  if (compVal1 && compVal2) compararMeses();
};

// Fecha dropdowns ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.comp-dd-wrap')) {
    document.querySelectorAll('.comp-dd-list').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.comp-dd-btn').forEach(el => el.classList.remove('open'));
  }
});

function getCompDados(pfx) {
  const lista = transacoes.filter(t =>
    (normalizarData(t.data) || '').startsWith(pfx) &&
    t.status !== 'pendente' &&
    t.pago !== false
  );
  const rec = lista.filter(t => t.tipo === 'receita').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const dep = lista.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const porCat = {};
  lista.filter(t => t.tipo === 'despesa').forEach(t => {
    const cat = t.categoria || 'Outros';
    porCat[cat] = (porCat[cat] || 0) + (Number(t.valor) || 0);
  });
  return { rec, dep, saldo: rec - dep, porCat, n: lista.length };
}

// BUG 8 — variação: 'novo' quando v1===0 e v2>0
function calcVar(v1, v2) {
  if (v1 === 0 && v2 > 0) return { txt: 'novo', cls: 'comp-var-new' };
  if (v1 === 0) return { txt: '—', cls: 'comp-var-neu' };
  const pct  = ((v2 - v1) / v1 * 100).toFixed(1);
  const up   = v2 >= v1;
  return { txt: `${up ? '▲' : '▼'} ${Math.abs(pct)}%`, cls: up ? 'comp-var-up' : 'comp-var-down' };
}

async function compararMeses() {
  if (!compVal1 || !compVal2) return;

  const res = document.getElementById('compResultado');
  const msg = document.getElementById('compEmptyMsg');
  if (res) res.style.display = 'none';

  // Se os dados do mês não estiverem no cache, busca do Firestore
  const mesesNecessarios = [compVal1, compVal2].filter(pfx => {
    return !transacoes.some(t => (normalizarData(t.data) || '').startsWith(pfx));
  });

  if (mesesNecessarios.length > 0) {
    try {
      const uid = currentUser.uid;
      const promises = mesesNecessarios.map(pfx => {
        const inicio = `${pfx}-01`;
        const fim    = `${pfx}-31`;
        return getDocs(query(
          collection(db, 'usuarios', uid, 'transacoes'),
          where('data', '>=', inicio),
          where('data', '<=', fim),
          orderBy('data', 'desc')
        ));
      });
      const snaps = await Promise.all(promises);
      snaps.forEach(snap => {
        snap.docs.forEach(d => {
          const tx = { id: d.id, ...d.data() };
          if (!transacoes.find(t => t.id === tx.id)) transacoes.push(tx);
        });
      });
    } catch (err) {
      console.error('Erro ao buscar meses para comparativo:', err);
    }
  }

  const d1 = getCompDados(compVal1);
  const d2 = getCompDados(compVal2);

  const lbl1 = document.getElementById('labelComp1')?.textContent || compVal1;
  const lbl2 = document.getElementById('labelComp2')?.textContent || compVal2;

  // Render cards
  ['compCard1', 'compCard2'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const d   = i === 0 ? d1 : d2;
    const lbl = i === 0 ? lbl1 : lbl2;
    const vRec  = calcVar(i === 0 ? d2.rec : d1.rec, i === 0 ? d1.rec : d2.rec);
    const vDep  = calcVar(i === 0 ? d2.dep : d1.dep, i === 0 ? d1.dep : d2.dep);
    const corSaldo = d.saldo >= 0 ? '#16a34a' : '#dc2626';
    el.innerHTML = `
      <div class="comp-result-title">${escapeHTML(lbl)}</div>
      <div class="comp-kpi">
        <div class="comp-kpi-label">Receitas</div>
        <div class="comp-kpi-val" style="color:#16a34a;">${fmt(d.rec)}</div>
        <span class="comp-var ${vRec.cls}">${vRec.txt}</span>
      </div>
      <div class="comp-kpi">
        <div class="comp-kpi-label">Despesas</div>
        <div class="comp-kpi-val" style="color:#dc2626;">${fmt(d.dep)}</div>
        <span class="comp-var ${vDep.cls}">${vDep.txt}</span>
      </div>
      <div class="comp-kpi">
        <div class="comp-kpi-label">Saldo</div>
        <div class="comp-kpi-val" style="color:${corSaldo};">${fmt(d.saldo)}</div>
      </div>
      <div style="font-size:0.75rem;color:var(--card-text-sec);margin-top:0.5rem;">${d.n} transações</div>`;
  });

  // Chart grouped bar (Receitas vs Despesas)
  const ctxBar = document.getElementById('compChartComparativo');
  if (ctxBar) {
    if (compCharts.bar) { compCharts.bar.destroy(); compCharts.bar = null; }
    compCharts.bar = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: [lbl1, lbl2],
        datasets: [
          { label: 'Receitas', data: [d1.rec, d2.rec], backgroundColor: ['rgba(22,163,74,0.75)', 'rgba(22,163,74,0.45)'], borderRadius: 6 },
          { label: 'Despesas', data: [d1.dep, d2.dep], backgroundColor: ['rgba(220,38,38,0.75)', 'rgba(220,38,38,0.45)'], borderRadius: 6 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: cssVar('--card-text') } } },
        scales: {
          x: { ticks: { color: cssVar('--card-text-sec') }, grid: { color: 'rgba(128,128,128,0.1)' } },
          y: { ticks: { color: cssVar('--card-text-sec'), callback: v => 'R$' + Number(v).toLocaleString('pt-BR') }, grid: { color: 'rgba(128,128,128,0.1)' } },
        },
      },
    });
  }

  // Chart categorias
  const ctxCat = document.getElementById('compChartCategorias');
  if (ctxCat) {
    if (compCharts.cat) { compCharts.cat.destroy(); compCharts.cat = null; }
    const todasCats = Array.from(new Set([...Object.keys(d1.porCat), ...Object.keys(d2.porCat)])).sort();
    compCharts.cat = new Chart(ctxCat, {
      type: 'bar',
      data: {
        labels: todasCats,
        datasets: [
          { label: lbl1, data: todasCats.map(c => d1.porCat[c] || 0), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
          { label: lbl2, data: todasCats.map(c => d2.porCat[c] || 0), backgroundColor: 'rgba(168,85,247,0.7)', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: cssVar('--card-text') } } },
        scales: {
          x: { ticks: { color: cssVar('--card-text-sec'), maxRotation: 45 }, grid: { color: 'rgba(128,128,128,0.1)' } },
          y: { ticks: { color: cssVar('--card-text-sec'), callback: v => 'R$' + Number(v).toLocaleString('pt-BR') }, grid: { color: 'rgba(128,128,128,0.1)' } },
        },
      },
    });
  }

  if (res) res.style.display = 'block';
  if (msg) msg.style.display = 'none';
}

// ─── Trocar aba ────────────────────────────────────────────────────────────
window.trocarAbaInsight = function(aba) {
  abaAtual = aba;
  document.getElementById('painelAnalises').style.display    = aba === 'analises'    ? '' : 'none';
  document.getElementById('painelComparativo').style.display = aba === 'comparativo' ? '' : 'none';
  document.getElementById('abaAnalises').classList.toggle('ativo',    aba === 'analises');
  document.getElementById('abaComparativo').classList.toggle('ativo', aba === 'comparativo');
};

// ─── Toggle ocultar valores ────────────────────────────────────────────────
window.toggleOcultarValores = function() {
  valoresOcultos = !valoresOcultos;
  const btn = document.getElementById('btnOcultarValores');
  if (btn) btn.textContent = valoresOcultos ? '🙈 Valores' : '👁 Valores';
  renderTudo();
};

// ─── Sincronizar dados ─────────────────────────────────────────────────────
// BUG 1 — re-busca do Firestore, não location.reload()
window.sincronizarDados = async function() {
  showToast('Atualizando dados...', 'ok');
  try {
    await buscarERenderi();
    showToast('Dados atualizados!', 'ok');
  } catch (err) {
    console.error(err);
    showToast('Erro ao sincronizar.', 'erro');
  }
};

// ─── Auth ──────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    hideSplash();
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  // Busca userData
  try {
    const snapUser = await getDoc(doc(db, 'usuarios', user.uid));
    userData = snapUser.exists() ? snapUser.data() : {};

    // BUG 7 — shouldDowngrade persiste via updateDoc + serverTimestamp
    if (window.NexoPlanos && typeof window.NexoPlanos.shouldDowngrade === 'function') {
      const should = window.NexoPlanos.shouldDowngrade(userData);
      if (should) {
        await updateDoc(doc(db, 'usuarios', user.uid), { plano: 'free', planoDowngradedAt: serverTimestamp() });
        userData.plano = 'free';
      }
    }
  } catch (err) {
    console.error('Erro ao buscar userData:', err);
    userData = {};
  }

  renderSidebarUser(user, userData);

  // BUG 6 — paywall usa #paywallContainer; hideSplash sempre chamado
  const temAcesso = !window.NexoPlanos ||
    window.NexoPlanos.canUseFeature(userData, 'dailySpendAverage');

  if (!temAcesso) {
    document.getElementById('paywallContainer').style.display = 'block';
    document.getElementById('conteudoPrincipal').style.display = 'none';
    hideSplash();
    return;
  }

  try {
    await buscarERenderi();
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
    showToast('Erro ao carregar dados.', 'erro');
  } finally {
    hideSplash();
  }
});

// ─── Init ──────────────────────────────────────────────────────────────────
initSidebar();
initLogout();
