// backend/server.js â€” Bud Finance Backend
// Generates Firebase password reset links via Admin SDK.
// Sends the reset email server-side via EmailJS REST API.
// Also: POST /api/extrair-fatura â€” extrai transaÃ§Ãµes de PDF de fatura de cartÃ£o.
// The oobCode NEVER leaves the backend.

const express = require('express');
const cors    = require('cors');
const admin   = require('firebase-admin');
const multer  = require('multer');
const pdfParse = require('pdf-parse');
const crypto  = require('crypto');
const { createReader, readPDF } = require('./ai-reader');
const { createJobs, currentJob } = require('./ai-jobs');
const { createFirestoreJobStore } = require('./ai-job-store');
const { readNubankInvoice } = require('./invoice-reader');
const { createAccountLifecycle } = require('./account-lifecycle');
const planPolicy = require('./plan-policy');
const { privateHeaders, safeError, revokeSessions } = require('./security-controls');
const { createFinancialWrite } = require('./financial-write');
const { createSecurityGuard, pruneSecurityLimits } = require('./security-guard');
const { createSubscriptionChange } = require('./subscription-change');
const { createSubscriptionUpgrade } = require('./subscription-upgrade');
const { financialNotices, subscriptionDunningStage, subscriptionPushNotices, sendFinancialPush } = require('./financial-notifications');

// Modelo multimodal configurável; validado na API da Groq em 24/10/2026.
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const GROQ_MAX_OUTPUT_TOKENS = Math.max(150, Math.min(8192, Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 8192));
const AI_OUTPUT_LIMIT_MESSAGE = 'A leitura atingiu o limite de resposta da IA. Envie menos páginas ou itens por vez. Nenhum resultado parcial foi aceito.';

function ensureCompleteAIResponse(data) {
  if (data.choices?.[0]?.finish_reason === 'length') {
    const error = new Error(AI_OUTPUT_LIMIT_MESSAGE);
    error.code = 'AI_OUTPUT_LIMIT';
    throw error;
  }
}
const aiReader = createReader({ model: GROQ_MODEL, key: process.env.GROQ_API_KEY, maxTokens: GROQ_MAX_OUTPUT_TOKENS });


// â”€â”€â”€ Firebase Admin init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Service account credentials injected via environment variable.
// On Render: FIREBASE_SERVICE_ACCOUNT = JSON string of the service account key.
// Em dev local sem credenciais, o servidor sobe mesmo assim â€” apenas as rotas
// que usam auth/db ficam indisponÃ­veis (ex: /reset-senha). /api/extrair-cupom
// nÃ£o usa Firebase e funciona normalmente.
let auth, db;
try {
  const usarEmulador = process.env.BUD_USE_EMULATOR === 'true';
  if (usarEmulador) {
    // O Admin SDK reconhece FIRESTORE_EMULATOR_HOST e
    // FIREBASE_AUTH_EMULATOR_HOST definidos no .env.local.
    admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || 'bud-finance-local' });
    console.log('[Firebase Admin] Conectado aos emuladores locais.');
  } else {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  auth = admin.auth();
  db   = admin.firestore();
} catch (e) {
  console.warn('[Firebase Admin] Credenciais ausentes ou invÃ¡lidas. Rotas /reset-senha e similares nÃ£o funcionarÃ£o:', e.message);
}

// â”€â”€â”€ EmailJS config (env vars â€” set on Render) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const aiJobs = createJobs(getBearerUser, { store: db ? createFirestoreJobStore(db) : undefined });

const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || '';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || '';
const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || '';
const EMAILJS_TEMPLATE_ID           = process.env.EMAILJS_TEMPLATE_RECUPERAR_SENHA || '';
const EMAILJS_TEMPLATE_BOAS_VINDAS  = process.env.EMAILJS_TEMPLATE_BOAS_VINDAS || '';
// Um único template flexível cobre recuperação, alertas, chamados e avisos
// de assinatura. A variável nova é opcional para manter compatibilidade.
const EMAILJS_TEMPLATE_COMUNICACAO = process.env.EMAILJS_TEMPLATE_COMUNICACAO || EMAILJS_TEMPLATE_ID;
const SUPPORT_EMAIL                 = process.env.SUPPORT_EMAIL || '';
const FRONTEND_URL                  = process.env.FRONTEND_URL || 'https://budsolucoes.com.br/appbudfinance';
// Obrigatório em produção: impede que o código salvo no Firestore possa ser
// usado caso alguém tenha acesso indevido ao banco.
const EMAIL_VERIFICATION_SECRET = process.env.EMAIL_VERIFICATION_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'bud-finance-local-verification-only');
// Nunca armazene este código no Firestore ou no frontend. Configure-o no
// ambiente do backend (Render) antes de disponibilizar /admin-register.html.
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE ||
  (process.env.NODE_ENV === 'production' ? '' : 'bud-finance-local-admin-invite');

// â”€â”€â”€ WhatsApp config (env vars â€” set on Render) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WA_PHONE_NUMBER_ID  = process.env.WA_PHONE_NUMBER_ID  || '';
const WA_API_TOKEN        = process.env.WA_API_TOKEN        || '';
const WA_VERIFY_TOKEN     = process.env.WA_VERIFY_TOKEN     || 'bud-wh-verify';
const WA_APP_SECRET       = process.env.WA_APP_SECRET       || '';
const WA_NUMERO_DISPLAY   = process.env.WA_NUMERO_DISPLAY   || '';
const WA_NUMERO_LINK      = process.env.WA_NUMERO_LINK      || '';
// Evolution API (alternativa MVP sem Meta API)
const WA_EVOLUTION_URL      = process.env.WA_EVOLUTION_URL      || '';
const WA_EVOLUTION_KEY      = process.env.WA_EVOLUTION_KEY      || '';
const WA_EVOLUTION_INSTANCE = process.env.WA_EVOLUTION_INSTANCE || 'bud';

// â”€â”€â”€ Mercado Pago config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN   || '';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';
const MP_WEBHOOK_URL    = process.env.MP_WEBHOOK_URL ||
  'https://bud-finance-backend.onrender.com/webhook/mercadopago';
// planKey â†’ tÃ­tulo e preÃ§o mensal (BRL)
const MP_PLANS = {
  starter: { title: 'Bud Finance Starter', amount: 9.99  },
  pro:     { title: 'Bud Finance Pro',     amount: 29.90 },
  plus:    { title: 'Bud Finance Plus',    amount: 49.90 }
};
const MP_INDICACAO_DESCONTO = 0.15; // 15% somente na primeira cobrança do indicado
const MP_BONUS_INDICADOR = 0.50; // 50% em uma próxima cobrança, uma vez por conta

const subscriptionUpgrades=createSubscriptionUpgrade({auth,db,token:MP_ACCESS_TOKEN,plans:MP_PLANS,frontend:FRONTEND_URL,webhook:MP_WEBHOOK_URL,fieldValue:admin.firestore.FieldValue,onApplied:_mpAgendarBeneficioIndicacao50});

// â”€â”€â”€ Express setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();
app.disable('x-powered-by');
app.use(privateHeaders);
app.use('/api/financial/write', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '200kb' })); // aumentado para suportar mensagens com extratos/planilhas do Assistente IA

// A3 fix: CORS allowlist split por NODE_ENV (dev permite localhost; prod sÃ³ domÃ­nios pÃºblicos).
const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS_DEV = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:5502',
  'http://127.0.0.1:5502'
];
const ALLOWED_ORIGINS_PROD = [
  'https://bud-finance.onrender.com',
  'https://budsolucoes.com.br',
  'https://www.budsolucoes.com.br'
];
const ALLOWED_ORIGINS = IS_PROD
  ? ALLOWED_ORIGINS_PROD
  : ALLOWED_ORIGINS_PROD.concat(ALLOWED_ORIGINS_DEV);

function isPrivateNetworkOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    const host = url.hostname;
    return /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/.test(host);
  } catch (_) {
    return false;
  }
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || (!IS_PROD && isPrivateNetworkOrigin(origin))) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['POST', 'GET', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Bud-Async']
}));

app.use(createSecurityGuard({auth,db,secret:process.env.RATE_LIMIT_SECRET||EMAIL_VERIFICATION_SECRET}));
// WhatsApp is outside the launch scope. Do not accept public integration traffic.
app.use(['/webhook/whatsapp','/webhook/evolution','/api/whatsapp'],(_req,res)=>res.sendStatus(404));

// â”€â”€â”€ Rate limiting (simple in-memory) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LIMITAÃ‡ÃƒO CONHECIDA (C4): este mapa vive em memÃ³ria do processo.
// Em deploys que reiniciam (Render free tier dorme apÃ³s inatividade),
// o estado Ã© perdido. Para hardening real, migrar p/ Redis ou
// Firestore (`usuarios/{uid}/_ratelimit`). Documentado em ROADMAP.md.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX    = 3;         // max 3 requests per email per minute

function isRateLimited(email) {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { start: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Clean up rate limit map every 2 minutes (matches 1-minute window)
setInterval(function () {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW) rateLimitMap.delete(key);
  }
}, 2 * 60 * 1000);

// â”€â”€â”€ Sanitize HTML tags (server-side equivalent of budSanitize) â”€â”€â”€â”€â”€
function sanitizeStr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/g, '').replace(/\s+/g, ' ').trim();
}

// â”€â”€â”€ Send email via EmailJS REST API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendEmailViaEmailJS(templateParams, templateId) {
  var tid = templateId || EMAILJS_TEMPLATE_ID;
  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !tid) {
    throw new Error('EmailJS não configurado');
  }

  var response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({
      service_id:  EMAILJS_SERVICE_ID,
      template_id: tid,
      user_id:     EMAILJS_PUBLIC_KEY,
      template_params: templateParams
    }, EMAILJS_PRIVATE_KEY ? { accessToken: EMAILJS_PRIVATE_KEY } : {}))
  });

  if (!response.ok) {
    throw new Error('EmailJS HTTP ' + response.status);
  }
}

function sendCommunicationEmail(params) {
  return sendEmailViaEmailJS(Object.assign({
    app_name: 'App Bud Finance',
    app_url: FRONTEND_URL,
    action_label: 'Abrir App Bud Finance',
    action_url: FRONTEND_URL + '/dashboard.html'
  }, params), EMAILJS_TEMPLATE_COMUNICACAO);
}

function hashVerificationCode(uid, code) {
  return crypto.createHmac('sha256', EMAIL_VERIFICATION_SECRET)
    .update(String(uid) + ':' + String(code))
    .digest('hex');
}

async function getBearerUser(req, res) {
  if (!auth || !db) { res.status(503).json({ ok: false, error: 'Serviço indisponível.' }); return null; }
  var header = req.headers.authorization || '';
  var token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) { res.status(401).json({ ok: false, error: 'Token ausente.' }); return null; }
  try { return await auth.verifyIdToken(token,true); }
  catch (_) { res.status(401).json({ ok: false, error: 'Token inválido.' }); return null; }
}

function subscriptionEmailProof(uid, email) {
  if (!EMAIL_VERIFICATION_SECRET) throw new Error('Assinatura de links indisponível.');
  return crypto.createHmac('sha256', EMAIL_VERIFICATION_SECRET)
    .update(JSON.stringify(['subscription-email-v1', uid, String(email || '').trim().toLowerCase()]))
    .digest('hex');
}

app.post('/api/assinatura/validar-aviso', async (req, res) => {
  const user = await getBearerUser(req, res);
  if (!user) return;
  if (!EMAIL_VERIFICATION_SECRET) return res.sendStatus(503);
  const proof = req.body?.proof;
  if (!user.email_verified || !user.email || typeof proof !== 'string' || !/^[a-f0-9]{64}$/.test(proof) ||
      !safeSecretEquals(proof, subscriptionEmailProof(user.uid, user.email))) return res.sendStatus(403);
  return res.sendStatus(204);
});

function safeSecretEquals(value, expected) {
  var received = Buffer.from(String(value || ''), 'utf8');
  var configured = Buffer.from(String(expected || ''), 'utf8');
  return received.length === configured.length && received.length > 0 &&
    crypto.timingSafeEqual(received, configured);
}

// Criação de administradores: a validação acontece somente no servidor. Isso
// impede que alguém se promova escrevendo diretamente no Firestore.
app.post('/api/admin/registrar', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ ok: false, error: 'Serviço indisponível.' });
  if (!ADMIN_INVITE_CODE) return res.status(503).json({ ok: false, error: 'Cadastro administrativo não configurado.' });

  var nome = String(req.body && req.body.nome || '').trim().slice(0, 120);
  var email = String(req.body && req.body.email || '').trim().toLowerCase();
  var senha = String(req.body && req.body.senha || '');
  var codigo = String(req.body && req.body.codigo || '');

  if (!nome || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 8 || !codigo) {
    return res.status(400).json({ ok: false, error: 'Dados de cadastro inválidos.' });
  }
  if (isRateLimited('admin-register:' + email)) {
    return res.status(429).json({ ok: false, error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
  }
  if (!safeSecretEquals(codigo, ADMIN_INVITE_CODE)) {
    return res.status(403).json({ ok: false, error: 'Código de convite inválido.' });
  }

  var createdUser = null;
  try {
    createdUser = await auth.createUser({ email: email, password: senha, displayName: nome });
    await db.collection('admins').doc(createdUser.uid).set({
      nome: nome,
      email: email,
      role: 'admin',
      dataCadastro: admin.firestore.FieldValue.serverTimestamp(),
      criadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    return res.status(201).json({ ok: true, message: 'Administrador criado com sucesso.' });
  } catch (err) {
    if (createdUser) {
      try { await auth.deleteUser(createdUser.uid); } catch (_) {}
    }
    if (err && err.code === 'auth/email-already-exists') {
      return res.status(409).json({ ok: false, error: 'Este e-mail já está cadastrado.' });
    }
    console.error('[admin-register]', err);
    return res.status(500).json({ ok: false, error: 'Não foi possível criar o administrador.' });
  }
});

// ─── Código de verificação de e-mail (6 dígitos, 15 min, uso único) ───────
app.post('/api/verificacao-email/enviar', async function (req, res) {
  var decoded = await getBearerUser(req, res);
  if (!decoded) return;
  if (!EMAIL_VERIFICATION_SECRET) return res.status(503).json({ ok: false, error: 'Verificação não configurada.' });
  if (decoded.email_verified) return res.json({ ok: true, alreadyVerified: true });

  var ref = db.collection('usuarios').doc(decoded.uid).collection('_seguranca').doc('verificacao-email');
  var agora = Date.now();
  var anterior = await ref.get();
  if (anterior.exists && anterior.data().enviadoEm && agora - anterior.data().enviadoEm.toMillis() < 60 * 1000) {
    return res.status(429).json({ ok: false, error: 'Aguarde um minuto para reenviar.' });
  }

  var codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  var magicToken = crypto.randomBytes(32).toString('base64url');
  await ref.set({
    hash: hashVerificationCode(decoded.uid, codigo),
    magicHash: hashVerificationCode(decoded.uid, magicToken),
    expiraEm: admin.firestore.Timestamp.fromMillis(agora + 15 * 60 * 1000),
    enviadoEm: admin.firestore.Timestamp.fromMillis(agora),
    tentativas: 0
  });
  try {
    var verificationProfile = {};
    try {
      var verificationUser = await db.collection('usuarios').doc(decoded.uid).get();
      if (verificationUser.exists) verificationProfile = verificationUser.data() || {};
    } catch (_) {}
    await sendEmailViaEmailJS({
      to_email: decoded.email,
      to_name: sanitizeStr(verificationProfile.nome || decoded.name || decoded.email),
      matricula: sanitizeStr(String(verificationProfile.matricula || '')),
      email: decoded.email,
      verification_code: codigo,
      magic_link: FRONTEND_URL + '/index.html?magic_verification=' + encodeURIComponent(decoded.uid + '.' + magicToken),
      verify_url: FRONTEND_URL + '/index.html?magic_verification=' + encodeURIComponent(decoded.uid + '.' + magicToken)
    }, EMAILJS_TEMPLATE_BOAS_VINDAS);
    return res.json({ ok: true, expiresInMinutes: 15 });
  } catch (e) {
    await ref.delete().catch(function () {});
    return res.status(503).json({ ok: false, error: 'Não foi possível enviar o e-mail.' });
  }
});

// Link mágico: confirma o e-mail e devolve um Firebase Custom Token de uso
// imediato. O token é aleatório, expira junto do código e é invalidado ao usar.
app.post('/api/verificacao-email/magico', async function (req, res) {
  if (!auth || !db || !EMAIL_VERIFICATION_SECRET) return res.status(503).json({ ok: false, error: 'Verificação não configurada.' });
  var bruto = String((req.body && req.body.token) || '');
  var ponto = bruto.indexOf('.');
  if (ponto < 1) return res.status(400).json({ ok: false, error: 'Link inválido.' });
  var uid = bruto.slice(0, ponto);
  var token = bruto.slice(ponto + 1);
  var ref = db.collection('usuarios').doc(uid).collection('_seguranca').doc('verificacao-email');
  var snap = await ref.get();
  var dados = snap.exists ? snap.data() : null;
  if (!dados || !dados.magicHash || !dados.expiraEm || dados.expiraEm.toMillis() < Date.now()) {
    return res.status(400).json({ ok: false, error: 'Link expirado ou já utilizado.' });
  }
  if (!crypto.timingSafeEqual(Buffer.from(dados.magicHash), Buffer.from(hashVerificationCode(uid, token)))) {
    return res.status(400).json({ ok: false, error: 'Link inválido.' });
  }
  await auth.updateUser(uid, { emailVerified: true });
  await ref.delete();
  var customToken = await auth.createCustomToken(uid);
  return res.json({ ok: true, customToken: customToken });
});

app.post('/api/verificacao-email/confirmar', async function (req, res) {
  var decoded = await getBearerUser(req, res);
  if (!decoded) return;
  if (!EMAIL_VERIFICATION_SECRET) return res.status(503).json({ ok: false, error: 'Verificação não configurada.' });
  if (decoded.email_verified) return res.json({ ok: true, alreadyVerified: true });
  var codigo = String((req.body && req.body.codigo) || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(codigo)) return res.status(400).json({ ok: false, error: 'Informe os 6 dígitos do código.' });

  var ref = db.collection('usuarios').doc(decoded.uid).collection('_seguranca').doc('verificacao-email');
  var snap = await ref.get();
  var dados = snap.exists ? snap.data() : null;
  if (!dados || !dados.expiraEm || dados.expiraEm.toMillis() < Date.now()) {
    return res.status(400).json({ ok: false, error: 'Código expirado. Solicite outro.' });
  }
  if ((dados.tentativas || 0) >= 5) return res.status(429).json({ ok: false, error: 'Muitas tentativas. Solicite outro código.' });
  if (!crypto.timingSafeEqual(Buffer.from(dados.hash), Buffer.from(hashVerificationCode(decoded.uid, codigo)))) {
    await ref.update({ tentativas: admin.firestore.FieldValue.increment(1) });
    return res.status(400).json({ ok: false, error: 'Código inválido.' });
  }
  await auth.updateUser(decoded.uid, { emailVerified: true });
  await ref.delete();
  return res.json({ ok: true });
});

// â”€â”€â”€ POST /api/boas-vindas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Gera o link de verificaÃ§Ã£o de e-mail (Firebase Admin) e envia o
// email de boas-vindas com o link via EmailJS (server-side).
// O link completo de verificaÃ§Ã£o nunca Ã© exposto ao cliente.
app.post('/api/boas-vindas', async function (req, res) {
  try {
    if (!auth) return res.status(503).json({ success: false, message: 'Servico indisponivel.' });

    // O link de verificação é sensível: somente o próprio usuário autenticado
    // pode solicitá-lo e exclusivamente para o e-mail presente no token.
    var authHeader = req.headers.authorization || '';
    var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ success: false, message: 'Token ausente.' });
    var decoded;
    try { decoded = await auth.verifyIdToken(idToken,true); }
    catch (_authErr) { return res.status(401).json({ success: false, message: 'Token inválido.' }); }

    var email     = (req.body.email    || '').trim().toLowerCase();
    var nome      = (req.body.nome     || 'Usuario').substring(0, 100);
    var matricula = (req.body.matricula || '').substring(0, 20);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false });
    }
    if (!decoded.email || decoded.email.toLowerCase() !== email) {
      return res.status(403).json({ success: false, message: 'E-mail não autorizado.' });
    }

    // Gera o link de verificacao via Admin SDK.
    // Tenta 3x com intervalo de 1.5s — conta recem-criada pode levar instantes para propagar.
    var verifyLink = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        verifyLink = await auth.generateEmailVerificationLink(email, {
          url: FRONTEND_URL + '/index.html'
        });
        break;
      } catch (_linkErr) {
        if (attempt < 2) {
          await new Promise(function (r) { setTimeout(r, 1500); });
        }
      }
    }

    // Retorna o link para o frontend enviar o email (frontend conhece o EmailJS configurado).
    // Se nao conseguiu gerar o link, retorna fallback para o login.
    return res.json({
      success:     true,
      verifyLink:  verifyLink || (FRONTEND_URL + '/index.html'),
      hasRealLink: !!verifyLink
    });
  } catch (_err) {
    return res.json({ success: true, verifyLink: null, hasRealLink: false });
  }
});

// â”€â”€â”€ POST /api/iniciar-trial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ativado automaticamente apÃ³s cadastro: concede 3 dias com acesso Plus.
// Usa Firebase Admin SDK para contornar regras Firestore de create.
app.post('/api/iniciar-trial', express.json(), async function (req, res) {
  if (!db) return res.status(503).json({ ok: false, error: 'Firebase Admin nÃ£o inicializado.' });

  // Verificar token JWT â€” UID extraÃ­do do token, nunca do body
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ ok: false, error: 'Token ausente.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token invÃ¡lido.' }); }
  var uid = decoded.uid;
  try {
    var ref = db.collection('usuarios').doc(uid);
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error('Perfil indisponível.');
      const data = snap.data();
      if (data.trialIniciado || (data.plano && data.plano !== 'free')) return;
      transaction.update(ref, {
        plano: 'trial',
        trialFim: admin.firestore.Timestamp.fromMillis(Date.now() + 3 * 86400000),
        trialIniciado: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[iniciar-trial]', e.message);
    return res.status(500).json({ ok: false });
  }
});

// â”€â”€â”€ POST /api/expirar-trial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Chamado pelo dashboard quando detecta que o trial venceu.
// Rebaixa o plano para 'free' e limpa os campos de trial.
app.post('/api/expirar-trial', express.json(), async function (req, res) {
  if (!db) return res.status(503).json({ ok: false });

  // Verificar token JWT â€” UID extraÃ­do do token, nunca do body
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ ok: false, error: 'Token ausente.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token invÃ¡lido.' }); }
  var uid = decoded.uid;
  try {
    var ref = db.collection('usuarios').doc(uid);
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists || snap.data().plano !== 'trial') return;
      if (planPolicy.effectivePlan(snap.data()) !== 'free') return;
      transaction.update(ref, { plano: 'free', trialFim: admin.firestore.FieldValue.delete() });
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[expirar-trial]', e.message);
    return res.status(500).json({ ok: false });
  }
});

// â”€â”€â”€ POST /reset-senha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generates a password reset link and sends the email SERVER-SIDE.
// The oobCode NEVER leaves the backend â€” frontend only gets { success: true }.
app.post('/reset-senha', async function (req, res) {
  try {
    var email = (req.body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Always return success to prevent email enumeration
      return res.json({ success: true });
    }

    // Rate limit
    if (isRateLimited(email)) {
      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas. Aguarde um minuto.'
      });
    }

    // Check if user exists (silently return success if not)
    var userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (_e) {
      // User not found â€” return success anyway (anti-enumeration)
      return res.json({ success: true });
    }

    // Get user name from Firestore (sanitize to prevent stored XSS in email)
    var userName = 'UsuÃ¡rio';
    try {
      var userDoc = await db.collection('usuarios').doc(userRecord.uid).get();
      if (userDoc.exists) {
        userName = sanitizeStr(userDoc.data().nome) || 'UsuÃ¡rio';
      }
    } catch (_e) {
      // Non-critical â€” use default name
    }

    // Generate password reset link (Firebase Admin SDK)
    var resetLink = await auth.generatePasswordResetLink(email);

    // Extract oobCode and build custom reset URL (server-side only)
    var oobCode = new URL(resetLink).searchParams.get('oobCode');
    var resetUrl = FRONTEND_URL.replace(/\/$/, '') + '/acao-auth.html?mode=resetPassword&oobCode=' + encodeURIComponent(oobCode);

    // Send email via EmailJS REST API (oobCode stays on the server)
    try {
      await sendCommunicationEmail({
        to_email: email,
        to_name:  userName,
        email_subject: '[App Bud Finance] Redefina sua senha',
        email_title: 'Redefina sua senha',
        email_preheader: 'Recebemos uma solicitação para redefinir sua senha.',
        email_body: 'Para criar uma nova senha, use o botão abaixo. Se não foi você, ignore este e-mail.',
        action_label: 'Redefinir minha senha',
        action_url: resetUrl,
        reset_url: resetUrl
      });
    } catch (_emailErr) {
      console.error('[reset-senha email]', _emailErr.message || 'delivery-failed');
      // Email failed â€” but don't leak info to the client
    }

    return res.json({ success: true });

  } catch (_err) {
    console.error('[reset-senha]', _err.code || _err.name || 'internal');
    // Generic success to prevent information leakage
    return res.json({ success: true });
  }
});

// â”€â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/', function (_req, res) {
  res.json({ status: 'ok', service: 'bud-finance-backend' });
});

// â”€â”€â”€ Multer: upload de arquivo (PDF / imagem) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 16, fieldSize: 65536, parts: 17, headerPairs: 100 }, // 10 MB
  fileFilter: function (_req, file, cb) {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (ok.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato nÃ£o suportado. Use PDF, JPEG, PNG ou WEBP.'));
  }
});


// ─── Helpers de parsing (extraídos para backend/parser.js — DT-004) ─────────
const { MESES_PT, parseValorBRL, isNonTransactionLine, parseBankStatementText, extractMetaFromText } = require('./parser');


// ===================================================================
// ExtraÃ§Ã£o por IA usando TEXTO (mais preciso e rÃ¡pido que visÃ£o p/ PDFs)
// ===================================================================
async function extractWithAIFromText(text, tipo) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY nÃ£o configurada no servidor.');

  var isExtrato = (tipo === 'extrato');
  var promptInstrucoes = isExtrato ? [
    'VocÃª Ã© um extrator preciso de extratos bancÃ¡rios brasileiros.',
    'OBJETIVO: extrair TODAS as movimentaÃ§Ãµes do texto abaixo, sem omitir NENHUMA linha de transaÃ§Ã£o.',
    'Inclua: Pix enviado/recebido, TED/DOC, transferÃªncias, pagamentos, compras no dÃ©bito, salÃ¡rio, depÃ³sitos, tarifas, rendimentos, juros, IOF.',
    'IGNORE: linhas de saldo, totais diÃ¡rios ("Total de saÃ­das", "Total de entradas"), cabeÃ§alhos, rodapÃ©s, nÃºmeros de pÃ¡gina, CPF, CNPJ.',
    'TIPO: "debito" para saÃ­das/despesas (sinal -), "credito" para entradas/receitas (sinal +). VALOR sempre positivo.',
    'NUNCA invente valores. Se uma linha estiver ambÃ­gua, copie a descriÃ§Ã£o exatamente como estÃ¡.',
    'TAREFA EXTRA: capture os totais declarados ("Total entradas", "Total saÃ­das", "Saldo final") em "meta".',
    'Retorne SOMENTE JSON vÃ¡lido neste formato exato:',
    '{"transacoes":[{"desc":"PIX recebido - JoÃ£o","valor":150.00,"data":"2026-04-15","tipo":"credito"}],"meta":{"totalEntradas":4035.65,"totalSaidas":3939.32,"saldoFinal":218.65}}',
    'Use null em campos meta nÃ£o visÃ­veis. SEM markdown, SEM comentÃ¡rios.'
  ].join(' ') : [
    'VocÃª Ã© um extrator preciso de faturas de cartÃ£o de crÃ©dito brasileiras.',
    'OBJETIVO: extrair cada LINHA DE COMPRA/COBRANÃ‡A individual present no detalhamento de transaÃ§Ãµes da fatura.',
    'INCLUA: compras Ã  vista, parcelas de compras antigas (ex: "3/10 LOJA X"), IOF, juros, multa, mora, anuidade e qualquer cobranÃ§a com data e valor no detalhamento. NÃ£o omita tarifas detalhadas.',
    'INCLUA ESTORNOS com valor NEGATIVO (ex: "Estorno de Uber" â†’ valor: -11.93). Eles compensam compras e fazem parte da soma final.',
    'IGNORE ESTRITAMENTE (nunca inclua como transaÃ§Ã£o):',
    '- Linhas de pagamento: "Pagamento recebido", "Pagamento em DD MMM", "Pagamento de fatura"',
    '- Subtotais de seÃ§Ã£o: "Outros lanÃ§amentos R$ X", "Total de compras R$ X", "Pagamentos e Financiamentos R$ X", "Fatura anterior R$ X"',
    '- Subtotais por portador: linha com nome de pessoa + valor (ex: "JoÃ£o Silva   R$ 1.756,22") que aparece antes das transaÃ§Ãµes do portador',
    '- Linhas de saldo: "Saldo restante da fatura anterior", "Saldo em aberto", "Pagamento mÃ­nimo"',
    '- CabeÃ§alhos de seÃ§Ã£o e rodapÃ©s (nÃºmero de pÃ¡gina, CNPJ, endereÃ§o)',
    'A soma dos valores extraÃ­dos deve bater com "Total geral dos lanÃ§amentos" ou "Despesas do mÃªs". O "Total a pagar" pode incluir saldo anterior e deve ser apenas capturado em meta.',
    'TAREFA EXTRA: capture em "meta" DOIS totais: "totalCompras" ("Total de compras", sÃ³ novas compras) E "totalAPagar" ("Pagamento total da fatura" ou "Total a pagar", valor cobrado).',
    'Retorne SOMENTE JSON vÃ¡lido: {"transacoes":[{"desc":"Loja","valor":50.00,"data":"2026-04-01"}],"meta":{"totalCompras":908.47,"totalAPagar":1242.36}}'
  ].join(' ');

  return aiReader.readText(text, promptInstrucoes, 'transacoes');
}

// Soma transaÃ§Ãµes por tipo para validar contra meta declarada
function sumByType(transacoes) {
  var creditos = 0, debitos = 0;
  (transacoes || []).forEach(function(t){
    var v = parseFloat(t.valor) || 0;
    if (t.tipo === 'credito') creditos += v;
    else if (t.tipo === 'debito') debitos += v;
  });
  return { creditos: creditos, debitos: debitos };
}

// Calcula score de captura: mÃ­nimo entre %entradas e %saÃ­das (1.0 = perfeito)
function captureScore(transacoes, meta) {
  if (!meta) return null;
  // Fatura de cartÃ£o: alvo Ã© o "Total a pagar" (inclui parcelas/IOF/encargos).
  // Fallback: totalCompras (sÃ³ novas compras, mais restritivo).
  var alvo = meta.totalAPagar > 0 ? meta.totalAPagar : (meta.totalCompras > 0 ? meta.totalCompras : 0);
  if (alvo > 0) {
    var total = (transacoes || []).reduce(function(s, t){ return s + (parseFloat(t.valor) || 0); }, 0);
    return Math.min(total / alvo, 1.05);
  }
  var sums = sumByType(transacoes);
  var scores = [];
  if (meta.totalEntradas > 0) scores.push(Math.min(sums.creditos / meta.totalEntradas, 1.05));
  if (meta.totalSaidas  > 0) scores.push(Math.min(sums.debitos  / meta.totalSaidas,  1.05));
  return scores.length ? Math.min.apply(null, scores) : null;
}

async function extractWithAI(buffer, mimeType, tipo) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY nÃ£o configurada no servidor.');

  var base64 = buffer.toString('base64');
  var isExtrato = (tipo === 'extrato');
  var prompt = isExtrato ? [
    'VocÃª estÃ¡ analisando um extrato de conta corrente/bancÃ¡ria brasileiro.',
    'TAREFA 1 â€” Extraia TODAS as movimentaÃ§Ãµes: dÃ©bitos (saÃ­das: Pix enviado, pagamentos, compras no dÃ©bito, transferÃªncias enviadas, tarifas) E crÃ©ditos (entradas: Pix recebido, salÃ¡rio, depÃ³sitos, transferÃªncias recebidas, rendimentos).',
    'Campo "tipo": "debito" para saÃ­das, "credito" para entradas. valor sempre positivo. data em YYYY-MM-DD.',
    'NÃƒO omita nenhuma transaÃ§Ã£o visÃ­vel no extrato.',
    'TAREFA 2 â€” Procure no documento os totais declarados (ex: "Total entradas", "Total saÃ­das", "Saldo final") e inclua no campo "meta".',
    'Retorne SOMENTE um JSON vÃ¡lido no formato:',
    '{"transacoes":[{"desc":"...","valor":50.00,"data":"2026-04-01","tipo":"debito"}],"meta":{"totalEntradas":4035.65,"totalSaidas":3939.32,"saldoFinal":218.65}}',
    'Se algum campo de meta nÃ£o estiver visÃ­vel no documento, use null. Responda APENAS com o JSON, sem explicaÃ§Ãµes ou markdown.'
  ].join(' ') : [
    'VocÃª estÃ¡ analisando uma IMAGEM de fatura de cartÃ£o de crÃ©dito brasileiro.',
    'LEIA A IMAGEM LINHA POR LINHA, do topo ao final. Cada linha com data + descriÃ§Ã£o + valor = UMA transaÃ§Ã£o no JSON.',
    'REGRA CRÃTICA â€” FIDELIDADE: copie o valor EXATAMENTE como escrito na imagem (ex: R$ 150,00 â†’ 150.00). NÃƒO arredonde, NÃƒO some, NÃƒO invente valores.',
    'REGRA CRÃTICA â€” COMPLETUDE: inclua TODAS as linhas de compra visÃ­veis, sem pular nenhuma, mesmo que pareÃ§am repetidas ou tenham valores similares.',
    'REGRA CRÃTICA â€” SEM DUPLICATAS: cada linha da imagem gera EXATAMENTE UMA entrada no JSON. NÃƒO duplique nenhuma linha.',
    'INCLUA: compras Ã  vista, parcelas (ex: "Cobasi 1/2" â†’ inclua sÃ³ a parcela visÃ­vel, nÃ£o invente as demais), IOF embutido em compras internacionais, anuidade, ajustes a dÃ©bito.',
    'INCLUA ESTORNOS com valor NEGATIVO (ex: "Estorno de Uber" â†’ valor: -11.93). Eles compensam compras e fazem parte da soma final.',
    'IGNORE ESTRITAMENTE: linhas de "Pagamento recebido", "Pagamento em DD MMM", subtotais de seÃ§Ã£o (ex: "Outros lanÃ§amentos R$ X", "Total de compras R$ X"), nome de portador seguido de valor sem data, saldos, cabeÃ§alhos, rodapÃ©s, tarifas standalone como "CUSTO TRANS. EXTERIOR-IOF", "IOF OPERACAO", "ENCARGO FINANCEIRO", "TARIFA BANCARIA", "JUROS ROTATIVO".',
    'TAREFA EXTRA: capture em "meta": "totalCompras" ("Total de compras") e "totalAPagar" ("Pagamento total" ou "Total a pagar").',
    'Formato de resposta â€” SOMENTE este JSON, sem markdown, sem explicaÃ§Ã£o:',
    '{"transacoes":[{"desc":"nome exato do estabelecimento","valor":50.00,"data":"2026-04-01"}],"meta":{"totalCompras":908.47,"totalAPagar":1242.36}}',
    'Regras: valor Ã© float, negativo para estornos/crÃ©ditos. data em YYYY-MM-DD. Se data ilegÃ­vel use "2000-01-01".',
    'Se nÃ£o houver transaÃ§Ãµes visÃ­veis: {"transacoes":[],"meta":null}'
  ].join(' ');

  return aiReader.readImage(buffer, mimeType, prompt, 'transacoes');
}

async function requireAuthenticatedUser(req, res, next) {
  var decoded = await getBearerUser(req, res);
  if (!decoded) return;
  req.budUser = decoded;
  next();
}
app.post('/api/security/revoke-sessions', requireAuthenticatedUser, revokeSessions({ auth, db }));
app.post('/api/financial/write', requireAuthenticatedUser, createFinancialWrite({ db, admin }));
app.get('/api/ia/jobs/:id', aiJobs.poll);
const accountLifecycle=createAccountLifecycle({authenticate:getBearerUser,auth,db,fieldValue:admin.firestore.FieldValue,emulator:process.env.BUD_USE_EMULATOR==='true'});
app.delete('/api/account',accountLifecycle.handler);
let securityMaintenanceRunning=false;
async function maintainSecurity(){if(!db||securityMaintenanceRunning)return;securityMaintenanceRunning=true;try{const result=await accountLifecycle.resume();await pruneSecurityLimits(db);if(result.failures)console.warn('[Segurança] Exclusão pendente será retomada.');}catch(_){console.warn('[Segurança] Manutenção pendente será retomada.');}finally{securityMaintenanceRunning=false;}}
const securityTimer=setInterval(maintainSecurity,60_000);securityTimer.unref?.();setImmediate(maintainSecurity);
app.post('/api/extrair-fatura', requireAuthenticatedUser, upload.single('arquivo'), aiJobs.wrap(async function (req, res) {
  try {
    try {
      await verificarQuotaIA(req.budUser.uid);
    } catch (quotaErr) {
      return res.status(quotaErr.status || 500).json({ error: quotaErr.message || 'Não foi possível verificar sua cota.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    var buffer   = req.file.buffer;
    var mimeType = req.file.mimetype;
    var tipo     = req.body.tipo || 'extrato';
    var transacoes = [];
    var aiMeta = null;
    var textMeta = null;
    var aiFailureMessage = '';

    if (mimeType === 'application/pdf') {
      // â”€â”€ 1) Extrair texto do PDF com pdf-parse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      var pdfData;
      var pdfPages;
      try {
        pdfPages = await readPDF(buffer);
        pdfData = { text: pdfPages.map(p => p.text || '').join('\n') };
      } catch (pdfErr) {
        // PDF ilegÃ­vel ou criptografado â€” retornar erro direto (visÃ£o IA nÃ£o lÃª PDFs binÃ¡rios)
        return res.status(422).json({
          error: 'NÃ£o foi possÃ­vel ler o PDF. O arquivo pode estar protegido por senha ou corrompido. Tente exportar o extrato como imagem ou use um arquivo OFX.'
        });
      }

      if (pdfData) {
        // â”€â”€ 2) Extrair meta do texto e preparar transaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€
        textMeta = extractMetaFromText(pdfData.text || '');
        const directInvoice = tipo === 'fatura' && pdfPages.every(page => page.text)
          ? readNubankInvoice(pdfData.text) : null;
        if (directInvoice) {
          await incrementarQuotaIA(req.budUser.uid);
          return res.json(directInvoice);
        }

        // Fatura de cartÃ£o: parseBankStatementText Ã© para extratos bancÃ¡rios
        // Para faturas, vai sempre para IA (mais preciso e evita garbage)
        if (tipo !== 'fatura') {
          transacoes = parseBankStatementText(pdfData.text || '');
        }

        // â”€â”€ 3) IA texto-mode se necessÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var parserScore = captureScore(transacoes, textMeta);
        var precisaIA = tipo === 'fatura' ||
          (transacoes.length < 2) ||
          (parserScore !== null && parserScore < 0.90);

        if (tipo === 'fatura' && !process.env.GROQ_API_KEY) {
          return res.status(503).json({
            error: 'A leitura de fatura por IA não está configurada no backend local. Adicione GROQ_API_KEY ao arquivo backend/.env.local e reinicie o backend.'
          });
        }

        if (precisaIA && process.env.GROQ_API_KEY && pdfData.text) {
          try {
            var aiTextResult = await extractWithAIFromText(pdfData.text, tipo);
            if (!aiMeta && aiTextResult.meta) aiMeta = aiTextResult.meta;
            // O texto do PDF é a fonte autoritativa quando encontrou o total
            // explícito da fatura; a IA pode confundir ofertas de parcelamento
            // próximas do campo "Total a pagar" com o valor cobrado.
            var bestMeta = aiMeta || textMeta;
            if (textMeta && textMeta.totalAPagar > 0) {
              bestMeta = Object.assign({}, bestMeta || {}, { totalAPagar: textMeta.totalAPagar });
              aiMeta = Object.assign({}, aiMeta || {}, { totalAPagar: textMeta.totalAPagar });
            }
            var aiScore     = captureScore(aiTextResult.transacoes, bestMeta);
            var parserScore2 = captureScore(transacoes, bestMeta);
            // Adota IA se capturou mais transaÃ§Ãµes ou se score Ã© maior
            if (aiTextResult.transacoes.length > transacoes.length ||
                (aiScore !== null && (parserScore2 === null || aiScore > parserScore2))) {
              transacoes = aiTextResult.transacoes;
            }
          } catch (_aiErr) {
            aiFailureMessage = String(_aiErr && _aiErr.message || 'Falha desconhecida na IA');
            console.warn('[AI text-mode falhou]', _aiErr.message);
            // Se a IA era necessária, não devolver o resultado parcial do parser.
            throw _aiErr;
          }
        }

        for (const page of pdfPages.filter(p => p.image)) {
          const scanned = await extractWithAI(page.image, 'image/png', tipo);
          transacoes.push(...scanned.transacoes);
          aiMeta = Object.assign({}, aiMeta || {}, scanned.meta || {});
        }
      }

    } else {
      // â”€â”€ Imagem: IA-visÃ£o obrigatÃ³ria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({
          error: 'ExtraÃ§Ã£o de imagens requer configuraÃ§Ã£o do servidor (GROQ_API_KEY). Use PDF ou OFX.'
        });
      }
      var imgResult = await extractWithAI(buffer, mimeType, tipo);
      transacoes = imgResult.transacoes;
      aiMeta = imgResult.meta;
    }

    if (!transacoes || transacoes.length === 0) {
      if (aiFailureMessage) {
        return res.status(502).json({
          error: aiFailureMessage === AI_OUTPUT_LIMIT_MESSAGE ? AI_OUTPUT_LIMIT_MESSAGE : 'O serviço de IA não conseguiu analisar o arquivo.',
          detail: aiFailureMessage.replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 500)
        });
      }
      return res.status(422).json({
        error: 'Nenhuma transaÃ§Ã£o encontrada. Verifique se o arquivo Ã© um extrato vÃ¡lido e tente novamente.'
      });
    }

    var meta = aiMeta || textMeta || null;
    await incrementarQuotaIA(req.budUser.uid);
    return res.json({ transacoes: transacoes, meta: meta });

  } catch (err) {
    if (err.code === 'PLAN_LIMIT') return res.status(403).json({error:err.message,code:err.code});
    if (err.code === 'AI_OUTPUT_LIMIT') return res.status(502).json({ error: AI_OUTPUT_LIMIT_MESSAGE });
    if (err.code === 'AI_RATE_LIMIT') return res.status(503).json({ error: err.message, code: err.code });
    if (err.name === 'TimeoutError') return res.status(504).json({ error: 'O provedor de IA não respondeu a tempo. Tente novamente.', code: 'AI_TIMEOUT' });
    var safeMsg = (err.message || '').replace(/(key=)[^\s&]+/, '$1***');
    console.error('[extrair-fatura]', safeMsg);
    return res.status(500).json({ error: 'Erro ao processar arquivo. Tente novamente.' });
  }
}, 'invoice'));

// â”€â”€â”€ Cache em memÃ³ria de extraÃ§Ã£o de cupom (24h) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Chave: SHA-256 do buffer de cada arquivo combinado.
// Reduz custo Gemini quando o usuÃ¡rio re-envia o mesmo print.
var cupomCache = new Map();
var CUPOM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
var CUPOM_CACHE_MAX = 200;

function cupomCacheGet(key) {
  var entry = cupomCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CUPOM_CACHE_TTL) {
    cupomCache.delete(key);
    return null;
  }
  return entry.v;
}
function cupomCacheSet(key, value) {
  if (cupomCache.size >= CUPOM_CACHE_MAX) {
    // Remove a chave mais antiga (FIFO simples)
    var firstKey = cupomCache.keys().next().value;
    if (firstKey) cupomCache.delete(firstKey);
  }
  cupomCache.set(key, { t: Date.now(), v: value });
}
function hashBuffers(buffers) {
  var h = crypto.createHash('sha256');
  for (var i = 0; i < buffers.length; i++) h.update(buffers[i]);
  return h.digest('hex');
}

var CUPOM_CATEGORIAS = ['Mercado', 'Padaria/Caf\u00e9', 'Bares/Baladas', 'Farm\u00e1cia', 'Pet', 'Material Escolar', 'Outros'];
function normalizeCupomCategory(value) {
  var cat = String(value || 'Mercado').trim();
  if (cat === 'Pets') cat = 'Pet';
  if (cat === 'Padaria/CafÃ©') cat = 'Padaria/Caf\u00e9';
  if (cat === 'FarmÃ¡cia') cat = 'Farm\u00e1cia';
  return CUPOM_CATEGORIAS.includes(cat) ? cat : 'Outros';
}

/**
 * Extrai itens de cupom fiscal / print de app de mercado usando Groq Vision.
 * Aceita 1 a 3 arquivos (multi-foto para cupom longo).
 * Retorna: { mercado, cnpj, data, itens: [{nome, qtd, valor, cat}] }
 */
async function extractCupomWithGroq(buffers, mimeTypes) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY nÃ£o configurada no servidor.');

  var prompt = [
    'VocÃª estÃ¡ analisando um CUPOM FISCAL NFC-e de supermercado brasileiro OU um PRINT de app de mercado/delivery (Rappi, iFood, ZÃ© Delivery, Cornershop).',
    '',
    'ESTRUTURA DO CUPOM FISCAL NFC-e: cada item ocupa DUAS linhas:',
    '  Linha 1: ITEM(3 dÃ­gitos) CODIGO DESCRICAO UN',
    '  Linha 2: QTD UN x VL.UNIT  VL.TOTAL  (ou sÃ³ "UN  VL.TOTAL" quando qtd=1)',
    '"valor" = VL.TOTAL (Ãºltimo nÃºmero da linha 2). NUNCA use VL.UNIT.',
    'Quando a linha 2 mostra apenas "UN  14,99" sem "x", significa qtd=1 e valor=14.99.',
    '',
    'REGRA CRÃTICA â€” COMPLETUDE: leia do TOPO ao FIM. Cada nÃºmero 001/002/003... Ã© um item DISTINTO. Conte quantos nÃºmeros de item existem e garanta que o JSON tenha EXATAMENTE a mesma quantidade.',
    'REGRA CRÃTICA â€” FIDELIDADE: copie o VL.TOTAL EXATAMENTE. NÃƒO arredonde, NÃƒO recalcule.',
    'REGRA CRÃTICA â€” NOMES: copie a DESCRICAO EXATAMENTE como aparece (abreviaÃ§Ãµes incluÃ­das). NUNCA substitua por outro nome. "FILTR PAP MELIT" â†’ "FILTR PAP MELIT", nÃ£o "FeijÃ£o". "SACOLA PLAST TRANS" â†’ "SACOLA PLAST TRANS", nÃ£o "Salada". MÃ¡ximo 60 chars.',
    'REGRA CRÃTICA â€” NUNCA INVENTE: se nÃ£o conseguir ler, copie o que conseguir. JAMAIS substitua por produto diferente.',
    '',
    'Extraia TAMBÃ‰M: nome curto do mercado/loja (ex: "Prezunic"), CNPJ (14 dÃ­gitos, se visÃ­vel), data (YYYY-MM-DD).',
    'IGNORE: subtotais, total a pagar, formas de pagamento, troco, descontos.',
    'Se houver MÃšLTIPLAS imagens, CONSOLIDE num Ãºnico array.',
    '',
    'Categorias: "Mercado" (alimentos, hortifrÃºti, carnes, laticÃ­nios), "Padaria/CafÃ©" (pÃ£es, bolos, cafÃ©), "Bares/Baladas" (bebidas alcoÃ³licas, refrigerantes), "FarmÃ¡cia" (higiene, medicamentos, limpeza), "Pet" (raÃ§Ã£o, areia), "Material Escolar", "Outros" (sacolas, embalagens, demais).',
    '',
    'Exemplo NFC-e (2 itens):',
    '  005 7896982103388 OVGS MANT GDE C/20 UN â†’ { "nome":"OVGS MANT GDE C/20", "qtd":1, "valor":14.99, "cat":"Mercado" }',
    '  006 7896016500978 FARINH MAND GRANFI UN â†’ 4.000 UN x 6.99  27.96 â†’ { "nome":"FARINH MAND GRANFI", "qtd":4, "valor":27.96, "cat":"Mercado" }',
    '',
    'Retorne SOMENTE JSON (sem markdown):',
    '{"mercado":"Prezunic","cnpj":"12345678000199","data":"2026-04-25","itens":[{"nome":"LAMEN MIOJO 85G","qtd":4,"valor":12.76,"cat":"Mercado"}]}',
    'Se nÃ£o houver itens: {"mercado":"","cnpj":"","data":"","itens":[]}'
  ].join('\n');

  const parts = [];
  for (let i = 0; i < buffers.length; i++) parts.push(await aiReader.readImage(buffers[i], mimeTypes[i], prompt, 'itens'));
  return normalizeCupomResult(aiReader.merge(parts, 'itens'));
}

/**
 * Extrai itens de TEXTO COLADO (cupom digitado/copiado) usando Groq.
 * Mais barato e rÃ¡pido que enviar imagem.
 */
async function extractCupomFromText(texto) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY nÃ£o configurada no servidor.');

  var systemPrompt = 'VocÃª Ã© um extrator preciso de cupons fiscais e prints de apps de mercado/delivery brasileiros. Extraia TODOS os itens e cobranÃ§as. NUNCA invente valores. Retorne APENAS JSON vÃ¡lido.';

  var userPrompt = [
    'Extraia TODOS os itens e cobranÃ§as do texto abaixo: produtos, taxa de entrega, embalagem, serviÃ§o â€” qualquer linha com valor cobrado.',
    'IGNORE APENAS: subtotais, total a pagar, formas de pagamento, troco e descontos.',
    'Identifique tambÃ©m: nome do mercado, CNPJ (14 dÃ­gitos, apenas nÃºmeros), data (YYYY-MM-DD).',
    'Categorias: "Mercado", "Padaria/CafÃ©", "Bares/Baladas", "FarmÃ¡cia", "Pet", "Material Escolar", "Outros".',
    '"valor" = valor total do item (float positivo). "qtd" = quantidade (1 se desconhecido). "nome" atÃ© 50 chars.',
    'Formato obrigatÃ³rio: {"mercado":"...","cnpj":"...","data":"...","itens":[{"nome":"...","qtd":1,"valor":0.00,"cat":"Mercado"}]}',
    '',
    'TEXTO DO CUPOM:',
    '"""',
    '', // O texto completo é enviado em trechos por aiReader.readText.
    '"""'
  ].join('\n');

  return normalizeCupomResult(await aiReader.readText(texto, systemPrompt + '\n' + userPrompt.split('TEXTO DO CUPOM:')[0], 'itens'));
}

function normalizeCupomResult(parsed) {
  parsed.itens = (parsed.itens || []).map(i => ({
    nome: String(i.nome || i.name || i.descricao || '').trim().slice(0, 60),
    qtd: Number(String(i.qtd || i.quantidade || 1).replace(',', '.')) || 1,
    valor: Math.abs(Number(String(i.valor || i.value || i.total || 0).replace(',', '.')) || 0),
    cat: normalizeCupomCategory(i.cat || i.categoria || 'Mercado')
  })).filter(i => i.nome && i.valor > 0);
  parsed.mercado = String(parsed.mercado || '').slice(0, 60);
  parsed.cnpj = String(parsed.cnpj || '').replace(/\D/g, '').slice(0, 14);
  parsed.data = String(parsed.data || '').slice(0, 10);
  return parsed;
}

var uploadCupom = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3, fields: 16, fieldSize: 65536, parts: 19, headerPairs: 100 }, // Same upload limit advertised by Compras.
  fileFilter: function (_req, file, cb) {
    var ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (ok.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato nÃ£o suportado. Use PDF, JPEG, PNG ou WEBP.'));
  }
});

// â”€â”€â”€ POST /api/extrair-cupom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Aceita:
//   - multipart/form-data { arquivos: 1-3 files (image|pdf) }
//   - application/json     { texto: "..." } para colar texto direto
// Retorna: { mercado, cnpj, data, itens:[{nome,qtd,valor,cat}], cached?: true }
// Cota única mensal para todo processamento inteligente (cupom e fatura).
var IA_LIMITES_CUPOM = { free: 0, starter: 0, trial: Infinity, pro: 5, plus: Infinity };

async function verificarQuotaIA(uid) {
  if (currentJob()?.uid === uid && currentJob().quotaApplied) return;
  if (!db) throw Object.assign(new Error('Serviço indisponível.'), {status:503}); // Firebase nÃ£o iniciado â€” permite (degrada gracefully)
  var anoMes = planPolicy.month();
  var userDoc = await db.collection('usuarios').doc(uid).get();
  var plano = userDoc.exists ? _effectivePlan(userDoc.data()) : 'free';
  var limite = Object.prototype.hasOwnProperty.call(IA_LIMITES_CUPOM, plano)
    ? IA_LIMITES_CUPOM[plano]
    : IA_LIMITES_CUPOM.free;
  if (limite === Infinity) return; // ilimitado
  var usoSnap = await db.collection('usuarios').doc(uid).collection('uso-ia').doc(anoMes).get();
  var usoData = usoSnap.exists ? (usoSnap.data() || {}) : {};
  // "mercado" é mantido durante a migração para não quebrar o indicador atual.
  var uso = Number(usoData.processamentos || usoData.mercado || 0);
  if (uso >= limite) {
    var err = new Error('Limite mensal de processamentos inteligentes atingido. FaÃ§a upgrade para continuar.');
    err.status = 429;
    throw err;
  }
}

async function incrementarQuotaIA(uid) {
  if (!db) throw Object.assign(new Error('Serviço indisponível.'), {status:503});
  const userRef = db.collection('usuarios').doc(uid);
  const quotaRef = userRef.collection('uso-ia').doc(planPolicy.month());
  const job = currentJob();
  await db.runTransaction(async transaction => {
    const jobRef = job?.documentPath && job.uid === uid ? db.doc(job.documentPath) : null;
    const [userSnap, quotaSnap, jobSnap] = await Promise.all([transaction.get(userRef), transaction.get(quotaRef), jobRef ? transaction.get(jobRef) : null]);
    if (jobRef && (!jobSnap.exists || jobSnap.data().owner !== job.owner)) throw new Error('Job lease changed');
    if (jobSnap?.data()?.quotaApplied) return;
    const cap = planPolicy.limits(userSnap.exists ? userSnap.data() : {}).ai;
    const usage = quotaSnap.exists ? Number(quotaSnap.data().processamentos || quotaSnap.data().mercado || 0) : 0;
    planPolicy.assertLimit(usage, 1, cap, 'serviços de IA por mês');
    transaction.set(quotaRef, {processamentos:usage+1,mercado:usage+1}, {merge:true});
    if (jobRef) transaction.update(jobRef,{quotaApplied:true});
  });
  if (job?.uid === uid) job.quotaApplied = true;
}

app.post('/api/extrair-cupom', requireAuthenticatedUser, function parseReceiptFiles(req, res, next) {
  uploadCupom.array('arquivos', 3)(req, res, function (multerErr) {
  if (multerErr) {
    var msg = multerErr.code === 'LIMIT_FILE_SIZE'
      ? 'Arquivo muito grande. Máximo 8MB por arquivo.'
      : multerErr.message || 'Erro ao processar arquivo.';
    return res.status(413).json({ error: msg });
  }
    next();
  });
}, aiJobs.wrap(async function (req, res) {
  try {
    var cupomUid = req.budUser.uid;
    await verificarQuotaIA(cupomUid);

    // Modo TEXTO (sem arquivos)
    if (req.is('application/json') || (req.body && req.body.texto && (!req.files || req.files.length === 0))) {
      var texto = String(req.body.texto || '').trim();
      if (!texto || texto.length < 20) {
        return res.status(400).json({ error: 'Texto vazio ou muito curto.' });
      }
      var resultText = await extractCupomFromText(texto);
      if (!resultText.itens.length) {
        return res.status(422).json({ error: 'Nenhum item encontrado no texto.' });
      }
      if (cupomUid) await incrementarQuotaIA(cupomUid);
      return res.json(resultText);
    }

    // Modo ARQUIVOS
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'ExtraÃ§Ã£o por IA nÃ£o estÃ¡ configurada no servidor. Use a entrada manual.'
      });
    }

    var buffers = req.files.map(function (f) { return f.buffer; });
    var mimeTypes = req.files.map(function (f) { return f.mimetype; });

    // Cache 24h por hash dos buffers
    var cacheKey = hashBuffers(buffers);
    var cached = cupomCacheGet(cacheKey);
    if (cached) {
      return res.json(Object.assign({}, cached, { cached: true }));
    }

    // â”€â”€ PDFs: extrair texto com pdf-parse â†’ enviar como texto (Groq vision nÃ£o aceita PDF) â”€â”€
    var hasPdf = mimeTypes.some(m => m === 'application/pdf');
    if (hasPdf) {
      const parts = [];
      for (let i = 0; i < buffers.length; i++) {
        if (mimeTypes[i] === 'application/pdf') {
          const pages = await readPDF(buffers[i]);
          const text = pages.map(p => p.text || '').join('\n');
          if (text.trim()) parts.push(await extractCupomFromText(text));
          for (const page of pages.filter(p => p.image)) parts.push(await extractCupomWithGroq([page.image], ['image/png']));
        } else parts.push(await extractCupomWithGroq([buffers[i]], [mimeTypes[i]]));
      }
      const resultPdf = normalizeCupomResult(aiReader.merge(parts, 'itens'));
      cupomCacheSet(cacheKey, resultPdf);
      await incrementarQuotaIA(cupomUid);
      return res.json(resultPdf);
    }

    var result = await extractCupomWithGroq(buffers, mimeTypes);

    cupomCacheSet(cacheKey, result);
    if (cupomUid) await incrementarQuotaIA(cupomUid);
    return res.json(result);

  } catch (err) {
    if (err.code === 'PLAN_LIMIT') return res.status(403).json({error:err.message,code:err.code});
    if (err.code === 'AI_OUTPUT_LIMIT') return res.status(502).json({ error: AI_OUTPUT_LIMIT_MESSAGE });
    var safeMsg = (err.message || '').replace(/(key=)[^\s&]+/, '$1***');
    if (err.status === 429) return res.status(429).json({ error: err.message });
    if (err.code === 'AI_RATE_LIMIT') return res.status(503).json({ error: err.message, code: err.code });
    console.error('[extrair-cupom]', safeMsg);
    var isGroqErr = /Groq API/.test(safeMsg);
    var status = isGroqErr ? 502 : 500;
    var userMsg = safeMsg.includes('aborted')
      ? 'Tempo limite excedido. Tente uma imagem menor ou use a aba Texto.'
      : 'Erro ao processar cupom. Verifique a imagem e tente novamente.';
    return res.status(status).json({ error: userMsg });
  }
}, 'receipt'));

// â”€â”€â”€ POST /api/analisar-documento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PEND-063: Classifica automaticamente documentos financeiros (contrato de
// emprÃ©stimo, boleto, fatura de cartÃ£o, extrato bancÃ¡rio, investimento etc.)
// sem exigir que o usuÃ¡rio identifique o tipo manualmente.
// Aceita PDF e imagens. Retorna { ok, tipo, confianca, dados }.
app.post('/api/analisar-documento', requireAuthenticatedUser, upload.single('arquivo'), aiJobs.wrap(async function (req, res) {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Arquivo nÃ£o enviado.' });

  var GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  if (!GROQ_API_KEY) return res.status(503).json({ ok: false, error: 'ServiÃ§o de IA nÃ£o configurado.' });

  var buffer = req.file.buffer;
  var mime   = req.file.mimetype;

  try {
    var textoPDF = '';
    var imageB64 = null;

    if (mime === 'application/pdf') {
      try {
        var pdfResult = await pdfParse(new Uint8Array(buffer), { max: 3, version: 'v2.0.550' });
        textoPDF = (pdfResult.text || '').substring(0, 6000).trim();
      } catch (_pdfErr) {
        textoPDF = '';
      }
    } else {
      imageB64 = buffer.toString('base64');
    }

    // Monta prompt de classificaÃ§Ã£o
    var USER_PROMPT =
      (textoPDF
        ? ('Texto extraÃ­do do documento:\n\n' + textoPDF)
        : 'Documento financeiro fornecido como imagem. Analise o conteÃºdo visÃ­vel.'
      ) +
      '\n\nIdentifique o tipo do documento financeiro e extraia os campos relevantes.' +
      '\nResponda APENAS com JSON vÃ¡lido, sem markdown, neste formato exato:\n' +
      '{\n' +
      '  "tipo": "<emprestimo|fatura_cartao|extrato_bancario|cupom_fiscal|boleto|contrato_investimento|outro>",\n' +
      '  "confianca": <0 a 100>,\n' +
      '  "dados": {\n' +
      '    // emprestimo: credor(string), valorParcela(number), nParcelas(number), taxa(number), vencimento("YYYY-MM-DD"), totalFinanciado(number), tipoEmprestimo(string)\n' +
      '    // boleto: credor(string), valor(number), vencimento("YYYY-MM-DD"), banco(string)\n' +
      '    // contrato_investimento: produto(string), emissor(string), valor(number), vencimento("YYYY-MM-DD"), taxa(number)\n' +
      '    // outro: descricao(string)\n' +
      '    // fatura_cartao | extrato_bancario | cupom_fiscal: {}\n' +
      '  }\n' +
      '}';

    var messages = [];
    if (imageB64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + imageB64 } },
          { type: 'text', text: USER_PROMPT }
        ]
      });
    } else {
      messages.push({ role: 'user', content: USER_PROMPT });
    }

    var modelName = GROQ_MODEL;

    var aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model:           modelName,
        reasoning_effort: 'none',
        messages:        [
          { role: 'system', content: 'VocÃª Ã© especialista em documentos financeiros brasileiros. Retorne APENAS JSON vÃ¡lido, sem markdown, sem explicaÃ§Ãµes.' },
          ...messages
        ],
        temperature:     0,
        max_tokens: Math.min(600, GROQ_MAX_OUTPUT_TOKENS),
        response_format: { type: 'json_object' }
      })
    });

    if (!aiResp.ok) {
      console.error('[analisar-documento] Groq HTTP', aiResp.status);
      return res.status(502).json({ ok: false, error: 'Erro ao analisar documento.' });
    }

    var aiJson = await aiResp.json();
    ensureCompleteAIResponse(aiJson);
    var rawContent = ((aiJson.choices || [])[0] || {});
    var rawText = (rawContent.message && rawContent.message.content || '').trim();

    var resultado;
    try { resultado = JSON.parse(rawText); }
    catch (_je) { return res.status(502).json({ ok: false, error: 'Resposta da IA invÃ¡lida.' }); }

    // Sanitizar e validar campos
    var TIPOS_VALIDOS = ['emprestimo','fatura_cartao','extrato_bancario','cupom_fiscal','boleto','contrato_investimento','outro'];
    var tipo = sanitizeStr(String(resultado.tipo || '')).toLowerCase();
    if (!TIPOS_VALIDOS.includes(tipo)) tipo = 'outro';
    var confianca = Math.max(0, Math.min(100, Number(resultado.confianca) || 0));
    var rawDados = resultado.dados || {};
    var dados = {};

    function validDate(s) {
      return (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) ? s : null;
    }

    if (tipo === 'emprestimo') {
      dados.credor          = sanitizeStr(String(rawDados.credor          || '')).substring(0, 100);
      dados.valorParcela    = Math.max(0, Number(rawDados.valorParcela)    || 0);
      dados.nParcelas       = Math.max(0, Math.floor(Number(rawDados.nParcelas) || 0));
      dados.taxa            = Math.max(0, Number(rawDados.taxa)            || 0);
      dados.totalFinanciado = Math.max(0, Number(rawDados.totalFinanciado) || 0);
      dados.tipoEmprestimo  = sanitizeStr(String(rawDados.tipoEmprestimo  || '')).substring(0, 80);
      dados.vencimento      = validDate(rawDados.vencimento);
    } else if (tipo === 'boleto') {
      dados.credor     = sanitizeStr(String(rawDados.credor  || '')).substring(0, 100);
      dados.valor      = Math.max(0, Number(rawDados.valor)  || 0);
      dados.banco      = sanitizeStr(String(rawDados.banco   || '')).substring(0, 80);
      dados.vencimento = validDate(rawDados.vencimento);
    } else if (tipo === 'contrato_investimento') {
      dados.produto    = sanitizeStr(String(rawDados.produto  || '')).substring(0, 100);
      dados.emissor    = sanitizeStr(String(rawDados.emissor  || '')).substring(0, 100);
      dados.valor      = Math.max(0, Number(rawDados.valor)   || 0);
      dados.taxa       = Math.max(0, Number(rawDados.taxa)    || 0);
      dados.vencimento = validDate(rawDados.vencimento);
    } else if (tipo === 'outro') {
      dados.descricao  = sanitizeStr(String(rawDados.descricao || '')).substring(0, 200);
    }

    return res.json({ ok: true, tipo, confianca, dados });

  } catch (e) {
    if (e.code === 'AI_OUTPUT_LIMIT') return res.status(502).json({ ok: false, error: AI_OUTPUT_LIMIT_MESSAGE });
    console.error('[analisar-documento]', e.message);
    return res.status(500).json({ ok: false, error: 'Erro interno ao processar documento.' });
  }
}, 'document'));

// â”€â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/', function (_req, res) {
  res.json({ status: 'ok', service: 'bud-finance-backend' });
});

// â”€â”€â”€ POST /api/processar-recorrentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LanÃ§a transaÃ§Ãµes de recorrentes cujo diaVencimento coincide com hoje (fuso BrasÃ­lia).
// AutenticaÃ§Ã£o: Bearer token do Firebase ID verificado server-side (anti-IDOR).
// IdempotÃªncia: antes de criar, verifica se jÃ¡ existe transaÃ§Ã£o com
//   recorrenteId === id AND mesReferencia === YYYY-MM do mÃªs atual.
app.post('/api/processar-recorrentes', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });
  }

  // â”€â”€ AutenticaÃ§Ã£o via Bearer token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: 'Token de autenticaÃ§Ã£o ausente.' });
  }

  var decoded;
  try {
    decoded = await auth.verifyIdToken(idToken,true);
  } catch (_e) {
    return res.status(401).json({ error: 'Token invÃ¡lido ou expirado.' });
  }
  var uid = decoded.uid;

  // â”€â”€ Gate por plano (server-side â€” PEND-034) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var PLANOS_PERMITIDOS_REC = ['pro', 'plus', 'trial'];
  try {
    var userDoc = await db.collection('usuarios').doc(uid).get();
    var plano = userDoc.exists ? _effectivePlan(userDoc.data()) : 'free';
    if (!PLANOS_PERMITIDOS_REC.includes(plano)) {
      return res.status(403).json({ error: 'Recurso disponÃ­vel apenas nos planos Pro, Plus e Trial.' });
    }
  } catch (_e) {
    return res.status(500).json({ error: 'Erro ao verificar plano do usuÃ¡rio.' });
  }

  // â”€â”€ Fuso horÃ¡rio BrasÃ­lia (UTC-3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  var hojeAno  = agora.getFullYear();
  var hojeMes  = agora.getMonth() + 1;           // 1â€“12
  var hojeDia  = agora.getDate();
  var mesRef   = hojeAno + '-' + String(hojeMes).padStart(2, '0'); // "YYYY-MM"

  try {
    // Buscar recorrentes ativas
    var snapRec = await db
      .collection('usuarios').doc(uid).collection('recorrentes')
      .where('ativa', '==', true)
      .get();

    if (snapRec.empty) {
      return res.json({ success: true, processadas: 0, mensagem: 'Nenhuma recorrente ativa.' });
    }

    var recorrentes = snapRec.docs.map(function (d) {
      return Object.assign({ id: d.id }, d.data());
    });

    // Filtrar pelo dia de vencimento = hoje
    var paraProcessar = recorrentes.filter(function (rec) {
      var dia = parseInt(rec.diaVencimento, 10) || 1;
      if (rec.periodicidade === 'diaria') return true;
      if (rec.periodicidade === 'semanal') {
        // Disparar a cada 7 dias a partir da proximaData
        if (!rec.proximaData) return false;
        var proxDate = rec.proximaData.toDate ? rec.proximaData.toDate() : new Date(rec.proximaData);
        var diffDias = Math.round((agora - proxDate) / (1000 * 60 * 60 * 24));
        // Se o app/servidor ficou indisponível no dia exato, cria a pendência
        // na primeira execução posterior; a checagem anti-duplicidade abaixo
        // garante apenas uma pendência por competência.
        return diffDias >= 0;
      }
      // mensal: clamp ao Ãºltimo dia do mÃªs
      var maxDia = new Date(hojeAno, hojeMes, 0).getDate();
      // Não perder a confirmação se o usuário abrir o app após o vencimento.
      return Math.min(dia, maxDia) <= hojeDia;
    });

    if (paraProcessar.length === 0) {
      return res.json({ success: true, processadas: 0, mensagem: 'Nenhuma recorrente vence hoje.' });
    }

    // Recorrências são previsões, não comprovantes de pagamento/recebimento.
    // No vencimento criamos uma pendência. O saldo só muda quando o usuário
    // confirma o valor, a data e a conta reais na Dashboard.
    // Anti-duplicidade: uma pendência ou lançamento confirmado já existente
    // para a mesma recorrência/competência impede uma nova criação.
    var snapTx = await db
      .collection('usuarios').doc(uid).collection('transacoes')
      .where('mesReferencia', '==', mesRef)
      .where('origem', '==', 'recorrente')
      .get();

    // Registros de versões antigas podem não ter mesReferencia/origem. Busca
    // também pelo campo data da competência para não repetir esses lançamentos.
    var inicioMes = admin.firestore.Timestamp.fromDate(new Date(hojeAno, hojeMes - 1, 1));
    var inicioProximoMes = admin.firestore.Timestamp.fromDate(new Date(hojeAno, hojeMes, 1));
    var snapLegado = await db
      .collection('usuarios').doc(uid).collection('transacoes')
      .where('data', '>=', inicioMes)
      .where('data', '<', inicioProximoMes)
      .get();
    var docsTx = new Map();
    snapTx.docs.concat(snapLegado.docs).forEach(function (d) { docsTx.set(d.id, d); });

    var jaProcessados = new Set(
      Array.from(docsTx.values()).map(function (d) { return d.data().recorrenteId; }).filter(Boolean)
    );
    // Compatibilidade com lançamentos criados por versões antigas, que não
    // gravavam recorrenteId. Um lançamento confirmado com mesma descrição,
    // tipo e competência já representa aquela recorrência no mês.
    var jaLancadosPorAssinatura = new Set(Array.from(docsTx.values()).map(function (d) {
      var tx = d.data();
      return String(tx.tipo || '') + '|' + String(tx.descricao || '').trim().toLowerCase();
    }));

    var novas = paraProcessar.filter(function (rec) {
      var assinatura = String(rec.tipo || 'despesa') + '|' + String(rec.descricao || '').trim().toLowerCase();
      return !jaProcessados.has(rec.id) && !jaLancadosPorAssinatura.has(assinatura);
    });

    if (novas.length === 0) {
      return res.json({ success: true, processadas: 0, mensagem: 'As recorrências de hoje já estão aguardando sua confirmação.' });
    }

    // Cada pendência exige só uma operação; 400 mantém o lote abaixo do limite.
    var CHUNK = 400;
    var colTx = db.collection('usuarios').doc(uid).collection('transacoes');
    var dataHoje = hojeAno + '-' + String(hojeMes).padStart(2,'0') + '-' + String(hojeDia).padStart(2,'0');
    var timestampHoje = admin.firestore.Timestamp.fromDate(agora);

    for (var ci = 0; ci < novas.length; ci += CHUNK) {
      var chunk = novas.slice(ci, ci + CHUNK);
      var batch = db.batch();
      chunk.forEach(function (rec) {
        var txRef = colTx.doc();
        batch.set(txRef, {
          tipo:           rec.tipo || 'despesa',
          descricao:      sanitizeStr(rec.descricao || '').substring(0, 100),
          valor:          Number(rec.valorPrevisto || rec.valor) || 0,
          valorPrevisto:  Number(rec.valorPrevisto || rec.valor) || 0,
          categoria:      sanitizeStr(rec.categoria || 'Outros'),
          // Dashboard, Extrato e relatórios consultam o campo `data`.
          data:           timestampHoje,
          dataReferencia: dataHoje,
          mesReferencia:  mesRef,
          carteiraId:     rec.contaTipo !== 'credito' ? (rec.contaId || null) : null,
          contaId:        rec.contaId || null,
          contaNome:      sanitizeStr(rec.contaNome || ''),
          formaPagamento: rec.cartaoId ? 'CrÃ©dito' : 'DÃ©bito',
          cartaoId:       rec.cartaoId || null,
          recorrenteId:   rec.id,
          origem:         'recorrente',
          recorrente:     true,
          confirmado:     false,
          pago:           false,
          pendenteConfirmacao: true,
          observacao:     sanitizeStr(rec.observacao || ''),
          dataCriacao:    admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    // Registrar Ãºltimo processamento no doc do usuÃ¡rio
    await db.collection('usuarios').doc(uid).update({
      recorrentesUltimoProcessamento: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      processadas: novas.length,
      mensagem: novas.length + ' recorrente' + (novas.length !== 1 ? 's aguardam' : ' aguarda') + ' confirmação na Dashboard.',
      itens: novas.map(function (r) { return { id: r.id, descricao: r.descricao, valor: r.valor }; }),
    });

  } catch (err) {
    console.error('[processar-recorrentes]', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar recorrentes.' });
  }
});

// â”€â”€â”€ POST /api/chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Chat com IA financeiro pessoal via Groq.
// Auth: Bearer Firebase ID Token. Gate: plano plus/trial.
// Rate limit: 30 msg/min por uid (in-memory).
app.post('/api/chat', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });
  }

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token de autenticaÃ§Ã£o ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido ou expirado.' }); }

  var uid = decoded.uid;

  // Gate de plano server-side
  var PLANOS_CHAT = ['plus', 'trial'];
  try {
    var userSnap = await db.collection('usuarios').doc(uid).get();
    var plano = userSnap.exists ? _effectivePlan(userSnap.data()) : 'free';
    if (!PLANOS_CHAT.includes(plano)) {
      return res.status(403).json({ error: 'Assistente IA disponÃ­vel apenas no plano Plus.' });
    }
  } catch (_e) {
    return res.status(500).json({ error: 'Erro ao verificar plano.' });
  }

  // Rate limit por uid: 30 msg/min
  var RL_CHAT_MAX = 30;
  var RL_CHAT_WINDOW = 60 * 1000;
  var rlKey = 'chat_' + uid;
  var rlEntry = rateLimitMap.get(rlKey);
  var now = Date.now();
  if (!rlEntry || now - rlEntry.start > RL_CHAT_WINDOW) {
    rateLimitMap.set(rlKey, { start: now, count: 1 });
  } else {
    rlEntry.count++;
    if (rlEntry.count > RL_CHAT_MAX) {
      return res.status(429).json({ error: 'Limite de 30 mensagens por minuto atingido. Aguarde um momento.' });
    }
  }

  var messages = req.body.messages;
  var contexto = req.body.contexto || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages Ã© obrigatÃ³rio.' });
  }

  var key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'ServiÃ§o de IA nÃ£o configurado.' });

  // System prompt com contexto financeiro + knowledge base do app
  var nome    = sanitizeStr(String(contexto.nome  || 'usuÃ¡rio')).substring(0, 60);
  var mesAno  = sanitizeStr(String(contexto.mesAno || '')).substring(0, 30);
  var r = contexto.resumo || {};
  var oculto  = contexto.valoresOcultos === true;
  var fmtBRL  = function(v) { return 'R$ ' + (Number(v)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtVal  = function(v) { return oculto ? '(valor oculto)' : fmtBRL(v); };

  var hoje = new Date().toISOString().slice(0, 10);

  var systemPrompt = [
    // â”€â”€ REGRAS ABSOLUTAS â€” lidas primeiro pelo modelo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    'âš¡ REGRA ABSOLUTA #1 â€” REGISTRAR TRANSAÃ‡ÃƒO (prioridade mÃ¡xima):',
    'Quando o usuÃ¡rio disser que GASTOU, PAGOU, COMPROU, RECEBEU, GANHOU, TRANSFERIU dinheiro â†’ vocÃª DEVE:',
    '  a) Responder em 1-2 frases curtas confirmando o que entendeu.',
    '  b) Incluir IMEDIATAMENTE ao final da resposta o bloco JSON abaixo. SEM perguntar. SEM pedir permissÃ£o.',
    '[ACTION:TRANSACTION]{"descricao":"descriÃ§Ã£o real do gasto","valor":0.00,"tipo":"despesa","categoria":"Outros","data":"' + hoje + '","conta":"nome exato da conta ou cartÃ£o do usuÃ¡rio, ou vazio se nÃ£o mencionado"}[/ACTION]',
    'ATENÃ‡ÃƒO: o `[/ACTION]` de fechamento Ã© OBRIGATÃ“RIO â€” NUNCA omita. O bloco deve ser o ÃšLTIMO elemento da resposta â€” NÃƒO adicione texto depois do `[/ACTION]`.',
    'PROIBIDO: NÃƒO escreva "posso registrar?", NÃƒO pergunte "quer que eu registre?", NÃƒO diga "registrado" ou "foi salvo" â€” o usuÃ¡rio ainda precisa confirmar no app.',
    'Data de HOJE: ' + hoje + '. Use formato YYYY-MM-DD. NUNCA escreva "[data atual]" ou "[data de hoje]" â€” use a data real.',
    'tipo: "despesa" se gastou/pagou/comprou. "receita" se recebeu/ganhou.',
    'Categorias disponÃ­veis (use SOMENTE estas no campo "categoria" do JSON): ' + (Array.isArray(r.categorias) && r.categorias.length ? r.categorias.join(', ') : 'AlimentaÃ§Ã£o, Transporte, SaÃºde, EducaÃ§Ã£o, Lazer, Moradia, VestuÃ¡rio, Tecnologia, ServiÃ§os, Outros') + '.',
    '',
    'âš¡ REGRA ABSOLUTA #2 â€” CARTÃƒO DE CRÃ‰DITO SEM CADASTRO:',
    (Array.isArray(r.cartoes) && r.cartoes.length === 0) ? 'O usuÃ¡rio NÃƒO tem nenhum cartÃ£o de crÃ©dito cadastrado no app.' : '',
    (Array.isArray(r.cartoes) && r.cartoes.length === 0) ? 'Se o usuÃ¡rio mencionar gasto no "cartÃ£o de crÃ©dito" â†’ NÃƒO emitir [ACTION:TRANSACTION]. Responda informando que ele ainda nÃ£o tem cartÃ£o cadastrado e oriente-o a ir em CartÃµes (menu lateral) > "Adicionar cartÃ£o" para cadastrar antes de registrar gastos. NÃƒO pergunte detalhes do cartÃ£o (limite, saldo, etc.).' : '',
    '',
    'âš¡ REGRA ABSOLUTA #3 â€” CONTA BANCÃRIA SEM CADASTRO:',
    (Array.isArray(r.carteira) && r.carteira.length === 0) ? 'O usuÃ¡rio NÃƒO tem nenhuma conta bancÃ¡ria cadastrada na Carteira.' : '',
    (Array.isArray(r.carteira) && r.carteira.length === 0) ? 'Se o usuÃ¡rio mencionar gasto em conta bancÃ¡ria e nÃ£o hÃ¡ contas â†’ pode registrar a transaÃ§Ã£o sem vincular conta (deixe "conta" vazio no JSON), mas avise que ele pode cadastrar uma conta em Carteira para controle completo.' : '',
    '',
    'âš¡ REGRA ABSOLUTA #4 â€” METAS SEM CADASTRO:',
    (r.metas === 0) ? 'O usuÃ¡rio NÃƒO tem nenhuma meta cadastrada no app.' : '',
    (r.metas === 0) ? 'Se o usuÃ¡rio disser que "depositou em uma meta", "guardou para uma meta" ou perguntar sobre progresso de metas â†’ NÃƒO emitir [ACTION:TRANSACTION]. Oriente-o a ir em Metas (menu lateral) > "Nova meta" para criar antes de registrar aportes.' : '',
    '',
    'âš¡ REGRA ABSOLUTA #5 â€” DÃVIDAS SEM CADASTRO:',
    (r.dividasAtivas === 0) ? 'O usuÃ¡rio NÃƒO tem nenhuma dÃ­vida registrada no app.' : '',
    (r.dividasAtivas === 0) ? 'Se o usuÃ¡rio disser que "pagou parcela de dÃ­vida/financiamento/emprÃ©stimo" â†’ registre normalmente como despesa via [ACTION:TRANSACTION], mas adicione um aviso de que a dÃ­vida nÃ£o estÃ¡ cadastrada no app e que ele pode registrÃ¡-la em DÃ­vidas (menu lateral) para controle completo das parcelas.' : '',
    '',
    'âš¡ REGRA ABSOLUTA #6 â€” INVESTIMENTOS SEM CADASTRO:',
    (r.investimentos === 0) ? 'O usuÃ¡rio NÃƒO tem nenhum investimento cadastrado no app.' : '',
    (r.investimentos === 0) ? 'Se o usuÃ¡rio mencionar compra de aÃ§Ãµes, CDB, FII, cripto ou qualquer investimento â†’ NÃƒO registre como despesa comum. Oriente-o a ir em Investimentos (menu lateral) para registrar o ativo corretamente com rentabilidade e acompanhamento. Se ele quiser apenas registrar a saÃ­da de dinheiro, esclareÃ§a a diferenÃ§a.' : '',
    '',
    '=== IDENTIDADE ===',
    'VocÃª Ã© o Buddy, assistente financeiro inteligente do app Bud Finance.',
    'Seu nome Ã© Buddy. Quando se apresentar, diga: OlÃ¡! Sou o Buddy, seu assistente financeiro do Bud Finance.',
    'Tom: amigÃ¡vel, motivador, direto, empÃ¡tico. Use emojis com moderaÃ§Ã£o â€” mas seja caloroso como o Buddy que Ã©.',

    'Responda SEMPRE em portuguÃªs brasileiro.',
    'Use Markdown para formatar suas respostas: **negrito**, listas, tabelas quando fizer sentido.',
    '',
    '=== SOBRE O BUD FINANCE ===',
    'Site/landing: https://budsolucoes.com.br/budfinance/',
    'App (login): https://budsolucoes.com.br/appbudfinance/',
    'Desenvolvido por: Bud SoluÃ§Ãµes',
    '',
    '=== PLANOS E PREÃ‡OS ===',
    'â€¢ Gratuito (Free): funcionalidades bÃ¡sicas â€” lanÃ§amento manual de receitas e despesas, carteira, extrato, categorias, dashboard, metas e investimentos.',
    'â€¢ Starter â€” R$ 9,99/mÃªs: tudo do Free + Mercado de compras, Limites por categoria, Comparativo mensal, RelatÃ³rios PDF/CSV.',
    'â€¢ Pro â€” R$ 29,90/mÃªs: tudo do Starter + Recorrentes automÃ¡ticas, DÃ­vidas com Tabela Price, GrÃ¡ficos avanÃ§ados, ImportaÃ§Ã£o de extratos (PDF/OFX/CSV/imagem), Insights de saÃºde financeira, BalanÃ§o mensal.',
    'â€¢ Plus â€” R$ 49,90/mÃªs: tudo do Pro + Assistente de IA (vocÃª, o Buddy), Assistente WhatsApp (em breve), Parcelamento inteligente de cartÃ£o via IA.',
    'â€¢ Trial: 3 dias grÃ¡tis com funcionalidades Plus ao criar conta.',
    'Para assinar: acessar https://budsolucoes.com.br/budfinance/ (seÃ§Ã£o Planos) ou dentro do app em qualquer banner de upgrade.',
    '',
    '=== CONTATO E SUPORTE ===',
    'E-mail: budsolucoes@gmail.com',
    'WhatsApp: (21) 98355-4954 â€” https://wa.me/5521983554954',
    'Instagram: @appbudfinance â€” https://www.instagram.com/appbudfinance',
    'Site: https://budsolucoes.com.br/budfinance/',
    'Se o usuÃ¡rio tiver dÃºvidas que vocÃª nÃ£o consegue resolver, oriente-o a entrar em contato pelo WhatsApp ou e-mail acima.',
    'Para reportar bugs ou sugestÃµes: dentro do app, botÃ£o "?" no Assistente de IA â†’ opÃ§Ã£o "Reportar problema" ou "Enviar sugestÃ£o".',
    '',
    '=== REGRAS CRÃTICAS ===',
    '- NUNCA invente dados financeiros. Use APENAS os dados do contexto abaixo.',
    '- Se o usuÃ¡rio perguntar algo fora de finanÃ§as pessoais ou uso do app, redirecione gentilmente.',
    '- Se nÃ£o tiver dados suficientes para responder, diga que o usuÃ¡rio precisa cadastrar mais informaÃ§Ãµes no app.',
    oculto ? '- O usuÃ¡rio ativou o modo privacidade. NÃƒO exiba valores monetÃ¡rios explÃ­citos. Use termos como "seu saldo", "seus gastos" sem nÃºmeros.' : '',
    '',
    '=== REGISTRAR TRANSAÃ‡Ã•ES â€” LEMBRETE ===',
    'ReforÃ§ando: qualquer frase como "gastei X", "paguei Y", "comprei Z", "recebi W" = incluir [ACTION:TRANSACTION]{...}[/ACTION] sem hesitar.',
    'NÃ£o use o bloco para anÃ¡lises, perguntas ou dÃºvidas â€” apenas quando o usuÃ¡rio relata uma movimentaÃ§Ã£o financeira concreta.',
    '',
    '=== FUNCIONALIDADES DO BUD FINANCE (para ajudar o usuÃ¡rio) ===',
    'â€¢ Dashboard: visÃ£o geral com saldo, resumo do mÃªs, Ãºltimas transaÃ§Ãµes, lembretes de vencimento em 7 dias, widget de limites, widget de carteira, score de saÃºde financeira, grÃ¡fico de categorias, dica financeira do dia e streak de uso.',
    'â€¢ Extrato: histÃ³rico completo de transaÃ§Ãµes com filtros por data, categoria, tipo. Para lanÃ§ar: botÃ£o "+" no extrato ou dashboard.',
    'â€¢ Carteira (Contas): gerenciar contas bancÃ¡rias, poupanÃ§a, benefÃ­cios (vale alimentaÃ§Ã£o, etc). Importar extratos CSV/OFX/PDF/imagem via IA. Ver histÃ³rico de importaÃ§Ãµes anteriores.',
    'â€¢ TransferÃªncias: mover saldo entre contas cadastradas. Gera dois lanÃ§amentos automÃ¡ticos. BotÃ£o "Transferir" na tela Carteira.',
    'â€¢ CartÃµes: gerenciar mÃºltiplos cartÃµes de crÃ©dito. Acompanhar fatura atual, limite disponÃ­vel, parcelas em aberto e parcelamento inteligente via IA (plano Plus). Pagar fatura de uma conta cadastrada.',
    'â€¢ Recorrentes: lanÃ§ar automaticamente contas fixas (aluguel, streaming, etc.) todo mÃªs no dia configurado. Suporta parcelas restantes. (plano Pro+)',
    'â€¢ DÃ­vidas: controlar emprÃ©stimos e financiamentos com Tabela Price, simulador de quitaÃ§Ã£o antecipada e acompanhamento de parcelas. (plano Pro+)',
    'â€¢ Metas: definir objetivos financeiros (viagem, reserva, etc) e acompanhar progresso com aportes manuais.',
    'â€¢ Limites: definir teto de gastos por categoria (ex: mÃ¡x R$ 500 em restaurantes/mÃªs). Alertas ao aproximar do limite. (plano Starter+)',
    'â€¢ Investimentos: registrar renda fixa, aÃ§Ãµes, FIIs, cripto e ver rentabilidade consolidada.',
    'â€¢ AnÃ¡lises/GrÃ¡ficos: grÃ¡ficos de pizza, barras e evoluÃ§Ã£o dos gastos por categoria. (plano Pro+)',
    'â€¢ Insights: score de saÃºde financeira 0-100, alertas automÃ¡ticos, projeÃ§Ãµes e dicas personalizadas. (plano Pro+)',
    'â€¢ BalanÃ§o Mensal: fechar o mÃªs e ver resultado geral consolidado. (plano Pro+)',
    'â€¢ Comparativo: comparar meses lado a lado para ver evoluÃ§Ã£o. (plano Starter+)',
    'â€¢ RelatÃ³rios: exportar dados em PDF/CSV. (plano Starter+)',
    'â€¢ Mercado: lista de compras inteligente com estimativa de valor. (plano Starter+)',
    'â€¢ Categorias: criar e personalizar categorias de gastos (Ã­cone, cor, nome).',
    'â€¢ Onboarding: ao criar a conta, fluxo guiado para cadastrar conta principal, renda e primeira despesa fixa.',
    'â€¢ ConfiguraÃ§Ãµes: mudar plano, tema de cor (8 opÃ§Ãµes: PadrÃ£o Gelo, Dark HBO e 6 temas coloridos), foto de perfil, ocultar valores (privacidade), exportar dados, excluir conta, resetar dados financeiros.',
    'â€¢ Assistente de IA (Buddy â€” vocÃª): chat financeiro com contexto real do usuÃ¡rio, registro de transaÃ§Ãµes por voz/texto, chamados de suporte. (plano Plus)',
    'â€¢ Assistente WhatsApp: controle financeiro direto pelo WhatsApp â€” EM BREVE, aguardando infraestrutura. (plano Plus)',
    '',
    '=== PROBLEMAS COMUNS E SOLUÃ‡Ã•ES ===',
    '- TransaÃ§Ã£o nÃ£o aparece: checar filtros de data no Extrato (pode estar fora do perÃ­odo selecionado).',
    '- Saldo errado: verificar em Carteira se todas as contas tÃªm saldo correto e se hÃ¡ lanÃ§amentos duplicados.',
    '- Recorrente nÃ£o lanÃ§ou: verificar dia de vencimento em Recorrentes e aguardar o processamento automÃ¡tico (ocorre todo dia).',
    '- NotificaÃ§Ã£o nÃ£o chegou: verificar permissÃµes de notificaÃ§Ã£o no navegador â†’ ConfiguraÃ§Ãµes â†’ NotificaÃ§Ãµes.',
    '- Meta nÃ£o avanÃ§a: os aportes sÃ£o manuais â€” ir em Metas e clicar em "Depositar" na meta desejada.',
    '- Limite nÃ£o aparece: verificar em Limites se a categoria estÃ¡ corretamente configurada.',
    '',
    '=== DADOS FINANCEIROS REAIS DO USUÃRIO ===',
    'Nome: ' + nome,
    'PerÃ­odo atual: ' + mesAno,
    'Receitas: ' + fmtVal(r.receitas),
    'Despesas: ' + fmtVal(r.despesas),
    'Resultado: ' + fmtVal((r.receitas||0) - (r.despesas||0)),
    'Saldo total contas: ' + fmtVal(r.saldoContas),
    'Contas: ' + (Array.isArray(r.contas) && r.contas.length ? r.contas.join(' | ') : 'nenhuma cadastrada'),
    'Contas bancÃ¡rias cadastradas: ' + (Array.isArray(r.carteira) && r.carteira.length ? r.carteira.map(function(c){return c.nome;}).join(', ') : 'NENHUMA'),
    'CartÃµes de crÃ©dito cadastrados: ' + (Array.isArray(r.cartoes) && r.cartoes.length ? r.cartoes.map(function(c){return c.nome;}).join(', ') : 'NENHUM'),
    'Top categorias de gasto: ' + (Array.isArray(r.topCats) && r.topCats.length ? r.topCats.join(' | ') : 'sem dados'),
    'DÃ­vidas ativas: ' + (r.dividasAtivas || 0),
    'Metas ativas: ' + (r.metas || 0),
    Array.isArray(r.metasDetalhe) && r.metasDetalhe.length ? 'Detalhe metas: ' + r.metasDetalhe.join(' | ') : '',
    'Limites estourados: ' + (r.limitesEstourados || 0),
    Array.isArray(r.limites) && r.limites.length ? 'Detalhe limites: ' + r.limites.join(' | ') : '',
    'Investimentos cadastrados: ' + (r.investimentos || 0),
    r.mesAnoAnt ? ('MÃªs anterior (' + r.mesAnoAnt + '): Receitas ' + fmtVal(r.receitasAnt) + ' | Despesas ' + fmtVal(r.despesasAnt) + ' | Saldo ' + fmtVal(r.saldoAnt)) : '',
  ].filter(Boolean).join('\n');

  // Converter formato de mensagens para Groq
  var groqMessages = [{ role: 'system', content: systemPrompt }];
  messages.slice(-12).forEach(function (m) {
    if (m.role === 'user' || m.role === 'assistant') {
      groqMessages.push({ role: m.role, content: sanitizeStr(String(m.content || '')).substring(0, 2000) });
    }
  });

  var streamMode = req.body.stream === true;
  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, 40000);

  try {
    var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body:    JSON.stringify({
        model:       GROQ_MODEL,
        reasoning_effort: 'none',
        messages:    groqMessages,
        temperature: 0.7,
        max_tokens: Math.min(1500, GROQ_MAX_OUTPUT_TOKENS),
        stream:      streamMode,
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      var errTxt = await resp.text().catch(function () { return resp.status; });
      throw new Error('Groq API: ' + errTxt);
    }

    if (streamMode) {
      // â”€â”€ Streaming SSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      var reader  = resp.body.getReader();
      var decoder = new TextDecoder();
      try {
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          res.write(decoder.decode(chunk.value, { stream: true }));
        }
      } catch (_se) {
        res.write('data: ' + JSON.stringify({ error: 'Erro durante streaming.' }) + '\n\n');
      }
      return res.end();
    }

    // â”€â”€ Resposta JSON (fallback sem streaming) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    var data   = await resp.json();
    var reply  = (data.choices || [])[0]?.message?.content || 'NÃ£o consegui gerar uma resposta.';

    // Detectar truncamento
    var finishReason = (data.choices || [])[0]?.finish_reason;
    if (finishReason === 'length') {
      reply += '\n\n_âš ï¸ Resposta resumida. PeÃ§a "continue" para mais detalhes._';
    }

    return res.json({ reply: reply });

  } catch (err) {
    clearTimeout(timeoutId);
    if (res.headersSent) {
      res.write('data: ' + JSON.stringify({ error: 'Erro interno.' }) + '\n\n');
      return res.end();
    }
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout na geraÃ§Ã£o da resposta. Tente novamente.' });
    }
    console.error('[/api/chat]', err.message);
    return res.status(500).json({ error: 'Erro ao gerar resposta. Tente novamente.' });
  }
});

// â”€â”€â”€ POST /api/chamado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Registra bug ou sugestÃ£o no Firestore + envia email ao suporte.
// Auth: Bearer Firebase ID Token. Rate limit: 5 chamados/15 min.
app.post('/api/chamado', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });
  }

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token de autenticaÃ§Ã£o ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido ou expirado.' }); }

  var uid = decoded.uid;

  // Rate limit: 5 chamados/15 min por uid
  var RL_CHAMADO_MAX    = 5;
  var RL_CHAMADO_WINDOW = 15 * 60 * 1000;
  var rlKey = 'chamado_' + uid;
  var rlEntry = rateLimitMap.get(rlKey);
  var now = Date.now();
  if (!rlEntry || now - rlEntry.start > RL_CHAMADO_WINDOW) {
    rateLimitMap.set(rlKey, { start: now, count: 1 });
  } else {
    rlEntry.count++;
    if (rlEntry.count > RL_CHAMADO_MAX) {
      return res.status(429).json({ error: 'Limite de chamados atingido. Aguarde 15 minutos.' });
    }
  }

  var tipo        = sanitizeStr(String(req.body.tipo        || '')).substring(0, 20);
  var descricao   = sanitizeStr(String(req.body.descricao   || '')).substring(0, 2000);
  var nomeUsuario = sanitizeStr(String(req.body.nomeUsuario || 'AnÃ´nimo')).substring(0, 100);

  if (!tipo || !descricao) {
    return res.status(400).json({ error: 'tipo e descricao sÃ£o obrigatÃ³rios.' });
  }
  if (!['bug', 'sugestao'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo deve ser "bug" ou "sugestao".' });
  }

  try {
    await db.collection('chamados').add({
      tipo,
      descricao,
      uid:           uid,                              // fonte confiÃ¡vel (BUG 13)
      emailUsuario:  decoded.email || '',              // email do token (mais seguro)
      nomeUsuario,
      criadoEm:      new Date().toISOString(),
      status:        'aberto',
      notificadoUser: true,                            // criador jÃ¡ sabe que abriu
      plataforma:    (req.headers['user-agent'] || '').substring(0, 200),
    });

    // Email de notificaÃ§Ã£o ao suporte (fire-and-forget, sem bloquear resposta)
    if (SUPPORT_EMAIL && EMAILJS_TEMPLATE_COMUNICACAO) sendCommunicationEmail({
      to_email:  SUPPORT_EMAIL,
      to_name:   'Equipe App Bud Finance',
      email_subject: '[App Bud Finance] ' + (tipo === 'bug' ? 'Novo bug reportado' : 'Nova sugestão recebida'),
      email_title: tipo === 'bug' ? 'Novo bug reportado' : 'Nova sugestão recebida',
      email_preheader: 'Mensagem enviada pelo aplicativo Bud Finance.',
      email_body: 'Enviado por ' + nomeUsuario + ' (' + (decoded.email || 'e-mail não informado') + ').\n\n' + descricao,
      action_label: 'Abrir painel administrativo',
      action_url: FRONTEND_URL + '/?email_destino=admin'
    }).catch(function () { /* ignora falha de email */ });

    return res.json({ success: true });

  } catch (err) {
    console.error('[/api/chamado]', err.message);
    return res.status(500).json({ error: 'Erro ao registrar chamado.' });
  }
});

// â”€â”€â”€ GET /api/chamados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Lista chamados para o painel admin. Auth: role === 'admin'.
app.get('/api/chamados', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  // Verificar role admin
  try {
    var userSnap = await db.collection('usuarios').doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
  } catch (_e) { return res.status(403).json({ error: 'Acesso negado.' }); }

  try {
    var statusFiltro = req.query.status || '';
    var col = db.collection('chamados').orderBy('criadoEm', 'desc').limit(200);
    var snap = await col.get();
    var docs = snap.docs.map(function (d) {
      return Object.assign({ id: d.id }, d.data());
    });
    if (statusFiltro) docs = docs.filter(function (c) { return c.status === statusFiltro; });
    return res.json(docs);
  } catch (err) {
    console.error('[GET /api/chamados]', err.message);
    return res.status(500).json({ error: 'Erro ao listar chamados.' });
  }
});

// â”€â”€â”€ PATCH /api/chamados/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Atualiza status de um chamado. Auth: role === 'admin'.
app.patch('/api/chamados/:id', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  try {
    var userSnap = await db.collection('usuarios').doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
  } catch (_e) { return res.status(403).json({ error: 'Acesso negado.' }); }

  var chamadoId = req.params.id;
  var novoStatus = sanitizeStr(String(req.body.status || '')).substring(0, 30);
  var statusValidos = ['aberto', 'em_analise', 'resolvido'];
  if (!statusValidos.includes(novoStatus)) {
    return res.status(400).json({ error: 'Status invÃ¡lido.' });
  }

  try {
    var update = { status: novoStatus };
    // Quando resolvido, marcar como nÃ£o-notificado para o usuÃ¡rio ver no IA
    if (novoStatus === 'resolvido') update.notificadoUser = false;
    // Ao reabrir, limpa a flag para nÃ£o mostrar notificaÃ§Ã£o velha
    if (novoStatus === 'aberto') update.notificadoUser = true;
    await db.collection('chamados').doc(chamadoId).update(update);
    return res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/chamados]', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar chamado.' });
  }
});

// â”€â”€â”€ GET /api/meus-chamados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Retorna chamados do usuÃ¡rio logado com notificadoUser === false (resolvidos nÃ£o vistos).
// ApÃ³s retornar, marca todos como notificadoUser: true em batch.
app.get('/api/meus-chamados', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  try {
    var snap = await db.collection('chamados')
      .where('uid', '==', decoded.uid)
      .where('notificadoUser', '==', false)
      .get();

    if (snap.empty) return res.json([]);

    var pendentes = snap.docs.map(function (d) {
      return { id: d.id, status: d.data().status, descricao: (d.data().descricao || '').substring(0, 120) };
    });

    // Marcar como notificado em batch (fire-and-forget)
    var batch = db.batch();
    snap.docs.forEach(function (d) { batch.update(d.ref, { notificadoUser: true }); });
    batch.commit().catch(function () {});

    return res.json(pendentes);
  } catch (err) {
    console.error('[GET /api/meus-chamados]', err.message);
    return res.status(500).json({ error: 'Erro ao consultar chamados.' });
  }
});

// â”€â”€â”€ POST /api/alerta-financeiro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Enviado pelo frontend quando detecta problemas crÃ­ticos (saldo negativo,
// despesas > receitas, limites estourados). Envia email para o usuÃ¡rio
// e registra no Firestore. Rate limit: 1 por uid a cada 24h.
app.post('/api/alerta-financeiro', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });
  }

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var uid = decoded.uid;

  // Rate limit: 1 alerta a cada 24 horas por uid
  var RL_ALERTA_WINDOW = 24 * 60 * 60 * 1000;
  var rlKey = 'alerta_' + uid;
  var rlEntry = rateLimitMap.get(rlKey);
  var now = Date.now();
  if (rlEntry && now - rlEntry.start < RL_ALERTA_WINDOW) {
    return res.json({ success: true, enviado: false, motivo: 'rate_limit' });
  }
  rateLimitMap.set(rlKey, { start: now, count: 1 });

  var alertas     = req.body.alertas || [];
  var nomeUsuario = sanitizeStr(String(req.body.nomeUsuario || 'UsuÃ¡rio')).substring(0, 100);
  var emailUser   = decoded.email || '';

  if (!Array.isArray(alertas) || alertas.length === 0) {
    return res.json({ success: true, enviado: false });
  }

  var alertasSanitizados = alertas.slice(0, 10).map(function (a) {
    return {
      nivel: ['critico', 'alerta', 'info'].includes(a.nivel) ? a.nivel : 'info',
      texto: sanitizeStr(String(a.texto || '')).substring(0, 200),
    };
  });

  // Salvar alerta no Firestore (para auditoria interna)
  var salvarPromise = db.collection('alertas_financeiros').add({
    uid,
    emailUsuario: emailUser,
    nomeUsuario,
    alertas:      alertasSanitizados,
    criadoEm:     new Date().toISOString(),
    plataforma:   (req.headers['user-agent'] || '').substring(0, 200),
  });

  // Enviar email de alerta para o usuÃ¡rio (fire-and-forget)
  if (emailUser) {
    var alertasTexto = alertasSanitizados.map(function (a) {
      var icone = a.nivel === 'critico' ? 'ðŸš¨' : a.nivel === 'alerta' ? 'âš ï¸' : 'â„¹ï¸';
      return icone + ' ' + a.texto;
    }).join('\n');

    if (EMAILJS_TEMPLATE_COMUNICACAO) sendCommunicationEmail({
      to_email:      emailUser,
      to_name:       nomeUsuario,
      email_subject: '[App Bud Finance] Alerta financeiro',
      email_title: 'Alerta financeiro',
      email_preheader: 'Encontramos pontos de atenção nas suas finanças.',
      email_body: 'O Bud identificou estes pontos de atenção:\n\n' + alertasTexto + '\n\nAbra o app para ver os detalhes.',
      action_label: 'Ver meus alertas',
      action_url: FRONTEND_URL + '/?email_destino=insights'
    }).catch(function () { /* ignora falha */ });
  }

  // PEND-047: Enviar push FCM se o usuÃ¡rio tiver token registrado
  (async function () {
    try {
      var userDoc2 = await db.collection('usuarios').doc(uid).get();
      var fcmTok   = (userDoc2.exists ? userDoc2.data() : {}).fcmToken;
      if (!fcmTok) return;

      var criticos = alertasSanitizados.filter(function (a) { return a.nivel === 'critico'; });
      var pushTitle = criticos.length > 0
        ? 'ðŸš¨ ' + criticos.length + ' alerta(s) crÃ­tico(s) â€” Bud Finance'
        : 'âš ï¸ Alertas financeiros â€” Bud Finance';
      var pushBody = alertasSanitizados.slice(0, 2).map(function (a) { return a.texto; }).join(' Â· ');
      if (pushBody.length > 120) pushBody = pushBody.substring(0, 117) + 'â€¦';

      await admin.messaging().send({
        token: fcmTok,
        data: {
          title: pushTitle,
          body:  pushBody,
          url:   'assistente-ia.html',
          tag:   'alerta-saude-' + new Date().toISOString().slice(0, 10),
          emoji: 'ðŸš¨'
        },
        webpush: {
          notification: {
            icon:  FRONTEND_URL + '/icons/icon-192.png',
            badge: FRONTEND_URL + '/icons/icon-192.png',
            vibrate: [300, 100, 300]
          },
          fcmOptions: { link: FRONTEND_URL + '/assistente-ia.html' }
        }
      });
    } catch (pushErr) {
      var pushCode = (pushErr && pushErr.code) || '';
      if (pushCode === 'messaging/registration-token-not-registered' ||
          pushCode === 'messaging/invalid-registration-token') {
        try {
          await db.collection('usuarios').doc(uid).update({ fcmToken: null, pushEnabled: false });
        } catch (_) {}
      }
      // Push falhou silenciosamente â€” email jÃ¡ foi enviado
    }
  })();

  try {
    await salvarPromise;
    return res.json({ success: true, enviado: true });
  } catch (err) {
    console.error('[/api/alerta-financeiro]', err.message);
    return res.json({ success: true, enviado: false }); // nÃ£o falha o cliente
  }
});

// â”€â”€â”€ GET /api/ping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Rota leve para acordar o servidor no Render free tier.
// Chamada silenciosa no carregamento de qualquer pÃ¡gina que use o backend.
app.get('/api/ping', function (_req, res) {
  res.json({ ok: true, ts: Date.now(), revision: process.env.RENDER_GIT_COMMIT || null, pushConsentVersion: 1, accountDeletionVersion: 2, securityGuardVersion: 1, proratedUpgradeVersion: 1 });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ASSISTENTE WHATSAPP â€” FASE 1: VÃ­nculo via Token de Pareamento
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Helper: gera token alfanumÃ©rico 4 chars
function gerarTokenWA() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/1/0 (confusos)
  var t = '';
  for (var i = 0; i < 4; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return 'BUD-' + t;
}

// Helper: envia mensagem de texto via Meta Cloud API
async function enviarMensagemWA(numero, texto) {
  if (!WA_PHONE_NUMBER_ID || !WA_API_TOKEN) {
    // Evolution API como fallback (WA_EVOLUTION_KEY opcional)
    if (WA_EVOLUTION_URL) {
      console.log('[EVO] enviando para:', numero);
      var evoResp = await fetch(WA_EVOLUTION_URL + '/message/sendText/' + WA_EVOLUTION_INSTANCE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_EVOLUTION_KEY },
        body: JSON.stringify({ number: numero, textMessage: { text: texto } })
      }).catch(function (e) { console.error('[EVO] enviarMensagem network error:', e.message); return null; });
      if (evoResp) {
        var evoBody = await evoResp.text().catch(function () { return ''; });
        console.log('[EVO] sendText status:', evoResp.status, evoBody.slice(0, 300));
      }
    }
    return;
  }
  await fetch('https://graph.facebook.com/v19.0/' + WA_PHONE_NUMBER_ID + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + WA_API_TOKEN },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: texto }
    })
  }).catch(function (e) { console.error('[WA] enviarMensagem:', e.message); });
}

// â”€â”€â”€ Helper compartilhado: processa mensagem WA (pareamento Fase 1) â”€â”€
// jid = JID completo (ex: 5521999999@s.whatsapp.net ou 18962346@lid)
// numero = apenas dÃ­gitos/id sem sufixo (para Firestore)
async function processarMensagemWA(jid, texto) {
  if (!db) return;
  // Normalizar: remover espaÃ§os, aceitar minÃºsculas (bud-xxxx ou BUD - XXXX)
  texto = texto.replace(/\s+/g, '').trim();
  if (!/^BUD-[A-Z0-9]{4}$/i.test(texto)) return; // Fase 2 (futura): chat IA

  var codigo = texto.toUpperCase();
  var numero = jid.split('@')[0]; // apenas dÃ­gitos para Firestore
  var agora  = Date.now();
  var snap   = await db.collection('usuarios')
    .where('whatsappToken', '==', codigo)
    .limit(1).get();

  if (snap.empty) {
    await enviarMensagemWA(jid, 'âŒ CÃ³digo invÃ¡lido ou expirado. Gere um novo cÃ³digo em Ajustes â†’ WhatsApp no app.');
    return;
  }

  var userDoc  = snap.docs[0];
  var userData = userDoc.data();

  if (!userData.whatsappTokenExp || agora > userData.whatsappTokenExp) {
    await enviarMensagemWA(jid, 'â° CÃ³digo expirado. Gere um novo em Ajustes â†’ WhatsApp no app.');
    return;
  }

  await userDoc.ref.update({
    whatsappVinculado:   numero, // armazena sÃ³ os dÃ­gitos (sem @lid/@s.whatsapp.net)
    whatsappToken:       null,
    whatsappTokenExp:    null,
    whatsappVinculadoEm: new Date().toISOString()
  });

  var nome = (userData.nome || '').split(' ')[0] || 'usuÃ¡rio';
  await enviarMensagemWA(jid,
    'âœ… OlÃ¡, ' + nome + '! Seu WhatsApp estÃ¡ vinculado ao Bud Finance. ðŸŽ‰\n\n' +
    'Agora vocÃª pode:\n' +
    'â€¢ Registrar gastos: _"gastei 50 de gasolina"_\n' +
    'â€¢ Consultar saldo: _"qual meu saldo?"_\n' +
    'â€¢ Tirar foto de cupom e eu registro automaticamente\n\n' +
    'Pode comeÃ§ar! ðŸš€'
  );
  console.log('[WA] Vínculo confirmado.');
}

// â”€â”€â”€ GET /webhook/whatsapp â”€â”€â”€ verificaÃ§Ã£o Meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/webhook/whatsapp', function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === WA_VERIFY_TOKEN) {
    console.log('[WA] webhook verificado');
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// â”€â”€â”€ POST /webhook/whatsapp â”€â”€â”€ recebe mensagens (Meta Cloud API) â”€â”€â”€
app.post('/webhook/whatsapp', async function (req, res) {
  // Verificar assinatura HMAC se WA_APP_SECRET configurado
  if (WA_APP_SECRET) {
    var sig      = req.headers['x-hub-signature-256'] || '';
    var expected = 'sha256=' + require('crypto')
      .createHmac('sha256', WA_APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (sig !== expected) { console.warn('[WA] assinatura invÃ¡lida'); return res.sendStatus(403); }
  }
  res.sendStatus(200); // responder rÃ¡pido ao Meta

  try {
    var entry  = (req.body.entry  || [])[0];
    var change = (entry?.changes  || [])[0];
    var msg    = (change?.value?.messages || [])[0];
    if (!msg) return;

    var numero = msg.from || '';
    var texto  = (msg.text?.body || '').trim();
    if (!texto || !numero) return;

    await processarMensagemWA(numero, texto);
  } catch (err) {
    console.error('[WA] webhook error:', err.message);
  }
});

// â”€â”€â”€ POST /webhook/evolution â”€â”€â”€ recebe mensagens (Evolution API) â”€â”€â”€
// Formato Evolution API v2. Configurar no painel da Evolution:
//   URL: https://nexo-backend-4kmu.onrender.com/webhook/evolution
//   Events: MESSAGES_UPSERT
app.post('/webhook/evolution', async function (req, res) {
  res.sendStatus(200); // responder rÃ¡pido
  // Log completo apenas para messages.upsert (debug @lid)
  if (req.body?.event === 'messages.upsert') {
    // Never log message contents or customer identifiers.
  }

  try {
    // Nota: Evolution API nÃ£o envia apikey nos webhooks. Auth via URL secreta opcional.
    var event = req.body?.event || '';
    if (event !== 'messages.upsert') return; // ignorar status, qr, etc.

    var data = req.body?.data || {};
    if (data.key?.fromMe) return; // ignorar msgs enviadas pelo bot

    var remoteJid = data.key?.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return; // ignorar grupos

    var texto  = (
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      ''
    ).trim();

    if (!texto || !remoteJid) return;

    console.log('[EVO] mensagem recebida de', remoteJid.split('@')[0], ':', texto.slice(0, 50));
    await processarMensagemWA(remoteJid, texto); // passa JID completo
  } catch (err) {
    console.error('[EVO] webhook error:', err.message);
  }
});

// â”€â”€â”€ POST /api/whatsapp/gerar-token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Gera cÃ³digo de pareamento para vincular WhatsApp. Auth: Bearer token.
app.post('/api/whatsapp/gerar-token', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  // Verificar plano
  try {
    var userSnap = await db.collection('usuarios').doc(decoded.uid).get();
    var plano = _effectivePlan(userSnap.data());
    if (!['plus', 'pro', 'trial'].includes(plano)) {
      return res.status(403).json({ error: 'Recurso disponÃ­vel apenas nos planos Plus, Pro e Trial.' });
    }
  } catch (_e) { return res.status(403).json({ error: 'Erro ao verificar plano.' }); }

  var token   = gerarTokenWA();
  var expMs   = Date.now() + 24 * 60 * 60 * 1000; // 24h

  try {
    await db.collection('usuarios').doc(decoded.uid).update({
      whatsappToken:    token,
      whatsappTokenExp: expMs
    });
    return res.json({
      token,
      expiresAt:       new Date(expMs).toISOString(),
      waNumeroDisplay: WA_NUMERO_DISPLAY || '(nÃºmero nÃ£o configurado)',
      waLink:          WA_NUMERO_LINK ? 'https://wa.me/' + WA_NUMERO_LINK + '?text=' + encodeURIComponent(token) : null
    });
  } catch (err) {
    console.error('[/api/whatsapp/gerar-token]', err.message);
    return res.status(500).json({ error: 'Erro ao gerar token.' });
  }
});

// â”€â”€â”€ GET /api/whatsapp/status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Retorna status do vÃ­nculo WhatsApp do usuÃ¡rio autenticado.
app.get('/api/whatsapp/status', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  try {
    var snap    = await db.collection('usuarios').doc(decoded.uid).get();
    var data    = snap.data() || {};
    var vinculado = data.whatsappVinculado || null;
    return res.json({ vinculado: !!vinculado, numero: vinculado });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar status.' });
  }
});

// â”€â”€â”€ POST /api/whatsapp/desvincular â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Remove vÃ­nculo WhatsApp do usuÃ¡rio.
app.post('/api/whatsapp/desvincular', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  try {
    await db.collection('usuarios').doc(decoded.uid).update({
      whatsappVinculado:   null,
      whatsappToken:       null,
      whatsappTokenExp:    null,
      whatsappVinculadoEm: null
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao desvincular.' });
  }
});

// â”€â”€â”€ POST /mercadopago/create-subscription â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cria uma assinatura recorrente (preapproval) no Mercado Pago.
// Auth: Bearer Firebase ID Token.
// Body: { planKey: 'starter'|'pro'|'plus', ref?: string }
// SeguranÃ§a: uid e email extraÃ­dos do Bearer token â€” nunca do body.
// Apply one validated referral code after email confirmation, before any subscription starts.
app.post('/api/indicacao/aplicar', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Serviço indisponível.' });
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Faça login novamente.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_) { return res.status(401).json({ error: 'Sessão inválida.' }); }
  var code = String(req.body.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  if (!/^[A-Z0-9]{8}$/.test(code)) return res.status(400).json({ error: 'Informe um código de indicação válido com 8 caracteres.' });
  var userRef = db.collection('usuarios').doc(decoded.uid);
  var userSnap = await userRef.get();
  if (!userSnap.exists) return res.status(404).json({ error: 'Cadastro não encontrado.' });
  var current = userSnap.data() || {};
  if (current.indicadoPor) {
    if (String(current.indicadoPor.codigo || '').toUpperCase() === code) return res.json({ ok: true, alreadyApplied: true, discountPercent: 15 });
    return res.status(409).json({ error: 'Uma indicação já está vinculada a esta conta.' });
  }
  if (current.primeiraCobrancaPagaEm || current.mpSubscriptionId || current.mpCheckout) {
    return res.status(409).json({ error: 'O código só pode ser vinculado antes de iniciar uma assinatura.' });
  }
  var refSnap = await db.collection('usuarios').where('codigoIndicacao', '==', code).limit(2).get();
  if (refSnap.size !== 1) return res.status(400).json({ error: 'Código não encontrado ou indisponível.' });
  var referrerDoc = refSnap.docs[0];
  if (referrerDoc.id === decoded.uid) return res.status(400).json({ error: 'Você não pode usar o próprio código.' });
  var referrer = referrerDoc.data() || {};
  var referralRef = referrerDoc.ref.collection('indicacoes').doc(decoded.uid);
  try {
    await db.runTransaction(async function (transaction) {
      var fresh = await transaction.get(userRef);
      if (!fresh.exists) throw Object.assign(new Error('Cadastro não encontrado.'), { status: 404 });
      var data = fresh.data() || {};
      if (data.indicadoPor) {
        if (String(data.indicadoPor.codigo || '').toUpperCase() !== code) throw Object.assign(new Error('Uma indicação já está vinculada a esta conta.'), { status: 409 });
        return;
      }
      if (data.primeiraCobrancaPagaEm || data.mpSubscriptionId || data.mpCheckout) throw Object.assign(new Error('O código só pode ser vinculado antes de iniciar uma assinatura.'), { status: 409 });
      transaction.update(userRef, {
        indicadoPor: { uid: referrerDoc.id, codigo: code },
        descontoIndicacao: 15,
        descontoIndicacaoUsado: false,
        codigoIndicacaoAplicadoEm: admin.firestore.FieldValue.serverTimestamp()
      });
      transaction.set(referralRef, {
        indicadoUid: decoded.uid,
        data: admin.firestore.FieldValue.serverTimestamp(),
        assinouPlano: false
      }, { merge: true });
    });
    return res.json({ ok: true, discountPercent: 15, referrerName: String(referrer.nome || '').split(/\s+/)[0] || 'seu amigo' });
  } catch (error) {
    return res.status(error.status || 503).json({ error: error.message || 'Não foi possível aplicar o código.' });
  }
});

app.post('/mercadopago/create-subscription', async function (req, res) {
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Pagamentos nÃ£o configurados.' });
  if (!auth || !db)     return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  // 1. Verificar token
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var uid   = decoded.uid;
  var email = decoded.email || '';

  // 2. Validar planKey
  var planKey = String(req.body.planKey || '').toLowerCase().trim();
  if (!MP_PLANS[planKey]) return res.status(400).json({ error: 'Plano invÃ¡lido.' });

  var plan = MP_PLANS[planKey];
  var checkoutRef = db.collection('usuarios').doc(uid);
  var userSnap;
  try { userSnap = await checkoutRef.get(); }
  catch (_) { return res.status(503).json({ error: 'Não foi possível consultar o cadastro para iniciar a assinatura.' }); }
  if (!userSnap.exists) return res.status(503).json({ error: 'Não foi possível consultar o cadastro para iniciar a assinatura.' });
  var userProfile = userSnap.data() || {};
  var explicitRef = req.body.ref ? String(req.body.ref).trim() : '';
  var rawRef = explicitRef || String(userProfile.indicadoPor && userProfile.indicadoPor.codigo || '');
  var refCode = rawRef ? rawRef.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) : null;
  if (userProfile.primeiraCobrancaPagaEm || (userProfile.descontoIndicacaoPrimeiroMes && userProfile.descontoIndicacaoPrimeiroMes.status === 'used')) refCode = null;
  var referrerDoc = null;
  if (refCode) {
    var refSnap;
    try { refSnap = await db.collection('usuarios').where('codigoIndicacao', '==', refCode).limit(2).get(); }
    catch (_) { return res.status(503).json({ error: 'Não foi possível validar o código de indicação.' }); }
    if (refSnap.size !== 1 || refSnap.docs[0].id === uid) return res.status(400).json({ error: 'Código de indicação inválido.' });
    referrerDoc = refSnap.docs[0];
    if (userProfile.indicadoPor && userProfile.indicadoPor.uid && userProfile.indicadoPor.uid !== referrerDoc.id) {
      return res.status(409).json({ error: 'O código não corresponde à indicação já vinculada.' });
    }
  }
  var rewardPending = userProfile.beneficioIndicacao50 && userProfile.beneficioIndicacao50.status === 'pending';
  // Os benefícios não se acumulam no mesmo ciclo: 15% do indicado primeiro, 50% do indicador depois.
  var promoType = refCode ? 'indicado15' : (rewardPending ? 'indicador50' : null);
  var discountRate = promoType === 'indicador50' ? MP_BONUS_INDICADOR : (promoType === 'indicado15' ? MP_INDICACAO_DESCONTO : 0);
  var baseAmount = plan.amount;
  var amount = Math.round(baseAmount * (1 - discountRate) * 100) / 100;
  var promo = promoType ? { type: promoType, baseAmount, discountAmount: amount, refCode: refCode || null } : null;

  // 4. external_reference: uid|planKey[|refCode] â€” recuperado no webhook
  var externalRef = uid + '|' + planKey + (refCode ? '|' + refCode : '');

  // 4.5. Buscar dados do usuÃ¡rio no Firestore para enriquecer o payer (melhora aprovaÃ§Ã£o)
  // 4.5. Buscar dados do usuário no Firestore para enriquecer o payer.
  var ud = userProfile, firstName = '', lastName = '', payerPhone = null;
  var nomePartes = String(ud.nome || '').trim().split(/\s+/);
  firstName = nomePartes[0] || '';
  lastName = nomePartes.slice(1).join(' ') || firstName;
  var telLimpo = String(ud.telefone || '').replace(/\D/g, '');
  if (telLimpo.length >= 10) payerPhone = { area_code: telLimpo.slice(0, 2), number: telLimpo.slice(2) };

  // 5. Criar assinatura pendente sem plano associado. O Mercado Pago retorna
  // o init_point para o assinante informar o meio de pagamento no checkout.
  // Não definimos end_date: ela encerraria a recorrência, e não apenas o link.
  if (userSnap.data().mpSubscriptionId && !['cancelled', 'canceled'].includes(userSnap.data().assinaturaStatus)) {
    var pendingCheckout = userSnap.data().mpCheckout;
    if (userSnap.data().assinaturaStatus === 'pending' && pendingCheckout?.planKey === planKey && pendingCheckout.subscriptionId === userSnap.data().mpSubscriptionId && pendingCheckout.init_point) {
      return res.json({ init_point: pendingCheckout.init_point });
    }
    return res.status(409).json({ error: 'Já existe uma assinatura vinculada. Use a troca de plano em Configurações.', code: 'SUBSCRIPTION_EXISTS' });
  }
  // Reserve before contacting the provider. An unknown response must be reconciled,
  // never retried as a new subscription just because a timeout elapsed.
  var checkoutNonce = crypto.randomUUID();
  try {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(checkoutRef), profile = snapshot.data();
      if (!snapshot.exists || profile._deletionPending || (profile.mpSubscriptionId && !['cancelled', 'canceled'].includes(profile.assinaturaStatus)) || ['creating', 'unknown'].includes(profile.mpCheckout?.state)) {
        throw Object.assign(new Error('A contratação anterior está sendo conferida. Aguarde ou contate o suporte antes de iniciar outra.'), { status: 409 });
      }
      transaction.update(checkoutRef, { mpCheckout: { state: 'creating', planKey, nonce: checkoutNonce, createdAt: Date.now(), promo } });
    });
  } catch (error) { return res.status(error.status || 503).json({ error: error.status === 409 ? error.message : 'Não foi possível preparar o checkout.', code: 'CHECKOUT_IN_PROGRESS' }); }
  var mpBody = {
    reason:               plan.title,
    external_reference:   externalRef,
    payer_email:          email,
    ...(firstName ? { payer_first_name: firstName }  : {}),
    ...(lastName  ? { payer_last_name:  lastName  }  : {}),
    ...(payerPhone ? { payer_phone: payerPhone }      : {}),
    statement_descriptor: 'BUD FINANCE',
    notification_url:     MP_WEBHOOK_URL,
    auto_recurring: {
      frequency:          1,
      frequency_type:     'months',
      transaction_amount: amount,
      currency_id:        'BRL'
    },
    back_url: FRONTEND_URL + '/dashboard.html',
    status:   'pending'
  };

  try {
    var mpRes  = await fetch('https://api.mercadopago.com/preapproval', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN },
      body:    JSON.stringify(mpBody)
    });
    var mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error('[MP] create-subscription error:', JSON.stringify(mpData));
      await checkoutRef.update({ mpCheckout: { state: mpRes.status >= 400 && mpRes.status < 500 ? 'rejected' : 'unknown', planKey, nonce: checkoutNonce, promo } });
      return res.status(502).json({ error: mpData.message || 'Erro ao criar assinatura no Mercado Pago.' });
    }
    var isSandbox  = MP_ACCESS_TOKEN.startsWith('TEST-');
    var checkoutUrl = isSandbox ? (mpData.sandbox_init_point || mpData.init_point) : mpData.init_point;
    if (!checkoutUrl || !mpData.id) throw new Error('Incomplete subscription response');
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(checkoutRef), profile = snapshot.data();
      if (profile.mpCheckout?.nonce !== checkoutNonce || (profile.mpSubscriptionId && !['cancelled','canceled'].includes(profile.assinaturaStatus) && profile.mpSubscriptionId !== mpData.id)) throw new Error('Checkout binding changed');
      transaction.update(checkoutRef, {
        mpCheckout: { state: 'pending', planKey, subscriptionId: mpData.id, init_point: checkoutUrl, promo },
        mpSubscriptionId: mpData.id,
        ...(promo && promo.type === 'indicado15' ? { descontoIndicacaoPrimeiroMes: { status: 'awaiting_payment', subscriptionId: mpData.id, planKey, baseAmount, discountAmount: amount, refCode } } : {}),
        ...(promo && promo.type === 'indicador50' ? { beneficioIndicacao50: { ...profile.beneficioIndicacao50, status: 'awaiting_payment', subscriptionId: mpData.id, planKey, baseAmount, discountAmount: amount } } : {}),
        ...(refCode && !profile.indicadoPor && referrerDoc ? { indicadoPor: { uid: referrerDoc.id, codigo: refCode }, descontoIndicacao: 15, descontoIndicacaoUsado: false } : {}),
        ...(['authorized','active'].includes(profile.assinaturaStatus) && profile.mpSubscriptionId === mpData.id ? {} : { assinaturaStatus: 'pending' })
      });
    });
    return res.json({ init_point: checkoutUrl, discountPercent: discountRate * 100, chargeAmount: amount, standardAmount: baseAmount });
  } catch (err) {
    console.error('[MP] create-subscription fetch error:', err.message);
    return res.status(500).json({ error: 'Erro de comunicaÃ§Ã£o com Mercado Pago.' });
  }
});

// â”€â”€â”€ POST /webhook/mercadopago â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Recebe notificaÃ§Ãµes do Mercado Pago e atualiza o plano no Firestore.
// Configurar no painel MP â†’ IntegraÃ§Ãµes â†’ Webhooks:
//   URL: https://bud-finance-backend.onrender.com/webhook/mercadopago
//   Eventos: subscription_preapproval, subscription_authorized_payment, payment
app.post('/webhook/mercadopago', async function (req, res) {
  if (!MP_WEBHOOK_SECRET) return res.status(503).json({ error: 'Webhook não configurado.' });
  var queryId = String(req.query['data.id'] || '').toLowerCase();
  var bodyId = String(req.body.data && req.body.data.id || '').toLowerCase();
  if (queryId && bodyId && queryId !== bodyId) return res.status(401).json({ error: 'Notificação inconsistente.' });
  var dataId = queryId || bodyId;
  var xReqId = req.headers['x-request-id'] || '';
  var parts = String(req.headers['x-signature'] || '').split(',').map(function (part) { return part.trim(); });
  var ts = (parts.find(p => p.startsWith('ts=')) || '').slice(3);
  var v1 = (parts.find(p => p.startsWith('v1=')) || '').slice(3);
  var manifest = 'id:' + dataId + ';request-id:' + xReqId + ';ts:' + ts + ';';
  var expected = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  if (!dataId || !xReqId || !ts || !/^[a-f0-9]{64}$/i.test(v1) || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))) {
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }
  if (!db) return res.status(503).json({ error: 'Serviço indisponível.' });
  var type = req.body.type || req.query.type || '';
  try {
    if (type === 'subscription_preapproval') await _mpHandleSubscription(dataId);
    else if (type === 'subscription_authorized_payment') await _mpHandleAuthorizedPayment(dataId);
    else if (type === 'payment') await _mpHandlePayment(dataId);
    // Acknowledge only after processing; failures must be retried by Mercado Pago.
    return res.sendStatus(200);
  } catch (err) {
    console.error('[MP webhook]', err.code || String(err.message || 'processing-failed').slice(0, 200));
    return res.status(503).json({ error: 'Não foi possível processar a notificação. Tente novamente.' });
  }
});

app.post('/mercadopago/upgrade-subscription',subscriptionUpgrades.handler);
app.post('/mercadopago/change-subscription', createSubscriptionChange({ auth, db, token: MP_ACCESS_TOKEN, plans: MP_PLANS, emulator: process.env.BUD_USE_EMULATOR === 'true', fetch }));

function _mpSubscriptionEventMatches(profile, subscriptionId) {
  var checkout = profile.mpCheckout;
  // A provider event can race the response that binds its new checkout ID.
  // Retry instead of acknowledging an event whose owner binding is still unknown.
  if (checkout && ['creating', 'unknown'].includes(checkout.state)) throw new Error('MP checkout binding not ready');
  if (checkout && checkout.subscriptionId && checkout.subscriptionId !== subscriptionId) return false;
  return !profile.mpSubscriptionId || profile.mpSubscriptionId === subscriptionId;
}

async function _mpUpdateSubscriptionProfile(uid, subscriptionId, data, expectedPlan) {
  var ref = db.collection('usuarios').doc(uid);
  return db.runTransaction(async transaction => {
    var snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('MP account profile not found');
    if (!_mpSubscriptionEventMatches(snapshot.data(), subscriptionId)) return false;
    if (expectedPlan !== undefined && snapshot.data().plano !== expectedPlan) throw new Error('MP plan changed concurrently; retry event');
    transaction.update(ref, data);
    return true;
  });
}

async function _mpSetRecurringAmount(subscriptionId, amount) {
  var normalizedAmount = Math.round(Number(amount) * 100) / 100;
  var response = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN },
    body: JSON.stringify({ auto_recurring: { transaction_amount: normalizedAmount, currency_id: 'BRL' } }), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('MP subscription amount update HTTP ' + response.status);
  var updated = await response.json().catch(function () { return {}; });
  var confirmedAmount = Number(updated.auto_recurring && updated.auto_recurring.transaction_amount);
  if (Math.round(confirmedAmount * 100) !== Math.round(normalizedAmount * 100)) {
    var verify = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), {
      headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(10000)
    });
    if (!verify.ok) throw new Error('MP subscription amount verification HTTP ' + verify.status);
    updated = await verify.json();
    confirmedAmount = Number(updated.auto_recurring && updated.auto_recurring.transaction_amount);
  }
  if (Math.round(confirmedAmount * 100) !== Math.round(normalizedAmount * 100)) throw new Error('MP subscription amount not confirmed');
  return updated;
}

async function _mpAgendarBeneficioIndicacao50(uid) {
  var ref = db.collection('usuarios').doc(uid);
  var snapshot = await ref.get();
  if (!snapshot.exists) return false;
  var profile = snapshot.data() || {}, reward = profile.beneficioIndicacao50 || {};
  if (reward.status !== 'pending') return reward.status === 'scheduled';
  // O desconto de 50% não se acumula com os 15% do primeiro mês do indicado.
  if (profile.descontoIndicacaoPrimeiroMes && ['awaiting_payment', 'restoring'].includes(profile.descontoIndicacaoPrimeiroMes.status)) return false;
  if (!profile.mpSubscriptionId || !MP_PLANS[profile.plano] || !['authorized', 'active'].includes(String(profile.assinaturaStatus || '').toLowerCase())) return false;
  var response = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(profile.mpSubscriptionId), {
    headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('MP referrer subscription lookup HTTP ' + response.status);
  var subscription = await response.json();
  if (String(subscription.status || '').toLowerCase() !== 'authorized') return false;
  var nextCharge = new Date(subscription.next_payment_date || 0);
  if (!Number.isFinite(nextCharge.getTime()) || nextCharge.getTime() <= Date.now()) return false;
  var targetPlan = profile.planoTroca && MP_PLANS[profile.planoTroca.planKey] ? profile.planoTroca.planKey : profile.plano;
  var baseAmount = MP_PLANS[targetPlan].amount;
  var discountAmount = Math.round(baseAmount * (1 - MP_BONUS_INDICADOR) * 100) / 100;
  await _mpSetRecurringAmount(profile.mpSubscriptionId, discountAmount);
  await db.runTransaction(async function (transaction) {
    var fresh = await transaction.get(ref);
    if (!fresh.exists) return;
    var latest = fresh.data() || {}, currentReward = latest.beneficioIndicacao50 || {};
    if (currentReward.status !== 'pending' || latest.mpSubscriptionId !== profile.mpSubscriptionId) return;
    transaction.update(ref, { beneficioIndicacao50: {
      ...currentReward, status: 'scheduled', subscriptionId: profile.mpSubscriptionId,
      planKey: targetPlan, baseAmount, discountAmount, effectiveAt: nextCharge.toISOString(), scheduledAt: admin.firestore.FieldValue.serverTimestamp()
    } });
  });
  return true;
}

async function _mpHandleSubscription(preapprovalId, paymentConfirmed) {
  var mpRes = await fetch('https://api.mercadopago.com/preapproval/' + preapprovalId, {
    headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(5000)
  });
  if (!mpRes.ok) throw new Error('MP subscription HTTP ' + mpRes.status);
  var sub = await mpRes.json();

  var parts   = String(sub.external_reference || '').split('|');
  var uid     = parts[0];
  var planKey = parts[1];
  var refCode = parts[2] || null;
  if (!uid || !MP_PLANS[planKey]) return;

  var eventProfile = await db.collection('usuarios').doc(uid).get();
  if (!eventProfile.exists) throw new Error('MP account profile not found');
  if (!_mpSubscriptionEventMatches(eventProfile.data(), preapprovalId)) return;

  var status = String(sub.status || '').toLowerCase();

  if (status === 'authorized') {
    // Validar que quem pagou Ã© o dono da conta Bud Finance
    var payerEmail = String(sub.payer_email || '').toLowerCase().trim();
    try {
      var userSnap2 = await db.collection('usuarios').doc(uid).get();
      if (userSnap2.exists) {
        var userEmail2 = String(userSnap2.data().email || '').toLowerCase().trim();
        if (payerEmail && userEmail2 && payerEmail !== userEmail2) {
          console.warn('[MP webhook] Pagador invÃ¡lido â€” cancelando assinatura:', uid, payerEmail, '!=', userEmail2);
          // Cancelar no MP para evitar cobranÃ§as futuras
          try {
            await fetch('https://api.mercadopago.com/preapproval/' + preapprovalId, {
              method:  'PUT', signal: AbortSignal.timeout(5000),
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN },
              body:    JSON.stringify({ status: 'cancelled' })
            });
          } catch (_ec) { /* cancelamento falhou â€” ativaÃ§Ã£o bloqueada de qualquer forma */ }
          await _mpUpdateSubscriptionProfile(uid, preapprovalId, {
            pagamentoPendente: true,
            erroAssinatura:    'pagador_invalido',
            planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
          });
          return; // nÃ£o ativa o plano
        }
      }
    } catch (_ev) { throw _ev; }

    var currentProfile = userSnap2 && userSnap2.exists ? userSnap2.data() : {};
    // Um evento de status da assinatura, sem pagamento aprovado, não pode limpar
    // uma recusa já registrada nem renovar o período de acesso.
    if (currentProfile.pagamentoPendente && !paymentConfirmed) return;
    // external_reference keeps the original plan; the paid profile is authoritative
    // after a scheduled change, until a matching new-cycle payment is approved.
    var initialCheckout = currentProfile.mpCheckout?.subscriptionId === preapprovalId && currentProfile.mpCheckout?.state === 'pending';
    if(initialCheckout && !paymentConfirmed)return;
    if (!initialCheckout && currentProfile.mpSubscriptionId === preapprovalId && MP_PLANS[currentProfile.plano]) planKey = currentProfile.plano;
    var scheduledChange = currentProfile.planoTroca;
    var applyScheduledChange = false;
    if (scheduledChange && scheduledChange.subscriptionId === preapprovalId && MP_PLANS[scheduledChange.planKey] && paymentConfirmed && typeof paymentConfirmed === 'object') {
      var paidAt = new Date(paymentConfirmed.date_approved || paymentConfirmed.date_created || 0).getTime();
      var effectiveAt = new Date(scheduledChange.effectiveAt).getTime();
      applyScheduledChange = Number.isFinite(effectiveAt) && paidAt >= effectiveAt &&
        Math.round(Number(paymentConfirmed.transaction_amount) * 100) === Math.round(scheduledChange.amount * 100) &&
        Math.round(Number(sub.auto_recurring && sub.auto_recurring.transaction_amount) * 100) === Math.round(scheduledChange.amount * 100);
      if (applyScheduledChange) planKey = scheduledChange.planKey;
    }
    var promoToRestore = null;
    if (paymentConfirmed && typeof paymentConfirmed === 'object') {
      var paidAmountCents = Math.round(Number(paymentConfirmed.transaction_amount) * 100);
      var paidAtForPromo = new Date(paymentConfirmed.date_approved || paymentConfirmed.date_created || 0).getTime();
      var firstMonthPromo = currentProfile.descontoIndicacaoPrimeiroMes || {};
      var inviterPromo = currentProfile.beneficioIndicacao50 || {};
      if (firstMonthPromo.status === 'awaiting_payment' && firstMonthPromo.subscriptionId === preapprovalId) {
        if (paidAmountCents !== Math.round(Number(firstMonthPromo.discountAmount) * 100)) throw new Error('Referral first-month charge amount mismatch');
        promoToRestore = { type: 'indicado15', baseAmount: Number(firstMonthPromo.baseAmount), refCode: firstMonthPromo.refCode };
      } else if (firstMonthPromo.status === 'restoring' && firstMonthPromo.subscriptionId === preapprovalId) {
        promoToRestore = { type: 'indicado15', baseAmount: Number(firstMonthPromo.baseAmount), refCode: firstMonthPromo.refCode };
      } else if (inviterPromo.status === 'awaiting_payment' && inviterPromo.subscriptionId === preapprovalId) {
        if (paidAmountCents !== Math.round(Number(inviterPromo.discountAmount) * 100)) throw new Error('Referral reward charge amount mismatch');
        promoToRestore = { type: 'indicador50', baseAmount: Number(inviterPromo.baseAmount) };
      } else if (inviterPromo.status === 'scheduled' && inviterPromo.subscriptionId === preapprovalId && paidAtForPromo >= new Date(inviterPromo.effectiveAt || 0).getTime()) {
        if (paidAmountCents !== Math.round(Number(inviterPromo.discountAmount) * 100)) throw new Error('Scheduled referral reward charge amount mismatch');
        promoToRestore = { type: 'indicador50', baseAmount: Number(inviterPromo.baseAmount) };
      }
      if (promoToRestore) {
        if (!Number.isFinite(promoToRestore.baseAmount) || promoToRestore.baseAmount <= 0) throw new Error('Invalid referral promotion base amount');
        await _mpSetRecurringAmount(preapprovalId, promoToRestore.baseAmount);
      }
    }
    var currentExpiry = currentProfile.planoExpira;
    var storedExpiry = currentExpiry && typeof currentExpiry.toDate === 'function' ? currentExpiry.toDate() : new Date(currentExpiry || 0);
    var expira;
    if (sub.next_payment_date) {
      expira = new Date(sub.next_payment_date);
      if (!Number.isFinite(expira.getTime())) throw new Error('Invalid subscription billing date');
    } else if (currentProfile.mpSubscriptionId === preapprovalId && Number.isFinite(storedExpiry.getTime()) && storedExpiry.getTime() > 0 && (!paymentConfirmed || storedExpiry > new Date())) {
      // Repeated status notifications must not extend access indefinitely.
      expira = storedExpiry;
    } else {
      expira = new Date();
      var day = expira.getDate();
      expira.setDate(1);
      expira.setMonth(expira.getMonth() + 1);
      expira.setDate(Math.min(day, new Date(expira.getFullYear(), expira.getMonth() + 1, 0).getDate()));
    }
    var activated = await _mpUpdateSubscriptionProfile(uid, preapprovalId, {
      plano:             planKey,
      planoExpira:       admin.firestore.Timestamp.fromDate(expira),
      mpSubscriptionId:  preapprovalId,
      ...(sub.payer_id ? { mpPayerId: String(sub.payer_id) } : {}),
      assinaturaStatus:  'authorized',
      pagamentoPendente: false,
      pagamentoPendenteDesde: admin.firestore.FieldValue.delete(),
      pagamentoPendentePagamentoId: admin.firestore.FieldValue.delete(),
      ...(paymentConfirmed && (paymentConfirmed.date_approved || paymentConfirmed.date_created) && Number.isFinite(new Date(paymentConfirmed.date_approved || paymentConfirmed.date_created).getTime())
        ? { ultimaCobrancaAprovadaEm: admin.firestore.Timestamp.fromDate(new Date(paymentConfirmed.date_approved || paymentConfirmed.date_created)) } : {}),
      ...(paymentConfirmed && !currentProfile.primeiraCobrancaPagaEm ? { primeiraCobrancaPagaEm: admin.firestore.Timestamp.fromDate(new Date(paymentConfirmed.date_approved || paymentConfirmed.date_created || Date.now())) } : {}),
      ...(promoToRestore && promoToRestore.type === 'indicado15' ? { descontoIndicacaoPrimeiroMes: { status: 'used', subscriptionId: preapprovalId, baseAmount: promoToRestore.baseAmount, usadoEm: admin.firestore.FieldValue.serverTimestamp() }, descontoIndicacaoUsado: true } : {}),
      ...(promoToRestore && promoToRestore.type === 'indicador50' ? { beneficioIndicacao50: { ...currentProfile.beneficioIndicacao50, status: 'used', usadoEm: admin.firestore.FieldValue.serverTimestamp() } } : {}),
      erroAssinatura:    admin.firestore.FieldValue.delete(),
      ...(initialCheckout && paymentConfirmed ? { mpCheckout: admin.firestore.FieldValue.delete() } : {}),
      ...(applyScheduledChange ? { planoTroca: admin.firestore.FieldValue.delete() } : {}),
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    }, currentProfile.plano);
    if (!activated) return;
    console.log('[MP webhook] Plano ativado:', uid, planKey);
    if (refCode && paymentConfirmed) await _mpCreditarIndicacao(refCode, uid, planKey);
    if (paymentConfirmed && (currentProfile.beneficioIndicacao50 || {}).status === 'pending') await _mpAgendarBeneficioIndicacao50(uid);

  } else if (status === 'cancelled' || status === 'paused') {
    await _mpUpdateSubscriptionProfile(uid, preapprovalId, {
      plano:             'free',
      assinaturaStatus:  status,
      pagamentoPendente: false,
      pagamentoPendenteDesde: admin.firestore.FieldValue.delete(),
      pagamentoPendentePagamentoId: admin.firestore.FieldValue.delete(),
      planoExpira:       admin.firestore.FieldValue.delete(),
      planoTroca:        admin.firestore.FieldValue.delete(),
      mpCheckout:        admin.firestore.FieldValue.delete(),
      mpSubscriptionId:  preapprovalId,
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('[MP webhook] Assinatura cancelada/pausada:', uid);
  }
}

// Para pagamentos avulsos: atualiza Firestore via preapproval_id
async function _mpHandlePayment(paymentId, relatedSubscriptionId) {
  var mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + paymentId, {
    headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(5000)
  });
  if (!mpRes.ok) throw new Error('MP payment HTTP ' + mpRes.status);
  var payment = await mpRes.json();
  if(await subscriptionUpgrades.processPayment(payment))return;
  // Subscription checkout payments can carry their link only in transaction_data.
  // Use provider-confirmed fields, never the caller's external_reference as a plan grant.
  var transactionSubscriptionId = payment.point_of_interaction && payment.point_of_interaction.transaction_data && payment.point_of_interaction.transaction_data.subscription_id;
  var paymentSubscriptionId = payment.preapproval_id || transactionSubscriptionId;
  if ((payment.preapproval_id && transactionSubscriptionId && String(payment.preapproval_id) !== String(transactionSubscriptionId)) ||
      (paymentSubscriptionId && relatedSubscriptionId && String(paymentSubscriptionId) !== String(relatedSubscriptionId))) {
    throw new Error('MP payment subscription mismatch');
  }
  var subscriptionId = paymentSubscriptionId || relatedSubscriptionId;

  // Se pagamento recusado: marca flag no Firestore para o front exibir alerta
  if (payment.status === 'rejected' && subscriptionId) {
    try {
      var subRes  = await fetch('https://api.mercadopago.com/preapproval/' + subscriptionId, {
        headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(5000)
      });
      if (!subRes.ok) throw new Error('MP subscription HTTP ' + subRes.status);
      if (subRes.ok) {
        var sub  = await subRes.json();
        var uid  = String(sub.external_reference || '').split('|')[0];
        if (uid) {
          var userRef = db.collection('usuarios').doc(uid);
          var rejectedAt = _toDate(payment.date_created) || new Date();
          await db.runTransaction(async function (transaction) {
            var snapshot = await transaction.get(userRef);
            if (!snapshot.exists || !_mpSubscriptionEventMatches(snapshot.data(), String(subscriptionId))) return;
            var current = snapshot.data(), approvedAt = _toDate(current.ultimaCobrancaAprovadaEm);
            if (approvedAt && approvedAt.getTime() >= rejectedAt.getTime()) return;
            var patch = {
              pagamentoPendente: true, assinaturaStatus: 'past_due',
              mpSubscriptionId: String(subscriptionId),
              pagamentoPendentePagamentoId: String(payment.id || paymentId),
              planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
            };
            if (!current.pagamentoPendente || !_toDate(current.pagamentoPendenteDesde)) {
              patch.pagamentoPendenteDesde = admin.firestore.Timestamp.fromDate(rejectedAt);
            }
            transaction.update(userRef, patch);
          });
          console.log('[MP webhook] Pagamento recusado â€” flag pagamentoPendente:', uid, payment.status_detail);
        }
      }
    } catch (e) { throw e; }
    return;
  }

  if (subscriptionId && payment.status === 'approved') await _mpHandleSubscription(String(subscriptionId), payment);
}

// Registra indicaÃ§Ã£o bem-sucedida na subcoleÃ§Ã£o do referrer
async function _mpHandleAuthorizedPayment(invoiceId) {
  var response = await fetch('https://api.mercadopago.com/authorized_payments/' + encodeURIComponent(invoiceId), {
    headers: { Authorization: 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('MP invoice HTTP ' + response.status);
  var invoice = await response.json();
  if (invoice.preapproval_id && invoice.payment && invoice.payment.id) {
    await _mpHandlePayment(String(invoice.payment.id), String(invoice.preapproval_id));
  }
}

async function _mpCreditarIndicacao(refCode, novoUid, planKey) {
  try {
    var snap = await db.collection('usuarios').where('codigoIndicacao', '==', refCode).limit(2).get();
    if (snap.size !== 1 || snap.docs[0].id === novoUid) return;
    var referrerDoc = snap.docs[0], referrerRef = referrerDoc.ref;
    var referralRef = referrerRef.collection('indicacoes').doc(novoUid);
    var granted = false;
    await db.runTransaction(async function (transaction) {
      var ownerSnap = await transaction.get(referrerRef);
      var referralSnap = await transaction.get(referralRef);
      if (!ownerSnap.exists) return;
      var owner = ownerSnap.data() || {};
      var priorReferral = referralSnap.exists ? referralSnap.data() || {} : {};
      if (priorReferral.primeiroPagamentoAprovado) {
        granted = (owner.beneficioIndicacao50 || {}).status === 'pending';
        return;
      }
      var hasPriorReward = !!owner.beneficioIndicacao50;
      var reward = hasPriorReward ? owner.beneficioIndicacao50 : {
        status: 'pending', percent: 50, indicadoUid: novoUid,
        grantedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      transaction.set(referralRef, {
        indicadoUid: novoUid, planKey,
        assinouPlano: true, primeiroPagamentoAprovado: true,
        convertidoEm: admin.firestore.FieldValue.serverTimestamp(),
        beneficioIndicador: !hasPriorReward
      }, { merge: true });
      if (!hasPriorReward) {
        transaction.update(referrerRef, { beneficioIndicacao50: reward });
        granted = true;
      }
    });
    if (granted) await _mpAgendarBeneficioIndicacao50(referrerDoc.id);
    console.log('[MP] Indicação convertida:', refCode, '→', novoUid, granted ? '(benefício concedido)' : '(sem novo benefício)');
  } catch (err) {
    console.error('[MP] Erro ao creditar indicação:', err.message);
    throw err;
  }
}

app.post('/mercadopago/sandbox-activate', async function (req, res) {
  if (!MP_ACCESS_TOKEN.startsWith('TEST-'))
    return res.status(403).json({ error: 'Endpoint disponÃ­vel apenas em modo sandbox.' });
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var uid     = decoded.uid;
  var planKey = String(req.body.planKey || 'pro').toLowerCase().trim();
  if (!MP_PLANS[planKey]) return res.status(400).json({ error: 'Plano invÃ¡lido.' });

  var expira = new Date();
  expira.setMonth(expira.getMonth() + 1);
  var mockSubId = 'SANDBOX_TEST_' + Date.now();

  await db.collection('usuarios').doc(uid).update({
    plano:             planKey,
    planoExpira:       admin.firestore.Timestamp.fromDate(expira),
    mpSubscriptionId:  mockSubId,
    planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('[MP sandbox-activate] Plano ativado via sandbox:', uid, planKey);
  return res.json({ ok: true, uid, planKey, mpSubscriptionId: mockSubId, planoExpira: expira.toISOString() });
});

// â”€â”€â”€ POST /mercadopago/cancelar-assinatura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cancela a assinatura ativa do usuÃ¡rio no Mercado Pago e rebaixa para free.
// Checkout interno para a interface local. Nunca processa cartao e so existe
// quando o backend esta conectado aos emuladores do Firebase.
app.post('/mercadopago/local-test-payment', express.json(), async function (req, res) {
  if (process.env.BUD_USE_EMULATOR !== 'true')
    return res.status(404).json({ error: 'Indisponivel fora do ambiente local.' });
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nao inicializado.' });

  var authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Autenticacao necessaria.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(authHeader.slice(7),true); }
  catch (_) { return res.status(401).json({ error: 'Sessao invalida.' }); }

  var planKey = String((req.body || {}).planKey || '').toLowerCase();
  var status = String((req.body || {}).status || '').toLowerCase();
  if (!MP_PLANS[planKey]) return res.status(400).json({ error: 'Plano invalido.' });
  if (!['approved', 'pending', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status invalido.' });

  var userRef = db.collection('usuarios').doc(decoded.uid);
  if (status === 'approved') {
    var expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    await userRef.set({ plano: planKey, planoExpira: admin.firestore.Timestamp.fromDate(expiresAt),
      mpSubscriptionId: 'LOCAL_TEST_' + Date.now(), pagamentoPendente: false, assinaturaStatus: 'authorized',
      pagamentoPendenteDesde: admin.firestore.FieldValue.delete(), pagamentoPendentePagamentoId: admin.firestore.FieldValue.delete(),
      erroAssinatura: admin.firestore.FieldValue.delete(), planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await userRef.set({ pagamentoPendente: true, assinaturaStatus: status === 'rejected' ? 'past_due' : 'pending',
      erroAssinatura: status === 'rejected' ? 'Pagamento de teste recusado.' : 'Pagamento de teste pendente.',
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  return res.json({ ok: true, status: status, planKey: planKey });
});

async function enviarConfirmacoesCancelamento(clienteEmail, plano) {
  const suporte = 'budsolucoes@gmail.com';
  const whatsapp = 'https://wa.me/5521983554954';
  const nomePlano = MP_PLANS[plano]?.title || 'Bud Finance';
  const avisos = [{
    to_email: suporte,
    to_name: 'Equipe Bud Soluções',
    email_subject: '[Bud Finance] Cancelamento de assinatura',
    email_title: 'Assinatura cancelada',
    email_body: 'Plano: ' + nomePlano + '\nConta: ' + (clienteEmail || 'e-mail indisponível'),
    action_label: 'Abrir painel administrativo',
    action_url: FRONTEND_URL + '/?email_destino=admin'
  }];
  if (clienteEmail) avisos.unshift({
    to_email: clienteEmail,
    to_name: 'Cliente Bud Finance',
    email_subject: '[Bud Finance] Sua assinatura foi cancelada',
    email_title: 'Cancelamento confirmado',
    email_body: 'Sua assinatura ' + nomePlano + ' foi cancelada. Para falar com o suporte da Bud, escreva para ' + suporte + ' ou use o botão de WhatsApp abaixo.',
    action_label: 'Falar com o suporte pelo WhatsApp',
    action_url: whatsapp,
    reply_to: suporte
  });
  for (const aviso of avisos) {
    try {
      await sendCommunicationEmail(aviso);
    } catch {
      console.error('[cancelamento] Falha no envio do aviso:', aviso.email_title);
    }
    // O EmailJS aceita uma solicitação por segundo.
    if (aviso === avisos[0] && avisos.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }
}

app.post('/mercadopago/cancelar-assinatura', express.json(), async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var uid = decoded.uid;
  try {
    var userRef = db.collection('usuarios').doc(uid);
    var snap    = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado.' });

    var userData = snap.data();
    var subId    = userData.mpSubscriptionId;

    if (!subId) {
      return res.status(400).json({ error: 'Nenhuma assinatura ativa para cancelar.' });
    }

    const tentativaPendente = userData.assinaturaStatus === 'pending' && userData.mpCheckout?.state === 'pending';

    // Cancelar no Mercado Pago (pular em sandbox)
    var localTestSubscription = process.env.BUD_USE_EMULATOR === 'true' && String(subId).startsWith('LOCAL_TEST_');
    if (!String(subId).startsWith('SANDBOX_TEST_') && !localTestSubscription) {
      var mpRes = await fetch('https://api.mercadopago.com/preapproval/' + subId, {
        method:  'PUT',
        headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'cancelled' })
      });
      if (!mpRes.ok) {
        var errText = await mpRes.text();
        console.error('[cancelar-assinatura] MP error:', errText);
        return res.status(502).json({ error: 'Erro ao cancelar no Mercado Pago. Tente novamente.' });
      }
    }

    // Reconcile the current profile in the same transaction.
    await db.runTransaction(async transaction => {
      const fresh = await transaction.get(userRef);
      if (!fresh.exists || fresh.data().mpSubscriptionId !== subId) return;
      const stillPending = fresh.data().assinaturaStatus === 'pending' && fresh.data().mpCheckout?.state === 'pending';
      transaction.update(userRef, {
      ...(!stillPending ? {
        plano: 'free',
        planoExpira: admin.firestore.FieldValue.delete(),
        canceladoEm: admin.firestore.FieldValue.serverTimestamp()
      } : {}),
      mpSubscriptionId:  admin.firestore.FieldValue.delete(),
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      assinaturaStatus:  'cancelled',
      planoTroca:        admin.firestore.FieldValue.delete(),
      mpCheckout:        admin.firestore.FieldValue.delete(),
      pagamentoPendente: false,
      pagamentoPendenteDesde: admin.firestore.FieldValue.delete(),
      pagamentoPendentePagamentoId: admin.firestore.FieldValue.delete()
    });

    });

    if (!tentativaPendente && process.env.BUD_USE_EMULATOR !== 'true') {
      await enviarConfirmacoesCancelamento(decoded.email_verified ? decoded.email : null, userData.plano);
    }
    console.log('[cancelar-assinatura] Assinatura cancelada:', uid, subId);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[cancelar-assinatura]', e.message);
    return res.status(500).json({ error: 'Erro interno ao cancelar.' });
  }
});

// â”€â”€â”€ POST /api/push/token â€” salva FCM token do usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auth: Bearer ID token
app.post('/api/push/token', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var token    = sanitizeStr(String(req.body.token    || '')).substring(0, 500);
  var platform = sanitizeStr(String(req.body.platform || 'web')).substring(0, 20);

  if (!token) return res.status(400).json({ error: 'token Ã© obrigatÃ³rio.' });

  try {
    var registrationRef = db.collection('usuarios').doc(decoded.uid);
    await db.runTransaction(async transaction => {
      const snap=await transaction.get(registrationRef), data=snap.data()||{};
      if(data.pushConsentRevoked===true && req.body.consent!==true)throw Object.assign(new Error('Consentimento revogado. Clique em Ativar para autorizar novamente.'),{status:403});
      const tokens=[...new Set([...(data.fcmTokens||[]),data.fcmToken,token].filter(Boolean))];
      if(tokens.length>20) throw Object.assign(new Error('Limite de dispositivos atingido.'),{status:409});
      transaction.update(registrationRef,{pushConsentRevoked:false,fcmToken:token,fcmTokens:tokens,fcmTokenPlatform:platform,fcmTokenAt:admin.firestore.FieldValue.serverTimestamp(),pushEnabled:true});
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[/api/push/token]', e.message);
    return res.status(e.status||500).json({ error: [403,409].includes(e.status)?e.message:'Erro ao salvar token.' });
  }
});


// --- DELETE /api/push/token --- revoga FCM token (PEND-002) ---
app.delete('/api/push/token', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nao inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_) { return res.status(401).json({ error: 'Token invalido.' }); }

  try {
    var pushRef = db.collection('usuarios').doc(decoded.uid);
    var deviceToken = String(req.body?.token || '');
    if (deviceToken) {
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(pushRef), data = snap.data() || {};
        const remaining = (data.fcmTokens || []).filter(token => token !== deviceToken);
        const legacy = data.fcmToken && data.fcmToken !== deviceToken ? data.fcmToken : null;
        transaction.update(pushRef, { fcmTokens: remaining, fcmToken: legacy || remaining[0] || admin.firestore.FieldValue.delete(), pushEnabled: !!(remaining.length || legacy) });
      });
      return res.json({ ok: true });
    }
    await db.runTransaction(async transaction=>{
      await transaction.get(pushRef);
      transaction.update(pushRef,{
        fcmToken:admin.firestore.FieldValue.delete(),fcmTokens:admin.firestore.FieldValue.delete(),
        pushEnabled:false,pushConsentRevoked:true,pushConsentRevokedAt:admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/push/token]', e.message);
    return res.status(500).json({ error: 'Erro ao revogar token.' });
  }
});
// â”€â”€â”€ POST /api/push/test â€” dispara notificaÃ§Ã£o de teste para o prÃ³prio usuÃ¡rio â”€â”€
app.post('/api/push/test', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  try {
    var userDoc = await db.collection('usuarios').doc(decoded.uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado.' });
    var pushProfile = userDoc.data() || {};
    var fcmToken = req.body?.token || pushProfile.fcmToken;
    if (req.body?.token && req.body.token !== pushProfile.fcmToken && !(pushProfile.fcmTokens || []).includes(req.body.token)) return res.status(400).json({ error: 'Dispositivo não registrado nesta conta.' });
    if (!fcmToken) return res.status(400).json({ error: 'Nenhum FCM token salvo. Ative as notificaÃ§Ãµes primeiro.' });

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'Teste do Bud Finance',
        body: 'Este é o teste solicitado para este dispositivo.'
      },
      webpush: {
        fcmOptions: { link: FRONTEND_URL + '/dashboard.html' }
      }
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[/api/push/test]', e.message);
    // Token invÃ¡lido/expirado: limpar do Firestore para forÃ§ar re-registro
    var code = (e && e.errorInfo && e.errorInfo.code) || e.code || '';
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        /not.found|invalid.argument/i.test(e.message)) {
      try {
        await db.collection('usuarios').doc(decoded.uid).update({
          fcmToken: admin.firestore.FieldValue.delete(),
          pushEnabled: false
        });
      } catch (_) {}
      return res.status(410).json({ error: 'Token expirado. Reative as notificaÃ§Ãµes em ConfiguraÃ§Ãµes.' });
    }
    return res.status(500).json({ error: 'Erro ao enviar notificaÃ§Ã£o: ' + e.message });
  }
});

// â”€â”€â”€ POST /api/push/admin-broadcast â€” admin dispara push para todos os usuÃ¡rios â”€â”€
// Auth: Bearer ID token (caller deve ser admin â€” verificado via admins/{uid})
app.post('/api/push/admin-broadcast', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken,true); }
  catch (_) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  // Verificar se Ã© admin
  try {
    var adminDoc = await db.collection('admins').doc(decoded.uid).get();
    if (!adminDoc.exists) return res.status(403).json({ error: 'Acesso negado. NÃ£o Ã© admin.' });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao verificar admin: ' + e.message });
  }

  var titulo   = sanitizeStr(String(req.body.titulo   || '')).substring(0, 200);
  var mensagem = sanitizeStr(String(req.body.mensagem || '')).substring(0, 500);
  var tipo     = sanitizeStr(String(req.body.tipo     || 'info')).substring(0, 20);
  var destino  = sanitizeStr(String(req.body.destino  || 'all')).substring(0, 50);

  if (!titulo) return res.status(400).json({ error: 'titulo Ã© obrigatÃ³rio.' });

  var tipoEmoji = { info: 'ðŸ’¡', promo: 'ðŸŽ‰', update: 'ðŸš€', alert: 'âš ï¸' };
  var notifTitle = (tipoEmoji[tipo] || 'ðŸ””') + ' ' + titulo;

  try {
    var usersQuery = db.collection('usuarios').where('pushEnabled', '==', true);
    if (destino !== 'all') usersQuery = usersQuery.where('plano', '==', destino);
    var snap = await usersQuery.limit(500).get();

    if (snap.empty) return res.json({ ok: true, sent: 0, total: 0 });

    var messages = [];
    var uids = [];
    snap.forEach(function (d) {
      var fcmToken = (d.data() || {}).fcmToken;
      if (fcmToken) {
        messages.push({
          token: fcmToken,
          notification: { title: notifTitle, body: mensagem },
          webpush: { fcmOptions: { link: FRONTEND_URL + '/dashboard.html' } },
          data: { tipo: tipo, tag: 'admin-' + Date.now() }
        });
        uids.push(d.id);
      }
    });

    if (!messages.length) return res.json({ ok: true, sent: 0, total: snap.size, noTokens: true });

    var sent = 0;
    var staleUids = [];
    for (var i = 0; i < messages.length; i += 500) {
      var batch = messages.slice(i, i + 500);
      var result = await admin.messaging().sendEach(batch);
      sent += result.successCount;
      result.responses.forEach(function (r, idx) {
        if (!r.success && r.error) {
          var code = r.error.code || '';
          if (code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token') {
            staleUids.push(uids[i + idx]);
          }
        }
      });
    }
    // Limpa tokens stale do Firestore
    for (var s = 0; s < staleUids.length; s++) {
      try {
        await db.collection('usuarios').doc(staleUids[s]).update({
          fcmToken: admin.firestore.FieldValue.delete(),
          pushEnabled: false
        });
      } catch (_) {}
    }
    console.log('[/api/push/admin-broadcast] sent=' + sent + '/' + messages.length + ' stale=' + staleUids.length + ' destino=' + destino);
    return res.json({ ok: true, sent: sent, total: messages.length, stale: staleUids.length });
  } catch (e) {
    console.error('[/api/push/admin-broadcast]', e.message);
    return res.status(500).json({ error: 'Erro ao enviar push: ' + e.message });
  }
});

function _toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function _dateKeyBR(date) {
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  var map = {};
  parts.forEach(function (p) { map[p.type] = p.value; });
  return map.year + '-' + map.month + '-' + map.day;
}

function _formatDateBR(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
}

var PAYMENT_GRACE_DAYS = 10;
function _effectivePlan(user, now) {
  return planPolicy.effectivePlan(user, (now || new Date()).getTime());
}

function _pendingDayCount(profile, now) {
  var since = _toDate(profile && profile.pagamentoPendenteDesde);
  if (!since) return null;
  return Math.floor(((now || new Date()).getTime() - since.getTime()) / 86400000);
}

async function enviarLembretesDeAssinatura(hoje) {
  if (!EMAILJS_TEMPLATE_COMUNICACAO || !EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID) {
    return { sent: 0, failed: 1, skipped: 'email_not_configured' };
  }

  var usersSnap;
  try {
    usersSnap = await db.collection('usuarios')
      .where('plano', 'in', ['starter', 'pro', 'plus', 'trial'])
      .limit(500).get();
  } catch (err) {
    console.error('[assinaturas] Não foi possível buscar usuários:', err.message);
    return { sent: 0, failed: 1, error: 'query_failed' };
  }

  var hojeKey = _dateKeyBR(hoje);
  var hojeUtc = new Date(hojeKey + 'T00:00:00Z');
  var sent = 0, failed = 0;

  for (var i = 0; i < usersSnap.docs.length; i++) {
    var userDoc = usersSnap.docs[i];
    var user = userDoc.data();
    var email = String(user.email || '').trim().toLowerCase();
    if (!email) continue;

    var plano = String(user.plano || 'free').toLowerCase();
    var isTrial = plano === 'trial';
    var expira = _toDate(isTrial ? user.trialFim : user.planoExpira);
    var pendente = Boolean(user.pagamentoPendente);
    var avisos = user.emailAssinaturaAvisos || {};
    var tipoAviso = null;
    var titulo = '';
    var mensagem = '';

    if (pendente) {
      var dunning = subscriptionDunningStage(user, hojeKey);
      if (dunning) {
        tipoAviso = 'pagamento_pendente_' + dunning.start + '_' + dunning.stage;
        if (avisos[tipoAviso]) tipoAviso = null;
        else {
          var graceDate = new Date(dunning.graceEnd + 'T12:00:00Z');
          titulo = dunning.stage === 10 ? 'Último dia para regularizar sua assinatura' : 'Não foi possível renovar sua assinatura';
          mensagem = dunning.stage === 10
            ? 'A tolerância para regularização termina hoje (' + _formatDateBR(graceDate) + '). Se o pagamento não for aprovado, sua assinatura será cancelada, sua conta retornará ao plano Gratuito e você precisará contratar um plano novamente. A Bud Finance não negativará seu nome por essa mensalidade.'
            : 'Identificamos uma cobrança recusada na sua assinatura. Regularize o pagamento diretamente no Mercado Pago até ' + _formatDateBR(graceDate) + '. Durante a tolerância de 10 dias seu plano permanece disponível. Se o pagamento não for aprovado até o fim do prazo, a assinatura será cancelada e sua conta retornará ao plano Gratuito. A Bud Finance não negativará seu nome por essa mensalidade.';
        }
      }
    } else if (expira) {
      var expiraKey = _dateKeyBR(expira);
      var dias = Math.round((new Date(expiraKey + 'T00:00:00Z') - hojeUtc) / 86400000);
      if ([7, 3, 1].includes(dias)) {
        tipoAviso = (isTrial ? 'trial_' : 'renovacao_') + dias;
        titulo = isTrial ? 'Seu período de teste está terminando' : 'Sua assinatura será renovada em breve';
        mensagem = isTrial
          ? 'Seu período de teste termina em ' + _formatDateBR(expira) + '. Escolha um plano para continuar usando os recursos premium.'
          : 'Seu plano ' + plano.toUpperCase() + ' será renovado em ' + _formatDateBR(expira) + '. Confira seus dados de pagamento para não perder o acesso.';
      } else if (dias <= 0 && dias >= -1) {
        tipoAviso = isTrial ? 'trial_encerrado' : 'assinatura_vencida';
        titulo = isTrial ? 'Seu período de teste terminou' : 'Sua assinatura venceu';
        mensagem = isTrial
          ? 'Escolha um plano para continuar usando os recursos premium do App Bud Finance.'
          : 'Renove sua assinatura para recuperar o acesso aos recursos do seu plano.';
      }
    }

    if (!tipoAviso) continue;
    if (avisos[tipoAviso] === hojeKey) continue;

    try {
      await sendCommunicationEmail({
        to_email: email,
        to_name: sanitizeStr(user.nome || user.displayName || 'Cliente'),
        email_subject: '[App Bud Finance] ' + titulo,
        email_title: titulo,
        email_preheader: 'Aviso sobre sua assinatura do App Bud Finance.',
        email_body: mensagem,
        action_label: pendente ? 'Regularizar assinatura' : isTrial ? 'Escolher plano' : 'Gerenciar renovação',
        action_url: FRONTEND_URL + '/?email_destino=assinatura&aviso=' + subscriptionEmailProof(userDoc.id, email)
      });
      await userDoc.ref.update({ ['emailAssinaturaAvisos.' + tipoAviso]: hojeKey });
      sent++;
    } catch (err) {
      console.error('[assinaturas] Falha ao enviar e-mail para ' + userDoc.id + ':', err.message);
      failed++;
    }
  }
  return { sent: sent, failed: failed, total: usersSnap.size };
}

async function cancelarAssinaturasForaDaTolerancia(agora) {
  if (!MP_ACCESS_TOKEN || !db) return { cancelled: 0, failed: 1, skipped: 'billing_not_configured' };
  var usersSnap;
  try {
    usersSnap = await db.collection('usuarios').where('pagamentoPendente', '==', true).limit(500).get();
  } catch (err) {
    console.error('[inadimplencia] Falha ao buscar contas pendentes:', err.message);
    return { cancelled: 0, failed: 1, error: 'query_failed' };
  }
  var cancelled = 0, recovered = 0, deferred = 0, failed = 0;
  for (var i = 0; i < usersSnap.docs.length; i++) {
    var userDoc = usersSnap.docs[i], uid = userDoc.id, profile = userDoc.data();
    var age = _pendingDayCount(profile, agora);
    var subscriptionId = String(profile.mpSubscriptionId || '');
    if (!profile.pagamentoPendente || profile.assinaturaStatus !== 'past_due' || !subscriptionId || age == null || age <= PAYMENT_GRACE_DAYS) continue;
    if (process.env.BUD_USE_EMULATOR === 'true' || /^(LOCAL_TEST_|SANDBOX_TEST_)/.test(subscriptionId)) continue;
    try {
      var since = _toDate(profile.pagamentoPendenteDesde);
      var invoiceUrl = 'https://api.mercadopago.com/authorized_payments/search?preapproval_id=' + encodeURIComponent(subscriptionId) + '&limit=20';
      var invoiceRes = await fetch(invoiceUrl, { headers: { Authorization: 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(8000) });
      if (!invoiceRes.ok) throw new Error('MP invoice search HTTP ' + invoiceRes.status);
      var invoiceData = await invoiceRes.json();
      var invoices = Array.isArray(invoiceData.results) ? invoiceData.results : [];
      var approved = invoices.find(function (invoice) {
        return invoice.payment && invoice.payment.status === 'approved' && invoice.payment.id &&
          (!since || new Date(invoice.last_modified || invoice.date_created).getTime() >= since.getTime());
      });
      if (approved) {
        await _mpHandlePayment(String(approved.payment.id), subscriptionId);
        recovered++;
        continue;
      }
      if (invoices.some(function (invoice) {
        return (!since || new Date(invoice.last_modified || invoice.date_created).getTime() >= since.getTime()) &&
          ['recycling', 'waiting for gateway'].includes(String(invoice.status || '').toLowerCase());
      })) {
        deferred++;
        continue;
      }

      var paymentId = String(profile.pagamentoPendentePagamentoId || '');
      if (!paymentId) { deferred++; continue; }
      var paymentRes = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
        headers: { Authorization: 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(8000)
      });
      if (!paymentRes.ok) throw new Error('MP payment HTTP ' + paymentRes.status);
      var payment = await paymentRes.json();
      if (String(payment.preapproval_id || (payment.point_of_interaction?.transaction_data?.subscription_id) || '') !== subscriptionId) { deferred++; continue; }
      if (payment.status === 'approved') {
        await _mpHandlePayment(paymentId, subscriptionId);
        recovered++;
        continue;
      }
      if (payment.status !== 'rejected') { deferred++; continue; }

      var subRes = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), {
        headers: { Authorization: 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(8000)
      });
      if (!subRes.ok) throw new Error('MP subscription HTTP ' + subRes.status);
      var sub = await subRes.json();
      if (String(sub.id) !== subscriptionId || String(sub.external_reference || '').split('|')[0] !== uid) { deferred++; continue; }
      if (['cancelled', 'canceled', 'paused'].includes(String(sub.status || '').toLowerCase())) {
        await _mpHandleSubscription(subscriptionId);
        cancelled++;
        continue;
      }
      if (!['authorized', 'pending'].includes(String(sub.status || '').toLowerCase())) { deferred++; continue; }

      var latest = await userDoc.ref.get(), current = latest.exists ? latest.data() : {};
      var currentSince = _toDate(current.pagamentoPendenteDesde);
      if (!current.pagamentoPendente || current.assinaturaStatus !== 'past_due' || current.mpSubscriptionId !== subscriptionId ||
          !currentSince || currentSince.getTime() !== since.getTime()) { deferred++; continue; }

      var cancelRes = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), {
        method: 'PUT', headers: { Authorization: 'Bearer ' + MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }), signal: AbortSignal.timeout(8000)
      });
      if (!cancelRes.ok) throw new Error('MP cancellation HTTP ' + cancelRes.status);
      var confirmRes = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), {
        headers: { Authorization: 'Bearer ' + MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(8000)
      });
      if (!confirmRes.ok) throw new Error('MP cancellation confirmation HTTP ' + confirmRes.status);
      var confirmedSub = await confirmRes.json();
      if (!['cancelled', 'canceled'].includes(String(confirmedSub.status || '').toLowerCase())) { deferred++; continue; }
      await _mpUpdateSubscriptionProfile(uid, subscriptionId, {
        plano: 'free', assinaturaStatus: 'cancelled', pagamentoPendente: false,
        pagamentoPendenteDesde: admin.firestore.FieldValue.delete(),
        pagamentoPendentePagamentoId: admin.firestore.FieldValue.delete(),
        planoExpira: admin.firestore.FieldValue.delete(), planoTroca: admin.firestore.FieldValue.delete(),
        mpCheckout: admin.firestore.FieldValue.delete(), planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      });
      cancelled++;
    } catch (err) {
      console.error('[inadimplencia] Falha no encerramento automático:', err.message);
      deferred++;
      failed++;
    }
  }
  return { cancelled: cancelled, recovered: recovered, deferred: deferred, failed: failed, total: usersSnap.size };
}

// â”€â”€â”€ GET /api/notifications/daily â€” cron de notificaÃ§Ãµes personalizadas â”€â”€
// Auth: x-cron-secret header (env CRON_SECRET)
// Trigger sugerido: Upstash QStash, diariamente Ã s 11:00 UTC (08:00 BrasÃ­lia)
//   â†’ GET https://bud-finance-backend.onrender.com/api/notifications/daily
//   â†’ Header: x-cron-secret: <CRON_SECRET>
app.get('/api/notifications/daily', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var cronSecret = String(process.env.CRON_SECRET || '').trim();
  var provided   = String(req.headers['x-cron-secret'] || req.query.secret || '').trim();
  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  // Homologação do agendamento: confere acesso e banco sem enviar push ou e-mail.
  if (req.query.dry_run === '1') {
    const recipients = await db.collection('usuarios').where('pushEnabled', '==', true).limit(1).get();
    return res.json({ ok: true, dryRun: true, pushRecipientsFound: !recipients.empty, schedule: '18:00 America/Sao_Paulo' });
  }

  const agora=new Date();
  const clockParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(agora).map(p=>[p.type,p.value]));
  const hojeStr=clockParts.year+'-'+clockParts.month+'-'+clockParts.day;
  const horaAtual=Number(clockParts.hour);

  // Quiet hours 22hâ€“8h BrasÃ­lia
  if (horaAtual < 8 || horaAtual >= 22) {
    return res.json({ ok: true, skipped: 'quiet_hours', hora: horaAtual });
  }

  // E-mails de assinatura independem de push ativado e são deduplicados por dia.
  var subscriptionEmails = await enviarLembretesDeAssinatura(agora);
  // Após 10 dias completos, só cancela se o provedor ainda confirma a recusa,
  // não há fatura aprovada e o mesmo vínculo continua pendente.
  var subscriptionCancellations = await cancelarAssinaturasForaDaTolerancia(agora);

  // Buscar usuÃ¡rios com push ativado (max 500 por execuÃ§Ã£o)
  var usersSnap;
  try {
    usersSnap = await db.collection('usuarios').where('pushEnabled', '==', true).limit(500).get();
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar usuÃ¡rios: ' + e.message });
  }

  if (usersSnap.empty) return res.json({ ok: true, sent: 0, errors: (subscriptionEmails.failed || 0) + (subscriptionCancellations.failed || 0), total: 0, subscriptionEmails: subscriptionEmails, subscriptionCancellations: subscriptionCancellations });

  var sent = 0, errors = (subscriptionEmails.failed || 0) + (subscriptionCancellations.failed || 0);

  for (var i = 0; i < usersSnap.docs.length; i++) {
    var userDoc = usersSnap.docs[i];
    var uid = userDoc.id;
    var ud  = userDoc.data();
    var tokens = [...new Set([...(ud.fcmTokens || []), ud.fcmToken].filter(Boolean))];
    if (!tokens.length) continue;

    try {
      var notifs = [];

      // Sem IA e sem comunicados promocionais: somente pendências financeiras atuais.
      var [recSnap, cartSnap, dividaSnap, txSnap] = await Promise.all([
        db.collection('usuarios').doc(uid).collection('recorrentes').where('ativa', '==', true).get(),
        db.collection('usuarios').doc(uid).collection('carteira').where('tipo', '==', 'credito').get(),
        db.collection('usuarios').doc(uid).collection('dividas').get(),
        db.collection('usuarios').doc(uid).collection('transacoes').select('cartaoId','pagamentoFatura','status','valor','dataReferencia','data','mesReferencia','recorrenteId','origem','tipo','descricao','confirmado','pago','pendenteConfirmacao').get()
      ]);
      var records = snap => snap.docs.map(d => Object.assign({ _id: d.id }, d.data()));
      notifs = financialNotices({recorrentes:records(recSnap),cartoes:records(cartSnap),dividas:records(dividaSnap),transacoes:records(txSnap)},hojeStr);

      var subscriptionNotifs = subscriptionPushNotices(ud,hojeStr);
      if (notifs.length === 0 && subscriptionNotifs.length === 0) continue;

      // Cada pendência mantém tag estável por dia para deduplicação.
      var toSend = notifs.length > 3 ? [{
        tag:'financial-summary-'+hojeStr+'-'+uid,title:notifs.length+' pendências financeiras',
        body:notifs.slice(0,2).map(n=>n.body).join(' · ').slice(0,220),url:'dashboard.html',emoji:'🔔'
      }] : notifs;
      toSend = subscriptionNotifs.concat(toSend);

      // Enviar cada notificaÃ§Ã£o via FCM + salvar no Firestore
      var batch  = db.batch();
      var notifRef = db.collection('usuarios').doc(uid).collection('notificacoes');

      for (var j = 0; j < toSend.length; j++) {
        var n = toSend[j];

        // DeduplicaÃ§Ã£o por tag
        var existSnap = await db.collection('usuarios').doc(uid).collection('notificacoes')
          .where('tag', '==', n.tag).limit(1).get();
        if (!existSnap.empty) continue;

        // Enviar FCM
        try {
          const delivery = await sendFinancialPush(admin.messaging(),tokens,n,FRONTEND_URL);
          if(delivery.invalid.length) {
            const patch={fcmTokens:admin.firestore.FieldValue.arrayRemove(...delivery.invalid)};
            if(delivery.invalid.includes(ud.fcmToken)) patch.fcmToken=admin.firestore.FieldValue.delete();
            await db.collection('usuarios').doc(uid).update(patch);
          }
          if(!delivery.successCount){errors++;continue;}
          sent += delivery.successCount;

        } catch (fcmErr) {
          errors++;
          continue;
        }

        // Salvar histÃ³rico
        var docRef = notifRef.doc();
        batch.set(docRef, {
          tag:      n.tag,
          title:    n.title,
          body:     n.body,
          emoji:    n.emoji || 'ðŸ“¢',
          url:      n.url || 'dashboard.html',
          isBuddy:  n.isBuddy || false,
          read:     false,
          criadoEm: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

    } catch (userErr) {
      console.error('[notifications/daily] uid=' + uid, userErr.message);
      errors++;
    }
  }

  return res.json({ ok: true, sent: sent, errors: errors, total: usersSnap.size, subscriptionEmails: subscriptionEmails, subscriptionCancellations: subscriptionCancellations });
});

// â”€â”€â”€ Start server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(safeError);
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('[Bud Finance Backend] Running on port ' + PORT);
});



