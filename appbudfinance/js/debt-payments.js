(function(root) {
  'use strict';
  const cents = v => Math.round(Number(v)*100);
  const money = v => Math.round(Number(v)*100)/100;
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function dueDate(first, index) {
    if (!validDate(first)) return null;
    const [y,m,d] = first.split('-').map(Number), date = new Date(Date.UTC(y,m-1+index,1));
    date.setUTCDate(Math.min(d,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));
    return date.toISOString().slice(0,10);
  }
  function model(debt,index) {
    const total = Number(debt.parcelas), paid = Number(debt.parcelasPagas || 0), rate = Number(debt.juros || 0)/100;
    if (!Number.isFinite(Number(debt.valorTotal)) || Number(debt.valorTotal)<=0 || !Number.isFinite(rate) || rate<0) throw Error('Revise o valor e a taxa da dívida antes de confirmar.');
    if (!Number.isInteger(total) || total < 1 || !Number.isInteger(paid) || paid<0 || paid>total || !Number.isInteger(index) || index<0 || index>=total) throw Error('Parcela inválida. Atualize os dados da dívida.');
    const installment = money(Number(debt.valorParcela) || (rate>0 ? Number(debt.valorTotal)*rate/(1-Math.pow(1+rate,-total)) : Number(debt.valorTotal)/total));
    if (!Number.isFinite(installment) || installment<=0) throw Error('Informe o valor da parcela na dívida antes de registrar o pagamento.');
    return {paid,total,installment,count:Math.max(0,index-paid+1),amount:money(installment*Math.max(0,index-paid+1))};
  }
  function interestPaid(debt,count,installment) {
    let balance=Number(debt.valorTotal)||0, interest=0,rate=Number(debt.juros||0)/100;
    for(let i=0;i<count;i++){const value=balance*rate;interest+=value;balance=Math.max(0,balance-(installment-value));}
    return money(interest);
  }
  function walletBalance(account) { return Number(account.saldo ?? account.ultimaConfirmacao?.saldo ?? account.saldoInicial ?? 0); }
  function createService({db,doc,collection,runTransaction,Timestamp,serverTimestamp}) {
    const ref=(uid,name,id)=>doc(db,'usuarios',uid,name,id);
    async function confirm({uid,debtId,index,accountId=null,date,expectedPaid,expectedAmount}) {
      if(!uid || !debtId || !validDate(date)) throw Error('Informe uma data válida para o registro.');
      return runTransaction(db,async tx=>{
        const debtRef=ref(uid,'dividas',debtId), snapshot=await tx.get(debtRef);
        if(!snapshot.exists()) throw Error('Esta dívida não está mais disponível.');
        const debt=snapshot.data(), plan=model(debt,index);
        if(!plan.count) return {already:true,count:0};
        if(expectedPaid!=null && plan.paid!==expectedPaid) throw Error('As parcelas foram alteradas em outra tela. Feche e revise o pagamento.');
        if(expectedAmount!=null && cents(plan.amount)!==cents(expectedAmount)) throw Error('O valor da parcela foi alterado. Feche e revise o pagamento.');
        if(plan.count>200) throw Error('Confirme um intervalo menor de parcelas por vez.');
        const ids={...(debt.transacoesParcelas||{})}, details={...(debt.parcelasPagamentos||{})}, dates={...(debt.parcelasDatas||{})};
        for(let i=plan.paid;i<=index;i++) if(ids[String(i)] || details[String(i)]) throw Error('Uma parcela já possui registro vinculado. Atualize a dívida antes de confirmar.');
        let accountRef,account,cardRef,card;
        if(accountId){
          accountRef=ref(uid,'carteira',accountId);const snap=await tx.get(accountRef);
          if(!snap.exists() || snap.data().tipo==='credito' || snap.data().ativo===false) throw Error('Selecione uma conta disponível, sem usar cartão de crédito.');
          account=snap.data();const balance=walletBalance(account);
          if(!Number.isFinite(balance) || cents(balance)<cents(plan.amount)) throw Error('Saldo insuficiente na conta. O pagamento continua pendente.');
        }
        if(debt.tipo==='parcelamento_fatura' && debt.cartaoId){cardRef=ref(uid,'carteira',debt.cartaoId);const snap=await tx.get(cardRef);if(!snap.exists())throw Error('Cartão do parcelamento indisponível.');card=snap.data();}
        const accountName=account ? String(account.nome||account.banco||'Conta') : null;
        let reserved=card ? Math.max(0,Number(card.limiteReservado)||0):0;
        for(let i=plan.paid;i<=index;i++){
          const due=dueDate(debt.vencimento,i), paymentDate=Timestamp.fromDate(new Date(date+'T12:00:00'));
          const released=card?money(Math.min(reserved,plan.installment)):0;reserved=money(reserved-released);
          let transactionId=null;
          if(accountId){
            const expenseRef=doc(collection(db,'usuarios',uid,'transacoes'));transactionId=expenseRef.id;
            tx.set(expenseRef,{tipo:'despesa',descricao:`Parcela ${i+1}/${plan.total} — ${debt.nome||'Dívida'}`,valor:plan.installment,
              data:paymentDate,dataReferencia:date,dataPagamento:date,dataVencimento:due,categoria:debt.categoria||'Dívidas',origem:'divida_parcela',dividaId:debtId,
              carteiraId:accountId,contaId:accountId,contaNome:accountName,parcelaIndice:i,status:'ativa',pago:true,confirmado:true,dataCriacao:serverTimestamp()});
            ids[String(i)]=transactionId;
          }
          const record={acao:'pagamento',dividaId:debtId,parcelaIndice:i,valor:plan.installment,dataPagamento:date,vencimento:due,
            contaId:accountId,contaNome:accountName,modo:accountId?'conta':'sem_conta',transacaoId:transactionId,limiteLiberado:released,criadoEm:serverTimestamp()};
          tx.set(doc(collection(db,'usuarios',uid,'pagamentos-dividas')),record);
          details[String(i)]=record;dates[String(i)]=date+'T12:00:00';
        }
        tx.update(debtRef,{parcelasPagas:index+1,valorPago:money(Number(debt.valorPago||0)+plan.amount),jurosPagos:interestPaid(debt,index+1,plan.installment),
          transacoesParcelas:ids,parcelasPagamentos:details,parcelasDatas:dates,...(accountId?{contaId:accountId}:{}),atualizadoEm:serverTimestamp()});
        if(account)tx.update(accountRef,{saldo:money(walletBalance(account)-plan.amount)});
        if(card)tx.update(cardRef,{limiteReservado:reserved});
        return {already:false,count:plan.count,amount:plan.amount};
      });
    }
    async function reverse({uid,debtId,index}) {
      return runTransaction(db,async tx=>{
        const debtRef=ref(uid,'dividas',debtId),snapshot=await tx.get(debtRef);
        if(!snapshot.exists())throw Error('Esta dívida não está mais disponível.');
        const debt=snapshot.data(),plan=model(debt,index);
        if(index>=plan.paid)return {already:true};
        if(index!==plan.paid-1)throw Error('Desmarque somente a última parcela paga para manter a sequência.');
        const ids={...(debt.transacoesParcelas||{})},details={...(debt.parcelasPagamentos||{})},dates={...(debt.parcelasDatas||{})},record=details[String(index)];
        const expenseRef=ids[String(index)]?ref(uid,'transacoes',ids[String(index)]):null;
        const expenseSnap=expenseRef?await tx.get(expenseRef):null;
        const expense=expenseSnap?.exists()?expenseSnap.data():null;
        if(expense && (expense.dividaId!==debtId || expense.parcelaIndice!==index))throw Error('O lançamento vinculado precisa de revisão antes de desmarcar.');
        const accountId=record?.contaId || expense?.carteiraId || expense?.contaId || null;
        let accountRef,account,cardRef,card;
        if(accountId){accountRef=ref(uid,'carteira',accountId);const snap=await tx.get(accountRef);if(!snap.exists())throw Error('A conta original não está mais disponível. Revise o pagamento.');account=snap.data();}
        if(debt.tipo==='parcelamento_fatura' && debt.cartaoId){cardRef=ref(uid,'carteira',debt.cartaoId);const snap=await tx.get(cardRef);if(!snap.exists())throw Error('Cartão do parcelamento indisponível.');card=snap.data();}
        const value=money(record?.valor ?? expense?.valor ?? plan.installment), released=record?.limiteLiberado ?? (expense?value:0);
        tx.set(doc(collection(db,'usuarios',uid,'pagamentos-dividas')),{acao:'desmarcado',dividaId:debtId,parcelaIndice:index,valor:value,dataPagamento:record?.dataPagamento||dates[String(index)]?.slice(0,10)||null,
          vencimento:dueDate(debt.vencimento,index),contaId:accountId,contaNome:record?.contaNome||account?.nome||account?.banco||null,modo:record?.modo||(accountId?'conta':'legado'),transacaoId:ids[String(index)]||null,criadoEm:serverTimestamp()});
        if(expense)tx.delete(expenseRef);
        if(account){const balance=walletBalance(account);if(!Number.isFinite(balance))throw Error('Saldo da conta original inválido.');tx.update(accountRef,{saldo:money(balance+value)});}
        if(card)tx.update(cardRef,{limiteReservado:money(Math.max(0,Number(card.limiteReservado)||0)+released)});
        delete ids[String(index)];delete details[String(index)];delete dates[String(index)];
        tx.update(debtRef,{parcelasPagas:plan.paid-1,valorPago:money(Math.max(0,Number(debt.valorPago||0)-value)),jurosPagos:interestPaid(debt,plan.paid-1,plan.installment),transacoesParcelas:ids,parcelasPagamentos:details,parcelasDatas:dates,atualizadoEm:serverTimestamp()});
        return {already:false};
      });
    }
    return {confirm,reverse};
  }
  const api={createService,model,validDate,dueDate};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BudDebtPayments=api;
})(typeof window==='undefined'?globalThis:window);

