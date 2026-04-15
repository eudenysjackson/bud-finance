# DECISIONS_LOG.md — Registro de Decisões Arquiteturais

**Projeto**: Bud Finance  
**Última atualização**: 15/04/2026

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

### DEC-005 — Mensagens de erro genéricas no login

- **Data**: 15/04/2026
- **O que foi decidido**: Nunca revelar se email/matrícula existe ou não. Erro sempre genérico: "E-mail/matrícula ou senha incorretos."
- **Por quê**: Segurança — impede enumeração de contas (OWASP).
- **Consequências**: UX levemente pior (usuário não sabe se errou email ou senha), mas segurança é prioridade.
- **Quando revisar**: Nunca — é regra de segurança permanente.

---

### DEC-006 — Primeiro login obriga troca de senha

- **Data**: 15/04/2026
- **O que foi decidido**: Cadastro gera senha temporária; no primeiro login, redireciona para `trocar-senha.html` antes do dashboard.
- **Por quê**: Segurança — garante que o usuário defina uma senha forte pessoal.
- **Consequências**: Flag `primeiroLogin: true` no Firestore. Redirecionamento antes do dashboard.
- **Quando revisar**: Se o fluxo de onboarding mudar.

---

### DEC-007 — Modal de reenvio de verificação de email criado via JS

- **Data**: 15/04/2026
- **O que foi decidido**: O modal é criado em runtime via `document.createElement` com estilos inline (não classes Tailwind).
- **Por quê**: DEC-002 — classes Tailwind dinâmicas não funcionam com build estático.
- **Consequências**: Estilo do modal é definido via `style.cssText` inline.
- **Quando revisar**: Se migrar para build JIT do Tailwind.

---

### DEC-008 — Sistema de Temas com CSS Custom Properties

- **Data**: 15/04/2026
- **O que foi decidido**: Implementar 8 temas (Gelo, HBO Dark, Azul, Roxo, Rosa, Amarelo, Verde, Vermelho) via CSS variables (`--bg-page`, `--text-main`, `--card-bg`, etc.) trocados em runtime por JS.
- **Por quê**: Permitir personalização visual total sem duplicar CSS. Cada tema muda o fundo, vidro, botões e inputs mantendo a integridade do layout.
- **Consequências**: Todas as cores dinâmicas devem usar `var(--nome)`. Cores de sentimento (verde/vermelho/âmbar) permanecem fixas. Tema salvo em `localStorage.bud_theme`.
- **Quando revisar**: Se o número de temas crescer além de 10 ou se for necessário temas por usuário no backend.
