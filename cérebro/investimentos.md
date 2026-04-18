# 💰 Tela: Investimentos

## 📋 Visão Geral

A tela de **Investimentos** permite ao usuário cadastrar, acompanhar e gerenciar seus investimentos financeiros, com cálculos automáticos de rendimento, gráfico de alocação por tipo, alerta de diversificação e painel de mercado financeiro em tempo real (câmbio, cripto, indicadores).

| Item | Detalhe |
|---|---|
| **Arquivo HTML** | `investimentos.html` (255 linhas) |
| **Arquivo JS** | `js/investimentos.js` (487 linhas) |
| **Coleção Firestore** | `usuarios/{uid}/investimentos` |
| **Dependências** | Firebase Auth/Firestore, Chart.js, bud-utils.js (escapeHTML), bud-loader.js, sidebar.js, dark-mode.js, tutorial*.js, plano-config.js |
| **APIs externas** | [AwesomeAPI](https://economia.awesomeapi.com.br) (câmbio + cripto) |
| **Tipo de módulo** | ES Module (`type="module"`) |

---

## 🗄️ Estrutura de Dados (Firestore)

### Documento: `usuarios/{uid}/investimentos/{id}`

```js
{
  nome: "Tesouro Selic 2029",       // string — nome ou ticker
  tipo: "Tesouro Direto",           // string — tipo do investimento
  corretora: "Nubank",              // string — corretora/banco
  valor: 5000,                      // number — valor aportado (R$)
  valorAtual: 5250,                 // number — valor atual (R$)
  rendimento: 5.0,                  // number — rendimento calculado (%)
  liquidez: "Diária",               // string — tipo de liquidez
  vencimento: "2029-03-15",         // string — data de vencimento (ISO)
  data: "2024-06-01",               // string — data do investimento (ISO)
  criadoEm: Timestamp,              // serverTimestamp — criação
  atualizadoEm: Timestamp           // serverTimestamp — última atualização
}
```

### Tipos de investimento suportados

| Tipo | Ícone | Cor no gráfico |
|---|---|---|
| Renda Fixa | 📜 | `#2563eb` |
| Ações | 📊 | `#10b981` |
| FIIs | 🏢 | `#8b5cf6` |
| Cripto | ₿ | `#f59e0b` |
| Poupança | 🐷 | `#06b6d4` |
| CDB | 🏦 | `#3b82f6` |
| Tesouro Direto | 🇧🇷 | `#22c55e` |
| Outro | 💎 | `#94a3b8` |

---

## 🔄 Fluxo da Tela

```
onAuthStateChanged
  ├─ user ? → onSnapshot("investimentos", limit(500))
  │           ├─ hideSplash()
  │           ├─ investimentos = snap.docs.map(...)
  │           └─ renderizar()
  │               ├─ Calcula KPIs (total investido, atual, rendimento)
  │               ├─ Alerta de diversificação (>60% num tipo)
  │               ├─ Chart.js doughnut (alocação por tipo)
  │               └─ Lista de investimentos com benchmark badges
  ├─ carregarMercadoInvest()
  │   ├─ Fetch câmbio (USD, EUR, GBP, BTC, ARS)
  │   ├─ Fetch cripto (ETH, SOL)
  │   └─ Indicadores econômicos (hardcoded!)
  └─ !user → redirect index.html
```

---

## ⚙️ Funções Principais

### JS (`js/investimentos.js`)

| Função | Linha | Descrição |
|---|---|---|
| `fmt(v)` | 13 | Formata valor em BRL ou oculta |
| `toggleOcultarValores()` | 14 | Alterna visibilidade de valores |
| `sincronizarDados()` | 15 | Re-renderiza (sem fetch real) |
| `toggleLiquidezDD()` | 20 | Toggle dropdown de liquidez |
| `selectLiquidez(val)` | 25 | Seleciona opção de liquidez |
| `buildDP(dpId, hiddenId, labelId, selectedDate)` | 39 | Constrói datepicker customizado |
| `dpNav(dpId, dir)` | 72 | Navega meses no datepicker |
| `dpSelectDay(dpId, val)` | 79 | Seleciona dia no datepicker |
| `dpClear(dpId)` | 87 | Limpa data selecionada |
| `toggleDP(dpId, hiddenId)` | 98 | Abre/fecha datepicker |
| `toggleInvestTipoDD()` | 121 | Toggle dropdown de tipo |
| `selectInvestTipo(val, emoji)` | 127 | Seleciona tipo de investimento |
| `setInvestTipoLabel(val)` | 133 | Atualiza label do dropdown tipo |
| `abrirModal(inv)` | 140 | Abre modal (novo ou edição) |
| `fecharModal()` | 179 | Fecha modal |
| `formInvestimento.submit` | 181 | Salva investimento (add/update) |
| `excluirInvestimento(id)` | 200 | Exclui com confirmação |
| `atualizarRendCalc()` | 239 | Preview do rendimento no modal |
| `renderizar()` | 248 | Renderiza toda a tela |
| `carregarMercadoInvest(forcar)` | 418 | Carrega dados de mercado |
| `cardCotacaoInvest(...)` | 393 | Gera card de cotação |
| `cardIndicadorInvest(...)` | 404 | Gera card de indicador |

### Componentes UI customizados

- **Datepicker Bud**: Calendário customizado com navegação mensal, botão "Hoje", botão "Limpar"
- **Dropdown Tipo**: Custom dropdown com ícones emoji
- **Dropdown Liquidez**: Custom dropdown com opções (Diária, No vencimento, 30/60/90 dias)
- **Gráfico Doughnut**: Chart.js para alocação por tipo de investimento
- **Benchmarks**: Badges comparando rendimento anualizado com CDI/IPCA

---

## 🐛 Auditoria de Bugs, Incoerências e Melhorias

### 🔴 BUG 1 — Overlay de exclusão usa classes Tailwind dinâmicas (INVISÍVEL)

**Arquivo:** `js/investimentos.js` · Linha ~200  
**Severidade:** 🔴 Crítico  

```js
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```

**Problema:** As classes `bg-black/40` e `z-[9999]` são valores arbitrários do Tailwind que **não existem no build estático** (`tailwind.css`). O overlay é criado mas fica invisível — sem fundo escuro, sem z-index, sem centralização.

**Impacto:** O diálogo de confirmação de exclusão aparece "flutuando" sem backdrop, ou fica completamente invisível. Usuário pode clicar em excluir e nada parece acontecer.

🔧 **SOLUÇÃO:**
```js
window.excluirInvestimento = async function(id) {
    const ok = await new Promise(resolve => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">' +
            '<p class="text-lg font-bold text-slate-800 mb-2">Excluir investimento</p>' +
            '<p class="text-slate-500 text-sm mb-6">Tem certeza que deseja excluir?</p>' +
            '<div class="flex gap-3">' +
                '<button id="cxlDel" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Cancelar</button>' +
                '<button id="cfmDel" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm">Excluir</button>' +
            '</div></div>';
        document.body.appendChild(ov);
        document.getElementById('cxlDel').onclick = () => { ov.remove(); resolve(false); };
        ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); resolve(false); } });
        document.getElementById('cfmDel').onclick = () => { ov.remove(); resolve(true); };
    });
    if (!ok) return;
    try {
        await deleteDoc(doc(db, "usuarios", currentUser.uid, "investimentos", id));
    } catch (err) {
        console.error('Erro ao excluir investimento:', err);
        if (window.alertaBud) window.alertaBud('Erro ao excluir. Tente novamente.', 'erro');
    }
};
```

---

### 🔴 BUG 2 — `fmt()` sem null-check — crash se valor undefined/null

**Arquivo:** `js/investimentos.js` · Linha 13  
**Severidade:** 🔴 Crítico  

```js
const fmt = v => valoresOcultos ? 'R$ •••••' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

**Problema:** Se `v` for `null`, `undefined` ou `NaN`, a chamada `v.toLocaleString()` lança `TypeError: Cannot read properties of null`. Isso pode acontecer se um investimento tiver `valor: null` ou `valorAtual: undefined` no Firestore.

**Impacto:** A tela inteira para de renderizar. Todos os investimentos desaparecem.

🔧 **SOLUÇÃO:**
```js
const fmt = v => valoresOcultos ? 'R$ •••••' : (Number(v) || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
```

---

### 🔴 BUG 3 — Form submit sem try/catch — erro Firestore silencioso

**Arquivo:** `js/investimentos.js` · Linhas 181-197  
**Severidade:** 🔴 Crítico  

```js
document.getElementById('formInvestimento').addEventListener('submit', async e => {
    e.preventDefault();
    // ... monta dados ...
    const id = document.getElementById('investId').value;
    if(id) await updateDoc(doc(db,"usuarios",currentUser.uid,"investimentos",id), dados);
    else await addDoc(collection(db,"usuarios",currentUser.uid,"investimentos"), {...dados, criadoEm: serverTimestamp()});
    fecharModal();
});
```

**Problema:** Nenhum `try/catch`. Se o Firestore falhar (sem internet, permissão negada, quota excedida), o `await` lança exceção não tratada. O modal não fecha, nenhum feedback é dado ao usuário.

**Impacto:** Usuário preenche todo o formulário, clica salvar, e o app simplesmente "congela" sem feedback.

🔧 **SOLUÇÃO:**
```js
document.getElementById('formInvestimento').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const txtOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Salvando...';
    try {
        const valorInv = parseFloat(document.getElementById('investValor').value) || 0;
        const valorAt = parseFloat(document.getElementById('investValorAtual').value) || valorInv;
        const tipo = document.getElementById('investTipo').value;
        if (!tipo) {
            if (window.alertaBud) window.alertaBud('Selecione o tipo do investimento.', 'aviso');
            return;
        }
        const rendCalc = valorInv > 0 ? ((valorAt - valorInv) / valorInv) * 100 : 0;
        const dados = {
            nome: document.getElementById('investNome').value.trim(),
            tipo,
            corretora: document.getElementById('investCorretora').value.trim(),
            valor: valorInv,
            valorAtual: valorAt,
            rendimento: rendCalc,
            liquidez: document.getElementById('investLiquidez').value,
            vencimento: document.getElementById('investVencimento').value,
            data: document.getElementById('investData').value,
            atualizadoEm: serverTimestamp()
        };
        const id = document.getElementById('investId').value;
        if (id) await updateDoc(doc(db, "usuarios", currentUser.uid, "investimentos", id), dados);
        else await addDoc(collection(db, "usuarios", currentUser.uid, "investimentos"), { ...dados, criadoEm: serverTimestamp() });
        fecharModal();
    } catch (err) {
        console.error('Erro ao salvar investimento:', err);
        if (window.alertaBud) window.alertaBud('Erro ao salvar. Verifique sua conexão.', 'erro');
    } finally {
        btn.disabled = false;
        btn.innerText = txtOriginal;
    }
});
```

---

### 🔴 BUG 4 — Tipo do investimento não é validado — salva vazio

**Arquivo:** `js/investimentos.js` · Linha ~181  
**Severidade:** 🔴 Crítico  

```html
<input type="hidden" id="investTipo" value="">
```

**Problema:** O campo `investTipo` é um `<input type="hidden">` com `value=""` e **sem atributo `required`**. O formulário pode ser enviado sem o usuário selecionar um tipo. O Firestore recebe `tipo: ""`, o que corrompe a lógica de:
- Gráfico de alocação (tipo vazio vira chave `""`)
- Badge de ícone no list item (não encontra ícone)
- Alerta de diversificação (conta "" como tipo real)

**Impacto:** Dados corrompidos. Investimento sem tipo distorce gráficos e alocação.

🔧 **SOLUÇÃO:** Adicionar validação antes de salvar (incluída no BUG 3 acima):
```js
const tipo = document.getElementById('investTipo').value;
if (!tipo) {
    if (window.alertaBud) window.alertaBud('Selecione o tipo do investimento.', 'aviso');
    return;
}
```

---

### 🟡 BUG 5 — Benchmarks hardcoded e duplicados (HTML + JS)

**Arquivo:** `investimentos.html` · Linhas 95-99 / `js/investimentos.js` · Linhas 228-229  
**Severidade:** 🟡 Médio  

**No HTML:**
```html
<span class="text-blue-600">14,75% a.a.</span>  <!-- Selic -->
<span class="text-emerald-600">14,65% a.a.</span> <!-- CDI -->
<span class="text-amber-600">5,53% a.a.</span>    <!-- IPCA -->
<span class="text-slate-500">7,49% a.a.</span>     <!-- Poupança -->
```

**No JS:**
```js
const CDI_AA  = 14.65;
const IPCA_AA = 5.53;
```

**E novamente no JS (indicadores):**
```js
cardIndicadorInvest('🏛️','Selic','14,75% a.a.','Última reunião Copom'),
cardIndicadorInvest('📊','CDI','14,65% a.a.','Referência renda fixa'),
```

**Problema:** Os mesmos valores estão escritos em **3 lugares diferentes**. Quando a Selic mudar, é necessário atualizar manualmente em 3 locais. Fácil esquecer um e criar inconsistência.

🔧 **SOLUÇÃO:** Centralizar benchmarks em um único objeto:
```js
const BENCHMARKS = { selic: 14.75, cdi: 14.65, ipca: 5.53, poupanca: 7.49 };
```
E atualizar o HTML e as funções de indicadores a partir dessa fonte única. Idealmente, buscar via API ou Firestore (coleção `config`).

---

### 🟡 BUG 6 — Indicadores econômicos são FALSOS dados dinâmicos

**Arquivo:** `js/investimentos.js` · Linhas 467-472  
**Severidade:** 🟡 Médio  

```js
document.getElementById('invIndicadoresContainer').innerHTML = [
    cardIndicadorInvest('🏛️','Selic','14,75% a.a.','Última reunião Copom'),
    cardIndicadorInvest('📊','CDI','14,65% a.a.','Referência renda fixa'),
    cardIndicadorInvest('📈','IPCA','5,53% a.a.','Inflação acumulada (IBGE)'),
    cardIndicadorInvest('🐷','Poupança','7,49% a.a.','Rendimento anual'),
].join('');
```

**Problema:** A seção de "Indicadores Econômicos" está dentro do painel de mercado que tem botão "Atualizar" e mostra "Atualizado às HH:MM". Isso dá a **falsa impressão de que os indicadores são buscados em tempo real**, mas na verdade são **valores hardcoded** que nunca mudam.

**Impacto:** Usuário confia em dados desatualizados achando que são reais. Quando Selic mudar, o app continuará mostrando o valor antigo.

🔧 **SOLUÇÃO:** Ou (a) buscar dados reais via API (ex: Banco Central do Brasil), ou (b) mover a seção para fora do painel de mercado e indicar claramente "Valores de referência — atualizado manualmente".

---

### 🟡 BUG 7 — `onSnapshot` com `limit(500)` sem `orderBy`

**Arquivo:** `js/investimentos.js` · Linha 425  
**Severidade:** 🟡 Médio  

```js
onSnapshot(query(collection(db,"usuarios",user.uid,"investimentos"), limit(500)), snap => {
```

**Problema:** `limit(500)` sem `orderBy` significa que o Firestore retorna documentos em **ordem interna indefinida**. Se o usuário tiver mais de 500 investimentos (improvável mas possível com uso intensivo), quais 500 são retornados é imprevisível.

**Impacto:** Investimentos mais recentes podem não aparecer. Sem ordenação, a ordem muda entre sessões.

🔧 **SOLUÇÃO:**
```js
import { orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

onSnapshot(
    query(
        collection(db, "usuarios", user.uid, "investimentos"),
        orderBy("criadoEm", "desc"),
        limit(500)
    ),
    snap => { ... }
);
```

---

### 🟡 BUG 8 — Data vazia/inválida causa NaN no rendimento anualizado

**Arquivo:** `js/investimentos.js` · Linhas 353-356  
**Severidade:** 🟡 Médio  

```js
if (i.data) {
    const inicio = i.data.toDate ? i.data.toDate() : new Date(i.data);
    const dias = Math.max(1, (Date.now() - inicio.getTime()) / 86400000);
    if (dias >= 1) rendPctAnual = (Math.pow(1 + rendPctI/100, 365/dias) - 1) * 100;
}
```

**Problema:** Se `i.data` for uma string vazia `""` (campo opcional), a condição `if (i.data)` é falsa e o trecho é pulado — correto. Mas se `i.data` for uma **string inválida** (ex: `"abc"`, dado corrompido), `new Date("abc")` retorna `Invalid Date`, `inicio.getTime()` retorna `NaN`, e `rendPctAnual` vira `NaN`. O badge de benchmark exibe `NaN%`.

🔧 **SOLUÇÃO:**
```js
if (i.data) {
    const inicio = i.data.toDate ? i.data.toDate() : new Date(i.data + 'T12:00:00');
    if (!isNaN(inicio.getTime())) {
        const dias = Math.max(1, (Date.now() - inicio.getTime()) / 86400000);
        rendPctAnual = (Math.pow(1 + rendPctI / 100, 365 / dias) - 1) * 100;
    }
}
```

---

### 🟡 BUG 9 — Responsividade perdida nos cards de rendimento

**Arquivo:** `js/investimentos.js` · Linhas 291-296  
**Severidade:** 🟡 Médio  

**No HTML (estado inicial):**
```html
<p id="totalRendimento" class="text-lg md:text-2xl font-extrabold text-emerald-600 tracking-tight">...</p>
<p id="totalRendPct" class="text-lg md:text-2xl font-extrabold text-emerald-600 tracking-tight">...</p>
```

**No JS (após renderizar):**
```js
elRend.className = 'text-2xl font-extrabold tracking-tight ' + (totalRend>=0?'text-emerald-600':'text-red-500');
elPct.className  = 'text-2xl font-extrabold tracking-tight ' + (rendPct>=0?'text-emerald-600':'text-red-500');
```

**Problema:** O JS sobrescreve `className` com `text-2xl` fixo, eliminando o breakpoint responsivo original `text-lg md:text-2xl`. No mobile, o texto fica grande demais.

🔧 **SOLUÇÃO:**
```js
elRend.className = 'text-lg md:text-2xl font-extrabold tracking-tight ' + (totalRend >= 0 ? 'text-emerald-600' : 'text-red-500');
elPct.className  = 'text-lg md:text-2xl font-extrabold tracking-tight ' + (rendPct >= 0 ? 'text-emerald-600' : 'text-red-500');
```

---

### 🟡 BUG 10 — `investimentos.sort()` muta array original in-place

**Arquivo:** `js/investimentos.js` · Linha 343  
**Severidade:** 🟡 Médio  

```js
container.innerHTML = investimentos.sort((a,b) => 
    ((b.valorAtual!=null?b.valorAtual:b.valor)||0) - ((a.valorAtual!=null?a.valorAtual:a.valor)||0)
).map(i => { ... }).join('');
```

**Problema:** `Array.sort()` ordena **in-place**, mutando o array `investimentos` a cada chamada de `renderizar()`. Se qualquer código futuro depender da ordem original (por `criadoEm`), o comportamento será inesperado.

🔧 **SOLUÇÃO:**
```js
container.innerHTML = [...investimentos]
    .sort((a,b) => ((b.valorAtual??b.valor)||0) - ((a.valorAtual??a.valor)||0))
    .map(i => { ... }).join('');
```

---

### 🟡 BUG 11 — Vencimento exibido em formato ISO na lista

**Arquivo:** `js/investimentos.js` · Linha 369  
**Severidade:** 🟡 Médio  

```js
const metaInfos = [
    i.tipo && escapeHTML(i.tipo),
    i.corretora && escapeHTML(i.corretora),
    i.liquidez && escapeHTML(i.liquidez),
    i.vencimento && `Vence ${i.vencimento}`    // ← "Vence 2029-03-15"
].filter(Boolean).join(' · ');
```

**Problema:** O vencimento é salvo como string ISO (`"2029-03-15"`) e exibido sem formatação. O usuário vê "Vence 2029-03-15" em vez de "Vence 15/03/2029".

🔧 **SOLUÇÃO:**
```js
function fmtDateBR(iso) {
    if (!iso) return '';
    const p = iso.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

const metaInfos = [
    i.tipo && escapeHTML(i.tipo),
    i.corretora && escapeHTML(i.corretora),
    i.liquidez && escapeHTML(i.liquidez),
    i.vencimento && `Vence ${fmtDateBR(i.vencimento)}`
].filter(Boolean).join(' · ');
```

---

### 🟡 BUG 12 — Annualização distorcida em períodos muito curtos

**Arquivo:** `js/investimentos.js` · Linhas 355-356  
**Severidade:** 🟡 Médio  

```js
const dias = Math.max(1, (Date.now() - inicio.getTime()) / 86400000);
if (dias >= 1) rendPctAnual = (Math.pow(1 + rendPctI/100, 365/dias) - 1) * 100;
```

**Problema:** Para investimentos com poucos dias, a fórmula de annualização produz resultados absurdos. Exemplo: 0,1% em 1 dia → annualizado = `(1,001^365 - 1) × 100 = 44%` → badge "✓ acima CDI" — **completamente enganoso**.

**Impacto:** Badges de benchmark ficam errados para investimentos recentes. Usuário acha que está batendo CDI quando na verdade é volatilidade normal.

🔧 **SOLUÇÃO:** Só annualizar investimentos com pelo menos 30 dias:
```js
if (i.data) {
    const inicio = i.data.toDate ? i.data.toDate() : new Date(i.data + 'T12:00:00');
    if (!isNaN(inicio.getTime())) {
        const dias = Math.max(1, (Date.now() - inicio.getTime()) / 86400000);
        if (dias >= 30) {
            rendPctAnual = (Math.pow(1 + rendPctI / 100, 365 / dias) - 1) * 100;
        } else {
            rendPctAnual = rendPctI; // usar rendimento bruto se < 30 dias
        }
    }
}
```

---

### 🟡 BUG 13 — `sincronizarDados()` não faz sincronização real

**Arquivo:** `js/investimentos.js` · Linha 15  
**Severidade:** 🟡 Médio  

```js
window.sincronizarDados = function() { renderizar(); };
```

**Problema:** O botão de refresh no mobile chama `sincronizarDados()`, que apenas re-renderiza os dados já em memória. **Não refaz o fetch de mercado** nem força um reload do Firestore.

🔧 **SOLUÇÃO:**
```js
window.sincronizarDados = function() {
    renderizar();
    carregarMercadoInvest(true); // forçar atualização de mercado
};
```

---

### 🟢 BUG 14 — Dados da API injetados em `innerHTML` sem escape

**Arquivo:** `js/investimentos.js` · Função `cardCotacaoInvest` (linha ~393)  
**Severidade:** 🟢 Baixo  

```js
function cardCotacaoInvest(icon, nome, valor, variacao, fmtFn) {
    // ...
    return `<div>...<span class="font-extrabold text-slate-700 text-sm">${nome}</span>...<p>${fmtFn(valor)}</p></div>`;
}
```

**Problema:** Os parâmetros `nome` e `valor` vêm da API externa (AwesomeAPI) e são injetados diretamente no `innerHTML`. Embora os nomes atuais sejam hardcoded no código ('Dólar', 'Euro'), o `valor` (`cambio.USDBRL.bid`) vem da API. Se a API fosse comprometida, poderia injetar HTML/JS.

**Risco real:** Baixo — a API retorna números e `fmtFn` usa `parseFloat().toLocaleString()` que sanitiza. Mas é boa prática escapar.

🔧 **SOLUÇÃO:**
```js
function cardCotacaoInvest(icon, nome, valor, variacao, fmtFn) {
    const pos = parseFloat(variacao) >= 0;
    const varStr = (pos ? '+' : '') + parseFloat(variacao).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%';
    return `<div class="p-4 rounded-2xl border border-slate-100 hover:shadow-sm transition-all">
        <div class="flex items-center gap-2 mb-2">
            <span class="text-xl icon-3d">${icon}</span>
            <span class="font-extrabold text-slate-700 text-sm">${escapeHTML(nome)}</span>
            <span class="ml-auto px-2 py-0.5 rounded-lg text-[10px] font-bold ${pos?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}">${escapeHTML(varStr)}</span>
        </div>
        <p class="text-lg font-extrabold text-slate-800">${escapeHTML(fmtFn(valor))}</p>
    </div>`;
}
```

---

### 🟢 BUG 15 — Tratamento de erro inconsistente entre câmbio e cripto

**Arquivo:** `js/investimentos.js` · Linhas 440-460  
**Severidade:** 🟢 Baixo  

```js
// Câmbio — se falhar, vai para o catch geral com mensagem de erro
const resCambio = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,...');

// Cripto — catch silencioso
try {
    const resCrypto = await fetch('https://economia.awesomeapi.com.br/last/ETH-BRL,SOL-BRL');
    // ...
} catch(e) {} // ← silencia completamente
```

**Problema:** O fetch de cripto tem `catch(e) {}` vazio — qualquer erro é silenciado, sem log, sem feedback. O câmbio pelo menos vai para o catch geral. Comportamento inconsistente.

🔧 **SOLUÇÃO:**
```js
try {
    const resCrypto = await fetch('https://economia.awesomeapi.com.br/last/ETH-BRL,SOL-BRL');
    const crypto = await resCrypto.json();
    // ...
} catch (e) {
    console.warn('Erro ao carregar cripto:', e);
}
```

---

### 🟢 BUG 16 — Campo "rendimento" salvo no Firestore é redundante

**Arquivo:** `js/investimentos.js` · Linha 191  
**Severidade:** 🟢 Baixo  

```js
const dados = {
    // ...
    valor: valorInv,
    valorAtual: valorAt,
    rendimento: rendCalc,  // ← redundante: (valorAt - valorInv) / valorInv * 100
    // ...
};
```

**Problema:** O campo `rendimento` é sempre calculável a partir de `valor` e `valorAtual`. Salvar no Firestore gera dados redundantes que podem ficar dessincronizados (se alguém editar `valorAtual` sem recalcular `rendimento` via API/console).

**Impacto:** Baixo — atualmente o JS recalcula tudo em `renderizar()` e nunca lê `rendimento` do Firestore. O campo existe mas é ignorado na leitura.

🔧 **SOLUÇÃO:** Remover `rendimento` do objeto `dados` salvo no Firestore, já que é sempre recalculado no client.

---

### 🟢 BUG 17 — Gráfico donut recriado a cada render (performance)

**Arquivo:** `js/investimentos.js` · Linhas 312-328  
**Severidade:** 🟢 Baixo  

```js
if (chartAlocacao) { chartAlocacao.destroy(); chartAlocacao = null; }
// ... cria novo Chart.js
chartAlocacao = new Chart(ctxEl, { ... });
```

**Problema:** A cada chamada de `renderizar()` o gráfico é destruído e recriado do zero. Chart.js suporta `chart.data = newData; chart.update()` que é mais performático e permite animações de transição suaves.

🔧 **SOLUÇÃO:**
```js
if (chartAlocacao) {
    chartAlocacao.data.labels = tiposKeys;
    chartAlocacao.data.datasets[0].data = tiposVals;
    chartAlocacao.data.datasets[0].backgroundColor = tiposCores;
    chartAlocacao.update();
} else if (ctxEl && tiposKeys.length > 0) {
    chartAlocacao = new Chart(ctxEl, { ... });
}
```

---

## ✅ Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)
- [ ] **BUG 1** — Trocar classes Tailwind por `style.cssText` no overlay de exclusão
- [ ] **BUG 2** — Adicionar null-check no `fmt()`: `(Number(v) || 0)`
- [ ] **BUG 3** — Envolver submit em `try/catch` com feedback visual
- [ ] **BUG 4** — Validar tipo antes de salvar

### 🟡 Médio (corrigir em breve)
- [ ] **BUG 5** — Centralizar benchmarks em único objeto
- [ ] **BUG 6** — Indicar que indicadores são referência manual (ou buscar via API)
- [ ] **BUG 7** — Adicionar `orderBy("criadoEm", "desc")` no query
- [ ] **BUG 8** — Validar `Date` antes de annualizar
- [ ] **BUG 9** — Manter responsividade `text-lg md:text-2xl` nos KPIs
- [ ] **BUG 10** — Usar `[...investimentos].sort()` para não mutar array
- [ ] **BUG 11** — Formatar vencimento como dd/mm/yyyy na lista
- [ ] **BUG 12** — Annualizar somente se dias ≥ 30
- [ ] **BUG 13** — `sincronizarDados()` deve atualizar mercado também

### 🟢 Baixo (melhorias opcionais)
- [ ] **BUG 14** — Escapar dados de API no innerHTML
- [ ] **BUG 15** — Logar erro de cripto em vez de silenciar
- [ ] **BUG 16** — Remover campo `rendimento` redundante do Firestore
- [ ] **BUG 17** — Reutilizar instância Chart.js com `update()` em vez de destroy/create

---

## 📊 Métricas da Auditoria

| Métrica | Valor |
|---|---|
| Total de bugs encontrados | **17** |
| 🔴 Críticos | 4 |
| 🟡 Médios | 9 |
| 🟢 Baixos | 4 |
| Linhas analisadas | 742 (255 HTML + 487 JS) |
| Padrões recorrentes de outras telas | 3 (overlay Tailwind, fmt null-check, submit sem try/catch) |

---

## 💚 Pontos Positivos

1. **Event delegation**: Botões de editar/excluir na lista usam `data-action` com listener único — eficiente e limpo.
2. **`escapeHTML` nos dados do usuário**: Nome, tipo, corretora e liquidez são escapados no innerHTML da lista. Boa proteção contra XSS.
3. **Datepicker customizado completo**: Navegação por meses, seleção, botão "Hoje", botão "Limpar" — UX bem pensada.
4. **Alerta de diversificação**: Avisa quando >60% está em um tipo — funcionalidade inteligente e útil.
5. **Badges de benchmark**: Comparar rendimento com CDI/IPCA é um diferencial informativo.
6. **`investMap` para lookup O(1)**: Mapeia IDs para objetos, evitando `find()` no array.
7. **Cleanup de listeners**: `_unsubs` gerencia desinscrições do onSnapshot corretamente.
8. **Painel de mercado real**: Câmbio e cripto com dados da AwesomeAPI — boa experiência.
9. **Cálculo de rendimento automático no modal**: Preview em tempo real conforme o usuário digita.
10. **Overlay de exclusão com backdrop click**: Fecha ao clicar fora — boa UX.
