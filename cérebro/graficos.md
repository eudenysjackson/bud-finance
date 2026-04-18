# 📈 Cérebro — Gráficos (`graficos.html` + `js/graficos.js`)

---

## 1. Visão Geral

A tela **Gráficos** apresenta 4 visualizações Chart.js baseadas nas transações do mês selecionado:

1. **🍩 Despesas por Categoria** — Doughnut chart com as categorias de despesas
2. **⚖️ Receitas vs Despesas** — Bar chart lado a lado
3. **📊 Tendência - Últimos 6 Meses** — Line chart com receitas e despesas dos 6 meses retroativos
4. **📅 Gastos por Dia do Mês** — Bar chart diário (somente despesas)

A tela é **read-only**. O usuário navega entre meses (desktop: setas ◀▶, mobile: modal calendário).

**Acesso:** a partir do plano **Pro** (feature flag `evolutionChart`). Free e Starter veem paywall.

**Arquivos:**
- `graficos.html` — 116 linhas, 4 canvas para Chart.js
- `js/graficos.js` — 133 linhas (ES Module), 4 charts com destroy/recreate
- Dependência externa: Chart.js 4.4.1 via CDN

---

## 2. Estrutura de Dados

### Leitura (Firestore)

**Coleção:** `usuarios/{uid}/transacoes`

| Campo | Tipo esperado | Uso |
|---|---|---|
| `dataReferencia` | `string` "YYYY-MM-DD" | Filtro por mês (prefixo) + extração do dia + cálculo de tendência |
| `tipo` | `string` "receita" \| "despesa" | Classificação nos totais |
| `valor` | `number` | Somado nos cálculos |
| `categoria` | `string` | Agrupamento no doughnut (só despesas) |

**Coleção:** `usuarios/{uid}` (doc do usuário)
| Campo | Uso |
|---|---|
| `plano` | Verificação de acesso (`evolutionChart`) |

### Não altera nenhum documento — tela 100% leitura.

---

## 3. Estrutura HTML

```
<body>
├── #mobileOverlay
├── #sidebar-container
├── #modalSeletorMes — bottom-sheet mobile (grid 4×3 de meses)
├── <main>
│   ├── <header> (sticky)
│   │   ├── hamburger + olhinho + refresh (mobile)
│   │   ├── título "📈 Gráficos"
│   │   ├── ◀ Mês ▶ (desktop)
│   │   └── ícone calendário (mobile)
│   └── <div.p-4> (conteúdo)
│       ├── grid 2 cols (desktop):
│       │   ├── 🍩 Despesas por Categoria (#chartCategoria)
│       │   └── ⚖️ Receitas vs Despesas (#chartReceitaDespesa)
│       ├── 📊 Tendência 6 Meses (#chartTendencia)
│       └── 📅 Gastos por Dia (#chartDiario)
└── scripts: plano-config, sidebar, graficos (module), dark-mode, tutorial
```

---

## 4. CSS Custom

```css
body { font-family: 'Inter', sans-serif; background-color: #f4f7fb; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.icon-3d { filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.08)); }
.glass-panel { /* não utilizada */ }
```

---

## 5. Fluxo Completo do Usuário

```
1. Usuário abre graficos.html
2. bud-loader.js mostra splash + carrega sidebar
3. onAuthStateChanged verifica autenticação
   ├── Não logado → redirect index.html
   └── Logado:
       4. getDoc(usuarios/{uid}) → pega plano
       5. NexoPlanos.resolvePlan() → verifica validade
       6. NexoPlanos.canUseFeature(userData, 'evolutionChart')
          ├── false → paywall "Recurso do plano Pro"
          └── true:
              7. onSnapshot(transacoes, limit(5000))
                 → armazena em transacoes[]
                 → hideSplash()
                 → renderizar()
8. renderizar():
   → filtra mês selecionado
   → calcula receitas, despesas, porCategoria, porDia
   → destroy 4 charts antigos
   → cria 4 Charts novos (doughnut, bar, line, bar)
9. Navegação:
   Desktop: mudarMes(±1) → re-renderiza
   Mobile: abrirSeletorMes → selecionarMes → re-renderiza
```

---

## 6. Funções (js/graficos.js)

| Função | Linhas | Descrição |
|---|---|---|
| `atualizarMes()` | 17 | Atualiza texto "#textoMes" |
| `mudarMes(d)` | 18 | Navega ±1 mês (window) |
| `toggleOcultarValores()` | 19 | Alterna visibilidade (window) |
| `sincronizarDados()` | 20 | Re-renderiza sem buscar (window) |
| `abrirSeletorMes()` | 24 | Abre modal mobile (window) |
| `fecharSeletorMes()` | 29 | Fecha modal (window) |
| `mudarAnoSeletor(dir)` | 30 | ±1 ano no seletor (window) |
| `renderizarGridMeses()` | 31 | Grid 4×3 com destaque ativo |
| `selecionarMes(mes)` | 38 | Seleciona mês e re-renderiza (window) |
| `destroyChart(id)` | 42 | Destroy seguro de Chart.js |
| `renderizar()` | 44 | **Core** — filtra, calcula, cria 4 charts |
| `onAuthStateChanged(cb)` | 112 | Setup: auth → plano → onSnapshot |

**Variáveis de estado:**
| Variável | Tipo | Escopo | Descrição |
|---|---|---|---|
| `transacoes` | `array` | module | Cache de todas as transações (até 5000) |
| `dataFiltro` | `Date` | module | Mês/ano selecionado |
| `valoresOcultos` | `boolean` | module | Controla texto dos eixos Y |
| `charts` | `object` | module | Refs `{cat, rd, tend, dia}` para destroy |
| `cores` | `array` | module | 12 cores para o doughnut |
| `anoSeletor` | `number` | module | Ano no modal mobile |
| `_unsubs` | `array` | module | Unsub callbacks Firestore |

---

## 7. Bugs e Problemas

### 🔴 BUG 1 — `limit(5000)` sem `orderBy` retorna dados arbitrários

**Onde:** `js/graficos.js` linha 129  
**Código atual:**
```javascript
onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)),snap=>{
```

**Problema:** Sem `orderBy`, com mais de 5000 transações, os dados retornados são aleatórios. Os gráficos mostram panorama parcial sem aviso — a tendência dos 6 meses pode ter meses com dados faltando, e o doughnut de categorias pode omitir categorias inteiras.

**Cenário real:** Tendência mostra março com R$0 de despesas, mas na verdade estão fora dos 5000. Usuário pensa que controlou gastos, quando não controlou.

**Impacto:** 🔴 Todos os 4 gráficos podem mostrar dados falsos.

🔧 **SOLUÇÃO:**
```javascript
import { getDocs } from "...";
const snap = await getDocs(collection(db, "usuarios", user.uid, "transacoes"));
transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
renderizar();
```

---

### 🔴 BUG 2 — `setMonth()` mutation causa salto de meses

**Onde:** `js/graficos.js` linhas 18, 39-40  
**Código atual:**
```javascript
window.mudarMes = d => { dataFiltro.setMonth(dataFiltro.getMonth()+d); atualizarMes(); renderizar(); };
// ...
window.selecionarMes = function(mes) {
    dataFiltro.setFullYear(anoSeletor); dataFiltro.setMonth(mes);
```

**Problema:** Se `dataFiltro` tem dia 31 (ex: 31 de março) e o usuário navega para fevereiro, `setMonth(1)` avança para março (28 Feb + 3 = 3 Mar). O mês pula ou fica travado. Exatamente o mesmo bug do balanco-mensal.

**Impacto:** 🔴 Navegação quebrada ~6 dias por mês.

🔧 **SOLUÇÃO:**
```javascript
window.mudarMes = d => {
    dataFiltro.setDate(1);
    dataFiltro.setMonth(dataFiltro.getMonth()+d);
    atualizarMes();
    renderizar();
};

window.selecionarMes = function(mes) {
    dataFiltro.setDate(1);
    dataFiltro.setFullYear(anoSeletor);
    dataFiltro.setMonth(mes);
    atualizarMes(); renderizar(); fecharSeletorMes();
};
```

---

### 🔴 BUG 3 — Transações pendentes incluídas em todos os gráficos

**Onde:** `js/graficos.js` linha 46  
**Código atual:**
```javascript
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
```

**Problema:** Nenhum filtro para `status`. Transações pendentes entram em todos os 4 gráficos. O doughnut de despesas, a barra receita/despesa, o dia-a-dia e a **tendência** mostram valores inflados.

A tendência é especialmente grave — pendentes futuros de meses à frente aparecem como gastos já ocorridos.

**Impacto:** 🔴 Gráficos financeiros mentirosos.

🔧 **SOLUÇÃO:**
```javascript
const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente'
);
// Aplicar mesmo filtro no loop da tendência (meses6):
transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(p) && t.status !== 'pendente')
```

---

### 🔴 BUG 4 — `NexoPlanos.resolvePlan()` sem null safety — crash possível

**Onde:** `js/graficos.js` linhas 119-120  
**Código atual:**
```javascript
if (window.NexoPlanos) {
    const resolved = window.NexoPlanos.resolvePlan(userData);
    if (resolved.shouldDowngrade) { userData.plano = 'free'; }
```

**Problema:** Não há `try/catch` nem verificação `resolved &&` antes de acessar `.shouldDowngrade`. Se `resolvePlan()` retornar `null` ou `undefined` (possível em caso de userData malformada), o código lança `TypeError: Cannot read properties of null (reading 'shouldDowngrade')`.

Isso **para a execução** do `onAuthStateChanged`. O resultado: a tela fica travada no splash eternamente. O usuário não vê paywall NEM gráficos — fica em branco.

Compare com outras telas que fazem: `if (resolved && resolved.shouldDowngrade)`.

**Impacto:** 🔴 Page crash para usuários com dado de plano corrompido — tela inacessível.

🔧 **SOLUÇÃO:**
```javascript
if (window.NexoPlanos) {
    try {
        const resolved = window.NexoPlanos.resolvePlan(userData);
        if (resolved && resolved.shouldDowngrade) { userData.plano = 'free'; }
        if (typeof window.NexoPlanos.canUseFeature === 'function' && !window.NexoPlanos.canUseFeature(userData, 'evolutionChart')) {
            // paywall...
            return;
        }
    } catch(e) { console.warn('[Nexo] Plano check error:', e); }
}
```

---

### 🟡 BUG 5 — Charts tooltip expõe valores reais quando ocultos

**Onde:** `js/graficos.js` função `renderizar()` — todos os 4 charts  
**Código atual:**
```javascript
const fmtTick = v => valoresOcultos ? '••••' : 'R$ '+v.toLocaleString('pt-BR');
// Usado nos eixos Y dos charts de barra e linha:
scales:{y:{ticks:{callback:fmtTick}}}
```

**Problema:** O `fmtTick` é aplicado **apenas ao eixo Y** (tick labels). As tooltips do Chart.js continuam mostrando valores numéricos reais ao passar o mouse/tocar. Em particular:

- **Doughnut:** tooltip mostra "Alimentação: 800" (sem nenhum fmtTick no doughnut)
- **Bar/Line:** eixo Y mostra "••••" mas tooltip ao hover mostra "Receitas: 5.000"
- **Barras:** a **altura** das barras ainda revela proporções

O `valoresOcultos` dá falsa sensação de privacidade enquanto os dados estão todos expostos nas tooltips.

**Impacto:** 🟡 Funcionalidade de privacidade parcialmente quebrada.

🔧 **SOLUÇÃO:**
```javascript
// Opção A: Configurar tooltip callback em todos os charts
const tooltipCallback = {
    callbacks: {
        label: function(ctx) {
            if (valoresOcultos) return ctx.dataset.label + ': •••••';
            return ctx.dataset.label + ': R$ ' + ctx.parsed.y.toLocaleString('pt-BR');
        }
    }
};
// Adicionar a cada chart: plugins:{tooltip: tooltipCallback}

// Doughnut precisa callback diferente (parsed não tem .y):
callbacks: {
    label: function(ctx) {
        if (valoresOcultos) return ctx.label + ': •••••';
        return ctx.label + ': R$ ' + ctx.parsed.toLocaleString('pt-BR');
    }
}

// Opção B: Destruir charts quando oculto (mais seguro)
if (valoresOcultos) {
    ['cat','rd','tend','dia'].forEach(id => destroyChart(id));
    // Substituir canvas por placeholders
    return;
}
```

---

### 🟡 BUG 6 — `onSnapshot` desnecessário para tela de leitura

**Onde:** `js/graficos.js` linha 129  

**Problema:** Listener real-time permanente para uma tela de visualização. Cada disparo do snapshot é pesado porque destrói e recria 4 Charts (CPU + GC). Em mobile, o destroy/create de charts é perceptivelmente lento.

**Impacto:** 🟡 Custo Firestore + performance degradada.

🔧 **SOLUÇÃO:**
```javascript
const snap = await getDocs(collection(db, "usuarios", user.uid, "transacoes"));
if (window.hideSplash) window.hideSplash();
transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
renderizar();
```

---

### 🟡 BUG 7 — `valor` undefined/NaN corrompe todos os gráficos

**Onde:** `js/graficos.js` linhas 51-59  
**Código atual:**
```javascript
doMes.forEach(t => {
    if(t.tipo==='receita') receitas+=t.valor; else despesas+=t.valor;
    if(t.tipo!=='receita') { ... porCategoria[cat]=(porCategoria[cat]||0)+t.valor; }
    if(t.tipo!=='receita') porDia[dia] += t.valor;
});
```

**Problema:** Um `valor: undefined` ou `valor: "500"` transforma todos os acumuladores em NaN. Chart.js com dados NaN renderiza gráficos vazios ou com barras invisíveis sem mensagem de erro.

**Impacto:** 🟡 Gráficos desaparecem silenciosamente.

🔧 **SOLUÇÃO:**
```javascript
doMes.forEach(t => {
    const val = Number(t.valor) || 0;
    if(t.tipo==='receita') receitas += val; else despesas += val;
    if(t.tipo !== 'receita') {
        const cat = t.categoria || 'Outros';
        porCategoria[cat] = (porCategoria[cat]||0) + val;
    }
    const dia = t.dataReferencia ? t.dataReferencia.split('-')[2] : '01';
    if(!porDia[dia]) porDia[dia] = 0;
    if(t.tipo !== 'receita') porDia[dia] += val;
});
```

---

### 🟡 BUG 8 — Downgrade de plano não persistido no Firestore

**Onde:** `js/graficos.js` linha 120  
**Código atual:**
```javascript
if (resolved.shouldDowngrade) { userData.plano = 'free'; }
```

**Problema:** Downgrade em memória, Firestore mantém plano antigo.

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

### 🟡 BUG 9 — `sincronizarDados()` não re-busca dados

**Onde:** `js/graficos.js` linha 20  
**Código atual:**
```javascript
window.sincronizarDados = function() { renderizar(); };
```

**Problema:** Re-renderiza 4 charts pesados a partir de dados em cache. Não busca novos dados do Firestore. Se combinarmos com a solução do BUG 6 (trocar onSnapshot por getDocs), o refresh precisa ser real.

**Impacto:** 🟡 Botão enganoso + re-cria 4 charts sem necessidade.

🔧 **SOLUÇÃO:**
```javascript
window.sincronizarDados = async function() {
    const snap = await getDocs(collection(db, "usuarios", user.uid, "transacoes"));
    transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
    renderizar();
    if (window.budShowToast) window.budShowToast('Dados atualizados!', 'sucesso');
};
```

---

### 🟢 BUG 10 — `dataReferencia` como Timestamp faz transação sumir

**Onde:** `js/graficos.js` linhas 46, 88  
**Código atual:**
```javascript
// Filtro do mês
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
// Tendência
transacoes.filter(t=>t.dataReferencia&&t.dataReferencia.startsWith(p))
```

**Problema:** Timestamp do Firestore não tem `.startsWith()`. Transações com formato diferente simplesmente não aparecem em nenhum gráfico.

**Impacto:** 🟢 Transações invisíveis.

🔧 **SOLUÇÃO:**
```javascript
// Normalizar dataReferencia na carga (ver solução global em balanco-mensal.md BUG 10)
```

---

### 🟢 BUG 11 — `hideSplash` chamado a cada snapshot

**Onde:** `js/graficos.js` linha 130  
**Impacto:** 🟢 Negligível.

🔧 **SOLUÇÃO:** Flag `splashHidden` (ver balanco-mensal.md BUG 11).

---

### 🟢 BUG 12 — `valoresOcultos` não persiste entre reloads

**Onde:** `js/graficos.js` linha 13  
**Impacto:** 🟢 Pequeno inconveniente UX.

🔧 **SOLUÇÃO:**
```javascript
let valoresOcultos = localStorage.getItem('bud_ocultar_valores') === 'true';
window.toggleOcultarValores = function() {
    valoresOcultos = !valoresOcultos;
    localStorage.setItem('bud_ocultar_valores', valoresOcultos);
    renderizar();
};
```

---

### 🟢 BUG 13 — Chart.js CDN sem SRI (integridade)

**Onde:** `graficos.html` linha 17  
**Código atual:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

**Impacto:** 🟢 Vulnerabilidade de supply-chain.

🔧 **SOLUÇÃO:** Adicionar `integrity` + `crossorigin` ou hospedar localmente.

---

### 🟢 BUG 14 — Paywall via innerHTML hardcoded

**Onde:** `js/graficos.js` linhas 122-128  
**Impacto:** 🟢 Dívida técnica.

🔧 **SOLUÇÃO:** Centralizar em `bud-utils.js` (ver solução em balanco-mensal.md BUG 14).

---

### 🟢 BUG 15 — "Últimos 6 Meses" é relativo ao mês selecionado, não ao atual

**Onde:** `js/graficos.js` linhas 84-92  
**Código atual:**
```javascript
for(let i=5;i>=0;i--) {
    const d=new Date(dataFiltro.getFullYear(),dataFiltro.getMonth()-i,1);
```

**Problema:** O gráfico de tendência calcula 6 meses retroativos **a partir do mês selecionado** no header. Se o usuário navegar para janeiro/2025, a tendência mostra agosto/2024–janeiro/2025.

O título diz "Últimos 6 Meses" o que implica os últimos 6 meses reais (relativo a hoje). Deveria dizer "6 Meses até [mês selecionado]" ou usar a data real.

**Cenário real:** Usuário navega para março/2023 (mês antigo). Tendência mostra out/2022–mar/2023. Ele acha que é tendência recente porque o título diz "últimos 6 meses".

**Impacto:** 🟢 Título enganoso — dados estão corretos para o contexto, mas a comunicação é imprecisa.

🔧 **SOLUÇÃO:**
```javascript
// Opção A: mudar título dinamicamente
const tituloTendencia = document.querySelector('#chartTendencia')?.closest('.bg-white')?.querySelector('h3');
if (tituloTendencia) {
    tituloTendencia.innerHTML = `<span class="icon-3d">📊</span> Tendência - ${meses6[0].lbl} a ${meses6[5].lbl}`;
}

// Opção B: sempre usar os últimos 6 meses reais (ignora mês selecionado para a tendência)
const hoje = new Date();
for(let i=5;i>=0;i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    // ...
}
```

---

## 8. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | limit(5000) sem orderBy | Médio |
| 2 | 🔴 | setMonth() mutation | Baixo — setDate(1) |
| 3 | 🔴 | Pendentes nos totais + tendência | Baixo — filtro status |
| 4 | 🔴 | NexoPlanos sem null safety | Baixo — try/catch |
| 5 | 🟡 | Tooltips expõem valores ocultos | Médio — tooltip callbacks |
| 6 | 🟡 | onSnapshot desnecessário | Baixo — getDocs |
| 7 | 🟡 | valor NaN/undefined | Baixo — Number() |
| 8 | 🟡 | Downgrade não persistido | Baixo — updateDoc |
| 9 | 🟡 | sincronizarDados fake | Baixo |
| 10 | 🟢 | Timestamp na dataReferencia | Médio |
| 11 | 🟢 | hideSplash repetido | Baixo |
| 12 | 🟢 | valoresOcultos não persiste | Baixo |
| 13 | 🟢 | Chart.js CDN sem SRI | Baixo |
| 14 | 🟢 | Paywall hardcoded | Médio |
| 15 | 🟢 | Título tendência enganoso | Baixo |

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **15** |
| 🔴 Críticos | 4 |
| 🟡 Altos | 5 |
| 🟢 Baixos | 6 |
| Linhas HTML | 116 |
| Linhas JS | 133 |
| Queries Firestore | 2 (getDoc + onSnapshot) |
| Listeners ativos | 1 (onSnapshot) |
| Charts Chart.js | 4 (doughnut, bar, line, bar) |
| Paleta de cores | 12 cores hardcoded |
| Deps externas | firebase-app/auth/firestore, Chart.js 4.4.1 CDN, bud-utils, plano-config, sidebar, dark-mode, tutorial |

---

## 💚 Pontos Positivos

1. **Feature flag correta** — Usa `evolutionChart` que é `true` em pro/plus/trial — acesso adequado para gráficos
2. **destroyChart() centralizado** — Função helper `destroyChart(id)` com verificação de existência previne memory leaks do Chart.js
3. **Tendência com 6 meses** — Boa visão temporal, cálculo correto usando `new Date(year, month-i, 1)` com dia=1 (evita overflow)
4. **Paleta de 12 cores** — Suficiente para a maioria dos users, cores visualmente distintas
5. **fmtTick responsivo** — Pelo menos os eixos Y respeitam `valoresOcultos` (tooltip é o gap)
6. **Gráfico diário só despesas** — Design intencional e correto: "Gastos por Dia" mostra despesa, não mistura receita
7. **Doughnut com sort** — `Object.entries(porCategoria).sort((a,b)=>b[1]-a[1])` coloca categorias maiores primeiro
8. **Layout 2 colunas desktop** — Doughnut e receita/despesa ficam lado a lado, bom uso de espaço
