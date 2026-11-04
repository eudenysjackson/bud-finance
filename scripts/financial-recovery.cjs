// No plaintext data written. Restore is deliberately restricted to a local DEMO database.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { sealArchive, openArchive, encode, decode, validateArchive, COLLECTIONS } = require('../backend/recovery-archive');
async function main() {
  const [action, filename, uid] = process.argv.slice(2);
  if (!['export','verify','restore-demo'].includes(action) || !filename || !uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('Usage: financial-recovery.cjs export|verify|restore-demo file.budbackup uid');
  const file = path.resolve(filename), repo = path.resolve(__dirname, '..');
  if (file.startsWith(repo + path.sep) || !file.endsWith('.budbackup')) throw Error('Backup must be outside the repository and use .budbackup');
  for (let parent = path.dirname(file); ; parent = path.dirname(parent)) {
    if (fs.existsSync(path.join(parent, '.git'))) throw Error('Backup cannot be stored inside any Git repository');
    if (parent === path.dirname(parent)) break;
  }
  const key = process.env.BACKUP_KEY;
  if (action === 'verify') {
    const archive = validateArchive(openArchive(fs.readFileSync(file), key));
    if (archive.uid !== uid) throw Error('Owner mismatch');
    console.log('Encrypted archive verified. Documents:', archive.documents.length); return;
  }
  const admin = require('../backend/node_modules/firebase-admin');
  if (action === 'restore-demo') {
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.GCLOUD_PROJECT !== 'demo-bud-security') throw Error('Restore requires isolated demo-bud-security emulator on 127.0.0.1:18080');
    admin.initializeApp({ projectId: 'demo-bud-security' });
  } else {
    if (process.env.BACKUP_EXPORT_CONFIRMED !== 'yes') throw Error('Explicit BACKUP_EXPORT_CONFIRMED=yes required');
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore(), root = db.collection('usuarios').doc(uid);
  try {
    if (action === 'export') {
      if (!(await root.get()).exists || (await db.doc('_account_deletions/' + uid).get()).exists) throw Error('Account unavailable or deleting');
      const documents = [];
      async function collect(collection, prefix) {
        let last;
        for (;;) {
          let query = collection.orderBy(admin.firestore.FieldPath.documentId()).limit(250);
          if (last) query = query.startAfter(last);
          const page = await query.get();
          for (const doc of page.docs) {
            documents.push({ path: prefix + '/' + doc.id, data: encode(doc.data()) });
            if (prefix === 'metas') await collect(doc.ref.collection('depositos'), prefix + '/' + doc.id + '/depositos');
          }
          if (page.size < 250) break;
          last = page.docs.at(-1);
        }
      }
      for (const name of COLLECTIONS) await collect(root.collection(name), name);
      if ((await db.doc('_account_deletions/' + uid).get()).exists || !(await root.get()).exists) throw Error('Account removed during export');
      const archive = { version: 1, scope: 'financial-only', uid, createdAt: new Date().toISOString(), documents };
      fs.writeFileSync(file, sealArchive(archive, key), { flag: 'wx', mode: 0o600 });
      console.log('Encrypted financial archive created. Documents:', documents.length);
    } else {
      const archive = validateArchive(openArchive(fs.readFileSync(file), key));
      if (archive.uid !== uid) throw Error('Owner mismatch');
      // Validate all values BEFORE the first write. Never restore credentials, plans or owner events.
      const rows = archive.documents.map(d => ({ path: d.path, data: decode(d.data, admin.firestore.Timestamp) }));
      if ((await root.get()).exists || (await root.listCollections()).length) throw Error('Target must be empty');
      await root.create({ nome: 'Recuperação fictícia', plano: 'free' });
      for (let n = 0; n < rows.length; n += 400) {
        const batch = db.batch();
        for (const row of rows.slice(n, n + 400)) batch.create(db.doc(root.path + '/' + row.path), row.data);
        await batch.commit();
      }
      console.log('Restored to demo emulator only. Documents:', rows.length);
    }
  } finally { await db.terminate(); await admin.app().delete(); }
}
main().catch(() => { console.error('Recovery operation failed. Check arguments, authorization, key, archive integrity and isolated target. No secret or document content is printed.'); process.exitCode = 1; });
