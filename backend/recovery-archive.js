'use strict';
const crypto = require('node:crypto');
const MAGIC = Buffer.from('BUDBACKUP1');
const MAX_BYTES = 100 * 1024 * 1024;
function keyFrom(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value || '')) throw Error('BACKUP_KEY must be a base64 encoded 32-byte random key');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw Error('Invalid backup key');
  return key;
}
function sealArchive(payload, keyValue) {
  const key = keyFrom(keyValue), plain = Buffer.from(JSON.stringify(payload));
  if (plain.length > MAX_BYTES) throw Error('Archive too large');
  const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(MAGIC);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), data]);
}
function openArchive(buffer, keyValue) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MAGIC.length + 28 || buffer.length > MAX_BYTES + 100 || !buffer.subarray(0, MAGIC.length).equals(MAGIC)) throw Error('Invalid archive');
  const pos = MAGIC.length, decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(keyValue), buffer.subarray(pos, pos + 12));
  decipher.setAAD(MAGIC); decipher.setAuthTag(buffer.subarray(pos + 12, pos + 28));
  return JSON.parse(Buffer.concat([decipher.update(buffer.subarray(pos + 28)), decipher.final()]).toString('utf8'));
}
// Typed nodes preserve Firestore timestamps, avoid ambiguous user-controlled tags.
function encode(value) {
  if (value === null || ['string','boolean','number'].includes(typeof value)) return ['scalar', value];
  if (value && typeof value.toMillis === 'function') return ['timestamp', value.seconds, value.nanoseconds];
  if (Buffer.isBuffer(value)) return ['bytes', value.toString('base64')];
  if (Array.isArray(value)) return ['array', value.map(encode)];
  if (value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) return ['object', Object.entries(value).map(([k,v]) => [k,encode(v)])];
  throw Error('Unsupported Firestore value; archive aborted');
}
function decode(node, Timestamp) {
  if (!Array.isArray(node)) throw Error('Invalid typed value');
  switch (node[0]) {
    case 'scalar': if (node[1] === null || ['string','number','boolean'].includes(typeof node[1])) return node[1]; break;
    case 'timestamp': return new Timestamp(node[1], node[2]);
    case 'bytes': return Buffer.from(node[1], 'base64');
    case 'array': return node[1].map(v => decode(v, Timestamp));
    case 'object': return Object.fromEntries(node[1].map(([k,v]) => {
      if (['__proto__','constructor','prototype'].includes(k)) throw Error('Unsafe field');
      return [k,decode(v, Timestamp)];
    }));
  }
  throw Error('Invalid typed value');
}
const COLLECTIONS = ['carteira','transacoes','importacoes','metas','compras-metas','pagamentos-dividas','dividas','investimentos','recorrentes','limites','categorias'];
function allowedPath(path) {
  if (typeof path !== 'string') return false;
  const parts = path.split('/');
  return parts.every(p => p && p !== '.' && p !== '..') &&
    ((parts.length === 2 && COLLECTIONS.includes(parts[0])) || (parts.length === 4 && parts[0] === 'metas' && parts[2] === 'depositos'));
}
function validateArchive(archive) {
  if (archive?.version !== 1 || archive.scope !== 'financial-only' || !Array.isArray(archive.documents)) throw Error('Invalid archive schema');
  const seen = new Set();
  for (const doc of archive.documents) {
    if (!allowedPath(doc.path) || seen.has(doc.path)) throw Error('Invalid or duplicate document path');
    seen.add(doc.path);
  }
  return archive;
}
module.exports = { sealArchive, openArchive, encode, decode, validateArchive, COLLECTIONS };
