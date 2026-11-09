# ERRORS_LOG.md — Memória de Cura

**Projeto**: Bud Finance  
**Última atualização**: 01/11/2026

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

---

### ERR-053 — Backgrounds hardcoded em alertas JS quebram legibilidade no tema Dark
- **Data**: 18/05/2026
- **Arquivos**: `js/dashboard.js`, `js/dividas.js`, `js/investimentos.js`
- **Sintoma**: Nos temas escuros (hbo Dark, onyx, etc.), os cards de alerta gerados por JS apareciam como blocos brancos/creme chamejantes sobre fundo preto — texto legível mas fundo completamente fora do tema.
- **Detalhes**:
  - `dashboard.js` — Limites widget: `rgba(255,251,235,0.8)` (amarelo-creme) e `rgba(254,242,242,0.8)` (rosa-creme) para cards de alerta
  - `dashboard.js` — Dívidas em Atraso widget: `rgba(254,242,242,0.7)` (rosa claro) nos rows de dívidas
  - `dividas.js` — seção alertas: `rgba(254,242,242,0.8)` (rosa claro) e `rgba(255,247,237,0.9)` (laranja-creme)
  - `investimentos.js` — alerta diversificação: `#fffbeb` (creme puro) e `color:#92400e` (marrom escuro — invisível em dark)
- **Causa raiz**: Elementos gerados via JS usavam cores literais RGB sem transparência semântica. Os valores eram pensados para tema Light e ficavam hardcoded independente do tema ativo.
- **Solução aplicada**: Substituídas todas as cores por `rgba()` semi-transparentes semanticamente corretas:
  - Vermelho/atraso: `background:rgba(220,38,38,0.08); border:rgba(220,38,38,0.25)`
  - Amarelo/alerta: `background:rgba(217,119,6,0.1); border:rgba(217,119,6,0.3)`
  - Verde/ok: `background:rgba(22,163,74,0.1); border:rgba(22,163,74,0.3)`
  - Texto mantido em cores semânticas diretas (`#dc2626`, `#d97706`, `#16a34a`) que são legíveis em qualquer fundo.
- **Regra de prevenção**: Para backgrounds de alerta gerados por JS, SEMPRE usar `rgba()` com opacidade baixa (0.08–0.12) para que o fundo subjacente (dark ou light) apareça. Cores semanticamente fortes (`#dc2626`, `#d97706`) funcionam bem como texto em qualquer tema. NUNCA usar cores RGB opacos como background em elementos dinâmicos.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-054 — Botão filtro ativo "Todas" em `dividas.html`: texto invisível no tema Dark
- **Data**: 18/05/2026
- **Arquivo**: `dividas.html` (HTML inicial) + `js/dividas.js` (`setFiltroDiv`)
- **Sintoma**: No tema HBO Dark, o botão "Todas" (filtro ativo) aparecia como um retângulo branco sem texto visível. O botão "Em Atraso" e "Ativas" eram normais.
- **Causa raiz**: O tema hbo define `--btn-bg: #ffffff` (branco) como cor de botão primário. O botão ativo usava `color:#fff` hardcoded — resultando em texto branco sobre fundo branco (invisível). Duplo problema: (1) HTML inline `style="color:#fff"` na definição inicial do botão. (2) `js/dividas.js` → `setFiltroDiv()` também setava `b.style.color = ativo ? '#fff' : ...` por JS ao clicar.
- **Solução aplicada**: (1) HTML `dividas.html`: alterado `color:#fff` para `color:var(--btn-text,#fff)`. (2) JS `dividas.js`: alterado `'#fff'` para `'var(--btn-text)'` no `setFiltroDiv`.
- **Regra de prevenção**: NUNCA hardcodar `color:#fff` em botões primários. O tema hbo usa `--btn-bg:#ffffff` (branco) portanto `--btn-text` é `#000000`. Sempre usar `color:var(--btn-text)` em botões que recebem `background:var(--btn-bg)`.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-055 — `color:var(--text-sec)` em elementos com `background:var(--card-bg)`: texto invisível nos 5 temas coloridos
- **Data**: 18/05/2026
- **Arquivos afetados** (10 arquivos, 36 ocorrências): `extrato.html`, `comparativo.html`, `balanco-mensal.html`, `assistente-ia.html`, `dividas.html`, `insights.html`, `limites.html`, `graficos.html`, `investimentos.html`, `relatorios.html`
- **Sintoma**: Botões de ação secundários (Ocultar Valores, Atualizar, Exportar PDF/CSV, Intervalo, Hoje, Exportar Conversa, Limpar Chat, Copiar Limites, etc.), chips de filtro (Receitas/Despesas em tendência, Ativas em dívidas) e o trigger de custom-select em `dividas.html` apareciam com texto completamente invisível nos temas Rosa, Azul, Roxo, Verde e Vermelho.
- **Causa raiz**: Esses elementos usavam `color:var(--text-sec)` com `background:var(--card-bg)`. Nos 5 temas coloridos, `--text-sec` é definido como uma cor pastel quase branca (ex: Rosa → `#fce7f3`, Azul → `#dbeafe`) — sendo invisível sobre o fundo branco/glass `--card-bg` (`rgba(255,255,255,0.92)`). Comprovado via computed styles no browser.
- **Solução aplicada**: Substituição em batch (PowerShell) de `color:var(--text-sec)` → `color:var(--card-text)` em todas as linhas que também continham `background:var(--card-bg)`, nos 10 arquivos afetados. Em todos os temas, `--card-text` é uma cor escura adequada para leitura sobre fundo branco/glass.
- **Regra de prevenção**: `--text-sec` é destinado a texto em fundos de PÁGINA (coloridos/escuros do tema). NUNCA usar `--text-sec` em elementos que tenham `background:var(--card-bg)` — usar sempre `--card-text` (primário) ou `--card-text-sec` (secundário) nesses contextos.
- **Status**: ✅ Resolvido em 18/05/2026.

---

### ERR-056 — Alertas com `rgba()` semi-transparente diretamente no fundo de página colorido: invisíveis nos temas coloridos
- **Data**: 18/05/2026
- **Arquivos afetados**: `js/investimentos.js` (`renderizarAlertaDiversificacao`), `js/dividas.js` (alertas em `#listaAlertas`)
- **Sintoma**: O alerta de diversificação em Investimentos e os alertas de parcelas em atraso/juros abusivos em Dívidas apareciam como manchas levemente tingidas ou quase invisíveis sobre o fundo colorido da página (ex: rosa, azul) nos temas coloridos.
- **Causa raiz**: Os alertas eram inseridos diretamente no fundo da página (fora de containers brancos). A técnica `background: rgba(cor, 0.08–0.1)` funciona sobre branco/preto mas desaparece em fundos coloridos vibrantes.
- **Solução aplicada**: Alterado `cssText` para usar `background:var(--card-bg)` + `border-left:4px solid #cor` colorida. O alerta sempre aparece como um card branco/glass com borda colorida semântica, independente do tema.
- **Regra de prevenção**: Alertas inseridos diretamente no fundo de página (não dentro de `.summary-card`/`.section-card`) DEVEM usar `background:var(--card-bg)` como base. A técnica `rgba(cor, baixa-opacidade)` só funciona dentro de containers já brancos/glass.
- **Status**: ✅ Resolvido em 18/05/2026.

### ERR-057 — FCM `getToken` retornava 401 de `fcmregistrations.googleapis.com` após troca de VAPID key
- **Data**: 31/05/2026
- **Arquivo**: `appbudfinance/js/push.js` — `registerPushToken()`
- **Sintoma**: Em `configuracoes.html`, ao clicar em "Ativar" notificações, console exibia `POST https://fcmregistrations.googleapis.com/v1/projects/bud-finance/registrations 401 (Unauthorized)` e em seguida `POST /api/push/test 400 (Bad Request)` com mensagem "Nenhum FCM token salvo. Ative as notificações primeiro."
- **Causa raiz**: A VAPID key foi rotacionada em 23/05. Browsers que já tinham concedido permissão guardavam um `PushSubscription` antigo com `applicationServerKey` da VAPID antiga. Em chamadas subsequentes a `getToken()`, o Firebase tentava registrar essa subscription cacheada na FCM Registration API → 401 (chave não bate). O `/api/push/test` falhava porque nenhum token novo era salvo no backend.
- **Solução aplicada**: Em `getToken()`, capturar o erro 401/`token-subscribe-failed`, executar `swReg.pushManager.getSubscription()` + `oldSub.unsubscribe()` para descartar a subscription antiga, e tentar `getToken()` novamente uma vez. A próxima chamada cria uma subscription nova com a VAPID atual e a registra com sucesso na FCM.
- **Regra de prevenção**: Após qualquer troca de VAPID key, prever fallback de unsubscribe + retry no client. O usuário não deveria precisar de "Clear site data" manual.
- **Status**: ✅ Resolvido em 31/05/2026.

### ERR-058 — Service Worker FCM 404 em dev local (`/appbudfinance/firebase-messaging-sw.js`)
- **Data**: 31/05/2026
- **Arquivo**: `appbudfinance/js/push.js` — `registerPushToken()`
- **Sintoma**: Em dev (`http://127.0.0.1:3001/configuracoes.html`), console exibia `[Push] Falha ao registrar Service Worker: ... A bad HTTP response code (404) was received when fetching the script.` Sem SW, `getToken()` nunca era chamado e o backend respondia "Nenhum FCM token salvo".
- **Causa raiz**: O `push.js` registrava o SW com path absoluto `/appbudfinance/firebase-messaging-sw.js`, correto em produção (servida em `budsolucoes.com.br/appbudfinance/`), mas inválido em dev local — o live-server serve a pasta `appbudfinance/` como raiz, então o SW está em `/firebase-messaging-sw.js`.
- **Solução aplicada**: Trocar para path relativo `'firebase-messaging-sw.js'` (sem barra inicial) e remover o `scope` explícito. O navegador resolve relativo à URL do HTML; default scope = diretório onde o SW está hospedado. Funciona em prod e em dev sem mudar configuração.
- **Regra de prevenção**: Para arquivos co-localizados com o HTML em ambos os ambientes, preferir paths relativos. Paths absolutos quebram quando a estrutura de servir é diferente entre dev e prod.
- **Status**: ✅ Resolvido em 31/05/2026.

### ERR-059 — Avatar via Firebase Storage exigia plano Blaze (pago)
- **Data**: 31/05/2026
- **Arquivo**: `appbudfinance/js/configuracoes.js` — `setupFotoPerfil()`
- **Sintoma**: Console mostrava erros de CORS em `firebasestorage.googleapis.com` ao carregar/upload de avatares. Firebase Console exigia upgrade do projeto para Blaze para inicializar o bucket de Storage.
- **Causa raiz**: Firebase mudou política — Storage só funciona no plano Blaze (pay-as-you-go). Avatar simples (foto de perfil) não justifica habilitar billing nem manter bucket adicional.
- **Solução aplicada**: Substituir upload por redimensionamento client-side via `<canvas>` para 256×256 JPEG (q=0.85, ~10–25 KB) e salvar como `data:URL` no campo `photoURL` do doc do usuário no Firestore. Sem Storage, sem CORS, sem billing. `updateProfile` do Auth não é chamado (limite ~2KB do photoURL do Auth não suporta data URLs).
- **Regra de prevenção**: Para imagens pequenas e por usuário (avatar), preferir base64 no Firestore. Para mídias maiores ou compartilhadas, considerar Cloudinary free tier ou ImgBB antes de habilitar Storage pago.
- **Status**: ✅ Resolvido em 31/05/2026 — telas que mostram avatar pelo `<img>` continuam funcionando porque data URLs são URLs válidas. Sidebar de outras telas que ainda usa só inicial fica como pendência.


### ERR-060 — Modelos indisponíveis interrompiam importações de IA
- **Data**: 27/10/2026.
- **Arquivos**: `backend/server.js`, `backend/.env.local.example`.
- **Sintoma**: importação de fatura retornava erro genérico; Groq respondia `model_not_found` para `qwen/qwen3.6-27b`. Classificação de PDF também referenciava `llama3-8b-8192`, ausente da lista da chave.
- **Solução**: modelo multimodal centralizado em `GROQ_MODEL`, padrão `qwen/qwen3.8-27b`, confirmado pela API da conta e por chamadas reais. Removidas todas as referências aos dois modelos indisponíveis nas chamadas.
- **Segundo bloqueio**: resposta 429 por limite de saída de 1000 tokens/minuto da conta. Orçamento configurável; local 900. Resposta cortada deixa de ser aceita como extração completa e recebe mensagem orientando dividir o documento.
- **Validação**: oito testes HTTP locais com documentos fictícios: fatura PDF/imagem, cupom texto/imagem, extrato imagem, classificação PDF/imagem e conexão de chat. Conferidos itens e valores nos cenários financeiros.
- **Status**: corrigido localmente. Produção requer publicação; capacidade de documentos longos depende da cota da Groq (PEND-IA-001).

### ERR-061 — PDF válido rejeitado pelo leitor antigo em teste de integração
- **Data**: 27/10/2026.
- **Sintoma**: PDF sintético válido era lido no teste isolado, mas falhava com `bad XRef entry` no runtime do servidor.
- **Solução**: passar `new Uint8Array(buffer)` ao `pdf-parse`, selecionando `v2.0.550` já distribuída na dependência. Aplicado também a cupons e classificação de documentos.
- **Validação**: importação HTTP de fatura PDF e classificação PDF aprovadas.
- **Status**: corrigido; não há garantia de leitura de PDFs escaneados ou protegidos por senha.

### ERR-062 — Importação longa abortava por limite de saída e cota por minuto
- **Data**: 27/10/2026.
- **Sintoma**: mesmo após corrigir o modelo, uma fatura real atingia `finish_reason=length`; nova tentativa recebia 429 com espera de 40,2 segundos, mas o código aguardava apenas 1,5 segundo e a tela cancelava em 45 segundos.
- **Correção**: leitura recursiva em partes, espera automática da janela do provedor, fila e acompanhamento assíncrono. Textos completos são preservados; PDF escaneado passa pela renderização de páginas. A correção substitui a orientação anterior de dividir o arquivo manualmente.
- **Validação**: nove testes automatizados aprovados; teste real de 24 compras em três páginas conferiu todos os itens e soma R$ 300; PDF escaneado conferiu soma R$ 20.
- **Limites reais**: capacidade diária/financeira do fornecedor e legibilidade do documento não podem ser removidas pelo aplicativo. Reinício do processo interrompe trabalhos em memória (PEND-IA-004).

## ERR-063 — Espera por IA e conciliação artificial (27/10/2026)

Faturas textuais eram sempre enviadas à Groq, incluindo páginas de instruções, sujeitas ao limite de saída por minuto. Leitura direta validada do layout Nubank evita esse custo. A revisão criava saldo de ajuste e inferia estorno pelo valor da diferença, ocultando divergências; ambos removidos. Falhas de capacidade e timeout de fatura agora têm códigos e mensagens específicos. O erro terminal relatado pelo usuário não foi reproduzido: ao inspecionar o navegador, a tentativa anterior já estava em revisão. Novo upload fictício chegou à revisão com 24 compras/R$300; teste HTTP assíncrono mediu 1536ms.

## ERR-064 — Importações nas demais telas (27/10/2026)

Contas não enviava Authorization e falhava401. Compras descartava páginas após a terceira e rasterizava PDFs textuais. Dívidas descartava páginas após a quinta e não reconhecia PDF escaneado. Corrigidos e reproduzidos no navegador com extrato de imagem, cupom de quatro páginas e contrato de seis páginas/escaneado. Compra importada abria com título Editar Compra; corrigido para Nova Compra. Upload de Compras permitia8MB na tela mas3MB no servidor; alinhado em8MB com normalização de imagem.

## ERR-065 — Bloqueios fora da importação (27/10/2026)

Aportes falhavam por falta de regra para depositos; histórico fora do batch permitia débito parcial e repetição. Exclusão usava user.delete inexistente no SDK modular, era bloqueada pelas regras e não limpava dados aninhados. Relatórios consultava coleção legada cartoes. DELETE de push era barrado no preflight. Corrigidos e validados por21 regressões,5 grupos emulados e conferência de Metas/Relatórios no navegador. Regras, backend e frontend corrigidos ainda precisam ser publicados.

## ERR-066 — Recuperação sem marca e link incompatível (27/10/2026)

Publicação antiga falhava no EmailJS e recorria ao Firebase padrão. Histórico real identificou autorização Gmail expirada (Invalid grant). Usuário reconectou; serviço salvo, template atualizado, envio visual confirmado no histórico. Código atualizado remove falso sucesso no transporte e fallback sem marca em Configurações; link de recuperação inclui mode e aliases de template. Recuperação emulada completa com código de uso único aprovada.

## ERR-067 — Estados de cobrança em homologação (27/10/2026)

Cancelamento de assinatura LOCAL_TEST tentava consultar MP real; correção limitada ao modo emulador. Aprovação não limpava pagamentoPendente; agora limpa e mantém assinaturaStatus. Testes automatizados e HTTP emulados cobrem os estados sem cobrança real.

## ERR-068 — Cobranças recorrentes e webhook (27/10/2026)

Evento subscription_authorized_payment não era tratado; pagamentos sem preapproval_id perdiam associação. Webhook reconhecia200 antes de gravar e ignorava falhas. Status duplicados podiam recalcular o prazo indevidamente. Corrigidos com resolução pela fatura,503 em falhas e prazo baseado no provedor.12 testes de checkout e37 regressões aprovados; ciclo real continua pendente de sessão/configuração/publicação.
## Validação adicional — 31/10/2026

Troca de plano abria novo checkout mantendo assinatura anterior: reproduzido por teste200 onde deveria bloquear; agora bloqueado e substituído por alteração no mesmo contrato para o próximo ciclo. Mensagem de cancelamento contraditória corrigida. Teste com MP real revelou payer_email omitido: conferência passa a usar vínculo UID/assinatura e payer_id, validando e-mail quando retornado. Regras genéricas permitiam escrita do titular em _seguranca, incluindo tentativas de verificação: bloqueado acesso direto e validado403 no emulador. Render não tinha chave privada EmailJS/template boas-vindas/segredo de confirmação: variáveis aplicadas com autorização e reinício Live. Workflows GitHub diário/deploy desativados manualmente; última falha diária por billing identificada, sem reativação ou disparo coletivo.

## 31/10/2026 — erros tratados na validação final
Trabalhos IA em memória perdiam arquivo após reinício: candidata usa Firestore fragmentado/lease; retomada, isolamento e cota única passaram. Teste inicial usava Promise de vm incompatível com SDK: função do teste compilada no contexto nativo. Push podia indicar ativo por preferência local mesmo com registro falho, destruía subscription ao reabrir e acumulava listeners: corrigido; entrega física ainda não validada. Checkout permitia múltiplas contratações pendentes: reserva transacional, reutilização e cancelamento pendente implementados;51 regressões passaram. Classificador opcional Buddy retornou429 no teste estendido, permanece fora da primeira versão. Não confundir sucesso de envio FCM/EmailJS com recebimento no dispositivo/caixa postal.

##31/10/2026 — correção de avisos antigos
Cache sem validade e consulta de globais reapresentavam testes antigos para diferentes contas. Removidos da exibição; nenhum documento financeiro ou comunicado do servidor foi apagado. Faixas de assinatura unificadas, avisos de pagamento não ignoram confirmações, push preserva vários dispositivos e TTL curto.59regressões aprovadas. Entrega física depende da conferência pós-publicação.


### ERR-069 — Link de confirmação passava pela dashboard antes do onboarding

- **Data:** 01/11/2026
- **Descrição:** após clicar no link de confirmação do cadastro, o login mágico abria a dashboard e em seguida o guard mandava o usuário para o onboarding.
- **Causa raiz:** `entrarPorLinkMagico()` em `appbudfinance/js/index.js` redirecionava sempre para `dashboard.html`, sem considerar que o cadastro novo ainda não concluiu `onboardingConcluido`.
- **Correção:** resolvido em código na branch `codex/fix-confirmation-onboarding-20261101`; após autenticar com o token mágico, navegar diretamente para `onboarding.html`. O guard do onboarding mantém o retorno à dashboard depois de concluir as etapas.
- **Status de publicação:** ✅ Integrado no `master` pelo commit `f3c0453`; workflow `41338154393` passou nas regressões e no deploy do GitHub Pages. O clique real no e-mail de confirmação ainda não foi validado ponta a ponta.
- **Prevenção:** links que autenticam uma conta recém-criada devem respeitar o fluxo de onboarding antes de encaminhar ao painel.


### ERR-070 — indicação não propagava código nem aplicava benefício corretamente
- **Data:** 01/11/2026
- **Sintoma:** escolher “Indicação” no onboarding não pedia código; código não acompanhava todos os links de venda até o checkout; percentuais divergiam e o indicador não recebia benefício.
- **Causa raiz:** origem de aquisição comoConheceu era confundida com atribuição; cadastro, onboarding, link comercial, checkout, webhook e Firestore não compartilhavam um único fluxo.
- **Correção preparada:** captura de código no onboarding e cadastro, pré-preenchimento de ref=, validação autenticada no backend, desconto de 15% na primeira cobrança, recompensa única de 50% numa cobrança futura após aprovação e restauração do preço regular via API de assinatura. Os descontos não se acumulam no mesmo ciclo.
- **Status:** suíte automatizada passou na branch codex/beneficios-indicacao-15-50-20261101 (Actions 41341678748). Homologação sandbox, integração e deploy continuam pendentes; não afirmar como publicado.


## Correção da espera de importação IA — 01/11/2026

ERR-071 / PEND-IA-ESPERA: a mensagem aguardando serviço vem do retry HTTP 429; até 12 esperas longas e polling/worker sem prazo mantinham a interface aberta. Correção em codex/corrige-importacao-ia-travada-20261101: tentativas curtas e limitadas, worker com prazo de 180s, registro persistente antigo encerrado, cliente com 210s totais/30s por conexão e mensagens de falha/cancelamento claras. 91 regressões aprovadas. Detalhes em RELEASE_IA_ESPERA_2026-11-01.md. Integração/deploy em preparação. Indicações: PR #5 integrado em 3d6f5f4; Pages 41344526378 aprovado e backend Render Live confirmado. Regras de indicação compiladas e publicadas no projeto bud-finance em 01/11/2026. Workspace original preservado.


## Publicação confirmada — indicações e importação IA (01/11/2026)

- PEND-REF-001: descontos 15%/50% homologados e PUBLICADOS. PR #5 integrado em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado e Render Live confirmado. Regras do Firestore compiladas e publicadas no projeto bud-finance após login do titular.
- ERR-071 / PEND-IA-ESPERA: RESOLVIDO E PUBLICADO pelo PR #6, commit e50356c715886cb9a25d371c67345c4096eebaab. CI do PR 41345953909 e Pages 41346014030 aprovados; Render Live no mesmo commit. HTTP 200 no JavaScript público confirmou prazo global de 210s, mensagem de conexão indisponível e retirada do aviso antigo de 45s.
- Validação: 91 regressões aprovadas; limites persistentes do provedor, workers travados, registro antigo com lease ativa, ausência de resposta e preservação de documentos extensos/PDF/imagem. Fluxos de falha emulados; a fatura original da captura não foi fornecida. Não afirmar que a capacidade do provedor de IA é ilimitada nem que a fatura original foi reimportada.
- Decisão operacional: três tentativas no provedor; esperas de até 15s e total de até 20s por solicitação; worker de 180s; cliente de 210s e conexão de 30s. Falha é explícita, libera a interface/admissão e não retorna transações parciais.
- Relatórios: RELEASE_IA_ESPERA_2026-11-01.md e RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. Código e alterações preexistentes do workspace original preservados; registros locais de continuidade foram atualizados. Próxima reprodução específica depende do documento original, se o usuário relatar erro após atualizar a página.

## Limite de capacidade Groq observado — 01/11/2026

A captura às 17:24 mostra progresso emitido após HTTP 429 do provedor, aguardando 10s (primeira de até duas esperas curtas por chamada/trecho). Logo, a leitura ainda não havia terminado naquele instante; um documento pode apresentar essa etapa em mais de um trecho, e cada trecho enfrenta a mesma cota global. Se a capacidade continuar indisponível, a correção publicada encerra com erro em vez de manter a tela infinita. Isso não garante leitura da fatura original, que não foi fornecida. PEND-IA-001 segue aberta para medir capacidade em documentos reais; ver DEC-069 para Developer futuro e avaliação de arquitetura híbrida/própria.

### ERR-072 — Parser direto rejeita variação de fatura Nubank e encaminha à IA (01/11/2026)

- **Evidência:** análise local de PDF textual Nubank de 7 páginas enviado pelo usuário; nenhuma chamada à Groq.
- **Causa observada:** parser exige espaço entre `Total a pagar` e `R$`, ausente nesta extração. Ao relaxar apenas o espaço num diagnóstico isolado, a soma das linhas capturadas ainda não conciliou com o total, portanto a rejeição estrita permanece correta e a rota encaminha para IA.
- **Impacto:** chamadas à Groq para layout reconhecível; sob cota compartilhada pode ocorrer429. O arquivo não foi importado ou persistido. Não aceitar resultado parcial para ocultar divergência.
- **Status:** aberto para correção com fixtures sintéticas e nova validação de conciliação; PEND-IA-006. Não registrar dados pessoais/financeiros do documento.

## Correção de importação e renovação de sessão — 01/11/2026

ERR-072 / PEND-IA-006: correção implementada. PDF Nubank real analisado localmente com o mesmo readPDF de produção: 51 linhas, diferença de um centavo entre soma e total. Parser aceita apenas variação de até 1 centavo, preserva linhas/total e retorna differenceCents/requiresReview; revisão mostra aviso explícito. Diferenças maiores seguem para IA. Não cria ajuste e não presume arredondamento do banco. Rótulo de total permite moeda adjacente. Nenhum dado financeiro real incluído em fixtures ou Git.

Firebase: chave Bud Finance Web não permitia securetoken.googleapis.com, bloqueando renovação de sessão. Serviço acrescentado à lista existente sem remover restrições; operação concluída e probe com refresh inválido retornou INVALID_REFRESH_TOKEN, em vez de API_SERVICE_BLOCKED. A confirmação com sessão real do titular ainda depende de abrir novamente o app.

Validação: 92 testes aprovados, zero falhas; PDF real aceito pelo parser local sem chamada Groq, 51 linhas e aviso de um centavo. Não confundir isso com validação autenticada no navegador online. Groq permanece para layouts desconhecidos/imagens; capacidade externa continua finita (DEC-070). Publicação em preparação.


## Correção de importação e renovação de sessão — 01/11/2026

ERR-072 / PEND-IA-006: correção implementada. PDF Nubank real analisado localmente com o mesmo readPDF de produção: 51 linhas, diferença de um centavo entre soma e total. Parser aceita apenas variação de até 1 centavo, preserva linhas/total e retorna differenceCents/requiresReview; revisão mostra aviso explícito. Diferenças maiores seguem para IA. Não cria ajuste e não presume arredondamento do banco. Rótulo de total permite moeda adjacente. Nenhum dado financeiro real incluído em fixtures ou Git.

Firebase: chave Bud Finance Web não permitia securetoken.googleapis.com, bloqueando renovação de sessão. Serviço acrescentado à lista existente sem remover restrições; operação concluída e probe com refresh inválido retornou INVALID_REFRESH_TOKEN, em vez de API_SERVICE_BLOCKED. A confirmação com sessão real do titular ainda depende de abrir novamente o app.

Validação: 92 testes aprovados, zero falhas; PDF real aceito pelo parser local sem chamada Groq, 51 linhas e aviso de um centavo. Não confundir isso com validação autenticada no navegador online. Groq permanece para layouts desconhecidos/imagens; capacidade externa continua finita (DEC-070). Publicação em preparação.

## Complemento após teste online (01/11/2026)
Primeiro deploy 9f52582 (PR #10) chegou ao Render Live e abriu revisão online com51 linhas. A conferência revelou heurística cliente que confundia compras de mesmo valor com estornos e seleção não preservava a soma líquida. Corrigido no caminho PDF validado: signedAmounts mantém sinais/linhas, créditos negativos selecionados individualmente, nenhuma inferência por valor. Script versionado para evitar cache antigo. 93 testes aprovados. Somente revisão testada; nenhum lançamento salvo. Publicação complementar em preparação.



## Confirmação final — Nubank e sessão online (01/11/2026)

RESOLVIDO E PUBLICADO: PR #10 (9f52582) e PR #11 (aea9b41b572f40a71d9ac6bf9301b4c53f48bc32). Render confirmou Live aea9b41; Pages 41359548750 concluído com sucesso. 93 regressões aprovadas; CI do PR11 41359482382/41359476868 aprovado. No navegador interno autenticado, o PDF real abriu a revisão com 51 linhas e 51 checkboxes selecionados, preservando sinais, sem depender de chamada Groq. Aviso explícito da diferença de R$0,01 exibido. Revisão ficou aberta para o titular; nenhum lançamento salvo. Após rollout, repetir leitura confirmou correção também da seleção (primeira tentativa durante troca de instância ainda usou resultado antigo). Firebase Secure Token API está permitida na chave Web; probe retornou INVALID_REFRESH_TOKEN para token propositalmente inválido, eliminando API_SERVICE_BLOCKED, e login/análise autenticada passaram. PEND-IA-006 / ERR-072 resolvidos para este layout; outros layouts/imagens permanecem sujeitos à capacidade Groq. Não generalizar a validação desta fatura para qualquer documento.

## ERR-073 — estornos desmarcados sem cancelar a compra elevavam o total salvo (01/11/2026)
O novo caminho PDF selecionava todos os sinais e divergia da regra anterior. Desmarcar créditos deixava compras correspondentes ativas. Corrigido com pares únicos por descrição/data/valor, exclusão conjunta de pares, crédito não pareado explícito, total selecionado real e testes de persistência/recálculo. Registros afetados da importação identificada reparados com precondições e backup privado. Publicação pendente. Ver RELEASE_ESTORNOS_2026-11-01.md.


## Identificação de estornos por linha — 01/11/2026
A regra de pareamento DEC-072 foi revogada: sem vínculo explícito do fornecedor, semelhança de descrição/data/valor não comprova cancelamento de compra. Cada valor positivo permanece compra ativa. Cada valor negativo explícito permanece devolução, com rótulo Estorno / devolução — abate o total da fatura; status interno credito representa abatimento de despesa, nunca receita. No caminho PDF validado todas as linhas originais são elegíveis, com controles habilitados; saldo líquido e guard de conciliação impedem salvar apenas compras omitindo devoluções. Removidos pareamento e rótulo crédito sem compra identificada. 95 regressões aprovadas, incluindo compras/devoluções na mesma data com mesmo valor e persistência/recálculo. Tentativa de rever reparação anterior foi interrompida sem gravações por precondição; consulta atual encontrou zero lançamentos na fatura/cartão anterior, portanto nada foi recriado. Não sobrescrever alterações do titular. Publicação em preparação. Esta atualização substitui os registros anteriores de exclusão automática dos pares.
## Revisão segura de estornos e conferência — 01/11/2026

Regra aprovada pelo titular: compra e devolução ficam desmarcadas juntas apenas com vínculo seguro; recompra permanece ativa. Identidade por mesmo valor/estabelecimento/data não basta. Implementação usa identificador bancário OFX compartilhado, exatamente duas linhas de sinais opostos e saldo zero; grupos ambíguos e estornos parciais permanecem separados. Sem identificador, o PDF mantém compras e abatimentos assinados e exige revisão; não declarar que os estornos desse PDF foram todos pareados. Seleção de um par identificado é conjunta; alteração que quebre saldo zero é bloqueada antes de salvar. Ação em massa Compras e abatimentos preserva devoluções sem par. Edição preserva sinal negativo.

Barra de conferência restaurada como progressbar visível e atualizada a cada seleção/valor: compara a soma selecionada ao total declarado, informa divergência exata, inclusive um centavo, e não afirma precisão universal nem 100% para OFX. Sem referência, informa impossibilidade de conciliação automática. Valores originais preservados, sem ajustes sintéticos. Guardas de duplicação e total permanecem.

Histórico verificado: e50356c (espera infinita) alterou apenas 2 linhas de cartoes.js relacionadas à espera; a classificação anterior já continha exclusão de negativos, FITID e inferência por valor. Portanto, a regra segura atual não era integralmente garantida antes. Alterações posteriores do parser/seleção alteraram o comportamento, documentadas nos PR10/11/13/14.

Validação: 97 regressões passaram; após ampliar o teste de persistência do par+recompra, 10 testes específicos passaram. Teste VM executa processamento, gravação e recálculo reais com Firestore emulado: somente a recompra é salva; valores repetidos sem identificador não são associados. Teste da barra cobre seleção que aumenta o total e divergência de um centavo. Deploy e inspeção pública pendentes neste registro.

Conta do titular: Plus concedido por autorização expressa e precondição Firestore; expiração de trial removida, nenhuma cobrança criada. Validação anterior online do PR14 abriu 51 linhas selecionadas e zero controles bloqueados, sem gravar lançamentos. Esta concessão substituiu a proposta de devolver quatro usos. Groq permanece com capacidade finita para imagens/layouts sem parser; Developer é aquisição futura. Não anunciar disponibilidade universal ilimitada.

Continuidade Claude/Codex: workspace original tem alterações preexistentes; preservá-las. Trabalho isolado em .tools/invoice-reconciliation-ui, branch codex/revisao-estornos-conciliacao-20261101. Próximo passo: conferir CI/publicação e a barra no app online. Nenhum dado financeiro privado incluído no Git; nenhum registro do usuário recriado ou salvo nesta entrega.


## Complemento da validação real — 01/11/2026
PR16 integrado em 00dcd47; CI41365013209/41365000333 e Pages41365083232 passaram. PDF real abriu revisão online com barra e aviso de um centavo, sem salvar. Ao desmarcar um abatimento, o total mudou mas o badge não atualizou: a inspeção real detectou integração ausente entre resumo e badge, causada por substituição que não correspondeu aos finais de linha CRLF. Corrigido com chamada explícita no resumo e teste que executa esse caminho real, em vez de chamar apenas o badge. Propriedade refundPair e handler conjunto também integrados e cobertos por teste de clique; recompra preservada. PR17 a92b1e1 preserva pagamento recebido fora dos abatimentos OFX. Suite final: 99 testes aprovados, incluindo pagamento anterior, par seguro, recompra, persistência e recálculo, seleção e atualização da barra. Nova publicação em preparação; não declarar o clique online corrigido até validá-lo após deploy. Nenhum lançamento do titular gravado.


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




## Correção de valores e parcelas das metas — 02/11/2026
Implementado na branch codex/correcao-valores-metas-20261102, clone .tools/goal-input-fix. Campos monetários selecionam o conteúdo ao receber foco e formatam ao sair; digitar substitui o valor inicial. Confirmação informa Registrando imediatamente, consulta somente os cartões usados e relê transações em paralelo preservando commit atômico/idempotência; não prometer latência zero do Firebase. Cartões mostra comprometimento global coerente com a barra e lista parcelas futuras de metas com valor/data/descrição. Caso relatado: compra em02/11, fechamento1/vencimento10,500 em8x resulta62,50 de dezembro2026 a julho2027; novembro zero é coerente com o ciclo, não ausência de lançamentos. Teste sintético específico aprovado; suíte130/130 aprovada. Não houve leitura autenticada de registros nem alteração dos dados do titular. Publicação em preparação; QA online pendente. Claude/Codex devem preservar registros e limites de evidência.



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
Causa: index redirecionava sessão já autenticada à dashboard sem tratar checkout; configurações enviava a essa entrada. CORRIGIDO NO CANDIDATO: checkout autenticado direto e guard preserva intenção e indicação. Troca superior deixa de usar agendamento de downgrade e abre cotação proporcional. Corrigido também cadastro com plano manual sem assinatura: contratação efetiva só substitui o plano após aprovação, sem conceder mudança por mero status autorizado.


## Mobile, rotas limpas e categorias — 02/11/2026
CORRIGIDO NO CANDIDATO: perfil aguardava load; consulta admin sem uso bloqueava Configurações; falha de categoria em Extrato mantinha loading; falha de plano era mostrada comoFree; popup no canto e categorias sem ordenação unificada; voltar tipoAutomático inferia direção de valor já absoluto; tiposReceita/Despesa vindos do backend não eram normalizados como crédito/débito.153 regressões aprovadas e UI móvel local conferida. Publicação/QA online pendentes nesta anotação.

## Planos e trial — 04/11/2026
Candidata em .tools/ui-checkout-nav, branch codex/cancelamento-pendente. Alterações preexistentes de checkout preservadas. Nova regra: Free 1 conta/1 cartão/5 lançamentos, Starter 1/1/10, Pro 2/2/15 +5 importações +5 serviços IA, Plus sem cotas do app nos recursos disponíveis. Free/Starter sem importações/IA. Trial72h equivale Plus, depois acesso efetivo Free; guarda trialIniciado para não reiniciar. Titular confirmou: cada parcela consome cota no mês da fatura.
Implementação: backend/plan-policy.js e financial-write.js; gravações financeiras passam por endpoint autenticado, transação e ledger privado por usuário/mês; adapter financial-firestore.js mantém contratos dos helpers de metas/dívidas. Regras negam escrita financeira direta pelo cliente e acesso aos ledgers. Cota inclui registros existentes no bootstrap por competência; apagar lançamento não devolve cota. Contas/cartões mais antigos dentro do limite continuam ativos; excedentes preservados e bloqueados. Identidades de importação impedem contar novamente o histórico da mesma importação. IA verifica cota também no commit para evitar concorrência. Trial e expiração usam transações para não sobrescrever plano pago concorrente.
UI: comparativo em caixas com ícones, bloqueios de recursos premium/contas excedentes, textos de trial e Pro corrigidos. Site sem alegações de importação universal/tempo garantido e sem depoimentos ilustrativos apresentados como reais; limites e política alinhados. Plus não elimina limites/indisponibilidade do fornecedor.
Validação:164 testes de release aprovados,3 testes adicionais do adapter aprovados; emulador Firestore/Auth demo-bud-security comprovou gravações concorrentes (somente uma passa no último slot), lote inteiro recusado quando mês futuro cheio, trial expirado e escrita direta403. Nenhuma alteração em produção ou usuário real.
ATENÇÃO implantação coordenada obrigatória: publicar backend com endpoint novo, frontend correspondente, depois regras; não publicar apenas as regras nem frontend contra backend antigo. Revisão visual/mobile e conferência final da candidata em andamento. Não declarar publicado. Cache/versionamento e registros finais precisam acompanhar entrega. Não misturar expiração automática de checkout de15min ou descontos de recuperação: continuam fora desta tarefa.


## Segurança e recuperação — validação local concluída (04/11/2026)
178 regressões e8 cenários Auth/Firestore emulados aprovados. Pacote público104arquivos verificado, sem padrões de credenciais privadas. Implementados owner-notifications.js (fila transacional por evento/dispositivo, destinatário corporativo escolhido pelo titular, admin+Auth verificado+consentimento), security-controls.js (headers/erros/revogação de sessões), regras de revogação e campos push protegidos, scan-public-artifact.cjs no CI e recuperação financeira AES-256-GCM com restore exclusivo em emulador vazio. Cadastro é evento do início de trial; contratação só após pagamento aprovado; abandono pendente não é cancelamento. Nenhum dado/envio real, mudança de infraestrutura ou publicação. Não há garantia de entrega física ou ausência de vulnerabilidades.
Relatório operacional: RELEASE_SEGURANCA_RECUPERACAO_2026-11-04.md. Ativação exige deploy coordenado junto dos planos, índice da fila, conta corporativa admin verificada e push ativo no celular. Backups automáticos gerenciados/Blaze, App Check/WAF e revisão especializada NÃO foram ativados; não marcar toda PEND-SEG-REVISAO como resolvida. Preparação e validação desta entrega concluídas; implantação/infraestrutura permanecem pendentes. Claude/Codex devem preservar alterações anteriores e atualizar status com evidência após implantação.


## Separação Finance/Gestor concluída — 04/11/2026
RESOLVIDA a pendência de separar o Gestor da candidata Finance. Preparação preservada em deferred/budgestor-20261104/snapshot,22arquivos com SHA-256 em manifest.json e roteiro de retomada no README. Pasta fora do pacote público e das dependências ativas do backend. Restaurados admin.html/admin.js anteriores a partir do artefato pré-Gestor; removidos redirecionamento do login, URLs administrativas novas, API Gestor, produtor/worker da fila de eventos e índices exclusivos. Não foi reativado envio administrativo para tokens pessoais do Finance. Planos, trial, cotas, segurança e recuperação financeira anteriores foram preservados. A negativa de acesso à coleção privada _owner_events permanece como defesa, sem produtores/consumidores ativos.
Validação:175 testes de release aprovados; redução de184 corresponde aos10 testes do Gestor/fila arquivados e1 teste novo que impede misturar Gestor no Finance. Pacote público104arquivos validado, scanner aprovado. Admin antigo incluído e nenhuma pasta budgestor/deferred no artefato. Web App Firebase já cadastrado permanece reservado, sem site ou backend do Gestor publicado. Sem deploy, cobrança, cancelamento, envio real ou alteração de dados de clientes. Próximo passo do Finance: revisar/publicar a candidata segregada conforme autorização; Gestor só retomar após finalizar Finance. Não copiar snapshots compartilhados inteiros sobre versões futuras; reaplicar somente diferenças por branch própria.


## Conferência explicativa do admin Finance — 04/11/2026
Leitura do código atual, sem alterações operacionais. Admin legado usa Firebase Auth padrão compartilhado com Finance; gate admins/uid.role admin. Abas overview/CRM/vendas/notificações/promoções/flags/IA/sistema. Indicadores comerciais são estimativas de perfis/preços, não extrato conciliado do Mercado Pago. Troca manual de plano altera perfil e não contrato MP. Encontrados controles legados não alinhados: addTrial30 usa planoVenceEm em vez de trialFim; deleteUser chama /api/admin/delete-user inexistente no server atual, sem Bearer e sem conferir response.ok, podendo mostrar sucesso indevido; removerAdmin usa escrita direta negada pelas regras. Registrar como PENDENTE revisão desses controles;175 testes da candidata não equivalem a homologação integral do painel. Nenhuma exclusão/plano/admin real alterado.
