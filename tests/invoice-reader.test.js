const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readPDF } = require('../backend/ai-reader');
const { readNubankInvoice } = require('../backend/invoice-reader');

const invoice = rows => `Nu Pagamentos S.A.\nFATURA 08 JAN 2026\nRESUMO DA FATURA ATUAL\nTotal a pagar R$ 20,00\nPRÓXIMAS FATURAS\nTRANSAÇÕES\nDE 01 DEZ A 01 JAN\n${rows}\n1 de 1`;
test('preserves repeated purchases, refunds and December year rollover', () => {
  const result = readNubankInvoice(invoice('02 DEZ\nLoja R$ 20,00\n02 DEZ\nLoja R$ 20,00\n03 DEZ\nEstorno de Loja −R$ 20,00'));
  assert.deepEqual(result.transacoes.map(t => t.valor), [20,20,-20]);
  assert.ok(result.transacoes.every(t => t.data.startsWith('2025-12')));
});
test('unreconciled or unknown layout falls back, never invents an adjustment', () => {
  assert.equal(readNubankInvoice(invoice('02 DEZ\nLoja R$ 19,00')), null);
  assert.equal(readNubankInvoice(invoice('02 DEZ\nLoja R$ 20,00').replace('Nu Pagamentos S.A.', 'Outro banco')), null);
});
test('multi-page PDF extracts 24 purchases without an AI request', async () => {
  const pages = await readPDF(fs.readFileSync('tests/fixtures/ia/nubank-layout.pdf'));
  const result = readNubankInvoice(pages.map(p => p.text).join('\n'));
  assert.equal(result.transacoes.length, 24);
  assert.equal(result.transacoes.reduce((sum,t) => sum+t.valor,0),300);
});
test('review does not fabricate balancing items or infer refunds from totals', () => {
  const source = fs.readFileSync('appbudfinance/js/cartoes.js','utf8');
  assert.ok(!source.includes("desc: 'Saldo anterior e ajustes da fatura'"));
  assert.ok(!source.includes('[BudAI] Auto-correção:'));
});
