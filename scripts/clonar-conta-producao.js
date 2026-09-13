/*
 * Clona uma única conta do Firestore de produção para o Firebase Emulator.
 * Não altera produção. Para gravar no emulador é obrigatório passar --aplicar.
 *
 * Uso:
 *   $env:FIREBASE_SERVICE_ACCOUNT_FILE = 'C:\caminho\service-account.json'
 *   node scripts/clonar-conta-producao.js --email voce@exemplo.com --aplicar
 */
const fs = require('fs');
const readline = require('readline');
const admin = require('../backend/node_modules/firebase-admin');
const { Firestore } = require('../backend/node_modules/@google-cloud/firestore');

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
const email = String(getArg('--email') || '').trim().toLowerCase();
const aplicar = args.includes('--aplicar');
const colecoesPermitidas = new Set([
  'transacoes', 'carteira', 'cartoes', 'categorias', 'recorrentes', 'dividas',
  'metas', 'limites', 'investimentos', 'compras', 'listas-compras',
  'aprendizado-itens', 'mercados-conhecidos', 'importacoes'
]);

function falhar(mensagem) {
  console.error('\n' + mensagem);
  process.exit(1);
}

function carregarCredencial() {
  const arquivo = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    if (arquivo) return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    if (json) return JSON.parse(json);
  } catch (erro) {
    falhar('Não foi possível ler a credencial de produção: ' + erro.message);
  }
  falhar('Defina FIREBASE_SERVICE_ACCOUNT_FILE (recomendado) ou FIREBASE_SERVICE_ACCOUNT apenas nesta sessão local.');
}

function perguntarSenha() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question('Defina uma senha APENAS para a cópia local: ', (valor) => {
    rl.close();
    resolve(valor);
  }));
}

function limparPerfil(dados) {
  const seguro = { ...dados };
  for (const chave of Object.keys(seguro)) {
    if (/token|secret|password|stripe|checkout|pagamento|payment|verification|oobcode/i.test(chave)) delete seguro[chave];
  }
  return seguro;
}

async function listarDocumentos(dbProducao, referencia, documentos) {
  const subcolecoes = await referencia.listCollections();
  for (const subcolecao of subcolecoes) {
    if (referencia.path.split('/').length === 2 && !colecoesPermitidas.has(subcolecao.id)) continue;
    const snapshot = await subcolecao.get();
    for (const documento of snapshot.docs) {
      documentos.push({ caminho: documento.ref.path, dados: documento.data() });
      await listarDocumentos(dbProducao, documento.ref, documentos);
    }
  }
}

async function main() {
  if (!email) falhar('Uso: node scripts/clonar-conta-producao.js --email seu@email.com [--aplicar]');
  const credencial = carregarCredencial();
  const projeto = credencial.project_id;
  if (!projeto) falhar('A credencial não contém project_id.');

  const appProducao = admin.initializeApp({ credential: admin.credential.cert(credencial), projectId: projeto }, 'clone-producao');
  const usuarioProducao = await appProducao.auth().getUserByEmail(email);
  const dbProducao = new Firestore({ projectId: projeto, credentials: credencial });
  const raizProducao = dbProducao.collection('usuarios').doc(usuarioProducao.uid);
  const perfil = await raizProducao.get();
  if (!perfil.exists) falhar('A conta existe no Auth de produção, mas não possui perfil em usuarios/' + usuarioProducao.uid + '.');

  const documentos = [{ caminho: raizProducao.path, dados: limparPerfil(perfil.data()) }];
  await listarDocumentos(dbProducao, raizProducao, documentos);

  console.log('Conta localizada:', usuarioProducao.email);
  console.log('Documentos financeiros que serão copiados:', documentos.length);
  console.log('Coleções incluídas:', [...colecoesPermitidas].join(', '));
  console.log('Produção permanece somente leitura.');
  if (!aplicar) {
    console.log('\nPrévia concluída. Revise e rode novamente com --aplicar para gravar no emulador.');
    return;
  }

  const senhaLocal = await perguntarSenha();
  if (senhaLocal.length < 8) falhar('A senha local precisa ter no mínimo 8 caracteres.');

  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  const appLocal = admin.initializeApp({ projectId: 'bud-finance-local' }, 'clone-emulador');
  const authLocal = appLocal.auth();
  try {
    await authLocal.updateUser(usuarioProducao.uid, {
      email: usuarioProducao.email, password: senhaLocal,
      displayName: usuarioProducao.displayName || '', emailVerified: true, disabled: false,
    });
  } catch (erro) {
    if (erro.code !== 'auth/user-not-found') throw erro;
    await authLocal.createUser({ uid: usuarioProducao.uid, email: usuarioProducao.email, password: senhaLocal,
      displayName: usuarioProducao.displayName || '', emailVerified: true });
  }

  const dbLocal = new Firestore({ projectId: 'bud-finance-local', host: '127.0.0.1:8080', ssl: false });
  for (let inicio = 0; inicio < documentos.length; inicio += 400) {
    const lote = dbLocal.batch();
    documentos.slice(inicio, inicio + 400).forEach(({ caminho, dados }) => {
      lote.set(dbLocal.doc(caminho), dados, { merge: false });
    });
    await lote.commit();
  }
  await dbLocal.doc(raizProducao.path).set({
    clonadoDeProducaoEm: new Date().toISOString(),
    origemHomologacao: 'producao',
  }, { merge: true });
  console.log('\nCópia local concluída. Faça login em localhost com ' + usuarioProducao.email + ' e a senha local informada.');
}

main().then(() => process.exit(0)).catch((erro) => falhar(erro.message));
