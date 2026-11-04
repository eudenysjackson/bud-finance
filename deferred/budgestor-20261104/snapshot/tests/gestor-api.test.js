const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createGestorAPI}=require('../backend/gestor-api');
function fixture(){
 const data=new Map([['admins/admin',{role:'admin'}],['usuarios/admin',{fcmTokens:['personal-token'],pushEnabled:true}]]);
 const doc=path=>({path,get:async()=>({exists:data.has(path),data:()=>data.get(path)})});
 const db={collection:name=>({doc:id=>doc(name+'/'+id)}),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>data.set(r.path,v)})};
 const api=createGestorAPI({db}),response=()=>({code:200,status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
 const invoke=async(user,method='POST',body={token:'a'.repeat(30),consent:true})=>{const r=response();await api.devices({budUser:user,method,body},r);return r;};
 return{data,invoke,api,response};
}
test('Gestor registration requires a verified administrator, never a customer or body UID',async()=>{
 const f=fixture();assert.equal((await f.invoke({uid:'customer',email_verified:true})).code,403);assert.equal((await f.invoke({uid:'admin',email_verified:false})).code,403);
 assert.equal((await f.invoke({uid:'admin',email_verified:true},'POST',{uid:'customer',token:'a'.repeat(30),consent:true})).code,200);
 assert(f.data.has('_gestor_devices/admin'));assert(!f.data.has('_gestor_devices/customer'));assert.deepEqual(f.data.get('usuarios/admin').fcmTokens,['personal-token']);
});
test('Gestor device revocation removes only that administrative device',async()=>{
 const f=fixture(),user={uid:'admin',email_verified:true};await f.invoke(user);await f.invoke(user,'POST',{token:'b'.repeat(30),consent:true});
 await f.invoke(user,'DELETE',{token:'a'.repeat(30)});assert.equal(Object.keys(f.data.get('_gestor_devices/admin').tokens).length,1);assert.equal(f.data.get('usuarios/admin').pushEnabled,true);
 assert.equal((await f.invoke(user,'POST',{token:'c'.repeat(30)})).code,400);
});
test('named administrative Firebase app never adopts the existing customer app',()=>{
 const source=fs.readFileSync('appbudfinance/js/admin.js','utf8'),code=source.match(/const app = .*;/)[0];
 const customer={name:'[DEFAULT]',user:'personal'},apps=[customer],context={getApps:()=>apps,window:{BUD_GESTOR_FIREBASE_CONFIG:{}},initializeApp:(_,name)=>{const a={name,user:null};apps.push(a);return a;}};
 assert.equal(vm.runInNewContext(code+'app.name;',context),'bud-gestor');assert.equal(customer.user,'personal');assert.equal(apps.length,2);
 assert(!fs.readFileSync('budgestor/index.html','utf8').includes('bud-utils.js'));assert(!fs.readFileSync('budgestor/index.html','utf8').includes('app-shell.js'));
});
test('old admin route redirects without initializing customer Auth and new push scope stays independent',()=>{
 const old=fs.readFileSync('appbudfinance/admin.html','utf8'),manifest=JSON.parse(fs.readFileSync('budgestor/manifest.json'));
 assert.match(old,/location.replace\("\/budgestor\//);assert(!old.includes('firebase'));assert.equal(manifest.scope,'/budgestor/');assert.equal(manifest.start_url,'/budgestor/');
});

test('FCM configuration uses a distinct registered Web App, not only an Auth name',()=>{const context={self:{},Object};vm.runInNewContext(fs.readFileSync('budgestor/config.js','utf8'),context);assert.equal(context.self.BUD_GESTOR_FIREBASE_CONFIG.projectId,'bud-finance');assert.notEqual(context.self.BUD_GESTOR_FIREBASE_CONFIG.appId,'1:825768884924:web:551a6da252d8d249dd2eb9');assert.match(fs.readFileSync('budgestor/sw.js','utf8'),/BUD_GESTOR_FIREBASE_CONFIG/);});
