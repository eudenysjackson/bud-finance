'use strict';
const crypto = require('node:crypto');
const COPY = {
  signup: ['Novo cadastro no Bud Finance', 'Uma nova conta foi cadastrada. Consulte o painel administrativo.'],
  subscribed: ['Nova assinatura confirmada', 'Um cliente assinou o plano'],
  cancelled: ['Assinatura cancelada', 'Um cliente cancelou o plano']
};
const PLAN = { starter: 'Starter', pro: 'Pro', plus: 'Plus' };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function cancellationEvent(profile, nextStatus) {
  return ['cancelled', 'canceled'].includes(nextStatus) &&
    ['authorized', 'active', 'past_due'].includes(profile.assinaturaStatus) &&
    ['starter', 'pro', 'plus'].includes(profile.plano) && profile.mpCheckout?.state !== 'pending';
}
function createOwnerNotifications({ db, auth, messaging, ownerUid = '', ownerEmail = '', frontendUrl, now = Date.now }) {
  // UID is configured on the server, never obtained from a customer request.
  async function prepare(tx, uid, type, identity, plan) {
    if ((!ownerUid && !ownerEmail) || !db) return null;
    if (!COPY[type] || !uid || !identity) throw Error('Invalid owner event');
    const ref = db.collection('usuarios').doc(uid).collection('_owner_events').doc(hash(type + ':' + identity));
    if ((await tx.get(ref)).exists) return null;
    return { ref, data: { type, plan: PLAN[plan] ? plan : null, state: 'pending', createdAt: now(), nextAt: now(), attempts: 0 } };
  }
  function commit(tx, event) { if (event) tx.set(event.ref, event.data); }
  async function deliver(ref) {
    const lease = crypto.randomUUID();
    const event = await db.runTransaction(async tx => {
      const snap = await tx.get(ref), data = snap.data();
      if (!data || data.state !== 'pending' || data.nextAt > now()) return null;
      if (data.createdAt < now() - 7 * 86400000) { tx.update(ref, { state: 'expired' }); return null; }
      tx.update(ref, { lease, nextAt: now() + 120000, attempts: data.attempts + 1 });
      return data;
    });
    if (!event) return;
    let patch = {};
    try {
      const identity = ownerUid ? await auth.getUser(ownerUid) : await auth.getUserByEmail(ownerEmail);
      const targetUid = ownerUid || identity.uid;
      const [role, devices, deleting] = await Promise.all([
        db.collection('admins').doc(targetUid).get(), db.collection('_gestor_devices').doc(targetUid).get(),
        db.collection('_account_deletions').doc(targetUid).get()
      ]);
      const data = devices.data() || {};
      if (!role.exists || role.data().role !== 'admin' || deleting.exists || identity.disabled || !identity.emailVerified) throw Error('Owner unavailable');
      const delivered = new Set(event.delivered || []);
      const tokens = [...new Set(Object.values(data.tokens || {}).map(device => device.token).filter(t => typeof t === 'string' && t))].slice(0, 20);
      if (!tokens.length) throw Error('No owner device');
      const remaining = tokens.filter(t => !delivered.has(hash(t)));
      if (remaining.length) {
        const [title, text] = COPY[event.type];
        const body = event.type === 'signup' ? text : text + ' ' + (PLAN[event.plan] || 'pago') + '. Consulte o painel administrativo.';
        const response = await messaging().sendEachForMulticast({ tokens: remaining,
          data: { title, body, url: new URL('/budgestor/', frontendUrl).href, tag: 'owner-' + ref.id, emoji: '🔔' },
          webpush: { headers: { TTL: '3600' }, fcmOptions: { link: new URL('/budgestor/', frontendUrl).href } }
        });
        response.responses.forEach((r, i) => {
          if (r.success || ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) delivered.add(hash(remaining[i]));
        });
      }
      patch = { delivered: [...delivered], ...(tokens.every(t => delivered.has(hash(t))) ? { state: 'sent', completedAt: now() } : {}) };
    } catch (_) { /* no client identities, tokens or provider error payloads in logs */ }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(ref);
      if (fresh.exists && fresh.data().lease === lease) tx.update(ref, { ...patch, nextAt: now() + Math.min(3600000, 60000 * 2 ** Math.min(event.attempts, 6)), lease: null });
    });
  }
  async function drain() {
    if ((!ownerUid && !ownerEmail) || !db) return;
    const pending = await db.collectionGroup('_owner_events').where('state', '==', 'pending').where('nextAt', '<=', now()).orderBy('nextAt').limit(25).get();
    for (const item of pending.docs) await deliver(item.ref);
  }
  return { prepare, commit, drain, deliver };
}
module.exports = { createOwnerNotifications, cancellationEvent };
