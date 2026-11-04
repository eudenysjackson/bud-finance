// Financial writes share one server-side entitlement and quota check.
export * from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import * as sdk from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
const financial = new Set(['carteira','transacoes','importacoes','metas','compras-metas','pagamentos-dividas','dividas','investimentos','recorrentes','limites','categorias']);
const transforms = new WeakMap();
const track = (value, descriptor) => { transforms.set(value, descriptor); return value; };
export const serverTimestamp = () => track(sdk.serverTimestamp(), { $bud: 'serverTimestamp' });
export const deleteField = () => track(sdk.deleteField(), { $bud: 'deleteField' });
export const increment = value => track(sdk.increment(value), { $bud: 'increment', value });
export const arrayUnion = (...value) => track(sdk.arrayUnion(...value), { $bud: 'arrayUnion', value });
export const arrayRemove = (...value) => track(sdk.arrayRemove(...value), { $bud: 'arrayRemove', value });
function encode(value) {
  if (value && transforms.has(value)) return encode(transforms.get(value));
  if (value?.toMillis) return { $bud: 'timestamp', value: value.toMillis() };
  if (value instanceof Date) return { $bud: 'timestamp', value: value.getTime() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v)]));
  return value;
}
const protectedRef = ref => ref.path?.split('/')[0] === 'usuarios' && financial.has(ref.path.split('/')[2]);
async function commit(operations, reads = [], operationId = crypto.randomUUID()) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Entre novamente na sua conta.');
  const token = await user.getIdToken();
  const response = await fetch(`${window.BUD_FUNCTIONS_URL}/api/financial/write`, {
    method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
    body: JSON.stringify({ operationId, operations, reads }), signal: AbortSignal.timeout(45000)
  });
  const result = await response.json();
  if (!response.ok) {
    if (result.code === 'PLAN_LIMIT') window.budShowToast?.(result.error, 'warning');
    throw Object.assign(new Error(result.error || 'Não foi possível salvar.'), { code: result.code });
  }
}
const operation = (type, ref, data, options) => ({ type, path: ref.path, ...(data === undefined ? {} : { data: encode(data) }), ...(options ? { options } : {}) });
export async function addDoc(collection, data) {
  const ref = sdk.doc(collection);
  if (!protectedRef(ref)) return sdk.addDoc(collection, data);
  await commit([operation('set',ref,data)]); return ref;
}
export async function setDoc(ref, data, options) {
  if (!protectedRef(ref)) return options ? sdk.setDoc(ref,data,options) : sdk.setDoc(ref,data);
  return commit([operation('set',ref,data,options)]);
}
export async function updateDoc(ref, data, ...rest) {
  if (!protectedRef(ref)) return sdk.updateDoc(ref,data,...rest);
  if (rest.length || typeof data !== 'object') throw new Error('Atualização de campos não suportada.');
  return commit([operation('update',ref,data)]);
}
export async function deleteDoc(ref) { return protectedRef(ref) ? commit([operation('delete',ref)]) : sdk.deleteDoc(ref); }
export function writeBatch(db) {
  const entries = [], operationId = crypto.randomUUID();
  const batch = {
    set(ref,data,options) { entries.push({ref,type:'set',data,options}); return batch; },
    update(ref,data) { entries.push({ref,type:'update',data}); return batch; },
    delete(ref) { entries.push({ref,type:'delete'}); return batch; },
    async commit() {
      if (!entries.length) return;
      if (!entries.some(e => protectedRef(e.ref))) {
        const native = sdk.writeBatch(db);
        for (const e of entries) { if (e.type === 'delete') native.delete(e.ref); else if (e.options) native[e.type](e.ref,e.data,e.options); else native[e.type](e.ref,e.data); }
        return native.commit();
      }
      return commit(entries.map(e => operation(e.type,e.ref,e.data,e.options)), [], operationId);
    }
  };
  return batch;
}
export async function runTransaction(db, callback) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reads = [], writes = [];
    const transaction = {
      async get(ref) { const snap = await sdk.getDocFromServer(ref); reads.push({path:ref.path,data:encode(snap.exists()?snap.data():null)}); return snap; },
      set(ref,data,options) { writes.push(operation('set',ref,data,options)); return transaction; },
      update(ref,data) { writes.push(operation('update',ref,data)); return transaction; },
      delete(ref) { writes.push(operation('delete',ref)); return transaction; }
    };
    const result = await callback(transaction);
    if (!writes.length) return result;
    try { await commit(writes,reads); return result; }
    catch (error) { if (error.code !== 'CONFLICT' || attempt === 4) throw error; }
  }
}
