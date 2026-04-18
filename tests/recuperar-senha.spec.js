// tests/recuperar-senha.spec.js — Bud Finance
// Testa a página de Recuperação de Senha (recuperar-senha.html)
const { test, expect } = require('@playwright/test');

test.describe('Recuperar Senha — recuperar-senha.html', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/recuperar-senha.html');
    await page.waitForLoadState('domcontentloaded');
  });

  // ── Estrutura da página ─────────────────────────────────────────

  test('título da página correto', async ({ page }) => {
    await expect(page).toHaveTitle('Recuperar Senha - Bud Finance');
  });

  test('heading "Esqueceu a senha?" é exibido', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Esqueceu a senha?');
  });

  test('ícone de cadeado é exibido', async ({ page }) => {
    await expect(page.locator('text=🔒')).toBeVisible();
  });

  test('descrição orientativa é exibida', async ({ page }) => {
    await expect(page.locator('text=link para redefinir sua senha')).toBeVisible();
  });

  // ── Formulário ──────────────────────────────────────────────────

  test('formulário de recuperação está presente', async ({ page }) => {
    await expect(page.locator('#formRecuperar')).toBeVisible();
  });

  test('campo email está visível com placeholder correto', async ({ page }) => {
    const input = page.locator('#email');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'seu@email.com');
    await expect(input).toHaveAttribute('type', 'email');
  });

  test('botão "Enviar link de recuperação" está visível', async ({ page }) => {
    const btn = page.locator('#btnRecuperar');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Enviar link de recuperação');
  });

  // ── Link de voltar ──────────────────────────────────────────────

  test('link "← Voltar para o login" aponta para index.html', async ({ page }) => {
    const link = page.locator('a[href="index.html"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Voltar para o login');
  });

  // ── Validação de email vazio ────────────────────────────────────

  test('submit com email vazio exibe toast de erro', async ({ page }) => {
    await page.waitForFunction(() => typeof window.budShowToast === 'function');
    await page.locator('#btnRecuperar').click();
    const toast = page.locator('#bud-toast-container');
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });

  test('submit com email inválido exibe toast de erro', async ({ page }) => {
    await page.waitForFunction(() => typeof window.budShowToast === 'function');
    await page.locator('#email').fill('email-invalido');
    await page.locator('#btnRecuperar').click();
    const toast = page.locator('#bud-toast-container');
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });

  // ── Navegação ───────────────────────────────────────────────────

  test('clique em "Voltar para o login" navega para index.html', async ({ page }) => {
    await page.locator('a[href="index.html"]').click();
    await expect(page).toHaveURL(/index\.html/);
  });

});
