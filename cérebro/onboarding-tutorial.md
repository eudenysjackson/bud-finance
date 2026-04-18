# 🎓 Sistema de Onboarding & Tutorial - Documentação Completa

## 1. Visão Geral

O sistema de **Onboarding & Tutorial** é responsável por:

1. **Onboarding** (`onboarding.html` + `onboarding.js`): Primeiro acesso do usuário → Coleta dados iniciais e cria transações iniciais
2. **Tutorial** (`tutorial.js`): Botão **"?"** flutuante que explica funcionalidades em modal pop-up

**Fluxo:**
```
Novo usuário
    ↓
Faz login/cadastro (index.html)
    ↓
Redireciona para onboarding.html (se não concluído)
    ↓
Completa 7 passos (dados pessoais, renda, moradia, etc)
    ↓
Salva em Firestore + Cria transações iniciais
    ↓
Redireciona para dashboard.html
    ↓
Tutorial FAB (?) sempre acessível em qualquer página
```

---

## 2. Onboarding: Os 7 Passos

### Verificação de Conclusão

Ao acessar dashboard, verifica se onboarding foi concluído:

```javascript
// dashboard.js
onAuthStateChanged(auth, user => {
    // ... check plan ...
    if (!perfilSnap.exists() || !perfilSnap.data().onboardingConcluido) {
        window.location.href = 'onboarding.html';
    }
});
```

**Firestore:**
```
usuarios/{uid}/perfil/config
├─ onboardingConcluido: true/false
├─ pais: "BR"
├─ moeda: "BRL"
└─ trabalho: "CLT"
```

### Passo 1️⃣: Bem-vindo

```
┌─────────────────────────────────────┐
│            🚀 Bem-vindo             │
│   ao Bud Finanças!                  │
│                                     │
│  Vamos configurar algumas           │
│  informações iniciais...            │
│  (Leva apenas alguns minutos)       │
│                                     │
│            [Próximo →]              │
└─────────────────────────────────────┘
```

**Ação:** Apenas informativo. Botão "Próximo" → Step 2

---

### Passo 2️⃣: Como Você Conheceu o Bud? (Obrigatório)

**Opções (clickáveis):**

| Emoji | Opção | Valor Armazenado |
|---|---|---|
| 📱 | Instagram / TikTok | `Instagram / TikTok` |
| 🔍 | Google / Busca | `Google / Busca` |
| 🎬 | YouTube | `YouTube` |
| 💬 | Indicação de amigo(a) | `Indicação de amigo(a)` |
| 💼 | LinkedIn | `LinkedIn` |
| 📰 | Blog / Notícia | `Blog / Notícia` |
| ✨ | Outro | `Outro` |

**Salvamento:**
```javascript
dadosUsuario.comoConheceu = "Instagram / TikTok"; // Card selecionado
// Later: updateDoc(usuarios/{uid}, { comoConheceu: dadosUsuario.comoConheceu })
```

**Validação:** Se passar sem selecionar → Toast "Selecione como você conheceu o Bud."

---

### Passo 3️⃣: País e Moeda (Obrigatório)

**País (Dropdown):**
- 🇧🇷 Brasil (`BR`)
- 🇺🇸 Estados Unidos (`US`)
- 🇵🇹 Portugal (`PT`)

**Moeda (Dropdown):**
- Real (`BRL` - R$)
- Dólar (`USD` - $)
- Euro (`EUR` - €)

**Salvamento em Firestore:**
```javascript
await setDoc(doc(db, "usuarios", uid, "perfil", "config"), {
    pais: "BR",
    moeda: "BRL",
    onboardingConcluido: true  // (ao final)
}, { merge: true });
```

---

### Passo 4️⃣: Tipo de Trabalho (Pulável)

**Opções (Clickáveis):**

| Emoji | Tipo | Descrição |
|---|---|---|
| 🏢 | CLT | Carteira assinada |
| 💼 | Autônomo | Conta própria |

**Validação:** Se não selecionado e clicar "Próximo" → Toast "Selecione uma opção ou clique em 'Pular etapa'."

**Se Pular:** Define `dadosUsuario.trabalho = ''`

**Salvamento em Firestore:**
```javascript
await setDoc(doc(db, "usuarios", uid, "perfil", "config"), {
    trabalho: "CLT"  // ou "Autônomo"
});
```

---

### Passo 5️⃣: Renda Principal (Pulável)

**Campos:**
- **Valor Líquido** (obrigatório se preencher algo): Máscara BRL → R$ 0,00
- **Dia** (obrigatório se preencher valor): 1-31

**Exemplo:** R$ 3.500,00 no dia 5

**Validação:**
```javascript
if(!v || !d) return "Preencha o valor e o dia, ou clique em 'Pular etapa'."
```

**Se Pular:** Limpa campos `rendaValor` e `rendaDia`

**Criação de Transações:**
Após salvar, cria 2 documentos:

1. **Em `usuarios/{uid}/transacoes`:**
```javascript
{
    tipo: "receita",
    descricao: "Salário Principal",
    valor: 3500.00,
    categoria: "Salário",
    conta: "Conta Principal",
    pago: false,
    dataReferencia: "2026-04-05",  // Mês atual + dia inserido
    recorrente: true,
    dataCriacao: serverTimestamp()
}
```

2. **Em `usuarios/{uid}/recorrentes`:**
```javascript
{
    descricao: "Salário Principal",
    tipo: "receita",
    valor: 3500.00,
    categoria: "Salário",
    formaPagamento: "Outro",
    periodicidade: "mensal",
    diaVencimento: 5,
    proximaData: Timestamp(2026-05-05),  // Próxima ocorrência
    ativa: true,
    criadoEm: serverTimestamp()
}
```

---

### Passo 6️⃣: Moradia (Pulável)

**Tipo (Obrigatório):**
- Aluguel
- Financiamento

**Campos:**
- **Valor Mensal** (obrigatório): Máscara BRL
- **Dia Vencimento** (obrigatório): 1-31

**Validação:**
```javascript
if(!moradiaTipo || !v || !d) return "Selecione o tipo, o valor e o dia, ou clique em 'Pular etapa'."
```

**Criação de Transações:**
Mesma estrutura de renda (transação + recorrente), com:
```javascript
tipo: "despesa",
descricao: "Aluguel" (ou "Financiamento"),
categoria: "Moradia"
```

---

### Passo 7️⃣: Serviços Básicos (Pulável / Opcional)

**3 Campos Opcionais (Deixar branco = não criar):**

| Campo | Descrição | Categoria |
|---|---|---|
| **Condomínio** | Valor + Dia | Moradia |
| **Energia Elétrica** | Valor + Dia | Moradia |
| **Água** | Valor + Dia | Moradia |

**Validação:**
```javascript
// Se preencher valor, dia é obrigatório
if((cV && !cD) || (!cV && cD)) return "Condomínio: Preencha o valor e o dia."
```

**Se Pular:** Limpa todos os campos

**Criação de Transações:** Para cada campo com valor preenchido:
```javascript
{
    tipo: "despesa",
    descricao: "Condomínio|Energia Elétrica|Água",
    valor: parseFloat(valor),
    categoria: "Moradia",
    // ... resto idêntico ao Step 5/6
}
```

---

## 3. Fluxo Completo: Dado → Firestore

```
┌─────────────────────────────┐
│  Step 2: comoConheceu       │ ──→ Salvo em:
│  "Instagram / TikTok"       │     usuarios/{uid}
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│  Step 3: País, Moeda        │ ──→ usuarios/{uid}/perfil/config
│  "BR", "BRL"                │     onboardingConcluido: true
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│  Step 4: Trabalho          │ ──→ usuarios/{uid}/perfil/config
│  "CLT"                     │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│  Step 5: Renda             │ ──→ usuarios/{uid}/transacoes
│  R$ 3500 dia 5             │     usuarios/{uid}/recorrentes
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│  Step 6: Moradia           │ ──→ usuarios/{uid}/transacoes
│  R$ 1200 Aluguel dia 10    │     usuarios/{uid}/recorrentes
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│  Step 7: Serviços          │ ──→ usuarios/{uid}/transacoes
│  Condomínio, Energia, Água │     usuarios/{uid}/recorrentes
└─────────────────────────────┘
        ↓
    **CONCLUIR**
        ↓
   window.location.href = "dashboard.html"
```

---

## 4. Criação Automática de Carteira

Ao concluir onboarding, cria carteira padrão se não existir:

```javascript
const carteiraSnap = await getDocs(collection(db, "usuarios", uid, "carteira"));
const jaTem = carteiraSnap.docs.some(d => d.data().padrao === true);

if (!jaTem) {
    await addDoc(collection(db, "usuarios", uid, "carteira"), {
        nome: 'Dinheiro / Espécie',
        tipo: 'dinheiro',
        icone: '💵',
        cor: '#10b981',
        padrao: true,
        ativo: true,
        saldo: 0,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
    });
}
```

**Firestore:**
```
usuarios/{uid}/carteira/
└─ {docId}
    ├─ nome: "Dinheiro / Espécie"
    ├─ tipo: "dinheiro"
    ├─ icone: "💵"
    ├─ padrao: true
    ├─ ativo: true
    └─ saldo: 0
```

---

## 5. Interface e Animações

### Layout

```html
<div class="main-card">
    <div class="progress-dots">
        ●  ○  ○  ○  ○  ○  ○  ← Mostrar qual step está
    </div>
    
    <div id="step-1" class="step-content">
        [Conteúdo do Step]
    </div>
    
    <div class="controls">
        <button id="btnVoltar">Voltar</button>
        <button id="btnPular">Pular etapa</button>
        <button id="btnProximo">Próximo →</button>
    </div>
</div>
```

### Bolinhas de Progresso (Progress Dots)

```javascript
let dotsHtml = '';
for(let i=1; i<=totalPassos; i++){
    if(i === passoAtual) {
        // Step atual: barra horizontal azul
        dotsHtml += `<div class="w-6 h-2 bg-blue-600 rounded-full"></div>`;
    } else {
        // Outros: bolinhas cinzas
        dotsHtml += `<div class="w-2 h-2 bg-slate-200 rounded-full"></div>`;
    }
}
```

**Visual:**
```
Step 2: ● ━━━━ ○ ○ ○ ○ ○
Step 5: ○ ○ ○ ○ ━━━━ ○ ○
```

### Botões Condicionais

| Botão | Quando Aparece | Comportamento |
|---|---|---|
| **Voltar** | Todos exceto Step 1 | Decrementa passoAtual |
| **Pular etapa** | Steps 4-7 | Limpa dados e vai para próximo |
| **Próximo** | Steps 1-6 | Valida e incrementa |
| **Concluir** | Step 7 (último) | Muda cor e ícone (verde + check) |

---

## 6. Sistema de Tutorial (FAB "?")

### Componentes

**FAB (Floating Action Button):**
```
┌─────────────────────────────────┐
│                                 │ ← Tutorial overlay
│                                 │   (escuro ao fundo)
│       ┌─────────────────┐       │
│       │ 📖 Título       │       │
│       │                 │       │
│       │ Descrição...    │       │
│       │ ✓ Feature 1     │       │
│       │ ✓ Feature 2     │       │
│       │ ✓ Feature 3     │       │
│       │                 │       │
│       │ Entendi, vamos  │       │
│       │ lá! [×]         │       │
│       └─────────────────┘       │
│                                 │
│                         ┌────┐  │
│                         │ ?  │◄─┴── FAB fixo
│                         └────┘     (bottom-right)
└─────────────────────────────────┘
```

### Armazenamento em Local Storage

Rastreia qual tutorial foi visto para não mostrar novamente:

```javascript
// Key: 'nexo_tutorial_done_' + pageKey
// Value: 'true' / 'false'

localStorage.setItem('nexo_tutorial_done_dashboard', 'true');
localStorage.setItem('nexo_tutorial_done_extrato', 'true');

// Verificar
isTutorialDone('dashboard') // → true
```

### API do Tutorial

```javascript
// Mostrar tutorial
BudTutorial.show('dashboard', {
    emoji: '📊',
    title: 'Bem-vindo ao Dashboard!',
    description: 'Aqui você vê sua situação financeira completa.',
    features: [
        { emoji: '💰', title: 'Saldo', desc: 'Seu saldo em tempo real' },
        { emoji: '📈', title: 'Gráficos', desc: 'Visualize tendências' },
        { emoji: '🎯', title: 'Metas', desc: 'Acompanhe suas metas' }
    ]
});

// Fechar tutorial
BudTutorial.end();

// Resetar um tutorial específico
BudTutorial.reset('dashboard');

// Resetar TODOS os tutoriais
BudTutorial.resetAll();
```

### Integração nas Páginas

**Exemplo: dashboard.html**

```javascript
// No final do carregamento
onAuthStateChanged(auth, user => {
    if (user) {
        // Carregar dados...
        
        // Mostrar tutorial se primeira vez
        if (!isTutorialDone('dashboard')) {
            BudTutorial.show('dashboard', {
                emoji: '📊',
                title: 'Bem-vindo ao Dashboard!',
                description: 'Painel geral com saldo, receitas, despesas...',
                features: [
                    { emoji: '💰', title: 'Cartão de Saldo', desc: 'Saldo mensal em tempo real' },
                    { emoji: '📋', title: 'Transações', desc: 'Últimas movimentações' },
                    { emoji: '📊', title: 'Gráficos', desc: 'Despesas por categoria' }
                ]
            });
        }
        
        // FAB "?" sempre acessível
        // Clique abre tutorial novamente
    }
});
```

---

## 7. Estrutura de Dados - Firestore

### Após Completar Onboarding

```
usuarios/{uid}/
├─ uid: string
├─ email: string
├─ comoConheceu: "Instagram / TikTok"  ← Salvo aqui
├─ onboardingConcluido: true           ← Flag
│
├─ perfil/
│   └─ config
│       ├─ pais: "BR"
│       ├─ moeda: "BRL"
│       ├─ trabalho: "CLT"
│       └─ onboardingConcluido: true
│
├─ carteira/
│   └─ {docId}
│       ├─ nome: "Dinheiro / Espécie"
│       ├─ tipo: "dinheiro"
│       ├─ padrao: true
│       └─ saldo: 0
│
├─ transacoes/
│   ├─ {id1}: Salário R$ 3500
│   ├─ {id2}: Aluguel R$ 1200
│   ├─ {id3}: Condomínio R$ 350
│   ├─ {id4}: Energia R$ 150
│   └─ {id5}: Água R$ 80
│
└─ recorrentes/
    ├─ {id1}: Salário (mensal dia 5)
    ├─ {id2}: Aluguel (mensal dia 10)
    ├─ {id3}: Condomínio (mensal dia 15)
    ├─ {id4}: Energia (mensal dia 20)
    └─ {id5}: Água (mensal dia 20)
```

---

## 8. Validações

| Passo | Campo | Validação |
|---|---|---|
| 2 | comoConheceu | Obrigatório (1 seleção) |
| 3 | País, Moeda | Sempre preenchidos (defaults) |
| 4 | Trabalho | Opcional (pular) |
| 5 | Renda | Se valor ≠ empty, dia obrigatório |
| 6 | Moradia | Tipo obrigatório; valor e dia obrigatórios |
| 7 | Serviços | Se valor ≠ empty, dia obrigatório |

---

## 9. Estados do Botão "Próximo"

```javascript
// Steps 1-6:
btnProximo.innerHTML = 'Próximo →';
btnProximo.classList = 'bg-blue-600 hover:bg-blue-700';

// Step 7 (último):
btnProximo.innerHTML = 'Concluir ✓';
btnProximo.classList = 'bg-emerald-500 hover:bg-emerald-600';
```

---

## 10. Máscaras de Input

### Máscara de Dinheiro (BRL)

```javascript
document.querySelectorAll('.mask-money').forEach(input => {
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, "");  // Remove não-dígitos
        value = (value / 100).toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
        });
        e.target.value = value;
    });
});

// Exemplo:
// Input: 350000 → Display: R$ 3.500,00
// Input: 1200 → Display: R$ 12,00
```

### Parse de Dinheiro (Realizar)

```javascript
function parseDinheiro(texto) {
    if(!texto) return 0;
    return parseFloat(
        texto
            .replace('R$', '')
            .replace(/\./g, '')      // Remove separador de milhares
            .replace(',', '.')        // Converte vírgula em ponto
            .trim()
    ) || 0;
}

// Exemplo:
// parseDinheiro("R$ 3.500,00") → 3500.00
// parseDinheiro("R$ 12,50") → 12.50
```

---

## 11. Possíveis Fluxos de Erro

| Erro | Causa | Mensagem | Solução |
|---|---|---|---|
| Toast warning | Campo obrigatório vazio | "Selecione..." | Preenchase o campo |
| Toast error | Firestore falha | "Ocorreu um erro. Tente novamente." | Retry (botão fica ativo novamente) |
| Sem dados iniciais | Pulou vários steps | Dashboard vazio (esperado) | Normal - usuário pula etapas |

---

## 12. Fluxo de Redirecionamento

```
1. Novo usuário acessa app
   └─ index.html (Login/Cadastro)

2. Completa autenticação Firebase
   └─ Email verificado ✓

3. Redireciona para dashboard
   └─ dashboard.html

4. Dashboard detecta onboardingConcluido === false
   └─ window.location.href = 'onboarding.html'

5. Completa onboarding
   └─ setDoc(...onboardingConcluido: true)

6. Redireciona
   └─ window.location.href = 'dashboard.html'

7. Dashboard carrega normalmente
   └─ FAB "?" acessível em todas as páginas
```

---

## 13. Comparação: Onboarding vs Tutorial

| Aspecto | Onboarding | Tutorial |
|---|---|---|
| **Frequência** | 1x na criação da conta | Múltiplas vezes |
| **Localização** | Página dedicada | Modal popup + FAB fixo |
| **Dados Coletados** | Sim (país, moeda, renda, etc) | Não |
| **Storage** | Firestore | LocalStorage |
| **Reiniciável** | Sim (via configurações) | Sim (via localStorage) |
| **Bloqueante** | Sim (redireciona) | Não (opcional) |

---

## 14. Arquivos Envolvidos

| Arquivo | Propósito |
|---|---|
| `onboarding.html` | UI dos 7 passos |
| `js/onboarding.js` | Lógica de navegação, validações, Firestore |
| `tutorial.js` | Sistema de tour/tutorial com FAB |
| `dashboard.js` | Verificação de onboarding + inicialização tutorial |
| `configuracoes.js` | Reset onboarding flag |

---

## 15. Segurança e Permissões

**Firestore Rules:**

```javascript
match /usuarios/{uid}/perfil/config {
    allow read, write: if request.auth.uid == uid;
}

match /usuarios/{uid}/transacoes/{docId} {
    allow read, write: if request.auth.uid == uid;
}

match /usuarios/{uid}/recorrentes/{docId} {
    allow read, write: if request.auth.uid == uid;
}
```

✅ Usuário só acessa seus dados  
✅ Sem acesso cruzado

---

## 16. UX/UI Details

### Light/Dark Mode

```css
/* Light (padrão) */
.main-card { background: white; }
.step-content { color: #1e293b; }

/* Dark */
body.dark .main-card { background: #1e293b; }
body.dark .step-content { color: #f1f5f9; }
```

### Animações

```css
@keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.step-content {
    animation: fade-in 0.3s ease-in-out;
}
```

### Responsividade

- **Mobile:** Card ocupa 90% da largura
- **Desktop:** Card máx 420px de largura
- Botões full-width em mobile

---

## 17. Resumo Técnico

| Aspecto | Detalhes |
|---|---|
| **Linguagem** | JavaScript vanilla + Firebase |
| **Passos** | 7 (welcome, tracked, location, job, income, housing, utilities) |
| **Dados** | Coletados e salvos em Firestore |
| **Transações** | Criadas automaticamente (transações + recorrentes) |
| **Tutorial** | FAB "?" com localStorage para rastreamento |
| **Validações** | Campo por campo + Toast feedback |
| **Armazenamento** | Firestore (permanente) + LocalStorage (UI state) |
| **Redirecionamento** | Automático se não conclude onboarding |

---

# 🐛 AUDITORIA DE ERROS — Onboarding + Tutorial

> Auditoria realizada em 08/04/2026 — Arquivos analisados: `onboarding.html`, `js/onboarding.js`, `tutorial.js`, `tutorial-steps.js`, `tutorial-init.js`

---

## Problemas Encontrados: 9

### 🔴 Problema #1 — GRAVE: Z-Index do FAB Abaixo do Overlay do Tutorial

**Onde:** `tutorial.js` — linhas 16 vs 86  
**O quê:** O overlay do tutorial tem `z-index: 9998` e o FAB "?" tem `z-index: 9990`:
```css
'#nexo-welcome-overlay { ... z-index: 9998; ... }'
'#nexo-tour-fab { ... z-index: 9990; ... }'
```

**Impacto:** Quando o modal do tutorial está aberto, o FAB fica atrás do overlay — inalcançável. Usuário não consegue redisparar o tutorial.

**🔧 SOLUÇÃO:**
```javascript
// FAB deve ficar ACIMA do overlay:
'#nexo-tour-fab { ... z-index: 10000; ... }'
```

---

### 🔴 Problema #2 — GRAVE: localStorage Sem Error Handling (Modo Privado)

**Onde:** `tutorial.js` — linhas 52–69  
**O quê:** Acesso direto ao `localStorage` sem try/catch:
```javascript
function isTutorialDone(pageKey) {
    return localStorage.getItem(getStorageKey(pageKey)) === 'true'; // ← Throws em incógnito!
}
function markTutorialDone(pageKey) {
    localStorage.setItem(getStorageKey(pageKey), 'true'); // ← Throws em incógnito!
}
```
Em modo privado ou com localStorage desabilitado, lança `QuotaExceededError` ou `SecurityError`.

**Impacto:** App inteiro pode crashar no modo de navegação privada.

**🔧 SOLUÇÃO:**
```javascript
function isTutorialDone(pageKey) {
  try { return localStorage.getItem(getStorageKey(pageKey)) === 'true'; }
  catch (e) { return true; } // Trata como "já visto" se storage indisponível
}
function markTutorialDone(pageKey) {
  try { localStorage.setItem(getStorageKey(pageKey), 'true'); }
  catch (e) { /* Falha silenciosa — tutorial aparecerá novamente */ }
}
function resetAllTutorials() {
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('nexo_tutorial_done_') === 0) keys.push(k);
    }
    keys.forEach(function(k) { localStorage.removeItem(k); });
  } catch (e) { console.warn('localStorage indisponível:', e); }
}
```

---

### 🔴 Problema #3 — GRAVE: Parsing de Data com Timezone Inconsistente

**Onde:** `js/onboarding.js` — linhas 103–109  
**O quê:** `new Date()` sem sufixo `Z` é interpretado diferente entre navegadores:
```javascript
const dateObj = new Date(dataRef + 'T00:00:00'); // ← Sem Z → local ou UTC?
const hojeObj = new Date();
hojeObj.setHours(0, 0, 0, 0);
const Status = dateObj < hojeObj ? 'pendente_confirmacao' : 'confirmada';
```

**Impacto:** Transações financeiras criadas na data errada. Status incorreto (`pendente_confirmacao` vs `confirmada`).

**🔧 SOLUÇÃO:**
```javascript
const dateObj = new Date(dateRef + 'T00:00:00Z'); // ✅ Explicitar UTC
const hojeObj = new Date();
hojeObj.setUTCHours(0, 0, 0, 0); // ✅ UTC consistente
const Status = dateObj < hojeObj ? 'pendente_confirmacao' : 'confirmada';
```

---

### 🔴 Problema #4 — GRAVE: Overlay do Tutorial Não Bloqueia Interação de Fundo

**Onde:** `tutorial.js` — linhas 14–23  
**O quê:** O overlay cobre a viewport mas falta `pointer-events` e bloqueio de scroll:
```css
'#nexo-welcome-overlay {',
'  position: fixed; inset: 0; z-index: 9998;',
'  background: rgba(15,23,42,0.5);',
'  /* Sem pointer-events! Sem overflow: hidden! */',
'}'
```

**Impacto:** Usuário pode clicar em botões e scrollar por trás do modal do tutorial. Pode disparar ações indesejadas.

**🔧 SOLUÇÃO:**
```css
'#nexo-welcome-overlay {',
'  position: fixed; inset: 0; z-index: 9998;',
'  background: rgba(15,23,42,0.5);',
'  backdrop-filter: blur(4px);',
'  pointer-events: all;',  /* ✅ Bloqueia clicks */
'  overflow: hidden;',     /* ✅ Bloqueia scroll */
'}',
```

---

### 🟡 Problema #5 — MÉDIO: Dia Inválido para Meses Curtos (Transações do Onboarding)

**Onde:** `js/onboarding.js` — linhas 199–200  
**O quê:** Ao criar transação do mês atual, o dia não é validado:
```javascript
const diaFormatado = diaStr ? String(diaStr).padStart(2,'0') : '01';
const dataRef = `${dataAtual}-${diaFormatado}`; // ← "2025-02-31" é inválido!
```
Se usuário informa dia 31 e o mês é fevereiro, a data fica inválida.

**Impacto:** Transações com datas inconsistentes. JavaScript auto-corrige para março, data errada.

**🔧 SOLUÇÃO:**
```javascript
const hoje = new Date();
const maxDia = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
const diaSeguro = Math.min(parseInt(diaStr) || 1, maxDia);
const diaFormatado = String(diaSeguro).padStart(2,'0');
const dataRef = `${dataAtual}-${diaFormatado}`;
```

---

### 🟡 Problema #6 — MÉDIO: Race Condition Auth vs Event Handlers

**Onde:** `js/onboarding.js` — linhas 11–23  
**O quê:** Event listeners são registrados imediatamente, mas `onAuthStateChanged` é async:
```javascript
let usuarioAtualId = null;
onAuthStateChanged(auth, (user) => { 
  if (user) { usuarioAtualId = user.uid; /* remove pointer-events-none */ }
});
// Listeners já ativos — se click disparar antes do auth:
document.getElementById('btnProximo').addEventListener('click', async () => {
  // usuarioAtualId === null → Firebase error em setDoc()
});
```

**Impacto:** Erro em dispositivos lentos ou com acessibilidade (teclado/screenreader).

**🔧 SOLUÇÃO:**
```javascript
let authReady = false;
onAuthStateChanged(auth, (user) => {
  if (user) { usuarioAtualId = user.uid; authReady = true; }
  else { window.location.href = "index.html"; }
});

document.getElementById('btnProximo').addEventListener('click', async () => {
  if (!authReady || !usuarioAtualId) {
    return window.budShowToast("Aguarde, carregando...", 'aviso');
  }
  // ... segue normalmente
});
```

---

### 🟡 Problema #7 — MÉDIO: XSS Potencial no Conteúdo do Tutorial

**Onde:** `tutorial.js` — linhas 190–235  
**O quê:** Config do tutorial é inserida via concatenação + innerHTML:
```javascript
var title = '<div class="nexo-welcome-title">' + titleText + '</div>';
var desc = '<div class="nexo-welcome-desc">' + config.desc + '</div>';
config.features.forEach(function(f) {
    featuresHtml += '<div class="nexo-welcome-feature-title">' + f.title + '</div>';
});
card.innerHTML = closeBtn + title + desc + featuresHtml;
```

**Impacto:** Se os dados do `tutorial-steps.js` forem comprometidos (supply-chain), XSS é possível.

**🔧 SOLUÇÃO:**
Usar `textContent` + `createElement` em vez de `innerHTML`:
```javascript
var titleEl = document.createElement('div');
titleEl.className = 'nexo-welcome-title';
titleEl.textContent = (titleEmoji + ' ' + (config.title || 'Tutorial'));

var descEl = document.createElement('div');
descEl.className = 'nexo-welcome-desc';
descEl.textContent = config.desc || '';

config.features.forEach(function(f) {
  var feat = document.createElement('div');
  feat.className = 'nexo-welcome-feature';
  var ft = document.createElement('div');
  ft.className = 'nexo-welcome-feature-title';
  ft.textContent = f.title;
  var fd = document.createElement('div');
  fd.className = 'nexo-welcome-feature-desc';
  fd.textContent = f.desc;
  feat.appendChild(ft); feat.appendChild(fd);
  card.appendChild(feat);
});
```

---

### 🟡 Problema #8 — MÉDIO: Timer do Tutorial Acumula em Navegação Rápida

**Onde:** `tutorial.js` — linhas 154–158  
**O quê:** Cada `register()` cria timeout sem cancelar o anterior:
```javascript
setTimeout(function() {
    if (!isTutorialDone(pageKey)) { showWelcome(pageKey, config, false); }
}, 1200);
```
Se usuário navega rapidamente entre páginas, múltiplos timeouts disparam — mostrando tutoriais de páginas anteriores.

**Impacto:** Tutorial errado aparece na página errada.

**🔧 SOLUÇÃO:**
```javascript
var currentTimeout = null;
register: function(pageKey, config) {
  if (currentTimeout) clearTimeout(currentTimeout);
  currentTimeout = setTimeout(function() {
    if (!isTutorialDone(pageKey)) { showWelcome(pageKey, config, false); }
  }, 1200);
}
```

---

### 🟢 Problema #9 — LEVE: Máscara de Dinheiro Remove Caracteres Sem Feedback

**Onde:** `js/onboarding.js` — linhas 47–52  
**O quê:**
```javascript
input.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Strip silencioso
    value = (value / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
    e.target.value = value;
});
```

**Impacto:** Feedback UX mínimo — usuário não sabe que caracteres foram removidos.

**🔧 SOLUÇÃO:**
```javascript
input.addEventListener('input', (e) => {
  const original = e.target.value;
  let value = original.replace(/\D/g, "");
  if (original.length > 0 && value.length === 0) {
    e.target.style.borderColor = '#ef4444';
    setTimeout(() => { e.target.style.borderColor = ''; }, 2000);
  }
  value = (value / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  e.target.value = value;
});
```

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA
- [ ] Problema #1 — FAB z-index acima do overlay (10000 > 9998)
- [ ] Problema #2 — Try/catch em toda operação localStorage
- [ ] Problema #3 — Usar sufixo `Z` e `setUTCHours` no parsing de datas
- [ ] Problema #4 — Adicionar `pointer-events: all` e `overflow: hidden` no overlay

### 🟡 PRIORIDADE ALTA
- [ ] Problema #5 — Validar dia máximo do mês ao criar transação
- [ ] Problema #6 — Guard `authReady` nos handlers de botão
- [ ] Problema #7 — Substituir innerHTML por createElement/textContent
- [ ] Problema #8 — Cancelar timeout anterior antes de criar novo

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #9 — Feedback visual na máscara de dinheiro

---

## 📊 RESUMO DE MÉTRICAS

| Severidade | Quantidade |
|---|---|
| 🔴 GRAVE | 4 |
| 🟡 MÉDIO | 4 |
| 🟢 LEVE | 1 |
| **TOTAL** | **9** |

| Categoria | Bugs |
|---|---|
| Z-Index/CSS | #1, #4 |
| localStorage/Storage | #2 |
| Data/Timezone | #3, #5 |
| Race Condition | #6 |
| Segurança (XSS) | #7 |
| Timer/Navigation | #8 |
| UX | #9 |

