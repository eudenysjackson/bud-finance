# 🏆 Tela Metas Financeiras — Documentação Técnica Completa

> Auditoria e documentação realizadas em 09/04/2026  
> Arquivos analisados: `metas.html` (213 linhas) + `js/metas.js` (556 linhas)

---

## 1. Visão Geral da Tela

A tela **Metas Financeiras** permite ao usuário criar objetivos de economia e acompanhar progresso:

- ✅ Criar metas com nome, emoji, valor alvo, valor atual inicial e prazo opcional
- ✅ Sugestões populares clicáveis (Viagem, Carro, Casa Própria, etc.)
- ✅ Emoji picker com 120 emojis organizados em grid scrollável
- ✅ Aporte com valor, data e carteira vinculada → cria transação de despesa + atualiza carteira
- ✅ Histórico de aportes por meta (subcoleção `depositos`)
- ✅ Barra de progresso com gradiente (azul→verde ao concluir) + badges de gamificação
- ✅ Cálculo dinâmico de aporte mensal necessário (baseado no prazo)
- ✅ Lembrete para metas com prazo nos próximos 30 dias
- ✅ Confetti animation ao atingir 100%
- ✅ Resumo: Metas Ativas, Total Guardado, Falta Guardar, Progresso Médio
- ✅ Feature-gate: requer plano Pro (`financialGoals`)
- ✅ Acessibilidade: modais fecham com ESC, aria-labels nos botões

**Acesso:** Via Sidebar → "Metas"  
**Dados Firestore:** `usuarios/{uid}/metas/{metaId}`, `usuarios/{uid}/metas/{metaId}/depositos/`, `usuarios/{uid}/transacoes/`, `usuarios/{uid}/carteira/`

---

## 2. Estrutura de Dados (Firestore)

### Meta (`usuarios/{uid}/metas/{metaId}`):

```javascript
{
  nome: 'Viagem para Europa',
  icon: '✈️',
  valorAlvo: 15000,          // objetivo total (R$)
  valorAtual: 3500,          // quanto já guardou (R$)
  prazo: '2026-12-15',       // data limite (ISO, opcional)
  criadoEm: Timestamp,
  atualizadoEm: Timestamp
}
```

### Depósito (subcoleção `usuarios/{uid}/metas/{metaId}/depositos/{depId}`):

```javascript
{
  valor: 500,                 // valor do aporte
  data: Timestamp,            // serverTimestamp (NÃO é a data escolhida pelo usuário)
  valorAcumulado: 4000,       // snapshot do saldo após aporte
  carteiraId: 'abc123',       // referência à carteira
  carteiraNome: 'Nubank'      // nome da carteira na hora do aporte
}
```

### Transação vinculada (`usuarios/{uid}/transacoes/{txId}`):

```javascript
{
  tipo: 'despesa',
  descricao: 'Aporte: Viagem para Europa',
  valor: 500,
  categoria: 'Metas',
  conta: 'Nubank',
  carteiraId: 'abc123',
  origem: 'meta',
  metaId: 'metaXyz',
  dataReferencia: '2026-04-08',  // data escolhida pelo usuário
  pago: true,
  confirmado: true
}
```

---

## 3. Fluxo Completo

### Criar Meta

```
+ Nova Meta → abrirModal()
├─ Sugestões populares (10 chips clicáveis: Viagem, Carro, Casa, etc.)
├─ Nome (texto livre)
├─ Emoji picker (120 emojis em grid, seleção visual com highlight azul)
├─ Valor da Meta (R$) — com máscara de moeda BR
├─ Já Guardado (R$) — opcional, para metas pré-existentes
├─ Data Limite (date picker, opcional)
└─ Submit → addDoc em usuarios/{uid}/metas/
```

### Aporte (Depositar)

```
💰 Depositar → abrirDeposito(meta)
├─ Valor (R$) — máscara de moeda
├─ Data — pré-preenchida com hoje
├─ Pago com — dropdown de carteiras (sem crédito separado)
└─ Confirmar Aporte → confirmarDeposito()
    ├─ 1. updateDoc meta → valorAtual += valor
    ├─ 2. addDoc depositos → registro no histórico
    ├─ 3. addDoc transacoes → despesa tipo 'meta'
    ├─ 4. updateDoc carteira → saldo -= valor (ou faturaAtual += valor)
    └─ 5. Se atingiu 100% → launchConfetti() 🎊
```

### Histórico de Aportes

```
📋 Histórico → abrirHistorico(metaId, metaNome)
├─ getDocs(depositos, orderBy('data', 'desc'))
├─ Lista: data + valor + valor acumulado
└─ Estado vazio com ilustração
```

### Excluir Meta

```
🗑️ Excluir → excluirMeta(id)
├─ Confirmação modal
├─ deleteDoc meta (apenas o doc pai)
└─ ⚠️ NÃO exclui subcoleção depositos nem transações vinculadas
```

---

## 4. Gamificação

### Badges por Progresso

| Faixa | Emoji | Label | Cor |
|-------|-------|-------|-----|
| 0-24% | 🌱 | Começando | emerald |
| 25-49% | 🔥 | No caminho | orange |
| 50-74% | ⭐ | Metade! | blue |
| 75-99% | 🚀 | Quase lá! | purple |
| 100% | 🏆 | Conquistada! | amber |

### Confetti

50 peças coloridas com animação CSS `confettiDrop` (3s, caem do topo). Disparado apenas na **primeira vez** que `valorAtual >= valorAlvo` (verifica `atingiu100`).

### Aporte Mensal Sugerido

Se a meta tem prazo e não está concluída:
```
mesesRestantes = max(1, ceil(diasRestantes / 30))
aporteMensal = falta / mesesRestantes
```
Exibido em card amber: "🎯 Para atingir no prazo, aporte R$ X/mês"

---

## 5. Resumo Superior (4 Cards)

| Card | Cálculo |
|------|---------|
| Metas Ativas | `metas.length` (inclui concluídas!) |
| Total Guardado | `Σ valorAtual` de todas as metas |
| Falta Guardar | `max(0, Σ valorAlvo - Σ valorAtual)` |
| Progresso Médio | `Σ min(100, perc) / metas.length` (cap em 100% por meta) |

---

## 6. Bugs, Incoerências e Sugestões

---

### 🔴 BUG 1 — `excluirMeta()` não exclui subcoleção `depositos` (dados órfãos no Firestore)

**Localização:** `js/metas.js` linha ~353

```javascript
if (ok) {
    await deleteDoc(doc(db, "usuarios", currentUser.uid, "metas", id));
    // BUG: subcoleção 'depositos' continua existindo no Firestore
    // Firestore NÃO exclui subcoleções automaticamente ao deletar o doc pai
}
```

**Impacto:**
- Cada aporte registrado permanece em `metas/{metaId}/depositos/` para sempre
- Dados órfãos consomem armazenamento do Firestore sem possibilidade de acesso via UI
- Se o ID da meta for reutilizado (teórico), histórico do antigo dono aparece para o novo
- Acúmulo de lixo ao longo do tempo: usuário ativo que cria/exclui metas frequentemente

**🔧 SOLUÇÃO:** Excluir a subcoleção antes do doc pai:

```javascript
if (ok) {
    // Excluir subcoleção depositos primeiro
    const deposSnap = await getDocs(collection(db, "usuarios", currentUser.uid, "metas", id, "depositos"));
    const batch = writeBatch(db);
    deposSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, "usuarios", currentUser.uid, "metas", id));
    await batch.commit();
}
```

---

### 🔴 BUG 2 — `excluirMeta()` não exclui as transações vinculadas (despesas fantasma)

**Localização:** `js/metas.js` linha ~353

Ao excluir uma meta, as transações criadas em `confirmarDeposito()` com `origem: 'meta'` e `metaId: id` continuam na coleção de transações.

**Impacto:**
- A meta "Viagem" é excluída, mas o extrato continua mostrando "Aporte: Viagem" como despesa
- Saldo da carteira já foi decrementado (passo 4 do aporte) — se a meta é excluída, o dinheiro "desaparece" sem rastro
- Distorce o balanço mensal: despesas de aportes de metas excluídas continuam contando
- O usuário precisaria excluir manualmente cada transação de aporte do extrato

**🔧 SOLUÇÃO:** Oferecer opção "Manter aportes como gastos no extrato?" ou excluí-los junto:

```javascript
// Excluir transações de aporte vinculadas
const txSnap = await getDocs(query(
    collection(db, "usuarios", currentUser.uid, "transacoes"),
    where('metaId', '==', id),
    where('origem', '==', 'meta')
));
txSnap.forEach(d => batch.delete(d.ref));
```

---

### 🔴 BUG 3 — `excluirMeta()` overlay com classes Tailwind dinâmicas (`bg-black/40`, `z-[9999]`)

**Localização:** `js/metas.js` linha ~344

```javascript
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```

**Impacto:** Idêntico ao Bug #3 de `limites.js` — classes arbitrárias `bg-black/40`, `z-[9999]` não existem no build estático do Tailwind. O overlay de confirmação de exclusão aparece sem fundo escuro e sem z-index correto (pode ficar atrás do conteúdo).

**🔧 SOLUÇÃO:** Usar style inline:

```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 BUG 4 — Aporte não é atômico: 4 escritas sequenciais sem transação (dados inconsistentes em falha parcial)

**Localização:** `js/metas.js` linhas ~226-267

```javascript
// 1. updateDoc meta.valorAtual
await updateDoc(doc(db, ..., "metas", id), { valorAtual: novoValor });
// 2. addDoc depositos
await addDoc(collection(db, ..., "metas", id, "depositos"), { ... });
// 3. addDoc transacoes
await addDoc(collection(db, ..., "transacoes"), { ... });
// 4. updateDoc carteira.saldo
await updateDoc(doc(db, ..., "carteira", carteiraId), { saldo: increment(-val) });
```

**Impacto:**
- Se o passo 1 sucede e o 3 falha: meta mostra R$4.000 mas nenhuma transação registrada
- Se 1+2+3 sucedem e 4 falha: meta e extrato certos, mas saldo da carteira não foi reduzido
- Operações 2 e 3 são `addDoc` (não podem ser em `writeBatch` com subcoleções) — mas 1 e 4 poderiam ser em batch
- Sem rollback: usuário fica com dados inconsistentes sem saber

**🔧 SOLUÇÃO:** Usar `writeBatch` para as operações que aceitam (1, 3, 4) e pelo menos logar/alertar se a operação 2 falhar:

```javascript
const batch = writeBatch(db);
// 1. meta
batch.update(doc(db, "usuarios", uid, "metas", id), { valorAtual: novoValor, atualizadoEm: serverTimestamp() });
// 3. transação
const txRef = doc(collection(db, "usuarios", uid, "transacoes"));
batch.set(txRef, { ... });
// 4. carteira
batch.update(doc(db, "usuarios", uid, "carteira", carteiraId), { saldo: increment(-val) });
await batch.commit();

// 2. depósito (subcoleção — não entra em batch com docs de collection groups diferente)
await addDoc(collection(db, "usuarios", uid, "metas", id, "depositos"), { ... });
```

---

### 🟡 BUG 5 — Depósito salva `data: serverTimestamp()` mas deveria usar a data escolhida pelo usuário

**Localização:** `js/metas.js` linha ~241

```javascript
await addDoc(collection(db, ..., "depositos"), {
    valor: val,
    data: serverTimestamp(),          // ← BUG: ignora a data do input
    valorAcumulado: novoValor,
    carteiraId: carteiraId || null,
    carteiraNome: itemCarteira?.nome || ''
});
```

O modal tem input `#depositoData` com data escolhida pelo usuário (pré-preenchida com hoje), usada na transação (`dataReferencia: dataAporte`). Mas o depósito usa `serverTimestamp()`.

**Impacto:**
- No histórico de aportes, a data exibida é a data do servidor (UTC), não a que o usuário escolheu
- Se o usuário registra um aporte retroativo (ex: "fiz esse depósito dia 01/03"), o histórico mostra a data de hoje
- Inconsistência: transação mostra data correta, mas histórico do aporte mostra data diferente

**🔧 SOLUÇÃO:** Salvar a data do input no depósito:

```javascript
await addDoc(collection(db, ..., "depositos"), {
    valor: val,
    data: dataAporte,                 // data escolhida pelo usuário (YYYY-MM-DD)
    dataCriacao: serverTimestamp(),    // quando foi registrado (auditoria)
    valorAcumulado: novoValor,
    carteiraId: carteiraId || null,
    carteiraNome: itemCarteira?.nome || ''
});
```

E no `abrirHistorico`, ajustar a exibição para strings ISO em vez de `.toDate()`.

---

### 🟡 BUG 6 — `confirmarDeposito` não valida seleção de carteira (permite `carteiraId = ""`)

**Localização:** `js/metas.js` linha ~226

```javascript
const carteiraId = document.getElementById('depositoCarteira').value;
// Sem validação — permite '' (select em "Selecione...")
// ...
const itemCarteira = carteiraGlobal.find(i => i.id === carteiraId);
// itemCarteira = undefined quando carteiraId = ''
```

**Impacto:**
- Transação criada com `carteiraId: null`, `conta: ''`, `carteiraNome: ''`, `formaPagamento: 'Outro'`
- Nenhuma carteira é debitada (passo 4 é `if (itemCarteira)` — false)
- Dinheiro "sai" da meta mas não sai de nenhuma conta
- Dashboard e extrato mostram transação sem origem de pagamento
- No dropdown, "Selecione..." é a opção default — facilíssimo esquecer

**🔧 SOLUÇÃO:** Validar antes de prosseguir:

```javascript
if (!carteiraId) return window.budShowToast('Selecione de qual conta/carteira sai o dinheiro.', 'warning');
```

---

### 🟡 BUG 7 — "Metas Ativas" conta metas concluídas — nome do card é enganoso

**Localização:** `js/metas.js` linha ~377

```javascript
document.getElementById('totalMetas').innerText = metas.length;
// Inclui metas com perc >= 100%
```

**Impacto:**
- Usuário com 5 metas (3 ativas + 2 concluídas) vê "Metas Ativas: 5"
- O `length` conta todas as metas, independente do progresso
- "Falta Guardar" pode mostrar R$0 mas "Metas Ativas" mostra 5 — contraditório

**🔧 SOLUÇÃO:** Separar contagem:

```javascript
const ativas = metas.filter(m => m.valorAlvo > 0 && (m.valorAtual || 0) < m.valorAlvo);
document.getElementById('totalMetas').innerText = ativas.length;
// Ou mudar o label para "Total de Metas"
```

---

### 🟡 BUG 8 — `formMeta` submit sem `try/catch` — erro de rede = modal fecha sem salvar

**Localização:** `js/metas.js` linha ~335

```javascript
document.getElementById('formMeta').addEventListener('submit', async e => {
    e.preventDefault();
    // ... dados ...
    if (id) await updateDoc(...); // Sem try/catch
    else await addDoc(...);       // Sem try/catch
    fecharModal();               // Fecha mesmo se deu erro
});
```

**Impacto:**
- Se o Firestore estiver offline ou rate-limited, o `await addDoc` rejeita
- `fecharModal()` nunca executa (Promise rejeitada), mas o usuário pensa que deu certo porque nenhum toast de erro aparece
- Nenhum feedback visual — operação simplesmente "some"

**🔧 SOLUÇÃO:**

```javascript
try {
    if (id) await updateDoc(...);
    else await addDoc(...);
    fecharModal();
    window.budShowToast('Meta salva!');
} catch (err) {
    console.error('Erro ao salvar meta:', err);
    window.budShowToast('Erro ao salvar. Verifique sua conexão.', 'error');
}
```

---

### 🟡 BUG 9 — Editar meta via modal permite alterar `valorAtual` diretamente (bypass do histórico de aportes)

**Localização:** `js/metas.js` linha ~339

```javascript
const dados = {
    nome: ...,
    valorAlvo: parseMoeda(document.getElementById('metaValorAlvo').value),
    valorAtual: parseMoeda(document.getElementById('metaValorAtual').value), // ← editável!
    // ...
};
```

E o modal em `abrirModal(meta)` (linha ~176):
```javascript
document.getElementById('metaValorAtual').value = formatarParaInput(meta.valorAtual || 0);
```

**Impacto:**
- O campo "Já Guardado" é editável tanto na criação quanto na edição
- Ao editar, o usuário pode mudar de R$3.000 para R$10.000 diretamente — sem criar depósito
- O histórico de aportes fica inconsistente (mostra R$3.000 acumulados, mas meta mostra R$10.000)
- Nenhuma transação é criada nem carteira ajustada
- Pode ser intencional para ajuste manual, mas invalida a auditoria do histórico

**🔧 SOLUÇÃO (opção A — restringir na edição):**

```javascript
// Ao abrir modal para edição, desabilitar campo valorAtual:
if (meta) {
    document.getElementById('metaValorAtual').disabled = true;
    document.getElementById('metaValorAtual').title = 'Use "Depositar" para alterar o valor guardado';
}
```

**🔧 SOLUÇÃO (opção B — registrar a diferença como "ajuste"):**

```javascript
// No submit, se valorAtual mudou e estamos editando:
const diff = dados.valorAtual - (meta.valorAtual || 0);
if (diff !== 0) {
    await addDoc(collection(db, ..., "depositos"), {
        valor: diff,
        data: serverTimestamp(),
        valorAcumulado: dados.valorAtual,
        carteiraId: null,
        carteiraNome: 'Ajuste manual'
    });
}
```

---

### 🟡 BUG 10 — Aporte mensal sugerido usa `ceil(dias/30)` que é impreciso

**Localização:** `js/metas.js` linha ~432

```javascript
const mesesRestantes = Math.max(1, Math.ceil(diffDias / 30));
const aporteMensal = falta / mesesRestantes;
```

**Impacto:**
- 31 dias restantes → `ceil(31/30) = 2 meses` → aporte parece metade do que deveria ser
- 60 dias restantes → `ceil(60/30) = 2 meses` (correto)
- 59 dias restantes → `ceil(59/30) = 2 meses` → 2 meses para 59 dias é ok
- 29 dias → `ceil(29/30) = 1 mês` → aporte = falta inteira, mostrando "aporte R$15.000/mês" pode assustar

Para metas de curto prazo (<30 dias), a sugestão pode ser confusa (aporte mensal de R$15.000 para algo que vence em 2 semanas).

**🔧 SOLUÇÃO:** Para prazos < 30 dias, calcular em dias/semanas:

```javascript
if (diffDias <= 7) {
    aporteHTML = `<p>Faltam ${diffDias} dias — aporte o restante: ${fmt(falta)}</p>`;
} else if (diffDias <= 30) {
    const aporteSemanal = falta / Math.ceil(diffDias / 7);
    aporteHTML = `<p>Aporte ~${fmt(aporteSemanal)}/semana</p>`;
} else {
    const mesesRestantes = Math.ceil(diffDias / 30.44); // média real de dias/mês
    const aporteMensal = falta / mesesRestantes;
    aporteHTML = `<p>Aporte ~${fmt(aporteMensal)}/mês</p>`;
}
```

---

### 🟡 BUG 11 — Aporte em cartão de crédito para meta é conceitualmente errado

**Localização:** `js/metas.js` linhas ~56 e ~260

```javascript
// Dropdown inclui cartões de crédito
if (creditos.length > 0) {
    html += '<option disabled>── Cartões de Crédito ──</option>';
    creditos.forEach(i => { html += `<option value="${escapeHTML(i.id)}">💳 ${escapeHTML(i.nome)}</option>`; });
}

// Se cartão: faturaAtual += val, limiteDisponivel -= val
if (itemCarteira.tipo === 'credito') {
    await updateDoc(..., { faturaAtual: increment(val), limiteDisponivel: increment(-val) });
}
```

**Impacto:**
- "Guardar dinheiro" usando cartão de crédito é incoerente — está gerando dívida, não poupando
- A fatura do cartão aumenta, o limite disponível diminui
- A meta mostra "R$500 guardados" mas na realidade é uma despesa parcelada no crédito
- Distorce o conceito de poupança/meta — está financiando a meta com crédito

**🔧 SOLUÇÃO:** Remover cartões de crédito do dropdown de aporte para metas:

```javascript
function popularDropdownCarteira() {
    const sel = document.getElementById('depositoCarteira');
    const contasDisponiveis = carteiraGlobal.filter(i => i.tipo !== 'credito');
    // ... popular apenas com contasDisponiveis
}
```

---

### 🟡 BUG 12 — Emojis duplicados no grid: `🏠` aparece 3× na lista

**Localização:** `js/metas.js` linhas ~83-90

```javascript
const emojis = [
    '✈️','🚗','🏠', ...  // posição 3
    '🏢','🚀', ...
    '🏠','🛒', ...        // posição ~37 (duplicado)
    ...
    '🏡','🛏️','🚿', ...
    '🏠'                   // posição ~120 (triplicado)
];
```

**Impacto:** Na grid de emojis do modal, 🏠 aparece 3 vezes. Ao clicar em qualquer um, `selected` é aplicado corretamente no clicado, mas os outros dois ficam sem highlight. Esteticamente confuso.

**🔧 SOLUÇÃO:** Remover duplicatas:

```javascript
const emojis = [...new Set([
    '✈️','🚗','🏠','📱','💻', ...
])];
```

---

### 🟢 BUG 13 — `metaValorAlvo` aceita zero ou negativo — meta sem sentido

**Localização:** `js/metas.js` linha ~335

```javascript
const dados = {
    valorAlvo: parseMoeda(document.getElementById('metaValorAlvo').value),
    // Sem validação de > 0
};
```

**Impacto:**
- Meta com `valorAlvo: 0` → divisão por zero em `perc = valorAtual / valorAlvo * 100` → `Infinity%` ou `NaN%`
- Badge mostra "🏆 Conquistada!" imediatamente (perc >= 100 = true para NaN? Não, `NaN >= 100 = false`, mostra "🌱 Começando" — mas `Infinity >= 100 = true`)
- `falta = max(0, 0 - valorAtual)` → falta mostra R$0
- Meta com valor zero gera card visual confuso, barra vazia

**🔧 SOLUÇÃO:**

```javascript
if (dados.valorAlvo <= 0) {
    window.budShowToast('Informe um valor maior que zero para a meta.', 'warning');
    return;
}
```

---

### 🟢 BUG 14 — `abrirHistorico()` usa `getDocs` (leitura única, não tempo real)

**Localização:** `js/metas.js` linha ~281

```javascript
const snap = await getDocs(q);
```

**Impacto:**
- Se o usuário faz um aporte e depois abre o histórico, o novo aporte aparece (getDocs lê do servidor)
- Porém, se outra aba/dispositivo faz um aporte, o histórico não atualiza em tempo real
- Consistente com pattern de modais (abre, lê, fecha), mas difere do resto do app que usa `onSnapshot`
- Baixo impacto: histórico é read-only e aberto sob demanda

**🔧 SOLUÇÃO:** Ok como está. Se quiser consistência total, usar `onSnapshot` com unsubscribe no fecharHistorico.

---

### 🟢 BUG 15 — `fmt()` sem null-check — crash se `v` for undefined

**Localização:** `js/metas.js` linha ~13

```javascript
const fmt = v => valoresOcultos ? 'R$ •••••' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

**Impacto:** Se `dep.valor` ou `dep.valorAcumulado` for undefined no histórico, `fmt(undefined)` → TypeError.

**🔧 SOLUÇÃO:**

```javascript
const fmt = v => valoresOcultos ? 'R$ •••••' : (v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

---

### 🟢 BUG 16 — Sugestões populares exibidas mesmo ao editar meta existente? Não — mas checar

**Localização:** `js/metas.js` linha ~180

```javascript
if (meta) {
    sugestoesDiv.classList.add('hidden'); // OK — esconde ao editar
} else {
    sugestoesDiv.classList.remove('hidden'); // mostra ao criar
}
```

Na verdade está correto: sugestões são escondidas na edição. ✅ Não é bug.

---

### 🟢 BUG 17 — Feature-gate busca `document.querySelector('main .p-4')` que pode não existir em breakpoints diferentes

**Localização:** `js/metas.js` linha ~530

```javascript
var mainContent = document.querySelector('main .p-4') || document.querySelector('main .p-6');
```

O HTML usa `class="p-4 md:p-8"`, então `.p-4` existe no DOM (Tailwind usa classes estáticas, não muda por breakpoint). Mas `.p-6` não existe em nenhum lugar do HTML.

**Impacto:** Funciona na prática porque `.p-4` sempre existe. O fallback `.p-6` é código morto.

**🔧 SOLUÇÃO:** Remover o fallback desnecessário, ou usar um ID/data-attribute mais robusto:

```html
<div id="mainContent" class="p-4 md:p-8 ...">
```

---

## 7. Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)

- [ ] **Bug #1** — `excluirMeta()`: excluir subcoleção `depositos` antes do doc pai
- [ ] **Bug #2** — `excluirMeta()`: excluir/desassociar transações com `metaId` vinculado
- [ ] **Bug #3** — Overlay de exclusão: usar `style.cssText` inline (classes dinâmicas não existem no build)
- [ ] **Bug #4** — `confirmarDeposito`: usar `writeBatch` para atomicidade (meta + transação + carteira)

### 🟡 Médio (próximo sprint)

- [ ] **Bug #5** — Depósito: salvar data do input (não `serverTimestamp`) no histórico
- [ ] **Bug #6** — Validar seleção de carteira (não permitir "Selecione...")
- [ ] **Bug #7** — "Metas Ativas": excluir metas concluídas da contagem
- [ ] **Bug #8** — `formMeta` submit: adicionar `try/catch` com toast de erro
- [ ] **Bug #9** — Edição de meta: impedir/registrar alteração direta do valorAtual
- [ ] **Bug #10** — Aporte mensal sugerido: usar `30.44` dias/mês e ajustar para prazos curtos
- [ ] **Bug #11** — Remover cartões de crédito do dropdown de aporte (incoerência conceitual)
- [ ] **Bug #12** — Emojis duplicados: filtrar com `new Set()`

### 🟢 Leve (melhorias futuras)

- [ ] **Bug #13** — Validar `valorAlvo > 0` antes de salvar meta
- [ ] **Bug #14** — Histórico com `getDocs` (ok, mas pode virar `onSnapshot` para consistência)
- [ ] **Bug #15** — Null-check no `fmt()`: `(v || 0).toLocaleString(...)`
- [ ] **Bug #17** — Feature-gate: usar ID em vez de `querySelector('.p-4')`

---

## 8. Métricas da Auditoria

| Métrica | Valor |
|---------|-------|
| Linhas analisadas | 769 (213 HTML + 556 JS) |
| Bugs encontrados | 16 (Bug #16 era falso positivo, mantido como nota) |
| 🔴 Críticos | 4 |
| 🟡 Médios | 8 |
| 🟢 Leves | 4 |
| Bugs de integridade de dados | 5 (Bug #1, #2, #4, #5, #9) |
| Bugs visuais (build estático) | 1 (Bug #3) |
| Bugs de UX/conceitual | 3 (Bug #7, #11, #12) |

---

## 9. Pontos Positivos (O Que Funciona Bem)

- ✅ Sistema de aportes completo: meta + histórico + transação + carteira (4 etapas)
- ✅ `confirmarDeposito()` tem `try/catch` (único módulo analisado com error handling no aporte)
- ✅ Gamificação rica: badges, confetti, cálculo de aporte mensal, lembrete 30 dias
- ✅ Detecção de "atingiu 100% pela primeira vez" (`atingiu100`) evita confetti repetido
- ✅ Acessibilidade: `role="dialog"`, `aria-label`, `aria-labelledby`, fechar com ESC, `role="progressbar"`
- ✅ Event delegation no container de metas (evita criar N listeners por card)
- ✅ `escapeHTML()` aplicado consistentemente em nome da meta e dados do histórico
- ✅ Máscara de moeda BR aplicada nos 3 inputs de valor (dinâmica, em tempo real)
- ✅ Sugestões populares: UX excelente de onboarding (chips clicáveis preenchem nome + emoji)
- ✅ `parseMoeda()` robusta: remove pontos de milhar e converte vírgula decimal
- ✅ Feature-gate com UI dedicada (Pro plan) e redirect para configurações
