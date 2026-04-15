# Copilot Instructions — Bud Finance

## Seção 0 — Documentos Obrigatórios

Os 5 documentos abaixo governam este projeto. **Consulte-os antes de agir.**

| Documento | Quando consultar |
|---|---|
| **PROJECT_RULES.md** | Antes de escrever qualquer código. Contém stack, estrutura de pastas, convenções e proibições. |
| **ARCHITECTURE_MAP.md** | Antes de criar qualquer componente, helper, hook ou service novo. Atualize ao finalizar qualquer tarefa. |
| **DECISIONS_LOG.md** | Antes de refatorar qualquer padrão ou tomar decisão arquitetural não-óbvia. Registre decisões novas. |
| **ERRORS_LOG.md** | Antes de resolver qualquer bug. Verifique se já foi resolvido. Registre erros novos. |
| **ROADMAP.md** | Antes de implementar qualquer feature. NÃO implementar itens do backlog sem pedido explícito. |

## Seção 1 — Regras Gerais

- Stack: HTML5 + Tailwind CSS (build estático) + Vanilla JS (ES6+) + Firebase 10.8.1
- NUNCA usar classes Tailwind em elementos criados dinamicamente via JS — usar `style` inline
- NUNCA expor se um email/matrícula existe nas mensagens de erro
- NUNCA armazenar senhas/tokens em DOM (dataset) ou localStorage — usar closures
- Todo input de usuário deve ser sanitizado com `budSanitize()` antes de Firestore
- Firebase config via `window.BUD_FIREBASE_CONFIG` (placeholders, sem keys hardcoded)
- Firebase SDK Modular (v10.8.1) — NUNCA usar SDK Compat
- Toda tarefa finalizada deve atualizar o `ARCHITECTURE_MAP.md`
- Todo erro encontrado deve ser registrado no `ERRORS_LOG.md`
- Toda decisão não-óbvia deve ser registrada no `DECISIONS_LOG.md`
