// js/recuperar-senha.js — Bud Finance Password Recovery
// Usa Firebase Auth sendPasswordResetEmail diretamente (sem backend).
// EmailJS envia uma notificação de suporte em paralelo.

import { initializeApp }         from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, sendPasswordResetEmail }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// ─── Firebase init ───────────────────────────────────────────────────
var app  = initializeApp(window.BUD_FIREBASE_CONFIG);
var auth = getAuth(app);

// ─── EmailJS init ────────────────────────────────────────────────────
(function () {
  var cfg = window.BUD_EMAILJS_CONFIG;
  if (cfg && cfg.publicKey && !cfg.publicKey.startsWith('__') && window.emailjs) {
    window.emailjs.init({ publicKey: cfg.publicKey });
  }
})();

// ─── DOM ─────────────────────────────────────────────────────────────
var form       = document.getElementById('formRecuperar');
var btn        = document.getElementById('btnRecuperar');
var emailInput = document.getElementById('email');

function isEmailValido(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function resetBtn() {
  btn.textContent = 'Enviar link de recuperação';
  btn.disabled    = false;
  btn.classList.remove('bud-btn-success');
}

// ─── Enviar email de recuperação via EmailJS (opcional, suporte) ─────
async function enviarEmailRecuperacao(email) {
  var cfg = window.BUD_EMAILJS_CONFIG;
  if (!cfg || cfg.publicKey.startsWith('__') || !window.emailjs) return;
  try {
    await window.emailjs.send(
      cfg.serviceId,
      cfg.templates.recuperarSenha,
      {
        to_email: email,
        email:    email,
        reply_to: email
      }
    );
    console.log('[Bud] Email de recuperação enviado via EmailJS.');
  } catch (err) {
    console.warn('[Bud] EmailJS recuperar-senha:', err);
  }
}

// ─── Form submit ─────────────────────────────────────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  var email = window.budSanitize
    ? window.budSanitize(emailInput.value).toLowerCase()
    : (emailInput.value || '').trim().toLowerCase();

  if (!email) {
    window.budShowToast('Informe seu e-mail.', 'warning');
    return;
  }
  if (!isEmailValido(email)) {
    window.budShowToast('Informe um e-mail válido.', 'warning');
    return;
  }

  btn.textContent = 'Enviando...';
  btn.disabled    = true;

  try {
    // 1. Firebase envia o link de reset diretamente (sem backend)
    // Sem actionCodeSettings: Firebase usa o domínio padrão (sempre autorizado)
    await sendPasswordResetEmail(auth, email);
    console.log('[Bud] sendPasswordResetEmail OK para:', email);

    // 2. EmailJS envia notificação de suporte em paralelo (fire-and-forget)
    enviarEmailRecuperacao(email);

  } catch (err) {
    // auth/user-not-found: não revelar (anti-enumeração) — continua mostrando sucesso
    console.warn('[Bud] sendPasswordResetEmail:', err.code, err.message);
  }

  // Sempre mostrar sucesso (anti-enumeração de e-mails)
  btn.textContent = '✅ Link enviado!';
  btn.classList.add('bud-btn-success');
  window.budShowToast(
    'Se este e-mail estiver cadastrado, você receberá o link. Verifique também o spam.',
    'success',
    4000
  );

  setTimeout(function () {
    window.location.href = 'index.html';
  }, 3000);
});
