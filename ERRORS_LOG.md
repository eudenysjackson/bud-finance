# ERRORS_LOG.md — Memória de Cura

**Projeto**: Bud Finance  
**Última atualização**: 16/05/2026

> **REGRA**: Antes de resolver um bug, verificar se já foi resolvido aqui.  
> Todo erro encontrado deve ser registrado neste doc.

---

## Formato

```
### ERR-XXX — [Descrição curta]
- **Data**: DD/MM/AAAA
- **Descrição**: O que aconteceu
- **Causa raiz**: Por que aconteceu
- **Solução aplicada**: O que foi feito
- **Regra de prevenção**: Como evitar no futuro
```

---

### ERR-001 — Cadastro sem CAPTCHA
- **Data**: 15/04/2026
- **Descrição**: Formulário de cadastro não tinha nenhuma proteção anti-bot.
- **Causa raiz**: reCAPTCHA não foi planejado na primeira versão.
- **Solução aplicada**: Adicionado `getRecaptchaToken()` em `cadastro.js` com placeholder e fallback `__DEV_SKIP__` em dev. Site key em `firebase-config.js`.
- **Regra de prevenção**: Todo formulário público deve ter reCAPTCHA.

---

### ERR-002 — trialFim calculado no client-side
- **Data**: 15/04/2026
- **Descrição**: Data de fim do trial era calculada com `new Date()` do browser (timezone/relógio manipulável).
- **Causa raiz**: Lógica de data feita no front-end.
- **Solução aplicada**: Removido cálculo de `trialFim` do cadastro.js. Delegado a Cloud Function `onCreate`. Usado `serverTimestamp()` para `dataCadastro`.
- **Regra de prevenção**: Nunca calcular datas business-critical no cliente. Usar `serverTimestamp()` ou Cloud Functions.

---

### ERR-003 — Senha temporária em texto plano no email
- **Data**: 15/04/2026
- **Descrição**: Fluxo original gerava senha temporária e enviava no email de boas-vindas em texto plano.
- **Causa raiz**: Decisão de design insegura.
- **Solução aplicada**: Redesenhado: usuário agora escolhe a própria senha no formulário. Email de boas-vindas **não** contém senha. `primeiroLogin: false`.
- **Regra de prevenção**: Nunca transmitir senhas por email. Usuário sempre escolhe a própria senha.

---

### ERR-004 — Chaves EmailJS hardcoded no código
- **Data**: 15/04/2026
- **Descrição**: `publicKey`, `serviceId`, `templateId` do EmailJS estavam inline no JS.
- **Causa raiz**: Implementação rápida sem separar configuração.
- **Solução aplicada**: Migrado para `window.BUD_EMAILJS_CONFIG` (Object.freeze) em `firebase-config.js` com placeholders `__PLACEHOLDER__`.
- **Regra de prevenção**: Todas as chaves de API devem ficar em `firebase-config.js` com placeholder.

---

### ERR-005 — lgpdConsentimentoData usava new Date() do client
- **Data**: 15/04/2026
- **Descrição**: Timestamp de consentimento LGPD era `new Date()` — manipulável e timezone-dependent.
- **Causa raiz**: Implementação sem considerar auditoria.
- **Solução aplicada**: Trocado para `serverTimestamp()` do Firestore (imutável, timezone-proof).
- **Regra de prevenção**: Timestamps de compliance (LGPD, termos) sempre `serverTimestamp()`.

---

### ERR-006 — emailVerificationRequired decorativo
- **Data**: 15/04/2026
- **Descrição**: Flag `emailVerificationRequired` no Firestore controlava se email devia ser verificado, mas era setada no front (manipulável).
- **Causa raiz**: Design confiava em flag client-side.
- **Solução aplicada**: Removida dependência da flag em `index.js`. Agora ALL users devem ter `user.emailVerified === true`.
- **Regra de prevenção**: Verificação de email é regra server-side via Firebase Auth, nunca depender de flag Firestore.

---

### ERR-007 — indicações como arrayUnion (impossível remover item)
- **Data**: 15/04/2026
- **Descrição**: Indicações eram armazenadas como array no doc do indicador. Impossível remover/editar um item específico.
- **Causa raiz**: Modelagem simplificada demais.
- **Solução aplicada**: Migrado para subcollection `usuarios/{uid}/indicacoes/{indicadoUid}` com campos próprios.
- **Regra de prevenção**: Arrays no Firestore só para dados imutáveis e pequenos. Dados editáveis → subcollection.

---

### ERR-008 — Recuperar senha: toast invisível (redirect imediato)
- **Data**: 15/04/2026
- **Descrição**: Após enviar link de recuperação, toast de sucesso aparecia mas redirect era imediato — usuário não lia a mensagem.
- **Causa raiz**: `window.location.href` executado sem delay.
- **Solução aplicada**: Adicionado `setTimeout(redirect, 3000)` + safety timeout de 30s para re-habilitar botão se rede falhar.
- **Regra de prevenção**: Após toast de sucesso com redirect, sempre dar 2-3s de delay.

---

### ERR-009 — Recuperar senha: res.ok não verificado
- **Data**: 15/04/2026
- **Descrição**: Fetch para Cloud Function não verificava `res.ok` antes de chamar `res.json()`, causando parse error em respostas 4xx/5xx.
- **Causa raiz**: Happy-path only.
- **Solução aplicada**: Adicionado `if (!res.ok) throw new Error('HTTP ' + res.status)` antes de `res.json()`.
- **Regra de prevenção**: Todo `fetch()` deve verificar `res.ok` antes de parsear body.
- **Status**: Resolvido em 17/04/2026 (fix aplicado em `js/recuperar-senha.js`).

---

### ERR-010 — Recuperar senha: design inconsistente com login
- **Data**: 15/04/2026
- **Descrição**: Página de recuperação usava `bg-slate-50`, `rounded-1.5rem`, `max-w-xs` — diferente do login (glassmorphism, blobs, `rounded-2rem`).
- **Causa raiz**: Desenvolvida separadamente sem referência ao design system.
- **Solução aplicada**: Refeita com mesmos blobs (blue+cyan), glass card (`rounded-2rem`, `backdrop-blur-24px`), `max-w-24rem`.
- **Regra de prevenção**: Toda nova página auth deve copiar a base do `index.html` (blobs + glass card).

---

### ERR-011 — oobCode ausente no reset de senha
- **Data**: 16/04/2026
- **Descrição**: Backend retornava `{success: true}` sem `oobCode` ao tentar resetar senha de usuário existente.
- **Causa raiz**: Domínio de redirecionamento passado para `generatePasswordResetLink` não estava cadastrado nos Domínios Autorizados do Firebase Auth.
- **Solução aplicada**: Removido parâmetro de URL customizada; uso do fluxo padrão do Firebase sem parâmetros de URL customizados (DEC-015).
- **Regra de prevenção**: Nunca passar domínio customizado para reset de senha sem garantir que está autorizado no Firebase Auth. Validar sempre após deploy.
- **Status**: ✅ Resolvido em 16/04/2026.

---

### ERR-012 — Indicador de força da senha não funciona na tela de redefinição

- **Data**: 18/04/2026
- **Descrição**: Na tela `acao-auth.html`, as barras de força da senha não mudavam de cor ao digitar.
- **Causa raiz**: `acao-auth.js` chamava `calcStrength(pw)` — função inexistente. O nome correto é `window.budCalcStrength(pw)` (exportado por `bud-utils.js`). O `ReferenceError` silencioso matava o event handler `input` e as barras nunca atualizavam.
- **Solução aplicada**: Corrigido para `window.budCalcStrength(pw)` em `js/acao-auth.js`.
- **Regra de prevenção**: Sempre usar o prefixo `window.` ao chamar funções exportadas por `bud-utils.js`. Os nomes são: `window.budShowToast`, `window.budSanitize`, `window.budCalcStrength`, `window.BUD_SENHAS_COMUNS`.
- **Status**: ✅ Resolvido em 18/04/2026.

---

### ERR-013 — Login diz "senha incorreta" quando o erro é do Firestore

- **Data**: 18/04/2026
- **Descrição**: Após redefinir senha com sucesso, o login falhava com "E-mail/matrícula ou senha incorretos" mesmo com credenciais corretas.
- **Causa raiz**: O `try/catch` do login era único para `signInWithEmailAndPassword` + `getDoc`. O `signInWithEmailAndPassword` **funcionava**, mas o `getDoc` seguinte falhava com `permission-denied` (token stale do Firebase Auth). Como o catch não distinguia erros de auth vs Firestore, o erro de permissão caía no `else` genérico e mostrava "senha incorretos" — enganando o usuário.
- **Solução aplicada**: (1) Separar `signInWithEmailAndPassword` em seu próprio try/catch (erros de auth → "senha incorretos"). (2) Adicionar `user.getIdToken(true)` após login para refresh do token. (3) Erros pós-auth (Firestore) → mensagem "Erro de permissão" ou "Erro ao acessar conta" em vez de "senha incorretos".
- **Regra de prevenção**: NUNCA misturar erros de `signInWithEmailAndPassword` com erros de Firestore no mesmo catch. Sempre separar autenticação de leitura de dados. Sempre fazer `getIdToken(true)` antes de acessar Firestore após login/reload.
- **Status**: ✅ Resolvido em 18/04/2026.

---

### ERR-014 — oobCode de reset de senha vazava no console do browser

- **Data**: 18/04/2026
- **Descrição**: `recuperar-senha.js` fazia `console.log('[Bud] Backend response:', data)` que expunha o `oobCode` (token de reset de senha) no console do browser. Extensões ou shoulder surfers podiam capturar o token.
- **Causa raiz**: Backend retornava `oobCode` para o frontend (que enviava o email via EmailJS client-side). O `console.log` de debug nunca foi removido.
- **Solução aplicada**: (1) Backend refatorado para enviar o email via EmailJS REST API server-side — o `oobCode` nunca sai do backend. (2) Frontend agora recebe apenas `{ success: true }`. (3) Todos os `console.log`/`console.error` que expunham dados operacionais foram removidos de todos os JS files.
- **Regra de prevenção**: NUNCA retornar tokens/codes sensíveis para o frontend. NUNCA fazer `console.log` de respostas que contenham tokens. Operações sensíveis (email de reset) devem ser executadas inteiramente no servidor.
- **Status**: ✅ Resolvido em 18/04/2026.

---

### ERR-015 — Listeners duplicados no dashboard causam memory leak

- **Data**: 18/04/2026
- **Descrição**: `onAuthStateChanged` no dashboard chamava `setupListeners()` sem cleanup. Se o callback disparasse mais de uma vez (token refresh), listeners `onSnapshot` duplicavam — causando renders dobrados e vazamento de memória.
- **Causa raiz**: `onAuthStateChanged` pode disparar múltiplas vezes (token refresh), mas `setupListeners()` não limpava subscriptions anteriores.
- **Solução aplicada**: Adicionado `cleanupListeners()` antes de `setupListeners()` no auth guard do dashboard.
- **Regra de prevenção**: Sempre chamar cleanup de listeners antes de configurar novos. Em `onAuthStateChanged`, nunca assumir que será chamado apenas uma vez.
- **Status**: ✅ Resolvido em 18/04/2026.

---

### ERR-016 — Botão collapse da sidebar clipado por `overflow: hidden`
- **Data**: 19/04/2026
- **Descrição**: O botão `#btnSidebarCollapse` estava posicionado `right: -0.875rem` (fora dos bounds da sidebar), mas `.sidebar { overflow: hidden }` clipava o botão, tornando-o invisível.
- **Causa raiz**: `overflow: hidden` foi adicionado para animar o colapso da sidebar, sem considerar o botão externamente posicionado.
- **Solução aplicada**: Alterado `.sidebar` para `overflow: visible`. Adicionado `overflow: hidden; white-space: nowrap` às bases de `.sidebar-logo span` e `.sidebar-link-text` para que o conteúdo interno não vaze durante a animação.
- **Regra de prevenção**: Ao usar `overflow: hidden` para animações, verificar se há elementos absolutamente posicionados que precisam "vazar" para fora dos bounds.
- **Status**: ✅ Resolvido em 19/04/2026.

---

### ERR-017 — Seção de temas (bubbles) visível no collapsed state com overflow
- **Data**: 19/04/2026
- **Descrição**: Em desktop com sidebar colapsada (64px), os 8 theme bubbles continuavam visíveis e quebravam em múltiplas linhas (1 por linha), tomando grande espaço vertical.
- **Causa raiz**: `.sidebar.collapsed .sidebar-theme-label` ocultava apenas o label (🎨 Tema), não os bubbles `#themeBubbles` nem o wrapper da seção.
- **Solução aplicada**: Adicionado `class="sidebar-theme-section"` ao wrapper da seção de temas. CSS: `.sidebar.collapsed .sidebar-theme-section { display: none; }`.
- **Regra de prevenção**: Ao ocultar seções da sidebar no collapsed state, ocultar o wrapper inteiro, não apenas o label.
- **Status**: ✅ Resolvido em 19/04/2026.

---

### ERR-018 — Transições da sidebar só animam em uma direção (colapso mas não expansão)
- **Data**: 19/04/2026
- **Descrição**: As transições de `opacity` e `width` dos textos da sidebar (`.sidebar-logo-text`, `.sidebar-link-text`, `.sidebar-user-info`) estavam definidas APENAS nos seletores `.sidebar.collapsed`. Ao remover a classe `.collapsed` (expansão), os elementos voltavam ao estado padrão SEM animação.
- **Causa raiz**: CSS: as propriedades `transition` precisam estar no estado BASE do elemento para funcionar em ambas as direções. Quando definidas apenas no estado modificado (`.collapsed`), funcionam somente na entrada desse estado.
- **Solução aplicada**: Movidas as transições para os seletores base (`.sidebar-logo span`, `.sidebar-link-text`, `.sidebar-user-info`).
- **Regra de prevenção**: Propriedades `transition` devem sempre estar no seletor base, nunca apenas no estado modificado (hover, .collapsed, .active, etc.).
- **Status**: ✅ Resolvido em 19/04/2026.

---

### ERR-019 — Cores hardcoded no JS do dashboard quebram legibilidade no tema Dark
- **Data**: 19/04/2026
- **Descrição**: Itens de transação criados dinamicamente por JS usavam cores hardcoded (`color:#1e293b`, `border-bottom:1px solid #f1f5f9`, `background:#f8fafc` no hover). No tema HBO Dark (background `rgba(15,20,25,0.95)`), o texto `#1e293b` ficava invisível.
- **Causa raiz**: Elementos criados via JS usavam cores literais em vez de CSS custom properties.
- **Solução aplicada**: Substituídas todas as cores por CSS vars: `var(--card-text)`, `var(--card-text-sec)`, `var(--card-border)`, `var(--sidebar-link-hover-bg)`, `var(--theme-accent)`. CSS vars funcionam em inline styles de JS (`element.style.color = 'var(--card-text)'`).
- **Regra de prevenção**: Nunca usar cores hexadecimais hardcoded em elementos criados por JS. Sempre usar `var(--nome-da-var)` para garantir compatibilidade com todos os temas.
- **Status**: ✅ Resolvido em 19/04/2026.

---

### ERR-020 — Dropdown custom-select abre para baixo e cobre botões de ação do modal
- **Data**: 21/04/2026
- **Arquivo**: `metas.html` — modal Depositar (`#modalAporte`)
- **Descrição**: O `#carteiraSelectDropdown` abria com `top: calc(100% + 4px)` (para baixo), sobrepondo os botões Cancelar e Confirmar Aporte localizados imediatamente abaixo. O dropdown interceptava pointer events, tornando os botões inacessíveis enquanto o dropdown estava aberto.
- **Causa raiz**: CSS padrão do `.custom-select-dropdown` usa `top: calc(100% + 4px)`. Quando o trigger é o último campo antes dos botões de ação, o dropdown cobre os botões.
- **Solução aplicada**: Adicionado `style="top:auto;bottom:calc(100% + 4px);"` inline no `#carteiraSelectDropdown` do modal Aporte, fazendo o dropdown abrir para CIMA.
- **Regra de prevenção**: Quando um custom-select estiver posicionado na parte inferior de um container (modal, card, form), usar `bottom: calc(100% + 4px); top: auto;` para abrir para cima.
- **Status**: ✅ Resolvido em 21/04/2026.



---

### ERR-021 — Endpoint /api/extrair-fatura inexistente no backend Bud Finance
- **Data**: 21/04/2026
- **Arquivo**: ackend/server.js
- **Descrição**: Endpoint POST /api/extrair-fatura retornava 500 (ou 404) porque nunca foi criado no backend Bud Finance. Existia apenas no backend legado Nexo (antigo sistema), que foi migrado sem incluir o endpoint de extração de faturas.
- **Causa raiz**: Durante a migração Nexo → Bud Finance, apenas os endpoints de reset de senha foram portados. O endpoint de IA ficou no repositório legado.
- **Solução aplicada**: Criado o endpoint completo em ackend/server.js com: (1) multer para upload de arquivo, (2) pdf-parse para extração de texto de PDF, (3) parser de texto com dupla estratégia (horizontal + vertical/bloco) sem IA para PDFs legíveis, (4) fallback Gemini 1.5 Flash via REST para imagens e PDFs complexos.
- **Regra de prevenção**: Ao migrar de sistema, verificar TODOS os endpoints do backend anterior. Documentar em ARCHITECTURE_MAP.md cada endpoint disponível.
- **Status**: ✅ Resolvido em 21/04/2026.

---

### ERR-022 — Importação IA demorava 2+ minutos e retornava contagem incorreta
- **Data**: 21/04/2026
- **Arquivo**: js/cartoes.js — função enviarParaIA
- **Descrição**: O frontend enviava o PDF para a IA com instrucoes extensas, sem timeout, e o backend legado usava OpenAI GPT-4 Vision (lento, caro) para PDFs que podiam ser lidos por texto simples. O total de transações extraídas diferia da fatura real.
- **Causa raiz**: (1) Sem AbortController/timeout no fetch. (2) Backend legado usava somente IA, ignorando extração de texto nativa do PDF. (3) IA contava linhas de resumo/pagamento como transações.
- **Solução aplicada**: (1) Adicionado timeout de 45s com AbortController. (2) Novo backend usa pdf-parse + regex (< 1s para PDFs digitais). (3) Parser ignora linhas de palavras-chave (total, saldo, pagamento, etc.). (4) Gemini só é acionado como fallback para PDFs ilegíveis ou imagens.
- **Regra de prevenção**: Todo fetch para backend externo deve ter timeout. PDFs digitais nunca precisam de IA para extração de texto.
- **Status**: ✅ Resolvido em 21/04/2026.


---

### ERR-021 — Endpoint /api/extrair-fatura inexistente no backend Bud Finance
- **Data**: 21/04/2026
- **Arquivo**: ackend/server.js
- **Descrição**: Endpoint POST /api/extrair-fatura retornava 500 (ou 404) porque nunca foi criado no backend Bud Finance. Existia apenas no backend legado Nexo (antigo sistema), que foi migrado sem incluir o endpoint de extração de faturas.
- **Causa raiz**: Durante a migração Nexo → Bud Finance, apenas os endpoints de reset de senha foram portados. O endpoint de IA ficou no repositório legado.
- **Solução aplicada**: Criado o endpoint completo em ackend/server.js com: (1) multer para upload de arquivo, (2) pdf-parse para extração de texto de PDF, (3) parser de texto com dupla estratégia (horizontal + vertical/bloco) sem IA para PDFs legíveis, (4) fallback Gemini 1.5 Flash via REST para imagens e PDFs complexos.
- **Regra de prevenção**: Ao migrar de sistema, verificar TODOS os endpoints do backend anterior. Documentar em ARCHITECTURE_MAP.md cada endpoint disponível.
- **Status**: ✅ Resolvido em 21/04/2026.

---

### ERR-022 — Importação IA demorava 2+ minutos e retornava contagem incorreta
- **Data**: 21/04/2026
- **Arquivo**: js/cartoes.js — função enviarParaIA
- **Descrição**: O frontend enviava o PDF para a IA com instrucoes extensas, sem timeout, e o backend legado usava OpenAI GPT-4 Vision (lento, caro) para PDFs que podiam ser lidos por texto simples. O total de transações extraídas diferia da fatura real.
- **Causa raiz**: (1) Sem AbortController/timeout no fetch. (2) Backend legado usava somente IA, ignorando extração de texto nativa do PDF. (3) IA contava linhas de resumo/pagamento como transações.
- **Solução aplicada**: (1) Adicionado timeout de 45s com AbortController. (2) Novo backend usa pdf-parse + regex (< 1s para PDFs digitais). (3) Parser ignora linhas de palavras-chave (total, saldo, pagamento, etc.). (4) Gemini só é acionado como fallback para PDFs ilegíveis ou imagens.
- **Regra de prevenção**: Todo fetch para backend externo deve ter timeout. PDFs digitais nunca precisam de IA para extração de texto.
- **Status**: ✅ Resolvido em 21/04/2026.

---

### ERR-023 � Tema Dark deixava texto solto invis�vel (body color preto sobre fundo preto)
- **Data**: 27/04/2026
- **Sintoma**: Em `hbo` (Dark), `getComputedStyle(document.body).color` resolvia `rgb(0,0,0)` � qualquer texto sem classe espec�fica ficava invis�vel.
- **Causa**: `theme-manager.js` definia vari�veis de tema mas n�o tocava em `--text-main`/`--text-sec` nem em `document.body.style.color`.
- **Corre��o**: `_setVars()` agora tamb�m seta `--text-main`, `--text-sec` e `document.body.style.color = t.text`.
- **Validado**: `rgb(255,255,255)` em Dark, `rgb(30,41,59)` em Gelo. (Auditoria 27/04/2026)

### ERR-024 � Pluraliza��o hardcoded "1 transa��es" no Dashboard
- **Data**: 27/04/2026
- **Sintoma**: Cards "Entradas/Sa�das do M�s" mostravam `1 transa��es` quando `count === 1`.
- **Corre��o**: Pattern `n === 1 ? '1 transa��o' : n + ' transa��es'` aplicado em `dashboard.js`. Helper `budPluralize()` adicionado em `bud-utils.js` para uso futuro.

### ERR-025 � escapeHTML fallback usava budSanitize (N�O escapa aspas)
- **Data**: 27/04/2026
- **Sintoma**: `dividas.js`, `investimentos.js`, `limites.js` declaravam `escapeHTML` apontando para `window.budSanitize`, que apenas remove tags. Strings com aspas em `onclick="..."` quebrariam o HTML (XSS-like).
- **Corre��o**: Adicionado `window.budEscapeHTML` em `bud-utils.js` (escape completo). Os 3 arquivos passaram a usar `budEscapeHTML`.
- **Risco real**: baixo (campos atingidos eram IDs alfanum�ricos do Firestore), mas o pattern era fr�gil.

### ERR-026 � cartoes.js exclu�a no m�x 500 transa��es por cart�o (truncamento silencioso)
- **Data**: 27/04/2026
- **Sintoma**: `confirmarExcluirCartao()` usava `query(...limit(500))` sem loop. Se um cart�o tivesse >500 transa��es, o resto ficava �rf�o.
- **Corre��o**: Loop `do/while` deletando em batches de 500 at� esgotar.

### ERR-027 � console.error/warn exibidos em produ��o
- **Data**: 27/04/2026
- **Sintoma**: Erros internos vazavam para o console em produ��o (telemetria n�o desejada, leak de mensagens).
- **Corre��o**: Wrappers `budError/budWarn/budLog` em `bud-utils.js` que s� logam quando `BUD_IS_DEV`. Substitui��es aplicadas em `extrato.js`, `dividas.js`, `investimentos.js`, `recorrentes.js`, `limites.js`, `categorias.js`.

### ERR-028 � theme-manager.localStorage sem try/catch (Safari private mode)
- **Data**: 27/04/2026
- **Sintoma**: `localStorage.setItem` lan�ava `QuotaExceededError` em modo privativo, quebrando o switching de tema.
- **Corre��o**: try/catch em todas as chamadas + helper `budStorage` para uso futuro.

### ERR-029 � preview-temas n�o sincronizava com tela principal
- **Data**: 27/04/2026
- **Sintoma**: Trocar tema na aba Configura��es n�o atualizava outras abas abertas do app.
- **Corre��o**: `window.addEventListener('storage', ...)` no `theme-manager.js` reaplica tema se `bud_theme` mudar em outra aba.

### ERR-030 � CORS backend permitia localhost em produ��o
- **Data**: 27/04/2026
- **Sintoma**: Allowlist �nica misturava `localhost:8080`, `localhost:3001` com dom�nio p�blico � em prod ficava aceitando origens de dev.
- **Corre��o**: Split por `NODE_ENV` em `backend/server.js` (`ALLOWED_ORIGINS_PROD` vs `_DEV`).### ERR-032 — Onboarding travado na splash após Reset de conta
- **Data**: 30/04/2026
- **Sintoma**: Ao usar o botão "Resetar Dados" em Configurações pelo mobile, o app ficava travado em uma tela de carregamento sem logo e nunca iniciava.
- **Causa raiz**: `const _previewMode` declarado duas vezes em `js/onboarding.js` (linha 30 e linha 568). O `SyntaxError: Identifier '_previewMode' has already been declared` fazia o módulo ES inteiro falhar silenciosamente — `onAuthStateChanged` nunca era registrado e `ocultarSplash()` jamais era chamado.
- **Solução aplicada**: Removida a segunda declaração duplicada (linha 568). Adicionado timeout de segurança de 8s para forçar o dismiss do splash (proteção para redes lentas). Bloco de init envolvido em `try/finally` para garantir `ocultarSplash()` sempre. Redirect após reset alterado de `dashboard.html` para `onboarding.html` diretamente (eliminando hop desnecessário). Logo do splash corrigida de `<div class="splash-logo">B</div>` para `<img src="logo.png">` igual ao `index.html`.
- **Regra de prevenção**: Módulos ES com `const` no escopo top-level falham **silenciosamente** se houver duplicata — o erro não aparece no console como erro de runtime, só como `pageError`. Ao mover ou copiar blocos de código entre seções de um módulo, verificar se a constante já foi declarada mais acima. Padrão: declarar `_previewMode` e variáveis de módulo apenas uma vez, no topo do arquivo.
### ERR-031 � Assistente IA: CORS bloqueando header Authorization no preflight
- **Data**: 29/04/2026
- **Sintoma**: Chat do Assistente IA falhava com `Access to fetch ... has been blocked by CORS policy: Request header field authorization is not allowed by Access-Control-Allow-Headers in preflight response` e mensagem "Erro ao conectar ao assistente".
- **Causa raiz**: `app.use(cors(...))` em `backend/server.js` declarava `allowedHeaders: ['Content-Type']` � quando o frontend enviou `Authorization: Bearer <idToken>`, o navegador disparou preflight OPTIONS e o backend respondeu sem permitir o header.
- **Solu��o aplicada**: `allowedHeaders: ['Content-Type', 'Authorization']` + `methods: ['POST', 'GET', 'OPTIONS']`. Tamb�m adicionadas portas 5502 (live-server alternativa) em ALLOWED_ORIGINS dev/prod.
- **Regra de preven��o**: SEMPRE que um endpoint do backend exigir `Authorization` (Bearer token Firebase), o `cors()` precisa listar esse header em `allowedHeaders`. Validar no DevTools ? Network ? preflight OPTIONS. Lembrar: backend em produ��o (Render) precisa de redeploy para mudan�as no CORS surtirem efeito.

---

### ERR-033 — Month picker do dashboard inacessível (coberto pelas cards)
- **Data**: 10/05/2026
- **Arquivo**: js/dashboard.js — IIFE do mesPicker
- **Descrição**: Ao clicar em "Maio de 2026 ▾" na nav do dashboard, o dropdown do month picker abria mas ficava invisível/inacessível. Playwright confirmou: pointer events interceptados pelas .summary-card do .cards-grid.
- **Causa raiz**: O picker era criado com position:absolute e era filho de .mes-nav, que vive dentro de #dashMain (position:relative, z-index:1). As .summary-card vêm depois na DOM e ficam por cima do picker independentemente do z-index do picker.
- **Solução aplicada**: Picker movido para document.body.appendChild(picker). Style alterado de position:absolute para position:fixed. Função openPicker() agora calcula posição via getBoundingClientRect() com clamping de viewport. Adicionado listener scroll para fechar o picker ao rolar.
- **Regra de prevenção**: Dropdowns e tooltips que precisam flutuar sobre outros elementos SEMPRE devem ser filhos do <body> com position:fixed. Nunca criar overlays/pickers como filhos de containers com position:relative.
- **Status**: ✅ Resolvido em 10/05/2026.
---

### ERR-036 — `confirmarTransferencia()` usava schema errado: tipo `'saida'`/`'entrada'`, campo `contaId` e `criadaEm`
- **Data**: 14/05/2026
- **Arquivo**: `js/carteira.js` — `confirmarTransferencia()`
- **Descrição**: Transferências entre contas eram salvas no Firestore mas não apareciam no extrato. As transações geradas apareciam como "tipo desconhecido" e eram ignoradas na query do extrato.
- **Causa raiz**: Três erros de schema simultâneos: (1) `tipo: 'saida'`/`'entrada'` — o extrato só reconhece `'despesa'`/`'receita'`; (2) campo `contaId` em vez de `carteiraId`; (3) campo `criadaEm` em vez de `dataCriacao`. Além disso, faltavam os campos `pago`, `confirmado` e `pagamentoFatura` que o extrato filtra.
- **Solução aplicada**: Corrigidos os três campos para o schema padrão: `tipo:'despesa'`/`'receita'`, `carteiraId`, `dataCriacao: serverTimestamp()`, `pago:true`, `confirmado:true`, `pagamentoFatura:false`, `transferencia:true`.
- **Regra de prevenção**: Schema de transação obrigatório: `{ descricao, valor, categoria, data:Timestamp, tipo:'receita'|'despesa', dataCriacao:serverTimestamp(), carteiraId, pago:true, confirmado:true, pagamentoFatura:false }`. NUNCA usar `tipo:'entrada'/'saida'`, `contaId` ou `criadaEm`.
- **Status**: ✅ Resolvido em 14/05/2026.

---

### ERR-037 — Layout mobile expandia além do viewport (`min-width` implícito em flex item)
- **Data**: 14/05/2026
- **Arquivo**: `carteira.html` — CSS `.dash-main`
- **Descrição**: Em telas mobile (< 768px), toda a página expandia horizontalmente causando scroll lateral indesejado. KPI cards, filter pills e conta cards extrapolavam o viewport mesmo com `overflow-x:hidden` no `body`.
- **Causa raiz**: `.dash-main{flex:1;margin-left:260px}` não tinha `min-width:0`. Em CSS Flexbox, o valor padrão de `min-width` para flex items é `auto` (equivale a `min-content`). O conteúdo interno (3 KPI cards × 240px = 752px) forçava o flex item a ser 784px, mesmo com `flex:1` e `margin-left:0 !important` corretos no breakpoint mobile. O `body{overflow-x:hidden}` escondia o scroll mas os elementos continuavam sendo renderizados fora do viewport (corpo clipa, mas scrollWidth = clientWidth ilusoriamente).
- **Solução aplicada**: Adicionado `min-width:0` ao `.dash-main`. Com isso, o flex item pode encolher ao tamanho real do flex container. Confirmado: `body.scrollWidth === body.clientWidth` após o fix.
- **Regra de prevenção**: **Todo flex item que serve como container de conteúdo deve ter `min-width:0`** (ou `overflow:hidden`). Sem isso, o item não encolhe abaixo do seu `min-content`, quebrando o layout em viewports estreitos. Padrão aplicável a `.dash-main`, `.main-content` e qualquer wrapper de conteúdo em layouts flex.
- **Status**: ✅ Resolvido em 14/05/2026.
---

### ERR-034 — Widget Limites mostra "✅ Orçamento sob controle" com 2038% utilizado
- **Data**: 10/05/2026
- **Arquivo**: js/dashboard.js — função tualizarLimitesWidget
- **Descrição**: Widget de Limites exibia "✅ Orçamento sob controle" mesmo quando pctTotal > 100 (total de saídas vs. soma dos limites definidos). No caso de teste: 1 limite de R\ (Alimentação), total de saídas R\.075 → 2038% utilizado, mas o widget mostrava "tudo ok".
- **Causa raiz**: O bloco if (criticos.length === 0) verificava apenas alertas por-categoria (≥80%), sem checar o percentual total geral.
- **Solução aplicada**: Dentro do bloco if (criticos.length === 0), adicionado if (pctTotal > 100) para exibir card laranja "⚠️ Gastos acima do orçamento" ao invés do card verde quando o total supera 100%.
- **Regra de prevenção**: Ao implementar widgets de alerta com múltiplas métricas, sempre garantir que o "estado OK" só seja mostrado se TODAS as métricas estiverem dentro dos limites — não apenas a métrica principal.
- **Status**: ✅ Resolvido em 10/05/2026.

---

### ERR-035 � extrato.html com carregamento infinito (splash nunca some)
- **Data**: 14/05/2026
- **Arquivo**: js/extrato.js � linha 681
- **Descri��o**: A tela de Extrato ficava presa na splash de "Carregando..." indefinidamente. O m�dulo JS n�o executava nenhuma linha (zero logs de console, `#navMesAno` permanecia "Carregando...").
- **Causa raiz**: Na linha 681 havia um separador decorativo unicode sem prefixo de coment�rio `//`: `} ---------------------------------------------------------------`. O caractere `-` (U+2500 Box Drawing Light Horizontal) n�o � v�lido em identificadores JavaScript, causando um `SyntaxError` fatal que impedia o m�dulo ES inteiro de ser parseado/executado.
- **Solu��o aplicada**: Substitu�do por um separador corretamente dentro de coment�rio `//`.
- **Regra de preven��o**: Separadores decorativos unicode (-, -, +, etc.) em JS SEMPRE devem estar dentro de coment�rios `//` ou `/* */`. Um �nico caractere inv�lido fora de coment�rio/string causa falha silenciosa do m�dulo inteiro.
- **Status**: ? Resolvido em 14/05/2026.

---

### ERR-038 — CSS vars inexistentes no modal Pagar Fatura (`--glass-border`, `--glass-bg`, `--primary`)
- **Data**: 15/05/2026
- **Arquivo**: `js/cartoes.js` — função `abrirModalPagarFatura()`
- **Descrição**: Os templates HTML das labels de seleção de conta usavam `var(--glass-border)`, `var(--glass-bg)` e `var(--primary)`, variáveis que não existem no `:root` de `cartoes.html`. As labels ficavam sem borda, sem background e sem `accent-color` no radio button.
- **Causa raiz**: Variáveis copiadas de outra tela (possivelmente `dashboard.html`) que define `--glass-*` e `--primary`. Em `cartoes.html` essas vars não são declaradas.
- **Solução aplicada**: Substituídas pelas vars corretas disponíveis em `cartoes.html`: `--card-border`, `--input-bg` e `--btn-bg`.
- **Regra de prevenção**: Ao criar HTML inline em JS, sempre verificar quais CSS vars existem na tela alvo. Não copiar vars de outras telas sem checar o `:root` local.
- **Status**: ✅ Resolvido em 15/05/2026.

---

### ERR-039 — Parcelamento gerava datas inválidas (ex: `2026-04-31`)
- **Data**: 15/05/2026
- **Arquivo**: `js/cartoes.js` — função `handleSubmitGasto()`
- **Descrição**: Ao registrar um gasto parcelado com data base em dia 29, 30 ou 31, meses com menos dias recebiam datas inválidas (ex: `2026-04-31`, `2026-02-29` em ano não-bissexto). O `new Date()` silenciosamente avançava para o mês seguinte (overflow), criando parcelas com mês errado no Firestore.
- **Causa raiz**: O loop de parcelamento avançava o mês manualmente sem clampar o dia ao último dia do mês destino: `const diaParc = diaBase` fixo para todas as parcelas.
- **Solução aplicada**: Substituído o cálculo manual por `_addMesesData(dataRef, i)`, função já existente no arquivo que usa `new Date(ano, mes+i, 0).getDate()` para clampar o dia corretamente.
- **Regra de prevenção**: Para avançar meses em datas JS, sempre usar uma função que clampeia o dia (ex: `_addMesesData`). Nunca avançar mês manualmente com aritmética simples quando o dia pode ser 29–31.
- **Status**: ✅ Resolvido em 15/05/2026.

---

### ERR-040 — Listeners `onSnapshot` do Firestore não cancelados no `beforeunload`
- **Data**: 15/05/2026
- **Arquivo**: `js/cartoes.js` — callback `onAuthStateChanged`
- **Descrição**: Os 3 listeners `onSnapshot` (cartões, transações, categorias) registrados em `setupListeners()` nunca eram cancelados ao navegar para outra página. Isso causava potencial vazamento de memória e callbacks executando em contexto inválido.
- **Causa raiz**: A função `cleanupListeners()` existia e chamava `unsubs.forEach(u => u && u())`, mas nunca era invocada automaticamente ao descarregar a página.
- **Solução aplicada**: Adicionado `window.addEventListener('beforeunload', cleanupListeners, { once: true })` logo após `setupListeners()` no callback do `onAuthStateChanged`.
- **Regra de prevenção**: Toda tela que registra `onSnapshot` deve sempre registrar `window.addEventListener('beforeunload', cleanupListeners, { once: true })` para garantir limpeza ao navegar.
- **Status**: ✅ Resolvido em 15/05/2026.

---
### ERR-042 — `_importMetaIA = null` em `enviarParaIA()` zerava fonte OFX antes do badge renderizar
- **Data**: 16/05/2026
- **Arquivo**: `js/cartoes.js` — `enviarParaIA()` + `_renderConfiabilidadeBadge()`
- **Sintoma**: Import de arquivo OFX sempre mostrava `⚠️ Fatura/IA — precisão não verificável · confira cada linha manualmente` mesmo sendo dados 100% estruturados.
- **Causa raiz**: Em `enviarParaIA()`, a linha `_importMetaIA = null; // OFX não tem meta` executava ANTES da chamada `await processarOFXLocal(file)`. Embora `processarOFXLocal` sobrescrevesse para `{ fonte: 'ofx' }` internamente, o comentado sugeria que era intencional e criava confusão. A causa direta era que `_renderConfiabilidadeBadge` recebia `meta.fonte` correto somente se `processarOFXLocal` fosse a última a escrever antes do render — qualquer caminho alternativo que chamasse `fecharModalReviewIA` resetaria `_importMetaIA` de volta a `null`.
- **Solução aplicada**: Substituiu `_importMetaIA = null` por `_importMetaIA = { fonte: 'ofx' }` diretamente em `enviarParaIA()` antes de chamar `processarOFXLocal`. A atribuição dentro de `processarOFXLocal` foi mantida como segunda camada de garantia.
- **Regra de prevenção**: Nunca setar `_importMetaIA = null` como "limpeza preventiva" antes de uma função que sabe mais sobre a fonte. Delegar a responsabilidade à função especializada, ou setar o valor correto direto no site da chamada.
- **Status**: ✅ Resolvido em 16/05/2026.

---

### ERR-043 — `parseFloat(t.valor) > 0` descartava estornos silenciosamente no backend
- **Data**: 16/05/2026
- **Arquivo**: `backend/server.js` — `extractWithAIFromText()` e `extractWithAI()`
- **Sintoma**: Estornos (valores negativos) nunca apareciam no modal Review IA após import via PDF/imagem. O total extraído sempre ficava maior que o real.
- **Causa raiz**: Ambos os handlers filtravam `transacoes.filter(t => parseFloat(t.valor) > 0)`. O filtro era um guard contra strings vazias/zeros, mas descartava todos os valores negativos (estornos).
- **Solução aplicada**: Alterado para `parseFloat(t.valor) !== 0` nos dois handlers, preservando estornos e descartando apenas zeros/nan.
- **Regra de prevenção**: Ao filtrar lixo (valores sem sentido), usar `!== 0` ou `isNaN` — nunca `> 0` em contexto financeiro onde negativos são semanticamente válidos.
- **Status**: ✅ Resolvido em 16/05/2026.

---
### ERR-041 — Badge "precisão não verificável" persistia mesmo após backend ler totais
- **Data**: 15/05/2026
- **Arquivo**: `js/cartoes.js` — `enviarParaIA()` + `cartoes.html` (CDN pdf.js)
- **Sintoma**: Após importar fatura Nubank (PDF), o modal Review IA mostrava "Total: R$ 1.291,12" mas o PDF declarava "Total a pagar R$ 1.242,36". O badge ficava em "⚠️ PDF/IA — precisão não verificável · confira cada linha manualmente" mesmo com `_renderConfiabilidadeBadge` esperando `meta.totalAPagar`/`meta.totalCompras`.
- **Causa raiz**: O frontend dependia 100% de `dados.meta` vindo do backend. Quando o deploy do Render estava defasado em relação ao código frontend (ou o regex server-side falhava em layouts de coluna específicos), `meta` voltava `null` e o badge não tinha referência para comparar.
- **Solução aplicada**:
  1. Incluído `pdf.js@3.11.174` via CDN em `cartoes.html` (com workerSrc configurado).
  2. Nova função `_extrairMetaPdfClientSide(file)` em `cartoes.js`: lê o PDF no navegador via `pdfjsLib.getDocument`, concatena texto das primeiras 15 páginas e roda os mesmos regex (`total a pagar` e `total de compras`) usados no backend.
  3. Em `enviarParaIA()`, após receber resposta do backend, se o arquivo for PDF chama o fallback client-side e preenche `_importMetaIA.totalAPagar` / `totalCompras` faltantes (backend tem prioridade quando presente).
  4. **Refinamento (15/05/2026)**: regex lazy `(\d[\d\.]*,\d{2})` capturava o PRIMEIRO valor decimal após "total a pagar" — no PDF Nubank esse primeiro número é frequentemente um IOF ou uma conversão USD (ex: R$ 12,28) que aparece antes do valor real (R$ 1.242,36) por ordem de leitura do `pdf.js`. Substituído por estratégia "maior valor na janela": coleta TODOS os valores decimais nos N chars após a âncora e escolhe `Math.max`. Adicionada âncora prioritária `Pagamento total da fatura` (frase exclusiva do card de opções de pagamento Nubank, sempre adjacente ao valor correto). Mesma lógica aplicada no backend (`extractMetaFromText`).
- **Regra de prevenção**: Não fazer o frontend depender exclusivamente de metadados do backend quando dá pra extrair localmente. Para parsing de PDFs com layout em colunas, NUNCA usar regex lazy `[\s\S]{0,N}?` para capturar valor após label — a ordem de extração do `pdf.js`/`pdf-parse` não respeita layout visual. Em vez disso, coletar todos os candidatos numa janela e aplicar critério (maior, mais próximo do "R$" anchor, etc.).
- **Status**: ✅ Resolvido em 15/05/2026.

---

### ERR-044 — `diaVencimento` salvo sem validação de limite superior em recorrentes.js
- **Data**: 16/05/2026
- **Arquivo**: `js/recorrentes.js` — `salvarRecorrente()`
- **Sintoma**: Usuário poderia digitar `35` no campo "Dia do Vencimento" (HTML tem `min/max` mas não impede digitação manual). O valor `35` era salvo direto no Firestore. O `calcPrimeiraData` usava `Math.min(dia, 31)` para gerar a data, mas o campo `diaVencimento` persistido ficava com valor inválido — afetando lógica futura do backend de processamento.
- **Causa raiz**: Guard `|| 1` só protegia contra `NaN`/`0`. Nenhum clamp superior era aplicado antes do `addDoc`/`updateDoc`.
- **Solução aplicada**: `Math.min(31, Math.max(1, parseInt(...) || 1))` no parse do campo antes de salvar.
- **Regra de prevenção**: Sempre fazer clamp explícito (min + max) em campos numéricos que têm range válido, independentemente do `min`/`max` do HTML.
- **Status**: ✅ Resolvido em 16/05/2026.

---

### ERR-045 — `budSanitize` não escapa aspas duplas — XSS potencial em atributos HTML
- **Data**: 16/05/2026
- **Arquivo**: `js/recorrentes.js` — `renderizar()` (e qualquer outro arquivo que use `budSanitize` dentro de atributos `title`/`href`/`data-*`)
- **Sintoma**: `card.innerHTML = \`...<div title="${window.budSanitize(rec.descricao)}">...\`` — se `descricao` contivesse `"`, o atributo HTML ficava malformado: `title="Netflix "Premium""`. Vetor de attribute injection.
- **Causa raiz**: `budSanitize` escapa `<`, `>`, `&` mas **não** `"`. Isso é correto para texto dentro de tags, mas insuficiente para uso dentro de atributos delimitados por aspas duplas.
- **Solução aplicada**: Adicionado `.replace(/"/g, '&quot;')` ao valor antes de interpolá-lo em atributos: `const safeTitle = window.budSanitize(rec.descricao || '').replace(/"/g, '&quot;')`.
- **Regra de prevenção**: `budSanitize` é seguro para **conteúdo de texto** dentro de tags. Para **valores de atributos** HTML, sempre encadear `.replace(/"/g, '&quot;')` após o sanitize. Nunca interpolar texto não-controlado diretamente em atributos via template literal sem esse tratamento adicional.
- **Status**: ✅ Resolvido em 16/05/2026.

---

### ERR-046 — Toggle ativo/inativo sem rollback visual em caso de erro Firebase
- **Data**: 16/05/2026
- **Arquivo**: `js/recorrentes.js` — `toggleAtivo()` + evento `change` no checkbox
- **Sintoma**: Ao clicar no toggle de uma recorrente sem conexão (ou com erro Firebase), a UI mudava visualmente (checkbox invertido) mas o `updateDoc` falhava. O usuário via o estado errado na tela e só descobria o problema pelo toast de erro.
- **Causa raiz**: A função `toggleAtivo(id, novoValor)` não recebia referência ao elemento DOM do checkbox, impossibilitando o revert.
- **Solução aplicada**: Assinatura alterada para `toggleAtivo(id, novoValor, checkbox)`. No catch: `if (checkbox) checkbox.checked = !novoValor`. O listener passa `e.target` como terceiro argumento.
- **Regra de prevenção**: Toggles que disparam operações assíncronas devem sempre ter rollback visual no catch. Passar a referência DOM ao handler assíncrono ao invés de tentar re-consultar o DOM.
- **Status**: ✅ Resolvido em 16/05/2026.

---

### ERR-047 — Forma de pagamento "Crédito" sem validação do cartão associado
- **Data**: 16/05/2026
- **Arquivo**: `js/recorrentes.js` — `salvarRecorrente()`
- **Sintoma**: Usuário podia selecionar "Crédito" como forma de pagamento, deixar o campo cartão vazio, e salvar. O documento era criado com `formaPagamento: 'Crédito'` e `cartaoId: null` — quebrando integrações downstream (dashboard, processamento de fatura).
- **Causa raiz**: A validação verificava apenas `descricao`, `valor` e `categoria`. O campo `cartaoId` não tinha guard.
- **Solução aplicada**: Adicionado ao bloco de validação: `if (forma === 'Crédito' && !cartaoId) { csCartaoTrigger.classList.add('error'); erros = true; }`.
- **Regra de prevenção**: Campos condicionalmente obrigatórios (visíveis apenas quando outra opção é selecionada) devem ter validação condicionada à mesma lógica de exibição.
- **Status**: ✅ Resolvido em 16/05/2026.

---

### ERR-048 — `insights.js`: SyntaxError — `totalRec` declarado duas vezes na mesma função
- **Data**: 18/05/2026
- **Arquivo**: `js/insights.js` — função `gerarAlertas()`
- **Sintoma**: Página `insights.html` ficava presa no splash eterno; módulo não executava.
- **Causa raiz**: Variável `const totalRec` declarada em linha 241 (início da função) e novamente em linha 282 (bloco de dívidas dentro da mesma função), causando `SyntaxError` que impedia o módulo inteiro de ser avaliado.
- **Solução aplicada**: Removida a segunda declaração duplicada na linha 282; o bloco de dívidas passa a usar a variável já declarada anteriormente.
- **Regra de prevenção**: Ao adicionar novo código em função existente, verificar se as variáveis a declarar já existem no escopo da função. Preferir nomes mais específicos em blocos diferentes.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-049 — `insights.js`: import estático de `firebase-messaging.js` bloqueia módulo em file://
- **Data**: 18/05/2026
- **Arquivo**: `js/insights.js` — linha 29-30
- **Sintoma**: `firebase-messaging.js` não estava acessível (`net::ERR_ABORTED`) neste ambiente, causando falha do import estático e impedindo todo o módulo de executar (splash eterno).
- **Causa raiz**: Import estático de CDN em top-level do módulo. Se a URL falha, o módulo inteiro falha sem possibilidade de fallback.
- **Solução aplicada**: Substituído import estático por import dinâmico (`await import(...)`) dentro de `ativarNotifPush()`, que é a única função que usa `getMessaging`. Assim a falha é localizada.
- **Regra de prevenção**: Imports de módulos CDN usados apenas em funcionalidades opcionais (push, analytics, etc.) devem ser dinâmicos para não bloquear a inicialização.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-050 — Comparativo: meses padrão selecionavam meses futuros
- **Data**: 18/05/2026
- **Arquivo**: `js/comparativo.js` — `populaSelects()`
- **Sintoma**: Ao abrir `comparativo.html`, os dropdowns mostravam Junho e Julho 2026 (meses com transações futuras/parceladas), em vez do mês atual (Maio 2026) e o anterior.
- **Causa raiz**: `default2 = sorted[0]` e `default1 = sorted[1]` pegavam os dois meses mais recentes no dataset, sem considerar a data atual. Com parcelas lançadas no futuro, esses eram meses futuros.
- **Solução aplicada**: Adicionada lógica para filtrar `sorted` por meses `<= mesAtualPfx` antes de definir defaults. O mês mais recente não-futuro é o default do Mês 2; o anterior a ele é o default do Mês 1.
- **Regra de prevenção**: Ao definir "mês padrão" em qualquer tela, sempre usar `new Date()` como âncora e filtrar por `<= mesAtual`.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-051 — Comparativo: saldo exibido sem sinal negativo quando despesas > receitas
- **Data**: 18/05/2026
- **Arquivo**: `js/comparativo.js` — `comparar()`, linhas de renderização do saldo
- **Sintoma**: Quando despesas eram maiores que receitas (saldo negativo), o valor aparecia positivo (ex: "R$ 1.470,39" em vez de "-R$ 1.470,39"). A cor ficava vermelha (correto), mas o sinal era omitido.
- **Causa raiz**: `fmt(Math.abs(d1.saldo))` — `Math.abs()` removia o sinal antes de formatar.
- **Solução aplicada**: Trocado para `fmt(d1.saldo)` — `fmt()` usa `toLocaleString` com `style:'currency'` que formata valores negativos corretamente.
- **Regra de prevenção**: Nunca usar `Math.abs()` em valores monetários exibidos ao usuário. Usar cor/ícone para indicar positivo/negativo, mas preservar o sinal no texto.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-052 — Análises: `.dash-main` sem `min-width:0` causava overflow horizontal em mobile
- **Data**: 18/05/2026
- **Arquivos**: `graficos.html`, `balanco-mensal.html`, `comparativo.html`, `relatorios.html`, `insights.html`
- **Sintoma**: Em viewport estreito (<768px), o conteúdo das telas de Análises estourava 135px além do viewport. Colunas da direita em grids 2-col eram cortadas por `overflow-x:hidden` do body.
- **Causa raiz**: Flex item `.dash-main` com `flex:1` mas sem `min-width:0`. Por padrão, `min-width:auto` em flex items impede que o item encolha abaixo da largura mínima do conteúdo. O conteúdo interno (charts, grids) forçava 625px em um container de 490px.
- **Solução aplicada**: Adicionado `min-width:0` ao CSS de `.dash-main` nas 5 páginas de Análises.
- **Regra de prevenção**: Todo flex item que precisa encolher abaixo do tamanho do conteúdo DEVE ter `min-width:0`. Especialmente necessário em layouts responsivos com grids internos.
- **Status**: ✅ Resolvido em 18/05/2026.
