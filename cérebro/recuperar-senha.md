# 🔓 Cérebro — Recuperar Senha (`recuperar-senha.html` + `js/recuperar-senha.js`)

---

## 1. Visão Geral

A tela **Recuperar Senha** é a página pública onde o usuário solicita um link de redefinição de senha quando esquece a sua. É a página **mais simples** do app:

- 1 campo de email
- 1 botão "Enviar link de recuperação"
- 1 link "Voltar para o login"

**Fluxo completo:** Usuário digita email → POST para Cloud Function `/reset-senha` → backend envia email com link → link aponta para `acao-auth.html?mode=resetPassword&oobCode=XXX`

**Particularidade arquitetural:** Ao invés de usar `firebase.auth().sendPasswordResetEmail(email)` diretamente no frontend (abordagem padrão do Firebase), o app faz um POST para uma Cloud Function que executa o envio server-side. Isso tem a vantagem de não vazar se o email existe no sistema (bom para segurança), mas adiciona complexidade e latência de cold start.

**Acesso:** Página pública, sem autenticação.

**Arquivos:**
- `recuperar-senha.html` — ~65 linhas, HTML minimal
- `js/recuperar-senha.js` — ~40 linhas, fetch + validação

---

## 2. Estrutura de Dados

### Leitura
Nenhuma — página não consulta nada.

### Escrita/API
```
POST {FUNCTIONS_URL}/reset-senha
Body: { email: "user@email.com" }
Response: { success: true/false }
```

---

## 3. HTML Structure

```
body (bg-slate-50, centered)
└── Card (bg-white, rounded-[1.5rem], max-w-xs)
    ├── Ícone cadeado (blue-100 circle)
    ├── "Esqueceu a senha?"
    ├── Descrição
    ├── form
    │   ├── #email input (type=email)
    │   ├── #btnRecuperar — "Enviar link de recuperação"
    │   └── Link → index.html "Voltar para o login"
    └── (sem estados visuais — tudo no mesmo card)
```

**Nota:** Diferente de `acao-auth.html` e `trocar-senha.html`, não tem:
- Background blurs / glassmorphism / gradientes
- Seção de sucesso separada
- Seção de erro separada
- Indicador de força de senha
- Animações (fadeIn, pulse-ring)

---

## 4. Fluxo Completo

```
1. Usuário esqueceu a senha → clica "Esqueceu a senha?" no login (index.html)

2. Abre recuperar-senha.html
   → Nenhum check de autenticação

3. Digita email → clica "Enviar link de recuperação"
   ├── Email vazio → toast erro
   ├── Email inválido (regex) → toast erro
   └── Email válido:
       3a. btn = "Enviando..." + disabled
       3b. POST /reset-senha com { email }
       3c. Resposta:
           ├── success: true → toast + redirect index.html (IMEDIATO)
           └── success: false → toast erro + re-habilita btn

4. Catch error → toast erro + re-habilita btn

5. Usuário verifica email → clica link → acao-auth.html
```

---

## 5. Funções (js/recuperar-senha.js)

| Elemento | Linhas | Descrição |
|---|---|---|
| `BACKEND_URL` | 1 | `window.BUD_FUNCTIONS_URL` — URL base das Cloud Functions |
| Click listener `btnRecuperar` | 3-38 | Valida email, faz POST, trata resposta |

### Validação de Email
```javascript
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```
Regex básica: algo@algo.algo. Aceita `a@b.c` mas é suficiente para um form de recuperação (o server valida).

---

## 6. Variáveis

| Variável | Tipo | Origem |
|---|---|---|
| `BACKEND_URL` | string | `window.BUD_FUNCTIONS_URL` (de firebase-config.js) |
| `email` | string | Input do usuário, trimmed |
| `btn` | HTMLElement | Botão de submit |

---

## 7. Bugs e Problemas

### 🔴 BUG 1 — Sem rate limit e sem CAPTCHA em endpoint público de email

**Onde:** `js/recuperar-senha.js` — POST para `/reset-senha`  

**Problema:** O endpoint `/reset-senha` é chamado sem nenhuma proteção contra abuso:
- Sem CAPTCHA (reCAPTCHA, hCaptcha, Turnstile)
- Sem rate limit no frontend
- O botão é desabilitado durante o request mas re-habilitado no erro

Um atacante pode automatizar requests para:

1. **Flooding de email:** Enviar milhares de requests com o email de uma vítima, enchendo sua caixa de entrada com emails de recuperação. Isso constitui **spam/harassment**.

2. **Enumeração de usuários:** Se o backend retorna `success: false` para emails não cadastrados e `success: true` para cadastrados, é possível mapear quais emails existem no sistema. O toast diz "Se este e-mail estiver cadastrado..." (bom), mas o campo `data.success` pode vazar essa info se o server não for cuidadoso.

3. **Custo:** Cada email enviado via Firebase Authentication custa (após volume gratuito). Um atacante pode gerar custos significativos.

**Impacto:** 🔴 Vulnerabilidade de abuso em endpoint público.

🔧 **SOLUÇÃO:**
```html
<!-- Adicionar reCAPTCHA v3 no HTML -->
<script src="https://www.google.com/recaptcha/api.js?render=SITE_KEY"></script>
```
```javascript
// No JS: obter token antes do fetch
const captchaToken = await grecaptcha.execute('SITE_KEY', { action: 'reset_password' });

const res = await fetch(BACKEND_URL + '/reset-senha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, captchaToken })
});

// No backend: verificar score do reCAPTCHA + rate limit por IP
```

---

### 🟡 BUG 2 — Toast de sucesso invisível por redirect imediato

**Onde:** `js/recuperar-senha.js` linhas 26-28  
**Código atual:**
```javascript
if (data.success) {
    budShowToast('Se este e-mail estiver cadastrado, você receberá um link...', 'sucesso');
    window.location.href = "index.html";  // ← redirect imediato!
}
```

**Problema:** O `budShowToast` exibe um toast na tela, mas `window.location.href` é executado na linha seguinte, redirecionando para `index.html` antes que o toast seja visível (ou com apenas ~50ms de exibição).

O toast contém informação importante: "Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. **Verifique também a caixa de spam.**"

O usuário:
1. Clica "Enviar"
2. Vê "Enviando..." por ~500ms
3. Flash de verde no canto → imediatamente está na tela de login
4. Não leu a mensagem sobre spam → não verifica spam → acha que não funcionou → tenta novamente

**Impacto:** 🟡 UX — mensagem importante nunca é lida, aumenta suporte.

🔧 **SOLUÇÃO:**
```javascript
if (data.success) {
    budShowToast('Link enviado! Verifique seu email e também a caixa de spam.', 'sucesso');
    btn.innerText = '✅ Email enviado!';
    
    // Delay antes do redirect para o user ler a mensagem
    setTimeout(() => {
        window.location.href = "index.html";
    }, 3000);
}
```

---

### 🟡 BUG 3 — `bud-loader.js` carregado sem Firebase SDK disponível

**Onde:** `recuperar-senha.html` head  
**Código atual:**
```html
<script src="firebase-config.js"></script>
<script src="bud-loader.js"></script>
<script src="bud-utils.js"></script>
```

**Problema:** O `bud-loader.js` é o script que gerencia a splash screen e pode verificar o estado de autenticação do Firebase. Porém, esta página não carrega nenhum Firebase SDK — nem compat (`firebase-app-compat.js`) nem modular (via `import`).

O `js/recuperar-senha.js` é um script normal (não module) que só usa `window.BUD_FUNCTIONS_URL` e `budShowToast`. Não precisa do Firebase SDK.

Se o `bud-loader.js` tenta acessar `firebase.auth()` (compat) ou `getAuth()` (modular), vai lançar um ReferenceError. O comportamento exato depende do conteúdo de bud-loader.js, mas qualquer tentativa de usar Firebase Auth vai falhar silenciosamente ou com erro no console.

**Impacto:** 🟡 Possível erro JS no console, dependendo da implementação do bud-loader.js.

🔧 **SOLUÇÃO:**
```html
<!-- Opção A: Remover bud-loader.js desta página (não precisa de splash) -->
<script src="firebase-config.js"></script>
<script src="bud-utils.js"></script>

<!-- Opção B: Adicionar Firebase compat SDK antes do bud-loader -->
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="bud-loader.js"></script>
<script src="bud-utils.js"></script>
```

---

### 🟡 BUG 4 — Design inconsistente com outras telas de auth

**Onde:** `recuperar-senha.html` inteiro  

**Comparação:**

| Aspecto | acao-auth / trocar-senha | recuperar-senha |
|---|---|---|
| Background | `bg-[#f0f4f8]` + gradient blurs | `bg-slate-50` simples |
| Card | `bg-white/90 backdrop-blur-xl rounded-[2rem]` | `bg-white rounded-[1.5rem]` |
| Shadow | `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]` | `shadow-lg` |
| Animations | `animate-in` (fadeIn) | Nenhuma |
| Font weights | `font-extrabold` em headings | `font-bold` |
| Font import | `wght@400;500;600;700;800` | `wght@400;500;600;700` (sem 800) |
| max-width | `max-w-sm` (384px) | `max-w-xs` (320px) |

O resultado visual é que a página de recuperação parece de uma "versão anterior" do app. A diferença é sutil mas perceptível — card menor, sem efeitos visuais, fonte mais leve.

**Impacto:** 🟡 Inconsistência de marca — break na identidade visual durante um fluxo conectado.

🔧 **SOLUÇÃO:** Aplicar o mesmo estilo das páginas acao-auth/trocar-senha: blurs, glassmorphism, rounded-[2rem], animate-in, max-w-sm.

---

### 🟢 BUG 5 — Sem dark mode

**Onde:** `recuperar-senha.html` body  

**Problema:** `bg-slate-50` hardcoded, card `bg-white` fixo, sem classes `dark:`. Não carrega `dark-mode.js`.

**Impacto:** 🟢 Inconsistência visual menor.

---

### 🟢 BUG 6 — `console.error` em produção

**Onde:** `js/recuperar-senha.js` linha 33  
**Código atual:**
```javascript
} catch(error) {
    console.error("Erro:", error);
```

**Problema:** Expõe informações de erro no DevTools em produção. Pode revelar a URL completa da Cloud Function e detalhes de erro de rede.

**Impacto:** 🟢 Informação técnica exposta.

---

### 🟢 BUG 7 — `firebase-config.js` carregado mas `BUD_FIREBASE_CONFIG` não é usado

**Onde:** `recuperar-senha.html` e `js/recuperar-senha.js`  

**Problema:** O script `firebase-config.js` é carregado no head, setando `window.BUD_FIREBASE_CONFIG` e `window.BUD_FUNCTIONS_URL`. Porém, o JS só usa `BUD_FUNCTIONS_URL`. O `BUD_FIREBASE_CONFIG` não é utilizado por nenhum script nesta página.

Não é um bug funcional, mas `firebase-config.js` pode inicializar coisas desnecessárias e expõe as credenciais Firebase (apiKey, authDomain, etc.) no navegador sem necessidade.

**Impacto:** 🟢 Carga desnecessária + exposição de config.

🔧 **SOLUÇÃO:**
```html
<!-- Se firebase-config.js só exporta variáveis window, não há problema.
     Mas se quiser otimizar: criar um arquivo separado só com FUNCTIONS_URL -->
<script>window.BUD_FUNCTIONS_URL = 'https://us-central1-xxx.cloudfunctions.net';</script>
```

---

### 🟢 BUG 8 — `res.ok` não verificado antes de `res.json()`

**Onde:** `js/recuperar-senha.js` linhas 23-25  
**Código atual:**
```javascript
const res = await fetch(BACKEND_URL + '/reset-senha', { ... });
const data = await res.json();

if (data.success) { ... }
else { ... }
```

**Problema:** Se o server retorna HTTP 500 com body HTML (como uma página de erro do Cloud Functions), `res.json()` vai lançar `SyntaxError: Unexpected token < in JSON`. O catch trata isso com toast genérico, então funciona, mas a mensagem "Erro ao enviar e-mail" é enganosa quando o real problema é que a Cloud Function crashou.

**Impacto:** 🟢 Mensagem de erro imprecisa em edge case.

🔧 **SOLUÇÃO:**
```javascript
const res = await fetch(BACKEND_URL + '/reset-senha', { ... });

if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
}

const data = await res.json();
```

---

## 8. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | Sem rate limit / CAPTCHA | Médio — reCAPTCHA + server validation |
| 2 | 🟡 | Toast invisível por redirect imediato | Baixo — setTimeout |
| 3 | 🟡 | bud-loader.js sem Firebase SDK | Baixo — remover ou adicionar SDK |
| 4 | 🟡 | Design inconsistente | Baixo — copiar estilos |
| 5 | 🟢 | Sem dark mode | Baixo |
| 6 | 🟢 | console.error em produção | Baixo |
| 7 | 🟢 | firebase-config.js desnecessário parcialmente | Baixo |
| 8 | 🟢 | res.ok não verificado | Baixo |

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **8** |
| 🔴 Críticos | 1 |
| 🟡 Altos | 3 |
| 🟢 Baixos | 4 |
| Linhas HTML | ~65 |
| Linhas JS | ~40 |
| Firestore reads | 0 |
| Firebase Auth calls | 0 (usa Cloud Function) |
| API calls | 1 (POST /reset-senha) |
| Deps | firebase-config.js, bud-loader.js, bud-utils.js |

---

## 💚 Pontos Positivos

1. **Não vaza existência do email** — Mensagem "Se este email estiver cadastrado..." (boa prática de segurança)
2. **Server-side email sending** — Cloud Function evita exposição direta do Firebase Admin client-side
3. **Validação dupla** — Campo vazio + regex de email antes do request
4. **Botão desabilitado durante request** — Previne duplo-clique
5. **Link de volta ao login** — UX clara para quem lembrou a senha
6. **Simplicidade** — Página focada em uma única ação, sem overhead
