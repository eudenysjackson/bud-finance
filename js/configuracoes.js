// js/configuracoes.js — Bud Finance Configurações
// Auth guard + perfil + personalização + segurança
// Modular Firebase SDK v10.8.1

import { initializeApp }                from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, updateProfile }
                                        from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, updateDoc, collection, query, orderBy }
                                        from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase init ──────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Estado ─────────────────────────────────────────────────────────────
let uid = null;
let _skipThemeSync = false;

// ─── Helpers ────────────────────────────────────────────────────────────
function getIniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function formatarData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) { return '—'; }
}

function hoje() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Sidebar colapsável (mesmo padrão do dashboard) ─────────────────────
function setupSidebar() {
  const sidebar    = document.getElementById('sidebar');
  const overlay    = document.getElementById('sidebarOverlay');
  const btnHamburger = document.getElementById('btnHamburger');
  const btnCollapse  = document.getElementById('btnSidebarCollapse');
  const dashMain     = document.getElementById('dashMain');

  if (btnHamburger) {
    btnHamburger.addEventListener('click', function () {
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

  function applyCollapsed(collapsed) {
    if (collapsed) {
      sidebar.classList.add('collapsed');
      dashMain && dashMain.classList.add('sidebar-collapsed');
      if (btnCollapse) btnCollapse.textContent = '›';
    } else {
      sidebar.classList.remove('collapsed');
      dashMain && dashMain.classList.remove('sidebar-collapsed');
      if (btnCollapse) btnCollapse.textContent = '‹';
    }
  }

  const savedCollapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (window.innerWidth > 768) applyCollapsed(savedCollapsed);

  if (btnCollapse) {
    btnCollapse.addEventListener('click', function () {
      if (window.innerWidth <= 768) return;
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('bud_sidebar_collapsed', !isCollapsed);
      applyCollapsed(!isCollapsed);
    });
  }
}

// ─── Navegação por abas ─────────────────────────────────────────────────
function setupTabs() {
  const tabs = ['perfil', 'personalizacao', 'seguranca'];
  document.querySelectorAll('.cfg-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = btn.dataset.tab;
      tabs.forEach(function (t) {
        const panel = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        const tabBtn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        if (!panel || !tabBtn) return;
        const active = t === target;
        panel.style.display = active ? '' : 'none';
        tabBtn.classList.toggle('active', active);
        tabBtn.setAttribute('aria-selected', active);
      });
    });
  });
}

// ─── Renderizar bubbles de tema na aba Personalização ───────────────────
function renderThemeBubbles() {
  const container = document.getElementById('cfgThemeBubbles');
  if (!container) return;
  if (!window.budThemeManager) return;

  const themes = window.budThemeManager.themes;
  const current = window.budThemeManager.getCurrent();
  container.innerHTML = '';

  Object.keys(themes).forEach(function (key) {
    const t = themes[key];

    const bgValue = key === 'padrao'
      ? 'linear-gradient(135deg, #e2e8f0, #f8fafc)'
      : t.color;

    const wrap = document.createElement('div');
    wrap.className = 'cfg-theme-bubble-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.themeKey = key;
    btn.title = t.label;
    btn.setAttribute('aria-label', 'Tema ' + t.label);
    btn.setAttribute('aria-pressed', key === current ? 'true' : 'false');
    btn.style.cssText = [
      'width:36px', 'height:36px', 'border-radius:50%',
      'background:' + bgValue,
      'border:2px solid rgba(255,255,255,0.7)',
      'cursor:pointer', 'flex-shrink:0', 'padding:0',
      'transition:transform .15s ease, box-shadow .15s ease',
      'outline:none'
    ].join(';');

    if (key === current) {
      btn.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px ' + t.activeRing;
      btn.style.transform = 'scale(1.18)';
    }

    btn.addEventListener('click', function () {
      window.budThemeManager.apply(key);
      atualizarIndicadorTema();
    });

    const label = document.createElement('span');
    label.className = 'cfg-theme-label-text';
    label.textContent = t.label;

    wrap.appendChild(btn);
    wrap.appendChild(label);
    container.appendChild(wrap);
  });

  atualizarIndicadorTema();
}

// ─── Indicador de tema ativo ────────────────────────────────────────────
function atualizarIndicadorTema() {
  if (!window.budThemeManager) return;
  const current = window.budThemeManager.getCurrent();
  const themes  = window.budThemeManager.themes;
  const t       = themes[current];
  if (!t) return;

  const dot   = document.getElementById('cfgActiveDot');
  const label = document.getElementById('cfgActiveLabel');
  if (!dot || !label) return;

  const bgValue = current === 'padrao'
    ? 'linear-gradient(135deg, #e2e8f0, #f8fafc)'
    : t.color;

  dot.style.background = bgValue;
  label.textContent = 'Tema ' + t.label + ' ativo';

  // Atualizar aria-pressed nas bubbles
  document.querySelectorAll('#cfgThemeBubbles button[data-theme-key]').forEach(function (b) {
    const key = b.dataset.themeKey;
    b.setAttribute('aria-pressed', key === current ? 'true' : 'false');
  });
}

// ─── Salvar nome ────────────────────────────────────────────────────────
async function salvarNome() {
  const btn = document.getElementById('btnSalvarNome');
  const input = document.getElementById('perfilNome');
  if (!btn || !input) return;

  const user = auth.currentUser;
  if (!user) return;

  const novoNome = (window.budSanitize ? window.budSanitize(input.value) : input.value.trim()).trim();
  if (!novoNome) {
    if (window.budShowToast) window.budShowToast('O nome não pode estar vazio.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    await updateProfile(user, { displayName: novoNome });
    await updateDoc(doc(db, 'usuarios', user.uid), { nome: novoNome });

    // Atualiza sidebar imediatamente
    const avatar = document.getElementById('sidebarAvatar');
    const sName  = document.getElementById('sidebarUserName');
    if (avatar) avatar.textContent = getIniciais(novoNome);
    if (sName)  sName.textContent  = novoNome;

    if (window.budShowToast) window.budShowToast('Nome atualizado com sucesso!', 'success');
    btn.textContent = 'Salvo ✓';
    setTimeout(function () {
      btn.textContent = 'Salvar Alterações';
      btn.disabled = false;
    }, 3000);
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao salvar. Tente novamente.', 'error');
    btn.textContent = 'Salvar Alterações';
    btn.disabled = false;
  }
}

// ─── Exportar CSV ────────────────────────────────────────────────────────
async function exportarCSV() {
  const btn = document.getElementById('btnExportarCSV');
  if (!btn || !uid) return;

  btn.disabled = true;
  btn.textContent = 'Exportando...';

  try {
    const q = query(
      collection(db, 'usuarios', uid, 'transacoes'),
      orderBy('dataCriacao', 'desc')
    );
    const snap = await getDocs(q);

    const linhas = [
      ['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor (R$)']
    ];

    snap.docs.forEach(function (d) {
      const t = d.data();
      const dataTs = t.data
        ? (t.data.toDate ? t.data.toDate() : new Date(t.data))
        : (t.dataCriacao && t.dataCriacao.toDate ? t.dataCriacao.toDate() : new Date());
      const dataStr = dataTs.toLocaleDateString('pt-BR');
      const descricao = (t.descricao || '').replace(/"/g, '""');
      const categoria = (t.categoria || '').replace(/"/g, '""');
      const tipo = t.tipo === 'receita' ? 'Receita' : 'Despesa';
      const valor = typeof t.valor === 'number'
        ? (t.tipo === 'receita' ? t.valor : -t.valor).toFixed(2).replace('.', ',')
        : '0,00';
      linhas.push([dataStr, '"' + descricao + '"', tipo, '"' + categoria + '"', valor]);
    });

    const csvContent = linhas.map(function (l) { return l.join(';'); }).join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentos
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bud-finance-extrato.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.budShowToast) window.budShowToast(
      snap.size + ' transaç' + (snap.size === 1 ? 'ão exportada' : 'ões exportadas') + ' com sucesso!',
      'success'
    );
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao exportar. Tente novamente.', 'error');
  } finally {
    btn.textContent = 'Exportar CSV';
    btn.disabled = false;
  }
}

// ─── Carregar dados do perfil ───────────────────────────────────────────
async function carregarPerfil(user) {
  // Nome + email — Firebase Auth
  const nome  = window.budSanitize ? window.budSanitize(user.displayName || '') : (user.displayName || '');
  const email = user.email || '';

  const elNome  = document.getElementById('perfilNome');
  const elEmail = document.getElementById('perfilEmail');
  if (elNome)  elNome.value = nome || '';
  if (elEmail) elEmail.textContent = email || '—';

  // Sidebar
  const avatar = document.getElementById('sidebarAvatar');
  const sName  = document.getElementById('sidebarUserName');
  const sId    = document.getElementById('sidebarUserId');
  if (avatar) avatar.textContent = getIniciais(nome);
  if (sName)  sName.textContent  = nome || '—';
  if (sId)    sId.textContent    = email || '—'; // exibe email até matrícula carregar do Firestore

  // Data de criação
  const criacao = user.metadata && user.metadata.creationTime
    ? formatarData(user.metadata.creationTime)
    : '—';
  const elCriacao = document.getElementById('perfilCriacao');
  if (elCriacao) elCriacao.textContent = criacao;

  // Data de hoje
  const elDate = document.getElementById('welcomeDate');
  if (elDate) elDate.textContent = hoje();

  // Buscar dados no Firestore (matrícula, plano, tema)
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists()) {
      const data = snap.data();

      const matricula  = data.matricula  || '—';
      const plano      = data.plano      || 'free';
      const tema       = data.temaEscolhido;

      const elMatricula = document.getElementById('perfilMatricula');
      const elSideId    = document.getElementById('sidebarUserId');
      if (elMatricula) elMatricula.textContent = matricula;
      if (elSideId)    elSideId.textContent    = matricula;

      // Plano
      const planosLabel = { free: 'Gratuito', starter: 'Starter', pro: 'Pro', plus: 'Plus', trial: 'Período Trial' };
      const elPlanoNome = document.getElementById('planoNome');
      const elPlanoDesc = document.getElementById('planoDesc');
      if (elPlanoNome) elPlanoNome.textContent = planosLabel[plano] || 'Gratuito';
      if (elPlanoDesc) elPlanoDesc.textContent = plano === 'free'
        ? 'Plano gratuito ativo'
        : 'Assinatura ativa';

      // Aplicar tema salvo (evita flash)
      if (tema && window.budThemeManager) {
        _skipThemeSync = true;
        window.budThemeManager.apply(tema);
        _skipThemeSync = false;
        atualizarIndicadorTema();
      }
    }
  } catch (_) {
    // Firestore indisponível — exibe dados do Auth apenas
  }
}

// ─── Redefinir senha (via backend — mesmo fluxo de recuperar-senha.js) ──
function setupSeguranca() {
  const btnReset = document.getElementById('btnResetSenha');
  if (btnReset) {
    btnReset.addEventListener('click', async function () {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      btnReset.disabled = true;
      btnReset.textContent = 'Enviando...';

      const backendUrl = (window.BUD_FUNCTIONS_URL || '').replace(/\/$/, '');
      try {
        const res = await fetch(backendUrl + '/reset-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } catch (_) {
        // Continua mesmo com erro — anti-enumeração
      }

      // Sempre mostra sucesso (anti-enumeração)
      if (window.budShowToast) window.budShowToast(
        'Se este e-mail estiver cadastrado, você receberá um link. Verifique também o spam.',
        'success',
        4000
      );
      btnReset.textContent = 'Enviado ✓';
      setTimeout(function () {
        btnReset.textContent = 'Enviar link';
        btnReset.disabled = false;
      }, 4000);
    });
  }

  // Logout no tab segurança
  const btnLogoutSeg = document.getElementById('btnLogoutSeg');
  if (btnLogoutSeg) {
    btnLogoutSeg.addEventListener('click', fazerLogout);
  }

  // Logout no sidebar
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', fazerLogout);
  }
}

// ─── Logout ─────────────────────────────────────────────────────────────
async function fazerLogout() {
  try {
    await signOut(auth);
    window.location.href = 'index.html';
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao sair. Tente novamente.', 'error');
  }
}

// ─── Sync tema → Firestore ──────────────────────────────────────────────
document.addEventListener('bud:themechange', function (e) {
  if (!uid || _skipThemeSync) return;
  const name = e.detail && typeof e.detail.name === 'string' ? e.detail.name : 'padrao';
  updateDoc(doc(db, 'usuarios', uid), { temaEscolhido: name }).catch(function () {});
  atualizarIndicadorTema();
});

// ─── Auth guard ─────────────────────────────────────────────────────────
setupSidebar();
setupTabs();

onAuthStateChanged(auth, async function (user) {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Guard: email verificado
  if (!user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }

  uid = user.uid;

  await carregarPerfil(user);
  renderThemeBubbles();
  setupSeguranca();

  const btnSalvar = document.getElementById('btnSalvarNome');
  if (btnSalvar) btnSalvar.addEventListener('click', salvarNome);

  const btnCSV = document.getElementById('btnExportarCSV');
  if (btnCSV) btnCSV.addEventListener('click', exportarCSV);
});
