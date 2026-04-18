# 🏷️ Tela: Categorias

## 📋 Visão Geral

A tela **Categorias** (`categorias.html`) é a **central de gerenciamento de categorias** do Bud Finanças. Ela define quais categorias de despesa e receita aparecem nos dropdowns de **todas as outras telas** do app — extrato, transações, limites, recorrentes, importação e mercado. Possui dois propósitos distintos:

1. **Categorias Padrão** — 48 categorias de despesa e 15 de receita pré-definidas no código (hardcoded). São somente leitura — o usuário não pode editar, ocultar nem remover. Exibidas com badge "padrão" e `opacity-80 cursor-not-allowed`.
2. **Categorias Personalizadas** — Categorias criadas pelo próprio usuário, salvas no Firestore. **Funcionalidade exclusiva de planos pagos** (bloqueada no plano Free via `canUseFeatureSafely`). Possuem badge "personalizada" verde e botão de excluir (apenas no hover).

A tela é dividida em **duas abas** — **Despesas** (📉) e **Receitas** (📈) — que filtram tanto as padrão quanto as personalizadas pelo tipo correspondente.

| Item | Detalhe |
|---|---|
| **Arquivo HTML** | `categorias.html` (185 linhas) |
| **Arquivo JS** | `js/categorias.js` (223 linhas) |
| **Coleção Firestore** | `usuarios/{uid}/categorias` |
| **Dependências** | Firebase Auth/Firestore, `bud-utils.js` (escapeHTML), `bud-loader.js`, `sidebar.js`, `dark-mode.js`, `tutorial*.js` (3 arquivos), `plano-config.js`, `plan-utils.js` (BudPlanUtils) |
| **Tipo de módulo** | ES Module (`type="module"`) |
| **Modais** | 1 — Modal de criação de categoria (`modalCategoria`) |
| **Tamanho total** | 408 linhas (185 HTML + 223 JS) |

### Relação com outras telas

Esta tela é **a fonte visual de categorias**, mas **não é a fonte de dados** para as outras telas. Cada tela carrega sua própria cópia hardcoded de `categoriasPadrao` (BUG 3). As categorias personalizadas, por outro lado, são lidas do Firestore por cada tela individualmente. Isso significa que:
- Uma categoria personalizada criada aqui **aparece automaticamente** em telas que consultam `usuarios/{uid}/categorias`
- As categorias padrão mostradas aqui podem **divergir** das mostradas em extrato, limites ou mercado se os arrays forem diferentes

---

## 🗄️ Estrutura de Dados (Firestore)

### Documento: `usuarios/{uid}/categorias/{id}`

```js
{
  nome: "Academia",            // string — nome da categoria (livre, sem validação de duplicatas)
  emoji: "🏋️",                // string — emoji ícone visual
  tipo: "despesa",             // string — "despesa" ou "receita"
  dataCriacao: Timestamp       // serverTimestamp() — data/hora do servidor
}
```

**Observações sobre o modelo:**
- Não há campo `ativa` ou `visivel` — uma vez criada, sempre aparece
- Não há campo `cor` — a cor é sempre a mesma (verde emerald via CSS)
- Não há vinculação inversa — nenhum campo indica em quais transações é usada
- `nome` é texto livre — aceita espaços, caracteres especiais, emojis no nome
- Não há índice composto — a query usa `where("tipo", "==", tipoAtual)` simples

### Categorias Padrão (hardcoded no JS — linhas 22-49)

As categorias padrão **não existem no Firestore** — são um objeto JavaScript fixo no código:

#### Despesas (48 categorias):

| # | Emoji | Nome | # | Emoji | Nome |
|---|---|---|---|---|---|
| 1 | 🏠 | Aluguel | 25 | 🏫 | Faculdade/Escola |
| 2 | 🏢 | Condomínio | 26 | 📚 | Cursos |
| 3 | 💧 | Água | 27 | ✏️ | Material Escolar |
| 4 | ⚡ | Luz | 28 | 🎬 | Cinema/Teatro |
| 5 | 🔥 | Gás | 29 | 🎟️ | Shows/Eventos |
| 6 | 🌐 | Internet/TV | 30 | ✈️ | Viagens |
| 7 | 🛠️ | Manutenção da Casa | 31 | 🍻 | Bares/Baladas |
| 8 | 🛒 | Mercado | 32 | 🎨 | Hobbies |
| 9 | 🛵 | Delivery/Ifood | 33 | 🎮 | Jogos/Games |
| 10 | 🍽️ | Restaurante | 34 | 👕 | Roupas/Sapatos |
| 11 | ☕ | Padaria/Café | 35 | ⌚ | Acessórios |
| 12 | ⛽ | Combustível | 36 | 🏋️ | Academia/Esportes |
| 13 | 🚕 | Uber/Táxi | 37 | ✂️ | Salão/Barbearia |
| 14 | 🚌 | Ônibus/Metrô | 38 | 🧴 | Cosméticos |
| 15 | 🅿️ | Estacionamento | 39 | 🎁 | Presentes |
| 16 | 🔧 | Manutenção Veículo | 40 | 💻 | Eletrônicos |
| 17 | 📄 | IPVA/Seguro | 41 | 🛏️ | Casa/Móveis |
| 18 | 🛣️ | Pedágio | 42 | 🐶 | Pet |
| 19 | 🏥 | Plano de Saúde | 43 | 📺 | Assinaturas/Streaming |
| 20 | 💊 | Farmácia | 44 | 🧹 | Diarista/Limpeza |
| 21 | 🩺 | Consultas/Exames | 45 | 🏛️ | Impostos/IRPF |
| 22 | 🛋️ | Terapia/Psicólogo | 46 | 💸 | Taxas Bancárias |
| 23 | 🦷 | Dentista | 47 | 📉 | Empréstimos/Dívidas |
| 24 | — | — | 48 | 🛡️ | Seguro de Vida |
| — | — | — | 49 | 🤝 | Doações/Dízimo |
| — | — | — | 50 | 📦 | Outros |

#### Receitas (15 categorias):

| # | Emoji | Nome |
|---|---|---|
| 1 | 💰 | Salário |
| 2 | 🏖️ | Férias |
| 3 | 🎄 | 13º Salário |
| 4 | 🎁 | Bônus/PLR |
| 5 | 💳 | Vale Refeição/Alimentação |
| 6 | 💻 | Freelance/Projetos |
| 7 | 📈 | Rendimentos/Dividendos |
| 8 | 🛍️ | Venda de Produtos |
| 9 | 🚘 | Venda de Imóvel/Carro |
| 10 | 🔄 | Cashback |
| 11 | 🏛️ | Restituição IR |
| 12 | 👶 | Pensões |
| 13 | 🏠 | Aluguéis Recebidos |
| 14 | 🧧 | Doações Recebidas |
| 15 | 📦 | Outras Receitas |

### Emojis do Picker (4 temas, 55 emojis no total)

O emoji picker do modal de criação possui 4 temas com grids de emojis clicáveis:

| Tema | Qtd | Emojis |
|---|---|---|
| 💰 Dinheiro | 12 | 💰 💵 💳 💎 📈 📉 💸 🏦 💹 🪙 🧾 🛡️ |
| 💼 Trabalho | 12 | 💼 💻 🖥️ 📞 📠 ✍️ 🛠️ ⚙️ 🏗️ 🚀 📄 🏢 |
| 🏠 Casa | 16 | 🏠 🛋️ 🚿 🧹 🧺 🪑 🪴 💡 🔑 🚘 🐶 💧 ⚡ 🔥 🛏️ 🔧 |
| 🍿 Lazer | 15 | 🍿 🎮 🎬 🎪 ⚽ 🏖️ ✈️ 🍔 🍺 🛹 🏋️ 🎁 🎟️ 🍻 🎨 |

---

## 🏗️ Estrutura do HTML

### Layout Geral

```
<body> (flex, overflow-hidden, 100dvh)
├── #toast-container (fixed, top, z-100, pointer-events-none)
├── #mobileOverlay (bg-slate-900/40, backdrop-blur, z-40, hidden)
├── #sidebar-container (carregado via sidebar.js)
└── <main> (flex-1, flex-col, overflow-y-auto)
    ├── <header> (h-20, sticky, z-30, border-b)
    │   ├── Botão hamburger (md:hidden) → toggleSidebar()
    │   ├── Botão refresh (md:hidden) → sincronizarDados()
    │   └── Título "🏷️ Categorias" + subtítulo desktop
    └── <div> (p-4 md:p-8, max-w-6xl, space-y-8, pb-20)
        ├── Tabs Despesas/Receitas (bg-slate-200/50, rounded-[1.5rem])
        │   ├── #tabDespesa → switchTab('despesa')
        │   └── #tabReceita → switchTab('receita')
        ├── Seção "Categorias Personalizadas"
        │   ├── Título + subtítulo
        │   ├── Botão "+ Nova" → abrirModalNovaCategoria()
        │   ├── #listaPersonalizadas (grid 1/2/3 cols) ← populado via JS
        │   └── #emptyState (hidden, border-dashed, ícone cinza)
        └── Seção "Categorias Padrão"
            ├── Título + subtítulo
            └── #listaPadrao (grid 1/2/3 cols) ← populado via JS
```

### Modal de Criação (`#modalCategoria`)

```
#modalCategoria (fixed, inset-0, bg-slate-900/60, backdrop-blur, z-60)
└── <div> (bg-white, max-w-[420px], rounded-[2.5rem], shadow-2xl)
    ├── Header: título "#tituloModal" + botão fechar (✕)
    ├── Body:
    │   ├── Seção "Escolha um Ícone":
    │   │   ├── Botão trigger (#emojiSelecionado 📦) → toggleEmojiPicker()
    │   │   └── #emojiPicker (hidden, absolute, z-50, animate-scale-up)
    │   │       ├── #temasEmoji: 4 botões (Dinheiro, Trabalho, Casa, Lazer)
    │   │       └── #gridEmojis: grid 6 cols, max-h-40, scroll
    │   ├── Seção "Nome da Categoria":
    │   │   └── <input #catNome> (placeholder "Ex: Academia, Apostas...")
    │   └── Seção "Prévia" (bg-slate-50):
    │       └── Card preview: #previewEmoji + #previewNome + badge "personalizada"
    └── Footer:
        ├── Botão "Cancelar" → fecharModal()
        └── Botão #btnSalvarCat "Criar Categoria" (flex-2, emerald-500)
```

### CSS Customizado (na tag `<style>`)

| Classe/Seletor | Propósito |
|---|---|
| `.no-scrollbar` | Remove scrollbar visual (mantém scroll funcional) |
| `.icon-3d` | `drop-shadow` + hover `scale(1.2) rotate(5deg)` nos emojis |
| `.tab-active` | Background branco, cor verde escuro, box-shadow — tab selecionada |
| `.category-card` | Transition all 0.2s, border slate-100 → hover emerald, bg-green-50, translateY(-2px) |
| `@keyframes fadeIn` | Opacity 0→1 em 0.2s — usado em toasts |
| `@keyframes scaleUp` | Scale 0.95→1 + opacity — usado no modal/emoji picker |
| `.custom-scrollbar` | Scrollbar fina 4px, thumb cinza — para grid de emojis |
| `.glass-panel` | Background rgba branco 85%, backdrop-blur 12px — para sidebar |

### Scripts carregados (ordem):

1. `firebase-config.js` — Config global do Firebase
2. `bud-loader.js` — Splash screen / loading
3. `bud-utils.js` — Utilitários (escapeHTML, budShowToast, etc.)
4. `plan-utils.js` — BudPlanUtils (canUseFeatureSafely, resolvePlanSafely)
5. `plano-config.js` — Configurações de plano
6. `sidebar.js` — Sidebar navegação
7. `js/categorias.js` — **Lógica principal** (type="module")
8. `dark-mode.js` — Toggle tema escuro
9. `tutorial.js` + `tutorial-steps.js` + `tutorial-init.js` — Sistema tutorial

---

## 🔄 Fluxo Completo da Tela

```
Usuário abre categorias.html
  │
  ├─ bud-loader.js → mostra splash screen
  ├─ sidebar.js → injeta sidebar no #sidebar-container
  ├─ plan-utils.js → define window.BudPlanUtils { canUseFeatureSafely, resolvePlanSafely, planAllowedByFallback }
  │
  └─ js/categorias.js carrega (module):
      ├─ Inicializa Firebase App, Auth, Firestore
      ├─ Variáveis globais:
      │   ├─ usuarioId = null
      │   ├─ perfilPlanoAtual = { plano: 'free' }     ← valor inicial ANTES de carregar plano real
      │   ├─ tipoAtual = 'despesa'                     ← aba ativa
      │   └─ emojiAtual = '📦'                         ← emoji selecionado no picker
      ├─ Desestrutura BudPlanUtils: { planAllowedByFallback, resolvePlanSafely, canUseFeatureSafely }
      ├─ Pega escapeHTML de window.escapeHTML (via bud-utils.js)
      ├─ Define categoriasPadrao { despesa: [...48], receita: [...15] }
      ├─ Define emojisPorTema { dinheiro: 12, trabalho: 12, casa: 16, lazer: 15 }
      │
      └─ onAuthStateChanged(auth, callback):
          │
          ├─ user EXISTE:
          │   ├─ usuarioId = user.uid
          │   ├─ getDoc(usuarios/{uid}).then(async perfilSnap => {
          │   │   ├─ userData = perfilSnap.data() || {}
          │   │   ├─ resolvedPlan = resolvePlanSafely(userData)
          │   │   │   ├─ Verifica trial expirado, assinatura vencida, etc.
          │   │   │   └─ Retorna { effectivePlan, shouldDowngrade, downgradeReason }
          │   │   ├─ SE shouldDowngrade:
          │   │   │   └─ updateDoc(usuarios/{uid}, {
          │   │   │       plano: 'free',
          │   │   │       downgradeMotivo: reason,
          │   │   │       downgradeEm: new Date().toISOString(),  ← BUG 9: deveria ser serverTimestamp()
          │   │   │       assinaturaStatus: ...
          │   │   │   })
          │   │   └─ perfilPlanoAtual = { ...userData, plano: resolvedPlan.effectivePlan }
          │   │ }).catch(() => { perfilPlanoAtual = { plano: 'free' } })
          │   │
          │   └─ renderizarTudo()   ← ⚠️ BUG 8: CHAMADA FORA do .then(), antes do plano resolver
          │
          └─ user NÃO EXISTE:
              └─ redirect → index.html
```

### Fluxo: Trocar Aba (switchTab)

```
Clique em "📉 Despesas" ou "📈 Receitas"
  └─ switchTab(tipo):
      ├─ tipoAtual = tipo
      ├─ Atualiza CSS das 2 tabs (tab-active ou texto cinza)
      └─ renderizarTudo()   ← re-renderiza TUDO para ambas as seções
```

### Fluxo: Renderizar Categorias (renderizarTudo)

```
renderizarTudo():
  │
  ├─ Categorias Padrão:
  │   ├─ categoriasPadrao[tipoAtual].map(c => card HTML)
  │   │   └─ Card: emoji (escapeHTML) + nome (escapeHTML) + badge "padrão"
  │   │       ├─ opacity-80 cursor-not-allowed (não clicável)
  │   │       └─ Hover: borda emerald + bg green-50 + translateY(-2px)
  │   └─ innerHTML → #listaPadrao
  │
  └─ Categorias Personalizadas (se usuarioId):
      └─ carregarPersonalizadas():
          ├─ Se _unsubCat existe → _unsubCat() (cancela listener anterior)
          ├─ query = collection(categorias) WHERE tipo == tipoAtual
          └─ _unsubCat = onSnapshot(query, callback):
              │
              ├─ window.hideSplash() ← esconde splash screen
              │
              ├─ snap.empty:
              │   ├─ #listaPersonalizadas.innerHTML = ''
              │   └─ #emptyState.classList.remove('hidden')
              │       └─ Mostra: 🏷️ "Nenhuma categoria personalizada encontrada"
              │
              └─ snap.docs:
                  ├─ #emptyState.classList.add('hidden')
                  └─ snap.docs.map(doc => card HTML):
                      └─ Card: emoji + nome + badge "personalizada" verde + botão ✕
                          ├─ Botão ✕: hidden group-hover:block  ← BUG 6: invisível no mobile
                          └─ onclick="deletarCategoria('${doc.id}')"
```

### Fluxo: Criar Nova Categoria

```
Clique em "+ Nova"
  └─ abrirModalNovaCategoria():
      ├─ Define título "Nova Categoria de Despesa/Receita"
      ├─ Remove 'hidden' do #modalCategoria
      ├─ setTemaEmoji('dinheiro') → popula grid com 12 emojis
      ├─ atualizarPreview() → mostra emoji + nome na prévia
      └─ ⚠️ BUG 12: NÃO reseta emojiAtual nem catNome

Usuário interage com modal:
  ├─ toggleEmojiPicker() → toggle 'hidden' no #emojiPicker
  ├─ setTemaEmoji(tema):
  │   ├─ Limpa #gridEmojis
  │   ├─ emojisPorTema[tema].forEach → cria <button> por emoji
  │   │   └─ btn.onclick: emojiAtual = e, atualiza #emojiSelecionado, preview, fecha picker
  │   └─ Atualiza CSS dos botões de tema (ativo = emerald, inativo = slate)
  ├─ Input #catNome → listener 'input' → atualizarPreview()
  │   └─ #previewEmoji + #previewNome atualizam em tempo real
  │
  └─ Clique "Criar Categoria" (#btnSalvarCat):
      ├─ nome = catNome.value.trim()
      ├─ SE !nome → showToast("Dê um nome!", "error") → return
      ├─ canUseFeatureSafely(perfilPlanoAtual, 'customCategories')
      │   ├─ !allowed → showToast("No plano Free...", "error") → return
      │   └─ allowed → continua
      ├─ btn.innerHTML = "Salvando... ⏳", btn.disabled = true
      ├─ TRY:
      │   ├─ addDoc(categorias, { nome, emoji: emojiAtual, tipo: tipoAtual, dataCriacao: serverTimestamp() })
      │   │   └─ ⚠️ BUG 2: SEM verificação de duplicatas antes do addDoc
      │   ├─ fecharModal()
      │   ├─ catNome.value = ''
      │   └─ showToast("Categoria criada com sucesso!")
      ├─ CATCH: showToast("Erro ao criar.", "error")
      └─ FINALLY (implícito): btn.innerHTML = "Criar Categoria", btn.disabled = false
```

### Fluxo: Excluir Categoria

```
Clique no ✕ do card (hover desktop only)
  └─ deletarCategoria(id):
      ├─ Cria overlay de confirmação (Promise):
      │   ├─ ov = createElement('div')
      │   ├─ ov.className = 'fixed inset-0 bg-black/40 ...'  ← ⚠️ BUG 1: classes Tailwind dinâmicas
      │   ├─ ov.innerHTML = card branco com:
      │   │   ├─ "Apagar categoria" (título)
      │   │   ├─ "Deseja apagar esta categoria?" (texto)
      │   │   ├─ Botão "Cancelar" → resolve(false)
      │   │   └─ Botão "Apagar" (bg-red-500) → resolve(true)
      │   ├─ Clique no overlay (fora do card) → resolve(false)
      │   └─ appendChild(body)
      │
      ├─ SE ok = true:
      │   ├─ deleteDoc(usuarios/{uid}/categorias/{id})  ← ⚠️ BUG 4: sem try/catch
      │   │                                              ← ⚠️ BUG 5: sem verificar se está em uso
      │   └─ showToast("Categoria removida.")
      └─ SE ok = false: nada acontece (overlay já removido)
```

---

## ⚙️ Funções Principais — Detalhamento

| Função | Linha | Escopo | Assinatura | Descrição Detalhada |
|---|---|---|---|---|
| `switchTab` | ~73 | `window` | `(tipo: 'despesa'\|'receita')` | Atualiza `tipoAtual`, troca CSS das 2 tabs (ativa = branco+sombra, inativa = texto cinza), chama `renderizarTudo()`. Recria todo o DOM a cada troca. |
| `abrirModalNovaCategoria` | ~79 | `window` | `()` | Define título dinâmico por tipo, mostra modal, seta tema "dinheiro" no picker, atualiza preview. **Não reseta** emojiAtual nem valor do input. |
| `fecharModal` | ~84 | `window` | `()` | `modalCategoria.classList.add('hidden')` — uma linha. Não limpa estado. |
| `toggleEmojiPicker` | ~85 | `window` | `()` | `emojiPicker.classList.toggle('hidden')` — uma linha. Sem handler de click-outside. |
| `setTemaEmoji` | ~87 | `window` | `(tema: string)` | Limpa `#gridEmojis`, itera `emojisPorTema[tema]`, cria `<button>` por emoji com handler que seta `emojiAtual`, atualiza visual, fecha picker. Atualiza CSS dos 4 botões de tema. |
| `atualizarPreview` | ~100 | local | `()` | Lê `emojiAtual` e `catNome.value`, atualiza `#previewEmoji` e `#previewNome`. Texto padrão "Nome da categoria" se input vazio. Vinculada ao evento `input` do `#catNome`. |
| `renderizarTudo` | ~106 | local | `()` | Gera HTML das categorias padrão via `.map()` com `escapeHTML`, injeta no `#listaPadrao`. Se `usuarioId` existe, chama `carregarPersonalizadas()`. |
| `carregarPersonalizadas` | ~117 | local `async` | `()` | Cancela listener anterior (`_unsubCat()`), cria query com filtro `tipo == tipoAtual`, abre `onSnapshot`. No callback: esconde splash, trata snap vazio (empty state) ou renderiza cards com botão deletar. |
| `deletarCategoria` | ~145 | `window` `async` | `(id: string)` | Cria overlay de confirmação via `createElement` + Promise. Se confirmado, deleta doc do Firestore. Toast de sucesso. Sem try/catch, sem verificação de uso. |
| `btnSalvarCat.click` | ~162 | listener | — | Valida nome não vazio, verifica permissão de plano, desabilita botão com estado "Salvando...", addDoc no Firestore, fecha modal, limpa input, toast. Try/catch cobre o addDoc. |
| `showToast` | ~187 | `window` | `(msg, tipo='success')` | Cria `<div>` com classes de toast, injeta no `#toast-container`, remove após 3s com `setTimeout`. Implementação **local** — diferente do `budShowToast` global do `bud-utils.js`. |
| `onAuthStateChanged` | ~196 | — | callback | Configura `usuarioId`, carrega perfil via `getDoc`, resolve plano com `resolvePlanSafely`, faz downgrade automático se necessário, seta `perfilPlanoAtual`. Chama `renderizarTudo()` **fora** do `.then()` (race condition). |

### Variáveis de Estado

| Variável | Tipo | Valor Inicial | Uso |
|---|---|---|---|
| `usuarioId` | `string\|null` | `null` | UID do Firebase Auth — setado no `onAuthStateChanged` |
| `perfilPlanoAtual` | `object` | `{ plano: 'free' }` | Dados do perfil + plano efetivo — usado pelo `canUseFeatureSafely` |
| `tipoAtual` | `string` | `'despesa'` | Aba ativa — filtra padrão e personalizadas |
| `emojiAtual` | `string` | `'📦'` | Emoji selecionado no picker — usado na criação |
| `_unsubCat` | `function\|null` | `null` | Unsubscribe do `onSnapshot` anterior — cleanup para evitar listeners duplicados |

### Imports do Firestore

```js
import { 
    getFirestore, collection, addDoc, onSnapshot, deleteDoc, 
    doc, query, where, getDoc, updateDoc, serverTimestamp 
} from "firebase-firestore";
```

**Ausentes (necessários para correções):** `getDocs`, `limit`, `writeBatch`

---

## 🐛 Auditoria de Bugs, Incoerências e Melhorias

### 🔴 BUG 1 — Overlay de exclusão usa classes Tailwind dinâmicas (INVISÍVEL)

**Arquivo:** `js/categorias.js` · Linha ~147  
**Severidade:** 🔴 Crítico  
**Recorrência:** Mesmo bug encontrado em `mercado.js` (4x), `investimentos.js`, `metas.js`, `limites.js`, `dividas.js`

```js
const ov = document.createElement('div');
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
ov.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">...'
```

**Problema:** `bg-black/40` (cor com opacidade arbitrária) e `z-[9999]` (valor arbitrário) são classes Tailwind JIT que **não existem no build estático** (`tailwind.css`). O build escaneia apenas os arquivos HTML em busca de classes — classes geradas dinamicamente em `createElement` dentro de JS não são detectadas.

**O que acontece:** O overlay é criado no DOM mas:
- Sem `bg-black/40` → fundo transparente (sem escurecimento)
- Sem `z-[9999]` → z-index padrão (0) → overlay atrás de outros elementos
- O card branco dentro do overlay (`bg-white rounded-2xl`) funciona parcialmente porque `bg-white` e `rounded-2xl` existem no build estático (usados em outros lugares)
- Resultado: diálogo de confirmação flutua sem backdrop escuro, ou fica escondido atrás da página

**Impacto:** Usuário clica em "✕ Apagar" e a confirmação não aparece visualmente. O dialog pode estar no DOM mas invisível. Se o usuário clicar "às cegas", pode excluir sem querer.

🔧 **SOLUÇÃO:**
```js
const ov = document.createElement('div');
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

**Classes internas do card:** `bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center` — estas **funcionam** porque existem no build (usadas no HTML). Só o overlay externo precisa de `style.cssText`.

---

### 🔴 BUG 2 — Não verifica duplicação de nome — permite criar categorias repetidas

**Arquivo:** `js/categorias.js` · Linhas ~162-180  
**Severidade:** 🔴 Crítico  

```js
document.getElementById('btnSalvarCat').addEventListener('click', async () => {
    const nome = document.getElementById('catNome').value.trim();
    if(!nome) return showToast("Dê um nome para a categoria!", "error");

    const podeCriarCategoria = canUseFeatureSafely(perfilPlanoAtual, 'customCategories');
    if (!podeCriarCategoria) {
        return showToast("No plano Free você pode usar apenas categorias padrão.", "error");
    }
    // ... direto ao addDoc, NENHUMA verificação de nome duplicado
    await addDoc(collection(db, "usuarios", usuarioId, "categorias"), {
        nome: nome,
        emoji: emojiAtual,
        tipo: tipoAtual,
        dataCriacao: serverTimestamp()
    });
});
```

**Problema:** O código valida apenas: (1) nome não vazio e (2) plano permite. Não verifica se:
- O nome já existe nas **categorias padrão** (48 despesas + 15 receitas)
- O nome já existe nas **personalizadas** do mesmo tipo

**Cenários de erro concretos:**
1. Criar "Mercado" personalizada → dropdown de extrato mostra 2x "Mercado" (padrão + personalizada)
2. Criar "Academia" 3 vezes → 3 cards iguais na lista, confusão total
3. Criar "salário" (minúsculo) quando existe "Salário" (maiúsculo) → duplicata semântica

**Impacto:** Dropdowns poluídos em extrato, limites, recorrentes. Relatórios com dados fragmentados entre a padrão e a personalizada de mesmo nome.

🔧 **SOLUÇÃO:**
```js
document.getElementById('btnSalvarCat').addEventListener('click', async () => {
    const nome = document.getElementById('catNome').value.trim();
    if (!nome) return showToast("Dê um nome para a categoria!", "error");
    
    const podeCriarCategoria = canUseFeatureSafely(perfilPlanoAtual, 'customCategories');
    if (!podeCriarCategoria) {
        return showToast("No plano Free você pode usar apenas categorias padrão.", "error");
    }

    // 1. Verificar duplicação com categorias padrão
    const nomeNorm = nome.toLowerCase().trim();
    const duplicadaPadrao = categoriasPadrao[tipoAtual].some(c => c.nome.toLowerCase().trim() === nomeNorm);
    if (duplicadaPadrao) return showToast("Já existe uma categoria padrão com esse nome.", "error");
    
    // 2. Verificar duplicação com personalizadas existentes
    const snapCheck = await getDocs(query(
        collection(db, "usuarios", usuarioId, "categorias"),
        where("tipo", "==", tipoAtual)
    ));
    const duplicadaCustom = snapCheck.docs.some(d => d.data().nome.toLowerCase().trim() === nomeNorm);
    if (duplicadaCustom) return showToast("Você já criou uma categoria com esse nome.", "error");
    
    // 3. Prosseguir com criação
    const btn = document.getElementById('btnSalvarCat');
    btn.innerHTML = "Salvando... ⏳";
    btn.disabled = true;
    try {
        await addDoc(collection(db, "usuarios", usuarioId, "categorias"), {
            nome, emoji: emojiAtual, tipo: tipoAtual, dataCriacao: serverTimestamp()
        });
        fecharModal();
        document.getElementById('catNome').value = '';
        showToast("Categoria criada com sucesso!");
    } catch (e) {
        showToast("Erro ao criar.", "error");
    }
    btn.innerHTML = "Criar Categoria";
    btn.disabled = false;
});
```
**Obs:** Requer adicionar `getDocs` ao import: `import { ..., getDocs } from "...firestore.js";`

---

### 🔴 BUG 3 — `categoriasPadrao` duplicada em múltiplos arquivos — sem fonte única de verdade

**Arquivo:** `js/categorias.js` · Linhas ~22-49 (48 despesa + 15 receita aqui)  
**Severidade:** 🔴 Crítico (arquitetural)  

A lista de categorias padrão está hardcoded como `const categoriasPadrao = { despesa: [...], receita: [...] }` dentro deste arquivo. **A mesma lista (ou variações divergentes) existe em pelo menos 4 outros arquivos:**

| Arquivo | Nome da variável | Obs |
|---|---|---|
| `js/categorias.js` | `categoriasPadrao` | 48 despesa + 15 receita (com emoji) |
| `js/extrato.js` | `categsPadrao` / `categoriasPadraoLista` | Pode ter quantidade diferente |
| `js/limites.js` | `categoriasPadraoLista` | Pode ter nomes levemente diferentes |
| `js/importar.js` | inline na lógica de mapeamento | Subconjunto |
| `js/mercado.js` | categorias para itens de compra | Subconjunto parcial |

**Problema:** Se uma categoria for adicionada aqui (ex: "Pix/Transferências"), os outros arquivos não atualizam. O dropdown de limites pode mostrar 45 categorias enquanto o de extrato mostra 50 e o de categorias mostra 48.

**Exemplo concreto de divergência potencial:**
- Esse arquivo tem `nome: 'Manutenção Veículo'` com emoji `🔧`
- Outro arquivo pode ter `nome: 'Manutenção do Carro'` com emoji `🚗`
- Gera categorias "diferentes" que são a mesma coisa

🔧 **SOLUÇÃO:** Criar arquivo centralizado:
```js
// categorias-padrao.js (novo arquivo, carregado antes dos módulos)
window.BUD_CATEGORIAS_PADRAO = {
    despesa: [
        { nome: 'Aluguel', emoji: '🏠' },
        { nome: 'Condomínio', emoji: '🏢' },
        // ... todas as 48
    ],
    receita: [
        { nome: 'Salário', emoji: '💰' },
        // ... todas as 15
    ]
};
```

Em cada arquivo JS que precisa:
```js
const categoriasPadrao = window.BUD_CATEGORIAS_PADRAO;
```

No HTML de cada tela:
```html
<script src="categorias-padrao.js"></script>
```

---

### 🟡 BUG 4 — `deleteDoc` sem try/catch — erro silencioso se Firestore falhar

**Arquivo:** `js/categorias.js` · Linhas ~158-160  
**Severidade:** 🟡 Médio  

```js
if(ok) {
    await deleteDoc(doc(db, "usuarios", usuarioId, "categorias", id));
    showToast("Categoria removida.");
}
```

**Problema:** Se o Firestore falhar (sem internet, regra de segurança negando, documento não encontrado), o `deleteDoc` lança exceção não tratada. O código é `await` sem `try/catch`:
- O toast "Categoria removida" nunca aparece (bom)
- Porém **nenhum feedback de erro** aparece ao usuário (ruim)
- A exceção vai para o console como `Unhandled Promise Rejection`

**Contraste:** O `btnSalvarCat.click` (criação) **tem** try/catch. Inconsistência no tratamento de erro.

🔧 **SOLUÇÃO:**
```js
if (ok) {
    try {
        await deleteDoc(doc(db, "usuarios", usuarioId, "categorias", id));
        showToast("Categoria removida.");
    } catch (e) {
        console.error('Erro ao deletar categoria:', e);
        showToast("Erro ao apagar. Verifique sua conexão.", "error");
    }
}
```

---

### 🟡 BUG 5 — Excluir categoria não verifica se está em uso por transações/limites/recorrentes

**Arquivo:** `js/categorias.js` · Linha ~145  
**Severidade:** 🟡 Médio  

```js
window.deletarCategoria = async (id) => {
    const ok = await new Promise(resolve => {
        // ... overlay "Deseja apagar esta categoria?"
    });
    if(ok) {
        await deleteDoc(doc(db, "usuarios", usuarioId, "categorias", id));
        showToast("Categoria removida.");
    }
};
```

**Problema:** O `deleteDoc` executa diretamente sem verificar se a categoria está vinculada a:
- **Transações** (`usuarios/{uid}/transacoes` campo `categoria` = nome)
- **Limites** (`usuarios/{uid}/limites` campo `categoria` = nome)
- **Recorrentes** (`usuarios/{uid}/recorrentes` campo `categoria` = nome)

Após exclusão, esses documentos ficam "órfãos" — referenciam uma categoria que não existe mais. Em telas como limites, a categoria aparece como `undefined` ou não é encontrada no dropdown.

**Cenário real:**
1. Usuário cria "Apostas" como categoria personalizada
2. Registra 50 transações como "Apostas"
3. Cria um limite mensal para "Apostas"
4. Exclui a categoria "Apostas"
5. As 50 transações ainda dizem "Apostas" mas a categoria sumiu das listas
6. O limite fica ativo mas sem correspondência — nunca mais alerta

🔧 **SOLUÇÃO:**
```js
window.deletarCategoria = async (id) => {
    // 1. Buscar dados da categoria antes de excluir
    const catDoc = await getDoc(doc(db, "usuarios", usuarioId, "categorias", id));
    if (!catDoc.exists()) return showToast("Categoria não encontrada.", "error");
    const catNome = catDoc.data().nome;
    
    // 2. Verificar se está em uso
    const transSnap = await getDocs(query(
        collection(db, "usuarios", usuarioId, "transacoes"),
        where("categoria", "==", catNome),
        limit(1)
    ));
    
    const emUso = !transSnap.empty;
    const msgConfirm = emUso
        ? `A categoria "${catNome}" está em uso em transações. Ao apagar, elas manterão o nome mas a categoria não aparecerá mais nas listas. Continuar?`
        : `Deseja apagar a categoria "${catNome}"?`;
    
    // 3. Confirmação com mensagem contextual
    const ok = await new Promise(resolve => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        // ... card com msgConfirm
    });
    
    if (ok) {
        try {
            await deleteDoc(doc(db, "usuarios", usuarioId, "categorias", id));
            showToast("Categoria removida.");
        } catch (e) {
            showToast("Erro ao apagar.", "error");
        }
    }
};
```

---

### 🟡 BUG 6 — Botão deletar só aparece no hover — inacessível no mobile

**Arquivo:** `js/categorias.js` · Linha ~140 (dentro do `innerHTML` do `onSnapshot`)  
**Severidade:** 🟡 Médio  

```html
<div class="category-card bg-white p-4 rounded-2xl flex items-center gap-3 shadow-sm group">
    <span class="text-xl icon-3d">${escapeHTML(c.emoji)}</span>
    <span class="text-sm font-extrabold text-slate-700 truncate">${escapeHTML(c.nome)}</span>
    <span class="ml-auto ...">personalizada</span>
    <button onclick="deletarCategoria('${doc.id}')" 
            class="hidden group-hover:block ml-2 text-red-400 hover:text-red-600 transition-colors">
        <svg ...>✕</svg>
    </button>
</div>
```

**Problema:** `hidden group-hover:block` significa:
- Default: `display: none` (botão invisível)
- On hover do `.group` (card): `display: block` (botão aparece)

**No mobile/touch não existe evento hover.** O `:hover` não é disparado em toque. O botão **nunca** se torna visível. Categorias personalizadas se tornam **impossíveis de excluir** no celular.

**Impacto:** 70%+ dos usuários provavelmente acessam via mobile (app financeiro). Sem poder excluir categorias personalizadas no celular, a funcionalidade fica quebrada para a maioria.

🔧 **SOLUÇÃO:** Sempre visível no mobile, hover apenas no desktop:
```html
<button onclick="deletarCategoria('${doc.id}')" 
        class="ml-2 text-red-400 hover:text-red-600 transition-all md:opacity-0 md:group-hover:opacity-100">
    <svg ...>✕</svg>
</button>
```

Alternativa com swipe-to-delete (mais avançada):
- No mobile, swipe para esquerda no card revela o botão vermelho
- No desktop, hover funciona como está

---

### 🟡 BUG 7 — Não há funcionalidade de editar categoria — só criar e deletar

**Arquivo:** `js/categorias.js` (inteiro)  
**Severidade:** 🟡 Médio  

**O que existe:**
- `abrirModalNovaCategoria()` — abre modal sempre no modo "criar"
- `btnSalvarCat.click` — sempre `addDoc` (cria novo)
- `deletarCategoria` — exclui

**O que NÃO existe:**
- Clicar numa categoria personalizada para editar
- Modo "edição" no modal com dados preenchidos
- `updateDoc` para renomear ou trocar emoji
- Propagação de renomeação para transações vinculadas

**Cenário real:**
1. Usuário cria "Academía" (com acento errado)
2. Registra 20 transações como "Academía"
3. Percebe o erro → precisa **deletar** e **recriar** como "Academia"
4. As 20 transações ficam com "Academía" (categoria que não existe mais)
5. Dados perdidos/fragmentados

🔧 **SOLUÇÃO:** Adicionar modo de edição:
```js
let editandoCatId = null; // null = criando, id = editando

window.editarCategoria = (id, nome, emoji) => {
    editandoCatId = id;
    emojiAtual = emoji;
    document.getElementById('emojiSelecionado').innerText = emoji;
    document.getElementById('catNome').value = nome;
    document.getElementById('tituloModal').innerText = 'Editar Categoria';
    document.getElementById('btnSalvarCat').innerText = 'Salvar Alterações';
    document.getElementById('modalCategoria').classList.remove('hidden');
    atualizarPreview();
};

// No btnSalvarCat.click:
if (editandoCatId) {
    // Modo edição
    const nomeAntigo = /* buscar nome anterior */;
    await updateDoc(doc(db, "usuarios", usuarioId, "categorias", editandoCatId), {
        nome, emoji: emojiAtual
    });
    
    // Propagar renomeação para transações (opcional mas recomendado)
    if (nomeAntigo !== nome) {
        const transSnap = await getDocs(query(
            collection(db, "usuarios", usuarioId, "transacoes"),
            where("categoria", "==", nomeAntigo)
        ));
        const batch = writeBatch(db);
        transSnap.docs.forEach(d => batch.update(d.ref, { categoria: nome }));
        await batch.commit();
    }
    editandoCatId = null;
} else {
    // Modo criação (código atual)
    await addDoc(...);
}
```

No card personalizado, adicionar `onclick`:
```html
<div class="category-card ..." onclick="editarCategoria('${doc.id}', '${escapeHTML(c.nome)}', '${escapeHTML(c.emoji)}')">
```

---

### 🟡 BUG 8 — `renderizarTudo()` chamada antes do plano ser resolvido (race condition)

**Arquivo:** `js/categorias.js` · Linhas ~196-220  
**Severidade:** 🟡 Médio  

```js
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioId = user.uid;
        
        // ← getDoc é ASSÍNCRONO — retorna Promise
        getDoc(doc(db, 'usuarios', user.uid)).then(async (perfilSnap) => {
            const userData = perfilSnap.exists() ? perfilSnap.data() : {};
            const resolvedPlan = resolvePlanSafely(userData);
            // ... downgrade se necessário ...
            perfilPlanoAtual = { ...userData, plano: resolvedPlan.effectivePlan };
            // ← perfilPlanoAtual atualizado AQUI (futuro)
        }).catch(() => {
            perfilPlanoAtual = { plano: 'free' };
        });
        
        renderizarTudo();  // ← EXECUTADA IMEDIATAMENTE — perfilPlanoAtual ainda é { plano: 'free' }
    }
});
```

**Linha do tempo de execução:**
1. `t=0ms` — `onAuthStateChanged` dispara
2. `t=0ms` — `getDoc()` inicia (retorna Promise, NÃO bloqueia)
3. `t=1ms` — `renderizarTudo()` executa → `perfilPlanoAtual = { plano: 'free' }` ← ERRADO
4. `t=200ms` — `.then()` resolve → `perfilPlanoAtual = { plano: 'pro' }` ← CORRETO, mas tarde
5. `t=200ms` — Usuário tenta criar categoria → `canUseFeatureSafely` lê `perfilPlanoAtual` → **PODE já estar correto** (se o `.then()` já resolveu) ou **PODE estar errado** (se o usuário clicou rápido)

**Impacto:** Em conexões lentas (3G, WiFi fraco), o `.then()` pode demorar 1-3 segundos. Se o usuário tentar criar uma categoria nesse intervalo, o `canUseFeatureSafely` lê `plano: 'free'` e bloqueia — mesmo que o usuário tenha plano Pro/Premium.

**Observação:** A renderização em si não é tão afetada porque as categorias padrão não dependem do plano, e as personalizadas usam `onSnapshot` (que carrega independente). O problema maior é no **momento do clique** em "+ Nova" → "Criar".

🔧 **SOLUÇÃO:** Mover `renderizarTudo()` para dentro do `.then()` e do `.catch()`:
```js
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioId = user.uid;
        getDoc(doc(db, 'usuarios', user.uid)).then(async (perfilSnap) => {
            const userData = perfilSnap.exists() ? perfilSnap.data() : {};
            const resolvedPlan = resolvePlanSafely(userData);
            if (resolvedPlan.shouldDowngrade) {
                try {
                    await updateDoc(doc(db, 'usuarios', user.uid), {
                        plano: 'free',
                        downgradeMotivo: resolvedPlan.downgradeReason || 'plan_rules',
                        downgradeEm: serverTimestamp(),
                        assinaturaStatus: resolvedPlan.downgradeReason === 'trial_expired' 
                            ? (userData.assinaturaStatus || null) : 'past_due'
                    });
                } catch (e) { console.error('Falha downgrade:', e); }
                userData.plano = 'free';
            }
            perfilPlanoAtual = { ...userData, plano: resolvedPlan.effectivePlan };
            renderizarTudo();  // ← AQUI: plano já resolvido
        }).catch(() => {
            perfilPlanoAtual = { plano: 'free' };
            renderizarTudo();  // ← AQUI: fallback para free
        });
    } else { window.location.href = "index.html"; }
});
```

---

### 🟡 BUG 9 — Downgrade automático usa `new Date().toISOString()` em vez de `serverTimestamp()`

**Arquivo:** `js/categorias.js` · Linha ~206  
**Severidade:** 🟡 Médio  

```js
await updateDoc(doc(db, 'usuarios', user.uid), {
    plano: 'free',
    downgradeMotivo: resolvedPlan.downgradeReason || 'plan_rules',
    downgradeEm: new Date().toISOString(),   // ← relógio local do dispositivo
    assinaturaStatus: ...
});
```

**Problema duplo:**

1. **Relógio do dispositivo pode estar errado.** Se o celular do usuário estiver com data/hora errada (ex: timezone misconfigured, data atrasada), o `downgradeEm` fica incorreto. Logs de auditoria de downgrade ficam imprecisos.

2. **Tipo de dado inconsistente.** O campo `dataCriacao` nas categorias usa `serverTimestamp()` (Firestore Timestamp). O campo `downgradeEm` usa `new Date().toISOString()` (string ISO "2026-04-08T12:30:00.000Z"). Isso dificulta queries e ordenações no Firestore — comparar Timestamp com string ISO não funciona nativamente.

🔧 **SOLUÇÃO:**
```js
downgradeEm: serverTimestamp(),  // ← consistente com o resto do app
```

---

### 🟡 BUG 10 — Emoji picker não fecha ao clicar fora dele

**Arquivo:** `js/categorias.js` · Linha ~85  
**Severidade:** 🟡 Médio  

```js
window.toggleEmojiPicker = () => document.getElementById('emojiPicker').classList.toggle('hidden');
```

**O que existe:** Toggle simples — clicar no botão abre, clicar de novo no botão fecha.

**O que falta:** Clicar **fora** do picker (no modal, no fundo, no input de nome, etc.) deveria fechar o picker. Este é o comportamento padrão esperado em qualquer dropdown/popover.

**Cenário de confusão:**
1. Usuário abre o picker, escolhe tema "Lazer"
2. Decide digitar o nome antes de escolher emoji
3. Clica no input `#catNome` → picker permanece aberto sobre o input
4. Usuário precisa clicar especificamente no botão "Clique para escolher" para fechar

**Em outras telas do app** (ex: investimentos), dropdowns já têm `document.addEventListener('click')` para fechar ao clicar fora. Inconsistência de UX.

🔧 **SOLUÇÃO:**
```js
// Adicionar após a definição de toggleEmojiPicker:
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emojiPicker');
    const btnTrigger = document.querySelector('[onclick="toggleEmojiPicker()"]');
    if (picker && !picker.classList.contains('hidden') && 
        !picker.contains(e.target) && !btnTrigger?.contains(e.target)) {
        picker.classList.add('hidden');
    }
});
```

---

### 🟡 BUG 11 — `flex-2` no botão "Criar Categoria" — classe Tailwind inválida

**Arquivo:** `categorias.html` · Linha ~170  
**Severidade:** 🟡 Médio  

```html
<button id="btnSalvarCat" class="flex-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm">Criar Categoria</button>
```

**Problema:** `flex-2` **não é uma classe Tailwind válida**. Tailwind tem:
- `flex-1` → `flex: 1 1 0%`
- `flex-auto` → `flex: 1 1 auto`
- `flex-initial` → `flex: 0 1 auto`
- `flex-none` → `flex: none`

`flex-2` não gera nenhuma regra CSS. O botão usa `px-8` como width implícito, mas o `flex-2` era provavelmente intencional para o botão ocupar 2/3 do espaço no footer do modal.

**Impacto visual:** O botão "Criar Categoria" e o "Cancelar" dividem espaço quase igual (`flex-1` + nada). O layout funciona acidentalmente pelo `px-8` do salvar, mas a intenção de proporção 2:1 não é respeitada.

🔧 **SOLUÇÃO:**
```html
<!-- Cancelar com flex-1, Salvar com flex-[2] (ou grow-[2]) -->
<button onclick="fecharModal()" class="flex-1 py-4 ...">Cancelar</button>
<button id="btnSalvarCat" style="flex:2" class="bg-emerald-500 ...">Criar Categoria</button>
```
Ou usar CSS inline `style="flex:2"` já que `flex-[2]` também é uma classe JIT que pode não existir no build.

---

### 🟢 BUG 12 — `sincronizarDados` apenas re-renderiza — sem feedback nem utilidade real

**Arquivo:** `js/categorias.js` · Linha ~17  
**Severidade:** 🟢 Baixo  

```js
window.sincronizarDados = function() { renderizarTudo(); };
```

**Contexto:** O botão de refresh (🔄) no header mobile chama `sincronizarDados()`. Em outras telas, essa função faz o re-fetch dos dados.

**Nesta tela:** As categorias personalizadas usam `onSnapshot` (real-time — sempre atualizada). As padrão são hardcoded (nunca mudam). Então `renderizarTudo()` apenas re-injeta o mesmo HTML no DOM. Não há dados para "sincronizar".

**Impacto:** Baixo — o botão funciona (não dá erro), mas não faz nada útil. Sem feedback visual, o usuário aperta e nada muda.

🔧 **SOLUÇÃO:** Adicionar feedback mínimo:
```js
window.sincronizarDados = function() { 
    renderizarTudo();
    if (window.budShowToast) budShowToast("Categorias atualizadas!", "success");
};
```

---

### 🟢 BUG 13 — Modal não reseta emoji e nome ao abrir nova categoria

**Arquivo:** `js/categorias.js` · Linhas ~79-83  
**Severidade:** 🟢 Baixo  

```js
window.abrirModalNovaCategoria = () => {
    document.getElementById('tituloModal').innerText = tipoAtual === 'despesa' ? '+ Nova Categoria de Despesa' : '+ Nova Categoria de Receita';
    document.getElementById('modalCategoria').classList.remove('hidden');
    setTemaEmoji('dinheiro');   // ← reseta TEMA, mas NÃO o emoji selecionado
    atualizarPreview();        // ← usa emojiAtual que pode ser do estado anterior
};
```

**Sequência que expõe o bug:**
1. Abrir modal → emoji padrão 📦 (correto)
2. Escolher 🎮 do tema Lazer → `emojiAtual = '🎮'`
3. Digitar "Games" no input
4. Clicar "Cancelar" (fecharModal → apenas esconde o modal)
5. Abrir modal de novo → `setTemaEmoji('dinheiro')` renova o grid
6. Mas `emojiAtual` ainda é 🎮, `#emojiSelecionado` ainda mostra 🎮
7. O input ainda contém "Games" (não foi limpo)
8. Preview mostra "🎮 Games" — resíduo da tentativa anterior

🔧 **SOLUÇÃO:**
```js
window.abrirModalNovaCategoria = () => {
    // Resetar estado
    emojiAtual = '📦';
    document.getElementById('emojiSelecionado').innerText = '📦';
    document.getElementById('catNome').value = '';
    
    // Configurar modal
    document.getElementById('tituloModal').innerText = tipoAtual === 'despesa' 
        ? '+ Nova Categoria de Despesa' 
        : '+ Nova Categoria de Receita';
    document.getElementById('modalCategoria').classList.remove('hidden');
    document.getElementById('emojiPicker').classList.add('hidden'); // fechar picker se estava aberto
    setTemaEmoji('dinheiro');
    atualizarPreview();
};
```

---

### 🟢 BUG 14 — Categorias padrão não são editáveis nem ocultáveis — poluem dropdowns

**Arquivo:** `categorias.html` + `js/categorias.js`  
**Severidade:** 🟢 Baixo (melhoria de UX)  

```js
// renderizarTudo():
const padraoHTML = categoriasPadrao[tipoAtual].map(c => `
    <div class="category-card ... opacity-80 cursor-not-allowed">
        <span ...>${escapeHTML(c.emoji)}</span>
        <span ...>${escapeHTML(c.nome)}</span>
        <span class="ml-auto ...">padrão</span>
    </div>
`).join('');
```

**Problema:** São **48 categorias de despesa** fixas, sem opção de ocultar. Se o usuário não tem carro, as categorias Combustível, Uber/Táxi, Estacionamento, Manutenção Veículo, IPVA/Seguro, Pedágio (6 categorias!) são irrelevantes mas aparecem em **todos os dropdowns** do app.

**Impacto:** Dropdowns longos e poluídos. Experiência de seleção pior em mobile (scroll infinito). Categorias irrelevantes atrapalham o fluxo de registro rápido.

🔧 **SOLUÇÃO (melhoria futura para Pro/Premium):**
```js
// No FireStore: usuarios/{uid}/configuracoes
// Novo campo: categoriasOcultas: ['Pedágio', 'IPVA/Seguro', 'Combustível']

// No renderizarTudo():
const ocultas = userConfig?.categoriasOcultas || [];
const visiveis = categoriasPadrao[tipoAtual].filter(c => !ocultas.includes(c.nome));
```

Na UI, adicionar botão de olho (👁️) em cada categoria padrão para ocultar/exibir.

---

### 🟢 BUG 15 — `showToast` local duplica funcionalidade do `budShowToast` global

**Arquivo:** `js/categorias.js` · Linhas ~187-193  
**Severidade:** 🟢 Baixo  

```js
window.showToast = (msg, tipo = 'success') => {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `px-6 py-3 rounded-2xl shadow-xl font-black text-xs uppercase tracking-widest border transition-all animate-fade-in ${
        tipo === 'success' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-white border-red-200 text-red-600'
    }`;
    t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
};
```

**Problema:** O `bud-utils.js` já fornece `window.budShowToast(msg, tipo)` usado em **todas as outras telas** do app. Esta tela reimplementa seu próprio sistema de toast com:
- Container HTML dedicado (`<div id="toast-container">`) no categorias.html
- Função `showToast` diferente de `budShowToast`
- Classes Tailwind diferentes do toast global
- Posição: `fixed top-5 left-1/2 -translate-x-1/2` (centro-topo) vs posição do global

**Resultado visual:** Os toasts desta tela podem ter **aparência e posição diferentes** dos toasts de extrato, dashboard, limites etc.

🔧 **SOLUÇÃO:**
1. Remover `<div id="toast-container">` do `categorias.html`
2. Remover a função `showToast` do JS
3. Substituir todas as chamadas `showToast(...)` por `window.budShowToast(...)`:
```js
// De:
showToast("Categoria criada com sucesso!");
showToast("Erro ao criar.", "error");

// Para:
window.budShowToast("Categoria criada com sucesso!", "success");
window.budShowToast("Erro ao criar.", "error");
```

---

## ✅ Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)
- [ ] **BUG 1** — Trocar `className` por `style.cssText` no overlay de exclusão
- [ ] **BUG 2** — Verificar duplicação com padrão + personalizadas antes de `addDoc`
- [ ] **BUG 3** — Centralizar `categoriasPadrao` em arquivo único compartilhado

### 🟡 Médio (corrigir em breve)
- [ ] **BUG 4** — Envolver `deleteDoc` em try/catch
- [ ] **BUG 5** — Verificar se categoria está em uso antes de excluir
- [ ] **BUG 6** — Botão deletar visível no mobile (`md:opacity-0 md:group-hover:opacity-100`)
- [ ] **BUG 7** — Adicionar funcionalidade de editar categoria (modo edição no modal)
- [ ] **BUG 8** — Mover `renderizarTudo()` para dentro do `.then()` do plano
- [ ] **BUG 9** — Usar `serverTimestamp()` no downgrade em vez de `new Date().toISOString()`
- [ ] **BUG 10** — Fechar emoji picker ao clicar fora
- [ ] **BUG 11** — Trocar `flex-2` por `style="flex:2"` no botão de salvar

### 🟢 Baixo (melhorias opcionais)
- [ ] **BUG 12** — `sincronizarDados` com feedback visual (toast)
- [ ] **BUG 13** — Resetar emoji e nome ao abrir modal
- [ ] **BUG 14** — Permitir ocultar categorias padrão não usadas
- [ ] **BUG 15** — Usar `budShowToast` global em vez de `showToast` local

---

## 📊 Métricas da Auditoria

| Métrica | Valor |
|---|---|
| Total de bugs encontrados | **15** |
| 🔴 Críticos | 3 |
| 🟡 Médios | 8 |
| 🟢 Baixos | 4 |
| Linhas analisadas | 408 (185 HTML + 223 JS) |
| Categorias padrão despesa | 48 |
| Categorias padrão receita | 15 |
| Emojis no picker | 55 (4 temas) |
| Modais | 1 (criação de categoria) |
| Listeners Firebase | 1 (onSnapshot para personalizadas) |
| Variáveis de estado | 5 (usuarioId, perfilPlanoAtual, tipoAtual, emojiAtual, _unsubCat) |
| Padrões recorrentes de outras telas | 3 (overlay Tailwind, categorias duplicadas, showToast local) |

---

## 💚 Pontos Positivos

1. **`escapeHTML` consistente em TODA renderização:** Aplicado tanto nas categorias padrão (`escapeHTML(c.emoji)`, `escapeHTML(c.nome)`) quanto nas personalizadas vindas do Firestore. Proteção XSS completa — nenhum dado do usuário é injetado como HTML bruto.

2. **`onSnapshot` com cleanup de listener:** Usando `_unsubCat` para cancelar o listener anterior antes de criar um novo. Evita listeners duplicados ao trocar de aba (despesa ↔ receita). Padrão correto de gerenciamento de recursos.

3. **Emoji picker com temas e grid visual:** UX intuitiva — 4 categorias temáticas (Dinheiro, Trabalho, Casa, Lazer) com 55 emojis no total. Grid de 6 colunas com scroll customizado. Animação `scaleUp` ao abrir. Seleção fecha o picker e atualiza a preview.

4. **Preview em tempo real no modal:** Mostra exatamente como a categoria vai ficar — emoji + nome + badge "personalizada" — antes de salvar. O preview atualiza a cada caractere digitado (listener `input`). Reduz erros e melhora a confiança do usuário.

5. **Verificação de plano antes de criar:** `canUseFeatureSafely(perfilPlanoAtual, 'customCategories')` bloqueia criação no plano Free com mensagem clara. Funcionalidade gated corretamente.

6. **`serverTimestamp()` na criação de categoria:** Usa timestamp do servidor Firestore, não do dispositivo. Garante consistência das datas independente do fuso/configuração do usuário.

7. **Botão com estado de loading anti-duplo-clique:** Durante o salvamento, `btn.innerHTML = "Salvando... ⏳"` + `btn.disabled = true`. Evita criar categorias duplicadas por double-click. Restaura estado original após success ou error.

8. **Grid responsivo 3 breakpoints:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Funciona bem no mobile (empilhado), tablet (2 colunas) e desktop (3 colunas). Cards com `gap-3` e hover com `translateY(-2px)` + borda verde.

9. **Downgrade automático em background:** Detecta plano expirado via `resolvePlanSafely()` e aplica downgrade silenciosamente. Usuário não fica com funcionalidades Pro ativas indevidamente.

10. **CSS clean e coerente com o design system:** Animações suaves (`fadeIn` 0.2s, `scaleUp` 0.2s), hover states verdes (emerald-500), ícones com `drop-shadow` 3D, scrollbar customizada fina. Visual coerente com o resto do app.
