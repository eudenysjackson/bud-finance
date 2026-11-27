'use strict';
const {randomUUID}=require('node:crypto');
const VERSION='20261126-499-1499-2999';
const LEGACY={starter:9.99,pro:29.90,plus:49.90};
const CATALOG={starter:{title:'Bud Finance Starter',amount:4.99},pro:{title:'Bud Finance Plus',amount:14.99},plus:{title:'Bud Finance Pro',amount:29.99}};
const cents=n=>Math.round(Number(n)*100);
const millis=v=>v?.toMillis?v.toMillis():v?.toDate?v.toDate().getTime():new Date(v||0).getTime();

// The catalogue sets future charges. Proration must credit the price actually paid.
function cycleBase(profile,planKey,plans){
  return Number(profile.cicloPrecoBase)||Number(profile.planoPreco?.currentBase)||LEGACY[planKey]||plans[planKey]?.amount;
}
function paidCycleBase(planKey,payment,profile){
  const paid=cents(payment?.transaction_amount);
  if(!paid||!CATALOG[planKey])return null;
  const promo=profile.descontoIndicacaoPrimeiroMes;
  const reward=profile.beneficioIndicacao50;
  const factor=promo?.status==='awaiting_payment'&&promo.subscriptionId===profile.mpSubscriptionId?.toString()?0.85:
    reward&&['scheduled','awaiting_payment'].includes(reward.status)&&reward.subscriptionId===profile.mpSubscriptionId&&
      (reward.status==='awaiting_payment'||millis(payment.date_approved||payment.date_created)>=millis(reward.effectiveAt))?0.5:1;
  return [CATALOG[planKey].amount,LEGACY[planKey]].find(base=>cents(base*factor)===paid)||null;
}

function preparePriceChange(uid,profile,sub,now=Date.now()){
  const id=profile.mpSubscriptionId,plan=profile.plano;
  if(!id||!CATALOG[plan]||profile._deletionPending)return {skip:'no-active-subscription'};
  if(sub.status!=='authorized')return {skip:'not-authorized'};
  if(String(sub.external_reference||'').split('|')[0]!==uid||
      (profile.mpPayerId&&String(sub.payer_id)!==String(profile.mpPayerId))||
      (sub.payer_email&&String(sub.payer_email).toLowerCase()!==String(profile.email).toLowerCase())||
      (!sub.payer_email&&!sub.payer_id))throw Error('Subscription owner mismatch');
  if(sub.auto_recurring?.currency_id!=='BRL'||sub.auto_recurring.frequency!==1||sub.auto_recurring.frequency_type!=='months')throw Error('Unexpected recurring currency or period');
  const effectiveAt=millis(sub.next_payment_date);
  if(!Number.isFinite(effectiveAt)||effectiveAt-now<3600000)return {skip:'billing-in-progress'};
  if(profile.planoTrocaLock?.until>now)return {skip:'plan-change-in-progress'};
  if(['quoted','creating','unknown','pending','applying'].includes(profile.planoUpgrade?.state)&&millis(profile.planoUpgrade.validUntil)>now)return {skip:'upgrade-in-progress'};
  if(profile.mpCheckout?.state==='pending'||['awaiting_payment','restoring'].includes(profile.descontoIndicacaoPrimeiroMes?.status)||profile.beneficioIndicacao50?.status==='awaiting_payment')return {skip:'first-payment-in-progress'};
  const change=profile.planoTroca;
  if(change&&change.status!=='scheduled')return {skip:'plan-change-unconfirmed'};
  if(change&&(change.subscriptionId!==id||!CATALOG[change.planKey]||millis(change.effectiveAt)!==effectiveAt))throw Error('Scheduled plan mismatch');
  const target=change?.planKey||plan,baseAmount=CATALOG[target].amount;
  const reward=profile.beneficioIndicacao50;
  const discounted=reward?.status==='scheduled'&&reward.subscriptionId===id;
  if(reward?.status==='scheduled'&&(!discounted||millis(reward.effectiveAt)!==effectiveAt))throw Error('Scheduled reward mismatch');
  const amount=Math.round(baseAmount*(discounted?0.5:1)*100)/100;
  const before=Number(sub.auto_recurring.transaction_amount);
  const expected=[LEGACY[target],CATALOG[target].amount].map(n=>Math.round(n*(discounted?0.5:1)*100)/100);
  if(!expected.some(n=>cents(n)===cents(before)))throw Error('Unrecognized recurring price');
  if(profile.planoPreco?.confirmed===true&&profile.planoPreco?.version===VERSION&&profile.planoPreco.subscriptionId===id&&cents(before)===cents(amount)&&profile.planoPreco.planKey===target)return {skip:'already-current'};
  const currentBase=cycleBase(profile,plan,CATALOG);
  return {amount,before,effectiveAt:new Date(effectiveAt).toISOString(),planKey:target,
    patch:{cicloPrecoBase:currentBase,planoPreco:{version:VERSION,subscriptionId:id,planKey:target,currentBase,renewalBase:baseAmount,amount,effectiveAt:new Date(effectiveAt).toISOString()},
      ...(change?{planoTroca:{...change,amount}}:{}),
      ...(discounted?{beneficioIndicacao50:{...reward,baseAmount,discountAmount:amount}}:{})}};
}

// Dry-run by default. This changes the existing recurring amount, never creates a payment.
function createPriceMigration({db,fetch:providerFetch=fetch,token,now=Date.now}){
  async function api(id,body){
    const r=await providerFetch('https://api.mercadopago.com/preapproval/'+encodeURIComponent(id),{
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
      ...(body?{method:'PUT',body:JSON.stringify(body)}:{})});
    if(!r.ok)throw Error('Provider HTTP '+r.status);return r.json();
  }
  return async function migrate(uid,{apply=false}={}){
    const ref=db.collection('usuarios').doc(uid),initial=await ref.get();
    if(!initial.exists)return {status:'skipped',reason:'missing-profile'};
    const profile=initial.data();
    if(!profile.mpSubscriptionId||!CATALOG[profile.plano])return {status:'skipped',reason:'no-active-subscription'};
    const sub=await api(profile.mpSubscriptionId),plan=preparePriceChange(uid,profile,sub,now());
    if(plan.skip)return {status:'skipped',reason:plan.skip};
    if(!apply)return {status:'ready',from:plan.before,to:plan.amount,effectiveAt:plan.effectiveAt};
    const lockId=randomUUID();let acquired=false;
    // Compare the full billing snapshot before writing any provider state.
    const fingerprint=p=>JSON.stringify([p.mpSubscriptionId,p.plano,p.planoTroca,p.planoUpgrade,p.beneficioIndicacao50,p.descontoIndicacaoPrimeiroMes,p._deletionPending,p.planoPreco]);
    try{
      await db.runTransaction(async tx=>{const s=await tx.get(ref),p=s.data();if(!s.exists||fingerprint(p)!==fingerprint(profile)||p.planoTrocaLock?.until>now())throw Error('Billing state changed');
        tx.update(ref,{planoTrocaLock:{id:lockId,until:now()+60000}});});acquired=true;
      // Persist intended metadata before the PUT so an uncertain response can be retried.
      await ref.update(plan.patch);
      const latestSub=await api(profile.mpSubscriptionId);
      const recheck=preparePriceChange(uid,{...profile,planoTrocaLock:null},latestSub,now());
      if(recheck.skip||cents(recheck.amount)!==cents(plan.amount)||recheck.effectiveAt!==plan.effectiveAt)throw Error('Provider billing state changed');
      if(cents(latestSub.auto_recurring.transaction_amount)!==cents(plan.amount))await api(profile.mpSubscriptionId,{reason:CATALOG[plan.planKey].title,auto_recurring:{transaction_amount:plan.amount,currency_id:'BRL'}});
      const verified=await api(profile.mpSubscriptionId);
      if(verified.status!=='authorized'||cents(verified.auto_recurring?.transaction_amount)!==cents(plan.amount)||millis(verified.next_payment_date)!==millis(plan.effectiveAt))throw Error('Recurring update unconfirmed');
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref),data=fresh.data();
        if(!fresh.exists||data.planoTrocaLock?.id!==lockId||fingerprint(data)!==fingerprint({...profile,...plan.patch}))throw Error('Billing state changed before confirmation');
        tx.update(ref,{...plan.patch,planoPreco:{...plan.patch.planoPreco,confirmed:true}});
      });
      return {status:'updated',from:plan.before,to:plan.amount,effectiveAt:plan.effectiveAt};
    }finally{if(acquired)await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.data()?.planoTrocaLock?.id===lockId)tx.update(ref,{planoTrocaLock:null});});}
  };
}
module.exports={VERSION,LEGACY,CATALOG,cycleBase,paidCycleBase,preparePriceChange,createPriceMigration};
