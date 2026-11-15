const { effectivePlan } = require('./plan-policy');

const PAGE_SIZE = 40;
const stages = new Set(['lead', 'quote', 'customer', 'inactive']);
const text = (value, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = value => {
  const result = value?.toDate?.() || (value ? new Date(value) : null);
  return result && Number.isFinite(result.getTime()) ? result.toISOString() : null;
};

function recordPlanChange(tx, ref, previous, patch, at) {
  const from = previous.plano || 'free';
  const to = patch.plano || from;
  const status = patch.assinaturaStatus || '';
  const ended = ['cancelled', 'paused'].includes(status) && status !== previous.assinaturaStatus;
  if (from === to && !ended) return;
  tx.set(ref.collection('_gestor_plan_history').doc(), { from, to, status, at });
}

function financeProfile(data) {
  const plan = effectivePlan(data);
  const subscription = text(data.assinaturaStatus, 40);
  return {
    name: text(data.nome || data.nomeCompleto), email: text(data.email, 254),
    phone: text(data.telefone || data.whatsapp || data.celular, 40),
    createdAt: date(data.dataCadastro || data.criadoEm), plan, subscription,
    stage: data.bloqueado || subscription === 'cancelled' || subscription === 'paused' ? 'inactive' : 'customer',
    scheduledPlan: data.planoTroca?.status === 'scheduled' ? text(data.planoTroca.planKey, 30) : '',
    scheduledAt: date(data.planoTroca?.effectiveAt)
  };
}

function manualProfile(data) {
  const profile = {};
  for (const [field, max] of Object.entries({
    name: 120, company: 120, email: 254, phone: 40, whatsapp: 40, document: 30,
    postalCode: 15, address: 180, city: 100, state: 40, notes: 2000
  })) profile[field] = text(data[field], max);
  profile.stage = text(data.stage, 20);
  profile.product = text(data.product, 40);
  return profile;
}

function registerGestorClients(app, { db, ownerOnly, auth, limit, clientSupport }) {
  const sources = { finance: 'usuarios', manual: '_gestor_clients' };
  const sourceRef = source => db.collection(sources[source]);
  const isId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const knownSource = source => typeof source === 'string' && Object.hasOwn(sources, source);

  app.get('/api/gestor/clients', ownerOnly, async (req, res) => {
    const source = req.query.source;
    const cursor = req.query.cursor;
    if (!knownSource(source) || (cursor && !isId(cursor))) return res.sendStatus(400);
    try {
      let query = sourceRef(source).orderBy('__name__');
      if (cursor) query = query.startAfter(cursor);
      const { docs } = await query.limit(PAGE_SIZE + 1).get();
      const page = docs.slice(0, PAGE_SIZE);
      const clients = page.flatMap(snapshot => {
        const data = snapshot.data();
        if (source === 'finance' && data._deletionPending) return [];
        const profile = source === 'finance' ? financeProfile(data) : {
          name: text(data.name), company: text(data.company), email: text(data.email, 254),
          phone: text(data.phone || data.whatsapp, 40), stage: text(data.stage, 20),
          product: text(data.product, 40), createdAt: date(data.createdAt)
        };
        return [{ ...profile, id: snapshot.id, source }];
      });
      return res.json({ clients, next: docs.length > PAGE_SIZE ? page.at(-1).id : null });
    } catch { return res.status(503).json({ error: 'Não foi possível carregar os clientes.' }); }
  });

  app.get('/api/gestor/clients/:source/:id', ownerOnly, async (req, res) => {
    const { source, id } = req.params;
    if (!knownSource(source) || !isId(id)) return res.sendStatus(400);
    try {
      const ref = sourceRef(source).doc(id);
      const data = (await ref.get()).data();
      if (!data || data._deletionPending) return res.sendStatus(404);
      if (source === 'manual') return res.json({ ...manualProfile(data), createdAt: date(data.createdAt) });
      const [recent, legacy] = await Promise.all([
        ref.collection('_gestor_plan_history').orderBy('at', 'desc').limit(50).get(),
        db.collection('plano_historico').where('uid', '==', id).get()
      ]);
      const history = recent.docs.map(snapshot => {
        const entry = snapshot.data();
        return { from: text(entry.from, 30), to: text(entry.to, 30), status: text(entry.status, 30), at: date(entry.at) };
      });
      for (const snapshot of legacy.docs) {
        const entry = snapshot.data();
        history.push({ from: text(entry.oldPlan, 30), to: text(entry.newPlan, 30), at: date(entry.alteredAt) });
      }
      const cancelledAt = date(data.canceladoEm || (data.assinaturaStatus === 'cancelled' ? data.planoAtualizadoEm : null));
      if (cancelledAt && !history.some(entry => entry.status === 'cancelled' && entry.at === cancelledAt)) {
        history.push({ to: 'free', status: 'cancelled', at: cancelledAt });
      }
      history.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      const profile = financeProfile(data);
      if (!clientSupport) return res.json({ ...profile, history: history.slice(0, 50) });
      const [notes, user] = await Promise.all([
        ref.collection('_gestor_support_notes').orderBy('at', 'desc').limit(30).get(),
        auth.getUser(id).catch(error => {
          if (error.code === 'auth/user-not-found') return null;
          throw error;
        })
      ]);
      return res.json({ ...profile, history: history.slice(0, 50), support: {
        emailVerified: user ? user.emailVerified : null,
        canEmail: Boolean(user?.email && !user.disabled && !data.bloqueado),
        hasSubscription: Boolean(data.mpSubscriptionId),
        notes: notes.docs.map(note => ({ text: note.data().text, at: date(note.data().at) }))
      } });
    } catch { return res.status(503).json({ error: 'Não foi possível abrir a ficha.' }); }
  });

  if (clientSupport) {
    app.post('/api/gestor/clients/finance/:id/support', ownerOnly, async (req, res) => {
      const { id } = req.params;
      const { action, note } = req.body || {};
      if (!isId(id) || !['note', 'verify-email', 'reset-password', 'subscription'].includes(action)) return res.sendStatus(400);
      if (limit('gestor:support:' + action + ':owner:' + req.gestorOwner) ||
          action !== 'note' && limit('gestor:support:' + action + ':' + id)) {
        return res.status(429).json({ error: 'Aguarde antes de repetir a ação.' });
      }
      try {
        const ref = sourceRef('finance').doc(id);
        const data = (await ref.get()).data();
        if (!data || data._deletionPending) return res.sendStatus(404);
        if (action === 'note') {
          const content = typeof note === 'string' ? note.trim() : '';
          if (!content || content.length > 2000) return res.status(400).json({ error: 'Informe uma nota de até 2.000 caracteres.' });
          const at = new Date();
          const noteRef = ref.collection('_gestor_support_notes').doc();
          const saved = await db.runTransaction(async tx => {
            const current = await tx.get(ref);
            if (!current.exists || current.data()._deletionPending) return false;
            tx.create(noteRef, { text: content, at, authorUid: req.gestorOwner });
            return true;
          });
          if (!saved) return res.sendStatus(404);
          return res.status(201).json({ note: { text: content, at: at.toISOString() } });
        }
        if (action === 'subscription') {
          if (!data.mpSubscriptionId) return res.status(409).json({ error: 'Este cliente não tem assinatura vinculada.' });
          return res.json(await clientSupport.subscription(data.mpSubscriptionId));
        }
        const user = await auth.getUser(id);
        if (!user.email || user.disabled || data.bloqueado || (action === 'verify-email' && user.emailVerified)) {
          return res.status(409).json({ error: 'Este envio não está disponível para a conta.' });
        }
        await clientSupport.sendAccessEmail(user, action);
        return res.json({ ok: true });
      } catch {
        return res.status(503).json({ error: 'Não foi possível concluir a ação de atendimento.' });
      }
    });
  }

  async function saveManual(req, res) {
    const id = req.params.id;
    const profile = manualProfile(req.body || {});
    if ((id && !isId(id)) || profile.name.length < 2 || !stages.has(profile.stage) ||
        !['', 'finance'].includes(profile.product) ||
        (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))) {
      return res.status(400).json({ error: 'Confira o nome, a etapa, o produto e o e-mail.' });
    }
    try {
      const collection = sourceRef('manual');
      const ref = id ? collection.doc(id) : collection.doc();
      const updatedAt = new Date();
      if (id) {
        if (!(await ref.get()).exists) return res.sendStatus(404);
        await ref.update({ ...profile, updatedAt });
      } else {
        await ref.create({ ...profile, updatedAt, createdAt: updatedAt });
      }
      return res.status(id ? 200 : 201).json({ id: ref.id });
    } catch { return res.status(503).json({ error: 'Não foi possível salvar o cadastro.' }); }
  }

  app.post('/api/gestor/clients/manual', ownerOnly, saveManual);
  app.patch('/api/gestor/clients/manual/:id', ownerOnly, saveManual);
}

module.exports = { registerGestorClients, recordPlanChange };
