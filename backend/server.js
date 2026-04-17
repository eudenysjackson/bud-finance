// backend/server.js — Bud Finance Backend (Minimal)
// Generates Firebase password reset links via Admin SDK.
// The link is NOT emailed by Firebase — it's returned to the frontend,
// which then sends it via EmailJS with the custom template.

const express = require('express');
const cors    = require('cors');
const admin   = require('firebase-admin');

// ─── Firebase Admin init ────────────────────────────────────────────
// Service account credentials injected via environment variable.
// On Render: FIREBASE_SERVICE_ACCOUNT = JSON string of the service account key.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db   = admin.firestore();

// ─── Express setup ──────────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORS — allow only the frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  // Add your production domain here when deployed:
  // 'https://bud-finance.example.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, etc.) in dev
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['POST'],
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

// Clean up rate limit map every 5 minutes
setInterval(function () {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

// ─── POST /reset-senha ─────────────────────────────────────────────
// Generates a password reset link (does NOT send email).
// Returns the link + user name so the frontend can send via EmailJS.
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

    // Get user name from Firestore
    var userName = 'Usuário';
    try {
      var userDoc = await db.collection('usuarios').doc(userRecord.uid).get();
      if (userDoc.exists) {
        userName = userDoc.data().nome || 'Usuário';
      }
    } catch (_e) {
      // Non-critical — use default name
    }

    // Generate password reset link (Firebase Admin SDK)
    // This does NOT send any email — just returns the URL.
    var resetLink = await auth.generatePasswordResetLink(email, {
      url: 'https://bud-finance.example.com/index.html' // redirect after reset (optional)
    });

    // Replace the Firebase-hosted action URL with our acao-auth.html page
    // The link contains ?oobCode=XXX which acao-auth.html reads
    var oobCode = new URL(resetLink).searchParams.get('oobCode');
    // The frontend will build the final URL using its own origin

    return res.json({
      success: true,
      data: {
        oobCode: oobCode,
        userName: userName,
        email: email
      }
    });

  } catch (err) {
    console.error('[reset-senha] Error:', err.message);
    // Generic success to prevent information leakage
    return res.json({ success: true });
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
