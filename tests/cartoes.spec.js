// tests/cartoes.spec.js — Bud Finance
// Testa a página de Cartões de Crédito (cartoes.html)
const { test, expect } = require('@playwright/test');

// ── Auth guard ────────────────────────────────────────────────────
test.describe('Cartões — Auth Guard', () => {

  test('sem auth, redireciona para index.html', async ({ page }) => {
    await page.goto('/cartoes.html');
    await page.waitForURL('**/index.html', { timeout: 15_000 });
    expect(page.url()).toContain('index.html');
  });

});

// ── Estrutura HTML (JS bloqueado para evitar redirect do auth guard) ──
test.describe('Cartões — Estrutura HTML', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/js/cartoes.js', route => route.abort());
    await page.goto('/cartoes.html', { waitUntil: 'domcontentloaded' });
  });

  test('título da página correto', async ({ page }) => {
    const title = await page.title();
    expect(title).toBe('Cartões - Bud Finance');
  });

  test('sidebar existe no DOM', async ({ page }) => {
    await expect(page.locator('#sidebar')).toHaveCount(1);
  });

  test('sidebar contém logo Bud Finance', async ({ page }) => {
    await expect(page.locator('.sidebar-logo-text')).toHaveText('Bud Finance');
  });

  test('sidebar tem link Cartões ativo', async ({ page }) => {
    await expect(page.locator('.sidebar-link.active')).toContainText('Cartões');
  });

  test('sidebar tem botão Sair', async ({ page }) => {
    const btn = page.locator('#btnLogout');
    await expect(btn).toHaveCount(1);
    await expect(btn).toContainText('Sair');
  });

  test('área principal existe', async ({ page }) => {
    await expect(page.locator('#dashMain')).toHaveCount(1);
  });

  test('botão Novo Cartão existe', async ({ page }) => {
    await expect(page.locator('#btnNovoCartao')).toHaveCount(1);
  });

  test('navegação de mês existe (anterior, label, próximo)', async ({ page }) => {
    await expect(page.locator('#btnMesAnterior')).toHaveCount(1);
    await expect(page.locator('#labelMesAtual')).toHaveCount(1);
    await expect(page.locator('#btnProximoMes')).toHaveCount(1);
  });

  test('banner de resumo existe no DOM', async ({ page }) => {
    await expect(page.locator('#bannerResumo')).toHaveCount(1);
  });

  test('banner exibe total de faturas', async ({ page }) => {
    await expect(page.locator('#totalFaturas')).toHaveCount(1);
  });

  test('banner exibe limite disponível', async ({ page }) => {
    await expect(page.locator('#limiteDisponivel')).toHaveCount(1);
  });

  test('banner exibe contagem de faturas pagas', async ({ page }) => {
    await expect(page.locator('#faturasPagasCount')).toHaveCount(1);
  });

  test('botão hamburger existe (mobile)', async ({ page }) => {
    await expect(page.locator('#btnHamburger')).toHaveCount(1);
  });

  test('sidebar tem link para Dashboard', async ({ page }) => {
    const link = page.locator('.sidebar-link[href="dashboard.html"]');
    await expect(link).toHaveCount(1);
  });

  test('sidebar tem link para Metas', async ({ page }) => {
    const link = page.locator('.sidebar-link[href="metas.html"]');
    await expect(link).toHaveCount(1);
  });

  test('sidebar tem link para Configurações', async ({ page }) => {
    const link = page.locator('.sidebar-link[href="configuracoes.html"]');
    await expect(link).toHaveCount(1);
  });

});
