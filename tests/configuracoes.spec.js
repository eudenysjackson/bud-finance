// tests/configuracoes.spec.js — Bud Finance
// Testa a página de Configurações (configuracoes.html)
const { test, expect } = require('@playwright/test');

// ── Auth guard ────────────────────────────────────────────────────
test.describe('Configurações — Auth Guard', () => {

  test('sem auth, redireciona para index.html', async ({ page }) => {
    await page.goto('/configuracoes.html');
    await page.waitForURL('**/index.html', { timeout: 15_000 });
    expect(page.url()).toContain('index.html');
  });

});

// ── Estrutura HTML (JS bloqueado para evitar redirect do auth guard) ──
test.describe('Configurações — Estrutura HTML', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/js/configuracoes.js', route => route.abort());
    await page.goto('/configuracoes.html', { waitUntil: 'domcontentloaded' });
  });

  test('título da página correto', async ({ page }) => {
    const title = await page.title();
    expect(title).toBe('Configurações - Bud Finance');
  });

  test('sidebar existe no DOM', async ({ page }) => {
    await expect(page.locator('#sidebar')).toHaveCount(1);
  });

  test('sidebar contém logo Bud Finance', async ({ page }) => {
    await expect(page.locator('.sidebar-logo-text')).toHaveText('Bud Finance');
  });

  test('sidebar tem link Configurações ativo', async ({ page }) => {
    await expect(page.locator('.sidebar-link.active')).toContainText('Configurações');
  });

  test('sidebar tem botão Sair', async ({ page }) => {
    const btn = page.locator('#btnLogout');
    await expect(btn).toHaveCount(1);
    await expect(btn).toContainText('Sair');
  });

  test('área principal existe', async ({ page }) => {
    await expect(page.locator('#dashMain')).toHaveCount(1);
  });

  test('3 abas existem (Perfil, Personalização, Segurança)', async ({ page }) => {
    await expect(page.locator('.cfg-tab-btn')).toHaveCount(3);
  });

  test('aba Perfil está ativa por padrão', async ({ page }) => {
    const tabPerfil = page.locator('#tabBtnPerfil');
    await expect(tabPerfil).toHaveClass(/active/);
    await expect(tabPerfil).toHaveAttribute('aria-selected', 'true');
  });

  test('aba Personalização existe', async ({ page }) => {
    await expect(page.locator('#tabBtnPersonalizacao')).toHaveCount(1);
  });

  test('aba Segurança existe', async ({ page }) => {
    await expect(page.locator('#tabBtnSeguranca')).toHaveCount(1);
  });

  test('painel Perfil está visível por padrão', async ({ page }) => {
    await expect(page.locator('#tabPerfil')).toBeVisible();
  });

  test('painel Personalização está oculto por padrão', async ({ page }) => {
    await expect(page.locator('#tabPersonalizacao')).toBeHidden();
  });

  test('painel Segurança está oculto por padrão', async ({ page }) => {
    await expect(page.locator('#tabSeguranca')).toBeHidden();
  });

  test('input de nome existe no painel Perfil', async ({ page }) => {
    await expect(page.locator('#perfilNome')).toHaveCount(1);
  });

  test('campo de e-mail existe no painel Perfil', async ({ page }) => {
    await expect(page.locator('#perfilEmail')).toHaveCount(1);
  });

  test('campo de matrícula existe no painel Perfil', async ({ page }) => {
    await expect(page.locator('#perfilMatricula')).toHaveCount(1);
  });

  test('botão Salvar Alterações existe', async ({ page }) => {
    await expect(page.locator('#btnSalvarNome')).toHaveCount(1);
    await expect(page.locator('#btnSalvarNome')).toContainText('Salvar');
  });

  test('botão Exportar CSV existe', async ({ page }) => {
    await expect(page.locator('#btnExportarCSV')).toHaveCount(1);
  });

  test('botão hamburger existe (mobile)', async ({ page }) => {
    await expect(page.locator('#btnHamburger')).toHaveCount(1);
  });

  test('botão Enviar link (redefinir senha) existe no painel Segurança', async ({ page }) => {
    await expect(page.locator('#btnResetSenha')).toHaveCount(1);
  });

  test('botão de sair da conta existe no painel Segurança', async ({ page }) => {
    await expect(page.locator('#btnLogoutSeg')).toHaveCount(1);
  });

});
