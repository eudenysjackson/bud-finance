# Briefing para o Gemini — Assistente WhatsApp (Bud Finance)

## Contexto do projeto

Bud Finance é um app de finanças pessoais (HTML5 + Tailwind CSS estático + Vanilla JS ES6+ + Firebase 10.8.1 modular SDK). O backend é Node.js + Express hospedado no Render (free tier — dorme após 15min). IA: Groq API com modelo `meta-llama/llama-4-scout-17b-16e-instruct`.

---

## O que foi implementado (Fase 1 — commitado em `5478a99`)

### Objetivo da Fase 1
Vínculo seguro entre conta do usuário no Bud e número de WhatsApp via **token de pareamento**, substituindo o vínculo direto por número (que era inseguro).

### Fluxo implementado
1. Usuário clica "Gerar Código" em Ajustes → WhatsApp
2. Backend gera token `BUD-XXXX` (4 chars A-Z0-9), salva em Firestore com expiração de 24h
3. UI exibe o código + botão "Abrir WhatsApp" (wa.me link com texto pré-preenchido)
4. Usuário envia o código pelo WhatsApp para o número do Bud
5. Webhook recebe, valida token, vincula número, envia mensagem de boas-vindas
6. UI faz polling a cada 5s por até 2min para detectar o vínculo

### Arquivos modificados
- `backend/server.js` — novos endpoints e webhook
- `configuracoes.html` — UI de pareamento
- `js/configuracoes.js` — funções `gerarTokenWhatsApp()`, polling, `desvincularWhatsApp()` (via backend)

### Endpoints novos no backend
- `POST /api/whatsapp/gerar-token` — auth Bearer, verifica plano Plus/Pro/Trial, gera e salva token
- `GET /api/whatsapp/status` — retorna `{ vinculado: bool, numero: string|null }`
- `POST /api/whatsapp/desvincular` — remove vínculo via Admin SDK
- `GET /webhook/whatsapp` — verificação Meta (hub.challenge)
- `POST /webhook/whatsapp` — processa mensagem, detecta código BUD-XXXX, vincula número

### Modelo de dados no Firestore (`usuarios/{uid}`)
```
whatsappVinculado: string | null   // número vinculado (somente dígitos) ou null
whatsappToken:     string | null   // código temporário ou null
whatsappTokenExp:  number | null   // timestamp expiração (ms)
```

### Helper de envio de mensagem
```js
async function enviarMensagemWA(numero, texto)
```
Suporta tanto Meta Cloud API (`WA_PHONE_NUMBER_ID` + `WA_API_TOKEN`) quanto Evolution API (`WA_EVOLUTION_URL` + `WA_EVOLUTION_KEY`) como fallback.

---

## Por que ficou pendente (PEND-053)

O código está 100% pronto e commitado. O que falta é **infraestrutura física**:

1. **Chip pré-pago dedicado** (~R$10) — o número que será o "WhatsApp do Bud Finance". Não pode ser número pessoal.
2. **VPS Ubuntu** (~R$30–40/mês) com Evolution API instalada via Docker — para gerenciar a sessão do WhatsApp sem precisar de aprovação Meta.

Sem esses dois itens, as ENV vars `WA_EVOLUTION_URL` e `WA_EVOLUTION_KEY` ficam vazias no Render e o backend não consegue enviar/receber mensagens.

---

## O que o Gemini precisa saber para continuar

### Próxima fase a implementar: Fase 2 — Chat básico

Quando o usuário mandar qualquer mensagem pelo WhatsApp (que não seja um código BUD-XXXX), o backend precisa:

1. Identificar o `uid` pelo número (`whatsappVinculado == msg.from`)
2. Verificar plano do usuário (Plus/Pro/Trial)
3. Buscar histórico da sessão IA em `usuarios/{uid}/ia_sessao/ultima`
4. Chamar o engine IA interno (já existe em `POST /api/chat`) com a mensagem
5. Salvar histórico atualizado
6. Responder via `enviarMensagemWA()`

O endpoint `/api/chat` já existe e funciona. O webhook `POST /webhook/whatsapp` já tem o comentário `// TODO: Fase 2` no lugar certo para adicionar esse processamento.

### Regras obrigatórias do projeto
- NUNCA usar classes Tailwind em elementos criados dinamicamente via JS — usar `style` inline
- NUNCA expor se um email/matrícula existe nas mensagens de erro
- Firebase SDK Modular v10.8.1 — NUNCA SDK Compat
- Todo input de usuário deve ser sanitizado com `budSanitize()` antes de gravar no Firestore
- Firebase config via `window.BUD_FIREBASE_CONFIG` — sem keys hardcoded
- Backend URL via `window.BUD_FUNCTIONS_URL`

### ENV vars do backend (Render)
Já existentes: `FIREBASE_SERVICE_ACCOUNT`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_RECUPERAR_SENHA`, `EMAILJS_TEMPLATE_CHAMADO`, `FRONTEND_URL`, `GROQ_API_KEY`, `NODE_ENV`

A adicionar quando tiver chip/VPS: `WA_EVOLUTION_URL`, `WA_EVOLUTION_KEY`, `WA_NUMERO_DISPLAY`, `WA_NUMERO_LINK`, `WA_VERIFY_TOKEN`

### Documentos de referência no repositório
- `cérebro/assistente-whatsapp.md` — spec completa das 4 fases
- `cérebro/whatsapp-guia-producao.md` — guia passo a passo para ativar em produção
- `PENDENCIAS.md` — PEND-053
- `PROJECT_RULES.md` — regras obrigatórias do projeto
- `ARCHITECTURE_MAP.md` — mapa de todos os arquivos e funções
