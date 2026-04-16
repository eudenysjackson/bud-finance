// js/cadastro.js — Bud Finance Registration Logic (ES Module)
// Firebase SDK Modular v10.8.1 — NO compat layer.
// User chooses their own password (no temp password sent via email).

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Firebase init ──────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── DOM refs ───────────────────────────────────────────────────────
const formSection       = document.getElementById('formSection');
const successSection    = document.getElementById('successSection');
const form              = document.getElementById('formCadastro');
const nomeInput         = document.getElementById('nome');
const emailInput        = document.getElementById('email');
const telefoneInput     = document.getElementById('telefone');
const novaSenhaInput    = document.getElementById('novaSenha');
const confirmarInput    = document.getElementById('confirmarSenha');
const codigoInput       = document.getElementById('codigoIndicacao');
const lgpdCheckbox      = document.getElementById('lgpdConsent');
const btn               = document.getElementById('btnCadastro');
const toggleNovaSenha   = document.getElementById('toggleNovaSenha');
const toggleConfirmar   = document.getElementById('toggleConfirmarSenha');
const showMatriculaEl   = document.getElementById('showMatricula');

// Strength bars
const bars = [
  document.getElementById('bar1'),
  document.getElementById('bar2'),
  document.getElementById('bar3'),
  document.getElementById('bar4')
];
const forcaTexto = document.getElementById('forcaTexto');

// ─── Common weak passwords blocklist ────────────────────────────────
const SENHAS_COMUNS = [
  '123456','12345678','123456789','1234567890','password','qwerty',
  '111111','abc123','000000','654321','admin','welcome','abcdef',
  'senha123','mudar123','trocar123'
];

// ─── Phone mask (BR) ────────────────────────────────────────────────
telefoneInput.addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 6) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2,7) + '-' + v.substring(7);
  } else if (v.length > 2) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2);
  } else if (v.length > 0) {
    v = '(' + v;
  }
  this.value = v;
});

// ─── Password toggle ────────────────────────────────────────────────
function setupToggle(btn, input) {
  btn.addEventListener('click', function () {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? '👁‍🗨' : '👁';
  });
}
setupToggle(toggleNovaSenha, novaSenhaInput);
setupToggle(toggleConfirmar, confirmarInput);

// ─── Password strength indicator ────────────────────────────────────
const STRENGTH_COLORS = ['#f87171','#fb923c','#facc15','#34d399'];
const STRENGTH_TEXTS  = ['Muito fraca','Fraca','Boa','Forte'];
const STRENGTH_TEXT_COLORS = ['#ef4444','#f97316','#ca8a04','#10b981'];

function calcStrength(pw) {
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 8)  s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

novaSenhaInput.addEventListener('input', function () {
  const pw = this.value;
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
  const s = calcStrength(pw);
  bars.forEach(function (b, i) {
    b.style.background = i < s ? STRENGTH_COLORS[s - 1] : '#e2e8f0';
  });
  forcaTexto.textContent = STRENGTH_TEXTS[s - 1] || '';
  forcaTexto.style.color = STRENGTH_TEXT_COLORS[s - 1] || '#94a3b8';
});

// ─── Generate matrícula (BUD-XXXX-XXXX) ─────────────────────────────
function gerarMatricula() {
  var charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  var code = '';
  for (var i = 0; i < 8; i++) code += charset[arr[i] % charset.length];
  return 'BUD-' + code.substring(0, 4) + '-' + code.substring(4);
}

// ─── Generate unique code (8 chars) for referral ────────────────────
function gerarCodigoIndicacao() {
  var charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  var code = '';
  for (var i = 0; i < 8; i++) code += charset[arr[i] % charset.length];
  return code;
}

// ─── Validate referral code → returns {uid, nome} or null ──────────
async function validarCodigoIndicacao(codigo) {
  if (!codigo) return null;
  try {
    var q = query(
      collection(db, 'usuarios'),
      where('codigoIndicacao', '==', codigo.toUpperCase())
    );
    var snap = await getDocs(q);
    if (snap.empty) return null;
    var d = snap.docs[0];
    return { uid: d.id, nome: d.data().nome || '' };
  } catch (_e) {
    return null;
  }
}

// ─── reCAPTCHA v3 placeholder ────────────────────────────────────────
async function getRecaptchaToken() {
  var siteKey = window.BUD_RECAPTCHA_SITE_KEY;
  if (!siteKey || siteKey.startsWith('__') || typeof grecaptcha === 'undefined') {
    // reCAPTCHA not configured — return placeholder for development
    console.warn('[Bud Finance] reCAPTCHA not configured. Skipping validation.');
    return '__DEV_SKIP__';
  }
  try {
    return await grecaptcha.execute(siteKey, { action: 'signup' });
  } catch (_e) {
    return null;
  }
}

// ─── Email validation regex ─────────────────────────────────────────
function isEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Reset button ───────────────────────────────────────────────────
function resetBtn() {
  btn.textContent = 'Criar minha conta';
  btn.disabled = false;
}

// ─── Send welcome email (non-blocking, async fire-and-forget) ───────
function enviarEmailBoasVindas(email, nome, matricula) {
  var cfg = window.BUD_EMAILJS_CONFIG;
  if (!cfg || cfg.publicKey.startsWith('__') || typeof emailjs === 'undefined') {
    console.warn('[Bud Finance] EmailJS not configured. Welcome email skipped.');
    return;
  }
  // Fire-and-forget — does NOT block UI
  emailjs.send(cfg.serviceId, cfg.templates.boasVindas, {
    to_email: email,
    to_name: nome,
    matricula: matricula
    // NOTE: No password in email. User chose their own.
  }, cfg.publicKey).catch(function (_e) {
    // Silent fail — welcome email is nice-to-have, not critical
  });
}

// ─── Main form submit ───────────────────────────────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  // 1. Sanitize inputs
  var nome     = window.budSanitize(nomeInput.value);
  var email    = window.budSanitize(emailInput.value).toLowerCase();
  var telefone = window.budSanitize(telefoneInput.value);
  var senha    = novaSenhaInput.value;
  var confirma = confirmarInput.value;
  var codigoRaw = window.budSanitize(codigoInput.value).toUpperCase();

  // 2. Validation
  if (!nome || !email || !telefone || !senha || !confirma) {
    window.budShowToast('Por favor, preencha todos os campos!', 'warning');
    return;
  }
  if (!isEmailValido(email)) {
    window.budShowToast('Informe um e-mail válido.', 'warning');
    return;
  }
  var digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) {
    window.budShowToast('Informe um WhatsApp válido com DDD.', 'warning');
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
  if (!lgpdCheckbox.checked) {
    window.budShowToast('Você precisa aceitar a Política de Privacidade.', 'warning');
    return;
  }

  // 3. reCAPTCHA
  var captchaToken = await getRecaptchaToken();
  if (captchaToken === null) {
    window.budShowToast('Verificação de segurança falhou. Recarregue a página.', 'error');
    return;
  }

  // 4. Loading
  btn.textContent = 'Criando conta...';
  btn.disabled = true;

  try {
    // 5. Create user in Firebase Auth (user-chosen password)
    var cred = await createUserWithEmailAndPassword(auth, email, senha);
    var user = cred.user;

    // 6. Update display name
    await updateProfile(user, { displayName: nome.substring(0, 100) });

    // 7. Generate matrícula + referral code
    var matricula = gerarMatricula();
    var codigoIndicacaoGerado = gerarCodigoIndicacao();

    // 8. Validate referral (if provided)
    var indicador = null;
    if (codigoRaw) {
      indicador = await validarCodigoIndicacao(codigoRaw);
    }

    // 9. Build user doc — dates use serverTimestamp (NOT client-side)
    var docData = {
      nome:     nome.substring(0, 100),
      email:    email,
      telefone: telefone,
      matricula: matricula,
      primeiroLogin: false, // User chose own password — no forced change
      dataCadastro: serverTimestamp(),
      plano: 'trial',
      // trialFim should be calculated server-side via Cloud Function onCreate trigger
      status: 'ativo',
      role: 'user',
      funcionalidades: {},
      lgpdConsentimento: true,
      lgpdConsentimentoData: serverTimestamp(),
      lgpdVersaoPolitica: '2026-04-15',
      codigoIndicacao: codigoIndicacaoGerado,
      emailVerificationRequired: true,
      bloqueado: false
    };

    // Referral data
    if (indicador) {
      docData.indicadoPor = {
        uid:    indicador.uid,
        nome:   indicador.nome,
        codigo: codigoRaw
      };
      docData.descontoIndicacao = 30;
      docData.descontoIndicacaoUsado = false;
    }

    // 10. Write user doc
    await setDoc(doc(db, 'usuarios', user.uid), docData);

    // 11. Register referral in subcollection (NOT arrayUnion)
    if (indicador) {
      try {
        await setDoc(
          doc(db, 'usuarios', indicador.uid, 'indicacoes', user.uid),
          {
            nome: nome.substring(0, 100),
            email: email,
            data: serverTimestamp(),
            assinouPlano: false
          }
        );
      } catch (_refErr) {
        // Non-critical — referral tracking failed but account is fine
      }
    }

    // 12. Send email verification
    await sendEmailVerification(user);

    // 13. Sign out (user must verify email before logging in)
    await signOut(auth);

    // 14. Fire-and-forget welcome email (no password included)
    enviarEmailBoasVindas(email, nome, matricula);

    // 15. Show success UI
    showMatriculaEl.textContent = matricula;
    formSection.classList.add('hidden');
    successSection.classList.add('active');

  } catch (error) {
    resetBtn();

    if (error.code === 'auth/email-already-in-use') {
      window.budShowToast('Este e-mail já está cadastrado. Tente fazer login.', 'error');
    } else if (error.code === 'auth/invalid-email') {
      window.budShowToast('E-mail inválido. Verifique e tente novamente.', 'error');
    } else if (error.code === 'auth/weak-password') {
      window.budShowToast('Senha muito fraca. Use pelo menos 8 caracteres.', 'warning');
    } else {
      window.budShowToast('Erro ao criar conta. Tente novamente.', 'error');
    }
  }
});
