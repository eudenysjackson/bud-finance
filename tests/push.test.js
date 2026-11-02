const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('appbudfinance/js/push.js', 'utf8').replace(/import\s+[\s\S]*?from\s+'[^']+';/, '').replace(/export /g, '');
function setup(status = 200) {
  let unsubscribed = 0, listeners = 0, removed = 0, saved = 0;
  const app = {}, registration = { pushManager: { getSubscription: async () => ({ unsubscribe: async () => { unsubscribed++; } }) } };
  const api = new Function('window', 'navigator', 'Notification', 'localStorage', 'getMessaging', 'getToken', 'onMessage', 'deleteToken', 'fetch', source + ';return {registerPushToken,listenForeground};')(
    { BUD_FCM_VAPID_KEY: 'public-test-key', Notification: {}, PushManager: {}, BUD_FUNCTIONS_URL: 'https://backend.example' },
    { serviceWorker: { register: async () => registration, ready: Promise.resolve(registration) } },
    { permission: 'granted' }, { setItem() { saved++; } }, () => ({}), async () => 'fictitious-token',
    () => { listeners++; return () => { removed++; }; }, async () => {}, async () => ({ ok: status === 200, status, json: async () => ({ error: 'rejected' }) })
  );
  return { api, app, counters: () => ({ unsubscribed, listeners, removed, saved }) };
}
test('push registration preserves a valid subscription and only marks active after backend accepts', async () => {
  const ctx = setup();
  assert.equal(await ctx.api.registerPushToken(ctx.app, { getIdToken: async () => 'fictitious-auth' }), 'fictitious-token');
  assert.equal(ctx.counters().unsubscribed, 0);
  assert.equal(ctx.counters().saved, 1);
  const rejected = setup(503);
  await assert.rejects(rejected.api.registerPushToken(rejected.app, { getIdToken: async () => 'fictitious-auth' }), /503/);
  assert.equal(rejected.counters().saved, 0);
});
test('foreground push listener is replaced instead of displaying the same alert several times', () => {
  const ctx = setup();
  ctx.api.listenForeground(ctx.app, () => {});ctx.api.listenForeground(ctx.app, () => {});
  assert.deepEqual(ctx.counters(), { unsubscribed: 0, listeners: 2, removed: 1, saved: 0 });
});

test('foreground notification preserves title and body when FCM supplies empty data',async()=>{
 const displays=[];const registration={showNotification:async(title,options)=>displays.push({title,...options})};
 const text=fs.readFileSync('appbudfinance/js/push.js','utf8');const fn=text.slice(text.indexOf('export async function showForegroundNotification'),text.indexOf('export function listenForeground')).replace('export ','');
 const show=new Function('window','navigator','Notification','URL','console',fn+';return showForegroundNotification;')({location:{href:'https://example.com/appbudfinance/configuracoes.html'}},{serviceWorker:{getRegistration:async()=>registration}},{permission:'granted'},URL,{info(){}});
 await show({data:{},notification:{title:'Teste do Bud Finance',body:'Mensagem completa'}});
 assert.equal(displays[0].title,'Teste do Bud Finance');assert.equal(displays[0].body,'Mensagem completa');
 await show({data:{title:'Fatura',body:'Vence amanhã',url:'https://untrusted.example/'},notification:{title:'Fallback',body:'Fallback'}});
 assert.equal(displays[1].title,'Fatura');assert.equal(displays[1].body,'Vence amanhã');assert.equal(displays[1].data.url,'https://example.com/appbudfinance/dashboard.html');
});


test('profile changes update an already open device and old account listeners cannot overwrite it',()=>{
 const text=fs.readFileSync('appbudfinance/js/profile-sync.js','utf8'),code=text.slice(text.indexOf('export function observeProfile'),text.indexOf('function start()')).replace('export ','');
 const observe=new Function('console',code+';return observeProfile;')({warn(){}});let authCallback,stopped=0;const subscriptions=[],applied=[];
 const stop=observe({auth:{},db:{},watchAuth:(_,fn)=>{authCallback=fn;return()=>stopped++;},profileRef:(_,c,id)=>id,watchProfile:(id,fn)=>{subscriptions.push({id,fn});return()=>stopped++;},apply:data=>applied.push(data)});
 authCallback({uid:'a',displayName:'A'});const first=subscriptions[0];first.fn({exists:()=>true,data:()=>({photoURL:'first-photo',nome:'A'})});first.fn({exists:()=>true,data:()=>({photoURL:'updated-photo',nome:'A'})});assert.equal(applied.at(-1).photoURL,'updated-photo');
 authCallback({uid:'b',displayName:'B'});first.fn({exists:()=>true,data:()=>({photoURL:'stale-photo'})});assert.equal(applied.at(-1).photoURL,'updated-photo');subscriptions[1].fn({exists:()=>true,data:()=>({nome:'B',pushConsentRevoked:true})});assert.equal(applied.at(-1).photoURL,null);assert.equal(applied.at(-1).revoked,true);stop();assert.equal(stopped,3);
});

