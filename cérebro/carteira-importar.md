# 💼 Carteira + Importar: Sistema de Contas & Extratos

**Última atualização:** 2026-04-06  
**Status:** Documentação + Implementação (Opção 3 — Snapshots)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura da Carteira](#estrutura-da-carteira)
3. [Fluxo de Importação](#fluxo-de-importação)
4. [Como Comunicam (Firestore)](#como-comunicam-firestore)
5. [Problema: Saldo Duplicado](#problema-saldo-duplicado)
6. [Solução: Snapshots Confirmados](#solução-snapshots-confirmados)
7. [Funcionamento do importar.html](#funcionamento-do-importarhtml)
8. [Implementação Técnica](#implementação-técnica)
9. [Exemplos Práticos](#exemplos-práticos)

---

## 🎯 Visão Geral

**Carteira** = Cria contas, cartões, vales (formas de pagamento)  
**Importar** = Faz upload de extratos bancários (histórico de transações)

Eles se conectam via `cartaoId` / `carteiraVinculadaId`. Mas havia um problema:
- Transações importadas eram somadas **duas vezes** no dashboard
- Precisava de um **snapshot de saldo confirmado** por extrato

---

## 📱 Estrutura da Carteira

### Documento da Carteira

```firestore
usuarios/{uid}/carteira/{carteiraId}
├─ nome: "Nubank"
├─ tipo: "debito"  // ou "credito", "dinheiro", "vale_refeicao"
├─ saldoInicial: 5000  // quando criada
├─ ultimaConfirmacao: {
│   data: "2026-04-06",           // data do último extrato
│   saldo: 5050,                  // saldo CONFIRMADO nessa data
│   origem: "extrato_importado"   // de onde veio
│ }
├─ criadaEm: timestamp
└─ atualizadaEm: timestamp
```

### Tipos de Carteira

| Tipo | Ícone | Descrição | Usa Saldo? |
|------|-------|-----------|-----------|
| `dinheiro` | 💵 | Dinheiro em mão | Sim |
| `debito` | 🏦 | Conta corrente (Nubank, Caixa, etc) | Sim |
| `credito` | 💳 | Cartão de crédito | Não (usa fatura) |
| `vale_refeicao` | 🍽️ | Vale refeição | Sim |
| `vale_alimentacao` | 🛒 | Vale alimentação | Sim |
| `transporte` | 🚌 | Cartão transporte | Sim |
| `evento` | 🎪 | Ingresso de evento | Não |

---

## 📥 Fluxo de Importação

### Passo 1: Upload
```
User seleciona arquivo:
├─ CSV/OFX (dados estruturados)
├─ PDF (scanner)
├─ Imagem/Print (IA com OCR)
└─ WhatsApp/Telegram (forward de chat)
```

### Passo 2: Processamento
```
Backend (IA):
├─ Extrai transações
├─ Detecta Tipo (receita/despesa)
├─ Classifica Categoria (IA)
└─ Retorna: [ { data, descricao, tipo, valor, categoria }, ... ]
```

### Passo 3: Vincular à Carteira
```
Sistema mostra dropdown:
[✓] Cartão Nubank
[ ] Dinheiro
[ ] Vale Refeição

User seleciona → carteiraVinculadaId = "cart_nubank_123"
```

### Passo 4: Pré-visualização
```
Antes de confirmar:
├─ Mostra todas as transações
├─ Permite corrigir tipo/categoria
├─ Pode aplicar tipo/categoria GLOBAL
└─ User revisa e clica "Importar"
```

### Passo 5: Salvar no Firestore
```javascript
// Para cada transação
await addDoc(
  collection(db, "usuarios", uid, "transacoes"),
  {
    tipo: "despesa",
    descricao: "Compra MercadoLivre",
    valor: 200,
    dataReferencia: "2026-04-05",
    categoria: "Compras Online",
    cartaoId: "cart_nubank_123",           // ← Referencia a carteira
    carteiraVinculadaId: "cart_nubank_123",
    importadaEm: serverTimestamp(),
    origem: "csv_nubank",  // auditoria
    statusPagamento: "pago"  // já foi debitada
  }
);

// UPDATE na carteira com novo snapshot
await updateDoc(
  doc(db, "usuarios", uid, "carteira", "cart_nubank_123"),
  {
    ultimaConfirmacao: {
      data: "2026-04-06",   // data do import
      saldo: 5050,          // saldo final do extrato
      origem: "extrato_importado"
    }
  }
);
```

---

## 🔗 Como Comunicam (Firestore)

### Link via IDs

```
carteira/
├─ cart_nubank_123: { nome: "Nubank", tipo: "debito", ultimaConfirmacao: {...} }
└─ cart_dinheiro: { nome: "Dinheiro", tipo: "dinheiro", ultimaConfirmacao: {...} }

transacoes/
├─ txn_001: { descricao: "Mercado", cartaoId: "cart_nubank_123" }
├─ txn_002: { descricao: "Uber", cartaoId: "cart_nubank_123" }
└─ txn_003: { descricao: "Pix", cartaoId: "cart_dinheiro" }
```

### Dashboard Usa Esta Relação

```javascript
// dashboard.js - Calcular saldo
function calcularSaldo(carteira, transacoes) {
  // Base: último extrato confirmado
  let saldo = carteira.ultimaConfirmacao?.saldo || carteira.saldoInicial;
  
  // Add: transações MANUAIS após confirmação
  const dataConfirmacao = carteira.ultimaConfirmacao?.data || "1900-01-01";
  const transacoesPosteriores = transacoes.filter(t => 
    t.cartaoId === carteira.id &&
    t.dataReferencia > dataConfirmacao &&
    t.origem !== "csv" && t.origem !== "ofx"  // não são importadas
  );
  
  transacoesPosteriores.forEach(t => {
    if (t.tipo === "receita") saldo += t.valor;
    else saldo -= t.valor;
  });
  
  return saldo;
}
```

---

## ❌ Problema: Saldo Duplicado

### O Que Acontecia Before (Opção 1)

```
Carteira Nubank: saldoInicial = 5000

Extrato importado (01-06/04):
- MercadoLivre: -200
- Pix: +300  
- Uber: -50

Dashboard fazia:
totalReceitas = 300
totalDespesas = 250
NOVO SALDO = 300 - 250 = R$ 50   ❌ ERRADO!

Deveria ser = 5000 + 300 - 250 = R$ 5.050 ✅ CORRETO!
```

### Causa

- Sistema somava **todas** as transações desde dia 1
- Não diferenciava importadas (histórico) de manuais (presentes)
- Resultava em saldo completamente errado

---

## ✅ Solução: Snapshots Confirmados

### Conceito

```
Cada importação cria um "checkpoint" do saldo confirmado.

Timeline:
├─ 01/04: Cria Carteira Nubank (saldoInicial = 5.000)
├─ 06/04 22h: Importa extrato (01-06/04)
│  └─ ultimaConfirmacao = { data: "2026-04-06", saldo: 5.050 }
├─ 07/04 10h: Adiciona cafeteria -15 (MANUAL)
│  └─ saldoAtual = 5.050 - 15 = R$ 5.035
├─ 08/04 14h: Importa novo extrato (07-08/04)
│  └─ ultimaConfirmacao = { data: "2026-04-08", saldo: 5.020 }
└─ 09/04 18h: Adiciona Pix +300 (MANUAL)
   └─ saldoAtual = 5.020 + 300 = R$ 5.320
```

### Fórmula

```javascript
saldoAtual = ultimaConfirmacao.saldo 
           + Σ(transacoes manuais após ultimaConfirmacao.data)
           - Σ(despesas manuais após ultimaConfirmacao.data)
```

### Benefícios

✅ **Correto** — Histórico importado não mexe em saldo  
✅ **Simples** — Apenas 1 snapshot por carteira  
✅ **Auditável** — Sabe quando foi última confirmação  
✅ **Flexível** — Importa em qualquer ordem, mesmo retroativo  
✅ **Intuitivo** — "Seu saldo confirmado em 06/04 era R$ 5.050"  

---

## 🔧 Implementação Técnica

### 1. Carteira: Adicionar Campo

**carteira.js — ao salvar/editar carteira**

```javascript
// Quando cria carteira
await addDoc(collection(db, "usuarios", uid, "carteira"), {
  nome: "Nubank",
  tipo: "debito",
  saldoInicial: 5000,
  ultimaConfirmacao: null,  // ← Novo campo
  criadaEm: serverTimestamp(),
  atualizadaEm: serverTimestamp()
});

// Quando user edita saldoInicial
await updateDoc(doc(db, "usuarios", uid, "carteira", carteiraId), {
  saldoInicial: novoSaldo,
  ultimaConfirmacao: null  // reset
});
```

### 2. Importar: Capturar Saldo Final

**importar.js — no processamento do arquivo**

```javascript
// Após processar arquivo, extrair saldo final
let saldoFinalExtrato = null;

// CSV/OFX: procura campo "Saldo Final" ou "Balance"
if (formatoArquivo === "csv" || formatoArquivo === "ofx") {
  saldoFinalExtrato = parsedRows[parsedRows.length - 1]?.saldoFinal;
}

// PDF/Imagem: IA tenta ler saldo final
if (formatoArquivo === "pdf" || formatoArquivo === "image") {
  // Backend retorna: { transacoes: [...], saldoFinal: 5050 }
  saldoFinalExtrato = response.saldoFinal;
}

// Se não conseguir achar saldo final, calcula
if (!saldoFinalExtrato) {
  const dataAnterior = new Date(carteira.ultimaConfirmacao?.data || "1900-01-01");
  const saldoAnterior = carteira.ultimaConfirmacao?.saldo || carteira.saldoInicial;
  const delta = transacoes.reduce((s, t) => {
    return s + (t.tipo === "receita" ? t.valor : -t.valor);
  }, 0);
  saldoFinalExtrato = saldoAnterior + delta;
}
```

### 3. Importar: Atualizar Carteira

**importar.js — após confirmação**

```javascript
async function importarTransacoes() {
  const carteiraId = document.getElementById("selecionarCarteira").value;
  const transacoes = parsedRows;  // array processado
  const saldoFinal = calcularSaldoFinal();  // ← Novo
  
  const batch = writeBatch(db);
  
  // 1. Adiciona todas as transações
  transacoes.forEach(t => {
    const newDocRef = doc(collection(db, "usuarios", currentUser.uid, "transacoes"));
    batch.set(newDocRef, {
      ...t,
      cartaoId: carteiraId,
      carteiraVinculadaId: carteiraId,
      importadaEm: serverTimestamp(),
      origem: "csv_importado"  // ou "pdf_import", "image_import"
    });
  });
  
  // 2. UPDATE na carteira com novo snapshot ← NOVO
  const carteiraRef = doc(db, "usuarios", currentUser.uid, "carteira", carteiraId);
  batch.update(carteiraRef, {
    ultimaConfirmacao: {
      data: new Date().toISOString().slice(0, 10),
      saldo: saldoFinal,
      origem: "extrato_importado",
      dataExtrato: extratoDataFim  // última data do extrato
    }
  });
  
  await batch.commit();
  mostrarSucesso(`${transacoes.length} transações importadas!`);
}
```

### 4. Dashboard: Recalcular Saldo

**dashboard.js — função de render**

```javascript
function renderizarDashboard() {
  // Iteraçãosobres carteiras
  carteiraGlobal.forEach(carteira => {
    const saldoAtual = calcularSaldoCarteira(carteira);
    atualizarWidgetCarteira(carteira.id, saldoAtual);
  });
}

function calcularSaldoCarteira(carteira) {
  // Base: snapshot confirmado
  let saldo = carteira.ultimaConfirmacao?.saldo ?? carteira.saldoInicial;
  
  // Filtrar transações POSTERIORES ao snapshot
  const dataConfirmacao = carteira.ultimaConfirmacao?.data || "1900-01-01";
  const transacoesPosteriores = transacoesGlobais.filter(t => 
    t.cartaoId === carteira.id &&
    t.dataReferencia > dataConfirmacao
  );
  
  // Somar transações manuais (origem ≠ "csv"/"ofx"/"image")
  transacoesPosteriores.forEach(t => {
    if (!["csv_importado", "ofx_importado", "image_importado"].includes(t.origem)) {
      if (t.tipo === "receita") saldo += t.valor;
      else saldo -= t.valor;
    }
  });
  
  return saldo;
}
```

---

## 📊 Exemplos Práticos

### Scenario 1: Conta Corrente Simples

```
06/04 — CRIAR CARTEIRA
└─ Nubank | tipo: debito | saldoInicial: 5.000
  └─ ultimaConfirmacao: null

06/04 22h — IMPORTA EXTRATO (01-06 de abril)
├─ Arquivo: extract_202604.csv
├─ Transações: MercadoLivre -200, Pix +300, Uber -50
├─ Saldo final no extrato: 5.050
└─ Sistema atualiza:
   └─ ultimaConfirmacao = {
      data: "2026-04-06",
      saldo: 5050,
      origem: "extrato_importado"
    }

07/04 10h — ADICIONA CAFETERIA (MANUAL)
├─ Cafeteria -15
├─ Dashboard calcula:
│  └─ 5.050 (snapshot) - 15 (transação posterior) = R$ 5.035 ✅
└─ ultimaConfirmacao: NÃO MUDA (importação foi anterior)

08/04 14h — IMPORTA NOVO EXTRATO (07-08 de abril)
├─ Arquivo: extract_202604_novo.csv
├─ Transações: Netflix -20, PIX -50
├─ Saldo final: 4.965
└─ Sistema atualiza:
   └─ ultimaConfirmacao = {
      data: "2026-04-08",
      saldo: 4965,
      origem: "extrato_importado"
    }
   └─ Dashboard calcula: 4.965 + 0 (nenhuma manual) = R$ 4.965 ✅
```

### Scenario 2: Múltiplas Carteiras

```
CRIADAS:
├─ Nubank (debito) | saldoInicial: 5.000
├─ Dinheiro (dinheiro) | saldoInicial: 300
└─ Vale Refeição | saldoInicial: 200

IMPORTAÇÕES:
├─ Nubank: -200 (mercado), +100 (pix) → snapshot: 4.900
└─ Vale: -50 (almoço), -50 (café) → snapshot: 100

TRANSAÇÕES MANUAIS:
├─ Nubank: -50 (uber manual) → 4.900 - 50 = 4.850
├─ Dinheiro: -100 (gaveta) → 300 - 100 = 200
└─ Vale: +50 (recarga) → 100 + 50 = 150

RESULTADO NO DASHBOARD:
├─ Saldo Disponível: R$ 4.850 + R$ 200 + R$ 150 = 5.200 ✅
└─ Em Faturas (cartão crédito): R$ 0
```

---

## 📥 Funcionamento do importar.html

A tela **Importar Transações** é o coração do sistema de sincronização com bancos. Funciona em **4 fases visíveis** + **1 backend**.

### Estrutura Visual

```
┌─────────────────────────────────────────────────┐
│  📥 Importar Transações                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  FASE 1: Selecionar Arquivo                    │
│  ┌──────────────────────────────────────────┐  │
│  │  📁 Arraste o arquivo aqui               │  │
│  │     ou clique para selecionar            │  │
│  │  PDF · Imagem · CSV · OFX · WhatsApp     │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  FASE 2: Vincular à Carteira                   │
│  [ Selecione uma forma de pagamento... ▼ ]    │
│  [ Continuar para Revisão → ]                 │
│                                                 │
│  FASE 3: Pré-visualização                     │
│  [ 🤖 Detectar Tipo ▼ ] [ Manter da IA ▼ ]   │
│  ┌───────────────────────────────────────┐   │
│  │ Data│Descrição│Tipo│Valor│Categoria  │   │
│  ├───────────────────────────────────────┤   │
│  │ 01/4│Mercado  │📉  │-200 │Mercado   │   │
│  │ 02/4│Pix      │📈  │+300 │Receita   │   │
│  └───────────────────────────────────────┘   │
│  [ Importar Transações ]                      │
│                                                 │
│  FASE 4: Resultado                            │
│  ✅ Importação Concluída!                     │
│  3 transações importadas                      │
│  [ Ver Extrato →]                              │
└─────────────────────────────────────────────────┘
```

### FASE 1: Selecionar Arquivo

#### Componentes

```html
<div id="dropZone" class="drop-zone">
  <!-- Drag & drop zone -->
  <input type="file" id="fileInput" accept=".csv,.ofx,.qfx,.pdf,.txt,image/*">
</div>

<div id="importLoading" class="hidden">
  <!-- Progress spinner -->
  <p id="loadingMsg">Processando arquivo com IA...</p>
</div>

<div id="fileInfo" class="hidden">
  <!-- Sucesso após upload -->
  <span id="fileName"></span> · 
  <span id="fileRows">0</span> transações encontradas
</div>
```

#### Estados

| Estado | Evento | Próximo |
|--------|--------|---------|
| **Inicial** | User arrasta/clica | → Processado |
| **Processando** | File selecionado → Backend IA | → Resultado |
| **Resultado** | ✅ Sucesso | → FASE 2 |
| **Erro** | ❌ Falha parser | → Mostrar erro |

#### Fluxo JavaScript

```javascript
// importar.js - FASE 1

// Evento: Arquivo selecionado
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  if (["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
    // → Backend IA (OCR)
    await procesarComIA(file);
  } else if (file.name.endsWith(".csv")) {
    // → Parser CSV local
    const rows = parseCSV(file);
    parsedRows = rows;
  } else if (file.name.endsWith(".ofx")) {
    // → Parser OFX local
    const rows = parseOFX(file);
    parsedRows = rows;
  }
  
  // Update UI
  document.getElementById("fileInfo").classList.remove("hidden");
  document.getElementById("fileName").textContent = file.name;
  document.getElementById("fileRows").textContent = parsedRows.length;
  
  // Mostrar FASE 2
  document.getElementById("carteiraSection").classList.remove("hidden");
});

async function procesarComIA(file) {
  document.getElementById("importLoading").classList.remove("hidden");
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("tipoArquivo", file.type.includes("pdf") ? "pdf" : "image");
  
  const response = await fetch(`${BACKEND_URL}/api/importar`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${getAuthToken()}` },
    body: formData
  });
  
  if (!response.ok) {
    alert("Erro ao processar arquivo");
    return;
  }
  
  const data = await response.json();
  parsedRows = data.transacoes;  // ← Retorno da IA
  
  document.getElementById("importLoading").classList.add("hidden");
  document.getElementById("carteiraSection").classList.remove("hidden");
}
```

---

### FASE 2: Vincular à Carteira

#### Componentes

```html
<div id="carteiraSection" class="hidden">
  <h3>🔗 Vincular à Carteira</h3>
  <p>De qual conta ou cartão são essas transações?</p>
  
  <select id="selecionarCarteira">
    <option value="">Selecione uma forma de pagamento...</option>
    <!-- Populada por JS com items de carteira/ -->
  </select>
  
  <button onclick="confirmarCarteira()">
    Continuar para Revisão →
  </button>
</div>
```

#### Fluxo

```
User vê dropdown preenchido com carteiraGlobal:
├─ 💳 Nubank (debito)
├─ 💵 Dinheiro
└─ 🍽️ Vale Refeição

User seleciona → carteiraVinculadaId = "cart_123"
User clica → confirmarCarteira()
  └─ Valida: se carteira != "" então → FASE 3
  └─ Else: alert("Selecione uma carteira")
```

#### JavaScript

```javascript
// importar.js - FASE 2

function carregarDropdownCarteira() {
  const select = document.getElementById("selecionarCarteira");
  carteiraGlobal.forEach(cart => {
    const icon = TIPO_INFO[cart.tipo]?.icone || '💰';
    const option = document.createElement("option");
    option.value = cart.id;
    option.textContent = `${icon} ${cart.nome}`;
    select.appendChild(option);
  });
}

window.confirmarCarteira = function() {
  const carteiraId = document.getElementById("selecionarCarteira").value;
  
  if (!carteiraId) {
    alert("Por favor, selecione uma carteira");
    return;
  }
  
  carteiraVinculadaId = carteiraId;
  const carteira = carteiraGlobal.find(c => c.id === carteiraId);
  
  // Mostrar info da carteira selecionada
  document.getElementById("carteiraVinculadaBadge").innerHTML = 
    `💳 Vinculado a: <strong>${carteira.nome}</strong>`;
  
  // Mostrar FASE 3
  document.getElementById("carteiraSection").classList.add("hidden");
  document.getElementById("previewSection").classList.remove("hidden");
  
  # Preencher tabela de preview
  renderPreviewTable();
};
```

---

### FASE 3: Pré-visualização & Correção

#### Componentes

```html
<div id="previewSection" class="hidden">
  <!-- Seletor de tipo global -->
  <button id="btnTipoGlobal" onclick="toggleTipoDropdown()">
    🤖 Detectar Tipo ▼
  </button>
  <div id="tipoGlobalList" class="hidden">
    <button onclick="selectTipoGlobal('auto')">🤖 Detectar Tipo</button>
    <button onclick="selectTipoGlobal('despesa')">📉 Tudo Despesa</button>
    <button onclick="selectTipoGlobal('receita')">📈 Tudo Receita</button>
  </div>
  
  <!-- Seletor de categoria global -->
  <button id="btnCatGlobal" onclick="toggleGlobalCatDropdown()">
    Manter da IA ▼
  </button>
  <div id="catGlobalList" class="hidden">
    <!-- Categorias preenchidas por JS -->
  </div>
  
  <!-- Tabela de preview -->
  <table id="previewTable">
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrição</th>
        <th>Tipo</th>
        <th>Valor</th>
        <th>Categoria</th>
      </tr>
    </thead>
    <tbody id="previewBody"></tbody>
  </table>
  
  <button id="btnImportar" onclick="importarTransacoes()">
    Importar Transações
  </button>
</div>
```

#### Funcionalidades

**1. Detectar Tipo Global**
```javascript
// Aplica tipo (auto/receita/despesa) para TODAS as linhas não confirmadas
window.selectTipoGlobal = function(tipo, icone, label) {
  document.getElementById("tipoGlobal").value = tipo;
  document.getElementById("tipoGlobalLabel").textContent = label;
  
  parsedRows.forEach(row => {
    if (tipo === "auto") {
      row.tipo = detectarTipo(row.descricao);  // IA automática
    } else {
      row.tipo = tipo;
    }
  });
  
  renderPreviewTable();
};
```

**2. Aplicar Categoria Global**
```javascript
// Aplica categoria para TODAS as linhas
window.selectCategGlobal = function(nomeCat) {
  document.getElementById("categoriaGlobal").value = nomeCat;
  document.getElementById("catGlobalLabel").textContent = nomeCat;
  
  parsedRows.forEach(row => {
    row.categoria = nomeCat;
  });
  
  renderPreviewTable();
};
```

**3. Renderizar Tabela Preview**
```javascript
function renderPreviewTable() {
  const tbody = document.getElementById("previewBody");
  tbody.innerHTML = parsedRows.map((row, idx) => `
    <tr>
      <td>
        <input type="date" value="${row.data}" 
          onchange="parsedRows[${idx}].data = this.value">
      </td>
      <td>
        <input type="text" value="${row.descricao}" 
          onchange="parsedRows[${idx}].descricao = this.value">
      </td>
      <td>
        <select onchange="parsedRows[${idx}].tipo = this.value">
          <option value="receita" ${row.tipo === 'receita' ? 'selected' : ''}>📈 Receita</option>
          <option value="despesa" ${row.tipo === 'despesa' ? 'selected' : ''}>📉 Despesa</option>
        </select>
      </td>
      <td>
        <input type="text" class="mask-money" value="${formatarValor(row.valor)}" 
          onchange="parsedRows[${idx}].valor = parseDinheiro(this.value)">
      </td>
      <td>
        <select onchange="parsedRows[${idx}].categoria = this.value">
          <option value="">Sem categoria</option>
          ${categsPadrao[row.tipo].map(cat => `
            <option value="${cat}" ${row.categoria === cat ? 'selected' : ''}>${cat}</option>
          `).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}
```

#### User pode

✅ **Editar inline:**
- Data da transação
- Descrição
- Tipo (receita/despesa)
- Valor
- Categoria

✅ **Aplicar globalmente:**
- Todos tipo receita
- Todos tipo despesa
- Auto-detectar tipo
- Todas categoria X

---

### FASE 4: Resultado

#### Componentes

```html
<div id="resultSection" class="hidden">
  <span class="text-5xl">✅</span>
  <h3>Importação Concluída!</h3>
  <p id="resultMsg"></p>
  <a href="extrato.html">Ver Extrato</a>
</div>
```

#### Fluxo

```javascript
window.importarTransacoes = async function() {
  const carteiraId = carteiraVinculadaId;
  const transacoes = parsedRows;
  
  // Validação
  if (!carteiraId) {
    alert("Nenhuma carteira selecionada");
    return;
  }
  if (transacoes.length === 0) {
    alert("Nenhuma transação para importar");
    return;
  }
  
  // Calcular saldo final
  const carteira = carteiraGlobal.find(c => c.id === carteiraId);
  const saldoFinal = transacoes.reduce((s, t) => {
    return s + (t.tipo === "receita" ? t.valor : -t.valor);
  }, carteira.ultimaConfirmacao?.saldo ?? carteira.saldoInicial);
  
  // Batch: adicionar transações + atualizar carteira
  const batch = writeBatch(db);
  
  transacoes.forEach(t => {
    const txnRef = doc(collection(db, "usuarios", currentUser.uid, "transacoes"));
    batch.set(txnRef, {
      ...t,
      cartaoId: carteiraId,
      carteiraVinculadaId: carteiraId,
      importadaEm: serverTimestamp(),
      origem: "csv_importado",  // ou "pdf_importado", "image_importado"
      statusPagamento: "pago"   // já foi debitada/creditada
    });
  });
  
  // UPDATE carteira com novo snapshot
  const carteiraRef = doc(db, "usuarios", currentUser.uid, "carteira", carteiraId);
  batch.update(carteiraRef, {
    ultimaConfirmacao: {
      data: new Date().toISOString().slice(0, 10),
      saldo: saldoFinal,
      origem: "extrato_importado"
    }
  });
  
  await batch.commit();
  
  // Mostrar resultado
  document.getElementById("previewSection").classList.add("hidden");
  document.getElementById("resultSection").classList.remove("hidden");
  document.getElementById("resultMsg").textContent = 
    `${transacoes.length} transações importadas para ${carteira.nome}`;
};
```

---

### Estados da UI Ao Longo do Fluxo

```
INICIAL:
├─ dropZone: visível
├─ carteiraSection: hidden
├─ previewSection: hidden
└─ resultSection: hidden

APÓS UPLOAD:
├─ dropZone: hidden
├─ importLoading: visível (spinner)
├─ fileInfo: visível
├─ carteiraSection: visível
├─ previewSection: hidden
└─ resultSection: hidden

APÓS VINCULAR CARTEIRA:
├─ dropZone: hidden
├─ fileInfo: visível
├─ carteiraSection: hidden
├─ previewSection: visível (tabela)
└─ resultSection: hidden

APÓS CONFIRMAR IMPORT:
├─ dropZone: hidden
├─ fileInfo: visível
├─ carteiraSection: hidden
├─ previewSection: hidden
└─ resultSection: visível ✅
```

---

### Campos de Entrada do Usuário

| Campo | Tipo | Opcional? | Validação |
|-------|------|-----------|-----------|
| Arquivo | file input | Não | .csv, .ofx, .pdf, image/* |
| Carteira | select | Não | ≥ 1 opção |
| Tipo (global) | select | Sim | auto/receita/despesa |
| Categoria (global) | select | Sim | nome categoria |
| Data (inline) | date input | Não | YYYY-MM-DD |
| Descrição (inline) | text input | Não | max 255 chars |
| Tipo (inline) | select | Não | receita/despesa |
| Valor (inline) | money input | Não | > 0 |
| Categoria (inline) | select | Não | nome categoria |

---

## 🎮 Interface: O Que Muda

### Carteira (carteira.html)

```html
<!-- Badge mostrando última confirmação -->
<div class="item-carteira">
  <h3>Nubank</h3>
  <p class="text-xs text-slate-400">
    Último extrato: 06/04 às 22h | Saldo confirmado: R$ 5.050
  </p>
  <button onclick="importarExtrato()">📥 Importar Novo Extrato</button>
</div>
```

### Importar (importar.html)

```html
<!-- Campo para saldo final (pré-preenchido se possível) -->
<div id="saldoFinalSection">
  <label>Qual é o saldo final no extrato?</label>
  <input type="text" id="saldoFinalExtrato" placeholder="R$ 0,00" class="mask-money">
  <p class="text-xs text-slate-400">Se deixar vazio, calculamos automaticamente</p>
</div>

<!-- Mostrar data do extrato -->
<label>Data do extrato</label>
<input type="date" id="dataExtratoFim">
```

### Dashboard (dashboard.html)

```html
<!-- Mostrar referência de snapshot -->
<div class="widget-saldo">
  <p id="saldoAtual" class="text-3xl font-bold">R$ 5.035</p>
  <p class="text-xs text-slate-400">
    Baseado em extrato confirmado em 
    <span id="dataUltimaConfirmacao">06/04</span>
  </p>
</div>
```

---

## 📝 Checklist de Implementação

- [ ] `carteira.js`: Adicionar campo `ultimaConfirmacao` ao criar/editar
- [ ] `importar.js`: Extrair `saldoFinalExtrato` do arquivo
- [ ] `importar.js`: Capturar `dataExtratoFim` do formulário
- [ ] `importar.js`: Atualizar carteira com `ultimaConfirmacao` após import
- [ ] `dashboard.js`: Criar função `calcularSaldoCarteira()`
- [ ] `dashboard.js`: Usar nova fórmula de saldo no render
- [ ] `carteira.html`: Mostrar badge de última confirmação
- [ ] `importar.html`: Adicionar campo para saldo final
- [ ] Testes: Importar, verificar saldo, adicionar transação, verificar novamente

---

## 🚀 Próximos Passos

1. **Reconciliação**: Botão "Reconciliar com extrato" (para corrigir transações)
2. **Alertas**: "Seu saldo em 06/04 era R$ 5.050, mas está R$ 5.100. Diferença: +R$ 50"
3. **Histórico**: Mostrar todos os snapshots anteriores
4. **Duplicata**: Detectar se transação já foi importada (por descrição + data + valor)

---

**Documento criado:** 2026-04-06  
**Próxima revisão:** Após implementação da Opção 3

---

# 🐛 AUDITORIA DE ERROS — Carteira + Importar

> Auditoria realizada em 08/04/2026 — Arquivos analisados: `carteira.html`, `js/carteira.js`, `importar.html`, `js/importar.js`

---

## Problemas Encontrados: 15

### 🔴 Problema #1 — GRAVE: Classes Tailwind Dinâmicas no Modal de Exclusão (Carteira)

**Onde:** `js/carteira.js` — linha 731  
**O quê:**
```javascript
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```
`bg-black/40` e `z-[9999]` NÃO existem no build estático. Modal de confirmação de exclusão fica **invisível**.

**Impacto:** Usuário não consegue confirmar exclusão de itens da carteira.

**🔧 SOLUÇÃO:**
```javascript
ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 Problema #2 — GRAVE: `detectarTipo()` Retorna String Inválida para PIX

**Onde:** `js/importar.js` — linha 352  
**O quê:**
```javascript
if (/^pix (?:enviado|recebido)|pix enviado|pix recebido/.test(d)) return 'Transferência';
```
Retorna `'Transferência'` mas o sistema espera apenas `'receita'` ou `'despesa'`. PIX importados falham na validação downstream.

**Impacto:** Transações PIX não são importadas. Podem gerar dados corrompidos.

**🔧 SOLUÇÃO:**
```javascript
if (/pix\s+recebido/i.test(d)) return 'receita';
if (/pix\s+enviado/i.test(d)) return 'despesa';
// Remover a linha que retorna 'Transferência'
```

---

### 🔴 Problema #3 — GRAVE: Sem Error Handling nos Parcelas de Evento (Carteira)

**Onde:** `js/carteira.js` — linhas 635–695 (`registrarCompraEventoFinanceira`)  
**O quê:** Loop de criação de parcelas sem batch/transação:
```javascript
for (let p = 0; p < parcelas; p++) {
    await addDoc(collection(...), { ... }); // Se falhar na parcela 2, parcela 1 já foi!
}
```

**Impacto:** Parcelas criadas parcialmente. Registros financeiros corrompidos.

**🔧 SOLUÇÃO:**
```javascript
try {
  const batch = writeBatch(db);
  for (let p = 0; p < parcelas; p++) {
    const ref = doc(collection(db, 'usuarios', currentUser.uid, 'transacoes'));
    batch.set(ref, { tipo:'despesa', descricao:`${desc} (${p+1}/${parcelas})`, valor: valorParcela, ... });
  }
  await batch.commit();
  await updateDoc(..., { 'evento.compraRegistrada': true });
  window.budShowToast?.('Compra registrada!', 'success');
} catch (err) {
  console.error('Falha ao registrar compra:', err);
  window.budShowToast?.('Erro ao registrar compra. Tente novamente.', 'error');
}
```

---

### 🟡 Problema #4 — MÉDIO: Regex PIX Não Detecta Variações de Bancos

**Onde:** `js/importar.js` — linhas 350–355  
**O quê:**
```javascript
const isPix = !isCreditCard && /^pix (?:enviado|recebido)/i.test(memo);
// Caixa: "pix ENVIADO" (uppercase)
// Inter: "Pix enviado: Cp :12345-Nome" (com colon + espaços)
```

**Impacto:** Alguns PIX de bancos específicos (Caixa, Inter) são mal categorizados.

**🔧 SOLUÇÃO:**
```javascript
const isPix = !isCreditCard && /pix\s+(?:enviado|recebida?)/i.test(memo);
// Extrair nome para categorização:
if (/^pix\s+(?:enviado|recebida?)/i.test(memo) && name) {
  desc = name;
} else if (/pix\s+(?:enviado|recebida?):\s*"?cp\s*:\d+[–-]/i.test(memo)) {
  desc = memo.replace(/^pix\s+(?:enviado|recebida?):\s*"?cp\s*:\d+[–-]/, '').replace(/"?\s*$/, '').trim() || memo;
}
```

---

### 🟡 Problema #5 — MÉDIO: Detecção de Duplicata Fraca

**Onde:** `js/importar.js` — linha 871  
**O quê:**
```javascript
const isDup = existentes.some(ex =>
    ex.dataReferencia === r.data &&
    Math.abs(ex.valor - r.valor) < 0.02 // Só checa valor!
);
```
Dois cafés no mesmo dia (R$11,50 cada) são marcados como duplicata. Mas valores com arredondamento de OCR (R$100,00 vs R$100,03) não são detectados.

**Impacto:** Transações legítimas puladas; duplicatas reais não detectadas.

**🔧 SOLUÇÃO:**
```javascript
const isDup = existentes.some(ex =>
    ex.dataReferencia === r.data &&
    Math.abs(ex.valor - r.valor) < 0.05 && // Tolerância maior para OCR
    ex.descricao && r.descricao &&
    ex.descricao.toLowerCase().slice(0,20) === r.descricao.toLowerCase().slice(0,20) // Match na descrição 
);
```

---

### 🟡 Problema #6 — MÉDIO: Correção de Datas Silenciosa Corrompe Dados Antigos

**Onde:** `js/importar.js` — linhas 218–230  
**O quê:**
```javascript
const anoData = parseInt(partes[0]);
if (anoData < 2020 || anoData > anoAtual + 2) {
    r.data = anoAtual + '-' + partes[1] + '-' + partes[2]; // Sobrescreve silenciosamente!
    datasCorrigidas++;
}
```
Transações antes de 2020 (extratos antigos) têm ano substituído para o atual.

**Impacto:** Corrupção de dados históricos. Reconciliação impossível.

**🔧 SOLUÇÃO:**
```javascript
if (datasCorrigidas > 0) {
  window.budShowToast(`⚠️ ${datasCorrigidas} datas foram corrigidas (ano < 2020 ou > ${anoAtual+2}). Revise a preview.`, 'warning');
}
```

---

### 🟡 Problema #7 — MÉDIO: Preview Mostra Apenas 50 Transações

**Onde:** `js/importar.js` — linhas 755–775  
**O quê:**
```javascript
body.innerHTML = parsedRows.slice(0, 50).map((r, i) => { ... }).join('');
if(parsedRows.length > 50) body.innerHTML += `<tr>... e mais ${parsedRows.length - 50}</tr>`;
```

**Impacto:** Usuário não pode revisar/editar transações #51+. Importação "cega" de dados não revisados.

**🔧 SOLUÇÃO:**
Adicionar paginação:
```javascript
const pageSize = 50;
let currentPage = 1;
function renderPreviewPage(page) {
  const start = (page - 1) * pageSize;
  body.innerHTML = parsedRows.slice(start, start + pageSize).map((r, i) => { ... }).join('');
  body.innerHTML += `<tr><td colspan="5" class="py-2 text-center text-xs">
    ${page > 1 ? '<button onclick="renderPreviewPage('+(page-1)+')">← Anterior</button>' : ''}
    Página ${page}/${Math.ceil(parsedRows.length/pageSize)}
    ${start + pageSize < parsedRows.length ? '<button onclick="renderPreviewPage('+(page+1)+')">Próxima →</button>' : ''}
  </td></tr>`;
}
```

---

### 🟡 Problema #8 — MÉDIO: Parcelas de Evento Sem Limite Máximo

**Onde:** `carteira.html` — linhas 162–174; `js/carteira.js`  
**O quê:** HTML oferece 1-12, mas DevTools permite alterar para qualquer valor. Sem validação no submit.

**Impacto:** DevTools permite criar 100+ parcelas. Registros financeiros com parcelas absurdas.

**🔧 SOLUÇÃO:**
```javascript
const parcelas = Math.min(12, Math.max(1, parseInt(evParcelas) || 1));
if (isNaN(parcelas) || parcelas < 1 || parcelas > 12) {
  window.budShowToast('Parcelas entre 1 e 12.', 'warning'); return;
}
```

---

### 🟡 Problema #9 — MÉDIO: carteiraVinculadaId Vira Referência Órfã

**Onde:** `js/importar.js` — linhas 887–920  
**O quê:**
```javascript
batch.set(ref, {
    carteiraId: carteiraVinculadaId, // Se carteira for deletada, ID órfão
    carteiraNome: itemCarteira?.nome || '',
});
```

**Impacto:** Excluir carteira após importar deixa transações com IDs mortos. Filtros por carteira falham.

**🔧 SOLUÇÃO:**
Validar carteira existe antes de importar:
```javascript
const carteiraAtiva = carteiraGlobal.find(i => i.id === carteiraVinculadaId && i.ativo !== false);
if (!carteiraAtiva) {
  window.budShowToast('Carteira selecionada foi deletada. Selecione outra.', 'warning'); return;
}
```

---

### 🟡 Problema #10 — MÉDIO: Race Condition entre Carteira e Cartões (Dual onSnapshot)

**Onde:** `js/carteira.js` — linhas 563–610  
**O quê:** Dois onSnapshot independentes (carteira + cartões) limpam e reconstroem `itemsMap`:
```javascript
// Snapshot 1: carteira
itemsMap.clear();
itensCarteira.forEach(i => itemsMap.set(i.id, ...));
cartoesExternos.forEach(c => itemsMap.set(...)); // Pode estar vazio!
renderizar();

// Snapshot 2: cartões  
// Mesmo padrão — pode disparar ANTES de carteira terminar
```

**Impacto:** Cartões de crédito podem sumir/piscar momentaneamente durante render.

**🔧 SOLUÇÃO:**
```javascript
let carteiraLoaded = false, cartoesLoaded = false;
const checkBothLoaded = () => {
  if (carteiraLoaded && cartoesLoaded) {
    itemsMap.clear();
    itensCarteira.forEach(i => itemsMap.set(i.id, { ...i }));
    cartoesExternos.forEach(c => itemsMap.set(`cartoes:${c.id}`, { ... }));
    renderizar();
  }
};
// Cada snapshot atualiza seu flag e chama checkBothLoaded()
```

---

### 🟡 Problema #11 — MÉDIO: Sem Timestamp `confirmadoEm` em Eventos

**Onde:** `js/carteira.js` — linhas 640–695  
**O quê:**
```javascript
dados.evento = {
    tipoEvento, dataEvento, horaEvento,
    compraRegistrada: ...,
    compraRegistradaEm: ...,
    // Sem confirmadoEm!
};
```

**Impacto:** Sem registro de quando o evento foi confirmado. Impossível diferenciar compras recentes vs antigas. Lembretes não sabem se evento já passou.

**🔧 SOLUÇÃO:**
```javascript
dados.evento = {
  ...dados.evento,
  confirmadoEm: serverTimestamp(),
};
```

---

### 🟡 Problema #12 — MÉDIO: Dropdown de Carteira Vazio para Novos Usuários (Importar)

**Onde:** `js/importar.js` — linhas 420–440  
**O quê:**
```javascript
function popularSelectCarteira() {
    const sel = document.getElementById('selecionarCarteira');
    const contas = carteiraGlobal.filter(i => i.tipo !== 'credito');
    // Se carteiraGlobal vazio → dropdown com apenas placeholder
}
```

**Impacto:** Novo usuário tenta importar, vê dropdown vazio, não sabe o que fazer.

**🔧 SOLUÇÃO:**
```javascript
if (carteiraGlobal.length === 0) {
  sel.innerHTML = '<option value="" disabled>Crie uma carteira em "Minha Carteira" primeiro</option>';
  return;
}
```

---

### 🟢 Problema #13 — LEVE: Parsing OFX com Formato de Data Frágil

**Onde:** `js/importar.js` — linhas 315–325  
**O quê:**
```javascript
const dt = get('DTPOSTED');
const dataFmt = dt.length >= 8 ? dt.slice(0,4)+'-'+dt.slice(4,6)+'-'+dt.slice(6,8) : '';
```
Se dt já vier formatado (`2026-04-08`), o slice produz resultado errado.

**Impacto:** Datas de OFX com formato não-padrão ficam vazias.

**🔧 SOLUÇÃO:**
```javascript
let dataFmt = '';
if (dt) {
  if (/^\d{8}/.test(dt)) dataFmt = dt.slice(0,4)+'-'+dt.slice(4,6)+'-'+dt.slice(6,8);
  else if (/^\d{4}-\d{2}-\d{2}/.test(dt)) dataFmt = dt.slice(0,10);
}
if (!dataFmt) dataFmt = new Date().toISOString().slice(0,10);
```

---

### 🟢 Problema #14 — LEVE: BOM UTF-16 Não Removida no CSV

**Onde:** `js/importar.js` — linha 185  
**O quê:**
```javascript
text = text.replace(/^\uFEFF/, ''); // Só remove UTF-8 BOM
```

**Impacto:** CSVs de Excel salvos em UTF-16 podem ter BOM não-removida → primeira coluna lixo.

**🔧 SOLUÇÃO:**
```javascript
text = text.replace(/^[\uFEFF\uFFFE]/g, '');
```

---

### 🟢 Problema #15 — LEVE: Sem Sanitização nos Nomes de Carteira

**Onde:** `js/carteira.js` — linhas 600–625  
**O quê:**
```javascript
const dados = { nome: document.getElementById('itemNome').value.trim() };
```
Se nome contém `<script>`, e algum render usar innerHTML, XSS.

**Impacto:** Baixo — a maioria dos renders usa `escapeHTML()`, mas risco existe.

**🔧 SOLUÇÃO:**
```javascript
const nome = document.getElementById('itemNome').value.trim().replace(/[<>]/g, '');
```

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA
- [ ] Problema #1 — Trocar className por style.cssText no modal de exclusão
- [ ] Problema #2 — Corrigir detectarTipo() para retornar receita/despesa
- [ ] Problema #3 — Usar batch write para parcelas de evento

### 🟡 PRIORIDADE ALTA
- [ ] Problema #4 — Regex PIX compatível com múltiplos bancos
- [ ] Problema #5 — Melhorar detecção de duplicatas (valor + descrição)
- [ ] Problema #6 — Aviso visual quando datas são corrigidas
- [ ] Problema #7 — Paginação na preview de importação
- [ ] Problema #8 — Validar limite de parcelas no submit
- [ ] Problema #9 — Verificar carteira existe antes de importar
- [ ] Problema #10 — Sincronizar dual onSnapshot com flag
- [ ] Problema #11 — Adicionar timestamp confirmadoEm
- [ ] Problema #12 — Mensagem explicativa quando carteira vazia

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #13 — Fallback para formato de data OFX
- [ ] Problema #14 — Remover BOM UTF-16
- [ ] Problema #15 — Sanitizar nome de carteira

---

## 📊 RESUMO DE MÉTRICAS

| Severidade | Quantidade |
|---|---|
| 🔴 GRAVE | 3 |
| 🟡 MÉDIO | 9 |
| 🟢 LEVE | 3 |
| **TOTAL** | **15** |

| Categoria | Bugs |
|---|---|
| Tailwind Dinâmico | #1 |
| Parser (Tipo/PIX) | #2, #4 |
| Firebase (Batch/Error) | #3, #10 |
| Detecção Duplicata | #5 |
| Data/Encoding | #6, #13, #14 |
| UX (Preview/Dropdown) | #7, #12 |
| Validação | #8, #9 |
| Data Integrity | #11 |
| Segurança | #15 |
