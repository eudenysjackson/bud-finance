# ROADMAP.md — Foco e Controle de Escopo

**Projeto**: Bud Finance  
**Última atualização**: 15/04/2026

> **REGRA**: NÃO implementar itens do Backlog sem pedido explícito do usuário.

---

## ✅ Concluído

- [x] Documentos de governança criados (PROJECT_RULES, ARCHITECTURE_MAP, DECISIONS_LOG, ERRORS_LOG, ROADMAP)
- [x] `.github/copilot-instructions.md` configurado
- [x] **Identidade visual** — 8 temas imersivos com cores reais de marca
- [x] **Firebase Config** (`js/firebase-config.js`) — placeholder seguro via `window.BUD_FIREBASE_CONFIG`
- [x] **Utils globais** (`js/bud-utils.js`) — `budShowToast()` + `budSanitize()`
- [x] **Tela de Login** (`index.html` + `js/index.js`)
  - Card glassmorphic com blobs decorativos + splash screen
  - Inputs email/matrícula + senha com toggle
  - Lógica Firebase Auth modular (v10.8.1, sem compat)
  - Modal de verificação de email (style.cssText, sem Tailwind dinâmico)
  - Keybindings (Enter), sanitização XSS, erro genérico anti-enumeração
  - Closure para dados sensíveis (sem senha no DOM)
- [x] **Tela de Cadastro** (`cadastro.html` + `js/cadastro.js`)
  - Formulário completo com senha escolhida pelo usuário (sem temp password)
  - Indicador de força de senha (4 barras), blocklist de senhas comuns
  - reCAPTCHA v3 placeholder com fallback DEV_SKIP
  - serverTimestamp para dataCadastro e lgpdConsentimentoData
  - Subcollection `usuarios/{uid}/indicacoes/{uid}` (não arrayUnion)
  - Email de boas-vindas fire-and-forget (sem senha no email)
  - Matrícula BUD-XXXX-XXXX via crypto
- [x] **Tela Recuperar Senha** (`recuperar-senha.html` + `js/recuperar-senha.js`)
  - Glassmorphism consistente com login (blobs, glass card)
  - POST para Cloud Function /reset-senha com res.ok check
  - Delayed redirect 3s + safety timeout 30s
  - Mensagens genéricas anti-enumeração
- [x] **firebase-config.js expandido** — BUD_FUNCTIONS_URL, BUD_EMAILJS_CONFIG, BUD_RECAPTCHA_SITE_KEY
- [x] **index.js atualizado** — Email verification enforced para TODOS os usuários

---

## 📋 Backlog (ordenado por prioridade)

> ⚠️ **NÃO implementar sem meu pedido.

6. **Tela Ação Auth** (`acao-auth.html` + `js/acao-auth.js`)
   - Processamento do link de reset (oobCode)
   - Formulário nova senha + confirmar
   - Indicador de força (4 barras)

7. **Tela Trocar Senha** (`trocar-senha.html` + `js/trocar-senha.js`)
   - Primeiro login obrigatório
   - Formulário nova senha + confirmar
   - Atualiza `primeiroLogin: false`

8. **Dashboard** (`dashboard.html`)
   - A definir

9. **Dark Mode** (`js/dark-mode.js`)
   - Toggle dark/light
   - Persistência em `localStorage.nexo_dark_mode`

10. **Painel Admin** (`admin.html`)
    - CRM com listagem de usuários
    - Block/Unblock de contas
    - Gestão de chamados

11. **Política de Privacidade** (`politica-privacidade.html`)
    - Página LGPD estática

12. **Cloud Functions** (Backend)
    - `/reset-senha` — envio de link de reset
    - `/chamado` — registro e envio de bug/sugestão
    - Rate limiting

---

## 🐛 Bugs Conhecidos

_Nenhum bug registrado ainda._
