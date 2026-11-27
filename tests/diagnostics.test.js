const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const core=require('../appbudfinance/js/diagnostics-core');
const {createAppCheckGuard}=require('../backend/app-check');
const {createMonitoring}=require('../backend/monitoring');
const dsn='https://'+('a'.repeat(32))+'@o1.ingest.us.sentry.io/123';
test('diagnostics allowlists discard financial values, identifiers, URLs, tokens and arbitrary error contents',()=>{
  const error=new TypeError('CPF 12345678900 saldo R$900 segredo bearer-token');
  error.stack+='\n at bad (https://example.test/private/12345678900.js?token=secret:1:1)\n at save (https://example.test/appbudfinance/js/cartoes.js:200:4)';
  error.request={body:'private'};error.user={email:'private@example.test'};
  const event=core.event(error,{route:'cartoes',op:'financial_write',status:503,user:'private'});
  const text=JSON.stringify(event);for(const value of ['12345678900','900','bearer-token','private@example.test','token=','secret','request'])assert(!text.includes(value));
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename,'app:///appbudfinance/js/cartoes.js');
  assert.equal(event.exception.values[0].stacktrace.frames[0].lineno,200);
  assert.equal(core.page('/appbudfinance/extrato?uid=secret'),'extrato');
  assert.equal(core.page('/appbudfinance/'),'index');
  assert.equal(core.operation('/api/ia/jobs/private-id?token=secret'),'ai_status');
});
test('collector requires explicit activation and official DSN; sends minimal envelopes with bounded frequency',async()=>{
  const calls=[];let time=1000;
  const send=async(...args)=>{calls.push(args);return{ok:true,status:200}};
  assert.equal(await core.collector({dsn,send})(Error('private')),false);assert.equal(calls.length,0);
  for(const bad of ['https://a@evil.test/1',dsn+'/bad',dsn+'?secret=x',dsn.replace('https:','http:')])assert.equal(core.sentryEndpoint(bad),null);
  const capture=core.collector({dsn,enabled:true,send,now:()=>time,uuid:()=> 'b'.repeat(32),limit:2});
  assert.equal(await capture(Error('secret'),{route:'cartoes'}),true);
  assert.equal(await capture(Error('other'),{route:'cartoes'}),false);
  assert.equal(await capture(new TypeError(),{route:'cartoes'}),true);
  assert.equal(await capture(new RangeError(),{route:'cartoes'}),false);
  const envelope=calls[0][1];assert.equal(envelope.referrerPolicy,'no-referrer');assert.equal(envelope.credentials,'omit');
  const lines=envelope.body.trim().split('\n');assert.equal(JSON.parse(lines[1]).type,'event');assert.equal(JSON.parse(lines[2]).event_id,'b'.repeat(32));assert(!envelope.body.includes('secret'));
  time+=86400000;assert.equal(await capture(Error(),{route:'cartoes'}),true);
});
test('network failures and provider quota responses never escape or produce retry storms',async()=>{
  const capture=core.collector({dsn,enabled:true,send:async()=>{throw Error('network')},uuid:()=> 'b'.repeat(32)});
  assert.equal(await capture(Error()),false);
  let calls=0;const limited=core.collector({dsn,enabled:true,send:async()=>{calls++;return{ok:false,status:429}},uuid:()=> 'b'.repeat(32)});
  await limited(Error());await limited(new TypeError());assert.equal(calls,1);
});
async function guardCall(guard,token,path='/api/financial/write'){
  let next=0;const req={path,headers:{...(token?{'x-firebase-appcheck':token}:{})}},res={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v}};
  await guard.middleware(req,res,()=>next++);return{req,res,next};
}
test('App Check observation preserves existing login/write behaviour and excludes webhooks',async()=>{
  const guard=createAppCheckGuard({mode:'observe',verify:async()=>{throw Error('secret token')}});
  assert.equal((await guardCall(guard)).next,1);assert.equal((await guardCall(guard,'bad')).next,1);
  const webhook=await guardCall(guard,'bad','/webhook/mercadopago');assert.equal(webhook.next,1);assert.equal(webhook.req.budAppCheck,undefined);
  assert.deepEqual(guard.stats,{valid:0,missing:1,invalid:1});
});
test('App Check enforcement requires the authorized app and leaves original authentication to the existing guard',async()=>{
  assert.throws(()=>createAppCheckGuard({mode:'enforce'}));
  const guard=createAppCheckGuard({mode:'enforce',appIds:['allowed'],verify:async token=>({appId:token})});
  assert.equal((await guardCall(guard)).res.statusCode,401);assert.equal((await guardCall(guard,'other')).next,0);
  assert.equal((await guardCall(guard,'allowed')).next,1);assert.equal((await guardCall(guard,'allowed')).req.budUser,undefined);
});
test('an unavailable App Check verifier has a bounded wait in observation mode',async()=>{
  const guard=createAppCheckGuard({mode:'observe',timeoutMs:5,verify:()=>new Promise(()=>{})});
  const result=await guardCall(guard,'token');assert.equal(result.next,1);assert.equal(result.req.budAppCheck,'invalid');
});
test('backend monitoring reports only generic errors and does not serialize requests',async()=>{
  const sent=[];const monitoring=createMonitoring({env:{SENTRY_DSN:dsn,SENTRY_FREE_PLAN_CONFIRMED:'true'},send:async(url,init)=>{sent.push(init.body);return{ok:true,status:200}}});
  await monitoring.capture(new Error('CPF saldo e token privados'),{path:'/api/financial/write',body:{senha:'never'},headers:{authorization:'Bearer private'}});
  assert.equal(sent.length,1);for(const privateValue of ['privados','never','Bearer','senha','authorization'])assert(!sent[0].includes(privateValue));
});
async function browser({local=false,optOut=false,failSdk=false,appCheck=false,appCheckConfirmed=appCheck,path='/appbudfinance/cartoes',hash=''}={}){
  const records=[],calls=[],imports=[],events={},storage=new Map(optOut?[['bud_diagnostics_disabled','true']]:[]);
  const window={BudDiagnosticsCore:core,BUD_PERFORMANCE_ENABLED:true,BUD_SENTRY_FREE_PLAN_CONFIRMED:false,BUD_FUNCTIONS_URL:'https://api.example.test',
    BUD_FIREBASE_CONFIG:{appId:'app',projectId:'project'},BUD_APP_CHECK_SITE_KEY:appCheck?'site-key':'',BUD_APP_CHECK_FREE_PROVIDER_CONFIRMED:appCheckConfirmed,
    fetch:async(input,init)=>{calls.push({input,init});return{ok:true,status:200}},addEventListener:(name,fn)=>events[name]=fn};
  const context={window,URL,Headers,Request,AbortSignal,console,performance:{timeOrigin:1000,getEntriesByType:()=>[{domContentLoadedEventEnd:50}]},
    document:{readyState:'complete',getElementById:()=>null},location:{hostname:local?'localhost':'budsolucoes.com.br',protocol:local?'http:':'https:',pathname:path,hash,href:'https://budsolucoes.com.br'+path+hash},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    loadSdk:async url=>{imports.push(url);if(failSdk)throw Error('unavailable');
      if(url.endsWith('firebase-app.js'))return{getApps:()=>[{name:'[DEFAULT]'}],initializeApp:()=>{throw Error('must reuse existing app')}};
      if(url.endsWith('firebase-app-check.js'))return{initializeAppCheck:(_, {provider})=>{assert.equal(provider.siteKey,'site-key');return{}},ReCaptchaEnterpriseProvider:class{constructor(siteKey){this.siteKey=siteKey}},onTokenChanged:(_,callback)=>callback({token:'cached-app-token'}),getToken:async()=>({})};
      // Match the real exports of the pinned 10.8.1 CDN module: no isSupported.
      return{initializePerformance:(_,settings)=>{assert.equal(settings.instrumentationEnabled,false);return{}},trace:(_,name)=>({record:(start,duration,options)=>records.push({name,start,duration,options})})};}};
  const source=fs.readFileSync('appbudfinance/js/diagnostics.js','utf8').replace(/^import '\.\/diagnostics-core\.js[^']*';/,'').replaceAll('import(','loadSdk(');
  vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));return{window,calls,records,imports,events};
}
test('local sessions never send telemetry or initialize production providers',async()=>{
  const b=await browser({local:true,appCheck:true});assert.equal(b.imports.length,0);assert.equal(b.records.length,0);
});
test('a site key alone never activates a provider whose no-cost configuration has not been confirmed',async()=>{
  const b=await browser({appCheck:true,appCheckConfirmed:false});
  assert.equal(b.window.BudDiagnostics.state.appCheck,'disabled');
  assert(!b.imports.some(url=>url.endsWith('firebase-app-check.js')));
  await b.window.fetch('https://api.example.test/api/financial/write',{method:'POST'});
  assert.equal(b.calls[0].init.headers,undefined);
});
test('performance records only fixed operations/durations and App Check headers never reach another origin',async()=>{
  const b=await browser({appCheck:true});
  assert.equal(b.window.BudDiagnostics.state.performance,'configured');
  assert(b.records.some(r=>r.name==='page_ready_cartoes'));
  await b.window.fetch('https://api.example.test/api/financial/write',{method:'POST',headers:{Authorization:'Bearer original'},body:'private financial data'});
  const init=b.calls[0].init;assert.equal(init.headers.get('X-Firebase-AppCheck'),'cached-app-token');assert.equal(init.headers.get('Authorization'),'Bearer original');assert.equal(init.body,'private financial data');
  await b.window.fetch('https://other.example.test/api/financial/write',{method:'POST'});assert.equal(b.calls[1].init.headers,undefined);
  assert(b.records.some(r=>r.name==='api_financial_write'));assert(!JSON.stringify(b.records).includes('private'));
});
test('Performance skips unknown URL paths and fragments while preserving App Check',async()=>{
  for(const options of [{path:'/appbudfinance/private/cartoes'},{hash:'#private'}]){
    const b=await browser({...options,appCheck:true});
    assert.equal(b.window.BudDiagnostics.state.performance,'disabled');
    assert(!b.imports.some(url=>url.endsWith('firebase-performance.js')));
    assert.equal(b.window.BudDiagnostics.state.appCheck,'observing');
  }
  const root=await browser({path:'/appbudfinance/'});
  assert(root.records.some(r=>r.name==='page_ready_index'));
});
test('disabling optional diagnostics preserves App Check and unavailable SDKs do not prevent API calls',async()=>{
  const off=await browser({optOut:true,appCheck:true});assert.equal(off.records.length,0);assert.equal(off.window.BudDiagnostics.state.appCheck,'observing');
  const unavailable=await browser({failSdk:true});assert.equal((await unavailable.window.fetch('https://api.example.test/api/financial/write')).ok,true);
});
