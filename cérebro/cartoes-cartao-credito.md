# 💳 Sistema de Cartões de Crédito — Documentação Completa com Análise Crítica

> **Arquivo principal**: `cartoes.html` + `js/cartoes.js`
> **Integrações encontradas**: `js/dashboard.js`, `js/importar.js`, `js/dividas.js`, `js/extrato.js`, `js/recorrentes.js`
> **Integrações AUSENTES (problema)**: `js/balanco-mensal.js` NÃO referencia cartões de crédito

---

## ÍNDICE

1. [Visão Geral do Sistema](#1-visao-geral)
2. [Estrutura Firestore Completa](#2-firestore)
3. [Fluxo: Criar/Editar Cartão](#3-criar-editar)
4. [Fluxo: Adicionar Gasto (Manual)](#4-gasto-manual)
5. [Fluxo: Parcelamento](#5-parcelamento)
6. [Fluxo: Pagamento de Fatura](#6-pagamento-fatura)
7. [Fluxo: Desfazer Pagamento](#7-desfazer-pagamento)
8. [Fluxo: Importação com IA (PDF/Imagem)](#8-importacao-ia)
9. [Fluxo: Editar/Excluir Gasto](#9-editar-excluir)
10. [Fluxo: Estornar/Cancelar/Reativar](#10-estorno-cancelamento)
11. [Fluxo: Excluir Cartão](#11-excluir-cartao)
12. [Renderização dos Cartões e Cálculos](#12-renderizacao)
13. [Listeners em Tempo Real (onSnapshot)](#13-listeners)
14. [Auto-Categorização Inteligente](#14-categorizacao)
15. [Pós-Processador IA (estornos + parcelamento)](#15-pos-processador)
16. [Integração com Dashboard](#16-dashboard)
17. [Integração com Importar.html](#17-importar)
18. [Integração com Dívidas](#18-dividas)
19. [Integração com Extrato](#19-extrato)
20. [Integração com Recorrentes](#20-recorrentes)
21. [Limites de Plano](#21-planos)
22. [Componentes UI (HTML)](#22-ui)
23. [⚠️ PROBLEMAS E INCOERÊNCIAS ENCONTRADOS](#23-problemas)
24. [Checklist para Novo Projeto](#24-checklist)

---

## 1. VISÃO GERAL DO SISTEMA {#1-visao-geral}

O sistema gerencia cartões de crédito como entidades separadas da "carteira" (contas bancárias). Cada cartão tem:
- **Limite fixo** cadastrado pelo usuário
- **Fatura mensal** calculada pela soma de transações do mês
- **Status de pagamento** por mês (pago/pendente)
- **Dia de fechamento** e **dia de vencimento**

**Princípio fundamental**: Gastos no crédito **NÃO** afetam o saldo da conta do usuário diretamente. Só quando ele paga a fatura (com saldo ou outro cartão) é que o impacto acontece.

**Fluxo resumido**:
```
[Cadastrar Cartão] → [Adicionar Gastos] → [Fatura fecha] → [Pagar Fatura] → [Próximo mês]
```

---

## 2. ESTRUTURA FIRESTORE COMPLETA {#2-firestore}

### Collection: `usuarios/{uid}/cartoes/{cartaoId}`

| Campo | Tipo | Obrigatório | Exemplo | Descrição |
|-------|------|-------------|---------|-----------|
| `nome` | string | ✅ | "Nubank" | Nome do cartão |
| `limite` | number | ✅ | 10000 | Limite total em R$ |
| `fechamento` | number | ✅ | 15 | Dia do mês que a fatura fecha |
| `vencimento` | number | ✅ | 25 | Dia do mês que a fatura vence |
| `cor` | string | ✅ | "roxo" | Cor visual (10 opções) |
| `bandeira` | string | ✅ | "mastercard" | Bandeira (6 opções) |
| `faturaAtual` | number | ✅ | 2350.50 | Valor da fatura atual **※ DENORMALIZADO** |
| `limiteDisponivel` | number | ✅ | 7649.50 | = limite - faturaAtual **※ DENORMALIZADO** |
| `faturasPagas` | map | ❌ | `{"2026-03": true}` | Status de pagamento por mês |
| `faturasMetodo` | map | ❌ | `{"2026-03": "saldo"}` | Método usado para pagar cada mês |
| `dataCriacao` | timestamp | ❌ | — | Quando foi criado |
| `dataModificacao` | timestamp | ❌ | — | Última edição |
| `atualizadoEm` | timestamp | ❌ | — | Última atualização de fatura |

**Cores disponíveis** (10): `roxo`, `laranja`, `vermelho`, `verde`, `preto`, `azul`, `rosa`, `teal`, `amarelo`, `cyan`

**Bandeiras disponíveis** (6): `visa`, `mastercard`, `elo`, `amex`, `hipercard`, `outro`

### Collection: `usuarios/{uid}/transacoes/{transacaoId}` (relacionadas a cartão)

| Campo | Tipo | Obrigatório | Exemplo | Descrição |
|-------|------|-------------|---------|-----------|
| `tipo` | string | ✅ | "despesa" | Sempre "despesa" para gastos de cartão |
| `descricao` | string | ✅ | "Mercado Carrefour" | Texto do gasto |
| `valor` | number | ✅ | 150.75 | Valor positivo (mesmo estornos) |
| `categoria` | string | ✅ | "Mercado" | Categoria atribuída |
| `cartaoId` | string | ✅※ | "abc123" | Referência ao cartão **※ OBRIGATÓRIO para gastos de cartão** |
| `formaPagamento` | string | ✅ | "Crédito" | Forma de pagamento |
| `dataReferencia` | string | ✅ | "2026-03-15" | Data YYYY-MM-DD para filtro mensal |
| `origem` | string | ✅ | "manual" | De onde veio |
| `status` | string | ❌ | "ativa" | "ativa", "estornado", "cancelado" |
| `dataCriacao` | timestamp | ✅ | — | Quando foi criado |
| `pago` | boolean | ❌ | false | Se foi pago |
| `confirmado` | boolean | ❌ | true | Se está confirmado |
| `parcelado` | boolean | ❌ | true | Se é parcelamento |
| `parcelaAtual` | number | ❌ | 2 | Qual parcela (se parcelado) |
| `totalParcelas` | number | ❌ | 12 | Total de parcelas |
| `valorTotal` | number | ❌ | 1200 | Valor total da compra parcelada |
| `pagamentoFatura` | boolean | ❌ | true | Se é pagamento de fatura |
| `cartaoOrigem` | string | ❌ | "abc123" | Qual cartão originou (em pagamento de fatura) |
| `mesFaturaRef` | string | ❌ | "2026-03" | Qual mês de fatura foi pago |

**Valores possíveis de `origem`**:
- `"manual"` — gasto adicionado pelo usuário manualmente
- `"importacao"` — importado via IA (PDF/imagem) dentro de cartoes.html
- `"importacao_ia"` — **※ NÃO É USADO em cartoes.js** (usado em importar.js)
- `"csv"` — importado via CSV em importar.html
- `"ofx"` — importado via OFX em importar.html
- `"pagamento_fatura"` — transação de pagamento de fatura

**Valores possíveis de `status`**:
- `"ativa"` — gasto normal, conta na fatura
- `"estornado"` — devolução/reembolso, NÃO conta na fatura
- `"cancelado"` — cancelado pelo usuário, NÃO conta na fatura

---

## 3. FLUXO: CRIAR/EDITAR CARTÃO {#3-criar-editar}

### 3.1 Criar Novo Cartão

**Trigger**: Botão "Novo Cartão" no banner superior → `abrirModalCartao()`

**Modal** (`#modalCartao`):
1. Nome do cartão (texto livre)
2. Limite total (R$ com máscara)
3. Dia do fechamento (1-31)
4. Dia do vencimento (1-31)
5. Cor do cartão (10 opções visuais)
6. Bandeira do cartão (6 opções)

**Validação**:
```javascript
if(!nome || !limite || !vencimento || !fechamento) return showToast("Preencha todos os campos do cartão!", "error");
```

**Limite de plano**:
```javascript
const limiteCartoes = window.NexoPlanos.getCardsLimit(perfilPlanoAtual);
if (Number.isFinite(limiteCartoes) && cartoesGlobais.length >= limiteCartoes) {
    return showToast(`Seu plano permite até ${limiteCartoes} cartão(ões).`, "error");
}
```

**Dados salvos no Firestore**:
```javascript
{
    nome: "Nubank",
    limite: 10000,
    fechamento: 15,           // parseInt
    vencimento: 25,            // parseInt
    cor: "roxo",
    bandeira: "mastercard",
    faturaAtual: 0,            // ← Inicializado em 0
    limiteDisponivel: 10000,   // ← Inicializado = limite
    dataCriacao: serverTimestamp()
}
```

### 3.2 Editar Cartão Existente

**Trigger**: Botão ✏️ no card → `editarCartao(id)`

**Preenche formulário** com dados atuais do cartão (nome, limite, fechamento, vencimento, cor, bandeira).

**Lógica especial de ajuste de limite**:
```javascript
// Se o limite foi alterado, ajusta limiteDisponivel proporcionalmente
const cartaoExistente = cartoesGlobais.find(c => c.id === idAtual);
if (cartaoExistente && typeof cartaoExistente.limiteDisponivel === 'number') {
    const diferenca = limite - (cartaoExistente.limite || 0);
    if (diferenca !== 0) {
        payload.limiteDisponivel = Math.max(0, cartaoExistente.limiteDisponivel + diferenca);
    }
}
```

**Exemplo**: Limite era 5000, limiteDisponivel era 3000 (fatura=2000). User muda limite para 8000.
- `diferenca = 8000 - 5000 = 3000`
- `limiteDisponivel = Math.max(0, 3000 + 3000) = 6000`
- Fatura continua em 2000, limite agora = 8000, livre = 6000 ✅

---

## 4. FLUXO: ADICIONAR GASTO MANUAL {#4-gasto-manual}

### 4.1 Abertura do Modal

**Trigger**: Botão "+ Adicionar" no card de cada cartão → `abrirModalNovoGasto(cartaoId, nomeCartao)`

**Modal** (`#modalNovoGasto`):
- Descrição (texto livre)
- Valor (R$ com máscara)
- Categoria (dropdown customizado com categorias padrão + personalizadas)
- Data (input date, default = hoje)
- Toggle "Parcelada?" (checkbox)
- Se parcelado: input "Número de Parcelas" (2-48)

### 4.2 Validações

```javascript
if(!desc || !valor || !dataForm || !cat) return showToast("Preencha todos os campos!", "error");
if(!gastoEditandoId && isParcelado && nParcelas < 2) return showToast("Informe ao menos 2 parcelas.", "error");
```

**Limite mensal de transações por plano**:
```javascript
const limiteMensal = window.NexoPlanos.getMonthlyTransactionLimit(perfilPlanoAtual);
if (Number.isFinite(limiteMensal)) {
    const prefixoMes = String(dataForm).slice(0, 7);
    const transacoesManuaisMes = transacoesGlobais.filter((t) => {
        const mesmaData = t.dataReferencia && String(t.dataReferencia).startsWith(prefixoMes);
        const origemManual = !t.origem || t.origem === 'manual';
        return mesmaData && origemManual;
    }).length;
    if (transacoesManuaisMes >= limiteMensal) {
        return showToast(`Seu plano permite até ${limiteMensal} transações manuais/mês.`, "error");
    }
}
```

### 4.3 Gasto Simples (sem parcelamento)

**Operação Firestore**: 2 writes
1. `addDoc(transacoes)`:
```javascript
{
    tipo: 'despesa',
    descricao: desc,
    valor: valor,
    categoria: cat,
    cartaoId: cartaoSelecionadoParaAcao,
    formaPagamento: 'Crédito',
    dataReferencia: dataForm,          // YYYY-MM-DD
    origem: 'manual',
    dataCriacao: serverTimestamp(),
    pago: false,
    confirmado: true
}
```

2. `updateDoc(cartoes/{id})`:
```javascript
{
    faturaAtual: increment(valor),
    limiteDisponivel: increment(-valor),
    atualizadoEm: serverTimestamp()
}
```

**⚠️ PROBLEMA #1 — faturaAtual/limiteDisponivel denormalizados**:
Esses campos são incrementados a cada gasto, mas a renderização calcula a fatura real a partir das transações. Se houver qualquer dessincronização (erro de rede, crash, operação parcial), os campos ficam inconsistentes com a realidade. Mais detalhes na Seção 23.

---

## 5. FLUXO: PARCELAMENTO {#5-parcelamento}

### 5.1 Lógica de Criação

Quando o user marca "Parcelada?" e informa N parcelas:

```javascript
const valorParcela = Math.round((valor / nParcelas) * 100) / 100;
const dataBase = new Date(dataForm + 'T12:00:00');
let valorTotalLancado = 0;

for (let i = 0; i < nParcelas; i++) {
    const dataParcela = new Date(dataBase);
    dataParcela.setMonth(dataParcela.getMonth() + i);
    const dataRef = dataParcela.toISOString().split('T')[0];
    
    // Última parcela absorve a diferença de arredondamento
    const valorEsta = (i === nParcelas - 1) 
        ? Math.round((valor - valorTotalLancado) * 100) / 100 
        : valorParcela;
    valorTotalLancado += valorEsta;

    await addDoc(collection(db, "usuarios", usuarioAtualId, "transacoes"), {
        tipo: 'despesa',
        descricao: `${desc} (${i+1}/${nParcelas})`,
        valor: valorEsta,
        categoria: cat,
        cartaoId: cartaoSelecionadoParaAcao,
        formaPagamento: 'Crédito',
        dataReferencia: dataRef,
        origem: 'manual',
        parcelado: true,
        parcelaAtual: i + 1,
        totalParcelas: nParcelas,
        valorTotal: valor,
        dataCriacao: serverTimestamp(),
        pago: false,
        confirmado: true
    });
}
```

### 5.2 Atualização do Cartão (só primeira parcela)

```javascript
await updateDoc(doc(db, "usuarios", usuarioAtualId, "cartoes", cartaoSelecionadoParaAcao), {
    faturaAtual: increment(valorParcela),
    limiteDisponivel: increment(-valorParcela),
    atualizadoEm: serverTimestamp()
});
```

**IMPORTANTE**: Só atualiza `faturaAtual` com o valor de **uma parcela** (a do mês atual). As próximas parcelas são transações futuras que aparecerão nos meses seguintes.

### 5.3 Exemplo Completo

**Compra**: PlayStation 5 — R$ 1.200,00 em 3x, data 15/03/2026

| Parcela | Data | Valor | Descrição |
|---------|------|-------|-----------|
| 1/3 | 2026-03-15 | R$ 400,00 | PlayStation 5 (1/3) |
| 2/3 | 2026-04-15 | R$ 400,00 | PlayStation 5 (2/3) |
| 3/3 | 2026-05-15 | R$ 400,00 | PlayStation 5 (3/3) |

- Em **março**: fatura mostra R$ 400 desta compra
- Em **abril**: fatura mostra R$ 400 desta compra
- Em **maio**: fatura mostra R$ 400 desta compra

### 5.4 Tratamento de Arredondamento

Se R$ 100 ÷ 3 = R$ 33,33 + R$ 33,33 + R$ 33,34:
```
Parcela 1: 33.33
Parcela 2: 33.33
Parcela 3: 100 - 66.66 = 33.34  ← última parcela absorve a diferença
```

**⚠️ PROBLEMA #2 — Parcelamento e faturaAtual**: 
O `faturaAtual` no Firestore só é incrementado com o valor da primeira parcela. Mas nos meses seguintes, quando as parcelas 2, 3... aparecem, elas já existem como transações e a renderização soma elas. No entanto, o `faturaAtual` denormalizado do documento do cartão **nunca é atualizado** para os meses futuros. O campo `faturaAtual` fica desatualizado. A renderização ignora esse campo e calcula dinamicamente, mas qualquer lugar que leia `faturaAtual` direto (ex: modal de pagar fatura de outro cartão mostra `c.faturaAtual`) terá valor errado. Mais detalhes na Seção 23.

---

## 6. FLUXO: PAGAMENTO DE FATURA {#6-pagamento-fatura}

### 6.1 Trigger

Cada card de cartão tem um toggle "Fatura Pendente ⏱️" / "Fatura Paga ✓".

Quando o user clica no toggle para pagar:
```javascript
window.toggleFaturaUI = async function(checkbox, idLabel, cartaoId) {
    if (checkbox.checked) {
        checkbox.checked = false; // Reverte até confirmar no modal
        abrirModalPagarFatura(cartaoId, idLabel);
    } else {
        await desfazerPagamentoFatura(cartaoId, idLabel);
    }
}
```

### 6.2 Modal de Pagamento

**Calcula a fatura do mês filtrado**:
```javascript
const mesKey = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth() + 1).padStart(2, '0')}`;
const gastosDoMes = transacoesGlobais.filter(t => 
    t.cartaoId === cartaoId && 
    t.dataReferencia && 
    t.dataReferencia.startsWith(prefixo)
);
const totalFatura = gastosDoMes.reduce((s, t) => s + (t.valor || 0), 0);
```

**⚠️ PROBLEMA #3 — totalFatura inclui TODOS os status**:
Neste cálculo (`abrirModalPagarFatura`), a fatura NÃO filtra por `status === 'ativa'`. Ou seja, transações estornadas e canceladas ENTRAM na soma do pagamento! Compare com a renderização (`renderizarCartoes()`) que CORRETAMENTE ignora estornados/cancelados:
```javascript
// Na renderização (CORRETO):
if (!isInativo) gastoDesteMes += g.valor;

// No pagamento de fatura (INCORRETO):
const totalFatura = gastosDoMes.reduce((s, t) => s + (t.valor || 0), 0); // ← NÃO filtra status!
```
Isso significa que se o user tem R$ 500 em gastos normais + R$ 200 estornados, o modal mostra R$ 700 para pagar, mas o card mostra R$ 500 na fatura. **INCOERÊNCIA GRAVE.**

### 6.3 Opções do Modal

**Opção 1: Pagar com Saldo da Conta** 🏦
```javascript
await addDoc(collection(db, "usuarios", usuarioAtualId, "transacoes"), {
    tipo: 'despesa',
    descricao: `Pagamento fatura ${cartao.nome} (${mesNome})`,
    valor: totalFatura,
    categoria: 'Cartão de Crédito',
    formaPagamento: 'Débito',
    dataReferencia: hoje,                // Data de HOJE, não do mês filtrado
    origem: 'pagamento_fatura',
    pagamentoFatura: true,
    cartaoOrigem: cartaoId,
    mesFaturaRef: mesKey,
    dataCriacao: serverTimestamp(),
    pago: true,
    confirmado: true
});
```

**Opção 2: Pagar com Outro Cartão** 💳
```javascript
// 1. Cria transação no OUTRO cartão
await addDoc(collection(db, "usuarios", usuarioAtualId, "transacoes"), {
    tipo: 'despesa',
    descricao: `Pagamento fatura ${cartao.nome} (${mesNome})`,
    valor: totalFatura,
    categoria: 'Cartão de Crédito',
    cartaoId: outroCartaoId,             // ← Vai para o OUTRO cartão
    formaPagamento: 'Crédito',
    dataReferencia: hoje,
    origem: 'pagamento_fatura',
    pagamentoFatura: true,
    cartaoOrigem: cartaoId,              // ← Referência ao cartão original
    mesFaturaRef: mesKey,
    dataCriacao: serverTimestamp(),
    pago: false,
    confirmado: true
});

// 2. Atualiza fatura do OUTRO cartão
await updateDoc(doc(db, "usuarios", usuarioAtualId, "cartoes", outroCartaoId), {
    faturaAtual: increment(totalFatura),
    limiteDisponivel: increment(-totalFatura),
    atualizadoEm: serverTimestamp()
});
```

### 6.4 Registro Final

Independente do método:
```javascript
await updateDoc(doc(db, "usuarios", usuarioAtualId, "cartoes", cartaoId), {
    [`faturasPagas.${mesKey}`]: true,
    [`faturasMetodo.${mesKey}`]: metodo,   // "saldo" ou "cartao_{id}"
    atualizadoEm: serverTimestamp()
});
```

### 6.5 Atualização de UI

```javascript
label.innerHTML = '<svg ...>✓</svg> Fatura Paga';
label.className = label.className.replace('text-slate-400', 'text-emerald-500');
const toggleInput = label.closest('.flex')?.querySelector('input[type=checkbox]');
if (toggleInput) toggleInput.checked = true;
```

**⚠️ PROBLEMA #4 — Pagamento NÃO cria `cartaoId` na transação (pagar com saldo)**:
Quando paga com saldo, a transação criada tem `cartaoOrigem: cartaoId` mas NÃO tem `cartaoId`. Isso é **intencional** porque o pagamento não é um gasto do cartão. Porém, essa transação de pagamento aparece no extrato geral como "despesa" que debita o saldo. O que é correto no sentido contábil (o dinheiro sai da conta), mas pode confundir o usuário que vê uma "despesa" enorme no extrato quando na verdade ele já viu os gastos individuais no cartão.

**⚠️ PROBLEMA #5 — `dataReferencia: hoje`**:
O pagamento usa a data de HOJE, não a data do mês filtrado. Se o user está olhando março mas paga a fatura em abril, a transação de pagamento fica em abril no extrato. Isso pode bagunçar o balanço mensal de abril com um pagamento referente a março.

---

## 7. FLUXO: DESFAZER PAGAMENTO {#7-desfazer-pagamento}

### 7.1 Trigger
User desmarca o toggle quando a fatura estava paga.

### 7.2 Operação

```javascript
async function desfazerPagamentoFatura(cartaoId, labelId) {
    const mesKey = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth() + 1).padStart(2, '0')}`;
    
    // Busca a transação de pagamento
    const q = query(
        collection(db, "usuarios", usuarioAtualId, "transacoes"),
        where("origem", "==", "pagamento_fatura"),
        where("cartaoOrigem", "==", cartaoId),
        where("mesFaturaRef", "==", mesKey)
    );
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
        const txData = d.data();
        // Se foi pago com outro cartão → reverter fatura dele
        if (txData.cartaoId) {
            await updateDoc(doc(db, "usuarios", usuarioAtualId, "cartoes", txData.cartaoId), {
                faturaAtual: increment(-(txData.valor || 0)),
                limiteDisponivel: increment(txData.valor || 0),
                atualizadoEm: serverTimestamp()
            });
        }
        await deleteDoc(doc(db, "usuarios", usuarioAtualId, "transacoes", d.id));
    }
    
    // Desmarca a fatura
    await updateDoc(doc(db, "usuarios", usuarioAtualId, "cartoes", cartaoId), {
        [`faturasPagas.${mesKey}`]: false,
        [`faturasMetodo.${mesKey}`]: null,
        atualizadoEm: serverTimestamp()
    });
}
```

**⚠️ PROBLEMA #6 — Requires 3 Firestore indexes (composite)**:
A query usa `where("origem", "==", ...)`, `where("cartaoOrigem", "==", ...)`, `where("mesFaturaRef", "==", ...)` na mesma collection. Isso requer um **índice composto** no Firestore. Se o índice não existir, a query falha silenciosamente ou retorna erro.

---

## 8. FLUXO: IMPORTAÇÃO COM IA (PDF/IMAGEM) {#8-importacao-ia}

### 8.1 Início

**Trigger**: Botão "📥 PDF" em cada card → `abrirModalImport(cartaoId)`

**Validação de plano**:
```javascript
if (!window.NexoPlanos.canUseFeature(perfilPlanoAtual, 'importTransactions')) {
    showToast('Importação disponível apenas a partir do plano Starter.', 'error');
    return;
}
```

### 8.2 Upload e Envio ao Backend

```javascript
const file = input.files[0];
const formData = new FormData();
formData.append('arquivo', file);
formData.append('instrucoes', 'Você está lendo uma FATURA DE CARTÃO DE CRÉDITO...');

const response = await fetch('https://nexo-backend-4kmu.onrender.com/api/extrair-fatura', {
    method: 'POST',
    body: formData
});
const transacoesExtraidas = await response.json();
```

**Backend** recebe PDF/imagem, faz OCR, extrai transações com `{desc, valor, data, cat}`.

### 8.3 Pós-processamento no Frontend

Após receber as transações da IA, aplica:

**1. `processarItensIA(itens)`** — detecta estornos, cancelamentos e parcelas:
```javascript
// Pagamento de fatura (linha de crédito no extrato)
/PAGAMENTO RECEBIDO|PAGTO RECEBIDO|PAYMENT RECEIVED|PAGAMENTO DE FATURA|PGTO FATURA/
→ status = 'estornado' (não é despesa, é um crédito)

// Estorno (valor negativo OU palavras-chave)
/ESTORNO|DEVOLUC|DEVOLUÇÃO|REEMBOLSO|CHARGEBACK|CRÉDITO FATURA/
→ status = 'estornado', valor = Math.abs(valor)

// Cancelamento
/CANCELAD|CANCELAMENTO/
→ status = 'cancelado'

// Parcelamento
/(\d{1,2})\s*[\/]\s*(\d{1,2})/  → ex: "1/12", "02/6"
/PARCELA\s+(\d+)\s+DE\s+(\d+)/i  → ex: "PARCELA 1 DE 3"
→ parcelado = true, parcelaAtual = N, totalParcelas = M
```

**2. `detectarCategoria(desc, cat)`** — auto-categoriza baseado na descrição (60+ regras)

### 8.4 Modal de Review

User vê todas as transações extraídas com:
- Checkbox (marcado por default se status = 'ativa')
- Descrição editável
- Valor editável
- Categoria selecionável (dropdown)
- Badges: "Estorno", "Cancelado", "2/12x"

### 8.5 Salvamento

```javascript
window.salvarTransacoesIA = async () => {
    const anoMes = `${document.getElementById('iaAno').value}-${document.getElementById('iaMes').value}`;
    
    for(let i = 0; i < itensIAExtraidos.length; i++) {
        const checkbox = document.getElementById(`iaCheck_${i}`);
        if(checkbox && checkbox.checked) {
            const item = itensIAExtraidos[i];
            const docData = {
                tipo: 'despesa',
                descricao: item.desc,
                valor: parseFloat(item.valor) || 0,
                categoria: item.cat.replace(/\p{Emoji}/gu, '').trim(),  // Remove emojis
                cartaoId: cartaoSelecionadoParaAcao,
                dataReferencia: `${anoMes}-15`,       // ← Sempre dia 15!
                origem: 'importacao',                  // ← NÃO é 'importacao_ia'
                dataCriacao: serverTimestamp(),
                pago: false,
                status: item._status || 'ativa'
            };
            if (item._parcelado) {
                docData.parcelado = true;
                docData.parcelaAtual = item._parcelaAtual;
                docData.totalParcelas = item._totalParcelas;
            }
            await addDoc(collection(db, "usuarios", usuarioAtualId, "transacoes"), docData);
        }
    }
}
```

**⚠️ PROBLEMA #7 — dataReferencia sempre dia 15**:
Todas as transações importadas via IA recebem `dataReferencia: "${anoMes}-15"`. A data real de cada transação (que a IA extraiu com campo `item.data`) é **IGNORADA**. Isso significa que ao importar uma fatura de março, todas as transações ficam em "2026-03-15", perdendo a informação de quando realmente foram feitas (dia 2, 7, 23, etc.).

**⚠️ PROBLEMA #8 — `origem: 'importacao'` em vez de `'importacao_ia'`**:
O código usa `origem: 'importacao'` mas em outros módulos (importar.js), a origem é `'importacao_ia'` ou `'csv'`/`'ofx'`. Isso cria inconsistência. Quem filtrar por `origem === 'importacao_ia'` não encontrará transações importadas via IA do cartão.

**⚠️ PROBLEMA #9 — Não atualiza faturaAtual/limiteDisponivel**:
Diferente do gasto manual (que faz `increment(valor)`), a importação via IA **NÃO atualiza** os campos `faturaAtual` e `limiteDisponivel` do cartão. A renderização calcula dinamicamente, então visualmente funciona. Mas qualquer consulta direta a esses campos estará errada.

---

## 9. FLUXO: EDITAR/EXCLUIR GASTO {#9-editar-excluir}

### 9.1 Editar Gasto

**Trigger**: Botão ✏️ em cada gasto → `editarGasto(transacaoId, cartaoId)`

**Carrega dados do Firestore**:
```javascript
const snap = await getDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', transacaoId));
const g = snap.data();
```

**Salvamento**:
```javascript
const diff = valor - gastoEditandoValorAnterior;
await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', gastoEditandoId), {
    descricao: desc, valor: valor, categoria: cat, dataReferencia: dataForm, 
    atualizadoEm: serverTimestamp()
});
// Se o valor mudou, ajusta o cartão
if (diff !== 0 && gastoEditandoCartaoId) {
    await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'cartoes', gastoEditandoCartaoId), {
        faturaAtual: increment(diff),
        limiteDisponivel: increment(-diff),
        atualizadoEm: serverTimestamp()
    });
}
```

**Nota**: Ao editar, o toggle de parcelamento é **ocultado** (`toggleParcelaRow` fica hidden). Não é possível transformar um gasto normal em parcelado.

### 9.2 Excluir Gasto

**Trigger**: Botão 🗑️ em cada gasto → `excluirGasto(transacaoId, cartaoId, valor)`

**Modal de confirmação** (criado via inline styles, não Tailwind):
```javascript
const ov = document.createElement('div');
ov.style.cssText = 'position:fixed;inset:0;...background:rgba(0,0,0,0.45);z-index:9999;...';
ov.innerHTML = '<div style="...">Excluir gasto?</div>';
```

**Operação** (após confirmar):
```javascript
await deleteDoc(doc(db, 'usuarios', usuarioAtualId, 'transacoes', transacaoId));
await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'cartoes', cartaoId), {
    faturaAtual: increment(-valor),
    limiteDisponivel: increment(valor),
    atualizadoEm: serverTimestamp()
});
```

---

## 10. FLUXO: ESTORNAR/CANCELAR/REATIVAR {#10-estorno-cancelamento}

### 10.1 Marcar Status

**Trigger**: Botões no gasto → `marcarGastoStatus(transacaoId, cartaoId, valor, novoStatus)`

**Status possíveis**:
- `'estornado'` — devolução/reembolso
- `'cancelado'` — gasto cancelado
- `'ativa'` — reativar gasto

**Modal de confirmação** (inline styles):
```javascript
const ov = document.createElement('div');
ov.style.cssText = 'position:fixed;inset:0;...';
```

**Operação**:
```javascript
await updateDoc(docRef, { status: novoStatus, atualizadoEm: serverTimestamp() });
```

**⚠️ PROBLEMA #10 — Não atualiza faturaAtual/limiteDisponivel ao mudar status**:
Quando um gasto é marcado como estornado/cancelado, a renderização corretamente para de contar ele na fatura visual. MAS os campos `faturaAtual` e `limiteDisponivel` no Firestore **NÃO são atualizados**. Ou seja:
- Gasto de R$ 500 → faturaAtual = 500, limiteDisponivel = 9500
- User estorna → faturaAtual CONTINUA 500, limiteDisponivel CONTINUA 9500
- Renderização mostra R$ 0 (correto)
- Mas `c.faturaAtual` no cartão diz R$ 500 (errado)

Isso afeta o modal de pagar fatura com outro cartão, que exibe `livreEstimado = limite - faturaAtual`.

---

## 11. FLUXO: EXCLUIR CARTÃO {#11-excluir-cartao}

### 11.1 Interface

**Trigger**: Botão 🗑️ no card → `abrirModalExcluir(id, nome)`

**Modal de exclusão** (`#modalExcluirCartao`):
- Warning ⚠️ com texto explicativo
- Lista do que será excluído:
  - Cartão permanentemente
  - TODAS as despesas vinculadas
  - Todo o histórico de faturas
- Checkbox obrigatório: "Entendo que esta ação é irreversível"
- Botão "Excluir permanentemente" (desabilitado até marcar checkbox)

### 11.2 Operação

```javascript
window.executarExclusaoCartao = async () => {
    // 1. Busca TODAS as transações do cartão (sem filtro de mês)
    const q = query(
        collection(db, "usuarios", usuarioAtualId, "transacoes"),
        where("cartaoId", "==", cartaoSelecionadoParaAcao)
    );
    const snapshot = await getDocs(q);
    
    // 2. Deleta todas as transações em paralelo
    const delecoes = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(delecoes);
    
    // 3. Deleta o cartão
    await deleteDoc(doc(db, "usuarios", usuarioAtualId, "cartoes", cartaoSelecionadoParaAcao));
}
```

**⚠️ PROBLEMA #11 — Não deleta transações de pagamento de fatura**:
A query busca por `where("cartaoId", "==", id)`. Porém, transações de pagamento com SALDO da conta NÃO têm `cartaoId` (elas têm `cartaoOrigem` em vez disso). Essas transações ficam **orquais** no Firestore após excluir o cartão. Transações de pagamento com OUTRO cartão fazem ter `cartaoId` do outro cartão, logo também não são deletadas. Ficam transações fantasmas referenciando um cartão que não existe mais.

---

## 12. RENDERIZAÇÃO DOS CARTÕES E CÁLCULOS {#12-renderizacao}

### 12.1 Função Principal: `renderizarCartoes()`

**Chamada por**: Qualquer mudança em `cartoesGlobais`, `transacoesGlobais`, ou filtro de mês.

### 12.2 Cálculo da Fatura (por cartão, por mês)

```javascript
const prefixoDataFiltro = `${ano}-${mesStr}`;

cartoesGlobais.forEach((c) => {
    let gastoDesteMes = 0;
    
    const gastosDoCartao = transacoesGlobais.filter(t => 
        t.cartaoId === c.id && 
        (t.dataReferencia && t.dataReferencia.startsWith(prefixoDataFiltro))
    );
    
    gastosDoCartao.forEach(g => {
        const isEstornado = g.status === 'estornado';
        const isCancelado = g.status === 'cancelado';
        const isInativo = isEstornado || isCancelado;
        if (!isInativo) gastoDesteMes += g.valor;  // ← SÓ soma ativos
    });
    
    totalFaturaGeral += gastoDesteMes;
    totalLimiteDispGeral += (c.limite - gastoDesteMes);
});
```

**NOTA IMPORTANTE**: O `totalLimiteDispGeral` usa `c.limite - gastoDesteMes` (calculado dinamicamente), NÃO usa `c.limiteDisponivel` do Firestore. Isso é mais correto porém inconsistente com o que está armazenado.

### 12.3 Barra de Progresso

```javascript
const percentualUso = Math.min((gastoDesteMes / c.limite) * 100, 100);
let corBarra = 'bg-emerald-400';     // < 75%
if(percentualUso > 75) corBarra = 'bg-amber-400';   // 75-90%
if(percentualUso > 90) corBarra = 'bg-red-400';     // > 90%
```

### 12.4 Status "Fechada"

```javascript
if(c.fechamento && dataHoje.getDate() >= c.fechamento) {
    statusFaturaHTML = '<span class="bg-amber-100 text-amber-700 ...">Fechada</span>';
}
```

**⚠️ PROBLEMA #12 — Lógica de "Fechada" muito simplista**:
Compara `dataHoje.getDate() >= c.fechamento` sem considerar o MÊS filtrado. Se o user está olhando março (passado) e o dia de hoje é 7 de abril, com fechamento dia 15:
- `7 < 15` → NÃO mostra "Fechada" para março
- Mas março já passou! A fatura de março estava fechada há semanas
- Essa lógica só faz sentido para o mês ATUAL

### 12.5 Lista de Gastos por Cartão

Para cada gasto, renderiza:
- Descrição (com `escapeHTML`)
- Categoria
- Badges: parcelamento "2/12x", "ESTORNADO", "CANCELADO"
- Valor
- Botões de ação:
  - Se ativo: ✏️ Editar, ↩️ Estornar, 🗑️ Excluir
  - Se inativo: ✅ Reativar

### 12.6 Cards Visuais

Cada cartão renderiza:
1. **Header**: Nome + botões editar/excluir
2. **Card visual**: Gradiente de cor + bandeira + chip + últimos 4 dígitos (usa `c.id.slice(-4)`) + badge "Fechada"
3. **Fatura**: Valor + barra de progresso + limite/livre
4. **Toggle**: Fatura Paga/Pendente
5. **Gastos**: Lista scrollável + botões "Importar PDF" e "+ Novo"

---

## 13. LISTENERS EM TEMPO REAL (onSnapshot) {#13-listeners}

### 13.1 Autenticação

```javascript
onAuthStateChanged(auth, (user) => {
    _unsubs.forEach(fn => fn()); _unsubs = [];
    if (user) {
        usuarioAtualId = user.uid;
        // ... carrega plano, categorias, transações, cartões
    } else {
        window.location.href = "index.html";
    }
});
```

### 13.2 Três Listeners Simultâneos

**1. Categorias Personalizadas** (limit 200):
```javascript
onSnapshot(query(collection(db, "usuarios", uid, "categorias"), limit(200)), (snap) => {
    categoriasPersonalizadas = snap.docs.filter(d => d.data().tipo === 'despesa').map(d => d.data());
    carregarCategoriasNosDropdowns();
});
```
**Nota**: Filtra só categorias de tipo "despesa" (cartão é sempre despesa).

**2. Transações** (limit 5000):
```javascript
onSnapshot(query(collection(db, "usuarios", uid, "transacoes"), limit(5000)), (snap) => {
    if (window.hideSplash) window.hideSplash();
    transacoesGlobais = snap.docs.map(doc => ({...doc.data(), id: doc.id}));
    renderizarCartoes();
});
```

**⚠️ PROBLEMA #13 — Carrega TODAS as 5000 transações sem filtro de cartão**:
Não filtra por `cartaoId` nem por mês. Carrega TUDO (incluindo transações de contas bancárias, dinheiro, etc.) e depois filtra no frontend. Isso é ineficiente mas funcional.

**3. Cartões** (limit 100):
```javascript
onSnapshot(query(collection(db, "usuarios", uid, "cartoes"), limit(100)), (snap) => {
    cartoesGlobais = snap.docs.map(doc => ({...doc.data(), id: doc.id}));
    renderizarCartoes();
});
```

**NOTA**: Cada listener chama `renderizarCartoes()`. Quando ambos disparam (cartão + transações mudam juntos), a renderização acontece 2x rapidamente. Não causa erros, mas é redundante.

### 13.3 Resolução de Plano

```javascript
const resolvedPlan = window.NexoPlanos.resolvePlan(userData);
if (resolvedPlan.shouldDowngrade) {
    await updateDoc(doc(db, 'usuarios', user.uid), {
        plano: 'free',
        downgradeMotivo: resolvedPlan.downgradeReason || 'plan_rules',
        downgradeEm: new Date().toISOString(),
        assinaturaStatus: resolvedPlan.downgradeReason === 'trial_expired' 
            ? (userData.assinaturaStatus || null) 
            : 'past_due'
    });
}
```

---

## 14. AUTO-CATEGORIZAÇÃO INTELIGENTE {#14-categorizacao}

### 14.1 Função: `detectarCategoria(desc, catAtual)`

**Entrada**: descrição da transação + categoria atual (fallback)
**Saída**: categoria detectada

**Pré-processamento**:
```javascript
const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
```
Remove acentos e converte para minúsculo para comparação.

### 14.2 Regras (38 categorias, 200+ palavras-chave)

| Categoria | Exemplos de Palavras | Prioridade |
|-----------|---------------------|------------|
| Uber/Táxi | uber, 99, cabify, indrive | Alta |
| Delivery/Ifood | ifood, rappi, zé delivery | Alta |
| Restaurante | pizzaria, hamburgueria, mcdonalds | Média |
| Padaria/Café | padaria, starbucks, cafeteria | Média |
| Mercado | carrefour, assaí, pão de açúcar | Média |
| Combustível | posto, shell, ipiranga | Média |
| Farmácia | drogaria, drogasil, pague menos | Média |
| Assinaturas/Streaming | netflix, spotify, chatgpt, github | Alta |
| Roupas/Sapatos | renner, zara, shein, shopee | Baixa |
| Eletrônicos | magalu, amazon, kabum | Baixa |
| Pet | petz, cobasi, petlove | Baixa |
| ... | ... | ... |

### 14.3 Fluxo de Aplicação

```
1. Extrai transações da IA → [{desc, valor, data, cat}]
2. processarItensIA(itens) → detecta estorno/parcelamento
3. itens.map(item => { item.cat = detectarCategoria(item.desc, item.cat); return item; })
4. Mostra no modal de review com categoria pre-selecionada
5. User pode mudar manualmente antes de salvar
```

**Nota**: A categorização também está disponível no `importar.js` para CSV/OFX.

---

## 15. PÓS-PROCESSADOR IA {#15-pos-processador}

### 15.1 Função: `processarItensIA(itens)`

**Para cada transação extraída pela IA**:

| Padrão Detectado | Status Resultante | Valor |
|-----------------|-------------------|-------|
| "PAGAMENTO RECEBIDO", "PGTO FATURA" | `estornado` | `Math.abs(valor)` |
| Valor negativo | `estornado` | `Math.abs(valor)` |
| "ESTORNO", "DEVOLUÇÃO", "REEMBOLSO", "CHARGEBACK" | `estornado` | `Math.abs(valor)` |
| "CANCELADO", "CANCELAMENTO" | `cancelado` | mantém |
| "1/12", "02/6" (regex parcela) | adiciona `_parcelado=true` | mantém |
| "PARCELA 1 DE 3" | adiciona `_parcelado=true` | mantém |

**⚠️ PROBLEMA #14 — Cancelado sobreescreve estornado**:
Se a descrição tem TANTO "ESTORNO" quanto "CANCELADO" (ex: "ESTORNO CANCELADO"), primeiro marca `estornado`, depois sobreescreve para `cancelado`. A verificação de cancelamento NÃO é `else if`, é `if` separado:
```javascript
// Estorno
if (valor < 0 || /ESTORNO|.../.test(desc)) {
    status = 'estornado';
}
// Cancelamento (roda SEMPRE, mesmo se já é estornado)
if (/CANCELAD|CANCELAMENTO/.test(desc)) {
    status = 'cancelado';  // ← SOBRESCREVE estornado!
}
```

---

## 16. INTEGRAÇÃO COM DASHBOARD {#16-dashboard}

### 16.1 Painel de Cartões

O dashboard lê `carteiraGlobal` (que inclui cartões) e exibe um painel:
```javascript
function atualizarPainelCartoes() {
    const cartoes = carteiraGlobal.filter(i => i.tipo === 'credito');
    // Mostra até 3 cartões com nome, fatura e limite disponível
    const fatura = c.faturaAtual || 0;
    const limiteDisp = typeof c.limiteDisponivel === 'number' 
        ? c.limiteDisponivel 
        : ((c.limite || 0) - fatura);
}
```

**⚠️ PROBLEMA #15 — Dashboard usa `faturaAtual` denormalizado**:
O painel de cartões no dashboard lê `c.faturaAtual` direto do Firestore. Como já vimos, esse campo fica desatualizado (estornos, importações IA, meses futuros de parcelamento não o atualizam). O dashboard pode mostrar valores incorretos.

### 16.2 Transações de Cartão x Saldo

```javascript
// Compra no cartão de crédito NÃO afeta o Saldo Geral
const ehCompraCredito = Boolean(t.cartaoId) && !t.pagamentoFatura;
```

**Regra do Dashboard**:
- Gasto com `cartaoId` (sem `pagamentoFatura`) → **NÃO debita saldo** (correto, o crédito não tira dinheiro da conta)
- Gasto com `pagamentoFatura: true` → **DEBITA saldo** (correto, o pagamento da fatura tira dinheiro da conta/outro cartão)

### 16.3 Dropdown de Conta/Cartão (ao adicionar transação)

O dashboard permite adicionar transações e escolher conta/cartão:
```javascript
function atualizarDropdownContaCartao() {
    // Lista "Contas e Dinheiro" (tipo !== 'credito')
    // Lista "Cartões de Crédito" (tipo === 'credito')
}
```

**Quando cartão de crédito é selecionado**:
- `formaPagamento` = 'Crédito'
- Aparece checkbox "Pagamento de Fatura?"
- Se marcado, pede "Fonte de pagamento" (outra conta)

**⚠️ PROBLEMA #16 — Dashboard usa `carteiraGlobal`, cartões usa `cartoesGlobais`**:
O dashboard e o cartões.js usam collections diferentes para ler cartões:
- **Dashboard**: Lê de `usuarios/{uid}/carteira` (collection "carteira")
- **Cartões**: Lê de `usuarios/{uid}/cartoes` (collection "cartoes")

São collections SEPARADAS no Firestore! Isso significa que o painel de cartões no dashboard mostra dados da collection "carteira" (que pode ter `tipo: 'credito'`), enquanto a tela de cartões mostra dados da collection "cartoes". Se o user adicionar um cartão na tela de cartões, ele precisa estar **TAMBÉM** na collection "carteira" para aparecer no dashboard. **Se essas duas collections não estiverem sincronizadas, os dados divergem.**

---

## 17. INTEGRAÇÃO COM IMPORTAR.HTML {#17-importar}

### 17.1 Referências a Cartão

O `importar.js` pode importar transações para cartões de crédito via:
```javascript
formaPagamento: mapaFormaPag[itemCarteira.tipo] || 'Outro',
pagamentoFatura: false,
```

Quando importa para um cartão, atualiza:
```javascript
faturaAtual: increment(totalDespesas),
```

### 17.2 Categoria de Pagamento de Fatura

```javascript
{ cat: 'Pagamento de Fatura', palavras: ['pagamento de fatura'] },
```

---

## 18. INTEGRAÇÃO COM DÍVIDAS {#18-dividas}

### 18.1 Detecção de Dívidas de Cartão

O `dividas.js` reconhece dívidas relacionadas a cartão:
```javascript
'Cartão Parcelado': { 
    icone: '💳', 
    palavras: ['fatura', 'cartão', 'cartao', 'parcelamento de fatura', 'crédito rotativo', 'rotativo', 'anuidade'] 
}
```

**Nota**: Isso é para o módulo de dívidas (empréstimos, financiamentos), NÃO para as faturas de cartão em si.

---

## 19. INTEGRAÇÃO COM EXTRATO {#19-extrato}

### 19.1 Ícone de Categoria

O `extrato.js` mapeia categorias de pagamento de fatura:
```javascript
'Pagamento de Fatura': '💳'
```

Transações com `categoria: 'Cartão de Crédito'` ou `categoria: 'Pagamento de Fatura'` recebem ícone 💳.

---

## 20. INTEGRAÇÃO COM RECORRENTES {#20-recorrentes}

### 20.1 Forma de Pagamento

O `recorrentes.js` permite selecionar "Crédito" como forma de pagamento:
```javascript
const formaLabels = {'PIX':'⚡ PIX','Débito':'💳 Débito','Crédito':'💳 Crédito',...};
```

**⚠️ PROBLEMA #17 — Recorrentes NÃO vinculam a cartão específico**:
Despesas recorrentes podem ter `formaPagamento: 'Crédito'`, mas NÃO têm `cartaoId`. Elas não aparecem na fatura de nenhum cartão. É só uma marcação informativa. Se o user tem uma assinatura Netflix no Nubank, ele precisa adicionar manualmente como gasto do cartão OU criar a recorrente E adicionar o gasto. **Duplicidade potencial.**

---

## 21. LIMITES DE PLANO {#21-planos}

### 21.1 Restrições por Plano

| Feature | Free | Starter | Pro |
|---------|------|---------|-----|
| Nº de cartões | `getCardsLimit()` | Ilimitado | Ilimitado |
| Transações manuais/mês | `getMonthlyTransactionLimit()` | Mais | Ilimitado |
| Importação (PDF/IA) | ❌ | ✅ `importTransactions` | ✅ |
| Leitura IA | ❌ | ✅ `iaInvoiceReading` | ✅ |

### 21.2 Verificação no Código

```javascript
// Ao criar cartão:
const limiteCartoes = window.NexoPlanos.getCardsLimit(perfilPlanoAtual);
if (Number.isFinite(limiteCartoes) && cartoesGlobais.length >= limiteCartoes) { ... }

// Ao adicionar gasto manual:
const limiteMensal = window.NexoPlanos.getMonthlyTransactionLimit(perfilPlanoAtual);

// Ao importar via IA:
if (!window.NexoPlanos.canUseFeature(perfilPlanoAtual, 'importTransactions')) { ... }
if (!window.NexoPlanos.canUseFeature(perfilPlanoAtual, 'iaInvoiceReading')) { ... }
```

---

## 22. COMPONENTES UI (HTML) {#22-ui}

### 22.1 Modais (6 modais na página)

| Modal | ID | z-index | Propósito |
|-------|-----|---------|-----------|
| Seletor de Mês | `#modalSeletorMesCartao` | 100 | Mobile: grid 3x4 de meses |
| Criar/Editar Cartão | `#modalCartao` | 60 | Formulário do cartão |
| Novo/Editar Gasto | `#modalNovoGasto` | 60 | Formulário de gasto |
| Excluir Cartão | `#modalExcluirCartao` | 90 | Confirmação com checkbox |
| Importar IA (Upload) | `#modalImportIA` | 70 | Upload de PDF/imagem |
| Review IA | `#modalReviewIA` | 80 | Lista editável de transações |
| Pagar Fatura | `#modalPagarFatura` | 70 | Opções de pagamento |

### 22.2 Banner Superior

Gradiente verde → teal com:
- Total de faturas do mês: `#totalFaturasApp`
- Limite total disponível: `#limiteTotalApp`
- Botão "Novo Cartão"

### 22.3 Header

- Mobile: Hamburger + olhinho (ocultar valores) + refresh + calendário
- Desktop: Navegação < Mês/Ano > com setas

### 22.4 Grid de Cards

`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3` — responsivo

---

## 23. ⚠️ TODOS OS PROBLEMAS E INCOERÊNCIAS ENCONTRADOS {#23-problemas}

### PROBLEMA #1: `faturaAtual` e `limiteDisponivel` DENORMALIZADOS
**Localização**: Campos na collection `cartoes/{id}`
**Gravidade**: 🔴 ALTA
**Descrição**: Esses campos são atualizados por `increment()` a cada gasto/exclusão/edição. Porém NÃO são atualizados em todas as operações:
- ✅ Gasto manual simples → atualiza
- ✅ Gasto parcelado (1ª parcela) → atualiza
- ✅ Edição de gasto → atualiza se valor mudou
- ✅ Exclusão de gasto → atualiza
- ❌ Importação via IA → NÃO atualiza
- ❌ Mudança de status (estornar/cancelar/reativar) → NÃO atualiza
- ❌ Parcelas futuras que "chegam" em novo mês → NÃO atualiza

**Impacto**: `c.faturaAtual` e `c.limiteDisponivel` ficam dessincronizados da realidade. Quem lê esses campos (modal de pagar com outro cartão, dashboard) vê valores errados.

**🔧 SOLUÇÃO — Opção A (Recomendada): Eliminar campos denormalizados e calcular sempre dinamicamente**
```javascript
// Criar função utilitária reutilizável:
function calcularFaturaCartao(cartaoId, mesKey, transacoes) {
    return transacoes
        .filter(t => t.cartaoId === cartaoId 
            && t.dataReferencia?.startsWith(mesKey)
            && t.status !== 'estornado' 
            && t.status !== 'cancelado')
        .reduce((s, t) => s + (t.valor || 0), 0);
}

function calcularLimiteDisponivel(cartao, faturaAtual) {
    return cartao.limite - faturaAtual;
}

// Usar em TODOS os lugares que lêem fatura (renderização, pagamento, modal, dashboard)
// Remover faturaAtual e limiteDisponivel do Firestore
// Remover todos os increment() de gasto/exclusão/edição
```

**🔧 SOLUÇÃO — Opção B: Cloud Function onWrite que recalcula**
```javascript
// functions/index.js
exports.recalcularFaturaCartao = functions.firestore
    .document('usuarios/{uid}/transacoes/{txId}')
    .onWrite(async (change, context) => {
        const { uid } = context.params;
        const data = change.after.exists ? change.after.data() : change.before.data();
        const cartaoId = data?.cartaoId;
        if (!cartaoId) return;
        
        const mesKey = data.dataReferencia?.slice(0, 7);
        if (!mesKey) return;
        
        const txSnap = await admin.firestore()
            .collection('usuarios').doc(uid).collection('transacoes')
            .where('cartaoId', '==', cartaoId)
            .where('dataReferencia', '>=', mesKey + '-01')
            .where('dataReferencia', '<=', mesKey + '-31')
            .get();
        
        const faturaAtual = txSnap.docs
            .filter(d => d.data().status !== 'estornado' && d.data().status !== 'cancelado')
            .reduce((s, d) => s + (d.data().valor || 0), 0);
        
        const cartaoRef = admin.firestore().doc(`usuarios/${uid}/cartoes/${cartaoId}`);
        const cartaoSnap = await cartaoRef.get();
        const limite = cartaoSnap.data()?.limite || 0;
        
        await cartaoRef.update({ faturaAtual, limiteDisponivel: limite - faturaAtual });
    });
```

---

### PROBLEMA #2: Parcelamento x faturaAtual em meses futuros
**Localização**: `btnSalvarGasto` click handler, linha ~720
**Gravidade**: 🟡 MÉDIA
**Descrição**: Apenas a 1ª parcela incrementa `faturaAtual`. Nos meses seguintes, as parcelas 2, 3... existem como transações e aparecem na renderização, mas o `faturaAtual` armazenado no Firestore não reflete isso.
**Impacto**: O campo `faturaAtual` no Firestore está errado para meses futuros.

**🔧 SOLUÇÃO**: Se adotar Solução A do Problema #1 (cálculo dinâmico), este problema desaparece. Se manter denormalizado:
```javascript
// No loop de criação de parcelas (btnSalvarGasto handler):
for (let i = 0; i < parcelas; i++) {
    const mesParcela = new Date(ano, mes + i, dia);
    const mesKey = mesParcela.toISOString().slice(0, 7);
    // ... cria transação ...
    
    // ADICIONAR: incrementar faturaAtual do cartão para CADA mês
    // Porém faturaAtual é um campo único — não suporta múltiplos meses!
    // → Por isso Solução A (cálculo dinâmico) é MUITO melhor para parcelamento.
}
// CONCLUSÃO: Com parcelamento, faturaAtual denormalizado não funciona.
// A solução real é a Opção A do Problema #1.
```

---

### PROBLEMA #3: Pagamento de fatura INCLUI transações estornadas/canceladas
**Localização**: `abrirModalPagarFatura()` e `confirmarPagamentoFatura()`, linhas ~400-460
**Gravidade**: 🔴 ALTA
**Descrição**: O cálculo de `totalFatura` NÃO filtra por `status === 'ativa'`:
```javascript
// ERRADO (como está):
const totalFatura = gastosDoMes.reduce((s, t) => s + (t.valor || 0), 0);

// CORRETO (como deveria ser):
const totalFatura = gastosDoMes
    .filter(t => t.status !== 'estornado' && t.status !== 'cancelado')
    .reduce((s, t) => s + (t.valor || 0), 0);
```
**Impacto**: User paga mais do que deveria. Se tem R$ 500 em gastos + R$ 200 estornados, paga R$ 700.

**🔧 SOLUÇÃO**: Adicionar filtro de status em ambas as funções:
```javascript
// Em abrirModalPagarFatura():
const gastosDoMes = transacoesGlobais.filter(t =>
    t.cartaoId === cartaoId
    && t.dataReferencia?.startsWith(anoMes)
    && t.status !== 'estornado'       // ← ADICIONAR
    && t.status !== 'cancelado'       // ← ADICIONAR
);

// Em confirmarPagamentoFatura():
const gastosDoMes = transacoesGlobais.filter(t =>
    t.cartaoId === cartaoId
    && t.dataReferencia?.startsWith(anoMes)
    && t.status !== 'estornado'       // ← ADICIONAR
    && t.status !== 'cancelado'       // ← ADICIONAR
);
const totalFatura = gastosDoMes.reduce((s, t) => s + (t.valor || 0), 0);
```
**Arquivo**: `js/cartoes.js`, funções `abrirModalPagarFatura()` e `confirmarPagamentoFatura()`

---

### PROBLEMA #4: Pagamento com saldo não tem cartaoId (incoerência intencional?)
**Localização**: `confirmarPagamentoFatura('saldo')`, linha ~473
**Gravidade**: 🟢 BAIXA (intencional mas confuso)
**Descrição**: A transação de pagamento com saldo tem `cartaoOrigem` mas não `cartaoId`. Isso é correto (não é gasto de cartão), mas cria transação "fantasma" no extrato.
**Impacto visual**: User vê despesa grande no extrato que não corresponde a nenhum cartão.

**🔧 SOLUÇÃO**: Adicionar campos descritivos na transação de pagamento para melhor rastreabilidade:
```javascript
// Em confirmarPagamentoFatura('saldo'):
await addDoc(txRef, {
    tipo: 'despesa',
    descricao: `Pagamento de Fatura - ${nomeCartao}`,
    valor: totalFatura,
    categoria: 'Pagamento de Fatura',
    cartaoOrigem: cartaoId,
    cartaoId: null,                    // Correto: não é gasto do cartão
    origemPagamento: 'saldo',          // ← ADICIONAR: identificar tipo
    mesFaturaRef: anoMes,              // ← ADICIONAR: rastreabilidade
    dataReferencia: /* ver Problema #5 */
});

// No extrato.js, usar cartaoOrigem para mostrar badge:
// "💳 Pagamento Fatura - Nubank" em vez de despesa genérica
```
**Arquivo**: `js/cartoes.js`, função `confirmarPagamentoFatura()`

---

### PROBLEMA #5: `dataReferencia: hoje` no pagamento de fatura
**Localização**: `confirmarPagamentoFatura()`, linhas ~473 e ~495
**Gravidade**: 🟡 MÉDIA
**Descrição**: O pagamento usa `new Date().toISOString().split('T')[0]` (data de hoje), não do mês filtrado. Se pagar a fatura de março em abril, a transação fica em abril.
**Impacto**: Balanço mensal de abril inclui um pagamento referente a março. Distorce relatórios.

**🔧 SOLUÇÃO**: Usar o mês filtrado (dataFiltro) como referência:
```javascript
// Em confirmarPagamentoFatura():
// ANTES (errado):
const hoje = new Date().toISOString().split('T')[0];
// ... dataReferencia: hoje

// DEPOIS (correto):
const anoMes = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}`;
const diaVencimento = cartao.vencimento || 10;
const dataRef = `${anoMes}-${String(diaVencimento).padStart(2,'0')}`;
// ... dataReferencia: dataRef

// Assim o pagamento da fatura de março fica em março (no dia do vencimento)
```
**Arquivo**: `js/cartoes.js`, função `confirmarPagamentoFatura()`, ambos os blocos (saldo e outro cartão)

---

### PROBLEMA #6: Query composta sem índice garantido
**Localização**: `desfazerPagamentoFatura()`, linhas ~562-565
**Gravidade**: 🟡 MÉDIA
**Descrição**: Usa 3 `where()` na mesma query (origem, cartaoOrigem, mesFaturaRef). Requer índice composto no Firestore.
**Impacto**: Se o índice não existir, a query falha e o pagamento não é desfeito corretamente.

**🔧 SOLUÇÃO**: Criar o índice composto no `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "transacoes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "origem", "order": "ASCENDING" },
        { "fieldPath": "cartaoOrigem", "order": "ASCENDING" },
        { "fieldPath": "mesFaturaRef", "order": "ASCENDING" }
      ]
    }
  ]
}
```
E depois rodar: `firebase deploy --only firestore:indexes`

Alternativa: simplificar a query em `desfazerPagamentoFatura()`:
```javascript
// Buscar por cartaoOrigem + mesFaturaRef (2 campos — mais provável de funcionar)
// E filtrar por origem localmente:
const q = query(txRef,
    where("cartaoOrigem", "==", cartaoId),
    where("mesFaturaRef", "==", anoMes)
);
const snap = await getDocs(q);
const pagamentos = snap.docs.filter(d => d.data().origem === 'pagamento_fatura');
```
**Arquivo**: `js/cartoes.js`, função `desfazerPagamentoFatura()` + `firestore.indexes.json`

---

### PROBLEMA #7: Importação IA usa data fixa (dia 15)
**Localização**: `salvarTransacoesIA()`, linha ~1015
**Gravidade**: 🟡 MÉDIA  
**Descrição**: `dataReferencia: "${anoMes}-15"` — a data real de cada transação extraída pela IA é ignorada.
**Impacto**: Perde-se a informação de quando cada gasto realmente aconteceu. Todos ficam no dia 15.

**🔧 SOLUÇÃO**: Usar a data extraída pela IA (campo `data` do item processado):
```javascript
// Em salvarTransacoesIA():
// ANTES (errado):
dataReferencia: `${anoMes}-15`,

// DEPOIS (correto):
dataReferencia: item.data 
    ? formatarDataExtraida(item.data, anoMes)  // usar data real da IA
    : `${anoMes}-15`,                           // fallback se IA não extraiu

// Função auxiliar:
function formatarDataExtraida(dataStr, anoMesFallback) {
    // dataStr pode vir como "15/03", "2025-03-15", "15 MAR", etc.
    // Normalizar para YYYY-MM-DD
    const match = dataStr.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (match) {
        const dia = match[1].padStart(2, '0');
        return `${anoMesFallback}-${dia}`;
    }
    return `${anoMesFallback}-15`; // fallback
}
```
**Arquivo**: `js/cartoes.js`, função `salvarTransacoesIA()`

---

### PROBLEMA #8: `origem: 'importacao'` inconsistente
**Localização**: `salvarTransacoesIA()`, linha ~1018
**Gravidade**: 🟢 BAIXA
**Descrição**: Usa `origem: 'importacao'` mas importar.js usa `'importacao_ia'`, `'csv'`, `'ofx'`. Inconsistência de nomenclatura.
**Impacto**: Filtros por origem podem não funcionar corretamente entre módulos.

**🔧 SOLUÇÃO**: Padronizar nomenclatura. Sugestão:
```javascript
// Em salvarTransacoesIA() (cartoes.js):
// ANTES:
origem: 'importacao',
// DEPOIS:
origem: 'importacao_ia',  // Consistente com importar.js

// Criar constantes globais (bud-utils.js ou constants.js):
export const ORIGENS = {
    MANUAL: 'manual',
    IMPORTACAO_CSV: 'importacao_csv',
    IMPORTACAO_OFX: 'importacao_ofx',
    IMPORTACAO_IA: 'importacao_ia',
    RECORRENTE: 'recorrente',
    PAGAMENTO_FATURA: 'pagamento_fatura'
};
```
**Arquivos**: `js/cartoes.js`, `js/importar.js`, `bud-utils.js`

---

### PROBLEMA #9: Importação IA não atualiza faturaAtual/limiteDisponivel
**Localização**: `salvarTransacoesIA()`, linhas ~1005-1040
**Gravidade**: 🔴 ALTA (combinado com Problema #1)
**Descrição**: Após importar N transações via IA, os campos `faturaAtual` e `limiteDisponivel` do cartão NÃO são atualizados. A renderização calcula corretamente via transações, mas o Firestore fica desatualizado.
**Impacto**: Dashboard, modal de pagar com outro cartão, etc. mostram valores errados.

**🔧 SOLUÇÃO**: Adicionar atualização dos campos denormalizados após o loop de importação:
```javascript
// Em salvarTransacoesIA(), APÓS o loop de addDoc:
// Calcular total importado (excluindo estornados/cancelados detectados pela IA)
const totalImportado = itensIAExtraidos
    .filter(item => item.selecionado && item.status !== 'estornado' && item.status !== 'cancelado')
    .reduce((sum, item) => sum + item.valor, 0);

// Atualizar cartão
if (totalImportado > 0) {
    const cartaoRef = doc(db, 'usuarios', uid, 'cartoes', cartaoIdSelecionado);
    await updateDoc(cartaoRef, {
        faturaAtual: increment(totalImportado),
        limiteDisponivel: increment(-totalImportado)
    });
}

// OU: se adotar Solução A do Problema #1, remover tudo isso.
```
**Arquivo**: `js/cartoes.js`, função `salvarTransacoesIA()`

---

### PROBLEMA #10: Estornar/cancelar não atualiza faturaAtual
**Localização**: `marcarGastoStatus()`, linhas ~825-850
**Gravidade**: 🔴 ALTA (combinado com Problema #1)
**Descrição**: Ao mudar status para 'estornado' ou 'cancelado', a transação para de contar na renderização, mas `faturaAtual` no Firestore não é decrementado.
**Impacto**: Mesmo problema do #1 — campos denormalizados ficam errados.

**🔧 SOLUÇÃO**: Atualizar faturaAtual ao mudar status:
```javascript
// Em marcarGastoStatus():
async function marcarGastoStatus(txId, novoStatus) {
    const txRef = doc(db, 'usuarios', uid, 'transacoes', txId);
    const txSnap = await getDoc(txRef);
    const txData = txSnap.data();
    const statusAnterior = txData.status || 'ativa';
    
    // Atualizar status
    await updateDoc(txRef, { status: novoStatus });
    
    // ADICIONAR: atualizar faturaAtual do cartão
    if (txData.cartaoId) {
        const cartaoRef = doc(db, 'usuarios', uid, 'cartoes', txData.cartaoId);
        const valor = txData.valor || 0;
        
        if (statusAnterior === 'ativa' && (novoStatus === 'estornado' || novoStatus === 'cancelado')) {
            // Removeu da fatura → decrementar
            await updateDoc(cartaoRef, {
                faturaAtual: increment(-valor),
                limiteDisponivel: increment(valor)
            });
        } else if ((statusAnterior === 'estornado' || statusAnterior === 'cancelado') && novoStatus === 'ativa') {
            // Reativou → incrementar
            await updateDoc(cartaoRef, {
                faturaAtual: increment(valor),
                limiteDisponivel: increment(-valor)
            });
        }
    }
}
```
**Arquivo**: `js/cartoes.js`, função `marcarGastoStatus()`

---

### PROBLEMA #11: Excluir cartão não deleta transações de pagamento de fatura
**Localização**: `executarExclusaoCartao()`, linhas ~367-370
**Gravidade**: 🟡 MÉDIA
**Descrição**: Query busca `where("cartaoId", "==", id)`. Transações de pagamento com saldo têm `cartaoOrigem` (não `cartaoId`), então ficam órfãs.
**Impacto**: Transações de pagamento de fatura (com saldo) persistem no Firestore e no extrato após excluir o cartão.

**🔧 SOLUÇÃO**: Adicionar segunda query para limpar transações de pagamento:
```javascript
// Em executarExclusaoCartao():
// Query existente (transações DO cartão):
const q1 = query(txRef, where("cartaoId", "==", id));
const snap1 = await getDocs(q1);

// ADICIONAR: Query para pagamentos de fatura deste cartão:
const q2 = query(txRef, where("cartaoOrigem", "==", id));
const snap2 = await getDocs(q2);

// Combinar e deletar tudo:
const batch = writeBatch(db);
snap1.docs.forEach(d => batch.delete(d.ref));
snap2.docs.forEach(d => batch.delete(d.ref));
batch.delete(doc(db, 'usuarios', uid, 'cartoes', id));
await batch.commit();
```
**Arquivo**: `js/cartoes.js`, função `executarExclusaoCartao()`

---

### PROBLEMA #12: Lógica de "Fatura Fechada" ignora mês filtrado
**Localização**: `renderizarCartoes()`, linha ~1165
**Gravidade**: 🟡 MÉDIA
**Descrição**: `dataHoje.getDate() >= c.fechamento` compara com o dia de HOJE, não com o mês filtrado. Para meses passados, deveria sempre mostrar "Fechada".
**Impacto**: Meses antigos podem não mostrar "Fechada" quando deveriam.

**🔧 SOLUÇÃO**: Comparar com o mês filtrado em vez de hoje:
```javascript
// Em renderizarCartoes():
// ANTES (errado):
const dataHoje = new Date();
const faturaFechada = dataHoje.getDate() >= c.fechamento;

// DEPOIS (correto):
const mesFiltrado = dataFiltro.getMonth();
const anoFiltrado = dataFiltro.getFullYear();
const mesAtual = new Date().getMonth();
const anoAtual = new Date().getFullYear();

let faturaFechada;
if (anoFiltrado < anoAtual || (anoFiltrado === anoAtual && mesFiltrado < mesAtual)) {
    // Mês passado → fatura SEMPRE fechada
    faturaFechada = true;
} else if (anoFiltrado === anoAtual && mesFiltrado === mesAtual) {
    // Mês atual → depende do dia de fechamento
    faturaFechada = new Date().getDate() >= c.fechamento;
} else {
    // Mês futuro → fatura aberta
    faturaFechada = false;
}
```
**Arquivo**: `js/cartoes.js`, função `renderizarCartoes()`

---

### PROBLEMA #13: Carrega 5000 transações sem filtro
**Localização**: `onSnapshot(transacoes, limit(5000))`, linhas ~1232-1235
**Gravidade**: 🟢 BAIXA (funcional mas ineficiente)
**Descrição**: Carrega TODAS as transações do usuário (até 5000) sem filtrar por cartão ou mês.
**Impacto**: Performance ruim para users com muitas transações. Usa banda e RAM desnecessariamente.

**🔧 SOLUÇÃO**: Filtrar por cartão no Firestore (mínimo) ou por mês (ideal):
```javascript
// Opção A: Filtrar por mês (mais eficiente)
const anoMes = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}`;
const qTx = query(txRef,
    where("cartaoId", "!=", null),              // só transações de cartão
    where("dataReferencia", ">=", anoMes + "-01"),
    where("dataReferencia", "<=", anoMes + "-31"),
    limit(1000)
);

// Opção B: Manter carregamento amplo mas com paginação
// Usar startAfter() + limit() para carregar em chunks

// NOTA: parcelamentos podem ter dataReferencia em meses futuros,
// então talvez seja necessário carregar mês atual + N meses à frente
```
**Arquivo**: `js/cartoes.js`, listener `onSnapshot` de transações

---

### PROBLEMA #14: Cancelado sobrescreve estornado
**Localização**: `processarItensIA()`, linhas ~862-885
**Gravidade**: 🟢 BAIXA (raro)
**Descrição**: Se descrição contém tanto padrão de estorno quanto de cancelamento, o `if` de cancelamento roda depois e sobrescreve.
**Impacto**: Uma transação que deveria ser "estornada" pode ficar como "cancelada" (ambos excluem da fatura, mas o significado é diferente).

**🔧 SOLUÇÃO**: Mudar o segundo `if` para `else if`:
```javascript
// Em processarItensIA():
// ANTES (errado — cancelado sobrescreve estornado):
if (/estorn|devol|cr[eé]dito/i.test(desc)) {
    item.status = 'estornado';
}
if (/cancel|anul/i.test(desc)) {       // ← if independente!
    item.status = 'cancelado';
}

// DEPOIS (correto — mutuamente exclusivos):
if (/estorn|devol|cr[eé]dito/i.test(desc)) {
    item.status = 'estornado';
} else if (/cancel|anul/i.test(desc)) {  // ← else if!
    item.status = 'cancelado';
}
```
**Arquivo**: `js/cartoes.js`, função `processarItensIA()`

---

### PROBLEMA #15: Dashboard usa faturaAtual denormalizado
**Localização**: `js/dashboard.js`, linhas ~173-190
**Gravidade**: 🟡 MÉDIA
**Descrição**: O painel de cartões no dashboard lê `c.faturaAtual || 0` direto do Firestore.
**Impacto**: Mostra valor errado se faturaAtual está desatualizado (Problema #1).

**🔧 SOLUÇÃO**: Dashboard deve calcular fatura dinamicamente (como `renderizarCartoes()` faz):
```javascript
// Em js/dashboard.js — onde monta o painel de cartões:
// ANTES (errado):
const fatura = c.faturaAtual || 0;

// DEPOIS (correto):
// Carregar transações do cartão para o mês atual
const mesKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
const qTx = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    where('cartaoId', '==', c.id),
    where('dataReferencia', '>=', mesKey + '-01'),
    where('dataReferencia', '<=', mesKey + '-31')
);
const txSnap = await getDocs(qTx);
const fatura = txSnap.docs
    .filter(d => d.data().status !== 'estornado' && d.data().status !== 'cancelado')
    .reduce((s, d) => s + (d.data().valor || 0), 0);

// OU: criar função compartilhada calcularFaturaCartao() (Problema #1, Opcão A)
// e importá-la no dashboard
```
**Arquivo**: `js/dashboard.js`, seção de renderização de cartões

---

### PROBLEMA #16: Collections "carteira" vs "cartoes" — possivelmente desincronizadas
**Localização**: `js/dashboard.js` (collection "carteira") vs `js/cartoes.js` (collection "cartoes")
**Gravidade**: 🔴 ALTA (POTENCIALMENTE CRÍTICO — precisa verificação)
**Descrição**: O dashboard lê de `usuarios/{uid}/carteira` com `tipo: 'credito'`. O cartões.js lê de `usuarios/{uid}/cartoes`. Se são collections separadas e não há sincronização automática, os dados divergem.
**Impacto**: Cartão adicionado na tela de cartões pode não aparecer no dashboard (e vice-versa). Saldo e limite exibidos podem ser completamente diferentes entre as telas.

**NOTA**: Pode ser que haja algum mecanismo de sincronização não encontrado na análise (Cloud Function, ou ambos apontam para a mesma collection com nomes diferentes). **Precisa verificação.**

**🔧 SOLUÇÃO**: Unificar ou sincronizar as collections:
```javascript
// OPÇÃO A (Recomendada): Unificar collections
// Dashboard deve ler de "cartoes" (mesma collection que cartoes.js)
// Em js/dashboard.js:
// ANTES:
const carteiraRef = collection(db, 'usuarios', uid, 'carteira');
const q = query(carteiraRef, where('tipo', '==', 'credito'));

// DEPOIS:
const cartoesRef = collection(db, 'usuarios', uid, 'cartoes');
// (sem where — cartoes já são todos de crédito)

// OPÇÃO B: Cloud Function de sincronização
// Quando cartão é criado/editado em "cartoes", replicar para "carteira"
exports.syncCartaoToCarteira = functions.firestore
    .document('usuarios/{uid}/cartoes/{cartaoId}')
    .onWrite(async (change, context) => {
        const { uid, cartaoId } = context.params;
        const carteiraRef = admin.firestore()
            .doc(`usuarios/${uid}/carteira/${cartaoId}`);
        
        if (!change.after.exists) {
            // Cartão deletado → remover da carteira
            await carteiraRef.delete();
            return;
        }
        
        const data = change.after.data();
        await carteiraRef.set({
            ...data,
            tipo: 'credito',
            syncedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
```
**Arquivos**: `js/dashboard.js` OU `functions/index.js`

---

### PROBLEMA #17: Recorrentes não vinculam a cartão
**Localização**: `js/recorrentes.js`
**Gravidade**: 🟢 BAIXA
**Descrição**: Despesas recorrentes com `formaPagamento: 'Crédito'` não têm `cartaoId`. Não aparecem na fatura.
**Impacto**: User precisa gerenciar manualmente (duplicando informação ou ignorando no cartão).

**🔧 SOLUÇÃO**: Adicionar campo `cartaoId` opcional às despesas recorrentes:
```javascript
// Em js/recorrentes.js — formulário de nova recorrente:
// Quando formaPagamento === 'Crédito', mostrar select de cartões:
if (formaPagamento === 'Crédito') {
    // Carregar cartões do user
    const cartoesSnap = await getDocs(collection(db, 'usuarios', uid, 'cartoes'));
    // Mostrar dropdown para selecionar cartão
    // Salvar cartaoId na recorrente
}

// Ao gerar transação mensal da recorrente:
const txData = {
    descricao: recorrente.descricao,
    valor: recorrente.valor,
    tipo: 'despesa',
    categoria: recorrente.categoria,
    cartaoId: recorrente.cartaoId || null,   // ← vincular ao cartão
    dataReferencia: dataDoMes,
    origem: 'recorrente'
};

// Assim a transação aparece automaticamente na fatura do cartão vinculado
```
**Arquivo**: `js/recorrentes.js`

---

## 24. CHECKLIST PARA NOVO PROJETO {#24-checklist}

### Arquitetura de Dados
- [ ] Decidir: `faturaAtual` denormalizado OU cálculo dinâmico puro
- [ ] Se denormalizado: garantir que TODA operação que muda transação atualize o contador
- [ ] Unificar collections "carteira" e "cartoes" ou criar sincronização
- [ ] Criar índices compostos no Firestore para queries de pagamento

### Cálculos de Fatura
- [ ] Filtrar por `status === 'ativa'` em TODO cálculo de fatura (renderização E pagamento)
- [ ] Considerar: fatura = gastos do mês do FECHAMENTO (não mês calendário)
- [ ] Implementar lógica de fechamento real (não apenas dia do mês)

### Pagamento de Fatura
- [ ] Usar data do mês filtrado (não data de hoje) para referência
- [ ] Considerar: parcial payment (pagar só parte da fatura)
- [ ] Limpar transações de pagamento ao excluir cartão (incluir `cartaoOrigem`)

### Importação
- [ ] Usar data real das transações (não dia 15 fixo)
- [ ] Unificar nomenclatura de `origem` ('importacao' vs 'importacao_ia')
- [ ] Atualizar `faturaAtual` após importação
- [ ] Detectar duplicidades antes de importar

### Parcelamento
- [ ] Decidir se parcelas futuras devem afetar `faturaAtual` do cartão ou não
- [ ] Considerar: o que acontece se o user exclui uma parcela? As outras devem ser excluídas?
- [ ] Implementar "grupo de parcelas" (vinculá-las a um ID comum)

### Status de Transação
- [ ] Ao estornar/cancelar: atualizar `faturaAtual` e `limiteDisponivel`
- [ ] Ao reativar: reverter a atualização
- [ ] Considerar: estorno parcial (devolver parte do valor)

### Performance
- [ ] Filtrar transações no Firestore (não carregar 5000)
- [ ] Usar queries com where por cartaoId e mês
- [ ] Cache local para evitar re-renders desnecessários

### UI/UX
- [ ] Lógica de "Fatura Fechada": comparar com mês filtrado, não mês atual
- [ ] Mostrar aviso quando `faturaAtual` parece dessincronizado
- [ ] Permitir vincular despesas recorrentes a cartão específico
