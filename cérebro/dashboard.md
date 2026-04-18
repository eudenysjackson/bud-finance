# 📊 Cérebro — Dashboard (`dashboard.html` + `js/dashboard.js`)

---

## 1. Visão Geral

O **Dashboard** é a tela principal do Bud Finanças — a home do app após login. Concentra o resumo financeiro completo do mês, atalhos de ação e widgets inteligentes.

**Seções (de cima para baixo):**

1. **Header fixo:** sidebar toggle, notificações (sino), ocultar valores (olho), sync, data de hoje, seletor de mês (desktop arrows / mobile calendar modal), streak widget, avatar com menu (perfil, foto, sair), indicar amigos
2. **Banner trial/plano:** contador regressivo do trial ou alerta de plano free/expirado
3. **Mobile welcome:** saudação + card do plano + botão upgrade
4. **Card Saldo:** gradiente colorido (verde/vermelho/azul por saldo), entradas, saídas, saldo com badge mês
5. **Grid 4 cards:** Nova Receita, Nova Despesa, Cartões (expandível), Metas (expandível)
6. **Banner confirmações pendentes:** receitas aguardando confirmação de valor real
7. **Grid 2 colunas:** Donut Chart (despesas por categoria canvas) + Barra de Orçamento mensal
8. **Contas vencidas:** despesas não pagas com data passada + parcelas de dívidas + recorrentes
9. **Lembretes 7 dias:** próximas contas a vencer
10. **"Tudo em dia":** aparece quando não há vencidas nem lembretes
11. **Comparativo vs Mês Anterior:** receitas, despesas, saldo % change
12. **Widget Meta Mais Próxima + Dica Financeira do Dia**
13. **Widget Investimentos + Economia Potencial**
14. **Lista de Atividades:** últimas 5 transações do mês
15. **Modais:** Nova Transação, Confirmar Receita, Confirmar Pendentes, Indicar Amigos, Seletor de Mês

**Acesso:** Autenticado. Redirect para `onboarding.html` se onboarding incompleto. Redirect para `index.html` se deslogado.

**Arquivos:**
- `dashboard.html` — 724 linhas
- `js/dashboard.js` — 1801 linhas (a maior do app)
- Deps: `firebase-config.js`, `bud-loader.js`, `bud-utils.js`, `plan-utils.js`, `plano-config.js`, `streak.js`, `sidebar.js`, `dark-mode.js`, `tutorial.js`, `tutorial-steps.js`, `tutorial-init.js`

---

## 2. Estrutura de Dados

### Firestore Listeners (7 onSnapshot)

| Collection | Limit | Dados carregados |
|---|---|---|
| `transacoes` | 5000 | Todas as transações → `transacoesGlobais[]` |
| `carteira` | 500 | Contas + cartões → `carteiraGlobal[]` |
| `categorias` | 200 | Categorias customizadas → `categoriasPersonalizadasDash[]` |
| `metas` | 500 | Metas financeiras → `metasGlobaisDash[]` |
| `recorrentes` | 500 | Recorrentes ativas → `recorrentesGlobaisDash[]` |
| `dividas` | 500 | Dívidas → `dividasGlobaisDash[]` |
| `investimentos` | 500 | Investimentos → `investimentosGlobaisDash[]` |

### Leitura On-Demand

| Doc | Quando |
|---|---|
| `usuarios/{uid}` | onAuthStateChanged — plano, trial, streak |
| `usuarios/{uid}/perfil/config` | onAuthStateChanged — onboarding, foto |
| `notificacoes-globais` (top 10) | Após auth — notificações in-app |
| `usuarios/{uid}/tokens/fcm` | Push setup |

### Escrita

| Ação | Doc |
|---|---|
| Nova transação | `addDoc(transacoes)` |
| Marcar pago | `updateDoc(transacoes/{id}, { pago: true })` |
| Confirmar receita | `updateDoc(transacoes/{id}, { valor, status, confirmadoEm })` |
| Descartar transação | `updateDoc(transacoes/{id}, { status: 'cancelada' })` |
| Atualizar carteira | `updateDoc(carteira/{id}, { saldo/faturaAtual/limiteDisponivel })` |
| Marcar parcela dívida | `updateDoc(dividas/{id}, { valorPago, parcelasPagas, jurosPagos })` |
| Downgrade plano | `updateDoc(usuarios/{uid}, { plano: 'free', ... })` |
| Salvar token FCM | `setDoc(tokens/fcm, { token, plataforma })` |
| Foto perfil | `updateDoc(perfil/config, { fotoBase64 })` |
| Streak | `updateDoc(usuarios/{uid}, { streakDias, streakUltimaAtividade })` |
| Código indicação | `updateDoc(usuarios/{uid}, { codigoIndicacao })` |

---

## 3. Fluxo Principal

```
1. onAuthStateChanged
   ├── !user → redirect index.html
   └── user:
       2. getDoc(perfil/config) → !onboardingConcluido → redirect onboarding.html
       3. Restaurar foto (localStorage → Firestore fallback)
       4. getDoc(usuarios/{uid}) → plano, trial
       5. resolvePlanSafely() → shouldDowngrade? → updateDoc plano='free'
       6. configurarBannerPlano()
       7. carregarNotificacoes()
       8. NexoPlanos.checkAndShowPlanWelcome()
       9. inicializarPush(uid) — FCM setup
       10. NexoStreak.process() + render
       11. Setup 7 onSnapshot listeners:
           - transacoes → renderizarDashboard() + atualizarContasVencer()
           - carteira → atualizarPainelCartoes()
           - categorias → atualizarDropdownCategorias()
           - metas → atualizarPainelMetas() + widgetMetaProxima
           - recorrentes → atualizarContasVencer()
           - dividas → atualizarContasVencer()
           - investimentos → widgetInvestimentos
```

---

## 4. Funções Principais (js/dashboard.js)

| Função | Descrição |
|---|---|
| `renderizarDashboard()` | Recalcula saldo/entradas/saídas, filtra por mês, atualiza todos os widgets |
| `atualizarGraficoCategorias()` | Desenha donut chart em Canvas com top 6 categorias de despesa |
| `atualizarBarraOrcamento()` | Barra de progresso gasto vs receita (verde/amarelo/vermelho) |
| `atualizarContasVencer()` | Cruza transações não pagas + recorrentes sem transação + parcelas dívidas |
| `atualizarComparativoMesAnterior()` | Compara receitas/despesas/saldo % com mês anterior |
| `atualizarDicaFinanceira()` | Dica contextual baseada nos dados reais do mês |
| `atualizarWidgetMetaProxima()` | Exibe meta com maior % de progresso (não 100%) |
| `atualizarWidgetInvestimentos()` | Resumo total investido + distribuição por tipo |
| `atualizarEconomiaPotencial()` | Sugere reduzir 15% nas 2 maiores categorias |
| `configurarBannerPlano()` | Banner trial (countdown), free (upgrade CTA) ou oculto (plano pago) |
| `carregarNotificacoes()` | Busca notificações globais filtradas por plano |
| `inicializarPush()` | Registra service worker, pede permissão, salva token FCM |
| `abrirModalIndique()` | Busca/gera código de indicação do Firestore |
| `marcarPagoDashboard()` | Marca transação como paga ou cria transação para recorrente |
| `marcarParcelaDividaDash()` | Paga próxima parcela de dívida com cálculo de juros |

---

## 5. Variáveis Globais

| Variável | Tipo | Descrição |
|---|---|---|
| `usuarioAtualId` | string | UID do Firebase Auth |
| `transacoesGlobais` | array | Todas as transações do user |
| `valoresOcultos` | boolean | Toggle de privacidade (default false) |
| `dataFiltro` | Date | Mês/ano selecionado para filtro |
| `carteiraGlobal` | array | Contas + cartões |
| `categoriasPersonalizadasDash` | array | Categorias customizadas |
| `metasGlobaisDash` | array | Metas financeiras |
| `recorrentesGlobaisDash` | array | Lançamentos recorrentes |
| `dividasGlobaisDash` | array | Dívidas |
| `investimentosGlobaisDash` | array | Investimentos |
| `perfilPlanoAtual` | object | Dados do plano do usuário |
| `_unsubs` | array | Array de unsubscribe functions dos listeners |
| `tipoAtual` | string | 'receita' ou 'despesa' (modal de transação) |

---

## 6. Bugs e Problemas

### 🔴 BUG 1 — `limit(5000)` sem `orderBy` nas transações

**Onde:** `js/dashboard.js` linha ~1275  
**Código atual:**
```javascript
_unsubs.push(onSnapshot(query(collection(db, "usuarios", user.uid, "transacoes"), limit(5000)), (snapshot) => {
```

**Problema:** Query com `limit(5000)` mas sem `orderBy`. O Firestore não garante ordem de retorno sem `orderBy`, e o limit pode cortar transações recentes se o user tiver >5000. Problema recorrente em todo o app.

Adicionalmente, **5000 transações são carregadas de uma vez** sem paginação. Cada transação é um documento Firestore — para um user ativo com 2+ anos de uso, isso pode significar ~3000-5000 docs lidos por page load. A cada refresh: 5000 leituras do Firestore = custo real.

**Impacto:** 🔴 Custo, performance, e possível perda de dados recentes em users com muitas transações.

🔧 **SOLUÇÃO:**
```javascript
// Adicionar orderBy + observar apenas mês atual + anterior (para comparativo)
const mesAtual = `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth()+1).padStart(2,'0')}`;
const mesAnterior = new Date(dataFiltro);
mesAnterior.setMonth(mesAnterior.getMonth() - 1);
const prefixoAnterior = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth()+1).padStart(2,'0')}`;

_unsubs.push(onSnapshot(
    query(collection(db, "usuarios", user.uid, "transacoes"),
        orderBy('dataCriacao', 'desc'),
        limit(1000)
    ), callback
));
```

---

### 🔴 BUG 2 — `setMonth()` mutação no `dataFiltro` causa skip de meses

**Onde:** `js/dashboard.js` `mudarMesFiltro()` linha ~375  
**Código atual:**
```javascript
window.mudarMesFiltro = function(direcao) {
    dataFiltro.setMonth(dataFiltro.getMonth() + direcao);
    atualizarTextosDeData();
    renderizarDashboard();
};
```

**Problema:** Se `dataFiltro` aponta para 31 de janeiro e o user clica "próximo mês":
- `setMonth(0 + 1)` → fevereiro
- Fevereiro não tem dia 31 → JavaScript avança para **3 de março**
- Mês de fevereiro é completamente pulado

Cenário real: User está em jan/2026 no dia 29, 30 ou 31 → clica "→" → março aparece ao invés de fevereiro.

**Impacto:** 🔴 Dados de fevereiro (ou outro mês curto) inacessíveis via navegação por setas.

🔧 **SOLUÇÃO:**
```javascript
window.mudarMesFiltro = function(direcao) {
    const novoMes = dataFiltro.getMonth() + direcao;
    const novoAno = dataFiltro.getFullYear();
    dataFiltro = new Date(novoAno, novoMes, 1); // Sempre dia 1
    atualizarTextosDeData();
    renderizarDashboard();
    atualizarPainelCartoes();
};
```

---

### 🔴 BUG 3 — `primeiroLogin` não verificado — senha temporária nunca forçada a trocar

**Onde:** `js/dashboard.js` `onAuthStateChanged` (não existe verificação)  

**Problema:** Documentado em detalhes no [cérebro/trocar-senha.md](cérebro/trocar-senha.md) Bug 1. O dashboard não verifica `primeiroLogin === true`, então o user fica usando a senha temporária enviada em plaintext por email.

**Impacto:** 🔴 Segurança — senhas temporárias perpetuadas.

🔧 **SOLUÇÃO:**
```javascript
// Após getDoc(usuarios/{uid}), antes de configurar a tela:
if (userData.primeiroLogin === true) {
    window.location.href = 'trocar-senha.html';
    return;
}
```

---

### 🟡 BUG 4 — `valoresOcultos` não persiste entre sessões

**Onde:** `js/dashboard.js` linha ~380  
**Código atual:**
```javascript
window.toggleOcultarValores = function() {
    valoresOcultos = !valoresOcultos;
    renderizarDashboard();
}
```

**Problema:** A variável `valoresOcultos` é apenas em memória. Refresh da página → valores visíveis novamente. Se o user está em público e oculta os valores, qualquer refresh expõe tudo.

**Impacto:** 🟡 Privacidade — toggle não persiste.

🔧 **SOLUÇÃO:**
```javascript
// Inicializar a partir do localStorage
let valoresOcultos = localStorage.getItem('bud_valores_ocultos') === 'true';

window.toggleOcultarValores = function() {
    valoresOcultos = !valoresOcultos;
    localStorage.setItem('bud_valores_ocultos', valoresOcultos);
    renderizarDashboard();
}
```

---

### 🟡 BUG 5 — `sincronizarDados()` é fake — só re-renderiza

**Onde:** `js/dashboard.js` linha ~381  
**Código atual:**
```javascript
window.sincronizarDados = function() { renderizarDashboard(); }
```

**Problema:** O botão de sync (ícone de refresh no header) executa `renderizarDashboard()` que apenas re-processa os dados já em memória (`transacoesGlobais`). Não re-fetcha dados do Firestore, não verifica conectividade, não limpa cache.

O user pensa que está sincronizando com o server — na verdade está apenas re-renderizando o mesmo array.

**Impacto:** 🟡 UX enganosa — botão de sync não sincroniza.

🔧 **SOLUÇÃO:**
```javascript
window.sincronizarDados = function() {
    // Re-criar listeners para forçar re-fetch
    _unsubs.forEach(fn => fn());
    _unsubs = [];
    // Re-inicializar listeners (mesma lógica do onAuthStateChanged)
    setupListeners(auth.currentUser.uid);
    budShowToast('Dados sincronizados!', 'sucesso');
}
```

---

### 🟡 BUG 6 — Donut chart expõe valores reais quando `valoresOcultos` está ativo

**Onde:** `js/dashboard.js` `atualizarGraficoCategorias()`  
**Código atual:**
```javascript
const textoValor = valoresOcultos ? '•••' : formatarValor(total);
```

**Problema:** O texto central do donut é ofuscado (OK), mas a **legenda ao lado** mostra as percentagens que, combinadas com o total exibido em outra parte da tela, permitem inferir os valores:
```
Mercado  38%
Aluguel  25%
Uber     12%
```

Se alguém vê que "Saídas R$ •••••" e as percentagens, pode estimar valores com base no chart. Além disso, o `Canvas draw` renderiza fatias proporcionais visuais.

**Impacto:** 🟡 Privacidade parcialmente vazada.

🔧 **SOLUÇÃO:**
```javascript
if (valoresOcultos) {
    // Esconder gráfico inteiro quando valores ocultos
    container.classList.add('hidden');
    vazio.classList.remove('hidden');
    vazio.querySelector('p').textContent = 'Valores ocultos';
    return;
}
```

---

### 🟡 BUG 7 — Comparativo mês anterior inclui transações pendentes/não pagas

**Onde:** `js/dashboard.js` `atualizarComparativoMesAnterior()` linhas ~1002-1015  
**Código atual:**
```javascript
transAnterior.forEach(t => {
    if (t.tipo === 'receita' && t.confirmado !== false) recAnterior += (t.valor || 0);
    else if (t.tipo === 'despesa') {
        const ehCC = Boolean(t.cartaoId) && !t.pagamentoFatura;
        if (!ehCC) despAnterior += (t.valor || 0);
    }
});
```

**Problema:** Não filtra `t.pago !== false` para despesas. Transações pendentes (futuras, não pagas) do mês anterior inflam o comparativo. Receitas filtram `confirmado !== false` mas despesas não filtram `pago !== false`.

**Impacto:** 🟡 Dados inconsistentes do mês anterior distorcem a comparação.

🔧 **SOLUÇÃO:**
```javascript
transAnterior.forEach(t => {
    const isPago = t.pago !== false;
    if (t.tipo === 'receita' && t.confirmado !== false && isPago) recAnterior += (t.valor || 0);
    else if (t.tipo === 'despesa' && isPago) {
        const ehCC = Boolean(t.cartaoId) && !t.pagamentoFatura;
        if (!ehCC) despAnterior += (t.valor || 0);
    }
});
```

---

### 🟡 BUG 8 — 7 listeners `onSnapshot` simultâneos para uma única tela

**Onde:** `js/dashboard.js` linhas ~1275-1310  

**Problema:** O dashboard abre **7 real-time listeners** ao mesmo tempo:
1. transacoes (limit 5000)
2. carteira (limit 500)
3. categorias (limit 200)
4. metas (limit 500)
5. recorrentes (limit 500)
6. dividas (limit 500)
7. investimentos (limit 500)

Cada onSnapshot mantém uma conexão WebSocket ativa com o Firestore. Qualquer mudança em qualquer collection dispara callbacks que re-renderizam widgets. Em mobile, isso:
- Consome bateria (7 websockets ativos)
- Custo de leituras Firestore acumulado
- Re-renders desnecessários quando muda uma meta mas o user está olhando o saldo

A maioria dessas coleções poderia ser `getDoc`/`getDocs` com refresh manual/por ação.

**Impacto:** 🟡 Performance e custo — overdose de real-time listeners.

🔧 **SOLUÇÃO:**
```javascript
// Apenas transacoes e carteira precisam de real-time (afetam saldo/faturas)
// Metas, categorias, dividas, investimentos, recorrentes: getDocs on-demand
const metasSnap = await getDocs(query(collection(db, "usuarios", uid, "metas"), limit(500)));
metasGlobaisDash = metasSnap.docs.map(d => ({...d.data(), id: d.id}));
atualizarPainelMetas();
```

---

### 🟡 BUG 9 — `alert()` e `confirm()` usados em modal de confirmação

**Onde:** `js/dashboard.js` funções `confirmarTransacao()` e `descartarTransacao()`  
**Código:**
```javascript
if (valorReal <= 0) {
    alert('Por favor, informe um valor válido.');
    return;
}
// ...
if (!confirm('Tem certeza que deseja descartar esta transação?...')) return;
```

**Problema:** `alert()` e `confirm()` bloqueiam a thread da UI e são visualmente inconsistentes com o design system do app (que usa `budShowToast` em todo lugar). Quebram a experiência glassmorphic premium.

**Impacto:** 🟡 UX — dialogs nativos feios em um app premium.

🔧 **SOLUÇÃO:** Substituir por `budShowToast` e modal de confirmação custom (padrão usado no `btnMenuSair`).

---

### 🟡 BUG 10 — Código de indicação gerado a partir do UID — previsível

**Onde:** `js/dashboard.js` `abrirModalIndique()` linha ~340  
**Código:**
```javascript
if (!codigo) {
    codigo = uid.substring(0, 8).toUpperCase();
    updateDoc(doc(db, 'usuarios', uid), { codigoIndicacao: codigo }).catch(() => {});
}
```

**Problema:** O código de indicação é os primeiros 8 chars do UID em uppercase. UIDs do Firebase Auth são:
- Previsíveis se o atacante conhece a estrutura
- Colisão possível (dois UIDs que començam igual)
- Não-aleatório

Se alguém descobrir o UID de um user (que pode vazar em logs, referrals, etc.), pode gerar o código de indicação e usá-lo fraudulentamente.

**Impacto:** 🟡 Código de indicação não é seguro.

🔧 **SOLUÇÃO:**
```javascript
if (!codigo) {
    // Gerar código aleatório seguro
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 1, 0 para evitar confusão
    codigo = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => chars[b % chars.length]).join('');
    updateDoc(doc(db, 'usuarios', uid), { codigoIndicacao: codigo }).catch(() => {});
}
```

---

### 🟢 BUG 11 — Foto de perfil salva como base64 no Firestore — custo e tamanho

**Onde:** `js/dashboard.js` handler do `inputFoto`  
**Código:**
```javascript
const imagemComprimida = canvas.toDataURL('image/jpeg', 0.7);
// ...
await updateDoc(doc(db, 'usuarios', usuarioAtualId, 'perfil', 'config'), {
    fotoBase64: imagemComprimida
});
```

**Problema:** A foto é redimensionada para max 200px e comprimida a 70% JPEG, mas ainda assim salva como string base64 no Firestore. Base64 é ~33% maior que binário. Um avatar de 200x200 JPEG 70% ≈ 15-30KB → base64 ≈ 20-40KB por documento.

O Firestore cobra por tamanho de documento e por leitura. Cada vez que a foto é lida (getDoc), esses ~40KB são transferidos.

Deveria usar Firebase Storage com URL.

**Impacto:** 🟢 Custo e performance — base64 no Firestore é ineficiente.

---

### 🟢 BUG 12 — Transações mostram apenas últimas 5 sem "ver mais"

**Onde:** `js/dashboard.js` `renderizarDashboard()` linha ~488
**Código:**
```javascript
transacoesDoMes.slice(0, 5).forEach(t => { ... });
```

**Problema:** Apenas 5 transações são exibidas com link "Ver extrato" para o extrato completo. Isso é um design choice, mas se o user tem 20 transações no mês e quer um overview rápido, 5 é pouco. Outros dashboards financeiros mostram 10-15.

**Impacto:** 🟢 UX leve — link para extrato mitiga.

---

### 🟢 BUG 13 — Downgrade usa `new Date().toISOString()` — hora do cliente

**Onde:** `js/dashboard.js` linhas ~1225-1230  
**Código:**
```javascript
await updateDoc(doc(db, 'usuarios', user.uid), {
    plano: 'free',
    downgradeEm: new Date().toISOString(),
    // ...
});
```

**Problema:** O timestamp de downgrade usa o relógio do cliente. `serverTimestamp()` está importado mas não usado aqui. Inconsistência com outras operações que usam `serverTimestamp()`.

**Impacto:** 🟢 Timestamp impreciso — menor, pois é apenas registro.

🔧 **SOLUÇÃO:** `downgradeEm: serverTimestamp()`

---

### 🟢 BUG 14 — `parseDinheiro()` referenciado mas não definido no dashboard.js

**Onde:** `js/dashboard.js` `calcularDiferenca()` e `confirmarTransacao()`  
**Código:**
```javascript
const valorReal = parseDinheiro(inputValor);
```

**Problema:** `parseDinheiro` não está definida no dashboard.js — presumivelmente vem de `bud-utils.js`. Se `bud-utils.js` não exportar essa função globalmente, a confirmação de transação pendente crashará com `ReferenceError: parseDinheiro is not defined`.

**Impacto:** 🟢 Potencial crash na funcionalidade de confirmação.

🔧 **SOLUÇÃO:** Verificar se `bud-utils.js` expõe `window.parseDinheiro` ou usar fallback inline:
```javascript
const parseDinheiro = window.parseDinheiro || function(str) {
    return parseFloat(str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};
```

---

### 🟢 BUG 15 — Economia Potencial sempre sugere "reduzir 15%" — conselho genérico

**Onde:** `js/dashboard.js` `atualizarEconomiaPotencial()`  
**Código:**
```javascript
const economiaTotal = top.reduce((s, [, v]) => s + v * 0.15, 0);
```

**Problema:** O widget sempre sugere reduzir 15% das 2 maiores categorias. Não importa se a categoria é "Aluguel" (impossível reduzir) ou "Delivery" (possível). O conselho é cego ao contexto.

Se as 2 maiores são "Aluguel" e "Faculdade", sugerir reduzir 15% é inútil e pode frustrar o user.

**Impacto:** 🟢 UX — conselho genérico pode parecer irrelevante.

---

## 7. Checklist de Correções

| # | Severidade | Bug | Esforço |
|---|---|---|---|
| 1 | 🔴 | limit(5000) sem orderBy | Médio |
| 2 | 🔴 | setMonth() pula meses | Baixo |
| 3 | 🔴 | primeiroLogin não verificado | Baixo |
| 4 | 🟡 | valoresOcultos não persiste | Baixo |
| 5 | 🟡 | sincronizarDados fake | Médio |
| 6 | 🟡 | Donut chart vaza valores com privacy | Baixo |
| 7 | 🟡 | Comparativo inclui pendentes | Baixo |
| 8 | 🟡 | 7 onSnapshot listeners simultâneos | Alto |
| 9 | 🟡 | alert()/confirm() nativos | Baixo |
| 10 | 🟡 | Código indicação previsível | Baixo |
| 11 | 🟢 | Foto base64 no Firestore | Médio |
| 12 | 🟢 | Apenas 5 transações listadas | Baixo |
| 13 | 🟢 | Downgrade com client timestamp | Baixo |
| 14 | 🟢 | parseDinheiro não definido | Baixo |
| 15 | 🟢 | Economia Potencial genérica | Médio |

---

## 8. Métricas

| Métrica | Valor |
|---|---|
| Total de bugs | **15** |
| 🔴 Críticos | 3 |
| 🟡 Altos | 7 |
| 🟢 Baixos | 5 |
| Linhas HTML | 724 |
| Linhas JS | 1801 |
| Firestore listeners | 7 (onSnapshot) |
| Firestore reads (on-demand) | 3 (usuarios, perfil/config, notificacoes-globais) |
| Modais | 5 (transação, confirmar receita, confirmar pendentes, indicar, seletor mês) |
| Widgets | 8 (saldo, donut, orçamento, vencidas, lembretes, comparativo, meta, investimentos, economia) |
| Deps externas | 11 scripts carregados |

---

## 💚 Pontos Positivos

1. **Tela mais completa do app** — Resumo financeiro rico com 8+ widgets contextuais
2. **XSS protection** — `escapeHTML()` usado em todas as interpolações de dados do user
3. **Compras de crédito excluídas do saldo** — `cartaoId && !pagamentoFatura` não afeta saldo geral
4. **Contas vencidas integradas** — Cruza 3 fontes: transações não pagas + recorrentes sem transação + parcelas de dívidas
5. **Dicas contextuais** — Baseadas nos dados reais (top categoria, relação gasto/receita)
6. **Pagamento de fatura inteligente** — Restaura limite do cartão + debita da fonte de pagamento
7. **Confirmação de receita** — Permite ajustar valor real vs. previsto com registro de diferença
8. **Push notifications (FCM)** — Notificações nativas via Service Worker, funciona em mobile
9. **Streak system** — Gamificação para engajamento diário
10. **Cleanup de listeners** — `_unsubs` array com unsubscribe no logout e re-auth
11. **Banner trial com countdown** — Timer ao vivo mostrando tempo restante do trial
12. **Avatar com upload local** — Comprime para 200px JPEG, fallback Firestore → localStorage
# 📋 Tela de Dívidas - Documentação Técnica

## 1. Visão Geral da Tela

A tela **Dívidas** (`dividas.html` + `js/dividas.js`) é um **sistema completo de gerenciamento de débitos e empréstimos**, permitindo ao usuário:

- ✅ Cadastrar dívidas (empréstimos, financiamentos, cartões, etc.)
- ✅ Importar dados de contratos via IA (PDF, imagem, texto)
- ✅ Definir parcelas com **Tabela Price** (juros compostos mensais)
- ✅ Marcar parcelas como pagas (atualiza saldo no Firestore)
- ✅ Visualizar detalhes detalhados e simulações
- ✅ Rastrear juros pagos e saldo devedor

**Acesso:** Via Sidebar → "Dívidas" ou diretamente em `dividas.html`

**Dados Firestore:** `usuarios/{uid}/dividas/{dividaId}`

---

## 2. Estrutura de Dados - Documento Dívida

Cada dívida é armazenada em `usuarios/{uid}/dividas/{dividaId}`:

```javascript
{
  // Identificação
  nome: "Empréstimo Pessoal - Nubank",
  tipoIcone: "💰",
  tipo: "Empréstimo Pessoal", // ou "Financiamento", "Cartão Parcelado", etc.
  instituicao: "Nubank",
  
  // Valores principais
  valorTotal: 5000.00,          // Principal (valor do empréstimo/dívida total)
  valorPago: 1500.00,           // Total já pago
  jurosPagos: 45.50,            // Total de juros já pagos
  
  // Parcelas
  parcelas: 12,                 // Número total de parcelas
  parcelasPagas: 3,             // Quantas parcelas foram marcadas como pagas
  valorParcela: 450.00,         // Valor NOMINAL de cada parcela (com juros)
  
  // Taxas
  juros: 3.5,                   // Taxa de juros mensal (%)
  cet: 4.2,                     // Custo Efetivo Total anual (% a.a.)
  iof: 50.00,                   // IOF (Imposto sobre Operações Financeiras)
  seguro: 0,                    // Seguro da dívida
  
  // Datas
  vencimento: "2025-04-15",     // Data da PRIMEIRA parcela
  criadoEm: Timestamp,
  atualizadoEm: Timestamp,
  
  // Formato de pagamento
  formato: "parcelas"           // ou "aberto" (sem vencimento específico)
}
```

### 2.1 Tipos de Dívida (Reconhecimento IA)

Ao importar um contrato, a IA classifica automaticamente:

| Tipo | Ícone | Palavras-chave Detectadas |
|---|---|---|
| Empréstimo Pessoal | 💰 | empréstimo, crédito pessoal, consignado, CDC |
| Financiamento | 🏠 | financiamento, imobiliário, veículo, SFH, SFI |
| Cartão Parcelado | 💳 | fatura, cartão, parcelamento, anuidade |
| Consórcio | 🤝 | consórcio, contemplação, lance |
| Aluguel | 🏘️ | aluguel, locação, inquilino, caução |
| Dívida Informal | 🤙 | emprestei, devo, amigo, familiar |

---

## 3. Fluxo de Cadastro Manual

### Passo 1: Selecionar Tipo

```
[Modal] Qual é o tipo de dívida?
├─ 💰 Empréstimo Pessoal
├─ 🏠 Financiamento
├─ 💳 Cartão Parcelado
├─ 🤝 Consórcio
├─ 🏘️  Aluguel
├─ 🤙 Dívida Informal
└─ 📋 Manualmente (pulo direto ao form)
```

**HTML:** `modalTipo` → função `abrirFormManual()` ou próximo passo

### Passo 2: Selecionar Formato (se aplicável)

```
[Modal] Como será pago?
├─ 📦 Parcelas (12x, 24x, etc) → Abre form parcelado
└─ 💳 Aberto (livre) → Form sem parcelas
```

**HTML:** `modalFormato`

### Passo 3: Preencher Formulário

**Form Manual** (`modalDivida`):

```html
<form id="formDivida">
  <input type="hidden" id="dividaId">
  
  <!-- Identificação -->
  <input id="dividaNome" placeholder="Nome da dívida" required>
  <input id="dividaInstituicao" placeholder="Instituição/Credor" />
  <select id="dividaTipo"> <!-- Pre-preenchido do Passo 1 -->
  
  <!-- Valor -->
  <input id="dividaValorTotal" mask="BRL" placeholder="R$ 0,00" required>
  <input id="dividaValorPago" mask="BRL" placeholder="R$ 0,00">
  
  <!-- Parcelas -->
  <input id="dividaParcelas" type="number" placeholder="Número de parcelas" />
  <input id="dividaValorParcela" mask="BRL" placeholder="Valor de cada parcela" />
  <input id="dividaParcelasPagas" type="number" placeholder="Já pagou quantas?" />
  
  <!-- Juros -->
  <input id="dividaJuros" mask="0.00%" placeholder="Taxa mensal (%)" />
  <input id="dividaCET" mask="0.00%" placeholder="CET anual (%)" />
  <input id="dividaIOF" mask="BRL" placeholder="IOF" />
  <input id="dividaSeguro" mask="BRL" placeholder="Seguro" />
  
  <!-- Data -->
  <input id="dividaVencimento" type="date" />
  
  <button type="submit">Salvar Dívida</button>
</form>
```

**Submissão:**

```javascript
formDivida.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Calcular juros pagos usando Tabela Price
  let jurosPagosCalc = 0;
  const taxaMensal = (dados.juros || 0) / 100;
  let saldo = dados.valorTotal;
  
  for(let i = 0; i < dados.parcelasPagas; i++) {
    const jurosParcela = saldo * taxaMensal;
    const amortizacao = valorParcela - jurosParcela;
    jurosPagosCalc += jurosParcela;
    saldo = Math.max(0, saldo - amortizacao);
  }
  
  const dados = {
    nome, instituicao, tipo, tipoIcone,
    valorTotal, valorPago,
    parcelas, parcelasPagas, valorParcela,
    juros, jurosPagos: jurosPagosCalc,
    vencimento,
    atualizadoEm: serverTimestamp()
  };
  
  // Salvar ou atualizar
  const id = document.getElementById('dividaId').value;
  if(id) {
    await updateDoc(doc(db,"usuarios",currentUser.uid,"dividas",id), dados);
  } else {
    await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), {
      ...dados,
      criadoEm: serverTimestamp()
    });
  }
  
  fecharTodosModais();
});
```

---

## 4. Importação via IA (Leitor de Contratos)

### 4.1 Abrir Modal IA

```javascript
window.abrirImportIA = function() {
  fecharModalGenerico('modalFormato');
  resetImportIA();
  abrirModalGenerico('modalImportIA');
};
```

**Modal com 3 abas:**

| Aba | Input | Processamento |
|---|---|---|
| **📄 Arquivo** | Upload PDF/Imagem | Extrai texto via PDF.js ou Tesseract OCR |
| **📝 Colar Texto** | Textarea com contrato copiado | Regex simples no texto |
| **📷 Câmera** | Captura foto do contrato | Tesseract.js (OCR em time real) |

### 4.2 Classificação Automática do Contrato

Após extrair texto, a função `classificarContrato(texto)` retorna:

```javascript
{
  tipo: "Empréstimo Pessoal",
  icone: "💰",
  confianca: 85,              // % de confiabilidade
  detalhes: ["empréstimo", "crédito consignado"] // Palavras encontradas
}
```

**Lógica:**
```javascript
const TIPOS_CONTRATO = {
  'Empréstimo Pessoal': {
    icone: '💰',
    palavras: ['empréstimo', 'emprestimo', 'crédito pessoal', 'consignado', ...]
  },
  'Financiamento': {
    icone: '🏠',
    palavras: ['financiamento', 'imobiliário', 'veículo', ...]
  },
  // ... outros tipos
};

// Para cada tipo, conta quantas palavras-chave encontra no texto
// Tipo com maior score vence
```

### 4.3 Extração de Dados via Regex

A função `extrairDadosDoTexto(texto)` busca padrões:

| Campo | Regex Exemplo | Resultado |
|---|---|---|
| **Valor Total** | `valor total.*?R\$?\s*([\d.,]+)` | 5000.00 |
| **Parcelas** | `(\d+)\s*x\s*(?:de\s*)?R\$?\s*([\d.,]+)` | 12 x 450.00 |
| **Juros Mensal** | `taxa.*?juros.*?([\d.,]+)\s*%` | 3.5% a.m. |
| **CET Anual** | `CET.*?([\d.,]+)\s*%.*?ao\s*ano` | 4.2% a.a. |
| **IOF** | `IOF[:\s]*R\$?\s*([\d.,]+)` | 50.00 |
| **Data Vencimento** | `vencimento.*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})` | 2025-04-15 |

**Exemplo de OCR com problemas:**
```
Input (OCR bugado):
  "TAXA DE JUROS: 3,O3% AO MÊS"  ← "O" em vez de "0"
  
Solução:
  - Normalizar acentos: .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  - Substituir 'O' por '0' em números
  - Aceitar padrões com espaços: "CET) 3,03% ao mês 3,34%" ← pega o 2º %
```

### 4.4 Preview e Confirmação

Após extração, mostra modal com dados pre-preenchidos:

```javascript
function mostrarPreviewIA(dados, classif, extras) {
  // Preview: tipo detectado, valores, confiança
  // Usuário pode aceitar ou editar campos
  
  // Se clicar "Confirmar", já abre o form com dados pre-preenchidos
  abrirFormManual(); // Form vem com dados.valorTotal, dados.parcelas, etc.
}
```

---

## 5. Tabela Price e Cálculo de Juros

A aplicação usa o **sistema francês de amortização (Tabela Price)** para calcular juros mensais.

### 5.1 Fórmula

**Parcela fixa:**
$$P = \frac{V \times i}{1 - (1+i)^{-n}}$$

Onde:
- $P$ = valor da parcela
- $V$ = valor total (principal)
- $i$ = taxa mensal (em decimal, ex: 0.035 para 3.5%)
- $n$ = número de parcelas

**Exemplo:** V=5000, i=0.035, n=12
$$P = \frac{5000 \times 0.035}{1 - (1.035)^{-12}} = 450.00$$

### 5.2 Cálculo de Juros por Parcela

Para cada mês $k$ (0-indexed):

1. **Juros do mês:** $J_k = S_k \times i$ (saldo anterior × taxa)
2. **Amortização:** $A_k = P - J_k$ (parcela - juros)
3. **Novo saldo:** $S_{k+1} = S_k - A_k$ (saldo - amortização)

**Implementação:**

```javascript
function calcularTabelaPrice(valorTotal, taxaMensal, parcelas) {
  const valorParcela = valorTotal * taxaMensal / (1 - Math.pow(1 + taxaMensal, -parcelas));
  
  let saldo = valorTotal;
  let saldos = [saldo]; // Pre-calcular para depois
  
  for(let j = 0; j < parcelas; j++) {
    const juros = saldo * taxaMensal;
    saldo = Math.max(0, saldo - (valorParcela - juros));
    saldos.push(saldo);
  }
  
  return { valorParcela, saldos };
}
```

### 5.3 Ao Marcar Parcela Como Paga

Quando usuário marca parcela `i` como paga:

```javascript
window.marcarParcelaPaga = async function(dividaId, indiceParc) {
  const d = dividas.find(x => x.id === dividaId);
  
  // Validação: só marca a PRÓXIMA parcela pendente
  if(indiceParc !== (d.parcelasPagas||0)) {
    budShowToast('Pague as parcelas em ordem!', 'warning');
    return;
  }
  
  const taxaMensal = (d.juros||0) / 100;
  const valorParcela = d.valorParcela || (d.parcelas > 0
    ? (taxaMensal > 0 
        ? (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -d.parcelas))
        : d.valorTotal / d.parcelas)
    : 0);
  
  // Calcular saldo no início desta parcela (Tabela Price)
  let saldo = d.valorTotal;
  for(let i = 0; i < indiceParc; i++) {
    const j = saldo * taxaMensal;
    saldo = Math.max(0, saldo - (valorParcela - j));
  }
  
  // Juros desta parcela
  const jurosDaParcela = taxaMensal > 0 ? saldo * taxaMensal : 0;
  
  // Atualizar no Firestore
  await updateDoc(doc(db,"usuarios",currentUser.uid,"dividas",dividaId), {
    valorPago: Math.min(d.valorTotal, (d.valorPago||0) + valorParcela),
    parcelasPagas: (d.parcelasPagas||0) + 1,
    jurosPagos: (d.jurosPagos||0) + jurosDaParcela,
    atualizadoEm: serverTimestamp()
  });
  
  // Re-abrir modal atualizado
  setTimeout(() => abrirDetalhes(dividaId), 300);
};
```

---

## 6. Modal de Detalhes da Dívida

### 6.1 Abrir Detalhes

```javascript
window.abrirDetalhes = function(dividaId) {
  dividaAtual = dividas.find(d => d.id === dividaId);
  
  const d = dividaAtual;
  const falta = d.valorTotal - (d.valorPago||0);
  const perc = d.valorTotal > 0 ? ((d.valorPago||0)/d.valorTotal*100) : 0;
  
  // Preenchimento da UI
  document.getElementById('detNome').innerHTML = `${escapeHTML(d.tipoIcone||'📋')} ${escapeHTML(d.nome)}`;
  document.getElementById('detPerc').innerText = perc.toFixed(0) + '%';
  document.getElementById('detBarra').style.width = Math.min(100,perc).toFixed(0)+'%';
  document.getElementById('detValorOriginal').innerText = fmt(d.valorTotal);
  document.getElementById('detSaldoDevedor').innerText = fmt(Math.max(0, falta));
  document.getElementById('detTotalPago').innerText = fmt(d.valorPago||0);
  document.getElementById('detJurosPagos').innerText = fmt(d.jurosPagos||0);
  
  renderizarParcelas(d);
  abrirModalGenerico('modalDetalhes');
};
```

### 6.2 Abas: Resumo | Parcelas

**Aba Resumo:**
- Progresso visual (barra)
- Valor original, saldo devedor, total pago, juros pagos
- Tipo, parcelas e informações gerais

**Aba Parcelas:**
Renderiza lista de todas as parcelas:

```
#1  | 15/04/2025 | ✓ Paga  | Total: R$ 450 | Juros: R$ 157.50 | Amort: R$ 292.50
#2  | 15/05/2025 | ⏳ Pendente | Total: R$ 450 | Juros: R$ 150.00 | Amort: R$ 300.00
#3  | 15/06/2025 | ⏳ Pendente | Total: R$ 450 | ...
```

Cada parcela tem:
- **Checkbox** (clicável):
  - Sem marcar → `marcarParcelaPaga(dividaId, índice)`
  - Marcado ✅ → `desmarcarParcela(dividaId, índice)` (com confirmação)

---

## 7. Desmarcar Parcela (Desfazer Pagamento)

```javascript
window.desmarcarParcela = async function(dividaId, indiceParc) {
  const d = dividas.find(x => x.id === dividaId);
  
  // Só permite desmarcar a ÚLTIMA parcela paga
  if(indiceParc !== (d.parcelasPagas||0) - 1) {
    budShowToast('Só é possível desmarcar a última parcela paga.', 'warning');
    return;
  }
  
  // Modal de confirmação (com overlay escuro)
  const ok = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;max-width:376px;text-align:center">
        <p style="font-size:18px;font-weight:bold;margin-bottom:16px">Desmarcar parcela</p>
        <p style="font-size:14px;color:#6b7280;margin-bottom:24px">Desmarcar esta parcela como paga?</p>
        <div style="display:flex;gap:12px">
          <button onclick="..." style="flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:8px">Cancelar</button>
          <button onclick="..." style="flex:1;padding:10px;background:#f59e0b;color:white;border-radius:8px;font-weight:bold">Desmarcar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // ... handlers ...
  });
  
  if(!ok) return;
  
  // Recalcular juros da parcela desmarcada
  const taxaMensal = (d.juros||0) / 100;
  const valorParcela = /* ... */;
  
  let saldo = d.valorTotal;
  for(let i = 0; i < indiceParc; i++) {
    const j = saldo * taxaMensal;
    saldo = Math.max(0, saldo - (valorParcela - j));
  }
  
  const jurosDesmarcados = taxaMensal > 0 ? saldo * taxaMensal : 0;
  
  // Desfazer atualização
  await updateDoc(doc(db,"usuarios",currentUser.uid,"dividas",dividaId), {
    valorPago: Math.max(0, (d.valorPago||0) - valorParcela),
    parcelasPagas: Math.max(0, (d.parcelasPagas||0) - 1),
    jurosPagos: Math.max(0, (d.jurosPagos||0) - jurosDesmarcados),
    atualizadoEm: serverTimestamp()
  });
  
  setTimeout(() => abrirDetalhes(dividaId), 300);
};
```

---

## 8. Renderização da Lista Principal

A função `renderizar()` mostra todas as dívidas:

```javascript
function renderizar() {
  // Calcular totais
  let totalSaldo = 0, totalPago = 0, totalJuros = 0, ativas = 0;
  
  dividas.forEach(d => {
    const falta = d.valorTotal - (d.valorPago||0);
    totalSaldo += Math.max(0, falta);
    totalPago += d.valorPago||0;
    totalJuros += d.jurosPagos||0;
    if(falta > 0) ativas++;
  });
  
  // Atualizar header stats
  document.getElementById('countAtivas').innerText = ativas;
  document.getElementById('saldoDevedor').innerText = fmt(totalSaldo);
  document.getElementById('totalPago').innerText = fmt(totalPago);
  document.getElementById('jurosPagos').innerText = fmt(totalJuros);
  
  // Barra progresso geral
  const totalGeral = totalSaldo + totalPago;
  if(totalGeral > 0) {
    const percGeral = (totalPago/totalGeral*100);
    document.getElementById('percGeral').innerText = percGeral.toFixed(0)+'%';
    document.getElementById('barraGeral').style.width = Math.min(100,percGeral).toFixed(0)+'%';
  }
  
  // Alertas para parcelas atrasadas/próximas de vencer
  let parcelasAtrasadas = 0, parcelasProximas = 0;
  dividas.forEach(d => {
    if(d.vencimento && d.parcelas > 0) {
      const vencBase = new Date(d.vencimento + 'T12:00:00');
      for(let i = d.parcelasPagas||0; i < d.parcelas; i++) {
        const dtVenc = new Date(vencBase);
        dtVenc.setMonth(dtVenc.getMonth() + i);
        const diffDias = Math.ceil((dtVenc - hoje)/(1000*60*60*24));
        if(diffDias < 0) parcelasAtrasadas++;
        else if(diffDias <= 7) parcelasProximas++;
        break; // só próxima pendente
      }
    }
  });
  
  // Renderizar cards
  const html = dividas
    .sort((a,b) => (b.valorTotal - (b.valorPago||0)) - (a.valorTotal - (a.valorPago||0)))
    .map(d => {
      const falta = d.valorTotal - (d.valorPago||0);
      const perc = d.valorTotal > 0 ? ((d.valorPago||0)/d.valorTotal*100) : 0;
      const quitada = perc >= 100;
      
      return `
        <div class="p-4 rounded-2xl border ${quitada ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'}" 
             data-action="details" data-id="${d.id}">
          <div class="flex items-start justify-between">
            <div>
              <p class="font-extrabold text-slate-800">${d.tipoIcone} ${quitada?'✅':''} ${escapeHTML(d.nome)}</p>
              <span class="text-xs text-slate-400">${d.parcelasPagas||0}/${d.parcelas} parcelas</span>
            </div>
            <span class="font-extrabold ${quitada?'text-emerald-600':'text-red-500'}">${fmt(Math.max(0,falta))}</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2.5 mt-3">
            <div style="width:${Math.min(100,perc)}%" class="h-full rounded-full ${quitada?'bg-emerald-500':'bg-blue-600'}"></div>
          </div>
        </div>
      `;
    }).join('');
  
  document.getElementById('listaDividas').innerHTML = html;
  
  // Event delegation
  document.getElementById('listaDividas').onclick = (e) => {
    const card = e.target.closest('[data-action="details"]');
    if(card) abrirDetalhes(card.dataset.id);
  };
}
```

---

## 9. Integração com Dashboard

### 9.1 Dados Mostrados no Dashboard

Na página principal (`dashboard.html`), a seção **"Contas Vencidas e Dívidas em Aberto"** mostra:

- Alertas de parcelas **atrasadas** (vermelho ⚠️)
- Lembretes de vencimento nos **próximos 7 dias** (amarelo ⏰)
- Botão **"✓ Pago"** para marcar parcela como paga rapidamente

```javascript
// No dashboard.js
// Query que busca de dividas subcollection
onSnapshot(query(collection(db,"usuarios",uid,"dividas")), snap => {
  dividas = snap.docs.map(d => ({...d.data(), id: d.id}));
  // Renderizar seção de vencidas
  renderizarContasVencidas();
});
```

### 9.2 Sincronização em Tempo Real

- Quando marca parcela como paga na **tela dividas** → Firestore atualiza
- Listeners do **dashboard** são acionados automaticamente
- Dashboard re-renderiza mostrando novo status

---

## 10. Fluxo Completo: Do Início Até Quitação

### Cenário: Empréstimo Pessoal 5000 a 3.5% a.m. em 12x

```
1️⃣ CADASTRO
┌─ Usuário clica "Nova Dívida"
├─ Seleciona "Empréstimo Pessoal"
├─ Seleciona "Parcelas (12x)"
├─ Preenche:
│  ├─ Nome: "Empréstimo Nubank"
│  ├─ Valor: R$ 5000
│  ├─ Parcelas: 12
│  ├─ Juros: 3.5% a.m.
│  └─ Vencimento: 15/04/2025
└─ Salva → Firestore

2️⃣ CÁLCULO AUTOMATICO
┌─ Tabela Price: 5000 × 0.035 / (1 - 1.035^-12) = R$ 450/mês
├─ Saldo início: R$ 5000
├─ Juros #1: 5000 × 0.035 = R$ 175
├─ Amortização #1: 450 - 175 = R$ 275
├─ Novo saldo: 5000 - 275 = R$ 4725
└─ Continua para próximas parcelas...

3️⃣ MARCAÇÃO DE PAGAMENTOS
┌─ Usuário vai para Dívidas
├─ Clica no card "Empréstimo Nubank"
├─ Abre modal de detalhes
├─ Clica checkbox "✓" na Parcela #1
├─ Sistema calcula: valorPago += 450, jurosPagos += 175
└─ Firestore atualiza

4️⃣ REPETIÇÃO (mensalmente)
┌─ Usuário marca Parcela #2, #3, ..., #12
├─ Cada uma atualiza saldo e juros
└─ Após #12: dívida aparece com ✅ QUITADA

5️⃣ IMPACTO NO DASHBOARD
┌─ Dashboard listener detecta mudança
├─ Remove de "Contas Vencidas"
├─ Move para "Totalmente Paga"
└─ Mostra "Tudo em Dia ✅"
```

---

## 11. Validações e Regras

| Validação | Regra |
|---|---|
| **Ordem de Parcelas** | Só permite marcar a PRÓXIMA parcela pendente (sequencial) |
| **Desmarcar** | Só a ÚLTIMA parcela paga pode ser desmarcada |
| **Valor Pago** | Não pode exceder valor total + juros |
| **Parcelas** | Mínimo 1, máximo 360 (30 anos) |
| **Juros** | Mínimo 0%, máximo 100% a.m. (absurdamente alto, mas deixa) |
| **Data Vencimento** | Obrigatória se parcelas > 0 |
| **Edição** | Pode editar (recalcula tudo automaticamente) |

---

## 12. Arquivos e Funções Principais

### Arquivo: `dividas.html`

- `modalTipo` → Seleção de tipo
- `modalFormato` → Seleção de formato
- `modalDivida` → Formulário principal
- `modalDetalhes` → Visualizar detalhes
- `modalImportIA` → Importar de contrato (IA)
- `modalSimulador` → Simular cenários (futuro?)

### Arquivo: `js/dividas.js`

| Função | Propósito |
|---|---|
| `abrirFormManual()` | Limpa e abre form vazio |
| `abrirImportIA()` | Abre modal de upload/câmera/texto |
| `classificarContrato(texto)` | IA: Detecta tipo de dívida |
| `extrairDadosDoTexto(texto)` | IA: Extrai números e datas via regex |
| `abrirDetalhes(dividaId)` | Mostra modal com detalhes completos |
| `renderizarParcelas(divida)` | Renderiza tabela de parcelas |
| `marcarParcelaPaga(dividaId, indiceParc)` | Marca parcela como paga (atualiza Firestore) |
| `desmarcarParcela(dividaId, indiceParc)` | Desfaz marcação (com confirmação) |
| `renderizar()` | Renderiza lista principal de dívidas |
| `fecharTodosModais()` | Fecha todos os modais abertos |

---

## 13. Fluxo de Dados - Diagrama

```
┌─────────────────┐
│   Usuário       │
│  dividas.html   │
└────────┬────────┘
         │
         ├────→ [Novo Dívida]
         │       ├─→ Tipo? (modalTipo)
         │       ├─→ Formato? (modalFormato)
         │       └─→ Form (modalDivida)
         │           └─→ updateDoc/addDoc
         │
         ├────→ [Importar IA]
         │       ├─→ Upload/Câmera/Texto (modalImportIA)
         │       ├─→ Tinymce OCR ou regex
         │       ├─→ Classificar contrato
         │       ├─→ Extrair dados
         │       └─→ Pre-preencher form
         │
         └────→ [Ver Detalhes]
                 ├─→ Tabela Price (recalcula)
                 ├─→ Renderizar parcelas
                 └─→ Marcar/Desmarcar
                     └─→ updateDoc (Firestore)
                         └─→ Listener dashboard
                             └─→ Dashboard se atualiza
```

---

## 14. Casos de Uso e Exemplos

### Caso 1: Empréstimo com Juros Variável

Usuário tem empréstimo onde juros variam:

```
Parcelas 1-6: 2% a.m.
Parcelas 7-12: 3% a.m.
```

**Solução atual:** Cria duas dívidas separadas
- Dívida 1: 6 parcelas a 2%
- Dívida 2: 6 parcelas a 3%

### Caso 2: Dívida Informal (Amigo)

```
Nome: "Emprestei pro João"
Tipo: "Dívida Informal"
Valor: R$ 500
Parcelas: 1 (sem juros)
Juros: 0%
Vencimento: 15/04/2025
```

Sistema trata normal, sem juros calculados.

### Caso 3: Financiamento Imobiliário

Importa contrato do banco:

```
[Upload PDF] → OCR → Detecta "Financiamento"
→ Extrai: 360 parcelas, R$ 2000, 5% a.a. (CET)
→ Data: 01/05/2025
→ Pre-preenche form
→ Usuário revisa e salva
```

---

## 15. Performance e Limites

| Limite | Valor | Impacto |
|---|---|---|
| Máx Dívidas/Usuário | Sem limite oficial (5000 no load) | Carregamento rápido até ~500 dívidas |
| Máx Parcelas/Dívida | 360 (30 anos) | Cálculo Tabela Price em ~5ms |
| Tamanho Doc Firestore | ~1MB | Dívida típica = ~2KB, sem problemas |
| Queries em Tempo Real | 1 listener (onSnapshot) | Sincronização em <100ms |

---

## 16. Atalhos de Teclado

| Tecla | Ação |
|---|---|
| `ESC` | Fecha modal aberto |
| `ENTER` | Confirma ação (form/modal) |

---

## 17. Integrações Externas

| Serviço | Uso |
|---|---|
| **Firebase Firestore** | Armazenar/atualizar dívidas em tempo real |
| **PDF.js** | Extrair texto de PDFs |
| **Tesseract.js** | OCR (reconhecimento de imagem) |
| **Regex** | Parse de números, datas, taxas |

---

## 18. Segurança e Permissões

**Firestore Rules:**

```javascript
match /usuarios/{uid}/dividas/{dividaId} {
  allow read, write: if request.auth.uid == uid;
}
```

- ✅ Usuário só acessa suas próprias dívidas
- ✅ Sem acesso a de outros usuários
- ✅ Edição em tempo real pelo owner

---

## 19. Possíveis Melhorias Futuras

- ☐ Simulador de cenários ("E se eu pagar R$ 800?")
- ☐ Alertas por push (1 dia antes de vencer)
- ☐ Exportar relatório de dívidas (PDF)
- ☐ Dashboard com previsão de quitação
- ☐ Integração com bancos (importar automaticamente)
- ☐ Suporte a taxa de juros variável
- ☐ Refinanciamento (consolidar múltiplas dívidas)

---

## 20. Resumo Técnico

**Tela:** Gerenciador completo de dívidas com IA
**Stack:** Firebase (Firestore), Vanilla JS, Tailwind
**Padrão:** Tabela Price (juros compostos mensais)
**Realtime:** Listeners Firestore com re-render
**Validações:** Sequencial (parcelas em ordem)
**UI:** Cards expansíveis + Modal detalhes com abas
**IA:** OCR (PDF/Imagem) + Regex (extração dados)

---

# 🐛 AUDITORIA DE ERROS — Sistema de Dívidas

> Auditoria realizada em 08/04/2026 — Arquivos analisados: `dividas.html`, `js/dividas.js`

---

## Problemas Encontrados: 14

### 🔴 Problema #1 — GRAVE: Classes Tailwind Dinâmicas em Múltiplos Modais

**Onde:** `js/dividas.js` — linhas 820, 860, 873, 899, 1435  
**O quê:** Modais de excluir/confirmar usam classes arbitrárias:
```javascript
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```
`bg-black/40` e `z-[9999]` NÃO existem no build estático. Modais ficam **invisíveis**.

**Impacto:** Usuário não consegue excluir dívidas, cancelar pagamentos, ou ver diálogos de confirmação.

**🔧 SOLUÇÃO:**
Trocar em **todos os locais** (820, 860, 873, 899, 1435):
```javascript
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🔴 Problema #2 — GRAVE: onSnapshot Sem Error Callback

**Onde:** `js/dividas.js` — linha 1490  
**O quê:** Listener do Firestore sem tratamento de erro:
```javascript
_unsubs.push(onSnapshot(query(collection(db,"usuarios",currentUser.uid,"dividas"), limit(500)), snap => {
    dividas = snap.docs.map(d=>({...d.data(),id:d.id}));
    renderizar();
}));
// ← Sem segundo callback de erro!
```

**Impacto:** Se permissão negada ou offline → crash silencioso. Página fica em branco sem explicação.

**🔧 SOLUÇÃO:**
```javascript
_unsubs.push(onSnapshot(
  query(collection(db,"usuarios",currentUser.uid,"dividas"), limit(500)),
  snap => {
    if (window.hideSplash) window.hideSplash();
    dividas = snap.docs.map(d=>({...d.data(),id:d.id}));
    renderizar();
  },
  err => {
    console.error('[Dividas] Firestore error:', err);
    window.budShowToast?.('Erro ao carregar dívidas. Tente novamente.', 'error');
  }
));
```

---

### 🔴 Problema #3 — GRAVE: Form Save Sem Error Handling

**Onde:** `js/dividas.js` — linhas 410–430  
**O quê:** O submit do formulário não tem try/catch:
```javascript
document.getElementById('formDivida').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('dividaId').value;
    if(id) await updateDoc(doc(db,...), dados);  // Sem error handling!
    else await addDoc(collection(db,...), {...dados}); // Sem error handling!
    fecharTodosModais(); // Fecha mesmo se salvamento falhou!
});
```

**Impacto:** Perda silenciosa de dados. Modal fecha e usuário acha que salvou. Possíveis dívidas duplicadas em retry.

**🔧 SOLUÇÃO:**
```javascript
document.getElementById('formDivida').addEventListener('submit', async e => {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  const originalText = btnSubmit.innerText;
  try {
    btnSubmit.disabled = true;
    btnSubmit.innerText = '💾 Salvando...';
    const id = document.getElementById('dividaId').value;
    if(id) await updateDoc(doc(db,"usuarios",currentUser.uid,"dividas",id), dados);
    else await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), {...dados, criadoEm: serverTimestamp()});
    window.budShowToast?.('Dívida salva com sucesso!', 'success');
    fecharTodosModais();
  } catch(err) {
    console.error('Erro ao salvar:', err);
    window.budShowToast?.('Erro ao salvar dívida. Tente novamente.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerText = originalText;
  }
});
```

---

### 🟡 Problema #4 — MÉDIO: Sem Validação de Valor Zero/Negativo

**Onde:** `js/dividas.js` — linhas 410–450  
**O quê:** Campos numéricos aceitos sem validação:
```javascript
const dados = {
    nome: ...,
    valorTotal,  // Pode ser 0
    parcelas,    // Pode ser 0 ou negativo
};
```
Divisão por zero na Tabela Price. `NaN` e `Infinity` aparecem nos cálculos.

**Impacto:** App mostra valores inválidos (NaN/Infinity). Cálculos de parcela quebram.

**🔧 SOLUÇÃO:**
```javascript
const valorTotal = parseMoeda(document.getElementById('dividaValorTotal').value);
const parcelas = parseInt(document.getElementById('dividaParcelas').value) || 0;
if (!valorTotal || valorTotal <= 0) {
  window.budShowToast?.('Valor deve ser maior que 0', 'warning'); return;
}
if (parcelas <= 0) {
  window.budShowToast?.('Parcelas deve ser > 0', 'warning'); return;
}
```

---

### 🟡 Problema #5 — MÉDIO: Simulador de Economia com Cálculo Impreciso

**Onde:** `js/dividas.js` — linhas 1070–1090 (`verEconomia`)  
**O quê:** PMT é calculado com parâmetros ORIGINAIS mas aplicado ao saldo RESTANTE:
```javascript
const pmt = (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -d.parcelas));
let saldo = falta;  // Saldo restante
for(let i = 0; i < parcelasRestantes && saldo > 0; i++) {
    const jParcela = saldo * taxaMensal;
    jurosFuturos += jParcela;
    saldo = Math.max(0, saldo - (pmt - jParcela)); // pmt original!
}
```

**Impacto:** Simulação de economia mostra juros futuros incorretos (otimista demais).

**🔧 SOLUÇÃO:**
Recalcular PMT para saldo restante:
```javascript
const pmtRestante = taxaMensal > 0
  ? (falta * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -parcelasRestantes))
  : falta / parcelasRestantes;
let saldo = falta;
for(let i = 0; i < parcelasRestantes && saldo > 0; i++) {
  const jParcela = saldo * taxaMensal;
  jurosFuturos += jParcela;
  saldo = Math.max(0, saldo - (pmtRestante - jParcela));
}
```

---

### 🟡 Problema #6 — MÉDIO: Sem Error Handling na IA/OCR (PDF.js/Tesseract.js)

**Onde:** `js/dividas.js` — linhas 516–540  
**O quê:** Se CDN do PDF.js falhar, `pdfjsLib` é undefined:
```javascript
if(nomeLower.endsWith('.pdf')) {
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    // Sem verificar se pdfjsLib existe!
}
```

**Impacto:** Usuário fica preso no loading spinner sem erro. Tem que recarregar a página.

**🔧 SOLUÇÃO:**
```javascript
if(nomeLower.endsWith('.pdf')) {
  if (!window.pdfjsLib) {
    mostrarErroIA('PDF.js não carregou. Verifique sua internet ou use "Colar Texto".');
    return;
  }
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    // ...
  } catch(err) {
    mostrarErroIA('Erro ao ler PDF: ' + err.message);
  }
}
```

---

### 🟡 Problema #7 — MÉDIO: Unsubscribe Não Limpo no Redirect

**Onde:** `js/dividas.js` — linha 1480  
**O quê:**
```javascript
onAuthStateChanged(auth, user => {
    _unsubs.forEach(fn=>fn()); _unsubs=[];
    if(user) {
        _unsubs.push(onSnapshot(...));
    } else {
        window.location.href = "index.html"; // ← Redirect sem cleanup!
    }
});
```

**Impacto:** Listeners em memória acumulam entre reloads. Desperdício de quota Firebase.

**🔧 SOLUÇÃO:**
```javascript
} else {
    _unsubs.forEach(fn=>fn()); _unsubs=[];
    window.location.href = "index.html";
}
```

---

### 🟡 Problema #8 — MÉDIO: Parcelas Só Podem Ser Pagas em Ordem

**Onde:** `js/dividas.js` — linhas 790–805  
**O quê:**
```javascript
window.marcarParcelaPaga = async function(id, indice) {
    if(indice !== (d.parcelasPagas||0)) {
        window.budShowToast('Pague as parcelas em ordem!', 'warning');
        return;
    }
};
```

**Impacto:** No mundo real, usuários podem pagar parcelas fora de ordem (acordo com banco). A restrição é confusa.

**🔧 SOLUÇÃO:**
Permitir com aviso:
```javascript
window.marcarParcelaPaga = async function(id, indice) {
  const parcelasPagas = d.parcelasPagas || 0;
  if (indice > parcelasPagas) {
    // Avisar mas permitir
    const confirmar = confirm(`Parcela ${indice+1} está fora de ordem (última paga: ${parcelasPagas}). Deseja marcar como paga mesmo assim?`);
    if (!confirmar) return;
  }
  // Continua marcação...
};
```

---

### 🟢 Problema #9 — LEVE: Sem Loading Indicator na Extração IA

**Onde:** `js/dividas.js` — linhas 670–690 (`salvarDividaIA`)  
**O quê:**
```javascript
window.salvarDividaIA = async function() {
    await addDoc(collection(db,...), dados); // Sem loading state
    fecharTodosModais();
};
```

**Impacto:** Usuário pode clicar múltiplas vezes → dívidas duplicadas.

**🔧 SOLUÇÃO:**
```javascript
window.salvarDividaIA = async function() {
  var btn = document.querySelector('#iaModal button[type="submit"]');
  btn.disabled = true; btn.innerText = 'Salvando...';
  try {
    await addDoc(collection(db,...), dados);
    window.budShowToast?.('Dívida importada!', 'success');
    fecharTodosModais();
  } catch(e) {
    window.budShowToast?.('Erro ao salvar.', 'error');
  } finally { btn.disabled = false; btn.innerText = 'Salvar'; }
};
```

---

### 🟢 Problema #10 — LEVE: Data de Vencimento Não Ajusta Meses Curtos

**Onde:** `js/dividas.js` — linhas 658–663  
**O quê:**
```javascript
const dt = new Date(vencBase);
dt.setMonth(dt.getMonth() + i); // Jan 31 → Mar 3 (não Feb 28)
dataVenc = dt.toLocaleDateString('pt-BR');
```

**Impacto:** Parcelas de meses curtos (fev, abr, etc.) ficam deslocadas em 1-3 dias.

**🔧 SOLUÇÃO:**
```javascript
function addMonthsSafe(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0); // Último dia do mês anterior
  }
  return d;
}
const dt = addMonthsSafe(vencBase, i);
```

---

### 🟢 Problema #11 — LEVE: Sem Feedback ao Limpar Arquivo IA

**Onde:** `js/dividas.js` — linhas 449–455  
**O quê:**
```javascript
window.limparArquivoIA = function() {
    document.getElementById('iaFileInput').value = '';
    // Sem feedback!
};
```

**Impacto:** Limpa sem aviso — usuário pode ter clicado por engano.

**🔧 SOLUÇÃO:**
```javascript
window.limparArquivoIA = function() {
  document.getElementById('iaFileInput').value = '';
  document.getElementById('iaFileInfo').classList.add('hidden');
  document.getElementById('iaUploadArea').classList.remove('hidden');
  window.budShowToast?.('Arquivo removido', 'info');
};
```

---

### 🟢 Problema #12 — LEVE: Cor do Overlay Inconsistente (HTML vs JS)

**Onde:** `dividas.html` linha 182 vs `js/dividas.js` linha 860  
**O quê:**
```html
<!-- HTML: slate-900 -->
<div id="mobileOverlay" class="bg-slate-900/40 ...">
<!-- JS: black -->
ov.className = 'bg-black/40 ...';
```

**Impacto:** Leve diferença visual entre overlays nativos e criados via JS.

**🔧 SOLUÇÃO:** Padronizar para `rgba(15,23,42,0.4)` (equivalente a `slate-900/40`) em todos os inline styles.

---

### 🟢 Problema #13 — LEVE: sort() Muta Array Original

**Onde:** `js/dividas.js` — linha 1197  
**O quê:**
```javascript
container.innerHTML = dividas.sort((a,b)=>...).map(...)
```
`.sort()` modifica o array `dividas` original.

**Impacto:** Re-render consecutivos não mantêm consistência de ordenação.

**🔧 SOLUÇÃO:**
```javascript
container.innerHTML = [...dividas].sort((a,b)=>...).map(...)
```

---

### 🟢 Problema #14 — LEVE: Sem Indicador de Loading no Import IA

Duplicado do Problema #9 (contexto diferente: upload vs save).

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA
- [ ] Problema #1 — Trocar `className` por `style.cssText` em 5 locais
- [ ] Problema #2 — Adicionar error callback no onSnapshot
- [ ] Problema #3 — Try/catch no submit + loading state

### 🟡 PRIORIDADE ALTA
- [ ] Problema #4 — Validar valor > 0 e parcelas > 0
- [ ] Problema #5 — Recalcular PMT para saldo restante na simulação
- [ ] Problema #6 — Verificar pdfjsLib/Tesseract antes de usar
- [ ] Problema #7 — Limpar _unsubs antes de redirect
- [ ] Problema #8 — Permitir pagamento fora de ordem com aviso

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #9 — Loading state no salvarDividaIA
- [ ] Problema #10 — addMonthsSafe para meses curtos
- [ ] Problema #11 — Toast ao limpar arquivo
- [ ] Problema #12 — Padronizar cor dos overlays
- [ ] Problema #13 — Usar spread [...dividas] antes de sort()

---

# 🔍 AUDITORIA APROFUNDADA — Varredura Linha-a-Linha (Fase 2)

> Auditoria aprofundada em 09/04/2026 — Leitura completa de todas as 1255 linhas de `js/dividas.js` + 467 linhas de `dividas.html`

---

## Novos Problemas Encontrados: 11

### 🔴 Problema #15 — GRAVE: "Saldo Devedor" Calculado Incorretamente (Fundamental)

**Onde:** `js/dividas.js` — renderizar() (L1140), simularExtra() (L998), verEconomia() (L1047), abrirSimulador() (L972), abrirDetalhes() (L803), renderizar card list (L1218)
**O quê:** Em TODOS os locais, o saldo devedor é calculado como:
```javascript
const falta = d.valorTotal - (d.valorPago||0);
```
Mas `valorPago` é a **soma dos PMTs pagos** (que incluem juros + amortização). Na Tabela Price, o saldo devedor real é **maior** que `valorTotal - somaPMTs` porque cada PMT contém uma parte de juros.

**Exemplo concreto:**
```
Empréstimo: R$ 10.000 | Juros: 1% a.m. | 12 parcelas
PMT = R$ 888,49

Após 6 parcelas pagas:
- valorPago = 6 × 888,49 = R$ 5.330,94
- falta (código) = 10.000 - 5.330,94 = R$ 4.669,06
- Saldo REAL (Tabela Price) = R$ 5.160,55
- ERRO: R$ 491,49 A MENOS do que o real!
```

**Impacto CRÍTICO:**
- KPI "Saldo Devedor" mostra **menos** do que o usuário realmente deve
- Barra de progresso mostra **mais progresso** do que a realidade
- Simulador "Quitar Tudo" mostra valor **menor** que o necessário → usuário paga menos e NÃO quita a dívida
- Simulador "Pagamento Extra" calcula economia sobre base errada
- Todos os cards mostram falta incorreta

**⚠️ NOTA:** Isso também invalida parcialmente o Problema #5 existente. A solução do #5 (recalcular PMT para saldo restante) está errada — na Tabela Price o PMT é constante e correto. O problema real é que `falta` ≠ saldo devedor.

**🔧 SOLUÇÃO:**
Criar helper que calcula o saldo real via amortização:
```javascript
function calcularSaldoDevedor(d) {
    const taxaMensal = (d.juros || 0) / 100;
    const valorParcela = d.valorParcela || (d.parcelas > 0
        ? (taxaMensal > 0
            ? (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -d.parcelas))
            : d.valorTotal / d.parcelas)
        : 0);
    let saldo = d.valorTotal;
    for (let i = 0; i < (d.parcelasPagas || 0); i++) {
        const jurosParc = saldo * taxaMensal;
        saldo = Math.max(0, saldo - (valorParcela - jurosParc));
    }
    return saldo;
}
```
Depois substituir `d.valorTotal - (d.valorPago||0)` por `calcularSaldoDevedor(d)` em:
- `renderizar()` — totalSaldo e cada card
- `abrirDetalhes()` — detSaldoDevedor
- `abrirSimulador()` — simInfo e simValorQuitacao
- `simularExtra()` — falta
- `verEconomia()` — falta

---

### 🟡 Problema #16 — MÉDIO: DOC/DOCX Aceitos Mas Não Processados

**Onde:** `dividas.html` L282 + `js/dividas.js` L486-560
**O quê:** O input aceita `.doc,.docx`:
```html
<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" ...>
```
Mas `processarArquivoIA` só trata `.txt`, `.pdf` e imagens. Arquivos `.doc/.docx` caem no fallback de OCR (Tesseract), que tenta ler um binário como imagem:
```javascript
if(nomeLower.endsWith('.txt')) { ... return; }
if(nomeLower.endsWith('.pdf')) { ... return; }
// ← .doc/.docx caem aqui → Tesseract tenta OCR do binário → lixo ou erro
```

**Impacto:** Upload de .doc/.docx produz texto-lixo ou erro silencioso. Usuário confia no resultado errado.

**🔧 SOLUÇÃO:**
Adicionar validação antes do processamento:
```javascript
window.processarArquivoIA = async function(input) {
    if(!input.files || !input.files.length) return;
    const file = input.files[0];
    const nomeLower = file.name.toLowerCase();

    // Rejeitar formatos não suportados
    const suportados = ['.txt', '.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    if (!suportados.some(ext => nomeLower.endsWith(ext))) {
        mostrarErroIA('Formato não suportado. Use PDF, imagem (JPG/PNG) ou TXT. Para arquivos .doc/.docx, copie o texto e use a aba "Colar Texto".');
        return;
    }
    // ... resto do código
};
```
E atualizar o accept do input:
```html
<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" ...>
```

---

### 🟡 Problema #17 — MÉDIO: `salvarDividaIA` Sem Error Handling (Duplicatas)

**Onde:** `js/dividas.js` — L730-755 (`salvarDividaIA`)
**O quê:**
```javascript
window.salvarDividaIA = async function() {
    // ... monta dados ...
    await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), dados); // Sem try/catch!
    fecharTodosModais(); // Fecha mesmo se falhou!
};
```
Sem try/catch, sem loading state, sem disable no botão.

**Impacto:** Double-click cria dívidas duplicadas. Falha de rede fecha modal sem salvar — dados perdidos.

**🔧 SOLUÇÃO:**
```javascript
window.salvarDividaIA = async function() {
    const btn = document.querySelector('#iaResultado button[onclick*="salvarDividaIA"]');
    if (btn) { btn.disabled = true; btn.innerText = '💾 Salvando...'; }
    try {
        // ... monta dados ...
        await addDoc(collection(db,"usuarios",currentUser.uid,"dividas"), dados);
        window.budShowToast?.('Dívida importada com sucesso!', 'success');
        fecharTodosModais();
    } catch(err) {
        console.error('[Dividas IA] Erro ao salvar:', err);
        window.budShowToast?.('Erro ao salvar dívida. Tente novamente.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '💾 Salvar Dívida'; }
    }
};
```

---

### 🟡 Problema #18 — MÉDIO: Classes Tailwind Dinâmicas em Parcelas (Opacidade)

**Onde:** `js/dividas.js` — L860-862 (`renderizarParcelas`)
**O quê:** Diferente do Problema #1 (overlays), estas classes usam modificadores de opacidade em elementos de parcela:
```javascript
// Parcela paga:
class="... ${paga?'bg-emerald-50/30':''}">
// Parcela atrasada:
statusClass = 'border-red-200 bg-red-50/30';
```
`bg-emerald-50/30` e `bg-red-50/30` **NÃO existem** no build estático do Tailwind. Apenas `bg-slate-900/40` existe (usado no HTML).

**Impacto:** Parcelas pagas e atrasadas não têm o fundo colorido diferenciador. Todas parecem iguais visualmente.

**🔧 SOLUÇÃO:**
Usar inline styles para os backgrounds com opacidade:
```javascript
// Parcela paga:
const bgPaga = paga ? 'background:rgba(236,253,245,0.3);' : '';
// Parcela atrasada:
const bgAtrasada = atrasada ? 'background:rgba(254,242,242,0.3);' : '';

html += `<div class="parcela-item flex items-center gap-3 p-4 rounded-2xl border ${paga?'border-emerald-200':statusClass||'border-slate-100'}" style="${paga ? bgPaga : bgAtrasada}">`;
```

---

### 🟡 Problema #19 — MÉDIO: Código Morto — Funções Nunca Chamadas

**Onde:** `js/dividas.js` — L1083-1105 (`registrarPagamento`) e L770-790 (`excluirDivida`)
**O quê:** Duas funções exportadas para `window` que nunca são chamadas:

1. `window.registrarPagamento(id)` — **cópia exata** de `marcarParcelaPaga` (mesma lógica, mesmo resultado). Nenhum onclick/botão chama essa função.
2. `window.excluirDivida(id)` — mesma lógica de `excluirDividaAtual` mas recebe ID diretamente. Nenhum botão/interface chama essa função (apenas `excluirDividaAtual` é usada no modal de detalhes).

**Impacto:** +75 linhas de código morto que podem confundir manutenção. Bug fixes aplicados em uma função mas não na outra.

**🔧 SOLUÇÃO:**
Remover ambas as funções (`registrarPagamento` e `excluirDivida`). Se precisar excluir por ID no futuro, refatorar `excluirDividaAtual` para aceitar ID opcional:
```javascript
window.excluirDividaAtual = async function(id) {
    const targetId = id || (dividaAtual && dividaAtual.id);
    if (!targetId) return;
    // ... confirmação e deleteDoc ...
};
```

---

### 🟡 Problema #20 — MÉDIO: `fmt()` Oculta Valores no Preview IA

**Onde:** `js/dividas.js` — L680-690 (`mostrarPreviewIA` → extras)
**O quê:** A função `fmt` respeita `valoresOcultos`:
```javascript
const fmt = v => valoresOcultos ? 'R$ •••••' : (v||0).toLocaleString(...);
```
Usada no preview de extras da IA:
```javascript
if(extras.iof) extHTML += `...${fmt(extras.iof)}...`;
if(extras.seguro) extHTML += `...${fmt(extras.seguro)}...`;
```

**Impacto:** Se o usuário ativou "ocultar valores", os dados extraídos pela IA aparecem como "R$ •••••" no preview. Impossível verificar se a extração está correta antes de salvar.

**🔧 SOLUÇÃO:**
Usar `formatMoeda` direto (sem respeitar toggle) no preview IA:
```javascript
const fmtIA = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});
if(extras.iof) extHTML += `...${fmtIA(extras.iof)}...`;
if(extras.seguro) extHTML += `...${fmtIA(extras.seguro)}...`;
```

---

### 🟢 Problema #21 — LEVE: Tab Câmera Inútil no Desktop

**Onde:** `dividas.html` — L297-305 (tab Câmera)
**O quê:**
```html
<input type="file" id="iaCameraInput" accept="image/*" capture="environment" class="hidden" onchange="processarArquivoIA(this)">
```
`capture="environment"` só funciona em dispositivos móveis. No desktop, abre um file picker padrão — idêntico à tab "Arquivo" mas só para imagens.

**Impacto:** Confusão no desktop: "Abrir Câmera" abre seletor de arquivos. UX inconsistente.

**🔧 SOLUÇÃO:**
Ocultar tab câmera em telas desktop:
```javascript
// Em DOMContentLoaded ou no trocarTabIA:
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || 'ontouchstart' in window;
const tabCamera = document.getElementById('tabIACamera');
if (tabCamera && !isMobile) tabCamera.style.display = 'none';
```

---

### 🟢 Problema #22 — LEVE: `onSnapshot` com `limit(500)` Sem `orderBy`

**Onde:** `js/dividas.js` — L1250
**O quê:**
```javascript
_unsubs.push(onSnapshot(query(collection(db,"usuarios",user.uid,"dividas"), limit(500)), ...));
```
Se o usuário tiver >500 dívidas, as 500 retornadas são em ordem arbitrária (Firestore ordena por document ID).

**Impacto:** Dívidas mais recentes podem ficar de fora do carregamento. Usuário não vê dívidas recém-cadastradas.

**🔧 SOLUÇÃO:**
Adicionar `orderBy` para garantir dívidas recentes primeiro:
```javascript
import { orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// ...
query(collection(db,"usuarios",user.uid,"dividas"), orderBy('criadoEm','desc'), limit(500))
```

---

### 🟢 Problema #23 — LEVE: `escapeHTML` Não Validado no Import

**Onde:** `js/dividas.js` — L10
**O quê:**
```javascript
const escapeHTML = window.escapeHTML;
```
Se `bud-utils.js` falhar ao carregar (CDN fora, bloqueador de conteúdo), `escapeHTML` é `undefined`. Qualquer chamada a `escapeHTML(d.nome)` causa TypeError.

**Impacto:** Tela inteira quebra se `bud-utils.js` não carrega. Nenhuma dívida é exibida.

**🔧 SOLUÇÃO:**
Fallback local:
```javascript
const escapeHTML = window.escapeHTML || function(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
};
```

---

### 🟢 Problema #24 — LEVE: Modal Detalhes Sempre Reseta para Tab Resumo

**Onde:** `js/dividas.js` — L800, L908, L962
**O quê:**
```javascript
window.abrirDetalhes = function(id) {
    // ...
    trocarTab('resumo'); // ← Sempre reseta!
    renderizarParcelas(d);
    abrirModalGenerico('modalDetalhes');
};
```
Após `marcarParcelaPaga` e `desmarcarParcela`:
```javascript
setTimeout(() => abrirDetalhes(id), 300); // ← Reabre no Resumo
```

**Impacto:** Usuário está na aba "Parcelas", marca uma como paga → modal reabre na aba "Resumo". Precisa clicar "Parcelas" de novo para continuar marcando.

**🔧 SOLUÇÃO:**
Preservar aba ativa:
```javascript
let _tabAtualDetalhes = 'resumo';
window.abrirDetalhes = function(id, tab) {
    // ...
    trocarTab(tab || _tabAtualDetalhes || 'resumo');
    // ...
};
window.trocarTab = function(tab) {
    _tabAtualDetalhes = tab;
    // ... resto igual
};
// Em marcarParcelaPaga/desmarcarParcela:
setTimeout(() => abrirDetalhes(id, 'parcelas'), 300);
```

---

### 🟢 Problema #25 — LEVE: Código Duplicado nos Diálogos de Confirmação

**Onde:** `js/dividas.js` — L770-787 (`excluirDivida`) vs L790-810 (`excluirDividaAtual`) vs L930-950 (`desmarcarParcela`)
**O quê:** Três funções criam diálogos de confirmação quase idênticos (overlay + card com botões):
```javascript
const ov = document.createElement('div');
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] ...';
ov.innerHTML = '<div class="bg-white rounded-2xl ...">...</div>';
```
Cada um com IDs únicos (`cxlDel`/`cfmDel`, `cxlDel2`/`cfmDel2`, `cxlUnp`/`cfmUnp`) mas estrutura idêntica.

**Impacto:** ~60 linhas de código duplicado. Qualquer fix (Problema #1) precisa ser aplicado 3x. Classes Tailwind dinâmicas (`bg-black/40`, `z-[9999]`) presentes em todos.

**🔧 SOLUÇÃO:**
Extrair helper reutilizável:
```javascript
function confirmarAcao(titulo, mensagem, textoBotao = 'Confirmar', corBotao = 'bg-red-500') {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">
            <p class="text-lg font-bold text-slate-800 mb-2">${escapeHTML(titulo)}</p>
            <p class="text-slate-500 text-sm mb-6">${escapeHTML(mensagem)}</p>
            <div class="flex gap-3">
                <button data-act="cancel" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Cancelar</button>
                <button data-act="confirm" class="flex-1 py-2.5 rounded-xl ${corBotao} text-white font-semibold text-sm">${escapeHTML(textoBotao)}</button>
            </div></div>`;
        document.body.appendChild(ov);
        ov.querySelector('[data-act="cancel"]').onclick = () => { ov.remove(); resolve(false); };
        ov.querySelector('[data-act="confirm"]').onclick = () => { ov.remove(); resolve(true); };
        ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); resolve(false); } });
    });
}
```

---

## ✅ CHECKLIST DE CORREÇÃO (ATUALIZADO)

### 🔴 PRIORIDADE CRÍTICA
- [ ] Problema #1 — Trocar `className` por `style.cssText` em 5 locais
- [ ] Problema #2 — Adicionar error callback no onSnapshot
- [ ] Problema #3 — Try/catch no submit + loading state
- [ ] Problema #15 — **Calcular saldo devedor real via amortização (afeta tudo)**

### 🟡 PRIORIDADE ALTA
- [ ] Problema #4 — Validar valor > 0 e parcelas > 0
- [ ] ~~Problema #5~~ — ⚠️ Diagnóstico parcialmente incorreto (ver #15): o PMT original está correto, o problema é o `falta`
- [ ] Problema #6 — Verificar pdfjsLib/Tesseract antes de usar
- [ ] Problema #7 — Limpar _unsubs antes de redirect
- [ ] Problema #8 — Permitir pagamento fora de ordem com aviso
- [ ] Problema #16 — Rejeitar .doc/.docx com mensagem clara
- [ ] Problema #17 — Try/catch + loading no salvarDividaIA
- [ ] Problema #18 — Inline styles para bg com opacidade em parcelas
- [ ] Problema #19 — Remover código morto (registrarPagamento + excluirDivida)
- [ ] Problema #20 — Usar formatMoeda direto no preview IA

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #9 — Loading state (coberto por #17)
- [ ] Problema #10 — addMonthsSafe para meses curtos
- [ ] Problema #11 — Toast ao limpar arquivo
- [ ] Problema #12 — Padronizar cor dos overlays (coberto por #25)
- [ ] Problema #13 — Usar spread [...dividas] antes de sort()
- [ ] Problema #21 — Ocultar tab Câmera no desktop
- [ ] Problema #22 — orderBy no onSnapshot
- [ ] Problema #23 — Fallback para escapeHTML
- [ ] Problema #24 — Preservar tab ativa ao reabrir detalhes
- [ ] Problema #25 — Extrair helper confirmarAcao()

---

## 📊 RESUMO DE MÉTRICAS (ATUALIZADO)

| Severidade | Fase 1 | Fase 2 | Total |
|---|---|---|---|
| 🔴 GRAVE | 3 | 1 | **4** |
| 🟡 MÉDIO | 5 | 5 | **10** |
| 🟢 LEVE | 5+1 dup | 5 | **11** |
| **TOTAL** | **14** | **11** | **25** |

### Bug Mais Crítico Descoberto
O **Problema #15** é o mais impactante: o "Saldo Devedor" exibido em toda a tela está **sistematicamente incorreto** para qualquer dívida com juros > 0%. O erro cresce com a taxa de juros e número de parcelas pagas. Em um financiamento de 360 meses a 0,8% a.m., o erro pode ultrapassar **30% do saldo real**. Isso afeta decisões financeiras reais do usuário (quitação antecipada, pagamento extra).

| Categoria | Bugs |
|---|---|
| Tailwind Dinâmico | #1, #12 |
| Firebase (Listener) | #2, #7 |
| Error Handling | #3, #6, #9 |
| Validação | #4 |
| Cálculo (Tabela Price) | #5, #10 |
| UX/Restrição | #8 |
| Feedback | #11 |
| Performance | #13 |

