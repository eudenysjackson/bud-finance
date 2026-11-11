// ─────────────────────────────────────────────────────────────────
//  Bud Finance — js/dividas.js   (ES Module, Firebase 10.8.1)
//  Todos os 25 bugs do cérebro/dividas.md corrigidos desde o início.
// ─────────────────────────────────────────────────────────────────
import { initializeApp, getApps }          from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { connectEmulators } from './bud-emulator-connect.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, increment, runTransaction,
} from './financial-firestore.js';

// ─── Firebase init ───────────────────────────────────────────────
const app = getApps().length ? getApps()[0] : initializeApp(window.BUD_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache() }); } catch(e) { return getFirestore(app); } })();
connectEmulators(auth, db);

// ─── Estado global ───────────────────────────────────────────────
let currentUser        = null;
let dividas            = [];
let dividaAtual        = null;   // usada por editar/excluir/simulador
let wizardTipo         = '';
let wizardTipoIcone    = '';
let wizardFormato      = '';
let contratoExtraido   = null;
let contratoBlocos = [];
let contratoFingerprint = '';
let salvandoBlocos = false;
let contratoMensagem = '';
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
  const raw = String(s).replace(/R\$|\s/g, '');
  const normalizado = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalizado);
  return isNaN(n) ? 0 : n;
}

function aplicarMascaraMoeda(input) {
  const num = parseMoeda(input.value);
  if (!Number.isFinite(num)) return;
  input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function dividaQuitada(d) {
  return Number(d.parcelas) > 0 && Number(d.parcelasPagas || 0) >= Number(d.parcelas);
}

function progressoParcelas(d) {
  const total = Number(d.parcelas);
  if (!(total > 0)) return 0;
  if (dividaQuitada(d)) return 100;
  return Math.max(0, Math.min(99, Math.round(100 * (Number(d.parcelasPagas) || 0) / total)));
}

// Saldo do principal pela Tabela Price, com suporte a cadastros legados.
function calcularSaldoDevedor(d) {
  if (!d || dividaQuitada(d)) return 0;
  const taxaMensal  = (d.juros || 0) / 100;
  const n           = d.parcelas || 1;
  const valorParcela = d.valorParcela ||
    (taxaMensal > 0
      ? (d.valorTotal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -n))
      : d.valorTotal / n);

  let saldo = Number(d.valorTotal) || 0;
  for (let i = 0; i < (d.parcelasPagas || 0); i++) {
    const j = saldo * taxaMensal;
    saldo = Math.max(0, saldo - (valorParcela - j));
  }
  // Um total cadastrado menor que as parcelas pode zerar o principal antes da última cobrança.
  const restantes = Math.max(0, Number(d.parcelas || 0) - Number(d.parcelasPagas || 0));
  if (saldo <= 0.01 && restantes > 0) return Math.round(restantes * valorParcela * 100) / 100;
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
  if (salvandoBlocos) { window.budShowToast?.('Aguarde a confirmação do cadastro em andamento.', 'info'); return; }
  if (contratoMensagem && contratoBlocos.some(b => b.selecionado && !b.salvo)) { window._retomarPendenciasContrato(); return; }
  wizardTipo       = '';
  wizardTipoIcone  = '';
  wizardFormato    = '';
  dadosIA          = null;
  contratoExtraido = null;
  contratoBlocos = [];
  contratoFingerprint = '';
  contratoMensagem = '';
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
  if (salvandoBlocos) { window.budShowToast?.('Aguarde a confirmação do cadastro em andamento.', 'info'); return; }
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
    let layoutPdf;
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
      const paginasComColunas = [];
      let pdfOcrWorker;
      try {
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          paginasComColunas.push(window.BudContractReader?.rowsFromPdfItems(content.items) || '');
          let pageText = content.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('');
          if (!pageText.trim()) {
            if (!window.Tesseract) throw new Error('O leitor de imagens não carregou. Recarregue a página.');
            pdfOcrWorker = pdfOcrWorker || await window.Tesseract.createWorker('por', 1);
            const viewport = page.getViewport({ scale: 1.7 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const result = await pdfOcrWorker.recognize(canvas);
            pageText = result.data.text;
            canvas.width = canvas.height = 0;
            if (!pageText.trim()) throw new Error(`Não foi possível ler a página ${p}. Envie uma cópia mais legível.`);
          }
          paginas.push(pageText);
          page.cleanup();
        }
        texto = paginas.join('\n');
        layoutPdf = paginasComColunas.join('\n');
      } finally {
        if (pdfOcrWorker) await pdfOcrWorker.terminate();
        await pdfDoc.destroy();
      }
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

    await processarTextoExtraido(texto, layoutPdf);
  } catch (err) {
    (window.budError||console.error)('[Dividas] processarArquivoIA:', err);
    mostrarErroIA(err.message || 'Erro ao processar o arquivo.');
    document.getElementById('iaProcessando').style.display = 'none';
  }
};

window.processarTextoIA = async function() {
  if (salvandoBlocos) { window.budShowToast?.('Aguarde a confirmação do cadastro em andamento.', 'info'); return; }
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

async function processarTextoExtraido(texto, layoutPdf) {
  animarStepsIA(2);
  await new Promise(r => setTimeout(r, 200)); // deixa a UI atualizar

  const classif = classificarContrato(texto);
  if (!window.BudContractReader) throw new Error('O leitor de contratos não carregou. Recarregue a página.');
  contratoExtraido = window.BudContractReader.read(texto, layoutPdf);
  contratoBlocos = [];
  contratoFingerprint = '';
  contratoMensagem = '';
  atualizarAvisoPendenciasContrato();
  if (contratoExtraido?.components?.length) {
    contratoFingerprint = await window.BudContractReader.fingerprint(texto);
    contratoBlocos = contratoExtraido.components.map(b => ({...b, dados:{...b.dados, parcelasPagas:0}, selecionado:contratoExtraido.tipo === 'Consórcio', salvo:false, edicoes:{}, totalDerivado: b.totalDerivado || b.dados.valorTotal === Math.round(b.dados.valorParcela*b.dados.parcelas*100)/100}));
  }
  const dados = contratoExtraido ? { ...contratoExtraido.dados } : extrairDadosDoTexto(texto.replace(/[ \t]+/g, ' '));
  if (contratoExtraido) {
    classif.tipo = contratoExtraido.tipo;
    wizardTipo = contratoExtraido.tipo;
  }
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

  if (contratoBlocos.length) { renderBlocosContrato(); return; }
  dadosIA = dados;
  const faltantes = window.BudContractReader.missing(dados);
  const avisos = [...(contratoExtraido?.avisos || [])];
  if (faltantes.length) avisos.push('Complete antes de salvar: ' + faltantes.join(', ') + '.');
  const podeSalvar = faltantes.length === 0;
  const rows = [];
  if (dados.valorTotal)    rows.push([contratoExtraido?.tipo === 'Aluguel' ? 'Total base dos aluguéis' : contratoExtraido ? 'Total nominal do bloco' : 'Valor Total Financiado', fmtIA(dados.valorTotal)]);
  if (dados.valorParcela)  rows.push(['Parcela Mensal', fmtIA(dados.valorParcela)]);
  if (dados.parcelas)      rows.push(['Total de Parcelas', dados.parcelas + 'x']);
  if (dados.juros)         rows.push(['Juros Mensal', dados.juros.toFixed(2) + '% a.m.']);
  if (dados.cet)           rows.push(['CET (anual)', dados.cet.toFixed(2) + '% a.a.']);
  if (dados.cetMensal)     rows.push(['CET (mensal)', dados.cetMensal.toFixed(2) + '% a.m.']);
  if (dados.iof)           rows.push(['IOF', fmtIA(dados.iof)]);
  if (dados.seguro)        rows.push(['Seguro', fmtIA(dados.seguro)]);
  if (dados.instituicao)   rows.push(['Instituição', dados.instituicao]);
  if (dados.vencimento)    rows.push(['1ª Parcela', formatDataBR(dados.vencimento)]);
  if (dados.inicioContrato) rows.push(['Início da locação (não é vencimento)', formatDataBR(dados.inicioContrato)]);

  const confiancaCor = classif.confianca >= 70 ? '#16a34a' : classif.confianca >= 40 ? '#d97706' : '#dc2626';
  const parcInit = dados.parcelasPagas ?? 0;
  const totalParc = dados.parcelas ? `de ${dados.parcelas}x` : '';

  el.style.display = '';
  el.innerHTML = `
    <div style="background:var(--input-bg);border-radius:0.875rem;padding:1rem;border:1px solid var(--input-border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
        <span style="font-size:0.875rem;font-weight:800;color:var(--text-main);">📋 Dados Extraídos</span>
        <span style="font-size:0.75rem;font-weight:700;color:${confiancaCor};">${4 - faltantes.length} de 4 campos essenciais identificados</span>
      </div>
      ${avisos.map(a => '<p style="font-size:0.8125rem;color:#b45309;line-height:1.5;">⚠️ ' + escapeHTML(a) + '</p>').join('')}
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
        <label style="font-size:0.75rem;font-weight:800;color:var(--bud-primary,#2563eb);display:block;margin-bottom:0.375rem;">📆 PARCELAS JÁ PAGAS</label>
        <div style="display:flex;align-items:center;gap:0.625rem;">
          <input id="iaParcelasPagas" type="number" min="0" max="${dados.parcelas || 9999}" value="${parcInit}"
            style="width:72px;padding:0.375rem 0.5rem;border:1.5px solid var(--input-border);border-radius:0.5rem;background:var(--input-bg);color:var(--text-main);font-size:1rem;font-weight:800;text-align:center;font-family:inherit;"
            oninput="window._syncParcelasPagasIA(this.value)">
          <span style="font-size:0.8125rem;color:var(--text-sec);font-weight:600;">${totalParc} — informe 0 se nenhuma foi paga ainda</span>
        </div>
      </div>
      <button id="btnSalvarIA" ${podeSalvar ? '' : 'disabled'} onclick="salvarDividaIA()" style="margin-top:0.875rem;width:100%;padding:0.625rem;border:none;border-radius:0.75rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:0.875rem;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s;">
        💾 Salvar Dívida
      </button>
      <button onclick="abrirFormManual(null, true)" style="margin-top:0.5rem;width:100%;padding:0.5rem;border:1.5px solid var(--input-border);border-radius:0.75rem;background:var(--input-bg);color:var(--text-sec);font-size:0.8125rem;font-weight:700;cursor:pointer;font-family:inherit;">
        ✏️ Editar antes de salvar
      </button>
    </div>
  `;
}

function renderHistoricoConsorcio() {
  const rows = contratoExtraido?.historicoConsorcio;
  if (!rows?.length) return '';
  const total = rows.reduce((sum, row) => sum + Math.round(row.valor * 100), 0) / 100;
  return '<details style="margin:.75rem 0"><summary>Pagamentos de parcelas no extrato · ' + fmtIA(total) + '</summary><ul>' + rows.map(row => '<li>Assembleia ' + row.assembleia + ' · ' + formatDataBR(row.data) + ' · ' + fmtIA(row.valor) + '</li>').join('') + '</ul></details>';
}

function renderBlocosContrato() {
  const el = document.getElementById('iaResultado');
  if (!el) return;
  el.style.display = '';
  const fields = [ ['nomeCliente','Nome / credor','text'], ['instituicao','Instituição','text'], ['valorTotal','Valor total / base do bloco','text'], ['parcelas','Total de parcelas','number'], ['valorParcela','Valor da parcela','text'], ['vencimento','Data da primeira parcela','text'], ['parcelasPagas','Parcelas já pagas','number'] ];
  const moneyFields = ['valorTotal','valorParcela'];
  el.innerHTML = `<div style="background:var(--input-bg);padding:1rem;border-radius:0.875rem;">
    <strong>Obrigações identificadas — selecione uma ou várias</strong>
    <p style="font-size:0.8125rem;line-height:1.5;">Cada obrigação será cadastrada como uma dívida separada. Complete os campos de cada uma abaixo. As pendentes permanecem nesta revisão. Complete-as antes de trocar de documento, iniciar nova dívida ou atualizar a página. Os valores são base contratual: confira reajustes e encargos nos avisos de cada obrigação.</p>
    ${(contratoExtraido?.avisos || []).map(a=>`<p style="font-size:0.8125rem;color:#b45309;">${escapeHTML(a)}</p>`).join('')}
${renderHistoricoConsorcio()}
    <div class="contrato-actions">
      <button type="button" class="contrato-action contrato-action-select" ${salvandoBlocos?'disabled':''} onclick="window._contratoMarcar('todas')">Marcar todas</button>
      <button type="button" class="contrato-action" ${salvandoBlocos?'disabled':''} onclick="window._contratoMarcar('completas')">Só completas</button>
      <button type="button" class="contrato-action" ${salvandoBlocos?'disabled':''} onclick="window._contratoMarcar('nenhuma')">Desmarcar todas</button>
    </div>
    ${contratoBlocos.map((b,i)=>{
      const disabled = b.salvo || salvandoBlocos;
      const inputs = fields.map(([key,label,type])=>{
        const original = b.dados[key];
        const value = Object.prototype.hasOwnProperty.call(b.edicoes,key) ? b.edicoes[key]
          : key === 'vencimento' ? (original ? formatDataBR(original) : '')
          : moneyFields.includes(key) ? (Number.isFinite(original) ? Number(original).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '') : (original ?? '');
        return `<label style="display:block;margin-top:0.5rem;font-size:0.75rem;">${key==='vencimento'?'📅 ':''}${escapeHTML(label)}
          <input id="contrato_${i}_${key}" aria-label="${escapeHTML(label + ' — ' + b.label)}" type="${type}" ${type==='number'?'min="0" step="1"':''} ${key==='vencimento'?'placeholder="DD/MM/AAAA" inputmode="numeric"':''} ${moneyFields.includes(key)?'inputmode="decimal"':''} maxlength="${key==='vencimento'?10:150}" value="${escapeHTML(value)}" ${disabled?'disabled':''} class="modal-input" oninput="window._contratoEditarCampo(${i}, '${key}', this.value)">
        </label>`;
      }).join('');
      return `<div style="padding:0.75rem;border:1px solid var(--input-border);border-radius:0.625rem;margin-bottom:0.625rem;background:var(--card-bg);">
        <label style="display:flex;gap:0.5rem;align-items:center;font-weight:700;font-size:0.8125rem;"><input id="contratoSelecionar_${i}" type="checkbox" aria-label="Selecionar ${escapeHTML(b.label)}" ${b.selecionado?'checked':''} ${disabled?'disabled':''} onchange="window._contratoSelecionar(${i}, this.checked)">${escapeHTML(b.label)}</label>
        <div id="contratoStatus_${i}" style="font-size:0.75rem;margin-top:0.375rem;" aria-live="polite"></div>
        <details ${b.selecionado&&!b.salvo&&window.BudContractReader.pending(b.dados).length?'open':''}><summary class="contrato-review-toggle">Revisar / completar dados</summary>
          ${b.aviso?`<p style="color:#b45309;font-size:0.75rem;line-height:1.5;">${escapeHTML(b.aviso)}</p>`:''}${inputs}
        </details>
      </div>`;
    }).join('')}
    <p id="contratoResumoSelecao" role="status" style="font-size:0.8125rem;font-weight:700;"></p>
    <p role="status" style="font-size:0.8125rem;color:#15803d;">${escapeHTML(contratoMensagem)}</p>
    <button id="btnSalvarBlocosContrato" type="button" class="wizard-btn-next" onclick="window._salvarBlocosContrato()">Cadastrar completas</button>
  </div>`;
  atualizarResumoBlocosContrato();
}

function atualizarResumoBlocosContrato() {
  const plan = window.BudContractReader.plan(contratoBlocos);
  contratoBlocos.forEach((b,i)=>{
    const el = document.getElementById('contratoStatus_'+i);
    if (!el) return;
    const fields = window.BudContractReader.pending(b.dados);
    el.textContent = b.salvo ? 'Já cadastrada — não será duplicada.' : fields.length ? 'Pendente: '+fields.join(', ')+'.' : 'Completa — ' + b.dados.parcelas + 'x de ' + fmtIA(b.dados.valorParcela) + ', a partir de ' + formatDataBR(b.dados.vencimento) + '.';
    el.style.color = b.salvo || !fields.length ? '#15803d' : '#b45309';
  });
  const summary = document.getElementById('contratoResumoSelecao');
  if (summary) summary.textContent = `${plan.ready.length} selecionada(s) completa(s) · ${plan.incomplete.length} selecionada(s) pendente(s). ${plan.incomplete.length?'Só as completas serão cadastradas; as pendentes permanecem nesta revisão.':''}`;
  const button = document.getElementById('btnSalvarBlocosContrato');
  if (button) { button.disabled = salvandoBlocos || !plan.ready.length; button.textContent = salvandoBlocos ? 'Cadastrando…' : `Cadastrar ${plan.ready.length} obrigação(ões) completa(s)`; }
}

window._contratoSelecionar = function(index, selected) {
  const item = contratoBlocos[index];
  if (!item || item.salvo || salvandoBlocos) return;
  item.selecionado = !!selected;
  renderBlocosContrato();
};
window._contratoMarcar = function(mode) {
  if (salvandoBlocos) return;
  contratoBlocos.forEach(b=>{if(!b.salvo)b.selecionado = mode==='todas' || (mode==='completas' && !window.BudContractReader.pending(b.dados).length);});
  renderBlocosContrato();
};
window._contratoEditarCampo = function(index, key, value) {
  const b = contratoBlocos[index];
  if (!b || b.salvo || salvandoBlocos || !['nomeCliente','instituicao','valorTotal','parcelas','valorParcela','vencimento','parcelasPagas'].includes(key)) return;
  if (key === 'vencimento') {
    const masked = {value:String(value)};
    aplicarMascaraData(masked);
    value = masked.value;
    const input = document.getElementById('contrato_' + index + '_vencimento');
    if (input && input.value !== value) input.value = value;
  }
  b.edicoes[key] = value;
  if (key==='valorTotal' || key==='valorParcela') b.dados[key] = parseMoeda(value);
  else if (key==='parcelas' || key==='parcelasPagas') b.dados[key] = value==='' ? null : Number(value);
  else if (key==='vencimento') b.dados[key] = parseDataBR(value);
  else b.dados[key] = String(value).slice(0,150);
  if (key==='valorTotal') b.totalDerivado = false;
  if (b.totalDerivado && ['parcelas','valorParcela'].includes(key)) {
    b.dados.valorTotal = Math.round((b.dados.parcelas||0)*(b.dados.valorParcela||0)*100)/100;
    delete b.edicoes.valorTotal;
    const total = document.getElementById(`contrato_${index}_valorTotal`);
    if (total) total.value = b.dados.valorTotal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  atualizarResumoBlocosContrato();
};

window._salvarBlocosContrato = async function() {
  if (salvandoBlocos || !currentUser || !/^[a-f0-9]{64}$/.test(contratoFingerprint)) return;
  const plan = window.BudContractReader.plan(contratoBlocos);
  if (!plan.ready.length) { atualizarResumoBlocosContrato(); return; }
  salvandoBlocos = true;
  renderBlocosContrato();
  try {
    const entries = plan.ready.map(({index,dados:d})=>({index,ref:doc(db,'usuarios',currentUser.uid,'dividas',`contrato_${contratoFingerprint}_${index}`),data:{
      nome:escapeHTML(d.nomeCliente || contratoBlocos[index].label),tipoIcone:wizardTipoIcone || '📄',tipo:d.tipo || wizardTipo || 'Outro',instituicao:escapeHTML(d.instituicao||''),formato:'ia',
      valorTotal:d.valorTotal,valorParcela:d.valorParcela,parcelas:d.parcelas,parcelasPagas:d.parcelasPagas||0,valorPago:Math.round((d.parcelasPagas||0)*d.valorParcela*100)/100,
      jurosPagos:0,juros:d.juros||0,cet:d.cet||0,iof:d.iof||0,seguro:d.seguro||0,vencimento:d.vencimento,importadoPorIA:true,
      importacaoContrato:contratoFingerprint,blocoContrato:index,observacoesImportacao:contratoBlocos[index].aviso||'',criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()
    }}));
    // Read before writing: retries and a repeated upload never overwrite an existing block.
    const created = await runTransaction(db, async transaction=>{
      const snapshots = await Promise.all(entries.map(e=>transaction.get(e.ref)));
      let count=0;
      entries.forEach((entry,i)=>{if(!snapshots[i].exists()){transaction.set(entry.ref,entry.data);count++;}});
      return count;
    });
    entries.forEach(e=>{contratoBlocos[e.index].salvo=true;contratoBlocos[e.index].selecionado=false;});
    contratoMensagem = `${created} obrigação(ões) cadastrada(s). ${entries.length-created} já existia(m) e não foi/foram alterada(s). ${plan.incomplete.length?'Complete as pendentes abaixo; seus campos foram preservados.':'Você pode selecionar outras obrigações ou fechar esta revisão.'}`;
    fecharTodosModais();
    atualizarAvisoPendenciasContrato();
    window.budShowToast?.('Cadastro concluído.' + (plan.incomplete.length ? ' Há pendências disponíveis para revisão na tela de Dívidas.' : ''), 'success');
  } catch(err) {
    (window.budError||console.error)('[Dividas] cadastro conjunto:',err);
    contratoMensagem = '';
    window.budShowToast?.('Não foi possível confirmar o cadastro. Os dados foram preservados; tente novamente para conferir sem duplicar.', 'error');
  } finally {
    salvandoBlocos = false;
    renderBlocosContrato();
  }
};

function atualizarAvisoPendenciasContrato() {
  const remaining = contratoMensagem ? contratoBlocos.filter(b => b.selecionado && !b.salvo).length : 0;
  let notice = document.getElementById('avisoPendenciasContrato');
  if (!remaining) { if (notice) notice.style.display = 'none'; return; }
  if (!notice) {
    const list = document.getElementById('listaDividas');
    if (!list?.parentNode) return;
    notice = document.createElement('div');
    notice.id = 'avisoPendenciasContrato';
    list.parentNode.insertBefore(notice,list);
  }
  notice.style.cssText = 'display:block;padding:1rem;margin:0.75rem 0;border:1.5px solid var(--input-border);border-radius:0.875rem;background:var(--card-bg);color:var(--text-main);';
  notice.innerHTML = `<strong>${remaining} obrigação(ões) pendente(s) de revisão</strong><p style="font-size:0.8125rem;line-height:1.5;">As completas foram confirmadas. Você pode retomar as pendentes abaixo antes de recarregar ou sair desta página. Descartar o rascunho não exclui dívidas cadastradas.</p><div class="contrato-actions"><button class="contrato-action contrato-action-select" type="button" onclick="window._retomarPendenciasContrato()">Revisar pendentes</button><button class="contrato-action" type="button" onclick="window._descartarPendenciasContrato()">Descartar rascunho</button></div>`;
}
window._retomarPendenciasContrato = function() {
  if (salvandoBlocos || !contratoBlocos.length) return;
  fecharTodosModais();
  abrirModal('modalImportIA');
  document.getElementById('iaProcessando').style.display = 'none';
  renderBlocosContrato();
};
window._descartarPendenciasContrato = function() {
  if (salvandoBlocos) return;
  contratoBlocos = [];
  contratoFingerprint = '';
  contratoExtraido = null;
  contratoMensagem = '';
  dadosIA = null;
  atualizarAvisoPendenciasContrato();
};

// Sincroniza o input de parcelas pagas na IA com dadosIA
window._syncParcelasPagasIA = function(val) {
  if (!dadosIA) return;
  const n = Math.max(0, parseInt(val, 10) || 0);
  dadosIA.parcelasPagas = n;
  if (dadosIA.valorParcela) dadosIA.valorPago = n * dadosIA.valorParcela;
};

// Bug #17: try/catch + botão desabilitado durante save
window.salvarDividaIA = async function() {
  if (contratoBlocos.length) return window._salvarBlocosContrato();
  if (!dadosIA) return;
  const faltantes = window.BudContractReader.missing(dadosIA);
  if (faltantes.length) {
    window.budShowToast?.('Revise o bloco escolhido e complete: ' + faltantes.join(', '), 'warning');
    return;
  }

  // Ler parcelas pagas do input antes de salvar
  const inputPP = document.getElementById('iaParcelasPagas');
  if (inputPP) {
    const pp = Math.max(0, parseInt(inputPP.value, 10) || 0);
    dadosIA.parcelasPagas = pp;
    if (dadosIA.valorParcela) dadosIA.valorPago = pp * dadosIA.valorParcela;
  }

  if (!Number.isInteger(dadosIA.parcelasPagas) || dadosIA.parcelasPagas < 0 || dadosIA.parcelasPagas > dadosIA.parcelas) {
    window.budShowToast?.('O número de parcelas pagas deve estar entre zero e o total do bloco.', 'warning');
    return;
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

  // Valores monetários (máscara BRL)
  const setMoeda = (id, v) => {
    if (!v) { document.getElementById(id).value = ''; return; }
    const cents  = Math.round(v * 100);
    const reais  = Math.floor(cents / 100);
    const cStr   = String(cents % 100).padStart(2, '0');
    document.getElementById(id).value = reais.toLocaleString('pt-BR') + ',' + cStr;
  };

  document.getElementById('tituloDivida').textContent = isEditar ? 'Editar Dívida' : 'Nova Dívida';
  document.getElementById('dividaId').value           = isEditar ? rec.id : '';
  document.getElementById('dividaNome').value         = isEditar ? (rec.nome || '') : '';
  document.getElementById('dividaInstituicao').value  = isEditar ? (rec.instituicao || '') : '';
  document.getElementById('dividaParcelas').value     = isEditar ? (rec.parcelas || '') : '';
  document.getElementById('dividaParcelasPagas').value = isEditar ? (rec.parcelasPagas || '') : '';
  document.getElementById('dividaJuros').value        = isEditar ? (rec.juros || '') : '';
  document.getElementById('dividaCET').value          = isEditar ? (rec.cet || '') : '';
  // Valores monetários IOF/Seguro
  setMoeda('dividaIOF',    isEditar ? (rec.iof    || 0) : 0);
  setMoeda('dividaSeguro', isEditar ? (rec.seguro || 0) : 0);
  // Recolher painel de custos extras por default
  const painelCustos = document.getElementById('painelCustosExtras');
  const iconCustos   = document.getElementById('iconToggleCustos');
  const temCustos    = isEditar && (rec.cet || rec.iof || rec.seguro);
  if (painelCustos) painelCustos.style.display = temCustos ? '' : 'none';
  if (iconCustos)   iconCustos.textContent      = temCustos ? '▾' : '▸';
  document.getElementById('dividaVencimento').value   = isEditar && rec.vencimento ? formatDataBR(rec.vencimento) : '';

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
    if (dadosIA.cet)        document.getElementById('dividaCET').value  = dadosIA.cet;
    if (dadosIA.iof)        setMoeda('dividaIOF',    dadosIA.iof);
    if (dadosIA.seguro)     setMoeda('dividaSeguro', dadosIA.seguro);
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

// ─── Toggle custos extras (CET/IOF/Seguro) no formulário ──────────────────────
window.toggleCustosExtras = function() {
  const painel = document.getElementById('painelCustosExtras');
  const icon   = document.getElementById('iconToggleCustos');
  if (!painel) return;
  const aberto = painel.style.display !== 'none';
  painel.style.display = aberto ? 'none' : '';
  if (icon) icon.textContent = aberto ? '▸' : '▾';
};

// Helpers para exibir/ocultar itens de custo no modal Detalhes
function showDetCusto(wrapId, valId, text) {
  const w = document.getElementById(wrapId);
  const v = document.getElementById(valId);
  if (w) w.style.display = '';
  if (v) v.textContent   = text;
}
function hideDetCusto(wrapId) {
  const w = document.getElementById(wrapId);
  if (w) w.style.display = 'none';
}


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
  const juros       = parseMoeda(document.getElementById('dividaJuros').value) || 0;

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
  const juros         = parseMoeda(document.getElementById('dividaJuros').value) || 0;
  const cetAnual      = parseMoeda(document.getElementById('dividaCET')?.value) || 0;
  const iofTotal      = parseMoeda(document.getElementById('dividaIOF')?.value) || 0;
  const seguroTotal   = parseMoeda(document.getElementById('dividaSeguro')?.value) || 0;
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
      ...(cetAnual  ? { cet:    cetAnual }  : {}),
      ...(iofTotal  ? { iof:    iofTotal }  : {}),
      ...(seguroTotal ? { seguro: seguroTotal } : {}),
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
  document.getElementById('tabExtratoDivida').style.display = tab === 'extrato' ? '' : 'none';
  if (tab === 'extrato' && dividaAtual) carregarExtratoDivida(dividaAtual.id);
};

window.abrirDetalhes = function(id, tabInicial) {
  const d = dividas.find(x => x.id === id);
  if (!d) return;
  dividaAtual = d;

  const saldo      = calcularSaldoDevedor(d);
  const totalPago  = (d.valorPago || 0);
  const jurosPagos = (d.jurosPagos || 0);
  const pct        = progressoParcelas(d);

  document.getElementById('detalhesNome').textContent    = escapeHTML(d.nome || '—');
  document.getElementById('detPct').textContent           = pct + '%';
  document.getElementById('detProgressoBar').style.width  = pct + '%';
  document.getElementById('detValorTotal').textContent    = formatMoeda(d.valorTotal);
  document.getElementById('detSaldo').textContent         = formatMoeda(saldo);
  document.getElementById('detPago').textContent          = formatMoeda(totalPago);
  document.getElementById('detJurosPagos').textContent    = formatMoeda(jurosPagos);
  document.getElementById('detParcelasInfo').textContent  = `${d.parcelasPagas || 0}/${d.parcelas || 0} parcelas pagas`;
  document.getElementById('detTipo').textContent          = (d.tipoIcone || '') + ' ' + (d.tipo || '—');

  // CET / IOF / Seguro (opcionais)
  const rowCustos = document.getElementById('detCustosRow');
  const mostrarCet    = d.cet    ? showDetCusto('detCETWrap',    'detCET',    d.cet.toFixed(2) + '% a.a.')    : hideDetCusto('detCETWrap');
  const mostrarIof    = d.iof    ? showDetCusto('detIOFWrap',    'detIOF',    formatMoeda(d.iof))              : hideDetCusto('detIOFWrap');
  const mostrarSeguro = d.seguro ? showDetCusto('detSeguroWrap', 'detSeguro', formatMoeda(d.seguro))           : hideDetCusto('detSeguroWrap');
  if (rowCustos) rowCustos.style.display = (d.cet || d.iof || d.seguro) ? 'flex' : 'none';

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
          ${paga && d.parcelasPagamentos?.[String(i)] ? `<div style="font-size:.6875rem;color:var(--text-sec);">Pago em ${escapeHTML(formatDataBR(d.parcelasPagamentos[String(i)].dataPagamento))} · ${escapeHTML(d.parcelasPagamentos[String(i)].modo === 'conta' ? d.parcelasPagamentos[String(i)].contaNome || 'Conta registrada' : 'Apenas marcado como pago')}</div>` : ''}
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

function servicoPagamentoDivida() {
  if (!window.BudDebtPayments) throw new Error('O leitor de pagamentos não carregou. Recarregue a página.');
  return window.BudDebtPayments.createService({db,doc,collection,runTransaction,Timestamp,serverTimestamp});
}
let _abrindoPagamentoDivida = false;
window.marcarParcelaPaga = async function(id,indice) {
  if (_abrindoPagamentoDivida || !currentUser) return;
  const debt = dividas.find(d=>d.id===id);
  if (!debt) return;
  _abrindoPagamentoDivida = true;
  const uid=currentUser.uid;
  try {
    const plan=window.BudDebtPayments.model(debt,indice);
    if(!plan.count){window.budShowToast?.('Esta parcela já está confirmada.','info');return;}
    const snapshot=await getDocs(collection(db,'usuarios',uid,'carteira'));
    const accounts=snapshot.docs.map(d=>({id:d.id,...d.data()}));
    const service=servicoPagamentoDivida();
    const result=await window.BudDebtPaymentDialog.open({debt,index:indice,accounts,onConfirm:options=>service.confirm({uid,debtId:id,index:indice,...options})});
    if(result){
      const fresh=await getDoc(doc(db,'usuarios',uid,'dividas',id));
      if(fresh.exists()){const value={id,...fresh.data()};dividas=dividas.map(d=>d.id===id?value:d);}
      window.abrirDetalhes(id,'parcelas');
      window.budShowToast?.(result.already?'A parcela já estava confirmada; nenhum lançamento foi duplicado.':'Registro salvo. Consulte a aba Extrato da dívida.','success');
    }
  } catch(error){window.budShowToast?.(error.message||'Não foi possível abrir o pagamento.','error');}
  finally{_abrindoPagamentoDivida=false;}
};
window.desmarcarParcela = async function(id,indice) {
  if(_abrindoPagamentoDivida || !currentUser)return;
  const debt=dividas.find(d=>d.id===id);if(!debt)return;
  if(indice!==(debt.parcelasPagas||0)-1){window.budShowToast?.('Só é possível desmarcar a última parcela paga.','warning');return;}
  _abrindoPagamentoDivida=true;const uid=currentUser.uid;
  try{
    const ok=await confirmarAcao('Desmarcar parcela?',`A parcela #${indice+1} voltará a ficar pendente. Quando o registro identifica uma conta, o valor será devolvido ao saldo original. O histórico desta ação será mantido.`, 'Desmarcar','#dc2626');
    if(!ok)return;
    await servicoPagamentoDivida().reverse({uid,debtId:id,index:indice});
    const fresh=await getDoc(doc(db,'usuarios',uid,'dividas',id));
    if(fresh.exists())dividas=dividas.map(d=>d.id===id?{id,...fresh.data()}:d);
    window.abrirDetalhes(id,'parcelas');window.budShowToast?.('Parcela desmarcada. Histórico preservado no extrato da dívida.','success');
  }catch(error){window.budShowToast?.(error.message||'Não foi possível desmarcar.','error');}
  finally{_abrindoPagamentoDivida=false;}
};
let _extratoDividaRequest=0;
async function carregarExtratoDivida(id) {
  const el=document.getElementById('extratoDividaLista');if(!el || !currentUser)return;
  const version=++_extratoDividaRequest,uid=currentUser.uid;
  el.textContent='Carregando registros…';
  try{
    const snapshot=await getDocs(query(collection(db,'usuarios',uid,'pagamentos-dividas'),where('dividaId','==',id)));
    if(version!==_extratoDividaRequest || currentUser?.uid!==uid || dividaAtual?.id!==id)return;
    const debt=dividas.find(d=>d.id===id),rows=snapshot.docs.map(d=>({id:d.id,...d.data()}));
    const covered=new Set(rows.filter(r=>r.acao==='pagamento').map(r=>r.parcelaIndice));
    for(let i=0;i<(debt?.parcelasPagas||0);i++)if(!covered.has(i)){
      const record=debt.parcelasPagamentos?.[String(i)];
      rows.push(record?{...record,acao:'pagamento'}:{acao:'legado',parcelaIndice:i,valor:null,dataPagamento:debt.parcelasDatas?.[String(i)]?.slice(0,10)||null,modo:'legado'});
    }
    rows.sort((a,b)=>((b.criadoEm?.toMillis?.()||b.criadoEm?.seconds*1000||0)-(a.criadoEm?.toMillis?.()||a.criadoEm?.seconds*1000||0)) || b.parcelaIndice-a.parcelaIndice);
    if(!rows.length){el.textContent='Nenhum pagamento registrado nesta dívida.';return;}
    el.innerHTML=rows.map(row=>{
      const title=row.acao==='desmarcado'?'Pagamento desmarcado':row.acao==='legado'?'Pagamento antigo — dados incompletos':'Pagamento confirmado';
      const source=row.modo==='conta'?'Conta: '+(row.contaNome||'conta registrada'):row.modo==='sem_conta'?'Apenas marcado como pago — sem movimentar conta':'Conta não informada no registro antigo';
      const date=row.dataPagamento?formatDataBR(row.dataPagamento):'Data não informada';
      return `<article style="padding:.875rem;margin-bottom:.625rem;border:1px solid var(--input-border);border-radius:.75rem;background:var(--input-bg);"><strong style="font-size:.8125rem;color:${row.acao==='desmarcado'?'#dc2626':'var(--text-main)'};">${escapeHTML(title)} · Parcela ${row.parcelaIndice+1}</strong><div style="font-size:.875rem;font-weight:800;margin-top:.375rem;">${row.valor==null?'Valor não informado no histórico':fmtIA(row.valor)}</div><div style="font-size:.75rem;margin-top:.375rem;">📅 ${escapeHTML(date)}<br>${escapeHTML(source)}${row.vencimento?'<br>Vencimento: '+escapeHTML(formatDataBR(row.vencimento)):''}</div></article>`;
    }).join('');
  }catch(error){if(version===_extratoDividaRequest)el.textContent='Não foi possível carregar o extrato. Feche e abra esta aba para tentar novamente.';}
}


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
  const ativas = dividas.filter(d => !dividaQuitada(d));

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
      el.style.cssText = 'background:var(--card-bg);border:1.5px solid rgba(220,38,38,0.35);border-radius:0.875rem;padding:0.875rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';
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
      el.style.cssText = 'background:var(--card-bg);border:1.5px solid rgba(217,119,6,0.35);border-radius:0.875rem;padding:0.875rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';
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
  const quitadasLista = dividas.filter(dividaQuitada);
  let filtradas = dividas.filter(d => !dividaQuitada(d));
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
      return progressoParcelas(b) - progressoParcelas(a);
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
    const pct     = progressoParcelas(d);
    const quitada = dividaQuitada(d);
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
    card.className = 'divida-list-card';
    card.style.cssText = `background:var(--card-bg);border:1.5px solid ${atrasadas > 0 ? 'rgba(252,165,165,0.5)' : ehPrioridade ? 'rgba(245,158,11,0.4)' : 'var(--card-border)'};border-radius:1.125rem;padding:1rem 1.125rem;margin-bottom:0.625rem;cursor:pointer;transition:transform .15s,box-shadow .15s;animation:fadeInUp .3s ease both;animation-delay:${idx * 0.04}s;`;

    card.innerHTML = `
      <div class="divida-card-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.625rem;">
        <div class="divida-card-main" style="display:flex;align-items:center;gap:0.625rem;min-width:0;flex:1;">
          <span class="divida-card-icon" style="font-size:1.5rem;flex-shrink:0;">${d.tipoIcone || '📄'}</span>
          <div class="divida-card-info" style="min-width:0;">
            <div class="divida-card-name" style="font-size:0.9375rem;font-weight:700;color:var(--card-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(d.nome || '—')}</div>
            <div class="divida-card-badges" style="display:flex;align-items:center;flex-wrap:wrap;gap:0.25rem;margin-top:0.2rem;">${statusBadge}${prioridadeBadge}${jurosBadge}</div>
            <div class="divida-card-institution" style="font-size:0.75rem;font-weight:500;color:var(--card-text-sec);margin-top:0.2rem;">${escapeHTML(d.instituicao || d.tipo || '—')}</div>
          </div>
        </div>
        <div class="divida-card-amount" style="text-align:right;flex-shrink:0;margin-left:0.5rem;">
          <div style="font-size:1rem;font-weight:800;color:${atrasadas > 0 ? '#dc2626' : quitada ? '#16a34a' : 'var(--card-text)'};">${formatMoeda(saldo)}</div>
          <div style="font-size:0.6875rem;font-weight:600;color:var(--card-text-sec);">${quitada ? 'quitada' : 'a pagar'}</div>
        </div>
      </div>
      <div class="divida-card-progress" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
        <div style="flex:1;height:5px;background:var(--input-border);border-radius:999px;overflow:hidden;">
          <div style="height:100%;border-radius:999px;background:${barColor};width:${pct}%;transition:width .4s ease;"></div>
        </div>
        <span style="font-size:0.6875rem;font-weight:800;color:var(--card-text-sec);min-width:2.25rem;text-align:right;">${pct}%</span>
      </div>
      <div class="divida-card-footer" style="display:flex;align-items:center;justify-content:space-between;">
        <div class="divida-card-meta" style="font-size:0.6875rem;font-weight:500;color:var(--card-text-sec);">
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
    const quitadas = dividas.filter(dividaQuitada);
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
        if (d.parcelasPagamentos?.[String(i)]?.modo === 'sem_conta') continue;
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

function mostrarEstadoCargaDividas(mensagem) {
  const estado = document.getElementById('estadoCargaDividas');
  estado.hidden = !mensagem;
  document.getElementById('mensagemCargaDividas').textContent = mensagem;
  document.getElementById('splash')?.classList.add('hide');
}

const prazoCargaDividas = setTimeout(() => {
  mostrarEstadoCargaDividas('A lista de dívidas está demorando a carregar.');
}, 8000);

async function carregarPerfilDividas(user) {
  let userData = {};
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    userData = snap.exists() ? snap.data() : {};
  } catch (err) {
    (window.budError||console.error)('[Dividas] userData:', err);
  }

  if (auth.currentUser?.uid !== user.uid) return;

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
  if (window.budAplicarFotoSidebar) window.budAplicarFotoSidebar(userData.photoURL || null, userData.nome || user.displayName || '');
}

onAuthStateChanged(auth, async (user) => {
  // Bug #7: limpar unsubs em toda troca de estado de autenticação
  _unsubs.forEach(u => u && u());
  _unsubs = [];

  if (user && !user.emailVerified) {
    const userId = user.uid;
    try { await user.reload(); } catch (_) { /* O estado local ainda exige verificação. */ }
    if (auth.currentUser?.uid !== userId) return;
    user = auth.currentUser;
  }
  if (!user || !user.emailVerified) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = user;

  // Migração: criar transações para parcelas já pagas (roda 1x por conta)
  migrarTransacoesDividas(user.uid);
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

    clearTimeout(prazoCargaDividas);
    mostrarEstadoCargaDividas('');
  }, err => {
    // Bug #2: error callback implementado
    (window.budError||console.error)('[Dividas] snapshot:', err);
    clearTimeout(prazoCargaDividas);
    mostrarEstadoCargaDividas('Não foi possível carregar as dívidas.');
  });

  _unsubs.push(unsubDividas);
  carregarPerfilDividas(user);

  // PEND-063: Verificar prefill vindo do Assistente IA (contrato detectado)
  const _rawPrefill = sessionStorage.getItem('bud_prefill_divida');
  if (_rawPrefill) {
    sessionStorage.removeItem('bud_prefill_divida');
    try {
      const pf = JSON.parse(_rawPrefill);
      // Aguarda a primeira renderização antes de abrir o modal
      setTimeout(() => {
        wizardTipo      = 'Empréstimo';
        wizardTipoIcone = '💸';
        wizardFormato   = pf.juros > 0 ? 'juros' : 'simples';
        dadosIA = {
          nomeCliente:   pf.nome         || '',
          instituicao:   pf.nome         || '',
          parcelas:      pf.parcelas     || '',
          juros:         pf.juros        || '',
          vencimento:    pf.vencimento   || '',
          valorParcela:  pf.valorParcela || 0,
          valorTotal:    pf.valorParcela && pf.parcelas ? pf.valorParcela * pf.parcelas : 0,
          valorPago:     0
        };
        abrirFormManual(null, true);
        window.budShowToast?.('Dados do contrato pré-preenchidos. Revise e salve.', 'info');
      }, 700);
    } catch (_) { /* JSON inválido — ignorar */ }
  }
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

  // Modais fecham apenas por comandos explícitos, preservando formulários.

  // ESC fecha todos
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharTodosModais(); });

  // Salvar dívida (formulário manual)
  document.getElementById('btnSalvarDivida')?.addEventListener('click', salvarDivida);

  // Máscaras monetárias
  ['dividaValorTotal','dividaValorPago','dividaValorParcela','simValorExtra','dividaIOF','dividaSeguro'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('focus', function() {
      if (parseMoeda(this.value) === 0) this.value = '';
    });
    input.addEventListener('blur', function() { if (this.value) aplicarMascaraMoeda(this); });
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

// ─── PEND-038: Exportar PDF Dívidas ──────────────────────────────────────────
window.exportarPDFDividas = function () {
  const ativas = dividas.filter(d => !dividaQuitada(d));
  const quitadas = dividas.filter(dividaQuitada);

  const fmt = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const totalSaldo = ativas.reduce((s, d) => s + calcularSaldoDevedor(d), 0);
  const totalPago  = dividas.reduce((s, d) => s + (d.valorPago || 0), 0);
  const totalJuros = dividas.reduce((s, d) => s + (d.jurosPagos || 0), 0);
  const totalMens  = ativas.reduce((s, d) => s + (d.valorParcela || 0), 0);

  const kpis = [
    { label: 'Dívidas Ativas', value: String(ativas.length) },
    { label: 'Saldo Devedor',  value: fmt(totalSaldo) },
    { label: 'Total Pago',     value: fmt(totalPago) },
    { label: 'Juros Pagos',    value: fmt(totalJuros) },
    { label: 'Mensalidade',    value: fmt(totalMens) },
  ];

  const buildTable = (lista, titulo) => {
    if (!lista.length) return '';
    const rows = lista.map(d => {
      const saldo = calcularSaldoDevedor(d);
      const parc  = d.parcelas ? `${d.parcelasPagas || 0}/${d.parcelas}` : '—';
      const juros = d.juros ? (d.juros * 100).toFixed(2) + '%' : '—';
      return `<tr>
        <td>${escapeHTML(d.nome || '')}</td>
        <td>${escapeHTML(d.tipo || '')}</td>
        <td style="text-align:right">${fmt(saldo)}</td>
        <td style="text-align:right">${fmt(d.valorPago)}</td>
        <td style="text-align:center">${parc}</td>
        <td style="text-align:center">${fmtDate(d.vencimento)}</td>
        <td style="text-align:center">${juros}</td>
      </tr>`;
    }).join('');
    return `
      <h3 style="margin:1.5rem 0 0.5rem;font-size:1rem;color:#374151;">${titulo} (${lista.length})</h3>
      <table>
        <thead><tr>
          <th>Nome</th><th>Tipo</th><th style="text-align:right">Saldo Dev.</th>
          <th style="text-align:right">Pago</th><th style="text-align:center">Parcelas</th>
          <th style="text-align:center">Próx. Venc.</th><th style="text-align:center">Juros a.m.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Dívidas — Bud Finanças</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 32px; }
      h1   { font-size: 1.25rem; color: #111827; margin-bottom: 0.25rem; }
      .sub { font-size: 0.75rem; color: #6b7280; margin-bottom: 1.25rem; }
      .kpis { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
      .kpi  { background: #f3f4f6; border-radius: 0.5rem; padding: 0.5rem 1rem; min-width: 100px; }
      .kpi-label { font-size: 0.65rem; color: #6b7280; text-transform: uppercase; }
      .kpi-value { font-size: 1rem; font-weight: 700; color: #1f2937; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
      th  { background: #f9fafb; text-align: left; padding: 6px 8px; font-size: 11px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb; }
      td  { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
      tr:hover td { background: #f9fafb; }
      @media print { body { margin: 0; } }
    </style>
  </head><body>
    <h1>📋 Relatório de Dívidas</h1>
    <div class="sub">Gerado em ${dataHoje} · Bud Finanças</div>
    <div class="kpis">
      ${kpis.map(k => `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`).join('')}
    </div>
    ${buildTable(ativas, 'Dívidas Ativas')}
    ${buildTable(quitadas, 'Dívidas Quitadas')}
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { window.budShowToast?.('Popup bloqueado. Permita pop-ups para exportar.', 'warning'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch(_) {} }, 600);
};




