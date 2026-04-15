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
