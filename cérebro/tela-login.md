# 🔐 Tela de Login – Bud Finanças

**Versão**: 1.0  
**Data**: 06/04/2026  
**Rota**: `/index.html`  
**Título**: Login - Bud Finanças  
**Propósito**: Autenticação de usuários via email/matrícula + senha

---

## 📐 Estrutura Geral

```
├── HEAD
│   ├── Meta tags (PWA, viewport, icons)
│   ├── Tailwind CSS (compilado)
│   ├── Google Fonts (Inter)
│   ├── Firebase config
│   ├── Loader (splash screen)
│   └── Utils (toasts)
│
└── BODY
    ├── Blobs decorativos (fundo)
    ├── Card de login (glassmorphic)
    │   ├── Logo + Título
    │   ├── Inputs (email/matrícula, senha)
    │   ├── Botão login
    │   ├── Link signup
    │   └── Footer (LGPD)
    └── Script module (js/index.js)
```

---

## 🎨 Design & Layout

### Body Background
```css
background-color: #f0f4f8;        /* Azul muito claro */
display: flex;
align-items: center;
justify-content: center;
min-height: 100vh;
min-height: 100dvh;              /* Dynamic viewport height para mobile */
overflow: hidden;                 /* Bloqueia scroll dos blobs */
```

### Blobs Decorativos
```html
<!-- Canto superior esquerdo (azul) -->
<div class="absolute top-0 left-0 w-[40%] h-[40%] bg-blue-300/40 rounded-full blur-[100px]"></div>

<!-- Canto inferior direito (ciano) -->
<div class="absolute bottom-0 right-0 w-[30%] h-[30%] bg-cyan-300/30 rounded-full blur-[100px]"></div>
```

**Posicionamento**:
- `position: absolute` com `top-0 left-0` (ou `bottom-0 right-0`)
- `z-index: 0` para ficar atrás de tudo
- `pointer-events-none` para não bloquear interações
- Cores translúcidas: `bg-blue-300/40` (40% opacidade), `bg-cyan-300/30` (30%)
- Blur extremo: `blur-[100px]` cria mancha suave

### Card de Login (Glassmorphic)

```html
<div class="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] 
            shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] w-full max-w-sm 
            relative z-10 mx-4 border border-white">
```

**Propriedades**:
- `background: rgba(255,255,255,0.9)` — vidro semi-transparente
- `backdrop-filter: blur(24px)` — blur de fundo
- `rounded-[2rem]` — 32px de arredondamento
- `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]` — sombra suave
- `w-full max-w-sm` — full width até 384px (24rem) no teléfone
- `relative z-10` — acima dos blobs
- `mx-4` — margem horizontal no mobile
- `border border-white` — borda branca sutil

**Responsividade**:
- Mobile: `p-6` (24px)
- Desktop: `md:p-8` (32px)

---

## 🏷️ Seção de Logo + Título

### Logo Icon
```html
<div class="w-11 h-11 bg-gradient-to-br from-blue-50 to-blue-100 
            text-blue-600 rounded-xl flex items-center justify-center 
            text-lg font-extrabold mb-3 shadow-sm border border-blue-200/50">
    $
</div>
```

**Especificação**:
- Tamanho: `w-11 h-11` (44x44px)
- Gradiente: `from-blue-50 to-blue-100` (azul muito claro → azul claro)
- Ícone: Símbolo `$` (tamanho lg, extrabold)
- Cor do símbolo: `text-blue-600`
- Border radius: `rounded-xl`
- Sombra: `shadow-sm`
- Borda: `border border-blue-200/50`

### Título + Subtítulo
```html
<h2 class="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">
    Bem-vindo(a)
</h2>
<p class="text-xs text-slate-500 mt-1.5 font-medium">
    Insira seus dados de acesso
</p>
```

**Especificação**:
- Título: `text-xl md:text-2xl` (20px mobile, 24px desktop)
- Font-weight: `font-extrabold` (800)
- Cor: `text-slate-800`
- Tracking: `tracking-tight` para elegância

---

## 📝 Inputs

### Input - Email/Matrícula

```html
<div>
    <label class="block text-xs font-bold text-slate-700 mb-1.5">
        E-mail ou Matrícula
    </label>
    <input 
        type="text" 
        id="identificador" 
        autocomplete="username" 
        placeholder="seu@email.com ou BUD-XXXX-XXXX" 
        class="w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 
               bg-slate-50 focus:bg-white focus:outline-none 
               focus:border-blue-500 font-medium transition-colors 
               text-sm text-slate-800 placeholder-slate-400"
    >
</div>
```

**Especificação**:
- **ID**: `identificador`
- **Type**: `text` (não `email`, para aceitar matrícula também)
- **Autocomplete**: `username` (hint para password manager)
- **Placeholder**: "seu@email.com ou BUD-XXXX-XXXX"
- **Padding**: `px-4 py-2.5`
- **Border**: `border-2 border-slate-100` (2px)
- **Background**: `bg-slate-50` (cinza muito claro)
- **Focus**:
  - `focus:bg-white` (muda para branco)
  - `focus:border-blue-500` (borda azul)
  - `focus:outline-none` (remove outline padrão)
- **Transição**: `transition-colors` (suave)
- **Font**: `font-medium text-sm`

### Input - Senha

```html
<div>
    <label class="block text-xs font-bold text-slate-700 mb-1.5">
        Senha
    </label>
    <div class="relative">
        <input 
            type="password" 
            id="senha" 
            autocomplete="current-password" 
            placeholder="••••••••" 
            class="w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 
                   bg-slate-50 focus:bg-white focus:outline-none 
                   focus:border-blue-500 font-medium transition-colors 
                   text-sm text-slate-800 placeholder-slate-400 pr-10"
        >
        <button 
            type="button" 
            onclick="const i=document.getElementById('senha');
                     i.type=i.type==='password'?'text':'password';
                     this.textContent=i.type==='password'?'👁':'👁‍🗨'" 
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 
                   hover:text-slate-600 text-sm" 
            aria-label="Mostrar/ocultar senha">
            👁
        </button>
    </div>
    <div class="text-right mt-1.5">
        <a href="recuperar-senha.html" 
           class="text-xs font-bold text-blue-600 hover:text-blue-700 
                  hover:underline transition-colors">
            Esqueceu a senha?
        </a>
    </div>
</div>
```

**Especificação**:
- **ID**: `senha`
- **Type**: `password` (mascarado por padrão)
- **Autocomplete**: `current-password`
- **Placeholder**: "••••••••"
- **Padding**: `px-4 py-2.5 pr-10` (extra à direita para botão)

**Botão Show/Hide**:
- **Posicionamento**: `absolute right-3 top-1/2 -translate-y-1/2`
- **Ícone**: Emoji 👁 (eye / eye-off)
- **Comportamento**: Toggle entre `type="password"` e `type="text"`
- **Cor**: `text-slate-400` default, `hover:text-slate-600` no hover
- **Acessibilidade**: `aria-label="Mostrar/ocultar senha"`
- **Sem background**: Só o emoji flutuante

**Link "Esqueceu a senha?"**:
- Rota: `recuperar-senha.html`
- Cor: `text-blue-600` padrão, `text-blue-700` hover
- Transição: `transition-colors`
- Sublinhado no hover

---

## 🔘 Botão Login

```html
<button 
    id="btnLogin" 
    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold 
           py-3 rounded-xl shadow-lg shadow-blue-500/30 
           transition-all text-base mt-2">
    Acessar meu painel
</button>
```

**Especificação**:
- **ID**: `btnLogin`
- **Largura**: `w-full` (100%)
- **Altura**: `py-3` (12px top + bottom = 24px total)
- **Background**: `bg-blue-600` padrão, `hover:bg-blue-700` (escurece)
- **Texto**: branco, `font-extrabold`
- **Sombra**: `shadow-lg shadow-blue-500/30` (sombra azulada)
- **Border radius**: `rounded-xl`
- **Transição**: `transition-all` (suave em todas propriedades)
- **Font size**: `text-base` (16px)
- **Margin**: `mt-2` (8px de espaço acima)

**Estados**:
- **Default**: "Acessar meu painel"
- **Loading**: "Acessando..." (text varia com fetch)
- **Disabled**: `disabled = true` (após clique, até resposta)

---

## 🔗 Links Secundários

### Link Signup
```html
<div class="text-center mt-4">
    <p class="text-sm text-slate-500 font-medium">
        Novo por aqui? 
        <a href="cadastro.html" class="text-blue-600 font-bold 
                                      hover:underline transition-colors">
            Crie sua conta
        </a>
    </p>
</div>
```

**Especificação**:
- Link para: `cadastro.html`
- Cor: `text-blue-600` (mesmo do primário)
- Weight: `font-bold`
- Hover: `hover:underline`
- Transição: `transition-colors`

### Footer LGPD
```html
<div class="text-center mt-4 pt-3 border-t border-slate-100">
    <p class="text-[11px] text-slate-400">
        Ao acessar, você concorda com nossa 
        <a href="politica-privacidade.html" target="_blank" 
           rel="noopener noreferrer" 
           class="text-blue-500 hover:underline font-medium">
            Política de Privacidade
        </a> 
        e com o tratamento dos seus dados conforme a LGPD.
    </p>
</div>
```

**Especificação**:
- Tamanho: `text-[11px]` (bem pequeno)
- Cor: `text-slate-400` (cinza suave)
- Borda superior: `border-t border-slate-100`
- Padding: `pt-3 mt-4`
- Link abre em nova aba: `target="_blank" rel="noopener noreferrer"`

---

## 🔐 Lógica de Autenticação (JavaScript)

### Imports Firebase
```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, sendEmailVerification } 
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } 
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
```

**Versão Firebase**: 10.8.1  
**Módulos**:
- `firebase-app` — inicialização
- `firebase-auth` — autenticação (sign in, sign out, verification)
- `firebase-firestore` — base de dados (queries, documentos)

### Inicialização
```javascript
const firebaseConfig = window.BUD_FIREBASE_CONFIG; // De firebase-config.js
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
```

---

## 🔍 Fluxo de Login

### 1. Validação de Campos
```javascript
const identificador = identificadorInput.value.trim();
const senha = senhaInput.value.trim();

if (!identificador || !senha) {
    window.budShowToast("Por favor, preencha todos os campos!", "warning");
    return;
}
```

**Validações**:
- Campo vazio
- Toast de aviso (amarelo)

### 2. UI Feedback (Loading)
```javascript
btnLogin.innerText = "Acessando...";
btnLogin.disabled = true;
```

**Durante**: 
- Texto muda para "Acessando..."
- Botão desabilitado (não pode clicar novamente)

### 3. Detecção de Tipo (Email ou Matrícula)
```javascript
if (identificador.toUpperCase().startsWith('BUD-') || 
    identificador.toUpperCase().startsWith('NEX-')) {
    email = await buscarEmailPorMatricula(identificador);
    if (!email) {
        window.budShowToast("Credenciais inválidas. Verifique e tente novamente.", "error");
        // Reset button
        return;
    }
} else {
    email = identificador;  // É email diretamente
}
```

**Lógica**:
- Se começa com `BUD-` ou `NEX-` → é matrícula
- Chama `buscarEmailPorMatricula()` para traduzir em email
- Se não achar → erro genérico (não revela se matrícula existe)
- Senão → assume que é email

### 4. Função: Buscar Email por Matrícula
```javascript
async function buscarEmailPorMatricula(matricula) {
    try {
        const q = query(
            collection(db, 'usuarios'), 
            where('matricula', '==', matricula.toUpperCase())
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data().email;
    } catch (e) {
        return null;
    }
}
```

**Especificação**:
- Busca na collection `usuarios`
- Campo: `matricula`
- Compara em uppercase (case-insensitive)
- Retorna email do primeiro resultado
- Se não achar ou erro → `null`

### 5. Firebase Auth: Sign In
```javascript
const userCredential = await signInWithEmailAndPassword(auth, email, senha);
const user = userCredential.user;
```

**O que acontece**:
- Autentica via Firebase Auth
- Retorna `user` com `uid`, `email`, `emailVerified`, etc.
- Se falhar → lança erro (catchado abaixo)

### 6. Buscar Dados do Usuário no Firestore
```javascript
const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
const userData = userDoc.exists() ? userDoc.data() : {};
```

**Recupera**:
- Documento do usuário em `db.usuarios[user.uid]`
- Propriedades possíveis: `bloqueado`, `emailVerificationRequired`, `primeiroLogin`, etc.

### 7. Validação: Conta Bloqueada
```javascript
if (userData.bloqueado === true) {
    window.budShowToast('⛔ Sua conta foi bloqueada. Entre em contato com o suporte.', 'error');
    await signOut(auth);
    btnLogin.innerText = 'Acessar meu painel';
    btnLogin.disabled = false;
    return;
}
```

**Comportamento**:
- Se `bloqueado === true` → nega acesso
- Faz logout automático
- Toast error vermelho
- Reset button para nova tentativa

### 8. Validação: Email não Verificado
```javascript
if (userData.emailVerificationRequired === true && !user.emailVerified) {
    const resend = await new Promise(resolve => {
        // Modal com 2 opções: "Não" ou "Reenviar"
        // Retorna true se clicar "Reenviar"
    });
    if (resend) {
        await sendEmailVerification(user);
        window.budShowToast('Email de verificação reenviado!...', 'success');
    }
    await signOut(auth);
    // Reset button
    return;
}
```

**Comportamento**:
- Se é primeira vez E email não verificado → bloqueia acesso
- Abre modal perguntando se quer reenviar email
- Se sim: `sendEmailVerification(user)` e toast success
- Se não: fecha modal
- Faz logout automático
- Retorna sem entrar na app

**Modal Customizado**:
- Fundo: `bg-black/50` overlay
- Card: `bg-white rounded-2xl p-6 max-w-sm`
- Dois botões: "Não" (slate), "Reenviar" (verde)
- Usa Promise para esperar resultado

### 9. Redirecionamento: Primeiro Login
```javascript
if (userData.primeiroLogin === true) {
    window.location.href = "trocar-senha.html";
} else {
    window.location.href = "dashboard.html";
}
```

**Fluxo**:
- Se primeira vez após cadastro → força mudar senha (trocar-senha.html)
- Senão → vai direto para dashboard

### 10. Tratamento de Erros
```javascript
} catch (error) {
    console.error("Erro no login:", error);
    if (error.code === 'auth/too-many-requests') {
        window.budShowToast("Muitas tentativas. Aguarde alguns minutos.", "error");
    } else if (error.code === 'auth/user-disabled') {
        window.budShowToast("Conta desativada. Entre em contato com o suporte.", "error");
    } else {
        window.budShowToast("E-mail/matrícula ou senha incorretos.", "error");
    }
    btnLogin.innerText = "Acessar meu painel";
    btnLogin.disabled = false;
}
```

**Códigos de Erro Específicos**:
- `auth/too-many-requests` — rate limit (proteção contra brute force)
- `auth/user-disabled` — usuário desativado pelo admin
- Default → email/matrícula ou senha incorretos (genérico, sem revelar qual)

**Reset Button**: sempre restaura texto original e re-habilita

---

## ⌨️ Keybindings (Usabilidade)

### Enter no Email → Foca Senha
```javascript
identificadorInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        senhaInput.focus();
    }
});
```

### Enter na Senha → Envia Login
```javascript
senhaInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        btnLogin.click();
    }
});
```

**User Experience**:
- Tabulação natural: email → senha → botão
- Enter avança na mesma sequência
- Sem `e.preventDefault()` → submissão padrão (indesejada)

---

## 🔒 Segurança

### Password Manager Support
- `autocomplete="username"` no email
- `autocomplete="current-password"` na senha
- Cookies vs localStorage: Firebase Auth usa cookies automaticamente

### Sem Exposição de Dados
- Erro genérico para email/matrícula inválidos (não revela qual)
- Erro genérico para senha falha
- `buscarEmailPorMatricula` retorna `null` silenciosamente

### Rate Limiting
- Firebase Auth bloqueia após ~5 tentativas em 1-2 minutos
- Mensagem: "Muitas tentativas. Aguarde alguns minutos."

### LGPD & Privacidade
- Footer com link explícito para "Política de Privacidade"
- Nova aba: `target="_blank" rel="noopener noreferrer"`
- Aviso claro sobre tratamento de dados

---

## 📱 Responsividade

| Elemento | Mobile | Desktop |
|---|---|---|
| **Card max-width** | `max-w-sm` sempre, mas com `mx-4` | Sem mx, fica 384px |
| **Padding** | `p-6` (24px) | `md:p-8` (32px) |
| **Título** | `text-xl` (20px) | `md:text-2xl` (24px) |
| **Input height** | `py-2.5` (10px) | mesmo |
| **Botão height** | `py-3` (12px) | mesmo |

**Teste em**:
- iPhone SE (375px)
- iPhone 12 (390px)
- iPad (768px)
- Desktop (1280px+)

---

## 🧪 Estados Possíveis

| Estado | Indicadores | Ação |
|---|---|---|
| **Inicial** | Inputs vazios, botão habilitado | Espera input |
| **Preenchido** | Inputs com texto, botão ativo | Pronto para login |
| **Loading** | Botão: "Acessando...", disabled | Requisição em andamento |
| **Erro** | Toast vermelho, botão habilitado novamente | Tenta novamente |
| **Sucesso (comum)** | Redireção para dashboard | Auto redirect |
| **Sucesso (primeiro login)** | Redireção para trocar-senha.html | Força trocar senha |
| **Email não verificado** | Modal com opção reenvio | Escolhe reenviar ou volta |
| **Conta bloqueada** | Toast erro, logout | Contata suporte |

---

## 🎯 Fluxo Visual Completo

```
1. Usuário chega em index.html
   ↓
2. Splash screen (700-6000ms)
   ↓
3. Vê card de login com blobs atrás
   ↓
4. Preenche email/matrícula
   → Enter (ou click) → foca senha
   ↓
5. Preenche senha
   → Pode clicar no ícone olho para ver/ocultar
   → Enter → clica botão
   ↓
6. Clica "Acessar meu painel"
   → Botão muda para "Acessando..."
   → Botão fica disabled
   ↓
7a. LOGIN BEM-SUCEDIDO:
   → Redireciona para dashboard.html OU trocar-senha.html
   → (Ou modal se email não verificado)
   ↓
7b. LOGIN FALHOU:
   → Toast com erro específico
   → Botão volta ao normal
   → Usuário pode tentar novamente
   ↓
8. Em qualquer momento:
   → "Esqueceu a senha?" → recuperar-senha.html
   → "Crie sua conta" → cadastro.html
```

---

## 📋 Checklist de Implementação

- [ ] Card com glassmorphism (backdrop-filter)
- [ ] Blobs decorativos (azul + ciano)
- [ ] Logo com gradiente azul
- [ ] Input email/matrícula com label
- [ ] Input senha com toggle show/hide
- [ ] Link "Esqueceu a senha?"
- [ ] Botão login com estados (default, hover, loading, disabled)
- [ ] Link "Crie sua conta"
- [ ] Footer LGPD com link
- [ ] Firebase Auth importado (ES6 modules)
- [ ] Função `buscarEmailPorMatricula()` conectada ao Firestore
- [ ] Keybindings Enter (email → senha → submit)
- [ ] Validação de campos vazios
- [ ] Detecção de matrícula vs email
- [ ] Verificação de account disabled
- [ ] Verificação de email não verificado (com modal reenvio)
- [ ] Redirecionamento após login
- [ ] Tratamento de erros com toast específicos
- [ ] Rate limiting feedback
- [ ] Dark mode compatibilidade

---

## 🌙 Dark Mode Considerações

- Background body: muda de `#f0f4f8` para `#0f172a`
- Card glassmorphic: ajusta opacidade/cor
- Inputs: background escuro, texto claro
- Blobs: ajustar opacidade ou remover (opcional)

**CSS a adicionar** (em dark-mode.js):
```css
body.dark { background-color: #0f172a !important; }
body.dark #identificador,
body.dark #senha { 
  background: #1e293b !important; 
  color: #e2e8f0 !important; 
  border-color: #334155 !important;
}
body.dark .bg-white\/90 { background: rgba(30,41,59,0.9) !important; }
body.dark .text-slate-800 { color: #e2e8f0 !important; }
body.dark .text-slate-500 { color: #94a3b8 !important; }
```

---

## ♿ Acessibilidade

- Label associada ao input: `<label for="identificador">`
- Botão show/hide: `aria-label="Mostrar/ocultar senha"`
- Contraste: WCAG AA (branco em azul: 5.5:1)
- Focus visible: inputs têm `focus:outline-none + focus:border-blue-500`
- Semântica: `<button>`, `<input>`, `<label>` são corretos
- Teclado: Tab, Enter funcionam

---

## 🚀 Otimizações

- **Lazy loading**: Splash screen já carrega Firebase modules
- **Module imports**: Usa ESM, não bloqueia DOM
- **No localStorage required**: Firebase Auth gerencia sessão via cookies
- **Minimal re-renders**: JavaScript puro, sem framework
- **Icons**: Emojis (sem HTTP requests)

---

## 📊 Fluxo de Dados

```
Usuário digita
    ↓
    ↓ (Enter ou click)
    ↓
Validação JS
    ↓
    ├─→ Vazio? Toast warning → FIM
    ├─→ É matrícula? Query Firestore (usuarios)
    │   └─→ Acha email? Continua
    │   └─→ Não? Toast erro → FIM
    └─→ É email? Continua
        ↓
Firebase Auth: signInWithEmailAndPassword
    ├─→ Falha? Erro específico → FIM
    └─→ Sucesso → user.uid
        ↓
Query Firestore: doc(usuarios/uid)
    ├─→ bloqueado === true? Toast + logout → FIM
    ├─→ emailVerificationRequired && !emailVerified? 
    │   Modal "reenviar?" → sendEmailVerification ou logout → FIM
    └─→ Tudo OK?
        ├─→ primeiroLogin === true? → trocar-senha.html
        └─→ Senão → dashboard.html
```

---

## 💾 Dados Salvos

- **Login Form**: Nada é salvo em localStorage voluntariamente
- **Firebase Auth**: Gerencia `sessionStorage` + cookies automaticamente
- **Dark Mode**: Salvo em `localStorage.nexo_dark_mode`
- **User Session**: Persistida via Firebase (`onAuthStateChanged`)

---

## 🔗 Páginas Relacionadas

| Página | Rota | Propósito |
|---|---|---|
| **Cadastro** | `cadastro.html` | Novo usuário |
| **Recuperar Senha** | `recuperar-senha.html` | Reset senha |
| **Trocar Senha** | `trocar-senha.html` | Primeiro login |
| **Ação Auth** | `acao-auth.html` | Processar reset (link email) |
| **Dashboard** | `dashboard.html` | App principal após login |
| **Política de Privacidade** | `politica-privacidade.html` | LGPD |

---

## 🔗 Fluxo Completo de Autenticação (Mapa Mental)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE AUTENTICAÇÃO                        │
└─────────────────────────────────────────────────────────────────────┘

NOVO USUÁRIO:
  1. cadastro.html
     ├─ Preenche: nome, email, WhatsApp
     ├─ Código de indicação (opcional)
     └─ Clica "Criar conta"
        ↓
  2. Backend cria usuário no Firebase + Firestore
     ├─ primeiroLogin: true
     ├─ emailVerificationRequired: true
     └─ Envia email de verificação
        ↓
  3. User clica link no email
     → Email é marcado como verificado
        ↓
  4. Tenta fazer login em index.html
     └─→ trocar-senha.html (obrigatório)
        ↓
  5. trocar-senha.html
     ├─ Mostra nome do usuário
     ├─ Força digitar nova senha
     └─ Após salvar → primeiroLogin: false
        ↓
  6. Redireciona pra dashboard.html ✅

USUÁRIO EXISTENTE (login normal):
  1. index.html
     ├─ Digita email/matrícula
     ├─ Digita senha
     └─ Clica "Acessar"
        ↓
  2. Validações:
     ├─ Bloqueado? → Toast erro, logout
     ├─ Email não verificado? → Modal "Reenviar?"
     └─ Tudo OK? → vai pra dashboard ✅

ESQUECEU A SENHA:
  1. index.html → "Esqueceu a senha?"
     ↓
  2. recuperar-senha.html
     ├─ Digita email
     └─ Clica "Enviar link"
        ↓
  3. Backend envia email com link
     └─ Link contém oobCode
        ↓
  4. User clica link
     ↓
  5. acao-auth.html carrega
     ├─ Valida oobCode
     ├─ Mostra form "Nova senha"
     └─ User digita + confirma
        ↓
  6. Reset realizado
     └─ Redireciona pra login ✅
```

---

## 📄 Página: `acao-auth.html` — Processar Reset de Senha

**Propósito**: Essa página processa o link de reset que chega no email.

### Estrutura
```html
<!-- Recebe da URL -->
?mode=resetPassword&oobCode=ABC123XYZ789

<!-- Página mostra 3 estados -->
1. #loadingSection → Validando código...
2. #resetForm → Formulário de nova senha (se código válido)
3. #successSection → ✅ Senha redefinida!
4. #errorSection → ❌ Link expirou ou inválido
```

### Fluxo (detalhado)

```javascript
// 1. Pega parâmetros da URL
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');        // "resetPassword"
const oobCode = urlParams.get('oobCode');  // Código único do Firebase

// 2. Valida o código
const email = await auth.verifyPasswordResetCode(oobCode);
// Se válido → retorna email associado
// Se inválido → lança erro (código expirou, inválido, etc)

// 3. User vê o formulário para digitar nova senha
// - Campo "Nova Senha" com validator de força
// - 4 barras de progresso: Muito fraca → Fraca → Boa → Forte
// - Campo "Confirmar Senha" pra match checking

// 4. User clica "Salvar nova senha"
await auth.confirmPasswordReset(oobCode, novaSenha);

// 5. Sucesso!
// Mostra: "✅ Sua senha foi alterada!"
// Botão: "Ir para o login"
// Redireciona pra index.html
```

### Indicador de Força (4 barras)

```javascript
function verificarForca(senha) {
    let forca = 0;
    
    if (senha.length >= 6) forca++;           // Barra 1: mín 6 chars
    if (senha.length >= 8) forca++;           // Barra 2: 8 chars
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) 
        forca++;                               // Barra 3: maiúscula+minúscula
    if (/[0-9]/.test(senha) || /[^A-Za-z0-9]/.test(senha)) 
        forca++;                               // Barra 4: números ou símbolos
    
    const cores = ['red', 'orange', 'yellow', 'green'];
    const textos = ['Muito fraca', 'Fraca', 'Boa', 'Forte'];
    
    // Atualiza 4 barras
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById(`bar${i}`);
        // Se passou no nível i → cor forte, senão → cinza
        bar.style.background = i <= forca ? cores[forca-1] : '#e2e8f0';
    }
    
    // Texto dinâmico
    const txt = document.getElementById('forcaTexto');
    txt.textContent = textos[forca - 1] || '';
}
```

### Tratamento de Erros

```javascript
try {
    const email = await auth.verifyPasswordResetCode(oobCode);
} catch (error) {
    if (error.code === 'auth/expired-action-code') {
        // Código expirou (após ~24h)
        mostrarErro('Link expirou. Solicite um novo.');
        
    } else if (error.code === 'auth/invalid-action-code') {
        // Código inválido (nunca existiu, foi alterado, etc)
        mostrarErro('Link inválido ou já foi usado.');
        
    } else if (error.code === 'auth/user-disabled') {
        // Usuário foi desativado/bloqueado
        mostrarErro('Sua conta foi desativada.');
    }
}
```

---

## 📄 Página: `trocar-senha.html` — Primeira Mudança de Senha

**Propósito**: Obriga o usuário a trocar a senha temporária/padrão ao primeiro login.

### Quando aparece?

```javascript
// No login (index.html)
if (userData.primeiroLogin === true) {
    window.location.href = "trocar-senha.html";
    // Redireciona ANTES de ir pro dashboard
}
```

### Fluxo

```
User faz login pela PRIMEIRA VEZ
    ↓
Sistema detecta: primeiroLogin === true
    ↓
Redireciona pra trocar-senha.html
    ↓
Página carrega:
    1. Verificação de autenticação
    2. Busca dados do usuário no Firestore
    3. Mostra:
       ├─ Avatar com inicial do nome
       ├─ Nome do usuário
       ├─ Matrícula (se houver)
       └─ Aviso: "Por segurança, crie uma senha forte"
    ↓
User digita:
    • Nova Senha (mín 6 chars)
    • Confirmar Senha (match checker)
    ↓
User clica "Salvar nova senha"
    ↓
Backend:
    1. Valida se senhas coincidem
    2. Chama: updatePassword(user, novaSenha)
    3. Atualiza Firestore: primeiroLogin: false
    ↓
Sucesso!
    └─ Redireciona pra dashboard.html ✅
```

### Código do Backend (trocar-senha.js)

```javascript
async function salvarNovaSenha() {
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmar = document.getElementById('confirmarSenha').value;
    
    // Validações
    if (novaSenha.length < 6) {
        budShowToast('Mínimo 6 caracteres', 'error');
        return;
    }
    if (novaSenha !== confirmar) {
        budShowToast('As senhas não coincidem', 'error');
        return;
    }
    
    try {
        // Muda senha no Firebase Auth
        await updatePassword(user, novaSenha);
        
        // Marca como: já trocou a senha
        await updateDoc(doc(db, 'usuarios', user.uid), {
            primeiroLogin: false
        });
        
        // Sucesso!
        budShowToast('Senha alterada! Redirecionando...', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    } catch (error) {
        budShowToast('Erro ao trocar senha: ' + error.message, 'error');
    }
}
```

### Indicador de Força (igual ao acao-auth)
Mesma lógica das 4 barras usado em acao-auth.html.

---

## 📄 Página: `recuperar-senha.html` — Solicitar Reset

**Propósito**: User pede para resetar a senha (esqueceu).

### Fluxo

```
User clica "Esqueceu a senha?" em index.html
    ↓
Vai pra recuperar-senha.html
    ↓
Mostra form simples:
    • Input de email
    • Botão "Enviar link de recuperação"
    ↓
User digita email + clica
    ↓
Frontend faz POST pra Cloud Function:
    to: /reset-senha
    body: { email: "usuario@example.com" }
    ↓
Backend recebe:
    1. Valida se email existe (Firebase Auth)
    2. Chama: sendPasswordResetEmail(email)
    3. Firebase envia email automaticamente
    ↓
Resposta ao user:
    ✅ Toast success:
    "Se este e-mail estiver cadastrado,
     você receberá um link em instantes.
     Verifique também a caixa de spam."
    ↓
User vê email >>> clica link >>> vai pra acao-auth.html
```

### Código (recuperar-senha.js)

```javascript
document.getElementById('btnRecuperar').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    
    if (!email) {
        budShowToast('Digite seu e-mail', 'error');
        return;
    }
    
    // Validação básica
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        budShowToast('E-mail inválido', 'error');
        return;
    }
    
    const btn = document.getElementById('btnRecuperar');
    btn.innerText = "Enviando...";
    btn.disabled = true;
    
    try {
        const res = await fetch(BUD_FUNCTIONS_URL + '/reset-senha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        const data = await res.json();
        
        if (data.success) {
            budShowToast(
                'Se cadastrado, você receberá o link. Verifique spam.',
                'success'
            );
            // Redireciona pro login
            window.location.href = "index.html";
        } else {
            budShowToast('Erro ao enviar. Tente novamente.', 'error');
        }
    } catch (error) {
        budShowToast('Erro: ' + error.message, 'error');
    } finally {
        btn.innerText = "Enviar link de recuperação";
        btn.disabled = false;
    }
});
```

---

## 📄 Página: `cadastro.html` — Sign-Up Completo

**Propósito**: Novo usuário se registra.

### Campos do Formulário

```html
1. Nome Completo (obrigatório)
   - Tipo: text
   - ID: #nome
   - Placeholder: "Seu nome completo"

2. E-mail (obrigatório)
   - Tipo: email
   - ID: #email
   - Placeholder: "seu@email.com"
   - Validação: RFC 5322 básico

3. WhatsApp (obrigatório)
   - Tipo: tel
   - ID: #telefone
   - Placeholder: "(00) 00000-0000"
   - Mascarado ou free input

4. Código de Indicação (OPCIONAL)
   - Tipo: text
   - ID: #codigoIndicacao
   - Placeholder: "Ex: A1B2C3D4"
   - Max 8 caracteres
   - Maiúscula automática (uppercase)
   - Benefício visual: "🎁 Ganhe 30% de desconto no seu 1º plano!"
```

### Fluxo Completo de Signup

```javascript
// 1. User preenche formulário
const nome = document.getElementById('nome').value;
const email = document.getElementById('email').value;
const telefone = document.getElementById('telefone').value;
const codigoIndicacao = document.getElementById('codigoIndicacao').value;

// 2. Validações
if (!nome.trim() || !email.trim() || !telefone.trim()) {
    budShowToast('Preencha todos os campos obrigatórios', 'error');
    return;
}

// 3. Valida código de indicação (se preenchido)
if (codigoIndicacao.trim()) {
    const q = query(
        collection(db, 'usuarios'),
        where('codigoIndicacao', '==', codigoIndicacao.toUpperCase())
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
        budShowToast('Código de indicação inválido.', 'error');
        return;
    }
}

// 4. Backend cria usuário
const senhaTemporaria = gerarSenhaTemp(); // Ex: "Temp123456"

const userCredential = await createUserWithEmailAndPassword(
    auth, 
    email, 
    senhaTemporaria
);

// 5. Atualiza perfil Firebase Auth
await updateProfile(userCredential.user, {
    displayName: nome
});

// 6. Salva no Firestore
const docRef = doc(db, 'usuarios', userCredential.user.uid);
await setDoc(docRef, {
    nome: nome,
    email: email,
    telefone: telefone,
    plano: 'trial',                      // Acesso 3 dias grátis
    primeiroLogin: true,                 // Deve trocar senha depois
    emailVerified: false,
    dataCadastro: serverTimestamp(),
    codigoIndicacao: gerarCodigoUnico(), // String 8 chars aleatória
    
    // Se foi indicado
    indicadoPor: codigoIndicacao ? {
        codigo: codigoIndicacao.toUpperCase(),
        uid: indicadorUid,
        nome: indicadorNome,
        dataIndicacao: serverTimestamp()
    } : null,
    
    // Benefício
    descontoIndicacao: codigoIndicacao ? 30 : 0,
    descontoIndicacaoUsado: false
});

// 7. Envia email de verificação (Firebase nativa)
await sendEmailVerification(userCredential.user);

// 8. Envia email com credenciais (via EmailJS)
await emailjs.send(EMAILJS_SERVICE_ID, 'signup_template', {
    to_email: email,
    to_name: nome,
    nome: nome,
    email: email,
    telefone: telefone,
    senhaTemporaria: senhaTemporaria,
    linkVerificacao: `${APP_URL}/?verifyEmail=${oobCode}`,
    linkLogin: APP_URL
});

// 9. Se foi indicado, atualiza documento do indicador
if (codigoIndicacao) {
    const indicadorRef = doc(db, 'usuarios', indicadorUid);
    const indicadorSnap = await getDoc(indicadorRef);
    
    const indicacoes = indicadorSnap.data().indicacoes || [];
    indicacoes.push({
        uid: userCredential.user.uid,
        nome: nome,
        email: email,
        dataIndicacao: serverTimestamp(),
        assinouPlano: false
    });
    
    await updateDoc(indicadorRef, {
        indicacoes: indicacoes,
        totalIndicacoes: increment(1)
    });
}

// 10. Sucesso!
budShowToast(
    'Conta criada! Verifique seu e-mail para ativar.',
    'success'
);

// Redireciona pro login
setTimeout(() => {
    window.location.href = 'index.html';
}, 2000);
```

### Código de Indicação (Geração + Validação)

```javascript
// Gera código único 8 chars (MAIÚSCULA + NÚMEROS)
function gerarCodigoUnico() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
}

// Verifica se código já existe (loop até gerar único)
async function gerarCodigoUnicoValidado(tentativas = 0) {
    if (tentativas > 10) throw new Error('Falha ao gerar código');
    
    const codigo = gerarCodigoUnico();
    
    const q = query(
        collection(db, 'usuarios'),
        where('codigoIndicacao', '==', codigo)
    );
    const snap = await getDocs(q);
    
    // Se já existe, tenta novamente
    if (!snap.empty) {
        return gerarCodigoUnicoValidado(tentativas + 1);
    }
    
    return codigo;
}
```

### UX Detalhes do Cadastro

```html
<!-- Header com logo e título -->
<div class="text-center mb-8">
    <img src="logo.png" alt="Bud" class="h-12 mx-auto mb-4" />
    <h1 class="text-2xl font-bold text-gray-900">Crie sua conta</h1>
    <p class="text-gray-500 text-sm mt-2">Use seu email e WhatsApp para se registrar</p>
</div>

<!-- Badge de benefício (3 dias grátis) -->
<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 mb-6">
    <span class="text-2xl">🎁</span>
    <div>
        <p class="text-sm font-semibold text-blue-900">3 Dias Grátis!</p>
        <p class="text-xs text-blue-700">Sem cartão de crédito</p>
    </div>
</div>

<!-- Lista de benefícios -->
<div class="space-y-2 mb-6">
    <div class="flex items-center gap-2 text-sm">
        <span class="text-indigo-600">✓</span>
        <span class="text-gray-700">Gestão completa de finanças</span>
    </div>
    <div class="flex items-center gap-2 text-sm">
        <span class="text-indigo-600">✓</span>
        <span class="text-gray-700">Relatórios e gráficos em tempo real</span>
    </div>
    <div class="flex items-center gap-2 text-sm">
        <span class="text-indigo-600">✓</span>
        <span class="text-gray-700">Insights com IA</span>
    </div>
</div>

<!-- Formulário -->
<form id="formCadastro" class="space-y-4">
    <!-- Nome -->
    <input type="text" id="nome" placeholder="Seu nome completo" required />
    
    <!-- Email -->
    <input type="email" id="email" placeholder="seu@email.com" required />
    
    <!-- WhatsApp -->
    <input type="tel" id="telefone" placeholder="(00) 00000-0000" required />
    
    <!-- Código de indicação -->
    <input 
        type="text" 
        id="codigoIndicacao" 
        placeholder="Código de indicação (opcional)"
        maxlength="8"
        style="text-transform: uppercase"
    />
    
    <!-- Checkbox termos -->
    <label class="flex items-start gap-2 text-xs">
        <input type="checkbox" id="aceiteTermos" required />
        <span class="text-gray-600">
            Eu aceito os 
            <a href="politica-privacidade.html" class="text-indigo-600 underline">
                Termos de Uso
            </a>
        </span>
    </label>
    
    <!-- Botão -->
    <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold">
        Criar conta
    </button>
</form>

<!-- Link para login -->
<div class="text-center mt-4">
    <span class="text-gray-600 text-sm">
        Já tem conta?
        <a href="index.html" class="text-indigo-600 font-semibold">Faça login</a>
    </span>
</div>
```

---

## � Bloqueio e Desbloqueio de Conta

### Quando uma Conta é Bloqueada?

No login, o sistema verifica:
```javascript
if (userData.bloqueado === true) {
    window.budShowToast('⛔ Sua conta foi bloqueada. Entre em contato com o suporte.', 'error');
    await signOut(auth);
    // Logout automático, usuário não consegue entrar
}
```

**Cenários de bloqueio**:
- Admin bloqueia manualmente (spam, violação de termos, etc)
- Detecção automática de fraude (futuro)
- Conta reportada por outro usuário (futuro)

### Desbloqueio no Admin Panel

Apenas **admins** (`role: 'admin'`) podem desbloquear. Processo:

#### 1. Acessar Admin Panel
```
Acessa: admin.html
Auth verifica: user.role === 'admin'
Se sim → painel administrativo fica visível
Se não → "Acesso negado"
```

#### 2. Ir até a Seção CRM
```
Dashboard admin
  → Clica aba "CRM"
  → Lista todos os usuários com paginação
```

#### 3. Procurar o Usuário
```
Campo de busca: nome ou email
Filtros disponíveis:
  • Plano (Free, Trial, Starter, Pro, Plus)
  • Engajamento (Heavy User, Regular, Em Risco, Inativo)
```

#### 4. Botão Block/Unblock
```
Na linha de cada usuário:

Se bloqueado (bloqueado === true):
  → Botão aparece VERDE: "Unblock"
  
Se liberado (bloqueado === false):
  → Botão aparece VERMELHO: "Block"
```

#### 5. Clicar para Alternar
```javascript
window.toggleBlock = async function(uid, blocked) {
    // blocked = true se tá bloqueado, false se tá liberado
    
    // 1. Abre modal de confirmação
    const ov = document.createElement('div');
    ov.innerHTML = `
        <div>
            <p>${blocked ? 'Desbloquear?' : 'Bloquear este usuário?'}</p>
            <button id="_mN">Não</button>
            <button id="_mS">Sim</button>
        </div>
    `;
    
    // 2. Se clicar "Não" → cancela
    if (!ok) return;
    
    // 3. Se clicar "Sim" → atualiza Firestore
    await updateDoc(doc(db, 'usuarios', uid), { 
        bloqueado: !blocked  // Inverte: true→false, false→true
    });
    
    // 4. Recarrega lista
    await loadUsers(crmPage);
}
```

### Dados no Firestore

```firestore
usuarios/
  ├─ uid-12345
  │   ├─ nome: "João Silva"
  │   ├─ email: "joao@email.com"
  │   ├─ bloqueado: false  ← Campo booleano
  │   ├─ plano: "pro"
  │   └─ ...
  └─ uid-67890
      ├─ nome: "Maria Santos"
      ├─ email: "maria@email.com"
      ├─ bloqueado: true   ← Bloqueado!
      └─ ...
```

---

## 📧 Sistemas de Email

### Visão Geral: 3 Tipos de Email

O app usa **3 serviços diferentes** de envio:

| Tipo | Serviço | Gatilho | Link no Email | Automático |
|---|---|---|---|---|
| **1. Verificação de Email** | Firebase Auth | Novo cadastro | ✅ Sim (Firebase) | ✅ Sim |
| **2. Recuperação de Senha** | Firebase Auth + Cloud Function | User clica "Esqueceu" | ✅ Sim (Firebase) | ✅ Sim |
| **3. Relatórios/Chamados** | EmailJS | User reporta bug/sugestão | ❌ Não (notificação interna) | ❌ Manual |

---

### 1️⃣ Verificação de Email (Firebase Auth Nativo)

**Fluxo**:
```
Novo usuário se cadastra (cadastro.html)
    ↓
Backend salva no Firestore:
    • emailVerificationRequired: true
    • emailVerified: false
    ↓
Quando user tenta fazer LOGIN:
    
    if (userData.emailVerificationRequired === true && !user.emailVerified) {
        // Email NÃO foi verificado ainda
        
        // Abre MODAL: "⚠️ Email não verificado!"
        // Oferece 2 opções:
        // ├─ "Não" → logout
        // └─ "Reenviar" → sendEmailVerification(user)
    }
    ↓
Se clicar "Reenviar":
    await sendEmailVerification(user);
    // Firebase envia email automaticamente
    ↓
Email chega com:
    Assunto: "Confirme seu email para acessar Bud Finanças"
    Link: https://seu-app.firebaseapp.com/...
    // Link de confirmação (padrão do Firebase)
    ↓
User clica link
    → Email é marcado como verificado no Firebase Auth
    ↓
Na próxima tentativa de login:
    if (!user.emailVerified) → pula esta verificação
    → Consegue entrar!
```

**Especificação técnica**:
```javascript
// No auth do Firebase
import { sendEmailVerification } from "firebase/auth";

// Enviando verificação
await sendEmailVerification(user);

// No login, verifica
if (!user.emailVerified && userData.emailVerificationRequired) {
    // Bloqueia acesso
}
```

**Modal de Reenvio**:
```javascript
const resend = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
    ov.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm">
            <p class="text-sm font-bold">⚠️ Email não verificado!</p>
            <p class="text-xs text-slate-500 mb-4">
                Você precisa clicar no link enviado para seu email
                antes de acessar o app.
                <br><br>
                Deseja reenviar o email?
            </p>
            <div class="flex gap-3">
                <button id="_mN">Não</button>
                <button id="_mS">Reenviar</button>
            </div>
        </div>
    `;
    document.body.appendChild(ov);
    ov.querySelector('#_mN').onclick = () => { ov.remove(); resolve(false); };
    ov.querySelector('#_mS').onclick = () => { ov.remove(); resolve(true); };
});

if (resend) {
    await sendEmailVerification(user);
    budShowToast('Email reenviado!', 'success');
}
```

---

### 2️⃣ Recuperação de Senha (Firebase Auth + Cloud Function)

**Fluxo Completo**:
```
User clica "Esqueceu a senha?" (em index.html)
    ↓
Vai pra: recuperar-senha.html
    ↓
Digita email: usuario@example.com
    ↓
Clica "Enviar link de recuperação"
    ↓
Frontend faz POST:
    to: /reset-senha
    body: { email: "usuario@example.com" }
    ↓
Cloud Function (backend) recebe:
    1. Valida se email existe
    2. Chama: sendPasswordResetEmail(email)
    3. Firebase envia email automaticamente
    ↓
Email chega com:
    Assunto: "Redefinir sua senha no Bud Finanças"
    Link: https://seu-app.firebaseapp.com/...?
           mode=resetPassword&oobCode=ABC123XYZ
    ↓
User clica link
    ↓
Página acao-auth.html carrega:
    1. Extrai otobCode da URL
    2. Valida com: verifyPasswordResetCode(oobCode)
    3. Se válido → mostra formulário "Digite nova senha"
    ↓
User digita:
    • Nova senha (com validação de força)
    • Confirmar senha (match checker)
    ↓
Clica "Salvar nova senha"
    ↓
Backend chama:
    await auth.confirmPasswordReset(oobCode, novaSenha);
    ↓
Resultado:
    Se sucesso → mostra: "✅ Senha alterada com sucesso!"
                → Redireciona pra login
                → Consegue fazer login com nova senha
    Se erro → talvez link expirou ou já foi usado
```

**Códigos de Erro**:
```javascript
if (error.code === 'auth/expired-action-code') {
    // Link expirou (padrão 24 horas)
    // Solução: Solicitar novo link
}
if (error.code === 'auth/invalid-action-code') {
    // Link já foi usado
    // Solução: Solicitar novo link
}
if (error.code === 'auth/weak-password') {
    // Senha muito fraca
    // Solução: Digitar senha com 6+ caracteres
}
```

**Indicador de Força de Senha** (na página):
```javascript
document.getElementById('novaSenha').addEventListener('input', function() {
    const senha = this.value;
    
    let forca = 0;
    if (senha.length >= 6) forca++;      // +1: mínimo 6 chars
    if (senha.length >= 8) forca++;      // +1: 8 chars
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) forca++;  // +1: maiúscula + minúscula
    if (/[0-9]/.test(senha) || /[^A-Za-z0-9]/.test(senha)) forca++;  // +1: números ou símbolos
    
    // Mostra 4 barras coloridas
    const cores = ['red', 'orange', 'yellow', 'green'];
    const textos = ['Muito fraca', 'Fraca', 'Boa', 'Forte'];
    
    for (let i = 1; i <= 4; i++) {
        bar.style.background = i <= forca ? cores[forca-1] : 'lightgray';
    }
});
```

---

### 3️⃣ Chamados/Bugs (EmailJS)

**Fluxo**:
```
User encontra um bug em qualquer página
    ↓
Vai em: Configurações → "Reportar Bug/Sugestão"
    ↓
Preenche formulário:
    • Tipo: Bug | Sugestão
    • Descrição: "O app trava ao..."
    ↓
Clica "Enviar Chamado"
    ↓
Frontend faz POST:
    to: /chamado
    body: {
        tipo: 'bug',
        descricao: '...',
        nomeUsuario: 'João',
        emailUsuario: 'joao@email.com'
    }
    ↓
Cloud Function (backend) recebe:
    1. Salva no Firestore (collection: chamados)
    2. Chama EmailJS API
    ↓
EmailJS envia email PRO ADMIN:
    to: budsolucoes@gmail.com
    Assunto: 🐛 Bug / 💡 Sugestão de [João]
    Conteúdo:
        • Tipo: Bug / Sugestão
        • Usuário: João
        • Email: joao@email.com
        • Descrição completa
        • Data/hora
    ↓
Admin recebe email
    ├─ Pode responder direto pro user
    ├─ Acessa Firestore pra ver mais detalhes
    └─ Pode responder via app (painel admin)
    ↓
User vê status do chamado:
    • Aberto
    • Em andamento
    • Resolvido
```

**Configuração EmailJS** (variáveis de ambiente):
```
EMAILJS_SERVICE_ID = "service_abc123def456"
EMAILJS_TEMPLATE_ID = "template_xyz789uvw"
EMAILJS_PUBLIC_KEY = "public_key_..."
EMAILJS_PRIVATE_KEY = "private_key_..."
```

**Código no Backend**:
```javascript
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
            to_email: "budsolucoes@gmail.com",
            name: `🐛 Bug de ${nomeUsuario}`,
            email: emailUsuario,
            description: descricao,
            timestamp: new Date().toLocaleString("pt-BR")
        }
    })
});
```

**Rate Limiting**:
```javascript
const chamadoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutos
    max: 5,                     // máximo 5 chamados
    message: { error: "Muitos chamados. Aguarde um pouco." }
});
```
- User consegue fazer até **5 chamados a cada 15 minutos**
- Se exceder → recebe toast de erro

---

## �🐛 Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| "Credenciais inválidas" sempre | Firebase config errado | Verificar `firebase-config.js` |
| Toast não aparece | `bud-utils.js` não carregado | Incluir `<script src="bud-utils.js"></script>` |
| Modal não aparece | CSS z-index conflitante | Aumentar z-index do modal para 9999 |
| Enter não funciona | Keypress listener não registrado | Verificar se inputs têm IDs corretos |
| Blobs não aparecem | Overflow hidden | Verificar `overflow-hidden` no body |
| Butão fica preso em "Acessando..." | Promise não resolve | Verificar conexão Firebase |

---

## 📈 Métricas Sugeridas

- **Conversão login**: Taxa de usuários que entram em dashboard
- **Taxa de erro**: Quantos erros vs sucesso
- **Tempo médio**: Quanto tempo leva do clique ao redirecionamento
- **Taxa bounce**: Usuários que saem antes de tentar login
- **Erros criticamente frequentes**: Quais erros mais comuns

---

**Versão**: 1.1  
**Gerado em**: 06 de abril de 2026  
**Próximas páginas**: cadastro.html, recuperar-senha.html, trocar-senha.html

---

# 🐛 AUDITORIA DE ERROS — Sistema de Login & Autenticação

> Auditoria realizada em 08/04/2026 — Arquivos analisados: `index.html`, `js/index.js`, `cadastro.html`, `js/cadastro.js`, `recuperar-senha.html`, `js/recuperar-senha.js`, `trocar-senha.html`, `js/trocar-senha.js`, `js/acao-auth.js`

---

## Problemas Encontrados: 11

### 🔴 Problema #1 — GRAVE: Classes Tailwind Dinâmicas no Modal de Verificação de Email

**Onde:** `js/index.js` — modal de verificação de email  
**O quê:** O overlay usa `className` com classes arbitrárias do Tailwind:
```javascript
ov.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
```
`bg-black/50` e `z-[9999]` são valores arbitrários que NÃO existem no build estático do Tailwind. O modal fica **completamente invisível**.

**Impacto:** Usuários que precisam verificar email veem uma tela congelada sem nenhum modal — ficam presos sem saber o que fazer.

**🔧 SOLUÇÃO:**
```javascript
ov.style.cssText = 'position:fixed;inset:0;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
```

---

### 🔴 Problema #2 — GRAVE: Credenciais EMAILJS Expostas no Código-Fonte

**Onde:** `js/cadastro.js`  
**O quê:** Todas as credenciais do EmailJS estão hardcoded no JavaScript do cliente:
```javascript
const EMAILJS_PUBLIC_KEY = 'NoTp1rQkHC8G7Qxb8';
const EMAILJS_SERVICE_ID = 'service_sr2ygyh';
const EMAILJS_TEMPLATE_ID = 'template_nqg09vr';
```
Um atacante pode usar essas credenciais para enviar emails em massa, modificar templates ou fazer spam.

**Impacto:** Comprometimento total do sistema de envio de emails. Atacantes podem enviar confirmações falsas com links maliciosos.

**🔧 SOLUÇÃO:**
Mover para Cloud Function no backend:
```javascript
// NO CLIENTE — apenas chama a função:
const res = await fetch(FUNCTIONS_URL + '/enviarEmailVerificacao', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
  body: JSON.stringify({ email })
});

// NA CLOUD FUNCTION — credenciais ficam protegidas:
const emailjs = require('@emailjs/nodejs');
exports.enviarEmailVerificacao = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
  await emailjs.send(process.env.EMAILJS_SERVICE_ID, process.env.EMAILJS_TEMPLATE_ID, { email: data.email }, { publicKey: process.env.EMAILJS_PUBLIC_KEY, privateKey: process.env.EMAILJS_PRIVATE_KEY });
});
```

---

### 🟡 Problema #3 — MÉDIO: Senha Temporária Exposta no DOM

**Onde:** `js/cadastro.js`  
**O quê:** Após gerar senha temporária, ela fica armazenada em `dataset.real`:
```javascript
showSenhaEl.dataset.real = senhaTemp;  // Plaintext no DOM
showSenhaEl.textContent = isHidden ? showSenhaEl.dataset.real : '••••••••';
```
Visível no DevTools → Elements → dataset. Acessível via malware/XSS.

**Impacto:** Se o navegador estiver comprometido ou o usuário compartilhar tela, a senha fica exposta.

**🔧 SOLUÇÃO:**
Usar closure em vez de armazenar no DOM:
```javascript
let senhaMemoria = senhaTemp;
showSenhaEl.addEventListener('click', () => {
  const isHidden = showSenhaEl.textContent.includes('•');
  showSenhaEl.textContent = isHidden ? senhaMemoria : '••••••••';
});
// Limpar após 60s:
setTimeout(() => { senhaMemoria = ''; showSenhaEl.textContent = '••••••••'; }, 60000);
```

---

### 🟡 Problema #4 — MÉDIO: Race Condition na Verificação de Email

**Onde:** `js/index.js`  
**O quê:** Entre `getDoc()` e a verificação, o estado pode mudar:
```javascript
const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
const userData = userDoc.exists() ? userDoc.data() : {};
// ← Admin pode mudar emailVerificationRequired aqui
if (userData.emailVerificationRequired === true && !user.emailVerified) { ... }
```

**Impacto:** Possível bypass da verificação de email em cenários de timing.

**🔧 SOLUÇÃO:**
Usar Firestore Security Rules para impor a regra no backend:
```
// firestore.rules
match /usuarios/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId
    && (!('emailVerificationRequired' in resource.data) || request.auth.token.email_verified == true);
}
```

---

### 🟡 Problema #5 — MÉDIO: Enumeração de Matrículas

**Onde:** `js/index.js`  
**O quê:** A busca por matrícula revela existência/inexistência:
```javascript
const q = query(collection(db, 'usuarios'), where('matricula', '==', matricula.toUpperCase()));
const snap = await getDocs(q);
if (snap.empty) return null;
```

**Impacto:** Atacantes podem enumerar todas as matrículas válidas do sistema.

**🔧 SOLUÇÃO:**
Retornar erro genérico para ambos os casos:
```javascript
async function buscarEmailPorMatricula(matricula) {
  try {
    const q = query(collection(db, 'usuarios'), where('matricula', '==', matricula.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null; // Internamente null
    return snap.docs[0].data().email;
  } catch (e) {
    return null;
  }
}
// No handler de login — mensagem genérica:
budShowToast('Email ou matrícula/senha incorretos.', 'erro');
// (Nunca "Matrícula não encontrada" vs "Senha incorreta")
```

---

### 🟡 Problema #6 — MÉDIO: Falta de Sanitização nos Inputs (Cadastro)

**Onde:** `js/cadastro.js`  
**O quê:** Dados do usuário são salvos no Firestore apenas com `.trim()`:
```javascript
const docData = { nome: nome, email: email, telefone: telefone };
```
Se alguma tela usar `innerHTML` para exibir esses dados, abre vulnerabilidade XSS.

**Impacto:** XSS armazenado se qualquer página renderizar dados do usuário com `innerHTML`.

**🔧 SOLUÇÃO:**
```javascript
function sanitize(str) { return str.replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c])).trim(); }
const docData = { nome: sanitize(nome), email: email, telefone: sanitize(telefone) };
```

---

### 🟡 Problema #7 — MÉDIO: Sem Tratamento de Erro no Código de Indicação

**Onde:** `js/cadastro.js`  
**O quê:** Query de referral pode falhar silenciosamente:
```javascript
const qRef = query(collection(db, 'usuarios'), where('codigoIndicacao', '==', codigoRaw));
const snap = await getDocs(qRef);  // Sem try/catch
```

**Impacto:** Sistema de indicação não rastreia recompensas em caso de falha de rede.

**🔧 SOLUÇÃO:**
```javascript
let indicadoPor = null;
try {
  const snap = await getDocs(qRef);
  if (!snap.empty) indicadoPor = snap.docs[0].id;
} catch (err) {
  console.warn('Falha ao buscar indicação:', err);
  // Continua cadastro sem indicação
}
```

---

### 🟡 Problema #8 — MÉDIO: Sem Proteção CSRF na Recuperação de Senha

**Onde:** `js/recuperar-senha.js`  
**O quê:** O endpoint de reset não tem token CSRF:
```javascript
const res = await fetch(BACKEND_URL + '/reset-senha', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: email })
  // Sem CSRF token
});
```

**Impacto:** Attackers podem forçar envio de reset para qualquer conta, inundando caixas de email.

**🔧 SOLUÇÃO:**
Adicionar rate limiting na Cloud Function:
```javascript
// Cloud Function — rate limit por IP
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, message: 'Muitas tentativas.' });
app.post('/reset-senha', limiter, async (req, res) => { ... });
```

---

### 🟡 Problema #9 — MÉDIO: SDK Firebase Legado no acao-auth.js

**Onde:** `js/acao-auth.js`  
**O quê:** Usa SDK compat enquanto o resto do projeto usa modular:
```javascript
firebase.initializeApp(firebaseConfig);  // Compat SDK
const auth = firebase.auth();
```

**Impacto:** Pode não receber patches de segurança. Inconsistente com o resto do projeto.

**🔧 SOLUÇÃO:**
Migrar para SDK modular:
```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
const app = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
```

---

### 🟡 Problema #10 — MÉDIO: Botão Fica Travado se Rede Cair (Recuperar Senha)

**Onde:** `js/recuperar-senha.js`  
**O quê:**
```javascript
btn.innerText = "Enviando...";
btn.disabled = true;
// Se a rede cair, o botão fica desabilitado para sempre
```

**Impacto:** Usuário precisa recarregar a página para tentar novamente.

**🔧 SOLUÇÃO:**
```javascript
const timeout = setTimeout(() => {
  btn.disabled = false;
  btn.innerText = "Enviar link de recuperação";
  budShowToast('Tempo esgotado. Tente novamente.', 'aviso');
}, 30000);
try {
  const res = await fetch(...);
  clearTimeout(timeout);
  // ...
} catch (err) {
  clearTimeout(timeout);
  btn.disabled = false;
  btn.innerText = "Enviar link de recuperação";
}
```

---

### 🟢 Problema #11 — LEVE: Encoding Corrompido no acao-auth.js

**Onde:** `js/acao-auth.js`  
**O quê:** Arquivo com problemas de encoding UTF-8. Caracteres como "ç" e acentos aparecem corrompidos.

**Impacto:** Mensagens exibidas ao usuário com caracteres quebrados.

**🔧 SOLUÇÃO:**
Re-salvar o arquivo como UTF-8 sem BOM. Verificar todas as strings com acentos.

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA
- [ ] Problema #1 — Trocar `className` por `style.cssText` no modal de verificação
- [ ] Problema #2 — Mover credenciais EmailJS para Cloud Function

### 🟡 PRIORIDADE ALTA
- [ ] Problema #3 — Remover senha do DOM, usar closure
- [ ] Problema #4 — Adicionar regra Firestore para verificação de email
- [ ] Problema #5 — Mensagem genérica para matrícula/email não encontrado
- [ ] Problema #6 — Sanitizar inputs antes de salvar no Firestore
- [ ] Problema #7 — Try/catch na busca de código de indicação
- [ ] Problema #8 — Rate limiting no endpoint de recuperação de senha
- [ ] Problema #9 — Migrar acao-auth.js para SDK modular
- [ ] Problema #10 — Timeout no botão de recuperação de senha

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #11 — Re-salvar acao-auth.js com encoding UTF-8

---

## 📊 RESUMO DE MÉTRICAS

| Severidade | Quantidade |
|---|---|
| 🔴 GRAVE | 2 |
| 🟡 MÉDIO | 8 |
| 🟢 LEVE | 1 |
| **TOTAL** | **11** |

| Categoria | Bugs |
|---|---|
| Tailwind Dinâmico | #1 |
| Segurança (Credenciais) | #2 |
| Segurança (XSS/DOM) | #3, #6 |
| Segurança (Auth/CSRF) | #4, #5, #8 |
| Firebase (Error Handling) | #7 |
| UX (Estados Travados) | #10 |
| SDK (Legado) | #9 |
| Encoding | #11 |
