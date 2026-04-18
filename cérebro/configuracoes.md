# 🧠 Cérebro — Tela de Ajustes / Configurações

> **Arquivos:** `configuracoes.html` (484 linhas) + `js/configuracoes.js` (797 linhas)  
> **Rota:** `/configuracoes.html`  
> **Total:** 1.281 linhas analisadas  
> **Última auditoria:** 2026-04-09

---

## 📌 Visão Geral

A tela **Ajustes** (título no header: "Ajustes") é o centro de controle da conta do usuário. Concentra:

1. **Gestão de Assinatura** — card premium glassmorphism exibindo plano atual, trial, upgrade/downgrade via Mercado Pago
2. **Informações da Conta** — matrícula (Firestore), data de criação (Auth metadata)
3. **Preferências do App** — notificações push (FCM), modo escuro (toggle), tutorial (reset)
4. **Assistente WhatsApp** — vincular/desvincular número, feature-gated por plano Plus
5. **LGPD / Privacidade** — exportar dados (XLSX via SheetJS), revogar consentimento de notificações, política de privacidade, excluir conta permanentemente
6. **Segurança** — alterar senha (e-mail de reset), logout, resetar toda a conta (apagar tudo e voltar ao onboarding)

### Relação com outras telas

| Tela | Relação |
|---|---|
| `index.html` | Redirecionamento se não autenticado + destino pós-logout |
| `onboarding.html` | Destino pós-reset total |
| `politica-privacidade.html` | Link direto na seção LGPD |
| `insights.html` | Compartilha lógica de push notifications (FCM) |
| `plano-config.js` | `NexoPlanos.resolvePlan()` / `canUseFeature()` para controle de planos |
| `dark-mode.js` | Controle global de dark mode — **duplicado** com lógica local no JS |
| `bud-utils.js` | `budShowToast()` e `escapeHTML()` |
| `tutorial.js` / `tutorial-init.js` | `NexoTutorial.resetAll()` para reiniciar tutorial |

---

## 🗄️ Estrutura de Dados

### Documento Principal — `usuarios/{uid}`

```
{
  matricula: string,           // ID exibido como "Matrícula"
  plano: string,               // 'free' | 'starter' | 'pro' | 'plus' | 'trial'
  assinatura: {
    status: string,            // 'authorized' | 'pending' | 'past_due'
    planoPendente: string      // plano aguardando confirmação do MP
  },
  assinaturaStatus: string,    // status paralelo (redundante com assinatura.status)
  whatsappVinculado: string,   // Número no formato '5511999999999'
  onboardingConcluido: boolean,
  downgradeMotivo: string,
  downgradeEm: string          // ISO date
}
```

### Subcoleção — `usuarios/{uid}/tokens/fcm`

```
{
  token: string | null,        // FCM token ou null quando desativado
  atualizadoEm: string,       // ISO date
  dispositivo: string,        // navigator.userAgent
  revogadoEm: string          // ISO date (LGPD revogação)
}
```

### Subcoleções apagadas no RESET

```
transacoes, cartoes, categorias, contas, dividas, investimentos, 
limites, metas, tokens, carteira, recorrentes, compras, 
listas-compras, notificacoes_eventos_enviadas
+ metas/{id}/depositos (sub-subcoleção)
+ perfil/config
```

### Subcoleções apagadas na EXCLUSÃO DE CONTA

Mesmas acima + documento `usuarios/{uid}` + conta de autenticação (Firebase Auth `user.delete()`)

---

## 🏗️ Estrutura HTML

```
<body>
├── #mobileOverlay (sidebar backdrop)
├── #sidebar-container (loadado via sidebar.js)
├── <main>
│   ├── <header> (sticky, z-30)
│   │   ├── botão toggleSidebar (md:hidden)
│   │   ├── h1 "Ajustes"
│   │   ├── #nomeUsuarioTopo + #planoTopo
│   │   └── avatar (#avatarSiglaTopo / #avatarFotoTopo)
│   │
│   └── <div.p-4.max-w-3xl> (container principal)
│       ├── 🃏 Card Premium Glassmorphism (.premium-card)
│       │   ├── #blocoAssinatura (.glass-inner)
│       │   │   ├── #statusAssinaturaIcone / Titulo / Descricao
│       │   │   └── #btnUpgradeAssinatura → scroll p/ #acaoPlano
│       │   └── #acaoPlano (populado dinamicamente: botões upgrade + cancelar)
│       │
│       ├── 🃏 Informações da Conta
│       │   ├── #infoContaId (matrícula)
│       │   └── #infoContaCriacao (data criação Auth)
│       │
│       ├── 🃏 Preferências do App
│       │   ├── Notificações Push (#pushIcone, #pushStatus, #btnPush)
│       │   │   └── #modalInstalarIOS (guia instalação iOS Safari → PWA)
│       │   ├── Modo Escuro (#toggleDarkMode, #toggleDarkModeDot, #darkModeIcone)
│       │   └── Tutorial (#NexoTutorial.resetAll)
│       │
│       ├── 🃏 Assistente WhatsApp (#secaoWhatsApp)
│       │   ├── #badgeWhatsApp (Desconectado / Conectado / PLUS)
│       │   ├── #whatsappProBanner (feature gate — plano Plus)
│       │   ├── #whatsappConfig
│       │   │   ├── #whatsappStatusBox
│       │   │   ├── #inputWhatsApp (tel, +55 prefixado)
│       │   │   ├── #btnVincularWhatsApp → vincularWhatsApp()
│       │   │   ├── #btnDesvincularWhatsApp → desvincularWhatsApp()
│       │   │   └── #whatsappFuncionalidades (grid 2col com features)
│       │
│       ├── 🃏 LGPD: Privacidade e Dados
│       │   ├── Baixar meus dados → exportarMeusDados() (XLSX)
│       │   ├── Gerenciar notificações → revogarConsentimentoNotificacoes()
│       │   ├── Política de Privacidade → link externo
│       │   └── Excluir conta → abrirModalExcluirConta()
│       │
│       └── 🃏 Segurança e Conta
│           ├── Alterar Senha → alterarSenha()
│           ├── Sair da Conta → fazerLogout()
│           └── Apagar tudo → abrirModalReset()
│
├── #modalReset (z-[100], bg-black/50) — confirmação de reset total
├── #modalExcluirConta (z-[100], bg-black/50) — confirmação LGPD com input "EXCLUIR"
│
└── ⚠️ EXTRA: 2x </div> órfãos (linhas 466-467) — tags sobrando após modalExcluirConta
```

---

## 🎨 CSS Custom

| Classe/Seletor | Propósito | Declarado em |
|---|---|---|
| `.premium-card` | Gradient escuro (0f172a→1e3a5f→0c4a6e) + pseudo-elements radial glow | `<style>` inline |
| `.premium-card::before` | Glow azul top-right, clip-path rounded | `<style>` inline |
| `.premium-card::after` | Glow verde bottom-left | `<style>` inline |
| `.glass-inner` | Background rgba branco 6% + blur 20px + borda branca 10% | `<style>` inline |
| `.plan-card` | Cards de plano no upgrade (hover translate -4px) | `<style>` inline |
| `.plan-card.popular` | Border sky + box-shadow glow | `<style>` inline |
| `.price-strike` | Linha vermelha riscada sobre preço antigo | `<style>` inline |
| `@keyframes shimmer` | Background gradient animado | `<style>` inline |
| `.shimmer-badge` | Badge animado com shimmer (NÃO USADO no HTML) | `<style>` inline |
| `.glass-panel` | Sidebar glass — definido aqui como correção (comentário no CSS) | `<style>` inline |
| `.icon-3d` | Drop-shadow 3D para emojis | `<style>` inline + `dark-mode.js` |
| Dark mode rules | 12+ seletores `body.dark ...` | `<style>` inline + `dark-mode.js` |

---

## 🔄 Fluxo Completo

### 1. Inicialização (`onAuthStateChanged`)

```
auth.onAuthStateChanged(user)
├── Se user == null → redireciona para index.html
├── Limpa parâmetros de URL (preapproval_id do Mercado Pago checkout)
├── Exibe nome, avatar (localStorage foto), data criação, matrícula (Firestore)
├── Lê documento usuarios/{uid}
│   └── userData = userSnap.data()
├── NexoPlanos.resolvePlan(userData)
│   ├── Se shouldDowngrade → updateDoc no Firestore (plano→free)
│   ├── effectivePlan = resolved plan
│   └── isTrialActive = boolean
├── Atualiza card de assinatura:
│   ├── isPaidPlan? → ícone 👑, texto ativo, esconde btnUpgrade
│   ├── isTrialActive? → ícone ⏳, dias restantes, data expiração
│   └── free? → ícone 🔒, texto gratuito, mostra btnUpgrade
├── atualizarBotoesPlanos(effectivePlan)
│   └── Gera HTML dinâmico no #acaoPlano: botões upgrade + cancelar
├── Se assinatura.status == 'pending' → mostra banner amarelo
├── verificarEstadoPush(uid) → checa permissão, token FCM
└── carregarWhatsApp(uid, canWhatsApp) → feature gate por plano
```

### 2. Fluxo de Upgrade (Mercado Pago)

```
iniciarAssinatura(planKey)
├── Desabilita todos os .btn-upgrade-mp
├── getIdToken() → Bearer auth
├── POST /mercadopago/create-subscription { planKey, uid, email }
│   ├── Sucesso → window.location.href = data.init_point (checkout MP)
│   └── Erro → budShowToast() + location.reload()
└── Retorno do checkout: preapproval_id na URL → limpa params, mostra pending banner
```

### 3. Fluxo de Cancelamento

```
cancelarAssinatura()
├── Modal confirmação (overlay JS com classes Tailwind ⚠️)
├── getIdToken() → Bearer auth
├── POST /mercadopago/cancel-subscription { uid }
│   ├── Sucesso → toast + location.reload()
│   └── Erro → toast erro
```

### 4. Fluxo de Push Notifications

```
verificarEstadoPush(uid)
├── file:// protocol → "Disponível apenas online"
├── iOS não-standalone → mostra guia instalação PWA
├── Notification não suportada → "Não suportado"
├── permission == 'granted'
│   ├── Verifica documento tokens/fcm no Firestore
│   │   ├── token existe → "Ativadas" + botão Desativar
│   │   └── token null → "Desativadas" + botão Ativar
├── permission == 'denied' → "Bloqueadas"
└── default → "Desativadas" + botão Ativar

ativarPush()
├── requestPermission()
├── serviceWorker.register('firebase-messaging-sw.js')
├── messaging.getToken({ vapidKey, sw })
└── Salva em tokens/fcm { token, atualizadoEm, dispositivo }

desativarPush()
└── tokens/fcm.set({ token: null })
```

### 5. Fluxo WhatsApp

```
carregarWhatsApp(uid, isPro)
├── !isPro → mostra banner Plus, esconde config
├── isPro → busca userData.whatsappVinculado
│   ├── Tem número → atualizarUIWhatsAppConectado()
│   └── Sem número → mostra input + botão vincular

vincularWhatsApp()
├── Valida input (10-11 dígitos limpos)
├── Concatena '55' + input
├── updateDoc { whatsappVinculado: numero }
└── Atualiza UI (badge, status, input disabled)

desvincularWhatsApp()
├── Modal confirmação (overlay JS ⚠️)
├── updateDoc { whatsappVinculado: FieldValue.delete() }
└── atualizarUIWhatsAppDesconectado()
```

### 6. Fluxo Reset Total

```
abrirModalReset() → mostra #modalReset (flex)

executarReset()
├── Apaga sub-subcoleções: metas/{id}/depositos (Promise.all sem batch)
├── Loop 14 subcoleções → para cada: get().then(deleteAll) via Promise.all (SEM BATCH)
├── Deleta perfil/config
├── Update: onboardingConcluido = false
├── Limpa localStorage (keys com uid + nexo_dark_mode)
└── Redireciona para onboarding.html
```

### 7. Fluxo Excluir Conta (LGPD)

```
abrirModalExcluirConta() → mostra #modalExcluirConta com input "EXCLUIR"

executarExclusaoConta()
├── Valida input == "EXCLUIR"
├── Apaga sub-subcoleções: metas depositos (COM batch 500 ✓)
├── Loop 14 subcoleções → batch.delete chunks de 500 (✓)
├── Deleta perfil/config
├── Deleta documento usuarios/{uid}
├── user.delete() (Firebase Auth)
│   └── Catch: auth/requires-recent-login → signOut + redirect
├── localStorage.clear()
└── Redireciona para index.html
```

### 8. Exportar Dados (LGPD)

```
exportarMeusDados()
├── XLSX.utils.book_new()
├── Lê documento principal → aba "Perfil"
├── Loop 8 subcoleções: transacoes, cartoes, categorias, contas, dividas, investimentos, limites, metas
│   └── Para cada: get() → json_to_sheet → book_append_sheet
├── XLSX.writeFile('bud-meus-dados-2026-04-09.xlsx')
└── toast sucesso
```

---

## 📦 Funções

### `js/configuracoes.js` (797 linhas — escopo global `window.*`)

| Função | Linha | Escopo | Descrição |
|---|---|---|---|
| `iniciarAssinatura(planKey)` | ~33 | global | Cria assinatura via Cloud Function Mercado Pago, redireciona p/ checkout |
| `cancelarAssinatura()` | ~68 | global | Cancela assinatura via Cloud Function, overlay confirmação JS |
| `atualizarBotoesPlanos(effectivePlan)` | ~101 | global | Gera HTML dinâmico no #acaoPlano (upgrade buttons + cancelar link) |
| `auth.onAuthStateChanged` | ~130 | callback | Inicialização principal: plano, assinatura, push, WhatsApp |
| `carregarWhatsApp(uid, isPro)` | ~233 | local | Feature gate WhatsApp, busca número vinculado |
| `atualizarUIWhatsAppConectado(numero)` | ~251 | local | Atualiza UI quando WhatsApp está vinculado |
| `atualizarUIWhatsAppDesconectado()` | ~268 | local | Reseta UI para estado desconectado |
| `vincularWhatsApp()` | ~284 | window | Valida número, salva no Firestore, atualiza UI |
| `desvincularWhatsApp()` | ~317 | window | Modal confirmação, remove do Firestore, atualiza UI |
| `alterarSenha()` | ~341 | window | Modal confirmação, envia e-mail de reset via Auth |
| `abrirModalReset()` | ~393 | window | Mostra #modalReset |
| `fecharModalReset()` | ~398 | window | Esconde #modalReset |
| `executarReset()` | ~403 | window | Apaga TODAS as subcoleções + localStorage, redireciona onboarding |
| `verificarEstadoPush(uid)` | ~457 | local | Detecta suporte push, iOS, permissão, token exist. |
| `ativarPush()` | ~520 | window | Solicita permissão, registra SW, salva token FCM |
| `desativarPush()` | ~557 | window | Seta token = null no Firestore |
| `fazerLogout()` | ~567 | window | Modal confirmação, signOut, redireciona index |
| `initDarkMode()` | ~586 | local | Lê localStorage, aplica dark mode |
| `applyDarkMode(enabled)` | ~591 | local | Altera classes body, toggle, ícone |
| `toggleDarkMode()` | ~607 | window | Toggle e persiste dark mode |
| `exportarMeusDados()` | ~613 | window | Exporta XLSX com perfil + 8 subcoleções |
| `revogarConsentimentoNotificacoes()` | ~663 | window | Modal confirmação, seta token null + revogadoEm |
| `abrirModalExcluirConta()` | ~686 | window | Mostra modal com input "EXCLUIR" |
| `fecharModalExcluirConta()` | ~692 | window | Esconde modal exclusão |
| `executarExclusaoConta()` | ~697 | window | Apaga tudo + conta Auth + limpa tudo |

---

## 🔢 Variáveis de Estado

| Variável | Tipo | Escopo | Uso |
|---|---|---|---|
| `VAPID_KEY` | `const string` | módulo | Chave VAPID para FCM (via `window.BUD_VAPID_KEY`) |
| `firebaseConfig` | `const object` | módulo | Config Firebase (via `window.BUD_FIREBASE_CONFIG`) |
| `app` | `Firebase.App` | módulo | Instância Firebase compat |
| `auth` | `Auth` | módulo | Instância Firebase Auth compat |
| `db` | `Firestore` | módulo | Instância Firestore compat |
| `messaging` | `Messaging\|null` | var | Instância FCM ou null se não suportado |
| `usuarioAtual` | `User\|null` | var | Usuário logado atual |
| `FUNCTIONS_URL` | `string` | var | Base URL das Cloud Functions |

---

## 🐛 Bugs, Incoerências e Melhorias

---

### 🔴 BUG 1 — Overlays de confirmação JS usam classes Tailwind dinâmicas (INVISÍVEIS)

**Arquivo:** `js/configuracoes.js`  
**Linhas:** 77, 358, 381, 597, 700

```javascript
ov.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
```

**Problema:** São **5 ocorrências** de overlays de confirmação criados via JS usando `bg-black/50` e `z-[9999]`. No build estático do Tailwind, essas classes **não existem** no CSS compilado. Os modais ficam invisíveis — sem background escuro e sem z-index, o conteúdo fica atrás de tudo.

**Funções afetadas:**
- `cancelarAssinatura()` (linha 77)
- `desvincularWhatsApp()` (linha 358)
- `alterarSenha()` (linha 381)
- `fazerLogout()` (linha 597)
- `revogarConsentimentoNotificacoes()` (linha 700)

**Cenário:** Usuário clica "Sair da conta" → overlay aparece sem fundo escuro, sem z-index → botões ficam por baixo do conteúdo → impossível interagir.

**Impacto:** Todas as ações destrutivas (cancelar assinatura, deslogar, desvincular WhatsApp, alterar senha, revogar push) estão com modais quebrados.

### 🔧 SOLUÇÃO

Usar `style.cssText` inline em vez de classes Tailwind:

```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
```

Aplicar nas 5 ocorrências.

---

### 🔴 BUG 2 — Tags `</div>` órfãs no HTML causam estrutura DOM inválida

**Arquivo:** `configuracoes.html`  
**Linhas:** 466-467

```html
    </div>  <!-- fecha #modalExcluirConta correctly -->
        </div>   <!-- ⚠️ ÓRFÃ 1 -->
    </div>       <!-- ⚠️ ÓRFÃ 2 -->
```

**Problema:** Após o fechamento correto do `#modalExcluirConta`, há **2 tags `</div>` extras** que não pertencem a nenhum elemento aberto. Isso causa parsing HTML incorreto — o browser tenta "consertar" fechando elements que não deveria, potencialmente deslocando os scripts que vêm logo abaixo.

**Cenário:** O browser pode ignorar silenciosamente, mas em casos de parsing estrito ou manipulação DOM, pode causar comportamentos inesperados. Ferramentas de validação (W3C) vão reportar erro.

**Impacto:** Estrutura DOM potencialmente corrompida, scripts podem não carregar na ordem esperada.

### 🔧 SOLUÇÃO

Remover as 2 linhas órfãs:

```html
    </div>
    <!-- ✅ removido: 2 </div> extras que não correspondem a nenhum elemento -->

    <script src="plano-config.js"></script>
```

---

### 🔴 BUG 3 — `executarReset()` não usa batch writes — pode estourar cota e travar

**Arquivo:** `js/configuracoes.js`  
**Linhas:** 403-456

```javascript
var snap = await db.collection('usuarios').doc(uid).collection(sub).get();
var deletes = [];
snap.forEach(function(d) { deletes.push(d.ref.delete()); });
if (deletes.length > 0) await Promise.all(deletes);
```

**Problema:** O reset faz `Promise.all` de todos os deletes de cada subcoleção **sem chunking**. Se `transacoes` tiver 3000+ docs, isso dispara 3000 operações simultâneas de delete, estourando limites de conexão do Firestore e potencialmente falhando parcialmente.

**Comparação:** A função `executarExclusaoConta()` (LGPD) **já implementa** batch com chunks de 500. Mas o reset não.

**Cenário:** Usuário com muitas transações clica "Resetar tudo" → milhares de promises simultâneas → timeout do Firestore → erro parcial → dados inconsistentes (algumas coleções apagadas, outras não).

**Impacto:** Reset incompleto, conta em estado corrupto, usuário enviado para onboarding com dados parciais.

### 🔧 SOLUÇÃO

Usar a mesma lógica de batch 500 que já existe em `executarExclusaoConta`:

```javascript
for (var i = 0; i < subcollections.length; i++) {
    var sub = subcollections[i];
    var snap = await db.collection('usuarios').doc(uid).collection(sub).get();
    var docs = snap.docs;
    for (var j = 0; j < docs.length; j += 500) {
        var batch = db.batch();
        docs.slice(j, j + 500).forEach(function(d) { batch.delete(d.ref); });
        await batch.commit();
    }
}
```

---

### 🔴 BUG 4 — Exportação LGPD incompleta: faltam subcoleções no export mas são apagadas no delete

**Arquivo:** `js/configuracoes.js`  
**Linhas:** ~628-650 vs ~730-740

```javascript
// EXPORT — só 8 subcoleções:
var colecoes = ['transacoes', 'cartoes', 'categorias', 'contas', 'dividas', 'investimentos', 'limites', 'metas'];

// DELETE — 14 subcoleções:
var colecoes = ['transacoes', 'cartoes', 'categorias', 'contas', 'dividas', 'investimentos', 'limites', 'metas', 'tokens', 'recorrentes', 'carteira', 'compras', 'listas-compras', 'notificacoes_eventos_enviadas'];
```

**Problema:** O botão "Baixar meus dados" (LGPD Art. 18 — portabilidade) exporta apenas 8 das 14 subcoleções. Faltam: `recorrentes`, `carteira`, `compras`, `listas-compras`, `tokens`, `notificacoes_eventos_enviadas`. O usuário pode baixar seus dados **antes de excluir**, mas receberá um arquivo incompleto — dados de recorrentes, carteira e compras serão perdidos sem backup.

**Cenário:** Usuário quer migrar para outro app → exporta dados → exclui conta → percebe que recorrentes, compras e saldo da carteira não foram exportados → dados permanentemente perdidos.

**Impacto:** Violação do Art. 18 da LGPD (direito à portabilidade completa dos dados).

### 🔧 SOLUÇÃO

Sincronizar as listas:

```javascript
var colecoes = ['transacoes', 'cartoes', 'categorias', 'contas', 'dividas', 'investimentos', 'limites', 'metas', 'recorrentes', 'carteira', 'compras', 'listas-compras'];
var nomes = {
    transacoes: 'Transações', cartoes: 'Cartões', categorias: 'Categorias',
    contas: 'Contas', dividas: 'Dívidas', investimentos: 'Investimentos',
    limites: 'Limites', metas: 'Metas', recorrentes: 'Recorrentes',
    carteira: 'Carteira', compras: 'Compras', 'listas-compras': 'Listas de Compras'
};
```

Também exportar sub-subcoleções: `metas/{id}/depositos`.

---

### 🟡 BUG 5 — Dark mode duplicado: lógica local em configuracoes.js + dark-mode.js global

**Arquivo:** `js/configuracoes.js` (linhas 586-612) + `dark-mode.js` + `configuracoes.html` (linhas 84-96)

**Problema:** A tela de configurações tem **3 camadas de dark mode**:

1. **CSS inline no `<style>`** (12+ seletores `body.dark ...`) — linhas 84-96 do HTML
2. **Lógica JS local** (`initDarkMode`, `applyDarkMode`, `toggleDarkMode`) — linhas 586-612 do JS
3. **`dark-mode.js` global** carregado como `<script>` no final — injeta CSS programaticamente + tem sua própria lógica de toggle

A função `toggleDarkMode` é definida no `configuracoes.js` E provavelmente também no `dark-mode.js`. Como ambos são carregados (JS primeiro, dark-mode.js depois), o global sobrescreve o local — mas o `initDarkMode()` local já rodou antes. Conflito de timing.

**Cenário:** Ao abrir a página, `initDarkMode()` do configuracoes.js roda → aplica dark mode → depois `dark-mode.js` carrega → pode conflitar com estado do toggle se tiver lógica diferente.

**Impacto:** Possível flash de tema incorreto, toggle visual fora de sincronia.

### 🔧 SOLUÇÃO

Remover a lógica local de dark mode do `configuracoes.js` (linhas 586-612) e depender exclusivamente do `dark-mode.js` global. O toggle visual (botão, ícone) pode ser controlado via evento global:

```javascript
// Em configuracoes.js, substituir initDarkMode/applyDarkMode/toggleDarkMode por:
function syncDarkToggleUI() {
    var isDark = document.body.classList.contains('dark');
    var toggle = document.getElementById('toggleDarkMode');
    var dot = document.getElementById('toggleDarkModeDot');
    var icone = document.getElementById('darkModeIcone');
    if (toggle) toggle.style.background = isDark ? '#3b82f6' : '#cbd5e1';
    if (dot) dot.style.left = isDark ? '1.5rem' : '0.25rem';
    if (icone) icone.innerText = isDark ? '🌙' : '☀️';
}
syncDarkToggleUI();
```

---

### 🟡 BUG 6 — CSS `.plan-card`, `.price-strike`, `.shimmer-badge` declarados mas não usados

**Arquivo:** `configuracoes.html`  
**Linhas:** 56-76

```css
.plan-card { ... }
.plan-card:hover { ... }
.plan-card.popular { ... }
.price-strike { ... }
.shimmer-badge { ... }
```

**Problema:** São 5 regras CSS declaradas para cards de plano e badges que **não existem em nenhum elemento** do HTML atual. A função `atualizarBotoesPlanos()` gera botões `.btn-upgrade-mp` e não usa nenhuma dessas classes. São resíduos de uma versão anterior da UI de planos.

**Impacto:** CSS morto aumentando payload (~40 linhas desnecessárias).

### 🔧 SOLUÇÃO

Remover os blocos CSS `.plan-card`, `.plan-card:hover`, `.plan-card.popular`, `.price-strike`, `@keyframes shimmer`, `.shimmer-badge`.

---

### 🟡 BUG 7 — Modais no HTML usam `bg-black/50` e `z-[100]` — classes Tailwind arbitrárias

**Arquivo:** `configuracoes.html`  
**Linhas:** 413, 440

```html
<div id="modalReset" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden items-center justify-center p-4">
<div id="modalExcluirConta" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden items-center justify-center p-4">
```

**Problema:** `bg-black/50` e `z-[100]` são valores arbitrários que podem não estar no build estático do Tailwind. Se não estiverem, os modais de Reset e Excluir Conta ficam sem background escuro e sem z-index adequado.

**Nota:** Diferente do BUG 1 (JS dinâmico), estes estão no HTML estático — o Tailwind scanner **pode** tê-los incluído no build. Verificar no `tailwind.css` compilado.

**Impacto:** Potencial: modais sem overlay escuro.

### 🔧 SOLUÇÃO

Adicionar estilos inline como fallback:

```html
<div id="modalReset" class="fixed inset-0 hidden items-center justify-center p-4" 
     style="background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:100;">
```

Ou verificar se `bg-black/50` está no build e manter.

---

### 🟡 BUG 8 — `iniciarAssinatura` faz `location.reload()` no catch — perde contexto de erro

**Arquivo:** `js/configuracoes.js`  
**Linhas:** ~55-64

```javascript
if (!res.ok || !data.init_point) {
    budShowToast(data.error || 'Erro ao criar assinatura. Tente novamente.', 'erro');
    location.reload(); // ← Toast desaparece imediatamente!
    return;
}
// ...
} catch (err) {
    console.error('Erro ao iniciar assinatura:', err);
    budShowToast('Erro de conexão. Tente novamente.', 'erro');
    location.reload(); // ← Toast desaparece imediatamente!
}
```

**Problema:** Após mostrar o toast de erro, faz `location.reload()` imediatamente. O toast nem é exibido porque a página recarrega.

**Cenário:** Erro na Cloud Function → toast de erro criado × `location.reload()` instantâneo → usuário apenas vê a página recarregar sem entender o que aconteceu.

**Impacto:** Usuário não vê mensagem de erro, não sabe o que fazer.

### 🔧 SOLUÇÃO

Remover `location.reload()` e restaurar estado dos botões:

```javascript
if (!res.ok || !data.init_point) {
    budShowToast(data.error || 'Erro ao criar assinatura. Tente novamente.', 'erro');
    document.querySelectorAll('.btn-upgrade-mp').forEach(function(b) {
        b.disabled = false;
        b.style.opacity = '1';
    });
    if (btn) btn.innerHTML = '⬆ Upgrade para ' + planKey;
    return;
}
```

---

### 🟡 BUG 9 — Reset não apaga todas as subcoleções (falta `compras` e `listas-compras`)

**Arquivo:** `js/configuracoes.js`  
**Linha:** ~431

```javascript
// Reset:
var subcollections = ['transacoes', 'cartoes', 'categorias', 'contas', 'dividas', 'investimentos', 'limites', 'metas', 'tokens', 'carteira', 'recorrentes', 'compras', 'listas-compras', 'notificacoes_eventos_enviadas'];
```

**Verificação:** O reset na verdade **já tem** essas coleções (14 itens). Porém:

**Problema real:** O reset **não apaga o documento principal** `usuarios/{uid}`. Apenas faz `update({ onboardingConcluido: false })`. Isso significa que dados do root do usuário (nome, plano, matricula, whatsappVinculado, assinatura) **sobrevivem ao reset**.

**Cenário:** Usuário reseta tudo → vai para onboarding → mas plano, assinatura, whatsapp vinculado continuam no documento. Dados inconsistentes.

**Impacto:** Reset parcial — dados raiz do perfil não são limpos.

### 🔧 SOLUÇÃO

Adicionar limpeza do documento principal (sem deletar, para manter o UID):

```javascript
await db.collection('usuarios').doc(uid).update({
    onboardingConcluido: false,
    whatsappVinculado: firebase.firestore.FieldValue.delete(),
    // Manter: plano, assinatura, matricula, email (são dados de conta, não de usage)
});
```

---

### 🟡 BUG 10 — `desativarPush` apenas seta `token: null`, não deleta — dados ficam no Firestore

**Arquivo:** `js/configuracoes.js`  
**Linha:** ~561

```javascript
await db.collection('usuarios').doc(usuarioAtual.uid).collection('tokens').doc('fcm').set({ token: null });
```

**Problema:** Ao desativar push, faz `set({ token: null })` que **sobrescreve todo o documento** (perde `dispositivo`, `atualizadoEm`). E o documento continua existindo com `token: null` — não é tecnicamente "desativado" de forma limpa. Backend que itere tokens vai encontrar esse doc e potencialmente falhar.

**Comparação:** `revogarConsentimentoNotificacoes` faz `set({ token: null, revogadoEm: ... })` — salva timestamp da revogação. Mas `desativarPush` não.

**Impacto:** Inconsistência entre desativar e revogar push. Perda de metadados do token.

### 🔧 SOLUÇÃO

Usar `update` em vez de `set`:

```javascript
await db.collection('usuarios').doc(usuarioAtual.uid).collection('tokens').doc('fcm').update({
    token: null,
    desativadoEm: new Date().toISOString()
});
```

---

### 🟡 BUG 11 — WhatsApp: segundo `get()` ao Firestore redundante

**Arquivo:** `js/configuracoes.js`  
**Linhas:** 233-247

```javascript
async function carregarWhatsApp(uid, isPro) {
    // ...
    var userDoc = await db.collection('usuarios').doc(uid).get(); // ← SEGUNDA leitura!
    var userData = userDoc.exists ? userDoc.data() : {};
    var numVinculado = userData.whatsappVinculado || '';
```

**Problema:** O `onAuthStateChanged` já fez `db.collection('usuarios').doc(user.uid).get()` e tem `userData` completo. Mas `carregarWhatsApp` faz **outra leitura** ao Firestore para pegar o mesmo documento. São 2 reads do mesmo doc na mesma inicialização.

**Impacto:** Custo desnecessário de leitura Firestore (faturado por read), latência extra.

### 🔧 SOLUÇÃO

Passar `userData` como parâmetro:

```javascript
// Na chamada:
carregarWhatsApp(user.uid, canWhatsApp, userData);

// Na função:
async function carregarWhatsApp(uid, isPro, userData) {
    // ...
    var numVinculado = (userData && userData.whatsappVinculado) || '';
```

---

### 🟡 BUG 12 — SheetJS (XLSX) carregado via CDN — falha offline para PWA

**Arquivo:** `configuracoes.html`  
**Linha:** 477

```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
```

**Problema:** Biblioteca SheetJS (~400KB) é carregada via CDN externo. Se o usuário estiver offline (PWA instalado), o script não carrega → `XLSX is not defined` → exportação de dados falha.

**Impacto:** Feature LGPD de exportação inacessível offline.

### 🔧 SOLUÇÃO

Servir SheetJS localmente ou fazer lazy-load com fallback:

```javascript
async function loadXLSX() {
    if (window.XLSX) return;
    return new Promise((resolve, reject) => {
        var s = document.createElement('script');
        s.src = './libs/xlsx.full.min.js'; // servido localmente
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}
```

---

### 🟡 BUG 13 — `cancelarAssinatura()` faz `location.reload()` após sucesso — pode perder feedback

**Arquivo:** `js/configuracoes.js`  
**Linha:** ~93

```javascript
if (data.success) {
    budShowToast('Assinatura cancelada. Você foi revertido para o plano Free.', 'sucesso');
    location.reload();
}
```

**Problema:** Similar ao BUG 8 — toast de sucesso seguido de reload imediato. O toast mal aparece antes da página recarregar.

**Impacto:** Feedback de cancelamento perdido para o usuário.

### 🔧 SOLUÇÃO

Usar `setTimeout` para dar tempo ao toast:

```javascript
if (data.success) {
    budShowToast('Assinatura cancelada. Você foi revertido para o plano Free.', 'sucesso');
    setTimeout(function() { location.reload(); }, 2000);
}
```

---

### 🟢 BUG 14 — Classes Tailwind dark mode em innerHTML dos overlays JS não funcionam

**Arquivo:** `js/configuracoes.js`  
**Múltiplas linhas**

```javascript
ov.innerHTML = '<div class="bg-white dark:bg-slate-800 rounded-2xl p-6 ...">...'
```

**Problema:** Os overlays usam `dark:bg-slate-800` no innerHTML dinâmico. Assim como as classes do overlay pai (BUG 1), classes `dark:` prefixadas podem não estar no build estático do Tailwind — o conteúdo interno do modal pode não receber estilo dark mode.

**Impacto:** Modais de confirmação ficam com fundo branco mesmo em dark mode.

### 🔧 SOLUÇÃO

Usar style inline condicionado:

```javascript
var isDark = document.body.classList.contains('dark');
var bgColor = isDark ? '#1e293b' : '#ffffff';
var textColor = isDark ? '#e2e8f0' : '#1e293b';
ov.innerHTML = '<div style="background:' + bgColor + ';border-radius:1rem;padding:1.5rem;margin:1rem;max-width:24rem;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.25);">...'
```

---

### 🟢 BUG 15 — `abrirModalExcluirConta` usa mix de `classList` e `style.display`

**Arquivo:** `js/configuracoes.js`  
**Linhas:** 686-697

```javascript
// Abrir:
document.getElementById('modalExcluirConta').classList.remove('hidden');
document.getElementById('modalExcluirConta').style.display = 'flex';

// Fechar:
document.getElementById('modalExcluirConta').style.display = 'none';
document.getElementById('modalExcluirConta').classList.add('hidden');
```

**Comparação com #modalReset:**
```javascript
// Abrir:
document.getElementById('modalReset').classList.remove('hidden');
document.getElementById('modalReset').classList.add('flex');

// Fechar:
document.getElementById('modalReset').classList.remove('flex');
document.getElementById('modalReset').classList.add('hidden');
```

**Problema:** Dois padrões diferentes para a mesma ação (abrir/fechar modal):
- `#modalReset` usa `classList.add/remove('flex'/'hidden')` — pattern Tailwind
- `#modalExcluirConta` usa `style.display = 'flex'/'none'` + `classList` — mixed

`style.display` tem prioridade sobre classes CSS. Se no futuro alguém adicionar `classList.remove('hidden')` esperando que funcione, o `style.display: none` vai sobrescrever.

**Impacto:** Inconsistência de código, manutenção confusa.

### 🔧 SOLUÇÃO

Padronizar para um único pattern (Tailwind classList):

```javascript
window.abrirModalExcluirConta = function() {
    var modal = document.getElementById('modalExcluirConta');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('inputConfirmarExclusao').value = '';
};

window.fecharModalExcluirConta = function() {
    var modal = document.getElementById('modalExcluirConta');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
};
```

---

### 🟢 BUG 16 — Exportar dados não inclui `metas/{id}/depositos` (sub-subcoleção)

**Arquivo:** `js/configuracoes.js`  
**Linhas:** ~628-650

**Problema:** O export percorre as 8 subcoleções top-level, mas metas tem uma sub-subcoleção `depositos` por meta. Os depósitos (aportes para metas) não são exportados.

**Comparação:** O `executarReset()` e `executarExclusaoConta()` **apagam** os depósitos. Mas o export não os inclui.

**Cenário:** Usuário exporta dados, exclui conta. Os históricos de depósitos por meta são perdidos.

**Impacto:** Dados financeiros parcialmente exportados.

### 🔧 SOLUÇÃO

Adicionar loop especial para depositos após exportar metas:

```javascript
// Após exportar metas, adicionar:
var metasSnap = await db.collection('usuarios').doc(usuarioAtual.uid).collection('metas').get();
var depositosRows = [];
for (var m = 0; m < metasSnap.docs.length; m++) {
    var metaDoc = metasSnap.docs[m];
    var depSnap = await metaDoc.ref.collection('depositos').get();
    depSnap.forEach(function(d) {
        var row = { metaId: metaDoc.id };
        var data = d.data();
        Object.keys(data).forEach(function(k) {
            var v = data[k];
            if (v && typeof v === 'object' && typeof v.toDate === 'function') v = v.toDate().toLocaleString('pt-BR');
            else if (v !== null && v !== undefined) v = String(v);
            else v = '';
            row[k] = v;
        });
        depositosRows.push(row);
    });
}
if (depositosRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depositosRows), 'Depósitos Metas');
}
```

---

### 🟢 BUG 17 — WhatsApp input: prefixo +55 hardcoded, não suporta outros países

**Arquivo:** `js/configuracoes.js` + `configuracoes.html`  
**Linhas:** HTML ~282, JS ~290

```html
<span class="text-lg">🇧🇷</span>
<span class="text-sm font-bold text-slate-600">+55</span>
```
```javascript
var numero = '55' + input;
```

**Problema:** O código assume que todos os usuários são brasileiros. O prefixo `+55` é hardcoded tanto no HTML (visual) quanto no JS (lógica). Não há seleção de código de país.

**Impacto:** Baixo — se o público é exclusivamente BR, é aceitável. Mas se expandir para outros países, vai precisar refatorar.

### 🔧 SOLUÇÃO

Manter hardcoded por enquanto, mas documentar como dívida técnica. Se precisar expandir:

```html
<select id="codigoPais" class="...">
    <option value="55" selected>🇧🇷 +55</option>
    <option value="1">🇺🇸 +1</option>
    <!-- etc -->
</select>
```

---

### 🟢 BUG 18 — Firebase Messaging inicializado incondicionalmente, gera warning no console

**Arquivo:** `js/configuracoes.js`  
**Linhas:** 10-24

```javascript
var messaging = null;
try {
    messaging = firebase.messaging();
    messaging.onMessage(function(payload) { ... });
} catch(e) {
    console.warn('Messaging não disponível:', e);
}
```

**Problema:** Em browsers que não suportam Push/Messaging (ex: Safari desktop antigo, Firefox private mode), `firebase.messaging()` lança exceção que é capturada. Mas o `onMessage` listener também é registrado incondicionalmente — se messaging estiver null mas o try não falhar, `onMessage` pode causar problema.

**Impacto:** Baixo — o try/catch protege. Mas gera warning desnecessário no console em contextos onde push não faz sentido (ex: acessando via `file://`).

### 🔧 SOLUÇÃO

Verificar suporte antes de inicializar:

```javascript
var messaging = null;
if ('Notification' in window && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
        messaging = firebase.messaging();
        messaging.onMessage(function(payload) { /* ... */ });
    } catch(e) {
        console.warn('Messaging não disponível:', e);
    }
}
```

---

## ✅ Checklist por Prioridade

### 🔴 Crítico (fazer imediatamente)
- [ ] BUG 1 — Corrigir 5 overlays JS: `style.cssText` em vez de classes Tailwind
- [ ] BUG 2 — Remover 2 `</div>` órfãs no HTML
- [ ] BUG 3 — Implementar batch writes no `executarReset()` (copiar pattern do delete conta)
- [ ] BUG 4 — Sincronizar subcoleções exportadas com as deletadas (LGPD compliance)

### 🟡 Médio (próxima sprint)
- [ ] BUG 5 — Unificar dark mode (remover duplicação local vs dark-mode.js)
- [ ] BUG 6 — Remover CSS morto (.plan-card, .shimmer-badge, etc.)
- [ ] BUG 7 — Verificar bg-black/50 e z-[100] nos modais HTML estáticos
- [ ] BUG 8 — Remover location.reload() pós-erro em iniciarAssinatura
- [ ] BUG 9 — Limpar dados raiz do perfil no reset (whatsappVinculado etc.)
- [ ] BUG 10 — Padronizar desativarPush (update em vez de set)
- [ ] BUG 11 — Eliminar leitura Firestore redundante no carregarWhatsApp
- [ ] BUG 12 — Servir SheetJS localmente para offline PWA
- [ ] BUG 13 — Delay no reload pós-cancelamento de assinatura

### 🟢 Baixo (melhorias)
- [ ] BUG 14 — Dark mode nos overlays JS (style inline condicionado)
- [ ] BUG 15 — Padronizar open/close de modais (classList vs style.display)
- [ ] BUG 16 — Exportar metas/depositos na portabilidade LGPD
- [ ] BUG 17 — Prefixo +55 hardcoded (dívida técnica)
- [ ] BUG 18 — Verificar suporte antes de inicializar Messaging

---

## 📊 Métricas

| Métrica | Valor |
|---|---|
| **Total de linhas** | 1.281 (484 HTML + 797 JS) |
| **Bugs encontrados** | 18 |
| **🔴 Críticos** | 4 |
| **🟡 Médios** | 9 |
| **🟢 Baixos** | 5 |
| **Leituras Firestore na inicialização** | 2 (perfil duplicado) + 1 (token FCM) = 3 |
| **CDNs externos** | 4 (Firebase compat ×4) + 1 (SheetJS) + 1 (Google Fonts) = 6 |
| **Overlays JS com classes Tailwind** | 5 (todos quebrados) |
| **Funções exportadas (window)** | 14 |
| **Padrões diferentes de modal** | 3 (classList, style.display, overlay JS dinâmico) |

---

## 💚 Pontos Positivos

1. **LGPD bem implementada** — seção completa com exportação, revogação, exclusão de conta e confirmação com input "EXCLUIR"
2. **Downgrade com persist** — diferente de outras telas, aqui o `shouldDowngrade` **é persistido** no Firestore com `updateDoc` (motivo, data, status)
3. **Push notification robusto** — detecção de iOS standalone, Android, bloqueio de browser, protocolo file://, guia de instalação PWA
4. **Mercado Pago integrado** — upgrade/cancelamento via Cloud Functions com Bearer token auth
5. **Exclusão de conta usa batch 500** — implementação correta de chunking para grandes coleções
6. **Confirmação forte para ações destrutivas** — modal com lista do que será apagado + input "EXCLUIR" para exclusão de conta
7. **WhatsApp feature-gated** — corretamente bloqueado por plano via `canUseFeature('whatsappAssistant')`
8. **`escapeHTML` usado em `alterarSenha`** — proteção XSS ao exibir e-mail no modal de confirmação
