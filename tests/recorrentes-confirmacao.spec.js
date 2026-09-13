const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test.describe('Recorrentes — previsão só vira movimento após confirmação', () => {
  test('onboarding não cria transação financeira automaticamente', () => {
    const source = read('appbudfinance/js/onboarding.js');
    expect(source).not.toContain("collection(db, 'usuarios', uid, 'transacoes')");
    expect(source).toContain('exigeConfirmacao: true');
    expect(source).toContain('valorPrevisto:');
  });

  test('backend não processa saldo ao chegar o vencimento', () => {
    const source = read('backend/server.js');
    const inicio = source.indexOf("app.post('/api/processar-recorrentes'");
    expect(inicio).toBeGreaterThan(-1);
    const rota = source.slice(inicio, source.indexOf("// ───", inicio + 10));
    expect(rota).not.toContain('FieldValue.increment(deltasPorConta');
  });

  test('dashboard permite ajustar valor e data reais', () => {
    const source = read('appbudfinance/js/dashboard.js');
    expect(source).toContain('id="pmgValorReal"');
    expect(source).toContain('id="pmgDataReal"');
    expect(source).toContain('diferencaPrevisto: valorReal - valorNum');
  });

  test('confirmação registra competência e evita duplicidade', () => {
    const source = read('appbudfinance/js/dashboard.js');
    expect(source).toContain('mesRecorrencia: mesRecorrencia');
    expect(source).toContain('if (t.mesRecorrencia === competencia) return true');
    expect(source).toContain('confirmado:     true');
    expect(source).toContain('pago:           true');
  });

  test('dashboard diferencia receber de pagar', () => {
    const source = read('appbudfinance/js/dashboard.js');
    expect(source).toContain("l.tipoTrans === 'receita' ? 'Recebi ✓' : 'Paguei ✓'");
    expect(source).toContain("'Conta creditada' : 'Conta debitada'");
  });
});
