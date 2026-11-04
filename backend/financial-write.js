'use strict';
const policy = require('./plan-policy');
const crypto = require('node:crypto');
const COLLECTIONS = new Set(['carteira','transacoes','importacoes','metas','compras-metas','pagamentos-dividas','dividas','investimentos','recorrentes','limites','categorias']);
const PREMIUM = new Set(['metas','compras-metas','pagamentos-dividas','dividas','investimentos','recorrentes']);
function encode(value) {
  if (value?.toMillis) return { $bud: 'timestamp', value: value.toMillis() };
  if (value instanceof Date) return { $bud: 'timestamp', value: value.getTime() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, encode(value[k])]));
  return value;
}
function same(a, b) { return JSON.stringify(encode(a)) === JSON.stringify(encode(b)); }
function fail(message, status = 403, code = 'PLAN_LIMIT') { throw Object.assign(new Error(message), { status, code }); }
function parsePath(path, uid) {
  const parts = String(path).split('/');
  if (parts[0] !== 'usuarios' || parts[1] !== uid || !COLLECTIONS.has(parts[2]) || !parts[3] ||
      !(parts.length === 4 || (parts.length === 6 && parts[2] === 'metas' && parts[4] === 'depositos' && parts[5]))) fail('Operação não permitida.');
  return parts;
}
function decode(value, admin) {
  if (Array.isArray(value)) return value.map(v => decode(v, admin));
  if (!value || typeof value !== 'object') return value;
  if (value.$bud) {
    if (value.$bud === 'timestamp' && Number.isFinite(value.value)) return admin.firestore.Timestamp.fromMillis(value.value);
    const f = admin.firestore.FieldValue;
    if (value.$bud === 'serverTimestamp') return f.serverTimestamp();
    if (value.$bud === 'deleteField') return f.delete();
    if (value.$bud === 'increment' && Number.isFinite(value.value)) return f.increment(value.value);
    if (['arrayUnion','arrayRemove'].includes(value.$bud) && Array.isArray(value.value)) return f[value.$bud](...value.value.map(v => decode(v, admin)));
    fail('Valor de operação inválido.', 400);
  }
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__','constructor','prototype'].includes(key)) fail('Campo inválido.', 400);
    result[key] = decode(child, admin);
  }
  return result;
}
function resourceOrder(a, b) {
  const time = d => d.criadaEm?.toMillis?.() || d.dataCriacao?.toMillis?.() || 0;
  return time(a) - time(b) || a.id.localeCompare(b.id);
}
function transactionMonth(data = {}) {
  const raw = data.dataReferencia || data.mesReferencia;
  if (typeof raw === 'string' && /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(raw)) return raw.slice(0,7);
  if (data.data?.toDate) return policy.month(data.data.toDate());
  if (data.data?.$bud === 'timestamp') return policy.month(new Date(data.data.value));
  return policy.month();
}
function createFinancialWrite({ db, admin }) {
  async function execute(uid, body) {
    const operations = body.operations;
    if (!Array.isArray(operations) || !operations.length || operations.length > 450 || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.operationId || '')) fail('Operação inválida.', 400);
    const reads = body.reads || [];
    if (!Array.isArray(reads) || reads.length > 500) fail('Leituras inválidas.', 400);
    for (const op of operations) { parsePath(op.path, uid); if (!['set','update','delete'].includes(op.type)) fail('Operação inválida.', 400); }
    for (const read of reads) parsePath(read.path, uid);
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ operations, reads })).digest('hex');
    const userRef = db.doc(`usuarios/${uid}`), usageRef = userRef.collection('_plan_usage').doc(policy.month());
    const receiptRef = userRef.collection('_plan_operations').doc(body.operationId);
    return db.runTransaction(async tx => {
      const [profileSnap, receipt, usageSnap, walletSnap, deletionSnap] = await Promise.all([
        tx.get(userRef), tx.get(receiptRef), tx.get(usageRef), tx.get(userRef.collection('carteira')), tx.get(db.doc('_account_deletions/'+uid))
      ]);
      if (receipt.exists) { if (receipt.data().fingerprint !== fingerprint) fail('Identificador já utilizado.', 409, 'CONFLICT'); return { ok: true, repeated: true }; }
      if (!profileSnap.exists || profileSnap.data()._deletionPending || deletionSnap.exists) fail('Conta indisponível.');
      const profile = profileSnap.data(), plan = policy.effectivePlan(profile), caps = policy.limits(profile);
      const wallet = walletSnap.docs.map(d => ({ ...d.data(), id: d.id })).sort(resourceOrder);
      const allowed = new Set([
        ...wallet.filter(a => a.tipo !== 'credito').slice(0, caps.accounts),
        ...wallet.filter(a => a.tipo === 'credito').slice(0, caps.cards)
      ].map(a => a.id));
      const refs = [...new Set([...operations.map(o => o.path), ...reads.map(r => r.path)])];
      const snapshots = new Map(await Promise.all(refs.map(async path => [path, await tx.get(db.doc(path))])));
      for (const read of reads) {
        const s = snapshots.get(read.path);
        if (!same(s.exists ? s.data() : null, read.data)) fail('Os dados mudaram. Atualizando a operação.', 409, 'CONFLICT');
      }
      const usage = usageSnap.exists ? usageSnap.data() : { imports: 0 };
      const monthlyAdds = new Map();
      let created = 0;
      const importIds = new Set();
      const nextWallet = new Map(wallet.map(a => [a.id, a]));
      const createdPaths = new Set();
      for (const op of operations) {
        const parts = parsePath(op.path, uid), category = parts[2], id = parts[3], old = snapshots.get(op.path);
        if (PREMIUM.has(category) && !['pro','plus','trial'].includes(plan)) fail('Este recurso está bloqueado no seu plano. Seus dados foram preservados.');
        if (category === 'limites' && plan === 'free') fail('Orçamentos estão disponíveis a partir do Starter.');
        if (category === 'carteira') {
          if (old.exists && !allowed.has(id) && op.type !== 'delete') fail('Esta conta ou cartão excede o limite do seu plano e está bloqueado.');
          if (op.type === 'delete') nextWallet.delete(id);
          else nextWallet.set(id, { ...(old.exists ? old.data() : {}), ...op.data, id });
        }
        if (category === 'transacoes' && op.type !== 'delete') {
          if (!old.exists && !createdPaths.has(op.path)) { created++; createdPaths.add(op.path); }
          const data = { ...(old.exists ? old.data() : {}), ...op.data };
          const month = transactionMonth(data);
          if (!old.exists || transactionMonth(old.data()) !== month) monthlyAdds.set(month,(monthlyAdds.get(month)||0)+1);
          for (const key of ['carteiraId','contaId','cartaoId']) if (data[key] && !allowed.has(data[key])) fail('A conta ou cartão deste lançamento está bloqueado pelo plano.');
          if (!old.exists && String(data.origem || '').startsWith('importacao')) importIds.add(data.importacaoId || body.operationId);
        }
        if (category === 'importacoes' && !old.exists && op.type !== 'delete') importIds.add(op.data.importacaoId || body.operationId);
        if (category === 'dividas' && !old.exists && op.type !== 'delete' && op.data.importadoPorIA) importIds.add(op.data.importacaoContrato || body.operationId);
      }
      // Existing excess is retained; only growth beyond the currently allowed count is denied.
      for (const [kind, limit] of [['accounts',caps.accounts],['cards',caps.cards]]) {
        const match = a => (a.tipo === 'credito') === (kind === 'cards');
        const before = wallet.filter(match).length, after = [...nextWallet.values()].filter(match).length;
        if (after > before) policy.assertLimit(before, after - before, limit, kind === 'cards' ? 'cartões' : 'contas');
      }
      const importRefs = [...importIds].map(id => userRef.collection('_plan_imports').doc(crypto.createHash('sha256').update(String(id)).digest('hex')));
      const importSnaps = await Promise.all(importRefs.map(ref => tx.get(ref)));
      const imports = importSnaps.filter(s => !s.exists).length;
      const months = [...monthlyAdds.keys()];
      const monthRefs = months.map(month => userRef.collection('_plan_usage').doc(month));
      const monthSnaps = await Promise.all(monthRefs.map(ref => tx.get(ref)));
      let oldTransactions;
      if (monthSnaps.some(s => !s.exists || s.data().transactions === undefined)) oldTransactions = await tx.get(userRef.collection('transacoes'));
      const totals = months.map((month,i) => {
        const before = monthSnaps[i].exists && monthSnaps[i].data().transactions !== undefined ? Number(monthSnaps[i].data().transactions) : oldTransactions.docs.filter(d=>transactionMonth(d.data())===month).length;
        policy.assertLimit(before, monthlyAdds.get(month), caps.transactions, `lançamentos em ${month}`);
        return before+monthlyAdds.get(month);
      });
      if (importIds.size && caps.imports === 0) policy.assertLimit(0, 1, 0, 'importações por mês');
      if (imports) policy.assertLimit(Number(usage.imports || 0), imports, caps.imports, 'importações por mês');
      for (const op of operations) {
        const ref = db.doc(op.path);
        if (op.type === 'delete') tx.delete(ref);
        else if (op.type === 'update') tx.update(ref, decode(op.data, admin));
        else if (op.options?.merge === true) tx.set(ref, decode(op.data, admin), { merge: true });
        else tx.set(ref, decode(op.data, admin));
      }
      tx.set(usageRef, { imports: Number(usage.imports || 0) + imports }, {merge:true});
      monthRefs.forEach((ref,i)=>tx.set(ref,{transactions:totals[i]},{merge:true}));
      importRefs.forEach((ref,i) => { if (!importSnaps[i].exists) tx.set(ref,{ createdAt: admin.firestore.FieldValue.serverTimestamp() }); });
      tx.set(receiptRef, { fingerprint, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      return { ok: true };
    });
  }
  return async function handler(req, res) {
    try { if (!db) fail('Serviço temporariamente indisponível.', 503); return res.json(await execute(req.budUser.uid, req.body)); }
    catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível salvar. Tente novamente.', code: error.code || 'WRITE_FAILED' }); }
  };
}
module.exports = { createFinancialWrite, encode, same, decode, parsePath, resourceOrder, transactionMonth };
