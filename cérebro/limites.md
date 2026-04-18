# 🎯 Tela Limites por Categoria — Documentação Técnica Completa

> Auditoria e documentação realizadas em 09/04/2026  
> Arquivos analisados: `limites.html` (221 linhas) + `js/limites.js` (487 linhas)

---

## 1. Visão Geral da Tela

A tela **Limites por Categoria** permite ao usuário definir tetos de gasto mensais, funcionando como um micro-orçamento:

- ✅ Criar limites por categoria com valor fixo ou percentual da receita
- ✅ Barra de progresso com cores dinâmicas (verde < 80%, amarelo 80-100%, vermelho > 100%)
- ✅ Resumo com: Total Limites, Gasto Atual e Disponível
- ✅ Editar e excluir limites com confirmação modal
- ✅ "Copiar do Mês Anterior": gera limites baseados nos gastos reais do mês anterior (+10%, arredondado, mínimo R$50)
- ✅ Criar categoria personalizada inline (modal com emoji picker de 6 abas)
- ✅ Navegação por mês (← Anterior / Próximo →)
- ✅ Ocultar valores (botão olhinho no mobile)
- ✅ Feature-gate por plano: requer plano Plus (`categoryLimitsAlerts`)

**Acesso:** Via Sidebar → "Limites"  
**Dados Firestore:** `usuarios/{uid}/limites/{limiteId}`, `usuarios/{uid}/transacoes/`, `usuarios/{uid}/categorias/`

---

## 2. Estrutura de Dados (Firestore)

Cada limite é armazenado em `usuarios/{uid}/limites/{limiteId}`:

```javascript
{
  categoria: 'Mercado',          // nome textual da categoria
  tipoLimite: 'valor',           // 'valor' | 'percentual'
  valorLimite: 800,              // R$ fixo, OU valor calculado quando percentual
  percentual: null,              // número (1-100) se tipoLimite === 'percentual', null se 'valor'
  criadoEm: Timestamp,
  atualizadoEm: Timestamp
}
```

O campo `valorLimite` em limites percentuais é calculado **apenas no momento da criação/edição** como snapshot: `Math.round(receitaMes * percentual / 100)`.

Em runtime, `getLimiteEfetivo()` recalcula dinamicamente:
- Se `tipoLimite === 'percentual'` e `receita > 0` → recalcula `receita * percentual / 100`
- Se `tipoLimite === 'percentual'` e `receita === 0` → fallback para `valorLimite` armazenado
- Se `tipoLimite === 'valor'` → retorna `valorLimite` diretamente

---

## 3. Fluxo e Componentes

### Layout da Tela

```
┌─────────────────────────────────────────────┐
│  🎯 Limites                      [header]   │
├─────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │Total   │ │Gasto   │ │Dispon. │  [cards]  │
│  │R$1.800 │ │R$1.240 │ │R$ 560  │          │
│  └────────┘ └────────┘ └────────┘          │
│                                             │
│  📊 Controle de Categoria   [Copiar][+Novo] │
│  ◄  abril de 2026  ►                       │
│  ─────────────────────────────────────────  │
│  🛒 Mercado           30% receita          │
│  R$ 620            / R$ 800                │
│  ████████████████░░░░░  78%                │
│  ─────────────────────────────────────────  │
│  🍽️ Restaurante                 [✏️][🗑️]    │
│  R$ 380            / R$ 300                │
│  ████████████████████  127% - Estourado!   │
│  ─────────────────────────────────────────  │
│  ⛽ Combustível                             │
│  R$ 240            / R$ 500                │
│  █████████░░░░░░░░░░░  48%                 │
└─────────────────────────────────────────────┘
```

### Fluxo de Criação

```
+ Novo → abrirModal()
├─ Dropdown de categoria (custom com emoji) + opção "Criar nova categoria"
├─ Tipo: [$ Valor (R$)] | [% da Receita]
│   ├─ Valor: input com máscara de moeda BR (R$ X.XXX,XX)
│   └─ Percentual: input numérico + hint se receita = 0
└─ Submit → addDoc ou updateDoc em usuarios/{uid}/limites/
```

### Fluxo "Copiar do Mês Anterior"

```
copiarMesAnterior()
├─ Busca despesas do mês anterior (transacoes com tipo ≠ 'receita')
├─ Agrupa por categoria → total por categoria
├─ Para cada categoria:
│   └─ sugerido = max(50, ceil(total * 1.1 / 10) * 10)
│       Exemplo: gasto R$723 → 723 * 1.1 = 795.3 → ceil/10 * 10 = 800
├─ Se já existe limite para a categoria → updateDoc
├─ Se não existe → addDoc
└─ Promise.all (paralelo)
```

### Cálculo do Gasto Atual

```javascript
// Filtra transações do mês selecionado com tipo ≠ 'receita'
despesasMes = transacoes.filter(t =>
    t.dataReferencia.startsWith(prefixo) && t.tipo !== 'receita'
);
// Agrupa por categoria (string match exato)
gastosPorCat[t.categoria] = soma dos valores
// Compara com getLimiteEfetivo(l)
perc = gasto / limiteEfetivo * 100
```

### Cores da Barra de Progresso

| Faixa | Cor Barra | Cor Texto |
|-------|-----------|-----------|
| 0-80% | `bg-emerald-500` | `text-emerald-600` |
| 80-100% | `bg-amber-500` | `text-amber-600` |
| >100% | `bg-red-500` | `text-red-500` + "Limite estourado!" |

---

## 4. Modal "Criar Categoria" Inline

Embutido no HTML, permite criar categorias sem sair da tela:

- Emoji picker com 6 abas: Casa, Comida, Transporte, Saúde, 💰, Lazer + "Todos"
- Grid 8 colunas, max-height scrollável
- Nome (maxlength 40) + tipo (despesa/receita)
- `addDoc` em `usuarios/{uid}/categorias`
- Após salvar, `setTimeout(500ms)` para aguardar `onSnapshot` e auto-selecionar a nova categoria

---

## 5. Listeners em Tempo Real

```javascript
// 3 onSnapshot simultâneos:
onSnapshot(categorias, limit(200))   → categoriasUser[] → atualizarSelect()
onSnapshot(limites, limit(500))      → limites[] → renderizar()
onSnapshot(transacoes, limit(5000))  → transacoes[] → renderizar()
```

Cada vez que qualquer coleção muda, `renderizar()` é chamado (recalcula tudo do zero).

---

## 6. Bugs, Incoerências e Sugestões

---

### 🔴 BUG 1 — `onSnapshot(transacoes, limit(5000))` carrega TODAS as transações sem filtro

**Localização:** `js/limites.js` linha ~477

```javascript
_unsubs.push(onSnapshot(query(collection(db, "usuarios", user.uid, "transacoes"), limit(5000)), function(snap) {
    transacoes = snap.docs.map(function(d) { var data = d.data(); data.id = d.id; return data; });
    renderizar();
}));
```

**Impacto:**
- Carrega até 5.000 documentos do Firestore para calcular gastos de UM mês
- Custo: 5.000 reads × cada vez que qualquer transação muda (listener em tempo real)
- Usuário com 3 anos de histórico (3.000+ transações) paga reads desnecessárias
- O filtro em memória (`startsWith(prefixo)`) descarta >90% dos dados lidos
- Latência de renderização: 5.000 objetos parseados e filtrados em cada `renderizar()`

**🔧 SOLUÇÃO:** Filtrar pelo mês no Firestore:

```javascript
function montarQueryMes() {
    const prefixo = dataFiltro.getFullYear() + '-' + String(dataFiltro.getMonth() + 1).padStart(2,'0');
    return query(
        collection(db, "usuarios", user.uid, "transacoes"),
        where('dataReferencia', '>=', prefixo + '-01'),
        where('dataReferencia', '<=', prefixo + '-31'),
        limit(5000)
    );
}
```

Nota: requer re-subscribe ao mudar de mês (`mudarMes`).

---

### 🔴 BUG 2 — Nenhuma validação impede criar dois limites para a mesma categoria

**Localização:** `js/limites.js` — formulário submit (linha ~286)

```javascript
// Não verifica se já existe limite para a categoria selecionada
var id = document.getElementById('limiteId').value;
if (id) {
    await updateDoc(...);
} else {
    await addDoc(...); // Cria duplicata sem checar
}
```

**Impacto:**
- Usuário cria limite de R$500 para "Mercado", clica + Novo e cria outro de R$800 para "Mercado"
- O resumo soma ambos: "Total Limites" mostra R$1.300 — mas gasto de Mercado aparece na primeira barra E na segunda
- Duas barras idênticas confundem o usuário
- `copiarMesAnterior` verifica com `existentes.get(categoria)` (match exato), mas criação manual não tem esse check

**🔧 SOLUÇÃO:** Validar antes do `addDoc`:

```javascript
if (!id) {
    const catNorm = normalizeCategoria(cat);
    const existe = limites.find(l => normalizeCategoria(l.categoria) === catNorm);
    if (existe) {
        showToast('Já existe um limite para "' + cat + '". Edite o existente.', 'error');
        return;
    }
}
```

---

### 🔴 BUG 3 — `excluirLimite()` cria overlay com classes Tailwind dinâmicas que não existem no build estático

**Localização:** `js/limites.js` linha ~306

```javascript
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```

**Impacto:**
- `bg-black/40` e `z-[9999]` são valores arbitrários (arbitrary values) que NÃO existem no CSS compilado
- O overlay aparece sem fundo escuro e sem z-index → modal de confirmação fica invisível ou atrás do conteúdo
- Usuário clica "Excluir" e nada aparece visualmente → possível exclusão acidental se clicar "Enter"
- O overlay EXISTE no DOM mas é estilisticamente quebrado

**🔧 SOLUÇÃO:** Usar style inline:

```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 BUG 4 — Comparação de categorias é case-sensitive em `renderizar()` e `copiarMesAnterior()`

**Localização:** `js/limites.js` linhas ~361 e ~321

```javascript
// renderizar() — match exato entre transação.categoria e limite.categoria
gastosPorCat[l.categoria] || 0

// copiarMesAnterior() — match exato entre transação.categoria e limite existente
var existente = existentes.get(categoria);
```

**Impacto:**
- Se transação tem `categoria: "uber/taxi"` (sem acento, do detectarCategoria) e o limite tem `categoria: "Uber/Táxi"` (do dropdown), a barra mostra R$0 de gasto
- `copiarMesAnterior` cria um limite novo para "uber/taxi" ao lado do existente "Uber/Táxi" → duplicata
- Inconsistência amplificada em transações importadas que passam por normalização diferente

**🔧 SOLUÇÃO:** Normalizar ao agrupar gastos:

```javascript
// renderizar():
despesasMes.forEach(t => {
    const cat = normalizeCategoria(t.categoria || 'Outros');
    gastosPorCat[cat] = (gastosPorCat[cat] || 0) + t.valor;
});
// E ao ler:
const gasto = gastosPorCat[normalizeCategoria(l.categoria)] || 0;

// copiarMesAnterior():
var existentes = new Map(limites.map(o => [normalizeCategoria(o.categoria), o]));
// ...
var existente = existentes.get(normalizeCategoria(categoria));
```

---

### 🟡 BUG 5 — `tipo !== 'receita'` inclui transações com tipo inválido como "Transferência"

**Localização:** `js/limites.js` linhas ~321 e ~360

```javascript
// copiarMesAnterior():
var despesasAnt = transacoes.filter(t =>
    t.dataReferencia && t.dataReferencia.startsWith(prefixoAnt) && t.tipo !== 'receita'
);

// renderizar():
var despesasMes = transacoes.filter(t =>
    t.dataReferencia && t.dataReferencia.startsWith(prefixo) && t.tipo !== 'receita'
);
```

**Impacto:**
- Bug #1 do importar.js salva transações PIX com `tipo: 'Transferência'`
- Essas transações passam no filtro `!== 'receita'`, contando como despesa
- Pix recebido de R$5.000 aparece como gasto de R$5.000 na categoria Transferência
- `copiarMesAnterior` sugere limite de R$5.500 para "Transferência"
- Saldo Disponível fica extremamente negativo sem motivo real

**🔧 SOLUÇÃO:** Filtrar explicitamente por `tipo === 'despesa'`:

```javascript
var despesasMes = transacoes.filter(t =>
    t.dataReferencia && t.dataReferencia.startsWith(prefixo) && t.tipo === 'despesa'
);
```

---

### 🟡 BUG 6 — `renderizar()` usa `t.valor` sem `parseFloat`, mas `getReceitaMes()` usa `parseFloat(t.valor)`

**Localização:** `js/limites.js` linhas ~239 e ~362

```javascript
// getReceitaMes() — com parseFloat:
.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

// renderizar() — sem parseFloat:
gastosPorCat[cat] = (gastosPorCat[cat] || 0) + t.valor;
```

**Impacto:**
- Se alguma transação no Firestore tem `valor` como string (dados migrados, bug de importação), `gastosPorCat` concatena strings: `"0" + "200" = "0200"` → barra mostra 200% em vez de 25%
- Inconsistência: receita é parseada, despesa não
- Difícil de debugar porque geralmente funciona (Firestore normalmente armazena números)

**🔧 SOLUÇÃO:**

```javascript
gastosPorCat[cat] = (gastosPorCat[cat] || 0) + (parseFloat(t.valor) || 0);
```

---

### 🟡 BUG 7 — Limite percentual com receita zero: fallback `valorLimite` é estático e potencialmente desatualizado

**Localização:** `js/limites.js` linha ~344

```javascript
function getLimiteEfetivo(l) {
    if (l.tipoLimite === 'percentual' && l.percentual > 0) {
        var receita = getReceitaMes();
        return receita > 0 ? Math.round(receita * l.percentual / 100) : (l.valorLimite || 0);
    }
    return l.valorLimite || 0;
}
```

**Impacto:**
- Usuário cria limite "30% da receita" em abril (receita R$10.000 → `valorLimite = 3000`)
- Em maio, ancora não lançou receita → `getLimiteEfetivo` retorna R$3.000 (do mês passado)
- Barra de progresso mostra gasto vs R$3.000 — mas a receita do mês é R$0
- Se navegar para mês futuro (receita zero), limites percentuais ficam "congelados" no snapshot de quando foram criados/editados
- Se limite foi criado com receita zero → `valorLimite = 0` → limite é R$0 → qualquer gasto mostra "Estourado!"

**🔧 SOLUÇÃO:** Quando receita é zero e tipo é percentual, mostrar indicação visual (não usar fallback):

```javascript
function getLimiteEfetivo(l) {
    if (l.tipoLimite === 'percentual' && l.percentual > 0) {
        var receita = getReceitaMes();
        if (receita > 0) return Math.round(receita * l.percentual / 100);
        return 0; // Sem receita = sem limite efetivo
    }
    return l.valorLimite || 0;
}
// No renderizar, exibir msg especial ao invés de barra com 0:
if (l.tipoLimite === 'percentual' && limiteEfetivo === 0) {
    // Mostrar "Aguardando receita do mês" ao invés de barra
}
```

---

### 🟡 BUG 8 — `showToast()` local duplica funcionalidade de `window.budShowToast`

**Localização:** `js/limites.js` linha ~411

```javascript
window.showToast = function(msg, tipo) {
    tipo = tipo || 'success';
    var container = document.getElementById('toast-container');
    var t = document.createElement('div');
    t.className = 'px-6 py-3 rounded-2xl shadow-xl font-bold text-xs uppercase tracking-widest border ...';
    t.innerText = msg;
    container.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
};
```

**Impacto:**
- Todas as outras telas usam `window.budShowToast()` de `bud-utils.js`
- Toast de `limites.js` tem estilo totalmente diferente (uppercase, tracking-widest, sem ícone, sem animação)
- Não suporta tipos 'warning' e 'info' (apenas 'success' e 'error')
- Se `budShowToast` for atualizado (novas animações, posição), a tela de limites não herda

**🔧 SOLUÇÃO:** Substituir todas as chamadas `showToast(...)` por `window.budShowToast(...)` e remover a função local.

---

### 🟡 BUG 9 — `salvarNovaCategoria()` usa `setTimeout(500ms)` como hack de sincronização

**Localização:** `js/limites.js` linha ~189

```javascript
await addDoc(collection(db, "usuarios", currentUser.uid, "categorias"), {...});
fecharMiniCriarCategoria();
showToast('Categoria "' + nome + '" criada!');
setTimeout(function() { atualizarSelect(); selecionarCategoria(nome); }, 500);
```

**Impacto:**
- Em redes lentas (3G, WiFi instável), onSnapshot da coleção `categorias` pode demorar >500ms
- `selecionarCategoria(nome)` falha silenciosamente se a categoria não foi ainda adicionada ao `_categoriasLista`
- O dropdown volta para "Selecione uma categoria" ao invés de pré-selecionar a nova
- Nenhum feedback de que algo falhou

**🔧 SOLUÇÃO:** Ao invés de setTimeout, observar a atualização do `categoriasUser` diretamente:

```javascript
await addDoc(collection(db, "usuarios", currentUser.uid, "categorias"), {...});
fecharMiniCriarCategoria();
// Adicionar à lista localmente (otimistic update)
categoriasUser.push({ nome, emoji, tipo });
atualizarSelect();
selecionarCategoria(nome);
window.budShowToast('Categoria "' + nome + '" criada!');
```

---

### 🟡 BUG 10 — Dropdown de categorias no modal não indica quais já têm limite

**Localização:** `js/limites.js` função `renderDropdownItems()`

```javascript
container.innerHTML = lista.map(cat =>
    '<button type="button" onclick="selecionarCategoria(\'...')">' +
    '<span>' + escapeHTML(cat.nome) + '</span></button>'
).join('');
// Nenhuma indicação de que 'Mercado' já tem limite de R$800
```

**Impacto:**
- Ao criar novo limite, dropdown mostra "Mercado" sem indicar que já existe um limite para ela
- Facilita criação de duplicatas (Bug #2)
- Experiência confusa para quem tem muitos limites

**🔧 SOLUÇÃO:** Marcar categorias com limite existente:

```javascript
const comLimite = new Set(limites.map(l => normalizeCategoria(l.categoria)));
container.innerHTML = lista.map(cat => {
    const temLimite = comLimite.has(normalizeCategoria(cat.nome));
    return '<button type="button" ...>' +
        '<span>' + escapeHTML(cat.emoji) + '</span>' +
        '<span>' + escapeHTML(cat.nome) + (temLimite ? ' <span class="text-amber-500 text-xs">(já tem limite)</span>' : '') + '</span></button>';
}).join('');
```

---

### 🟡 BUG 11 — Sem `try/catch` em qualquer operação Firestore

**Localização:** `js/limites.js` — `formLimite.submit`, `excluirLimite`, `copiarMesAnterior`, `salvarNovaCategoria`

```javascript
// Exemplo — submit:
if (id) {
    await updateDoc(doc(db, "usuarios", currentUser.uid, "limites", id), dados);
    showToast('Limite atualizado!');
} else {
    await addDoc(collection(db, "usuarios", currentUser.uid, "limites"), {...});
    showToast('Limite criado!');
}
// Nenhum try/catch — se falha, Promise rejection não tratada
```

**Impacto:**
- Erro de rede → nenhum feedback ao usuário, modal fecha como se tivesse salvo
- Se `updateDoc` falhar em `copiarMesAnterior` (que usa `Promise.all`), todas as operações podem falhar silenciosamente
- `excluirLimite` pode excluir visualmente (remove overlay) mas não persistir a exclusão

**🔧 SOLUÇÃO:** Envolver em try/catch com feedback:

```javascript
try {
    await updateDoc(...);
    showToast('Limite atualizado!');
} catch (err) {
    console.error('Erro ao salvar limite:', err);
    showToast('Erro ao salvar. Verifique sua conexão.', 'error');
}
```

---

### 🟡 BUG 12 — `copiarMesAnterior()` não normaliza categoria na comparação com limites existentes

**Localização:** `js/limites.js` linha ~323

```javascript
var existentes = new Map(limites.map(o => [o.categoria, o]));
// ...
var existente = existentes.get(categoria);
// categoria vem de t.categoria (transação) — match exato
```

**Impacto:**
- Se a transação tem `categoria: "Uber/Taxi"` e o limite existente tem `categoria: "Uber/Táxi"`, o `Map.get()` retorna `undefined` → cria limite duplicado
- Mesma raiz do Bug #4, mas especificamente em `copiarMesAnterior`
- Cumulativo: cada vez que "Copiar" é clicado sem match, gera mais duplicatas

**🔧 SOLUÇÃO:** Normalizar as chaves do Map:

```javascript
var existentes = new Map(limites.map(o => [normalizeCategoria(o.categoria), o]));
// ...
var existente = existentes.get(normalizeCategoria(categoria));
```

---

### 🟡 BUG 13 — `copiarMesAnterior()` sugere mínimo R$50 para QUALQUER categoria

**Localização:** `js/limites.js` linha ~326

```javascript
var sugerido = Math.max(50, Math.ceil((total * 1.1) / 10) * 10);
```

**Impacto:**
- Gasto de R$5 em "Pedágio" no mês anterior → limite sugerido: R$50 (10x o gasto real)
- Gasto de R$3 em "Estacionamento" → R$50
- Infla artificialmente o "Total Limites" no resumo, dando impressão de folga de orçamento que não existe
- O mínimo de R$50 faz sentido para categorias frequentes (Mercado, Combustível) mas não para esporádicas

**🔧 SOLUÇÃO:** Ajustar o mínimo proporcionalmente ou remover:

```javascript
var margem = Math.ceil((total * 1.1) / 10) * 10;
var sugerido = margem < 20 ? Math.ceil(total * 2) : margem; // Para gastos pequenos: dobra
// OU simplesmente:
var sugerido = Math.ceil((total * 1.1) / 10) * 10 || 10; // mínimo R$10
```

---

### 🟢 BUG 14 — `categoriasPadraoLista` duplicada em múltiplos arquivos (sem fonte única)

**Localização:** `js/limites.js` linhas ~17-33

61 categorias hardcoded inline. A mesma lista (com variações) existe em `js/importar.js` (`categsPadrao`), `js/categorias.js`, `js/dashboard.js`, etc.

**Impacto:**
- Adicionar "Pets" como padrão requer editar N arquivos
- Listas podem divergir entre telas → categoria aparece em uma tela mas não em outra
- Emoji inconsistente: "Restaurante" pode ser 🍽️ numa tela e 🍔 em outra

**🔧 SOLUÇÃO:** Mover para `bud-utils.js` como `window.BudCategoriasPadrao` e importar de todos os módulos.

---

### 🟢 BUG 15 — Navegação por mês sem limite — pode avançar até anos no futuro

**Localização:** `js/limites.js` linha ~245

```javascript
window.mudarMes = d => { dataFiltro.setMonth(dataFiltro.getMonth() + d); atualizarMes(); renderizar(); };
```

**Impacto:**
- Usuário pode navegar até dezembro 2040 sem querer (cliques consecutivos)
- Mostrar limites em meses sem transações gera confusão (tudo verde 0%)
- Sem botão "Voltar ao mês atual"

**🔧 SOLUÇÃO:** Limitar a ±12 meses ou adicionar botão "Hoje":

```javascript
window.mudarMes = d => {
    const nova = new Date(dataFiltro);
    nova.setMonth(nova.getMonth() + d);
    const diff = (nova.getFullYear() - new Date().getFullYear()) * 12 + nova.getMonth() - new Date().getMonth();
    if (Math.abs(diff) > 12) return;
    dataFiltro = nova;
    atualizarMes();
    renderizar();
};
```

---

### 🟢 BUG 16 — `mut.data()` mutado com `data.id = d.id` (mutação do objeto retornado pelo Firestore)

**Localização:** `js/limites.js` linhas ~472 e ~478

```javascript
limites = snap.docs.map(function(d) { var data = d.data(); data.id = d.id; return data; });
transacoes = snap.docs.map(function(d) { var data = d.data(); data.id = d.id; return data; });
```

**Impacto:**
- `d.data()` retorna um novo objeto, então tecnicamente não muta o snapshot diretamente
- Mas o padrão `data.id = d.id` é frágil: se Firestore mudar o comportamento de `data()` (cache, frozen objects), quebra
- Melhor usar spread: `{ ...d.data(), id: d.id }`

**🔧 SOLUÇÃO:** Padrão mais seguro já usado em outros módulos do projeto:

```javascript
limites = snap.docs.map(d => ({ ...d.data(), id: d.id }));
```

---

### 🟢 BUG 17 — `fmt()` sem null-check: se `v` for undefined ou NaN, `toLocaleString` lança erro

**Localização:** `js/limites.js` linha ~13

```javascript
const fmt = v => valoresOcultos ? 'R$ •••••' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

**Impacto:**
- Se `getLimiteEfetivo` retornar `undefined` (ex: `l.valorLimite` é null e `tipoLimite` não é percentual)
- `fmt(undefined)` → `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`
- Tela inteira para de renderizar

**🔧 SOLUÇÃO:**

```javascript
const fmt = v => valoresOcultos ? 'R$ •••••' : (v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

---

## 7. Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)

- [ ] **Bug #1** — `onSnapshot(transacoes, limit(5000))`: filtrar por mês no Firestore
- [ ] **Bug #2** — Validar categoria duplicada antes de criar novo limite
- [ ] **Bug #3** — `excluirLimite()`: usar `style.cssText` inline no overlay (classes dinâmicas não existem no build)
- [ ] **Bug #4** — Normalizar categorias nas comparações de `renderizar()` e `copiarMesAnterior()`

### 🟡 Médio (próximo sprint)

- [ ] **Bug #5** — Filtrar por `tipo === 'despesa'` (não `!== 'receita'`)
- [ ] **Bug #6** — Usar `parseFloat(t.valor)` em `renderizar()` (consistência com `getReceitaMes`)
- [ ] **Bug #7** — Limite percentual com receita zero: exibir mensagem em vez de fallback
- [ ] **Bug #8** — Substituir `showToast()` local por `window.budShowToast()`
- [ ] **Bug #9** — Substituir `setTimeout(500ms)` por optimistic update na criação de categoria
- [ ] **Bug #10** — Indicar categorias com limite existente no dropdown
- [ ] **Bug #11** — Adicionar `try/catch` em todas as operações Firestore
- [ ] **Bug #12** — Normalizar categoria em `copiarMesAnterior()` com `normalizeCategoria()`
- [ ] **Bug #13** — Mínimo de R$50 em `copiarMesAnterior` é alto demais para categorias esporádicas

### 🟢 Leve (melhorias futuras)

- [ ] **Bug #14** — `categoriasPadraoLista`: mover para `bud-utils.js` como fonte única
- [ ] **Bug #15** — Limitar navegação de meses (±12) ou adicionar botão "Hoje"
- [ ] **Bug #16** — Usar spread `{ ...d.data(), id: d.id }` ao invés de mutar o objeto
- [ ] **Bug #17** — Null-check no `fmt()`: `(v || 0).toLocaleString(...)`

---

## 8. Métricas da Auditoria

| Métrica | Valor |
|---------|-------|
| Linhas analisadas | 708 (221 HTML + 487 JS) |
| Bugs encontrados | 17 |
| 🔴 Críticos | 4 |
| 🟡 Médios | 9 |
| 🟢 Leves | 4 |
| Bugs de performance/custo | 1 (Bug #1 — 5.000 reads por listener) |
| Bugs visuais (build estático) | 1 (Bug #3 — overlay invisível) |
| Bugs de dados (contagem incorreta) | 4 (Bug #4, #5, #6, #12) |

---

## 9. Pontos Positivos (O Que Funciona Bem)

- ✅ `copiarMesAnterior()` é uma feature inteligente: sugere limites com +10% de margem arredondado
- ✅ Limites percentuais recalculam dinamicamente em `getLimiteEfetivo()` (sem precisar editar todo mês)
- ✅ Cores da barra de progresso (verde/amarelo/vermelho) com thresholds claros (80%/100%)
- ✅ `normalizeCategoria()` existe e é usada em `getEmojiCategoria` e `getCategoriasCompletas` — falta usar em mais lugares
- ✅ `escapeHTML()` aplicado em todos os valores renderizados no DOM (proteção XSS)
- ✅ Feature-gate por plano com UI dedicada (mensagem "Recurso do plano Plus" com link para upgrade)
- ✅ Emoji picker categorizado é uma UX rica para criação rápida de categorias
- ✅ Input de valor com máscara de moeda BR em tempo real (`toLocaleString` no input event)
- ✅ Layout responsivo com 3 cards em grid + lista scrollável
- ✅ Separação visual limpa entre estado vazio (CTA "Criar Primeiro Limite") e lista populada
