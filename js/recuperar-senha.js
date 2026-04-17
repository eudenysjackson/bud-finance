// js/recuperar-senha.js — Bud Finance Password Recovery (ES Module)
// Calls backend /reset-senha to generate a reset link (no ugly Firebase email).
// Then sends the custom EmailJS template with the link.
// Firebase SDK Modular v10.8.1 — NO compat layer.

var BACKEND_URL = window.BUD_FUNCTIONS_URL || '';

var form  = document.getElementById('formRecuperar');
var btn   = document.getElementById('btnRecuperar');
var emailInput = document.getElementById('email');

// ─── Email regex ────────────────────────────────────────────────────
function isEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resetBtn() {
  btn.textContent = 'Enviar link de recuperação';
  btn.disabled = false;
  btn.classList.remove('bud-btn-success');
}

// ─── Form submit ────────────────────────────────────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  var email = (emailInput.value || '').trim().toLowerCase();

  if (!email) {
    window.budShowToast('Informe seu e-mail.', 'warning');
    return;
  }
  if (!isEmailValido(email)) {
    window.budShowToast('Informe um e-mail válido.', 'warning');
    return;
  }

  btn.textContent = 'Enviando...';
  btn.disabled = true;

  try {
    // 1. Call backend to generate reset link (no Firebase email sent)
    var res = await fetch(BACKEND_URL + '/reset-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });

    var data = await res.json();

    // 2. If backend returned oobCode, send custom email via EmailJS
    if (data.success && data.data && data.data.oobCode) {
      var cfg = window.BUD_EMAILJS_CONFIG;
      if (cfg && !cfg.publicKey.startsWith('__') && typeof emailjs !== 'undefined') {
        var resetUrl = window.location.origin + '/acao-auth.html?oobCode=' + data.data.oobCode;
        emailjs.init(cfg.publicKey);
        // Fire-and-forget — don't block UI waiting for EmailJS
        emailjs.send(cfg.serviceId, cfg.templates.recuperarSenha, {
          to_email: data.data.email,
          to_name: data.data.userName,
          reset_url: resetUrl
        }).catch(function (err) {
          console.warn('[Bud Finance] Reset email failed:', err);
        });
      }
    }
  } catch (_err) {
    // Silently ignore — show success anyway (anti-enumeration)
  }

  // Always show success (anti-enumeration)
  btn.textContent = '✅ Link enviado!';
  btn.classList.add('bud-btn-success');
  window.budShowToast(
    'Se este e-mail estiver cadastrado, você receberá um link. Verifique também a caixa de spam.',
    'success',
    4000
  );

  setTimeout(function () {
    window.location.href = 'index.html';
  }, 3000);
});
