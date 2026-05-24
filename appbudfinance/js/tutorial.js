/**
 * tutorial.js — Sistema de Tutorial Bud Finance
 * FAB "?" fixo em todas as telas autenticadas.
 * Auto-popup na primeira visita; localStorage controla estado.
 */
(function () {
  'use strict';

  var PFX        = 'bud_tut_done_';
  var KEY_NEVER  = 'bud_tut_never';

  /* ── Conteúdo dos tutoriais ─────────────────────────────────────── */
  var TUTS = {
    dashboard: {
      emoji: '📊', titulo: 'Dashboard',
      descricao: 'Seu painel financeiro completo. Acompanhe receitas, despesas e saldo do mês em um só lugar.',
      features: [
        { emoji: '💰', titulo: 'Resumo do mês',       desc: 'Saldo, receitas e despesas em tempo real' },
        { emoji: '⚡', titulo: 'Lançamento rápido',    desc: 'Registre receitas e despesas em segundos' },
        { emoji: '📅', titulo: 'Navegar por mês',      desc: 'Explore meses anteriores e futuros' },
        { emoji: '📋', titulo: 'Últimas transações',   desc: 'Suas movimentações mais recentes' },
      ],
    },
    extrato: {
      emoji: '📋', titulo: 'Extrato',
      descricao: 'Visualize e gerencie todas as suas transações com filtros avançados.',
      features: [
        { emoji: '🔍', titulo: 'Filtros avançados',    desc: 'Filtre por tipo, categoria, conta ou período' },
        { emoji: '✏️', titulo: 'Editar transações',    desc: 'Edite ou exclua qualquer lançamento' },
        { emoji: '✅', titulo: 'Confirmar pagamentos', desc: 'Marque despesas e receitas como pagas/recebidas' },
      ],
    },
    carteira: {
      emoji: '🏦', titulo: 'Contas',
      descricao: 'Gerencie todas as suas contas bancárias, carteiras e dinheiro físico.',
      features: [
        { emoji: '➕', titulo: 'Adicionar contas',     desc: 'Cadastre bancos, carteiras digitais e mais' },
        { emoji: '💵', titulo: 'Saldo por conta',      desc: 'Visualize o saldo atualizado de cada conta' },
        { emoji: '🔄', titulo: 'Transferências',       desc: 'Registre movimentações entre suas contas' },
      ],
    },
    cartoes: {
      emoji: '💳', titulo: 'Cartões de Crédito',
      descricao: 'Controle seus cartões, faturas e limites disponíveis.',
      features: [
        { emoji: '📅', titulo: 'Fatura mensal',        desc: 'Acompanhe o total da fatura de cada cartão' },
        { emoji: '🚦', titulo: 'Limite disponível',    desc: 'Veja quanto você ainda pode gastar' },
        { emoji: '💳', titulo: 'Múltiplos cartões',    desc: 'Gerencie todos os seus cartões em um lugar' },
      ],
    },
    categorias: {
      emoji: '🏷️', titulo: 'Categorias',
      descricao: 'Organize seus gastos por categoria e personalize conforme seu estilo de vida.',
      features: [
        { emoji: '🎨', titulo: 'Cores e emojis',       desc: 'Personalize cada categoria com cor e ícone' },
        { emoji: '📊', titulo: 'Uso por categoria',    desc: 'Veja o quanto gasta em cada área' },
        { emoji: '➕', titulo: 'Criar categorias',     desc: 'Crie categorias totalmente personalizadas' },
      ],
    },
    comparativo: {
      emoji: '📈', titulo: 'Comparativo',
      descricao: 'Compare sua situação financeira entre diferentes meses.',
      features: [
        { emoji: '📅', titulo: 'Comparar meses',       desc: 'Veja a evolução mês a mês' },
        { emoji: '📉', titulo: 'Evolução de gastos',   desc: 'Identifique tendências nas suas despesas' },
        { emoji: '⚖️', titulo: 'Receita vs Despesa',  desc: 'Compare entradas e saídas lado a lado' },
      ],
    },
    configuracoes: {
      emoji: '⚙️', titulo: 'Configurações',
      descricao: 'Personalize o Bud Finance do seu jeito.',
      features: [
        { emoji: '👤', titulo: 'Perfil',               desc: 'Edite nome, avatar e dados pessoais' },
        { emoji: '🎨', titulo: 'Tema visual',          desc: 'Escolha entre temas claro, escuro e vidro' },
        { emoji: '🔒', titulo: 'Segurança',            desc: 'Altere sua senha e dados de acesso' },
        { emoji: '🔔', titulo: 'Tutorial',             desc: 'Redefina os tutoriais para rever dicas' },
      ],
    },
    dividas: {
      emoji: '💸', titulo: 'Dívidas',
      descricao: 'Controle e quite suas dívidas com um plano de pagamento organizado.',
      features: [
        { emoji: '📋', titulo: 'Lista de dívidas',     desc: 'Visualize todas as suas dívidas ativas' },
        { emoji: '💰', titulo: 'Total devedor',        desc: 'Veja o valor total que precisa quitar' },
        { emoji: '✅', titulo: 'Registrar pagamento',  desc: 'Marque parcelas e pagamentos realizados' },
      ],
    },
    graficos: {
      emoji: '📊', titulo: 'Análises',
      descricao: 'Visualize sua vida financeira em gráficos interativos.',
      features: [
        { emoji: '🥧', titulo: 'Por categoria',        desc: 'Veja como seus gastos se distribuem' },
        { emoji: '📈', titulo: 'Evolução mensal',      desc: 'Acompanhe receitas e despesas no tempo' },
        { emoji: '⚖️', titulo: 'Balanço',             desc: 'Compare o que entra e sai mês a mês' },
      ],
    },
    insights: {
      emoji: '🔍', titulo: 'Insights',
      descricao: 'Descubra padrões e receba sugestões inteligentes sobre suas finanças.',
      features: [
        { emoji: '💡', titulo: 'Dicas personalizadas', desc: 'Sugestões baseadas no seu perfil financeiro' },
        { emoji: '⚠️', titulo: 'Alertas',             desc: 'Avisos sobre gastos acima do normal' },
        { emoji: '📊', titulo: 'Tendências',           desc: 'Identifique padrões nos seus gastos' },
      ],
    },
    investimentos: {
      emoji: '📈', titulo: 'Investimentos',
      descricao: 'Acompanhe sua carteira de investimentos e patrimônio acumulado.',
      features: [
        { emoji: '💼', titulo: 'Carteira',             desc: 'Visualize todos os seus investimentos' },
        { emoji: '📈', titulo: 'Rentabilidade',        desc: 'Acompanhe o rendimento de cada ativo' },
        { emoji: '🏦', titulo: 'Diversificação',       desc: 'Veja como seu patrimônio está distribuído' },
      ],
    },
    limites: {
      emoji: '🚦', titulo: 'Limites de Gastos',
      descricao: 'Defina tetos de gasto por categoria e receba alertas antes de estourar.',
      features: [
        { emoji: '🎯', titulo: 'Definir limites',      desc: 'Crie um orçamento por categoria' },
        { emoji: '📊', titulo: 'Progresso visual',     desc: 'Barra mostra quanto do limite já usou' },
        { emoji: '🔔', titulo: 'Alertas automáticos',  desc: 'Aviso ao atingir 80% do limite' },
      ],
    },
    mercado: {
      emoji: '🛒', titulo: 'Lista de Compras',
      descricao: 'Organize suas compras e controle o orçamento do mercado.',
      features: [
        { emoji: '📝', titulo: 'Lista de itens',       desc: 'Crie sua lista de compras do mês' },
        { emoji: '💰', titulo: 'Orçamento',            desc: 'Defina o valor disponível para as compras' },
        { emoji: '✅', titulo: 'Marcar itens',         desc: 'Risque os itens já adicionados ao carrinho' },
      ],
    },
    metas: {
      emoji: '🏆', titulo: 'Metas',
      descricao: 'Defina objetivos financeiros e acompanhe cada passo rumo a eles.',
      features: [
        { emoji: '🎯', titulo: 'Criar metas',          desc: 'Defina quanto quer guardar e até quando' },
        { emoji: '📊', titulo: 'Progresso',            desc: 'Veja o quanto já juntou para cada meta' },
        { emoji: '💰', titulo: 'Contribuições',        desc: 'Registre depósitos e aportes facilmente' },
      ],
    },
    recorrentes: {
      emoji: '🔄', titulo: 'Recorrentes',
      descricao: 'Gerencie receitas e despesas fixas que se repetem todo mês.',
      features: [
        { emoji: '📅', titulo: 'Lançamento automático',desc: 'Transações geradas no vencimento automaticamente' },
        { emoji: '✏️', titulo: 'Editar recorrentes',   desc: 'Altere valor, dia ou categoria quando quiser' },
        { emoji: '⏸️', titulo: 'Pausar/Retomar',      desc: 'Ative ou desative sem perder o histórico' },
      ],
    },
    'balanco-mensal': {
      emoji: '💰', titulo: 'Balanço Mensal',
      descricao: 'Visão detalhada de receitas, despesas e saldo de cada mês.',
      features: [
        { emoji: '📊', titulo: 'Resumo completo',      desc: 'Total de receitas, despesas e saldo final' },
        { emoji: '📅', titulo: 'Histórico mensal',     desc: 'Navegue pelos meses anteriores' },
        { emoji: '🏷️', titulo: 'Por categoria',       desc: 'Gastos separados por categoria' },
      ],
    },
    relatorios: {
      emoji: '📄', titulo: 'Relatórios',
      descricao: 'Gere relatórios completos para análise e controle financeiro.',
      features: [
        { emoji: '📥', titulo: 'Exportar PDF',         desc: 'Baixe relatórios em PDF' },
        { emoji: '📊', titulo: 'Períodos customizados',desc: 'Selecione qualquer intervalo de datas' },
        { emoji: '🏷️', titulo: 'Filtros detalhados',  desc: 'Filtre por conta, categoria e tipo' },
      ],
    },
    'assistente-ia': {
      emoji: '🤖', titulo: 'Assistente IA',
      descricao: 'Seu consultor financeiro inteligente disponível 24 horas.',
      features: [
        { emoji: '💬', titulo: 'Chat inteligente',     desc: 'Faça perguntas sobre suas finanças em texto livre' },
        { emoji: '📊', titulo: 'Análise automática',   desc: 'IA analisa seus dados e sugere melhorias' },
        { emoji: '💡', titulo: 'Dicas personalizadas', desc: 'Conselhos baseados no seu perfil' },
      ],
    },
    'assistente-whatsapp': {
      emoji: '💬', titulo: 'Bud no WhatsApp',
      descricao: 'Controle suas finanças direto pelo WhatsApp, sem abrir o app.',
      features: [
        { emoji: '📱', titulo: 'Via WhatsApp',         desc: 'Registre gastos enviando uma mensagem de texto' },
        { emoji: '🔗', titulo: 'Vinculação rápida',    desc: 'Conecte seu número em poucos segundos' },
        { emoji: '⚡', titulo: 'Lançamento fácil',     desc: 'Ex.: "100 supermercado" já registra a despesa' },
      ],
    },
  };

  /* ── localStorage helpers ──────────────────────────────────────── */
  function isDone(k)    { return localStorage.getItem(PFX + k) === '1'; }
  function markDone(k)  { try { localStorage.setItem(PFX + k, '1'); } catch (_) {} }
  function isNever()    { return localStorage.getItem(KEY_NEVER) === '1'; }
  function setNever()   {
    try { localStorage.setItem(KEY_NEVER, '1'); } catch (_) {}
    if (typeof window._budOnTutorialNever === 'function') {
      try { window._budOnTutorialNever(); } catch (_) {}
    }
  }

  /* ── Criar e exibir modal ─────────────────────────────────────── */
  function openModal(tut, pageKey) {
    if (document.getElementById('bud-tut-overlay')) return;

    /* overlay */
    var ov = document.createElement('div');
    ov.id = 'bud-tut-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Tutorial: ' + tut.titulo);
    ov.style.cssText =
      'position:fixed;inset:0;z-index:99998;' +
      'display:flex;align-items:center;justify-content:center;padding:1rem;' +
      'background:rgba(10,22,40,0.65);' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
      'opacity:0;transition:opacity .25s ease;';

    /* card */
    var card = document.createElement('div');
    card.style.cssText =
      'background:var(--bg-page,#f4f7fb);' +
      'border:1px solid var(--card-border,rgba(255,255,255,0.9));' +
      'border-radius:1.5rem;padding:1.75rem 1.5rem 1.5rem;' +
      'width:100%;max-width:460px;' +
      'box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);' +
      'transform:translateY(18px);transition:transform .3s ease;' +
      'position:relative;max-height:90vh;overflow-y:auto;';

    /* botão X */
    var btnX = _btn('×',
      'position:absolute;top:1rem;right:1rem;' +
      'width:2rem;height:2rem;border-radius:0.5rem;' +
      'background:var(--sidebar-user-bg,rgba(241,245,249,0.8));' +
      'border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'font-size:1.25rem;line-height:1;color:var(--text-sec,#64748b);font-family:inherit;'
    );

    /* header */
    var hdr = _div(
      'display:flex;align-items:center;gap:0.75rem;margin-bottom:0.875rem;padding-right:2.75rem;'
    );
    var em = _div('font-size:2rem;line-height:1;flex-shrink:0;');
    em.textContent = tut.emoji;
    var ti = _div('font-size:1.125rem;font-weight:800;color:var(--text-main,#1e293b);letter-spacing:-0.02em;');
    ti.textContent = tut.titulo;
    hdr.appendChild(em);
    hdr.appendChild(ti);

    /* descrição */
    var dsc = document.createElement('p');
    dsc.style.cssText =
      'font-size:0.875rem;color:var(--text-sec,#64748b);font-weight:500;' +
      'margin-bottom:1.25rem;line-height:1.6;';
    dsc.textContent = tut.descricao;

    /* features */
    var fl = _div('display:flex;flex-direction:column;gap:0.625rem;margin-bottom:1.5rem;');
    tut.features.forEach(function (f) {
      var row = _div(
        'display:flex;align-items:flex-start;gap:0.75rem;' +
        'background:var(--sidebar-user-bg,rgba(241,245,249,0.8));' +
        'border-radius:0.75rem;padding:0.625rem 0.875rem;'
      );
      var fe = _div('font-size:1.125rem;flex-shrink:0;margin-top:0.0625rem;');
      fe.textContent = f.emoji;
      var ft = _div('');
      var ftt = _div('font-size:0.8125rem;font-weight:700;color:var(--text-main,#1e293b);');
      ftt.textContent = f.titulo;
      var fds = _div('font-size:0.75rem;font-weight:500;color:var(--text-sec,#64748b);margin-top:0.125rem;');
      fds.textContent = f.desc;
      ft.appendChild(ftt);
      ft.appendChild(fds);
      row.appendChild(fe);
      row.appendChild(ft);
      fl.appendChild(row);
    });

    /* botões */
    var btns = _div('display:flex;flex-direction:column;gap:0.625rem;');

    var btnOk = _btn('Entendi, vamos lá! ✓',
      'width:100%;padding:0.75rem 1rem;' +
      'background:linear-gradient(135deg,#2563eb,#1d4ed8);' +
      'color:#fff;border:none;border-radius:0.75rem;' +
      'font-size:0.9375rem;font-weight:800;cursor:pointer;font-family:inherit;'
    );

    var btnNever = _btn('Não mostrar mais em nenhuma tela',
      'width:100%;padding:0.5rem 1rem;background:none;' +
      'color:var(--text-sec,#64748b);border:none;border-radius:0.75rem;' +
      'font-size:0.8125rem;font-weight:600;cursor:pointer;font-family:inherit;'
    );

    btns.appendChild(btnOk);
    btns.appendChild(btnNever);

    card.appendChild(btnX);
    card.appendChild(hdr);
    card.appendChild(dsc);
    card.appendChild(fl);
    card.appendChild(btns);
    ov.appendChild(card);
    document.body.appendChild(ov);

    /* animar entrada */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ov.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      });
    });

    /* fechar */
    function close(never) {
      if (never) setNever();
      markDone(pageKey);
      ov.style.opacity = '0';
      card.style.transform = 'translateY(18px)';
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
    }

    btnX.onclick         = function () { close(false); };
    btnOk.onclick        = function () { close(false); };
    btnNever.onclick     = function () { close(true); };
    ov.onclick           = function (e) { if (e.target === ov) close(false); };
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); }
    });
  }

  /* ── Criar FAB ─────────────────────────────────────────────────── */
  function createFAB(pageKey) {
    var fab = document.createElement('button');
    fab.id = 'bud-tut-fab';
    fab.setAttribute('aria-label', 'Abrir tutorial desta tela');
    fab.setAttribute('title', 'Tutorial');
    fab.textContent = '?';
    fab.style.cssText =
      'position:fixed;bottom:1.5rem;right:1.5rem;' +
      'width:2.625rem;height:2.625rem;border-radius:50%;' +
      'background:linear-gradient(135deg,#2563eb,#1d4ed8);' +
      'color:#fff;border:none;cursor:pointer;' +
      'font-size:1.0625rem;font-weight:800;font-family:inherit;line-height:1;' +
      'display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 4px 16px rgba(37,99,235,0.38);' +
      'z-index:9990;transition:transform .15s,box-shadow .15s;';

    fab.addEventListener('mouseenter', function () {
      fab.style.transform = 'scale(1.13)';
      fab.style.boxShadow = '0 6px 24px rgba(37,99,235,0.55)';
    });
    fab.addEventListener('mouseleave', function () {
      fab.style.transform = 'scale(1)';
      fab.style.boxShadow = '0 4px 16px rgba(37,99,235,0.38)';
    });
    fab.onclick = function () {
      var tut = TUTS[pageKey];
      if (tut) openModal(tut, pageKey);
    };

    document.body.appendChild(fab);
  }

  /* ── Helpers DOM ──────────────────────────────────────────────── */
  function _div(css) {
    var el = document.createElement('div');
    if (css) el.style.cssText = css;
    return el;
  }
  function _btn(text, css) {
    var el = document.createElement('button');
    el.textContent = text;
    if (css) el.style.cssText = css;
    return el;
  }

  /* ── API pública ──────────────────────────────────────────────── */
  window.BudTutorial = {
    /**
     * Inicializa tutorial para a página.
     * Cria o FAB e exibe o modal se for a primeira visita.
     * @param {string} pageKey  Chave da página (ex: 'dashboard')
     */
    init: function (pageKey) {
      if (!TUTS[pageKey]) return;
      var self = this;

      function setup() {
        if (!document.getElementById('bud-tut-fab')) createFAB(pageKey);
        if (!isNever() && !isDone(pageKey)) {
          setTimeout(function () {
            if (!document.getElementById('bud-tut-overlay')) {
              openModal(TUTS[pageKey], pageKey);
            }
          }, 900);
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
      } else {
        setup();
      }
    },

    /** Abre o modal manualmente (independente de já ter sido visto). */
    show: function (pageKey) {
      var tut = TUTS[pageKey];
      if (tut) openModal(tut, pageKey);
    },

    /** Remove o flag "visto" de uma página específica. */
    reset: function (pageKey) {
      localStorage.removeItem(PFX + pageKey);
    },

    /** Remove todos os flags e o "nunca mais". */
    resetAll: function () {
      Object.keys(TUTS).forEach(function (k) {
        localStorage.removeItem(PFX + k);
      });
      localStorage.removeItem(KEY_NEVER);
    },
  };
})();
