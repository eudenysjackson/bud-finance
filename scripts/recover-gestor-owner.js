const { createHash } = require('node:crypto');
const { closeSync, openSync, readFileSync, writeFileSync } = require('node:fs');
const admin = require('../backend/node_modules/firebase-admin');

async function main() {
  const [codeFile, linkFile, confirmation, target] = process.argv.slice(2);
  if (!codeFile || !linkFile || confirmation !== '--whatsapp-verified') {
    throw new Error('Informe os arquivos privados de entrada e saída e confirme o contato pelo WhatsApp cadastrado.');
  }
  const local = process.env.BUD_USE_EMULATOR === 'true';
  if (local) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  } else if (target !== '--production' || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Selecione o emulador ou indique --production com credenciais do projeto.');
  }
  const code = readFileSync(codeFile, 'utf8').trim();
  if (!/^[a-f0-9]{32}$/.test(code)) throw new Error('Código inválido.');
  const hash = createHash('sha256').update(code).digest('hex');
  admin.initializeApp({ projectId: local ? 'bud-finance-local' : 'bud-finance' });
  const db = admin.firestore();
  const ref = db.doc('_gestor_private/owner');
  const profile = (await ref.get()).data();
  if (!profile?.whatsappVerified || !profile.recoveryCodes.includes(hash)) throw new Error('Recuperação não autorizada.');
  const auth = admin.auth();
  const owner = await auth.getUser(profile.uid);
  if (owner.disabled || !owner.emailVerified || !owner.customClaims?.budGestorOwner) throw new Error('Conta indisponível.');
  const link = await auth.generatePasswordResetLink(owner.email);
  const output = openSync(linkFile, 'wx', 0o600);
  try {
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.uid !== owner.uid || current.whatsapp !== profile.whatsapp ||
          !current.whatsappVerified || !current.recoveryCodes.includes(hash)) throw new Error('Recuperação não autorizada.');
      tx.update(ref, { recoveryCodes: current.recoveryCodes.filter(item => item !== hash) });
    });
    writeFileSync(output, link + '\n');
  } finally {
    closeSync(output);
  }
  console.log('Link salvo no arquivo privado. Entregue apenas pelo WhatsApp confirmado do proprietário.');
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error.message);
  process.exit(1);
});
