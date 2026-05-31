// ─────────────────────────────────────────────────────────────────
//  Bud Finance — js/dividas.js   (ES Module, Firebase 10.8.1)
//  Todos os 25 bugs do cérebro/dividas.md corrigidos desde o início.
// ─────────────────────────────────────────────────────────────────
import { initializeApp, getApps }          from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, orderBy, limit,
  onSnapshot, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// ─── Firebase init ───────────────────────────────────────────────
const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();

// ─── Estado global ───────────────────────────────────────────────
let currentUser        = null;
let dividas            = [];
let dividaAtual        = null;   // usada por editar/excluir/simulador
let wizardTipo         = '';
let wizardTipoIcone    = '';
let wizardFormato      = '';
let dadosIA            = null;
let valoresOcultos     = false;
let _unsubs            = [];
let _salvando          = false;
let _tabAtualDetalhes  = 'resumo';  // Bug #24: preservar aba ativa
let _filtroDivida      = 'todos';   // 'todos' | 'atraso' | 'ativas'

// ─────────────────────────────────────────────────────────────────
//  HELPERS — texto e segurança
// ─────────────────────────────────────────────────────────────────

// escapeHTML: escapa TODOS os caracteres significativos (incl. aspas)
// Importante: budSanitize() apenas remove tags — NÃO escapa aspas.
// Para uso em onclick="..." e atributos, precisamos escape completo.
const escapeHTML = (typeof window.budEscapeHTML === 'function')
  ? window.budEscapeHTML
  : (s) => {
      if (s == null) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

// ─────────────────────────────────────────────────────────────────
//  HELPERS — moeda e datas
// ─────────────────────────────────────────────────────────────────
function formatMoeda(v) {
  if (valoresOcultos) return '••••';
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// fmtIA: sempre exibe o valor real, independente do toggle (Bug #20)
function fmtIA(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMoeda(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function aplicarMascaraMoeda(input) {
  let raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  const num = parseInt(raw, 10);
  const reais    = Math.floor(num / 100);
  const centavos = num % 100;
  input.value = reais.toLocaleString('pt-BR') + ',' + String(centavos).padStart(2, '0');
}

// DEC-018: campo de data como texto DD/MM/AAAA
function aplicarMascaraData(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
  if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
  input.value = v;
}

function parseDataBR(str) {
  if (!str || str.length < 8) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, a] = parts.map(Number);
  if (!d || !m || !a || a < 1900 || a > 2100) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatDataBR(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  const [a, m, d] = parts;
  return `${d}/${m}/${a}`;
}

// Bug #10: addMonthsSafe — respeita meses curtos (Jan 31 + 1 = Fev 28, não Mar 3)
function addMonthsSafe(date, months) {
  const d   = new Date(date);
  const dia = d.getDate();
  d.setMonth(d.getMonth() + months, 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  return d;
}

// Bug #15: saldo devedor real via Tabela Price (não simplesmente valorTotal - valorPago)
function calcularSaldoDevedor(d) {
  if (!d || !d.valorTotal) return 0;
  const taxaMensal  = (d.juros || 0) / 100;
  const n           = d.parcelas || 1;
  const valorParcela = d.valorParcela ||
    (taxaMensal > 0
      ? (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -n))
      : d.valorTotal / n);

  let saldo = d.valorTotal;
  for (let i = 0; i < (d.parcelasPagas || 0); i++) {
    const j = saldo * taxaMensal;
    saldo = Math.max(0, saldo - (valorParcela - j));
  }
  return saldo;
}

// Retorna quantas parcelas não pagas já venceram (data passada)
function calcularParcelasAtrasadas(d) {
  if (!d || !d.vencimento || !d.parcelas) return 0;
  const dataBase = new Date(d.vencimento + 'T12:00:00');
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let count = 0;
  for (let i = (d.parcelasPagas || 0); i < d.parcelas; i++) {
    const dataVenc = addMonthsSafe(dataBase, i);
    dataVenc.setHours(0, 0, 0, 0);
    if (dataVenc < hoje) count++;
    else break;
  }
  return count;
}

// Calcula PMT (Tabela Price)
function calcPMT(valorTotal, taxaMensal, parcelas) {
  if (parcelas <= 0) return 0;
  if (taxaMensal <= 0) return valorTotal / parcelas;
  return (valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -parcelas));
}

// Bug #25: helper confirmarAcao — retorna Promise<boolean>
// Usa SOMENTE style.cssText (nunca classes Tailwind — DEC-006)
function confirmarAcao(titulo, mensagem, textoBotao = 'Confirmar', corBotao = '#dc2626') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-page);border:1px solid var(--card-border);border-radius:1.25rem;padding:1.75rem;max-width:380px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.25);animation:modal-in .2s ease;';

    card.innerHTML = `
      <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">${escapeHTML(titulo)}</div>
      <div style="font-size:0.875rem;font-weight:500;color:var(--text-sec);margin-bottom:1.5rem;">${escapeHTML(mensagem)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;">
        <button data-res="0" style="padding:0.625rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text-sec);">Cancelar</button>
        <button data-res="1" style="padding:0.625rem;border:none;border-radius:0.75rem;background:${escapeHTML(corBotao)};color:#fff;font-size:0.875rem;font-weight:800;cursor:pointer;font-family:inherit;">${escapeHTML(textoBotao)}</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-res]');
      if (btn) cleanup(btn.dataset.res === '1');
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}

// ─────────────────────────────────────────────────────────────────
//  GERENCIAMENTO DE MODAIS
// ─────────────────────────────────────────────────────────────────
const MODAL_IDS = ['modalTipo','modalFormato','modalImportIA','modalDivida','modalDetalhes','modalSimulador'];

function fecharTodosModais() {
  MODAL_IDS.forEach(id => document.getElementById(id)?.classList.remove('open'));
}

function fecharModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function abrirModal(id) {
  document.getElementById(id)?.classList.add('open');
}

// ─────────────────────────────────────────────────────────────────
//  WIZARD — Passo 1: Tipo
// ─────────────────────────────────────────────────────────────────
window.iniciarNovaDivida = function() {
  wizardTipo       = '';
  wizardTipoIcone  = '';
  wizardFormato    = '';
  dadosIA          = null;
  dividaAtual      = null;

  // Resetar seleções visuais
  document.querySelectorAll('#gridTipos .wizard-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('#gridFormatos .wizard-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('btnProximoTipo').disabled    = true;
  document.getElementById('btnProximoFormato').disabled = true;

  fecharTodosModais();
  abrirModal('modalTipo');
};

window.selecionarTipo = function(el) {
  document.querySelectorAll('#gridTipos .wizard-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  wizardTipo      = el.dataset.tipo;
  wizardTipoIcone = el.dataset.icone;
  document.getElementById('btnProximoTipo').disabled = false;
};

window.avancarParaFormato = function() {
  if (!wizardTipo) return;
  fecharModal('modalTipo');
  document.getElementById('tituloFormato').textContent = wizardTipoIcone + ' ' + wizardTipo;
  document.querySelectorAll('#gridFormatos .wizard-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('btnProximoFormato').disabled = true;
  wizardFormato = '';
  abrirModal('modalFormato');
};

window.voltarParaTipo = function() {
  fecharModal('modalFormato');
  abrirModal('modalTipo');
};

// ─────────────────────────────────────────────────────────────────
//  WIZARD — Passo 2: Formato
// ─────────────────────────────────────────────────────────────────
window.selecionarFormato = function(el) {
  document.querySelectorAll('#gridFormatos .wizard-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  wizardFormato = el.dataset.formato;
  document.getElementById('btnProximoFormato').disabled = false;
};

window.avancarParaForm = function() {
  if (!wizardFormato) return;
  fecharModal('modalFormato');
  if (wizardFormato === 'ia') {
    abrirImportIA();
  } else {
    abrirFormManual(null);
  }
};

window.voltarParaFormato = function() {
  fecharTodosModais();
  abrirModal('modalFormato');
};

// ─────────────────────────────────────────────────────────────────
//  IMPORT IA
// ─────────────────────────────────────────────────────────────────
function abrirImportIA() {
  // Reset UI
  limparEstadoIA();
  abrirModal('modalImportIA');

  // Bug #21: esconder aba câmera em desktop
  const isMovel = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const btnCamera = document.getElementById('iaTabCamera');
  if (btnCamera) btnCamera.style.display = isMovel ? '' : 'none';
}

function limparEstadoIA() {
  dadosIA = null;
  document.getElementById('iaFileInput').value = '';
  document.getElementById('iaCameraInput').value = '';
  document.getElementById('iaTextoColar').value = '';

  const fileInfo   = document.getElementById('iaFileInfo');
  const processando = document.getElementById('iaProcessando');
  const erro       = document.getElementById('iaErro');
  const resultado  = document.getElementById('iaResultado');

  if (fileInfo)    { fileInfo.style.display = 'none'; fileInfo.style.setProperty('display','none','important'); }
  if (processando) processando.style.display = 'none';
  if (erro)        erro.style.display = 'none';
  if (resultado)   { resultado.style.display = 'none'; resultado.innerHTML = ''; }

  trocarTabIA('arquivo');
}

window.trocarTabIA = function(tab) {
  ['arquivo','texto','camera'].forEach(t => {
    const btn     = document.getElementById('iaTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const content = document.getElementById('iaConteudo' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn)     btn.classList.toggle('active', t === tab);
    if (content) content.style.display = t === tab ? '' : 'none';
  });
};

// Pré-processa imagem para melhorar precisão do OCR
// Converte para escala de cinza com contraste aumentado e limita resolução máxima
async function _preprocessarImagemOCR(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const fator = 1.6;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const c = Math.min(255, Math.max(0, (gray - 128) * fator + 128));
        data[i] = data[i + 1] = data[i + 2] = c;
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => { URL.revokeObjectURL(url); resolve(blob); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

window.limparArquivoIA = function() {
  document.getElementById('iaFileInput').value  = '';
  document.getElementById('iaCameraInput').value = '';
  const fi = document.getElementById('iaFileInfo');
  if (fi) fi.style.display = 'none';
  const res = document.getElementById('iaResultado');
  if (res) { res.style.display = 'none'; res.innerHTML = ''; }
  document.getElementById('iaErro').style.display = 'none';
  dadosIA = null;
  window.budShowToast?.('Arquivo removido.', 'info');
};

window.processarArquivoIA = async function(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  // Bug #16: rejeitar .doc/.docx com mensagem útil
  const ext = file.name.split('.').pop().toLowerCase();
  if (['doc','docx'].includes(ext)) {
    mostrarErroIA('Arquivos .doc e .docx não são suportados. Exporte o documento para PDF e tente novamente.');
    inputEl.value = '';
    return;
  }

  // Mostrar nome do arquivo
  const fileInfo = document.getElementById('iaFileInfo');
  const fileName = document.getElementById('iaFileName');
  if (fileInfo && fileName) {
    fileName.textContent = file.name;
    fileInfo.style.display = 'flex';
  }

  document.getElementById('iaErro').style.display    = 'none';
  document.getElementById('iaResultado').style.display = 'none';
  document.getElementById('iaProcessando').style.display = '';
  animarStepsIA(1);

  try {
    let texto = '';

    if (file.type === 'application/pdf' || ext === 'pdf') {
      // Bug #6: verificar se pdfjsLib está disponível
      if (!window.pdfjsLib) throw new Error('Biblioteca PDF.js não carregou. Recarregue a página.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      animarStepsIA(1);
      const buffer = await file.arrayBuffer();
      const pdfDoc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      const paginas = [];
      for (let p = 1; p <= Math.min(pdfDoc.numPages, 5); p++) {
        const page    = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        paginas.push(content.items.map(i => i.str).join(' '));
      }
      texto = paginas.join('\n');
    } else if (file.type === 'text/plain' || ext === 'txt') {
      texto = await file.text();
    } else {
      // Imagem — OCR com pré-processamento para máxima precisão
      // Bug #6: verificar se Tesseract está disponível
      if (!window.Tesseract) throw new Error('Biblioteca Tesseract.js não carregou. Recarregue a página.');
      animarStepsIA(1);
      const imgOtimizada = await _preprocessarImagemOCR(file);
      const tessWorker = await window.Tesseract.createWorker('por', 1); // OEM 1 = LSTM only
      try {
        await tessWorker.setParameters({ tessedit_pageseg_mode: '6' }); // PSM 6 = single block
        const { data: { text: tessText } } = await tessWorker.recognize(imgOtimizada);
        texto = tessText;
      } finally {
        await tessWorker.terminate();
      }
    }

    animarStepsIA(2);
    if (!texto.trim()) throw new Error('Não foi possível extrair texto do arquivo. Tente com um arquivo mais legível.');

    await processarTextoExtraido(texto);
  } catch (err) {
    (window.budError||console.error)('[Dividas] processarArquivoIA:', err);
    mostrarErroIA(err.message || 'Erro ao processar o arquivo.');
    document.getElementById('iaProcessando').style.display = 'none';
  }
};

window.processarTextoIA = async function() {
  const texto = document.getElementById('iaTextoColar').value.trim();
  if (!texto) { window.budShowToast?.('Cole um texto para analisar.', 'warning'); return; }

  document.getElementById('iaErro').style.display     = 'none';
  document.getElementById('iaResultado').style.display = 'none';
  document.getElementById('iaProcessando').style.display = '';
  animarStepsIA(1);

  try {
    await processarTextoExtraido(texto);
  } catch (err) {
    (window.budError||console.error)('[Dividas] processarTextoIA:', err);
    mostrarErroIA(err.message || 'Erro ao analisar o texto.');
    document.getElementById('iaProcessando').style.display = 'none';
  }
};

async function processarTextoExtraido(texto) {
  animarStepsIA(2);
  await new Promise(r => setTimeout(r, 200)); // deixa a UI atualizar

  const classif = classificarContrato(texto);
  const dados   = extrairDadosDoTexto(texto);
  dados.tipo    = dados.tipo || classif.tipo;
  classif.confianca = calcularConfiancaExtracao(dados);

  animarStepsIA(3);
  await new Promise(r => setTimeout(r, 200));

  document.getElementById('iaProcessando').style.display = 'none';
  mostrarPreviewIA(dados, classif);
}

// Classificação do tipo de contrato por palavras-chave
const TIPOS_CONTRATO = {
  'Financiamento': ['financiamento','alienação fiduciária','imóvel','veículo','carro','moto','cnh','gravame','hipoteca'],
  'Empréstimo Consignado': ['consignado','ccb','cédula de crédito bancário','consig','margem consignável','descontado em folha'],
  'Empréstimo Pessoal': ['empréstimo','pessoal','cdc','crédito pessoal','capital de giro','credifácil'],
  'Cartão Parcelado': ['cartão','cartao','parcelamento','fatura','anuidade','visa','mastercard','elo'],
  'Consórcio': ['consórcio','grupo','cota','lance','contemplação','administradora'],
  'Dívida Informal': ['amigo','familiar','familiar','devo','emprestou','receberei'],
};

function classificarContrato(texto) {
  const lower = texto.toLowerCase();
  let melhorTipo = wizardTipo || 'Outro';
  let melhorScore = 0;

  Object.entries(TIPOS_CONTRATO).forEach(([tipo, kws]) => {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > melhorScore) { melhorScore = score; melhorTipo = tipo; }
  });

  return { tipo: melhorTipo, confianca: Math.min(100, melhorScore * 20 + 30) };
}

// Confiança baseada na qualidade da extração de dados (não em keywords)
function calcularConfiancaExtracao(dados) {
  let pts = 0;
  if (dados.valorTotal)                pts += 25;
  if (dados.parcelas)                  pts += 20;
  if (dados.valorParcela)              pts += 20;
  if (dados.juros)                     pts += 20;
  if (dados.cetMensal || dados.cet)    pts +=  5;
  if (dados.instituicao)               pts +=  5;
  if (dados.vencimento)                pts +=  5;
  return Math.min(100, pts);
}

// Extração de dados por regexes
function extrairDadosDoTexto(texto) {
  const t = texto;
  const dados = {};

  const num = s => { const n = parseFloat(s.replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; };

  // ── Valor Total Financiado (prioridade) → Valor ao Final → Valor Liberado ──
  const rFinanc = t.match(/valor\s*total\s*financiado\s*R?\$?\s*([\d.,]+)/i);
  if (rFinanc) dados.valorTotal = num(rFinanc[1]);

  if (!dados.valorTotal) {
    const rFinal = t.match(/valor\s*(?:total\s*)?ao\s*final\s*[:\-]?\s*R?\$?\s*([\d.,]+)/i);
    if (rFinal) dados.valorTotal = num(rFinal[1]);
  }

  if (!dados.valorTotal) {
    const rLib = t.match(/valor\s*(?:liberado|l[íi]quido|do\s*empr[eé]stimo|do\s*contrato)\s*R?\$?\s*([\d.,]+)/i);
    if (rLib) dados.valorTotal = num(rLib[1]);
  }

  // ── Valor da Parcela ──────────────────────────────────────────────────────
  const rParcela = t.match(/valor\s*da\s*parcela\s*[:\-]?\s*R?\$?\s*([\d.,]+)/i);
  if (rParcela) dados.valorParcela = num(rParcela[1]);

  if (!dados.valorParcela) {
    const rPrest = t.match(/(?:prestação\s*mensal|parcela\s*(?:mensal|fixa))\s*[:\-]?\s*R?\$?\s*([\d.,]+)/i);
    if (rPrest) dados.valorParcela = num(rPrest[1]);
  }

  // Padrão "18x R$ 465,45" / "17x de R$ 465,45" / "NxR$"
  const rNxRS = t.match(/(\d+)\s*[xX×]\s*(?:de\s+)?R?\$?\s*([\d.,]+)/);
  if (rNxRS) {
    if (!dados.parcelas)     dados.parcelas    = parseInt(rNxRS[1], 10);
    if (!dados.valorParcela) dados.valorParcela = num(rNxRS[2]);
  }

  // ── Número de parcelas ────────────────────────────────────────────────────
  // "Nº de Parcelas (mensais) 18" — Nº usa U+00BA (º)
  const rNroParcelas = t.match(/n[º°o]\s*(?:de\s*)?parcelas?\s*(?:\([^)]*\))?\s*(\d+)/i);
  if (rNroParcelas) dados.parcelas = parseInt(rNroParcelas[1], 10);

  // "Prazo Total: 18 meses"
  if (!dados.parcelas) {
    const rPrazo = t.match(/prazo\s*(?:total|em\s*meses)?\s*[:\-]?\s*(\d+)\s*meses/i);
    if (rPrazo) dados.parcelas = parseInt(rPrazo[1], 10);
  }

  // "número de parcelas: 18"
  if (!dados.parcelas) {
    const rNParc = t.match(/(?:n[uú]mero\s*de\s*parcelas|total\s*de\s*parcelas)\s*[:\-]?\s*(\d+)/i);
    if (rNParc) dados.parcelas = parseInt(rNParc[1], 10);
  }

  // ── Parcelas já pagas (mencionadas no documento) ──────────────────────────
  const rPagas = t.match(/(?:quantidade\s*de\s*parcelas?\s*pagas?|parcelas?\s*pagas?|j[aá]\s*(?:foram\s*)?pagas?)\s*[:\-]?\s*\n?(\d+)/i);
  if (rPagas) dados.parcelasPagas = parseInt(rPagas[1], 10);

  // ── Taxa de juros mensal ──────────────────────────────────────────────────
  // "Taxa de Juros 3,03% a.m." / "Taxa de juros 3,03% ao mês"
  // Suporta layout de grade (valor na linha seguinte ao label)
  const rJurosAM = t.match(/taxa\s*(?:de\s*)?juros[^\n]*?\n?\s*([\d.,]+)\s*%\s*(?:a\.m\.|ao\s*m[eê]s)/i);
  if (rJurosAM) dados.juros = num(rJurosAM[1]);

  if (!dados.juros) {
    const rJurosMes = t.match(/(?:taxa\s*(?:de\s*juros\s*)?mensal|juros\s*mensais?)\s*[:\-]?\s*([\d.,]+)\s*%/i);
    if (rJurosMes) dados.juros = num(rJurosMes[1]);
  }

  // Fallback: taxa anual → converte para mensal
  if (!dados.juros) {
    const rJurosAa = t.match(/taxa\s*(?:de\s*)?juros[^\n]*?\n?\s*([\d.,]+)\s*%\s*a\.a\./i);
    if (rJurosAa) dados.juros = +((Math.pow(1 + num(rJurosAa[1]) / 100, 1/12) - 1) * 100).toFixed(4);
  }

  // ── CET ────────────────────────────────────────────────────────────────────
  // "CET – CUSTO EFETIVO TOTAL: 4,18% a.m. / 64,52% a.a." (captura a.a.)
  // Suporta layout de grade (valor na linha seguinte ao label)
  const rCETaa = t.match(/(?:cet|custo\s*efetivo\s*total)[^\n]*?\n?\s*([\d.,]+)\s*%\s*a\.a\./i);
  if (rCETaa) dados.cet = num(rCETaa[1]);

  // "CET 3,34% ao mês" (captura mensal)
  if (!dados.cet) {
    const rCETmes = t.match(/(?:cet|custo\s*efetivo\s*total)[^\n]*?\n?\s*([\d.,]+)\s*%\s*(?:a\.m\.|ao\s*m[eê]s)/i);
    if (rCETmes) dados.cetMensal = num(rCETmes[1]);
  }

  if (!dados.cet && !dados.cetMensal) {
    // genérico sem contexto a.m./a.a.
    const rCETgen = t.match(/(?:cet|custo\s*efetivo\s*total)[^\n]*?\n?\s*([\d.,]+)\s*%/i);
    if (rCETgen) dados.cet = num(rCETgen[1]);
  }

  // ── IOF ───────────────────────────────────────────────────────────────────
  const rIOF = t.match(/iof\s*(?:\([^)]*\))?\s*R?\$?\s*([\d.,]+)/i);
  if (rIOF) dados.iof = num(rIOF[1]);

  // ── Seguro ────────────────────────────────────────────────────────────────
  const rSeg = t.match(/seguros?\s*(?:\([^)]*\))?\s*R?\$?\s*([\d.,]+)/i);
  if (rSeg) dados.seguro = num(rSeg[1]);

  // ── Data 1ª parcela ───────────────────────────────────────────────────────
  // "Venc.1ª e Última Parcela 01/12/2025" / "1ª parcela: 01/01/2025"
  const rVenc = t.match(/(?:venc\.?\s*1[aª]|1[aª]\s*parcela|primeiro\s*vencimento|data\s*(?:da\s*)?1[aª])[^0-9]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (rVenc) {
    const iso = parseDataBR(rVenc[1]);
    if (iso) dados.vencimento = iso;
  }

  // Fallback: início da vigência do contrato
  if (!dados.vencimento) {
    const rVig = t.match(/vig[eê]ncia[^0-9]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (rVig) { const iso = parseDataBR(rVig[1]); if (iso) dados.vencimento = iso; }
  }
  // Fallback: "Início desconto ABR 2026" → 01/ABR/2026
  if (!dados.vencimento) {
    const rIniDesc = t.match(/in[íi]cio\s*desconto\s+([A-ZÀ-Ú]{3,})\s+(\d{4})/i);
    if (rIniDesc) {
      const mMap = {JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12};
      const mm = mMap[(rIniDesc[1]||'').toUpperCase().slice(0,3)];
      const aa = parseInt(rIniDesc[2], 10);
      if (mm && aa) dados.vencimento = `${aa}-${String(mm).padStart(2,'0')}-01`;
    }
  }

  // ── Instituição (word-boundary, prioridade específica → genérica) ─────────
  const bancosOrdenados = [
    { re: /c6\s*consig/i,           nome: 'C6 Consig'       },
    { re: /banco\s*c6\b/i,          nome: 'C6 Bank'         },
    { re: /banco\s*do\s*brasil/i,   nome: 'Banco do Brasil' },
    { re: /\bnubank\b/i,            nome: 'Nubank'          },
    { re: /\bbradesco\b/i,          nome: 'Bradesco'        },
    { re: /\bsantander\b/i,         nome: 'Santander'       },
    { re: /\bitaú\b|\bitau\b/i,     nome: 'Itaú'            },
    { re: /\bcaixa\b/i,             nome: 'Caixa'           },
    { re: /\bsicoob\b/i,            nome: 'Sicoob'          },
    { re: /\bsicredi\b/i,           nome: 'Sicredi'         },
    { re: /\bagibank\b/i,           nome: 'Agibank'         },
    { re: /\bdaycoval\b/i,          nome: 'Daycoval'        },
    { re: /\bsafra\b/i,             nome: 'Safra'           },
    { re: /\bvotorantim\b/i,        nome: 'Votorantim'      },
    { re: /\bpicpay\b/i,            nome: 'PicPay'          },
    { re: /\bbmg\b/i,               nome: 'BMG'             },
    { re: /\bpan\b/i,               nome: 'PAN'             },
    { re: /\binter\b/i,             nome: 'Inter'           },
    { re: /\bc6\b/i,                nome: 'C6 Bank'         },
    { re: /\bcetelem\b/i,           nome: 'Cetelem'         },
    { re: /\bcreditas\b/i,          nome: 'Creditas'        },
    { re: /\bcredsystem\b/i,        nome: 'Credsystem'      },
  ];
  for (const b of bancosOrdenados) {
    if (b.re.test(t)) { dados.instituicao = b.nome; break; }
  }

  // ── Nome do contratante ───────────────────────────────────────────────────
  const rNome = t.match(/(?:contratante|devedor|cliente|emitente)\s*(?:\("?você"?\))?\s*[:\-]?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/);
  if (rNome) dados.nomeCliente = rNome[1];

  // ── Cálculos derivados ────────────────────────────────────────────────────
  if (!dados.valorTotal && dados.valorParcela && dados.parcelas) {
    dados.valorTotal = dados.valorParcela * dados.parcelas;
  }
  if (!dados.valorPago && dados.valorParcela && dados.parcelasPagas) {
    dados.valorPago = dados.valorParcela * dados.parcelasPagas;
  }

  return dados;
}

function mostrarPreviewIA(dados, classif) {
  const el = document.getElementById('iaResultado');
  if (!el) return;

  dadosIA = dados;

  const rows = [];
  if (dados.valorTotal)    rows.push(['Valor Total Financiado', fmtIA(dados.valorTotal)]);
  if (dados.valorParcela)  rows.push(['Parcela Mensal', fmtIA(dados.valorParcela)]);
  if (dados.parcelas)      rows.push(['Total de Parcelas', dados.parcelas + 'x']);
  if (dados.juros)         rows.push(['Juros Mensal', dados.juros.toFixed(2) + '% a.m.']);
  if (dados.cet)           rows.push(['CET (anual)', dados.cet.toFixed(2) + '% a.a.']);
  if (dados.cetMensal)     rows.push(['CET (mensal)', dados.cetMensal.toFixed(2) + '% a.m.']);
  if (dados.iof)           rows.push(['IOF', fmtIA(dados.iof)]);
  if (dados.seguro)        rows.push(['Seguro', fmtIA(dados.seguro)]);
  if (dados.instituicao)   rows.push(['Instituição', dados.instituicao]);
  if (dados.vencimento)    rows.push(['1ª Parcela', formatDataBR(dados.vencimento)]);

  const confiancaCor = classif.confianca >= 70 ? '#16a34a' : classif.confianca >= 40 ? '#d97706' : '#dc2626';
  const parcInit = dados.parcelasPagas ?? 0;
  const totalParc = dados.parcelas ? `de ${dados.parcelas}x` : '';

  el.style.display = '';
  el.innerHTML = `
    <div style="background:var(--input-bg);border-radius:0.875rem;padding:1rem;border:1px solid var(--input-border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
        <span style="font-size:0.875rem;font-weight:800;color:var(--text-main);">📋 Dados Extraídos</span>
        <span style="font-size:0.75rem;font-weight:700;color:${confiancaCor};">${classif.confianca}% de confiança</span>
      </div>
      ${rows.length === 0
        ? '<p style="font-size:0.8125rem;color:var(--text-sec);">Nenhum dado identificado. Preencha manualmente.</p>'
        : rows.map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;padding:0.3125rem 0;border-bottom:1px solid var(--input-border);font-size:0.8125rem;">
            <span style="color:var(--text-sec);font-weight:600;">${escapeHTML(k)}</span>
            <span style="color:var(--text-main);font-weight:700;">${escapeHTML(v)}</span>
          </div>
        `).join('')
      }
      <div style="margin-top:0.875rem;padding:0.75rem;background:var(--card-bg);border-radius:0.625rem;border:1.5px solid var(--bud-primary,#2563eb);">
        <label style="font-size:0.75rem;font-weight:800;color:var(--bud-primary,#2563eb);display:block;margin-bottom:0.375rem;">📆 PARCELAS JÁ PAGAS (ou em atraso)</label>
        <div style="display:flex;align-items:center;gap:0.625rem;">
          <input id="iaParcelasPagas" type="number" min="0" max="${dados.parcelas || 9999}" value="${parcInit}"
            style="width:72px;padding:0.375rem 0.5rem;border:1.5px solid var(--input-border);border-radius:0.5rem;background:var(--input-bg);color:var(--text-main);font-size:1rem;font-weight:800;text-align:center;font-family:inherit;"
            oninput="window._syncParcelasPagasIA(this.value)">
          <span style="font-size:0.8125rem;color:var(--text-sec);font-weight:600;">${totalParc} — informe 0 se nenhuma foi paga ainda</span>
        </div>
      </div>
      <button id="btnSalvarIA" onclick="salvarDividaIA()" style="margin-top:0.875rem;width:100%;padding:0.625rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:0.875rem;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s;">
        💾 Salvar Dívida
      </button>
      <button onclick="abrirFormManual(null, true)" style="margin-top:0.5rem;width:100%;padding:0.5rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);color:var(--text-sec);font-size:0.8125rem;font-weight:700;cursor:pointer;font-family:inherit;">
        ✏️ Editar antes de salvar
      </button>
    </div>
  `;
}

// Sincroniza o input de parcelas pagas na IA com dadosIA
window._syncParcelasPagasIA = function(val) {
  if (!dadosIA) return;
  const n = Math.max(0, parseInt(val, 10) || 0);
  dadosIA.parcelasPagas = n;
  if (dadosIA.valorParcela) dadosIA.valorPago = n * dadosIA.valorParcela;
};

// Bug #17: try/catch + botão desabilitado durante save
window.salvarDividaIA = async function() {
  if (!dadosIA) return;

  // Ler parcelas pagas do input antes de salvar
  const inputPP = document.getElementById('iaParcelasPagas');
  if (inputPP) {
    const pp = Math.max(0, parseInt(inputPP.value, 10) || 0);
    dadosIA.parcelasPagas = pp;
    if (dadosIA.valorParcela) dadosIA.valorPago = pp * dadosIA.valorParcela;
  }

  const btn = document.getElementById('btnSalvarIA');
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    const dados = {
      nome:          escapeHTML(dadosIA.nomeCliente || wizardTipo),
      tipoIcone:     wizardTipoIcone || '📄',
      tipo:          wizardTipo || 'Outro',
      instituicao:   escapeHTML(dadosIA.instituicao || ''),
      formato:       'ia',
      valorTotal:    dadosIA.valorTotal    || 0,
      valorPago:     dadosIA.valorPago     || 0,
      jurosPagos:    0,
      parcelas:      dadosIA.parcelas      || 0,
      parcelasPagas: dadosIA.parcelasPagas || 0,
      valorParcela:  dadosIA.valorParcela  || 0,
      juros:         dadosIA.juros         || 0,
      cet:           dadosIA.cet           || 0,
      iof:           dadosIA.iof           || 0,
      seguro:        dadosIA.seguro        || 0,
      vencimento:    dadosIA.vencimento    || null,
      importadoPorIA: true,
      criadoEm:      serverTimestamp(),
      atualizadoEm:  serverTimestamp(),
    };

    await addDoc(collection(db, 'usuarios', currentUser.uid, 'dividas'), dados);
    fecharTodosModais();
    window.budShowToast?.('Dívida importada com sucesso!', 'success');
  } catch (err) {
    (window.budError||console.error)('[Dividas] salvarDividaIA:', err);
    window.budShowToast?.('Erro ao salvar. Tente novamente.', 'error');
    btn.disabled = false;
    btn.textContent = '💾 Salvar Dívida';
  }
};

function animarStepsIA(stepAtual) {
  const steps = [
    { id: 1, label: 'Lendo documento…' },
    { id: 2, label: 'Extraindo dados…' },
    { id: 3, label: 'Classificando contrato…' },
  ];

  const lista = document.getElementById('iaStepsList');
  if (!lista) return;
  lista.innerHTML = '';

  steps.forEach(({ id, label }) => {
    const el = document.createElement('div');
    const done    = id < stepAtual;
    const active  = id === stepAtual;
    el.style.cssText = 'display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem;font-weight:600;' +
      (done ? 'color:#16a34a;' : active ? 'color:var(--text-main);' : 'color:var(--text-sec);opacity:0.5;');

    const icon = done ? '✅' : active ? '⏳' : '○';
    el.textContent = icon + ' ' + label;
    lista.appendChild(el);
  });
}

function mostrarErroIA(msg) {
  const el    = document.getElementById('iaErro');
  const msgEl = document.getElementById('iaErroMsg');
  if (el)    el.style.display = '';
  if (msgEl) msgEl.textContent = msg;
}

// ─────────────────────────────────────────────────────────────────
//  FORMULÁRIO MANUAL
// ─────────────────────────────────────────────────────────────────
function abrirFormManual(rec, comDadosIA = false) {
  dividaAtual = rec || null;
  const isEditar = !!rec;

  document.getElementById('tituloDivida').textContent = isEditar ? 'Editar Dívida' : 'Nova Dívida';
  document.getElementById('dividaId').value           = isEditar ? rec.id : '';
  document.getElementById('dividaNome').value         = isEditar ? (rec.nome || '') : '';
  document.getElementById('dividaInstituicao').value  = isEditar ? (rec.instituicao || '') : '';
  document.getElementById('dividaParcelas').value     = isEditar ? (rec.parcelas || '') : '';
  document.getElementById('dividaParcelasPagas').value = isEditar ? (rec.parcelasPagas || '') : '';
  document.getElementById('dividaJuros').value        = isEditar ? (rec.juros || '') : '';
  document.getElementById('dividaVencimento').value   = isEditar && rec.vencimento ? formatDataBR(rec.vencimento) : '';

  // Valores monetários (máscara BRL)
  const setMoeda = (id, v) => {
    if (!v) { document.getElementById(id).value = ''; return; }
    const cents  = Math.round(v * 100);
    const reais  = Math.floor(cents / 100);
    const cStr   = String(cents % 100).padStart(2, '0');
    document.getElementById(id).value = reais.toLocaleString('pt-BR') + ',' + cStr;
  };
  setMoeda('dividaValorTotal',   isEditar ? rec.valorTotal : 0);
  setMoeda('dividaValorPago',    isEditar ? rec.valorPago  : 0);
  setMoeda('dividaValorParcela', isEditar ? rec.valorParcela : 0);

  // Preencher com dados da IA (se vier do preview)
  if (comDadosIA && dadosIA) {
    if (dadosIA.nomeCliente) document.getElementById('dividaNome').value = dadosIA.nomeCliente;
    if (dadosIA.instituicao) document.getElementById('dividaInstituicao').value = dadosIA.instituicao;
    if (dadosIA.parcelas)    document.getElementById('dividaParcelas').value = dadosIA.parcelas;
    if (dadosIA.parcelasPagas) document.getElementById('dividaParcelasPagas').value = dadosIA.parcelasPagas;
    if (dadosIA.juros)       document.getElementById('dividaJuros').value = dadosIA.juros;
    if (dadosIA.vencimento)  document.getElementById('dividaVencimento').value = formatDataBR(dadosIA.vencimento);
    setMoeda('dividaValorTotal',   dadosIA.valorTotal   || 0);
    setMoeda('dividaValorPago',    dadosIA.valorPago    || 0);
    setMoeda('dividaValorParcela', dadosIA.valorParcela || 0);
  }

  // Exibir/ocultar campo de juros conforme formato
  const fmt = isEditar ? rec.formato : wizardFormato;
  const fieldJuros = document.getElementById('fieldJuros');
  if (fieldJuros) fieldJuros.style.display = fmt === 'juros' ? '' : 'none';

  // Botão excluir
  document.getElementById('btnExcluirDivida').style.display = isEditar ? '' : 'none';

  // Limpar erros
  ['dividaNome','dividaValorTotal','dividaParcelas'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });

  // Adaptar labels/placeholders/campos conforme tipo de dívida
  _adaptarFormTipo(isEditar ? (rec.tipo || '') : (wizardTipo || ''));

  fecharTodosModais();
  abrirModal('modalDivida');
}

window.abrirFormManual = abrirFormManual;

// ─── Adaptar formulário por tipo de dívida ──────────────────────────────────
function _adaptarFormTipo(tipo) {
  const REQ = ' <span style="color:#dc2626">*</span>';

  // Defaults (tipo 'Outro' ou desconhecido)
  let labelNome          = 'Nome / Credor';
  let placeholderNome    = 'Ex: Empréstimo Nubank, Financiamento Caixa…';
  let labelInst          = 'Instituição';
  let placeholderInst    = 'Nubank, Caixa, Itaú…';
  let labelValorTotal    = 'Valor Original';
  let labelParcelas      = 'Total de Parcelas';
  let labelParcelasPagas = 'Já Pagas';
  let labelParcela       = 'Valor da Parcela';
  let labelVencimento    = 'Data da 1ª Parcela';
  let forcarJuros        = null; // null = respeita formato selecionado

  switch (tipo) {
    case 'Empréstimo':
      labelNome       = 'Nome do Empréstimo';
      placeholderNome = 'Ex: Empréstimo pessoal, CDC, Crédito consignado…';
      labelInst       = 'Banco / Credor';
      placeholderInst = 'Nubank, Banco do Brasil, CEF…';
      forcarJuros     = true;
      break;
    case 'Financiamento':
      labelNome       = 'Bem Financiado';
      placeholderNome = 'Ex: Apartamento 3 quartos, Honda Civic 2023…';
      labelInst       = 'Banco / Financeira';
      placeholderInst = 'Caixa, Bradesco, Santander…';
      forcarJuros     = true;
      break;
    case 'Cartão':
      labelNome       = 'Nome do Cartão';
      placeholderNome = 'Ex: Nubank Roxinho, Inter Mastercard…';
      labelInst       = 'Bandeira / Banco';
      placeholderInst = 'Visa, Mastercard, Elo…';
      labelParcelas   = 'Total de Parcelas da Fatura';
      labelParcela    = 'Fatura Mínima';
      labelVencimento = 'Vencimento da Fatura';
      forcarJuros     = true;
      break;
    case 'Consórcio':
      labelNome          = 'Grupo / Consórcio';
      placeholderNome    = 'Ex: Consórcio Caixa Imóvel 2024…';
      labelInst          = 'Administradora';
      placeholderInst    = 'Caixa, Porto Seguro, Embracon…';
      labelValorTotal    = 'Crédito Contratado';
      labelParcelas      = 'Total de Cotas';
      labelParcelasPagas = 'Cotas Pagas';
      labelVencimento    = 'Vencimento da Cota';
      forcarJuros        = false;
      break;
    case 'Informal':
      labelNome       = 'Descrição da Dívida';
      placeholderNome = 'Ex: Dinheiro emprestado, Ajuda familiar…';
      labelInst       = 'Credor (pessoa)';
      placeholderInst = 'Nome do amigo, familiar, colega…';
      labelVencimento = 'Data de acerto combinada';
      forcarJuros     = false;
      break;
  }

  // Aplicar labels (preservando asterisco de obrigatório)
  const setLbl = (id, text, req) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = text + (req ? REQ : '');
  };
  setLbl('lbl-dividaNome',          labelNome,          true);
  setLbl('lbl-dividaInstituicao',   labelInst,          false);
  setLbl('lbl-dividaValorTotal',    labelValorTotal,    true);
  setLbl('lbl-dividaParcelas',      labelParcelas,      true);
  setLbl('lbl-dividaParcelasPagas', labelParcelasPagas, false);
  setLbl('lbl-dividaValorParcela',  labelParcela,       false);
  setLbl('lbl-dividaVencimento',    labelVencimento,    false);

  // Aplicar placeholders
  const setP = (id, text) => { const el = document.getElementById(id); if (el) el.placeholder = text; };
  setP('dividaNome',       placeholderNome);
  setP('dividaInstituicao', placeholderInst);

  // Forçar juros visível/oculto se o tipo exige (sobrescreve a lógica de formato)
  if (forcarJuros !== null) {
    const fj = document.getElementById('fieldJuros');
    if (fj) fj.style.display = forcarJuros ? '' : 'none';
  }
}

// PMT calc exposto globalmente
window.calcularPMTForm = function() {
  const valorTotal  = parseMoeda(document.getElementById('dividaValorTotal').value);
  const parcelas    = parseInt(document.getElementById('dividaParcelas').value, 10);
  const juros       = parseFloat(document.getElementById('dividaJuros').value) || 0;

  if (!valorTotal || !parcelas) {
    window.budShowToast?.('Preencha o valor total e o número de parcelas.', 'warning');
    return;
  }

  const pmt = calcPMT(valorTotal, juros / 100, parcelas);
  const cents  = Math.round(pmt * 100);
  const reais  = Math.floor(cents / 100);
  const cStr   = String(cents % 100).padStart(2, '0');
  document.getElementById('dividaValorParcela').value = reais.toLocaleString('pt-BR') + ',' + cStr;
};

async function salvarDivida() {
  if (_salvando) return;
  _salvando = true;

  const id            = document.getElementById('dividaId').value;
  const nome          = escapeHTML(document.getElementById('dividaNome').value.trim());
  const instituicao   = escapeHTML(document.getElementById('dividaInstituicao').value.trim());
  const valorTotal    = parseMoeda(document.getElementById('dividaValorTotal').value);
  const valorPago     = parseMoeda(document.getElementById('dividaValorPago').value) || 0;
  const parcelas      = parseInt(document.getElementById('dividaParcelas').value, 10) || 0;
  const parcelasPagas = parseInt(document.getElementById('dividaParcelasPagas').value, 10) || 0;
  const valorParcela  = parseMoeda(document.getElementById('dividaValorParcela').value) || 0;
  const juros         = parseFloat(document.getElementById('dividaJuros').value) || 0;
  const vencIso       = parseDataBR(document.getElementById('dividaVencimento').value);

  // Bug #4: validação
  let erros = false;
  if (!nome) {
    document.getElementById('dividaNome').classList.add('error');
    erros = true;
  } else {
    document.getElementById('dividaNome').classList.remove('error');
  }
  if (!valorTotal || valorTotal <= 0) {
    document.getElementById('dividaValorTotal').classList.add('error');
    erros = true;
  } else {
    document.getElementById('dividaValorTotal').classList.remove('error');
  }
  if (!parcelas || parcelas < 1) {
    document.getElementById('dividaParcelas').classList.add('error');
    erros = true;
  } else {
    document.getElementById('dividaParcelas').classList.remove('error');
  }
  if (erros) { _salvando = false; return; }

  const btn = document.getElementById('btnSalvarDivida');
  btn.disabled    = true;
  btn.textContent = 'Salvando…';

  // Calcular juros pagos acumulados (Tabela Price)
  const pmt = valorParcela || calcPMT(valorTotal, juros / 100, parcelas);
  let saldo = valorTotal;
  let jurosPagosCalc = 0;
  for (let i = 0; i < parcelasPagas; i++) {
    const j = saldo * (juros / 100);
    jurosPagosCalc += j;
    saldo = Math.max(0, saldo - (pmt - j));
  }

  try {
    const dados = {
      nome,
      tipoIcone:    wizardTipoIcone || dividaAtual?.tipoIcone || '📄',
      tipo:         wizardTipo      || dividaAtual?.tipo      || 'Outro',
      instituicao,
      formato:      wizardFormato   || dividaAtual?.formato   || 'livre',
      valorTotal,
      valorPago:    Math.min(valorTotal, parseMoeda(document.getElementById('dividaValorPago').value) || pmt * parcelasPagas),
      jurosPagos:   jurosPagosCalc,
      parcelas,
      parcelasPagas: Math.min(parcelasPagas, parcelas),
      valorParcela:  pmt,
      juros,
      vencimento:   vencIso || null,
      atualizadoEm: serverTimestamp(),
    };

    if (id) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid, 'dividas', id), dados);
    } else {
      dados.importadoPorIA = false;
      dados.criadoEm       = serverTimestamp();
      await addDoc(collection(db, 'usuarios', currentUser.uid, 'dividas'), dados);
    }

    fecharTodosModais();
    window.budShowToast?.(id ? 'Dívida atualizada!' : 'Dívida criada!', 'success');
  } catch (err) {
    (window.budError||console.error)('[Dividas] salvarDivida:', err);
    window.budShowToast?.('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Salvar Dívida';
    _salvando       = false;
  }
}

// ─────────────────────────────────────────────────────────────────
//  DETALHES — Abrir e Abas
// ─────────────────────────────────────────────────────────────────
window.trocarTab = function(tab) {
  _tabAtualDetalhes = tab;
  document.querySelectorAll('#modalDetalhes .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('tabResumo').style.display   = tab === 'resumo'   ? '' : 'none';
  document.getElementById('tabParcelas').style.display = tab === 'parcelas' ? '' : 'none';
  if (tab === 'parcelas' && dividaAtual) renderizarParcelas(dividaAtual);
};

window.abrirDetalhes = function(id, tabInicial) {
  const d = dividas.find(x => x.id === id);
  if (!d) return;
  dividaAtual = d;

  const saldo      = calcularSaldoDevedor(d);
  const totalPago  = (d.valorPago || 0);
  const jurosPagos = (d.jurosPagos || 0);
  const pct        = d.valorTotal > 0 ? Math.min(100, Math.round((1 - saldo / d.valorTotal) * 100)) : 0;

  document.getElementById('detalhesNome').textContent    = escapeHTML(d.nome || '—');
  document.getElementById('detPct').textContent           = pct + '%';
  document.getElementById('detProgressoBar').style.width  = pct + '%';
  document.getElementById('detValorTotal').textContent    = formatMoeda(d.valorTotal);
  document.getElementById('detSaldo').textContent         = formatMoeda(saldo);
  document.getElementById('detPago').textContent          = formatMoeda(totalPago);
  document.getElementById('detJurosPagos').textContent    = formatMoeda(jurosPagos);
  document.getElementById('detParcelasInfo').textContent  = `${d.parcelasPagas || 0}/${d.parcelas || 0} parcelas pagas`;
  document.getElementById('detTipo').textContent          = (d.tipoIcone || '') + ' ' + (d.tipo || '—');

  abrirModal('modalDetalhes');

  // Bug #24: usar tabInicial || _tabAtualDetalhes
  const tab = tabInicial || _tabAtualDetalhes;
  window.trocarTab(tab);
  if (tab === 'parcelas') renderizarParcelas(d);
};

window.editarDivida = function() {
  if (!dividaAtual) return;
  fecharModal('modalDetalhes');
  abrirFormManual(dividaAtual);
};

// ─────────────────────────────────────────────────────────────────
//  PARCELAS
// ─────────────────────────────────────────────────────────────────
function renderizarParcelas(d) {
  const lista = document.getElementById('listaParcelas');
  if (!lista || !d) return;

  if (!d.parcelas) {
    lista.innerHTML = '<div style="text-align:center;padding:1.5rem;font-size:0.875rem;color:var(--text-sec);">Nenhuma parcela cadastrada.</div>';
    return;
  }

  const taxaMensal = (d.juros || 0) / 100;
  const pmt = d.valorParcela || calcPMT(d.valorTotal || 0, taxaMensal, d.parcelas);

  // Calcular data de início
  let dataBase = d.vencimento ? new Date(d.vencimento + 'T12:00:00') : null;

  const hojeParc = new Date(); hojeParc.setHours(0, 0, 0, 0);

  lista.innerHTML = '';
  let saldo = d.valorTotal || 0;

  for (let i = 0; i < d.parcelas; i++) {
    const paga    = i < (d.parcelasPagas || 0);

    const jurosParc = saldo * taxaMensal;
    const amort     = Math.max(0, pmt - jurosParc);
    saldo           = Math.max(0, saldo - amort);

    // Bug #10: addMonthsSafe para datas de parcelas
    const dataVenc = dataBase ? addMonthsSafe(dataBase, i) : null;

    // Detectar atraso: não paga e data já passou
    const dataVencCmp = dataVenc ? new Date(dataVenc) : null;
    if (dataVencCmp) dataVencCmp.setHours(0, 0, 0, 0);
    const vencida = !paga && dataVencCmp !== null && dataVencCmp < hojeParc;
    const proxima = !paga && !vencida && i === (d.parcelasPagas || 0);

    // Calcular dias de atraso
    const diasAtraso = vencida
      ? Math.round((hojeParc - dataVencCmp) / 86400000)
      : 0;

    const el = document.createElement('div');
    // Bug #18: usar style inline, NÃO classes Tailwind dinâmicas
    const bgColor = paga
      ? 'background:rgba(236,253,245,0.6);border-color:rgba(134,239,172,0.5);'
      : vencida
        ? 'background:rgba(254,242,242,0.8);border-color:rgba(252,165,165,0.6);'
        : proxima
          ? 'background:rgba(239,246,255,0.6);border-color:rgba(147,197,253,0.5);'
          : 'background:rgba(248,250,252,0.5);border-color:rgba(226,232,240,0.5);';

    el.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:0.75rem;border-radius:0.875rem;margin-bottom:0.5rem;border:1.5px solid transparent;${bgColor}`;

    const statusIcon  = paga ? '✅' : vencida ? '🔴' : proxima ? '🔵' : '○';
    const statusColor = paga ? '#16a34a' : vencida ? '#dc2626' : proxima ? '#2563eb' : 'var(--text-sec)';
    const dataStr     = dataVenc
      ? `${String(dataVenc.getDate()).padStart(2,'0')}/${String(dataVenc.getMonth()+1).padStart(2,'0')}/${dataVenc.getFullYear()}`
      : '—';
    const subInfo = [
      dataStr,
      d.juros ? 'J: ' + fmtIA(jurosParc) : null,
      vencida ? `<span style="color:#dc2626;font-weight:700;">${diasAtraso}d em atraso</span>` : null,
    ].filter(Boolean).join(' · ');

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.625rem;">
        <span style="font-size:1rem;">${statusIcon}</span>
        <div>
          <div style="display:flex;align-items:center;gap:0.375rem;">
            <span style="font-size:0.8125rem;font-weight:700;color:${statusColor};">Parcela ${i + 1}</span>
            ${vencida ? '<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#dc2626;padding:0.125rem 0.375rem;border-radius:9999px;">VENCIDA</span>' : ''}
          </div>
          <div style="font-size:0.6875rem;font-weight:500;color:var(--text-sec);">${subInfo}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="font-size:0.875rem;font-weight:800;color:${vencida ? '#dc2626' : 'var(--card-text)'}">${fmtIA(pmt)}</span>
        ${paga
          ? `<button onclick="desmarcarParcela('${escapeHTML(d.id)}',${i})" style="font-size:0.75rem;padding:0.25rem 0.5rem;border:1.5px solid #fca5a5;border-radius:0.5rem;background:#fef2f2;color:#dc2626;cursor:pointer;font-family:inherit;font-weight:700;" title="Desmarcar">↩</button>`
          : `<button onclick="marcarParcelaPaga('${escapeHTML(d.id)}',${i})" style="font-size:0.75rem;padding:0.25rem 0.5rem;border:${vencida ? '1.5px solid #dc2626' : '1.5px solid #86efac'};border-radius:0.5rem;background:${vencida ? '#fef2f2' : '#f0fdf4'};color:${vencida ? '#dc2626' : '#16a34a'};cursor:pointer;font-family:inherit;font-weight:700;" title="Marcar paga">✓</button>`
        }
      </div>
    `;

    lista.appendChild(el);
  }
}

// Bug #8: marcar parcela paga — permite fora de ordem com confirmação
window.marcarParcelaPaga = async function(id, indice) {
  const d = dividas.find(x => x.id === id);
  if (!d) return;

  // Verificar se é fora de ordem
  if (indice !== (d.parcelasPagas || 0)) {
    const ok = await confirmarAcao(
      'Parcela fora de ordem',
      `Você está marcando a parcela #${indice + 1}, mas a #${(d.parcelasPagas || 0) + 1} ainda está pendente. Confirmar mesmo assim?`,
      'Confirmar mesmo assim',
      '#d97706'
    );
    if (!ok) return;
  }

  const novasParcelasPagas = Math.max((d.parcelasPagas || 0) + 1, indice + 1);
  const taxaMensal = (d.juros || 0) / 100;
  const n          = d.parcelas || 1;
  const pmt        = d.valorParcela || calcPMT(d.valorTotal || 0, taxaMensal, n);

  // Recalcular totais por Tabela Price
  let saldo = d.valorTotal || 0;
  let jurosPagosCalc = 0;
  for (let i = 0; i < novasParcelasPagas; i++) {
    const j = saldo * taxaMensal;
    jurosPagosCalc += j;
    saldo = Math.max(0, saldo - (pmt - j));
  }

  const novoValorPago = Math.min(d.valorTotal || 0, pmt * novasParcelasPagas);

  try {
    const batch = writeBatch(db);
    const dividaRef = doc(db, 'usuarios', currentUser.uid, 'dividas', id);

    // Criar transações para cada parcela recém-paga
    const novosIds = Object.assign({}, d.transacoesParcelas || {});
    const dataBase = d.vencimento ? new Date(d.vencimento + 'T12:00:00') : new Date();
    for (let i = (d.parcelasPagas || 0); i < novasParcelasPagas; i++) {
      if (novosIds[String(i)]) continue; // já tem txId (evitar duplicata)
      const dataParcela = addMonthsSafe(dataBase, i);
      const txRef = doc(collection(db, 'usuarios', currentUser.uid, 'transacoes'));
      const dataStr = dataParcela.getFullYear() + '-' + String(dataParcela.getMonth() + 1).padStart(2, '0') + '-' + String(dataParcela.getDate()).padStart(2, '0');
      const dataPagamento = new Date();
      batch.set(txRef, {
        tipo: 'despesa',
        descricao: 'Parcela ' + (i + 1) + '/' + (d.parcelas || 1) + ' — ' + (d.nome || 'Dívida'),
        valor: parseFloat(pmt.toFixed(2)),
        data: Timestamp.fromDate(dataPagamento),
        dataReferencia: dataStr,
        categoria: d.categoria || 'Dívidas',
        origem: 'divida_parcela',
        dividaId: id,
        parcelaIndice: i,
        status: 'ativa',
        dataCriacao: serverTimestamp(),
      });
      novosIds[String(i)] = txRef.id;
    }

    // PEND-037: registrar data real de pagamento por parcela
    const novasDatas = Object.assign({}, d.parcelasDatas || {});
    for (let i = (d.parcelasPagas || 0); i < novasParcelasPagas; i++) {
      if (!novasDatas[String(i)]) novasDatas[String(i)] = new Date().toISOString();
    }

    batch.update(dividaRef, {
      parcelasPagas: novasParcelasPagas,
      valorPago:     novoValorPago,
      jurosPagos:    jurosPagosCalc,
      atualizadoEm:  serverTimestamp(),
      transacoesParcelas: novosIds,
      parcelasDatas: novasDatas,
    });
    await batch.commit();
    // Bug #24: reabrir na aba parcelas
    setTimeout(() => window.abrirDetalhes(id, 'parcelas'), 300);
  } catch (err) {
    (window.budError||console.error)('[Dividas] marcarParcelaPaga:', err);
    window.budShowToast?.('Erro ao marcar parcela.', 'error');
  }
};

window.desmarcarParcela = async function(id, indice) {
  const d = dividas.find(x => x.id === id);
  if (!d) return;

  // Só permite desmarcar a última paga (para não deixar saldo inconsistente)
  if (indice !== (d.parcelasPagas || 0) - 1) {
    window.budShowToast?.('Só é possível desmarcar a última parcela paga.', 'warning');
    return;
  }

  const ok = await confirmarAcao(
    'Desmarcar parcela?',
    `A parcela #${indice + 1} voltará ao status pendente e os valores serão recalculados.`,
    'Desmarcar',
    '#dc2626'
  );
  if (!ok) return;

  const novasParcelasPagas = Math.max(0, (d.parcelasPagas || 0) - 1);
  const taxaMensal = (d.juros || 0) / 100;
  const n          = d.parcelas || 1;
  const pmt        = d.valorParcela || calcPMT(d.valorTotal || 0, taxaMensal, n);

  let saldo = d.valorTotal || 0;
  let jurosPagosCalc = 0;
  for (let i = 0; i < novasParcelasPagas; i++) {
    const j = saldo * taxaMensal;
    jurosPagosCalc += j;
    saldo = Math.max(0, saldo - (pmt - j));
  }

  const novoValorPago = Math.max(0, pmt * novasParcelasPagas);

  try {
    const batch = writeBatch(db);
    const dividaRef = doc(db, 'usuarios', currentUser.uid, 'dividas', id);

    // Deletar transação da parcela desmarcada (se existir)
    const novosIds = Object.assign({}, d.transacoesParcelas || {});
    const txId = novosIds[String(indice)];
    if (txId) {
      batch.delete(doc(db, 'usuarios', currentUser.uid, 'transacoes', txId));
      delete novosIds[String(indice)];
    }

    // PEND-037: remover data de pagamento da parcela desmarcada
    const novasDatasD = Object.assign({}, d.parcelasDatas || {});
    delete novasDatasD[String(indice)];

    batch.update(dividaRef, {
      parcelasPagas: novasParcelasPagas,
      valorPago:     novoValorPago,
      jurosPagos:    jurosPagosCalc,
      atualizadoEm:  serverTimestamp(),
      transacoesParcelas: novosIds,
      parcelasDatas: novasDatasD,
    });
    await batch.commit();
    setTimeout(() => window.abrirDetalhes(id, 'parcelas'), 300);
  } catch (err) {
    (window.budError||console.error)('[Dividas] desmarcarParcela:', err);
    window.budShowToast?.('Erro ao desmarcar parcela.', 'error');
  }
};

// ─────────────────────────────────────────────────────────────────
//  EXCLUIR
// ─────────────────────────────────────────────────────────────────
window.excluirDividaAtual = async function() {
  if (!dividaAtual) return;
  const ok = await confirmarAcao(
    'Excluir Dívida?',
    `A dívida "${dividaAtual.nome}" será removida permanentemente.`,
    'Excluir',
    '#dc2626'
  );
  if (!ok) return;

  try {
    await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'dividas', dividaAtual.id));
    fecharTodosModais();
    dividaAtual = null;
    window.budShowToast?.('Dívida excluída.', 'success');
  } catch (err) {
    (window.budError||console.error)('[Dividas] excluirDivida:', err);
    window.budShowToast?.('Erro ao excluir.', 'error');
  }
};

// ─────────────────────────────────────────────────────────────────
//  SIMULADOR
// ─────────────────────────────────────────────────────────────────
window.abrirSimulador = function() {
  if (!dividaAtual) return;
  fecharModal('modalDetalhes');
  trocarTabSimulador('extra');
  document.getElementById('simValorExtra').value = '';
  document.getElementById('resultadoExtra').style.display  = 'none';
  document.getElementById('resultadoExtra').innerHTML = '';
  document.getElementById('resultadoQuitar').innerHTML = '';
  calcularResultadoQuitar();
  abrirModal('modalSimulador');
};

window.trocarTabSimulador = function(tab) {
  document.querySelectorAll('#modalSimulador .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tabSim === tab);
  });
  document.getElementById('tabSimExtra').style.display  = tab === 'extra'  ? '' : 'none';
  document.getElementById('tabSimQuitar').style.display = tab === 'quitar' ? '' : 'none';
};

// Bug #5: simular com saldo devedor real (não valorTotal)
window.simularExtra = function() {
  if (!dividaAtual) return;
  const d       = dividaAtual;
  const extra   = parseMoeda(document.getElementById('simValorExtra').value);
  if (!extra || extra <= 0) { window.budShowToast?.('Informe o valor do pagamento extra.', 'warning'); return; }

  const saldoAtual  = calcularSaldoDevedor(d);  // Bug #5: saldo real
  const taxaMensal  = (d.juros || 0) / 100;
  const n           = d.parcelas || 1;
  const pmt         = d.valorParcela || calcPMT(d.valorTotal || 0, taxaMensal, n);

  // Parcelas restantes SEM pagamento extra
  const restantesAtual = Math.max(0, (d.parcelas || 0) - (d.parcelasPagas || 0));
  const totalSemExtra   = pmt * restantesAtual;

  // Novo saldo após pagamento extra
  const novoSaldo = Math.max(0, saldoAtual - extra);

  // Parcelas restantes COM pagamento extra (PMT igual)
  let parcNovas = 0;
  let s         = novoSaldo;
  while (s > 0 && parcNovas < 999) {
    const j = s * taxaMensal;
    s = Math.max(0, s - (pmt - j));
    parcNovas++;
  }

  const totalComExtra  = extra + (pmt * parcNovas);
  const economia       = Math.max(0, totalSemExtra - (pmt * parcNovas));
  const parcelasGanhas = restantesAtual - parcNovas;

  const el = document.getElementById('resultadoExtra');
  el.style.display = '';
  el.innerHTML = `
    <div style="background:var(--input-bg);border-radius:0.875rem;padding:1rem;border:1px solid var(--input-border);">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
        <div style="background:#f0fdf4;border-radius:0.75rem;padding:0.75rem;">
          <div style="font-size:0.6875rem;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.06em;">Economia em Juros</div>
          <div style="font-size:1.125rem;font-weight:800;color:#16a34a;margin-top:0.25rem;">${fmtIA(economia)}</div>
        </div>
        <div style="background:#eff6ff;border-radius:0.75rem;padding:0.75rem;">
          <div style="font-size:0.6875rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.06em;">Parcelas a Menos</div>
          <div style="font-size:1.125rem;font-weight:800;color:#2563eb;margin-top:0.25rem;">${Math.max(0, parcelasGanhas)}x</div>
        </div>
      </div>
      <div style="margin-top:0.75rem;font-size:0.75rem;font-weight:500;color:var(--text-sec);">
        Você passaria de ${restantesAtual} para ${parcNovas} parcelas restantes.
      </div>
    </div>
  `;
};

function calcularResultadoQuitar() {
  if (!dividaAtual) return;
  const d      = dividaAtual;
  const saldo  = calcularSaldoDevedor(d);  // Bug #5: saldo real
  const taxaMensal = (d.juros || 0) / 100;
  const n      = d.parcelas || 1;
  const pmt    = d.valorParcela || calcPMT(d.valorTotal || 0, taxaMensal, n);
  const restantes     = Math.max(0, (d.parcelas || 0) - (d.parcelasPagas || 0));
  const totalRestante = pmt * restantes;
  const economia      = Math.max(0, totalRestante - saldo);

  const el = document.getElementById('resultadoQuitar');
  if (!el) return;
  el.innerHTML = `
    <div style="background:var(--input-bg);border-radius:0.875rem;padding:1rem;border:1px solid var(--input-border);text-align:center;margin-bottom:1rem;">
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-sec);text-transform:uppercase;letter-spacing:.06em;">Para quitar hoje você paga</div>
      <div style="font-size:2rem;font-weight:800;color:#dc2626;margin:0.5rem 0;">${fmtIA(saldo)}</div>
      <div style="font-size:0.8125rem;font-weight:600;color:#16a34a;">Economia de ${fmtIA(economia)} em juros</div>
    </div>
    <div style="font-size:0.75rem;font-weight:500;color:var(--text-sec);text-align:center;">
      Comparado a pagar normalmente as ${restantes} parcelas restantes totalizando ${fmtIA(totalRestante)}.
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
//  RENDERIZAR LISTA
// ─────────────────────────────────────────────────────────────────
function renderizar() {
  // Bug #13: [...dividas].sort() — nunca mutar o array original
  const ativas = dividas.filter(d => calcularSaldoDevedor(d) > 0.01);

  // KPIs
  let totalSaldo  = 0;
  let totalPago   = 0;
  let totalJuros  = 0;
  dividas.forEach(d => {
    totalSaldo += calcularSaldoDevedor(d);
    totalPago  += (d.valorPago  || 0);
    totalJuros += (d.jurosPagos || 0);
  });

  // KPI: comprometimento mensal (soma das parcelas de dívidas ativas)
  let totalMensalidade = 0;
  ativas.forEach(d => { totalMensalidade += (d.valorParcela || 0); });

  // "Pague Primeiro" — Avalanche: maior juros; fallback Snowball: menor saldo
  let idPagarPrimeiro = null;
  if (ativas.length > 0) {
    const comJuros = ativas.filter(d => (d.juros || 0) > 0);
    if (comJuros.length > 0) {
      idPagarPrimeiro = comJuros.reduce((best, d) => (d.juros > best.juros ? d : best)).id;
    } else {
      idPagarPrimeiro = ativas.reduce((best, d) => (calcularSaldoDevedor(d) < calcularSaldoDevedor(best) ? d : best)).id;
    }
  }

  document.getElementById('kpiAtivas').textContent  = ativas.length;
  document.getElementById('kpiSaldo').textContent   = formatMoeda(totalSaldo);
  document.getElementById('kpiPago').textContent    = formatMoeda(totalPago);
  document.getElementById('kpiJuros').textContent   = formatMoeda(totalJuros);
  const elMens = document.getElementById('kpiMensalidade');
  if (elMens) elMens.textContent = formatMoeda(totalMensalidade);

  // Progresso geral
  const totalOriginal = dividas.reduce((s, d) => s + (d.valorTotal || 0), 0);
  const secProg = document.getElementById('secProgresso');
  if (totalOriginal > 0) {
    const pct = Math.min(100, Math.round((totalPago / totalOriginal) * 100));
    document.getElementById('progressoPct').textContent = pct + '%';
    document.getElementById('progressoBar').style.width = pct + '%';
    document.getElementById('progressoSub').textContent =
      formatMoeda(totalPago) + ' pagos de ' + formatMoeda(totalOriginal) + ' originais';

    // Previsão de quitação (última parcela entre todas as ativas)
    const elPrev = document.getElementById('progressoPrevisao');
    if (elPrev) {
      let dataFim = null;
      ativas.forEach(d => {
        if (!d.vencimento || !d.parcelas) return;
        const base = new Date(d.vencimento + 'T12:00:00');
        const ultimaParcela = addMonthsSafe(base, d.parcelas - 1);
        if (!dataFim || ultimaParcela > dataFim) dataFim = ultimaParcela;
      });
      if (dataFim) {
        const hoje = new Date();
        const mesesRestantes = Math.ceil((dataFim - hoje) / (1000 * 60 * 60 * 24 * 30.44));
        const strData = `${String(dataFim.getDate()).padStart(2,'0')}/${String(dataFim.getMonth()+1).padStart(2,'0')}/${dataFim.getFullYear()}`;
        elPrev.textContent = `🏁 Quitação prevista: ${strData} (${Math.max(0, mesesRestantes)}m)`;
        elPrev.style.display = '';
      } else {
        elPrev.style.display = 'none';
      }
    }

    if (secProg) secProg.style.display = '';
  } else if (secProg) {
    secProg.style.display = 'none';
  }

  // Alertas: dívidas com parcelas realmente atrasadas (próxima parcela não paga já venceu)
  const dividasEmAtraso = dividas
    .map(d => ({ d, atrasadas: calcularParcelasAtrasadas(d) }))
    .filter(({ atrasadas }) => atrasadas > 0);

  // Alertas: dívidas com juros abusivos (> 5% a.m.)
  const dividasJurosAbusivos = ativas.filter(d => (d.juros || 0) > 5);

  const secAlertas  = document.getElementById('secAlertas');
  const listaAlertas = document.getElementById('listaAlertas');
  const totalAlertas = dividasEmAtraso.length + dividasJurosAbusivos.length;
  if (totalAlertas > 0 && secAlertas && listaAlertas) {
    secAlertas.style.display = '';
    listaAlertas.innerHTML = '';
    dividasEmAtraso.forEach(({ d, atrasadas }) => {
      const dataBase = new Date(d.vencimento + 'T12:00:00');
      const dataAtrasada = addMonthsSafe(dataBase, d.parcelasPagas || 0);
      dataAtrasada.setHours(0, 0, 0, 0);
      const hojeAlerta = new Date(); hojeAlerta.setHours(0, 0, 0, 0);
      const diasAtraso = Math.round((hojeAlerta - dataAtrasada) / 86400000);
      const plural = atrasadas > 1 ? 's' : '';
      const parcelaLabel = `Parcela${plural} ${(d.parcelasPagas || 0) + 1}${atrasadas > 1 ? '–' + ((d.parcelasPagas || 0) + atrasadas) : ''}`;

      const el = document.createElement('div');
      el.style.cssText = 'background:var(--card-bg);border:1.5px solid rgba(220,38,38,0.35);border-left:4px solid #dc2626;border-radius:0.875rem;padding:0.875rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.625rem;min-width:0;">
          <span style="font-size:1.25rem;flex-shrink:0;">🔴</span>
          <div style="min-width:0;">
            <div style="font-size:0.875rem;font-weight:700;color:#dc2626;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(d.nome || '—')}</div>
            <div style="font-size:0.75rem;font-weight:600;color:#9f1239;">${parcelaLabel} · <strong>${atrasadas} em atraso</strong> · ${diasAtraso}d vencida${plural}</div>
          </div>
        </div>
        <button onclick="window.abrirDetalhes('${escapeHTML(d.id)}','parcelas')" style="flex-shrink:0;padding:0.375rem 0.75rem;border:none;border-radius:0.625rem;background:#dc2626;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Ver</button>
      `;
      listaAlertas.appendChild(el);
    });
    // Alertas de juros abusivos
    dividasJurosAbusivos.forEach(d => {
      const el = document.createElement('div');
      el.style.cssText = 'background:var(--card-bg);border:1.5px solid rgba(217,119,6,0.35);border-left:4px solid #ea580c;border-radius:0.875rem;padding:0.875rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.625rem;min-width:0;">
          <span style="font-size:1.25rem;flex-shrink:0;">🔥</span>
          <div style="min-width:0;">
            <div style="font-size:0.875rem;font-weight:700;color:#c2410c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(d.nome || '—')}</div>
            <div style="font-size:0.75rem;font-weight:600;color:#9a3412;">Juros abusivos: <strong>${(d.juros).toFixed(2)}% a.m.</strong> · Considere renegociar ou quitar primeiro</div>
          </div>
        </div>
        <button onclick="window.abrirDetalhes('${escapeHTML(d.id)}')" style="flex-shrink:0;padding:0.375rem 0.75rem;border:none;border-radius:0.625rem;background:#ea580c;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Ver</button>
      `;
      listaAlertas.appendChild(el);
    });
  } else if (secAlertas) {
    secAlertas.style.display = 'none';
  }

  // Lista de dívidas
  const lista = document.getElementById('listaDividas');
  if (!lista) return;

  if (dividas.length === 0) {
    lista.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:3rem 1rem;';
    empty.innerHTML = `
      <div style="font-size:3rem;margin-bottom:0.75rem;">💸</div>
      <div style="font-size:0.9375rem;font-weight:700;color:var(--card-text);">Nenhuma dívida cadastrada</div>
      <div style="font-size:0.8125rem;font-weight:500;color:var(--card-text-sec);margin-top:0.25rem;">Adicione seus empréstimos e financiamentos para monitorar o progresso.</div>
      <button onclick="window.iniciarNovaDivida()" style="margin-top:1.25rem;padding:0.625rem 1.25rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:0.875rem;font-weight:700;cursor:pointer;font-family:inherit;">+ Cadastrar Primeira Dívida</button>
    `;
    lista.appendChild(empty);
    return;
  }

  // ── Filtro ──────────────────────────────────────────────────
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  // Quitadas sempre ficam na seção separada
  const quitadasLista = dividas.filter(d => calcularSaldoDevedor(d) <= 0.01);
  let filtradas = dividas.filter(d => calcularSaldoDevedor(d) > 0.01);
  if (_filtroDivida === 'atraso') {
    filtradas = filtradas.filter(d => calcularParcelasAtrasadas(d) > 0);
  }
  // _filtroDivida === 'ativas' é equivalente ao default (já excluímos quitadas acima)

  // ── Ordenação ────────────────────────────────────────────────
  const ordem = document.getElementById('selectOrdemDiv')?.value || 'saldo';
  filtradas.sort((a, b) => {
    if (ordem === 'nome') {
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    if (ordem === 'juros') {
      return (b.juros || 0) - (a.juros || 0);
    }
    if (ordem === 'vencimento') {
      // ordenar por data da próxima parcela não paga
      const getProxVenc = d => {
        if (!d.vencimento) return Infinity;
        const base = new Date(d.vencimento + 'T12:00:00');
        return addMonthsSafe(base, d.parcelasPagas || 0).getTime();
      };
      return getProxVenc(a) - getProxVenc(b);
    }
    if (ordem === 'progresso') {
      // mais adiantadas primeiro (maior % pago)
      const pctA = a.valorTotal > 0 ? (1 - calcularSaldoDevedor(a) / a.valorTotal) : 0;
      const pctB = b.valorTotal > 0 ? (1 - calcularSaldoDevedor(b) / b.valorTotal) : 0;
      return pctB - pctA;
    }
    // default: saldo — maior saldo devedor primeiro
    return calcularSaldoDevedor(b) - calcularSaldoDevedor(a);
  });

  lista.innerHTML = '';

  if (filtradas.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:2rem 1rem;font-size:0.875rem;color:var(--card-text-sec);';
    empty.textContent = _filtroDivida === 'atraso'
      ? '✅ Nenhuma dívida em atraso. Tudo em dia!'
      : 'Nenhuma dívida nesta categoria.';
    lista.appendChild(empty);
    return;
  }

  filtradas.forEach((d, idx) => {
    const saldo   = calcularSaldoDevedor(d);
    const pct     = d.valorTotal > 0 ? Math.min(100, Math.round((1 - saldo / d.valorTotal) * 100)) : 0;
    const quitada = saldo <= 0.01;
    const atrasadas = calcularParcelasAtrasadas(d);

    // Badge "Pague Primeiro"
    const ehPrioridade = d.id === idPagarPrimeiro;
    const temJurosAltos = (d.juros || 0) > 5;

    // Próximo vencimento com countdown em dias
    let proximaVencStr = '';
    let proximaDiasStr = '';
    if (!quitada && d.vencimento && d.parcelas) {
      const base = new Date(d.vencimento + 'T12:00:00');
      const proxVenc = addMonthsSafe(base, d.parcelasPagas || 0);
      proximaVencStr = `${String(proxVenc.getDate()).padStart(2,'0')}/${String(proxVenc.getMonth()+1).padStart(2,'0')}`;
      const diffDias = Math.round((proxVenc - hoje) / 86400000);
      if (diffDias < 0)       proximaDiasStr = `${Math.abs(diffDias)}d atrás`;
      else if (diffDias === 0) proximaDiasStr = 'hoje';
      else if (diffDias === 1) proximaDiasStr = 'amanhã';
      else                     proximaDiasStr = `em ${diffDias}d`;
    }

    const barColor = atrasadas > 0
      ? 'linear-gradient(90deg,#dc2626,#b91c1c)'
      : quitada
        ? 'linear-gradient(90deg,#10b981,#059669)'
        : 'linear-gradient(90deg,#3b82f6,#2563eb)';

    const statusBadge = atrasadas > 0
      ? `<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#dc2626;padding:0.125rem 0.375rem;border-radius:9999px;margin-left:0.375rem;">${atrasadas} EM ATRASO</span>`
      : quitada
        ? `<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#16a34a;padding:0.125rem 0.375rem;border-radius:9999px;margin-left:0.375rem;">✅ QUITADA</span>`
        : '';

    const prioridadeBadge = ehPrioridade
      ? `<span style="font-size:0.625rem;font-weight:800;color:#fff;background:linear-gradient(135deg,#f59e0b,#d97706);padding:0.125rem 0.375rem;border-radius:9999px;margin-left:0.375rem;">🎯 PAGUE 1°</span>`
      : '';

    const jurosBadge = temJurosAltos
      ? `<span style="font-size:0.625rem;font-weight:800;color:#fff;background:#ea580c;padding:0.125rem 0.375rem;border-radius:9999px;margin-left:0.375rem;">🔥 ${(d.juros).toFixed(1)}%a.m.</span>`
      : '';

    const card = document.createElement('div');
    card.style.cssText = `background:var(--card-bg);border:1.5px solid ${atrasadas > 0 ? 'rgba(252,165,165,0.5)' : ehPrioridade ? 'rgba(245,158,11,0.4)' : 'var(--card-border)'};border-radius:1.125rem;padding:1rem 1.125rem;margin-bottom:0.625rem;cursor:pointer;transition:transform .15s,box-shadow .15s;animation:fadeInUp .3s ease both;animation-delay:${idx * 0.04}s;`;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.625rem;">
        <div style="display:flex;align-items:center;gap:0.625rem;min-width:0;flex:1;">
          <span style="font-size:1.5rem;flex-shrink:0;">${d.tipoIcone || '📄'}</span>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0.25rem;">
              <span style="font-size:0.9375rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(d.nome || '—')}</span>
              ${statusBadge}${prioridadeBadge}${jurosBadge}
            </div>
            <div style="font-size:0.75rem;font-weight:500;color:var(--card-text-sec);">${escapeHTML(d.instituicao || d.tipo || '—')}</div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:0.5rem;">
          <div style="font-size:1rem;font-weight:800;color:${atrasadas > 0 ? '#dc2626' : quitada ? '#16a34a' : 'var(--card-text)'};">${formatMoeda(saldo)}</div>
          <div style="font-size:0.6875rem;font-weight:600;color:var(--card-text-sec);">${quitada ? 'quitada' : 'a pagar'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
        <div style="flex:1;height:5px;background:var(--input-border);border-radius:999px;overflow:hidden;">
          <div style="height:100%;border-radius:999px;background:${barColor};width:${pct}%;transition:width .4s ease;"></div>
        </div>
        <span style="font-size:0.6875rem;font-weight:800;color:var(--card-text-sec);min-width:2.25rem;text-align:right;">${pct}%</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:0.6875rem;font-weight:500;color:var(--card-text-sec);">
          ${d.parcelasPagas || 0}/${d.parcelas || 0} pagas
          ${(function() {
            if (!quitada && d.vencimento && d.parcelas) {
              const baseQ = new Date(d.vencimento + 'T12:00:00');
              const dataQ = addMonthsSafe(baseQ, d.parcelas);
              return ` · 🏁 ${String(dataQ.getMonth()+1).padStart(2,'0')}/${dataQ.getFullYear()}`;
            }
            return '';
          })()}
          ${proximaVencStr ? ` · <span style="color:${atrasadas > 0 ? '#dc2626' : 'var(--card-text-sec)'};">📅 ${proximaVencStr} <strong style="color:${atrasadas > 0 ? '#dc2626' : (proximaDiasStr.includes('atrás') ? '#dc2626' : 'inherit')};">(${proximaDiasStr})</strong></span>` : ''}
          ${d.valorParcela ? ` · <span style="color:var(--card-text-sec);">${formatMoeda(d.valorParcela)}</span>` : ''}
        </div>
        <button data-edit="${escapeHTML(d.id)}" style="font-size:0.75rem;padding:0.25rem 0.5rem;border:1.5px solid var(--input-border);border-radius:0.5rem;background:var(--input-bg);color:var(--card-text-sec);cursor:pointer;font-family:inherit;" title="Editar">✏️</button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('[data-edit]')) {
        dividaAtual = d;
        abrirFormManual(d);
        e.stopPropagation();
        return;
      }
      window.abrirDetalhes(d.id);
    });

    card.addEventListener('mouseenter', () => {
      card.style.transform   = 'translateY(-2px)';
      card.style.boxShadow   = '0 8px 24px -5px rgba(0,0,0,0.1)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform   = '';
      card.style.boxShadow   = '';
    });

    lista.appendChild(card);
  });

  // ── Seção Quitadas ───────────────────────────────────────────
  const secQuit = document.getElementById('secQuitadas');
  const countQuit = document.getElementById('countQuitadas');
  const listaQuit = document.getElementById('listaQuitadas');
  if (secQuit) {
    if (quitadasLista.length > 0) {
      secQuit.style.display = '';
      if (countQuit) countQuit.textContent = quitadasLista.length;
      // Se a lista já estiver aberta, re-renderiza os cards
      if (listaQuit && listaQuit.style.display !== 'none') {
        listaQuit.innerHTML = '';
        quitadasLista.forEach((d, idx) => listaQuit.appendChild(_renderCardQuitada(d, idx)));
      }
    } else {
      secQuit.style.display = 'none';
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  CARD QUITADAS
// ─────────────────────────────────────────────────────────────────
function _renderCardQuitada(d, idx) {
  const card = document.createElement('div');
  card.style.cssText = `background:var(--card-bg);border:1.5px solid var(--card-border);border-radius:1.125rem;padding:0.875rem 1.125rem;margin-bottom:0.5rem;cursor:pointer;transition:transform .15s,box-shadow .15s;opacity:0.75;animation:fadeInUp .25s ease both;animation-delay:${idx * 0.03}s;`;
  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:0.625rem;min-width:0;flex:1;">
        <span style="font-size:1.25rem;flex-shrink:0;">${d.tipoIcone || '📄'}</span>
        <div style="min-width:0;">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0.25rem;">
            <span style="font-size:0.875rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(d.nome || '—')}</span>
            <span style="font-size:0.625rem;font-weight:800;color:#fff;background:#16a34a;padding:0.125rem 0.375rem;border-radius:9999px;">✅ QUITADA</span>
          </div>
          <div style="font-size:0.6875rem;font-weight:500;color:var(--card-text-sec);">${escapeHTML(d.instituicao || d.tipo || '—')} · ${d.parcelas || 0} parcelas</div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:0.5rem;">
        <div style="font-size:0.9375rem;font-weight:800;color:#16a34a;">${formatMoeda(d.valorTotal || 0)}</div>
        <div style="font-size:0.6875rem;font-weight:600;color:var(--card-text-sec);">valor original</div>
      </div>
    </div>
  `;
  card.addEventListener('click', () => window.abrirDetalhes(d.id));
  card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-1px)'; card.style.opacity = '1'; });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.opacity = '0.75'; });
  return card;
}

window.toggleQuitadas = function() {
  const listaQuit = document.getElementById('listaQuitadas');
  const icon = document.getElementById('iconToggleQuitadas');
  if (!listaQuit) return;
  const aberto = listaQuit.style.display !== 'none';
  if (aberto) {
    listaQuit.style.display = 'none';
    if (icon) icon.textContent = '▸ Expandir';
  } else {
    listaQuit.style.display = '';
    if (icon) icon.textContent = '▾ Recolher';
    // Preenche os cards diretamente sem re-renderizar tudo
    listaQuit.innerHTML = '';
    const quitadas = dividas.filter(d => calcularSaldoDevedor(d) <= 0.01);
    quitadas.forEach((d, idx) => listaQuit.appendChild(_renderCardQuitada(d, idx)));
  }
};

window.setFiltroDiv = function(btn) {
  _filtroDivida = btn.dataset.filtro;
  document.querySelectorAll('.filtro-divida').forEach(b => {
    const ativo = b === btn;
    b.style.background = ativo ? 'var(--btn-bg,#2563eb)' : 'var(--card-bg)';
    b.style.color       = ativo ? 'var(--btn-text)' : (b.dataset.filtro === 'atraso' ? '#dc2626' : 'var(--text-sec)');
    b.style.border      = ativo ? '1px solid transparent' : (b.dataset.filtro === 'atraso' ? '1px solid rgba(252,165,165,0.6)' : '1px solid var(--input-border)');
  });
  renderizar();
};

// ─────────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────────
function setupSidebar() {
  const sidebar        = document.getElementById('sidebar');
  const dashMain       = document.getElementById('dashMain');
  const btnCollapse    = document.getElementById('btnSidebarCollapse');
  const btnHamburger   = document.getElementById('btnHamburger');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  const collapsed = localStorage.getItem('bud_sidebar_collapsed') === 'true';
  if (collapsed) {
    sidebar?.classList.add('collapsed');
    dashMain?.classList.add('sidebar-collapsed');
    if (btnCollapse) btnCollapse.textContent = '›';
  }

  btnCollapse?.addEventListener('click', () => {
    const isCollapsed = sidebar?.classList.toggle('collapsed');
    dashMain?.classList.toggle('sidebar-collapsed', isCollapsed);
    if (btnCollapse) btnCollapse.textContent = isCollapsed ? '›' : '‹';
    localStorage.setItem('bud_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  });

  btnHamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('open');
  });
  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    // Bug #7: limpar listeners antes de redirecionar
    _unsubs.forEach(u => u && u());
    _unsubs = [];
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ─────────────────────────────────────────────────────────────────
//  AUTH & INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────
// ─── Migração: criar transações para parcelas já pagas sem txId ──
async function migrarTransacoesDividas(uid) {
  const KEY = 'bud_migr_div_tx_v1_' + uid;
  if (localStorage.getItem(KEY)) return;
  try {
    const snap = await getDocs(query(
      collection(db, 'usuarios', uid, 'dividas'),
      orderBy('criadoEm', 'desc'), limit(500)
    ));
    const CHUNK = 400;
    const opsPendentes = [];
    for (const docSnap of snap.docs) {
      const d  = { id: docSnap.id, ...docSnap.data() };
      const np = d.parcelasPagas || 0;
      if (np === 0) continue;
      const taxaMensal = (d.juros || 0) / 100;
      const n          = d.parcelas || 1;
      const pmt        = d.valorParcela || calcPMT(d.valorTotal || 0, taxaMensal, n);
      const ids        = Object.assign({}, d.transacoesParcelas || {});
      const dataBase   = d.vencimento ? new Date(d.vencimento + 'T12:00:00') : null;
      let criou = false;
      for (let i = 0; i < np; i++) {
        if (ids[String(i)]) continue; // já tem txId
        if (!dataBase) continue;
        const dataParcela = addMonthsSafe(dataBase, i);
        const dataStr = dataParcela.getFullYear() + '-' +
          String(dataParcela.getMonth() + 1).padStart(2, '0') + '-' +
          String(dataParcela.getDate()).padStart(2, '0');
        const txRef = doc(collection(db, 'usuarios', uid, 'transacoes'));
        opsPendentes.push({ type: 'setTx', ref: txRef, data: {
          tipo: 'despesa',
          descricao: 'Parcela ' + (i + 1) + '/' + (d.parcelas || 1) + ' \u2014 ' + (d.nome || 'D\u00edvida'),
          valor: parseFloat(pmt.toFixed(2)),
          data: Timestamp.fromDate(dataParcela),
          dataReferencia: dataStr,
          categoria: d.categoria || 'D\u00edvidas',
          origem: 'divida_parcela',
          dividaId: d.id,
          parcelaIndice: i,
          status: 'ativa',
          dataCriacao: serverTimestamp(),
        }});
        ids[String(i)] = txRef.id;
        criou = true;
      }
      if (criou) {
        opsPendentes.push({ type: 'updateDiv', ref: docSnap.ref, data: { transacoesParcelas: ids } });
      }
    }
    // Processar em chunks de até 400 ops
    for (let ci = 0; ci < opsPendentes.length; ci += CHUNK) {
      const chunk = opsPendentes.slice(ci, ci + CHUNK);
      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'setTx') batch.set(op.ref, op.data);
        else batch.update(op.ref, op.data);
      }
      await batch.commit();
    }
    localStorage.setItem(KEY, '1');
  } catch (err) {
    (window.budError||console.error)('[Dividas] migrarTransacoesDividas:', err);
  }
}

onAuthStateChanged(auth, async (user) => {
  // Bug #7: limpar unsubs em toda troca de estado de autenticação
  _unsubs.forEach(u => u && u());
  _unsubs = [];

  if (!user || !user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }

  try { await user.getIdToken(); } catch (_) { /* ignora */ } // usa cache; Firebase renova quando expirado

  currentUser = user;

  // Migração: criar transações para parcelas já pagas (roda 1x por conta)
  migrarTransacoesDividas(user.uid);
  let userData = {};
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    userData = snap.exists() ? snap.data() : {};
  } catch (err) {
    (window.budError||console.error)('[Dividas] userData:', err);
  }

  // Atualizar sidebar
  const nome      = escapeHTML(userData.nome || user.displayName || 'Usuário');
  const matricula = escapeHTML(userData.matricula || '---');
  const iniciais  = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const elAvatar  = document.getElementById('sidebarAvatar');
  const elNome    = document.getElementById('sidebarUserName');
  const elId      = document.getElementById('sidebarUserId');
  if (elAvatar) elAvatar.textContent = iniciais;
  if (elNome)   elNome.textContent   = nome;
  if (elId)     elId.textContent     = matricula;

  // Bug #22: orderBy('criadoEm', 'desc') na query
  // Bug #2: error callback obrigatório no onSnapshot
  const qDividas = query(
    collection(db, 'usuarios', user.uid, 'dividas'),
    orderBy('criadoEm', 'desc'),
    limit(500)
  );

  const unsubDividas = onSnapshot(qDividas, snap => {
    dividas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizar();

    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('hide')) {
      splash.classList.add('hide');
      setTimeout(() => { if (splash) splash.style.display = 'none'; }, 500);
    }
  }, err => {
    // Bug #2: error callback implementado
    (window.budError||console.error)('[Dividas] snapshot:', err);
    window.budShowToast?.('Erro ao carregar dívidas.', 'error');
  });

  _unsubs.push(unsubDividas);
});

// ─── keyframe fadeInUp ────────────────────────────────────────────
(function injectKeyframes() {
  if (document.getElementById('div-keyframes')) return;
  const st = document.createElement('style');
  st.id = 'div-keyframes';
  st.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}';
  document.head.appendChild(st);
})();

// ─── DOMContentLoaded — bind de eventos ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();

  // Bug #21: ocultar aba câmera em desktop desde o início
  const isMovel = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const btnCamera = document.getElementById('iaTabCamera');
  if (btnCamera && !isMovel) btnCamera.style.display = 'none';

  // Botão Nova Dívida
  document.getElementById('btnNovaDivida')?.addEventListener('click', window.iniciarNovaDivida);

  // Fechar modais (overlay click)
  MODAL_IDS.forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) fecharModal(id);
    });
  });

  // ESC fecha todos
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharTodosModais(); });

  // Salvar dívida (formulário manual)
  document.getElementById('btnSalvarDivida')?.addEventListener('click', salvarDivida);

  // Máscaras monetárias
  ['dividaValorTotal','dividaValorPago','dividaValorParcela','simValorExtra'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', function() { aplicarMascaraMoeda(this); });
  });

  // Máscara de data DD/MM/AAAA (DEC-018)
  document.getElementById('dividaVencimento')?.addEventListener('input', function() {
    aplicarMascaraData(this);
  });

  // Expor globais necessários para onclick inline no HTML
  window.fecharTodosModais = fecharTodosModais;
  window.fecharModal       = fecharModal;

  // ── Custom Select: ordenação da lista ──
  const ordemBtn      = document.getElementById('ordemDivBtn');
  const ordemDropdown = document.getElementById('ordemDivDropdown');
  const ordemHidden   = document.getElementById('selectOrdemDiv');
  const ordemTexto    = document.getElementById('ordemDivTexto');
  if (ordemBtn && ordemDropdown) {
    ordemBtn.addEventListener('click', e => {
      e.stopPropagation();
      const aberto = ordemDropdown.classList.contains('open');
      ordemDropdown.classList.toggle('open', !aberto);
      ordemBtn.classList.toggle('open', !aberto);
      ordemBtn.setAttribute('aria-expanded', String(!aberto));
      // Smart positioning: abre pra cima se não couber abaixo
      if (!aberto) {
        const rect = ordemDropdown.parentElement.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        ordemDropdown.classList.toggle('open-up', spaceBelow < 180);
      }
    });
    ordemDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const val = opt.dataset.value;
        if (ordemHidden) ordemHidden.value = val;
        if (ordemTexto) ordemTexto.textContent = opt.textContent;
        ordemDropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o === opt));
        ordemDropdown.classList.remove('open');
        ordemBtn.classList.remove('open');
        ordemBtn.setAttribute('aria-expanded', 'false');
        renderizar();
      });
    });
    document.addEventListener('click', e => {
      if (!ordemBtn.contains(e.target)) {
        ordemDropdown.classList.remove('open');
        ordemBtn.classList.remove('open');
        ordemBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
});
