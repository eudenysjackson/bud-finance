const { createHash, randomBytes } = require('node:crypto');
const { normalizeCpf, cpfDigest } = require('./gestor-cpf');
const { registerGestorClients } = require('./gestor-clientes');

const inbox = 'budsolucoes@gmail.com';
const gestorUrl = 'https://budsolucoes.com.br/budgestor/';
const digest = value => createHash('sha256').update(value).digest('hex');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const day = 24 * 60 * 60 * 1000;

function registerGestorAccess(app, { db, auth, emulator, sendEmail, limit }) {
  const requests = () => db.collection('_gestor_access_requests');
  const ownerRef = () => db.doc('_gestor_private/owner');
  const cpfSecret = process.env.GESTOR_CPF_SECRET || (emulator ? 'gestor-local-cpf-only' : '');
  const firebaseKey = process.env.GESTOR_FIREBASE_API_KEY || (emulator ? 'local' : '');
  const authApi = emulator ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com' : 'https://identitytoolkit.googleapis.com';

  app.post('/api/gestor/cpf-login', async (req, res) => {
    const cpf = normalizeCpf(req.body?.cpf);
    const password = req.body?.password;
    if (limit('gestor:cpf:ip:' + req.ip)) return res.sendStatus(429);
    if (!cpf || typeof password !== 'string' || !password || password.length > 4096) return res.sendStatus(401);
    if (!cpfSecret || !firebaseKey) return res.sendStatus(503);
    try {
      const profile = (await ownerRef().get()).data();
      if (!profile?.cpfHash || cpfDigest(cpf, cpfSecret) !== profile.cpfHash) return res.sendStatus(401);
      const owner = await auth.getUser(profile.uid);
      if (owner.disabled || !owner.emailVerified || owner.customClaims?.budGestorOwner !== true ||
          owner.multiFactor?.enrolledFactors?.length) return res.sendStatus(401);
      const response = await fetch(authApi + '/v1/accounts:signInWithPassword?key=' + encodeURIComponent(firebaseKey), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: owner.email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) return res.sendStatus(401);
      const result = await response.json();
      if (!result.idToken || result.mfaPendingCredential || result.localId !== owner.uid) return res.sendStatus(401);
      const token = emulator ? JSON.stringify({ uid: owner.uid }) : await auth.createCustomToken(owner.uid);
      return res.json({ token });
    } catch { return res.sendStatus(503); }
  });

  async function ownerOnly(req, res, next) {
    const bearer = req.get('Authorization')?.match(/^Bearer (\S+)$/i);
    if (!bearer) return res.sendStatus(401);
    let identity;
    try { identity = await auth.verifyIdToken(bearer[1], true); }
    catch { return res.sendStatus(401); }
    if (!identity.email_verified || identity.budGestorOwner !== true) return res.sendStatus(403);
    req.gestorOwner = identity.uid;
    next();
  }

  registerGestorClients(app, { db, ownerOnly: [ownerOnly, async (req, res, next) => {
    try {
      const profile = (await ownerRef().get()).data();
      if (profile?.uid !== req.gestorOwner) return res.sendStatus(403);
      next();
    } catch { return res.sendStatus(503); }
  }] });

  function publicProfile(profile) {
    return {
      name: profile.name, loginEmail: profile.loginEmail || profile.recoveryEmail, recoveryEmail: profile.recoveryEmail,
      recoveryEmailVerified: profile.recoveryEmailVerified ?? !profile.loginEmail,
      whatsapp: profile.whatsapp, whatsappVerified: profile.whatsappVerified === true
    };
  }

  app.get('/api/gestor/owner-profile', ownerOnly, async (req, res) => {
    try {
      const profile = (await ownerRef().get()).data();
      if (profile?.uid !== req.gestorOwner) return res.sendStatus(403);
      return res.json(publicProfile(profile));
    } catch { return res.sendStatus(503); }
  });

  app.patch('/api/gestor/owner-profile', ownerOnly, async (req, res) => {
    const { name, whatsapp } = req.body ?? {};
    const phone = typeof whatsapp === 'string' && /^[+\d ().-]{10,25}$/.test(whatsapp)
      ? whatsapp.replace(/\D/g, '') : '';
    if (typeof name !== 'string' || name.trim().length < 3 || name.length > 120 || phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ error: 'Confira o nome e o WhatsApp com DDD.' });
    }
    try {
      const ref = ownerRef();
      const profile = await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current?.uid !== req.gestorOwner) return null;
        const update = { name: name.trim(), whatsapp: phone, whatsappVerified: current.whatsapp === phone && current.whatsappVerified === true };
        tx.update(ref, update);
        return publicProfile({ ...current, ...update });
      });
      return profile ? res.json(profile) : res.sendStatus(403);
    } catch { return res.sendStatus(503); }
  });

  app.post('/api/gestor/recovery', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!emailPattern.test(email) || email.length > 254) return res.sendStatus(400);
    if (limit('gestor:recovery:ip:' + req.ip) || limit('gestor:recovery:email:' + email)) return res.sendStatus(429);
    try {
      const profile = (await db.doc('_gestor_private/owner').get()).data();
      if (profile?.recoveryEmail === email && (profile.recoveryEmailVerified ?? !profile.loginEmail)) {
        const owner = await auth.getUser(profile.uid);
        if (owner.emailVerified && !owner.disabled && owner.customClaims?.budGestorOwner === true) {
          const link = await auth.generatePasswordResetLink(owner.email);
          if (!emulator) await sendEmail({
            to_email: email, to_name: 'Administrador do Bud Gestor',
            email_subject: '[Bud Gestor] Redefina sua senha',
            email_title: 'Redefina sua senha',
            email_preheader: 'Recuperação de acesso ao Bud Gestor',
            email_body: 'Use o botão abaixo para definir uma nova senha para sua conta administrativa.',
            action_url: link, action_label: 'Redefinir senha'
          }, process.env.EMAILJS_TEMPLATE_GESTOR_RECOVERY);
        }
      }
    } catch (error) {
      console.error('[gestor-recovery]', error.code || 'delivery_failed');
    }
    return res.status(202).json({});
  });

  app.post('/api/gestor/verify-recovery', ownerOnly, async (req, res) => {
    if (limit('gestor:verify-recovery:' + req.gestorOwner)) return res.sendStatus(429);
    const token = randomBytes(32).toString('hex');
    try {
      const ref = ownerRef();
      const email = await db.runTransaction(async tx => {
        const profile = (await tx.get(ref)).data();
        if (profile?.uid !== req.gestorOwner || !profile.recoveryEmail || profile.recoveryEmailVerified) return null;
        tx.update(ref, { recoveryVerification: { hash: digest(token), expiresAt: Date.now() + day, email: profile.recoveryEmail } });
        return profile.recoveryEmail;
      });
      if (!email) return res.sendStatus(409);
      if (!emulator) await sendEmail({
        to_email: email, to_name: 'Administrador do Bud Gestor',
        email_subject: '[Bud Gestor] Confirme seu e-mail de recuperação',
        email_title: 'Confirme seu e-mail de recuperação',
        email_preheader: 'Verificação de endereço do Bud Gestor',
        email_body: 'Use o botão abaixo para confirmar este endereço. O link pode ser usado uma vez em até 24 horas.',
        action_url: gestorUrl + '#recovery=' + token,
        action_label: 'Confirmar e-mail de recuperação'
      }, process.env.EMAILJS_TEMPLATE_GESTOR_VERIFY_RECOVERY);
      return res.json(emulator ? { token } : {});
    } catch { return res.sendStatus(503); }
  });

  app.post('/api/gestor/confirm-recovery', async (req, res) => {
    const token = req.body?.token;
    if (limit('gestor:confirm-recovery:' + req.ip)) return res.sendStatus(429);
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.sendStatus(400);
    try {
      const ref = ownerRef();
      const verified = await db.runTransaction(async tx => {
        const profile = (await tx.get(ref)).data();
        const verification = profile?.recoveryVerification;
        if (!verification || verification.expiresAt < Date.now() || verification.email !== profile.recoveryEmail ||
            verification.hash !== digest(token)) return false;
        tx.update(ref, { recoveryEmailVerified: true, recoveryVerification: null });
        return true;
      });
      return verified ? res.json({ ok: true }) : res.sendStatus(400);
    } catch { return res.sendStatus(503); }
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
