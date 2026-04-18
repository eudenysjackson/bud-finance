# ERRORS_LOG.md — Memória de Cura

**Projeto**: Bud Finance  
**Última atualização**: 17/04/2026

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
