import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { openAuthenticatedCheckout } from './checkout-client.js?v=20261127-direct';

const params = new URLSearchParams(location.search);
const planKey = (params.get('checkout') || '').toLowerCase();
const refCode = params.get('ref') || '';
const status = document.getElementById('checkoutEntryStatus');
const errorText = document.getElementById('checkoutEntryError');
const retry = document.getElementById('checkoutRetry');
const login = document.getElementById('checkoutLogin');
const manage = document.getElementById('checkoutManage');

function loginURL() {
  const target = new URL('./', location.href);
  target.searchParams.set('checkout', planKey);
  target.searchParams.set('entrar', '1');
  if (refCode) target.searchParams.set('ref', refCode);
  return target.href;
}
function showFailure(error) {
  status.textContent = 'Não foi possível abrir o pagamento.';
  errorText.textContent = error.message || 'Tente novamente em alguns instantes.';
  retry.hidden = error.code === 'SUBSCRIPTION_EXISTS' || error.status === 401 || error.status === 403;
  manage.hidden = error.code !== 'SUBSCRIPTION_EXISTS';
  login.hidden = error.status !== 401 && error.code !== 'EMAIL_VERIFICATION_REQUIRED';
}
function bootstrap() {
  if (!['starter','pro','plus'].includes(planKey)) {
    showFailure({message:'Escolha um plano válido para continuar.'});
    retry.hidden = true;
    return;
  }
  // The existing local simulator never calls Mercado Pago. Keep it as the emulator path.
  if (window.BUD_USE_EMULATOR) { location.replace(loginURL()); return; }
  const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
  const auth = getAuth(app);
  let running = false;
  async function begin(user) {
    if (running) return;
    if (!user || !user.emailVerified) { location.replace(loginURL()); return; }
    running = true;
    retry.hidden = true; login.hidden = true; manage.hidden = true;
    errorText.textContent = ''; status.textContent = 'Estamos preparando seu checkout seguro.';
    try {
      await openAuthenticatedCheckout(user, planKey, {refCode});
      // Stay locked during navigation: a repeated Auth event must not create a second request.
    } catch (error) {
      running = false;
      showFailure(error);
    }
  }
  retry.addEventListener('click', function () { return begin(auth.currentUser); });
  login.addEventListener('click', async function () {
    login.disabled = true;
    try { await signOut(auth); location.replace(loginURL()); }
    catch (_) { login.disabled = false; errorText.textContent = 'Não foi possível encerrar a sessão. Tente novamente.'; }
  });
  onAuthStateChanged(auth, function (user) { return begin(user); }, showFailure);
}
bootstrap();
