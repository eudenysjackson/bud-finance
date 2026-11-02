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
test('preview requires block selection, save rejects missing essentials and persists only the chosen block',async()=>{
 const source=fs.readFileSync('appbudfinance/js/dividas.js','utf8'), nodes=new Map(),saved=[];
 const ctx={window:{BudContractReader:reader,budShowToast:()=>{}},contratoExtraido:reader.read(sale),blocoContratoAtual:null,dadosIA:null,wizardTipo:'Financiamento',wizardTipoIcone:'🏠',currentUser:{uid:'test'},db:{},
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{style:{},value:'0',disabled:false});return nodes.get(id);}},
 fmtIA:v=>String(v),formatDataBR:v=>v,escapeHTML:v=>String(v),calcularConfiancaExtracao:()=>50,
 addDoc:async(ref,data)=>saved.push(data),collection:()=>({}),serverTimestamp:()=>null,fecharTodosModais:()=>{}};
 vm.createContext(ctx);
 const a=source.indexOf('function mostrarPreviewIA('),b=source.indexOf('function animarStepsIA(',a);
 vm.runInContext(source.slice(a,b),ctx);
 vm.runInContext('mostrarPreviewIA({}, {confianca:0})',ctx);assert.match(nodes.get('iaResultado').innerHTML,/id="btnSalvarIA" disabled/);assert.match(nodes.get('iaResultado').innerHTML,/obrigações identificadas/);assert.doesNotMatch(nodes.get('iaResultado').innerHTML,/Nenhum dado identificado/);
 await ctx.window.salvarDividaIA();assert.equal(saved.length,0);
 ctx.window._selecionarBlocoContrato(2);assert.equal(ctx.dadosIA.valorParcela,800.5);assert.doesNotMatch(nodes.get('iaResultado').innerHTML,/id="btnSalvarIA" disabled/);
 await ctx.window.salvarDividaIA();assert.equal(saved.length,1);assert.equal(saved[0].valorTotal,19212);assert.equal(saved[0].parcelas,24);assert.equal(saved[0].instituicao,'Tenda');
 ctx.window._selecionarBlocoContrato(1);await ctx.window.salvarDividaIA();assert.equal(saved.length,1,'bank terms missing must not save zeros');
 ctx.contratoExtraido=reader.read(rental);ctx.blocoContratoAtual=null;ctx.dadosIA={...ctx.contratoExtraido.dados};await ctx.window.salvarDividaIA();assert.equal(saved.length,1,'rental requires actual first due date');
});

