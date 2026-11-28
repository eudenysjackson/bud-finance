// HTTP security and persistence test, restricted to the local emulators.
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw Error("Somente emuladores locais.");
const assert = require("node:assert/strict"),
  admin = require("../backend/node_modules/firebase-admin");
admin.initializeApp({ projectId: "bud-finance-local" });
async function sign(email, password) {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  assert.equal(r.status, 200);
  return (await r.json()).idToken;
}
async function request(path, token, method = "GET", body) {
  const r = await fetch("http://127.0.0.1:3000/api/gestor/marketing" + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
(async () => {
  const owner = await sign("marketing.admin@example.test", "BudMarketing!2026");
  try {
    await admin
      .auth()
      .createUser({
        uid: "marketing-demo-customer",
        email: "customer@example.test",
        password: "MarketingCustomer!2026",
        emailVerified: true,
      });
  } catch (e) {
    if (e.code !== "auth/uid-already-exists") throw e;
  }
  const customer = await sign(
    "customer@example.test",
    "MarketingCustomer!2026",
  );
  assert.equal((await request("")).status, 401);
  assert.equal((await request("", customer)).status, 403);
  assert.equal((await request("", owner)).status, 200);
  const direct = await fetch(
    "http://127.0.0.1:8080/v1/projects/bud-finance-local/databases/(default)/documents/_gestor_campaigns",
    { headers: { Authorization: "Bearer " + owner } },
  );
  assert.equal(direct.status, 403);
  const input = {
    name: "QA HTTP · simulação",
    subject: "QA local",
    title: "Prévia local",
    body: "Mensagem fictícia",
    template: "news",
    segment: { plan: "free" },
  };
  const saved = await request("", owner, "POST", input);
  assert.equal(saved.status, 200);
  const id = saved.body.id;
  const p = await request("/" + id + "/preview", owner);
  assert.equal(p.status, 200);
  assert.equal(p.body.count, 2);
  assert.equal(
    (
      await request("/" + id + "/queue", owner, "POST", {
        revision: 1,
        confirm: true,
        audienceToken: p.body.audienceToken,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/" + id + "/test", owner, "POST", {})).body.simulated,
    true,
  );
  const queued = await request("/" + id + "/queue", owner, "POST", {
    revision: 1,
    confirm: true,
    audienceToken: p.body.audienceToken,
    scheduledAt: new Date(Date.now() + 600000).toISOString(),
  });
  assert.equal(queued.status, 200);
  assert.equal(
    (
      await request("/" + id + "/queue", owner, "POST", {
        revision: 1,
        confirm: true,
        audienceToken: p.body.audienceToken,
      })
    ).status,
    409,
  );
  for (const action of ["pause", "resume", "cancel"])
    assert.equal(
      (await request("/" + id + "/control", owner, "POST", { action })).status,
      200,
    );
  assert.equal((await request("/" + id, owner)).body.status, "cancelled");
  console.log(
    "PASS localhost: anon401, cliente403, proprietário200, Firestore direto403, rascunho persistido, público2, teste obrigatório simulado, agendamento sem duplicidade, pausa/retomada/cancelamento.",
  );
  await admin.app().delete();
})().catch((error) => {
  console.error("FAIL QA local de marketing.", error.message);
  process.exitCode = 1;
});
