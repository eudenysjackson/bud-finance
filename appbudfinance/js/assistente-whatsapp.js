import { initializeApp }         from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
                                  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, doc, getDoc, updateDoc }
                                  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = initializeFirestore(app, { localCache: persistentLocalCache() });

// ─── Estado local ──────────────────────────────────────────────────────────
let uid             = null;
let _userPlano      = '';
let _whatsappNumero = null;

const PLANOS_WHATSAPP = ['plus', 'pro', 'trial'];

// ─── Formatação de telefone ────────────────────────────────────────────────
function formatarTelBR(numero) {
  const s = String(numero || '').replace(/\D/g, '');
  const local = s.startsWith('55') ? s.slice(2) : s;
  if (local.length === 11) return '(' + local.slice(0, 2) + ') ' + local.slice(2, 7) + '-' + local.slice(7);
  if (local.length === 10) return '(' + local.slice(0, 2) + ') ' + local.slice(2, 6) + '-' + local.slice(6);
  return numero;
}

// ─── Render estado ────────────────────────────────────────────────────────
function renderEstado() {
  const elPaywall     = document.getElementById('waPaywall');
  const elConteudo    = document.getElementById('waConteudo');
  const elDesvinc     = document.getElementById('waEstadoDesvinculado');
  const elVinc        = document.getElementById('waEstadoVinculado');
  const heroBadge     = document.getElementById('waHeroStatusBadge');
  const headerBadge   = document.getElementById('headerStatusBadge');
  const headerText    = document.getElementById('headerStatusText');

  if (!PLANOS_WHATSAPP.includes(_userPlano)) {
    // ── Gate: não é Plus ──────────────────────────────────────────────────
    elPaywall.style.display  = 'block';
    elConteudo.style.display = 'none';
    if (headerBadge) headerBadge.style.display = 'none';
    return;
  }

  elPaywall.style.display  = 'none';
  elConteudo.style.display = 'block';

  if (_whatsappNumero) {
    // ── Vinculado ─────────────────────────────────────────────────────────
    elDesvinc.style.display = 'none';
    elVinc.style.display    = 'block';

    const elNum = document.getElementById('waNumeroVinculado');
    if (elNum) elNum.textContent = formatarTelBR(_whatsappNumero);

    const waLink = 'https://wa.me/' + String(_whatsappNumero).replace(/\D/g, '');
    const elLink = document.getElementById('waAbrirLink');
    if (elLink) elLink.href = waLink;

    if (heroBadge) heroBadge.innerHTML =
      '<span class="wa-status-badge vinculado"><span class="wa-status-dot"></span>Vinculado</span>';

    if (headerBadge && headerText) {
      headerBadge.style.display = 'block';
      headerText.textContent = '✅ Vinculado';
      headerText.style.cssText = 'background:rgba(37,211,102,0.15);color:#16a34a;border:1px solid rgba(37,211,102,0.3);font-size:0.75rem;font-weight:700;padding:0.3rem 0.75rem;border-radius:2rem;display:inline-block;';
    }
  } else {
    // ── Desvinculado ──────────────────────────────────────────────────────
    elVinc.style.display    = 'none';
    elDesvinc.style.display = 'block';

    // Resetar pairing box
    const pairBox = document.getElementById('waPairingBox');
    if (pairBox) pairBox.style.display = 'none';

    if (heroBadge) heroBadge.innerHTML =
      '<span class="wa-status-badge desvinculado"><span class="wa-status-dot"></span>Não vinculado</span>';

    if (headerBadge && headerText) {
      headerBadge.style.display = 'block';
      headerText.textContent = '📵 Não vinculado';
      headerText.style.cssText = 'background:rgba(148,163,184,0.15);color:#64748b;border:1px solid rgba(148,163,184,0.3);font-size:0.75rem;font-weight:700;padding:0.3rem 0.75rem;border-radius:2rem;display:inline-block;';
    }
  }
}

// ─── Carregar status do Firestore ─────────────────────────────────────────
async function carregarStatus(user) {
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (!snap.exists()) return;
    const data = snap.data();
    _userPlano      = (data.plano || '').toLowerCase();
    _whatsappNumero = data.whatsappVinculado || null;
    renderEstado();
    return data;
  } catch (_e) {
    if (window.budShowToast) window.budShowToast('Erro ao carregar status. Tente recarregar.', 'error');
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────
let _waPollTimer = null;
let _waPollCount = 0;
const WA_POLL_INTERVAL = 5000;
const WA_POLL_MAX      = 24;   // 2 minutos

function _pararPolling() {
  if (_waPollTimer) { clearInterval(_waPollTimer); _waPollTimer = null; }
  _waPollCount = 0;
}

function _iniciarPolling() {
  _pararPolling();
  _waPollTimer = setInterval(async function () {
    _waPollCount++;
    if (_waPollCount > WA_POLL_MAX) {
      _pararPolling();
      const el = document.getElementById('waPairingStatus');
      if (el) el.textContent = '⏰ Tempo esgotado. Gere um novo código.';
      return;
    }
    try {
      const idToken   = await auth.currentUser.getIdToken();
      const backendUrl = (window.BUD_FUNCTIONS_URL || '').replace(/\/$/, '');
      const resp = await fetch(backendUrl + '/api/whatsapp/status', {
        headers: { Authorization: 'Bearer ' + idToken }
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.vinculado) {
        _pararPolling();
        _whatsappNumero = data.numero;
        renderEstado();
        if (window.budShowToast) window.budShowToast('WhatsApp vinculado com sucesso! 🎉', 'success');
      }
    } catch (_e) { /* ignora erros de rede no polling */ }
  }, WA_POLL_INTERVAL);
}

// ─── Gerar token de vínculo ───────────────────────────────────────────────
window.waGerarToken = async function () {
  const btn = document.getElementById('btnGerarToken');
  if (!btn || !auth.currentUser) return;
  btn.disabled = true;
  btn.textContent = 'Gerando…';
  try {
    const idToken    = await auth.currentUser.getIdToken();
    const backendUrl = (window.BUD_FUNCTIONS_URL || '').replace(/\/$/, '');
    const resp = await fetch(backendUrl + '/api/whatsapp/gerar-token', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + idToken }
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (window.budShowToast) window.budShowToast(err.error || 'Erro ao gerar código.', 'error');
      return;
    }
    const data = await resp.json();

    // Preencher pairing box
    const elCode   = document.getElementById('waPairingCode');
    const elNumDis = document.getElementById('waNumeroDisplay');
    const elLink   = document.getElementById('waLinkBtn');
    const elBox    = document.getElementById('waPairingBox');
    const elStatus = document.getElementById('waPairingStatus');

    if (elCode)   elCode.textContent   = data.token || '—';
    if (elNumDis) elNumDis.textContent = data.waNumeroDisplay
                                          ? '📞 Envie para: ' + data.waNumeroDisplay
                                          : '(número não configurado)';
    if (elLink) {
      if (data.waLink) { elLink.href = data.waLink; elLink.style.display = ''; }
      else elLink.style.display = 'none';
    }
    if (elBox)    elBox.style.display = 'block';
    if (elStatus) elStatus.textContent = '⏳ Aguardando confirmação…';

    _iniciarPolling();
  } catch (_e) {
    if (window.budShowToast) window.budShowToast('Erro ao gerar código. Verifique sua conexão.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📲 Gerar Código de Vínculo';
  }
};

// ─── Desvincular ──────────────────────────────────────────────────────────
window.waDesvincular = async function () {
  if (!auth.currentUser) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:var(--bg-page,#fff);border-radius:1.25rem;padding:1.75rem 1.5rem;max-width:380px;width:100%;border:1px solid var(--card-border,#e2e8f0);box-shadow:0 24px 64px rgba(0,0,0,.25);">'
    + '<div style="font-size:1.5rem;text-align:center;margin-bottom:.625rem;">💬</div>'
    + '<h3 style="font-weight:800;font-size:1rem;text-align:center;margin:0 0 .5rem;color:var(--card-text,#1e293b);">Desvincular WhatsApp?</h3>'
    + '<p style="font-size:.8125rem;color:var(--card-text-sec,#64748b);text-align:center;margin:0 0 1.25rem;line-height:1.5;">Você deixará de receber alertas e o número será removido da conta.</p>'
    + '<div style="display:flex;gap:.75rem;">'
    + '<button id="_waCancelar" style="flex:1;padding:.6875rem 1rem;border-radius:.75rem;font-size:.875rem;font-weight:700;font-family:inherit;cursor:pointer;background:var(--card-bg,#f8fafc);color:var(--text-main,#1e293b);border:1.5px solid var(--card-border,#e2e8f0);">Cancelar</button>'
    + '<button id="_waConfirmar" style="flex:1;padding:.6875rem 1rem;border-radius:.75rem;font-size:.875rem;font-weight:700;font-family:inherit;cursor:pointer;background:var(--card-bg,#f8fafc);color:#dc2626;border:1.5px solid rgba(220,38,38,0.25);">Desvincular</button>'
    + '</div></div>';
  document.body.appendChild(ov);

  document.getElementById('_waCancelar').onclick = function () { ov.remove(); };
  document.getElementById('_waConfirmar').onclick = async function () {
    ov.remove();
    try {
      const idToken    = await auth.currentUser.getIdToken();
      const backendUrl = (window.BUD_FUNCTIONS_URL || '').replace(/\/$/, '');
      await fetch(backendUrl + '/api/whatsapp/desvincular', {
        method:  'POST',
        headers: { Authorization: 'Bearer ' + idToken }
      });
      _whatsappNumero = null;
      renderEstado();
      if (window.budShowToast) window.budShowToast('WhatsApp desvinculado.', 'success');
    } catch (_e) {
      if (window.budShowToast) window.budShowToast('Erro ao desvincular. Tente novamente.', 'error');
    }
  };
};

// ─── Sidebar ──────────────────────────────────────────────────────────────
function setupSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const btnCol    = document.getElementById('btnSidebarCollapse');
  const btnHamb   = document.getElementById('btnHamburger');

  // Restaurar estado collapsed
  if (window.matchMedia('(min-width:769px)').matches) {
    if (localStorage.getItem('bud_sidebar_collapsed') === '1') {
      sidebar.classList.add('collapsed');
      if (btnCol) btnCol.textContent = '›';
    }
  }

  if (btnCol) {
    btnCol.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
      const isCol = sidebar.classList.contains('collapsed');
      btnCol.textContent = isCol ? '›' : '‹';
      localStorage.setItem('bud_sidebar_collapsed', isCol ? '1' : '0');
    });
  }

  if (btnHamb) {
    btnHamb.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────
document.getElementById('btnLogout').addEventListener('click', async function () {
  await signOut(auth).catch(() => {});
  window.location.href = 'index.html';
});

// ─── Sidebar: user info ───────────────────────────────────────────────────
function setupSidebarUser(user, data) {
  const avatar = document.getElementById('sidebarAvatar');
  const name   = document.getElementById('sidebarUserName');
  const idEl   = document.getElementById('sidebarUserId');

  const displayName = (data && data.nome) || user.displayName || user.email || '?';
  if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();
  if (name)   name.textContent   = displayName;
  if (idEl)   idEl.textContent   = user.email || user.uid.slice(0, 8) + '…';
}

// ─── Auth guard + inicialização ───────────────────────────────────────────
onAuthStateChanged(auth, async function (user) {
  if (!user) { window.location.href = 'index.html'; return; }
  if (!user.emailVerified) { window.location.href = 'index.html'; return; }

  uid = user.uid;
  setupSidebar();

  // Aplicar tema salvo
  if (window.budThemeManager) window.budThemeManager.apply(window.budThemeManager.getCurrent());

  // Carregar dados
  const data = await carregarStatus(user);
  setupSidebarUser(user, data);

  // Verificar primeiroLogin (onboarding)
  if (data && data.primeiroLogin === true) {
    window.location.href = 'onboarding.html';
    return;
  }

  // Esconder splash
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(function () { splash.style.display = 'none'; }, 550);
  }
});
