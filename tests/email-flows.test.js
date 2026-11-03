const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

test('verification email supplies code, magic link and membership number expected by the template',async()=>{
  const source=fs.readFileSync('backend/server.js','utf8');
  const code=source.slice(source.indexOf("app.post('/api/verificacao-email/enviar'"),source.indexOf("app.post('/api/verificacao-email/magico'"));
  let handler,params;
  const verification={get:async()=>({exists:false}),set:async()=>{},delete:async()=>{}};
  const user={get:async()=>({exists:true,data:()=>({nome:'Pessoa teste',matricula:'BUD123'})}),collection:()=>({doc:()=>verification})};
  const context={app:{post:(_,fn)=>{handler=fn;}},getBearerUser:async()=>({uid:'qa',email:'qa@example.test',email_verified:false}),
    db:{collection:()=>({doc:()=>user})},crypto,EMAIL_VERIFICATION_SECRET:'fake',EMAILJS_TEMPLATE_BOAS_VINDAS:'welcome',
    hashVerificationCode:()=> 'fake-hash',admin:{firestore:{Timestamp:{fromMillis:value=>value}}},FRONTEND_URL:'https://budsolucoes.com.br/appbudfinance',sanitizeStr:value=>value,
    sendEmailViaEmailJS:async data=>{params=data;}};
  vm.runInNewContext(code,context);
  const response={status(){return this;},json(data){this.data=data;return this;}};
  await handler({},response);
  assert.equal(response.data.ok,true);assert.match(params.verification_code,/^\d{6}$/);assert.equal(params.matricula,'BUD123');
  assert.equal(params.verify_url,params.magic_link);assert.match(params.magic_link,/\/appbudfinance\/index.html\?magic_verification=/);
});

test('password recovery never reports delivery when the server is unavailable',async()=>{
  const source=fs.readFileSync('appbudfinance/js/recuperar-senha.js','utf8');
  let submit;const toasts=[],timers=[];
  const elements={formRecuperar:{addEventListener:(_,handler)=>{submit=handler;}},btnRecuperar:{classList:{add(){},remove(){}}},email:{value:'qa@example.test'}};
  const context={document:{getElementById:id=>elements[id]},window:{BUD_FUNCTIONS_URL:'http://local',budShowToast:(...args)=>toasts.push(args)},AbortSignal,
    fetch:async()=>new Response('{}',{status:503}),setTimeout:fn=>timers.push(fn),console:{warn(){}}};
  vm.runInNewContext(source,context);await submit({preventDefault(){}});
  assert.equal(toasts.at(-1)[1],'error');assert.equal(timers.length,0);assert.equal(elements.btnRecuperar.disabled,false);
});

test('backend recovery supplies branded and legacy templates with the same valid action URL',async()=>{
  const source=fs.readFileSync('backend/server.js','utf8');
  const code=source.slice(source.indexOf("app.post('/reset-senha'"),source.indexOf("app.get('/',"));
  let handler,params;
  const context={app:{post:(_,fn)=>{handler=fn;}},auth:{getUserByEmail:async()=>({uid:'qa'}),generatePasswordResetLink:async()=> 'https://project.test/action?oobCode=fake%20code'},
    db:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({nome:'Pessoa teste'})})})})},sanitizeStr:value=>value,isRateLimited:()=>false,
    FRONTEND_URL:'https://budsolucoes.com.br/appbudfinance',sendCommunicationEmail:async data=>{params=data;},URL,console};
  vm.runInNewContext(code,context);
  let result;await handler({body:{email:'qa@example.test'}},{json:data=>{result=data;}});
  const link=new URL(params.action_url);
  assert.equal(link.pathname,'/appbudfinance/acao-auth.html');assert.equal(link.searchParams.get('mode'),'resetPassword');assert.equal(link.searchParams.get('oobCode'),'fake code');
  assert.equal(params.reset_url,params.action_url);assert.equal(params.email_title,'Redefina sua senha');assert.equal(result.success,true);
});

test('old reset links without mode still open the reset flow; explicit unknown modes fail',async()=>{
  const source=fs.readFileSync('appbudfinance/js/acao-auth.js','utf8');
  const parameters=source.slice(source.indexOf('function getUrlParam('),source.indexOf('// ─── Reset button helper'));
  const routing=source.slice(source.indexOf('(async function init()'),source.indexOf('// ─── Step 2:'));
  for(const [query,expected] of [['?oobCode=fake','reset'],['?mode=resetPassword&oobCode=fake','reset'],['?mode=verifyEmail&oobCode=fake','verify'],['?mode=invalid&oobCode=fake','error']]){
    let actual;
    const context={window:{location:{search:query}},URLSearchParams,handleResetPassword:async()=>{actual='reset';},handleVerifyEmail:async()=>{actual='verify';},showSection:()=>{actual='error';},stateError:{},errorMessage:{}};
    vm.runInNewContext(parameters,context);await vm.runInNewContext(routing,context);assert.equal(actual,expected);
  }
});

test('subscription email resumes a pending checkout, manages active billing, or asks for a new plan', async () => {
  const fs = require('node:fs');
  const source = fs.readFileSync('appbudfinance/js/index.js', 'utf8');
  const code = source.slice(source.indexOf('async function continuarEmail('));
  for (const state of ['trial', 'pending', 'authorized', 'cancelled']) {
    const profile = state === 'trial' ? {} : {
      mpSubscriptionId: 'test-id',
      assinaturaStatus: state,
      mpCheckout: { subscriptionId: 'test-id', planKey: 'starter' }
    };
    const status = {}, plans = { children: [], append(button) { this.children.push(button); } };
    const dialog = { style: {}, setAttribute() {}, addEventListener() {}, showModal() {},
      querySelector: selector => selector === '[role=status]' ? status : plans };
    plans.style = {};
    const calls = [], user = { uid: 'test-user' };
    const resume = new Function('document', 'location', 'getDocFromServer', 'doc', 'db', 'auth', 'openAuthenticatedCheckout',
      code + ';return continuarEmail;')(
      { createElement: tag => tag === 'dialog' ? dialog : { style: {} }, body: { append() {} } },
      { assign: url => calls.push(url) }, async () => ({ exists: () => true, data: () => profile }),
      () => ({}), {}, { currentUser: user }, async (_, plan) => calls.push(plan)
    );
    await resume(user, new URLSearchParams('email_destino=assinatura'));
    if (state === 'pending') assert.deepEqual(calls, ['starter']);
    else if (state === 'authorized') assert.deepEqual(calls, ['https://www.mercadopago.com.br/subscriptions/detail/test-id']);
    else {
      assert.equal(plans.children.length, 3);
      assert.deepEqual(calls, []);
      await plans.children[1].onclick();
      assert.deepEqual(calls, ['pro']);
    }
  }
});
