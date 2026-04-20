# ERRORS_LOG.md — Memória de Cura

**Projeto**: Bud Finance  
**Última atualização**: 18/04/2026

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
