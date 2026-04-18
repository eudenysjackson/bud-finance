// js/index.js — Bud Finance Login Logic (ES Module)
// Uses Firebase SDK Modular v10.8.1 — NO compat layer.

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, sendEmailVerification }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Firebase init ──────────────────────────────────────────────────
const firebaseConfig = window.BUD_FIREBASE_CONFIG;
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

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
// Uses style.cssText (NOT Tailwind classes) because modal is created at
// runtime and dynamic Tailwind classes won't exist in the static build.
function showEmailVerificationModal() {
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
    icon.style.cssText =
      'font-size:2.5rem;margin-bottom:0.75rem;';
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
    desc.textContent = 'Sua conta exige verificação de e-mail. Deseja reenviar o link de verificação?';

    // Buttons row
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:0.75rem;';

    // "Não" button
    const btnNo = document.createElement('button');
    btnNo.style.cssText =
      'flex:1;padding:0.625rem;border-radius:0.625rem;border:1px solid #e2e8f0;' +
      'background:#f8fafc;color:#475569;font-weight:700;font-size:0.875rem;' +
      'cursor:pointer;font-family:inherit;';
    btnNo.textContent = 'Não';

    // "Reenviar" button
    const btnYes = document.createElement('button');
    btnYes.style.cssText =
      'flex:1;padding:0.625rem;border-radius:0.625rem;border:none;' +
      'background:#10b981;color:#fff;font-weight:700;font-size:0.875rem;' +
      'cursor:pointer;font-family:inherit;';
    btnYes.textContent = 'Reenviar';

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    btnNo.addEventListener('click', function () { cleanup(false); });
    btnYes.addEventListener('click', function () { cleanup(true); });

    row.appendChild(btnNo);
    row.appendChild(btnYes);
    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
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
    const userCredential = await signInWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    // 5. Fetch user doc from Firestore
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    // 6. Check: blocked account
    if (userData.bloqueado === true) {
      window.budShowToast('Sua conta foi bloqueada. Entre em contato com o suporte.', 'error');
      await signOut(auth);
      resetBtn();
      return;
    }

    // 7. Check: email verified (ERR-006 — enforced for ALL users)
    if (!user.emailVerified) {
      var wantsResend = await showEmailVerificationModal();
      if (wantsResend) {
        try {
          await sendEmailVerification(user);
          window.budShowToast('Link de verificação reenviado! Verifique seu e-mail.', 'success');
        } catch (_verifyErr) {
          window.budShowToast('Não foi possível reenviar. Tente novamente mais tarde.', 'error');
        }
      }
      await signOut(auth);
      resetBtn();
      return;
    }

    // 8. Redirect based on first login
    if (userData.primeiroLogin === true) {
      window.location.href = 'trocar-senha.html';
    } else {
      window.location.href = 'dashboard.html';
    }

  } catch (error) {
    console.error('Erro no login:', error);

    if (error.code === 'auth/too-many-requests') {
      window.budShowToast('Muitas tentativas. Aguarde alguns minutos.', 'error');
    } else if (error.code === 'auth/user-disabled') {
      window.budShowToast('Conta desativada. Entre em contato com o suporte.', 'error');
    } else {
      // Generic — never reveal which field is wrong
      window.budShowToast('E-mail/matrícula ou senha incorretos.', 'error');
    }

    resetBtn();
  }
});
