/**
 * js/mercado.js — Compras de Mercado / Listas / Histórico de Preços
 *
 * Bud Finance · ES Module · Firebase 10.8.1
 *
 * Bugs do cérebro/mercado.md corrigidos desde o início:
 *  BUG 1  — overlays usam style.cssText (não classes Tailwind dinâmicas)
 *  BUG 2  — writeBatch atômico para compra + transação(ões)
 *  BUG 3  — categoria majoritária (nunca "Mercado" hardcoded)
 *  BUG 4  — sem prompt() nativo; sem detecção de "ingressos" (fora do escopo)
 *  BUG 5  — vínculo compra↔transações via campo compraId (não por includes())
 *  BUG 6  — onSnapshot (tempo real) em vez de getDocs
 *  BUG 7  — primeira parcela absorve resto de centavos
 *  BUG 8  — extrairDataRef normaliza string|Timestamp
 *  BUG 9  — exclusão também via compraId
 *  BUG 10 — cleanup de state ao trocar usuário
 *  BUG 11 — resumo e lista alinhados (lista mostra mês atual + filtro "todas")
 *  BUG 12 — adicionar item rápido = input inline (sem prompt)
 *  BUG 13 — fallback de chips de pagamento se carteira falhar
 *  BUG 14 — função única para envio à IA (preparada para fase 2)
 *  BUG 15 — paginação com "Ver mais"
 *  BUG 16 — pagIcons constante única
 *  BUG 17 — sugestões via data-attr + delegação (sem injetar nome em onclick)
 *  BUG 18 — limits unificados via constante
 *
 * Coleções Firestore:
 *  - usuarios/{uid}/compras
 *  - usuarios/{uid}/listas-compras
 *  - usuarios/{uid}/transacoes  (cria despesa(s) vinculada(s) com compraId)
 *  - usuarios/{uid}/cartoes     (lê para chip "Crédito")
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, orderBy, limit, where,
  onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs,
  writeBatch, serverTimestamp, getDoc, setDoc, increment,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase init ───────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Constantes ──────────────────────────────────────────────────
const QUERY_LIMIT = 100;         // BUG 18: limite único
const PAGE_SIZE   = 20;          // BUG 15: paginação
const PAG_ICONS   = {            // BUG 16: ícones em um lugar só
  'Débito': '💳', 'Crédito': '💳', 'PIX': '⚡', 'Dinheiro': '💵', 'VA/VR': '🍽️'
};
const FORMAS_PAGAMENTO_FALLBACK = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'VA/VR'];

// ─── IA: backend, limites por plano, categorias permitidas ───────
const BUD_BACKEND_URL = (window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/, '');
const IA_TIMEOUT_MS = 60000;
const IA_MAX_FILES  = 3;
const IA_MAX_SIZE_MB = 8;
const IA_LIMITES_PLANO = { free: 5, starter: 30, plus: 9999, pro: 9999, trial: 30 };
const CATEGORIAS_IA = ['Mercado','Padaria/Café','Bares/Baladas','Farmácia','Pets','Material Escolar','Outros'];

// ─── Estado global ───────────────────────────────────────────────
let currentUser  = null;
let comprasCache = [];
let listasCache  = [];
let cartoesCache = [];
let carteirasCache = [];        // usuarios/{uid}/carteira/  (conta corrente, cartões, vales, dinheiro)
let abaAtual     = 'compras';     // 'compras' | 'listas'
let paginaCompras = 1;            // BUG 15
let _unsubs      = [];
let _salvando    = false;         // anti-duplo-submit
let _itensCompra = [];            // itens do modal Nova Compra
let _itensLista  = [];            // itens do modal Nova Lista
let _modoListaId = null;          // lista aberta no Modo Compras
let _modoItens   = [];            // cópia editável durante o Modo Compras

// ─── Estado IA ───────────────────────────────────────────────────
let _planoUsuario = 'free';
let _usoIAMes     = 0;            // contador do mês atual
let _iaArquivos   = [];           // [{file, url}] no modal Import
let _iaTabAtual   = 'foto';       // foto | pdf | texto
let _iaResultado  = null;         // { mercado, cnpj, data, itens[] }
let _iaItensReview = [];          // cópia editável na tela Review
let _aprendizadoCacheCarregado = false;
let _aprendizadoCache = {};       // { itemKey: 'CategoriaCorrigida' }
let _mercadosConhecidos = {};     // { cnpj: 'Nome curto' }

// ─── Helpers (texto, moeda, data) ────────────────────────────────
const escapeHTML = (typeof window.budEscapeHTML === 'function')
  ? window.budEscapeHTML
  : (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const sanitize = (typeof window.budSanitize === 'function')
  ? window.budSanitize
  : (s) => String(s ?? '').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();

const showToast = (msg, type) =>
  (typeof window.budShowToast === 'function')
    ? window.budShowToast(msg, type || 'info')
    : alert(msg);

const log   = window.budLog   || function(){};
const warn  = window.budWarn  || console.warn;
const error = window.budError || console.error;

function formatBRL(v) {
  const n = Number(v);
  return 'R$ ' + (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseBRL(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? 0 : n;
}
function aplicarMascaraValor(input) {
  let raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  const num = parseInt(raw, 10);
  const reais    = Math.floor(num / 100);
  const centavos = num % 100;
  input.value = reais.toLocaleString('pt-BR') + ',' + String(centavos).padStart(2,'0');
}
function aplicarMascaraData(input) {
  let v = input.value.replace(/\D/g,'');
  if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2);
  if (v.length > 5) v = v.substring(0,5) + '/' + v.substring(5,9);
  input.value = v;
}
function parseDataBR(str) {
  if (!str || str.length < 8) return null;
  const [d,m,a] = str.split('/').map(Number);
  if (!d || !m || !a || a < 1900 || a > 2100) return null;
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function formatDataBR(iso) {
  if (!iso) return '';
  const [a,m,d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hojeBR() {
  return formatDataBR(hojeISO());
}
// BUG 8: normaliza string ISO ou Timestamp do Firestore
function extrairDataRef(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toDate) {
    const d = val.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return '';
}

// ─── Categorias dos itens (heurística simples) ───────────────────
// Mapeia palavras-chave → nome de categoria padrão (usado no BUG 3)
const KEYWORDS_CAT = [
  { re: /shampoo|sab[oõ]nete|creme|escova|pasta|absorvente|fralda|higiene|perfume|desodorante/i, cat: 'Farmácia' },
  { re: /rem[eé]dio|comprimido|paracetamol|dipirona|antialerg/i, cat: 'Farmácia' },
  { re: /caderno|caneta|l[aá]pis|papel|borracha|estojo|mochila/i, cat: 'Material Escolar' },
  { re: /ra[çc][aã]o|petisco|areia.*gato|coleira/i, cat: 'Pets' },
  { re: /bebida|cerveja|vinho|whisky|vodka|destilado/i, cat: 'Bares/Baladas' },
  { re: /p[aã]o|caf[eé]|leite|biscoito|bolacha|bolo/i, cat: 'Padaria/Café' },
];

function inferirCategoriaItem(nome) {
  if (!nome) return 'Mercado';
  for (const k of KEYWORDS_CAT) {
    if (k.re.test(nome)) return k.cat;
  }
  return 'Mercado';
}

// BUG 3: categoria majoritária por valor (não por contagem)
function categoriaMajoritaria(itens) {
  if (!itens || !itens.length) return 'Mercado';
  const peso = {};
  itens.forEach(i => {
    const c = i.cat || inferirCategoriaItem(i.desc || i.nome);
    peso[c] = (peso[c] || 0) + (Number(i.valor) || 0);
  });
  const ord = Object.entries(peso).sort((a,b) => b[1] - a[1]);
  return ord[0]?.[0] || 'Mercado';
}

// ─── Cleanup auth state (BUG 10) ─────────────────────────────────
function resetState() {
  comprasCache = [];
  listasCache  = [];
  cartoesCache = [];
  carteirasCache = [];
  paginaCompras = 1;
  _itensCompra = [];
  _itensLista  = [];
  _modoListaId = null;
  _modoItens   = [];
  _iaArquivos.forEach(a => { try { URL.revokeObjectURL(a.url); } catch(e){} });
  _iaArquivos = [];
  _iaResultado = null;
  _iaItensReview = [];
  _aprendizadoCache = {};
  _aprendizadoCacheCarregado = false;
  _mercadosConhecidos = {};
  _planoUsuario = 'free';
  _usoIAMes = 0;
  _filtroBusca  = '';
  _filtroMes    = '';
  _filtroForma  = '';
  if (_graficoDonutInst) { try { _graficoDonutInst.destroy(); } catch(e){} _graficoDonutInst = null; }
  _detalheCompraAtual = null;
  _listaBusca = '';
  _listasHistExpand = false;
  _pendenteTotalGasto = 0;
  _unsubs.forEach(u => { try { u(); } catch(e){} });
  _unsubs = [];
}

// ─── Sidebar / hamburger ─────────────────────────────────────────
function setupSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const main     = document.getElementById('dashMain');
  const btnHam   = document.getElementById('btnHamburger');
  const btnColl  = document.getElementById('btnSidebarCollapse');

  if (btnHam) btnHam.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  });
  if (overlay) overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
  if (btnColl) btnColl.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed', collapsed);
    btnColl.textContent = collapsed ? '›' : '‹';
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    try { await signOut(auth); } catch(e) { error('logout', e); }
  });
}

// ─── Tabs ────────────────────────────────────────────────────────
function setupTabs() {
  const btnC = document.getElementById('tabCompras');
  const btnL = document.getElementById('tabListas');
  const paneC = document.getElementById('paneCompras');
  const paneL = document.getElementById('paneListas');
  const btnPrincipal = document.getElementById('btnPrincipal');
  const btnLabel = document.getElementById('btnPrincipalLabel');

  function setAba(aba) {
    abaAtual = aba;
    if (aba === 'compras') {
      btnC.classList.add('active'); btnC.setAttribute('aria-selected','true');
      btnL.classList.remove('active'); btnL.setAttribute('aria-selected','false');
      paneC.style.display = ''; paneL.style.display = 'none';
      btnLabel.textContent = 'Nova Compra';
    } else {
      btnL.classList.add('active'); btnL.setAttribute('aria-selected','true');
      btnC.classList.remove('active'); btnC.setAttribute('aria-selected','false');
      paneL.style.display = ''; paneC.style.display = 'none';
      btnLabel.textContent = 'Nova Lista';
    }
  }
  btnC.addEventListener('click', () => setAba('compras'));
  btnL.addEventListener('click', () => setAba('listas'));

  btnPrincipal.addEventListener('click', () => {
    if (abaAtual === 'compras') abrirModalCompra();
    else abrirModalLista();
  });
}

// ─── Custom select genérico ──────────────────────────────────────
function popularSelect(triggerId, dropdownId, labelId, hiddenId, opcoes, onChange) {
  const trigger  = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  const label    = document.getElementById(labelId);
  const hidden   = document.getElementById(hiddenId);
  if (!trigger || !dropdown) return;

  dropdown.innerHTML = opcoes.map(o => {
    const sel = hidden.value === o.value ? ' selected' : '';
    return `<div class="custom-select-option${sel}" data-value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</div>`;
  }).join('');

  trigger.onclick = () => {
    const open = dropdown.classList.toggle('open');
    trigger.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', open);
  };

  dropdown.querySelectorAll('.custom-select-option').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-value');
      const lab = el.textContent;
      hidden.value = v;
      label.textContent = lab;
      trigger.classList.add('has-value');
      trigger.classList.remove('error');
      dropdown.classList.remove('open');
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded','false');
      dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.getAttribute('data-value') === v));
      if (onChange) onChange(v, lab);
    });
  });
}

// fecha dropdowns abertos ao clicar fora
document.addEventListener('click', (e) => {
  document.querySelectorAll('.custom-select').forEach(cs => {
    if (!cs.contains(e.target)) {
      cs.querySelector('.custom-select-dropdown')?.classList.remove('open');
      cs.querySelector('.custom-select-trigger')?.classList.remove('open');
    }
  });
});

// ─── Modal Nova/Editar Compra ────────────────────────────────────
function abrirModalCompra(compra) {
  document.getElementById('modalCompraTitulo').textContent = compra ? 'Editar Compra' : 'Nova Compra';
  document.getElementById('compraId').value         = compra?.id || '';
  document.getElementById('compraMercado').value    = compra?.mercado || '';
  document.getElementById('compraData').value       = compra?.dataReferencia ? formatDataBR(extrairDataRef(compra.dataReferencia)) : hojeBR();
  document.getElementById('compraParcelas').value   = compra?.parcelas || 1;
  document.getElementById('compraForma').value      = compra?.pagamento || '';
  document.getElementById('compraCartaoId').value   = compra?.cartaoId || '';

  // Label do select Conta/Cartão: prioriza nome da carteira pelo id; senão mostra forma textual
  let labelForma = compra?.pagamento || 'Selecione…';
  if (compra?.cartaoId) {
    const c = carteirasCache.find(x => x.id === compra.cartaoId)
           || cartoesCache.find(x => x.id === compra.cartaoId);
    if (c) labelForma = c.nome || labelForma;
  }
  document.getElementById('csFormaLabel').textContent  = labelForma;
  document.getElementById('csCartaoLabel').textContent = compra?.cartaoId
    ? (cartoesCache.find(c => c.id === compra.cartaoId)?.nome || 'Cartão')
    : 'Selecione o cartão…';

  _itensCompra = (compra?.itens || []).map(i => ({
    desc:  i.desc  || i.nome || 'Item',
    valor: Number(i.valor) || 0,
    cat:   i.cat   || inferirCategoriaItem(i.desc || i.nome),
  }));

  // Sugestões de mercados usados anteriormente
  const dlMercados = document.getElementById('mercadosSugestoes');
  if (dlMercados) {
    const nomes = [...new Set(comprasCache.map(c => c.mercado).filter(Boolean))].slice(0, 25);
    dlMercados.innerHTML = nomes.map(m => `<option value="${escapeHTML(m)}">`).join('');
  }

  popularSelectsCompra();
  renderItensCompra();
  document.getElementById('modalCompra').classList.add('open');
  setTimeout(() => document.getElementById('compraMercado').focus(), 150);
}

function popularSelectsCompra() {
  // Ícones e labels por tipo de carteira
  const TIPO_ICONS = {
    dinheiro: '💵', debito: '🏦', credito: '💳',
    vale_refeicao: '🍽️', vale_alimentacao: '🛒',
    transporte: '🚌', evento: '🎪',
  };
  const TIPO_LABEL = {
    dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito',
    vale_refeicao: 'VR', vale_alimentacao: 'VA',
    transporte: 'Transporte', evento: 'Evento',
  };

  // Monta opções: prioriza carteirasCache. Se vazio, faz merge de cartoes (crédito) + fallback estático.
  let opcoes;
  if (carteirasCache.length > 0) {
    opcoes = carteirasCache.map(c => ({
      value: c.id,
      label: `${TIPO_ICONS[c.tipo] || '💼'} ${c.nome || 'Carteira'}`,
      _tipo: c.tipo || 'debito',
      _forma: TIPO_LABEL[c.tipo] || 'Outro',
      _id: c.id,
    }));
  } else {
    // Fallback: cartões de crédito (cartoesCache) + opções genéricas
    opcoes = [];
    cartoesCache.forEach(c => opcoes.push({
      value: 'cartao:' + c.id,
      label: `💳 ${c.nome}`,
      _tipo: 'credito', _forma: 'Crédito', _id: c.id,
    }));
    FORMAS_PAGAMENTO_FALLBACK.forEach(f => {
      if (f === 'Crédito' && cartoesCache.length) return; // já listado por cartão
      const tipo = f === 'Dinheiro' ? 'dinheiro'
                : f === 'Crédito'  ? 'credito'
                : f === 'VA/VR'    ? 'vale_refeicao'
                                   : 'debito';
      opcoes.push({
        value: 'forma:' + f,
        label: `${PAG_ICONS[f] || ''} ${f}`,
        _tipo: tipo, _forma: f, _id: '',
      });
    });
  }

  popularSelect('csFormaTrigger','csFormaDropdown','csFormaLabel','compraForma',
    opcoes,
    (value) => {
      const op = opcoes.find(o => o.value === value);
      if (!op) return;
      // Grava ID da carteira/cartão no campo cartaoId, e a forma textual em compraForma.
      document.getElementById('compraCartaoId').value = op._id || '';
      // compraForma armazena a string legacy ("Débito", "Crédito", etc.) p/ compatibilidade
      // com transações existentes; o select hidden já guarda o value bruto, então sobrescrevemos:
      const hidden = document.getElementById('compraForma');
      hidden.value = op._forma;
      hidden.dataset.walletId = op._id || '';
      // Parcelas só para crédito
      const fieldParc = document.getElementById('fieldParcelas');
      fieldParc.style.display = (op._tipo === 'credito') ? '' : 'none';
      if (op._tipo !== 'credito') {
        document.getElementById('compraParcelas').value = 1;
      }
      // Esconde fieldCartao (legacy — não usado mais quando há carteira)
      document.getElementById('fieldCartao').style.display = 'none';
    });

  // Estado inicial: parcelas só visível se compraForma já for 'Crédito'
  const formaAtual = document.getElementById('compraForma').value;
  document.getElementById('fieldParcelas').style.display = (formaAtual === 'Crédito') ? '' : 'none';
  document.getElementById('fieldCartao').style.display = 'none';
}

function renderItensCompra() {
  const cont = document.getElementById('itensCompraContainer');
  if (!_itensCompra.length) {
    cont.innerHTML = '<div style="font-size:0.75rem;color:var(--card-text-sec);padding:0.5rem 0;">Nenhum item adicionado ainda</div>';
  } else {
    cont.innerHTML = _itensCompra.map((it, idx) => `
      <div class="item-row">
        <div class="item-info">
          <div class="item-nome">${escapeHTML(it.desc)}</div>
          <div class="item-meta">${escapeHTML(it.cat)}</div>
        </div>
        <input type="text" class="item-input-valor" data-idx="${idx}" value="${formatBRL(it.valor).replace('R$ ','')}" inputmode="decimal">
        <button type="button" class="item-remove" data-idx="${idx}" aria-label="Remover">✕</button>
      </div>
    `).join('');
    cont.querySelectorAll('.item-input-valor').forEach(inp => {
      inp.addEventListener('input', () => {
        aplicarMascaraValor(inp);
        const idx = +inp.getAttribute('data-idx');
        _itensCompra[idx].valor = parseBRL(inp.value);
        atualizarTotalCompra();
      });
    });
    cont.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.getAttribute('data-idx');
        _itensCompra.splice(idx, 1);
        renderItensCompra();
        atualizarTotalCompra();
      });
    });
  }
  atualizarTotalCompra();
}

function atualizarTotalCompra() {
  const total = _itensCompra.reduce((s,i) => s + (Number(i.valor)||0), 0);
  document.getElementById('totalCompra').textContent = formatBRL(total);
}

function fecharModalCompra() {
  document.getElementById('modalCompra').classList.remove('open');
  _itensCompra = [];
}

// ─── Salvar compra (writeBatch — BUG 2/5/7) ──────────────────────
async function salvarCompra() {
  if (_salvando) return;

  const id        = document.getElementById('compraId').value;
  const mercado   = sanitize(document.getElementById('compraMercado').value).slice(0, 60);
  const dataBR    = document.getElementById('compraData').value;
  const dataISO   = parseDataBR(dataBR);
  const forma     = document.getElementById('compraForma').value;
  const cartaoId  = document.getElementById('compraCartaoId').value;
  const parcelas  = Math.max(1, Math.min(36, parseInt(document.getElementById('compraParcelas').value, 10) || 1));

  // Validações
  if (!mercado)      { showToast('Informe o mercado/loja', 'error'); return; }
  if (!dataISO)      { showToast('Data inválida (DD/MM/AAAA)', 'error'); return; }
  if (!forma)        { showToast('Selecione a forma de pagamento', 'error'); return; }
  if (forma === 'Crédito' && !cartaoId) { showToast('Selecione o cartão de crédito', 'error'); return; }
  if (!_itensCompra.length) { showToast('Adicione pelo menos 1 item', 'error'); return; }

  const total = _itensCompra.reduce((s,i) => s + (Number(i.valor)||0), 0);
  if (total <= 0) { showToast('Total da compra deve ser maior que zero', 'error'); return; }

  _salvando = true;
  const btn = document.getElementById('btnSalvarCompra');
  btn.disabled = true; btn.textContent = 'Salvando…';

  try {
    const itensNorm = _itensCompra.map(i => ({
      desc:  sanitize(i.desc).slice(0, 60),
      valor: Number(i.valor) || 0,
      cat:   i.cat || inferirCategoriaItem(i.desc),
    }));
    const cat = categoriaMajoritaria(itensNorm);   // BUG 3
    const descBase = mercado + (itensNorm.length > 1 ? ` (${itensNorm.length} itens)` : '');

    const batch = writeBatch(db);

    let compraRefId;
    if (id) {
      // Edição: re-salva e re-cria transações vinculadas (mais simples e confiável que diff)
      compraRefId = id;
      const compraRef = doc(db, 'usuarios', currentUser.uid, 'compras', id);
      batch.update(compraRef, {
        mercado, dataReferencia: dataISO, valor: total,
        pagamento: forma, parcelas, cartaoId: cartaoId || '',
        itens: itensNorm,
        atualizadoEm: serverTimestamp(),
      });
      // Apaga transações antigas vinculadas (BUG 9: por compraId)
      const oldSnap = await getDocs(query(
        collection(db, 'usuarios', currentUser.uid, 'transacoes'),
        where('compraId', '==', id)
      ));
      oldSnap.forEach(d => batch.delete(d.ref));
    } else {
      const compraRef = doc(collection(db, 'usuarios', currentUser.uid, 'compras'));
      compraRefId = compraRef.id;
      batch.set(compraRef, {
        mercado, dataReferencia: dataISO, valor: total,
        pagamento: forma, parcelas, cartaoId: cartaoId || '',
        itens: itensNorm,
        criadoEm: serverTimestamp(),
        origem: 'compras',
      });
    }

    // Transação(ões) vinculada(s) — BUG 5 (compraId) + BUG 7 (centavos)
    if (parcelas > 1) {
      const valorBase = Math.floor((total * 100) / parcelas) / 100;
      const resto     = Math.round((total - valorBase * parcelas) * 100) / 100;
      const dataBase  = new Date(dataISO + 'T12:00:00');
      for (let p = 0; p < parcelas; p++) {
        const dt = new Date(dataBase);
        dt.setMonth(dt.getMonth() + p);
        const dtIso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        const valorParc = (p === 0 ? valorBase + resto : valorBase);
        const transRef = doc(collection(db, 'usuarios', currentUser.uid, 'transacoes'));
        batch.set(transRef, {
          tipo: 'despesa',
          descricao: `${descBase} (${p+1}/${parcelas})`,
          valor: valorParc,
          categoria: cat,                       // BUG 3
          conta: forma,
          dataReferencia: dtIso,
          dataCriacao: serverTimestamp(),
          pago: p === 0,
          cartaoId: cartaoId || '',
          origem: 'compras',
          compraId: compraRefId,                // BUG 5
        });
      }
    } else {
      const transRef = doc(collection(db, 'usuarios', currentUser.uid, 'transacoes'));
      batch.set(transRef, {
        tipo: 'despesa',
        descricao: descBase,
        valor: total,
        categoria: cat,
        conta: forma,
        dataReferencia: dataISO,
        dataCriacao: serverTimestamp(),
        pago: true,
        cartaoId: cartaoId || '',
        origem: 'compras',
        compraId: compraRefId,
      });
    }

    await batch.commit();
    showToast(id ? 'Compra atualizada' : 'Compra registrada', 'success');
    fecharModalCompra();
  } catch (e) {
    error('salvarCompra', e);
    showToast('Erro ao salvar: ' + (e?.message || e), 'error');
  } finally {
    _salvando = false;
    btn.disabled = false; btn.textContent = 'Salvar Compra';
  }
}

// ─── Excluir compra ──────────────────────────────────────────────
async function confirmarExcluirCompra(compra) {
  // BUG 1: overlay com style.cssText
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--bg-page);border-radius:1rem;padding:1.5rem;max-width:380px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.3);';
  card.innerHTML = `
    <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">Excluir compra?</div>
    <div style="font-size:0.875rem;color:var(--text-sec);margin-bottom:1.25rem;">
      <strong>${escapeHTML(compra.mercado)}</strong> · ${formatBRL(compra.valor)}<br>
      Vai apagar a compra e todas as transações vinculadas (incluindo parcelas).
    </div>
    <div style="display:flex;gap:0.5rem;">
      <button id="cancelDel" style="flex:1;padding:0.625rem;border:none;border-radius:0.625rem;background:rgba(0,0,0,0.07);color:var(--text-sec);font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>
      <button id="confDel" style="flex:1;padding:0.625rem;border:none;border-radius:0.625rem;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;">Excluir</button>
    </div>`;
  ov.appendChild(card);
  document.body.appendChild(ov);

  const close = () => ov.remove();
  card.querySelector('#cancelDel').onclick = close;
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

  card.querySelector('#confDel').onclick = async () => {
    close();
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'usuarios', currentUser.uid, 'compras', compra.id));
      // BUG 9: por compraId
      const transSnap = await getDocs(query(
        collection(db, 'usuarios', currentUser.uid, 'transacoes'),
        where('compraId', '==', compra.id)
      ));
      transSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Compra excluída', 'success');
    } catch (e) {
      error('excluirCompra', e);
      showToast('Erro ao excluir: ' + (e?.message || e), 'error');
    }
  };
}

// ─── Render Aba Compras ──────────────────────────────────────────
function renderCompras() {
  // KPIs: sempre baseados no mês atual (sem filtro)
  const now = new Date();
  const prefixo = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const doMes = comprasCache.filter(c => extrairDataRef(c.dataReferencia).startsWith(prefixo));

  const totalMes = doMes.reduce((s,c) => s + (Number(c.valor)||0), 0);
  const qtd      = doMes.length;
  const ticket   = qtd ? totalMes / qtd : 0;
  const maior    = doMes.reduce((m,c) => (Number(c.valor)||0) > (m?.valor||0) ? c : m, null);

  // KPI 5 — item mais comprado no mês (por ocorrências)
  const itemContMes = {};
  doMes.forEach(c => {
    (c.itens || []).forEach(it => {
      const k = itemKey(it.desc || it.nome || '');
      if (!k) return;
      if (!itemContMes[k]) itemContMes[k] = { nome: it.desc || it.nome, n: 0 };
      itemContMes[k].n++;
    });
  });
  const topItem = Object.values(itemContMes).sort((a,b) => b.n - a.n)[0];

  document.getElementById('cardTotalMes').textContent = formatBRL(totalMes);
  document.getElementById('cardTotalMesSub').textContent = qtd === 1 ? '1 compra' : `${qtd} compras`;
  document.getElementById('cardQtdMes').textContent = qtd;
  document.getElementById('cardTicket').textContent = formatBRL(ticket);
  document.getElementById('cardMaior').textContent = maior ? formatBRL(maior.valor) : 'R$ 0,00';
  document.getElementById('cardMaiorSub').textContent = maior ? maior.mercado : '—';
  document.getElementById('cardItemTop').textContent = topItem ? topItem.nome.slice(0, 25) : '—';
  document.getElementById('cardItemTopSub').textContent = topItem ? `${topItem.n}x este mês` : 'no mês atual';

  // Filtrar lista
  let filtradas = comprasCache;
  if (_filtroBusca) {
    const q = _filtroBusca.toLowerCase();
    filtradas = filtradas.filter(c => (c.mercado || '').toLowerCase().includes(q));
  }
  if (_filtroMes) {
    filtradas = filtradas.filter(c => extrairDataRef(c.dataReferencia).startsWith(_filtroMes));
  }
  if (_filtroForma) {
    filtradas = filtradas.filter(c => (c.pagamento || '') === _filtroForma);
  }

  // Render barra de filtros
  renderFiltrosBar();

  // Lista paginada
  const container = document.getElementById('listaCompras');
  document.getElementById('comprasContador').textContent =
    filtradas.length === 1 ? '1 compra' : `${filtradas.length} compras`;

  if (!filtradas.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <div class="empty-state-title">${comprasCache.length ? 'Nenhuma compra encontrada' : 'Nenhuma compra registrada ainda'}</div>
        <div class="empty-state-sub">${comprasCache.length ? 'Tente outro filtro' : 'Clique em <strong>Nova Compra</strong> para começar'}</div>
      </div>`;
    renderHistoricoPrecos();
    renderComparacaoLojas();
    renderGraficoCategoria();
    return;
  }

  const totalPag = paginaCompras * PAGE_SIZE;
  const visiveis = filtradas.slice(0, totalPag);

  container.innerHTML = visiveis.map(c => {
    const dataIso = extrairDataRef(c.dataReferencia);
    const dataBR = formatDataBR(dataIso);
    const ic = PAG_ICONS[c.pagamento] || '🛒';
    const itensCount = (c.itens || []).length;
    const isMes = dataIso.startsWith(prefixo);
    return `
      <div class="compra-card" data-compra-id="${escapeHTML(c.id)}" style="cursor:pointer;">
        <div class="compra-icon" style="${isMes ? '' : 'background:#f1f5f9;'}">🛒</div>
        <div class="compra-body">
          <div class="compra-mercado">${escapeHTML(c.mercado || '—')}</div>
          <div class="compra-meta">
            <span>${dataBR}</span>
            <span>•</span>
            <span>${ic} ${escapeHTML(c.pagamento || '—')}</span>
            ${c.parcelas > 1 ? `<span class="compra-badge">${c.parcelas}x</span>` : ''}
            ${itensCount ? `<span class="compra-badge">${itensCount} ${itensCount===1?'item':'itens'}</span>` : ''}
          </div>
        </div>
        <div class="compra-valor">${formatBRL(c.valor)}</div>
        <button class="action-btn" data-action="repetir" title="Criar lista desta compra" aria-label="Criar lista">📋</button>
        <button class="action-btn" data-action="edit" aria-label="Editar">✏️</button>
        <button class="action-btn delete" data-action="del" aria-label="Excluir">🗑️</button>
      </div>`;
  }).join('') + (
    filtradas.length > totalPag
      ? `<div style="text-align:center;margin-top:1rem;"><button id="btnVerMais" class="lista-action-btn">Ver mais (${filtradas.length - totalPag} restantes)</button></div>`
      : ''
  );

  container.querySelectorAll('.compra-card').forEach(card => {
    const id = card.getAttribute('data-compra-id');
    const compra = comprasCache.find(c => c.id === id);
    if (!compra) return;
    // Clique no corpo (não nos botões) → detalhe
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      abrirDetalheCompra(compra);
    });
    card.querySelector('[data-action="repetir"]').addEventListener('click', (e) => {
      e.stopPropagation(); criarListaDaCompra(compra);
    });
    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation(); abrirModalCompra(compra);
    });
    card.querySelector('[data-action="del"]').addEventListener('click', (e) => {
      e.stopPropagation(); confirmarExcluirCompra(compra);
    });
  });

  document.getElementById('btnVerMais')?.addEventListener('click', () => {
    paginaCompras++;
    renderCompras();
  });

  renderHistoricoPrecos();
  renderComparacaoLojas();
  renderGraficoCategoria();
}

// ─── Barra de filtros ────────────────────────────────────────────
function renderFiltrosBar() {
  const bar = document.getElementById('filtroBar');
  if (!bar) return;

  // Meses disponíveis
  const mesesSet = new Set();
  comprasCache.forEach(c => {
    const d = extrairDataRef(c.dataReferencia);
    if (d && d.length >= 7) mesesSet.add(d.slice(0,7));
  });
  const meses = Array.from(mesesSet).sort().reverse();

  // Formas de pagamento disponíveis
  const formasSet = new Set(comprasCache.map(c => c.pagamento).filter(Boolean));
  const formas = Array.from(formasSet).sort();

  const mesBR = (ym) => {
    if (!ym) return '';
    const [y,m] = ym.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[+m-1]}/${y.slice(2)}`;
  };

  const mesesHtml = meses.length > 1
    ? `<button class="filtro-chip${!_filtroMes ? ' ativo' : ''}" data-filtro-mes="">Todos</button>`
      + meses.slice(0,6).map(m =>
          `<button class="filtro-chip${_filtroMes===m ? ' ativo' : ''}" data-filtro-mes="${escapeHTML(m)}">${mesBR(m)}</button>`
        ).join('')
    : '';

  const formasHtml = formas.map(f =>
    `<button class="filtro-chip${_filtroForma===f ? ' ativo' : ''}" data-filtro-forma="${escapeHTML(f)}">${escapeHTML(f)}</button>`
  ).join('');

  bar.innerHTML = `
    <input class="filtro-search" id="filtroSearchInput" type="text"
      placeholder="🔍 Buscar mercado…" value="${escapeHTML(_filtroBusca)}" maxlength="60" autocomplete="off">
    ${mesesHtml}
    ${formasHtml}
  `;

  bar.querySelector('#filtroSearchInput')?.addEventListener('input', (e) => {
    _filtroBusca = e.target.value;
    paginaCompras = 1;
    renderCompras();
  });
  bar.querySelectorAll('[data-filtro-mes]').forEach(btn => {
    btn.addEventListener('click', () => {
      _filtroMes = btn.getAttribute('data-filtro-mes');
      paginaCompras = 1;
      renderCompras();
    });
  });
  bar.querySelectorAll('[data-filtro-forma]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-filtro-forma');
      _filtroForma = _filtroForma === v ? '' : v;
      paginaCompras = 1;
      renderCompras();
    });
  });
}

// ─── Histórico de preços ─────────────────────────────────────────
function renderHistoricoPrecos() {
  const container = document.getElementById('historicoPrecos');
  // Agrupa por nome (lowercased) com >=2 ocorrências
  const idx = {};
  comprasCache.forEach(c => {
    (c.itens || []).forEach(it => {
      const nomeKey = (it.desc || it.nome || '').trim().toLowerCase();
      if (!nomeKey || !it.valor) return;
      if (!idx[nomeKey]) idx[nomeKey] = { nome: it.desc || it.nome, registros: [] };
      idx[nomeKey].registros.push({
        valor: Number(it.valor) || 0,
        data: extrairDataRef(c.dataReferencia),
      });
    });
  });

  const linhas = Object.values(idx)
    .filter(x => x.registros.length >= 2)
    .map(x => {
      const valores = x.registros.map(r => r.valor);
      const min = Math.min(...valores);
      const max = Math.max(...valores);
      // Variação entre o mais antigo e o mais recente
      x.registros.sort((a,b) => (a.data || '').localeCompare(b.data || ''));
      const v0 = x.registros[0].valor;
      const vN = x.registros[x.registros.length-1].valor;
      const varPct = v0 ? ((vN - v0) / v0) * 100 : 0;
      return { ...x, min, max, varPct, ultimo: vN };
    })
    .sort((a,b) => Math.abs(b.varPct) - Math.abs(a.varPct))
    .slice(0, 15);

  if (!linhas.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1.5rem 1rem;">
        <div class="empty-state-icon">📈</div>
        <div class="empty-state-sub">Compre o mesmo item em ≥ 2 ocasiões para ver a variação aqui</div>
      </div>`;
    return;
  }

  container.innerHTML = linhas.map(l => {
    const seta = l.varPct > 0 ? '▲' : (l.varPct < 0 ? '▼' : '—');
    const cls  = l.varPct > 0 ? 'preco-var-up' : (l.varPct < 0 ? 'preco-var-down' : '');
    const alerta = l.varPct > 10;
    return `
      <div class="preco-row${alerta ? ' preco-alerta' : ''}">
        <div class="preco-nome">${escapeHTML(l.nome)}</div>
        <div class="preco-stats">
          <span class="preco-min">↓ ${formatBRL(l.min)}</span>
          <span class="preco-max">↑ ${formatBRL(l.max)}</span>
          <span class="${cls}">${seta} ${Math.abs(l.varPct).toFixed(0)}%</span>
        </div>
      </div>`;
  }).join('');
}

// ─── Comparativo entre lojas ─────────────────────────────────────
function renderComparacaoLojas() {
  const container = document.getElementById('comparativoLojas');
  if (!container) return;

  // Agrupa por (itemKey, mercado) → lista de preços
  const idx = {};
  comprasCache.forEach(c => {
    const mercadoNome = c.mercado || 'Desconhecido';
    (c.itens || []).forEach(it => {
      const k = itemKey(it.desc || it.nome || '');
      if (!k || !it.valor) return;
      if (!idx[k]) idx[k] = { nome: it.desc || it.nome, lojas: {} };
      if (!idx[k].lojas[mercadoNome]) idx[k].lojas[mercadoNome] = [];
      idx[k].lojas[mercadoNome].push(Number(it.valor) || 0);
    });
  });

  // Apenas itens em 2+ lojas diferentes
  const comparativos = Object.values(idx)
    .filter(x => Object.keys(x.lojas).length >= 2)
    .map(x => {
      const lojas = Object.entries(x.lojas).map(([nome, precos]) => ({
        nome,
        preco: precos.reduce((s,p) => s + p, 0) / precos.length,
      })).sort((a,b) => a.preco - b.preco);
      return { nome: x.nome, lojas };
    })
    .sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 20);

  if (!comparativos.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1.5rem 1rem;">
        <div class="empty-state-icon">🏪</div>
        <div class="empty-state-sub">Compre o mesmo item em 2 mercados diferentes para ver a comparação aqui</div>
      </div>`;
    return;
  }

  container.innerHTML = comparativos.map(c => {
    const lojaHtml = c.lojas.map((l, i) => `
      <div class="comp-loja-store${i === 0 ? ' mais-barato' : ''}">
        ${i === 0 ? '✓ ' : ''}${escapeHTML(l.nome)} ${formatBRL(l.preco)}
      </div>`).join('');
    return `
      <div class="comp-loja-row">
        <div class="comp-loja-nome">${escapeHTML(c.nome)}</div>
        <div class="comp-loja-stores">${lojaHtml}</div>
      </div>`;
  }).join('');
}

// ─── Gráfico de categorias (donut) ───────────────────────────────
function renderGraficoCategoria() {
  const canvas = document.getElementById('donutCategoria');
  const secao  = document.getElementById('secaoGrafico');
  if (!canvas || typeof Chart === 'undefined') return;

  // Totais por categoria — itens do mês atual
  const now = new Date();
  const prefixo = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const catTotals = {};
  comprasCache
    .filter(c => extrairDataRef(c.dataReferencia).startsWith(prefixo))
    .forEach(c => {
      (c.itens || []).forEach(it => {
        const cat = it.cat || 'Outros';
        catTotals[cat] = (catTotals[cat] || 0) + (Number(it.valor) || 0);
      });
      // Se a compra não tem itens, soma como "Mercado"
      if (!(c.itens || []).length) {
        catTotals['Mercado'] = (catTotals['Mercado'] || 0) + (Number(c.valor) || 0);
      }
    });

  const labels = Object.keys(catTotals);
  const valores = Object.values(catTotals);
  const total = valores.reduce((s,v) => s + v, 0);

  if (!total) {
    if (secao) secao.style.display = 'none';
    return;
  }
  if (secao) secao.style.display = '';

  const CORES = ['#3b82f6','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2','#db2777','#84cc16','#f97316','#64748b'];
  const cores = labels.map((_,i) => CORES[i % CORES.length]);

  // Legenda
  const legendaEl = document.getElementById('legendaCategoria');
  if (legendaEl) {
    legendaEl.innerHTML = labels.map((l, i) => `
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
        <div style="width:10px;height:10px;border-radius:50%;background:${cores[i]};flex-shrink:0;"></div>
        <span style="font-size:0.75rem;font-weight:600;color:var(--card-text);flex:1;">${escapeHTML(l)}</span>
        <span style="font-size:0.75rem;font-weight:700;color:var(--card-text-sec);">${formatBRL(valores[i])}</span>
      </div>`).join('');
  }

  if (_graficoDonutInst) {
    _graficoDonutInst.data.labels = labels;
    _graficoDonutInst.data.datasets[0].data = valores;
    _graficoDonutInst.data.datasets[0].backgroundColor = cores;
    _graficoDonutInst.update();
    return;
  }

  _graficoDonutInst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: cores,
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatBRL(ctx.raw)} (${Math.round(ctx.raw / total * 100)}%)`,
          },
        },
      },
    },
  });
}

// ─── Detalhe da compra (modal) ───────────────────────────────────
function abrirDetalheCompra(compra) {
  _detalheCompraAtual = compra;
  const dataIso = extrairDataRef(compra.dataReferencia);
  const dataBR  = formatDataBR(dataIso);
  const ic      = PAG_ICONS[compra.pagamento] || '🛒';

  document.getElementById('detalheCompraNome').textContent = compra.mercado || 'Compra';
  document.getElementById('detalheCompraMeta').innerHTML = `
    <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:0.8125rem;color:var(--card-text-sec);margin-bottom:1rem;">
      <span>📅 ${dataBR}</span>
      <span>${ic} ${escapeHTML(compra.pagamento || '—')}</span>
      ${compra.parcelas > 1 ? `<span>📦 ${compra.parcelas}x</span>` : ''}
    </div>`;

  const itens = compra.itens || [];
  if (!itens.length) {
    document.getElementById('detalheCompraItens').innerHTML =
      `<div style="font-size:.8125rem;color:var(--card-text-sec);padding:.5rem 0;">Nenhum item registrado nesta compra.</div>`;
  } else {
    const porCat = {};
    itens.forEach(it => {
      const cat = it.cat || 'Outros';
      if (!porCat[cat]) porCat[cat] = [];
      porCat[cat].push(it);
    });
    document.getElementById('detalheCompraItens').innerHTML = Object.entries(porCat).map(([cat, items]) => `
      <div class="detalhe-cat-header">${escapeHTML(cat)}</div>
      ${items.map(it => `
        <div class="detalhe-item-row">
          <span class="detalhe-item-nome">${escapeHTML(it.desc || it.nome || '—')}</span>
          ${it.qtd && Number(it.qtd) > 1 ? `<span class="detalhe-item-qtd">${it.qtd}x</span>` : ''}
          <span class="detalhe-item-valor">${formatBRL(it.valor)}</span>
        </div>`).join('')}
    `).join('');
  }

  const total = Number(compra.valor) || itens.reduce((s,i) => s + (Number(i.valor)||0), 0);
  document.getElementById('detalheCompraTotal').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 1rem;background:var(--input-bg);border-radius:.75rem;margin-top:.875rem;font-size:.9375rem;font-weight:800;color:var(--card-text);">
      <span>Total</span>
      <span style="color:#dc2626;">${formatBRL(total)}</span>
    </div>`;

  document.getElementById('modalDetalheCompra').classList.add('open');
}

// ─── Criar lista a partir de compra anterior ─────────────────────
function criarListaDaCompra(compra) {
  const itens = compra.itens || [];
  if (!itens.length) {
    showToast('Esta compra não tem itens — adicione itens antes de repetir.', 'warning');
    return;
  }
  _itensLista = itens.map(it => ({
    nome: sanitize(it.desc || it.nome || 'Item').slice(0, 60),
    preenchido: false,
    valor: 0,
    cat: it.cat || inferirCategoriaItem(it.desc || it.nome || ''),
  }));
  document.getElementById('listaNome').value = `${(compra.mercado || 'Compra').slice(0,40)} – cópia`;
  document.getElementById('listaId').value = '';
  document.getElementById('modalListaTitulo').textContent = 'Nova Lista da Compra';
  renderItensLista();
  // Fecha detalhe e abre lista
  document.getElementById('modalDetalheCompra').classList.remove('open');
  document.getElementById('modalLista').classList.add('open');
  // Muda para aba listas
  document.getElementById('tabListas')?.click();
}

// ─── Último preço conhecido de um item ──────────────────────────
function ultimoPrecoItem(nome) {
  const k = itemKey(nome);
  if (!k) return 0;
  let ultimaData = '';
  let ultimoPreco = 0;
  comprasCache.forEach(c => {
    const d = extrairDataRef(c.dataReferencia);
    (c.itens || []).forEach(it => {
      if (itemKey(it.desc || it.nome || '') === k && it.valor) {
        if (!ultimaData || d >= ultimaData) {
          ultimaData = d;
          ultimoPreco = Number(it.valor) || 0;
        }
      }
    });
  });
  return ultimoPreco;
}

// ─── Modal Nova/Editar Lista ─────────────────────────────────────
function abrirModalLista(lista) {
  document.getElementById('modalListaTitulo').textContent = lista ? 'Editar Lista' : 'Nova Lista';
  document.getElementById('listaId').value = lista?.id || '';
  document.getElementById('listaNome').value = lista?.nome || '';
  document.getElementById('listaMercadoAlvo').value = lista?.mercadoAlvo || '';
  _itensLista = (lista?.itens || []).map(i => ({
    nome: i.nome || 'Item', preenchido: !!i.preenchido,
    valor: Number(i.valor) || 0, qtd: Number(i.qtd) || 1, cat: i.cat || inferirCategoriaItem(i.nome),
  }));
  renderItensLista();
  document.getElementById('modalLista').classList.add('open');
  setTimeout(() => document.getElementById('listaNome').focus(), 150);
}

function renderItensLista() {
  const cont = document.getElementById('itensListaContainer');
  if (!_itensLista.length) {
    cont.innerHTML = '<div style="font-size:0.75rem;color:var(--card-text-sec);padding:0.5rem 0;">Nenhum item na lista ainda</div>';
    return;
  }
  cont.innerHTML = _itensLista.map((it, idx) => {
    const ultimoPreco = ultimoPrecoItem(it.nome);
    const qtd = it.qtd || 1;
    return `
    <div class="item-row">
      <div class="item-info" style="flex:1;min-width:0;">
        <div class="item-nome">${escapeHTML(it.nome)}</div>
        <div class="item-meta">${escapeHTML(it.cat)}${ultimoPreco > 0 ? ` · últ. ${formatBRL(ultimoPreco)}${qtd > 1 ? ` ×${qtd}` : ''}` : ''}</div>
      </div>
      <input type="number" data-idx="${idx}" data-action="qty" value="${qtd}" min="1" max="99" style="width:2.75rem;text-align:center;font-size:0.8125rem;border:1px solid var(--input-border);border-radius:0.375rem;background:transparent;color:var(--text-main);padding:0.125rem 0.25rem;margin-right:0.375rem;flex-shrink:0;">
      <button type="button" class="item-remove" data-idx="${idx}" aria-label="Remover">✕</button>
    </div>`;
  }).join('');

  // Estimativa total com qtd
  const estimativa = _itensLista.reduce((s, it) => s + ultimoPrecoItem(it.nome) * (it.qtd || 1), 0);
  if (estimativa > 0) {
    const comPreco = _itensLista.filter(it => ultimoPrecoItem(it.nome) > 0).length;
    cont.innerHTML += `
      <div style="padding:0.5rem 0.875rem;font-size:0.75rem;font-weight:700;color:#16a34a;margin-top:0.375rem;border-top:1px dashed var(--input-border);">
        💡 Estimativa: ${formatBRL(estimativa)} (${comPreco} de ${_itensLista.length} com preço histórico)
      </div>`;
  }

  cont.querySelectorAll('[data-action="qty"]').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.getAttribute('data-idx');
      _itensLista[i].qtd = Math.max(1, Math.min(99, parseInt(inp.value, 10) || 1));
      inp.value = _itensLista[i].qtd;
      renderItensLista();
    });
  });
  cont.querySelectorAll('.item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _itensLista.splice(+btn.getAttribute('data-idx'), 1);
      renderItensLista();
    });
  });
}

function fecharModalLista() {
  document.getElementById('modalLista').classList.remove('open');
  _itensLista = [];
}

async function salvarLista() {
  if (_salvando) return;
  const id = document.getElementById('listaId').value;
  const nome = sanitize(document.getElementById('listaNome').value).slice(0, 60);
  const mercadoAlvo = sanitize(document.getElementById('listaMercadoAlvo').value).slice(0, 60);
  if (!nome) { showToast('Informe o nome da lista', 'error'); return; }
  if (!_itensLista.length) { showToast('Adicione pelo menos 1 item', 'error'); return; }

  _salvando = true;
  const btn = document.getElementById('btnSalvarLista');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const itensNorm = _itensLista.map(i => ({
      nome: sanitize(i.nome).slice(0, 60),
      preenchido: !!i.preenchido,
      valor: Number(i.valor) || 0,
      qtd: Number(i.qtd) || 1,
      cat: i.cat || inferirCategoriaItem(i.nome),
    }));
    const payload = { nome, mercadoAlvo, itens: itensNorm, atualizadoEm: serverTimestamp() };
    if (id) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'listas-compras', id), payload);
      showToast('Lista atualizada', 'success');
    } else {
      payload.status = 'ativa';
      payload.criadoEm = serverTimestamp();
      await addDoc(collection(db, 'usuarios', currentUser.uid, 'listas-compras'), payload);
      showToast('Lista criada', 'success');
    }
    fecharModalLista();
  } catch (e) {
    error('salvarLista', e);
    showToast('Erro ao salvar: ' + (e?.message || e), 'error');
  } finally {
    _salvando = false;
    btn.disabled = false; btn.textContent = 'Salvar Lista';
  }
}

// ─── Render Aba Listas ───────────────────────────────────────────
function renderListas() {
  atualizarMercadosDatalist();

  const todasAtivas = listasCache.filter(l => l.status !== 'concluida');
  const concAll     = listasCache.filter(l => l.status === 'concluida');
  const busca = _listaBusca.toLowerCase();
  const ativas = busca
    ? todasAtivas.filter(l =>
        l.nome.toLowerCase().includes(busca) ||
        (l.mercadoAlvo || '').toLowerCase().includes(busca) ||
        (l.itens || []).some(i => i.nome.toLowerCase().includes(busca)))
    : todasAtivas;
  const conc = _listasHistExpand ? concAll : concAll.slice(0, 10);

  function htmlLista(l) {
    const itens = l.itens || [];
    const total = itens.length;
    const feitos = itens.filter(i => i.preenchido).length;
    const pct = total ? Math.round((feitos / total) * 100) : 0;
    const concluida = l.status === 'concluida';
    const semPreco = itens.filter(i => ultimoPrecoItem(i.nome) === 0).length;
    const estimAtiva = !concluida
      ? itens.reduce((s, i) => s + ultimoPrecoItem(i.nome) * (i.qtd || 1), 0)
      : 0;
    return `
      <div class="lista-card${concluida ? ' concluida' : ''}" data-lista-id="${escapeHTML(l.id)}">
        <div class="lista-header">
          <div style="min-width:0;flex:1;">
            <div class="lista-title">${escapeHTML(l.nome)}${semPreco > 0 && !concluida ? ` <span style="font-size:0.7rem;color:#d97706;" title="${semPreco} item(ns) sem preço histórico">⚠️ ${semPreco}</span>` : ''}</div>
            <div class="lista-meta">
              ${total} itens · ${feitos} preenchidos${concluida ? ' · ✅ concluída' : ''}${l.mercadoAlvo ? ` · 📍 ${escapeHTML(l.mercadoAlvo)}` : ''}
            </div>
            ${concluida && l.totalGasto ? `<div class="lista-meta" style="color:#16a34a;font-weight:700;">💰 Gasto real: ${formatBRL(l.totalGasto)}${l.totalEstimado > 0 ? ` <span style="font-weight:600;color:${l.totalGasto <= l.totalEstimado ? '#16a34a' : '#dc2626'}">` + (l.totalGasto <= l.totalEstimado ? '▼' : '▲') + ` vs ${formatBRL(l.totalEstimado)} estimado</span>` : ''}</div>` : ''}
            ${estimAtiva > 0 ? `<div class="lista-meta" style="color:var(--text-sec);">💡 Estimativa: ${formatBRL(estimAtiva)}</div>` : ''}
          </div>
        </div>
        ${concluida ? '' : `<div class="lista-progress"><div class="lista-progress-bar" style="width:${pct}%;"></div></div>`}
        <div class="lista-actions">
          ${concluida
            ? `<button class="lista-action-btn" data-action="edit">Ver itens</button>
               <button class="lista-action-btn" data-action="reabrir">Reabrir</button>`
            : `<button class="lista-action-btn primary" data-action="modo">🛒 Modo Compras</button>
               <button class="lista-action-btn" data-action="edit">Editar</button>`}
          <button class="lista-action-btn" data-action="dup">Duplicar</button>
          <button class="lista-action-btn danger" data-action="del">Excluir</button>
        </div>
      </div>`;
  }

  // Campo de busca (só aparece com 3+ listas ativas)
  const buscaHtml = todasAtivas.length >= 3
    ? `<div style="margin-bottom:0.75rem;"><input type="text" id="listaBuscaInput" value="${escapeHTML(_listaBusca)}" placeholder="🔍 Buscar lista ou item..." style="width:100%;padding:0.5rem 0.75rem;border:1px solid var(--input-border);border-radius:0.625rem;background:var(--input-bg);color:var(--text-main);font-size:0.875rem;font-family:inherit;box-sizing:border-box;"></div>`
    : '';

  document.getElementById('listasAtivas').innerHTML = buscaHtml + (ativas.length
    ? ativas.map(htmlLista).join('')
    : `<div class="empty-state"><div class="empty-state-icon">📝</div>
        <div class="empty-state-title">${busca ? 'Nenhuma lista encontrada' : 'Nenhuma lista ativa'}</div>
        <div class="empty-state-sub">${busca ? 'Tente outro termo' : 'Crie uma lista para organizar suas próximas compras'}</div></div>`);

  // Botão "Ver todas"
  const verTodasBtn = !_listasHistExpand && concAll.length > 10
    ? `<button id="btnVerTodasConc" style="width:100%;margin-top:0.5rem;padding:0.5rem;border:1px dashed var(--input-border);border-radius:0.625rem;background:transparent;color:var(--text-sec);font-size:0.8125rem;cursor:pointer;font-family:inherit;">Ver todas (${concAll.length})</button>`
    : '';

  document.getElementById('listasConcluidas').innerHTML = conc.length
    ? conc.map(htmlLista).join('') + verTodasBtn
    : `<div class="empty-state" style="padding:1.5rem 1rem;"><div class="empty-state-sub">Nenhuma lista concluída ainda</div></div>`;

  // Event listeners
  document.querySelectorAll('.lista-card').forEach(card => {
    const id = card.getAttribute('data-lista-id');
    const lista = listasCache.find(l => l.id === id);
    if (!lista) return;
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => abrirModalLista(lista));
    card.querySelector('[data-action="modo"]')?.addEventListener('click', () => abrirModoCompras(lista));
    card.querySelector('[data-action="del"]')?.addEventListener('click', () => confirmarExcluirLista(lista));
    card.querySelector('[data-action="dup"]')?.addEventListener('click', () => duplicarLista(lista));
    card.querySelector('[data-action="reabrir"]')?.addEventListener('click', () => reabrirLista(lista));
  });

  document.getElementById('listaBuscaInput')?.addEventListener('input', (e) => {
    _listaBusca = e.target.value;
    renderListas();
  });

  document.getElementById('btnVerTodasConc')?.addEventListener('click', () => {
    _listasHistExpand = true;
    renderListas();
  });
}

async function confirmarExcluirLista(lista) {
  // BUG 1: style.cssText
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--bg-page);border-radius:1rem;padding:1.5rem;max-width:380px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.3);';
  card.innerHTML = `
    <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">Excluir lista?</div>
    <div style="font-size:0.875rem;color:var(--text-sec);margin-bottom:1.25rem;"><strong>${escapeHTML(lista.nome)}</strong></div>
    <div style="display:flex;gap:0.5rem;">
      <button id="cancelDel" style="flex:1;padding:0.625rem;border:none;border-radius:0.625rem;background:rgba(0,0,0,0.07);color:var(--text-sec);font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>
      <button id="confDel" style="flex:1;padding:0.625rem;border:none;border-radius:0.625rem;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;">Excluir</button>
    </div>`;
  ov.appendChild(card);
  document.body.appendChild(ov);
  const close = () => ov.remove();
  card.querySelector('#cancelDel').onclick = close;
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  card.querySelector('#confDel').onclick = async () => {
    close();
    try {
      await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'listas-compras', lista.id));
      showToast('Lista excluída', 'success');
    } catch (e) {
      error('excluirLista', e);
      showToast('Erro ao excluir', 'error');
    }
  };
}

// ─── Duplicar / Reabrir / Ordenar / Datalist ─────────────────────
async function duplicarLista(lista) {
  try {
    const payload = {
      nome: `Cópia de ${lista.nome}`.slice(0, 60),
      mercadoAlvo: lista.mercadoAlvo || '',
      itens: (lista.itens || []).map(i => ({
        nome: i.nome, preenchido: false, valor: 0, qtd: i.qtd || 1, cat: i.cat,
      })),
      status: 'ativa',
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    };
    await addDoc(collection(db, 'usuarios', currentUser.uid, 'listas-compras'), payload);
    showToast('Lista duplicada', 'success');
  } catch (e) { error('duplicarLista', e); showToast('Erro ao duplicar', 'error'); }
}

async function reabrirLista(lista) {
  try {
    await updateDoc(doc(db, 'usuarios', currentUser.uid, 'listas-compras', lista.id), {
      status: 'ativa',
      atualizadoEm: serverTimestamp(),
    });
    showToast('Lista reaberta', 'success');
  } catch (e) { error('reabrirLista', e); showToast('Erro ao reabrir', 'error'); }
}

function ordenarItensPorCategoria() {
  _itensLista.sort((a, b) => (a.cat || 'Outros').localeCompare(b.cat || 'Outros'));
  renderItensLista();
}

function atualizarMercadosDatalist() {
  const dl = document.getElementById('mercadosDatalist');
  if (!dl) return;
  const mercados = [...new Set(comprasCache.map(c => c.mercado).filter(Boolean))].sort();
  dl.innerHTML = mercados.map(m => `<option value="${escapeHTML(m)}">`).join('');
}

// ─── Modo Compras ────────────────────────────────────────────────
function abrirModoCompras(lista) {
  _modoListaId = lista.id;
  _modoItens = (lista.itens || []).map(i => ({
    nome: i.nome,
    preenchido: !!i.preenchido,
    valor: Number(i.valor) || 0,
    cat: i.cat || inferirCategoriaItem(i.nome),
  }));
  document.getElementById('modoComprasTitulo').textContent = lista.nome;
  renderModoCompras();
  document.getElementById('modalModoCompras').classList.add('open');
}

function renderModoCompras() {
  const cont = document.getElementById('itensModoComprasContainer');
  if (!_modoItens.length) {
    cont.innerHTML = '<div style="font-size:0.8125rem;color:var(--card-text-sec);text-align:center;padding:1rem;">Adicione itens para começar</div>';
  } else {
    // Agrupa por categoria mantendo índice original
    const grupos = {};
    _modoItens.forEach((it, idx) => {
      const cat = it.cat || 'Outros';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push({ it, idx });
    });

    cont.innerHTML = Object.entries(grupos).map(([cat, items]) => `
      <div class="detalhe-cat-header" style="padding:0.5rem 0.25rem 0.125rem;">${escapeHTML(cat)}</div>
      ${items.map(({ it, idx }) => {
        const ultimoPreco = ultimoPrecoItem(it.nome);
        return `
        <div class="item-row${it.preenchido ? ' preenchido' : ''}">
          <div class="item-check${it.preenchido ? ' on' : ''}" data-idx="${idx}" data-action="check" role="button" aria-label="Marcar">${it.preenchido ? '✓' : ''}</div>
          <div class="item-info">
            <div class="item-nome">${escapeHTML(it.nome)}</div>
            ${ultimoPreco > 0 ? `<div class="item-meta">últ. ${formatBRL(ultimoPreco)}</div>` : ''}
          </div>
          <input type="text" class="item-input-valor" data-idx="${idx}" data-action="valor" value="${it.valor ? formatBRL(it.valor).replace('R$ ','') : ''}" placeholder="0,00" inputmode="decimal">
          <button type="button" class="item-remove" data-idx="${idx}" data-action="rm" aria-label="Remover">✕</button>
        </div>`;
      }).join('')}
    `).join('');

    cont.querySelectorAll('[data-action="check"]').forEach(el => {
      el.addEventListener('click', () => {
        const i = +el.getAttribute('data-idx');
        _modoItens[i].preenchido = !_modoItens[i].preenchido;
        renderModoCompras();
        salvarRascunhoModoCompras();
      });
    });
    cont.querySelectorAll('[data-action="valor"]').forEach(el => {
      el.addEventListener('input', () => {
        aplicarMascaraValor(el);
        const i = +el.getAttribute('data-idx');
        _modoItens[i].valor = parseBRL(el.value);
        if (_modoItens[i].valor > 0 && !_modoItens[i].preenchido) {
          _modoItens[i].preenchido = true;
        }
        atualizarProgressoModoCompras();
      });
      el.addEventListener('blur', () => salvarRascunhoModoCompras());
    });
    cont.querySelectorAll('[data-action="rm"]').forEach(el => {
      el.addEventListener('click', () => {
        _modoItens.splice(+el.getAttribute('data-idx'), 1);
        renderModoCompras();
        salvarRascunhoModoCompras();
      });
    });
  }
  atualizarProgressoModoCompras();
}

function atualizarProgressoModoCompras() {
  const total = _modoItens.length;
  const feitos = _modoItens.filter(i => i.preenchido).length;
  const totalValor = _modoItens.reduce((s,i) => s + (Number(i.valor)||0), 0);
  const pct = total ? (feitos/total)*100 : 0;
  document.getElementById('modoProgressoTexto').textContent = `${feitos} / ${total} itens`;
  document.getElementById('modoProgressoTotal').textContent = formatBRL(totalValor);
  document.getElementById('modoProgressoBar').style.width = pct + '%';
}

let _rascunhoTimer = null;
function salvarRascunhoModoCompras() {
  // Debounce: salva 800ms após a última mudança
  clearTimeout(_rascunhoTimer);
  _rascunhoTimer = setTimeout(async () => {
    if (!_modoListaId) return;
    try {
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'listas-compras', _modoListaId), {
        itens: _modoItens.map(i => ({
          nome: i.nome, preenchido: !!i.preenchido,
          valor: Number(i.valor) || 0, cat: i.cat,
        })),
        atualizadoEm: serverTimestamp(),
      });
    } catch (e) { warn('rascunho modo compras', e); }
  }, 800);
}

function fecharModoCompras() {
  // Garante salvar pendências
  clearTimeout(_rascunhoTimer);
  if (_modoListaId) {
    salvarRascunhoModoCompras();
    setTimeout(() => {
      document.getElementById('modalModoCompras').classList.remove('open');
      _modoListaId = null; _modoItens = [];
    }, 100);
  } else {
    document.getElementById('modalModoCompras').classList.remove('open');
  }
}

async function finalizarModoCompras() {
  const itensComValor = _modoItens.filter(i => Number(i.valor) > 0);
  if (!itensComValor.length) { showToast('Preencha pelo menos 1 valor', 'error'); return; }

  // Pré-popula modal de Nova Compra com os itens preenchidos
  const lista = listasCache.find(l => l.id === _modoListaId);
  const fakeCompra = {
    mercado: lista?.mercado || lista?.nome || '',
    dataReferencia: hojeISO(),
    itens: itensComValor.map(i => ({
      desc: i.nome, valor: Number(i.valor) || 0, cat: i.cat,
    })),
  };

  // Marca a lista como concluída ao salvar a compra (override do salvarCompra)
  const listaIdParaConcluir = _modoListaId;

  // Fecha o modal de Modo Compras
  document.getElementById('modalModoCompras').classList.remove('open');
  _modoListaId = null; _modoItens = [];

  abrirModalCompra(fakeCompra);

  // Hook: quando o usuário clicar em Salvar, marcamos a lista como concluída
  // Solução simples: armazena id pendente e o handler de salvar trata.
  document.getElementById('compraId').value = '';   // garante CRIAR (não editar)
  _pendenteConcluirListaId  = listaIdParaConcluir;
  _pendenteTotalGasto        = itensComValor.reduce((s, i) => s + Number(i.valor), 0);
  // PEND-MER-04: estimativa baseada no histórico de preços
  _pendenteTotalEstimado = lista
    ? (lista.itens || []).reduce((s, it) => s + ultimoPrecoItem(it.nome) * (it.qtd || 1), 0)
    : 0;
}
let _pendenteConcluirListaId  = null;
let _pendenteTotalEstimado    = 0;

// ─── Filtros + estado UI novo ────────────────────────────────────────────
let _filtroBusca  = '';
let _filtroMes    = '';   // 'YYYY-MM' ou '' (todos)
let _filtroForma  = '';   // forma de pagamento ou '' (todas)
let _graficoDonutInst = null;  // instância Chart.js
let _detalheCompraAtual = null;
let _listaBusca = '';
let _listasHistExpand = false;
let _pendenteTotalGasto = 0;

// ─── Carteira / cartões para chips de pagamento (BUG 13) ─────────
async function carregarCartoes() {
  try {
    const snap = await getDocs(query(
      collection(db, 'usuarios', currentUser.uid, 'cartoes'),
      orderBy('nome', 'asc')
    ));
    cartoesCache = [];
    snap.forEach(d => cartoesCache.push({ id: d.id, ...d.data() }));
  } catch (e) {
    error('carregarCartoes', e);
    cartoesCache = []; // BUG 13: fallback (chips fixos no FORMAS_PAGAMENTO_FALLBACK)
  }
}

// Carteira (conta corrente + cartões + vales + dinheiro) — fonte unificada de pagamentos.
// Tela de Carteira a ser criada gravará em usuarios/{uid}/carteira/{id} = { nome, tipo, ... }
async function carregarCarteiras() {
  try {
    const snap = await getDocs(query(
      collection(db, 'usuarios', currentUser.uid, 'carteira'),
      orderBy('nome', 'asc')
    ));
    carteirasCache = [];
    snap.forEach(d => carteirasCache.push({ id: d.id, ...d.data() }));
  } catch (e) {
    warn('carregarCarteiras', e);
    carteirasCache = [];
  }
}

// ─── onSnapshot (BUG 6) ──────────────────────────────────────────
function assinarCompras() {
  const q = query(
    collection(db, 'usuarios', currentUser.uid, 'compras'),
    orderBy('criadoEm', 'desc'),
    limit(QUERY_LIMIT)
  );
  const unsub = onSnapshot(q, (snap) => {
    comprasCache = [];
    snap.forEach(d => comprasCache.push({ id: d.id, ...d.data() }));
    if (abaAtual === 'compras') renderCompras();
  }, (err) => {
    error('snapshot compras', err);
    showToast('Erro ao sincronizar compras', 'error');
  });
  _unsubs.push(unsub);
}

function assinarListas() {
  const q = query(
    collection(db, 'usuarios', currentUser.uid, 'listas-compras'),
    orderBy('criadoEm', 'desc'),
    limit(QUERY_LIMIT)
  );
  const unsub = onSnapshot(q, (snap) => {
    listasCache = [];
    snap.forEach(d => listasCache.push({ id: d.id, ...d.data() }));
    if (abaAtual === 'listas') renderListas();
  }, (err) => {
    error('snapshot listas', err);
    showToast('Erro ao sincronizar listas', 'error');
  });
  _unsubs.push(unsub);
}

// ─── Wire up DOM events ──────────────────────────────────────────
function wireUp() {
  // Compra
  document.getElementById('btnFecharModalCompra').addEventListener('click', fecharModalCompra);
  document.getElementById('btnCancelarCompra').addEventListener('click', fecharModalCompra);
  document.getElementById('btnSalvarCompra').addEventListener('click', async () => {
    await salvarCompra();
    // Se veio do Modo Compras, conclui a lista após salvar
    if (_pendenteConcluirListaId && !_salvando) {
      try {
        await updateDoc(doc(db, 'usuarios', currentUser.uid, 'listas-compras', _pendenteConcluirListaId), {
          status: 'concluida',
          concluidaEm: serverTimestamp(),
          ...(_pendenteTotalGasto    > 0 ? { totalGasto: _pendenteTotalGasto }       : {}),
          ...(_pendenteTotalEstimado > 0 ? { totalEstimado: _pendenteTotalEstimado } : {}),
        });
      } catch (e) { warn('concluir lista', e); }
      _pendenteConcluirListaId  = null;
      _pendenteTotalGasto       = 0;
      _pendenteTotalEstimado    = 0;
    }
  });
  document.getElementById('compraData').addEventListener('input', (e) => aplicarMascaraData(e.target));

  // Add item compra (BUG 12: input inline, sem prompt)
  document.getElementById('btnAddItem').addEventListener('click', adicionarItemCompra);
  document.getElementById('novoItemNome').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarItemCompra(); } });
  document.getElementById('novoItemValor').addEventListener('input', (e) => aplicarMascaraValor(e.target));
  document.getElementById('novoItemValor').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarItemCompra(); } });

  // Lista
  document.getElementById('btnFecharModalLista').addEventListener('click', fecharModalLista);
  document.getElementById('btnCancelarLista').addEventListener('click', fecharModalLista);
  document.getElementById('btnSalvarLista').addEventListener('click', salvarLista);
  document.getElementById('btnAddItemLista').addEventListener('click', adicionarItemLista);
  document.getElementById('novoItemListaNome').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarItemLista(); } });

  // Modo Compras (BUG 12)
  document.getElementById('btnFecharModoCompras').addEventListener('click', fecharModoCompras);
  document.getElementById('btnCancelarModoCompras').addEventListener('click', fecharModoCompras);
  document.getElementById('btnFinalizarModoCompras').addEventListener('click', finalizarModoCompras);
  document.getElementById('btnAddItemModo').addEventListener('click', adicionarItemModo);
  document.getElementById('modoNovoItemNome').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarItemModo(); } });

  // Click fora dos modais para fechar (apenas Compra/Lista; Modo Compras NÃO fecha por fora pra evitar perda de progresso)
  document.getElementById('modalCompra').addEventListener('click', (e) => {
    if (e.target.id === 'modalCompra') fecharModalCompra();
  });
  document.getElementById('modalLista').addEventListener('click', (e) => {
    if (e.target.id === 'modalLista') fecharModalLista();
  });

  // Detalhe da compra
  const fecharDetalhe = () => document.getElementById('modalDetalheCompra').classList.remove('open');
  document.getElementById('btnFecharDetalheCompra').addEventListener('click', fecharDetalhe);
  document.getElementById('btnFecharDetalheCompra2').addEventListener('click', fecharDetalhe);
  document.getElementById('btnCriarListaDaCompra').addEventListener('click', () => {
    if (_detalheCompraAtual) criarListaDaCompra(_detalheCompraAtual);
  });
  document.getElementById('modalDetalheCompra').addEventListener('click', (e) => {
    if (e.target.id === 'modalDetalheCompra') fecharDetalhe();
  });

  // Ordenar itens da lista por categoria
  document.getElementById('btnOrdenarLista').addEventListener('click', ordenarItensPorCategoria);
}

function adicionarItemCompra() {
  const inpN = document.getElementById('novoItemNome');
  const inpV = document.getElementById('novoItemValor');
  const nome = sanitize(inpN.value).slice(0, 60);
  const valor = parseBRL(inpV.value);
  if (!nome) { inpN.focus(); return; }
  _itensCompra.push({ desc: nome, valor, cat: inferirCategoriaItem(nome) });
  inpN.value = ''; inpV.value = '';
  renderItensCompra();
  inpN.focus();
}

function adicionarItemLista() {
  const inp = document.getElementById('novoItemListaNome');
  const nome = sanitize(inp.value).slice(0, 60);
  if (!nome) { inp.focus(); return; }
  _itensLista.push({ nome, preenchido: false, valor: 0, qtd: 1, cat: inferirCategoriaItem(nome) });
  inp.value = '';
  renderItensLista();
  inp.focus();
}

function adicionarItemModo() {
  const inp = document.getElementById('modoNovoItemNome');
  const nome = sanitize(inp.value).slice(0, 60);
  if (!nome) { inp.focus(); return; }
  _modoItens.push({ nome, preenchido: false, valor: 0, cat: inferirCategoriaItem(nome) });
  inp.value = '';
  renderModoCompras();
  salvarRascunhoModoCompras();
  inp.focus();
}

// ═════════════════════════════════════════════════════════════════
// ─── IMPORTAÇÃO POR IA (Foto / PDF / Texto) ───────────────────────
// ═════════════════════════════════════════════════════════════════

const itemKey = (nome) => String(nome || '').toLowerCase().trim().replace(/\s+/g,' ').slice(0, 60);

async function carregarPlanoUsuario() {
  try {
    const snap = await getDoc(doc(db, 'usuarios', currentUser.uid));
    const d = snap.exists() ? snap.data() : {};
    _planoUsuario = (d.plano || 'free').toLowerCase();
  } catch (e) {
    warn('plano usuario', e);
    _planoUsuario = 'free';
  }
}

function periodoAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function carregarUsoIA() {
  try {
    const snap = await getDoc(doc(db, 'usuarios', currentUser.uid, 'uso-ia', periodoAtual()));
    _usoIAMes = snap.exists() ? (snap.data().mercado || 0) : 0;
  } catch (e) { warn('uso IA', e); _usoIAMes = 0; }
}

async function incrementarUsoIA() {
  try {
    await setDoc(
      doc(db, 'usuarios', currentUser.uid, 'uso-ia', periodoAtual()),
      { mercado: increment(1), atualizadoEm: serverTimestamp() },
      { merge: true }
    );
    _usoIAMes++;
    atualizarChipQuota();
  } catch (e) { warn('inc uso IA', e); }
}

function limiteIA() { return IA_LIMITES_PLANO[_planoUsuario] || 5; }
function restanteIA() { return Math.max(0, limiteIA() - _usoIAMes); }

function atualizarChipQuota() {
  const el = document.getElementById('iaQuota');
  if (!el) return;
  const lim = limiteIA();
  const rest = restanteIA();
  if (lim >= 9999) {
    el.textContent = '✨ Uso ilimitado neste plano';
    el.classList.remove('low','zero');
  } else {
    el.textContent = `${rest} de ${lim} extrações restantes este mês`;
    el.classList.toggle('low', rest > 0 && rest <= 2);
    el.classList.toggle('zero', rest === 0);
  }
}

async function carregarAprendizadoCategorias() {
  if (_aprendizadoCacheCarregado) return;
  try {
    const snap = await getDocs(query(
      collection(db, 'usuarios', currentUser.uid, 'aprendizado-itens'),
      limit(500)
    ));
    snap.forEach(d => {
      const data = d.data();
      if (data.cat) _aprendizadoCache[d.id] = data.cat;
    });
    _aprendizadoCacheCarregado = true;
  } catch (e) { warn('aprendizado categorias', e); }
}

async function carregarMercadosConhecidos() {
  try {
    const snap = await getDocs(query(
      collection(db, 'usuarios', currentUser.uid, 'mercados-conhecidos'),
      limit(50)
    ));
    snap.forEach(d => {
      const data = d.data();
      if (data.cnpj) _mercadosConhecidos[data.cnpj] = data.nome || d.id;
    });
  } catch (e) { warn('mercados conhecidos', e); }
}

async function registrarAprendizadoCategoria(nome, catCorrigida) {
  if (!nome || !catCorrigida) return;
  const k = itemKey(nome);
  if (!k) return;
  // Apenas registra se difere do cache atual
  if (_aprendizadoCache[k] === catCorrigida) return;
  _aprendizadoCache[k] = catCorrigida;
  try {
    await setDoc(
      doc(db, 'usuarios', currentUser.uid, 'aprendizado-itens', k),
      { cat: catCorrigida, atualizadoEm: serverTimestamp() },
      { merge: true }
    );
  } catch (e) { warn('aprend cat save', e); }
}

async function registrarMercadoConhecido(cnpj, nome) {
  if (!cnpj || !nome) return;
  if (_mercadosConhecidos[cnpj] === nome) return;
  _mercadosConhecidos[cnpj] = nome;
  try {
    await setDoc(
      doc(db, 'usuarios', currentUser.uid, 'mercados-conhecidos', cnpj),
      { cnpj, nome, atualizadoEm: serverTimestamp() },
      { merge: true }
    );
  } catch (e) { warn('mercado conhec save', e); }
}

// ─── Modal Import IA: abrir/fechar/tabs ──────────────────────────
function abrirModalImportIA() {
  if (!currentUser) return;
  // Resetar estado
  _iaArquivos.forEach(a => { try { URL.revokeObjectURL(a.url); } catch(e){} });
  _iaArquivos = [];
  _iaResultado = null;
  document.getElementById('inputFotoIA').value = '';
  document.getElementById('inputPdfIA').value = '';
  document.getElementById('inputTextoIA').value = '';
  document.getElementById('textoCharCount').textContent = '0 / 8000';
  document.getElementById('iaProgress').style.display = 'none';
  document.getElementById('iaProgressBar').style.width = '0';
  document.getElementById('btnEnviarIA').disabled = true;
  document.getElementById('btnEnviarIA').textContent = 'Analisar com IA';
  setTabIA('foto');
  renderThumbsIA();
  atualizarChipQuota();
  document.getElementById('modalImportIA').classList.add('open');
}

function fecharModalImportIA() {
  document.getElementById('modalImportIA').classList.remove('open');
  _iaArquivos.forEach(a => { try { URL.revokeObjectURL(a.url); } catch(e){} });
  _iaArquivos = [];
}

function setTabIA(tab) {
  _iaTabAtual = tab;
  document.querySelectorAll('.ia-tab').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-iatab') === tab));
  document.querySelectorAll('.ia-pane').forEach(p =>
    p.classList.toggle('active', p.getAttribute('data-iapane') === tab));
  validarBotaoEnviarIA();
}

function validarBotaoEnviarIA() {
  const btn = document.getElementById('btnEnviarIA');
  let enabled = false;
  if (_iaTabAtual === 'foto' || _iaTabAtual === 'pdf') {
    enabled = _iaArquivos.length > 0;
    btn.textContent = `Analisar ${_iaArquivos.length || ''} ${_iaArquivos.length === 1 ? 'arquivo' : 'arquivos'} com IA`.replace('  ',' ');
  } else {
    const txt = document.getElementById('inputTextoIA').value.trim();
    enabled = txt.length >= 20;
    btn.textContent = 'Analisar texto com IA';
  }
  // Bloqueio de quota
  if (restanteIA() === 0) {
    enabled = false;
    btn.textContent = 'Limite mensal atingido';
  }
  btn.disabled = !enabled;
}

function aceitarArquivoIA(file) {
  if (file.size > IA_MAX_SIZE_MB * 1024 * 1024) {
    showToast(`Arquivo > ${IA_MAX_SIZE_MB}MB. Comprima ou tire uma foto menor.`, 'error');
    return false;
  }
  const okMime = ['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'];
  if (!okMime.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|pdf|heic|heif)$/i)) {
    showToast('Formato não suportado. Use JPG, PNG, WEBP ou PDF.', 'error');
    return false;
  }
  return true;
}

function adicionarArquivosIA(files) {
  // PDF aba: 1 arquivo só
  const isPdf = _iaTabAtual === 'pdf';
  for (const f of files) {
    if (isPdf && f.type !== 'application/pdf') continue;
    if (!isPdf && f.type === 'application/pdf') continue;
    if (!aceitarArquivoIA(f)) continue;
    if (_iaArquivos.length >= IA_MAX_FILES) {
      showToast(`Máximo ${IA_MAX_FILES} arquivos.`, 'warning');
      break;
    }
    if (isPdf && _iaArquivos.length >= 1) {
      // Substitui PDF antigo
      _iaArquivos.forEach(a => { try { URL.revokeObjectURL(a.url); } catch(e){} });
      _iaArquivos = [];
    }
    _iaArquivos.push({ file: f, url: URL.createObjectURL(f) });
  }
  renderThumbsIA();
  validarBotaoEnviarIA();
}

function renderThumbsIA() {
  const contFoto = document.getElementById('iaThumbsFoto');
  const contPdf  = document.getElementById('iaThumbsPdf');
  const dropFoto = document.getElementById('iaDropzoneFoto');
  const dropPdf  = document.getElementById('iaDropzonePdf');

  if (_iaTabAtual === 'foto') {
    if (!_iaArquivos.length) { contFoto.innerHTML = ''; dropFoto.classList.remove('has-files'); return; }
    dropFoto.classList.add('has-files');
    const addMaisBtn = _iaArquivos.length < IA_MAX_FILES
      ? `<div class="ia-thumb" id="iaBtnAddMais" style="border:2px dashed #3b82f6;background:#eff6ff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;" title="Adicionar mais fotos">
          <span style="font-size:1.25rem;line-height:1;">+</span>
          <span style="font-size:0.55rem;color:#3b82f6;font-weight:700;">${_iaArquivos.length}/${IA_MAX_FILES}</span>
        </div>`
      : '';
    contFoto.innerHTML = _iaArquivos.map((a, idx) => {
      const isImg = a.file.type.startsWith('image/');
      return `
        <div class="ia-thumb">
          ${isImg ? `<img src="${a.url}" alt="">` : `<div style="font-size:1.5rem;display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f1f5f9;">📄</div>`}
          <button type="button" class="ia-thumb-rm" data-idx="${idx}" aria-label="Remover">✕</button>
        </div>`;
    }).join('') + addMaisBtn;
    contFoto.querySelectorAll('.ia-thumb-rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = +btn.getAttribute('data-idx');
        try { URL.revokeObjectURL(_iaArquivos[idx].url); } catch(e){}
        _iaArquivos.splice(idx, 1);
        renderThumbsIA();
        validarBotaoEnviarIA();
      });
    });
    contFoto.querySelector('#iaBtnAddMais')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('inputFotoIA').click();
    });
  } else if (_iaTabAtual === 'pdf') {
    if (!_iaArquivos.length) { contPdf.innerHTML = ''; dropPdf.classList.remove('has-files'); return; }
    dropPdf.classList.add('has-files');
    contPdf.innerHTML = _iaArquivos.map((a, idx) => `
      <div class="ia-thumb" style="width:auto;height:auto;padding:0.5rem 0.75rem;font-size:0.75rem;font-weight:600;">
        📄 ${escapeHTML(a.file.name)}
        <button type="button" class="ia-thumb-rm" data-idx="${idx}">✕</button>
      </div>`).join('');
    contPdf.querySelectorAll('.ia-thumb-rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        try { URL.revokeObjectURL(_iaArquivos[+btn.getAttribute('data-idx')].url); } catch(e){}
        _iaArquivos = [];
        renderThumbsIA();
        validarBotaoEnviarIA();
      });
    });
  }
}

// ─── Converte páginas de um PDF em blobs JPEG (usa PDF.js do CDN) ───
async function pdfParaImagens(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js não carregado.');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const blobs = [];
  const maxPages = Math.min(pdf.numPages, 3); // máx 3 páginas = 3 arquivos
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 3.0 }); // maior resolução → melhor OCR
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
    blobs.push(blob);
  }
  return blobs;
}

// ─── Envio para backend ──────────────────────────────────────────
async function enviarParaIA() {
  if (restanteIA() === 0) {
    showToast(`Limite de ${limiteIA()} extrações/mês atingido. Faça upgrade para Plus.`, 'warning');
    return;
  }

  const prog = document.getElementById('iaProgress');
  const progBar = document.getElementById('iaProgressBar');
  const progText = document.getElementById('iaProgressText');
  const btn = document.getElementById('btnEnviarIA');

  btn.disabled = true;
  btn.textContent = 'Analisando…';
  prog.style.display = 'block';
  progBar.style.width = '15%';
  progText.textContent = 'Enviando…';

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), IA_TIMEOUT_MS);

  try {
    let resp;
    if (_iaTabAtual === 'texto') {
      const texto = document.getElementById('inputTextoIA').value.trim();
      progText.textContent = 'Lendo texto…';
      progBar.style.width = '40%';
      resp = await fetch(`${BUD_BACKEND_URL}/api/extrair-cupom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
        signal: ctrl.signal,
      });
    } else {
      const fd = new FormData();
      // PDFs escaneados: converte páginas para JPEG no browser antes de enviar
      let arquivosParaEnviar = [];
      for (const a of _iaArquivos) {
        if (a.file.type === 'application/pdf') {
          progText.textContent = 'Convertendo PDF em imagem…';
          progBar.style.width = '20%';
          const imgs = await pdfParaImagens(a.file);
          imgs.forEach((blob, i) => arquivosParaEnviar.push(new File([blob], `pagina${i+1}.jpg`, { type: 'image/jpeg' })));
        } else {
          arquivosParaEnviar.push(a.file);
        }
      }
      arquivosParaEnviar.forEach(f => fd.append('arquivos', f));
      progText.textContent = arquivosParaEnviar.length > 1 ? `Analisando ${arquivosParaEnviar.length} imagens…` : 'Analisando imagem…';
      progBar.style.width = '40%';
      resp = await fetch(`${BUD_BACKEND_URL}/api/extrair-cupom`, {
        method: 'POST', body: fd, signal: ctrl.signal,
      });
    }
    clearTimeout(tid);
    progBar.style.width = '85%';
    progText.textContent = 'Processando itens…';

    if (!resp.ok) {
      let msg = 'Erro no servidor.';
      try { const j = await resp.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    const data = await resp.json();
    if (!data.itens || !data.itens.length) throw new Error('Nenhum item identificado.');

    progBar.style.width = '100%';

    // Pós-processamento client-side: aprendizado + mercado conhecido
    _iaResultado = posProcessarIA(data);

    // Conta uso (apenas se não foi cache)
    if (!data.cached) {
      await incrementarUsoIA();
    } else {
      showToast('Nota importada do cache (já analisada anteriormente)', 'info');
    }

    // Abre tela de revisão
    fecharModalImportIA();
    abrirModalReviewIA();
  } catch (err) {
    clearTimeout(tid);
    error('enviarParaIA', err);
    // PEND-MER-08: tentar OCR local com Tesseract.js quando IA falha em imagem
    if (err.name !== 'AbortError' && _iaTabAtual === 'foto' && _iaArquivos.length > 0) {
      await _tentarOcrFallback(_iaArquivos[0].file, prog, progBar, progText, btn);
    } else {
      const msg = err.name === 'AbortError'
        ? 'Tempo limite excedido. Tente uma imagem menor.'
        : (err.message || 'Falha ao processar.');
      showToast(msg, 'error');
      prog.style.display = 'none';
      progBar.style.width = '0';
      btn.disabled = false;
      validarBotaoEnviarIA();
    }
  }
}

// ─── PEND-MER-08: OCR local via Tesseract.js (fallback quando IA indisponível) ──
async function _tentarOcrFallback(file, prog, progBar, progText, btn) {
  showToast('🔍 IA indisponível. Tentando leitura offline…', 'info', 4000);
  if (prog) prog.style.display = 'block';
  if (progText) progText.textContent = 'Carregando leitor OCR…';
  if (progBar) progBar.style.width = '10%';

  try {
    // Lazy-load Tesseract.js
    if (!window.Tesseract) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    if (progText) progText.textContent = 'Lendo texto da imagem…';
    if (progBar) progBar.style.width = '40%';

    const worker = await window.Tesseract.createWorker('por', 1);
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const textoOCR = (data.text || '').trim();

    if (!textoOCR) throw new Error('OCR não reconheceu texto na imagem.');

    if (progBar) progBar.style.width = '70%';
    if (progText) progText.textContent = 'Analisando texto…';

    // Redireciona para o fluxo de análise de texto
    const ctrl2 = new AbortController();
    const tid2 = setTimeout(() => ctrl2.abort(), IA_TIMEOUT_MS);
    const resp = await fetch(`${BUD_BACKEND_URL}/api/extrair-cupom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoOCR }),
      signal: ctrl2.signal,
    });
    clearTimeout(tid2);

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Erro ${resp.status}`);
    }
    const data2 = await resp.json();
    if (progBar) progBar.style.width = '100%';
    _iaResultado = posProcessarIA(data2);
    fecharModalImportIA();
    abrirModalReviewIA();
  } catch (e2) {
    error('_tentarOcrFallback', e2);
    showToast('Leitura offline falhou. Tente novamente com imagem mais nítida.', 'error');
  } finally {
    if (prog) { prog.style.display = 'none'; if (progBar) progBar.style.width = '0'; }
    if (btn) { btn.disabled = false; validarBotaoEnviarIA(); }
  }
}


  // 1) Mercado: se o CNPJ já é conhecido, usa o nome curto que o usuário gravou
  let mercado = data.mercado || '';
  if (data.cnpj && _mercadosConhecidos[data.cnpj]) {
    mercado = _mercadosConhecidos[data.cnpj];
  }
  // 2) Itens: validar categoria e aplicar aprendizado
  const itens = (data.itens || []).map(it => {
    let cat = CATEGORIAS_IA.includes(it.cat) ? it.cat : inferirCategoriaItem(it.nome);
    const k = itemKey(it.nome);
    if (_aprendizadoCache[k]) cat = _aprendizadoCache[k];
    return {
      nome: it.nome,
      qtd: Math.max(1, Number(it.qtd) || 1),
      valor: Number(it.valor) || 0,
      cat,
      _selected: true,
      _origemCat: it.cat || '', // pra detectar correção do usuário
    };
  });
  return { mercado, cnpj: data.cnpj || '', data: data.data || hojeISO(), itens };
}

// ─── Modal Review IA ─────────────────────────────────────────────
function abrirModalReviewIA() {
  if (!_iaResultado) return;
  _iaItensReview = _iaResultado.itens.map(i => ({...i}));
  document.getElementById('reviewMercado').value = _iaResultado.mercado || '';
  const dataIso = _iaResultado.data && /^\d{4}-\d{2}-\d{2}$/.test(_iaResultado.data) ? _iaResultado.data : hojeISO();
  document.getElementById('reviewData').value = formatDataBR(dataIso);
  document.getElementById('reviewNovoItem').value = '';
  document.getElementById('reviewNovoValor').value = '';
  renderReviewItens();
  document.getElementById('modalReviewIA').classList.add('open');
}

function fecharModalReviewIA() {
  document.getElementById('modalReviewIA').classList.remove('open');
  _iaItensReview = [];
}

function renderReviewItens() {
  const cont = document.getElementById('reviewItensContainer');
  if (!_iaItensReview.length) {
    cont.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--card-text-sec);font-size:0.8125rem;">Nenhum item</div>';
  } else {
    cont.innerHTML = _iaItensReview.map((it, idx) => {
      const opts = CATEGORIAS_IA.map(c => `<option value="${escapeHTML(c)}"${c === it.cat ? ' selected' : ''}>${escapeHTML(c)}</option>`).join('');
      return `
        <div class="review-row${it._selected ? '' : ' unchecked'}" data-idx="${idx}">
          <input type="checkbox" class="review-check" data-act="check" ${it._selected ? 'checked' : ''}>
          <input type="text" class="review-nome" data-act="nome" value="${escapeHTML(it.nome)}" maxlength="60">
          <input type="text" class="review-qtd" data-act="qtd" value="${it.qtd}" inputmode="decimal">
          <input type="text" class="review-valor" data-act="valor" value="${formatBRL(it.valor).replace('R$ ','')}" inputmode="decimal">
          <select class="review-cat" data-act="cat">${opts}</select>
          <button type="button" class="review-rm" data-act="rm" aria-label="Remover">✕</button>
        </div>`;
    }).join('');
    cont.querySelectorAll('.review-row').forEach(row => {
      const idx = +row.getAttribute('data-idx');
      row.querySelector('[data-act="check"]').addEventListener('change', (e) => {
        _iaItensReview[idx]._selected = e.target.checked;
        row.classList.toggle('unchecked', !e.target.checked);
        atualizarReviewSummary();
      });
      row.querySelector('[data-act="nome"]').addEventListener('input', (e) => { _iaItensReview[idx].nome = e.target.value; });
      row.querySelector('[data-act="qtd"]').addEventListener('input', (e) => {
        _iaItensReview[idx].qtd = parseFloat(String(e.target.value).replace(',', '.')) || 1;
      });
      row.querySelector('[data-act="valor"]').addEventListener('input', (e) => {
        aplicarMascaraValor(e.target);
        _iaItensReview[idx].valor = parseBRL(e.target.value);
        atualizarReviewSummary();
      });
      row.querySelector('[data-act="cat"]').addEventListener('change', (e) => {
        _iaItensReview[idx].cat = e.target.value;
      });
      row.querySelector('[data-act="rm"]').addEventListener('click', () => {
        _iaItensReview.splice(idx, 1);
        renderReviewItens();
      });
    });
  }
  atualizarReviewSummary();
}

function atualizarReviewSummary() {
  const sel = _iaItensReview.filter(i => i._selected);
  const total = sel.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  document.getElementById('reviewQtdItens').textContent = `${sel.length} ${sel.length === 1 ? 'item marcado' : 'itens marcados'}`;
  document.getElementById('reviewTotal').textContent = formatBRL(total);
}

async function confirmarReviewIA() {
  const sel = _iaItensReview.filter(i => i._selected && i.valor > 0 && i.nome.trim());
  if (!sel.length) { showToast('Marque ao menos 1 item com valor', 'error'); return; }

  // Aprendizado: salvar correções de categoria em background
  const corrigidos = sel.filter(i => i._origemCat && i._origemCat !== i.cat);
  Promise.all(corrigidos.map(i => registrarAprendizadoCategoria(i.nome, i.cat))).catch(()=>{});

  // Mercado conhecido: salvar mapeamento CNPJ → nome curto
  const mercadoFinal = sanitize(document.getElementById('reviewMercado').value).slice(0, 60);
  const dataFinal = parseDataBR(document.getElementById('reviewData').value) || hojeISO();
  if (_iaResultado && _iaResultado.cnpj && mercadoFinal) {
    registrarMercadoConhecido(_iaResultado.cnpj, mercadoFinal).catch(()=>{});
  }

  // Pré-popula o modal Nova Compra com os itens revisados
  fecharModalReviewIA();
  const fakeCompra = {
    mercado: mercadoFinal,
    dataReferencia: dataFinal,
    itens: sel.map(i => ({
      desc: i.nome.trim(),
      valor: Number(i.valor) || 0,
      cat: i.cat,
    })),
  };
  abrirModalCompra(fakeCompra);
  // Garante CRIAR (não editar)
  document.getElementById('compraId').value = '';
}

// ─── Wire up Import IA ───────────────────────────────────────────
function setupImportIA() {
  const btn = document.getElementById('btnImportarIA');
  if (btn) btn.addEventListener('click', abrirModalImportIA);

  document.getElementById('btnFecharImportIA').addEventListener('click', fecharModalImportIA);
  document.getElementById('btnCancelarImportIA').addEventListener('click', fecharModalImportIA);
  document.getElementById('btnEnviarIA').addEventListener('click', enviarParaIA);

  document.querySelectorAll('.ia-tab').forEach(b => {
    b.addEventListener('click', () => setTabIA(b.getAttribute('data-iatab')));
  });

  // Dropzone Foto
  const dzF = document.getElementById('iaDropzoneFoto');
  const inF = document.getElementById('inputFotoIA');
  dzF.addEventListener('click', () => inF.click());
  inF.addEventListener('change', (e) => { adicionarArquivosIA(e.target.files); e.target.value = ''; });
  dzF.addEventListener('dragover', (e) => { e.preventDefault(); dzF.style.borderColor = '#3b82f6'; });
  dzF.addEventListener('dragleave', () => { dzF.style.borderColor = ''; });
  dzF.addEventListener('drop', (e) => {
    e.preventDefault(); dzF.style.borderColor = '';
    if (e.dataTransfer?.files) adicionarArquivosIA(e.dataTransfer.files);
  });

  // Dropzone PDF
  const dzP = document.getElementById('iaDropzonePdf');
  const inP = document.getElementById('inputPdfIA');
  dzP.addEventListener('click', () => inP.click());
  inP.addEventListener('change', (e) => { adicionarArquivosIA(e.target.files); e.target.value = ''; });
  dzP.addEventListener('dragover', (e) => { e.preventDefault(); dzP.style.borderColor = '#3b82f6'; });
  dzP.addEventListener('dragleave', () => { dzP.style.borderColor = ''; });
  dzP.addEventListener('drop', (e) => {
    e.preventDefault(); dzP.style.borderColor = '';
    if (e.dataTransfer?.files) adicionarArquivosIA(e.dataTransfer.files);
  });

  // Texto
  const ta = document.getElementById('inputTextoIA');
  const cc = document.getElementById('textoCharCount');
  ta.addEventListener('input', () => {
    cc.textContent = `${ta.value.length} / 8000`;
    validarBotaoEnviarIA();
  });

  // Click fora pra fechar
  document.getElementById('modalImportIA').addEventListener('click', (e) => {
    if (e.target.id === 'modalImportIA') fecharModalImportIA();
  });

  // Review
  document.getElementById('btnFecharReviewIA').addEventListener('click', fecharModalReviewIA);
  document.getElementById('btnVoltarReviewIA').addEventListener('click', () => {
    fecharModalReviewIA();
    abrirModalImportIA();
  });
  document.getElementById('btnConfirmarReviewIA').addEventListener('click', confirmarReviewIA);
  document.getElementById('reviewData').addEventListener('input', (e) => aplicarMascaraData(e.target));
  document.getElementById('btnAddItemReview').addEventListener('click', () => {
    const inN = document.getElementById('reviewNovoItem');
    const inV = document.getElementById('reviewNovoValor');
    const nome = sanitize(inN.value).slice(0, 60);
    const valor = parseBRL(inV.value);
    if (!nome) { inN.focus(); return; }
    _iaItensReview.push({ nome, qtd: 1, valor, cat: inferirCategoriaItem(nome), _selected: true, _origemCat: '' });
    inN.value = ''; inV.value = '';
    renderReviewItens();
    inN.focus();
  });
  document.getElementById('reviewNovoValor').addEventListener('input', (e) => aplicarMascaraValor(e.target));
}

// ─── Inicialização ───────────────────────────────────────────────
function preencherSidebarUser(user) {
  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
  document.getElementById('sidebarAvatar').textContent = initial;
  document.getElementById('sidebarUserName').textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
  document.getElementById('sidebarUserId').textContent = user.email || '';
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(null, user.displayName || user.email || '');
}

function ocultarSplash() {
  const sp = document.getElementById('splash');
  if (sp) {
    sp.classList.add('hide');
    setTimeout(() => sp.remove(), 600);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupTabs();
  wireUp();
  setupImportIA();

  onAuthStateChanged(auth, async (user) => {
    resetState();                                  // BUG 10
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    currentUser = user;
    preencherSidebarUser(user);
    // Carregar foto de perfil para sidebar
    getDoc(doc(db, 'usuarios', user.uid)).then(function(snap) {
      var ud = snap.exists() ? snap.data() : {};
      if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(ud.photoURL || null, ud.nome || user.displayName || '');
    }).catch(function() {});
    await carregarCartoes();
    await carregarCarteiras();
    assinarCompras();
    assinarListas();
    renderCompras();
    renderListas();
    // IA: carregamento em paralelo, não bloqueia UI
    Promise.all([
      carregarPlanoUsuario(),
      carregarUsoIA(),
      carregarAprendizadoCategorias(),
      carregarMercadosConhecidos(),
    ]).then(atualizarChipQuota).catch(()=>{});
    ocultarSplash();
  });
});
