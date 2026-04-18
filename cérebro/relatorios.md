# 📊 Tela: Relatórios

## 📋 Visão Geral

A tela **Relatórios** (`relatorios.html`) é uma **consolidação de 3 telas** em um só lugar via abas:

1. **Aba Resumo** — Idêntica à tela `balanco-mensal.html`: cards de totais, barra comparativa receitas vs despesas, detalhamento por categoria, e dia a dia
2. **Aba Gráficos** — Idêntica à tela `graficos.html`: doughnut de despesas por categoria, bar receitas vs despesas, line tendência 6 meses, bar gastos diários
3. **Aba Detalhamento** — Despesas por categoria com barras de progresso e percentuais

A ideia é fornecer uma visão **360° das finanças do mês** em um lugar centralizado, sem precisar navegar entre balanço e gráficos separadamente. Porém, as telas individuais (`balanco-mensal.html` e `graficos.html`) continuam existindo como páginas separadas (108 e 139 linhas, respectivamente + JS próprios de 135 e 139 linhas).

| Item | Detalhe |
|---|---|
| **Arquivo HTML** | `relatorios.html` (183 linhas) |
| **Arquivo JS** | `js/relatorios.js` (270 linhas) |
| **Coleção Firestore** | `usuarios/{uid}/transacoes` (leitura) |
| **Dependências** | Chart.js 4.4.1 (CDN), Firebase Auth/Firestore, `bud-utils.js`, `bud-loader.js`, `sidebar.js`, `dark-mode.js`, `tutorial*.js` (3), `plano-config.js` |
| **Tipo de módulo** | ES Module (`type="module"`) |
| **CDN externo** | `chart.js@4.4.1` via jsdelivr |
| **Modais** | 1 — Seletor de Mês mobile |
| **Tamanho total** | 453 linhas (183 HTML + 270 JS) |

### Relação com outras telas

| Tela | Relação |
|---|---|
| `balanco-mensal.html` | **Duplicada** — Aba "Resumo" é cópia quase idêntica |
| `graficos.html` | **Duplicada** — Aba "Gráficos" é cópia quase idêntica |
| `dashboard.html` | Mostra resumo simplificado do mês — relatórios expande |
| `extrato.html` | Lê as mesmas transações — extrato é lista, relatórios é análise |
| `comparativo.html` | Compara meses — relatórios mostra 1 mês + tendência 6 meses |

---

## 🗄️ Estrutura de Dados (Firestore)

### Documento: `usuarios/{uid}/transacoes/{id}` (leitura)

```js
{
  tipo: "despesa",                    // "despesa" ou "receita"
  descricao: "Supermercado Assaí",    // string
  valor: 342.80,                      // number — positivo
  categoria: "Mercado",               // string
  dataReferencia: "2026-04-08",       // string ISO
  pago: true,                         // boolean
  // + demais campos (conta, origem, etc. — não usados nesta tela)
}
```

### Dados carregados

A tela carrega `transacoes` via `onSnapshot` com `limit(5000)` — **todas** as transações do usuário em memória.

**NÃO carrega:**
- Categorias customizadas (ao contrário do extrato!)
- Contas/carteira
- Metas, limites, etc.

### `estiloCategorias` (hardcoded — 7 categorias genéricas)

```js
const estiloCategorias = {
    'Alimentação': { icon: '🍔', color: 'from-orange-400 to-orange-500' },
    'Moradia':     { icon: '🏠', color: 'from-blue-500 to-blue-600' },
    'Transporte':  { icon: '🚗', color: 'from-emerald-400 to-emerald-500' },
    'Lazer':       { icon: '🎉', color: 'from-purple-400 to-purple-500' },
    'Saúde':       { icon: '💊', color: 'from-rose-400 to-rose-500' },
    'Outros':      { icon: '🏷️', color: 'from-slate-400 to-slate-500' },
    'Padrão':      { icon: '💳', color: 'from-indigo-400 to-indigo-500' }
};
```

⚠️ **Problema duplo:**
1. O app tem **51+ categorias** de despesa. Apenas 5 são mapeadas. Todas as outras caem em `'Padrão'` (💳 indigo).
2. **5 de 7 gradientes** usam classes Tailwind que **não existem em nenhum HTML** do projeto (confirmado via busca): `from-orange-400`, `from-purple-400`, `from-rose-400`, `from-slate-400`, `from-indigo-400`. Só `from-emerald-400` e `from-blue-500` existem no build.

### Paleta de cores dos gráficos

```js
const cores = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
    '#84cc16', '#e11d48'
];
```

12 cores hex para Chart.js. Se houver mais de 12 categorias em um mês, as cores reciclam (Chart.js usa módulo internamente).

---

## 🏗️ Estrutura do HTML

### Layout Geral

```
<body> (flex, overflow-hidden, 100dvh)
├── #mobileOverlay (bg-slate-900/40, backdrop-blur, z-40, hidden)
├── #sidebar-container
└── <main> (flex-1, flex-col, overflow-y-auto, z-10)
    ├── <header> (h-20, bg-white, border-b, sticky top-0, z-30)
    │   ├── Hamburger (md:hidden) → toggleSidebar()
    │   ├── Olhinho 👁️ (md:hidden) → toggleOcultarValores()
    │   ├── Refresh 🔄 (md:hidden) → sincronizarDados()
    │   ├── Título "📊 Relatórios"
    │   ├── Nav de mês (hidden md:flex) → mudarMes(±1)
    │   │   └── < [#textoMes] >
    │   └── Calendário 📅 (md:hidden) → abrirSeletorMes()
    └── <div> (p-4 md:p-8, max-w-5xl, space-y-6, pb-20)
        │
        ├── Abas (pill bar, 3 botões full-width)
        │   ├── [Resumo] #abaResumo → trocarAba('resumo')
        │   ├── [Gráficos] #abaGraficos → trocarAba('graficos')
        │   └── [Detalhamento] #abaDetalhamento → trocarAba('detalhamento')
        │
        ├── ══════ #painelResumo ══════
        │   ├── Grid 3 cards
        │   │   ├── Total Receitas (#totalReceitas) — emerald
        │   │   ├── Total Despesas (#totalDespesas) — red
        │   │   └── Saldo do Mês (#saldoMes) — blue/red
        │   ├── Receitas vs Despesas (barras horizontais)
        │   │   ├── Barra Receitas (#barraReceita) + % (#percReceita)
        │   │   └── Barra Despesas (#barraDespesa) + % (#percDespesa)
        │   ├── Detalhamento por Categoria (#detalhamentoContainer)
        │   │   └── Barra horizontal por categoria (nome + valor)
        │   └── Dia a Dia (#diaAdiaContainer)
        │       └── Cards por dia: receita + despesa + saldo diário
        │
        ├── ══════ #painelGraficos (hidden) ══════
        │   ├── Grid 2 cols
        │   │   ├── 🍩 Doughnut: Despesas por Categoria (#chartCategoria)
        │   │   └── ⚖️ Bar: Receitas vs Despesas (#chartReceitaDespesa)
        │   ├── 📈 Line: Tendência 6 Meses (#chartTendencia)
        │   └── 📅 Bar: Gastos por Dia do Mês (#chartDiario)
        │
        └── ══════ #painelDetalhamento (hidden) ══════
            └── glass-card
                ├── Header: "Despesas por Categoria (Geral)" + Total (#totalDespesasGeral)
                └── #container-categorias
                    └── Barra de progresso por categoria (ícone + nome + valor + %)
```

### Modal Seletor de Mês (`#modalSeletorMes`)

```
#modalSeletorMes (fixed, inset-0, bg-slate-900/60, z-[70])
└── <div> (bg-white, max-w-md, rounded-t-[2rem], animate-slide-up)
    ├── Drag handle
    ├── Nav ano: < [#anoSeletorMes] > → mudarAnoSeletor(±1)
    ├── #gridMesesSeletor (grid-cols-3, 12 botões)
    └── Cancelar → fecharSeletorMes()
```

### CSS Customizado

| Classe/Seletor | Propósito |
|---|---|
| `.glass-panel` | Backdrop-blur + borda sutil — **não usado no header** (header usa bg-white puro) |
| `.glass-card` | Background 70% branco, blur 20px — usado na aba Detalhamento |
| `.icon-3d` | Drop-shadow nos emojis |
| `@keyframes slide-up` | Bottom-sheet do seletor de mês |
| `.no-scrollbar` | Esconde scrollbar |

### Scripts carregados (ordem)

1. `chart.js@4.4.1` (CDN jsdelivr) — Library de gráficos
2. `firebase-config.js` — Config global
3. `bud-loader.js` — Splash screen
4. `bud-utils.js` — escapeHTML, budShowToast
5. `plano-config.js` — Configurações de plano
6. `sidebar.js` — Sidebar navegação
7. `js/relatorios.js` — **Lógica principal** (type="module")
8. `dark-mode.js` — Tema escuro
9. `tutorial.js` + `tutorial-steps.js` + `tutorial-init.js` — Tutorial

---

## 🔄 Fluxo Completo da Tela

### Inicialização

```
js/relatorios.js carrega (module):
  ├─ Inicializa Firebase App, Auth, Firestore
  ├─ Variáveis globais:
  │   ├─ valoresOcultos = false
  │   ├─ fmt(v) → formatter (R$ ••••• ou BRL)
  │   ├─ transacoes = []                ← TODAS as transações (até 5000!)
  │   ├─ dataFiltro = new Date()        ← mês/ano selecionado
  │   ├─ charts = {}                    ← instâncias Chart.js (destroy/recreate)
  │   ├─ abaAtual = 'resumo'            ← aba ativa
  │   ├─ _planoUsuario = {}
  │   ├─ estiloCategorias = { ...7 }    ← 7 categorias genéricas (!)
  │   └─ cores = [...12]                ← paleta de 12 cores para gráficos
  │
  ├─ atualizarMes()  ← renderiza "abril 2026" no header
  │
  └─ onAuthStateChanged(auth, async user):
      ├─ Limpa listeners: _unsubs.forEach(fn=>fn()); _unsubs=[]
      │
      ├─ user EXISTE:
      │   ├─ getDoc(usuarios/{uid}) → _planoUsuario
      │   ├─ NexoPlanos.resolvePlan → shouldDowngrade? → plano = 'free' (sem persist!)
      │   │
      │   └─ onSnapshot(transacoes, limit(5000)):
      │       ├─ hideSplash()
      │       ├─ transacoes = snapshot.docs (com id)
      │       └─ renderTudo()  ← renderiza a aba ativa
      │
      └─ user NÃO EXISTE → redirect index.html
```

**Diferenças do extrato:**
- **Apenas 1 onSnapshot** (transações) — não carrega categorias customizadas!
- Não tem listener de categorias personalizadas = emojis customizados não aparecem

### Fluxo: Trocar Aba

```
Clique em [Resumo] / [Gráficos] / [Detalhamento]
  └─ trocarAba(aba):
      ├─ abaAtual = aba
      ├─ Para cada aba ('resumo', 'graficos', 'detalhamento'):
      │   ├─ Toggle hidden no painel
      │   └─ Toggle CSS no botão (ativo = bg-slate-800 text-white, inativo = text-slate-600)
      └─ renderTudo()  ← RE-RENDERIZA tudo (destrói e recria gráficos!)
```

### Fluxo: Aba Resumo (`renderResumo`)

```
renderResumo():
  ├─ Filtrar por mês: transacoes → doMes (dataReferencia.startsWith(prefixo))
  │   ⚠️ NÃO filtra por pago/pendente!
  │
  ├─ Calcular:
  │   ├─ receitas (tipo === 'receita')
  │   ├─ despesas (tipo !== 'receita')
  │   ├─ porCategoria = { "Mercado": 500, "Salário": 5000, ... }
  │   │   ⚠️ MISTURA receitas + despesas no mesmo mapa!
  │   └─ porDia = { "08": { receita: X, despesa: Y }, ... }
  │
  ├─ Atualizar cards: receitas, despesas, saldo
  │   └─ Saldo: azul se ≥0, vermelho se <0
  │       ⚠️ elSaldo.className sobrescreve classes responsivas
  │
  ├─ Barras percentuais: receitas/(receitas+despesas)%, despesas/(...)%
  │
  ├─ Detalhamento por Categoria (#detalhamentoContainer):
  │   ├─ Sort por valor DESC
  │   ├─ Barra proporcional ao MAX (não ao total)
  │   └─ Mostrar nome (escapeHTML) + valor formatado
  │   ⚠️ "Salário" (receita!) aparece aqui junto com despesas!
  │   ⚠️ Sem emojis — apenas nome texto
  │
  └─ Dia a Dia (#diaAdiaContainer):
      └─ Por dia: +receita, -despesa, saldo do dia
```

### Fluxo: Aba Gráficos (`renderGraficos`)

```
renderGraficos():
  ├─ Filtrar doMes (mesmo filtro)
  │
  ├─ Calcular:
  │   ├─ receitas, despesas
  │   ├─ porCategoria = { ... } ← SÓ DESPESAS (correto aqui!)
  │   └─ porDia = { ... } ← SÓ DESPESAS para o gráfico diário
  │
  ├─ 🍩 Doughnut — Despesas por Categoria:
  │   ├─ destroyChart('cat')
  │   └─ charts['cat'] = new Chart({type:'doughnut', ...})
  │
  ├─ ⚖️ Bar — Receitas vs Despesas:
  │   ├─ destroyChart('rd')
  │   └─ charts['rd'] = new Chart({type:'bar', ...})
  │
  ├─ 📈 Line — Tendência 6 Meses:
  │   ├─ destroyChart('tend')
  │   ├─ Loop i=5→0: para cada mês anterior:
  │   │   ├─ Gerar prefixo "YYYY-MM"
  │   │   └─ transacoes.filter() completo por mês → somar receitas/despesas
  │   │   ⚠️ FILTRA TODO o array (até 5000) 6x!
  │   └─ charts['tend'] = new Chart({type:'line', ...})
  │
  └─ 📅 Bar — Gastos por Dia:
      ├─ destroyChart('dia')
      └─ charts['dia'] = new Chart({type:'bar', ...})
```

### Fluxo: Aba Detalhamento (`renderDetalhamento`)

```
renderDetalhamento():
  ├─ Filtrar doMes
  ├─ Calcular somaPorCategoria — SÓ DESPESAS (correto!)
  ├─ totalDespesasGeral → header
  │
  ├─ Se 0 despesas → emoji 🏆 "Nenhuma despesa registrada"
  │
  └─ Para cada categoria (sort valor DESC):
      ├─ % = (valor / totalDespesas) * 100
      ├─ estilo = estiloCategorias[nome] || estiloCategorias['Padrão']
      │   ⚠️ Quase TUDO cai em 'Padrão' (💳 indigo)
      │   ⚠️ 5/7 gradientes NÃO existem no build Tailwind estático!
      └─ Barra de progresso: ícone + nome + valor + %
```

---

## ⚙️ Funções Principais — Detalhamento

| Função | Linha | Escopo | Descrição |
|---|---|---|---|
| `fmt(v)` | ~13 | local | Formatter: `valoresOcultos ? 'R$ •••••' : toLocaleString(BRL)` |
| `atualizarMes()` | ~35 | local | Renderiza "abril 2026" no header |
| `mudarMes(d)` | ~36 | `window` | ±1 mês, atualiza texto, renderTudo() |
| `toggleOcultarValores()` | ~37 | `window` | Toggle olhinho → renderTudo() |
| `sincronizarDados()` | ~38 | `window` | Apenas renderTudo() (sem re-fetch) |
| `abrirSeletorMes()` | ~42 | `window` | Abre modal mês mobile |
| `fecharSeletorMes()` | ~43 | `window` | Fecha modal |
| `mudarAnoSeletor(dir)` | ~44 | `window` | ±1 ano no seletor |
| `renderizarGridMeses()` | ~45 | local | 12 botões Jan-Dez com highlight |
| `selecionarMes(mes)` | ~51 | `window` | Seta mês, renderTudo, fecha modal |
| `trocarAba(aba)` | ~54 | `window` | Toggle panéis + CSS botões + renderTudo() |
| `destroyChart(id)` | ~65 | local | Destrói instância Chart.js pelo key |
| `renderTudo()` | ~67 | local | Dispatch: renderResumo/renderGraficos/renderDetalhamento |
| `renderResumo()` | ~73 | local | **Resumo completo** — cards, barras, categorias, dia a dia |
| `renderGraficos()` | ~131 | local | **4 gráficos** Chart.js — doughnut, bar, line, bar diário |
| `renderDetalhamento()` | ~207 | local | **Barras de progresso** por categoria de despesa |

### Variáveis de Estado

| Variável | Tipo | Valor Inicial | Uso |
|---|---|---|---|
| `valoresOcultos` | `boolean` | `false` | Toggle olhinho |
| `transacoes` | `array` | `[]` | TODAS as transações (até 5000!) |
| `dataFiltro` | `Date` | `new Date()` | Mês/ano selecionado |
| `charts` | `object` | `{}` | Map de instâncias Chart.js por key |
| `abaAtual` | `string` | `'resumo'` | Aba ativa |
| `_planoUsuario` | `object` | `{}` | Dados do plano |
| `cores` | `array` | `[...12]` | Paleta de cores Chart.js |
| `estiloCategorias` | `object` | `{...7}` | Mapa genérico ícone+gradiente |
| `anoSeletor` | `number` | `new Date().getFullYear()` | Ano no modal mês |
| `_unsubs` | `array` | `[]` | Cleanup de listeners |

---

## 🐛 Auditoria de Bugs, Incoerências e Melhorias

### 🔴 BUG 1 — "Detalhamento por Categoria" no Resumo mistura receitas e despesas

**Arquivo:** `js/relatorios.js` · Linhas ~80-84  
**Severidade:** 🔴 Crítico (dados confusos)

```js
doMes.forEach(t => {
    if(t.tipo === 'receita') receitas += t.valor;
    else despesas += t.valor;
    const cat = t.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat]||0) + t.valor;  // ← TUDO vai pro mesmo mapa!
    // ...
});
```

**Problema:** O mapa `porCategoria` acumula **todas** as transações sem filtrar por tipo. Resultado visual na seção "Detalhamento por Categoria":

```
Salário      ████████████████████████████████████████  R$ 5.000,00
Mercado      ████                                       R$ 500,00
Restaurante  ██                                         R$ 250,00
```

"Salário" (receita) domina a lista e esconde as despesas. A barra é proporcional ao MAX — então "Mercado" (que é a maior despesa) mostra uma barra minúscula comparada ao salário.

**Contraste:** A aba "Gráficos" filtra corretamente `if(t.tipo!=='receita')` para o doughnut. A aba "Detalhamento" filtra corretamente `if(t.tipo === 'despesa')`. Apenas o Resumo mistura.

**Impacto:** Usuário não consegue ver o peso relativo das despesas. A visualização principal da tela é inútil para análise de gastos.

🔧 **SOLUÇÃO:**
```js
doMes.forEach(t => {
    if(t.tipo === 'receita') receitas += t.valor;
    else {
        despesas += t.valor;
        const cat = t.categoria || 'Outros';
        porCategoria[cat] = (porCategoria[cat]||0) + t.valor;  // ← Só despesas
    }
    // porDia continua com ambos...
});
```

---

### 🔴 BUG 2 — `estiloCategorias` usa 5 gradientes Tailwind que NÃO existem no build estático

**Arquivo:** `js/relatorios.js` · Linhas ~22-30  
**Severidade:** 🔴 Crítico (visual)

```js
const estiloCategorias = {
    'Alimentação': { icon: '🍔', color: 'from-orange-400 to-orange-500' },  // ❌ Não existe
    'Moradia':     { icon: '🏠', color: 'from-blue-500 to-blue-600' },      // ⚠️ Parcial
    'Transporte':  { icon: '🚗', color: 'from-emerald-400 to-emerald-500' },// ✅ Existe
    'Lazer':       { icon: '🎉', color: 'from-purple-400 to-purple-500' },  // ❌ Não existe
    'Saúde':       { icon: '💊', color: 'from-rose-400 to-rose-500' },      // ❌ Não existe
    'Outros':      { icon: '🏷️', color: 'from-slate-400 to-slate-500' },   // ❌ Não existe
    'Padrão':      { icon: '💳', color: 'from-indigo-400 to-indigo-500' }   // ❌ Não existe
};
```

E no template:
```js
`<div class="bg-gradient-to-r ${estilo.color} h-full rounded-full shadow-sm ...">`
```

**Verificação via busca:** `from-orange-400`, `from-purple-400`, `from-rose-400`, `from-slate-400`, `from-indigo-400` **não aparecem em nenhum arquivo HTML** do projeto. Portanto, **não estão compiladas no `tailwind.css`**.

**Resultado:** Na aba Detalhamento, as barras de progresso de **quase todas** as categorias ficam **sem cor** (div vazio, background transparente). Apenas "Transporte" (emerald) aparece corretamente. "Moradia" pode funcionar parcialmente.

O fallback `'Padrão'` (indigo) também não funciona — então as 44+ categorias que caem nele ficam invisíveis.

🔧 **SOLUÇÃO:** Usar cores inline (hex/rgba):
```js
const estiloCategorias = {
    'Alimentação': { icon: '🍔', color: '#f97316' },
    'Moradia':     { icon: '🏠', color: '#3b82f6' },
    'Transporte':  { icon: '🚗', color: '#10b981' },
    'Lazer':       { icon: '🎉', color: '#8b5cf6' },
    'Saúde':       { icon: '💊', color: '#f43f5e' },
    'Outros':      { icon: '🏷️', color: '#94a3b8' },
    'Padrão':      { icon: '💳', color: '#6366f1' }
};

// No template — trocar gradient class por style inline:
`<div style="background:${estilo.color};width:${porcentagem}%" class="h-full rounded-full shadow-sm transition-all duration-1000"></div>`
```

---

### 🔴 BUG 3 — `estiloCategorias` cobre apenas 6 de 51+ categorias reais

**Arquivo:** `js/relatorios.js` · Linhas ~22-30  
**Severidade:** 🔴 Crítico (UX)

O mapa tem:
- `Alimentação` — **não é uma categoria real** do app! As categorias de despesa não incluem "Alimentação" como nome exato. Existem: Mercado, Delivery/Ifood, Restaurante, Padaria/Café.
- `Moradia` — **também não existe** como nome de categoria. Existem: Aluguel, Condomínio.
- `Transporte` — **não existe**. Existem: Combustível, Uber/Táxi, Ônibus/Metrô.
- `Lazer` — **não existe**. Existem: Cinema/Teatro, Shows/Eventos, Bares/Baladas.
- `Saúde` — **não existe**. Existem: Plano de Saúde, Farmácia, Consultas/Exames.
- `Outros` — ✅ existe

**Resultado:** Das 6 categorias mapeadas (excluindo Padrão), **apenas "Outros"** corresponde a uma categoria real. As 5 restantes **nunca são matchadas** porque os nomes não correspondem. **100% das categorias reais caem em "Padrão".**

🔧 **SOLUÇÃO:** Usar o `catEmojiMapExtrato` do extrato (53 categorias) ou o futuro `categorias-padrao.js` centralizado. Cada categoria real deve ter seu emoji e cor:
```js
function getEstiloCategoria(nome) {
    const emojiMap = window.BUD_CATEGORIAS_PADRAO || catEmojiMapExtrato;
    const emoji = emojiMap[nome] || '📦';
    const idx = Object.keys(emojiMap).indexOf(nome);
    const cor = cores[idx % cores.length] || '#6366f1';
    return { icon: emoji, color: cor };
}
```

---

### 🔴 BUG 4 — `limit(5000)` carrega TODAS as transações — idêntico ao extrato

**Arquivo:** `js/relatorios.js` · Linha ~259  
**Severidade:** 🔴 Crítico (performance/custo)

```js
_unsubs.push(onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
    transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
    renderTudo();
}));
```

**Problema:** Idêntico ao BUG 2 do `extrato.md`. 5000 documentos baixados para filtrar apenas 1 mês no Resumo e Detalhamento.

**Agravante específico:** O gráfico de "Tendência 6 meses" precisa de dados de 6 meses — mas só 6, não 5000 transações de todos os tempos.

🔧 **SOLUÇÃO:** Query server-side para os últimos 6 meses (cobre todas as abas):
```js
const seisAtras = new Date();
seisAtras.setMonth(seisAtras.getMonth() - 6);
const limiteInferior = `${seisAtras.getFullYear()}-${String(seisAtras.getMonth()+1).padStart(2,'0')}-01`;

const q = query(
    collection(db, "usuarios", user.uid, "transacoes"),
    where("dataReferencia", ">=", limiteInferior),
    orderBy("dataReferencia", "desc")
);
```

---

### 🔴 BUG 5 — Resumo inclui transações pendentes (pago=false) nos totais

**Arquivo:** `js/relatorios.js` · Linhas ~76-84  
**Severidade:** 🔴 Crítico (dados financeiros errados)

```js
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
// ← Não filtra por pago!

doMes.forEach(t => {
    if(t.tipo === 'receita') receitas += t.valor;
    else despesas += t.valor;
    // ...
});
```

**Problema:** Idêntico ao BUG 4 do `extrato.md`. Transações pendentes (ainda não pagas) são somadas como se fossem realizadas. Os cards "Total Receitas", "Total Despesas" e "Saldo do Mês" incluem valores que ainda não saíram/entraram da conta.

Nenhuma das 3 abas filtra por status — todos os cálculos assumem que tudo foi pago.

🔧 **SOLUÇÃO:** Filtrar ou separar:
```js
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
const realizados = doMes.filter(t => t.pago !== false);
const pendentes = doMes.filter(t => t.pago === false);

// Cards mostram realizados
// Subtexto mostra "+ R$ X pendente"
```

---

### 🟡 BUG 6 — Tendência 6 meses re-filtra array completo 6 vezes

**Arquivo:** `js/relatorios.js` · Linhas ~173-180  
**Severidade:** 🟡 Médio (performance)

```js
for(let i=5; i>=0; i--) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth()-i, 1);
    const p = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    let r=0, g=0;
    transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(p))
              .forEach(t => { if(t.tipo==='receita') r+=t.valor; else g+=t.valor; });
    meses6.push({lbl, r, g});
}
```

**Problema:** Com 5000 transações, este loop faz **6 × 5000 = 30.000 iterações** de `filter`. Poderia ser feito em uma única passagem:

🔧 **SOLUÇÃO:**
```js
const meses6map = {};
for(let i=5; i>=0; i--) {
    const d = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth()-i, 1);
    const p = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lbl = d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
    meses6map[p] = { lbl, r:0, g:0 };
}
// Uma única passagem:
transacoes.forEach(t => {
    if (!t.dataReferencia) return;
    const p = t.dataReferencia.slice(0, 7); // "YYYY-MM"
    if (meses6map[p]) {
        if (t.tipo === 'receita') meses6map[p].r += t.valor;
        else meses6map[p].g += t.valor;
    }
});
const meses6 = Object.values(meses6map);
```

---

### 🟡 BUG 7 — `trocarAba()` destrói e recria gráficos a cada switch

**Arquivo:** `js/relatorios.js` · Linhas ~54-63  
**Severidade:** 🟡 Médio (performance)

```js
window.trocarAba = function(aba) {
    abaAtual = aba;
    // ... toggle hidden, toggle CSS
    renderTudo();  // ← Destrói e recria TODOS os gráficos
};
```

**Problema:** Cada vez que o usuário clica em "Gráficos", os 4 gráficos Chart.js são destruídos (`destroyChart`) e recriados do zero. Isso causa:
1. Flash branco enquanto os canvas são repopulados
2. Perda das animações de entrada (Chart.js anima na criação)
3. CPU desnecessária para re-calcular dados que não mudaram

Se o usuário alterna Resumo ↔ Gráficos ↔ Detalhamento rapidamente (comparando manualmente), cada clique destrói+recria.

🔧 **SOLUÇÃO:** Cache de resultados + flag dirty:
```js
let _dadosDirty = true; // true quando transacoes mudam ou mês muda

window.trocarAba = function(aba) {
    abaAtual = aba;
    // ... toggle panels/CSS
    if (_dadosDirty) { renderTudo(); _dadosDirty = false; }
    // Gráficos: não re-renderizar se dados não mudaram
};

// Marcar dirty quando dados mudam:
_unsubs.push(onSnapshot(q, snap => {
    transacoes = ...;
    _dadosDirty = true;
    renderTudo();
}));
window.mudarMes = d => { ...; _dadosDirty = true; renderTudo(); };
```

---

### 🟡 BUG 8 — `elSaldo.className` remove classes responsivas do HTML

**Arquivo:** `js/relatorios.js` · Linha ~95  
**Severidade:** 🟡 Médio (responsive)

HTML original:
```html
<p id="saldoMes" class="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">R$ 0,00</p>
```

JS override:
```js
elSaldo.className = `text-3xl font-extrabold tracking-tight ${saldo >= 0 ? 'text-blue-600' : 'text-red-500'}`;
```

**Problema:** O JS troca para `text-3xl` fixo, removendo o `text-2xl md:text-3xl` responsivo do HTML. Em mobile, o tamanho fica `text-3xl` (grande demais), quando deveria ser `text-2xl`.

🔧 **SOLUÇÃO:** Trocar apenas a cor:
```js
const elSaldo = document.getElementById('saldoMes');
elSaldo.innerText = fmt(saldo);
elSaldo.classList.remove('text-blue-600', 'text-red-500');
elSaldo.classList.add(saldo >= 0 ? 'text-blue-600' : 'text-red-500');
```

---

### 🟡 BUG 9 — NexoPlanos sem persistência de downgrade

**Arquivo:** `js/relatorios.js` · Linhas ~249-255  
**Severidade:** 🟡 Médio

```js
if (window.NexoPlanos) {
    try {
        const resolved = window.NexoPlanos.resolvePlan(_planoUsuario);
        if (resolved && resolved.shouldDowngrade) { _planoUsuario.plano = 'free'; }
        // ← Só muda local. NÃO faz updateDoc!
    } catch(e) { console.warn('[Nexo] Plano check error:', e); }
}
```

**Problema:** Mesmo padrão do extrato (BUG 8): dowgrade detectado mas não persistido no Firestore. Usa `NexoPlanos` em vez de `BudPlanUtils`.

🔧 **SOLUÇÃO:** Igual à do extrato — uniformizar + persistir com `updateDoc`.

---

### 🟡 BUG 10 — Gráfico diário mostra apenas dias COM transações — lacunas invisíveis

**Arquivo:** `js/relatorios.js` · Linhas ~196-201  
**Severidade:** 🟡 Médio (enganoso)

```js
const diasArr = Object.entries(porDia).sort((a,b) => a[0].localeCompare(b[0]));
charts['dia'] = new Chart(document.getElementById('chartDiario'), {
    type:'bar',
    data:{ labels: diasArr.map(d => 'Dia '+parseInt(d[0])), datasets:[{data: diasArr.map(d => d[1]), ...}] },
    // ...
});
```

**Problema:** Se o usuário gastou nos dias 1, 5, 10, 25, o gráfico mostra 4 barras consecutivas: `Dia 1 | Dia 5 | Dia 10 | Dia 25`. Parece que são 4 dias seguidos. Os dias 2, 3, 4, 6-9, 11-24, 26-30 **não existem** no gráfico.

**Impacto:** Um gasto de R$ 500 no dia 1 e R$ 500 no dia 30 aparece como duas barras coladas, como se fossem dias consecutivos. O usuario não percebe que houve 28 dias sem gastos.

🔧 **SOLUÇÃO:** Preencher todos os dias do mês:
```js
const diasNoMes = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 0).getDate();
const todosOsDias = [];
for (let d = 1; d <= diasNoMes; d++) {
    const key = String(d).padStart(2, '0');
    todosOsDias.push({ dia: d, valor: porDia[key] || 0 });
}
charts['dia'] = new Chart(document.getElementById('chartDiario'), {
    type: 'bar',
    data: {
        labels: todosOsDias.map(d => 'Dia ' + d.dia),
        datasets: [{ data: todosOsDias.map(d => d.valor), ... }]
    },
    // ...
});
```

---

### 🟡 BUG 11 — Dia a dia (Resumo) usa "Dia 08" com zero à esquerda

**Arquivo:** `js/relatorios.js` · Linhas ~113-115  
**Severidade:** 🟡 Baixo (visual)

Resumo → Dia a dia:
```js
const dia = t.dataReferencia.split('-')[2] || '01';
// ...
`<span class="text-sm font-bold text-slate-600">Dia ${dia}</span>`
// Resultado: "Dia 08"
```

Gráficos → Diário:
```js
labels: diasArr.map(d => 'Dia ' + parseInt(d[0]))
// Resultado: "Dia 8"
```

**Problema:** Inconsistência visual entre as duas abas. Resumo mostra "Dia 08", Gráficos mostra "Dia 8".

🔧 **SOLUÇÃO:** Ambos devem usar `parseInt(dia)`:
```js
`<span>Dia ${parseInt(dia)}</span>`
```

---

### 🟡 BUG 12 — Tela duplica `balanco-mensal.html` e `graficos.html` sem sincronização

**Arquivo:** `relatorios.html` + `balanco-mensal.html` + `graficos.html`  
**Severidade:** 🟡 Médio (manutenção)

O código de `renderResumo()` é quase idêntico ao JS de `balanco-mensal.js`, e `renderGraficos()` é quase idêntico ao de `graficos.js`. São **3 cópias** da mesma lógica financeira com divergências inevitáveis.

Qualquer bug corrigido em uma não é corrigido nas outras. Qualquer feature nova precisa ser implementada 3 vezes.

**Linhas duplicadas identificadas:**
| Funcionalidade | `relatorios.js` | `balanco-mensal.js` | `graficos.js` |
|---|---|---|---|
| Filtro por mês | ~73-77 | ~similar | ~similar |
| Cálculo receitas/despesas | ~79-83 | ~similar | ~similar |
| Barras percentuais | ~97-103 | ~similar | N/A |
| Gráfico doughnut | ~147-153 | N/A | ~similar |
| Gráfico tendência | ~173-191 | N/A | ~similar |

🔧 **SOLUÇÃO:** A longo prazo, remover `balanco-mensal.html` e `graficos.html` e manter apenas `relatorios.html` como a tela unificada. Ou extrair funções de cálculo para um `calculos-financeiros.js` compartilhado.

---

### 🟢 BUG 13 — Chart.js via CDN — falha offline (PWA)

**Arquivo:** `relatorios.html` · Linha ~16  
**Severidade:** 🟢 Baixo

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

**Problema:** O app é uma PWA (manifest.json, service worker). Se o usuário abrir offline pela primeira vez sem ter visitado antes, Chart.js não carrega. A aba Gráficos fica completamente quebrada (`Chart is not defined`).

O `firebase-messaging-sw.js` provavelmente faz cache, mas CDN externos podem não estar na lista de cache.

🔧 **SOLUÇÃO:** Baixar Chart.js e servir localmente:
```html
<script src="libs/chart.umd.min.js"></script>
```

---

### 🟢 BUG 14 — Detalhamento mostra "Parabéns, você não gastou nada!" — tom inadequado

**Arquivo:** `js/relatorios.js` · Linhas ~223-225  
**Severidade:** 🟢 Baixo (UX copy)

```js
container.innerHTML = '...🏆...<p>Nenhuma despesa registrada.</p><p>Parabéns, você não gastou nada ainda!</p>';
```

**Problema:** Parece sarcástico se o usuário está no começo do mês (dia 1-5). "Parabéns" por não ter gastado em 2 dias não é informativo. Além disso, se o usuário simplesmente não cadastrou nenhuma transação ainda (não importou, não usa muito o app), o tom é inapropriado.

🔧 **SOLUÇÃO:** Mensagem neutra:
```js
container.innerHTML = '...<p>Sem despesas neste mês</p><p>Suas despesas aparecerão aqui quando houver transações.</p>';
```

---

### 🟢 BUG 15 — `sincronizarDados()` apenas re-renderiza

**Arquivo:** `js/relatorios.js` · Linha ~38  
**Severidade:** 🟢 Baixo

```js
window.sincronizarDados = function() { renderTudo(); };
```

**Problema:** Padrão recorrente em todas as telas. O botão 🔄 dá a impressão de buscar dados novos do servidor, mas apenas re-renderiza o array em memória. Os dados já são real-time via `onSnapshot`.

🔧 **SOLUÇÃO:** Ou remover o botão (dados são real-time), ou fazer re-attach do listener.

---

### 🟢 BUG 16 — Sem emojis no "Detalhamento por Categoria" do Resumo

**Arquivo:** `js/relatorios.js` · Linhas ~105-112  
**Severidade:** 🟢 Baixo (UX)

```js
cats.map(([nome,val]) => `
    <div class="flex items-center gap-3">
        <span class="text-sm font-bold truncate">${escapeHTML(nome)}</span>
        ...
    </div>`).join('');
```

**Problema:** Na aba Resumo, a seção "Detalhamento por Categoria" mostra apenas texto sem emojis. Na aba Detalhamento, usa emojis do `estiloCategorias` (mesmo que sejam genéricos). O extrato tem 53 emojis. Aqui: zero.

**Impacto:** Lista textual monótona. Usuário precisa ler cada nome para diferenciar categorias, quando um emoji aceleraria a leitura.

🔧 **SOLUÇÃO:** Reusar o mapa de emojis (quando centralizado) ou pelo menos o `catEmojiMapExtrato`.

---

## ✅ Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)
- [ ] **BUG 1** — Filtrar somente despesas no "Detalhamento por Categoria" do Resumo
- [ ] **BUG 2** — Trocar gradientes Tailwind por cores inline (hex) no `estiloCategorias`
- [ ] **BUG 3** — Mapear as 51+ categorias reais (não 6 genéricas que nem existem)
- [ ] **BUG 4** — Reduzir `limit(5000)` para query filtrada por 6 meses
- [ ] **BUG 5** — Separar transações pagas vs pendentes nos totais

### 🟡 Médio (corrigir em breve)
- [ ] **BUG 6** — Refatorar tendência 6 meses para passagem única
- [ ] **BUG 7** — Cache de gráficos entre trocas de aba (flag dirty)
- [ ] **BUG 8** — Usar `classList.remove/add` em vez de sobrescrever `className`
- [ ] **BUG 9** — Persistir downgrade + uniformizar `NexoPlanos` → `BudPlanUtils`
- [ ] **BUG 10** — Preencher todos os dias do mês no gráfico diário
- [ ] **BUG 11** — Remover zero à esquerda no "Dia a dia" do Resumo
- [ ] **BUG 12** — Unificar lógica com `balanco-mensal.js` e `graficos.js`

### 🟢 Baixo (melhorias)
- [ ] **BUG 13** — Servir Chart.js localmente para PWA offline
- [ ] **BUG 14** — Ajustar mensagem "Parabéns" para tom neutro
- [ ] **BUG 15** — Remover/reavaliar botão sincronizar
- [ ] **BUG 16** — Adicionar emojis na lista de categorias do Resumo

---

## 📊 Métricas da Auditoria

| Métrica | Valor |
|---|---|
| Total de bugs encontrados | **16** |
| 🔴 Críticos | 5 |
| 🟡 Médios | 7 |
| 🟢 Baixos | 4 |
| Linhas analisadas | 453 (183 HTML + 270 JS) |
| Categorias mapeadas no estiloCategorias | 7 (6 genéricas que não existem + Padrão) |
| Categorias reais no app | 51+ despesa + 15 receita |
| Gradientes Tailwind quebrados | 5 de 7 |
| Gráficos Chart.js | 4 (doughnut, bar, line, bar diário) |
| Telas duplicadas | 2 (`balanco-mensal`, `graficos`) |
| Padrões recorrentes de outras telas | 3 (limit 5000, pendentes no resumo, NexoPlanos) |

---

## 💚 Pontos Positivos

1. **Consolidação em 3 abas:** Decisão arquitetural correta de unificar balanço + gráficos + detalhamento. UI de abas em pill bar é intuitiva e consistente com o resto do app.

2. **`destroyChart(id)` antes de recriar:** Padrão correto de Chart.js — previne memory leaks de instâncias de chart acumuladas. Cada gráfico é destruído antes de ser recriado.

3. **`fmt(v)` com `toLocaleString('pt-BR', {style:'currency'})` direto:** Mais limpo que o `fmtVE` do extrato que precisava do módulo `style:'currency'`. O formatter lida corretamente com negativos (R$ -500,00).

4. **DRY parcial com `renderTudo()`:** O dispatcher central que decide qual aba renderizar evita duplicação de chamadas.

5. **Tendência 6 meses — feature valiosa:** O gráfico de tendência é a funcionalidade mais útil dos relatórios — permite ver evolução temporal de receitas e despesas. Nenhuma outra tela mostra isso.

6. **`_unsubs` cleanup correto:** Array de unsubscribe limpo no início do `onAuthStateChanged` — mesmo padrão bom do extrato.

7. **Seletor de mês mobile reutilizado:** Mesmo componente de UX das outras telas — bottom-sheet com grid de meses, animação slide-up, drag handle. Consistência visual.

8. **`escapeHTML` no detalhamento de categorias:** Usado em `escapeHTML(nome)` nos templates. Proteção XSS mantida.

9. **4 gráficos variados:** Doughnut (composição), Bar (comparação), Line (tendência), Bar diário (distribuição temporal) — boa diversidade visual para análise financeira.

10. **`text-center capitalize` no mês:** O texto "abril 2026" é automaticamente capitalizado via CSS no header, evitando manipulação de string em JS.
