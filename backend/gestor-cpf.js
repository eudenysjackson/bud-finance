const { createHmac } = require('node:crypto');

function normalizeCpf(value) {
  if (typeof value !== 'string' || !/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value.trim())) return '';
  const cpf = value.replace(/\D/g, '');
  if (/^(\d)\1{10}$/.test(cpf)) return '';
  const digits = Array.from(cpf, Number);
  const check = size => {
    const remainder = digits.slice(0, size).reduce((sum, digit, i) => sum + digit * (size + 1 - i), 0) * 10 % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === digits[9] && check(10) === digits[10] ? cpf : '';
}

function cpfDigest(cpf, secret) {
  return createHmac('sha256', secret).update(cpf).digest('hex');
}

module.exports = { normalizeCpf, cpfDigest };
