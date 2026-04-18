// tests/cadastro.spec.js — Bud Finance
// Testa a página de Cadastro (cadastro.html)
const { test, expect } = require('@playwright/test');

test.describe('Cadastro — cadastro.html', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastro.html');
    await page.waitForLoadState('domcontentloaded');
  });

  // ── Estrutura da página ─────────────────────────────────────────

  test('título da página correto', async ({ page }) => {
    await expect(page).toHaveTitle('Cadastro - Bud Finance');
  });

  test('heading "Crie sua conta" é exibido', async ({ page }) => {
    await expect(page.locator('h2').first()).toContainText('Crie sua conta');
  });

  test('badge "3 Dias Grátis" é exibido', async ({ page }) => {
    await expect(page.locator('text=3 Dias Grátis')).toBeVisible();
  });

  // ── Seção do formulário ─────────────────────────────────────────

  test('seção do formulário está visível e sucesso oculto', async ({ page }) => {
    await expect(page.locator('#formSection')).toBeVisible();
    await expect(page.locator('#successSection')).not.toBeVisible();
  });

  // ── Campos do formulário ────────────────────────────────────────

  test('campo Nome está visível e com placeholder correto', async ({ page }) => {
    const input = page.locator('#nome');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Seu nome completo');
  });

  test('campo Email está visível e com placeholder correto', async ({ page }) => {
    const input = page.locator('#email');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'seu@email.com');
  });

  test('campo Telefone está visível com placeholder de máscara', async ({ page }) => {
    const input = page.locator('#telefone');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', '(00) 00000-0000');
  });

  test('campo Nova Senha está visível com tipo password', async ({ page }) => {
    const input = page.locator('#novaSenha');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('campo Confirmar Senha está visível com tipo password', async ({ page }) => {
    const input = page.locator('#confirmarSenha');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('campo Código de Indicação está visível (opcional)', async ({ page }) => {
    await expect(page.locator('#codigoIndicacao')).toBeVisible();
  });

  test('checkbox LGPD está visível', async ({ page }) => {
    await expect(page.locator('#lgpdConsent')).toBeVisible();
  });

  test('botão "Criar minha conta" está visível', async ({ page }) => {
    const btn = page.locator('#btnCadastro');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Criar minha conta');
  });

  // ── Barras de força de senha ────────────────────────────────────

  test('as 4 barras de força de senha existem', async ({ page }) => {
    for (const id of ['#bar1', '#bar2', '#bar3', '#bar4']) {
      await expect(page.locator(id)).toBeAttached();
    }
  });

  test('indicador de força atualiza ao digitar senha fraca', async ({ page }) => {
    const input     = page.locator('#novaSenha');
    const forcaText = page.locator('#forcaTexto');

    await input.fill('abc');
    // Senha curta demais → texto de aviso
    await expect(forcaText).toContainText('Mínimo 8 caracteres');
  });

  test('indicador de força mostra "Forte" para senha complexa', async ({ page }) => {
    const input     = page.locator('#novaSenha');
    const forcaText = page.locator('#forcaTexto');

    await input.fill('Xj9@secure!');
    await expect(forcaText).toContainText('Forte');
  });

  // ── Toggle de senha ─────────────────────────────────────────────

  test('toggle de nova senha alterna para texto e volta', async ({ page }) => {
    const input = page.locator('#novaSenha');
    const btn   = page.locator('#toggleNovaSenha');

    await expect(input).toHaveAttribute('type', 'password');
    await btn.click();
    await expect(input).toHaveAttribute('type', 'text');
    await btn.click();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('toggle de confirmar senha alterna para texto e volta', async ({ page }) => {
    const input = page.locator('#confirmarSenha');
    const btn   = page.locator('#toggleConfirmarSenha');

    await expect(input).toHaveAttribute('type', 'password');
    await btn.click();
    await expect(input).toHaveAttribute('type', 'text');
    await btn.click();
    await expect(input).toHaveAttribute('type', 'password');
  });

  // ── Máscara de telefone ─────────────────────────────────────────

  test('máscara de telefone formata corretamente ao digitar', async ({ page }) => {
    const input = page.locator('#telefone');
    await input.fill('11987654321');
    const valor = await input.inputValue();
    expect(valor).toBe('(11) 98765-4321');
  });

  // ── Links ───────────────────────────────────────────────────────

  test('link "Faça login" aponta para index.html', async ({ page }) => {
    const link = page.locator('a[href="index.html"]');
    await expect(link.first()).toBeVisible();
  });

  test('link "Política de Privacidade" existe e abre em nova aba', async ({ page }) => {
    const link = page.locator('a[href="politica-privacidade.html"]');
    await expect(link.first()).toBeVisible();
    await expect(link.first()).toHaveAttribute('target', '_blank');
  });

  // ── Código de indicação: formatação uppercase ───────────────────

  test('campo código de indicação aplica uppercase via CSS', async ({ page }) => {
    const input = page.locator('#codigoIndicacao');
    await expect(input).toHaveCSS('text-transform', 'uppercase');
  });

});
