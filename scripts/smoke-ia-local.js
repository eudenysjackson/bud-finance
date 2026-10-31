// Testes reais da integração, somente com conta e documentos fictícios locais.
// node --env-file=backend/.env.local scripts/smoke-ia-local.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
if (process.env.BUD_USE_EMULATOR !== 'true') throw new Error('Exige emuladores locais.');
async function main() {
  const admin = require('../backend/node_modules/firebase-admin');
  // Fixa os hosts locais: nunca permitir que este teste use o banco público.
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  admin.initializeApp({ projectId: 'bud-finance-local' });
  let user;
  try { user = await admin.auth().getUserByEmail('homologacao@bud.local'); }
  catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await admin.auth().createUser({ email: 'homologacao@bud.local', password: 'BudLocal@2026', displayName: 'Homologação Bud', emailVerified: true });
    await admin.firestore().collection('usuarios').doc(user.uid).set({ email: user.email, nome: 'Homologação Bud', plano: 'plus', status: 'ativo', onboardingConcluido: true });
  }
  const login=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'homologacao@bud.local',password:'BudLocal@2026',returnSecureToken:true})});
  const session=await login.json(); assert.ok(session.idToken,'Conta de homologação necessária');
  const headers={Authorization:'Bearer '+session.idToken};
  async function call(name,route,body,check) {
    if (process.argv.length > 2 && !process.argv.slice(2).includes(name)) return;
    const startedAt = Date.now();
    const json=!(body instanceof FormData);
    const r=await fetch('http://127.0.0.1:3000'+route,{method:'POST',headers:{...headers,'X-Bud-Async':'1',...(json?{'Content-Type':'application/json'}:{})},body:json?JSON.stringify(body):body,signal:AbortSignal.timeout(90000)});
    let d=await r.json(), status=r.status;
    if (status === 202) {
      const deadline=Date.now()+20*60_000;
      while (Date.now()<deadline) {
        await new Promise(resolve=>setTimeout(resolve,1500));
        const response=await fetch('http://127.0.0.1:3000/api/ia/jobs/'+d.jobId,{headers});
        assert.equal(response.status,200,'Consulta do trabalho');
        const job=await response.json();
        if(job.state!=='running'){status=job.status;d=job.result;break;}
      }
    }
    assert.equal(status,200,name+': '+JSON.stringify(d)); check?.(d); console.log('PASS',name,'elapsedMs='+ (Date.now()-startedAt),JSON.stringify(d));
  }
  function upload(bytes,mime,field='arquivo',tipo) {const f=new FormData();f.append(field,new Blob([bytes],{type:mime}),'teste.'+(mime==='application/pdf'?'pdf':'png'));if(tipo)f.append('tipo',tipo);return f;}
  const fatura=fs.readFileSync('tests/fixtures/ia/fatura.pdf');
  await call('Fatura direta','/api/extrair-fatura',upload(fs.readFileSync('tests/fixtures/ia/nubank-layout.pdf'),'application/pdf','arquivo','fatura'),d=>{assert.equal(d.method,'nubank-validated');assert.equal(d.transacoes.length,24);assert.equal(d.transacoes.reduce((s,t)=>s+t.valor,0),300);});
  await call('Fatura PDF','/api/extrair-fatura',upload(fatura,'application/pdf','arquivo','fatura'),d=>{assert.equal(d.transacoes.length,2);assert.equal(d.transacoes.reduce((s,t)=>s+Number(t.valor),0),75);});
  await call('Cupom texto','/api/extrair-cupom',{texto:'MERCADO TESTE 24/10/2026\n001 ARROZ 1 UN x 10,00 10,00\n002 LEITE 2 UN x 5,00 10,00\nTOTAL R$ 20,00'},d=>{assert.equal(d.itens.length,2);assert.equal(d.itens.reduce((s,t)=>s+Number(t.valor),0),20);});
  const png=fs.readFileSync('tests/fixtures/ia/cupom.png');
  await call('Cupom imagem','/api/extrair-cupom',upload(png,'image/png','arquivos'),d=>assert.equal(d.itens.length,2));
  await call('Fatura imagem','/api/extrair-fatura',upload(png,'image/png','arquivo','fatura'),d=>{assert.equal(d.transacoes.length,2);assert.equal(d.transacoes.reduce((s,t)=>s+Number(t.valor),0),20);});
  const extrato=fs.readFileSync('tests/fixtures/ia/extrato.png');
  await call('Extrato imagem','/api/extrair-fatura',upload(extrato,'image/png','arquivo','extrato'),d=>{assert.equal(d.transacoes.length,2);assert.equal(d.transacoes.find(t=>t.tipo==='credito')?.valor,100);assert.equal(d.transacoes.find(t=>t.tipo==='debito')?.valor,25);});
  const scanned=fs.readFileSync('tests/fixtures/ia/escaneado.pdf');
  await call('PDF escaneado','/api/extrair-cupom',upload(scanned,'application/pdf','arquivos'),d=>assert.equal(d.itens.reduce((s,t)=>s+Number(t.valor),0),20));
  const largePath='tests/fixtures/ia/fatura-longa.pdf';
  if(fs.existsSync(largePath)) await call('Fatura longa','/api/extrair-fatura',upload(fs.readFileSync(largePath),'application/pdf','arquivo','fatura'),d=>{assert.equal(d.transacoes.length,24);assert.equal(d.transacoes.reduce((s,t)=>s+Number(t.valor),0),300);});
  // Classificador e chat pertencem ao Buddy futuro. Executar apenas quando explicitamente selecionados.
  if (process.argv.length <= 2) return;
  await call('Documento PDF','/api/analisar-documento',upload(fatura,'application/pdf'),d=>assert.equal(d.tipo,'fatura_cartao'));
  await call('Documento imagem','/api/analisar-documento',upload(png,'image/png'),d=>assert.equal(d.tipo,'cupom_fiscal'));
  await call('Chat (infraestrutura futura)','/api/chat',{messages:[{role:'user',content:'Responda somente OK. Teste de conexão.'}],contexto:{}});
}
main().then(()=>require('../backend/node_modules/firebase-admin').app().delete()).catch(e=>{console.error(e.message);process.exit(1);});
