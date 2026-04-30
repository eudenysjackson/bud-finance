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

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs,
  collection, query, where, limit, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ────────────────────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

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

    const [txSnap, divSnap, metSnap, invSnap, cartSnap, limSnap] = await Promise.all([
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
    ]);

    const transacoes    = txSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const dividas       = divSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const metas         = metSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const investimentos = invSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const carteiras     = cartSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const limites       = limSnap.docs.map(d => ({ ...d.data(), id: d.id }));

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

    // ── Carteira
    const saldoTotal  = carteiras.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
    const contasLista = carteiras
      .filter(c => c.ativo !== false)
      .map(c => `${escapeHTML(c.nome||'Conta')}: ${valoresOcultos ? '•••' : fmtBRL(c.saldo)}`);

    // ── Dívidas
    const dividasAtivas = dividas.filter(d => d.status !== 'quitada');

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
        dividasAtivas:      dividasAtivas.length,
        metas:              metas.filter(m => m.status !== 'concluida').length,
        metasDetalhe,
        metasAtrasadas,
        investimentos:      investimentos.length,
        limites:            limitesDetalhe,
        limitesEstourados,
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
        contas: [], dividasAtivas: 0, metas: 0, metasDetalhe: [], metasAtrasadas: 0,
        investimentos: 0, limites: [], limitesEstourados: 0,
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
    alertas.push({ nivel: 'alerta', emoji: '\uD83D\uDC38', texto: `${r.limitesEstourados} categoria(s) com limite ultrapassado` });
  }
  if ((r.metasAtrasadas || 0) > 0) {
    alertas.push({ nivel: 'info', emoji: '\uD83C\uDFAF', texto: `${r.metasAtrasadas} meta(s) com prazo vencido ou atrasada(s)` });
  }
  if ((r.dividasAtivas || 0) > 3) {
    alertas.push({ nivel: 'info', emoji: '\uD83D\uDCB8', texto: `Você tem ${r.dividasAtivas} dívidas ativas registradas` });
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
    chips.push({ label: '\uD83D\uDCB8 Estrategia para as dívidas', msg: `Tenho ${r.dividasAtivas} dívida(s) ativa(s). Qual a melhor estratégia para quitar?` });
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
    `Olá${nomeTxt}! \uD83D\uDC4B Sou o **Bud**, seu assistente financeiro pessoal.` +
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

// ─── Enviar para IA ──────────────────────────────────────────────────────────────
async function enviarParaIA(mensagem) {
  conversaIA.push({ role: 'user', content: mensagem });
  addTyping();
  let timeoutId;
  try {
    const token    = await auth.currentUser.getIdToken();
    const contexto = await buildContexto(auth.currentUser.uid);
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(`${BACKEND_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ messages: conversaIA.slice(-12), contexto }),
      signal:  controller.signal
    });
    clearTimeout(timeoutId);
    removeTyping();

    if (resp.status === 429) {
      const data = await resp.json().catch(() => ({}));
      addMsg('bot', escapeHTML(data.error || 'Limite de mensagens atingido. Tente mais tarde.')); return;
    }
    if (resp.status === 403) {
      addMsg('bot', formatarMensagemIA('\uD83D\uDD12 O Assistente IA está disponível apenas no plano **Plus**.')); return;
    }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const data  = await resp.json();
    const reply = data.reply || 'Desculpe, não consegui gerar uma resposta.';
    conversaIA.push({ role: 'assistant', content: reply });
    salvarConversa();
    addMsg('bot', formatarMensagemIA(reply));

  } catch (err) {
    clearTimeout(timeoutId);
    removeTyping();
    if (err.name === 'AbortError') {
      addMsg('bot', '⏱ A resposta demorou demais. Tente novamente.');
    } else {
      addMsg('bot', '❌ Erro ao conectar ao assistente. Verifique sua conexão.');
    }
  }
}

// ─── Fluxo de chamado ────────────────────────────────────────────────────────────
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
  chatContainer.innerHTML = '';
  // Recarregar com boas vindas atualizadas
  buildContexto(auth.currentUser?.uid, true).then(ctx => {
    const alertas = analisarSaudeFinanceira(ctx);
    addBoasVindas(usuarioDados.nome, ctx, alertas);
  });
};

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

// ─── Auth guard + init ──────────────────────────────────────────────────────────────
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
    setupSidebar();

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

    // Carregar conversa salva OU iniciar fresh com contexto
    conversaIA = carregarConversa();
    if (conversaIA.length > 0) {
      // Replay da conversa sem alertas (já foram exibidos antes)
      conversaIA.forEach(m => addMsg(m.role === 'user' ? 'user' : 'bot', formatarMensagemIA(m.content)));
      ocultarSplash();
    } else {
      // Primeira abertura: carregar contexto + alertas + boas vindas
      const ctx     = await buildContexto(user.uid);
      const alertas = analisarSaudeFinanceira(ctx);
      addBoasVindas(nome, ctx, alertas);
      // Enviar email de alerta se houver problemas críticos (fire-and-forget)
      alertarAutomaticamente(alertas, nome);
      ocultarSplash();
    }

    chatInput.focus();

  } catch (_e) {
    window.location.href = 'index.html';
  }
});

