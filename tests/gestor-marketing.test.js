const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  createMarketing,
  registerMarketing,
  validateDraft,
  profileEligible,
  renderCampaign,
} = require("../backend/gestor-marketing");
const {
  createMarketingPreferences,
} = require("../backend/marketing-preferences");
const { createMarketingSender } = require("../backend/marketing-sender");
function database(initial = {}) {
  const state = new Map(Object.entries(initial));
  let seq = 0,
    tail = Promise.resolve();
  const ref = (path) => ({
    path,
    id: path.split("/").at(-1),
    get: async () => ({
      exists: state.has(path),
      data: () => structuredClone(state.get(path)),
    }),
    set: async (v, o) =>
      state.set(
        path,
        o?.merge ? { ...state.get(path), ...v } : structuredClone(v),
      ),
    update: async (v) => {
      if (!state.has(path)) throw Error("missing");
      state.set(path, { ...state.get(path), ...structuredClone(v) });
    },
    delete: async () => state.delete(path),
    collection: (n) => collection(path + "/" + n),
  });
  function collection(path, filters = [], sort = null, max = Infinity) {
    return {
      doc: (id) => ref(path + "/" + (id || "auto" + ++seq)),
      where: (f, op, v) =>
        collection(path, [...filters, [f, op, v]], sort, max),
      orderBy: (f, dir) => collection(path, filters, [f, dir], max),
      limit: (n) => collection(path, filters, sort, n),
      get: async () => {
        let rows = [...state]
          .filter(
            ([k]) =>
              k.startsWith(path + "/") &&
              k.slice(path.length + 1).indexOf("/") === -1,
          )
          .map(([k, v]) => ({
            id: k.split("/").at(-1),
            ref: ref(k),
            data: () => structuredClone(v),
          }));
        for (const [f, op, v] of filters)
          rows = rows.filter((d) =>
            op === "in"
              ? v.includes(d.data()[f])
              : op === "<="
                ? d.data()[f] <= v
                : d.data()[f] === v,
          );
        if (sort)
          rows.sort(
            (a, b) =>
              (a.data()[sort[0]] - b.data()[sort[0]]) *
              (sort[1] === "desc" ? -1 : 1),
          );
        return { docs: rows.slice(0, max) };
      },
    };
  }
  return {
    state,
    collection,
    doc: ref,
    runTransaction(fn) {
      const task = tail.then(async () => {
        const writes = [];
        const result = await fn({
          get: (r) => r.get(),
          set: (r, v) => writes.push(() => r.set(v)),
          update: (r, v) => writes.push(() => r.update(v)),
          delete: (r) => writes.push(() => r.delete()),
        });
        for (const w of writes) await w();
        return result;
      });
      tail = task.catch(() => {});
      return task;
    },
  };
}
const input = {
  name: "Novos preços",
  subject: "Assine o Bud Finance",
  title: "Organize seu dinheiro",
  body: "Conheça nossos planos.",
  template: "plans",
  buddy: true,
  segment: { plan: "free" },
};
function setup() {
  let t = Date.parse("2026-11-27T20:00:00Z"),
    mode = "ok",
    price = 29.99;
  const db = database({
    "usuarios/a": { email: "a@example.test", nome: "A", plano: "free" },
    "usuarios/b": { email: "b@example.test", nome: "B", plano: "free" },
    "usuarios/paid": { email: "paid@example.test", plano: "plus" },
    "_gestor_private/owner": { uid: "owner", loginEmail: "owner@example.test" },
  });
  const prefs = createMarketingPreferences({
      db,
      secret: "fictitious-local",
      frontendURL: "https://example.test/appbudfinance",
      now: () => t,
    }),
    sent = [];
  const options = {
    db,
    preferences: prefs,
    now: () => t,
    enabled: true,
    catalog: () => ({ starter: 4.99, pro: 14.99, plus: price }),
    send: async (m) => {
      sent.push(m);
      if (mode === "unknown") throw Error("timeout");
      if (mode === "reject")
        throw Object.assign(Error("400"), { definitelyNotSent: true });
    },
  };
  const service = createMarketing(options);
  return {
    service,
    db,
    prefs,
    sent,
    now: () => t,
    advance: (n) => (t += n),
    mode: (v) => (mode = v),
    price: (v) => (price = v),
    second: () => createMarketing(options),
  };
}
async function draft(s) {
  const r = await s.service.save(null, input, "owner");
  return r.id;
}
async function queue(s, id, scheduledAt) {
  await s.service.test(id, "owner");
  const p = await s.service.preview(id),
    c = await s.service.load(id);
  return s.service.queue(
    id,
    {
      revision: c.revision,
      audienceToken: p.audienceToken,
      scheduledAt,
      confirm: true,
    },
    "owner",
  );
}
test("renderer escapes content, preserves plan identifiers/prices and individual unsubscribe placeholder", () => {
  const c = validateDraft({
      ...input,
      title: "<img src=x onerror=alert(1)>",
      body: "<script>bad</script>",
    }),
    r = renderCampaign(c);
  assert(r.html.includes("&lt;script&gt;"));
  assert(!r.html.includes("<script>"));
  for (const k of ["starter", "pro", "plus"])
    assert(r.html.includes("assinar.html?checkout=" + k));
  assert(r.html.includes("29,99"));
  assert(r.text.includes("{{unsubscribe_url}}"));
  assert.throws(() => validateDraft({ ...input, subject: "A\nB" }));
});
test("expired trial becomes Free; blocked, deleted, consent-negative, missing activity and active trial excluded", () => {
  const now = Date.now(),
    seg = { plan: "free", inactiveDays: 0 };
  assert(
    profileEligible(
      { email: "a@example.test", plano: "trial", trialFim: new Date(now - 1) },
      seg,
      now,
    ),
  );
  for (const p of [
    { bloqueado: true },
    { _deletionPending: true },
    { marketingConsent: false },
    { lgpdConsentimento: false },
    { plano: "trial", trialFim: new Date(now + 10000) },
  ])
    assert(
      !profileEligible(
        { email: "a@example.test", plano: "free", ...p },
        seg,
        now,
      ),
    );
  assert(
    !profileEligible(
      { email: "a@example.test", plano: "free" },
      { ...seg, inactiveDays: 30 },
      now,
    ),
  );
});
test("audience deduplicates addresses, excludes paid/suppressed and handles Firestore Timestamp activity", async () => {
  const s = setup();
  await s.db
    .doc("usuarios/dup")
    .set({ email: "A@example.test", plano: "free" });
  await s.db
    .doc("usuarios/no")
    .set({ email: "no@example.test", plano: "free" });
  const p = await s.prefs.prepare("no@example.test"),
    token = new URLSearchParams(new URL(p.unsubscribeURL).hash.slice(1)).get(
      "token",
    );
  await s.prefs.unsubscribe({ body: { token } }, { setHeader() {}, json() {} });
  const id = await draft(s),
    v = await s.service.preview(id);
  assert.equal(v.count, 2);
});
test("test uses owner only and confirmation requires current successful test plus unchanged audience/revision", async () => {
  const s = setup(),
    id = await draft(s),
    p = await s.service.preview(id);
  await assert.rejects(s.service.test(id, "other"));
  await assert.rejects(
    s.service.queue(
      id,
      { revision: 1, audienceToken: p.audienceToken, confirm: true },
      "owner",
    ),
  );
  await s.service.test(id, "owner");
  assert.equal(s.sent[0].to, "owner@example.test");
  await s.db.doc("usuarios/b").update({ plano: "plus" });
  await assert.rejects(
    s.service.queue(
      id,
      { revision: 1, audienceToken: p.audienceToken, confirm: true },
      "owner",
    ),
  );
  await queue(s, id);
  await assert.rejects(queue(s, id));
});
test("two workers cannot duplicate sends; future schedule waits and frozen roster never adds a new signup", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id, new Date(s.now() + 3600000).toISOString());
  s.sent.length = 0;
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  await s.db
    .doc("usuarios/new")
    .set({ email: "new@example.test", plano: "free" });
  s.advance(3600001);
  await Promise.all([s.service.tick(), s.second().tick()]);
  assert.equal(s.sent.length, 2);
  assert.equal(new Set(s.sent.map((m) => m.to)).size, 2);
  await s.service.tick();
  assert.equal(s.sent.length, 2);
  assert.equal((await s.service.detail(id)).status, "completed");
});
test("plan changes and opt-out after approval are rechecked without sending", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id);
  s.sent.length = 0;
  await s.db.doc("usuarios/a").update({ plano: "plus" });
  const p = await s.prefs.prepare("b@example.test"),
    token = new URLSearchParams(new URL(p.unsubscribeURL).hash.slice(1)).get(
      "token",
    );
  await s.prefs.unsubscribe({ body: { token } }, { setHeader() {}, json() {} });
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  assert.equal((await s.service.detail(id)).counts.skipped, 2);
});
test("pause/resume/cancel preserve pending recipients and never resend accepted messages", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id);
  s.sent.length = 0;
  await s.service.control(id, "pause", "owner");
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  await s.service.control(id, "resume", "owner");
  await s.service.control(id, "cancel", "owner");
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  assert.equal((await s.service.detail(id)).status, "cancelled");
});
test("price/content changes invalidate tests or pause approved campaigns", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id);
  s.sent.length = 0;
  s.price(39.99);
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  assert.equal((await s.service.detail(id)).status, "paused");
  await assert.rejects(s.service.save(id, { ...input, revision: 1 }, "owner"));
});
test("provider uncertainty survives restart without automatic resend; known rejection recorded separately", async () => {
  for (const [mode, state] of [
    ["unknown", "unknown"],
    ["reject", "failed"],
  ]) {
    const s = setup(),
      id = await draft(s);
    await queue(s, id);
    s.sent.length = 0;
    s.mode(mode);
    await s.service.tick();
    await s.second().tick();
    assert.equal(s.sent.length, 2);
    assert.equal((await s.service.detail(id)).counts[state], 2);
  }
});
test("stale in-flight claims become uncertain without sending again", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id);
  s.sent.length = 0;
  const rows = await s.db
    .collection("_gestor_campaigns")
    .doc(id)
    .collection("recipients")
    .get();
  for (const r of rows.docs)
    await r.ref.update({ state: "sending", startedAt: s.now() - 180000 });
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  assert.equal((await s.service.detail(id)).counts.unknown, 2);
});
test("all campaign endpoints require owner middleware; provider disabled blocks any network send", async () => {
  const registered = [],
    guard = [() => {}],
    app = {
      get: (...x) => registered.push(x),
      post: (...x) => registered.push(x),
      patch: (...x) => registered.push(x),
    };
  registerMarketing(app, { service: {}, ownerOnly: guard });
  assert.equal(registered.length, 8);
  assert(registered.every((r) => r[1] === guard));
  let calls = 0;
  const p = createMarketingSender({ env: {}, fetch: async () => calls++ });
  await assert.rejects(p.send({}));
  assert.equal(calls, 0);
  const demo = createMarketingSender({
    simulated: true,
    fetch: async () => calls++,
  });
  await demo.send({});
  assert.equal(calls, 0);
});
module.exports = { database };

test("reopening a scheduled campaign atomically clears pending roster and proof, then requires a new test", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id, new Date(s.now() + 3600000).toISOString());
  s.sent.length = 0;
  await s.service.control(id, "edit", "owner");
  const reopened = await s.service.detail(id);
  assert.equal(reopened.status, "draft");
  assert.equal(reopened.revision, 2);
  assert.equal(reopened.counts.total, 0);
  assert.equal(reopened.testedDigest, null);
  assert.equal(reopened.scheduledAt, null);
  await s.service.save(
    id,
    { ...input, subject: "Novo assunto", revision: 2 },
    "owner",
  );
  const p = await s.service.preview(id);
  await assert.rejects(
    s.service.queue(
      id,
      { revision: 3, audienceToken: p.audienceToken, confirm: true },
      "owner",
    ),
  );
  s.advance(7200000);
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  await queue(s, id);
  s.sent.length = 0;
  await s.service.tick();
  assert.equal(s.sent.length, 2);
  assert(s.sent.every((m) => m.subject === "Novo assunto"));
});
test("editing refuses any started or uncertain recipient without losing its history", async () => {
  for (const state of ["sending", "sent", "unknown", "failed", "skipped"]) {
    const s = setup(),
      id = await draft(s);
    await queue(s, id);
    const rows = await s.db
      .collection("_gestor_campaigns")
      .doc(id)
      .collection("recipients")
      .get();
    await rows.docs[0].ref.update({ state });
    await assert.rejects(s.service.control(id, "edit", "owner"));
    assert.equal((await rows.docs[0].ref.get()).data().state, state);
    assert.equal((await s.service.detail(id)).revision, 1);
  }
});

test("worker holding an old roster cannot send it after editing and approving a new revision", async () => {
  const s = setup(),
    id = await draft(s);
  await queue(s, id);
  s.sent.length = 0;
  const transact = s.db.runTransaction.bind(s.db);
  let once = true;
  s.db.runTransaction = async (fn) => {
    if (once) {
      once = false;
      await s.service.control(id, "edit", "owner");
      const c = await s.service.load(id);
      await s.service.save(
        id,
        { ...input, subject: "Versão nova", revision: c.revision },
        "owner",
      );
      await queue(s, id);
      s.sent.length = 0;
    }
    return transact(fn);
  };
  await s.service.tick();
  assert.equal(s.sent.length, 0);
  await s.service.tick();
  assert.equal(s.sent.length, 2);
  assert(s.sent.every((m) => m.subject === "Versão nova"));
});
