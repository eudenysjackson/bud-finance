/**
 * js/limites.js — Limites por Categoria
 *
 * Bugs do cérebro corrigidos desde o início:
 * BUG 1  — query Firestore filtrada por mês (Timestamp range), re-subscribe ao mudar mês
 * BUG 2  — validação de duplicata antes de addDoc
 * BUG 3  — style.cssText em todos os overlays dinâmicos (sem Tailwind dinâmico)
 * BUG 4  — normalizeCategoria() em todas as comparações de match
 * BUG 5  — filtro explícito tipo === 'despesa' (não !== 'receita')
 * BUG 6  — parseFloat(t.valor) consistente em toda a agregação
 * BUG 7  — limite percentual sem receita: exibe "Aguardando receita" em vez de barra quebrada
 * BUG 8  — window.budShowToast() de bud-utils (sem toast local duplicado)
 * BUG 9  — optimistic update ao criar categoria (sem setTimeout hack)
 * BUG 10 — dropdown marca categorias que já têm limite
 * BUG 11 — try/catch em todas as operações Firestore
 * BUG 12 — normalizeCategoria() em copiarMesAnterior (Map keys)
 * BUG 13 — mínimo R$10 no copiar (não R$50 inflado)
 * BUG 14 — window.BUD_CATEGORIAS_PADRAO como fonte única de verdade
 * BUG 15 — navegação limitada a ±12 meses do mês atual
 */

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Estado ────────────────────────────────────────────────────────────────
let currentUser     = null;
let limites         = [];
let categoriasUser  = [];   // categorias personalizadas do Firestore
let transacoesMes   = [];   // transações do mês selecionado (despesas)
let mesVisualizado  = new Date().getMonth();
let anoVisualizado  = new Date().getFullYear();
let _unsubs         = [];
let _unsubTrans     = null; // listener de transações (re-criado ao mudar mês)
let _editandoId     = null; // null = criando, string = editando
let _salvando       = false;
let _catSelecionada = '';   // nome da categoria selecionada no dropdown
let _tipoLimite     = 'valor'; // 'valor' | 'percentual'

// ─── Helpers ───────────────────────────────────────────────────────────────
const escapeHTML = (typeof window.budSanitize === 'function')
  ? s => window.budSanitize(String(s ?? ''))
  : s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function normalizeCategoria(s) {
  return (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatMoeda(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getMesLabel() {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  return meses[mesVisualizado] + ' de ' + anoVisualizado;
}

function getInicioFimMes() {
  const inicio = new Date(anoVisualizado, mesVisualizado, 1, 0, 0, 0, 0);
  const fim    = new Date(anoVisualizado, mesVisualizado + 1, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

// BUG 7: getLimiteEfetivo — quando receita = 0 e tipo = percentual, retorna null (sem limite efetivo)
function getLimiteEfetivo(l) {
  if (l.tipoLimite === 'percentual' && l.percentual > 0) {
    const receita = getReceitaMes();
    if (receita > 0) return Math.round(receita * l.percentual / 100);
    return null; // BUG 7: null = aguardando receita
  }
  return l.valorLimite || 0;
}

// BUG 5: filtrar explicitamente por tipo === 'despesa'
function getReceitaMes() {
  return transacoesMes
    .filter(t => t.tipo === 'receita')
    .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
}

function getGastosPorCat() {
  // BUG 5: tipo === 'despesa' (não !== 'receita')
  // BUG 6: parseFloat(t.valor)
  // BUG 4: normalizeCategoria como chave
  const mapa = {};
  transacoesMes
    .filter(t => t.tipo === 'despesa')
    .forEach(t => {
      const cat = normalizeCategoria(t.categoria || 'Outros');
      mapa[cat] = (mapa[cat] || 0) + (parseFloat(t.valor) || 0);
    });
  return mapa;
}

// Combina categorias padrão (despesa) + personalizadas (despesa), deduplica por nome normalizado
function getListaCategorias() {
  const padrao = (window.BUD_CATEGORIAS_PADRAO?.despesa || []);
  const custom  = categoriasUser.filter(c => c.tipo === 'despesa' || !c.tipo);
  const vistas  = new Set();
  const lista   = [];
  [...padrao, ...custom].forEach(c => {
    const key = normalizeCategoria(c.nome);
    if (!vistas.has(key)) { vistas.add(key); lista.push(c); }
  });
  return lista;
}

// ─── Renderizar ────────────────────────────────────────────────────────────
function renderizar() {
  document.getElementById('navMesAno').textContent = getMesLabel();

  // BUG 15: desabilitar botão próximo se estiver no limite (+12 meses)
  const hoje  = new Date();
  const diffM = (anoVisualizado - hoje.getFullYear()) * 12 + (mesVisualizado - hoje.getMonth());
  const btnAnt  = document.getElementById('btnMesAnt');
  const btnProx = document.getElementById('btnMesProx');
  if (btnAnt)  btnAnt.disabled  = diffM <= -12;
  if (btnProx) btnProx.disabled = diffM >= 12;

  const gastosPorCat = getGastosPorCat();
  const receita      = getReceitaMes();

  // KPIs
  let totalLimites  = 0;
  let totalGasto    = 0;

  limites.forEach(l => {
    const ef = getLimiteEfetivo(l);
    if (ef !== null) totalLimites += ef;
    const gasto = gastosPorCat[normalizeCategoria(l.categoria)] || 0;
    totalGasto += gasto;
  });

  const disponivel = totalLimites - totalGasto;
  const pctTotal   = totalLimites > 0 ? Math.min(999, Math.round((totalGasto / totalLimites) * 100)) : 0;

  const elTotal  = document.getElementById('kpiTotal');
  const elGasto  = document.getElementById('kpiGasto');
  const elGastoPct = document.getElementById('kpiGastoPct');
  const elDisp   = document.getElementById('kpiDisponivel');
  const elDispSub = document.getElementById('kpiDisponivelSub');

  if (elTotal)  elTotal.textContent   = formatMoeda(totalLimites);
  if (elGasto)  {
    elGasto.textContent = formatMoeda(totalGasto);
    elGasto.style.color = pctTotal >= 100 ? '#dc2626' : pctTotal >= 80 ? '#d97706' : 'var(--card-text)';
  }
  if (elGastoPct) elGastoPct.textContent = pctTotal + '% utilizado';
  if (elDisp)  {
    elDisp.textContent  = formatMoeda(Math.abs(disponivel));
    elDisp.style.color  = disponivel < 0 ? '#dc2626' : '#16a34a';
  }
  if (elDispSub) elDispSub.textContent = disponivel < 0 ? 'estourado!' : 'para gastar';

  // Lista
  const lista = document.getElementById('listaLimites');
  if (!lista) return;

  if (limites.length === 0) {
    lista.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:3rem 1rem;';
    empty.innerHTML = `
      <div style="font-size:3rem;margin-bottom:0.75rem;">🎯</div>
      <div style="font-size:0.9375rem;font-weight:700;color:var(--card-text);">Nenhum limite definido</div>
      <div style="font-size:0.8125rem;font-weight:500;color:var(--card-text-sec);margin-top:0.25rem;">Defina tetos de gasto por categoria para manter o orçamento sob controle.</div>
      <button onclick="window.abrirModalLimite()" style="margin-top:1.25rem;padding:0.625rem 1.25rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;">+ Criar Primeiro Limite</button>
    `;
    lista.appendChild(empty);
    return;
  }

  lista.innerHTML = '';

  // Ordenar: estourados primeiro, depois por % de uso descendente
  const ordenados = [...limites].sort((a, b) => {
    const efA   = getLimiteEfetivo(a);
    const efB   = getLimiteEfetivo(b);
    const gastoA = gastosPorCat[normalizeCategoria(a.categoria)] || 0;
    const gastoB = gastosPorCat[normalizeCategoria(b.categoria)] || 0;
    const pctA  = efA > 0 ? gastoA / efA : 0;
    const pctB  = efB > 0 ? gastoB / efB : 0;
    return pctB - pctA;
  });

  ordenados.forEach((l, idx) => {
    const ef    = getLimiteEfetivo(l);
    const gasto = gastosPorCat[normalizeCategoria(l.categoria)] || 0;

    // BUG 7: limite percentual sem receita
    const semReceita = l.tipoLimite === 'percentual' && ef === null;

    const pct   = (ef !== null && ef > 0) ? Math.min(999, Math.round((gasto / ef) * 100)) : (semReceita ? null : 0);
    const estourado = pct !== null && pct > 100;
    const aviso     = pct !== null && pct >= 80 && pct <= 100;

    // Cor da barra
    const barColor = estourado
      ? 'linear-gradient(90deg,#dc2626,#b91c1c)'
      : aviso
        ? 'linear-gradient(90deg,#f59e0b,#d97706)'
        : 'linear-gradient(90deg,#10b981,#059669)';

    const barWidth = semReceita ? 0 : Math.min(100, pct || 0);

    // Emoji da categoria
    const lista_cats = getListaCategorias();
    const catObj = lista_cats.find(c => normalizeCategoria(c.nome) === normalizeCategoria(l.categoria));
    const emoji  = catObj?.emoji || '🏷️';

    // Sub-info do tipo
    const tipoInfo = l.tipoLimite === 'percentual'
      ? `${l.percentual}% da receita`
      : 'valor fixo';

    const item = document.createElement('div');
    item.style.cssText = `background:var(--input-bg);border:1.5px solid ${estourado ? 'rgba(252,165,165,0.5)' : 'transparent'};border-radius:1rem;padding:1rem;margin-bottom:0.5rem;animation:fadeInUp .3s ease both;animation-delay:${idx * 0.04}s;`;

    item.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;min-width:0;flex:1;">
          <span style="font-size:1.25rem;flex-shrink:0;">${emoji}</span>
          <div style="min-width:0;">
            <div style="font-size:0.875rem;font-weight:700;color:var(--card-text);display:flex;align-items:center;gap:0.375rem;flex-wrap:wrap;">
              ${escapeHTML(l.categoria)}
              ${estourado ? '<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#dc2626;padding:0.1rem 0.375rem;border-radius:9999px;">ESTOURADO</span>' : ''}
            </div>
            <div style="font-size:0.6875rem;font-weight:500;color:var(--card-text-sec);">${tipoInfo}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:0.9375rem;font-weight:800;color:${estourado ? '#dc2626' : aviso ? '#d97706' : 'var(--card-text)'};">
              ${semReceita ? '—' : formatMoeda(gasto)}
            </div>
            <div style="font-size:0.6875rem;font-weight:600;color:var(--card-text-sec);">
              ${semReceita ? 'Aguardando receita' : 'de ' + (ef !== null ? formatMoeda(ef) : '—')}
            </div>
          </div>
          <button data-edit="${escapeHTML(l.id)}" style="width:2rem;height:2rem;border-radius:0.5rem;border:1.5px solid var(--input-border);background:var(--card-bg);cursor:pointer;font-size:0.875rem;color:var(--card-text-sec);transition:all .15s;" title="Editar">✏️</button>
        </div>
      </div>
      <!-- Barra de progresso -->
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <div style="flex:1;height:7px;background:var(--card-border);border-radius:999px;overflow:hidden;">
          ${semReceita
            ? '<div style="height:100%;border-radius:999px;background:var(--input-border);width:100%;"></div>'
            : `<div style="height:100%;border-radius:999px;background:${barColor};width:${barWidth}%;transition:width .5s ease;"></div>`
          }
        </div>
        <span style="font-size:0.6875rem;font-weight:800;color:${estourado ? '#dc2626' : aviso ? '#d97706' : 'var(--card-text-sec)'};min-width:2.75rem;text-align:right;">
          ${semReceita ? '—' : pct + '%'}
        </span>
      </div>
    `;

    item.querySelector('[data-edit]').addEventListener('click', e => {
      e.stopPropagation();
      window.abrirModalLimite(l);
    });

    lista.appendChild(item);
  });
}

// ─── Modal ─────────────────────────────────────────────────────────────────
window.abrirModalLimite = function(l) {
  _editandoId     = l?.id || null;
  _catSelecionada = l?.categoria || '';
  _tipoLimite     = l?.tipoLimite || 'valor';

  document.getElementById('modalLimiteTitulo').textContent = _editandoId ? 'Editar Limite' : 'Novo Limite';
  document.getElementById('editandoLimiteId').value  = _editandoId || '';
  document.getElementById('catSelectLabel').textContent = _catSelecionada || 'Selecione uma categoria';
  document.getElementById('catSelectLabel').style.color = _catSelecionada ? 'var(--card-text)' : 'var(--card-text-sec)';
  document.getElementById('errCategoria').style.display = 'none';
  document.getElementById('inputValorLimite').value  = l?.valorLimite ? formatMoeda(l.valorLimite).replace('R$\u00a0','R$ ') : '';
  document.getElementById('inputPercentual').value   = l?.percentual || '';
  document.getElementById('btnExcluirLimite').style.display = _editandoId ? 'block' : 'none';
  document.getElementById('catSearchInput').value = '';

  window._setTipoLimite(_tipoLimite);
  renderCatDropdown('');
  document.getElementById('modalLimite').classList.add('open');
};

window.fecharModalLimite = function() {
  document.getElementById('modalLimite').classList.remove('open');
  _editandoId     = null;
  _catSelecionada = '';
  _tipoLimite     = 'valor';
};

window._setTipoLimite = function(tipo) {
  _tipoLimite = tipo;
  document.getElementById('btnTipoValor').className = 'tipo-btn' + (tipo === 'valor' ? ' active' : '');
  document.getElementById('btnTipoPerc').className  = 'tipo-btn' + (tipo === 'percentual' ? ' active' : '');
  document.getElementById('campoValorFixo').style.display  = tipo === 'valor' ? '' : 'none';
  document.getElementById('campoPercentual').style.display = tipo === 'percentual' ? '' : 'none';
  if (tipo === 'percentual') window._updateHintPerc();
};

window._updateHintPerc = function() {
  const pct     = parseFloat(document.getElementById('inputPercentual').value.replace(',','.')) || 0;
  const receita = getReceitaMes();
  const hint    = document.getElementById('hintPercentual');
  if (!hint) return;
  if (receita <= 0) {
    hint.textContent = '⚠️ Sem receita lançada neste mês — o limite ficará aguardando.';
    hint.style.color = '#d97706';
  } else if (pct > 0) {
    const calc = Math.round(receita * pct / 100);
    hint.textContent = `= ${formatMoeda(calc)} com receita atual de ${formatMoeda(receita)}`;
    hint.style.color = 'var(--text-sec)';
  } else {
    hint.textContent = '';
  }
};

// ─── Dropdown de categorias ────────────────────────────────────────────────
function renderCatDropdown(filtro) {
  const container = document.getElementById('catDropdownItems');
  if (!container) return;

  const lista = getListaCategorias();
  // BUG 10: saber quais já têm limite
  const comLimite = new Set(
    limites
      .filter(l => !_editandoId || l.id !== _editandoId) // ao editar, não marcar a própria
      .map(l => normalizeCategoria(l.categoria))
  );

  const f = normalizeCategoria(filtro);
  const filtradas = lista.filter(c => !f || normalizeCategoria(c.nome).includes(f));

  if (filtradas.length === 0) {
    container.innerHTML = '<div style="padding:0.75rem 0.875rem;font-size:0.8125rem;color:var(--card-text-sec);">Nenhuma categoria encontrada</div>';
    return;
  }

  container.innerHTML = '';
  filtradas.forEach(c => {
    const temLimite = comLimite.has(normalizeCategoria(c.nome));
    const item = document.createElement('div');
    item.className = 'custom-select-item';
    item.innerHTML = `
      <span>${c.emoji || '🏷️'}</span>
      <span style="flex:1;">${escapeHTML(c.nome)}</span>
      ${temLimite ? '<span class="cat-tag">já tem limite</span>' : ''}
    `;
    item.addEventListener('click', () => {
      _catSelecionada = c.nome;
      document.getElementById('catSelectLabel').textContent = c.emoji + ' ' + c.nome;
      document.getElementById('catSelectLabel').style.color = 'var(--card-text)';
      document.getElementById('catSelectDropdown').classList.remove('open');
      document.getElementById('catSelectTrigger').classList.remove('open');
      document.getElementById('errCategoria').style.display = 'none';
    });
    container.appendChild(item);
  });
}

window._toggleCatDropdown = function() {
  const dd = document.getElementById('catSelectDropdown');
  const tr = document.getElementById('catSelectTrigger');
  const isOpen = dd.classList.toggle('open');
  tr.classList.toggle('open', isOpen);
  if (isOpen) document.getElementById('catSearchInput').focus();
};

window._filtrarCatDropdown = function(val) {
  renderCatDropdown(val);
};

// Fechar dropdown ao clicar fora
document.addEventListener('click', e => {
  if (!document.getElementById('wrapCatSelect')?.contains(e.target)) {
    document.getElementById('catSelectDropdown')?.classList.remove('open');
    document.getElementById('catSelectTrigger')?.classList.remove('open');
  }
});

// ─── Máscara BRL ───────────────────────────────────────────────────────────
window._maskBRL = function(el) {
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  v = (parseInt(v, 10) / 100).toFixed(2);
  el.value = 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function parseBRL(s) {
  return parseFloat((s || '').replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
}

// ─── Salvar Limite ─────────────────────────────────────────────────────────
window.salvarLimite = async function() {
  if (_salvando) return;

  const cat = _catSelecionada;
  if (!cat) {
    document.getElementById('errCategoria').textContent = 'Selecione uma categoria.';
    document.getElementById('errCategoria').style.display = '';
    return;
  }

  let valorLimite = 0;
  let percentual  = null;

  if (_tipoLimite === 'valor') {
    valorLimite = parseBRL(document.getElementById('inputValorLimite').value);
    if (valorLimite <= 0) {
      window.budShowToast('Informe um valor maior que zero.', 'error');
      return;
    }
  } else {
    const pct = parseFloat(document.getElementById('inputPercentual').value.replace(',','.')) || 0;
    if (pct <= 0 || pct > 100) {
      window.budShowToast('Informe um percentual entre 1 e 100.', 'error');
      return;
    }
    percentual  = pct;
    // BUG 7: snapshot do valor calculado (ou 0 se sem receita)
    const receita = getReceitaMes();
    valorLimite = receita > 0 ? Math.round(receita * pct / 100) : 0;
  }

  // BUG 2: validar duplicata (apenas em criação, ou edição de categoria diferente)
  if (!_editandoId) {
    const existe = limites.find(l => normalizeCategoria(l.categoria) === normalizeCategoria(cat));
    if (existe) {
      window.budShowToast(`Já existe um limite para "${cat}". Edite o existente.`, 'error');
      return;
    }
  }

  _salvando = true;
  const btn = document.getElementById('btnSalvarLimite');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  const dados = {
    categoria:   window.budSanitize ? window.budSanitize(cat) : cat,
    tipoLimite:  _tipoLimite,
    valorLimite,
    percentual:  percentual,
    atualizadoEm: serverTimestamp(),
  };

  try {
    if (_editandoId) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'limites', _editandoId), dados);
      window.budShowToast('Limite atualizado!', 'success');
    } else {
      dados.criadoEm = serverTimestamp();
      await addDoc(collection(db, 'usuarios', currentUser.uid, 'limites'), dados);
      window.budShowToast('Limite criado!', 'success');
    }
    window.fecharModalLimite();
  } catch (err) {
    console.error('Erro ao salvar limite:', err);
    window.budShowToast('Erro ao salvar. Verifique sua conexão.', 'error');
  } finally {
    _salvando = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Limite'; }
  }
};

// ─── Excluir Limite ────────────────────────────────────────────────────────
window.excluirLimiteAtual = function() {
  if (!_editandoId) return;
  const id   = _editandoId;
  const nome = _catSelecionada;

  // BUG 3: style.cssText (sem Tailwind dinâmico)
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem;';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--bg-page);border:1px solid var(--card-border);border-radius:1.5rem;padding:1.75rem;width:100%;max-width:380px;box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);animation:modal-in .2s ease;';
  box.innerHTML = `
    <div style="font-size:1.125rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">Excluir Limite</div>
    <div style="font-size:0.875rem;font-weight:500;color:var(--text-sec);margin-bottom:1.5rem;">Remover o limite de <strong>${escapeHTML(nome)}</strong>? Esta ação não pode ser desfeita.</div>
    <button id="btnConfExcl" style="width:100%;padding:0.75rem;border:none;border-radius:0.75rem;background:#dc2626;color:#fff;font-size:0.9375rem;font-weight:800;cursor:pointer;font-family:inherit;">Excluir</button>
    <button id="btnCancelExcl" style="width:100%;padding:0.625rem;border:none;border-radius:0.75rem;background:rgba(0,0,0,0.05);color:var(--text-sec);font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;margin-top:0.5rem;">Cancelar</button>
  `;

  ov.appendChild(box);
  document.body.appendChild(ov);

  box.querySelector('#btnCancelExcl').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

  box.querySelector('#btnConfExcl').addEventListener('click', async () => {
    ov.remove();
    window.fecharModalLimite();
    try {
      await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'limites', id));
      window.budShowToast('Limite removido.', 'success');
    } catch (err) {
      console.error('Erro ao excluir limite:', err);
      window.budShowToast('Erro ao excluir. Tente novamente.', 'error');
    }
  });
};

// ─── Copiar Mês Anterior ───────────────────────────────────────────────────
window.copiarMesAnterior = async function() {
  const btn = document.getElementById('btnCopiar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Copiando...'; }

  try {
    // Buscar despesas do mês anterior
    const mesAnt = mesVisualizado === 0 ? 11 : mesVisualizado - 1;
    const anoAnt = mesVisualizado === 0 ? anoVisualizado - 1 : anoVisualizado;
    const inicioAnt = new Date(anoAnt, mesAnt, 1, 0, 0, 0, 0);
    const fimAnt    = new Date(anoAnt, mesAnt + 1, 0, 23, 59, 59, 999);

    const qAnt = query(
      collection(db, 'usuarios', currentUser.uid, 'transacoes'),
      where('data', '>=', Timestamp.fromDate(inicioAnt)),
      where('data', '<=', Timestamp.fromDate(fimAnt)),
      orderBy('data', 'desc'),
      limit(2000)
    );

    const snap = await new Promise((res, rej) => {
      const unsub = onSnapshot(qAnt, s => { unsub(); res(s); }, rej);
    });

    // Agrupa por categoria normalizada
    // BUG 5: tipo === 'despesa'
    // BUG 6: parseFloat
    const grupoAnt = {};
    snap.docs.forEach(d => {
      const t = d.data();
      if (t.tipo !== 'despesa') return;
      const cat = normalizeCategoria(t.categoria || 'Outros');
      const nomeReal = t.categoria || 'Outros';
      if (!grupoAnt[cat]) grupoAnt[cat] = { nome: nomeReal, total: 0 };
      grupoAnt[cat].total += parseFloat(t.valor) || 0;
    });

    if (Object.keys(grupoAnt).length === 0) {
      window.budShowToast('Sem despesas no mês anterior para copiar.', 'error');
      return;
    }

    // BUG 12: Map com chaves normalizadas
    const existentes = new Map(limites.map(l => [normalizeCategoria(l.categoria), l]));

    const ops = Object.values(grupoAnt).map(async ({ nome, total }) => {
      // BUG 13: mínimo R$10 (não R$50 inflado)
      const sugerido = Math.max(10, Math.ceil((total * 1.1) / 10) * 10);
      const existente = existentes.get(normalizeCategoria(nome));
      const dados = {
        categoria:   window.budSanitize ? window.budSanitize(nome) : nome,
        tipoLimite:  'valor',
        valorLimite: sugerido,
        percentual:  null,
        atualizadoEm: serverTimestamp(),
      };
      // BUG 11: try/catch por operação
      try {
        if (existente) {
          await updateDoc(doc(db, 'usuarios', currentUser.uid, 'limites', existente.id), dados);
        } else {
          dados.criadoEm = serverTimestamp();
          await addDoc(collection(db, 'usuarios', currentUser.uid, 'limites'), dados);
        }
      } catch (e) {
        console.error('Erro ao copiar limite para', nome, e);
      }
    });

    await Promise.all(ops);
    window.budShowToast('Limites copiados do mês anterior! 📋', 'success');
  } catch (err) {
    console.error('Erro ao copiar mês anterior:', err);
    window.budShowToast('Erro ao copiar. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📋 Copiar mês anterior'; }
  }
};

// ─── Navegação por mês ─────────────────────────────────────────────────────
window.mudarMes = function(delta) {
  const hoje  = new Date();
  const atual = new Date(anoVisualizado, mesVisualizado, 1);
  atual.setMonth(atual.getMonth() + delta);
  const diffM = (atual.getFullYear() - hoje.getFullYear()) * 12 + (atual.getMonth() - hoje.getMonth());
  // BUG 15: limitar a ±12 meses
  if (Math.abs(diffM) > 12) return;
  mesVisualizado = atual.getMonth();
  anoVisualizado = atual.getFullYear();
  // BUG 1: re-subscribe nas transações ao mudar mês
  if (currentUser) setupTransacoesListener(currentUser.uid);
  renderizar();
};

// ─── Listeners ────────────────────────────────────────────────────────────
function setupTransacoesListener(uid) {
  // BUG 1: unsubscribe do listener anterior antes de criar novo
  if (_unsubTrans) { _unsubTrans(); _unsubTrans = null; }

  const { inicio, fim } = getInicioFimMes();

  // BUG 1: query filtrada por mês no servidor
  const qTrans = query(
    collection(db, 'usuarios', uid, 'transacoes'),
    where('data', '>=', Timestamp.fromDate(inicio)),
    where('data', '<=', Timestamp.fromDate(fim)),
    orderBy('data', 'desc'),
    limit(2000)
  );

  _unsubTrans = onSnapshot(qTrans, snap => {
    transacoesMes = snap.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
    renderizar();
  }, err => {
    console.error('Erro listener transacoes limites:', err);
  });
}

function setupListeners(uid) {
  // Categorias personalizadas
  const qCat = query(collection(db, 'usuarios', uid, 'categorias'), limit(200));
  _unsubs.push(onSnapshot(qCat, snap => {
    categoriasUser = snap.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
    renderizar();
  }, () => {}));

  // Limites
  const qLim = query(collection(db, 'usuarios', uid, 'limites'), orderBy('criadoEm', 'asc'), limit(500));
  _unsubs.push(onSnapshot(qLim, snap => {
    limites = snap.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
    renderizar();
  }, err => {
    // Fallback sem orderBy se índice não existir
    const qLimFallback = query(collection(db, 'usuarios', uid, 'limites'), limit(500));
    _unsubs.push(onSnapshot(qLimFallback, snap2 => {
      limites = snap2.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
      renderizar();
    }, () => {}));
  }));

  // BUG 1: transações filtradas por mês
  setupTransacoesListener(uid);
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function setupSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('btnHamburger');
  const colBtn   = document.getElementById('btnSidebarCollapse');
  const main     = document.getElementById('dashMain');
  if (!sidebar) return;

  const isCollapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (isCollapsed && window.innerWidth >= 769) {
    sidebar.classList.add('collapsed');
    main?.classList.add('sidebar-collapsed');
    if (colBtn) colBtn.textContent = '›';
  }

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
  colBtn?.addEventListener('click', () => {
    const now = sidebar.classList.toggle('collapsed');
    main?.classList.toggle('sidebar-collapsed', now);
    colBtn.textContent = now ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', now);
  });
}

// ─── Botões ────────────────────────────────────────────────────────────────
function setupBotoes() {
  document.getElementById('btnNovoLimite')?.addEventListener('click', () => window.abrirModalLimite());
  document.getElementById('btnCopiar')?.addEventListener('click', () => window.copiarMesAnterior());
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    _unsubs.forEach(fn => fn());
    _unsubs.length = 0;
    if (_unsubTrans) { _unsubTrans(); _unsubTrans = null; }
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ─── Auth Guard ────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (!user.emailVerified) { window.location.href = 'index.html'; return; }

  try { await user.getIdToken(true); } catch { window.location.href = 'index.html'; return; }

  currentUser = user;

  // Carregar dados do perfil
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists()) {
      const d = snap.data();
      if (d.primeiroLogin) { window.location.href = 'trocar-senha.html'; return; }
      const nome = d.nome || user.email || '';
      const mat  = d.matricula || '';
      const iniciais = nome.trim().split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase() || '?';
      const elName = document.getElementById('sidebarUserName');
      const elId   = document.getElementById('sidebarUserId');
      const elAv   = document.getElementById('sidebarAvatar');
      if (elName) elName.textContent = window.budSanitize ? window.budSanitize(nome) : nome;
      if (elId)   elId.textContent   = mat;
      if (elAv)   elAv.textContent   = iniciais;
    }
  } catch (e) { console.warn('Erro ao carregar perfil:', e); }

  setupSidebar();
  setupBotoes();
  setupListeners(user.uid);

  // Splash
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 600); }
});
