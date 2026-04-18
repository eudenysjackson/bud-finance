# 🔐 Cérebro — Trocar Senha (`trocar-senha.html` + `js/trocar-senha.js`)

---

## 1. Visão Geral

A tela **Trocar Senha** é acessada no **primeiro login** do usuário, logo após o cadastro. O fluxo do Bud Finanças é:

1. Admin/Referral cadastra o usuário em `cadastro.html`
2. O sistema gera uma **senha temporária aleatória**
3. Envia a senha por email (via EmailJS)
4. Usuário faz login com a senha temporária
5. → **Redireciona para `trocar-senha.html`** para criar uma senha pessoal
6. Após trocar, flag `primeiroLogin` é desativado → dashboard

**O que a tela faz:**
- Verifica se o usuário está logado E se `primeiroLogin === true`
- Mostra informações do usuário (avatar, nome, matrícula)
- Formulário: nova senha + confirmação + indicador de força
- Executa `updatePassword()` do Firebase Auth
- Atualiza `primeiroLogin: false` no Firestore
- Redireciona para `dashboard.html`

**Acesso:** Autenticado + `primeiroLogin === true`. Se não logado → redirect login. Se `primeiroLogin` já é false → redirect dashboard.

**Arquivos:**
- `trocar-senha.html` — ~100 linhas, formulário single-purpose
- `js/trocar-senha.js` — ~115 linhas, ES module com Firebase modular SDK

---

## 2. Estrutura de Dados

### Leitura
```
Firestore: usuarios/{uid}
├── primeiroLogin: boolean — true = precisa trocar senha
├── nome: string — nome completo exibido no card
└── matricula: string — exibido como info secundária
```

### Escrita
```
Firebase Auth: updatePassword(user, novaSenha)
Firestore: usuarios/{uid}.primeiroLogin = false
```

---

## 3. HTML Structure

```
body (bg-[#f0f4f8], centered)
├── Background blurs (2x div gradientes)
├── #loadingSection — spinner "Verificando acesso..."
└── #formSection (hidden → visível após auth check)
    ├── Ícone chave (amber)
    ├── "Crie sua nova senha"
    ├── Descrição "troque a senha temporária"
    ├── #userInfo card
    │   ├── #userAvatar — iniciais
    │   ├── #userName — nome completo
    │   └── #userMatricula — matrícula
    ├── form#formTrocarSenha
    │   ├── #novaSenha input
    │   ├── #confirmarSenha input
    │   ├── #forcaSenha — 4 barras + texto
    │   └── #btnTrocar — submit
    └── (nenhum link de volta — não tem opção de cancelar)
```

**Diferença do acao-auth:** Não tem seção de sucesso nem de erro — sucesso = redirect direto, erro = toast.

---

## 4. Fluxo Completo

```
1. Usuário recebe email com senha temporária
2. Faz login em index.html
3. Dashboard/outra tela deveria redirecionar para trocar-senha.html
   (mas nenhuma tela faz isso — BUG 1)

4. Usuário acessa trocar-senha.html
   ├── onAuthStateChanged: !user → redirect index.html
   ├── getDoc(usuarios/{uid}): !exists || primeiroLogin !== true → redirect dashboard
   └── primeiroLogin === true → mostra form com dados do user

5. Usuário preenche nova senha + confirmação
6. Enter no campo nova senha → focus no confirmar
   Enter no confirmar → trigger submit

7. form submit:
   ├── senha < 6 → toast warning
   ├── senhas ≠ → toast warning
   └── OK:
       7a. btn = "Salvando..." + disabled
       7b. updatePassword(auth.currentUser, novaSenha)
       7c. updateDoc(usuarios/{uid}, { primeiroLogin: false })
       7d. redirect dashboard.html

8. Erro catch:
   ├── auth/requires-recent-login → toast + redirect login
   ├── auth/weak-password → toast warning + re-habilita botão
   └── outro → toast error + re-habilita botão
```

---

## 5. Funções (js/trocar-senha.js)

| Função/Listener | Linhas | Descrição |
|---|---|---|
| `onAuthStateChanged` callback | 12-38 | Verifica auth + primeiroLogin, carrega dados do user, mostra form |
| `novaSenha` input listener | 42-68 | Calcula força da senha (4 critérios), atualiza barras visuais |
| `novaSenha` keypress Enter | 71-73 | Foco para confirmarSenha |
| `confirmarSenha` keypress Enter | 74-76 | Trigger submit do botão |
| `form` submit listener | 80-115 | Valida, updatePassword, updateDoc, redirect |

### Critérios de Força (idênticos ao acao-auth)

| Nível | Critério | Cor | Texto |
|---|---|---|---|
| 1 | length ≥ 6 | bg-red-400 | "Muito fraca" |
| 2 | length ≥ 8 | bg-orange-400 | "Fraca" |
| 3 | upper + lower | bg-yellow-400 | "Boa" |
| 4 | números ou especiais | bg-emerald-400 | "Forte" |

---

## 6. Variáveis e Imports

```javascript
import { initializeApp } from "firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword } from "firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "firebase-firestore.js";

const app, auth, db;           // Firebase instances
const novaSenhaInput;          // DOM reference
const form, btn;               // DOM references
```

---

## 7. Bugs e Problemas

### 🔴 BUG 1 — `primeiroLogin` nunca é enforçado fora desta página

**Onde:** Nenhuma outra tela verifica `primeiroLogin`  

**Problema:** O fluxo esperado é:
1. Usuário faz login com senha temporária
2. Sistema detecta `primeiroLogin === true`
3. → Redireciona para `trocar-senha.html`

Mas **nenhuma tela faz o passo 2-3**. O `index.html` (login) redireciona para `dashboard.html` após autenticação. O `dashboard.js` não verifica `primeiroLogin`. Resultado:

```
Cadastro → Email com senha temp → Login → Dashboard ← sem trocar senha!
```

O usuário fica usando a senha temporária que foi enviada em **plaintext por email** (via EmailJS). Essa senha está:
- No email (que pode ser comprometido)
- No histórico do EmailJS
- Potencialmente nos logs do serviço

A troca de senha é completamente ignorada. O `trocar-senha.html` só funciona se o usuário acessá-lo manualmente (o que nunca acontece).

**Impacto:** 🔴 Segurança crítica — senhas temporárias nunca são trocadas.

🔧 **SOLUÇÃO — Enforçar no dashboard.js e em todas as telas autenticadas:**
```javascript
// Em bud-utils.js ou em cada tela:
async function verificarPrimeiroLogin(auth, db) {
    const user = auth.currentUser;
    if (!user) return;
    
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    if (userDoc.exists() && userDoc.data().primeiroLogin === true) {
        // Não está na trocar-senha → redirecionar
        if (!window.location.pathname.includes('trocar-senha')) {
            window.location.href = 'trocar-senha.html';
        }
    }
}
```

---

### 🟡 BUG 2 — Operação não-atômica: updatePassword + updateDoc podem ficar inconsistentes

**Onde:** `js/trocar-senha.js` linhas 95-101  
**Código atual:**
```javascript
// 1. Atualiza senha no Firebase Auth
await updatePassword(user, novaSenha);

// 2. Atualiza Firestore: desativa primeiro login
await updateDoc(doc(db, 'usuarios', user.uid), {
    primeiroLogin: false
});

// 3. Redireciona
window.location.href = "dashboard.html";
```

**Problema:** Se o passo 1 (`updatePassword`) sucede mas o passo 2 (`updateDoc`) falha (Firestore offline, permission error, etc.):

- A senha FOI alterada no Firebase Auth ✅
- Mas `primeiroLogin` continua `true` no Firestore ❌

Resultado: No próximo login, o usuário é (teoricamente) redirecionado para trocar-senha novamente, mas usando a senha NOVA. Tenta mudar de novo → loop confuso. E como nenhuma tela enforça `primeiroLogin` (Bug 1), na prática não acontece. Mas se Bug 1 for corrigido, Bug 2 se torna real.

**Impacto:** 🟡 Estado inconsistente que vira problema real após corrigir Bug 1.

🔧 **SOLUÇÃO:**
```javascript
try {
    await updatePassword(user, novaSenha);
    
    try {
        await updateDoc(doc(db, 'usuarios', user.uid), { primeiroLogin: false });
    } catch (firestoreError) {
        // Senha mudou mas flag não atualizou — tentar novamente
        console.error('Firestore update failed, retrying:', firestoreError);
        try {
            await updateDoc(doc(db, 'usuarios', user.uid), { primeiroLogin: false });
        } catch (retryError) {
            // Salvar estado local para que o app saiba que a senha já foi trocada
            localStorage.setItem('bud_senha_trocada_pendente', 'true');
        }
    }
    
    window.location.href = "dashboard.html";
} catch (error) {
    // ...
}
```

---

### 🟡 BUG 3 — Aceita senhas comuns sem bloqueio

**Onde:** `js/trocar-senha.js` linhas 85-88  
**Código atual:**
```javascript
if (novaSenha.length < 6) {
    window.budShowToast('A senha deve ter pelo menos 6 caracteres.', 'warning');
    return;
}
```

**Problema:** Idêntico ao Bug 4 do acao-auth. Aceita `123456`, `abcdef`, `qwerty`, etc. O indicador visual mostra "Muito fraca" (1 barra vermelha) mas o submit **não impede o envio**.

Particularmente grave aqui porque o usuário está substituindo uma **senha aleatória segura** (gerada em cadastro.js com chars + números + especiais) por uma potencialmente trivial.

**Impacto:** 🟡 Downgrade de segurança — usuário troca senha segura por "123456".

🔧 **SOLUÇÃO:**
```javascript
const SENHAS_COMUNS = ['123456','123456789','12345','qwerty','password','111111',
    'abc123','000000','654321','admin','welcome','abcdef'];

if (SENHAS_COMUNS.includes(novaSenha.toLowerCase())) {
    window.budShowToast('Essa senha é muito comum. Escolha uma mais segura.', 'warning');
    return;
}

// Exigir força mínima
let forcaMin = 0;
if (novaSenha.length >= 6) forcaMin++;
if (novaSenha.length >= 8) forcaMin++;
if (/[A-Z]/.test(novaSenha) && /[a-z]/.test(novaSenha)) forcaMin++;
if (/[0-9]/.test(novaSenha) || /[^A-Za-z0-9]/.test(novaSenha)) forcaMin++;

if (forcaMin < 2) {
    window.budShowToast('Use pelo menos 8 caracteres para uma senha segura.', 'warning');
    return;
}
```

---

### 🟡 BUG 4 — Indicador de força sem feedback para senhas < 6 chars

**Onde:** `js/trocar-senha.js` linhas 55-65  
**Código atual:**
```javascript
let forca = 0;
if (senha.length >= 6) forca++;
if (senha.length >= 8) forca++;
// ...
texto.textContent = textos[forca - 1] || '';
texto.className = 'text-xs font-medium ' + (textoCores[forca - 1] || '');
```

**Problema:** Quando a senha tem 1-5 chars: `forca = 0`. As barras ficam todas cinza e o texto fica vazio. O container é visível (não hidden), mas não há informação alguma para o usuário. O `texto.className` fica `'text-xs font-medium '` (sem cor) — espaço trailing no className.

**Impacto:** 🟡 UX — indicador aparece mas não comunica nada.

🔧 **SOLUÇÃO:**
```javascript
container.classList.remove('hidden');

if (senha.length < 6) {
    bars.forEach(bar => bar.className = 'h-1.5 flex-1 rounded-full bg-slate-200');
    texto.textContent = 'Mínimo 6 caracteres';
    texto.className = 'text-xs font-medium text-red-400';
    return;
}
```

---

### 🟢 BUG 5 — Sem feedback visual de sucesso antes do redirect

**Onde:** `js/trocar-senha.js` linhas 99-101  
**Código atual:**
```javascript
await updateDoc(doc(db, 'usuarios', user.uid), { primeiroLogin: false });

// Redireciona para o dashboard
window.location.href = "dashboard.html";
```

**Problema:** Após trocar a senha com sucesso, o redirect é imediato. O usuário vê "Salvando..." no botão e de repente está no dashboard. Não há confirmação clara de que a senha foi alterada.

Compare com `acao-auth.html` que tem uma seção de sucesso com check animado e texto "Senha alterada!".

**Cenário confuso:** Usuário troca a senha → redirect instantâneo → pensa "funcionou?" → tenta fazer login novamente para confirmar → desperdiça tempo.

**Impacto:** 🟢 UX — falta de feedback gera incerteza.

🔧 **SOLUÇÃO:**
```javascript
await updateDoc(doc(db, 'usuarios', user.uid), { primeiroLogin: false });

// Feedback visual antes do redirect
btn.innerHTML = '✅ Senha alterada!';
btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
btn.classList.add('bg-emerald-500');
window.budShowToast('Senha alterada com sucesso! Redirecionando...', 'success');

setTimeout(() => {
    window.location.href = "dashboard.html";
}, 1500);
```

---

### 🟢 BUG 6 — `console.error` em produção

**Onde:** `js/trocar-senha.js` linhas 104 e 113  
**Código atual:**
```javascript
console.error('Erro ao trocar senha:', error);
// ... mais abaixo:
console.error('Erro ao trocar senha:', error);  // duplicado!
```

**Problema:** O `console.error` com o objeto `error` completo aparece duas vezes — uma no início do catch (linha 104) e outra no bloco `else` genérico (linha 113). Expõe detalhes de erros Firebase em produção.

A duplicação é desnecessária — se `auth/requires-recent-login` é o erro, ambos os console.error executam, mostrando o mesmo erro duas vezes no DevTools.

**Impacto:** 🟢 Log duplicado + exposição de detalhes em produção.

🔧 **SOLUÇÃO:** Mover o console.error para dentro de cada branch específico, ou condicioná-lo a `localhost`:
```javascript
} catch (error) {
    btn.innerHTML = 'Salvar nova senha';
    btn.disabled = false;

    if (error.code === 'auth/requires-recent-login') {
        window.budShowToast('Sua sessão expirou. Faça login novamente.', 'error');
        window.location.href = "index.html";
    } else if (error.code === 'auth/weak-password') {
        window.budShowToast('A senha é muito fraca.', 'warning');
    } else {
        window.budShowToast('Ocorreu um erro ao trocar a senha. Tente novamente.', 'error');
    }
}
```

---

### 🟢 BUG 7 — Sem dark mode

**Onde:** `trocar-senha.html` body  

**Problema:** `bg-[#f0f4f8]` hardcoded, sem variantes `dark:`, `dark-mode.js` não incluído. Idêntico ao acao-auth.

**Impacto:** 🟢 Inconsistência visual — página visitada raramente.

---

### 🟢 BUG 8 — Sem opção de cancelar / voltar

**Onde:** `trocar-senha.html` form inteiro  

**Problema:** O formulário não tem link "Voltar" nem botão de cancelar. Se o usuário quer sair sem trocar a senha, precisa:
- Navegar manualmente pela URL
- Fechar a aba

Se `primeiroLogin` for enforçado (correção do Bug 1), o usuário ficaria **preso** nesta página sem poder usar o app até trocar a senha. Isso é intencional (forçar troca), mas deveria haver pelo menos um link "Sair" que faz logout.

**Impacto:** 🟢 UX — sem saída explícita da página.

🔧 **SOLUÇÃO:**
```html
<p class="text-center mt-4">
    <a href="#" onclick="getAuth(initializeApp(window.BUD_FIREBASE_CONFIG)).signOut().then(() => window.location.href='index.html')" 
       class="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors">
       Sair da conta
    </a>
</p>
```

---

## 8. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | primeiroLogin nunca enforçado | Médio — guardrail em todas as telas |
| 2 | 🟡 | updatePassword + updateDoc não-atômico | Baixo — retry + fallback |
| 3 | 🟡 | Aceita senhas comuns (123456) | Baixo |
| 4 | 🟡 | Indicador força sem texto < 6 chars | Baixo |
| 5 | 🟢 | Sem feedback de sucesso | Baixo |
| 6 | 🟢 | console.error duplicado em produção | Baixo |
| 7 | 🟢 | Sem dark mode | Baixo |
| 8 | 🟢 | Sem opção de sair/cancelar | Baixo |

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **8** |
| 🔴 Críticos | 1 |
| 🟡 Altos | 3 |
| 🟢 Baixos | 4 |
| Linhas HTML | ~100 |
| Linhas JS | ~115 |
| Firestore reads | 1 (getDoc usuarios) |
| Firestore writes | 1 (updateDoc primeiroLogin) |
| Firebase Auth calls | 1 (updatePassword) |
| SDK | ES modules (modular) |
| Deps | firebase-config.js, bud-loader.js, bud-utils.js |

---

## 💚 Pontos Positivos

1. **Verifica `primeiroLogin` antes de mostrar** — Não permite acesso indevido à troca se já trocou
2. **ES modules (modular SDK)** — Usa a versão moderna do Firebase, diferente de acao-auth/vendas (compat)
3. **Informações do usuário exibidas** — Avatar com iniciais, nome e matrícula dão confiança
4. **XSS prevention com `textContent`** — Comentário explícito "usando textContent para evitar XSS"
5. **Keyboard navigation** — Enter no campo1 foca no campo2, Enter no campo2 submete
6. **Error handling por tipo** — Trata `requires-recent-login`, `weak-password` e erros genéricos
7. **Botão desabilitado durante submit** — Previne duplo-clique
8. **`nomeSeguro.substring(0, 100)`** — Limita nome a 100 chars para prevenir overflow
