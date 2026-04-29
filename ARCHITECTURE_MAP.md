# ARCHITECTURE_MAP.md — Inventário Vivo do Ecossistema

**Projeto**: Bud Finance  
**Última atualização**: 27/04/2026

> **REGRA**: Antes de criar algo novo, consulte este doc. Ao finalizar qualquer tarefa, atualize.  
> Se algo novo quebrar uma conexão existente, **pare e avise o usuário**.

---

## 🧩 Membros (UI Components)

| Nome | O que faz | Onde aparece |
|---|---|---|
| **LoginCard** | Card glassmorphic com formulário de login | `index.html` |
| **BlobsDecorativos** | Manchas de cor azul/ciano no fundo | `index.html` |
| **LogoIcon** | Ícone `$` com gradiente azul | `index.html` |
| **InputIdentificador** | Input email/matrícula com label | `index.html` |
| **InputSenha** | Input senha com toggle show/hide | `index.html` |
| **BtnLogin** | Botão principal de login com estados | `index.html` |
| **LinkEsqueceuSenha** | Link para `recuperar-senha.html` | `index.html` |
| **LinkCadastro** | Link para `cadastro.html` | `index.html` |
| **FooterLGPD** | Footer com link LGPD | `index.html` |
| **ModalReenvioEmail** | Modal para reenviar verificação de email | `index.html` (criado via JS) |
| **SplashScreen** | Loader/splash screen animado | `index.html` (HEAD) |
| **ToastSystem** | Sistema de notificações toast | Global (`bud-utils.js`) |
| **FormCadastro** | Formulário de sign-up completo | `cadastro.html` |
| **FormRecuperarSenha** | Input email + botão enviar link | `recuperar-senha.html` |
| **FormResetSenha** | Nova senha + confirmar + indicador força | `acao-auth.html` |
| **FormTrocarSenha** | Nova senha + confirmar (primeiro login) | `trocar-senha.html` |
| **IndicadorForcaSenha** | 4 barras de progresso de força da senha | `acao-auth.html`, `trocar-senha.html` |
| **StateValidating** | Spinner + texto "Validando link..." | `acao-auth.html` |
| **StateSuccess** | Pulse ring + mensagem de sucesso + link login | `acao-auth.html` |
| **StateError** | Pulse ring error + mensagem + link recuperar | `acao-auth.html` |
| **UserBadge** | Iniciais + nome + matrícula do usuário logado | `trocar-senha.html` |
| **StateUnauthorized** | Tela de acesso não autorizado + link login | `trocar-senha.html` |
| **DashSidebar** | Sidebar fixa (desktop) / hambúrguer (mobile) com nav + user info | `dashboard.html`, `configuracoes.html` |
| **DashSummaryCards** | 3 cards glassmorphic: Saldo Total, Entradas, Saídas | `dashboard.html` |
| **DashTrialBanner** | Banner condicional trial/free/expirado | `dashboard.html` |
| **DashQuickActions** | Botões rápidos: Nova Receita, Nova Despesa | `dashboard.html` |
| **DashStreakBadge** | Badge 🔥 Nd no header quando streakDias ≥ 2 (lê `userData.streakDias`) | `dashboard.html` |
| **DashCarteiraWidget** | Mini-widget contas da carteira (saldo total + lista até 3, exclui crédito) | `dashboard.html` — `atualizarWidgetCarteira()` |
| **DashLimitesWidget** | Widget limites por categoria com alertas visuais (já existia) | `dashboard.html` — `atualizarLimitesWidget()` |
| **DashDividasAtraso** | Widget dívidas vencidas com botão "Ver" (já existia) | `dashboard.html` — `atualizarDividasAtraso()` |
| **DashLembretes7Dias** | Próximas contas a vencer em 7 dias (recorrentes + parcelas de dívidas) | `dashboard.html` — `atualizarLembretes7Dias()` |
| **DashTudoEmDia** | Aparece quando não há dívidas em atraso nem lembretes pendentes | `dashboard.html` — `atualizarTudoEmDia()` |
| **DashAtividades** | Últimas 5 transações do mês com data + CTA vazio (+ Receita / + Despesa) | `dashboard.html` — `renderizarAtividades()` |
| **DashGraficoCategorias** | Donut chart Chart.js despesas por categoria | `dashboard.html` |
| **DashEconomiaPotencial** | Sugere reduzir 15% nas 2 maiores categorias de despesa | `dashboard.html` — `atualizarEconomiaPotencial()` |
| **DashSaudeFinanceira** | Score 0-100 com arco SVG animado + label + link insights | `dashboard.html` — `atualizarSaudeFinanceira()` |
| **DashDicaDia** | Dica financeira contextual baseada nos dados reais do mês | `dashboard.html` — `atualizarDicaFinanceira()` |
| **TransactionModal** | Modal glassmorphic único para Nova Receita e Nova Despesa | `dashboard.html` |
| **CfgTabs** | 3 abas: Perfil, Personalização, Segurança | `configuracoes.html` |
| **CfgCardPerfil** | Card com campos editáveis (nome) e leitura (email, matrícula, criação) | `configuracoes.html` |
| **CfgCardDados** | Card com botão de exportação CSV | `configuracoes.html` |
| **CfgCardPlano** | Card com nome e descrição do plano ativo | `configuracoes.html` |
| **CfgCardPersonalizacao** | Bubbles de tema + indicador de tema ativo | `configuracoes.html` |
| **CfgCardSeguranca** | Botão Redefinir Senha + botão Sair | `configuracoes.html` |
| **MetasSummaryCards** | 4 cards: Metas Ativas, Total Guardado, Falta Guardar, Progresso Médio | `metas.html` |
| **MetasGrid** | Grid responsivo de cards glassmorphic de metas | `metas.html` |
| **MetaCard** | Card de meta: ícone+nome, barra de progresso animada, badge, prazo, sugestão de aporte, botões aportar/histórico/editar/excluir | `metas.html` (criado via JS) |
| **ModalMeta** | Modal criar/editar meta: nome, emoji picker (120 emojis deduped), sugestões populares, valorAlvo, valorAtual, datepicker prazo | `metas.html` |
| **ModalAporte** | Modal depositar: valor, datepicker data, custom select carteira (sem crédito) | `metas.html` |
| **ModalHistorico** | Modal histórico de aportes da meta (lista de depósitos por data) | `metas.html` |
| **ConfirmExclusaoMeta** | Mini-modal inline (style.cssText) para confirmar exclusão de meta | `metas.html` (criado via JS) |
| **EmojiGrid** | Grade 8 cols com 120 emojis clicáveis para seleção de ícone da meta | `metas.html` |
| **SugestoesChips** | 10 chips clicáveis com nomes populares de metas | `metas.html` |
| **CustomDatepicker** | Calendário customizado sem input[type=date] nativo (DEC-018) — dois instâncias: prazo e data aporte | `metas.html` |
| **CustomSelectCarteira** | Dropdown customizado sem <select> nativo (DEC-018) — filtra tipo != 'credito' | `metas.html` |
| **ConfettiOverlay** | 50 peças de confetti animadas via @keyframes confettiDrop ao atingir 100% | `metas.html` (criado via JS) |
| **CartoesHeader** | Header com navegação de mês (btnMesAnterior/labelMesAtual/btnProximoMes) e botão Novo Cartão | `cartoes.html` |
| **CartoesBanner** | 3 cards de resumo: Total de Faturas, Limite Disponível, Faturas Pagas | `cartoes.html` |
| **CartoesGrid** | Grid responsivo de CartaoWrapper; oculto se sem cartões (mostra CartoesEmpty) | `cartoes.html` |
| **CartaoWrapper** | Cartão físico visual (gradiente, chip, número, nome) + seção info (fatura, barra de limite, ações, lista de gastos) | `cartoes.html` (criado via JS) |
| **CartaoStatusBadge** | Badge colorido (Paga/Vencida/Fechada/Aberta) calculado dinamicamente por mês visualizado | `cartoes.html` (criado via JS) |
| **LimiteBar** | Barra de progresso do limite disponível com cor dinâmica (verde/amarelo/vermelho) | `cartoes.html` (criado via JS) |
| **GastosLista** | Lista colapsável de até 10 gastos do mês. Cada gasto tem 3 botões: ✏️ editar, ↩ estornar/cancelar, 🗑 excluir. Gastos com status≠ativa exibem badge e ficam riscados/opacos. | `cartoes.html` (criado via JS) |
| **ModalCartao** | Modal criar/editar cartão: nome, bandeira (custom select), limite BRL, dia fechamento, dia vencimento, 10 cor pills | `cartoes.html` |
| **ModalGasto** | Modal registrar/editar gasto: descrição, valor BRL, datepicker customizado, categoria (custom select), toggle parcelamento (N parcelas, máx 48) | `cartoes.html` |
| **ModalPagarFatura** | Modal confirmar/desfazer pagamento de fatura com resumo do valor | `cartoes.html` |
| **ModalExcluirCartao** | Modal exclusão de cartão com checkbox obrigatório de confirmação (cascade delete de transações) | `cartoes.html` |
| **ModalExcluirGasto** | Modal exclusão de gasto individual | `cartoes.html` |
| **ModalStatusGasto** | Modal estornar/cancelar/reativar gasto. 3 ações: Estorno (status='estornado'), Cancelar (status='cancelado'), Reativar (status='ativa'). Botão Reativar aparece apenas quando status≠ativa. | `cartoes.html` |
| **ModalImportIA** | Modal importar fatura via IA. Aceita PDF, JPG, PNG, WEBP e OFX/QFX. OFX processado client-side sem backend. PDF/imagem enviados para `/api/extrair-fatura`. Timeout 45s. Barra de progresso animada. | `cartoes.html` |
| **ModalReviewIA** | Modal de revisão das transações extraídas. Lista editável de transações com desc/data/valor/categoria/status. Checkboxes individuais. Resumo com total selecionado. Salvar faz addDoc por transação selecionada. | `cartoes.html` |
| **CorPicker** | 10 pills de cores (roxo/azul/teal/verde/laranja/vermelho/rosa/amarelo/cyan/preto) para seleção do gradiente do cartão | `cartoes.html` |
| **InvestSummaryCards** | 3 KPIs: Total Investido, Valor Atual, Rendimento Total (R$ e %) | `investimentos.html` |
| **AlertaDiversificacao** | Banner âmbar quando um tipo >60% do portfólio | `investimentos.html` (style.cssText) |
| **ChartAlocacao** | Doughnut Chart.js de alocação por tipo — instância reutilizável (BUG 17) | `investimentos.html` |
| **LegendaAlocacao** | Legenda inline com cor, emoji, tipo, %, valor | `investimentos.html` (criado via JS) |
| **CotacoesGrid** | 3 cards de cotação (USD, EUR, BTC) via AwesomeAPI com variação % | `investimentos.html` (criado via JS) |
| **IndicadoresReferencia** | 4 cards Selic/CDI/IPCA/Poupança — valores de referência (BENCHMARKS centralizado) | `investimentos.html` (criado via JS) |
| **InvItem** | Card de investimento: emoji+tipo, nome, corretora+liquidez, badges CDI/IPCA, valor atual, rendimento % | `investimentos.html` (criado via JS) |
| **ModalInvestimento** | Modal criar/editar: tipo (dropdown emoji), nome, corretora, valor+valorAtual, preview rendimento, liquidez, datepicker aporte+vencimento | `investimentos.html` |
| **DropdownTipoInvest** | Custom dropdown emoji para 8 tipos de investimento | `investimentos.html` |
| **DropdownLiquidez** | Custom dropdown para 6 opções de liquidez | `investimentos.html` |
| **DatepickerInvest** | Datepicker customizado DEC-018 — instâncias: data aporte + vencimento | `investimentos.html` |

---

## 🧠 Neurônios (Helpers)

| Nome | Cálculo/Tratamento | Quem usa | Status |
|---|---|---|---|
| `budShowToast(msg, tipo)` | Exibe notificação toast (success, error, warning, info) | Todas as páginas | ✅ `bud-utils.js` |
| `budSanitize(str)` | Strip HTML tags + trim — anti-XSS | Todas as páginas | ✅ `bud-utils.js` |
| `budEscapeHTML(str)` | Escape COMPLETO (incl. aspas, backtick) — uso em onclick/atributos | `dividas.js`, `investimentos.js`, `limites.js` (fallback) | ✅ `bud-utils.js` (27/04/2026) |
| `budFormatarValor(v, opts)` | Formata número como moeda BRL (consolidação de duplicatas) | helpers global | ✅ `bud-utils.js` (27/04/2026) |
| `budPluralize(n, sing, plur)` | Pluralização PT-BR ("1 transação" / "2 transações") | helpers global | ✅ `bud-utils.js` (27/04/2026) |
| `budLog/budWarn/budError` | Console wrappers que silenciam em produção | `extrato.js`, `dividas.js`, `investimentos.js`, `recorrentes.js`, `limites.js`, `categorias.js` | ✅ `bud-utils.js` (27/04/2026) |
| `budStorage.{get,set,remove}` | localStorage wrapper try/catch (Safari private mode) | helpers global | ✅ `bud-utils.js` (27/04/2026) |
| `budGetUrlParam(name)` | URLSearchParams seguro (try/catch) | helpers global | ✅ `bud-utils.js` (27/04/2026) |
| `BUD_IS_DEV` | Flag boolean: hostname é localhost/127.0.0.1/.local | helpers global | ✅ `bud-utils.js` (27/04/2026) |
| `budCalcStrength(pw)` | Calcula força da senha (0-4) | `cadastro.js`, `acao-auth.js`, `trocar-senha.js` | ✅ `bud-utils.js` |
| `BUD_SENHAS_COMUNS` | Blocklist de senhas fracas comuns | `cadastro.js`, `acao-auth.js`, `trocar-senha.js` | ✅ `bud-utils.js` |
| `buscarEmailPorMatricula(matricula)` | Consulta Firestore → retorna email ou null | `index.js` | ✅ `index.js` |
| `showEmailVerificationModal()` | Modal (style.cssText) para reenvio de verificação | `index.js` | ✅ `index.js` (wired) |
| `verificarForca(senha)` / `calcStrength(pw)` | ~~Local~~ → Migrado para `window.budCalcStrength` | `bud-utils.js` | ✅ `bud-utils.js` |
| `gerarMatricula()` | Gera `BUD-XXXX-XXXX` com crypto.getRandomValues | `cadastro.js` | ✅ `cadastro.js` |
| `gerarCodigoIndicacao()` | Gera 8 chars alfanumérica maiúscula | `cadastro.js` | ✅ `cadastro.js` |
| `validarCodigoIndicacao(codigo)` | Query Firestore → retorna {uid, nome} ou null | `cadastro.js` | ✅ `cadastro.js` |
| `getRecaptchaToken()` | Placeholder reCAPTCHA v3 — retorna token ou __DEV_SKIP__ | `cadastro.js` | ✅ `cadastro.js` |
| `enviarEmailBoasVindas(...)` | Fire-and-forget welcome email via EmailJS (sem senha) | `cadastro.js` | ✅ `cadastro.js` |
| `isEmailValido(email)` | Regex básica de email | `cadastro.js`, `recuperar-senha.js` | ✅ |
| `gerarSenhaTemp()` | ~~Gera senha temporária~~ | — | ❌ REMOVIDO (user escolhe senha) |
| `getIniciais(nome)` | Retorna iniciais (2 letras) do nome completo | `dashboard.js` | ✅ `dashboard.js` |
| `formatarValor(valor)` | Formata número como moeda BRL (R$) | `dashboard.js` | ✅ `dashboard.js` |
| `getSaudacao()` | Retorna Bom dia/Boa tarde/Boa noite por horário | `dashboard.js` | ✅ `dashboard.js` |
| `configurarBannerPlano(userData)` | Configura banner trial/free/pago | `dashboard.js` | ✅ `dashboard.js` |
| `abrirModal(tipo)` | Abre TransactionModal para criação de receita/despesa; reseta transacaoEditandoId; bloqueia se trial expirado | `dashboard.js` | ✅ `dashboard.js` |
| `abrirModalEditar(transacaoId)` | Abre TransactionModal em modo edição com pre-fill de campos; bloqueia se trial expirado | `dashboard.js` | ✅ `dashboard.js` |
| `fecharModal()` | Fecha TransactionModal e reseta transacaoEditandoId | `dashboard.js` | ✅ `dashboard.js` |
| `atualizarModalTipo(tipo)` | Alterna estilo/labels/categorias do modal; título "Editar" se transacaoEditandoId | `dashboard.js` | ✅ `dashboard.js` |
| `aplicarMascaraValor(input)` | Máscara de moeda BRL no input de valor | `dashboard.js` | ✅ `dashboard.js` |
| `handleSubmitLancamento(e)` | Valida, sanitiza e persiste transação — updateDoc se editando, addDoc se criando | `dashboard.js` | ✅ `dashboard.js` |
| `pedirConfirmacaoExcluir()` | Abre mini-modal de confirmação de exclusão | `dashboard.js` | ✅ `dashboard.js` |
| `fecharConfirmExcluir()` | Fecha mini-modal de confirmação | `dashboard.js` | ✅ `dashboard.js` |
| `confirmarExclusao()` | Executa deleteDoc e fecha modais | `dashboard.js` | ✅ `dashboard.js` |
| `abrirHistorico()` | Abre modal de histórico completo do mês | `dashboard.js` | ✅ `dashboard.js` |
| `fecharHistorico()` | Fecha modal de histórico | `dashboard.js` | ✅ `dashboard.js` |
| `renderizarHistorico()` | Renderiza todas as transações do mês selecionado no modal de histórico | `dashboard.js` | ✅ `dashboard.js` |
| `renderizarDashboard()` | Recalcula saldo/entradas/saídas para o mês selecionado e atualiza cards + label de navegação | `dashboard.js` | ✅ `dashboard.js` |
| `renderizarGraficos(transacoes)` | Agrega despesas por categoria e renderiza doughnut Chart.js; destrói instância anterior antes de criar nova | `dashboard.js` | ✅ `dashboard.js` |
| `setupListeners(uid)` | Inicia onSnapshot de transações (orderBy+limit) | `dashboard.js` | ✅ `dashboard.js` |
| `cleanupListeners()` | Desregistra todos os onSnapshot ativos | `dashboard.js` | ✅ `dashboard.js` |
| `setupSidebar()` [cfg] | Sidebar colapsável + hambúrguer, mesmo padrão do dashboard | `configuracoes.js` | ✅ `configuracoes.js` |
| `setupTabs()` | Alterna abas Perfil/Personalização/Segurança | `configuracoes.js` | ✅ `configuracoes.js` |
| `carregarPerfil(user)` | Preenche campos de perfil (Auth + Firestore), aplica tema salvo | `configuracoes.js` | ✅ `configuracoes.js` |
| `salvarNome()` | updateProfile (Auth) + updateDoc (Firestore) + atualiza sidebar imediatamente | `configuracoes.js` | ✅ `configuracoes.js` |
| `exportarCSV()` | Busca todas as transações via getDocs, gera CSV UTF-8 BOM e dispara download | `configuracoes.js` | ✅ `configuracoes.js` |
| `renderThemeBubbles()` | Renderiza bubbles de tema em #cfgThemeBubbles | `configuracoes.js` | ✅ `configuracoes.js` |
| `atualizarIndicadorTema()` | Atualiza dot + label do tema ativo | `configuracoes.js` | ✅ `configuracoes.js` |
| `setupSeguranca()` [cfg] | POST /reset-senha via backend (mesmo fluxo de recuperar-senha.js); logout handlers | `configuracoes.js` | ✅ `configuracoes.js` |
| `setupSidebar()` [metas] | Sidebar colapsável + hambúrguer, mesmo padrão do dashboard | `metas.js` | ✅ `metas.js` |
| `setupListeners()` [metas] | onSnapshot metas (orderBy criadoEm desc) + onSnapshot carteiras | `metas.js` | ✅ `metas.js` |
| `cleanupListeners()` [metas] | Desregistra listeners _metaListenerUnsubscribe + _carteiraListenerUnsubscribe | `metas.js` | ✅ `metas.js` |
| `renderMetas()` | Renderiza grid de MetaCards com barra de progresso animada, badges, sugestão de aporte | `metas.js` | ✅ `metas.js` |
| `renderSummary()` | Atualiza 4 summary cards (ativas/guardado/falta/progresso) | `metas.js` | ✅ `metas.js` |
| `abrirModalNova()` | Reseta form e abre modal meta em modo criação | `metas.js` | ✅ `metas.js` |
| `abrirModalEditar(id)` | Pre-fill form + desabilita valorAtual + abre modal em modo edição | `metas.js` | ✅ `metas.js` |
| `fecharModalMeta()` | Fecha modal e fecha calendário datepicker de prazo | `metas.js` | ✅ `metas.js` |
| `handleSubmitMeta(e)` | Valida, budSanitize nome, addDoc (nova) ou updateDoc (editar); valorAtual só em criação | `metas.js` | ✅ `metas.js` |
| `abrirModalAporte(metaId)` | Abre modal aporte, popula dropdown carteiras, reseta datepicker data para hoje | `metas.js` | ✅ `metas.js` |
| `fecharModalAporte()` | Fecha modal aporte e fecha select/datepicker abertos | `metas.js` | ✅ `metas.js` |
| `popularDropdownCarteiras()` | Filtra carteiras (tipo != 'credito') e popula custom select | `metas.js` | ✅ `metas.js` |
| `handleSubmitAporte(e)` | writeBatch: update meta.valorAtual + set transacao + decrement carteira.saldo; depois addDoc depositos | `metas.js` | ✅ `metas.js` |
| `abrirHistorico(metaId)` | getDocs depositos orderBy dataCriacao desc e renderiza lista | `metas.js` | ✅ `metas.js` |
| `fecharHistorico()` | Fecha modal histórico | `metas.js` | ✅ `metas.js` |
| `confirmarExclusao(metaId)` | Abre mini-modal inline via style.cssText para confirmação | `metas.js` | ✅ `metas.js` |
| `excluirMeta(metaId)` | writeBatch: delete depositos + delete transações vinculadas (origem='meta') + delete meta doc | `metas.js` | ✅ `metas.js` |
| `setupDatepicker({...})` | Factory de datepicker customizado — usado para prazo (metas) e data (aporte) | `metas.js` | ✅ `metas.js` |
| `setupCarteiraSelect()` | Toggle e fechar ao clicar fora do custom select de carteira | `metas.js` | ✅ `metas.js` |
| `dispararConfetti()` | 50 peças animadas confettiDrop ao atingir 100% de progresso | `metas.js` | ✅ `metas.js` |
| `calcSugestaoAporte(prazo, falta)` | Calcula sugestão de aporte: ≤7d → restante; ≤30d → semanal; else → mensal | `metas.js` | ✅ `metas.js` |
| `getBadge(pct)` | Retorna {emoji,label,bg,color} do badge de gamificação baseado em % progresso | `metas.js` | ✅ `metas.js` |
| `maskBRL(input)` / `parseBRL(str)` / `formatBRL(val)` | Helpers de formatação BRL para campos de valor das metas | `metas.js` | ✅ `metas.js` |
| `setupSidebar()` [cartoes] | Sidebar colapsável + hambúrguer, mesmo padrão do dashboard | `cartoes.js` | ✅ `cartoes.js` |
| `setupListeners()` [cartoes] | onSnapshot carteira (tipo:'credito') + transacoes (limit 5000) + categorias | `cartoes.js` | ✅ `cartoes.js` |
| `cleanupListeners()` [cartoes] | Desregistra todos os onSnapshot (array unsubs) | `cartoes.js` | ✅ `cartoes.js` |
| `calcularFatura(cartaoId, mesKey)` | Soma transações do cartão no mês; exclui estornado/cancelado e pagamentoFatura — sem denormalização (DEC-034) | `cartoes.js` | ✅ `cartoes.js` |
| `calcularStatusFatura(cartao, mesKey, temGastos)` | Retorna {label,cor,bg}: Paga/Vencida/Fechada/Aberta baseado em mesKey vs hoje + fechamento/vencimento | `cartoes.js` | ✅ `cartoes.js` |
| `renderizarCartoes()` | Mostra/oculta grid/empty/loading, atualiza banner, constrói card elements | `cartoes.js` | ✅ `cartoes.js` |
| `atualizarBanner(dadosCartoes)` | Atualiza #totalFaturas, #limiteDisponivel, #faturasPagasCount | `cartoes.js` | ✅ `cartoes.js` |
| `buildCartaoEl(...)` | Constrói DOM completo do CartaoWrapper com eventos inline (style, não classes) | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalCartao(id)` / `fecharModalCartao()` | Abre/fecha modal Novo/Editar Cartão com pre-fill | `cartoes.js` | ✅ `cartoes.js` |
| `handleSubmitCartao(e)` | addDoc/updateDoc em carteira com tipo:'credito'; validação de limite de plano | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalGasto(cartaoId, gastoObj)` / `fecharModalGasto()` | Abre modal de registro/edição de gasto. Dual-mode: sem gastoObj=novo, com gastoObj=edição (pré-preenche, esconde parcelamento) | `cartoes.js` | ✅ `cartoes.js` |
| `handleSubmitGasto(e)` | Edit: updateDoc. Novo com parcelas: N addDoc distribuindo valor entre meses. Novo sem parcelas: 1 addDoc. | `cartoes.js` | ✅ `cartoes.js` |
| `editarGasto(gastoId)` | getDoc → abrirModalGasto(cartaoId, gastoObj) em modo edição | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalStatusGasto(id, desc, statusAtual)` / `fecharModalStatusGasto()` | Abre modal Estornar/Cancelar/Reativar; mostra botões corretos baseado em statusAtual | `cartoes.js` | ✅ `cartoes.js` |
| `confirmarStatusGasto(novoStatus)` | updateDoc status do gasto; toast de confirmação | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalImportIA(cartaoId)` / `fecharModalImportIA()` | Abre/fecha modal de importação IA | `cartoes.js` | ✅ `cartoes.js` |
| `onArquivoIAChange(e)` | Detecta OFX por extensão (📋 icon) vs PDF/imagem (📄 icon); atualiza button text | `cartoes.js` | ✅ `cartoes.js` |
| `enviarParaIA()` | OFX/QFX → processarOFXLocal; PDF/imagem → POST /api/extrair-fatura (FormData, 45s timeout) | `cartoes.js` | ✅ `cartoes.js` |
| `parseOFXLocal(text)` | Parser client-side de OFX/QFX (SGML e XML). Extrai TRNTYPE/DTPOSTED/TRNAMT/MEMO/NAME | `cartoes.js` | ✅ `cartoes.js` |
| `processarOFXLocal(file)` | Lê arquivo OFX como texto → parseOFXLocal → processarItensIA → abrirModalReviewIA | `cartoes.js` | ✅ `cartoes.js` |
| `processarItensIA(itens)` | Detecta status (estornado/cancelado), regex parcelamento, chama detectarCategoriaIA | `cartoes.js` | ✅ `cartoes.js` |
| `detectarCategoriaIA(desc)` | 18+ categorias, 200+ keywords para auto-categorização de transações | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalReviewIA()` / `renderListaReviewIA()` / `atualizarResumoReviewIA()` | Abre modal de revisão; renderiza lista editável; atualiza total/count | `cartoes.js` | ✅ `cartoes.js` |
| `salvarTransacoesIA()` | addDoc para cada transação selecionada na review | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalPagarFatura(cartaoId, fatura)` | Abre modal de confirmação de pagamento/desfazimento; detecta estado atual | `cartoes.js` | ✅ `cartoes.js` |
| `confirmarPagarFatura()` | Toggle faturasPagas[mesKey] em updateDoc | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalExcluirCartao(id, nome)` / `confirmarExcluirCartao()` | writeBatch: getDocs transacoes + delete cartão + todas transações (cascade) | `cartoes.js` | ✅ `cartoes.js` |
| `abrirModalExcluirGasto(id, desc)` / `confirmarExcluirGasto()` | deleteDoc transacoes | `cartoes.js` | ✅ `cartoes.js` |
| `setupBandeiraSelect()` | Custom select dropdown para bandeira do cartão | `cartoes.js` | ✅ `cartoes.js` |
| `setupCatGastoSelect()` / `atualizarDropdownCategorias()` | Custom select categoria; mescla CATEGORIAS_PADRAO + categoriasGlobal do Firestore | `cartoes.js` | ✅ `cartoes.js` |
| `setupCorPicker()` | 10 pills de cor; atualiza hiddenCor e visual | `cartoes.js` | ✅ `cartoes.js` |
| `setupDatepickerGasto()` / `renderCalendarioGasto()` | Datepicker customizado para data do gasto (DEC-018) | `cartoes.js` | ✅ `cartoes.js` |
| `maskBRL/parseBRL/formatBRL` [cartoes] | Helpers de formatação BRL para limite e valor de gasto | `cartoes.js` | ✅ `cartoes.js` |
| `escHtml(str)` [cartoes] | Anti-XSS: escapa &<>"' em conteúdo dinâmico | `cartoes.js` | ✅ `cartoes.js` |
| `showToast(msg, tipo)` [cartoes] | Toast inline (sem bud-utils.js) com fadeInUp | `cartoes.js` | ✅ `cartoes.js` |
| `showSection(section)` | Alterna visibilidade entre estados visuais | `acao-auth.js`, `trocar-senha.js` | ✅ |
| `calcStrength(pw)` [acao-auth] | ~~Local~~ → Migrado para `window.budCalcStrength` | `bud-utils.js` | ✅ `bud-utils.js` |
| `calcStrength(pw)` [trocar-senha] | ~~Local~~ → Migrado para `window.budCalcStrength` | `bud-utils.js` | ✅ `bud-utils.js` |

---

## 🔄 Reflexos (Hooks / Event Listeners)

| Nome | Estado que gerencia | Store que consome |
|---|---|---|
| `onAuthStateChanged` | Sessão do usuário (logado/deslogado) | Firebase Auth |
| `keypress Enter → identificador` | Foca campo senha | DOM (`index.html`) ✅ |
| `keypress Enter → senha` | Dispara click no btnLogin | DOM (`index.html`) ✅ |
| `click → btnLogin` | Fluxo de login completo | Firebase Auth + Firestore ✅ |
| `onAuthStateChanged (dashboard)` | Auth guard: !user → redirect login; primeiroLogin → redirect trocar-senha | Firebase Auth ✅ |
| `click → btnLogout` | signOut + cleanup listeners + redirect login | Firebase Auth ✅ |
| `click → btnToggleValues` | Alterna visibilidade de valores (persiste localStorage) | DOM (`dashboard.html`) ✅ |
| `click → btnSync` | Re-cria listeners para forçar re-fetch real do Firestore | Firestore ✅ |
| `click → btnHamburger` | Abre/fecha sidebar mobile com overlay | DOM (`dashboard.html`) ✅ |
| `click → btnSidebarCollapse` | Colapsa/expande sidebar no desktop (64px ↔ 260px); persiste `localStorage.bud_sidebar_collapsed`; ignora no mobile | DOM (`dashboard.html`) ✅ |
| `onSnapshot → transacoes` | Atualiza transacoesGlobais[] e re-renderiza dashboard | Firestore ✅ |
| `click → btnMesAnterior` | Decrementa mesVisualizado (com wraparound jan→dez) e re-renderiza | DOM ✅ |
| `click → btnProximoMes` | Incrementa mesVisualizado (com wraparound dez→jan) e re-renderiza | DOM ✅ |
| `click → btnNovaReceita` | Abre TransactionModal pré-selecionado como Receita | DOM ✅ |
| `click → btnNovaDespesa` | Abre TransactionModal pré-selecionado como Despesa | DOM ✅ |
| `click → tipoBtnReceita/Despesa` | Troca tipo dentro do modal (atualizarModalTipo) | DOM ✅ |
| `input → inputValor` | Aplica máscara de moeda em tempo real | DOM ✅ |
| `submit → formLancamento` | handleSubmitLancamento: valida + salva no Firestore | Firestore ✅ |
| `keydown Escape` | Fecha modal se aberto | DOM ✅ |
| `click → overlay modal` | Fecha modal ao clicar fora do card | DOM ✅ |
| `click → toggleSenha` | Alterna password/text no input | DOM (`index.html`) ✅ |
| `submit → formLogin` | Previne submit e dispara login | DOM (`index.html`) ✅ |
| `submit → formCadastro` | Validação + criação Auth + Firestore doc | DOM (`cadastro.html`) ✅ |
| `submit → formRecuperar` | Valida email + POST /reset-senha | DOM (`recuperar-senha.html`) ✅ |
| `input → novaSenha (cadastro)` | Atualiza indicador de força (4 barras) | DOM (`cadastro.html`) ✅ |
| `input → telefone` | Máscara BR (XX) XXXXX-XXXX | DOM (`cadastro.html`) ✅ |
| `click → toggleNovaSenha/Confirmar` | Alterna password/text | DOM (`cadastro.html`) ✅ |
| `click → btnSalvarNome` | salvarNome(): updateProfile + updateDoc + atualiza sidebar | DOM (`configuracoes.html`) ✅ |
| `click → btnExportarCSV` | exportarCSV(): getDocs + gera Blob CSV + dispara download | DOM (`configuracoes.html`) ✅ |
| `click → btnResetSenha` | POST BUD_FUNCTIONS_URL/reset-senha com email do usuário logado | DOM (`configuracoes.html`) ✅ |
| `click → btnLogout / btnLogoutSeg` | signOut + redirect index.html | DOM (`configuracoes.html`) ✅ |
| `bud:themechange` [cfg] | updateDoc temaEscolhido + atualizarIndicadorTema | CustomEvent (`configuracoes.js`) ✅ |
| `onAuthStateChanged (configuracoes)` | Auth guard: !user \| !emailVerified → redirect login | Firebase Auth ✅ |
| `onAuthStateChanged (metas)` | Auth guard: !user \| !emailVerified \| getIdToken(true) → redirect login | Firebase Auth ✅ |
| `onSnapshot → metas` | Atualiza metasGlobal[] e re-renderiza grid + summary cards | Firestore ✅ |
| `onSnapshot → carteiras` | Atualiza carteirasGlobal[] para popular dropdown no modal aporte | Firestore ✅ |
| `click → btnNovaMeta` | Abre modal meta em modo criação | DOM (`metas.html`) ✅ |
| `submit → formMeta` | handleSubmitMeta: validação + addDoc/updateDoc | DOM (`metas.html`) ✅ |
| `submit → formAporte` | handleSubmitAporte: validação + writeBatch + addDoc deposito | DOM (`metas.html`) ✅ |
| `click → btnAportar (MetaCard)` | abrirModalAporte com id e nome da meta | DOM (`metas.html`) ✅ |
| `click → btnHistorico (MetaCard)` | abrirHistorico com id e nome da meta | DOM (`metas.html`) ✅ |
| `click → btnEdit (MetaCard)` | abrirModalEditar com id da meta | DOM (`metas.html`) ✅ |
| `click → btnDel (MetaCard)` | confirmarExclusao com id e nome da meta | DOM (`metas.html`) ✅ |
| `click → emoji-btn` | Seleciona emoji e atualiza #emojiSelecionado | DOM (`metas.html`) ✅ |
| `click → sugestao-chip` | Preenche input nome com sugestão popular | DOM (`metas.html`) ✅ |
| `click → dp-trigger (prazo/aporte)` | Abre/fecha datepicker customizado | DOM (`metas.html`) ✅ |
| `click → dp-day` | Seleciona data, atualiza label e hidden input | DOM (`metas.html`) ✅ |
| `click → carteiraSelectTrigger` | Abre/fecha dropdown de carteiras | DOM (`metas.html`) ✅ |
| `keydown Escape (metas)` | Fecha modais em ordem: histórico > aporte > meta | DOM (`metas.html`) ✅ |
| `onAuthStateChanged (cartoes)` | Auth guard: !user \| !emailVerified \| getIdToken(true) → redirect login | Firebase Auth ✅ |
| `onSnapshot → carteira (tipo:'credito')` | Atualiza cartoesGlobal[] e re-renderiza | Firestore ✅ |
| `onSnapshot → transacoes (cartoes)` | Atualiza transacoesGlobal[] e re-renderiza | Firestore ✅ |
| `onSnapshot → categorias (cartoes)` | Atualiza categoriasGlobal[] e popula dropdown categoria | Firestore ✅ |
| `click → btnNovoCartao` | abrirModalCartao() em modo criação | DOM (`cartoes.html`) ✅ |
| `click → btnNovoCartaoEmpty` | abrirModalCartao() no estado empty | DOM (`cartoes.html`) ✅ |
| `submit → formCartao` | handleSubmitCartao: valida + addDoc/updateDoc em carteira | DOM (`cartoes.html`) ✅ |
| `click → data-add-gasto` | abrirModalGasto(cartaoId) | DOM (`cartoes.html`) ✅ |
| `submit → formGasto` | handleSubmitGasto: valida + addDoc em transacoes | DOM (`cartoes.html`) ✅ |
| `click → data-pagar` | abrirModalPagarFatura(cartaoId, fatura) | DOM (`cartoes.html`) ✅ |
| `click → btnConfirmarPagarFatura` | confirmarPagarFatura: toggle faturasPagas[mesKey] | DOM (`cartoes.html`) ✅ |
| `click → data-del-cartao` | abrirModalExcluirCartao(id, nome) | DOM (`cartoes.html`) ✅ |
| `change → checkConfirmarExclusaoCartao` | Habilita/desabilita btnConfirmarExcluirCartao | DOM (`cartoes.html`) ✅ |
| `click → btnConfirmarExcluirCartao` | confirmarExcluirCartao: writeBatch cascade delete | DOM (`cartoes.html`) ✅ |
| `click → data-gasto-id` | abrirModalExcluirGasto(id, desc) | DOM (`cartoes.html`) ✅ |
| `click → btnConfirmarExcluirGasto` | confirmarExcluirGasto: deleteDoc | DOM (`cartoes.html`) ✅ |
| `click → data-toggle-gastos` | Abre/fecha lista de gastos do cartão | DOM (`cartoes.html`) ✅ |
| `click → data-edit-id` | abrirModalCartao(id) em modo edição | DOM (`cartoes.html`) ✅ |
| `click → btnMesAnterior (cartoes)` | Decrementa mesVisualizando e re-renderiza | DOM (`cartoes.html`) ✅ |
| `click → btnProximoMes (cartoes)` | Incrementa mesVisualizando e re-renderiza | DOM (`cartoes.html`) ✅ |
| `keydown Escape (cartoes)` | Fecha modais em ordem: excluirCartao > excluirGasto > pagarFatura > modalCartao > modalGasto | DOM (`cartoes.html`) ✅ |
| `click → .cfg-tab-btn` | Alterna visibilidade das tab panels + active state | DOM (`configuracoes.html`) ✅ |
| `submit → formResetSenha` | Valida senha + confirmPasswordReset(oobCode) | DOM (`acao-auth.html`) ✅ |
| `input → novaSenha (acao-auth)` | Atualiza indicador de força (4 barras) | DOM (`acao-auth.html`) ✅ |
| `click → toggleNovaSenha/Confirmar (acao-auth)` | Alterna password/text | DOM (`acao-auth.html`) ✅ |
| `onAuthStateChanged (trocar-senha)` | Verifica Auth + primeiroLogin Firestore | Firebase Auth ✅ |
| `submit → formTrocarSenha` | Valida senha + updatePassword + updateDoc | DOM (`trocar-senha.html`) ✅ |
| `input → novaSenha (trocar-senha)` | Atualiza indicador de força (4 barras) | DOM (`trocar-senha.html`) ✅ |
| `click → toggleNovaSenha/Confirmar (trocar-senha)` | Alterna password/text | DOM (`trocar-senha.html`) ✅ |

---

## 🧬 DNA (Data Schemas)

### Collection: `usuarios`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Nome completo |
| `email` | string | ✅ | Email do usuário |
| `telefone` | string | ✅ | WhatsApp |
| `matricula` | string | ❌ | Matrícula (BUD-XXXX ou NEX-XXXX) |
| `plano` | string | ✅ | `trial`, `free`, `starter`, `pro`, `plus` |
| `primeiroLogin` | boolean | ✅ | `false` no cadastro atual (DEC-009). Reservado `true` para contas criadas por admin |
| `emailVerified` | boolean | ✅ | Se verificou email |
| `emailVerificationRequired` | boolean | ✅ | Se precisa verificar email |
| `bloqueado` | boolean | ✅ | Se conta está bloqueada |
| `dataCadastro` | timestamp | ✅ | Data de criação |
| `codigoIndicacao` | string | ✅ | Código único 8 chars (gerado) |
| `indicadoPor` | object/null | ❌ | `{codigo, uid, nome}` |
| `descontoIndicacao` | number | ❌ | 30 (%) — se veio indicação |
| `descontoIndicacaoUsado` | boolean | ❌ | Se já usou desconto |
| `lgpdConsentimento` | boolean | ✅ | Consentimento LGPD |
| `lgpdConsentimentoData` | timestamp | ✅ | serverTimestamp() |
| `lgpdVersaoPolitica` | string | ✅ | Versão da política aceita |
| `temaEscolhido` | string | ❌ | Chave do tema ativo (`padrao`, `hbo`, `azul`, `roxo`, `rosa`, `amarelo`, `verde`, `vermelho`) |
| `funcionalidades` | object | ✅ | Feature flags |
| `role` | string | ❌ | `admin` para administradores |

### Subcollection: `usuarios/{uid}/indicacoes/{indicadoUid}`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Nome do indicado |
| `email` | string | ✅ | Email do indicado |
| `data` | timestamp | ✅ | serverTimestamp() |
| `assinouPlano` | boolean | ✅ | Se ativou plano pago |

### Subcollection: `usuarios/{uid}/metas/{metaId}`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Nome do objetivo (budSanitize antes de salvar) |
| `emoji` | string | ✅ | Emoji de ícone selecionado |
| `valorAlvo` | number | ✅ | Valor alvo em centavos/float BRL |
| `valorAtual` | number | ✅ | Valor já guardado (atualizado via aporte, nunca direto em edição) |
| `prazo` | string/null | ❌ | Data ISO `YYYY-MM-DD` — prazo opcional |
| `criadoEm` | timestamp | ✅ | serverTimestamp() |
| `atualizadoEm` | timestamp | ✅ | serverTimestamp() |

### Sub-subcollection: `usuarios/{uid}/metas/{metaId}/depositos/{depId}` (DEC-033)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `valor` | number | ✅ | Valor aportado em BRL |
| `data` | string | ✅ | Data escolhida pelo usuário `YYYY-MM-DD` |
| `carteiraId` | string | ✅ | ID da carteira debitada |
| `dataCriacao` | timestamp | ✅ | serverTimestamp() — timestamp de auditoria |

### Subcollection: `usuarios/{uid}/investimentos/{id}`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Nome ou ticker do investimento |
| `tipo` | string | ✅ | `Renda Fixa` / `Ações` / `FIIs` / `Cripto` / `Poupança` / `CDB` / `Tesouro Direto` / `Outro` |
| `corretora` | string | ❌ | Corretora ou banco |
| `valor` | number | ✅ | Valor aportado (R$) |
| `valorAtual` | number | ✅ | Valor atual estimado (R$) |
| `rendimento` | number | ✅ | Rendimento calculado (%) = (valorAtual - valor) / valor |
| `liquidez` | string | ❌ | `Diária` / `No vencimento` / `30 dias` / `60 dias` / `90 dias` / `Sem liquidez` |
| `vencimento` | string | ❌ | Data de vencimento `YYYY-MM-DD` |
| `data` | string | ❌ | Data do aporte `YYYY-MM-DD` |
| `criadoEm` | timestamp | ✅ | serverTimestamp() |
| `atualizadoEm` | timestamp | ✅ | serverTimestamp() |

### Collection: `chamados`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tipo` | string | ✅ | `bug` ou `sugestao` |
| `descricao` | string | ✅ | Descrição do chamado |
| `uid` | string | ✅ | UID do usuário que reportou |
| `status` | string | ✅ | `aberto`, `em_andamento`, `resolvido` |
| `dataCriacao` | timestamp | ✅ | Data de criação |

---

## 🗺️ Caminhos (Routing)

| Rota | Componente/Página | URL | Observação |
|---|---|---|---|
| `/` | Login | `index.html` | Página inicial |
| `/cadastro` | Sign-up | `cadastro.html` | Novo usuário |
| `/recuperar-senha` | Recuperar senha | `recuperar-senha.html` | Solicitar reset |
| `/acao-auth` | Processar reset | `acao-auth.html` | ✅ Recebe `?oobCode=` — 4 estados visuais |
| `/trocar-senha` | Trocar senha | `trocar-senha.html` | ✅ Guard: Auth + `primeiroLogin: true` |
| `/dashboard` | Dashboard | `dashboard.html` | ✅ Auth guard + primeiroLogin guard + sidebar + 3 cards + trial banner |
| `/configuracoes` | Configurações | `configuracoes.html` | ✅ Auth guard + emailVerified guard + 3 abas (Perfil, Personalização, Segurança) |
| `/metas` | Metas Financeiras | `metas.html` | ✅ Auth guard + emailVerified guard + sidebar + 4 summary cards + grid metas + 3 modais |
| `/investimentos` | Investimentos | `investimentos.html` | ✅ Auth guard + emailVerified guard + sidebar + 3 KPIs + doughnut chart + cotações AwesomeAPI + CRUD |
| `/mercado` | Compras de Mercado | `mercado.html` | ✅ Auth guard + sidebar + 2 abas (Compras / Listas) + 4 KPIs do mês + lista paginada + histórico de variação de preços + Modo Compras (rascunho auto-salvo) + **Importação por IA (Foto/PDF/Texto, multi-foto, review editável, aprendizado por CNPJ e por item, quota mensal por plano)** — sem feature gate |
| `/limites` | Limites de Gastos | `limites.html` | ✅ Auth guard + sidebar + feature gate Plus para "Copiar do Mês Anterior" |
| `/investimentos` | Investimentos | `investimentos.html` | ✅ Auth guard + emailVerified guard + sidebar + 3 KPIs + doughnut chart + cotações AwesomeAPI + CRUD + feature gate Plus |
| `/balanco-mensal` | Balanço Mensal | `balanco-mensal.html` | ✅ Auth guard + emailVerified guard + paywall Plus + 3 KPIs + comparativo + ranking categorias + dia-a-dia |
| `/comparativo` | Comparativo de Meses | `comparativo.html` | ✅ Auth guard + emailVerified guard + paywall Plus + 2 meses lado a lado + KPI cards + Chart.js barras agrupadas + top-10 categorias |
| `/graficos` | Gráficos | `graficos.html` | ✅ Auth guard + emailVerified guard + paywall Pro + 4 charts Chart.js (Doughnut, Bar, Line, Bar diário) + 4 KPIs + nav meses |
| `/relatorios` | Central de Relatórios | `relatorios.html` | ✅ Auth guard + emailVerified guard + paywall advancedDashboard + interface 3 abas (Resumo / Gráficos / Detalhamento) + 3 KPIs + 4 charts Chart.js + insight automático + tendência 6 meses single-pass + detalhamento com barras hex |
| `/insights` | Insights e Análises | `insights.html` | ✅ Auth guard + paywall dailySpendAverage (Plus) + 2 abas (Análises / Comparativo) + score saúde IA + alertas automáticos + simulador projeção + resumo semanal + oportunidades economia + comparativo 2 meses (Chart.js grouped bar) + FCM push |
| `/admin` | Painel admin | `admin.html` | `role: admin` |
| `/politica-privacidade` | LGPD | `politica-privacidade.html` | Termos |

---

## 🫀 Órgãos (Services)

| Nome | Tipo | Conexão | Usado por |
|---|---|---|---|
| **Firebase Auth** | Autenticação | `https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js` | Login, cadastro, reset, trocar senha |
| **Firestore** | Banco de dados | `https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js` | Dados de usuário, chamados |
| **EmailJS** | Envio de emails | `https://api.emailjs.com/api/v1.6/email/send` | Reset de senha (via backend), boas-vindas |
| **Backend (Render)** | Express API | `BUD_FUNCTIONS_URL + /reset-senha` | Gera link + envia email de reset server-side |
| **AwesomeAPI** | Câmbio/Cripto | `https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL` | Cache 5 min no cliente; AbortSignal 8s; escapeHTML em todos os valores retornados |
| **Backend (Render)** | Express API | `https://bud-finance-backend.onrender.com/api/extrair-fatura` | POST multipart/form-data (campo `arquivo`). Extrai transações de PDF via pdf-parse+regex ou via Gemini 1.5 Flash (fallback). Retorna `[{desc, valor, data}]`. Deps: multer, pdf-parse. Requer `GEMINI_API_KEY` no Render para imagens. |
| **Backend (Render)** | Express API | `https://bud-finance-backend.onrender.com/api/extrair-cupom` | POST multipart `arquivos[]` (1-3 imagens/PDF, 8MB) **OU** JSON `{texto}`. Extrai cupom fiscal via Groq meta-llama/llama-4-scout-17b-16e-instruct. Retorna `{mercado, cnpj, data, itens:[{nome,qtd,valor,cat}]}`. Cache server-side 24h por SHA-256 (Map TTL, MAX 200). Categorias permitidas: `[Mercado, Padaria/Café, Bares/Baladas, Farmácia, Pets, Material Escolar, Outros]`. Timeouts 30s/25s. |
| **Google Fonts** | Tipografia | `fonts.googleapis.com` (Inter) | Todas as páginas |

---

## 🔗 Mapa de Conexões

```
                    ┌──────────────┐
                    │  Firebase    │
                    │  Auth 10.8.1 │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   index.html        cadastro.html     trocar-senha.html
   (Login)           (Sign-up)         (1º login)
        │                  │                  │
        │    ┌─────────────┼──────────────────┘
        │    │             │
        ▼    ▼             ▼
   ┌──────────────┐  ┌──────────────┐
   │  Firestore   │  │  EmailJS     │
   │  (usuarios)  │  │  (emails)    │
   └──────────────┘  └──────────────┘
        │
        ├── recuperar-senha.html ──→ Cloud Function /reset-senha
        │
        ├── acao-auth.html (processa link do email)
        │
        └── dashboard.html (app principal)
```

---

## 📝 Changelog de Integridade

| Data | Alteração | Autor |
|---|---|---|
| 15/04/2026 | Documento criado com base na spec da tela de login e fluxo de autenticação | Copilot |
| 17/04/2026 | DRY: `calcStrength`+`SENHAS_COMUNS` migrados para `bud-utils.js`. Email verification wired em `index.js`. `primeiroLogin` doc atualizado. `firebase-config.example.js` criado. `css/tailwind.css` placeholder criado. | Copilot |
| 15/04/2026 | Etapa 1 implementada: `index.html`, `js/index.js`, `js/firebase-config.js`, `js/bud-utils.js`. Helpers `budShowToast`, `budSanitize`, `showEmailVerificationModal`, `buscarEmailPorMatricula` ativos. | Copilot |
| 15/04/2026 | Etapa 2 implementada: `cadastro.html`, `js/cadastro.js`, `recuperar-senha.html`, `js/recuperar-senha.js`. Correções: user escolhe senha (sem temp), reCAPTCHA placeholder, serverTimestamp, subcoleção indicações, email verification enforced no login, res.ok check, delayed redirect. | Copilot |
| 15/04/2026 | Etapa 3 implementada: `acao-auth.html` + `js/acao-auth.js` (processar link reset com oobCode, 4 estados visuais), `trocar-senha.html` + `js/trocar-senha.js` (troca obrigatória no 1º login com guard Auth+Firestore, user badge personalizado). DEC-013 e DEC-014 registradas. | Copilot |
| 18/04/2026 | Hardening de segurança: oobCode server-side (backend envia email via EmailJS REST API), limpeza de console.log/error de produção, descrição limitada a 100 chars, overflow-y:auto nas auth pages, cleanupListeners antes de setupListeners, IDs duplicados no DECISIONS_LOG corrigidos (DEC-021/022/023). DEC-024, ERR-014, ERR-015 registrados. | Copilot |
| 21/04/2026 | Tela de Metas implementada: `metas.html` + `js/metas.js`. Grid glassmorphic com progresso animado, badges, sugestão de aporte, confetti. 3 modais (criar/editar, aporte writeBatch, histórico). Emoji picker 120 emojis (deduped via Set), 2× custom datepicker, custom select carteiras (exclu crédito). DEC-033 registrado (sub-subcoleção depositos). Sidebar atualizada em dashboard.html e configuracoes.html. | Copilot |
| 27/04/2026 | Tela de Mercado concluída com IA: `mercado.html` + `js/mercado.js`. Importação de cupom fiscal por IA (Groq meta-llama/llama-4-scout via `/api/extrair-cupom`). Multi-foto (máx 3), toast de cache, datalist sugestões de mercados, 5 melhorias UX. Backend migrado de Gemini para Groq. | Copilot |
| 27/04/2026 | Tela de Balanço Mensal criada: `balanco-mensal.html` + `js/balanco-mensal.js`. 10 bugs do cérebro/balanco-mensal.md corrigidos preventivamente. Sidebar atualizada em 11 páginas com link "Balanço Mensal (Plus)". Novo endpoint `/api/extrair-cupom` atualizado (Groq). Novas collections: `mercados-conhecidos/{cnpj}` + `aprendizado-itens/{itemKey}` (scope: usuario). DEC-021 (setDate(1) antes setMonth) registrado. | Copilot |
| 28/04/2026 | Tela de Comparativo criada: `comparativo.html` + `js/comparativo.js`. 11 bugs do cérebro/comparativo.md corrigidos preventivamente. Chart.js 4.4.1 CDN. Sidebar atualizada em 12 páginas com link "Comparativo (Plus)". ROADMAP: Balanço Mensal → CONCLUÍDO; Comparativo → EM DESENVOLVIMENTO. | Copilot || 27/04/2026 | Tela de Gráficos criada: `graficos.html` + `js/graficos.js`. Fase 2 · Item 3. Plano Pro (evolutionChart). 4 charts: Doughnut categorias, Bar receitas vs despesas, Line tendência 6 meses, Bar diário. 10 bugs do cérebro/graficos.md corrigidos. Sidebar atualizada em 13 páginas com link "Gráficos". ROADMAP: Comparativo → CONCÍUDO; Gráficos → EM DESENVOLVIMENTO. | Copilot |
| 28/04/2026 | Tela de Relatórios criada: `relatorios.html` + `js/relatorios.js`. Fase 2 · Item 4. Interface 3 abas: Resumo (comparativo + categorias + dia-a-dia), Gráficos (4 Chart.js), Detalhamento (barras hex por categoria). 15 bugs do cérebro/relatorios.md corrigidos preventivamente (BUG 1–15). Feature gate: `advancedDashboard`. Firestore query: 6-month range em `transacoes`. Sidebar atualizada em 14 páginas com link 📑 Relatórios. ROADMAP: Gráficos → CONCLUÍDO; Relatórios → CONCLUÍDO. | Copilot |
| 28/04/2026 | Tela de Insights criada: `insights.html` + `js/insights.js`. Fase 2 · Item 5. 2 abas: Análises (alertas IA, economia, resumo semanal, score saúde SVG, insights detalhados, simulador projeção, push FCM) + Comparativo (2 meses com Chart.js grouped bar + categorias). 13 bugs do cérebro/insights.md corrigidos (BUG 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 17). Feature gate: `dailySpendAverage`. Sidebar atualizada em 15 páginas com link 💡 Insights. ROADMAP: Insights → CONCLUÍDO. | Copilot |
| 29/04/2026 | Tela de Carteira criada: `carteira.html` + `js/carteira.js`. Item 16. Hub para contas não-crédito (débito/dinheiro/benefícios). Cards de contas com saldo e ultimaConfirmacao. Importação inline: CSV/OFX/PDF/imagem, preview paginado 25/page, override global tipo/categoria, deduplication por range de meses (BUG#2), writeBatch chunks de 400, snapshot ultimaConfirmacao (BUG#4). Bug#1 (detectarTipo nunca retorna Transferência como tipo), Bug#3 (dedup data+valor+desc30), Bug#8 (AbortController 120s), Bug#10 (REGRAS_CAT unificadas) corrigidos. Sidebar atualizada em 16 páginas: Carteira → link ativo, Importar → removido (DEC-043). ROADMAP: Carteira → CONCLUÍDO. | Copilot |
---

## 📂 Arquivos Implementados

| Arquivo | Status | Descrição |
|---|---|---|
| `index.html` | ✅ | Tela de login — glassmorphism, blobs, splash screen |
| `js/index.js` | ✅ | Lógica de login — Firebase Auth modular, matrícula lookup, modal email, anti-XSS |
| `js/firebase-config.js` | ✅ | Config Firebase via `window.BUD_FIREBASE_CONFIG` (placeholders seguros) |
| `js/bud-utils.js` | ✅ | Toast system (`budShowToast`) + sanitização (`budSanitize`) |
| `cadastro.html` | ✅ | Tela de cadastro — glassmorphism, senha escolhida pelo user, indicador força, LGPD |
| `js/cadastro.js` | ✅ | Criação de conta — Firebase Auth modular, matrícula, reCAPTCHA placeholder, subcoleção indicações |
| `recuperar-senha.html` | ✅ | Tela de recuperação — glassmorphism consistente com login, blobs |
| `js/recuperar-senha.js` | ✅ | POST /reset-senha — res.ok check, delayed redirect 3s, safety timeout 30s |
| `relatorios.html` | ✅ | Central de Relatórios — interface 3 abas (Resumo/Gráficos/Detalhamento), paywall advancedDashboard, 3 KPI cards, pill bar navegação, bottom-sheet mobile, Chart.js 4.4.1. |
| `insights.html` | ✅ | Insights e Análises — 2 abas (Análises/Comparativo), paywall dailySpendAverage, score saúde SVG animado, alertas IA, simulador slider, FCM push, comparativo 2 meses Chart.js. |
| `js/insights.js` | ✅ | ES module. 13 bugs do cérebro corrigidos: BUG 1 (sincronizar re-busca), BUG 2 (query 6 meses range), BUG 3 (getDocs), BUG 4 (filtra pago!==false), BUG 5 (fmt respeita valoresOcultos), BUG 6 (paywall+hideSplash), BUG 7 (shouldDowngrade updateDoc), BUG 8 (variação comp 'novo'), BUG 10 (sem dead charts={}), BUG 11 (semana começa seg), BUG 12 (saldoCarteira-despJaPagas), BUG 13 (sem slideRight), BUG 17 (freq guard getDate>1). Feature gate: NexoPlanos.canUseFeature(userData, 'dailySpendAverage'). |
| `carteira.html` | ✅ | Minhas Contas — hub não-crédito, cards de contas com saldo/ultimaConfirmacao, modal criar/editar/excluir conta, importação inline multi-step (upload→preview→resultado), conciliação snapshot. |
| `js/carteira.js` | ✅ | ES module. Parsers CSV+OFX client-side. detectarTipo (BUG#1 fix). detectarCategoria REGRAS_CAT unificadas (BUG#10 fix). verificarDuplicatas range query (BUG#2+3 fix). confirmarImport writeBatch 400 + snapshot ultimaConfirmacao (BUG#4 fix). AbortController 120s para backend (BUG#8 fix). |
| `js/relatorios.js` | ✅ | ES module. 15 bugs do cérebro/relatorios.md corrigidos: BUG 1 (query 6 meses), BUG 2 (setDate(1) antes setMonth), BUG 3 (filtra pendente+pago), BUG 4 (getDocs), BUG 5 (sincronizarDados re-busca), BUG 6 (downgrade updateDoc), BUG 7 (NaN-safe), BUG 8 (normalizarData Timestamp), BUG 9 (porCatDep separado), BUG 10 (getCatInfo + CORES12 hex), BUG 11 (saldoEl.style.color), BUG 12 (todos os dias do mês preenchidos), BUG 13 (tendência single-pass), BUG 14 (_dadosDirty), BUG 15 (tooltips respeitam valoresOcultos). Feature gate: NexoPlanos.canUseFeature(userData, 'advancedDashboard'). |
| `acao-auth.html` | ✅ | Tela processar reset — glassmorphism, 4 estados (validando/form/sucesso/erro) |
| `js/acao-auth.js` | ✅ | verifyPasswordResetCode + confirmPasswordReset, indicador força, blocklist senhas |
| `trocar-senha.html` | ✅ | Tela troca obrigatória — glassmorphism, user badge (nome+matrícula), 3 estados |
| `js/trocar-senha.js` | ✅ | onAuthStateChanged guard, updatePassword + updateDoc(primeiroLogin:false) |
| `politica-privacidade.html` | ✅ | Página LGPD completa — glassmorphism, conteúdo estático |
| `preview-temas.html` | ✅ | Preview dos 8 temas com CSS custom properties |
| `js/theme-manager.js` | ✅ | Motor de temas — 8 temas, CSS vars em `:root`, `localStorage.bud_theme`, bubbles em `#themeBubbles`, evento `bud:themechange`, `window.budThemeManager`. Expõe `--theme-accent` e `getChartCores()` para uso pelo Chart.js. |
| `dashboard.html` | ✅ | App principal — sidebar colapsável, 3 summary cards, transações, Chart.js, sidebar com links Dashboard + Metas + Configurações |
| `js/dashboard.js` | ✅ | onSnapshot transações, renderDashboard, CRUD modal, Chart.js doughnut |
| `configuracoes.html` | ✅ | Configurações — 3 abas (Perfil, Personalização, Segurança), sidebar com Metas |
| `js/configuracoes.js` | ✅ | carregarPerfil, salvarNome, exportarCSV, renderThemeBubbles, setupSeguranca |
| `metas.html` | ✅ | Metas financeiras — 4 summary cards, grid de metas, 3 modais, emoji picker, datepicker customizado, custom select carteiras |
| `js/metas.js` | ✅ | onSnapshot metas+carteiras, writeBatch aporte, excluirMeta (depositos+transacoes), confetti, datepicker factory, sugestão de aporte mensal |
| `css/tailwind.css` | ⏳ | Pendente — build estático do Tailwind |
| `cartoes.html` | ? | Cart�es de cr�dito � sidebar com Categorias link adicionado |
| `js/cartoes.js` | ? | onSnapshot carteira+transacoes, writeBatch importa��o IA (DT-001 fixed), CRUD cart�o+gasto |
| `categorias.html` | ? | Gest�o de categorias � sidebar Categorias (active), tabs Despesas/Receitas, se��o personalizadas + padr�o, modal criar/editar com emoji picker |
| `js/categorias.js` | ? | ES module. switchTab, renderizarPadrao, carregarPersonalizadas (onSnapshot), salvarCategoria (addDoc/updateDoc + propaga��o rename), deletarCategoria (usage check + deleteDoc), editarCategoria. 9 bugs do c�rebro resolvidos. |
| `js/categorias-padrao.js` | ? | Script não-módulo. Expõe `window.BUD_CATEGORIAS_PADRAO = { despesa:[...49], receita:[...15] }`. Fonte única de verdade de categorias padrão (DEC-036). Deve ser carregado ANTES do módulo JS em qualquer tela que precise da lista. |
| `extrato.html` | ✅ | Extrato completo — nav mês, 3 cards resumo (Receitas/Despesas/Saldo), pills tipo, filtro busca+categoria+export, lista agrupada por dia, modal editar (tipo toggle+datepicker custom+cat dropdown), modal excluir estático |
| `js/extrato.js` | ✅ | ES module. subscribeTransacoes (query por-mês via Timestamps, BUG 2 fix), subscribeAll (flag _dadosCarregados anti-duplo-render BUG 10), renderizarExtrato (grupos por dia, DEC-006 style inline), abrirModalEditar, salvarEdicao, confirmarExclusao, exportarCSV (BOM UTF-8), exportarPDF (iframe BUG 13), datepicker factory no modal, 14 bugs do cérebro resolvidos |
| `recorrentes.html` | ✅ | Transações recorrentes — feature gate (Pro/Plus/Trial), aviso Beta Cloud Functions, 3 cards resumo (Ativas/Despesas mês estimado/Receitas mês estimado), lista de rec-cards com toggle ativo, edit, delete. Modal criar/editar: tipo toggle, valor BRL, custom-select categoria+forma+periodicidade, campo dia (visível só mensal). Modal exclusão via style.cssText (DEC-006). |
| `js/recorrentes.js` | ✅ | ES module. calcPrimeiraData (client, BUG 3 fix — nome distinto do server), salvarRecorrente (BUG 1 fix: só recalcula proximaData se periodicidade/dia mudaram), toggleAtivo, excluirRec (overlay via style.cssText), renderizar (cards animados, estimativa mensal diária×30/semanal×4.3/mensal×1). Feature gate por plano (PLANOS_PERMITIDOS). Usa window.BUD_CATEGORIAS_PADRAO. |
| `dividas.html` | ✅ | Controle de dívidas — Wizard 2 passos (Tipo: 6 tipos; Formato: IA/Juros/Fixas/Livre), 4 KPIs (Ativas/Saldo Devedor/Total Pago/Juros Pagos), barra progresso geral, alertas de vencimento, cards de dívida com barra de progresso individual. 6 modais: modalTipo, modalFormato, modalImportIA (3 abas: Arquivo/Texto/Câmera), modalDivida (form com máscara BRL + data DD/MM/AAAA DEC-018), modalDetalhes (2 abas: Resumo/Parcelas), modalSimulador (2 abas: Extra/Quitar). CDN: PDF.js 3.11.174 + Tesseract.js 5. 25 bugs do cérebro resolvidos de início. |
| `js/dividas.js` | ✅ | ES module. Todos os 25 bugs do cérebro/dividas.md corrigidos de início. calcularSaldoDevedor (Tabela Price real — Bug#15), addMonthsSafe (Bug#10), confirmarAcao helper Promise<bool> style.cssText (Bug#25/DEC-006), classificarContrato (keywords scoring), extrairDadosDoTexto (15 regexes), renderizarParcelas (Bug#18 inline bg), marcarParcelaPaga (Bug#8 out-of-order confirm), desmarcarParcela, simularExtra/calcularResultadoQuitar (Bug#5 saldo real), fmtIA (Bug#20 always visible), _tabAtualDetalhes state (Bug#24), escapeHTML fallback (Bug#23), onSnapshot error callback (Bug#2), orderBy criadoEm desc (Bug#22), _unsubs.forEach antes de redirect (Bug#7). Firestore: usuarios/{uid}/dividas/{dividaId}. |
| `mercado.html` | ✅ | Compras de Mercado — 2 abas (Compras / Listas), 4 KPIs do mês (Total/Qtd/Ticket Médio/Maior Compra), seção Últimas Compras (cards com mercado+data+pagamento+parcelas+itens+ações), seção Variação de Preços (variação % entre primeira e última compra do item, top 15), seções Listas Ativas/Concluídas com barra de progresso. 3 modais: modalCompra (mercado+data+forma+parcelas+cartão+itens), modalLista (nome+itens), modalModoCompras (rascunho com auto-save debounce 800ms). Confirmações via style.cssText (DEC-006). Sem feature gate. |
| `js/mercado.js` | ✅ | ES module. Todos os 18 bugs do cérebro/mercado.md corrigidos de início. salvarCompra usa writeBatch atômico (Bug#2) com compra + N transações vinculadas via campo `compraId` (Bug#5/9). Categoria majoritária por valor (Bug#3) via inferirCategoriaItem (heurística keyword→cat). Distribuição de centavos: primeira parcela absorve resto (Bug#7). onSnapshot tempo real (Bug#6) em compras+listas-compras. extrairDataRef normaliza string|Timestamp (Bug#8). resetState no onAuthStateChanged (Bug#10). Paginação "Ver mais" PAGE_SIZE=20 (Bug#15). Inputs inline para add itens (Bug#12, sem prompt). Fallback de chips se cartões falharem (Bug#13). **IA: setupImportIA() + abrirModalImportIA/Review + enviarParaIA (FormData multi-foto OU JSON texto, AbortController 60s) + posProcessarIA (aplica `mercados-conhecidos` por CNPJ + `aprendizado-itens` por nome) + carregarPlanoUsuario/UsoIA/Aprendizado/MercadosConhecidos + incrementarUsoIA com `increment(1)`. Quotas client-side: free=5, starter=30, plus/pro=∞. confirmarReviewIA grava `mercados-conhecidos/{cnpj}` e `aprendizado-itens/{itemKey}` em background, depois pré-popula modalCompra.** Firestore: usuarios/{uid}/compras + usuarios/{uid}/listas-compras + transacoes (despesa com origem:'compras', compraId) + usuarios/{uid}/uso-ia/{anoMes} + usuarios/{uid}/mercados-conhecidos/{cnpj} + usuarios/{uid}/aprendizado-itens/{itemKey}. |
| `limites.html` | ✅ | Limites de gastos — feature gate Plus para "Copiar do Mês Anterior", 4 KPIs (Total Orçado/Usado/Disponível/Categorias c/ Limite), lista de limites por categoria com barra de progresso e badge status (OK/Atenção/Alerta/Estourado), modal criar/editar limite. |
| `js/limites.js` | ✅ | ES module. onSnapshot limites + getDocs transações do mês para calcular gastos reais por categoria. Barra de progresso e badge dinâmicos. "Copiar do Mês Anterior" via writeBatch. Todos os bugs do cérebro/limites.md corrigidos. |
| `investimentos.html` | ✅ | Investimentos — 3 KPIs (Total Investido/Valor Atual/Rendimento), doughnut Chart.js, cotações AwesomeAPI (USD/EUR/BTC), indicadores de referência (Selic/CDI/IPCA/Poupança), grid de ativos com badges CDI/IPCA. Feature gate Plus. |
| `js/investimentos.js` | ✅ | ES module. onSnapshot investimentos (orderBy criadoEm desc, limit 500). Chart.js doughnut instância reutilizável. AwesomeAPI cotações (cache 5min, AbortSignal 8s). escapeHTML em todos os valores externos. Todos os bugs do cérebro/investimentos.md corrigidos. |
| `balanco-mensal.html` | ✅ | Balanço Mensal — read-only analítico (Fase 2). Paywall para não-Plus. 3 KPIs (Receitas/Despesas/Saldo), comparativo bar Receitas vs Despesas, % comprometimento da renda, ranking top-10 categorias de despesas, ranking top-10 categorias de receitas, tabela dia-a-dia. Nav mês desktop (botões ‹ ›) + bottom-sheet mobile com seletor de mês/ano em grade 2×6. Sidebar com link "Balanço Mensal (Plus)" ativo. |
| `js/balanco-mensal.js` | ✅ | ES module. Todos os 10 bugs do cérebro/balanco-mensal.md corrigidos de início. BUG 1: query range dataReferencia (>=ini, <=fim) + orderBy — sem limit(5000). BUG 2: setDate(1) antes de setMonth/setFullYear (DEC-021). BUG 3: filtra status!='pendente'. BUG 4: getDocs (leitura única, não onSnapshot). BUG 5: porCatRec e porCatDep separados. BUG 6: sincronizarDados() re-busca do Firestore. BUG 7: downgrade persistido via updateDoc. BUG 9: Number(t.valor)||0. BUG 10: normalizarData() aceita string e Timestamp. Feature gate: NexoPlanos.canUseFeature(userData,'advancedDashboard') com fallback permissivo. |
| `comparativo.html` | ✅ | Comparativo de Meses — read-only analítico (Fase 2, Item 2). Paywall para não-Plus (feature: monthlyComparative). Selectors de 2 meses (desktop + mobile). KPI cards M1/M2 (Receitas/Despesas/Saldo/Total trans). Gráfico barras agrupadas Receitas-Despesas-Saldo (Chart.js 4.4.1). Top-10 despesas e receitas por categoria com barras proporcionais + badge variação. Gráfico top-8 categorias de despesas. Sidebar ativo em comparativo.html. |
| `js/comparativo.js` | ✅ | ES module. 11 bugs do cérebro/comparativo.md corrigidos preventivamente. BUG 1: getDocs sem limit. BUG 2: charts destruídos quando valoresOcultos. BUG 3: filtra status!='pendente'. BUG 4: populaSelects(preservarSelecao) não reseta escolha. BUG 5: getDocs (não onSnapshot). BUG 6: calcDiffLabel trata base-zero (Novo/Zerou/=). BUG 7: catsDespesa e catsReceita separados. BUG 8: downgrade persistido no Firestore. BUG 9: Number(t.valor)||0. BUG 10: sincronizarDados() re-busca real. BUG 11: normalizarData() aceita string e Timestamp. Dep: Chart.js 4.4.1 CDN. |
| `graficos.html` | ✅ | Gráficos — read-only analítico (Fase 2, Item 3). Paywall para não-Pro (feature: evolutionChart). 4 KPIs (Receitas/Despesas/Saldo/Transações). 4 charts Chart.js 4.4.1: Doughnut (despesas/categoria), Bar (receitas vs despesas), Line (tendência 6 meses), Bar diário (gastos/dia). Nav meses desktop (◄►) + bottom-sheet mobile. Sidebar ativo em graficos.html. |
| `js/graficos.js` | ✅ | ES module. 10 bugs do cérebro/graficos.md corrigidos preventivamente. BUG 1: getDocs sem limit(5000). BUG 2: setDate(1) antes setMonth (navegação + seletor mobile). BUG 3: filtra status!='pendente' em todos os 4 charts + tendência. BUG 4: null safety + try/catch no resolvePlan. BUG 5: tooltip callbacks respeitam valoresOcultos. BUG 6: getDocs (não onSnapshot). BUG 7: Number(t.valor)||0. BUG 8: downgrade persistido via updateDoc. BUG 9: sincronizarDados() re-busca real. BUG 10: normalizarData() aceita string e Timestamp. Dep: Chart.js 4.4.1 CDN. |
