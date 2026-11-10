# DECISIONS_LOG.md — Registro de Decisões Arquiteturais

**Projeto**: Bud Finance  
**Última atualização**: 01/11/2026

> **REGRA**: Antes de refatorar qualquer padrão, ler este doc primeiro.  
> Toda decisão não-óbvia deve ser registrada aqui.

---

### DEC-052 — Fonte compartilhada para coordenação entre IAs

- **Data**: 01/11/2026
- **O que foi decidido**: Codex, Claude e outras IAs que trabalhem neste repositório devem usar `AI_WORKFLOW.md` como protocolo comum e manter `AI_HANDOFF.md` atualizado com estado, evidências e próximo passo. Cada agente trabalha em branch própria e integra por Pull Request.
- **Por quê**: Históricos e memórias privadas de ferramentas diferentes não são sincronizados; documentação commitada no repositório permite continuidade verificável.
- **Consequências**: Instruções de entrada em `AGENTS.md` e `CLAUDE.md` apontam para o protocolo. Pendências, decisões, arquitetura, erros e releases continuam registrados em seus documentos específicos. Não descartar alterações locais alheias nem alegar deploy sem confirmar o commit implantado.
- **Quando revisar**: Se o projeto mudar de fluxo de GitHub ou incorporar outro agente/ferramenta.

### DEC-051 — Não criar tela dedicada de Carteira — cobrir via telas existentes

- **Data**: 31/05/2026
- **O que foi decidido**: Não será criado um `carteira-contas.html` dedicado. As funcionalidades do CRUD de `usuarios/{uid}/carteira/{id}` já estão distribuídas:
  - **Contas corrente/poupança/dinheiro**: gerenciadas em `carteira.html` (importar extrato + confirmar saldo).
  - **Cartões de crédito** (`tipo='credito'`): gerenciados em `cartoes.html`.
  - **Dropdown Conta/Cartão** em `mercado.js` já consome a coleção com fallback.
- **Por quê**: Criar uma terceira tela seria redundância de UI. Usuário já tem acesso a todas as operações pelas telas existentes.
- **Consequencias**:
  - PEND-MER-09 removida das pendências ativas.
  - Se surgir necessidade de painel unificado de saldo, implementar como widget/tab em `carteira.html` (não nova tela).

---

### DEC-048 — Configurações do VS Code: workspace file tem prioridade sobre settings.json

- **Data**: 21/05/2026
- **O que foi decidido**: Toda configuração do VS Code (Live Server, VsCodeTaskButtons, etc.) deve ser feita **exclusivamente** em `bud-finance.code-workspace` → campo `"settings"`. Alterações em `.vscode/settings.json` são **ignoradas** porque o workspace file as sobrescreve.
- **Por quê**: O arquivo `bud-finance.code-workspace` define as configurações de workspace e tem precedência sobre `.vscode/settings.json` quando o projeto é aberto via `.code-workspace`. Perdemos tempo editando `settings.json` sem efeito.
- **Consequências**:
  - `liveServer.settings.root`: `"/appbudfinance"` → Live Server serve o app, não a landing page.
  - `liveServer.settings.port`: `3001` → porta fixa.
  - `VsCodeTaskButtons.tasks` → configurar aqui, não no `settings.json`.
  - Botões "Ver Planos" em telas bloqueadas por plano devem apontar para `../index.html?checkout=PLANO` (não para `configuracoes.html`).
- **Quando revisar**: Ao adicionar novas extensões com configurações de workspace.

---

### DEC-049 — Assistente IA: renomear personagem de "Bud" para "Buddy"

- **Data**: 21/05/2026
- **O que foi decidido**: O assistente de IA do Bud Finance se chama **Buddy** (não "Bud"). O app continua sendo "Bud Finance". O assistente é "Buddy, o assistente financeiro do Bud Finance".
- **Por quê**: Distinguir o produto (Bud Finance) do personagem da IA (Buddy). Evita confusão entre o nome do app e o nome do assistente. "Buddy" é mais afetuoso e memorável.
- **Consequências**:
  - `backend/server.js` — system prompt: `'Você é o Buddy, assistente financeiro inteligente do app Bud Finance.'`
  - `appbudfinance/assistente-ia.html` — header: `🤖 Buddy`, subtitle: `Seu assistente financeiro do Bud Finance`
  - `appbudfinance/js/assistente-ia.js` — greeting inicial, label de export, filename de export
  - Em todo texto futuro: "Buddy" para o personagem, "Bud Finance" para o app
- **Quando revisar**: Se houver rebranding geral do produto.

---

### DEC-050 — Arquitetura de Notificações: 2 camadas independentes

- **Data**: 21/05/2026
- **O que foi decidido**: O sistema de notificações tem **2 camadas independentes** com tecnologias distintas:
  - **Camada 1 — Push OS (mobile/desktop)**: Service Worker + Web Push API + Firebase Cloud Messaging (FCM). Permissão pedida via popup próprio do app no primeiro login (não diretamente o popup nativo do OS). Token salvo em `usuarios/{uid}/fcmToken`. Cron no backend envia mensagens variadas diárias (9h). Ver PEND-046.
  - **Camada 2 — In-App Banners (dashboard)**: localStorage-based, exibição única, banner posicionado ao lado do botão olho na header do dashboard. Sem Firebase, sem Service Worker. Ver PEND-084.
- **Por quê**: As duas camadas têm propósitos distintos e dependências diferentes. Os banners in-app são mais simples, não requerem FCM, e devem ser implementados primeiro (maior impacto imediato). O push OS é mais complexo e depende de Service Worker + aprovação do usuário.
- **Consequências**:
  - Implementar na ordem: PEND-084 (in-app, sem dependências) → PEND-046 (push OS, requer SW + FCM)
  - NUNCA usar classes Tailwind nos elementos dos banners (criados via JS) → `style.cssText`
  - Popup de permissão do app ANTES do popup do OS (melhora taxa de concessão)
- **Quando revisar**: Se migrar para Firebase App Hosting ou mudar o provedor de push.

---

## Formato

```
### DEC-XXX — [Título da Decisão]
- **Data**: DD/MM/AAAA
- **O que foi decidido**: ...
- **Por quê**: ...
- **Consequências**: ...
- **Quando revisar**: ...
```

---

### DEC-001 — Vanilla JS sem framework

- **Data**: 15/04/2026
- **O que foi decidido**: Usar JavaScript puro (ES6+) com ES Modules, sem React/Vue/Angular.
- **Por quê**: Projeto leve, páginas estáticas, sem necessidade de SPA. Firebase SDK via CDN carrega direto no browser.
- **Consequências**: Sem state management centralizado; DOM manipulado diretamente; cada página tem seu próprio script module.
- **Quando revisar**: Se a complexidade do dashboard exigir gerenciamento de estado avançado.

---

### DEC-002 — Tailwind CSS com build estático

- **Data**: 15/04/2026
- **O que foi decidido**: Usar Tailwind CSS pré-compilado (arquivo `tailwind.css` estático), não JIT em runtime.
- **Por quê**: Simplicidade de deploy (sem build pipeline complexo). Páginas estáticas servidas diretamente.
- **Consequências**: Classes Tailwind criadas dinamicamente em JS NÃO funcionam. Elementos criados em runtime devem usar `style` inline.
- **Quando revisar**: Se o número de classes customizadas crescer muito ou se migrar para build pipeline com PostCSS.

---

### DEC-003 — Firebase Auth + Firestore como backend

- **Data**: 15/04/2026
- **O que foi decidido**: Firebase 10.8.1 para autenticação (email/password) e Firestore para persistência de dados de usuário.
- **Por quê**: Serverless, escalável, sem backend custom para auth. Rate limiting nativo contra brute force.
- **Consequências**: Dependência do ecossistema Google. Custo escala com uso. Queries limitadas pelo modelo NoSQL.
- **Quando revisar**: Se necessitar queries SQL complexas ou se custo Firebase escalar.

---

### DEC-004 — Matrícula como identificador alternativo de login

- **Data**: 15/04/2026
- **O que foi decidido**: Campo de login aceita email OU matrícula (prefixo `BUD-` ou `NEX-`), com lookup no Firestore para traduzir matrícula → email.
- **Por quê**: Flexibilidade para usuários corporativos que usam matrícula interna.
- **Consequências**: Input de login é `type="text"` (não `email`). Requer query extra no Firestore para matrícula.
- **Quando revisar**: Se prefixos mudarem ou se for necessário suportar outros tipos de identificação.

---

### DEC-005 — Firebase config via window.BUD_FIREBASE_CONFIG (não hardcoded)

- **Data**: 15/04/2026
- **O que foi decidido**: Chaves Firebase ficam em `js/firebase-config.js` como placeholders. Em produção serão injetadas via build/CI.
- **Por quê**: Evitar commitar API keys no repositório. Facilitar rotação de credenciais.
- **Consequências**: Exige passo de configuração antes do primeiro deploy. Módulos consomem `window.BUD_FIREBASE_CONFIG`.
- **Quando revisar**: Se adotar bundler (Vite/Webpack) com `.env` nativo.

---

### DEC-006 — Modais criados em JS usam style.cssText (não classes Tailwind)

- **Data**: 15/04/2026
- **O que foi decidido**: Overlays/modais criados dinamicamente via JS usam `el.style.cssText` em vez de `className` com classes Tailwind.
- **Por quê**: Build estático do Tailwind não inclui classes não presentes nos templates HTML. Classes arbitrárias (`bg-black/50`, `z-[9999]`) não existem no CSS gerado.
- **Consequências**: Modais JS são mais verbosos porém confiáveis. Toda estilização dinâmica é inline.
- **Quando revisar**: Se migrar para Tailwind JIT em runtime.

---

### DEC-007 — Sanitização de inputs + erro genérico anti-enumeração

- **Data**: 15/04/2026
- **O que foi decidido**: (1) Todo input do usuário passa por `budSanitize()` (strip HTML tags) antes de ir ao Firestore. (2) Busca por matrícula retorna erro genérico "Credenciais inválidas" sem revelar se a matrícula existe.
- **Por quê**: Prevenir XSS stored e impedir enumeração de usuários.
- **Consequências**: Função global `budSanitize()` em `bud-utils.js`. Mensagens de erro uniformes.
- **Quando revisar**: Se adotar DOMPurify ou framework com sanitização nativa.

---

### DEC-008 — Dados sensíveis em closures, nunca no DOM

- **Data**: 15/04/2026
- **O que foi decidido**: Senhas e tokens temporários ficam em variáveis locais (closures) do JS, nunca armazenados em `dataset`, `localStorage` ou atributos do DOM.
- **Por quê**: Elementos DOM são acessíveis via DevTools / XSS. Closures são inacessíveis externamente.
- **Consequências**: Fluxo de troca de senha precisará usar closure ou referência de módulo para manter a senha temporária.
- **Quando revisar**: Se adotar state management que ofereça encapsulamento equivalente.

---

### DEC-009 — Usuário escolhe a própria senha no cadastro (sem senha temporária)

- **Data**: 15/04/2026
- **O que foi decidido**: O formulário de cadastro tem campos de senha + confirmação. Nenhuma senha temporária é gerada ou enviada por email.
- **Por quê**: Senha em texto plano no email é risco crítico. User-chosen password elimina o vetor.
- **Consequências**: `primeiroLogin: false` no Firestore. `gerarSenhaTemp()` removido. Email de boas-vindas não contém credenciais.
- **Quando revisar**: Nunca — é regra de segurança permanente.

---

### DEC-010 — Indicações como subcollection (não arrayUnion)

- **Data**: 15/04/2026
- **O que foi decidido**: Indicações ficam em `usuarios/{uid}/indicacoes/{indicadoUid}` em vez de array no documento do indicador.
- **Por quê**: Arrays no Firestore não permitem remoção/edição granular de itens. Subcollection permite queries, paginação e exclusão individual.
- **Consequências**: Contagem de indicações requer query `.size()` ou campo `totalIndicacoes` mantido por trigger.
- **Quando revisar**: Se modelo de referral mudar significativamente.

---

### DEC-011 — serverTimestamp() para datas de compliance (LGPD, cadastro)

- **Data**: 15/04/2026
- **O que foi decidido**: `dataCadastro` e `lgpdConsentimentoData` usam `serverTimestamp()` do Firestore, nunca `new Date()` do client.
- **Por quê**: Timestamps de auditoria devem ser imutáveis e timezone-proof. `new Date()` é manipulável pelo usuário.
- **Consequências**: Campos aparecem como `null` até o write ser confirmado pelo server. Leitura imediata pós-write pode ver `null`.
- **Quando revisar**: Nunca — é regra de compliance.

---

### DEC-012 — reCAPTCHA v3 com placeholder e fallback DEV_SKIP

- **Data**: 15/04/2026
- **O que foi decidido**: `getRecaptchaToken()` tenta executar reCAPTCHA v3 e, se o script não estiver carregado (dev local), retorna `__DEV_SKIP__`. Cloud Function valida o token em produção.
- **Por quê**: Permite desenvolvimento local sem reCAPTCHA configurado, mas protege produção.
- **Consequências**: Em dev local o token é dummy. Cloud Function **deve** rejeitar `__DEV_SKIP__` em produção.
- **Quando revisar**: Quando reCAPTCHA for configurado de fato (trocar site key placeholder).

---

### DEC-015 — Fluxo padrão de reset Firebase (sem URL customizada)

- **Data**: 17/04/2026
- **O que foi decidido**: Usar o fluxo padrão de reset de senha do Firebase Auth sem parâmetros de URL customizados (como `actionCodeSettings.url`).
- **Por quê**: O uso de domínios customizados no `generatePasswordResetLink` causava falha silenciosa (ERR-011) quando o domínio não estava autorizado no Firebase Auth. O fluxo padrão garante estabilidade e compatibilidade.
- **Consequências**: O link de reset aponta para o domínio padrão configurado no Firebase Console. Não há redirect customizado pós-reset — o usuário usa a página `acao-auth.html` configurada no Firebase.
- **Quando revisar**: Apenas se for necessário redirect pós-reset para URL específica. Nesse caso, garantir que o domínio está nos Authorized Domains do Firebase Auth.

---

### DEC-018 — Nunca usar `<select>` ou `<input type="date">` nativos — sempre componentes HTML custom

- **Data**: 18/04/2026
- **O que foi decidido**: Todo `<select>` e `<input type="date">` do projeto DEVEM ser substituídos por componentes HTML/CSS/JS totalmente customizados. NUNCA usar os elementos nativos, nem com `appearance: none`.
- **Por quê**: `appearance: none` apenas esconde a seta/ícone, mas o **popup dropdown** e o **popup calendário** são renderizados pelo SO e NÃO podem ser estilizados via CSS. No Windows/Chrome, o select nativo abre um dropdown cinza do sistema e o date abre o calendário padrão do Chrome — ambos quebrando a identidade visual glassmorphic/Bud Finance.
- **Solução definitiva**:
  - **Select** → `div.custom-select` > `div.custom-select-trigger` (tabindex, role=combobox) + `div.custom-select-dropdown` (opções como `div.custom-select-option`) + `input[type=hidden]`. Abre/fecha via classe `.open`.
  - **Date** → `div.custom-datepicker` > `div.dp-trigger` (tabindex, role=button) + `div.dp-dropdown` (header com navegação de mês, grid de dias) + `input[type=hidden]`. Calendário renderizado em JS (`renderCalendar()`), seleção via `selecionarData()`.
- **Consequências**: Mais JS/HTML, mas 100% controle visual. Nunca mais popup nativo. Aplicar em qualquer nova página que precise de select ou date.
- **Quando revisar**: Nunca — é regra de identidade visual permanente.

---

### DEC-017 — Valores de transações armazenados como float (não centavos)

- **Data**: 18/04/2026
- **O que foi decidido**: Salvar o campo `valor` no Firestore como `number` float (ex: `1500.50`) e não como inteiro em centavos (ex: `150050`).
- **Por quê**: A stack (Vanilla JS + Firebase) não exige alta precisão financeira no MVP. Usar float simplifica a leitura, formatação e exibição dos dados sem camadas de conversão. Erros de arredondamento de ponto flutuante são desprezíveis para os valores típicos de finanças pessoais (~2 casas decimais).
- **Consequências**: Operações de soma acumulam pequenos erros de float; aceitável para MVP. Se precisão for crítica no futuro, migrar para centavos (inteiro) ou usar `Decimal.js`.
- **Quando revisar**: Se o produto evoluir para relatórios contábeis ou integração com sistemas bancários que exijam precisão absoluta.

---

### DEC-016 — Mensagens de erro genéricas no login

- **Data**: 15/04/2026
- **O que foi decidido**: Nunca revelar se email/matrícula existe ou não. Erro sempre genérico: "E-mail/matrícula ou senha incorretos."
- **Por quê**: Segurança — impede enumeração de contas (OWASP).
- **Consequências**: UX levemente pior (usuário não sabe se errou email ou senha), mas segurança é prioridade.
- **Quando revisar**: Nunca — é regra de segurança permanente.

---

### DEC-019 — getIdToken(true) antes de acessar Firestore no auth guard

- **Data**: 18/04/2026
- **O que foi decidido**: No `onAuthStateChanged` do dashboard, chamar `user.getIdToken(true)` antes de qualquer leitura no Firestore. Se o refresh falhar, redirecionar para login.
- **Por quê**: O Firebase Auth mantém sessão em cache (IndexedDB). Ao recarregar a página, `onAuthStateChanged` pode retornar um `user` com token expirado/stale. O Firestore rejeita com "Missing or insufficient permissions", causando toast de erro a cada F5.
- **Consequências**: Uma chamada extra de rede (~50ms), mas garante que o token está válido antes de usar. Se a sessão realmente expirou, o redirect é imediato e claro.
- **Quando revisar**: Se o Firebase SDK passar a fazer refresh automático antes de `getDoc` (atualmente não faz).

---

### DEC-020 — Fontes dos botões de ação escalam no mobile

- **Data**: 18/04/2026
- **O que foi decidido**: `.quick-btn-label` e `.quick-btn-sub` devem ter font-size maior no `@media (max-width: 768px)` — label de 0.8125rem→0.9375rem, sub de 0.6875rem→0.8125rem.
- **Por quê**: No mobile (iPhone/Android), os botões "Nova Receita" / "Nova Despesa" ocupam toda a largura mas o texto fica desproporcional em relação aos títulos e valores dos cards vizinhos.
- **Consequências**: Texto dos quick action buttons fica legível e proporcional em telas pequenas.
- **Quando revisar**: Se redesenhar os quick action buttons.

---

### ~~DEC-021~~ — ~~Primeiro login obriga troca de senha~~ (OBSOLETO)

- **Data**: 15/04/2026
- **Status**: ❌ **SUPERSEDED by DEC-009** — Usuário agora escolhe a própria senha no cadastro. Não há senha temporária nem troca forçada. `primeiroLogin: false` no cadastro atual.
- **Quando revisar**: N/A — decisão obsoleta.

---

### DEC-022 — Modal de reenvio de verificação de email criado via JS

- **Data**: 15/04/2026
- **O que foi decidido**: O modal é criado em runtime via `document.createElement` com estilos inline (não classes Tailwind).
- **Por quê**: DEC-002 — classes Tailwind dinâmicas não funcionam com build estático.
- **Consequências**: Estilo do modal é definido via `style.cssText` inline.
- **Quando revisar**: Se migrar para build JIT do Tailwind.

---

### DEC-023 — Sistema de Temas com CSS Custom Properties

- **Data**: 15/04/2026
- **O que foi decidido**: Implementar 8 temas (Gelo, HBO Dark, Azul, Roxo, Rosa, Amarelo, Verde, Vermelho) via CSS variables (`--bg-page`, `--text-main`, `--card-bg`, etc.) trocados em runtime por JS.
- **Por quê**: Permitir personalização visual total sem duplicar CSS. Cada tema muda o fundo, vidro, botões e inputs mantendo a integridade do layout.
- **Consequências**: Todas as cores dinâmicas devem usar `var(--nome)`. Cores de sentimento (verde/vermelho/âmbar) permanecem fixas. Tema salvo em `localStorage.bud_theme`.
- **Quando revisar**: Se o número de temas crescer além de 10 ou se for necessário temas por usuário no backend.

---

### DEC-013 — Redirecionamento forçado de primeiroLogin via onAuthStateChanged

- **Data**: 15/04/2026
- **O que foi decidido**: A tela `trocar-senha.html` usa `onAuthStateChanged` para verificar se o usuário está logado E se `primeiroLogin === true` no Firestore. Se o usuário não está logado, mostra tela de "não autorizado". Se `primeiroLogin` é `false`, redireciona direto para o dashboard.
- **Por quê**: Garantir que nenhum usuário com senha temporária/primeira acesse o dashboard sem trocar a senha. O guard duplo (Auth + Firestore) impede bypass via URL direta.
- **Consequências**: O fluxo é: `index.js` detecta `primeiroLogin: true` → redireciona para `trocar-senha.html` → `trocar-senha.js` valida novamente Auth+Firestore → só libera após `updatePassword` + `updateDoc(primeiroLogin: false)`. Sessão expirada (`auth/requires-recent-login`) força re-login.
- **Quando revisar**: Se o fluxo de onboarding mudar ou se adotar Custom Claims no Firebase Auth.

---

### DEC-014 — acao-auth.html valida oobCode antes de mostrar formulário

- **Data**: 15/04/2026
- **O que foi decidido**: A tela `acao-auth.html` chama `verifyPasswordResetCode(auth, oobCode)` antes de exibir o formulário de nova senha. Se o código é inválido/expirado, mostra tela de erro com link para solicitar novo reset.
- **Por quê**: Evitar que o usuário preencha o formulário inteiro para só então descobrir que o link não funciona. UX de 3 estados (validando → formulário → sucesso/erro) é clara e segura.
- **Consequências**: 4 estados visuais na página: validando (spinner), formulário, sucesso, erro. Cada erro do Firebase (`expired-action-code`, `invalid-action-code`) gera mensagem específica e amigável.
- **Quando revisar**: Se Firebase mudar a API de password reset ou se adotar links dinâmicos.

---

### DEC-024 — Hardening de segurança: oobCode server-side, limpeza de logs, overflow

- **Data**: 18/04/2026
- **O que foi decidido**: (1) O oobCode de reset de senha nunca sai do backend — o servidor gera o link E envia o email via EmailJS REST API. (2) Todos os `console.log`/`console.error` que expunham dados operacionais foram removidos. (3) Descrições de transações limitadas a 100 caracteres antes do Firestore. (4) `overflow: hidden` trocado por `overflow-y: auto` nas 5 páginas de autenticação. (5) `cleanupListeners()` chamado antes de `setupListeners()` no auth guard do dashboard para evitar listeners duplicados.
- **Por quê**: Auditoria de segurança identificou vazamento de oobCode no console do browser, excesso de logging em produção, falta de limites de input, scroll bloqueado em telas pequenas e memory leak por listeners duplicados.
- **Consequências**: Frontend não manipula mais oobCode. Backend precisa das variáveis de ambiente `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_RECUPERAR_SENHA` e `FRONTEND_URL`. Logs de produção são silenciosos. Auth pages permitem scroll.
- **Quando revisar**: Quando migrar para serviço de email próprio (SendGrid, SES) ou quando implementar logging estruturado (pino/winston).

---

### DEC-025 — Navegação de mês no dashboard: persistência e estratégia de filtro

- **Data**: 18/04/2026
- **O que foi decidido**: (1) A variável `dataFiltro` foi substituída por dois estados explícitos: `mesVisualizado` (int 0-11) e `anoVisualizado` (int). (2) O filtro reseta para o mês atual ao recarregar a página — **não persiste em sessionStorage nem localStorage**. (3) O Firestore continua buscando **todas** as transações do usuário (até 1.000) via `onSnapshot`; a filtragem por mês é feita client-side em `renderizarDashboard()`. Os botões `btnMesAnterior` / `btnProximoMes` apenas alteram o estado e re-renderizam sem nova leitura do Firestore.
- **Por quê**: (a) Resetar ao recarregar é o comportamento esperado — o usuário geralmente quer ver o mês atual ao abrir o app. Salvar no sessionStorage adicionaria complexidade sem benefício claro. (b) Filtro client-side evita múltiplos listeners Firestore (um por mês) e mantém a lógica de real-time simples. Com menos de 1.000 transações por usuário (caso de uso típico), o custo de memória é desprezível.
- **Consequências**: A barra de navegação de mês é funcional. Os cards Saldo/Entradas/Saídas e a lista de Atividades Recentes refletem apenas o mês selecionado. Futuras features de gráfico por categoria devem consumir `mesVisualizado`/`anoVisualizado` diretamente.
- **Quando revisar**: Se usuários acumularem >1.000 transações (migrar para paginação server-side com `where('data', >=, inicio).where('data', <=, fim)`) ou se houver demanda por persistir o mês entre sessões.

---

### DEC-026 — Biblioteca de gráficos: Chart.js v4 e estratégia de destruição de instâncias

- **Data**: 18/04/2026
- **O que foi decidido**: (1) Adotar **Chart.js v4.4.2** via CDN (`chart.umd.min.js`) para renderizar o gráfico de Rosca (Doughnut) de despesas por categoria. (2) Manter uma variável global `_chartInstance` para rastrear a instância ativa. A cada re-render (mudança de mês ou novo dado do Firestore), chamar `_chartInstance.destroy()` antes de instanciar um novo gráfico. (3) Filtragem e agrupamento são feitos client-side, consumindo o array `transacoesDoMes` já filtrado por `renderizarDashboard()`.
- **Por quê**: Chart.js é madura, sem dependências externas, tree-shakeable e tem suporte nativo a doughnut com `cutout`. A alternativa (D3.js) teria complexidade desnecessária para um gráfico simples. A estratégia de `destroy()` é obrigatória no Chart.js para evitar sobreposição de instâncias e memory leak ao re-renderizar no mesmo `<canvas>`.
- **Consequências**: O `<script>` do Chart.js deve ser carregado **antes** de `firebase-config.js` e `dashboard.js`. O canvas `#chartCategorias` e o container `#graficoContainer` devem existir no HTML. O estado vazio `#graficoCategorias` é mostrado/ocultado via `style.display` (inline, nunca Tailwind dinâmico — DEC-001).
- **Quando revisar**: Se o número de categorias crescer muito (>9) ou se houver demanda por gráficos de linha (evolução mensal), avaliar biblioteca alternativa ou módulos Chart.js adicionais.

### DEC-027 — CRUD de transações: editar, excluir e histórico completo

- **Data**: 18/04/2026
- **O que foi decidido**: (1) Atividades recentes são clicáveis — abrem o mesmo modal de lançamento em **modo edição** (pre-fill de campos). (2) Estado `transacaoEditandoId` controla se o modal está em criação (`null`) ou edição (string com o ID do doc). (3) `handleSubmitLancamento` faz branch: `updateDoc` se editando, `addDoc` se criando. `descricao.substring(0,100)` aplicado em ambos os modos. (4) Exclusão usa **mini-modal de confirmação** com glassmorphism (nunca `window.confirm` — DEC-018). (5) Botão "Ver Histórico Completo" aparece dinamicamente se o mês tem >5 transações, abre modal `#modalHistorico` com todas as transações do mês filtrado. Rows do histórico também são clicáveis para editar.
- **Por quê**: `window.confirm` quebraria a estética glassmorphism. Reutilizar o modal existente para edição reduz HTML e complexidade. `onSnapshot` já sincroniza automaticamente após `updateDoc`/`deleteDoc`, então não é necessário refresh manual.
- **Consequências**: Imports do Firestore expandidos (`updateDoc`, `deleteDoc`). Botão excluir (`#btnExcluirTransacao`) oculto por padrão, exibido apenas em modo edição. Mini-modal `#modalConfirmExcluir` com `z-index:90` (acima do modal principal z-index:80). Escape fecha modais na ordem: confirmação > histórico > lançamento.
- **Quando revisar**: Se houver demanda por edição inline (sem modal) ou bulk delete.

---

### DEC-028 — Testes visuais ao vivo via browser embutido do VS Code (Live Test)

- **Data**: 20/04/2026
- **O que foi decidido**: (1) Instalar Playwright e a extensão **Playwright Test for VS Code** (`ms-playwright.playwright`) para testes automatizados e browser embutido no editor. (2) Para inspeção visual ao vivo, usar o **Simple Browser** integrado do VS Code (acessível via ferramentas do agente Copilot), servindo o projeto com `http-server` local. (3) O agente Copilot pode abrir, navegar e inspecionar páginas diretamente ao lado do chat, verificando UI, erros de console e status visual sem sair do editor.
- **Por quê**: Permite validação visual imediata de cada página durante o desenvolvimento, sem alternar janelas. O agente pode capturar screenshots, ler o DOM, detectar erros de console (404, Firebase, JS) e reportar problemas em tempo real.
- **Consequências**: Requer `npm install` + `npx playwright install` na máquina local. O `http-server` sobe na porta 3002 (ou outra livre). O `firebase-config.js` precisa existir localmente para funcionalidade completa (está no `.gitignore`, não sobe ao repo). Testes automatizados Playwright rodam via `npm test` (headless) ou extensão VS Code (com browser visível).
- **Quando revisar**: Se migrar para outro framework de testes ou se o VS Code descontinuar o Simple Browser.

---

### DEC-028 — Sistema de Temas Imersivos: 8 temas via CSS Custom Properties

- **Data**: 19/04/2026
- **O que foi decidido**: Implementar 8 temas (Gelo, Dark, Azul, Roxo, Rosa, Amarelo, Verde, Vermelho) via CSS variables no `:root`. Motor de temas em `js/theme-manager.js` (script regular, não módulo) carregado em `<head>` antes do body para evitar flash de cor. Seletor de bolinhas coloridas (`#themeBubbles`) no sidebar. Persistência dupla: `localStorage.bud_theme` (instantâneo, sem flash) + campo `temaEscolhido` no Firestore do usuário (cross-device). Evento `bud:themechange` desacopla `theme-manager.js` de `dashboard.js`. Flag `_skipThemeSync` em `dashboard.js` evita escrita circular no Firestore quando o tema é aplicado a partir dos dados do próprio Firestore.
- **Por quê**: Personalização é um diferencial de produto. CSS vars permitem troca instantânea sem reload. `localStorage` garante ausência de flash na recarga. Firestore garante persistência cross-device. Separar o motor de temas do módulo `dashboard.js` permite usar o mesmo `theme-manager.js` em outras páginas no futuro.
- **Consequências**: Todas as cores dinâmicas do dashboard usam `var(--nome)`. Cores de sentimento (verde receita, vermelho despesa) permanecem fixas (não trocam com o tema). Blobs decorativos ocultos (`--blob-opacity: 0`) nos temas sólidos. Campo `temaEscolhido` adicionado ao documento do usuário no Firestore.
- **Quando revisar**: Quando o seletor de temas migrar para a tela de Configurações. Ou se outras páginas (login, cadastro) também precisarem de temas — criar script de aplicação early no `<head>` de cada página.

---

### DEC-033 — Sub-subcoleção `depositos` para histórico de aportes de Metas

- **Data**: 21/04/2026
- **O que foi decidido**: O histórico de aportes de cada meta é armazenado na sub-subcoleção `usuarios/{uid}/metas/{metaId}/depositos/{depId}`. O campo `valorAtual` da meta é atualizado via `writeBatch` de forma atômica junto com a transação vinculada e o débito na carteira. O doc individual de depósito é inserido em `addDoc` separado após o `batch.commit()` (a subcoleção não precisa de atomicidade com o saldo).
- **Por quê**: Firestore não suporta consultas cross-collection eficientemente para histórico por meta. A sub-subcoleção mantém os dados localizados e facilita paginação futura. A separação entre `writeBatch` (saldo+transação) e `addDoc` (depósito) é intencional — a integridade financeira (saldo da carteira e valorAtual da meta) é crítica e deve ser atômica; o log de depósito é auditoria e pode ser eventual.
- **Campos do depósito**: `valor` (number), `data` (string ISO YYYY-MM-DD escolhida pelo usuário), `carteiraId` (string), `dataCriacao` (serverTimestamp — auditoria).
- **Transação vinculada**: Campo `origem: 'meta'` + `metaId` na coleção `transacoes` para permitir exclusão em cascata ao deletar a meta.
- **Exclusão em cascata**: `excluirMeta()` usa `writeBatch` para deletar todos os depositos + transações vinculadas + o doc da meta em uma única operação atômica.
- **Consequências**: Estabelece o padrão para outras subcoleções de histórico (futuros: parcelas de dívida, extratos de investimento). Limite de 500 ops por batch — metas com >500 depósitos precisarão de batches múltiplos (improvável no uso real).
- **Quando revisar**: Quando o número de subcoleções históricas crescer ao ponto de justificar uma coleção global `aportes` para relatórios cross-meta.

---

### DEC-032 — Itens pendentes da tela Configurações para sprint de pré-produção

- **Data**: 20/04/2026
- **O que foi decidido**: As funcionalidades abaixo foram intencionalmente **adiadas** — não são bugs, são features planejadas. Devem ser implementadas em sprint específica antes de ir a produção.
- **Lista de pendências** (referência: `cérebro/configuracoes.md`):
  1. **LGPD — Excluir conta permanentemente**: `user.delete()` + deletar 14 subcoleções em batches de 500 + `localStorage.clear()` + redirect `index.html`. Só faz sentido quando todas as subcoleções existirem.
  2. **LGPD — Exportar dados completo (XLSX)**: Exportar 14 subcoleções via SheetJS em abas separadas (não apenas `transacoes` em CSV). Hoje só `transacoes` existe.
  3. **Reset Total**: Apaga todas as subcoleções + volta ao onboarding. Mesma dependência: todas as subcoleções precisam existir antes.
  4. **Push Notifications (FCM)**: Ativar/desativar token FCM em `usuarios/{uid}/tokens/fcm`, guia instalação PWA no iOS. Requer `BUD_VAPID_KEY` configurado.
  5. **Assistente WhatsApp**: Vincular/desvincular número, feature gate plano Plus. Requer bot WhatsApp ativo no Render.
  6. **Gestão de Assinatura**: Card premium, upgrade via Mercado Pago, cancelamento. Requer endpoints MP no backend.
- **Por que adiado**: Todas as features dependem de infraestrutura (subcoleções, MP, WhatsApp, FCM) que ainda não existe. Implementar agora geraria código que precisaria ser reescrito.
- **Quando retomar**: Sprint de "preparação para produção", depois que as telas principais (Metas, Cartões, Dívidas, Investimentos) estiverem construídas e o modelo de dados estiver completo.

---

### DEC-031 — Exportação de CSV gerada client-side

- **Data**: 20/04/2026
- **O que foi decidido**: A exportação do histórico de transações para CSV é feita inteiramente no frontend (client-side), sem passar pelo backend no Render.
- **Por quê**: O usuário já está autenticado e o SDK do Firestore já tem as transações disponíveis — enviar os dados ao backend só adicionaria latência e custo de transferência sem nenhum benefício de segurança. O arquivo CSV é gerado via `Blob` + `URL.createObjectURL` e baixado com um elemento `<a>` temporário.
- **Detalhes técnicos**: UTF-8 BOM (`\uFEFF`) adicionado para Excel reconhecer acentos. Separador `;` (padrão PT-BR). Campos texto entre aspas duplas com escape interno. Valores negativos para despesas. Ordenação `dataCriacao desc` (mesma do dashboard). Despesas salvas sem sinal negativo no Firestore — sinal invertido só na exportação.
- **Consequências**: Sem carga no Render. Funciona offline se os dados já estiverem em cache do SDK. Exporta **todas** as transações (sem filtro de mês), ao contrário do dashboard que mostra por mês.
- **Quando revisar**: Se futuramente houver necessidade de relatórios mais complexos (ex: PDF, multi-usuário admin) ou filtro por período, considerar endpoint no Render.

---

### DEC-030 — Centralização da personalização na tela de configurações

- **Data**: 20/04/2026
- **O que foi decidido**: O seletor de temas (`#themeBubbles`) foi removido do sidebar do dashboard e centralizado na tela **Configurações > aba Personalização**. O dashboard passou a ter o link `⚙️ Configurações` no sidebar em substituição ao bloco de temas.
- **Por quê**: Melhor organização UX — ajustes de preferências ficam num local único e previsível. O roadmap já previa essa migração. O sidebar fica mais limpo e o espaço vertical é aproveitado para futuros itens de navegação.
- **Consequências**: Usuários trocam tema acessando Configurações. O `configuracoes.js` agora é responsável por renderizar as bubbles em `#cfgThemeBubbles` e por sincronizar `bud:themechange` com o Firestore (`usuarios/{uid}.temaEscolhido`).
- **Quando revisar**: Se houver demanda por troca rápida de tema sem sair do dashboard (ex: widget flutuante), avaliar re-introdução de acesso rápido.

---

### DEC-029 — Sidebar colapsável: design, visibilidade cross-tema e padronização de elementos

- **Data**: 19/04/2026
- **O que foi decidido**: Implementar sidebar colapsável no desktop (260px ↔ 64px) com as seguintes decisões técnicas:

  **1. Botão de colapso — tab lateral, não círculo flutuante**  
  O botão usa `position: absolute; right: -1rem; top: 50%; transform: translateY(-50%)` formando uma aba (`border-radius: 0 0.5rem 0.5rem 0`) de `1rem × 3.5rem`. Background `var(--btn-bg)` e cor `var(--btn-text)` garantem contraste em todos os 8 temas sem depender de `box-shadow`. A sidebar tem `overflow: visible` para o tab transbordar os bounds.

  **2. Logo com cápsula branca**  
  A `<img src="logo.png">` recebe `background: rgba(255,255,255,0.92); border-radius: 0.5rem; padding: 0.15rem`. A logo é um PNG com transparência — sem a cápsula ela desaparece em sidebars coloridas (Azul, Roxo, Rosa, etc.).

  **3. Elementos colapsados são quadrados 40×40px**  
  `.sidebar-link`, `.sidebar-user` e `.sidebar-logo` no estado `.collapsed` recebem `padding: 0; height: 2.5rem; width: 2.5rem; gap: 0`. O `gap: 0` é obrigatório — com `gap: 0.75rem` o ícone ficava deslocado ~6px para a esquerda mesmo com `justify-content: center`.

  **4. Cores de texto dos cards usam `--card-text`, não `--text-main`**  
  `--text-main` é `#ffffff` nos temas coloridos (Azul, Roxo, etc.) e serve para o fundo da **página** e o interior da **sidebar colorida**. O interior dos **cards brancos** deve usar `--card-text` (sempre escuro, independente do tema). Afeta: `.mes-nav-label`, `.mes-nav-btn`, e qualquer texto dentro de um `var(--card-bg)`.

  **5. Botão "Todos" usa `--btn-bg`/`--btn-text`, não `--sidebar-link-active-*`**  
  As vars `--sidebar-link-active-bg/color` são semitransparentes e otimizadas para o fundo da sidebar. Dentro de um card branco (`var(--card-bg)`), essas vars ficam invisíveis em temas coloridos (ex: branco sobre branco no tema Azul). O par `--btn-bg`/`--btn-text` tem sempre contraste sólido garantido por design em todos os temas.

  **6. Mobile: sidebar ignorada no collapse**  
  O estado `localStorage.bud_sidebar_collapsed` só é restaurado se `window.innerWidth > 768`. No mobile, a sidebar usa o padrão hambúrguer + `translateX(-100%)`.

- **Por quê**: Cada decisão foi motivada por bug visual confirmado em teste cross-tema. A regra central é: **variáveis de sidebar não devem vazar para o interior de cards de página**, e vice-versa.
- **Consequências**: Sidebar totalmente funcional em todos os 8 temas, desktop e mobile. Handler JS de filtro de atividades também atualizado para usar `--btn-bg`/`--btn-text`.
- **Quando revisar**: Quando adicionar mais links de navegação à sidebar (novas telas do app), verificar se os 64px acomodam os ícones ou se é necessário ajustar a largura colapsada.

---

### DEC-034 — Cartões de crédito: coleção unificada, fatura dinâmica e lógica de status

- **Data**: 21/04/2026
- **O que foi decidido**:
  1. **Coleção unificada**: Cartões de crédito são persistidos em `usuarios/{uid}/carteira/{id}` com `tipo: 'credito'` — **NÃO** em uma coleção separada `cartoes`. Campos extras (`bandeira`, `cor`, `fechamento`, `vencimento`, `faturasPagas: {}`, `faturasMetodo: {}`) são adicionados ao mesmo documento da carteira.
  2. **Fatura calculada dinamicamente**: Os campos denormalizados `faturaAtual` e `limiteDisponivel` **NÃO são armazenados** no Firestore. A fatura é sempre calculada em runtime via `calcularFatura(cartaoId, mesKey, transacoes)` somando as `transacoes` com `cartaoId` correspondente, `dataReferencia.startsWith(mesKey)` e `status !== 'estornado' && status !== 'cancelado'`.
  3. **Status da fatura baseado em `mesVisualizado`**: A função `calcularStatusFatura(cartao, mesKey, temGastos)` determina Aberta/Fechada/Vencida/Paga levando em conta o mês que está sendo visualizado, não apenas a data de hoje. Meses passados sem pagamento = Vencida. Mês atual: hoje ≥ vencimento → Vencida; hoje ≥ fechamento → Fechada; else → Aberta. Meses futuros = Aberta.
  4. **MVP sem parcelamento e sem importação IA**: Parcelamento e importação por IA são adiados para sprint futura. O cartoes.js v1 cobre: CRUD de cartão, gastos manuais simples (sem parcelas), toggle de fatura paga/pendente, exclusão com cascade de transações.
- **Por quê**:
  - Coleção unificada elimina o Problema #16 do spec (divergência entre `carteira` e `cartoes`) sem custo adicional. Dashboard e metas.js já operam corretamente na coleção `carteira`.
  - Fatura dinâmica elimina os Problemas #1, #2, #9 (campos denormalizados desatualizados). O custo computacional de recalcular client-side é desprezível (filtro em array em memória).
  - Status baseado em `mesVisualizado` corrige o Problema #12 (status incorreto ao visualizar meses passados/futuros).
- **Consequências**:
  - `dashboard.js` mostra cartões automaticamente (já lê `carteira` com `tipo === 'credito'`).
  - `metas.js` exclui cartões do dropdown de carteiras automaticamente (já filtra `tipo !== 'credito'`).
  - Sem `increment()` em nenhuma operação de gasto/exclusão — operações são apenas `addDoc`/`deleteDoc` na coleção `transacoes`.
  - O campo `faturasPagas: { [mesKey]: true }` marca se a fatura foi paga (apenas como flag UI; não cria transação de pagamento — isso é sprint futura).
  - Exclusão de cartão faz cascade delete de todas as transações com `cartaoId === id` (até 500 por batch).
- **Quando revisar**: Ao implementar parcelamento (sprint 2) e importação IA (sprint 3). Ao implementar pagamento de fatura com débito real na carteira (adicionará `writeBatch` com transação `pagamentoFatura: true`).


---

### DEC-035 — Extração de faturas: pdf-parse + regex local + Gemini fallback; OFX processado client-side
- **Data**: 21/04/2026
- **Contexto**: Implementação do endpoint /api/extrair-fatura e da importação de faturas com IA no frontend.
- **Decisão**:
  1. **PDFs**: Backend usa pdf-parse para extrair texto nativo (< 1s). Parser regex com dupla estratégia (horizontal para PDFs padrão; vertical/bloco para layout Nubank). Gemini 1.5 Flash é acionado via REST apenas como fallback se regex retornar < 2 transações.
  2. **Imagens**: Direto para Gemini 1.5 Flash (JPEG/PNG/WEBP não têm texto extraível).
  3. **OFX/QFX**: Processado inteiramente no cliente (parseOFXLocal). Nunca enviado ao backend. O backend fica livre de dependência de parsing de SGML.
  4. **Sem OpenAI**: A implementação legada usava GPT-4 Vision (lento, caro). Substituído por Gemini Flash (mais rápido, menor custo).
  5. **Timeout**: AbortController de 45s no frontend (vs sem timeout na versão anterior).
- **Alternativas descartadas**:
  - OpenAI GPT-4 Vision: lento (2+ min), caro, sem resposta estruturada garantida.
  - LangChain: overhead desnecessário para uma tarefa de extração pontual.
- **Impacto**: ackend/package.json ganhou multer ^1.4.5-lts.1 e pdf-parse ^1.1.1. Requer GEMINI_API_KEY no Render apenas para imagens e PDFs ilegíveis.
- **Quando revisar**: Se Gemini deprecar a API REST v1beta. Se surgir necessidade de suporte a CNAB ou MT940.


---

### DEC-035 — Extração de faturas: pdf-parse + regex local + Gemini fallback; OFX processado client-side
- **Data**: 21/04/2026
- **Contexto**: Implementação do endpoint /api/extrair-fatura e da importação de faturas com IA no frontend.
- **Decisão**:
  1. **PDFs**: Backend usa pdf-parse para extrair texto nativo (< 1s). Parser regex com dupla estratégia (horizontal para PDFs padrão; vertical/bloco para layout Nubank). Gemini 1.5 Flash é acionado via REST apenas como fallback se regex retornar < 2 transações.
  2. **Imagens**: Direto para Gemini 1.5 Flash (JPEG/PNG/WEBP não têm texto extraível).
  3. **OFX/QFX**: Processado inteiramente no cliente (parseOFXLocal). Nunca enviado ao backend. O backend fica livre de dependência de parsing de SGML.
  4. **Sem OpenAI**: A implementação legada usava GPT-4 Vision (lento, caro). Substituído por Gemini Flash (mais rápido, menor custo).
  5. **Timeout**: AbortController de 45s no frontend (vs sem timeout na versão anterior).
- **Alternativas descartadas**:
  - OpenAI GPT-4 Vision: lento (2+ min), caro, sem resposta estruturada garantida.
  - LangChain: overhead desnecessário para uma tarefa de extração pontual.
- **Impacto**: ackend/package.json ganhou multer ^1.4.5-lts.1 e pdf-parse ^1.1.1. Requer GEMINI_API_KEY no Render apenas para imagens e PDFs ilegíveis.
- **Quando revisar**: Se Gemini deprecar a API REST v1beta. Se surgir necessidade de suporte a CNAB ou MT940.

---

### DEC-036 � Categorias: fonte �nica de verdade via `window.BUD_CATEGORIAS_PADRAO`
- **Data**: 23/04/2026
- **Contexto**: BUG 3 do c�rebro � lista de categorias padr�o estava duplicada em m�ltiplos arquivos JS podendo divergir entre telas.
- **Decis�o**: Criar `js/categorias-padrao.js` como script n�o-m�dulo que exp�e `window.BUD_CATEGORIAS_PADRAO`. Todas as telas que precisam da lista carregam este script.
- **Alternativas descartadas**: ES module export � exigiria reescrever todos os m�dulos consumidores.
- **Impacto**: `categorias.html` j� carrega o script. Demais telas devem adicion�-lo quando forem constru�das.
- **Quando revisar**: Se o app migrar para bundler (Vite/esbuild), substituir pelo import est�tico.

---

### DEC-037 � Categorias personalizadas: liberadas para todos no MVP (sem gate de plano)
- **Data**: 23/04/2026
- **Contexto**: C�rebro especifica custom categories como exclusivas de planos pagos. MVP n�o tem sistema de planos (PEND-001 pendente).
- **Decis�o**: Todos os usu�rios podem criar categorias personalizadas no MVP. C�digo tem coment�rio indicando onde inserir o gate quando PEND-001 for implementado.
- **Quando revisar**: Ao implementar PEND-001 � adicionar verifica��o em `salvarCategoria()` em `js/categorias.js`.

---

### DEC-038 � Refatora��o de cores hardcoded exige revis�o visual nos 8 temas
- **Data**: 27/04/2026
- **Contexto**: Auditoria 27/04 detectou cores hex literais inline (B9/M5/DT-005/DT-006) em alguns elementos.
- **Decis�o**: N�O refatorar em massa para `var(--�)` sem valida��o visual manual em cada um dos 8 temas (padrao, hbo, azul, roxo, rosa, amarelo, verde, vermelho).
- **Por qu�**: Risco de regress�o visual silenciosa supera o ganho de consist�ncia. V�rios hex s�o intencionais (verde-receita / vermelho-despesa devem ficar iguais em todos os temas para acessibilidade sem�ntica).
- **Consequ�ncias**: DT-005 / DT-006 ficam em `PENDENCIAS.md` aguardando sess�o dedicada de revis�o visual com o usu�rio.
- **Quando revisar**: Quando houver disponibilidade para revis�o de UI tema a tema.

---

### DEC-039 � Reposit�rio p�blico � seguro: Firebase Web API keys s�o p�blicas por design
- **Data**: 27/04/2026
- **Contexto**: Auditoria questionou se manter o repo p�blico no GitHub exp�e credenciais Firebase.
- **Decis�o**: Manter `js/firebase-config.js` no `.gitignore` (apenas `firebase-config.example.js` � versionado). O repo pode permanecer p�blico.
- **Por qu�**: As Web API keys do Firebase N�O s�o segredos � elas identificam o projeto, n�o autorizam a��es. Seguran�a real vem de:
  1. **Firestore Security Rules** (controlam quem l�/escreve cada documento)
  2. **Authorized Domains** no Firebase Console (somente dom�nios listados podem usar a key)
  3. **reCAPTCHA Enterprise** (App Check) bloqueia bots
  4. **Email/senha + verifica��o** controlada pelo Auth
- **Consequ�ncias**: N�o h� a��o a tomar para ocultar a key. Foco de seguran�a permanece nas Rules + Authorized Domains + reCAPTCHA.
- **Quando revisar**: Se o Google mudar o modelo (improvável); ou se o app migrar para outro backend.
---

### DEC-040 — Botão "Pago ✓" no widget Próximos Vencimentos + auto-cron no login
- **Data**: 09/05/2026
- **O que foi decidido**:
  1. Cada item do widget "Próximos Vencimentos" no dashboard agora tem um botão "Pago ✓".
  2. Ao clicar, um overlay de confirmação exibe nome, valor e um select de conta debitada.
  3. Confirmar cria uma transação em Firestore (`origem: 'recorrente'`, `recorrenteId` vinculado) — o item some do widget automaticamente via `onSnapshot`.
  4. Para dívidas: além da transação, incrementa `parcelasPagas` no documento da dívida.
  5. O endpoint `/api/processar-recorrentes` é chamado automaticamente no login do usuário (1x por dia por browser, controlado por chave `bud_cron_YYYY-MM-DD` no localStorage).
- **Por quê**:
  - Usuário não conseguia informar que já pagou sem ir à tela de Recorrentes.
  - O botão "Processar Hoje" em Recorrentes era a única forma de acionar o cron, o que não era óbvio.
  - A transação gerada pelo botão inclui `recorrenteId`, garantindo que o widget some e a lógica de deduplicação do backend funcione corretamente.
- **Consequências**:
  - O auto-cron no login garante que, em qualquer dia que o usuário abra o app, as recorrentes do dia são lançadas automaticamente (sem depender de cron externo ou ação manual).
  - Se o usuário usar "Pago ✓" antes do cron rodar, a transação manual tem `recorrenteId` → o cron é idempotente e não duplica.
  - Campos incluídos na transação: `tipo`, `descricao`, `valor`, `categoria`, `data` (Timestamp), `dataReferencia`, `mesReferencia`, `formaPagamento`, `origem:'recorrente'`, `recorrente:true`, `recorrenteId`, `contaId`, `contaNome`, `dataCriacao`.
- **Quando revisar**: Se o endpoint `/api/processar-recorrentes` for substituído por um cron real (Render Cron Jobs, GCP Cloud Scheduler etc.).

---

### DEC-040 - window.BUD_CATEGORIAS_PADRAO como SSOT (fonte unica de verdade)
- **Data**: 27/04/2026
- **Contexto**: Multiplas telas precisam da lista de categorias padrao (Extrato, Metas, Limites, Mercado, Cartoes, Balanco Mensal).
- **Decisao**: js/categorias-padrao.js (script nao-modulo) expoe window.BUD_CATEGORIAS_PADRAO = { despesa:[...], receita:[...] }. Deve ser carregado *antes* do modulo JS de qualquer tela que precise da lista.
- **Por que**: Evita divergencia entre telas; facilita adicao de categorias sem alterar multiplos arquivos.
- **Consequencias**: Toda tela nova deve incluir <script src="js/categorias-padrao.js"></script> antes do modulo principal.

---

### DEC-041 - writeBatch para operacoes atomicas de multiplas colecoes
- **Data**: 27/04/2026
- **Contexto**: Operacoes como "salvar compra + criar N transacoes" ou "fazer aporte + decrementar carteira" precisam ser atomicas.
- **Decisao**: Usar writeBatch em todos os casos onde multiplos documentos devem ser gravados em conjunto (max 500 ops por batch - usar chunks se necessario).
- **Por que**: Firestore nao tem transacoes multi-doc automaticas fora do writeBatch/
unTransaction. Sem atomicidade, falha parcial corromperia dados.
- **Consequencias**: writeBatch + atch.commit() e o padrao para: salvarCompra, handleSubmitAporte, salvarTransacoesIA, copiarLimitesMesAnterior.
- **Quando revisar**: Se alguma operacao ultrapassar 500 docs - usar loop de chunks de 400.

---

### DEC-042 - setDate(1) antes de setMonth() para evitar salto de meses curtos
- **Data**: 27/04/2026
- **Contexto**: Ao navegar de meses com 31 dias para Fevereiro (28 dias), new Date(2026,0,31) + setMonth(1) resulta em 3 de marco.
- **Decisao**: Sempre chamar dataFiltro.setDate(1) ANTES de qualquer setMonth() ou setFullYear() quando o objetivo e trocar de mes/ano.
- **Por que**: Date.setMonth aplica overflow de dias automaticamente; fixar dia=1 antes garante comportamento previsivel.
- **Consequencias**: Padrao obrigatorio em qualquer funcao de navegacao de mes: mudarMes(), selecionarMes() e equivalentes em Extrato, Dashboard, Balanco Mensal.
- **Registrado originalmente como**: BUG-2 em cerebro/balanco-mensal.md.

---

### DEC-044 — Identidade visual de bancos em `carteira.html`: `BANCOS_LOOKUP` + `detectarBanco()`

- **Data**: 14/05/2026
- **O que foi decidido**: Os cards de conta detectam o banco pelo nome (regex case-insensitive) e aplicam identidade visual da marca: (1) gradiente de fundo na cor do banco; (2) ícone como abreviação estilizada ("Nu", "Itaú", "BB" etc.) no lugar do ícone genérico; (3) faixa lateral `border-left` colorida; (4) botões Importar/Extrato com `border-color` e `color` do banco.
- **Por quê**: Reconhecimento visual imediato da conta. UX significativamente mais rica sem adicionar dependência externa (sem API de logos).
- **Consequências**: 21 bancos mapeados em `BANCOS_LOOKUP` (constante top-level em `carteira.js`). `detectarBanco(nome)` retorna `{ bg, text, abbrev }` ou `null`. Contas sem banco reconhecido usam fallback com cor configurada pelo usuário (`conta.cor`). NUNCA usar imagens/SVGs externos para logos de banco — usar abreviação em CSS puro.
- **Quando revisar**: Ao adicionar novos bancos ao sistema.

---

### DEC-045 — `min-width:0` obrigatório em flex items que são containers de conteúdo

- **Data**: 14/05/2026
- **O que foi decidido**: Todo flex item que serve como container principal de conteúdo (`.dash-main`, `.main-content` e equivalentes) deve ter `min-width:0` explícito na regra CSS base.
- **Por quê**: O padrão CSS para `min-width` em flex items é `auto` (= `min-content`). Sem `min-width:0`, o item não encolhe abaixo do tamanho intrínseco do seu conteúdo, causando overflow horizontal em viewports estreitos — mesmo com `flex:1`, `flex-shrink:1` e `margin-left:0 !important` corretamente aplicados no breakpoint mobile. O `body{overflow-x:hidden}` esconde o scroll mas não corrige o layout (elementos continuam renderizados fora do viewport).
- **Consequências**: Regra de prevenção permanente: ao criar qualquer layout flex onde um item deve preencher apenas o espaço disponível, adicionar `min-width:0`. Especialmente crítico para sidebars collapsíveis com `position:fixed` (o único flex filho do container é o `.dash-main`).
- **Quando revisar**: Se migrar para CSS Grid no layout principal (o comportamento padrão do Grid é `min-width:auto` também, mas `grid-template-columns:1fr` já implica `minmax(0,1fr)` na maioria dos browsers modernos).

---

### DEC-046 — Badge de confiabilidade do import: dados reais por fonte, sem mensagens genéricas

- **Data**: 16/05/2026
- **O que foi decidido**: `_renderConfiabilidadeBadge()` em `cartoes.js` não deve usar texto genérico em nenhum caso. Cada fonte tem sua mensagem baseada no que foi efetivamente extraído.
  - **OFX**: `✅ OFX — {N} transações lidas ({K} ativas) · dados estruturados, precisão 100%` (contagens reais de `itensIAExtraidos`)
  - **PDF/Imagem sem total de fatura detectado**: `⚠️ {fonte} — {K} de {N} itens ativos · total extraído: R$ X · sem total de fatura para validar automaticamente`
  - **PDF/Imagem COM total**: fórmula percentual existente (`✅ Valores batem` / `⚠️ Precisão parcial` / `❌ Não confiável`)
- **Por quê**: O usuário importou OFX (dados perfeitos) e viu "precisão não verificável", o que era UX enganosa. Para PDF sem meta, o texto genérico não ajudava — mostrar o total extraído e a contagem real dá informação útil para o usuário decidir.
- **Consequências**: O badge nunca mais é um aviso genérico; sempre reflete o estado real da extração.
- **Quando revisar**: Se adicionarmos novos formatos de import (ex: CSV, XLSX).

---

### DEC-047 — Estrutura de URL multi-produto: /appbudfinance/ + raiz vendas

- **Data**: 20/05/2026
- **O que foi decidido**:
  1. `budsolucoes.com.br` abrigará múltiplos produtos no futuro (ex: `/appbudfinance`, `/appoutro`). Por isso, **não** usar `app.budsolucoes.com.br` (subdomínio genérico).
  2. O domínio raiz `budsolucoes.com.br` (e `www.budsolucoes.com.br`) será a **landing/vendas** — `vendas.html` torna-se o novo `index.html` da raiz.
  3. O app Bud Finance vive em `budsolucoes.com.br/appbudfinance/` — toda a árvore HTML + JS + CSS do app é movida para a subpasta `appbudfinance/`.
  4. O arquivo `CNAME` (GitHub Pages) permanece na raiz apontando `budsolucoes.com.br`.
  5. A pasta `js/`, `css/` e `email-templates/` são movidas para `appbudfinance/js/`, `appbudfinance/css/` e `appbudfinance/email-templates/` — o app é auto-contido dentro da subpasta.
  6. Arquivos que ficam na raiz (fora da subpasta): `index.html` (= vendas), `CNAME`, `manifest.json`, `politica-privacidade.html`.
  7. O backend `FRONTEND_URL` passa de `https://bud-finance.onrender.com` para `https://budsolucoes.com.br/appbudfinance`.
  8. Firebase Auth → URLs autorizadas devem incluir `budsolucoes.com.br/appbudfinance`.
- **Por quê**: Modelo SaaS multi-produto no mesmo domínio institucional. Cada produto tem seu caminho independente. Subdomínio genérico `app.` não escala (exigiria `app2.`, `beta.`, etc.).
- **Consequências**:
  - Todos os ~30 arquivos HTML do app + `js/` + `css/` precisam ser movidos para `appbudfinance/`.
  - Todos os links internos entre páginas do app devem ser relativos (ex: `href="dashboard.html"` dentro da subpasta funciona sem alteração).
  - Links nas páginas que apontam para `index.html` (login) e similares continuam funcionando dentro da subpasta.
  - `back_url` do Mercado Pago e outros callbacks externos precisam ser atualizados.
  - Render Static Site (se usado): ajustar `Publish Directory` para `appbudfinance/` **ou** manter servindo a raiz do repo com a nova estrutura.
  - Ver PEND-082 para o plano de migração passo a passo.
- **Quando revisar**: Ao adicionar o próximo produto em `budsolucoes.com.br`.

---

### DEC-043 — Carteira = hub de Contas & Conciliação; Importar absorvido; Cartões = só crédito

- **Data**: 28/04/2026
- **O que foi decidido**:
  1. `carteira.html` (Minhas Contas) é a tela de gestão de contas de **débito/pix/dinheiro/benefícios** (Nubank conta, Caixa, vale refeição, vale alimentação, vale transporte, etc.) e **não** de cartões de crédito.
  2. Cada card de conta terá um botão “Importar extrato” que abre o fluxo de importação (CSV, OFX, PDF, imagem) **inline**, já com a carteira pré-vinculada.
  3. A tela standalone `importar.html` + `js/importar.js` é **deprecada** e não será construída como tela independente. A lógica de importação será absorvida por `js/carteira.js`.
  4. `cartoes.html` permanece focada exclusivamente em `tipo: 'credito'` (faturas, limites, parcelamento).
  5. A sidebar perde o item “Importar” e ganha “Carteira” (ou “Minhas Contas”).
- **Por quê**:
  - O fluxo natural do usuário é: “estou na conta Nubank → importar extrato desta conta” — não faz sentido navegar para outra tela e repetir a escolha de conta.
  - Elimina uma tela isolada de baixo valor, concentrando poder de gestão onde o dinheiro mora.
  - `cérebro/carteira-importar.md` já documentava essa união desde 06/04/2026.
  - Separação clara: Carteira = débito/benefícios; Cartões = crédito.
- **Estrutura planejada de `carteira.html`**:
  - Grid de cards por conta (nome, banco, tipo, saldo atual)
  - Botão por card: “Importar extrato” → abre modal/drawer inline de upload
  - Fluxo import: drag&drop CSV/OFX/PDF/imagem → preview editável → confirmação → writeBatch em `transacoes` + update `carteira.ultimaConfirmacao`
  - Deduplication: impede importar o mesmo arquivo duas vezes (hash ou range de datas)
  - Aba Conciliação: saldo no app vs saldo do último extrato + diferença
  - CRUD de contas: criar/editar/excluir conta bancária ou benefício
- **Consequências**:
  - `importar.html` nunca será construído como tela standalone; o item 16 do ROADMAP é substituído por `carteira.html`.
  - `js/carteira.js` absorve toda a lógica de `js/importar.js` (parseCSV, parseOFX, extrairFaturaIA, deduplicar, writeBatch).
  - Sidebar de todas as telas precisa ser atualizada: remover "Importar", adicionar "🏦 Carteira" (ou "💳 Minhas Contas").
  - `cérebro/carteira-importar.md` é o documento de referência para a implementação.
- **Quando revisar**: Ao iniciar a sprint de `carteira.html`.

### DEC-052 — Modelo Groq configurável e rejeição de extração truncada
- **Data**: 27/10/2026.
- **Decisão**: centralizar modelo multimodal em `GROQ_MODEL` e orçamento de resposta em `GROQ_MAX_OUTPUT_TOKENS`. Padrão validado: `qwen/qwen3.8-27b`, com texto, imagem e JSON. Referência oficial: https://console.groq.com/docs/vision.
- **Motivo**: nomes hardcoded indisponíveis quebravam fatura, extrato, cupom e classificação; orçamento incompatível com a conta provocava 429.
- **Integridade**: rejeitar extrações/classificações que terminem por `length`, em vez de aproveitar JSON parcial. Usar orçamento local de 900 para a conta atual; documentos longos exigem partes menores ou aumento de cota, não apenas aumento da variável.
- **Escopo de lançamento**: Buddy continua previsto para atualização futura; alterar sua configuração de provedor não altera sua disponibilidade comercial.

### DEC-053 — Repartir a leitura automaticamente e acompanhar trabalho no servidor
- **Data**: 27/10/2026.
- **Motivo**: usuário exige envio do arquivo inteiro sem precisar dividir manualmente. Trocar o modelo e reduzir o orçamento não resolvia faturas longas nem espera por cota.
- **Decisão**: substituir as extrações de fatura/extrato e cupom por `ai-reader.js`; repartir entradas/respostas grandes, aguardar 429 conforme o provedor e recompor resultados. Respostas cortadas não são aproveitadas. Esta decisão substitui a parte da DEC-052 que orientava dividir documentos manualmente.
- **Transporte**: upload com 202 e consulta autenticada de progresso impede que uma espera por capacidade dependa de uma única conexão HTTP longa.
- **Dependências**: `sharp` e `@napi-rs/canvas` para recortes e renderização de PDFs escaneados. Backend passa a exigir Node >=20.9.
- **Limitação de implantação**: trabalhos atualmente em memória. Para execução resistente a reinícios e múltiplas réplicas, persistir a fila e os resultados em infraestrutura compartilhada antes de escalar produção.

## DEC-054 — Leitura direta validada antes da IA (27/10/2026)

Usar parser específico somente em layout reconhecido e conciliado com total explícito. Não tratar regex genérica como leitor universal. Preservar caminho IA para outros layouts e scans. Diferença de total deve aparecer na revisão, nunca gerar lançamento sintético nem estorno presumido. Validação automática do total reduz risco, mas não substitui a revisão das linhas.

## DEC-055 — Candidata de lançamento com artefato público isolado (27/10/2026)

Enviar PDF original para preservar texto e páginas no backend. O leitor local de Dívidas usa OCR somente nas páginas sem texto. Restringir artefato Pages a index/logo/CNAME/appbudfinance/budfinance e extensões públicas; raiz do repositório não deve ser artefato de hospedagem. Bloquear Buddy na função de feature durante esta candidata, conforme escopo de lançamento informado pelo usuário.

## DEC-056 — Exclusão autenticada e aporte atômico (27/10/2026)

Manter exclusão direta de perfil bloqueada para o cliente; usar backend com UID do token, login recente e limpeza recursiva, preservando Auth até concluir dados para permitir nova tentativa em caso de falha. Bloquear exclusão de assinatura identificada até cancelamento prévio; não fazer cancelamento financeiro implícito. Aporte deve gravar meta, transação, débito e histórico no mesmo batch. Regras de depósitos são específicas e mantêm isolamento por titular.

## DEC-057 — Homologar a candidata atualizada e padronizar e-mails (27/10/2026)

Conforme usuário, testar atualizações que substituirão a publicação anterior. Recuperação usa backend e template próprio, mantém resposta pública neutra para preservar privacidade, mas sinaliza falhas de transporte e registra erros de envio no servidor. HTML do EmailJS foi atualizado no serviço com autorização do usuário; Gmail reconectado por ele. Testes de pagamento usam respostas controladas e contas descartáveis, sem equivaler a aprovação de cobrança real.

## DEC-058 — Reconciliação de assinaturas pelo recurso oficial (27/10/2026)

Cobranças recorrentes usam authorized_payments para obter o preapproval associado; falhas não devem ser reconhecidas como sucesso. Responder após processar, limitar consultas ao provedor e permitir reenvio. Expiração segue next_payment_date e não é estendida por repetição do mesmo status.

## DEC-059 — Troca na mesma assinatura, no próximo ciclo (31/10/2026)

Escolha explícita do titular: alterar o contrato existente e conservar plano/acesso atuais até a próxima cobrança aprovada. Não criar segunda assinatura nem cobrar imediatamente pela troca. Preservar data da cobrança e desconto de indicação; valor sempre calculado no servidor. Persistir intenção antes da alteração no MP e permitir repetição para confirmar resultado incerto. Na promoção do plano, exigir pagamento aprovado posterior à data agendada com valor correspondente; não aceitar simples status/replay antigo. Cancelamento continua imediato conforme implementação existente, com texto coerente e limpeza do agendamento. A criação de checkout com assinatura já vinculada fica bloqueada.

## DEC-060 — 31/10/2026 — recuperação de importações e proteção da contratação
Persistir arquivos/resultados fragmentados no Firestore com leases e exclusão temporária, sem salvar bearer tokens. Worker pode repetir chamada externa após queda; a cobrança de cota do app é idempotente por trabalho. Expiração lógica:2h ativo e30min resultado; limpeza no processo, sem depender de TTL. Retomada requer acompanhamento autenticado com jobId. Reservar checkout antes de chamar MP, reutilizar contratação pendente e reter bloqueio em resultado desconhecido até conciliação, evitando segunda cobrança por retry cego. Usuário escolheu troca na mesma assinatura após próxima cobrança aprovada (DEC-059).

## DEC-061 —31/10/2026 — canais de notificação
A pedido do titular, dentro do app somente assinatura/upgrade calculados do perfil atual. Cache legado de comunicados é removido e globais deixam de ser consultados. Lembretes financeiros são push determinístico, sem Buddy, marketing ou lançamentos automáticos. Tokens múltiplos por conta permitem celular/computador, com revogação individual e compatibilidade com token legado. TTL1h evita lembretes antigos entregues após longa desconexão.


### DEC-062 — Confirmação de e-mail leva primeiro ao onboarding

- **Data**: 01/11/2026
- **O que foi decidido**: Depois que o link mágico confirma o e-mail e autentica um cadastro novo, o primeiro destino é `onboarding.html`. A dashboard só deve aparecer após a conclusão do onboarding.
- **Por quê**: Evitar o salto visual da dashboard para onboarding e preservar a sequência prevista para novas contas.
- **Consequências**: `appbudfinance/js/index.js` encaminha o login mágico diretamente ao onboarding; a proteção existente do onboarding envia para a dashboard quando `onboardingConcluido === true`. Correção publicada no `master` pelo commit `f3c0453`; workflow `41338154393` concluiu regressões e deploy com sucesso. Validar a jornada real do link mágico em ponta a ponta.
- **Quando revisar**: Se o cadastro passar a concluir ou pular o onboarding automaticamente.


## DEC-068 — 01/11/2026 — origem de aquisição não equivale a indicação validada

A resposta “Indicação” do onboarding é dado de origem (`comoConheceu`) e, por si só, não vincula uma conta indicadora nem concede benefício. Atribuição de indicação deve depender de código validado até a assinatura. A auditoria encontrou discrepâncias de valor e propagação, registradas em PEND-REF-001. **Falta decidir** quais benefícios cabem ao indicador e ao indicado, percentual e elegibilidade antes de implementar ou divulgar a regra.


### DEC-069 — 01/11/2026 — benefícios do programa de indicação

- **Decisão:** um código válido dá ao novo indicado 15% de desconto somente na primeira cobrança aprovada. O indicador recebe desconto de 50% em uma cobrança futura, uma única vez por conta, liberado após a primeira cobrança do indicado ser aprovada.
- **Sem acúmulo:** se o indicado também tiver uma recompensa de 50% por ter indicado outra pessoa, primeiro é processada sua cobrança com 15%; o desconto de 50% fica para um ciclo posterior. Uma conta só recebe uma recompensa de indicador; indicações além da primeira não geram novos descontos.
- **Elegibilidade técnica:** código deve ser validado e atribuído antes do início da assinatura; autoindicação é recusada. A recompensa é vinculada ao primeiro pagamento aprovado e ajusta a cobrança recorrente da mesma assinatura; depois dessa cobrança o backend restaura o valor integral ou o preço do plano vigente.
- **Consequências:** não criar assinatura duplicada; registrar os estados no Firestore pelo backend; manter a regra nos textos do cadastro, onboarding, vendas e Configurações. Homologar com contas de teste do Mercado Pago antes de publicar.
- **Quando revisar:** se a oferta, os percentuais ou a regra de uma única recompensa mudarem.



## Publicação confirmada — indicações e importação IA (01/11/2026)

- PEND-REF-001: descontos 15%/50% homologados e PUBLICADOS. PR #5 integrado em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado e Render Live confirmado. Regras do Firestore compiladas e publicadas no projeto bud-finance após login do titular.
- ERR-071 / PEND-IA-ESPERA: RESOLVIDO E PUBLICADO pelo PR #6, commit e50356c715886cb9a25d371c67345c4096eebaab. CI do PR 41345953909 e Pages 41346014030 aprovados; Render Live no mesmo commit. HTTP 200 no JavaScript público confirmou prazo global de 210s, mensagem de conexão indisponível e retirada do aviso antigo de 45s.
- Validação: 91 regressões aprovadas; limites persistentes do provedor, workers travados, registro antigo com lease ativa, ausência de resposta e preservação de documentos extensos/PDF/imagem. Fluxos de falha emulados; a fatura original da captura não foi fornecida. Não afirmar que a capacidade do provedor de IA é ilimitada nem que a fatura original foi reimportada.
- Decisão operacional: três tentativas no provedor; esperas de até 15s e total de até 20s por solicitação; worker de 180s; cliente de 210s e conexão de 30s. Falha é explícita, libera a interface/admissão e não retorna transações parciais.
- Relatórios: RELEASE_IA_ESPERA_2026-11-01.md e RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. Código e alterações preexistentes do workspace original preservados; registros locais de continuidade foram atualizados. Próxima reprodução específica depende do documento original, se o usuário relatar erro após atualizar a página.

## DEC-069 — Capacidade e independência do leitor de IA (01/11/2026)

A contratação do Groq Developer fica registrada como aquisição futura, depois de medir volume, consumo e custo. O tier pago aumenta limites e inclui recursos adicionais, mas não torna o serviço ilimitado nem elimina falhas de capacidade. No curto prazo, manter os prazos e o encerramento explícito publicados e acompanhar 429s. Em avaliação futura, comparar arquitetura híbrida (parsers determinísticos, OCR e fornecedor(es) alternativo(s)) com auto-hospedagem de modelo visual aberto em GPU. Cotas por plano do Bud são separadas do limite global do provedor; o plano Plus remove a cota mensal própria do app, mas não a do Groq. Não prometer precisão universal ou operação ininterrupta; esta decisão não autoriza contratação nem desenvolvimento do leitor próprio.

## DEC-070 — Manter Groq como provedor atual e tratar cotas por janela (01/11/2026)

O titular decidiu manter Groq como provedora atual. A compra do Developer fica para o futuro após medir volume e custos (DEC-069). Não tratar o serviço como ilimitado: os limites variam por organização, modelo e janela e são consultáveis pelos cabeçalhos da resposta. Reduzir chamadas desnecessárias com parsers determinísticos validados; manter erro explícito e, em etapa futura, projetar filas justas e contingência. Esta decisão não autoriza contratação nem alteração dos limites comerciais dos planos Bud.

## DEC-071 — revisão explícita de divergência de até um centavo (01/11/2026)
O parser Nubank reconhecido pode devolver linhas originais quando a diferença absoluta ao total declarado não ultrapassa um centavo, com requiresReview/differenceCents e aviso visível antes de salvar. Nenhuma linha ou valor é inventado para fechar o total. Diferenças superiores continuam rejeitadas pelo caminho direto. Isso atualiza a exigência anterior de igualdade exata exclusivamente para este limite de revisão explícita; não altera a regra de não fabricar ajustes.

## DEC-072 — preservar regra de estornos com identidade do par (01/11/2026)
Restaura a regra pedida pelo titular: compra comprovadamente estornada e crédito correspondente ficam desmarcados e fora do saldo juntos. Pareamento usa descrição/data/valor e exige candidato único. Crédito que não tenha compra identificável permanece negativo e explicitamente rotulado como Crédito na fatura para não perder o abatimento legítimo. Nenhuma inferência apenas por valor nem ajuste sintético para fechar total. Revisão mostra soma persistível; crédito/compra mantêm rastreabilidade. A seleção errada e reimportação duplicada são bloqueadas no caminho PDF validado. Substitui a seleção indiscriminada de todos os sinais registrada na entrega anterior.


## Identificação de estornos por linha — 01/11/2026
A regra de pareamento DEC-072 foi revogada: sem vínculo explícito do fornecedor, semelhança de descrição/data/valor não comprova cancelamento de compra. Cada valor positivo permanece compra ativa. Cada valor negativo explícito permanece devolução, com rótulo Estorno / devolução — abate o total da fatura; status interno credito representa abatimento de despesa, nunca receita. No caminho PDF validado todas as linhas originais são elegíveis, com controles habilitados; saldo líquido e guard de conciliação impedem salvar apenas compras omitindo devoluções. Removidos pareamento e rótulo crédito sem compra identificada. 95 regressões aprovadas, incluindo compras/devoluções na mesma data com mesmo valor e persistência/recálculo. Tentativa de rever reparação anterior foi interrompida sem gravações por precondição; consulta atual encontrou zero lançamentos na fatura/cartão anterior, portanto nada foi recriado. Não sobrescrever alterações do titular. Publicação em preparação. Esta atualização substitui os registros anteriores de exclusão automática dos pares.
## Revisão segura de estornos e conferência — 01/11/2026

Regra aprovada pelo titular: compra e devolução ficam desmarcadas juntas apenas com vínculo seguro; recompra permanece ativa. Identidade por mesmo valor/estabelecimento/data não basta. Implementação usa identificador bancário OFX compartilhado, exatamente duas linhas de sinais opostos e saldo zero; grupos ambíguos e estornos parciais permanecem separados. Sem identificador, o PDF mantém compras e abatimentos assinados e exige revisão; não declarar que os estornos desse PDF foram todos pareados. Seleção de um par identificado é conjunta; alteração que quebre saldo zero é bloqueada antes de salvar. Ação em massa Compras e abatimentos preserva devoluções sem par. Edição preserva sinal negativo.

Barra de conferência restaurada como progressbar visível e atualizada a cada seleção/valor: compara a soma selecionada ao total declarado, informa divergência exata, inclusive um centavo, e não afirma precisão universal nem 100% para OFX. Sem referência, informa impossibilidade de conciliação automática. Valores originais preservados, sem ajustes sintéticos. Guardas de duplicação e total permanecem.

Histórico verificado: e50356c (espera infinita) alterou apenas 2 linhas de cartoes.js relacionadas à espera; a classificação anterior já continha exclusão de negativos, FITID e inferência por valor. Portanto, a regra segura atual não era integralmente garantida antes. Alterações posteriores do parser/seleção alteraram o comportamento, documentadas nos PR10/11/13/14.

Validação: 97 regressões passaram; após ampliar o teste de persistência do par+recompra, 10 testes específicos passaram. Teste VM executa processamento, gravação e recálculo reais com Firestore emulado: somente a recompra é salva; valores repetidos sem identificador não são associados. Teste da barra cobre seleção que aumenta o total e divergência de um centavo. Deploy e inspeção pública pendentes neste registro.

Conta do titular: Plus concedido por autorização expressa e precondição Firestore; expiração de trial removida, nenhuma cobrança criada. Validação anterior online do PR14 abriu 51 linhas selecionadas e zero controles bloqueados, sem gravar lançamentos. Esta concessão substituiu a proposta de devolver quatro usos. Groq permanece com capacidade finita para imagens/layouts sem parser; Developer é aquisição futura. Não anunciar disponibilidade universal ilimitada.

Continuidade Claude/Codex: workspace original tem alterações preexistentes; preservá-las. Trabalho isolado em .tools/invoice-reconciliation-ui, branch codex/revisao-estornos-conciliacao-20261101. Próximo passo: conferir CI/publicação e a barra no app online. Nenhum dado financeiro privado incluído no Git; nenhum registro do usuário recriado ou salvo nesta entrega.




## Categoria padrão de estorno — 02/11/2026
A pedido do titular, Estorno / devolução incluída exclusivamente nas categorias padrão de despesa (categorias-padrao.js). A revisão de faturas (cartoes.js) prioriza esta categoria para status credito e descrições explícitas de estorno/devolução/reembolso; não usa Outros nem a categoria do estabelecimento para esses itens. Preserva valores negativos, seleção, pares, conciliação e persistência como despesa; não cria receita. Compras normais e pagamentos de fatura mantêm a classificação anterior. Não migra registros existentes. Teste específico cobre categoria padrão presente uma vez em despesas e ausente em receitas, classificação e sinais; 13 testes de fatura aprovados. Publicação em preparação na branch codex/categoria-estorno-padrao-20261102. Claude/Codex: preservar a regra de abatimento, sem inflar renda.
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


## Identidade visual, data e encerramento do cadastro contratual — 02/11/2026

Pedidos do titular: aplicar IDV aos botões, identificar/formatar data e fechar popup ao concluir o cadastro. Mudanças em dividas.html/dividas.js: ações de seleção uniformes com cores do tema, tipografia herdada, bordas arredondadas, hover/foco/disabled e adaptação mobile; botão de cadastrar reutiliza wizard-btn-next; revisar/completar tem estilo próprio coerente e campos usam modal-input. Data tem ícone de calendário, placeholder DD/MM/AAAA, teclado numérico e máscara aplicarMascaraData já usada no app;10102026 torna-se10/10/2026, validada antes de salvar, sem converter datas inválidas.

Sucesso confirmado da transação fecha o popup, inclusive quando apenas as completas foram cadastradas; falha mantém revisão/campos para nova tentativa. Havendo pendentes selecionadas após sucesso, aviso na lista de Dívidas permite Revisar pendentes ou Descartar rascunho; iniciar Nova dívida retoma a pendência em vez de apagá-la silenciosamente. Descartar limpa apenas memória, nunca documentos salvos. Trocar documento ou recarregar ainda descarta rascunho não salvo, avisado na interface. Esta decisão substitui manter popup aberto após cadastro parcial, descrito no release de lote. Nenhum dado financeiro alterado por estes ajustes de interface.

109 regressões aprovadas: máscara com8 dígitos, validação de data, fechar após sucesso com pendentes, manter aberto em falha, retomar revisão preservada e descartar sem excluir dívidas, além da suíte financeira anterior. Testes de persistência seguem em simulação; não cadastrar dívidas reais para conferir interface. Branch codex/design-e-data-contratos-20261102, cópia .tools/contracts-design-fix. Publicação e conferência visual online pendentes neste registro. Atualizar handoff/pendências após implantação para Claude/Codex.



## Pagamento de parcelas na própria dívida — 02/11/2026
Implementado e validado localmente; publicação em preparação. Dívidas abre popup com data DD/MM/AAAA e escolha entre conta e apenas marcar como pago; não exige Dashboard. Com conta, uma transação Firestore grava parcela, despesa, saldo e histórico. Sem conta, apenas dívida e histórico, sem despesa geral. A aba Extrato mostra valor, data efetiva, vencimento, conta/modo e desfazer; registros antigos sem esses dados ficam explicitamente incompletos, sem inferir conta do contrato. Dashboard reutiliza serviço e popup para dívidas. Não realiza transferência bancária.
Preserva modelo de parcelas pagas consecutivas: clicar numa parcela posterior pede confirmação explícita de todo o intervalo pendente e seu total. Desfazer apenas a última; devolve à conta original do pagamento, não à conta padrão atual, e mantém auditoria. Parcelamento de fatura libera limite reservado nas duas opções; desfazer restaura o valor exato liberado. Migração legada não fabrica despesas para registros novos sem conta.
Arquivos novos debt-payments.js e debt-payment-dialog.js; integração em dividas.js/html e dashboard.js/html. Histórico em usuarios/{uid}/pagamentos-dividas; regras genéricas existentes de proprietário já cobrem a coleção. Sem backend/regras novas. 117 testes de release aprovados (8 novos casos financeiros com adaptador transacional em memória). Teste local em Edge headless 375px passou: seleção de conta, máscara, erro preservado, retry, fechamento, marcar sem conta e cancelar. Sintaxe e diff conferidos. Não afirmar teste de escrita real no Firestore: nenhuma parcela/conta real foi alterada. Branch codex/pagamento-parcelas-na-divida-20261102, clone .tools/debt-payment-fix. Próximo passo: publicar e conferir popup/extrato online sem confirmar pagamento real. Atualizar este registro com commit e deploy para Claude/Codex.


## Pagamento em Dívidas publicado e conferido — 02/11/2026
RESOLVIDO E PUBLICADO pelo PR28, commit36822e65fe1bcb9247a74147fb6611e4b218984e. CI41488897583/41488880756 e Pages41489122282 aprovados. HTTP200 confirmou versão20261102-payment e serviço público. No navegador autenticado: clicar na primeira parcela abriu popup na própria Dívidas; data local correta; contas de débito/espécie carregadas; seleção de conta e opção apenas marcar funcionaram; confirmar ficou disponível após escolha. Clicar na segunda parcela mostrou explicitamente intervalo1a2 e valor total dobrado. Ambos cancelados sem confirmar. Aba Extrato consultou a coleção com sucesso e mostrou vazio para dívida sem pagamentos. Nenhuma parcela, dívida, transação ou saldo real foi alterado nesta conferência.
117 regressões aprovadas e teste local mobile Edge aprovado; gravação, idempotência e reversão financeira validadas com adaptador transacional em memória, não por escrita real no Firestore. Não afirmar execução de transferência bancária: o app só registra o pagamento informado. Extrato preserva data efetiva, vencimento, valor, conta/modo e desfazer; sem conta não gera despesa geral. O código compartilhado também atende lembretes de dívida da Dashboard. Esta anotação encerra publicação/QA pendentes do registro anterior; Claude/Codex devem preservar estas regras e atualizar os documentos a cada evolução. PDF privado não foi enviado ao Git.



## Aviso no simulador de quitação — 02/11/2026
Pedido do titular implementado em appbudfinance/dividas.html: aviso permanente no rodapé do popup, comum a Pagamento Extra e Quitar Tudo. Texto: “Estimativa baseada nos dados informados por você ou extraídos por IA. O valor pode diferir do cobrado pelo credor. Confirme diretamente com ele antes de pagar.” Usa tipografia e cor secundária do tema. Não muda fórmulas nem registros financeiros. Validação visual local e publicação em preparação na branch codex/aviso-simulador-20261102, cópia .tools/debt-simulator-note. Próximo passo: validar layout, publicar e conferir aviso público; atualizar continuidade para Claude/Codex.



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




## Push e explicação de investimentos — 02/11/2026
Removidos card Alertas por Push de Insights e botão/handler Testar de Personalização. Ativar/Desativar por dispositivo permanece. Removida referência a Buddy futuro da descrição. Correção showForegroundNotification mescla notification com data para preservar título/corpo quando data é objeto vazio, mantendo precedência de data e restrição de URL. Imports usam versão20261102-content; páginas alteradas versão20261102-push-ui.
Diagnóstico real autorizado do próprio dispositivo: teste no navegador interno registrou token, servidor200 e log Mensagem recebida neste navegador. Central do Windows mostrou Não incomodar ativado (somente faixas para alarmes). Não alterar preferência do sistema sem pedido. Chegada FCM não comprova faixa visível; entrega móvel informada pelo titular.131 regressões aprovadas, incluindo teste de data vazio, precedência de conteúdo e URL externa bloqueada. Nenhum envio coletivo; um teste somente ao dispositivo atual solicitado no diagnóstico. Publicação em preparação.
Investimentos é controle manual: salva valor aportado, atual, tipo, instituição, liquidez, data/vencimento; não transfere dinheiro, não debita conta, não aplica e não rende automaticamente. Rendimento é diferença entre atual e aportado; anualização só após30dias. Simulador usa taxa mensal fixa, capitalização mensal e aporte no fim do mês, prazo em meses; resultados brutos sem impostos/taxas/inflação, sem salvar investimento ou movimentar conta. Nenhuma fórmula alterada nesta tarefa.
Continuidade: clone .tools/push-investments-fix, branch codex/push-investimentos-20261102; concluir PR/deploy e conferir remoções online sem alterar dados. O PR33 anterior foi publicado em139375ab1278b9d56e8ed060b8b0df460b23fda0, Pages41528622548 aprovado; encerra publicação pendente dos registros anteriores. Claude/Codex devem manter evidências, status e limites atualizados.



## Perfil sincronizado, revogação persistente e fechamento removido — 02/11/2026
Implementado em .tools/profile-sync-fix, branch codex/sincronizacao-perfil-20261102. Sidebar tinha leituras pontuais e não recebia atualização feita em outro dispositivo. Novo profile-sync.js observa o documento do usuário em todas as telas com sidebar, aplica foto/nome, remove foto quando ausente e limpa listener ao trocar/sair de conta; callbacks antigos são ignorados por geração. bud-utils importa módulo compartilhado; HTMLs recebem versão20261102-profile.
Revogar consentimento passa a usar DELETE autenticado de todos os dispositivos, limpa fcmToken/fcmTokens e grava pushConsentRevoked e timestamp no backend em transação. Registro silencioso após revogação retorna403; somente consent:true de clique explícito Ativar libera novamente o dispositivo. Desativar comum continua revogando só um dispositivo. Foreground respeita marcador do perfil; mensagens já em trânsito podem ainda chegar. Não altera e-mails, assinatura nem permissão nativa do navegador. Nenhuma revogação de conta real foi feita para teste.
Titular solicitou remover diaFechamento sem uso: removidos campo, leitura e escrita de Configurações; valor legado não é apagado no banco. Confirmado checkout frequency1/frequency_type months; titular escolheu manter mensal na data definida pelo Mercado Pago, não30dias fixos. Não alterar frequência nem contratos reais.
133 testes de release aprovados, incluindo sequência de fotos recebidas por tela aberta/troca de conta e revogação global→refresh403→ativação explícita. Testes em memória, não duas gravações reais em dispositivos. Ping passa a expor revisão Render (commit público, sem segredos) e pushConsentVersion1 para identificar a implantação do backend. Publicação e QA online em preparação; próxima ação PR/deploy e verificar interface/versão sem modificar perfil real. Claude/Codex devem registrar conclusão e limites.



## Exclusão abrangente e testes de segurança — 02/11/2026
Titular autorizou correções/testes fictícios e, em resposta específica, publicação de regras, índice e app/backend. Sem ataque à produção ou exclusão de contas reais. Cópia .tools/security-hardening, branch codex/exclusao-e-seguranca-20261102.
Exclusão: lock privado antes da limpeza; login recente e confirmação preservados; assinatura/checkout em andamento bloqueiam encerramento. Conta desabilitada e sessões revogadas; todos os verificadores de token do backend checam revogação. Regras impedem uso de token antigo durante encerramento. Limpeza cobre árvore usuarios/uid, chamados, alertas_financeiros, plano_historico próprio, referencias de indicação em terceiros e registros admin/admins; remove identidade de autoria em histórico alheio/comunicados compartilhados sem apagar dados de outros clientes nem benefícios ganhos. Retries duráveis após falha, lease para evitar workers concorrentes, varredura após5min contra gravações já em trânsito e final após65min; então apaga referência técnica mínima (UID na chave e tempos/estado, sem contato ou conteúdo financeiro). Dados pessoais começam a ser removidos imediatamente, não há espera comercial. Se falhar, HTTP202 informa pendência em vez de afirmar conclusão; limpeza retoma em manutenção de60s e reinícios. Janela técnica pode estender-se durante indisponibilidade; não prometer SLA físico de65min.
Segurança: guard global para API/checkout com checkRevoked e barreira de exclusão; rate limit persistente300/min por HMAC do UID autenticado, ou da conexão em solicitações anônimas (sem guardar IP bruto nem confiar em X-Forwarded-For do cliente; usuários autenticados sob mesmo proxy não compartilham o contador), contadores removidos após expiração pela manutenção, sem afetar cota do plano. Ping público e webhooks MP autenticados ficam fora dessa contagem. WhatsApp fora do lançamento bloqueado404 no backend e removido log de corpo completo. Headers de proteção no backend, limites de partes/campos de upload. Dependências multer2.5.0 e override uuid11.1.1: npm audit produção0 avisos após8moderados transientes iniciais e verificação de releases oficiais do upload. Não ativado App Check sem a configuração e validação de clientes; não afirmar pentest completo/ausência de vulnerabilidades.
Emuladores demo-bud-security somente localhost127.0.0.1 (Auth19199/Firestore18080), sem credenciais ou chamadas de IA/pagamento/email reais:5 grupos passaram (isolamento/autopromoção/privados; exclusão/vínculos/sessão antiga/recriação/varredura; limite persistente por instância; backend completo/forgedtoken/nonadmin/webhook inválido/WhatsApp404; upload válido e excesso bloqueado).134 regressões passaram, inclusive retry de falha e remoção do lock em testes em memória. Scripts de empacotamento preservam apenas frontend e verificam novo módulo security-guard.
Infra somente leitura: MFA da proprietária Google confirmado ativado; IAM exibiu proprietária e serviceaccount do Firebase com papéis de serviço, nenhuma permissão/chave alterada. Firestore Spark mostrou recursos de backup/PITR dependentes de upgrade; isso não prova ausência de exportações/cópias de terceiros. Política v1.7 explicita início imediato e referência técnica, preservando ressalvas legais e dos prestadores; cadastro registra versão nova sem alterar histórico existente. Consulta ANPD/art16 confirma eliminação quando não há fundamento para conservação, sem inventar prazo genérico.
Revisão automática bloqueou o primeiro deploy por falta de autorização explícita; titular autorizou e as regras foram compiladas/publicadas com sucesso. Índice de collectionGroup indicacoes/indicadoUid também publicado sem remover índices existentes. Backend e frontend aguardam PR/deploy nesta anotação. Próximo: confirmar índice disponível, testes/pacote finais, integrar e verificar revisão em ping, páginas e bloqueios anônimos sem contas reais. Limites: não apagar logs históricos/e-mails/registro MP de terceiros ou backups por este endpoint; não prometer isso. Claude/Codex devem manter registros e concluir status após deploy.



## Troca de plano com ajuste proporcional — 02/11/2026
Decisão expressa do titular: upgrade cobra somente (preço do destino menos preço atual) multiplicado pela fração restante do ciclo efetivamente pago. Usa datas reais, não30dias fixos; mantém assinatura e data mensal de renovação. Checkout avulso de ajuste não cria segunda assinatura. Libera plano apenas após pagamento aprovado consultado no Mercado Pago pelo webhook autenticado. Desconto de indicação vigente no ciclo é preservado na proporção; benefício futuro permanece na próxima renovação. Downgrade continua na renovação após cobrança aprovada; agendamento anterior de upgrade é substituído pela nova regra para novos pedidos.


## Mobile, rotas limpas e categorias — 02/11/2026
Decisão do titular: todas as telas do app sem.html na URL; categorias sempre alfabéticas e popup central. Usar rotas extensionless já atendidas pelo GitHub Pages, sem barra final, mantendo arquivos/links legados e parâmetros de autenticação. Não fingir dados ou plano gratuitos para encerrar loading. Antecipar dados não financeiros da própria sessão sem remover validação de sessão. Pix continua meio de pagamento e mantém tipoReceita/Despesa conforme direção explícita do extrato.

## Planos e trial — 04/11/2026
Candidata em .tools/ui-checkout-nav, branch codex/cancelamento-pendente. Alterações preexistentes de checkout preservadas. Nova regra: Free 1 conta/1 cartão/5 lançamentos, Starter 1/1/10, Pro 2/2/15 +5 importações +5 serviços IA, Plus sem cotas do app nos recursos disponíveis. Free/Starter sem importações/IA. Trial72h equivale Plus, depois acesso efetivo Free; guarda trialIniciado para não reiniciar. Titular confirmou: cada parcela consome cota no mês da fatura.
Implementação: backend/plan-policy.js e financial-write.js; gravações financeiras passam por endpoint autenticado, transação e ledger privado por usuário/mês; adapter financial-firestore.js mantém contratos dos helpers de metas/dívidas. Regras negam escrita financeira direta pelo cliente e acesso aos ledgers. Cota inclui registros existentes no bootstrap por competência; apagar lançamento não devolve cota. Contas/cartões mais antigos dentro do limite continuam ativos; excedentes preservados e bloqueados. Identidades de importação impedem contar novamente o histórico da mesma importação. IA verifica cota também no commit para evitar concorrência. Trial e expiração usam transações para não sobrescrever plano pago concorrente.
UI: comparativo em caixas com ícones, bloqueios de recursos premium/contas excedentes, textos de trial e Pro corrigidos. Site sem alegações de importação universal/tempo garantido e sem depoimentos ilustrativos apresentados como reais; limites e política alinhados. Plus não elimina limites/indisponibilidade do fornecedor.
Validação:164 testes de release aprovados,3 testes adicionais do adapter aprovados; emulador Firestore/Auth demo-bud-security comprovou gravações concorrentes (somente uma passa no último slot), lote inteiro recusado quando mês futuro cheio, trial expirado e escrita direta403. Nenhuma alteração em produção ou usuário real.
ATENÇÃO implantação coordenada obrigatória: publicar backend com endpoint novo, frontend correspondente, depois regras; não publicar apenas as regras nem frontend contra backend antigo. Revisão visual/mobile e conferência final da candidata em andamento. Não declarar publicado. Cache/versionamento e registros finais precisam acompanhar entrega. Não misturar expiração automática de checkout de15min ou descontos de recuperação: continuam fora desta tarefa.


## Segurança e recuperação — validação local concluída (04/11/2026)
178 regressões e8 cenários Auth/Firestore emulados aprovados. Pacote público104arquivos verificado, sem padrões de credenciais privadas. Implementados owner-notifications.js (fila transacional por evento/dispositivo, destinatário corporativo escolhido pelo titular, admin+Auth verificado+consentimento), security-controls.js (headers/erros/revogação de sessões), regras de revogação e campos push protegidos, scan-public-artifact.cjs no CI e recuperação financeira AES-256-GCM com restore exclusivo em emulador vazio. Cadastro é evento do início de trial; contratação só após pagamento aprovado; abandono pendente não é cancelamento. Nenhum dado/envio real, mudança de infraestrutura ou publicação. Não há garantia de entrega física ou ausência de vulnerabilidades.
Relatório operacional: RELEASE_SEGURANCA_RECUPERACAO_2026-11-04.md. Ativação exige deploy coordenado junto dos planos, índice da fila, conta corporativa admin verificada e push ativo no celular. Backups automáticos gerenciados/Blaze, App Check/WAF e revisão especializada NÃO foram ativados; não marcar toda PEND-SEG-REVISAO como resolvida. Preparação e validação desta entrega concluídas; implantação/infraestrutura permanecem pendentes. Claude/Codex devem preservar alterações anteriores e atualizar status com evidência após implantação.


## Prioridade definida pelo titular — Finance antes do Gestor (04/11/2026)
O titular esclareceu que Bud Gestor será desenvolvido após finalizar Bud Finance; será central administrativa de todos os aplicativos. NÃO ampliar nem publicar Gestor nesta etapa. Preparação preservada na candidata, sem alterações em clientes: /budgestor com Auth nomeado, Web App Firebase distinto, worker/manifest e dispositivos administrativos privados. Web App bud-gestor registrado no mesmo projeto Firebase; não criou usuários, concedeu papéis nem publicou site. Notificações foram adaptadas para dispositivos do Gestor, sem fallback para tokens pessoais do Finance.
Estado:184 testes de release aprovados; pacote109arquivos e scanner aprovados. Browser local está desativado nas configurações do Work; não houve QA visual. Tentativa HTTP localhost recebeu EACCES no ambiente restrito; revisão automática da repetição autorizada falhou por limite de uso, não por classificação de insegurança. Não contornar a revisão e não declarar essa conferência executada.
ATENÇÃO: candidata atual inclui redirecionamento do admin antigo e rotas/arquivos novos do Gestor. Antes de publicar SOMENTE Finance, separar esses arquivos e os hooks administrativos numa entrega futura, preservando admin antigo funcional; não basta omitir a pasta budgestor do pacote. Também não ativar a fila administrativa com tokens do Finance para compensar essa separação. Próximo passo é revisar/segregar escopo de publicação do Finance (planos, trial, cotas e segurança), mantendo Gestor preparado sem implantação. Nenhum deploy ou envio real nesta etapa.


## Separação Finance/Gestor concluída — 04/11/2026
RESOLVIDA a pendência de separar o Gestor da candidata Finance. Preparação preservada em deferred/budgestor-20261104/snapshot,22arquivos com SHA-256 em manifest.json e roteiro de retomada no README. Pasta fora do pacote público e das dependências ativas do backend. Restaurados admin.html/admin.js anteriores a partir do artefato pré-Gestor; removidos redirecionamento do login, URLs administrativas novas, API Gestor, produtor/worker da fila de eventos e índices exclusivos. Não foi reativado envio administrativo para tokens pessoais do Finance. Planos, trial, cotas, segurança e recuperação financeira anteriores foram preservados. A negativa de acesso à coleção privada _owner_events permanece como defesa, sem produtores/consumidores ativos.
Validação:175 testes de release aprovados; redução de184 corresponde aos10 testes do Gestor/fila arquivados e1 teste novo que impede misturar Gestor no Finance. Pacote público104arquivos validado, scanner aprovado. Admin antigo incluído e nenhuma pasta budgestor/deferred no artefato. Web App Firebase já cadastrado permanece reservado, sem site ou backend do Gestor publicado. Sem deploy, cobrança, cancelamento, envio real ou alteração de dados de clientes. Próximo passo do Finance: revisar/publicar a candidata segregada conforme autorização; Gestor só retomar após finalizar Finance. Não copiar snapshots compartilhados inteiros sobre versões futuras; reaplicar somente diferenças por branch própria.

09/11/2026: pendências financeiras de recorrências voltam à Dashboard por solicitação expressa. Recebimento exige confirmação do valor/data/conta e gravação atômica de saldo e extrato, sem pagamento automático de dívidas.

10/11/2026: benefícios têm saldo próprio em Contas, sem fatura/limite de crédito. Conversão exige saldo real informado; limite não vira saldo. Conciliação explícita evita recarga duplicada e mantém cota vigente de contas.
