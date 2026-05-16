// Simula o texto que pdf.js extrai do PDF Nubank (baseado nas páginas 5-6)
const texto = `
TRANSACOES DE 01 ABR A 01 MAI
01 ABR Uber - NuPay R 11,14
02 ABR 99 - NuPay R 26,49
02 ABR Estorno de Uber - NuPay -R 11,93
02 ABR 99 - NuPay R 15,90
02 ABR Estorno de Uber - NuPay -R 20,91
02 ABR Uber - NuPay R 18,90
02 ABR Uber - NuPay R 11,93
02 ABR Uber - NuPay R 20,91
02 ABR Estorno de Uber - NuPay -R 18,90
03 ABR 99 - NuPay R 10,72
08 ABR Uber - NuPay R 8,72
08 ABR Estorno de Uber - NuPay -R 8,72
08 ABR Estorno de "Mp *Duxnutrition" Estorno referente a compra em Mp *Duxnutrition, de valor R$ 51,06, realizada em 11 de Marco de 2026 -R$ 51,06
`;

const parseVal = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));

// === REGEX ANTIGO ===
const estornosAntigo = [];
const reAntigo = /estorno[^0-9,]{0,60}?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
let em;
while ((em = reAntigo.exec(texto)) !== null) {
  const ev = parseVal(em[1]);
  if (!isNaN(ev) && ev > 0) estornosAntigo.push(ev);
}

// === REGEX NOVO ===
const estornosNovo = [];
const reNovo = /estorno[\s\S]{0,300}?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
while ((em = reNovo.exec(texto)) !== null) {
  const ev = parseVal(em[1]);
  if (!isNaN(ev) && ev > 0) estornosNovo.push(ev);
}

console.log('=== REGEX ANTIGO ===');
console.log('Detectados:', estornosAntigo);
console.log('51.06 detectado:', estornosAntigo.some(v => Math.abs(v - 51.06) < 0.02) ? 'SIM' : 'NAO');

console.log('\n=== REGEX NOVO ===');
console.log('Detectados:', estornosNovo);
console.log('51.06 detectado:', estornosNovo.some(v => Math.abs(v - 51.06) < 0.02) ? 'SIM' : 'NAO');

// === SIMULACAO DOIS PASSES ===
const itensMock = [
  { desc: 'Uber - NuPay', valor: 11.93 },  // estornado (cópia)
  { desc: 'Uber - NuPay', valor: 20.91 },  // estornado (cópia)
  { desc: 'Uber - NuPay', valor: 18.90 },  // estornado (cópia)
  { desc: 'Uber - NuPay', valor: 8.72 },   // estornado
  { desc: 'Mp *Duxnutrition', valor: 51.06 }, // estornado
  { desc: 'Uber - NuPay', valor: 11.14 },  // legítimo
  { desc: '99 - NuPay', valor: 26.49 },
  { desc: 'iFood', valor: 14.59 },
  { desc: 'Shopee', valor: 184.93 },
];

const pending = [...estornosNovo];
const estornosParaMarcar = new Set();
for (let i = itensMock.length - 1; i >= 0; i--) {
  const v = Math.abs(itensMock[i].valor);
  const idx = pending.findIndex(ev => Math.abs(v - ev) < 0.02);
  if (idx >= 0) {
    estornosParaMarcar.add(i);
    pending.splice(idx, 1);
    if (!pending.length) break;
  }
}

const ativos = itensMock.filter((_, i) => !estornosParaMarcar.has(i));
console.log('\n=== DOIS PASSES ===');
console.log('Marcados como estornado:');
for (const i of estornosParaMarcar) {
  console.log(`  [${i}] ${itensMock[i].desc} R$ ${itensMock[i].valor}`);
}
console.log('Legítimos:', ativos.map(i => `${i.desc} R$${i.valor}`));
console.log('Total ativos:', ativos.reduce((s, i) => s + i.valor, 0).toFixed(2));
