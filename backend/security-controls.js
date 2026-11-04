'use strict';
const crypto = require('node:crypto');
function privateHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Request-ID', crypto.randomUUID());
  next();
}
function safeError(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE' ? 413 :
    err.type === 'entity.parse.failed' ? 400 : 500;
  // Never return stack, input body, tokens or upstream payloads.
  res.status(status).json({ error: status === 413 ? 'Arquivo ou solicitação acima do limite.' : status === 400 ? 'Solicitação inválida.' : 'Não foi possível concluir. Tente novamente.' });
}
function revokeSessions({ auth, db, now = Date.now }) {
  return async (req, res) => {
    const user = req.budUser;
    if (!user) return res.status(401).json({ error: 'Entre novamente.' });
    const age = now() / 1000 - Number(user.auth_time);
    if (!Number.isFinite(age) || age > 300 || age < -60) return res.status(401).json({ code: 'auth/requires-recent-login', error: 'Faça login novamente para encerrar todas as sessões.' });
    if (req.body?.confirmation !== 'ENCERRAR') return res.status(400).json({ error: 'Confirme o encerramento das sessões.' });
    try {
      // Rules block existing tokens immediately; Auth prevents refresh thereafter.
      const batch = db.batch();
      batch.set(db.collection('_session_revocations').doc(user.uid), { revokedAt: Math.floor(now() / 1000) });
      batch.update(db.collection('usuarios').doc(user.uid), { fcmTokens: [], fcmToken: null, pushEnabled: false, pushConsentRevoked: true });
      await batch.commit();
      await auth.revokeRefreshTokens(user.uid);
      return res.json({ ok: true });
    } catch (_) { return res.status(503).json({ error: 'Não foi possível confirmar o encerramento. Tente novamente.' }); }
  };
}
module.exports = { privateHeaders, safeError, revokeSessions };
