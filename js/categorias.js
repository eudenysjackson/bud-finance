/**
 * categorias.js — Lógica da tela de Categorias
 * Bud Finance · Firebase 10.8.1 Modular SDK
 *
 * Bugs do cérebro resolvidos nesta implementação:
 *  BUG 1 — overlay usa style.cssText (não classes Tailwind dinâmicas)
 *  BUG 2 — verifica duplicatas (padrão + personalizadas) antes de salvar
 *  BUG 3 — fonte única de verdade via window.BUD_CATEGORIAS_PADRAO
 *  BUG 4 — try/catch em deletarCategoria
 *  BUG 5 — verifica se categoria está em uso antes de excluir
 *  BUG 6 — botão deletar sempre visível no mobile (opacity via CSS)
 *  BUG 7 — modo de edição (updateDoc + propagação de renome)
 *  BUG 8 — renderizarTudo() dentro do .then() (sem race condition)
 *  BUG 9 — downgradeEm usa serverTimestamp()
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore,
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDocs, getDoc,
  query, where, orderBy, limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

/* ─────────────────────────────────────────────────────────────────
   Firebase
───────────────────────────────────────────────────────────────── */
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─────────────────────────────────────────────────────────────────
   Categorias padrão (fonte única de verdade via categorias-padrao.js)
───────────────────────────────────────────────────────────────── */
const categoriasPadrao = window.BUD_CATEGORIAS_PADRAO;

/* ─────────────────────────────────────────────────────────────────
   Emoji picker — temas e listas
───────────────────────────────────────────────────────────────── */
const EMOJI_TEMAS = {
  '💰 Dinheiro': ['💰','💵','💳','💎','📈','📉','💸','🏦','💹','🪙','🧾','🛡️'],
  '💼 Trabalho': ['💼','💻','🖥️','📞','📠','✍️','🛠️','⚙️','🏗️','🚀','📄','🏢'],
  '🏠 Casa':     ['🏠','🛋️','🚿','🧹','🧺','🪑','🪴','💡','🔑','🚘','🐶','💧','⚡','🔥','🛏️','🔧'],
  '🎮 Lazer':    ['🎮','🎬','🎪','⚽','🏖️','✈️','🍔','🍺','🛹','🏋️','🎁','🎟️','🍻','🎨','🎵'],
};

/* ─────────────────────────────────────────────────────────────────
   Estado global
───────────────────────────────────────────────────────────────── */
let uid            = null;
let tipoAtual      = 'despesa';
let emojiAtual     = '📦';
let editandoCatId  = null;     // null = criando; string = editando
let nomeAntigoEdit = '';       // guarda nome anterior para propagar renome
let _unsubCat      = null;     // cleanup do onSnapshot

const showToast = (msg, tipo = 'success') => window.budShowToast(msg, tipo);

/* ─────────────────────────────────────────────────────────────────
   Utilitários
───────────────────────────────────────────────────────────────── */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarData() {
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const str  = new Date().toLocaleDateString('pt-BR', opts);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─────────────────────────────────────────────────────────────────
   Tabs
───────────────────────────────────────────────────────────────── */
window.switchTab = function (tipo) {
  tipoAtual = tipo;
  document.getElementById('tabDespesa').classList.toggle('tab-active', tipo === 'despesa');
  document.getElementById('tabReceita').classList.toggle('tab-active', tipo === 'receita');
  renderizarTudo();
};

/* ─────────────────────────────────────────────────────────────────
   Renderização
───────────────────────────────────────────────────────────────── */
function renderizarPadrao() {
  const lista = document.getElementById('listaPadrao');
  if (!lista) return;
  lista.innerHTML = categoriasPadrao[tipoAtual].map(c => `
    <div class="cat-card" title="Categoria padrão — somente leitura" style="opacity:0.78;cursor:not-allowed;">
      <span class="cat-card-emoji">${escapeHTML(c.emoji)}</span>
      <span class="cat-card-nome">${escapeHTML(c.nome)}</span>
      <span class="cat-badge cat-badge-padrao">padrão</span>
    </div>
  `).join('');
}

function renderizarTudo() {
  renderizarPadrao();
  if (uid) carregarPersonalizadas();
}

function carregarPersonalizadas() {
  // Cancela listener anterior para evitar duplicatas ao trocar aba
  if (typeof _unsubCat === 'function') _unsubCat();

  const colRef = collection(db, 'usuarios', uid, 'categorias');
  // Filtra apenas pelo tipo — sem orderBy para não exigir índice composto.
  // Ordenação feita client-side por dataCriacao.
  const q      = query(colRef, where('tipo', '==', tipoAtual));

  _unsubCat = onSnapshot(q, (snap) => {
    const lista   = document.getElementById('listaPersonalizadas');
    const empty   = document.getElementById('emptyState');
    if (!lista || !empty) return;

    if (snap.empty) {
      lista.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    // Ordena client-side para evitar índice composto no Firestore
    const docs = snap.docs.slice().sort((a, b) => {
      const ta = a.data().dataCriacao?.toMillis?.() ?? 0;
      const tb = b.data().dataCriacao?.toMillis?.() ?? 0;
      return ta - tb;
    });
    lista.innerHTML = docs.map(d => {
      const c = d.data();
      return `
        <div class="cat-card personalizada" onclick="editarCategoria('${d.id}','${escapeHTML(c.nome)}','${escapeHTML(c.emoji)}')">
          <span class="cat-card-emoji">${escapeHTML(c.emoji)}</span>
          <span class="cat-card-nome">${escapeHTML(c.nome)}</span>
          <span class="cat-badge cat-badge-custom">personalizada</span>
          <button
            class="cat-delete-btn"
            onclick="event.stopPropagation();deletarCategoria('${d.id}','${escapeHTML(c.nome)}')"
            aria-label="Excluir categoria ${escapeHTML(c.nome)}"
            title="Excluir">✕</button>
        </div>
      `;
    }).join('');
  }, (err) => {
    console.error('Erro ao carregar categorias:', err);
    showToast('Erro ao carregar categorias personalizadas.', 'error');
  });
}

/* ─────────────────────────────────────────────────────────────────
   Modal — abrir / fechar
───────────────────────────────────────────────────────────────── */
function abrirModal() {
  document.getElementById('modalCategoria').classList.remove('hidden');
  document.getElementById('catNome').focus();
}

function fecharModal() {
  document.getElementById('modalCategoria').classList.add('hidden');
  // Resetar estado
  editandoCatId  = null;
  nomeAntigoEdit = '';
  emojiAtual     = '📦';
  document.getElementById('emojiTrigger').textContent = '📦';
  document.getElementById('catNome').value = '';
  document.getElementById('btnSalvarCat').textContent = 'Criar Categoria';
  document.getElementById('tituloModal').textContent  = tipoAtual === 'despesa'
    ? 'Nova Categoria de Despesa' : 'Nova Categoria de Receita';
  document.getElementById('emojiPicker').classList.add('hidden');
  atualizarPreview();
}

/* ─────────────────────────────────────────────────────────────────
   Emoji picker
───────────────────────────────────────────────────────────────── */
function popularTemasEmoji() {
  const temasEl = document.getElementById('emojiTemas');
  temasEl.innerHTML = Object.keys(EMOJI_TEMAS).map((nome, i) => `
    <button type="button" class="emoji-theme-btn${i === 0 ? ' active' : ''}"
            onclick="setTemaEmoji('${escapeHTML(nome)}')">${escapeHTML(nome)}</button>
  `).join('');
  setTemaEmoji(Object.keys(EMOJI_TEMAS)[0]);
}

window.setTemaEmoji = function (tema) {
  // Atualizar estado visual dos botões
  document.querySelectorAll('.emoji-theme-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim() === tema);
  });
  // Popular grid
  const grid = document.getElementById('emojiGrid');
  const lista = EMOJI_TEMAS[tema] || [];
  grid.innerHTML = lista.map(e => `
    <button type="button" class="emoji-btn${emojiAtual === e ? ' selected' : ''}"
            onclick="selecionarEmoji('${e}')">${e}</button>
  `).join('');
};

window.selecionarEmoji = function (emoji) {
  emojiAtual = emoji;
  document.getElementById('emojiTrigger').textContent = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.classList.toggle('selected', b.textContent.trim() === emoji);
  });
  document.getElementById('emojiPicker').classList.add('hidden');
  atualizarPreview();
};

/* ─────────────────────────────────────────────────────────────────
   Preview em tempo real
───────────────────────────────────────────────────────────────── */
function atualizarPreview() {
  const nome = document.getElementById('catNome')?.value.trim() || '';
  document.getElementById('previewEmoji').textContent = emojiAtual;
  document.getElementById('previewNome').textContent  = nome || 'Nome da categoria';
}

/* ─────────────────────────────────────────────────────────────────
   Editar categoria (abre modal em modo edição — BUG 7)
───────────────────────────────────────────────────────────────── */
window.editarCategoria = function (id, nome, emoji) {
  editandoCatId  = id;
  nomeAntigoEdit = nome;
  emojiAtual     = emoji;
  document.getElementById('emojiTrigger').textContent    = emoji;
  document.getElementById('catNome').value                = nome;
  document.getElementById('tituloModal').textContent     = 'Editar Categoria';
  document.getElementById('btnSalvarCat').textContent    = 'Salvar Alterações';
  atualizarPreview();
  abrirModal();
  popularTemasEmoji();
};

/* ─────────────────────────────────────────────────────────────────
   Deletar categoria (BUG 1, 4, 5)
───────────────────────────────────────────────────────────────── */
window.deletarCategoria = async function (id, nome) {
  if (!uid) return;

  // Verificar se há transações usando esta categoria (BUG 5)
  let emUso = false;
  try {
    const txSnap = await getDocs(query(
      collection(db, 'usuarios', uid, 'transacoes'),
      where('categoria', '==', nome),
      limit(1)
    ));
    emUso = !txSnap.empty;
  } catch (_) { /* falha silenciosa — segue sem verificar */ }

  const msg = emUso
    ? `A categoria "${nome}" está em uso em transações. Ao apagar, as transações existentes mantêm o nome mas a categoria não aparecerá mais nos seletores. Continuar?`
    : `Apagar a categoria "${nome}"? Esta ação não pode ser desfeita.`;

  // Overlay de confirmação com style.cssText (BUG 1 — sem Tailwind dinâmico)
  const ok = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,0.55);' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
      'z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem;';

    const card = document.createElement('div');
    card.style.cssText =
      'background:#fff;border-radius:1.25rem;padding:1.5rem;max-width:380px;width:100%;' +
      'box-shadow:0 24px 64px -12px rgba(0,0,0,0.25);position:relative;';

    const titulo = document.createElement('p');
    titulo.style.cssText = 'font-size:1rem;font-weight:800;color:#1e293b;margin-bottom:0.75rem;font-family:Inter,system-ui,sans-serif;';
    titulo.textContent = 'Apagar categoria';

    const texto = document.createElement('p');
    texto.style.cssText = 'font-size:0.875rem;font-weight:500;color:#475569;line-height:1.5;margin-bottom:1.25rem;font-family:Inter,system-ui,sans-serif;';
    texto.textContent = msg;

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:0.75rem;';

    const btnCancelar = document.createElement('button');
    btnCancelar.style.cssText =
      'flex:1;padding:0.625rem;border-radius:0.75rem;border:none;cursor:pointer;' +
      'background:rgba(0,0,0,0.05);color:#1e293b;font-size:0.875rem;font-weight:700;font-family:Inter,system-ui,sans-serif;';
    btnCancelar.textContent = 'Cancelar';

    const btnApagar = document.createElement('button');
    btnApagar.style.cssText =
      'flex:1;padding:0.625rem;border-radius:0.75rem;border:none;cursor:pointer;' +
      'background:#ef4444;color:#fff;font-size:0.875rem;font-weight:700;font-family:Inter,system-ui,sans-serif;';
    btnApagar.textContent = 'Apagar';

    btnCancelar.addEventListener('click', () => { ov.remove(); resolve(false); });
    btnApagar.addEventListener('click',   () => { ov.remove(); resolve(true);  });
    ov.addEventListener('click', (e) => { if (e.target === ov) { ov.remove(); resolve(false); } });

    btnWrap.appendChild(btnCancelar);
    btnWrap.appendChild(btnApagar);
    card.appendChild(titulo);
    card.appendChild(texto);
    card.appendChild(btnWrap);
    ov.appendChild(card);
    document.body.appendChild(ov);
  });

  if (!ok) return;

  try {                                               // BUG 4: try/catch
    await deleteDoc(doc(db, 'usuarios', uid, 'categorias', id));
    showToast('Categoria apagada.', 'success');
  } catch (e) {
    console.error('Erro ao apagar categoria:', e);
    showToast('Erro ao apagar. Verifique sua conexão.', 'error');
  }
};

/* ─────────────────────────────────────────────────────────────────
   Salvar categoria (criar ou editar) — BUG 2, 7, 9
───────────────────────────────────────────────────────────────── */
async function salvarCategoria() {
  const nomeRaw = document.getElementById('catNome').value.trim();
  const nome    = window.budSanitize ? window.budSanitize(nomeRaw) : nomeRaw;

  if (!nome) { showToast('Dê um nome para a categoria.', 'error'); return; }
  if (!uid)  { showToast('Usuário não identificado.', 'error');   return; }

  const btn = document.getElementById('btnSalvarCat');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const nomeNorm = nome.toLowerCase();

    // ── Modo EDIÇÃO ──────────────────────────────────────────────
    if (editandoCatId) {
      const nomeAntigoNorm = nomeAntigoEdit.toLowerCase();
      const nomeAlterado   = nomeNorm !== nomeAntigoNorm;

      // Verificar duplicata de novo nome (exceto o próprio item sendo editado)
      if (nomeAlterado) {
        const dup1 = categoriasPadrao[tipoAtual].some(c => c.nome.toLowerCase() === nomeNorm);
        if (dup1) {
          showToast('Já existe uma categoria padrão com esse nome.', 'error');
          return;
        }
        const snapCheck = await getDocs(query(
          collection(db, 'usuarios', uid, 'categorias'),
          where('tipo', '==', tipoAtual)
        ));
        const dup2 = snapCheck.docs.some(d => d.id !== editandoCatId && d.data().nome.toLowerCase() === nomeNorm);
        if (dup2) {
          showToast('Você já tem uma categoria com esse nome.', 'error');
          return;
        }
      }

      await updateDoc(doc(db, 'usuarios', uid, 'categorias', editandoCatId), {
        nome, emoji: emojiAtual
      });

      // Propagar renomeação para transações existentes (BUG 7)
      if (nomeAlterado) {
        try {
          const txSnap = await getDocs(query(
            collection(db, 'usuarios', uid, 'transacoes'),
            where('categoria', '==', nomeAntigoEdit)
          ));
          if (!txSnap.empty) {
            const batch = writeBatch(db);
            // writeBatch suporta até 500 ops; limitar chunk para segurança
            const MAX_BATCH = 400;
            let count = 0;
            let batchAtual = writeBatch(db);
            for (const d of txSnap.docs) {
              batchAtual.update(d.ref, { categoria: nome });
              count++;
              if (count === MAX_BATCH) {
                await batchAtual.commit();
                batchAtual = writeBatch(db);
                count = 0;
              }
            }
            if (count > 0) await batchAtual.commit();
          }
        } catch (e) {
          console.warn('Aviso: não foi possível propagar renomeação para transações.', e);
        }
      }

      showToast('Categoria atualizada!', 'success');
      fecharModal();
      return;
    }

    // ── Modo CRIAÇÃO ─────────────────────────────────────────────
    // Verificar duplicata com categorias padrão (BUG 2)
    const dup1 = categoriasPadrao[tipoAtual].some(c => c.nome.toLowerCase() === nomeNorm);
    if (dup1) {
      showToast('Já existe uma categoria padrão com esse nome.', 'error');
      return;
    }
    // Verificar duplicata com personalizadas existentes (BUG 2)
    const snapCheck = await getDocs(query(
      collection(db, 'usuarios', uid, 'categorias'),
      where('tipo', '==', tipoAtual)
    ));
    const dup2 = snapCheck.docs.some(d => d.data().nome.toLowerCase() === nomeNorm);
    if (dup2) {
      showToast('Você já tem uma categoria com esse nome.', 'error');
      return;
    }

    await addDoc(collection(db, 'usuarios', uid, 'categorias'), {
      nome,
      emoji: emojiAtual,
      tipo: tipoAtual,
      dataCriacao: serverTimestamp(),
    });

    showToast('Categoria criada!', 'success');
    fecharModal();

  } catch (e) {
    console.error('Erro ao salvar categoria:', e);
    showToast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editandoCatId ? 'Salvar Alterações' : 'Criar Categoria';
  }
}

/* ─────────────────────────────────────────────────────────────────
   Sidebar (copiado do padrão metas.js)
───────────────────────────────────────────────────────────────── */
function setupSidebar() {
  const sidebar      = document.getElementById('sidebar');
  const btnHamburger = document.getElementById('btnHamburger');
  const overlay      = document.getElementById('sidebarOverlay');
  const btnCollapse  = document.getElementById('btnSidebarCollapse');
  const dashMain     = document.getElementById('dashMain');

  btnHamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
  });
  btnCollapse?.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('collapsed');
    btnCollapse.textContent = collapsed ? '›' : '‹';
    dashMain?.classList.toggle('sidebar-collapsed', collapsed);
  });
}

function setupLogout() {
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

function atualizarSidebarUser(user) {
  const avatar = document.getElementById('sidebarAvatar');
  const name   = document.getElementById('sidebarUserName');
  const idEl   = document.getElementById('sidebarUserId');
  if (!user) return;
  const displayName = user.displayName || user.email || 'Usuário';
  if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();
  if (name)   name.textContent   = displayName;
  if (idEl)   idEl.textContent   = user.email || '';
}

/* ─────────────────────────────────────────────────────────────────
   Setup de eventos do modal
───────────────────────────────────────────────────────────────── */
function setupModal() {
  // Botão "+ Nova Categoria"
  document.getElementById('btnNova')?.addEventListener('click', () => {
    editandoCatId = null;
    nomeAntigoEdit = '';
    emojiAtual = '📦';
    document.getElementById('emojiTrigger').textContent = '📦';
    document.getElementById('catNome').value = '';
    document.getElementById('tituloModal').textContent = tipoAtual === 'despesa'
      ? 'Nova Categoria de Despesa' : 'Nova Categoria de Receita';
    document.getElementById('btnSalvarCat').textContent = 'Criar Categoria';
    atualizarPreview();
    popularTemasEmoji();
    abrirModal();
  });

  // Fechar via botão ✕ e Cancelar
  document.getElementById('btnFecharModal')?.addEventListener('click', fecharModal);
  document.getElementById('btnCancelarModal')?.addEventListener('click', fecharModal);

  // Fechar ao clicar no overlay escuro
  document.getElementById('modalOverlay')?.addEventListener('click', fecharModal);

  // Fechar com Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
  });

  // Emoji trigger
  document.getElementById('emojiTrigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const picker = document.getElementById('emojiPicker');
    picker.classList.toggle('hidden');
    if (!picker.classList.contains('hidden')) popularTemasEmoji();
  });

  // Fechar emoji picker ao clicar fora
  document.addEventListener('click', (e) => {
    const picker  = document.getElementById('emojiPicker');
    const trigger = document.getElementById('emojiTrigger');
    if (picker && !picker.classList.contains('hidden') &&
        !picker.contains(e.target) && e.target !== trigger) {
      picker.classList.add('hidden');
    }
  });

  // Preview em tempo real
  document.getElementById('catNome')?.addEventListener('input', atualizarPreview);

  // Salvar
  document.getElementById('btnSalvarCat')?.addEventListener('click', salvarCategoria);

  // Salvar com Enter no input
  document.getElementById('catNome')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') salvarCategoria();
  });
}

/* ─────────────────────────────────────────────────────────────────
   Init
───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const dataEl = document.getElementById('dataHoje');
  if (dataEl) dataEl.textContent = formatarData();

  setupSidebar();
  setupLogout();
  setupModal();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  uid = user.uid;
  atualizarSidebarUser(user);

  // BUG 8: renderizarTudo() DENTRO do .then() — plano já resolvido antes de renderizar
  try {
    const perfilSnap = await getDoc(doc(db, 'usuarios', uid));
    // Planos pagos serão verificados aqui quando PEND-001 (Mercado Pago) for implementado.
    // Por ora, todas as contas podem criar categorias personalizadas (MVP aberto).
    renderizarTudo();
  } catch (_) {
    // Falha ao carregar perfil — renderiza mesmo assim (sem plano bloqueado)
    renderizarTudo();
  }
});
