import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
  connectAuthEmulator, getAuth, getIdTokenResult, onAuthStateChanged,
  signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import './config.js';

const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const config = local ? { ...window.BUD_GESTOR_FIREBASE_CONFIG, projectId: 'bud-finance-local' }
  : window.BUD_GESTOR_FIREBASE_CONFIG;
const auth = getAuth(initializeApp(config, 'bud-gestor'));
const api = local ? `http://${location.hostname}:3000` : 'https://bud-finance-backend.onrender.com';
if (local) connectAuthEmulator(auth, `http://${location.hostname}:9099`);

const feedback = document.querySelector('#feedback');
const views = ['login', 'register', 'recovery', 'confirmation', 'owner'];
let confirmationToken = new URLSearchParams(location.hash.slice(1)).get('confirm');

function message(text, error = false) {
  feedback.textContent = text;
  feedback.dataset.error = String(error);
}

function show(view, focus = true) {
  for (const id of views) document.getElementById(id).hidden = id !== view;
  message('');
  if (focus) document.querySelector(`#${view} input, #${view} button`)?.focus();
}

async function post(path, body) {
  const response = await fetch(api + '/api/gestor/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir. Tente novamente.');
  return result;
}

async function ownerProfile(data) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(api + '/api/gestor/owner-profile', {
    method: data ? 'PATCH' : 'GET',
    headers: data ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
      : { Authorization: 'Bearer ' + token },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error('Não foi possível acessar ou salvar a ficha. Confira os dados e tente novamente.');
  return response.json();
}

function fillOwnerProfile(profile) {
  document.querySelector('#owner-name').value = profile.name || '';
  document.querySelector('#owner-email').value = profile.recoveryEmail || '';
  document.querySelector('#owner-whatsapp').value = profile.whatsapp || '';
  document.querySelector('#owner-whatsapp-status').textContent = profile.whatsappVerified
    ? 'WhatsApp verificado para recuperação.' : 'WhatsApp aguarda verificação para recuperação.';
}

function submit(id, run, fallback) {
  const form = document.getElementById(id);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    message('');
    try { await run(Object.fromEntries(new FormData(form))); }
    catch (error) { message(fallback || error.message, true); }
    finally { button.disabled = false; }
  });
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => show(button.dataset.view));
});
document.querySelector('#show-password').addEventListener('click', event => {
  const input = document.querySelector('#login-password');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});

if (confirmationToken) show('confirmation', false);

async function hasOwnerAccess(user) {
  if (!user?.emailVerified) return false;
  const { claims } = await getIdTokenResult(user, true);
  return claims.budGestorOwner === true;
}

onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    if (!await hasOwnerAccess(user)) {
      await signOut(auth);
      if (!confirmationToken && !document.getElementById('login').hidden) {
        message('Esta conta não tem acesso ao Bud Gestor.', true);
      }
      return;
    }
    if (!confirmationToken) {
      const profile = await ownerProfile();
      if (auth.currentUser?.uid !== user.uid) return;
      document.querySelector('#login-form').reset();
      fillOwnerProfile(profile);
      show('owner', false);
    }
  } catch {
    await signOut(auth);
    message('Não foi possível verificar o acesso. Tente novamente.', true);
  }
});

submit('login-form', async ({ email, password }) => {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}, 'Não foi possível entrar. Confira o e-mail e a senha.');

submit('recovery-form', async ({ email }) => {
  await post('recovery', { email });
  message('Se houver uma conta para esse e-mail, você receberá um link para redefinir a senha.');
}, 'Não foi possível solicitar a recuperação agora. Tente novamente.');

submit('register-form', async data => {
  const result = await post('access-requests', data);
  document.querySelector('#register-form').reset();
  if (local && result.confirmationToken) {
    confirmationToken = result.confirmationToken;
    show('confirmation');
    message('Este é um teste local. Use o botão acima para simular a confirmação por e-mail.');
    return;
  }
  show('login');
  message('Confira seu e-mail e confirme o endereço para concluir a solicitação.');
});

document.querySelector('#confirm-request').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await post('access-requests/confirm', { token: confirmationToken });
    confirmationToken = null;
    history.replaceState(null, '', location.pathname + location.search);
    show('login');
    message(local ? 'Solicitação registrada no ambiente de teste. O envio por e-mail foi simulado.'
      : 'Sua solicitação foi enviada à equipe responsável. Aguarde nosso retorno pelo e-mail informado.');
  } catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});

submit('owner-form', async data => {
  fillOwnerProfile(await ownerProfile(data));
  message('Ficha do proprietário salva.');
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  await signOut(auth);
  show('login');
});
