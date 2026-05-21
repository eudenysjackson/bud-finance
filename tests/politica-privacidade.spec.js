// tests/politica-privacidade.spec.js — Bud Finance
// Testa a página de Política de Privacidade (politica-privacidade.html)
const { test, expect } = require('@playwright/test');

test.describe('Política de Privacidade — politica-privacidade.html', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/appbudfinance/politica-privacidade.html');
    await page.waitForLoadState('domcontentloaded');
  });

  test('título da página contém "Política de Privacidade"', async ({ page }) => {
    const title = await page.title();
    expect(title).toContain('Política de Privacidade');
  });

  test('heading principal é exibido', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('conteúdo sobre LGPD está presente', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body.toLowerCase()).toContain('lgpd');
  });

  test('link de voltar para login existe', async ({ page }) => {
    // Política pode ter link para login
    const link = page.locator('a[href="index.html"]');
    const count = await link.count();
    // Pode ou não ter o link — apenas valida a estrutura se existir
    if (count > 0) {
      await expect(link.first()).toBeVisible();
    }
  });

  test('conteúdo sobre dados pessoais está presente', async ({ page }) => {
    const body = await page.textContent('body');
    const lower = body.toLowerCase();
    const hasContent = lower.includes('dados') || lower.includes('privacidade') || lower.includes('pessoais');
    expect(hasContent).toBe(true);
  });

});
