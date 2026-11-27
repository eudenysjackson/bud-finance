const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSecurityGuard}=require('../backend/security-guard');
function entry(query='?checkout=pro',emulator=false){
 const document={documentElement:{dataset:{}},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},getElementById:()=>null};
 const calls=[],window={BUD_USE_EMULATOR:emulator,BUD_FUNCTIONS_URL:'https://api.example.test'};
 vm.runInNewContext(fs.readFileSync('appbudfinance/js/checkout-entry.js','utf8'),{location:{search:query},document,window,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push({url,options});return{};}});
 return{document,window,calls};
}
test('checkout entry hides the login immediately, warms only a read-only route once, and reveals login on session absence',async()=>{
 const s=entry();assert.equal(s.document.documentElement.dataset.checkoutEntry,'loading');
 s.window.BudCheckoutEntry.warm();s.window.BudCheckoutEntry.warm();await new Promise(setImmediate);
 assert.equal(s.calls.length,1);assert.equal(s.calls[0].url,'https://api.example.test/api/ping');assert.equal(s.calls[0].options.method,'GET');
 s.window.BudCheckoutEntry.showLogin();assert.equal(s.document.documentElement.dataset.checkoutEntry,'login');
});
test('ordinary login and invalid plan do not warm a backend; local emulation never wakes production',()=>{
 for(const query of ['','?checkout=evil'])assert.equal(entry(query).window.BudCheckoutEntry,undefined);
 const s=entry('?checkout=plus',true);s.window.BudCheckoutEntry.warm();assert.equal(s.calls.length,0);
});
test('security checks execute in parallel but never advance a revoked or deleting session',async()=>{
 for(const blocked of ['none','deletion','revocation']){
  const started=[],pending={},req={path:'/mercadopago/create-subscription',headers:{authorization:'Bearer fictitious'}};
  let advanced=false,verified=0;
  const db={collection(name){return{doc(){return{get(){started.push(name);return new Promise(resolve=>pending[name]=resolve);}};}};},runTransaction:async fn=>fn({get:async()=>({data:()=>({})}),set(){}})};
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(){return this;}};
  const run=createSecurityGuard({db,auth:{verifyIdToken:async()=>{verified++;return{uid:'test',auth_time:1};}},secret:'test'}) (req,res,()=>advanced=true);
  await new Promise(setImmediate);assert.deepEqual(started,['_account_deletions','_session_revocations']);assert.equal(advanced,false);
  pending._account_deletions({exists:blocked==='deletion'});
  pending._session_revocations({exists:blocked==='revocation',data:()=>({revokedAt:2})});
  await run;assert.equal(verified,1);assert.equal(advanced,blocked==='none');
 }
});
test('email has plan cards, WhatsApp and a personalized opt out; extra checkout copy is absent',()=>{
 const html=fs.readFileSync('marketing/2026-11-novos-precos/email.html','utf8');
 assert.match(html,/href="https:\/\/wa\.me\/5521983554954"/);assert.match(html,/href="{{unsubscribe_url}}"/);
 assert(!html.includes('mailto:'));assert(!html.includes('É só tocar'));assert(!html.includes('Novos preços mensais vigentes'));
 assert.match(html,/A assinatura tem renovação mensal\. Você pode continuar usando o plano Gratuito se preferir\./);
});
