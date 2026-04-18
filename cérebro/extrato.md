# 📑 Tela: Extrato Completo

## 📋 Visão Geral

A tela **Extrato** (`extrato.html`) é a **central de visualização e gerenciamento de todas as transações** do Bud Finanças. É uma das telas mais importantes do app — é onde o usuário vê o resumo mensal, filtra, busca, edita, marca como pago/pendente, exclui e exporta suas transações. Possui 4 áreas funcionais:

1. **Resumo do Mês** — 3 cards (Receitas, Despesas, Saldo) com valores do mês selecionado
2. **Filtros** — Por status (Todas / Realizadas / Pendentes), por busca textual, por categoria (dropdown customizado), e por mês (navegador `< Mês >` no desktop, seletor bottom-sheet no mobile)
3. **Lista de Transações** — Agrupadas por dia, com ícone/emoji de categoria, descrição, valor, toggle pago/pendente, botões editar e excluir, badges (IMPORT, REC, PENDENTE)
4. **Exportação** — CSV e PDF com layout profissional branded

| Item | Detalhe |
|---|---|
| **Arquivo HTML** | `extrato.html` (220 linhas) |
| **Arquivo JS** | `js/extrato.js` (648 linhas) |
| **Coleção Firestore** | `usuarios/{uid}/transacoes` (leitura/escrita), `usuarios/{uid}/categorias` (leitura) |
| **Dependências** | Firebase Auth/Firestore, `bud-utils.js` (escapeHTML, budShowToast), `bud-loader.js`, `sidebar.js`, `dark-mode.js`, `tutorial*.js` (3 arquivos), `plano-config.js` |
| **Tipo de módulo** | ES Module (`type="module"`) |
| **Modais** | 3 — Seletor de Mês mobile, Editar Transação, Overlay de exclusão |
| **Tamanho total** | 868 linhas (220 HTML + 648 JS) |

### Relação com outras telas

O extrato é o **espelho de tudo** que acontece no app:
- **Dashboard** → cria transações que aparecem aqui
- **Recorrentes** → gera transações automáticas que aparecem aqui com badge `REC`
- **Importar** → importa transações de CSV/OFX que aparecem aqui com badge `IMPORT`
- **Mercado/Compras** → cria transações de compra com `origem: 'compras'`
- **Limites** → consulta as mesmas transações para calcular gastos por categoria
- **Gráficos/Relatórios** → lê as mesmas transações para visualizações

---

## 🗄️ Estrutura de Dados (Firestore)

### Documento: `usuarios/{uid}/transacoes/{id}`

```js
{
  tipo: "despesa",                    // "despesa" ou "receita"
  descricao: "Supermercado Assaí",    // string — texto livre
  valor: 342.80,                      // number — valor positivo
  categoria: "Mercado",               // string — nome da categoria
  conta: "Débito",                    // string — forma de pagamento (opcional)
  dataReferencia: "2026-04-08",       // string ISO — data do lançamento
  dataCriacao: Timestamp,             // serverTimestamp() — quando foi criado
  atualizadoEm: Timestamp,           // serverTimestamp() — última edição
  pago: true,                         // boolean — status pago/pendente
  cartaoId: "",                       // string — ID do cartão (se crédito)
  origem: "compras",                  // string — "importacao", "compras", "recorrente" ou undefined
  recorrente: false,                  // boolean — gerado por recorrência
  compraId: "",                       // string — ID da compra vinculada (opcional)
}
```

### Documento: `usuarios/{uid}/categorias/{id}` (leitura)

```js
{
  nome: "Academia",    // string
  emoji: "🏋️",       // string
  tipo: "despesa",     // string
}
```

### Categorias Padrão (hardcoded no JS — linhas 38-46)

A tela mantém **sua própria cópia** das categorias padrão:

#### Despesas — `categsPadrao.despesa` (51 categorias!)

```
Aluguel, Condomínio, Água, Luz, Gás, Internet/TV, Manutenção da Casa, Mercado,
Delivery/Ifood, Restaurante, Padaria/Café, Combustível, Uber/Táxi, Ônibus/Metrô,
Estacionamento, Manutenção Veículo, IPVA/Seguro, Pedágio, Plano de Saúde, Farmácia,
Consultas/Exames, Terapia/Psicólogo, Dentista, Faculdade/Escola, Cursos,
Material Escolar, Cinema/Teatro, Shows/Eventos, Viagens, Bares/Baladas, Hobbies,
Jogos/Games, Roupas/Sapatos, Acessórios, Academia/Esportes, Salão/Barbearia,
Cosméticos, Presentes, Eletrônicos, Casa/Móveis, Pet, Assinaturas/Streaming,
Diarista/Limpeza, Impostos/IRPF, Taxas Bancárias, Empréstimos/Dívidas,
Seguro de Vida, Doações/Dízimo, Transferência, Pagamento de Fatura, Outros
```

**⚠️ Divergência:** Esta lista tem **51 categorias** de despesa, enquanto `categorias.js` tem **48**. As extras aqui são: `Transferência`, `Pagamento de Fatura` — não existem na tela de categorias.

#### Receitas — `categsPadrao.receita` (15 categorias)

Mesmas 15 do `categorias.js`: Salário, Férias, 13º Salário, etc.

### Mapa de Emojis por Categoria (`catEmojiMapExtrato`)

Objeto separado com **53 mapeamentos** nome→emoji. Duplica a informação que já existe no array de `categorias.js` (onde cada item tem `{ nome, emoji }`), mas aqui é um map plano.

Existe também um segundo mapa **nunca usado**: `estiloCategorias` (linha ~102) com 7 categorias genéricas — sobra de código antigo.

---

## 🏗️ Estrutura do HTML

### Layout Geral

```
<body> (bg-[#f4f7fb], flex, overflow-hidden, 100dvh)
├── Blob decorativo azul (absolute, top-left, blur-100px, pointer-events-none)
├── Blob decorativo cyan (absolute, bottom-right, blur-100px, pointer-events-none)
├── #mobileOverlay (bg-slate-900/40, backdrop-blur, z-40, hidden)
├── #sidebar-container
└── <main> (flex-1, flex-col, overflow-y-auto, z-10)
    ├── <header> (h-20, glass-panel, sticky top-0, z-30)
    │   ├── Botão hamburger (md:hidden) → toggleSidebar()
    │   ├── Botão olhinho 👁️ (md:hidden) → toggleOcultarValores()
    │   ├── Botão refresh 🔄 (md:hidden) → sincronizarDados()
    │   ├── Título "Extrato" (mobile) / "Extrato Completo" (desktop)
    │   ├── Navegador de mês (hidden md:flex) → mudarMesFiltro(±1)
    │   │   └── < [#textoMesAnoFiltro] >
    │   └── Botão calendário 📅 (md:hidden) → abrirSeletorMes()
    └── <div> (p-4 md:p-8, max-w-7xl, space-y-6, pb-20)
        ├── Resumo do Mês (grid-cols-3)
        │   ├── Card Receitas (#resumoReceitas) — emerald
        │   ├── Card Despesas (#resumoDespesas) — red
        │   └── Card Saldo (#resumoSaldo) — blue/red dinâmico
        ├── Seção "Todas as Transações"
        │   ├── Título + subtítulo
        │   └── Filtros de status (pill bar — Todas / Realizadas / Pendentes)
        ├── Busca + Filtros
        │   ├── Input busca (#buscaExtrato) → oninput="atualizarFiltros()"
        │   ├── Dropdown categoria (#wrapFiltroCategoria) → toggleCatFiltroDD()
        │   │   ├── #btnFiltroCategoria
        │   │   └── #catFiltroList (hidden, z-80) → #catFiltroItems
        │   └── Dropdown exportar (#wrapExportar) → toggleExportDD()
        │       ├── #btnExportar (bg-blue-600)
        │       └── #exportDropdown (hidden, z-80)
        │           ├── 📊 Exportar CSV → exportarCSV()
        │           └── 📄 Exportar PDF → exportarPDF()
        └── #listaExtrato (glass-card, rounded-[2rem]) ← populado via JS
```

### Modal Seletor de Mês (`#modalSeletorMes`)

```
#modalSeletorMes (fixed, inset-0, bg-slate-900/60, z-70, items-end)
└── <div> (bg-white, max-w-md, rounded-t-[2rem], animate-slide-up)
    ├── Drag handle (w-10 h-1 bg-slate-300)
    ├── Navegador de ano: < [#anoSeletorMes] > → mudarAnoSeletor(±1)
    ├── #gridMesesSeletor (grid-cols-3, gap-3) — 12 botões Jan-Dez
    │   └── Color: ativo = bg-blue-600 text-white, inativo = bg-slate-100
    └── Botão "Cancelar" → fecharSeletorMes()
```

### Modal Editar Transação (`#modalEditarTransacao`)

```
#modalEditarTransacao (fixed, inset-0, z-9999, bg-slate-900/40, backdrop-blur)
└── <div> (bg-white, max-w-md, rounded-3xl, z-10000, stopPropagation)
    ├── Título "✏️ Editar Transação"
    ├── #editId (hidden input — guarda o ID da transação)
    ├── Descrição: #editDescricao (text input)
    ├── Grid 2 cols:
    │   ├── Tipo: #editTipo (select — Despesa/Receita)
    │   └── Valor: #editValor (text input, formatado BRL)
    ├── Grid 2 cols:
    │   ├── Categoria: #editCategoria (hidden input) + dropdown custom
    │   │   ├── #btnCatExtrato → toggleCatDropdownExtrato()
    │   │   ├── #catExtratoLabel (span visual)
    │   │   └── #catExtratoList (hidden, absolute bottom-full, z-80)
    │   │       └── #catExtratoItems ← populado por popularCategoriasModal()
    │   └── Data: #editData (date input)
    └── Botões:
        ├── "Cancelar" → fecharModalEditar()
        └── "Salvar" (#btnSalvarEdicao) → salvarEdicao()
```

### CSS Customizado

| Classe/Seletor | Propósito |
|---|---|
| `.glass-card` | Background rgba branco 70%, backdrop-blur 20px, border branco, double box-shadow |
| `.glass-panel` | Background rgba branco 85%, backdrop-blur 24px — header |
| `.icon-3d` | Double drop-shadow (6px + 2px), translateZ(0) |
| `.select-custom` | Aparência customizada de `<select>`: chevron SVG inline, padding-right |
| `@keyframes slide-up` | translateY(100%→0) — bottom-sheet do seletor de mês |
| `.no-scrollbar` | Esconde scrollbar (webkit + Firefox) |

### Scripts carregados (ordem):

1. `firebase-config.js` — Config global
2. `bud-loader.js` — Splash screen
3. `bud-utils.js` — escapeHTML, budShowToast, etc.
4. `plano-config.js` — Configurações de plano
5. `sidebar.js` — Sidebar navegação
6. `js/extrato.js` — **Lógica principal** (type="module")
7. `dark-mode.js` — Tema escuro
8. `tutorial.js` + `tutorial-steps.js` + `tutorial-init.js` — Tutorial

---

## 🔄 Fluxo Completo da Tela

### Inicialização

```
js/extrato.js carrega (module):
  ├─ Inicializa Firebase App, Auth, Firestore
  ├─ Variáveis globais:
  │   ├─ valoresOcultos = false               ← toggle olhinho
  │   ├─ fmtVE(v) → "R$ •••••" ou formatado  ← formatter condicional
  │   ├─ usuarioAtualId = null
  │   ├─ transacoesGlobais = []               ← TODAS as transações (até 5000!)
  │   ├─ filtroAtual = 'todas'                ← status selecionado
  │   ├─ catFiltroAtual = ''                  ← categoria selecionada
  │   ├─ categoriasCustom = []                ← do Firestore via onSnapshot
  │   ├─ categsPadrao = { despesa: [...51], receita: [...15] }
  │   ├─ catEmojiMapExtrato = { ...53 mapeamentos }
  │   ├─ estiloCategorias = { ...7 genéricos } ← NUNCA USADO (código morto)
  │   ├─ dataFiltro = new Date()              ← mês/ano selecionado
  │   └─ _unsubs = [], _planoUsuario = null
  │
  ├─ Define funções globais (window.*)
  ├─ atualizarTextosDeData()  ← renderiza "abril 2026" no header
  │
  └─ onAuthStateChanged(auth, async callback):
      ├─ Limpa listeners anteriores: _unsubs.forEach(fn=>fn()); _unsubs=[]
      │
      ├─ user EXISTE:
      │   ├─ usuarioAtualId = user.uid
      │   ├─ getDoc(usuarios/{uid}) → _planoUsuario
      │   ├─ NexoPlanos.resolvePlan → shouldDowngrade? → plano = 'free'
      │   │   ⚠️ NÃO faz updateDoc no Firestore para persistir o downgrade
      │   │
      │   ├─ onSnapshot(categorias, limit(200)):
      │   │   └─ categoriasCustom = snap.docs.map(d.data()) → renderizarExtrato()
      │   │
      │   └─ onSnapshot(transacoes, limit(5000)):
      │       ├─ hideSplash()
      │       ├─ transacoesGlobais = snapshot.docs (com id)
      │       ├─ Sort por dataCriacao.toMillis() DESC
      │       └─ renderizarExtrato()
      │
      └─ user NÃO EXISTE → redirect index.html
```

### Fluxo: Renderizar Extrato (`renderizarExtrato`)

```
renderizarExtrato():
  │
  ├─ normalizarAnoMes(valor):
  │   ├─ string ISO "2026-04-08" → "2026-04"
  │   ├─ string BR "08/04/2026" → "2026-04"
  │   └─ Date object → "YYYY-MM"
  │
  ├─ Filtrar por mês: transacoesGlobais → doMes (where anoMes == dataFiltro)
  │
  ├─ Calcular resumo:
  │   ├─ totalReceitas (soma transações tipo='receita')
  │   ├─ totalDespesas (soma transações tipo!='receita')
  │   └─ saldoMes = receitas - despesas
  │   └─ Atualizar #resumoReceitas, #resumoDespesas, #resumoSaldo
  │       └─ Saldo: cor azul se >=0, vermelho se <0
  │
  ├─ Popular dropdown de categorias:
  │   ├─ Set = categorias usadas no mês ∪ categoriasCustom
  │   ├─ Sort alphabético
  │   └─ Criar botões: "Todas categorias" + cada categoria com emoji
  │
  ├─ Aplicar filtros:
  │   ├─ Status: todas / realizadas (pago≠false) / pendentes (pago===false)
  │   ├─ Busca: descrição ou categoria .includes(query)
  │   └─ Categoria: categoria === catSelecionada
  │
  ├─ Se 0 resultados → ícone 📭 "Nenhuma transação encontrada"
  │
  └─ Agrupar por dia → renderizar:
      ├─ Header de dia: "8 de abril" + subtotais (+R$ receita, -R$ despesa)
      └─ Para cada transação:
          ├─ Ícone/emoji da categoria
          ├─ Descrição (escapeHTML) + Categoria • Data
          ├─ Badges: IMPORT (azul), REC (roxo), ⏳PENDENTE (amber)
          ├─ Valor com sinal +/- e cor verde/vermelho
          ├─ Toggle switch pago/pendente → alterarStatus()
          ├─ Botão ✏️ editar → abrirModalEditar()
          └─ Botão 🗑️ excluir → deletarTransacao()
```

### Fluxo: Editar Transação

```
Clique no ✏️ de uma transação
  └─ abrirModalEditar(id):
      ├─ Busca transação em transacoesGlobais por id
      ├─ Preenche: editDescricao, editTipo, editValor (formatado BRL), editData
      ├─ popularCategoriasModal(tipo, categoriaAtual):
      │   ├─ Lista = categsPadrao[tipo] + categoriasCustom do tipo
      │   └─ Injeta botões em #catExtratoItems
      └─ Mostra #modalEditarTransacao

Usuário edita campos:
  ├─ Trocar tipo (despesa↔receita) → listener change:
  │   └─ popularCategoriasModal(novoTipo) + limpa seleção
  └─ Selecionar categoria no dropdown:
      └─ selectCatExtrato(nome) → setCatExtratoLabel(nome)

Clique "Salvar":
  └─ salvarEdicao():
      ├─ Lê: editId, editDescricao, editTipo, editValor (parse BRL→number), editCategoria, editData
      ├─ Valida: descricao && valor && data obrigatórios
      ├─ updateDoc(transacoes/{id}, { descricao, tipo, valor, categoria, dataReferencia, atualizadoEm })
      └─ fecharModalEditar()
```

### Fluxo: Excluir Transação

```
Clique no 🗑️ de uma transação
  └─ deletarTransacao(id):
      ├─ Promise com overlay de confirmação:
      │   ├─ ov.className = 'fixed inset-0 bg-black/40 ...'  ← BUG 1: Tailwind dinâmico
      │   ├─ "Apagar transação" + "Seu saldo será recalculado."
      │   ├─ Cancelar → resolve(false)
      │   └─ Apagar → resolve(true)
      └─ SE confirmado:
          └─ deleteDoc(transacoes/{id}) + try/catch ✅
```

### Fluxo: Exportar CSV

```
Clique "📊 Exportar CSV":
  └─ exportarCSV():
      ├─ obterTransacoesFiltradas() → dados do mês com filtros ativos
      ├─ Se vazio → budShowToast warning
      ├─ Monta CSV com separador ";" (compatível Excel BR):
      │   └─ Colunas: Data, Descrição, Tipo, Categoria, Valor, Status
      ├─ BOM UTF-8 (\\uFEFF) para acentos
      └─ Download via Blob + createElement('a')
```

### Fluxo: Exportar PDF

```
Clique "📄 Exportar PDF":
  └─ exportarPDF():
      ├─ obterTransacoesFiltradas()
      ├─ Calcula totais
      ├─ Gera HTML completo com:
      │   ├─ Logo SVG do Bud Finanças
      │   ├─ Cards resumo (Receitas, Despesas, Saldo)
      │   ├─ Tabela por dia com emoji, descrição, valor, status
      │   ├─ Badges IMPORT / REC
      │   └─ Footer com logo + data/hora de geração
      ├─ window.open('', '_blank') + document.write(html)
      └─ setTimeout(500ms) → win.print()
```

---

## ⚙️ Funções Principais — Detalhamento

| Função | Linha | Escopo | Descrição |
|---|---|---|---|
| `fmtVE(v)` | ~13 | local | Formatter condicional: `valoresOcultos ? 'R$ •••••' : v.toLocaleString(BRL)` |
| `toggleCatFiltroDD()` | ~20 | `window` | Toggle do dropdown de filtro por categoria |
| `setCatFiltro(val, lbl)` | ~25 | local | Seta filtro de categoria + renderiza |
| `popularCategoriasModal(tipo, val)` | ~49 | local | Popula dropdown de categorias no modal de edição |
| `setCatExtratoLabel(nome)` | ~60 | local | Atualiza label visual da categoria selecionada no modal |
| `toggleCatDropdownExtrato()` | ~67 | `window` | Toggle dropdown categoria do modal edição |
| `selectCatExtrato(nome)` | ~74 | `window` | Seleciona categoria no modal e fecha dropdown |
| `getEmojiExtrato(nome)` | ~98 | local | Busca emoji: custom → catEmojiMapExtrato → fallback 📦 |
| `atualizarTextosDeData()` | ~105 | local | Renderiza "abril 2026" no header |
| `mudarMesFiltro(dir)` | ~109 | `window` | ±1 mês no dataFiltro → atualiza texto + renderiza |
| `toggleOcultarValores()` | ~113 | `window` | Toggle valoresOcultos → renderiza |
| `sincronizarDados()` | ~114 | `window` | Apenas renderizarExtrato() (sem re-fetch) |
| `atualizarFiltros()` | ~115 | `window` | Apenas renderizarExtrato() (chamada pelo oninput da busca) |
| `toggleExportDD()` | ~118 | `window` | Toggle dropdown de exportação |
| `obterTransacoesFiltradas()` | ~124 | local | Retorna transações com TODOS os filtros aplicados (mês, status, busca, categoria) — usada por CSV/PDF |
| `exportarCSV()` | ~135 | `window` | Gera e baixa arquivo CSV |
| `exportarPDF()` | ~153 | `window` | Gera HTML branded e abre print dialog |
| `renderizarGridMeses()` | ~329 | local | Renderiza 12 botões Jan-Dez no seletor mobile |
| `selecionarMes(mes)` | ~335 | `window` | Seta mês no dataFiltro → renderiza |
| `mudarFiltro(filtro)` | ~340 | `window` | Muda filtro de status + atualiza CSS pills |
| `alterarStatus(id, pago)` | ~352 | `window` | updateDoc: pago=true/false |
| `deletarTransacao(id)` | ~362 | `window` | Overlay confirmação + deleteDoc |
| `abrirModalEditar(id)` | ~384 | `window` | Preenche modal com dados da transação |
| `salvarEdicao()` | ~405 | `window` | Lê campos, valida, updateDoc |
| `renderizarExtrato()` | ~420 | local | **Função principal** — filtra, agrupa, gera HTML |
| `normalizarAnoMes(valor)` | ~422 | local (interna) | Parse de data ISO/BR/Date → "YYYY-MM" |

### Variáveis de Estado

| Variável | Tipo | Valor Inicial | Uso |
|---|---|---|---|
| `valoresOcultos` | `boolean` | `false` | Toggle "olhinho" — esconde ou mostra valores |
| `usuarioAtualId` | `string\|null` | `null` | UID do Firebase Auth |
| `transacoesGlobais` | `array` | `[]` | **TODAS** as transações do usuário (até 5000!) |
| `filtroAtual` | `string` | `'todas'` | Status: 'todas', 'realizadas', 'pendentes' |
| `catFiltroAtual` | `string` | `''` | Categoria filtrada ('' = todas) |
| `categoriasCustom` | `array` | `[]` | Categorias personalizadas do Firestore |
| `dataFiltro` | `Date` | `new Date()` | Mês/ano selecionado para filtro |
| `_unsubs` | `array` | `[]` | Array de funções unsubscribe dos onSnapshot |
| `_planoUsuario` | `object\|null` | `null` | Dados do plano do usuário |
| `anoSeletor` | `number` | `new Date().getFullYear()` | Ano no seletor de mês mobile |

---

## 🐛 Auditoria de Bugs, Incoerências e Melhorias

### 🔴 BUG 1 — Overlay de exclusão usa classes Tailwind dinâmicas (INVISÍVEL)

**Arquivo:** `js/extrato.js` · Linha ~369  
**Severidade:** 🔴 Crítico  
**Recorrência:** Mesmo bug em categorias, mercado, investimentos, metas, limites, dividas

```js
const ov = document.createElement('div');
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```

**Problema:** `bg-black/40` e `z-[9999]` não existem no build estático. O overlay de confirmação "Apagar transação" fica sem fundo escuro e sem z-index adequado.

**Impacto:** Usuário clica em 🗑️ e a confirmação aparece sem backdrop, ou flutuando atrás de outros elementos. Pode apagar transação sem querer se clicar "às cegas".

🔧 **SOLUÇÃO:**
```js
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 BUG 2 — `limit(5000)` carrega TODAS as transações — sem paginação, sem filtro server-side

**Arquivo:** `js/extrato.js` · Linha ~618  
**Severidade:** 🔴 Crítico (performance)

```js
const transacoesRef = query(collection(db, "usuarios", user.uid, "transacoes"), limit(5000));

_unsubs.push(onSnapshot(transacoesRef, (snapshot) => {
    transacoesGlobais = [];
    snapshot.forEach((d) => {
        transacoesGlobais.push({ id: d.id, ...d.data() });
    });
    // ...
    renderizarExtrato();
}));
```

**Problema:** O `onSnapshot` baixa **até 5000 documentos** de uma vez para o cliente. Todo o filtro (mês, status, busca, categoria) é feito **client-side** em `renderizarExtrato()`. Isso significa:

1. **Custo Firebase:** Cada vez que `onSnapshot` dispara (qualquer alteração em qualquer transação), **5000 leituras** são cobradas. Se o usuário tiver 3000 transações em 2 anos e editou 1 → 3000 reads recebidas pelo snapshot listener.
2. **Memória:** `transacoesGlobais` mantém 5000 objetos em memória permanentemente.
3. **Performance:** `renderizarExtrato()` itera sobre 5000 itens a cada filtro/busca/troca de mês. Em celulares fracos, isso causa lag perceptível.
4. **Primeiro carregamento:** Baixar 5000 docs no 3G pode levar 5-10 segundos.

**Cenário real:** Usuário com 2 anos de app, 100 transações/mês = 2400 transações. Todas são baixadas para ver apenas 1 mês (~100).

🔧 **SOLUÇÃO IDEAL:** Usar query com filtro server-side por mês:
```js
// Ao trocar de mês, refazer a query:
function carregarTransacoesMes() {
    const inicio = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}-01`;
    const fimDate = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth()+1, 0);
    const fim = `${fimDate.getFullYear()}-${String(fimDate.getMonth()+1).padStart(2,'0')}-${String(fimDate.getDate()).padStart(2,'0')}`;
    
    const q = query(
        collection(db, "usuarios", user.uid, "transacoes"),
        where("dataReferencia", ">=", inicio),
        where("dataReferencia", "<=", fim),
        orderBy("dataReferencia", "desc")
    );
    // ... onSnapshot(q, ...)
}
```

**Benefícios:** ~50x menos reads, carregamento instantâneo, menor uso de memória.

**Trade-off:** Requer índice composto no Firestore. A exportação CSV/PDF precisaria de query separada para obter dados filtrados.

🔧 **SOLUÇÃO MÍNIMA (sem mudar a arquitetura):** Pelo menos reduzir o limit e usar `where` para meses recentes:
```js
// Se precisa manter client-side por simplicidade, limitar a 12 meses:
const dozeAtras = new Date();
dozeAtras.setMonth(dozeAtras.getMonth() - 12);
const limiteInferior = dozeAtras.toISOString().slice(0, 10);

const transacoesRef = query(
    collection(db, "usuarios", user.uid, "transacoes"),
    where("dataReferencia", ">=", limiteInferior),
    orderBy("dataReferencia", "desc"),
    limit(2000)
);
```

---

### 🔴 BUG 3 — `categsPadrao` diverge da lista em `categorias.js` — 51 vs 48 despesas

**Arquivo:** `js/extrato.js` · Linhas ~38-46  
**Severidade:** 🔴 Crítico (dados inconsistentes)

```js
const categsPadrao = {
    despesa: ['Aluguel','Condomínio','Água',...,'Transferência','Pagamento de Fatura','Outros'],
    // ← 51 categorias
    receita: ['Salário','Férias',...]
    // ← 15 categorias
};
```

Comparando com `categorias.js`:

| Categoria | `extrato.js` | `categorias.js` |
|---|---|---|
| Transferência | ✅ | ❌ |
| Pagamento de Fatura | ✅ | ❌ |
| Outros (despesa) | ✅ | ✅ |
| Total despesa | **51** | **48** |

**Problema:** O dropdown de categoria no modal de edição mostra "Transferência" e "Pagamento de Fatura" como opções, mas essas categorias **não existem na tela de categorias**. Se o usuário for à tela de categorias, não encontra essas duas. Os limites não reconhecem essas categorias.

**Impacto:** Inconsistência entre telas. Uma transação editada para "Transferência" aparece no extrato mas não nos limites por categoria.

🔧 **SOLUÇÃO:** Mesma do BUG 3 de `categorias.md` — centralizar em `categorias-padrao.js`.

---

### 🔴 BUG 4 — Resumo inclui transações pendentes (pago=false) no total — distorce saldo real

**Arquivo:** `js/extrato.js` · Linhas ~460-465  
**Severidade:** 🔴 Crítico (dados financeiros errados)

```js
// Todas transações do mês (para resumo)
const doMes = transacoesGlobais.filter(t => { ... });

// Resumo do mês
let totalReceitas = 0, totalDespesas = 0;
doMes.forEach(t => { if(t.tipo === 'receita') totalReceitas += t.valor; else totalDespesas += t.valor; });
```

**Problema:** O resumo soma **TODAS** as transações do mês, incluindo as com `pago: false` (pendentes). Se o usuário tem R$ 5.000 de salário (pago) e R$ 3.000 de aluguel **pendente**, o resumo mostra:
- Receitas: R$ 5.000
- Despesas: R$ 3.000
- Saldo: R$ 2.000

Mas o saldo **real** na conta é R$ 5.000, porque o aluguel ainda não foi pago.

**Impacto:** O usuário vê um saldo menor do que tem na conta. Pode deixar de fazer compras achando que não tem dinheiro. Pior: não há indicação visual de que pendentes estão incluídos no resumo.

🔧 **SOLUÇÃO:** Separar em duas linhas ou adicionar toggle:
```js
// Opção A: Mostrar apenas pagos no resumo principal
let totalReceitas = 0, totalDespesas = 0;
let totalReceitasPendentes = 0, totalDespesasPendentes = 0;
doMes.forEach(t => {
    if (t.pago !== false) {
        if (t.tipo === 'receita') totalReceitas += t.valor; else totalDespesas += t.valor;
    } else {
        if (t.tipo === 'receita') totalReceitasPendentes += t.valor; else totalDespesasPendentes += t.valor;
    }
});
// Saldo = apenas confirmados
// Mini-texto abaixo: "+ R$ X pendente de receber, - R$ Y pendente de pagar"
```

```js
// Opção B: Toggle no card de resumo
// Default mostra apenas "realizados", botão permite alternar para "incluindo pendentes"
```

---

### 🟡 BUG 5 — `salvarEdicao()` faz parse frágil do valor em BRL

**Arquivo:** `js/extrato.js` · Linhas ~409-413  
**Severidade:** 🟡 Médio

```js
const valorStr = document.getElementById('editValor').value
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
const valor = parseFloat(valorStr);
```

**Problema:** O valor é preenchido com `toLocaleString('pt-BR', { minimumFractionDigits: 2 })` que gera, por exemplo, `"342,80"` ou `"1.342,80"`. O parse faz:
1. Remove "R$" (mas o input não tem "R$" — `toLocaleString` não adiciona o símbolo sem `style:'currency'`)
2. Remove pontos (separador de milhar)
3. Troca vírgula por ponto

**Funciona na maioria dos casos**, mas falha se:
- O usuário digitar `"R$ 342,80"` manualmente → `"R$"` é removido → ok, mas frágil
- O usuário digitar `"342.80"` (formato US) → `.` são removidos → `"34280"` → **R$ 34.280,00** (100x maior!)
- O usuário digitar apenas `"342"` → `parseFloat("342")` = 342 → ok
- O usuário digitar `"abc"` → `parseFloat("abc")` = NaN → validação `!valor` pega (NaN é falsy), mas `!0` também seria `true` → **impede salvar valor R$ 0,00**

🔧 **SOLUÇÃO:**
```js
const valorStr = document.getElementById('editValor').value
    .replace(/[^\d,.-]/g, '')  // Remove tudo que não é dígito, vírgula, ponto ou menos
    .replace(/\./g, '')        // Remove pontos (milhar BR)
    .replace(',', '.');        // Vírgula → ponto decimal
const valor = parseFloat(valorStr);
if (isNaN(valor) || valor < 0) return window.budShowToast('Valor inválido.', 'warning');
```

---

### 🟡 BUG 6 — Edição não permite trocar `conta` (forma de pagamento)

**Arquivo:** `js/extrato.js` · Modal de edição  
**Severidade:** 🟡 Médio

O modal de edição tem campos para: Descrição, Tipo, Valor, Categoria, Data.

**Faltam:**
- **`conta`** (forma de pagamento — Débito, Crédito, Pix, Dinheiro, etc.)
- **`pago`** (status — o toggle está na lista, mas não no modal)

O `salvarEdicao()` envia:
```js
await updateDoc(docRef, { descricao, tipo, valor, categoria, dataReferencia, atualizadoEm: serverTimestamp() });
```

O campo `conta` **não é atualizado**. Se o usuário criou uma despesa como "Débito" e quer mudar para "Crédito", não tem como pelo modal.

🔧 **SOLUÇÃO:** Adicionar campo `conta` no modal:
```html
<div>
    <label class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Conta</label>
    <select id="editConta" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold">
        <option value="">Não informada</option>
        <!-- Populado dinamicamente com contas da carteira -->
    </select>
</div>
```
E no `salvarEdicao()`:
```js
const conta = document.getElementById('editConta').value;
await updateDoc(docRef, { descricao, tipo, valor, categoria, conta, dataReferencia, atualizadoEm: serverTimestamp() });
```

---

### 🟡 BUG 7 — `normalizarAnoMes` é definida DENTRO de `renderizarExtrato` — recriada a cada render

**Arquivo:** `js/extrato.js` · Linhas ~422-433 (dentro de `renderizarExtrato`)  
**Severidade:** 🟡 Médio (performance)

```js
function renderizarExtrato() {
    const container = document.getElementById('listaExtrato');
    const normalizarAnoMes = (valor) => {
        // ... lógica de parse de data
    };
    // ...
}
```

**Problema:** A função `normalizarAnoMes` é re-definida a cada chamada de `renderizarExtrato`. Com 5000 transações e qualquer re-render (busca, filtro, toggle), uma nova closure é criada. Não é catastrófico, mas é uma prática ruim e desnecessária.

Além disso, `normalizarAnoMes` aceita formato BR (`"08/04/2026"`) e `Date` objects, mas:
- As transações do Firestore sempre têm `dataReferencia` como string ISO (`"2026-04-08"`)
- O formato BR nunca é usado
- `Date` objects nunca são armazenados como `dataReferencia`

Os dois ramos extras são dead code.

🔧 **SOLUÇÃO:** Mover para escopo do módulo e simplificar:
```js
// No topo do arquivo (escopo do módulo)
function getAnoMes(dataRef) {
    if (!dataRef || typeof dataRef !== 'string') return null;
    const m = dataRef.match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : null;
}
```

---

### 🟡 BUG 8 — Downgrade não é persistido no Firestore (diferente de `categorias.js`)

**Arquivo:** `js/extrato.js` · Linhas ~612-616  
**Severidade:** 🟡 Médio

```js
const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
_planoUsuario = userSnap.exists() ? userSnap.data() : { plano: 'free' };

if (window.NexoPlanos) {
    const resolved = window.NexoPlanos.resolvePlan(_planoUsuario);
    if (resolved.shouldDowngrade) { _planoUsuario.plano = 'free'; }
    // ← Só muda a variável local. NÃO faz updateDoc!
}
```

**Contraste com `categorias.js`:**
```js
// categorias.js faz updateDoc:
if (resolvedPlan.shouldDowngrade) {
    await updateDoc(doc(db, 'usuarios', user.uid), {
        plano: 'free', downgradeMotivo: ..., downgradeEm: ...
    });
}
```

**Problema:** Se o plano expirou e o usuário abre o extrato ANTES de abrir categorias, o downgrade **não é persistido**. A variável local muda para 'free', mas o Firestore mantém 'pro'. Ao recarregar, o plano volta a ser 'pro' até a próxima verificação.

Além disso, este arquivo usa `window.NexoPlanos.resolvePlan()` em vez de `window.BudPlanUtils.resolvePlanSafely()` — API diferente.

🔧 **SOLUÇÃO:** Uniformizar e persistir:
```js
if (window.NexoPlanos || (window.BudPlanUtils && window.BudPlanUtils.resolvePlanSafely)) {
    const resolved = window.BudPlanUtils 
        ? window.BudPlanUtils.resolvePlanSafely(_planoUsuario)
        : window.NexoPlanos.resolvePlan(_planoUsuario);
    if (resolved.shouldDowngrade) {
        _planoUsuario.plano = 'free';
        try {
            await updateDoc(doc(db, 'usuarios', user.uid), {
                plano: 'free',
                downgradeMotivo: resolved.downgradeReason || 'plan_rules',
                downgradeEm: serverTimestamp()
            });
        } catch (e) { console.error('Downgrade falhou:', e); }
    }
}
```

---

### 🟡 BUG 9 — `estiloCategorias` é código morto — nunca referenciado

**Arquivo:** `js/extrato.js` · Linhas ~101-104  
**Severidade:** 🟡 Baixo (dead code)

```js
const estiloCategorias = {
    'Alimentação': '🍔', 'Moradia': '🏠', 'Transporte': '🚗', 
    'Lazer': '🎉', 'Saúde': '💊', 'Salário': '💰', 'Outros': '🏷️'
};
```

**Problema:** Este objeto **nunca é referenciado** em nenhum lugar do arquivo. É provavelmente um resquício de uma versão anterior quando as categorias eram genéricas (7 categorias) em vez do sistema atual (51+). `getEmojiExtrato()` usa `catEmojiMapExtrato`, não este objeto.

🔧 **SOLUÇÃO:** Remover as 4 linhas.

---

### 🟡 BUG 10 — `onSnapshot` dispara `renderizarExtrato()` 2x na inicialização

**Arquivo:** `js/extrato.js` · Linhas ~620-640  
**Severidade:** 🟡 Médio (performance)

```js
// Listener 1: categorias
_unsubs.push(onSnapshot(categoriasRef, (snap) => {
    categoriasCustom = snap.docs.map(d => d.data());
    renderizarExtrato();  // ← RENDER 1
}));

// Listener 2: transações
_unsubs.push(onSnapshot(transacoesRef, (snapshot) => {
    // ...
    renderizarExtrato();  // ← RENDER 2
}));
```

**Problema:** Na inicialização, ambos os `onSnapshot` disparam quase simultaneamente. Cada um chama `renderizarExtrato()`. O primeiro render acontece com `transacoesGlobais = []` (ainda vazio), mostrando "Nenhuma transação" por um frame. O segundo render mostra as transações corretas.

**Impacto:** Flash de "Nenhuma transação encontrada" por ~100ms antes dos dados aparecerem. Pode confundir o usuário momentaneamente.

🔧 **SOLUÇÃO:** Usar flag de carregamento:
```js
let _dadosCarregados = { categorias: false, transacoes: false };

_unsubs.push(onSnapshot(categoriasRef, (snap) => {
    categoriasCustom = snap.docs.map(d => d.data());
    _dadosCarregados.categorias = true;
    if (_dadosCarregados.transacoes) renderizarExtrato();
}));

_unsubs.push(onSnapshot(transacoesRef, (snapshot) => {
    // ...
    _dadosCarregados.transacoes = true;
    if (_dadosCarregados.categorias) renderizarExtrato();
    else renderizarExtrato(); // Renderiza mesmo assim mas aceita que categorias podem chegar depois
}));
```

Ou mais simples — renderizar apenas no listener de transações, que é o principal:
```js
_unsubs.push(onSnapshot(categoriasRef, (snap) => {
    categoriasCustom = snap.docs.map(d => d.data());
    if (transacoesGlobais.length > 0) renderizarExtrato(); // Só re-renderiza se já tem dados
}));
```

---

### 🟡 BUG 11 — `sincronizarDados()` e `atualizarFiltros()` são aliases sem valor

**Arquivo:** `js/extrato.js` · Linhas ~114-115  
**Severidade:** 🟡 Baixo (arquitetural)

```js
window.sincronizarDados = function() { renderizarExtrato(); };
window.atualizarFiltros = function() { renderizarExtrato(); };
```

**Problema:** Ambas são wrappers de uma linha para `renderizarExtrato()`. Como os dados já são real-time via `onSnapshot`, "sincronizar" apenas re-renderiza o mesmo array. `atualizarFiltros` é chamada pelo `oninput` do campo de busca — poderia ter debounce.

🔧 **SOLUÇÃO para busca com debounce:**
```js
let _buscaTimer = null;
window.atualizarFiltros = function() {
    clearTimeout(_buscaTimer);
    _buscaTimer = setTimeout(() => renderizarExtrato(), 200);
};
```

---

### 🟡 BUG 12 — Modal de edição preenche valor com `toLocaleString` sem "R$" mas parse espera "R$"

**Arquivo:** `js/extrato.js` · Linhas ~390, ~410  
**Severidade:** 🟡 Médio

Abertura do modal:
```js
document.getElementById('editValor').value = (t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
// Resultado: "342,80" ou "1.342,80" (sem "R$")
```

Salvamento:
```js
const valorStr = document.getElementById('editValor').value
    .replace('R$', '')  // ← Remove "R$" que NÃO existe no valor formatado
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
```

**Problema:** O `.replace('R$', '')` não faz nada porque o valor nunca tem "R$". Funciona por acidente. Mas se o usuário digitar "R$ 500,00" manualmente (padrão BRL), o replace tira "R$" e funciona. Porém se digitar "R$500" (sem espaço), o replace gera "500" → ok.

Não é um bug funcional, mas é código inconsistente que dificulta manutenção.

🔧 **SOLUÇÃO:** Já coberta no BUG 5 com regex mais robusta.

---

### 🟢 BUG 13 — Exportação PDF pode ser bloqueada por popup blocker

**Arquivo:** `js/extrato.js` · Linha ~310  
**Severidade:** 🟢 Baixo

```js
const win = window.open('', '_blank');
if (!win) { window.budShowToast('Permita pop-ups para exportar o PDF.', 'warning'); return; }
win.document.write(html);
```

**Problema:** Navegadores mobile (Chrome, Safari) frequentemente bloqueiam `window.open()` por padrão. A mensagem "Permita pop-ups" é exibida, mas muitos usuários não sabem como habilitar pop-ups no celular.

🔧 **SOLUÇÃO:** Alternativa sem pop-up:
```js
// Opção A: Usar Blob + download (gera HTML para imprimir offline)
const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = `extrato-${mesAno}.html`; a.click();
URL.revokeObjectURL(url);

// Opção B: Usar iframe hidden
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
document.body.appendChild(iframe);
iframe.contentDocument.write(html);
iframe.contentDocument.close();
iframe.contentWindow.print();
setTimeout(() => iframe.remove(), 1000);
```

---

### 🟢 BUG 14 — `catEmojiMapExtrato` duplica informação do array + pode divergir

**Arquivo:** `js/extrato.js` · Linhas ~84-100  
**Severidade:** 🟢 Baixo (manutenção)

```js
const catEmojiMapExtrato = {
    'Salário':'💰','Férias':'🏖️','13º Salário':'🎄',
    // ... 53 mapeamentos
};
```

**Problema:** Este mapa nome→emoji é uma **duplicação** da informação que já existe em `categorias.js` como `{ nome, emoji }`. Se um emoji for alterado na tela de categorias, este mapa não atualiza automaticamente. Exemplo: na tela de categorias "Presentes" tem emoji 🎁, e "Bônus/PLR" também tem 🎁 — mas este mapa poderia divergir.

🔧 **SOLUÇÃO:** Parte da centralização em `categorias-padrao.js`:
```js
// categorias-padrao.js
window.BUD_CATEGORIAS_PADRAO = {
    despesa: [ { nome: 'Aluguel', emoji: '🏠' }, ... ],
    receita: [ { nome: 'Salário', emoji: '💰' }, ... ]
};

// Em qualquer tela:
function getEmoji(nomeCategoria) {
    const todas = [...BUD_CATEGORIAS_PADRAO.despesa, ...BUD_CATEGORIAS_PADRAO.receita];
    return todas.find(c => c.nome === nomeCategoria)?.emoji || '📦';
}
```

---

### 🟢 BUG 15 — Badge `PENDENTE` só aparece se a data for futura ou hoje

**Arquivo:** `js/extrato.js` · Linha ~545  
**Severidade:** 🟢 Baixo (lógica questionável)

```js
const dataRefDate = t.dataReferencia ? new Date(t.dataReferencia + 'T12:00:00') : null;
const ehFuturaOuHoje = dataRefDate && dataRefDate >= new Date(new Date().setHours(0,0,0,0));
const pendenteBadge = (!isPago && ehFuturaOuHoje) ? '<span class="bg-amber-100 text-amber-600 ...">⏳ PENDENTE</span>' : '';
```

**Problema:** Uma transação com `pago: false` e data **passada** (ex: aluguel de março ainda não pago em abril) **não** mostra a badge PENDENTE. Para o usuário, parece que a transação está "paga" (sem indicação visual de pendência), mas o toggle está desligado.

**Impacto:** Transações atrasadas não recebem destaque visual. O usuário pode esquecer de pagar um boleto de março se não perceber o toggle desligado.

🔧 **SOLUÇÃO:** Mostrar badge diferenciada para atrasados:
```js
const pendenteBadge = !isPago 
    ? (ehFuturaOuHoje 
        ? '<span class="bg-amber-100 text-amber-600 ...">⏳ PENDENTE</span>'
        : '<span class="bg-red-100 text-red-600 ...">⚠️ ATRASADA</span>')
    : '';
```

---

### 🟢 BUG 16 — `renderizarExtrato` reconstrói TODO o DOM a cada mudança

**Arquivo:** `js/extrato.js` · Linhas ~420-600  
**Severidade:** 🟢 Baixo (performance)

```js
function renderizarExtrato() {
    const container = document.getElementById('listaExtrato');
    // ... filtra, agrupa
    let html = '';
    // ... monta string HTML completa
    container.innerHTML = html;
}
```

**Problema:** Cada alteração (toggle pago, busca, filtro, mudança de mês) reconstrói o innerHTML inteiro do container. Com 100+ transações no mês, isso significa parsear e injetar ~100 cards HTML. O `onSnapshot` de transações chama `renderizarExtrato()` — se o usuário marcar uma transação como paga, TODO o extrato é reconstruído (incluindo scroll position sendo perdida).

**Impacto:** Scroll volta ao topo após marcar como pago. Flash de re-render visível.

🔧 **SOLUÇÃO MÍNIMA:** Preservar scroll position:
```js
function renderizarExtrato() {
    const container = document.getElementById('listaExtrato');
    const scrollTop = container.parentElement.scrollTop; // Salvar posição
    // ... build html
    container.innerHTML = html;
    container.parentElement.scrollTop = scrollTop; // Restaurar
}
```

**SOLUÇÃO IDEAL:** Para `alterarStatus`, atualizar apenas o toggle sem re-render completo.

---

### 🟢 BUG 17 — `exportarPDF` usa `escapeHTML` nos dados mas não sanitiza o logo SVG

**Arquivo:** `js/extrato.js` · Linhas ~155-165  
**Severidade:** 🟢 Baixo (segurança teórica)

```js
const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" ...>...</svg>`;
// ... usado diretamente no template HTML
```

O SVG do logo é **hardcoded** no JS — não vem de dados do usuário, então não é um vetor de XSS real. Porém, o `document.write()` na nova janela é potencialmente perigoso se algum campo do template vier do usuário sem sanitização.

Na prática, `escapeHTML` é usado em `t.descricao` e `t.categoria` dentro do `rowsHTML` — **está OK**. Este bug é apenas um lembrete arquitetural.

🔧 **SOLUÇÃO:** Sem ação necessária — o `escapeHTML` já cobre os dados dinâmicos.

---

## ✅ Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)
- [ ] **BUG 1** — Trocar `className` por `style.cssText` no overlay de exclusão
- [ ] **BUG 2** — Reduzir query de `limit(5000)` para filtro por mês server-side (ou mínimo limitar a 12 meses)
- [ ] **BUG 3** — Unificar `categsPadrao` com `categorias.js` — resolver divergência 51 vs 48
- [ ] **BUG 4** — Resumo mensal deve separar transações pagas vs pendentes

### 🟡 Médio (corrigir em breve)
- [ ] **BUG 5** — Parse de valor mais robusto com regex + validação NaN
- [ ] **BUG 6** — Adicionar campo `conta` (forma de pagamento) no modal de edição
- [ ] **BUG 7** — Mover `normalizarAnoMes` para fora de `renderizarExtrato`, remover dead code
- [ ] **BUG 8** — Persistir downgrade no Firestore + uniformizar API (NexoPlanos vs BudPlanUtils)
- [ ] **BUG 9** — Remover `estiloCategorias` (código morto)
- [ ] **BUG 10** — Evitar double-render na inicialização (flag de carregamento)
- [ ] **BUG 11** — Debounce na busca textual (200ms)
- [ ] **BUG 12** — Corrigir parse de valor (redundante com BUG 5)

### 🟢 Baixo (melhorias opcionais)
- [ ] **BUG 13** — Alternativa ao popup para PDF (iframe ou blob download)
- [ ] **BUG 14** — Centralizar mapa de emojis com `categorias-padrao.js`
- [ ] **BUG 15** — Badge "ATRASADA" para transações pendentes do passado
- [ ] **BUG 16** — Preservar scroll position no re-render
- [ ] **BUG 17** — Sem ação necessária (SVG é hardcoded)

---

## 📊 Métricas da Auditoria

| Métrica | Valor |
|---|---|
| Total de bugs encontrados | **17** |
| 🔴 Críticos | 4 |
| 🟡 Médios | 8 |
| 🟢 Baixos | 5 |
| Linhas analisadas | 868 (220 HTML + 648 JS) |
| Categorias padrão despesa | 51 (diverge das 48 de categorias.js) |
| Categorias padrão receita | 15 (igual) |
| Emojis mapeados | 53 (catEmojiMapExtrato) |
| Modais | 3 (seletor mês, editar transação, overlay exclusão) |
| Listeners Firebase | 2 (transações limit 5000, categorias limit 200) |
| Variáveis de estado | 10 |
| Funções | 22+ |
| Código morto identificado | 2 (estiloCategorias, ramos BR/Date de normalizarAnoMes) |
| Padrões recorrentes de outras telas | 3 (overlay Tailwind, categorias duplicadas, downgrade inconsistente) |

---

## 💚 Pontos Positivos

1. **`escapeHTML` consistente em TODA renderização:** Usado em `t.descricao`, `t.categoria`, datas, e em ambos os exports (CSV com `""` escaping, PDF com escapeHTML). Proteção XSS completa.

2. **Dois onSnapshot com cleanup correto:** `_unsubs` array acumula funções de unsubscribe, e `_unsubs.forEach(fn=>fn())` é chamado no início do `onAuthStateChanged` — sem leak de listeners.

3. **Toggle pago/pendente inline:** Switch visual bonito no card da transação, com `onchange` direto para `alterarStatus`. Atualização imediata via onSnapshot — o toggle reflete o estado real do Firestore.

4. **Exportação CSV completa:** BOM UTF-8, separador `;` (compatível Excel BR), aspas em campos com texto, sinal `-` para despesas, status pago/pendente. Arquivo nomeado por mês.

5. **Exportação PDF branded e profissional:** Logo SVG, resumo com cards coloridos, tabela agrupada por dia com emojis, badges IMPORT/REC, footer com data/hora, print-optimized CSS. Nível de qualidade visual impressionante para um PDF gerado client-side.

6. **Filtros combinados poderosos:** Status (3 opções) + Busca textual (por descrição ou categoria) + Filtro por categoria (dropdown dinâmico com emojis) + Mês (navegador ou seletor mobile). Todos funcionam em conjunto.

7. **Seletor de mês mobile com bottom-sheet:** UX nativa — `animate-slide-up`, drag handle, grid de 3 colunas para os 12 meses, navegação de ano com setas. Fecha ao clicar fora.

8. **Badges informativas:** `IMPORT` (azul), `REC` (roxo), `⏳ PENDENTE` (amber) — dão contexto visual imediato sobre a origem e status da transação.

9. **Dropdown de categorias com emojis:** Tanto no filtro principal quanto no modal de edição. Dropdown customizado (não `<select>`) com scroll, hover states, e emojis que ajudam a identificar rapidamente.

10. **`budShowToast` global:** Usa o toast do `bud-utils.js` (diferente da tela de categorias que tem toast local). Consistente com o resto do app.

11. **Agrupamento por dia com subtotais:** Cada dia mostra "+R$ receitas" e "-R$ despesas" no header, facilitando a leitura rápida do fluxo diário.

12. **Valores ocultáveis (olhinho):** Toggle que substitui valores por "R$ •••••" — privacidade em locais públicos. Funciona tanto na lista quanto no resumo.
