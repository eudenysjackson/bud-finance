# 🛒 Tela: Compras (Mercado)

## 📋 Visão Geral

A tela **Compras** (`mercado.html`) é dedicada a compras de mercado/supermercado. Possui **duas abas**:

1. **Lista** — Criar listas de compras com itens, usar no mercado ("Modo Compras"), preencher preços/marcas, finalizar como compra registrada. Inclui comparativo de preços históricos.
2. **Compras** — Registrar compras já feitas (manual, foto de nota fiscal, ou colar texto de cupom com IA). Histórico, resumo mensal, gastos por forma de pagamento.

| Item | Detalhe |
|---|---|
| **Arquivo HTML** | `mercado.html` (570 linhas) |
| **Arquivo JS** | `js/mercado.js` (1314 linhas) |
| **Coleções Firestore** | `usuarios/{uid}/compras`, `usuarios/{uid}/listas-compras`, `usuarios/{uid}/transacoes` (cria despesa vinculada), `usuarios/{uid}/carteira` (lê pagamentos) |
| **Backend IA** | `https://nexo-backend-4kmu.onrender.com/api/extrair-fatura` |
| **Dependências** | Firebase Auth/Firestore, bud-utils.js (escapeHTML, budShowToast), bud-loader.js, sidebar.js, dark-mode.js, tutorial*.js, plano-config.js |
| **Tipo de módulo** | ES Module (`type="module"`) |

---

## 🗄️ Estrutura de Dados (Firestore)

### Documento: `usuarios/{uid}/compras/{id}`

```js
{
  mercado: "Prezunic",                // string — nome do mercado/loja
  dataReferencia: "2026-04-08",       // string — data da compra (ISO)
  valor: 581.41,                      // number — total da compra
  pagamento: "Débito",                // string — forma de pagamento
  parcelas: 1,                        // number — qtd parcelas (1 = à vista)
  cartaoId: "",                       // string — ID do cartão (se crédito)
  itens: [                            // array — itens da compra
    { desc: "Arroz 5kg", valor: 28.90, marca: "Camil", cat: "Mercado" }
  ],
  criadoEm: Timestamp,
  origem: "compras"                   // string — flag para vincular transações
}
```

### Documento: `usuarios/{uid}/listas-compras/{id}`

```js
{
  nome: "Compras da semana",          // string
  mercado: "Assaí",                   // string (opcional)
  status: "ativa" | "concluida",      // string
  itens: [
    { nome: "Leite", marca: "", valor: 0, quantidade: 1, preenchido: false, cat: "Mercado" }
  ],
  criadoEm: Timestamp,
  atualizadoEm: Timestamp,
  concluidaEm: Timestamp              // só quando concluída
}
```

### Transação vinculada (criada automaticamente)

```js
// usuarios/{uid}/transacoes/{id}
{
  tipo: "despesa",
  descricao: "Prezunic (12 itens)",
  valor: 581.41,
  categoria: "Mercado",               // ← sempre "Mercado" hardcoded
  conta: "Débito",
  dataReferencia: "2026-04-08",
  dataCriacao: Timestamp,
  pago: true,
  cartaoId: "",
  origem: "compras"
}
```

---

## 🔄 Fluxo da Tela

```
onAuthStateChanged
  ├─ user → carregar cartões + carteira (chips pagamento)
  │         ├─ carregarCompras() → getDocs(compras, limit(50))
  │         │   ├─ Resumo mensal (total, qtd, ticket médio, maior)
  │         │   ├─ Lista das últimas 20 compras
  │         │   └─ Gastos por forma de pagamento
  │         └─ construirHistoricoPrecos() → getDocs(compras, limit(100))
  │
  ├─ Aba Lista:
  │   ├─ carregarListas() → getDocs(listas-compras, limit(30))
  │   ├─ carregarComparativoPrecos()
  │   ├─ abrirNovaLista() → modal com itens + sugestões
  │   └─ abrirModoCompras(id) → preencher preços no mercado
  │       └─ finalizarListaCompras() → salvarCompraFirestore()
  │
  ├─ Aba Compras:
  │   ├─ Registro via FOTO → processarArquivo() → backend IA
  │   ├─ Registro via TEXTO → processarTextoNota() → backend IA
  │   ├─ Registro MANUAL → salvarCompraManual()
  │   └─ Todos → salvarCompraFirestore()
  │       ├─ addDoc(compras)
  │       ├─ addDoc(transacoes) × N (parcelas)
  │       └─ sugerirCriacaoIngresso() ← detecção de evento
  │
  └─ !user → redirect index.html
```

---

## ⚙️ Funções Principais

| Função | Linha | Descrição |
|---|---|---|
| `trocarAba(aba)` | ~91 | Alterna entre aba Lista e Compras |
| `abrirModalRegistro()` | ~104 | Abre modal com 3 opções (foto, texto, manual) |
| `abrirUploadFoto()` | ~107 | Dispara input file para foto nota |
| `abrirColaNota()` | ~112 | Abre modal colar texto cupom |
| `abrirRegistroManual()` | ~118 | Abre modal registro manual |
| `processarArquivo(file)` | ~147 | Envia foto/PDF pro backend IA |
| `processarTextoNota()` | ~176 | Envia texto colado pro backend IA |
| `abrirRevisao(transacoes)` | ~207 | Abre modal revisão itens processados pela IA |
| `renderizarItensRevisar()` | ~227 | Renderiza lista editável de itens |
| `ajustarProporcionalmente()` | ~297 | Redistribui valores para bater com total real |
| `salvarCompraManual()` | ~340 | Salva compra digitada manualmente |
| `salvarCompraRevisada()` | ~368 | Salva compra revisada (da IA) |
| `salvarCompraFirestore(compra)` | ~392 | Grava compra + transação(ões) no Firestore |
| `carregarCompras()` | ~441 | Carrega compras do mês + últimas 50 |
| `abrirDetalheCompra(idx)` | ~504 | Abre modal detalhe com itens editáveis |
| `salvarEdicaoCompra()` | ~560 | Salva edição da compra + atualiza transação |
| `excluirCompraCompleta()` | ~598 | Exclui compra + transações vinculadas |
| `construirHistoricoPrecos()` | ~655 | Monta índice de preços por produto |
| `abrirNovaLista()` | ~679 | Abre modal nova lista de compras |
| `salvarNovaLista()` | ~734 | Salva lista no Firestore |
| `carregarListas()` | ~762 | Carrega listas ativas + concluídas |
| `abrirModoCompras(listaId)` | ~831 | Abre "Modo Compras" para preencher no mercado |
| `finalizarListaCompras()` | ~878 | Abre modal para finalizar lista → compra |
| `confirmarFinalizarLista()` | ~904 | Salva compra e marca lista como concluída |
| `verHistoricoProduto(nome)` | ~956 | Modal com histórico de preços de um produto |
| `carregarComparativoPrecos()` | ~990 | Painel comparativo de preços por variação |
| `sugerirCriacaoIngresso(compra)` | ~50 | Detecta ingresso de evento e sugere criar na carteira |

### Modais (10 ao total!)

1. `modalRegistro` — Escolha entre foto, texto ou manual
2. `modalColarNota` — Colar texto do cupom fiscal
3. `modalManual` — Registro manual (mercado, valor, data, pagamento)
4. `modalRevisar` — Revisar itens extraídos pela IA
5. `modalProcessando` — Loading "IA processando..."
6. `modalDetalhe` — Detalhe da compra (editar itens)
7. `modalNovaLista` — Criar nova lista de compras
8. `modalModoCompras` — Modo compras no supermercado
9. `modalFinalizarLista` — Finalizar lista → registrar compra
10. `modalHistoricoPreco` — Histórico de preço de 1 produto

---

## 🐛 Auditoria de Bugs, Incoerências e Melhorias

### 🔴 BUG 1 — Overlays de confirmação usam classes Tailwind dinâmicas (INVISÍVEIS)

**Arquivo:** `js/mercado.js` · Linhas ~49, ~266, ~613, ~822  
**Severidade:** 🔴 Crítico  

```js
// sugerirCriacaoIngresso (linha ~49)
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';

// limparTodosItensRevisar (linha ~266)
ov.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';

// excluirCompraCompleta (linha ~613)
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';

// excluirLista (linha ~822)
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```

**Problema:** `bg-black/40`, `bg-black/50` e `z-[9999]` são valores arbitrários do Tailwind que **não existem no build estático** (`tailwind.css`). Todos os 4 overlays de confirmação ficam invisíveis ou sem backdrop.

**Impacto:** Diálogos de "Excluir compra", "Excluir lista", "Criar evento" e "Excluir todos itens" não funcionam corretamente. O fundo escuro e o z-index não se aplicam.

🔧 **SOLUÇÃO:** Substituir `className` por `style.cssText` em todas as 4 ocorrências:
```js
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 BUG 2 — Parcelas criam N writes sequenciais sem batch/transaction

**Arquivo:** `js/mercado.js` · Linhas ~407-428  
**Severidade:** 🔴 Crítico  

```js
if (compra.parcelas > 1) {
    const valorParcela = +(compra.valor / compra.parcelas).toFixed(2);
    for (let p = 0; p < compra.parcelas; p++) {
        // ...
        await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), { ... });
    }
} else {
    await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), { ... });
}
```

**Problema:** Uma compra em 12x gera **13 writes sequenciais** (1 compra + 12 transações). Se a conexão cair no meio, ficam parcelas orphan no Firestore. Sem `writeBatch()` ou `runTransaction()`, não há atomicidade.

**Impacto adicional:** O `await` sequencial dentro do `for` é lento. 12 parcelas = 12 roundtrips. Usuário espera vários segundos.

🔧 **SOLUÇÃO:**
```js
import { writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function salvarCompraFirestore(compra) {
    const batch = writeBatch(db);
    
    // 1. Doc da compra
    const compraRef = doc(collection(db, 'usuarios', usuarioAtualId, 'compras'));
    batch.set(compraRef, {
        mercado: compra.mercado,
        dataReferencia: compra.data,
        valor: compra.valor,
        pagamento: compra.pagamento,
        parcelas: compra.parcelas,
        cartaoId: compra.cartaoId || '',
        itens: compra.itens.map(i => ({
            desc: i.desc || i.nome || 'Item',
            valor: i.valor || 0,
            marca: i.marca || '',
            cat: i.cat || 'Mercado'
        })),
        criadoEm: serverTimestamp(),
        origem: 'compras'
    });
    
    // 2. Transações (parcelas)
    const descricao = compra.mercado + (compra.itens.length > 1 ? ` (${compra.itens.length} itens)` : '');
    if (compra.parcelas > 1) {
        const valorParcela = +(compra.valor / compra.parcelas).toFixed(2);
        const dataBase = new Date(compra.data + 'T12:00:00');
        for (let p = 0; p < compra.parcelas; p++) {
            const mesParcela = new Date(dataBase);
            mesParcela.setMonth(mesParcela.getMonth() + p);
            const transRef = doc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'));
            batch.set(transRef, {
                tipo: 'despesa', descricao: `${descricao} (${p+1}/${compra.parcelas})`,
                valor: valorParcela, categoria: 'Mercado', conta: compra.pagamento,
                dataReferencia: mesParcela.toISOString().split('T')[0],
                dataCriacao: serverTimestamp(), pago: p === 0,
                cartaoId: compra.cartaoId || '', origem: 'compras'
            });
        }
    } else {
        const transRef = doc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'));
        batch.set(transRef, {
            tipo: 'despesa', descricao, valor: compra.valor, categoria: 'Mercado',
            conta: compra.pagamento, dataReferencia: compra.data,
            dataCriacao: serverTimestamp(), pago: true,
            cartaoId: compra.cartaoId || '', origem: 'compras'
        });
    }
    
    await batch.commit();
    await sugerirCriacaoIngresso(compra); // fora do batch (é interativo)
}
```

---

### 🔴 BUG 3 — Categoria sempre "Mercado" hardcoded — ignora categoria do item

**Arquivo:** `js/mercado.js` · Linhas ~419, ~430  
**Severidade:** 🔴 Crítico  

```js
await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), {
    // ...
    categoria: 'Mercado',   // ← SEMPRE "Mercado", ignora item.cat
    // ...
});
```

**Problema:** Cada item tem campo `cat` que pode ser "Farmácia", "Padaria/Café", "Roupas/Sapatos", etc. Mas a transação criada **sempre** usa `categoria: 'Mercado'`. Isso significa que uma compra na farmácia registrada aqui vai aparecer como "Mercado" no dashboard e nos relatórios.

**Impacto:** Relatórios de categorias ficam distorcidos. Toda compra registrada nesta tela conta como "Mercado" independente do que o usuário selecionou.

🔧 **SOLUÇÃO:** Se todos os itens tiverem a mesma categoria, usar essa. Senão, usar a do item de maior valor ou a majoritária:
```js
function categoriaMajoritaria(itens) {
    const contagem = {};
    itens.forEach(i => { contagem[i.cat || 'Mercado'] = (contagem[i.cat || 'Mercado'] || 0) + (i.valor || 0); });
    return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Mercado';
}
// Na criação da transação:
categoria: categoriaMajoritaria(compra.itens),
```

---

### 🔴 BUG 4 — `sugerirCriacaoIngresso` usa `prompt()` — UX terrível + bloqueante

**Arquivo:** `js/mercado.js` · Linhas ~58-64  
**Severidade:** 🔴 Crítico  

```js
const dataEvento = prompt('Data do evento (AAAA-MM-DD):', compra.data || '');
if (!dataEvento) return;
const horaEvento = prompt('Hora do evento (HH:MM):', '20:00') || '20:00';
const localEvento = prompt('Local do evento:', '') || '';
```

**Problema:** `prompt()` é síncrono, bloqueante, sem validação, e tem visual horrível. Além disso, essa feature de **detecção de ingressos é completamente fora do escopo** de uma tela de compras de mercado/supermercado. Palavras como "show", "festival", "feira" podem aparecer em nomes de supermercados ou produtos.

**Impacto:** Falso positivo — uma compra no "Shopping Festival Norte" ou produto "Festival Cookies" dispara o prompt de ingresso. O `prompt()` quebra a UX mobile.

🔧 **SOLUÇÃO:** Remover completamente a função `sugerirCriacaoIngresso()` e o array `EVENT_KEYWORDS` desta tela, pois estão **fora do escopo** de compras de mercado. Se a detecção de eventos for necessária, deve ser feita na tela de carteira ou dashboard, não aqui.

```js
// REMOVER: linhas ~30-80 (EVENT_KEYWORDS, detectarTipoEventoPorTexto, sugerirCriacaoIngresso)
// REMOVER: await sugerirCriacaoIngresso(compra) na linha ~437
```

---

### 🟡 BUG 5 — Edição da compra busca transações por `descricao.includes()` — match errado

**Arquivo:** `js/mercado.js` · Linhas ~570-582  
**Severidade:** 🟡 Médio  

```js
const transSnap = await getDocs(query(
    collection(db, 'usuarios', usuarioAtualId, 'transacoes'),
    where('origem', '==', 'compras'),
    where('dataReferencia', '==', detalheCompraAtual.dataReferencia)
));
for (const d of transSnap.docs) {
    const data = d.data();
    if (data.descricao && data.descricao.includes(descOriginal)) {
        await updateDoc(...);
    }
}
```

**Problema:** Se o usuário fez 2 compras no mesmo dia no mesmo mercado (ex: "Prezunic" de manhã e "Prezunic" à noite), o `includes(descOriginal)` vai bater em **ambas** as transações. A edição de uma compra modifica a outra.

**Impacto:** Valores de compras diferentes se misturam. Dados corrompidos.

🔧 **SOLUÇÃO:** Salvar o `compraId` como campo na transação para vincular com precisão:
```js
// Na criação (salvarCompraFirestore):
await addDoc(..., { ..., compraId: compraRef.id, origem: 'compras' });

// Na edição:
const transSnap = await getDocs(query(
    collection(db, 'usuarios', usuarioAtualId, 'transacoes'),
    where('compraId', '==', detalheCompraAtual.id)
));
```

---

### 🟡 BUG 6 — `carregarCompras()` usa `getDocs` em vez de `onSnapshot` — dados estáticos

**Arquivo:** `js/mercado.js` · Linha ~442  
**Severidade:** 🟡 Médio  

```js
const snap = await getDocs(query(collection(db, 'usuarios', usuarioAtualId, 'compras'), orderBy('criadoEm', 'desc'), limit(50)));
```

**Problema:** Todas as outras telas do app usam `onSnapshot` para dados em tempo real. Esta tela usa `getDocs` que faz uma leitura única. Se o usuário tiver 2 abas abertas ou editar por outro dispositivo, os dados não atualizam.

**Impacto:** Inconsistência com o padrão do app. Após salvar compra, é necessário chamar `carregarCompras()` manualmente (o que o código já faz, mas não é ideal).

🔧 **SOLUÇÃO:** Migrar para `onSnapshot` com cleanup de listener, similar ao padrão das outras telas.

---

### 🟡 BUG 7 — Soma de parcelas pode divergir do total (arredondamento)

**Arquivo:** `js/mercado.js` · Linha ~407  
**Severidade:** 🟡 Médio  

```js
const valorParcela = +(compra.valor / compra.parcelas).toFixed(2);
```

**Problema:** `581.41 / 3 = 193.8033...` → arredonda para `193.80` → `3 × 193.80 = 581.40` → falta R$ 0,01. A diferença não é corrigida. Com 12 parcelas, a divergência pode chegar a R$ 0,11.

🔧 **SOLUÇÃO:**
```js
const valorBase = Math.floor(compra.valor * 100 / compra.parcelas) / 100;
const resto = Math.round((compra.valor - valorBase * compra.parcelas) * 100) / 100;
// Primeira parcela absorve o resto
for (let p = 0; p < compra.parcelas; p++) {
    const valorParcela = p === 0 ? valorBase + resto : valorBase;
    // ...
}
```

---

### 🟡 BUG 8 — Filtro de compras do mês usa `startsWith` em string — frágil

**Arquivo:** `js/mercado.js` · Linhas ~449-450  
**Severidade:** 🟡 Médio  

```js
const prefixo = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const doMes = todas.filter(c => c.dataReferencia && c.dataReferencia.startsWith(prefixo));
```

**Problema:** Funciona apenas se `dataReferencia` for string ISO. Se o campo vier como Timestamp do Firestore (possível em dados migrados), `startsWith` retorna `undefined` → excluído do filtro → resumo mensal zerado.

**Impacto menor:** O código atual sempre salva como string ISO, mas dados importados de outras fontes podem ter formato diferente.

🔧 **SOLUÇÃO:** Normalizar a data antes de comparar:
```js
function extrairDataRef(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.toDate) return val.toDate().toISOString().split('T')[0];
    return '';
}
const doMes = todas.filter(c => extrairDataRef(c.dataReferencia).startsWith(prefixo));
```

---

### 🟡 BUG 9 — Exclusão de compra busca transações da mesma forma problemática

**Arquivo:** `js/mercado.js` · Linhas ~620-633  
**Severidade:** 🟡 Médio  

```js
// Excluir transações vinculadas — mesmo problema do BUG 5
const transSnap = await getDocs(query(
    collection(db, 'usuarios', usuarioAtualId, 'transacoes'),
    where('origem', '==', 'compras'),
    where('dataReferencia', '==', detalheCompraAtual.dataReferencia)
));
for (const d of transSnap.docs) {
    if (d.data().descricao && d.data().descricao.includes(descOriginal)) {
        await deleteDoc(...);
    }
}
```

**Problema:** Mesmo do BUG 5 — `includes()` pode bater em transações de outra compra do mesmo mercado, no mesmo dia. Pode excluir transações erradas.

🔧 **SOLUÇÃO:** Usar `compraId` (mesma correção do BUG 5).

---

### 🟡 BUG 10 — `onAuthStateChanged` não faz cleanup de dados ao trocar usuário

**Arquivo:** `js/mercado.js` · Linhas ~1276-1314  
**Severidade:** 🟡 Médio  

```js
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtualId = user.uid;
        // ... carrega tudo
    } else {
        window.location.href = 'index.html';
    }
});
```

**Problema:** Se o auth state mudar (logout + login de outro usuário na mesma sessão), as variáveis globais (`comprasCache`, `listasCache`, `historicoPrecosProdutos`, `cartoesGlobais`, etc.) podem manter dados do usuário anterior até o novo `carregarCompras()` completar.

🔧 **SOLUÇÃO:** Limpar state no início do callback:
```js
onAuthStateChanged(auth, async (user) => {
    comprasCache = []; listasCache = []; historicoPrecosProdutos = {};
    cartoesGlobais = []; carteiraItensGlobal = [];
    if (user) { ... }
});
```

---

### 🟡 BUG 11 — Compras mostra TODAS as 50 últimas, mas resumo filtra só o mês

**Arquivo:** `js/mercado.js` · Linhas ~448-452  
**Severidade:** 🟡 Médio  

```js
const snap = await getDocs(query(..., limit(50)));
const todas = [];
snap.forEach(d => todas.push({ id: d.id, ...d.data() }));

const doMes = todas.filter(c => c.dataReferencia && c.dataReferencia.startsWith(prefixo));
// Resumo usa doMes ✓
// Lista usa todas.slice(0, 20) — mostra compras de qualquer mês
```

**Problema:** O resumo (KPIs azuis) é do mês atual. A lista abaixo mostra "Últimas compras" de qualquer mês. Há uma desconexão — o total mostra R$ 581, mas a lista pode ter compras de meses anteriores que não fazem parte desse total.

🔧 **SOLUÇÃO:** Adicionar cabeçalho no resumo indicando o mês, ou filtrar a lista para o mês atual também, com opção de "ver todas".

---

### 🟡 BUG 12 — `adicionarItemModoCompras` usa `prompt()` — ruim no mobile

**Arquivo:** `js/mercado.js` · Linha ~869  
**Severidade:** 🟡 Médio  

```js
window.adicionarItemModoCompras = function() {
    const nome = prompt('Nome do item:');
    if (!nome || !nome.trim()) return;
    // ...
};
```

**Problema:** `prompt()` nativo é blocante, não estilizável, e tem UX ruim no mobile. O mesmo padrão da página usa inputs bonitos em todos os outros lugares, mas aqui usa `prompt()` nativo.

🔧 **SOLUÇÃO:** Criar um campo inline com input + botão, similar ao da tela de Nova Lista (`novaListaItemInput` com `adicionarItemNovaLista()`).

---

### 🟡 BUG 13 — Erro de auth no carregamento de cartões é silenciado

**Arquivo:** `js/mercado.js` · Linha ~1295  
**Severidade:** 🟡 Médio  

```js
try {
    const cartSnap = await getDocs(...);
    // ...carrega carteira...
} catch(e) {}  // ← silencia TUDO
```

**Problema:** Se o carregamento de cartões/carteira falhar, os chips de pagamento ficam vazios (sem Débito, Crédito, PIX). O usuário não consegue salvar nenhuma compra pois "Selecione a forma de pagamento" é obrigatório. E não há nenhuma mensagem de erro.

🔧 **SOLUÇÃO:**
```js
} catch(e) {
    console.error('Erro ao carregar carteira:', e);
    // Gerar chips de fallback estático
    gerarChipsPagamento('manual');
}
```

---

### 🟢 BUG 14 — Código duplicado: processamento de foto e texto são quase idênticos

**Arquivo:** `js/mercado.js` · Linhas ~147-205  
**Severidade:** 🟢 Baixo  

**`processarArquivo(file)` (~30 linhas)** e **`processarTextoNota()` (~30 linhas)** são basicamente a mesma lógica: montar FormData, enviar para `/api/extrair-fatura`, tratar resposta, abrir revisão.

A única diferença é que `processarTextoNota` converte texto em `Blob` → `File` antes de enviar. O `instrucoes` é 100% idêntico (copy-paste).

🔧 **SOLUÇÃO:** Extrair função comum:
```js
async function enviarParaIA(file) {
    document.getElementById('modalProcessando').classList.remove('hidden');
    try {
        const formData = new FormData();
        formData.append('arquivo', file);
        formData.append('instrucoes', INSTRUCOES_NOTA);
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 90000);
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const res = await fetch(BACKEND_URL + '/api/extrair-fatura', {
            method: 'POST', body: formData, signal: ctrl.signal,
            headers: idToken ? { 'Authorization': 'Bearer ' + idToken } : {}
        });
        clearTimeout(timeout);
        if (!res.ok) { /* ... */ }
        const data = await res.json();
        document.getElementById('modalProcessando').classList.add('hidden');
        const transacoes = Array.isArray(data) ? data : (data.itens || data);
        const totalNota = !Array.isArray(data) && data.totalNota ? data.totalNota : null;
        abrirRevisao(transacoes, totalNota);
    } catch(err) { /* ... */ }
}
```

---

### 🟢 BUG 15 — Lista "Últimas compras" não tem paginação

**Arquivo:** `js/mercado.js` · Linha ~484  
**Severidade:** 🟢 Baixo  

```js
todas.slice(0, 20).forEach((c, idx) => { ... });
```

**Problema:** Sempre mostra no máximo 20 compras. Se o usuário tiver centenas, não há "carregar mais" ou paginação. Compras antigas são inacessíveis.

🔧 **SOLUÇÃO:** Botão "Ver mais" que incrementa o offset ou usa `startAfter()` no Firestore.

---

### 🟢 BUG 16 — `pagIcons` duplicado em 2 funções

**Arquivo:** `js/mercado.js` · Linhas ~477, ~513  
**Severidade:** 🟢 Baixo  

```js
// Em carregarCompras():
const pagIcons = { 'Débito': '💳', 'Crédito': '💳', 'PIX': '⚡', 'Dinheiro': '💵', 'VA/VR': '🍽️' };

// Em abrirDetalheCompra():
const pagIcons = { 'Débito': '💳', 'Crédito': '💳', 'PIX': '⚡', 'Dinheiro': '💵', 'VA/VR': '🍽️' };
```

🔧 **SOLUÇÃO:** Mover para constante no topo do módulo.

---

### 🟢 BUG 17 — Sugestões de produtos têm XSS potencial no `onclick`

**Arquivo:** `js/mercado.js` · Linha ~694  
**Severidade:** 🟢 Baixo  

```js
`<button onclick="adicionarSugestao('${escapeHTML(p.nome)}')" ...`
```

**Problema:** `escapeHTML` protege contra injeção de HTML, mas não protege aspas simples em contexto de atributo `onclick`. Se o nome do produto contiver `'` (apóstrofo), como "Pão d'Avó", o `onclick` quebra.

🔧 **SOLUÇÃO:** Usar event delegation ou encode adequado:
```js
`<button data-sugestao="${escapeHTML(p.nome)}" class="sugestao-btn ...`
// + listener delegado no container
```

---

### 🟢 BUG 18 — `construirHistoricoPrecos` carrega 100 compras mas `carregarCompras` carrega 50

**Arquivo:** `js/mercado.js` · Linhas ~442, ~655  
**Severidade:** 🟢 Baixo  

```js
// carregarCompras
const snap = await getDocs(query(..., limit(50)));

// construirHistoricoPrecos
const snap = await getDocs(query(..., limit(100)));
```

**Problema:** Os limites são diferentes e ambos são arbitrários. 50 compras pode ser suficiente, mas o histórico de preços com 100 pode conter compras antigas cujos preços já não são relevantes.

🔧 **SOLUÇÃO:** Usar um `limit` consistente ou filtrar por período (últimos 6 meses).

---

## ✅ Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)
- [ ] **BUG 1** — Trocar classes Tailwind por `style.cssText` nos 4 overlays
- [ ] **BUG 2** — Usar `writeBatch` para compra + transações (atomicidade)
- [ ] **BUG 3** — Usar categoria real dos itens em vez de "Mercado" hardcoded
- [ ] **BUG 4** — Remover `sugerirCriacaoIngresso` + `EVENT_KEYWORDS` (fora do escopo)

### 🟡 Médio (corrigir em breve)
- [ ] **BUG 5** — Vincular transação à compra por `compraId` em vez de `includes()`
- [ ] **BUG 6** — Migrar para `onSnapshot` (padrão do app)
- [ ] **BUG 7** — Corrigir arredondamento de parcelas
- [ ] **BUG 8** — Normalizar `dataReferencia` antes de filtrar
- [ ] **BUG 9** — Exclusão de transações vinculadas por `compraId`
- [ ] **BUG 10** — Limpar variáveis globais no `onAuthStateChanged`
- [ ] **BUG 11** — Alinhar resumo e lista (ambos do mês ou indicar claramente)
- [ ] **BUG 12** — Substituir `prompt()` por input inline no Modo Compras
- [ ] **BUG 13** — Tratar erro de carteira com fallback de chips

### 🟢 Baixo (melhorias opcionais)
- [ ] **BUG 14** — Extrair lógica comum de envio para IA
- [ ] **BUG 15** — Adicionar paginação na lista de compras
- [ ] **BUG 16** — Centralizar `pagIcons` como constante
- [ ] **BUG 17** — Proteger apóstrofos em `onclick` das sugestões
- [ ] **BUG 18** — Unificar limits de queries

---

## 📊 Métricas da Auditoria

| Métrica | Valor |
|---|---|
| Total de bugs encontrados | **18** |
| 🔴 Críticos | 4 |
| 🟡 Médios | 9 |
| 🟢 Baixos | 5 |
| Linhas analisadas | 1.884 (570 HTML + 1.314 JS) |
| Modais na tela | 10 |
| Coleções Firestore envolvidas | 4 |
| Padrões recorrentes de outras telas | 1 (overlay Tailwind invisível — 4 ocorrências) |

---

## 💚 Pontos Positivos

1. **Integração com IA para leitura de notas fiscais**: Suporta foto, PDF e texto colado — muito prático.
2. **Revisão interativa da IA**: O usuário pode editar/remover itens extraídos antes de salvar.
3. **Ajuste proporcional**: Redistribui valores quando total dos itens diverge do total real da nota — algoritmo inteligente com correção de arredondamento.
4. **Modo Compras**: UX dedicada para usar no supermercado com barra de progresso, preço histórico e badges de variação — feature de alto valor.
5. **Comparativo de preços históricos**: Mostra variação de preço de produtos entre compras — ajuda o usuário a economizar.
6. **Sugestões de itens baseadas no histórico**: Produtos frequentes aparcem como chips rápidos na nova lista.
7. **Chips de pagamento dinâmicos**: Lê da carteira do usuário em vez de hardcoded (com fallback estático).
8. **`escapeHTML` consistente**: Usado em dados de mercado, itens, nomes nos chips.
9. **`somarCentavos` evita floating point**: Multiplica por 100 antes de somar — boa prática.
10. **Timeout de 90s nas chamadas de IA**: Protege contra backend Render cold-start com mensagem explicativa.
