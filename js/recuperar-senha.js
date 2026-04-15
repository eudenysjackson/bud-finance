// js/recuperar-senha.js — Bud Finance Password Recovery (ES Module)
// Posts to Cloud Function /reset-senha — does NOT use Firebase Auth directly.
// This prevents leaking whether an email exists in the system.

var BACKEND_URL = window.BUD_FUNCTIONS_URL || '';

var form  = document.getElementById('formRecuperar');
var btn   = document.getElementById('btnRecuperar');
var emailInput = document.getElementById('email');

// ─── Email regex ────────────────────────────────────────────────────
function isEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Timeout safety (30s) ───────────────────────────────────────────
var safetyTimer = null;

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

  // Loading state
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  // Safety timeout — re-enable button after 30s if network stalls
  safetyTimer = setTimeout(function () {
    if (btn.disabled && btn.textContent === 'Enviando...') {
      resetBtn();
      window.budShowToast('A requisição demorou demais. Tente novamente.', 'warning');
    }
  }, 30000);

  try {
    var res = await fetch(BACKEND_URL + '/reset-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });

    clearTimeout(safetyTimer);

    // Check HTTP status before parsing JSON
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    var data = await res.json();

    if (data.success) {
      // Show success feedback — delay redirect so user reads the message
      btn.textContent = '✅ Link enviado!';
      btn.classList.add('bud-btn-success');
      window.budShowToast(
        'Se este e-mail estiver cadastrado, você receberá um link. Verifique também a caixa de spam.',
        'success',
        4000
      );

      // Redirect after 3s so user can read the toast
      setTimeout(function () {
        window.location.href = 'index.html';
      }, 3000);
    } else {
      // Server returned success:false — still show generic message (anti-enumeration)
      window.budShowToast(
        'Se este e-mail estiver cadastrado, você receberá um link em instantes.',
        'info'
      );
      resetBtn();
    }

  } catch (_err) {
    clearTimeout(safetyTimer);
    window.budShowToast('Erro ao enviar. Verifique sua conexão e tente novamente.', 'error');
    resetBtn();
  }
});
