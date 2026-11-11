const { createHash, randomBytes } = require('node:crypto');

const inbox = 'budsolucoes@gmail.com';
const gestorUrl = 'https://budsolucoes.com.br/budgestor/';
const digest = value => createHash('sha256').update(value).digest('hex');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const day = 24 * 60 * 60 * 1000;

function registerGestorAccess(app, { db, auth, emulator, sendEmail, limit }) {
  const requests = () => db.collection('_gestor_access_requests');

  app.post('/api/gestor/recovery', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!emailPattern.test(email) || email.length > 254) return res.sendStatus(400);
    if (limit('gestor:recovery:ip:' + req.ip) || limit('gestor:recovery:email:' + email)) return res.sendStatus(429);
    try {
      const profile = (await db.doc('_gestor_private/owner').get()).data();
      if (profile?.recoveryEmail === email) {
        const owner = await auth.getUser(profile.uid);
        if (owner.emailVerified && !owner.disabled && owner.customClaims?.budGestorOwner === true) {
          const link = await auth.generatePasswordResetLink(owner.email);
          if (!emulator) await sendEmail({
            to_email: email, action_url: link, action_label: 'Redefinir senha'
          }, process.env.EMAILJS_TEMPLATE_GESTOR_RECOVERY);
        }
      }
    } catch (error) {
      console.error('[gestor-recovery]', error.code || 'delivery_failed');
    }
    return res.status(202).json({});
  });

  app.post('/api/gestor/access-requests', async (req, res) => {
    const { name, email, whatsapp, reason } = req.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const phone = typeof whatsapp === 'string' && /^[+\d ().-]{10,25}$/.test(whatsapp)
      ? whatsapp.replace(/\D/g, '') : '';
    if (typeof name !== 'string' || name.trim().length < 3 || name.length > 120 ||
        !emailPattern.test(normalizedEmail) || normalizedEmail.length > 254 ||
        phone.length < 10 || phone.length > 15 ||
        typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) {
      return res.status(400).json({ error: 'Revise os dados informados e tente novamente.' });
    }
    if (limit('gestor:ip:' + req.ip) || limit('gestor:email:' + normalizedEmail)) {
      return res.status(429).json({ error: 'Aguarde um minuto antes de tentar novamente.' });
    }

    const token = randomBytes(32).toString('hex');
    const ref = requests().doc(digest(normalizedEmail));
    try {
      const saved = await db.runTransaction(async tx => {
        const previous = (await tx.get(ref)).data();
        if (previous?.status === 'pending_review' ||
            previous?.tokenHash && previous.sentAt > Date.now() - 60_000) return false;
        tx.set(ref, {
          name: name.trim(), email: normalizedEmail, whatsapp: phone, reason: reason.trim(),
          status: 'awaiting_confirmation', tokenHash: digest(token), expiresAt: Date.now() + day,
          sentAt: Date.now()
        });
        return true;
      });
      if (saved && !emulator) {
        try {
          await sendEmail({
            to_email: normalizedEmail,
            action_url: gestorUrl + '#confirm=' + token,
            action_label: 'Confirmar e-mail'
          }, process.env.EMAILJS_TEMPLATE_GESTOR_CONFIRM);
        } catch (error) {
          await db.runTransaction(async tx => {
            if ((await tx.get(ref)).data()?.tokenHash === digest(token)) tx.delete(ref);
          });
          throw error;
        }
      }
      return res.status(202).json(emulator && saved ? { confirmationToken: token } : {});
    } catch {
      return res.status(503).json({ error: 'Não foi possível registrar a solicitação agora. Tente novamente.' });
    }
  });

  app.post('/api/gestor/access-requests/confirm', async (req, res) => {
    const token = req.body?.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Link inválido ou expirado.' });
    }
    if (limit('gestor:confirm:' + req.ip)) return res.status(429).json({ error: 'Aguarde um minuto e tente novamente.' });
    try {
      const query = requests().where('tokenHash', '==', digest(token)).limit(1);
      const request = await db.runTransaction(async tx => {
        const [match] = (await tx.get(query)).docs;
        if (!match) return null;
        const data = match.data();
        if (data.status === 'pending_review' && data.notifiedAt) return { done: true };
        if (data.expiresAt < Date.now()) return null;
        if (data.notifyLeaseUntil > Date.now()) return { busy: true };
        tx.update(match.ref, {
          status: 'pending_review', confirmedAt: data.confirmedAt || Date.now(),
          notifyLeaseUntil: Date.now() + 30_000
        });
        return { ref: match.ref, protocol: match.id.slice(0, 12).toUpperCase() };
      });
      if (!request) return res.status(400).json({ error: 'Link inválido ou expirado.' });
      if (request.busy) return res.status(409).json({ error: 'A confirmação está em andamento. Aguarde alguns segundos.' });
      if (!request.done) {
        try {
          if (!emulator) await sendEmail({
            to_email: inbox, protocol: request.protocol, action_url: gestorUrl
          }, process.env.EMAILJS_TEMPLATE_GESTOR_NOTICE);
          await request.ref.update({ notifiedAt: Date.now(), notifyLeaseUntil: 0 });
        } catch (error) {
          await request.ref.update({ notifyLeaseUntil: 0 });
          throw error;
        }
      }
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ error: 'Não foi possível concluir a confirmação. Tente novamente pelo mesmo link.' });
    }
  });
}

module.exports = { registerGestorAccess };
