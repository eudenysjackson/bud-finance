# ARCHITECTURE_MAP.md — Inventário Vivo do Ecossistema

**Projeto**: Bud Finance  
**Última atualização**: 22/04/2026

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
| **DashAtividades** | Lista das últimas 5 transações do mês (style inline) | `dashboard.html` |
| **DashGraficoCategorias** | Placeholder para donut chart de despesas | `dashboard.html` |
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

---

## 🧠 Neurônios (Helpers)

| Nome | Cálculo/Tratamento | Quem usa | Status |
|---|---|---|---|
| `budShowToast(msg, tipo)` | Exibe notificação toast (success, error, warning, info) | Todas as páginas | ✅ `bud-utils.js` |
| `budSanitize(str)` | Strip HTML tags + trim — anti-XSS | Todas as páginas | ✅ `bud-utils.js` |
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
| **Backend (Render)** | Express API | `https://bud-finance-backend.onrender.com/api/extrair-fatura` | POST multipart/form-data (campo `arquivo`). Extrai transações de PDF via pdf-parse+regex ou via Gemini 1.5 Flash (fallback). Retorna `[{desc, valor, data}]`. Deps: multer, pdf-parse. Requer `GEMINI_API_KEY` no Render para imagens. |
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
