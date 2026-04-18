# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.js >> Login — index.html >> botão login existe com texto correto
- Location: tests\login.spec.js:46:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#splash.hide') to be visible

```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - img "Bud Finance" [ref=e4]
    - heading "Bem-vindo(a)" [level=2] [ref=e5]
    - paragraph [ref=e6]: Insira seus dados de acesso
  - generic [ref=e7]:
    - generic [ref=e8]:
      - generic [ref=e9]: E-mail ou Matrícula
      - textbox "E-mail ou Matrícula" [ref=e10]:
        - /placeholder: seu@email.com ou BUD-XXXX-XXXX
    - generic [ref=e11]:
      - generic [ref=e12]: Senha
      - generic [ref=e13]:
        - textbox "Senha" [ref=e14]:
          - /placeholder: ••••••••
        - button "Mostrar/ocultar senha" [ref=e15] [cursor=pointer]: 👁
      - link "Esqueceu a senha?" [ref=e17] [cursor=pointer]:
        - /url: recuperar-senha.html
    - button "Acessar meu painel" [ref=e18] [cursor=pointer]
  - paragraph [ref=e20]:
    - text: Novo por aqui?
    - link "Crie sua conta" [ref=e21] [cursor=pointer]:
      - /url: cadastro.html
  - paragraph [ref=e23]:
    - text: Ao acessar, você concorda com nossa
    - link "Política de Privacidade" [ref=e24] [cursor=pointer]:
      - /url: politica-privacidade.html
    - text: e com o tratamento dos seus dados conforme a LGPD.
```

# Test source

```ts
  1   | // tests/login.spec.js — Bud Finance
  2   | // Testa a página de Login (index.html)
  3   | const { test, expect } = require('@playwright/test');
  4   | 
  5   | test.describe('Login — index.html', () => {
  6   | 
  7   |   test.beforeEach(async ({ page }) => {
  8   |     await page.goto('/index.html');
  9   |     // Aguarda o splash desaparecer (até 10s)
> 10  |     await page.waitForSelector('#splash.hide', { timeout: 10_000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  11  |   });
  12  | 
  13  |   // ── Estrutura da página ─────────────────────────────────────────
  14  | 
  15  |   test('título da página correto', async ({ page }) => {
  16  |     await expect(page).toHaveTitle('Login - Bud Finance');
  17  |   });
  18  | 
  19  |   test('logo é exibida', async ({ page }) => {
  20  |     const logo = page.locator('.login-card img[alt="Bud Finance"]');
  21  |     await expect(logo).toBeVisible();
  22  |   });
  23  | 
  24  |   test('heading de boas-vindas é exibido', async ({ page }) => {
  25  |     await expect(page.locator('h2')).toContainText('Bem-vindo(a)');
  26  |   });
  27  | 
  28  |   // ── Formulário de login ─────────────────────────────────────────
  29  | 
  30  |   test('formulário de login é exibido', async ({ page }) => {
  31  |     await expect(page.locator('#formLogin')).toBeVisible();
  32  |   });
  33  | 
  34  |   test('campo identificador existe com placeholder correto', async ({ page }) => {
  35  |     const input = page.locator('#identificador');
  36  |     await expect(input).toBeVisible();
  37  |     await expect(input).toHaveAttribute('placeholder', 'seu@email.com ou BUD-XXXX-XXXX');
  38  |   });
  39  | 
  40  |   test('campo senha existe com tipo password', async ({ page }) => {
  41  |     const input = page.locator('#senha');
  42  |     await expect(input).toBeVisible();
  43  |     await expect(input).toHaveAttribute('type', 'password');
  44  |   });
  45  | 
  46  |   test('botão login existe com texto correto', async ({ page }) => {
  47  |     const btn = page.locator('#btnLogin');
  48  |     await expect(btn).toBeVisible();
  49  |     await expect(btn).toContainText('Acessar meu painel');
  50  |   });
  51  | 
  52  |   // ── Toggle de senha ─────────────────────────────────────────────
  53  | 
  54  |   test('toggle de senha alterna para texto e volta', async ({ page }) => {
  55  |     const senhaInput  = page.locator('#senha');
  56  |     const toggleBtn   = page.locator('#toggleSenha');
  57  | 
  58  |     await expect(senhaInput).toHaveAttribute('type', 'password');
  59  |     await toggleBtn.click();
  60  |     await expect(senhaInput).toHaveAttribute('type', 'text');
  61  |     await toggleBtn.click();
  62  |     await expect(senhaInput).toHaveAttribute('type', 'password');
  63  |   });
  64  | 
  65  |   // ── Navegação por links ─────────────────────────────────────────
  66  | 
  67  |   test('link "Esqueceu a senha?" aponta para recuperar-senha.html', async ({ page }) => {
  68  |     const link = page.locator('a[href="recuperar-senha.html"]').first();
  69  |     await expect(link).toBeVisible();
  70  |     await expect(link).toContainText('Esqueceu a senha?');
  71  |   });
  72  | 
  73  |   test('link "Crie sua conta" aponta para cadastro.html', async ({ page }) => {
  74  |     const link = page.locator('a[href="cadastro.html"]');
  75  |     await expect(link).toBeVisible();
  76  |   });
  77  | 
  78  |   test('link Política de Privacidade aponta para politica-privacidade.html', async ({ page }) => {
  79  |     const link = page.locator('a[href="politica-privacidade.html"]');
  80  |     await expect(link.first()).toBeVisible();
  81  |   });
  82  | 
  83  |   // ── Keybindings ─────────────────────────────────────────────────
  84  | 
  85  |   test('Enter no campo identificador move foco para senha', async ({ page }) => {
  86  |     await page.locator('#identificador').click();
  87  |     await page.keyboard.press('Enter');
  88  |     await expect(page.locator('#senha')).toBeFocused();
  89  |   });
  90  | 
  91  |   // ── Validação de campos vazios ──────────────────────────────────
  92  | 
  93  |   test('submit vazio exibe mensagem de erro sem expor dados do usuário', async ({ page }) => {
  94  |     // Garante que Firebase está carregado
  95  |     await page.waitForFunction(() => typeof window.BUD_FIREBASE_CONFIG !== 'undefined');
  96  | 
  97  |     await page.locator('#btnLogin').click();
  98  | 
  99  |     // Deve aparecer um toast de erro, não um modal de conta encontrada/não encontrada
  100 |     const toast = page.locator('#bud-toast-container');
  101 |     await expect(toast).toBeVisible({ timeout: 5_000 });
  102 |   });
  103 | 
  104 |   // ── Splash screen ───────────────────────────────────────────────
  105 | 
  106 |   test('splash screen aparece e desaparece', async ({ page }) => {
  107 |     await page.goto('/index.html');
  108 |     // Splash deve ter a classe hide após carregar
  109 |     await page.waitForSelector('#splash.hide', { timeout: 10_000 });
  110 |     const splash = page.locator('#splash');
```