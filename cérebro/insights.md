# 📊 Tela: Insights e Análises

## 📋 Visão Geral

A tela **Insights** (`insights.html`) é a **tela mais inteligente** do Bud Finanças — combina análise algorítmica, alertas automáticos, simulação financeira e comparação mensal em uma única interface. Possui **2 abas** principais:

1. **Aba Análises** — Alertas inteligentes (limites, saldo, tendências), insights de economia, resumo semanal, score de saúde financeira (0-100), insights detalhados em cards, simulador de gasto diário com projeção até fim do mês, e notificações push.
2. **Aba Comparativo** — Seletores de 2 meses com dropdown, cards lado a lado (receitas/despesas/saldo/transações), gráfico comparativo bar, comparação por categoria com barras + variação %, e gráfico de categorias.

A tela também integra **push notifications** via Firebase Cloud Messaging (FCM), com registro de token e foreground handler.

| Item | Detalhe |
|---|---|
| **Arquivo HTML** | `insights.html` (342 linhas) |
| **Arquivo JS** | `js/insights.js` (727 linhas) |
| **Coleções Firestore** | `usuarios/{uid}/transacoes` (leitura), `usuarios/{uid}/limites` (leitura), `usuarios/{uid}/carteira` (leitura), `usuarios/{uid}/tokens/fcm` (leitura/escrita) |
| **Dependências** | Chart.js 4.4.1 (CDN), Firebase Auth/Firestore/Messaging, `bud-utils.js`, `bud-loader.js`, `sidebar.js`, `dark-mode.js`, `tutorial*.js` (3), `plano-config.js` |
| **Tipo de módulo** | ES Module (`type="module"`) |
| **CDN externo** | `chart.js@4.4.1` via jsdelivr |
| **Modais** | 1 — Detalhes do Insight |
| **Feature gate** | `NexoPlanos.canUseFeature(userData, 'dailySpendAverage')` — bloqueia para plano free |
| **Push Notifications** | FCM com VAPID key, registro de token em Firestore |
| **Tamanho total** | 1069 linhas (342 HTML + 727 JS) |

### Relação com outras telas

| Tela | Relação |
|---|---|
| `limites.html` | Insights usa os limites cadastrados para gerar alertas de ultrapassagem/proximidade |
| `carteira.html` | Insights usa saldos das contas da carteira para o simulador de gasto diário |
| `relatorios.html` | Duplica parcialmente a aba Comparativo (relatórios tem gráficos de mês único) |
| `comparativo.html` | **Duplicação direta** — existe uma tela `comparativo.html` separada + aba Comparativo aqui |
| `configuracoes.html` | Link para configurar WhatsApp + link para upgrade de plano |
| `extrato.html` | Lê as mesmas transações — extrato é visualização, insights é análise |
| `dashboard.html` | Dashboard mostra resumo; insights faz projeções e alertas |

---

## 🗄️ Estrutura de Dados (Firestore)

### Coleções lidas

| Coleção | Limite | Uso |
|---|---|---|
| `usuarios/{uid}/transacoes` | `limit(5000)` | Transações — base de toda a análise |
| `usuarios/{uid}/limites` | `limit(500)` | Limites por categoria — gera alertas de ultrapassagem |
| `usuarios/{uid}/carteira` | `limit(500)` | Contas (excluindo crédito) — saldo para simulador |

### Coleção escrita

| Coleção | Operação | Dados |
|---|---|---|
| `usuarios/{uid}/tokens/fcm` | `setDoc` | `{ token, atualizadoEm, plataforma, insightsAtivo: true }` |

### Dados NÃO carregados

- Categorias customizadas → alertas usam nome da categoria como vem da transação
- Metas financeiras → não integrado com análise de progresso
- Dívidas → não integrado com saúde financeira

---

## 🏗️ Estrutura do HTML

### Layout Geral

```
<body> (flex, overflow-hidden, 100dvh)
├── #mobileOverlay
├── #sidebar-container
└── <main> (flex-1, overflow-y-auto)
    ├── <header> (h-20, bg-white, sticky, z-30)
    │   ├── Hamburger (md:hidden) → toggleSidebar()
    │   ├── Refresh 🔄 (md:hidden) → sincronizarDados() ← faz window.location.reload()!
    │   ├── Título "📊 Insights e Análises"
    │   └── Subtítulo (hidden md:block) "Análises inteligentes..."
    │   ⚠️ SEM navegação de mês — insights usa mês corrente automaticamente
    │
    └── <div> (p-4 md:p-8, max-w-5xl, space-y-6, pb-20)
        │
        ├── Abas (pill bar, w-fit, scroll horizontal)
        │   ├── [Análises] #abaAnalises → trocarAbaInsight('analises')
        │   └── [Comparativo] #abaComparativo → trocarAbaInsight('comparativo')
        │
        ├── ══════ #painelAnalises ══════
        │   │
        │   ├── 🔔 Alertas Inteligentes (badge IA)
        │   │   └── #alertasContainer ← gerado dinamicamente
        │   │
        │   ├── Grid 2 cols
        │   │   ├── 💡 Insights de Economia (badge IA)
        │   │   │   └── #economiaContainer
        │   │   └── 📋 Resumo Semanal
        │   │       └── #resumoSemanalContainer
        │   │
        │   ├── 🧠 Saúde Financeira (badge IA)
        │   │   ├── SVG circular (score 0-100, animated dasharray)
        │   │   ├── #scoreNum, #scoreLabel, #scoreDesc
        │   │   └── #scoreTags (badges dinâmicas)
        │   │
        │   ├── #insightsContainer ← cards insight detalhados
        │   │
        │   ├── 📅 Planejador de Fim de Mês
        │   │   ├── Label dias restantes (#simDiasLabel)
        │   │   ├── Grid 3 métricas: Saldo Atual, Ritmo/dia, Limite Seguro
        │   │   ├── Slider range (#simSlider) → atualizarSimulador()
        │   │   ├── #simProjecaoBox — saldo projetado (verde/amarelo/vermelho)
        │   │   └── #simSemanas — barras semanais (até 4)
        │   │
        │   └── 🔔 Notificações de Insights
        │       ├── Botão "Ativar Push" (#btnPush) → ativarNotifPush()
        │       ├── Link "Configurar WhatsApp" → configuracoes.html
        │       └── #notifStatus (hidden)
        │
        └── ══════ #painelComparativo (hidden) ══════
            ├── Seletores de Mês (2 dropdowns customizados)
            │   ├── #wrapComp1 → toggleCompDD('comp1')
            │   │   └── #comp1List → #comp1Items (botões por mês)
            │   ├── "vs"
            │   └── #wrapComp2 → toggleCompDD('comp2')
            │       └── #comp2List → #comp2Items
            ├── Grid 2 cards — Mês 1 (azul) vs Mês 2 (violeta)
            │   ├── Receitas, Despesas, Saldo, Transações (×2)
            ├── 📊 Gráfico Comparativo (#compChartComparativo) — bar grouped
            ├── 📋 Comparação por Categoria (#compCategComparativo) — barras
            └── 📈 Variação por Categoria (#compChartCategorias) — bar grouped
```

### Modal de Detalhes do Insight (`#modalInsight`)

```
#modalInsight (fixed, inset-0, bg-slate-900/60, backdrop-blur, z-50, hidden)
└── <div> (max-w-lg, rounded-[2rem])
    ├── Botão X (absolute, top-4 right-4, bg-white/90) → fecharModalInsight()
    └── #modalInsightBody (bg-white, max-h-85vh, overflow-y-auto, p-8)
```

### CSS Customizado (significativo)

| Classe/Seletor | Propósito |
|---|---|
| `@keyframes fadeInUp` | Cards animados na entrada (opacity + translateY) |
| `@keyframes pulseGlow` | Anel pulsante (emerald) nos ícones de loading |
| `@keyframes progressFill` | Barras de progresso animadas (width 0→final) |
| `@keyframes slideRight` | Slide lateral (definido mas **não usado**) |
| `.anim-card` + `.anim-d1..d4` | Animação escalonada 0.05s-0.2s delay |
| `.pulse-ring` | Animação pulseGlow infinite |
| `.progress-anim` | Animação progressFill no resumo semanal |
| `.ia-badge` | Gradiente emerald → verde escuro (badge "IA") |
| `input[type=range]` | Slider custom: thumb azul 24px, track 8px slate |
| `.select-custom` | Select aparência custom com chevron SVG |

### Scripts carregados

1. `chart.js@4.4.1` (CDN) — Gráficos
2. `firebase-config.js` — Config + VAPID_KEY
3. `bud-loader.js` — Splash
4. `bud-utils.js` — escapeHTML, budShowToast
5. `plano-config.js` — Planos
6. `sidebar.js` — Sidebar
7. `js/insights.js` — **Lógica principal** (module)
8. `dark-mode.js` — Tema
9. `tutorial*.js` (3) — Tutorial

---

## 🔄 Fluxo Completo da Tela

### Inicialização

```
js/insights.js carrega (module):
  ├─ Importa Firebase App, Auth, Firestore + Messaging (FCM!)
  ├─ Variáveis:
  │   ├─ transacoes = []        ← até 5000 (limit)
  │   ├─ limites = []           ← até 500
  │   ├─ carteiraGlobal = []    ← até 500
  │   ├─ currentUser = null
  │   ├─ userData = {}
  │   ├─ charts/compCharts = {} ← Chart.js instances
  │   ├─ compVal1/compVal2 = '' ← meses do comparativo
  │   └─ _alertasData = []      ← alertas para o modal
  │
  └─ onAuthStateChanged(auth, async user):
      ├─ _unsubs cleanup
      ├─ user EXISTE:
      │   ├─ currentUser = user
      │   ├─ getDoc(usuarios/{uid}) → userData
      │   ├─ NexoPlanos.resolvePlan → shouldDowngrade? → plano = 'free'
      │   ├─ NexoPlanos.canUseFeature('dailySpendAverage') → se false, BLOQUEIA tela!
      │   │   └─ Substitui conteúdo inteiro por tela de upgrade "Recurso Pro 🔒"
      │   │
      │   ├─ verificarPush() ← verifica se push já está ativo
      │   │
      │   ├─ onSnapshot(transacoes, limit(5000)):
      │   │   ├─ hideSplash()
      │   │   └─ transacoes = [...] → gerarTudo()
      │   │
      │   ├─ onSnapshot(limites, limit(500)):
      │   │   └─ limites = [...] → gerarTudo() (se transacoes.length > 0)
      │   │
      │   └─ onSnapshot(carteira, limit(500)):
      │       └─ carteiraGlobal = [...] → gerarSimulador()
      │
      └─ user NÃO EXISTE → redirect index.html
```

### Fluxo: `gerarTudo()` — Análise central

```
gerarTudo():
  ├─ Definir mês atual + mês passado (prefixos "YYYY-MM")
  ├─ Filtrar doMes + doMesPast
  ├─ Calcular receitas/despesas/categorias para ambos os meses
  │
  ├─ ★ Score de Saúde Financeira (0-100):
  │   ├─ Base: 50
  │   ├─ Taxa poupança: ≥30% → +30 | ≥10% → +15 | ≥0% → +5 | <0% → -20
  │   ├─ Despesas caíram vs mês passado → +10
  │   ├─ >10 transações no mês → +5
  │   ├─ >50 transações total → +5
  │   ├─ Clamp [0, 100]
  │   ├─ Labels: ≥80 "Excelente" | ≥60 "Bom" | ≥40 "Regular" | <40 "Atenção"
  │   └─ SVG circular: dasharray = score, cor = verde/amarelo/vermelho
  │
  ├─ ★ Alertas Inteligentes:
  │   ├─ Para cada limite: gasto > limite → 🚨 DANGER | gasto > 80% → ⚠️ WARNING
  │   ├─ Saldo negativo → 🔴 DANGER
  │   ├─ Gastos subiram >20% → 📈 WARNING
  │   ├─ Sem receita registrada (mas tem transações) → 💡 INFO
  │   ├─ Se 0 alertas + tem transações → ✅ "Tudo em ordem!"
  │   └─ Se 0 transações → "Aprendendo seu perfil..."
  │
  ├─ ★ Insights de Economia:
  │   ├─ Maior categoria de despesa (se ≥2) + % do total + "Tente reduzir!" se >40%
  │   ├─ Categoria que mais cresceu vs mês passado (>15%)
  │   ├─ Categoria que mais diminuiu (>15%)
  │   ├─ Taxa de poupança + conselho (20% mínimo recomendado)
  │   └─ Média diária de gastos + projeção do mês
  │
  ├─ ★ Resumo Semanal:
  │   ├─ Filtra transações da semana corrente (domingo a sábado)
  │   ├─ Se tem transações: receitas/despesas + top 3 categorias
  │   └─ Se não tem: barra de progresso "IA aprendendo" (dias usando vs 14 dias alvo)
  │
  ├─ ★ Insight Cards Detalhados:
  │   ├─ Comparação mês a mês (subiram >10%, caíram >5%, estáveis)
  │   ├─ Maior transação única (se >15% do total)
  │   ├─ Categorias novas (>R$50, não existia mês passado)
  │   ├─ Frequência média de transações/dia
  │   └─ Se sem dados: card "📭 Sem Dados Suficientes"
  │
  ├─ gerarSimulador()
  └─ Se comparativo sem meses → populaSelectsComp()
```

### Fluxo: Simulador de Gasto Diário

```
gerarSimulador():
  ├─ Calcula:
  │   ├─ diasRestantes = último dia do mês - dia atual
  │   ├─ saldoCarteira = Σ contas (excluindo crédito).saldo
  │   ├─ despMes = despesas do mês atual
  │   ├─ gastoMedioDiario = despMes / diaAtual
  │   └─ limiteDiario = saldoCarteira / diasRestantes
  │
  ├─ Configura slider:
  │   ├─ max = max(limiteDiario×3, mediaDiaria×2, 200) arredondado, mínimo 500
  │   ├─ step = max(5, sliderMax/100)
  │   └─ Valor inicial = gastoMedioDiario (se usuário não interagiu)
  │
  ├─ Atualiza métricas: Saldo Atual, Ritmo/dia, Limite Seguro
  │   └─ Badge vermelho se ritmo > limite×1.05, verde se ok
  │
  └─ atualizarSimulador() ← chamado a cada oninput do slider

atualizarSimulador():
  ├─ saldoProjetado = saldoCarteira - (valorSlider × diasRestantes)
  ├─ Box de projeção:
  │   ├─ Negativo → fundo vermelho "⚠️ Atenção: ficará no vermelho!"
  │   ├─ Acima do limite → fundo amarelo "⚡ Acima do limite seguro"
  │   └─ OK → fundo verde "✅ Dentro do orçamento seguro"
  │
  └─ Barras semanais (até 4):
      └─ Para cada semana: saldoCarteira - (valor × min(7×s, diasRestantes))
          └─ Barra proporcional + valor + cor (vermelho se negativo)
```

### Fluxo: Comparativo entre Meses

```
trocarAbaInsight('comparativo'):
  └─ populaSelectsComp() + compararMeses()

populaSelectsComp():
  ├─ Extrai meses únicos das transações (Set de "YYYY-MM")
  ├─ Sort descendente
  ├─ Garante mês atual + mês passado na lista
  ├─ Popula 2 dropdowns (#comp1Items, #comp2Items)
  └─ Auto-seleciona: mês passado (comp1) vs mês atual (comp2)

compararMeses():
  ├─ getCompDados(prefixo) × 2 → { rec, desp, saldo, trans, cats }
  ├─ Atualiza cards: receitas, despesas, saldo, transações (×2)
  ├─ 📊 Gráfico bar grouped: Receitas/Despesas/Saldo por mês
  ├─ 📋 Comparação por categoria: barras azul vs violeta + variação %
  └─ 📈 Gráfico bar grouped: categorias lado a lado
```

### Fluxo: Push Notifications

```
verificarPush():
  ├─ Verifica suporte: Notification + serviceWorker
  ├─ Se permission === 'granted': checa token em Firestore
  │   └─ Se existe → "Push Ativo" + badge verde
  └─ Se permission === 'denied' → "Push Bloqueado" + opacity-50

ativarNotifPush():
  ├─ requestPermission()
  ├─ Register service worker (firebase-messaging-sw.js)
  ├─ getToken(messaging, { vapidKey, sw })
  ├─ setDoc(tokens/fcm, { token, data, plataforma, insightsAtivo })
  └─ onMessage handler (foreground): showNotification via serviceWorker
```

---

## ⚙️ Funções Principais

| Função | Linha | Escopo | Descrição |
|---|---|---|---|
| `fmt(v)` | ~14 | local | `toLocaleString('pt-BR', {style:'currency'})` — **sem toggle de ocultar** |
| `sincronizarDados()` | ~22 | `window` | `window.location.reload()` — **recarrega a página inteira** |
| `verificarPush()` | ~25 | local | Verifica estado do push notification |
| `ativarNotifPush()` | ~43 | `window` | Solicita permissão + registra token FCM |
| `mostrarNotifStatus(msg)` | ~82 | local | Mostra mensagem de status abaixo dos botões |
| `abrirModalInsight(idx)` | ~86 | `window` | Abre modal com detalhes de um alerta |
| `fecharModalInsight()` | ~93 | `window` | Fecha modal |
| `gerarTudo()` | ~103 | local | **Função central** — gera TODOS os insights, alertas, score, resumo |
| `gerarSimulador()` | ~410 | local | Calcula métricas e configura o slider |
| `atualizarSimulador()` | ~464 | `window` | Atualiza projeção a cada movimento do slider |
| `cardInsight(icon, titulo, texto, tipo)` | ~523 | local | Helper que gera HTML de card de insight |
| `toggleCompDD(which)` | ~537 | `window` | Toggle dropdown do comparativo |
| `setCompVal(which, val, lbl)` | ~548 | local | Seta mês selecionado no comparativo |
| `populaSelectsComp()` | ~560 | local | Popula dropdowns com meses existentes |
| `getCompDados(prefixo)` | ~600 | local | Retorna dados financeiros de um mês |
| `compararMeses()` | ~609 | local | Gera cards + gráficos comparativos |
| `trocarAbaInsight(aba)` | ~680 | `window` | Toggle entre Análises e Comparativo |

### Variáveis de Estado

| Variável | Tipo | Valor Inicial | Uso |
|---|---|---|---|
| `transacoes` | `array` | `[]` | Todas as transações (até 5000) |
| `limites` | `array` | `[]` | Limites por categoria |
| `carteiraGlobal` | `array` | `[]` | Contas da carteira |
| `currentUser` | `object\|null` | `null` | Firebase user object |
| `userData` | `object` | `{}` | Dados do usuário (plano, etc.) |
| `charts` | `object` | `{}` | **Não usado** — vazio, apenas `compCharts` é usado |
| `compCharts` | `object` | `{}` | Instâncias Chart.js do comparativo |
| `compVal1` / `compVal2` | `string` | `''` | Meses selecionados no comparativo |
| `_alertasData` | `array` | `[]` | Dados dos alertas para o modal |
| `_unsubs` | `array` | `[]` | Cleanup de listeners |
| `_simState` | `object` (window) | `undefined` | Estado do simulador (saldoCarteira, diasRestantes, limiteDiario) |

---

## 🐛 Auditoria de Bugs, Incoerências e Melhorias

### 🔴 BUG 1 — `sincronizarDados()` faz `window.location.reload()` — comportamento único e pesado

**Arquivo:** `js/insights.js` · Linha ~22  
**Severidade:** 🔴 Crítico (UX/performance)

```js
window.sincronizarDados = function() { window.location.reload(); };
```

**Problema:** Ao contrário de todas as outras telas (que apenas re-renderizam ou re-chamam a função principal), insights recarrega a **página inteira**. Isso significa:

1. Re-download de Chart.js CDN
2. Re-parse de todo o JS (727 linhas)
3. Re-autenticação Firebase
4. Re-attach de 3 onSnapshot listeners (transações, limites, carteira)
5. Re-download de até 5000 transações + 500 limites + 500 carteira
6. Flash branco de loading completo
7. Perde o estado do slider (volta para default)
8. Perde a aba selecionada (volta para "Análises")

Em todas as outras telas `sincronizarDados` apenas chama `renderTudo()` ou similar. Aqui é desproporcionalmente pesado.

🔧 **SOLUÇÃO:**
```js
window.sincronizarDados = function() { gerarTudo(); };
```

---

### 🔴 BUG 2 — `limit(5000)` carrega todas as transações (mesmo padrão recorrente)

**Arquivo:** `js/insights.js` · Linha ~706  
**Severidade:** 🔴 Crítico (performance/custo)

```js
_unsubs.push(onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
    transacoes = snap.docs.map(d=>({...d.data(),id:d.id}));
    gerarTudo();
}));
```

**Problema:** Mesmo padrão de todas as outras telas. A análise usa apenas mês atual + mês passado (2 meses), mas baixa todos os 5000.

**Agravante:** O comparativo precisa de qualquer 2 meses escolhidos pelo usuário, mas poderia carregar sob demanda apenas quando os meses são selecionados.

🔧 **SOLUÇÃO MÍNIMA:** Limitar a 6 meses (cobre mês atual, passado, e permite comparativo razoável):
```js
const seisAtras = new Date();
seisAtras.setMonth(seisAtras.getMonth() - 6);
const limInf = `${seisAtras.getFullYear()}-${String(seisAtras.getMonth()+1).padStart(2,'0')}-01`;
query(collection(...), where("dataReferencia", ">=", limInf), orderBy("dataReferencia", "desc"))
```

---

### 🔴 BUG 3 — `gerarTudo()` é chamada 2x na inicialização (race condition)

**Arquivo:** `js/insights.js` · Linhas ~706-717  
**Severidade:** 🔴 Crítico (performance)

```js
// Listener 1: transações
_unsubs.push(onSnapshot(transacoes_query, snap => {
    transacoes = [...];
    gerarTudo();  // ← CHAMADA 1
}));

// Listener 2: limites
_unsubs.push(onSnapshot(limites_query, snap => {
    limites = [...];
    if(transacoes.length > 0) gerarTudo();  // ← CHAMADA 2 (se transações já chegaram)
}));

// Listener 3: carteira
_unsubs.push(onSnapshot(carteira_query, snap => {
    carteiraGlobal = [...];
    gerarSimulador();  // ← Não chama gerarTudo, ok
}));
```

**Problema:** Na inicialização, todos os snapshots disparam quase simultaneamente:
1. Transações chegam → `gerarTudo()` com `limites = []` (vazio!) → alertas de limite **não aparecem**
2. Limites chegam → `gerarTudo()` novamente → agora alertas aparecem
3. Carteira chega → `gerarSimulador()` → ok

O primeiro render mostra "✅ Tudo em ordem!" mesmo se limites estão ultrapassados. Depois de ~100ms, o segundo render corrige. **Flash de informação errada.**

Além disso, `gerarTudo()` é uma função pesada (cria HTML, calcula score, filtra arrays) — executá-la 2+ vezes é desperdício.

🔧 **SOLUÇÃO:** Debounce:
```js
let _gerarTimer = null;
function requestGerarTudo() {
    clearTimeout(_gerarTimer);
    _gerarTimer = setTimeout(gerarTudo, 100);
}
// Usar requestGerarTudo() em vez de gerarTudo() nos listeners
```

---

### 🔴 BUG 4 — Score de saúde financeira não considera pendentes (pago=false)

**Arquivo:** `js/insights.js` · Linhas ~110-125  
**Severidade:** 🔴 Crítico (dados financeiros errados)

```js
const doMes = transacoes.filter(t => t.dataReferencia && t.dataReferencia.startsWith(prefixo));
// ← Sem filtro por pago/pendente!

doMes.forEach(t => {
    if(t.tipo==='receita') recMes+=t.valor;
    else { despMes+=t.valor; ... }
});
const saldoMes = recMes - despMes;

// Score baseado em saldoMes/recMes
const tp = saldoMes / recMes;
if(tp >= 0.3) score += 30; // ...
```

**Problema:** Uma despesa pendente de R$ 10.000 (ex: parcela de carro ainda não vencida) é somada como se já fosse gasta. Se receita é R$ 5.000, saldo fica -R$ 5.000, e o score despenca (-20 pontos). Mas na realidade nada foi pago ainda.

Todos os insights (alertas, economia, resumo) usam a mesma base sem filtrar.

🔧 **SOLUÇÃO:** Filtrar apenas transações pagas para o cálculo principal, ou pelo menos separar:
```js
const doMes = transacoes.filter(t => t.dataReferencia?.startsWith(prefixo));
const pagos = doMes.filter(t => t.pago !== false);
// Usar pagos para score e alertas
// Usar doMes.length para contagem total
```

---

### 🟡 BUG 5 — `fmt(v)` não tem toggle de ocultar valores (ao contrário de todas as outras telas)

**Arquivo:** `js/insights.js` · Linha ~14  
**Severidade:** 🟡 Médio (inconsistência)

```js
const fmt = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

A tela tem `valoresOcultos` no header (`toggleOcultarValores`), mas **não existe a variável `valoresOcultos` neste arquivo**. Ao clicar no olhinho... nada acontece, porque o `toggleOcultarValores` referencia uma função que não está definida neste módulo (o HTML chama `toggleOcultarValores()` que é window scope — provavelmente vem do `sidebar.js` ou de outra tela, mas aqui não tem efeito).

**Wait** — Na verdade, o header deste arquivo **NÃO tem o botão olhinho**. Tem apenas o hamburger e o refresh. O `toggleOcultarValores` **não é chamado**. Porém, se o usuário ocultar valores em outra tela e voltar para insights, os valores estão visíveis aqui porque `fmt` não respeita `valoresOcultos`.

🔧 **SOLUÇÃO:** Respeitar o estado global:
```js
let valoresOcultos = false;
const fmt = v => valoresOcultos ? 'R$ •••••' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
window.toggleOcultarValores = function() { valoresOcultos = !valoresOcultos; gerarTudo(); };
```

---

### 🟡 BUG 6 — NexoPlanos bloqueia tela inteira de forma agressiva (innerHTML replace)

**Arquivo:** `js/insights.js` · Linhas ~695-702  
**Severidade:** 🟡 Médio (UX + fragilidade)

```js
if (typeof window.NexoPlanos.canUseFeature === 'function' && !window.NexoPlanos.canUseFeature(userData, 'dailySpendAverage')) {
    var mainContent = document.querySelector('main .p-4') || document.querySelector('main .p-6');
    if (mainContent) mainContent.innerHTML = '<div class="flex flex-col items-center ...">🔒 Recurso do plano Pro...</div>';
    return;
}
```

**Problemas:**
1. O seletor `document.querySelector('main .p-4')` é frágil — se o layout mudar (ex: `p-5`), ele não encontra e `mainContent` é `null` → a tela continua normalmente sem bloqueio (bypass acidental do paywall).
2. `return` interrompe TODO o onAuthStateChanged — inclusive o `hideSplash()` que está dentro do listener de transações. O splash nunca desaparece para usuários free.
3. O bloqueio é **todo ou nada** — não permite ver insights básicos com upsell para funcionalidades avançadas.

🔧 **SOLUÇÃO:** Usar container com id fixo:
```html
<div id="insightsContent" class="p-4 md:p-8 ...">
```
```js
if (!canUseFeature) {
    document.getElementById('insightsContent').innerHTML = '...paywall...';
    if (window.hideSplash) window.hideSplash();
    return;
}
```

---

### 🟡 BUG 7 — NexoPlanos sem persistência de downgrade (recorrente)

**Arquivo:** `js/insights.js` · Linhas ~690-694  
**Severidade:** 🟡 Médio

```js
const resolved = window.NexoPlanos.resolvePlan(userData);
if (resolved && resolved.shouldDowngrade) { userData.plano = 'free'; }
// ← Só local, sem updateDoc
```

Mesmo padrão recorrente de extrato e relatórios.

🔧 **SOLUÇÃO:** Persistir com `updateDoc` + usar `BudPlanUtils`.

---

### 🟡 BUG 8 — Comparativo variação % incorreta quando mês 1 tem R$ 0

**Arquivo:** `js/insights.js` · Linha ~648  
**Severidade:** 🟡 Médio (math)

```js
const diff = v1 > 0 ? ((v2-v1)/v1*100).toFixed(0) : (v2>0?'+100':0);
```

**Problema:** Se mês 1 tem R$ 0 e mês 2 tem R$ 500, mostra "+100%". Mas a variação real é infinita (de 0 para qualquer valor = divisão por zero). "+100%" é enganoso — implica que dobrou de R$ 250 para R$ 500.

Para valores como R$ 0 → R$ 50, "+100%" parece informação errada.

🔧 **SOLUÇÃO:**
```js
let diff;
if (v1 === 0 && v2 === 0) diff = '0';
else if (v1 === 0) diff = 'novo';  // Mostrar "novo" em vez de percentual
else diff = ((v2-v1)/v1*100).toFixed(0);
```

---

### 🟡 BUG 9 — Score de saúde financeira é trivialmente gamificável

**Arquivo:** `js/insights.js` · Linhas ~120-130  
**Severidade:** 🟡 Médio (UX enganoso)

```js
let score = 50;                         // Base
if(tp >= 0.3) score += 30;              // Max: +30
if(despMes < despPast) score += 10;     // Max: +10
if(doMes.length > 10) score += 5;       // Max: +5
if(transacoes.length > 50) score += 5;  // Max: +5
// Total possível: 50 + 30 + 10 + 5 + 5 = 100
```

**Problemas:**
1. Apenas 2 meses são comparados — se o usuário gastou R$ 10.000 em março e R$ 9.999 em abril, ganha +10 por "despesas caíram"
2. "transacoes.length > 50" premia quantidade, não qualidade — o usuário que registra muitas despesas pequenas ganha +5 vs quem tem poucas transações grandes
3. A escala é linear e previsível — facilmente atinge 90+ com qualquer poupança ≥30%
4. Não considera: dívidas, limites respeitados, metas atingidas, patrimônio, emergência

🔧 **SOLUÇÃO:** Critérios mais ricos:
```js
// Adicionar:
// - Respeito a limites: nenhum ultrapassado → +10
// - Dívidas: total de dívidas vs patrimônio → ±10
// - Consistência: 3+ meses seguidos positivos → +10
// - Diversificação: despesas bem distribuídas → +5
// Reduzir base de 50 para 30 para dar mais espaço
```

---

### 🟡 BUG 10 — `charts` (sem `comp`) declarado mas nunca populado — dead code

**Arquivo:** `js/insights.js` · Linha ~16  
**Severidade:** 🟡 Baixo (dead code)

```js
let charts = {};  // ← NUNCA atribuído, NUNCA referenciado
```

Apenas `compCharts` é usado (linhas ~533, ~630, ~656). O `charts = {}` é um resquício.

🔧 **SOLUÇÃO:** Remover a linha.

---

### 🟡 BUG 11 — Resumo semanal usa domingo como início (incorrência cultural BR)

**Arquivo:** `js/insights.js` · Linhas ~299-301  
**Severidade:** 🟡 Médio (cultural)

```js
const diaSemana = agora.getDay();         // 0 = domingo
const inicioSemana = new Date(agora);
inicioSemana.setDate(hoje - diaSemana);   // Vai para domingo
```

**Problema:** No Brasil, a semana começa na **segunda-feira** para a maioria das pessoas (convenção ISO 8601 e cultural). Aqui, domingo é o início da semana = transações de sábado são da "semana anterior". Para um app BR, isso é contra-intuitivo.

🔧 **SOLUÇÃO:**
```js
const diaSemana = agora.getDay();
const offsetSeg = diaSemana === 0 ? 6 : diaSemana - 1;  // Segunda = início
const inicioSemana = new Date(agora);
inicioSemana.setDate(hoje - offsetSeg);
```

---

### 🟡 BUG 12 — Simulador usa saldo da carteira, mas carteira pode não estar atualizada

**Arquivo:** `js/insights.js` · Linhas ~416-418  
**Severidade:** 🟡 Médio (dados imprecisos)

```js
const saldoCarteira = carteiraGlobal
    .filter(i => i.tipo !== 'credito')
    .reduce((acc, i) => acc + (i.saldo || 0), 0);
```

**Problema:** O saldo da carteira é um **valor estático** cadastrado pelo usuário. Se ele tem R$ 5.000 no banco, cadastra R$ 5.000 na carteira. Mas as transações não atualizam o saldo automaticamente — se ele gastou R$ 2.000 em despesas este mês, a carteira continua mostrando R$ 5.000.

O simulador projeta: "Se gastar R$ 100/dia × 20 dias = R$ 2.000, saldo projetado = R$ 3.000". Mas na realidade o saldo real já é R$ 3.000 porque os R$ 2.000 já foram gastos.

**Resultado:** Projeção otimista demais. O saldo projetado está inflado por R$ despMes (gastos que já saíram mas não foram subtraídos do saldo da carteira).

🔧 **SOLUÇÃO:** Subtrair despesas já realizadas:
```js
const saldoCarteira = carteiraGlobal
    .filter(i => i.tipo !== 'credito')
    .reduce((acc, i) => acc + (i.saldo || 0), 0);

// Ajustar pelo que já foi gasto mas não necessariamente refletido na carteira
const despJaPagas = doMes.filter(t => t.tipo === 'despesa' && t.pago !== false).reduce((a,t) => a + t.valor, 0);
const saldoReal = saldoCarteira - despJaPagas;
```

Ou melhor: deixar claro na UI que o saldo é "conforme cadastrado na carteira" com link para atualizar.

---

### 🟡 BUG 13 — `@keyframes slideRight` definido no CSS mas nunca usado

**Arquivo:** `insights.html` · Linha ~26  
**Severidade:** 🟡 Baixo (dead code)

```css
@keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
```

Nenhum elemento usa `animation: slideRight`.

🔧 **SOLUÇÃO:** Remover.

---

### 🟢 BUG 14 — Chart.js CDN (mesmo padrão de relatorios)

**Arquivo:** `insights.html` · Linha ~16  
**Severidade:** 🟢 Baixo

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

Mesma questão do relatórios — PWA pode falhar offline.

🔧 **SOLUÇÃO:** Servir localmente.

---

### 🟢 BUG 15 — Comparativo existe como tela separada (`comparativo.html`) E como aba aqui

**Arquivo:** `insights.html` + `comparativo.html`  
**Severidade:** 🟢 Baixo (manutenção/duplicação)

O app tem:
- `/comparativo.html` + `/js/comparativo.js` — tela dedicada de comparação mensal
- Aba "Comparativo" em `/insights.html` — funcionalidade similar dentro dos insights

Duplicação de lógica de comparação, potencialmente com divergências futuras.

🔧 **SOLUÇÃO:** Considerar redirecionar `comparativo.html` para `insights.html#comparativo` ou unificar.

---

### 🟢 BUG 16 — Alertas com HTML inline não-sanitizado no `detalhe`

**Arquivo:** `js/insights.js` · Linhas ~160-175  
**Severidade:** 🟢 Baixo (segurança teórica)

```js
alertas.push({
    titulo: escapeHTML(l.categoria) + ' ultrapassou o limite!',
    detalhe: '<p>A categoria <strong>' + escapeHTML(l.categoria) + '</strong> já acumula ' + fmt(gasto) + '...</p>'
    + '<p>...<a href="limites.html" class="text-emerald-600 font-bold underline">Limites</a>.</p>'
});
```

O `titulo` usa `escapeHTML`, e `l.categoria` no `detalhe` também usa. O `fmt(gasto)` é seguro (number → toLocaleString). Os links são hardcoded. **Está seguro.**

Porém, o código mistura construção de HTML com `+` concatenation extensivamente (~50 linhas de template strings raw). Legibilidade é baixa.

🔧 **SOLUÇÃO:** Sem risco real — apenas recomendação de usar template literals com backtick para melhor legibilidade.

---

### 🟢 BUG 17 — Insight "frequência média" assume mês atual = `agora.getDate()` dias

**Arquivo:** `js/insights.js` · Linhas ~383-386  
**Severidade:** 🟢 Baixo (edge case)

```js
const media = (doMes.length / agora.getDate()).toFixed(1);
insights.push(cardInsight('📅', media + ' transações/dia',
    doMes.length + ' transações em ' + agora.getDate() + ' dias.'));
```

**Problema:** No dia 1 do mês (ex: 1 de abril, `getDate() = 1`), se o usuário tem 30 transações (importadas com data 01/04), a média é `30/1 = 30.0 transações/dia`. Enganoso e alarmante.

🔧 **SOLUÇÃO:**
```js
const diasConsiderados = Math.max(1, agora.getDate() - 1) || 1; // Excluir dia corrente que está em andamento
// Ou simplesmente: se dia <= 1, não mostrar este insight
```

---

### 🟢 BUG 18 — Projeção semanal do simulador pode mostrar 5+ semanas

**Arquivo:** `js/insights.js` · Linhas ~500-514  
**Severidade:** 🟢 Baixo (visual)

```js
for (let s = 1; s <= 4; s++) {
    const diasAteSemana = Math.min(s * 7, st.diasRestantes);
    if (diasAteSemana <= 0 && s > 1) break;
    // ...
}
```

O loop para em 4. Mas se `diasRestantes = 3`, mostra:
- Sem 1: 3 dias (ok)
- Sem 2: `min(14, 3) = 3` → mesma semana que Sem 1!
- Sem 3: mesma coisa
- Sem 4: mesma coisa

Todas as 4 "semanas" mostram o mesmo saldo projetado. Para o usuário, parece redundante.

🔧 **SOLUÇÃO:**
```js
for (let s = 1; s <= 4; s++) {
    const diasAteSemana = Math.min(s * 7, st.diasRestantes);
    if (diasAteSemana <= (s-1) * 7) break; // Não tem mais semanas com dias adicionais
    // ...
}
```

---

## ✅ Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)
- [ ] **BUG 1** — Trocar `location.reload()` por `gerarTudo()` no sincronizar
- [ ] **BUG 2** — Reduzir `limit(5000)` para query filtrada por 6 meses
- [ ] **BUG 3** — Debounce para evitar double `gerarTudo()` na inicialização
- [ ] **BUG 4** — Filtrar transações pendentes no cálculo de score e insights

### 🟡 Médio (corrigir em breve)
- [ ] **BUG 5** — Respeitar `valoresOcultos` no formatter
- [ ] **BUG 6** — Usar ID fixo para o paywall + chamar `hideSplash()` antes do return
- [ ] **BUG 7** — Persistir downgrade + uniformizar NexoPlanos → BudPlanUtils
- [ ] **BUG 8** — Corrigir variação % quando mês 1 é R$ 0
- [ ] **BUG 9** — Enriquecer critérios do score de saúde financeira
- [ ] **BUG 10** — Remover `charts = {}` (dead code)
- [ ] **BUG 11** — Ajustar início da semana para segunda-feira (BR)
- [ ] **BUG 12** — Ajustar saldo da carteira subtraindo despesas já pagas
- [ ] **BUG 13** — Remover `@keyframes slideRight` não usado

### 🟢 Baixo (melhorias)
- [ ] **BUG 14** — Servir Chart.js localmente (PWA offline)
- [ ] **BUG 15** — Unificar comparativo.html com aba Comparativo do insights
- [ ] **BUG 16** — Refatorar templates HTML para template literals (legibilidade)
- [ ] **BUG 17** — Não mostrar "transações/dia" no dia 1 do mês
- [ ] **BUG 18** — Corrigir barras semanais redundantes quando diasRestantes < 7

---

## 📊 Métricas da Auditoria

| Métrica | Valor |
|---|---|
| Total de bugs encontrados | **18** |
| 🔴 Críticos | 4 |
| 🟡 Médios | 9 |
| 🟢 Baixos | 5 |
| Linhas analisadas | 1069 (342 HTML + 727 JS) |
| Listeners Firebase | 3 (transacoes 5000, limites 500, carteira 500) |
| Variáveis de estado | 12 |
| Funções | 16+ |
| Gráficos Chart.js | 2 no comparativo |
| Seções de análise | 6 (alertas, economia, resumo semanal, score, insights, simulador) |
| Código morto | 3 (`charts`, `@keyframes slideRight`, parte do sincronizarDados) |
| Padrões recorrentes de outras telas | 4 (limit 5000, pendentes no cálculo, NexoPlanos sem persist, CDN) |

---

## 💚 Pontos Positivos

1. **Score de saúde financeira com SVG animado:** O círculo SVG com `stroke-dasharray` progressivo e mudança de cor (verde/amarelo/vermelho) é visualmente impactante. A animação `transition-all duration-1000` faz o arco crescer suavemente.

2. **Simulador de gasto diário genuinamente útil:** Feature única no app — slider interativo que projeta saldo no fim do mês com barras semanais. Responde "posso gastar R$ X/dia?". A UX do range input com thumb customizado é polida.

3. **Alertas inteligentes granulares:** Integra limites por categoria (da tela de limites) para gerar alertas contextualizados. Diferencia 80% (aviso) de >100% (danger). Inclui saldo negativo e tendência de gastos crescentes.

4. **Push notifications completas:** Implementação correta de FCM — verifica permissão, registra service worker, obtém token VAPID, salva em Firestore, trata foreground messages. Raros PWAs implementam isso tão completamente.

5. **Feature gating funcional:** `NexoPlanos.canUseFeature('dailySpendAverage')` bloqueia a tela inteira para plano free com CTA de upgrade. É o único app screen com feature gating sofisticado.

6. **Comparativo com 2 dropdowns independentes:** O usuário pode comparar **qualquer** 2 meses, não apenas sequenciais. Auto-preenche com mês atual vs anterior. Gráficos grouped bar + comparação por categoria com variação %.

7. **Insights de economia contextualizados:** Taxa de poupança com benchmark ("20% recomendado"), identificação de categoria que mais cresceu/diminuiu, projeção de gasto mensal. Texto natural e acionável.

8. **3 onSnapshot com cleanup correto:** Transações, limites e carteira — cada um com `_unsubs.push`, cleanup no início. Boa separação de concerns.

9. **`escapeHTML` usado consistentemente:** Nomes de categorias, descrições de transações — todos escapados antes de inserir em HTML. Proteção XSS mantida.

10. **Barra de progresso "IA aprendendo":** Para usuários novos sem dados suficientes, mostra quantos dias de dados tem vs quantos precisa. Dá sensação de que o app está "crescendo" junto com o uso.

11. **Badge "IA" nos cards relevantes:** O badge `ia-badge` (gradiente emerald) dá sensação de inteligência mesmo sendo algoritmos simples. Marketing visual eficaz.

12. **Cards com animação escalonada:** `anim-d1` a `anim-d4` com delays de 50ms criam um efeito cascade de entrada que dá percepção de fluidez e polimento.
