# 🛒 Cérebro — Vendas (`vendas.html` + `js/vendas.js`)

---

## 1. Visão Geral

A tela **Vendas** é a **landing page** / página de vendas do Bud Finanças. É uma página marketing dark-mode com:

- **Navbar fixa:** logo + links internos + CTA "Começar Grátis"
- **Hero:** headline "Suas finanças no controle total." + CTAs + mockup do dashboard
- **Stats bar:** 4 métricas (40+ categorias, 5 min, ∞ cartões, IA)
- **Features:** 9 cards (IA, Cartões, Relatórios, Categorias, Push, Dark Mode, Privacidade, PWA, Sync)
- **App Screens:** 4 mockups (Dashboard, Cartões, Extrato, Relatórios) com descrições
- **AI Highlight:** destaque da importação com IA (PDF, foto, CSV, OFX, WhatsApp)
- **Pricing:** 4 planos (Free, Starter R$9,99, Pro R$29,90, Plus R$49,90) com botões de assinatura
- **Social Proof:** 3 testimonials
- **Final CTA + Footer**

**Acesso:** página pública, sem autenticação. Checkout requer login.

**Arquivos:**
- `vendas.html` — ~700 linhas, layout completo da landing page
- `js/vendas.js` — 50 linhas, função `assinar()` via Mercado Pago + IntersectionObserver
- Firebase SDK: usa compat (não modular) para detectar usuário logado no checkout

---

## 2. Estrutura de Dados

### Leitura

Nenhuma leitura direta de Firestore na página.

### Escrita/API

**`assinar(planKey)`** → POST para Cloud Function:
```
POST {FUNCTIONS_URL}/mercadopago/create-subscription
Authorization: Bearer {idToken}
Body: { planKey, uid, email }
```
→ Retorna `{ init_point }` (URL de checkout do Mercado Pago)

---

## 3. Fluxo do Usuário

```
1. Visitante acessa vendas.html
2. Navega pela landing page (scroll, animações fade-up)
3. Vê pricing e decide assinar um plano
4. Clica "Assinar Starter/Pro/Plus"
   ├── Não logado → redirect cadastro.html?plano=X
   └── Logado:
       5. getIdToken() do Firebase Auth
       6. POST /mercadopago/create-subscription com planKey, uid, email
       7. Recebe init_point → redirect para Mercado Pago checkout
       8. Após pagamento, webhook do MP atualiza o plano no Firestore
```

---

## 4. Funções (js/vendas.js)

| Função | Linhas | Descrição |
|---|---|---|
| `window.assinar(planKey)` | 5-42 | Cria assinatura via API do Mercado Pago. Desabilita botões durante processo. |
| `IntersectionObserver` | 44-51 | Adiciona classe `.visible` nos elementos `.fade-up` ao entrar na viewport |

---

## 5. Bugs e Problemas

### 🔴 BUG 1 — `uid` e `email` enviados no body podem ser spoofados (IDOR)

**Onde:** `js/vendas.js` linhas 21-22  
**Código atual:**
```javascript
var idToken = await user.getIdToken();
var res = await fetch(FUNCTIONS_URL + '/mercadopago/create-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
    body: JSON.stringify({ planKey: planKey, uid: user.uid, email: user.email })
});
```

**Problema:** O `uid` e `email` são enviados tanto no header (Bearer token) quanto no body. Se o Cloud Function extrair `uid` do **body** ao invés do **token verificado**, um atacante pode:

1. Obter seu próprio idToken válido
2. Enviar no body o `uid` de OUTRO usuário
3. Criar uma assinatura para a conta da vítima (que a vítima pagaria)

Ou inversamente: usar o uid de uma conta premium para obter acesso sem pagar.

O token JWT JÁ contém `uid` e `email` verificados. Não há necessidade de enviar no body.

**Impacto:** 🔴 Vulnerabilidade IDOR — depende de como o backend trata os dados.

🔧 **SOLUÇÃO:**
```javascript
// No frontend: remover uid e email do body
body: JSON.stringify({ planKey: planKey })

// No backend (Cloud Function): extrair do token
const decodedToken = await admin.auth().verifyIdToken(idToken);
const uid = decodedToken.uid;
const email = decodedToken.email;
```

---

### 🔴 BUG 2 — Informação falsa: "∞ Cartões no Pro"

**Onde:** `vendas.html` seção Stats Bar (linha ~248)  
**Código atual:**
```html
<p class="stat-number text-3xl md:text-4xl font-black">∞</p>
<p class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Cartões no Pro</p>
```

**Problema:** A stats bar diz "∞ Cartões no Pro" mas o `plano-config.js` define:
```javascript
pro: { cardsLimit: 4 }      // ← 4 cartões, não infinito
plus: { cardsLimit: Number.POSITIVE_INFINITY }  // ← Plus tem ∞
```

O plano Pro permite **4 cartões**, não infinitos. Apenas o Plus tem cartões ilimitados. Isso é publicidade enganosa (CDC Art. 37).

**Impacto:** 🔴 Informação comercial falsa — usuário compra Pro esperando ∞ cartões e se frustra.

🔧 **SOLUÇÃO:**
```html
<!-- Opção A: Corrigir o texto -->
<p class="stat-number text-3xl md:text-4xl font-black">∞</p>
<p class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Cartões no Plus</p>

<!-- Opção B: Mudança para Pro real -->
<p class="stat-number text-3xl md:text-4xl font-black">4</p>
<p class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Cartões no Pro</p>
```

---

### 🔴 BUG 3 — Feature decorativa vendida como real (WhatsApp Plus)

**Onde:** `vendas.html` seção Pricing, card Plus (linha ~601)  
**Código atual:**
```html
<li class="flex items-start gap-2"><span class="text-emerald-400 mt-0.5">✓</span> <strong>Assistente WhatsApp</strong></li>
```

+ Badge no card: `<span class="text-[9px] ...">⚡ WhatsApp</span>`

**Problema:** O plano Plus promete "Assistente WhatsApp" como feature premium de destaque. Porém, como documentado no [cérebro/assistente-whatsapp.md](cérebro/assistente-whatsapp.md), **a funcionalidade é 100% decorativa**:
- O webhook apenas faz `console.log` e retorna 200
- Nenhuma mensagem é processada
- Nenhuma transação é criada via WhatsApp
- O resumo semanal está comentado

Vender uma feature que não existe é propaganda enganosa (CDC Art. 37 §1º).

**Impacto:** 🔴 Cobrança por feature inexistente — risco jurídico real.

🔧 **SOLUÇÃO:**
```
Opção A: Implementar o WhatsApp de verdade (ver proposta em cérebro/assistente-whatsapp.md)
Opção B: Remover menção ao WhatsApp da landing page até estar funcional
Opção C: Marcar como "Em breve" com visual diferenciado
```

---

### 🟡 BUG 4 — Firebase SDK carregado duas vezes (modular + compat)

**Onde:** `vendas.html` head + final  
**Código atual:**
```html
<!-- No <head> via firebase-config.js: -->
<script src="firebase-config.js"></script>    <!-- carrega config que usa window.BUD_FIREBASE_CONFIG -->

<!-- No final do body: -->
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
<script src="js/vendas.js"></script>
```

**Problema:** O `firebase-config.js` no head configura o Firebase para uso global. Depois, no final, a versão **compat** do SDK é carregada (app-compat + auth-compat). O vendas.js usa `firebase.auth().currentUser` (API compat) enquanto o resto do app usa modular.

Duas instâncias do Firebase SDK coexistem na página:
1. O modular (via firebase-config.js) — pode não fazer nada aqui
2. O compat (scripts no final) — usado pelo vendas.js

Isso adiciona ~130KB de JS desnecessário na landing page (a modular não é usada aqui).

**Impacto:** 🟡 Performance degradada — landing page mais pesada que necessário.

🔧 **SOLUÇÃO:**
```html
<!-- Remover firebase-config.js do head (não é usado diretamente) -->
<!-- OU converter vendas.js para usar ES module + modular SDK -->

<!-- Alternativa minimalista: -->
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
<script>
    // Config inline, sem carregar firebase-config.js
    firebase.initializeApp(window.BUD_FIREBASE_CONFIG || { /* config */ });
</script>
<script src="js/vendas.js"></script>
```

---

### 🟡 BUG 5 — CTA links inconsistentes entre seções

**Onde:** Múltiplas seções na `vendas.html`  

| Seção | CTA | Link |
|---|---|---|
| Navbar | "Começar Grátis" | `index.html` (login) |
| Hero | "🚀 Começar Grátis Agora" | `index.html` (login) |
| Pricing Free | "Começar Grátis" | `cadastro.html` |
| Pricing Starter/Pro/Plus | "Assinar X" | `assinar('x')` → se deslogado: `cadastro.html?plano=X` |
| Final CTA | "🚀 Começar Agora — É Grátis" | `index.html` (login) |

**Problema:** Os CTAs principais ("Começar Grátis") direcionam para `index.html` (login), onde um visitante novo não tem conta. Deveria ir para `cadastro.html`. Apenas o card Free acerta.

Se for um visitante novo (o target principal da landing page), clicar em "Começar Grátis" leva ao login, onde ele procura "criar conta" — um passo extra desnecessário.

**Impacto:** 🟡 Conversão reduzida — fricção na jornada do visitante.

🔧 **SOLUÇÃO:**
```html
<!-- Todos os CTAs "Começar Grátis" devem ir para cadastro -->
<a href="cadastro.html" class="cta-btn ..."><span>🚀 Começar Grátis Agora</span></a>
```

---

### 🟡 BUG 6 — Desconto de indicação 30% não refletido nos preços

**Onde:** Seção Pricing completa  

**Problema:** Quando um visitante chega via link de indicação (ex: `vendas.html?ref=ABC123`), os preços mostrados são os cheios. O cadastro.html salva `descontoIndicacao: 30` mas a landing page não reflete isso.

O badge no formulário de cadastro diz "🎁 Ganhe 30% de desconto", mas na landing o visitante não sabe qual seria o preço final.

**Cenário real:** Amigo compartilha link → visitante vê landing → planos mostram R$29,90 → pensa "caro" → fecha sem cadastrar. Se visse "R$20,93 (30% off com indicação)" poderia converter.

**Impacto:** 🟡 Oportunidade de conversão perdida.

🔧 **SOLUÇÃO:**
```javascript
// Detectar referral na URL
const params = new URLSearchParams(window.location.search);
const refCode = params.get('ref');
if (refCode) {
    // Mostrar badge de desconto nos preços
    document.querySelectorAll('.pricing-card').forEach(card => {
        const priceEl = card.querySelector('.text-4xl');
        if (priceEl) {
            const originalText = priceEl.textContent;
            // Adicionar preço com desconto
        }
    });
}
```

---

### 🟡 BUG 7 — Sem meta tags SEO e Open Graph para landing page

**Onde:** `vendas.html` `<head>`  
**Código atual:**
```html
<title>Bud Finanças – Controle Financeiro Inteligente</title>
<!-- Nenhum meta description, og:title, og:image, etc. -->
```

**Problema:** Para uma landing page que precisa ranquear no Google e ser compartilhável em redes sociais, faltam:
- `<meta name="description">` — afeta SEO diretamente
- `<meta property="og:title">` / `og:description` / `og:image` — afeta compartilhamento no WhatsApp, Facebook, LinkedIn
- `<meta name="twitter:card">` — afeta Twitter/X
- `<link rel="canonical">`

Quando alguém compartilha o link no WhatsApp, aparece apenas a URL sem preview rico.

**Impacto:** 🟡 SEO e social sharing prejudicados — menos tráfego orgânico.

🔧 **SOLUÇÃO:**
```html
<meta name="description" content="Controle suas finanças com IA: importação automática, cartões, relatórios e assistente WhatsApp. Teste 3 dias grátis.">
<meta property="og:type" content="website">
<meta property="og:title" content="Bud Finanças – Controle Financeiro Inteligente">
<meta property="og:description" content="Organize suas finanças com IA. Importe extratos, controle cartões e veja relatórios visuais.">
<meta property="og:image" content="https://budfinancas.com/og-image.png">
<meta property="og:url" content="https://budfinancas.com/vendas.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://budfinancas.com/vendas.html">
```

---

### 🟢 BUG 8 — Testimonials possivelmente fabricados

**Onde:** `vendas.html` seção Social Proof (linha ~640)  

**Problema:** Os 3 testimonials ("Mariana S.", "Ricardo L.", "Amanda T.") têm nomes genéricos, avatares com inicial e textos polidos. Se não correspondem a usuários reais, isso configura propaganda enganosa (CDC Art. 37).

Se são de usuários reais, falta comprovação (link, foto, etc.). Se são fictícios, deveriam ser removidos ou marcados como "simulação".

**Impacto:** 🟢 Risco de credibilidade — menor que os bugs técnicos mas relevante.

🔧 **SOLUÇÃO:**
```
Opção A: Coletar testimonials reais de usuários (com consentimento)
Opção B: Remover seção de testimonials
Opção C: Marcar como "Exemplos de como nossos usuários usam o app"
```

---

### 🟢 BUG 9 — Screen mockups são placeholders genéricos

**Onde:** `vendas.html` seção App Screens  

**Problema:** Os "mockups" do app são divs coloridas com emojis e texto descritivo, não screenshots reais. Visual:
```
┌────────────────┐
│ 🔴 🟡 🟢      │
│                │
│     📊        │
│  Dashboard...  │
│                │
└────────────────┘
```

Não mostram o app real. O visitante não sabe como o app realmente se parece.

**Impacto:** 🟢 Conversão potencialmente reduzida — mockups reais convertem mais.

🔧 **SOLUÇÃO:**
```html
<!-- Usar screenshots reais do app -->
<div class="screen-mockup glow-blue">
    <div class="bar">...</div>
    <img src="screenshots/dashboard.png" alt="Dashboard Bud Finanças"
         class="w-full" loading="lazy" />
</div>
```

---

### 🟢 BUG 10 — Firebase compat CDN sem SRI hash

**Onde:** `vendas.html` final do body  
**Código atual:**
```html
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
```

**Problema:** Sem atributo `integrity`. Mesma vulnerabilidade de supply-chain das outras telas com CDN.

**Impacto:** 🟢 Risco teórico de supply-chain.

🔧 **SOLUÇÃO:** Adicionar `integrity` + `crossorigin="anonymous"`.

---

### 🟢 BUG 11 — IntersectionObserver nunca faz `unobserve`

**Onde:** `js/vendas.js` linhas 44-51  
**Código atual:**
```javascript
var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });
```

**Problema:** Após um elemento receber `.visible`, ele nunca é unobserved. O observer continua monitorando TODOS os elementos `.fade-up` mesmo após já terem animado. Em uma página com ~20+ elementos fade-up, isso mantém callbacks sendo disparados a cada scroll.

**Impacto:** 🟢 Performance mínima — observers são eficientes, mas é boa prática unobserve.

🔧 **SOLUÇÃO:**
```javascript
var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);  // ← para de observar
        }
    });
}, { threshold: 0.1 });
```

---

## 6. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | uid/email spoofável no body (IDOR) | Baixo — remover do body + ajustar CF |
| 2 | 🔴 | "∞ Cartões no Pro" falso | Baixo — corrigir texto |
| 3 | 🔴 | WhatsApp vendido mas decorativo | Alto — implementar ou remover |
| 4 | 🟡 | Firebase SDK duplicado | Baixo — remover modular |
| 5 | 🟡 | CTA links inconsistentes | Baixo — trocar para cadastro.html |
| 6 | 🟡 | Desconto indicação não exibido | Médio — detectar ref na URL |
| 7 | 🟡 | Sem meta SEO/OG | Baixo — adicionar tags |
| 8 | 🟢 | Testimonials possivelmente falsos | Médio — coletar reais |
| 9 | 🟢 | Mockups genéricos | Médio — screenshots reais |
| 10 | 🟢 | Firebase CDN sem SRI | Baixo |
| 11 | 🟢 | IntersectionObserver sem unobserve | Baixo |

---

## 7. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **11** |
| 🔴 Críticos | 3 |
| 🟡 Altos | 4 |
| 🟢 Baixos | 4 |
| Linhas HTML | ~700 |
| Linhas JS | 50 |
| API calls | 1 (create-subscription) |
| Seções da landing | 8 (hero, stats, features, screens, AI, pricing, social, CTA) |
| Planos mostrados | 4 (Free, Starter, Pro, Plus) |
| Deps externas | Firebase compat CDN, firebase-config.js, bud-utils.js, bud-loader.js |

---

## 💚 Pontos Positivos

1. **Design profissional** — Landing page com visuais de alto nível: gradientes, glassmorphism, animações
2. **Scroll animations** — IntersectionObserver para fade-up suave
3. **Pricing claro** — 4 tiers bem diferenciados com features listadas
4. **Auth-aware checkout** — `assinar()` verifica se está logado antes de redirecionar ao Mercado Pago
5. **Botões disabled durante request** — Previne duplo-clique no checkout
6. **Error handling no fetch** — try/catch com toast amigável + restauração dos botões
7. **idToken como auth** — Bearer token no header para autenticação com o backend
8. **Responsive design** — Grid adapta entre mobile e desktop, navbar clean
