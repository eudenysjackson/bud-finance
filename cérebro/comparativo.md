# 🔄 Cérebro — Comparativo (`comparativo.html` + `js/comparativo.js`)

---

## 1. Visão Geral

O **Comparativo** é uma tela analítica que permite ao usuário colocar **dois meses lado a lado** e visualizar diferenças em receitas, despesas, saldo e distribuição por categoria. Apresenta:

- **2 cards lado a lado:** resumo financeiro de cada mês (receitas, despesas, saldo, nº transações)
- **Gráfico de barras agrupado (Chart.js):** Receitas / Despesas / Saldo dos dois meses
- **Comparação por categoria:** barras proporcionais + variação percentual entre os meses
- **Gráfico de barras por categoria:** Chart.js com todas as categorias agrupadas

A tela é **read-only** — carrega todas as transações e filtra localmente por mês.

**Acesso:** exclusivo plano **Plus** (feature flag `monthlyComparative`). Planos inferiores veem paywall.

**Arquivos:**
- `comparativo.html` — 130 linhas, layout responsivo com selects duplicados (desktop/mobile)
- `js/comparativo.js` — 163 linhas (ES Module), lógica de seleção, cálculo e charts
- Dependência externa: Chart.js 4.4.1 via CDN (`chart.umd.min.js`)

---

## 2. Estrutura de Dados

### Leitura (Firestore)

**Coleção:** `usuarios/{uid}/transacoes`

Campos utilizados por transação:
| Campo | Tipo esperado | Uso |
|---|---|---|
| `dataReferencia` | `string` "YYYY-MM-DD" | Extração do prefixo "YYYY-MM" para filtro e para popular selects |
| `tipo` | `string` "receita" \| "despesa" | Classificação nos totais |
| `valor` | `number` | Somado nos cálculos |
| `categoria` | `string` | Agrupamento no comparativo de categorias (**só despesas**) |
| `id` | (auto) | Adicionado via `d.id`, não utilizado |

**Coleção:** `usuarios/{uid}` (doc do usuário)
| Campo | Uso |
|---|---|
| `plano` | Verificação de acesso (`monthlyComparative`) |

### Não altera nenhum documento — tela 100% leitura.

---

## 3. Estrutura HTML

```
<body>
├── #mobileOverlay — overlay sidebar
├── #sidebar-container
├── <main>
│   ├── <header> (sticky)
│   │   ├── hamburger (mobile)
│   │   ├── olhinho + refresh (mobile)
│   │   ├── título "🔄 Comparativo" (desktop)
│   │   ├── selects #mes1Mobile vs #mes2Mobile (mobile)
│   │   └── selects #mes1 vs #mes2 (desktop)
│   └── <div.p-4> (conteúdo)
│       ├── grid 2 cols: card Mês 1 (azul) / card Mês 2 (violeta)
│       ├── card: gráfico barras "Receitas vs Despesas" (#chartComparativo)
│       ├── card: comparação por categoria (#categComparativo)
│       └── card: gráfico barras por categoria (#chartCategorias)
└── scripts: plano-config, sidebar, comparativo (module), dark-mode, tutorial
```

**Nota:** Há **4 selects** duplicados (2 desktop + 2 mobile) que são sincronizados via `.onchange` no JS.

---

## 4. CSS Custom

```css
body { font-family: 'Inter', sans-serif; background-color: #f4f7fb; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.icon-3d { filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.08)); }
.glass-panel { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.4); }
```

> `.glass-panel` não é utilizada nesta página.

---

## 5. Fluxo Completo do Usuário

```
1. Usuário abre comparativo.html
2. bud-loader.js mostra splash + carrega sidebar
3. onAuthStateChanged verifica autenticação
   ├── Não logado → redirect index.html
   └── Logado:
       4. getDoc(usuarios/{uid}) → pega plano
       5. NexoPlanos.resolvePlan() → verifica validade
       6. NexoPlanos.canUseFeature(userData, 'monthlyComparative')
          ├── false → substitui conteúdo por paywall
          └── true:
              7. onSnapshot(transacoes, limit(5000))
                 → snap.docs.map → armazena em `transacoes[]`
                 → hideSplash()
                 → populaSelects() → extrai meses únicos, gera <option>s
                 → comparar() → calcula dados, renderiza cards + charts
8. Usuário muda select:
   Qualquer select (desktop/mobile) → .onchange sincroniza par → comparar()
   → recalcula tudo para os novos 2 meses selecionados
```

---

## 6. Funções (js/comparativo.js)

| Função | Linhas | Descrição |
|---|---|---|
| `fmt(v)` | 13 | Formata valor para R$ ou '•••••' se oculto |
| `toggleOcultarValores()` | 14 | Alterna visibilidade e re-compara (window global) |
| `sincronizarDados()` | 15 | Re-compara sem re-buscar (window global) |
| `populaSelects()` | 19 | Extrai meses únicos das transações, popula os 4 selects, registra .onchange |
| `getDados(prefixo)` | 55 | Filtra transações do mês, calcula rec/desp/saldo/cats. Retorna objeto |
| `comparar()` | 63 | **Core** — busca dados dos 2 meses, atualiza cards, cria/recria 2 Charts, monta categoria comparison HTML |
| `onAuthStateChanged(cb)` | 132 | Setup: auth → plano → onSnapshot → populaSelects → comparar |

**Variáveis de estado:**
| Variável | Tipo | Escopo | Descrição |
|---|---|---|---|
| `valoresOcultos` | `boolean` | module | Controla exibição R$ vs ••••• |
| `transacoes` | `array` | module | Cache de TODAS as transações (até 5000) |
| `charts` | `object` | module | Referências `{comp, cats}` dos Chart.js para destroy/recreate |
| `_unsubs` | `array` | module | Unsub callbacks de listeners Firestore |

---

## 7. Bugs e Problemas

### 🔴 BUG 1 — `limit(5000)` sem `orderBy` retorna dados arbitrários

**Onde:** `js/comparativo.js` linha 150  
**Código atual:**
```javascript
onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
```

**Problema:** Sem `orderBy`, o Firestore retorna documentos em ordem de document ID. Com mais de 5000 transações, as retornadas são aleatórias. Os meses no comparativo podem ter dados incompletos — o usuário compara meses com dados parciais sem saber.

**Cenário real:** Usuário com 6000 transações. O mês de janeiro tem 180 transações mas só 120 estão no resultado do limit. O mês de fevereiro tem todas as 150. Comparar mostra que janeiro "gastou menos" quando na verdade gastou mais.

**Impacto:** 🔴 Comparação financeira baseada em dados incompletos — conclusões opostas à realidade.

🔧 **SOLUÇÃO:**
```javascript
// Remover limit ou usar getDocs (ver BUG 4)
import { getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const snap = await getDocs(collection(db, "usuarios", user.uid, "transacoes"));
transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
```

---

### 🔴 BUG 2 — Charts expõem valores reais quando valoresOcultos está ativo

**Onde:** `js/comparativo.js` funções `comparar()` linhas 83-107  
**Código atual:**
```javascript
// Chart comparativo — dados numéricos brutos
datasets: [
    { label: nomeMes(p1), data: [d1.rec, d1.desp, d1.saldo], backgroundColor: '#3b82f6', ... },
    { label: nomeMes(p2), data: [d2.rec, d2.desp, d2.saldo], backgroundColor: '#8b5cf6', ... }
]
// ...
scales:{y:{beginAtZero:true,ticks:{callback:v=>'R$ '+v.toLocaleString('pt-BR')}}}
```

**Problema:** Quando o usuário ativa o olhinho para ocultar valores (privacidade), os cards mostram "R$ •••••" corretamente via `fmt()`. Mas os **Charts continuam exibindo valores reais**:
- Barras com altura proporcional ao valor real
- Eixo Y mostra "R$ 3.500" etc.
- Tooltip ao clicar mostra o valor numérico

Qualquer pessoa olhando por cima do ombro vê os valores nos gráficos.

**Impacto:** 🔴 Funcionalidade de privacidade falha — dados financeiros expostos via Charts.

🔧 **SOLUÇÃO:**
```javascript
// Se valores ocultos, esconder dados dos charts ou destruí-los
function comparar() {
    // ... cards (já usam fmt)

    // Charts: se oculto, usar dados zerados ou destruir
    if (valoresOcultos) {
        if (charts.comp) { charts.comp.destroy(); charts.comp = null; }
        if (charts.cats) { charts.cats.destroy(); charts.cats = null; }
        // Mostrar placeholder nos canvas
        document.getElementById('chartComparativo').parentElement.innerHTML =
            '<p style="text-align:center;color:#94a3b8;font-weight:700;padding:3rem 0;">Valores ocultos — desative o olhinho para ver gráficos</p>';
        // Mesma lógica para chartCategorias
        return;
    }

    // ... criar charts normalmente
}
```

---

### 🔴 BUG 3 — Transações pendentes incluídas nos totais

**Onde:** `js/comparativo.js` função `getDados()` linha 56  
**Código atual:**
```javascript
const do_mes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
```

**Problema:** Nenhum filtro para `status`. Transações pendentes entram nos cálculos de ambos os meses, inflando valores. Como o comparativo existe para **tomar decisões** ("gastei mais ou menos este mês?"), incluir pendentes é especialmente perigoso.

**Impacto:** 🔴 Conclusões comparativas erradas podem levar a más decisões financeiras.

🔧 **SOLUÇÃO:**
```javascript
const do_mes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente'
);
```

---

### 🔴 BUG 4 — `populaSelects()` reseta seleção do usuário a cada snapshot

**Onde:** `js/comparativo.js` linhas 36-50, chamado no callback do onSnapshot  
**Código atual:**
```javascript
_unsubs.push(onSnapshot(..., snap => {
    transacoes = snap.docs.map(d=>({...d.data(),id:d.id}));
    populaSelects();   // ← reconstrói HTML dos selects
    comparar();
}));
```

E dentro de `populaSelects()`:
```javascript
const opts = sorted.map(m => { ... }).join('');
document.getElementById('mes1').innerHTML = opts;      // ← apaga seleção
// ...
if(sorted.length >= 2) {
    document.getElementById('mes1').value = sorted[1]; // ← força mês passado
    document.getElementById('mes2').value = sorted[0]; // ← força mês atual
```

**Problema:** Cada vez que o `onSnapshot` dispara (qualquer mudança em qualquer transação — incluindo de outra aba), a função `populaSelects()` é chamada, que:
1. Reconstrói todo o innerHTML dos 4 selects → perde seleção
2. Força mês passado e mês atual como default

Se o usuário estava comparando março/2025 vs junho/2025 e uma transação muda, a seleção volta para "mês passado vs mês atual" sem aviso.

**Impacto:** 🔴 UX quebrada — trabalho do usuário perdido silenciosamente.

🔧 **SOLUÇÃO:**
```javascript
function populaSelects(preservarSelecao = false) {
    // Salvar seleções atuais antes de reconstruir
    const sel1 = preservarSelecao ? document.getElementById('mes1').value : null;
    const sel2 = preservarSelecao ? document.getElementById('mes2').value : null;

    // ... gera sorted, opts, seta innerHTML ...

    if (preservarSelecao && sel1 && sorted.includes(sel1)) {
        document.getElementById('mes1').value = sel1;
        document.getElementById('mes1Mobile').value = sel1;
    } else if (sorted.length >= 2) {
        document.getElementById('mes1').value = sorted[1];
        document.getElementById('mes1Mobile').value = sorted[1];
    }
    // idem para mes2
}

// No onSnapshot: primeira chamada sem preservar, próximas preservam
let firstLoad = true;
_unsubs.push(onSnapshot(..., snap => {
    transacoes = snap.docs.map(d=>({...d.data(),id:d.id}));
    populaSelects(!firstLoad);
    firstLoad = false;
    comparar();
}));
```

---

### 🟡 BUG 5 — `onSnapshot` desnecessário para tela de leitura

**Onde:** `js/comparativo.js` linha 150  
**Código atual:**
```javascript
_unsubs.push(onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
```

**Problema:** Mesmo padrão das outras telas — listener real-time permanente para uma tela que o usuário consulta pontualmente. Gera custo contínuo de reads no Firestore.

Agravante específico: cada snapshot também recria os selects e os charts (BUG 4), então o custo é duplo (rede + CPU/DOM).

**Impacto:** 🟡 Custo financeiro desnecessário + causa BUG 4.

🔧 **SOLUÇÃO:**
```javascript
import { getDocs } from "...";

const snap = await getDocs(collection(db, "usuarios", user.uid, "transacoes"));
if (window.hideSplash) window.hideSplash();
transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
populaSelects();
comparar();
```

---

### 🟡 BUG 6 — Variação percentual incorreta quando mês 1 tem zero

**Onde:** `js/comparativo.js` linhas 101-102  
**Código atual:**
```javascript
const diff = v1 > 0 ? Number(((v2-v1)/v1*100).toFixed(0)) : (v2>0 ? 100 : 0);
```

**Problema:** Quando uma categoria tem R$0 no mês 1 e R$500 no mês 2, o cálculo retorna `+100%`. Mas ir de 0 para qualquer valor é um aumento **infinito**, não 100%.

Inversamente: de R$500 para R$1.000 também seria +100%. A mesma porcentagem comunica situações completamente diferentes.

**Cenário real:**
- "Alimentação" mês 1: R$0, mês 2: R$500 → mostra +100%
- "Transporte" mês 1: R$500, mês 2: R$1.000 → mostra +100%
- Usuário conclui que ambas tiveram o mesmo crescimento, o que é falso.

**Impacto:** 🟡 Informação comparativa enganosa.

🔧 **SOLUÇÃO:**
```javascript
let diffLabel;
if (v1 === 0 && v2 === 0) diffLabel = '=';
else if (v1 === 0) diffLabel = 'Novo';
else {
    const pct = Number(((v2 - v1) / v1 * 100).toFixed(0));
    diffLabel = (pct > 0 ? '+' : '') + pct + '%';
}
// Usar diffLabel no HTML ao invés de diff
```

---

### 🟡 BUG 7 — Comparação de categorias mostra apenas despesas

**Onde:** `js/comparativo.js` função `getDados()` linhas 57-60  
**Código atual:**
```javascript
do_mes.forEach(t => {
    if(t.tipo==='receita') rec+=t.valor;
    else { desp+=t.valor; const c=t.categoria||'Outros'; cats[c]=(cats[c]||0)+t.valor; }
});
```

**Problema:** O agrupamento de categorias (`cats`) só ocorre dentro do `else` (despesas). Receitas por categoria são ignoradas. A seção "Comparação por Categoria" e o gráfico de categorias mostram **apenas despesas**, mas em nenhum lugar da UI isso é comunicado.

O título diz "📋 Comparação por Categoria" e "📈 Variação por Categoria" sem especificar "de despesas".

**Cenário real:** Usuário tem receitas categorizadas ("Freelance", "Salário", "Investimentos"). Essas categorias nunca aparecem no comparativo. Ele acha que só gastou, sem ver suas fontes de renda.

**Impacto:** 🟡 Visão incompleta da realidade financeira + título enganoso.

🔧 **SOLUÇÃO:**
```javascript
// Opção A: separar cats receita e despesa
function getDados(prefixo) {
    const do_mes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo) && t.status !== 'pendente');
    let rec=0, desp=0;
    const catsDespesa = {};
    const catsReceita = {};
    do_mes.forEach(t => {
        const val = Number(t.valor) || 0;
        const c = t.categoria || 'Outros';
        if(t.tipo === 'receita') { rec += val; catsReceita[c] = (catsReceita[c]||0) + val; }
        else { desp += val; catsDespesa[c] = (catsDespesa[c]||0) + val; }
    });
    return { rec, desp, saldo: rec-desp, trans: do_mes.length, catsDespesa, catsReceita };
}

// Na UI: mostrar duas seções — "Despesas por Categoria" e "Receitas por Categoria"

// Opção B: manter comportamento mas comunicar no título
// "📋 Despesas por Categoria"
```

---

### 🟡 BUG 8 — Downgrade de plano não é persistido no Firestore

**Onde:** `js/comparativo.js` linhas 139-140  
**Código atual:**
```javascript
const resolved = window.NexoPlanos.resolvePlan(userData);
if (resolved && resolved.shouldDowngrade) { userData.plano = 'free'; }
```

**Problema:** Mesmo bug sistêmico — downgrade em memória local, Firestore mantém plano antigo. Cada visita recalcula.

**Impacto:** 🟡 Cálculo repetido + janela de exploração.

🔧 **SOLUÇÃO:**
```javascript
if (resolved && resolved.shouldDowngrade) {
    userData.plano = 'free';
    import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js")
        .then(({ updateDoc }) => {
            updateDoc(doc(db, 'usuarios', user.uid), { plano: 'free' }).catch(console.error);
        });
}
```

---

### 🟡 BUG 9 — `valor` undefined/NaN corrompe cálculos de ambos os meses

**Onde:** `js/comparativo.js` função `getDados()` linhas 57-60  
**Código atual:**
```javascript
if(t.tipo==='receita') rec+=t.valor; else { desp+=t.valor; ... cats[c]=(cats[c]||0)+t.valor; }
```

**Problema:** Um único documento com `valor: undefined` ou `valor: "500"` (string) faz `rec` ou `desp` virar `NaN`, que se propaga pelos cards, charts e categorias. Como ambos os meses compartilham o mesmo `transacoes[]`, o bug pode afetar os dois lados do comparativo.

**Impacto:** 🟡 Tela inteira quebrada por um documento malformado.

🔧 **SOLUÇÃO:**
```javascript
do_mes.forEach(t => {
    const val = Number(t.valor) || 0;
    if(t.tipo === 'receita') rec += val;
    else { desp += val; const c = t.categoria || 'Outros'; cats[c] = (cats[c]||0) + val; }
});
```

---

### 🟡 BUG 10 — `sincronizarDados()` não re-busca dados do Firestore

**Onde:** `js/comparativo.js` linha 15  
**Código atual:**
```javascript
window.sincronizarDados = function() { comparar(); };
```

**Problema:** Botão sync apenas re-compara com dados em memória. Não faz nenhuma requisição ao Firestore. Mesma ilusão de atualização que não atualiza nada.

**Impacto:** 🟡 Funcionalidade enganosa.

🔧 **SOLUÇÃO:**
```javascript
// Se usar getDocs, implementar refresh real:
window.sincronizarDados = async function() {
    const snap = await getDocs(collection(db, "usuarios", user.uid, "transacoes"));
    transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
    populaSelects(true); // preservar seleção
    comparar();
    if (window.budShowToast) window.budShowToast('Dados atualizados!', 'sucesso');
};
```

---

### 🟢 BUG 11 — `dataReferencia` como Timestamp faz transação sumir

**Onde:** `js/comparativo.js` funções `populaSelects()` e `getDados()`  
**Código atual:**
```javascript
// populaSelects
if(t.dataReferencia) meses.add(t.dataReferencia.substring(0,7));
// getDados
const do_mes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
```

**Problema:** Se `dataReferencia` for um Firestore Timestamp, `.substring(0,7)` e `.startsWith(prefixo)` não existem no objeto Timestamp. A transação é silenciosamente ignorada.

Adicionalmente, em `populaSelects()`, um Timestamp passaria pelo check `if(t.dataReferencia)` (truthy) mas `.substring(0,7)` em Timestamp retorna `undefined` ou lança erro silencioso. O mês não é adicionado ao Set.

**Impacto:** 🟢 Transações com formato diferente de data desaparecem.

🔧 **SOLUÇÃO:**
```javascript
function normalizarData(dr) {
    if (!dr) return null;
    if (typeof dr === 'string') return dr;
    if (typeof dr.toDate === 'function') {
        const d = dr.toDate();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return null;
}
```

---

### 🟢 BUG 12 — `hideSplash` chamado a cada disparo do onSnapshot

**Onde:** `js/comparativo.js` linha 151  
**Código atual:**
```javascript
if (window.hideSplash) window.hideSplash();
```

**Problema:** `hideSplash()` chamado toda vez que o snapshot dispara. Após a primeira, é no-op.

**Impacto:** 🟢 Negligível.

🔧 **SOLUÇÃO:**
```javascript
let splashHidden = false;
// no callback:
if (!splashHidden && window.hideSplash) { window.hideSplash(); splashHidden = true; }
```

---

### 🟢 BUG 13 — `valoresOcultos` não persiste entre reloads

**Onde:** `js/comparativo.js` linha 12  
**Código atual:**
```javascript
let valoresOcultos = false;
```

**Problema:** Estado do olhinho perdido ao recarregar. Deveria usar localStorage para consistência com outras telas.

**Impacto:** 🟢 Pequeno inconveniente UX.

🔧 **SOLUÇÃO:**
```javascript
let valoresOcultos = localStorage.getItem('bud_ocultar_valores') === 'true';

window.toggleOcultarValores = function() {
    valoresOcultos = !valoresOcultos;
    localStorage.setItem('bud_ocultar_valores', valoresOcultos);
    comparar();
};
```

---

### 🟢 BUG 14 — Chart.js carregado via CDN sem SRI (integridade)

**Onde:** `comparativo.html` linha 17  
**Código atual:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

**Problema:** A tag `<script>` carrega Chart.js sem atributo `integrity` (Subresource Integrity). Se o CDN jsdelivr for comprometido, código malicioso pode ser injetado na página com acesso total ao DOM e dados do Firebase.

**Impacto:** 🟢 Vulnerabilidade de supply-chain (risco teórico mas real — ataques a CDNs já aconteceram).

🔧 **SOLUÇÃO:**
```html
<script
    src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
    integrity="sha384-HASH_AQUI"
    crossorigin="anonymous"
></script>

<!-- Ou melhor: hospedar localmente -->
<!-- <script src="lib/chart.umd.min.js"></script> -->
```

---

### 🟢 BUG 15 — Paywall via innerHTML hardcoded

**Onde:** `js/comparativo.js` linhas 143-149  
**Código atual:**
```javascript
if (mainContent) mainContent.innerHTML = '<div class="flex flex-col items-center ...'
```

**Problema:** Mesmo padrão duplicado em todas as telas premium — bloco HTML gigante via string concatenation. Manutenção trabalhosa.

**Impacto:** 🟢 Dívida técnica.

🔧 **SOLUÇÃO:**
```javascript
// Centralizar em bud-utils.js (ver solução em balanco-mensal.md BUG 14)
window.budShowPaywall('Comparativo mensal', 'Plus');
```

---

## 8. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | limit(5000) sem orderBy | Médio — redesign query |
| 2 | 🔴 | Charts expõem valores quando ocultos | Médio — hide/destroy charts |
| 3 | 🔴 | Pendentes nos totais | Baixo — filtro status |
| 4 | 🔴 | populaSelects reseta seleção | Baixo — preservar value |
| 5 | 🟡 | onSnapshot desnecessário | Baixo — trocar por getDocs |
| 6 | 🟡 | Variação % incorreta (0→X = 100%) | Baixo — tratar caso 0 |
| 7 | 🟡 | Categorias só com despesas | Médio — separar receita/despesa |
| 8 | 🟡 | Downgrade não persistido | Baixo — updateDoc |
| 9 | 🟡 | valor NaN/undefined | Baixo — `Number() \|\| 0` |
| 10 | 🟡 | sincronizarDados fake | Baixo — re-buscar |
| 11 | 🟢 | Timestamp na dataReferencia | Médio — normalizador |
| 12 | 🟢 | hideSplash repetido | Baixo — flag |
| 13 | 🟢 | valoresOcultos não persiste | Baixo — localStorage |
| 14 | 🟢 | Chart.js CDN sem SRI | Baixo — adicionar hash |
| 15 | 🟢 | Paywall hardcoded | Médio — centralizar |

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **15** |
| 🔴 Críticos | 4 |
| 🟡 Altos | 6 |
| 🟢 Baixos | 5 |
| Linhas HTML | 130 |
| Linhas JS | 163 |
| Queries Firestore | 2 (getDoc usuário + onSnapshot transações) |
| Listeners ativos | 1 (onSnapshot) |
| Charts Chart.js | 2 (barras comparativo + barras categorias) |
| Selects duplicados | 4 (2 desktop + 2 mobile, sincronizados via JS) |
| Deps externas | firebase-app/auth/firestore, Chart.js 4.4.1 CDN, bud-utils, plano-config, sidebar, dark-mode, tutorial |

---

## 💚 Pontos Positivos

1. **Feature flag própria** — Usa `monthlyComparative` ao invés de flag genérica (melhor que balanco-mensal)
2. **UX responsiva** — Selects duplicados desktop/mobile com sincronização bidirecional
3. **escapeHTML nas categorias** — `${escapeHTML(cat)}` previne XSS
4. **Charts com destroy/recreate** — `if(charts.comp) charts.comp.destroy()` previne memory leaks de Chart.js
5. **Meses inteligentes** — `populaSelects()` adiciona mês atual e passado mesmo sem transações, garantindo que o comparativo funcione para novos usuários
6. **Variação visual** — Percentuais coloridos (vermelho aumento, verde redução) comunicam rapidamente a direção da mudança
7. **Barras proporcionais** — Na comparação de categorias, barras relativas ao maxVal dão noção visual instantânea
8. **Código enxuto** — 163 linhas com 2 charts, 4 selects sincronizados e comparação completa por categoria
