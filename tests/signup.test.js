const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('appbudfinance/js/cadastro.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const protectedFields=[...rules.slice(rules.indexOf('function billingFields()'),rules.indexOf('match /usuarios')).matchAll(/'([^']+)'/g)].map(x=>x[1]);
function setup({orphan=false,existing=false,emailSent=true}={}){
 let handler,writes=0,emails=0,signins=0;
 const messages=[],nodes={verificationEmailStatus:{textContent:''}};
 const user={uid:'test-owner',getIdToken:async()=>'test-token'};
 const context={form:{addEventListener:(_,fn)=>handler=fn},nomeInput:{value:'Pessoa Teste'},emailInput:{value:'signup@example.test'},telefoneInput:{value:'21999999999'},novaSenhaInput:{value:'SenhaTeste@2026'},confirmarInput:{value:'SenhaTeste@2026'},codigoInput:{value:''},lgpdCheckbox:{checked:true},btn:{},
 window:{budSanitize:x=>x,BUD_SENHAS_COMUNS:[],budCalcStrength:()=>4,budShowToast:(...args)=>messages.push(args)},isEmailValido:()=>true,getRecaptchaToken:async()=>'token',auth:{},db:{},
 createUserWithEmailAndPassword:async()=>{if(orphan||existing)throw Object.assign(Error('used'),{code:'auth/email-already-in-use'});return{user};},
 signInWithEmailAndPassword:async()=>{signins++;return{user};},getDoc:async()=>({exists:()=>existing}),updateProfile:async()=>{},signOut:async()=>{},gerarMatricula:()=>'TEST-001',gerarCodigoIndicacao:()=>'REF-001',serverTimestamp:()=>1,
 doc:(_,collection,uid)=>{assert.equal(collection,'usuarios');assert.equal(uid,user.uid);return uid;},setDoc:async(_,data)=>{assert.ok(!Object.keys(data).some(x=>protectedFields.includes(x)),'Signup payload violates deployed profile rules');writes++;},
 enviarEmailBoasVindas:async()=>{emails++;return emailSent;},fetch:async()=>({ok:true}),showMatriculaEl:{},formSection:{classList:{add(){}}},successSection:{classList:{add(){}}},location:{search:''},URLSearchParams,document:{getElementById:id=>nodes[id]||null},resetBtn(){}};
 vm.runInNewContext(source.slice(source.indexOf("form.addEventListener('submit'")),context);
 return{run:()=>handler({preventDefault(){}}),result:()=>({writes,emails,signins,messages,status:nodes.verificationEmailStatus.textContent})};
}
test('signup profile respects deployed billing-field protection and requests verification',async()=>{const s=setup();await s.run();assert.equal(s.result().writes,1);assert.equal(s.result().emails,1);});
test('interrupted Auth-only signup resumes after password authentication',async()=>{const s=setup({orphan:true});await s.run();assert.equal(s.result().signins,1);assert.equal(s.result().writes,1);assert.equal(s.result().emails,1);});
test('signup never overwrites an existing customer profile',async()=>{const s=setup({existing:true});await s.run();assert.equal(s.result().writes,0);assert.equal(s.result().emails,0);assert.match(s.result().messages[0][0],/já está cadastrado/);});
test('mail failure preserves created profile and shows persistent resend instructions',async()=>{const s=setup({emailSent:false});await s.run();assert.equal(s.result().writes,1);assert.match(s.result().status,/não foi confirmado/);assert.match(s.result().status,/novo código/);});
