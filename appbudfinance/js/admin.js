// ═══════════════════════════════════════════════════════════════
//  Bud Finance — Admin Panel JS (ES Module)
//  Rebuild completo com: Visão Geral, Usuários, Vendas,
//  Notificações, Promoções, Feature Flags, Sistema
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps }         from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, setDoc, query, orderBy, limit, where,
  serverTimestamp, getCountFromServer, startAfter, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ── Firebase Init ──────────────────────────────────────────────
const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => {
  try { return initializeFirestore(app, { localCache: persistentLocalCache() }); }
  catch(e) { return getFirestore(app); }
})();

// ── State ──────────────────────────────────────────────────────
const PAGE_SIZE       = 25;
let _allFlags         = [];
let _notifs           = [];
let _promos           = [];
let _appSettings      = {};
let _currentTab       = 'overview';
let _crmPage          = 0;
let _crmTotal         = 0;
let _crmCursors       = [];      // DocumentSnapshot por página
let _crmUsers         = [];      // Usuários da página atual (enriquecidos)
let _crmUsersAll      = [];      // Cache para filtro client-side
let _overviewLoaded   = false;
let _salesLoaded      = false;
let _iaMetricsLoaded  = false;

// ── Plan prices for MRR estimate ───────────────────────────────
const PLAN_PRICES = { starter: 19.90, plus: 29.90, pro: 49.90 };

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function esc(s) {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function fmtDate(ts) {
  if (!ts) return '—';
  let d;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysSince(ts) {
  if (!ts) return null;
  let d;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function planBadge(plan) {
  const p = (plan || 'free').toLowerCase();
  const classes = { free:'plan-free', starter:'plan-starter', trial:'plan-trial', plus:'plan-plus', pro:'plan-pro', admin:'plan-admin' };
  const labels  = { free:'Free', starter:'Starter', trial:'Trial', plus:'Plus', pro:'Pro', admin:'Admin' };
  return `<span class="plan-badge ${classes[p] || 'plan-free'}">${labels[p] || esc(p)}</span>`;
}

function engagement(txCount, lastTxDays) {
  if (lastTxDays === null) lastTxDays = 999;
  if (txCount >= 20 && lastTxDays <= 7)  return 'heavy';
  if (txCount >= 5  && lastTxDays <= 30) return 'regular';
  if (txCount >= 1  && lastTxDays <= 60) return 'risk';
  return 'inactive';
}

function thermoHTML(eng) {
  const cfg = {
    heavy:    { pct: 90, lbl: '🔥 Intenso',   cls: 'eng-heavy' },
    regular:  { pct: 60, lbl: '✅ Regular',    cls: 'eng-regular' },
    risk:     { pct: 30, lbl: '⚠️ Em risco',   cls: 'eng-risk' },
    inactive: { pct: 10, lbl: '💤 Inativo',    cls: 'eng-inactive' },
  };
  const c = cfg[eng] || cfg.inactive;
  return `<div class="thermo thermo-${eng}"><div class="thermo-fill" style="width:${c.pct}%"></div></div>
          <div class="eng-label ${c.cls}">${c.lbl}</div>`;
}

function budToast(msg, type = 'success') {
  if (typeof window.budShowToast === 'function') {
    window.budShowToast(msg, type);
  } else {
    alert(msg);
  }
}

function confirmAction(msg, onConfirm) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:1rem;padding:2rem;max-width:340px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="font-size:2rem;margin-bottom:.75rem;">⚠️</div>
      <p style="font-size:.9375rem;font-weight:600;color:#1e293b;margin-bottom:1.5rem;">${esc(msg)}</p>
      <div style="display:flex;justify-content:center;gap:.75rem;">
        <button id="_cf_cancel" style="padding:.5rem 1.25rem;border-radius:.625rem;border:1.5px solid #d1d5db;background:#fff;font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;">Cancelar</button>
        <button id="_cf_ok" style="padding:.5rem 1.25rem;border-radius:.625rem;border:none;background:#ef4444;color:#fff;font-family:inherit;font-size:.875rem;font-weight:700;cursor:pointer;">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#_cf_cancel').onclick = () => ov.remove();
  ov.querySelector('#_cf_ok').onclick     = () => { ov.remove(); onConfirm(); };
}

// ═══════════════════════════════════════════════════════════════
//  CUSTOM SELECT HELPERS (window-exposed)
// ═══════════════════════════════════════════════════════════════
window.toggleSel = function(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  // Container may itself be the .admin-sel or may wrap one
  const sel = c.classList.contains('admin-sel') ? c : c.querySelector('.admin-sel');
  if (!sel) return;
  const isOpen = sel.classList.contains('open');
  document.querySelectorAll('.admin-sel.open').forEach(s => s.classList.remove('open'));
  if (!isOpen) sel.classList.add('open');
};
window.pickSel = function(containerId, val, label) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const sel = c.classList.contains('admin-sel') ? c : c.querySelector('.admin-sel');
  if (!sel) return;
  const span = sel.querySelector('.admin-sel-trigger span:first-child');
  if (span) span.textContent = label;
  sel.querySelectorAll('input[type=hidden]').forEach(h => h.value = val);
  sel.querySelectorAll('.admin-sel-opt').forEach(o => {
    const match = o.hasAttribute('data-val')
      ? o.dataset.val === String(val)
      : o.textContent.trim() === label.trim();
    o.classList.toggle('sel', match);
  });
  sel.classList.remove('open');
};
document.addEventListener('click', e => {
  if (!e.target.closest('.admin-sel')) {
    document.querySelectorAll('.admin-sel.open').forEach(s => s.classList.remove('open'));
  }
});

// ═══════════════════════════════════════════════════════════════
//  AUTH GUARD
// ═══════════════════════════════════════════════════════════════
function showLogin() {
  document.getElementById('adminLoading').style.display = 'none';
  document.getElementById('adminContent').style.display = 'none';
  document.getElementById('accessDenied').style.display = 'none';
  document.getElementById('adminLogin').style.display = 'flex';
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    showLogin();
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    const data = snap.data() || {};
    if (data.role !== 'admin') {
      await signOut(auth);
      showLogin();
      const el = document.getElementById('alError');
      if (el) { el.textContent = 'Esta conta não é um administrador.'; el.style.display = 'block'; }
      return;
    }
    // Show panel
    document.getElementById('adminLoading').style.display = 'none';
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    const n = data.nome || user.email || 'Admin';
    document.getElementById('adminName').textContent = n;
    document.getElementById('adminAvatar').textContent = n.charAt(0).toUpperCase();
    boot();
  } catch(e) {
    console.error('[admin-auth]', e);
    showLogin();
  }
});

window.fazerLogoutAdmin = async function() {
  await signOut(auth);
  showLogin();
};

window.fazerLoginAdmin = async function() {
  const email = (document.getElementById('alEmail').value || '').trim().toLowerCase();
  const senha = document.getElementById('alSenha').value || '';
  const errEl = document.getElementById('alError');
  const btn   = document.getElementById('alBtn');
  errEl.style.display = 'none';
  if (!email || !senha) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = '⏳ Entrando...';
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    // onAuthStateChanged cuida do resto
  } catch(e) {
    const msgs = {
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Erro de conexão.',
    };
    errEl.textContent = msgs[e.code] || 'Erro ao entrar: ' + (e.message || e.code);
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Entrar no Painel';
  }
};

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
async function boot() {
  await Promise.all([
    loadOverview(),
    loadFlags(),
    loadNotifications(),
    loadPromos(),
    loadAppSettings(),
    loadAdmins(),
  ]);
}

// ═══════════════════════════════════════════════════════════════
//  TAB MANAGEMENT
// ═══════════════════════════════════════════════════════════════
window.switchTab = function(tab) {
  _currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('[id^="panel-"]').forEach(p => { p.style.display = 'none'; });
  const btn = document.getElementById('tab-' + tab);
  const pnl = document.getElementById('panel-' + tab);
  if (btn) btn.classList.add('active');
  if (pnl) { pnl.style.display = 'block'; pnl.classList.remove('anim-up'); void pnl.offsetWidth; pnl.classList.add('anim-up'); }
  // Lazy loads
  if (tab === 'users' && _crmUsers.length === 0) loadCRM(0);
  if (tab === 'sales' && !_salesLoaded) loadSales();
  if (tab === 'ia'    && !_iaMetricsLoaded) loadIAMetrics();
};

// ═══════════════════════════════════════════════════════════════
//  OVERVIEW
// ═══════════════════════════════════════════════════════════════
async function loadOverview() {
  try {
    const usersRef = collection(db, 'usuarios');
    const [total, freeCnt, trialCnt, starterCnt, plusCnt, proCnt, cuponsCnt, naoAtivQ] = await Promise.all([
      getCountFromServer(usersRef),
      getCountFromServer(query(usersRef, where('plano', '==', 'free'))),
      getCountFromServer(query(usersRef, where('plano', '==', 'trial'))),
      getCountFromServer(query(usersRef, where('plano', '==', 'starter'))),
      getCountFromServer(query(usersRef, where('plano', '==', 'plus'))),
      getCountFromServer(query(usersRef, where('plano', '==', 'pro'))),
      getCountFromServer(collection(db, 'promocoes')),
      getCountFromServer(query(usersRef, where('plano', '==', 'free'))),
    ]);

    const totalN    = total.data().count;
    const freeN     = freeCnt.data().count;
    const trialN    = trialCnt.data().count;
    const starterN  = starterCnt.data().count;
    const plusN     = plusCnt.data().count;
    const proN      = proCnt.data().count;
    const cuponsN   = cuponsCnt.data().count;

    const mrr = (starterN * PLAN_PRICES.starter + plusN * PLAN_PRICES.plus + proN * PLAN_PRICES.pro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const pagantes = plusN + proN;

    setText('kpiTotal',        totalN);
    setText('kpiPagantes',     pagantes);
    setText('kpiTrial',        trialN);
    setText('kpiFree',         freeN + starterN);
    setText('kpiMrr',          mrr);
    setText('kpiNaoAtivaram',  freeN);

    // Alert if many didn't activate
    if (freeN > 0) {
      const al = document.getElementById('alertNaoAtivaram');
      al.style.display = 'flex';
      al.innerHTML = `<div class="alert-banner alert-warn">
        <span style="font-size:1.25rem;">⚠️</span>
        <span class="alert-text"><b>${freeN} usuários</b> estão no plano Free — sem receita gerada.</span>
        <span class="alert-link" onclick="switchTab('sales')">Ver Vendas →</span>
      </div>`;
    }

    // Last signups
    const signupSnap = await getDocs(query(usersRef, orderBy('dataCadastro', 'desc'), limit(10)));
    let rows = '';
    signupSnap.forEach(d => {
      const u = d.data();
      const ini = u.nome ? u.nome.charAt(0).toUpperCase() : '?';
      rows += `<div style="display:grid;grid-template-columns:2.25rem 1fr 1fr 1fr;align-items:center;gap:.625rem;padding:.5rem .25rem;border-bottom:1px solid #f1f5f9;">
        <div class="u-avatar" style="width:2rem;height:2rem;font-size:.625rem;">${esc(ini)}</div>
        <div style="font-size:.8125rem;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${esc(u.nome || '—')}</div>
        <div style="font-size:.75rem;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${esc(u.email || '—')}</div>
        <div>${planBadge(u.plano)} <span style="font-size:.7rem;color:#9ca3af;">${fmtDate(u.criadoEm)}</span></div>
      </div>`;
    });
    document.getElementById('overviewSignups').innerHTML = rows || '<div class="empty-state"><div class="icon">👥</div>Nenhum usuário ainda</div>';

    // Plan distribution
    const distData = [
      { label: 'Pro',     val: proN,      color: '#059669' },
      { label: 'Plus',    val: plusN,     color: '#9333ea' },
      { label: 'Trial',   val: trialN,    color: '#ea580c' },
      { label: 'Starter', val: starterN,  color: '#2563eb' },
      { label: 'Free',    val: freeN,     color: '#94a3b8' },
    ];
    const totalForPct = totalN || 1;
    let distHtml = '';
    distData.forEach(d => {
      const pct = Math.round((d.val / totalForPct) * 100);
      distHtml += `<div style="margin-bottom:.75rem;">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:600;margin-bottom:.25rem;">
          <span>${esc(d.label)}</span>
          <span style="color:#6b7280;">${d.val} (${pct}%)</span>
        </div>
        <div style="background:#f1f5f9;border-radius:999px;height:.5rem;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${d.color};border-radius:999px;transition:width .4s;"></div>
        </div>
      </div>`;
    });
    document.getElementById('planDistribution').innerHTML = distHtml;

    _overviewLoaded = true;
  } catch(e) {
    console.error('[overview]', e);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}


// ═══════════════════════════════════════════════════════════════
//  CRM — USUÁRIOS
// ═══════════════════════════════════════════════════════════════
async function loadCRM(page) {
  document.getElementById('crmList').innerHTML = '<div class="loading-inline">Carregando usuários...</div>';
  try {
    const usersRef = collection(db, 'usuarios');
    if (page === 0) {
      const cnt = await getCountFromServer(usersRef);
      _crmTotal = cnt.data().count;
      _crmCursors = [];
    }
    let q = query(usersRef, orderBy('dataCadastro', 'desc'), limit(PAGE_SIZE));
    if (page > 0 && _crmCursors[page - 1]) {
      q = query(usersRef, orderBy('dataCadastro', 'desc'), startAfter(_crmCursors[page - 1]), limit(PAGE_SIZE));
    }
    const snap = await getDocs(q);
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, _snap: d, ...d.data() }));
    if (docs.length > 0) _crmCursors[page] = docs[docs.length - 1]._snap;

    // Enrich: get tx count and last tx per user (parallel)
    const enriched = await Promise.all(docs.map(async u => {
      try {
        const txRef = collection(db, 'usuarios', u.id, 'transacoes');
        const [txCount, lastTx] = await Promise.all([
          getCountFromServer(txRef),
          getDocs(query(txRef, orderBy('dataCriacao', 'desc'), limit(1))),
        ]);
        u._txCount = txCount.data().count;
        let lastD = null;
        lastTx.forEach(d => { lastD = d.data().dataCriacao || null; });
        u._lastTxDays = daysSince(lastD);
      } catch(e) {
        u._txCount = 0; u._lastTxDays = null;
      }
      return u;
    }));

    _crmPage  = page;
    _crmUsers = enriched;
    _crmUsersAll = enriched;
    renderCRM(enriched);
    updateCRMPagination();
  } catch(e) {
    console.error('[crm]', e);
    document.getElementById('crmList').innerHTML = `<div class="empty-state"><div class="icon">❌</div>Erro ao carregar: ${esc(e.message)}</div>`;
  }
}

window.reloadCRM = function() { loadCRM(0); };
window.crmChangePage = function(dir) {
  const newPage = _crmPage + dir;
  if (newPage < 0) return;
  if (newPage * PAGE_SIZE >= _crmTotal && dir > 0) return;
  loadCRM(newPage);
};

function updateCRMPagination() {
  const from = _crmPage * PAGE_SIZE + 1;
  const to   = Math.min(_crmPage * PAGE_SIZE + _crmUsers.length, _crmTotal);
  document.getElementById('crmPageInfo').textContent = `${from}–${to} de ${_crmTotal} usuários`;
  document.getElementById('crmPrev').disabled = _crmPage === 0;
  document.getElementById('crmNext').disabled = to >= _crmTotal;
}

function renderCRM(users) {
  const list = document.getElementById('crmList');
  if (!users || users.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">👥</div>Nenhum usuário encontrado</div>';
    return;
  }
  list.innerHTML = users.map(u => {
    const eng = engagement(u._txCount || 0, u._lastTxDays);
    const ini = (u.nome || u.email || '?').charAt(0).toUpperCase();
    return `<div class="u-row">
      <div class="u-avatar">${esc(ini)}</div>
      <div><div class="u-name">${esc(u.nome || '—')}</div></div>
      <div style="font-size:.75rem;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${esc(u.email || '—')}</div>
      <div>${planBadge(u.plano)} ${u.bloqueado ? '<span style="font-size:.625rem;color:#dc2626;font-weight:700;">🚫BLOQ</span>' : ''}</div>
      <div>${thermoHTML(eng)}</div>
      <div style="font-size:.8125rem;font-weight:600;color:#374151;">${u._txCount || 0}</div>
      <div style="display:flex;gap:.375rem;">
        <button class="btn-ghost btn-sm" onclick="viewUser('${esc(u.id)}')">Ver</button>
      </div>
    </div>`;
  }).join('');
}

window.filterCRM = function() {
  const search  = document.getElementById('crmSearch').value.toLowerCase();
  const plano   = document.getElementById('crmPlanFilter').value;
  const eng     = document.getElementById('crmEngFilter').value;

  let filtered = _crmUsersAll;
  if (search)  filtered = filtered.filter(u => (u.nome||'').toLowerCase().includes(search) || (u.email||'').toLowerCase().includes(search));
  if (plano)   filtered = filtered.filter(u => (u.plano||'free') === plano);
  if (eng)     filtered = filtered.filter(u => engagement(u._txCount||0, u._lastTxDays) === eng);

  _crmUsers = filtered;
  renderCRM(filtered);
};

// ═══════════════════════════════════════════════════════════════
//  VISÃO 360° DO USUÁRIO
// ═══════════════════════════════════════════════════════════════
window.viewUser = async function(uid) {
  const modal = document.getElementById('modalUser');
  modal.classList.add('open');
  document.getElementById('muContent').innerHTML = '<div class="loading-inline" style="padding:3rem;">Carregando dados do usuário...</div>';

  try {
    const userSnap = await getDoc(doc(db, 'usuarios', uid));
    if (!userSnap.exists()) { document.getElementById('muContent').innerHTML = '<div class="empty-state"><div class="icon">❌</div>Usuário não encontrado</div>'; return; }
    const u = { id: uid, ...userSnap.data() };

    // Parallel subcollection reads
    const txRef    = collection(db, 'usuarios', uid, 'transacoes');
    const cartRef  = collection(db, 'usuarios', uid, 'carteira');
    const cardsRef = collection(db, 'usuarios', uid, 'cartoes');
    const metasRef = collection(db, 'usuarios', uid, 'metas');

    const [txCountSnap, lastTxSnap, cartSnap, cardsCount, metasCount] = await Promise.all([
      getCountFromServer(txRef),
      getDocs(query(txRef, orderBy('dataCriacao', 'desc'), limit(1))),
      getDocs(cartRef),
      getCountFromServer(cardsRef),
      getCountFromServer(metasRef),
    ]);

    const txCount = txCountSnap.data().count;
    let lastTxDate = null;
    lastTxSnap.forEach(d => { lastTxDate = d.data().dataCriacao || null; });
    const lastTxDays = daysSince(lastTxDate);
    const eng = engagement(txCount, lastTxDays);

    // Carteira
    let saldoTotal = 0;
    let carteiraHtml = '';
    cartSnap.forEach(d => {
      const item = d.data();
      saldoTotal += (item.saldo || 0);
      carteiraHtml += `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #f1f5f9;font-size:.8125rem;">
        <span style="color:#374151;">${esc(item.nome || '—')}</span>
        <span style="font-weight:700;color:${(item.saldo||0) >= 0 ? '#059669' : '#dc2626'};">${(item.saldo||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
      </div>`;
    });

    const dias = lastTxDays !== null ? `${lastTxDays}d atrás` : 'Nunca';
    const ini  = (u.nome || u.email || '?').charAt(0).toUpperCase();
    const planoAtual = (u.plano || 'free').toLowerCase();

    document.getElementById('muContent').innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;">
        <div class="u-avatar" style="width:3.5rem;height:3.5rem;font-size:1.25rem;font-weight:900;flex-shrink:0;">${esc(ini)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:1.0625rem;font-weight:800;color:#064e3b;">${esc(u.nome || '—')}</div>
          <div style="font-size:.8125rem;color:#6b7280;word-break:break-all;">${esc(u.email || '—')}</div>
          <div style="margin-top:.375rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            ${planBadge(u.plano)}
            ${u.bloqueado ? '<span class="plan-badge" style="background:#fee2e2;color:#dc2626;">🚫 Bloqueado</span>' : ''}
            <span style="font-size:.7rem;color:#9ca3af;">Desde ${fmtDate(u.criadoEm || u.dataCadastro)}</span>
          </div>
        </div>
        <button onclick="closeUserModal()" style="width:2rem;height:2rem;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.625rem;margin-bottom:1.25rem;">
        <div style="background:#f0fdf4;border-radius:.75rem;padding:.75rem;text-align:center;">
          <div style="font-size:1.375rem;font-weight:900;color:#059669;">${txCount}</div>
          <div style="font-size:.625rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Transações</div>
        </div>
        <div style="background:#f0fdf4;border-radius:.75rem;padding:.75rem;text-align:center;">
          <div style="font-size:1.375rem;font-weight:900;color:#059669;">${dias}</div>
          <div style="font-size:.625rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Última tx</div>
        </div>
        <div style="background:#f0fdf4;border-radius:.75rem;padding:.75rem;text-align:center;">
          <div style="font-size:1.375rem;font-weight:900;color:#059669;">${cardsCount.data().count}</div>
          <div style="font-size:.625rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Cartões</div>
        </div>
        <div style="background:#f0fdf4;border-radius:.75rem;padding:.75rem;text-align:center;">
          <div style="font-size:1.375rem;font-weight:900;color:#059669;">${metasCount.data().count}</div>
          <div style="font-size:.625rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Metas</div>
        </div>
      </div>

      <!-- Engajamento -->
      <div style="background:#f8fafc;border-radius:.75rem;padding:.875rem;margin-bottom:1rem;">
        <div style="font-size:.75rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem;">Engajamento</div>
        ${thermoHTML(eng)}
      </div>

      <!-- Carteira -->
      ${carteiraHtml ? `<div style="margin-bottom:1rem;">
        <div style="font-size:.75rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem;">
          Carteira — <span style="color:#059669;">${saldoTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        </div>
        ${carteiraHtml}
      </div>` : ''}

      <!-- Alterar Plano -->
      <div style="background:#f0fdf4;border:1.5px solid #d1fae5;border-radius:.875rem;padding:1rem;margin-bottom:1rem;">
        <div style="font-size:.75rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.625rem;">✏️ Alterar Plano</div>
        <div style="display:flex;align-items:center;gap:.625rem;flex-wrap:wrap;">
          <div class="admin-sel" id="muPlanSelContainer" style="flex:1;min-width:130px;">
            <div class="admin-sel-trigger" style="width:100%;" onclick="toggleSel('muPlanSelContainer')">
              <span id="muPlanSelLabel">${planoAtual.charAt(0).toUpperCase() + planoAtual.slice(1)}</span>
              <span class="admin-sel-arrow">▾</span>
            </div>
            <div class="admin-sel-drop" style="width:100%;">
              ${['free','starter','trial','plus','pro'].map(p => `
                <div class="admin-sel-opt ${p === planoAtual ? 'sel' : ''}" onclick="pickSel('muPlanSelContainer','${p}','${p.charAt(0).toUpperCase()+p.slice(1)}')">${p.charAt(0).toUpperCase()+p.slice(1)}</div>
              `).join('')}
            </div>
            <input type="hidden" id="muPlanSel" value="${esc(planoAtual)}">
          </div>
          <button class="btn-primary btn-sm" onclick="changeUserPlan('${esc(uid)}')">Salvar Plano</button>
          <button class="btn-warn btn-sm" onclick="addTrial30('${esc(uid)}')">+ 30 dias trial</button>
        </div>
        <div style="font-size:.7rem;color:#9ca3af;margin-top:.375rem;">UID: <code>${esc(uid)}</code></div>
      </div>

      <!-- Zona de Perigo -->
      <div style="border:1.5px solid #fecaca;border-radius:.875rem;padding:1rem;">
        <div style="font-size:.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.625rem;">⚠️ Zona de Perigo</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button class="btn-warn" onclick="toggleBlock('${esc(uid)}', ${!!u.bloqueado})">
            ${u.bloqueado ? '✅ Desbloquear Usuário' : '🚫 Bloquear Usuário'}
          </button>
          <button class="btn-danger" onclick="deleteUser('${esc(uid)}', '${esc(u.email || '')}')">🗑️ Excluir Conta</button>
        </div>
      </div>
    `;
  } catch(e) {
    console.error('[viewUser]', e);
    document.getElementById('muContent').innerHTML = `<div class="empty-state"><div class="icon">❌</div>Erro: ${esc(e.message)}</div>`;
  }
};

window.closeUserModal = function() {
  document.getElementById('modalUser').classList.remove('open');
};

window.changeUserPlan = async function(uid) {
  const newPlan = document.getElementById('muPlanSel')?.value;
  if (!newPlan) return;
  try {
    const userRef = doc(db, 'usuarios', uid);
    const oldSnap = await getDoc(userRef);
    const oldPlan = oldSnap.data()?.plano || 'free';
    const update = { plano: newPlan };
    // Clear old plan timestamps
    ['planoAtivadoEm','planoVenceEm','trialInicio','trialFim'].forEach(f => { update[f] = null; });
    if (newPlan === 'trial') {
      update.trialInicio  = serverTimestamp();
      update.planoVenceEm = Timestamp.fromDate(new Date(Date.now() + 30*24*60*60*1000));
    } else if (newPlan !== 'free') {
      update.planoAtivadoEm = serverTimestamp();
    }
    await updateDoc(userRef, update);
    // Log plan change
    await addDoc(collection(db, 'plano_historico'), {
      uid, oldPlan, newPlan, alteredBy: auth.currentUser?.uid || 'admin',
      alteredAt: serverTimestamp(), fonte: 'admin_panel'
    });
    budToast(`Plano alterado para ${newPlan} com sucesso!`);
    closeUserModal();
    // Refresh CRM list
    _crmUsers = _crmUsers.map(u => u.id === uid ? { ...u, plano: newPlan } : u);
    _crmUsersAll = _crmUsersAll.map(u => u.id === uid ? { ...u, plano: newPlan } : u);
    renderCRM(_crmUsers);
    if (_overviewLoaded) loadOverview();
  } catch(e) {
    console.error('[changeUserPlan]', e);
    budToast('Erro ao alterar plano: ' + e.message, 'error');
  }
};

window.addTrial30 = async function(uid) {
  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      plano: 'trial',
      trialInicio:  serverTimestamp(),
      planoVenceEm: Timestamp.fromDate(new Date(Date.now() + 30*24*60*60*1000)),
    });
    budToast('Trial de 30 dias adicionado!');
    closeUserModal();
  } catch(e) {
    budToast('Erro: ' + e.message, 'error');
  }
};

window.toggleBlock = function(uid, blocked) {
  const action = blocked ? 'Desbloquear' : 'Bloquear';
  confirmAction(`${action} este usuário?`, async () => {
    try {
      await updateDoc(doc(db, 'usuarios', uid), { bloqueado: !blocked });
      budToast(`Usuário ${blocked ? 'desbloqueado' : 'bloqueado'} com sucesso.`);
      closeUserModal();
      _crmUsers = _crmUsers.map(u => u.id === uid ? { ...u, bloqueado: !blocked } : u);
      _crmUsersAll = _crmUsersAll.map(u => u.id === uid ? { ...u, bloqueado: !blocked } : u);
      renderCRM(_crmUsers);
    } catch(e) { budToast('Erro: ' + e.message, 'error'); }
  });
};

window.deleteUser = function(uid, email) {
  confirmAction(`Excluir permanentemente a conta de ${email || uid}? Esta ação não pode ser desfeita.`, async () => {
    try {
      closeUserModal();
      if (window.BUD_FUNCTIONS_URL) {
        await fetch(`${window.BUD_FUNCTIONS_URL}/api/admin/delete-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid }),
        });
      } else {
        await deleteDoc(doc(db, 'usuarios', uid));
      }
      budToast('Usuário excluído.');
      _crmUsers = _crmUsers.filter(u => u.id !== uid);
      _crmUsersAll = _crmUsersAll.filter(u => u.id !== uid);
      renderCRM(_crmUsers);
    } catch(e) { budToast('Erro ao excluir: ' + e.message, 'error'); }
  });
};


// ═══════════════════════════════════════════════════════════════
//  VENDAS
// ═══════════════════════════════════════════════════════════════
async function loadSales() {
  _salesLoaded = true;
  const usersRef = collection(db, 'usuarios');

  try {
    const [trialCnt, pagSnap, freeSnap] = await Promise.all([
      getCountFromServer(query(usersRef, where('plano', '==', 'trial'))),
      getDocs(query(usersRef, where('plano', 'in', ['plus', 'pro', 'starter']), limit(50))),
      getDocs(query(usersRef, where('plano', '==', 'free'), limit(100))),
    ]);

    const trialN = trialCnt.data().count;
    // Filter "não ativaram": free users cadastrados há > 7 dias
    const cutoff = Date.now() - 7 * 86400000;
    const naoAtivaram = [];
    freeSnap.forEach(d => {
      const u = { id: d.id, ...d.data() };
      const dt = u.criadoEm?.toDate?.() || u.dataCadastro?.toDate?.() || null;
      if (dt && dt.getTime() < cutoff) naoAtivaram.push(u);
    });
    naoAtivaram.sort((a, b) => {
      const da = (a.criadoEm?.toDate?.() || new Date(0)).getTime();
      const db2 = (b.criadoEm?.toDate?.() || new Date(0)).getTime();
      return da - db2;
    });

    // Pagantes
    const pagantes = [];
    pagSnap.forEach(d => pagantes.push({ id: d.id, ...d.data() }));
    // Sort by planoAtivadoEm desc (avoids Firestore composite index requirement)
    pagantes.sort((a, b) => {
      const ta = a.planoAtivadoEm?.toDate?.()?.getTime() || 0;
      const tb = b.planoAtivadoEm?.toDate?.()?.getTime() || 0;
      return tb - ta;
    });

    // MRR
    let mrr = 0;
    pagantes.forEach(u => { mrr += PLAN_PRICES[u.plano] || 0; });

    // KPIs
    setText('salesKpiMrr',          mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setText('salesKpiTrial',         trialN);
    setText('salesKpiNaoAtivaram',   naoAtivaram.length);
    setText('salesKpiPagantes',      pagantes.length);
    setText('countNaoAtivaram',      naoAtivaram.length);
    setText('countPagantes',         pagantes.length);

    // Render "Não Ativaram"
    if (naoAtivaram.length === 0) {
      document.getElementById('salesNaoAtivaram').innerHTML = '<div class="empty-state"><div class="icon">✅</div>Nenhum usuário free antigo</div>';
    } else {
      document.getElementById('salesNaoAtivaram').innerHTML = naoAtivaram.map(u => {
        const d = daysSince(u.criadoEm || u.dataCadastro);
        return `<div class="venda-row" style="display:grid;grid-template-columns:1fr 1fr 120px 80px auto;gap:.75rem;">
          <span style="font-size:.875rem;font-weight:600;">${esc(u.nome || '—')}</span>
          <span style="font-size:.75rem;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${esc(u.email || '—')}</span>
          <span style="font-size:.75rem;color:#6b7280;">${fmtDate(u.criadoEm || u.dataCadastro)}</span>
          <span style="font-size:.8125rem;font-weight:700;color:#dc2626;">${d !== null ? d + 'd' : '—'}</span>
          <button class="btn-primary btn-sm" onclick="viewUser('${esc(u.id)}')">Contatar</button>
        </div>`;
      }).join('');
    }

    // Render Trial
    const trialQ = await getDocs(query(usersRef, where('plano', '==', 'trial'), limit(50)));
    const trials = [];
    trialQ.forEach(d => trials.push({ id: d.id, ...d.data() }));
    setText('countTrial', trials.length);
    if (trials.length === 0) {
      document.getElementById('salesTrial').innerHTML = '<div class="empty-state"><div class="icon">⏰</div>Nenhum usuário em trial</div>';
    } else {
      document.getElementById('salesTrial').innerHTML = trials.map(u => {
        const vence = u.planoVenceEm ? daysSince(u.planoVenceEm.toDate?.() || u.planoVenceEm) : null;
        const venceLabel = vence !== null ? (vence <= 0 ? `${Math.abs(vence)}d restantes` : `Vencido ${vence}d`) : '—';
        return `<div class="venda-row" style="display:grid;grid-template-columns:1fr 1fr 120px 80px auto;gap:.75rem;">
          <span style="font-size:.875rem;font-weight:600;">${esc(u.nome || '—')}</span>
          <span style="font-size:.75rem;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${esc(u.email || '—')}</span>
          <span style="font-size:.75rem;color:#6b7280;">${fmtDate(u.trialInicio)}</span>
          <span style="font-size:.8125rem;font-weight:700;color:${vence && vence > 0 ? '#dc2626' : '#059669'};">${venceLabel}</span>
          <button class="btn-primary btn-sm" onclick="viewUser('${esc(u.id)}')">Ver</button>
        </div>`;
      }).join('');
    }

    // Render Pagantes
    if (pagantes.length === 0) {
      document.getElementById('salesPagantes').innerHTML = '<div class="empty-state"><div class="icon">💰</div>Nenhum usuário com plano pago</div>';
    } else {
      document.getElementById('salesPagantes').innerHTML = pagantes.map(u => {
        return `<div class="venda-row" style="display:grid;grid-template-columns:1fr 1fr 1fr 120px auto;gap:.75rem;">
          <span style="font-size:.875rem;font-weight:600;">${esc(u.nome || '—')}</span>
          <span style="font-size:.75rem;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${esc(u.email || '—')}</span>
          <span>${planBadge(u.plano)}</span>
          <span style="font-size:.75rem;color:#6b7280;">${fmtDate(u.planoAtivadoEm)}</span>
          <button class="btn-ghost btn-sm" onclick="viewUser('${esc(u.id)}')">Ver</button>
        </div>`;
      }).join('');
    }
  } catch(e) {
    console.error('[loadSales]', e);
  }
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES
// ═══════════════════════════════════════════════════════════════
async function loadNotifications() {
  try {
    const snap = await getDocs(query(collection(db, 'notificacoes-globais'), orderBy('criadoEm', 'desc'), limit(20)));
    _notifs = [];
    snap.forEach(d => _notifs.push({ id: d.id, ...d.data() }));
    renderNotifs();
  } catch(e) {
    console.error('[notifs]', e);
  }
}

function renderNotifs() {
  const cont = document.getElementById('notifHistory');
  if (!cont) return;
  if (_notifs.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">🔕</div>Nenhuma notificação enviada ainda</div>';
    return;
  }
  const icons = { info: '💡', promo: '🎉', update: '🚀', alert: '⚠️' };
  const colors = { info: '#eff6ff', promo: '#f0fdf4', update: '#f5f3ff', alert: '#fffbeb' };
  cont.innerHTML = _notifs.map(n => `
    <div class="notif-item">
      <div class="notif-icon" style="background:${colors[n.tipo] || '#f8fafc'};">${icons[n.tipo] || '🔔'}</div>
      <div class="notif-body">
        <div class="notif-titulo">${esc(n.titulo || '—')}</div>
        <div class="notif-meta">${esc(n.mensagem || '')} — <b>${esc(n.destino || 'all')}</b> via ${esc(n.canal || 'inapp')} · ${fmtDate(n.criadoEm)}</div>
      </div>
      <button class="btn-danger btn-sm" onclick="deleteNotif('${esc(n.id)}')">✕</button>
    </div>
  `).join('');
}

window.enviarNotificacao = async function() {
  const titulo   = document.getElementById('notifTitulo').value.trim();
  const mensagem = document.getElementById('notifMensagem').value.trim();
  const tipo     = document.getElementById('notifTipo').value || 'info';
  const canal    = document.getElementById('notifCanal').value || 'inapp';
  const destino  = document.getElementById('notifDestino').value || 'all';

  if (!titulo || !mensagem) { budToast('Preencha título e mensagem.', 'error'); return; }

  const btn = document.getElementById('btnEnviarNotif');
  btn.disabled = true; btn.textContent = '⏳ Enviando...';

  try {
    await addDoc(collection(db, 'notificacoes-globais'), {
      titulo, mensagem, tipo, canal, destino,
      criadoEm: serverTimestamp(), lida: false, criadoPor: auth.currentUser?.uid || 'admin'
    });

    // Try push via backend if push channel selected
    if (canal === 'push' && window.BUD_FUNCTIONS_URL) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const pushRes = await fetch(`${window.BUD_FUNCTIONS_URL}/api/push/admin-broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
          body: JSON.stringify({ titulo, mensagem, tipo, destino }),
        });
        const pushData = await pushRes.json().catch(() => ({}));
        if (pushRes.ok) budToast(`📲 Push enviado para ${pushData.sent ?? '?'} dispositivo(s).`, 'success');
        else budToast('⚠️ Push não enviado: ' + (pushData.error || 'erro desconhecido'), 'warning');
      } catch(backErr) {
        console.warn('[notif] push backend não disponível:', backErr.message);
      }
    }

    document.getElementById('notifTitulo').value  = '';
    document.getElementById('notifMensagem').value = '';
    budToast('✅ Notificação enviada!');
    await loadNotifications();
  } catch(e) {
    budToast('Erro ao enviar: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '📤 Enviar Notificação';
  }
};

window.deleteNotif = function(id) {
  confirmAction('Excluir esta notificação do histórico?', async () => {
    try {
      await deleteDoc(doc(db, 'notificacoes-globais', id));
      budToast('Notificação removida.');
      _notifs = _notifs.filter(n => n.id !== id);
      renderNotifs();
    } catch(e) { budToast('Erro: ' + e.message, 'error'); }
  });
};

// ═══════════════════════════════════════════════════════════════
//  PROMOÇÕES
// ═══════════════════════════════════════════════════════════════
async function loadPromos() {
  try {
    const snap = await getDocs(query(collection(db, 'promocoes'), orderBy('criadoEm', 'desc')));
    _promos = [];
    snap.forEach(d => _promos.push({ id: d.id, ...d.data() }));
    renderPromos();
  } catch(e) {
    console.error('[promos]', e);
  }
}

function renderPromos() {
  const cont = document.getElementById('promosList');
  if (!cont) return;
  if (_promos.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">🎟️</div>Nenhum cupom criado ainda</div>';
    return;
  }
  cont.innerHTML = _promos.map(p => {
    const statusLabel = p.ativa ? '<span style="color:#059669;font-weight:700;font-size:.75rem;">✅ Ativa</span>' : '<span style="color:#9ca3af;font-weight:700;font-size:.75rem;">⏸ Pausada</span>';
    return `<div class="promo-row">
      <div class="promo-code">${esc(p.codigo)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.875rem;font-weight:700;color:#1e293b;">${esc(p.descricao || `${p.desconto}% de desconto`)}</div>
        <div style="font-size:.75rem;color:#6b7280;margin-top:.125rem;">
          ${p.desconto}% off · ${p.usos || 0}${p.limite ? '/' + p.limite : ''} usos
          ${p.dataInicio ? ` · de ${esc(p.dataInicio)}` : ''}
          ${p.dataFim    ? ` até ${esc(p.dataFim)}` : ''}
        </div>
      </div>
      ${statusLabel}
      <button class="btn-ghost btn-sm" onclick="togglePromo('${esc(p.id)}', ${!!p.ativa})">${p.ativa ? 'Pausar' : 'Ativar'}</button>
      <button class="btn-danger btn-sm" onclick="deletePromo('${esc(p.id)}')">🗑️</button>
    </div>`;
  }).join('');
}

window.openPromoModal = function() {
  ['promoCodigo','promoDesconto','promoInicio','promoFim','promoDescricao'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('promoLimite').value = '0';
  document.getElementById('modalPromo').classList.add('open');
};
window.closePromoModal = function() { document.getElementById('modalPromo').classList.remove('open'); };

window.savePromo = async function() {
  const codigo    = document.getElementById('promoCodigo').value.trim();
  const desconto  = parseInt(document.getElementById('promoDesconto').value);
  const inicio    = document.getElementById('promoInicio').value;
  const fim       = document.getElementById('promoFim').value;
  const limite    = parseInt(document.getElementById('promoLimite').value) || 0;
  const descricao = document.getElementById('promoDescricao').value.trim();

  if (!codigo) { budToast('Informe o código do cupom.', 'error'); return; }
  if (!desconto || desconto < 1 || desconto > 100) { budToast('Desconto inválido (1-100).', 'error'); return; }

  const btn = document.getElementById('btnSalvarPromo');
  btn.disabled = true; btn.textContent = '⏳ Salvando...';
  try {
    await addDoc(collection(db, 'promocoes'), {
      codigo, desconto, dataInicio: inicio || null, dataFim: fim || null,
      limite, descricao, ativa: true, usos: 0, criadoEm: serverTimestamp()
    });
    budToast('✅ Cupom criado!');
    closePromoModal();
    await loadPromos();
  } catch(e) {
    budToast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar Cupom';
  }
};

window.togglePromo = async function(id, ativa) {
  try {
    await updateDoc(doc(db, 'promocoes', id), { ativa: !ativa });
    _promos = _promos.map(p => p.id === id ? { ...p, ativa: !ativa } : p);
    renderPromos();
  } catch(e) { budToast('Erro: ' + e.message, 'error'); }
};

window.deletePromo = function(id) {
  confirmAction('Excluir este cupom permanentemente?', async () => {
    try {
      await deleteDoc(doc(db, 'promocoes', id));
      budToast('Cupom excluído.');
      _promos = _promos.filter(p => p.id !== id);
      renderPromos();
    } catch(e) { budToast('Erro: ' + e.message, 'error'); }
  });
};


// ═══════════════════════════════════════════════════════════════
//  FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════
const DEFAULT_FLAGS = [
  { nome: 'Compras',              key: 'compras',              desc: 'Exibe o menu e libera a tela de compras',      planos: ['free','starter','trial','plus','pro'], enabled: true },
  { nome: 'Grupo Bud Plus',       key: 'grupo_bud_plus',       desc: 'Exibe o título Bud Plus na barra lateral',     planos: ['free','starter','trial','plus','pro'], enabled: true },
  { nome: 'Dashboard Avançado',   key: 'dashboard_avancado',  desc: 'Gráficos e insights avançados no dashboard', planos: ['plus','pro'], enabled: true },
  { nome: 'Importação por IA',    key: 'importacao_ia',       desc: 'Importar extrato via Gemini/OCR',           planos: ['pro'],         enabled: true },
  { nome: 'Limites de Gastos',    key: 'limites_gastos',      desc: 'Definir orçamento por categoria',           planos: ['starter','trial','plus','pro'], enabled: true },
  { nome: 'Cartões de Crédito',   key: 'cartoes_credito',     desc: 'Gestão de cartões e faturas',               planos: ['trial','plus','pro'], enabled: true },
  { nome: 'Metas Financeiras',    key: 'metas',               desc: 'Criar e acompanhar metas de economia',      planos: ['trial','plus','pro'], enabled: true },
  { nome: 'Relatórios',           key: 'relatorios',          desc: 'Exportar PDF e Excel',                      planos: ['plus','pro'], enabled: true },
  { nome: 'Recorrências',         key: 'recorrencias',        desc: 'Lançamentos recorrentes automáticos',       planos: ['plus','pro'], enabled: true },
  { nome: 'Assistente IA Chat',   key: 'assistente_ia',       desc: 'Chat com IA financeira Gemini',             planos: ['pro'],         enabled: true },
  { nome: 'WhatsApp Bot',         key: 'whatsapp',            desc: 'Registrar transações pelo WhatsApp',        planos: ['pro'],         enabled: true },
  { nome: 'Comparativo Mensal',   key: 'comparativo',         desc: 'Comparar receitas/despesas por mês',        planos: ['plus','pro'], enabled: true },
  { nome: 'Dívidas e Empréstimos',key: 'dividas',             desc: 'Controle de dívidas e parcelamentos',       planos: ['trial','plus','pro'], enabled: true },
  { nome: 'Investimentos',        key: 'investimentos',       desc: 'Carteira de investimentos e rendimentos',   planos: ['plus','pro'], enabled: true },
  { nome: 'Balanço Mensal',       key: 'balanco',             desc: 'Resumo detalhado por mês',                  planos: ['starter','trial','plus','pro'], enabled: true },
  { nome: 'Extrato Completo',     key: 'extrato',             desc: 'Extrato com filtros avançados',             planos: ['free','starter','trial','plus','pro'], enabled: true },
  { nome: 'Insights Automáticos', key: 'insights',            desc: 'Sugestões e análises automáticas',          planos: ['pro'],         enabled: true },
  { nome: 'Gráficos Avançados',   key: 'graficos',            desc: 'Gráficos interativos e personalizados',     planos: ['plus','pro'], enabled: true },
  { nome: 'Dark Mode',            key: 'dark_mode',           desc: 'Tema escuro para o aplicativo',             planos: ['free','starter','trial','plus','pro'], enabled: true },
  { nome: 'Notificações Push',    key: 'push_notifications',  desc: 'Alertas e notificações push FCM',           planos: ['plus','pro'], enabled: true },
];

async function loadFlags() {
  try {
    const snap = await getDocs(collection(db, 'featureFlags'));
    const legacyMercado = snap.docs.filter(d => d.data()?.key === 'mercado');
    if (legacyMercado.length) {
      await Promise.all(legacyMercado.map(flagDoc => updateDoc(flagDoc.ref, {
        key: 'compras', nome: 'Compras', desc: 'Exibe o menu e libera a tela de compras',
        atualizadoEm: serverTimestamp()
      })));
      await loadFlags();
      return;
    }
    const existingKeys = new Set();
    snap.forEach(d => {
      const key = d.data()?.key;
      if (key) existingKeys.add(key);
    });

    // Cria cada flag padrão ausente, mesmo quando a coleção já possui outras flags.
    const missingFlags = DEFAULT_FLAGS.filter(f => !existingKeys.has(f.key));
    if (missingFlags.length) {
      await Promise.all(missingFlags.map(f =>
        addDoc(collection(db, 'featureFlags'), { ...f, criadoEm: serverTimestamp() })
      ));
      await loadFlags();
      return;
    }
    const uniqueFlags = new Map();
    snap.forEach(d => {
      const current = { id: d.id, ...d.data() };
      const previous = uniqueFlags.get(current.key);
      if (!previous) uniqueFlags.set(current.key, current);
      else if (current.enabled === false) uniqueFlags.set(current.key, { ...previous, enabled: false });
    });
    _allFlags = [...uniqueFlags.values()];
    syncFlagsToBrowser();
    renderFlags();
  } catch(e) {
    console.error('[flags]', e);
  }
}

function syncFlagsToBrowser() {
  const features = {};
  const rules = {};
  _allFlags.forEach(f => {
    if (!f.key) return;
    features[f.key] = features[f.key] === false ? false : f.enabled !== false;
    const previous = rules[f.key];
    rules[f.key] = {
      enabled: previous?.enabled === false ? false : f.enabled !== false,
      planos: Array.isArray(f.planos) ? f.planos : []
    };
  });
  window.BUD_FEATURES = features;
  window.BUD_FEATURE_RULES = rules;
  try { localStorage.setItem('bud_feature_flags', JSON.stringify(features)); } catch (_) {}
  try { localStorage.setItem('bud_feature_rules', JSON.stringify(rules)); } catch (_) {}
  window.dispatchEvent(new CustomEvent('bud:features-updated', { detail: features }));
}

function renderFlags() {
  const grid = document.getElementById('flagsGrid');
  if (!grid) return;
  if (_allFlags.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">🚩</div>Nenhuma flag criada</div>';
    return;
  }
  grid.innerHTML = _allFlags.map(f => {
    const planos = (f.planos || []).map(p => planBadge(p)).join(' ');
    return `<div class="ff-card ${f.enabled ? '' : 'off'}">
      <div class="ff-card-top">
        <div>
          <div class="ff-name">${esc(f.nome)}</div>
          <div class="ff-key">${esc(f.key)}</div>
        </div>
        <button class="toggle ${f.enabled ? 'on' : ''}" onclick="toggleFlag('${esc(f.id)}', ${!f.enabled})"></button>
      </div>
      <div class="ff-desc">${esc(f.desc || '—')}</div>
      <div class="ff-plans">${planos || '<span style="font-size:.7rem;color:#9ca3af;">Todos os planos</span>'}</div>
      <div class="ff-actions">
        <button class="btn-ghost btn-sm" onclick="editFlag('${esc(f.id)}')">✏️ Editar</button>
        <button class="btn-danger btn-sm" onclick="deleteFlag('${esc(f.id)}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.toggleFlag = async function(id, newState) {
  try {
    const selected = _allFlags.find(f => f.id === id);
    if (!selected) throw new Error('Flag não encontrada.');
    const sameKey = await getDocs(query(collection(db, 'featureFlags'), where('key', '==', selected.key)));
    await Promise.all(sameKey.docs.map(flagDoc => updateDoc(flagDoc.ref, {
      enabled: newState, atualizadoEm: serverTimestamp()
    })));
    _allFlags = _allFlags.map(f => f.key === selected.key ? { ...f, enabled: newState } : f);
    syncFlagsToBrowser();
    renderFlags();
  } catch(e) { budToast('Erro: ' + e.message, 'error'); }
};

window.limparNotificacoesTeste = function() {
  const testes = _notifs.filter(n => {
    const texto = `${n.titulo || ''} ${n.mensagem || ''}`.toLowerCase();
    return /\bteste+\b|testando|funcionalidade/.test(texto);
  });
  if (!testes.length) { budToast('Nenhuma notificação de teste encontrada.', 'info'); return; }
  confirmAction(`Excluir ${testes.length} notificação(ões) de teste?`, async () => {
    try {
      await Promise.all(testes.map(n => deleteDoc(doc(db, 'notificacoes-globais', n.id))));
      _notifs = _notifs.filter(n => !testes.some(t => t.id === n.id));
      renderNotifs();
      budToast('Notificações de teste removidas.');
    } catch(e) { budToast('Erro ao remover testes: ' + e.message, 'error'); }
  });
};

// Os atalhos da aba Sistema usam a mesma fonte das Feature Flags.
window.saveFeatureToggle = async function(key, enabled) {
  try {
    const snap = await getDocs(query(collection(db, 'featureFlags'), where('key', '==', key)));
    if (snap.empty) throw new Error('Feature flag não encontrada: ' + key);
    await Promise.all(snap.docs.map(flagDoc => updateDoc(flagDoc.ref, {
      enabled, atualizadoEm: serverTimestamp()
    })));
    _allFlags = _allFlags.map(f => f.key === key ? { ...f, enabled } : f);
    syncFlagsToBrowser();
    renderFlags();
    budToast(enabled ? 'Funcionalidade ativada.' : 'Funcionalidade desativada.');
  } catch(e) {
    budToast('Erro ao salvar: ' + e.message, 'error');
    loadAppSettings();
  }
};

window.openFlagModal = function() {
  document.getElementById('flagEditId').value = '';
  document.getElementById('modalFlagTitulo').textContent = 'Nova Feature Flag';
  document.getElementById('flagNome').value = '';
  document.getElementById('flagKey').value  = '';
  document.getElementById('flagDesc').value = '';
  document.querySelectorAll('[name="flagPlan"]').forEach(cb => cb.checked = false);
  document.getElementById('flagEnabled').classList.add('on');
  document.getElementById('flagEnabledLabel').textContent = 'Sim';
  document.getElementById('modalFlag').classList.add('open');
};

window.editFlag = function(id) {
  const f = _allFlags.find(f => f.id === id);
  if (!f) return;
  document.getElementById('flagEditId').value = id;
  document.getElementById('modalFlagTitulo').textContent = 'Editar Feature Flag';
  document.getElementById('flagNome').value = f.nome || '';
  document.getElementById('flagKey').value  = f.key  || '';
  document.getElementById('flagDesc').value = f.desc || '';
  const planos = f.planos || [];
  document.querySelectorAll('[name="flagPlan"]').forEach(cb => cb.checked = planos.includes(cb.value));
  if (f.enabled) document.getElementById('flagEnabled').classList.add('on');
  else document.getElementById('flagEnabled').classList.remove('on');
  document.getElementById('flagEnabledLabel').textContent = f.enabled ? 'Sim' : 'Não';
  document.getElementById('modalFlag').classList.add('open');
};

window.closeFlagModal = function() { document.getElementById('modalFlag').classList.remove('open'); };

window.saveFlag = async function() {
  const editId  = document.getElementById('flagEditId').value;
  const nome    = document.getElementById('flagNome').value.trim();
  const key     = document.getElementById('flagKey').value.trim();
  const desc    = document.getElementById('flagDesc').value.trim();
  const enabled = document.getElementById('flagEnabled').classList.contains('on');
  const planos  = [...document.querySelectorAll('[name="flagPlan"]:checked')].map(c => c.value);

  if (!nome) { budToast('Informe o nome da flag.', 'error'); return; }
  if (!key)  { budToast('Informe a chave (slug) da flag.', 'error'); return; }

  const btn = document.getElementById('btnSalvarFlag');
  btn.disabled = true; btn.textContent = '⏳ Salvando...';
  try {
    if (editId) {
      await updateDoc(doc(db, 'featureFlags', editId), { nome, key, desc, enabled, planos });
      _allFlags = _allFlags.map(f => f.id === editId ? { ...f, nome, key, desc, enabled, planos } : f);
    } else {
      const ref = await addDoc(collection(db, 'featureFlags'), { nome, key, desc, enabled, planos, criadoEm: serverTimestamp() });
      _allFlags.push({ id: ref.id, nome, key, desc, enabled, planos });
    }
    budToast('✅ Flag salva!');
    closeFlagModal();
    renderFlags();
  } catch(e) {
    budToast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar Flag';
  }
};

window.deleteFlag = function(id) {
  const f = _allFlags.find(f => f.id === id);
  confirmAction(`Excluir a flag "${f?.nome || id}"?`, async () => {
    try {
      await deleteDoc(doc(db, 'featureFlags', id));
      budToast('Flag excluída.');
      _allFlags = _allFlags.filter(f => f.id !== id);
      renderFlags();
    } catch(e) { budToast('Erro: ' + e.message, 'error'); }
  });
};

// ═══════════════════════════════════════════════════════════════
//  IA METRICS
// ═══════════════════════════════════════════════════════════════
window.loadIAMetrics = async function loadIAMetrics() {
  _iaMetricsLoaded = true;
  const tableEl = document.getElementById('iaTable');
  const kpiEl   = document.getElementById('iaKpiRow');
  const labelEl = document.getElementById('iaMesLabel');
  if (!tableEl) return;
  tableEl.innerHTML = '<div style="font-size:0.875rem;color:var(--text-sec)">Carregando…</div>';

  const now    = new Date();
  const anoMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (labelEl) labelEl.textContent = `Mês: ${anoMes}`;

  try {
    // Busca todos usuários (max 200)
    const usersSnap = await getDocs(query(collection(db, 'usuarios'), limit(200)));
    const users = [];
    usersSnap.forEach(d => users.push({ id: d.id, ...d.data() }));

    // Busca uso-ia do mês para cada usuário em paralelo
    const usageSnaps = await Promise.all(
      users.map(u => getDoc(doc(db, 'usuarios', u.id, 'uso-ia', anoMes)))
    );

    const rows = [];
    let totalCupons = 0, totalExtrato = 0, totalChat = 0;
    users.forEach((u, i) => {
      const uso = usageSnaps[i].exists() ? usageSnaps[i].data() : {};
      const cupons  = uso.mercado      || 0;
      const extrato = uso.extrato      || 0;
      const chat    = uso.assistente   || 0;
      if (cupons + extrato + chat === 0) return;
      totalCupons  += cupons;
      totalExtrato += extrato;
      totalChat    += chat;
      rows.push({ email: u.email || u.uid || u.id, plano: u.plano || 'free', cupons, extrato, chat });
    });

    rows.sort((a, b) => (b.cupons + b.extrato + b.chat) - (a.cupons + a.extrato + a.chat));

    // KPIs
    if (kpiEl) kpiEl.innerHTML = [
      ['🛒 Cupons',    totalCupons],
      ['📄 Extrato',   totalExtrato],
      ['💬 Chat',      totalChat],
      ['👥 Usuários ativos', rows.length],
    ].map(([label, val]) => `<div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:0.75rem;padding:0.75rem 1.25rem;min-width:8rem;text-align:center;"><div style="font-size:1.5rem;font-weight:800;color:var(--primary)">${val}</div><div style="font-size:0.75rem;color:var(--text-sec)">${label}</div></div>`).join('');

    if (!rows.length) {
      tableEl.innerHTML = '<div style="font-size:0.875rem;color:var(--text-sec);padding:1rem 0;">Nenhum uso de IA registrado neste mês.</div>';
      return;
    }

    tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
      <thead><tr style="color:var(--text-sec);text-align:left;">
        <th style="padding:0.5rem 0.25rem;border-bottom:1px solid var(--card-border);">Email</th>
        <th style="padding:0.5rem 0.25rem;border-bottom:1px solid var(--card-border);">Plano</th>
        <th style="padding:0.5rem 0.25rem;border-bottom:1px solid var(--card-border);text-align:center;">🛒</th>
        <th style="padding:0.5rem 0.25rem;border-bottom:1px solid var(--card-border);text-align:center;">📄</th>
        <th style="padding:0.5rem 0.25rem;border-bottom:1px solid var(--card-border);text-align:center;">💬</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td style="padding:0.4rem 0.25rem;border-bottom:1px solid var(--card-border);color:var(--text-main)">${escapeHtmlAdmin(r.email)}</td>
        <td style="padding:0.4rem 0.25rem;border-bottom:1px solid var(--card-border);color:var(--text-sec)">${r.plano}</td>
        <td style="padding:0.4rem 0.25rem;border-bottom:1px solid var(--card-border);text-align:center;font-weight:600">${r.cupons || '—'}</td>
        <td style="padding:0.4rem 0.25rem;border-bottom:1px solid var(--card-border);text-align:center">${r.extrato || '—'}</td>
        <td style="padding:0.4rem 0.25rem;border-bottom:1px solid var(--card-border);text-align:center">${r.chat || '—'}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  } catch (e) {
    tableEl.innerHTML = `<div style="color:#dc2626;font-size:0.875rem;">Erro ao carregar: ${e.message}</div>`;
    console.error('loadIAMetrics', e);
  }
};

function escapeHtmlAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════════════════════════
//  SISTEMA
// ═══════════════════════════════════════════════════════════════
async function loadAppSettings() {
  try {
    const snap = await getDoc(doc(db, 'admin', 'config'));
    _appSettings = snap.exists() ? snap.data() : {};

    setToggleUI('togManutencao',   !!_appSettings.modoManutencao);
    setToggleUI('togCadastros',    _appSettings.cadastrosAbertos !== false);
    const flagsSnap = await getDocs(collection(db, 'featureFlags'));
    const flagsByKey = {};
    flagsSnap.forEach(d => { const f = d.data(); flagsByKey[f.key] = f.enabled !== false; });
    setToggleUI('togAssistenteIA', flagsByKey.assistente_ia !== false);
    setToggleUI('togAssistenteWA', flagsByKey.whatsapp !== false);

    const v = document.getElementById('inputVersao'); if (v) v.value = _appSettings.versao || '';
    const b = document.getElementById('inputBoasVindas'); if (b) b.value = _appSettings.mensagemBoasVindas || '';
    const ic = document.getElementById('inputInviteCode'); if (ic) ic.value = _appSettings.adminInviteCode || '';
  } catch(e) {
    console.error('[settings]', e);
  }
}

function setToggleUI(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  if (on) el.classList.add('on');
  else    el.classList.remove('on');
}

window.saveToggle = async function(field, val) {
  try {
    await setDoc(doc(db, 'admin', 'config'), { [field]: val }, { merge: true });
    _appSettings[field] = val;
  } catch(e) { budToast('Erro ao salvar: ' + e.message, 'error'); }
};

window.saveAppSettings = async function() {
  const versao       = document.getElementById('inputVersao')?.value.trim() || '';
  const boasVindas   = document.getElementById('inputBoasVindas')?.value.trim() || '';
  const inviteCode   = document.getElementById('inputInviteCode')?.value.trim() || '';

  const btn = document.getElementById('btnSalvarSistema');
  btn.disabled = true; btn.textContent = '⏳ Salvando...';
  try {
    await setDoc(doc(db, 'admin', 'config'), {
      versao, mensagemBoasVindas: boasVindas, adminInviteCode: inviteCode
    }, { merge: true });
    Object.assign(_appSettings, { versao, mensagemBoasVindas: boasVindas, adminInviteCode: inviteCode });
    budToast('✅ Configurações salvas!');
  } catch(e) {
    budToast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Salvar';
  }
};

// ═══════════════════════════════════════════════════════════════
//  ADMINS
// ═══════════════════════════════════════════════════════════════
async function loadAdmins() {
  const cont = document.getElementById('adminsList');
  if (cont) cont.innerHTML = '<div class="loading-inline">Carregando...</div>';
  try {
    const snap = await getDocs(collection(db, 'admins'));
    const admins = [];
    snap.forEach(d => admins.push({ id: d.id, ...d.data() }));
    if (!cont) return;
    if (admins.length === 0) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">🔐</div>Nenhum admin cadastrado</div>';
      return;
    }
    cont.innerHTML = admins.map(a => {
      const ini = (a.nome || a.email || '?').charAt(0).toUpperCase();
      return `<div class="admin-row">
        <div class="admin-av">${esc(ini)}</div>
        <div style="flex:1;">
          <div style="font-size:.875rem;font-weight:700;color:#1e293b;">${esc(a.nome || '—')}</div>
          <div style="font-size:.75rem;color:#6b7280;">${esc(a.email || '—')}</div>
        </div>
        ${a.id !== auth.currentUser?.uid
          ? `<button class="btn-danger btn-sm" onclick="removerAdmin('${esc(a.id)}', '${esc(a.nome || a.email || '')}')">Remover</button>`
          : '<span style="font-size:.75rem;color:#9ca3af;font-weight:600;">(você)</span>'}
      </div>`;
    }).join('');
  } catch(e) {
    console.error('[admins]', e);
  }
}

window.mostrarAddAdmin = function() { document.getElementById('addAdminRow').style.display = 'block'; };
window.ocultarAddAdmin = function() { document.getElementById('addAdminRow').style.display = 'none'; document.getElementById('adminEmailInput').value = ''; };

window.adicionarAdmin = async function() {
  const email = document.getElementById('adminEmailInput').value.trim().toLowerCase();
  if (!email) { budToast('Informe o e-mail do usuário.', 'error'); return; }

  const btn = document.getElementById('btnAddAdmin');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    // Cria conta de admin pela rota de invite — informa que o usuário deve usar admin-register.html
    budToast('Para adicionar um admin, use a página admin-register.html com o código de convite.', 'info');
    ocultarAddAdmin();
    return;
  } catch(e) {
    budToast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Promover';
  }
};

window.removerAdmin = function(uid, nome) {
  confirmAction(`Remover admin ${nome || uid}? O documento será excluído da coleção admins.`, async () => {
    try {
      await deleteDoc(doc(db, 'admins', uid));
      budToast('Admin removido.');
      await loadAdmins();
    } catch(e) { budToast('Erro: ' + e.message, 'error'); }
  });
};

// ═══════════════════════════════════════════════════════════════
//  EXPOSE loadNotifications for refresh button
// ═══════════════════════════════════════════════════════════════
window.loadNotifications = loadNotifications;
window.loadAdmins        = loadAdmins;

