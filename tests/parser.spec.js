/**
 * tests/parser.spec.js — DT-004
 * Testes unitários para parseBankStatementText e helpers.
 * Roda sem browser: npx playwright test tests/parser.spec.js
 */

const { test, expect } = require('@playwright/test');
const {
  parseValorBRL,
  isNonTransactionLine,
  parseBankStatementText
} = require('../backend/parser');

// ─── parseValorBRL ────────────────────────────────────────────────────

test.describe('parseValorBRL', () => {
  test('formato BR com ponto de milhar: 1.234,56', () => {
    expect(parseValorBRL('1.234,56')).toBe(1234.56);
  });

  test('formato BR sem ponto de milhar: 234,56', () => {
    expect(parseValorBRL('234,56')).toBe(234.56);
  });

  test('valor com espaços em volta', () => {
    expect(parseValorBRL('  99,90  ')).toBe(99.90);
  });

  test('string vazia retorna 0', () => {
    expect(parseValorBRL('')).toBe(0);
  });

  test('null retorna 0', () => {
    expect(parseValorBRL(null)).toBe(0);
  });
});

// ─── isNonTransactionLine ─────────────────────────────────────────────

test.describe('isNonTransactionLine', () => {
  test('linha de total é ignorada', () => {
    expect(isNonTransactionLine('Total compras nacionais')).toBe(true);
  });

  test('linha de saldo é ignorada', () => {
    expect(isNonTransactionLine('Saldo final do período')).toBe(true);
  });

  test('linha de total de saídas é ignorada', () => {
    expect(isNonTransactionLine('Total de saídas R$ 3.500,00')).toBe(true);
  });

  test('linha de seção de cartão é ignorada', () => {
    expect(isNonTransactionLine('Cartão 1234 XXXX XXXX 5678')).toBe(true);
  });

  test('descrição de transação real NÃO é ignorada', () => {
    expect(isNonTransactionLine('Mercado Livre*Compra 12/04')).toBe(false);
  });

  test('nome de estabelecimento simples NÃO é ignorado', () => {
    expect(isNonTransactionLine('Padaria Brasil')).toBe(false);
  });
});

// ─── parseBankStatementText ───────────────────────────────────────────

test.describe('parseBankStatementText — layout horizontal PT (Strategy 1)', () => {
  test('Nubank CC — 2 transações DD ABR layout', () => {
    const raw = `
2024

12 abr Mercado Livre 150,00
15 abr Netflix 39,90
Total de saídas R$ 189,90
    `.trim();

    const txs = parseBankStatementText(raw);
    expect(txs.length).toBeGreaterThanOrEqual(2);

    const ml = txs.find(t => /mercado livre/i.test(t.desc));
    expect(ml).toBeTruthy();
    expect(ml.valor).toBe(150.00);
    expect(ml.data).toBe('2024-04-12');

    const nf = txs.find(t => /netflix/i.test(t.desc));
    expect(nf).toBeTruthy();
    expect(nf.valor).toBe(39.90);
    expect(nf.data).toBe('2024-04-15');
  });
});

test.describe('parseBankStatementText — layout horizontal DD/MM (Strategy 1)', () => {
  test('Itaú extrato — DD/MM com sinal +/-', () => {
    const raw = `
2024
03/04 Salário +5.000,00
10/04 Supermercado ABC -350,00
Total
    `.trim();

    const txs = parseBankStatementText(raw);
    expect(txs.length).toBeGreaterThanOrEqual(2);

    const sal = txs.find(t => /sal[aá]rio/i.test(t.desc));
    expect(sal).toBeTruthy();
    expect(sal.valor).toBe(5000.00);
    expect(sal.tipo).toBe('credito');
    expect(sal.data).toBe('2024-04-03');

    const sup = txs.find(t => /supermercado/i.test(t.desc));
    expect(sup).toBeTruthy();
    expect(sup.valor).toBe(350.00);
    expect(sup.tipo).toBe('debito');
  });
});

test.describe('parseBankStatementText — layout vertical/bloco (Strategy 2)', () => {
  test('Nubank extrato — data sozinha na linha, desc em seguida, valor depois', () => {
    const raw = `
2024
5 mai
Uber *viagem
-R$25,90
7 mai
Farmácia Popular
R$89,00
    `.trim();

    const txs = parseBankStatementText(raw);
    const uber = txs.find(t => /uber/i.test(t.desc));
    expect(uber).toBeTruthy();
    expect(uber.valor).toBe(25.90);
    expect(uber.data).toBe('2024-05-05');
  });
});

test.describe('parseBankStatementText — casos extremos', () => {
  test('texto vazio retorna array vazio', () => {
    expect(parseBankStatementText('')).toEqual([]);
  });

  test('texto sem nenhuma transação retorna array vazio', () => {
    const garbage = 'Bud Finance\nExtrato de conta\nCNPJ 00.000.000/0001-00\n';
    expect(parseBankStatementText(garbage)).toEqual([]);
  });

  test('deduplicação — mesma transação repetida retorna apenas 1', () => {
    const raw = `
2024
10 mar Spotify 19,90
10 mar Spotify 19,90
    `.trim();
    const txs = parseBankStatementText(raw);
    const spotify = txs.filter(t => /spotify/i.test(t.desc));
    expect(spotify.length).toBe(1);
  });

  test('valor acima de 99999 é descartado (proteção contra totais)', () => {
    const raw = `2024\n01 jan Transferência 150.000,00\n`;
    const txs = parseBankStatementText(raw);
    expect(txs.length).toBe(0);
  });
});
