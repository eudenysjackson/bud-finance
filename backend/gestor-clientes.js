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

function registerGestorClients(app, { db, ownerOnly }) {
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
      return res.json({ ...financeProfile(data), history: history.slice(0, 50) });
    } catch { return res.status(503).json({ error: 'Não foi possível abrir a ficha.' }); }
  });

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
