// js/configuracoes.js — Bud Finance Configurações
// Auth guard + perfil + personalização + segurança
// Modular Firebase SDK v10.8.1

import { initializeApp }                from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, updateProfile }
                                        from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, updateDoc, deleteDoc, deleteField, setDoc, collection, query, orderBy, writeBatch }
                                        from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase init ──────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Estado ─────────────────────────────────────────────────────────────
let uid = null;
let _skipThemeSync = false;let _userPlano = 'free';
let _whatsappNumero = null;
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

// ─── Foto de Perfil ─────────────────────────────────────────────────────
function aplicarFotoAvatar(photoURL, nome) {
  const imgEl      = document.getElementById('avatarImg');
  const initEl     = document.getElementById('avatarDisplay');
  const sideAvatar = document.getElementById('sidebarAvatar');

  if (photoURL) {
    if (imgEl)  { imgEl.src = photoURL; imgEl.style.display = 'block'; }
    if (initEl) { initEl.style.display = 'none'; }
    if (sideAvatar) {
      sideAvatar.innerHTML = '';
      const img = document.createElement('img');
      img.src = photoURL;
      img.alt = 'Foto de perfil';
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
      sideAvatar.appendChild(img);
    }
  } else {
    if (imgEl)  { imgEl.style.display = 'none'; }
    if (initEl) { initEl.style.display = 'flex'; initEl.textContent = getIniciais(nome); }
    if (sideAvatar) { sideAvatar.innerHTML = ''; sideAvatar.textContent = getIniciais(nome); }
  }

  const nomeEl = document.getElementById('avatarNomeExibido');
  if (nomeEl) nomeEl.textContent = nome || '—';
}

function setupFotoPerfil() {
  const btnFoto   = document.getElementById('btnFotoPerfil');
  const inputFile = document.getElementById('inputFotoPerfil');
  if (!btnFoto || !inputFile) return;

  btnFoto.addEventListener('click', function () { inputFile.click(); });

  inputFile.addEventListener('change', async function () {
    const file = inputFile.files && inputFile.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (window.budShowToast) window.budShowToast('Arquivo inválido. Use JPG, PNG ou WebP.', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (window.budShowToast) window.budShowToast('Imagem muito grande. Máximo 5 MB.', 'warning');
      return;
    }

    const spinner = document.getElementById('avatarSpinner');
    if (spinner) spinner.classList.add('visible');
    btnFoto.disabled = true;

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Não autenticado');

      // Import dinâmico para não bloquear o módulo se Storage não estiver disponível
      const { getStorage, ref: sRef, uploadBytes, getDownloadURL } =
        await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js');
      const storageInst = getStorage(app);

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const fileRef = sRef(storageInst, 'avatars/' + user.uid + '/avatar.' + ext);
      const snap = await uploadBytes(fileRef, file, { contentType: file.type });
      const url  = await getDownloadURL(snap.ref);

      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(db, 'usuarios', user.uid), { photoURL: url });

      aplicarFotoAvatar(url, user.displayName || '');
      if (window.budShowToast) window.budShowToast('Foto atualizada com sucesso!', 'success');
    } catch (_) {
      if (window.budShowToast) window.budShowToast('Erro ao enviar foto. Tente novamente.', 'error');
    } finally {
      if (spinner) spinner.classList.remove('visible');
      btnFoto.disabled = false;
      inputFile.value = '';
    }
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
    if (!user.photoURL && avatar) avatar.textContent = getIniciais(novoNome);
    if (sName)  sName.textContent  = novoNome;

    // Atualiza nome exibido no card de foto
    const nomeEl = document.getElementById('avatarNomeExibido');
    if (nomeEl) nomeEl.textContent = novoNome;

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

// ─── WhatsApp vincular / desvincular ───────────────────────────────────────
const PLANOS_WHATSAPP = ['plus', 'pro', 'trial'];

function formatarTelBR(numero) {
  const s = String(numero || '').replace(/\D/g, '');
  const local = s.startsWith('55') ? s.slice(2) : s;
  if (local.length === 11) return '(' + local.slice(0, 2) + ') ' + local.slice(2, 7) + '-' + local.slice(7);
  if (local.length === 10) return '(' + local.slice(0, 2) + ') ' + local.slice(2, 6) + '-' + local.slice(6);
  return numero;
}

function carregarWhatsApp() {
  const gate   = document.getElementById('whatsappGate');
  const conect = document.getElementById('whatsappConectado');
  const descon = document.getElementById('whatsappDesconectado');
  if (!gate || !conect || !descon) return;

  if (!PLANOS_WHATSAPP.includes(_userPlano)) {
    gate.style.display   = 'block';
    conect.style.display = 'none';
    descon.style.display = 'none';
    return;
  }

  gate.style.display = 'none';
  if (_whatsappNumero) {
    conect.style.display = 'block';
    descon.style.display = 'none';
    const el = document.getElementById('whatsappNumeroExibido');
    if (el) el.textContent = formatarTelBR(_whatsappNumero);
  } else {
    conect.style.display = 'none';
    descon.style.display = 'block';
  }
}

async function vincularWhatsApp() {
  const input = document.getElementById('inputWhatsApp');
  const btn   = document.getElementById('btnVincularWhatsApp');
  if (!input || !btn || !uid) return;

  const raw = input.value.replace(/\D/g, '');
  if (raw.length < 10 || raw.length > 11) {
    if (window.budShowToast) window.budShowToast('Número inválido. Use DDD + número (ex: 11 99999-9999).', 'warning');
    return;
  }
  const numero = '55' + raw;

  btn.disabled = true;
  btn.textContent = 'Vinculando...';
  try {
    await updateDoc(doc(db, 'usuarios', uid), { whatsappVinculado: numero });
    _whatsappNumero = numero;
    carregarWhatsApp();
    if (window.budShowToast) window.budShowToast('WhatsApp vinculado com sucesso!', 'success');
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao vincular. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Vincular';
  }
}

async function desvincularWhatsApp() {
  if (!uid) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);z-index:300;display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:var(--bg-page,#fff);border-radius:1.25rem;padding:1.75rem 1.5rem;max-width:380px;width:100%;border:1px solid var(--card-border,#e2e8f0);box-shadow:0 24px 64px rgba(0,0,0,.25);">'
    + '<div style="font-size:1.5rem;text-align:center;margin-bottom:.625rem;">💬</div>'
    + '<h3 style="font-weight:800;font-size:1rem;text-align:center;margin:0 0 .5rem;color:var(--card-text,#1e293b);">Desvincular WhatsApp?</h3>'
    + '<p style="font-size:.8125rem;color:var(--card-text-sec,#64748b);text-align:center;margin:0 0 1.25rem;line-height:1.5;">Você deixará de receber alertas via WhatsApp.</p>'
    + '<div style="display:flex;gap:.75rem;">'
    + '<button id="_waCancelar" class="cfg-btn cfg-btn-secondary" style="flex:1;">Cancelar</button>'
    + '<button id="_waConfirmar" class="cfg-btn cfg-btn-danger" style="flex:1;">Desvincular</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  document.getElementById('_waCancelar').onclick = function () { ov.remove(); };
  document.getElementById('_waConfirmar').onclick = async function () {
    ov.remove();
    try {
      await updateDoc(doc(db, 'usuarios', uid), { whatsappVinculado: deleteField() });
      _whatsappNumero = null;
      carregarWhatsApp();
      if (window.budShowToast) window.budShowToast('WhatsApp desvinculado.', 'success');
    } catch (_) {
      if (window.budShowToast) window.budShowToast('Erro ao desvincular. Tente novamente.', 'error');
    }
  };
}

// ─── Revogar Consentimento de Notificações (LGPD Art. 8) ─────────────────
async function revogarConsentimentoNotificacoes() {
  if (!uid) return;
  const btn = document.getElementById('btnRevogarNotificacoes');
  if (btn) { btn.disabled = true; btn.textContent = 'Revogando...'; }
  try {
    const tokenRef = doc(db, 'usuarios', uid, 'tokens', 'fcm');
    await setDoc(tokenRef, { token: null, revogadoEm: new Date().toISOString() }, { merge: true });
    if (window.budShowToast) window.budShowToast('Consentimento de notificações revogado.', 'success');
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao revogar. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Revogar'; }
  }
}

// ─── Exportar Dados Completos (JSON — LGPD PEND-005) ────────────────────
async function exportarDadosJSON() {
  const btn = document.getElementById('btnExportarJSON');
  if (!btn || !uid) return;

  btn.disabled = true;
  btn.textContent = 'Exportando...';

  try {
    const COLECOES = [
      'transacoes', 'carteira', 'cartoes', 'metas',
      'limites', 'categorias', 'recorrentes', 'dividas', 'investimentos'
    ];

    const [perfilSnap, ...colSnaps] = await Promise.all([
      getDoc(doc(db, 'usuarios', uid)),
      ...COLECOES.map(col => getDocs(collection(db, 'usuarios', uid, col)))
    ]);

    // Replacer para serializar Timestamps do Firestore como ISO string
    function replacer(_key, value) {
      if (value && typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
      }
      if (value && typeof value === 'object' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        return new Date(value.seconds * 1000).toISOString();
      }
      return value;
    }

    const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
    // Não exportar campos internos de plano/pagamento (não são dados pessoais do usuário)
    const { fcmToken: _f, assinatura: _a, ...perfilPublico } = perfilData;

    const exportacao = {
      gerado_em: new Date().toISOString(),
      app: 'Bud Finance',
      perfil: perfilPublico,
      dados: {}
    };

    COLECOES.forEach((col, i) => {
      exportacao.dados[col] = colSnaps[i].docs.map(d => ({ id: d.id, ...d.data() }));
    });

    const blob = new Blob(
      [JSON.stringify(exportacao, replacer, 2)],
      { type: 'application/json;charset=utf-8;' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bud-finance-meus-dados-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const total = COLECOES.reduce((s, _, i) => s + colSnaps[i].size, 0);
    if (window.budShowToast) window.budShowToast(
      total + ' registro' + (total !== 1 ? 's' : '') + ' exportado' + (total !== 1 ? 's' : '') + ' com sucesso!',
      'success'
    );
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao exportar dados. Tente novamente.', 'error');
  } finally {
    btn.textContent = 'Exportar JSON';
    btn.disabled = false;
  }
}

// ─── Excluir Conta Permanentemente (LGPD PEND-007) ──────────────────────
function abrirModalExcluirConta() {
  const modal = document.getElementById('modalExcluirConta');
  const input = document.getElementById('confirmacaoExcluir');
  const btnConf = document.getElementById('btnConfirmarExcluir');
  if (!modal) return;
  if (input) input.value = '';
  if (btnConf) btnConf.disabled = true;
  modal.style.display = 'flex';
  setTimeout(function () { if (input) input.focus(); }, 50);
}

function fecharModalExcluirConta() {
  const modal = document.getElementById('modalExcluirConta');
  if (modal) modal.style.display = 'none';
}

async function confirmarExcluirConta() {
  const input = document.getElementById('confirmacaoExcluir');
  if (!input || input.value.trim().toUpperCase() !== 'EXCLUIR') return;

  const btnConf = document.getElementById('btnConfirmarExcluir');
  if (btnConf) { btnConf.disabled = true; btnConf.textContent = 'Excluindo...'; }

  const COLECOES = [
    'transacoes', 'carteira', 'cartoes', 'metas',
    'limites', 'categorias', 'recorrentes', 'dividas', 'investimentos',
    'compras', 'listas-compras', 'tokens', 'notificacoes_eventos_enviadas'
  ];

  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');

    // Coletar todas as referências a deletar
    const refs = [];
    for (const col of COLECOES) {
      try {
        const snap = await getDocs(collection(db, 'usuarios', uid, col));
        snap.docs.forEach(d => refs.push(d.ref));
      } catch (_) { /* coleção pode não existir */ }
    }
    // Documento principal do usuário
    refs.push(doc(db, 'usuarios', uid));

    // Deletar em batches de 400
    const CHUNK = 400;
    for (let i = 0; i < refs.length; i += CHUNK) {
      const batch = writeBatch(db);
      refs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // Deletar conta do Firebase Auth
    await user.delete();

    fecharModalExcluirConta();
    window.location.href = 'index.html';

  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      fecharModalExcluirConta();
      if (window.budShowToast) window.budShowToast(
        'Por segurança, faça login novamente antes de excluir a conta.',
        'warning',
        5000
      );
      setTimeout(async function () {
        await signOut(auth);
        window.location.href = 'index.html';
      }, 2500);
    } else {
      if (btnConf) { btnConf.disabled = false; btnConf.textContent = 'Confirmar Exclusão'; }
      if (window.budShowToast) window.budShowToast('Erro ao excluir conta. Tente novamente.', 'error');
    }
  }
}


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

  // Avatar do card
  aplicarFotoAvatar(user.photoURL || null, nome);

  const elNome  = document.getElementById('perfilNome');
  const elEmail = document.getElementById('perfilEmail');
  if (elNome)  elNome.value = nome || '';
  if (elEmail) elEmail.textContent = email || '—';

  // Sidebar
  const avatar = document.getElementById('sidebarAvatar');
  const sName  = document.getElementById('sidebarUserName');
  const sId    = document.getElementById('sidebarUserId');
  if (!user.photoURL && avatar) avatar.textContent = getIniciais(nome);
  if (sName)  sName.textContent  = nome || '—';
  if (sId)    sId.textContent    = email || '—'; // exibe email até matrícula carregar do Firestore

  // Data de criação
  const criacao = user.metadata && user.metadata.creationTime
    ? formatarData(user.metadata.creationTime)
    : '—';
  const elCriacao = document.getElementById('perfilCriacao');
  if (elCriacao) elCriacao.textContent = criacao;

  // Último acesso (tab Segurança)
  const elUltimoAcesso = document.getElementById('ultimoAcesso');
  if (elUltimoAcesso && user.metadata && user.metadata.lastSignInTime) {
    elUltimoAcesso.textContent = formatarData(user.metadata.lastSignInTime);
  }

  // Loading state enquanto Firestore carrega
  const elPlanoDescLoad = document.getElementById('planoDesc');
  if (elPlanoDescLoad) elPlanoDescLoad.textContent = 'Carregando...';

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

      // Badge colorido do plano
      const PLANO_BADGE_COLORS = { free: '#94a3b8', starter: '#3b82f6', plus: '#7c3aed', pro: '#d97706', trial: '#059669' };
      const elBadge = document.getElementById('planoBadge');
      if (elBadge) {
        const badgeBg = PLANO_BADGE_COLORS[plano] || '#94a3b8';
        elBadge.textContent = planosLabel[plano] || 'Gratuito';
        elBadge.style.cssText = 'display:inline-block;font-size:0.625rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:9999px;text-transform:uppercase;letter-spacing:0.04em;background:' + badgeBg + ';color:#fff;margin-left:0.25rem;vertical-align:middle;';
      }

      // Data de expiração do plano (Trial/Plus/Pro)
      const elExpira = document.getElementById('planoExpira');
      if (elExpira && data.assinaturaExpira) {
        try {
          const expDate = data.assinaturaExpira.toDate ? data.assinaturaExpira.toDate() : new Date(data.assinaturaExpira);
          elExpira.textContent = 'Válido até ' + expDate.toLocaleDateString('pt-BR');
          elExpira.style.display = 'block';
        } catch (_) {}
      }

      // Armazenar plano e whatsapp para uso nas seções correspondentes
      _userPlano = plano.toLowerCase();
      _whatsappNumero = data.whatsappVinculado || null;
      carregarWhatsApp();

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

// ─── Resetar Toda a Conta (PEND-008) ────────────────────────────────────
function abrirModalReset() {
  const modal = document.getElementById('modalResetarConta');
  if (!modal) return;
  modal.style.display = 'flex';
  setTimeout(function () {
    const btnFechar = document.getElementById('btnFecharModalReset');
    if (btnFechar) btnFechar.focus();
  }, 50);
}

function fecharModalReset() {
  const modal = document.getElementById('modalResetarConta');
  if (modal) modal.style.display = 'none';
}

async function executarReset() {
  const btnConf = document.getElementById('btnConfirmarReset');
  if (btnConf) { btnConf.disabled = true; btnConf.textContent = 'Resetando...'; }

  const COLECOES = [
    'transacoes', 'carteira', 'cartoes', 'metas',
    'limites', 'categorias', 'recorrentes', 'dividas', 'investimentos',
    'compras', 'listas-compras', 'tokens', 'notificacoes_eventos_enviadas'
  ];

  try {
    const refs = [];
    for (const col of COLECOES) {
      try {
        const snap = await getDocs(collection(db, 'usuarios', uid, col));
        snap.docs.forEach(d => refs.push(d.ref));
      } catch (_) { /* coleção pode não existir */ }
    }

    const CHUNK = 400;
    for (let i = 0; i < refs.length; i += CHUNK) {
      const batch = writeBatch(db);
      refs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // Marcar onboarding como não concluído (mantém conta ativa)
    await updateDoc(doc(db, 'usuarios', uid), { onboardingConcluido: false });

    // Limpar chaves de tutorial do localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('nexo_tutorial_done_'))
      .forEach(k => localStorage.removeItem(k));

    fecharModalReset();
    window.location.href = 'dashboard.html';

  } catch (err) {
    if (btnConf) { btnConf.disabled = false; btnConf.textContent = 'Sim, resetar tudo'; }
    if (window.budShowToast) window.budShowToast('Erro ao resetar conta. Tente novamente.', 'error');
  }
}

// ─── Reiniciar Tutorial ──────────────────────────────────────────────────
async function reiniciarTutorial() {
  const btn = document.getElementById('btnReiniciarTutorial');
  if (!btn || !uid) return;
  btn.disabled = true;
  btn.textContent = 'Reiniciando...';

  try {
    // Limpar chaves do localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('nexo_tutorial_done_'))
      .forEach(k => localStorage.removeItem(k));

    // Marcar onboarding como não concluído no Firestore
    await updateDoc(doc(db, 'usuarios', uid), { onboardingConcluido: false });

    if (window.budShowToast) window.budShowToast('Tutorial reiniciado! Ele aparecerá na próxima vez que você acessar cada tela.', 'success', 4000);
  } catch (_) {
    if (window.budShowToast) window.budShowToast('Erro ao reiniciar tutorial.', 'error');
  } finally {
    btn.textContent = '🔄 Reiniciar Tutorial';
    btn.disabled = false;
  }
}

// ─── Segurança ───────────────────────────────────────────────────────────
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
  setupFotoPerfil();

  const btnSalvar = document.getElementById('btnSalvarNome');
  if (btnSalvar) btnSalvar.addEventListener('click', salvarNome);

  const btnCSV = document.getElementById('btnExportarCSV');
  if (btnCSV) btnCSV.addEventListener('click', exportarCSV);

  const btnJSON = document.getElementById('btnExportarJSON');
  if (btnJSON) btnJSON.addEventListener('click', exportarDadosJSON);

  const btnExcluir = document.getElementById('btnExcluirConta');
  if (btnExcluir) btnExcluir.addEventListener('click', abrirModalExcluirConta);

  const btnFecharExcluir = document.getElementById('btnFecharModalExcluir');
  if (btnFecharExcluir) btnFecharExcluir.addEventListener('click', fecharModalExcluirConta);

  const btnConfirmar = document.getElementById('btnConfirmarExcluir');
  if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarExcluirConta);

  const inputConf = document.getElementById('confirmacaoExcluir');
  if (inputConf) {
    inputConf.addEventListener('input', function () {
      const btnConf = document.getElementById('btnConfirmarExcluir');
      if (btnConf) btnConf.disabled = inputConf.value.trim().toUpperCase() !== 'EXCLUIR';
    });
  }

  const btnResetar = document.getElementById('btnResetarConta');
  if (btnResetar) btnResetar.addEventListener('click', abrirModalReset);

  const btnFecharReset = document.getElementById('btnFecharModalReset');
  if (btnFecharReset) btnFecharReset.addEventListener('click', fecharModalReset);

  const btnConfReset = document.getElementById('btnConfirmarReset');
  if (btnConfReset) btnConfReset.addEventListener('click', executarReset);

  const btnTutorial = document.getElementById('btnReiniciarTutorial');
  if (btnTutorial) btnTutorial.addEventListener('click', reiniciarTutorial);

  const btnVincular = document.getElementById('btnVincularWhatsApp');
  if (btnVincular) btnVincular.addEventListener('click', vincularWhatsApp);

  const btnDesvincular = document.getElementById('btnDesvincularWhatsApp');
  if (btnDesvincular) btnDesvincular.addEventListener('click', desvincularWhatsApp);

  const btnRevogar = document.getElementById('btnRevogarNotificacoes');
  if (btnRevogar) btnRevogar.addEventListener('click', revogarConsentimentoNotificacoes);
});
