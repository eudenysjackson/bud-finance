const {test}=require('node:test'),assert=require('node:assert/strict');const b=require('../appbudfinance/js/benefits');
test('benefits include food, meals, transport and custom and never inherit credit limits',()=>{
 for(const type of Object.keys(b.types)){const result=b.conversion({id:'b',limite:700},type,'0',[],[]);assert.equal(result.saldo,0);assert.equal(result.limite,0);assert.equal(result.fechamento,null);assert(b.isBenefit(type));}
 assert.equal(b.conversion({id:'b',limite:700},'transporte','500',[],[]).saldo,500);
});
test('conversion demands an explicit real balance and refuses credit debt or existing purchases',()=>{
 for(const saldo of ['',-1,NaN])assert.throws(()=>b.conversion({id:'b'},'beneficio',saldo,[],[]));
 assert.throws(()=>b.conversion({id:'b'},'credito',700,[],[]));
 assert.throws(()=>b.conversion({id:'b'},'beneficio',0,[{cartaoId:'b',tipo:'despesa'}],[]));
 assert.throws(()=>b.conversion({id:'b',limiteReservado:1},'beneficio',0,[],[]));
});

test('conversion reconciles wrong bank credit and includes pending reload only once',async()=>{
 const fs=require('fs'),vm=require('vm');const code=fs.readFileSync('appbudfinance/js/cartoes.js','utf8');const start=code.indexOf('await runTransaction(db,async tx=>{');const block=code.slice(start,code.indexOf('   overlay.remove();fecharModalCartao()',start));
 for(const includes of [false,true]){
  const records={benefit:{tipo:'credito',limite:700},bank:{tipo:'debito',saldo:1000},pending:{tipo:'receita',cartaoId:'benefit',pendenteConfirmacao:true,confirmado:false,valor:100},history:{tipo:'receita',cartaoId:'benefit',carteiraId:'bank',confirmado:true,valor:700},rec:{contaId:'benefit',contaTipo:'credito'}};
  const wrapper=id=>({ref:id,data:()=>records[id]});
  await vm.runInNewContext('(async()=>{'+block+'})()',{
   db:{},uid:'demo',id:'benefit',selected:'vale_alimentacao',balance:'700',includes,
   pending:[wrapper('pending')],history:[wrapper('history')],links:[wrapper('rec')],all:[],debts:{docs:[]},window:{BudBenefits:b},
   doc:(_db,_collection,_uid,_wallet,id)=>id,serverTimestamp:()=>0,deleteField:()=>null,
   runTransaction:async(_db,callback)=>{const writes=[];await callback({get:async ref=>({exists:()=>!!records[ref],data:()=>records[ref]}),update:(ref,data)=>writes.push([ref,data])});for(const [ref,data]of writes)Object.assign(records[ref],data);}
  });
  assert.equal(records.benefit.saldo,700);assert.equal(records.benefit.limite,0);assert.equal(records.bank.saldo,300);assert.equal(records.history.carteiraId,'benefit');assert.equal(records.rec.contaTipo,'vale_alimentacao');assert.equal(records.pending.confirmado,includes);
 }
});
