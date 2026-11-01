const { randomUUID } = require('node:crypto');
const CHUNK_BYTES = 450_000;
const ACTIVE_MS = 2 * 60 * 60_000;
const RESULT_MS = 30 * 60_000;

function createFirestoreJobStore(db, { now = Date.now, leaseMs = 15000, maxDurationMs = 180_000 } = {}) {
  const owner = randomUUID();
  const ref = (uid, id) => db.collection('usuarios').doc(uid).collection('_ai_jobs').doc(id);
  const slotsRef = uid => db.collection('usuarios').doc(uid).collection('_seguranca').doc('ia-jobs');
  async function chunks(jobRef, prefix, value, expiresAt) {
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    const count = Math.ceil(bytes.length / CHUNK_BYTES);
    for (let start = 0; start < count; start += 8) {
      const batch = db.batch();
      for (let i = start; i < Math.min(count, start + 8); i++) batch.set(jobRef.collection('_ai_job_chunks').doc(prefix + i), {
        bytes: bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES), expiresAt
      });
      await batch.commit();
    }
    return count;
  }
  async function load(jobRef, prefix, count) {
    const documents = await Promise.all(Array.from({ length: count }, (_, i) => jobRef.collection('_ai_job_chunks').doc(prefix + i).get()));
    if (documents.some(doc => !doc.exists)) throw new Error('Leitura temporária indisponível. Reenvie o documento.');
    return JSON.parse(Buffer.concat(documents.map(doc => doc.data().bytes)).toString('utf8'));
  }
  async function release(uid, id) {
    await db.runTransaction(async tx => {
      const target = slotsRef(uid), snap = await tx.get(target);
      const active = { ...(snap.exists ? snap.data().active : {}) };
      delete active[id];tx.set(target, { active });
    });
  }
  async function prune(uid) {
    const expired = await db.collection('usuarios').doc(uid).collection('_ai_jobs').where('expiresAt', '<=', now()).limit(10).get();
    for (const doc of expired.docs) { await db.recursiveDelete(doc.ref);await release(uid, doc.id); }
  }
  async function create(uid, id, route, payload) {
    await prune(uid);
    const jobRef = ref(uid, id), expiresAt = now() + ACTIVE_MS;
    await db.runTransaction(async tx => {
      const target = slotsRef(uid), snap = await tx.get(target);
      const active = Object.fromEntries(Object.entries(snap.exists ? snap.data().active || {} : {}).filter(([, expiry]) => expiry > now()));
      if (Object.keys(active).length >= 2) throw Object.assign(new Error('Já há duas leituras em andamento. Aguarde a conclusão.'), { status: 409 });
      active[id] = expiresAt;tx.set(target, { active });
      tx.create(jobRef, { uid, route, state: 'staging', message: 'Preparando leitura...', createdAt: now(), expiresAt });
    });
    try {
      const payloadChunks = await chunks(jobRef, 'input-', payload, expiresAt);
      await jobRef.update({ payloadChunks, state: 'queued' });
    } catch (error) {
      await db.recursiveDelete(jobRef).catch(() => {});await release(uid, id).catch(() => {});throw error;
    }
  }
  async function read(uid, id) {
    const doc = await ref(uid, id).get();
    if (!doc.exists) return null;
    let data = doc.data();
    if (data.expiresAt <= now()) { await db.recursiveDelete(doc.ref);await release(uid, id);return null; }
    if (!['completed', 'failed'].includes(data.state) && now() - data.createdAt >= maxDurationMs) {
      await db.runTransaction(async tx => {
        const [fresh, slots] = await Promise.all([tx.get(doc.ref), tx.get(slotsRef(uid))]);
        if (!fresh.exists) return;
        data = fresh.data();
        if (['completed', 'failed'].includes(data.state)) return;
        const active = { ...(slots.exists ? slots.data().active || {} : {}) };delete active[id];
        data = { ...data, state: 'failed', status: 504, finishedAt: now(), expiresAt: now() + RESULT_MS,
          terminalResult: { error: 'A leitura excedeu o tempo disponível e foi encerrada. Tente novamente.', code: 'AI_JOB_TIMEOUT' } };
        tx.update(doc.ref, data);tx.set(slotsRef(uid), { active });
      });
    }
    if (['completed', 'failed'].includes(data.state)) await release(uid, id);
    return data;
  }
  async function claim(uid, id) {
    return db.runTransaction(async tx => {
      const target = ref(uid, id), snap = await tx.get(target);
      if (!snap.exists) return null;
      const data = snap.data();
      if (data.expiresAt <= now() || !['queued', 'running'].includes(data.state) || (data.state === 'running' && data.leaseUntil > now())) return null;
      tx.update(target, { state: 'running', owner, leaseUntil: now() + leaseMs });
      return { ...data, owner };
    });
  }
  async function heartbeat(uid, id, message) {
    return db.runTransaction(async tx => {
      const target = ref(uid, id), snap = await tx.get(target);
      if (!snap.exists || snap.data().owner !== owner || snap.data().state !== 'running') return false;
      tx.update(target, { leaseUntil: now() + leaseMs, message });return true;
    });
  }
  async function finish(uid, id, job) {
    const target = ref(uid, id), prefix = 'result-' + owner + '-', expiresAt = now() + RESULT_MS;
    const resultChunks = await chunks(target, prefix, job.result, expiresAt);
    const committed = await db.runTransaction(async tx => {
      const [snap, slots] = await Promise.all([tx.get(target), tx.get(slotsRef(uid))]);
      if (!snap.exists || snap.data().owner !== owner || snap.data().state !== 'running') return false;
      const active = { ...(slots.exists ? slots.data().active || {} : {}) };delete active[id];
      tx.set(slotsRef(uid), { active });
      tx.update(target, { state: job.state, status: job.status, message: job.message, finishedAt: now(), expiresAt,
        resultPrefix: prefix, resultChunks });return true;
    });
    if (committed) {
      const snapshot = await target.get(), count = snapshot.data()?.payloadChunks || 0;
      for (let start = 0; start < count; start += 100) {
        const batch = db.batch();for (let i = start; i < Math.min(count, start + 100); i++) batch.delete(target.collection('_ai_job_chunks').doc('input-' + i));await batch.commit();
      }
    } else {
      for (let start = 0; start < resultChunks; start += 100) {
        const batch = db.batch();for(let i=start;i<Math.min(resultChunks,start+100);i++)batch.delete(target.collection('_ai_job_chunks').doc(prefix+i));await batch.commit();
      }
    }
    return committed;
  }
  async function sweep() {
    const expired = await db.collectionGroup('_ai_jobs').where('expiresAt', '<=', now()).limit(20).get();
    for (const doc of expired.docs) {
      const path = doc.ref.path.split('/');
      if (path.length !== 4 || path[0] !== 'usuarios' || path[2] !== '_ai_jobs') continue;
      await db.recursiveDelete(doc.ref);await release(path[1], path[3]);
    }
    const chunks = await db.collectionGroup('_ai_job_chunks').where('expiresAt', '<=', now()).limit(100).get();
    const batch = db.batch();
    for (const doc of chunks.docs) {
      const path = doc.ref.path.split('/');
      if (path.length === 6 && path[0] === 'usuarios' && path[2] === '_ai_jobs') batch.delete(doc.ref);
    }
    if (!chunks.empty) await batch.commit();
  }
  return { create, read, claim, heartbeat, finish, ref, leaseMs, sweep,
    payload: (uid, id, data) => load(ref(uid, id), 'input-', data.payloadChunks),
    result: (uid, id, data) => data.terminalResult || load(ref(uid, id), data.resultPrefix, data.resultChunks) };
}

module.exports = { createFirestoreJobStore };

