const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {buildConfig}=require('../scripts/inject-config');
const template=fs.readFileSync('appbudfinance/js/firebase-config.example.js','utf8');
const env={FIREBASE_API_KEY:'public-key\r\n',FIREBASE_AUTH_DOMAIN:'example.firebaseapp.com\n',FIREBASE_PROJECT_ID:'example\n',FIREBASE_STORAGE_BUCKET:'example.appspot.com\n',FIREBASE_MESSAGING_SENDER_ID:'123\n',FIREBASE_APP_ID:'example-app\n',BACKEND_URL:'https://backend.example/\n'};
test('build trims pasted line endings and escapes optional values without executing them',()=>{
 const window={},source=buildConfig(template,{...env,RECAPTCHA_SITE_KEY:'a"; window.injected=true; "b'});vm.runInNewContext(source,{window,console});
 assert.equal(window.BUD_FIREBASE_CONFIG.authDomain,'example.firebaseapp.com');assert.equal(window.BUD_FUNCTIONS_URL,'https://backend.example');assert.equal(window.injected,undefined);assert.equal(window.BUD_RECAPTCHA_SITE_KEY,'a"; window.injected=true; "b');
});
test('missing required configuration fails without exposing environment values',()=>{
 assert.throws(()=>buildConfig(template,{...env,FIREBASE_PROJECT_ID:''}),/Variáveis ausentes: FIREBASE_PROJECT_ID/);
 assert.throws(()=>buildConfig(template,{...env,BACKEND_URL:'http://remote.example'}),/HTTPS/);
});
