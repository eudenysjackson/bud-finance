# 🔑 Cérebro — Ação Auth (`acao-auth.html` + `js/acao-auth.js`)

---

## 1. Visão Geral

A tela **Ação Auth** é o **handler universal de ações do Firebase Authentication**. Quando o Firebase envia emails de ação (reset de senha, verificação de email, etc.), o link contém uma URL configurada no Firebase Console que aponta para esta página, incluindo os parâmetros `mode` e `oobCode`.

**Atualmente implementa apenas `mode=resetPassword`** — mostrando:

1. **Loading:** Spinner enquanto verifica validade do `oobCode`
2. **Formulário:** Dois campos (nova senha + confirmação) com indicador de força
3. **Sucesso:** Confirmação visual + link para login
4. **Erro:** Link expirado/inválido + links para solicitar novo ou voltar ao login

**Acesso:** Página pública acessada exclusivamente via link em email de recuperação de senha.

**Arquivos:**
- `acao-auth.html` — ~125 linhas, layout com 4 seções alternáveis
- `js/acao-auth.js` — ~85 linhas, lógica de verificação e reset

---

## 2. Estrutura de Dados

### Leitura
Nenhuma leitura de Firestore. Toda interação é via Firebase Auth SDK:

- `auth.verifyPasswordResetCode(oobCode)` → retorna email associado ao código
- `auth.confirmPasswordReset(oobCode, novaSenha)` → redefine a senha

### Escrita
Nenhuma escrita em Firestore. A senha é atualizada diretamente no Firebase Auth.

### URL Params

| Param | Descrição |
|---|---|
| `mode` | Tipo da ação: `resetPassword`, `verifyEmail`, `recoverEmail` |
| `oobCode` | Código one-time do Firebase (out-of-band code) |

---

## 3. HTML Structure

```
body (bg-[#f0f4f8], centered)
├── Background blurs (2x div gradientes)
├── #loadingSection — spinner "Verificando link..."
├── #resetForm (hidden)
│   ├── Ícone cadeado
│   ├── "Crie sua nova senha"
│   ├── #resetEmail — email do usuário
│   ├── #novaSenha input + toggle visibility
│   ├── #confirmarSenha input + toggle visibility
│   ├── #forcaSenha — 4 barras + texto (hidden até digitar)
│   └── #btnSalvar → salvarNovaSenha()
├── #successSection (hidden)
│   ├── Check animado (pulse-ring)
│   ├── "Senha alterada!"
│   └── Link → index.html (login)
└── #errorSection (hidden)
    ├── Ícone exclamação
    ├── "Link expirado"
    ├── #errorMsg — texto dinâmico
    ├── Link → recuperar-senha.html
    └── Link → index.html (login)
```

---

## 4. Fluxo Completo

```
1. Usuário clica link no email de recuperação
   → URL: acao-auth.html?mode=resetPassword&oobCode=ABC123

2. init()
   ├── mode !== 'resetPassword' || !oobCode
   │   └── show('errorSection') → fim
   └── auth.verifyPasswordResetCode(oobCode)
       ├── Erro → show('errorSection')
       └── OK → email exibido em #resetEmail → show('resetForm')

3. Usuário digita nova senha
   → input event → calcula força (0-4 barras)
   → digita confirmação

4. Clica "Salvar nova senha" → salvarNovaSenha()
   ├── < 6 chars → toast erro
   ├── senhas ≠ → toast erro
   └── auth.confirmPasswordReset(oobCode, novaSenha)
       ├── expired-action-code → errorMsg + show('errorSection')
       ├── invalid-action-code → errorMsg + show('errorSection')
       ├── weak-password → toast + re-habilita botão
       ├── outro erro → errorMsg genérico + show('errorSection')
       └── OK → show('successSection')

5. Sucesso → "Ir para o login" → index.html
```

---

## 5. Funções (js/acao-auth.js)

| Função | Linhas | Descrição |
|---|---|---|
| `show(id)` | 11-14 | Esconde todas as 4 seções, mostra a seção com o id |
| `toggleSenha(inputId, btn)` | 16-18 | Alterna type password/text (toggle visibility) |
| input event listener | 21-42 | Calcula força da senha (4 critérios) e atualiza barras visuais |
| `salvarNovaSenha()` | 44-72 | Valida inputs, chama `confirmPasswordReset`, mostra resultado |
| `init()` | 75-87 | Verifica mode/oobCode, valida código, mostra form ou erro |

### Critérios de Força da Senha

| Nível | Critério | Visual |
|---|---|---|
| 1 barra | length ≥ 6 | Vermelho — "Muito fraca" |
| 2 barras | length ≥ 8 | Laranja — "Fraca" |
| 3 barras | maiúsculas + minúsculas | Amarelo — "Boa" |
| 4 barras | números ou especiais | Verde — "Forte" |

---

## 6. Variáveis Globais

| Variável | Tipo | Origem |
|---|---|---|
| `firebaseConfig` | Object | `window.BUD_FIREBASE_CONFIG` |
| `auth` | firebase.auth.Auth | `firebase.auth()` |
| `urlParams` | URLSearchParams | `window.location.search` |
| `mode` | string | URL param |
| `oobCode` | string | URL param |

---

## 7. Bugs e Problemas

### 🔴 BUG 1 — Só trata `resetPassword` — `verifyEmail` e `recoverEmail` ficam sem handler

**Onde:** `js/acao-auth.js` linhas 75-78  
**Código atual:**
```javascript
async function init() {
    if (mode !== 'resetPassword' || !oobCode) {
        show('errorSection');
        return;
    }
    // ...
}
```

**Problema:** O Firebase Console configura UMA única URL de ação para TODOS os tipos de email:
- `resetPassword` — recuperação de senha ✅ tratado
- `verifyEmail` — verificação de email ❌ não tratado
- `recoverEmail` — recuperação de email (se hacker mudou) ❌ não tratado

Se o template de verificação de email do Firebase usa esta URL (que é o padrão), quando o usuário clica em "Verificar email" no email de verificação: `acao-auth.html?mode=verifyEmail&oobCode=XYZ` → a página mostra **"Link expirado"** porque `mode !== 'resetPassword'`.

Consequência direta: **a verificação de email NUNCA funciona** se o Firebase Console aponta para `acao-auth.html`.

**Cenário:** O cadastro.html define `emailVerificationRequired: true` mas se o link de verificação cai aqui e mostra erro, o email nunca é verificado. Como nenhuma tela bloqueia por `emailVerified === false`, o impacto atual é apenas cosmético, mas se futuramente se enforçar verificação, nenhum usuário conseguirá verificar.

**Impacto:** 🔴 Fluxo crítico quebrado para funcionalidade futura.

🔧 **SOLUÇÃO:**
```javascript
async function init() {
    if (!oobCode) {
        show('errorSection');
        return;
    }

    try {
        if (mode === 'resetPassword') {
            const email = await auth.verifyPasswordResetCode(oobCode);
            document.getElementById('resetEmail').textContent = email;
            show('resetForm');

        } else if (mode === 'verifyEmail') {
            await auth.applyActionCode(oobCode);
            // Mostrar tela de sucesso adaptada
            document.querySelector('#successSection h2').textContent = 'Email verificado!';
            document.querySelector('#successSection p').textContent = 
                'Seu email foi verificado com sucesso. Agora você pode aproveitar o app completo.';
            show('successSection');

        } else if (mode === 'recoverEmail') {
            const info = await auth.checkActionCode(oobCode);
            await auth.applyActionCode(oobCode);
            // Mostrar sucesso com email restaurado
            document.querySelector('#successSection h2').textContent = 'Email restaurado!';
            document.querySelector('#successSection p').textContent = 
                `Seu email foi restaurado para ${info.data.email}.`;
            show('successSection');

        } else {
            show('errorSection');
        }
    } catch (error) {
        console.error('Erro na ação:', error);
        show('errorSection');
    }
}
```

---

### 🟡 BUG 2 — Classe CSS "undefined" aplicada quando força = 0

**Onde:** `js/acao-auth.js` linhas 37-39  
**Código atual:**
```javascript
const txt = document.getElementById('forcaTexto');
txt.textContent = textos[forca - 1] || '';
txt.className = 'text-[10px] font-bold ' + (coresTexto[forca - 1] || 'text-slate-400');
```

**Problema:** Quando o usuário digita menos de 6 caracteres, `forca` = 0. Então:
- `textos[0 - 1]` = `textos[-1]` = `undefined` → fallback `''` ✅ OK
- `coresTexto[0 - 1]` = `coresTexto[-1]` = `undefined` → fallback `'text-slate-400'` ✅ OK

Na verdade o fallback funciona aqui, MAS as **barras** têm lógica:
```javascript
bar.className = 'h-1 flex-1 rounded-full transition-all ' + (i <= forca ? cores[forca - 1] : 'bg-slate-200');
```
Quando `forca` = 0: `i <= 0` → sempre false → todas as barras ficam `bg-slate-200`. ✅ OK visualmente.

Porém, quando `forca` = 1, a cor é `cores[0]` = `'bg-red-400'` e o texto é `'Muito fraca'`. Mas uma senha de exatamente 6 chars **sem maiúsculas, sem números** recebe nota "Muito fraca" com barra vermelha — isso é correto e esperado.

**O BUG real é que não existe feedback para senhas < 6 chars** — o indicador aparece (container `.hidden` removido) mas todas as barras ficam cinza sem nenhum texto. O usuário não sabe o que fazer.

**Impacto:** 🟡 UX confusa — indicador visível mas sem informação.

🔧 **SOLUÇÃO:**
```javascript
if (senha.length < 6) {
    container.classList.remove('hidden');
    for (let i = 1; i <= 4; i++) {
        document.getElementById('bar' + i).className = 'h-1 flex-1 rounded-full transition-all bg-slate-200';
    }
    const txt = document.getElementById('forcaTexto');
    txt.textContent = 'Mínimo 6 caracteres';
    txt.className = 'text-[10px] font-bold text-red-400';
    return;
}
```

---

### 🟡 BUG 3 — Botão "Salvar" fica desabilitado permanentemente em erros não-weak-password

**Onde:** `js/acao-auth.js` linhas 53-70  
**Código atual:**
```javascript
btn.textContent = 'Salvando...';
btn.disabled = true;

try {
    await auth.confirmPasswordReset(oobCode, novaSenha);
    show('successSection');
} catch (error) {
    if (error.code === 'auth/expired-action-code') {
        // ... show('errorSection')
    } else if (error.code === 'auth/invalid-action-code') {
        // ... show('errorSection')
    } else if (error.code === 'auth/weak-password') {
        budShowToast('...');
        btn.textContent = 'Salvar nova senha';
        btn.disabled = false;     // ← só reabilita aqui
        return;
    } else {
        // ... show('errorSection')
    }
    show('errorSection');
}
```

**Problema:** Apenas `auth/weak-password` reabilita o botão. Para `expired-action-code`, `invalid-action-code` e erros genéricos, a seção de erro é mostrada (o que é correto). MAS se ocorrer um **erro de rede transitório** (que não é nenhum dos 3 codes tratados), o usuário vai para a error section com mensagem genérica "Ocorreu um erro. Tente solicitar um novo link."

Erros de rede podem ser:
- `auth/network-request-failed` — internet caiu momentaneamente
- `auth/internal-error` — Firebase temporariamente indisponível
- `auth/too-many-requests` — rate limit atingido

Para esses casos, o botão deveria ser reabilitado e uma mensagem mais específica exibida, permitindo que o usuário tente novamente.

**Impacto:** 🟡 Usabilidade degradada em cenários de rede instável.

🔧 **SOLUÇÃO:**
```javascript
} catch (error) {
    console.error('Erro ao redefinir senha:', error);
    
    if (error.code === 'auth/expired-action-code') {
        document.getElementById('errorMsg').textContent = 'Este link expirou. Solicite um novo link de redefinição.';
        show('errorSection');
    } else if (error.code === 'auth/invalid-action-code') {
        document.getElementById('errorMsg').textContent = 'Este link já foi utilizado ou não é válido.';
        show('errorSection');
    } else if (error.code === 'auth/weak-password') {
        budShowToast('Senha muito fraca. Use pelo menos 6 caracteres.', 'erro');
        btn.textContent = 'Salvar nova senha';
        btn.disabled = false;
    } else {
        // Erros transitórios: permitir retry
        budShowToast('Erro ao salvar. Verifique sua conexão e tente novamente.', 'erro');
        btn.textContent = 'Salvar nova senha';
        btn.disabled = false;
    }
}
```

---

### 🟡 BUG 4 — Senha mínima de 6 chars sem bloqueio de senhas comuns

**Onde:** `js/acao-auth.js` linhas 47-49  
**Código atual:**
```javascript
if (!novaSenha || novaSenha.length < 6) {
    budShowToast('A senha precisa ter no mínimo 6 caracteres.', 'erro'); return;
}
```

**Problema:** A validação aceita senhas como:
- `123456` — a senha mais comum do mundo
- `abcdef` — sequência trivial
- `qwerty` — padrão de teclado
- `000000` — repetição

O indicador de força mostra "Muito fraca" para essas (1 barra), mas o botão salvar **aceita sem alertar**. A força da senha é apenas visual — não bloqueia envio.

**Impacto:** 🟡 Segurança — usuários podem definir senhas triviais que serão comprometidas em ataques de dicionário.

🔧 **SOLUÇÃO:**
```javascript
// Senhas comuns a bloquear
const SENHAS_COMUNS = ['123456','123456789','12345','qwerty','password','111111',
    'abc123','000000','654321','iloveyou','admin','welcome'];

if (SENHAS_COMUNS.includes(novaSenha.toLowerCase())) {
    budShowToast('Essa senha é muito comum. Escolha uma senha mais segura.', 'erro');
    return;
}

// Opcionalmente, exigir uma força mínima:
let forca = 0;
if (novaSenha.length >= 6) forca++;
if (novaSenha.length >= 8) forca++;
if (/[A-Z]/.test(novaSenha) && /[a-z]/.test(novaSenha)) forca++;
if (/[0-9]/.test(novaSenha) || /[^A-Za-z0-9]/.test(novaSenha)) forca++;

if (forca < 2) {
    budShowToast('A senha precisa ter pelo menos 8 caracteres.', 'erro');
    return;
}
```

---

### 🟢 BUG 5 — Firebase compat CDN sem SRI hash

**Onde:** `acao-auth.html` final do body  
**Código atual:**
```html
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
```

**Problema:** Mesma vulnerabilidade de supply-chain identificada em outras telas. Sem `integrity`, um CDN comprometido teria acesso à sessão do usuário (oobCode + senha nova).

**Impacto:** 🟢 Risco teórico — nesta tela é particularmente sensível pois o usuário está digitando uma nova senha.

🔧 **SOLUÇÃO:** Adicionar `integrity` + `crossorigin="anonymous"`.

---

### 🟢 BUG 6 — `console.error` expõe detalhes de erro em produção

**Onde:** `js/acao-auth.js` linhas 55 e 81  
**Código atual:**
```javascript
console.error('Erro ao redefinir senha:', error);
// ...
console.error('Código inválido:', error);
```

**Problema:** Em produção, esses logs expõem detalhes internos do Firebase (error codes, mensagens, stack traces) no DevTools. Um atacante pode inspecionar para entender a lógica de validação e encontrar edge cases.

**Impacto:** 🟢 Informação sensível exposta em DevTools.

🔧 **SOLUÇÃO:**
```javascript
if (typeof console !== 'undefined' && location.hostname === 'localhost') {
    console.error('Erro ao redefinir senha:', error);
}
```

---

### 🟢 BUG 7 — Sem dark mode

**Onde:** `acao-auth.html` body  
**Código atual:**
```html
<body class="bg-[#f0f4f8] flex items-center justify-center min-h-screen ...">
```

**Problema:** A página não respeita `dark-mode.js` nem tem classes `dark:`. Se o usuário tem dark mode ativado no sistema, verá a página em modo claro. Inconsistência com o resto do app.

**Impacto:** 🟢 UX menor — página visitada raramente (só via link de email).

🔧 **SOLUÇÃO:** Adicionar variantes `dark:` nas classes principais e incluir `dark-mode.js`.

---

### 🟢 BUG 8 — `oobCode` permanece na URL/histórico do navegador após uso

**Onde:** Nenhum tratamento no código  

**Problema:** Após o password reset ser concluído com sucesso, a URL continua sendo `acao-auth.html?mode=resetPassword&oobCode=ABC123`. O código fica:
- No histórico do navegador
- Na barra de endereço
- Em possíveis logs de analytics/referrer

Se o usuário compartilhar a tela ou a URL aparecer em algum log, o oobCode fica exposto. Embora o Firebase invalide o código após uso, isso é uma prática de segurança defensiva.

**Impacto:** 🟢 Risco mínimo — Firebase já invalida, mas boa prática limpar.

🔧 **SOLUÇÃO:**
```javascript
// Após confirmPasswordReset com sucesso:
await auth.confirmPasswordReset(oobCode, novaSenha);

// Limpar URL
window.history.replaceState({}, '', window.location.pathname);

show('successSection');
```

---

## 8. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | Só trata resetPassword (verifyEmail quebrado) | Médio — adicionar handlers |
| 2 | 🟡 | Indicador de força sem texto para < 6 chars | Baixo |
| 3 | 🟡 | Botão desabilitado em erros de rede | Baixo |
| 4 | 🟡 | Aceita senhas comuns (123456) | Baixo |
| 5 | 🟢 | Firebase CDN sem SRI | Baixo |
| 6 | 🟢 | console.error em produção | Baixo |
| 7 | 🟢 | Sem dark mode | Baixo |
| 8 | 🟢 | oobCode persiste na URL | Baixo |

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **8** |
| 🔴 Críticos | 1 |
| 🟡 Altos | 3 |
| 🟢 Baixos | 4 |
| Linhas HTML | ~125 |
| Linhas JS | ~85 |
| Firestore reads | 0 |
| Firebase Auth calls | 2 (verifyPasswordResetCode + confirmPasswordReset) |
| Estados da UI | 4 (loading, form, success, error) |
| Deps externas | Firebase compat CDN, bud-utils.js, firebase-config.js |

---

## 💚 Pontos Positivos

1. **Verificação do oobCode antes de mostrar form** — Não mostra formulário para links inválidos
2. **Indicador visual de força da senha** — 4 barras com cores e textos descritivos
3. **Confirmação de senha** — Exige digitação dupla para evitar typos
4. **Error handling diferenciado** — Trata expired, invalid e weak-password com mensagens específicas
5. **Toggle de visibilidade da senha** — UX importante em telas de criação de senha
6. **Estados visuais claros** — Loading → Form → Success/Error bem definidos
7. **Email exibido no formulário** — Usuário sabe para qual conta está redefinindo
8. **Design consistente** — Glassmorphism, gradientes e animações seguem o padrão Bud
