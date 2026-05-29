# ✅ ~~Tela Importar Transações~~ — CANCELADO (implementado dentro de `carteira.html`)

> ~~Auditoria e documentação realizadas em 09/04/2026~~
> **18/05/2026 — `importar.html` standalone cancelado.** A funcionalidade de importação (CSV, OFX, PDF, imagem via IA) foi implementada diretamente em `carteira.html` + `js/carteira.js` como modal por conta. Ver `carteira-importar.md` para documentação final.
> ~~Arquivos analisados: `importar.html` (175 linhas) + `js/importar.js` (909 linhas) + `cérebro/carteira-importar.md`~~

---

## 1. Visão Geral da Tela

A tela **Importar Transações** permite ao usuário sincronizar extratos bancários com o app, suportando:

- ✅ Upload de arquivos CSV, OFX/QFX, TXT (parseamento client-side, instantâneo)
- ✅ Upload de PDF e imagens (OCR via backend IA — Render.com)
- ✅ Parseamento Nubank e Inter com limpeza específica de formatos proprietários
- ✅ Autodetecção de tipo (receita/despesa) por keywords na descrição
- ✅ Autocategorização inteligente por palavras-chave no nome do comerciante
- ✅ Detecção e marcação de possíveis duplicatas antes da importação
- ✅ Preview editável (50 linhas) com ajuste por linha de tipo e categoria
- ✅ Overrides globais de tipo e categoria para todo o lote
- ✅ `writeBatch` em chunks de 400 (abaixo do limite de 500 do Firestore)
- ✅ Atualização automática do saldo da carteira vinculada após importação

**Acesso:** Via Sidebar → "Importar"  
**Dados Firestore:** `usuarios/{uid}/transacoes/{txId}`, `usuarios/{uid}/carteira/{carteiraId}`  
**Backend externo:** `https://nexo-backend-4kmu.onrender.com/api/extrair-fatura`

---

## 2. Estrutura de Dados (Firestore)

Cada transação importada é salva em `usuarios/{uid}/transacoes/{txId}`:

```javascript
{
  // Tipo/valor
  tipo: 'despesa',              // 'receita' | 'despesa' (NUNCA outro valor)
  valor: 200.00,                // sempre positivo (Math.abs aplicado)
  descricao: 'Mercado Carrefour',
  categoria: 'Mercado',

  // Carteira vinculada
  conta: 'Nubank',              // itemCarteira.nome
  carteiraId: 'abc123',         // ID do documento em /carteira/
  carteiraNome: 'Nubank',
  carteiraTipo: 'debito',       // tipo da carteira (dinheiro, debito, credito, etc.)
  formaPagamento: 'Débito',     // string amigável (mapaFormaPag)

  // Datas
  dataReferencia: '2026-04-05', // YYYY-MM-DD
  dataCriacao: Timestamp,

  // Flags de importação
  origem: 'importacao',         // sempre este valor fixo
  pago: true,                   // sempre true
  confirmado: true,             // sempre true
  pagamentoFatura: false        // sempre false
}
```

Carteira vinculada (`usuarios/{uid}/carteira/{carteiraId}`) — campos atualizados após importação:

```javascript
// Conta bancária (debito, dinheiro, etc.)
{ saldo: increment(totalReceitas - totalDespesas), atualizadoEm: ... }

// Cartão de crédito
{ faturaAtual: increment(totalDespesas), limiteDisponivel: increment(-totalDespesas), atualizadoEm: ... }
```

---

## 3. Fluxo Completo (4 Passos Sequenciais)

### Passo 1 — Upload do Arquivo (`processFile`)

```
Usuário arrasta ou clica → processFile(file)
├─ Valida: tamanho ≤ 10MB, extensão permitida
├─ CSV/OFX/QFX/TXT → parseCSV() ou parseOFX() (client-side, instantâneo)
│   └─ Se retornar null → cai no backend IA
└─ PDF/Imagem → backend IA (POST /api/extrair-fatura)
    ├─ Envia: arquivo + instrucoes (string formatada)
    ├─ Recebe: array de transações
    └─ Marca _fromAI = true em cada item
↓
mapearTransacoes(transacoes)
├─ Normaliza datas → YYYY-MM-DD
├─ Normaliza valores → float positivo
├─ Detecta tipo → receita | despesa (via detectarTipo)
├─ Detecta categoria → string (via detectarCategoria)
└─ Filtra valor == 0
↓
Mostra #fileInfo (nome + contagem) + #carteiraSection
```

### Passo 2 — Vincular à Carteira

```
popularSelectCarteira()
├─ Filtra: contas (tipo ≠ 'credito') agrupadas em optgroup
├─ Filtra: cartões de crédito em optgroup separado
└─ Pré-seleciona carteira marcada como padrão (i.padrao === true)

confirmarCarteira()
├─ Valida seleção (mostra toast se nenhuma)
├─ Salva carteiraVinculadaId
├─ Atualiza badge #carteiraVinculadaBadge
└─ Chama renderPreview()
```

### Passo 3 — Revisão e Edição (Preview)

```
renderPreview()
├─ Renderiza apenas as 50 primeiras linhas (parsedRows.slice(0,50))
├─ Cada linha: Data | Descrição | Tipo (toggle) | Valor | Categoria (dropdown)
├─ Toggle de tipo inverte receita↔despesa e reseta categoria
└─ Nota "... e mais N transações" para lotes > 50

Dropdowns globais:
├─ Tipo global: auto (re-detecta), tudo despesa, tudo receita
└─ Categoria global: Manter da IA | qualquer categoria

Dropdown por linha:
└─ Categorias filtradas pelo tipo da linha (todasCategorias(tipo))
```

### Passo 4 — Importação (`importarTransacoes`)

```
importarTransacoes()
├─ Verifica plano (canUseFeature 'importTransactions')
├─ Verifica carteiraVinculadaId
├─ [DETECÇÃO DE DUPLICATAS]
│   ├─ getDocs(collection transacoes) — TODOS os docs sem filtro
│   ├─ Filtra em memória: apenas meses presentes no lote
│   ├─ Compara: mesma data + mesmo valor (±0.02)
│   └─ Modal: "Pular duplicatas" ou "Importar todas"
├─ chunk em lotes de 400
├─ writeBatch × N batches (aguarda sequencialmente)
├─ updateDoc carteira (saldo ou faturaAtual/limiteDisponivel)
└─ Mostra #resultSection com link para extrato.html
```

---

## 4. Parsers Client-Side

### `parseCSV(text)`

- Remove BOM UTF-8/UTF-16 (`\uFEFF`)
- Limite: `MAX_CSV_ROWS = 10000` — retorna null e mostra toast se excedido
- Auto-detecta separador: tab > ponto-e-vírgula > vírgula
- Normaliza nomes de colunas: lowercase + NFD + remove acentos
- Colunas mapeadas:
  - `data` / `date`
  - `valor` / `amount` / `value`
  - `descricao` / `description` / `title` / `memo` / `identificador`
  - `categoria` / `category` (opcional)
- Parser custom para campos entre aspas (suporta separador dentro do valor)
- Retorna `null` se não encontrar colunas `data` E `valor`

### `parseOFX(text)`

- Detecta cartão de crédito: `<CREDITCARDMSGSRSV1>` ou `<CCSTMTRS>`
- Bloco `<STMTTRN>...</STMTTRN>` com regex que suporta OFX sem tags de fechamento
- Limpeza Caixa Econômica: remove prefixo `HH:MM:SS NNNNNN [—]` do MEMO
- Inter PIX: se MEMO = `"Pix enviado/recebido: ..."` → usa NAME (mais limpo)
- `tipoHint` por TRNTYPE:
  - `CREDIT` → `'receita'` (ou `'despesa'` no cartão de crédito)
  - `DEBIT` / `PAYMENT` / `CHECK` → `'despesa'`
  - `OTHER` → sinal do valor
- Flag `isPix` para PIX em conta bancária (força categoria `'Transferência'`)

---

## 5. Funções de Detecção

### `detectarTipo(desc)`

Ordem de verificação:

1. **Padrões Nubank** (strings exatas, case-insensitive normalizado):
   - `transferência recebida` → `'receita'`
   - `transferência enviada` / `enviada pelo pix` → `'despesa'`
   - `pagamento de fatura` → `'despesa'`
   - `aplicação rdb/cdb` → `'despesa'`
   - `resgate rdb/cdb` → `'receita'`
   - `estorno` → `'receita'`
   - `parcela de empréstimo` → `'despesa'`
   - `crédito rotativo` → `'despesa'` (evita falso positivo com `/\bcredito\b/`)
2. **PIX genérico**: `/^pix (?:enviado|recebido)|pix enviado|pix recebido/` → **⚠️ retorna `'Transferência'`** (BUG #1)
3. **20 regexes de receita**: `/\breceb/`, `/\bcredito\b/`, `/\bestorno/`, etc.
4. **18 regexes de despesa**: `/\bpagamento\b/`, `/\bcompra\b/`, `/\bdebito\b/`, etc.
5. `null` se nenhuma regra bater

### `detectarCategoria(desc)`

1. Extrai nome do destinatário de padrões Nubank/Inter (Pix, débito, transferência)
2. `regrasGerais` (4 regras aplicadas à descrição completa):
   - Pagamento de Fatura, Investimentos, Cashback, Rendimentos/Dividendos
3. `regras` (31 categorias): matcheia no nome do destinatário extraído (ou desc inteira)
4. Fallback: se começa com `transferencia` ou `pix` → `'Transferência'`
5. `null` se nenhuma regra bater

---

## 6. Mapa de Categorias Padrão

`categsPadrao` inline no arquivo (sem fonte única compartilhada):

| Tipo | Qtd | Exemplos |
|------|-----|----------|
| Receita | 15 | Salário, Freelance, Investimentos, Cashback, Rendimentos... |
| Despesa | 52 | Mercado, Restaurante, Uber/Táxi, Farmácia, Aluguel, Netflix... |

`catEmojiMap` contém 60+ mapeamentos categoria → emoji.

---

## 7. Bugs, Incoerências e Sugestões

---

### 🔴 BUG 1 — `detectarTipo()` retorna `'Transferência'` como tipo, corrompendo Firestore

**Localização:** `js/importar.js` linha 91

```javascript
// BUG: PIX retorna string 'Transferência' — não é 'receita' nem 'despesa'
if (/^pix (?:enviado|recebido)|pix enviado|pix recebido/.test(d)) return 'Transferência';
```

Em `mapearTransacoes()`, `tipoLocal` é truthy → `tipoFinal = 'Transferência'`. Em `selectTipoGlobal('auto')` (linha ~680), `r.tipo = tipoLocal` — idem.

**Impacto:**
- Transação salva com `tipo: 'Transferência'` (valor inválido no schema)
- Dashboard, extrato e balanço mensal somam por `tipo === 'receita'` ou `'despesa'` — a transação some completamente dos cálculos de saldo
- Preview renderiza `tipoLabel = r.tipo === 'receita' ? 'Receita' : 'Despesa'` — mostra 'Despesa' para PIX recebido (errado visualmente)
- Bug silencioso: não há erro no console, a importação "funciona" mas os dados estão incorretos

**🔧 SOLUÇÃO:** PIX enviado → `'despesa'`, PIX recebido → `'receita'`. O campo `categoria` é que deve ser `'Transferência'`, não o tipo.

```javascript
// ANTES (linha 91):
if (/^pix (?:enviado|recebido)|pix enviado|pix recebido/.test(d)) return 'Transferência';

// DEPOIS — separar tipo de categoria:
if (/pix enviado/.test(d)) return 'despesa';
if (/pix recebido/.test(d)) return 'receita';
// (a categoria 'Transferência' já é forçada em mapearTransacoes via isPix ou fallback de detectarCategoria)
```

---

### 🔴 BUG 2 — Detecção de duplicatas faz full scan da coleção inteira

**Localização:** `js/importar.js` linha ~749

```javascript
// BUG: Carrega TODAS as transações do usuário sem query filter
const snapExistentes = await getDocs(collection(db, "usuarios", currentUser.uid, "transacoes"));
```

**Impacto:**
- Usuário com 5.000 transações → `getDocs` lê 5.000 documentos do Firestore
- Custo de leitura do Firestore: 5.000 reads por importação
- Latência alta + risco de timeout antes da importação começar
- Em usuários ativos, pode ultrapassar cotas do plano gratuito Firebase

**🔧 SOLUÇÃO:** Usar `query` com `where` para filtrar apenas os meses relevantes:

```javascript
// DEPOIS:
const mesesRelevantes = [...new Set(parsedRows.map(r => r.data?.slice(0,7)).filter(Boolean))];
// Firebase não suporta 'in' com array de meses de forma eficiente,
// então fazer múltiplas queries paralelas por mês:
const promises = mesesRelevantes.map(mes => {
    const inicio = mes + '-01';
    const fim = mes + '-31';
    return getDocs(query(
        collection(db, "usuarios", currentUser.uid, "transacoes"),
        where('dataReferencia', '>=', inicio),
        where('dataReferencia', '<=', fim)
    ));
});
const snaps = await Promise.all(promises);
const existentes = snaps.flatMap(s => s.docs.map(d => d.data()));
```

---

### 🔴 BUG 3 — Algoritmo de duplicata: só compara data+valor, ignora carteira e descrição

**Localização:** `js/importar.js` linha ~770

```javascript
// BUG: Falso positivo se duas transações no mesmo dia têm o mesmo valor
const isDup = existentes.some(ex =>
    ex.dataReferencia === r.data &&
    Math.abs(ex.valor - r.valor) < 0.02
);
```

**Impacto:**
- R$50 de Uber E R$50 de Mercado no mesmo dia → o segundo é bloqueado como duplicata
- Transação em Carteira A não deve bloquear importação de transação idêntica em Carteira B
- Falsos negativos: duplicata real com diferença de centavos (estorno parcial) passa

**🔧 SOLUÇÃO:** Incluir carteira e descrição (normalizada) na comparação:

```javascript
const normDesc = (s='') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,30);
const isDup = existentes.some(ex =>
    ex.dataReferencia === r.data &&
    Math.abs(ex.valor - r.valor) < 0.02 &&
    ex.carteiraId === carteiraVinculadaId &&
    normDesc(ex.descricao) === normDesc(r.descricao)
);
```

---

### 🔴 BUG 4 — `origem: 'importacao'` causa dupla contagem no saldo (conflito de schema)

**Localização:** `js/importar.js` linha ~800 e `cérebro/carteira-importar.md`

O código importa transações com `origem: 'importacao'` e **também faz** `saldo: increment(netDelta)` na carteira.

A documentação em `carteira-importar.md` descreve um sistema `ultimaConfirmacao` onde o dashboard filtra transações importadas **fora** do cálculo de saldo (para evitar dupla contagem). Mas o código salva `origem: 'importacao'` enquanto a documentação espera `'csv_importado'`, `'ofx_importado'`, `'image_importado'` — dois contratos diferentes.

**Impacto:**
- Se `dashboard.js` exclui transações com origens `'csv_importado'`/`'ofx_importado'` mas inclui `'importacao'`: as transações importadas ENTRAM no cálculo de saldo do dashboard, E o `increment(netDelta)` também atualiza o saldo → **double counting**
- O saldo exibido pode ser o dobro do real para usuários que importam extratos frequentemente

**🔧 SOLUÇÃO:** Verificar como `dashboard.js` filtra transações e alinhar o campo `origem`. A forma mais simples é remover o `increment(netDelta)` e usar apenas `ultimaConfirmacao` como documentado, OU manter o increment e garantir que o dashboard **não** some transações com `origem: 'importacao'`.

---

### 🟡 BUG 5 — Preview limitado a 50 linhas sem como revisar ou editar o restante

**Localização:** `js/importar.js` linha ~530

```javascript
body.innerHTML = parsedRows.slice(0, 50).map((r, i) => { ... }).join('');
if(parsedRows.length > 50) body.innerHTML += `<tr><td colspan="4" ...>... e mais ${parsedRows.length - 50} transações</td></tr>`;
```

**Impacto:**
- Importando 300 transações, o usuário vê apenas 50 (1/6 do lote)
- Transações mal classificadas pela IA (linha 51, 100, 200...) são importadas sem revisão possível
- Usuário não tem como corrigir tipo/categoria das transações ocultas
- A nota "e mais N" é passiva — não há botão "ver mais" ou paginação

**🔧 SOLUÇÃO:** Implementar paginação simples (25/50 por vez) na tabela de preview, permitindo navegar por todas as linhas antes de confirmar:

```javascript
let previewPage = 0;
const PAGE_SIZE = 50;

function renderPreview() {
    const total = parsedRows.length;
    const inicio = previewPage * PAGE_SIZE;
    const fim = Math.min(inicio + PAGE_SIZE, total);
    // renderiza parsedRows.slice(inicio, fim)
    // mostra controles: "← Anterior | Página X de Y | Próxima →"
}
```

---

### 🟡 BUG 6 — Contradição UX: banner diz "use Cartões" mas cartões de crédito aparecem no dropdown

**Localização:** `importar.html` (banner) + `js/importar.js` linha ~472

```javascript
// Cartões de crédito são INCLUÍDOS no dropdown
const creditos = carteiraGlobal.filter(i => i.tipo === 'credito');
// ... adicionados em optgroup '── Cartões de Crédito ──'
```

Enquanto o HTML exibe:
```html
<div class="amber">⚠️ Para faturas de cartão de crédito, vá até a aba Cartões.</div>
```

**Impacto:**
- Usuário lê o aviso e pensa que não pode importar extrato de crédito aqui
- Mas o dropdown inclui seus cartões de crédito
- Mensagem e comportamento são contraditórios

**🔧 SOLUÇÃO (opção A — retirar o aviso):** Remover o banner amber e documentar no sidebar o fluxo correto para cada formato.

**🔧 SOLUÇÃO (opção B — restringir o dropdown):** Remover cartões de crédito do `selecionarCarteira` e redirecionar para `cartoes.html` quando o arquivo parecer ser uma fatura de crédito.

---

### 🟡 BUG 7 — Cartão de crédito: receitas (estorno/cashback) ignoradas no `updateDoc`

**Localização:** `js/importar.js` linha ~815

```javascript
if (itemCarteira.tipo === 'credito') {
    if (totalDespesas > 0) {
        await updateDoc(doc(...), {
            faturaAtual: increment(totalDespesas),
            limiteDisponivel: increment(-totalDespesas)
        });
    }
    // BUG: totalReceitas é IGNORADO — estornos e cashback não ajustam fatura/limite
}
```

**Impacto:**
- Estorno de R$150 importado junto à fatura: o saldo da fatura cresce R$150 a mais do que deveria
- `limiteDisponivel` fica R$150 menor do que deveria
- Saldo do cartão fica incorreto sempre que há créditos na fatura

**🔧 SOLUÇÃO:**

```javascript
if (itemCarteira.tipo === 'credito') {
    const net = totalDespesas - totalReceitas; // reduz se há estornos
    if (net !== 0) {
        await updateDoc(doc(...), {
            faturaAtual: increment(net),
            limiteDisponivel: increment(-net),
            atualizadoEm: serverTimestamp()
        });
    }
}
```

---

### 🟡 BUG 8 — Sem timeout no fetch ao backend — spinner eterno em cold start

**Localização:** `js/importar.js` linha ~500

```javascript
const response = await fetch(BACKEND_URL + '/api/extrair-fatura', {
    method: 'POST', body: formData,
    headers: idToken ? { 'Authorization': 'Bearer ' + idToken } : {}
    // BUG: sem AbortController, sem timeout
});
```

**Impacto:**
- Backend no plano gratuito do Render.com tem cold start de até 50 segundos
- Após o cold start, o processamento da IA pode levar mais 15-30 segundos
- Spinner e mensagem "Processando com IA..." ficam indefinidamente sem feedback de progresso
- Sem forma de cancelar a operação se o servidor estiver down
- Se o servidor retornar após 90s, o usuário pode já ter saído da tela

**🔧 SOLUÇÃO:**

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos

try {
    const response = await fetch(BACKEND_URL + '/api/extrair-fatura', {
        method: 'POST', body: formData,
        headers: idToken ? { 'Authorization': 'Bearer ' + idToken } : {},
        signal: controller.signal
    });
    clearTimeout(timeoutId);
    // ...
} catch (err) {
    if (err.name === 'AbortError') {
        window.budShowToast('A IA demorou demais para responder. Tente novamente ou use CSV/OFX.', 'error');
        return;
    }
    throw err;
}
```

---

### 🟡 BUG 9 — `selectTipoGlobal('auto')` também seta `tipo: 'Transferência'` (mesma raiz do Bug #1)

**Localização:** `js/importar.js` linha ~681

```javascript
// Ao clicar "🤖 Detectar Tipo":
if (val === 'auto') {
    parsedRows.forEach(r => {
        const tipoLocal = detectarTipo(r.descricao || '');
        if (tipoLocal) {
            r.tipo = tipoLocal; // BUG: pode ser 'Transferência'
        }
    });
}
```

**Impacto:** Mesmo impacto do Bug #1 — PIX recebido aparece como 'Despesa' na preview, e é salvo como `tipo: 'Transferência'` no Firestore ao confirmar. A diferença é que esse caminho é ativado pelo clique do usuário no override global.

**🔧 SOLUÇÃO:** Mesma correção do Bug #1 (separar tipo de categoria em `detectarTipo()`). Automaticamente resolve esse bug também.

---

### 🟡 BUG 10 — `detectarCategoria()` tem 4 regras duplicadas entre `regrasGerais` e `regras`

**Localização:** `js/importar.js` linhas ~342 e ~407

```javascript
// DUPLICADAS em ambos os arrays:
{ cat: 'Pagamento de Fatura', palavras: ['pagamento de fatura'] },
{ cat: 'Investimentos', palavras: ['aplicacao rdb', 'aplicacao cdb', ...] },
{ cat: 'Cashback', palavras: ['cashback'] },
{ cat: 'Rendimentos/Dividendos', palavras: ['rendiment', 'dividend', ...] },
```

`regrasGerais` é aplicado primeiro e retorna com `return regra.cat`, então as 4 entradas em `regras` são **código morto** — nunca executadas.

**Impacto:** Nenhum impacto funcional, apenas código confuso. Se `regras` for aplicado ao `textoParaCat` (nome do destinatário extraído) e `regrasGerais` à descrição completa `d`, a lógica pode diferir para casos edge — por exemplo, um destinatário chamado "CDB Investimentos" poderia ser categorizado diferente dependendo de qual array processa.

**🔧 SOLUÇÃO:** Remover as 4 entradas duplicadas do array `regras` (mantê-las apenas em `regrasGerais`).

---

### 🟡 BUG 11 — `'vivo '` duplicado em `Internet/TV` e `Telefone` — primeira categoria sempre vence

**Localização:** `js/importar.js` linha ~366 e ~369

```javascript
{ cat: 'Internet/TV', palavras: ['claro', 'vivo fibra', 'vivo ', ...] },
{ cat: 'Telefone', palavras: ['telefone', 'celular', 'recarga', 'tim ', 'vivo ', 'oi '] },
```

**Impacto:** Qualquer gasto "vivo " (sem o sufixo "fibra") é categorizado como `Internet/TV` nunca como `Telefone`. Planos de celular Vivo são incorretamente categorizados.

**🔧 SOLUÇÃO:** Remover `'vivo '` da lista de `Internet/TV` e mantê-lo apenas em `Telefone`. Adicionar `'vivo tv'` ou `'vivo internet'` em `Internet/TV` se necessário.

---

### 🟡 BUG 12 — `'jim.com'` categorizado como `Saúde` (deveria ser `Academia/Esportes`)

**Localização:** `js/importar.js` linha ~352

```javascript
{ cat: 'Saúde', palavras: [..., 'jim.com'] },
```

Jim.com é um aplicativo de academia/fitness — não é uma clínica médica.

**🔧 SOLUÇÃO:** Mover `'jim.com'` para `Academia/Esportes`:

```javascript
{ cat: 'Academia/Esportes', palavras: ['academia', 'smart fit', 'body tech', 'crossfit', 'pilates', 'jim.com'] },
```

---

### 🟡 BUG 13 — Preview table footnote usa `colspan="4"` mas tabela tem 5 colunas

**Localização:** `js/importar.js` linha ~550

```javascript
// BUG: colspan="4" em tabela de 5 colunas (Data | Descrição | Tipo | Valor | Categoria)
body.innerHTML += `<tr><td colspan="4" class="py-3 text-center text-xs font-bold text-slate-400">... e mais ${parsedRows.length - 50} transa\u00e7\u00f5es</td></tr>`;
```

**Impacto:** A nota "... e mais X transações" não ocupa a última coluna (Categoria), quebrando a aparência visual da tabela.

**🔧 SOLUÇÃO:** `colspan="5"`.

---

### 🟡 BUG 14 — `parseCSV` retorna `null` e lança toast mas mensagem de loading é genérica para TXT

**Localização:** `js/importar.js` linha ~500

```javascript
document.getElementById('loadingMsg').innerText = 
    isImage || ext === 'pdf' 
        ? 'Processando com IA... pode levar alguns segundos' 
        : 'Processando arquivo...'; // TXT via IA aparece como "Processando arquivo..."
```

**Impacto:** Quando um arquivo `.txt` (e.g., extrato WhatsApp, log genérico) falha no `parseCSV()` e cai no backend IA, a mensagem exibida é "Processando arquivo..." — sem mencionar que IA está sendo usada. O usuário não sabe que está aguardando um servidor remoto.

**🔧 SOLUÇÃO:**

```javascript
const usandoIA = isImage || ext === 'pdf' || (!transacoes || transacoes.length === 0);
document.getElementById('loadingMsg').innerText = usandoIA 
    ? 'Processando com IA... pode levar alguns segundos' 
    : 'Processando arquivo...';
```

Ou simplesmente unificar: sempre mostrar "Processando com IA..." quando o código entrar no bloco do backend.

---

### 🟡 BUG 15 — `normalizarData()` fallback `new Date(str)` interpreta datas no formato MM/DD (americano)

**Localização:** `js/importar.js` linha ~88

```javascript
// Fallback genérico — interpreta conforme locale da engine JS (geralmente MM/DD/YYYY)
const d = new Date(str);
if (!isNaN(d)) return d.toISOString().slice(0, 10);
```

**Impacto:** Uma data como `"4/3/2026"` (que para usuário BR seria 4 de março) é interpretada como "April 3rd" (4 de abril) pela engine JavaScript. Erros silenciosos de data em transações vindas da IA com formatos não reconhecidos pelas regras anteriores.

**🔧 SOLUÇÃO:** O fallback deve ser o último recurso (já é) mas convém registrar warning:

```javascript
const d = new Date(str);
if (!isNaN(d)) {
    console.warn('[Nexo Import] normalizarData: fallback genérico para', str, '→', d.toISOString().slice(0,10), '(pode estar errado se formato BR)');
    return d.toISOString().slice(0, 10);
}
```

Ou adicionar regex para `M/D/YYYY` como formato explícito tratado corretamente no padrão brasileiro.

---

### 🟡 BUG 16 — `todasCategorias()` deduplicação é case-sensitive — exibe categorias duplicadas

**Localização:** `js/importar.js` linha ~490

```javascript
const todas = [...new Set([...personalizadas, ...padrao])];
```

**Impacto:** Usuário criou categoria personalizada `"mercado"` (minúsculo) e o padrão tem `"Mercado"` — ambas aparecem listadas. Set não deduplica strings com case diferente.

**🔧 SOLUÇÃO:**

```javascript
const vistas = new Set();
const todas = [...personalizadas, ...padrao].filter(c => {
    const key = c.toLowerCase();
    if (vistas.has(key)) return false;
    vistas.add(key);
    return true;
});
```

---

### 🟢 BUG 17 — `categsPadrao` duplicada em múltiplos arquivos (sem fonte única de verdade)

**Localização:** `js/importar.js` linhas ~26-65 vs. outros arquivos JS

`categsPadrao` com 52 despesas e 15 receitas está definida inline em `importar.js`. Se uma categoria é adicionada em `dashboard.js`, `categorias.js` ou `configuracoes.js`, ela não aparece automaticamente nas sugestões de importação.

**🔧 SOLUÇÃO:** Mover `categsPadrao` e `catEmojiMap` para `bud-utils.js` como exports globais (`window.BudCategorias`), e referenciar de todos os módulos que precisam.

---

### 🟢 BUG 18 — Correção de "anos absurdos" bloqueia dados históricos legítimos anteriores a 2020

**Localização:** `js/importar.js` linha ~305

```javascript
if (anoData < 2020 || anoData > anoAtual + 2) {
    r.data = anoAtual + '-' + partes[1] + '-' + partes[2];
    datasCorrigidas++;
}
```

**Impacto:** Qualquer extrato histórico de 2018, 2019 (dívidas, histórico bancário) tem suas datas "corrigidas" para o ano atual sem aviso. A transação fica com data errada.

**🔧 SOLUÇÃO:** Reduzir o threshold ou torná-lo configurável. Alternativa: mostrar toast informando quantas datas foram ajustadas, para que o usuário saiba:

```javascript
if (datasCorrigidas > 0) {
    window.budShowToast(`${datasCorrigidas} data(s) com ano incomum foram ajustadas para ${anoAtual}. Verifique se estão corretas.`, 'warning');
}
```

---

### 🟢 BUG 19 — Backend URL hardcoded — manutenção difícil em caso de migração

**Localização:** `js/importar.js` linha ~25

```javascript
const BACKEND_URL = 'https://nexo-backend-4kmu.onrender.com';
```

Está duplicado ou inconsistente com possíveis outros arquivos que também referenciam o backend. Uma mudança de URL requer buscar e substituir em múltiplos locais.

**🔧 SOLUÇÃO:** Definir em `firebase-config.js` ou em um `config.js` compartilhado:

```javascript
// firebase-config.js
window.NEXO_CONFIG = {
    backendUrl: 'https://nexo-backend-4kmu.onrender.com'
};
// importar.js:
const BACKEND_URL = window.NEXO_CONFIG?.backendUrl || 'https://nexo-backend-4kmu.onrender.com';
```

---

### 🟢 BUG 20 — `parseOFX` usa `file.text()` que assume UTF-8, mas bancos BR frequentemente usam ISO-8859-1

**Localização:** `js/importar.js` linha ~466

```javascript
const texto = await file.text(); // Lê como UTF-8 por padrão
transacoes = parseOFX(texto);
```

**Impacto:** OFX de Bradesco, Itaú, Caixa costumam ter encoding ISO-8859-1 (Latin-1). Acentos e cedilhas ficam corrompidos (e.g., `"PadÃ£o"` em vez de `"Padão"`). A categorização por palavras-chave falha para esses caracteres corrompidos.

**🔧 SOLUÇÃO:**

```javascript
// Detecta encoding pelo BOM ou pelo charset declarado no OFX header
async function lerComEncoding(file) {
    const buf = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buf);
    // OFX/SGML frequentemente declara: CHARSET:1252 ou CHARSET:ISO-8859-1
    if (/CHARSET:(?:1252|ISO-?8859)/i.test(utf8.slice(0, 500))) {
        return new TextDecoder('windows-1252').decode(buf);
    }
    return utf8;
}
```

---

## 8. Checklist de Correções por Prioridade

### 🔴 Crítico (corrigir imediatamente)

- [ ] **Bug #1** — `detectarTipo()`: PIX enviado → `'despesa'`, recebido → `'receita'` (nunca `'Transferência'`)
- [ ] **Bug #2** — Duplicata check: usar `query` com `where` por mês, não `getDocs` full scan
- [ ] **Bug #3** — Duplicata check: incluir `carteiraId` + descrição normalizada na comparação
- [ ] **Bug #4** — Alinhar `origem` (`'importacao'` vs `'csv_importado'`) e garantir sem double counting

### 🟡 Médio (próximo sprint)

- [ ] **Bug #5** — Preview: paginar todas as linhas (não só as 50 primeiras)
- [ ] **Bug #6** — Remover contradição banner/dropdown de cartão de crédito
- [ ] **Bug #7** — Cartão de crédito: considerar `totalReceitas` no `updateDoc` (estornos)
- [ ] **Bug #8** — Fetch backend: adicionar `AbortController` com timeout de 2 minutos
- [ ] **Bug #9** — `selectTipoGlobal('auto')`: corrigido automaticamente junto com Bug #1
- [ ] **Bug #10** — `detectarCategoria()`: remover 4 regras duplicadas de `regras`
- [ ] **Bug #11** — `'vivo '`: remover de `Internet/TV`, manter só em `Telefone`
- [ ] **Bug #12** — `'jim.com'`: mover de `Saúde` para `Academia/Esportes`
- [ ] **Bug #13** — Preview footnote: `colspan="5"` (não `colspan="4"`)
- [ ] **Bug #14** — Loading msg: sempre "Processando com IA..." quando entrar no bloco do backend
- [ ] **Bug #15** — `normalizarData()`: log de warning no fallback genérico
- [ ] **Bug #16** — `todasCategorias()`: deduplicação case-insensitive

### 🟢 Leve (melhorias futuras)

- [ ] **Bug #17** — `categsPadrao`: mover para `bud-utils.js` como fonte única
- [ ] **Bug #18** — Correção de anos: toast informativo quando datas são ajustadas
- [ ] **Bug #19** — `BACKEND_URL`: mover para config compartilhada
- [ ] **Bug #20** — OFX ISO-8859-1: adicionar `TextDecoder('windows-1252')` com detecção automática

---

## 9. Métricas da Auditoria

| Métrica | Valor |
|---------|-------|
| Linhas analisadas | 1.084 (175 HTML + 909 JS) |
| Bugs encontrados | 20 |
| 🔴 Críticos | 4 |
| 🟡 Médios | 12 |
| 🟢 Leves | 4 |
| Bugs que corrompem dados silenciosamente | 4 (Bug #1, #3, #4, #7) |
| Bugs de performance/custo | 1 (Bug #2 — full collection scan) |

---

## 10. Pontos Positivos (O Que Funciona Bem)

- ✅ `parseCSV` robusto: BOM removal, auto-detect separator, quoted fields, MAX_ROWS guard
- ✅ `parseOFX` trata casos específicos de Caixa Econômica e Inter Pix corretamente
- ✅ Fallback automático CSV→IA quando o parser local não reconhece o formato
- ✅ `writeBatch` em chunks de 400 respeita limite de 500 do Firestore
- ✅ `escapeHTML()` aplicado consistentemente em todos os dados exibidos no DOM (proteção XSS)
- ✅ Reset correto de `carteiraVinculadaId = null` ao processar novo arquivo
- ✅ `detectarCategoria()` extrai nome do destinatário antes de categorizar (evita falso positivo como "MERCADO PAGO" → Mercado)
- ✅ Nubank patterns verificados ANTES dos genéricos em `detectarTipo()` (evita false positives)
- ✅ Instruções detalhadas enviadas ao backend IA junto com o arquivo (melhora quality dos resultados)
- ✅ Chunk de lotes no `importarTransacoes` com `await` sequential (não sobrecarrega Firestore)
