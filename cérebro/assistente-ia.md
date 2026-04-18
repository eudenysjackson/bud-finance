# 🤖 Tela: Assistente IA (`assistente-ia.html` + `js/assistente-ia.js`)

## Visão Geral

Chat de inteligência artificial integrado ao **Gemini 1.5 Flash** via Cloud Function `/chat`. O usuário conversa com o "Bud" (persona IA), que recebe contexto financeiro real (transações, dívidas, metas, investimentos do mês) e responde com orientações personalizadas. Inclui sistema de **chamados** (bug/sugestão) que salva no Firestore e envia email para o suporte via EmailJS.

**Acesso restrito:** Apenas planos Plus e Trial. O bloqueio é verificado **tanto no frontend** (`canUseFeatureSafely`) **quanto no backend** (`resolveEffectivePlan`).

| Propriedade | Valor |
|---|---|
| HTML | `assistente-ia.html` (95 linhas) |
| JS | `js/assistente-ia.js` (288 linhas) |
| Backend | `functions/index.js` → `POST /chat` + `POST /chamado` |
| Script type | `type="module"` (ES modules Firebase modular) |
| Dependências frontend | `firebase-config.js`, `bud-loader.js`, `bud-utils.js`, `plan-utils.js`, `plano-config.js`, `sidebar.js`, `dark-mode.js`, `tutorial.js` |
| Modelo IA | Gemini 1.5 Flash (`gemini-1.5-flash`) |
| Rate limit chat | 30 msg/min (server-side) |
| Rate limit chamado | 5 chamados/15 min (server-side) |
| Max tokens resposta | 700 |
| Temperatura | 0.7 |
| Histórico enviado | Últimas 12 mensagens (slice -12) |
| Timeout frontend | 30 segundos |

---

## Estrutura de Dados

### Dados carregados via `onSnapshot` (real-time)

| Coleção | Limite | Variável |
|---|---|---|
| `usuarios/{uid}/transacoes` | `limit(5000)` | `transacoes[]` |
| `usuarios/{uid}/dividas` | `limit(500)` | `dividas[]` |
| `usuarios/{uid}/metas` | `limit(500)` | `metas[]` |
| `usuarios/{uid}/investimentos` | `limit(500)` | `investimentos[]` |

### Contexto enviado à IA (`buildContexto()`)

```javascript
{
  nome: string,         // usuarioDados.nome || displayName
  plano: string,        // "free" | "starter" | "pro" | "plus" | "trial"
  mesAno: string,       // ex: "abril de 2026"
  resumo: {
    receitas: number,   // soma do mês (tipo === 'receita')
    despesas: number,   // soma do mês (tipo !== 'receita')
    saldo: number,      // receitas - despesas
    topCats: string[],  // top 5 categorias com valor
    dividas: number,    // contagem
    metas: number,      // contagem
    investimentos: number // contagem
  }
}
```

### Chamado salvo em Firestore

```
Firestore → chamados/{autoId}
{
  tipo: "bug" | "sugestao",
  descricao: string,
  nomeUsuario: string,
  emailUsuario: string,
  criadoEm: "2026-04-10T...",
  status: "aberto"
}
```

---

## Estrutura HTML

```
<body> flex overflow-hidden height:100dvh
├── #mobileOverlay (backdrop sidebar mobile)
├── #sidebar-container (injetado por sidebar.js)
└── <main> flex-1 flex-col overflow-hidden
    ├── <header> h-20 bg-white sticky z-30
    │   ├── botão hamburger (mobile)
    │   ├── título "🤖 Assistente IA"
    │   └── botão "Limpar Chat"
    ├── div.flex-1 max-w-3xl mx-auto
    │   ├── #chatContainer flex-1 overflow-y-auto p-4
    │   │   └── mensagem de boas-vindas (hardcoded)
    │   │       ├── "Olá! Sou o Bud..."
    │   │       └── 5 botões de sugestão:
    │   │           ├── "📊 Meus gastos"
    │   │           ├── "💡 Dica de economia"
    │   │           ├── "💳 Como usar cartão"
    │   │           ├── "🐛 Reportar bug"
    │   │           └── "💡 Dar sugestão"
    │   └── form#chatForm border-t bg-white/80
    │       ├── input#chatInput placeholder="Pergunte sobre suas finanças..."
    │       └── button[submit] ícone avião
```

---

## CSS Custom (no `<style>`)

| Classe/Regra | Uso |
|---|---|
| `.no-scrollbar` | Esconde scrollbar (webkit + Firefox) |
| `.icon-3d` | Drop-shadow no emoji do título |
| `.glass-panel` | bg rgba + backdrop-filter blur (não usado na tela) |
| `.msg-bot` | Animação `fadeIn` 0.3s nas mensagens |
| `@keyframes fadeIn` | translate Y 8px → 0 com opacity |
| `.typing span` | Animação `blink` 1.4s nos dots de "digitando" |

---

## Fluxo Completo

### 1. Inicialização

```
1. bud-loader.js → splash, version check
2. sidebar.js → injeta sidebar
3. assistente-ia.js (module) →
   a. Inicializa Firebase modular (app, auth, db)
   b. onAuthStateChanged →
      i. getDoc(usuarios/{uid}) → dados do perfil
      ii. resolvePlanSafely() → resolve plano efetivo
      iii. Se shouldDowngrade → updateDoc (persiste downgrade)
      iv. canUseFeatureSafely('assistantIA') → se false → toast + redirect dashboard
      v. Se pode usar → carrega 4 onSnapshots (transacoes, dividas, metas, investimentos)
   c. Se !user → redirect index.html
```

### 2. Envio de Mensagem

```
1. User digita texto + submit
2. Se modoChamado.ativo && modoChamado.tipo → enviarChamado()
3. Se texto começa com "__chamado:" → iniciarChamado()
4. Senão:
   a. addMsg('user', texto escapado)
   b. enviarParaIA(texto)
      i. Push em conversaIA[]
      ii. Mostra "digitando" (typing dots)
      iii. setTimeout 30s segurança
      iv. auth.currentUser.getIdToken()
      v. fetch(BACKEND_URL/chat, { messages: últimas 12, contexto })
      vi. Remove typing, mostra resposta
   c. Se texto contém CHAMADO_KEYWORDS → após 300ms mostra botões de chamado
```

### 3. Fluxo de Chamado

```
1. Trigger: botão "Reportar bug" / "Dar sugestão" / keywords detectadas
2. addChamadoTipoButtons() ou addChamadoOfferButtons()
3. Usuário escolhe tipo (bug/sugestão) → selecionarTipoChamado()
4. modoChamado = { ativo: true, tipo }
5. Input placeholder muda para "Descreva aqui..."
6. Próximo submit → enviarChamado(tipo, descricao)
   a. fetch(BACKEND_URL/chamado) → salva Firestore + email
   b. Reset modoChamado
```

### 4. Backend Cloud Function `/chat`

```
1. Recebe POST com Bearer token
2. verifyAuth() → valida Firebase ID token
3. resolveEffectivePlan(uid) → verifica plano server-side
   ├── Se !assistantIA → 403
4. Valida messages array
5. Converte formato: user→user, assistant→model
6. buildBudSystemPrompt(contexto) → prompt enormecom contexto financeiro
7. fetch Gemini API (gemini-1.5-flash:generateContent)
8. Retorna { reply }
```

---

## Funções

| Função | Linhas | Descrição |
|---|---|---|
| `formatarMensagemIA(texto)` | 29-33 | Escape HTML + `**bold**` → `<strong>` + `\n` → `<br>` |
| `buildContexto()` | 35-50 | Monta objeto com dados financeiros do mês para a IA |
| `addMsg(from, html)` | 52-61 | Adiciona bolha de chat (user/bot) com avatar |
| `addTyping()` | 63-69 | Mostra indicador de "digitando" (3 dots) |
| `removeTyping()` | 70 | Remove indicador de digitando |
| `enviarParaIA(mensagem)` | 75-94 | Envia para Cloud Function, gerencia timeout 30s |
| `enviarChamado(tipo, descricao)` | 96-119 | Envia chamado para Cloud Function /chamado |
| `addChamadoTipoButtons()` | 121-136 | Mostra botões bug/sugestão/cancelar |
| `addChamadoOfferButtons()` | 138-155 | Mostra "Quer formalizar como chamado?" |
| `selecionarTipoChamado(tipo)` | 157-162 | Seta tipo e pede descrição |
| `cancelarChamado()` | 164-168 | Reset do modo chamado |
| `iniciarChamado(tipo)` | 170-176 | Inicia fluxo de chamado (com ou sem tipo) |
| `enviarPergunta(texto)` | 180-186 | Chamada via botões de sugestão (inclui atalho __chamado:) |
| `limparChat()` | 188-193 | Limpa conversaIA[], reset modoChamado, zera UI |
| `analisarTransacoes()` | 217 | **STUB** — retorna string vazia, legacy, nunca usado |

**Funções expostas no window:**
- `selecionarTipoChamado`, `cancelarChamado`, `iniciarChamado`, `enviarPergunta`, `limparChat`

---

## Variáveis de Estado

| Variável | Tipo | Descrição |
|---|---|---|
| `transacoes` | Array | Transações do onSnapshot (até 5000) |
| `dividas` | Array | Dívidas do onSnapshot (até 500) |
| `metas` | Array | Metas do onSnapshot (até 500) |
| `investimentos` | Array | Investimentos do onSnapshot (até 500) |
| `conversaIA` | Array | Histórico local da conversa `[{role, content}]` |
| `modoChamado` | Object | `{ativo: bool, tipo: 'bug'|'sugestao'|null}` |
| `usuarioDados` | Object | Perfil do user + email |
| `_enviando` | Boolean | Lock de envio (impede duplo submit) |
| `_unsubs` | Array | Funções de unsubscribe do onSnapshot |
| `TYPING_TIMEOUT` | Number | 30000ms — safety timeout |
| `BACKEND_URL` | String | `window.BUD_FUNCTIONS_URL` |
| `CHAMADO_KEYWORDS` | Array | 12 keywords que trigam oferta de chamado |

---

## 🔍 Bugs, Incoerências e Problemas

---

### 🔴 BUG 1 — `limit(5000)` em transações: carrega tudo sem necessidade

**Onde:** `assistente-ia.js` linha ~271

```javascript
_unsubs.push(onSnapshot(query(collection(db,"usuarios",user.uid,"transacoes"), limit(5000)), snap => {
    transacoes = snap.docs.map(d=>({...d.data(),id:d.id}));
}));
```

**Problema:** Carrega até 5000 transações em tempo real apenas para calcular o resumo do mês atual. 99% dos dados são ignorados pelo `buildContexto()` que filtra só o mês corrente.

**Impacto:** Custo Firestore absurdo (reads + bandwidth), memória do dispositivo, app lento no carregamento.

**🔧 SOLUÇÃO:**
```javascript
// Carregar só transações do mês atual com getDocs (não precisa real-time)
const agora = new Date();
const mesRef = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
const q = query(
  collection(db, "usuarios", user.uid, "transacoes"),
  where("dataReferencia", ">=", mesRef + "-01"),
  where("dataReferencia", "<=", mesRef + "-31"),
  limit(200)
);
const snap = await getDocs(q);
transacoes = snap.docs.map(d => ({ ...d.data(), id: d.id }));
```

---

### 🔴 BUG 2 — `onSnapshot` (real-time) totalmente desnecessário para um chat

**Onde:** `assistente-ia.js` linhas ~271-282

**Problema:** A tela usa `onSnapshot` (listener real-time) para transações, dívidas, metas e investimentos. Mas o chat não precisa ouvir mudanças em tempo real — o contexto só é lido uma vez quando o user envia mensagem. `getDocs()` (leitura única) bastaria.

**Impacto:** 4 listeners WebSocket abertos permanentemente enquanto o user conversa. Cada mudança em qualquer doc recarrega toda a coleção. Custo de reads exponencial.

**🔧 SOLUÇÃO:**
```javascript
// Trocar todos os onSnapshots por getDocs
const [txSnap, divSnap, metSnap, invSnap] = await Promise.all([
  getDocs(query(collection(db, "usuarios", user.uid, "transacoes"), where(/*mês atual*/), limit(200))),
  getDocs(query(collection(db, "usuarios", user.uid, "dividas"), limit(50))),
  getDocs(query(collection(db, "usuarios", user.uid, "metas"), limit(50))),
  getDocs(query(collection(db, "usuarios", user.uid, "investimentos"), limit(50)))
]);
transacoes = txSnap.docs.map(d => ({ ...d.data(), id: d.id }));
dividas = divSnap.docs.map(d => ({ ...d.data(), id: d.id }));
metas = metSnap.docs.map(d => ({ ...d.data(), id: d.id }));
investimentos = invSnap.docs.map(d => ({ ...d.data(), id: d.id }));
// Resultado: 4 reads únicos, zero listeners permanentes
```

---

### 🔴 BUG 3 — Sem controle de créditos de IA

**Onde:** `assistente-ia.js` + `functions/index.js`

**Problema:** O `plano-config.js` define `iaCreditsMonthly` por plano (free=0, starter=20, pro=120, plus=∞), mas **NINGUÉM VERIFICA**. O backend só checa `assistantIA: true/false`. Um user Plus pode enviar mensagens infinitamente sem rate-limit por créditos (apenas 30/min geral).

Mais grave: `PLAN_LIMITS` no server define:
- `starter: { assistantIA: false }` — Starter NÃO tem acesso à IA no server
- Mas o frontend `plano-config.js` diz `assistantIA: false` para Starter também

O BUG real: **ninguém consome nem rastreia os credits**. Não existe contagem de mensagens enviadas por mês.

**Impacto:** Feature de créditos é decorativa. User Plus pode gerar custos ilimitados no Gemini API. Sem controle de abuso.

**🔧 SOLUÇÃO:**
```javascript
// No backend (functions/index.js), adicionar:
// 1. Ler contagem de mensagens do mês
const mesRef = new Date().toISOString().slice(0, 7); // "2026-04"
const usageDoc = await db.collection("usuarios").doc(decoded.uid)
  .collection("ia_usage").doc(mesRef).get();
const usados = usageDoc.exists ? usageDoc.data().count : 0;

// 2. Verificar limite
if (limits.iaCreditsMonthly !== Infinity && usados >= limits.iaCreditsMonthly) {
  return res.status(429).json({ error: `Limite de ${limits.iaCreditsMonthly} mensagens/mês atingido. Faça upgrade!` });
}

// 3. Incrementar após resposta bem sucedida
await db.collection("usuarios").doc(decoded.uid)
  .collection("ia_usage").doc(mesRef)
  .set({ count: FieldValue.increment(1), updatedAt: new Date() }, { merge: true });
```

---

### 🔴 BUG 4 — Mensagem de bloqueio de plano incoerente

**Onde:** `assistente-ia.js` linha ~264

```javascript
budShowToast('Assistente IA disponível apenas nos planos Starter, Pro e Plus.', 'erro');
```

**Problema:** A mensagem diz "Starter, Pro e Plus" mas Starter e Pro **NÃO** têm acesso à IA. O `PLAN_LIMITS` no server define `assistantIA: false` para ambos. Apenas Plus e Trial têm `assistantIA: true`.

**Impacto:** Usuário Starter/Pro pode ficar confuso achando que deveria ter acesso.

**🔧 SOLUÇÃO:**
```javascript
budShowToast('Assistente IA disponível apenas no plano Plus.', 'erro');
```

---

### 🟡 BUG 5 — `buildContexto()` não inclui dados de carteira (saldos das contas)

**Onde:** `assistente-ia.js` linhas 35-50

**Problema:** O contexto financeiro enviado à IA NÃO inclui saldos das contas bancárias (coleção `carteira`). A IA recebe receitas/despesas do mês mas não sabe quanto o user tem no banco. Impossível dar conselhos como "você tem R$5000 na poupança, pode investir X".

**Impacto:** IA dá respostas genéricas sobre patrimônio, sem dados reais da carteira.

**🔧 SOLUÇÃO:**
```javascript
// Adicionar carteira ao carregamento
const cartSnap = await getDocs(collection(db, "usuarios", user.uid, "carteira"));
const carteira = cartSnap.docs.map(d => ({ ...d.data(), id: d.id }));

// No buildContexto(), adicionar:
const saldoTotal = carteira.reduce((acc, c) => acc + (c.saldo || 0), 0);
// resumo.saldoContas = saldoTotal
// resumo.contas = carteira.map(c => `${c.nome}: R$${c.saldo.toFixed(2)}`)
```

---

### 🟡 BUG 6 — `buildContexto()` inclui transações pendentes (pago=false) nos totais

**Onde:** `assistente-ia.js` linhas 38-44

```javascript
doMes.forEach(t => {
    if (t.tipo === 'receita') receitas += t.valor || 0;
    else { despesas += t.valor || 0; ... }
});
```

**Problema:** Não filtra `t.pago !== false`. Transações pendentes (não pagas) são somadas como se fossem gastos reais. A IA pode dizer "você gastou R$5000 este mês" quando R$2000 são apenas previstas.

**Impacto:** Dados financeiros distorcidos → IA dá conselhos errados baseados em números inflados.

**🔧 SOLUÇÃO:**
```javascript
const doMes = transacoes.filter(t =>
  t.dataReferencia?.startsWith(mesRef) && t.pago !== false
);
```

---

### 🟡 BUG 7 — Conversa não persiste entre navegações

**Onde:** `assistente-ia.js` — variável `conversaIA = []`

**Problema:** `conversaIA` é um array em memória. Ao navegar para outra tela e voltar, todo o histórico é perdido. O user precisa começar a conversa do zero.

**Impacto:** UX frustrante — conversas longas e valiosas evaporam ao trocar de tela.

**🔧 SOLUÇÃO:**
```javascript
// Salvar em sessionStorage a cada mensagem
function salvarConversa() {
  sessionStorage.setItem('bud_conversa_ia', JSON.stringify(conversaIA.slice(-24)));
}
function carregarConversa() {
  try { return JSON.parse(sessionStorage.getItem('bud_conversa_ia')) || []; } catch { return []; }
}

// No init:
conversaIA = carregarConversa();
conversaIA.forEach(m => addMsg(m.role === 'user' ? 'user' : 'bot', formatarMensagemIA(m.content)));

// Após cada mensagem (enviarParaIA, enviarChamado):
salvarConversa();
```

---

### 🟡 BUG 8 — System prompt gigante recompilado a cada mensagem

**Onde:** `functions/index.js` → `buildBudSystemPrompt()`

**Problema:** O system prompt é enviado em cada request como `systemInstruction`. Ele contém ~2500 tokens fixos (descrição completa de TODOS os módulos do app, como usar, situações comuns, etc.). Multiplicado por 30 msg/min de rate limit = potencial custo alto.

**Impacto:** Latência e custo maiores do que necessário. O prompt não muda — deveria ser cacheado ou reduzido.

**🔧 SOLUÇÃO:**
- Gemini 1.5 suporta **context caching** — cachear o system prompt por 1h reduz custo em ~80%
- Ou: condensar o prompt, remover módulos que o user não usa (baseado no plano)
- Ou: enviar system prompt apenas na primeira mensagem, e nas seguintes enviar só `"continue com o mesmo contexto"`

---

### 🟡 BUG 9 — `maxOutputTokens: 700` é muito baixo para respostas financeiras

**Onde:** `functions/index.js` linha ~152

```javascript
generationConfig: { maxOutputTokens: 700, temperature: 0.7 }
```

**Problema:** 700 tokens ≈ 350 palavras. Para análises financeiras detalhadas com múltiplas categorias, dicas, e formatação, a resposta é frequentemente cortada no meio.

**Impacto:** Resposta truncada sem aviso — parece que a IA parou de funcionar. User não sabe que falta texto.

**🔧 SOLUÇÃO:**
```javascript
// Aumentar para ~1500 tokens e detectar truncamento
generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }

// Detectar se foi cortada:
const candidate = data.candidates?.[0];
if (candidate?.finishReason === 'MAX_TOKENS') {
  reply += '\n\n⚠️ _Resposta resumida por limite. Peça "continue" para mais detalhes._';
}
```

---

### 🟡 BUG 10 — Keywords de chamado detectam falsos positivos na resposta da IA

**Onde:** `assistente-ia.js` linhas 206-213

```javascript
const lower = texto.toLowerCase();
const isChamadoKeyword = CHAMADO_KEYWORDS.some(kw => lower.includes(kw));
await enviarParaIA(texto);
if (isChamadoKeyword) {
    setTimeout(() => addChamadoOfferButtons(), 300);
}
```

**Problema:** A detecção roda no texto do USUÁRIO, o que é correto. Mas as keywords são muito genéricas: `"erro"`, `"melhorar"`, `"feedback"`, `"problema"`. Se o user pergunta "como melhorar minhas finanças?" ou "o que é um erro no extrato bancário?", aparece oferta de chamado.

**Impacto:** UX confusa — botões de chamado aparecem indevidamente em perguntas normais sobre finanças.

**🔧 SOLUÇÃO:**
```javascript
// Keywords mais específicas + padrão negativo
const CHAMADO_KEYWORDS = [
  'bug no app', 'tela travou', 'travando', 'não funciona',
  'não abre', 'reportar', 'problema técnico', 'quero sugerir',
  'sugestão para o app', 'feedback do app'
];
// Ou: não auto-detectar — confiar nos botões explícitos "🐛 Reportar bug" e "💡 Dar sugestão"
```

---

### 🟡 BUG 11 — Gemini API key exposta na URL como query parameter

**Onde:** `functions/index.js` linha ~147

```javascript
const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
```

**Problema:** A key vai como query string na URL. Embora isso seja server-side (Cloud Function), query parameters podem aparecer em logs do Cloud Functions, monitoring, e requests logs do Google Cloud. O padrão recomendado pelo Google é header `x-goog-api-key`.

**Impacto:** Exposição potencial da API key em logs. Risco de segurança moderado.

**🔧 SOLUÇÃO:**
```javascript
const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_KEY  // ← header em vez de query param
    },
    body: JSON.stringify({ ... })
  }
);
```

---

### 🟡 BUG 12 — `_enviando` lock não é resetado em todos os cenários

**Onde:** `assistente-ia.js` — form submit handler

```javascript
_enviando = true;
if (modoChamado.ativo && modoChamado.tipo) {
    addMsg('user', escapeHTML(texto));
    input.value = '';
    input.placeholder = 'Pergunte sobre suas finanças...';
    await enviarChamado(modoChamado.tipo, texto);
    _enviando = false;  // ← OK aqui
    return;
}
...
await enviarParaIA(texto);  // ← _enviando é resetado dentro do finally
```

**Problema:** Se o `enviarChamado` lança exceção não capturada (improvável mas possível), `_enviando` fica true permanentemente — o user não pode enviar mais nenhuma mensagem até recarregar a página.

**Impacto:** Chat travado — `_enviando = true` sem reset.

**🔧 SOLUÇÃO:**
```javascript
form.addEventListener('submit', async e => {
    e.preventDefault();
    const texto = input.value.trim();
    if (!texto || _enviando) return;
    _enviando = true;
    try {
        // ... toda a lógica
    } finally {
        _enviando = false;  // garante reset em qualquer cenário
    }
});
```

---

### 🟡 BUG 13 — Chamado não registra UID do usuário

**Onde:** `functions/index.js` linhas ~186-195

```javascript
await adminDb.collection("chamados").add({
    tipo, descricao,
    nomeUsuario: nomeUsuario || "Anônimo",
    emailUsuario: emailUsuario || "",
    criadoEm: new Date().toISOString(),
    status: "aberto"
});
```

**Problema:** O chamado NÃO salva o `uid` do usuário (disponível em `decoded.uid`). Só salva nome e email — que vêm do frontend e podem ser manipulados. Sem UID, não dá para vincular ao perfil no CRM, nem verificar plano, nem rastrear reincidência.

**Impacto:** Chamados órfãos sem vínculo com usuário real. Dados não confiáveis.

**🔧 SOLUÇÃO:**
```javascript
await adminDb.collection("chamados").add({
    tipo, descricao,
    uid: decoded.uid,  // ← fonte confiável (do token)
    nomeUsuario: nomeUsuario || "Anônimo",
    emailUsuario: decoded.email || emailUsuario || "",  // ← email do token é mais seguro
    criadoEm: new Date().toISOString(),
    status: "aberto",
    plataforma: req.headers['user-agent'] || ''
});
```

---

### 🟢 BUG 14 — `analisarTransacoes()` é código morto

**Onde:** `assistente-ia.js` linha 217

```javascript
function analisarTransacoes(pergunta) { return ''; }
```

**Problema:** Função stub que retorna string vazia. Nunca é chamada por ninguém. É resto de uma implementação antiga (pre-Gemini).

**Impacto:** Código morto aumentando tamanho do arquivo.

**🔧 SOLUÇÃO:** Remover a função completamente.

---

### 🟢 BUG 15 — `glass-panel` CSS nunca usado

**Onde:** `assistente-ia.html` `<style>` linha 22

```css
.glass-panel { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.4); }
```

**Problema:** Nenhum elemento na tela usa a classe `glass-panel`. CSS morto.

**Impacto:** Poluição do `<style>`. Mínimo.

**🔧 SOLUÇÃO:** Remover a regra.

---

### 🟢 BUG 16 — `fmt()` declarado mas nunca usado

**Onde:** `assistente-ia.js` linha 12

```javascript
const fmt = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
```

**Problema:** Formatter de moeda declarado mas nunca chamado. `buildContexto()` usa `toFixed(2)` diretamente.

**Impacto:** Código morto.

**🔧 SOLUÇÃO:** Remover ou usar no `buildContexto()` para formatar valores como R$ corretamente.

---

### 🟢 BUG 17 — Chat não tem limite visual de mensagens antigas

**Onde:** `assistente-ia.js` → `addMsg()`

**Problema:** Mensagens são adicionadas ao DOM indefinidamente. Uma conversa longa (100+ mensagens) causa DOM bloat, scroll lento, e potencial travamento em dispositivos fracos.

**Impacto:** Performance degrada em conversas longas. Sem auto-cleanup.

**🔧 SOLUÇÃO:**
```javascript
function addMsg(from, html) {
    // ... criar e adicionar mensagem ...
    // Limpar mensagens antigas (manter últimas 50 no DOM)
    while (chat.children.length > 50) {
        chat.removeChild(chat.firstChild);
    }
}
```

---

### 🟢 BUG 18 — Sem feedback visual de envio (input não desabilita)

**Onde:** `assistente-ia.js` — form submit

**Problema:** Quando o user envia mensagem, o `_enviando` impede duplo submit, mas o input e o botão continuam visualmente habilitados. O user pode ficar clicando sem feedback de que está processando.

**Impacto:** UX confusa — parece que nada aconteceu.

**🔧 SOLUÇÃO:**
```javascript
_enviando = true;
input.disabled = true;
form.querySelector('button[type="submit"]').disabled = true;
// ... enviar ...
// No finally:
input.disabled = false;
form.querySelector('button[type="submit"]').disabled = false;
input.focus();
```

---

### 🟢 BUG 19 — `limparChat()` não reseta botões de sugestão

**Onde:** `assistente-ia.js` → `limparChat()` linha ~188

```javascript
window.limparChat = function() {
    conversaIA.length = 0;
    modoChamado = { ativo: false, tipo: null };
    input.placeholder = 'Pergunte sobre suas finanças...';
    chat.innerHTML = '';
    addMsg('bot', 'Chat reiniciado! Como posso ajudar? 😊');
};
```

**Problema:** Ao limpar, a mensagem de boas-vindas com os 5 botões de sugestão (gastos, dica, cartão, bug, sugestão) NÃO é re-renderizada. O user perde acesso rápido aos atalhos.

**Impacto:** UX degradada após limpar chat — perde os quick-actions.

**🔧 SOLUÇÃO:**
```javascript
window.limparChat = function() {
    conversaIA.length = 0;
    modoChamado = { ativo: false, tipo: null };
    input.placeholder = 'Pergunte sobre suas finanças...';
    chat.innerHTML = '';
    // Re-renderizar mensagem de boas-vindas com botões
    const welcome = document.createElement('div');
    welcome.className = 'msg-bot flex gap-3';
    welcome.innerHTML = `
      <div style="width:36px;height:36px;...">IA</div>
      <div style="...">
        <p>Chat reiniciado! Como posso ajudar? 😊</p>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
          <button onclick="enviarPergunta('Como estão meus gastos este mês?')" style="...">📊 Meus gastos</button>
          <!-- ... outros botões ... -->
        </div>
      </div>`;
    chat.appendChild(welcome);
};
```

---

## ✅ Checklist de Qualidade

| Critério | Status | Nota |
|---|---|---|
| Verificação de plano frontend | ✅ | `canUseFeatureSafely('assistantIA')` |
| Verificação de plano backend | ✅ | `resolveEffectivePlan()` → `limits.assistantIA` |
| Downgrade automático | ✅ | Persiste no Firestore corretamente |
| Auth check | ✅ | Frontend (onAuthStateChanged) + Backend (verifyAuth) |
| XSS prevention | ✅ | `escapeHTML()` no texto do user antes de innerHTML |
| Rate limit server | ✅ | 30/min chat, 5/15min chamado |
| Timeout frontend | ✅ | 30s safety com removeTyping |
| Créditos de IA | ❌ | Definidos no plano-config.js mas nunca verificados |
| Persistência de conversa | ❌ | Perde tudo ao navegar |
| Mobile responsivo | ✅ | Sidebar colapsável, max-w-3xl |
| Dark mode | 🟡 | Script incluído mas sem teste |
| Acessibilidade | ❌ | Sem aria-labels no chat, sem live-region para novas mensagens |
| Offline | ❌ | Não funciona — depende 100% do backend |

---

## 📊 Métricas do Código

| Métrica | Valor |
|---|---|
| **Linhas HTML** | 95 |
| **Linhas JS** | 288 |
| **Linhas Backend (Cloud Function /chat + /chamado)** | ~130 |
| **Total** | ~513 |
| **Funções** | 14 (+ 1 stub morto) |
| **Variáveis de estado** | 10 |
| **onSnapshots ativos** | 4 (deveria ser 0 — getDocs basta) |
| **Coleções Firestore lidas** | 5 (perfil + 4 subcoleções) |
| **Reads Firestore por sessão** | até 6.000+ (5000 tx + 500×3 sub) |
| **CSS custom** | 6 regras (1 morta) |
| **Código morto** | 2 itens (analisarTransacoes, glass-panel) |

---

## 💚 Pontos Positivos

1. **Dupla verificação de plano** — frontend E backend checam `assistantIA`, impossível burlar
2. **Downgrade persistido** — se trial expirou, escreve `plano: 'free'` no Firestore (não é cosmético)
3. **XSS safe** — usa `escapeHTML()` em todo texto do user antes do innerHTML
4. **Timeout de 30s** — se o servidor demora, mostra erro e libera o chat (não trava infinitamente)
5. **System prompt rico** — descreve TODOS os módulos do app, como usar, passo a passo — IA sabe responder sobre qualquer feature
6. **Detecção de keywords de chamado** — identifica quando user pode querer reportar bug e oferece os botões
7. **Rate limiting server-side** — 30 msg/min evita abuso do Gemini API
8. **Unsubscribe management** — `_unsubs[]` com cleanup no auth change
9. **Chamado com email real** — salva Firestore + envia email via EmailJS para o suporte humano
10. **UI limpa e focada** — layout de chat direto, sem distrações, max-w-3xl centralizado
