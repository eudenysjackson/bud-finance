// js/acao-auth.js — Bud Finance Auth Action Handler (ES Module)
// Processes Firebase oobCode from password reset emails.
// Firebase SDK Modular v10.8.1 — NO compat layer.

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ─── Firebase init ──────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);

// ─── DOM refs: sections ─────────────────────────────────────────────
const stateValidating = document.getElementById('stateValidating');
const stateForm       = document.getElementById('stateForm');
const stateSuccess    = document.getElementById('stateSuccess');
const stateError      = document.getElementById('stateError');
const errorMessage    = document.getElementById('errorMessage');

// ─── DOM refs: form ─────────────────────────────────────────────────
const form             = document.getElementById('formResetSenha');
const novaSenhaInput   = document.getElementById('novaSenha');
const confirmarInput   = document.getElementById('confirmarSenha');
const btn              = document.getElementById('btnReset');
const toggleNovaSenha  = document.getElementById('toggleNovaSenha');
const toggleConfirmar  = document.getElementById('toggleConfirmarSenha');
const forcaTexto       = document.getElementById('forcaTexto');
const bars = [
  document.getElementById('bar1'),
  document.getElementById('bar2'),
  document.getElementById('bar3'),
  document.getElementById('bar4')
];

// ─── SENHAS_COMUNS and calcStrength are in bud-utils.js ────────────
// window.BUD_SENHAS_COMUNS and window.budCalcStrength

// ─── Sections helper ────────────────────────────────────────────────
function showSection(section) {
  stateValidating.classList.add('section-hidden');
  stateForm.classList.add('section-hidden');
  stateSuccess.classList.add('section-hidden');
  stateError.classList.add('section-hidden');
  section.classList.remove('section-hidden');
}

// ─── Password toggle ────────────────────────────────────────────────
function setupToggle(btn, input) {
  btn.addEventListener('click', function () {
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? '👁‍🗨' : '👁';
  });
}
setupToggle(toggleNovaSenha, novaSenhaInput);
setupToggle(toggleConfirmar, confirmarInput);

// ─── Password strength indicator ────────────────────────────────────
var STRENGTH_COLORS      = ['#f87171','#fb923c','#facc15','#34d399'];
var STRENGTH_TEXTS       = ['Muito fraca','Fraca','Boa','Forte'];
var STRENGTH_TEXT_COLORS = ['#ef4444','#f97316','#ca8a04','#10b981'];


novaSenhaInput.addEventListener('input', function () {
  var pw = this.value;
  if (!pw) {
    bars.forEach(function (b) { b.style.background = '#e2e8f0'; });
    forcaTexto.textContent = 'Mínimo 8 caracteres';
    forcaTexto.style.color = '#94a3b8';
    return;
  }
  if (pw.length < 6) {
    bars.forEach(function (b) { b.style.background = '#e2e8f0'; });
    forcaTexto.textContent = 'Mínimo 8 caracteres';
    forcaTexto.style.color = '#ef4444';
    return;
  }
  var s = window.budCalcStrength(pw);
  bars.forEach(function (b, i) {
    b.style.background = i < s ? STRENGTH_COLORS[s - 1] : '#e2e8f0';
  });
  forcaTexto.textContent = STRENGTH_TEXTS[s - 1] || '';
  forcaTexto.style.color = STRENGTH_TEXT_COLORS[s - 1] || '#94a3b8';
});

// ─── Parse oobCode from URL ─────────────────────────────────────────
function getOobCode() {
  var params = new URLSearchParams(window.location.search);
  return params.get('oobCode') || '';
}

// ─── Reset button helper ────────────────────────────────────────────
function resetBtn() {
  btn.textContent = 'Redefinir senha';
  btn.disabled = false;
}

// ─── Step 1: Validate the oobCode ───────────────────────────────────
var oobCode = getOobCode();

(async function validateCode() {
  if (!oobCode) {
    errorMessage.textContent = 'Link inválido. Nenhum código de recuperação encontrado na URL.';
    showSection(stateError);
    return;
  }

  try {
    // verifyPasswordResetCode confirms the code is valid and not expired.
    // Returns the email associated with the code (not used, but validates).
    await verifyPasswordResetCode(auth, oobCode);

    // Code is valid — show the form
    showSection(stateForm);
    novaSenhaInput.focus();

  } catch (err) {
    if (err.code === 'auth/expired-action-code') {
      errorMessage.textContent = 'Este link expirou. Solicite um novo link de recuperação de senha.';
    } else if (err.code === 'auth/invalid-action-code') {
      errorMessage.textContent = 'Este link já foi utilizado ou é inválido. Solicite um novo link.';
    } else {
      errorMessage.textContent = 'Não foi possível validar o link. Tente solicitar um novo.';
    }

    showSection(stateError);
  }
})();

// ─── Step 2: Form submit — confirm password reset ───────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  var senha    = novaSenhaInput.value;
  var confirma = confirmarInput.value;

  // Validation
  if (!senha || !confirma) {
    window.budShowToast('Preencha ambos os campos de senha.', 'warning');
    return;
  }
  if (senha.length < 8) {
    window.budShowToast('A senha deve ter pelo menos 8 caracteres.', 'warning');
    return;
  }
  if (window.BUD_SENHAS_COMUNS.includes(senha.toLowerCase())) {
    window.budShowToast('Essa senha é muito comum. Escolha uma mais segura.', 'warning');
    return;
  }
  var strength = window.budCalcStrength(senha);
  if (strength < 2) {
    window.budShowToast('Sua senha é muito fraca. Use letras e números.', 'warning');
    return;
  }
  if (senha !== confirma) {
    window.budShowToast('As senhas não coincidem.', 'warning');
    return;
  }

  // Loading
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  try {
    await confirmPasswordReset(auth, oobCode, senha);

    // Success
    showSection(stateSuccess);
    window.budShowToast('Senha redefinida com sucesso!', 'success');

  } catch (err) {
    if (err.code === 'auth/expired-action-code') {
      errorMessage.textContent = 'O link expirou durante o processo. Solicite um novo.';
      showSection(stateError);
    } else if (err.code === 'auth/weak-password') {
      window.budShowToast('Senha muito fraca. Use pelo menos 8 caracteres com letras e números.', 'warning');
      resetBtn();
    } else {
      window.budShowToast('Erro ao redefinir senha. Tente novamente.', 'error');
      resetBtn();
    }
  }
});
