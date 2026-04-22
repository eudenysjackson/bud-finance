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
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db   = admin.firestore();

// ─── EmailJS config (env vars — set on Render) ─────────────────────
const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || '';
const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || '';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_RECUPERAR_SENHA || '';
const FRONTEND_URL        = process.env.FRONTEND_URL || 'https://bud-finance.onrender.com';

// ─── Express setup ──────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10kb' }));

// CORS — allow only the frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://bud-finance.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

// ─── Rate limiting (simple in-memory) ───────────────────────────────
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
async function sendEmailViaEmailJS(templateParams) {
  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
    // EmailJS not configured — skip silently
    return;
  }

  var response = await fetch('https://api.emailjs.com/api/v1.6/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id:     EMAILJS_PUBLIC_KEY,
      template_params: templateParams
    })
  });

  if (!response.ok) {
    throw new Error('EmailJS HTTP ' + response.status);
  }
}

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
  return keywords.test(line.trim());
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

  function addTx(desc, valor, data) {
    if (!desc || valor <= 0 || valor > 99999) return;
    var key = desc.toLowerCase() + '|' + valor + '|' + data;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ desc: desc, valor: valor, data: data });
  }

  // ─── Estratégia 1: layout horizontal ──────────────────────────────
  // "DD ABR Description R$ 50,00" ou "DD/MM Description 50,00"
  var RE_PT = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.{3,70}?)\s+([\d\.]+,\d{2})\s*$/i;
  var RE_DDMM = /^(\d{2})\/(\d{2})(?:\/\d{4})?\s+(.{3,70}?)\s+R?\$?\s*([\d\.]+,\d{2})\s*$/;

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
      var desc2 = m2[3].replace(/R\$\s*/g, '').trim();
      var valor2 = parseValorBRL(m2[4]);
      var data2 = ano + '-' + m2[2] + '-' + m2[1];
      addTx(desc2, valor2, data2);
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
          // Linha de valor
          if (j < lines.length) {
            var valLine = lines[j];
            var valM = valLine.match(/^-?R?\$?\s*([\d\.]+,\d{2})$/);
            if (valM && descLines.length > 0) {
              var desc3 = descLines.join(' ').replace(/\s+/g, ' ').trim();
              var valor3 = parseValorBRL(valM[1]);
              var data3 = ano + '-' + String(mesV).padStart(2,'0') + '-' + String(dia).padStart(2,'0');
              addTx(desc3, valor3, data3);
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
    var SKIP3    = /^(pagamento|estorno|saldo restante|parcelamento|outros lan)/i;

    for (var k = 0; k < lines.length - 1; k++) {
      var dm3 = lines[k].match(RE_DATE3);
      if (!dm3) continue;
      var nxt = lines[k + 1];
      // Pula créditos, pagamentos e linhas de cabeçalho
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
  }

  return results;
}

/**
 * Extrai transações de imagem ou PDF complexo usando Gemini 1.5 Flash.
 * Requer GEMINI_API_KEY no ambiente.
 */
async function extractWithGemini(buffer, mimeType) {
  var key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada no servidor.');

  var base64 = buffer.toString('base64');
  var prompt = [
    'Você está analisando um extrato/fatura de cartão de crédito brasileiro.',
    'Extraia TODAS as transações de COMPRA/DÉBITO. Ignore pagamentos de fatura, créditos, totais e saldos.',
    'Retorne SOMENTE um array JSON válido com objetos no formato:',
    '[{"desc":"nome do estabelecimento","valor":50.00,"data":"2026-04-01"}]',
    'Regras: valor deve ser número positivo em reais (float). data em YYYY-MM-DD.',
    'Se não houver transações de compra, retorne [].',
    'Responda APENAS com o array JSON, sem explicações ou markdown.'
  ].join(' ');

  var body = JSON.stringify({
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: base64 } },
      { text: prompt }
    ]}],
    generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 25000);

  try {
    var resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return resp.status; });
      throw new Error('Gemini API: ' + errText);
    }

    var data = await resp.json();
    var content = (data.candidates || [])[0]?.content?.parts?.[0]?.text || '[]';

    // Tenta extrair JSON válido da resposta
    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      var arrMatch = content.match(/\[[\s\S]*\]/);
      parsed = arrMatch ? JSON.parse(arrMatch[0]) : [];
    }

    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function(t){ return t.desc && parseFloat(t.valor) > 0; });

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
    var transacoes = [];

    if (mimeType === 'application/pdf') {
      // ── 1) Extrair texto do PDF com pdf-parse ──────────────────────
      var pdfData;
      try {
        pdfData = await pdfParse(buffer, { max: 0 });
      } catch (pdfErr) {
        // PDF ilegível ou criptografado → tentar Gemini se disponível
        if (process.env.GEMINI_API_KEY) {
          transacoes = await extractWithGemini(buffer, mimeType);
        } else {
          return res.status(422).json({
            error: 'Não foi possível ler o PDF. O arquivo pode estar protegido por senha. Tente exportar como imagem ou use um arquivo OFX.'
          });
        }
      }

      if (pdfData) {
        // ── 2) Tentar parser de texto (rápido, sem IA) ─────────────
        transacoes = parseBankStatementText(pdfData.text || '');

        // ── 3) Fallback Gemini se parser encontrou poucos resultados
        if (transacoes.length < 2 && process.env.GEMINI_API_KEY) {
          try {
            var gemResult = await extractWithGemini(buffer, mimeType);
            if (gemResult.length > transacoes.length) transacoes = gemResult;
          } catch (_gemErr) {
            // Ignora — mantém o resultado do parser de texto
          }
        }
      }

    } else {
      // ── Imagem: requer Gemini ────────────────────────────────────
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: 'Extração de imagens requer configuração do servidor (GEMINI_API_KEY). Use PDF ou OFX.'
        });
      }
      transacoes = await extractWithGemini(buffer, mimeType);
    }

    if (!transacoes || transacoes.length === 0) {
      return res.status(422).json({
        error: 'Nenhuma transação encontrada. Verifique se o arquivo é um extrato de cartão de crédito válido e tente novamente.'
      });
    }

    return res.json(transacoes);

  } catch (err) {
    // Não vazar detalhes internos
    var safeMsg = (err.message || '').replace(/(key=)[^\s&]+/, '$1***');
    console.error('[extrair-fatura]', safeMsg);
    return res.status(500).json({ error: 'Erro ao processar arquivo. Tente novamente.' });
  }
});

// ─── Health check ───────────────────────────────────────────────────
app.get('/', function (_req, res) {
  res.json({ status: 'ok', service: 'bud-finance-backend' });
});

// ─── Start server ───────────────────────────────────────────────────
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('[Bud Finance Backend] Running on port ' + PORT);
});
