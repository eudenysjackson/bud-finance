const parseVal = s => parseFloat(String(s).replace(/\./g,'').replace(',','.'));

// Texto simulado do PDF — inclui sinal negativo com R$
const texto = `Estorno de Uber - NuPay -R$ 11,93
Estorno de Uber - NuPay -R$ 20,91
Estorno de Uber -R$ 18,90
Estorno de Uber - NuPay -R$ 8,72
Estorno de Mp *Duxnutrition Estorno referente a compra em Mp *Duxnutrition, de valor R$ 51,06, realizada -R$ 51,06`;

// === MÉTODO 1: keyword
const estornos = [];
const re1 = /estorno[\s\S]{0,300}?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
let em;
while ((em = re1.exec(texto)) !== null) {
  const ev = parseVal(em[1]);
  if (!isNaN(ev) && ev > 0) estornos.push(ev);
}
console.log('Método 1 (keyword):', estornos);

// === MÉTODO 2: sinal negativo "-R$ X,XX"
const re2 = /[\u2212\-]\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const totalAPagar = 1242.36;
while ((em = re2.exec(texto)) !== null) {
  const cv = parseVal(em[1]);
  const jaPresente = estornos.some(e => Math.abs(e - cv) < 0.02);
  const ehGrande = cv >= totalAPagar * 0.8;
  if (!isNaN(cv) && cv > 0 && !jaPresente && !ehGrande) estornos.push(cv);
}
console.log('Após método 2 (sinal negativo):', estornos);

// === AUTO-CORREÇÃO: simula cenário onde estorno não foi detectado pelos métodos acima
// Cenário: totalAPagar=596.48, mas computado = 647.54 (diff = 51,06 → Mp *Duxnutrition)
console.log('\n--- Simulando falha de detecção (sem Duxnutrition 51,06) ---');

const itensMock = [
  { desc: 'Cobasi', valor: 196.90 },
  { desc: 'Apple Bill', valor: 66.90 },
  { desc: 'Restaurante', valor: 34.50 },
  { desc: 'Shopee', valor: 184.93 },
  { desc: 'Uber - NuPay', valor: 11.93 },
  { desc: 'Uber - NuPay', valor: 20.91 },
  { desc: 'Uber - NuPay', valor: 18.90 },
  { desc: 'Uber - NuPay', valor: 8.72 },
  { desc: 'Mp *Duxnutrition', valor: 51.06 }, // deveria ser estorno
  { desc: 'iFood', valor: 14.59 },
  { desc: '99 - NuPay', valor: 38.20 },
];
const totalAPagarSim = 596.48; // == soma de tudo EXCETO os 5 estornos (4 Uber + Dux)
// Verificar: 196.90+66.90+34.50+184.93+14.59+38.20 = 536.02 (sem dux)... não bate
// Melhor: fixar o totalAPagarSim baseado nos itens reais:
const itensAtivos = itensMock.filter((_,i) => i < 6 || i >= 10); // só os não-estorno
const totalRef = itensMock
  .filter((it, i) => ![4,5,6,7,8].includes(i)) // exclui os 5 estornos
  .reduce((s, i) => s + i.valor, 0);
const totalAPagarReal = Math.round(totalRef * 100) / 100;

const itensProcessados = itensMock.map(it => ({ ...it, status: 'ativa', selecionado: true }));
// Simula: só os 4 Uber foram detectados (índices 4,5,6,7), Duxnutrition (8) ficou ativo
[4,5,6,7].forEach(i => { itensProcessados[i].status = 'estornado'; itensProcessados[i].selecionado = false; });

const computado = itensProcessados.filter(i => i.status === 'ativa').reduce((s, i) => s + i.valor, 0);
let diff = Math.round((computado - totalAPagarReal) * 100) / 100;
console.log(`totalAPagar (real): R$ ${totalAPagarReal.toFixed(2)}`);
console.log(`Total antes da auto-correção: R$ ${computado.toFixed(2)} | diff: R$ ${diff.toFixed(2)}`);

for (let i = itensProcessados.length - 1; i >= 0 && diff > 0.01; i--) {
  const it = itensProcessados[i];
  if (it.status !== 'ativa') continue;
  if (Math.abs(it.valor - diff) < 0.02) {
    it.status = 'estornado';
    it.selecionado = false;
    diff = 0;
    console.log(`[BudAI] Auto-correção: "${it.desc}" R$ ${it.valor.toFixed(2)} → estorno`);
  }
}
const computadoApos = itensProcessados.filter(i => i.status === 'ativa').reduce((s, i) => s + i.valor, 0);
console.log(`Total APÓS auto-correção: R$ ${computadoApos.toFixed(2)} | esperado: R$ ${totalAPagarReal.toFixed(2)}`);
console.log('Match?', Math.abs(computadoApos - totalAPagarReal) < 0.02 ? 'SIM ✓' : 'NÃO ✗');
