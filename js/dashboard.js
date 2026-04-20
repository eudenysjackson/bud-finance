// js/dashboard.js — Bud Finance Dashboard
// Auth guard + session management + summary rendering

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, collection, query, orderBy, limit, onSnapshot,
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
// ─── Categorias ──────────────────────────────────────────────────────────
var CATEGORIAS = {
  receita: ['Salário', 'Freelance', 'Investimentos', 'Transferência recebida', 'Bônus', 'Outros'],
  despesa: ['Alimentação', 'Transporte', 'Saúde', 'Moradia', 'Lazer', 'Educação', 'Vestuário', 'Contas e serviços', 'Outros']
};

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

function getMesAnoLabel() {
  var d = new Date(anoVisualizado, mesVisualizado, 1);
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

  if (cardSaldo) cardSaldo.textContent = formatarValor(saldo);
  if (cardEntradas) cardEntradas.textContent = formatarValor(entradas);
  if (cardSaidas) cardSaidas.textContent = formatarValor(saidas);

  // Sub labels
  var cardSaldoSub = document.getElementById('cardSaldoSub');
  var cardEntradasSub = document.getElementById('cardEntradasSub');
  var cardSaidasSub = document.getElementById('cardSaidasSub');
  if (cardSaldoSub) cardSaldoSub.textContent = getMesAnoLabel();
  if (cardEntradasSub) cardEntradasSub.textContent = transacoesDoMes.filter(function (t) { return t.tipo === 'receita'; }).length + ' transações';
  if (cardSaidasSub) cardSaidasSub.textContent = transacoesDoMes.filter(function (t) { return t.tipo === 'despesa'; }).length + ' transações';

  // Color saldo (verde se positivo, vermelho se negativo)
  if (cardSaldo) {
    cardSaldo.style.color = saldo >= 0 ? '#16a34a' : '#dc2626';
  }

  // Atividades recentes (últimas 5)
  renderizarAtividades(transacoesDoMes);

  // Gráfico de despesas por categoria
  renderizarGraficos(transacoesDoMes);

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
    emptyDiv.innerHTML = '';

    var iconDiv = document.createElement('div');
    iconDiv.className = 'dash-empty-icon';
    iconDiv.textContent = '📝';
    emptyDiv.appendChild(iconDiv);

    var pEl = document.createElement('p');
    pEl.textContent = filtroAtividadeAtual === 'todos' ? 
      'Nenhuma transação este mês. Comece adicionando uma receita ou despesa!' :
      'Nenhuma ' + (filtroAtividadeAtual === 'receita' ? 'receita' : 'despesa') + ' neste mês.';
    emptyDiv.appendChild(pEl);

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

    var valorEl = document.createElement('div');
    valorEl.style.cssText = 'font-size:0.875rem;font-weight:700;';
    valorEl.style.color = t.tipo === 'receita' ? '#16a34a' : '#dc2626';
    var prefix = t.tipo === 'receita' ? '+' : '-';
    valorEl.textContent = valoresOcultos ? '•••' : prefix + ' ' + formatarValor(t.valor || 0);

    row.appendChild(left);
    row.appendChild(valorEl);
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
  if (dd) dd.classList.remove('open');
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
  CATEGORIAS[tipo].forEach(function (cat) {
    var div = document.createElement('div');
    div.className = 'custom-select-option';
    div.textContent = cat;
    div.setAttribute('role', 'option');
    div.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.querySelectorAll('.custom-select-option').forEach(function (o) { o.classList.remove('selected'); });
      div.classList.add('selected');
      if (hidden) hidden.value = cat;
      if (texto) texto.textContent = cat;
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
  preencherCategorias(tipo);
}

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
  if (catHidden) catHidden.value = t.categoria || '';
  if (catTexto) catTexto.textContent = t.categoria || 'Selecione...';
  if (catBtn && t.categoria) catBtn.classList.add('has-value');

  // Marcar opção selecionada no dropdown
  var dropdown = document.getElementById('categoriaDropdown');
  if (dropdown) {
    dropdown.querySelectorAll('.custom-select-option').forEach(function (o) {
      o.classList.toggle('selected', o.textContent === t.categoria);
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

  // Sanitização + limite de comprimento
  var descricao = window.budSanitize ? window.budSanitize(descricaoRaw) : descricaoRaw;
  descricao = descricao.substring(0, 100);

  // Converter data para Timestamp (meio-dia para evitar shift de fuso)
  var dataTimestamp = Timestamp.fromDate(new Date(dataStr + 'T12:00:00'));

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Salvando...';

  try {
    if (transacaoEditandoId) {
      // Modo edição — updateDoc
      await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', transacaoEditandoId), {
        descricao: descricao,
        valor: valor,
        categoria: categoria,
        data: dataTimestamp,
        tipo: tipoAtual
      });
      fecharModal();
      if (window.budShowToast) window.budShowToast('Transação atualizada!', 'success');
    } else {
      // Modo criação — addDoc
      await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), {
        descricao: descricao,
        valor: valor,           // float (ex: 1500.50) — DEC-016
        categoria: categoria,
        data: dataTimestamp,
        tipo: tipoAtual,
        dataCriacao: serverTimestamp()
      });
      fecharModal();
      if (window.budShowToast) window.budShowToast(
        tipoAtual === 'receita' ? 'Receita registrada!' : 'Despesa registrada!',
        'success'
      );
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
    var da = a.dataCriacao && a.dataCriacao.toDate ? a.dataCriacao.toDate() : new Date(0);
    var db2 = b.dataCriacao && b.dataCriacao.toDate ? b.dataCriacao.toDate() : new Date(0);
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

// ─── Setup listeners Firestore ──────────────────────────────────────────
function setupListeners(uid) {
  // Transações — onSnapshot com orderBy (fix BUG 1 do cérebro)
  var transRef = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    orderBy('dataCriacao', 'desc'),
    limit(1000)
  );
  _unsubs.push(onSnapshot(transRef, function (snapshot) {
    transacoesGlobais = snapshot.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id });
    });
    renderizarDashboard();
  }, function (_err) {
    // Listener error handled silently — user sees stale data
  }));
}

// ─── Cleanup listeners ─────────────────────────────────────────────────
function cleanupListeners() {
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
if (modalOverlay) {
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) fecharModal();
  });
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    // Fechar na ordem: confirmação > histórico > modal lançamento
    var confirmModal = document.getElementById('modalConfirmExcluir');
    if (confirmModal && confirmModal.classList.contains('open')) { fecharConfirmExcluir(); return; }
    var histModal = document.getElementById('modalHistorico');
    if (histModal && histModal.classList.contains('open')) { fecharHistorico(); return; }
    fecharModal();
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
      dd.classList.remove('open');
      categoriaBtn.classList.remove('open');
      categoriaBtn.setAttribute('aria-expanded', 'false');
    } else {
      if (dd) dd.classList.add('open');
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
  if (dd) dd.classList.remove('open');
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
      if (dd) dd.classList.add('open');
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
    renderizarDashboard();
  });
}
if (btnProximoMes) {
  btnProximoMes.addEventListener('click', function () {
    mesVisualizado++;
    if (mesVisualizado > 11) { mesVisualizado = 0; anoVisualizado++; }
    renderizarDashboard();
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
    renderizarDashboard();
  });
});

// ─── Init sidebar ───────────────────────────────────────────────────────
setupSidebar();

// ─── Apply initial toggle state (oculta valores do HTML se necessário) ──
atualizarVisibilidadeValores();

// ─── Sync tema com Firestore quando usuário troca pelo seletor ───────────
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
