const { createHash, randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const admin = require('../backend/node_modules/firebase-admin');

async function main() {
  const [profilePath, codesPath, target] = process.argv.slice(2);
  if (!profilePath || !codesPath) throw new Error('Informe o arquivo privado do perfil e o destino privado dos códigos.');
  const { email, name, whatsapp, whatsappVerified, password } = JSON.parse(readFileSync(profilePath, 'utf8'));
  if (typeof email !== 'string' || typeof name !== 'string' || typeof whatsapp !== 'string') {
    throw new Error('Informe email, name e whatsapp no perfil privado.');
  }
  const recoveryEmail = email.trim().toLowerCase();
  const phone = whatsapp.replace(/\D/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail) || name.trim().length < 3 ||
      phone.length < 10 || phone.length > 15) throw new Error('Revise o perfil do proprietário.');

  const local = process.env.BUD_USE_EMULATOR === 'true';
  if (!local && (target !== '--production' || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error('Selecione o emulador ou indique --production com credenciais do projeto.');
  }
  if (local) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  admin.initializeApp({ projectId: local ? 'bud-finance-local' : 'bud-finance' });
  const auth = admin.auth();
  const db = admin.firestore();
  let owner;
  try {
    owner = await auth.getUserByEmail(recoveryEmail);
  } catch (error) {
    if (!local || error.code !== 'auth/user-not-found') throw error;
    owner = await auth.createUser({ email: recoveryEmail, password, emailVerified: true, displayName: name.trim() });
  }
  if (!owner.emailVerified || owner.disabled) throw new Error('A conta do proprietário precisa estar ativa e com e-mail verificado.');

  const codes = Array.from({ length: 8 }, () => randomBytes(16).toString('hex'));
  const ref = db.doc('_gestor_private/owner');
  const previous = await ref.get();
  if (previous.exists && previous.data().uid !== owner.uid) throw new Error('Já existe outro proprietário do Bud Gestor.');
  writeFileSync(codesPath, codes.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.exists && current.data().uid !== owner.uid) throw new Error('Já existe outro proprietário do Bud Gestor.');
    tx.set(ref, {
      uid: owner.uid, name: name.trim(), recoveryEmail, whatsapp: phone,
      whatsappVerified: whatsappVerified === true,
      recoveryCodes: codes.map(code => createHash('sha256').update(code).digest('hex'))
    });
  });
  await auth.setCustomUserClaims(owner.uid, { ...owner.customClaims, budGestorOwner: true });
  console.log('Proprietário configurado. Guarde os códigos no local privado escolhido.');
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error.message);
  process.exit(1);
});
