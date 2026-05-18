// js/vendas.js — Landing page de vendas do Bud Finance
// Segurança: uid/email NÃO são enviados no body (extraídos do token verificado no backend)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// ── Firebase init ─────────────────────────────────────────
const cfg = window.BUD_FIREBASE_CONFIG;
const app = initializeApp(cfg);
const auth = getAuth(app);

const FUNCTIONS_URL = window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com';

let _currentUser = null;
onAuthStateChanged(auth, u => { _currentUser = u; });

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
    window.location.href = 'cadastro.html?plano=' + encodeURIComponent(planKey);
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
