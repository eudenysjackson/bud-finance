const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const policy=require('../backend/plan-policy');
const {subscriptionPushNotices}=require('../backend/financial-notifications');
const read=p=>fs.readFileSync(p,'utf8');

test('existing customer identifiers retain entitlements under new commercial names',()=>{
  const source=read('appbudfinance/js/bud-utils.js');
  const context={window:{}};
  vm.runInNewContext(source.match(/window\.BUD_PLAN_LABELS = \{[^}]+\};/)[0],context);
  assert.equal(context.window.BUD_PLAN_LABELS.plus,'Pro');
  assert.equal(context.window.BUD_PLAN_LABELS.pro,'Plus');
  assert.deepEqual(Object.values(policy.limits({plano:'plus'})),Array(5).fill(Infinity));
  assert.deepEqual(Object.values(policy.limits({plano:'pro'})),[2,2,15,5,5]);
  assert.deepEqual(policy.limits({plano:'trial',trialFim:new Date(Date.now()+100000)}),policy.LIMITS.plus);
});

test('sales cards and backend associate new names with the requested prices and preserved checkout keys',()=>{
  const html=read('budfinance/index.html'),server=read('backend/server.js');
  assert.match(html,/window\.assinar\('pro'\)\">Assinar Plus/);
  assert.match(html,/window\.assinar\('plus'\)\">Assinar Pro/);
  assert.match(server,/pro:\s*\{ title: 'Bud Finance Plus',\s*amount: 14\.99/);
  assert.match(server,/plus:\s*\{ title: 'Bud Finance Pro',\s*amount: 29\.99/);
  assert.match(html,/teste grátis dá acesso ao Pro por três dias/);
});

test('existing customers and scheduled plan changes receive the correct renewal name',()=>{
  for(const [plano,label] of [['pro','Plus'],['plus','Pro']]){
    const profile={plano,planoExpira:'2026-11-29',mpSubscriptionId:'example',assinaturaStatus:'authorized'};
    assert.match(subscriptionPushNotices(profile,'2026-11-26')[0].title,new RegExp(label));
    assert.match(subscriptionPushNotices({...profile,plano:'plus',planoTroca:{status:'scheduled',planKey:plano}},'2026-11-26')[0].title,new RegExp(label));
  }
});
