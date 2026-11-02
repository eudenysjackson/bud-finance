# ARCHITECTURE_MAP.md — Inventário Vivo do Ecossistema

**Projeto**: Bud Finance  
**Última atualização**: 01/11/2026 — Snapshot atual: frontend estático em `appbudfinance/` (GitHub Pages e Render Static Site); API Node/Express em `backend/server.js` no Render; Firebase Auth/Firestore; Mercado Pago para assinaturas; EmailJS para e-mails; Groq para leitura e funções de IA. Revisão pública do serviço Web do backend ainda precisa ser confirmada; ver `AI_HANDOFF.md`.

> **REGRA**: Antes de criar algo novo, consulte este doc. Ao finalizar qualquer tarefa, atualize.  
> Se algo novo quebrar uma conexão existente, **pare e avise o usuário**.

---

## Snapshot de arquitetura — 01/11/2026

- **Frontend**: páginas estáticas em `appbudfinance/`; portal/vendas em `index.html`. Publicação GitHub Pages e Render Static Site.
- **Backend**: Node/Express em `backend/server.js`, API pública no Render.
- **Dados e identidade**: Firebase Authentication e Cloud Firestore; regras mantêm campos de cobrança e auditoria controlados pelo backend.
- **Integrações**: Mercado Pago (checkout, recorrência e webhooks), EmailJS (mensagens transacionais) e Groq (tarefas de IA).
- **Estado de implantação**: código de inadimplência está no `master`; revisão do serviço Web Render ainda não foi identificada. Consulte `AI_HANDOFF.md` antes de assumir que a automação backend está ativa.

## Fluxo de autenticação e onboarding — 01/11/2026

- Cadastro cria o perfil e envia e-mail de confirmação com link mágico.
- O backend valida o token de uso único, confirma o e-mail e autentica a sessão.
- Contas novas seguem para `onboarding.html`; após `onboardingConcluido === true`, o onboarding direciona para a dashboard.
- A correção do destino direto está registrada na branch `codex/fix-confirmation-onboarding-20261101`; aguarda integração. Consulte `AI_HANDOFF.md` para o estado de publicação.

## 🌐 Estrutura de URLs (DEC-047)

| URL | Conteúdo | Arquivo no repo |
|---|---|---|
| `budsolucoes.com.br/` | Landing/vendas pública | `index.html` (raiz) — antigo `vendas.html` |
| `budsolucoes.com.br/appbudfinance/` | Login do app Bud Finance | `appbudfinance/index.html` |
| `budsolucoes.com.br/appbudfinance/dashboard.html` | Dashboard, etc. | `appbudfinance/*.html` |
| `budsolucoes.com.br/appoutro/` | (Futuro) Outros produtos Bud | `appoutro/` (não existe ainda) |

**Estrutura física**:
- Raiz: `index.html` (vendas), `logo.png`, `CNAME`, docs (`*.md`), `backend/`, `tests/`, `cérebro/`, `playwright.config.js`, `package.json`
- `appbudfinance/`: todos HTML do app, `js/`, `css/`, `email-templates/`, `manifest.json`, logos do app

---

## 🧩 Membros (UI Components)

| Nome | O que faz | Onde aparece |
|---|---|---|
| **LoginCard** | Card glassmorphic com formulário de login | `index.html` |
| **OnboardingWizard** | Card wizard 6 passos com progress dots, animações e validação | `onboarding.html` + `js/onboarding.js` |
| **AssistenteIA** | Chat IA com personagem **Buddy** (Groq llama-4-scout), contexto financeiro real, sistema de chamados (bug/sugestão), persiste conversa em sessionStorage | `assistente-ia.html` + `js/assistente-ia.js` |
| **AssistenteWhatsApp** | Hub dedicado do WhatsApp: paywall (Free/Starter), estado desvinculado (gerar código de pareamento + pairing box + polling 5s/2min), estado vinculado (número formatado + wa.me link + desvincular). Feature gate `PLANOS_WHATSAPP=['plus','pro','trial']`. Showcase de 6 features (todas "Em breve"). Aguarda chip eSIM + VPS Evolution API para ativar em produção (PEND-053). | `assistente-whatsapp.html` + `js/assistente-whatsapp.js` |
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
| **DashMesNav** | Navegação de mês (‹ / Maio de 2026 ▾ / ›). Picker (`#mesPicker`) é appended ao `document.body` com `position:fixed` e z-index:9999, posicionado via `getBoundingClientRect()`. Fecha ao scroll. | `dashboard.html` — IIFE `mesPicker` em `dashboard.js` |
| **DashSummaryCards** | 3 cards glassmorphic: Saldo Total, Entradas, Saídas | `dashboard.html` |
| **DashTrialBanner** | Banner condicional trial/free/expirado | `dashboard.html` |
| **DashQuickActions** | Botões rápidos: Nova Receita, Nova Despesa | `dashboard.html` |
| **DashStreakBadge** | Badge 🔥 Nd no header quando streakDias ≥ 2 (lê `userData.streakDias`) | `dashboard.html` |
| **SubNavContasExtrato** | Sub-barra de navegação estática: Contas (carteira.html) e Extrato (extrato.html). Ativo via background CSS var. | `carteira.html`, `extrato.html` |
| **SubNavRecorrentesLimites** | Sub-barra: Recorrentes (ativo em recorrentes.html) e Limites (ativo em limites.html). Sidebar aponta para Recorrentes. | `recorrentes.html`, `limites.html` |
| **SubNavMetasInvestimentos** | Sub-barra: Metas (ativo em metas.html) e Investimentos (ativo em investimentos.html). Sidebar aponta para Metas. | `metas.html`, `investimentos.html` |
| **SubNavAnalises** | Sub-barra com 5 abas de análise: Gráficos, Balanço, Comparativo, Relatórios, Insights. Sidebar aponta para Gráficos. | `graficos.html`, `balanco-mensal.html`, `comparativo.html`, `relatorios.html`, `insights.html` |
| **DashCarteiraWidget** | Mini-widget contas da carteira (saldo total + lista até 3, exclui crédito) | `dashboard.html` — `atualizarWidgetCarteira()` |
| **DashLimitesWidget** | Widget limites por categoria com alertas visuais. Mostra `⚠️ Gastos acima do orçamento` (laranja) quando `pctTotal > 100` mesmo sem categoria crítica individualmente. Mostra `✅ Orçamento sob controle` (verde) quando `pctTotal ≤ 100` e nenhuma categoria ≥ 80%. | `dashboard.html` — `atualizarLimitesWidget()` |
| **DashDividasAtraso** | Widget dívidas vencidas com botão "Ver" (já existia) | `dashboard.html` — `atualizarDividasAtraso()` |
| **DashLembretes7Dias** | Próximas contas a vencer em 7 dias (recorrentes + parcelas de dívidas) | `dashboard.html` — `atualizarLembretes7Dias()` |
| **DashTudoEmDia** | Aparece quando não há dívidas em atraso nem lembretes pendentes | `dashboard.html` — `atualizarTudoEmDia()` |
| **DashAtividades** | Últimas 5 transações do mês com data + CTA vazio (+ Receita / + Despesa) | `dashboard.html` — `renderizarAtividades()` |
| **DashGraficoCategorias** | Donut chart Chart.js despesas por categoria | `dashboard.html` |
| **DashEconomiaPotencial** | Sugere reduzir 15% nas 2 maiores categorias de despesa | `dashboard.html` — `atualizarEconomiaPotencial()` |
| **DashSaudeFinanceira** | Score 0-100 com arco SVG animado + label + link insights | `dashboard.html` — `atualizarSaudeFinanceira()` |
| **DashDicaDia** | Dica financeira contextual baseada nos dados reais do mês | `dashboard.html` — `atualizarDicaFinanceira()` |
| **TransactionModal** | Modal glassmorphic único para Nova Receita e Nova Despesa | `dashboard.html` |
| **CfgTabs** | 4 abas: Perfil, Personalização, Segurança, Dados | `configuracoes.html` |
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
| `window.BudPush.requestIfNeeded(user)` | Exibe popup customizado de permissão push → aciona `window._budRequestPushToken(user)` em `dashboard.js` | `dashboard.js` (3s delay) + `configuracoes.js` (botão Ativar) | ✅ `bud-utils.js` (22/05/2026) |
| `window.BudInAppNotif.init(user, userData)` | Verifica condições (boas-vindas, plano expirando, trial) → exibe banner acima de `.mes-nav` | `dashboard.js` após `configurarBannerPlano` | ✅ `js/bud-notif-inapp.js` (22/05/2026) |
| `window.BudInAppNotif.openPanel()` | Abre/fecha painel lateral de histórico de notificações | `#btnBell` em `dashboard.html` | ✅ `js/bud-notif-inapp.js` (22/05/2026) |
| `window.BudInAppNotif.addExternal(key, emoji, msg, link, lbl)` | Adiciona notificação externa (FCM foreground onMessage) | `dashboard.js` → `onMessage()` | ✅ `js/bud-notif-inapp.js` (22/05/2026) |
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
| `/onboarding` | Onboarding Wizard | `onboarding.html` | ✅ Auth guard + redirect se já onboarded + 6 steps (Boas-vindas, Como conheceu, Conta, Renda, Despesa, Conclusão) + cria carteira/transações/recorrentes no Firestore |
| `/assistente-ia` | Assistente IA | `assistente-ia.html` | ✅ Auth guard + gate plano (plus/trial) + chat com contexto financeiro real (getDocs mês atual) + chamados via /api/chamado + conversa em sessionStorage |
| `/dashboard` | Dashboard | `dashboard.html` | ✅ Auth guard + primeiroLogin guard + **onboardingConcluido guard** + sidebar + 3 cards + trial banner |
| `/configuracoes` | Configurações | `configuracoes.html` | ✅ Auth guard + emailVerified guard + 3 abas (Perfil, Personalização, Segurança) |
| `/metas` | Metas Financeiras | `metas.html` | ✅ Auth guard + emailVerified guard + sidebar + 4 summary cards + grid metas + 3 modais |
| `/investimentos` | Investimentos | `investimentos.html` | ✅ Auth guard + emailVerified guard + sidebar + 3 KPIs + doughnut chart + cotações AwesomeAPI + CRUD |
| `/mercado` | Compras de Mercado | `mercado.html` | ✅ Auth guard + sidebar + 2 abas (Compras / Listas) + 4 KPIs do mês + lista paginada + histórico de variação de preços + Modo Compras (rascunho auto-salvo) + **Importação por IA (Foto/PDF/Texto, multi-foto, review editável, aprendizado por CNPJ e por item, quota mensal por plano)** — sem feature gate |
| `/limites` | Limites de Gastos | `limites.html` | ✅ Auth guard + sidebar + feature gate Plus para "Copiar do Mês Anterior" |
| `/investimentos` | Investimentos | `investimentos.html` | ✅ Auth guard + emailVerified guard + sidebar + 3 KPIs + doughnut chart + cotações AwesomeAPI + CRUD + feature gate Plus |
| `/balanco-mensal` | Balanço Mensal | `balanco-mensal.html` | ✅ Auth guard + emailVerified guard + paywall Plus + 3 KPIs + comparativo + ranking categorias + dia-a-dia |
| `/comparativo` | Comparativo de Meses | `comparativo.html` | ✅ Auth guard + emailVerified guard + paywall Plus + 2 meses lado a lado + KPI cards + Chart.js barras agrupadas + top-10 categorias |
| `/carteira` | Contas | `carteira.html` | ✅ Auth guard + emailVerified guard + sub-nav Contas/Extrato (Contas ativo) + CRUD de contas + importação de extrato |
| `/extrato` | Extrato | `extrato.html` | ✅ Auth guard + sub-nav Contas/Extrato (Extrato ativo) + lista de transações + filtros + busca + export |
| `/recorrentes` | Recorrentes | `recorrentes.html` | ✅ Auth guard + sub-nav Recorrentes/Limites (Recorrentes ativo) + CRUD recorrentes + endpoint processarRecorrentes |
| `/limites` | Limites | `limites.html` | ✅ Auth guard + sub-nav Recorrentes/Limites (Limites ativo) + sidebar aponta para Recorrentes + feature gate Plus |
| `/metas` | Metas Financeiras | `metas.html` | ✅ Auth guard + emailVerified guard + sub-nav Metas/Investimentos (Metas ativo) + 4 summary cards + grid metas + 3 modais |
| `/investimentos` | Investimentos | `investimentos.html` | ✅ Auth guard + emailVerified guard + sub-nav Metas/Investimentos (Investimentos ativo) + sidebar aponta para Metas + 3 KPIs + doughnut chart + cotações AwesomeAPI + CRUD + feature gate Plus |
| `/graficos` | Gráficos | `graficos.html` | ✅ Auth guard + emailVerified guard + paywall Pro + sub-nav Análises (Gráficos ativo) + 5 charts Chart.js (Doughnut, Bar, Line, Bar diário, Line faturas cartão) + 4 KPIs + nav meses |
| `/balanco-mensal` | Balanço Mensal | `balanco-mensal.html` | ✅ Auth guard + emailVerified guard + paywall Plus + sub-nav Análises (Balanço ativo) |
| `/comparativo` | Comparativo de Meses | `comparativo.html` | ✅ Auth guard + emailVerified guard + paywall Plus + sub-nav Análises (Comparativo ativo) |
| `/relatorios` | Central de Relatórios | `relatorios.html` | ✅ Auth guard + emailVerified guard + paywall advancedDashboard + sub-nav Análises (Relatórios ativo) + interface 3 abas (Resumo / Gráficos / Detalhamento) + 3 KPIs + 4 charts Chart.js + insight automático + tendência 6 meses single-pass + detalhamento com barras hex |
| `/insights` | Insights e Análises | `insights.html` | ✅ Auth guard + paywall dailySpendAverage (Plus) + sub-nav Análises (Insights ativo) + 2 abas + score saúde + alertas + simulador |

| `/admin` | Painel admin | `admin.html` + `js/admin.js` | Auth guard `role==='admin'` + 6 abas (Visão Geral, Feature Flags, CRM, Notificações, Promoções, Sistema). Feature Flags: CRUD completo, seed de 19 flags padrão em `featureFlags/{id}`, toggle rápido, modal criar/editar, excluir. Sistema: `admin/config` doc (modoManutencao, cadastrosAbertos, versao, mensagemBoasVindas). Overview: últimos 10 cadastros + KPIs (total, pagantes, trial, flags ativas). |
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
| 30/04/2026 | Painel Admin criado: `admin.html` + `js/admin.js`. PEND-045. Auth guard `role==='admin'` via Firestore. 6 abas: Visão Geral (KPIs + últimos cadastros), Feature Flags (CRUD completo, seed 19 flags defaults, toggle rápido), CRM/Notificações/Promoções (stubs), Sistema (`admin/config` toggles manutenção/cadastros + versão + mensagem). Collection `featureFlags/{id}`: key, name, description, enabled, allowedPlans[]. Collection `admin/config` (setDoc merge). Firebase ES Modular v10.8.1. | Copilot |
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
| `js/carteira.js` | ✅ | ES module. Parsers CSV+OFX client-side. detectarTipo (BUG#1 fix). detectarCategoria REGRAS_CAT unificadas (BUG#10 fix). verificarDuplicatas range query (BUG#2+3 fix). confirmarImport writeBatch 400 + snapshot ultimaConfirmacao (BUG#4 fix). AbortController 120s para backend (BUG#8 fix). **14/05**: `BANCOS_LOOKUP` + `detectarBanco()` (DEC-044) — 21 bancos, gradiente + ícone abreviado. `buildContaCard()`: badge dias sem atualizar (>7d amarelo, >30d vermelho). `initFiltroOrdem()`: filter pills por tipo + botão sort ciclante (criado→nome→saldo→atualizado). `abrirSaldoRapido()`/`confirmarSaldoRapido()`: updateDoc ultimaConfirmacao com saldo real. `abrirModalTransferencia()`/`confirmarTransferencia()` corrigido (ERR-036): schema correto `tipo:'despesa'`/`'receita'`, `carteiraId`, `dataCriacao`, `pago`, `confirmado`, `pagamentoFatura`, `transferencia:true`. `conta-btns-grid` CSS class (responsive: 2col desktop, 1col mobile). |
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

## Retomada — integrações IA (27/10/2026)

- `backend/server.js`: todas as sete chamadas Groq usam `GROQ_MODEL` (padrão `qwen/qwen3.8-27b`), incluindo fatura/extrato por texto ou imagem, cupons por texto ou imagem, classificação de documentos, chat e insight opcional de notificações.
- `GROQ_MAX_OUTPUT_TOKENS`: orçamento configurável de saída (150–8192; padrão 8192); ambiente local usa 900 pela cota da conta. Classificação usa no máximo 600; chat no máximo 1500. Extrações e classificação rejeitam `finish_reason=length` via `ensureCompleteAIResponse`.
- Leitura PDF: `pdf-parse` com `Uint8Array` independente e versão já instalada `v2.0.550` nas três rotas de leitura.
- `scripts/smoke-ia-local.js` + `tests/fixtures/ia/`: validações reais com documentos fictícios e conta `homologacao@bud.local`, limitada ao Firebase Emulator. Não grava transações financeiras. Oito cenários aprovados; entrega FCM não exercitada.
- Buddy continua fora do lançamento, conforme orientação do usuário; a correção da infraestrutura não altera flags nem disponibiliza o produto.

## Leitura de documentos em partes e acompanhamento (27/10/2026)

- `backend/ai-reader.js`: fila por processo, orçamento de saída adaptável ao limite informado pela Groq, espera automática de 429 (`retry-after`), divisão recursiva de texto quando a saída não cabe e recomposição em ordem. Não corta o documento em 30 mil caracteres. Preserva compras iguais em linhas distintas.
- Imagens: divisão em regiões com sobreposição e seleção pela coordenada vertical da linha; `sharp` realiza os recortes. PDFs: lê todas as páginas; páginas sem texto são renderizadas por `@napi-rs/canvas` e encaminhadas à leitura visual.
- `backend/ai-jobs.js`: resposta 202 para upload com `X-Bud-Async: 1`; processamento continua no servidor. `GET /api/ia/jobs/:id` entrega progresso/resultado somente ao titular autenticado. Resultados concluídos expiram em 30 minutos; trabalhos em memória são perdidos se o processo reiniciar. Compatibilidade com chamadas síncronas mantida.
- `window.budAIRequest` em `bud-utils.js`: upload único e acompanhamento periódico. Usado por Cartões, Contas, Mercado e anexos do assistente. Removido o cancelamento automático aos 45/120 segundos dos fluxos de importação.
- `tests/ai-reader.test.js`, `tests/ai-jobs.test.js`, `tests/ai-client.test.js`: nove testes de particionamento, integridade de linhas, espera por cota, PDFs escaneados, progresso, isolamento por titular e transporte do navegador.
- Testes reais Groq: fatura com 24 compras em três páginas retornou 24 itens e R$ 300; cupom em PDF escaneado retornou dois itens e R$ 20. Fatura curta e cupom em texto também aprovados após a alteração.

## Leitura direta de faturas — 27/10/2026

`backend/invoice-reader.js` reconhece o layout Nubank textual, lê linhas datadas (incluindo estornos e financiamentos) e só retorna quando a soma líquida em centavos coincide com o resumo. Layout não reconhecido ou soma divergente continua pela IA; PDFs com páginas escaneadas não usam o atalho. `cartoes.js` não fabrica mais saldo de ajuste nem classifica estorno apenas para fechar uma diferença.

## Homologação das telas e artefato público (27/10/2026)

Contas autentica uploads. Compras envia PDFs originais; Dívidas lê todas as páginas com OCR nas vazias. Buddy desabilitado nesta candidata por budFeatureEnabled. scripts/package-release.js gera dist/site por lista permitida; deploy.yml testa importações antes de publicar. Evidências e condições em RELEASE_IMPORTACOES_2026-10-27.md.

## Fechamento local de bloqueios (27/10/2026)

backend/account-lifecycle.js e DELETE /api/account: exclusão recursiva com login recente e bloqueio de assinatura; configuracoes.js usa rota autenticada. firestore.rules libera apenas depósitos de Metas ao titular/admin. metas.js grava aporte/histórico/saldo/transação atomicamente com dataReferencia. relatorios.js consulta carteira/tipo credito. CORS inclui DELETE. scripts/smoke-release-local.js valida regras e fluxos em contas descartáveis; testes/account-lifecycle.test.js e release-flows.test.js integram npm run test:release e CI. Estado de publicação em RELEASE_STATUS_2026-10-27.md.

## Homologação final de e-mail e checkout (27/10/2026)

31 regressões e7 grupos emulados. tests/email-flows.test.js testa recuperação/ação/confirmação; checkout.test.js cobre preço/identidade, webhook, estados e cancelamento simulado. Script inspect-online.js compara apenas estado público por padrão; --test-reset-email é um envio real e exige autorização do destinatário. Recuperação é exclusiva pelo backend; acao-auth.js conecta ao emulador e aceita links sem mode. Portal raiz lista Produtos Bud. Estado detalhado em RELEASE_STATUS_2026-10-27.md.

## Cobranças recorrentes MP (27/10/2026)

server.js trata subscription_authorized_payment com _mpHandleAuthorizedPayment e vínculo da fatura ao preapproval. Webhook só confirma após processamento, retorna503 em falhas e usa HMAC constante/IDs coerentes. next_payment_date orienta expiração; duplicatas preservam o período.37 regressões,12 específicas de checkout.

## Conferência real do checkout (27/10/2026)

Fluxo publicado página comercial -> POST create-subscription autenticado -> checkout oficial Mercado Pago conferido com Starter/R$9,99. Evidência em test-results/qa-checkout-real-starter.png. Teste não confirmou pagamento; fechamento depende de validação da aprovação e webhook.

## Assinaturas com contas MP fictícias (27/10/2026)

Harness privado em .tools/mp-sandbox-integration.cjs executa as rotas da candidata com Auth/Firestore Emulator e credencial conferida por /users/me (test_user e vendedor esperado). Checkout oficial aprovado com cartão fictício, plano Starter ativado pelo processamento local assinado, duplicata preservando validade e cancelamento real no provedor de teste retornando free no emulador. Fatura oficial de teste approved/processed confirmada por API. O teste não recebeu webhook externo nem usa Firebase de produção; alcance público e segredo do Render continuam por conferir. Evidências e limites em RELEASE_STATUS_2026-10-27.md; arquivos privados não integram o pacote público.

## Troca de plano para a próxima cobrança (31/10/2026)

backend/subscription-change.js fornece a rota autenticada change-subscription: transação/lease, vínculo da assinatura ao UID/pagador, alteração de preço no mesmo contrato MP e intenção recuperável em planoTroca. _mpHandleSubscription só promove o plano agendado mediante pagamento aprovado com data/valor do novo ciclo; eventos comuns preservam o plano vigente. Configurações permite agendar e desfazer; Firestore protege planoTroca, planoTrocaLock e mpPayerId e impede acesso direto a _seguranca. Teste real MP e testes HTTP emulados registrados em RELEASE_VALIDACOES_2026-10-31.md.

## 31/10/2026 — armazenamento de importações e notificações
backend/ai-job-store.js fornece armazenamento compartilhado no Firestore com fragmentos, leases, limpeza e admissão transacional. ai-jobs.js coordena workers e AsyncLocalStorage; cota é contabilizada uma vez por trabalho. firestore.indexes.json inclui índices de expiração e desindexa bytes. Documentos temporários são inacessíveis ao cliente; backend usa Admin. Checkout registra reserva/link pendente em mpCheckout protegido. Push preserva subscription e só confirma ativação após registro aceito. Ver RELEASE_VALIDACOES_2026-10-31.md para evidências e limites.

##31/10/2026 — notificações por canal
bud-notif-inapp.js passou a calcular apenas avisos atuais da assinatura; dashboard não consulta comunicados globais. push-foreground.js recebe push nas demais telas; push.js preserva subscription e exibe avisos no sistema. backend/financial-notifications.js calcula pendências pagas/não pagas e monta multicast/TTL. server.js registra até20dispositivos, revoga individualmente e cron dispensa IA. Ver DEC-061 e relatório de validação.


## Confirmação de e-mail e onboarding — 01/11/2026

Após a validação do link mágico, `appbudfinance/js/index.js` autentica a conta e direciona diretamente para `onboarding.html`. A dashboard é aberta pelo fluxo de conclusão do onboarding. Correção publicada no `master` no commit `f3c0453`; GitHub Actions `41338154393` confirmou o deploy do GitHub Pages. A jornada real com link recebido por e-mail ainda requer conferência ponta a ponta.


## Indicações — estado auditado (01/11/2026)

Onboarding grava `comoConheceu` como origem de aquisição e não solicita código. Cadastro possui entrada manual opcional e valida `codigoIndicacao`, gerando `indicadoPor` e uma indicação em Firestore. Checkout Mercado Pago aplica desconto apenas se recebe `ref`; os caminhos de cadastro → checkout não propagam esse código de modo uniforme. Existe divergência entre `descontoIndicacao: 30` no perfil e desconto backend de 10%. Webhook registra a indicação convertida, mas não implementa recompensa financeira/meses grátis ao indicador. Ver PEND-REF-001 e DEC-068; não considerar indicação funcional ponta a ponta.


## Programa de indicação — implementação em revisão (01/11/2026)

- Links com parâmetro ?ref=CODIGO, cadastro e opção “Indicação” no onboarding levam o código para validação no endpoint autenticado POST /api/indicacao/aplicar e para POST /mercadopago/create-subscription.
- Firestore mantém a atribuição indicadoPor, indicação em usuarios/{indicadorUid}/indicacoes/{indicadoUid}, estado do desconto de primeira cobrança e estado da recompensa única do indicador. Campos promocionais de cobrança ficam protegidos por regras e são atualizados pelo backend.
- Webhook de pagamento aprovado confirma a conversão. O backend altera o valor recorrente da assinatura no Mercado Pago para a cobrança promocional e restaura o valor normal após a cobrança descontada.
- Regra DEC-069: indicado recebe 15% na primeira cobrança; indicador recebe 50% em uma cobrança posterior, uma única vez. Sem descontos simultâneos; excedentes de indicação não geram outra recompensa.
- Estado: branch codex/beneficios-indicacao-15-50-20261101, Actions run 41341678748 passou na suíte completa; homologação sandbox pendente e ainda não publicado. Consulte AI_HANDOFF.md e RELEASE_INDICACOES_2026-11-01.md.


## Correção da espera de importação IA — 01/11/2026

ERR-071 / PEND-IA-ESPERA: a mensagem aguardando serviço vem do retry HTTP 429; até 12 esperas longas e polling/worker sem prazo mantinham a interface aberta. Correção em codex/corrige-importacao-ia-travada-20261101: tentativas curtas e limitadas, worker com prazo de 180s, registro persistente antigo encerrado, cliente com 210s totais/30s por conexão e mensagens de falha/cancelamento claras. 91 regressões aprovadas. Detalhes em RELEASE_IA_ESPERA_2026-11-01.md. Integração/deploy em preparação. Indicações: PR #5 integrado em 3d6f5f4; Pages 41344526378 aprovado e backend Render Live confirmado. Regras de indicação compiladas e publicadas no projeto bud-finance em 01/11/2026. Workspace original preservado.


## Publicação confirmada — indicações e importação IA (01/11/2026)

- PEND-REF-001: descontos 15%/50% homologados e PUBLICADOS. PR #5 integrado em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado e Render Live confirmado. Regras do Firestore compiladas e publicadas no projeto bud-finance após login do titular.
- ERR-071 / PEND-IA-ESPERA: RESOLVIDO E PUBLICADO pelo PR #6, commit e50356c715886cb9a25d371c67345c4096eebaab. CI do PR 41345953909 e Pages 41346014030 aprovados; Render Live no mesmo commit. HTTP 200 no JavaScript público confirmou prazo global de 210s, mensagem de conexão indisponível e retirada do aviso antigo de 45s.
- Validação: 91 regressões aprovadas; limites persistentes do provedor, workers travados, registro antigo com lease ativa, ausência de resposta e preservação de documentos extensos/PDF/imagem. Fluxos de falha emulados; a fatura original da captura não foi fornecida. Não afirmar que a capacidade do provedor de IA é ilimitada nem que a fatura original foi reimportada.
- Decisão operacional: três tentativas no provedor; esperas de até 15s e total de até 20s por solicitação; worker de 180s; cliente de 210s e conexão de 30s. Falha é explícita, libera a interface/admissão e não retorna transações parciais.
- Relatórios: RELEASE_IA_ESPERA_2026-11-01.md e RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. Código e alterações preexistentes do workspace original preservados; registros locais de continuidade foram atualizados. Próxima reprodução específica depende do documento original, se o usuário relatar erro após atualizar a página.

## Classificação de pares na revisão de faturas (01/11/2026)
invoice-refunds.js fornece classificação pura do caminho PDF validado, carregada antes de cartoes.js. Pares únicos compra/estorno por descrição/data/valor ficam excluídos; créditos sem par ficam assinados e contabilizados. salvarTransacoesIA e atualizarResumoReviewIA usam seleção elegível, com guard de conciliação e duplicação. calcularFatura preserva DEC-034 somando os documentos ativos, incluindo status credito negativo. Ver RELEASE_ESTORNOS_2026-11-01.md.
## Revisão segura de estornos e conferência — 01/11/2026

Regra aprovada pelo titular: compra e devolução ficam desmarcadas juntas apenas com vínculo seguro; recompra permanece ativa. Identidade por mesmo valor/estabelecimento/data não basta. Implementação usa identificador bancário OFX compartilhado, exatamente duas linhas de sinais opostos e saldo zero; grupos ambíguos e estornos parciais permanecem separados. Sem identificador, o PDF mantém compras e abatimentos assinados e exige revisão; não declarar que os estornos desse PDF foram todos pareados. Seleção de um par identificado é conjunta; alteração que quebre saldo zero é bloqueada antes de salvar. Ação em massa Compras e abatimentos preserva devoluções sem par. Edição preserva sinal negativo.

Barra de conferência restaurada como progressbar visível e atualizada a cada seleção/valor: compara a soma selecionada ao total declarado, informa divergência exata, inclusive um centavo, e não afirma precisão universal nem 100% para OFX. Sem referência, informa impossibilidade de conciliação automática. Valores originais preservados, sem ajustes sintéticos. Guardas de duplicação e total permanecem.

Histórico verificado: e50356c (espera infinita) alterou apenas 2 linhas de cartoes.js relacionadas à espera; a classificação anterior já continha exclusão de negativos, FITID e inferência por valor. Portanto, a regra segura atual não era integralmente garantida antes. Alterações posteriores do parser/seleção alteraram o comportamento, documentadas nos PR10/11/13/14.

Validação: 97 regressões passaram; após ampliar o teste de persistência do par+recompra, 10 testes específicos passaram. Teste VM executa processamento, gravação e recálculo reais com Firestore emulado: somente a recompra é salva; valores repetidos sem identificador não são associados. Teste da barra cobre seleção que aumenta o total e divergência de um centavo. Deploy e inspeção pública pendentes neste registro.

Conta do titular: Plus concedido por autorização expressa e precondição Firestore; expiração de trial removida, nenhuma cobrança criada. Validação anterior online do PR14 abriu 51 linhas selecionadas e zero controles bloqueados, sem gravar lançamentos. Esta concessão substituiu a proposta de devolver quatro usos. Groq permanece com capacidade finita para imagens/layouts sem parser; Developer é aquisição futura. Não anunciar disponibilidade universal ilimitada.

Continuidade Claude/Codex: workspace original tem alterações preexistentes; preservá-las. Trabalho isolado em .tools/invoice-reconciliation-ui, branch codex/revisao-estornos-conciliacao-20261101. Próximo passo: conferir CI/publicação e a barra no app online. Nenhum dado financeiro privado incluído no Git; nenhum registro do usuário recriado ou salvo nesta entrega.


## Correção de leitura de contratos em Dívidas — 02/11/2026

Diagnóstico reproduzido com os dois PDFs privados do titular (80 e 6 páginas): Dívidas extraía texto/OCR localmente e aplicava regexes genéricas, sem chamar Groq. Capturava quantidade de parcelas de material educativo anterior ao quadro resumo e banco mencionado em outro contexto; locação não tinha regras para aluguel inicial e prazo escrito entre parênteses. Percentual da captura era soma de campos preenchidos, não confiança de IA. Também permitia salvar dívida com valores zerados.

Implementação: contract-reader.js puro, carregado antes de dividas.js. Prioriza seção contratual do quadro resumo, separa entrada, parcela financiamento bancário, pré-chaves, intermediárias e pós-obra. Usuário escolhe explicitamente um bloco; totais de séries mensais são nominais e não incluem reajustes. Não presume prazo ou prestação do banco quando o contrato de compra não os informa; não usa preço do imóvel como saldo devedor e não presume entrada paga. Locação extrai aluguel mensal, prazo, total base e início; não transforma multa/juros de atraso em taxa de financiamento, banco de recebimento em credor, início ou tolerância em primeira data de vencimento. Último dia útil requer confirmação manual de data; reajustes e feriados não são automatizados nesta entrega.

UI: mostra blocos selecionáveis, avisos e campos essenciais identificados, em vez de percentual de confiança artificial. Salvar direto bloqueado sem total, quantidade, valor de parcela e primeiro vencimento válido; edição manual preserva os campos encontrados. Seleção vazia/mudança de bloco não mistura obrigações. Parcela paga é apenas a confirmada pelo usuário; atraso não conta como pagamento.

Validação: 103 regressões passaram, inclusive testes de resumo versus exemplos, obrigações separadas, aluguel com tolerância, datas inválidas e execução do preview/seleção/save com Firestore emulado. PDFs reais extraídos integralmente em leitura local, reconhecidos com os campos previstos; páginas financeiras conferidas visualmente. Dados privados, PDFs, extrações e PNGs permanecem fora do Git em .tools/contracts-private. Nenhuma dívida do titular salva ou alterada. Publicação e teste no navegador online ainda pendentes neste registro.

Arquivos: appbudfinance/js/contract-reader.js, appbudfinance/js/dividas.js, appbudfinance/dividas.html, tests/contract-reader.test.js, package.json. Branch codex/corrige-leitura-contratos-20261102 em .tools/contracts-fix. Claude/Codex devem preservar separação de obrigações e não afirmar leitura universal infalível nem substituir confirmação de dados ausentes por zeros. Limites Groq são independentes; estes dois caminhos rodam localmente.


## Cadastro conjunto de obrigações contratuais — 02/11/2026

Pedido do titular: selecionar várias/todas as obrigações de um documento, completar dados por obrigação e cadastrar as completas juntas, preservando pendências na revisão. Substitui a limitação de um bloco por importação do PR21/22.

Implementação: seleção por checkbox, Marcar todas / Só completas / Desmarcar todas; revisão individual de nome/credor, instituição, valor total/base, quantidade, parcela, primeiro vencimento e pagas. Completar uma obrigação não altera as demais. Totais nominais derivados acompanham parcela/quantidade; total editado manualmente não é sobrescrito (principal bancário pode diferir da soma de prestações). Contagem do botão informa quantas completas serão cadastradas e quantas selecionadas ficam pendentes. Rascunho permanece nesta revisão, em memória; trocar documento/iniciar nova dívida/recarregar descarta o rascunho não salvo, informado na tela. Não prometer persistência entre sessões.

Persistência: uma transação Firestore cria um documento por obrigação completa, de forma atômica. ID determinístico combina SHA-256 do texto normalizado do contrato com índice do bloco, no namespace da conta. Lê antes de criar: retry/reenvio do mesmo texto/bloco não duplica nem sobrescreve registro existente. Não equivale a detecção universal de contratos exportados com texto diferente nem migra importações antigas com IDs aleatórios. Em erro, seleção/campos são preservados; resposta incerta pode ser reconsultada com o mesmo ID. Callback transacional não altera UI durante retries. Botão duplo e mudança de arquivo enquanto salva são bloqueados. Obrigações já confirmadas ficam desabilitadas; pendentes selecionadas mantêm edições para completar e salvar depois na mesma revisão. Nenhuma pendente recebe zeros ou datas inventadas.

Testes:108 regressões aprovadas. Cobrem seleção múltipla, quatro blocos completos de fixture mais duas pendências, completar pendentes depois, documentos separados com seus valores e pagos, clique repetido, falha antes do commit sem gravação, resposta incerta após commit e retry sem duplicar/alterar registro já editado pelo titular; edição isolada e datas/pagas inválidas; hash estável por espaços; troca de contrato para aluguel sem vazar estado; fluxo singular de aluguel preservado. O teste de PDF de seis páginas inclui o novo estado de salvamento no harness.

Arquivos: contract-reader.js (fingerprint/pendências/plano), dividas.js (UI e transação), dividas.html (cache20261102-contracts-batch), testes contract-reader e import-screens. Sem mudanças de backend ou regras. Nenhuma dívida real cadastrada ou alterada nos testes. Publicação e QA online pendentes nesta anotação. Trabalho isolado em .tools/contracts-batch-fix, branch codex/cadastro-multiplo-contratos-20261102. Claude/Codex: preservar semântica de obrigações separadas, não misturar parcelas bancárias e da construtora, não gravar dados reais sem autorização específica, e manter os registros atualizados.




## Interface contratual publicada e validada — 02/11/2026
RESOLVIDO E PUBLICADO no PR26, commitff14e909fe6a41584d71dbffbb8ea3691a4fa5e6. CI41483774957/41483754440 e Pages41483903534 aprovados; versão20261102-contracts-design confirmada por HTTP e navegador autenticado. Botões de seleção conferidos visualmente e por DOM: Inter, peso700, raio12px, estados do app; CTA reutiliza wizard-btn-next e campos modal-input. Teste real digitou10102026 na data da entrada e recebeu10/10/2026 com ícone de calendário, placeholderDD/MM/AAAA e validação; o campo de teste foi limpo em seguida. Nenhum cadastro acionado em produção e registros preexistentes do titular preservados.
109 regressões aprovadas, incluindo fechamento após confirmação de cadastro com pendências, manutenção do popup em falha, retomada das pendentes e descarte apenas do rascunho sem excluir dívidas. Fechamento/retomada foram validados em simulação, não com nova gravação real. Fluxo final: _salvarBlocosContrato confirma transação, fecha popup e atualizarAvisoPendenciasContrato cria aviso na lista; _retomarPendenciasContrato reabre a revisão preservada. Nova dívida retoma pendência existente após sucesso; descartar limpa memória. Recarregar/trocar documento ainda perde rascunho não salvo, conforme avisos. Esta anotação encerra publicação/QA pendentes dos registros anteriores e é a referência atual para Claude/Codex.

## Pagamento de parcelas na própria dívida — 02/11/2026
Implementado e validado localmente; publicação em preparação. Dívidas abre popup com data DD/MM/AAAA e escolha entre conta e apenas marcar como pago; não exige Dashboard. Com conta, uma transação Firestore grava parcela, despesa, saldo e histórico. Sem conta, apenas dívida e histórico, sem despesa geral. A aba Extrato mostra valor, data efetiva, vencimento, conta/modo e desfazer; registros antigos sem esses dados ficam explicitamente incompletos, sem inferir conta do contrato. Dashboard reutiliza serviço e popup para dívidas. Não realiza transferência bancária.
Preserva modelo de parcelas pagas consecutivas: clicar numa parcela posterior pede confirmação explícita de todo o intervalo pendente e seu total. Desfazer apenas a última; devolve à conta original do pagamento, não à conta padrão atual, e mantém auditoria. Parcelamento de fatura libera limite reservado nas duas opções; desfazer restaura o valor exato liberado. Migração legada não fabrica despesas para registros novos sem conta.
Arquivos novos debt-payments.js e debt-payment-dialog.js; integração em dividas.js/html e dashboard.js/html. Histórico em usuarios/{uid}/pagamentos-dividas; regras genéricas existentes de proprietário já cobrem a coleção. Sem backend/regras novas. 117 testes de release aprovados (8 novos casos financeiros com adaptador transacional em memória). Teste local em Edge headless 375px passou: seleção de conta, máscara, erro preservado, retry, fechamento, marcar sem conta e cancelar. Sintaxe e diff conferidos. Não afirmar teste de escrita real no Firestore: nenhuma parcela/conta real foi alterada. Branch codex/pagamento-parcelas-na-divida-20261102, clone .tools/debt-payment-fix. Próximo passo: publicar e conferir popup/extrato online sem confirmar pagamento real. Atualizar este registro com commit e deploy para Claude/Codex.


## Pagamento em Dívidas publicado e conferido — 02/11/2026
RESOLVIDO E PUBLICADO pelo PR28, commit36822e65fe1bcb9247a74147fb6611e4b218984e. CI41488897583/41488880756 e Pages41489122282 aprovados. HTTP200 confirmou versão20261102-payment e serviço público. No navegador autenticado: clicar na primeira parcela abriu popup na própria Dívidas; data local correta; contas de débito/espécie carregadas; seleção de conta e opção apenas marcar funcionaram; confirmar ficou disponível após escolha. Clicar na segunda parcela mostrou explicitamente intervalo1a2 e valor total dobrado. Ambos cancelados sem confirmar. Aba Extrato consultou a coleção com sucesso e mostrou vazio para dívida sem pagamentos. Nenhuma parcela, dívida, transação ou saldo real foi alterado nesta conferência.
117 regressões aprovadas e teste local mobile Edge aprovado; gravação, idempotência e reversão financeira validadas com adaptador transacional em memória, não por escrita real no Firestore. Não afirmar execução de transferência bancária: o app só registra o pagamento informado. Extrato preserva data efetiva, vencimento, valor, conta/modo e desfazer; sem conta não gera despesa geral. O código compartilhado também atende lembretes de dívida da Dashboard. Esta anotação encerra publicação/QA pendentes do registro anterior; Claude/Codex devem preservar estas regras e atualizar os documentos a cada evolução. PDF privado não foi enviado ao Git.



## Metas: compra mista, extrato por conta e conclusão — 02/11/2026
IMPLEMENTADO E VALIDADO LOCALMENTE; publicação pendente. Titular autorizou planejamento e confirmação de compra com reserva, várias contas e cartões parcelados; acrescentou extrato de aportes e bloqueio de novos depósitos após alcançar meta.
Diagnóstico online somente leitura: busca Aporte no Extrato encontrou os registros existentes, incluindo o valor relatado. Estavam após os50 primeiros itens por haver compras de cartão com datas futuras no mesmo extrato geral. Nenhuma transação recriada nem saldo do titular alterado. Botão Extrato de cada conta agora informa contaId; página filtra carteiraId/contaId sem incluir crédito, incluindo registros antigos. Aportes antigos sem categoria ganham rótulo Metas na apresentação; novos levam categoria, conta, data e status explícitos.
Nova opção Meta de compra no cadastro/edição (metas antigas continuam reserva até escolha explícita). Botão Planejar compra admite até8 formas diferentes e1a48 parcelas por cartão, data DD/MM/AAAA, valor final e reserva. Salvar plano não movimenta saldo/limite e permite distribuição incompleta. Confirmar exige declaração de compra já realizada e soma exata; valida saldo/limite/datas atuais. Valores informados devem incluir juros acordados: não contrata crédito nem calcula CET. Dia do fechamento envia para próximo ciclo; vencimento anterior/igual ao fechamento cai no mês seguinte; meses curtos são ajustados. Centavos distribuídos sem alterar total. Usuário deve conferir datas com emissor.
Depósitos já debitam a conta e são despesas desde o modelo anterior: consumir reserva não debita nem gera despesa de novo. Valor inicial já guardado é considerado reserva externa às contas, explicado no popup. Compra usa reserva até valorAtual e preserva restante; porção nova em conta debita só ela, porção crédito gera parcelas ordinárias com cartaoId e referência de fatura. Coleção usuarios/{uid}/compras-metas/{metaId} e campo compraRealizada mantêm valor, data, fontes, parcelas e IDs. Uma transação Firestore confirma tudo; metaId é identidade única da compra, repetição não duplica. Confirmação relê carteiras e lançamentos existentes, e toca versão do cartão para serializar confirmações de metas concorrentes. Não equivale a integração bancária em tempo real nem garantia sobre compras/importações concorrentes em fluxos legados que não compartilham o mesmo lock.
Cartões calcula disponível sobre todas as faturas ainda não pagas, incluindo parcelas futuras e limiteReservado de financiamento; pagar fatura libera parcela naturalmente sem reserva duplicada. Removido corte de5000 transações do listener de Cartões para não omitir compromissos antigos. Meta comprada fica concluída separadamente do dinheiro guardado e guarda histórico; não significa parcelas quitadas. Edição/exclusão da meta comprada e edição avulsa de movimentos de meta no Extrato são bloqueadas para preservar vínculos. Não há fluxo novo de cancelamento/estorno de compra nesta entrega.
Metas alcançadas não exibem Depositar; abrir formulário e confirmar validam conclusão. Aporte agora usa transação com leitura fresca e ID de operação estável em retries da mesma tentativa: débito, despesa, depósito e meta juntos. Continua permitindo saldo negativo de origem, conforme pedido do titular, mas bloqueia ultrapassar alvo, cartão como conta e meta já alcançada/comprada. Exclusão de meta sem compra usa transação e devolve aportes vinculados; compra registrada é preservada.
129 regressões aprovadas (12 casos novos e integração do formulário atualizada), sintaxe/diff aprovados. Edge headless mobile375px conferiu escolha de conta/cartão,3parcelas, consentimento, erro preservado/retry/fechamento e ausência de Depositar em meta alcançada. Financeiro validado por adaptador transacional em memória, sem escrita de teste em produção. Screenshot local em .tools/goal-purchase/goal-purchase-mobile.png, não versionar. Branch codex/metas-compra-mista-20261102 no clone .tools/goal-purchase. Próximo passo: PR/deploy e QA online somente de interface. Claude/Codex: preservar regras, distinguir simulação de produção e atualizar este status após publicação.

## Pendência documental anterior encerrada — 02/11/2026
Aviso do simulador publicado pelo PR30, commitec60b19a31679e469a25c680ace3c967fca52ab7; Pages41491108722 aprovado e HTTP200 confirmou avisoEstimativaQuitacao. Layout mobile nas duas abas conferido localmente. A anotação final remota da sessão anterior foi impedida por limite de uso da revisão automática; esta atualização registra a evidência sem repetir publicação do código.




## Perfil sincronizado, revogação persistente e fechamento removido — 02/11/2026
Implementado em .tools/profile-sync-fix, branch codex/sincronizacao-perfil-20261102. Sidebar tinha leituras pontuais e não recebia atualização feita em outro dispositivo. Novo profile-sync.js observa o documento do usuário em todas as telas com sidebar, aplica foto/nome, remove foto quando ausente e limpa listener ao trocar/sair de conta; callbacks antigos são ignorados por geração. bud-utils importa módulo compartilhado; HTMLs recebem versão20261102-profile.
Revogar consentimento passa a usar DELETE autenticado de todos os dispositivos, limpa fcmToken/fcmTokens e grava pushConsentRevoked e timestamp no backend em transação. Registro silencioso após revogação retorna403; somente consent:true de clique explícito Ativar libera novamente o dispositivo. Desativar comum continua revogando só um dispositivo. Foreground respeita marcador do perfil; mensagens já em trânsito podem ainda chegar. Não altera e-mails, assinatura nem permissão nativa do navegador. Nenhuma revogação de conta real foi feita para teste.
Titular solicitou remover diaFechamento sem uso: removidos campo, leitura e escrita de Configurações; valor legado não é apagado no banco. Confirmado checkout frequency1/frequency_type months; titular escolheu manter mensal na data definida pelo Mercado Pago, não30dias fixos. Não alterar frequência nem contratos reais.
133 testes de release aprovados, incluindo sequência de fotos recebidas por tela aberta/troca de conta e revogação global→refresh403→ativação explícita. Testes em memória, não duas gravações reais em dispositivos. Ping passa a expor revisão Render (commit público, sem segredos) e pushConsentVersion1 para identificar a implantação do backend. Publicação e QA online em preparação; próxima ação PR/deploy e verificar interface/versão sem modificar perfil real. Claude/Codex devem registrar conclusão e limites.

