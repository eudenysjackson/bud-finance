# DECISIONS_LOG.md — Registro de Decisões Arquiteturais

**Projeto**: Bud Finance  
**Última atualização**: 21/04/2026

> **REGRA**: Antes de refatorar qualquer padrão, ler este doc primeiro.  
> Toda decisão não-óbvia deve ser registrada aqui.

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
- **Quando revisar**: Se o Google mudar o modelo (improv�vel); ou se o app migrar para outro backend.
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
- **Por que**: Firestore nao tem transacoes multi-doc automaticas fora do writeBatch/unTransaction. Sem atomicidade, falha parcial corromperia dados.
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
