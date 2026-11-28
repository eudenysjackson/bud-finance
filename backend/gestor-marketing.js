"use strict";
const { createHash, randomUUID } = require("node:crypto");
const { effectivePlan } = require("./plan-policy");
const clean = (v, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const hash = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const time = (v) =>
  v?.toMillis?.() ?? (typeof v === "number" ? v : Date.parse(v || ""));
const email = (v) => clean(v, 254).toLowerCase();
const validEmail = (v) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(v);
const plans = {
  free: "Gratuito",
  trial: "Teste Pro",
  starter: "Starter",
  pro: "Plus",
  plus: "Pro",
};
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
function validateDraft(input) {
  const c = {
    name: clean(input.name, 100),
    subject: clean(input.subject, 140),
    title: clean(input.title, 140),
    body: clean(input.body, 3000),
    button: clean(input.button, 60) || "Conheça o Bud Finance",
    template: input.template === "plans" ? "plans" : "news",
    buddy: input.buddy !== false,
    segment: {
      product: "finance",
      plan: clean(input.segment?.plan, 20) || "free",
      inactiveDays: Number(input.segment?.inactiveDays) || 0,
      registeredAfter: clean(input.segment?.registeredAfter, 10),
    },
  };
  if (!c.name || !c.subject || !c.title || !c.body || /[\r\n]/.test(c.subject))
    throw fail("Preencha nome, assunto, título e mensagem.");
  if (!Object.hasOwn(plans, c.segment.plan) && c.segment.plan !== "all")
    throw fail("Público inválido.");
  if (![0, 7, 15, 30, 60, 90].includes(c.segment.inactiveDays))
    throw fail("Período de inatividade inválido.");
  if (
    c.segment.registeredAfter &&
    !/^\d{4}-\d{2}-\d{2}$/.test(c.segment.registeredAfter)
  )
    throw fail("Data de cadastro inválida.");
  return c;
}
function profileEligible(p, segment, now) {
  if (
    !p ||
    p._deletionPending ||
    p.bloqueado ||
    p.lgpdConsentimento === false ||
    p.marketingConsent === false ||
    p.marketingOptOut === true ||
    !validEmail(email(p.email))
  )
    return false;
  if (segment.plan !== "all" && effectivePlan(p, now) !== segment.plan)
    return false;
  const registered = time(p.dataCadastro || p.criadoEm),
    last = time(
      p.ultimoAcesso || p.lastLoginAt || p.ultimoLogin || p.ultimaAtividade,
    );
  if (
    segment.registeredAfter &&
    (!Number.isFinite(registered) ||
      registered < Date.parse(segment.registeredAfter + "T00:00:00-03:00"))
  )
    return false;
  if (
    segment.inactiveDays &&
    (!Number.isFinite(last) || last > now - segment.inactiveDays * 86400000)
  )
    return false;
  return true;
}
function renderCampaign(
  c,
  {
    origin = "https://budsolucoes.com.br",
    catalog = { starter: 4.99, pro: 14.99, plus: 29.99 },
    preview = false,
  } = {},
) {
  const site = new URL(origin);
  if (
    site.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(site.hostname)
  )
    throw fail("Origem inválida.");
  const url = site.origin,
    front = url + "/appbudfinance",
    money = (v) =>
      Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const perks = {
    starter: "1 conta · 1 cartão · 10 lançamentos/mês. Sem importações e IA.",
    pro: "2 contas · 2 cartões · 15 lançamentos/mês. 5 importações e 5 usos de IA/mês.",
    plus: "Contas, cartões e lançamentos ilimitados. Importações e IA sem cotas do plano.",
  };
  const cards =
    c.template === "plans"
      ? ["starter", "pro", "plus"]
          .map(
            (k) =>
              `<a href="${front}/assinar.html?checkout=${k}" style="display:block;padding:22px;margin:12px 0;border:1px solid #c7ddf5;border-radius:16px;background:${k === "pro" ? "#effbf6" : "#f3f7ff"};color:#102039;text-decoration:none"><strong style="font-size:24px">${plans[k]}</strong><br><b style="font-size:30px;color:#1755ee">${money(catalog[k])}</b> /mês<p>${perks[k]}</p><b>Assinar ${plans[k]} →</b></a>`,
          )
          .join("")
      : `<a href="${front}/" style="display:inline-block;background:#215af2;color:white;padding:16px 24px;border-radius:12px;text-decoration:none">${escape(c.button)}</a>`;
  const unsubscribe = preview ? "#previa" : "{{unsubscribe_url}}";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf3fb;font:15px/1.65 Arial,sans-serif;color:#102039"><table role="presentation" width="100%"><tr><td align="center" style="padding:20px 10px"><table role="presentation" width="600" style="width:100%;max-width:600px;background:white;border-radius:24px"><tr><td style="padding:28px"><img src="${front}/icons/bud-selo-192.png" width="56" alt="Bud Soluções"><b style="font-size:22px"> Bud <span style="color:#1755ee">Finance</span></b><h1 style="font-size:32px;line-height:1.15">${escape(c.title)}</h1>${c.buddy ? `<img src="${url}/budgestor/assets/buddy-email.png" alt="Buddy" width="130" style="display:block;margin:18px auto;background:white">` : ""}<p>${escape(c.body).replace(/\n/g, "<br>")}</p>${cards}<p style="font-size:12px;color:#637591">A assinatura tem renovação mensal. Você pode continuar usando o plano Gratuito se preferir.</p><hr style="border:0;border-top:1px solid #e4edf7"><p style="font-size:12px"><b>Bud Soluções · Bud Finance</b><br><a href="https://wa.me/5521983554954">Fale com a Bud</a> · <a href="${front}/politica-privacidade.html">Política de privacidade</a><br><a href="${unsubscribe}">Descadastrar dos e-mails promocionais</a></p></td></tr></table></td></tr></table></body></html>`;
  const text =
    `${c.title}\n\n${c.body}\n\n` +
    (c.template === "plans"
      ? ["starter", "pro", "plus"]
          .map(
            (k) =>
              `${plans[k]} ${money(catalog[k])}/mês. ${perks[k]} ${front}/assinar.html?checkout=${k}`,
          )
          .join("\n")
      : `${c.button}: ${front}/`) +
    `\nA assinatura tem renovação mensal. Você pode continuar usando o plano Gratuito se preferir.\nWhatsApp: https://wa.me/5521983554954\nDescadastrar: ${unsubscribe}`;
  return { html, text };
}
function createMarketing({
  db,
  preferences,
  send,
  enabled = false,
  simulated = false,
  catalog = () => ({ starter: 4.99, pro: 14.99, plus: 29.99 }),
  now = Date.now,
  origin = "https://budsolucoes.com.br",
}) {
  const campaigns = db.collection("_gestor_campaigns");
  const ref = (id) => {
    if (!/^[\w-]{1,100}$/.test(id || "")) throw fail("Campanha inválida.");
    return campaigns.doc(id);
  };
  const load = async (id) => {
    const s = await ref(id).get();
    if (!s.exists) throw fail("Campanha não encontrada.", 404);
    return s.data();
  };
  const digest = (c) => hash({ draft: c.draft, catalog: catalog() });
  async function list() {
    const s = await campaigns.orderBy("updatedAt", "desc").limit(60).get();
    return {
      campaigns: s.docs.map((d) => ({ id: d.id, ...d.data() })),
      enabled,
      simulated,
    };
  }
  async function save(id, input, actor) {
    const draft = validateDraft(input),
      r = id ? ref(id) : campaigns.doc();
    await db.runTransaction(async (tx) => {
      const s = await tx.get(r),
        old = s.data();
      if (s.exists && old.status !== "draft")
        throw fail("Duplique esta campanha para alterar o conteúdo.", 409);
      if (s.exists && input.revision !== old.revision)
        throw fail("A campanha mudou. Reabra antes de salvar.", 409);
      tx.set(r, {
        draft,
        status: "draft",
        revision: (old?.revision || 0) + 1,
        createdAt: old?.createdAt || now(),
        updatedAt: now(),
        createdBy: old?.createdBy || actor,
        updatedBy: actor,
        testedDigest: null,
        testedAt: null,
        counts: {},
      });
    });
    return { id: r.id, campaign: await load(r.id) };
  }
  async function audience(c) {
    const result = await db.collection("usuarios").limit(1001).get();
    if (result.docs.length > 1000)
      throw fail(
        "Público acima do limite inicial. Refine o segmento antes de enviar.",
        409,
      );
    const candidates = [],
      seen = new Set();
    let excluded = 0;
    for (const d of result.docs) {
      const p = d.data(),
        address = email(p.email);
      if (!profileEligible(p, c.draft.segment, now()) || seen.has(address)) {
        excluded++;
        continue;
      }
      const preference = await preferences.prepare(address);
      if (!preference.allowed) {
        excluded++;
        continue;
      }
      seen.add(address);
      candidates.push({ uid: d.id, email: address, name: clean(p.nome, 120) });
    }
    if (candidates.length > 250)
      throw fail(
        "A primeira versão permite até250 destinatários por campanha.",
        409,
      );
    return {
      candidates,
      excluded,
      token: hash({
        digest: digest(c),
        recipients: candidates.map((p) => [p.uid, p.email]).sort(),
      }),
    };
  }
  async function preview(id) {
    const c = await load(id),
      a = await audience(c);
    return {
      ...renderCampaign(c.draft, { origin, catalog: catalog(), preview: true }),
      count: a.candidates.length,
      excluded: a.excluded,
      audienceToken: a.token,
      sample: a.candidates
        .slice(0, 8)
        .map((p) => ({ name: p.name, email: p.email })),
      digest: digest(c),
    };
  }
  async function test(id, actor) {
    if (!enabled)
      throw fail("Configure o envio de marketing antes de testar.", 503);
    const c = await load(id);
    if (c.status !== "draft")
      throw fail("Teste disponível somente em rascunho.", 409);
    const owner = (await db.doc("_gestor_private/owner").get()).data();
    if (owner?.uid !== actor) throw fail("Administrador indisponível.", 403);
    const address = email(owner.loginEmail || owner.recoveryEmail);
    if (!validEmail(address))
      throw fail("Confira o e-mail do administrador.", 409);
    const content = await preferences.render(
      address,
      renderCampaign(c.draft, { origin, catalog: catalog() }),
    );
    if (!content.allowed)
      throw fail("O e-mail do administrador está descadastrado.", 409);
    const expected = digest(c);
    await send({
      to: address,
      subject: "[TESTE] " + c.draft.subject,
      ...content,
    });
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref(id));
      if (s.data()?.revision !== c.revision || s.data()?.status !== "draft")
        return;
      tx.update(ref(id), {
        testedDigest: expected,
        testedAt: now(),
        updatedAt: now(),
      });
    });
    return { ok: true, simulated };
  }
  async function queue(
    id,
    { revision, audienceToken, scheduledAt, confirm },
    actor,
  ) {
    if (!enabled) throw fail("Envio ainda não configurado.", 503);
    if (confirm !== true) throw fail("Confirme o público e o envio.");
    const c = await load(id),
      a = await audience(c),
      at = scheduledAt ? Date.parse(scheduledAt) : now();
    if (
      !Number.isFinite(at) ||
      at < now() - 60000 ||
      at > now() + 366 * 86400000
    )
      throw fail("Data de envio inválida.");
    if (!a.candidates.length) throw fail("Nenhum destinatário elegível.", 409);
    if (audienceToken !== a.token)
      throw fail(
        "O público mudou. Atualize a prévia e confirme novamente.",
        409,
      );
    const stamp = digest(c);
    if (c.testedDigest !== stamp)
      throw fail("Envie um teste desta versão antes de confirmar.", 409);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref(id)),
        fresh = s.data();
      if (
        fresh?.status !== "draft" ||
        fresh.revision !== revision ||
        fresh.testedDigest !== stamp
      )
        throw fail("A campanha mudou ou já foi agendada.", 409);
      tx.update(ref(id), {
        status: "queued",
        scheduledAt: at,
        approvedDigest: stamp,
        approvedBy: actor,
        approvedAt: now(),
        updatedAt: now(),
        counts: { total: a.candidates.length },
      });
      for (const p of a.candidates)
        tx.set(ref(id).collection("recipients").doc(hash(p.email)), {
          ...p,
          state: "pending",
          updatedAt: now(),
        });
    });
    return { ok: true, count: a.candidates.length, scheduledAt: at, simulated };
  }
  async function control(id, action, actor) {
    if (action === "edit") {
      const r = ref(id);
      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(r),
          c = snapshot.data();
        if (!c || !["queued", "paused", "cancelled"].includes(c.status))
          throw fail("Crie uma nova versão para editar esta campanha.", 409);
        const roster = await tx.get(r.collection("recipients"));
        if (roster.docs.some((d) => d.data().state !== "pending"))
          throw fail(
            "O envio já começou. Crie uma nova versão para preservar o histórico.",
            409,
          );
        for (const d of roster.docs) tx.delete(d.ref);
        tx.update(r, {
          status: "draft",
          revision: c.revision + 1,
          testedDigest: null,
          testedAt: null,
          approvedDigest: null,
          approvedBy: null,
          approvedAt: null,
          scheduledAt: null,
          counts: {},
          lastError: null,
          updatedAt: now(),
          updatedBy: actor,
          lastEdit: {
            at: now(),
            by: actor,
            previousStatus: c.status,
            previousSchedule: c.scheduledAt || null,
            removedPending: roster.docs.length,
          },
        });
      });
      return { ok: true };
    }
    if (!["pause", "resume", "cancel"].includes(action))
      throw fail("Ação inválida.");
    await db.runTransaction(async (tx) => {
      const r = ref(id),
        s = await tx.get(r),
        c = s.data();
      if (!c) throw fail("Campanha inexistente.", 404);
      const allowed = {
        pause: ["queued", "sending"],
        resume: ["paused"],
        cancel: ["queued", "sending", "paused"],
      };
      if (!allowed[action].includes(c.status))
        throw fail("A campanha mudou. Recarregue.", 409);
      tx.update(r, {
        status: { pause: "paused", resume: "queued", cancel: "cancelled" }[
          action
        ],
        updatedAt: now(),
        updatedBy: actor,
      });
    });
    return { ok: true };
  }
  async function detail(id) {
    const c = await load(id),
      rows = await ref(id).collection("recipients").get(),
      counts = {
        total: rows.docs.length,
        pending: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        unknown: 0,
        skipped: 0,
      };
    for (const d of rows.docs)
      counts[d.data().state] = (counts[d.data().state] || 0) + 1;
    return {
      id,
      ...c,
      counts,
      recipients: rows.docs.map((d) => {
        const { email, name, state, reason, updatedAt } = d.data();
        return { email, name, state, reason, updatedAt };
      }),
    };
  }
  let ticking = false;
  async function tick() {
    if (!enabled || ticking) return;
    ticking = true;
    try {
      const all = await campaigns
        .where("status", "in", ["queued", "sending"])
        .where("scheduledAt", "<=", now())
        .orderBy("scheduledAt")
        .limit(20)
        .get();
      for (const d of all.docs) {
        let c = await load(d.id);
        if (c.scheduledAt > now()) continue;
        if (c.approvedDigest !== digest(c)) {
          await ref(d.id).update({
            status: "paused",
            lastError:
              "Conteúdo ou preços mudaram. Duplique e teste novamente.",
            updatedAt: now(),
          });
          continue;
        }
        const rows = await ref(d.id)
          .collection("recipients")
          .where("state", "in", ["pending", "sending"])
          .limit(10)
          .get();
        for (const item of rows.docs) {
          const recipient = item.data(),
            r = item.ref;
          const claimed = await db.runTransaction(async (tx) => {
            const [cs, rs] = await Promise.all([tx.get(ref(d.id)), tx.get(r)]),
              state = rs.data();
            if (
              !["queued", "sending"].includes(cs.data()?.status) ||
              cs.data()?.revision !== c.revision ||
              cs.data()?.approvedDigest !== c.approvedDigest
            )
              return false;
            if (state?.state === "sending") {
              if (state.startedAt < now() - 120000)
                tx.update(r, {
                  state: "unknown",
                  reason:
                    "Envio sem confirmação. Conferir no provedor antes de qualquer reenvio.",
                  updatedAt: now(),
                });
              return false;
            }
            if (state?.state !== "pending") return false;
            tx.update(r, {
              state: "sending",
              startedAt: now(),
              updatedAt: now(),
            });
            tx.update(ref(d.id), { status: "sending", updatedAt: now() });
            return true;
          });
          if (!claimed) continue;
          try {
            const p = (
              await db.collection("usuarios").doc(recipient.uid).get()
            ).data();
            const state = await load(d.id);
            if (state.approvedDigest !== digest(state)) {
              await ref(d.id).update({
                status: "paused",
                lastError: "Preços alterados. Duplique e teste novamente.",
                updatedAt: now(),
              });
              await r.update({ state: "pending", updatedAt: now() });
              continue;
            }
            if (!["queued", "sending"].includes(state.status)) {
              await r.update({ state: "pending", updatedAt: now() });
              continue;
            }
            if (
              !profileEligible(p, c.draft.segment, now()) ||
              email(p.email) !== recipient.email
            ) {
              await r.update({
                state: "skipped",
                reason: "Cadastro ou plano alterado.",
                updatedAt: now(),
              });
              continue;
            }
            const content = await preferences.render(
              recipient.email,
              renderCampaign(c.draft, { origin, catalog: catalog() }),
            );
            if (!content.allowed) {
              await r.update({
                state: "skipped",
                reason: "Descadastrado.",
                updatedAt: now(),
              });
              continue;
            }
            // Persist claim before network. Never automatically retry an uncertain delivery.
            await send({
              to: recipient.email,
              subject: c.draft.subject,
              ...content,
            });
            await r.update({
              state: "sent",
              reason: simulated ? "Envio simulado" : "Aceito pelo provedor",
              updatedAt: now(),
            });
          } catch (error) {
            await r.update({
              state: error.definitelyNotSent ? "failed" : "unknown",
              reason: error.definitelyNotSent
                ? "Provedor recusou."
                : "Sem confirmação; conferir no provedor.",
              updatedAt: now(),
            });
          }
        }
        const summary = await detail(d.id);
        if (
          !summary.counts.pending &&
          !summary.counts.sending &&
          ["queued", "sending"].includes(summary.status)
        )
          await ref(d.id).update({
            status:
              summary.counts.unknown || summary.counts.failed
                ? "attention"
                : "completed",
            counts: summary.counts,
            updatedAt: now(),
          });
      }
    } finally {
      ticking = false;
    }
  }
  return { list, save, preview, test, queue, control, detail, tick, load };
}
function registerMarketing(app, { service, ownerOnly, limit = () => false }) {
  const route = (method, path, fn) =>
    app[method]("/api/gestor/marketing" + path, ownerOnly, async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        if (
          (path.endsWith("/test") || path.endsWith("/queue")) &&
          limit(
            "gestor:marketing:" +
              req.gestorOwner +
              ":" +
              path +
              ":" +
              req.params?.id,
          )
        )
          return res.status(429).json({ error: "Aguarde antes de repetir." });
        res.json(await fn(req));
      } catch (e) {
        res.status(e.status || 503).json({
          error: e.status
            ? e.message
            : "Não foi possível concluir. Tente novamente.",
        });
      }
    });
  route("get", "", () => service.list());
  route("post", "", (r) => service.save(null, r.body, r.gestorOwner));
  route("patch", "/:id", (r) =>
    service.save(r.params.id, r.body, r.gestorOwner),
  );
  route("get", "/:id", (r) => service.detail(r.params.id));
  route("get", "/:id/preview", (r) => service.preview(r.params.id));
  route("post", "/:id/test", (r) => service.test(r.params.id, r.gestorOwner));
  route("post", "/:id/queue", (r) =>
    service.queue(r.params.id, r.body, r.gestorOwner),
  );
  route("post", "/:id/control", (r) =>
    service.control(r.params.id, r.body.action, r.gestorOwner),
  );
}
module.exports = {
  createMarketing,
  registerMarketing,
  validateDraft,
  profileEligible,
  renderCampaign,
};
