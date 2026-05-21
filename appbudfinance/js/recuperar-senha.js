// js/recuperar-senha.js — Bud Finance Password Recovery (ES Module)
// Calls backend /reset-senha which generates the link AND sends the email.
// The oobCode never reaches the frontend.
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
  btn.disabled = true;

  try {
    var res = await fetch(BACKEND_URL + '/reset-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    // Backend sends email server-side — no oobCode returned
  } catch (_err) {
    // Silently continue — always show success (anti-enumeration)
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
