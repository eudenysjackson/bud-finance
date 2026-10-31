// js/recuperar-senha.js — Bud Finance Password Recovery
// Recuperação é enviada exclusivamente pelo backend para manter o template,
// o link personalizado e as credenciais fora do navegador.

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
    var backendUrl = (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/, '');
    var response = await fetch(backendUrl + '/reset-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error('Serviço temporariamente indisponível.');

  } catch (err) {
    // Não revelar a existência do e-mail (anti-enumeração).
    console.warn('[Bud] Falha ao solicitar recuperação:', err.name);
    resetBtn();
    window.budShowToast('Não foi possível solicitar o link agora. Tente novamente em instantes.', 'error', 5000);
    return;
  }

  // Sempre mostrar sucesso (anti-enumeração de e-mails)
  btn.textContent = '✅ Solicitação recebida';
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
