# 🔄 Tela de Recorrentes — Documentação Completa

> **Última atualização:** 2025-07-12
> **Arquivos:** `recorrentes.html` (~290 linhas) · `js/recorrentes.js` (~490 linhas) · `functions/index.js` (processarRecorrentes + enviarLembretesFinanceiros)

---

## 1. VISÃO GERAL

A tela de **Recorrentes** permite ao usuário cadastrar despesas e receitas que se repetem automaticamente (Netflix, aluguel, salário, etc.). Uma Cloud Function (`processarRecorrentes`) roda todos os dias às 6h (horário de Brasília) e cria transações automáticas na coleção `transacoes` quando a `proximaData` de uma recorrente é ≤ hoje.

**Feature gated:** Recurso exclusivo dos planos **Pro, Plus e Trial** (controlado por `NexoPlanos.canUseFeature(userData, 'recurringTransactions')`). Usuários Free/Starter veem o `#planGate` com CTA de upgrade.

---

## 2. ESTRUTURA HTML (`recorrentes.html`)

### 2.1 Head & Scripts
| Recurso | Detalhe |
|---------|---------|
| PWA | manifest.json, apple-touch-icon, theme-color #2563eb |
| CSS | `tailwind.css?v=3422` + Google Fonts Inter + CSS customizado inline |
| Scripts carregados antes do body | `firebase-config.js`, `bud-loader.js`, `bud-utils.js` |
| Scripts carregados no final | `plano-config.js`, `sidebar.js`, `js/recorrentes.js` (module), `dark-mode.js`, `tutorial.js`, `tutorial-steps.js`, `tutorial-init.js` |

### 2.2 CSS Customizado
- **Animações:** `fadeInUp` (0.4s), `scaleIn` (0.3s), `spinSlow` (3s linear infinite)
- **Componente toggle-pill:** Toggle switch customizado (40×22px, bg #e2e8f0 → #10b981 quando checked)
- **rec-card:** Hover eleva 2px + shadow 24px
- **glass-panel:** Background rgba com backdrop-blur

### 2.3 Layout Principal
```
body (flex, overflow-hidden, height: 100dvh)
├── #mobileOverlay (z-40, burger overlay)
├── #sidebar-container (injetado por sidebar.js)
└── <main> (flex-1, overflow-y-auto, z-10)
    ├── <header> (sticky top-0 z-30)
    │   ├── Hamburger (mobile)
    │   ├── Eye toggle + Refresh (mobile only)
    │   ├── Título "🔄 Recorrentes"
    │   └── #btnNovaRec "+ Nova Recorrente"
    ├── #planGate (hidden, z-center)
    │   └── Card com upgrade CTA → vendas.html
    └── #mainContent (hidden)
        ├── Grid 3 colunas (resumo)
        │   ├── Ativas (totalAtivas)
        │   ├── Despesas/mês (totalDespesas)
        │   └── Receitas/mês (totalReceitas)
        └── #listaRecorrentes (populado por JS)
```

### 2.4 Modal Criar/Editar (`#modalRec`)
- **z-index:** 50 (overlay bg-slate-900/50 + backdrop-blur)
- **Botão fechar:** X no canto superior direito
- **Campos do formulário:**

| Campo | Tipo | ID | Detalhe |
|-------|------|----|---------|
| Tipo | Toggle (Receita ↑ / Despesa ↓) | `recTipo` (hidden) | Default: `despesa` ao abrir novo |
| Descrição | text | `recDescricao` | Obrigatório |
| Valor (R$) | text + inputmode decimal | `recValor` | Máscara de moeda BR |
| Categoria | Custom dropdown | `recCategoria` (hidden) | 49 despesa / 15 receita + custom |
| Forma de Pagamento | Custom dropdown | `recForma` (hidden) | PIX, Débito, Crédito, Dinheiro, Transferência, Déb. automático |
| Periodicidade | Custom dropdown | `recPeriodo` (hidden) | Mensal, Semanal, Diária (default: mensal) |
| Dia do vencimento | number (1-31) | `recDia` | Só visível quando periodicidade = 'mensal' |

**Dropdowns customizados:** Todos usam `z-[80]` com `bottom-full` (abrem para cima). Fecham ao clicar fora via listener global em `document`.

---

## 3. LÓGICA JAVASCRIPT (`js/recorrentes.js`)

### 3.1 Firebase Setup
```javascript
import { addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, Timestamp, query, limit }
```
Todas operações em: `usuarios/{uid}/recorrentes`

### 3.2 Estado Global
| Variável | Tipo | Descrição |
|----------|------|-----------|
| `currentUser` | object | Usuário autenticado |
| `recorrentes` | array | Todas as recorrentes do usuário (max 500) |
| `tipoAtual` | string | 'receita' ou 'despesa' |
| `categoriasCustomRec` | array | Categorias personalizadas do Firestore |
| `_unsubs` | array | Listeners para cleanup |
| `valoresOcultos` | boolean | Se os valores monetários estão ocultos |

### 3.3 Funções Principais

#### `setTipo(tipo)`
Alterna visualmente entre Receita (verde) e Despesa (vermelho) no modal.

#### `toggleDiaVencimento()`
Mostra/esconde o campo "Dia do vencimento" — só visível quando periodicidade === 'mensal'.

#### `calcProximaData(periodicidade, diaVencimento)` — CLIENT-SIDE
- **Diária/Semanal:** retorna `hoje` (data atual)
- **Mensal:** calcula o próximo dia de vencimento:
  1. Pega dia target (clamp 1-31)
  2. Calcula maxDia do mês atual
  3. Se a data calculada < hoje, avança 1 mês + recalcula maxDia
  4. Retorna `Date`

#### `calcProximaData(fromDate, periodicidade, diaVencimento)` — SERVER-SIDE (Cloud Function)
- **Diária:** `fromDate + 1 dia`
- **Semanal:** `fromDate + 7 dias`
- **Mensal:** `fromDate + 1 mês`, ajusta dia para min(diaVencimento, maxDiaDoMes)
- ⚠️ **DIFERENÇA CRÍTICA:** Client calcula a partir de "hoje", server calcula a partir da `proximaData` anterior

#### `abrirModal(rec?)`
- **Novo:** Reseta form, default tipo = 'despesa', periodicidade = 'mensal', dia = 1
- **Editar:** Preenche todos os campos com dados da recorrente existente

#### `fecharModal()`
Esconde modal. Também responde a tecla `Escape`.

#### Form Submit
1. Valida descrição (não vazio) e valor (> 0)
2. Monta objeto `dados`:
   ```javascript
   {
     descricao, tipo, valor, categoria, formaPagamento,
     periodicidade, diaVencimento,
     proximaData: Timestamp.fromDate(calcProximaData(...)),
     ativa: true,
     atualizadoEm: serverTimestamp()
   }
   ```
3. Se `id` existe → `updateDoc`, senão → `addDoc` (adiciona `criadoEm`)
4. Fecha modal

#### `toggleAtivo(id, val)`
Toggle do campo `ativa` (true/false) no Firestore.

#### `excluirRec(id)`
1. Mostra overlay de confirmação customizado (criado via `createElement`)
2. Mensagem: "Os lançamentos já gerados não serão removidos."
3. Se confirmado → `deleteDoc`

### 3.4 Sistema de Categorias

**Despesa (49 categorias):** Aluguel, Condomínio, Água, Luz, Gás, Internet/TV, Manutenção da Casa, Mercado, Delivery/Ifood, Restaurante, Padaria/Café, Combustível, Uber/Táxi, Ônibus/Metrô, Estacionamento, Manutenção Veículo, IPVA/Seguro, Pedágio, Plano de Saúde, Farmácia, Consultas/Exames, Terapia/Psicólogo, Dentista, Faculdade/Escola, Cursos, Material Escolar, Cinema/Teatro, Shows/Eventos, Viagens, Bares/Baladas, Hobbies, Jogos/Games, Roupas/Sapatos, Acessórios, Academia/Esportes, Salão/Barbearia, Cosméticos, Presentes, Eletrônicos, Casa/Móveis, Pet, Assinaturas/Streaming, Diarista/Limpeza, Impostos/IRPF, Taxas Bancárias, Empréstimos/Dívidas, Seguro de Vida, Doações/Dízimo, Outros

**Receita (15 categorias):** Salário, Férias, 13º Salário, Bônus/PLR, Vale Refeição/Alimentação, Freelance/Projetos, Rendimentos/Dividendos, Venda de Produtos, Venda de Imóvel/Carro, Cashback, Restituição IR, Pensões, Aluguéis Recebidos, Doações Recebidas, Outras Receitas

**Categorias Personalizadas:** Carregadas de `usuarios/{uid}/categorias` via `onSnapshot`, mescladas com as padrão, ordenadas alfabeticamente.

**Emojis:** Mapa `catEmojiMapRec` com ~60 mapeamentos. Prioridade: 1) emoji da categoria custom → 2) mapa padrão → 3) fallback 📦.

### 3.5 Dropdown: Forma de Pagamento
| Valor | Label |
|-------|-------|
| `PIX` | ⚡ PIX |
| `Débito` | 💳 Débito |
| `Crédito` | 💳 Crédito |
| `Dinheiro` | 💵 Dinheiro |
| `Transferência` | 🔄 Transferência |
| `Débito automático` | 🔁 Déb. automático |

### 3.6 Dropdown: Periodicidade
| Valor | Label |
|-------|-------|
| `mensal` | 📅 Mensal |
| `semanal` | 🗓️ Semanal |
| `diaria` | 📆 Diária |

### 3.7 Renderização (`renderizar()`)

**Resumo (cards superiores):**
- Conta apenas recorrentes `ativa === true`
- Multiplica valor para estimar mensal: diária ×30, semanal ×4.3, mensal ×1

**Lista de cards:**
Cada card exibe:
- Ícone (por categoria, fallback ↑/↓ conforme tipo)
- Fundo do ícone (red-50 despesa / emerald-50 receita)
- Descrição (truncated)
- Valor com prefixo (+/-) e cor (emerald/red)
- Badge de periodicidade (Diária = roxo, Semanal = azul, Mensal = slate)
- Categoria (se existir)
- "Próximo: DD mmm" (próxima data formatada)
- Toggle pill ativa/desativa
- Botão editar (abre modal)
- Botão excluir (confirmação)
- Animação fadeInUp com delay escalonado (idx * 0.04s)

**Estado vazio:** Card centralizado com spinner lento 🔄, mensagem "Nenhuma recorrente ainda" e botão "+ Criar Primeira Recorrente".

### 3.8 Auth & Data Loading
```
onAuthStateChanged →
  1. Limpa _unsubs anteriores
  2. Se !user → redireciona index.html
  3. Carrega userData do Firestore
  4. NexoPlanos.canUseFeature(userData, 'recurringTransactions')
     - false → mostra #planGate, esconde #btnNovaRec
     - true → mostra #mainContent, inicia listeners:
       a. onSnapshot('recorrentes', limit 500) → ordena por descricao → renderizar()
       b. onSnapshot('categorias', limit 200) → atualiza categoriasCustomRec → preencherCategorias()
```

---

## 4. CLOUD FUNCTION: `processarRecorrentes`

**Schedule:** Cron `0 6 * * *` (todos os dias às 6h, America/Sao_Paulo)
**Region:** southamerica-east1

### Fluxo:
1. Busca TODOS os documentos de `usuarios`
2. Para cada usuário, busca `recorrentes` onde `ativa === true`
3. Para cada recorrente:
   - Se `proximaData` não existe → skip
   - Se `proximaData.toDate() <= hoje` (normalizado 00:00):
     - Determina se pagamento é imediato: PIX ou Débito → `pago: true`
     - Cria transação em `usuarios/{uid}/transacoes`:
       ```javascript
       {
         descricao, valor, tipo, categoria, formaPagamento,
         data: rec.proximaData,
         recorrenteId: recDoc.id,
         automatica: true,
         pago: pagoImediato,
         criadoEm: Timestamp.now()
       }
       ```
     - Calcula nova `proximaData` (server-side `calcProximaData`)
     - Atualiza recorrente com nova `proximaData`

### Transação Gerada — Campos
| Campo | Valor |
|-------|-------|
| `descricao` | Cópia da recorrente |
| `valor` | Cópia da recorrente |
| `tipo` | 'despesa' ou 'receita' |
| `categoria` | Categoria ou 'Outros' (fallback) |
| `formaPagamento` | Cópia ou '' |
| `data` | `rec.proximaData` original |
| `recorrenteId` | ID do documento recorrente |
| `automatica` | `true` |
| `pago` | `true` se PIX/Débito, `false` caso contrário |
| `criadoEm` | `Timestamp.now()` |

---

## 5. CLOUD FUNCTION: `enviarLembretesFinanceiros`

**Schedule:** Cron `0 7 * * *` (7h, após processarRecorrentes)

### Lembretes de Recorrentes:
- Busca recorrentes ativas do tipo 'despesa'
- Se `proximaData === hoje` → notificação "⚠️ Conta vence hoje!"
- Se `proximaData === amanhã` → notificação "💡 Conta vence amanhã"
- Suporta singular/plural (1 conta vs N contas)
- Link de todas: `/recorrentes.html`
- Envia via FCM (Firebase Cloud Messaging)

---

## 6. INTEGRAÇÕES CROSS-CODEBASE

### 6.1 Dashboard (`js/dashboard.js`)
- Carrega `recorrentesGlobaisDash` via `onSnapshot('recorrentes', limit 500)`
- **Seção "Contas Vencidas/Atrasadas + Lembretes"** (`atualizarContasVencer()`):
  - **Fonte 1 — Transações pendentes:** `pago === false` + `tipo === 'despesa'` (exclui PIX/Débito)
  - **Fonte 2 — Recorrentes ativas:** Filtra `ativa !== false && tipo === 'despesa'`
    - Calcula `dataVenc = new Date(ano, mês, diaVencimento)` — usa apenas `diaVencimento`, ignora `periodicidade`
    - Verifica duplicata: se já existe transação no mês com mesmo nome (case-insensitive) e `dataReferencia` → ignora
  - **Fonte 3 — Dívidas:** Parcelas vencidas/próximas
  - **Classificação:**
    - `diff < 0` → array `vencidas` (contas atrasadas) — exibe "⊘ Venceu há X dias"
    - `diff <= 7` → array `lembretes` (próximas) — exibe "⏱ Em X dias" / "Amanhã" / "Vence hoje"
    - `diff > 7` → ignorado (não aparece no dashboard)
  - Se ambos arrays vazios → mostra "Tudo em dia" ✅
- **"Marcar como pago" no dashboard** (`marcarPagoDashboard`):
  - Se tem `transacaoId` → `updateDoc({ pago: true })`
  - Se não tem `transacaoId` (recorrente sem transação gerada) → cria transação manual com `recorrente: true`
  - Verifica duplicata por nome + `dataReferencia` antes de criar

### 6.2 Extrato (`js/extrato.js`)
- Exibe badge **REC** (roxo, `bg-purple-100 text-purple-600`) em transações com `t.recorrente === true`
- Duas versões do badge (desktop e mobile)

### 6.3 Configurações (`js/configuracoes.js`)
- Lista `recorrentes` nas subcoleções para:
  - **Exportar dados:** inclui recorrentes na exportação
  - **Excluir conta:** deleta subcoleção recorrentes

### 6.4 Admin (`js/admin.js`)
- Feature flag: `{ key:'recorrentes', name:'Recorrentes', allowedPlans:['pro','plus','trial'] }`

### 6.5 Plano Config (`plano-config.js`)
```
free:    recurringTransactions: false
starter: recurringTransactions: false
pro:     recurringTransactions: true
plus:    recurringTransactions: true
trial:   recurringTransactions: true
```
- `featureMinPlan.recurringTransactions = 'Pro'`
- Aparece em `nextPlanHighlights` do Starter

### 6.6 Sidebar (`sidebar.js`)
- Link no menu: `recorrentes.html` com ícone 🔄 e texto "Recorrentes"
- Mapeamento: `'recorrentes': 'menu-recorrentes'`

### 6.7 Tutorial (`tutorial-steps.js`)
```javascript
var tutorialRecorrentes = {
    title: 'Recorrentes', emoji: '🔄',
    desc: 'Cadastre despesas e receitas que se repetem todo mês.',
    features: [
        { icon: '📅', title: 'Automação total', desc: 'Defina valor, categoria e dia — o Bud lança automaticamente.' },
        { icon: '💰', title: 'Aluguel, salário, assinaturas', desc: 'Tudo que se repete fica cadastrado sem precisar lembrar.' }
    ]
};
```

### 6.8 Firestore Rules
- Subcoleções (`/{subcollection}/{docId}`) permitem read/write se `auth.uid === userId`
- **NÃO há regra específica para recorrentes** — usa regra genérica de subcoleção
- Cloud Function usa Admin SDK (bypassa regras)

### 6.9 Balanço Mensal / Relatórios
- **NÃO referenciam recorrentes diretamente** — trabalham apenas com a coleção `transacoes` (que já contém as transações geradas automaticamente pelas recorrentes)

---

## 7. DOCUMENTO FIRESTORE: Schema

### `usuarios/{uid}/recorrentes/{recId}`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `descricao` | string | Nome da recorrente (ex: "Netflix") |
| `tipo` | string | 'despesa' ou 'receita' |
| `valor` | number | Valor em R$ |
| `categoria` | string | Nome da categoria |
| `formaPagamento` | string | PIX, Débito, Crédito, Dinheiro, Transferência, Débito automático |
| `periodicidade` | string | 'mensal', 'semanal', 'diaria' |
| `diaVencimento` | number | 1–31 (usado apenas quando mensal) |
| `proximaData` | Timestamp | Próxima data de lançamento automático |
| `ativa` | boolean | Se a recorrente está ativa |
| `criadoEm` | Timestamp | Data de criação |
| `atualizadoEm` | Timestamp | Última atualização |

---

## 8. FLUXOS DE USUÁRIO

### 8.1 Criar Nova Recorrente
1. User clica "+ Nova Recorrente"
2. Modal abre com default: tipo = Despesa, periodicidade = Mensal, dia = 1
3. Preenche: descrição, valor, categoria, forma pgto, periodicidade, dia
4. Clica "Salvar Recorrente"
5. `addDoc` com `proximaData` calculada client-side
6. `onSnapshot` atualiza lista automaticamente

### 8.2 Editar Recorrente
1. Clica ícone lápis no card
2. Modal abre com dados preenchidos
3. Altera campos desejados
4. "Salvar Recorrente" → `updateDoc`
5. **⚠️ proximaData é RECALCULADA** na edição (sempre calcula nova baseada em hoje)

### 8.3 Ativar/Desativar
1. Toggle pill no card
2. `updateDoc({ ativa: val })` imediato
3. Recorrentes desativadas ficam com opacity-60

### 8.4 Excluir
1. Clica ícone lixeira
2. Overlay de confirmação: "Os lançamentos já gerados não serão removidos."
3. Confirma → `deleteDoc`

### 8.5 Lançamento Automático (Server)
1. Cloud Function roda 6h diariamente
2. Para cada recorrente ativa com `proximaData <= hoje`:
   - Cria transação com `automatica: true`
   - PIX/Débito → `pago: true`, outros → `pago: false`
   - Avança `proximaData` para próximo ciclo
3. Às 7h, `enviarLembretesFinanceiros` notifica sobre vencimentos

---

## 9. PROBLEMAS IDENTIFICADOS

### 🔴 Problema #1 — GRAVE: `proximaData` recalculada ao editar pode criar duplicatas
**Onde:** `js/recorrentes.js` → form submit
**O quê:** Ao editar qualquer campo (ex: trocar categoria), `proximaData` é recalculada a partir de "hoje". Se a Cloud Function já processou hoje e avançou a data, a edição regride a data, fazendo a CF processar novamente amanhã.
**Impacto:** Transação duplicada no mês.
**🔧 SOLUÇÃO:** Só recalcular `proximaData` se periodicidade ou diaVencimento mudou:
```javascript
// No form submit, ao editar:
const id = document.getElementById('recId').value;
if (id) {
    const recOriginal = recorrentes.find(r => r.id === id);
    const mudouPeriodo = recOriginal && (
        recOriginal.periodicidade !== periodicidade ||
        recOriginal.diaVencimento !== diaVencimento
    );
    if (mudouPeriodo) {
        dados.proximaData = Timestamp.fromDate(calcProximaData(periodicidade, diaVencimento));
    } else {
        delete dados.proximaData; // Mantém a data existente
    }
    await updateDoc(doc(db, 'usuarios', currentUser.uid, 'recorrentes', id), dados);
} else {
    dados.criadoEm = serverTimestamp();
    await addDoc(collection(db, 'usuarios', currentUser.uid, 'recorrentes'), dados);
}
```

---

### 🔴 Problema #2 — GRAVE: Cloud Function processa TODOS os usuários, mesmo Free
**Onde:** `functions/index.js` → `processarRecorrentes` (linha ~908)
**O quê:** Comentário diz "Processar recorrentes para todos os planos (free e starter inclusos)" — mas o front-end bloqueia Free/Starter de criar recorrentes. Se por algum bug um Free criou recorrentes (ex: fez downgrade), a CF continua processando.
**Impacto:** Incoerência de plano. Free pode ter transações automáticas geradas.
**🔧 SOLUÇÃO:** Filtrar por plano na CF ou aceitar que é intencional (processar recorrentes existentes mesmo após downgrade). Se intencional, documentar a decisão. Se não:
```javascript
const planosPermitidos = ['pro', 'plus', 'trial'];
if (!planosPermitidos.includes(plano)) continue;
```

---

### 🟡 Problema #3 — MÉDIO: `calcProximaData` client vs server divergem para diária/semanal
**Onde:** Client: `js/recorrentes.js` vs Server: `functions/index.js`
**O quê:**
- **Client:** Diária e Semanal retornam `hoje` → proximaData = hoje
- **Server:** Diária soma +1 dia, Semanal soma +7 dias a partir da `proximaData` anterior
**Impacto:** Ao criar recorrente diária, `proximaData = hoje` → CF processa imediatamente no mesmo dia e avança para amanhã. Correto na prática, mas a lógica client-side para semanal está errada: retorna `hoje` quando deveria calcular o próximo dia da semana.
**🔧 SOLUÇÃO:** No client, calcular adequadamente:
```javascript
if (periodicidade === 'diaria') return hoje; // OK — CF soma +1
if (periodicidade === 'semanal') return hoje; // OK se quiser que lance hoje — CF soma +7
```
A lógica atual funciona, mas o `calcProximaData` do client deveria ser renomeado para `calcPrimeiraData` para evitar confusão.

---

### 🟡 Problema #4 — MÉDIO: Dashboard duplica detecção de recorrentes por nome (case-insensitive)
**Onde:** `js/dashboard.js` (linhas ~775-795)
**O quê:** O dashboard verifica se já existe transação no mês com `descricao.toLowerCase() === nomeNorm`. Se o usuário editou a descrição da recorrente mas a transação antiga já existe com o nome antigo, a deduplicação falha.
**Impacto:** Recorrente pode aparecer como "vencida" no dashboard mesmo quando a transação já foi gerada (com nome diferente).
**🔧 SOLUÇÃO:** Usar `recorrenteId` ao invés de comparar por nome:
```javascript
const jaTemTransacao = (transacoesGlobais || []).some(t =>
    t.recorrenteId === r.id &&
    t.dataReferencia && t.dataReferencia.startsWith(mesAtual)
);
```
Obs: As transações geradas pela CF já têm `recorrenteId`. As manuais criadas pelo dashboard não.

---

### 🟡 Problema #5 — MÉDIO: Transação manual do dashboard não inclui `recorrenteId`
**Onde:** `js/dashboard.js` → `marcarPagoDashboard()` (linhas ~668-680)
**O quê:** Quando o usuário marca "Pago" em uma recorrente pelo dashboard (criando transação manual), o documento NÃO inclui `recorrenteId` nem `automatica`. Inclui apenas `recorrente: true`.
**Impacto:** Não há como vincular a transação manual de volta à recorrente original. Deduplicação depende de nome.
**🔧 SOLUÇÃO:** Passar `recorrenteId` no `recorrenteData` e incluir na transação:
```javascript
await addDoc(collection(db, 'usuarios', usuarioAtualId, 'transacoes'), {
    descricao: rd.nome,
    valor: rd.valor,
    tipo: 'despesa',
    categoria: rd.categoria || 'Outros',
    dataReferencia: rd.dataRef,
    recorrenteId: rd.recorrenteId || null,  // ← NOVO
    origem: 'manual',
    dataCriacao: serverTimestamp(),
    pago: true,
    confirmado: true,
    recorrente: true
});
```

---

### 🟡 Problema #6 — MÉDIO: Overlay do `excluirRec` usa classes Tailwind dinâmicas
**Onde:** `js/recorrentes.js` → `excluirRec()`
**O quê:** O overlay de confirmação é criado via `createElement` com `className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] ...'`. Classes como `bg-black/40`, `z-[9999]`, `backdrop-blur-sm` são dinâmicas e podem não existir no build estático do Tailwind.
**Impacto:** Overlay pode ficar invisível/sem estilo se essas classes não estiverem no CSS compilado.
**🔧 SOLUÇÃO:** Usar `style` inline:
```javascript
const ov = document.createElement('div');
ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
```

---

### 🟡 Problema #7 — MÉDIO: Não há proteção contra múltiplos submits no formulário
**Onde:** `js/recorrentes.js` → form submit
**O quê:** Se o usuário clica "Salvar" múltiplas vezes rapidamente, pode criar duplicatas.
**Impacto:** Recorrentes duplicadas no Firestore.
**🔧 SOLUÇÃO:**
```javascript
let _salvando = false;
document.getElementById('formRec').addEventListener('submit', async e => {
    e.preventDefault();
    if (_salvando) return;
    _salvando = true;
    try {
        // ... lógica existente ...
    } finally {
        _salvando = false;
    }
});
```

---

### 🟢 Problema #8 — LEVE: Recorrente com forma "Crédito" não vincula a cartão específico
**Onde:** `js/recorrentes.js` — Save de dados + Cloud Function
**O quê:** O campo `formaPagamento: 'Crédito'` existe, mas não há `cartaoId`. Quando a CF gera a transação, não há como saber em qual cartão aquela despesa cai.
**Impacto:** Fatura do cartão não inclui automaticamente as recorrentes de crédito.
**🔧 SOLUÇÃO (futuro):** Adicionar dropdown de cartão quando forma = 'Crédito':
```javascript
// No modal, após selecionar "Crédito":
if (val === 'Crédito') {
    // Mostrar dropdown com cartões do usuário
    // Salvar cartaoId no documento
}
```

---

### 🟢 Problema #9 — LEVE: CF não verifica se transação duplicada já existe
**Onde:** `functions/index.js` → `processarRecorrentes`
**O quê:** A CF cria uma transação quando `proximaData <= hoje`, mas se falhar ao atualizar a `proximaData` (ex: timeout), na próxima execução criará outra igual.
**Impacto:** Transações duplicadas em caso de falha parcial.
**🔧 SOLUÇÃO:** Verificar se já existe transação com `recorrenteId` e `data` iguais antes de criar, ou usar batch/transaction:
```javascript
const existeSnap = await db.collection("usuarios").doc(uid)
    .collection("transacoes")
    .where("recorrenteId", "==", recDoc.id)
    .where("data", "==", rec.proximaData)
    .limit(1).get();
if (!existeSnap.empty) { /* skip, já processada */ }
```

---

### 🟢 Problema #10 — LEVE: Campo `recorrente: true` vs `automatica: true` — inconsistência
**Onde:** Dashboard cria com `recorrente: true`, CF cria com `automatica: true` + `recorrenteId`
**O quê:** Dois campos diferentes indicam a mesma coisa (que a transação veio de uma recorrente).
**Impacto:** Extrato identifica recorrente por `t.recorrente === true`, mas transações da CF usam `automatica: true`. Extrato pode não marcar "REC" em transações automáticas.
**🔧 SOLUÇÃO:** A CF deveria incluir `recorrente: true` também:
```javascript
await db.collection("usuarios").doc(uid).collection("transacoes").add({
    // ... campos existentes ...
    recorrente: true,  // ← ADICIONAR
    automatica: true,
    recorrenteId: recDoc.id
});
```

---

### 🟢 Problema #11 — LEVE: Dashboard só mostra recorrentes do tipo 'despesa' na seção "Contas a Vencer"
**Onde:** `js/dashboard.js` (linha ~775)
**O quê:** `recorrentesGlobaisDash.filter(r => r.ativa !== false && r.tipo === 'despesa')` — receitas recorrentes são completamente ignoradas.
**Impacto:** Zero visibilidade de receitas recorrentes pendentes no dashboard. Não é necessariamente um bug (receitas não "vencem"), mas poderia ter uma seção "Receitas esperadas".
**🔧 SOLUÇÃO (opcional):** Criar seção separada "Receitas esperadas este mês" no dashboard:
```javascript
// Após a seção de contas a vencer, adicionar:
const recReceitas = recorrentesGlobaisDash.filter(r => r.ativa !== false && r.tipo === 'receita');
recReceitas.forEach(r => {
    const dia = r.diaVencimento || 1;
    const dataEsperada = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    const diff = Math.round((dataEsperada - hoje) / (1000*60*60*24));
    // Mostrar em card verde separado: "💰 Salário esperado em X dias"
});
```
**Nota:** Como "receita" não vence (não é obrigação), considerar se faz sentido pro contexto do app.

---

### 🟢 Problema #12 — LEVE: `tipoAtual` inicializa como 'receita' mas `abrirModal()` reseta para 'despesa'
**Onde:** `js/recorrentes.js`
**O quê:** A variável global `tipoAtual = 'receita'`, mas ao abrir modal para novo, chama `setTipo('despesa')`. A variável não é usada em mais nenhum lugar relevante — é apenas pro estado do modal.
**Impacto:** Nenhum impacto funcional, mas confuso manter.
**🔧 SOLUÇÃO:** Alinhar inicialização com o comportamento real:
```javascript
// Mudar de:
let tipoAtual = 'receita';
// Para:
let tipoAtual = 'despesa'; // Default real (modal abre como despesa)
```

---

### 🟢 Problema #13 — LEVE: `preencherCategorias` reseta seleção ao trocar tipo
**Onde:** `js/recorrentes.js` → `preencherCategorias()`
**O quê:** No final da função, reseta `recCategoria = ''` e label para "Selecione…". Isso é chamado toda vez que o tipo muda (listeners em btnReceita/btnDespesa).
**Impacto:** Se o usuário trocou o tipo por engano e voltou, perde a categoria selecionada.
**🔧 SOLUÇÃO:** Não resetar se a categoria selecionada existe na nova lista:
```javascript
function preencherCategorias(tipo) {
    const padrao = tipo === 'receita' ? catsReceita : catsDespesa;
    const custom = categoriasCustomRec.filter(c => c.tipo === tipo).map(c => c.nome);
    const todas = [...new Set([...custom, ...padrao])].sort((a,b) => a.localeCompare(b,'pt-BR'));
    const container = document.getElementById('catRecItems');
    container.innerHTML = todas.map(c => { /* ... igual ... */ }).join('');
    
    // Só reseta se a categoria atual NÃO existe na nova lista
    const catAtual = document.getElementById('recCategoria').value;
    if (!catAtual || !todas.includes(catAtual)) {
        document.getElementById('recCategoria').value = '';
        document.getElementById('catRecLabel').innerHTML = '<span class="text-slate-400">Selecione…</span>';
    }
}
```

---

### 🟢 Problema #14 — LEVE: `window._recMap` exposto globalmente
**Onde:** `js/recorrentes.js` → `renderizar()` (linha `window._recMap = recMap`)
**O quê:** Map de todas as recorrentes é exposto no window para que o onclick do botão editar funcione (`window._recMap.get('id')`).
**Impacto:** Funcional, mas não é uma prática ideal. Qualquer script pode acessar/modificar.
**🔧 SOLUÇÃO:** Usar closure + index do array (já disponível via `recorrentes`):
```javascript
// Opção 1: usar index do array recorrentes
window.editarRecPorIndex = function(idx) { abrirModal(recorrentes[idx]); };
// No template: onclick="editarRecPorIndex(${idx})"

// Opção 2 (melhor): manter _recMap mas como let privado do módulo
// (já funciona pois é ES module, window._recMap é só conveniência)
// Criar função exposta:
window.editarRec = function(id) { abrirModal(recorrentes.find(r => r.id === id)); };
// No template: onclick="editarRec('${r.id}')"
// Remove necessidade do Map exposto
```

---

### 🔴 Problema #15 — GRAVE: CF usa campo `data` (Timestamp) mas dashboard usa `dataReferencia` (string)
**Onde:** `functions/index.js` → `processarRecorrentes` vs `js/dashboard.js` → `atualizarContasVencer()` + `marcarPagoDashboard()`
**O quê:** A Cloud Function cria transações com:
```javascript
{ data: rec.proximaData, recorrenteId: recDoc.id, automatica: true }
```
Mas o dashboard faz deduplicação por:
```javascript
t.dataReferencia && t.dataReferencia.startsWith(mesAtual)
```
Transações geradas pela CF **NÃO têm `dataReferencia`** (campo inexistente → `undefined`). Então `undefined && ...` → `false` → deduplicação **FALHA SEMPRE**.
**Impacto:** Recorrentes aparecem como "Vencidas" ou "Lembretes" no dashboard MESMO quando a CF já gerou a transação do mês. O usuário pode clicar "Pago" e criar uma transação DUPLICADA manual.
**🔧 SOLUÇÃO (CF):** Incluir `dataReferencia` como string na transação gerada:
```javascript
const proxDate = rec.proximaData.toDate();
const y = proxDate.getFullYear();
const m = String(proxDate.getMonth()+1).padStart(2,'0');
const d = String(proxDate.getDate()).padStart(2,'0');

await db.collection("usuarios").doc(uid).collection("transacoes").add({
    // ... campos existentes ...
    data: rec.proximaData,
    dataReferencia: `${y}-${m}-${d}`,  // ← ADICIONAR
    recorrenteId: recDoc.id,
    automatica: true,
    recorrente: true,  // ← ADICIONAR para badge no extrato
    pago: pagoImediato,
    criadoEm: Timestamp.now()
});
```
**🔧 SOLUÇÃO (Dashboard):** Complementar deduplicação com `recorrenteId` + campo `data`:
```javascript
const jaTemTransacao = (transacoesGlobais || []).some(t => {
    // Método 1: por dataReferencia (transações manuais)
    if ((t.descricao||'').toLowerCase() === nomeNorm && t.dataReferencia && t.dataReferencia.startsWith(mesAtual)) return true;
    // Método 2: por recorrenteId (transações da CF)
    if (t.recorrenteId === r.id) {
        const tDate = t.data?.toDate ? t.data.toDate() : (t.data ? new Date(t.data) : null);
        if (tDate && tDate.getFullYear() === hoje.getFullYear() && tDate.getMonth() === hoje.getMonth()) return true;
    }
    return false;
});
```

---

### 🔴 Problema #16 — GRAVE: Dashboard ignora `periodicidade` — trata TUDO como mensal
**Onde:** `js/dashboard.js` → `atualizarContasVencer()` (Fonte 2: Recorrentes)
**O quê:**
```javascript
const dia = r.diaVencimento || 1;
let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
```
Usa `diaVencimento` diretamente, ignorando completamente `r.periodicidade`.
- **Recorrente diária** com `diaVencimento: 15` → dashboard mostra só dia 15 do mês, quando deveria ser TODOS os dias
- **Recorrente semanal** com `diaVencimento: 1` → dashboard mostra só dia 1, quando deveria mostrar semanalmente
**Impacto:** Recorrentes diárias e semanais não aparecem corretamente no dashboard. Podem nunca aparecer como "a vencer" ou aparecer como eternamente atrasadas.
**🔧 SOLUÇÃO:** Usar `proximaData` da recorrente em vez de calcular por `diaVencimento`:
```javascript
recAtivas.forEach(r => {
    // Usar proximaData real ao invés de calcular
    const proxDate = r.proximaData?.toDate ? r.proximaData.toDate() : 
                     (r.proximaData ? new Date(r.proximaData) : null);
    if (!proxDate) return;
    proxDate.setHours(0,0,0,0);
    const diff = Math.round((proxDate - hoje) / (1000*60*60*24));
    
    // Deduplicação usando recorrenteId
    const jaTemTransacao = /* ... verificar conforme solução do Problema #15 ... */;
    if (jaTemTransacao) return;
    
    const item = { nome: r.descricao, valor: r.valor, categoria: r.categoria, 
                   dataVenc: proxDate, diasRestantes: diff, origem: 'recorrente', transacaoId: null };
    if (diff < 0) vencidas.push(item);
    else if (diff <= 7) lembretes.push(item);
});
```

---

### 🔴 Problema #17 — GRAVE: Cards de recorrentes usam mini-mapa de ícones (14 entradas) em vez de `getEmojiRec()` (60+)
**Onde:** `js/recorrentes.js` → `renderizar()` → bloco de mapeamento de ícones nos cards
**O quê:**
```javascript
const icons = { 'Alimentação':'🍕','Transporte':'🚗','Moradia':'🏠','Saúde':'💊','Educação':'📚',
    'Lazer':'🎮','Vestuário':'👔','Assinatura':'📱','Salário':'💰','Freelance':'💻',
    'Investimentos':'📈','Netflix':'🎬','Spotify':'🎵','Outros':'🔄' };
const icon = icons[r.categoria] || (isDespesa ? '↓' : '↑');
```
Este mapa tem **14 entradas genéricas** ("Alimentação", "Transporte", etc.) mas as categorias reais do app são **específicas** ("Aluguel", "Mercado", "Plano de Saúde", etc.). O mapa `catEmojiMapRec` com ~60 entradas já existe mas NÃO é usado aqui.
**Impacto:** A maioria das categorias cai no fallback `↓`/`↑`, deixando os cards feios e sem contexto visual. Exemplo: "Aluguel" mostra ↓ em vez de 🏠, "Mercado" mostra ↓ em vez de 🛒.
**🔧 SOLUÇÃO:** Usar `getEmojiRec()` que já existe:
```javascript
// Remover o mini-mapa e substituir por:
const icon = getEmojiRec(r.categoria) || (isDespesa ? '↓' : '↑');
```

---

### 🟡 Problema #18 — MÉDIO: `tab-active` class nunca é aplicada → categorias sempre refresh para 'despesa'
**Onde:** `js/recorrentes.js` → listener de `onSnapshot('categorias')` (linha do `tipoSel`)
**O quê:**
```javascript
const tipoSel = document.querySelector('#btnReceita.tab-active') ? 'receita' : 'despesa';
preencherCategorias(tipoSel);
```
A classe `.tab-active` **NUNCA é aplicada** aos botões. O `setTipo()` usa classes como `bg-white text-emerald-700 shadow-sm` (ativo) e `text-slate-500 bg-transparent` (inativo). Então `document.querySelector('#btnReceita.tab-active')` **SEMPRE retorna null**.
**Impacto:** Quando o snapshot de categorias customizadas dispara (ex: outra aba adicionou categoria), o dropdown **SEMPRE reseta para 'despesa'**, mesmo que o modal esteja aberto em modo 'receita'. Categorias de receita somem do dropdown.
**🔧 SOLUÇÃO:** Usar a variável `tipoAtual` que já rastreia o estado:
```javascript
preencherCategorias(tipoAtual);
```

---

### 🟡 Problema #19 — MÉDIO: CF não trata "Débito automático" como pago imediato
**Onde:** `functions/index.js` → `processarRecorrentes`
**O quê:**
```javascript
const pagoImediato = ["pix", "débito", "debito"].includes(formaPagRec);
```
`"débito automático".toLowerCase()` = `"débito automático"` → **NÃO está na lista**. Mesmo lógica no dashboard:
```javascript
!['pix', 'débito', 'debito'].includes((t.formaPagamento || '').toLowerCase())
```
**Impacto:** Recorrentes com forma "Débito automático" (ex: conta de luz) são marcadas como `pago: false`, aparecendo como pendentes no dashboard — quando na realidade já foram debitadas automaticamente.
**🔧 SOLUÇÃO:** Incluir "débito automático" na lista:
```javascript
const pagoImediato = ["pix", "débito", "debito", "débito automático", "debito automatico"].includes(formaPagRec);
```

---

### 🟡 Problema #20 — MÉDIO: Sem try/catch no form submit, toggleAtivo e excluirRec
**Onde:** `js/recorrentes.js` → handlers de submit, toggleAtivo, excluirRec (após confirmação)
**O quê:** Nenhuma dessas funções tem tratamento de erro:
```javascript
// form submit: await updateDoc(...) ou addDoc(...) — sem try/catch
// toggleAtivo: await updateDoc(...) — sem try/catch
// excluirRec: await deleteDoc(...) — sem try/catch
```
**Impacto:** Se o Firestore falhar (offline, permissão, etc.), operação silenciosamente falha. User pensa que salvou mas não salvou.
**🔧 SOLUÇÃO:** Wrapping em try/catch + budShowToast:
```javascript
try {
    await updateDoc(...);
    window.budShowToast('Recorrente salva!', 'success');
} catch (e) {
    console.error(e);
    window.budShowToast('Erro ao salvar. Tente novamente.', 'error');
}
```

---

### 🟡 Problema #21 — MÉDIO: Toggle de ativa é optimistic UI sem rollback
**Onde:** `js/recorrentes.js` → toggle-pill no card
**O quê:** O checkbox muda visualmente no instante do click (comportamento nativo do `<input type="checkbox">`), e depois dispara `toggleAtivo()`. Se `updateDoc` falhar, o checkbox fica no estado errado mas o Firestore não mudou.
**Impacto:** UI mostra recorrente como ativa/desativada, mas o estado real no server é diferente. Sem feedback de erro.
**🔧 SOLUÇÃO:** 
```javascript
window.toggleAtivo = async function(id, val) {
    try {
        await updateDoc(doc(db, 'usuarios', currentUser.uid, 'recorrentes', id), { ativa: val });
    } catch(e) {
        // onSnapshot vai corrigir a UI, mas avisar o usuário
        window.budShowToast('Erro ao atualizar. Tente novamente.', 'error');
    }
};
```
Nota: o `onSnapshot` eventualmente corrige a UI ao receber o estado real do server.

---

### 🟡 Problema #22 — MÉDIO: `sincronizarDados()` não faz sync real
**Onde:** `js/recorrentes.js` (linha ~19)
**O quê:**
```javascript
window.sincronizarDados = function() { renderizar(); };
```
O botão de refresh (↻) chama esta função que apenas re-renderiza dados já em cache. **Não refaz busca no Firestore.** Como os dados vêm via `onSnapshot` (realtime), na teoria já estão sempre atualizados — mas se o listener desconectou, o refresh não ajuda.
**Impacto:** Botão dá falsa sensação de "sincronizou" quando na verdade não fez nada útil.

---

### 🟡 Problema #23 — MÉDIO: `diaVencimento` não validado no submit — pode salvar 0, 35, -5...
**Onde:** `js/recorrentes.js` → form submit
**O quê:** 
```javascript
const diaVencimento = parseInt(document.getElementById('recDia').value) || 1;
```
O input HTML tem `min="1" max="31"`, mas HTML min/max não é enforced em todos os browsers. O `parseInt` pode gerar qualquer número, e o `|| 1` só protege contra NaN/0. Valores como 35 ou -5 seriam salvos.
- `calcProximaData` no client faz `Math.max(1, Math.min(31, ...))` — protege na hora do cálculo
- Mas o **documento no Firestore** fica com `diaVencimento: 35`
- A **CF** faz `parseInt(diaVencimento) || 1` sem clamp → pode calcular datas inválidas
**Impacto:** Dados corrompidos no Firestore; CF pode gerar datas inválidas.
**🔧 SOLUÇÃO:** Validar antes de salvar:
```javascript
const diaVencimento = Math.max(1, Math.min(31, parseInt(document.getElementById('recDia').value) || 1));
```

---

### 🟢 Problema #24 — LEVE: Variável `canUse` é dead code
**Onde:** `js/recorrentes.js` → onAuthStateChanged (primeira verificação de plano)
**O quê:**
```javascript
const canUse = (window.NexoPlanos && typeof window.NexoPlanos.canUseFeature === 'function')
    ? window.NexoPlanos.canUseFeature({ plano: 'pro' }, 'recurringTransactions')
    : true;
```
Esta variável `canUse` é computada com um objeto hardcoded `{ plano: 'pro' }` (sempre retorna true para Pro). Depois, **NUNCA é usada** — o código segue para carregar `userData` e computar `canRecurring` separadamente.
**Impacto:** Código morto que confunde a leitura. Zero impacto funcional.
**🔧 SOLUÇÃO:** Remover as 3 linhas.

---

### 🟢 Problema #25 — LEVE: `getDocs` importado mas nunca usado
**Onde:** `js/recorrentes.js` (linha 3)
**O quê:** `import { ..., getDocs, ... }` — `getDocs` não é chamado em nenhum lugar do arquivo. Dados são carregados via `onSnapshot`.
**Impacto:** Import desnecessário. Não afeta funcionalidade (tree-shaking não se aplica a ESM via CDN).

---

### 🟢 Problema #26 — LEVE: Sem loading state entre auth e dados carregados
**Onde:** `recorrentes.html` + `js/recorrentes.js`
**O quê:** Na inicialização, tanto `#planGate` quanto `#mainContent` estão `hidden`. Entre o login do auth e o retorno do `getDoc(userData)`, o usuário vê uma página vazia (só header).
**Impacto:** Experiência ruim em conexões lentas. Parece que a página quebrou.
**🔧 SOLUÇÃO:** Adicionar spinner/skeleton visível por padrão que é removido quando #mainContent ou #planGate aparecem.

---

## 10. CHECKLIST PARA NOVO PROJETO

### Prioridade CRÍTICA (quebra funcionalidade):
- [ ] CF: adicionar `dataReferencia` (string "YYYY-MM-DD") nas transações geradas — sem isso, deduplicação no dashboard falha
- [ ] CF: adicionar `recorrente: true` nas transações geradas — sem isso, badge REC no extrato não aparece
- [ ] Dashboard: usar `proximaData` da recorrente ao invés de calcular por `diaVencimento` — corrige diária/semanal
- [ ] Dashboard: deduplicar por `recorrenteId` + campo `data` (Timestamp), não apenas por nome + `dataReferencia`
- [ ] Cards: usar `getEmojiRec(r.categoria)` ao invés do mini-mapa de 14 entradas

### Prioridade ALTA:
- [ ] Não recalcular `proximaData` ao editar se periodicidade/dia não mudou
- [ ] Corrigir `tab-active` → usar `tipoAtual` para refresh de categorias no onSnapshot
- [ ] CF: incluir "débito automático" como pago imediato
- [ ] Adicionar flag `_salvando` no form submit contra duplo-click
- [ ] Adicionar try/catch + budShowToast em submit, toggleAtivo, excluirRec
- [ ] Validar `diaVencimento` com Math.max(1, Math.min(31, ...)) antes de salvar

### Prioridade MÉDIA:
- [ ] Unificar `calcProximaData` — mesma lógica client/server
- [ ] Dashboard: incluir `recorrenteId` ao criar transação manual
- [ ] Toggle checkbox: feedback de erro se updateDoc falhar
- [ ] Overlay de excluir: usar `style` inline em vez de classes Tailwind dinâmicas
- [ ] Decidir se Free/Starter deve ou não processar recorrentes na CF
- [ ] Padronizar campos: `recorrente: true` + `automatica: true` + `recorrenteId` em todas as origens

### Prioridade BAIXA:
- [ ] Considerar vincular `cartaoId` quando forma = 'Crédito'
- [ ] Remover dead code (`canUse`, import `getDocs`)
- [ ] Adicionar loading state/skeleton entre auth e dados carregados
- [ ] `sincronizarDados()` — tornar util ou remover botão

---

## 11. RESUMO DE MÉTRICAS

| Métrica | Valor |
|---------|-------|
| Linhas HTML | ~290 |
| Linhas JS (client) | ~490 |
| Categorias despesa | 49 |
| Categorias receita | 15 |
| Emojis mapeados | ~60 |
| Formas de pagamento | 6 |
| Periodicidades | 3 (mensal, semanal, diária) |
| Integrações cross-codebase | 9 módulos |
| Problemas identificados | **26** (5 graves, 8 médios, 6 leves, 7 notas) |
| Cloud Functions envolvidas | 2 (processarRecorrentes, enviarLembretesFinanceiros) |
| Planos com acesso | Pro, Plus, Trial |
