// backend/server.js — Bud Finance Backend
// Generates Firebase password reset links via Admin SDK.
// Sends the reset email server-side via EmailJS REST API.
// Also: POST /api/extrair-fatura — extrai transações de PDF de fatura de cartão.
// The oobCode NEVER leaves the backend.

const express = require('express');
const cors    = require('cors');
const admin   = require('firebase-admin');
const multer  = require('multer');
const pdfParse = require('pdf-parse');

// ─── Firebase Admin init ────────────────────────────────────────────
// Service account credentials injected via environment variable.
// On Render: FIREBASE_SERVICE_ACCOUNT = JSON string of the service account key.
// Em dev local sem credenciais, o servidor sobe mesmo assim — apenas as rotas
// que usam auth/db ficam indisponíveis (ex: /reset-senha). /api/extrair-cupom
// não usa Firebase e funciona normalmente.
let auth, db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  auth = admin.auth();
  db   = admin.firestore();
} catch (e) {
  console.warn('[Firebase Admin] Credenciais ausentes ou inválidas. Rotas /reset-senha e similares não funcionarão:', e.message);
}

// ─── EmailJS config (env vars — set on Render) ─────────────────────
const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || '';
const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || '';
const EMAILJS_TEMPLATE_ID           = process.env.EMAILJS_TEMPLATE_RECUPERAR_SENHA || '';
const EMAILJS_TEMPLATE_CHAMADO      = process.env.EMAILJS_TEMPLATE_CHAMADO || '';
const EMAILJS_TEMPLATE_BOAS_VINDAS  = process.env.EMAILJS_TEMPLATE_BOAS_VINDAS || '';
const FRONTEND_URL                  = process.env.FRONTEND_URL || 'https://budsolucoes.com.br/appbudfinance';

// ─── WhatsApp config (env vars — set on Render) ─────────────────────
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

// ─── Mercado Pago config ─────────────────────────────────────────────
const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN   || '';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';
// planKey → título e preço mensal (BRL)
const MP_PLANS = {
  starter: { title: 'Bud Finance Starter', amount: 9.99  },
  pro:     { title: 'Bud Finance Pro',     amount: 29.90 },
  plus:    { title: 'Bud Finance Plus',    amount: 49.90 }
};
const MP_INDICACAO_DESCONTO = 0.10; // 10% off para links de indicação

// ─── Express setup ──────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '200kb' })); // aumentado para suportar mensagens com extratos/planilhas do Assistente IA

// A3 fix: CORS allowlist split por NODE_ENV (dev permite localhost; prod só domínios públicos).
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
  // Origens locais de desenvolvimento — seguras pois localhost/127.0.0.1 não é acessível externamente.
  'http://localhost:3000',
  'http://127.0.0.1:3000',
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

// ─── Rate limiting (simple in-memory) ───────────────────────────────
// LIMITAÇÃO CONHECIDA (C4): este mapa vive em memória do processo.
// Em deploys que reiniciam (Render free tier dorme após inatividade),
// o estado é perdido. Para hardening real, migrar p/ Redis ou
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

// ─── Sanitize HTML tags (server-side equivalent of budSanitize) ─────
function sanitizeStr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Send email via EmailJS REST API ────────────────────────────────
async function sendEmailViaEmailJS(templateParams, templateId) {
  var tid = templateId || EMAILJS_TEMPLATE_ID;
  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !tid) {
    // EmailJS not configured — skip silently
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

// ─── POST /api/boas-vindas ────────────────────────────────────────
// Gera o link de verificação de e-mail (Firebase Admin) e envia o
// email de boas-vindas com o link via EmailJS (server-side).
// O link completo de verificação nunca é exposto ao cliente.
app.post('/api/boas-vindas', async function (req, res) {
  try {
    if (!auth) return res.status(503).json({ success: false, message: 'Serviço indisponível.' });

    var email     = (req.body.email    || '').trim().toLowerCase();
    var nome      = (req.body.nome     || 'Usuário').substring(0, 100);
    var matricula = (req.body.matricula || '').substring(0, 20);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false });
    }

    // Gera o link de verificação de e-mail via Admin SDK
    var verifyLink;
    try {
      verifyLink = await auth.generateEmailVerificationLink(email, {
        url: FRONTEND_URL + '/index.html'
      });
    } catch (_linkErr) {
      // Conta pode não existir ainda ou outro erro — não bloquear o cadastro
      verifyLink = FRONTEND_URL + '/index.html';
    }

    // Envia email de boas-vindas com o link de verificação
    try {
      await sendEmailViaEmailJS({
        to_email:   email,
        to_name:    nome,
        matricula:  matricula,
        verify_url: verifyLink,
        app_url:    FRONTEND_URL + '/index.html'
      }, EMAILJS_TEMPLATE_BOAS_VINDAS);
    } catch (_emailErr) {
      // Falha de email não bloqueia o cadastro
    }

    return res.json({ success: true });
  } catch (_err) {
    return res.json({ success: true });
  }
});

// ─── POST /api/iniciar-trial ───────────────────────────────────────
// Ativado automaticamente após cadastro: concede 3 dias no plano Pro.
// Usa Firebase Admin SDK para contornar regras Firestore de create.
app.post('/api/iniciar-trial', express.json(), async function (req, res) {
  if (!db) return res.status(503).json({ ok: false, error: 'Firebase Admin não inicializado.' });

  // Verificar token JWT — UID extraído do token, nunca do body
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ ok: false, error: 'Token ausente.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token inválido.' }); }
  var uid = decoded.uid;
  try {
    var ref = db.collection('usuarios').doc(uid);
    var snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });
    var data = snap.data();
    // Só ativa trial em contas sem plano ou no free (não sobrescreve planos pagos)
    if (data.plano && data.plano !== 'free') {
      return res.json({ ok: true, msg: 'Plano já definido.' });
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

// ─── POST /api/expirar-trial ───────────────────────────────────────
// Chamado pelo dashboard quando detecta que o trial venceu.
// Rebaixa o plano para 'free' e limpa os campos de trial.
app.post('/api/expirar-trial', express.json(), async function (req, res) {
  if (!db) return res.status(503).json({ ok: false });

  // Verificar token JWT — UID extraído do token, nunca do body
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ ok: false, error: 'Token ausente.' });
  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ ok: false, error: 'Token inválido.' }); }
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

// ─── POST /reset-senha ─────────────────────────────────────────────
// Generates a password reset link and sends the email SERVER-SIDE.
// The oobCode NEVER leaves the backend — frontend only gets { success: true }.
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
      // User not found — return success anyway (anti-enumeration)
      return res.json({ success: true });
    }

    // Get user name from Firestore (sanitize to prevent stored XSS in email)
    var userName = 'Usuário';
    try {
      var userDoc = await db.collection('usuarios').doc(userRecord.uid).get();
      if (userDoc.exists) {
        userName = sanitizeStr(userDoc.data().nome) || 'Usuário';
      }
    } catch (_e) {
      // Non-critical — use default name
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
      // Email failed — but don't leak info to the client
    }

    return res.json({ success: true });

  } catch (_err) {
    // Generic success to prevent information leakage
    return res.json({ success: true });
  }
});

// ─── Health check ───────────────────────────────────────────────────
app.get('/', function (_req, res) {
  res.json({ status: 'ok', service: 'bud-finance-backend' });
});

// ─── Multer: upload de arquivo (PDF / imagem) ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: function (_req, file, cb) {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (ok.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato não suportado. Use PDF, JPEG, PNG ou WEBP.'));
  }
});

// ─── Helpers de parsing ──────────────────────────────────────────────
const MESES_PT = {
  jan:1, fev:2, mar:3, abr:4, mai:5, jun:6,
  jul:7, ago:8, set:9, out:10, nov:11, dez:12
};

function parseValorBRL(str) {
  // Aceita: "1.234,56" ou "1234,56" ou "1234.56"
  if (!str) return 0;
  var s = str.trim();
  // Se tem vírgula como decimal: "1.234,56"
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // "1234,56"
  if (/^\d+,\d{2}$/.test(s)) {
    return parseFloat(s.replace(',', '.'));
  }
  // fallback
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

function isNonTransactionLine(line) {
  // Linhas de cabeçalho, rodapé e resumo que NÃO são transações
  var keywords = /^(total|saldo|limite|fatura|pagamento|vencimento|encarg|iof|taxa|juros|subtotal|compras nacionais|compras internacionais|parceladas|demais cobranças|valor mínimo|valor da fatura|data de|fechamento|melhor dia|obrigado|olá|esta é)/i;
  if (keywords.test(line.trim())) return true;
  // Nubank CC extrato: headers "DD ABR YYYY Total de saídas/entradas" — evita Strategy 1 capturar como transação
  if (/\btotal de (sa[íi]das?|entradas?)\b/i.test(line)) return true;
  return false;
}

/**
 * Extrai transações do texto bruto de um PDF de fatura.
 * Estratégia dupla: layout horizontal + layout vertical (Nubank/C6/PicPay).
 */
function parseBankStatementText(rawText) {
  var normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var lines = normalized.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);

  // Detectar ano do documento (mais frequente no texto)
  var ano = new Date().getFullYear();
  var anoMatches = normalized.match(/\b(202\d)\b/g);
  if (anoMatches && anoMatches.length) {
    var counts = {};
    anoMatches.forEach(function(y){ counts[y] = (counts[y] || 0) + 1; });
    var best = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })[0];
    if (best) ano = parseInt(best);
  }

  var results = [];
  var seen = new Set();

  // tipo: 'credito' | 'debito' | null (usado pelo frontend para detectarTipo)
  function addTx(desc, valor, data, tipo) {
    if (!desc || valor <= 0 || valor > 99999) return;
    var key = desc.toLowerCase() + '|' + valor + '|' + data;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ desc: desc, valor: valor, data: data, tipo: tipo || null });
  }

  // ─── Estratégia 1: layout horizontal ──────────────────────────────
  // "DD ABR Description R$ 50,00" ou "DD/MM Description ±R$ 50,00"
  var RE_PT   = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.{3,70}?)\s+([\d\.]+,\d{2})\s*$/i;
  // Captura sinal opcional antes do R$ para determinar tipo (crédito/débito)
  var RE_DDMM = /^(\d{2})\/(\d{2})(?:\/\d{4})?\s+(.{3,70}?)\s+([+-])?R?\$?\s*([\d\.]+,\d{2})\s*$/;

  lines.forEach(function(line) {
    if (isNonTransactionLine(line)) return;

    var m1 = line.match(RE_PT);
    if (m1) {
      var mes = MESES_PT[m1[2].toLowerCase()];
      var desc = m1[3].replace(/R\$\s*/g, '').trim();
      var valor = parseValorBRL(m1[4]);
      if (mes) {
        var data = ano + '-' + String(mes).padStart(2,'0') + '-' + String(m1[1]).padStart(2,'0');
        addTx(desc, valor, data);
      }
      return;
    }

    var m2 = line.match(RE_DDMM);
    if (m2) {
      var desc2  = m2[3].replace(/R\$\s*/g, '').trim();
      var sign2  = m2[4]; // '+' | '-' | undefined
      var valor2 = parseValorBRL(m2[5]);
      var data2  = ano + '-' + m2[2] + '-' + m2[1];
      var tipo2  = sign2 === '+' ? 'credito' : sign2 === '-' ? 'debito' : null;
      addTx(desc2, valor2, data2, tipo2);
    }
  });

  // ─── Estratégia 2: layout vertical/bloco (Nubank, PicPay, C6) ─────
  // Padrão: linha de data → linha(s) de descrição → linha de valor "R$ XX,XX"
  if (results.length < 2) {
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];

      // Detectar linha de data: "DD abr" (Nubank usa minúsculas)
      var dateM = line.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i);
      if (dateM) {
        var dia = dateM[1];
        var mesV = MESES_PT[dateM[2].toLowerCase()];
        if (mesV) {
          var descLines = [];
          var j = i + 1;
          while (j < lines.length) {
            var next = lines[j];
            // Para ao encontrar linha de valor
            if (/^-?R?\$?\s*[\d\.]+,\d{2}$/.test(next)) break;
            // Para ao encontrar próxima data
            if (/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i.test(next)) break;
            // Para em palavras-chave de resumo (se já tem desc)
            if (descLines.length > 0 && isNonTransactionLine(next)) break;
            if (next.length >= 2 && next.length <= 100) descLines.push(next);
            j++;
            if (j > i + 5) break;
          }
          // Linha de valor — captura sinal +/- para determinar tipo crédito/débito
          if (j < lines.length) {
            var valLine = lines[j];
            var valM = valLine.match(/^([+-])?R?\$?\s*([\d\.]+,\d{2})$/);
            if (valM && descLines.length > 0) {
              var desc3  = descLines.join(' ').replace(/\s+/g, ' ').trim();
              var sign3  = valM[1]; // '+' | '-' | undefined
              var valor3 = parseValorBRL(valM[2]);
              var tipo3  = sign3 === '+' ? 'credito' : sign3 === '-' ? 'debito' : null;
              var data3  = ano + '-' + String(mesV).padStart(2,'0') + '-' + String(dia).padStart(2,'0');
              addTx(desc3, valor3, data3, tipo3);
              i = j + 1;
              continue;
            }
          }
        }
      }
      i++;
    }
  }

  // ─── Estratégia 3: Nubank — data na linha, desc+valor concatenados ─────────
  // Padrão:  "DD MMM"           → linha de data
  //          "DescriçãoR$ X,XX" → descrição + valor na mesma linha (sem espaço)
  if (results.length < 2) {
    var RE_DATE3 = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i;
    var RE_DV    = /^(.+?)R\$\s*([\d\.]+,\d{2})$/;
    var RE_NEG3  = /\u2212R\$/;   // sinal menos Unicode (estorno/crédito Nubank)
    var SKIP3    = /^(pagamento|saldo restante|parcelamento|outros lan)/i;
    // Coletar estornos para deduzir depois: "Estorno de X −R$ Y"
    var RE_ESTORNO = /^Estorno de (.+?)\u2212R\$\s*([\d\.]+,\d{2})$/;
    var estornos = []; // [{desc, valor}]

    for (var k = 0; k < lines.length - 1; k++) {
      var dm3 = lines[k].match(RE_DATE3);
      if (!dm3) continue;
      var nxt = lines[k + 1];
      // Captura estornos para dedução posterior
      var estM = nxt.match(RE_ESTORNO);
      if (estM) {
        var estDesc = estM[1].trim();
        var estVal  = parseValorBRL(estM[2]);
        estornos.push({ desc: estDesc, valor: estVal });
        k++; continue;
      }
      // Pula pagamentos e cabeçalhos (mas não estornos — já tratados acima)
      if (RE_NEG3.test(nxt) || SKIP3.test(nxt) || isNonTransactionLine(nxt)) { k++; continue; }
      var dv = nxt.match(RE_DV);
      if (!dv) { k++; continue; }
      var mes3 = MESES_PT[dm3[2].toLowerCase()];
      if (!mes3) { k++; continue; }
      // Remove prefixo de cartão mascarado: "•••• 4567Loja" → "Loja"
      var rawDesc3 = dv[1].trim().replace(/^•+\s*\d{4}/, '').trim();
      if (!rawDesc3) { k++; continue; }
      var valor3 = parseValorBRL(dv[2]);
      var data3  = ano + '-' + String(mes3).padStart(2,'0') + '-' + String(dm3[1]).padStart(2,'0');
      addTx(rawDesc3, valor3, data3);
      k++; // já consumiu a linha de desc+valor
    }

    // Deduzir estornos: remover UMA ocorrência da compra correspondente
    estornos.forEach(function(est) {
      var idx = results.findIndex(function(t) {
        return t.desc === est.desc && Math.abs(t.valor - est.valor) < 0.01;
      });
      if (idx !== -1) results.splice(idx, 1);
    });
  }

  // ─── Estratégia 4: Nubank — parcelamentos/financiamentos com juros ──────────
  // Padrão:  "DD MMM"
  //          "NOME DO CREDOR EM MAIÚSCULAS"
  //          "Total a pagar: R$ X,XX (valor da transação...)"  ← linha longa descritiva
  //          "R$ X,XX"  ← valor isolado na própria linha
  // O valor que importa é o da última linha ("R$ X,XX") = total com juros/IOF
  {
    var RE_DATE4  = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i;
    var RE_VAL4   = /^R\$\s*([\d\.]+,\d{2})$/;
    var RE_TOTAL4 = /^Total a pagar:/i;
    var SKIP4     = /^(pagamento|estorno|saldo restante)/i;

    for (var p = 0; p < lines.length - 3; p++) {
      var dm4 = lines[p].match(RE_DATE4);
      if (!dm4) continue;
      var credorLine = lines[p + 1] || '';
      // Credor deve ser texto puro sem "R$" e razoavelmente longo
      if (!credorLine || /R\$/.test(credorLine) || SKIP4.test(credorLine)) continue;
      if (credorLine.length < 4 || credorLine.length > 120) continue;
      // Próximas linhas: procurar "Total a pagar:" seguido de "R$ X,XX"
      var found = false;
      for (var q = p + 2; q < Math.min(p + 6, lines.length - 1); q++) {
        if (RE_TOTAL4.test(lines[q])) {
          // Procurar linha de valor isolado logo após
          for (var r = q + 1; r < Math.min(q + 4, lines.length); r++) {
            var valM4 = lines[r].match(RE_VAL4);
            if (valM4) {
              var mes4 = MESES_PT[dm4[2].toLowerCase()];
              if (mes4) {
                var desc4  = credorLine.trim();
                var valor4 = parseValorBRL(valM4[1]);
                var data4  = ano + '-' + String(mes4).padStart(2,'0') + '-' + String(dm4[1]).padStart(2,'0');
                addTx(desc4, valor4, data4);
              }
              found = true;
              p = r; // avança o índice externo
              break;
            }
          }
          break;
        }
      }
    }
  }

  // ─── Estratégia 5: extrato conta corrente — data DD/MM ou DD/MM/YYYY sozinha ──
  // Nubank conta: "DD/MM" ou "DD/MM/YYYY" em linha própria
  //               → linhas de descrição
  //               → linha de valor "[+-]R$ X,XX"
  if (results.length < 2) {
    var RE_DATE5 = /^(\d{2})\/(\d{2})(?:\/\d{4})?$/;
    var RE_VAL5  = /^([+-])?R?\$?\s*([\d\.]+,\d{2})\s*$/;
    var i5 = 0;
    while (i5 < lines.length) {
      var l5 = lines[i5];
      var dm5 = l5.match(RE_DATE5);
      if (dm5) {
        var descLines5 = [];
        var j5 = i5 + 1;
        while (j5 < lines.length) {
          var nxt5 = lines[j5];
          if (RE_VAL5.test(nxt5)) break;
          if (RE_DATE5.test(nxt5)) break;
          if (descLines5.length > 0 && isNonTransactionLine(nxt5)) break;
          if (nxt5.length >= 2 && nxt5.length <= 100) descLines5.push(nxt5);
          j5++;
          if (j5 > i5 + 5) break;
        }
        if (j5 < lines.length && descLines5.length > 0) {
          var vl5 = lines[j5];
          var vm5 = vl5.match(RE_VAL5);
          if (vm5) {
            var desc5  = descLines5.join(' ').replace(/\s+/g, ' ').trim();
            var sign5  = vm5[1]; // '+' | '-' | undefined
            var valor5 = parseValorBRL(vm5[2]);
            var tipo5  = sign5 === '+' ? 'credito' : sign5 === '-' ? 'debito' : null;
            var data5  = ano + '-' + dm5[2] + '-' + dm5[1];
            addTx(desc5, valor5, data5, tipo5);
            i5 = j5 + 1;
            continue;
          }
        }
      }
      i5++;
    }
  }

  // ─── Estratégia 6: Nubank extrato conta corrente PDF ───────────────
  // Formato real (duas linhas separadas):
  //   Linha A: "01 ABR 2026"           ← data isolada
  //   Linha B: "Total de saídas- 84,96" ← tipo + total do dia
  //   Linhas+: descrição multi-linha
  //   Última:  "30,00"                  ← valor puro encerra tx
  if (results.length < 2) {
    var RE_HDR6  = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})$/i;  // data sozinha
    var RE_SUB6  = /^Total de (sa[íi]das?|entradas?)/i;   // define direção (mesmo dia pode alternar)
    var RE_VAL6  = /^[\d\.]+,\d{2}$/;                    // valor puro: "30,00", "1.234,56"
    var RE_SKIP6 = /^(saldo\b|rendimento\b|movimenta|cpf\b|tem alguma|caso a\b|extrato gerado|asseguramos|nu (financeira|pagamentos)|cnpj:|o saldo l[íi]quido|n[ãa]o nos|valores em|•••|página|de \d|\d+ de \d+$)/i;
    var RE_ONLYNUMS6 = /^\d[\d\.\-]+$/; // linhas que são só números/conta (ex: "87450507-6", "4")

    var curData6 = null;
    var curTipo6 = null;
    var descBuf6 = [];

    for (var s6 = 0; s6 < lines.length; s6++) {
      var line6 = lines[s6];

      // Linha de data isolada: "01 ABR 2026"
      var hm6 = line6.match(RE_HDR6);
      if (hm6) {
        descBuf6 = [];
        var mes6 = MESES_PT[hm6[2].toLowerCase()];
        if (mes6) {
          curData6 = hm6[3] + '-' + String(mes6).padStart(2, '0') + '-' + String(parseInt(hm6[1])).padStart(2, '0');
          curTipo6 = null; // será definido pela linha seguinte (Total de saídas/entradas)
        }
        continue;
      }

      // Linha de tipo/total do dia: "Total de saídas- 84,96" ou "Total de entradas+ 65,00"
      if (RE_SUB6.test(line6)) {
        descBuf6 = [];
        curTipo6 = /sa[íi]da/i.test(line6) ? 'debito' : 'credito';
        continue;
      }

      // Linhas de rodapé/cabeçalho irrelevantes
      if (RE_SKIP6.test(line6)) { descBuf6 = []; continue; }

      // Aguarda data E tipo estarem definidos
      if (!curData6 || !curTipo6) { descBuf6 = []; continue; }

      // Valor puro → cria transação com descrição acumulada
      if (RE_VAL6.test(line6)) {
        if (descBuf6.length > 0) {
          var desc6  = descBuf6.join(' ').replace(/\s+/g, ' ').trim();
          var valor6 = parseValorBRL(line6);
          addTx(desc6, valor6, curData6, curTipo6);
          descBuf6 = [];
        }
        continue;
      }

      // Acumula linhas de descrição (2–200 chars)
      // Ignora linhas que são só números de conta (ex: "87450507-6", "4")
      if (line6.length >= 2 && line6.length <= 200 && !RE_ONLYNUMS6.test(line6)) {
        // Remove valores embutidos no final da linha (ex: "Resgate RDB1.592,47")
        var cleanLine6 = line6.replace(/[\d\.]+,\d{2}$/, '').trim();
        // "Resgate RDB", "Pagamento de fatura" SÃO transações válidas — não filtrar.
        if (cleanLine6.length >= 2) descBuf6.push(cleanLine6);
      }
    }
  }

  return results;
}

/**
 * Extrai transações de imagem ou PDF complexo usando Groq (llama-4-scout vision).
 * Requer GROQ_API_KEY no ambiente.
 */
// Extrai totais declarados no próprio texto do PDF (sem IA)
function extractMetaFromText(text) {
  function parseVal(str) { return parseFloat(str.replace(/\./g, '').replace(',', '.')); }
  var meta = { totalEntradas: null, totalSaidas: null, saldoFinal: null, totalCompras: null, totalAPagar: null };

  // "Total entradas +4.035,65" / "Total de entradas\n+R$ 4.035,65"
  var mE = text.match(/total\s+d[eo]?\s*entradas?[\s\S]{0,40}?(\d[\d\.]*,\d{2})/i);
  if (mE) meta.totalEntradas = parseVal(mE[1]);

  // "Total saídas -3.939,32" / "Total de saídas\n-R$ 3.939,32"
  var mS = text.match(/total\s+d[eo]?\s*sa[\u00ed\u0069]das?[\s\S]{0,40}?(\d[\d\.]*,\d{2})/i);
  if (mS) meta.totalSaidas = parseVal(mS[1]);

  // "Saldo final do período\nR$ 218,65" / "Saldo final R$ 218,65"
  var mSaldo = text.match(/saldo\s+(?:final|do\s+per[\u00ed\u0069]odo|l[\u00ed\u0069]quido)[\s\S]{0,60}?(\d[\d\.]*,\d{2})/i);
  if (mSaldo) meta.saldoFinal = parseVal(mSaldo[1]);

  // Fatura cartão: "Total de compras de todos os cartões\nR$ 908,47"
  // (só novas compras — sem saldo anterior, parcelas futuras, IOF)
  // Janela ampliada (300 chars) porque PDFs com colunas separam label/valor no texto extraído
  if (meta.totalEntradas === null) {
    // Helper: dentro da janela após uma âncora, pega o MAIOR valor decimal
    // (evita capturar IOF/conversão USD que aparece como primeiro número
    // logo após "total a pagar" em PDFs Nubank).
    function maiorAposAncora(ancoraRegex, janela) {
      var m = text.match(ancoraRegex);
      if (!m) return null;
      var trecho = text.substring(m.index + m[0].length, m.index + m[0].length + janela);
      var cands = (trecho.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [])
        .map(parseVal)
        .filter(function(v){ return v > 0; });
      return cands.length ? Math.max.apply(null, cands) : null;
    }

    meta.totalCompras = maiorAposAncora(
      /total\s+d[eo]?\s*compras?(?:\s+de\s+todos\s+os\s+cart[\u00f5o]es)?/i, 300
    );

    // "Total a pagar": tenta primeiro a frase mais específica do Nubank
    // ("Pagamento total da fatura"), que está sempre próxima do valor correto.
    meta.totalAPagar =
      maiorAposAncora(/pagamento\s+total\s+d[ao]\s+fatura/i, 200) ||
      maiorAposAncora(/total\s+a\s+pagar/i, 400);
  }

  if (meta.totalEntradas === null && meta.totalSaidas === null && meta.saldoFinal === null &&
      meta.totalCompras === null && meta.totalAPagar === null) return null;
  return meta;
}

// ===================================================================
// Extração por IA usando TEXTO (mais preciso e rápido que visão p/ PDFs)
// ===================================================================
async function extractWithAIFromText(text, tipo) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY não configurada no servidor.');

  var isExtrato = (tipo === 'extrato');
  var promptInstrucoes = isExtrato ? [
    'Você é um extrator preciso de extratos bancários brasileiros.',
    'OBJETIVO: extrair TODAS as movimentações do texto abaixo, sem omitir NENHUMA linha de transação.',
    'Inclua: Pix enviado/recebido, TED/DOC, transferências, pagamentos, compras no débito, salário, depósitos, tarifas, rendimentos, juros, IOF.',
    'IGNORE: linhas de saldo, totais diários ("Total de saídas", "Total de entradas"), cabeçalhos, rodapés, números de página, CPF, CNPJ.',
    'TIPO: "debito" para saídas/despesas (sinal -), "credito" para entradas/receitas (sinal +). VALOR sempre positivo.',
    'NUNCA invente valores. Se uma linha estiver ambígua, copie a descrição exatamente como está.',
    'TAREFA EXTRA: capture os totais declarados ("Total entradas", "Total saídas", "Saldo final") em "meta".',
    'Retorne SOMENTE JSON válido neste formato exato:',
    '{"transacoes":[{"desc":"PIX recebido - João","valor":150.00,"data":"2026-04-15","tipo":"credito"}],"meta":{"totalEntradas":4035.65,"totalSaidas":3939.32,"saldoFinal":218.65}}',
    'Use null em campos meta não visíveis. SEM markdown, SEM comentários.'
  ].join(' ') : [
    'Você é um extrator preciso de faturas de cartão de crédito brasileiras.',
    'OBJETIVO: extrair cada LINHA DE COMPRA/COBRANÇA individual present no detalhamento de transações da fatura.',
    'INCLUA: compras à vista, parcelas de compras antigas (ex: "3/10 LOJA X"), IOF individual de cada compra, juros de financiamento de compra específica, anuidade, ajustes a débito.',
    'INCLUA ESTORNOS com valor NEGATIVO (ex: "Estorno de Uber" → valor: -11.93). Eles compensam compras e fazem parte da soma final.',
    'IGNORE ESTRITAMENTE (nunca inclua como transação):',
    '- Linhas de pagamento: "Pagamento recebido", "Pagamento em DD MMM", "Pagamento de fatura"',
    '- Subtotais de seção: "Outros lançamentos R$ X", "Total de compras R$ X", "Pagamentos e Financiamentos R$ X", "Fatura anterior R$ X"',
    '- Subtotais por portador: linha com nome de pessoa + valor (ex: "João Silva   R$ 1.756,22") que aparece antes das transações do portador',
    '- Linhas de saldo: "Saldo restante da fatura anterior", "Saldo em aberto", "Pagamento mínimo"',
    '- Cabeçalhos de seção e rodapés (número de página, CNPJ, endereço)',
    'A soma dos valores extraídos (positivos + negativos dos estornos) deve bater com "Pagamento total da fatura" / "Total a pagar" do documento.',
    'TAREFA EXTRA: capture em "meta" DOIS totais: "totalCompras" ("Total de compras", só novas compras) E "totalAPagar" ("Pagamento total da fatura" ou "Total a pagar", valor cobrado).',
    'Retorne SOMENTE JSON válido: {"transacoes":[{"desc":"Loja","valor":50.00,"data":"2026-04-01"}],"meta":{"totalCompras":908.47,"totalAPagar":1242.36}}'
  ].join(' ');

  // Limita texto a 30k chars para não estourar contexto
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

// Soma transações por tipo para validar contra meta declarada
function sumByType(transacoes) {
  var creditos = 0, debitos = 0;
  (transacoes || []).forEach(function(t){
    var v = parseFloat(t.valor) || 0;
    if (t.tipo === 'credito') creditos += v;
    else if (t.tipo === 'debito') debitos += v;
  });
  return { creditos: creditos, debitos: debitos };
}

// Calcula score de captura: mínimo entre %entradas e %saídas (1.0 = perfeito)
function captureScore(transacoes, meta) {
  if (!meta) return null;
  // Fatura de cartão: alvo é o "Total a pagar" (inclui parcelas/IOF/encargos).
  // Fallback: totalCompras (só novas compras, mais restritivo).
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
  if (!key) throw new Error('GROQ_API_KEY não configurada no servidor.');

  var base64 = buffer.toString('base64');
  var isExtrato = (tipo === 'extrato');
  var prompt = isExtrato ? [
    'Você está analisando um extrato de conta corrente/bancária brasileiro.',
    'TAREFA 1 — Extraia TODAS as movimentações: débitos (saídas: Pix enviado, pagamentos, compras no débito, transferências enviadas, tarifas) E créditos (entradas: Pix recebido, salário, depósitos, transferências recebidas, rendimentos).',
    'Campo "tipo": "debito" para saídas, "credito" para entradas. valor sempre positivo. data em YYYY-MM-DD.',
    'NÃO omita nenhuma transação visível no extrato.',
    'TAREFA 2 — Procure no documento os totais declarados (ex: "Total entradas", "Total saídas", "Saldo final") e inclua no campo "meta".',
    'Retorne SOMENTE um JSON válido no formato:',
    '{"transacoes":[{"desc":"...","valor":50.00,"data":"2026-04-01","tipo":"debito"}],"meta":{"totalEntradas":4035.65,"totalSaidas":3939.32,"saldoFinal":218.65}}',
    'Se algum campo de meta não estiver visível no documento, use null. Responda APENAS com o JSON, sem explicações ou markdown.'
  ].join(' ') : [
    'Você está analisando uma IMAGEM de fatura de cartão de crédito brasileiro.',
    'LEIA A IMAGEM LINHA POR LINHA, do topo ao final. Cada linha com data + descrição + valor = UMA transação no JSON.',
    'REGRA CRÍTICA — FIDELIDADE: copie o valor EXATAMENTE como escrito na imagem (ex: R$ 150,00 → 150.00). NÃO arredonde, NÃO some, NÃO invente valores.',
    'REGRA CRÍTICA — COMPLETUDE: inclua TODAS as linhas de compra visíveis, sem pular nenhuma, mesmo que pareçam repetidas ou tenham valores similares.',
    'REGRA CRÍTICA — SEM DUPLICATAS: cada linha da imagem gera EXATAMENTE UMA entrada no JSON. NÃO duplique nenhuma linha.',
    'INCLUA: compras à vista, parcelas (ex: "Cobasi 1/2" → inclua só a parcela visível, não invente as demais), IOF, anuidade, ajustes a débito.',
    'INCLUA ESTORNOS com valor NEGATIVO (ex: "Estorno de Uber" → valor: -11.93). Eles compensam compras e fazem parte da soma final.',
    'IGNORE ESTRITAMENTE: linhas de "Pagamento recebido", "Pagamento em DD MMM", subtotais de seção (ex: "Outros lançamentos R$ X", "Total de compras R$ X"), nome de portador seguido de valor sem data, saldos, cabeçalhos, rodapés.',
    'TAREFA EXTRA: capture em "meta": "totalCompras" ("Total de compras") e "totalAPagar" ("Pagamento total" ou "Total a pagar").',
    'Formato de resposta — SOMENTE este JSON, sem markdown, sem explicação:',
    '{"transacoes":[{"desc":"nome exato do estabelecimento","valor":50.00,"data":"2026-04-01"}],"meta":{"totalCompras":908.47,"totalAPagar":1242.36}}',
    'Regras: valor é float, negativo para estornos/créditos. data em YYYY-MM-DD. Se data ilegível use "2000-01-01".',
    'Se não houver transações visíveis: {"transacoes":[],"meta":null}'
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

    // Tenta extrair JSON válido da resposta (objeto {transacoes,meta} ou array)
    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      var objMatch = content.match(/\{[\s\S]*\}/);
      var arrMatch = content.match(/\[[\s\S]*\]/);
      try { parsed = objMatch ? JSON.parse(objMatch[0]) : (arrMatch ? JSON.parse(arrMatch[0]) : null); }
      catch (_e2) { parsed = null; }
    }

    // Formato esperado: {"transacoes":[...], "meta":{...}} — tanto extrato como fatura
    var txArr   = Array.isArray(parsed) ? parsed : ((parsed && parsed.transacoes) || []);
    var metaObj = (!Array.isArray(parsed) && parsed && parsed.meta) ? parsed.meta : null;
    return { transacoes: txArr.filter(function(t){ return t.desc && parseFloat(t.valor) !== 0; }), meta: metaObj };

  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ─── POST /api/extrair-fatura ────────────────────────────────────────
// Recebe: multipart/form-data { arquivo: File (PDF|JPEG|PNG|WEBP) }
// Retorna: [{desc, valor, data}] — transações extraídas
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
      // ── 1) Extrair texto do PDF com pdf-parse ──────────────────────
      var pdfData;
      try {
        pdfData = await pdfParse(buffer, { max: 20 });
      } catch (pdfErr) {
        // PDF ilegível ou criptografado — retornar erro direto (visão IA não lê PDFs binários)
        return res.status(422).json({
          error: 'Não foi possível ler o PDF. O arquivo pode estar protegido por senha ou corrompido. Tente exportar o extrato como imagem ou use um arquivo OFX.'
        });
      }

      if (pdfData) {
        // ── 2) Extrair meta do texto e preparar transações ─────────
        textMeta = extractMetaFromText(pdfData.text || '');

        // Fatura de cartão: parseBankStatementText é para extratos bancários
        // Para faturas, vai sempre para IA (mais preciso e evita garbage)
        if (tipo !== 'fatura') {
          transacoes = parseBankStatementText(pdfData.text || '');
        }

        // ── 3) IA texto-mode se necessário ───────────────────────
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
            // Adota IA se capturou mais transações ou se score é maior
            if (aiTextResult.transacoes.length > transacoes.length ||
                (aiScore !== null && (parserScore2 === null || aiScore > parserScore2))) {
              transacoes = aiTextResult.transacoes;
            }
          } catch (_aiErr) {
            console.warn('[AI text-mode falhou]', _aiErr.message);
          }
        }

        // Nota: IA-visão removida para PDFs — modelos de visão não processam PDF binário.
        // Somente imagens (JPEG/PNG/WEBP/HEIC) são enviadas para extractWithAI.
      }

    } else {
      // ── Imagem: IA-visão obrigatória ─────────────────────────────
      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({
          error: 'Extração de imagens requer configuração do servidor (GROQ_API_KEY). Use PDF ou OFX.'
        });
      }
      var imgResult = await extractWithAI(buffer, mimeType, tipo);
      transacoes = imgResult.transacoes;
      aiMeta = imgResult.meta;
    }

    if (!transacoes || transacoes.length === 0) {
      return res.status(422).json({
        error: 'Nenhuma transação encontrada. Verifique se o arquivo é um extrato válido e tente novamente.'
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

// ─── Cache em memória de extração de cupom (24h) ────────────────────
// Chave: SHA-256 do buffer de cada arquivo combinado.
// Reduz custo Gemini quando o usuário re-envia o mesmo print.
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
  if (!key) throw new Error('GROQ_API_KEY não configurada no servidor.');

  var prompt = [
    'Você está analisando um CUPOM FISCAL NFC-e de supermercado brasileiro OU um PRINT de app de mercado/delivery (Rappi, iFood, Zé Delivery, Cornershop).',
    '',
    'ESTRUTURA DO CUPOM FISCAL NFC-e: cada item ocupa DUAS linhas:',
    '  Linha 1: ITEM(3 dígitos) CODIGO DESCRICAO UN',
    '  Linha 2: QTD UN x VL.UNIT  VL.TOTAL  (ou só "UN  VL.TOTAL" quando qtd=1)',
    '"valor" = VL.TOTAL (último número da linha 2). NUNCA use VL.UNIT.',
    'Quando a linha 2 mostra apenas "UN  14,99" sem "x", significa qtd=1 e valor=14.99.',
    '',
    'REGRA CRÍTICA — COMPLETUDE: leia do TOPO ao FIM. Cada número 001/002/003... é um item DISTINTO. Conte quantos números de item existem e garanta que o JSON tenha EXATAMENTE a mesma quantidade.',
    'REGRA CRÍTICA — FIDELIDADE: copie o VL.TOTAL EXATAMENTE. NÃO arredonde, NÃO recalcule.',
    'REGRA CRÍTICA — NOMES: copie a DESCRICAO EXATAMENTE como aparece (abreviações incluídas). NUNCA substitua por outro nome. "FILTR PAP MELIT" → "FILTR PAP MELIT", não "Feijão". "SACOLA PLAST TRANS" → "SACOLA PLAST TRANS", não "Salada". Máximo 60 chars.',
    'REGRA CRÍTICA — NUNCA INVENTE: se não conseguir ler, copie o que conseguir. JAMAIS substitua por produto diferente.',
    '',
    'Extraia TAMBÉM: nome curto do mercado/loja (ex: "Prezunic"), CNPJ (14 dígitos, se visível), data (YYYY-MM-DD).',
    'IGNORE: subtotais, total a pagar, formas de pagamento, troco, descontos.',
    'Se houver MÚLTIPLAS imagens, CONSOLIDE num único array.',
    '',
    'Categorias: "Mercado" (alimentos, hortifrúti, carnes, laticínios), "Padaria/Café" (pães, bolos, café), "Bares/Baladas" (bebidas alcoólicas, refrigerantes), "Farmácia" (higiene, medicamentos, limpeza), "Pets" (ração, areia), "Material Escolar", "Outros" (sacolas, embalagens, demais).',
    '',
    'Exemplo NFC-e (2 itens):',
    '  005 7896982103388 OVGS MANT GDE C/20 UN → { "nome":"OVGS MANT GDE C/20", "qtd":1, "valor":14.99, "cat":"Mercado" }',
    '  006 7896016500978 FARINH MAND GRANFI UN → 4.000 UN x 6.99  27.96 → { "nome":"FARINH MAND GRANFI", "qtd":4, "valor":27.96, "cat":"Mercado" }',
    '',
    'Retorne SOMENTE JSON (sem markdown):',
    '{"mercado":"Prezunic","cnpj":"12345678000199","data":"2026-04-25","itens":[{"nome":"LAMEN MIOJO 85G","qtd":4,"valor":12.76,"cat":"Mercado"}]}',
    'Se não houver itens: {"mercado":"","cnpj":"","data":"","itens":[]}'
  ].join('\n');

  // Monta content: imagens primeiro (mesmo padrão do extractWithAI que funciona em cartões/extrato)
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
    // Retry automático em rate limit (mesmo padrão do extractWithAI)
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
 * Mais barato e rápido que enviar imagem.
 */
async function extractCupomFromText(texto) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY não configurada no servidor.');

  var systemPrompt = 'Você é um extrator preciso de cupons fiscais e prints de apps de mercado/delivery brasileiros. Extraia TODOS os itens e cobranças. NUNCA invente valores. Retorne APENAS JSON válido.';

  var userPrompt = [
    'Extraia TODOS os itens e cobranças do texto abaixo: produtos, taxa de entrega, embalagem, serviço — qualquer linha com valor cobrado.',
    'IGNORE APENAS: subtotais, total a pagar, formas de pagamento, troco e descontos.',
    'Identifique também: nome do mercado, CNPJ (14 dígitos, apenas números), data (YYYY-MM-DD).',
    'Categorias: "Mercado", "Padaria/Café", "Bares/Baladas", "Farmácia", "Pets", "Material Escolar", "Outros".',
    '"valor" = valor total do item (float positivo). "qtd" = quantidade (1 se desconhecido). "nome" até 50 chars.',
    'Formato obrigatório: {"mercado":"...","cnpj":"...","data":"...","itens":[{"nome":"...","qtd":1,"valor":0.00,"cat":"Mercado"}]}',
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

// ─── Multer pra cupom (até 3 arquivos) ──────────────────────────────
var uploadCupom = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 3 }, // 3 MB cada (base64 ≈ 4MB = limite Groq)
  fileFilter: function (_req, file, cb) {
    var ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (ok.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato não suportado. Use PDF, JPEG, PNG ou WEBP.'));
  }
});

// ─── POST /api/extrair-cupom ─────────────────────────────────────────
// Aceita:
//   - multipart/form-data { arquivos: 1-3 files (image|pdf) }
//   - application/json     { texto: "..." } para colar texto direto
// Retorna: { mercado, cnpj, data, itens:[{nome,qtd,valor,cat}], cached?: true }
app.post('/api/extrair-cupom', function (req, res) {
  uploadCupom.array('arquivos', 3)(req, res, async function (multerErr) {
  if (multerErr) {
    var msg = multerErr.code === 'LIMIT_FILE_SIZE'
      ? 'Imagem muito grande. Máximo 3MB por arquivo. Comprima a imagem ou use a aba Texto.'
      : multerErr.message || 'Erro ao processar arquivo.';
    return res.status(413).json({ error: msg });
  }
  try {
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
      return res.json(resultText);
    }

    // Modo ARQUIVOS
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'Extração por IA não está configurada no servidor. Use a entrada manual.'
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

    // ── PDFs: extrair texto com pdf-parse → enviar como texto (Groq vision não aceita PDF) ──
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
        return res.status(422).json({ error: 'Não foi possível extrair texto do PDF. Tente fotografar o cupom (aba Foto).' });
      }
      var resultPdf = await extractCupomFromText(combinedPdfText);
      cupomCacheSet(cacheKey, resultPdf);
      return res.json(resultPdf);
    }

    var result = await extractCupomWithGroq(buffers, mimeTypes);

    cupomCacheSet(cacheKey, result);
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

// ─── Health check ───────────────────────────────────────────────────
app.get('/', function (_req, res) {
  res.json({ status: 'ok', service: 'bud-finance-backend' });
});

// ─── POST /api/processar-recorrentes ────────────────────────────────
// Lança transações de recorrentes cujo diaVencimento coincide com hoje (fuso Brasília).
// Autenticação: Bearer token do Firebase ID verificado server-side (anti-IDOR).
// Idempotência: antes de criar, verifica se já existe transação com
//   recorrenteId === id AND mesReferencia === YYYY-MM do mês atual.
app.post('/api/processar-recorrentes', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin não inicializado.' });
  }

  // ── Autenticação via Bearer token ──────────────────────────────────
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  var decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (_e) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
  var uid = decoded.uid;

  // ── Gate por plano (server-side — PEND-034) ───────────────────────
  var PLANOS_PERMITIDOS_REC = ['pro', 'plus', 'trial'];
  try {
    var userDoc = await db.collection('usuarios').doc(uid).get();
    var plano = (userDoc.exists && userDoc.data().plano) ? userDoc.data().plano.toLowerCase() : 'free';
    if (!PLANOS_PERMITIDOS_REC.includes(plano)) {
      return res.status(403).json({ error: 'Recurso disponível apenas nos planos Pro, Plus e Trial.' });
    }
  } catch (_e) {
    return res.status(500).json({ error: 'Erro ao verificar plano do usuário.' });
  }

  // ── Fuso horário Brasília (UTC-3) ───────────────────────────────────
  var agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  var hojeAno  = agora.getFullYear();
  var hojeMes  = agora.getMonth() + 1;           // 1–12
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
      // mensal: clamp ao último dia do mês
      var maxDia = new Date(hojeAno, hojeMes, 0).getDate();
      return Math.min(dia, maxDia) === hojeDia;
    });

    if (paraProcessar.length === 0) {
      return res.json({ success: true, processadas: 0, mensagem: 'Nenhuma recorrente vence hoje.' });
    }

    // Anti-duplicidade: buscar transações já lançadas neste mês por recorrenteId
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
      return res.json({ success: true, processadas: 0, mensagem: 'Todas as recorrentes de hoje já foram lançadas.' });
    }

    // Criar transações em batch (chunks de 400)
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
          formaPagamento: rec.cartaoId ? 'Crédito' : 'Débito',
          cartaoId:       rec.cartaoId || null,
          recorrenteId:   rec.id,
          origem:         'recorrente',
          observacao:     sanitizeStr(rec.observacao || ''),
          dataCriacao:    admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    // Registrar último processamento no doc do usuário
    await db.collection('usuarios').doc(uid).update({
      recorrentesUltimoProcessamento: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      processadas: novas.length,
      mensagem: novas.length + ' recorrente' + (novas.length !== 1 ? 's lançadas' : ' lançada') + ' no Extrato.',
      itens: novas.map(function (r) { return { id: r.id, descricao: r.descricao, valor: r.valor }; }),
    });

  } catch (err) {
    console.error('[processar-recorrentes]', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar recorrentes.' });
  }
});

// ─── POST /api/chat ─────────────────────────────────────────────────
// Chat com IA financeiro pessoal via Groq (llama-4-scout).
// Auth: Bearer Firebase ID Token. Gate: plano plus/trial.
// Rate limit: 30 msg/min por uid (in-memory).
app.post('/api/chat', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin não inicializado.' });
  }

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token de autenticação ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido ou expirado.' }); }

  var uid = decoded.uid;

  // Gate de plano server-side
  var PLANOS_CHAT = ['plus', 'trial'];
  try {
    var userSnap = await db.collection('usuarios').doc(uid).get();
    var plano = (userSnap.exists && userSnap.data().plano) ? userSnap.data().plano.toLowerCase() : 'free';
    if (!PLANOS_CHAT.includes(plano)) {
      return res.status(403).json({ error: 'Assistente IA disponível apenas no plano Plus.' });
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
    return res.status(400).json({ error: 'messages é obrigatório.' });
  }

  var key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'Serviço de IA não configurado.' });

  // System prompt com contexto financeiro + knowledge base do app
  var nome    = sanitizeStr(String(contexto.nome  || 'usuário')).substring(0, 60);
  var mesAno  = sanitizeStr(String(contexto.mesAno || '')).substring(0, 30);
  var r = contexto.resumo || {};
  var oculto  = contexto.valoresOcultos === true;
  var fmtBRL  = function(v) { return 'R$ ' + (Number(v)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtVal  = function(v) { return oculto ? '(valor oculto)' : fmtBRL(v); };

  var hoje = new Date().toISOString().slice(0, 10);

  var systemPrompt = [
    // ── REGRAS ABSOLUTAS — lidas primeiro pelo modelo ───────────────────────────
    '⚡ REGRA ABSOLUTA #1 — REGISTRAR TRANSAÇÃO (prioridade máxima):',
    'Quando o usuário disser que GASTOU, PAGOU, COMPROU, RECEBEU, GANHOU, TRANSFERIU dinheiro → você DEVE:',
    '  a) Responder em 1-2 frases curtas confirmando o que entendeu.',
    '  b) Incluir IMEDIATAMENTE ao final da resposta o bloco JSON abaixo. SEM perguntar. SEM pedir permissão.',
    '[ACTION:TRANSACTION]{"descricao":"descrição real do gasto","valor":0.00,"tipo":"despesa","categoria":"Outros","data":"' + hoje + '","conta":"nome exato da conta ou cartão do usuário, ou vazio se não mencionado"}[/ACTION]',
    'ATENÇÃO: o `[/ACTION]` de fechamento é OBRIGATÓRIO — NUNCA omita. O bloco deve ser o ÚLTIMO elemento da resposta — NÃO adicione texto depois do `[/ACTION]`.',
    'PROIBIDO: NÃO escreva "posso registrar?", NÃO pergunte "quer que eu registre?", NÃO diga "registrado" ou "foi salvo" — o usuário ainda precisa confirmar no app.',
    'Data de HOJE: ' + hoje + '. Use formato YYYY-MM-DD. NUNCA escreva "[data atual]" ou "[data de hoje]" — use a data real.',
    'tipo: "despesa" se gastou/pagou/comprou. "receita" se recebeu/ganhou.',
    'Categorias disponíveis (use SOMENTE estas no campo "categoria" do JSON): ' + (Array.isArray(r.categorias) && r.categorias.length ? r.categorias.join(', ') : 'Alimentação, Transporte, Saúde, Educação, Lazer, Moradia, Vestuário, Tecnologia, Serviços, Outros') + '.',
    '',
    '⚡ REGRA ABSOLUTA #2 — CARTÃO DE CRÉDITO SEM CADASTRO:',
    (Array.isArray(r.cartoes) && r.cartoes.length === 0) ? 'O usuário NÃO tem nenhum cartão de crédito cadastrado no app.' : '',
    (Array.isArray(r.cartoes) && r.cartoes.length === 0) ? 'Se o usuário mencionar gasto no "cartão de crédito" → NÃO emitir [ACTION:TRANSACTION]. Responda informando que ele ainda não tem cartão cadastrado e oriente-o a ir em Cartões (menu lateral) > "Adicionar cartão" para cadastrar antes de registrar gastos. NÃO pergunte detalhes do cartão (limite, saldo, etc.).' : '',
    '',
    '⚡ REGRA ABSOLUTA #3 — CONTA BANCÁRIA SEM CADASTRO:',
    (Array.isArray(r.carteira) && r.carteira.length === 0) ? 'O usuário NÃO tem nenhuma conta bancária cadastrada na Carteira.' : '',
    (Array.isArray(r.carteira) && r.carteira.length === 0) ? 'Se o usuário mencionar gasto em conta bancária e não há contas → pode registrar a transação sem vincular conta (deixe "conta" vazio no JSON), mas avise que ele pode cadastrar uma conta em Carteira para controle completo.' : '',
    '',
    '⚡ REGRA ABSOLUTA #4 — METAS SEM CADASTRO:',
    (r.metas === 0) ? 'O usuário NÃO tem nenhuma meta cadastrada no app.' : '',
    (r.metas === 0) ? 'Se o usuário disser que "depositou em uma meta", "guardou para uma meta" ou perguntar sobre progresso de metas → NÃO emitir [ACTION:TRANSACTION]. Oriente-o a ir em Metas (menu lateral) > "Nova meta" para criar antes de registrar aportes.' : '',
    '',
    '⚡ REGRA ABSOLUTA #5 — DÍVIDAS SEM CADASTRO:',
    (r.dividasAtivas === 0) ? 'O usuário NÃO tem nenhuma dívida registrada no app.' : '',
    (r.dividasAtivas === 0) ? 'Se o usuário disser que "pagou parcela de dívida/financiamento/empréstimo" → registre normalmente como despesa via [ACTION:TRANSACTION], mas adicione um aviso de que a dívida não está cadastrada no app e que ele pode registrá-la em Dívidas (menu lateral) para controle completo das parcelas.' : '',
    '',
    '⚡ REGRA ABSOLUTA #6 — INVESTIMENTOS SEM CADASTRO:',
    (r.investimentos === 0) ? 'O usuário NÃO tem nenhum investimento cadastrado no app.' : '',
    (r.investimentos === 0) ? 'Se o usuário mencionar compra de ações, CDB, FII, cripto ou qualquer investimento → NÃO registre como despesa comum. Oriente-o a ir em Investimentos (menu lateral) para registrar o ativo corretamente com rentabilidade e acompanhamento. Se ele quiser apenas registrar a saída de dinheiro, esclareça a diferença.' : '',
    '',
    '=== IDENTIDADE ===',
    'Você é o Bud, assistente inteligente do app Bud Finance.',
    'Tom: amigável, motivador, direto, empático. Use emojis com moderação.',
    'Responda SEMPRE em português brasileiro.',
    'Use Markdown para formatar suas respostas: **negrito**, listas, tabelas quando fizer sentido.',
    '',
    '=== SOBRE O BUD FINANCE ===',
    'Site/landing: https://budsolucoes.com.br',
    'App (login): https://budsolucoes.com.br/appbudfinance/',
    'Desenvolvido por: Bud Soluções',
    '',
    '=== PLANOS E PREÇOS ===',
    '• Gratuito (Free): funcionalidades básicas — lançamento manual de receitas e despesas, carteira, extrato, categorias, dashboard, metas e investimentos.',
    '• Starter — R$ 9,99/mês: tudo do Free + Mercado de compras, Limites por categoria, Comparativo mensal, Relatórios PDF/CSV.',
    '• Pro — R$ 29,90/mês: tudo do Starter + Recorrentes automáticas, Dívidas com Tabela Price, Gráficos avançados, Importação de extratos (PDF/OFX/CSV/imagem), Insights de saúde financeira, Balanço mensal.',
    '• Plus — R$ 49,90/mês: tudo do Pro + Assistente de IA (você, o Bud), Assistente WhatsApp (em breve), Parcelamento inteligente de cartão via IA.',
    '• Trial: 3 dias grátis com funcionalidades Pro ao criar conta.',
    'Para assinar: acessar https://budsolucoes.com.br (seção Planos) ou dentro do app em qualquer banner de upgrade.',
    '',
    '=== CONTATO E SUPORTE ===',
    'E-mail: budsolucoes@gmail.com',
    'WhatsApp: (21) 98355-4954 — https://wa.me/5521983554954',
    'Instagram: @appbudfinance — https://www.instagram.com/appbudfinance',
    'Site: https://budsolucoes.com.br',
    'Se o usuário tiver dúvidas que você não consegue resolver, oriente-o a entrar em contato pelo WhatsApp ou e-mail acima.',
    'Para reportar bugs ou sugestões: dentro do app, botão "?" no Assistente de IA → opção "Reportar problema" ou "Enviar sugestão".',
    '',
    '=== REGRAS CRÍTICAS ===',
    '- NUNCA invente dados financeiros. Use APENAS os dados do contexto abaixo.',
    '- Se o usuário perguntar algo fora de finanças pessoais ou uso do app, redirecione gentilmente.',
    '- Se não tiver dados suficientes para responder, diga que o usuário precisa cadastrar mais informações no app.',
    oculto ? '- O usuário ativou o modo privacidade. NÃO exiba valores monetários explícitos. Use termos como "seu saldo", "seus gastos" sem números.' : '',
    '',
    '=== REGISTRAR TRANSAÇÕES — LEMBRETE ===',
    'Reforçando: qualquer frase como "gastei X", "paguei Y", "comprei Z", "recebi W" = incluir [ACTION:TRANSACTION]{...}[/ACTION] sem hesitar.',
    'Não use o bloco para análises, perguntas ou dúvidas — apenas quando o usuário relata uma movimentação financeira concreta.',
    '',
    '=== FUNCIONALIDADES DO BUD FINANCE (para ajudar o usuário) ===',
    '• Dashboard: visão geral com saldo, resumo do mês, últimas transações, lembretes de vencimento em 7 dias, widget de limites, widget de carteira, score de saúde financeira, gráfico de categorias, dica financeira do dia e streak de uso.',
    '• Extrato: histórico completo de transações com filtros por data, categoria, tipo. Para lançar: botão "+" no extrato ou dashboard.',
    '• Carteira (Contas): gerenciar contas bancárias, poupança, benefícios (vale alimentação, etc). Importar extratos CSV/OFX/PDF/imagem via IA. Ver histórico de importações anteriores.',
    '• Transferências: mover saldo entre contas cadastradas. Gera dois lançamentos automáticos. Botão "Transferir" na tela Carteira.',
    '• Cartões: gerenciar múltiplos cartões de crédito. Acompanhar fatura atual, limite disponível, parcelas em aberto e parcelamento inteligente via IA (plano Plus). Pagar fatura de uma conta cadastrada.',
    '• Recorrentes: lançar automaticamente contas fixas (aluguel, streaming, etc.) todo mês no dia configurado. Suporta parcelas restantes. (plano Pro+)',
    '• Dívidas: controlar empréstimos e financiamentos com Tabela Price, simulador de quitação antecipada e acompanhamento de parcelas. (plano Pro+)',
    '• Metas: definir objetivos financeiros (viagem, reserva, etc) e acompanhar progresso com aportes manuais.',
    '• Limites: definir teto de gastos por categoria (ex: máx R$ 500 em restaurantes/mês). Alertas ao aproximar do limite. (plano Starter+)',
    '• Investimentos: registrar renda fixa, ações, FIIs, cripto e ver rentabilidade consolidada.',
    '• Análises/Gráficos: gráficos de pizza, barras e evolução dos gastos por categoria. (plano Pro+)',
    '• Insights: score de saúde financeira 0-100, alertas automáticos, projeções e dicas personalizadas. (plano Pro+)',
    '• Balanço Mensal: fechar o mês e ver resultado geral consolidado. (plano Pro+)',
    '• Comparativo: comparar meses lado a lado para ver evolução. (plano Starter+)',
    '• Relatórios: exportar dados em PDF/CSV. (plano Starter+)',
    '• Mercado: lista de compras inteligente com estimativa de valor. (plano Starter+)',
    '• Categorias: criar e personalizar categorias de gastos (ícone, cor, nome).',
    '• Onboarding: ao criar a conta, fluxo guiado para cadastrar conta principal, renda e primeira despesa fixa.',
    '• Configurações: mudar plano, tema de cor (8 opções: Padrão Gelo, Dark HBO e 6 temas coloridos), foto de perfil, ocultar valores (privacidade), exportar dados, excluir conta, resetar dados financeiros.',
    '• Assistente de IA (você): chat financeiro com contexto real do usuário, registro de transações por voz/texto, chamados de suporte. (plano Plus)',
    '• Assistente WhatsApp: controle financeiro direto pelo WhatsApp — EM BREVE, aguardando infraestrutura. (plano Plus)',
    '',
    '=== PROBLEMAS COMUNS E SOLUÇÕES ===',
    '- Transação não aparece: checar filtros de data no Extrato (pode estar fora do período selecionado).',
    '- Saldo errado: verificar em Carteira se todas as contas têm saldo correto e se há lançamentos duplicados.',
    '- Recorrente não lançou: verificar dia de vencimento em Recorrentes e aguardar o processamento automático (ocorre todo dia).',
    '- Notificação não chegou: verificar permissões de notificação no navegador → Configurações → Notificações.',
    '- Meta não avança: os aportes são manuais — ir em Metas e clicar em "Depositar" na meta desejada.',
    '- Limite não aparece: verificar em Limites se a categoria está corretamente configurada.',
    '',
    '=== DADOS FINANCEIROS REAIS DO USUÁRIO ===',
    'Nome: ' + nome,
    'Período atual: ' + mesAno,
    'Receitas: ' + fmtVal(r.receitas),
    'Despesas: ' + fmtVal(r.despesas),
    'Resultado: ' + fmtVal((r.receitas||0) - (r.despesas||0)),
    'Saldo total contas: ' + fmtVal(r.saldoContas),
    'Contas: ' + (Array.isArray(r.contas) && r.contas.length ? r.contas.join(' | ') : 'nenhuma cadastrada'),
    'Contas bancárias cadastradas: ' + (Array.isArray(r.carteira) && r.carteira.length ? r.carteira.map(function(c){return c.nome;}).join(', ') : 'NENHUMA'),
    'Cartões de crédito cadastrados: ' + (Array.isArray(r.cartoes) && r.cartoes.length ? r.cartoes.map(function(c){return c.nome;}).join(', ') : 'NENHUM'),
    'Top categorias de gasto: ' + (Array.isArray(r.topCats) && r.topCats.length ? r.topCats.join(' | ') : 'sem dados'),
    'Dívidas ativas: ' + (r.dividasAtivas || 0),
    'Metas ativas: ' + (r.metas || 0),
    Array.isArray(r.metasDetalhe) && r.metasDetalhe.length ? 'Detalhe metas: ' + r.metasDetalhe.join(' | ') : '',
    'Limites estourados: ' + (r.limitesEstourados || 0),
    Array.isArray(r.limites) && r.limites.length ? 'Detalhe limites: ' + r.limites.join(' | ') : '',
    'Investimentos cadastrados: ' + (r.investimentos || 0),
    r.mesAnoAnt ? ('Mês anterior (' + r.mesAnoAnt + '): Receitas ' + fmtVal(r.receitasAnt) + ' | Despesas ' + fmtVal(r.despesasAnt) + ' | Saldo ' + fmtVal(r.saldoAnt)) : '',
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
      // ── Streaming SSE ────────────────────────────────────────────────────────
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

    // ── Resposta JSON (fallback sem streaming) ───────────────────────────────
    var data   = await resp.json();
    var reply  = (data.choices || [])[0]?.message?.content || 'Não consegui gerar uma resposta.';

    // Detectar truncamento
    var finishReason = (data.choices || [])[0]?.finish_reason;
    if (finishReason === 'length') {
      reply += '\n\n_⚠️ Resposta resumida. Peça "continue" para mais detalhes._';
    }

    return res.json({ reply: reply });

  } catch (err) {
    clearTimeout(timeoutId);
    if (res.headersSent) {
      res.write('data: ' + JSON.stringify({ error: 'Erro interno.' }) + '\n\n');
      return res.end();
    }
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout na geração da resposta. Tente novamente.' });
    }
    console.error('[/api/chat]', err.message);
    return res.status(500).json({ error: 'Erro ao gerar resposta. Tente novamente.' });
  }
});

// ─── POST /api/chamado ───────────────────────────────────────────────
// Registra bug ou sugestão no Firestore + envia email ao suporte.
// Auth: Bearer Firebase ID Token. Rate limit: 5 chamados/15 min.
app.post('/api/chamado', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin não inicializado.' });
  }

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token de autenticação ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido ou expirado.' }); }

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
  var nomeUsuario = sanitizeStr(String(req.body.nomeUsuario || 'Anônimo')).substring(0, 100);

  if (!tipo || !descricao) {
    return res.status(400).json({ error: 'tipo e descricao são obrigatórios.' });
  }
  if (!['bug', 'sugestao'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo deve ser "bug" ou "sugestao".' });
  }

  try {
    await db.collection('chamados').add({
      tipo,
      descricao,
      uid:           uid,                              // fonte confiável (BUG 13)
      emailUsuario:  decoded.email || '',              // email do token (mais seguro)
      nomeUsuario,
      criadoEm:      new Date().toISOString(),
      status:        'aberto',
      notificadoUser: true,                            // criador já sabe que abriu
      plataforma:    (req.headers['user-agent'] || '').substring(0, 200),
    });

    // Email de notificação ao suporte (fire-and-forget, sem bloquear resposta)
    sendEmailViaEmailJS({
      to_email:  'suporte@budfinance.com.br',
      to_name:   nomeUsuario,
      tipo:      tipo === 'bug' ? '🐛 Bug' : '💡 Sugestão',
      message:   descricao,
      admin_url: FRONTEND_URL + '/admin.html',
    }, EMAILJS_TEMPLATE_CHAMADO).catch(function () { /* ignora falha de email */ });

    return res.json({ success: true });

  } catch (err) {
    console.error('[/api/chamado]', err.message);
    return res.status(500).json({ error: 'Erro ao registrar chamado.' });
  }
});

// ─── GET /api/chamados ────────────────────────────────────────────────
// Lista chamados para o painel admin. Auth: role === 'admin'.
app.get('/api/chamados', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

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

// ─── PATCH /api/chamados/:id ──────────────────────────────────────────
// Atualiza status de um chamado. Auth: role === 'admin'.
app.patch('/api/chamados/:id', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

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
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    var update = { status: novoStatus };
    // Quando resolvido, marcar como não-notificado para o usuário ver no IA
    if (novoStatus === 'resolvido') update.notificadoUser = false;
    // Ao reabrir, limpa a flag para não mostrar notificação velha
    if (novoStatus === 'aberto') update.notificadoUser = true;
    await db.collection('chamados').doc(chamadoId).update(update);
    return res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/chamados]', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar chamado.' });
  }
});

// ─── GET /api/meus-chamados ───────────────────────────────────────────
// Retorna chamados do usuário logado com notificadoUser === false (resolvidos não vistos).
// Após retornar, marca todos como notificadoUser: true em batch.
app.get('/api/meus-chamados', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase Admin não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

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

// ─── POST /api/alerta-financeiro ────────────────────────────────────
// Enviado pelo frontend quando detecta problemas críticos (saldo negativo,
// despesas > receitas, limites estourados). Envia email para o usuário
// e registra no Firestore. Rate limit: 1 por uid a cada 24h.
app.post('/api/alerta-financeiro', async function (req, res) {
  if (!auth || !db) {
    return res.status(503).json({ error: 'Firebase Admin não inicializado.' });
  }

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

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
  var nomeUsuario = sanitizeStr(String(req.body.nomeUsuario || 'Usuário')).substring(0, 100);
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

  // Enviar email de alerta para o usuário (fire-and-forget)
  if (emailUser) {
    var alertasTexto = alertasSanitizados.map(function (a) {
      var icone = a.nivel === 'critico' ? '🚨' : a.nivel === 'alerta' ? '⚠️' : 'ℹ️';
      return icone + ' ' + a.texto;
    }).join('\n');

    sendEmailViaEmailJS({
      to_email:      emailUser,
      to_name:       nomeUsuario,
      assunto:       'Alerta financeiro detectado no Bud Finance',
      corpo:         'O Bud detectou os seguintes pontos de atenção nas suas finanças:\n\n' + alertasTexto + '\n\nAcesse o app para ver detalhes e tomar ação.',
    }).catch(function () { /* ignora falha */ });
  }

  try {
    await salvarPromise;
    return res.json({ success: true, enviado: true });
  } catch (err) {
    console.error('[/api/alerta-financeiro]', err.message);
    return res.json({ success: true, enviado: false }); // não falha o cliente
  }
});

// ─── GET /api/ping ─────────────────────────────────────────────────
// Rota leve para acordar o servidor no Render free tier.
// Chamada silenciosa no carregamento de qualquer página que use o backend.
app.get('/api/ping', function (_req, res) {
  res.json({ ok: true, ts: Date.now() });
});

// ══════════════════════════════════════════════════════════════════════
// ASSISTENTE WHATSAPP — FASE 1: Vínculo via Token de Pareamento
// ══════════════════════════════════════════════════════════════════════

// Helper: gera token alfanumérico 4 chars
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

// ─── Helper compartilhado: processa mensagem WA (pareamento Fase 1) ──
// jid = JID completo (ex: 5521999999@s.whatsapp.net ou 18962346@lid)
// numero = apenas dígitos/id sem sufixo (para Firestore)
async function processarMensagemWA(jid, texto) {
  if (!db) return;
  // Normalizar: remover espaços, aceitar minúsculas (bud-xxxx ou BUD - XXXX)
  texto = texto.replace(/\s+/g, '').trim();
  if (!/^BUD-[A-Z0-9]{4}$/i.test(texto)) return; // Fase 2 (futura): chat IA

  var codigo = texto.toUpperCase();
  var numero = jid.split('@')[0]; // apenas dígitos para Firestore
  var agora  = Date.now();
  var snap   = await db.collection('usuarios')
    .where('whatsappToken', '==', codigo)
    .limit(1).get();

  if (snap.empty) {
    await enviarMensagemWA(jid, '❌ Código inválido ou expirado. Gere um novo código em Ajustes → WhatsApp no app.');
    return;
  }

  var userDoc  = snap.docs[0];
  var userData = userDoc.data();

  if (!userData.whatsappTokenExp || agora > userData.whatsappTokenExp) {
    await enviarMensagemWA(jid, '⏰ Código expirado. Gere um novo em Ajustes → WhatsApp no app.');
    return;
  }

  await userDoc.ref.update({
    whatsappVinculado:   numero, // armazena só os dígitos (sem @lid/@s.whatsapp.net)
    whatsappToken:       null,
    whatsappTokenExp:    null,
    whatsappVinculadoEm: new Date().toISOString()
  });

  var nome = (userData.nome || '').split(' ')[0] || 'usuário';
  await enviarMensagemWA(jid,
    '✅ Olá, ' + nome + '! Seu WhatsApp está vinculado ao Bud Finance. 🎉\n\n' +
    'Agora você pode:\n' +
    '• Registrar gastos: _"gastei 50 de gasolina"_\n' +
    '• Consultar saldo: _"qual meu saldo?"_\n' +
    '• Tirar foto de cupom e eu registro automaticamente\n\n' +
    'Pode começar! 🚀'
  );
  console.log('[WA] número vinculado:', numero, '→ uid:', userDoc.id);
}

// ─── GET /webhook/whatsapp ─── verificação Meta ─────────────────────
app.get('/webhook/whatsapp', function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === WA_VERIFY_TOKEN) {
    console.log('[WA] webhook verificado');
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// ─── POST /webhook/whatsapp ─── recebe mensagens (Meta Cloud API) ───
app.post('/webhook/whatsapp', async function (req, res) {
  // Verificar assinatura HMAC se WA_APP_SECRET configurado
  if (WA_APP_SECRET) {
    var sig      = req.headers['x-hub-signature-256'] || '';
    var expected = 'sha256=' + require('crypto')
      .createHmac('sha256', WA_APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (sig !== expected) { console.warn('[WA] assinatura inválida'); return res.sendStatus(403); }
  }
  res.sendStatus(200); // responder rápido ao Meta

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

// ─── POST /webhook/evolution ─── recebe mensagens (Evolution API) ───
// Formato Evolution API v2. Configurar no painel da Evolution:
//   URL: https://nexo-backend-4kmu.onrender.com/webhook/evolution
//   Events: MESSAGES_UPSERT
app.post('/webhook/evolution', async function (req, res) {
  res.sendStatus(200); // responder rápido
  // Log completo apenas para messages.upsert (debug @lid)
  if (req.body?.event === 'messages.upsert') {
    console.log('[EVO-DEBUG] messages.upsert FULL:', JSON.stringify(req.body));
  }

  try {
    // Nota: Evolution API não envia apikey nos webhooks. Auth via URL secreta opcional.
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

// ─── POST /api/whatsapp/gerar-token ─────────────────────────────────
// Gera código de pareamento para vincular WhatsApp. Auth: Bearer token.
app.post('/api/whatsapp/gerar-token', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

  // Verificar plano
  try {
    var userSnap = await db.collection('usuarios').doc(decoded.uid).get();
    var plano = (userSnap.data()?.plano || 'free').toLowerCase();
    if (!['plus', 'pro', 'trial'].includes(plano)) {
      return res.status(403).json({ error: 'Recurso disponível apenas nos planos Plus, Pro e Trial.' });
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
      waNumeroDisplay: WA_NUMERO_DISPLAY || '(número não configurado)',
      waLink:          WA_NUMERO_LINK ? 'https://wa.me/' + WA_NUMERO_LINK + '?text=' + encodeURIComponent(token) : null
    });
  } catch (err) {
    console.error('[/api/whatsapp/gerar-token]', err.message);
    return res.status(500).json({ error: 'Erro ao gerar token.' });
  }
});

// ─── GET /api/whatsapp/status ─────────────────────────────────────
// Retorna status do vínculo WhatsApp do usuário autenticado.
app.get('/api/whatsapp/status', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

  try {
    var snap    = await db.collection('usuarios').doc(decoded.uid).get();
    var data    = snap.data() || {};
    var vinculado = data.whatsappVinculado || null;
    return res.json({ vinculado: !!vinculado, numero: vinculado });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar status.' });
  }
});

// ─── POST /api/whatsapp/desvincular ──────────────────────────────────
// Remove vínculo WhatsApp do usuário.
app.post('/api/whatsapp/desvincular', async function (req, res) {
  if (!auth || !db) return res.status(503).json({ error: 'Firebase não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

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

// ─── POST /mercadopago/create-subscription ──────────────────────────
// Cria uma assinatura recorrente (preapproval) no Mercado Pago.
// Auth: Bearer Firebase ID Token.
// Body: { planKey: 'starter'|'pro'|'plus', ref?: string }
// Segurança: uid e email extraídos do Bearer token — nunca do body.
app.post('/mercadopago/create-subscription', async function (req, res) {
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Pagamentos não configurados.' });
  if (!auth || !db)     return res.status(503).json({ error: 'Firebase não inicializado.' });

  // 1. Verificar token
  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

  var uid   = decoded.uid;
  var email = decoded.email || '';

  // 2. Validar planKey
  var planKey = String(req.body.planKey || '').toLowerCase().trim();
  if (!MP_PLANS[planKey]) return res.status(400).json({ error: 'Plano inválido.' });

  var plan   = MP_PLANS[planKey];
  var amount = plan.amount;

  // 3. Validar ref code e aplicar desconto de 10% se indicação legítima
  var rawRef  = req.body.ref ? String(req.body.ref).trim() : null;
  var refCode = rawRef ? rawRef.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null;
  if (refCode) {
    try {
      var refSnap = await db.collection('usuarios')
        .where('codigoIndicacao', '==', refCode).limit(1).get();
      if (refSnap.empty) {
        refCode = null; // código não encontrado — sem desconto
      } else {
        amount = Math.round(plan.amount * (1 - MP_INDICACAO_DESCONTO) * 100) / 100;
      }
    } catch (_e) { refCode = null; }
  }

  // 4. external_reference: uid|planKey[|refCode] — recuperado no webhook
  var externalRef = uid + '|' + planKey + (refCode ? '|' + refCode : '');

  // 4.5. Buscar dados do usuário no Firestore para enriquecer o payer (melhora aprovação)
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
  } catch (_e) { /* não bloqueia o fluxo */ }

  // 5. Criar preapproval no Mercado Pago
  // Link expira em 2 horas — impede que o link seja usado por terceiros após esse período
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
    return res.status(500).json({ error: 'Erro de comunicação com Mercado Pago.' });
  }
});

// ─── POST /webhook/mercadopago ───────────────────────────────────────
// Recebe notificações do Mercado Pago e atualiza o plano no Firestore.
// Configurar no painel MP → Integrações → Webhooks:
//   URL: https://bud-finance-backend.onrender.com/webhook/mercadopago
//   Eventos: subscription_preapproval, payment
app.post('/webhook/mercadopago', async function (req, res) {
  // 1. Verificar assinatura HMAC-SHA256 (obrigatório — falha se secret não configurado)
  if (!MP_WEBHOOK_SECRET) {
    console.error('[MP webhook] MP_WEBHOOK_SECRET não configurado — rejeitando requisição');
    return res.status(503).json({ error: 'Webhook não configurado.' });
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
    console.warn('[MP webhook] Assinatura inválida — ignorando');
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  // 2. Responder imediatamente (MP exige resposta rápida)
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
    console.error('[MP webhook] Erro ao processar notificação:', err.message);
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
    // Validar que quem pagou é o dono da conta Bud Finance
    var payerEmail = String(sub.payer_email || '').toLowerCase().trim();
    try {
      var userSnap2 = await db.collection('usuarios').doc(uid).get();
      if (userSnap2.exists) {
        var userEmail2 = String(userSnap2.data().email || '').toLowerCase().trim();
        if (payerEmail && userEmail2 && payerEmail !== userEmail2) {
          console.warn('[MP webhook] Pagador inválido — cancelando assinatura:', uid, payerEmail, '!=', userEmail2);
          // Cancelar no MP para evitar cobranças futuras
          try {
            await fetch('https://api.mercadopago.com/preapproval/' + preapprovalId, {
              method:  'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN },
              body:    JSON.stringify({ status: 'cancelled' })
            });
          } catch (_ec) { /* cancelamento falhou — ativação bloqueada de qualquer forma */ }
          await db.collection('usuarios').doc(uid).update({
            pagamentoPendente: true,
            erroAssinatura:    'pagador_invalido',
            planoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp()
          });
          return; // não ativa o plano
        }
      }
    } catch (_ev) { /* se validação falhar, prossegue com ativação normal */ }

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
          console.log('[MP webhook] Pagamento recusado — flag pagamentoPendente:', uid, payment.status_detail);
        }
      }
    } catch (e) { console.error('[MP webhook] Erro ao marcar pagamentoPendente:', e.message); }
    return;
  }

  if (payment.preapproval_id) await _mpHandleSubscription(String(payment.preapproval_id));
}

// Registra indicação bem-sucedida na subcoleção do referrer
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
    console.log('[MP] Indicação creditada:', refCode, '→', novoUid);
  } catch (err) {
    console.error('[MP] Erro ao creditar indicação:', err.message);
  }
}

// ─── POST /mercadopago/sandbox-activate (APENAS sandbox) ────────────
// Simula ativação de plano sem passar pelo checkout do MP.
// Útil para testar o pipeline Firestore em ambiente de teste.
app.post('/mercadopago/sandbox-activate', async function (req, res) {
  if (!MP_ACCESS_TOKEN.startsWith('TEST-'))
    return res.status(403).json({ error: 'Endpoint disponível apenas em modo sandbox.' });
  if (!auth || !db) return res.status(503).json({ error: 'Firebase não inicializado.' });

  var authHeader = req.headers.authorization || '';
  var idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Token ausente.' });

  var decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (_e) { return res.status(401).json({ error: 'Token inválido.' }); }

  var uid     = decoded.uid;
  var planKey = String(req.body.planKey || 'pro').toLowerCase().trim();
  if (!MP_PLANS[planKey]) return res.status(400).json({ error: 'Plano inválido.' });

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

// ─── Start server ───────────────────────────────────────────────────
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('[Bud Finance Backend] Running on port ' + PORT);
});
