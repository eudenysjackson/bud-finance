# 📊 Cérebro — Balanço Mensal (`balanco-mensal.html` + `js/balanco-mensal.js`)

---

## 1. Visão Geral

O **Balanço Mensal** é uma tela de **visualização analítica** que compila todas as transações do mês selecionado e apresenta:

- **3 cards de resumo:** Total Receitas (verde), Total Despesas (vermelho), Saldo do Mês (azul/vermelho)
- **Barra comparativa:** Receitas vs Despesas com percentuais sobre o total movimentado
- **Detalhamento por Categoria:** ranking de categorias por volume financeiro com barras proporcionais
- **Dia a Dia:** breakdown por dia do mês com receita, despesa e saldo de cada dia

A tela é **read-only** — não há criação, edição ou exclusão de transações. O usuário navega entre meses e visualiza seu panorama financeiro.

**Acesso:** exclusivo plano **Plus** (feature flag `advancedDashboard`). Planos inferiores veem paywall.

**Arquivos:**
- `balanco-mensal.html` — 118 linhas, layout com 4 seções visuais
- `js/balanco-mensal.js` — 130 linhas (ES Module), lógica completa de filtro, cálculo e render

---

## 2. Estrutura de Dados

### Leitura (Firestore)

**Coleção:** `usuarios/{uid}/transacoes`

Campos utilizados por transação:
| Campo | Tipo esperado | Uso |
|---|---|---|
| `dataReferencia` | `string` "YYYY-MM-DD" | Filtro por mês (`startsWith(prefixo)`) e extração do dia |
| `tipo` | `string` "receita" \| "despesa" | Classificação nos totais |
| `valor` | `number` | Soemado nos cálculos |
| `categoria` | `string` | Agrupamento no detalhamento por categoria |
| `id` | (auto) | Adicionado via `d.id` no map, não utilizado |

**Coleção:** `usuarios/{uid}` (documento do usuário)
| Campo | Uso |
|---|---|
| `plano` | Verificação de acesso via NexoPlanos |
| `planoExpiracao`, `subscriptionStatus` | Usados internamente por `resolvePlan()` |

### Não altera nenhum documento — tela 100% leitura.

---

## 3. Estrutura HTML

```
<body>
├── #mobileOverlay — overlay do sidebar
├── #sidebar-container — sidebar dinâmica
├── #modalSeletorMes — bottom-sheet mobile com grid 4×3 de meses
│   ├── botões ◀ ▶ para mudar ano
│   └── #gridMesesSeletor — 12 botões (Jan–Dez)
├── <main>
│   ├── <header> (sticky)
│   │   ├── hamburger (mobile)
│   │   ├── olhinho + refresh (mobile)
│   │   ├── título "📊 Balanço Mensal"
│   │   ├── navegador ◀ Mês ▶ (desktop)
│   │   └── ícone calendário → abre modal (mobile)
│   └── <div.p-4> (conteúdo)
│       ├── grid 3 cols: Total Receitas / Total Despesas / Saldo
│       ├── card: Receitas vs Despesas (barras percentuais)
│       ├── card: Detalhamento por Categoria (#detalhamentoContainer)
│       └── card: Dia a Dia (#diaAdiaContainer)
└── scripts: plano-config, sidebar, balanco-mensal (module), dark-mode, tutorial
```

---

## 4. CSS Custom

```css
body { font-family: 'Inter', sans-serif; background-color: #f4f7fb; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.icon-3d { filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.08)); }
.glass-panel { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.4); }
```

> `.glass-panel` está declarado mas **não é usado** nesta página (provavelmente veio de copiar template).

---

## 5. Fluxo Completo do Usuário

```
1. Usuário abre balanco-mensal.html
2. bud-loader.js mostra splash + carrega sidebar
3. onAuthStateChanged verifica autenticação
   ├── Não logado → redirect index.html
   └── Logado:
       4. getDoc(usuarios/{uid}) → pega plano
       5. NexoPlanos.resolvePlan() → verifica validade
       6. NexoPlanos.canUseFeature(userData, 'advancedDashboard')
          ├── false → substitui conteúdo por paywall
          └── true:
              7. onSnapshot(transacoes, limit(5000))
                 → snap.docs.map → armazena em `transacoes[]`
                 → hideSplash()
                 → renderizar()
8. renderizar():
   → filtra transações pelo prefixo "YYYY-MM"
   → calcula receitas, despesas, saldo
   → agrupa por categoria
   → agrupa por dia
   → atualiza DOM (cards, barras, listas)
9. Usuário navega meses:
   Desktop: ◀/▶ no header → mudarMes(±1)
   Mobile: ícone calendário → modal → selecionarMes()
   → re-renderiza com novo filtro (dados já em memória)
```

---

## 6. Funções (js/balanco-mensal.js)

| Função | Linhas | Descrição |
|---|---|---|
| `fmt(v)` | 13 | Formata valor para R$ ou '•••••' se oculto |
| `atualizarMes()` | 17 | Atualiza texto "#textoMes" com mês/ano formatado |
| `mudarMes(d)` | 18 | Navega ±1 mês, re-renderiza (window global) |
| `toggleOcultarValores()` | 19 | Alterna visibilidade de valores |
| `sincronizarDados()` | 20 | Re-renderiza (NÃO re-busca do Firestore) |
| `abrirSeletorMes()` | 24 | Abre modal mobile de seleção de mês |
| `fecharSeletorMes()` | 29 | Fecha modal mobile |
| `mudarAnoSeletor(dir)` | 30 | Muda ano no seletor mobile ±1 |
| `renderizarGridMeses()` | 31 | Gera grid 4×3 com destaque no mês ativo |
| `selecionarMes(mes)` | 36 | Define mês/ano da UI e re-renderiza |
| `renderizar()` | 40 | **Core** — filtra, calcula, agrupa, monta HTML de tudo |
| `onAuthStateChanged(cb)` | 93 | Setup: auth → plano check → onSnapshot |

**Variáveis de estado:**
| Variável | Tipo | Escopo | Descrição |
|---|---|---|---|
| `valoresOcultos` | `boolean` | module | Controla exibição R$ vs ••••• |
| `transacoes` | `array` | module | Cache de TODAS as transações (até 5000) |
| `dataFiltro` | `Date` | module | Mês/ano selecionado para filtragem |
| `anoSeletor` | `number` | module | Ano exibido no modal mobile de meses |
| `_unsubs` | `array` | module | Unsub callbacks de listeners Firestore |

---

## 7. Bugs e Problemas

### 🔴 BUG 1 — `limit(5000)` sem `orderBy` retorna dados arbitrários

**Onde:** `js/balanco-mensal.js` linha 97  
**Código atual:**
```javascript
onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
```

**Problema:** O `limit(5000)` sem nenhum `orderBy` faz o Firestore retornar documentos em ordem de **document ID** (aleatória/hash). Se o usuário tiver mais de 5000 transações, as 5000 retornadas serão **arbitrárias**, não as mais recentes. O balanço mensal de meses recentes pode estar vazio enquanto meses antigos aparecem completos, ou vice-versa.

**Cenário real:** Usuário com 3 anos de uso, 200 transações/mês = 7200. Resultado: 2200 transações simplesmente desaparecem. O balanço de alguns meses mostra valores menores que a realidade.

**Impacto:** 🔴 Dados financeiros incorretos sem qualquer aviso ao usuário.

🔧 **SOLUÇÃO:**
```javascript
// Opção A: remover limit (esta tela é read-only, carregar tudo)
import { getDocs, query, collection, where, orderBy } from "...";

// Buscar apenas transações do mês atual para economizar reads
const prefixo = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}`;
const q = query(
    collection(db, "usuarios", user.uid, "transacoes"),
    where("dataReferencia", ">=", prefixo + "-01"),
    where("dataReferencia", "<=", prefixo + "-31"),
    orderBy("dataReferencia", "desc")
);
const snap = await getDocs(q);
transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
renderizar();

// Opção B: se quiser manter cache de todos os meses,
// remover o limit e aceitar o custo de reads
```

---

### 🔴 BUG 2 — `setMonth()` mutation causa salto de meses

**Onde:** `js/balanco-mensal.js` linhas 18, 36  
**Código atual:**
```javascript
// Linha 18
window.mudarMes = d => { dataFiltro.setMonth(dataFiltro.getMonth()+d); atualizarMes(); renderizar(); };

// Linha 36
window.selecionarMes = function(mes) {
    dataFiltro.setFullYear(anoSeletor); dataFiltro.setMonth(mes);
```

**Problema:** `Date.setMonth()` do JavaScript tem um comportamento perigoso: se o dia atual do `Date` não existe no mês destino, o JavaScript **avança automaticamente** para o mês seguinte.

**Cenário real:**
```
dataFiltro = new Date()   // 31 de março de 2026
mudarMes(-1)              // setMonth(1) → fevereiro
// Feb tem 28 dias, dia 31 não existe
// JS avança: 28 Feb + 3 dias = 3 de março
// Resultado: voltou pro mesmo mês (março)!
```

O usuário clica "◀" repetidamente mas fica preso no mesmo mês, ou pula fevereiro completamente.

**Impacto:** 🔴 Navegação quebrada em ~6 dias por mês (29, 30, 31 em meses que não os têm).

🔧 **SOLUÇÃO:**
```javascript
// Fixar dia como 1 para evitar overflow de mês
// Opção A: setar dia 1 antes de mudar mês
window.mudarMes = d => {
    dataFiltro.setDate(1);  // ← FIX: previne overflow
    dataFiltro.setMonth(dataFiltro.getMonth() + d);
    atualizarMes();
    renderizar();
};

window.selecionarMes = function(mes) {
    dataFiltro.setDate(1);  // ← FIX
    dataFiltro.setFullYear(anoSeletor);
    dataFiltro.setMonth(mes);
    atualizarMes();
    renderizar();
    fecharSeletorMes();
};
```

---

### 🔴 BUG 3 — Transações pendentes são incluídas nos totais

**Onde:** `js/balanco-mensal.js` função `renderizar()` linha 48  
**Código atual:**
```javascript
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
```

**Problema:** Não há filtro para `status`. Transações com `status: 'pendente'` (ex: parcelas futuras de cartão, recorrentes agendados) são contadas nos totais do mês como se já tivessem sido efetivadas.

**Cenário real:** Usuário tem R$5.000 em recorrentes agendados para o mês com status `pendente`. O balanço mostra R$5.000 a mais em despesas, dando impressão de que já gastou isso.

**Impacto:** 🔴 Saldo do mês mostra valor incorreto, usuário toma decisões financeiras baseado em dados errados.

🔧 **SOLUÇÃO:**
```javascript
const doMes = transacoes.filter(t =>
    t.dataReferencia &&
    t.dataReferencia.startsWith(prefixo) &&
    t.status !== 'pendente'  // ← apenas transações efetivadas
);
```

---

### 🟡 BUG 4 — `onSnapshot` desnecessário para tela de leitura

**Onde:** `js/balanco-mensal.js` linha 97  
**Código atual:**
```javascript
_unsubs.push(onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
```

**Problema:** O `onSnapshot` cria um **listener real-time permanente** que fica ativo enquanto a página está aberta. Para uma tela de balanço mensal que é consultada pontualmente, isso gera custo contínuo de reads no Firestore sem benefício — o usuário não espera que o balanço atualize em tempo real.

Cada vez que QUALQUER transação muda (outra aba, outro dispositivo), o listener dispara, re-mapeia até 5000 docs e re-renderiza tudo.

**Impacto:** 🟡 Custo financeiro desnecessário no Firestore + consumo de bateria em mobile.

🔧 **SOLUÇÃO:**
```javascript
// Substituir onSnapshot por getDocs (leitura única)
import { getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const snap = await getDocs(query(collection(db, "usuarios", user.uid, "transacoes")));
if (window.hideSplash) window.hideSplash();
transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
renderizar();

// Se quiser refresh manual, sincronizarDados pode re-buscar:
window.sincronizarDados = async function() {
    const snap = await getDocs(query(collection(db, "usuarios", user.uid, "transacoes")));
    transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
    renderizar();
};
```

---

### 🟡 BUG 5 — Detalhamento por categoria mistura receitas e despesas

**Onde:** `js/balanco-mensal.js` linhas 52-54  
**Código atual:**
```javascript
const cat = t.categoria || 'Outros';
porCategoria[cat] = (porCategoria[cat]||0) + t.valor;
```

**Problema:** O agrupamento por categoria soma `t.valor` independentemente de `t.tipo`. Se "Alimentação" tem R$500 em despesas e "Outros" tem R$200 como receita + R$100 como despesa, o valor de "Outros" aparece como R$300. O usuário não consegue distinguir quais categorias são de receita e quais de despesa.

Todas as barras são azuis (`from-blue-400 to-blue-500`), sem diferenciação visual.

**Cenário real:** Usuário vê "Salário: R$5.000" e "Alimentação: R$800" lado a lado com barras azuis idênticas. Parece que está gastando em ambas.

**Impacto:** 🟡 Informação financeira ambígua e potencialmente confusa.

🔧 **SOLUÇÃO:**
```javascript
// Separar receitas e despesas no agrupamento
const porCatReceita = {};
const porCatDespesa = {};

doMes.forEach(t => {
    if(t.tipo === 'receita') {
        receitas += t.valor;
        const cat = t.categoria || 'Outros';
        porCatReceita[cat] = (porCatReceita[cat]||0) + t.valor;
    } else {
        despesas += t.valor;
        const cat = t.categoria || 'Outros';
        porCatDespesa[cat] = (porCatDespesa[cat]||0) + t.valor;
    }
    // ... porDia continua igual
});

// No render, mostrar duas seções:
// "📈 Receitas por Categoria" (barras verdes)
// "📉 Despesas por Categoria" (barras vermelhas)
```

---

### 🟡 BUG 6 — `sincronizarDados()` não re-busca dados do Firestore

**Onde:** `js/balanco-mensal.js` linha 20  
**Código atual:**
```javascript
window.sincronizarDados = function() { renderizar(); };
```

**Problema:** O botão de sync (ícone de setas circulares no header mobile) apenas chama `renderizar()`, que re-processa o array `transacoes` já em memória. **Não faz nenhuma requisição ao Firestore.** O usuário clica achando que está "atualizando" mas nada muda.

Se o `onSnapshot` for substituído por `getDocs` (BUG 4), esta função se torna ainda mais inútil — dados nunca atualizam após o load inicial.

**Impacto:** 🟡 Funcionalidade enganosa, botão não faz o que promete.

🔧 **SOLUÇÃO:**
```javascript
// Se usar getDocs, re-buscar de verdade:
window.sincronizarDados = async function() {
    try {
        const snap = await getDocs(query(collection(db, "usuarios", user.uid, "transacoes")));
        transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
        renderizar();
        if (window.budShowToast) window.budShowToast('Dados atualizados!', 'sucesso');
    } catch(e) {
        console.error('[Balanço] Erro ao sincronizar:', e);
        if (window.budShowToast) window.budShowToast('Erro ao atualizar dados', 'erro');
    }
};

// Se manter onSnapshot, o botão pode forçar um re-render com feedback:
window.sincronizarDados = function() {
    renderizar();
    if (window.budShowToast) window.budShowToast('Dados atualizados!', 'sucesso');
};
```

---

### 🟡 BUG 7 — Downgrade de plano não é persistido no Firestore

**Onde:** `js/balanco-mensal.js` linhas 84-86  
**Código atual:**
```javascript
const resolved = window.NexoPlanos.resolvePlan(userData);
if (resolved && resolved.shouldDowngrade) { userData.plano = 'free'; }
```

**Problema:** Quando `resolvePlan()` detecta que a assinatura expirou (`shouldDowngrade: true`), o código rebaixa para `'free'` **apenas em memória local** (`userData.plano = 'free'`). A próxima vez que o usuário abrir a página, o Firestore ainda terá `plano: 'plus'`, e o `resolvePlan()` terá que re-calcular o downgrade.

Este é um bug sistêmico — ocorre em quase todas as telas **exceto** `configuracoes.js` que persiste o downgrade.

**Impacto:** 🟡 Custo de processamento repetido + janela de exploração se `resolvePlan` falhar.

🔧 **SOLUÇÃO:**
```javascript
const resolved = window.NexoPlanos.resolvePlan(userData);
if (resolved && resolved.shouldDowngrade) {
    userData.plano = 'free';
    // Persistir downgrade para não repetir o cálculo
    import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js")
        .then(({ updateDoc }) => {
            updateDoc(doc(db, 'usuarios', user.uid), { plano: 'free' }).catch(console.error);
        });
}
```

---

### 🟡 BUG 8 — Feature check usa `advancedDashboard` (flag genérica)

**Onde:** `js/balanco-mensal.js` linha 88  
**Código atual:**
```javascript
!window.NexoPlanos.canUseFeature(userData, 'advancedDashboard')
```

**Problema:** O balanço mensal usa a mesma feature flag do dashboard avançado. Isso significa que qualquer mudança na política de acesso do dashboard afeta automaticamente o balanço mensal, e vice-versa. Idealmente, cada funcionalidade teria sua própria flag.

Atualmente, `advancedDashboard: true` só existe nos planos `plus` e `trial`. Pra um recurso de visualização de balanço mensal, isso pode ser restritivo — muitos apps oferecem isso em planos intermediários.

**Impacto:** 🟡 Acoplamento indevido entre features distintas + barreira de acesso possivelmente excessiva.

🔧 **SOLUÇÃO:**
```javascript
// 1. Adicionar flag específica em plano-config.js:
// monthlyBalance: false (free, starter), true (pro, plus, trial)

// 2. Usar a flag correta:
!window.NexoPlanos.canUseFeature(userData, 'monthlyBalance')
```

---

### 🟡 BUG 9 — `valor` undefined/NaN corrompe todos os cálculos

**Onde:** `js/balanco-mensal.js` linhas 49-54  
**Código atual:**
```javascript
doMes.forEach(t => {
    if(t.tipo === 'receita') receitas += t.valor;
    else despesas += t.valor;
    // ...
    porCategoria[cat] = (porCategoria[cat]||0) + t.valor;
```

**Problema:** Se qualquer transação tiver `valor: undefined`, `valor: null`, ou `valor: "500"` (string), a aritmética produz `NaN` que se propaga por todos os cálculos. Um único documento corrompido faz **todo o balanço** mostrar `NaN`.

**Cenário real:** Transação importada de CSV com campo `valor` como string. Ou transação antiga com campo faltando após migração.

**Impacto:** 🟡 Tela inteira quebrada por um único documento malformado.

🔧 **SOLUÇÃO:**
```javascript
doMes.forEach(t => {
    const val = Number(t.valor) || 0;  // ← sanitiza
    if(t.tipo === 'receita') receitas += val;
    else despesas += val;
    const cat = t.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat]||0) + val;
    const dia = t.dataReferencia.split('-')[2] || '01';
    if(!porDia[dia]) porDia[dia] = {receita:0, despesa:0};
    if(t.tipo === 'receita') porDia[dia].receita += val;
    else porDia[dia].despesa += val;
});
```

---

### 🟢 BUG 10 — `dataReferencia` como Timestamp faz transação sumir

**Onde:** `js/balanco-mensal.js` linha 44  
**Código atual:**
```javascript
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
```

**Problema:** O código assume que `dataReferencia` é sempre uma string `"YYYY-MM-DD"`. Se alguma transação for salva com um Firestore Timestamp (ex: via Cloud Function ou importação), o `.startsWith()` retorna `undefined` (Timestamp não tem esse método) e a transação é silenciosamente excluída do filtro.

**Impacto:** 🟢 Transações com formato diferente de data desaparecem sem aviso.

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

const doMes = transacoes.filter(t => {
    const dr = normalizarData(t.dataReferencia);
    return dr && dr.startsWith(prefixo);
});
```

---

### 🟢 BUG 11 — `hideSplash` chamado a cada disparo do onSnapshot

**Onde:** `js/balanco-mensal.js` linha 98  
**Código atual:**
```javascript
_unsubs.push(onSnapshot(..., snap => {
    if (window.hideSplash) window.hideSplash();
    transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
    renderizar();
}));
```

**Problema:** O `hideSplash()` é chamado **toda vez** que o snapshot dispara — na carga inicial E em cada atualização de qualquer transação. Após a primeira chamada, o splash já foi removido, então as chamadas subsequentes são no-ops inúteis.

**Impacto:** 🟢 Negligível em performance, mas indica código não-intencional.

🔧 **SOLUÇÃO:**
```javascript
let splashHidden = false;
_unsubs.push(onSnapshot(..., snap => {
    if (!splashHidden && window.hideSplash) { window.hideSplash(); splashHidden = true; }
    transacoes = snap.docs.map(d => ({...d.data(), id: d.id}));
    renderizar();
}));
```

---

### 🟢 BUG 12 — Barras percentuais representam proporção do total, não impacto real

**Onde:** `js/balanco-mensal.js` linhas 65-70  
**Código atual:**
```javascript
const total = receitas + despesas || 1;
const pR = ((receitas/total)*100).toFixed(1);
const pD = ((despesas/total)*100).toFixed(1);
```

**Problema:** Os percentuais mostram a **proporção relativa** (receitas como % do total movimentado). Exemplo: receitas R$10.000, despesas R$9.000 → mostra "52.6% / 47.4%". Isso é matematicamente correto mas **financeiramente pouco informativo** — o dado relevante é "gastei 90% da minha renda".

**Cenário real:** Usuário vê "Despesas: 47.4%" e acha que está gastando menos da metade. Na realidade, gastou 90% do que ganhou.

**Impacto:** 🟢 UX confusa, transmite sensação de economia que não existe.

🔧 **SOLUÇÃO:**
```javascript
// Mostrar dois indicadores:
// 1. Proporção de gasto sobre receita (como está):
const comprometimento = receitas > 0 ? ((despesas/receitas)*100).toFixed(1) : '0';
// "Você gastou 90% da sua renda"

// 2. Manter barras atuais como visualização complementar
const total = receitas + despesas || 1;
const pR = ((receitas/total)*100).toFixed(1);
const pD = ((despesas/total)*100).toFixed(1);
```

---

### 🟢 BUG 13 — `valoresOcultos` não persiste entre reloads

**Onde:** `js/balanco-mensal.js` linhas 11, 19  
**Código atual:**
```javascript
let valoresOcultos = false;
// ...
window.toggleOcultarValores = function() { valoresOcultos = !valoresOcultos; renderizar(); };
```

**Problema:** O estado do olhinho (ocultar/mostrar valores) é perdido ao recarregar a página ou navegar entre telas. Em outras telas (como dashboard), esse estado é geralmente sincronizado via `localStorage`.

**Impacto:** 🟢 Pequeno inconveniente de UX — usuário precisa re-ocultar a cada visita.

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

### 🟢 BUG 14 — Paywall via innerHTML hardcoded (manutenção duplicada)

**Onde:** `js/balanco-mensal.js` linhas 89-95  
**Código atual:**
```javascript
if (mainContent) mainContent.innerHTML = '<div class="flex flex-col items-center justify-center py-20 px-4 text-center">'
    + '<div class="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-5" style="background:rgba(139,92,246,0.1);">🔒</div>'
    + '<h2 class="text-xl font-extrabold text-slate-800 mb-2">Recurso do plano Plus</h2>'
    // ...
```

**Problema:** O HTML do paywall é um bloco gigante construído via string concatenation. Esse mesmo padrão é copiado em praticamente todas as telas premium. Qualquer mudança no visual do paywall (ex: texto, CTA, estilo) precisa ser feita em dezenas de arquivos.

Além disso, o seletor `document.querySelector('main .p-4') || document.querySelector('main .p-6')` é frágil — se a estrutura do HTML mudar, o paywall pode ser inserido no lugar errado ou não aparecer.

**Impacto:** 🟢 Dívida técnica — manutenção trabalhosa mas funciona.

🔧 **SOLUÇÃO:**
```javascript
// Centralizar paywall em bud-utils.js:
window.budShowPaywall = function(featureName, planRequired) {
    const mainContent = document.querySelector('main .p-4, main .p-6, main .p-8');
    if (!mainContent) return;
    mainContent.innerHTML = ''; // limpar
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5rem 1rem;text-align:center;';
    div.innerHTML = `<div style="width:5rem;height:5rem;border-radius:1rem;display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin-bottom:1.25rem;background:rgba(139,92,246,0.1);">🔒</div>`
        + `<h2 style="font-size:1.25rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem;">Recurso do plano ${planRequired}</h2>`
        + `<p style="font-size:0.875rem;color:#64748b;max-width:24rem;margin-bottom:1.5rem;">${featureName} está disponível a partir do plano <strong style="color:#7c3aed;">${planRequired}</strong>.</p>`
        + `<a href="configuracoes.html#planosSection" style="background:linear-gradient(to right,#8b5cf6,#7c3aed);color:white;font-weight:800;padding:0.75rem 1.5rem;border-radius:0.75rem;font-size:0.875rem;text-decoration:none;">Ver Planos</a>`;
    mainContent.appendChild(div);
};

// Uso:
window.budShowPaywall('Balanço mensal detalhado', 'Plus');
```

---

### 🟢 BUG 15 — Sem feedback visual ao navegar entre meses

**Onde:** `js/balanco-mensal.js` funções `mudarMes`, `selecionarMes`  

**Problema:** Quando o usuário navega para um mês e os dados já estão em memória, o render é instantâneo (ok). Porém, se o mês não tiver transações, a UX mostra "Nenhuma transação neste mês" sem transição — a mudança é abrupta. Não há animação ou feedback confirmando que o mês mudou.

No mobile, o texto do mês (`#textoMes`) no header é **invisível** — ele existe no componente desktop-only (`.hidden.md:flex`). O mobile não mostra em nenhum lugar qual mês está selecionado exceto no modal de seleção.

**Impacto:** 🟢 UX confusa no mobile — usuário não sabe qual mês está vendo após fechar o modal.

🔧 **SOLUÇÃO:**
```html
<!-- Adicionar indicador de mês no mobile, dentro do header -->
<span id="textoMesMobile" class="md:hidden text-sm font-bold text-slate-600 capitalize"></span>
```
```javascript
function atualizarMes() {
    const texto = dataFiltro.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(' de ',' ');
    document.getElementById('textoMes').innerText = texto;
    const elMobile = document.getElementById('textoMesMobile');
    if (elMobile) elMobile.innerText = texto;
}
```

---

## 8. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | limit(5000) sem orderBy | Médio — requer redesign da query |
| 2 | 🔴 | setMonth() mutation | Baixo — adicionar `setDate(1)` |
| 3 | 🔴 | Pendentes nos totais | Baixo — adicionar filtro status |
| 4 | 🟡 | onSnapshot desnecessário | Baixo — trocar por getDocs |
| 5 | 🟡 | Categorias sem distinção tipo | Médio — separar agrupamento + render |
| 6 | 🟡 | sincronizarDados fake | Baixo — re-buscar de fato |
| 7 | 🟡 | Downgrade não persistido | Baixo — updateDoc |
| 8 | 🟡 | Feature flag genérica | Baixo — adicionar flag + alterar check |
| 9 | 🟡 | valor NaN/undefined | Baixo — `Number(t.valor) \|\| 0` |
| 10 | 🟢 | Timestamp na dataReferencia | Médio — função normalizadora |
| 11 | 🟢 | hideSplash repetido | Baixo — flag boolean |
| 12 | 🟢 | Percentuais confusos | Médio — adicionar indicador comprometimento |
| 13 | 🟢 | valoresOcultos não persiste | Baixo — localStorage |
| 14 | 🟢 | Paywall hardcoded | Médio — centralizar em bud-utils |
| 15 | 🟢 | Sem indicador de mês no mobile | Baixo — adicionar span |

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **15** |
| 🔴 Críticos | 3 |
| 🟡 Altos | 6 |
| 🟢 Baixos | 6 |
| Linhas HTML | 118 |
| Linhas JS | 130 |
| Queries Firestore | 2 (getDoc usuário + onSnapshot transações) |
| Listeners ativos | 1 (onSnapshot) |
| Funções exportadas (window) | 6 (mudarMes, toggleOcultarValores, sincronizarDados, abrirSeletorMes, fecharSeletorMes, mudarAnoSeletor, selecionarMes) |
| Deps externas | firebase-app, firebase-auth, firebase-firestore, bud-utils, plano-config, sidebar, dark-mode, tutorial |

---

## 💚 Pontos Positivos

1. **Código enxuto** — 130 linhas de JS para uma tela analítica completa, boa relação funcionalidade/complexidade
2. **UX responsiva** — header diferenciado desktop (arrows) vs mobile (bottom-sheet calendar), bem pensado
3. **escapeHTML em categorias** — previne XSS na renderização de nomes de categoria do Firestore
4. **Unsubscribe pattern** — `_unsubs.forEach(fn=>fn())` dentro do `onAuthStateChanged` previne memory leaks
5. **Formatação financeira correta** — uso de `toLocaleString('pt-BR', {style:'currency',currency:'BRL'})` para formatação monetária
6. **Seletor de mês mobile elegante** — bottom-sheet com grid 4×3, destaque visual no mês ativo, navegação por ano
7. **Ocultar valores** — funcionalidade de privacidade (olhinho) presente e funcional
8. **Saldo com cor dinâmica** — positivo em azul, negativo em vermelho, feedback visual imediato
