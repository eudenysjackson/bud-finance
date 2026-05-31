/**
 * js/assistente-ia.js — Bud Finance Assistente IA v2
 *
 * V2 melhorias:
 *  - Renderização markdown via marked.js + DOMPurify (tabelas, listas, bold, código)
 *  - Contexto expandido: metas (% concluída, prazo), limites (% usado), top categorias
 *  - valoresOcultos: se ativo (localStorage bud_valores_ocultos), IA não exibe valores
 *  - Auto-análise na abertura: alertas proativos se há problemas críticos
 *  - Chips contextuais: sugestões adaptadas ao perfil do usuário
 *  - Email automático (/api/alerta-financeiro) ao detectar problemas críticos
 *  - Knowledge base do app: IA sabe explicar todas as funcionalidades
 *
 * Firebase SDK Modular v10.8.1 | ES Module
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  doc, getDoc, getDocs, addDoc, setDoc,
  collection, query, where, limit, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ────────────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ────────────────────────────────────────────────────────────────────
let conversaIA    = [];  // [{role:'user'|'assistant', content:string}]
let modoChamado   = { ativo: false, tipo: null };
let usuarioDados  = {};
let _enviando     = false;
let _contextoCache = null; // cache do contexto para evitar re-fetch dentro da mesma sessão
const BACKEND_URL = window.BUD_FUNCTIONS_URL || '';
const PLANOS_ASSISTENTE = ['plus', 'trial'];

// ─── marked.js config ─────────────────────────────────────────────────────────
if (window.marked) {
  window.marked.use({ breaks: true, gfm: true });
}

// ─── Formatar mensagem IA com markdown seguro ─────────────────────────────────
function formatarMensagemIA(texto) {
  if (window.marked && window.DOMPurify) {
    const raw = window.marked.parse(String(texto));
    return window.DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['p','br','strong','em','b','i','ul','ol','li',
                     'h1','h2','h3','h4','code','pre','blockquote',
                     'table','thead','tbody','tr','th','td','hr','span'],
      ALLOWED_ATTR: [],
      FORBID_ATTR:  ['style','class','onclick','onload','onerror'],
    });
  }
  // Fallback simples se CDN não carregou
  return escapeHTML(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function salvarConversa() {
  try { sessionStorage.setItem('bud_conversa_ia', JSON.stringify(conversaIA.slice(-24))); } catch (_e) {}
}

// ─── Normalizar data para YYYY-MM-DD ───────────────────────────────────────────
function normalizarData(str) {
  if (!str || str === '—') return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}
function carregarConversa() {
  try { return JSON.parse(sessionStorage.getItem('bud_conversa_ia') || '[]'); } catch { return []; }
}

// ─── DOM refs ──────────────────────────────────────────────────────────────────
const chatContainer = document.getElementById('chatContainer');
const chatForm      = document.getElementById('chatForm');
const chatInput     = document.getElementById('chatInput');
const btnEnviar     = document.getElementById('btnEnviar');

// ─── Adicionar mensagem ─────────────────────────────────────────────────────────
function addMsg(from, html) {
  const isUser = from === 'user';
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'msg-user' : 'msg-bot'}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = html; // already sanitized by formatarMensagemIA or escapeHTML
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = isUser ? '\uD83D\uDC64' : '\uD83E\uDD16';
  div.appendChild(avatar);
  div.appendChild(bubble);
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return div;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
let _typingEl = null;
function addTyping() {
  const div = document.createElement('div');
  div.className = 'msg msg-bot'; div.id = '__typing';
  div.innerHTML = '<div class="msg-avatar">\uD83E\uDD16</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  _typingEl = div;
}
function removeTyping() { if (_typingEl) { _typingEl.remove(); _typingEl = null; } }

// ─── Construir contexto financeiro expandido ───────────────────────────────────────
async function buildContexto(uid, forceRefresh = false) {
  if (_contextoCache && !forceRefresh) return _contextoCache;

  const agora = new Date();
  const ano   = agora.getFullYear();
  const mes   = agora.getMonth() + 1;
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const valoresOcultos = localStorage.getItem('bud_valores_ocultos') === 'true';

  try {
    const inicioMes = Timestamp.fromDate(new Date(ano, mes - 1, 1, 0, 0, 0));
    const fimMes    = Timestamp.fromDate(new Date(ano, mes, 0, 23, 59, 59));

    // Mês anterior
    const mesAnt       = mes === 1 ? 12 : mes - 1;
    const anoAnt       = mes === 1 ? ano - 1 : ano;
    const inicioMesAnt = Timestamp.fromDate(new Date(anoAnt, mesAnt - 1, 1, 0, 0, 0));
    const fimMesAnt    = Timestamp.fromDate(new Date(anoAnt, mesAnt, 0, 23, 59, 59));

    const [txSnap, divSnap, metSnap, invSnap, cartSnap, limSnap, catSnap, txAntSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'usuarios', uid, 'transacoes'),
        where('data', '>=', inicioMes),
        where('data', '<=', fimMes),
        limit(200)
      )),
      getDocs(query(collection(db, 'usuarios', uid, 'dividas'), limit(50))),
      getDocs(query(collection(db, 'usuarios', uid, 'metas'), limit(50))),
      getDocs(query(collection(db, 'usuarios', uid, 'investimentos'), limit(50))),
      getDocs(collection(db, 'usuarios', uid, 'carteira')),
      getDocs(query(collection(db, 'usuarios', uid, 'limites'), limit(50))),
      getDocs(query(collection(db, 'usuarios', uid, 'categorias'), limit(100))),
      getDocs(query(
        collection(db, 'usuarios', uid, 'transacoes'),
        where('data', '>=', inicioMesAnt),
        where('data', '<=', fimMesAnt),
        limit(200)
      )),
    ]);

    const transacoes    = txSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const dividas       = divSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const metas         = metSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const investimentos = invSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    // carteira contém tanto contas bancárias quanto cartões (tipo:'credito')
    const todasCarteiras = cartSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const carteiras      = todasCarteiras.filter(c => c.tipo !== 'credito');
    const cartoes        = todasCarteiras.filter(c => c.tipo === 'credito');
    const limites        = limSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const categoriasUser = catSnap.docs.map(d => d.data().nome).filter(Boolean);

    // ── Transações do mês anterior
    let receitasAnt = 0;
    let despesasAnt = 0;
    txAntSnap.docs.forEach(d => {
      const t = d.data();
      const val = Number(t.valor) || 0;
      if (t.tipo === 'receita') receitasAnt += val;
      else despesasAnt += val;
    });

    // ── Transações do mês
    let receitas = 0;
    let despesas = 0;
    const catMap = {};
    transacoes.forEach(t => {
      const val = Number(t.valor) || 0;
      if (t.tipo === 'receita') { receitas += val; }
      else {
        despesas += val;
        const cat = t.categoria || 'Outros';
        catMap[cat] = (catMap[cat] || 0) + val;
      }
    });

    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([cat, val]) => `${cat}: ${valoresOcultos ? '•••' : fmtBRL(val)}`);

    // ── Carteira (apenas contas bancárias, sem cartões de crédito)
    const saldoTotal  = carteiras.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
    const contasLista = carteiras
      .filter(c => c.ativo !== false)
      .map(c => `${escapeHTML(c.nome||'Conta')}: ${valoresOcultos ? '•••' : fmtBRL(c.saldo)}`);

    // ── Dívidas
    const dividasAtivas = dividas.filter(d => {
      const restantes = Math.max(0, (d.parcelas || 0) - (d.parcelasPagas || 0));
      return restantes > 0 && Math.max(0, (d.valorTotal||0) - (d.valorPago||0)) > 0.01
        || (restantes > 0 && (d.valorParcela||0) > 0);
    });
    const saldoDevedorTotal = dividasAtivas.reduce((s, d) => {
      const restantes = Math.max(0, (d.parcelas||0) - (d.parcelasPagas||0));
      return s + (d.valorParcela && restantes > 0 ? restantes * d.valorParcela : Math.max(0,(d.valorTotal||0)-(d.valorPago||0)));
    }, 0);
    const comprometimentoMensalDividas = dividasAtivas.reduce((s, d) => s + (d.valorParcela||0), 0);
    const jurosMaiorDivida = dividasAtivas.reduce((mx, d) => Math.max(mx, d.juros||0), 0);
    const dividasJurosAbusivos = dividasAtivas.filter(d => (d.juros||0) > 5).length;
    const hoje2 = new Date();
    const dividasEmAtraso = dividasAtivas.filter(d => {
      if (!d.vencimento || !d.parcelas) return false;
      const base = new Date(d.vencimento + 'T12:00:00');
      const pagas = d.parcelasPagas || 0;
      if (pagas >= d.parcelas) return false;
      const proxVenc = new Date(base.getFullYear(), base.getMonth() + pagas, base.getDate());
      return proxVenc < hoje2;
    });
    const dividasDetalhe = dividasAtivas.slice(0, 5).map(d => {
      const rest = Math.max(0, (d.parcelas||0) - (d.parcelasPagas||0));
      const saldo = d.valorParcela && rest > 0 ? rest * d.valorParcela : Math.max(0,(d.valorTotal||0)-(d.valorPago||0));
      return `${d.nome||'Dívida'}: saldo ${valoresOcultos ? '•••' : fmtBRL(saldo)}, parcela ${valoresOcultos ? '•••' : fmtBRL(d.valorParcela||0)}/mês, juros ${(d.juros||0).toFixed(2)}% a.m.`;
    });

    // ── Metas com % concluída
    const hoje = new Date();
    let metasAtrasadas = 0;
    const metasDetalhe = metas
      .filter(m => m.status !== 'concluida')
      .map(m => {
        const pct     = (m.valorAlvo || 0) > 0
          ? Math.min(100, Math.round(((m.valorAtual || 0) / m.valorAlvo) * 100)) : 0;
        const falta   = Math.max(0, (m.valorAlvo || 0) - (m.valorAtual || 0));
        const prazoOk = !m.prazo || new Date(m.prazo) > hoje;
        if (!prazoOk && pct < 90) metasAtrasadas++;
        const statusLabel = pct >= 100 ? '✅ concluída' : !prazoOk ? '⚠️ prazo vencido' : `${pct}%`;
        return `${m.nome||'Meta'}: ${statusLabel} — faltam ${valoresOcultos ? '•••' : fmtBRL(falta)}`;
      });

    // ── Limites vs gastos reais
    let limitesEstourados = 0;
    const limitesDetalhe = [];
    limites.forEach(l => {
      const gasto  = catMap[l.categoria] || 0;
      const limite = l.valorLimite || 0;
      if (limite > 0) {
        const pct    = Math.round((gasto / limite) * 100);
        const status = pct > 100 ? '\uD83D\uDD34 estourado' : pct > 80 ? '⚠️ atenção' : '✅ ok';
        if (pct > 100) limitesEstourados++;
        limitesDetalhe.push(
          `${l.categoria}: ${pct}% (${valoresOcultos ? '•••' : fmtBRL(gasto)} de ${valoresOcultos ? '•••' : fmtBRL(limite)}) — ${status}`
        );
      }
    });

    _contextoCache = {
      nome:          usuarioDados.nome || '',
      plano:         usuarioDados.plano || 'free',
      mesAno:        `${meses[mes - 1]} de ${ano}`,
      valoresOcultos,
      resumo: {
        receitas,
        despesas,
        saldo:              receitas - despesas,
        topCats,
        saldoContas:        saldoTotal,
        contas:             contasLista,
        dividasAtivas:               dividasAtivas.length,
        saldoDevedorTotal,
        comprometimentoMensalDividas,
        jurosMaiorDivida,
        dividasJurosAbusivos,
        dividasEmAtraso:             dividasEmAtraso.length,
        dividasDetalhe,
        metas:              metas.filter(m => m.status !== 'concluida').length,
        metasDetalhe,
        metasAtrasadas,
        investimentos:      investimentos.length,
        limites:            limitesDetalhe,
        limitesEstourados,
        // Mês anterior
        receitasAnt,
        despesasAnt,
        saldoAnt:           receitasAnt - despesasAnt,
        mesAnoAnt:          `${meses[mesAnt - 1]} de ${anoAnt}`,
        // Listas completas para o card de transação
        carteira:    carteiras.filter(c => c.ativo !== false).map(c => ({ id: c.id, nome: c.nome || 'Conta' })),
        cartoes:     cartoes.map(c => ({ id: c.id, nome: c.nome || 'Cartão' })),
        categorias:  categoriasUser.length ? categoriasUser : ['Alimentação','Transporte','Saúde','Educação','Lazer','Moradia','Vestuário','Tecnologia','Serviços','Outros'],
      }
    };
    return _contextoCache;

  } catch (_e) {
    _contextoCache = {
      nome:   usuarioDados.nome || '',
      plano:  usuarioDados.plano || 'free',
      mesAno: `${meses[mes - 1]} de ${ano}`,
      valoresOcultos: false,
      resumo: {
        receitas: 0, despesas: 0, saldo: 0, topCats: [], saldoContas: 0,
        contas: [], dividasAtivas: 0, saldoDevedorTotal: 0, comprometimentoMensalDividas: 0,
        jurosMaiorDivida: 0, dividasJurosAbusivos: 0, dividasEmAtraso: 0, dividasDetalhe: [],
        metas: 0, metasDetalhe: [], metasAtrasadas: 0,
        investimentos: 0, limites: [], limitesEstourados: 0,
        carteira: [], cartoes: [],
        categorias: ['Alimentação','Transporte','Saúde','Educação','Lazer','Moradia','Vestuário','Tecnologia','Serviços','Outros'],
      }
    };
    return _contextoCache;
  }
}

// ─── Analisar saúde financeira ──────────────────────────────────────────────────────
function analisarSaudeFinanceira(ctx) {
  const alertas = [];
  const r = ctx.resumo;
  if (!ctx.valoresOcultos) {
    if ((r.saldoContas || 0) < 0) {
      alertas.push({ nivel: 'critico', emoji: '\uD83D\uDEA8', texto: `Saldo total negativo (${fmtBRL(r.saldoContas)})` });
    }
    if (r.receitas > 0 && r.despesas > r.receitas) {
      const pctGasto = Math.round((r.despesas / r.receitas) * 100);
      alertas.push({ nivel: 'alerta', emoji: '⚠️', texto: `Você gastou ${pctGasto}% do que recebeu (${fmtBRL(r.despesas)} de ${fmtBRL(r.receitas)})` });
    }
  } else {
    if ((r.saldoContas || 0) < 0) {
      alertas.push({ nivel: 'critico', emoji: '\uD83D\uDEA8', texto: 'Saldo total negativo detectado' });
    }
    if (r.receitas > 0 && r.despesas > r.receitas) {
      alertas.push({ nivel: 'alerta', emoji: '⚠️', texto: 'Despesas acima das receitas neste mês' });
    }
  }
  if ((r.limitesEstourados || 0) > 0) {
    alertas.push({ nivel: 'alerta', emoji: '🐸', texto: `${r.limitesEstourados} categoria(s) com limite ultrapassado` });
  }
  if ((r.metasAtrasadas || 0) > 0) {
    alertas.push({ nivel: 'info', emoji: '🎯', texto: `${r.metasAtrasadas} meta(s) com prazo vencido ou atrasada(s)` });
  }

  // Dívidas — análise baseada em dados reais
  if ((r.dividasEmAtraso || 0) > 0) {
    alertas.push({ nivel: 'critico', emoji: '🔴', texto: `${r.dividasEmAtraso} parcela(s) de dívida em atraso — risco de multas e negativação` });
  }
  if ((r.dividasJurosAbusivos || 0) > 0) {
    const txt = !ctx.valoresOcultos
      ? `${r.dividasJurosAbusivos} dívida(s) com juros acima de 5% a.m. (maior: ${(r.jurosMaiorDivida||0).toFixed(1)}% a.m.) — prioridade máxima de quitação`
      : `${r.dividasJurosAbusivos} dívida(s) com juros abusivos detectados`;
    alertas.push({ nivel: 'critico', emoji: '🔥', texto: txt });
  }
  if ((r.comprometimentoMensalDividas || 0) > 0 && (r.receitas || 0) > 0) {
    const pct = Math.round((r.comprometimentoMensalDividas / r.receitas) * 100);
    if (pct >= 35) {
      const txt = !ctx.valoresOcultos
        ? `Parcelas de dívidas comprometem ${pct}% da sua renda (${fmtBRL(r.comprometimentoMensalDividas)}/mês) — endividamento crítico`
        : `Parcelas de dívidas comprometem ${pct}% da sua renda — endividamento crítico`;
      alertas.push({ nivel: 'critico', emoji: '💸', texto: txt });
    } else if (pct >= 20) {
      const txt = !ctx.valoresOcultos
        ? `${pct}% da renda comprometida com parcelas (${fmtBRL(r.comprometimentoMensalDividas)}/mês)`
        : `${pct}% da renda comprometida com parcelas de dívidas`;
      alertas.push({ nivel: 'alerta', emoji: '📅', texto: txt });
    } else if (pct > 0 && (r.dividasAtivas || 0) > 0) {
      alertas.push({ nivel: 'info', emoji: '📋', texto: `${r.dividasAtivas} dívida(s) ativa(s) — ${pct}% da renda em parcelas` });
    }
  } else if ((r.dividasAtivas || 0) > 3) {
    alertas.push({ nivel: 'info', emoji: '📋', texto: `Você tem ${r.dividasAtivas} dívidas ativas registradas` });
  }
  return alertas;
}

// ─── Exibir alertas de saúde como cards no chat ──────────────────────────────────
function exibirAlertasSaude(alertas) {
  if (!alertas.length) return;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:0.25rem;max-width:86%;align-self:flex-start;margin-bottom:0.25rem;';
  alertas.forEach(a => {
    const el = document.createElement('div');
    el.className = `alerta-saude ${a.nivel}`;
    el.innerHTML = `<span style="flex-shrink:0;">${a.emoji}</span> <span>${escapeHTML(a.texto)}</span>`;
    wrapper.appendChild(el);
  });
  chatContainer.appendChild(wrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ─── Alertar por email (fire-and-forget, rate-limited por sessão) ───────────────────
async function alertarAutomaticamente(alertas, nomeUsuario) {
  // Evitar spam: só alerta uma vez por sessão
  if (sessionStorage.getItem('bud_alerta_enviado')) return;
  const temCritico = alertas.some(a => a.nivel === 'critico');
  const temAlerta  = alertas.some(a => a.nivel === 'alerta');
  if (!temCritico && !temAlerta) return;

  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const resp = await fetch(`${BACKEND_URL}/api/alerta-financeiro`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({
        alertas:     alertas.map(a => ({ nivel: a.nivel, texto: a.texto })),
        nomeUsuario: escapeHTML(nomeUsuario || ''),
      })
    });
    if (resp.ok) {
      sessionStorage.setItem('bud_alerta_enviado', '1');
    }
  } catch (_e) { /* silencia erros — não impede o chat */ }
}

// ─── Sugestões contextuais ────────────────────────────────────────────────────────
function getSugestoes(ctx, alertas) {
  const r = ctx.resumo;
  const chips = [];

  // Chip de alerta proativo (prioridade máxima)
  if (alertas.some(a => a.nivel === 'critico' || a.nivel === 'alerta')) {
    chips.push({ label: '⚠️ Como resolver esses alertas?', msg: 'Quais são os problemas mais urgentes nas minhas finanças e como resolvê-los?' });
  }

  // Chips baseados nos dados
  chips.push({ label: '\uD83D\uDCCA Resumo do mês', msg: 'Faça um resumo completo das minhas finanças deste mês' });

  if (r.dividasAtivas > 0) {
    const extraDiv = r.dividasJurosAbusivos > 0
      ? ` Tenho ${r.dividasJurosAbusivos} dívida(s) com juros acima de 5% a.m.`
      : '';
    chips.push({ label: '📋 Estratégia para as dívidas', msg: `Tenho ${r.dividasAtivas} dívida(s) ativa(s) com saldo total estimado em ${fmtBRL(r.saldoDevedorTotal||0)}.${extraDiv} Qual a melhor estratégia para quitar?` });
  }
  if (r.metas > 0) {
    chips.push({ label: '\uD83C\uDFAF Progresso das metas', msg: 'Como estão minhas metas financeiras? Alguma em risco?' });
  }
  if (r.receitas > 0) {
    chips.push({ label: '\uD83D\uDCB0 Dicas de economia', msg: 'Com base nos meus gastos, quais são suas principais dicas de economia?' });
  }
  if (r.limitesEstourados > 0) {
    chips.push({ label: '\uD83D\uDEA8 Limites ultrapassados', msg: 'Tenho categorias com limite ultrapassado. O que devo fazer?' });
  }

  // Chips de ajuda do app (sempre disponível)
  chips.push({ label: '\uD83D\uDCD6 Como usar o Bud Finance', msg: 'Como funciona o Bud Finance? Explique as principais funcionalidades' });
  chips.push({ label: '\uD83D\uDC1B Reportar bug', action: () => window.iniciarChamado('bug') });

  return chips.slice(0, 5);
}

// ─── Mensagem de boas-vindas + alertas + chips ───────────────────────────────────
function addBoasVindas(nome, ctx, alertas) {
  const nomeTxt = nome ? `, ${escapeHTML(nome.split(' ')[0])}` : '';
  const r = ctx.resumo;

  let saudacaoExtra = '';
  if (!ctx.valoresOcultos) {
    if (r.saldo > 0) {
      saudacaoExtra = `\n\nSeu saldo do mês está positivo em **${fmtBRL(r.saldo)}**. Bom trabalho! \uD83C\uDF1F`;
    } else if (r.saldo < 0) {
      saudacaoExtra = `\n\n⚠️ Seu saldo do mês está negativo (**${fmtBRL(r.saldo)}**). Precisamos conversar.`;
    }
  }

  addMsg('bot', formatarMensagemIA(
    `Olá${nomeTxt}! 👋 Sou o **Buddy**, seu assistente financeiro do Bud Finance.` +
    `\n\nTenho acesso aos seus dados reais e posso:\n` +
    `- Analisar seus gastos e receitas\n` +
    `- Identificar problemas e oportunidades\n` +
    `- Explicar qualquer funcionalidade do app\n` +
    `- Dar dicas personalizadas para sua situação` +
    saudacaoExtra
  ));

  // Exibir alertas se houver
  if (alertas.length > 0) {
    exibirAlertasSaude(alertas);
  }

  // Chips contextuais
  const sugestoes = getSugestoes(ctx, alertas);
  const divSugs = document.createElement('div');
  divSugs.className = 'suggestions';
  sugestoes.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'sug-btn';
    btn.textContent = s.label;
    if (s.action) {
      btn.addEventListener('click', s.action);
    } else {
      btn.addEventListener('click', () => window.enviarPergunta(s.msg));
    }
    divSugs.appendChild(btn);
  });
  chatContainer.appendChild(divSugs);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ─── Enviar para IA (streaming via SSE) ─────────────────────────────────────────
async function enviarParaIA(mensagem) {
  // Limitar tamanho para não explodir o body
  const mensagemFinal = mensagem.length > 6000
    ? mensagem.slice(0, 6000) + '\n\n*(conteúdo truncado)*'
    : mensagem;
  conversaIA.push({ role: 'user', content: mensagemFinal });

  // Criar bolha vazia que receberá o texto em streaming
  const botRow   = addMsg('bot', '<div class="typing"><span></span><span></span><span></span></div>');
  const bubbleEl = botRow.querySelector('.msg-bubble');
  let timeoutId;

  try {
    const token    = await auth.currentUser.getIdToken();
    const contexto = await buildContexto(auth.currentUser.uid);
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 45000);

    const resp = await fetch(`${BACKEND_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ messages: conversaIA.slice(-12), contexto, stream: true }),
      signal:  controller.signal
    });
    clearTimeout(timeoutId);

    // Tratamento de erros HTTP antes de consumir o body
    if (resp.status === 429) {
      conversaIA.pop(); botRow.remove();
      const data = await resp.json().catch(() => ({}));
      addMsg('bot', escapeHTML(data.error || 'Limite de mensagens atingido. Tente mais tarde.')); return;
    }
    if (resp.status === 403) {
      conversaIA.pop(); botRow.remove();
      addMsg('bot', formatarMensagemIA('\uD83D\uDD12 O Assistente IA está disponível apenas no plano **Plus**.')); return;
    }
    if (!resp.ok) {
      conversaIA.pop(); botRow.remove();
      throw new Error('HTTP ' + resp.status);
    }

    let fullText = '';

    if (resp.headers.get('content-type')?.includes('text/event-stream')) {
      // ── Modo streaming SSE ───────────────────────────────────────────────────
      bubbleEl.innerHTML = '';
      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break outer;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) throw new Error(parsed.error);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              // Exibe sem o bloco de ação (ele aparece como card depois)
              // Remove bloco completo e também bloco parcial ainda em streaming
              const display = fullText
                .replace(/\[ACTION:TRANSACTION\][\s\S]*?\[\/ACTION\]/g, '')
                .replace(/\[ACTION:TRANSACTION\][\s\S]*$/g, '')
                .trim();
              bubbleEl.innerHTML = display ? formatarMensagemIA(display) : '<span style="opacity:0.4">...</span>';
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          } catch (_e) { /* ignora chunk malformado */ }
        }
      }
    } else {
      // ── Fallback JSON (backend sem streaming) ────────────────────────────────
      const data = await resp.json();
      fullText = data.reply || 'Desculpe, não consegui gerar uma resposta.';
    }

    await finalizarRespostaIA(fullText, bubbleEl, botRow);

  } catch (err) {
    clearTimeout(timeoutId);
    botRow.remove();
    // Recuperar texto da última mensagem do usuário antes de removê-la do histórico
    const ultimaMsgUsuario = (conversaIA.length > 0 && conversaIA[conversaIA.length - 1].role === 'user')
      ? conversaIA[conversaIA.length - 1].content : null;
    if (ultimaMsgUsuario) conversaIA.pop();

    const msgErro = err.name === 'AbortError'
      ? '⏱ A resposta demorou demais.'
      : '❌ Erro ao conectar ao assistente.';

    // Exibir erro com botão de retry (evita empilhar mensagens de erro)
    const errDiv = document.createElement('div');
    errDiv.className = 'msg msg-bot';
    errDiv.style.cssText = 'align-items:flex-start;';
    const errBubble = document.createElement('div');
    errBubble.className = 'msg-bubble';
    errBubble.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;';
    errBubble.innerHTML = `<span>${escapeHTML(msgErro)}</span>`;
    if (ultimaMsgUsuario) {
      const btnRetry = document.createElement('button');
      btnRetry.textContent = '↩ Tentar novamente';
      btnRetry.style.cssText = 'font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:0.5rem;background:var(--btn-bg);color:#fff;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;';
      btnRetry.addEventListener('click', () => {
        errDiv.remove();
        enviarParaIA(ultimaMsgUsuario);
      });
      errBubble.appendChild(btnRetry);
    }
    const errAvatar = document.createElement('div');
    errAvatar.className = 'msg-avatar';
    errAvatar.textContent = '\uD83E\uDD16';
    errDiv.appendChild(errAvatar);
    errDiv.appendChild(errBubble);
    chatContainer.appendChild(errDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Cooldown de 4s para evitar spam de retries
    _enviando = true;
    if (btnEnviar) btnEnviar.disabled = true;
    let secs = 4;
    const origPlaceholder = chatInput.placeholder;
    chatInput.placeholder = `Aguarde ${secs}s...`;
    const tick = setInterval(() => {
      secs--;
      if (secs > 0) {
        chatInput.placeholder = `Aguarde ${secs}s...`;
      } else {
        clearInterval(tick);
        _enviando = false;
        if (btnEnviar) btnEnviar.disabled = false;
        chatInput.placeholder = origPlaceholder;
        chatInput.focus();
      }
    }, 1000);
  }
}

// ─── Finalizar resposta IA (detectar ações + salvar histórico) ──────────────────
async function finalizarRespostaIA(fullText, bubbleEl, rowEl) {
  const acao        = detectarAcaoTransacao(fullText);
  const displayText = fullText
    .replace(/\[ACTION:TRANSACTION\][\s\S]*?\[\/ACTION\]/g, '')   // bloco completo
    .replace(/\[ACTION:TRANSACTION\]\s*\{[^{}]*\}\s*/g, '')        // bloco sem [/ACTION] (flat JSON)
    .trim();

  // Atualiza bolha com texto limpo e formatado
  bubbleEl.innerHTML = displayText
    ? formatarMensagemIA(displayText)
    : (acao ? '<span style="opacity:0.55;font-size:0.8125rem;">📝 Confirme os detalhes abaixo:</span>' : '');

  // Histórico: salvar texto limpo (sem o bloco de ação)
  conversaIA.push({ role: 'assistant', content: displayText || fullText });
  salvarConversa();
  if (auth.currentUser) salvarHistoricoFirestore(auth.currentUser.uid);

  // Mostrar card de confirmação de transação
  if (acao && rowEl) renderizarCartaoTransacao(acao, rowEl);

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ─── Detectar bloco de ação de transação na resposta da IA ──────────────────────
function detectarAcaoTransacao(texto) {
  // Tenta com tag de fechamento (formato correto)
  let inner = null;
  const m1 = texto.match(/\[ACTION:TRANSACTION\]([\s\S]*?)\[\/ACTION\]/);
  if (m1) {
    inner = m1[1].trim();
  } else {
    // Fallback: extrai JSON diretamente após o marcador (IA omitiu [/ACTION])
    const m2 = texto.match(/\[ACTION:TRANSACTION\]\s*(\{[^{}]*\})/);
    if (m2) inner = m2[1].trim();
  }
  if (!inner) return null;
  try {
    const dados = JSON.parse(inner);
    if (!dados.descricao || dados.valor == null) return null;
    return dados;
  } catch (_e) { return null; }
}

// ─── Renderizar card de confirmação de transação ─────────────────────────────────
function renderizarCartaoTransacao(dados, afterEl) {
  const uid  = auth.currentUser?.uid;
  const ctx  = _contextoCache;
  const contasList  = ctx?.resumo?.carteira || [];
  const cartoesList = ctx?.resumo?.cartoes  || [];

  // Montar lista unificada de contas/cartões para o select
  const todasContas = [
    ...contasList.map(c => ({ id: c.id, nome: c.nome, tipo: 'conta' })),
    ...cartoesList.map(c => ({ id: c.id, nome: c.nome, tipo: 'cartao' })),
    { id: '', nome: 'Sem vincular conta', tipo: '' },
  ];

  // Tentar pré-selecionar conta mencionada pela IA
  const contaMatch = todasContas.find(c =>
    c.nome && dados.conta && c.nome.toLowerCase().includes((dados.conta || '').toLowerCase())
  ) || todasContas[todasContas.length - 1];

  const CATS_BASE = ctx?.resumo?.categorias || ['Alimentação','Transporte','Saúde','Educação','Lazer','Moradia','Vestuário','Tecnologia','Serviços','Outros'];
  // Garantir que a categoria sugerida pela IA esteja na lista (mesmo que seja de outra lista)
  const aiCat = (dados.categoria || '').trim();
  const CATS  = aiCat && !CATS_BASE.includes(aiCat) ? [aiCat, ...CATS_BASE] : CATS_BASE;
  const dataHoje = new Date().toISOString().slice(0, 10);
  const dataVal  = dados.data && /^\d{4}-\d{2}-\d{2}$/.test(dados.data) ? dados.data : dataHoje;
  const cardId   = 'ac-' + Date.now();

  const card = document.createElement('div');
  card.style.cssText = 'margin:0.5rem 0 0.5rem 2.625rem;background:var(--card-bg);border:1.5px solid var(--input-focus);border-radius:1rem;padding:1rem;max-width:400px;box-shadow:0 2px 12px rgba(37,99,235,0.1);';

  // ── Gerar opções dos custom-selects ───────────────────────────────────────────
  const optsCatHtml = CATS.map(c =>
    `<div class="ia-cs-option${c === (dados.categoria || 'Outros') ? ' selected' : ''}" data-val="${escapeHTML(c)}">${escapeHTML(c)}</div>`
  ).join('');
  const optsContaHtml = todasContas.map(c =>
    `<div class="ia-cs-option${c.id === contaMatch.id ? ' selected' : ''}" data-val="${escapeHTML(c.id)}">${escapeHTML(c.nome)}${c.tipo === 'cartao' ? ' 💳' : c.tipo === 'conta' ? ' 🏦' : ''}</div>`
  ).join('');

  const inputStyle  = 'width:100%;padding:0.4rem 0.6rem;border-radius:0.5rem;border:1.5px solid var(--card-border);background:var(--input-bg);color:var(--text-main);font-size:0.8125rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s;';
  const labelStyle  = 'font-size:0.7rem;color:var(--text-sec);font-weight:600;margin-bottom:0.2rem;';

  card.innerHTML = `
    <div style="font-size:0.875rem;font-weight:700;color:var(--text-main);margin-bottom:0.75rem;">📝 Registrar transação?</div>
    <div style="display:grid;gap:0.5rem;">
      <div>
        <div style="${labelStyle}">Descrição</div>
        <input id="${cardId}-desc" value="${escapeHTML(dados.descricao)}" maxlength="200" style="${inputStyle}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
        <div>
          <div style="${labelStyle}">Valor (R$)</div>
          <input id="${cardId}-valor" type="number" min="0.01" step="0.01" value="${Number(dados.valor).toFixed(2)}" style="${inputStyle}">
        </div>
        <div>
          <div style="${labelStyle}">Tipo</div>
          <div class="ia-tipo-toggle" id="${cardId}-tipo-wrap">
            <button type="button" class="ia-tipo-btn${dados.tipo !== 'receita' ? ' active-despesa' : ''}" data-val="despesa">💸 Despesa</button>
            <button type="button" class="ia-tipo-btn${dados.tipo === 'receita' ? ' active-receita' : ''}" data-val="receita">💰 Receita</button>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
        <div>
          <div style="${labelStyle}">Categoria</div>
          <div class="ia-cs-wrap">
            <button type="button" class="ia-cs-trigger" id="${cardId}-cat-trigger">
              <span id="${cardId}-cat-label">${escapeHTML(dados.categoria || 'Outros')}</span>
              <span class="ia-cs-arrow">▼</span>
            </button>
            <div class="ia-cs-dropdown" id="${cardId}-cat-drop">${optsCatHtml}</div>
          </div>
        </div>
        <div>
          <div style="${labelStyle}">Data</div>
          <input id="${cardId}-data" type="date" value="${dataVal}" style="${inputStyle}">
        </div>
      </div>
      ${todasContas.length > 1 ? `<div>
        <div style="${labelStyle}">Conta / Cartão</div>
        <div class="ia-cs-wrap">
          <button type="button" class="ia-cs-trigger" id="${cardId}-conta-trigger">
            <span id="${cardId}-conta-label">${escapeHTML(contaMatch.nome)}${contaMatch.tipo === 'cartao' ? ' 💳' : contaMatch.tipo === 'conta' ? ' 🏦' : ''}</span>
            <span class="ia-cs-arrow">▼</span>
          </button>
          <div class="ia-cs-dropdown" id="${cardId}-conta-drop">${optsContaHtml}</div>
        </div>
      </div>` : ''}
    </div>
    <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
      <button id="${cardId}-ok" style="flex:1;padding:0.5rem;border-radius:0.625rem;background:var(--btn-bg);color:#fff;border:none;font-size:0.8125rem;font-weight:700;cursor:pointer;font-family:inherit;">✓ Confirmar</button>
      <button id="${cardId}-cancel" style="padding:0.5rem 0.75rem;border-radius:0.625rem;background:none;border:1.5px solid var(--card-border);color:var(--text-sec);font-size:0.8125rem;font-weight:600;cursor:pointer;font-family:inherit;">✕</button>
    </div>
    <div id="${cardId}-status" style="font-size:0.75rem;margin-top:0.4rem;display:none;"></div>
  `;

  afterEl.insertAdjacentElement('afterend', card);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // ── Estado dos custom-selects ──────────────────────────────────────────────────
  let _catVal   = dados.categoria || 'Outros';
  let _contaVal = contaMatch.id;
  let _tipoVal  = dados.tipo !== 'receita' ? 'despesa' : 'receita';

  // Toggle tipo
  card.querySelector(`#${cardId}-tipo-wrap`).addEventListener('click', e => {
    const btn = e.target.closest('.ia-tipo-btn');
    if (!btn) return;
    _tipoVal = btn.dataset.val;
    card.querySelectorAll(`#${cardId}-tipo-wrap .ia-tipo-btn`).forEach(b => {
      b.className = 'ia-tipo-btn' + (b.dataset.val === _tipoVal ? (b.dataset.val === 'receita' ? ' active-receita' : ' active-despesa') : '');
    });
  });

  // Helper: toggle custom-select
  function setupCs(triggerId, dropId, onPick) {
    const trigger = card.querySelector('#' + triggerId);
    const drop    = card.querySelector('#' + dropId);
    if (!trigger || !drop) return;
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = drop.classList.contains('open');
      // Fechar todos os outros drops do card
      card.querySelectorAll('.ia-cs-dropdown').forEach(d => { d.classList.remove('open'); });
      card.querySelectorAll('.ia-cs-trigger').forEach(t => { t.classList.remove('open'); });
      if (!isOpen) { drop.classList.add('open'); trigger.classList.add('open'); }
    });
    drop.addEventListener('click', e => {
      const opt = e.target.closest('.ia-cs-option');
      if (!opt) return;
      drop.querySelectorAll('.ia-cs-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      drop.classList.remove('open');
      trigger.classList.remove('open');
      onPick(opt.dataset.val, opt.textContent.trim());
    });
  }

  setupCs(`${cardId}-cat-trigger`, `${cardId}-cat-drop`, (val) => {
    _catVal = val;
    const lbl = card.querySelector(`#${cardId}-cat-label`);
    if (lbl) lbl.textContent = val;
  });
  if (todasContas.length > 1) {
    setupCs(`${cardId}-conta-trigger`, `${cardId}-conta-drop`, (val, txt) => {
      _contaVal = val;
      const lbl = card.querySelector(`#${cardId}-conta-label`);
      if (lbl) lbl.textContent = txt;
    });
  }

  // Fechar dropdowns ao clicar fora
  const _closeDrops = (e) => {
    if (!card.contains(e.target)) {
      card.querySelectorAll('.ia-cs-dropdown').forEach(d => d.classList.remove('open'));
      card.querySelectorAll('.ia-cs-trigger').forEach(t => t.classList.remove('open'));
    }
  };
  document.addEventListener('click', _closeDrops);

  // ── Confirmar ─────────────────────────────────────────────────────────────────
  document.getElementById(cardId + '-ok').addEventListener('click', async () => {
    const desc    = (document.getElementById(cardId + '-desc')?.value  || '').trim();
    const valor   = parseFloat(document.getElementById(cardId + '-valor')?.value || '0');
    const tipo    = _tipoVal;
    const cat     = _catVal;
    const dataStr = document.getElementById(cardId + '-data')?.value   || dataHoje;
    const contaId = _contaVal;

    const statusEl = document.getElementById(cardId + '-status');
    if (!desc || isNaN(valor) || valor <= 0) {
      if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = '#dc2626'; statusEl.textContent = 'Preencha descrição e valor corretamente.'; }
      return;
    }

    const btnOk = document.getElementById(cardId + '-ok');
    if (btnOk) { btnOk.disabled = true; btnOk.textContent = '⏳ Salvando...'; }

    try {
      const [y, m, d] = dataStr.split('-').map(Number);
      const txData = {
        descricao:      String(desc).substring(0, 200),
        valor:          Math.abs(valor),
        tipo,
        categoria:      cat,
        data:           Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0)),
        dataReferencia: dataStr,          // campo exigido por cartoes.js
        dataCriacao:    serverTimestamp(), // campo exigido por extrato.js e cartoes.js
        status:         'ativa',
        origem:         'assistente-ia',
      };
      if (contaId) {
        const contaObj = todasContas.find(c => c.id === contaId);
        if (contaObj?.tipo === 'cartao') {
          txData.cartaoId        = contaId;
          txData.formaPagamento  = 'Crédito';
          txData.pagamentoFatura = false;
        } else if (contaObj?.tipo === 'conta') {
          txData.carteiraId     = contaId;
          txData.formaPagamento = 'Débito';
        }
      }

      await addDoc(collection(db, 'usuarios', uid, 'transacoes'), txData);
      document.removeEventListener('click', _closeDrops);
      const destino = txData.cartaoId ? 'cartoes.html' : 'extrato.html';
      const label   = txData.cartaoId ? 'Ver no cartão →' : 'Ver no extrato →';
      card.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;color:#16a34a;font-size:0.875rem;font-weight:600;">✅ Transação registrada! <a href="${destino}" style="color:var(--btn-bg);font-size:0.8rem;margin-left:0.25rem;">${label}</a></div>`;
      _contextoCache = null; // invalidar cache para próxima mensagem ter dados atualizados

    } catch (_e) {
      if (btnOk) { btnOk.disabled = false; btnOk.textContent = '✓ Confirmar'; }
      if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = '#dc2626'; statusEl.textContent = 'Erro ao salvar. Tente novamente.'; }
    }
  });

  document.getElementById(cardId + '-cancel').addEventListener('click', () => {
    document.removeEventListener('click', _closeDrops);
    card.remove();
  });
  return card;
}

// ─── Histórico persistente (Firestore) ──────────────────────────────────────────
async function salvarHistoricoFirestore(uid) {
  if (!conversaIA.length) return;
  try {
    await setDoc(doc(db, 'usuarios', uid, 'ia_sessao', 'ultima'), {
      conversa:     conversaIA.slice(-30),
      atualizadoEm: serverTimestamp(),
    });
  } catch (_e) { /* silencia — não crítico */ }
}

async function carregarHistoricoFirestore(uid) {
  try {
    const snap  = await getDoc(doc(db, 'usuarios', uid, 'ia_sessao', 'ultima'));
    if (!snap.exists()) return [];
    const dados = snap.data();
    const ts    = dados.atualizadoEm?.toDate?.();
    // Carrega histórico se for de até 48h atrás
    if (!ts || (Date.now() - ts.getTime()) > 48 * 60 * 60 * 1000) return [];
    return Array.isArray(dados.conversa) ? dados.conversa : [];
  } catch (_e) { return []; }
}

// ─── Exportar conversa ───────────────────────────────────────────────────────────
function exportarConversa() {
  if (!conversaIA.length) {
    addMsg('bot', formatarMensagemIA('📭 Nenhuma mensagem para exportar ainda.'));
    return;
  }
  const linhas = conversaIA.map(m => {
    const quem  = m.role === 'user' ? 'Você' : 'Buddy';
    const texto = m.content.replace(/\[ACTION:TRANSACTION\][\s\S]*?\[\/ACTION\]/g, '').trim();
    return `[${quem}]\n${texto}`;
  });
  const conteudo = `Conversa com Buddy — ${new Date().toLocaleString('pt-BR')}\n${'─'.repeat(40)}\n\n` + linhas.join('\n\n---\n\n');
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bud-ia-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
window.exportarConversa = exportarConversa;

// ─── Modo coach (análise automática às segundas-feiras) ──────────────────────────
function verificarModoCoach() {
  const hoje    = new Date();
  if (hoje.getDay() !== 1) return; // apenas segunda-feira
  // Usar chave por semana para não repetir na mesma semana
  const semana = `${hoje.getFullYear()}-${Math.ceil((hoje.getDate() + new Date(hoje.getFullYear(), hoje.getMonth(), 1).getDay()) / 7)}`;
  const chave  = 'bud_ia_coach_' + semana;
  if (localStorage.getItem(chave)) return;
  localStorage.setItem(chave, '1');
  setTimeout(() => {
    addMsg('bot', formatarMensagemIA('📅 **Check semanal de segunda-feira!** Deixa eu dar uma olhada nas suas finanças...'));
    enviarParaIA('Faça um check-up rápido das minhas finanças: como estou em relação ao mês passado? O que devo focar esta semana?');
  }, 2000);
}

// Verifica chamados resolvidos não notificados e mostra mensagem no chat
async function verificarChamadosResolvidos(user) {
  if (!BACKEND_URL) return;
  try {
    const token = await user.getIdToken();
    const resp  = await fetch(`${BACKEND_URL}/api/meus-chamados`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) return;
    const pendentes = await resp.json();
    if (!Array.isArray(pendentes) || !pendentes.length) return;
    pendentes.forEach(c => {
      const preview = c.descricao ? `"${escapeHTML(c.descricao.slice(0, 60))}${c.descricao.length > 60 ? '…' : ''}"` : 'seu chamado';
      addMsg('bot', formatarMensagemIA(`✅ **Chamado resolvido!** Nossa equipe analisou e resolveu ${preview}. Obrigado pelo feedback! Se tiver mais dúvidas, é só perguntar. 😊`));
    });
  } catch (_e) { /* silencia — não crítico */ }
}

async function enviarChamado(tipo, descricao) {
  addTyping();
  try {
    const token = await auth.currentUser.getIdToken();
    const resp  = await fetch(`${BACKEND_URL}/api/chamado`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({
        tipo, descricao: descricao.slice(0, 2000),
        nomeUsuario:  escapeHTML(usuarioDados.nome  || ''),
        emailUsuario: escapeHTML(usuarioDados.email || '')
      })
    });
    removeTyping();
    if (resp.ok) {
      const emoji = tipo === 'bug' ? '\uD83D\uDC1B' : '\uD83D\uDCA1';
      addMsg('bot', `${emoji} Obrigado! Chamado registrado. Nossa equipe analisará em breve. \uD83D\uDE4F`);
    } else {
      addMsg('bot', '❌ Não consegui registrar o chamado. Tente novamente.');
    }
  } catch (_e) {
    removeTyping();
    addMsg('bot', '❌ Erro ao enviar chamado. Verifique sua conexão.');
  } finally {
    modoChamado = { ativo: false, tipo: null };
    chatInput.placeholder = 'Pergunte sobre suas finanças...';
  }
}

// ─── Funções expostas no window ─────────────────────────────────────────────────────
window.selecionarTipoChamado = function(tipo) {
  modoChamado = { ativo: true, tipo };
  const label = tipo === 'bug' ? 'bug encontrado' : 'sugestão';
  addMsg('bot', `Certo! Descreva o ${escapeHTML(label)} com o máximo de detalhes:`);
  chatInput.placeholder = 'Descreva aqui...';
  chatInput.focus();
};

window.cancelarChamado = function() {
  modoChamado = { ativo: false, tipo: null };
  chatInput.placeholder = 'Pergunte sobre suas finanças...';
  addMsg('bot', 'Chamado cancelado. Como posso ajudar?');
};

window.iniciarChamado = function(tipo) {
  if (tipo) {
    window.selecionarTipoChamado(tipo);
  } else {
    addMsg('bot', 'Você quer reportar um **bug** ou dar uma **sugestão**?');
    const div = document.createElement('div');
    div.className = 'chamado-btns';
    div.innerHTML = `
      <button class="chamado-btn bug" onclick="window.selecionarTipoChamado('bug')">🐛 Bug</button>
      <button class="chamado-btn sug" onclick="window.selecionarTipoChamado('sugestao')">💡 Sugestão</button>
      <button class="chamado-btn" onclick="window.cancelarChamado()">✕ Cancelar</button>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

window.enviarPergunta = function(texto) {
  chatInput.value = texto;
  chatForm.dispatchEvent(new Event('submit'));
};

window.limparChat = function() {
  conversaIA = [];
  modoChamado = { ativo: false, tipo: null };
  _contextoCache = null; // invalidar cache ao limpar
  chatInput.placeholder = 'Pergunte sobre suas finanças...';
  sessionStorage.removeItem('bud_conversa_ia');
  // Limpar histórico persistente no Firestore
  if (auth.currentUser) {
    setDoc(doc(db, 'usuarios', auth.currentUser.uid, 'ia_sessao', 'ultima'), {
      conversa: [], atualizadoEm: serverTimestamp()
    }).catch(() => {});
  }
  chatContainer.innerHTML = '';
  // Recarregar com boas vindas atualizadas
  buildContexto(auth.currentUser?.uid, true).then(ctx => {
    const alertas = analisarSaudeFinanceira(ctx);
    addBoasVindas(usuarioDados.nome, ctx, alertas);
  });
};

// ─── Parser OFX inline ─────────────────────────────────────────────────────────
function _parseOFXInline(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const ledgerMatch = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([\d.\-]+)/i);
  const ledgerBal   = ledgerMatch ? parseFloat(ledgerMatch[1]) : null;
  const rows = [];
  const txBlocks = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];
  txBlocks.forEach(block => {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dtPosted = get('DTPOSTED');
    const amtStr   = get('TRNAMT');
    const memo     = get('MEMO') || get('NAME') || '';
    if (!dtPosted || !amtStr) return;
    const data  = `${dtPosted.slice(0,4)}-${dtPosted.slice(4,6)}-${dtPosted.slice(6,8)}`;
    const valor = parseFloat(amtStr.replace(',', '.'));
    if (isNaN(valor)) return;
    rows.push({ data, descricao: memo.substring(0,200), valor: Math.abs(valor), tipo: valor < 0 ? 'despesa' : 'receita' });
  });
  return { rows, ledgerBal };
}

// ─── Parser CSV inline ─────────────────────────────────────────────────────────
function _parseCSVInline(text) {
  const linhas = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return { rows: [] };
  const sep    = (linhas[0].match(/;/g)||[]).length > (linhas[0].match(/,/g)||[]).length ? ';' : ',';
  const header = linhas[0].split(sep).map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
  const iData  = header.findIndex(h => /\bdata\b|date/.test(h));
  const iDesc  = header.findIndex(h => /descr|memo|hist|lancamento|lan.amento|estabelecimento/.test(h));
  const iValor = header.findIndex(h => /\bvalor\b|value|amount/.test(h));
  const iTipo  = header.findIndex(h => /\btipo\b|type|natureza/.test(h));
  const rows = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols  = linhas[i].split(sep).map(c => c.trim().replace(/^"|"$/g,''));
    if (iValor < 0 || !cols[iValor]) continue;
    const valor = parseFloat(String(cols[iValor]).replace(/[^\d,.\-]/g,'').replace(',','.'));
    if (isNaN(valor) || valor === 0) continue;
    rows.push({
      data:      iData  >= 0 ? cols[iData]  : '—',
      descricao: (iDesc >= 0 ? cols[iDesc]  : 'Transação').substring(0, 200),
      valor:     Math.abs(valor),
      tipo:      valor < 0 || (iTipo >= 0 && /deb|desp|sa[íi]da/i.test(cols[iTipo]||'')) ? 'despesa' : 'receita'
    });
  }
  return { rows };
}

// ─── Parser Excel inline (SheetJS) ─────────────────────────────────────────────
async function _parseExcelInline(file) {
  if (!window.XLSX) throw new Error('Biblioteca Excel (SheetJS) não carregou. Recarregue a página.');
  const buf  = await file.arrayBuffer();
  const wb   = window.XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const json = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  if (json.length < 2) return { rows: [] };
  const header = json[0].map(h => String(h).toLowerCase().trim());
  const iData  = header.findIndex(h => /\bdata\b|date/.test(h));
  const iDesc  = header.findIndex(h => /descr|memo|hist|lancamento|lan.amento|estabelecimento/.test(h));
  const iValor = header.findIndex(h => /\bvalor\b|value|amount/.test(h));
  const iTipo  = header.findIndex(h => /\btipo\b|type|natureza/.test(h));
  if (iValor < 0) throw new Error('Coluna "Valor" não encontrada na planilha.');
  const rows = [];
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row || row.every(c => !c)) continue;
    const valor = parseFloat(String(row[iValor]||'').replace(/[^\d,.\-]/g,'').replace(',','.'));
    if (isNaN(valor) || valor === 0) continue;
    rows.push({
      data:      iData  >= 0 ? String(row[iData]||'')    : '—',
      descricao: (iDesc >= 0 ? String(row[iDesc]||'') : 'Transação').substring(0, 200),
      valor:     Math.abs(valor),
      tipo:      valor < 0 || (iTipo >= 0 && /deb|desp|sa[íi]da/i.test(String(row[iTipo]||''))) ? 'despesa' : 'receita'
    });
  }
  return { rows };
}

// ─── Processar arquivo no chat ─────────────────────────────────────────────────
async function processarArquivoChat(file) {
  if (_enviando) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const EXTS_OK = ['ofx','qfx','pdf','jpg','jpeg','png','webp','csv','xls','xlsx'];
  if (!EXTS_OK.includes(ext)) {
    addMsg('bot', formatarMensagemIA(`❌ Formato **${escapeHTML(ext.toUpperCase())}** não suportado.\n\nAceito: **OFX, QFX, PDF, imagens (JPG/PNG/WEBP), CSV, XLS, XLSX**`));
    return;
  }

  _enviando = true;
  btnEnviar.disabled = true;
  const tipingEl = addMsg('bot', `⏳ Analisando **${escapeHTML(file.name)}**...`);

  try {
    let rows = [], ledgerBal = null, cupomData = null;

    if (ext === 'ofx' || ext === 'qfx') {
      const text = await file.text();
      ({ rows, ledgerBal } = _parseOFXInline(text));

    } else if (ext === 'csv') {
      const text = await file.text();
      ({ rows } = _parseCSVInline(text));

    } else if (ext === 'xls' || ext === 'xlsx') {
      ({ rows } = await _parseExcelInline(file));

    } else if (ext === 'pdf') {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await fetch(`${BACKEND_URL}/api/extrair-fatura`, { method: 'POST', body: fd });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || 'Erro ao processar PDF');
      }
      const tx = await r.json();
      rows = tx.map(t => ({ data: t.data, descricao: t.desc, valor: t.valor, tipo: t.tipo || 'despesa' }));

    } else {
      // Imagem: tenta extrato/fatura → fallback cupom fiscal
      const fd1 = new FormData();
      fd1.append('arquivo', file);
      const r1 = await fetch(`${BACKEND_URL}/api/extrair-fatura`, { method: 'POST', body: fd1 });
      if (r1.ok) {
        const tx = await r1.json();
        rows = tx.map(t => ({ data: t.data, descricao: t.desc, valor: t.valor, tipo: t.tipo || 'despesa' }));
      }
      if (rows.length === 0) {
        const fd2 = new FormData();
        fd2.append('arquivos', file);
        const r2 = await fetch(`${BACKEND_URL}/api/extrair-cupom`, { method: 'POST', body: fd2 });
        if (!r2.ok) {
          const e = await r2.json().catch(() => ({}));
          throw new Error(e.error || 'Não foi possível extrair dados da imagem');
        }
        cupomData = await r2.json();
      }
    }

    tipingEl.remove();
    addMsg('user', `📎 ${escapeHTML(file.name)}`);

    if (cupomData) {
      // Cupom fiscal → card de registro direto + chip para análise
      const { mercado = '', cnpj = '', data = '', itens = [] } = cupomData;
      const total = itens.reduce((a, it) => a + (Number(it.valor || 0) * (Number(it.qtd) || 1)), 0);
      const infoEl = addMsg('bot', formatarMensagemIA(
        `🧾 Cupom de **${escapeHTML(mercado || 'Estabelecimento')}** — ${itens.length} item(s), total **${fmtBRL(total)}**. Confirme para registrar:`
      ));
      renderizarCartaoTransacao({
        descricao: `Compra em ${(mercado || 'Estabelecimento').substring(0, 80)}`,
        valor:     total,
        tipo:      'despesa',
        categoria: 'Alimentação',
        data:      normalizarData(data),
        conta:     '',
      }, infoEl);
      // Chip para análise opcional
      const chipDiv = document.createElement('div');
      chipDiv.style.cssText = 'margin:0.4rem 0 0 2.625rem;';
      const chipBtn = document.createElement('button');
      chipBtn.className = 'sug-btn';
      chipBtn.textContent = '📊 Analisar essa compra';
      const linhas = itens.slice(0, 40).map(it =>
        `- ${escapeHTML(it.nome || 'Item')} | Qtd:${it.qtd || 1} | R$${Number(it.valor || 0).toFixed(2)}`
      ).join('\n');
      const msgAnalise = `Cupom de **${escapeHTML(mercado)}** (${escapeHTML(data)}, CNPJ: ${escapeHTML(cnpj)}) — ${itens.length} item(s), total ${fmtBRL(total)}\n\n${linhas}\n\nAnalise essa compra e dê dicas de como economizar.`;
      chipBtn.addEventListener('click', () => { chipDiv.remove(); window.enviarPergunta(msgAnalise); });
      chipDiv.appendChild(chipBtn);
      chatContainer.appendChild(chipDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;

    } else if (rows.length > 0) {
      // Extrato / fatura / planilha → cards de registro direto (máx 5)
      const exibir   = rows.slice(0, 5);
      const restante = rows.length - exibir.length;
      const msgTexto = rows.length === 1
        ? `📋 **1 transação** encontrada. Confirme para registrar:`
        : `📋 **${rows.length} transações** encontradas em **${escapeHTML(file.name)}**.` +
          (restante > 0 ? ` Exibindo as primeiras **${exibir.length}** — para importar todas use **Carteira → Importar**.` : '') +
          ` Confirme para registrar:`;
      const infoEl = addMsg('bot', formatarMensagemIA(msgTexto));
      let lastEl = infoEl;
      exibir.forEach(r => {
        const card = renderizarCartaoTransacao({
          descricao: r.descricao || 'Transação',
          valor:     r.valor     || 0,
          tipo:      r.tipo      || 'despesa',
          categoria: 'Outros',
          data:      normalizarData(r.data),
          conta:     '',
        }, lastEl);
        if (card) lastEl = card;
      });
      // Chip para análise (só se mais de 1 transação)
      if (rows.length > 1) {
        const chipDiv = document.createElement('div');
        chipDiv.style.cssText = 'margin:0.4rem 0 0 2.625rem;';
        const chipBtn = document.createElement('button');
        chipBtn.className = 'sug-btn';
        chipBtn.textContent = '📊 Analisar extrato completo';
        const recTot  = rows.filter(r => r.tipo === 'receita').reduce((a, r) => a + (r.valor || 0), 0);
        const despTot = rows.filter(r => r.tipo !== 'receita').reduce((a, r) => a + (r.valor || 0), 0);
        const linhasA = rows.slice(0, 50).map(r =>
          `- ${r.data || '—'} | ${escapeHTML(r.descricao || 'Tx')} | ${r.tipo === 'receita' ? '+' : '-'}R$${Number(r.valor || 0).toFixed(2)}`
        ).join('\n');
        const msgAn = `Arquivo **${escapeHTML(file.name)}** — ${rows.length} transações\nReceitas: ${fmtBRL(recTot)} | Despesas: ${fmtBRL(despTot)}${ledgerBal != null ? ' | Saldo banco: ' + fmtBRL(ledgerBal) : ''}\n\n${linhasA}\n\nAnalise e dê insights sobre meus gastos.`;
        chipBtn.addEventListener('click', () => { chipDiv.remove(); window.enviarPergunta(msgAn); });
        chipDiv.appendChild(chipBtn);
        chatContainer.appendChild(chipDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }

    } else {
      // PEND-063: nenhuma transação encontrada — tentar classificação inteligente do documento
      await _detectarEProcessarDocumento(file);
    }

  } catch (err) {
    tipingEl.remove();
    addMsg('bot', formatarMensagemIA(`❌ **Erro ao processar arquivo:** ${escapeHTML(err.message || 'Tente novamente.')}`));
  } finally {
    _enviando = false;
    btnEnviar.disabled = false;
    chatInput.focus();
  }
}

// ─── PEND-063: Detecção inteligente de documento financeiro ───────────────────
// Chamado quando processarArquivoChat não encontra transações.
// Envia o arquivo para /api/analisar-documento e renderiza o card adequado.
async function _detectarEProcessarDocumento(file) {
  if (!BACKEND_URL) {
    addMsg('bot', formatarMensagemIA('⚠️ Não encontrei transações neste arquivo. Verifique se é um extrato bancário ou planilha financeira válida.'));
    return;
  }

  const statusEl = addMsg('bot', formatarMensagemIA('🔍 Identificando tipo de documento...'));
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Usuário não autenticado.');

    const fd = new FormData();
    fd.append('arquivo', file);
    const resp = await fetch(`${BACKEND_URL}/api/analisar-documento`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body:    fd
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const anal = await resp.json();

    // Remove a mensagem de "identificando..."
    statusEl.remove();
    _renderizarDocumentoDetectado(anal, file.name);

  } catch (_err) {
    statusEl.remove();
    addMsg('bot', formatarMensagemIA(
      '⚠️ Não encontrei transações neste arquivo. Caso seja um extrato, tente via **Carteira → Importar Extrato**.'
    ));
  }
}

// Renderiza o card/mensagem adequado para o documento detectado pelo backend
function _renderizarDocumentoDetectado(anal, nomeArquivo) {
  const { tipo = 'outro', confianca = 0, dados = {} } = anal;
  const nomeSafe = escapeHTML(nomeArquivo);

  if (tipo === 'fatura_cartao') {
    addMsg('bot', formatarMensagemIA(
      `💳 **Fatura de cartão detectada** em **${nomeSafe}**.\n\n` +
      'Para importar as transações, use **Cartões → 📤 Importar IA** nessa fatura.'
    ));
    const chipDiv = document.createElement('div');
    chipDiv.style.cssText = 'margin:0.4rem 0 0 2.625rem;';
    const chipBtn = document.createElement('button');
    chipBtn.className = 'sug-btn';
    chipBtn.textContent = '💳 Ir para Cartões';
    chipBtn.addEventListener('click', () => { window.location.href = 'cartoes.html'; });
    chipDiv.appendChild(chipBtn);
    chatContainer.appendChild(chipDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

  } else if (tipo === 'extrato_bancario') {
    addMsg('bot', formatarMensagemIA(
      `🏦 **Extrato bancário detectado** em **${nomeSafe}**.\n\n` +
      'Para importar, use **Carteira → Importar Extrato** (OFX, PDF, CSV).'
    ));
    const chipDiv = document.createElement('div');
    chipDiv.style.cssText = 'margin:0.4rem 0 0 2.625rem;';
    const chipBtn = document.createElement('button');
    chipBtn.className = 'sug-btn';
    chipBtn.textContent = '🏦 Ir para Carteira';
    chipBtn.addEventListener('click', () => { window.location.href = 'carteira.html'; });
    chipDiv.appendChild(chipBtn);
    chatContainer.appendChild(chipDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

  } else if (tipo === 'emprestimo') {
    const { credor = '', valorParcela = 0, nParcelas = 0, taxa = 0, vencimento = null, tipoEmprestimo = '', totalFinanciado = 0 } = dados;
    const totalCalc = (valorParcela && nParcelas) ? valorParcela * nParcelas : totalFinanciado;
    let resumo = '';
    if (credor)         resumo += `**Credor:** ${escapeHTML(credor)}\n`;
    if (tipoEmprestimo) resumo += `**Tipo:** ${escapeHTML(tipoEmprestimo)}\n`;
    if (nParcelas && valorParcela) resumo += `**Parcelas:** ${nParcelas}× ${fmtBRL(valorParcela)}\n`;
    if (totalCalc > 0)  resumo += `**Total:** ${fmtBRL(totalCalc)}\n`;
    if (taxa > 0)       resumo += `**Taxa:** ${taxa.toFixed(2)}% a.m.\n`;
    if (vencimento)     resumo += `**1ª parcela:** ${vencimento.split('-').reverse().join('/')}\n`;

    addMsg('bot', formatarMensagemIA(
      `📄 **Contrato de empréstimo detectado** em **${nomeSafe}**.\n\n${resumo}\nDeseja registrar como dívida no Bud Finance?`
    ));

    if (credor && valorParcela > 0 && nParcelas > 0) {
      const chipDiv = document.createElement('div');
      chipDiv.style.cssText = 'margin:0.4rem 0 0 2.625rem;display:flex;gap:0.5rem;flex-wrap:wrap;';
      const btnCriar = document.createElement('button');
      btnCriar.className = 'sug-btn';
      btnCriar.textContent = '➕ Registrar Dívida';
      btnCriar.addEventListener('click', () => {
        try {
          sessionStorage.setItem('bud_prefill_divida', JSON.stringify({
            nome: credor, valorParcela, parcelas: nParcelas, juros: taxa,
            vencimento: vencimento || new Date().toISOString().slice(0, 10),
            tipoEmprestimo
          }));
        } catch (_) {}
        window.location.href = 'dividas.html?prefill=1';
      });
      chipDiv.appendChild(btnCriar);
      chatContainer.appendChild(chipDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

  } else if (tipo === 'boleto') {
    const { credor = '', valor = 0, vencimento = null, banco = '' } = dados;
    let resumo = '';
    if (credor)    resumo += `**Credor:** ${escapeHTML(credor)}\n`;
    if (banco)     resumo += `**Banco:** ${escapeHTML(banco)}\n`;
    if (valor > 0) resumo += `**Valor:** ${fmtBRL(valor)}\n`;
    if (vencimento) resumo += `**Vencimento:** ${vencimento.split('-').reverse().join('/')}\n`;

    const infoEl = addMsg('bot', formatarMensagemIA(
      `📋 **Boleto detectado** em **${nomeSafe}**.\n\n${resumo}\nDeseja registrar como despesa?`
    ));

    if (valor > 0) {
      renderizarCartaoTransacao({
        descricao: credor ? `Pagamento boleto — ${credor}`.substring(0, 80) : 'Pagamento de boleto',
        valor,
        tipo:      'despesa',
        categoria: 'Serviços',
        data:      normalizarData(vencimento),
        conta:     ''
      }, infoEl);
    }

  } else if (tipo === 'contrato_investimento') {
    const { produto = '', emissor = '', valor = 0, vencimento = null, taxa = 0 } = dados;
    let resumo = '';
    if (produto)   resumo += `**Produto:** ${escapeHTML(produto)}\n`;
    if (emissor)   resumo += `**Emissor:** ${escapeHTML(emissor)}\n`;
    if (valor > 0) resumo += `**Valor investido:** ${fmtBRL(valor)}\n`;
    if (taxa > 0)  resumo += `**Taxa:** ${taxa.toFixed(2)}% a.a.\n`;
    if (vencimento) resumo += `**Vencimento:** ${vencimento.split('-').reverse().join('/')}\n`;

    addMsg('bot', formatarMensagemIA(
      `📈 **Contrato de investimento detectado** em **${nomeSafe}**.\n\n${resumo}Para registrar, acesse a tela **Investimentos**.`
    ));
    const chipDiv = document.createElement('div');
    chipDiv.style.cssText = 'margin:0.4rem 0 0 2.625rem;';
    const chipBtn = document.createElement('button');
    chipBtn.className = 'sug-btn';
    chipBtn.textContent = '📈 Ir para Investimentos';
    chipBtn.addEventListener('click', () => { window.location.href = 'investimentos.html'; });
    chipDiv.appendChild(chipBtn);
    chatContainer.appendChild(chipDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

  } else {
    // outro | não identificado | baixa confiança
    const extra = confianca < 40
      ? '\n\nNão foi possível identificar o tipo de documento com confiança suficiente.'
      : '';
    addMsg('bot', formatarMensagemIA(
      `📎 Documento **${nomeSafe}** recebido, mas não identifiquei o tipo automaticamente.${extra}\n\n` +
      'Posso ajudar se você descrever o que é (ex: "É um contrato de empréstimo do Banco X").'
    ));
  }
}

// ─── Reconhecimento de voz (Web Speech API) ────────────────────────────────────
function setupVoz() {
  const SR     = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btnMic = document.getElementById('btnMic');
  if (!SR || !btnMic) return;
  btnMic.style.display = 'flex'; // mostra só se API disponível

  const rec = new SR();
  rec.lang            = 'pt-BR';
  rec.interimResults  = true;
  rec.continuous      = false;
  rec.maxAlternatives = 1;

  let gravando = false, base = '';

  rec.onstart  = () => { gravando = true;  base = chatInput.value; btnMic.classList.add('gravando');    btnMic.title = 'Parar gravação'; };
  rec.onend    = () => { gravando = false; btnMic.classList.remove('gravando'); btnMic.title = 'Falar'; };
  rec.onerror  = (e) => {
    gravando = false;
    btnMic.classList.remove('gravando');
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      addMsg('bot', '🎤 Microfone indisponível. Verifique as permissões do navegador.');
    }
  };
  rec.onresult = (e) => {
    const t = Array.from(e.results).map(r => r[0].transcript).join('');
    chatInput.value = (base ? base + ' ' : '') + t;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  };

  btnMic.addEventListener('click', () => gravando ? rec.stop() : rec.start());
}

// ─── Setup upload de arquivos ───────────────────────────────────────────────────
function setupArquivos() {
  const btnAnexar = document.getElementById('btnAnexar');
  const fileInput = document.getElementById('fileInput');
  if (!btnAnexar || !fileInput) return;
  btnAnexar.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) { processarArquivoChat(f); fileInput.value = ''; }
  });
}

// ─── Auto-resize textarea ───────────────────────────────────────────────────────
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); }
});

// ─── Submit form ─────────────────────────────────────────────────────────────────
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const texto = chatInput.value.trim();
  if (!texto || _enviando) return;
  _enviando = true;
  btnEnviar.disabled = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  try {
    addMsg('user', escapeHTML(texto));
    if (modoChamado.ativo && modoChamado.tipo) {
      await enviarChamado(modoChamado.tipo, texto);
    } else if (/\b(reportar?|report|abrir?)\s+(um\s+)?(bug|erro|problema|chamado|ticket)\b|quero\s+(reportar?|relatar?|abrir?)|encontrei\s+(um\s+)?(bug|erro|problema)/i.test(texto)) {
      window.iniciarChamado('bug');
    } else if (/\b(tenho\s+uma?\s+)?(sugest[aã]o|sugerir?|melhoria|feedback|ideia)\b/i.test(texto)) {
      window.iniciarChamado('sugestao');
    } else {
      await enviarParaIA(texto);
    }
  } finally {
    _enviando = false;
    btnEnviar.disabled = false;
    chatInput.focus();
  }
});

// ─── Sidebar ────────────────────────────────────────────────────────────────────
function setupSidebar() {
  const sidebar     = document.getElementById('sidebar');
  const overlay     = document.getElementById('sidebarOverlay');
  const btnHamb     = document.getElementById('btnHamburger');
  const btnCollapse = document.getElementById('btnSidebarCollapse');
  const dashMain    = document.getElementById('dashMain');

  if (localStorage.getItem('bud_sidebar_collapsed') === '1' && window.innerWidth > 768) {
    sidebar.classList.add('collapsed');
    dashMain.style.marginLeft = '64px';
    if (btnCollapse) btnCollapse.textContent = '›';
  }
  btnCollapse?.addEventListener('click', () => {
    if (window.innerWidth <= 768) return;
    const isCollapsed = sidebar.classList.toggle('collapsed');
    dashMain.style.marginLeft = isCollapsed ? '64px' : '260px';
    if (btnCollapse) btnCollapse.textContent = isCollapsed ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', isCollapsed ? '1' : '0');
  });
  btnHamb?.addEventListener('click', () => {
    sidebar.classList.toggle('open'); overlay.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open'); overlay.classList.remove('open');
  });
}

function ocultarSplash() {
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => { splash.style.display = 'none'; }, 500); }
}

// ─── Setup sidebar + voz + arquivos ─────────────────────────────────────────────
setupSidebar();
setupVoz();
setupArquivos();

// ─── Auth guard + init ──────────────────────────────────────────────────────────────
// ─── Acordar backend (Render free tier dorme após 15 min) ────────────────────
// Ping silencioso assim que a página carrega — sem auth, sem bloqueio.
// Objetivo: evitar cold start de 30-60s na primeira mensagem do usuário.
(function pingBackend() {
  if (!BACKEND_URL) return;
  fetch(BACKEND_URL + '/api/ping', { method: 'GET', cache: 'no-store' }).catch(() => {});
})();

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'index.html'; return; }

  try {
    const snap     = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = snap.exists() ? snap.data() : {};
    const plano    = (userData.plano || 'free').toLowerCase();

    usuarioDados = {
      nome:      userData.nome || user.displayName || '',
      email:     user.email || '',
      plano,
      matricula: userData.matricula || ''
    };

    // Sidebar usuário
    const nome     = usuarioDados.nome;
    const iniciais = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl   = document.getElementById('sidebarUserName');
    const idEl     = document.getElementById('sidebarUserId');
    if (avatarEl) avatarEl.textContent = iniciais;
    if (nameEl)   nameEl.textContent   = window.budSanitize ? window.budSanitize(nome) : nome;
    if (idEl)     idEl.textContent     = usuarioDados.matricula || '';

    document.getElementById('btnLogout')?.addEventListener('click', async () => {
      await signOut(auth); window.location.href = 'index.html';
    });

    // Gate de plano
    if (!PLANOS_ASSISTENTE.includes(plano)) {
      document.getElementById('paywallContainer').style.display = 'flex';
      document.getElementById('chatWrap').style.display = 'none';
      ocultarSplash();
      return;
    }

    // Subtitle dinâmico
    const sub = document.getElementById('headerSubtitle');
    if (sub) sub.textContent = `Seu consultor financeiro pessoal, ${nome.split(' ')[0] || 'usuário'}`;

    document.getElementById('btnLimparChat')?.addEventListener('click', window.limparChat);

    // Tentar carregar histórico do Firestore (até 48h); fallback para sessionStorage
    let historico = await carregarHistoricoFirestore(user.uid);
    if (!historico.length) historico = carregarConversa();

    if (historico.length > 0) {
      conversaIA = historico;
      conversaIA.forEach(m => addMsg(m.role === 'user' ? 'user' : 'bot', formatarMensagemIA(m.content)));
      ocultarSplash();
      verificarModoCoach();
      verificarChamadosResolvidos(user);
    } else {
      // Primeira abertura: carregar contexto + alertas + boas vindas
      const ctx     = await buildContexto(user.uid);
      const alertas = analisarSaudeFinanceira(ctx);
      addBoasVindas(nome, ctx, alertas);
      // Enviar email de alerta se houver problemas críticos (fire-and-forget)
      alertarAutomaticamente(alertas, nome);
      ocultarSplash();
      verificarModoCoach();
      verificarChamadosResolvidos(user);
    }

    chatInput.focus();

  } catch (_e) {
    window.location.href = 'index.html';
  }
});

