// tests/dashboard.spec.js — Bud Finance
// Testa a página de Dashboard (dashboard.html)
const { test, expect } = require('@playwright/test');

// ── Auth guard (precisa de JS habilitado) ──────────────────────────────
test.describe('Dashboard — Auth Guard', () => {

  test('sem auth, redireciona para index.html', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForURL('**/index.html', { timeout: 15_000 });
    expect(page.url()).toContain('index.html');
  });

});

// ── Estrutura HTML (JS desabilitado para evitar redirect do auth guard)
test.describe('Dashboard — Estrutura HTML', () => {

  // Bloqueia dashboard.js para evitar auth guard redirect
  test.beforeEach(async ({ page }) => {
    await page.route('**/js/dashboard.js', route => route.abort());
    await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });
  });

  test('título da página correto', async ({ page }) => {
    const title = await page.title();
    expect(title).toBe('Dashboard - Bud Finance');
  });

  test('splash screen existe no HTML', async ({ page }) => {
    const splash = page.locator('#splash');
    await expect(splash).toHaveCount(1);
  });

  test('sidebar existe no DOM', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toHaveCount(1);
  });

  test('sidebar contém logo Bud Finance', async ({ page }) => {
    const logo = page.locator('.sidebar-logo span');
    await expect(logo).toHaveText('Bud Finance');
  });

  test('sidebar tem link Dashboard ativo', async ({ page }) => {
    const link = page.locator('.sidebar-link.active');
    await expect(link).toContainText('Dashboard');
  });

  test('sidebar tem botão Sair', async ({ page }) => {
    const btn = page.locator('#btnLogout');
    await expect(btn).toHaveCount(1);
    await expect(btn).toContainText('Sair');
  });

  test('3 cards de resumo existem no DOM', async ({ page }) => {
    const cards = page.locator('.summary-card');
    await expect(cards).toHaveCount(3);
  });

  test('card Saldo Total existe', async ({ page }) => {
    const label = page.locator('.card-label').filter({ hasText: 'Saldo Total' });
    await expect(label).toHaveCount(1);
  });

  test('card Entradas do Mês existe', async ({ page }) => {
    const label = page.locator('.card-label').filter({ hasText: 'Entradas do Mês' });
    await expect(label).toHaveCount(1);
  });

  test('card Saídas do Mês existe', async ({ page }) => {
    const label = page.locator('.card-label').filter({ hasText: 'Saídas do Mês' });
    await expect(label).toHaveCount(1);
  });

  test('botão hamburger existe (para mobile)', async ({ page }) => {
    const btn = page.locator('#btnHamburger');
    await expect(btn).toHaveCount(1);
  });

  test('banner trial existe no DOM (inicialmente oculto)', async ({ page }) => {
    const banner = page.locator('#trialBanner');
    await expect(banner).toHaveCount(1);
    await expect(banner).not.toHaveClass(/show/);
  });

  test('botão toggle valores existe', async ({ page }) => {
    const btn = page.locator('#btnToggleValues');
    await expect(btn).toHaveCount(1);
  });

  test('botão sync existe', async ({ page }) => {
    const btn = page.locator('#btnSync');
    await expect(btn).toHaveCount(1);
  });

  test('quick actions: Nova Receita e Nova Despesa existem', async ({ page }) => {
    const receita = page.locator('#btnNovaReceita');
    const despesa = page.locator('#btnNovaDespesa');
    await expect(receita).toHaveCount(1);
    await expect(despesa).toHaveCount(1);
  });

  test('seção Atividades Recentes existe', async ({ page }) => {
    const section = page.locator('.dash-section-title').filter({ hasText: 'Atividades Recentes' });
    await expect(section).toHaveCount(1);
  });

  test('seção Despesas por Categoria existe', async ({ page }) => {
    const section = page.locator('.dash-section-title').filter({ hasText: 'Despesas por Categoria' });
    await expect(section).toHaveCount(1);
  });

  test('blobs decorativos existem', async ({ page }) => {
    const blueBlob = page.locator('.blob-blue');
    const cyanBlob = page.locator('.blob-cyan');
    await expect(blueBlob).toHaveCount(1);
    await expect(cyanBlob).toHaveCount(1);
  });

  test('scripts firebase-config e bud-utils carregados', async ({ page }) => {
    const scripts = page.locator('script[src="js/firebase-config.js"], script[src="js/bud-utils.js"]');
    await expect(scripts).toHaveCount(2);
  });

  test('dashboard.js declarado como module', async ({ page }) => {
    const script = page.locator('script[type="module"][src="js/dashboard.js"]');
    await expect(script).toHaveCount(1);
  });

  test('sidebar tem 1 link de navegação (Dashboard)', async ({ page }) => {
    const navLinks = page.locator('.sidebar-nav .sidebar-link');
    await expect(navLinks).toHaveCount(1);
  });

  test('overlay sidebar existe para mobile', async ({ page }) => {
    const overlay = page.locator('#sidebarOverlay');
    await expect(overlay).toHaveCount(1);
  });

  // ─── Navegação de mês ──────────────────────────────────────────────────
  test('barra de navegação de mês existe no DOM', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Navegação por mês"]');
    await expect(nav).toHaveCount(1);
  });

  test('botão mês anterior existe com aria-label correto', async ({ page }) => {
    const btn = page.locator('#btnMesAnterior');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', 'Mês anterior');
  });

  test('botão próximo mês existe com aria-label correto', async ({ page }) => {
    const btn = page.locator('#btnProximoMes');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', 'Próximo mês');
  });

  test('label navMesAno existe e tem aria-live', async ({ page }) => {
    const label = page.locator('#navMesAno');
    await expect(label).toHaveCount(1);
    await expect(label).toHaveAttribute('aria-live', 'polite');
  });

  test('botões de navegação são clicáveis', async ({ page }) => {
    const prev = page.locator('#btnMesAnterior');
    const next = page.locator('#btnProximoMes');
    await expect(prev).toBeEnabled();
    await expect(next).toBeEnabled();
  });

  // ─── Gráfico de Categorias ────────────────────────────────────────────
  test('canvas chartCategorias existe no DOM', async ({ page }) => {
    const canvas = page.locator('#chartCategorias');
    await expect(canvas).toHaveCount(1);
  });

  test('container do gráfico existe no DOM', async ({ page }) => {
    const container = page.locator('#graficoContainer');
    await expect(container).toHaveCount(1);
  });

  test('estado vazio graficoCategorias existe', async ({ page }) => {
    const empty = page.locator('#graficoCategorias');
    await expect(empty).toHaveCount(1);
  });

  test('seção Despesas por Categoria tem título correto', async ({ page }) => {
    const title = page.locator('.dash-section-title').filter({ hasText: 'Despesas por Categoria' });
    await expect(title).toHaveCount(1);
  });

  test('Chart.js carregado via script tag', async ({ page }) => {
    const script = page.locator('script[src*="chart.js"]');
    await expect(script).toHaveCount(1);
  });

});
