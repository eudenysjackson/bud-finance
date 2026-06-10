// js/cadastro.js — Bud Finance Registration Logic (ES Module)
// Firebase SDK Modular v10.8.1 — NO compat layer.
// User chooses their own password (no temp password sent via email).

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut, sendEmailVerification }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  doc, setDoc, getDoc, collection, query, where, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { connectEmulators } from "./bud-emulator-connect.js";

// ─── Firebase init ──────────────────────────────────────────────────
const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch (e) { return getFirestore(app); } })();
connectEmulators(auth, db);

// ─── DOM refs ───────────────────────────────────────────────────────
const formSection = document.getElementById('formSection');
const successSection = document.getElementById('successSection');
const form = document.getElementById('formCadastro');
const nomeInput = document.getElementById('nome');
const emailInput = document.getElementById('email');
const telefoneInput = document.getElementById('telefone');
const novaSenhaInput = document.getElementById('novaSenha');
const confirmarInput = document.getElementById('confirmarSenha');
const codigoInput = document.getElementById('codigoIndicacao');
const lgpdCheckbox = document.getElementById('lgpdConsent');
const btn = document.getElementById('btnCadastro');
const showMatriculaEl = document.getElementById('showMatricula');

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

// ─── EmailJS: inicializar SDK ────────────────────────────────────────
(function () {
  var cfg = window.BUD_EMAILJS_CONFIG;
  if (cfg && cfg.publicKey && !cfg.publicKey.startsWith('__') && window.emailjs) {
    window.emailjs.init({ publicKey: cfg.publicKey });
    console.log('[Bud] EmailJS inicializado.');
  }
})();

// ─── Enviar email de boas-vindas ─────────────────────────────────────
// Tenta obter o link de verificação via backend (Admin SDK) para incluir
// no botão do email. Se o backend não suportar, envia sem o link
// e retorna false para que o caller use sendEmailVerification como fallback.
async function enviarEmailBoasVindas(user, email, nome, matricula) {
  var cfg = window.BUD_EMAILJS_CONFIG;
  var verificationLink = null;

  // 1. Pedir ao backend para gerar o link de verificação
  try {
    var idToken = await user.getIdToken();
    var backendUrl = (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/, '');
    var res = await fetch(backendUrl + '/api/boas-vindas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ email: email, nome: nome, matricula: matricula, generateVerificationLink: true })
    });
    var body = await res.json().catch(function () { return {}; });
    if (res.ok) {
      console.log('[Bud] Backend boas-vindas OK:', body);
      verificationLink = body.verificationLink || null;
    } else {
      console.warn('[Bud] Backend boas-vindas retornou ' + res.status + ':', body);
    }
  } catch (err) {
    console.warn('[Bud] Backend boas-vindas indisponível:', err.message);
  }

  // 2. Enviar email via EmailJS com ou sem o link de verificação
  if (!cfg || !cfg.publicKey || cfg.publicKey.startsWith('__') || !window.emailjs) {
    console.warn('[Bud] EmailJS não configurado — pulando envio de boas-vindas.');
    return !verificationLink; // true = precisa de fallback
  }
  try {
    var templateParams = {
      to_name: nome,
      to_email: email,
      matricula: matricula,
      nome: nome,
      email: email,
      reply_to: email,
      verify_url: verificationLink
        || 'https://budsolucoes.com.br/appbudfinance/index.html'
    };
    var result = await window.emailjs.send(cfg.serviceId, cfg.templates.boasVindas, templateParams);
    console.log('[Bud] Email de boas-vindas enviado via EmailJS:', result.status, result.text);
  } catch (err) {
    console.error('[Bud] Falha EmailJS boas-vindas:', err);
  }

  // Retorna true se precisa de fallback (quando backend não gerou o link)
  return !verificationLink;
}

// ─── Main form submit ───────────────────────────────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  // 1. Sanitize inputs
  var nome = window.budSanitize(nomeInput.value);
  var email = window.budSanitize(emailInput.value).toLowerCase();
  var telefone = window.budSanitize(telefoneInput.value);
  var senha = novaSenhaInput.value;
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
      nome: nome.substring(0, 100),
      email: email,
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
        uid: indicador.uid,
        nome: indicador.nome,
        codigo: codigoRaw
      };
      docData.descontoIndicacao = 30;
      docData.descontoIndicacaoUsado = false;
    }

    // 10. Write user doc
    await setDoc(doc(db, 'usuarios', user.uid), docData);

    // 10b. Ativar trial Pro de 3 dias (fire-and-forget — não bloqueia cadastro)
    user.getIdToken().then(function (token) {
      return fetch(
        (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com') + '/api/iniciar-trial',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } }
      );
    }).catch(function () { });

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

    // 12. Enviar email de boas-vindas via backend/EmailJS.
    // O backend gera o link de verificação Firebase (Admin SDK) e o inclui no template.
    // Se o backend não retornar o link, usamos sendEmailVerification como fallback.
    var needsVerificationFallback = await enviarEmailBoasVindas(user, email, nome, matricula);

    // 12b. Firebase envia email de verificação com redirect para o login após verificar
    // O actionCodeSettings.url redireciona o usuário para a tela de login após clicar no link.
    // O domínio budsolucoes.com.br deve estar nos Authorized Domains do Firebase Auth.
    try {
      await sendEmailVerification(user, {
        url: 'https://budsolucoes.com.br/appbudfinance/index.html'
      });
      console.log('[Bud] Email de verificação enviado pelo Firebase Auth.');
    } catch (_verifyErr) {
      // Se o domínio não estiver autorizado, tenta sem actionCodeSettings
      if (_verifyErr.code === 'auth/unauthorized-continue-uri') {
        try {
          await sendEmailVerification(user);
          console.log('[Bud] Email de verificação enviado (sem redirect URL).');
        } catch (_e2) {
          console.error('[Bud] Falha ao enviar email de verificação:', _e2);
        }
      } else {
        console.error('[Bud] Falha ao enviar email de verificação:', _verifyErr);
      }
    }

    // 13. Sign out (user will log in from login page)
    await signOut(auth);

    // 14. Show success UI
    showMatriculaEl.textContent = matricula;
    formSection.classList.add('hidden');
    successSection.classList.add('active');

    // 14b. Se veio com ?plano= pago, exibir oferta de checkout imediato
    (function () {
      var _params = new URLSearchParams(window.location.search);
      var _plano = (_params.get('plano') || '').toLowerCase().trim();
      var _ref = _params.get('ref') || '';
      var _labels = { starter: 'Starter — R$ 9,99/mês', pro: 'Pro — R$ 29,90/mês', plus: 'Plus — R$ 49,90/mês' };
      if (!_labels[_plano]) return;

      var offer = document.getElementById('checkoutOffer');
      var planLbl = document.getElementById('checkoutPlanLabel');
      var btnNow = document.getElementById('btnCheckoutNow');
      var btnLogin = document.getElementById('btnLoginNormal');
      if (!offer || !planLbl || !btnNow) return;

      planLbl.textContent = _plano.charAt(0).toUpperCase() + _plano.slice(1);
      btnNow.textContent = 'Assinar ' + _labels[_plano];

      var loginUrl = 'index.html?checkout=' + encodeURIComponent(_plano);
      if (_ref) loginUrl += '&ref=' + encodeURIComponent(_ref);
      btnNow.href = loginUrl;

      // Botão "Ir para o Login" vira "Pular — usar trial de 3 dias"
      if (btnLogin) {
        btnLogin.textContent = 'Pular — usar trial de 3 dias';
        btnLogin.style.background = '#64748b';
      }

      offer.style.display = 'block';
    })();

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
