/* Base de homologação para conferir todas as telas e breakpoints do Bud Finance. */
const admin = require('../backend/node_modules/firebase-admin');

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GOOGLE_CLOUD_PROJECT = 'bud-finance-local';
admin.initializeApp({ projectId: 'bud-finance-local' });

const db = admin.firestore();
const T = admin.firestore.Timestamp;
const email = 'eudenysjackson@gmail.com';
const password = 'BudLocal@2026';
const date = (iso) => T.fromDate(new Date(iso + 'T12:00:00'));

async function main() {
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    user = await admin.auth().createUser({ email, password, displayName: 'Denys', emailVerified: true });
  }
  // A reconstrução também normaliza as credenciais locais, para que a massa
  // possa ser usada imediatamente depois de restaurada.
  user = await admin.auth().updateUser(user.uid, {
    password,
    displayName: 'Denys',
    emailVerified: true,
    disabled: false,
  });
  const root = db.collection('usuarios').doc(user.uid);
  const docs = {
    carteira: {
      nubank: { nome: 'Nubank', tipo: 'banco', banco: 'Nubank', saldo: 1120.48, saldoInicial: 1120.48, cor: '#7c3aed', ultimaConfirmacao: '2026-09-12' },
      itau: { nome: 'Itaú', tipo: 'banco', banco: 'Itaú', saldo: 680.25, saldoInicial: 680.25, cor: '#ec7000' },
      reserva: { nome: 'Reserva de emergência', tipo: 'poupanca', banco: 'Nubank', saldo: 950.00, saldoInicial: 950.00, cor: '#16a34a' },
      cartaoNubank: { nome: 'Nubank', tipo: 'credito', bandeira: 'Mastercard', limite: 2500, limiteReservado: 746.82, fechamento: 5, vencimento: 12, cor: '#820ad1', saldo: 0, saldoInicial: 0, faturasPagas: {}, faturasMetodo: {} },
      cartaoItau: { nome: 'Itaú Personnalité', tipo: 'credito', bandeira: 'Visa', limite: 4000, limiteReservado: 1325.40, fechamento: 8, vencimento: 15, cor: '#ec7000', saldo: 0, saldoInicial: 0, faturasPagas: {}, faturasMetodo: {} },
      cartaoBradesco: { nome: 'Bradesco', tipo: 'credito', bandeira: 'Elo', limite: 1800, limiteReservado: 296.50, fechamento: 10, vencimento: 18, cor: '#cc092f', saldo: 0, saldoInicial: 0, faturasPagas: {}, faturasMetodo: {} }
    },
    categorias: {
      casa: { nome: 'Casa', emoji: '🏠', tipo: 'despesa', cor: '#f97316' },
      streaming: { nome: 'Assinaturas/Streaming', emoji: '📺', tipo: 'despesa', cor: '#8b5cf6' },
      freelance: { nome: 'Freelance', emoji: '💼', tipo: 'receita', cor: '#16a34a' }
    },
    recorrentes: {
      salario: { descricao: 'Salário', tipo: 'receita', valor: 3200, categoria: 'Salário', contaId: 'nubank', contaNome: 'Nubank', contaTipo: 'banco', periodicidade: 'mensal', diaVencimento: 5, proximaData: date('2026-10-05'), ativa: true },
      aluguel: { descricao: 'Aluguel', tipo: 'despesa', valor: 950, categoria: 'Moradia', contaId: 'nubank', contaNome: 'Nubank', contaTipo: 'banco', periodicidade: 'mensal', diaVencimento: 10, proximaData: date('2026-10-10'), ativa: true },
      gjutt: { descricao: 'gjutt', tipo: 'despesa', valor: 200, categoria: 'Assinaturas/Streaming', contaId: 'nubank', contaNome: 'Nubank', contaTipo: 'banco', periodicidade: 'mensal', diaVencimento: 12, proximaData: date('2026-09-12'), ativa: true },
      timEmpresarial: { descricao: 'Tim Empresarial', tipo: 'despesa', valor: 40, categoria: 'Assinaturas/Streaming', contaId: 'nubank', contaNome: 'Nubank', contaTipo: 'banco', periodicidade: 'mensal', diaVencimento: 14, proximaData: date('2026-09-14'), ativa: true },
      internet: { descricao: 'Internet residencial', tipo: 'despesa', valor: 120, categoria: 'Casa', contaId: 'nubank', contaNome: 'Nubank', contaTipo: 'banco', periodicidade: 'mensal', diaVencimento: 18, proximaData: date('2026-09-18'), ativa: true }
    },
    limites: {
      alimentacao: { categoria: 'Alimentação', valor: 650, periodo: 'mensal', ativo: true },
      lazer: { categoria: 'Lazer', valor: 300, periodo: 'mensal', ativo: true },
      casa: { categoria: 'Casa', valor: 450, periodo: 'mensal', ativo: true }
    },
    metas: {
      celular: { nome: 'Novo celular', emoji: '🎯', valorAlvo: 3000, valorAtual: 750, prazo: '2026-11-21', criadoEm: date('2026-09-01') },
      viagem: { nome: 'Viagem de férias', emoji: '✈️', valorAlvo: 5000, valorAtual: 2800, prazo: '2027-01-15', criadoEm: date('2026-08-15') }
    },
    investimentos: {
      cdb: { nome: 'CDB liquidez diária', tipo: 'Renda fixa', corretora: 'Nubank', valor: 1000, valorAtual: 1043.50, rendimento: 4.35, liquidez: 'Imediata', vencimento: '2027-09-12', data: '2026-06-12' },
      tesouro: { nome: 'Tesouro Selic 2029', tipo: 'Tesouro Direto', corretora: 'Itaú', valor: 800, valorAtual: 812.20, rendimento: 1.525, liquidez: 'D+1', vencimento: '2029-03-01', data: '2026-08-05' }
    },
    dividas: {
      parcelamentoItau: { nome: 'Parcelamento fatura Itaú', tipo: 'Cartão de Crédito', tipoIcone: '💳', instituicao: 'Itaú', formato: 'manual', valorTotal: 1375.08, valorPago: 229.18, jurosPagos: 45, parcelas: 6, parcelasPagas: 1, valorParcela: 229.18, juros: 10.5, cet: 12.1, vencimento: '2026-09-15', contaId: 'nubank', cartaoId: 'cartaoItau', quitada: false },
      noventaNove: { nome: '99Pay', tipo: 'Empréstimo', tipoIcone: '💰', instituicao: '99Pay', formato: 'manual', valorTotal: 690.44, valorPago: 172.61, jurosPagos: 25, parcelas: 4, parcelasPagas: 1, valorParcela: 172.61, juros: 11.6, cet: 14.2, vencimento: '2026-09-10', contaId: 'nubank', quitada: false },
      rodrigo: { nome: 'Rodrigo', tipo: 'Pessoal', tipoIcone: '🤝', instituicao: 'Empréstimo informal', formato: 'manual', valorTotal: 500, valorPago: 0, jurosPagos: 0, parcelas: 2, parcelasPagas: 0, valorParcela: 250, juros: 0, vencimento: '2026-08-10', contaId: 'nubank', quitada: false }
    },
    transacoes: {
      salarioSet: { tipo: 'receita', descricao: 'Salário setembro', categoria: 'Salário', valor: 3200, dataReferencia: '2026-09-05', data: date('2026-09-05'), carteiraId: 'nubank', formaPagamento: 'Conta', origem: 'manual', status: 'ativa' },
      freelanceSet: { tipo: 'receita', descricao: 'Projeto freelance', categoria: 'Freelance', valor: 850, dataReferencia: '2026-09-08', data: date('2026-09-08'), carteiraId: 'itau', formaPagamento: 'Conta', origem: 'manual', status: 'ativa' },
      aluguelSet: { tipo: 'despesa', descricao: 'Aluguel setembro', categoria: 'Moradia', valor: 950, dataReferencia: '2026-09-10', data: date('2026-09-10'), carteiraId: 'nubank', formaPagamento: 'Pix', origem: 'manual', status: 'ativa' },
      mercado: { tipo: 'despesa', descricao: 'Supermercado', categoria: 'Alimentação', valor: 286.47, dataReferencia: '2026-09-11', data: date('2026-09-11'), carteiraId: 'nubank', formaPagamento: 'Débito', origem: 'manual', status: 'ativa' },
      ifood: { tipo: 'despesa', descricao: 'iFood', categoria: 'Alimentação', valor: 78.90, dataReferencia: '2026-09-12', data: date('2026-09-12'), cartaoId: 'cartaoNubank', formaPagamento: 'Crédito', origem: 'manual', status: 'ativa' },
      notebook1: { tipo: 'despesa', descricao: 'Notebook (1/4)', categoria: 'Eletrônicos', valor: 299.97, dataReferencia: '2026-09-12', data: date('2026-09-12'), cartaoId: 'cartaoItau', formaPagamento: 'Crédito', origem: 'manual', status: 'ativa', parcelado: true, parcelaAtual: 1, totalParcelas: 4 },
      notebook2: { tipo: 'despesa', descricao: 'Notebook (2/4)', categoria: 'Eletrônicos', valor: 299.97, dataReferencia: '2026-10-12', data: date('2026-10-12'), cartaoId: 'cartaoItau', formaPagamento: 'Crédito', origem: 'manual', status: 'ativa', parcelado: true, parcelaAtual: 2, totalParcelas: 4 },
      notebook3: { tipo: 'despesa', descricao: 'Notebook (3/4)', categoria: 'Eletrônicos', valor: 299.97, dataReferencia: '2026-11-12', data: date('2026-11-12'), cartaoId: 'cartaoItau', formaPagamento: 'Crédito', origem: 'manual', status: 'ativa', parcelado: true, parcelaAtual: 3, totalParcelas: 4 },
      notebook4: { tipo: 'despesa', descricao: 'Notebook (4/4)', categoria: 'Eletrônicos', valor: 299.97, dataReferencia: '2026-12-12', data: date('2026-12-12'), cartaoId: 'cartaoItau', formaPagamento: 'Crédito', origem: 'manual', status: 'ativa', parcelado: true, parcelaAtual: 4, totalParcelas: 4 },
      academia: { tipo: 'despesa', descricao: 'Academia', categoria: 'Saúde', valor: 99.90, dataReferencia: '2026-09-03', data: date('2026-09-03'), carteiraId: 'nubank', formaPagamento: 'Pix', origem: 'manual', status: 'ativa' },
      agosto: { tipo: 'receita', descricao: 'Salário agosto', categoria: 'Salário', valor: 3200, dataReferencia: '2026-08-05', data: date('2026-08-05'), carteiraId: 'nubank', formaPagamento: 'Conta', origem: 'manual', status: 'ativa' }
    }
  };

  const batch = db.batch();
  batch.set(root, { email, nome: 'Denys', onboardingConcluido: true, plano: 'pro', status: 'ativo', origemHomologacao: 'base-responsividade', atualizadoEm: T.now() }, { merge: true });
  for (const [collection, values] of Object.entries(docs)) for (const [id, data] of Object.entries(values)) batch.set(root.collection(collection).doc(id), { ...data, criadoEm: data.criadoEm || T.now(), atualizadoEm: T.now() }, { merge: true });
  await batch.commit();
  console.log('BASE_RESPONSIVIDADE_PRONTA');
}

main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
