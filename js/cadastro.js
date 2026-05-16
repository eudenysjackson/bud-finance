// js/cadastro.js — Bud Finance Registration Logic (ES Module)
// Firebase SDK Modular v10.8.1 — NO compat layer.
// User chooses their own password (no temp password sent via email).

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  doc, setDoc, getDoc, collection, query, where, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Firebase init ──────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

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
const showMatriculaEl   = document.getElementById('showMatricula');

// ─── SENHAS_COMUNS and calcStrength are in bud-utils.js ────────────
// window.BUD_SENHAS_COMUNS and window.budCalcStrength

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

// ─── Send welcome email via backend (fire-and-forget) ──────────────
// Backend gera o link de verificação Firebase + envia via EmailJS.
function enviarEmailBoasVindas(email, nome, matricula) {
  var backendUrl = (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/, '');
  fetch(backendUrl + '/api/boas-vindas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, nome: nome, matricula: matricula })
  }).catch(function () {
    // Fire-and-forget — email failure is non-critical
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
      // plano and role are set server-side (Firestore rules block these on create)
      status: 'ativo',
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

    // 12. Fire-and-forget welcome email BEFORE signOut
    enviarEmailBoasVindas(email, nome, matricula);

    // 13. Sign out (user will log in from login page)
    await signOut(auth);

    // 14. Show success UI
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
