# 🐛 Erros Encontrados & Lições Aprendidas

**Documento de aprendizado para evitar os mesmos erros no novo projeto**

**Data de criação:** 2026-04-06  
**Fonte:** App-Financas v3 (Bud Finanças)  
**Objetivo:** Servir como guia de boas práticas e anti-patterns para detectar

---

## 📋 Índice

1. [Erros Críticos (Lógica)](#erros-críticos-lógica)
2. [Erros de Importação/Parser](#erros-de-importaçãoparser)
3. [Erros de UI/Styling](#erros-de-uistyling)
4. [Erros de Escopo/Binding](#erros-de-escobinding)
5. [Erros de Estado](#erros-de-estado)
6. [Padrões de Prevenção](#padrões-de-prevenção)
7. [Checklist para Novo Projeto](#checklist-para-novo-projeto)

---

## 🔴 Erros Críticos (Lógica)

### 1️⃣ SALDO DUPLICADO EM IMPORTAÇÕES

**O que aconteceu:**
```
Cenário: Usuário cria carteira (R$ 5.000) e importa extrato do mês
├─ Extrato: Pix +300, Mercado -250
├─ ❌ Sistema calculava: 300 - 250 = R$ 50
├─ ✅ Deveria: 5.000 + 300 - 250 = R$ 5.050
└─ Resultado: Saldo 99x menor que real
```

**Por que aconteceu:**
- Transações importadas (histórico) foram somadas como se fossem "futuras"
- Não havia separação entre "histórico já ocorrido" vs "transações futuras"
- `saldoInicial` era ignorado no cálculo

**Como evitar:**
```javascript
// ❌ ERRADO - Soma tudo
function calcularSaldo(transacoes) {
  return transacoes.reduce((s, t) => 
    s + (t.tipo === 'receita' ? t.valor : -t.valor), 0
  );
}

// ✅ CORRETO - Usa snapshot + delta
function calcularSaldo(carteira, transacoes) {
  // Base: último snapshot confirmado
  let saldo = carteira.ultimaConfirmacao?.saldo ?? carteira.saldoInicial;
  
  // Delta: apenas transações POSTERIORES
  const dataSnapshot = carteira.ultimaConfirmacao?.data || "1900-01-01";
  const deltaTransacoes = transacoes.filter(t => 
    t.dataReferencia > dataSnapshot &&
    t.origem !== "csv" && t.origem !== "ofx"  // Não são importadas
  );
  
  deltaTransacoes.forEach(t => {
    saldo += (t.tipo === 'receita' ? t.valor : -t.valor);
  });
  
  return saldo;
}
```

**Arquitetura correta:**
```firestore
carteira/{id}
├─ saldoInicial: 5000          // Criação
├─ ultimaConfirmacao: {
│  ├─ data: "2026-04-06"       // Última sincronização
│  ├─ saldo: 5050              // Saldo CONFIRMADO nessa data
│  └─ origem: "extrato_importado"
│ }
└─ saldoAtual = 5050 + (manuais posteriores a 2026-04-06)
```

**Lição:** Sempre separar "estado confirmado" de "mudanças futuras"

---

### 2️⃣ TRANSAÇÕES SEM CONFIRMAÇÃO DE VALOR REAL

**O que aconteceu:**
```
Cenário: User registra-se dia 10, mas salário foi dia 5
├─ Sistema: "Ok, você recebeu R$ 5.000"
├─ Realidade: Usuário tinha gasto R$ 200, então tem R$ 4.800
├─ ❌ Saldo mostrado: R$ 5.000 (ERRADO!)
└─ ✅ Deveria: Pedir confirmação: "Você REALMENTE tem esse valor?"
```

**Por que aconteceu:**
- Assumiu que transações antigas eram sempre confirmadas
- Não havia fluxo de validação de transações com data passada
- Sistema não diferenciava "planejado" de "confirmado"

**Como evitar:**
```javascript
// STATUS DO TRANSAÇÃO
const STATUS_TRANSACAO = {
  'confirmada': 'transação 100% confirmada com valor real',
  'pendente_confirmacao': 'transação antiga precisa validar valor',
  'cancelada': 'usuário descartou',
  'planejada': 'agendada para futuro'
};

// No onboarding Step 8
async function confirmarSaldoInicial() {
  const saldoAtual = parseFloat(document.getElementById('saldoInicial').value);
  
  // Todas as transações anteriores de onboarding → pendentes
  const transacoesAnteriores = onboardingTransacoes
    .filter(t => new Date(t.dataReferencia) < new Date());
  
  // Criar transações com status correto
  transacoesAnteriores.forEach(t => {
    transacoes.push({
      ...t,
      status: 'pendente_confirmacao',  // ← CHAVE
      confirmadoEm: null
    });
  });
  
  // Criar saldo inicial com confirmação
  transacoes.push({
    tipo: 'receita',
    descricao: 'Saldo Inicial',
    valor: saldoAtual,
    status: 'confirmada',  // User já verificou
    confirmadoEm: serverTimestamp()
  });
}
```

**Modal de confirmação obrigatório:**
```javascript
// Quando dashboard carrega, mostra banner das pendentes
const pendentes = transacoes.filter(t => t.status === 'pendente_confirmacao');
if (pendentes.length > 0) {
  mostrarBannerConfirmacoes(pendentes);
  // User NÃO consegue ver saldo até confirmar
}

// Confirmação com diferença detectada
async function confirmarTransacao(transacaoId) {
  const modalValorReal = parseFloat(document.getElementById('valorReal').value);
  const valorOriginal = transacao.valor;
  const diferenca = modalValorReal - valorOriginal;
  
  if (Math.abs(diferenca) > 0.01) {
    // Usuário mudou o valor! Guardar evidência
    await updateDoc(..., {
      valor: modalValorReal,
      valorOriginal: valorOriginal,  // Auditoria
      diferenca: diferenca,
      observacao: userNote,  // Por que mudou?
      status: 'confirmada',
      confirmadoEm: serverTimestamp()
    });
  }
}
```

**Lição:** Transações antigas (data < hoje) precisam de confirmação explícita

---

### 3️⃣ Transferência de Saldo Entre Contas Sem Dedução

**O que aconteceu:**
```
❌ User: "Transferi R$ 100 da Nubank para Caixa"
├─ Nubank: -100 (despesa)
├─ Caixa: +100 (receita)
└─ Saldo Total: -100 + 100 = 0 DELTA (correto por coincidência!)

Mas se transferência não é "receita/despesa" real:
- Saldo total fica IGUAL (não deveria)
```

**Como evitar:**
```javascript
// Em importações, "Transferência" é especial
const tiposEspeciais = {
  'transferencia': {
    cartaoOrigem: 'cart_nubank',
    cartaoDestino: 'cart_caixa',
    debita: (saldo) => saldo - valor,
    credita: (saldo) => saldo + valor,
    aoSomar: 0  // Não conta no saldo TOTAL (é movimentação, não entrada/saída)
  }
};

// Dashboard ignora transferências no cálculo de saldo
const saldoTotal = transacoes
  .filter(t => t.tipo !== 'transferencia')  // Filtrar
  .reduce((s, t) => s + (t.tipo === 'receita' ? t.valor : -t.valor), 0);
```

**Lição:** Transferências internas não devem afetar saldo total do app

---

## 🟡 Erros de Importação/Parser

### 4️⃣ DETECÇÃO INCORRETA DE TIPO (RECEITA vs DESPESA)

**Exemplos que falharam:**
```javascript
❌ "Juros crédito rotativo" → detectado como RECEITA
   (falso positivo em /\bcredito\b/ genérico)

❌ "Parcela de Empréstimo" → não era detectado como DESPESA
   (regex insuficiente)

❌ "Resgate RDB" → detectado como DESPESA
   (deveria ser RECEITA - dinheiro voltou para conta)

❌ "Compra PIX" → detectado como RECEITA
   (deveria ser DESPESA)
```

**Por que aconteceu:**
- Regex sem prioridades (ordem importa!)
- Não levava em conta contexto/banco específico

**Como evitar:**
```javascript
// ✅ CORRETO - Com prioridades
function detectarTipo(descricao) {
  if (!descricao) return null;
  const d = descricao.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. EXCEÇÕES PRIMEIRO (mais específicas)
  if (/juros.*credito\s*rotativo|credito\s*rotativo/i.test(d)) 
    return 'despesa';  // Não é receita!
  
  if (/parcela.*emprestimo|financiamento/i.test(d))
    return 'despesa';  // Pagamento, não despesa
  
  // 2. Padrões Nubank/Banco-específicos
  if (/transferencia\s*recebida\s*pelo\s*pix/i.test(d)) 
    return 'receita';
  
  if (/transferencia\s*enviada\s*pelo\s*pix/i.test(d)) 
    return 'despesa';
  
  // 3. Palavras-chave genéricas (menos específicas)
  if (/\breceb|\bentrada|\bcredito\s*de\s*(?!rotativo)/i.test(d))
    return 'receita';
  
  if (/\bgast|\bdespesa|\bpagto|\bcompra/i.test(d))
    return 'despesa';
  
  // 4. Fallback seguro
  return null;  // Deixar usuário decidir
}

// ✅ TESTES
console.assert(
  detectarTipo("Juros crédito rotativo") === 'despesa',
  'Juros crediticio deveria ser despesa'
);
console.assert(
  detectarTipo("Transferência recebida pelo PIX") === 'receita',
  'PIX recebido deveria ser receita'
);
```

**Lição:** Ordem de regex importa; específico antes de genérico; adicionar fallback seguro

---

### 5️⃣ PROBLEMAS DE PARSER CSV/OFX

**Erros encontrados:**
```
❌ BOM (Byte Order Mark) não era removido
   └─ Primeira coluna ficava com lixo: "\uFEFFData"

❌ Separador `;` vs `,` não era detectado
   └─ Parser quebrava em arquivos Nubank

❌ Data ausente causava parse failure
   └─ Importação inteira falhava

❌ OFX com TRNTYPE=OTHER não era classificado
   └─ Transações perdidas
```

**Como evitar:**
```javascript
// ✅ PARSER ROBUSTO
function parseCSV(texto) {
  // 1. Remove BOM
  texto = texto.replace(/^\uFEFF/, '');
  
  // 2. Detecta separador
  const linhas = texto.split('\n');
  const primeiraLinha = linhas[0];
  const separador = primeiraLinha.includes(';') ? ';' : ',';
  
  // 3. Parse com tratamento de erro
  const resultado = [];
  linhas.slice(1).forEach((linha, idx) => {
    try {
      if (!linha.trim()) return;  // Skip linhas vazias
      
      const [data, descricao, valuoStr] = linha.split(separador);
      const dataFormatada = normalizarData(data);
      const valor = parseFloat(
        valuoStr.replace(/[^\d.,\-]/g, '').replace(',', '.')
      );
      
      // 4. Validação defensiva
      if (!dataFormatada) {
        console.warn(`Linha ${idx}: data inválida, usando hoje`);
        dataFormatada = new Date().toISOString().slice(0, 10);
      }
      if (!valor || isNaN(valor)) {
        console.warn(`Linha ${idx}: valor inválido`);
        return;
      }
      
      resultado.push({
        data: dataFormatada,
        descricao: descricao.trim(),
        valor: valor,
        tipo: detectarTipo(descricao)
      });
    } catch (err) {
      console.error(`Linha ${idx}: erro ao processar`, err);
      // Continua processando próximas linhas
    }
  });
  
  return resultado;
}

// ✅ NORMALIZA DATA PARA "YYYY-MM-DD"
function normalizarData(str) {
  if (!str) return null;
  str = String(str).trim();
  
  // Já está correto
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // DD/MM/YYYY ou DD/MM/YY
  let m = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2]}-${m[1]}`;
  }
  
  // Fallback: tenta novo Date()
  const d = new Date(str);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
```

**Lição:** Parsers precisam ser defensivos; sempre ter fallbacks; testar com dados reais

---

## 🟠 Erros de UI/Styling

### 6️⃣ CLASSES TAILWIND DINÂMICAS NÃO FUNCIONAM

**O que aconteceu:**
```javascript
❌ ERRADO - Tailwind não compila classes dinâmicas
const modal = document.createElement('div');
modal.className = 'fixed inset-0 bg-black/40 z-[9999]';
// Elemento aparece INVISÍVEL porque build static não viu essas classes
```

**Por que aconteceu:**
- Tailwind é build-time; precisa ver classe no código-fonte
- Classes dinâmicas geradas em runtime = não compiladas

**Como evitar:**
```javascript
// ✅ CORRETO - Usar inline styles para dinâmico
function criarOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    z-index: 85;
    opacity: 0;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(overlay);
  // Animar depois
  setTimeout(() => overlay.style.opacity = '1', 10);
  return overlay;
}

// ✅ ALTERNATIVO - Pré-compilar classes em HTML
// No arquivo .html, adicione classe BASE sempre presente
<div id="modalTemplate" class="fixed inset-0 bg-black/40 z-[85] hidden">
  <!-- Conteúdo -->
</div>

// Em JS, apenas toggle hidden
document.getElementById('modalTemplate').classList.remove('hidden');
```

**Lição:** Para dinâmico sempre use inline styles; Tailwind dinâmico é armadilha

---

### 7️⃣ BOTÕES DE CALLBACK NÃO FUNCIONAVAM

**O que aconteceu:**
```html
❌ HTML esperava função global
<button onclick="marcarPagoDashboard(txnId)">Pago</button>

❌ MAS função estava em módulo ES6
// dashboard.js - arquivo import
function marcarPagoDashboard(txnId) { ... }
// Função NÃO estava em window!
```

**Como evitar:**
```javascript
// ✅ CORRETO - Expor função global
window.marcarPagoDashboard = async function(txnId) {
  const transacao = transacoesGlobais.find(t => t.id === txnId);
  // ... lógica ...
};

// ✅ OU usar event delegation em JS puro
document.on('click', '[data-action="marcar-pago"]', function(e) {
  const txnId = this.dataset.id;
  marcarPagoDashboard(txnId);
});

// E no HTML, sem callback
<button class="btn-pago" data-action="marcar-pago" data-id="{{ txnId }}">
  Pago
</button>
```

**Lição:** Se usar onclick em HTML, função DEVE estar em window; ou use data-attributes + event delegation

---

## 🔵 Erros de Escopo/Binding

### 8️⃣ TRANSAÇÕES COM ESTADO AMBÍGUO

**O que aconteceu:**
```
Problema: Transação tinha campo "confirmado" (boolean)
├─ confirmado: true  → Confirmado
├─ confirmado: false → Não confirmado
├─ confirmado: null  → ??? (indefinido!)

Resultado: Bug no dashboard
```

**Como evitar:**
```javascript
// ❌ ERRADO - Estados ambíguos
const transacao = {
  confirmado: false,  // É "não confirmado" ou "cancelado"?
  pago: null,         // É "nunca confirmado" ou "desconhecido"?
};

// ✅ CORRETO - Estados explícitos
const STATUS_CONFIRMACAO = ['pendente', 'confirmada', 'cancelada'];
const transacao = {
  status: 'pendente_confirmacao',  // Deixa claro
  statusPagamento: 'pago',         // Ou 'nao_pago', 'desconhecido'
};

// ✅ ALTERNATIVO - Status consolidado
const transacao = {
  status: 'pendente',     // 'confirmada' | 'pendente' | 'cancelada'
  pagto: 'realizado',     // 'realizado' | 'planejado' | 'vencido'
};
```

**Lição:** Sempre use string enums para estado; evita boolean `null` ambíguo

---

## 🟢 Padrões de Prevenção

### Como evitar estes erros:

#### 1. **Testes de Regressão**
```javascript
// Sempre adicione casos de teste para bugs encontrados
describe('Saldo com Importação', () => {
  test('saldo importado + delta manual = correto', () => {
    // Arrange
    const carteira = {
      saldoInicial: 5000,
      ultimaConfirmacao: {
        data: '2026-04-06',
        saldo: 5050
      }
    };
    const transacoes = [
      { dataReferencia: '2026-04-06', tipo: 'receita', valor: 100, origem: 'csv' },  // importada
      { dataReferencia: '2026-04-07', tipo: 'despesa', valor: 50, origem: 'manual' }  // manual
    ];
    
    // Act
    const saldo = calcularSaldo(carteira, transacoes);
    
    // Assert
    expect(saldo).toBe(5000);  // 5050 (snap) - 50 (manual) = 5000
  });
});
```

#### 2. **Validação em Camadas**
```javascript
// Validar em múltiplas camadas:
// 1. Client-side (UX)
if (valor <= 0) alert('Valor deve ser positivo');

// 2. API/Backend
if (!isValidEmail(email)) throw new Error('Email inválido');

// 3. Firestore rules
allow write: if request.auth.uid != null 
             && resource.data.userId == request.auth.uid;
```

#### 3. **Logging Estruturado**
```javascript
// Sempre log com contexto
function calcularSaldo(carteira, transacoes) {
  const snap = carteira.ultimaConfirmacao?.saldo ?? carteira.saldoInicial;
  const delta = transacoes
    .filter(t => t.dataReferencia > (carteira.ultimaConfirmacao?.data || '1900-01-01'))
    .reduce((s, t) => s + (t.tipo === 'receita' ? t.valor : -t.valor), 0);
  
  const saldo = snap + delta;
  
  console.log('📊 Cálculo saldo', {
    carteiraId: carteira.id,
    saldoSnapshot: snap,
    deltaTransacoes: delta,
    saldoFinal: saldo,
    timestamp: new Date().toISOString()
  });
  
  return saldo;
}
```

#### 4. **Separação de Conceitos**
```javascript
// Criar funções especializadas:

// getData() - apenas lê dados
// applyBusiness Logic() - aplica regras
// render() - mostra no UI

// NÃO:
function renderizarSaldo() {
  const snap = db...;  // Lê
  const calc = snap.reduce(...);  // Calcula
  document.getElementById('saldo').innerHTML = calc;  // Renderiza
}

// SIM:
function obterSaldo(carteira, transacoes) {
  return snap + delta;  // Apenas calcular
}

function renderizarSaldo(saldo) {
  document.getElementById('saldo').innerHTML = formatar(saldo);  // Apenas renderizar
}

// Separação = fácil testar, debugar, reusar
```

---

## 📋 Checklist para Novo Projeto

Antes de começar, verifique:

### **Arquitetura**
- [ ] Definir estados do negócio (transação = confirmada | pendente | cancelada)
- [ ] Documentar "fonte da verdade" para cada métrica (saldo = snapshot + delta?)
- [ ] Separar dados históricos vs presentes desde o início
- [ ] Adicionar `createdAt`, `updatedAt`, `deletedAt` em tudo

### **Importação/Parser**
- [ ] Testar com dados reais (CSV de banco, OFX, PDF com OCR)
- [ ] Adicionar logging no parser (qual linha falhou?)
- [ ] Ter fallback para data/valor ausentes
- [ ] Suportar múltiplos separadores (`,` `;` `\t`)
- [ ] Remover BOM e caracteres invisíveis
- [ ] Detectar tipo com prioridades, não com regex simples

### **Cálculos**
- [ ] Nunca somar tudo; sempre usar snapshot + delta
- [ ] Testar casos como: saldo 0, saldo negativo, transfer entre contas
- [ ] Adicionar testes de regressão para bugfix
- [ ] Log com timestamp e contexto

### **Estado UI**
- [ ] Evitar classes Tailwind dinâmicas - usar inline styles
- [ ] Expor callbacks em window se usados em HTML onclick
- [ ] Usar data-attributes + event delegation quando possível
- [ ] Testar em mobile (onde overflow/z-index são críticos)

### **Transações/Estado**
- [ ] Usar string enums em vez de boolean para status
- [ ] Nunca null + boolean = ambiguidade
- [ ] Preservar `valorOriginal` e `diferenca` para auditoria
- [ ] Registrar quem fez mudança e quando

### **Testes**
- [ ] Teste saldo com importação + delta manual
- [ ] Teste detecção de tipo com exemplos reais
- [ ] Teste parser CSV com BOM, diferentes separadores
- [ ] Teste confirmação de transação com valor diferente
- [ ] Teste transferência entre contas não dobra/Some valor

### **Deploy**
- [ ] Versionar breaking changes em Firestore (v1, v2...)
- [ ] Ter plano de migração para mudanças de schema
- [ ] Logar todas as agregações críticas para debug
- [ ] Adicionar feature flags para rollout gradual

---

## 🎯 Resumo das Lições

| Área | Lição | Checklist |
|------|-------|-----------|
| **Saldo** | Snapshot + Delta, não soma tudo | [ ] Testar com importação |
| **Confirmação** | Transações antigas precisam de validação | [ ] Step 8 onboarding obrigatório |
| **Detecção Type** | Regex com prioridades, não genérico | [ ] Testar casos reais |
| **Parser** | Robusto com fallbacks | [ ] Testar BOM, separador, data nula |
| **UI** | Inline styles para dinâmico, não Tailwind | [ ] Testar overlay/modal |
| **Escape** | Sempre sanitizar HTML | [ ] Usar innerText, não innerHTML direto |
| **Estado** | String enums, nunca null-bool | [ ] Documentar todos os estados |

---

**Documento criado:** 2026-04-06  
**Próxima revisão:** Após erros no novo projeto
