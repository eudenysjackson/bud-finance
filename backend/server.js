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

// â”€â”€â”€ Firebase Admin init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Service account credentials injected via environment variable.
// On Render: FIREBASE_SERVICE_ACCOUNT = JSON string of the service account key.
// Em dev local sem credenciais, o servidor sobe mesmo assim â€” apenas as rotas
// que usam auth/db ficam indisponÃ­veis (ex: /reset-senha). /api/extrair-cupom
// nÃ£o usa Firebase e funciona normalmente.
let auth, db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  auth = admin.auth();
  db   = admin.firestore();
} catch (e) {
  console.warn('[Firebase Admin] Credenciais ausentes ou invÃ¡lidas. Rotas /reset-senha e similares nÃ£o funcionarÃ£o:', e.message);
}

// â”€â”€â”€ EmailJS config (env vars â€” set on Render) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || '';
const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || '';
const EMAILJS_TEMPLATE_ID           = process.env.EMAILJS_TEMPLATE_RECUPERAR_SENHA || '';
const EMAILJS_TEMPLATE_CHAMADO      = process.env.EMAILJS_TEMPLATE_CHAMADO || '';
const EMAILJS_TEMPLATE_BOAS_VINDAS  = process.env.EMAILJS_TEMPLATE_BOAS_VINDAS || '';
const FRONTEND_URL                  = process.env.FRONTEND_URL || 'https://budsolucoes.com.br/appbudfinance';

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
// planKey â†’ tÃ­tulo e preÃ§o mensal (BRL)
const MP_PLANS = {
  starter: { title: 'Bud Finance Starter', amount: 9.99  },
  pro:     { title: 'Bud Finance Pro',     amount: 29.90 },
  plus:    { title: 'Bud Finance Plus',    amount: 49.90 }
};
const MP_INDICACAO_DESCONTO = 0.10; // 10% off para links de indicaÃ§Ã£o

// â”€â”€â”€ Express setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();
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
  'https://www.budsolucoes.com.br',
  // Origens locais de desenvolvimento â€” seguras pois localhost/127.0.0.1 nÃ£o Ã© acessÃ­vel externamente.
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
const ALLOWED_ORIGINS = IS_PROD
  ? ALLOWED_ORIGINS_PROD
  : ALLOWED_ORIGINS_PROD.concat(ALLOWED_ORIGINS_DEV);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['POST', 'GET', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
    // EmailJS not configured â€” skip silently
    return;
  }

  var response = await fetch('https://api.emailjs.com/api/v1.6/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  EMAILJS_SERVICE_ID,
      template_id: tid,
      user_id:     EMAILJS_PUBLIC_KEY,
      template_params: templateParams
    })
  });

  if (!response.ok) {
    throw new Error('EmailJS HTTP ' + response.status);
  }
}

// â”€â”€â”€ POST /api/boas-vindas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Gera o link de verificaÃ§Ã£o de e-mail (Firebase Admin) e envia o
// email de boas-vindas com o link via EmailJS (server-side).
// O link completo de verificaÃ§Ã£o nunca Ã© exposto ao cliente.
app.post('/api/boas-vindas', async function (req, res) {
  try {
    if (!auth) return res.status(503).json({ success: false, message: 'Servico indisponivel.' });

    var email     = (req.body.email    || '').trim().toLowerCase();
    var nome      = (req.body.nome     || 'Usuario').substring(0, 100);
    var matricula = (req.body.matricula || '').substring(0, 20);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false });
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

    // Envia email de boas-vindas com o link real (ou fallback para login)
    var emailSent = false;
    try {
      await sendEmailViaEmailJS({
        to_email:   email,
        to_name:    nome,
        matricula:  matricula,
        verify_url: verifyLink || (FRONTEND_URL + '/index.html'),
        app_url:    FRONTEND_URL + '/index.html'
      }, EMAILJS_TEMPLATE_BOAS_VINDAS);
      emailSent = true;
    } catch (_emailErr) {
      // Falha de email nao bloqueia o cadastro
    }

    // Retorna se o email foi enviado — frontend nao deve duplicar
    return res.json({ success: true, emailSent: emailSent, hasVerifyLink: !!verifyLink });
  } catch (_err) {
    return res.json({ success: true, emailSent: false, hasVerifyLink: false });
  }
});

// â”€â”€â”€ POST /api/iniciar-trial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ativado automaticamente apÃ³s cadastro: concede 3 dias no plano Pro.
// Usa Firebase Admin SDK para contornar regras Firestore de create.
app.post('/api/iniciar-trial', express.json(), async function (req, res) {
  if (!db) return res.status(503).json({ ok: false, error: 'Firebase Admin nÃ£o inicializado.' });

  // Verificar token JWT â€” UID extraÃ­do do token, nunca do body
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ ok: false, error: 'Token ausente.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token invÃ¡lido.' }); }
  var uid = decoded.uid;
  try {
    var ref = db.collection('usuarios').doc(uid);
    var snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'UsuÃ¡rio nÃ£o encontrado.' });
    var data = snap.data();
    // SÃ³ ativa trial em contas sem plano ou no free (nÃ£o sobrescreve planos pagos)
    if (data.plano && data.plano !== 'free') {
      return res.json({ ok: true, msg: 'Plano jÃ¡ definido.' });
    }
    var trialFim = new Date();
    trialFim.setDate(trialFim.getDate() + 3);
    await ref.update({
      plano:         'trial',
      trialFim:      admin.firestore.Timestamp.fromDate(trialFim),
      trialIniciado: admin.firestore.FieldValue.serverTimestamp()
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
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token invÃ¡lido.' }); }
  var uid = decoded.uid;
  try {
    var ref = db.collection('usuarios').doc(uid);
    var snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false });
    var data = snap.data();
    if (data.plano !== 'trial') return res.json({ ok: true, msg: 'N\u00e3o era trial.' });
    // Confirmar que realmente expirou
    var trialFim = data.trialFim;
    if (trialFim && trialFim.toDate && trialFim.toDate() > new Date()) {
      return res.json({ ok: false, msg: 'Trial ainda ativo.' });
    }
    await ref.update({
      plano:         'free',
      trialFim:      admin.firestore.FieldValue.delete(),
      trialIniciado: admin.firestore.FieldValue.delete()
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
    var resetUrl = FRONTEND_URL + '/acao-auth.html?oobCode=' + encodeURIComponent(oobCode);

    // Send email via EmailJS REST API (oobCode stays on the server)
    try {
      await sendEmailViaEmailJS({
        to_email: email,
        to_name:  userName,
        reset_url: resetUrl
      });
    } catch (_emailErr) {
      // Email failed â€” but don't leak info to the client
    }

    return res.json({ success: true });

  } catch (_err) {
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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
    'INCLUA: compras Ã  vista, parcelas de compras antigas (ex: "3/10 LOJA X"), IOF embutido em compras internacionais, juros de financiamento de compra especÃ­fica, anuidade, ajustes a dÃ©bito.',
    'INCLUA ESTORNOS com valor NEGATIVO (ex: "Estorno de Uber" â†’ valor: -11.93). Eles compensam compras e fazem parte da soma final.',
    'IGNORE ESTRITAMENTE (nunca inclua como transaÃ§Ã£o):',
    '- Linhas de pagamento: "Pagamento recebido", "Pagamento em DD MMM", "Pagamento de fatura"',
    '- Subtotais de seÃ§Ã£o: "Outros lanÃ§amentos R$ X", "Total de compras R$ X", "Pagamentos e Financiamentos R$ X", "Fatura anterior R$ X"',
    '- Subtotais por portador: linha com nome de pessoa + valor (ex: "JoÃ£o Silva   R$ 1.756,22") que aparece antes das transaÃ§Ãµes do portador',
    '- Linhas de saldo: "Saldo restante da fatura anterior", "Saldo em aberto", "Pagamento mÃ­nimo"',
    '- Tarifas e encargos bancÃ¡rios standalone: linhas como "CUSTO TRANS. EXTERIOR-IOF", "IOF OPERACAO", "ENCARGO FINANCEIRO", "TARIFA BANCARIA", "MULTA", "MORA", "JUROS ROTATIVO" que aparecem como cobranÃ§as avulsas sem uma compra associada',
    '- CabeÃ§alhos de seÃ§Ã£o e rodapÃ©s (nÃºmero de pÃ¡gina, CNPJ, endereÃ§o)',
    'A soma dos valores extraÃ­dos (positivos + negativos dos estornos) deve bater com "Pagamento total da fatura" / "Total a pagar" do documento.',
    'TAREFA EXTRA: capture em "meta" DOIS totais: "totalCompras" ("Total de compras", sÃ³ novas compras) E "totalAPagar" ("Pagamento total da fatura" ou "Total a pagar", valor cobrado).',
    'Retorne SOMENTE JSON vÃ¡lido: {"transacoes":[{"desc":"Loja","valor":50.00,"data":"2026-04-01"}],"meta":{"totalCompras":908.47,"totalAPagar":1242.36}}'
  ].join(' ');

  // Limita texto a 30k chars para nÃ£o estourar contexto
  var textoLimitado = text.length > 30000 ? text.substring(0, 30000) : text;

  var body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: promptInstrucoes },
      { role: 'user', content: 'Texto do extrato:\n\n' + textoLimitado }
    ],
    temperature: 0.0,
    max_tokens: 8192,
    response_format: { type: 'json_object' }
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 40000);

  try {
    var resp = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
    // Retry once on rate limit
    if (resp.status === 429) {
      await new Promise(function(r){ setTimeout(r, 1500); });
      resp = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
      );
    }
    clearTimeout(timeoutId);
    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return resp.status; });
      throw new Error('Groq API: ' + errText);
    }
    var data = await resp.json();
    var content = (data.choices || [])[0]?.message?.content || '{}';
    var parsed;
    try { parsed = JSON.parse(content); }
    catch (_e) {
      var objMatch = content.match(/\{[\s\S]*\}/);
      try { parsed = objMatch ? JSON.parse(objMatch[0]) : null; } catch(_e2) { parsed = null; }
    }
    var txArr   = (parsed && Array.isArray(parsed.transacoes)) ? parsed.transacoes : (Array.isArray(parsed) ? parsed : []);
    var metaObj = (parsed && parsed.meta) ? parsed.meta : null;
    return {
      transacoes: txArr.filter(function(t){ return t.desc && parseFloat(t.valor) !== 0; }),
      meta: metaObj
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
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

  var messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: 'data:' + mimeType + ';base64,' + base64 }
        },
        { type: 'text', text: prompt }
      ]
    }
  ];

  var body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: messages,
    temperature: 0.0,
    max_tokens: 8192,
    response_format: { type: 'json_object' }
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 40000);

  try {
    var resp = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
    // Retry once on rate limit
    if (resp.status === 429) {
      await new Promise(function(r){ setTimeout(r, 1500); });
      resp = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
      );
    }
    clearTimeout(timeoutId);

    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return resp.status; });
      throw new Error('Groq API: ' + errText);
    }

    var data = await resp.json();
    var content = (data.choices || [])[0]?.message?.content || '[]';

    // Tenta extrair JSON vÃ¡lido da resposta (objeto {transacoes,meta} ou array)
    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      var objMatch = content.match(/\{[\s\S]*\}/);
      var arrMatch = content.match(/\[[\s\S]*\]/);
      try { parsed = objMatch ? JSON.parse(objMatch[0]) : (arrMatch ? JSON.parse(arrMatch[0]) : null); }
      catch (_e2) { parsed = null; }
    }

    // Formato esperado: {"transacoes":[...], "meta":{...}} â€” tanto extrato como fatura
    var txArr   = Array.isArray(parsed) ? parsed : ((parsed && parsed.transacoes) || []);
    var metaObj = (!Array.isArray(parsed) && parsed && parsed.meta) ? parsed.meta : null;
    return { transacoes: txArr.filter(function(t){ return t.desc && parseFloat(t.valor) !== 0; }), meta: metaObj };

  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// â”€â”€â”€ POST /api/extrair-fatura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Recebe: multipart/form-data { arquivo: File (PDF|JPEG|PNG|WEBP) }
// Retorna: [{desc, valor, data}] â€” transaÃ§Ãµes extraÃ­das
app.post('/api/extrair-fatura', upload.single('arquivo'), async function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    var buffer   = req.file.buffer;
    var mimeType = req.file.mimetype;
    var tipo     = req.body.tipo || 'extrato';
    var transacoes = [];
    var aiMeta = null;
    var textMeta = null;

    if (mimeType === 'application/pdf') {
      // â”€â”€ 1) Extrair texto do PDF com pdf-parse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      var pdfData;
      try {
        pdfData = await pdfParse(buffer, { max: 20 });
      } catch (pdfErr) {
        // PDF ilegÃ­vel ou criptografado â€” retornar erro direto (visÃ£o IA nÃ£o lÃª PDFs binÃ¡rios)
        return res.status(422).json({
          error: 'NÃ£o foi possÃ­vel ler o PDF. O arquivo pode estar protegido por senha ou corrompido. Tente exportar o extrato como imagem ou use um arquivo OFX.'
        });
      }

      if (pdfData) {
        // â”€â”€ 2) Extrair meta do texto e preparar transaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€
        textMeta = extractMetaFromText(pdfData.text || '');

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

        if (precisaIA && process.env.GROQ_API_KEY && pdfData.text) {
          try {
            var aiTextResult = await extractWithAIFromText(pdfData.text, tipo);
            if (!aiMeta && aiTextResult.meta) aiMeta = aiTextResult.meta;
            var bestMeta = aiMeta || textMeta;
            var aiScore     = captureScore(aiTextResult.transacoes, bestMeta);
            var parserScore2 = captureScore(transacoes, bestMeta);
            // Adota IA se capturou mais transaÃ§Ãµes ou se score Ã© maior
            if (aiTextResult.transacoes.length > transacoes.length ||
                (aiScore !== null && (parserScore2 === null || aiScore > parserScore2))) {
              transacoes = aiTextResult.transacoes;
            }
          } catch (_aiErr) {
            console.warn('[AI text-mode falhou]', _aiErr.message);
          }
        }

        // Nota: IA-visÃ£o removida para PDFs â€” modelos de visÃ£o nÃ£o processam PDF binÃ¡rio.
        // Somente imagens (JPEG/PNG/WEBP/HEIC) sÃ£o enviadas para extractWithAI.
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
      return res.status(422).json({
        error: 'Nenhuma transaÃ§Ã£o encontrada. Verifique se o arquivo Ã© um extrato vÃ¡lido e tente novamente.'
      });
    }

    var meta = aiMeta || textMeta || null;
    return res.json({ transacoes: transacoes, meta: meta });

  } catch (err) {
    var safeMsg = (err.message || '').replace(/(key=)[^\s&]+/, '$1***');
    console.error('[extrair-fatura]', safeMsg);
    return res.status(500).json({ error: 'Erro ao processar arquivo. Tente novamente.' });
  }
});

// â”€â”€â”€ Cache em memÃ³ria de extraÃ§Ã£o de cupom (24h) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Chave: SHA-256 do buffer de cada arquivo combinado.
// Reduz custo Gemini quando o usuÃ¡rio re-envia o mesmo print.
var crypto = require('crypto');
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

/**
 * Extrai itens de cupom fiscal / print de app de mercado usando Groq (llama-4-scout vision).
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
    'Categorias: "Mercado" (alimentos, hortifrÃºti, carnes, laticÃ­nios), "Padaria/CafÃ©" (pÃ£es, bolos, cafÃ©), "Bares/Baladas" (bebidas alcoÃ³licas, refrigerantes), "FarmÃ¡cia" (higiene, medicamentos, limpeza), "Pets" (raÃ§Ã£o, areia), "Material Escolar", "Outros" (sacolas, embalagens, demais).',
    '',
    'Exemplo NFC-e (2 itens):',
    '  005 7896982103388 OVGS MANT GDE C/20 UN â†’ { "nome":"OVGS MANT GDE C/20", "qtd":1, "valor":14.99, "cat":"Mercado" }',
    '  006 7896016500978 FARINH MAND GRANFI UN â†’ 4.000 UN x 6.99  27.96 â†’ { "nome":"FARINH MAND GRANFI", "qtd":4, "valor":27.96, "cat":"Mercado" }',
    '',
    'Retorne SOMENTE JSON (sem markdown):',
    '{"mercado":"Prezunic","cnpj":"12345678000199","data":"2026-04-25","itens":[{"nome":"LAMEN MIOJO 85G","qtd":4,"valor":12.76,"cat":"Mercado"}]}',
    'Se nÃ£o houver itens: {"mercado":"","cnpj":"","data":"","itens":[]}'
  ].join('\n');

  // Monta content: imagens primeiro (mesmo padrÃ£o do extractWithAI que funciona em cartÃµes/extrato)
  var imgContent = buffers.map(function (buf, i) {
    return { type: 'image_url', image_url: { url: 'data:' + (mimeTypes[i] || 'image/jpeg') + ';base64,' + buf.toString('base64') } };
  });
  imgContent.push({ type: 'text', text: prompt });

  var body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: imgContent }],
    temperature: 0.0,
    max_tokens: 8192,
    response_format: { type: 'json_object' }
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 40000);

  async function callGroq() {
    return fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
  }

  try {
    var resp = await callGroq();
    // Retry automÃ¡tico em rate limit (mesmo padrÃ£o do extractWithAI)
    if (resp.status === 429) {
      await new Promise(function(r){ setTimeout(r, 1500); });
      resp = await callGroq();
    }
    clearTimeout(timeoutId);

    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return String(resp.status); });
      throw new Error('Groq API [' + resp.status + ']: ' + errText);
    }

    var data = await resp.json();
    var content = (data.choices || [])[0]?.message?.content || '{}';

    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      var objMatch = content.match(/\{[\s\S]*\}/);
      try { parsed = objMatch ? JSON.parse(objMatch[0]) : {}; } catch(_e2) { parsed = {}; }
    }

    if (typeof parsed !== 'object' || !parsed) parsed = {};
    parsed.itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    parsed.itens = parsed.itens
      .map(function (i) {
        var nome = String(i.nome || i.name || i.descricao || '').trim().slice(0, 60);
        var valor = parseFloat(String(i.valor || i.value || i.total || 0).toString().replace(',', '.')) || 0;
        var qtd = parseFloat(String(i.qtd || i.quantidade || i.quantity || 1).toString().replace(',', '.')) || 1;
        var cat = String(i.cat || i.categoria || 'Mercado').trim();
        return { nome: nome, qtd: qtd, valor: Math.abs(valor), cat: cat };
      })
      .filter(function (i) { return i.nome && i.valor > 0; });

    parsed.mercado = String(parsed.mercado || '').trim().slice(0, 60);
    parsed.cnpj = String(parsed.cnpj || '').replace(/\D/g, '').slice(0, 14);
    parsed.data = String(parsed.data || '').slice(0, 10);

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
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
    'Categorias: "Mercado", "Padaria/CafÃ©", "Bares/Baladas", "FarmÃ¡cia", "Pets", "Material Escolar", "Outros".',
    '"valor" = valor total do item (float positivo). "qtd" = quantidade (1 se desconhecido). "nome" atÃ© 50 chars.',
    'Formato obrigatÃ³rio: {"mercado":"...","cnpj":"...","data":"...","itens":[{"nome":"...","qtd":1,"valor":0.00,"cat":"Mercado"}]}',
    '',
    'TEXTO DO CUPOM:',
    '"""',
    String(texto || '').slice(0, 15000),
    '"""'
  ].join('\n');

  var body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.0,
    max_tokens: 8192,
    response_format: { type: 'json_object' }
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 40000);

  async function callGroq() {
    return fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
  }

  try {
    var resp = await callGroq();
    if (resp.status === 429) {
      await new Promise(function(r){ setTimeout(r, 1500); });
      resp = await callGroq();
    }
    clearTimeout(timeoutId);
    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return String(resp.status); });
      throw new Error('Groq API [' + resp.status + ']: ' + errText);
    }
    var data = await resp.json();
    var content = (data.choices || [])[0]?.message?.content || '{}';
    var parsed;
    try { parsed = JSON.parse(content); }
    catch (_e) {
      var objMatch = content.match(/\{[\s\S]*\}/);
      try { parsed = objMatch ? JSON.parse(objMatch[0]) : {}; } catch(_e2) { parsed = {}; }
    }
    if (typeof parsed !== 'object' || !parsed) parsed = {};
    parsed.itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    parsed.itens = parsed.itens
      .map(function (i) {
        return {
          nome: String(i.nome || i.name || i.descricao || '').trim().slice(0, 60),
          qtd: parseFloat(String(i.qtd || i.quantidade || 1).toString().replace(',', '.')) || 1,
          valor: Math.abs(parseFloat(String(i.valor || i.value || 0).toString().replace(',', '.')) || 0),
          cat: String(i.cat || i.categoria || 'Mercado').trim(),
        };
      })
      .filter(function (i) { return i.nome && i.valor > 0; });
    parsed.mercado = String(parsed.mercado || '').trim().slice(0, 60);
    parsed.cnpj = String(parsed.cnpj || '').replace(/\D/g, '').slice(0, 14);
    parsed.data = String(parsed.data || '').slice(0, 10);
    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// â”€â”€â”€ Multer pra cupom (atÃ© 3 arquivos) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var uploadCupom = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 3 }, // 3 MB cada (base64 â‰ˆ 4MB = limite Groq)
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
// PEND-MER-07: quotas server-side (free=5, starter=30, trial=30, pro/plus=âˆž)
var IA_LIMITES_CUPOM = { free: 5, starter: 30, trial: 30, pro: 9999, plus: 9999 };

async function verificarQuotaIA(uid) {
  if (!db) return; // Firebase nÃ£o iniciado â€” permite (degrada gracefully)
  var anoMes = (function() {
    var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })();
  var userDoc = await db.collection('usuarios').doc(uid).get();
  var plano = (userDoc.exists && userDoc.data() && userDoc.data().plano)
    ? userDoc.data().plano.toLowerCase() : 'free';
  var limite = IA_LIMITES_CUPOM[plano] || 5;
  if (limite >= 9999) return; // ilimitado
  var usoSnap = await db.collection('usuarios').doc(uid).collection('uso-ia').doc(anoMes).get();
  var uso = (usoSnap.exists && usoSnap.data() && usoSnap.data().mercado) ? usoSnap.data().mercado : 0;
  if (uso >= limite) {
    var err = new Error('Limite mensal de ' + limite + ' extraÃ§Ãµes atingido. FaÃ§a upgrade para continuar.');
    err.status = 429;
    throw err;
  }
}

async function incrementarQuotaIA(uid) {
  if (!db) return;
  var anoMes = (function() {
    var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })();
  try {
    var FieldValue = require('firebase-admin').firestore.FieldValue;
    await db.collection('usuarios').doc(uid).collection('uso-ia').doc(anoMes).set(
      { mercado: FieldValue.increment(1) }, { merge: true }
    );
  } catch (_e) { /* silencioso */ }
}

app.post('/api/extrair-cupom', function (req, res) {
  uploadCupom.array('arquivos', 3)(req, res, async function (multerErr) {
  if (multerErr) {
    var msg = multerErr.code === 'LIMIT_FILE_SIZE'
      ? 'Imagem muito grande. MÃ¡ximo 3MB por arquivo. Comprima a imagem ou use a aba Texto.'
      : multerErr.message || 'Erro ao processar arquivo.';
    return res.status(413).json({ error: msg });
  }
  try {
    // PEND-MER-07: autenticaÃ§Ã£o + quota server-side
    var cupomUid = null;
    var authHeaderCupom = req.headers.authorization || '';
    var idTokenCupom = authHeaderCupom.startsWith('Bearer ') ? authHeaderCupom.slice(7) : null;
    if (idTokenCupom && auth) {
      try {
        var decodedCupom = await auth.verifyIdToken(idTokenCupom);
        cupomUid = decodedCupom.uid;
        await verificarQuotaIA(cupomUid);
      } catch (authErr) {
        if (authErr.status === 429) return res.status(429).json({ error: authErr.message });
        // token invÃ¡lido â†’ continua sem quota (nÃ£o bloqueia usuÃ¡rio)
        cupomUid = null;
      }
    }

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
      if (cupomUid) incrementarQuotaIA(cupomUid);
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
    var hasPdf = mimeTypes.some(function (m) { return m === 'application/pdf'; });
    if (hasPdf) {
      var pdfTexts = [];
      for (var pi = 0; pi < req.files.length; pi++) {
        if (mimeTypes[pi] === 'application/pdf') {
          try {
            var pdfDataCupom = await pdfParse(buffers[pi], { max: 20 });
            if (pdfDataCupom.text && pdfDataCupom.text.trim().length > 10) {
              pdfTexts.push(pdfDataCupom.text.trim());
            }
          } catch (pdfErr) {
            console.warn('[extrair-cupom] pdf-parse falhou:', pdfErr.message);
          }
        }
      }
      var combinedPdfText = pdfTexts.join('\n\n---\n\n').trim();
      if (!combinedPdfText || combinedPdfText.length < 20) {
        return res.status(422).json({ error: 'NÃ£o foi possÃ­vel extrair texto do PDF. Tente fotografar o cupom (aba Foto).' });
      }
      var resultPdf = await extractCupomFromText(combinedPdfText);
      cupomCacheSet(cacheKey, resultPdf);
      if (cupomUid) incrementarQuotaIA(cupomUid);
      return res.json(resultPdf);
    }

    var result = await extractCupomWithGroq(buffers, mimeTypes);

    cupomCacheSet(cacheKey, result);
    if (cupomUid) incrementarQuotaIA(cupomUid);
    return res.json(result);

  } catch (err) {
    var safeMsg = (err.message || '').replace(/(key=)[^\s&]+/, '$1***');
    console.error('[extrair-cupom]', safeMsg);
    var isGroqErr = /Groq API/.test(safeMsg);
    var status = isGroqErr ? 502 : 500;
    var userMsg = safeMsg.includes('aborted')
      ? 'Tempo limite excedido. Tente uma imagem menor ou use a aba Texto.'
      : 'Erro ao processar cupom. Verifique a imagem e tente novamente.';
    return res.status(status).json({ error: userMsg });
  }
  }); // fim uploadCupom callback
});

// â”€â”€â”€ POST /api/analisar-documento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PEND-063: Classifica automaticamente documentos financeiros (contrato de
// emprÃ©stimo, boleto, fatura de cartÃ£o, extrato bancÃ¡rio, investimento etc.)
// sem exigir que o usuÃ¡rio identifique o tipo manualmente.
// Aceita PDF e imagens. Retorna { ok, tipo, confianca, dados }.
app.post('/api/analisar-documento', upload.single('arquivo'), async function (req, res) {
  // AutenticaÃ§Ã£o via Bearer token
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ ok: false, error: 'Token ausente.' });
  try { await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token invÃ¡lido.' }); }

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
        var pdfResult = await pdfParse(buffer, { max: 3 });
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

    var modelName = imageB64
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : 'llama3-8b-8192';

    var aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model:           modelName,
        messages:        [
          { role: 'system', content: 'VocÃª Ã© especialista em documentos financeiros brasileiros. Retorne APENAS JSON vÃ¡lido, sem markdown, sem explicaÃ§Ãµes.' },
          ...messages
        ],
        temperature:     0,
        max_tokens:      600,
        response_format: { type: 'json_object' }
      })
    });

    if (!aiResp.ok) {
      console.error('[analisar-documento] Groq HTTP', aiResp.status);
      return res.status(502).json({ ok: false, error: 'Erro ao analisar documento.' });
    }

    var aiJson = await aiResp.json();
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
    console.error('[analisar-documento]', e.message);
    return res.status(500).json({ ok: false, error: 'Erro interno ao processar documento.' });
  }
});

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
    decoded = await auth.verifyIdToken(idToken);
  } catch (_e) {
    return res.status(401).json({ error: 'Token invÃ¡lido ou expirado.' });
  }
  var uid = decoded.uid;

  // â”€â”€ Gate por plano (server-side â€” PEND-034) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var PLANOS_PERMITIDOS_REC = ['pro', 'plus', 'trial'];
  try {
    var userDoc = await db.collection('usuarios').doc(uid).get();
    var plano = (userDoc.exists && userDoc.data().plano) ? userDoc.data().plano.toLowerCase() : 'free';
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
        return diffDias >= 0 && diffDias % 7 === 0;
      }
      // mensal: clamp ao Ãºltimo dia do mÃªs
      var maxDia = new Date(hojeAno, hojeMes, 0).getDate();
      return Math.min(dia, maxDia) === hojeDia;
    });

    if (paraProcessar.length === 0) {
      return res.json({ success: true, processadas: 0, mensagem: 'Nenhuma recorrente vence hoje.' });
    }

    // Anti-duplicidade: buscar transaÃ§Ãµes jÃ¡ lanÃ§adas neste mÃªs por recorrenteId
    var snapTx = await db
      .collection('usuarios').doc(uid).collection('transacoes')
      .where('mesReferencia', '==', mesRef)
      .where('origem', '==', 'recorrente')
      .get();

    var jaProcessados = new Set(
      snapTx.docs.map(function (d) { return d.data().recorrenteId; }).filter(Boolean)
    );

    var novas = paraProcessar.filter(function (rec) {
      return !jaProcessados.has(rec.id);
    });

    if (novas.length === 0) {
      return res.json({ success: true, processadas: 0, mensagem: 'Todas as recorrentes de hoje jÃ¡ foram lanÃ§adas.' });
    }

    // Criar transaÃ§Ãµes em batch (chunks de 400)
    var CHUNK = 400;
    var colTx = db.collection('usuarios').doc(uid).collection('transacoes');
    var dataHoje = hojeAno + '-' + String(hojeMes).padStart(2,'0') + '-' + String(hojeDia).padStart(2,'0');

    for (var ci = 0; ci < novas.length; ci += CHUNK) {
      var chunk = novas.slice(ci, ci + CHUNK);
      var batch = db.batch();
      chunk.forEach(function (rec) {
        var txRef = colTx.doc();
        batch.set(txRef, {
          tipo:           rec.tipo || 'despesa',
          descricao:      sanitizeStr(rec.descricao || '').substring(0, 100),
          valor:          Number(rec.valor) || 0,
          categoria:      sanitizeStr(rec.categoria || 'Outros'),
          dataReferencia: dataHoje,
          mesReferencia:  mesRef,
          formaPagamento: rec.cartaoId ? 'CrÃ©dito' : 'DÃ©bito',
          cartaoId:       rec.cartaoId || null,
          recorrenteId:   rec.id,
          origem:         'recorrente',
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
      mensagem: novas.length + ' recorrente' + (novas.length !== 1 ? 's lanÃ§adas' : ' lanÃ§ada') + ' no Extrato.',
      itens: novas.map(function (r) { return { id: r.id, descricao: r.descricao, valor: r.valor }; }),
    });

  } catch (err) {
    console.error('[processar-recorrentes]', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar recorrentes.' });
  }
});

// â”€â”€â”€ POST /api/chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Chat com IA financeiro pessoal via Groq (llama-4-scout).
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
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido ou expirado.' }); }

  var uid = decoded.uid;

  // Gate de plano server-side
  var PLANOS_CHAT = ['plus', 'trial'];
  try {
    var userSnap = await db.collection('usuarios').doc(uid).get();
    var plano = (userSnap.exists && userSnap.data().plano) ? userSnap.data().plano.toLowerCase() : 'free';
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
    'Site/landing: https://budsolucoes.com.br',
    'App (login): https://budsolucoes.com.br/appbudfinance/',
    'Desenvolvido por: Bud SoluÃ§Ãµes',
    '',
    '=== PLANOS E PREÃ‡OS ===',
    'â€¢ Gratuito (Free): funcionalidades bÃ¡sicas â€” lanÃ§amento manual de receitas e despesas, carteira, extrato, categorias, dashboard, metas e investimentos.',
    'â€¢ Starter â€” R$ 9,99/mÃªs: tudo do Free + Mercado de compras, Limites por categoria, Comparativo mensal, RelatÃ³rios PDF/CSV.',
    'â€¢ Pro â€” R$ 29,90/mÃªs: tudo do Starter + Recorrentes automÃ¡ticas, DÃ­vidas com Tabela Price, GrÃ¡ficos avanÃ§ados, ImportaÃ§Ã£o de extratos (PDF/OFX/CSV/imagem), Insights de saÃºde financeira, BalanÃ§o mensal.',
    'â€¢ Plus â€” R$ 49,90/mÃªs: tudo do Pro + Assistente de IA (vocÃª, o Buddy), Assistente WhatsApp (em breve), Parcelamento inteligente de cartÃ£o via IA.',
    'â€¢ Trial: 3 dias grÃ¡tis com funcionalidades Pro ao criar conta.',
    'Para assinar: acessar https://budsolucoes.com.br (seÃ§Ã£o Planos) ou dentro do app em qualquer banner de upgrade.',
    '',
    '=== CONTATO E SUPORTE ===',
    'E-mail: budsolucoes@gmail.com',
    'WhatsApp: (21) 98355-4954 â€” https://wa.me/5521983554954',
    'Instagram: @appbudfinance â€” https://www.instagram.com/appbudfinance',
    'Site: https://budsolucoes.com.br',
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
        model:       'meta-llama/llama-4-scout-17b-16e-instruct',
        messages:    groqMessages,
        temperature: 0.7,
        max_tokens:  1500,
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
  try { decoded = await auth.verifyIdToken(idToken); }
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
    sendEmailViaEmailJS({
      to_email:  'suporte@budfinance.com.br',
      to_name:   nomeUsuario,
      tipo:      tipo === 'bug' ? 'ðŸ› Bug' : 'ðŸ’¡ SugestÃ£o',
      message:   descricao,
      admin_url: FRONTEND_URL + '/admin.html',
    }, EMAILJS_TEMPLATE_CHAMADO).catch(function () { /* ignora falha de email */ });

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
  try { decoded = await auth.verifyIdToken(idToken); }
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
  try { decoded = await auth.verifyIdToken(idToken); }
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
  try { decoded = await auth.verifyIdToken(idToken); }
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
  try { decoded = await auth.verifyIdToken(idToken); }
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

    sendEmailViaEmailJS({
      to_email:      emailUser,
      to_name:       nomeUsuario,
      assunto:       'Alerta financeiro detectado no Bud Finance',
      corpo:         'O Bud detectou os seguintes pontos de atenÃ§Ã£o nas suas finanÃ§as:\n\n' + alertasTexto + '\n\nAcesse o app para ver detalhes e tomar aÃ§Ã£o.',
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
          fcm_options: { link: FRONTEND_URL + '/assistente-ia.html' }
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
  res.json({ ok: true, ts: Date.now() });
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
  console.log('[WA] nÃºmero vinculado:', numero, 'â†’ uid:', userDoc.id);
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
    console.log('[EVO-DEBUG] messages.upsert FULL:', JSON.stringify(req.body));
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
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  // Verificar plano
  try {
    var userSnap = await db.collection('usuarios').doc(decoded.uid).get();
    var plano = (userSnap.data()?.plano || 'free').toLowerCase();
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
  try { decoded = await auth.verifyIdToken(idToken); }
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
  try { decoded = await auth.verifyIdToken(idToken); }
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
app.post('/mercadopago/create-subscription', async function (req, res) {
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Pagamentos nÃ£o configurados.' });
  if (!auth || !db)     return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  // 1. Verificar token
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var uid   = decoded.uid;
  var email = decoded.email || '';

  // 2. Validar planKey
  var planKey = String(req.body.planKey || '').toLowerCase().trim();
  if (!MP_PLANS[planKey]) return res.status(400).json({ error: 'Plano invÃ¡lido.' });

  var plan   = MP_PLANS[planKey];
  var amount = plan.amount;

  // 3. Validar ref code e aplicar desconto de 10% se indicaÃ§Ã£o legÃ­tima
  var rawRef  = req.body.ref ? String(req.body.ref).trim() : null;
  var refCode = rawRef ? rawRef.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null;
  if (refCode) {
    try {
      var refSnap = await db.collection('usuarios')
        .where('codigoIndicacao', '==', refCode).limit(1).get();
      if (refSnap.empty) {
        refCode = null; // cÃ³digo nÃ£o encontrado â€” sem desconto
      } else {
        amount = Math.round(plan.amount * (1 - MP_INDICACAO_DESCONTO) * 100) / 100;
      }
    } catch (_e) { refCode = null; }
  }

  // 4. external_reference: uid|planKey[|refCode] â€” recuperado no webhook
  var externalRef = uid + '|' + planKey + (refCode ? '|' + refCode : '');

  // 4.5. Buscar dados do usuÃ¡rio no Firestore para enriquecer o payer (melhora aprovaÃ§Ã£o)
  var firstName = '', lastName = '', payerPhone = null;
  try {
    var userSnap = await db.collection('usuarios').doc(uid).get();
    if (userSnap.exists) {
      var ud         = userSnap.data();
      var nomePartes = (ud.nome || '').trim().split(/\s+/);
      firstName  = nomePartes[0] || '';
      lastName   = nomePartes.slice(1).join(' ') || firstName;
      var telLimpo = (ud.telefone || '').replace(/\D/g, '');
      if (telLimpo.length >= 10) {
        payerPhone = { area_code: telLimpo.slice(0, 2), number: telLimpo.slice(2) };
      }
    }
  } catch (_e) { /* nÃ£o bloqueia o fluxo */ }

  // 5. Criar preapproval no Mercado Pago
  // Link expira em 2 horas â€” impede que o link seja usado por terceiros apÃ³s esse perÃ­odo
  var linkExpira = new Date();
  linkExpira.setHours(linkExpira.getHours() + 2);

  var mpBody = {
    reason:               plan.title,
    external_reference:   externalRef,
    payer_email:          email,
    ...(firstName ? { payer_first_name: firstName }  : {}),
    ...(lastName  ? { payer_last_name:  lastName  }  : {}),
    ...(payerPhone ? { payer_phone: payerPhone }      : {}),
    statement_descriptor: 'BUD FINANCE',
    notification_url:     'https://bud-finance-backend.onrender.com/webhook/mercadopago',
    date_of_expiry:       linkExpira.toISOString(),
    auto_recurring: {
      frequency:          1,
      frequency_type:     'months',
      transaction_amount: amount,
      currency_id:        'BRL'
    },
    payment_methods_allowed: [
      { payment_type: 'credit_card'    },
      { payment_type: 'debit_card'     },
      { payment_type: 'account_money' }
    ],
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
      return res.status(502).json({ error: mpData.message || 'Erro ao criar assinatura no Mercado Pago.' });
    }
    var isSandbox  = MP_ACCESS_TOKEN.startsWith('TEST-');
    var checkoutUrl = isSandbox ? (mpData.sandbox_init_point || mpData.init_point) : mpData.init_point;
    return res.json({ init_point: checkoutUrl });
  } catch (err) {
    console.error('[MP] create-subscription fetch error:', err.message);
    return res.status(500).json({ error: 'Erro de comunicaÃ§Ã£o com Mercado Pago.' });
  }
});

// â”€â”€â”€ POST /webhook/mercadopago â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Recebe notificaÃ§Ãµes do Mercado Pago e atualiza o plano no Firestore.
// Configurar no painel MP â†’ IntegraÃ§Ãµes â†’ Webhooks:
//   URL: https://bud-finance-backend.onrender.com/webhook/mercadopago
//   Eventos: subscription_preapproval, payment
app.post('/webhook/mercadopago', async function (req, res) {
  // 1. Verificar assinatura HMAC-SHA256 (obrigatÃ³rio â€” falha se secret nÃ£o configurado)
  if (!MP_WEBHOOK_SECRET) {
    console.error('[MP webhook] MP_WEBHOOK_SECRET nÃ£o configurado â€” rejeitando requisiÃ§Ã£o');
    return res.status(503).json({ error: 'Webhook nÃ£o configurado.' });
  }
  var xSig    = req.headers['x-signature']  || '';
  var xReqId  = req.headers['x-request-id'] || '';
  var dataId  = (req.body.data && req.body.data.id)
    ? String(req.body.data.id) : (req.query['data.id'] || '');
  var tsParts  = xSig.split(',');
  var ts       = (tsParts.find(p => p.startsWith('ts=')) || '').replace('ts=', '');
  var v1       = (tsParts.find(p => p.startsWith('v1=')) || '').replace('v1=', '');
  var manifest = 'id:' + dataId + ';request-id:' + xReqId + ';ts:' + ts + ';';
  var expected = require('crypto').createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  if (expected !== v1) {
    console.warn('[MP webhook] Assinatura invÃ¡lida â€” ignorando');
    return res.status(401).json({ error: 'Assinatura invÃ¡lida.' });
  }

  // 2. Responder imediatamente (MP exige resposta rÃ¡pida)
  res.sendStatus(200);

  if (!db) return;
  var type   = req.body.type   || req.query.type         || '';
  var dataId = (req.body.data && req.body.data.id)
    ? String(req.body.data.id) : (req.query['data.id']   || '');
  if (!dataId) return;

  try {
    if      (type === 'subscription_preapproval') await _mpHandleSubscription(dataId);
    else if (type === 'payment')                  await _mpHandlePayment(dataId);
  } catch (err) {
    console.error('[MP webhook] Erro ao processar notificaÃ§Ã£o:', err.message);
  }
});

// Busca detalhes da assinatura no MP e atualiza o Firestore
async function _mpHandleSubscription(preapprovalId) {
  var mpRes = await fetch('https://api.mercadopago.com/preapproval/' + preapprovalId, {
    headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }
  });
  if (!mpRes.ok) return;
  var sub = await mpRes.json();

  var parts   = String(sub.external_reference || '').split('|');
  var uid     = parts[0];
  var planKey = parts[1];
  var refCode = parts[2] || null;
  if (!uid || !MP_PLANS[planKey]) return;

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
              method:  'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN },
              body:    JSON.stringify({ status: 'cancelled' })
            });
          } catch (_ec) { /* cancelamento falhou â€” ativaÃ§Ã£o bloqueada de qualquer forma */ }
          await db.collection('usuarios').doc(uid).update({
            pagamentoPendente: true,
            erroAssinatura:    'pagador_invalido',
            planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
          });
          return; // nÃ£o ativa o plano
        }
      }
    } catch (_ev) { /* se validaÃ§Ã£o falhar, prossegue com ativaÃ§Ã£o normal */ }

    var expira = new Date();
    expira.setMonth(expira.getMonth() + 1);
    await db.collection('usuarios').doc(uid).update({
      plano:             planKey,
      planoExpira:       admin.firestore.Timestamp.fromDate(expira),
      mpSubscriptionId:  preapprovalId,
      erroAssinatura:    admin.firestore.FieldValue.delete(),
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('[MP webhook] Plano ativado:', uid, planKey);
    if (refCode) await _mpCreditarIndicacao(refCode, uid, planKey);

  } else if (status === 'cancelled' || status === 'paused') {
    await db.collection('usuarios').doc(uid).update({
      plano:             'free',
      mpSubscriptionId:  preapprovalId,
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('[MP webhook] Assinatura cancelada/pausada:', uid);
  }
}

// Para pagamentos avulsos: atualiza Firestore via preapproval_id
async function _mpHandlePayment(paymentId) {
  var mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + paymentId, {
    headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }
  });
  if (!mpRes.ok) return;
  var payment = await mpRes.json();

  // Se pagamento recusado: marca flag no Firestore para o front exibir alerta
  if (payment.status === 'rejected' && payment.preapproval_id) {
    try {
      var subRes  = await fetch('https://api.mercadopago.com/preapproval/' + payment.preapproval_id, {
        headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }
      });
      if (subRes.ok) {
        var sub  = await subRes.json();
        var uid  = String(sub.external_reference || '').split('|')[0];
        if (uid) {
          await db.collection('usuarios').doc(uid).update({
            pagamentoPendente:   true,
            mpSubscriptionId:    String(payment.preapproval_id),
            planoAtualizadoEm:   admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('[MP webhook] Pagamento recusado â€” flag pagamentoPendente:', uid, payment.status_detail);
        }
      }
    } catch (e) { console.error('[MP webhook] Erro ao marcar pagamentoPendente:', e.message); }
    return;
  }

  if (payment.preapproval_id) await _mpHandleSubscription(String(payment.preapproval_id));
}

// Registra indicaÃ§Ã£o bem-sucedida na subcoleÃ§Ã£o do referrer
async function _mpCreditarIndicacao(refCode, novoUid, planKey) {
  try {
    var snap = await db.collection('usuarios')
      .where('codigoIndicacao', '==', refCode).limit(1).get();
    if (snap.empty) return;
    await db.collection('usuarios').doc(snap.docs[0].id)
      .collection('indicacoes').add({
        indicadoUid: novoUid,
        planKey:     planKey,
        creditadoEm: admin.firestore.FieldValue.serverTimestamp()
      });
    console.log('[MP] IndicaÃ§Ã£o creditada:', refCode, 'â†’', novoUid);
  } catch (err) {
    console.error('[MP] Erro ao creditar indicaÃ§Ã£o:', err.message);
  }
}

// â”€â”€â”€ POST /mercadopago/sandbox-activate (APENAS sandbox) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Simula ativaÃ§Ã£o de plano sem passar pelo checkout do MP.
// Ãštil para testar o pipeline Firestore em ambiente de teste.
app.post('/mercadopago/sandbox-activate', async function (req, res) {
  if (!MP_ACCESS_TOKEN.startsWith('TEST-'))
    return res.status(403).json({ error: 'Endpoint disponÃ­vel apenas em modo sandbox.' });
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
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
app.post('/mercadopago/cancelar-assinatura', express.json(), async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase nÃ£o inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var uid = decoded.uid;
  try {
    var userRef = db.collection('usuarios').doc(uid);
    var snap    = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado.' });

    var userData = snap.data();
    var subId    = userData.mpSubscriptionId;

    if (!subId || userData.plano === 'free') {
      return res.status(400).json({ error: 'Nenhuma assinatura ativa para cancelar.' });
    }

    // Cancelar no Mercado Pago (pular em sandbox)
    if (!String(subId).startsWith('SANDBOX_TEST_')) {
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

    // Rebaixar para free no Firestore
    await userRef.update({
      plano:             'free',
      mpSubscriptionId:  admin.firestore.FieldValue.delete(),
      planoExpira:       admin.firestore.FieldValue.delete(),
      planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      canceladoEm:       admin.firestore.FieldValue.serverTimestamp()
    });

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
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  var token    = sanitizeStr(String(req.body.token    || '')).substring(0, 500);
  var platform = sanitizeStr(String(req.body.platform || 'web')).substring(0, 20);

  if (!token) return res.status(400).json({ error: 'token Ã© obrigatÃ³rio.' });

  try {
    await db.collection('usuarios').doc(decoded.uid).update({
      fcmToken:         token,
      fcmTokenPlatform: platform,
      fcmTokenAt:       admin.firestore.FieldValue.serverTimestamp(),
      pushEnabled:      true
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[/api/push/token]', e.message);
    return res.status(500).json({ error: 'Erro ao salvar token.' });
  }
});


// --- DELETE /api/push/token --- revoga FCM token (PEND-002) ---
app.delete('/api/push/token', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nao inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_) { return res.status(401).json({ error: 'Token invalido.' }); }

  try {
    await db.collection('usuarios').doc(decoded.uid).update({
      fcmToken:    admin.firestore.FieldValue.delete(),
      pushEnabled: false,
      fcmTokenAt:  admin.firestore.FieldValue.serverTimestamp()
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
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_) { return res.status(401).json({ error: 'Token invÃ¡lido.' }); }

  try {
    var userDoc = await db.collection('usuarios').doc(decoded.uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado.' });
    var fcmToken = (userDoc.data() || {}).fcmToken;
    if (!fcmToken) return res.status(400).json({ error: 'Nenhum FCM token salvo. Ative as notificaÃ§Ãµes primeiro.' });

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'ðŸ§ª Teste â€” Bud Finance',
        body: 'NotificaÃ§Ãµes push funcionando perfeitamente!'
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
  try { decoded = await auth.verifyIdToken(idToken); }
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

// â”€â”€â”€ GET /api/notifications/daily â€” cron de notificaÃ§Ãµes personalizadas â”€â”€
// Auth: x-cron-secret header (env CRON_SECRET)
// Trigger sugerido: Upstash QStash, diariamente Ã s 11:00 UTC (08:00 BrasÃ­lia)
//   â†’ GET https://bud-finance-backend.onrender.com/api/notifications/daily
//   â†’ Header: x-cron-secret: <CRON_SECRET>
app.get('/api/notifications/daily', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin nÃ£o inicializado.' });

  var cronSecret = process.env.CRON_SECRET;
  var provided   = req.headers['x-cron-secret'] || req.query.secret;
  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  // Hora atual em BrasÃ­lia
  var agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  var hojeStr   = agora.toISOString().slice(0, 10);
  var mesRef    = hojeStr.slice(0, 7);
  var amanha    = new Date(agora); amanha.setDate(amanha.getDate() + 1);
  var amanhaStr = amanha.toISOString().slice(0, 10);
  var isMonday  = agora.getDay() === 1;
  var horaAtual = agora.getHours();

  // Quiet hours 22hâ€“8h BrasÃ­lia
  if (horaAtual < 8 || horaAtual >= 22) {
    return res.json({ ok: true, skipped: 'quiet_hours', hora: horaAtual });
  }

  var groqKey = process.env.GROQ_API_KEY || '';

  // Buscar usuÃ¡rios com push ativado (max 500 por execuÃ§Ã£o)
  var usersSnap;
  try {
    usersSnap = await db.collection('usuarios').where('pushEnabled', '==', true).limit(500).get();
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar usuÃ¡rios: ' + e.message });
  }

  if (usersSnap.empty) return res.json({ ok: true, sent: 0, total: 0 });

  var sent = 0, errors = 0;

  for (var i = 0; i < usersSnap.docs.length; i++) {
    var userDoc = usersSnap.docs[i];
    var uid = userDoc.id;
    var ud  = userDoc.data();
    var token = ud.fcmToken;
    if (!token) continue;

    try {
      var notifs = [];

      // Buscar dados do usuÃ¡rio em paralelo
      var [recSnap, cartSnap, metaSnap, dividaSnap, limiteSnap, txSnap, carteiraSnap] = await Promise.all([
        db.collection('usuarios').doc(uid).collection('recorrentes')
          .where('ativa', '==', true).limit(50).get(),
        db.collection('usuarios').doc(uid).collection('cartoes').limit(20).get(),
        db.collection('usuarios').doc(uid).collection('metas').limit(20).get(),
        db.collection('usuarios').doc(uid).collection('dividas').limit(30).get(),
        db.collection('usuarios').doc(uid).collection('limites').limit(20).get(),
        db.collection('usuarios').doc(uid).collection('transacoes')
          .where('mesReferencia', '==', mesRef).orderBy('dataCriacao', 'desc').limit(100).get(),
        db.collection('usuarios').doc(uid).collection('carteira')
          .where('tipo', '!=', 'credito').limit(20).get()
      ]);

      var recs     = recSnap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
      var cartoes  = cartSnap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
      var metas    = metaSnap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
      var dividas  = dividaSnap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
      var limites  = limiteSnap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
      var contas   = carteiraSnap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });

      // Totais do mÃªs (reutilizados por limites, saldo e Buddy AI)
      var gastosPorCat = {}, totalReceitasMes = 0, totalDespesasMes = 0;
      txSnap.docs.forEach(function (d) {
        var tx = d.data();
        if (tx.tipo === 'receita') {
          totalReceitasMes += Number(tx.valor) || 0;
        } else if (tx.tipo === 'despesa') {
          var catTx = sanitizeStr(String(tx.categoria || 'Outros')).substring(0, 40);
          gastosPorCat[catTx] = (gastosPorCat[catTx] || 0) + (Number(tx.valor) || 0);
          totalDespesasMes   += Number(tx.valor) || 0;
        }
      });

      var amanhaDia  = amanha.getDate();
      var amanhaMes  = amanha.getMonth() + 1;

      // 1. Recorrentes vencendo amanhÃ£
      recs.forEach(function (r) {
        var dia = parseInt(r.diaVencimento, 10) || 1;
        var maxD = new Date(amanha.getFullYear(), amanhaMes, 0).getDate();
        if (Math.min(dia, maxD) === amanhaDia) {
          var val = 'R$ ' + (Number(r.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          if (r.tipo === 'receita') {
            notifs.push({
              emoji: 'ðŸ’°', tag: 'rec-rec-' + r._id + '-' + amanhaStr,
              title: 'ðŸ’° VocÃª recebe amanhÃ£!',
              body:  (r.descricao || 'Receita') + ' â€” ' + val,
              url:   'extrato.html'
            });
          } else {
            notifs.push({
              emoji: 'â°', tag: 'rec-desp-' + r._id + '-' + amanhaStr,
              title: 'â° Vence amanhÃ£: ' + (r.descricao || 'Conta'),
              body:  val + ' â€” nÃ£o esqueÃ§a de registrar o pagamento.',
              url:   'recorrentes.html',
              actions: [{ action: 'ok', title: 'âœ… Registrar' }]
            });
          }
        }
      });

      // 2. Faturas de cartÃ£o: vencimento amanhÃ£ / fechamento em 2 dias
      cartoes.forEach(function (c) {
        var diaVenc = parseInt(c.diaVencimento || c.vencimento, 10);
        if (diaVenc) {
          var maxDV = new Date(amanha.getFullYear(), amanhaMes, 0).getDate();
          if (Math.min(diaVenc, maxDV) === amanhaDia) {
            notifs.push({
              emoji: 'ðŸ“…', tag: 'cartao-venc-' + c._id + '-' + amanhaStr,
              title: 'ðŸ“… Fatura vence amanhÃ£',
              body:  'Fatura do ' + (c.nome || 'cartÃ£o') + ' vence amanhÃ£. NÃ£o perca o prazo!',
              url:   'cartoes.html',
              actions: [{ action: 'ver', title: 'ðŸ’³ Ver fatura' }]
            });
          }
        }
        var diaFech = parseInt(c.diaFechamento || c.fechamento, 10);
        if (diaFech) {
          var doisDias = new Date(agora); doisDias.setDate(doisDias.getDate() + 2);
          var maxDF = new Date(doisDias.getFullYear(), doisDias.getMonth() + 1, 0).getDate();
          if (Math.min(diaFech, maxDF) === doisDias.getDate()) {
            notifs.push({
              emoji: 'ðŸ’³', tag: 'cartao-fech-' + c._id + '-' + hojeStr,
              title: 'ðŸ’³ Fatura fecha em 2 dias',
              body:  'Sua fatura do ' + (c.nome || 'cartÃ£o') + ' fecha em 2 dias. Tudo lanÃ§ado?',
              url:   'cartoes.html'
            });
          }
        }
      });

      // 3. Metas prÃ³ximas de concluir (â‰¥90%)
      metas.forEach(function (m) {
        var atual = Number(m.valorAtual || m.valorDepositado || 0);
        var alvo  = Number(m.valorAlvo  || m.valor || 0);
        if (alvo > 0) {
          var pct = atual / alvo;
          var nomeMeta = sanitizeStr(m.nome || m.descricao || 'Meta').substring(0, 40);
          if (pct >= 1.0) {
            notifs.push({
              emoji: 'ðŸŽ‰', tag: 'meta-100-' + m._id + '-' + mesRef,
              title: 'ðŸŽ‰ Meta atingida!',
              body:  'ParabÃ©ns! VocÃª concluiu a meta "' + nomeMeta + '"! ðŸ†',
              url:   'metas.html'
            });
          } else if (pct >= 0.9) {
            notifs.push({
              emoji: 'ðŸŽ¯', tag: 'meta-90-' + m._id + '-' + mesRef,
              title: 'ðŸŽ¯ Quase lÃ¡ na meta!',
              body:  Math.round(pct * 100) + '% da meta "' + nomeMeta + '". Continue assim!',
              url:   'metas.html'
            });
          }
          // Meta parada: sem atualizaÃ§Ã£o hÃ¡ â‰¥15 dias e ainda nÃ£o concluÃ­da
          if (pct < 1.0 && m.atualizadoEm) {
            try {
              var updDate2 = m.atualizadoEm.toDate ? m.atualizadoEm.toDate() : new Date(m.atualizadoEm);
              var diasSemDep = Math.floor((agora - updDate2) / 86400000);
              if (diasSemDep >= 15 && diasSemDep < 60) {
                notifs.push({
                  emoji: 'ðŸ˜´', tag: 'meta-parada-' + m._id + '-' + Math.floor(diasSemDep / 15),
                  title: 'ðŸ˜´ Meta parada: ' + nomeMeta,
                  body:  'Faz ' + diasSemDep + ' dias sem depÃ³sito. ' + Math.round(pct * 100) + '% concluÃ­da.',
                  url:   'metas.html'
                });
              }
            } catch (_) {}
          }
        }
      });

      // 4. DÃ­vidas: parcela vencendo amanhÃ£ (vencimento = string ISO YYYY-MM-DD)
      dividas.forEach(function (d) {
        if (!d.vencimento) return;
        // Ignora se jÃ¡ quitada (todas parcelas pagas)
        var pagas = parseInt(d.parcelasPagas || 0, 10);
        var total = parseInt(d.parcelas || 1, 10);
        if (pagas >= total) return;
        try {
          var vencDate = new Date(d.vencimento + 'T12:00:00');
          if (vencDate.toISOString().slice(0, 10) === amanhaStr) {
            var nomeDivida = sanitizeStr(String(d.nome || d.instituicao || 'DÃ­vida')).substring(0, 40);
            var valParcela = Number(d.valorParcela || (d.valorTotal / total) || 0);
            var valStr = 'R$ ' + valParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            notifs.push({
              emoji: 'ðŸ’¸', tag: 'divida-venc-' + d._id + '-' + amanhaStr,
              title: 'ðŸ’¸ Parcela vence amanhÃ£',
              body:  nomeDivida + ' â€” ' + valStr + (total > 1 ? ' (' + (pagas + 1) + '/' + total + ')' : ''),
              url:   'dividas.html'
            });
          }
        } catch (_) {}
      });

      // 5. Limites de categoria (80% ou ultrapassados)
      limites.forEach(function (lim) {
        var catNome  = sanitizeStr(String(lim.categoria || '')).substring(0, 30);
        var limValor = Number(lim.valorLimite) || 0;
        if (!catNome || limValor <= 0) return;
        var gastoLim = gastosPorCat[catNome] || 0;
        var pctLim   = gastoLim / limValor;
        if (pctLim >= 1.0) {
          notifs.push({
            emoji: 'ðŸš¨', tag: 'limite-100-' + lim._id + '-' + mesRef,
            title: 'ðŸš¨ Limite estourado: ' + catNome,
            body:  'R$' + gastoLim.toFixed(0) + ' gastos de R$' + limValor.toFixed(0) + ' em ' + catNome + '.',
            url:   'limites.html'
          });
        } else if (pctLim >= 0.8) {
          notifs.push({
            emoji: 'âš ï¸', tag: 'limite-80-' + lim._id + '-' + mesRef,
            title: 'âš ï¸ ' + Math.round(pctLim * 100) + '% do limite: ' + catNome,
            body:  'R$' + gastoLim.toFixed(0) + ' gastos de R$' + limValor.toFixed(0) + ' em ' + catNome + '.',
            url:   'limites.html'
          });
        }
      });

      // 6. Saldo negativo no mÃªs
      if (totalDespesasMes > totalReceitasMes && totalReceitasMes > 0) {
        var saldoNeg = totalReceitasMes - totalDespesasMes;
        notifs.push({
          emoji: 'ðŸ“‰', tag: 'saldo-neg-' + mesRef + '-' + uid,
          title: 'ðŸ“‰ Gastos maiores que receitas',
          body:  'Este mÃªs vocÃª gastou R$' + Math.abs(saldoNeg).toFixed(0) + ' a mais do que recebeu.',
          url:   'balanco-mensal.html'
        });
      }

      // 7. Resumo do mÃªs (Ãºltimo dia)
      var ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
      if (agora.getDate() === ultimoDiaMes) {
        var saldoFim    = totalReceitasMes - totalDespesasMes;
        var saldoFimStr = (saldoFim >= 0 ? '+R$' : '-R$') + Math.abs(saldoFim).toFixed(0);
        var nomeMesArr  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        notifs.push({
          emoji: 'ðŸ“Š', tag: 'resumo-mes-' + mesRef + '-' + uid,
          title: 'ðŸ“Š Resumo de ' + nomeMesArr[agora.getMonth()] + ': saldo ' + saldoFimStr,
          body:  'Receitas R$' + totalReceitasMes.toFixed(0) + ' Â· Despesas R$' + totalDespesasMes.toFixed(0) + '. Confira o balanÃ§o!',
          url:   'balanco-mensal.html'
        });
      }

      // 8. InÃ­cio do mÃªs: total de recorrentes programadas
      if (agora.getDate() === 1) {
        var recsDesp    = recs.filter(function (r) { return r.tipo === 'despesa'; });
        var totalRecsV  = recsDesp.reduce(function (s, r) { return s + (Number(r.valor) || 0); }, 0);
        if (totalRecsV > 0) {
          notifs.push({
            emoji: 'ðŸ“‹', tag: 'inicio-mes-recs-' + mesRef + '-' + uid,
            title: 'ðŸ“‹ Novo mÃªs! R$' + totalRecsV.toFixed(0) + ' em contas fixas',
            body:  recsDesp.length + ' conta' + (recsDesp.length > 1 ? 's' : '') + ' programada' + (recsDesp.length > 1 ? 's' : '') + ' para este mÃªs.',
            url:   'recorrentes.html'
          });
        }
      }

      // 9. Incentivo upgrade (plano free, dia 15, com â‰¥5 transaÃ§Ãµes no mÃªs)
      if ((!ud.plano || ud.plano === 'free') && agora.getDate() === 15 && txSnap.size >= 5) {
        notifs.push({
          emoji: 'â­', tag: 'upgrade-' + mesRef + '-' + uid,
          title: 'â­ Desbloqueie tudo no Bud Finance',
          body:  'VocÃª jÃ¡ fez ' + txSnap.size + ' lanÃ§amentos este mÃªs. ConheÃ§a o plano Premium!',
          url:   'configuracoes.html'
        });
      }

      // 10. Plano expirando amanhÃ£
      var expField = ud.planoExpira || ud.assinaturaExpira;
      if (expField && ud.plano && ud.plano !== 'free') {
        try {
          var expDate = expField.toDate ? expField.toDate() : new Date(expField);
          if (expDate.toISOString().slice(0, 10) === amanhaStr) {
            notifs.push({
              emoji: 'ðŸ””', tag: 'plano-expire-' + amanhaStr + '-' + uid,
              title: 'ðŸ”” Seu plano expira amanhÃ£',
              body:  'Renove seu plano ' + (ud.plano || '') + ' para continuar com todas as funcionalidades.',
              url:   'configuracoes.html'
            });
          }
        } catch (_) {}
      }

      // 12. PEND-066: Saldo de conta desatualizado hÃ¡ â‰¥7 dias
      contas.forEach(function (c) {
        var updField = c.atualizadaEm || c.criadaEm;
        if (!updField) return;
        try {
          var updDate3 = updField.toDate ? updField.toDate() : new Date(updField);
          var diasSemAtualizar = Math.floor((agora - updDate3) / 86400000);
          // Avisar semanalmente (7, 14, 21... dias) para nÃ£o spam
          if (diasSemAtualizar >= 7 && diasSemAtualizar % 7 === 0) {
            var nomeConta = sanitizeStr(String(c.nome || 'Conta')).substring(0, 30);
            var semanas = Math.floor(diasSemAtualizar / 7);
            notifs.push({
              emoji: 'ðŸ¦', tag: 'saldo-stale-' + c._id + '-' + hojeStr,
              title: 'ðŸ¦ Saldo desatualizado: ' + nomeConta,
              body:  'Faz ' + (semanas === 1 ? '1 semana' : semanas + ' semanas') + ' sem confirmar o saldo. Ainda estÃ¡ correto?',
              url:   'carteira.html'
            });
          }
        } catch (_) {}
      });

      // 11. Re-engagement: sem abrir o app hÃ¡ 5â€“30 dias
      var lastField = ud.ultimoAcesso || ud.lastLoginAt;
      if (lastField) {
        try {
          var lastDate = lastField.toDate ? lastField.toDate() : new Date(lastField);
          var inativos = Math.floor((agora - lastDate) / 86400000);
          if (inativos >= 5 && inativos < 30) {
            var kReeng = 'reeng-' + Math.floor(inativos / 5) + '-' + uid;
            notifs.push({
              emoji: 'ðŸ¤–', tag: kReeng,
              title: 'ðŸ‘‹ O Buddy sentiu sua falta!',
              body:  'Faz ' + inativos + ' dias sem abrir o app. Que tal uma conferida rÃ¡pida?',
              url:   'dashboard.html'
            });
          }
        } catch (_) {}
      }

      // 12. Buddy AI insight (Ã s segundas ou quando nÃ£o hÃ¡ regras)
      if (groqKey && (isMonday || notifs.length === 0)) {
        try {
          var gastos = {};
          var totalDesp = 0;
          txSnap.docs.forEach(function (d) {
            var tx = d.data();
            if (tx.tipo === 'despesa') {
              var cat = sanitizeStr(String(tx.categoria || 'Outros')).substring(0, 40);
              gastos[cat] = (gastos[cat] || 0) + (Number(tx.valor) || 0);
              totalDesp  += Number(tx.valor) || 0;
            }
          });
          var topCats = Object.entries(gastos)
            .sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 3)
            .map(function (e) { return e[0] + ' R$' + e[1].toFixed(0); })
            .join(', ');
          var nomeU = sanitizeStr(String(ud.nome || 'usuÃ¡rio')).split(' ')[0].substring(0, 30);
          var diasSemana = ['domingo','segunda','terÃ§a','quarta','quinta','sexta','sÃ¡bado'];

          var budPrompt =
            'VocÃª Ã© o Buddy, assistente financeiro do Bud Finance.\n' +
            'UsuÃ¡rio: ' + nomeU + '\n' +
            'Top gastos do mÃªs (' + mesRef + '): ' + (topCats || 'sem dados ainda') + '\n' +
            'Total despesas: R$' + totalDesp.toFixed(0) + '\n' +
            'Hoje: ' + diasSemana[agora.getDay()] + '\n\n' +
            'Crie UMA notificaÃ§Ã£o push curta e personalizada (tÃ­tulo â‰¤40 chars, corpo â‰¤90 chars).\n' +
            'Pode ser: dica de economia, observaÃ§Ã£o sobre padrÃµes, motivaÃ§Ã£o de meta, ou curiosidade financeira.\n' +
            'Formato de resposta: JSON puro {"title":"...","body":"...","emoji":"emoji"}\n' +
            'Retorne APENAS o JSON, sem markdown ou texto extra.';

          var gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct',
              messages: [{ role: 'user', content: budPrompt }],
              temperature: 0.8,
              max_tokens: 150
            })
          });
          if (gRes.ok) {
            var gData = await gRes.json();
            var raw = ((gData.choices || [])[0] || {}).message?.content || '';
            var parsed = JSON.parse(raw.trim());
            if (parsed && parsed.title && parsed.body) {
              notifs.push({
                emoji:    sanitizeStr(parsed.emoji || 'ðŸ¤–').substring(0, 5),
                tag:      'buddy-' + hojeStr + '-' + uid,
                title:    sanitizeStr(parsed.emoji + ' ' + parsed.title).substring(0, 60),
                body:     sanitizeStr(parsed.body).substring(0, 120),
                url:      'assistente-ia.html',
                isBuddy:  true
              });
            }
          }
        } catch (_buddyErr) {
          // Buddy insight Ã© opcional â€” continua sem ele
        }
      }

      if (notifs.length === 0) continue;

      // Smart bundling: se >3 notificaÃ§Ãµes de regras â†’ resumo + Buddy separado
      var toSend;
      if (notifs.length > 3) {
        var buddyItem = notifs.find(function (n) { return n.isBuddy; });
        var ruleItems = notifs.filter(function (n) { return !n.isBuddy; });
        toSend = [];
        if (ruleItems.length > 0) {
          toSend.push({
            emoji: 'ðŸ“‹',
            tag:   'bundle-' + hojeStr + '-' + uid,
            title: 'ðŸ“‹ ' + ruleItems.length + ' avisos de hoje',
            body:  ruleItems.slice(0, 3).map(function (n) { return n.emoji + ' ' + n.body.substring(0, 35); }).join(' Â· '),
            url:   'dashboard.html'
          });
        }
        if (buddyItem) toSend.push(buddyItem);
      } else {
        toSend = notifs;
      }

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
          await admin.messaging().send({
            token: token,
            data: {
              title:   n.title  || 'Bud Finance',
              body:    n.body   || '',
              url:     n.url    || 'dashboard.html',
              tag:     n.tag    || 'bud',
              emoji:   n.emoji  || 'ðŸ“¢',
              actions: JSON.stringify(n.actions || [{ action: 'open', title: 'Abrir app' }])
            },
            webpush: {
              notification: {
                icon:    FRONTEND_URL + '/icons/icon-192.png',
                badge:   FRONTEND_URL + '/icons/icon-192.png',
                vibrate: [200, 100, 200]
              },
              fcm_options: {
                link: FRONTEND_URL + '/' + (n.url || 'dashboard.html')
              }
            }
          });
          sent++;
        } catch (fcmErr) {
          // Token invÃ¡lido ou expirado â€” limpar do Firestore
          if (fcmErr.code === 'messaging/registration-token-not-registered' ||
              fcmErr.code === 'messaging/invalid-registration-token') {
            try {
              await db.collection('usuarios').doc(uid).update({ fcmToken: null, pushEnabled: false });
            } catch (_) {}
          }
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

  return res.json({ ok: true, sent: sent, errors: errors, total: usersSnap.size });
});

// â”€â”€â”€ Start server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('[Bud Finance Backend] Running on port ' + PORT);
});
