const {randomUUID}=require('node:crypto');
const {recordPlanChange}=require('./gestor-clientes');
const cents=v=>Math.round(Number(v)*100),stamp=v=>v?.toDate?v.toDate().getTime():new Date(v||0).getTime();
const pending=s=>['quoted','creating','unknown','pending','applying'].includes(s);
function quoteProration(profile,sub,planKey,plans,time,approved){
 const from=profile.plano,to=plans[planKey],base=plans[from];
 if(!base||!to||cents(to.amount)<=cents(base.amount))throw Object.assign(Error('Escolha um plano superior para o upgrade.'),{status:409});
 const end=stamp(sub.next_payment_date),start=stamp(approved?.date||profile.ultimaCobrancaAprovadaEm);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||start>time||end-time<20*60_000||end-start>45*86400000||end<=start)throw Object.assign(Error('Não foi possível confirmar o período já pago. Aguarde a cobrança ou contate o suporte.'),{status:409});
 let factor=1;const prior=profile.upgradeCiclo;
 if(prior?.subscriptionId===profile.mpSubscriptionId&&stamp(prior.cycleEnd)===end)factor=Number(prior.factor);
 else if(approved?.amount){factor=Number(approved.amount)/base.amount;const expected=[1,.85,.5].find(f=>Math.abs(cents(base.amount*f)-cents(approved.amount))===0);if(!expected)throw Object.assign(Error('O pagamento do ciclo não corresponde ao plano atual. Contate o suporte.'),{status:409});factor=expected;}
 else for(const [key,f]of [['descontoIndicacaoPrimeiroMes',.85],['beneficioIndicacao50',.5]]){const p=profile[key];if(p?.status==='used'&&p.subscriptionId===profile.mpSubscriptionId&&stamp(p.usadoEm)>=start&&stamp(p.usadoEm)<end)factor=f;}
 if(![1,.85,.5].includes(factor))throw Error('Invalid cycle discount');
 const amountCents=Math.round((cents(to.amount)-cents(base.amount))*factor*(end-time)/(end-start));
 if(amountCents<1)throw Object.assign(Error('O ciclo está perto de renovar. Aguarde a renovação para trocar.'),{status:409});
 return{fromPlan:from,planKey,amount:amountCents/100,monthlyAmount:to.amount,cycleStart:new Date(start).toISOString(),cycleEnd:new Date(end).toISOString(),factor,subscriptionId:profile.mpSubscriptionId,validUntil:new Date(Math.min(time+15*60_000,end-30_000)).toISOString()};
}
function createSubscriptionUpgrade({auth,db,token,plans,frontend,webhook,fieldValue,now=Date.now,fetch:providerFetch=fetch,onApplied=async()=>{}}){
 const userRef=uid=>db.collection('usuarios').doc(uid),orderRef=(uid,id)=>userRef(uid).collection('upgrades-planos').doc(id);
 const external=(uid,id)=>'bud-upgrade|'+uid+'|'+id;
 async function api(path,{method='GET',body,key}={}){const r=await providerFetch('https://api.mercadopago.com'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(key?{'X-Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error('Provedor indisponível ('+r.status+'). Tente novamente.');return data;}
 function checkoutURL(data){const raw=token.startsWith('TEST-')?(data.sandbox_init_point||data.init_point):data.init_point;const u=new URL(raw);if(u.protocol!=='https:'||!/(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(u.hostname))throw Error('Checkout inválido.');return u.href;}
 async function subscription(profile,user){const sub=await api('/preapproval/'+encodeURIComponent(profile.mpSubscriptionId||''));const owner=String(sub.external_reference||'').split('|')[0];if(owner!==user.uid||sub.status!=='authorized'||(!sub.payer_email&&!sub.payer_id)||(profile.mpPayerId&&String(profile.mpPayerId)!==String(sub.payer_id))||sub.auto_recurring?.frequency!==1||sub.auto_recurring?.frequency_type!=='months'||(sub.auto_recurring?.currency_id&&sub.auto_recurring.currency_id!=='BRL')||(sub.payer_email&&String(sub.payer_email).toLowerCase()!==String(user.email).toLowerCase()))throw Object.assign(Error('Não foi possível validar sua assinatura ativa.'),{status:403});return sub;}
 async function refund(uid,id,payment,reason){
  const ref=orderRef(uid,id).collection('reembolsos').doc(String(payment.id));const s=await ref.get();if(s.data()?.status==='refunded')return;
  await ref.set({status:'pending',reason,requestedAt:now()},{merge:true});
  await api('/v1/payments/'+encodeURIComponent(payment.id)+'/refunds',{method:'POST',body:{},key:'bud-upgrade-refund-'+payment.id});
  await ref.set({status:'refunded',finishedAt:now()},{merge:true});
 }
 async function abortAndRefund(uid,id,order,payment,reason){
  if(order.state==='applying'&&Number.isFinite(order.recurringBefore)){
   const latest=(await userRef(uid).get()).data();
   if(latest?.mpSubscriptionId===order.subscriptionId&&latest.plano===order.fromPlan){
    const sub=await api('/preapproval/'+encodeURIComponent(order.subscriptionId));
    if(sub.status==='authorized'&&cents(sub.auto_recurring?.transaction_amount)===cents(order.nextAmount))await api('/preapproval/'+encodeURIComponent(order.subscriptionId),{method:'PUT',body:{auto_recurring:{transaction_amount:order.recurringBefore,currency_id:'BRL'}}});
   }
  }
  await refund(uid,id,payment,reason);
  await db.runTransaction(async tx=>{const root=userRef(uid),ref=orderRef(uid,id),s=await tx.get(root);tx.update(ref,{state:'refunded',leaseUntil:0});if(s.data()?.planoUpgrade?.id===id)tx.update(root,{planoUpgrade:{id,state:'refunded',planKey:order.planKey}});});
 }
 async function processPayment(payment){
  const parts=String(payment.external_reference||'').split('|');if(parts[0]!=='bud-upgrade')return false;
  const [,uid,id]=parts;if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid||'')||!/^[a-f0-9-]{36}$/.test(id||''))throw Error('Invalid upgrade reference');
  if(payment.status!=='approved'||Number(payment.transaction_amount_refunded||0)>0)return true;
  const ref=orderRef(uid,id),root=userRef(uid),pid=String(payment.id||'');if(!pid)throw Error('Payment ID missing');
  let order,profile,duplicate=false,missing=false;
  await db.runTransaction(async tx=>{
   const [s,p]=await Promise.all([tx.get(ref),tx.get(root)]);if(!s.exists){missing=true;return;}order=s.data();profile=p.data();
   if(order.state==='refunded'&&order.paymentId===pid)return;
   if(order.state==='applied'){duplicate=order.paymentId!==pid;return;}
   if(order.paymentId&&order.paymentId!==pid){duplicate=true;return;}
   if(order.leaseUntil>now())throw Error('Upgrade processing; retry');
   tx.update(ref,{leaseUntil:now()+60_000,paymentId:pid});
  });
  if(missing){await api('/v1/payments/'+encodeURIComponent(pid)+'/refunds',{method:'POST',body:{},key:'bud-upgrade-orphan-'+pid});return true;}
  if(order.state==='refunded'&&order.paymentId===pid)return true;
  if(order.state==='applied'&&!duplicate){await onApplied(uid);return true;}
  if(duplicate){await refund(uid,id,payment,'duplicate-payment');return true;}
  try{
   const paid=stamp(payment.date_approved||payment.date_created);
   const valid=profile&&!profile._deletionPending&&profile.mpSubscriptionId===order.subscriptionId&&profile.planoUpgrade?.id===id&&profile.plano===order.fromPlan&&order.state!=='cancelled'&&cents(payment.transaction_amount)===cents(order.amount)&&payment.currency_id==='BRL'&&paid<=stamp(order.validUntil)&&paid>=Number(order.createdAt)-60000&&now()<stamp(order.cycleEnd);
   if(!valid){await abortAndRefund(uid,id,order,payment,'expired-or-inconsistent');return true;}
   let sub;try{sub=await subscription(profile,{uid,email:profile.email});}catch(error){if(error.status===403){await abortAndRefund(uid,id,order,payment,'inactive-subscription');return true;}throw error;}
   if(stamp(order.cycleEnd)-now()<120_000||stamp(sub.next_payment_date)!==stamp(order.cycleEnd)||(sub.payer_id&&payment.payer?.id&&String(sub.payer_id)!==String(payment.payer.id))){await abortAndRefund(uid,id,order,payment,'cycle-or-payer-changed');return true;}
   const reward=profile.beneficioIndicacao50||{},discountNext=reward.status==='scheduled'&&reward.subscriptionId===order.subscriptionId;
   const nextAmount=Math.round(plans[order.planKey].amount*(discountNext ? 0.5 : 1)*100)/100;
   await ref.update({state:'applying',nextAmount});
   await api('/preapproval/'+encodeURIComponent(order.subscriptionId),{method:'PUT',body:{reason:plans[order.planKey].title,auto_recurring:{transaction_amount:nextAmount,currency_id:'BRL'}}});
   const check=await subscription(profile,{uid,email:profile.email});if(cents(check.auto_recurring?.transaction_amount)!==cents(nextAmount)||stamp(check.next_payment_date)!==stamp(order.cycleEnd))throw Error('Recurring amount unconfirmed');
   await db.runTransaction(async tx=>{const [p,s]=await Promise.all([tx.get(root),tx.get(ref)]);const latest=p.data();if(!latest||latest.mpSubscriptionId!==order.subscriptionId||latest.plano!==order.fromPlan||latest.planoUpgrade?.id!==id||latest._deletionPending)throw Error('Upgrade state changed');
    recordPlanChange(tx,root,latest,{plano:order.planKey},fieldValue.serverTimestamp());
    tx.update(root,{plano:order.planKey,planoTroca:null,upgradeCiclo:{subscriptionId:order.subscriptionId,cycleStart:order.cycleStart,cycleEnd:order.cycleEnd,factor:order.factor},planoUpgrade:{id,state:'applied',planKey:order.planKey,amount:order.amount,paymentId:pid},planoAtualizadoEm:fieldValue.serverTimestamp(),...(discountNext?{beneficioIndicacao50:{...reward,planKey:order.planKey,baseAmount:plans[order.planKey].amount,discountAmount:nextAmount}}:{})});
    tx.update(ref,{state:'applied',paymentId:pid,appliedAt:now(),leaseUntil:0});
   });
   await onApplied(uid);return true;
  }catch(e){await ref.update({leaseUntil:0}).catch(()=>{});throw e;}
 }
 async function handler(req,res){
  let user;try{user=req.budUser||await auth.verifyIdToken(String(req.headers.authorization||'').replace(/^Bearer /,''),true);}catch(_){return res.status(401).json({error:'Faça login novamente.'});}
  if(!token||!db)return res.status(503).json({error:'Pagamentos indisponíveis.'});
  const action=req.body?.action||'quote',root=userRef(user.uid);
  try{
   const p=await root.get(),profile=p.data()||{};if(profile._deletionPending)throw Object.assign(Error('Conta em encerramento.'),{status:403});
   if(action==='quote'){
    const planKey=String(req.body?.planKey||'').toLowerCase();const sub=await subscription(profile,user);let approved;
    if(!stamp(profile.ultimaCobrancaAprovadaEm)){const rows=await api('/authorized_payments/search?preapproval_id='+encodeURIComponent(profile.mpSubscriptionId)+'&limit=100');const paid=(rows.results||[]).filter(r=>r.payment?.status==='approved').sort((a,b)=>stamp(b.payment.date_approved||b.date_debit)-stamp(a.payment.date_approved||a.date_debit))[0];if(paid)approved={date:paid.payment.date_approved||paid.date_debit,amount:paid.transaction_amount||paid.payment.transaction_amount};}
    const quote=quoteProration(profile,sub,planKey,plans,now(),approved),id=randomUUID();let result;
    await db.runTransaction(async tx=>{const latest=await tx.get(root),data=latest.data();if(!data||data._deletionPending||data.plano!==quote.fromPlan||data.mpSubscriptionId!==quote.subscriptionId||data.planoTrocaLock?.until>now())throw Object.assign(Error('Outra alteração está em andamento. Tente novamente.'),{status:409});
     const prior=data.planoUpgrade;if(prior&&pending(prior.state)&&stamp(prior.validUntil)>now()){
      if(prior.planKey!==planKey)throw Object.assign(Error('Há outro upgrade pendente. Cancele-o antes de escolher outro plano.'),{status:409});
      const saved=await tx.get(orderRef(user.uid,prior.id));result={...saved.data(),quoteId:prior.id};return;
     }
     const value={...quote,state:'quoted',createdAt:now(),externalReference:external(user.uid,id),recurringBefore:Number(sub.auto_recurring?.transaction_amount)};tx.set(orderRef(user.uid,id),value);tx.update(root,{planoUpgrade:{id,state:'quoted',planKey,amount:quote.amount,validUntil:quote.validUntil}});result={...value,quoteId:id};
    });return res.json(result);
   }
   const id=String(req.body?.quoteId||'');if(!/^[a-f0-9-]{36}$/.test(id))return res.status(400).json({error:'Cotação inválida.'});const ref=orderRef(user.uid,id),s=await ref.get();if(!s.exists)throw Object.assign(Error('Cotação não encontrada.'),{status:404});let order=s.data();
   if(action==='cancel'){
    if(order.state==='applied'||order.state==='applying'||order.leaseUntil>now())throw Object.assign(Error('O pagamento está sendo confirmado. Aguarde.'),{status:409});
    if(order.preferenceId)await api('/checkout/preferences/'+encodeURIComponent(order.preferenceId),{method:'PUT',body:{expires:true,expiration_date_to:new Date(now()+1000).toISOString()}});
    await db.runTransaction(async tx=>{const [p,q]=await Promise.all([tx.get(root),tx.get(ref)]);if(['applied','applying'].includes(q.data()?.state)||q.data()?.leaseUntil>now())throw Error('Pagamento em confirmação');tx.update(ref,{state:'cancelled'});if(p.data()?.planoUpgrade?.id===id)tx.update(root,{planoUpgrade:{id,state:'cancelled'}});});return res.json({ok:true});
   }
   if(action!=='checkout')return res.status(400).json({error:'Ação inválida.'});
   if(stamp(order.validUntil)<=now()||order.state==='cancelled'||profile.planoUpgrade?.id!==id)throw Object.assign(Error('Cotação expirada. Atualize o valor antes de pagar.'),{status:409});
   if(['applied','applying','refunded'].includes(order.state))throw Object.assign(Error('Este pagamento já está sendo confirmado ou foi concluído.'),{status:409});
   if(order.init_point)return res.json({init_point:order.init_point,amount:order.amount});
   await db.runTransaction(async tx=>{const q=await tx.get(ref);if(q.data()?.leaseUntil>now())throw Object.assign(Error('Preparando checkout. Tente novamente.'),{status:409});tx.update(ref,{leaseUntil:now()+30_000,state:'creating'});});
   try{
    let preference;if(['unknown','creating'].includes(order.state)){const found=await api('/checkout/preferences/search?external_reference='+encodeURIComponent(order.externalReference));preference=(found.elements||found.results||[]).find(x=>x.external_reference===order.externalReference);if(preference?.id)preference=await api('/checkout/preferences/'+encodeURIComponent(preference.id));}
    if(!preference)preference=await api('/checkout/preferences',{method:'POST',body:{items:[{id:'upgrade-'+id,title:'Ajuste proporcional Bud Finance '+order.planKey,currency_id:'BRL',quantity:1,unit_price:order.amount}],payer:{email:user.email},external_reference:order.externalReference,metadata:{bud_upgrade_id:id},notification_url:webhook,back_urls:{success:frontend+'/configuracoes.html?upgrade_result=approved',pending:frontend+'/configuracoes.html?upgrade_result=pending',failure:frontend+'/configuracoes.html?upgrade_result=failure'},auto_return:'approved',binary_mode:true,payment_methods:{installments:1},expires:true,expiration_date_to:order.validUntil}});
    if(!preference?.id)throw Error('Checkout sem identificação.');const url=checkoutURL(preference);await ref.update({preferenceId:String(preference.id),init_point:url,state:'pending',leaseUntil:0});await root.update({planoUpgrade:{id,state:'pending',planKey:order.planKey,amount:order.amount,validUntil:order.validUntil,init_point:url}});return res.json({init_point:url,amount:order.amount});
   }catch(e){await ref.update({state:'unknown',leaseUntil:0});throw e;}
  }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível confirmar a operação. Seu plano atual foi mantido. Tente novamente.'});}
 }
 return{handler,processPayment};
}
module.exports={createSubscriptionUpgrade,quoteProration};
