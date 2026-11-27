const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({query='?checkout=pro&ref=BUDTEST',open=async()=>{},emulator=false}={}){
 const nodes={},navigations=[],calls=[];let callback,initialized=0,signedOut=0;
 const auth={currentUser:null};
 const document={getElementById(id){return nodes[id] ||= {hidden:true,addEventListener(type,fn){this[type]=fn;}};}};
 const context={URL,URLSearchParams,location:{href:'https://budsolucoes.com.br/appbudfinance/assinar.html'+query,search:query,replace:url=>navigations.push(url)},window:{BUD_USE_EMULATOR:emulator,BUD_FIREBASE_CONFIG:{}},document,getApps:()=>[],initializeApp:()=>{initialized++;return{};},getAuth:()=>auth,onAuthStateChanged:(_,fn)=>callback=fn,signOut:async()=>{signedOut++;auth.currentUser=null;},openAuthenticatedCheckout:async(user,key,options)=>{calls.push({user,key,options});return open(user,key,options);}};
 const source=fs.readFileSync('appbudfinance/js/assinar.js','utf8').replace(/^import .*;\r?$/gm,'');
 vm.runInNewContext(source,context);
 return{async run(user){auth.currentUser=user;return callback(user);},nodes,navigations,calls,initialized:()=>initialized,signedOut:()=>signedOut};
}
const user={uid:'fictitious',emailVerified:true};
test('minimal entry opens the chosen checkout with the active session and keeps referral',async()=>{
 for(const key of ['starter','pro','plus']){
  const s=setup({query:'?checkout='+key+'&ref=BUDTEST'});
  await s.run(user);assert.equal(s.calls.length,1);assert.equal(s.calls[0].user,user);assert.equal(s.calls[0].key,key);assert.equal(s.calls[0].options.refCode,'BUDTEST');assert.equal(s.navigations.length,0);
 }
});
test('missing or unverified session continues to login with plan and referral intact',async()=>{
 for(const candidate of [null,{...user,emailVerified:false}]){
  const s=setup();await s.run(candidate);
  assert.equal(s.calls.length,0);const target=new URL(s.navigations[0]);
  assert.equal(target.pathname,'/appbudfinance/');assert.equal(target.searchParams.get('checkout'),'pro');assert.equal(target.searchParams.get('ref'),'BUDTEST');
 }
});
test('Auth replays cannot start a second request, including after navigation starts',async()=>{
 let release;const s=setup({open:()=>new Promise(resolve=>release=resolve)});
 const first=s.run(user);await s.run(user);assert.equal(s.calls.length,1);
 release();await first;await s.run(user);assert.equal(s.calls.length,1);
});
test('provider failure keeps an explicit retry without an automatic second contract',async()=>{
 let attempts=0;const s=setup({open:async()=>{if(++attempts===1)throw Error('Falha simulada');}});
 await s.run(user);assert.equal(s.calls.length,1);assert.equal(s.nodes.checkoutRetry.hidden,false);assert.match(s.nodes.checkoutEntryError.textContent,/Falha simulada/);
 await s.nodes.checkoutRetry.click();assert.equal(s.calls.length,2);assert.equal(s.nodes.checkoutRetry.hidden,true);
});
test('expired session offers explicit sign in and clears the old session before returning',async()=>{
 const s=setup({open:async()=>{throw Object.assign(Error('Sessão encerrada'),{status:401});}});
 await s.run(user);assert.equal(s.nodes.checkoutRetry.hidden,true);assert.equal(s.nodes.checkoutLogin.hidden,false);
 await s.nodes.checkoutLogin.click();assert.equal(s.signedOut(),1);assert.equal(new URL(s.navigations[0]).searchParams.get('checkout'),'pro');
});
test('existing subscription directs management instead of another subscription',async()=>{
 const s=setup({open:async()=>{throw Object.assign(Error('Já existe uma assinatura'),{status:409,code:'SUBSCRIPTION_EXISTS'});}});
 await s.run(user);assert.equal(s.nodes.checkoutManage.hidden,false);assert.equal(s.nodes.checkoutRetry.hidden,true);assert.equal(s.calls.length,1);
});
test('emulator entry preserves the established local simulator and invalid plan never initializes SDK',()=>{
 const local=setup({emulator:true});assert.equal(local.initialized(),0);assert.equal(local.calls.length,0);assert.equal(new URL(local.navigations[0]).searchParams.get('checkout'),'pro');
 const invalid=setup({query:'?checkout=invalid'});assert.equal(invalid.initialized(),0);assert.equal(invalid.calls.length,0);assert.equal(invalid.nodes.checkoutRetry.hidden,true);
});
test('direct route does not load Firestore, global utilities, fonts or the login page',()=>{
 const source=fs.readFileSync('appbudfinance/js/assinar.js','utf8'),html=fs.readFileSync('appbudfinance/assinar.html','utf8'),email=fs.readFileSync('marketing/2026-11-novos-precos/email.html','utf8');
 assert(!/firebase-firestore|bud-utils|bud-emulator-connect/.test(source));assert(!/fonts.googleapis|bud-utils|mascote-login/.test(html));
 assert.match(html,/modulepreload/);assert.match(email,/assinar\.html\?checkout=starter/);assert.match(email,/assinar\.html\?checkout=pro/);assert.match(email,/assinar\.html\?checkout=plus/);
});

test('legacy email links use the lightweight route while login and verification avoid loops',()=>{
 const source=fs.readFileSync('appbudfinance/js/checkout-entry.js','utf8');
 for(const suffix of ['?checkout=pro&ref=BUDTEST','?checkout=pro&entrar=1','?checkout=pro&magic_verification=fictitious','?checkout=pro&email_destino=perfil']){
  let target;const document={documentElement:{dataset:{}},addEventListener(){}};
  vm.runInNewContext(source,{URL,URLSearchParams,location:{hostname:'budsolucoes.com.br',pathname:'/appbudfinance/',href:'https://budsolucoes.com.br/appbudfinance/'+suffix,search:suffix,replace:value=>target=value},document,window:{}});
  if(suffix.includes('entrar=')||suffix.includes('magic_')||suffix.includes('email_'))assert.equal(target,undefined);
  else{assert.equal(new URL(target).pathname,'/appbudfinance/assinar.html');assert.equal(new URL(target).searchParams.get('ref'),'BUDTEST');}
 }
 const html=fs.readFileSync('appbudfinance/index.html','utf8');assert(html.indexOf('checkout-entry.js')<html.indexOf('app-shell.js'));
});


test('an unverified session returning to login sees verification entry instead of another rejected checkout',async()=>{
 const source=fs.readFileSync('appbudfinance/js/index.js','utf8'),marker='onAuthStateChanged(auth, async function (user) {';
 const start=source.indexOf(marker),body=source.slice(start+marker.length,source.indexOf('\n});',start));
 let shown=0,called=0;const window={location:{search:'?checkout=pro&entrar=1'},BudCheckoutEntry:{showLogin(){shown++;}}};
 const run=new Function('window','URLSearchParams','openAuthenticatedCheckout','return async function(user){let _loginInProgress=false,_magicLoginInProgress=false;'+body+'}')(window,URLSearchParams,async()=>called++);
 await run({uid:'test',emailVerified:false});assert.equal(shown,1);assert.equal(called,0);
});
