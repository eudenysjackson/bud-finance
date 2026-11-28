// Fictitious data only. Refuse to run against production.
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw Error("Use somente os emuladores loopback.");
const admin = require("../backend/node_modules/firebase-admin");
admin.initializeApp({ projectId: "bud-finance-local" });
const { createMarketing } = require("../backend/gestor-marketing"),
  { createMarketingPreferences } = require("../backend/marketing-preferences");
(async () => {
  const db = admin.firestore(),
    uid = "marketing-demo-owner",
    owner = db.doc("_gestor_private/owner"),
    existing = await owner.get();
  if (existing.exists && existing.data().uid !== uid)
    throw Error("Existe outro proprietário no emulador. Preserve os dados.");
  try {
    await admin.auth().getUser(uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await admin
      .auth()
      .createUser({
        uid,
        email: "marketing.admin@example.test",
        password: "BudMarketing!2026",
        emailVerified: true,
        displayName: "Administrador de demonstração",
      });
  }
  await admin.auth().setCustomUserClaims(uid, { budGestorOwner: true });
  await owner.set({
    uid,
    name: "Administrador de demonstração",
    loginEmail: "marketing.admin@example.test",
    recoveryEmail: "marketing.admin@example.test",
    recoveryEmailVerified: true,
    whatsapp: "11900000000",
  });
  const profiles = [
    ["marketing-demo-a", "Ana de demonstração", "ana@example.test", "free"],
    ["marketing-demo-b", "Bruno de demonstração", "bruno@example.test", "free"],
    [
      "marketing-demo-c",
      "Cliente Pro de demonstração",
      "pro@example.test",
      "plus",
    ],
  ];
  for (const [id, nome, email, plano] of profiles)
    await db
      .doc("usuarios/" + id)
      .set({
        nome,
        email,
        plano,
        lgpdConsentimento: true,
        dataCadastro: admin.firestore.Timestamp.fromDate(
          new Date("2026-11-10T12:00:00Z"),
        ),
        ultimoAcesso: admin.firestore.Timestamp.fromDate(
          new Date("2026-11-01T12:00:00Z"),
        ),
      });
  const service = createMarketing({
    db,
    preferences: createMarketingPreferences({
      db,
      secret: "bud-finance-local-verification-only",
      frontendURL: "http://127.0.0.1:13252/appbudfinance",
    }),
    send: async () => ({ simulated: true }),
    enabled: true,
    simulated: true,
  });
  if ((await db.collection("_gestor_campaigns").limit(1).get()).empty) {
    const draft = {
      name: "Novos preços · demonstração",
      subject: "Assine o Bud Finance e organize seu dinheiro",
      title: "Mais possibilidades para organizar seu dinheiro",
      body: "Contas, cartões de crédito, benefícios, dívidas e metas. Escolha o plano que acompanha sua rotina e organize o mês com mais clareza.",
      template: "plans",
      buddy: true,
      segment: { plan: "free" },
    };
    await service.save(null, draft, uid);
    const second = await service.save(
      null,
      {
        ...draft,
        name: "Boas-vindas · demonstração",
        subject: "Um começo mais organizado",
        title: "Seu primeiro passo no Bud Finance",
        template: "news",
        body: "Cadastre uma conta, registre sua primeira entrada ou despesa e comece a acompanhar o seu mês.",
      },
      uid,
    );
    await service.test(second.id, uid);
    const p = await service.preview(second.id),
      c = await service.load(second.id);
    await service.queue(
      second.id,
      {
        revision: c.revision,
        audienceToken: p.audienceToken,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        confirm: true,
      },
      uid,
    );
  }
  console.log(
    "Demonstração preparada: somente emuladores, perfis fictícios e e-mails simulados.",
  );
  await admin.app().delete();
})().catch(() => {
  console.error(
    "Falha ao preparar demonstração local. Dados existentes preservados.",
  );
  process.exitCode = 1;
});
