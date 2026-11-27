const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createMarketingPreferences}=require('../backend/marketing-preferences');
const secret='fictional-marketing-secret-not-a-production-key';
function setup({rows=new Map(),readError=false,writeError=false,key=secret}={}){
 let writes=0;
 const db={collection(name){assert.equal(name,'_marketing_suppressions');return{doc(id){return{
  async get(){if(readError)throw Error('storage');return{exists:rows.has(id),data:()=>rows.get(id)};},
  async set(data){if(writeError)throw Error('storage');rows.set(id,data);writes++;}
 };}};}};
 return {api:createMarketingPreferences({db,secret:key,frontendURL:'https://budsolucoes.com.br/appbudfinance',now:()=>100}),rows,writes:()=>writes};
}
function response(){return{code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
const token=value=>new URLSearchParams(new URL(value.unsubscribeURL).hash.slice(1)).get('token');
test('marketing link exposes no address and tampering cannot write a suppression',async()=>{
 const s=setup(),p=await s.api.prepare('  CLIENT@example.test  ');
 assert(!p.unsubscribeURL.includes('CLIENT'));assert(!p.unsubscribeURL.includes('@'));assert(new URL(p.unsubscribeURL).hash);
 const r=response();await s.api.unsubscribe({body:{token:token(p).slice(0,-1)+'z'}},r);assert.equal(r.code,400);assert.equal(s.writes(),0);
});
test('unsubscribe persists across service restart and secret rotation, without touching accounts or billing',async()=>{
 const s=setup(),p=await s.api.prepare('client@example.test');
 for(let i=0;i<2;i++){const r=response();await s.api.unsubscribe({body:{token:token(p)}},r);assert.equal(r.body.unsubscribed,true);assert.equal(r.headers['Cache-Control'],'no-store');}
 const second=setup({rows:s.rows,key:'rotated-secret'});assert.equal((await second.api.prepare('CLIENT@example.test')).allowed,false);
 assert.equal(s.rows.size,1);assert.deepEqual([...s.rows.values()][0],{unsubscribed:true,updatedAt:100});
 assert.equal((await s.api.prepare('other@example.test')).allowed,true);
});
test('storage failures never report successful opt out and block marketing preparation',async()=>{
 const s=setup({writeError:true}),p=await s.api.prepare('client@example.test'),r=response();
 await s.api.unsubscribe({body:{token:token(p)}},r);assert.equal(r.code,503);assert(!r.body.unsubscribed);
 await assert.rejects(()=>setup({readError:true}).api.prepare('client@example.test'));
 await assert.rejects(()=>setup({key:''}).api.prepare('client@example.test'));
});
test('personalization inserts a signed link and suppression returns no rendered campaign',async()=>{
 const s=setup(),message={html:'<a href="{{unsubscribe_url}}">Descadastrar</a>',text:'{{unsubscribe_url}}'};
 const result=await s.api.render('client@example.test',message);assert(result.allowed);assert(!result.html.includes('{{'));assert.match(result.text,/#token=m1\./);
 const p=await s.api.prepare('client@example.test');await s.api.unsubscribe({body:{token:token(p)}},response());
 assert.deepEqual(await s.api.render('client@example.test',message),{allowed:false});
});
test('actual EmailJS entry suppresses marketing while preserving transactional messages',async()=>{
 const source=fs.readFileSync('backend/server.js','utf8'),start=source.indexOf('async function sendEmailViaEmailJS('),end=source.indexOf('\nfunction sendCommunicationEmail',start);
 let sent=0,prepared=0;
 const context={marketingPreferences:{prepare:async()=>{prepared++;return{allowed:false};}},EMAILJS_TEMPLATE_ID:'test',EMAILJS_PUBLIC_KEY:'test',EMAILJS_SERVICE_ID:'test',EMAILJS_PRIVATE_KEY:'',AbortSignal,fetch:async()=>{sent++;return{ok:true};}};
 vm.runInNewContext(source.slice(start,end),context);
 const skipped=await context.sendEmailViaEmailJS({to_email:'client@example.test',email_category:'marketing'});
 assert.equal(skipped.skipped,true);assert.equal(sent,0);
 await context.sendEmailViaEmailJS({to_email:'client@example.test',email_category:'transactional'});
 assert.equal(sent,1);assert.equal(prepared,1);
});
test('preference page never changes data on load and retains retry on failed persistence',async()=>{
 let click,posts=0,replaced=false;
 const button={addEventListener(_,fn){click=fn;}},status={dataset:{}},title={},intro={};
 const s=setup(),p=await s.api.prepare('qa@example.test');
 const context={URLSearchParams,AbortController,setTimeout,clearTimeout,location:{hash:new URL(p.unsubscribeURL).hash,pathname:'/preferencias-email'},window:{BUD_FUNCTIONS_URL:'http://127.0.0.1:3000'},history:{replaceState(){replaced=true;}},document:{getElementById:id=>id==='unsubscribe'?button:id==='unsubscribeIntro'?intro:status,querySelector:()=>title},fetch:async()=>{posts++;return{ok:posts>1,json:async()=>posts>1?{unsubscribed:true}:{error:'Falha simulada'}};}};
 vm.runInNewContext(fs.readFileSync('appbudfinance/js/email-preferences.js','utf8'),context);
 assert.equal(posts,0);await click();assert.equal(button.disabled,false);assert.equal(replaced,false);assert.equal(status.dataset.error,'true');
 await click();assert.equal(button.hidden,true);assert.equal(replaced,true);assert.match(title.textContent,/confirmado/);assert.equal(intro.hidden,true);
});
