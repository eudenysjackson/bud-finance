const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('../appbudfinance/js/goal-purchase');
function fixture(){
 const state=new Map([['usuarios/u/metas/g',{nome:'Compra',tipoMeta:'compra',valorAtual:200,valorAlvo:1000}],['usuarios/u/carteira/a',{nome:'Conta',tipo:'debito',saldo:500}],['usuarios/u/carteira/c',{nome:'Cartão',tipo:'credito',limite:1000,fechamento:10,vencimento:17}]]);let seq=0,fail=false;
 const doc=(...p)=>p.length===1?{path:p[0]+'/t'+(++seq),id:'t'+seq}:{path:p.slice(1).join('/'),id:p.at(-1)};
 const service=api.createService({db:{},doc,collection:(_, ...p)=>p.join('/'),Timestamp:{fromDate:d=>d},serverTimestamp:()=>123,loadCharges:async()=>[...state.keys()].filter(k=>k.includes('/transacoes/')).map(path=>({ref:{path}})),runTransaction:async(_,cb)=>{const ops=[];let writes=false;const tx={get:async r=>{assert.equal(writes,false);const v=state.get(r.path);return {exists:()=>v!==undefined,data:()=>structuredClone(v)};},set:(r,v)=>{writes=true;ops.push(['s',r.path,v]);},update:(r,v)=>{writes=true;ops.push(['u',r.path,v]);}};const out=await cb(tx);if(fail)throw Error('Falha de commit');for(const [op,p,v]of ops)state.set(p,op==='u'?{...state.get(p),...v}:v);return out;}});
 return {state,service,get:(c,id)=>state.get('usuarios/u/'+c+'/'+id),rows:c=>[...state].filter(([k])=>k.includes('/'+c+'/')).map(([,v])=>v),fail:()=>fail=true};
}
const request={date:'2026-11-02',total:1000,reserve:200,parts:[{accountId:'a',value:300,installments:1},{accountId:'c',value:500,installments:3}]};
test('mixed purchase consumes reserve once, debits account, creates exact installments and retains history',async()=>{const f=fixture();await f.service.save({uid:'u',goalId:'g',request,confirm:true});assert.equal(f.get('carteira','a').saldo,200);assert.equal(f.get('metas','g').valorAtual,0);assert.equal(f.rows('transacoes').length,4);const credit=f.rows('transacoes').filter(t=>t.cartaoId);assert.deepEqual(credit.map(t=>t.valor),[166.67,166.67,166.66]);assert.deepEqual(credit.map(t=>t.dataReferencia),['2026-11-17','2026-12-17','2027-01-17']);assert.equal(f.get('compras-metas','g').parts.length,2);assert.equal(api.available({id:'c',...f.get('carteira','c')},f.rows('transacoes')),500);});
test('planning does not debit, create expenses or consume reserve and can remain incomplete',async()=>{const f=fixture();await f.service.save({uid:'u',goalId:'g',request:{...request,parts:[]},confirm:false});assert.equal(f.get('carteira','a').saldo,500);assert.equal(f.get('metas','g').valorAtual,200);assert.equal(f.rows('transacoes').length,0);assert.equal(f.get('metas','g').planoCompra.reserve,200);});
test('repeated confirmation after success or uncertain response cannot duplicate purchase',async()=>{const f=fixture();await f.service.save({uid:'u',goalId:'g',request,confirm:true});assert.deepEqual(await f.service.save({uid:'u',goalId:'g',request,confirm:true}),{already:true});assert.equal(f.rows('transacoes').length,4);assert.equal(f.get('carteira','a').saldo,200);});
test('bad sum, insufficient balance, limit and missing account fail without partial effects',async()=>{for(const change of [r=>r.parts[0].value=1,r=>r.parts[0].value=600,r=>r.parts[1].value=1100,r=>r.parts[0].accountId='gone']){const f=fixture(),r=structuredClone(request);change(r);if(r.parts[0].value===600){r.parts[1].value=200;}if(r.parts[1].value===1100){r.total=1600;}const before=structuredClone([...f.state]);await assert.rejects(f.service.save({uid:'u',goalId:'g',request:r,confirm:true}));assert.deepEqual([...f.state],before);}});
test('failed commit leaves all financial records unchanged for retry',async()=>{const f=fixture(),before=structuredClone([...f.state]);f.fail();await assert.rejects(f.service.save({uid:'u',goalId:'g',request,confirm:true}),/commit/);assert.deepEqual([...f.state],before);});
test('invoice payment restores only its installment credit and financed reservations stay committed',()=>{const card={id:'c',limite:1000,limiteReservado:100,faturasPagas:{'2026-11':true}};assert.equal(api.available(card,[{cartaoId:'c',dataReferencia:'2026-11-17',valor:200},{cartaoId:'c',dataReferencia:'2026-12-17',valor:300}]),600);});
test('billing dates respect closing, next year and short months',()=>{assert.equal(api.schedule({fechamento:25,vencimento:5},'2026-12-24',50,1)[0].date,'2027-01-05');assert.equal(api.schedule({fechamento:25,vencimento:5},'2026-12-25',50,1)[0].date,'2027-02-05');assert.equal(api.schedule({fechamento:20,vencimento:31},'2026-02-01',50,1)[0].date,'2026-02-28');assert.throws(()=>api.schedule({fechamento:10,vencimento:17},'2026-02-30',50,1));});
test('deposit keeps negative account allowed, appears as dated account expense, history and goal commit together',async()=>{const f=fixture();f.get('carteira','a').saldo=0;await f.service.deposit({uid:'u',goalId:'g',accountId:'a',value:200,date:'2026-11-02',operationId:'dep'});assert.equal(f.get('carteira','a').saldo,-200);assert.equal(f.get('metas','g').valorAtual,400);const [t]=f.rows('transacoes');assert.equal(t.categoria,'Metas');assert.equal(t.carteiraId,'a');assert.equal(t.dataReferencia,'2026-11-02');assert(t.data instanceof Date);await f.service.deposit({uid:'u',goalId:'g',accountId:'a',value:200,date:'2026-11-02',operationId:'dep'});assert.equal(f.get('carteira','a').saldo,-200);assert.equal(f.rows('transacoes').length,1);});
test('fresh goal state prevents deposits after goal achieved or purchase completed',async()=>{for(const props of [{valorAtual:1000},{compraRealizada:{total:1000}},{valorAtual:990}]){const f=fixture();Object.assign(f.get('metas','g'),props);const before=structuredClone([...f.state]);await assert.rejects(f.service.deposit({uid:'u',goalId:'g',accountId:'a',value:200,date:'2026-11-02',operationId:'dep'}));assert.deepEqual([...f.state],before);}});
test('account statement includes legacy and new deposits and excludes card expenses and other accounts',()=>{const source=fs.readFileSync('appbudfinance/js/extrato.js','utf8'),start=source.indexOf('function pertenceContaExtrato('),end=source.indexOf('let usuarioAtualId',start),context={contaExtratoId:'a'};vm.runInNewContext(source.slice(start,end),context);assert(context.pertenceContaExtrato({carteiraId:'a',origem:'meta'}));assert(context.pertenceContaExtrato({contaId:'a'}));assert(!context.pertenceContaExtrato({carteiraId:'b'}));assert(!context.pertenceContaExtrato({cartaoId:'c',carteiraId:'a'}));});
test('two credit cards keep independent schedules and full commitments',async()=>{const f=fixture();f.state.set('usuarios/u/carteira/c2',{tipo:'credito',nome:'Outro cartão',limite:800,fechamento:25,vencimento:5});await f.service.save({uid:'u',goalId:'g',confirm:true,request:{date:'2026-11-20',total:1000,reserve:0,parts:[{accountId:'c',value:600,installments:2},{accountId:'c2',value:400,installments:4}]}});assert.equal(f.rows('transacoes').length,6);assert.equal(f.rows('transacoes').find(t=>t.cartaoId==='c').dataReferencia,'2026-12-17');assert.equal(f.rows('transacoes').find(t=>t.cartaoId==='c2').dataReferencia,'2026-12-05');assert.equal(f.get('carteira','a').saldo,500);assert.equal(api.available({id:'c2',...f.get('carteira','c2')},f.rows('transacoes')),400);});
test('reserve changes after planning are rechecked at confirmation',async()=>{const f=fixture();await f.service.save({uid:'u',goalId:'g',request,confirm:false});f.get('metas','g').valorAtual=100;const before=structuredClone([...f.state]);await assert.rejects(f.service.save({uid:'u',goalId:'g',request,confirm:true}),/reserva mudou/);assert.deepEqual([...f.state],before);});


test('reported purchase creates eight installments from December through July',async()=>{const f=fixture();Object.assign(f.get('carteira','c'),{fechamento:1,vencimento:10});await f.service.save({uid:'u',goalId:'g',confirm:true,request:{date:'2026-11-02',total:600,reserve:100,parts:[{accountId:'c',value:500,installments:8}]}});const rows=f.rows('transacoes');assert.equal(rows.length,8);assert(rows.every(t=>t.valor===62.5));assert.deepEqual(rows.map(t=>t.dataReferencia),['2026-12-10','2027-01-10','2027-02-10','2027-03-10','2027-04-10','2027-05-10','2027-06-10','2027-07-10']);});


test('manual card form stores purchase date separately and bills each installment in its cycle', async () => {
  const source = fs.readFileSync('appbudfinance/js/cartoes.js', 'utf8');
  const start = source.indexOf('function dadosDataGasto(');
  const end = source.indexOf('\nfunction ', source.indexOf('async function handleSubmitGasto(', start) + 1);
  const fields = { inputDescGasto: { value: 'Compra' }, inputValorGasto: { value: '100' },
    dpGastoHidden: { value: '2026-12-08' }, btnSalvarGasto: {}, hiddenCatGasto: {},
    toggleParcelado: { checked: true }, inputNParcelas: { value: '3' } };
  const rows = [];
  const card = { id: 'c', fechamento: 5, vencimento: 12 };
  const context = { cartaoParaGasto: 'c', cartoesGlobal: [card], gastoEditandoId: null,
    document: { getElementById: id => fields[id] }, window: { BudGoalPurchase: api },
    parseBRL: Number, budSanitize: s => s, db: {}, uid: 'u',
    Timestamp: { fromDate: date => date }, serverTimestamp: () => 1,
    doc() {}, collection() {}, writeBatch: () => ({ set: (_, row) => rows.push(row), commit: async () => {} }),
    showToast(message, kind) { assert.equal(kind, 'ok', message); }, fecharModalGasto() {}, MESES_PT: [],
    transacoesGlobal: [], updateDoc: async (_, row) => rows.push(row),
  };
  vm.runInNewContext(source.slice(start, end), context);
  const submit = () => context.handleSubmitGasto({ preventDefault() {} });
  await submit();
  assert.deepEqual(rows.map(row => row.dataReferencia), ['2027-01-12', '2027-02-12', '2027-03-12']);
  assert(rows.every(row => row.dataCompra === '2026-12-08'));
  assert.equal(rows.reduce((cents, row) => cents + Math.round(row.valor * 100), 0), 10000);
  fields.toggleParcelado.checked = false;
  fields.dpGastoHidden.value = '2026-12-04';
  await submit();
  assert.equal(rows.at(-1).mesReferencia, '2026-12');
  fields.dpGastoHidden.value = '2026-12-05';
  await submit();
  assert.equal(rows.at(-1).mesReferencia, '2027-01');
  context.gastoEditandoId = 'legacy';
  context.transacoesGlobal = [{ id: 'legacy', origem: 'manual', dataReferencia: '2026-12-08' }];
  fields.dpGastoHidden.value = '2026-12-08';
  await submit();
  assert.equal(rows.at(-1).dataReferencia, '2027-01-12');
  assert.equal(rows.at(-1).dataCompra, '2026-12-08');
});
