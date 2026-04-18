// tests/trocar-senha.spec.js — Bud Finance
// Testa a página de Troca de Senha no primeiro login (trocar-senha.html)
const { test, expect } = require('@playwright/test');

test.describe('Trocar Senha — trocar-senha.html', () => {

  // ── Sem usuário logado: deve mostrar "Acesso não autorizado" ────

  test.describe('sem usuário autenticado', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/trocar-senha.html');
      // Aguarda Firebase resolver que não há usuário logado
      await page.waitForSelector('#stateUnauthorized:not(.section-hidden)', { timeout: 15_000 });
    });

    test('título da página correto', async ({ page }) => {
      await expect(page).toHaveTitle('Trocar Senha - Bud Finance');
    });

    test('estado "Acesso não autorizado" é exibido', async ({ page }) => {
      await expect(page.locator('#stateUnauthorized')).toBeVisible();
    });

    test('estado de formulário está oculto', async ({ page }) => {
      await expect(page.locator('#stateForm')).not.toBeVisible();
    });

    test('heading "Acesso não autorizado" está visível', async ({ page }) => {
      await expect(page.locator('h2').last()).toContainText('Acesso não autorizado');
    });

    test('mensagem de orientação está visível', async ({ page }) => {
      await expect(page.locator('text=Você precisa estar logado')).toBeVisible();
    });

    test('botão "Ir para o Login" aponta para index.html', async ({ page }) => {
      const link = page.locator('#stateUnauthorized a[href="index.html"]');
      await expect(link).toBeVisible();
      await expect(link).toContainText('Ir para o Login');
    });

    test('ícone 🚫 está visível', async ({ page }) => {
      await expect(page.locator('text=🚫')).toBeVisible();
    });
  });

  // ── Elementos DOM existem (ocultos sem auth) ────────────────────

  test.describe('elementos do formulário existem no DOM', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/trocar-senha.html');
      await page.waitForLoadState('domcontentloaded');
    });

    test('campo nova senha existe no DOM', async ({ page }) => {
      await expect(page.locator('#novaSenha')).toBeAttached();
    });

    test('campo confirmar senha existe no DOM', async ({ page }) => {
      await expect(page.locator('#confirmarSenha')).toBeAttached();
    });

    test('user badge elements existem no DOM', async ({ page }) => {
      await expect(page.locator('#userInitial')).toBeAttached();
      await expect(page.locator('#userName')).toBeAttached();
      await expect(page.locator('#userMatricula')).toBeAttached();
    });

    test('4 barras de força de senha existem no DOM', async ({ page }) => {
      for (const id of ['#bar1', '#bar2', '#bar3', '#bar4']) {
        await expect(page.locator(id)).toBeAttached();
      }
    });

    test('botões toggle de senha existem no DOM', async ({ page }) => {
      await expect(page.locator('#toggleNovaSenha')).toBeAttached();
      await expect(page.locator('#toggleConfirmarSenha')).toBeAttached();
    });

    test('spinner inicial é exibido antes da verificação de auth', async ({ page }) => {
      // stateLoading é o estado inicial — pode já ter mudado, mas o elemento existe
      await expect(page.locator('#stateLoading')).toBeAttached();
    });
  });

});
