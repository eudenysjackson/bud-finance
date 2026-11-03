// Validate the candidate artifact without printing configuration contents.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), stage = path.join(root, 'dist/site');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => { assert.ok(!entry.isSymbolicLink()); const file = path.join(dir, entry.name);return entry.isDirectory() ? files(file) : [file]; }); }
const publicFiles = files(stage).map(file => {
  const relative = path.relative(stage, file).replaceAll('\\', '/');
  assert.ok(!/(^|\/)(?:\.tools|\.env[^/]*|backend|node_modules|email-templates|test-results|tests|\.firebase)(\/|$)/i.test(relative), relative);
  assert.ok(['index.html','logo.png','CNAME','.nojekyll','robots.txt','sitemap.xml'].includes(relative) || /^(appbudfinance|budfinance|site-assets|servicos|sobre|produtos|contato)\//.test(relative), relative);
  if(relative !== '.nojekyll') assert.equal(digest(file), digest(path.join(root, relative)), relative);
  return { path: relative, sha256: digest(file), bytes: fs.statSync(file).size };
}).sort((a,b) => a.path.localeCompare(b.path));
const backend = ['backend/server.js','backend/account-lifecycle.js','backend/security-guard.js','backend/ai-reader.js','backend/ai-jobs.js','backend/ai-job-store.js','backend/invoice-reader.js','backend/subscription-change.js','backend/subscription-upgrade.js','backend/financial-notifications.js','backend/package.json','backend/package-lock.json','firestore.rules','firestore.indexes.json'].map(relative => ({ path: relative, sha256: digest(path.join(root, relative)) }));
const manifest = { createdAt: new Date().toISOString(), published: false, publicFiles, backend };
fs.writeFileSync(path.join(root,'dist/release-manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ verified: true, publicFiles: publicFiles.length, publicBytes: publicFiles.reduce((sum,file)=>sum+file.bytes,0), backendFiles: backend.length, manifest: 'dist/release-manifest.json' }));
