# 📱 Guia de Ativação — WhatsApp Assistente em Produção

> **Status:** Código pronto (Fase 1 commitada em `5478a99`). Bloqueado por falta de chip + VPS.
> **PEND-053** — registrado em 30/04/2026.

---

## O que já está pronto no código

- `backend/server.js` — endpoints `POST /api/whatsapp/gerar-token`, `GET /api/whatsapp/status`, `POST /api/whatsapp/desvincular`, `GET /webhook/whatsapp` (verificação Meta), `POST /webhook/whatsapp` (processa token de pareamento)
- `configuracoes.html` — seção WhatsApp com fluxo "Gerar Código" (UI de pareamento completa)
- `js/configuracoes.js` — `gerarTokenWhatsApp()`, polling de 5s/2min, desvincular via backend

Quando as ENV vars forem adicionadas no Render, tudo funciona imediatamente — zero código a escrever.

---

## Pré-requisitos a comprar

| Item | Onde comprar | Custo estimado |
|---|---|---|
| Chip pré-pago (número exclusivo do Bud) | Qualquer loja Claro/Vivo/Tim | ~R$10 único |
| VPS Ubuntu 22.04 | Contabo ou Hetzner | R$30–40/mês |

> **Regra:** o número do chip NÃO pode ter WhatsApp pessoal ativo. Precisa ser exclusivo do app.

---

## Passo a passo — Evolution API (MVP)

### Passo 1 — Criar a VPS

1. Acesse [contabo.com](https://contabo.com) ou [hetzner.com](https://hetzner.com)
2. Crie um servidor **Ubuntu 22.04 LTS** (plano mais barato)
3. Guarde o **IP público** da VPS (ex: `123.45.67.89`)

---

### Passo 2 — Instalar Docker na VPS

Acesse via SSH e rode:

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose
systemctl enable docker
```

---

### Passo 3 — Instalar Evolution API

```bash
mkdir ~/evolution && cd ~/evolution
```

Crie o arquivo `docker-compose.yml`:

```yaml
version: '3.8'
services:
  evolution:
    image: atendai/evolution-api:latest
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_TYPE=http
      - AUTHENTICATION_API_KEY=TROQUE_POR_STRING_ALEATORIA_LONGA
      - DATABASE_ENABLED=false
      - WEBHOOK_GLOBAL_URL=https://bud-finance-backend.onrender.com/webhook/whatsapp
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
```

```bash
docker-compose up -d
```

---

### Passo 4 — Vincular o chip ao Evolution

```bash
# Criar instância
curl -X POST http://SEU_IP:8080/instance/create \
  -H "apikey: SUA_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "bud", "qrcode": true}'

# Pegar QR Code
curl http://SEU_IP:8080/instance/connect/bud \
  -H "apikey: SUA_KEY_AQUI"
```

Escaneie o QR Code com o celular que tem o chip do Bud Finance. Após escanear, o chip fica gerenciado pelo Docker — o celular pode ser guardado.

---

### Passo 5 — Configurar webhook na Evolution

```bash
curl -X POST http://SEU_IP:8080/webhook/set/bud \
  -H "apikey: SUA_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://bud-finance-backend.onrender.com/webhook/whatsapp",
    "webhook_by_events": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

### Passo 6 — ENV vars no Render

Acesse [render.com](https://render.com) → `bud-finance-backend` → **Environment** → Add:

| Key | Valor |
|---|---|
| `WA_EVOLUTION_URL` | `http://SEU_IP:8080` |
| `WA_EVOLUTION_KEY` | A mesma key do docker-compose |
| `WA_NUMERO_DISPLAY` | Ex: `+55 11 9 9999-9999` |
| `WA_NUMERO_LINK` | Ex: `5511999999999` (só dígitos) |
| `WA_VERIFY_TOKEN` | Qualquer string — ex: `bud-wh-2026-xK9` |

Clique **Save Changes** → Render reinicia o backend automaticamente.

---

### Passo 7 — Testar

1. Abra o Bud Finance → **Ajustes** → **Assistente WhatsApp**
2. Clique **"📱 Gerar Código"**
3. Clique **"📲 Abrir WhatsApp"**
4. Envie a mensagem com o código
5. Em até 5 segundos o app exibe "✅ WhatsApp Vinculado"

---

## Passo a passo — Meta Cloud API (produção)

Use quando quiser migrar do Evolution para a infraestrutura oficial Meta (zero risco de ban, grátis até 1k conversas/mês).

### Pré-requisito
- Empresa verificada no **Meta Business Manager**
- Número de telefone dedicado (sem WhatsApp pessoal)

### Passos

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** → tipo: **Business**
2. Adicione o produto **WhatsApp**
3. Em **WhatsApp → Getting Started** anote:
   - **Phone Number ID** → vai para `WA_PHONE_NUMBER_ID`
   - **Temporary Access Token** → vai para `WA_API_TOKEN` (troque por token permanente depois)
4. Em **WhatsApp → Configuration → Webhook**:
   - **Callback URL:** `https://bud-finance-backend.onrender.com/webhook/whatsapp`
   - **Verify token:** mesmo valor de `WA_VERIFY_TOKEN`
   - Clique **Verify and Save** → assine o evento **messages**
5. No Render, adicione as ENV vars:

| Key | Valor |
|---|---|
| `WA_PHONE_NUMBER_ID` | ID do número Meta |
| `WA_API_TOKEN` | Token Meta |
| `WA_VERIFY_TOKEN` | String usada no webhook |
| `WA_APP_SECRET` | App Settings → Basic → App Secret |
| `WA_NUMERO_DISPLAY` | Número formatado |
| `WA_NUMERO_LINK` | Número puro (só dígitos) |

---

## Comparativo final

| | Evolution API | Meta Cloud API |
|---|---|---|
| **Setup** | ~30 min | 2–7 dias (aprovação) |
| **Custo** | ~R$30–40/mês (VPS) | Grátis até 1k conv/mês |
| **Número** | Qualquer chip SIM | Número dedicado |
| **Risco de ban** | Moderado | Zero |
| **Recomendação** | MVP / validação | Produção com usuários reais |
