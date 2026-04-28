# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.js >> Dashboard — Estrutura HTML >> sidebar tem 1 link de navegação (Dashboard)
- Location: tests\dashboard.spec.js:131:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.sidebar-nav .sidebar-link')
Expected: 1
Received: 4
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('.sidebar-nav .sidebar-link')
    9 × locator resolved to 4 elements
      - unexpected value "4"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - complementary [ref=e3]:
    - button "Recolher sidebar" [ref=e4] [cursor=pointer]: ‹
    - generic [ref=e5]:
      - img "Bud Finance" [ref=e6]
      - generic [ref=e7]: Bud Finance
    - navigation [ref=e8]:
      - link "📊 Dashboard" [ref=e9] [cursor=pointer]:
        - /url: dashboard.html
        - generic [ref=e10]: 📊
        - generic [ref=e11]: Dashboard
      - link "🏆 Metas" [ref=e12] [cursor=pointer]:
        - /url: metas.html
        - generic [ref=e13]: 🏆
        - generic [ref=e14]: Metas
      - link "💳 Cartões" [ref=e15] [cursor=pointer]:
        - /url: cartoes.html
        - generic [ref=e16]: 💳
        - generic [ref=e17]: Cartões
      - link "⚙️ Configurações" [ref=e18] [cursor=pointer]:
        - /url: configuracoes.html
        - generic [ref=e19]: ⚙️
        - generic [ref=e20]: Configurações
    - generic [ref=e21]:
      - generic [ref=e22]: "?"
      - generic [ref=e23]:
        - generic [ref=e24]: Carregando...
        - generic [ref=e25]: "---"
    - button "🚪 Sair" [ref=e26] [cursor=pointer]:
      - generic [ref=e27]: 🚪
      - generic [ref=e28]: Sair
  - main [ref=e29]:
    - generic [ref=e30]:
      - generic [ref=e32]:
        - heading "Bom dia! 👋" [level=1] [ref=e33]
        - paragraph [ref=e34]: Carregando...
      - generic [ref=e35]:
        - button "👁️" [ref=e36] [cursor=pointer]
        - button "🔄" [ref=e37] [cursor=pointer]
    - navigation "Navegação por mês" [ref=e38]:
      - button "Mês anterior" [ref=e39] [cursor=pointer]: ‹
      - generic [ref=e40]: Carregando...
      - button "Próximo mês" [ref=e41] [cursor=pointer]: ›
    - generic [ref=e42]:
      - generic [ref=e43]:
        - generic [ref=e44]:
          - generic [ref=e45]: Resultado do Mês
          - generic [ref=e46]: 💰
        - generic [ref=e47]: R$ 0,00
        - generic [ref=e48]: —
      - generic [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]: Entradas do Mês
          - generic [ref=e52]: 📈
        - generic [ref=e53]: R$ 0,00
        - generic [ref=e54]: —
      - generic [ref=e55]:
        - generic [ref=e56]:
          - generic [ref=e57]: Saídas do Mês
          - generic [ref=e58]: 📉
        - generic [ref=e59]: R$ 0,00
        - generic [ref=e60]: —
    - generic [ref=e61]:
      - button "+ Nova Receita Registrar entrada" [ref=e62] [cursor=pointer]:
        - generic [ref=e63]: +
        - generic [ref=e64]:
          - generic [ref=e65]: Nova Receita
          - generic [ref=e66]: Registrar entrada
      - button "− Nova Despesa Registrar saída" [ref=e67] [cursor=pointer]:
        - generic [ref=e68]: −
        - generic [ref=e69]:
          - generic [ref=e70]: Nova Despesa
          - generic [ref=e71]: Registrar saída
    - generic [ref=e72]:
      - generic [ref=e73]:
        - generic [ref=e74]:
          - generic [ref=e75]: Atividades Recentes
          - generic [ref=e76]: "0"
        - generic [ref=e77]:
          - button "Todos" [ref=e78] [cursor=pointer]
          - button "↑ Receitas" [ref=e79] [cursor=pointer]
          - button "↓ Despesas" [ref=e80] [cursor=pointer]
      - generic [ref=e81]:
        - generic [ref=e82]: 📝
        - paragraph [ref=e83]:
          - text: Nenhuma transação este mês.
          - text: Comece adicionando uma receita ou despesa!
    - generic [ref=e84]:
      - generic [ref=e85]: Despesas por Categoria
      - generic [ref=e86]:
        - generic [ref=e87]: 📊
        - paragraph [ref=e88]: Nenhuma despesa registrada neste mês.
```

# Test source

```ts
  33  |   });
  34  | 
  35  |   test('sidebar existe no DOM', async ({ page }) => {
  36  |     const sidebar = page.locator('#sidebar');
  37  |     await expect(sidebar).toHaveCount(1);
  38  |   });
  39  | 
  40  |   test('sidebar contém logo Bud Finance', async ({ page }) => {
  41  |     const logo = page.locator('.sidebar-logo span');
  42  |     await expect(logo).toHaveText('Bud Finance');
  43  |   });
  44  | 
  45  |   test('sidebar tem link Dashboard ativo', async ({ page }) => {
  46  |     const link = page.locator('.sidebar-link.active');
  47  |     await expect(link).toContainText('Dashboard');
  48  |   });
  49  | 
  50  |   test('sidebar tem botão Sair', async ({ page }) => {
  51  |     const btn = page.locator('#btnLogout');
  52  |     await expect(btn).toHaveCount(1);
  53  |     await expect(btn).toContainText('Sair');
  54  |   });
  55  | 
  56  |   test('3 cards de resumo existem no DOM', async ({ page }) => {
  57  |     const cards = page.locator('.summary-card');
  58  |     await expect(cards).toHaveCount(3);
  59  |   });
  60  | 
  61  |   test('card Resultado do Mês existe', async ({ page }) => {
  62  |     const label = page.locator('.card-label').filter({ hasText: 'Resultado do Mês' });
  63  |     await expect(label).toHaveCount(1);
  64  |   });
  65  | 
  66  |   test('card Entradas do Mês existe', async ({ page }) => {
  67  |     const label = page.locator('.card-label').filter({ hasText: 'Entradas do Mês' });
  68  |     await expect(label).toHaveCount(1);
  69  |   });
  70  | 
  71  |   test('card Saídas do Mês existe', async ({ page }) => {
  72  |     const label = page.locator('.card-label').filter({ hasText: 'Saídas do Mês' });
  73  |     await expect(label).toHaveCount(1);
  74  |   });
  75  | 
  76  |   test('botão hamburger existe (para mobile)', async ({ page }) => {
  77  |     const btn = page.locator('#btnHamburger');
  78  |     await expect(btn).toHaveCount(1);
  79  |   });
  80  | 
  81  |   test('banner trial existe no DOM (inicialmente oculto)', async ({ page }) => {
  82  |     const banner = page.locator('#trialBanner');
  83  |     await expect(banner).toHaveCount(1);
  84  |     await expect(banner).not.toHaveClass(/show/);
  85  |   });
  86  | 
  87  |   test('botão toggle valores existe', async ({ page }) => {
  88  |     const btn = page.locator('#btnToggleValues');
  89  |     await expect(btn).toHaveCount(1);
  90  |   });
  91  | 
  92  |   test('botão sync existe', async ({ page }) => {
  93  |     const btn = page.locator('#btnSync');
  94  |     await expect(btn).toHaveCount(1);
  95  |   });
  96  | 
  97  |   test('quick actions: Nova Receita e Nova Despesa existem', async ({ page }) => {
  98  |     const receita = page.locator('#btnNovaReceita');
  99  |     const despesa = page.locator('#btnNovaDespesa');
  100 |     await expect(receita).toHaveCount(1);
  101 |     await expect(despesa).toHaveCount(1);
  102 |   });
  103 | 
  104 |   test('seção Atividades Recentes existe', async ({ page }) => {
  105 |     const section = page.locator('.dash-section-title').filter({ hasText: 'Atividades Recentes' });
  106 |     await expect(section).toHaveCount(1);
  107 |   });
  108 | 
  109 |   test('seção Despesas por Categoria existe', async ({ page }) => {
  110 |     const section = page.locator('.dash-section-title').filter({ hasText: 'Despesas por Categoria' });
  111 |     await expect(section).toHaveCount(1);
  112 |   });
  113 | 
  114 |   test('blobs decorativos existem', async ({ page }) => {
  115 |     const blueBlob = page.locator('.blob-blue');
  116 |     const cyanBlob = page.locator('.blob-cyan');
  117 |     await expect(blueBlob).toHaveCount(1);
  118 |     await expect(cyanBlob).toHaveCount(1);
  119 |   });
  120 | 
  121 |   test('scripts firebase-config e bud-utils carregados', async ({ page }) => {
  122 |     const scripts = page.locator('script[src="js/firebase-config.js"], script[src="js/bud-utils.js"]');
  123 |     await expect(scripts).toHaveCount(2);
  124 |   });
  125 | 
  126 |   test('dashboard.js declarado como module', async ({ page }) => {
  127 |     const script = page.locator('script[type="module"][src="js/dashboard.js"]');
  128 |     await expect(script).toHaveCount(1);
  129 |   });
  130 | 
  131 |   test('sidebar tem 1 link de navegação (Dashboard)', async ({ page }) => {
  132 |     const navLinks = page.locator('.sidebar-nav .sidebar-link');
> 133 |     await expect(navLinks).toHaveCount(1);
      |                            ^ Error: expect(locator).toHaveCount(expected) failed
  134 |   });
  135 | 
  136 |   test('overlay sidebar existe para mobile', async ({ page }) => {
  137 |     const overlay = page.locator('#sidebarOverlay');
  138 |     await expect(overlay).toHaveCount(1);
  139 |   });
  140 | 
  141 |   // ─── Navegação de mês ──────────────────────────────────────────────────
  142 |   test('barra de navegação de mês existe no DOM', async ({ page }) => {
  143 |     const nav = page.locator('nav[aria-label="Navegação por mês"]');
  144 |     await expect(nav).toHaveCount(1);
  145 |   });
  146 | 
  147 |   test('botão mês anterior existe com aria-label correto', async ({ page }) => {
  148 |     const btn = page.locator('#btnMesAnterior');
  149 |     await expect(btn).toHaveCount(1);
  150 |     await expect(btn).toHaveAttribute('aria-label', 'Mês anterior');
  151 |   });
  152 | 
  153 |   test('botão próximo mês existe com aria-label correto', async ({ page }) => {
  154 |     const btn = page.locator('#btnProximoMes');
  155 |     await expect(btn).toHaveCount(1);
  156 |     await expect(btn).toHaveAttribute('aria-label', 'Próximo mês');
  157 |   });
  158 | 
  159 |   test('label navMesAno existe e tem aria-live', async ({ page }) => {
  160 |     const label = page.locator('#navMesAno');
  161 |     await expect(label).toHaveCount(1);
  162 |     await expect(label).toHaveAttribute('aria-live', 'polite');
  163 |   });
  164 | 
  165 |   test('botões de navegação são clicáveis', async ({ page }) => {
  166 |     const prev = page.locator('#btnMesAnterior');
  167 |     const next = page.locator('#btnProximoMes');
  168 |     await expect(prev).toBeEnabled();
  169 |     await expect(next).toBeEnabled();
  170 |   });
  171 | 
  172 |   // ─── Gráfico de Categorias ────────────────────────────────────────────
  173 |   test('canvas chartCategorias existe no DOM', async ({ page }) => {
  174 |     const canvas = page.locator('#chartCategorias');
  175 |     await expect(canvas).toHaveCount(1);
  176 |   });
  177 | 
  178 |   test('container do gráfico existe no DOM', async ({ page }) => {
  179 |     const container = page.locator('#graficoContainer');
  180 |     await expect(container).toHaveCount(1);
  181 |   });
  182 | 
  183 |   test('estado vazio graficoCategorias existe', async ({ page }) => {
  184 |     const empty = page.locator('#graficoCategorias');
  185 |     await expect(empty).toHaveCount(1);
  186 |   });
  187 | 
  188 |   test('seção Despesas por Categoria tem título correto', async ({ page }) => {
  189 |     const title = page.locator('.dash-section-title').filter({ hasText: 'Despesas por Categoria' });
  190 |     await expect(title).toHaveCount(1);
  191 |   });
  192 | 
  193 |   test('Chart.js carregado via script tag', async ({ page }) => {
  194 |     const script = page.locator('script[src*="chart.js"]');
  195 |     await expect(script).toHaveCount(1);
  196 |   });
  197 | 
  198 |   // ─── Editar / Excluir / Histórico ────────────────────────────────────
  199 |   test('botão excluir transação existe no modal (oculto por padrão)', async ({ page }) => {
  200 |     const btn = page.locator('#btnExcluirTransacao');
  201 |     await expect(btn).toHaveCount(1);
  202 |     await expect(btn).not.toBeVisible();
  203 |   });
  204 | 
  205 |   test('mini-modal de confirmação de exclusão existe no DOM', async ({ page }) => {
  206 |     const modal = page.locator('#modalConfirmExcluir');
  207 |     await expect(modal).toHaveCount(1);
  208 |   });
  209 | 
  210 |   test('mini-modal tem botões Cancelar e Excluir', async ({ page }) => {
  211 |     const cancelar = page.locator('#btnCancelarExcluir');
  212 |     const excluir = page.locator('#btnConfirmExcluir');
  213 |     await expect(cancelar).toHaveCount(1);
  214 |     await expect(excluir).toHaveCount(1);
  215 |   });
  216 | 
  217 |   test('modal de histórico existe no DOM', async ({ page }) => {
  218 |     const modal = page.locator('#modalHistorico');
  219 |     await expect(modal).toHaveCount(1);
  220 |   });
  221 | 
  222 |   test('modal de histórico tem botão fechar', async ({ page }) => {
  223 |     const btn = page.locator('#btnFecharHistorico');
  224 |     await expect(btn).toHaveCount(1);
  225 |   });
  226 | 
  227 |   test('modal de histórico tem container de lista', async ({ page }) => {
  228 |     const lista = page.locator('#historicoLista');
  229 |     await expect(lista).toHaveCount(1);
  230 |   });
  231 | 
  232 |   test('modal de histórico está oculto por padrão', async ({ page }) => {
  233 |     const modal = page.locator('#modalHistorico');
```