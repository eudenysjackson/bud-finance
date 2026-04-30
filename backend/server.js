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
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_RECUPERAR_SENHA || '';
const FRONTEND_URL        = process.env.FRONTEND_URL || 'https://bud-finance.onrender.com';

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
  // Origens locais de desenvolvimento (Live Server) — seguras pois 127.0.0.1 não é acessível externamente.
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:5502',
  'http://127.0.0.1:5502'
  // Adicione aqui o domínio customizado de produção quando for configurado.
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
  methods: ['POST', 'GET', 'OPTIONS'],
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
        // Ignora rótulos de resumo que aparecem sem valor separado (ex: "Pagamento de fatura", "Resgate RDB")
        var isLabel6 = /^(resgate rdb|pagamento de fatura|compra no débito|compra no debito)\b/i.test(cleanLine6);
        if (!isLabel6 && cleanLine6.length >= 2) descBuf6.push(cleanLine6);
      }
    }
  }

  return results;
}

/**
 * Extrai transações de imagem ou PDF complexo usando Groq (llama-4-scout vision).
 * Requer GROQ_API_KEY no ambiente.
 */
async function extractWithAI(buffer, mimeType) {
  var key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY não configurada no servidor.');

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
    temperature: 0.1,
    max_tokens: 2048
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 30000);

  try {
    var resp = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return resp.status; });
      throw new Error('Groq API: ' + errText);
    }

    var data = await resp.json();
    var content = (data.choices || [])[0]?.message?.content || '[]';

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
        // PDF ilegível ou criptografado → tentar IA se disponível
        if (process.env.GROQ_API_KEY) {
          transacoes = await extractWithAI(buffer, mimeType);
        } else {
          return res.status(422).json({
            error: 'Não foi possível ler o PDF. O arquivo pode estar protegido por senha. Tente exportar como imagem ou use um arquivo OFX.'
          });
        }
      }

      if (pdfData) {
        // ── 2) Tentar parser de texto (rápido, sem IA) ─────────────
        transacoes = parseBankStatementText(pdfData.text || '');

        // ── 3) Fallback IA se parser encontrou poucos resultados
        if (transacoes.length < 2 && process.env.GROQ_API_KEY) {
          try {
            var gemResult = await extractWithAI(buffer, mimeType);
            if (gemResult.length > transacoes.length) transacoes = gemResult;
          } catch (_aiErr) {
            // Ignora — mantém o resultado do parser de texto
          }
        }
      }

    } else {
      // ── Imagem: requer IA ────────────────────────────────────────
      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({
          error: 'Extração de imagens requer configuração do servidor (GROQ_API_KEY). Use PDF ou OFX.'
        });
      }
      transacoes = await extractWithAI(buffer, mimeType);
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
    'Você está analisando um CUPOM FISCAL de supermercado brasileiro OU um PRINT de app de mercado/delivery (Rappi, iFood Mercado, Zé Delivery, Cornershop, Mercado Livre).',
    '',
    'Extraia TODOS os itens e cobranças: produtos comprados, taxa de entrega, embalagem, serviço — qualquer linha com valor cobrado ao consumidor. Ignore APENAS: subtotais, total a pagar, formas de pagamento, troco e descontos.',
    '',
    'Identifique também:',
    '- Nome curto do mercado/loja (sem CNPJ, sem endereço — ex: "Prezunic", "Carrefour", "Rappi")',
    '- CNPJ (apenas números, 14 dígitos), se visível',
    '- Data da compra (formato YYYY-MM-DD), se visível',
    '',
    'Para cada ITEM, classifique em UMA das categorias:',
    '- "Mercado" (alimentos crus, hortifrúti, carnes, laticínios)',
    '- "Padaria/Café" (pães, bolos, café, biscoitos)',
    '- "Bares/Baladas" (bebidas alcoólicas, refrigerantes, energéticos)',
    '- "Farmácia" (higiene pessoal, medicamentos, limpeza, cosméticos)',
    '- "Pets" (ração, petisco, areia, acessórios)',
    '- "Material Escolar" (cadernos, canetas, material de escritório)',
    '- "Outros" (qualquer outra coisa)',
    '',
    'Retorne SOMENTE um objeto JSON válido neste formato:',
    '{"mercado":"Prezunic","cnpj":"12345678000199","data":"2026-04-25","itens":[{"nome":"Banana Prata kg","qtd":1.5,"valor":7.49,"cat":"Mercado"}]}',
    '',
    'Regras:',
    '- "valor" é o VALOR TOTAL do item (qtd × unitário), em reais (float positivo).',
    '- "qtd" é a quantidade. Use 1 se não souber.',
    '- "nome" curto (até 50 caracteres), capitalizado.',
    '- Se algum campo faltar, use string vazia ou null. NÃO invente.',
    '- Se houver MÚLTIPLAS imagens (cupom em várias páginas), CONSOLIDE tudo num único array de itens.',
    '',
    'Responda APENAS com o JSON, sem explicações ou markdown.'
  ].join('\n');

  // Groq suporta apenas 1 imagem por chamada — usa a primeira; demais são ignoradas por ora
  var imgContent = buffers.map(function (buf, i) {
    return { type: 'image_url', image_url: { url: 'data:' + (mimeTypes[i] || 'image/jpeg') + ';base64,' + buf.toString('base64') } };
  });
  imgContent.push({ type: 'text', text: prompt });

  var body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: imgContent }],
    temperature: 0.1,
    max_tokens: 2048
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 30000);

  try {
    var resp = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!resp.ok) {
      var errText = await resp.text().catch(function(){ return resp.status; });
      throw new Error('Groq API: ' + errText);
    }

    var data = await resp.json();
    var content = (data.choices || [])[0]?.message?.content || '{}';

    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      var objMatch = content.match(/\{[\s\S]*\}/);
      parsed = objMatch ? JSON.parse(objMatch[0]) : {};
    }

    if (typeof parsed !== 'object' || !parsed) parsed = {};
    parsed.itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    // Saneamento básico
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

  var prompt = [
    'Você está analisando o TEXTO de um cupom fiscal de supermercado OU print de app de mercado.',
    '',
    'Extraia TODOS os itens e cobranças: produtos, taxa de entrega, embalagem, serviço — qualquer linha com valor cobrado. Ignore APENAS: subtotais, total a pagar, formas de pagamento, troco e descontos.',
    '',
    'Identifique também: nome do mercado, CNPJ (14 dígitos), data (YYYY-MM-DD).',
    '',
    'Categorias permitidas: Mercado, Padaria/Café, Bares/Baladas, Farmácia, Pets, Material Escolar, Outros.',
    '',
    'Retorne SOMENTE JSON: {"mercado":"...","cnpj":"...","data":"...","itens":[{"nome":"...","qtd":1,"valor":0.00,"cat":"Mercado"}]}',
    '',
    'TEXTO DO CUPOM:',
    '"""',
    String(texto || '').slice(0, 8000), // proteção contra texto enorme
    '"""'
  ].join('\n');

  var body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 1024
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 25000);

  try {
    var resp = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: body, signal: controller.signal }
    );
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
      parsed = objMatch ? JSON.parse(objMatch[0]) : {};
    }
    if (typeof parsed !== 'object' || !parsed) parsed = {};
    parsed.itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    parsed.itens = parsed.itens
      .map(function (i) {
        return {
          nome: String(i.nome || '').trim().slice(0, 60),
          qtd: parseFloat(String(i.qtd || 1).toString().replace(',', '.')) || 1,
          valor: Math.abs(parseFloat(String(i.valor || 0).toString().replace(',', '.')) || 0),
          cat: String(i.cat || 'Mercado').trim(),
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
  limits: { fileSize: 8 * 1024 * 1024, files: 3 }, // 8 MB cada, máx 3
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
app.post('/api/extrair-cupom', uploadCupom.array('arquivos', 3), async function (req, res) {
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

    var result = await extractCupomWithGroq(buffers, mimeTypes);
    if (!result.itens.length) {
      return res.status(422).json({
        error: 'Nenhum item identificado. Tente uma foto mais nítida ou cole o texto manualmente.'
      });
    }

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
    // ── REGRA ABSOLUTA — lida primeiro pelo modelo ───────────────────────────
    '⚡ REGRA ABSOLUTA #1 — REGISTRAR TRANSAÇÃO (prioridade máxima):',
    'Quando o usuário disser que GASTOU, PAGOU, COMPROU, RECEBEU, GANHOU, TRANSFERIU dinheiro → você DEVE:',
    '  a) Responder em 1-2 frases curtas confirmando o que entendeu.',
    '  b) Incluir IMEDIATAMENTE ao final da resposta o bloco JSON abaixo. SEM perguntar. SEM pedir permissão.',
    '[ACTION:TRANSACTION]{"descricao":"descrição real do gasto","valor":0.00,"tipo":"despesa","categoria":"Outros","data":"' + hoje + '","conta":"banco ou cartão mencionado"}[/ACTION]',
    'PROIBIDO: NÃO escreva "posso registrar?", NÃO pergunte "quer que eu registre?". Apenas confirme e inclua o bloco.',
    'Data de HOJE: ' + hoje + '. Use formato YYYY-MM-DD. NUNCA escreva "[data atual]" ou "[data de hoje]" — use a data real.',
    'tipo: "despesa" se gastou/pagou/comprou. "receita" se recebeu/ganhou.',
    'Categorias: Alimentação, Transporte, Saúde, Educação, Lazer, Moradia, Vestuário, Tecnologia, Serviços, Outros.',
    '',
    '=== IDENTIDADE ===',
    'Você é o Bud, assistente inteligente do app Bud Finance.',
    'Tom: amigável, motivador, direto, empático. Use emojis com moderação.',
    'Responda SEMPRE em português brasileiro.',
    'Use Markdown para formatar suas respostas: **negrito**, listas, tabelas quando fizer sentido.',
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
    '• Dashboard: visão geral com saldo, resumo do mês, últimas transações e alertas.',
    '• Extrato: histórico completo de transações com filtros por data, categoria, tipo. Para lançar uma transação: botão "+" no extrato ou dashboard.',
    '• Carteira (Contas): gerenciar contas bancárias, poupança, benefícios (vale alimentação, etc). Importar extratos CSV/OFX/PDF/imagem.',
    '• Cartões: gerenciar faturas de crédito. Lançar gastos no cartão escolhendo o cartão na transação.',
    '• Recorrentes: lançar automaticamente contas fixas (aluguel, streaming, etc.) todo mês no dia configurado.',
    '• Dívidas: controlar empréstimos e financiamentos com status de pagamento e parcelas.',
    '• Metas: definir objetivos financeiros (viagem, reserva, etc) e acompanhar progresso com aportes manuais.',
    '• Limites: definir teto de gastos por categoria (ex: máx R$ 500 em restaurantes/mês). Recebe alertas ao aproximar.',
    '• Investimentos: registrar renda fixa, ações, FIIs, cripto e ver rentabilidade.',
    '• Análises/Gráficos: gráficos de pizza, barras e evolução dos gastos por categoria.',
    '• Insights: score de saúde financeira 0-100, alertas automáticos, projeções.',
    '• Balanço Mensal: fechar o mês e ver resultado geral consolidado.',
    '• Comparativo: comparar meses lado a lado para ver evolução.',
    '• Relatórios: exportar dados em PDF/CSV.',
    '• Mercado: lista de compras inteligente.',
    '• Categorias: criar e personalizar categorias de gastos (ícone, cor, nome).',
    '• Configurações: mudar plano, tema (claro/escuro/HBO), foto de perfil, ocultar valores (privacidade).',
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
    Array.isArray(r.carteira) && r.carteira.length ? 'Contas cadastradas: ' + r.carteira.map(function(c){return c.nome;}).join(', ') : '',
    Array.isArray(r.cartoes) && r.cartoes.length  ? 'Cartões cadastrados: ' + r.cartoes.map(function(c){return c.nome;}).join(', ') : '',
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
      plataforma:    (req.headers['user-agent'] || '').substring(0, 200),
    });

    // Email de notificação (fire-and-forget, sem bloquear resposta)
    sendEmailViaEmailJS({
      to_email:   'suporte@budfinance.com.br',
      tipo,
      descricao,
      nomeUsuario,
      uid,
    }).catch(function () { /* ignora falha de email */ });

    return res.json({ success: true });

  } catch (err) {
    console.error('[/api/chamado]', err.message);
    return res.status(500).json({ error: 'Erro ao registrar chamado.' });
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

// ─── Start server ───────────────────────────────────────────────────
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('[Bud Finance Backend] Running on port ' + PORT);
});
