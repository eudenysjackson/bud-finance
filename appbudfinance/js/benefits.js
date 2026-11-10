(function(root){
 const types=Object.freeze({vale_refeicao:'🍽️ Vale Refeição',vale_alimentacao:'🛒 Vale Alimentação',transporte:'🚌 Transporte / VT',beneficio:'🎁 Outro benefício'});
 function isBenefit(type){return Object.hasOwn(types,type);}
 function conversion(card,type,balance,transactions,debts){
  if(!isBenefit(type)||String(balance).trim()===''||!Number.isFinite(Number(balance))||Number(balance)<0)throw Error('Informe o tipo e o saldo real do benefício.');
  if(Number(card.limiteReservado)>0 || transactions.some(t=>t.cartaoId===card.id && t.tipo==='despesa' && t.pendenteConfirmacao!==true) || debts.some(d=>d.cartaoId===card.id && (d.parcelasPagas||0)<(d.parcelas||1)))throw Error('Este cartão possui compras ou dívidas. Revise esses lançamentos antes de convertê-lo em benefício.');
  return {tipo:type,saldo:Number(balance),saldoInicial:Number(balance),limite:0,limiteReservado:0,fechamento:null,vencimento:null};
 }
 const api={types,isBenefit,conversion};if(typeof module==='object')module.exports=api;else root.BudBenefits=api;
})(typeof window==='object'?window:globalThis);
