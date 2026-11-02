const { randomUUID } = require('node:crypto');

function createSubscriptionChange({ auth, db, token, plans, emulator = false, fetch: providerFetch = fetch }) {
  return async function changeSubscription(req, res) {
    if (!auth || !db) return res.status(503).json({ error: 'Serviço indisponível.' });
    let user;
    try { user = await auth.verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer /, ''),true); }
    catch (_) { return res.status(401).json({ error: 'Faça login novamente.' }); }
    const planKey = String(req.body?.planKey || '').toLowerCase();
    if (!plans[planKey]) return res.status(400).json({ error: 'Plano inválido.' });
    const ref = db.collection('usuarios').doc(user.uid);
    const lockId = randomUUID();
    let acquired = false;
    try {
      const profile = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const data = snapshot.exists ? snapshot.data() : {};
        if (data.planoTrocaLock?.until > Date.now()) return null;
        transaction.update(ref, { planoTrocaLock: { id: lockId, until: Date.now() + 60_000 } });
        return data;
      });
      if (!profile) return res.status(409).json({ error: 'Já há uma alteração em andamento. Aguarde e tente novamente.' });
      acquired = true;
      const subscriptionId = profile.mpSubscriptionId;
      if (!subscriptionId || !plans[profile.plano]) return res.status(409).json({ error: 'Nenhuma assinatura ativa para alterar.' });
      const local = emulator && String(subscriptionId).startsWith('LOCAL_TEST_');
      if (!local && !token) return res.status(503).json({ error: 'Pagamentos não configurados.' });
      const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
      let sub;
      if (local) {
        const expiry = profile.planoExpira;
        sub = { status: 'authorized', external_reference: user.uid + '|' + profile.plano, payer_email: user.email,
          next_payment_date: expiry?.toDate ? expiry.toDate().toISOString() : expiry };
      } else {
        const response = await providerFetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), { headers, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('subscription-lookup-failed');
        sub = await response.json();
      }
      const parts = String(sub.external_reference || '').split('|');
      const payerEmail = String(sub.payer_email || '').toLowerCase();
      const payerId = String(sub.payer_id || '');
      if (parts[0] !== user.uid || (payerEmail && payerEmail !== String(user.email || '').toLowerCase()) ||
          (!payerEmail && !payerId) || (profile.mpPayerId && String(profile.mpPayerId) !== payerId)) {
        return res.status(403).json({ error: 'Não foi possível validar o titular da assinatura.' });
      }
      if (sub.status !== 'authorized') return res.status(409).json({ error: 'A assinatura precisa estar ativa para trocar de plano.' });
      const effectiveDate = new Date(sub.next_payment_date);
      if (!Number.isFinite(effectiveDate.getTime()) || effectiveDate.getTime() <= Date.now()) {
        return res.status(409).json({ error: 'A cobrança está em processamento. Tente alterar o plano após a confirmação.' });
      }
      if (planKey === profile.plano && !profile.planoTroca) return res.json({ ok: true, scheduled: false, planKey });
      if(plans[planKey].amount>plans[profile.plano].amount)return res.status(409).json({code:'UPGRADE_CHECKOUT_REQUIRED',error:'O upgrade exige o checkout da diferença proporcional.'});
      if(profile.planoUpgrade&&['creating','unknown','pending','applying'].includes(profile.planoUpgrade.state)&&new Date(profile.planoUpgrade.validUntil).getTime()>Date.now())return res.status(409).json({error:'Cancele ou conclua o upgrade pendente antes de agendar outra alteração.'});
      const reward = profile.beneficioIndicacao50 || {};
      const rewardApplies = reward.status === 'scheduled' && reward.subscriptionId === subscriptionId;
      const baseAmount = plans[planKey].amount;
      const amount = Math.round(baseAmount * (rewardApplies ? 0.5 : 1) * 100) / 100;
      const change = { planKey, amount, effectiveAt: effectiveDate.toISOString(), subscriptionId, status: 'confirming' };
      // Persist the intended plan and the one-cycle referral discount before changing the provider.
      await ref.update({ planoTroca: change, ...(rewardApplies ? { beneficioIndicacao50: { ...reward, planKey, baseAmount, discountAmount: amount, effectiveAt: effectiveDate.toISOString() } } : {}) });
      if (!local) {
        const response = await providerFetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), {
          method: 'PUT', headers, signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ reason: plans[planKey].title, auto_recurring: { transaction_amount: amount, currency_id: 'BRL' } })
        });
        if (!response.ok) throw new Error('subscription-change-failed');
        // Read back the provider state before telling the customer it is scheduled.
        const check = await providerFetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), { headers, signal: AbortSignal.timeout(10000) });
        if (!check.ok) throw new Error('subscription-change-unconfirmed');
        const updated = await check.json();
        if (Math.round(Number(updated.auto_recurring?.transaction_amount) * 100) !== Math.round(amount * 100) ||
            new Date(updated.next_payment_date).getTime() !== effectiveDate.getTime()) throw new Error('subscription-change-unconfirmed');
      }
      change.status = 'scheduled';
      const scheduled = planKey !== profile.plano;
      await ref.update({ planoTroca: scheduled ? change : null });
      return res.json({ ok: true, scheduled, planKey, amount, effectiveAt: change.effectiveAt });
    } catch (_) {
      return res.status(503).json({ error: 'Não foi possível confirmar a alteração. O plano atual foi mantido. Tente novamente.' });
    } finally {
      if (acquired) {
        await db.runTransaction(async transaction => {
          const snap = await transaction.get(ref);
          if (snap.data()?.planoTrocaLock?.id === lockId) transaction.update(ref, { planoTrocaLock: null });
        }).catch(() => {});
      }
    }
  };
}

module.exports = { createSubscriptionChange };

