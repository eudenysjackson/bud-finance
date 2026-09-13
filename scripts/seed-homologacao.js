/* Conta pública de teste — funciona somente no Firebase Emulator local. */
const admin = require('../backend/node_modules/firebase-admin');

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.GOOGLE_CLOUD_PROJECT ||= 'bud-finance-local';

admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

const EMAIL = 'homologacao@bud.local';
const PASSWORD = 'BudLocal@2026';

async function main() {
  const auth = admin.auth();
  const db = admin.firestore();
  const page = await auth.listUsers(1000);
  let user = page.users.find((u) => u.email === EMAIL || u.displayName === 'Homologação Bud');

  if (user) {
    user = await auth.updateUser(user.uid, {
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Homologação Bud',
      emailVerified: true,
      disabled: false,
    });
  } else {
    user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Homologação Bud',
      emailVerified: true,
    });
  }

  await db.collection('usuarios').doc(user.uid).set({
    email: EMAIL,
    nome: 'Homologação Bud',
    onboardingConcluido: true,
    plano: 'pro',
    status: 'ativo',
  }, { merge: true });

  console.log('Conta local pronta:', EMAIL);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
