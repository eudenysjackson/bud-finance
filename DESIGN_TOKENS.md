# Design Tokens — Bud Finance
> Gerado em 20/04/2026 · Fonte: `js/theme-manager.js` (`_setVars`)  
> Todos os tokens são CSS Custom Properties aplicados no `:root` (via `document.documentElement.style`) pelo theme-manager em tempo de execução.

---

## Índice
1. [Como funciona o sistema](#como-funciona-o-sistema)
2. [Hierarquia de contexto dos tokens](#hierarquia-de-contexto-dos-tokens)
3. [Referência completa dos tokens](#referência-completa-dos-tokens)
4. [Tabela de valores por tema](#tabela-de-valores-por-tema)
5. [Regras de uso (o que usar onde)](#regras-de-uso-o-que-usar-onde)
6. [Armadilhas conhecidas](#armadilhas-conhecidas)

---

## Como funciona o sistema

- `js/theme-manager.js` é carregado como `<script>` normal no `<head>` (não é module).
- Na inicialização, aplica o tema salvo em `localStorage('bud_theme')` antes do DOM renderizar → **sem flash de cor**.
- Cada tema é um objeto JS com propriedades nomeadas; `_setVars(t)` mapeia cada propriedade para uma CSS Custom Property no `:root`.
- Ao trocar de tema, todas as 24 CSS vars são sobreescritas simultaneamente.
- **Elementos dinâmicos criados via JS** NÃO podem usar classes Tailwind — devem usar `style` inline com as CSS vars (`style="background:var(--bg-page)"`).

---

## Hierarquia de contexto dos tokens

O sistema tem **3 superfícies visuais** distintas, cada uma com seu conjunto de tokens:

```
┌─────────────────────────────────────────────────────────────────┐
│  PÁGINA  (--bg-page, --text-main, --text-sec)                   │
│  Superfície de fundo da tela inteira.                           │
│  Nos temas coloridos: é A cor do tema (roxo, vermelho, etc.)    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CARD  (--card-bg, --card-border, --card-text,           │   │
│  │         --card-text-sec)                                 │   │
│  │  Glassmorphic branco semi-opaco sobre a página.          │   │
│  │  Nos temas coloridos: sempre claro/branco.               │   │
│  │  Nunca usar em modais.                                   │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  MODAL / INPUT  (--input-bg, --input-border,       │  │   │
│  │  │   --input-focus, --card-text, --card-text-sec)     │  │   │
│  │  │  Campos de formulário dentro de modais.            │  │   │
│  │  │  Fundo claro com texto escuro em todos os temas.   │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SIDEBAR  (--sidebar-bg, --sidebar-user-bg,              │   │
│  │   --sidebar-link-hover-bg, --sidebar-link-hover-color,   │   │
│  │   --sidebar-link-active-bg, --sidebar-link-active-color) │   │
│  │  Painel lateral. Semi-transparente sobre a página.       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BALANCE CARD  (--balance-from, --balance-to,            │   │
│  │   --balance-text, --balance-mini-bg)                     │   │
│  │  Card de saldo/resultado do mês. Gradiente escuro.       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Referência completa dos tokens

### Grupo 1 — Página (fundo + texto corrido)

| Token | Descrição | Comportamento nos temas coloridos |
|---|---|---|
| `--bg-page` | Cor de fundo da página inteira | **É a cor do tema** (roxo, vermelho, azul…) |
| `--text-main` | Texto principal sobre a página | Branco (`#ffffff`) — exceto Gelo (escuro) e Amarelo (escuro) |
| `--text-sec` | Texto secundário/labels sobre a página | Claro (`#dbeafe`, `#ede9fe`, etc.) — exceto Gelo/Amarelo |

> ⚠️ **Não usar `--text-main`/`--text-sec` em inputs ou modais** — são brancos nos temas coloridos e ficam ilegíveis sobre fundos claros.

---

### Grupo 2 — Cards (superfície branca glassmorphic)

| Token | Descrição | Comportamento nos temas coloridos |
|---|---|---|
| `--card-bg` | Fundo do card (glassmorphic) | `rgba(255,255,255,0.92)` — quase branco opaco |
| `--card-border` | Borda do card | `rgba(255,255,255,0.5)` — branco translúcido |
| `--card-text` | Texto principal dentro do card | Sempre escuro (`#1e293b`) em todos os temas |
| `--card-text-sec` | Texto secundário dentro do card | Sempre cinza escuro (`#475569` ou `#64748b`) |

> ✅ **Usar `--card-text`/`--card-text-sec` em inputs e modais** — garantem contraste em qualquer tema.

---

### Grupo 3 — Botão primário de ação

| Token | Descrição | Gelo | Dark | Coloridos |
|---|---|---|---|---|
| `--btn-bg` | Fundo do botão primário | `#2563eb` (azul) | `#ffffff` | `#ffffff` (branco) |
| `--btn-text` | Texto do botão primário | `#ffffff` | `#000000` | Cor do tema (ex: `#7C3AED`) |

---

### Grupo 4 — Inputs de formulário

| Token | Descrição | Comportamento |
|---|---|---|
| `--input-bg` | Fundo do input | Claro/branco em todos os temas (`#f8fafc`, `#fffcf0`); no Dark: `rgba(255,255,255,0.08)` |
| `--input-border` | Borda do input | Cinza claro nos coloridos; mais visível no Dark |
| `--input-focus` | Cor do anel de foco | Cor do tema (accent) |

---

### Grupo 5 — Sidebar

| Token | Descrição |
|---|---|
| `--sidebar-bg` | Fundo do painel lateral (semi-transparente) |
| `--sidebar-user-bg` | Fundo da área do usuário + overlay de inputs no modal |
| `--sidebar-link-hover-bg` | Fundo de link da sidebar no hover |
| `--sidebar-link-hover-color` | Cor do texto de link no hover |
| `--sidebar-link-active-bg` | Fundo de link ativo (página atual) |
| `--sidebar-link-active-color` | Cor do texto de link ativo |

> ⚠️ `--sidebar-user-bg` é `rgba(255,255,255,0.12)` nos temas coloridos — semi-transparente. **Não usar como fundo de inputs**, pois torna o texto ilegível.

---

### Grupo 6 — Card de Saldo/Balance

| Token | Descrição |
|---|---|
| `--balance-from` | Cor inicial do gradiente do card de saldo |
| `--balance-to` | Cor final do gradiente do card de saldo |
| `--balance-text` | Texto dentro do card de saldo (sempre branco) |
| `--balance-mini-bg` | Fundo dos mini-stats dentro do card de saldo |

---

### Grupo 7 — Acento e efeitos

| Token | Descrição |
|---|---|
| `--theme-accent` | Cor de acento do tema (a cor principal). Mesma que `--bg-page` nos coloridos |
| `--blob-opacity` | Opacidade das formas decorativas de fundo. `1` no Gelo, `0.4` no Dark, `0` nos coloridos |

---

## Tabela de valores por tema

### `--bg-page`
| Gelo | Dark | Azul | Roxo | Rosa | Amarelo | Verde | Vermelho |
|---|---|---|---|---|---|---|---|
| `#f4f7fb` | `#000000` | `#005BAA` | `#7C3AED` | `#ff4d94` | `#ffc700` | `#11c76f` | `#ed1c24` |

### `--text-main` (texto da página)
| Gelo | Dark | Azul | Roxo | Rosa | Amarelo | Verde | Vermelho |
|---|---|---|---|---|---|---|---|
| `#1e293b` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#1a1a1a` | `#ffffff` | `#ffffff` |

### `--text-sec` (texto secundário da página)
| Gelo | Dark | Azul | Roxo | Rosa | Amarelo | Verde | Vermelho |
|---|---|---|---|---|---|---|---|
| `#475569` | `#94a3b8` | `#dbeafe` | `#ede9fe` | `#fce7f3` | `#78716c` | `#dcfce7` | `#fee2e2` |

### `--card-bg` (fundo glassmorphic)
| Gelo | Dark | Azul | Roxo | Rosa | Amarelo | Verde | Vermelho |
|---|---|---|---|---|---|---|---|
| `rgba(255,255,255,0.85)` | `rgba(15,20,25,0.95)` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.93)` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.92)` |

### `--card-border`
| Gelo | Dark | Azul–Vermelho (todos coloridos) |
|---|---|---|
| `rgba(255,255,255,0.9)` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.5)` |
> Amarelo: `rgba(255,255,255,0.7)`

### `--card-text` (texto dentro do card — sempre escuro)
| Gelo | Dark | Azul | Roxo | Rosa | Amarelo | Verde | Vermelho |
|---|---|---|---|---|---|---|---|
| `#1e293b` | `#e2e8f0` | `#1e293b` | `#1e293b` | `#1e293b` | `#1a1a1a` | `#1e293b` | `#1e293b` |

### `--card-text-sec`
| Gelo | Dark | Azul | Roxo | Rosa | Amarelo | Verde | Vermelho |
|---|---|---|---|---|---|---|---|
| `#64748b` | `#94a3b8` | `#475569` | `#475569` | `#475569` | `#57534e` | `#475569` | `#475569` |

### `--btn-bg` / `--btn-text`
| Tema | `--btn-bg` | `--btn-text` |
|---|---|---|
| Gelo | `#2563eb` | `#ffffff` |
| Dark | `#ffffff` | `#000000` |
| Azul | `#ffffff` | `#005BAA` |
| Roxo | `#ffffff` | `#7C3AED` |
| Rosa | `#ffffff` | `#ff4d94` |
| Amarelo | `#1a1a1a` | `#ffc700` |
| Verde | `#ffffff` | `#11c76f` |
| Vermelho | `#ffffff` | `#ed1c24` |

### `--input-bg` / `--input-border` / `--input-focus`
| Tema | `--input-bg` | `--input-border` | `--input-focus` |
|---|---|---|---|
| Gelo | `#f8fafc` | `#f1f5f9` | `#3b82f6` |
| Dark | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.15)` | `#ffffff` |
| Azul | `#f8fafc` | `#e2e8f0` | `#005BAA` |
| Roxo | `#f8fafc` | `#e2e8f0` | `#7C3AED` |
| Rosa | `#f8fafc` | `#e2e8f0` | `#ff4d94` |
| Amarelo | `#fffcf0` | `#e2e8f0` | `#1a1a1a` |
| Verde | `#f8fafc` | `#e2e8f0` | `#11c76f` |
| Vermelho | `#f8fafc` | `#e2e8f0` | `#ed1c24` |

### `--sidebar-bg` / `--sidebar-user-bg`
| Tema | `--sidebar-bg` | `--sidebar-user-bg` |
|---|---|---|
| Gelo | `rgba(255,255,255,0.85)` | `#f8fafc` |
| Dark | `rgba(15,20,25,0.95)` | `rgba(255,255,255,0.06)` |
| Azul | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.12)` |
| Roxo | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.12)` |
| Rosa | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.12)` |
| Amarelo | `rgba(255,255,255,0.22)` | `rgba(255,255,255,0.15)` |
| Verde | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.12)` |
| Vermelho | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.12)` |

### `--sidebar-link-hover-bg` / `--sidebar-link-hover-color`
| Tema | hover-bg | hover-color |
|---|---|---|
| Gelo | `rgba(59,130,246,0.08)` | `#2563eb` |
| Dark | `rgba(255,255,255,0.08)` | `#ffffff` |
| Azul–Vermelho (exceto Amarelo) | `rgba(255,255,255,0.15)` | `#ffffff` |
| Amarelo | `rgba(0,0,0,0.08)` | `#1a1a1a` |

### `--sidebar-link-active-bg` / `--sidebar-link-active-color`
| Tema | active-bg | active-color |
|---|---|---|
| Gelo | `rgba(59,130,246,0.12)` | `#2563eb` |
| Dark | `rgba(255,255,255,0.12)` | `#e2e8f0` |
| Azul–Vermelho (exceto Amarelo) | `rgba(255,255,255,0.22)` | `#ffffff` |
| Amarelo | `rgba(0,0,0,0.12)` | `#1a1a1a` |

### `--balance-from` / `--balance-to` / `--balance-text` / `--balance-mini-bg`
| Tema | from | to | text | mini-bg |
|---|---|---|---|---|
| Gelo | `#4f75ff` | `#375ee3` | `#ffffff` | `rgba(255,255,255,0.15)` |
| Dark | `#1e293b` | `#0f172a` | `#ffffff` | `rgba(255,255,255,0.08)` |
| Azul | `#004a91` | `#003b75` | `#ffffff` | `rgba(255,255,255,0.18)` |
| Roxo | `#6929d4` | `#5521b5` | `#ffffff` | `rgba(255,255,255,0.18)` |
| Rosa | `#d4407d` | `#b83568` | `#ffffff` | `rgba(255,255,255,0.18)` |
| Amarelo | `#1a1a1a` | `#2d3748` | `#ffffff` | `rgba(255,255,255,0.12)` |
| Verde | `#0ea55c` | `#0b8a4c` | `#ffffff` | `rgba(255,255,255,0.18)` |
| Vermelho | `#c8171e` | `#a71219` | `#ffffff` | `rgba(255,255,255,0.18)` |

### `--theme-accent` / `--blob-opacity`
| Tema | accent | blob-opacity |
|---|---|---|
| Gelo | `#2563eb` | `1` |
| Dark | `#e2e8f0` | `0.4` |
| Azul | `#005BAA` | `0` |
| Roxo | `#7C3AED` | `0` |
| Rosa | `#ff4d94` | `0` |
| Amarelo | `#ffc700` | `0` |
| Verde | `#11c76f` | `0` |
| Vermelho | `#ed1c24` | `0` |

---

## Regras de uso (o que usar onde)

| Onde usar | Token correto para fundo | Token correto para texto |
|---|---|---|
| Fundo da página | `--bg-page` | `--text-main` |
| Labels/subtextos na página | — | `--text-sec` |
| Card branco glassmorphic | `--card-bg` | `--card-text` |
| Texto secundário dentro de card | — | `--card-text-sec` |
| Borda de card | `--card-border` | — |
| **Modal** (popup) | `--bg-page` | `--text-main` |
| **Input/campo de form** | `--input-bg` | `--card-text` |
| Placeholder de input | — | `--card-text-sec` (opacity 0.7) |
| Borda de input | `--input-border` | — |
| Input em foco (anel) | `--input-focus` | — |
| Dropdown de select/datepicker | `--bg-page` | `--text-main` |
| Opção de dropdown (hover) | `--sidebar-link-hover-bg` | `--text-main` |
| Botão primário de ação | `--btn-bg` | `--btn-text` |
| Sidebar | `--sidebar-bg` | `--text-main` |
| Área do usuário na sidebar | `--sidebar-user-bg` | `--text-main` |
| Link da sidebar (hover) | `--sidebar-link-hover-bg` | `--sidebar-link-hover-color` |
| Link da sidebar (ativo) | `--sidebar-link-active-bg` | `--sidebar-link-active-color` |
| Card de saldo | `linear-gradient(--balance-from, --balance-to)` | `--balance-text` |
| Mini-stats dentro do card de saldo | `--balance-mini-bg` | `--balance-text` |
| Botão hamburger (☰) | `--card-bg` | `--card-text` |
| Botão icon (👁️, 🔄) | `--card-bg` | `--card-text` |

---

## Armadilhas conhecidas

### ❌ `--text-main` em inputs
`--text-main` é **branco** em todos os temas coloridos. Usar em campos sobre fundo claro (`--input-bg`) resulta em texto invisível.  
**✅ Use `--card-text` para texto dentro de inputs.**

### ❌ `--card-bg` em modais
`--card-bg` é `rgba(255,255,255,0.92)` — branco semi-opaco. Modais com esse fundo ficam brancos em cima de fundo colorido (correto para cards, errado para modais que devem refletir o tema).  
**✅ Use `--bg-page` como fundo de modais.**

### ❌ `--sidebar-user-bg` em inputs
`--sidebar-user-bg` é `rgba(255,255,255,0.12)` — quase transparente. Texto sobre esse fundo praticamente desaparece.  
**✅ Use `--input-bg` como fundo de inputs.**

### ❌ Classes Tailwind em elementos JS dinâmicos
O Tailwind é pré-compilado (sem JIT). Classes geradas dinamicamente não existem no CSS.  
**✅ Sempre `style` inline com CSS vars para elementos criados via JS.**

### ⚠️ Amarelo e Dark são exceções
- **Amarelo**: `--text-main` é `#1a1a1a` (escuro), não branco. `--sidebar-link-hover-bg` é `rgba(0,0,0,0.08)` (não branco).
- **Dark**: `--card-bg` é `rgba(15,20,25,0.95)` (escuro), não branco. `--card-text` é `#e2e8f0` (claro).
