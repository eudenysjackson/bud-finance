// js/trocar-senha.js — Bud Finance First-Login Password Change (ES Module)
// Requires auth.currentUser to be logged in AND primeiroLogin: true in Firestore.
// After successful password change, updates primeiroLogin: false and redirects to dashboard.
// Firebase SDK Modular v10.8.1 — NO compat layer.

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Firebase init ──────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── DOM refs: sections ─────────────────────────────────────────────
const stateLoading      = document.getElementById('stateLoading');
const stateForm         = document.getElementById('stateForm');
const stateUnauthorized = document.getElementById('stateUnauthorized');

// ─── DOM refs: user badge ───────────────────────────────────────────
const userInitial   = document.getElementById('userInitial');
const userName      = document.getElementById('userName');
const userMatricula = document.getElementById('userMatricula');

// ─── DOM refs: form ─────────────────────────────────────────────────
const form             = document.getElementById('formTrocarSenha');
const novaSenhaInput   = document.getElementById('novaSenha');
const confirmarInput   = document.getElementById('confirmarSenha');
const btn              = document.getElementById('btnTrocar');
const toggleNovaSenha  = document.getElementById('toggleNovaSenha');
const toggleConfirmar  = document.getElementById('toggleConfirmarSenha');
const forcaTexto       = document.getElementById('forcaTexto');
const bars = [
  document.getElementById('bar1'),
  document.getElementById('bar2'),
  document.getElementById('bar3'),
  document.getElementById('bar4')
];

// ─── Common weak passwords blocklist ────────────────────────────────
const SENHAS_COMUNS = [
  '123456','12345678','123456789','1234567890','password','qwerty',
  '111111','abc123','000000','654321','admin','welcome','abcdef',
  'senha123','mudar123','trocar123'
];

// ─── Sections helper ────────────────────────────────────────────────
function showSection(section) {
  stateLoading.classList.add('section-hidden');
  stateForm.classList.add('section-hidden');
  stateUnauthorized.classList.add('section-hidden');
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

function calcStrength(pw) {
  var s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 8)  s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

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
  var s = calcStrength(pw);
  bars.forEach(function (b, i) {
    b.style.background = i < s ? STRENGTH_COLORS[s - 1] : '#e2e8f0';
  });
  forcaTexto.textContent = STRENGTH_TEXTS[s - 1] || '';
  forcaTexto.style.color = STRENGTH_TEXT_COLORS[s - 1] || '#94a3b8';
});

// ─── Reset button helper ────────────────────────────────────────────
function resetBtn() {
  btn.textContent = 'Salvar nova senha';
  btn.disabled = false;
}

// ─── Auth state: verify user is logged in + primeiroLogin ───────────
onAuthStateChanged(auth, async function (user) {
  if (!user) {
    // Not logged in — show unauthorized
    showSection(stateUnauthorized);
    return;
  }

  try {
    // Check Firestore for primeiroLogin flag
    var userDoc = await getDoc(doc(db, 'usuarios', user.uid));

    if (!userDoc.exists()) {
      // No user document — suspicious, sign out
      await signOut(auth);
      showSection(stateUnauthorized);
      return;
    }

    var userData = userDoc.data();

    if (userData.primeiroLogin !== true) {
      // User already changed password — redirect to dashboard
      window.location.href = 'dashboard.html';
      return;
    }

    // Populate user badge
    var nome = userData.nome || 'Usuário';
    var matricula = userData.matricula || '';
    userName.textContent = nome;
    userMatricula.textContent = matricula || 'Sem matrícula';
    userInitial.textContent = nome.charAt(0).toUpperCase();

    // Show form
    showSection(stateForm);
    novaSenhaInput.focus();

  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    window.budShowToast('Erro ao carregar dados. Tente novamente.', 'error');
    await signOut(auth);
    showSection(stateUnauthorized);
  }
});

// ─── Form submit — update password + Firestore ─────────────────────
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
  if (SENHAS_COMUNS.includes(senha.toLowerCase())) {
    window.budShowToast('Essa senha é muito comum. Escolha uma mais segura.', 'warning');
    return;
  }
  var strength = calcStrength(senha);
  if (strength < 2) {
    window.budShowToast('Sua senha é muito fraca. Use letras e números.', 'warning');
    return;
  }
  if (senha !== confirma) {
    window.budShowToast('As senhas não coincidem.', 'warning');
    return;
  }

  var user = auth.currentUser;
  if (!user) {
    window.budShowToast('Sessão expirada. Faça login novamente.', 'error');
    showSection(stateUnauthorized);
    return;
  }

  // Loading
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  try {
    // 1. Update password in Firebase Auth
    await updatePassword(user, senha);

    // 2. Update Firestore flag — only AFTER Auth succeeds
    await updateDoc(doc(db, 'usuarios', user.uid), {
      primeiroLogin: false
    });

    // 3. Success — redirect to dashboard
    window.budShowToast('Senha atualizada com sucesso! Redirecionando...', 'success');
    setTimeout(function () {
      window.location.href = 'dashboard.html';
    }, 1500);

  } catch (err) {
    console.error('Erro ao trocar senha:', err);

    if (err.code === 'auth/requires-recent-login') {
      window.budShowToast('Sessão expirada. Faça login novamente e repita o processo.', 'error');
      setTimeout(async function () {
        await signOut(auth);
        window.location.href = 'index.html';
      }, 2000);
    } else if (err.code === 'auth/weak-password') {
      window.budShowToast('Senha muito fraca. Use pelo menos 8 caracteres com letras e números.', 'warning');
      resetBtn();
    } else {
      window.budShowToast('Erro ao atualizar senha. Tente novamente.', 'error');
      resetBtn();
    }
  }
});
