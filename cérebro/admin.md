# 🧠 Cérebro — Painel Administrativo (Admin)

> **Arquivos:** `admin.html` (508 linhas) + `js/admin.js` (792 linhas)  
> **Rota:** `/admin.html`  
> **Total:** 1.300 linhas analisadas  
> **Última auditoria:** 2026-04-09

---

## 📌 Visão Geral

O **Painel Administrativo** é uma interface completa de backoffice para gerenciar toda a operação do Bud Finanças. Diferente das demais telas, **não usa sidebar** — tem seu próprio layout com top bar verde. Dividido em 6 abas:

1. **Visão Geral (Overview)** — KPIs (total usuários, pagantes, trial, promos, risco), gráfico de canais de aquisição, distribuição de planos, últimos cadastros, resumo de feature flags
2. **CRM** — Listagem paginada de usuários com enriquecimento de dados (transações, engajamento), busca, filtros, visão 360° do cliente
3. **Feature Flags** — CRUD de flags para controle global de funcionalidades por plano, com seed automático de 19 defaults
4. **Notificações** — Disparar notificações globais por tipo e segmento, histórico com exclusão
5. **Promoções** — CRUD de cupons com código, desconto %, validade, limite de usos
6. **Sistema** — Modo manutenção, cadastros abertos, visibilidade de módulos, mensagem de boas-vindas, versão, gerenciar admins

### Relação com outras telas

| Tela | Relação |
|---|---|
| `index.html` | Redirecionamento se não autenticado |
| `plano-config.js` | NÃO usa `NexoPlanos` — faz checagem de role diretamente |
| `bud-utils.js` | `budShowToast()` para feedback |
| `firebase-config.js` | `BUD_FIREBASE_CONFIG`, `BUD_FUNCTIONS_URL` |
| `dark-mode.js` | Carregado mas **irrelevante** — o admin tem fundo próprio (#f0fdf4) |
| `sidebar.js` | **NÃO carregado** — admin não tem sidebar |
| Cloud Functions | `POST /admin/delete-user` para exclusão com Auth Admin SDK |

### Diferenças arquiteturais vs demais telas

| Aspecto | Demais Telas | Admin |
|---|---|---|
| Firebase | Compat (`firebase.initializeApp`) | **Modular ES modules** (`import { initializeApp }`) |
| Script tag | `<script>` normal | `<script type="module">` |
| Sidebar | Sim | Não |
| Autenticação | `onAuthStateChanged` → redirect | `onAuthStateChanged` → verifica **`role === 'admin'`** |
| Layout | Sidebar + main | Header verde + painel full-width |
| CSS | Tailwind | Classes custom (`g-card`, `tab-btn`, `toggle`, `ff-card`, etc.) |

---

## 🗄️ Estrutura de Dados

### Coleções Firestore acessadas

| Coleção | Uso | Operações |
|---|---|---|
| `usuarios` | Listagem CRM, KPIs, admins | `getDocs`, `getDoc`, `updateDoc`, `getCountFromServer` |
| `usuarios/{uid}/transacoes` | Enriquecimento CRM (contagem, última atividade) | `getDocs` |
| `usuarios/{uid}/carteira` | Visão 360° (saldo total) | `getDocs` |
| `usuarios/{uid}/cartoes` | Visão 360° (count) | `getDocs` |
| `usuarios/{uid}/metas` | Visão 360° (count) | `getDocs` |
| `featureFlags` | CRUD de feature flags | `getDocs`, `addDoc`, `updateDoc`, `deleteDoc` |
| `notificacoes-globais` | Notificações push globais | `getDocs`, `addDoc`, `deleteDoc` |
| `promocoes` | CRUD de cupons | `getDocs`, `addDoc`, `updateDoc`, `deleteDoc` |
| `admin/config` | Configurações globais do app | `getDoc`, `setDoc(merge)` |

### Documento `admin/config`

```
{
  modoManutencao: boolean,           // Bloqueia o app para todos
  cadastrosAbertos: boolean,         // Permite novos registros
  ocultarAssistenteIA: boolean,      // Oculta tela na sidebar
  ocultarAssistenteWhatsApp: boolean,// Oculta tela na sidebar
  mensagemBoasVindas: string,        // Texto customizável
  versao: string                     // Ex: "1.0.0"
}
```

### Documento `featureFlags/{id}` (seed default: 19 flags)

```
{
  key: string,           // slug: 'importacao_ia'
  name: string,          // display: 'Importação por IA'
  description: string,
  enabled: boolean,
  allowedPlans: string[] // ['pro','plus','trial'] ou [] = todos
}
```

### Documento `notificacoes-globais/{id}`

```
{
  titulo: string,
  mensagem: string,
  tipo: 'info' | 'promo' | 'update' | 'alert',
  destino: 'all' | 'free' | 'starter' | 'pro' | 'plus',
  criadoEm: Timestamp,
  lida: boolean
}
```

### Documento `promocoes/{id}`

```
{
  codigo: string,        // 'NEXO2026'
  desconto: number,      // 10 (%)
  dataInicio: string,    // '2026-04-01'
  dataFim: string,       // '2026-04-30'
  limite: number,        // 0 = infinito
  descricao: string,
  ativa: boolean,
  usos: number,
  criadoEm: Timestamp
}
```

---

## 🏗️ Estrutura HTML

```
<body>
├── <header> (g-bar, sticky top-0 z-50)
│   ├── Logo "N" + "Bud Finanças Admin" + "Painel de Controle"
│   ├── Badge ONLINE (pulse-dot animado)
│   ├── #adminName + #adminEmail
│   └── #adminAvatar (iniciais)
│
├── #adminLoading (spinner "Verificando permissões...")
├── #accessDenied (🔒 card role check failed)
│
├── #adminContent (hidden até auth+role OK)
│   ├── Tabs: Overview | CRM | Feature Flags | Notificações | Promoções | Sistema
│   │
│   ├── #panel-overview
│   │   ├── KPIs grid (5 cards: Total, Pagantes, Trial, Promos, Risco)
│   │   ├── Acquisition Channels + Plan Distribution (2 cols)
│   │   └── Recent Signups + Feature Flags Summary (3 cols)
│   │
│   ├── #panel-crm
│   │   ├── #crmSearch + filtros (Plano, Engajamento)
│   │   ├── Grid header (Usuario, Plano, Engajamento, Última Atividade, Txns, Ações)
│   │   ├── #crmList (scrollable, max-h-520px)
│   │   └── #crmPagination (crmPrev, crmNext, crmPageInfo)
│   │
│   ├── #panel-flags
│   │   ├── Header + botão "+ Nova Flag"
│   │   └── #flagsGrid (grid 3 cols)
│   │
│   ├── #panel-notifs
│   │   ├── Formulário (título, mensagem, tipo, destinatário)
│   │   └── Histórico (#notifHistory)
│   │
│   ├── #panel-promos
│   │   ├── Header + botão "+ Novo Cupom"
│   │   └── #promosList
│   │
│   └── #panel-system
│       ├── Toggles: Manutenção, Cadastros, Assistente IA, Assistente WhatsApp
│       ├── Mensagem de Boas-Vindas + Versão + Salvar
│       └── Administradores (#adminsList + addAdmin)
│
├── #modalUser (modal-bg → Visão 360° do Cliente)
├── #modalFlag (modal-bg → Nova/Editar Feature Flag)
└── #modalPromo (modal-bg → Novo Cupom)
```

---

## 🎨 CSS Custom

| Classe | Propósito |
|---|---|
| `.g-card` | Card glassmorphism com blur + hover verde |
| `.g-bar` | Top bar com blur + borda bottom |
| `.tab-btn` / `.tab-btn.active` | Tabs com gradient verde quando ativo |
| `.accent-green/emerald/amber/red/purple` | Cards de KPI coloridos |
| `.toggle` / `.toggle.on` | Toggle custom (não Tailwind) com dot animado |
| `.thermo` / `.thermo-fill` | Barra de engajamento (termômetro) |
| `.plan-badge` + `.plan-free/trial/starter/pro/plus/admin` | Badges de plano coloridos |
| `.modal-bg` / `.modal-bg.open` | Overlay modal com blur (z-index:200) |
| `.ff-card` / `.ff-card.off` | Card de feature flag (opacidade 0.5 quando off) |
| `.god-input` | Input custom com focus verde |
| `.btn-cyan` / `.btn-ghost` / `.btn-danger` | Botões gradiente verde / ghost / vermelho |
| `.acq-bar` | Barra horizontal de canais de aquisição |
| `.u-row` | Hover verde sutil nas linhas do CRM |
| `@keyframes fadeUp` / `.anim-up` | Animação fade+slide para painéis |
| `@keyframes pulse-dot` | Pulsação do badge ONLINE |

---

## 🔄 Fluxo Completo

### 1. Inicialização e Controle de Acesso

```
onAuthStateChanged(user)
├── !user → redirect index.html
├── getDoc('usuarios/{uid}')
├── Esconde #adminLoading
├── role !== 'admin' → mostra #accessDenied, PARA
├── role === 'admin' → mostra #adminContent
│   ├── Exibe nome, email, avatar
│   └── boot()
│       ├── Promise.all([loadUsers(0), loadUsersLite()])
│       ├── loadOverview()
│       ├── loadFlags()
│       ├── loadNotifications()
│       ├── loadPromos()
│       ├── loadAppSettings()
│       └── loadAdmins()
```

### 2. Fluxo CRM (Paginação + Enriquecimento)

```
loadUsers(page)
├── Se page 0: getCountFromServer('usuarios') → crmTotalUsers
├── Query: orderBy('criadoEm','desc'), limit(25), startAfter(cursor se page > 0)
├── Para CADA usuário (parallel Promise.all):
│   └── getDocs('usuarios/{uid}/transacoes')
│       ├── _txCount = snap.size
│       └── _lastTxDays = dias desde última transação
├── renderCRM(users) → tabela com avatar, nome, plano badge, termômetro, txns, ações
└── updatePagination() → info de página, enable/disable prev/next

filterCRM() — filtro client-side (apenas na página atual):
├── Filtra por texto (nome/email)
├── Filtra por plano
└── Filtra por nível de engajamento
```

### 3. Visão 360° do Cliente

```
viewUser(uid)
├── getDoc('usuarios/{uid}')
├── Abre #modalUser
├── Parallel:
│   ├── getDocs transacoes → txCount, lastTxDays
│   ├── getDocs carteira → walletItems, totalSaldo
│   ├── getDocs cartoes → count
│   └── getDocs metas → count
├── Renderiza:
│   ├── Header (nome, email, data criação, badge plano)
│   ├── KPIs (transações, saldo total, cartões)
│   ├── Engajamento (termômetro + última atividade + metas)
│   ├── Status Assinatura + Vencimento + Canal Aquisição + WhatsApp
│   ├── Indicações (indicou X, meses grátis, indicado por, código)
│   ├── Carteira (lista de contas com saldo)
│   ├── Alterar Plano (select + salvar)
│   └── Zona de Perigo (excluir permanentemente)
```

### 4. Feature Flags

```
loadFlags()
├── getDocs('featureFlags')
├── Se vazio → seed 19 flags default → addDoc para cada
├── renderFlags() → grid de ff-cards com toggle, editar, excluir
└── renderFlagsSummary() → resumo no overview (6 primeiras)

saveFlag()
├── Valida nome + key
├── editId ? updateDoc : addDoc (enabled: true)
└── Recarrega flags

toggleFlag(id, newState)
├── updateDoc { enabled: newState }
├── Atualiza allFlags local
└── Re-renderiza
```

### 5. Notificações

```
sendNotification()
├── Valida titulo + mensagem
├── addDoc('notificacoes-globais', { titulo, mensagem, tipo, destino, criadoEm, lida:false })
├── Limpa formulário
└── loadNotifications()
⚠️ NÃO dispara push real — apenas salva no Firestore
```

### 6. Promoções

```
savePromo()
├── Valida codigo + desconto
├── addDoc('promocoes', { codigo, desconto, dataInicio, dataFim, limite, descricao, ativa:true, usos:0 })
└── Recarrega lista + overview

togglePromo(id, active)
└── updateDoc { ativa: !active }

deletePromo(id)
├── Modal confirmação
└── deleteDoc
```

### 7. Sistema

```
loadAppSettings()
├── getDoc('admin/config')
├── Popula: mensagem, versão
└── Seta toggles: manutenção, cadastros, assistenteIA, assistenteWhatsApp

toggleMaintenance/Registration/Modulo()
├── Inverte estado local
├── Atualiza toggle UI
└── setDoc(merge: true) no Firestore

saveAppSettings()
├── Atualiza mensagemBoasVindas + versao no objeto local
└── setDoc(merge: true)
```

---

## 📦 Funções

### `js/admin.js` (792 linhas — ES module com `window.*` exports)

| Função | Linha | Escopo | Descrição |
|---|---|---|---|
| `esc(s)` | ~10 | module | Escape HTML (cria div, textContent, innerHTML) |
| `fmtDate(ts)` | ~11 | module | Formata Timestamp/string para dd/mm/yyyy |
| `daysSince(ts)` | ~12 | module | Dias desde timestamp |
| `planBadge(plan)` | ~14 | module | Gera HTML do badge de plano colorido |
| `engagement(txCount, lastTxDays)` | ~19 | module | Classifica engajamento: heavy/regular/risk/inactive |
| `thermoHTML(eng)` | ~26 | module | Gera HTML do termômetro de engajamento |
| `boot()` | ~46 | module | Carrega tudo em paralelo na inicialização |
| `switchTab(t)` | ~55 | window | Troca aba ativa |
| `loadOverview()` | ~63 | module | Calcula KPIs, renderiza charts e últimos cadastros |
| `renderAcquisitionChart()` | ~90 | module | Gráfico de barras de canais de aquisição |
| `renderFlagsSummary()` | ~115 | module | Resumo das 6 primeiras flags no overview |
| `loadUsers(page)` | ~122 | module | Carrega página CRM com paginação cursor-based |
| `updatePagination()` | ~155 | module | Atualiza info e botões de paginação |
| `loadUsersLite()` | ~164 | module | Carrega TODOS os usuários (sem enriquecimento) para KPIs |
| `renderCRM(users)` | ~171 | module | Renderiza lista CRM com engajamento |
| `filterCRM()` | ~195 | module | Filtro client-side por nome/plano/engajamento |
| `viewUser(uid)` | ~208 | window | Modal 360° com subcoleções + indicações + carteira |
| `changeUserPlan(uid)` | ~415 | window | Altera plano do usuário no Firestore |
| `closeUserModal()` | ~424 | window | Fecha modal 360° |
| `toggleBlock(uid, blocked)` | ~426 | window | Bloqueia/desbloqueia usuário |
| `deleteUser(uid, email)` | ~441 | window | Exclui via Cloud Function (Auth + Firestore) |
| `loadFlags()` | ~467 | module | Carrega flags + seed defaults se vazio |
| `renderFlags()` | ~506 | module | Renderiza grid de feature flag cards |
| `toggleFlag(id, newState)` | ~524 | window | Liga/desliga flag individual |
| `openFlagModal(data)` | ~531 | window | Abre modal de nova/editar flag |
| `editFlag(id)` | ~541 | window | Popula modal com dados da flag |
| `saveFlag()` | ~543 | window | Salva nova flag ou atualiza existente |
| `deleteFlag(id)` | ~556 | window | Exclui flag com confirmação |
| `loadNotifications()` | ~572 | module | Carrega últimas 20 notificações |
| `sendNotification()` | ~596 | window | Cria notificação global no Firestore |
| `deleteNotif(id)` | ~608 | window | Exclui notificação com confirmação |
| `loadPromos()` | ~625 | module | Carrega lista de promoções |
| `openPromoModal()` | ~657 | window | Abre modal de novo cupom |
| `savePromo()` | ~662 | window | Salva cupom no Firestore |
| `togglePromo(id, active)` | ~676 | window | Ativa/desativa cupom |
| `deletePromo(id)` | ~677 | window | Exclui cupom com confirmação |
| `loadAppSettings()` | ~695 | module | Carrega config do documento admin/config |
| `setToggle(id, on)` | ~706 | module | Helper para toggle UI |
| `toggleMaintenance()` | ~711 | window | Toggle modo manutenção |
| `toggleRegistration()` | ~716 | window | Toggle cadastros abertos |
| `toggleModulo(modulo)` | ~721 | window | Toggle visibilidade de módulo na sidebar |
| `saveAppSettings()` | ~727 | window | Salva mensagem de boas-vindas + versão |
| `loadAdmins()` | ~733 | module | Lista admins filtrados de allUsersLite |
| `addAdmin()` | ~744 | window | Promove usuário a admin por email |
| `removeAdmin(uid)` | ~755 | window | Remove role admin com confirmação |

---

## 🔢 Variáveis de Estado

| Variável | Tipo | Escopo | Uso |
|---|---|---|---|
| `app` | `FirebaseApp` | const module | Instância Firebase modular |
| `auth` | `Auth` | const module | Instância Auth modular |
| `db` | `Firestore` | const module | Instância Firestore modular |
| `allUsers` | `array` | let module | Usuários da página CRM atual (enriquecidos com _txCount, _lastTxDays) |
| `allUsersLite` | `array` | let module | TODOS os usuários (sem enriquecimento) — para KPIs |
| `allFlags` | `array` | let module | Todas as feature flags |
| `currentTab` | `string` | let module | Aba ativa ('overview', 'crm', etc.) |
| `appSettings` | `object` | let module | Documento `admin/config` |
| `PAGE_SIZE` | `const 25` | module | Itens por página CRM |
| `crmPage` | `let number` | module | Página atual do CRM |
| `crmTotalUsers` | `let number` | module | Total de usuários (getCountFromServer) |
| `crmLastDocs` | `let array` | module | Cursores de paginação (DocumentSnapshot por página) |
| `crmFilteredUsers` | `let array` | module | Resultado do filtro (✱ NUNCA LIDA — variável morta) |

---

## 🐛 Bugs, Incoerências e Melhorias

---

### 🔴 BUG 1 — 7 overlays JS com `bg-black/50` + `z-[9999]` — invisíveis no build Tailwind

**Arquivo:** `js/admin.js`  
**Linhas:** ~431, ~448, ~559, ~611, ~680, ~760, ~427 (toggleBlock, deleteUser, deleteFlag, deleteNotif, deletePromo, removeAdmin)

```javascript
ov.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
```

**Problema:** São **7 ocorrências** de overlays de confirmação criados via JS usando `bg-black/50` e `z-[9999]`. Essas classes arbitrárias do Tailwind não existem no build estático. Os modais ficam sem background escuro e sem z-index → invisíveis ou inacessíveis.

**Funções afetadas:**
- `toggleBlock()` — bloquear/desbloquear usuário
- `deleteUser()` — excluir usuário
- `deleteFlag()` — excluir feature flag
- `deleteNotif()` — excluir notificação
- `deletePromo()` — excluir cupom
- `removeAdmin()` — remover admin

**Impacto:** Todas as ações destrutivas do admin estão com confirmação quebrada.

### 🔧 SOLUÇÃO

Usar `style.cssText` inline:

```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
```

---

### 🔴 BUG 2 — `loadUsersLite()` carrega TODOS os usuários sem paginação

**Arquivo:** `js/admin.js`  
**Linha:** ~164

```javascript
async function loadUsersLite() {
    const snap = await getDocs(collection(db, 'usuarios'));
    allUsersLite = [];
    snap.forEach(d => allUsersLite.push({ id: d.id, ...d.data() }));
}
```

**Problema:** Faz `getDocs` de **toda** a coleção `usuarios` sem `limit()`, `where()` ou streaming. Se o app tiver 10.000 usuários, são 10.000 reads do Firestore + todos os dados carregados na memória do browser.

**Cenário:** App cresce para 5.000+ usuários → carregamento do admin leva 10+ segundos → browser fica lento → custo Firestore explode (cada read é cobrado).

**Impacto:** Custo Firestore alto, performance degradada, potencial crash de navegador.

### 🔧 SOLUÇÃO

Usar `getCountFromServer` para KPIs e queries segmentadas:

```javascript
async function loadOverviewData() {
    const [totalSnap, freeSnap, trialSnap, paidSnap] = await Promise.all([
        getCountFromServer(collection(db, 'usuarios')),
        getCountFromServer(query(collection(db, 'usuarios'), where('plano', '==', 'free'))),
        getCountFromServer(query(collection(db, 'usuarios'), where('plano', '==', 'trial'))),
        getCountFromServer(query(collection(db, 'usuarios'), where('plano', 'in', ['starter','pro','plus']))),
    ]);
    return { total: totalSnap.data().count, free: freeSnap.data().count, ... };
}
```

Para o gráfico de aquisição e últimos cadastros, usar `limit(50)` + `orderBy`.

---

### 🔴 BUG 3 — CRM enriquece CADA usuário lendo TODAS as transações — N+1 query explosivo

**Arquivo:** `js/admin.js`  
**Linhas:** ~138-150

```javascript
const enrichPromises = users.map(async u => {
    try {
        const txSnap = await getDocs(collection(db, 'usuarios', u.id, 'transacoes'));
        u._txCount = txSnap.size;
        // ... itera TODAS transações para achar última data
    } catch { ... }
});
await Promise.all(enrichPromises);
```

**Problema:** Para cada um dos 25 usuários da página CRM, faz `getDocs` de **TODAS** as transações. Se cada usuário tiver 200 transações em média, são 25 × 200 = **5.000 reads** por página. Pior: lê todos os docs apenas para contar (`.size`) e achar a última data.

**Cenário:** Admin navega 4 páginas do CRM → 20.000 reads Firestore → custo significativo.

**Impacto:** Performance crítica, custo Firestore alto.

### 🔧 SOLUÇÃO

Usar `getCountFromServer` para contagem e query ordenada com `limit(1)` para última data:

```javascript
const enrichPromises = users.map(async u => {
    try {
        const [countSnap, lastSnap] = await Promise.all([
            getCountFromServer(collection(db, 'usuarios', u.id, 'transacoes')),
            getDocs(query(collection(db, 'usuarios', u.id, 'transacoes'), orderBy('dataCriacao','desc'), limit(1)))
        ]);
        u._txCount = countSnap.data().count;
        u._lastTxDays = lastSnap.empty ? 999 : Math.floor((Date.now() - (lastSnap.docs[0].data().dataCriacao?.toDate?.()?.getTime() || 0)) / 86400000);
    } catch { ... }
});
```

---

### 🔴 BUG 4 — `deleteUser` usa `escapeHTML` que não existe no module scope

**Arquivo:** `js/admin.js`  
**Linha:** ~449

```javascript
ov.innerHTML = `<div ...><p ...>Excluir "${escapeHTML(email)}"?</p>...`;
```

**Problema:** O arquivo define `esc()` como helper de escape, mas nesta linha usa `escapeHTML()` (definido em `bud-utils.js` como `window.escapeHTML`). Como o admin.js é um **ES module** (`type="module"`), o acesso a `window.escapeHTML` funciona, mas é **inconsistente** — todas as outras referências usam `esc()`.

**Cenário:** Se `bud-utils.js` não carregar (falha CDN, race condition), `escapeHTML is not defined` → crash ao tentar excluir usuário.

**Impacto:** Potencial erro runtime se `bud-utils.js` não estiver disponível no momento da chamada.

### 🔧 SOLUÇÃO

Substituir por `esc()`:

```javascript
ov.innerHTML = `<div ...><p ...>Excluir "${esc(email)}"?</p>...`;
```

---

### 🔴 BUG 5 — `sendNotification()` NÃO dispara push real — apenas salva no Firestore

**Arquivo:** `js/admin.js`  
**Linhas:** ~596-607

```javascript
window.sendNotification = async function() {
    // ...
    await addDoc(collection(db,'notificacoes-globais'), {
        titulo, mensagem, tipo, destino, criadoEm: serverTimestamp(), lida: false
    });
    budShowToast('Notificação enviada!', 'sucesso');
};
```

**Problema:** A aba de Notificações sugere "Disparar Notificação" e confirma "Notificação enviada!" — mas **não há integração com FCM**. Apenas cria um documento no Firestore. Nenhum Cloud Function trigger observa essa coleção para disparar push real. O admin acredita que enviou uma notificação, mas nenhum usuário recebe.

**Cenário:** Admin compõe notificação urgente → clica enviar → toast de sucesso → nenhum usuário é notificado.

**Impacto:** Feature completamente fake — gera falsa sensação de envio.

### 🔧 SOLUÇÃO

Criar Cloud Function trigger ou chamar API do admin:

```javascript
// Opção 1: Cloud Function onWrite
// functions/index.js: exports.onNewGlobalNotif = functions.firestore
//   .document('notificacoes-globais/{id}').onCreate(...)

// Opção 2: Chamar endpoint diretamente
const token = await auth.currentUser.getIdToken();
await fetch(FUNCTIONS_URL + '/admin/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ titulo, mensagem, tipo, destino })
});
```

---

### 🟡 BUG 6 — Visão 360°: re-lê transações do usuário (já lidas no CRM)

**Arquivo:** `js/admin.js`  
**Linhas:** ~213-225

```javascript
window.viewUser = async function(uid) {
    // ...
    const txSnap = await getDocs(collection(db,'usuarios',uid,'transacoes'));
    txCount = txSnap.size;
```

**Problema:** Ao abrir a visão 360°, faz outra `getDocs` de TODAS as transações do usuário — mas o CRM já leu e tem `_txCount` e `_lastTxDays` no objeto. São reads duplicados.

**Impacto:** Custo Firestore desnecessário, latência extra no modal.

### 🔧 SOLUÇÃO

Reusar dados do allUsers se disponível:

```javascript
const cached = allUsers.find(u => u.id === uid);
let txCount = cached?._txCount || 0;
let lastTxDays = cached?._lastTxDays ?? 999;
if (!cached) {
    // Só busca se não tiver cache
    const txSnap = await getDocs(collection(db,'usuarios',uid,'transacoes'));
    txCount = txSnap.size;
    // ...
}
```

---

### 🟡 BUG 7 — `crmFilteredUsers` é atribuída mas NUNCA lida — variável morta

**Arquivo:** `js/admin.js`  
**Linha:** ~152

```javascript
crmFilteredUsers = users;
```

**Problema:** A variável `crmFilteredUsers` é declarada no state (linha ~30) e atribuída em `loadUsers()`, mas **nunca é lida em nenhum lugar**. O filtro `filterCRM()` filtra `allUsers` diretamente e passa resultado para `renderCRM()`.

**Impacto:** Código morto, confusão para mantenedores.

### 🔧 SOLUÇÃO

Remover a variável e a atribuição:

```javascript
// Remover: let crmFilteredUsers = [];
// Remover: crmFilteredUsers = users;
```

---

### 🟡 BUG 8 — KPI "Em Risco" conta TODOS os free como risco — métrica incorreta

**Arquivo:** `js/admin.js`  
**Linhas:** ~70

```javascript
const riskCount = allUsersLite.filter(u => (u.plano||'free').toLowerCase() === 'free').length;
```

**Problema:** O KPI "Em Risco" simplesmente conta todos os usuários no plano free. Mas "em risco" no CRM é definido pela função `engagement()` como `lastTxDays <= 21`. Usuários free que são heavy users não estão "em risco". A métrica no overview é inconsistente com o filtro do CRM.

**Cenário:** 80% dos usuários são free → KPI "Em Risco" mostra número absurdamente alto → admin entra em pânico sem motivo.

**Impacto:** Métrica enganosa, decisões incorretas.

### 🔧 SOLUÇÃO

Usar a mesma lógica de engajamento (requer dados de transação, ou manter como "Free Users"):

```javascript
// Renomear o KPI para ser honesto:
// No HTML: "FREE USERS" em vez de "Em Risco"

// Ou calcular risco real (requer enriquecimento):
// Se quiser manter "Em Risco", precisa de dados de última atividade
// armazenados no documento principal do usuário
```

---

### 🟡 BUG 9 — `changeUserPlan` não limpa campos de plano anterior

**Arquivo:** `js/admin.js`  
**Linhas:** ~415-422

```javascript
window.changeUserPlan = async function(uid) {
    const plan = document.getElementById('userChangePlan').value;
    const up = { plano: plan };
    if (['starter','pro','plus'].includes(plan)) {
        up.planoAtivadoEm = new Date().toISOString();
        up.planoExpiraEm = null;
        up.assinaturaStatus = 'active';
    }
    else if (plan==='trial') {
        up.trialInicio = n.toISOString();
        up.trialFim = new Date(n.getTime()+3*864e5).toISOString();
    }
    else if (plan==='free') {
        up.assinaturaStatus = null;
    }
    await updateDoc(doc(db,'usuarios',uid), up);
};
```

**Problema:** Ao mudar de paid→free, seta `assinaturaStatus: null` mas não limpa `planoExpiraEm`, `planoAtivadoEm`, `trialInicio`, `trialFim`. Ao mudar de trial→paid, não limpa `trialInicio`/`trialFim`. O `NexoPlanos.resolvePlan()` pode ler esses campos residuais e calcular plano errado.

**Cenário:** Admin muda usuário de Pro→Free → campos `planoAtivadoEm` e `assinatura` permanecem → `resolvePlan` pode interpretar como plano ativo.

**Impacto:** Plano incorreto para o usuário após alteração manual.

### 🔧 SOLUÇÃO

Limpar todos os campos de plano ao trocar:

```javascript
const up = {
    plano: plan,
    planoAtivadoEm: null, planoExpiraEm: null,
    trialInicio: null, trialFim: null,
    assinaturaStatus: null, assinatura: null,
    downgradeMotivo: null, downgradeEm: null
};
if (['starter','pro','plus'].includes(plan)) {
    up.planoAtivadoEm = new Date().toISOString();
    up.assinaturaStatus = 'active_admin'; // marcar como ativação manual
}
else if (plan === 'trial') {
    const n = new Date();
    up.trialInicio = n.toISOString();
    up.trialFim = new Date(n.getTime() + 3 * 864e5).toISOString();
}
```

---

### 🟡 BUG 10 — Visão 360°: `whatsappConectado` vs `whatsappVinculado` — campo errado

**Arquivo:** `js/admin.js`  
**Linha:** ~280

```javascript
<p ...>${u.whatsappConectado ? '✅ '+esc(u.whatsappNumero||'Conectado') : '❌ Não'}</p>
```

**Problema:** Verifica `u.whatsappConectado` e `u.whatsappNumero`, mas na tela de configurações o campo salvo é `whatsappVinculado` (sem `whatsappConectado` nem `whatsappNumero`). O 360° sempre mostrará "❌ Não" mesmo que o usuário tenha WhatsApp vinculado.

**Impacto:** Informação sempre incorreta na visão 360°.

### 🔧 SOLUÇÃO

Usar o campo correto:

```javascript
<p ...>${u.whatsappVinculado ? '✅ +'+esc(u.whatsappVinculado) : '❌ Não'}</p>
```

---

### 🟡 BUG 11 — Feature flags seed defaults não são checados nas telas do app

**Arquivo:** `js/admin.js`  
**Linhas:** ~475-504

**Problema:** O admin tem 19 feature flags padrão que controlam quais funcionalidades estão ativas por plano. Porém, **nenhuma tela do app** consulta a coleção `featureFlags` do Firestore. As telas usam `NexoPlanos.canUseFeature()` que lê regras hardcoded em `plano-config.js`. As flags do admin são **decorativas** — mudar uma flag não afeta nada no app real.

**Cenário:** Admin desativa flag "Extrato" → usuários continuam acessando normalmente o extrato.

**Impacto:** Feature flags completamente ineficazes — admin tem falsa sensação de controle.

### 🔧 SOLUÇÃO

Consultar `featureFlags` no init de cada tela:

```javascript
// Em bud-loader.js ou similar:
window.BudFeatureFlags = {};
async function loadFeatureFlags() {
    const snap = await getDocs(collection(db, 'featureFlags'));
    snap.forEach(d => { const f = d.data(); window.BudFeatureFlags[f.key] = f; });
}

// Em cada tela:
if (!window.BudFeatureFlags?.extrato?.enabled) {
    document.body.innerHTML = '<p>Funcionalidade temporariamente desativada.</p>';
    return;
}
```

---

### 🟡 BUG 12 — `toggleRegistration` lógica invertida

**Arquivo:** `js/admin.js`  
**Linha:** ~716

```javascript
window.toggleRegistration = async function() {
    appSettings.cadastrosAbertos = appSettings.cadastrosAbertos === false;
    // ...
};
```

**Problema:** A expressão `appSettings.cadastrosAbertos === false` retorna `true` quando estava `false`, e `false` quando estava `true` ou `undefined`. Mas se `cadastrosAbertos` nunca foi definido (undefined), `undefined === false` é `false` → seta para `false` → desativa cadastros no primeiro click. O default na UI é "on" (`toggle on`), criando inconsistência.

**Cenário:** Primeiro acesso → `cadastrosAbertos` é undefined → admin clica toggle → `undefined === false` → false → cadastros desativados (contrário do esperado, o toggle visual iria de ON para OFF mas o valor já seria false).

**Impacto:** Comportamento potencialmente invertido no primeiro toggle.

### 🔧 SOLUÇÃO

```javascript
window.toggleRegistration = async function() {
    const current = appSettings.cadastrosAbertos !== false; // default true
    appSettings.cadastrosAbertos = !current;
    setToggle('togRegistration', appSettings.cadastrosAbertos);
    await setDoc(doc(db,'admin','config'), appSettings, { merge: true });
};
```

---

### 🟡 BUG 13 — Modo manutenção e cadastros abertos: nenhuma tela verifica esses flags

**Arquivo:** `js/admin.js` + todas as outras telas

**Problema:** Similar ao BUG 11 — `modoManutencao` e `cadastrosAbertos` são salvos em `admin/config`, mas **nenhuma tela** lê esses valores. O login (`index.html`) não verifica `cadastrosAbertos` antes de permitir registro. Nenhuma tela verifica `modoManutencao` antes de carregar.

**Impacto:** Toggles do sistema são puramente cosméticos.

### 🔧 SOLUÇÃO

Adicionar verificação no `bud-loader.js` (carregado em todas as telas):

```javascript
// Em bud-loader.js, após auth:
const adminConfig = await getDoc(doc(db, 'admin', 'config'));
const config = adminConfig.exists() ? adminConfig.data() : {};
if (config.modoManutencao && !isAdminPage) {
    document.body.innerHTML = '<div style="text-align:center;padding:4rem"><h1>🔧 Manutenção</h1><p>Estamos em manutenção. Volte em breve!</p></div>';
    return;
}
```

---

### 🟡 BUG 14 — `deleteUser` não apaga subcoleções — apenas documento principal + Auth

**Arquivo:** `js/admin.js`  
**Linhas:** ~441-465

```javascript
const res = await fetch(FUNCTIONS_URL + '/admin/delete-user', {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ uid })
});
```

**Problema:** A exclusão depende do endpoint `/admin/delete-user`. Sem ver o código da Cloud Function, não sabemos se ela apaga as subcoleções (transacoes, cartoes, categorias, etc.) ou apenas o Auth user + documento principal. Comparando com `executarExclusaoConta()` em `configuracoes.js` (que apaga 14 subcoleções explicitamente), a Cloud Function pode estar incompleta.

**Cenário:** Admin exclui usuário → Auth e documento principal removidos → 14 subcoleções com dados financeiros permanecem no Firestore → dados órfãos, custo de armazenamento.

**Impacto:** Potencial vazamento de dados (LGPD) e custo Firestore.

### 🔧 SOLUÇÃO

Verificar e garantir que a Cloud Function apague todas as subcoleções, ou fazer a limpeza client-side antes de chamar o endpoint:

```javascript
// Antes de chamar /admin/delete-user, limpar subcoleções:
const subs = ['transacoes', 'cartoes', 'categorias', 'contas', 'dividas', 'investimentos', 'limites', 'metas', 'tokens', 'recorrentes', 'carteira', 'compras', 'listas-compras', 'notificacoes_eventos_enviadas'];
for (const sub of subs) {
    const snap = await getDocs(collection(db, 'usuarios', uid, sub));
    const docs = snap.docs;
    for (let j = 0; j < docs.length; j += 500) {
        const batch = writeBatch(db);
        docs.slice(j, j + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}
// Depois: chamar /admin/delete-user para remover Auth + doc principal
```

---

### 🟢 BUG 15 — `dark-mode.js` carregado mas irrelevante no admin

**Arquivo:** `admin.html`  
**Linha:** ~503

```html
<script src="dark-mode.js"></script>
```

**Problema:** O admin tem seu próprio fundo verde (`#f0fdf4`) e CSS custom completo. O `dark-mode.js` injeta regras `body.dark` que podem conflitar com o design verde. Se o usuário ativou dark mode em outra tela, ao abrir o admin, o tema fica mixado (background escuro + cards verdes = visual quebrado).

**Impacto:** Visual quebrado se dark mode estiver ativo.

### 🔧 SOLUÇÃO

Remover `dark-mode.js` do admin ou forçar light mode:

```html
<!-- Remover: <script src="dark-mode.js"></script> -->
<script>
    // Força light mode no admin
    localStorage.removeItem('nexo_dark_mode');
    document.body.classList.remove('dark');
</script>
```

---

### 🟢 BUG 16 — `tutorial.js` / `tutorial-steps.js` / `tutorial-init.js` carregados sem necessidade

**Arquivo:** `admin.html`  
**Linhas:** ~504-506

```html
<script src="tutorial.js"></script>
<script src="tutorial-steps.js"></script>
<script src="tutorial-init.js"></script>
```

**Problema:** O tutorial é para o app do usuário final, não para o painel admin. Carregar 3 scripts de tutorial é peso desnecessário e pode disparar o tutorial no contexto errado.

**Impacto:** Payload extra (~50KB), possível trigger de tutorial no admin.

### 🔧 SOLUÇÃO

Remover os 3 scripts do admin.html.

---

### 🟢 BUG 17 — Paginação CRM: filtros aplicam apenas na página atual

**Arquivo:** `js/admin.js`  
**Linhas:** ~195-207

```javascript
function filterCRM() {
    let list = allUsers.filter(u => { ... });
    renderCRM(list);
}
```

**Problema:** O filtro de busca/plano/engajamento filtra apenas `allUsers` — que é a **página atual** (25 items). Se o admin busca "João", só encontrará se existir um João nos 25 da página atual. Não busca nas outras páginas.

**Cenário:** Admin busca um usuário específico → não encontra → pensa que não existe → mas está em outra página.

**Impacto:** Busca ineficaz, admin precisa navegar manualmente todas as páginas.

### 🔧 SOLUÇÃO

Implementar busca server-side:

```javascript
async function searchUsers(query) {
    if (!query) { loadUsers(0); return; }
    // Para busca por email (exata):
    const q = query(collection(db, 'usuarios'), where('email', '==', query.toLowerCase()));
    const snap = await getDocs(q);
    // ... renderizar resultados
}
```

Ou buscar em `allUsersLite` (que já tem todos) e renderizar:

```javascript
function filterCRM() {
    const q = document.getElementById('crmSearch').value.toLowerCase();
    let list = (q ? allUsersLite : allUsers).filter(u => { ... });
    renderCRM(list.slice(0, 50)); // limitar para performance
}
```

---

### 🟢 BUG 18 — Promos: campo `dataInicio`/`dataFim` salvos como string, não Timestamp

**Arquivo:** `js/admin.js`  
**Linha:** ~667

```javascript
await addDoc(collection(db,'promocoes'), {
    codigo, desconto, 
    dataInicio: document.getElementById('promoStart').value, // "2026-04-01"
    dataFim: document.getElementById('promoEnd').value,       // "2026-04-30"
    // ...
});
```

**Problema:** `dataInicio` e `dataFim` são salvos como strings ("2026-04-01") em vez de Firestore Timestamps. A comparação `new Date(p.dataFim) >= now` funciona, mas é inconsistente com o padrão do app (que usa `serverTimestamp()` e `.toDate()`). Queries com `where('dataFim', '>=', ...)` não funcionariam corretamente com strings.

**Impacto:** Baixo (funciona no JS atual), mas impede queries nativas do Firestore.

### 🔧 SOLUÇÃO

Converter para Date antes de salvar:

```javascript
dataInicio: document.getElementById('promoStart').value ? new Date(document.getElementById('promoStart').value) : null,
dataFim: document.getElementById('promoEnd').value ? new Date(document.getElementById('promoEnd').value) : null,
```

---

### 🟢 BUG 19 — Nenhuma validação de segurança server-side para ações administrativas

**Arquivo:** `js/admin.js` (múltiplas funções)

**Problema:** Exceto `deleteUser` (que chama Cloud Function com Bearer token), **todas** as operações admin (alterar plano, bloquear, gerenciar flags, enviar notificações, gerenciar promos, alterar config) são feitas **diretamente no Firestore** via client-side SDK. As Firestore Rules permitem essas operações? Se um usuário descobrir a estrutura da coleção `featureFlags` ou `admin/config`, pode manipulá-los sem ser admin.

**Cenário:** Usuário mal-intencionado acessa DevTools → executa `updateDoc(doc(db, 'admin', 'config'), { modoManutencao: true })` → derruba o app para todos (se implementado).

**Impacto:** Vulnerabilidade de segurança CRITICAL se Firestore Rules não estiverem configuradas.

### 🔧 SOLUÇÃO

Garantir Firestore Rules restritivas:

```
// firestore.rules
match /admin/{docId} {
    allow read, write: if request.auth != null 
        && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'admin';
}
match /featureFlags/{flagId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null 
        && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'admin';
}
match /notificacoes-globais/{notifId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null 
        && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'admin';
}
match /promocoes/{promoId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null 
        && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'admin';
}
```

---

### 🟢 BUG 20 — `addAdmin` usa `budShowToast(esc(...))` — double escape

**Arquivo:** `js/admin.js`  
**Linha:** ~753

```javascript
budShowToast(esc(found.nome||email) + ' agora é admin!', 'sucesso');
```

**Problema:** `budShowToast` já faz escape internamente (`bud-utils.js` linha 14: `var escapada = window.escapeHTML(mensagem)`). Chamar `esc()` antes resulta em double-escape: `&amp;` em vez de `&` se o nome tiver caracteres especiais.

**Impacto:** Baixo — nomes raramente têm `<`, `>`, `&`. Mas se tiverem, o toast mostra texto malformado.

### 🔧 SOLUÇÃO

Remover o `esc()`:

```javascript
budShowToast((found.nome||email) + ' agora é admin!', 'sucesso');
```

---

## ✅ Checklist por Prioridade

### 🔴 Crítico (fazer imediatamente)
- [ ] BUG 1 — Corrigir 7 overlays JS: `style.cssText` em vez de classes Tailwind
- [ ] BUG 2 — Eliminar `loadUsersLite()` que carrega TODOS os usuários (usar counts)
- [ ] BUG 3 — Otimizar enriquecimento CRM: `getCountFromServer` + `limit(1)` em vez de getDocs all
- [ ] BUG 4 — `escapeHTML` → `esc()` no deleteUser
- [ ] BUG 5 — Implementar disparo real de notificações push (Cloud Function)

### 🟡 Médio (próxima sprint)
- [ ] BUG 6 — Reusar dados de transação no 360° (evitar re-read)
- [ ] BUG 7 — Remover variável morta `crmFilteredUsers`
- [ ] BUG 8 — Corrigir KPI "Em Risco" (não é = free users)
- [ ] BUG 9 — Limpar campos residuais ao trocar plano
- [ ] BUG 10 — Usar `whatsappVinculado` em vez de `whatsappConectado` no 360°
- [ ] BUG 11 — Fazer feature flags consultadas no app real
- [ ] BUG 12 — Corrigir lógica invertida de `toggleRegistration`
- [ ] BUG 13 — Implementar verificação de modoManutencao + cadastrosAbertos nas telas
- [ ] BUG 14 — Garantir que deleteUser apaga subcoleções

### 🟢 Baixo (melhorias)
- [ ] BUG 15 — Remover dark-mode.js do admin
- [ ] BUG 16 — Remover tutorial scripts do admin
- [ ] BUG 17 — Implementar busca server-side no CRM
- [ ] BUG 18 — Converter datas de promos para Timestamp
- [ ] BUG 19 — Verificar e reforçar Firestore Rules para coleções admin
- [ ] BUG 20 — Remover double escape no addAdmin toast

---

## 📊 Métricas

| Métrica | Valor |
|---|---|
| **Total de linhas** | 1.300 (508 HTML + 792 JS) |
| **Bugs encontrados** | 20 |
| **🔴 Críticos** | 5 |
| **🟡 Médios** | 9 |
| **🟢 Baixos** | 6 |
| **Abas (módulos)** | 6 (Overview, CRM, Flags, Notifs, Promos, System) |
| **Modais** | 3 (User 360°, Flag, Promo) + 7 overlays JS |
| **Coleções Firestore acessadas** | 9 (usuarios + 4 sub, featureFlags, notificacoes-globais, promocoes, admin) |
| **Reads Firestore por boot** | ALL usuarios (ilimitado) + 25 enriched + flags + notifs + promos + config |
| **Feature flags cosmética** | 19 (nenhuma verificada pelo app) |
| **Funções exportadas (window)** | 20+ |
| **Classes CSS custom** | 22 |

---

## 💚 Pontos Positivos

1. **Firebase Modular** — única tela do projeto usando imports ES module em vez de compat, o que é a abordagem moderna recomendada
2. **Paginação cursor-based no CRM** — usa `startAfter` corretamente, muito mais eficiente que offset-based
3. **`getCountFromServer`** — usado para total de usuários na paginação (embora devesse ser usado em mais lugares)
4. **Visão 360° rica** — mostra transações, carteira, cartões, metas, indicações, plano, engajamento em uma view
5. **Sistema de engajamento** — classificação automatizada (heavy/regular/risk/inactive) com termômetro visual
6. **Feature flags com seed automático** — 19 defaults criados automaticamente se a coleção estiver vazia
7. **CSS bem organizado** — sistema próprio de design (g-card, toggles, badges) sem depender do Tailwind build
8. **Gestão de admins** — add/remove por email com proteção contra auto-remoção
9. **Exclusão via Cloud Function** — `deleteUser` é a única operação destrutiva que usa server-side auth, garantindo que Firebase Auth é limpo
10. **Layout sem sidebar** — decisão acertada para backoffice, maximiza espaço útil

---

# 🚀 PROPOSTA DE EVOLUÇÃO — PAINEL ADMIN COMPLETO E CUSTOMIZÁVEL

## Observação Geral

O painel admin atual é **funcional mas superficial**. Ele tem 6 abas (Visão Geral, CRM, Feature Flags, Notificações, Promos, Sistema) porém a maioria é **cosmética** — feature flags não são verificadas pelas telas, toggles de manutenção/cadastro não bloqueiam nada no frontend, e o sistema de notificações não faz push real. O admin deveria ser o **centro de controle total** do app, onde CADA funcionalidade pode ser ligada, desligada, ajustada ou personalizada em tempo real, sem deploy.

**Princípio:** O admin não é só monitoramento — é o **painel de controle operacional** do produto inteiro.

---

## 1. 🏗️ ARQUITETURA PROPOSTA — Firestore Centralizado

### 1.1 Documento Master de Configuração

Criar um doc único `admin/appConfig` que centraliza TODAS as configurações customizáveis:

```
Firestore → admin/appConfig
{
  // ─── MÓDULOS GLOBAIS ───
  modulosAtivos: {
    dashboard: true,
    carteira: true,
    cartoes: true,
    recorrentes: true,
    dividas: true,
    importar: true,
    limites: true,
    metas: true,
    investimentos: true,
    mercado: true,
    categorias: true,
    extrato: true,
    relatorios: true,
    insights: true,
    assistenteIA: true,
    assistenteWhatsapp: true,
    balacoMensal: true,
    comparativo: true,
    graficos: true,
    vendas: true
  },

  // ─── PLANOS E MONETIZAÇÃO ───
  planos: {
    free:    { preco: 0,     txLimit: 30,  cardsLimit: 1, historyDays: 30,  ativo: true },
    starter: { preco: 9.99,  txLimit: 150, cardsLimit: 1, historyDays: 90,  ativo: true },
    pro:     { preco: 29.90, txLimit: 600, cardsLimit: 4, historyDays: -1,  ativo: true },
    plus:    { preco: 49.90, txLimit: -1,  cardsLimit: -1, historyDays: -1, ativo: true },
    trial:   { duracaoDias: 7, ativo: true }
  },

  // ─── FEATURE FLAGS POR PLANO (override do plano-config.js) ───
  featureOverrides: {
    // chave = featureKey do plano-config.js
    // valor = { ativo: bool, minPlan: string, override: "force_on" | "force_off" | "default" }
    pushNotifications:    { ativo: true,  minPlan: "starter", override: "default" },
    savingsGoals:         { ativo: true,  minPlan: "pro",     override: "default" },
    assistantIA:          { ativo: true,  minPlan: "plus",    override: "default" },
    whatsappAssistant:    { ativo: true,  minPlan: "plus",    override: "default" },
    importTransactions:   { ativo: true,  minPlan: "plus",    override: "default" },
    customCategories:     { ativo: true,  minPlan: "starter", override: "default" },
    exportCSVPDF:         { ativo: true,  minPlan: "starter", override: "default" },
    iaInvoiceReading:     { ativo: true,  minPlan: "pro",     override: "default" },
    financialGoals:       { ativo: true,  minPlan: "pro",     override: "default" },
    categoryLimitsAlerts: { ativo: true,  minPlan: "plus",    override: "default" },
    monthlyComparative:   { ativo: true,  minPlan: "plus",    override: "default" },
    multiCurrency:        { ativo: true,  minPlan: "plus",    override: "default" },
    darkMode:             { ativo: true,  minPlan: "free",    override: "default" },
    streakTracking:       { ativo: true,  minPlan: "free",    override: "default" },
    recurringTransactions:{ ativo: true,  minPlan: "pro",     override: "default" },
    advancedFilters:      { ativo: true,  minPlan: "pro",     override: "default" },
    advancedDashboard:    { ativo: true,  minPlan: "plus",    override: "default" },
    splitExpenses:        { ativo: true,  minPlan: "plus",    override: "default" },
    sharedAccounts:       { ativo: true,  minPlan: "plus",    override: "default" },
    financialScore:       { ativo: true,  minPlan: "starter", override: "default" }
  },

  // ─── CATEGORIAS PADRÃO ───
  categoriasPadrao: {
    receitas: ["Salário", "Freelance", "Investimentos", "Presente", "Outros"],
    despesas: ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Compras", "Pets", "Assinaturas", "Outros"]
  },

  // ─── GAMIFICAÇÃO ───
  gamificacao: {
    streakAtivo: true,
    badgesAtivo: true,
    scoreFinanceiroAtivo: true,
    pontosLogin: 10,
    pontosPorTransacao: 5,
    pontosPorMeta: 50,
    multiplicadorStreak: 1.5
  },

  // ─── NOTIFICAÇÕES ───
  notificacoes: {
    pushAtivo: true,
    emailAtivo: true,
    whatsappAtivo: false,
    lembreteDiarioHora: "07:00",
    lembreteRecorrentesHora: "06:00",
    resumoSemanalDia: "monday",
    resumoSemanalHora: "08:00"
  },

  // ─── LIMITES E SEGURANÇA ───
  seguranca: {
    maxTentativasLogin: 5,
    lockoutMinutos: 15,
    sessaoMaxHoras: 24,
    forcarSenhaForte: true,
    permitirCadastroPorEmail: true,
    permitirCadastroPorGoogle: true,
    dominiosPermitidos: []  // vazio = qualquer domínio
  },

  // ─── APARÊNCIA ───
  aparencia: {
    corPrimaria: "#16a34a",
    corSecundaria: "#15803d",
    logoURL: "",
    nomeApp: "Bud Finanças",
    sloganApp: "Finanças Inteligentes",
    splashAtivo: true,
    darkModeDefault: false
  },

  // ─── INTEGRAÇÕES ───
  integracoes: {
    mercadoPagoAtivo: true,
    mercadoPagoSandbox: false,
    emailJSAtivo: true,
    geminiAtivo: true,
    geminiModelo: "gemini-1.5-flash",
    geminiMaxTokens: 4096,
    whatsappAPIAtivo: false
  },

  // ─── ONBOARDING ───
  onboarding: {
    ativo: true,
    etapas: ["boas-vindas", "foto-perfil", "categorias", "primeira-transacao", "tour"],
    pularPermitido: true,
    trialAutomatico: true,
    trialDias: 7
  },

  // ─── IMPORTAÇÃO ───
  importacao: {
    formatosAceitos: ["csv", "ofx"],
    maxLinhasPorImportacao: 500,
    maxArquivoMB: 5,
    mapeamentoColunas: {
      data: ["data", "date", "Data"],
      valor: ["valor", "value", "Valor", "amount"],
      descricao: ["descricao", "description", "Descrição", "desc"]
    }
  },

  // ─── MANUTENÇÃO ───
  manutencao: {
    modoManutencao: false,
    mensagemManutencao: "Estamos em manutenção, voltamos em breve!",
    previsaoRetorno: null,
    permitirAdmins: true
  },

  // ─── MERCADO/COMPRAS ───
  mercadoCompras: {
    ativo: true,
    maxItensPorLista: 100,
    categoriasLista: ["Supermercado", "Feira", "Farmácia", "Pet Shop", "Outros"],
    compartilhamentoAtivo: false
  },

  // ─── IA / ASSISTENTE ───
  assistenteConfig: {
    promptSistema: "Você é o Bud, assistente financeiro pessoal...",
    maxMensagensPorConversa: 50,
    maxTokensResposta: 2048,
    temperaturaGemini: 0.7,
    contextoDadosUsuario: true,  // IA pode ler dados financeiros do user
    sugestoesAtivas: true,
    respostasPreDefinidas: {
      saudacao: "Olá! Sou o Bud, seu assistente financeiro. Como posso ajudar?",
      limiteAtingido: "Você atingiu o limite de mensagens. Faça upgrade para continuar!",
      erro: "Desculpe, tive um problema ao processar sua mensagem. Tente novamente."
    }
  }
}
```

### 1.2 Como as Telas Consomem o Config

Cada tela do app já carrega `bud-loader.js` no `<head>`. A proposta é que o loader faça um **único read** do `admin/appConfig` e exponha como `window.BudConfig`:

```javascript
// Em bud-loader.js (adicionar):
const configSnap = await getDoc(doc(db, 'admin', 'appConfig'));
window.BudConfig = configSnap.exists() ? configSnap.data() : {};

// Em qualquer tela:
if (!window.BudConfig?.modulosAtivos?.metas) {
  window.location.href = 'dashboard.html'; // módulo desativado
  return;
}
```

**Cache:** Guardar em `sessionStorage` com TTL de 5 min para evitar read extra em cada navegação:

```javascript
const cached = sessionStorage.getItem('bud_config');
const cacheTime = sessionStorage.getItem('bud_config_time');
if (cached && cacheTime && Date.now() - Number(cacheTime) < 300000) {
  window.BudConfig = JSON.parse(cached);
} else {
  const snap = await getDoc(doc(db, 'admin', 'appConfig'));
  window.BudConfig = snap.exists() ? snap.data() : {};
  sessionStorage.setItem('bud_config', JSON.stringify(window.BudConfig));
  sessionStorage.setItem('bud_config_time', String(Date.now()));
}
```

---

## 2. 📊 NOVA ABA: CONFIGURAÇÕES DE MÓDULOS

### O que é
Uma nova aba no admin onde cada módulo/tela do app aparece como um card com toggle on/off e configurações específicas.

### Layout proposto

```
┌─────────────────────────────────────────────────┐
│  📊 Módulos do App                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ 📊 Dashboard │  │ 💰 Carteira  │            │
│  │   [ON/OFF]   │  │   [ON/OFF]   │            │
│  │ ⚙️ Config    │  │ ⚙️ Config    │            │
│  └──────────────┘  └──────────────┘            │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ 💳 Cartões   │  │ 🔄 Recorrent │            │
│  │   [ON/OFF]   │  │   [ON/OFF]   │            │
│  │ ⚙️ Config    │  │ ⚙️ Config    │            │
│  └──────────────┘  └──────────────┘            │
│  ... (grid 2-3 colunas com todos os módulos)    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Clicando em ⚙️ Config de cada módulo, abre painel com opções específicas:

**Dashboard:**
- Toggle KPIs visíveis (saldo, receitas, despesas, economia, score)
- Widgets habilitados (gráfico pizza, evolução, últimas transações, metas, streak)
- Período padrão do gráfico (7d, 15d, 30d)
- Mostrar banner de upgrade para free users (sim/não)

**Carteira:**
- Max contas por usuário (free: 1, pro: 5, plus: ilimitado)
- Tipos de conta permitidos (corrente, poupança, investimento, dinheiro)
- Saldo inicial editável após criação (sim/não)
- Transferências entre contas ativo (sim/não)

**Cartões de Crédito:**
- Limite de cartões por plano (já existe mas decorativo — tornar funcional)
- Cor customizável por cartão (sim/não)
- Alertas % do limite (ex: alertar ao atingir 80% do limite)
- Fechamento/vencimento lembrete automático (dias de antecedência)

**Recorrentes:**
- Processamento automático (já funciona via Cloud Function)
- Hora do processamento (configurável, hoje fixo 06:00 BRT)
- Max recorrentes por usuário
- Tipos de recorrência (mensal, semanal, anual) — quais habilitar
- Notificar usuário quando recorrente for processada (sim/não)

**Dívidas:**
- Max dívidas ativas por usuário
- Simulador de juros ativo (sim/não)
- Tipos de juros (simples, compostos, price) — quais mostrar
- Alertas de parcela próxima do vencimento (dias de antecedência)

**Importar Transações:**
- Formatos aceitos (CSV, OFX, PDF)
- Max linhas por importação
- Max tamanho arquivo (MB)
- Mapeamento de colunas customizável pelo admin
- IA para classificação automática (sim/não, qual modelo)

**Limites por Categoria:**
- Alertas configuráveis (% de consumo: 50%, 80%, 100%)
- Período (mensal, quinzenal, semanal)
- Notificação push ao atingir limite (sim/não)
- Reset automático no início do período (sim/não)

**Metas Financeiras:**
- Max metas ativas por usuário/plano
- Tipos de meta (valor fixo, percentual da renda, recorrente)
- Celebração ao atingir meta (animação, badge, pontos)
- Metas sugeridas pela IA (sim/não)
- Compartilhamento de progresso (sim/não)

**Investimentos:**
- Tipos de investimento habilitados (renda fixa, ações, FIIs, cripto, etc.)
- Integração com APIs externas (B3, Yahoo Finance) — sim/não
- Calculadora de rentabilidade embutida (sim/não)
- Atualização automática de cotações (frequência)

**Mercado/Compras:**
- Max itens por lista
- Categorias de lista (editáveis pelo admin)
- Compartilhamento de lista (sim/não)
- Histórico de preços (sim/não)
- Sugestões de compra baseadas em histórico (sim/não)

**Categorias:**
- Categorias padrão editáveis pelo admin (receitas e despesas)
- Max categorias custom por plano
- Ícones disponíveis (biblioteca configurável)
- Cores disponíveis (paleta configurável)
- Categorias bloqueadas (não deletáveis pelo usuário)

**Extrato:**
- Período máximo de visualização por plano (30d, 90d, ilimitado)
- Exportação habilitada (CSV, PDF) por plano
- Filtros disponíveis (tipo, categoria, conta, valor, período)
- Busca por texto ativa (sim/não)
- Agrupamento (por dia, semana, mês)

**Relatórios:**
- Nível de relatório por plano (basic, starter, pro, plus)
- Tipos de gráfico habilitados (pizza, barra, linha, área)
- Export PDF ativo (sim/não) por plano
- Comparativo mensal ativo (sim/não) — atualmente só Plus
- Projeções futuras (sim/não)

**Insights:**
- IA ativa para geração de insights (sim/não)
- Modelo de IA (gemini-1.5-flash, gemini-1.5-pro)
- Créditos de IA por plano (editáveis)
- Frequência de atualização automática
- Tipos de insight habilitados (economia, alerta, parabéns, dica)

**Assistente IA:**
- Modelo de IA configurável
- Prompt de sistema editável pelo admin (textarea grande)
- Max mensagens por conversa
- Max tokens por resposta
- Temperatura (slider 0.0 - 1.0)
- Contexto financeiro do usuário (permitir IA ler dados? sim/não)
- Respostas pré-definidas editáveis (saudação, erro, limite)
- Rate limit configurável (msg/min)

**Assistente WhatsApp:**
- Ativo/inativo (toggle global)
- Número do WhatsApp Business
- Relatório semanal ativo (dia/hora)
- Alertas de gastos via WhatsApp (sim/não)
- Mensagens automáticas editáveis (templates)

**Balanço Mensal:**
- Mês padrão (atual, anterior)
- Incluir pendentes no cálculo (sim/não)
- Gráfico comparativo com mês anterior (sim/não)
- Meta de economia mensal sugerida (% da renda)

**Comparativo:**
- Períodos comparáveis (2, 3, 6, 12 meses)
- Métricas comparadas (receita, despesa, economia, categorias)
- Gráficos habilitados (barra, linha, radar)

---

## 3. 💰 NOVA ABA: GESTÃO DE PLANOS E MONETIZAÇÃO

### O que é
Painel completo para o admin configurar tudo sobre planos, preços, features, trials, promoções e assinaturas **sem precisar alterar código**.

### Funcionalidades

#### 3.1 Editor de Planos
```
┌──────────────────────────────────────────────────┐
│  💰 Planos & Monetização                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─── Free ─────┐  ┌─── Starter ──┐            │
│  │ R$ 0,00      │  │ R$ 9,99      │            │
│  │ 30 tx/mês    │  │ 150 tx/mês   │            │
│  │ 1 cartão     │  │ 1 cartão     │            │
│  │ 30d histórico│  │ 90d histórico│            │
│  │ [Editar]     │  │ [Editar]     │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌─── Pro ──────┐  ┌─── Plus ─────┐            │
│  │ R$ 29,90     │  │ R$ 49,90     │            │
│  │ 600 tx/mês   │  │ Ilimitado    │            │
│  │ 4 cartões    │  │ Ilimitado    │            │
│  │ ∞ histórico  │  │ ∞ histórico  │            │
│  │ [Editar]     │  │ [Editar]     │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  [+ Criar Novo Plano]                            │
└──────────────────────────────────────────────────┘
```

**Ao clicar "Editar" abre modal com:**
- Nome do plano
- Preço (R$)
- Todos os 40 feature flags com toggle individual
- Limites numéricos (tx/mês, cartões, créditos IA, etc.)
- Ativo/inativo (pode desativar plano para não aceitar novos assinantes)
- Badge/cor do plano na UI

#### 3.2 Feature Flags — Que Funcionam de Verdade

O sistema atual de feature flags salva no Firestore mas **nenhuma tela verifica**. A proposta:

**No admin:** Cada flag mostra:
- Nome e descrição
- Status (ativo/inativo) com toggle
- Plano mínimo necessário
- Quantas telas são afetadas
- Override: `default` (segue plano) / `force_on` (ativo pra todos) / `force_off` (inativo pra todos)
- Teste A/B: % de usuários que recebem a feature (para rollout gradual)

**No app (cada tela):** Padrão de verificação:

```javascript
// utilities - bud-utils.js (adicionar):
async function checkFeature(featureKey) {
  const config = window.BudConfig;
  const override = config?.featureOverrides?.[featureKey];

  // 1. Override global do admin
  if (override?.override === 'force_off') return false;
  if (override?.override === 'force_on') return true;

  // 2. Feature flag global desativada
  if (override?.ativo === false) return false;

  // 3. Verificação por plano do usuário
  return window.NexoPlanos?.canUseFeature(featureKey) ?? false;
}

// Uso em qualquer tela:
if (!await checkFeature('recurringTransactions')) {
  showUpgradePopup('recorrentes');
  return;
}
```

#### 3.3 Gestão de Trial
- Duração do trial (editável: 3, 7, 14, 30 dias)
- Features incluídas no trial (pode ser subset do Plus)
- Trial automático no cadastro (sim/não)
- Notificações de expiração (quantos dias antes? 3, 1, 0)
- Ação pós-trial: volta pra Free ou bloqueia acesso?
- Extensão de trial por Admin (para user específico)

#### 3.4 Cupons e Promoções (já existe mas evoluir)
- Desconto por plano específico ou qualquer plano
- Período de validade (de/até)
- Max usos total e por usuário
- Desconto em % ou R$ fixo
- Para primeiro pagamento ou recorrente
- Código automático (gerado) ou manual
- Dashboard de uso do cupom (quantos usaram, receita gerada/perdida)

---

## 4. 👥 NOVA ABA: GESTÃO DE USUÁRIOS AVANÇADA

### Evolução do CRM Atual

O CRM atual tem paginação e visão 360°, mas falta:

#### 4.1 Ações em Massa (Bulk Actions)
```
[ ] Selecionar todos  |  37 selecionados
[Enviar Notificação] [Migrar Plano] [Exportar CSV] [Estender Trial] [Desativar]
```

- Enviar notificação push para seleção de usuários
- Migrar usuários de plano (ex: free → starter como promoção)
- Exportar lista em CSV/Excel
- Estender trial de múltiplos usuários
- Desativar/reativar contas em massa

#### 4.2 Segmentação Avançada
Filtros combinados:
```
Plano: [Free ▼] AND Engajamento: [Risk ▼] AND Cadastro: [Últimos 30 dias ▼]
→ 147 usuários encontrados
[Salvar Segmento] [Enviar Campanha]
```

Segmentos sugeridos:
- "Free há mais de 30 dias sem upgrade" → candidatos a promoção
- "Pro com alta atividade" → candidatos a upsell Plus
- "Inativos há mais de 7 dias" → campanha de reengajamento
- "Trial expirando em 3 dias" → notificação urgente
- "Top 10 power users" → candidatos a embaixadores

#### 4.3 Perfil de Usuário Expandido (Visão 360°)

Além do que já existe, adicionar:

**Timeline de Atividade:**
```
📅 02/04/2026 14:30 — Login via PWA
📅 02/04/2026 14:31 — Adicionou transação "Supermercado" R$ 150,00
📅 02/04/2026 14:35 — Consultou relatório mensal
📅 01/04/2026 19:00 — Upgrade Free → Pro via Mercado Pago
📅 30/03/2026 08:00 — Recorrente processada "Aluguel" R$ 1.200,00
```

**Ações Admin no Perfil:**
- Alterar plano manualmente (com motivo)
- Estender trial (com nota)
- Enviar notificação individual
- Resetar senha
- Bloquear/desbloquear conta
- Ver logs de erro do usuário
- Exportar todos os dados (LGPD)
- Excluir conta + dados (LGPD — já existe via Cloud Function)
- Adicionar nota interna (anotações de atendimento)

#### 4.4 KPIs de Usuário no Perfil
```
┌──────────────────────────────────────┐
│ Saúde Financeira: 72/100  🟢       │
│ Streak Atual: 15 dias  🔥          │
│ Transações este mês: 23/30         │
│ Créditos IA restantes: 8/20        │
│ Tempo médio de sessão: 4.2 min     │
│ Último login: há 2 horas           │
│ Plano: Pro (desde 15/03/2026)      │
│ Receita gerada: R$ 29,90/mês       │
│ LTV estimado: R$ 179,40            │
└──────────────────────────────────────┘
```

---

## 5. 📈 NOVA ABA: ANALYTICS E MÉTRICAS DO NEGÓCIO

### O que é
Dashboard completo de métricas de negócio para o admin entender a saúde do produto.

### 5.1 Métricas de Receita (MRR)
```
MRR (Monthly Recurring Revenue): R$ 12.450,00
  ├─ Starter (420 users × R$9,99):  R$ 4.195,80
  ├─ Pro (180 users × R$29,90):     R$ 5.382,00
  └─ Plus (57 users × R$49,90):     R$ 2.843,10

Churn Rate: 4.2% (este mês)
ARPU: R$ 18,93/user pagante
LTV médio: R$ 226,16
CAC: (precisa definir — tracking de origem)
```

### 5.2 Métricas de Produto
```
DAU (Daily Active Users): 892
WAU (Weekly Active Users): 2.340
MAU (Monthly Active Users): 4.100
DAU/MAU Ratio: 21.7% (stickiness)

Features mais usadas (este mês):
1. Dashboard — 4.100 acessos
2. Extrato — 3.800 acessos
3. Carteira — 2.900 acessos
...

Tempo médio de sessão: 5.3 min
Taxa de conclusão de onboarding: 67%
Taxa de conversão Free → Paid: 12%
```

### 5.3 Funil de Conversão
```
Visitas → Cadastros → Onboarding completo → Primeira transação → Upgrade
10.000 → 2.340 (23%) → 1.569 (67%) → 890 (57%) → 267 (30%)
```

### 5.4 Cohort Analysis
```
Cadastrados  | M0   | M1   | M2   | M3   | M6   | M12
Jan/2026     | 100% | 45%  | 32%  | 28%  | 18%  | —
Fev/2026     | 100% | 52%  | 38%  | 30%  | —    | —
Mar/2026     | 100% | 48%  | —    | —    | —    | —
```

### Como implementar
1. **Cloud Function scheduled** (`analytics-daily`) que roda 1x/dia e calcula:
   - Contagem por plano (usando `getCountFromServer` com filtro)
   - Receita = somatório de (users por plano × preço do plano)
   - DAU = users com `ultimoLogin` = hoje
   - Churn = users que tinham plano pago e agora estão free
2. **Salva em** `admin/analytics/{YYYY-MM-DD}` — um doc por dia
3. **Admin lê** últimos 30 docs para montar gráficos de tendência
4. **Custo Firestore:** 1 read/dia para gravar + 30 reads para exibir = mínimo

---

## 6. 🔔 NOVA ABA: CENTRAL DE COMUNICAÇÃO

### Evolução do Sistema de Notificações Atual

O sistema atual salva em `notificacoes-globais` mas a Cloud Function `enviarPushNotificacao` só funciona se os users tiverem token FCM salvo. A proposta é uma central **multi-canal**:

### 6.1 Canais de Comunicação
```
┌─────────────────────────────────────────────┐
│  🔔 Central de Comunicação                  │
├─────────────────────────────────────────────┤
│                                             │
│  📱 Push (FCM)     [ON] ████████ 78%       │
│  📧 Email (EmailJS) [ON] ████████ 92%      │
│  💬 WhatsApp       [OFF] ░░░░░░░░ 0%       │
│  🔔 In-App         [ON] ████████████ 100%  │
│                                             │
│  (% = usuários com canal configurado)       │
└─────────────────────────────────────────────┘
```

### 6.2 Composer de Notificação
```
Tipo: [Push ▼] [Email ▼] [In-App ▼]  (multi-select)
Para: [Todos ▼] [Segmento ▼] [Plano ▼] [Usuário Específico]
Título: [______________________]
Mensagem: [______________________]
Link/Ação: [dashboard.html ▼]
Agendar: [Agora ▼] [Data/Hora específica]
[Preview]  [Enviar]  [Salvar Rascunho]
```

### 6.3 Templates de Notificação
Templates reutilizáveis editáveis pelo admin:
- **Boas-vindas** — enviado automaticamente no cadastro
- **Trial expirando** — 3 dias antes, 1 dia antes, no dia
- **Upgrade disponível** — promoção personalizada
- **Inatividade** — 3, 7, 14, 30 dias sem login
- **Meta atingida** — parabéns com badge
- **Novo recurso** — anúncio de feature
- **Manutenção** — aviso de downtime

Cada template com variáveis: `{{nome}}`, `{{plano}}`, `{{diasRestantes}}`, `{{meta}}`, etc.

### 6.4 Histórico e Métricas
```
Últimas campanhas:
| Data       | Canal | Audiência | Enviados | Abertos | Cliques |
|------------|-------|-----------|----------|---------|---------|
| 02/04/2026 | Push  | Todos     | 4.100    | 1.230   | 890     |
| 01/04/2026 | Email | Free      | 2.800    | 560     | 120     |
```

---

## 7. 🛡️ NOVA ABA: SEGURANÇA E LOGS

### 7.1 Audit Log
```
[02/04 14:30] Admin jackson@email.com alterou plano de user@email.com: Free → Pro
[02/04 14:28] Admin jackson@email.com desativou feature: monthlyComparative
[02/04 13:00] Cloud Function enforceTransactionLimit bloqueou tx do user user123 (30/30)
[02/04 12:00] Login falhou para user@email.com (5 tentativas) — conta bloqueada
[02/04 11:00] Novo cadastro: novo@email.com via Google OAuth
```

### 7.2 Rate Limiting Dashboard
```
Endpoint          | Rate Limit | Uso Atual (últimas 24h) | Bloqueios
/chat             | 30/min     | Média 8/min, Pico 28/min| 3
/chamado          | 5/15min    | Média 0.2/15min         | 0
/reset-senha      | 5/15min    | Média 0.1/15min         | 1
Webhook WhatsApp  | —          | 45 msgs/dia             | 0
```

### 7.3 Monitoramento de Cloud Functions
```
Função                      | Execuções (24h) | Erros | Tempo Médio
enviarPushNotificacao       | 15              | 2     | 1.2s
enforceTransactionLimit     | 340             | 0     | 0.3s
enforceCardLimit            | 12              | 0     | 0.2s
processarRecorrentes        | 1 (cron)        | 0     | 8.4s
enviarLembretesFinanceiros  | 1 (cron)        | 0     | 12.1s
```

### 7.4 Configurações de Segurança Editáveis
- Max tentativas de login antes do lockout
- Tempo de lockout (minutos)
- Duração da sessão (horas)
- Força mínima da senha
- Permitir registro por email (sim/não)
- Permitir registro por Google (sim/não)
- Domínios de email proibidos (lista negra)
- IP whitelist para admin (opc.)
- 2FA obrigatório para admins (sim/não)

---

## 8. 🎨 NOVA ABA: APARÊNCIA E BRANDING

### 8.1 Customização Visual
```
┌──────────────────────────────────────┐
│  🎨 Aparência                        │
├──────────────────────────────────────┤
│                                      │
│  Cor Primária:  [🟢 #16a34a] [pick] │
│  Cor Secund.:   [🟢 #15803d] [pick] │
│  Cor Accent:    [🟡 #facc15] [pick] │
│                                      │
│  Logo:    [upload] [preview]         │
│  Favicon: [upload] [preview]         │
│                                      │
│  Nome do App:   [Bud Finanças    ]   │
│  Slogan:        [Finanças Intelig]   │
│                                      │
│  Splash Screen: [ON]                 │
│  Dark Mode default: [OFF]            │
│                                      │
│  [Preview] [Salvar] [Restaurar Pad.] │
└──────────────────────────────────────┘
```

### 8.2 Sidebar Customização
- Reordenar itens do menu (drag & drop)
- Renomear labels de menu
- Ícones alternativos por item
- Esconder módulos do menu (sem desativar o módulo)
- Agrupamento customizado

### 8.3 Editor de Onboarding
- Ativar/desativar onboarding
- Etapas configuráveis (drag & drop para reordenar)
- Adicionar/remover etapas
- Texto/imagem de cada etapa editável
- Trial automático (sim/não, duração)
- Permitir pular onboarding (sim/não)

---

## 9. 🔧 COMO IMPLEMENTAR — PLANO DE EXECUÇÃO

### Fase 1: Fundação (Prioridade Alta)

1. **Criar doc `admin/appConfig`** com estrutura completa no Firestore
2. **Modificar `bud-loader.js`** para ler e cachear o appConfig
3. **Criar `bud-admin-config.js`** — utilitário que expõe `checkModule()`, `checkFeature()`, `getConfig()`
4. **Integrar feature flags reais** — cada tela checa `window.BudConfig.modulosAtivos.{tela}` no init
5. **Integrar feature overrides** — `checkFeature()` consulta override do admin antes do plano
6. **Modo manutenção real** — `bud-loader.js` redireciona para `manutencao.html` se `BudConfig.manutencao.modoManutencao === true`
7. **Toggle de cadastro real** — `cadastro.js` verifica `BudConfig.seguranca.permitirCadastroPorEmail`

**Firestore Rules necessárias:**
```
match /admin/appConfig {
  allow read: if request.auth != null;  // qualquer user autenticado pode ler config
  allow write: if isAdmin();            // só admin escreve
}
```

### Fase 2: Admin UI (Prioridade Média)

8. **Nova aba "Módulos"** no admin — grid de cards com toggles
9. **Nova aba "Planos"** — editor visual de planos
10. **Evoluir aba Feature Flags** — override (force_on/force_off/default), binding real com as telas
11. **Evoluir CRM** — bulk actions, segmentação, timeline
12. **Evoluir Notificações** — composer multi-canal, templates, agendamento

### Fase 3: Analytics e Segurança (Prioridade Baixa)

13. **Cloud Function `analytics-daily`** — calcula e salva métricas de negócio
14. **Nova aba "Analytics"** — MRR, DAU/MAU, funil, cohort
15. **Nova aba "Segurança"** — audit log, rate limiting, monitoramento
16. **Nova aba "Aparência"** — customização visual, sidebar editor, onboarding editor

### Estimativa de Impacto por Fase

| Fase | Arquivos Afetados | Complexidade |
|------|------------------|-------------|
| Fase 1 | bud-loader.js, bud-utils.js, cadastro.js, todas as 20 telas (1 linha cada) | Média |
| Fase 2 | admin.html, js/admin.js (expansão significativa) | Alta |
| Fase 3 | functions/index.js (novo cron), admin.html, js/admin.js | Alta |

### Padrão de Código para Cada Tela (Fase 1)

Adicionar NO TOPO de cada tela, logo após checar auth:

```javascript
// ─── VERIFICAÇÃO DE MÓDULO ───
if (!window.BudConfig?.modulosAtivos?.metas) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;font-family:sans-serif;">
      <h2 style="color:#ef4444;">Módulo Desativado</h2>
      <p style="color:#6b7280;">Este recurso está temporariamente indisponível.</p>
      <a href="dashboard.html" style="margin-top:1rem;color:#16a34a;">← Voltar ao Dashboard</a>
    </div>
  `;
  return;
}
```

**Nota:** Usa `style` inline e não classes Tailwind — respeitando a regra de que classes dinâmicas em JS não existem no build estático do Tailwind.

---

## 10. 📋 RESUMO — O QUE O ADMIN DEVERIA CONTROLAR

| Área | Controle | Hoje | Proposto |
|------|----------|------|----------|
| **Módulos** | Ligar/desligar cada tela do app | ❌ | ✅ Toggle por módulo |
| **Planos** | Preço, limites, features de cada plano | Hardcoded em plano-config.js | ✅ Editável no admin |
| **Feature Flags** | Ativar/desativar features com override | 🟡 Cosmético (não verificado) | ✅ Real, com force on/off |
| **Categorias** | Categorias padrão do sistema | Hardcoded em 5+ arquivos | ✅ Centralizadas no admin |
| **Trial** | Duração, features, automático | Hardcoded 7 dias | ✅ Configurável |
| **Notificações** | Push real, email, WhatsApp, agendamento | 🟡 Fake (salva mas não envia) | ✅ Multi-canal real |
| **CRM** | Ações em massa, segmentação | 🟡 Básico (só consulta) | ✅ Completo com ações |
| **Analytics** | MRR, DAU/MAU, churn, funil | ❌ | ✅ Dashboard de negócio |
| **Segurança** | Lockout, sessão, rate limit, logs | ❌ | ✅ Configurável |
| **Aparência** | Cores, logo, nome, sidebar | Hardcoded | ✅ Editável |
| **Onboarding** | Etapas, textos, trial | Hardcoded | ✅ Configurável |
| **IA** | Modelo, prompt, limites, temperatura | Hardcoded em Cloud Function | ✅ Editável |
| **Manutenção** | Modo manutenção real | 🟡 Cosmético (não bloqueia) | ✅ Bloqueia de verdade |
| **Cadastro** | Toggle abrir/fechar | 🟡 Cosmético | ✅ Funcional |
| **Gamificação** | Streak, badges, pontos | Hardcoded | ✅ Configurável |
| **Importação** | Formatos, limites, mapeamento | Hardcoded | ✅ Editável |
| **Integrações** | Mercado Pago, EmailJS, Gemini, WhatsApp | Hardcoded em env vars | ✅ Toggle + config no admin |

**Em resumo:** De 17 áreas de controle possíveis, o admin atual controla 0 de forma efetiva (3 de forma cosmética). A proposta transforma o painel em um **centro de controle real** onde cada decisão de produto pode ser tomada sem deploy.
