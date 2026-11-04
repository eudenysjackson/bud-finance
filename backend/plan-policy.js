'use strict';
const LIMITS = Object.freeze({
  free: { accounts: 1, cards: 1, transactions: 5, imports: 0, ai: 0 },
  starter: { accounts: 1, cards: 1, transactions: 10, imports: 0, ai: 0 },
  pro: { accounts: 2, cards: 2, transactions: 15, imports: 5, ai: 5 },
  plus: { accounts: Infinity, cards: Infinity, transactions: Infinity, imports: Infinity, ai: Infinity }
});
function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  return value ? new Date(value).getTime() : NaN;
}
function effectivePlan(profile = {}, now = Date.now()) {
  const plan = String(profile.plano || 'free').toLowerCase();
  let expiry = millis(plan === 'trial' ? profile.trialFim : profile.planoExpira || profile.planoExpiracao || profile.assinaturaExpira);
  if (plan === 'trial') return expiry > now ? 'trial' : 'free';
  if (!LIMITS[plan]) return 'free';
  if (profile.pagamentoPendente && plan !== 'free') {
    const grace = millis(profile.pagamentoPendenteDesde) + 10 * 86400000;
    if (Number.isFinite(grace)) expiry = Math.max(expiry || 0, grace);
  }
  return Number.isFinite(expiry) && expiry <= now ? 'free' : plan;
}
function limits(profile, now) { const plan = effectivePlan(profile, now); return LIMITS[plan === 'trial' ? 'plus' : plan]; }
function month(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(now); }
function assertLimit(used, requested, limit, label) {
  if (used + requested > limit) { const error = new Error(`Seu plano permite ${limit} ${label}. Escolha outro plano em Configurações → Dados.`); error.status = 403; error.code = 'PLAN_LIMIT'; throw error; }
}
module.exports = { LIMITS, effectivePlan, limits, month, assertLimit };
