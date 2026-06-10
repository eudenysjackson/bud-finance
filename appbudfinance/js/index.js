// js/index.js — Bud Finance Login Logic (ES Module)
// Uses Firebase SDK Modular v10.8.1 — NO compat layer.

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, sendEmailVerification, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, doc, getDoc, collection, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { connectEmulators } from "./bud-emulator-connect.js";

// ─── Firebase init ──────────────────────────────────────────────────
const firebaseConfig = window.BUD_FIREBASE_CONFIG;
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();
connectEmulators(auth, db);

// Auto-redirect usuario ja autenticado
// Se o usuario ja tem sessao ativa, redireciona sem precisar de login
let _loginInProgress = false;
onAuthStateChanged(auth, function (user) {
  if (_loginInProgress) return;
  if (user) window.location.href = 'dashboard.html';
});

// ─── DOM refs ───────────────────────────────────────────────────────
const formLogin          = document.getElementById('formLogin');
const identificadorInput = document.getElementById('identificador');
const senhaInput         = document.getElementById('senha');
const btnLogin           = document.getElementById('btnLogin');
const toggleSenha        = document.getElementById('toggleSenha');

// ─── Show/hide password ─────────────────────────────────────────────
toggleSenha.addEventListener('click', function () {
  const isPassword = senhaInput.type === 'password';
  senhaInput.type = isPassword ? 'text' : 'password';
  toggleSenha.textContent = isPassword ? '👁‍🗨' : '👁';
});

// ─── Keybindings (Enter) ────────────────────────────────────────────
identificadorInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    senhaInput.focus();
  }
});

senhaInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnLogin.click();
  }
});

// ─── Firestore lookup: matrícula → email ────────────────────────────
async function buscarEmailPorMatricula(matricula) {
  try {
    const q = query(
      collection(db, 'usuarios'),
      where('matricula', '==', matricula.toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data().email;
  } catch (_e) {
    return null;
  }
}

// ─── Email verification modal ───────────────────────────────────────
// Sends the verification email internally and shows feedback inside the modal.
// Uses style.cssText (NOT Tailwind classes) because modal is created at
// runtime and dynamic Tailwind classes won't exist in the static build.
function showEmailVerificationModal(user) {
  return new Promise(function (resolve) {
    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
      'display:flex;align-items:center;justify-content:center;z-index:50000;' +
      'padding:1rem;';

    // Card
    const card = document.createElement('div');
    card.style.cssText =
      'background:#fff;border-radius:1rem;padding:1.5rem;max-width:22rem;' +
      'width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);' +
      'font-family:Inter,system-ui,sans-serif;text-align:center;';

    // Icon
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:2.5rem;margin-bottom:0.75rem;';
    icon.textContent = '📧';

    // Title
    const title = document.createElement('h3');
    title.style.cssText =
      'font-size:1.125rem;font-weight:700;color:#1e293b;margin-bottom:0.5rem;';
    title.textContent = 'E-mail não verificado';

    // Description
    const desc = document.createElement('p');
    desc.style.cssText =
      'font-size:0.8125rem;color:#64748b;margin-bottom:1.25rem;line-height:1.5;';
    desc.textContent = 'Sua conta exige verificação de e-mail. Clique em "Reenviar" para receber o link.';

    // Feedback message
    const feedback = document.createElement('p');
    feedback.style.cssText =
      'font-size:0.8125rem;font-weight:600;margin:0.75rem 0 1rem;line-height:1.5;display:none;';

    // Buttons row
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:0.75rem;';

    // "Fechar" button
    const btnNo = document.createElement('button');
    btnNo.style.cssText =
      'flex:1;padding:0.625rem;border-radius:0.625rem;border:1px solid #e2e8f0;' +
      'background:#f8fafc;color:#475569;font-weight:700;font-size:0.875rem;' +
      'cursor:pointer;font-family:inherit;';
    btnNo.textContent = 'Fechar';

    // "Reenviar" button
    const btnYes = document.createElement('button');
    btnYes.style.cssText =
      'flex:1;padding:0.625rem;border-radius:0.625rem;border:none;' +
      'background:#10b981;color:#fff;font-weight:700;font-size:0.875rem;' +
      'cursor:pointer;font-family:inherit;';
    btnYes.textContent = 'Reenviar';

    btnNo.addEventListener('click', function () {
      overlay.remove();
      resolve(false);
    });

    btnYes.addEventListener('click', async function () {
      btnYes.disabled = true;
      btnYes.textContent = 'Enviando...';
      feedback.style.display = 'none';
      try {
        await sendEmailVerification(user, {
          url: 'https://budsolucoes.com.br/appbudfinance/index.html'
        });
        feedback.style.color = '#059669';
        feedback.textContent = '✅ Link enviado! Verifique sua caixa de entrada e o spam.';
        feedback.style.display = 'block';
        btnYes.textContent = 'Enviado ✓';
        // Fecha o modal após 3 s e sinaliza que foi enviado (sem fallback extra)
        setTimeout(function () { overlay.remove(); resolve(true); }, 3000);
      } catch (err) {
        var msg = err.code === 'auth/too-many-requests'
          ? 'Muitas tentativas. Aguarde alguns minutos.'
          : 'Não foi possível enviar. Tente novamente.';
        feedback.style.color = '#dc2626';
        feedback.textContent = '⚠️ ' + msg;
        feedback.style.display = 'block';
        btnYes.disabled = false;
        btnYes.textContent = 'Reenviar';
      }
    });

    row.appendChild(btnNo);
    row.appendChild(btnYes);
    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(feedback);
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

// ─── Reset button helper ────────────────────────────────────────────
function resetBtn() {
  btnLogin.textContent = 'Acessar meu painel';
  btnLogin.disabled = false;
}

// ─── Main login flow ────────────────────────────────────────────────
formLogin.addEventListener('submit', async function (e) {
  e.preventDefault();
  _loginInProgress = true;

  // 1. Sanitize + validate
  const identificador = window.budSanitize(identificadorInput.value);
  const senha = senhaInput.value.trim(); // passwords: trim only, no sanitize

  if (!identificador || !senha) {
    window.budShowToast('Por favor, preencha todos os campos!', 'warning');
    return;
  }

  // 2. Loading state
  btnLogin.textContent = 'Acessando...';
  btnLogin.disabled = true;

  try {
    // 3. Resolve identifier (email vs matrícula)
    let email;
    const upperIdent = identificador.toUpperCase();

    if (upperIdent.startsWith('BUD-') || upperIdent.startsWith('NEX-')) {
      email = await buscarEmailPorMatricula(identificador);
      if (!email) {
        // Generic error — do NOT reveal whether matrícula exists
        window.budShowToast('Credenciais inválidas. Verifique e tente novamente.', 'error');
        resetBtn();
        return;
      }
    } else {
      email = identificador;
    }

    // 4. Firebase Auth sign-in
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, senha);
    } catch (authErr) {
      if (authErr.code === 'auth/too-many-requests') {
        window.budShowToast('Muitas tentativas. Aguarde alguns minutos.', 'error');
      } else if (authErr.code === 'auth/user-disabled') {
        window.budShowToast('Conta desativada. Entre em contato com o suporte.', 'error');
      } else {
        // Generic — never reveal which field is wrong
        window.budShowToast('E-mail/matrícula ou senha incorretos.', 'error');
      }
      resetBtn();
      return;
    }

    const user = userCredential.user;

    // 5. Fetch user doc from Firestore (tolerante a falha de permissão)
    let userData = {};
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      userData = userDoc.exists() ? userDoc.data() : {};
    } catch (fsErr) {
      // Prosseguir com userData vazio — dashboard vai lidar com isso
    }

    // 6. Check: blocked account
    if (userData.bloqueado === true) {
      window.budShowToast('Sua conta foi bloqueada. Entre em contato com o suporte.', 'error');
      await signOut(auth);
      resetBtn();
      return;
    }

    // 7. Check: email verified (ERR-006 — enforced for ALL users)
    if (!user.emailVerified) {
      // Modal handles sending internally and shows feedback
      await showEmailVerificationModal(user);
      await signOut(auth);
      resetBtn();
      return;
    }

    // 8. Redirect based on first login
    if (userData.primeiroLogin === true) {
      window.location.href = 'trocar-senha.html';
      return;
    }

    // 8b. Auto-checkout: vindo de cadastro.html com ?checkout=plano
    var _checkoutParams = new URLSearchParams(window.location.search);
    var _checkoutPlano  = (_checkoutParams.get('checkout') || '').toLowerCase().trim();
    var _checkoutRef    = _checkoutParams.get('ref') || '';
    var _planosValidos  = ['starter', 'pro', 'plus'];
    if (_planosValidos.includes(_checkoutPlano)) {
      try {
        var _idToken = await user.getIdToken();
        var _body    = { planKey: _checkoutPlano };
        if (_checkoutRef) _body.ref = _checkoutRef;
        var _mpResp  = await fetch(
          (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com') + '/mercadopago/create-subscription',
          { method: 'POST', headers: { 'Authorization': 'Bearer ' + _idToken, 'Content-Type': 'application/json' }, body: JSON.stringify(_body) }
        );
        if (_mpResp.ok) {
          var _mpData = await _mpResp.json();
          if (_mpData.init_point) { window.location.href = _mpData.init_point; return; }
        }
      } catch (_e) { /* fallback: vai pro dashboard normalmente */ }
    }

    window.location.href = 'dashboard.html';

  } catch (error) {
    _loginInProgress = false;
    window.budShowToast('Erro ao acessar sua conta. Tente novamente.', 'error');
    resetBtn();
  }
});
