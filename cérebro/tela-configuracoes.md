# ⚙️ Tela de Configurações – Bud Finanças

**Versão**: 1.0  
**Data**: 06/04/2026  
**Rota**: `/configuracoes.html`  
**Título**: Ajustes - Bud Finanças  
**Propósito**: Central de controle do usuário - gerenciar assinatura, conta, privacidade e preferências

---

## ⚠️ Nota Sobre Nomes Antigos (Legado)

O código dessa página contém referências a **"Nexo"** (nome antigo do projeto):
- `window.NexoPlanos` → Sistema de resolução de planos (renomeado para `BudPlanos`)
- `NexoTutorial` → Sistema de tutorial (renomeado para `BudTutorial`)
- LocalStorage keys: `nexo_foto_*` → Foto de perfil (legado, mas funciona)

**Essas variáveis continuam funcionando e não causam conflitos** — são apenas referências antigas mantidas por compatibilidade. Na próxima refatoração, devem ser renomeadas para "Bud*".

---

## 📐 Estrutura Geral

```
├── HEAD
│   ├── Meta tags (PWA, viewport, dark mode)
│   ├── Tailwind CSS
│   ├── Firebase + Firestore + Messaging
│   ├── XLSX (exportação de dados)
│   └── Dark mode stylesheet
│
└── BODY
    ├── Sidebar (navegação)
    ├── Header (usuário + plano + avatar)
    └── Conteúdo em cards:
        ├─ Card Premium - Sua Assinatura
        ├─ Card - Informações da Conta
        ├─ Card - Preferências do App
        ├─ Card - Assistente WhatsApp
        ├─ Card - Privacidade e Dados (LGPD)
        ├─ Card - Segurança e Conta
        └─ Modais (Reset, Excluir Conta)
```

---

## 🎨 Design & Layout

### Header
```css
height: 80px           /* 20 Tailwind */
background: white
border-bottom: 1px solid #e2e8f0
sticky top-0, z-30    /* Fica fixo ao scroll */
```

**Conteúdo**:
- Botão menu (hidden em desktop)
- Título "Ajustes"
- À direita: Nome do usuário + Badge do plano + Avatar

### Cards
```css
Cada seção é um card:
├─ background: white
├─ border: 1px solid #e2e8f0
├─ border-radius: 2rem (32px)
├─ padding: 24px (6 Tailwind) / 32px (8 Tailwind)
└─ box-shadow: muito sutilmente
```

### Premium Card
```css
background: linear-gradient(135deg, #0f172a, #1e3a5f, #0c4a6e)
├─ Radiais de cor com opacidades baixas
├─ ::before → cyan glow (top-right)
└─ ::after → verde glow (bottom-left)
```

---

## 🎯 Seções Principais

### 1️⃣ Card Premium - Sua Assinatura

**ID**: `#blocoAssinatura`  
**Propósito**: Mostra status atual da assinatura + botões de upgrade

#### Estados Possíveis

```javascript
// Estado 1: PLANO PAGO ATIVO
icone: '👑'
titulo: "Plano [Starter/Pro/Plus] Ativo"
descr: "Assinatura ativa via Mercado Pago. ✓ Cobrança recorrente"
btnUpgrade: hidden

// Estado 2: TRIAL ATIVO
icone: '⏳'
titulo: "Período de Teste Ativo"
descr: "X dia(s) restante(s) • Expira em DD/MM/YYYY às HH:MM"
btnUpgrade: hidden

// Estado 3: PLANO FREE (sem trial ou expirado)
icone: '🔒'
titulo: "Plano Gratuito" OU "Período de Teste Encerrado"
descr: "Assine um plano para desbloquear todos os recursos."
btnUpgrade: visible
```

#### Seção de Upgrade/Downgrade

```html
<!-- Se há planos superiores disponíveis -->
<p class="uppercase text-xs">Fazer upgrade</p>

<!-- Para cada plano disponível -->
<button onClick="iniciarAssinatura('starter')">
  ⬆ Upgrade para Starter
  <span>R$9,99/mês</span>
</button>

<!-- Se já tem plano pago: botão de cancelamento -->
<button onClick="cancelarAssinatura()">
  Cancelar assinatura
</button>
```

#### Lógica de Resolução de Plano

```javascript
// Usa window.NexoPlanos.resolvePlan(userData)
// Que retorna:
{
    effectivePlan: 'starter',        // Plano real do usuário
    storedPlan: 'trial',             // Plano salvo no Firestore
    isTrialActive: false,            // Trial expirou?
    trialEndsAt: '2026-04-15T...',   // Data de vencimento
    shouldDowngrade: false,          // Precisa fazer downgrade?
    downgradeReason: null            // Por que?
}

// Se shouldDowngrade === true:
// Atualiza Firestore automaticamente:
userData.plano = 'free'
userData.downgradeMotivo = planResolver.downgradeReason
userData.downgradeEm = new Date()
```

#### Integração Mercado Pago

```javascript
async function iniciarAssinatura(planKey) {
    // Disabilita botões enquanto processa
    document.querySelectorAll('.btn-upgrade-mp').forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.6';
    });
    
    try {
        // Pega token de autenticação do Firebase
        const idToken = await usuarioAtual.getIdToken();
        
        // Chama Cloud Function
        const res = await fetch(FUNCTIONS_URL + '/mercadopago/create-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + idToken
            },
            body: JSON.stringify({
                planKey: planKey,           // 'starter', 'pro', 'plus'
                uid: usuarioAtual.uid,
                email: usuarioAtual.email
            })
        });
        
        const data = await res.json();
        
        if (!res.ok || !data.init_point) {
            budShowToast(data.error || 'Erro ao criar assinatura', 'erro');
            location.reload();
            return;
        }
        
        // Redireciona para o checkout do Mercado Pago
        window.location.href = data.init_point;
        // User paga lá
        // Volta pra: ?preapproval_id=XXXXX
        // URL param é removido sem reload
        // Firestore é atualizado via Cloud Function
    } catch (err) {
        budShowToast('Erro de conexão', 'erro');
        location.reload();
    }
}

async function cancelarAssinatura() {
    // 1. Modal de confirmação
    var ok = await mostrarModal(
        'Tem certeza que deseja cancelar sua assinatura? '
        + 'Voc voltará para o plano Free.'
    );
    
    if (!ok) return;
    
    try {
        const idToken = await usuarioAtual.getIdToken();
        
        // Cloud Function cancela assinatura
        const res = await fetch(
            FUNCTIONS_URL + '/mercadopago/cancel-subscription',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + idToken
                },
                body: JSON.stringify({ uid: usuarioAtual.uid })
            }
        );
        
        const data = await res.json();
        
        if (data.success) {
            budShowToast(
                'Assinatura cancelada. Você foi revertido para o plano Free.',
                'sucesso'
            );
            location.reload();
        } else {
            budShowToast(data.error || 'Erro ao cancelar', 'erro');
        }
    } catch (err) {
        budShowToast('Erro de conexão', 'erro');
    }
}
```

#### Hierarquia de Planos

```javascript
const hierarquia = ['free', 'starter', 'pro', 'plus'];

// Se user está em 'starter', pode fazer upgrade pra 'pro' e 'plus'
// Se user está em 'pro', pode fazer upgrade pra 'plus'
// Se user está em 'plus', NÃO há botão de upgrade
// Se user está em 'free', pode fazer upgrade pra todos
```

---

### 2️⃣ Card - Informações da Conta

**Campos**:

```html
Matrícula: userData.matricula || user.uid.substring(0, 10) + '...'
           (ID único para identificação rápida)

Conta criada em: new Date(user.metadata.creationTime)
                 .toLocaleDateString('pt-BR')
                 (DD/MM/YYYY)
```

**Appearance**: 
```css
Fundo: #f9fafb (slate-50)
Linhas divisórias: #e2e8f0 (slate-100)
Texto: #4b5563 (slate-600)
```

---

### 3️⃣ Card - Preferências do App

#### 3.1 Notificações Push

**Comportamento**:

```javascript
async function verificarEstadoPush(uid) {
    // 1. Verifica se browser suporta notifications
    if (!('Notification' in window)) {
        // Não suporta, esconde a opção
        document.getElementById('btnPush').classList.add('hidden');
        return;
    }
    
    // 2. Pega permission atual
    const permission = Notification.permission;  // 'default', 'granted', 'denied'
    
    if (permission === 'granted') {
        // Notificações já ativadas
        document.getElementById('pushIcone').innerText = '🔔';
        document.getElementById('pushStatus').innerText = 'Ativado';
        document.getElementById('btnPush').classList.add('hidden');
        
    } else if (permission === 'denied') {
        // User recusou notificações
        document.getElementById('pushStatus').innerText = 'Desativado pelo navegador';
        
    } else if (permission === 'default') {
        // Ainda não decidiu, mostra botão
        document.getElementById('pushStatus').innerText = 'Não ativado';
        document.getElementById('btnPush').classList.remove('hidden');
    }
}

async function ativarPush() {
    try {
        // Request permission do browser
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            // User aceitou
            
            // iOS: mostra modal com tutorial
            if (isIOS()) {
                document.getElementById('modalInstalarIOS').classList.remove('hidden');
                return;
            }
            
            // Desktop: já pode registrar no Firebase Messaging
            const messaging = firebase.messaging();
            const token = await messaging.getToken({
                vapidKey: window.BUD_VAPID_KEY
            });
            
            // Salva token no Firestore
            await db.collection('usuarios').doc(userUid).update({
                pushToken: token,
                pushAtivado: true,
                pushAtivoEm: new Date()
            });
            
            budShowToast('Notificações ativadas!', 'sucesso');
            location.reload();
        }
    } catch (err) {
        budShowToast('Erro ao ativar: ' + err.message, 'erro');
    }
}
```

**Modal iOS**:
```html
<!-- Só aparece em iOS quando tenta ativar notificações -->
<div id="modalInstalarIOS" class="hidden bg-blue-50 border border-blue-200 rounded-2xl p-4">
    <p class="text-sm font-extrabold text-blue-800 mb-2">
        📱 Instale o app para ativar notificações
    </p>
    <p class="text-xs text-blue-700 font-medium mb-3">
        No iPhone/iPad, notificações só funcionam quando o app está 
        instalado na tela inicial.
    </p>
    
    <ol class="space-y-2 text-xs text-blue-800 font-semibold">
        <li>1️⃣ Toque no ícone ⬆️ Compartilhar na barra inferior do Safari</li>
        <li>2️⃣ Role para baixo e toque em "Adicionar à Tela de Inicio"</li>
        <li>3️⃣ Confirme tocando em Adicionar</li>
        <li>4️⃣ Abra o app pelo ícone na tela inicial e ative aqui</li>
    </ol>
</div>
```

#### 3.2 Modo Escuro

**Switch Toggle**:
```javascript
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark');
    
    // Persiste em localStorage
    localStorage.setItem('budDarkMode', isDark ? 'true' : 'false');
    
    // Anima o toggle (bolinha se move)
    const dot = document.getElementById('toggleDarkModeDot');
    if (isDark) {
        dot.style.left = 'var(--translateX, 26px)';  // Direita
    } else {
        dot.style.left = '4px';  // Esquerda
    }
}

// Load no onload
window.addEventListener('load', function() {
    const isDarkStored = localStorage.getItem('budDarkMode') === 'true';
    if (isDarkStored) {
        document.body.classList.add('dark');
        // Posiciona toggle
    }
});
```

**CSS Dark Mode**:
```css
/* Aplicado em body.dark */
body.dark {
    background-color: #0f172a !important;  /* Fundo muito escuro azul */
}

body.dark .bg-white {
    background: #1e293b !important;  /* Cards em azul menos escuro */
    border-color: #334155 !important;
}

body.dark .text-slate-800,
body.dark .text-slate-700 {
    color: #e2e8f0 !important;  /* Texto em cinza claro */
}

body.dark .border-slate-200,
body.dark .border-slate-100 {
    border-color: #334155 !important;  /* Borders em cinza escuro */
}
```

#### 3.3 Tutorial do App

```javascript
button onclick="NexoTutorial.resetAll()"
// Reseta todas as flags do tutorial para false
// Usuário verá tutorial novamente ao recarregar

// Tutorial é controlado por tutorial.js e tutorial-steps.js
// Cada step tem uma flag associada em localStorage
```

---

### 4️⃣ Card - Assistente WhatsApp (Recurso Plus)

**Disponibilidade**: Somente plano **Plus**

#### Lógica de Verificação

```javascript
async function carregarWhatsApp(uid, isPro) {
    const canWhatsApp = (window.NexoPlanos && 
        typeof window.NexoPlanos.canUseFeature === 'function') 
        ? window.NexoPlanos.canUseFeature(userData, 'whatsappAssistant')
        : isPaidPlan;
    
    const configDiv = document.getElementById('whatsappConfig');
    const proBanner = document.getElementById('whatsappProBanner');
    
    if (!canWhatsApp) {
        // Não tem Plus: mostra banner
        proBanner.classList.remove('hidden');
        configDiv.classList.add('hidden');
        return;
    }
    
    // Tem Plus: mostra config
    configDiv.classList.remove('hidden');
    proBanner.classList.add('hidden');
    
    // Load número vinculado
    const userDoc = await db.collection('usuarios').doc(uid).get();
    const userData = userDoc.data();
    const numVinculado = userData.whatsappVinculado || '';
    
    if (numVinculado) {
        atualizarUIWhatsAppConectado(numVinculado);
    }
}
```

#### Interface - Desconectado

```html
<div id="whatsappStatusBox">
    <span id="whatsappStatusIcon">📱</span>
    <div>
        <p id="whatsappStatusText">Conecte seu WhatsApp</p>
        <p id="whatsappStatusDesc">Vincule seu número para usar o assistente</p>
    </div>
</div>

<!-- Input -->
<label>Seu número de WhatsApp</label>
<input type="tel" id="inputWhatsApp" 
    placeholder="11 99999-9999" 
    maxlength="15" />

<!-- Botão -->
<button id="btnVincularWhatsApp" onclick="vincularWhatsApp()">
    Vincular WhatsApp
</button>
```

#### Interface - Conectado

```html
<!-- Status muda pra vermelho -->
<div id="whatsappStatusBox" style="background:#f0fdf4; border:1px solid #bbf7d0;">
    <span id="whatsappStatusIcon">✅</span>
    <div>
        <p id="whatsappStatusText">WhatsApp conectado</p>
        <p id="whatsappStatusDesc">Número: +55 11 99999-9999</p>
    </div>
</div>

<!-- Input fica disabled -->
<input id="inputWhatsApp" disabled value="11 99999-9999" />

<!-- Mostra botão desvincular -->
<button id="btnDesvincularWhatsApp" onclick="desvincularWhatsApp()">
    Desvincular WhatsApp
</button>

<!-- Funcionalidades -->
<div id="whatsappFuncionalidades">
    <p>O que você pode fazer pelo WhatsApp:</p>
    <div class="grid grid-cols-2 gap-2">
        <div>💰 Registrar gastos</div>
        <div>📊 Ver relatórios</div>
        <div>📸 Enviar notas fiscais</div>
        <div>🎯 Consultar metas</div>
        <div>💳 Ver cartões</div>
        <div>📋 Ver dívidas</div>
    </div>
</div>
```

#### Vincular WhatsApp

```javascript
window.vincularWhatsApp = async function() {
    if (!usuarioAtual) return;
    
    const input = document.getElementById('inputWhatsApp')
        .value.replace(/\D/g, '');  // Remove não-dígitos
    
    // Validação: DDD (2 dígitos) + número (8-9 dígitos) = 10-11 total
    if (input.length < 10 || input.length > 11) {
        budShowToast(
            'Digite um número de WhatsApp válido (DDD + número)',
            'erro'
        );
        return;
    }
    
    // Formata: +55 11 99999-9999
    const numero = '55' + input;
    
    const btn = document.getElementById('btnVincularWhatsApp');
    btn.innerHTML = 'Vinculando...';
    btn.disabled = true;
    
    try {
        // Salva no Firestore
        await db.collection('usuarios').doc(usuarioAtual.uid).update({
            whatsappVinculado: numero
        });
        
        // Atualiza UI
        atualizarUIWhatsAppConectado(numero);
        
        budShowToast(
            'WhatsApp vinculado com sucesso! Agora você pode enviar '
            + 'mensagens para o número do Bud e gerenciar suas finanças por lá.',
            'sucesso'
        );
    } catch(e) {
        budShowToast('Erro ao vincular: ' + e.message, 'erro');
    } finally {
        btn.innerHTML = 'Vincular WhatsApp';
        btn.disabled = false;
    }
};
```

#### Desvincular WhatsApp

```javascript
window.desvincularWhatsApp = async function() {
    if (!usuarioAtual) return;
    
    // Modal de confirmação
    const ok = await new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.innerHTML = `
            <div class="modal">
                <p>Deseja desvincular seu WhatsApp? 
                   Você não receberá mais respostas pelo chat.</p>
                <button onclick="...">Não</button>
                <button onclick="...">Sim</button>
            </div>
        `;
        document.body.appendChild(ov);
        // botões resolvem a promise
    });
    
    if (!ok) return;
    
    try {
        // Remove campo do Firestore
        await db.collection('usuarios').doc(usuarioAtual.uid).update({
            whatsappVinculado: firebase.firestore.FieldValue.delete()
        });
        
        // Atualiza UI
        atualizarUIWhatsAppDesconectado();
        
        budShowToast('WhatsApp desvinculado.', 'sucesso');
    } catch(e) {
        budShowToast('Erro: ' + e.message, 'erro');
    }
};
```

---

### 5️⃣ Card - Privacidade e Dados (LGPD)

**Propósito**: Conformidade com Lei Geral de Proteção de Dados

#### 5.1 Baixar Meus Dados

```javascript
async function exportarMeusDados() {
    if (!usuarioAtual) return;
    
    const btn = document.getElementById('btnExportarDados');
    btn.disabled = true;
    btn.querySelector('.export-label').innerText = 'Exportando...';
    
    try {
        // Busca TODOS os dados do usuário
        const userDoc = await db.collection('usuarios')
            .doc(usuarioAtual.uid).get();
        
        const transacoes = await db.collection('usuarios')
            .doc(usuarioAtual.uid).collection('transacoes')
            .get();
        
        const cartoes = await db.collection('usuarios')
            .doc(usuarioAtual.uid).collection('cartoes')
            .get();
        
        const categorias = await db.collection('usuarios')
            .doc(usuarioAtual.uid).collection('categorias')
            .get();
        
        const investimentos = await db.collection('usuarios')
            .doc(usuarioAtual.uid).collection('investimentos')
            .get();
        
        const metas = await db.collection('usuarios')
            .doc(usuarioAtual.uid).collection('metas')
            .get();
        
        // Compila em objeto
        const dados = {
            usuario: userDoc.data(),
            transacoes: transacoes.docs.map(d => d.data()),
            cartoes: cartoes.docs.map(d => d.data()),
            categorias: categorias.docs.map(d => d.data()),
            investimentos: investimentos.docs.map(d => d.data()),
            metas: metas.docs.map(d => d.data()),
            exportadoEm: new Date().toISOString()
        };
        
        // Cria arquivo JSON
        const json = JSON.stringify(dados, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meus-dados-bud-${usuarioAtual.uid}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        budShowToast('Dados exportados com sucesso!', 'sucesso');
        
    } catch(err) {
        budShowToast('Erro ao exportar: ' + err.message, 'erro');
    } finally {
        btn.disabled = false;
        btn.querySelector('.export-label').innerText = 'Baixar meus dados';
    }
}
```

**Saída**: Zip/JSON com estrutura:
```json
{
  "usuario": { "nome", "email", "plano", ... },
  "transacoes": [ { "data", "valor", "categoria", ... }, ... ],
  "cartoes": [ { "nome", "numero", "limite", ... }, ... ],
  "categorias": [ ... ],
  "investimentos": [ ... ],
  "metas": [ ... ],
  "exportadoEm": "2026-04-06T15:30:00.000Z"
}
```

#### 5.2 Gerenciar Notificações

```javascript
async function revogarConsentimentoNotificacoes() {
    if (!usuarioAtual) return;
    
    const ok = await mostrarConfirmacao(
        'Deseja revogar consentimento de notificações push?'
    );
    
    if (!ok) return;
    
    try {
        // Remove push token do Firestore
        await db.collection('usuarios').doc(usuarioAtual.uid).update({
            pushToken: firebase.firestore.FieldValue.delete(),
            pushAtivado: false,
            pushRevogadoEm: new Date()
        });
        
        // Desinscreve do Firebase Messaging
        const messaging = firebase.messaging();
        await messaging.deleteToken();
        
        budShowToast(
            'Consentimento revogado. Você não receberá mais notificações.',
            'sucesso'
        );
    } catch(err) {
        budShowToast('Erro: ' + err.message, 'erro');
    }
}
```

#### 5.3 Excluir Minha Conta (LGPD Art. 18)

**Modal**:
```html
<div id="modalExcluirConta" class="hidden fixed inset-0 z-[100]">
    <div class="bg-white rounded-3xl p-7 max-w-md w-full">
        <h3>Excluir conta permanentemente?</h3>
        <p>Conforme LGPD (Art. 18), você tem direito de solicitar 
           exclusão dos seus dados. Esta ação é IRREVERSÍVEL.</p>
        
        <div class="bg-red-50 rounded-2xl p-4 space-y-2">
            <div>👤 Seus dados pessoais (nome, email, telefone)</div>
            <div>💰 Todas as transações e dados financeiros</div>
            <div>🔑 Sua conta de acesso</div>
            <div>📊 Relatórios, metas, investimentos e configurações</div>
        </div>
        
        <label>Digite "EXCLUIR" para confirmar:</label>
        <input type="text" id="inputConfirmarExclusao" 
               placeholder="EXCLUIR" />
        
        <div class="flex gap-3">
            <button onclick="fecharModalExcluirConta()">Cancelar</button>
            <button onclick="executarExclusaoConta()" 
                    id="btnConfirmarExclusao">
                Excluir tudo
            </button>
        </div>
    </div>
</div>
```

```javascript
async function executarExclusaoConta() {
    if (!usuarioAtual) return;
    
    const input = document.getElementById('inputConfirmarExclusao').value;
    if (input.toUpperCase() !== 'EXCLUIR') {
        budShowToast('Digite "EXCLUIR" corretamente', 'erro');
        return;
    }
    
    const btn = document.getElementById('btnConfirmarExclusao');
    btn.disabled = true;
    btn.innerText = 'Excluindo...';
    
    try {
        const idToken = await usuarioAtual.getIdToken();
        
        // Cloud Function deleta tudo
        const res = await fetch(
            FUNCTIONS_URL + '/deletar-conta-completa',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + idToken
                },
                body: JSON.stringify({ uid: usuarioAtual.uid })
            }
        );
        
        if (res.ok) {
            budShowToast(
                'Sua conta foi excluída com sucesso. '
                + 'Você será redirecionado...',
                'sucesso'
            );
            
            // Aguarda 2s e redireciona
            setTimeout(async () => {
                await auth.signOut();
                window.location.href = 'index.html';
            }, 2000);
        } else {
            budShowToast('Erro ao excluir conta', 'erro');
        }
    } catch(err) {
        budShowToast('Erro: ' + err.message, 'erro');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Excluir tudo';
    }
}

function abrirModalExcluirConta() {
    document.getElementById('modalExcluirConta')
        .classList.remove('hidden');
    document.getElementById('modalExcluirConta')
        .classList.add('flex');
}

function fecharModalExcluirConta() {
    document.getElementById('modalExcluirConta')
        .classList.add('hidden');
    document.getElementById('inputConfirmarExclusao').value = '';
}
```

**Cloud Function backend** (`deletar-conta-completa`):
```typescript
// 1. Valida token Firebase
// 2. Deleta auth user
// 3. Deleta documento /usuarios/{uid}
// 4. Deleta todas subcollections:
//    - transacoes
//    - cartoes
//    - categorias
//    - investimentos
//    - metas
//    - dividas
//    - etc
// 5. Deleta storage (fotos, notas fiscais)
// 6. Log para compliance LGPD
// 7. Retorna sucesso
```

---

### 6️⃣ Card - Segurança e Conta

#### 6.1 Alterar Senha

```javascript
window.alterarSenha = async function() {
    if(!usuarioAtual) return;
    
    // Confirmação
    const ok = await new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.innerHTML = `
            <div class="modal">
                <p>Enviaremos um link de redefinição de senha para 
                   ${escapeHTML(usuarioAtual.email)}. Deseja continuar?</p>
                <button>Não</button>
                <button>Sim</button>
            </div>
        `;
        document.body.appendChild(ov);
    });
    
    if(ok) {
        auth.sendPasswordResetEmail(usuarioAtual.email)
            .then(() => {
                budShowToast(
                    'E-mail enviado com sucesso! '
                    + 'Verifique sua caixa de entrada.',
                    'sucesso'
                );
            })
            .catch(() => {
                budShowToast(
                    'Ocorreu um erro ao enviar o e-mail.',
                    'erro'
                );
            });
    }
};
```

**Fluxo**:
1. User clica "Alterar Senha"
2. Confirmação modal
3. Firebase envia email com link
4. User clica link → `acao-auth.html` com oobCode
5. User digita nova senha com
 indicador de força
6. Volta pra login

#### 6.2 Sair da Conta (Logout)

```javascript
window.fazerLogout = async function() {
    try {
        await auth.signOut();
        window.location.href = "index.html";
    } catch(err) {
        budShowToast('Erro ao sair: ' + err.message, 'erro');
    }
};
```

---

### 7️⃣ Card - Resetar Toda a Conta

**Propósito**: User recomeça do zero, MANTENDO a conta ativa (não deleta)

#### Modal

```html
<div id="modalReset" class="hidden fixed inset-0 z-[100]">
    <div class="bg-white rounded-3xl p-7 max-w-md w-full">
        <h3>Resetar toda a conta?</h3>
        <p>Essa ação não pode ser desfeita. 
           Todos os dados abaixo serão apagados permanentemente:</p>
        
        <div class="bg-red-50 rounded-2xl p-4 space-y-2">
            <div>🗑️ Todas as transações</div>
            <div>💳 Cartões cadastrados</div>
            <div>🏷️ Categorias personalizadas</div>
            <div>🏦 Investimentos</div>
            <div>🎯 Metas e limites</div>
            <div>📉 Dívidas</div>
            <div>⚙️ Configurações do perfil</div>
        </div>
        
        <p class="text-xs">Após o reset, você será redirecionado 
           para a tela inicial como um novo usuário.</p>
        
        <div class="flex gap-3">
            <button onclick="fecharModalReset()">Cancelar</button>
            <button onclick="executarReset()" id="btnConfirmarReset">
                Sim, resetar tudo
            </button>
        </div>
    </div>
</div>
```

```javascript
window.abrirModalReset = function() {
    document.getElementById('modalReset')
        .classList.remove('hidden');
    document.getElementById('modalReset')
        .classList.add('flex');
};

window.fecharModalReset = function() {
    document.getElementById('modalReset')
        .classList.add('hidden');
};

window.executarReset = async function() {
    if (!usuarioAtual) return;
    
    const btn = document.getElementById('btnConfirmarReset');
    btn.disabled = true;
    btn.innerText = 'Resetando...';
    
    try {
        const idToken = await usuarioAtual.getIdToken();
        
        // Cloud Function apaga dados
        const res = await fetch(
            FUNCTIONS_URL + '/resetar-conta',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + idToken
                },
                body: JSON.stringify({ uid: usuarioAtual.uid })
            }
        );
        
        if (res.ok) {
            budShowToast(
                'Conta resetada! Recarregando...',
                'sucesso'
            );
            setTimeout(() => {
                location.reload();
            }, 1500);
        } else {
            budShowToast('Erro ao resetar', 'erro');
        }
    } catch(err) {
        budShowToast('Erro: ' + err.message, 'erro');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Sim, resetar tudo';
    }
};
```

**Cloud Function backend** (`resetar-conta`):
```typescript
// 1. Valida token Firebase
// 2. Marca todos documentos das subcollections como deleted
// 3. OU deleta todas as subcollections:
//    - transacoes
//    - cartoes
//    - categorias
//    - investimentos
//    - metas
//    - dividas
//    - recorrentes
// 4. NÃO deleta:
//    - Dados do usuário (nome, email, plano, dark mode, etc)
//    - Histórico de login
// 5. Retorna sucesso
```

---

## 📊 Estado & Persistência

| Dados | Localização | Tipo | Key/Field |
|---|---|---|---|
| Plano atual | Firestore | Reference | `usuarios/{uid}.plano` |
| Trial status | Firestore | Field | `usuarios/{uid}.trialEndsAt` |
| Assinatura MP | Firestore | Object | `usuarios/{uid}.assinatura` |
| Modo escuro | LocalStorage | Boolean | `budDarkMode` |
| Foto de perfil | LocalStorage | DataURL | `nexo_foto_{uid}` |
| WhatsApp vinculado | Firestore | String | `usuarios/{uid}.whatsappVinculado` |
| Push token | Firestore | String | `usuarios/{uid}.pushToken` |
| Tutorial status | LocalStorage | Boolean | `tutorial_*_seen` |

---

## 🔄 Fluxos Técnicos Completos

### Upgrade de Plano
```
User clica "Upgrade para Pro"
    ↓
iniciarAssinatura('pro')
    ↓
POST /mercadopago/create-subscription
    ├─ planKey: 'pro'
    ├─ uid: usuarioAtual.uid
    └─ email: usuarioAtual.email
    ↓
Backend:
    ├─ Busca/cria preference no MP
    ├─ Retorna init_point (URL checkout)
    └─ Salva planoPendente no Firestore
    ↓
window.location.href = init_point
    ↓
User preenche dados no Mercado Pago
    ↓
Mercado Pago processa pagamento
    ↓
Se OK → volta com ?preapproval_id=XXXXX
    ↓
Firebase Webhook recebe confirmação
    ↓
Cloud Function atualiza Firestore:
    ├─ usuarios/{uid}.plano = 'pro'
    ├─ usuarios/{uid}.assinatura = { status: 'authorized', ... }
    └─ usuarios/{uid}.assinaturaMudouEm = now()
    ↓
User recarrega página
    ↓
Status muda: "👑 Plano Pro Ativo ✓"
```

### Cancelamento de Plano
```
User clica "Cancelar assinatura"
    ↓
Modal: "Tem certeza?"
    ↓
Se OK: cancelarAssinatura()
    ↓
POST /mercadopago/cancel-subscription
    ├─ uid: usuarioAtual.uid
    └─ preapprovalId: userData.assinatura.preapprovalId
    ↓
Backend:
    ├─ Chama MP API para cancelar subscription
    ├─ Atualiza Firestore: assinatura.status = 'cancelled'
    └─ Downgrade automático: plano = 'free'
    ↓
budShowToast("Assinatura cancelada...")
    ↓
location.reload()
    ↓
Page recarrega com plano = 'free'
```

### Exportar Meus Dados (LGPD)
```
User clica "Baixar meus dados"
    ↓
exportarMeusDados()
    ↓
Para cada collection:
    ├─ usuarios/{uid} >> objeto
    ├─ usuarios/{uid}/transacoes >> array
    ├─ usuarios/{uid}/cartoes >> array
    ├─ usuarios/{uid}/investimentos >> array
    ├─ usuarios/{uid}/metas >> array
    └─ usuarios/{uid}/dividas >> array
    ↓
Serializa em JSON com indentação
    ↓
Cria Blob
    ↓
Cria URL (ObjectURL)
    ↓
Simula click em <a download>
    ↓
Browser faz download:
    meus-dados-bud-<uid>-<timestamp>.json
    ↓
User recebe arquivo em seu PC
```

---

## 🎨 UX Detalhes

### Interações Principais

**Cards**:
- Hover: `border-color` muda ligeiramente, nada de transform
- Todos com rounded-2xl (32px) ou rounded-3xl (36px)

**Botões**:
- Primário (upgrade): gradient + shadow gradiente
- Secundário (desvincular): white com border, hover bg-red-50
- Cancelamento: red-600 background

**Modais**:
- Backdrop: `bg-black/50 backdrop-blur-sm`
- Overlay rígido
- Z-index: `z-[100]` (acima de tudo)
- Entrada: fade-in animation

**Toggle switch (dark mode)**:
- Width: 44px, Height: 24px
- Background: #cbd5e1 (off) ou gradient azul (on)
- Bolinha: 16px diameter, white, shadows
- Animation: smooth transition

### Responsividade

```css
Header: flex md:px-8 (8 tailwind = 32px)
Content: max-w-3xl mx-auto
Padding: p-4 (mobile) md:p-8 (desktop)
Grid: grid-cols-1 md:grid-cols-2 (onde usado)
```

---

## 🚀 Checklist de Implementação

- [ ] Verificar que todos os endpoints Cloud Functions estão implementados
- [ ] Testar fluxo de upgrade com Mercado Pago (sandbox)
- [ ] Testar notificações push em desktop e iOS
- [ ] Testar dark mode em todos os cards
- [ ] Testar exportação de dados LGPD (arquivo gerado corretamente)
- [ ] Testar exclusão de conta (Cloud Function remove tudo)
- [ ] Testar reset de conta (mantém usuário, deleta dados)
- [ ] Testar vinculação WhatsApp (salva no Firestore)
- [ ] Validar modais em mobile (não sai da tela)
- [ ] Testar tooltips/badges em dark mode

---

# 🐛 AUDITORIA DE ERROS — Tela de Configurações

> Auditoria realizada em 08/04/2026 — Arquivos analisados: `configuracoes.html`, `js/configuracoes.js`, `plan-utils.js`, `plano-config.js`

---

## Problemas Encontrados: 9

### 🔴 Problema #1 — GRAVE: Classes Tailwind Dinâmicas em 5 Modais de Confirmação

**Onde:** `js/configuracoes.js` — linhas 77, 358, 381, 597, 700 (cancelarAssinatura, desvincularWhatsApp, alterarSenha, fazerLogout, revogarConsentimentoNotificacoes)  
**O quê:** Todos os modais de confirmação usam `className` com valores arbitrários:
```javascript
ov.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
ov.innerHTML = '<div class="bg-white dark:bg-slate-800 rounded-2xl p-6 mx-4 max-w-sm w-full text-center shadow-xl">...';
```
`bg-black/50` e `z-[9999]` NÃO existem no build estático. Modais ficam **invisíveis ou atrás do conteúdo**.

**Impacto:** Diálogos de cancelar assinatura, logout, excluir conta, trocar senha — todos ficam invisíveis. Usuário não consegue executar ações críticas.

**🔧 SOLUÇÃO:**
Trocar em **todos os 5 locais** (linhas 77, 358, 381, 597, 700):
```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
```
Para o card interno, usar inline style também:
```javascript
const card = document.createElement('div');
card.style.cssText = 'background:var(--bg-card,#fff);border-radius:1rem;padding:1.5rem;margin:1rem;max-width:24rem;width:100%;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';
```

---

### 🔴 Problema #2 — GRAVE: Erro Genérico no `getIdToken()` (Assinatura)

**Onde:** `js/configuracoes.js` — linhas 46, 86 (iniciarAssinatura, cancelarAssinatura)  
**O quê:**
```javascript
try {
    var idToken = await usuarioAtual.getIdToken();
    var res = await fetch(FUNCTIONS_URL + '/mercadopago/create-subscription', { ... });
} catch (err) {
    console.error('Erro ao iniciar assinatura:', err);
}
```
Todos os erros são tratados igual. `getIdToken()` pode falhar por: rede, token expirado, conta deletada server-side.

**Impacto:** Usuário não consegue assinar/cancelar plano sem saber o motivo real.

**🔧 SOLUÇÃO:**
```javascript
try {
  var idToken;
  try {
    idToken = await usuarioAtual.getIdToken(true); // Force refresh
  } catch (tokenErr) {
    if (tokenErr.code === 'auth/network-request-failed') {
      budShowToast('Sem conexão. Verifique sua internet.', 'erro');
    } else {
      budShowToast('Sessão expirada. Faça login novamente.', 'erro');
      auth.signOut().then(() => { window.location.href = 'index.html'; });
    }
    return;
  }
  var res = await fetch(FUNCTIONS_URL + '/mercadopago/create-subscription', { ... });
  // ...
} catch (err) {
  budShowToast('Erro de conexão: ' + (err.message || ''), 'erro');
}
```

---

### 🔴 Problema #3 — GRAVE: Race Condition na Exclusão de Conta

**Onde:** `js/configuracoes.js` — linhas 769–788 (`executarExclusaoConta`)  
**O quê:** Dados do Firestore são deletados ANTES da conta de Auth:
```javascript
// 1. Deleta TODOS os dados do Firestore (metas, transações, etc.)
await db.collection('usuarios').doc(uid).delete();
// 2. DEPOIS tenta deletar conta Auth ← Se falhar, dados já foram!
await usuarioAtual.delete();
```
Se o passo 2 falha (ex: `requires-recent-login`), o usuário tem conta Auth ativa mas **nenhum dado**.

**Impacto:** Conta "órfã" — dados perdidos mas conta ainda existe. Violação LGPD (exclusão parcial). Re-login mostra conta vazia.

**🔧 SOLUÇÃO:**
Deletar Auth PRIMEIRO (menos reversível):
```javascript
try {
  var uid = usuarioAtual.uid;
  // PASSO 1: Deletar Auth primeiro
  await usuarioAtual.delete();
  // PASSO 2: Agora deletar dados (sem risco de orfandade)
  var colecoes = ['transacoes','cartoes','categorias','contas','dividas','investimentos','limites','metas','recorrentes'];
  for (var i = 0; i < colecoes.length; i++) {
    var snap = await db.collection('usuarios').doc(uid).collection(colecoes[i]).get();
    var batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  await db.collection('usuarios').doc(uid).delete();
  localStorage.clear();
  budShowToast('Conta excluída permanentemente.', 'sucesso');
  setTimeout(() => { window.location.href = 'index.html'; }, 1000);
} catch (err) {
  if (err.code === 'auth/requires-recent-login') {
    budShowToast('Sessão expirada. Faça login novamente para excluir.', 'erro');
    auth.signOut();
  }
}
```

---

### 🟡 Problema #4 — MÉDIO: Bypass de Plano no WhatsApp

**Onde:** `js/configuracoes.js` — linha 329 (`vincularWhatsApp`)  
**O quê:** O handler verifica plano apenas no carregamento da página, mas o onclick NÃO re-valida:
```javascript
window.vincularWhatsApp = async function() {
    if (!usuarioAtual) return;
    // NENHUMA verificação de plano aqui!
    await db.collection('usuarios').doc(usuarioAtual.uid).update({ whatsappVinculado: numero });
};
```
Se a assinatura expirou entre o load e o click, usuário free consegue usar feature Plus.

**Impacto:** Bypass de gating de plano — funcionalidade Plus disponível para free.

**🔧 SOLUÇÃO:**
```javascript
window.vincularWhatsApp = async function() {
  if (!usuarioAtual) return;
  // Re-validar plano a cada ação
  var userSnap = await db.collection('usuarios').doc(usuarioAtual.uid).get();
  var userData = userSnap.data() || {};
  var canWhatsApp = window.NexoPlanos?.canUseFeature?.(userData, 'whatsappAssistant') || false;
  if (!canWhatsApp) {
    budShowToast('WhatsApp disponível apenas no plano Plus.', 'erro');
    return;
  }
  // ... continua vinculação
};
```

---

### 🟡 Problema #5 — MÉDIO: Export de Dados Pode Travar (Datasets Grandes)

**Onde:** `js/configuracoes.js` — linhas 631–670 (`exportarMeusDados`)  
**O quê:** Sem verificação de tamanho dos dados antes de exportar:
```javascript
var snap = await db.collection('usuarios').doc(usuarioAtual.uid).collection(col).get();
// Sem limite! Pode ter >5000 documentos
XLSX.writeFile(wb, nomeArquivo); // Falha silenciosa se > 50MB
```

**Impacto:** Aba trava ou fechamento silencioso em datasets grandes. Nenhum feedback.

**🔧 SOLUÇÃO:**
```javascript
window.exportarMeusDados = async function() {
  var btn = document.getElementById('btnExportarDados');
  btn.disabled = true;
  btn.textContent = 'Exportando...';
  try {
    var wb = XLSX.utils.book_new();
    for (var i = 0; i < colecoes.length; i++) {
      var snap = await db.collection('usuarios').doc(usuarioAtual.uid).collection(colecoes[i]).limit(10000).get();
      if (snap.size > 5000) budShowToast(colecoes[i] + ': ' + snap.size + ' itens, pode demorar...', 'aviso');
      // ... continua export
    }
    XLSX.writeFile(wb, nomeArquivo);
    budShowToast('Dados exportados com sucesso!', 'sucesso');
  } catch (err) {
    budShowToast('Erro ao exportar: ' + err.message, 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Baixar meus dados';
  }
};
```

---

### 🟡 Problema #6 — MÉDIO: Reset de Conta Possível com Plano Pago Ativo

**Onde:** `js/configuracoes.js` — linhas 405–450 (`executarReset`)  
**O quê:** Nenhuma verificação de plano antes do reset:
```javascript
window.executarReset = async function() {
    if(!usuarioAtual) return;
    // SEM CHECK DE PLANO!
    // Deleta tudo e redireciona para onboarding
    window.location.href = 'onboarding.html';
};
```
Usuário com assinatura ativa perde todos os dados mas continua sendo cobrado.

**Impacto:** Perda de dados + cobrança contínua. Risco de chargeback.

**🔧 SOLUÇÃO:**
```javascript
window.executarReset = async function() {
  if (!usuarioAtual) return;
  var userSnap = await db.collection('usuarios').doc(usuarioAtual.uid).get();
  var userData = userSnap.data() || {};
  var plan = window.NexoPlanos?.resolvePlan?.(userData)?.effectivePlan || 'free';
  if (['starter','pro','plus','trial'].includes(plan)) {
    budShowToast('Cancele sua assinatura antes de fazer reset.', 'erro');
    return;
  }
  // ... continua reset
};
```

---

### 🟡 Problema #7 — MÉDIO: Verificação de Push Falha Offline

**Onde:** `js/configuracoes.js` — linhas 476–530 (`verificarEstadoPush`)  
**O quê:** Sem error handling no `.get()`:
```javascript
var tokenSnap = await db.collection('usuarios').doc(uid).collection('tokens').doc('fcm').get();
// Se offline → erro não tratado → estado do push nunca renderiza
```

**Impacto:** Estado das notificações fica em loading infinito quando offline.

**🔧 SOLUÇÃO:**
```javascript
try {
  var tokenSnap = await db.collection('usuarios').doc(uid).collection('tokens').doc('fcm').get();
  if (tokenSnap.exists && tokenSnap.data().token) {
    icone.innerText = '🔔'; status.innerText = 'Ativadas';
  } else {
    icone.innerText = '🔕'; status.innerText = 'Desativadas';
  }
} catch (err) {
  icone.innerText = '❓'; status.innerText = 'Offline';
}
```

---

### 🟡 Problema #8 — MÉDIO: Avatar Initials com Case Inconsistente

**Onde:** `js/configuracoes.js` — linhas 176–180  
**O quê:**
```javascript
document.getElementById('nomeUsuarioTopo').innerText = nomeParaMostrar.toLowerCase();
```
Nome sempre vai para minúsculas. "JOÃO SILVA" → "joão silva".

**Impacto:** UX inconsistente. Nomes próprios devem ter capitalização correta.

**🔧 SOLUÇÃO:**
```javascript
function capitalizar(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
document.getElementById('nomeUsuarioTopo').innerText = capitalizar(nomeParaMostrar);
```

---

### 🟢 Problema #9 — LEVE: Empty Catch em Reset/Perfil

**Onde:** `js/configuracoes.js` — linhas 436–439  
**O quê:**
```javascript
try { await db.collection('usuarios').doc(uid).collection('perfil').doc('config').delete(); } catch(e) {}
try { await db.collection('usuarios').doc(uid).update({ onboardingConcluido: false }); } catch(e) {}
```
Erros reais engolidos silenciosamente.

**Impacto:** Se a coleção perfil/config existir e falhar, nenhuma visibilidade.

**🔧 SOLUÇÃO:**
```javascript
try { await db.collection('usuarios').doc(uid).collection('perfil').doc('config').delete(); } catch(e) { console.warn('Reset perfil:', e.message); }
try { await db.collection('usuarios').doc(uid).update({ onboardingConcluido: false }); } catch(e) { console.warn('Reset onbrd:', e.message); }
```

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA
- [ ] Problema #1 — Trocar `className` por `style.cssText` nos 5 modais
- [ ] Problema #2 — Distinguir erros de `getIdToken()` com mensagens específicas
- [ ] Problema #3 — Inverter ordem: deletar Auth ANTES do Firestore

### 🟡 PRIORIDADE ALTA
- [ ] Problema #4 — Re-validar plano no onclick de vincularWhatsApp
- [ ] Problema #5 — Adicionar feedback e limites no export de dados
- [ ] Problema #6 — Bloquear reset se plano pago ativo
- [ ] Problema #7 — Error handling na verificação de push offline
- [ ] Problema #8 — Capitalização correta do nome no avatar

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #9 — Logging nos catch blocks de reset

---

## 📊 RESUMO DE MÉTRICAS

| Severidade | Quantidade |
|---|---|
| 🔴 GRAVE | 3 |
| 🟡 MÉDIO | 5 |
| 🟢 LEVE | 1 |
| **TOTAL** | **9** |

| Categoria | Bugs |
|---|---|
| Tailwind Dinâmico | #1 |
| Firebase (Auth/Token) | #2 |
| Race Condition (Exclusão) | #3 |
| Plan Gating | #4, #6 |
| Error Handling | #5, #7, #9 |
| UX | #8 |
