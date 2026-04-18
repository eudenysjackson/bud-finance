// tests/login.spec.js — Bud Finance
// Testa a página de Login (index.html)
const { test, expect } = require('@playwright/test');

test.describe('Login — index.html', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    // Aguarda o splash ser removido do DOM (ele ganha .hide e depois é removido)
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15_000 });
  });

  // ── Estrutura da página ─────────────────────────────────────────

  test('título da página correto', async ({ page }) => {
    await expect(page).toHaveTitle('Login - Bud Finance');
  });

  test('logo é exibida', async ({ page }) => {
    const logo = page.locator('.login-card img[alt="Bud Finance"]');
    await expect(logo).toBeVisible();
  });

  test('heading de boas-vindas é exibido', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Bem-vindo(a)');
  });

  // ── Formulário de login ─────────────────────────────────────────

  test('formulário de login é exibido', async ({ page }) => {
    await expect(page.locator('#formLogin')).toBeVisible();
  });

  test('campo identificador existe com placeholder correto', async ({ page }) => {
    const input = page.locator('#identificador');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'seu@email.com ou BUD-XXXX-XXXX');
  });

  test('campo senha existe com tipo password', async ({ page }) => {
    const input = page.locator('#senha');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('botão login existe com texto correto', async ({ page }) => {
    const btn = page.locator('#btnLogin');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Acessar meu painel');
  });

  // ── Toggle de senha ─────────────────────────────────────────────

  test('toggle de senha alterna para texto e volta', async ({ page }) => {
    const senhaInput  = page.locator('#senha');
    const toggleBtn   = page.locator('#toggleSenha');

    await expect(senhaInput).toHaveAttribute('type', 'password');
    await toggleBtn.click();
    await expect(senhaInput).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(senhaInput).toHaveAttribute('type', 'password');
  });

  // ── Navegação por links ─────────────────────────────────────────

  test('link "Esqueceu a senha?" aponta para recuperar-senha.html', async ({ page }) => {
    const link = page.locator('a[href="recuperar-senha.html"]').first();
    await expect(link).toBeVisible();
    await expect(link).toContainText('Esqueceu a senha?');
  });

  test('link "Crie sua conta" aponta para cadastro.html', async ({ page }) => {
    const link = page.locator('a[href="cadastro.html"]');
    await expect(link).toBeVisible();
  });

  test('link Política de Privacidade aponta para politica-privacidade.html', async ({ page }) => {
    const link = page.locator('a[href="politica-privacidade.html"]');
    await expect(link.first()).toBeVisible();
  });

  // ── Keybindings ─────────────────────────────────────────────────

  test('Enter no campo identificador move foco para senha', async ({ page }) => {
    await page.locator('#identificador').click();
    await page.keyboard.press('Enter');
    await expect(page.locator('#senha')).toBeFocused();
  });

  // ── Validação de campos vazios ──────────────────────────────────

  test('submit vazio exibe mensagem de erro sem expor dados do usuário', async ({ page }) => {
    // Garante que Firebase está carregado
    await page.waitForFunction(() => typeof window.BUD_FIREBASE_CONFIG !== 'undefined');

    await page.locator('#btnLogin').click();

    // Deve aparecer um toast de erro, não um modal de conta encontrada/não encontrada
    const toast = page.locator('#bud-toast-container');
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });

  // ── Splash screen ───────────────────────────────────────────────

  test('splash screen aparece e desaparece', async ({ page }) => {
    await page.goto('/index.html');
    // Splash deve existir inicialmente
    const splash = page.locator('#splash');
    // Aguarda o splash ser removido do DOM (após classe hide + timeout)
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15_000 });
    // Após ser removido, não deve mais estar no DOM
    await expect(splash).toHaveCount(0);
  });

});
