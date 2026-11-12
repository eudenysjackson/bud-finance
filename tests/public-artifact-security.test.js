const { test } = require('node:test'), assert = require('node:assert/strict');
const { inspect } = require('../scripts/scan-public-artifact.cjs');
test('publication rejects private credentials and recovery copies without echoing their contents', () => {
  for (const file of ['appbudfinance/.env','backend/server.js','site-assets/recovery.budbackup']) assert.equal(inspect(file,Buffer.from('{}')),'private-file');
  for (const value of ['APP_USR-'+'0'.repeat(40),'gsk_'+'0'.repeat(40),'-----BEGIN PRIVATE KEY-----','{"type":"service_account"}']) assert.equal(inspect('appbudfinance/js/config.js',Buffer.from(value)),'private-credential');
  assert.equal(inspect('appbudfinance/js/firebase-config.js',Buffer.from('apiKey: "AIza-public-client-config"')),null);
});

test('Release includes the new Gestor login without restoring the archived admin integration',()=>{
 const fs=require('node:fs');const server=fs.readFileSync('backend/server.js','utf8');
 assert(!/createGestorAPI|ownerNotifications/.test(server));
 assert(!fs.readFileSync('appbudfinance/admin.html','utf8').includes('/budgestor/'));
 assert(fs.readFileSync('appbudfinance/admin.html','utf8').includes('adminContent'));
 assert(!fs.readFileSync('appbudfinance/js/admin.js','utf8').includes('bud-gestor'));
 assert(fs.readFileSync('scripts/package-release.js','utf8').includes("'budgestor'"));
});
