# 📱 Assistente WhatsApp — Spec Completa

> **Última atualização:** 30/04/2026
> **Status geral:** Fase 1 (Vínculo via Token) implementada. Fases 2–4 planejadas abaixo.

---

## Visão

O Bud Finance como **"App Invisível"**: o usuário gere toda a vida financeira pelo WhatsApp sem precisar abrir o navegador. O WhatsApp vira a interface principal de controle — com taxa de abertura de ~100%.

---

## Arquitetura

```
[WhatsApp do usuário]
        │
        ▼
[Meta Cloud API / Evolution API]
        │  POST /webhook/whatsapp
        ▼
[backend/server.js — Node.js/Express]
        │
        ├── Identifica uid pelo número (Firestore)
        ├── Verifica plano (Plus/Trial)
        ├── Reutiliza POST /api/chat (mesmo engine Groq/Llama)
        ├── Reutiliza POST /api/extrair-cupom (imagens)
        ├── Reutiliza POST /api/extrair-fatura (PDFs/OFX)
        └── Responde via WhatsApp API (POST graph.facebook.com)

[Firestore]
  usuarios/{uid}:
    whatsappVinculado: string   // "5511999999999" ou null
    whatsappToken:     string   // código temporário "BUD-X7K2" ou null
    whatsappTokenExp:  number   // timestamp de expiração (24h)
```

---

## Modelo de Dados (padronizado)

| Campo | Tipo | Descrição |
|---|---|---|
| `whatsappVinculado` | `string \| null` | Número vinculado (somente dígitos, ex: `"5511999999999"`). `null` = não vinculado |
| `whatsappToken` | `string \| null` | Código de pareamento temporário, ex: `"BUD-X7K2"`. Null após uso ou expiração |
| `whatsappTokenExp` | `number \| null` | Unix timestamp ms de expiração do token (24h após geração) |

**Regra:** `whatsappVinculado` é o único campo de verdade. Os outros são auxiliares do processo de vínculo.

---

## Fases de Implementação

### ✅ Fase 1 — Vínculo Seguro (Token de Pareamento)

**Objetivo:** Substituir o vínculo direto por número (inseguro) por um sistema de token que prova que o usuário controla aquele número WhatsApp.

**Fluxo:**
```
1. Usuário clica "Gerar Código de Vínculo" em Ajustes → WhatsApp
2. Backend POST /api/whatsapp/gerar-token:
   - Verifica ID Token (auth)
   - Verifica plano (Plus/Pro/Trial)
   - Gera token: "BUD-" + 4 chars aleatórios (A-Z0-9)
   - Salva em usuarios/{uid}: { whatsappToken, whatsappTokenExp: now+24h }
   - Retorna { token, waNumeroDisplay, waLink }
3. UI mostra:
   ┌─────────────────────────────────────────────┐
   │ 📱 Envie este código para o WhatsApp do Bud │
   │                                             │
   │   BUD-X7K2   (válido 24h)                  │
   │                                             │
   │   [📲 Abrir WhatsApp]  [↩ Novo código]      │
   └─────────────────────────────────────────────┘
4. UI faz polling a cada 5s (máx 2min) → GET /api/whatsapp/status
5. Usuário envia "BUD-X7K2" para o número do Bud no WhatsApp
6. Webhook POST /webhook/whatsapp:
   - Extrai msg.from (número) e texto
   - Se texto == /^BUD-[A-Z0-9]{4}$/i:
     - Busca uid onde whatsappToken == código e tokenExp > now
     - Salva whatsappVinculado = msg.from, limpa token
     - Responde ao usuário: "✅ Olá, {nome}! Seu WhatsApp está vinculado ao Bud Finance. 🎉"
7. Polling detecta vinculo → UI atualiza para "✅ Vinculado"
```

**ENV vars necessárias no Render:**
| Variável | Descrição |
|---|---|
| `WA_PHONE_NUMBER_ID` | ID do número na Meta Business API |
| `WA_API_TOKEN` | Token permanente Meta Cloud API |
| `WA_VERIFY_TOKEN` | String aleatória para verificação do webhook Meta |
| `WA_APP_SECRET` | App Secret para HMAC (recomendado) |
| `WA_NUMERO_DISPLAY` | Número formatado para exibir ao usuário (ex: `+55 11 9999-9999`) |
| `WA_NUMERO_LINK` | Número puro para wa.me (ex: `5511999999999`) |

> **Alternativa MVP sem Meta API:** Evolution API self-hosted. Troca `WA_PHONE_NUMBER_ID` + `WA_API_TOKEN` por `WA_EVOLUTION_URL` + `WA_EVOLUTION_KEY`.

---

### 🔜 Fase 2 — Chat Básico (texto)

**Objetivo:** Processar mensagens de texto e responder usando o mesmo engine do Assistente IA.

**Fluxo:**
```
POST /webhook/whatsapp → msg de texto → uid identificado → plano verificado
  → Busca historico ia_sessao/ultima (mesma sessão do app web)
  → Chama engine /api/chat internamente (Groq/Llama + contexto financeiro)
  → Salva histórico atualizado
  → Envia resposta via WhatsApp API
```

**Paridade Web ↔ WhatsApp:**
- Mesma sessão de histórico (`ia_sessao/ultima`) — conversa continua entre os canais
- ACTION:TRANSACTION detectado → WA responde: "📝 *Despesa R$50 — Gasolina*. Confirmar? (sim/não)"
- "sim" → salva Firestore | "não" → descarta

---

### 🔜 Fase 3 — Multimodalidade

**Objetivo:** Processar imagens, áudios e arquivos pelo WhatsApp.

| Entrada | Endpoint reutilizado | Resposta WA |
|---|---|---|
| Foto de cupom fiscal | `POST /api/extrair-cupom` ✅ | "🧾 Supermercado X — R$150. Confirmar?" |
| Foto de extrato/fatura | `POST /api/extrair-fatura` ✅ | "📋 3 transações. Registrar?" |
| Áudio de voz | Groq Whisper API (PT-BR) | Mesmo fluxo do texto |
| PDF de fatura | `POST /api/extrair-fatura` ✅ | Igual |

---

### 🔜 Fase 4 — Proativo (Concierge)

**Objetivo:** O Bud inicia a conversa com alertas e resumos relevantes.

| Gatilho | Mensagem WA | Implementação |
|---|---|---|
| Alerta de limite | "⚠️ 85% do limite de Alimentação atingido" | `POST /api/alerta-financeiro` + envio WA |
| Vencimento de conta | "📅 Amanhã vence: Internet (R$99,90)" | Cron + endpoint novo |
| Resumo semanal | "📊 Semana: Despesas R$2.340 / Receitas R$4.200" | Reaproveitamento da lógica já existente (comentada) |

**Cron externo necessário** (Render free dorme): GitHub Actions scheduled, Upstash Cron ou Firebase Scheduled Functions.

---

## Estratégia de Canal

| Opção | Custo | Complexidade | Recomendação |
|---|---|---|---|
| **Meta Cloud API** (oficial) | Grátis até 1k conversas/mês | Alta (aprovação de business) | Produção |
| **Evolution API** (self-hosted) | ~R$30/mês VPS | Média | MVP / Beta ← recomendado agora |
| **Baileys** (Node.js) | Gratuito | Baixa | Testes locais |
| Twilio for WhatsApp | ~U$0.005/msg | Baixa | Evitar — caro por mensagem |

---

## Monetização

| Plano | WhatsApp |
|---|---|
| Free | ❌ |
| Starter | ❌ |
| Plus | ✅ Chat + alertas proativos |
| Pro | ✅ Chat + alertas + multimodalidade |

---

## Bugs corrigidos / Decisões

| # | Problema original | Decisão |
|---|---|---|
| BUG-1 | Webhook não processava mensagens | Fase 1 já detecta token; Fase 2 processa chat |
| BUG-2 | Campos inconsistentes (`whatsappVinculado` vs `whatsappConectado` vs `whatsappNumero`) | **Padronizado:** somente `whatsappVinculado` (string com número ou null) |
| BUG-3 | Resumo semanal carregava todos os usuários | Query filtrada por plano + vinculado |
| BUG-4 | Sem mecanismo de vínculo na tela assistente-whatsapp.html | Fluxo de token em Ajustes + wa.me link na tela informativa |
| BUG-5 | Tela prometia funcionalidades inexistentes | Implementação progressiva por fases |
| DEC-1 | Gemini sugeriu Gemini Flash como modelo IA | Mantemos Groq/Llama (já integrado, mais rápido) |
| DEC-2 | Gemini sugeriu Twilio | Evolution API para MVP (sem custo por mensagem) |

---

## Estado dos Arquivos

| Arquivo | Estado |
|---|---|
| `configuracoes.html` | ✅ Seção WhatsApp — fluxo token implementado |
| `js/configuracoes.js` | ✅ `gerarTokenWhatsApp()`, `verificarVinculoWhatsApp()` (polling) |
| `backend/server.js` | ✅ `POST /api/whatsapp/gerar-token`, `GET /api/whatsapp/status`, webhook processa token |
| `assistente-whatsapp.html` | 🔜 Fase 2 — atualizar com wa.me link + status em tempo real |
| `js/assistente-whatsapp.js` | 🔜 Fase 2 |


| Propriedade | Valor |
|---|---|
| HTML | `assistente-whatsapp.html` (131 linhas) |
| JS | `js/assistente-whatsapp.js` (82 linhas) |
| Backend webhook | `functions/index.js` → `GET /webhook/whatsapp` (verificação Meta) + `POST /webhook/whatsapp` (recebe msgs) |
| Backend resumo | `functions/index.js` → `enviarResumoWhatsapp` (DESATIVADO — comentado) |
| Script type | `type="module"` (ES modules Firebase modular) |
| Dependências frontend | `firebase-config.js`, `bud-loader.js`, `bud-utils.js`, `plan-utils.js`, `plano-config.js`, `sidebar.js`, `dark-mode.js`, `tutorial.js` |
| Firestore reads | 1 (perfil do usuário) |
| Interatividade | Zero — página somente leitura |

---

## Estrutura de Dados

### Dados Lidos

| Campo | Coleção | Uso |
|---|---|---|
| `usuarios/{uid}.plano` | usuarios | Verifica acesso (Plus/Trial) |
| `usuarios/{uid}.whatsappVinculado` | usuarios | Mostra status de conexão |
| `usuarios/{uid}.whatsappNumero` | usuarios | Exibe número vinculado (⚠️ este campo NÃO é o mesmo que `whatsappVinculado`) |
| `usuarios/{uid}.assinaturaStatus` | usuarios | Para resolução de plano |
| `usuarios/{uid}.trialFim` | usuarios | Para verificação de trial |

### Backend — Cloud Function Resumo Semanal (DESATIVADA)

```
Schedule: "0 8 * * 1" (segunda-feira 8h BRT)
Verifica: plano plus/trial + whatsappConectado (⚠️ campo errado) + whatsappNumero
Busca: transações da última semana
Envia: mensagem de texto via WhatsApp Cloud API (graph.facebook.com)
Secrets: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_TOKEN
```

---

## Estrutura HTML

```
<body> flex overflow-hidden height:100dvh
├── #mobileOverlay (backdrop sidebar mobile)
├── #sidebar-container (injetado por sidebar.js)
└── <main> flex-1 flex-col overflow-y-auto
    ├── <header> h-20 bg-white sticky z-30
    │   ├── botão hamburger (mobile)
    │   └── título "📱 Assistente WhatsApp"
    ├── div.flex-1 flex items-center justify-center (centralizado vertical)
    │   └── div.max-w-lg text-center space-y-8
    │       ├── Ícone grande (w-28 h-28 gradient green 📱)
    │       ├── Título + descrição marketing
    │       ├── Card "Como funciona" (3 passos)
    │       │   ├── 1. Conecte seu número
    │       │   ├── 2. Envie mensagens
    │       │   └── 3. Receba insights
    │       ├── Card "Status da conexão" (#statusConexao)
    │       │   ├── #statusBadge (Verificando... → Conectado / Não conectado)
    │       │   └── #statusContent (número vinculado ou instrução)
    │       └── Card "Exemplos de comandos" (4 exemplos em grid)
    │           ├── "Gastei 120 em farmácia"
    │           ├── "Recebi 3500 de salário"
    │           ├── "Quanto gastei esse mês?"
    │           └── "Resumo da semana"
```

---

## CSS Custom (no `<style>`)

| Classe/Regra | Uso |
|---|---|
| `.no-scrollbar` | Esconde scrollbar (webkit + Firefox) |
| `.icon-3d` | Drop-shadow no emoji |
| `.glass-panel` | bg rgba + backdrop-filter blur (**NÃO USADO** — CSS morto) |

---

## Fluxo Completo

### Frontend (página)

```
1. bud-loader.js → splash, version check
2. sidebar.js → injeta sidebar
3. assistente-whatsapp.js (module) →
   a. Inicializa Firebase modular (app, auth, db)
   b. onAuthStateChanged →
      i. Se !user → redirect index.html
      ii. getDoc(usuarios/{uid}) → dados do perfil
      iii. resolvePlanSafely() → resolve plano efetivo
      iv. Se shouldDowngrade → updateDoc (persiste downgrade)
      v. canUseFeatureSafely('whatsappAssistant') → se false → toast + redirect dashboard
      vi. Se data.whatsappVinculado →
          - Badge: "Conectado" (verde)
          - Mostra número vinculado
      vii. Se !data.whatsappVinculado →
          - Badge: "Não conectado" (amber)
          - Mensagem: "Envie mensagem para o número do Bud"
   c. Catch error → mostra "Não conectado"
```

### Backend — Webhook

```
GET /webhook/whatsapp:
  - Verificação Meta (hub.mode=subscribe, verify_token, challenge)
  - Retorna challenge ou 403

POST /webhook/whatsapp:
  - Verifica assinatura HMAC (X-Hub-Signature-256) se WHATSAPP_APP_SECRET configurado
  - console.log("Recebido do Meta (msg recebida)")
  - res.sendStatus(200)
  - FIM — NÃO PROCESSA A MENSAGEM
```

### Backend — Resumo Semanal (DESATIVADO)

```
1. Roda toda segunda 8h
2. Itera TODOS os users (db.collection("usuarios").get())
3. Filtra: plano plus/trial + whatsappConectado + whatsappNumero
4. Para cada user: busca transações da semana
5. Calcula: receitas, despesas, saldo, top 3 categorias
6. Envia mensagem texto via WhatsApp Cloud API
```

---

## Funções

| Função | Local | Descrição |
|---|---|---|
| `onAuthStateChanged` callback | JS:15 | Verifica auth, plano, e renderiza status de conexão |
| `resolvePlanSafely()` | plan-utils.js | Resolve plano efetivo (trial, assinatura, etc.) |
| `canUseFeatureSafely()` | plan-utils.js | Verifica se feature está disponível no plano |
| Webhook GET | backend | Verificação Meta |
| Webhook POST | backend | Recebe mensagens (não processa) |
| `enviarResumoWhatsapp` | backend | Resumo semanal (DESATIVADO) |

---

## Variáveis de Estado

| Variável | Tipo | Descrição |
|---|---|---|
| `statusBadge` | Element | Span do badge de status |
| `statusContent` | Element | Div do conteúdo de status |
| `firebaseConfig` | Object | `window.BUD_FIREBASE_CONFIG` |
| `app/auth/db` | Firebase | Instâncias Firebase modular |

---

## 🔍 Bugs, Incoerências e Problemas

---

### 🔴 BUG 1 — Webhook WhatsApp NÃO processa nenhuma mensagem recebida

**Onde:** `functions/index.js` linhas 37-47

```javascript
app.post("/webhook/whatsapp", (req, res) => {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
        const sig = req.headers['x-hub-signature-256'] || '';
        const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex');
        if (sig !== expected) {
            console.warn('WhatsApp webhook: assinatura inválida');
            return res.sendStatus(403);
        }
    }
    console.log("Recebido do Meta (msg recebida)");
    res.sendStatus(200);
});
```

**Problema:** O webhook recebe mensagens do Meta, verifica a assinatura HMAC, loga "Recebido do Meta" e retorna 200. **Não extrai a mensagem, não identifica o usuário, não processa comandos, não responde.** O usuário envia "gastei 50 no mercado" e absolutamente nada acontece.

**Impacto:** A feature principal — "Controle suas finanças pelo WhatsApp" — é **100% fake**. O usuário Plus paga R$49,90/mês por um recurso prometido que não existe.

**🔧 SOLUÇÃO:**
```javascript
app.post("/webhook/whatsapp", async (req, res) => {
    // 1. Verificar HMAC (já existe)
    // 2. Extrair mensagem
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if (!msg || msg.type !== 'text') { res.sendStatus(200); return; }

    const telefone = msg.from; // ex: "5511999999999"
    const texto = msg.text?.body || '';
    res.sendStatus(200); // responder rápido ao Meta

    // 3. Identificar usuário pelo número
    const usersSnap = await db.collection("usuarios")
        .where("whatsappVinculado", "==", telefone).limit(1).get();
    if (usersSnap.empty) { /* enviar msg "número não vinculado" */ return; }
    const userDoc = usersSnap.docs[0];
    const uid = userDoc.id;

    // 4. Verificar plano
    const { limits } = await resolveEffectivePlan(uid);
    if (!limits.assistantIA) { /* enviar msg "upgrade necessário" */ return; }

    // 5. Processar comando (IA ou regex para "gastei X em Y")
    // 6. Responder via WhatsApp Cloud API
});
```

---

### 🔴 BUG 2 — Inconsistência de campos: `whatsappVinculado` vs `whatsappConectado` vs `whatsappNumero`

**Onde:** Três locais usam campos diferentes para a mesma informação:

| Local | Campo usado | Existe no Firestore? |
|---|---|---|
| `js/assistente-whatsapp.js` | `data.whatsappVinculado` (status) + `data.whatsappNumero` (número) | `whatsappVinculado`=sim, `whatsappNumero`=NÃO |
| `js/configuracoes.js` (vinculação) | salva `whatsappVinculado` (valor = número) | ✅ campo correto |
| Cloud Function resumo semanal | `data.whatsappConectado` + `data.whatsappNumero` | NENHUM dos dois existe |
| `js/admin.js` (visão 360°) | `u.whatsappConectado` + `u.whatsappNumero` | NENHUM dos dois existe |

**Problema:** A tela de configurações salva o número em `whatsappVinculado` (string com o número). Mas:
- Esta tela (`assistente-whatsapp.js`) trata `whatsappVinculado` como boolean para status e busca `whatsappNumero` separado (que não existe)
- A Cloud Function busca `whatsappConectado` (que não existe)
- O admin busca `whatsappConectado` (que não existe)

**Impacto:** Status nunca mostra "Conectado" no admin, resumo semanal nunca envia para ninguém, e o número mostrado no assistente pode exibir "Número vinculado" genérico em vez do real.

**🔧 SOLUÇÃO:** Padronizar em todos os locais:
```javascript
// whatsappVinculado = string com número ou null/undefined
// Verificação: if (data.whatsappVinculado) → está vinculado
// Número: data.whatsappVinculado (é o próprio número)

// assistente-whatsapp.js — já quase correto, ajustar:
if (data.whatsappVinculado) {
    const numero = escapeHTML(data.whatsappVinculado);
    // usar whatsappVinculado como número também
}

// Cloud Function — corrigir:
if (!data.whatsappVinculado) continue;
const rawNum = String(data.whatsappVinculado).replace(/\D/g, "");

// Admin 360° — corrigir:
${u.whatsappVinculado ? '✅ +' + esc(u.whatsappVinculado) : '❌ Não'}
```

---

### 🔴 BUG 3 — Resumo semanal carrega TODOS os usuários (`db.collection("usuarios").get()`)

**Onde:** `functions/index.js` linha ~982 (dentro do bloco comentado)

```javascript
const usersSnap = await db.collection("usuarios").get();
for (const userDoc of usersSnap.docs) { ... }
```

**Problema:** Mesmo quando for reativado, carrega TODOS os usuários para depois filtrar cliente a cliente. Com 10.000 users, são 10.000 reads + N queries de transações. Extremamente caro e lento.

**Impacto:** Cloud Function pode timeout (540s max para v2), custo Firestore absurdo, potencial crash.

**🔧 SOLUÇÃO:**
```javascript
// Filtrar diretamente no Firestore — só users Plus/Trial com WhatsApp vinculado
const usersSnap = await db.collection("usuarios")
    .where("plano", "in", ["plus", "trial"])
    .where("whatsappVinculado", "!=", null)
    .get();
// Resultado: só os users relevantes, sem iteração inútil
```

---

### 🔴 BUG 4 — Nenhum mecanismo de vinculação do WhatsApp na tela

**Onde:** `assistente-whatsapp.html` + `assistente-whatsapp.js`

**Problema:** A tela mostra "Envie uma mensagem para o número do Bud Finanças no WhatsApp para começar" mas:
1. **Não mostra qual é o número** do Bud Finanças
2. **Não tem link/botão** para abrir o WhatsApp direto (wa.me/55XXXX)
3. **Não tem campo** para vincular número manualmente
4. A vinculação real acontece na tela de **Configurações** (seção WhatsApp) — mas o user não sabe

O user entra nesta tela, vê "Não conectado", e não tem como prosseguir.

**Impacto:** Feature inacessível — o user não consegue vincular WhatsApp por esta tela. Precisa saber que deve ir em Configurações, o que é contra-intuitivo.

**🔧 SOLUÇÃO:**
```html
<!-- Quando não conectado, mostrar: -->
<div class="text-center space-y-3">
    <p class="text-slate-500 text-sm">Seu WhatsApp ainda não está vinculado.</p>
    <a href="https://wa.me/5511XXXXXXXXX?text=Vincular%20minha%20conta"
       target="_blank" rel="noopener"
       style="display:inline-block;padding:12px 24px;background:#25D366;color:white;border-radius:12px;font-weight:700;text-decoration:none;">
        📱 Conectar WhatsApp
    </a>
    <p class="text-slate-400 text-xs">Ou vincule em <a href="configuracoes.html" class="text-blue-500 underline">Ajustes → WhatsApp</a></p>
</div>
```

---

### 🟡 BUG 5 — Tela promete funcionalidades que não existem

**Onde:** `assistente-whatsapp.html` — seções "Como funciona" e "Exemplos de comandos"

**Problema:** A tela promete:
- "Registre gastos" → Backend não processa mensagens
- "Consulte saldo" → Backend não processa mensagens
- "Receba alertas" → Cloud Function desativada
- "Gastei 120 em farmácia" → Nada acontece
- "Recebi 3500 de salário" → Nada acontece
- "Quanto gastei esse mês?" → Nada acontece
- "Resumo da semana" → Nada acontece

**Impacto:** **Propaganda enganosa.** O usuário Plus paga esperando estes recursos e nenhum funciona. Pode gerar reclamação, churn, e até problemas legais (Código de Defesa do Consumidor).

**🔧 SOLUÇÃO:**
- **Opção A (honesta):** Adicionar banner "🚧 Em breve" e não cobrar pela feature até funcionar
- **Opção B (implementar):** Fazer o webhook processar mensagens de verdade (ver BUG 1)
- **Opção C (beta):** Marcar como "Beta" e implementar progressivamente

---

### 🟡 BUG 6 — `escapeHTML` com fallback silencioso

**Onde:** `js/assistente-whatsapp.js` linha 49

```javascript
const numero = window.escapeHTML ? window.escapeHTML(data.whatsappNumero || 'Número vinculado') : 'Número vinculado';
```

**Problema:** Usa `data.whatsappNumero` que não existe (campo correto é `whatsappVinculado`). Mesmo se `escapeHTML` existir, o valor será `escapeHTML(undefined || 'Número vinculado')` = `escapeHTML('Número vinculado')`. O número real nunca aparece.

**Impacto:** Sempre mostra "Número vinculado" genérico em vez do número real do usuário.

**🔧 SOLUÇÃO:**
```javascript
const numero = window.escapeHTML
    ? window.escapeHTML(data.whatsappVinculado || 'Número vinculado')
    : (data.whatsappVinculado || 'Número vinculado');
```

---

### 🟡 BUG 7 — Sem verificação de plano no backend do webhook

**Onde:** `functions/index.js` — POST `/webhook/whatsapp`

**Problema:** O webhook não verifica o plano do usuário. Se alguém cujo plano expirou mandar mensagem pro número do Bud, o webhook (quando implementado) processaria normalmente. A verificação de plano só existe no frontend.

**Impacto:** Potencial uso por users não pagantes se o webhook for implementado sem check.

**🔧 SOLUÇÃO:**
```javascript
// Após identificar o user pelo número:
const { limits } = await resolveEffectivePlan(uid);
if (!limits.assistantIA) {
    // Enviar mensagem: "Seu plano não inclui este recurso. Faça upgrade!"
    return;
}
```

---

### 🟡 BUG 8 — resumo semanal faz N+1 queries (1 query de transações por user)

**Onde:** `functions/index.js` linha ~993 (bloco comentado)

```javascript
for (const userDoc of usersSnap.docs) {
    // ...
    const transSnap = await db.collection("usuarios").doc(uid)
        .collection("transacoes")
        .where("data", ">=", Timestamp.fromDate(semanaAtras))
        .get();
}
```

**Problema:** Para cada usuário Plus com WhatsApp, faz uma query separada de transações. Com 100 users Plus, são 100 queries sequenciais (`await` dentro do for). Potencial timeout.

**Impacto:** Cloud Function pode levar minutos e potencialmente timeout com muitos users.

**🔧 SOLUÇÃO:**
```javascript
// Paralelizar com Promise.all + batches de 10
const batches = [];
for (let i = 0; i < users.length; i += 10) {
    batches.push(Promise.all(users.slice(i, i + 10).map(u => processUser(u))));
}
for (const batch of batches) await batch;
```

---

### 🟡 BUG 9 — Resumo semanal usa campo `data` (timestamp) mas transações usam `dataReferencia` (string)

**Onde:** `functions/index.js` linha ~993 (bloco comentado)

```javascript
const transSnap = await db.collection("usuarios").doc(uid)
    .collection("transacoes")
    .where("data", ">=", Timestamp.fromDate(semanaAtras))
    .get();
```

**Problema:** Nas outras telas (extrato, dashboard, etc.) o campo usado para datas é `dataReferencia` (string `"YYYY-MM-DD"`), não `data` (Timestamp). Se as transações forem criadas pela UI (que salva `dataReferencia`), esta query pode não retornar nada.

**Impacto:** Resumo semanal pode vir sempre zerado — "Receitas: R$0,00 | Despesas: R$0,00".

**🔧 SOLUÇÃO:**
```javascript
// Usar dataReferencia (string) com comparação de range
const hoje = new Date();
const semanaAtras = new Date(hoje);
semanaAtras.setDate(hoje.getDate() - 7);
const deStr = semanaAtras.toISOString().slice(0, 10); // "2026-04-03"
const ateStr = hoje.toISOString().slice(0, 10);       // "2026-04-10"

const transSnap = await db.collection("usuarios").doc(uid)
    .collection("transacoes")
    .where("dataReferencia", ">=", deStr)
    .where("dataReferencia", "<=", ateStr)
    .get();
```

---

### 🟡 BUG 10 — Resumo semanal não filtra transações pendentes (pago=false)

**Onde:** `functions/index.js` linhas ~995-1005 (bloco comentado)

```javascript
transSnap.forEach(d => {
    const t = d.data();
    const val = Number(t.valor) || 0;
    if (t.tipo === "receita") { totalReceitas += val; }
    else { totalDespesas += val; ... }
});
```

**Problema:** Inclui transações com `pago === false` nos totais. O resumo semanal pode mostrar valores inflados.

**Impacto:** Dados financeiros incorretos enviados ao usuário pelo WhatsApp.

**🔧 SOLUÇÃO:**
```javascript
transSnap.forEach(d => {
    const t = d.data();
    if (t.pago === false) return; // ignorar pendentes
    // ...
});
```

---

### 🟡 BUG 11 — Sem indicador de "em breve" ou status real do serviço

**Onde:** `assistente-whatsapp.html`

**Problema:** A tela apresenta o recurso como se estivesse 100% funcional (passos de conexão, exemplos de comandos), mas o serviço não funciona. Não há nenhum indicador visual de que está em desenvolvimento, beta, ou parcialmente disponível.

**Impacto:** Expectativa falsa. User tenta usar, nada funciona, perde confiança no app.

**🔧 SOLUÇÃO:**
```html
<!-- Adicionar banner no topo do conteúdo -->
<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
    <p style="font-weight:700;color:#92400E;font-size:14px;">
        🚧 Recurso em fase de implantação — Disponível em breve
    </p>
    <p style="color:#92400E;font-size:12px;margin-top:4px;">
        Estamos finalizando a integração com o WhatsApp. Você será notificado quando estiver pronto!
    </p>
</div>
```

---

### 🟢 BUG 12 — `glass-panel` CSS nunca usado

**Onde:** `assistente-whatsapp.html` `<style>` linha 22

```css
.glass-panel { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.4); }
```

**Problema:** Nenhum elemento usa `glass-panel`. CSS morto (copiado do template da assistente-ia).

**Impacto:** Poluição de CSS. Mínimo.

**🔧 SOLUÇÃO:** Remover a regra.

---

### 🟢 BUG 13 — Nenhum import de `collection`, `onSnapshot`, `query`, `limit` mas importa `getFirestore`

**Onde:** `js/assistente-whatsapp.js` linha 3

```javascript
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
```

**Problema:** Importa exatamente o necessário (doc, getDoc, updateDoc) — isso é **CORRETO**. Porém, importa `getFirestore` que inicializa o Firestore em modo modular, criando uma segunda instância separada da que `firebase-config.js` cria em modo compat. Potencial conflito.

**Impacto:** Duas instâncias Firestore na mesma página (compat via firebase-config.js + modular via import). Funciona na prática mas consome memória extra.

**🔧 SOLUÇÃO:** Como a tela só faz 1-2 reads, o impacto é mínimo. Mas idealmente deveria usar a mesma instância de toda a app ou migrar tudo para modular.

---

### 🟢 BUG 14 — Header não tem botão "Limpar" ou ação — espaço desperdiçado

**Onde:** `assistente-whatsapp.html` — header

**Problema:** O header tem o título mas o `justify-between` sem segundo elemento faz layout estranho — espaço vazio à direita. Na assistente-ia.html havia um botão "Limpar Chat" que justificava o `justify-between`.

**Impacto:** Layout com espaço vazio desnecessário no header.

**🔧 SOLUÇÃO:** Remover `justify-between` ou adicionar link útil (ex: "Ajuda" ou "Configurações WhatsApp").

---

### 🟢 BUG 15 — Sem feedback de loading enquanto verifica plano

**Onde:** `js/assistente-whatsapp.js` — status badge inicia com "Verificando..."

**Problema:** O badge mostra "Verificando..." até o getDoc completar. Se a conexão for lenta, o user pode ficar até 10-15s vendo "Verificando..." sem entender o que acontece.

**Impacto:** UX menor — sem spinner ou animação durante o loading.

**🔧 SOLUÇÃO:** Adicionar animação de pulse no badge ou skeleton loading no card de status.

---

### 🟢 BUG 16 — Exemplos de comandos prometem reconhecimento de linguagem natural que não existe

**Onde:** `assistente-whatsapp.html` — grid de exemplos

```html
<p class="text-green-800 text-xs font-bold">"Gastei 120 em farmácia"</p>
<p class="text-green-800 text-xs font-bold">"Recebi 3500 de salário"</p>
```

**Problema:** Implica NLP (processamento de linguagem natural) que parseia frases como "gastei 120 em farmácia" e cria transações automaticamente. Isso requer: parsing da mensagem, extração de valor/categoria, criação de doc no Firestore, resposta de confirmação. Nada disso existe.

**Impacto:** Expectativa de funcionalidade avançada que pode nunca ser implementada no formato prometido.

**🔧 SOLUÇÃO:** Se for implementar, usar o Gemini (já integrado) para parsear comandos em linguagem natural:
```javascript
// No webhook, enviar mensagem do user ao Gemini com prompt específico:
// "Extraia: tipo (receita/despesa), valor, categoria, descrição da mensagem: '{texto}'"
// Retorno: { tipo: "despesa", valor: 120, categoria: "Saúde", descricao: "Farmácia" }
// Então criar transação no Firestore
```

---

## ✅ Checklist de Qualidade

| Critério | Status | Nota |
|---|---|---|
| Verificação de plano frontend | ✅ | `canUseFeatureSafely('whatsappAssistant')` |
| Verificação de plano backend | ❌ | Webhook não verifica plano |
| Downgrade automático | ✅ | Persiste no Firestore |
| Auth check frontend | ✅ | `onAuthStateChanged` |
| Auth check backend webhook | 🟡 | HMAC do Meta, mas não identifica user |
| XSS prevention | ✅ | `escapeHTML()` no número |
| Processamento de mensagens | ❌ | Webhook só loga e retorna 200 |
| Envio de respostas | ❌ | Não envia nenhuma resposta ao user |
| Status de conexão | 🟡 | Usa campo errado (`whatsappNumero` não existe) |
| Mobile responsivo | ✅ | Layout centralizado, sidebar colapsável |
| Resumo semanal | ❌ | Cloud Function desativada (comentada) |
| Vinculação de número | ❌ | Não tem botão/link nesta tela |
| Dark mode | 🟡 | Script incluído mas sem teste |
| Acessibilidade | ❌ | Sem aria-labels, sem alt no ícone |

---

## 📊 Métricas do Código

| Métrica | Valor |
|---|---|
| **Linhas HTML** | 131 |
| **Linhas JS** | 82 |
| **Linhas Backend (webhook + resumo semanal)** | ~120 (webhook ativo: 15, resumo comentado: ~105) |
| **Total** | ~333 |
| **Funções** | 1 (callback do onAuthStateChanged) |
| **Variáveis de estado** | 4 |
| **Firestore reads** | 1 (perfil do user) |
| **Interatividade** | 0 — página somente leitura |
| **Features funcionando** | 0 de 4 prometidas |
| **CSS morto** | 1 (glass-panel) |
| **Campos Firestore com naming inconsistente** | 3 (whatsappVinculado vs whatsappConectado vs whatsappNumero) |

---

## 💚 Pontos Positivos

1. **Verificação de plano com downgrade persistido** — mesma lógica robusta da assistente-ia
2. **Layout informativo clean** — design bonito com steps claros, exemplos de comandos, status card
3. **HMAC verification no webhook** — valida assinatura do Meta (X-Hub-Signature-256) quando secret está configurado
4. **Firebase modular** — imports mínimos (só getFirestore, doc, getDoc, updateDoc), eficiente
5. **Código enxuto** — 82 linhas de JS para uma tela simples, sem over-engineering
6. **Resumo semanal bem estruturado** — quando for reativado, o template de mensagem é bonito com emojis, formatação WhatsApp bold, top categorias
7. **Tratamento de erro no catch** — mostra "Não conectado" graciosamente em caso de falha
8. **escapeHTML no número** — previne XSS mesmo em dados que deveriam ser numéricos

---

# 🚀 PROPOSTA DE IMPLEMENTAÇÃO COMPLETA — ASSISTENTE WHATSAPP FUNCIONAL

## Visão Geral

Transformar o Assistente WhatsApp de **landing page decorativa** em um **canal funcional de interação financeira**. O user envia mensagens em linguagem natural e o Bud processa, registra transações, consulta dados e responde — tudo pelo WhatsApp, sem abrir o app.

---

## 1. 📐 ARQUITETURA

```
User WhatsApp
    │
    ▼
Meta Cloud API → POST /webhook/whatsapp (Cloud Function)
    │
    ├─ 1. Validar HMAC (já existe)
    ├─ 2. Extrair número + texto
    ├─ 3. Identificar user no Firestore (whatsappVinculado)
    ├─ 4. Verificar plano (resolveEffectivePlan)
    ├─ 5. Classificar intenção (Gemini)
    │     ├─ REGISTRO → criar transação
    │     ├─ CONSULTA → buscar dados + formatar
    │     ├─ COMANDO → resumo, saldo, limites
    │     └─ CONVERSA → chat livre (igual assistente-ia)
    ├─ 6. Executar ação no Firestore
    ├─ 7. Montar resposta
    └─ 8. Enviar via WhatsApp Cloud API
              │
              ▼
         User recebe resposta (~2-5s)
```

---

## 2. 🔧 IMPLEMENTAÇÃO DO WEBHOOK

### 2.1 Processar Mensagens Recebidas

Substituir o webhook atual (que só loga) por processamento real:

```javascript
// functions/index.js — POST /webhook/whatsapp (SUBSTITUIR)
app.post("/webhook/whatsapp", async (req, res) => {
    // 1. Verificar HMAC (manter código existente)
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
        const sig = req.headers['x-hub-signature-256'] || '';
        const expected = 'sha256=' + crypto.createHmac('sha256', appSecret)
            .update(JSON.stringify(req.body)).digest('hex');
        if (sig !== expected) return res.sendStatus(403);
    }

    // 2. Responder 200 imediatamente (Meta exige resposta rápida)
    res.sendStatus(200);

    // 3. Extrair mensagem
    try {
        const entry = req.body?.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const msg = value?.messages?.[0];

        if (!msg) return; // não é mensagem (pode ser status update)

        const telefone = msg.from; // "5511999999999"
        const msgId = msg.id;
        const tipo = msg.type; // "text", "image", "audio", etc.

        // Só processar texto por enquanto
        if (tipo !== 'text') {
            await enviarWhatsApp(telefone,
                '📱 Por enquanto só entendo mensagens de texto. Envie algo como:\n\n' +
                '• "Gastei 50 no mercado"\n• "Quanto gastei esse mês?"\n• "Resumo da semana"'
            );
            return;
        }

        const texto = msg.text?.body?.trim();
        if (!texto) return;

        // 4. Identificar usuário pelo número
        const db = getFirestore();
        const usersSnap = await db.collection('usuarios')
            .where('whatsappVinculado', '==', telefone)
            .limit(1)
            .get();

        if (usersSnap.empty) {
            await enviarWhatsApp(telefone,
                '❌ Número não vinculado ao Bud Finanças.\n\n' +
                'Para vincular:\n1. Abra o app Bud Finanças\n2. Vá em Ajustes → WhatsApp\n3. Digite este número e confirme'
            );
            return;
        }

        const userDoc = usersSnap.docs[0];
        const uid = userDoc.id;
        const userData = userDoc.data();

        // 5. Verificar plano
        const { plan, limits } = await resolveEffectivePlan(uid);
        if (!['plus', 'trial'].includes(plan)) {
            await enviarWhatsApp(telefone,
                '⚠️ O Assistente WhatsApp está disponível no plano *Plus*.\n\n' +
                'Faça upgrade no app para usar este recurso!'
            );
            return;
        }

        // 6. Verificar rate limit (máx 30 msgs/hora por user)
        const agora = Date.now();
        const limiteKey = `wa_rate_${uid}`;
        // (Usar Firestore ou cache in-memory para rate limiting)

        // 7. Processar mensagem
        await processarMensagemWhatsApp(uid, userData, telefone, texto, db);

    } catch (err) {
        console.error('Erro no webhook WhatsApp:', err);
    }
});
```

### 2.2 Enviar Mensagem via WhatsApp Cloud API

```javascript
// Função utilitária para enviar mensagens
async function enviarWhatsApp(telefone, mensagem) {
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const API_TOKEN = process.env.WHATSAPP_API_TOKEN;

    if (!PHONE_NUMBER_ID || !API_TOKEN) {
        console.error('WhatsApp API não configurada (secrets faltando)');
        return false;
    }

    try {
        const resp = await fetch(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: telefone,
                    type: 'text',
                    text: { body: mensagem }
                })
            }
        );
        if (!resp.ok) {
            const err = await resp.json();
            console.error('WhatsApp API erro:', JSON.stringify(err));
            return false;
        }
        return true;
    } catch (e) {
        console.error('Erro ao enviar WhatsApp:', e.message);
        return false;
    }
}
```

---

## 3. 🧠 CLASSIFICAÇÃO DE INTENÇÃO COM GEMINI

### 3.1 Prompt de Classificação

```javascript
async function classificarIntencao(texto) {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) return { tipo: 'conversa', dados: {} };

    const prompt = `Você é um parser financeiro. Classifique a mensagem do usuário em UMA das categorias abaixo e extraia os dados relevantes.

CATEGORIAS:
1. REGISTRO_DESPESA — usuário quer registrar um gasto
2. REGISTRO_RECEITA — usuário quer registrar uma receita/entrada
3. CONSULTA_SALDO — quer saber o saldo atual
4. CONSULTA_GASTOS — quer saber quanto gastou (mês, semana, categoria)
5. RESUMO — pede resumo (semanal, mensal)
6. CONSULTA_METAS — pergunta sobre metas financeiras
7. CONSULTA_DIVIDAS — pergunta sobre dívidas
8. AJUDA — quer saber os comandos disponíveis
9. CONVERSA — conversa livre sobre finanças (não é um comando)

MENSAGEM: "${texto}"

Responda APENAS em JSON válido, sem markdown:
{
  "tipo": "REGISTRO_DESPESA",
  "dados": {
    "valor": 120.00,
    "categoria": "Saúde",
    "descricao": "Farmácia",
    "data": null
  },
  "confianca": 0.95
}

Se for CONSULTA_GASTOS: { "tipo": "CONSULTA_GASTOS", "dados": { "periodo": "mes"|"semana", "categoria": null|"Alimentação" }, "confianca": 0.9 }
Se for RESUMO: { "tipo": "RESUMO", "dados": { "periodo": "semana"|"mes" }, "confianca": 0.9 }
Se for CONVERSA: { "tipo": "CONVERSA", "dados": { "pergunta": "texto original" }, "confianca": 0.8 }`;

    const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_KEY
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
            })
        }
    );

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        return JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
        return { tipo: 'CONVERSA', dados: { pergunta: texto }, confianca: 0.5 };
    }
}
```

### 3.2 Exemplos de Classificação

| Mensagem | Tipo | Dados Extraídos |
|---|---|---|
| "Gastei 120 em farmácia" | REGISTRO_DESPESA | valor:120, categoria:Saúde, desc:Farmácia |
| "Recebi 3500 de salário" | REGISTRO_RECEITA | valor:3500, categoria:Salário, desc:Salário |
| "Quanto gastei esse mês?" | CONSULTA_GASTOS | periodo:mes, categoria:null |
| "Quanto gastei de alimentação?" | CONSULTA_GASTOS | periodo:mes, categoria:Alimentação |
| "Resumo da semana" | RESUMO | periodo:semana |
| "Qual meu saldo?" | CONSULTA_SALDO | — |
| "Como economizar?" | CONVERSA | pergunta:"Como economizar?" |
| "Ajuda" | AJUDA | — |

---

## 4. ⚡ PROCESSAMENTO POR TIPO DE INTENÇÃO

### 4.1 Router Principal

```javascript
async function processarMensagemWhatsApp(uid, userData, telefone, texto, db) {
    // Classificar intenção
    const intencao = await classificarIntencao(texto);
    const { tipo, dados } = intencao;

    switch (tipo) {
        case 'REGISTRO_DESPESA':
        case 'REGISTRO_RECEITA':
            await handleRegistro(uid, userData, telefone, tipo, dados, db);
            break;
        case 'CONSULTA_SALDO':
            await handleConsultaSaldo(uid, telefone, db);
            break;
        case 'CONSULTA_GASTOS':
            await handleConsultaGastos(uid, telefone, dados, db);
            break;
        case 'RESUMO':
            await handleResumo(uid, userData, telefone, dados, db);
            break;
        case 'CONSULTA_METAS':
            await handleConsultaMetas(uid, telefone, db);
            break;
        case 'CONSULTA_DIVIDAS':
            await handleConsultaDividas(uid, telefone, db);
            break;
        case 'AJUDA':
            await handleAjuda(telefone);
            break;
        case 'CONVERSA':
        default:
            await handleConversa(uid, userData, telefone, texto, db);
            break;
    }
}
```

### 4.2 Registrar Transação (Despesa/Receita)

```javascript
async function handleRegistro(uid, userData, telefone, tipo, dados, db) {
    const ehReceita = tipo === 'REGISTRO_RECEITA';
    const valor = Number(dados.valor);
    if (!valor || valor <= 0) {
        await enviarWhatsApp(telefone, '❌ Não consegui identificar o valor. Tente: "Gastei 50 em mercado"');
        return;
    }

    // Verificar limite de transações do mês
    const { limits } = await resolveEffectivePlan(uid);
    const mesRef = new Date().toISOString().slice(0, 7); // "2026-04"
    // Contar transações do mês
    const countSnap = await db.collection('usuarios').doc(uid)
        .collection('transacoes')
        .where('dataReferencia', '>=', mesRef + '-01')
        .where('dataReferencia', '<=', mesRef + '-31')
        .count().get();
    const totalMes = countSnap.data().count;

    if (limits.transactionMonthlyLimit !== Infinity && totalMes >= limits.transactionMonthlyLimit) {
        await enviarWhatsApp(telefone,
            `⚠️ Limite de ${limits.transactionMonthlyLimit} transações/mês atingido.\n` +
            'Faça upgrade para continuar registrando!'
        );
        return;
    }

    const hoje = new Date();
    const dataRef = hoje.toISOString().slice(0, 10); // "2026-04-10"

    const transacao = {
        descricao: dados.descricao || (ehReceita ? 'Receita via WhatsApp' : 'Despesa via WhatsApp'),
        valor: valor,
        tipo: ehReceita ? 'receita' : 'despesa',
        categoria: dados.categoria || (ehReceita ? 'Outros' : 'Outros'),
        dataReferencia: dataRef,
        data: Timestamp.now(),
        pago: true,
        origem: 'whatsapp',
        conta: 'principal', // usar conta padrão
        criadoEm: Timestamp.now()
    };

    await db.collection('usuarios').doc(uid)
        .collection('transacoes').add(transacao);

    const emoji = ehReceita ? '💰' : '💸';
    const tipoLabel = ehReceita ? 'Receita' : 'Despesa';
    const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    await enviarWhatsApp(telefone,
        `${emoji} *${tipoLabel} registrada!*\n\n` +
        `📝 ${transacao.descricao}\n` +
        `💵 ${fmt(valor)}\n` +
        `🏷️ ${transacao.categoria}\n` +
        `📅 ${hoje.toLocaleDateString('pt-BR')}\n\n` +
        `_Enviado via WhatsApp — Bud Finanças_`
    );
}
```

### 4.3 Consultar Saldo

```javascript
async function handleConsultaSaldo(uid, telefone, db) {
    const cartSnap = await db.collection('usuarios').doc(uid)
        .collection('carteira').get();

    if (cartSnap.empty) {
        await enviarWhatsApp(telefone,
            '💰 Você ainda não tem contas cadastradas na carteira.\n' +
            'Abra o app → Carteira → Adicionar Conta'
        );
        return;
    }

    const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let total = 0;
    const contas = [];

    cartSnap.forEach(d => {
        const c = d.data();
        const saldo = Number(c.saldo) || 0;
        total += saldo;
        contas.push(`• ${c.nome || 'Conta'}: *${fmt(saldo)}*`);
    });

    await enviarWhatsApp(telefone,
        `💰 *Saldo das suas contas*\n\n` +
        contas.join('\n') + '\n\n' +
        `📊 *Total: ${fmt(total)}*\n\n` +
        `_Bud Finanças_`
    );
}
```

### 4.4 Consultar Gastos

```javascript
async function handleConsultaGastos(uid, telefone, dados, db) {
    const agora = new Date();
    let deStr, ateStr, periodoLabel;

    if (dados.periodo === 'semana') {
        const semanaAtras = new Date(agora);
        semanaAtras.setDate(agora.getDate() - 7);
        deStr = semanaAtras.toISOString().slice(0, 10);
        ateStr = agora.toISOString().slice(0, 10);
        periodoLabel = 'esta semana';
    } else {
        const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
        deStr = mesRef + '-01';
        ateStr = mesRef + '-31';
        periodoLabel = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    let q = db.collection('usuarios').doc(uid)
        .collection('transacoes')
        .where('dataReferencia', '>=', deStr)
        .where('dataReferencia', '<=', ateStr);

    const snap = await q.get();
    let receitas = 0, despesas = 0;
    const cats = {};

    snap.forEach(d => {
        const t = d.data();
        if (t.pago === false) return;
        const val = Number(t.valor) || 0;
        if (t.tipo === 'receita') { receitas += val; }
        else {
            despesas += val;
            const cat = t.categoria || 'Outros';
            cats[cat] = (cats[cat] || 0) + val;
        }

        // Filtro por categoria (se pediu)
        if (dados.categoria && t.categoria !== dados.categoria) return;
    });

    const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const saldo = receitas - despesas;
    const saldoEmoji = saldo >= 0 ? '✅' : '⚠️';

    const topCats = Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, val]) => `  • ${cat}: *${fmt(val)}*`)
        .join('\n');

    let msg = `📊 *Gastos — ${periodoLabel}*\n\n` +
        `💰 Receitas: *${fmt(receitas)}*\n` +
        `💸 Despesas: *${fmt(despesas)}*\n` +
        `${saldoEmoji} Saldo: *${fmt(saldo)}*\n`;

    if (topCats) msg += `\n🏷️ *Top categorias:*\n${topCats}\n`;
    msg += `\n_Bud Finanças_`;

    await enviarWhatsApp(telefone, msg);
}
```

### 4.5 Resumo (Semanal/Mensal)

```javascript
async function handleResumo(uid, userData, telefone, dados, db) {
    // Reutiliza handleConsultaGastos com período correto
    await handleConsultaGastos(uid, telefone, {
        periodo: dados.periodo || 'mes',
        categoria: null
    }, db);
}
```

### 4.6 Consultar Metas

```javascript
async function handleConsultaMetas(uid, telefone, db) {
    const snap = await db.collection('usuarios').doc(uid)
        .collection('metas').limit(10).get();

    if (snap.empty) {
        await enviarWhatsApp(telefone, '🎯 Você não tem metas cadastradas. Crie uma no app!');
        return;
    }

    const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const metas = [];
    snap.forEach(d => {
        const m = d.data();
        const atual = Number(m.valorAtual) || 0;
        const alvo = Number(m.valorAlvo) || 1;
        const pct = Math.min(100, Math.round((atual / alvo) * 100));
        const barra = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
        metas.push(`🎯 *${m.nome || 'Meta'}*\n   ${barra} ${pct}%\n   ${fmt(atual)} / ${fmt(alvo)}`);
    });

    await enviarWhatsApp(telefone,
        `🎯 *Suas Metas*\n\n` + metas.join('\n\n') + `\n\n_Bud Finanças_`
    );
}
```

### 4.7 Consultar Dívidas

```javascript
async function handleConsultaDividas(uid, telefone, db) {
    const snap = await db.collection('usuarios').doc(uid)
        .collection('dividas').where('quitada', '==', false).limit(10).get();

    if (snap.empty) {
        await enviarWhatsApp(telefone, '✅ Você não tem dívidas ativas! Parabéns! 🎉');
        return;
    }

    const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dividas = [];
    snap.forEach(d => {
        const div = d.data();
        const parcelas = (div.parcelas || []).filter(p => !p.paga);
        const proxima = parcelas[0];
        dividas.push(
            `📋 *${div.nome || 'Dívida'}*\n` +
            `   Restam ${parcelas.length} parcelas\n` +
            (proxima ? `   Próxima: ${fmt(proxima.valor)} em ${proxima.vencimento}\n` : '')
        );
    });

    await enviarWhatsApp(telefone,
        `📋 *Suas Dívidas Ativas*\n\n` + dividas.join('\n') + `\n_Bud Finanças_`
    );
}
```

### 4.8 Ajuda

```javascript
async function handleAjuda(telefone) {
    await enviarWhatsApp(telefone,
        `📱 *Comandos do Bud WhatsApp*\n\n` +
        `💸 *Registrar gasto:*\n"Gastei 50 no mercado"\n"120 farmácia"\n\n` +
        `💰 *Registrar receita:*\n"Recebi 3500 de salário"\n"Entrou 200 de freelance"\n\n` +
        `📊 *Consultas:*\n"Quanto gastei esse mês?"\n"Gastos da semana"\n"Qual meu saldo?"\n\n` +
        `📋 *Relatórios:*\n"Resumo da semana"\n"Resumo do mês"\n\n` +
        `🎯 *Metas e Dívidas:*\n"Como estão minhas metas?"\n"Minhas dívidas"\n\n` +
        `💬 *Conversa livre:*\n"Como economizar?"\n"Dica de investimento"\n\n` +
        `_Bud Finanças — Suas finanças no controle_ 🚀`
    );
}
```

### 4.9 Conversa Livre (Reusar Gemini)

```javascript
async function handleConversa(uid, userData, telefone, texto, db) {
    // Montar contexto financeiro (igual assistente-ia)
    const agora = new Date();
    const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    const txSnap = await db.collection('usuarios').doc(uid)
        .collection('transacoes')
        .where('dataReferencia', '>=', mesRef + '-01')
        .where('dataReferencia', '<=', mesRef + '-31')
        .limit(200).get();

    let receitas = 0, despesas = 0;
    txSnap.forEach(d => {
        const t = d.data();
        if (t.pago === false) return;
        if (t.tipo === 'receita') receitas += Number(t.valor) || 0;
        else despesas += Number(t.valor) || 0;
    });

    const contexto = {
        nome: userData.nome || '',
        plano: userData.plano || 'plus',
        mesAno: agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        resumo: { receitas, despesas, saldo: receitas - despesas }
    };

    // Enviar ao Gemini (reusar buildBudSystemPrompt)
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
        await enviarWhatsApp(telefone, '⚠️ Assistente indisponível no momento. Tente novamente!');
        return;
    }

    const resp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text:
                    buildBudSystemPrompt(contexto) +
                    '\n\nIMPORTANTE: Responda de forma CURTA (máx 500 caracteres). ' +
                    'Use formatação WhatsApp: *negrito*, _itálico_, • para listas.'
                }] },
                contents: [{ role: 'user', parts: [{ text: texto }] }],
                generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
            })
        }
    );

    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
        || 'Não consegui processar. Tente reformular!';

    await enviarWhatsApp(telefone, reply);
}
```

---

## 5. 🔗 VINCULAÇÃO DE NÚMERO

### 5.1 Fluxo de Vinculação

O user precisa vincular o número à conta. Dois caminhos:

**Caminho 1 — Pelo App (já existe em Configurações):**
1. Ajustes → WhatsApp → digita número → salva `whatsappVinculado`

**Caminho 2 — Pelo WhatsApp (novo — auto-vinculação):**
1. User envia "Vincular" para o número do Bud
2. Webhook detecta número não vinculado
3. Gera código de 6 dígitos, salva em `admin/whatsapp_codes/{codigo}`
4. Responde: "Digite este código no app: 847293"
5. No app (Configurações), user digita o código
6. App valida código → salva `whatsappVinculado`

```javascript
// No webhook, quando número não vinculado e texto = "vincular":
if (texto.toLowerCase().includes('vincular')) {
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('admin').doc('whatsapp_codes').collection('pending').doc(codigo).set({
        telefone: telefone,
        criadoEm: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000) // 10 min
    });
    await enviarWhatsApp(telefone,
        `🔗 *Vincular conta Bud Finanças*\n\n` +
        `Seu código: *${codigo}*\n\n` +
        `1. Abra o App Bud Finanças\n` +
        `2. Vá em Ajustes → WhatsApp\n` +
        `3. Clique "Vincular com código"\n` +
        `4. Digite: *${codigo}*\n\n` +
        `⏱️ Código válido por 10 minutos`
    );
    return;
}
```

### 5.2 Atualizar Tela Frontend

```javascript
// Em assistente-whatsapp.js — quando NÃO conectado, mostrar:
statusContent.innerHTML = `
    <div style="text-align:center;">
        <p style="color:#64748B;font-size:14px;margin-bottom:12px;">
            Seu WhatsApp ainda não está vinculado.
        </p>
        <a href="https://wa.me/55XXXXXXXXXXX?text=Vincular"
           target="_blank" rel="noopener"
           style="display:inline-block;padding:12px 24px;background:#25D366;color:white;
                  border-radius:12px;font-weight:700;text-decoration:none;font-size:14px;">
            📱 Conectar WhatsApp
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;">
            Ou vincule em <a href="configuracoes.html" style="color:#3B82F6;text-decoration:underline;">Ajustes → WhatsApp</a>
        </p>
    </div>
`;
```

---

## 6. 📊 PADRONIZAÇÃO DE CAMPOS FIRESTORE

Resolver a inconsistência `whatsappVinculado` vs `whatsappConectado` vs `whatsappNumero`:

| Arquivo | Campo Atual | Campo Correto |
|---|---|---|
| `js/configuracoes.js` | `whatsappVinculado` ✅ | Manter |
| `js/assistente-whatsapp.js` | `whatsappVinculado` (status) + `whatsappNumero` (número) | Usar `whatsappVinculado` para ambos |
| `functions/index.js` (resumo) | `whatsappConectado` + `whatsappNumero` | Usar `whatsappVinculado` |
| `js/admin.js` (360°) | `whatsappConectado` + `whatsappNumero` | Usar `whatsappVinculado` |

**Regra:** `whatsappVinculado` = string com número no formato `"5511999999999"` ou `null`/`undefined`.

```javascript
// Verificar se vinculado:
if (data.whatsappVinculado) { /* conectado */ }

// Obter número:
const numero = data.whatsappVinculado; // é o próprio número
```

---

## 7. 🔄 RESUMO SEMANAL (REATIVAÇÃO)

### Correções necessárias antes de descomentar:

```javascript
exports.enviarResumoWhatsapp = onSchedule({
    schedule: "0 8 * * 1", // segunda 8h BRT
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    secrets: ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_API_TOKEN"]
}, async () => {
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const API_TOKEN = process.env.WHATSAPP_API_TOKEN;
    if (!PHONE_NUMBER_ID || !API_TOKEN) return;

    // FIX 1: Filtrar direto no Firestore (não carregar todos users)
    const usersSnap = await db.collection("usuarios")
        .where("plano", "in", ["plus", "trial"])
        .where("whatsappVinculado", "!=", null)  // FIX 2: campo correto
        .get();

    // FIX 3: Paralelizar em batches
    const processar = async (userDoc) => {
        const uid = userDoc.id;
        const data = userDoc.data();
        const telefone = String(data.whatsappVinculado).replace(/\D/g, "");

        // FIX 4: Usar dataReferencia (string) em vez de data (Timestamp)
        const hoje = new Date();
        const semanaAtras = new Date(hoje);
        semanaAtras.setDate(hoje.getDate() - 7);
        const deStr = semanaAtras.toISOString().slice(0, 10);
        const ateStr = hoje.toISOString().slice(0, 10);

        const transSnap = await db.collection("usuarios").doc(uid)
            .collection("transacoes")
            .where("dataReferencia", ">=", deStr)
            .where("dataReferencia", "<=", ateStr)
            .get();

        let totalReceitas = 0, totalDespesas = 0;
        const gastosCat = {};

        transSnap.forEach(d => {
            const t = d.data();
            if (t.pago === false) return; // FIX 5: ignorar pendentes
            const val = Number(t.valor) || 0;
            if (t.tipo === "receita") totalReceitas += val;
            else { totalDespesas += val; const cat = t.categoria || "Outros"; gastosCat[cat] = (gastosCat[cat] || 0) + val; }
        });

        // (manter template de mensagem existente — está bom)
        // ... montar e enviar via enviarWhatsApp(telefone, mensagem)
    };

    // Processar em batches de 5
    const users = usersSnap.docs;
    for (let i = 0; i < users.length; i += 5) {
        await Promise.all(users.slice(i, i + 5).map(processar));
    }
});
```

---

## 8. 🛡️ SECRETS NECESSÁRIOS

| Secret | Comando para configurar | Uso |
|---|---|---|
| `WHATSAPP_VERIFY_TOKEN` | `firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN` | Verificação do webhook Meta |
| `WHATSAPP_APP_SECRET` | `firebase functions:secrets:set WHATSAPP_APP_SECRET` | HMAC das requisições |
| `WHATSAPP_PHONE_NUMBER_ID` | `firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID` | ID do número Business |
| `WHATSAPP_API_TOKEN` | `firebase functions:secrets:set WHATSAPP_API_TOKEN` | Token permanente da API |
| `GEMINI_API_KEY` | Já configurado ✅ | Classificação de intenção + chat |

**Configuração no Meta Business:**
1. Criar App no [developers.facebook.com](https://developers.facebook.com)
2. Adicionar produto "WhatsApp"
3. Configurar webhook URL: `https://us-central1-meuappfinancas-982ea.cloudfunctions.net/api/webhook/whatsapp`
4. Subscribir: messages, message_deliveries
5. Obter Phone Number ID e API Token permanente

---

## 9. 🔐 SEGURANÇA

| Item | Status | Ação |
|---|---|---|
| HMAC webhook | ✅ Já existe | Manter |
| Rate limit por user | ❌ | Adicionar: max 30 msgs/hora por WhatsApp |
| Verificação de plano | ❌ | Adicionar: check Plus/Trial |
| Sanitização de input | ❌ | Não confiar no texto — escapar antes de salvar no Firestore |
| Dedup de mensagens | ❌ | Usar `msg.id` para evitar processar duplicatas (Meta re-envia se não receber 200 rápido) |
| Rate limit Gemini | 🟡 | Reutiliza rate limit global do /chat (30/min) — criar separado para WhatsApp |

```javascript
// Deduplicação de mensagens:
const dedup = await db.collection('admin').doc('whatsapp_processed')
    .collection('msgs').doc(msgId).get();
if (dedup.exists) return; // já processada
await db.collection('admin').doc('whatsapp_processed')
    .collection('msgs').doc(msgId).set({ at: Timestamp.now() });
// TTL: criar index com expiração de 24h no Firestore
```

---

## 10. 📋 PLANO DE EXECUÇÃO

### Fase 1 — Mínimo Viável (MVP)

1. ✅ Padronizar campo `whatsappVinculado` em todos os arquivos
2. Configurar secrets do WhatsApp Cloud API no Firebase
3. Implementar `enviarWhatsApp()` — função de envio
4. Implementar webhook que processa mensagens + identifica user
5. Implementar `handleAjuda()` — mostra comandos
6. Implementar `handleRegistro()` — despesa/receita via Gemini
7. Implementar `handleConsultaSaldo()` — saldo das contas
8. Testar end-to-end com número de teste do Meta

**Resultado:** User Plus pode registrar gastos e ver saldo pelo WhatsApp.

### Fase 2 — Consultas e Resumo

9. Implementar `handleConsultaGastos()` — gastos do mês/semana
10. Implementar `handleResumo()` — resumo semanal/mensal
11. Reativar `enviarResumoWhatsapp` com as correções
12. Implementar `handleConsultaMetas()` e `handleConsultaDividas()`
13. Atualizar tela frontend com botão "Conectar WhatsApp"

**Resultado:** Feature WhatsApp completa para consultas.

### Fase 3 — Inteligência

14. Implementar `handleConversa()` — chat livre com Gemini
15. Implementar auto-vinculação por código
16. Implementar deduplicação de mensagens
17. Adicionar rate limiting por user
18. Dashboard de uso no admin (mensagens/dia, users ativos no WhatsApp)

**Resultado:** Feature Premium completa, justificando o preço do plano Plus.

### Estimativa de Impacto

| Fase | Arquivos | Complexidade |
|---|---|---|
| Fase 1 | functions/index.js, js/assistente-whatsapp.js, js/configuracoes.js, js/admin.js | Média |
| Fase 2 | functions/index.js (expandir handlers) | Média |
| Fase 3 | functions/index.js, assistente-whatsapp.html, js/assistente-whatsapp.js | Alta |
