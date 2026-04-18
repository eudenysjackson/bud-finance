# 📝 Cérebro — Cadastro (`cadastro.html` + `js/cadastro.js`)

---

## 1. Visão Geral

O **Cadastro** é a tela de criação de conta do Bud Finanças. O fluxo é peculiar — diferente do padrão "o usuário escolhe sua senha":

1. Usuário preenche nome, email, WhatsApp, código de indicação (opcional) e aceita LGPD
2. O **frontend** gera uma matrícula (`BUD-XXXX-XXXX`) e uma senha temporária (14 chars)
3. A conta é criada no Firebase Auth com essa senha gerada
4. Um doc é criado em `usuarios/{uid}` com plano `trial` (3 dias)
5. Se veio indicação válida, registra vínculo + 30% desconto
6. Envia email de verificação (Firebase) + email com credenciais (EmailJS)
7. Faz signOut do usuário
8. Mostra tela de sucesso com matrícula e senha (oculta por padrão)
9. Usuário vai pro login e usa as credenciais recebidas

**Acesso:** página pública (sem auth). Não há sidebar, dashboard nem plano-config.

**Arquivos:**
- `cadastro.html` — 160 linhas, formulário + tela de sucesso
- `js/cadastro.js` — 192 linhas (ES Module), lógica completa de registro
- Dependência externa: EmailJS SDK via CDN

---

## 2. Estrutura de Dados

### Escrita (Firestore)

**Coleção:** `usuarios/{uid}` — documento criado no cadastro:
| Campo | Tipo | Valor |
|---|---|---|
| `nome` | `string` | Input do formulário |
| `email` | `string` | Input do formulário |
| `telefone` | `string` | Input com máscara `(XX) XXXXX-XXXX` |
| `matricula` | `string` | `BUD-XXXX-XXXX` gerado com `crypto.getRandomValues` |
| `primeiroLogin` | `boolean` | `true` (deveria forçar troca de senha) |
| `dataCadastro` | `Timestamp` | `serverTimestamp()` |
| `plano` | `string` | `'trial'` |
| `trialInicio` | `string` | `new Date().toISOString()` (**client-side!**) |
| `trialFim` | `string` | `new Date(Date.now() + 3d).toISOString()` (**client-side!**) |
| `status` | `string` | `'ativo'` |
| `role` | `string` | `'user'` |
| `funcionalidades` | `object` | `{}` |
| `lgpdConsentimento` | `boolean` | `true` |
| `lgpdConsentimentoData` | `string` | `new Date().toISOString()` (**client-side!**) |
| `lgpdVersaoPolitica` | `string` | `'2026-03-21'` (hardcoded) |
| `codigoIndicacao` | `string` | 8 chars crypto-random |
| `emailVerificationRequired` | `boolean` | `true` |
| `indicadoPor` | `object?` | `{uid, nome, codigo}` (se veio com código) |
| `descontoIndicacao` | `number?` | `30` (se veio com código) |
| `descontoIndicacaoUsado` | `boolean?` | `false` (se veio com código) |

**Atualização no indicador (se houver):**
| Campo | Operação | Valor |
|---|---|---|
| `indicacoes` | `arrayUnion` | `{uid, nome, email, data, assinouPlano: false}` |

---

## 3. Estrutura HTML

```
<body> (sem sidebar — página pública)
├── blobs decorativos (bg-blue-300, bg-emerald-300, bg-cyan-300)
├── #formSection — formulário de cadastro
│   ├── header: logo "$", badge "3 Dias Grátis", título, subtítulo
│   ├── benefícios (3 ✓ items)
│   ├── <form#formCadastro>
│   │   ├── input Nome Completo
│   │   ├── input E-mail
│   │   ├── input WhatsApp (com máscara)
│   │   ├── input Código de indicação (opcional, uppercase)
│   │   ├── checkbox LGPD (#lgpdConsent)
│   │   └── button "Criar minha conta"
│   └── link "Já tem acesso? Faça login"
└── #successSection (hidden) — tela de sucesso
    ├── ícone check com pulse-ring
    ├── card dark com matrícula + senha (oculta + botão "mostrar")
    ├── aviso "troque a senha no primeiro login"
    └── botão "Ir para o Login"
```

---

## 4. Fluxo Completo

```
1. Usuário preenche formulário e clica "Criar minha conta"
2. Validações:
   → campos vazios → toast warning
   → LGPD não aceita → toast warning
   → email regex → toast warning
   → telefone < 10 dígitos → toast warning
3. Gera matrícula (BUD-XXXX-XXXX) + senha (14 chars crypto)
4. createUserWithEmailAndPassword(email, senhaTemp)
   └── Firebase Auth cria conta
5. updateProfile(user, {displayName: nome})
6. Valida código de indicação (query no Firestore)
   ├── válido → salva indicadorUid + indicadorNome
   └── inválido/vazio → ignora
7. setDoc(usuarios/{uid}, docData)
   └── Cria doc completo com trial de 3 dias
8. Se indicação válida:
   └── updateDoc no indicador → arrayUnion na array "indicacoes"
9. sendEmailVerification(user)
10. signOut(auth)
11. enviarEmail via EmailJS (matricula + senha no template)
12. Mostra #successSection com credenciais
```

---

## 5. Funções (js/cadastro.js)

| Função | Linhas | Descrição |
|---|---|---|
| `gerarMatricula()` | 30 | Gera `BUD-XXXX-XXXX` com crypto.getRandomValues |
| `gerarSenhaTemp()` | 39 | Gera 14 chars com `crypto.getRandomValues`, charset alfanumérico+símbolos |
| `telefoneInput.oninput` | 47 | Máscara brasileira `(XX) XXXXX-XXXX` |
| `enviarEmail(email, nome, matricula, senha)` | 63 | Envia credenciais via EmailJS |
| `form.onsubmit` | 76 | **Core** — validação, criação Auth, Firestore doc, referral, emails, success UI |

**Variáveis de estado:**
| Variável | Tipo | Escopo | Descrição |
|---|---|---|---|
| `EMAILJS_PUBLIC_KEY` | `string` | module | Key pública do EmailJS (exposta) |
| `EMAILJS_SERVICE_ID` | `string` | module | ID do serviço EmailJS |
| `EMAILJS_TEMPLATE_ID` | `string` | module | ID do template de email |

---

## 6. Bugs e Problemas

### 🔴 BUG 1 — Sem CAPTCHA nem rate limit — criação em massa de contas

**Onde:** `js/cadastro.js` inteiro submit handler  
**Código atual:**
```javascript
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    // Vai direto para createUserWithEmailAndPassword
```

**Problema:** Não há nenhum mecanismo anti-bot:
- Sem reCAPTCHA / hCaptcha / Turnstile
- Sem rate limiting (Firebase Auth tem limite de 100 signups/hora por IP, mas isso é contornável)
- Sem verificação de email antes de criar a conta

Um bot pode submeter o formulário milhares de vezes, criando contas fake que:
- Consomem quota de EmailJS (grátis = 200/mês)
- Geram docs no Firestore (custo)
- Poluem a base de usuários
- Podem ser usadas para enviar emails (spam via template)

**Impacto:** 🔴 Abuso de massa — custo financeiro + reputação comprometida.

🔧 **SOLUÇÃO:**
```html
<!-- No HTML, antes do form: -->
<script src="https://www.google.com/recaptcha/api.js?render=SITE_KEY"></script>
```
```javascript
// No submit, antes de criar a conta:
const recaptchaToken = await grecaptcha.execute('SITE_KEY', {action: 'signup'});

// Enviar token para Cloud Function que valida:
const response = await fetch('https://us-central1-PROJECT.cloudfunctions.net/verifyRecaptcha', {
    method: 'POST',
    body: JSON.stringify({ token: recaptchaToken })
});
const { success, score } = await response.json();
if (!success || score < 0.5) {
    budShowToast('Verificação de segurança falhou. Tente novamente.', 'erro');
    return;
}
```

---

### 🔴 BUG 2 — `trialFim` calculado no client-side — trial infinito possível

**Onde:** `js/cadastro.js` dentro do `docData`  
**Código atual:**
```javascript
trialInicio: new Date().toISOString(),
trialFim: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
```

**Problema:** Ambas as datas são geradas **no navegador do usuário** usando `Date.now()`. Um usuário técnico pode:

1. **Antes de cadastrar:** Alterar o relógio do sistema para 2030 → `trialFim = "2030-01-04T..."` → trial de 4 anos
2. **Após cadastrar:** Interceptar a requisição do Firestore e modificar `trialFim` no body
3. **Post-hoc:** Se as Firestore Security Rules não validarem o campo, usar o SDK diretamente para atualizar `trialFim`

Adicionalmente, `resolvePlan()` nas outras telas compara `trialFim` com `Date.now()` do client — então adiantar o relógio local durante uso também estende o trial.

**Impacto:** 🔴 Plano trial (=Plus) infinito contornando o sistema de pagamento.

🔧 **SOLUÇÃO:**
```javascript
// Usar serverTimestamp ou calcular no backend (Cloud Function)
// Opção A: Cloud Function para criar o documento:
const createUser = httpsCallable(functions, 'createUserProfile');
await createUser({ nome, email, telefone, codigoIndicacao: codigoRaw });

// Opção B: Firestore Security Rules que validam o intervalo:
// match /usuarios/{uid} {
//   allow create: if request.resource.data.trialFim is string
//     && timestamp.value(request.resource.data.trialFim) <= request.time + duration.value(4, 'd');
// }

// Opção C (mínimo): usar serverTimestamp para ambos
trialInicio: serverTimestamp(),
// trialFim calculado via Cloud Function trigger (onCreate)
```

---

### 🔴 BUG 3 — Credenciais enviadas por email em texto plano via EmailJS

**Onde:** `js/cadastro.js` função `enviarEmail()`  
**Código atual:**
```javascript
await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: email,
    to_name: nome,
    matricula: matricula,
    senha: senha   // ← senha em plaintext no template
});
```

**Problema:** A senha temporária é enviada em **texto plano** no corpo do email. Emails não são criptografados por padrão (SMTP relay entre servidores é frequentemente em plaintext). Qualquer intermediário pode ler a senha.

Além disso, o email fica armazenado na caixa de entrada do usuário indefinidamente — se a conta de email for comprometida, a senha do Bud também vaza.

O modelo de "gerar senha e enviar por email" é um pattern de segurança antiquado. O modelo moderno é: usuário escolhe a própria senha OU usa email magic link.

**Impacto:** 🔴 Credenciais expostas em trânsito + armazenamento inseguro.

🔧 **SOLUÇÃO:**
```javascript
// Opção A (recomendada): Deixar o usuário escolher a senha no formulário
// Adicionar campo de senha + confirmação no HTML
// Remover geração de senhaTemp e envio por email

// Opção B: Sign-in com link mágico (email link)
import { sendSignInLinkToEmail } from "firebase-auth";
await sendSignInLinkToEmail(auth, email, {
    url: 'https://app.budfinancas.com/complete-signup',
    handleCodeInApp: true
});

// Opção C (se manter o modelo): Exigir troca FORÇADA no primeiro login
// E adicionar expiração da senha temporária (ex: 24h)
```

---

### 🔴 BUG 4 — Sem rate limit no botão — flood de submits e emails

**Onde:** `js/cadastro.js` submit handler  
**Código atual:**
```javascript
btn.disabled = true;
// ...
// No catch:
btn.disabled = false;
```

**Problema:** O botão é desabilitado durante o processamento (bom), mas se a requisição falhar, é reabilitado imediatamente. Não há:
- Cooldown entre tentativas
- Limite de tentativas por IP/sessão
- Debounce no submit

Um atacante pode modificar o JS para remover o `btn.disabled` e fazer spam de submits. Sem proteção server-side (Cloud Function com rate limit), não há defesa.

**Impacto:** 🔴 Flood de contas + esgotamento de quota EmailJS.

🔧 **SOLUÇÃO:**
```javascript
// Client-side (complementar):
let lastSubmit = 0;
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (Date.now() - lastSubmit < 10000) {
        budShowToast('Aguarde antes de tentar novamente.', 'aviso');
        return;
    }
    lastSubmit = Date.now();
    // ... restante
});

// Server-side (essencial): mover criação para Cloud Function com rate limit
```

---

### 🟡 BUG 5 — EmailJS API keys expostas no client-side

**Onde:** `js/cadastro.js` linhas 21-23  
**Código atual:**
```javascript
const EMAILJS_PUBLIC_KEY = 'NoTp1rQkHC8G7Qxb8';
const EMAILJS_SERVICE_ID = 'service_sr2ygyh';
const EMAILJS_TEMPLATE_ID = 'template_nqg09vr';
```

**Problema:** As 3 chaves do EmailJS estão hardcoded no JS do client-side. Qualquer pessoa pode:
1. Copiar as chaves
2. Chamar `emailjs.send()` com qualquer dados
3. Enviar emails "do Bud Finanças" para qualquer endereço
4. Usar como veículo de phishing (email parece vir do Bud)

EmailJS é projetado para uso client-side (as "public keys" são feitas para serem públicas), mas o risco real é o abuso do template: enviar emails com `senha: "clique neste link malicioso"`.

**Impacto:** 🟡 Abuso de reputação + phishing via template do app.

🔧 **SOLUÇÃO:**
```javascript
// Mover envio de email para Cloud Function
// Cloud Function: recebe {email, nome, matricula, senha} e usa nodemailer ou EmailJS server-side
// Assim as chaves ficam no servidor
```

---

### 🟡 BUG 6 — Senha temporária armazenada no DOM via `dataset.real`

**Onde:** `js/cadastro.js` linhas 176-177  
**Código atual:**
```javascript
showSenhaEl.textContent = '••••••••';
showSenhaEl.dataset.real = senhaTemp;
```

**Problema:** A senha fica armazenada no atributo `data-real` do elemento DOM. Qualquer extensão, script de terceiro ou ferramenta de DevTools pode ler `document.getElementById('showSenha').dataset.real` e obter a senha.

Isso é complementar ao BUG 3 — mesmo que o email não chegue, a senha está no DOM.

**Impacto:** 🟡 Exposição de credencial via DOM — risco se o usuário compartilha tela ou tem extensões maliciosas.

🔧 **SOLUÇÃO:**
```javascript
// Armazenar em closure ao invés de DOM
let senhaVisivel = false;
const senhaReal = senhaTemp; // closure, não acessível via DOM
document.getElementById('btnToggleSenha').addEventListener('click', function() {
    senhaVisivel = !senhaVisivel;
    showSenhaEl.textContent = senhaVisivel ? senhaReal : '••••••••';
    this.textContent = senhaVisivel ? 'ocultar' : 'mostrar';
});
```

---

### 🟡 BUG 7 — `lgpdConsentimentoData` em client-time (falsificável)

**Onde:** `js/cadastro.js` dentro do `docData`  
**Código atual:**
```javascript
lgpdConsentimentoData: new Date().toISOString(),
```

**Problema:** A data de consentimento LGPD é gerada no client-side. Para fins de conformidade legal (LGPD Art. 8º §2º), a data precisa ser **auditável e confiável**. Um timestamp do client pode ser contestado juridicamente como manipulável.

Já existe `dataCadastro: serverTimestamp()` usando o server time. O consentimento deveria usar o mesmo.

**Impacto:** 🟡 Risco de compliance — contestação da data de consentimento.

🔧 **SOLUÇÃO:**
```javascript
lgpdConsentimentoData: serverTimestamp(), // usar Firestore server timestamp
```

---

### 🟡 BUG 8 — `emailVerificationRequired` é decorativo

**Onde:** `js/cadastro.js` docData + `sendEmailVerification()`  
**Código atual:**
```javascript
emailVerificationRequired: true
// ...
await sendEmailVerification(user);
```

**Problema:** O campo `emailVerificationRequired: true` é salvo e o email de verificação é enviado, mas **nenhuma tela do app verifica se o email foi confirmado**. O usuário pode fazer login com email não-verificado e usar todo o app normalmente.

O `sendEmailVerification()` envia o email mas não bloqueia o acesso. O campo `user.emailVerified` do Firebase Auth nunca é checado em `index.js` (login).

**Impacto:** 🟡 Contas com email falso podem ser usadas normalmente.

🔧 **SOLUÇÃO:**
```javascript
// No login (index.js), após signIn:
if (!user.emailVerified) {
    await signOut(auth);
    budShowToast('Verifique seu email antes de acessar.', 'aviso');
    return;
}
```

---

### 🟡 BUG 9 — Desconto de indicação 30% nunca é aplicado

**Onde:** `js/cadastro.js` linhas 158-161  
**Código atual:**
```javascript
docData.descontoIndicacao = 30;
docData.descontoIndicacaoUsado = false;
```

**Problema:** O código salva `descontoIndicacao: 30` e `descontoIndicacaoUsado: false` no Firestore, mas não há nenhuma lógica no app que leia esses campos para aplicar um desconto real no checkout de planos.

A tela de configurações mostra os planos com preços fixos. O Mercado Pago (gateway) recebe o preço cheio. O desconto é puramente decorativo — o usuário foi atraído pela promessa de 30% off mas nunca recebe.

Na tela de cadastro, aparece: "🎁 Ganhe 30% de desconto no seu 1º plano!"

**Impacto:** 🟡 Propaganda enganosa + usuário frustrado + viola CDC (Art. 37 publicidade enganosa).

🔧 **SOLUÇÃO:**
```javascript
// No checkout (configuracoes.js), ao gerar preferência do Mercado Pago:
const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
const userData = userDoc.data();
let precoFinal = plano.priceMonthly;

if (userData.descontoIndicacao && !userData.descontoIndicacaoUsado) {
    precoFinal = precoFinal * (1 - userData.descontoIndicacao / 100);
    // Após pagamento confirmado:
    await updateDoc(doc(db, 'usuarios', user.uid), { descontoIndicacaoUsado: true });
}
```

---

### 🟢 BUG 10 — EmailJS SDK carregado via CDN sem SRI hash

**Onde:** `cadastro.html` linha 17  
**Código atual:**
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js" crossorigin="anonymous"></script>
```

**Problema:** Tem `crossorigin="anonymous"` mas sem atributo `integrity`. Se o CDN for comprometido, código malicioso é executado na página de cadastro — que processa senhas e dados pessoais.

**Impacto:** 🟢 Supply-chain risk — raro mas catastrófico.

🔧 **SOLUÇÃO:**
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"
    integrity="sha384-HASH_CORRETO"
    crossorigin="anonymous"></script>
```

---

### 🟢 BUG 11 — Código de indicação validado após conta já criada

**Onde:** `js/cadastro.js` linhas 130-142  
**Código atual:**
```javascript
// Cria conta no Firebase Auth com senha temporária
const userCredential = await createUserWithEmailAndPassword(auth, email, senhaTemp);
// ...
// Valida código de indicação (se informado) — após criar conta pois query exige auth
const codigoRaw = (document.getElementById('codigoIndicacao').value || '').trim().toUpperCase();
```

**Problema:** O comentário diz que a query "exige auth" para validar o código. Mas queries ao Firestore dependem das **Security Rules**, não da autenticação em si. Se as rules permitem leitura autenticada, validar ANTES de criar a conta seria impossível. Mas poderia criar uma Cloud Function pública para validar o código pré-cadastro.

Se o código for inválido, a conta é criada sem desconto — ok. Mas se o código for válido, a conta já foi criada com plano `trial` e a indicação é registrada corretamente.

O risco real: se a criação da conta funciona mas o setDoc falha, o Auth tem uma conta sem doc no Firestore (orfã).

**Impacto:** 🟢 Funcionamento correto na maioria dos casos, mas lógica causal invertida.

🔧 **SOLUÇÃO:**
```javascript
// Validar código ANTES de criar conta, usando Cloud Function:
// POST /validateReferralCode { code: "ABC123" }
// Retorna { valid: true, indicadorUid, indicadorNome } ou { valid: false }
```

---

### 🟢 BUG 12 — `arrayUnion` com objeto complexo (impossível remover)

**Onde:** `js/cadastro.js` linhas 169-177  
**Código atual:**
```javascript
await updateDoc(doc(db, 'usuarios', indicadorUid), {
    indicacoes: arrayUnion({
        uid: user.uid,
        nome: nome,
        email: email,
        data: new Date().toISOString(),
        assinouPlano: false
    })
});
```

**Problema:** `arrayUnion` no Firestore compara objetos por **igualdade profunda de todos os campos**. Para remover um item com `arrayRemove`, seria necessário passar o objeto **exatamente igual** (incluindo a string de data ISO ao milissegundo). Isso é praticamente impossível.

Se o admin quiser remover uma indicação, terá que substituir o array inteiro.

Também: `email` do indicado está sendo salvo no doc do indicador sem necessidade (o uid basta para lookup).

**Impacto:** 🟢 Dívida técnica — funciona para adicionar mas gestão futura é difícil.

🔧 **SOLUÇÃO:**
```javascript
// Usar subcoleção ao invés de array:
// usuarios/{indicadorUid}/indicacoes/{novoUserUid}
await setDoc(doc(db, 'usuarios', indicadorUid, 'indicacoes', user.uid), {
    nome, data: serverTimestamp(), assinouPlano: false
});
```

---

### 🟢 BUG 13 — `primeiroLogin: true` nunca verificado

**Onde:** `js/cadastro.js` docData  
**Código atual:**
```javascript
primeiroLogin: true,
```

**Problema:** O campo é salvo e a tela de sucesso mostra "⚠️ Você deverá trocar a senha no primeiro login". Porém, a tela de login (`index.js`) não verifica `primeiroLogin` para forçar redirecionamento para `trocar-senha.html`.

O usuário pode usar a senha temporária indefinidamente sem nunca trocá-la. A "exigência" de troca é apenas uma sugestão visual na tela de sucesso.

**Impacto:** 🟢 Senha temporária (gerada por máquina, em email) usada indefinidamente.

🔧 **SOLUÇÃO:**
```javascript
// No login (index.js ou dashboard.js), após auth:
const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
if (userDoc.exists() && userDoc.data().primeiroLogin) {
    window.location.href = 'trocar-senha.html?force=1';
    return;
}
```

---

### 🟢 BUG 14 — Modulo bias na geração de senha e matrícula

**Onde:** `js/cadastro.js` funções `gerarMatricula()` e `gerarSenhaTemp()`  
**Código atual:**
```javascript
// gerarSenhaTemp
const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';  // 58 chars
const array = new Uint8Array(14);
crypto.getRandomValues(array);
return Array.from(array, byte => chars[byte % chars.length]).join('');
```

**Problema:** `byte % 58` tem modulo bias: 256 não é divisível por 58, então os primeiros 24 caracteres do charset têm probabilidade ~1.77% cada vs ~1.69% para os últimos 34.

Na prática, com 14 caracteres e 58 opções, a entropia efetiva é ~82 bits (vs ~82.3 bits ideal). A diferença é negligível para senhas de 14 chars.

**Impacto:** 🟢 Puramente teórico — entropia mais que suficiente.

🔧 **SOLUÇÃO (se quiser corrigir):**
```javascript
function gerarSenhaTemp() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const limit = Math.floor(256 / chars.length) * chars.length; // 232
    let result = '';
    while (result.length < 14) {
        const byte = crypto.getRandomValues(new Uint8Array(1))[0];
        if (byte < limit) result += chars[byte % chars.length]; // rejection sampling
    }
    return result;
}
```

---

## 7. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | Sem CAPTCHA | Médio — reCAPTCHA + Cloud Function |
| 2 | 🔴 | trialFim client-side | Médio — serverTimestamp ou CF |
| 3 | 🔴 | Credenciais por email plaintext | Alto — redesign do fluxo |
| 4 | 🔴 | Sem rate limit no submit | Médio — CF + cooldown |
| 5 | 🟡 | EmailJS keys expostas | Médio — mover para CF |
| 6 | 🟡 | Senha no DOM dataset | Baixo — closure |
| 7 | 🟡 | lgpdData client-side | Baixo — serverTimestamp |
| 8 | 🟡 | emailVerification decorativo | Baixo — check no login |
| 9 | 🟡 | Desconto 30% nunca aplicado | Médio — integrar checkout |
| 10 | 🟢 | EmailJS CDN sem SRI | Baixo |
| 11 | 🟢 | Referral pós-criação | Baixo — CF de validação |
| 12 | 🟢 | arrayUnion com objeto | Médio — subcoleção |
| 13 | 🟢 | primeiroLogin decorativo | Baixo — check no login |
| 14 | 🟢 | Modulo bias cripto | Baixo — rejection sampling |

---

## 8. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **14** |
| 🔴 Críticos | 4 |
| 🟡 Altos | 5 |
| 🟢 Baixos | 5 |
| Linhas HTML | 160 |
| Linhas JS | 192 |
| Escritas Firestore | 1-2 (setDoc usuário + updateDoc indicador) |
| Auth operations | 3 (createUser + updateProfile + signOut) |
| Emails enviados | 2 (Firebase verification + EmailJS credentials) |
| Deps externas | firebase-app/auth/firestore, EmailJS CDN |

---

## 💚 Pontos Positivos

1. **Consentimento LGPD obrigatório** — Checkbox required com link para política, versão da política registrada
2. **crypto.getRandomValues** — Geração criptograficamente segura de matrícula e senha (boa entropia)
3. **Máscara de telefone** — Input com formatação automática `(XX) XXXXX-XXXX`, limita 11 dígitos
4. **Validação multi-camada** — Campos vazios, regex de email, comprimento de telefone, checkbox LGPD
5. **Indicação resiliente** — try/catch no arrayUnion do indicador: se falhar, cadastro não é afetado
6. **signOut após criação** — Força o usuário a logar com as credenciais, confirmando que as recebeu
7. **Senha oculta por padrão** — Na tela de sucesso, a senha mostra "••••••••" com toggle
8. **Error handling por code** — `auth/email-already-in-use` e `auth/invalid-email` com mensagens amigáveis
9. **serverTimestamp no dataCadastro** — Pelo menos a data de criação usa timestamp do servidor
