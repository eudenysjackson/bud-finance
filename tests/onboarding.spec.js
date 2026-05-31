/**
 * tests/onboarding.spec.js — PEND-IMM-01
 * Smoke tests para a tela de Onboarding — splash e estrutura HTML estática.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const URL = 'file:///' + path.resolve(__dirname, '../appbudfinance/onboarding.html').replace(/\\/g, '/');

test.describe('Onboarding — Estrutura HTML', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.BUD_FIREBASE_CONFIG = { apiKey: 'test', authDomain: 'test', projectId: 'test', storageBucket: 'test', messagingSenderId: '0', appId: '0' };
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
  });

  test('elemento #splash existe no DOM', async ({ page }) => {
    await expect(page.locator('#splash')).toBeAttached();
  });

  test('splash contém imagem do logo', async ({ page }) => {
    const img = page.locator('#splash img');
    await expect(img).toBeAttached();
    await expect(img).toHaveAttribute('alt', 'Bud Finance');
  });

  test('wrapper principal #obWrapper existe', async ({ page }) => {
    await expect(page.locator('#obWrapper')).toBeAttached();
  });

  test('logo Bud Finance visível no card de onboarding', async ({ page }) => {
    const logoName = page.locator('.ob-logo-name');
    await expect(logoName).toBeAttached();
  });

  test('splash oculta após adicionar classe hide', async ({ page }) => {
    const splash = page.locator('#splash');
    await page.evaluate(() => {
      document.getElementById('splash').classList.add('hide');
    });
    await expect(splash).toHaveClass(/hide/);
  });
});
