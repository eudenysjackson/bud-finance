/**
 * tests/mercado.spec.js — PEND-MER-12
 * Smoke tests para a tela de Mercado IA (estrutura estática, sem backend).
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const URL = 'file:///' + path.resolve(__dirname, '../appbudfinance/mercado.html').replace(/\\/g, '/');

test.describe('Mercado — Estrutura da UI de importação IA', () => {
  test.beforeEach(async ({ page }) => {
    // Mocking Firebase auth so the page doesn't redirect before DOM renders
    await page.addInitScript(() => {
      // Stub global Firebase so the page scripts don't crash on file://
      window.BUD_FIREBASE_CONFIG = { apiKey: 'test', authDomain: 'test', projectId: 'test', storageBucket: 'test', messagingSenderId: '0', appId: '0' };
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
  });

  test('dropzone de foto existe na página', async ({ page }) => {
    const dropzone = page.locator('#iaDropzoneFoto');
    await expect(dropzone).toBeAttached();
  });

  test('input de foto aceita imagens', async ({ page }) => {
    const input = page.locator('#inputFotoIA');
    await expect(input).toHaveAttribute('accept', 'image/*');
  });

  test('dropzone de PDF existe na página', async ({ page }) => {
    const dropzone = page.locator('#iaDropzonePdf');
    await expect(dropzone).toBeAttached();
  });

  test('input de PDF aceita application/pdf', async ({ page }) => {
    const input = page.locator('#inputPdfIA');
    await expect(input).toHaveAttribute('accept', 'application/pdf');
  });

  test('textarea de texto IA existe com limite de 8000 chars', async ({ page }) => {
    const textarea = page.locator('#inputTextoIA');
    await expect(textarea).toBeAttached();
    await expect(textarea).toHaveAttribute('maxlength', '8000');
  });

  test('botão Analisar com IA existe', async ({ page }) => {
    const btn = page.locator('#btnEnviarIA');
    await expect(btn).toBeAttached();
  });

  test('botão Analisar com IA começa desabilitado', async ({ page }) => {
    const btn = page.locator('#btnEnviarIA');
    await expect(btn).toBeDisabled();
  });
});
