# ROADMAP.md — Foco e Controle de Escopo

**Projeto**: Bud Finance  
**Última atualização**: 19/04/2026

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
  - POST para Cloud Function /reset-senha
  - Delayed redirect 3s + safety timeout 30s
  - Mensagens genéricas anti-enumeração
- [x] **firebase-config.js expandido** — BUD_FUNCTIONS_URL, BUD_EMAILJS_CONFIG, BUD_RECAPTCHA_SITE_KEY
- [x] **index.js atualizado** — Email verification enforced para TODOS os usuários
- [x] **Política de Privacidade** (`politica-privacidade.html`) — Página LGPD completa com glassmorphism
- [x] **Sistema de Temas / Dark Mode** — 8 temas via CSS variables (inclui Dark HBO), preview em `preview-temas.html`, persistência em `localStorage.bud_theme` (DEC-008)
- [x] **Tela Ação Auth** (`acao-auth.html` + `js/acao-auth.js`)
  - 4 estados: validando (spinner) → formulário → sucesso → erro
  - `verifyPasswordResetCode` antes de mostrar form
  - Indicador de força (4 barras), blocklist de senhas comuns
  - Tratamento de links expirados/usados com mensagens amigáveis
- [x] **Tela Trocar Senha** (`trocar-senha.html` + `js/trocar-senha.js`)
  - Guard duplo: `onAuthStateChanged` + `primeiroLogin: true` no Firestore
  - User badge personalizado (nome + matrícula + iniciais)
  - `updatePassword` + `updateDoc(primeiroLogin: false)` → redirect dashboard
  - Tratamento de `auth/requires-recent-login` com re-login forçado
- [x] **Dashboard** (`dashboard.html` + `js/dashboard.js`)
  - Auth guard via `onAuthStateChanged` → redirect login se deslogado
  - Guard `primeiroLogin: true` → redirect `trocar-senha.html`
  - Sidebar lateral colapsável (desktop, persiste em localStorage) + hambúrguer (mobile)
  - 3 cards glassmorphic: **Resultado do Mês** (balanço mensal), Entradas do Mês, Saídas do Mês
    - _Card renomeado de "Saldo Total" → "Resultado do Mês" (DEC-019): query limitada ao mês evita leitura de todo o histórico_
  - Banner trial/free/expirado condicional
  - Toggle ocultar valores (persiste em localStorage); gráfico também oculto quando ativo
  - Sync real (re-cria listeners Firestore)
  - **CRUD completo de transações**: Nova Receita / Nova Despesa, Edição inline, Exclusão com confirmação
  - Atividades recentes (top 5 do mês) + filtro rápido Todos/Receitas/Despesas
  - **Histórico completo** (modal com todas as transações do mês, clicável para editar)
  - **Gráfico de despesas por categoria** (Doughnut — Chart.js) com cores por tema
  - **Navegação por mês** (← Abril 2026 →) com cálculo retroativo correto
  - **8 temas imersivos** sincronizados com Firestore (`temaEscolhido`); seletor no sidebar
  - Nome + matrícula + iniciais do usuário com `budSanitize()`
  - Logout com cleanup de listeners

---

## 📋 Backlog (ordenado por prioridade)

> ⚠️ **NÃO implementar sem meu pedido.**

1. **Tela de Configurações** (`configuracoes.html`)
   - **Aba Personalização** — mover seletor de temas (atualmente no sidebar do dashboard) para cá; o `#themeBubbles` do sidebar deve ser removido quando esta tela existir
   - Preferências de notificação
   - Gerenciamento de conta

2. **Painel Admin** (`admin.html`)
   - CRM com listagem de usuários
   - Block/Unblock de contas
   - Gestão de chamados

4. **Cloud Functions** (Backend)
   - `/reset-senha` — envio de link de reset
   - `/chamado` — registro e envio de bug/sugestão
   - Rate limiting

---

## 🐛 Bugs Conhecidos

Consultar [`ERRORS_LOG.md`](ERRORS_LOG.md) para histórico completo (ERR-001 a ERR-011).
