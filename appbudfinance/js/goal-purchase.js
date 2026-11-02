(function(root){
 'use strict';
 const cents=v=>Math.round(Number(v)*100),money=v=>cents(v)/100;
 function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
 function monthDate(date,offset,day){const [y,m]=date.split('-').map(Number),d=new Date(Date.UTC(y,m-1+offset,1));d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.toISOString().slice(0,10);}
 function schedule(card,date,value,count){
  const closing=Number(card.fechamento),due=Number(card.vencimento);
  if(!validDate(date)||!Number.isInteger(closing)||closing<1||closing>31||!Number.isInteger(due)||due<1||due>31)throw Error('Revise fechamento e vencimento do cartão.');
  if(!Number.isInteger(count)||count<1||count>48||cents(value)<count)throw Error('Use de 1 a 48 parcelas, de pelo menos R$ 0,01.');
  const offset=(date>=monthDate(date,0,closing)?1:0)+(due<=closing?1:0),base=Math.floor(cents(value)/count),extra=cents(value)%count;
  return Array.from({length:count},(_,i)=>({date:monthDate(date,offset+i,due),value:(base+(i<extra?1:0))/100}));
 }
 function available(card,charges){
  const months=new Map();
  charges.filter(t=>t.cartaoId===card.id&&!t.pagamentoFatura&&!['cancelado','estornado'].includes(t.status)).forEach(t=>{const month=String(t.dataReferencia||'').slice(0,7);if(/^\d{4}-\d{2}$/.test(month)&&!card.faturasPagas?.[month])months.set(month,(months.get(month)||0)+cents(t.valor||0));});
  return Math.max(0,(cents(card.limite||0)-cents(card.limiteReservado||0)-[...months.values()].reduce((n,v)=>n+Math.max(0,v),0))/100);
 }
 function normalize(request,confirm=true){
  if(!validDate(request.date)||!Number.isFinite(request.total)||request.total<=0)throw Error('Informe valor e data válidos para a compra.');
  if(!Array.isArray(request.parts)||request.parts.length>8)throw Error('Use até oito formas de pagamento.');
  const reserve=money(request.reserve||0);if(!Number.isFinite(reserve)||reserve<0)throw Error('Valor da reserva inválido.');
  const ids=new Set();const parts=request.parts.map(p=>{if(!p.accountId||ids.has(p.accountId))throw Error('Escolha cada conta ou cartão uma única vez.');ids.add(p.accountId);const value=money(p.value);if(!Number.isFinite(value)||value<=0)throw Error('Informe um valor positivo em cada forma de pagamento.');return {accountId:p.accountId,value,installments:Number(p.installments||1)};});
  const sum=cents(reserve)+parts.reduce((n,p)=>n+cents(p.value),0);
  if(sum>cents(request.total)||(confirm&&sum!==cents(request.total)))throw Error('A soma da reserva e dos pagamentos deve ser igual ao valor da compra.');
  return {date:request.date,total:money(request.total),reserve,parts};
 }
 function createService({db,doc,collection,runTransaction,serverTimestamp,Timestamp,loadCharges}){
  const ref=(uid,c,id)=>doc(db,'usuarios',uid,c,id);
  async function save({uid,goalId,request,confirm=false}){
   const plan=normalize(request,confirm);if(!uid||!goalId)throw Error('Entre novamente na sua conta.');
   return runTransaction(db,async tx=>{
    const goalRef=ref(uid,'metas',goalId),snap=await tx.get(goalRef);if(!snap.exists())throw Error('Meta indisponível.');const goal=snap.data();
    if(goal.compraRealizada)return {already:true};
    if(goal.tipoMeta!=='compra')throw Error('Escolha Meta de compra ao editar este objetivo.');
    if(cents(plan.reserve)>cents(goal.valorAtual||0))throw Error('A reserva mudou. Revise o valor disponível na meta.');
    const accounts=[];for(const part of plan.parts){const r=ref(uid,'carteira',part.accountId),s=await tx.get(r);if(!s.exists()||s.data().ativo===false)throw Error('Uma conta ou cartão não está disponível.');accounts.push({ref:r,...s.data(),id:part.accountId,part});}
    let charges=[];if(accounts.some(a=>a.tipo==='credito')){const docs=await loadCharges(uid,accounts.filter(a=>a.tipo==='credito').map(a=>a.id));const snapshots=await Promise.all(docs.map(d=>tx.get(d.ref)));charges=snapshots.filter(s=>s.exists()).map(s=>s.data());}
    const records=[];
    for(const a of accounts){
     const p=a.part;
     if(a.tipo==='credito'){
      if(cents(available(a,charges))<cents(p.value))throw Error('Limite insuficiente em '+(a.nome||'um cartão')+'.');
      const installments=schedule(a,plan.date,p.value,p.installments);
      if(installments.some(i=>a.faturasPagas?.[i.date.slice(0,7)]))throw Error('A compra cairia em uma fatura já paga. Revise a data.');
      records.push({...p,name:a.nome||'Cartão',kind:'credito',schedule:installments});
     }else{
      if(p.installments!==1)throw Error('Somente cartões de crédito permitem parcelamento.');
      const balance=Number(a.saldo??a.ultimaConfirmacao?.saldo??a.saldoInicial??0);
      if(!Number.isFinite(balance)||cents(balance)<cents(p.value))throw Error('Saldo insuficiente em '+(a.nome||'uma conta')+'.');
      records.push({...p,name:a.nome||'Conta',kind:'conta'});
     }
    }
    const saved={...plan,parts:records};
    if(!confirm){tx.update(goalRef,{planoCompra:saved,atualizadoEm:serverTimestamp()});return {planned:true};}
    const txIds=[];
    for(const [n,r]of records.entries()){
     const a=accounts[n];
     const installments=r.schedule||[{date:plan.date,value:r.value}];
     installments.forEach((item,i)=>{const tr=doc(collection(db,'usuarios',uid,'transacoes'));txIds.push(tr.id);tx.set(tr,{tipo:'despesa',descricao:`${goal.nome||'Compra da meta'}${r.kind==='credito'&&installments.length>1?` (${i+1}/${installments.length})`:''}`,categoria:goal.categoria||'Outros',valor:item.value,data:Timestamp.fromDate(new Date(item.date+'T12:00:00')),dataReferencia:item.date,mesReferencia:item.date.slice(0,7),dataCompra:plan.date,origem:'meta_compra',metaId:goalId,compraId:goalId,status:'ativa',pagamentoFatura:false,formaPagamento:r.kind==='credito'?'Crédito':'Débito',...(r.kind==='credito'?{cartaoId:r.accountId,parcelado:installments.length>1,parcelaAtual:i+1,totalParcelas:installments.length}:{carteiraId:r.accountId,contaId:r.accountId,pago:true,confirmado:true}),dataCriacao:serverTimestamp()});});
     tx.update(a.ref,a.tipo==='credito'?{movimentacaoMetasVersao:Number(a.movimentacaoMetasVersao||0)+1}:{saldo:money(Number(a.saldo??a.ultimaConfirmacao?.saldo??a.saldoInicial??0)-r.value)});
    }
    const purchase={...saved,transacoes:txIds,registradaEm:serverTimestamp()};
    tx.set(ref(uid,'compras-metas',goalId),{...purchase,metaId:goalId,nome:goal.nome||'Meta'});
    tx.update(goalRef,{compraRealizada:purchase,planoCompra:saved,valorAtual:money(Number(goal.valorAtual||0)-plan.reserve),atualizadoEm:serverTimestamp()});
    return {purchased:true};
   });
  }
  async function deposit({uid,goalId,accountId,value,date,operationId}){
   value=money(value);if(!uid||!goalId||!accountId||!operationId||!validDate(date)||!Number.isFinite(value)||value<=0)throw Error('Revise o depósito e a data.');
   return runTransaction(db,async tx=>{
    const goalRef=ref(uid,'metas',goalId),depRef=doc(db,'usuarios',uid,'metas',goalId,'depositos',operationId),tr=ref(uid,'transacoes','meta_'+operationId),aRef=ref(uid,'carteira',accountId);
    const [g,d,a]=await Promise.all([tx.get(goalRef),tx.get(depRef),tx.get(aRef)]);if(d.exists())return {already:true};
    if(!g.exists()||!a.exists()||a.data().tipo==='credito'||a.data().ativo===false)throw Error('Meta ou conta indisponível.');
    const goal=g.data();if(goal.compraRealizada||cents(goal.valorAtual||0)>=cents(goal.valorAlvo))throw Error('Esta meta já foi alcançada.');
    if(cents(goal.valorAtual||0)+cents(value)>cents(goal.valorAlvo))throw Error('O depósito ultrapassa o valor que falta para esta meta.');
    const balance=Number(a.data().saldo??a.data().ultimaConfirmacao?.saldo??a.data().saldoInicial??0);if(!Number.isFinite(balance))throw Error('Saldo da conta inválido.');
    tx.set(tr,{tipo:'despesa',descricao:`Aporte: ${goal.nome}`,valor:value,data:Timestamp.fromDate(new Date(date+'T12:00:00')),dataReferencia:date,mesReferencia:date.slice(0,7),carteiraId:accountId,contaId:accountId,contaNome:a.data().nome||a.data().banco||'Conta',categoria:'Metas',origem:'meta',metaId:goalId,status:'ativa',pago:true,confirmado:true,dataCriacao:serverTimestamp()});
    tx.set(depRef,{valor:value,data:date,carteiraId:accountId,transacaoId:tr.id,dataCriacao:serverTimestamp()});
    tx.update(goalRef,{valorAtual:money(Number(goal.valorAtual||0)+value),atualizadoEm:serverTimestamp()});tx.update(aRef,{saldo:money(balance-value)});return {deposited:true};
   });
  }
  return {save,deposit};
 }
 const api={validDate,normalize,schedule,available,createService};if(typeof module==='object'&&module.exports)module.exports=api;else root.BudGoalPurchase=api;
})(typeof window==='undefined'?globalThis:window);


