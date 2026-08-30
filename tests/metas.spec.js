// tests/metas.spec.js — Bud Finance
// Testa a página de Metas Financeiras (metas.html)
const { test, expect } = require('@playwright/test');

// ── Auth guard ────────────────────────────────────────────────────
test.describe('Metas — Auth Guard', () => {

  test('sem auth, redireciona para index.html', async ({ page }) => {
    await page.goto('/metas.html');
    await page.waitForURL('**/index.html', { timeout: 15_000 });
    expect(page.url()).toContain('index.html');
  });

});

// ── Estrutura HTML (JS bloqueado para evitar redirect do auth guard) ──
test.describe('Metas — Estrutura HTML', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/js/metas.js*', route => route.abort());
    await page.goto('/metas.html', { waitUntil: 'domcontentloaded' });
  });

  test('título da página correto', async ({ page }) => {
    const title = await page.title();
    expect(title).toBe('Metas - Bud Finance');
  });

  test('sidebar existe no DOM', async ({ page }) => {
    await expect(page.locator('#sidebar')).toHaveCount(1);
  });

  test('sidebar contém logo Bud Finance', async ({ page }) => {
    await expect(page.locator('.sidebar-logo-text')).toHaveText('Bud Finance');
  });

  test('sidebar tem link Metas ativo', async ({ page }) => {
    await expect(page.locator('.sidebar-link.active')).toContainText('Metas');
  });

  test('sidebar tem botão Sair', async ({ page }) => {
    const btn = page.locator('#btnLogout');
    await expect(btn).toHaveCount(1);
    await expect(btn).toContainText('Sair');
  });

  test('área principal existe', async ({ page }) => {
    await expect(page.locator('#dashMain')).toHaveCount(1);
  });

  test('botão Nova Meta existe', async ({ page }) => {
    const btn = page.locator('#btnNovaMeta');
    await expect(btn).toHaveCount(1);
    await expect(btn).toContainText('Nova Meta');
  });

  test('4 cards de resumo existem', async ({ page }) => {
    await expect(page.locator('.summary-card')).toHaveCount(4);
  });

  test('card Metas Ativas existe', async ({ page }) => {
    await expect(page.locator('#summaryAtivas')).toHaveCount(1);
  });

  test('card Total Guardado existe', async ({ page }) => {
    await expect(page.locator('#summaryGuardado')).toHaveCount(1);
  });

  test('card Falta Guardar existe', async ({ page }) => {
    await expect(page.locator('#summaryFalta')).toHaveCount(1);
  });

  test('card Progresso Médio existe', async ({ page }) => {
    await expect(page.locator('#summaryProgresso')).toHaveCount(1);
  });

  test('container de metas existe no DOM', async ({ page }) => {
    await expect(page.locator('#metasContainer')).toHaveCount(1);
  });

  test('grid de metas existe no DOM', async ({ page }) => {
    await expect(page.locator('#metasGrid')).toHaveCount(1);
  });

  test('modal de nova meta existe no DOM (oculto)', async ({ page }) => {
    await expect(page.locator('#modalMeta')).toHaveCount(1);
  });

  test('botão hamburger existe (mobile)', async ({ page }) => {
    await expect(page.locator('#btnHamburger')).toHaveCount(1);
  });

  test('sidebar tem link para Dashboard', async ({ page }) => {
    await expect(page.locator('.sidebar-link[href="dashboard.html"]')).toHaveCount(1);
  });

  test('sidebar tem link para Cartões', async ({ page }) => {
    await expect(page.locator('.sidebar-link[href="cartoes.html"]')).toHaveCount(1);
  });

  test('sidebar tem link para Configurações', async ({ page }) => {
    await expect(page.locator('.sidebar-link[href="configuracoes.html"]')).toHaveCount(1);
  });

});
