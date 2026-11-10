const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const reader=require('../appbudfinance/js/contract-reader');
const sale=`Guia: entrada em até 72x. Veja um exemplo: 72 parcelas de R$ 69,44. Banco Itaú.
QUADRO RESUMO
5) DO PREÇO DO IMÓVEL E FORMA DE PAGAMENTO
5.1 O preço à vista válido para o 1º dia do mês de assinatura deste Contrato é de R$ R$ 200.000,00
PARCELA ATO: a TENDA receberá a quantia de R$ R$ 600,00 em parcela única.
PARCELA FINANCIAMENTO: Parcela no valor de R$ R$ 150.000,00 a ser paga em até 30 dias.
PARCELA TENDA PRÉ - CHAVES: Parcela(s) caracterizada(s) por 24 parcela(s) mensal(is) no valor de R$ R$ 800,5 cada uma.
CONDIÇÕES GERAIS vencendo-se a primeira em 09/11/2026.
PARCELA TENDA PRÉ - CHAVES INTERMEDIARIA: Parcela(s) caracterizada(s) por 2 com os seguintes vencimentos e valores:
1 Parcela Vencimento 05/07/2027 R$ 2.000,00
1 Parcela Vencimento 03/01/2028 R$ 3.000,00
PARCELA TENDA PÓS - OBRA: 84 parcela(s) mensal(is) e consecutivas no valor de R$ 90,75 cada uma, já acrescida de juros de 1,0% ao mês, vencendo a primeira em 05/11/2028.
6) DA CORREÇÃO MONETÁRIA E PERIODICIDADE`;
const rental=`CONTRATO DE LOCAÇÃO RESIDENCIAL
O prazo da locação é de (12) doze meses, a iniciar em 07/10/2026 e a terminar em 05/10/2027.
O Aluguel inicial ajustado para esta locação é de R$1.200,00 mensais, reajustado anualmente.
O aluguel será pago até o último dia útil de cada mês com tolerância até o dia 08 do mês subsequente ao vencido. Conta no banco Itaú.
Em caso de não pagamento, multa de 10% além de juros de 1% ao mês.`;
test('summary beats educational examples and separates builder blocks from bank financing',()=>{
 const r=reader.read(sale);assert.equal(r.components.length,6);assert.equal(r.precoImovel,200000);
 const pre=r.components.find(x=>x.label==='Parcelas pré-chaves').dados;
 assert.equal(pre.parcelas,24);assert.equal(pre.valorParcela,800.5);assert.equal(pre.valorTotal,19212);assert.equal(pre.vencimento,'2026-11-09');assert.equal(pre.instituicao,'Tenda');
 assert.deepEqual(reader.missing(pre),[]);
 const bank=r.components.find(x=>x.label.startsWith('Financiamento bancário')).dados;
 assert.equal(bank.valorTotal,150000);assert.equal(bank.parcelas,undefined);assert.equal(bank.instituicao,undefined);assert.equal(reader.missing(bank).length,3);
 const post=r.components.find(x=>x.label==='Parcelas pós-obra').dados;
 assert.equal(post.parcelas,84);assert.equal(post.juros,undefined);assert.equal(post.valorParcela,90.75);
 assert.equal(r.components.filter(x=>x.label.startsWith('Intermediária')).reduce((s,x)=>s+x.dados.valorTotal,0),5000);
});
test('rental reads base rent and term but never treats tolerance, bank account or late interest as loan terms',()=>{
 const r=reader.read(rental.replace(/ /g,'   '));assert.equal(r.tipo,'Aluguel');assert.equal(r.dados.valorParcela,1200);assert.equal(r.dados.parcelas,12);assert.equal(r.dados.valorTotal,14400);
 assert.equal(r.dados.inicioContrato,'2026-10-07');assert.equal(r.dados.vencimento,undefined);assert.equal(r.dados.juros,undefined);assert.equal(r.dados.instituicao,undefined);
 assert.deepEqual(reader.missing(r.dados),['data da primeira parcela']);assert.match(r.avisos.join(' '),/tolerância não é o vencimento/);
 assert.equal(reader.read('Documento sem condições financeiras.'),null);
 assert.ok(reader.missing({valorTotal:Infinity,parcelas:2,valorParcela:10,vencimento:'2026-02-30'}).includes('data da primeira parcela'));
});

function batchContext() {
 const source=fs.readFileSync('appbudfinance/js/dividas.js','utf8'),nodes=new Map(),ledger=new Map(),stats={transactions:0,failBefore:false,failAfter:false,closed:0,opened:[]};
 const components=reader.read(sale).components.map(b=>({...b,dados:{...b.dados,parcelasPagas:0},selecionado:false,salvo:false,edicoes:{},totalDerivado:b.dados.valorTotal===Math.round(b.dados.parcelas*b.dados.valorParcela*100)/100}));
 const ctx={window:{BudContractReader:reader,budShowToast:()=>{},budError:()=>{}},contratoExtraido:reader.read(sale),contratoBlocos:components,contratoFingerprint:'a'.repeat(64),contratoMensagem:'',salvandoBlocos:false,dadosIA:null,wizardTipo:'Financiamento',wizardTipoIcone:'🏠',currentUser:{uid:'test'},db:{},
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{style:{},value:'0',disabled:false});return nodes.get(id);}},
 fmtIA:v=>String(v),formatDataBR:v=>v.split('-').reverse().join('/'),parseDataBR:v=>{const p=v.split('/');if(p.length!==3)return null;const iso=p.reverse().join('-');return reader.missing({valorTotal:1,valorParcela:1,parcelas:1,vencimento:iso}).length?null:iso;},parseMoeda:v=>Number(v.replace(/\./g,'').replace(',','.')),
 escapeHTML:v=>String(v),calcularConfiancaExtracao:()=>50,addDoc:async()=>{throw Error('batch must not use addDoc');},collection:()=>({}),doc:(...args)=>args.slice(1).join('/'),serverTimestamp:()=>null,fecharTodosModais:()=>{stats.closed++;},abrirModal:id=>stats.opened.push(id),
 runTransaction:async(db,callback)=>{stats.transactions++;const writes=[];const result=await callback({get:async ref=>({exists:()=>ledger.has(ref)}),set:(ref,data)=>writes.push([ref,data])});if(stats.failBefore)throw Error('offline');writes.forEach(([ref,data])=>ledger.set(ref,data));if(stats.failAfter)throw Error('uncertain acknowledgement');return result;}};
 vm.createContext(ctx);
 const a=source.indexOf('function mostrarPreviewIA('),b=source.indexOf('function animarStepsIA(',a);const maskStart=source.indexOf('function aplicarMascaraData('),maskEnd=source.indexOf('\nfunction ',maskStart+10);vm.runInContext(source.slice(maskStart,maskEnd)+source.slice(a,b),ctx);
 return {ctx,nodes,ledger,stats,source};
}

test('multiple selection saves complete obligations atomically, leaving pending edits selected',async()=>{
 const {ctx,nodes,ledger,stats}=batchContext();vm.runInContext('mostrarPreviewIA({}, {confianca:0})',ctx);
 assert.match(nodes.get('iaResultado').innerHTML,/selecione uma ou várias/);assert.equal(nodes.get('btnSalvarBlocosContrato').disabled,true);
 ctx.window._contratoMarcar('todas');assert.equal(reader.plan(ctx.contratoBlocos).ready.length,4);assert.equal(reader.plan(ctx.contratoBlocos).incomplete.length,2);
 ctx.window._contratoEditarCampo(1,'parcelas','120');
 await Promise.all([ctx.window._salvarBlocosContrato(),ctx.window._salvarBlocosContrato()]);
 assert.equal(stats.transactions,1);assert.equal(ledger.size,4);
 assert.deepEqual([...ledger.values()].map(x=>x.parcelas),[24,1,1,84]);
 assert.deepEqual([...ledger.values()].map(x=>x.valorTotal),[19212,2000,3000,7623]);
 assert.ok([...ledger.values()].every(x=>x.importacaoContrato==='a'.repeat(64)));
 assert.equal(ctx.contratoBlocos[1].dados.parcelas,120);assert.equal(ctx.contratoBlocos[1].edicoes.parcelas,'120');assert.equal(ctx.contratoBlocos[1].selecionado,true);assert.equal(ctx.contratoBlocos[1].salvo,false);
 assert.equal(ctx.contratoBlocos[2].salvo,true);assert.equal(nodes.get('btnSalvarBlocosContrato').disabled,true);
 ctx.window._contratoEditarCampo(0,'vencimento','02/01/2027');ctx.window._contratoEditarCampo(0,'parcelasPagas','1');
 await ctx.window._salvarBlocosContrato();assert.equal(ledger.size,5);assert.equal([...ledger.values()].find(x=>x.blocoContrato===0).valorPago,600);
 ctx.window._contratoEditarCampo(1,'valorParcela','900,00');ctx.window._contratoEditarCampo(1,'vencimento','05/02/2027');
 await ctx.window._salvarBlocosContrato();assert.equal(ledger.size,6);assert.equal(reader.plan(ctx.contratoBlocos).ready.length,0);
});

test('failed commit writes nothing; uncertain response retry does not duplicate or overwrite an existing block',async()=>{
 const {ctx,ledger,stats,nodes}=batchContext();ctx.window._contratoMarcar('completas');stats.failBefore=true;
 await ctx.window._salvarBlocosContrato();assert.equal(ledger.size,0);assert.equal(stats.closed,0,'failed save keeps popup available');assert.equal(reader.plan(ctx.contratoBlocos).ready.length,4);assert.equal(ctx.salvandoBlocos,false);assert.equal(nodes.get('btnSalvarBlocosContrato').disabled,false);
 stats.failBefore=false;stats.failAfter=true;await ctx.window._salvarBlocosContrato();assert.equal(ledger.size,4);assert.equal(reader.plan(ctx.contratoBlocos).ready.length,4);
 const first=[...ledger.keys()][0];ledger.get(first).nome='Nome revisado pelo titular';stats.failAfter=false;await ctx.window._salvarBlocosContrato();
 assert.equal(ledger.size,4);assert.equal(ledger.get(first).nome,'Nome revisado pelo titular');assert.equal(reader.plan(ctx.contratoBlocos).ready.length,0);
});

test('editing is isolated per block, rejects bad paid counts and updates derived totals',()=>{
 const {ctx}=batchContext();ctx.window._contratoMarcar('completas');
 ctx.window._contratoEditarCampo(2,'valorParcela','850,00');assert.equal(ctx.contratoBlocos[2].dados.valorTotal,20400);assert.equal(ctx.contratoBlocos[5].dados.valorParcela,90.75);
 ctx.window._contratoEditarCampo(2,'parcelasPagas','25');assert.ok(reader.plan(ctx.contratoBlocos).incomplete.some(x=>x.index===2));
 ctx.window._contratoEditarCampo(2,'parcelasPagas','0');ctx.window._contratoEditarCampo(2,'vencimento','30/02/2027');assert.ok(reader.plan(ctx.contratoBlocos).incomplete.some(x=>x.index===2));
 ctx.window._contratoEditarCampo(2,'vencimento','28022027');assert.equal(ctx.contratoBlocos[2].edicoes.vencimento,'28/02/2027');assert.equal(ctx.contratoBlocos[2].dados.vencimento,'2027-02-28');assert.equal(ctx.document.getElementById('contrato_2_vencimento').value,'28/02/2027');ctx.window._contratoEditarCampo(2,'valorTotal','20.000,00');ctx.window._contratoEditarCampo(2,'valorParcela','860,00');assert.equal(ctx.contratoBlocos[2].dados.valorTotal,20000,'manually confirmed principal must not be replaced by parcel sum');
 ctx.window._contratoSelecionar(2,false);assert.ok(!reader.plan(ctx.contratoBlocos).ready.some(x=>x.index===2));
});

test('normalised document fingerprint is stable across whitespace, distinct for other contracts',async()=>{
 const a=await reader.fingerprint(sale),b=await reader.fingerprint(sale.replace(/ /g,'  '));assert.equal(a,b);assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,await reader.fingerprint(rental));
});

test('processing a new document resets batch state and does not leak it into a rental import',async()=>{
 const {ctx,source}=batchContext();ctx.animarStepsIA=()=>{};ctx.setTimeout=cb=>cb();ctx.classificarContrato=()=>({tipo:'Outro'});ctx.extrairDadosDoTexto=()=>({});ctx.mostrarPreviewIA=()=>{};
 const start=source.indexOf('async function processarTextoExtraido('),end=source.indexOf('// Classificação',start);vm.runInContext(source.slice(start,end),ctx);
 ctx.text=sale;await vm.runInContext('processarTextoExtraido(text)',ctx);assert.equal(ctx.contratoBlocos.length,6);assert.match(ctx.contratoFingerprint,/^[a-f0-9]{64}$/);
 ctx.text=rental;await vm.runInContext('processarTextoExtraido(text)',ctx);assert.equal(ctx.contratoBlocos.length,0);assert.equal(ctx.contratoFingerprint,'');assert.equal(ctx.wizardTipo,'Aluguel');
});

test('single rental preview retains manual review and blocks saving without actual first due date',async()=>{
 const {ctx,nodes}=batchContext();ctx.contratoExtraido=reader.read(rental);ctx.contratoBlocos=[];ctx.dadosIA={...ctx.contratoExtraido.dados};
 vm.runInContext('mostrarPreviewIA(dadosIA,{confianca:50})',ctx);assert.match(nodes.get('iaResultado').innerHTML,/id="btnSalvarIA" disabled/);
 await ctx.window.salvarDividaIA();
});



test('discarding a pending draft never deletes registered debts',async()=>{
 const {ctx,ledger,nodes}=batchContext();ctx.window._contratoMarcar('todas');await ctx.window._salvarBlocosContrato();assert.equal(ledger.size,4);ctx.window._descartarPendenciasContrato();assert.equal(ledger.size,4);assert.equal(ctx.contratoBlocos.length,0);assert.equal(nodes.get('avisoPendenciasContrato').style.display,'none');
});


test('consortium statement keeps actual payments and assembly dates apart from future due dates', () => {
  const text = 'Consórcio Honda Grupo/Cota/RD Lista de Pagamentos Valor devido';
  const layout = [
    'PARCELA | 33 | 18/10/2024 | 684,65 | 2,08 | 27/09/2024 | 684,65',
    'PARCELA | 33 | 18/10/2024 | 0,00 | 0,00 | 30/09/2024 | 12,00',
    'LANCE | 33 | 18/10/2024 | 15000,00 | 45,64 | 25/10/2024 | 5553,28',
    'PARCELA | 58 | 19/11/2026 | 536,75 | 1,46 | / / | 0,00',
  ].join('\n');
  const result = reader.read(text, layout);
  assert.equal(result.tipo, 'Consórcio');
  assert.deepEqual(result.historicoConsorcio.map(row => row.valor), [684.65,12]);
  const upcoming = result.components[0].dados;
  assert.equal(upcoming.valorParcela,536.75);
  assert.equal(upcoming.vencimento,undefined);
  assert.equal(upcoming.parcelas,undefined);
  assert.equal(reader.plan([{selecionado:true,dados:upcoming}]).ready.length,0);
  const reviewed = {...upcoming, parcelas:2, valorTotal:1073.50, vencimento:'2026-11-20'};
  assert.equal(reader.plan([{selecionado:true,dados:reviewed}]).ready.length,1);
});
