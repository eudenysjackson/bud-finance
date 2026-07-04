/**
 * js/onboarding.js — Bud Finance Onboarding Wizard
 *
 * 6-step initial setup flow:
 *  1 — Boas-vindas + nome
 *  2 — Como nos conheceu (obrigatório)
 *  3 — Conta principal (pulável → cria "Dinheiro/Espécie" como padrão)
 *  4 — Renda principal (pulável)
 *  5 — Despesa fixa principal (pulável)
 *  6 — Tudo pronto! (tela final)
 *
 * Ao concluir salva em usuarios/{uid} (flat doc, NÃO perfil/config):
 *   onboardingConcluido: true, comoConheceu, nome
 * + cria carteira em usuarios/{uid}/carteira
 * + cria transação + recorrente para renda (se informado)
 * + cria transação + recorrente para despesa (se informado)
 *
 * Firebase SDK Modular v10.8.1 | ES Module
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, updateProfile }
  from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  doc, getDoc, updateDoc, setDoc, addDoc, getDocs,
  collection, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Preview mode (sem login) ──────────────────────────────────────────────
const _previewMode = new URLSearchParams(window.location.search).get('preview') === '1';
if (_previewMode) {
  document.addEventListener('DOMContentLoaded', () => {
    initSourceGrid();
    initContaTipoGrid();
    initDespesaTipoGrid();
    initMasks();
    mostrarPasso(1);
    ocultarSplash();
  });
}

// ─── Firebase ──────────────────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado ────────────────────────────────────────────────────────────────
let currentUser = null;
let passoAtual  = 1;
const TOTAL_PASSOS = 5; // dots visíveis (steps 1-5; step 6 = conclusão)

/** Dados coletados durante o onboarding */
const dados = {
  nome:           '',
  comoConheceu:   '',
  // Conta (step 3)
  contaNome:      '',
  contaTipo:      'debito',
  contaSaldo:     0,
  contaPulada:    false,
  // Renda (step 4)
  rendaDesc:      '',
  rendaValor:     0,
  rendaDia:       0,
  rendaPulada:    true,
  // Despesa (step 5)
  despesaTipo:    '',
  despesaValor:   0,
  despesaDia:     0,
  despesaNome:    '',
  despesaPulada:  true,
};

// ─── DOM refs ──────────────────────────────────────────────────────────────
const elProgress = document.getElementById('obProgress');
const btnVoltar  = document.getElementById('btnVoltar');
const btnPular   = document.getElementById('btnPular');
const btnProximo = document.getElementById('btnProximo');

// ─── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'error') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'ob-toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { try { container.removeChild(el); } catch (_) {} }, 3500);
}

// ─── Progress dots ─────────────────────────────────────────────────────────
function renderProgress(passo) {
  if (!elProgress) return;
  elProgress.innerHTML = '';
  const limite = Math.min(passo, TOTAL_PASSOS);
  for (let i = 1; i <= TOTAL_PASSOS; i++) {
    const d = document.createElement('div');
    if (i === limite && passo <= TOTAL_PASSOS) d.className = 'ob-dot active';
    else if (i < limite || passo > TOTAL_PASSOS) d.className = 'ob-dot done';
    else d.className = 'ob-dot';
    elProgress.appendChild(d);
  }
}

// ─── mostrarPasso ──────────────────────────────────────────────────────────
function mostrarPasso(n) {
  document.querySelectorAll('.ob-step').forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  });

  const stepEl = document.getElementById('step' + n);
  if (!stepEl) return;
  stepEl.style.display = 'flex';
  // Força reflow para a animação disparar mesmo ao voltar
  void stepEl.offsetWidth;
  stepEl.classList.add('active');

  passoAtual = n;
  renderProgress(n);

  // Botão Voltar: apenas do step 2 em diante
  btnVoltar.style.display = n > 1 ? '' : 'none';

  // Botão Pular: apenas steps 3, 4, 5
  btnPular.style.display = (n === 3 || n === 4 || n === 5) ? '' : 'none';

  // Step 6 = conclusão — esconde controls normais
  if (n === 6) {
    btnVoltar.style.display = 'none';
    btnPular.style.display  = 'none';
    btnProximo.className    = 'ob-btn-next green';
    btnProximo.textContent  = 'Ir para o Dashboard 🚀';
    btnProximo.disabled     = false;
  } else {
    btnProximo.className   = 'ob-btn-next';
    btnProximo.textContent = 'Próximo →';
  }

  // Focus no primeiro input relevante
  setTimeout(() => {
    const firstInput = stepEl.querySelector('.ob-input');
    if (firstInput) firstInput.focus();
  }, 300);
}

// ─── Máscara BRL ───────────────────────────────────────────────────────────
function formatarInputValor(input) {
  let raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  const num      = parseInt(raw, 10);
  const reais    = Math.floor(num / 100);
  const centavos = num % 100;
  input.value = 'R$ ' + reais.toLocaleString('pt-BR') + ',' + String(centavos).padStart(2, '0');
}

function parseBRL(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[R$\s.]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// ─── calcPrimeiraData ──────────────────────────────────────────────────────
/** Calcula a próxima ocorrência do diaVencimento (mesmo mês se não passou, senão próximo mês). */
function calcPrimeiraData(diaVencimento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = Math.min(Math.max(1, parseInt(diaVencimento, 10) || 1), 31);

  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();
  const maxDia1 = new Date(ano, mes + 1, 0).getDate();
  let candidata = new Date(ano, mes, Math.min(dia, maxDia1));
  candidata.setHours(0, 0, 0, 0);

  if (candidata < hoje) {
    mes++;
    if (mes > 11) { mes = 0; ano++; }
    const maxDia2 = new Date(ano, mes + 1, 0).getDate();
    candidata = new Date(ano, mes, Math.min(dia, maxDia2));
    candidata.setHours(0, 0, 0, 0);
  }
  return candidata;
}

/** Cria um Date no mês atual com o dia fornecido (hora 12:00 para evitar timezone shift). */
function dataAtualDia(dia) {
  const hoje  = new Date();
  const ano   = hoje.getFullYear();
  const mes   = hoje.getMonth();
  const maxDia = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(Math.max(1, dia), maxDia), 12, 0, 0);
}

// ─── Validar passo ─────────────────────────────────────────────────────────
function validarPasso(n) {
  if (n === 2) {
    if (!dados.comoConheceu) {
      showToast('Selecione como você conheceu o Bud.', 'error');
      return false;
    }
  }

  if (n === 4) {
    const v = parseBRL(document.getElementById('inputRendaValor').value);
    const d = parseInt(document.getElementById('inputRendaDia').value, 10) || 0;

    if (v > 0 && (!d || d < 1 || d > 31)) {
      document.getElementById('inputRendaDia').classList.add('error');
      showToast('Informe o dia do mês ou clique em "Pular etapa".', 'error');
      return false;
    }
    if (d > 0 && v <= 0) {
      document.getElementById('inputRendaValor').classList.add('error');
      showToast('Informe o valor da renda ou clique em "Pular etapa".', 'error');
      return false;
    }
    document.getElementById('inputRendaDia').classList.remove('error');
    document.getElementById('inputRendaValor').classList.remove('error');
  }

  if (n === 5) {
    const v = parseBRL(document.getElementById('inputDespesaValor').value);
    const d = parseInt(document.getElementById('inputDespesaDia').value, 10) || 0;
    const temAlguma = dados.despesaTipo || v > 0 || d > 0;

    if (temAlguma) {
      if (!dados.despesaTipo) {
        showToast('Selecione o tipo da despesa ou clique em "Pular etapa".', 'error');
        return false;
      }
      if (v <= 0) {
        document.getElementById('inputDespesaValor').classList.add('error');
        showToast('Informe o valor da despesa ou clique em "Pular etapa".', 'error');
        return false;
      }
      if (!d || d < 1 || d > 31) {
        document.getElementById('inputDespesaDia').classList.add('error');
        showToast('Informe o dia de vencimento (1-31) ou clique em "Pular etapa".', 'error');
        return false;
      }
      if (dados.despesaTipo === 'Outra') {
        const nome = document.getElementById('inputDespesaNome').value.trim();
        if (!nome) {
          document.getElementById('inputDespesaNome').classList.add('error');
          showToast('Informe o nome da despesa ou clique em "Pular etapa".', 'error');
          return false;
        }
      }
      document.getElementById('inputDespesaValor').classList.remove('error');
      document.getElementById('inputDespesaDia').classList.remove('error');
    }
  }

  return true;
}

// ─── Ler dados do passo ────────────────────────────────────────────────────
function lerPasso(n) {
  if (n === 1) {
    dados.nome = document.getElementById('inputNome').value.trim();
  }
  if (n === 3) {
    dados.contaNome  = document.getElementById('inputContaNome').value.trim();
    dados.contaSaldo = parseBRL(document.getElementById('inputContaSaldo').value);
    // contaTipo já é atualizado pelo clique no grid
    dados.contaPulada = false;
  }
  if (n === 4) {
    dados.rendaDesc  = document.getElementById('inputRendaDesc').value.trim() || 'Salário Principal';
    dados.rendaValor = parseBRL(document.getElementById('inputRendaValor').value);
    dados.rendaDia   = parseInt(document.getElementById('inputRendaDia').value, 10) || 0;
    dados.rendaPulada = !(dados.rendaValor > 0 && dados.rendaDia > 0);
  }
  if (n === 5) {
    dados.despesaValor = parseBRL(document.getElementById('inputDespesaValor').value);
    dados.despesaDia   = parseInt(document.getElementById('inputDespesaDia').value, 10) || 0;
    dados.despesaNome  = document.getElementById('inputDespesaNome').value.trim();
    dados.despesaPulada = !(dados.despesaTipo && dados.despesaValor > 0 && dados.despesaDia > 0);
  }
}

// ─── Pular etapa ───────────────────────────────────────────────────────────
function pularEtapa() {
  if (passoAtual === 3) {
    dados.contaPulada = true;
    dados.contaNome   = '';
    dados.contaSaldo  = 0;
    document.getElementById('inputContaNome').classList.remove('error');
  }
  if (passoAtual === 4) {
    dados.rendaPulada = true;
    dados.rendaValor  = 0;
    dados.rendaDia    = 0;
    document.getElementById('inputRendaValor').classList.remove('error');
    document.getElementById('inputRendaDia').classList.remove('error');
  }
  if (passoAtual === 5) {
    dados.despesaPulada = true;
    dados.despesaTipo   = '';
    dados.despesaValor  = 0;
    dados.despesaDia    = 0;
  }
  // Avançar sem salvar dados do passo atual
  if (passoAtual === 5) {
    concluirOnboarding();
  } else {
    mostrarPasso(passoAtual + 1);
  }
}

// ─── Avançar ───────────────────────────────────────────────────────────────
async function avancar() {
  if (passoAtual === 6) {
    window.location.href = 'dashboard.html';
    return;
  }

  if (!validarPasso(passoAtual)) return;
  lerPasso(passoAtual);

  if (passoAtual === 5) {
    await concluirOnboarding();
    return;
  }

  mostrarPasso(passoAtual + 1);
}

// ─── Voltar ────────────────────────────────────────────────────────────────
function voltar() {
  if (passoAtual <= 1) return;
  mostrarPasso(passoAtual - 1);
}

// ─── Concluir onboarding ───────────────────────────────────────────────────
async function concluirOnboarding() {
  btnProximo.disabled    = true;
  btnPular.disabled      = true;
  btnProximo.textContent = 'Salvando...';

  try {
    const uid = currentUser.uid;
    const san = (s) => (window.budSanitize ? window.budSanitize(s) : String(s));

    // ── 1. Atualizar nome no Auth ──────────────────────────────────
    const nomeFinal = san(dados.nome).substring(0, 80) || currentUser.displayName || '';
    if (nomeFinal && nomeFinal !== currentUser.displayName) {
      try { await updateProfile(currentUser, { displayName: nomeFinal }); } catch (_) {}
    }

    // ── 2. Salvar no doc plano (flat usuarios/{uid}) ───────────────
    const payload = {
      onboardingConcluido: true,
      comoConheceu: dados.comoConheceu || 'Outro',
    };
    if (nomeFinal) payload.nome = nomeFinal;
    await setDoc(doc(db, 'usuarios', uid), payload, { merge: true });

    // ── 3. Criar carteira ──────────────────────────────────────────
    const carteiraRef  = collection(db, 'usuarios', uid, 'carteira');
    const carteiraSnap = await getDocs(carteiraRef);
    const jaTem = carteiraSnap.docs.some(d => d.data().padrao === true);

    if (!jaTem) {
      if (!dados.contaPulada && dados.contaNome) {
        // Conta personalizada do step 3
        const TIPO_INFO = {
          debito:   { icon: '🏦', color: '#2563eb' },
          dinheiro: { icon: '💵', color: '#16a34a' },
        };
        const info = TIPO_INFO[dados.contaTipo] || TIPO_INFO.debito;
        await addDoc(carteiraRef, {
          nome:         san(dados.contaNome).substring(0, 60),
          tipo:         dados.contaTipo,
          icone:        info.icon,
          cor:          info.color,
          padrao:       true,
          ativo:        true,
          saldo:        dados.contaSaldo || 0,
          criadoEm:     serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
      } else {
        // Conta padrão: Dinheiro / Espécie
        await addDoc(carteiraRef, {
          nome:         'Dinheiro / Espécie',
          tipo:         'dinheiro',
          icone:        '💵',
          cor:          '#16a34a',
          padrao:       true,
          ativo:        true,
          saldo:        0,
          criadoEm:     serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
      }
    }

    // ── 4. Criar renda (se preenchida) ────────────────────────────
    if (!dados.rendaPulada && dados.rendaValor > 0 && dados.rendaDia > 0) {
      const descRenda = san(dados.rendaDesc).substring(0, 80) || 'Salário Principal';
      const dataRenda = dataAtualDia(dados.rendaDia);
      const proxRenda = calcPrimeiraData(dados.rendaDia);

      // Transação do mês atual
      await addDoc(collection(db, 'usuarios', uid, 'transacoes'), {
        descricao:   descRenda,
        valor:       dados.rendaValor,
        categoria:   'Salário',
        data:        Timestamp.fromDate(dataRenda),
        tipo:        'receita',
        dataCriacao: serverTimestamp(),
      });

      // Recorrente mensal
      await addDoc(collection(db, 'usuarios', uid, 'recorrentes'), {
        descricao:      descRenda,
        tipo:           'receita',
        valor:          dados.rendaValor,
        categoria:      'Salário',
        formaPagamento: 'Outro',
        cartaoId:       null,
        cartaoNome:     null,
        periodicidade:  'mensal',
        diaVencimento:  dados.rendaDia,
        proximaData:    Timestamp.fromDate(proxRenda),
        ativa:          true,
        criadoEm:       serverTimestamp(),
        atualizadoEm:   serverTimestamp(),
      });
    }

    // ── 5. Criar despesa fixa (se preenchida) ─────────────────────
    if (!dados.despesaPulada && dados.despesaTipo && dados.despesaValor > 0 && dados.despesaDia > 0) {
      let descDespesa = dados.despesaTipo;
      if (dados.despesaTipo === 'Outra' && dados.despesaNome) {
        descDespesa = san(dados.despesaNome).substring(0, 80);
      }
      const dataDespesa = dataAtualDia(dados.despesaDia);
      const proxDespesa = calcPrimeiraData(dados.despesaDia);

      // Transação do mês atual
      await addDoc(collection(db, 'usuarios', uid, 'transacoes'), {
        descricao:   descDespesa,
        valor:       dados.despesaValor,
        categoria:   'Moradia',
        data:        Timestamp.fromDate(dataDespesa),
        tipo:        'despesa',
        dataCriacao: serverTimestamp(),
      });

      // Recorrente mensal
      await addDoc(collection(db, 'usuarios', uid, 'recorrentes'), {
        descricao:      descDespesa,
        tipo:           'despesa',
        valor:          dados.despesaValor,
        categoria:      'Moradia',
        formaPagamento: 'Outro',
        cartaoId:       null,
        cartaoNome:     null,
        periodicidade:  'mensal',
        diaVencimento:  dados.despesaDia,
        proximaData:    Timestamp.fromDate(proxDespesa),
        ativa:          true,
        criadoEm:       serverTimestamp(),
        atualizadoEm:   serverTimestamp(),
      });
    }

    // ── 6. Ir para o step 6 (tela de conclusão) ───────────────────
    mostrarPasso(6);

  } catch (err) {
    console.error('[onboarding] concluirOnboarding:', err);
    showToast('Erro ao salvar. Tente novamente.', 'error');
    btnProximo.disabled    = false;
    btnPular.disabled      = false;
    btnProximo.textContent = 'Próximo →';
  }
}

// ─── Init source grid (step 2) ─────────────────────────────────────────────
function initSourceGrid() {
  document.querySelectorAll('#sourceGrid .ob-source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sourceGrid .ob-source-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      dados.comoConheceu = btn.getAttribute('data-value') || '';
    });
  });
}

// ─── Init conta tipo grid (step 3) ────────────────────────────────────────
function initContaTipoGrid() {
  document.querySelectorAll('#contaTipoGrid .ob-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#contaTipoGrid .ob-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      dados.contaTipo = btn.getAttribute('data-value') || 'debito';
    });
  });
  const inputContaNome = document.getElementById('inputContaNome');
  if (inputContaNome) {
    inputContaNome.addEventListener('input', () => inputContaNome.classList.remove('error'));
  }
}

// ─── Init despesa tipo grid (step 5) ─────────────────────────────────────
function initDespesaTipoGrid() {
  document.querySelectorAll('#despesaTipoGrid .ob-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#despesaTipoGrid .ob-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      dados.despesaTipo = btn.getAttribute('data-value') || '';

      const nomeGroup = document.getElementById('despesaNomeGroup');
      if (nomeGroup) nomeGroup.style.display = dados.despesaTipo === 'Outra' ? '' : 'none';
    });
  });
}

// ─── Init máscaras ────────────────────────────────────────────────────────
function initMasks() {
  ['inputContaSaldo', 'inputRendaValor', 'inputDespesaValor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => formatarInputValor(el));
  });

  ['inputRendaDia', 'inputDespesaDia'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const v = parseInt(el.value, 10);
      if (v > 31) el.value = '31';
      else if (el.value !== '' && v < 1) el.value = '1';
    });
  });

  // Remove error on typing
  ['inputRendaValor', 'inputDespesaValor', 'inputDespesaNome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => el.classList.remove('error'));
  });
}

// ─── Splash ───────────────────────────────────────────────────────────────
function ocultarSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
}

// Safety: force-dismiss splash after 8s (para evitar tela travada em redes lentas)
(function () {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => {
    if (splash && splash.style.display !== 'none' && !splash.classList.contains('hide')) {
      ocultarSplash();
    }
  }, 8000);
})();

// ─── Auth guard + inicialização ───────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (_previewMode) return; // já inicializado no DOMContentLoaded
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  try {
    const snap     = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = snap.exists() ? snap.data() : {};

    // Já concluiu o onboarding → ir direto para o dashboard (exceto em modo preview)
    if (userData.onboardingConcluido === true && !_previewMode) {
      window.location.href = 'dashboard.html';
      return;
    }

    // Pré-preencher nome
    const nomeInicial = userData.nome || user.displayName || '';
    const inputNome   = document.getElementById('inputNome');
    if (inputNome && nomeInicial) inputNome.value = nomeInicial;

    // Pré-selecionar "Como conheceu" se já salvo
    if (userData.comoConheceu) {
      dados.comoConheceu = userData.comoConheceu;
      document.querySelectorAll('#sourceGrid .ob-source-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === userData.comoConheceu) {
          btn.classList.add('selected');
        }
      });
    }

  } catch (_err) {
    // Permissão negada ou doc inexistente — continua normalmente
  }

  // ── Inicializar UI ──────────────────────────────────────────────
  try {
    initSourceGrid();
    initContaTipoGrid();
    initDespesaTipoGrid();
    initMasks();

    if (btnVoltar)  btnVoltar.addEventListener('click', voltar);
    if (btnPular)   btnPular.addEventListener('click', pularEtapa);
    if (btnProximo) btnProximo.addEventListener('click', avancar);

    // Tecla Enter → avançar (exceto em textarea)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        avancar();
      }
    });

    mostrarPasso(1);
  } catch (_initErr) {
    // Garante que o splash sempre some mesmo em caso de erro de inicialização
  } finally {
    ocultarSplash();
  }
});
