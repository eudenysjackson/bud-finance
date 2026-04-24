# ROADMAP.md — Foco e Controle de Escopo

**Projeto**: Bud Finance  
**Última atualização**: 23/04/2026 — Auditoria de paridade Cérebro→Bud (Cartões / Metas / Configurações)

> **REGRA**: NÃO implementar itens do Backlog sem pedido explícito do usuário.

---

## ✅ Concluído

- [x] Documentos de governança criados (PROJECT_RULES, ARCHITECTURE_MAP, DECISIONS_LOG, ERRORS_LOG, ROADMAP)
- [x] `.github/copilot-instructions.md` configurado
- [x] **Identidade visual** — 8 temas imersivos com cores reais de marca
- [x] **Firebase Config** (`js/firebase-config.js`) — placeholder seguro via `window.BUD_FIREBASE_CONFIG`
- [x] **Utils globais** (`js/bud-utils.js`) — `budShowToast()` + `budSanitize()`
- [x] **Tela de Login** (`index.html` + `js/index.js`)
  - Card glassmorphic com blobs decorativos + splash screen
  - Inputs email/matrícula + senha com toggle
  - Lógica Firebase Auth modular (v10.8.1, sem compat)
  - Modal de verificação de email (style.cssText, sem Tailwind dinâmico)
  - Keybindings (Enter), sanitização XSS, erro genérico anti-enumeração
  - Closure para dados sensíveis (sem senha no DOM)
- [x] **Tela de Cadastro** (`cadastro.html` + `js/cadastro.js`)
  - Formulário completo com senha escolhida pelo usuário (sem temp password)
  - Indicador de força de senha (4 barras), blocklist de senhas comuns
  - reCAPTCHA v3 placeholder com fallback DEV_SKIP
  - serverTimestamp para dataCadastro e lgpdConsentimentoData
  - Subcollection `usuarios/{uid}/indicacoes/{uid}` (não arrayUnion)
  - Email de boas-vindas fire-and-forget (sem senha no email)
  - Matrícula BUD-XXXX-XXXX via crypto
- [x] **Tela Recuperar Senha** (`recuperar-senha.html` + `js/recuperar-senha.js`)
  - Glassmorphism consistente com login (blobs, glass card)
  - POST para Cloud Function /reset-senha
  - Delayed redirect 3s + safety timeout 30s
  - Mensagens genéricas anti-enumeração
- [x] **firebase-config.js expandido** — BUD_FUNCTIONS_URL, BUD_EMAILJS_CONFIG, BUD_RECAPTCHA_SITE_KEY
- [x] **index.js atualizado** — Email verification enforced para TODOS os usuários
- [x] **Política de Privacidade** (`politica-privacidade.html`) — Página LGPD completa com glassmorphism
- [x] **Sistema de Temas / Dark Mode** — 8 temas via CSS variables (inclui Dark HBO), preview em `preview-temas.html`, persistência em `localStorage.bud_theme` (DEC-008)
- [x] **Tela Ação Auth** (`acao-auth.html` + `js/acao-auth.js`)
  - 4 estados: validando (spinner) → formulário → sucesso → erro
  - `verifyPasswordResetCode` antes de mostrar form
  - Indicador de força (4 barras), blocklist de senhas comuns
  - Tratamento de links expirados/usados com mensagens amigáveis
- [x] **Tela Trocar Senha** (`trocar-senha.html` + `js/trocar-senha.js`)
  - Guard duplo: `onAuthStateChanged` + `primeiroLogin: true` no Firestore
  - User badge personalizado (nome + matrícula + iniciais)
  - `updatePassword` + `updateDoc(primeiroLogin: false)` → redirect dashboard
  - Tratamento de `auth/requires-recent-login` com re-login forçado
- [x] **Dashboard** (`dashboard.html` + `js/dashboard.js`)
  - Auth guard via `onAuthStateChanged` → redirect login se deslogado
  - Guard `primeiroLogin: true` → redirect `trocar-senha.html`
  - Sidebar lateral colapsável (desktop, persiste em localStorage) + hambúrguer (mobile)
  - 3 cards glassmorphic: **Resultado do Mês** (balanço mensal), Entradas do Mês, Saídas do Mês
    - _Card renomeado de "Saldo Total" → "Resultado do Mês" (DEC-019): query limitada ao mês evita leitura de todo o histórico_
  - Banner trial/free/expirado condicional
  - Toggle ocultar valores (persiste em localStorage); gráfico também oculto quando ativo
  - Sync real (re-cria listeners Firestore)
  - **CRUD completo de transações**: Nova Receita / Nova Despesa, Edição inline, Exclusão com confirmação
  - Atividades recentes (top 5 do mês) + filtro rápido Todos/Receitas/Despesas
  - **Histórico completo** (modal com todas as transações do mês, clicável para editar)
  - **Gráfico de despesas por categoria** (Doughnut — Chart.js) com cores por tema
  - **Navegação por mês** (← Abril 2026 →) com cálculo retroativo correto
  - **8 temas imersivos** sincronizados com Firestore (`temaEscolhido`); seletor movido para Configurações
  - Nome + matrícula + iniciais do usuário com `budSanitize()`
  - Logout com cleanup de listeners
  - Link `⚙️ Configurações` no sidebar em substituição ao bloco de temas (DEC-030)
- [x] **Tela de Configurações** (`configuracoes.html` + `js/configuracoes.js`) — MVP com 3 abas
  - **Aba Perfil**: exibe nome, email, matrícula e data de cadastro (leitura); card com plano ativo
  - **Aba Personalização**: seletor de 8 temas com bubbles; sync automático com Firestore (`temaEscolhido`) via evento `bud:themechange`; indicador de tema ativo
  - **Aba Segurança**: link de redefinição de senha por email + botão de logout
  - Auth guard (`onAuthStateChanged` + `emailVerified`); mesmo layout e sidebar do dashboard
- [x] **Tela de Metas** (`metas.html` + `js/metas.js`)
  - Auth guard (`onAuthStateChanged` + `emailVerified` + `getIdToken(true)`)
  - 4 summary cards: Metas Ativas, Total Guardado, Falta Guardar, Progresso Médio
  - Grid responsivo de MetaCards: emoji, nome, barra de progresso animada, badge gamificação (🌱🔥⭐🚀🏆), sugestão de aporte por prazo, botões depositar/histórico/editar/excluir
  - Modal criar/editar meta: nome (com 10 sugestões clicáveis), emoji picker (120 emojis, deduped via Set), valorAlvo, valorAtual (desabilitado em edição), prazo (custom datepicker — DEC-018)
  - Modal depositar: valor, data (custom datepicker), carteira (custom select, sem crédito)
  - Modal histórico: lista de aportes ordenados por data
  - **writeBatch atômico** no aporte: update meta.valorAtual + set transacao + decrement carteira.saldo; addDoc deposito separado após batch
  - **Exclusão em cascata**: writeBatch deleta depositos + transações vinculadas + meta doc
  - Confetti ao atingir 100% de progresso
  - DEC-033 registrado (sub-subcoleção `depositos` como padrão para históricos)
- [x] **Tela de Cartões** (`cartoes.html` + `js/cartoes.js`)
  - Auth guard (`onAuthStateChanged` + `emailVerified` + `getIdToken(true)`)
  - Cartões persistidos em `carteira/{id}` com `tipo:'credito'` — coleção unificada (DEC-034)
  - Navegação por mês (← Maio 2026 →) com cálculo retroativo
  - 3 summary cards: Total de Faturas, Limite Disponível, Faturas Pagas
  - Cartão físico visual: gradiente por cor, chip, número (últimos 4 do doc ID), fechamento/vencimento
  - Fatura calculada **dinamicamente** (sem campos denormalizados — DEC-034)
  - Status de fatura por mês: Paga / Vencida / Fechada / Aberta
  - Barra de limite com cor dinâmica (verde/amarelo/vermelho)
  - Lista colapsável de gastos do mês com exclusão individual
  - CRUD completo de cartões: nome, bandeira (6 opções), limite BRL, dia fechamento, dia vencimento, 10 cores
  - Registro de gastos no crédito (não afeta saldo da carteira)
  - Pagar/desfazer fatura (toggle `faturasPagas[mesKey]`)
  - Exclusão em cascata: writeBatch deleta todas as transações + doc do cartão
  - 5 modals: Cartão, Gasto, Pagar Fatura, Excluir Cartão, Excluir Gasto
  - Custom datepicker (DEC-018), custom select bandeira e categoria
  - 10 cor pills com gradientes físicos de cartão
  - Link Cartões adicionado a todos os sidebars (dashboard, metas, configurações)

---

## 📋 Backlog (ordenado por prioridade)

> ⚠️ **NÃO implementar sem meu pedido.**

### Telas de Finanças
1. **Extrato** (`extrato.html` + `js/extrato.js`) — Filtros, lista por dia, toggle pago, editar, excluir, exportar CSV/PDF
3. **Categorias** (`categorias.html` + `js/categorias.js`) — 48 despesas + 15 receitas padrão; personalizadas via Firestore (planos pagos)
4. **Recorrentes** (`recorrentes.html` + `js/recorrentes.js`) — Cloud Function `processarRecorrentes` às 6h todo dia
5. **Dívidas** (`dividas.html` + `js/dividas.js`) — Wizard, 6 tipos, Tabela Price, simulação, importação IA (PDF.js + Tesseract.js)
6. **Investimentos** (`investimentos.html` + `js/investimentos.js`) — 8 tipos, AwesomeAPI, Chart.js doughnut
7. **Limites** (`limites.html` + `js/limites.js`) — Barra de progresso por categoria, "Copiar do Mês Anterior" (plano Plus)
8. **Mercado** (`mercado.html` + `js/mercado.js`) — Lista de compras + IA para nota fiscal

### Telas Analíticas (planos Plus/Pro)
9. **Balanço Mensal** (`balanco-mensal.html` + `js/balanco-mensal.js`) — Read-only: 3 cards + detalhamento por categoria (plano Plus)
10. **Comparativo** (`comparativo.html` + `js/comparativo.js`) — 2 meses lado a lado + Chart.js (plano Plus)
11. **Gráficos** (`graficos.html` + `js/graficos.js`) — 4 charts Chart.js (plano Pro)
12. **Relatórios** (`relatorios.html` + `js/relatorios.js`) — Consolida Balanço + Gráficos + Detalhamento ⚠️ usar style inline para categorias
13. **Insights** (`insights.html` + `js/insights.js`) — Score saúde, alertas IA, simulador, FCM push (plano Plus)

### Telas de IA / Assistentes
14. **Assistente IA** (`assistente-ia.html` + `js/assistente-ia.js`) — Gemini 1.5 Flash via backend + chamados (plano Plus)
15. **Assistente WhatsApp** (`assistente-whatsapp.html` + `js/assistente-whatsapp.js`) — Decorativa por ora; webhook só loga

### Telas de Sistema / Negócio
16. **Importar** (`importar.html` + `js/importar.js`) — CSV, OFX, PDF, imagens via `/api/extrair-fatura`
17. **Painel Admin** (`admin.html` + `js/admin.js`) — 6 abas: Overview, CRM, Feature Flags, Notificações, Promoções, Sistema; sem sidebar
18. **Onboarding** (`onboarding.html` + `js/onboarding.js`)
19. **Vendas** (`vendas.html`) — Landing pública; 4 planos; Mercado Pago ⚠️ uid/email devem vir do idToken no backend (IDOR)

### Backend / Cloud Functions
20. **Cloud Functions**
   - `/reset-senha` — envio de link de reset
   - `/chamado` — registro e envio de bug/sugestão
   - `processarRecorrentes` — cron às 6h Brasília
   - Rate limiting

### Expansões da Tela de Configurações (cérebro descreve, MVP atual NÃO inclui)

> Auditoria 23/04/2026 — `cérebro/configuracoes.md` documenta uma versão muito mais ampla da tela do que o MVP atual. Os itens abaixo NÃO existem no código e ficam explicitamente fora do escopo até pedido.

21. **Gestão de Assinatura (Mercado Pago)** — card premium glassmorphism, exibição de plano/trial/expiração, botões de upgrade/downgrade, integração com `/mercadopago/create-subscription`, banner de status `pending`, cancelamento de assinatura
22. **Notificações Push (FCM)** — `verificarEstadoPush()`, registro/revogação de token em `usuarios/{uid}/tokens/fcm`, modal de instalação iOS Safari → PWA
23. **Reset do Tutorial** — botão integrado a `NexoTutorial.resetAll()` (depende da tela de Onboarding)
24. **Assistente WhatsApp (vincular número)** — `vincularWhatsApp()` / `desvincularWhatsApp()`, gravação de `whatsappVinculado` em `usuarios/{uid}`, feature-gate por plano Plus, badge de status (decorativa enquanto webhook só loga)
25. **LGPD: Exportar Dados Completo (XLSX)** — `exportarMeusDados()` cobrindo as 14 subcoleções (`transacoes`, `metas`, `metas/{id}/depositos`, `cartoes`/`carteira` tipo `credito`, `categorias`, `dividas`, `investimentos`, `limites`, `recorrentes`, `compras`, `listas-compras`, `tokens`, `notificacoes_eventos_enviadas`, `perfil/config`) via SheetJS. _MVP atual exporta só `transacoes` em CSV — ver DT-003._
26. **LGPD: Revogar Consentimento de Notificações** — desativa FCM e marca `revogadoEm` em `tokens/fcm`
27. **LGPD: Excluir Conta Permanentemente** — `executarExclusaoConta()` com modal de confirmação por digitação ("EXCLUIR"), batch chunks de 400 deletando todas as subcoleções + `usuarios/{uid}` + `auth.currentUser.delete()`
28. **Reset Total da Conta** — `executarReset()` apaga todas as subcoleções financeiras (mantém doc do usuário) e redireciona para `onboarding.html`

### Débitos Técnicos Mapeados (não-bloqueantes)

> Anotados em memória do repo. Atacar quando a tela for tocada por outro motivo.

- **DT-001** — `js/cartoes.js#salvarTransacoesIA` usa loop sequencial de `addDoc`. Converter para `writeBatch` em chunks de 400-500 para garantir atomicidade da importação IA. _Atacar na próxima alteração em Cartões._
- **DT-002** — `js/cartoes.js#L824` `perfilPlano = null` hardcoded. Buscar `userData.plano` do Firestore quando feature de planos pagos for ativada.
- **DT-003** — `js/configuracoes.js#exportarCSV` cobre apenas `transacoes`. Expandir para 14 subcoleções quando a feature LGPD completa (item 25) entrar no escopo.

---

## 🐛 Bugs Conhecidos

Consultar [`ERRORS_LOG.md`](ERRORS_LOG.md) para histórico completo (ERR-001 a ERR-011).
