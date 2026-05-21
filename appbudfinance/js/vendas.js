// js/vendas.js — Landing page de vendas do Bud Finance
// Segurança: uid/email NÃO são enviados no body (extraídos do token verificado no backend)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// ── Firebase init (resiliente: firebase-config.js pode não existir em produção) ─
const FUNCTIONS_URL = window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com';
let _currentUser = null;

try {
  const cfg = window.BUD_FIREBASE_CONFIG;
  if (cfg) {
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    onAuthStateChanged(auth, u => { _currentUser = u; });
  }
} catch (e) {
  console.warn('[vendas] Firebase init falhou — modo fallback (redirect para cadastro):', e);
}

let _refCode = null; // código de indicação da URL (?ref=XXXXX)

// ── Desconto de indicação (30% off) ───────────────────────
function _makeDiscountedPrice(fullInt, fullDec, offInt, offDec) {
  return '<del style="font-size:.78rem;color:#94a3b8;font-weight:500">R$ ' + fullInt + ',' + fullDec + '/mês</del>' +
    '<div style="display:flex;align-items:flex-end;gap:3px;margin-top:2px">' +
    '<span class="currency">R$</span>' +
    '<span class="amount">' + offInt + '<span style="font-size:1.4rem">,' + offDec + '</span></span>' +
    '<span class="period">/mês</span></div>' +
    '<div style="font-size:.72rem;color:#059669;font-weight:700;margin-top:3px">🎁 10% off via indicação</div>';
}

function _applyRefDiscount() {
  const params = new URLSearchParams(window.location.search);
  _refCode = params.get('ref');
  if (!_refCode) return;

  // Atualizar preços: 30% off (arredondado para baixo)
  const ps = document.getElementById('plan-price-starter');
  const pp = document.getElementById('plan-price-pro');
  const px = document.getElementById('plan-price-plus');
  if (ps) ps.innerHTML = _makeDiscountedPrice('9', '99', '8', '99');
  if (pp) pp.innerHTML = _makeDiscountedPrice('29', '90', '26', '91');
  if (px) px.innerHTML = _makeDiscountedPrice('49', '90', '44', '91');

  // Mostrar banner
  const banner = document.getElementById('ref-banner');
  if (banner) banner.style.display = 'block';

  // Botão Free também passa o ref
  const freeBtn = document.getElementById('btn-plan-free');
  if (freeBtn) {
    freeBtn.onclick = function() {
      window.location.href = 'appbudfinance/cadastro.html?ref=' + encodeURIComponent(_refCode);
    };
  }
}

// ── Toast helper ──────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('vnd-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Assinar plano ──────────────────────────────────────────
// planKey: 'starter' | 'pro' | 'plus'
window.assinar = async function(planKey) {
  // Se não estiver logado, redireciona para cadastro com o plano pré-selecionado
  if (!_currentUser) {
    let url = 'appbudfinance/cadastro.html?plano=' + encodeURIComponent(planKey);
    if (_refCode) url += '&ref=' + encodeURIComponent(_refCode);
    window.location.href = url;
    return;
  }

  const btns = document.querySelectorAll('.plan-btn-paid');
  btns.forEach(b => { b.disabled = true; });
  showToast('Aguarde, preparando checkout...');

  try {
    const idToken = await _currentUser.getIdToken();
    // Segurança: uid e email são extraídos do Bearer token no backend, não enviados no body
    const res = await fetch(FUNCTIONS_URL + '/mercadopago/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + idToken
      },
      body: JSON.stringify({ planKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Erro ao criar assinatura');
    }

    const data = await res.json();
    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      throw new Error('Link de pagamento não recebido');
    }
  } catch (e) {
    showToast('Erro: ' + e.message + '. Tente novamente.');
    btns.forEach(b => { b.disabled = false; });
  }
};

// ── Fade-up ao rolar ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _applyRefDiscount();

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
});
