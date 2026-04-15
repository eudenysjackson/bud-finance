# ARCHITECTURE_MAP.md — Inventário Vivo do Ecossistema

**Projeto**: Bud Finance  
**Última atualização**: 15/04/2026

> **REGRA**: Antes de criar algo novo, consulte este doc. Ao finalizar qualquer tarefa, atualize.  
> Se algo novo quebrar uma conexão existente, **pare e avise o usuário**.

---

## 🧩 Membros (UI Components)

| Nome | O que faz | Onde aparece |
|---|---|---|
| **LoginCard** | Card glassmorphic com formulário de login | `index.html` |
| **BlobsDecorativos** | Manchas de cor azul/ciano no fundo | `index.html` |
| **LogoIcon** | Ícone `$` com gradiente azul | `index.html` |
| **InputIdentificador** | Input email/matrícula com label | `index.html` |
| **InputSenha** | Input senha com toggle show/hide | `index.html` |
| **BtnLogin** | Botão principal de login com estados | `index.html` |
| **LinkEsqueceuSenha** | Link para `recuperar-senha.html` | `index.html` |
| **LinkCadastro** | Link para `cadastro.html` | `index.html` |
| **FooterLGPD** | Footer com link LGPD | `index.html` |
| **ModalReenvioEmail** | Modal para reenviar verificação de email | `index.html` (criado via JS) |
| **SplashScreen** | Loader/splash screen animado | `index.html` (HEAD) |
| **ToastSystem** | Sistema de notificações toast | Global (`bud-utils.js`) |
| **FormCadastro** | Formulário de sign-up completo | `cadastro.html` |
| **FormRecuperarSenha** | Input email + botão enviar link | `recuperar-senha.html` |
| **FormResetSenha** | Nova senha + confirmar + indicador força | `acao-auth.html` |
| **FormTrocarSenha** | Nova senha + confirmar (primeiro login) | `trocar-senha.html` |
| **IndicadorForcaSenha** | 4 barras de progresso de força da senha | `acao-auth.html`, `trocar-senha.html` |

---

## 🧠 Neurônios (Helpers)

| Nome | Cálculo/Tratamento | Quem usa | Status |
|---|---|---|---|
| `budShowToast(msg, tipo)` | Exibe notificação toast (success, error, warning, info) | Todas as páginas | ✅ `bud-utils.js` |
| `budSanitize(str)` | Strip HTML tags + trim — anti-XSS | Todas as páginas | ✅ `bud-utils.js` |
| `buscarEmailPorMatricula(matricula)` | Consulta Firestore → retorna email ou null | `index.js` | ✅ `index.js` |
| `showEmailVerificationModal()` | Modal (style.cssText) para reenvio de verificação | `index.js` | ✅ `index.js` |
| `verificarForca(senha)` / `calcStrength(pw)` | Calcula força da senha (0-4) e atualiza barras | `cadastro.js` | ✅ `cadastro.js` |
| `gerarMatricula()` | Gera `BUD-XXXX-XXXX` com crypto.getRandomValues | `cadastro.js` | ✅ `cadastro.js` |
| `gerarCodigoIndicacao()` | Gera 8 chars alfanumérica maiúscula | `cadastro.js` | ✅ `cadastro.js` |
| `validarCodigoIndicacao(codigo)` | Query Firestore → retorna {uid, nome} ou null | `cadastro.js` | ✅ `cadastro.js` |
| `getRecaptchaToken()` | Placeholder reCAPTCHA v3 — retorna token ou __DEV_SKIP__ | `cadastro.js` | ✅ `cadastro.js` |
| `enviarEmailBoasVindas(...)` | Fire-and-forget welcome email via EmailJS (sem senha) | `cadastro.js` | ✅ `cadastro.js` |
| `isEmailValido(email)` | Regex básica de email | `cadastro.js`, `recuperar-senha.js` | ✅ |
| `gerarSenhaTemp()` | ~~Gera senha temporária~~ | — | ❌ REMOVIDO (user escolhe senha) |

---

## 🔄 Reflexos (Hooks / Event Listeners)

| Nome | Estado que gerencia | Store que consome |
|---|---|---|
| `onAuthStateChanged` | Sessão do usuário (logado/deslogado) | Firebase Auth |
| `keypress Enter → identificador` | Foca campo senha | DOM (`index.html`) ✅ |
| `keypress Enter → senha` | Dispara click no btnLogin | DOM (`index.html`) ✅ |
| `click → btnLogin` | Fluxo de login completo | Firebase Auth + Firestore ✅ |
| `click → toggleSenha` | Alterna password/text no input | DOM (`index.html`) ✅ |
| `submit → formLogin` | Previne submit e dispara login | DOM (`index.html`) ✅ |
| `submit → formCadastro` | Validação + criação Auth + Firestore doc | DOM (`cadastro.html`) ✅ |
| `submit → formRecuperar` | Valida email + POST /reset-senha | DOM (`recuperar-senha.html`) ✅ |
| `input → novaSenha (cadastro)` | Atualiza indicador de força (4 barras) | DOM (`cadastro.html`) ✅ |
| `input → telefone` | Máscara BR (XX) XXXXX-XXXX | DOM (`cadastro.html`) ✅ |
| `click → toggleNovaSenha/Confirmar` | Alterna password/text | DOM (`cadastro.html`) ✅ |
| `click → toggle senha` | Alterna password/text no input | DOM |
| `input → novaSenha` | Atualiza indicador de força | DOM |

---

## 🧬 DNA (Data Schemas)

### Collection: `usuarios`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Nome completo |
| `email` | string | ✅ | Email do usuário |
| `telefone` | string | ✅ | WhatsApp |
| `matricula` | string | ❌ | Matrícula (BUD-XXXX ou NEX-XXXX) |
| `plano` | string | ✅ | `trial`, `free`, `starter`, `pro`, `plus` |
| `primeiroLogin` | boolean | ✅ | `true` até trocar senha |
| `emailVerified` | boolean | ✅ | Se verificou email |
| `emailVerificationRequired` | boolean | ✅ | Se precisa verificar email |
| `bloqueado` | boolean | ✅ | Se conta está bloqueada |
| `dataCadastro` | timestamp | ✅ | Data de criação |
| `codigoIndicacao` | string | ✅ | Código único 8 chars (gerado) |
| `indicadoPor` | object/null | ❌ | `{codigo, uid, nome}` |
| `descontoIndicacao` | number | ❌ | 30 (%) — se veio indicação |
| `descontoIndicacaoUsado` | boolean | ❌ | Se já usou desconto |
| `lgpdConsentimento` | boolean | ✅ | Consentimento LGPD |
| `lgpdConsentimentoData` | timestamp | ✅ | serverTimestamp() |
| `lgpdVersaoPolitica` | string | ✅ | Versão da política aceita |
| `status` | string | ✅ | `ativo`, `inativo` |
| `funcionalidades` | object | ✅ | Feature flags |
| `role` | string | ❌ | `admin` para administradores |

### Subcollection: `usuarios/{uid}/indicacoes/{indicadoUid}`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Nome do indicado |
| `email` | string | ✅ | Email do indicado |
| `data` | timestamp | ✅ | serverTimestamp() |
| `assinouPlano` | boolean | ✅ | Se ativou plano pago |

### Collection: `chamados`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tipo` | string | ✅ | `bug` ou `sugestao` |
| `descricao` | string | ✅ | Descrição do chamado |
| `uid` | string | ✅ | UID do usuário que reportou |
| `status` | string | ✅ | `aberto`, `em_andamento`, `resolvido` |
| `dataCriacao` | timestamp | ✅ | Data de criação |

---

## 🗺️ Caminhos (Routing)

| Rota | Componente/Página | URL | Observação |
|---|---|---|---|
| `/` | Login | `index.html` | Página inicial |
| `/cadastro` | Sign-up | `cadastro.html` | Novo usuário |
| `/recuperar-senha` | Recuperar senha | `recuperar-senha.html` | Solicitar reset |
| `/acao-auth` | Processar reset | `acao-auth.html` | Recebe `?mode=&oobCode=` |
| `/trocar-senha` | Trocar senha | `trocar-senha.html` | Primeiro login |
| `/dashboard` | App principal | `dashboard.html` | Após login |
| `/admin` | Painel admin | `admin.html` | `role: admin` |
| `/politica-privacidade` | LGPD | `politica-privacidade.html` | Termos |

---

## 🫀 Órgãos (Services)

| Nome | Tipo | Conexão | Usado por |
|---|---|---|---|
| **Firebase Auth** | Autenticação | `https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js` | Login, cadastro, reset, trocar senha |
| **Firestore** | Banco de dados | `https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js` | Dados de usuário, chamados |
| **EmailJS** | Envio de emails | `https://api.emailjs.com/api/v1.0/email/send` | Credenciais signup, chamados |
| **Cloud Functions** | Backend | `BUD_FUNCTIONS_URL + /reset-senha` | Recuperação de senha |
| **Cloud Functions** | Backend | `BUD_FUNCTIONS_URL + /chamado` | Reportar bug/sugestão |
| **Google Fonts** | Tipografia | `fonts.googleapis.com` (Inter) | Todas as páginas |

---

## 🔗 Mapa de Conexões

```
                    ┌──────────────┐
                    │  Firebase    │
                    │  Auth 10.8.1 │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   index.html        cadastro.html     trocar-senha.html
   (Login)           (Sign-up)         (1º login)
        │                  │                  │
        │    ┌─────────────┼──────────────────┘
        │    │             │
        ▼    ▼             ▼
   ┌──────────────┐  ┌──────────────┐
   │  Firestore   │  │  EmailJS     │
   │  (usuarios)  │  │  (emails)    │
   └──────────────┘  └──────────────┘
        │
        ├── recuperar-senha.html ──→ Cloud Function /reset-senha
        │
        ├── acao-auth.html (processa link do email)
        │
        └── dashboard.html (app principal)
```

---

## 📝 Changelog de Integridade

| Data | Alteração | Autor |
|---|---|---|
| 15/04/2026 | Documento criado com base na spec da tela de login e fluxo de autenticação | Copilot |
| 15/04/2026 | Etapa 1 implementada: `index.html`, `js/index.js`, `js/firebase-config.js`, `js/bud-utils.js`. Helpers `budShowToast`, `budSanitize`, `showEmailVerificationModal`, `buscarEmailPorMatricula` ativos. | Copilot |
| 15/04/2026 | Etapa 2 implementada: `cadastro.html`, `js/cadastro.js`, `recuperar-senha.html`, `js/recuperar-senha.js`. Correções: user escolhe senha (sem temp), reCAPTCHA placeholder, serverTimestamp, subcoleção indicações, email verification enforced no login, res.ok check, delayed redirect. | Copilot |

---

## 📂 Arquivos Implementados

| Arquivo | Status | Descrição |
|---|---|---|
| `index.html` | ✅ | Tela de login — glassmorphism, blobs, splash screen |
| `js/index.js` | ✅ | Lógica de login — Firebase Auth modular, matrícula lookup, modal email, anti-XSS |
| `js/firebase-config.js` | ✅ | Config Firebase via `window.BUD_FIREBASE_CONFIG` (placeholders seguros) |
| `js/bud-utils.js` | ✅ | Toast system (`budShowToast`) + sanitização (`budSanitize`) |
| `cadastro.html` | ✅ | Tela de cadastro — glassmorphism, senha escolhida pelo user, indicador força, LGPD |
| `js/cadastro.js` | ✅ | Criação de conta — Firebase Auth modular, matrícula, reCAPTCHA placeholder, subcoleção indicações |
| `recuperar-senha.html` | ✅ | Tela de recuperação — glassmorphism consistente com login, blobs |
| `js/recuperar-senha.js` | ✅ | POST /reset-senha — res.ok check, delayed redirect 3s, safety timeout 30s |
| `css/tailwind.css` | ⏳ | Pendente — build estático do Tailwind |
