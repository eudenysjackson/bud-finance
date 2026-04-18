# 💸 Tela de Dívidas — Documentação Técnica Completa

> Auditoria e documentação realizadas em 08–09/04/2026  
> Arquivos analisados: `dividas.html` (467 linhas) + `js/dividas.js` (1255 linhas)

---

## 1. Visão Geral da Tela

A tela **Dívidas** é um **sistema completo de gerenciamento de débitos e empréstimos**, permitindo ao usuário:

- ✅ Cadastrar dívidas (empréstimos, financiamentos, cartões, consórcios, etc.)
- ✅ Importar dados de contratos via IA (PDF, imagem, texto → OCR + regex)
- ✅ Calcular parcelas com **Tabela Price** (juros compostos mensais)
- ✅ Marcar/desmarcar parcelas como pagas (atualiza Firestore em tempo real)
- ✅ Visualizar detalhes com resumo financeiro e lista de parcelas
- ✅ Simular quitação antecipada e pagamento extra
- ✅ Rastrear juros pagos, saldo devedor e progresso de quitação

**Acesso:** Via Sidebar → "Dívidas" ou diretamente em `dividas.html`  
**Dados Firestore:** `usuarios/{uid}/dividas/{dividaId}`  
**Libs externas:** PDF.js 3.11.174 (CDN), Tesseract.js 5 (CDN)

---

## 2. Estrutura de Dados (Firestore)

Cada dívida é armazenada em `usuarios/{uid}/dividas/{dividaId}`:

```javascript
{
  // Identificação
  nome: "Empréstimo Pessoal - Nubank",
  tipoIcone: "💰",
  tipo: "Empréstimo Pessoal",    // 6 tipos possíveis
  instituicao: "Nubank",
  formato: "fixas",              // "fixas" | "juros" | "ia"

  // Valores
  valorTotal: 5000.00,           // Principal (valor original do empréstimo)
  valorPago: 1350.00,            // Soma dos PMTs já pagos (inclui juros!)
  jurosPagos: 175.00,            // Total de juros pagos até agora

  // Parcelas
  parcelas: 12,                  // Total de parcelas
  parcelasPagas: 3,              // Quantas foram marcadas pagas
  valorParcela: 450.00,          // PMT mensal (valor fixo com juros embutidos)

  // Taxas (opcionais)
  juros: 3.5,                    // Taxa mensal em % (ex: 3.5 = 3.5% a.m.)
  cet: 4.2,                      // Custo Efetivo Total anual (% a.a.)
  iof: 50.00,                    // IOF (R$)
  seguro: 0,                     // Seguro (R$)

  // Datas
  vencimento: "2025-04-15",      // Data da PRIMEIRA parcela (ISO 8601)
  criadoEm: Timestamp,
  atualizadoEm: Timestamp,

  // Flag de importação
  importadoPorIA: true           // Se foi importado pelo leitor de contratos
}
```

### 2.1 Tipos de Dívida (Wizard Passo 1)

| Tipo | Ícone | Classificado pela IA quando encontra... |
|---|---|---|
| Empréstimo Pessoal | 💰 | empréstimo, crédito pessoal, consignado, CDC |
| Financiamento | 🏠 | financiamento, imobiliário, veículo, SFH, SFI |
| Cartão Parcelado | 💳 | fatura, cartão, parcelamento, anuidade, rotativo |
| Consórcio | 🤝 | consórcio, contemplação, lance, cota |
| Dívida Informal | 🤙 | emprestei, devo, favor, amigo, familiar |
| Outro | 📄 | (fallback quando nada é detectado) |

---

## 3. Estrutura de Arquivos

### `dividas.html` — Layout e Modais

```
<head>
  ├── PWA: manifest, theme-color, apple-touch-icon
  ├── tailwind.css (build estático)
  ├── Inter font (Google Fonts)
  ├── pdf.js 3.11.174 (CDN — extração de texto de PDFs)
  ├── tesseract.js 5 (CDN — OCR de imagens)
  ├── firebase-config.js
  ├── bud-loader.js (splash screen)
  └── bud-utils.js (escapeHTML, budShowToast, etc.)
<body>
  ├── sidebar-container (injetado por sidebar.js)
  ├── <main>
  │    ├── Header (título + botão "Nova Dívida")
  │    ├── KPIs (4 cards: Ativas, Saldo Devedor, Total Pago, Juros Pagos)
  │    ├── Barra de progresso geral + previsão de quitação
  │    ├── Alertas (parcelas atrasadas, próximas de vencer)
  │    ├── Dicas colapsáveis
  │    └── Lista de dívidas (#listaDividas)
  ├── modalTipo (Wizard: 6 tipos de dívida)
  ├── modalFormato (Wizard: IA / Fixas / Com Juros)
  ├── modalImportIA (Leitor de Contratos: 3 abas)
  ├── modalDivida (Formulário manual)
  ├── modalDetalhes (Resumo + Parcelas)
  └── modalSimulador (Quitar Tudo / Pagamento Extra)
<footer scripts>
  ├── plano-config.js
  ├── sidebar.js
  ├── js/dividas.js (type="module")
  ├── dark-mode.js
  ├── tutorial.js / tutorial-steps.js / tutorial-init.js
```

### `js/dividas.js` — Funções Principais

| Função | Linhas | Propósito |
|---|---|---|
| `formatMoeda / parseMoeda` | 13–20 | Formatação monetária BR |
| `aplicarMascaraMoeda` | 22–28 | Máscara em inputs de dinheiro |
| `abrirModalGenerico / fecharModalGenerico` | 53–55 | Controle de modais |
| `fecharTodosModais` | 56 | Fecha todos os 6 modais de uma vez |
| `iniciarNovaDivida` | 86–90 | Abre wizard limpando estado anterior |
| `selecionarTipo` | 92–96 | Wizard Passo 1 — escolher tipo |
| `selecionarFormato` | 110–115 | Wizard Passo 2 — escolher formato |
| `abrirFormManual` | 125–165 | Abre form (novo ou edição) |
| `formDivida.submit` | 168–215 | Salvar dívida no Firestore |
| `trocarTabIA` | 216–223 | Alternar entre abas do modal IA |
| `classificarContrato` | 322–350 | IA: detectar tipo de contrato |
| `extrairDadosDoTexto` | 352–480 | IA: extrair dados via ~15 regexes |
| `processarArquivoIA` | 495–570 | Processar PDF, imagem ou TXT |
| `processarTextoExtraido` | 576–630 | Pipeline: classificar + extrair + preview |
| `mostrarPreviewIA` | 660–710 | Renderizar preview editável dos dados |
| `salvarDividaIA` | 730–755 | Salvar dívida importada no Firestore |
| `excluirDividaAtual` | 790–815 | Excluir com dialog de confirmação |
| `abrirDetalhes` | 820–838 | Modal com resumo da dívida |
| `renderizarParcelas` | 840–895 | Lista de parcelas com status |
| `marcarParcelaPaga` | 898–930 | Pagar próxima parcela (Firestore) |
| `desmarcarParcela` | 932–975 | Desfazer pagamento (com confirmação) |
| `abrirSimulador` | 978–990 | Abrir simulador de quitação |
| `simularExtra` | 1005–1050 | Calcular economia de pagamento extra |
| `verEconomia` | 1052–1085 | Calcular economia de quitar tudo |
| `calcularPMTForm` | 1088–1100 | Helper — cálculo de PMT no formulário |
| `registrarPagamento` | 1107–1130 | ⚠️ CÓDIGO MORTO — nunca chamado |
| `renderizar` | 1108–1250 | Renderizar KPIs + lista principal |
| `onAuthStateChanged` | 1240–1258 | Setup do listener Firestore |

---

## 4. Fluxo de Cadastro Manual — Wizard 3 Passos

```
[Botão "+ Nova Dívida"]
         │
         ▼
┌──────────────────────┐
│  PASSO 1 – modalTipo │
│  Selecionar tipo:    │
│  💰 Empréstimo       │
│  💳 Cartão           │
│  🏠 Financiamento    │
│  🤝 Consórcio        │
│  🤙 Dívida Informal  │
│  📄 Outro            │
└──────────┬───────────┘
           │ btnProximoTipo.click() → avancarParaFormato()
           ▼
┌────────────────────────────┐
│  PASSO 2 – modalFormato    │
│  Como você tem os dados?   │
│  🤖 Leitor IA (PDF/foto)   │ → abrirImportIA() → fluxo IA
│  📊 Parcelas Fixas         │
│  📈 Com Taxa de Juros      │
└──────────┬─────────────────┘
           │ btnProximoFormato.click() → avancarParaForm()
           ▼
┌──────────────────────────────────┐
│  PASSO 3 – modalDivida (form)    │
│  • Nome / Credor (required)      │
│  • Instituição                   │
│  • Valor Original (required)     │
│  • Valor Pago                    │
│  • Parcelas total                │
│  • Parcelas Pagas                │
│  • Valor da parcela + btn Calc   │
│  • Taxa de juros (% a.m.)        │
│  • Data da 1ª parcela            │
└──────────┬───────────────────────┘
           │ submit → addDoc / updateDoc
           ▼
     Firestore salvo
     onSnapshot dispara → renderizar()
```

### Cálculo automático ao salvar

No submit, a Tabela Price é calculada para encontrar `jurosPagosCalc`:

```javascript
// Calcular juros acumulados das parcelas já pagas
const taxaMensal = juros / 100;
const pmt = valorParcela > 0 ? valorParcela
    : (taxaMensal > 0
        ? (valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -parcelas))
        : valorTotal / parcelas);

let saldo = valorTotal;
let jurosPagosCalc = 0;
for (let i = 0; i < parcelasPagas; i++) {
    const jParcela = saldo * taxaMensal;
    jurosPagosCalc += jParcela;
    saldo = Math.max(0, saldo - (pmt - jParcela));
}
```

---

## 5. Fluxo de Importação via IA (Leitor de Contratos)

### 5.1 3 Modos de Input

| Aba | Input | Processamento |
|---|---|---|
| 📎 Arquivo | Upload de arquivo | TXT → `file.text()` / PDF → `pdfjsLib` / Imagem → `Tesseract.js` |
| 📝 Colar Texto | Textarea | Direto na `processarTextoExtraido()` |
| 📷 Câmera | Captura camera | `<input capture="environment">` → Tesseract.js |

### 5.2 Pipeline de Processamento

```
arquivo/texto
     │
     ▼
processarArquivoIA() ou processarTextoIA()
     │
     ├─ TXT → file.text()
     ├─ PDF → pdfjsLib.getDocument() → getTextContent()
     └─ Imagem → Tesseract.recognize('por')
     │
     ▼
processarTextoExtraido(texto)
     │
     ├─ animarStepsIA(1) → Step "Lendo documento" ✓
     ├─ classificarContrato(texto) → {tipo, icone, confianca, detalhes}
     ├─ animarStepsIA(2) → Step "Identificando tipo" ✓
     ├─ extrairDadosDoTexto(texto) → {valorTotal, parcelas, juros, ...}
     ├─ animarStepsIA(3) → Step "Extraindo dados" ✓
     └─ mostrarPreviewIA(dados, classif, extras)
              │
              ▼
        Preview editável com todos os campos
              │
              ▼ [salvarDividaIA()]
        addDoc → Firestore → renderizar()
```

### 5.3 Classificação de Contratos

```javascript
const TIPOS_CONTRATO = {
    'Empréstimo Pessoal': {
        icone: '💰',
        palavras: ['empréstimo', 'emprestimo', 'crédito pessoal', 'consignado', 
                   'crédito direto', 'cdc']
    },
    'Financiamento': {
        icone: '🏠',
        palavras: ['financiamento', 'imobiliário', 'veículo', 'automóvel', 
                   'casa própria', 'sfi', 'sfh', 'alienação fiduciária']
    },
    'Cartão Parcelado': {
        icone: '💳',
        palavras: ['fatura', 'cartão', 'parcelamento de fatura', 
                   'crédito rotativo', 'anuidade']
    },
    'Consórcio':     { icone: '🤝', palavras: ['consórcio', 'contemplação', 'lance'] },
    'Aluguel':       { icone: '🏘️', palavras: ['aluguel', 'locação', 'inquilino'] },
    'Dívida Informal': { icone: '🤙', palavras: ['emprestei', 'devo', 'amigo'] }
};

// Score = quantas palavras-chave do tipo encontrou no texto
// Confiança = min(100, score * 25 + 25)
// Ex: 3 palavras encontradas → confiança 100%
```

### 5.4 Extração de Dados — 15 Regexes

| Campo | Regex | Trata OCR? |
|---|---|---|
| Valor Total | `valor total/original/financiado.*?R\$?([\d.,]+)` | Pega maior valor como fallback |
| Valor Parcela | `parcela/prestação.*?R\$?([\d.,]+)` | — |
| Padrão NxR$ | `(\d+)\s*x\s*(?:de\s*)?R?\$?([\d.,]+)` | — |
| Parcelas | `(\d+)\s*(parcelas/meses/x)` | — |
| Parcelas Pagas | `parcelas pagas.*?(\d+\|[oO])` | Sim: 'o' → 0 |
| Juros Mensal | `taxa.*?juros.*?([\d.,]+)%.*?a\.?m\.?` | Gap de até 40 chars |
| Juros Anual | `juros.*?([\d.,]+)%.*?ao\s*ano` | — |
| CET | `CET.*?[\d.,]+%.*?([\d.,]+)%` | Sim: pula 1º % (OCR 2 colunas) |
| IOF | `IOF[:\s]*R?\$?([\d.,]+)` | — |
| Seguro | `seguro[:\s]*R?\$?([\d.,]+)` | — |
| Vencimento | `vencimento.*?(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})` | — |
| Banco (label) | `banco/instituição/credor.*?([A-Za-z0-9]{2,40})` | — |
| Banco (lista) | Verifica 26 bancos conhecidos no texto | Nubank, Itaú, BB... |
| Nome | `objeto do contrato/produto.*?([^\n.,:]{3,50})` | — |
| Valor Pago | `valor pago/amortizado.*?R?\$?([\d.,]+)` | — |

---

## 6. Tabela Price — Matemática Financeira

O sistema usa o **sistema francês de amortização** (parcela fixa com redução de juros ao longo das parcelas).

### 6.1 Fórmula do PMT

$$\text{PMT} = \frac{V \times i}{1 - (1+i)^{-n}}$$

Onde:
- $V$ = valor financiado (principal)
- $i$ = taxa mensal em decimal (ex: 3.5% → 0.035)
- $n$ = número total de parcelas

**Implementação:**
```javascript
const pmt = taxaMensal > 0
    ? (valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -parcelas))
    : valorTotal / parcelas; // Sem juros = divisão simples
```

### 6.2 Amortização Parcela a Parcela

A cada mês $k$ (0-indexed):

$$J_k = S_k \times i \quad\text{(juros)}$$
$$A_k = \text{PMT} - J_k \quad\text{(amortização)}$$
$$S_{k+1} = S_k - A_k \quad\text{(novo saldo)}$$

**Exemplo:** V=R$10.000, i=1% a.m., n=12 parcelas → PMT=R$888,49

| Parcela | Saldo Anterior | Juros | Amortização | Saldo Final |
|---|---|---|---|---|
| 1 | R$ 10.000,00 | R$ 100,00 | R$ 788,49 | R$ 9.211,51 |
| 2 | R$ 9.211,51 | R$ 92,12 | R$ 796,37 | R$ 8.415,14 |
| 3 | R$ 8.415,14 | R$ 84,15 | R$ 804,34 | R$ 7.610,80 |
| ... | ... | ... | ... | ... |
| 12 | R$ 879,70 | R$ 8,80 | R$ 879,70 | R$ 0,00 |

### 6.3 Implementação do Calcular PMT no Form

```javascript
window.calcularPMTForm = function() {
    const valorTotal = parseMoeda(document.getElementById('dividaValorTotal').value);
    const parcelas   = parseInt(document.getElementById('dividaParcelas').value) || 0;
    const juros      = parseFloat(document.getElementById('dividaJuros').value) || 0;
    if(!valorTotal || !parcelas) {
        window.budShowToast('Preencha "Valor Original" e "Parcelas" primeiro.', 'warning');
        return;
    }
    const taxaMensal = juros / 100;
    const pmt = taxaMensal > 0
        ? (valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -parcelas))
        : valorTotal / parcelas;
    document.getElementById('dividaValorParcela').value = formatMoeda(pmt);
};
```

---

## 7. Modais — Detalhamento

### 7.1 modalDetalhes (Resumo + Parcelas)

**Aba Resumo** mostra:
- Barra de progresso percentual
- Grid 2×2: Valor Original / Saldo Devedor / Total Pago / Juros Pagos
- Informações (parcelas pagas/total, tipo)
- Botão "Simular Quitação"
- Botões Editar e Excluir

**Aba Parcelas** renderiza cada parcela:

```
┌─────────────────────────────────────────────────────┐
│ [✓] #1  15/04/2025  ✅ Paga                         │
│         Total: R$ 888,49 · Juros: R$ 100,00 · Amort: R$ 788,49  │
├─────────────────────────────────────────────────────┤
│ [□] #2  15/05/2025  ⏳ Pendente                     │
│         Total: R$ 888,49 · Juros: R$ 92,12 · Amort: R$ 796,37   │
├─────────────────────────────────────────────────────┤
│ [□] #3  15/06/2025  ⚠ Atrasada                     │
│         Total: R$ 888,49 · ...                       │
└─────────────────────────────────────────────────────┘
```

### 7.2 modalSimulador

**Aba "Pagamento Extra"** — Quanto economizaria abatendo X agora?

```javascript
window.simularExtra = function() {
    const falta = d.valorTotal - (d.valorPago||0);         // ⚠️ Ver bug #15
    const parcelasRestantes = d.parcelas - d.parcelasPagas;
    const valorExtra = parseMoeda(document.getElementById('simValorExtra').value);

    // Simula SEM pagamento extra (Tabela Price sobre saldo restante)
    let jurosSemExtra = 0;
    let saldoAtual = falta;
    for(let i = 0; i < parcelasRestantes && saldoAtual > 0; i++) {
        const jParcela = saldoAtual * taxaMensal;
        jurosSemExtra += jParcela;
        saldoAtual = Math.max(0, saldoAtual - (pmtAtual - jParcela));
    }

    // Simula COM pagamento extra (abate no saldo)
    const novoSaldo = Math.max(0, falta - valorExtra);
    let jurosComExtra = 0, novasParcelas = 0;
    let saldoExtra = novoSaldo;
    for(let i = 0; saldoExtra > 0.01 && i < 600; i++) {
        const jParcela = saldoExtra * taxaMensal;
        jurosComExtra += jParcela;
        saldoExtra = Math.max(0, saldoExtra - (pmtAtual - jParcela));
        novasParcelas++;
    }

    const economia = Math.max(0, (falta + jurosSemExtra) - (novoSaldo + jurosComExtra + valorExtra));
    const parcelasEconomizadas = parcelasRestantes - novasParcelas;
    // Exibir: economia em juros, parcelas eliminadas, novo saldo
};
```

**Aba "Quitar Tudo"** — Mostra saldo atual e juros que seriam economizados.

---

## 8. Gerenciamento de Estado

```javascript
// Variáveis globais do módulo
let currentUser = null;          // Usuário Firebase autenticado
let dividas = [];                // Array sincronizado com Firestore (onSnapshot)
let dividaAtual = null;          // Dívida selecionada nos modais de detalhes/simulador
let wizardTipo = '';             // Tipo selecionado no passo 1
let wizardTipoIcone = '';        // Ícone do tipo selecionado
let wizardFormato = '';          // Formato selecionado no passo 2
let dadosIA = null;              // Dados extraídos pelo leitor de contratos
let valoresOcultos = false;      // Toggle "ocultar valores" (botão olhinho)
let _unsubs = [];                // Array de funções de unsubscribe dos listeners
```

---

## 9. Listener Firestore e Renderização

```javascript
onAuthStateChanged(auth, user => {
    _unsubs.forEach(fn => fn()); _unsubs = [];  // Limpa listeners anteriores
    if (user) {
        currentUser = user;
        _unsubs.push(onSnapshot(
            query(collection(db, "usuarios", user.uid, "dividas"), limit(500)),
            snap => {
                if (window.hideSplash) window.hideSplash(); // Remove splash
                dividas = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                renderizar();
            }
            // ⚠️ Sem error callback — ver Bug #2
        ));
    } else {
        // ⚠️ _unsubs NÃO limpos antes do redirect — ver Bug #7
        window.location.href = "index.html";
    }
});
```

`renderizar()` executa a cada mudança no Firestore:
1. Recalcula totais (ativas, saldo devedor, total pago, juros pagos)
2. Atualiza 4 KPIs no topo
3. Calcula progresso geral + previsão de quitação
4. Gera alertas de parcelas atrasadas/próximas
5. Renderiza cards ordenados por saldo devedor (maior primeiro)
6. Configura event delegation nos cards (click → abrirDetalhes)

---

## 10. Validações e Regras de Negócio

| Regra | Implementação |
|---|---|
| Parcelas em **ordem sequencial** | `marcarParcelaPaga`: bloqueia se índice ≠ parcelasPagas |
| Desmarcar apenas a **última paga** | `desmarcarParcela`: bloqueia se índice ≠ parcelasPagas - 1 |
| Valor pago nunca > valor total | `Math.min(d.valorTotal, valorPago + valorParcela)` |
| Juros pagos nunca negativos | `Math.max(0, jurosPagos - jurosDesmarcados)` |
| Cards ordenados por saldo devedor | `.sort((a,b) => salDoB - saldoA)` (maior devedor primeiro) |

---

## 11. Atalhos de Teclado

| Tecla | Ação |
|---|---|
| `ESC` | Fecha o modal aberto (prioridade: Simulador > ImportIA > Detalhes > outros) |
| `ENTER` | Confirma ação no wizard (Próximo passo 1 ou 2 se não-disabled) |

Backdrop click (fora do modal) também fecha qualquer modal aberto.

---

## 12. Performance e Limites

| Limite | Valor | Impacto |
|---|---|---|
| Máx. Dívidas carregadas | `limit(500)` no onSnapshot | Dívidas mais antigas podem não aparecer se >500 |
| Máx. Parcelas por Dívida | 360 (30 anos) recomendado | Cálculo Tabela Price em <5ms |
| Tamanho documento Firestore | ~1MB max | Dívida típica ~2KB, sem problemas |
| Latência onSnapshot | <100ms em boa conexão | Sincronização praticamente em tempo real |

---

## 13. Fluxo Completo — Do Cadastro à Quitação

```
1️⃣ [CADASTRO]
   Usuário → "+ Nova Dívida"
   Tipo: "Empréstimo" → Formato: "Com Juros" → Form:
     Nome=Nubank, Valor=R$5000, Parcelas=12, Juros=3.5%, Venc=15/04/2025
   Submit → calcula PMT=R$450 → addDoc → Firestore

2️⃣ [EXIBIÇÃO INICIAL]
   onSnapshot → renderizar()
   KPI "Saldo Devedor": R$ 5.000 | "Dívidas Ativas": 1
   Card: "💰 Nubank · 0/12 parcelas · R$ 5.000"

3️⃣ [PAGAMENTO MÊS 1]
   Click no card → abrirDetalhes() → Aba "Parcelas"
   Click checkbox #1 → marcarParcelaPaga('id', 0)
     - Calcula: saldo=5000, juros=175, PMT=450
     - updateDoc: valorPago=450, parcelasPagas=1, jurosPagos=175
   onSnapshot → renderizar() → KPIs atualizados

4️⃣ [SIMULAÇÃO NO MÊS 6]
   6 parcelas pagas → parcelasPagas=6, valorPago=2700
   Simular Quitação: "Quitar Tudo"
     - falta = 5000 - 2700 = 2300 (⚠️ ERRADO — ver Bug #15)
     - saldo real Tabela Price = ~2650
     - Mostra "você paga R$2300 em vez de R$2700"

5️⃣ [QUITAÇÃO FINAL]
   Parcela #12 marcada → parcelasPagas=12, valorPago=5400
   falta = 5000 - 5400 = -400 → Math.max(0, -400) = 0
   Card aparece com ✅ | progress 100% | "Quitada"
   KPI "Dívidas Ativas" -= 1
```

---

## 14. Integrações

| Sistema | Como | Dados |
|---|---|---|
| **Firebase Auth** | `onAuthStateChanged` | UID para isolar dados por usuário |
| **Firestore** | `onSnapshot` real-time + CRUD | Dívidas na subcollection |
| **PDF.js** | CDN, `pdfjsLib.getDocument()` | Extração de texto de PDFs |
| **Tesseract.js** | CDN, `Tesseract.recognize()` | OCR de imagens (idioma 'por') |
| **Dashboard** | Mesma subcollection Firestore | Dashboard lê e exibe resumos |

---

## 15. Segurança (Firestore Rules)

```javascript
match /usuarios/{uid}/dividas/{dividaId} {
  allow read, write: if request.auth.uid == uid;
}
```
- ✅ Usuário só acessa suas próprias dívidas
- ✅ Todas as operações requerem autenticação
- ✅ `escapeHTML` usado em todos os dados do usuário exibidos no DOM

---

# 🐛 AUDITORIA DE ERROS — Varredura Completa Linha-a-Linha

> Auditoria realizada em 08–09/04/2026  
> Leitura integral: 1255 linhas de `js/dividas.js` + 467 linhas de `dividas.html`  
> Bugs da Fase 1 (14) foram encontrados em revisão inicial; Fase 2 (11) após leitura integral do código

---

## FASE 1 — 14 Problemas

### 🔴 Problema #1 — GRAVE: Classes Tailwind Dinâmicas em Diálogos de Confirmação

**Onde:** `js/dividas.js` — linhas ~770, ~790, ~932 (3 funções com diálogos)

**O quê:** Os diálogos de confirmação de exclusão e desmarcar parcela usam classes arbitrárias:
```javascript
const ov = document.createElement('div');
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```
`bg-black/40` e `z-[9999]` **não existem** no build estático do Tailwind. O overlay fica invisível.

**Impacto:** Usuário não consegue excluir dívidas nem desmarcar parcelas. Os diálogos de confirmação somem imediatamente.

**🔧 SOLUÇÃO:** Em todos os 3 locais substituir `.className` por `.style.cssText`:
```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 Problema #2 — GRAVE: onSnapshot Sem Error Callback

**Onde:** `js/dividas.js` — fim do arquivo (listener principal)

**O quê:**
```javascript
_unsubs.push(onSnapshot(
    query(collection(db,"usuarios",user.uid,"dividas"), limit(500)),
    snap => {
        dividas = snap.docs.map(d=>({...d.data(),id:d.id}));
        renderizar();
    }
    // ← Sem segundo callback de erro!
));
```

**Impacto:** Se a conexão cair ou a regra do Firestore recusar → tela travada em branco sem feedback.

**🔧 SOLUÇÃO:**
```javascript
_unsubs.push(onSnapshot(
    query(collection(db,"usuarios",user.uid,"dividas"), limit(500)),
    snap => {
        if (window.hideSplash) window.hideSplash();
        dividas = snap.docs.map(d=>({...d.data(),id:d.id}));
        renderizar();
    },
    err => {
        console.error('[Dividas] Firestore error:', err);
        window.budShowToast?.('Erro ao carregar dívidas. Tente novamente.', 'error');
    }
));
```

---

### 🔴 Problema #3 — GRAVE: Form Save Sem Error Handling

**Onde:** `js/dividas.js` — submit handler do `formDivida`

**O quê:**
```javascript
document.getElementById('formDivida').addEventListener('submit', async e => {
    e.preventDefault();
    // ... monta dados ...
    const id = document.getElementById('dividaId').value;
    if(id) await updateDoc(doc(db,...), dados);   // Sem try/catch!
    else   await addDoc(collection(db,...), dados); // Sem try/catch!
    fecharTodosModais(); // Fecha mesmo se falhou!
});
```

**Impacto:** Falha de rede fecha o modal silenciosamente. Dados perdidos. Usuário acha que salvou.

**🔧 SOLUÇÃO:**
```javascript
document.getElementById('formDivida').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerText;
    try {
        btn.disabled = true; btn.innerText = '💾 Salvando...';
        // ... monta dados ...
        const id = document.getElementById('dividaId').value;
        if(id) await updateDoc(doc(db,"usuarios",currentUser.uid,"dividas",id), dados);
        else   await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), {...dados, criadoEm: serverTimestamp()});
        window.budShowToast?.('Dívida salva!', 'success');
        fecharTodosModais();
    } catch(err) {
        console.error('Erro ao salvar:', err);
        window.budShowToast?.('Erro ao salvar. Tente novamente.', 'error');
    } finally {
        btn.disabled = false; btn.innerText = orig;
    }
});
```

---

### 🟡 Problema #4 — MÉDIO: Sem Validação de Valor Zero/Negativo

**Onde:** `js/dividas.js` — submit do `formDivida`

**O quê:** Campo `valorTotal` aceita 0 sem validação. Tabela Price com valor=0 retorna PMT=0, gerando divisões por zero e `NaN` nos cálculos de progresso.

**Impacto:** KPIs mostram `NaN`, barras de progresso quebram, simulador retorna valores absurdos.

**🔧 SOLUÇÃO:**
```javascript
const valorTotal = parseMoeda(document.getElementById('dividaValorTotal').value);
if (!valorTotal || valorTotal <= 0) {
    window.budShowToast?.('Valor deve ser maior que R$ 0,00', 'warning'); return;
}
const parcelas = parseInt(document.getElementById('dividaParcelas').value) || 0;
if (parcelas < 0) {
    window.budShowToast?.('Número de parcelas inválido', 'warning'); return;
}
```

---

### 🟡 Problema #5 — MÉDIO: Simulador Usa PMT Original em Vez do PMT do Saldo Restante

**Onde:** `js/dividas.js` — `verEconomia()` e `simularExtra()`

**O quê:**
```javascript
const pmt = (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -d.parcelas));
// ↑ PMT calculado sobre o valorTotal ORIGINAL
let saldo = falta; // ← Mas simulação começa do saldo restante
```

**Impacto:** Simulação de "Quitar Tudo" calcula juros futuros com PMT errado (levemente otimista).

**🔧 SOLUÇÃO:** Usar `d.valorParcela` diretamente (que já é o PMT correto) em vez de recalcular:
```javascript
const pmt = d.valorParcela || (taxaMensal > 0
    ? (falta * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -parcelasRestantes))
    : falta / parcelasRestantes);
```

---

### 🟡 Problema #6 — MÉDIO: PDF.js/Tesseract Não Verificados Antes de Usar

**Onde:** `js/dividas.js` — `processarArquivoIA()`

**O quê:**
```javascript
if(nomeLower.endsWith('.pdf')) {
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    // ↑ Sem verificar se pdfjsLib existe!
}
```
Se o CDN do PDF.js falhar ao carregar, `pdfjsLib` é `undefined` → `TypeError` não tratado.

**Impacto:** Usuário fica preso no spinner infinito sem mensagem de erro.

**🔧 SOLUÇÃO:**
```javascript
if(nomeLower.endsWith('.pdf')) {
    if (!window.pdfjsLib) {
        mostrarErroIA('PDF.js não carregou. Verifique a conexão ou use "Colar Texto".');
        return;
    }
    // ... resto do processamento
}
```

---

### 🟡 Problema #7 — MÉDIO: Listeners Não Limpos no Redirect

**Onde:** `js/dividas.js` — `onAuthStateChanged`

**O quê:**
```javascript
onAuthStateChanged(auth, user => {
    _unsubs.forEach(fn=>fn()); _unsubs=[];
    if(user) {
        _unsubs.push(onSnapshot(...));
    } else {
        window.location.href = "index.html"; // ← Sem limpar _unsubs!
    }
});
```

**Impacto:** Se o usuário fez logout enquanto havia listeners ativos, eles continuam existindo em memória até o redirect completar — desperdício de conexões Firestore.

**🔧 SOLUÇÃO:**
```javascript
} else {
    _unsubs.forEach(fn=>fn()); _unsubs=[];
    window.location.href = "index.html";
}
```

---

### 🟡 Problema #8 — MÉDIO: Parcelas Só Podem Ser Pagas em Ordem Estrita

**Onde:** `js/dividas.js` — `marcarParcelaPaga()`

**O quê:**
```javascript
if(indice !== (d.parcelasPagas||0)) {
    window.budShowToast('Pague as parcelas em ordem!', 'warning');
    return;
}
```

**Impacto:** No mundo real, bancos frequentemente permitem pagamento fora de ordem (quitação parcial, acordo). A restrição frustra usuários legítimos sem explicação adequada.

**🔧 SOLUÇÃO (opção equilibrada):** Avisar mas permitir com confirmação:
```javascript
if(indice !== (d.parcelasPagas||0)) {
    const ok = await confirmarAcao(
        'Parcela fora de ordem',
        `Isso marcará a parcela #${indice+1} como paga, mas a #${d.parcelasPagas+1} ainda estará pendente. Confirmar?`,
        'Confirmar mesmo assim'
    );
    if (!ok) return;
}
```

---

### 🟢 Problema #9 — LEVE: `salvarDividaIA` Sem Loading State

**Onde:** `js/dividas.js` — `salvarDividaIA()`

**O quê:** Botão "Salvar Dívida" não fica disabled durante o `await addDoc`. Double-click cria duplicatas.

**Impacto:** Dívidas duplicadas no Firestore do usuário.

**🔧 SOLUÇÃO:** Disable o botão durante o save (ver Problema #17 que é a versão completa desse fix).

---

### 🟢 Problema #10 — LEVE: Datas de Vencimento Não Ajustam Meses Curtos

**Onde:** `js/dividas.js` — `renderizarParcelas()`

**O quê:**
```javascript
const dt = new Date(vencBase);
dt.setMonth(dt.getMonth() + i);
// Jan 31 + 1 mês → 3 de março (fevereiro pula para março!)
```

**Impacto:** Parcelas de financiamentos com dia 29–31 ficam com datas erradas em fevereiro, abril, junho, setembro e novembro.

**🔧 SOLUÇÃO:**
```javascript
function addMonthsSafe(date, months) {
    const d = new Date(date);
    const dia = d.getDate();
    d.setMonth(d.getMonth() + months, 1); // Vai para dia 1 do mês destino
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimoDia));   // Usa o menor entre dia original e último do mês
    return d;
}
```

---

### 🟢 Problema #11 — LEVE: Limpar Arquivo IA Sem Feedback Visual

**Onde:** `js/dividas.js` — `limparArquivoIA()`

**O quê:**
```javascript
window.limparArquivoIA = function() {
    document.getElementById('iaFileInput').value = '';
    document.getElementById('iaFileInfo').classList.add('hidden');
    document.getElementById('iaUploadArea').classList.remove('hidden');
    // Sem toast de confirmação
};
```

**Impacto:** Usuário pode clicar no X por engano e não saber que o arquivo foi removido.

**🔧 SOLUÇÃO:** Adicionar `window.budShowToast?.('Arquivo removido', 'info');` no final.

---

### 🟢 Problema #12 — LEVE: Overlays HTML vs JS com Cores Diferentes

**Onde:** `dividas.html` L45 vs `js/dividas.js` (diálogos de confirmação)

**O quê:**
```html
<!-- HTML usa slate-900/40 (azul-escuro) -->
<div id="mobileOverlay" class="bg-slate-900/40 ...">

<!-- JS usa black/40 (preto puro) -->
ov.className = 'bg-black/40 ...';
```

**Impacto:** Inconsistência visual sutil entre sobreposições nativas e as criadas em JS.

**🔧 SOLUÇÃO:** Em todos os overlays JS usar `background:rgba(15,23,42,0.4)` (= slate-900/40).

---

### 🟢 Problema #13 — LEVE: `.sort()` Muta o Array `dividas`

**Onde:** `js/dividas.js` — `renderizar()` (linha de geração dos cards)

**O quê:**
```javascript
container.innerHTML = dividas.sort((a,b)=>...).map(d => ...).join('');
// ↑ .sort() modifica dividas[] in-place!
```

**Impacto:** A ordem do array `dividas` é alterada a cada render, podendo causar inconsistências se `dividas` for referenciado em outro lugar logo após (ex: `dividasMap.clear()`).

**🔧 SOLUÇÃO:**
```javascript
container.innerHTML = [...dividas].sort((a,b)=>...).map(d => ...).join('');
```

---

### 🟢 Problema #14 — LEVE: Sem Indicador de Loading no Salvar IA

(Duplicado conceptualmente com #9. Ambos cobertos pela solução do Problema #17.)

---

## FASE 2 — 11 Novos Problemas (Varredura Integral)

### 🔴 Problema #15 — GRAVE: Saldo Devedor Calculado Incorretamente em Toda a Tela

**Onde:** `js/dividas.js` — `renderizar()`, `abrirDetalhes()`, `abrirSimulador()`, `simularExtra()`, `verEconomia()` e cards da lista

**O quê:** Em **todos** os locais o saldo devedor é:
```javascript
const falta = d.valorTotal - (d.valorPago||0);
```
Mas `valorPago` é a **soma dos PMTs** (que incluem juros + amortização). O saldo real na Tabela Price é calculado subtraindo apenas a **amortização** de cada parcela, não o PMT completo.

**Exemplo concreto com R$10.000 a 1% a.m. em 12 parcelas (PMT=R$888,49):**

| Após 6 parcelas | Valor |
|---|---|
| `valorPago` no Firestore | R$ 5.330,94 (6 × 888,49) |
| `falta` calculado no código | R$ 4.669,06 (10000 - 5330,94) |
| **Saldo REAL (Tabela Price)** | **R$ 5.160,55** |
| **ERRO** | **R$ 491,49 a menos!** |

**Impacto CRÍTICO:**
- KPI "Saldo Devedor" mostra **menos** do que o usuário realmente deve
- Barra de progresso mostra **mais progresso** que a realidade
- Simulador "Quitar Tudo" mostra valor **insuficiente** para quitar → usuário paga e ainda fica devendo
- Simulador "Pagamento Extra" calcula economia sobre base errada

**🔧 SOLUÇÃO:** Criar helper e substituir `falta` em todos os locais:
```javascript
function calcularSaldoDevedor(d) {
    const taxaMensal = (d.juros || 0) / 100;
    const valorParcela = d.valorParcela || (d.parcelas > 0
        ? (taxaMensal > 0
            ? (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -d.parcelas))
            : d.valorTotal / d.parcelas)
        : 0);
    let saldo = d.valorTotal;
    for (let i = 0; i < (d.parcelasPagas || 0); i++) {
        const jurosParc = saldo * taxaMensal;
        saldo = Math.max(0, saldo - (valorParcela - jurosParc));
    }
    return saldo;
}

// Substituir em todos os locais:
// const falta = d.valorTotal - (d.valorPago||0);
// ↓
const falta = calcularSaldoDevedor(d);
```

---

### 🟡 Problema #16 — MÉDIO: .doc/.docx Aceitos Mas Processados Como Imagem

**Onde:** `dividas.html` — L282 (input accept) + `js/dividas.js` — `processarArquivoIA()`

**O quê:**
```html
<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" ...>
```
O código só processa `.txt`, `.pdf` e imagens. Arquivos `.doc/.docx` **caem no bloco do Tesseract** (OCR de imagem) e produzem texto binário ilegível.

**Impacto:** Upload de Word aparentemente funciona mas produz dados completamente errados ou erro silencioso.

**🔧 SOLUÇÃO:**
```javascript
// Rejeitar formatos não suportados logo no início de processarArquivoIA:
const suportados = ['.txt', '.pdf', '.jpg', '.jpeg', '.png', '.webp'];
if (!suportados.some(ext => nomeLower.endsWith(ext))) {
    mostrarErroIA('Formato não suportado. Use PDF, JPG, PNG ou TXT. Para Word, copie o texto e use "Colar Texto".');
    return;
}
```
E corrigir o `accept` do input:
```html
<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" ...>
```

---

### 🟡 Problema #17 — MÉDIO: `salvarDividaIA` Sem try/catch (Duplicatas)

**Onde:** `js/dividas.js` — `salvarDividaIA()`

**O quê:**
```javascript
window.salvarDividaIA = async function() {
    // ... monta dados ...
    await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), dados); // Sem try/catch!
    fecharTodosModais(); // Fecha mesmo se falhou!
};
```
Sem `try/catch` e sem `disabled` no botão durante o save.

**Impacto:** Double-click cria dívidas duplicadas no Firestore. Erro de rede fecha o modal silenciosamente.

**🔧 SOLUÇÃO:**
```javascript
window.salvarDividaIA = async function() {
    const btn = document.querySelector('#iaResultado button[onclick*="salvarDividaIA"]');
    if (btn) { btn.disabled = true; btn.innerText = '💾 Salvando...'; }
    try {
        // ... monta dados ...
        await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), dados);
        window.budShowToast?.('Dívida importada com sucesso!', 'success');
        fecharTodosModais();
    } catch(err) {
        console.error('[Dividas IA] Erro ao salvar:', err);
        window.budShowToast?.('Erro ao salvar. Tente novamente.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '💾 Salvar Dívida'; }
    }
};
```

---

### 🟡 Problema #18 — MÉDIO: Classes com Opacidade Dinâmicas em Parcelas

**Onde:** `js/dividas.js` — `renderizarParcelas()`

**O quê:**
```javascript
// Parcela paga:
class="... ${paga?'bg-emerald-50/30':''}"

// Parcela atrasada:
statusClass = 'border-red-200 bg-red-50/30';
```
`bg-emerald-50/30` e `bg-red-50/30` (modificadores de opacidade) **não existem** no build estático do Tailwind.

**Impacto:** Parcelas pagas e atrasadas ficam visualmente iguais às pendentes. O sistema de cores perde totalmente o sentido.

**🔧 SOLUÇÃO:**
```javascript
// Substituir classes por inline styles:
const bgPaga    = 'background:rgba(236,253,245,0.3);';   // emerald-50/30
const bgAtrasa  = 'background:rgba(254,242,242,0.3);';   // red-50/30

html += `<div class="parcela-item flex items-center gap-3 p-4 rounded-2xl border ${borderClass}"
              style="${paga ? bgPaga : atrasada ? bgAtrasa : ''}">`;
```

---

### 🟡 Problema #19 — MÉDIO: Código Morto (2 Funções Nunca Chamadas)

**Onde:** `js/dividas.js` — L1083–1130 (`registrarPagamento`) e L770–790 (`excluirDivida`)

**O quê:**
1. `window.registrarPagamento(id)` — cópia da lógica de `marcarParcelaPaga`. Nenhum botão/onclick chama essa função.
2. `window.excluirDivida(id)` — variante de `excluirDividaAtual()`. Também nunca chamada.

**Impacto:** ~75 linhas de código morto. Se um bug for corrigido em `marcarParcelaPaga`, a cópia em `registrarPagamento` fica desatualizada.

**🔧 SOLUÇÃO:** Remover ambas as funções. Se precisar excluir por ID no futuro:
```javascript
window.excluirDividaAtual = async function(idOverride) {
    const targetId = idOverride || (dividaAtual && dividaAtual.id);
    if (!targetId) return;
    // ... resto igual
};
```

---

### 🟡 Problema #20 — MÉDIO: `fmt()` Oculta Valores no Preview IA

**Onde:** `js/dividas.js` — `mostrarPreviewIA()` (extras: IOF, seguro, juros anual)

**O quê:**
```javascript
const fmt = v => valoresOcultos ? 'R$ •••••' : (v||0).toLocaleString(...);
// ...
if(extras.iof) extHTML += `...${fmt(extras.iof)}...`;
```
Se o usuário ativou "ocultar valores", os dados extraídos pela IA aparecem como "R$ •••••".

**Impacto:** Impossível verificar se a IA extraiu os valores corretos antes de salvar. Usuário precisa desativar o toggle para revisar.

**🔧 SOLUÇÃO:** Usar formatação direta (sem toggle) no preview IA:
```javascript
const fmtIA = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
if(extras.iof) extHTML += `...${fmtIA(extras.iof)}...`;
```

---

### 🟢 Problema #21 — LEVE: Tab "Câmera" Inútil no Desktop

**Onde:** `dividas.html` — L297-305 + `js/dividas.js`

**O quê:** `<input capture="environment">` só ativa câmera em dispositivos móveis. No desktop, abre um file picker padrão — idêntico ao da aba "Arquivo".

**Impacto:** Confusão no desktop. Botão "Abrir Câmera" abre seletor de arquivos sem aviso.

**🔧 SOLUÇÃO:**
```javascript
// Em DOMContentLoaded:
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || ('ontouchstart' in window);
if (!isMobile) {
    document.getElementById('tabIACamera').style.display = 'none';
}
```

---

### 🟢 Problema #22 — LEVE: `limit(500)` Sem `orderBy` no onSnapshot

**Onde:** `js/dividas.js` — listener principal

**O quê:**
```javascript
query(collection(db,"usuarios",user.uid,"dividas"), limit(500))
```
Sem `orderBy`, o Firestore retorna documentos em ordem de document ID. Com >500 dívidas, as 500 retornadas são arbitrárias — as mais recentes podem ficar de fora.

**Impacto:** Usuário com muitas dívidas pode não ver as cadastradas mais recentemente.

**🔧 SOLUÇÃO:**
```javascript
// Adicionar import: orderBy
query(collection(db,"usuarios",user.uid,"dividas"), orderBy('criadoEm','desc'), limit(500))
```

---

### 🟢 Problema #23 — LEVE: `escapeHTML` Sem Fallback

**Onde:** `js/dividas.js` — L10

**O quê:**
```javascript
const escapeHTML = window.escapeHTML;
// ↑ Se bud-utils.js falhar ao carregar → undefined
```
`escapeHTML(d.nome)` → `TypeError: escapeHTML is not a function` → tela inteira quebra.

**Impacto:** Qualquer falha de rede no carregamento de `bud-utils.js` torna a tela completamente inutilizável.

**🔧 SOLUÇÃO:**
```javascript
const escapeHTML = window.escapeHTML || function(s) {
    const div = document.createElement('div');
    div.textContent = String(s || '');
    return div.innerHTML;
};
```

---

### 🟢 Problema #24 — LEVE: Modal Detalhes Sempre Reseta para Aba "Resumo"

**Onde:** `js/dividas.js` — `abrirDetalhes()`, `marcarParcelaPaga()`, `desmarcarParcela()`

**O quê:**
```javascript
window.abrirDetalhes = function(id) {
    // ...
    trocarTab('resumo'); // ← Sempre reseta!
    // ...
};

// Após marcar/desmarcar parcela:
setTimeout(() => abrirDetalhes(id), 300); // ← Reabre na aba Resumo
```

**Impacto:** Usuário está na aba "Parcelas" marcando pagamentos → cada marcação fecha e reabre o modal na aba "Resumo" → precisa clicar em "Parcelas" de novo para continuar.

**🔧 SOLUÇÃO:**
```javascript
let _tabAtualDetalhes = 'resumo';

window.trocarTab = function(tab) {
    _tabAtualDetalhes = tab;
    // ... resto igual
};

window.abrirDetalhes = function(id, tabInicial) {
    // ...
    trocarTab(tabInicial || _tabAtualDetalhes || 'resumo');
    // ...
};

// Em marcarParcelaPaga e desmarcarParcela:
setTimeout(() => abrirDetalhes(id, 'parcelas'), 300);
```

---

### 🟢 Problema #25 — LEVE: Código Duplicado nos Diálogos de Confirmação

**Onde:** `js/dividas.js` — `excluirDivida()`, `excluirDividaAtual()`, `desmarcarParcela()`

**O quê:** 3 funções criam um dialog de confirmação com ~20 linhas cada, estrutura idêntica mas IDs diferentes (`cxlDel`/`cfmDel`, `cxlDel2`/`cfmDel2`, `cxlUnp`/`cfmUnp`). Cada um também usa as classes Tailwind dinâmicas do Problema #1.

**Impacto:** ~60 linhas duplicadas. Fix do Problema #1 precisa ser aplicado manualmente 3x. Risco de divergência ao manter.

**🔧 SOLUÇÃO:** Extrair helper reutilizável:
```javascript
function confirmarAcao(titulo, mensagem, textoBotao = 'Confirmar', corBotao = 'red') {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">
                <p class="text-lg font-bold text-slate-800 mb-2">${escapeHTML(titulo)}</p>
                <p class="text-slate-500 text-sm mb-6">${escapeHTML(mensagem)}</p>
                <div class="flex gap-3">
                    <button data-res="0" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Cancelar</button>
                    <button data-res="1" class="flex-1 py-2.5 rounded-xl bg-${corBotao}-500 text-white font-semibold text-sm">${escapeHTML(textoBotao)}</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => {
            const res = e.target.closest('[data-res]');
            if (res || e.target === ov) { ov.remove(); resolve(!!res && res.dataset.res === '1'); }
        });
    });
}

// Uso:
const ok = await confirmarAcao('Excluir dívida', 'Tem certeza que deseja excluir?', 'Excluir');
if (ok) await deleteDoc(doc(db,"usuarios",currentUser.uid,"dividas",id));
```

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA
- [ ] **#1** — Overlay invisible: trocar `.className` por `.style.cssText` nos 3 diálogos de confirmação
- [ ] **#2** — Adicionar error callback no onSnapshot
- [ ] **#3** — Try/catch + loading state no submit do formulário
- [ ] **#15** — Criar `calcularSaldoDevedor()` e substituir `falta = valorTotal - valorPago` em 6 locais

### 🟡 PRIORIDADE ALTA
- [ ] **#4** — Validar valorTotal > 0 e parcelas >= 0
- [ ] **#5** — Usar `d.valorParcela` (PMT real) no simulador em vez de recalcular do zero
- [ ] **#6** — Verificar `window.pdfjsLib` antes de usar + `window.Tesseract` antes de OCR
- [ ] **#7** — Limpar `_unsubs` antes do redirect no logout
- [ ] **#8** — Permitir pagamento fora de ordem com confirmação
- [ ] **#16** — Rejeitar .doc/.docx com mensagem de orientação
- [ ] **#17** — Try/catch + disabled button no `salvarDividaIA`
- [ ] **#18** — Inline styles para `bg-emerald-50/30` e `bg-red-50/30` em parcelas
- [ ] **#19** — Remover código morto: `registrarPagamento` + `excluirDivida`
- [ ] **#20** — Usar `fmtIA` (sem ocultar) no preview da IA

### 🟢 PRIORIDADE BAIXA
- [ ] **#10** — Implementar `addMonthsSafe()` para datas de vencimento em meses curtos
- [ ] **#11** — Toast ao limpar arquivo no upload IA
- [ ] **#12** — Padronizar cor dos overlays (coberto pelo #25)
- [ ] **#13** — `[...dividas].sort(...)` para não mutar o array original
- [ ] **#21** — Ocultar aba "Câmera" em dispositivos desktop
- [ ] **#22** — Adicionar `orderBy('criadoEm','desc')` no query do onSnapshot
- [ ] **#23** — Fallback local para `escapeHTML`
- [ ] **#24** — Preservar aba ativa ao reabrir modal de detalhes
- [ ] **#25** — Extrair helper `confirmarAcao()` para eliminar código duplicado

---

## 📊 MÉTRICAS FINAIS

| Severidade | Fase 1 | Fase 2 | Total |
|---|---|---|---|
| 🔴 GRAVE | 3 | 1 | **4** |
| 🟡 MÉDIO | 5 | 5 | **10** |
| 🟢 LEVE | 5+1 dup | 5 | **11** |
| **TOTAL** | **14** | **11** | **25** |

### 🏆 Bug Mais Crítico: Problema #15

O saldo devedor é calculado como `valorTotal - valorPago`, mas `valorPago` é a soma dos PMTs (que incluem juros). Na Tabela Price, o saldo real é **maior** porque cada PMT quita mais amortização do que parece. O erro **cresce com a taxa de juros e o número de parcelas pagas** — em um financiamento imobiliário de 360 meses a 0,8% a.m., o erro pode ultrapassar **30% do saldo real**. Isso afeta diretamente decisões financeiras reais do usuário: pagar o "Valor para Quitar" exibido pelo simulador não quitará a dívida.
