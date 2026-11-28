const express = require('../backend/node_modules/express');
const admin = require('../backend/node_modules/firebase-admin');
const cliAuth = require('../node_modules/firebase-tools/lib/auth');
const cliApi = require('../node_modules/firebase-tools/lib/api');
const { CLOUD_PLATFORM } = require('../node_modules/firebase-tools/lib/scopes');
const { registerGestorClients } = require('../backend/gestor-clientes');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const projectId = 'bud-finance';
const documentRoot = `projects/${projectId}/databases/(default)/documents`;
const base = 'https://firestore.googleapis.com/v1/' + documentRoot;
const preview = path.resolve(__dirname, '../dist/site');
const port = Number(process.env.BUD_GESTOR_PREVIEW_PORT || 5506);
cliApi.setScopes([CLOUD_PLATFORM]);

async function accessToken() {
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw Error('Sessão Firebase CLI indisponível.');
  return cliAuth.getAccessToken(account.tokens.refresh_token, cliApi.getScopes());
}

delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
admin.initializeApp({ projectId, credential: { async getAccessToken() {
  const token = await accessToken();
  return { access_token: token.access_token, expires_in: Math.max(1, Math.floor((token.expires_at - Date.now()) / 1000)) };
} } });

async function firestore(relative, query) {
  const token = await accessToken();
  const response = await fetch(base + relative, {
    method: query ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' },
    body: query ? JSON.stringify({ structuredQuery: query }) : undefined,
    signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 404 && !query) return null;
  if (!response.ok) throw Error('Firestore HTTP ' + response.status);
  return response.json();
}

function decode(value) {
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  return Object.values(value)[0];
}
function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}
function snapshot(document) {
  return { id: document?.name.split('/').at(-1), data: () => document && decodeFields(document.fields) };
}

function collection(parent, collectionId) {
  const query = { from: [{ collectionId }] };
  return {
    doc(id) {
      const route = parent + '/' + collectionId + '/' + encodeURIComponent(id);
      return { get: async () => snapshot(await firestore(route)), collection: name => collection(route, name) };
    },
    orderBy(fieldPath, direction) {
      query.orderBy = [{ field: { fieldPath }, direction: direction === 'desc' ? 'DESCENDING' : 'ASCENDING' }];
      return this;
    },
    startAfter(id) {
      query.startAt = { before: false, values: [{ referenceValue: documentRoot + parent + '/' + collectionId + '/' + id }] };
      return this;
    },
    limit(limit) { query.limit = limit; return this; },
    where(fieldPath, operator, value) {
      if (operator !== '==') throw Error('Operador inválido.');
      query.where = { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } };
      return this;
    },
    async get() {
      const result = await firestore(parent + ':runQuery', query);
      return { docs: result.filter(row => row.document).map(row => snapshot(row.document)) };
    }
  };
}

const db = { collection: name => collection('', name) };
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  if (req.headers.host !== `localhost:${port}`) return res.sendStatus(403);
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(405);
  next();
});

async function ownerOnly(req, res, next) {
  const token = req.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return res.sendStatus(401);
  try {
    const identity = await admin.auth().verifyIdToken(token, true);
    if (identity.budGestorOwner !== true || !identity.email_verified) return res.sendStatus(403);
    const owner = (await db.collection('_gestor_private').doc('owner').get()).data();
    if (owner?.uid !== identity.uid) return res.sendStatus(403);
    req.owner = owner;
    next();
  } catch { return res.sendStatus(401); }
}

app.get('/api/gestor/owner-profile', ownerOnly, (req, res) => {
  const p = req.owner;
  res.json({
    name: p.name, loginEmail: p.loginEmail, recoveryEmail: p.recoveryEmail,
    recoveryEmailVerified: p.recoveryEmailVerified, whatsapp: p.whatsapp, whatsappVerified: p.whatsappVerified
  });
});
app.get('/api/gestor/clients', (req, res, next) => {
  if (req.query.source !== 'manual') return next();
  return ownerOnly(req, res, () => res.json({ clients: [], next: null }));
});
app.get('/api/gestor/clients/manual/:id', (req, res) => res.sendStatus(404));
registerGestorClients(app, { db, ownerOnly });

app.get('/budgestor/gestor.js', (req, res) => {
  const js = readFileSync(path.join(preview, 'budgestor/gestor.js'), 'utf8');
  const updated = js.replace(/^const local = .*;$/m, 'const local = false;')
    .replace(/^const api = .*;$/m, 'const api = location.origin;')
    .replace(/^(const desk = .*;)$/m, '$1\ndesk.querySelector("#add-client").hidden = true;');
  if (!updated.includes('const api = location.origin;') || !updated.includes('const local = false;')) return res.sendStatus(500);
  return res.type('js').send(updated);
});
app.use('/budgestor', express.static(path.join(preview, 'budgestor')));
app.get('/logo.png', (req, res) => res.sendFile(path.join(preview, 'logo.png')));
app.listen(port, '127.0.0.1', () => console.log(`Prévia de produção somente leitura em http://localhost:${port}/budgestor/`));
