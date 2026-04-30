/**
 * js/admin.js — Painel Administrativo
 *
 * Auth guard: role === 'admin' no Firestore
 * Firebase Modular v10.8.1 (ES modules, type="module")
 * Funcionalidades:
 *  - Visão Geral: KPIs (total usuários, pagantes, trial, flags ativas) + últimos cadastros
 *  - Feature Flags: CRUD completo + seed de defaults + toggle rápido
 *  - Sistema: toggles de manutenção/cadastros + versão + mensagem de boas-vindas
 */

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  setDoc, orderBy, query, limit, serverTimestamp, where
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Estado ────────────────────────────────────────────────────────────────
let _flags   = [];  // array de { id, key, name, description, enabled, allowedPlans }
let _panelAtual = 'overview';
let _chamadosCarregados = false;

// ─── Seed de Feature Flags padrão ─────────────────────────────────────────
const FLAGS_DEFAULT = [
  { key: 'importacao_ia',        name: 'Importação por IA',           description: 'Extração de cupom fiscal via IA na tela Compras.',          enabled: true,  allowedPlans: ['plus','pro','trial'] },
  { key: 'comparativo_meses',    name: 'Comparativo de Meses',        description: 'Tela comparativo.html — análise lado a lado de 2 meses.',   enabled: true,  allowedPlans: ['plus','pro','trial'] },
  { key: 'balanco_mensal',       name: 'Balanço Mensal',              description: 'Tela balanco-mensal.html — KPIs + dia-a-dia do mês.',       enabled: true,  allowedPlans: ['plus','pro','trial'] },
  { key: 'graficos_avancados',   name: 'Gráficos Avançados',         description: 'Tela graficos.html — charts Chart.js + comparativo faturas.',enabled: true,  allowedPlans: ['pro','trial'] },
  { key: 'relatorios',           name: 'Central de Relatórios',      description: 'Tela relatorios.html — export detalhado em 3 abas.',        enabled: true,  allowedPlans: ['pro','trial'] },
  { key: 'insights',             name: 'Insights e Análises',        description: 'Tela insights.html — score saúde + alertas + projeção.',    enabled: true,  allowedPlans: ['plus','pro','trial'] },
  { key: 'copiar_mes_anterior',  name: 'Copiar Limites do Mês Ant.', description: 'Botão "Copiar mês anterior" na tela Limites.',             enabled: true,  allowedPlans: ['plus','pro','trial'] },
  { key: 'exportar_dados',       name: 'Exportar Dados (JSON)',       description: 'Botão exportar dados em JSON na tela Configurações.',       enabled: true,  allowedPlans: [] },
  { key: 'excluir_conta',        name: 'Excluir Conta',              description: 'Botão excluir conta permanentemente em Configurações.',     enabled: true,  allowedPlans: [] },
  { key: 'investimentos',        name: 'Tela de Investimentos',      description: 'Acesso à tela investimentos.html + cotações AwesomeAPI.',   enabled: true,  allowedPlans: ['plus','pro','trial'] },
  { key: 'processar_recorrentes',name: 'Processar Recorrentes',      description: 'Botão ⚙️ na tela Recorrentes para lançar contas manualmente.',enabled: true, allowedPlans: ['plus','pro','trial'] },
  { key: 'filtro_extrato',       name: 'Filtro de Intervalo Extrato',description: 'Filtro por data personalizada (De → Até) no Extrato.',     enabled: true,  allowedPlans: [] },
  { key: 'assistente_ia',        name: 'Assistente IA',              description: 'Acesso ao assistente de IA (quando disponível).',          enabled: false, allowedPlans: ['pro'] },
  { key: 'assistente_whatsapp',  name: 'Assistente WhatsApp',        description: 'Integração bot WhatsApp (quando disponível).',            enabled: false, allowedPlans: ['plus','pro'] },
  { key: 'notificacoes_push',    name: 'Notificações Push (FCM)',    description: 'Push notifications via Firebase Cloud Messaging.',         enabled: false, allowedPlans: ['plus','pro','trial'] },
  { key: 'modo_manutencao',      name: 'Modo Manutenção',            description: 'Bloqueia login de todos os usuários (exceto admin).',      enabled: false, allowedPlans: [] },
  { key: 'mercado_historico',    name: 'Histórico de Preços Mercado',description: 'Histórico de variação de preços de produtos.',             enabled: true,  allowedPlans: [] },
  { key: 'categorias_custom',    name: 'Categorias Personalizadas',  description: 'Criar e editar categorias além das padrão.',               enabled: true,  allowedPlans: [] },
  { key: 'pagar_fatura_1click',  name: 'Pagar Fatura com 1 Clique', description: 'Modal de pagamento de fatura com débito automático em conta.',enabled: true,allowedPlans: [] },
];

// ─── Tabs ──────────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
  const panels = ['overview','flags','crm','notifs','promos','system'];
  panels.forEach(p => {
    const el = document.getElementById('panel-' + p);
    const btn = document.getElementById('tab-' + p);
    if (el) el.style.display = p === tab ? '' : 'none';
    if (btn) btn.classList.toggle('active', p === tab);
  });
  _panelAtual = tab;
  // Lazy-load chamados ao abrir a aba CRM
  if (tab === 'crm' && !_chamadosCarregados) carregarChamados();
};

// ─── Logout ────────────────────────────────────────────────────────────────
window.fazerLogoutAdmin = async function() {
  await signOut(auth);
  window.location.href = 'index.html';
};

// ─── Auth Guard ────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  const loading = document.getElementById('adminLoading');
  const denied  = document.getElementById('accessDenied');
  const content = document.getElementById('adminContent');

  if (!user) { window.location.href = 'index.html'; return; }

  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    loading.style.display = 'none';

    if (!snap.exists() || snap.data().role !== 'admin') {
      denied.style.display = 'flex';
      return;
    }

    // Exibir dados do admin
    const d = snap.data();
    const nome = d.nome || user.email || '';
    const iniciais = nome.trim().split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase() || 'A';
    const elName   = document.getElementById('adminName');
    const elAvatar = document.getElementById('adminAvatar');
    if (elName) elName.textContent = nome;
    if (elAvatar) elAvatar.textContent = iniciais;

    content.style.display = 'block';

    // Carregar dados
    await Promise.all([
      carregarOverview(user.uid),
      carregarFlags(),
      carregarSistema(),
    ]);

  } catch (err) {
    console.error('[admin] auth error:', err);
    loading.style.display = 'none';
    denied.style.display = 'flex';
  }
});

// ─── Chamados de Suporte ────────────────────────────────────────────────────
window.carregarChamados = async function() {
  const container = document.getElementById('chamadosLista');
  if (!container) return;
  container.innerHTML = '<div style="color:#9ca3af;font-size:.875rem;padding:2rem;text-align:center;">⏳ Carregando...</div>';

  try {
    const filtro = document.getElementById('filtroStatusChamado')?.value || '';
    const user   = auth.currentUser;
    if (!user) throw new Error('Não autenticado');
    const token  = await user.getIdToken();
    const url    = `${window.BUD_FUNCTIONS_URL}/api/chamados${filtro ? '?status=' + encodeURIComponent(filtro) : ''}`;
    const resp   = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || resp.status); }
    const chamados = await resp.json();

    if (!chamados.length) {
      container.innerHTML = '<div style="color:#9ca3af;font-size:.875rem;padding:2rem;text-align:center;">Nenhum chamado encontrado.</div>';
      _chamadosCarregados = true;
      return;
    }

    container.innerHTML = '';
    chamados.forEach(c => {
      const card = document.createElement('div');
      card.className = 'chamado-card';
      card.id = 'chamado-' + c.id;
      const tipo   = c.tipo || 'bug';
      const status = c.status || 'aberto';
      const data   = c.criadoEm ? new Date(c.criadoEm).toLocaleString('pt-BR') : '—';
      const statusLabels = { aberto: '🟡 Aberto', em_analise: '🔵 Em análise', resolvido: '✅ Resolvido' };
      // Botões de ação dependem do status atual
      let acoes = '';
      if (status === 'aberto') {
        acoes = `<button class="chamado-acao" onclick="window.alterarStatusChamado('${esc(c.id)}','em_analise')">→ Em análise</button>
                 <button class="chamado-acao resolver" onclick="window.alterarStatusChamado('${esc(c.id)}','resolvido')">✓ Resolver</button>`;
      } else if (status === 'em_analise') {
        acoes = `<button class="chamado-acao resolver" onclick="window.alterarStatusChamado('${esc(c.id)}','resolvido')">✓ Resolver</button>
                 <button class="chamado-acao reabrir" onclick="window.alterarStatusChamado('${esc(c.id)}','aberto')">↩ Reabrir</button>`;
      } else {
        acoes = `<button class="chamado-acao reabrir" onclick="window.alterarStatusChamado('${esc(c.id)}','aberto')">↩ Reabrir</button>`;
      }
      card.innerHTML = `
        <div class="chamado-header">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span class="chamado-tipo ${esc(tipo)}">${tipo === 'bug' ? '🐛 Bug' : '💡 Sugestão'}</span>
            <span class="chamado-status ${esc(status)}">${statusLabels[status] || status}</span>
            <span class="chamado-meta">${esc(c.nomeUsuario || 'Anônimo')} &bull; ${esc(c.emailUsuario || '')} &bull; ${esc(data)}</span>
          </div>
          <div style="display:flex;gap:0.375rem;">${acoes}</div>
        </div>
        <div class="chamado-desc">${esc(c.descricao || '—')}</div>
        <div class="chamado-meta">UID: ${esc(c.uid || '—')}</div>
      `;
      container.appendChild(card);
    });
    _chamadosCarregados = true;
  } catch (err) {
    console.error('[admin] carregarChamados:', err);
    container.innerHTML = '<div style="color:#dc2626;font-size:.875rem;padding:1rem;">Erro ao carregar chamados.</div>';
  }
};

window.alterarStatusChamado = async function(id, statusAtual) {
  const proximos = { aberto: 'em_analise', em_analise: 'resolvido', resolvido: 'aberto' };
  const novoStatus = proximos[statusAtual] || 'aberto';
  try {
    const token = await auth.currentUser.getIdToken();
    const resp  = await fetch(`${window.BUD_FUNCTIONS_URL}/api/chamados/${encodeURIComponent(id)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({ status: novoStatus })
    });
    if (!resp.ok) throw new Error('status ' + resp.status);
    _chamadosCarregados = false;
    carregarChamados();
  } catch (err) {
    console.error('[admin] alterarStatusChamado:', err);
    alert('Erro ao atualizar status.');
  }
};

// ─── Visão Geral ───────────────────────────────────────────────────────────
async function carregarOverview(myUid) {
  try {
    // Últimos 20 cadastros
    const q = query(
      collection(db, 'usuarios'),
      orderBy('dataCadastro', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    const usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // KPIs
    let pagantes = 0, trial = 0;
    usuarios.forEach(u => {
      const p = (u.plano || '').toLowerCase();
      if (p === 'plus' || p === 'pro') pagantes++;
      if (p === 'trial') trial++;
    });

    const elTotal    = document.getElementById('kpiTotal');
    const elPagantes = document.getElementById('kpiPagantes');
    const elTrial    = document.getElementById('kpiTrial');
    if (elTotal) elTotal.textContent = usuarios.length;
    if (elPagantes) elPagantes.textContent = pagantes;
    if (elTrial) elTrial.textContent = trial;

    // Últimos cadastros — tabela simples
    const container = document.getElementById('overviewSignups');
    if (!container) return;
    if (!usuarios.length) { container.textContent = 'Nenhum usuário cadastrado.'; return; }

    const PLANO_CORES = {
      free: 'plan-free', starter: 'plan-starter', trial: 'plan-trial',
      plus: 'plan-plus', pro: 'plan-pro'
    };

    let html = '<table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr style="font-size:.7rem;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">'
      + '<th style="padding:.5rem .625rem;text-align:left;">Nome</th>'
      + '<th style="padding:.5rem .625rem;text-align:left;">Email</th>'
      + '<th style="padding:.5rem .625rem;text-align:left;">Plano</th>'
      + '<th style="padding:.5rem .625rem;text-align:left;">Cadastro</th>'
      + '</tr></thead><tbody>';

    usuarios.slice(0,10).forEach(u => {
      const plano = (u.plano || 'free').toLowerCase();
      const corClasse = PLANO_CORES[plano] || 'plan-free';
      const data = u.dataCadastro?.toDate
        ? u.dataCadastro.toDate().toLocaleDateString('pt-BR')
        : '—';
      html += `<tr style="border-top:1px solid #f1f5f9;">
        <td style="padding:.5rem .625rem;font-weight:600;color:#1e293b;">${esc(u.nome || '—')}</td>
        <td style="padding:.5rem .625rem;color:#6b7280;">${esc(u.email || '—')}</td>
        <td style="padding:.5rem .625rem;"><span class="plan-badge ${corClasse}">${plano}</span></td>
        <td style="padding:.5rem .625rem;color:#6b7280;">${data}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    console.error('[admin] carregarOverview:', err);
    const c = document.getElementById('overviewSignups');
    if (c) c.textContent = 'Erro ao carregar dados.';
  }
}

// ─── Feature Flags ─────────────────────────────────────────────────────────
async function carregarFlags() {
  try {
    const snap = await getDocs(collection(db, 'featureFlags'));

    // Seed automático se vazio
    if (snap.empty) {
      await seedFlags();
      return; // seedFlags chama renderFlags internamente
    }

    _flags = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFlags();
    atualizarKpiFlags();
  } catch (err) {
    console.error('[admin] carregarFlags:', err);
    const g = document.getElementById('flagsGrid');
    if (g) g.innerHTML = '<div style="color:#dc2626;font-size:.875rem;">Erro ao carregar flags.</div>';
  }
}

async function seedFlags() {
  if (window.budShowToast) window.budShowToast('Criando flags padrão...', 'info');
  try {
    const promises = FLAGS_DEFAULT.map(f => addDoc(collection(db, 'featureFlags'), {
      ...f,
      criadoEm: serverTimestamp(),
    }));
    const refs = await Promise.all(promises);
    _flags = FLAGS_DEFAULT.map((f, i) => ({ id: refs[i].id, ...f }));
    renderFlags();
    atualizarKpiFlags();
    if (window.budShowToast) window.budShowToast(`${FLAGS_DEFAULT.length} flags criadas com sucesso!`, 'success');
  } catch (err) {
    console.error('[admin] seedFlags:', err);
    if (window.budShowToast) window.budShowToast('Erro ao criar flags padrão.', 'error');
  }
}

function renderFlags() {
  const grid = document.getElementById('flagsGrid');
  if (!grid) return;
  if (!_flags.length) {
    grid.innerHTML = '<div style="color:#9ca3af;font-size:.875rem;padding:2rem;text-align:center;">Nenhuma flag criada ainda.</div>';
    return;
  }

  const sorted = [..._flags].sort((a, b) => a.name.localeCompare(b.name));
  grid.innerHTML = '';
  sorted.forEach(f => {
    const plans = (f.allowedPlans || []);
    const plansHtml = plans.length === 0
      ? '<span class="plan-badge plan-todos">Todos os planos</span>'
      : plans.map(p => `<span class="plan-badge plan-${p}">${p}</span>`).join('');

    const card = document.createElement('div');
    card.className = 'ff-card' + (f.enabled ? '' : ' off');
    card.id = 'ffcard-' + f.id;
    card.innerHTML = `
      <div class="ff-card-top">
        <div>
          <div class="ff-name">${esc(f.name)}</div>
          <div class="ff-key">${esc(f.key)}</div>
        </div>
        <button class="toggle ${f.enabled ? 'on' : ''}" id="tog-${f.id}" onclick="toggleFlag('${f.id}')" title="${f.enabled ? 'Desabilitar' : 'Habilitar'} flag"></button>
      </div>
      <div class="ff-desc">${esc(f.description || '—')}</div>
      <div class="ff-plans">${plansHtml}</div>
      <div class="ff-actions">
        <button class="btn-ghost" style="padding:.3rem .7rem;font-size:.75rem;" onclick="abrirModalFlag('${f.id}')">✏️ Editar</button>
        <button class="btn-danger" onclick="excluirFlag('${f.id}')">🗑️ Excluir</button>
      </div>`;
    grid.appendChild(card);
  });
}

function atualizarKpiFlags() {
  const ativas = _flags.filter(f => f.enabled).length;
  const el = document.getElementById('kpiFlags');
  if (el) el.textContent = `${ativas}/${_flags.length}`;
}

window.toggleFlag = async function(id) {
  const f = _flags.find(x => x.id === id);
  if (!f) return;
  const novoEstado = !f.enabled;
  const tog = document.getElementById('tog-' + id);
  const card = document.getElementById('ffcard-' + id);
  if (tog) tog.classList.toggle('on', novoEstado);
  if (card) card.classList.toggle('off', !novoEstado);
  f.enabled = novoEstado;
  try {
    await updateDoc(doc(db, 'featureFlags', id), { enabled: novoEstado });
    atualizarKpiFlags();
  } catch (err) {
    console.error('[admin] toggleFlag:', err);
    // reverter UI
    f.enabled = !novoEstado;
    if (tog) tog.classList.toggle('on', !novoEstado);
    if (card) card.classList.toggle('off', novoEstado);
    if (window.budShowToast) window.budShowToast('Erro ao atualizar flag.', 'error');
  }
};

// ─── Modal Feature Flag ────────────────────────────────────────────────────
window.abrirModalFlag = function(id) {
  const modal = document.getElementById('modalFlag');
  const f = id ? _flags.find(x => x.id === id) : null;

  document.getElementById('modalFlagTitulo').textContent = f ? 'Editar Feature Flag' : 'Nova Feature Flag';
  document.getElementById('flagEditId').value = id || '';
  document.getElementById('flagNome').value = f?.name || '';
  document.getElementById('flagKey').value  = f?.key  || '';
  document.getElementById('flagKey').readOnly = !!f; // não alterar key existente
  document.getElementById('flagDesc').value  = f?.description || '';

  const tog = document.getElementById('flagEnabled');
  const lbl = document.getElementById('flagEnabledLabel');
  const isEnabled = f ? f.enabled : true;
  if (tog) { tog.classList.toggle('on', isEnabled); }
  if (lbl) lbl.textContent = isEnabled ? 'Sim' : 'Não';
  tog?.addEventListener('click', function() {
    this.classList.toggle('on');
    lbl.textContent = this.classList.contains('on') ? 'Sim' : 'Não';
  }, { once: false });

  // Planos
  const checks = document.querySelectorAll('input[name="flagPlan"]');
  const planos = f?.allowedPlans || [];
  checks.forEach(c => { c.checked = planos.includes(c.value); });

  modal.classList.add('open');
};

window.fecharModalFlag = function() {
  document.getElementById('modalFlag').classList.remove('open');
};

window.salvarFlag = async function() {
  const id   = document.getElementById('flagEditId').value;
  const nome = document.getElementById('flagNome').value.trim();
  const key  = document.getElementById('flagKey').value.trim().toLowerCase();
  const desc = document.getElementById('flagDesc').value.trim();
  const enabled = document.getElementById('flagEnabled').classList.contains('on');

  if (!nome || !key) {
    if (window.budShowToast) window.budShowToast('Nome e chave são obrigatórios.', 'warning');
    return;
  }
  if (!/^[a-z0-9_]+$/.test(key)) {
    if (window.budShowToast) window.budShowToast('Chave: use apenas letras minúsculas, números e _', 'warning');
    return;
  }

  const checks = document.querySelectorAll('input[name="flagPlan"]:checked');
  const allowedPlans = Array.from(checks).map(c => c.value);

  const dados = {
    name: window.budSanitize ? window.budSanitize(nome) : nome,
    description: window.budSanitize ? window.budSanitize(desc) : desc,
    enabled,
    allowedPlans,
  };

  const btn = document.querySelector('#modalFlag .btn-cyan');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    if (id) {
      // Edição
      await updateDoc(doc(db, 'featureFlags', id), dados);
      const idx = _flags.findIndex(x => x.id === id);
      if (idx >= 0) _flags[idx] = { ..._flags[idx], ...dados };
    } else {
      // Criação
      // Verificar chave duplicada
      if (_flags.some(f => f.key === key)) {
        if (window.budShowToast) window.budShowToast('Já existe uma flag com essa chave.', 'error');
        return;
      }
      const ref = await addDoc(collection(db, 'featureFlags'), {
        ...dados, key, criadoEm: serverTimestamp(),
      });
      _flags.push({ id: ref.id, key, ...dados });
    }

    renderFlags();
    atualizarKpiFlags();
    fecharModalFlag();
    if (window.budShowToast) window.budShowToast('Flag salva!', 'success');
  } catch (err) {
    console.error('[admin] salvarFlag:', err);
    if (window.budShowToast) window.budShowToast('Erro ao salvar flag.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Flag'; }
  }
};

window.excluirFlag = async function(id) {
  const f = _flags.find(x => x.id === id);
  if (!f) return;
  if (!confirm(`Excluir a flag "${f.name}" (${f.key})? Esta ação não pode ser desfeita.`)) return;
  try {
    await deleteDoc(doc(db, 'featureFlags', id));
    _flags = _flags.filter(x => x.id !== id);
    renderFlags();
    atualizarKpiFlags();
    if (window.budShowToast) window.budShowToast('Flag excluída.', 'success');
  } catch (err) {
    console.error('[admin] excluirFlag:', err);
    if (window.budShowToast) window.budShowToast('Erro ao excluir flag.', 'error');
  }
};

// ─── Sistema ───────────────────────────────────────────────────────────────
async function carregarSistema() {
  try {
    const snap = await getDoc(doc(db, 'admin', 'config'));
    if (!snap.exists()) return;
    const d = snap.data();
    const togMan = document.getElementById('togManutencao');
    const togCad = document.getElementById('togCadastros');
    if (togMan) togMan.classList.toggle('on', !!d.modoManutencao);
    if (togCad) togCad.classList.toggle('on', d.cadastrosAbertos !== false);
    const elVersao = document.getElementById('inputVersao');
    const elBoasVindas = document.getElementById('inputBoasVindas');
    if (elVersao) elVersao.value = d.versao || '';
    if (elBoasVindas) elBoasVindas.value = d.mensagemBoasVindas || '';
  } catch (_) {}
}

window.salvarSistema = async function() {
  const btn = document.querySelector('#panel-system .btn-cyan');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
  try {
    const dados = {
      modoManutencao: document.getElementById('togManutencao')?.classList.contains('on') || false,
      cadastrosAbertos: document.getElementById('togCadastros')?.classList.contains('on') ?? true,
      versao: (document.getElementById('inputVersao')?.value || '').trim(),
      mensagemBoasVindas: (document.getElementById('inputBoasVindas')?.value || '').trim(),
    };
    await setDoc(doc(db, 'admin', 'config'), dados, { merge: true });
    if (window.budShowToast) window.budShowToast('Configurações salvas!', 'success');
  } catch (err) {
    console.error('[admin] salvarSistema:', err);
    if (window.budShowToast) window.budShowToast('Erro ao salvar.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar'; }
  }
};

// ─── Helper: escapeHTML ────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
