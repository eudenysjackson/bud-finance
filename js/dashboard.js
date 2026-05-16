// js/dashboard.js — Bud Finance Dashboard
// Auth guard + session management + summary rendering

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, collection, query, where, orderBy, limit, onSnapshot,
  addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase init ──────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── State ──────────────────────────────────────────────────────────────
let usuarioAtualId = null;
let transacoesGlobais = [];
let valoresOcultos = localStorage.getItem('bud_valores_ocultos') === 'true';
let mesVisualizado = new Date().getMonth();   // 0-based (0 = Jan)
let anoVisualizado = new Date().getFullYear();
const _unsubs = [];

// ─── Estado do modal ─────────────────────────────────────────────────────
let tipoAtual = 'receita';   // 'receita' | 'despesa'
let planoAtual = 'free';
let trialExpirado = false;
let transacaoEditandoId = null; // null = criando, string = editando
let filtroAtividadeAtual = 'todos'; // 'todos' | 'receita' | 'despesa'
let _skipThemeSync = false; // evita escrita circular no Firestore ao aplicar tema vindo do Firestore
var dividasGlobaisDash = [];        // dívidas do usuário para o widget do dashboard
var limitesGlobaisDash = [];        // limites por categoria para o widget do dashboard
var carteiraGlobal = [];            // contas da carteira para o widget do dashboard
var recorrentesGlobaisDash = [];    // recorrentes para o widget de lembretes
var metasGlobaisDash = [];          // metas para o widget Meta em Destaque
var investimentosGlobaisDash = [];  // investimentos para o widget Investimentos
var _unsubTransacoes = null;        // listener dedicado de transações (re-assinado ao trocar mês)
// ─── Categorias ──────────────────────────────────────────────────────────
// Padrão vem de window.BUD_CATEGORIAS_PADRAO (categorias-padrao.js)
// Personalizadas são carregadas via onSnapshot em setupListeners()
let categoriasPersonalizadas = { receita: [], despesa: [] };

// ─── Formatação ─────────────────────────────────────────────────────────
function formatarValor(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getIniciais(nome) {
  if (!nome) return '?';
  var partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function getSaudacao() {
  var h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarDataHoje() {
  var opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  var str = new Date().toLocaleDateString('pt-BR', opts);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getMesAnoLabel(ano, mes) {
  var a = (ano !== undefined) ? ano : anoVisualizado;
  var m = (mes !== undefined) ? mes : mesVisualizado;
  var d = new Date(a, m, 1);
  var str = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Toggle valores ocultos ─────────────────────────────────────────────
function atualizarVisibilidadeValores() {
  var els = document.querySelectorAll('#cardSaldo, #cardEntradas, #cardSaidas');
  if (valoresOcultos) {
    els.forEach(function (el) {
      el.textContent = 'R$ •••••';
    });
  }
  // Quando não oculto, renderizarDashboard já definiu os valores reais
  var btn = document.getElementById('btnToggleValues');
  if (btn) btn.textContent = valoresOcultos ? '🙈' : '👁️';
}

// ─── Renderizar dashboard ───────────────────────────────────────────────
function renderizarDashboard() {
  var mesAtual = mesVisualizado;
  var anoAtual = anoVisualizado;

  // Atualizar label da navegação de mês
  var navLabel = document.getElementById('navMesAno');
  if (navLabel) navLabel.textContent = getMesAnoLabel();

  var transacoesDoMes = transacoesGlobais.filter(function (t) {
    if (!t.data) return false;
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  var entradas = 0;
  var saidas = 0;

  transacoesDoMes.forEach(function (t) {
    var valor = t.valor || 0;
    if (t.tipo === 'receita' && t.confirmado !== false) {
      entradas += valor;
    } else if (t.tipo === 'despesa') {
      var ehCC = Boolean(t.cartaoId) && !t.pagamentoFatura;
      if (!ehCC) saidas += valor;
    }
  });

  var saldo = entradas - saidas;

  // Update cards
  var cardSaldo = document.getElementById('cardSaldo');
  var cardEntradas = document.getElementById('cardEntradas');
  var cardSaidas = document.getElementById('cardSaidas');

  if (cardSaldo) cardSaldo.textContent = valoresOcultos ? '•••' : formatarValor(saldo);
  if (cardEntradas) cardEntradas.textContent = valoresOcultos ? '•••' : formatarValor(entradas);
  if (cardSaidas) cardSaidas.textContent = valoresOcultos ? '•••' : formatarValor(saidas);

  // Sub labels
  var cardSaldoSub = document.getElementById('cardSaldoSub');
  var cardEntradasSub = document.getElementById('cardEntradasSub');
  var cardSaidasSub = document.getElementById('cardSaidasSub');
  if (cardSaldoSub) cardSaldoSub.textContent = getMesAnoLabel();
  // M4 fix: pluralização correta (era "1 transações").
  var nReceitas = transacoesDoMes.filter(function (t) { return t.tipo === 'receita'; }).length;
  var nDespesas = transacoesDoMes.filter(function (t) { return t.tipo === 'despesa'; }).length;
  if (cardEntradasSub) cardEntradasSub.textContent = nReceitas === 1 ? '1 transação' : nReceitas + ' transações';
  if (cardSaidasSub)   cardSaidasSub.textContent   = nDespesas === 1 ? '1 transação' : nDespesas + ' transações';

  // Variação % em relação ao mês anterior (exibida nos sub dos cards)
  (function () {
    var mesPrev = mesAtual - 1;
    var anoPrev = anoAtual;
    if (mesPrev < 0) { mesPrev = 11; anoPrev--; }
    var transPrev = transacoesGlobais.filter(function (t) {
      if (!t.data) return false;
      var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
      return d.getMonth() === mesPrev && d.getFullYear() === anoPrev;
    });
    var entPrev = 0, despPrev = 0;
    transPrev.forEach(function (t) {
      if (t.tipo === 'receita' && t.confirmado !== false) entPrev += (t.valor || 0);
      else if (t.tipo === 'despesa' && !(Boolean(t.cartaoId) && !t.pagamentoFatura)) despPrev += (t.valor || 0);
    });
    var saldoPrev = entPrev - despPrev;
    function varBadgeCard(atual, anterior, elId, inverterCor) {
      var el = document.getElementById(elId);
      if (!el) return;
      if (anterior === 0 || valoresOcultos) { el.style.display = 'none'; return; }
      var v   = (atual - anterior) / Math.abs(anterior) * 100;
      var pos = inverterCor ? v <= 0 : v >= 0;
      var cor = pos ? '#16a34a' : '#dc2626';
      var bg  = pos ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)';
      var mesLabel = new Date(anoPrev, mesPrev, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
      el.style.display = '';
      el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.6875rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:9999px;background:' + bg + ';color:' + cor + ';">' + (v >= 0 ? '▲' : '▼') + ' ' + Math.abs(v).toFixed(1) + '% vs ' + mesLabel + '</span>';
    }
    varBadgeCard(entradas, entPrev, 'cardEntradasVariacao', false);
    varBadgeCard(saidas,   despPrev, 'cardSaidasVariacao',   true);  // despesa menor = verde
    varBadgeCard(saldo,    saldoPrev,'cardSaldoVariacao',    false);
  })();

  // Banner de receitas pendentes de confirmação
  (function () {
    var banner = document.getElementById('bannerConfirmarReceitas');
    var texto  = document.getElementById('bannerConfirmarReceitasTexto');
    var btnB   = document.getElementById('btnBannerConfirmarReceitas');
    if (!banner) return;
    var pendentes = transacoesDoMes.filter(function (t) {
      return t.tipo === 'receita' && t.confirmado === false;
    });
    if (pendentes.length === 0) { banner.style.display = 'none'; return; }
    banner.style.display = '';
    var totalPend = pendentes.reduce(function (s, t) { return s + (t.valor || 0); }, 0);
    if (texto) texto.textContent = pendentes.length + ' receita' + (pendentes.length > 1 ? 's' : '') + ' a confirmar' + (!valoresOcultos ? ' · ' + formatarValor(totalPend) : '');
    if (btnB && !btnB._bannerBound) {
      btnB._bannerBound = true;
      btnB.addEventListener('click', function () {
        abrirModalConfirmarPendentes(pendentes);
      });
    }
  })();

  // Color saldo (verde se positivo, vermelho se negativo — só quando valores visíveis)
  if (cardSaldo) {
    cardSaldo.style.color = valoresOcultos ? 'var(--card-text)' : (saldo >= 0 ? '#16a34a' : '#dc2626');
  }

  // Atividades recentes (últimas 5)
  renderizarAtividades(transacoesDoMes);

  // Gráfico de despesas por categoria
  renderizarGraficos(transacoesDoMes);

  // Widget dívidas em atraso
  atualizarDividasAtraso();

  // Widget limites do mês
  atualizarLimitesWidget(transacoesDoMes, saidas);

  // Mini widget carteira
  atualizarWidgetCarteira();

  // Lembretes 7 dias
  atualizarLembretes7Dias();

  // Comparativo mês anterior
  atualizarComparativoMesAnterior();

  // Meta em destaque
  atualizarWidgetMetaProxima();

  // Widget investimentos
  atualizarWidgetInvestimentos();

  // Economia potencial
  atualizarEconomiaPotencial(transacoesDoMes);

  // Saúde financeira
  atualizarSaudeFinanceira(transacoesDoMes, entradas, saidas);

  // Dica contextual
  atualizarDicaFinanceira(transacoesDoMes, entradas, saidas);

  // Tudo em dia (após dividas + lembretes)
  atualizarTudoEmDia();

  // Apply visibility toggle (sempre — atualiza icon e oculta se necessário)
  atualizarVisibilidadeValores();
}

// ─── Gráfico Despesas por Categoria ─────────────────────────────────────
var _chartInstance = null;
var CHART_CORES = [
  '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  '#1d4ed8', '#6366f1', '#8b5cf6', '#a78bfa', '#cbd5e1'
];

function getChartCores() {
  if (window.budThemeManager && window.budThemeManager.getChartCores) {
    return window.budThemeManager.getChartCores();
  }
  return CHART_CORES;
}

function renderizarGraficos(transacoesDoMes) {
  var empty     = document.getElementById('graficoCategorias');
  var container = document.getElementById('graficoContainer');
  var canvas    = document.getElementById('chartCategorias');
  if (!empty || !container || !canvas) return;

  // Filtrar apenas despesas do mês (herda o filtro já feito em renderizarDashboard)
  var despesas = transacoesDoMes.filter(function (t) { return t.tipo === 'despesa'; });

  // Destruir instância anterior para evitar memory leak
  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  // BUG 6: Ocultar gráfico quando valores estão ocultos (privacidade)
  if (valoresOcultos) {
    empty.style.display = '';
    container.style.display = 'none';
    var emptyText = empty.querySelector('p');
    if (emptyText) emptyText.textContent = 'Valores ocultos 🔒';
    return;
  }

  if (despesas.length === 0) {
    empty.style.display = '';
    container.style.display = 'none';
    return;
  }

  // Agrupar por categoria
  var agrupado = {};
  despesas.forEach(function (t) {
    var cat = t.categoria || 'Outros';
    agrupado[cat] = (agrupado[cat] || 0) + (t.valor || 0);
  });
  var labels = Object.keys(agrupado);
  var valores = labels.map(function (k) { return agrupado[k]; });
  var cores   = labels.map(function (_, i) { var c = getChartCores(); return c[i % c.length]; });
  var legendColor = getComputedStyle(document.documentElement).getPropertyValue('--card-text-sec').trim() || '#64748b';

  // Mostrar canvas, ocultar estado vazio
  empty.style.display = 'none';
  container.style.display = 'block';

  // Plugin: texto central com total de despesas
  var _centerTextPlugin = {
    id: 'centerText',
    afterDraw: function (chart) {
      var total = chart.data.datasets[0].data.reduce(function (a, b) { return a + b; }, 0);
      var ctx2  = chart.ctx;
      var cx    = chart.chartArea.left + (chart.chartArea.right  - chart.chartArea.left) / 2;
      var cy    = chart.chartArea.top  + (chart.chartArea.bottom - chart.chartArea.top)  / 2;
      ctx2.save();
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      var labelColor = getComputedStyle(document.documentElement).getPropertyValue('--card-text').trim() || '#0f172a';
      var subColor   = getComputedStyle(document.documentElement).getPropertyValue('--card-text-sec').trim() || '#64748b';
      ctx2.font = '700 0.75rem Inter, sans-serif';
      ctx2.fillStyle = subColor;
      ctx2.fillText('DESPESAS', cx, cy - 14);
      ctx2.font = '800 1rem Inter, sans-serif';
      ctx2.fillStyle = '#dc2626';
      ctx2.fillText(valoresOcultos ? '•••' : formatarValor(total), cx, cy + 8);
      ctx2.restore();
    }
  };

  _chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: cores,
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    plugins: [_centerTextPlugin],
    options: {
      cutout: '70%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Inter, sans-serif', size: 11, weight: '600' },
            color: legendColor,
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
              var pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
              // BUG 6: Não expor valores reais no tooltip quando ocultos
              var valor = valoresOcultos ? '•••' : formatarValor(ctx.parsed);
              return ' ' + valor + ' (' + pct + '%)';
            }
          }
        }
      },
      animation: { animateRotate: true, animateScale: true }
    }
  });
}

// ─── Dívidas em Atraso (widget dashboard) ──────────────────────────────
function addMonthsDash(date, months) {
  var d = new Date(date);
  var targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // Se setMonth avançou o mês por causa de dias inexistentes, corrigir para último dia do mês-alvo
  if (d.getMonth() !== ((targetMonth % 12 + 12) % 12)) {
    d.setDate(0);
  }
  return d;
}

// ─── Helpers limites widget ────────────────────────────────────────────
function normalizeCategoriaDash(s) {
  return (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getGastosPorCatDash(transacoesMes) {
  var mapa = {};
  transacoesMes
    .filter(function(t) { return t.tipo === 'despesa' && !t.cartaoId; })
    .forEach(function(t) {
      var cat = normalizeCategoriaDash(t.categoria || 'Outros');
      mapa[cat] = (mapa[cat] || 0) + (parseFloat(t.valor) || 0);
    });
  return mapa;
}

function atualizarLimitesWidget(transacoesMes, saidasMes) {
  var sec   = document.getElementById('secLimitesWidget');
  var lista = document.getElementById('listaLimitesWidget');
  var sub   = document.getElementById('limitesWidgetSub');
  if (!sec || !lista) return;

  // Sem limites configurados → mostrar CTA para configurar
  if (limitesGlobaisDash.length === 0) {
    sec.style.display = '';
    if (sub) { sub.textContent = 'Nenhum limite definido'; sub.style.color = '#94a3b8'; }
    lista.innerHTML = '';
    var ctaDiv = document.createElement('div');
    ctaDiv.style.cssText = 'background:var(--sidebar-link-hover-bg);border:1.5px dashed var(--card-border);border-radius:0.875rem;padding:1rem;text-align:center;';
    ctaDiv.innerHTML = '<div style="font-size:1.5rem;margin-bottom:0.375rem;">🎯</div>'
      + '<div style="font-size:0.875rem;font-weight:700;color:var(--card-text);margin-bottom:0.25rem;">Defina limites por categoria</div>'
      + '<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.75rem;">Controle quanto gasta em cada área e receba alertas automáticos</div>'
      + '<a href="limites.html" style="display:inline-block;padding:0.5rem 1.25rem;border-radius:0.75rem;background:var(--theme-accent);color:#fff;font-size:0.8125rem;font-weight:700;text-decoration:none;">Definir limites</a>';
    lista.appendChild(ctaDiv);
    return;
  }

  var gastos = getGastosPorCatDash(transacoesMes);

  // Calcular receita do mês (para limites percentuais)
  var receitaMes = transacoesMes
    .filter(function(t) { return t.tipo === 'receita'; })
    .reduce(function(s, t) { return s + (parseFloat(t.valor) || 0); }, 0);

  // Calcular efetivo e % de cada limite
  var itens = limitesGlobaisDash.map(function(l) {
    var ef;
    if (l.tipoLimite === 'percentual' && l.percentual > 0) {
      ef = receitaMes > 0 ? Math.round(receitaMes * l.percentual / 100) : null;
    } else {
      ef = l.valorLimite || 0;
    }
    var gasto = gastos[normalizeCategoriaDash(l.categoria)] || 0;
    var pct   = (ef !== null && ef > 0) ? Math.round((gasto / ef) * 100) : (ef === null ? null : 0);
    return { l: l, ef: ef, gasto: gasto, pct: pct };
  });

  // Ordenar por % desc (null = aguardando receita vai para o fim)
  itens.sort(function(a, b) {
    var pa = a.pct === null ? -1 : a.pct;
    var pb = b.pct === null ? -1 : b.pct;
    return pb - pa;
  });

  var criticos = itens.filter(function(i) { return i.pct !== null && i.pct >= 80; });
  var totalEf  = itens.reduce(function(s, i) { return s + (i.ef || 0); }, 0);
  var pctTotal = totalEf > 0 ? Math.round((saidasMes / totalEf) * 100) : 0;

  sec.style.display = '';

  // Sub-texto
  if (sub) {
    if (criticos.length > 0) {
      sub.textContent = criticos.length + ' categoria' + (criticos.length > 1 ? 's' : '') + ' com alerta';
      sub.style.color = '#f59e0b';
    } else {
      sub.textContent = pctTotal + '% do orçamento utilizado';
      sub.style.color = '#94a3b8';
    }
  }

  // Indicador no card Saídas
  var elOrc = document.getElementById('cardSaidasOrcamento');
  if (elOrc && totalEf > 0) {
    var cor = pctTotal >= 100 ? '#dc2626' : pctTotal >= 80 ? '#d97706' : '#16a34a';
    elOrc.style.display = '';
    elOrc.innerHTML = '<div style="display:flex;align-items:center;gap:0.375rem;">'
      + '<div style="flex:1;height:5px;background:#e2e8f0;border-radius:999px;overflow:hidden;">'
      + '<div style="height:100%;border-radius:999px;background:' + cor + ';width:' + Math.min(100, pctTotal) + '%;transition:width .4s ease;"></div>'
      + '</div>'
      + '<span style="font-size:0.6875rem;font-weight:800;color:' + cor + ';white-space:nowrap;">' + pctTotal + '% orç.</span>'
      + '</div>';
  } else if (elOrc) {
    elOrc.style.display = 'none';
  }

  lista.innerHTML = '';

  // Se nenhum crítico, mostrar card de status geral
  if (criticos.length === 0) {
    var ok = document.createElement('div');
    var limNome = limitesGlobaisDash.length + ' limite' + (limitesGlobaisDash.length > 1 ? 's' : '') + ' definido' + (limitesGlobaisDash.length > 1 ? 's' : '');
    if (pctTotal > 100) {
      ok.style.cssText = 'background:rgba(255,251,235,0.8);border:1.5px solid rgba(253,211,77,0.4);border-radius:0.875rem;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.625rem;';
      ok.innerHTML = '<span style="font-size:1.25rem;">\u26A0\uFE0F</span>'
        + '<div>'
        + '<div style="font-size:0.875rem;font-weight:700;color:#d97706;">Gastos acima do orçamento</div>'
        + '<div style="font-size:0.75rem;font-weight:600;color:#92400e;">' + limNome + ' · ' + pctTotal + '% utilizado</div>'
        + '</div>';
    } else {
      ok.style.cssText = 'background:rgba(240,253,244,0.8);border:1.5px solid rgba(134,239,172,0.4);border-radius:0.875rem;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.625rem;';
      ok.innerHTML = '<span style="font-size:1.25rem;">\u2705</span>'
        + '<div>'
        + '<div style="font-size:0.875rem;font-weight:700;color:#16a34a;">Orçamento sob controle</div>'
        + '<div style="font-size:0.75rem;font-weight:600;color:#15803d;">' + limNome + ' · ' + pctTotal + '% utilizado</div>'
        + '</div>';
    }
    lista.appendChild(ok);
    return;
  }

  // Mostrar até 3 críticos
  criticos.slice(0, 3).forEach(function(item) {
    var l      = item.l;
    var estour = item.pct > 100;
    var bgCol  = estour ? 'rgba(254,242,242,0.8)' : 'rgba(255,251,235,0.8)';
    var brdCol = estour ? 'rgba(252,165,165,0.5)' : 'rgba(253,211,77,0.4)';
    var textCol = estour ? '#dc2626' : '#d97706';

    var el = document.createElement('div');
    el.style.cssText = 'background:' + bgCol + ';border:1.5px solid ' + brdCol + ';border-radius:0.875rem;padding:0.625rem 0.875rem;margin-bottom:0.5rem;';

    var nomeEsc = (l.categoria || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var efFmt  = item.ef !== null ? formatarValor(item.ef) : '—';
    var gastoFmt = formatarValor(item.gasto);
    var badge  = estour
      ? '<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#dc2626;padding:0.1rem 0.375rem;border-radius:9999px;margin-left:0.25rem;">ESTOURADO</span>'
      : '<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#d97706;padding:0.1rem 0.375rem;border-radius:9999px;margin-left:0.25rem;">' + item.pct + '%</span>';

    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem;">'
      + '<span style="font-size:0.875rem;font-weight:700;color:' + textCol + ';">' + nomeEsc + badge + '</span>'
      + '<span style="font-size:0.8125rem;font-weight:800;color:' + textCol + ';">' + gastoFmt + ' / ' + efFmt + '</span>'
      + '</div>'
      + '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;">'
      + '<div style="height:100%;border-radius:999px;background:' + (estour ? '#dc2626' : '#f59e0b') + ';width:' + Math.min(100, item.pct) + '%;transition:width .5s ease;"></div>'
      + '</div>';

    lista.appendChild(el);
  });

  // Rodapé se há mais de 3 críticos
  if (criticos.length > 3) {
    var mais = document.createElement('div');
    mais.style.cssText = 'text-align:center;padding:0.375rem;font-size:0.75rem;font-weight:600;color:#94a3b8;';
    mais.textContent = '+ ' + (criticos.length - 3) + ' outras categorias em alerta';
    lista.appendChild(mais);
  }
}

// Verifica se ao adicionar uma despesa algum limite foi cruzado (80% ou 100%)
function verificarAlerteLimite(categoria, valorNovo) {
  var mesAtual = mesVisualizado;
  var anoAtual = anoVisualizado;

  // Só verifica para o mês vigente
  var hojeM = new Date();
  if (mesAtual !== hojeM.getMonth() || anoAtual !== hojeM.getFullYear()) return;

  // Encontrar limite da categoria (normalizado)
  var catNorm = normalizeCategoriaDash(categoria);
  var limite = limitesGlobaisDash.find(function(l) {
    return normalizeCategoriaDash(l.categoria) === catNorm;
  });
  if (!limite) return;

  // Calcular gasto atual (incluindo a nova despesa que acabou de ser adicionada)
  // O onSnapshot ainda não atualizou — usamos transacoesGlobais + valorNovo
  var gastoAtual = transacoesGlobais
    .filter(function(t) {
      if (t.tipo !== 'despesa') return false;
      if (!t.data) return false;
      var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
        && normalizeCategoriaDash(t.categoria) === catNorm
        && !t.cartaoId;
    })
    .reduce(function(s, t) { return s + (parseFloat(t.valor) || 0); }, 0)
    + valorNovo;

  var receitaMes = transacoesGlobais
    .filter(function(t) {
      if (t.tipo !== 'receita') return false;
      if (!t.data) return false;
      var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce(function(s, t) { return s + (parseFloat(t.valor) || 0); }, 0);

  var ef;
  if (limite.tipoLimite === 'percentual' && limite.percentual > 0) {
    ef = receitaMes > 0 ? Math.round(receitaMes * limite.percentual / 100) : null;
  } else {
    ef = limite.valorLimite || 0;
  }
  if (ef === null || ef === 0) return;

  var pct = Math.round((gastoAtual / ef) * 100);

  // Delay pequeno para não sobrepor o toast de "Despesa registrada!"
  if (pct >= 100) {
    setTimeout(function() {
      if (window.budShowToast) window.budShowToast('🚨 Limite de ' + categoria + ' estourado! (' + pct + '% utilizado)', 'error');
    }, 1500);
  } else if (pct >= 80) {
    setTimeout(function() {
      if (window.budShowToast) window.budShowToast('⚠️ ' + categoria + ' atingiu ' + pct + '% do limite!', 'warning');
    }, 1500);
  }
}

function atualizarDividasAtraso() {
  var sec    = document.getElementById('secDividasAtraso');
  var lista  = document.getElementById('listaDividasAtraso');
  var ctador = document.getElementById('dividasAtrasoContador');
  if (!sec || !lista) return;

  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  // Calcular parcelas em atraso por dívida
  var comAtraso = dividasGlobaisDash
    .map(function(d) {
      if (!d.vencimento || !d.parcelas) return null;
      var base = new Date(d.vencimento + 'T12:00:00');
      var pagas = d.parcelasPagas || 0;
      var total = d.parcelas || 0;
      var atrasadas = 0;
      for (var i = pagas; i < total; i++) {
        var dataParc = addMonthsDash(base, i);
        dataParc.setHours(0, 0, 0, 0);
        if (dataParc < hoje) atrasadas++;
        else break;
      }
      if (atrasadas === 0) return null;
      // Próxima venc (primeira não paga)
      var proxVenc = addMonthsDash(base, pagas);
      return { d: d, atrasadas: atrasadas, proxVenc: proxVenc };
    })
    .filter(Boolean);

  if (comAtraso.length === 0) {
    sec.style.display = 'none';
    atualizarTudoEmDia();
    return;
  }

  sec.style.display = '';
  if (ctador) ctador.textContent = comAtraso.length + ' dívida' + (comAtraso.length > 1 ? 's' : '') + ' em atraso';

  lista.innerHTML = '';

  // Mostrar no máximo 3 cards
  var exibir = comAtraso.slice(0, 3);
  exibir.forEach(function(item) {
    var d = item.d;
    var el = document.createElement('div');
    el.style.cssText = 'background:rgba(254,242,242,0.7);border:1.5px solid rgba(252,165,165,0.5);border-radius:0.875rem;padding:0.75rem 1rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';

    var diasAtraso = Math.round((hoje - item.proxVenc) / 86400000);
    var valorParc  = d.valorParcela ? d.valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
    var plural = item.atrasadas > 1 ? 's' : '';

    var info = document.createElement('div');
    info.style.cssText = 'display:flex;align-items:center;gap:0.625rem;min-width:0;flex:1;';
    info.innerHTML = '<span style="font-size:1.25rem;flex-shrink:0;">🔴</span>'
      + '<div style="min-width:0;">'
      + '<div style="font-size:0.875rem;font-weight:700;color:#dc2626;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (d.nome && d.nome.trim() ? d.nome : 'Dívida sem título').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
      + '<div style="font-size:0.75rem;font-weight:600;color:#9f1239;">' + item.atrasadas + ' parcela' + plural + ' em atraso · ' + valorParc + ' · ' + diasAtraso + 'd</div>'
      + '</div>';

    var btn = document.createElement('a');
    btn.href = 'dividas.html';
    btn.style.cssText = 'flex-shrink:0;padding:0.375rem 0.75rem;border:none;border-radius:0.625rem;background:#dc2626;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;white-space:nowrap;';
    btn.textContent = 'Ver';

    el.appendChild(info);
    el.appendChild(btn);
    lista.appendChild(el);
  });

  // Se há mais de 3, mostrar rodapé "e mais N..."
  if (comAtraso.length > 3) {
    var mais = document.createElement('div');
    mais.style.cssText = 'text-align:center;font-size:0.75rem;font-weight:600;color:#dc2626;padding-top:0.25rem;';
    mais.textContent = '+ mais ' + (comAtraso.length - 3) + ' dívida' + (comAtraso.length - 3 > 1 ? 's' : '') + ' em atraso';
    lista.appendChild(mais);
  }
  atualizarTudoEmDia();
}

// ─── Mini Widget Carteira ────────────────────────────────────────────────
function atualizarWidgetCarteira() {
  var sec   = document.getElementById('secCarteiraWidget');
  var lista = document.getElementById('listaCarteiraWidget');
  var total = document.getElementById('carteiraWidgetTotal');
  if (!sec || !lista) return;

  // Apenas contas (excluir cartões de crédito)
  var contas = carteiraGlobal.filter(function (c) { return c.tipo !== 'credito'; });

  if (contas.length === 0) {
    sec.style.display = 'none';
    return;
  }

  sec.style.display = '';
  var totalSaldo = contas.reduce(function (s, c) { return s + (parseFloat(c.saldo) || 0); }, 0);
  if (total) total.textContent = valoresOcultos ? '•••' : formatarValor(totalSaldo);

  lista.innerHTML = '';
  contas.slice(0, 3).forEach(function (c) {
    var el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:var(--sidebar-link-hover-bg);border-radius:0.75rem;margin-bottom:0.375rem;';
    var cor = (parseFloat(c.saldo) || 0) >= 0 ? '#16a34a' : '#dc2626';
    var nomeEsc = (c.nome || 'Conta').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var icone = c.icone || (c.tipo === 'poupanca' ? '🏦' : c.tipo === 'investimento' ? '📈' : '💳');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:0.5rem;">'
      + '<span style="font-size:1rem;">' + icone + '</span>'
      + '<span style="font-size:0.8125rem;font-weight:600;color:var(--card-text);">' + nomeEsc + '</span>'
      + '</div>'
      + '<span style="font-size:0.875rem;font-weight:700;color:' + cor + ';">' + (valoresOcultos ? '•••' : formatarValor(parseFloat(c.saldo) || 0)) + '</span>';
    lista.appendChild(el);
  });

  if (contas.length > 3) {
    var mais = document.createElement('div');
    mais.style.cssText = 'text-align:center;font-size:0.75rem;font-weight:600;color:#94a3b8;padding-top:0.25rem;';
    mais.textContent = '+ ' + (contas.length - 3) + ' conta' + (contas.length - 3 > 1 ? 's' : '') + ' na carteira';
    lista.appendChild(mais);
  }
}

// ─── Lembretes 7 dias ─────────────────────────────────────────────────────
function atualizarLembretes7Dias() {
  var sec   = document.getElementById('secLembretes7Dias');
  var lista = document.getElementById('listaLembretes7Dias');
  if (!sec || !lista) return;

  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var em7  = new Date(hoje); em7.setDate(em7.getDate() + 7);

  var lembretes = [];

  // Recorrentes com diaVencimento nos próximos 7 dias
  recorrentesGlobaisDash.forEach(function (r) {
    if (r.ativo === false) return;
    var dia = parseInt(r.diaVencimento, 10);
    if (!dia) return;

    for (var offset = 0; offset <= 1; offset++) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, dia);
      if (d < hoje || d > em7) continue;
      // Verificar se já tem transação para este recorrente neste mês
      var mesVenc = d.getMonth();
      var anoVenc = d.getFullYear();
      var jaLancado = transacoesGlobais.some(function (t) {
        if (!t.recorrenteId || t.recorrenteId !== r.id) return false;
        var dt = t.data && t.data.toDate ? t.data.toDate() : new Date(t.data || 0);
        return dt.getMonth() === mesVenc && dt.getFullYear() === anoVenc;
      });
      if (!jaLancado) {
        lembretes.push({
          tipo: 'recorrente', nome: r.nome || r.descricao || 'Recorrente',
          valor: r.valor, dataVenc: d,
          diffDias: Math.round((d - hoje) / 86400000),
          tipoTrans: r.tipo || 'despesa',
          recorrenteId: r.id,
          categoria: r.categoria || 'Outros',
          formaPagamento: r.formaPagamento || 'Débito'
        });
      }
    }
  });

  // Dívidas com próxima parcela nos próximos 7 dias
  dividasGlobaisDash.forEach(function (d) {
    if (!d.vencimento || !d.parcelas) return;
    var pagas = d.parcelasPagas || 0;
    if (pagas >= d.parcelas) return;
    var base = new Date(d.vencimento + 'T12:00:00');
    var proxVenc = addMonthsDash(base, pagas);
    proxVenc.setHours(0, 0, 0, 0);
    if (proxVenc >= hoje && proxVenc <= em7) {
      lembretes.push({
        tipo: 'divida', nome: d.nome || 'Dívida',
        valor: d.valorParcela, dataVenc: proxVenc,
        diffDias: Math.round((proxVenc - hoje) / 86400000),
        tipoTrans: 'despesa',
        dividaId: d.id,
        categoria: 'Dívidas',
        formaPagamento: 'Débito'
      });
    }
  });

  lembretes.sort(function (a, b) { return a.dataVenc - b.dataVenc; });

  if (lembretes.length === 0) {
    sec.style.display = 'none';
    lista.innerHTML = '';
    atualizarTudoEmDia();
    return;
  }

  sec.style.display = '';
  lista.innerHTML = '';

  lembretes.slice(0, 5).forEach(function (l) {
    var el = document.createElement('div');
    var urgente = l.diffDias <= 1;
    var bgCol  = urgente ? 'rgba(255,251,235,0.8)' : 'var(--sidebar-link-hover-bg)';
    var brdCol = urgente ? '1.5px solid rgba(253,211,77,0.5)' : '1px solid var(--card-border)';
    var textCor = urgente ? '#d97706' : 'var(--card-text)';
    el.style.cssText = 'background:' + bgCol + ';border:' + brdCol + ';border-radius:0.875rem;padding:0.625rem 0.875rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';
    var dataFmt = l.diffDias === 0 ? 'Hoje' : l.diffDias === 1 ? 'Amanhã' : 'Em ' + l.diffDias + 'd';
    var icone = l.tipo === 'divida' ? '💸' : (l.tipoTrans === 'receita' ? '📥' : '📅');
    var nomeEsc = l.nome.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var valorFmt = l.valor ? formatarValor(l.valor) : '';
    // Pill de urgência: vermelho hoje, laranja amanhã, cinza resto
    var pillBg  = l.diffDias === 0 ? '#dc2626' : l.diffDias === 1 ? '#d97706' : '#64748b';
    var pillTxt = l.diffDias === 0 ? 'Hoje' : l.diffDias === 1 ? 'Amanhã' : 'Em ' + l.diffDias + 'd';
    el.innerHTML = '<div style="display:flex;align-items:center;gap:0.625rem;min-width:0;flex:1;">'
      + '<span style="font-size:1.125rem;flex-shrink:0;">' + icone + '</span>'
      + '<div style="min-width:0;">'
      + '<div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + nomeEsc + '</div>'
      + '<div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;">' + (l.tipo === 'divida' ? 'Parcela de dívida' : (l.tipoTrans === 'receita' ? 'Receita recorrente' : 'Despesa recorrente')) + '</div>'
      + '</div></div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0;">'
      + (valorFmt ? '<div style="font-size:0.8125rem;font-weight:700;color:' + (l.tipoTrans === 'receita' ? '#16a34a' : '#dc2626') + ';">' + (valoresOcultos ? '•••' : (l.tipoTrans === 'receita' ? '+' : '-') + formatarValor(l.valor)) + '</div>' : '')
      + '<div style="display:flex;align-items:center;gap:0.375rem;">'
      + '<span style="font-size:0.6875rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:9999px;background:' + pillBg + ';color:#fff;">' + pillTxt + '</span>'
      + '<button class="pmg-btn" data-idx="' + (lista.children.length) + '" style="font-size:0.6875rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:9999px;background:#16a34a;color:#fff;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;">Pago ✓</button>'
      + '</div>'
      + '</div>';
    // Guardar referência do lembrete no elemento para o click
    el._lembrete = l;
    lista.appendChild(el);
  });

  if (lembretes.length > 5) {
    var mais = document.createElement('div');
    mais.style.cssText = 'text-align:center;font-size:0.75rem;font-weight:600;color:#94a3b8;padding-top:0.25rem;';
    mais.textContent = '+ mais ' + (lembretes.length - 5) + ' lembrete' + (lembretes.length - 5 > 1 ? 's' : '');
    lista.appendChild(mais);
  }

  // Delegar click nos botões Pago ✓
  lista.addEventListener('click', function (e) {
    var btn = e.target.closest('.pmg-btn');
    if (!btn) return;
    var item = btn.parentElement;
    while (item && !item._lembrete) item = item.parentElement;
    if (!item || !item._lembrete) return;
    marcarLembretePago(item._lembrete);
  });

  atualizarTudoEmDia();
}

// ─── Marcar lembrete como pago ────────────────────────────────────────────
function marcarLembretePago(lembrete) {
  var existente = document.getElementById('overlayMarcarPago');
  if (existente) existente.remove();

  var contas = carteiraGlobal.filter(function (c) { return c.tipo !== 'credito'; });

  var overlay = document.createElement('div');
  overlay.id = 'overlayMarcarPago';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:80;display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.style.cssText = 'background:var(--card-bg);border:1px solid var(--card-border);border-radius:1.25rem;padding:1.5rem;max-width:360px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);';

  var icone = lembrete.tipo === 'divida' ? '💸' : (lembrete.tipoTrans === 'receita' ? '📥' : '✅');
  var nomeEsc = lembrete.nome.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var valorNum = parseFloat(lembrete.valor) || 0;
  var valorFmtOv = valoresOcultos ? '•••••' : formatarValor(valorNum);
  var corValor = lembrete.tipoTrans === 'receita' ? '#16a34a' : '#dc2626';
  var prefixo = lembrete.tipoTrans === 'receita' ? '+' : '-';
  var subtituloTipo = lembrete.tipo === 'divida' ? 'Parcela de dívida' : (lembrete.tipoTrans === 'receita' ? 'Receita recorrente' : 'Despesa recorrente');

  var optionsHtml = '<option value="">Nenhuma (sem conta vinculada)</option>';
  contas.forEach(function (c) {
    var nomeC = (c.nome || c.banco || 'Conta').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    optionsHtml += '<option value="' + c.id + '">' + nomeC + '</option>';
  });

  card.innerHTML = ''
    + '<div style="font-size:1rem;font-weight:800;color:var(--card-text);margin-bottom:0.2rem;">' + icone + ' ' + nomeEsc + '</div>'
    + '<div style="font-size:0.75rem;font-weight:600;color:#94a3b8;margin-bottom:0.625rem;">' + subtituloTipo + '</div>'
    + '<div style="font-size:1.375rem;font-weight:800;color:' + corValor + ';margin-bottom:1.25rem;">' + prefixo + valorFmtOv + '</div>'
    + '<div style="margin-bottom:1.125rem;">'
    + '<div style="font-size:0.6875rem;font-weight:700;color:var(--card-text-sec);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.375rem;">Conta debitada</div>'
    + '<select id="pmgContaSel" style="width:100%;padding:0.5rem 0.75rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);font-size:0.875rem;font-weight:600;color:var(--card-text);font-family:inherit;">' + optionsHtml + '</select>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;">'
    + '<button id="pmgBtnCancelar" style="padding:0.625rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;color:var(--card-text-sec);">Cancelar</button>'
    + '<button id="pmgBtnConfirmar" style="padding:0.625rem;border:none;border-radius:0.75rem;background:#16a34a;color:#fff;font-size:0.875rem;font-weight:800;cursor:pointer;font-family:inherit;">Confirmar ✓</button>'
    + '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('pmgBtnCancelar').addEventListener('click', function () { overlay.remove(); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  setTimeout(function () { var c = document.getElementById('pmgBtnCancelar'); if (c) c.focus(); }, 60);

  document.getElementById('pmgBtnConfirmar').addEventListener('click', async function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Salvando…';

    var contaId   = document.getElementById('pmgContaSel').value || null;
    var contaNome = null;
    if (contaId) {
      var contaObj = carteiraGlobal.find(function (c) { return c.id === contaId; });
      if (contaObj) contaNome = contaObj.nome || contaObj.banco || null;
    }

    try {
      var hoje2 = new Date();
      hoje2.setHours(12, 0, 0, 0);
      var mes2    = hoje2.getMonth() + 1;
      var mesRef2 = hoje2.getFullYear() + '-' + String(mes2).padStart(2, '0');
      var dataRef2 = mesRef2 + '-' + String(hoje2.getDate()).padStart(2, '0');

      var nomeDesc = window.budSanitize ? window.budSanitize(lembrete.nome) : lembrete.nome;

      var tx = {
        tipo:           lembrete.tipoTrans || 'despesa',
        descricao:      nomeDesc,
        valor:          valorNum,
        categoria:      lembrete.categoria || (lembrete.tipo === 'divida' ? 'Dívidas' : 'Outros'),
        data:           Timestamp.fromDate(hoje2),
        dataReferencia: dataRef2,
        mesReferencia:  mesRef2,
        formaPagamento: lembrete.formaPagamento || 'Débito',
        origem:         'recorrente',
        recorrente:     true,
        dataCriacao:    serverTimestamp()
      };
      if (lembrete.recorrenteId) tx.recorrenteId = lembrete.recorrenteId;
      if (lembrete.dividaId)     tx.dividaId     = lembrete.dividaId;
      if (contaId)   tx.contaId   = contaId;
      if (contaNome) tx.contaNome = contaNome;

      await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), tx);

      // Se dívida: incrementar parcelasPagas no documento da dívida
      if (lembrete.dividaId) {
        var divObj = dividasGlobaisDash.find(function (d) { return d.id === lembrete.dividaId; });
        var pagas = (divObj ? (divObj.parcelasPagas || 0) : 0) + 1;
        await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'dividas', lembrete.dividaId), { parcelasPagas: pagas });
      }

      overlay.remove();
      if (window.budShowToast) window.budShowToast('Pagamento registrado!', 'success');
    } catch (_err) {
      btn.disabled = false;
      btn.textContent = 'Confirmar ✓';
      if (window.budShowToast) window.budShowToast('Erro ao registrar. Tente novamente.', 'error');
    }
  });
}

// ─── Modal: Confirmar Receitas Pendentes ─────────────────────────────────
function abrirModalConfirmarPendentes(pendentes) {
  var modal   = document.getElementById('modalConfirmarPendentes');
  var lista   = document.getElementById('confirmarPendentesLista');
  var btnTodas = document.getElementById('btnConfirmarTodasReceitas');
  if (!modal || !lista) return;

  // Repopula a lista a cada abertura
  lista.innerHTML = '';

  function confirmarUma(txId, btnEl, itemEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Salvando…';
    updateDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', txId), { confirmado: true })
      .then(function () {
        itemEl.style.opacity = '0.4';
        itemEl.style.pointerEvents = 'none';
        btnEl.textContent = 'Confirmado ✓';
        btnEl.style.background = '#15803d';
        if (window.budShowToast) window.budShowToast('Receita confirmada! ✓', 'success');
      })
      .catch(function () {
        btnEl.disabled = false;
        btnEl.textContent = 'Confirmar ✓';
        if (window.budShowToast) window.budShowToast('Erro ao confirmar. Tente novamente.', 'error');
      });
  }

  pendentes.forEach(function (t) {
    var descEsc = (t.descricao || 'Receita').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var dataStr = '';
    if (t.data) {
      var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
      dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
    var valorFmt = valoresOcultos ? '•••' : formatarValor(t.valor || 0);
    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:var(--sidebar-user-bg);border:1px solid var(--card-border);border-radius:0.875rem;';
    item.innerHTML = ''
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:0.875rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + descEsc + '</div>'
      + '<div style="font-size:0.75rem;color:var(--card-text-sec);">' + dataStr + ' · <span style="color:#16a34a;font-weight:700;">' + valorFmt + '</span></div>'
      + '</div>'
      + '<button class="cpr-btn" style="flex-shrink:0;padding:0.375rem 0.75rem;border:none;border-radius:0.625rem;background:#16a34a;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Confirmar ✓</button>';
    var btn = item.querySelector('.cpr-btn');
    (function (txId, btnEl, itemEl) {
      btnEl.addEventListener('click', function () { confirmarUma(txId, btnEl, itemEl); });
    })(t.id, btn, item);
    lista.appendChild(item);
  });

  // Fechar (bind único)
  var btnFechar = document.getElementById('btnFecharConfirmarPendentes');
  if (btnFechar && !btnFechar._cpBound) {
    btnFechar._cpBound = true;
    btnFechar.addEventListener('click', function () { modal.classList.remove('open'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });
  }

  // Confirmar todas (bind único; handler lê o DOM vivo na hora do clique)
  if (btnTodas && !btnTodas._cpBound) {
    btnTodas._cpBound = true;
    btnTodas.addEventListener('click', function () {
      var qtd = lista.querySelectorAll('.cpr-btn:not([disabled])').length;
      lista.querySelectorAll('.cpr-btn:not([disabled])').forEach(function (b) { b.click(); });
      if (qtd > 0 && window.budShowToast) window.budShowToast('Todas as receitas confirmadas!', 'success');
      setTimeout(function () { modal.classList.remove('open'); }, 800);
    });
  }

  modal.classList.add('open');
  setTimeout(function () {
    var bf = document.getElementById('btnFecharConfirmarPendentes');
    if (bf) bf.focus();
  }, 60);
}

// ─── Auto-processar recorrentes (1x/dia, background silencioso) ───────────
var _dashCurrentUser = null;
async function _autoProcessarRecorrentesHoje() {
  if (!_dashCurrentUser) return;
  var chave = 'bud_cron_' + new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(chave)) return; // já rodou hoje neste browser
  try {
    var token = await _dashCurrentUser.getIdToken(false);
    var backendUrl = window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com';
    var resp = await fetch(backendUrl + '/api/processar-recorrentes', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    if (resp.ok) {
      localStorage.setItem(chave, '1');
      // Limpar chaves antigas (> 3 dias)
      Object.keys(localStorage)
        .filter(function (k) { return k.startsWith('bud_cron_') && k < 'bud_cron_' + new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10); })
        .forEach(function (k) { localStorage.removeItem(k); });
    }
  } catch (_e) { /* silencioso */ }
}

// ─── Tudo em dia ──────────────────────────────────────────────────────────
function atualizarTudoEmDia() {
  var secAtraso = document.getElementById('secDividasAtraso');
  var secLemb   = document.getElementById('secLembretes7Dias');
  var secTudo   = document.getElementById('secTudoEmDia');
  if (!secTudo) return;
  var temAtraso = secAtraso && secAtraso.style.display !== 'none';
  var temLemb   = secLemb  && secLemb.style.display  !== 'none';
  secTudo.style.display = (!temAtraso && !temLemb) ? '' : 'none';
}

// ─── Comparativo vs Mês Anterior ─────────────────────────────────────────
function atualizarComparativoMesAnterior() {
  var el   = document.getElementById('secComparativo');
  var body = document.getElementById('comparativoBody');
  if (!el || !body) return;

  var mesPrev = mesVisualizado - 1;
  var anoPrev = anoVisualizado;
  if (mesPrev < 0) { mesPrev = 11; anoPrev--; }

  var transAtual = transacoesGlobais.filter(function (t) {
    if (!t.data) return false;
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    return d.getMonth() === mesVisualizado && d.getFullYear() === anoVisualizado;
  });
  var transAnterior = transacoesGlobais.filter(function (t) {
    if (!t.data) return false;
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    return d.getMonth() === mesPrev && d.getFullYear() === anoPrev;
  });

  var recAtual = 0, despAtual = 0, recAnterior = 0, despAnterior = 0;
  transAtual.forEach(function (t) {
    if (t.tipo === 'receita' && t.confirmado !== false) recAtual += (t.valor || 0);
    else if (t.tipo === 'despesa' && t.pago !== false && !(Boolean(t.cartaoId) && !t.pagamentoFatura)) despAtual += (t.valor || 0);
  });
  transAnterior.forEach(function (t) {
    if (t.tipo === 'receita' && t.confirmado !== false) recAnterior += (t.valor || 0);
    else if (t.tipo === 'despesa' && t.pago !== false && !(Boolean(t.cartaoId) && !t.pagamentoFatura)) despAnterior += (t.valor || 0);
  });

  if (recAnterior === 0 && despAnterior === 0) { el.style.display = 'none'; return; }

  el.style.display = '';

  var mesAnteriorLabel = (function () {
    var d = new Date(anoPrev, mesPrev, 1);
    var s = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  function varBadge(atual, anterior) {
    if (anterior === 0) return '';
    var v   = (atual - anterior) / anterior * 100;
    var pos = v >= 0;
    var cor = pos ? '#16a34a' : '#dc2626';
    var bg  = pos ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)';
    return '<span style="font-size:0.6875rem;font-weight:700;padding:0.1rem 0.375rem;border-radius:9999px;background:' + bg + ';color:' + cor + ';">' + (pos ? '▲' : '▼') + ' ' + Math.abs(v).toFixed(1) + '%</span>';
  }

  var saldoAtual    = recAtual - despAtual;
  var saldoAnterior = recAnterior - despAnterior;

  var items = [
    { label: 'Receitas', atual: recAtual,    anterior: recAnterior,    corAtual: '#16a34a' },
    { label: 'Despesas', atual: despAtual,   anterior: despAnterior,   corAtual: '#dc2626' },
    { label: 'Saldo',    atual: saldoAtual,  anterior: saldoAnterior,  corAtual: saldoAtual >= 0 ? '#16a34a' : '#dc2626' }
  ];

  body.innerHTML = items.map(function (item) {
    return '<div class="comp-item">' +
      '<div style="font-size:0.6875rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.375rem;">' + item.label + '</div>' +
      '<div style="font-size:0.9375rem;font-weight:800;color:' + item.corAtual + ';margin-bottom:0.2rem;">' + (valoresOcultos ? '•••' : formatarValor(item.atual)) + '</div>' +
      '<div style="font-size:0.6875rem;color:#94a3b8;margin-bottom:0.25rem;">' + (valoresOcultos ? '•••' : formatarValor(item.anterior)) + ' ' + mesAnteriorLabel + '</div>' +
      (valoresOcultos ? '' : varBadge(item.atual, item.anterior)) +
      '</div>';
  }).join('');
}

// ─── Widget Metas em Andamento ────────────────────────────────────────────
function atualizarWidgetMetaProxima() {
  var el   = document.getElementById('secMetaProxima');
  var body = document.getElementById('metaProximaBody');
  if (!el || !body) return;

  var metas = metasGlobaisDash.filter(function (m) {
    var pct = m.valorAlvo > 0 ? (m.valorAtual || 0) / m.valorAlvo : 0;
    return pct < 1;
  });

  if (metas.length === 0) { el.style.display = 'none'; return; }

  metas.sort(function (a, b) {
    var pa = a.valorAlvo > 0 ? (a.valorAtual || 0) / a.valorAlvo : 0;
    var pb = b.valorAlvo > 0 ? (b.valorAtual || 0) / b.valorAlvo : 0;
    return pb - pa;
  });

  el.style.display = '';

  var VISIVEIS = Math.min(3, metas.length);
  var itens = '';
  for (var i = 0; i < VISIVEIS; i++) {
    var m   = metas[i];
    var pct = m.valorAlvo > 0 ? Math.min(100, Math.round(((m.valorAtual || 0) / m.valorAlvo) * 100)) : 0;
    var cor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#3b82f6';
    var nomeEsc = (m.nome || 'Meta').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var falta = Math.max(0, (m.valorAlvo || 0) - (m.valorAtual || 0));
    itens +=
      '<div style="' + (i > 0 ? 'margin-top:0.875rem;padding-top:0.875rem;border-top:1px solid var(--card-border);' : '') + '">' +
        '<div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:0.375rem;">' +
          '<span style="font-size:1.25rem;flex-shrink:0;">' + (m.emoji || '🎯') + '</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:0.875rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + nomeEsc + '</div>' +
            '<div style="font-size:0.7rem;color:#94a3b8;">' + (valoresOcultos ? '•••' : formatarValor(m.valorAtual || 0)) + ' de ' + (valoresOcultos ? '•••' : formatarValor(m.valorAlvo || 0)) + '</div>' +
          '</div>' +
          '<div style="font-size:1rem;font-weight:800;color:' + cor + ';flex-shrink:0;">' + pct + '%</div>' +
        '</div>' +
        '<div style="height:6px;background:var(--card-border);border-radius:999px;overflow:hidden;">' +
          '<div style="height:100%;border-radius:999px;background:' + cor + ';width:' + pct + '%;transition:width .6s ease;"></div>' +
        '</div>' +
        (i === 0 && falta > 0 && !valoresOcultos
          ? '<div style="font-size:0.75rem;color:#94a3b8;margin-top:0.25rem;">Faltam <span style="font-weight:700;color:var(--card-text);">' + formatarValor(falta) + '</span></div>'
          : '') +
      '</div>';
  }

  var rodape = '';
  if (metas.length > VISIVEIS) {
    var extras = metas.length - VISIVEIS;
    rodape = '<div style="font-size:0.75rem;color:#94a3b8;text-align:center;margin-top:0.75rem;">+ ' + extras + ' outra' + (extras > 1 ? 's' : '') + ' meta' + (extras > 1 ? 's' : '') + ' em andamento</div>';
  }

  body.innerHTML = itens + rodape;
}

// ─── Widget Investimentos ─────────────────────────────────────────────────
function atualizarWidgetInvestimentos() {
  var el   = document.getElementById('secInvestimentosWidget');
  var body = document.getElementById('investimentosWidgetBody');
  if (!el || !body) return;

  if (investimentosGlobaisDash.length === 0) { el.style.display = 'none'; return; }

  var totalInvestido = investimentosGlobaisDash.reduce(function (s, i) { return s + (parseFloat(i.valorInvestido) || 0); }, 0);
  var totalAtual     = investimentosGlobaisDash.reduce(function (s, i) { return s + (parseFloat(i.valorAtual) || parseFloat(i.valorInvestido) || 0); }, 0);
  var rendimento  = totalAtual - totalInvestido;
  var rendPct     = totalInvestido > 0 ? (rendimento / totalInvestido * 100) : 0;
  var corRend     = rendimento >= 0 ? '#16a34a' : '#dc2626';

  var porTipo = {};
  investimentosGlobaisDash.forEach(function (i) {
    var tipo = i.tipo || 'Outro';
    porTipo[tipo] = (porTipo[tipo] || 0) + (parseFloat(i.valorAtual) || parseFloat(i.valorInvestido) || 0);
  });
  var tiposOrd = Object.keys(porTipo).sort(function (a, b) { return porTipo[b] - porTipo[a]; }).slice(0, 3);
  var outrosTipos = Object.keys(porTipo).length - tiposOrd.length;

  el.style.display = '';
  body.innerHTML =
    '<div class="inv-widget-grid">' +
      '<div style="background:var(--sidebar-link-hover-bg);border-radius:0.875rem;padding:0.75rem;">' +
        '<div style="font-size:0.6875rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Total Atual</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--card-text);">' + (valoresOcultos ? '•••' : formatarValor(totalAtual)) + '</div>' +
      '</div>' +
      '<div style="background:var(--sidebar-link-hover-bg);border-radius:0.875rem;padding:0.75rem;">' +
        '<div style="font-size:0.6875rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Rendimento</div>' +
        '<div style="font-size:1rem;font-weight:800;color:' + corRend + ';">' + (valoresOcultos ? '•••' : (rendimento >= 0 ? '+' : '') + formatarValor(rendimento)) + '</div>' +
        (valoresOcultos ? '' : '<div style="font-size:0.6875rem;font-weight:600;color:' + corRend + ';">' + (rendimento >= 0 ? '+' : '') + rendPct.toFixed(1) + '%</div>') +
      '</div>' +
    '</div>' +
    tiposOrd.map(function (tipo) {
      var v   = porTipo[tipo];
      var pct = totalAtual > 0 ? Math.round((v / totalAtual) * 100) : 0;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:var(--sidebar-link-hover-bg);border-radius:0.75rem;margin-bottom:0.375rem;">' +
        '<div style="font-size:0.8125rem;font-weight:600;color:var(--card-text);">' + tipo.replace(/</g,'&lt;') + '</div>' +
        '<div style="display:flex;align-items:center;gap:0.5rem;">' +
          '<div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);">' + (valoresOcultos ? '•••' : formatarValor(v)) + '</div>' +
          '<div style="font-size:0.6875rem;color:#94a3b8;font-weight:600;">' + pct + '%</div>' +
        '</div>' +
        '</div>';
    }).join('') +
    (outrosTipos > 0 ? '<div style="text-align:center;font-size:0.75rem;color:#94a3b8;font-weight:600;margin-top:0.25rem;">+ ' + outrosTipos + ' tipo(s) de investimento</div>' : '');
}

// ─── Economia Potencial ───────────────────────────────────────────────────
function atualizarEconomiaPotencial(transacoesDoMes) {
  var sec    = document.getElementById('secEconomiaPotencial');
  var body   = document.getElementById('economiaPotencialBody');
  var totalEl = document.getElementById('economiaPotencialTotal');
  if (!sec || !body) return;

  var despesas = transacoesDoMes.filter(function (t) { return t.tipo === 'despesa' && !t.cartaoId; });
  if (despesas.length === 0) { sec.style.display = 'none'; return; }

  var porCat = {};
  despesas.forEach(function (t) {
    var cat = t.categoria || 'Outros';
    porCat[cat] = (porCat[cat] || 0) + (t.valor || 0);
  });

  var sorted = Object.keys(porCat).map(function (k) { return [k, porCat[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; });

  if (sorted.length === 0) { sec.style.display = 'none'; return; }

  var top2 = sorted.slice(0, 2);
  var totalPot = top2.reduce(function (s, c) { return s + c[1] * 0.15; }, 0);

  sec.style.display = '';
  if (totalEl) totalEl.textContent = valoresOcultos ? '•••' : formatarValor(totalPot);

  var html = '';
  top2.forEach(function (item) {
    var nomeCat = item[0].replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var economia = item[1] * 0.15;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.875rem;background:var(--sidebar-link-hover-bg);border-radius:0.75rem;margin-bottom:0.375rem;">'
      + '<div>'
      + '<div style="font-size:0.8125rem;font-weight:700;color:var(--card-text);">' + nomeCat + '</div>'
      + '<div style="font-size:0.6875rem;color:#94a3b8;margin-top:0.1rem;">Reduzir 15% → econom. ' + (valoresOcultos ? '•••' : formatarValor(economia)) + '</div>'
      + '</div>'
      + '<div style="font-size:0.75rem;font-weight:700;color:#dc2626;white-space:nowrap;margin-left:0.5rem;">' + (valoresOcultos ? '•••' : formatarValor(item[1])) + '</div>'
      + '</div>';
  });
  body.innerHTML = html;
}

// ─── Saúde Financeira Preview ─────────────────────────────────────────────
function atualizarSaudeFinanceira(transacoesDoMes, entradas, saidas) {
  var scoreEl = document.getElementById('saudeScore');
  var labelEl = document.getElementById('saudeLabel');
  var descEl  = document.getElementById('saudeDesc');
  var arcEl   = document.getElementById('saudeArc');
  if (!scoreEl) return;

  // Sem transações no mês: ocultar seção (evita score 0 enganoso para usuário novo)
  var sec = document.getElementById('secSaudeFinanceira');
  if (transacoesDoMes.length === 0) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';

  var score = 0;

  // Saldo positivo (+30)
  if (entradas > 0 && entradas > saidas) score += 30;
  else if (entradas === 0 && saidas === 0) score += 0;
  else if (entradas > 0) score += 5;

  // Ratio despesas/receita (+25)
  if (entradas > 0) {
    var ratio = saidas / entradas;
    if (ratio <= 0.5)      score += 25;
    else if (ratio <= 0.7) score += 20;
    else if (ratio <= 0.9) score += 10;
  }

  // Tem transações este mês (+15)
  if (transacoesDoMes.length > 0) score += 15;

  // Sem dívidas em atraso (+15)
  var hoje2 = new Date(); hoje2.setHours(0, 0, 0, 0);
  var temAtraso = dividasGlobaisDash.some(function (d) {
    if (!d.vencimento || !d.parcelas) return false;
    var pagas = d.parcelasPagas || 0;
    if (pagas >= d.parcelas) return false;
    var base = new Date(d.vencimento + 'T12:00:00');
    var pv = addMonthsDash(base, pagas); pv.setHours(0, 0, 0, 0);
    return pv < hoje2;
  });
  if (!temAtraso) score += 15;

  // Tem limites definidos (+15)
  if (limitesGlobaisDash.length > 0) score += 15;

  score = Math.min(100, score);

  var label, cor;
  if (score >= 80)      { label = 'Excelente 🎉'; cor = '#16a34a'; }
  else if (score >= 60) { label = 'Bom 👍';       cor = '#65a30d'; }
  else if (score >= 40) { label = 'Regular 🤔';   cor = '#d97706'; }
  else                  { label = 'Atenção ⚠️';   cor = '#dc2626'; }

  scoreEl.textContent = valoresOcultos ? '—' : score;
  if (labelEl) { labelEl.textContent = label; labelEl.style.color = cor; }
  if (descEl) {
    if (valoresOcultos) {
      descEl.textContent = 'Valores ocultos.';
    } else if (score >= 80) {
      descEl.textContent = 'Suas finanças estão sob controle! Continue assim.';
    } else if (score >= 60) {
      descEl.textContent = 'Bom progresso. Pequenos ajustes podem melhorar ainda mais.';
    } else if (score >= 40) {
      descEl.textContent = 'Há oportunidades de melhoria. Veja a análise completa.';
    } else {
      descEl.textContent = 'Atenção: revise despesas e dívidas. A análise pode ajudar.';
    }
  }

  // Arc SVG (stroke-dasharray: progresso 176 = circunferência de r=28)
  if (arcEl) {
    var circ = 2 * Math.PI * 28;
    arcEl.style.strokeDasharray = ((score / 100) * circ).toFixed(1) + ' ' + circ.toFixed(1);
    arcEl.style.stroke = cor;
  }
}

// ─── Dica Financeira Contextual ───────────────────────────────────────────
function atualizarDicaFinanceira(transacoesDoMes, entradas, saidas) {
  var el = document.getElementById('dicaDiaTexto');
  if (!el) return;

  var dica;
  var despesas = transacoesDoMes.filter(function (t) { return t.tipo === 'despesa'; });

  if (valoresOcultos) {
    dica = 'Ative a visibilidade de valores para ver dicas personalizadas.';
  } else if (transacoesDoMes.length === 0) {
    dica = 'Comece registrando suas receitas e despesas para acompanhar sua saúde financeira.';
  } else if (entradas > 0 && saidas > entradas) {
    dica = 'Suas despesas superaram as receitas este mês. Identifique onde é possível cortar para equilibrar o orçamento.';
  } else if (despesas.length > 0) {
    var porCat = {};
    despesas.forEach(function (t) {
      var cat = t.categoria || 'Outros';
      porCat[cat] = (porCat[cat] || 0) + (t.valor || 0);
    });
    var sorted = Object.keys(porCat).map(function (k) { return [k, porCat[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var topCat = sorted[0];
    var pct = saidas > 0 ? Math.round((topCat[1] / saidas) * 100) : 0;
    if (pct >= 40) {
      dica = '"' + topCat[0] + '" representa ' + pct + '% das suas despesas. Avalie se há espaço para economizar nessa categoria.';
    } else if (entradas > 0 && entradas > saidas && (entradas - saidas) >= 200) {
      dica = 'Você teve saldo positivo de ' + formatarValor(entradas - saidas) + ' este mês! Considere reforçar uma meta ou investir a diferença.';
    } else if (limitesGlobaisDash.length === 0) {
      dica = 'Defina limites de gastos por categoria para manter o orçamento sob controle. Acesse Limites no menu.';
    } else {
      dica = 'Registrar categorias corretamente em cada transação ajuda a visualizar padrões e tomar decisões melhores.';
    }
  } else {
    dica = 'Adicione suas despesas com categorias para ver dicas personalizadas sobre onde você pode economizar.';
  }

  el.textContent = dica;
}

// ─── Atividades recentes ────────────────────────────────────────────────
function renderizarAtividades(transacoesDoMes) {
  var container = document.getElementById('atividadesLista');
  if (!container) return;

  // Filtrar por tipo (Todos/Receitas/Despesas)
  var filtradas = transacoesDoMes.filter(function (t) {
    return filtroAtividadeAtual === 'todos' || t.tipo === filtroAtividadeAtual;
  });

  // Atualizar contador de transações
  var contadorEl = document.getElementById('atividadesContador');
  if (contadorEl) contadorEl.textContent = String(filtradas.length);

  var ultimas = filtradas.sort(function (a, b) {
    var da = a.dataCriacao ? (a.dataCriacao.toDate ? a.dataCriacao.toDate() : new Date(a.dataCriacao)) : new Date(0);
    var db2 = b.dataCriacao ? (b.dataCriacao.toDate ? b.dataCriacao.toDate() : new Date(b.dataCriacao)) : new Date(0);
    return db2 - da;
  }).slice(0, 5);

  if (ultimas.length === 0) {
    container.innerHTML = '';
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'dash-empty';

    var iconDiv = document.createElement('div');
    iconDiv.className = 'dash-empty-icon';
    iconDiv.textContent = '📝';
    emptyDiv.appendChild(iconDiv);

    var pEl = document.createElement('p');
    pEl.textContent = filtroAtividadeAtual === 'todos' ?
      'Nenhuma transação este mês.' :
      'Nenhuma ' + (filtroAtividadeAtual === 'receita' ? 'receita' : 'despesa') + ' neste mês.';
    emptyDiv.appendChild(pEl);

    if (filtroAtividadeAtual === 'todos') {
      var ctaDiv = document.createElement('div');
      ctaDiv.style.cssText = 'display:flex;gap:0.625rem;justify-content:center;flex-wrap:wrap;margin-top:0.625rem;';

      var btnR = document.createElement('button');
      btnR.style.cssText = 'padding:0.5rem 1.125rem;border:none;border-radius:0.75rem;background:#16a34a;color:#fff;font-size:0.8125rem;font-weight:700;cursor:pointer;font-family:inherit;';
      btnR.textContent = '+ Receita';
      btnR.addEventListener('click', function () { abrirModal('receita'); });

      var btnD = document.createElement('button');
      btnD.style.cssText = 'padding:0.5rem 1.125rem;border:none;border-radius:0.75rem;background:#dc2626;color:#fff;font-size:0.8125rem;font-weight:700;cursor:pointer;font-family:inherit;';
      btnD.textContent = '+ Despesa';
      btnD.addEventListener('click', function () { abrirModal('despesa'); });

      ctaDiv.appendChild(btnR);
      ctaDiv.appendChild(btnD);
      emptyDiv.appendChild(ctaDiv);
    }

    container.appendChild(emptyDiv);
    return;
  }

  container.innerHTML = '';
  ultimas.forEach(function (t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--card-border);cursor:pointer;transition:background .15s;border-radius:0.5rem;';
    row.addEventListener('mouseenter', function () { row.style.background = 'var(--sidebar-link-hover-bg)'; });
    row.addEventListener('mouseleave', function () { row.style.background = ''; });
    (function (tid) {
      row.addEventListener('click', function () { abrirModalEditar(tid); });
    })(t.id);

    var left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:0.75rem;';

    var icon = document.createElement('div');
    icon.style.cssText = 'width:2rem;height:2rem;border-radius:0.5rem;display:flex;align-items:center;justify-content:center;font-size:0.875rem;';
    if (t.tipo === 'receita') {
      icon.style.background = '#dcfce7';
      icon.style.color = '#16a34a';
      icon.textContent = '↑';
    } else {
      icon.style.background = '#fee2e2';
      icon.style.color = '#dc2626';
      icon.textContent = '↓';
    }

    var info = document.createElement('div');
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:0.8125rem;font-weight:600;color:var(--card-text);';
    nameEl.textContent = window.budSanitize ? window.budSanitize(t.descricao || t.categoria || 'Sem descrição') : (t.descricao || t.categoria || 'Sem descrição');

    var catEl = document.createElement('div');
    catEl.style.cssText = 'font-size:0.6875rem;font-weight:500;color:var(--card-text-sec);';
    catEl.textContent = t.categoria || '';

    info.appendChild(nameEl);
    info.appendChild(catEl);
    left.appendChild(icon);
    left.appendChild(info);

    var right = document.createElement('div');
    right.style.cssText = 'text-align:right;flex-shrink:0;';

    var valorEl = document.createElement('div');
    valorEl.style.cssText = 'font-size:0.875rem;font-weight:700;';
    valorEl.style.color = t.tipo === 'receita' ? '#16a34a' : '#dc2626';
    var prefix = t.tipo === 'receita' ? '+' : '-';
    valorEl.textContent = valoresOcultos ? '•••' : prefix + ' ' + formatarValor(t.valor || 0);

    var dataRowEl = document.createElement('div');
    dataRowEl.style.cssText = 'font-size:0.6875rem;color:var(--card-text-sec);margin-top:0.125rem;';
    if (t.data) {
      var dtRow = t.data.toDate ? t.data.toDate() : new Date(t.data);
      dataRowEl.textContent = String(dtRow.getDate()).padStart(2, '0') + '/' + String(dtRow.getMonth() + 1).padStart(2, '0');
    }

    right.appendChild(valorEl);
    right.appendChild(dataRowEl);
    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });

  // Botão "Ver Histórico Completo" se tiver mais de 5 transações no mês
  if (filtradas.length > 5) {
    var btnHist = document.createElement('button');
    btnHist.style.cssText = 'display:block;width:100%;margin-top:0.75rem;padding:0.625rem;background:none;border:1px solid var(--card-border);border-radius:0.75rem;color:var(--theme-accent);font-size:0.8125rem;font-weight:600;cursor:pointer;transition:background .15s;';
    btnHist.textContent = 'Ver Histórico Completo (' + filtradas.length + ')';
    btnHist.addEventListener('mouseenter', function () { btnHist.style.background = 'var(--sidebar-link-hover-bg)'; });
    btnHist.addEventListener('mouseleave', function () { btnHist.style.background = ''; });
    btnHist.addEventListener('click', function () { abrirHistorico(); });
    container.appendChild(btnHist);
  }
}

// ─── Banner Trial ───────────────────────────────────────────────────────
function configurarBannerPlano(userData) {
  var banner = document.getElementById('trialBanner');
  var bannerText = document.getElementById('trialBannerText');
  if (!banner || !bannerText) return;

  var plano = userData.plano || 'free';

  if (plano === 'trial') {
    var trialFim = userData.trialFim;
    if (!trialFim) { banner.classList.remove('show'); return; }

    var fimDate = trialFim.toDate ? trialFim.toDate() : new Date(trialFim);
    var agora = new Date();
    var diffMs = fimDate - agora;
    var diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias <= 0) {
      banner.style.background = 'linear-gradient(135deg, #fee2e2, #fecaca)';
      banner.style.borderColor = '#f87171';
      banner.style.color = '#991b1b';
      bannerText.textContent = 'Período de testes encerrado. Faça upgrade para continuar usando todas as funcionalidades.';
      banner.querySelector('.trial-banner-icon').textContent = '⚠️';
      banner.classList.add('show');
    } else if (diffDias <= 3) {
      bannerText.textContent = 'Seu trial termina em ' + diffDias + (diffDias === 1 ? ' dia' : ' dias') + '! Aproveite para conhecer todas as funcionalidades.';
      banner.classList.add('show');
    } else {
      bannerText.textContent = diffDias + ' dias restantes no seu período de testes.';
      banner.classList.add('show');
    }
  } else if (plano === 'free') {
    banner.style.background = 'linear-gradient(135deg, #eff6ff, #dbeafe)';
    banner.style.borderColor = '#93c5fd';
    banner.style.color = '#1e40af';
    bannerText.textContent = 'Plano gratuito ativo. Faça upgrade para desbloquear funcionalidades premium.';
    banner.querySelector('.trial-banner-icon').textContent = '💡';
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}

// ─── Modal Lançamento ────────────────────────────────────────────────────
var dpViewYear = new Date().getFullYear();
var dpViewMonth = new Date().getMonth();
var DP_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function renderCalendar() {
  var dpDays = document.getElementById('dpDays');
  var dpMonthYear = document.getElementById('dpMonthYear');
  if (!dpDays || !dpMonthYear) return;
  dpMonthYear.textContent = DP_MESES[dpViewMonth] + ' ' + dpViewYear;
  dpDays.innerHTML = '';
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var selectedVal = (document.getElementById('inputData') || {}).value || '';
  var firstDay = new Date(dpViewYear, dpViewMonth, 1).getDay();
  var daysInMonth = new Date(dpViewYear, dpViewMonth + 1, 0).getDate();
  var daysInPrevMonth = new Date(dpViewYear, dpViewMonth, 0).getDate();
  // Dias do mês anterior
  for (var i = firstDay - 1; i >= 0; i--) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dp-day dp-other-month';
    btn.textContent = daysInPrevMonth - i;
    dpDays.appendChild(btn);
  }
  // Dias do mês atual
  for (var d = 1; d <= daysInMonth; d++) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dp-day';
    btn.textContent = d;
    var dateStr = dpViewYear + '-' + String(dpViewMonth + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var dateObj = new Date(dpViewYear, dpViewMonth, d);
    if (dateObj.getTime() === hoje.getTime()) btn.classList.add('dp-today');
    if (selectedVal === dateStr) btn.classList.add('dp-selected');
    (function(ds) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); selecionarData(ds); });
    })(dateStr);
    dpDays.appendChild(btn);
  }
  // Completar última linha
  var totalCells = firstDay + daysInMonth;
  var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (var j = 1; j <= remaining; j++) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dp-day dp-other-month';
    btn.textContent = j;
    dpDays.appendChild(btn);
  }
}

function selecionarData(dateStr) {
  var hidden = document.getElementById('inputData');
  var texto = document.getElementById('datepickerTexto');
  var trigger = document.getElementById('datepickerBtn');
  if (hidden) hidden.value = dateStr;
  if (texto && dateStr) {
    var parts = dateStr.split('-');
    texto.textContent = parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  if (trigger) {
    trigger.classList.add('has-value');
    trigger.classList.remove('open', 'error');
    trigger.setAttribute('aria-expanded', 'false');
  }
  fecharDatepicker();
  renderCalendar();
}

function fecharDatepicker() {
  var dd = document.getElementById('datepickerDropdown');
  var btn = document.getElementById('datepickerBtn');
  if (dd) dd.classList.remove('open', 'open-up');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}

function preencherCategorias(tipo) {
  var dropdown = document.getElementById('categoriaDropdown');
  var hidden = document.getElementById('inputCategoria');
  var texto = document.getElementById('categoriaTexto');
  var trigger = document.getElementById('categoriaBtn');
  if (!dropdown) return;
  // Limpa seleção
  if (hidden) hidden.value = '';
  if (texto) texto.textContent = 'Selecione...';
  if (trigger) {
    trigger.classList.remove('has-value', 'open', 'error');
    trigger.setAttribute('aria-expanded', 'false');
  }
  dropdown.innerHTML = '';
  dropdown.classList.remove('open');

  // Padrão (window.BUD_CATEGORIAS_PADRAO) + personalizadas do usuário
  var padraoBruto = (window.BUD_CATEGORIAS_PADRAO && window.BUD_CATEGORIAS_PADRAO[tipo])
    ? window.BUD_CATEGORIAS_PADRAO[tipo]
    : [];
  var padraoNomes = padraoBruto.map(function (c) { return typeof c === 'object' ? c.nome : c; });
  var padraoItens = padraoBruto.map(function (c) {
    return typeof c === 'object' ? c : { nome: c, emoji: '' };
  });
  var personalizadas = (categoriasPersonalizadas[tipo] || []).map(function (c) {
    if (typeof c === 'object' && c) return { nome: c.nome, emoji: c.emoji || '🏷️' };
    return { nome: c, emoji: '🏷️' };
  }).filter(function (c) { return !padraoNomes.includes(c.nome); });
  var todas = padraoItens.concat(personalizadas);

  todas.forEach(function (cat) {
    var div = document.createElement('div');
    div.className = 'custom-select-option';
    div.textContent = (cat.emoji ? cat.emoji + ' ' : '') + cat.nome;
    div.setAttribute('role', 'option');
    div.setAttribute('data-value', cat.nome);
    div.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.querySelectorAll('.custom-select-option').forEach(function (o) { o.classList.remove('selected'); });
      div.classList.add('selected');
      if (hidden) hidden.value = cat.nome;
      if (texto) texto.textContent = (cat.emoji ? cat.emoji + ' ' : '') + cat.nome;
      if (trigger) {
        trigger.classList.add('has-value');
        trigger.classList.remove('open', 'error');
        trigger.setAttribute('aria-expanded', 'false');
      }
      dropdown.classList.remove('open');
    });
    dropdown.appendChild(div);
  });
}

function atualizarModalTipo(tipo) {
  tipoAtual = tipo;
  var btnR = document.getElementById('tipoBtnReceita');
  var btnD = document.getElementById('tipoBtnDespesa');
  var titulo = document.getElementById('modalTitulo');
  var submit = document.getElementById('btnSubmitLancamento');
  var isEdit = transacaoEditandoId !== null;

  // Atualizar visual dos botões PRIMEIRO (antes de qualquer chamada que possa falhar)
  if (btnR) { btnR.className = 'tipo-btn' + (tipo === 'receita' ? ' active-receita' : ''); }
  if (btnD) { btnD.className = 'tipo-btn' + (tipo === 'despesa' ? ' active-despesa' : ''); }
  if (titulo) {
    if (isEdit) {
      titulo.textContent = tipo === 'receita' ? 'Editar Receita' : 'Editar Despesa';
    } else {
      titulo.textContent = tipo === 'receita' ? 'Nova Receita' : 'Nova Despesa';
    }
  }
  if (submit) {
    submit.textContent = isEdit ? 'Salvar Alterações' : (tipo === 'receita' ? 'Salvar Receita' : 'Salvar Despesa');
    submit.className = 'modal-submit modal-submit-' + tipo;
  }
  try { preencherCategorias(tipo); } catch (_e) {}
  try { _preencherSelectConta(tipo); } catch (_e) {}
}

// Popula o select de conta/cartão conforme o tipo da transação
function _preencherSelectConta(tipo) {
  var dropdown = document.getElementById('contaDropdown');
  var hidden   = document.getElementById('inputConta');
  var texto    = document.getElementById('contaTexto');
  var btn      = document.getElementById('contaBtn');
  if (!dropdown) return;

  var prevId = hidden ? hidden.value : '';

  // Montar lista de opções
  var opcoes = [{ id: '', label: '— Sem vincular —', icone: '' }];
  carteiraGlobal.forEach(function (c) {
    var isCredito = c.tipo === 'credito';
    if (tipo === 'receita' && isCredito) return;
    var icone = c.icone || (isCredito ? '💳' : c.tipo === 'poupanca' ? '🏦' : c.tipo === 'investimento' ? '📈' : '🏦');
    opcoes.push({ id: c.id, label: icone + ' ' + (c.nome || c.tipo || 'Conta') + (isCredito ? ' (cartão)' : ''), icone: icone });
  });

  dropdown.innerHTML = '';
  opcoes.forEach(function (op) {
    var el = document.createElement('div');
    el.className = 'custom-select-option' + (op.id === prevId ? ' selected' : '');
    el.setAttribute('role', 'option');
    el.setAttribute('data-value', op.id);
    el.textContent = op.label || '— Sem vincular —';
    el.addEventListener('click', function () {
      if (hidden) hidden.value = op.id;
      if (texto) { texto.textContent = op.label || '— Sem vincular —'; }
      if (btn)   { btn.classList.toggle('has-value', !!op.id); }
      dropdown.querySelectorAll('.custom-select-option').forEach(function (o) {
        o.classList.toggle('selected', o.getAttribute('data-value') === op.id);
      });
      _fecharContaDropdown();
    });
    dropdown.appendChild(el);
  });

  // Restaurar seleção anterior
  var selOp = opcoes.find(function (o) { return o.id === prevId; });
  if (selOp && texto) texto.textContent = selOp.label || '— Sem vincular —';
  if (btn) btn.classList.toggle('has-value', !!prevId);

  // Montar listener de toggle (uma só vez)
  if (!btn._contaListenerAdded) {
    btn._contaListenerAdded = true;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.contains('open');
      // Fechar outros dropdowns do modal
      document.getElementById('categoriaDropdown')?.classList.remove('open');
      document.getElementById('categoriaBtn')?.classList.remove('open');
      if (isOpen) { _fecharContaDropdown(); }
      else {
        dropdown.classList.add('open');
        btn.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      if (e.key === 'Escape') _fecharContaDropdown();
    });
  }
}

function _fecharContaDropdown() {
  var dropdown = document.getElementById('contaDropdown');
  var btn      = document.getElementById('contaBtn');
  if (dropdown) dropdown.classList.remove('open');
  if (btn)      { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}

// Fechar dropdown de conta ao clicar fora
document.addEventListener('click', function (e) {
  if (!document.getElementById('contaWrapper')?.contains(e.target)) _fecharContaDropdown();
});

function aplicarMascaraValor(input) {
  var raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  var num = parseInt(raw, 10) / 100;
  input.value = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function abrirModal(tipo) {
  if (trialExpirado) {
    if (window.budShowToast) window.budShowToast('Período de testes encerrado. Faça upgrade para lançar transações.', 'error');
    return;
  }
  transacaoEditandoId = null;
  // Resetar form
  var form = document.getElementById('formLancamento');
  if (form) form.reset();
  // Resetar custom dropdown de categoria
  var catHidden = document.getElementById('inputCategoria');
  if (catHidden) catHidden.value = '';
  var catTexto = document.getElementById('categoriaTexto');
  if (catTexto) catTexto.textContent = 'Selecione...';
  var catBtn = document.getElementById('categoriaBtn');
  if (catBtn) catBtn.classList.remove('has-value', 'open', 'error');
  var catDropdown = document.getElementById('categoriaDropdown');
  if (catDropdown) catDropdown.classList.remove('open');
  // Resetar custom dropdown de conta
  var contaHidden = document.getElementById('inputConta');
  if (contaHidden) contaHidden.value = '';
  var contaTexto = document.getElementById('contaTexto');
  if (contaTexto) contaTexto.textContent = '— Sem vincular —';
  var contaBtnReset = document.getElementById('contaBtn');
  if (contaBtnReset) contaBtnReset.classList.remove('has-value', 'open');
  var contaDropdownReset = document.getElementById('contaDropdown');
  if (contaDropdownReset) contaDropdownReset.classList.remove('open');
  document.querySelectorAll('.modal-input').forEach(function (el) {
    el.classList.remove('error');
  });
  // Resetar datepicker
  var dpBtnR = document.getElementById('datepickerBtn');
  if (dpBtnR) dpBtnR.classList.remove('has-value', 'open', 'error');
  var dpTextoR = document.getElementById('datepickerTexto');
  if (dpTextoR) dpTextoR.textContent = 'Selecione uma data...';
  fecharDatepicker();
  // Data padrão = hoje
  var hj = new Date();
  selecionarData(hj.getFullYear() + '-' + String(hj.getMonth()+1).padStart(2,'0') + '-' + String(hj.getDate()).padStart(2,'0'));
  atualizarModalTipo(tipo);
  // Ocultar botão excluir no modo criação
  var btnExcluir = document.getElementById('btnExcluirTransacao');
  if (btnExcluir) btnExcluir.style.display = 'none';
  document.getElementById('modalLancamento').classList.add('open');
  setTimeout(function () {
    var desc = document.getElementById('inputDescricao');
    if (desc) desc.focus();
  }, 100);
}

function abrirModalEditar(transacaoId) {
  if (trialExpirado) {
    if (window.budShowToast) window.budShowToast('Período de testes encerrado. Faça upgrade para editar transações.', 'error');
    return;
  }
  var t = transacoesGlobais.find(function (tx) { return tx.id === transacaoId; });
  if (!t) return;

  transacaoEditandoId = transacaoId;
  var form = document.getElementById('formLancamento');
  if (form) form.reset();
  document.querySelectorAll('.modal-input').forEach(function (el) { el.classList.remove('error'); });

  // Preencher tipo
  atualizarModalTipo(t.tipo || 'despesa');

  // Preencher conta/cartão vinculado
  if (t.carteiraId) {
    var hidEd = document.getElementById('inputConta');
    if (hidEd) {
      hidEd.value = t.carteiraId;
      // Texto do trigger será atualizado pelo _preencherSelectConta chamado via atualizarModalTipo
    }
  }

  // Preencher descrição
  var inputDesc = document.getElementById('inputDescricao');
  if (inputDesc) inputDesc.value = t.descricao || '';

  // Preencher valor
  var inputValor = document.getElementById('inputValor');
  if (inputValor && t.valor) {
    inputValor.value = t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Preencher categoria no custom dropdown
  var catHidden = document.getElementById('inputCategoria');
  var catTexto = document.getElementById('categoriaTexto');
  var catBtn = document.getElementById('categoriaBtn');
  var catNomeEdit = t.categoria || '';
  // Buscar emoji da categoria (padrão + personalizadas)
  var tipoEdit = t.tipo || 'despesa';
  var catObjEdit = ((window.BUD_CATEGORIAS_PADRAO && window.BUD_CATEGORIAS_PADRAO[tipoEdit]) || [])
    .find(function (c) { return (typeof c === 'object' ? c.nome : c) === catNomeEdit; });
  if (!catObjEdit) {
    catObjEdit = (categoriasPersonalizadas[tipoEdit] || [])
      .find(function (c) { return (typeof c === 'object' ? c.nome : c) === catNomeEdit; });
  }
  var emojiEdit = catObjEdit && (typeof catObjEdit === 'object') ? catObjEdit.emoji : '';
  var catLabelEdit = emojiEdit ? emojiEdit + ' ' + catNomeEdit : (catNomeEdit || 'Selecione...');
  if (catHidden) catHidden.value = catNomeEdit;
  if (catTexto) catTexto.textContent = catLabelEdit;
  if (catBtn && catNomeEdit) catBtn.classList.add('has-value');

  // Marcar opção selecionada no dropdown
  var dropdown = document.getElementById('categoriaDropdown');
  if (dropdown) {
    dropdown.querySelectorAll('.custom-select-option').forEach(function (o) {
      o.classList.toggle('selected', o.getAttribute('data-value') === catNomeEdit);
    });
  }

  // Preencher data
  if (t.data) {
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    selecionarData(ds);
  }

  // Mostrar botão excluir no modo edição
  var btnExcluir = document.getElementById('btnExcluirTransacao');
  if (btnExcluir) btnExcluir.style.display = '';

  document.getElementById('modalLancamento').classList.add('open');
  setTimeout(function () {
    var desc = document.getElementById('inputDescricao');
    if (desc) desc.focus();
  }, 100);
}

function fecharModal() {
  transacaoEditandoId = null;
  document.getElementById('modalLancamento').classList.remove('open');
  fecharDatepicker();
}

async function handleSubmitLancamento(e) {
  e.preventDefault();
  if (!usuarioAtualId) return;

  var inputDescricao = document.getElementById('inputDescricao');
  var inputValor = document.getElementById('inputValor');
  var inputCategoria = document.getElementById('inputCategoria');
  var inputData = document.getElementById('inputData');
  var btnSubmit = document.getElementById('btnSubmitLancamento');

  // Limpa erros anteriores
  [inputDescricao, inputValor].forEach(function (el) {
    el.classList.remove('error');
  });
  var categoriaBtn = document.getElementById('categoriaBtn');
  if (categoriaBtn) categoriaBtn.classList.remove('error');
  var dpBtnClr = document.getElementById('datepickerBtn');
  if (dpBtnClr) dpBtnClr.classList.remove('error');

  // Validação
  var erros = false;
  var descricaoRaw = inputDescricao.value.trim();
  if (!descricaoRaw) { inputDescricao.classList.add('error'); erros = true; }

  var valorStr = inputValor.value.replace(/[R$\s.]/g, '').replace(',', '.');
  var valor = parseFloat(valorStr);
  if (!valor || valor <= 0) { inputValor.classList.add('error'); erros = true; }

  var categoria = inputCategoria.value;
  if (!categoria) {
    var catBtnEl = document.getElementById('categoriaBtn');
    if (catBtnEl) catBtnEl.classList.add('error');
    erros = true;
  }

  var dataStr = inputData.value;
  if (!dataStr) {
    var dpBtnErr = document.getElementById('datepickerBtn');
    if (dpBtnErr) dpBtnErr.classList.add('error');
    erros = true;
  }

  if (erros) {
    if (window.budShowToast) window.budShowToast('Preencha todos os campos.', 'error');
    return;
  }

  // Conta/cartão vinculado
  var novoCarteiraId = (document.getElementById('inputConta') && document.getElementById('inputConta').value) || '';
  var novaContaObj   = novoCarteiraId ? carteiraGlobal.find(function (c) { return c.id === novoCarteiraId; }) : null;
  var novaIsCredito  = novaContaObj ? novaContaObj.tipo === 'credito' : false;

  // Sanitização + limite de comprimento
  var descricao = window.budSanitize ? window.budSanitize(descricaoRaw) : descricaoRaw;
  descricao = descricao.substring(0, 100);

  // Converter data para Timestamp (meio-dia para evitar shift de fuso)
  var dataTimestamp = Timestamp.fromDate(new Date(dataStr + 'T12:00:00'));

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Salvando...';

  try {
    if (transacaoEditandoId) {
      // Modo edição — reverter saldo antigo, aplicar novo
      var txAntiga = transacoesGlobais.find(function (tx) { return tx.id === transacaoEditandoId; }) || {};
      var antigoCarteiraId = txAntiga.carteiraId || '';
      var antigoContaObj   = antigoCarteiraId ? carteiraGlobal.find(function (c) { return c.id === antigoCarteiraId; }) : null;
      var antigoIsCredito  = antigoContaObj ? antigoContaObj.tipo === 'credito' : false;
      var antigoValor      = parseFloat(txAntiga.valor) || 0;
      var antigoTipo       = txAntiga.tipo || tipoAtual;

      var txUpdate = {
        descricao:  descricao,
        valor:      valor,
        categoria:  categoria,
        data:       dataTimestamp,
        tipo:       tipoAtual,
        carteiraId: novoCarteiraId || null,
      };
      await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', transacaoEditandoId), txUpdate);

      // Ajustar saldos se algo relevante mudou
      var mudouConta       = antigoCarteiraId !== novoCarteiraId;
      var mudouValorOuTipo = antigoValor !== valor || antigoTipo !== tipoAtual;
      if (mudouConta || mudouValorOuTipo) {
        try {
          // 1) Reverter efeito da transação antiga
          if (antigoCarteiraId && !antigoIsCredito) {
            var refAnt  = doc(db, 'usuarios', usuarioAtualId, 'carteira', antigoCarteiraId);
            var snapAnt = await getDoc(refAnt);
            if (snapAnt.exists()) {
              var reverter = antigoTipo === 'receita' ? -antigoValor : antigoValor;
              await updateDoc(refAnt, { saldo: (snapAnt.data().saldo || 0) + reverter });
            }
          }
          // 2) Aplicar efeito da nova conta
          if (novoCarteiraId && !novaIsCredito) {
            var refNov  = doc(db, 'usuarios', usuarioAtualId, 'carteira', novoCarteiraId);
            var snapNov = await getDoc(refNov);
            if (snapNov.exists()) {
              var aplicar = tipoAtual === 'receita' ? valor : -valor;
              await updateDoc(refNov, { saldo: (snapNov.data().saldo || 0) + aplicar });
            }
          }
        } catch (_eS) { /* saldo não bloqueia */ }
      }

      fecharModal();
      if (window.budShowToast) window.budShowToast('Transação atualizada!', 'success');
    } else {
      // Modo criação — addDoc
      var novasTx = {
        descricao:    descricao,
        valor:        valor,
        categoria:    categoria,
        data:         dataTimestamp,
        tipo:         tipoAtual,
        dataCriacao:  serverTimestamp(),
      };
      if (novoCarteiraId) novasTx.carteiraId = novoCarteiraId;
      await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), novasTx);

      // Ajustar saldo da conta (não para cartão de crédito)
      if (novoCarteiraId && !novaIsCredito) {
        try {
          var cRef  = doc(db, 'usuarios', usuarioAtualId, 'carteira', novoCarteiraId);
          var cSnap = await getDoc(cRef);
          if (cSnap.exists()) {
            var delta = tipoAtual === 'receita' ? valor : -valor;
            await updateDoc(cRef, { saldo: (cSnap.data().saldo || 0) + delta });
          }
        } catch (_eS) { /* saldo não bloqueia */ }
      }

      fecharModal();
      if (window.budShowToast) window.budShowToast(
        tipoAtual === 'receita' ? 'Receita registrada!' : 'Despesa registrada!',
        'success'
      );
      // Alerta de limite ao criar despesa
      if (tipoAtual === 'despesa' && limitesGlobaisDash.length > 0) {
        verificarAlerteLimite(categoria, valor);
      }
    }
  } catch (_err) {
    if (window.budShowToast) window.budShowToast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btnSubmit.disabled = false;
    var isEdit = transacaoEditandoId !== null;
    btnSubmit.textContent = isEdit ? 'Salvar Alterações' : (tipoAtual === 'receita' ? 'Salvar Receita' : 'Salvar Despesa');
  }
}

// ─── Excluir transação (mini-modal de confirmação) ──────────────────────
function pedirConfirmacaoExcluir() {
  var modal = document.getElementById('modalConfirmExcluir');
  if (modal) modal.classList.add('open');
}
function fecharConfirmExcluir() {
  var modal = document.getElementById('modalConfirmExcluir');
  if (modal) modal.classList.remove('open');
}
async function confirmarExclusao() {
  if (!transacaoEditandoId || !usuarioAtualId) return;
  var btnConfirm = document.getElementById('btnConfirmExcluir');
  if (btnConfirm) { btnConfirm.disabled = true; btnConfirm.textContent = 'Excluindo...'; }
  try {
    await deleteDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', transacaoEditandoId));
    fecharConfirmExcluir();
    fecharModal();
    if (window.budShowToast) window.budShowToast('Transação excluída.', 'success');
  } catch (_err) {
    if (window.budShowToast) window.budShowToast('Erro ao excluir. Tente novamente.', 'error');
  } finally {
    if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = 'Excluir'; }
  }
}

// ─── Histórico completo ─────────────────────────────────────────────────
function abrirHistorico() {
  var modal = document.getElementById('modalHistorico');
  if (!modal) return;
  renderizarHistorico();
  modal.classList.add('open');
}
function fecharHistorico() {
  var modal = document.getElementById('modalHistorico');
  if (modal) modal.classList.remove('open');
}
function renderizarHistorico() {
  var container = document.getElementById('historicoLista');
  if (!container) return;

  var filtradas = transacoesGlobais.filter(function (t) {
    if (!t.data) return false;
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    return d.getMonth() === mesVisualizado && d.getFullYear() === anoVisualizado;
  });
  filtradas.sort(function (a, b) {
    var da = a.data ? (a.data.toDate ? a.data.toDate() : new Date(a.data)) : new Date(0);
    var db2 = b.data ? (b.data.toDate ? b.data.toDate() : new Date(b.data)) : new Date(0);
    return db2 - da;
  });

  if (filtradas.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--card-text-sec);padding:2rem 0;">Nenhuma transação neste mês.</p>';
    return;
  }

  container.innerHTML = '';
  filtradas.forEach(function (t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--card-border);cursor:pointer;transition:background .15s;border-radius:0.5rem;';
    row.addEventListener('mouseenter', function () { row.style.background = 'var(--sidebar-link-hover-bg)'; });
    row.addEventListener('mouseleave', function () { row.style.background = ''; });
    (function (tid) {
      row.addEventListener('click', function () { fecharHistorico(); abrirModalEditar(tid); });
    })(t.id);

    var left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:0.75rem;min-width:0;';

    var icon = document.createElement('div');
    icon.style.cssText = 'width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;' +
      (t.tipo === 'receita' ? 'background:#dcfce7;' : 'background:#fee2e2;');
    icon.textContent = t.tipo === 'receita' ? '↑' : '↓';

    var info = document.createElement('div');
    info.style.cssText = 'min-width:0;';
    var descEl = document.createElement('div');
    descEl.style.cssText = 'font-weight:500;font-size:0.9rem;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;';
    descEl.textContent = t.descricao || 'Sem descrição';
    var catEl = document.createElement('div');
    catEl.style.cssText = 'font-size:0.75rem;color:var(--card-text-sec);';
    catEl.textContent = t.categoria || '';
    info.appendChild(descEl);
    info.appendChild(catEl);
    left.appendChild(icon);
    left.appendChild(info);

    var right = document.createElement('div');
    right.style.cssText = 'text-align:right;flex-shrink:0;';
    var valorEl = document.createElement('div');
    valorEl.style.cssText = 'font-weight:600;font-size:0.9rem;' +
      (t.tipo === 'receita' ? 'color:#16a34a;' : 'color:#dc2626;');
    valorEl.textContent = (t.tipo === 'receita' ? '+' : '-') +
      'R$ ' + (t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    var dataEl = document.createElement('div');
    dataEl.style.cssText = 'font-size:0.75rem;color:var(--card-text-sec);';
    if (t.data) {
      var dt = t.data.toDate ? t.data.toDate() : new Date(t.data);
      dataEl.textContent = String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0');
    }
    right.appendChild(valorEl);
    right.appendChild(dataEl);

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

// ─── Sidebar mobile + desktop collapse ─────────────────────────────────
function setupSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var btnHamburger = document.getElementById('btnHamburger');
  var btnCollapse = document.getElementById('btnSidebarCollapse');
  var dashMain = document.getElementById('dashMain');

  // ── Mobile: hamburger ──────────────────────────────────────────────
  if (btnHamburger) {
    btnHamburger.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // ── Desktop: collapse ──────────────────────────────────────────────
  function applyCollapsed(collapsed) {
    if (collapsed) {
      sidebar.classList.add('collapsed');
      dashMain && dashMain.classList.add('sidebar-collapsed');
      if (btnCollapse) btnCollapse.textContent = '›';
    } else {
      sidebar.classList.remove('collapsed');
      dashMain && dashMain.classList.remove('sidebar-collapsed');
      if (btnCollapse) btnCollapse.textContent = '‹';
    }
  }

  // Restaurar estado salvo apenas no desktop
  var savedCollapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (window.innerWidth > 768) applyCollapsed(savedCollapsed);

  if (btnCollapse) {
    btnCollapse.addEventListener('click', function () {
      if (window.innerWidth <= 768) return; // ignora no mobile
      var isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('bud_sidebar_collapsed', !isCollapsed);
      applyCollapsed(!isCollapsed);
    });
  }

}

// ─── Listener de Transações com filtro por data (re-assinado ao trocar mês) ──
function setupTransacoesListener(uid) {
  if (_unsubTransacoes) { _unsubTransacoes(); _unsubTransacoes = null; }
  // Carrega mês anterior (para comparativo) + mês atual + mês seguinte
  var inicio = new Date(anoVisualizado, mesVisualizado - 2, 1);
  var fim    = new Date(anoVisualizado, mesVisualizado + 1, 0, 23, 59, 59);
  var transRef = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    where('data', '>=', Timestamp.fromDate(inicio)),
    where('data', '<=', Timestamp.fromDate(fim)),
    orderBy('data', 'desc'),
    limit(600)
  );
  _unsubTransacoes = onSnapshot(transRef, function (snapshot) {
    transacoesGlobais = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    renderizarDashboard();
  }, function () {});
}

// ─── Setup listeners Firestore ──────────────────────────────────────────
function setupListeners(uid) {
  // Categorias personalizadas — onSnapshot sem where+orderBy (evita índice composto)
  var catRef = collection(db, 'usuarios', uid, 'categorias');
  _unsubs.push(onSnapshot(catRef, function (snap) {
    var r = [], d = [];
    snap.forEach(function (doc) {
      var data = doc.data();
      var item = { nome: data.nome, emoji: data.emoji || '🏷️' };
      if (data.tipo === 'receita') r.push(item);
      else if (data.tipo === 'despesa') d.push(item);
    });
    categoriasPersonalizadas.receita  = r;
    categoriasPersonalizadas.despesa  = d;
  }, function () {}));

  // Transações — listener com filtro de data (setupTransacoesListener)
  setupTransacoesListener(uid);

  // Dívidas — widget "Dívidas em Atraso"
  var dividasRef = query(collection(db, 'usuarios', uid, 'dividas'), limit(500));
  _unsubs.push(onSnapshot(dividasRef, function (snapshot) {
    dividasGlobaisDash = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    atualizarDividasAtraso();
  }, function () {}));

  // Limites — widget "Limites do Mês"
  var limitesRef = query(collection(db, 'usuarios', uid, 'limites'), limit(500));
  _unsubs.push(onSnapshot(limitesRef, function (snapshot) {
    limitesGlobaisDash = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    // Re-renderiza para atualizar widget e indicador do card Saídas
    renderizarDashboard();
  }, function () {}));

  // Carteira — mini widget contas
  var carteiraRef = query(collection(db, 'usuarios', uid, 'carteira'), limit(500));
  _unsubs.push(onSnapshot(carteiraRef, function (snapshot) {
    carteiraGlobal = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    atualizarWidgetCarteira();
  }, function () {}));

  // Recorrentes — widget lembretes 7 dias
  var recorrentesRef = query(collection(db, 'usuarios', uid, 'recorrentes'), limit(500));
  _unsubs.push(onSnapshot(recorrentesRef, function (snapshot) {
    recorrentesGlobaisDash = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    atualizarLembretes7Dias();
    atualizarTudoEmDia();
  }, function () {}));

  // Metas — widget Meta em Destaque
  var metasRef = query(collection(db, 'usuarios', uid, 'metas'), limit(500));
  _unsubs.push(onSnapshot(metasRef, function (snapshot) {
    metasGlobaisDash = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    atualizarWidgetMetaProxima();
  }, function () {}));

  // Investimentos — widget Investimentos
  var investRef = query(collection(db, 'usuarios', uid, 'investimentos'), limit(500));
  _unsubs.push(onSnapshot(investRef, function (snapshot) {
    investimentosGlobaisDash = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    atualizarWidgetInvestimentos();
  }, function () {}));
}

// ─── Cleanup listeners ─────────────────────────────────────────────────
function cleanupListeners() {
  if (_unsubTransacoes) { _unsubTransacoes(); _unsubTransacoes = null; }
  _unsubs.forEach(function (fn) { fn(); });
  _unsubs.length = 0;
}

// ═══ AUTH GUARD ══════════════════════════════════════════════════════════
onAuthStateChanged(auth, async function (user) {
  if (!user) {
    // Não logado → redireciona para login
    window.location.href = 'index.html';
    return;
  }

  usuarioAtualId = user.uid;
  _dashCurrentUser = user; // armazena para auto-processar recorrentes

  // ── Forçar refresh do token para evitar "Missing permissions" ────
  try {
    await user.getIdToken(true);
  } catch (_tokenErr) {
    // Token inválido / sessão expirada → redirecionar para login
    window.location.href = 'index.html';
    return;
  }

  // ── Buscar dados do usuário no Firestore ──────────────────────────
  try {
    var userSnap = await getDoc(doc(db, 'usuarios', user.uid));
    var userData = userSnap.exists() ? userSnap.data() : {};

    // Guard: primeiroLogin → redirect trocar senha (fix BUG 3 do cérebro)
    if (userData.primeiroLogin === true) {
      window.location.href = 'trocar-senha.html';
      return;
    }

    // Guard: onboarding não concluído → redirect onboarding.html
    if (userData.onboardingConcluido !== true) {
      window.location.href = 'onboarding.html';
      return;
    }

    // ── Nome + avatar na sidebar ────────────────────────────────────
    var nome = userData.nome || user.email || 'Usuário';
    var nomeSeguro = window.budSanitize ? window.budSanitize(nome) : nome;
    var matricula = userData.matricula || '';

    var sidebarName = document.getElementById('sidebarUserName');
    var sidebarId = document.getElementById('sidebarUserId');
    var sidebarAvatar = document.getElementById('sidebarAvatar');

    if (sidebarName) sidebarName.textContent = nomeSeguro;
    if (sidebarId) sidebarId.textContent = matricula || user.email;
    if (sidebarAvatar) sidebarAvatar.textContent = getIniciais(nomeSeguro);

    // ── Welcome text ────────────────────────────────────────────────
    var welcomeText = document.getElementById('welcomeText');
    var welcomeDate = document.getElementById('welcomeDate');
    var firstName = nomeSeguro.split(' ')[0];
    if (welcomeText) welcomeText.textContent = getSaudacao() + ', ' + firstName + '! 👋';
    if (welcomeDate) welcomeDate.textContent = formatarDataHoje();

    // ── Streak de dias consecutivos ────────────────────────────────
    var streak = userData.streakDias || 0;
    var streakBadge = document.getElementById('streakBadge');
    var streakCount = document.getElementById('streakCount');
    if (streakBadge) {
      if (streak >= 2) {
        if (streakCount) streakCount.textContent = streak;
        streakBadge.style.display = '';
      } else {
        streakBadge.style.display = 'none';
      }
    }

    // ── Banner de plano/trial ───────────────────────────────────────
    configurarBannerPlano(userData);

    // ── Aplicar tema salvo no perfil Firestore ──────────────────────
    if (window.budThemeManager && userData.temaEscolhido) {
      _skipThemeSync = true;
      window.budThemeManager.apply(userData.temaEscolhido);
      _skipThemeSync = false;
    }

    // ── Guardar plano para bloqueio no modal ────────────────────────
    planoAtual = userData.plano || 'free';
    if (planoAtual === 'trial' && userData.trialFim) {
      var fimDate = userData.trialFim.toDate ? userData.trialFim.toDate() : new Date(userData.trialFim);
      trialExpirado = fimDate < new Date();
    }

    // ── Setup listeners de dados (limpar anteriores para evitar duplicatas) ──
    cleanupListeners();
    setupListeners(user.uid);

    // Auto-processar recorrentes de hoje (silencioso, 1x por dia via localStorage)
    _autoProcessarRecorrentesHoje();

  } catch (err) {
    // Erro de permissão → sessão pode estar inválida
    if (err && err.code === 'permission-denied') {
      if (window.budShowToast) window.budShowToast('Sessão expirada. Redirecionando…', 'error');
      setTimeout(function () { window.location.href = 'index.html'; }, 1500);
    } else {
      if (window.budShowToast) window.budShowToast('Erro ao carregar dados.', 'error');
    }
  }
});

// ─── Logout ─────────────────────────────────────────────────────────────
var btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async function () {
    try {
      cleanupListeners();
      await signOut(auth);
      window.location.href = 'index.html';
    } catch (_err) {
      if (window.budShowToast) window.budShowToast('Erro ao sair. Tente novamente.', 'error');
    }
  });
}

// ─── Toggle valores ocultos ─────────────────────────────────────────────
var btnToggle = document.getElementById('btnToggleValues');
if (btnToggle) {
  btnToggle.addEventListener('click', function () {
    valoresOcultos = !valoresOcultos;
    localStorage.setItem('bud_valores_ocultos', valoresOcultos);
    renderizarDashboard();
  });
}

// ─── Sync ───────────────────────────────────────────────────────────────
var btnSync = document.getElementById('btnSync');
if (btnSync) {
  btnSync.addEventListener('click', function () {
    if (!usuarioAtualId) return;
    cleanupListeners();
    setupListeners(usuarioAtualId);
    if (window.budShowToast) window.budShowToast('Dados sincronizados!', 'success');
  });
}

// ─── Quick actions → abrir modal ────────────────────────────────────────
var btnNovaReceita = document.getElementById('btnNovaReceita');
var btnNovaDespesa = document.getElementById('btnNovaDespesa');
if (btnNovaReceita) {
  btnNovaReceita.addEventListener('click', function () { abrirModal('receita'); });
}
if (btnNovaDespesa) {
  btnNovaDespesa.addEventListener('click', function () { abrirModal('despesa'); });
}

// ─── Modal: fechar ───────────────────────────────────────────────────────
var btnFecharModal = document.getElementById('btnFecharModal');
if (btnFecharModal) {
  btnFecharModal.addEventListener('click', fecharModal);
}
var modalOverlay = document.getElementById('modalLancamento');
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    // Fechar na ordem: confirmação > histórico > modal lançamento
    var confirmModal = document.getElementById('modalConfirmExcluir');
    if (confirmModal && confirmModal.classList.contains('open')) { fecharConfirmExcluir(); return; }
    var histModal = document.getElementById('modalHistorico');
    if (histModal && histModal.classList.contains('open')) { fecharHistorico(); return; }
    fecharModal();
  }
  if (e.key === 'Enter') {
    // Submeter modal de lançamento ao pressionar Enter (exceto em textarea)
    var modalLanc = document.getElementById('modalLancamento');
    if (modalLanc && modalLanc.classList.contains('open') && e.target && e.target.tagName !== 'TEXTAREA') {
      // Não submeter se estiver com dropdown aberto
      var catDd = document.getElementById('categoriaDropdown');
      var dpDd  = document.getElementById('datepickerDropdown');
      if ((catDd && catDd.classList.contains('open')) || (dpDd && dpDd.classList.contains('open'))) return;
      e.preventDefault();
      var form = document.getElementById('formLancamento');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }
});

// ─── Custom dropdown: categoria ──────────────────────────────────────────
var categoriaBtn = document.getElementById('categoriaBtn');
if (categoriaBtn) {
  categoriaBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var dd = document.getElementById('categoriaDropdown');
    var isOpen = dd && dd.classList.contains('open');
    if (isOpen) {
      dd.classList.remove('open', 'open-up');
      categoriaBtn.classList.remove('open');
      categoriaBtn.setAttribute('aria-expanded', 'false');
    } else {
      if (dd) {
        dd.classList.remove('open-up');
        var rect = categoriaBtn.getBoundingClientRect();
        var spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 220) dd.classList.add('open-up');
        dd.classList.add('open');
      }
      categoriaBtn.classList.add('open');
      categoriaBtn.setAttribute('aria-expanded', 'true');
    }
  });
  categoriaBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); categoriaBtn.click(); }
  });
}
// Fechar dropdowns ao clicar fora
document.addEventListener('click', function () {
  var dd = document.getElementById('categoriaDropdown');
  var btn = document.getElementById('categoriaBtn');
  if (dd) dd.classList.remove('open', 'open-up');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  fecharDatepicker();
});

// ─── Custom datepicker ───────────────────────────────────────────────────
var datepickerBtn = document.getElementById('datepickerBtn');
if (datepickerBtn) {
  datepickerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var dd = document.getElementById('datepickerDropdown');
    var isOpen = dd && dd.classList.contains('open');
    if (isOpen) {
      fecharDatepicker();
    } else {
      // Sincronizar view com data selecionada (ou hoje)
      var hidden = document.getElementById('inputData');
      if (hidden && hidden.value) {
        var parts = hidden.value.split('-');
        dpViewYear = parseInt(parts[0]);
        dpViewMonth = parseInt(parts[1]) - 1;
      } else {
        var now = new Date();
        dpViewYear = now.getFullYear();
        dpViewMonth = now.getMonth();
      }
      renderCalendar();
      if (dd) {
        dd.classList.remove('open-up');
        var rect = datepickerBtn.getBoundingClientRect();
        var spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 320) dd.classList.add('open-up');
        dd.classList.add('open');
      }
      datepickerBtn.classList.add('open');
      datepickerBtn.setAttribute('aria-expanded', 'true');
    }
  });
  datepickerBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); datepickerBtn.click(); }
    if (e.key === 'Escape') fecharDatepicker();
  });
}
var dpPrevBtn = document.getElementById('dpPrevMonth');
var dpNextBtn = document.getElementById('dpNextMonth');
if (dpPrevBtn) {
  dpPrevBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dpViewMonth--; if (dpViewMonth < 0) { dpViewMonth = 11; dpViewYear--; }
    renderCalendar();
  });
}
if (dpNextBtn) {
  dpNextBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dpViewMonth++; if (dpViewMonth > 11) { dpViewMonth = 0; dpViewYear++; }
    renderCalendar();
  });
}
// Evitar que cliques dentro do dropdown fechem ao propagar
var datepickerDropdown = document.getElementById('datepickerDropdown');
if (datepickerDropdown) {
  datepickerDropdown.addEventListener('click', function (e) { e.stopPropagation(); });
}

// ─── Modal: toggle tipo ──────────────────────────────────────────────────
var tipoBtnReceita = document.getElementById('tipoBtnReceita');
var tipoBtnDespesa = document.getElementById('tipoBtnDespesa');
if (tipoBtnReceita) tipoBtnReceita.addEventListener('click', function () { atualizarModalTipo('receita'); });
if (tipoBtnDespesa) tipoBtnDespesa.addEventListener('click', function () { atualizarModalTipo('despesa'); });

// ─── Modal: máscara de valor ─────────────────────────────────────────────
var inputValorEl = document.getElementById('inputValor');
if (inputValorEl) {
  inputValorEl.addEventListener('input', function () { aplicarMascaraValor(this); });
}

// ─── Modal: submit ───────────────────────────────────────────────────────
var formLancamento = document.getElementById('formLancamento');
if (formLancamento) {
  formLancamento.addEventListener('submit', handleSubmitLancamento);
}

// ─── Botão excluir transação ────────────────────────────────────────────
var btnExcluirTransacao = document.getElementById('btnExcluirTransacao');
if (btnExcluirTransacao) {
  btnExcluirTransacao.addEventListener('click', function (e) {
    e.preventDefault();
    pedirConfirmacaoExcluir();
  });
}

// ─── Mini-modal confirmação exclusão ────────────────────────────────────
var btnConfirmExcluir = document.getElementById('btnConfirmExcluir');
var btnCancelarExcluir = document.getElementById('btnCancelarExcluir');
if (btnConfirmExcluir) btnConfirmExcluir.addEventListener('click', confirmarExclusao);
if (btnCancelarExcluir) btnCancelarExcluir.addEventListener('click', fecharConfirmExcluir);
var modalConfirmOverlay = document.getElementById('modalConfirmExcluir');
if (modalConfirmOverlay) {
  modalConfirmOverlay.addEventListener('click', function (e) {
    if (e.target === modalConfirmOverlay) fecharConfirmExcluir();
  });
}

// ─── Histórico modal ────────────────────────────────────────────────────
var btnFecharHistorico = document.getElementById('btnFecharHistorico');
if (btnFecharHistorico) btnFecharHistorico.addEventListener('click', fecharHistorico);
var modalHistoricoOverlay = document.getElementById('modalHistorico');
if (modalHistoricoOverlay) {
  modalHistoricoOverlay.addEventListener('click', function (e) {
    if (e.target === modalHistoricoOverlay) fecharHistorico();
  });
}

// ─── Navegação de mês ──────────────────────────────────────────────────
var btnMesAnterior = document.getElementById('btnMesAnterior');
var btnProximoMes  = document.getElementById('btnProximoMes');
if (btnMesAnterior) {
  btnMesAnterior.addEventListener('click', function () {
    mesVisualizado--;
    if (mesVisualizado < 0) { mesVisualizado = 11; anoVisualizado--; }
    if (usuarioAtualId) setupTransacoesListener(usuarioAtualId);
    // renderizarDashboard é chamado pelo callback do listener após carregar os dados
  });
}
if (btnProximoMes) {
  btnProximoMes.addEventListener('click', function () {
    mesVisualizado++;
    if (mesVisualizado > 11) { mesVisualizado = 0; anoVisualizado++; }
    if (usuarioAtualId) setupTransacoesListener(usuarioAtualId);
    // renderizarDashboard é chamado pelo callback do listener após carregar os dados
  });
}

// ─── Inicializar label de mês ao carregar ───────────────────────────────
var navMesAnoEl = document.getElementById('navMesAno');
if (navMesAnoEl) navMesAnoEl.textContent = getMesAnoLabel();

// ─── Filtro rápido de atividades ────────────────────────────────────────
document.querySelectorAll('.filtro-atividades').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var novoFiltro = btn.getAttribute('data-filtro');
    if (novoFiltro === filtroAtividadeAtual) return;
    
    // Atualizar estado do botão ativo
    document.querySelectorAll('.filtro-atividades').forEach(function (b) {
      b.classList.remove('active');
      b.style.background = 'var(--card-bg)';
      b.style.color = 'var(--card-text)';
      b.style.borderColor = 'var(--card-border)';
    });
    btn.classList.add('active');
    btn.style.background = 'var(--btn-bg)';
    btn.style.color = 'var(--btn-text)';
    btn.style.borderColor = 'transparent';
    
    filtroAtividadeAtual = novoFiltro;
    // Re-renderiza apenas a lista de atividades (evita blink no gráfico)
    var transDoMes = transacoesGlobais.filter(function (t) {
      if (!t.data) return false;
      var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
      return d.getMonth() === mesVisualizado && d.getFullYear() === anoVisualizado;
    });
    renderizarAtividades(transDoMes);
  });
});

// ─── Init sidebar ───────────────────────────────────────────────────────
setupSidebar();

// ─── Apply initial toggle state (oculta valores do HTML se necessário) ──
atualizarVisibilidadeValores();

// ─── Sync tema com Firestore quando usuário troca pelo seletor ───────────
// ─── Acessibilidade: Escape fecha qualquer modal/overlay aberto ────────────
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var ovPago = document.getElementById('overlayMarcarPago');
  if (ovPago) { ovPago.remove(); return; }
  var aberto = document.querySelector('.modal-overlay.open');
  if (aberto) { aberto.classList.remove('open'); return; }
});

// ─── Month Picker (clique no label de mês para saltar a qualquer mês) ───────
(function () {
  var label = document.getElementById('navMesAno');
  var nav   = label && label.parentElement;
  if (!label || !nav) return;
  nav.style.position = 'relative';
  label.setAttribute('role', 'button');
  label.setAttribute('tabindex', '0');
  label.setAttribute('aria-haspopup', 'true');
  label.setAttribute('aria-label', 'Selecionar mês e ano');

  var picker = document.createElement('div');
  picker.id = 'mesPicker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Seletor de mês');
  picker.style.cssText = 'display:none;position:fixed;background:var(--bg-page);border:1.5px solid var(--card-border);border-radius:1rem;box-shadow:0 8px 24px rgba(0,0,0,0.16);padding:0.875rem;z-index:9999;min-width:220px;';
  document.body.appendChild(picker);

  var MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var pickerAno = new Date().getFullYear();

  function renderPicker() {
    picker.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.625rem;">'
      + '<button id="mpBtnAnoPrev" style="width:1.75rem;height:1.75rem;border:none;border-radius:0.5rem;background:var(--sidebar-user-bg);cursor:pointer;font-size:1rem;color:var(--card-text);font-family:inherit;">‹</button>'
      + '<span style="font-weight:700;font-size:0.9375rem;color:var(--card-text);">' + pickerAno + '</span>'
      + '<button id="mpBtnAnoNext" style="width:1.75rem;height:1.75rem;border:none;border-radius:0.5rem;background:var(--sidebar-user-bg);cursor:pointer;font-size:1rem;color:var(--card-text);font-family:inherit;">›</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.375rem;">'
      + MESES.map(function (m, i) {
          var ativo = i === mesVisualizado && pickerAno === anoVisualizado;
          return '<button class="mp-mes-btn" data-mes="' + i + '" style="padding:0.4rem 0;border-radius:0.5rem;border:none;cursor:pointer;font-size:0.8125rem;font-weight:700;font-family:inherit;background:' + (ativo ? 'var(--theme-accent)' : 'var(--sidebar-user-bg)') + ';color:' + (ativo ? '#fff' : 'var(--card-text)') + ';">' + m + '</button>';
        }).join('')
      + '</div>';

    picker.querySelector('#mpBtnAnoPrev').addEventListener('click', function (e) { e.stopPropagation(); pickerAno--; renderPicker(); });
    picker.querySelector('#mpBtnAnoNext').addEventListener('click', function (e) { e.stopPropagation(); pickerAno++; renderPicker(); });
    picker.querySelectorAll('.mp-mes-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        mesVisualizado = parseInt(btn.getAttribute('data-mes'));
        anoVisualizado = pickerAno;
        closePicker();
        if (usuarioAtualId) setupTransacoesListener(usuarioAtualId);
      });
    });
  }

  function openPicker() {
    pickerAno = anoVisualizado;
    renderPicker();
    var rect = label.getBoundingClientRect();
    var pw = 220;
    var left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    picker.style.top  = (rect.bottom + 8) + 'px';
    picker.style.left = left + 'px';
    picker.style.display = 'block';
    label.setAttribute('aria-expanded', 'true');
  }
  function closePicker() { picker.style.display = 'none'; label.setAttribute('aria-expanded', 'false'); }

  label.addEventListener('click', function (e) { e.stopPropagation(); picker.style.display === 'block' ? closePicker() : openPicker(); });
  label.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.style.display === 'block' ? closePicker() : openPicker(); } });
  document.addEventListener('click', function () { closePicker(); });
  picker.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('scroll', function () { closePicker(); }, true);
})();

document.addEventListener('bud:themechange', function (e) {
  if (!usuarioAtualId || _skipThemeSync) return;
  var name = e.detail && typeof e.detail.name === 'string' ? e.detail.name : 'padrao';
  updateDoc(doc(db, 'usuarios', usuarioAtualId), { temaEscolhido: name }).catch(function () {});
  // Re-renderizar gráfico com as cores do novo tema
  renderizarGraficos(transacoesGlobais.filter(function (t) {
    if (!t.data) return false;
    var d = t.data.toDate ? t.data.toDate() : new Date(t.data);
    return d.getMonth() === mesVisualizado && d.getFullYear() === anoVisualizado;
  }));
});
