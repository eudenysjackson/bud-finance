'use strict';
// Read-only/unauthenticated release checks; never sends mail or creates payments.
const assert = require('node:assert/strict');
const backend = 'https://bud-finance-backend.onrender.com';
const site = 'https://budsolucoes.com.br';
async function check(name, url, init, expected) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expected, name);
  console.log(JSON.stringify({ name, status: response.status }));
}
(async () => {
  for (const path of ['/', '/budfinance/', '/appbudfinance/']) {
    await check(path, site + path, {}, 200);
  }
  await check('backend health', backend + '/', {}, 200);
  await check('checkout requires login', backend + '/mercadopago/create-subscription', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  }, 401);
  await check('plan change requires login', backend + '/mercadopago/change-subscription', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  }, 401);
  await check('cron rejects missing secret', backend + '/api/notifications/daily?dry_run=1', {}, 401);
  await check('webhook rejects unsigned event', backend + '/webhook/mercadopago', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'subscription_preapproval', data: { id: 'release-probe-invalid' } })
  }, 401);
  console.log('Public checks passed. Authenticated flows and provider webhook delivery require separate validation.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
