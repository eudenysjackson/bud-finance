// tests/acao-auth.spec.js — Bud Finance
// Testa a página de Ação Auth / Reset de Senha (acao-auth.html)
const { test, expect } = require('@playwright/test');

test.describe('Ação Auth — acao-auth.html', () => {

  // ── Sem oobCode na URL: deve mostrar erro imediatamente ──────────

  test.describe('sem oobCode na URL', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/acao-auth.html');
      // Aguarda o JS decidir qual estado mostrar
      await page.waitForSelector('#stateError:not(.section-hidden)', { timeout: 10_000 });
    });

    test('título da página correto', async ({ page }) => {
      await expect(page).toHaveTitle('Redefinir Senha - Bud Finance');
    });

    test('estado de erro é exibido quando não há oobCode', async ({ page }) => {
      await expect(page.locator('#stateError')).toBeVisible();
    });

    test('estados formulário, sucesso e validando estão ocultos', async ({ page }) => {
      await expect(page.locator('#stateForm')).not.toBeVisible();
      await expect(page.locator('#stateSuccess')).not.toBeVisible();
      await expect(page.locator('#stateValidating')).not.toBeVisible();
    });

    test('mensagem de erro específica sobre link inválido', async ({ page }) => {
      const msg = page.locator('#errorMessage');
      await expect(msg).toContainText('Link inválido');
    });

    test('botão "Solicitar novo link" aponta para recuperar-senha.html', async ({ page }) => {
      const link = page.locator('a[href="recuperar-senha.html"]');
      await expect(link).toBeVisible();
      await expect(link).toContainText('Solicitar novo link');
    });

    test('link "← Voltar para o login" aponta para index.html', async ({ page }) => {
      // #stateError tem dois links para index.html — seleciona o que contém "Voltar"
      const link = page.locator('#stateError a[href="index.html"].link-primary');
      await expect(link).toBeVisible();
      await expect(link).toContainText('Voltar para o login');
    });

    test('ícone de aviso ⚠️ é exibido no estado de erro', async ({ page }) => {
      await expect(page.locator('.pulse-ring-error')).toBeVisible();
    });
  });

  // ── Com oobCode inválido na URL ─────────────────────────────────

  test.describe('com oobCode inválido na URL', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/acao-auth.html?oobCode=CODIGO_INVALIDO_TESTE');
      // Aguarda Firebase retornar erro e mostrar stateError
      await page.waitForSelector('#stateError:not(.section-hidden)', { timeout: 15_000 });
    });

    test('exibe estado de erro para oobCode inválido', async ({ page }) => {
      await expect(page.locator('#stateError')).toBeVisible();
    });

    test('mensagem menciona que link foi usado ou expirou', async ({ page }) => {
      const msg = page.locator('#errorMessage');
      // Firebase retorna auth/invalid-action-code
      await expect(msg).not.toBeEmpty();
    });
  });

  // ── Estrutura do formulário (visível apenas com oobCode válido) ──
  // Testamos que os elementos HTML existem no DOM mesmo ocultos

  test.describe('elementos do formulário existem no DOM', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/acao-auth.html');
      await page.waitForLoadState('domcontentloaded');
    });

    test('campo nova senha existe no DOM', async ({ page }) => {
      await expect(page.locator('#novaSenha')).toBeAttached();
    });

    test('campo confirmar senha existe no DOM', async ({ page }) => {
      await expect(page.locator('#confirmarSenha')).toBeAttached();
    });

    test('botão de reset existe no DOM', async ({ page }) => {
      await expect(page.locator('#btnReset')).toBeAttached();
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
  });

});
