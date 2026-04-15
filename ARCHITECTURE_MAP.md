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

| Nome | Cálculo/Tratamento | Quem usa |
|---|---|---|
| `budShowToast(msg, tipo)` | Exibe notificação toast (success, error, warning) | Todas as páginas |
| `buscarEmailPorMatricula(matricula)` | Consulta Firestore → retorna email ou null | `index.js` |
| `verificarForca(senha)` | Calcula força da senha (0-4) e atualiza barras | `acao-auth.js`, `trocar-senha.js` |
| `gerarCodigoUnico()` | Gera string 8 chars alfanumérica maiúscula | `cadastro.js` |
| `gerarCodigoUnicoValidado()` | Gera código + valida unicidade no Firestore | `cadastro.js` |
| `gerarSenhaTemp()` | Gera senha temporária para novo cadastro | `cadastro.js` |

---

## 🔄 Reflexos (Hooks / Event Listeners)

| Nome | Estado que gerencia | Store que consome |
|---|---|---|
| `onAuthStateChanged` | Sessão do usuário (logado/deslogado) | Firebase Auth |
| `keypress Enter → identificador` | Foca campo senha | DOM (`index.html`) |
| `keypress Enter → senha` | Dispara click no btnLogin | DOM (`index.html`) |
| `click → btnLogin` | Fluxo de login completo | Firebase Auth + Firestore |
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
| `indicadoPor` | object/null | ❌ | `{codigo, uid, nome, dataIndicacao}` |
| `descontoIndicacao` | number | ✅ | 0 ou 30 (%) |
| `descontoIndicacaoUsado` | boolean | ✅ | Se já usou desconto |
| `indicacoes` | array | ❌ | Lista de usuários indicados |
| `totalIndicacoes` | number | ❌ | Contador de indicações |
| `role` | string | ❌ | `admin` para administradores |

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
