function createDeleteAccount({ authenticate, auth, db, emulator = false, now = Date.now }) {
  return async function deleteAccount(req, res) {
    const user = await authenticate(req, res);
    if (!user) return;
    if (req.body?.confirmation !== 'EXCLUIR') return res.status(400).json({ error: 'Confirme a exclusão da conta.' });
    const age = now() / 1000 - Number(user.auth_time);
    if (!Number.isFinite(age) || age > 300 || age < -60) {
      return res.status(401).json({ code: 'auth/requires-recent-login', error: 'Faça login novamente antes de excluir sua conta.' });
    }
    if (!auth || !db) return res.status(503).json({ error: 'Serviço indisponível. Tente novamente.' });
    try {
      const profile = db.collection('usuarios').doc(user.uid);
      const snapshot = await profile.get();
      const subscription = snapshot.data()?.mpSubscriptionId;
      const testSubscription = emulator && /^(LOCAL_TEST_|SANDBOX_TEST_)/.test(String(subscription));
      if (subscription && !testSubscription) {
        return res.status(409).json({ error: 'Cancele sua assinatura em Plano Atual antes de excluir a conta. A exclusão não cancela cobranças automaticamente.' });
      }
      // Admin recursive deletion includes quotas and nested goal deposits.
      // Keep Auth until database cleanup succeeds, allowing a safe retry.
      await db.recursiveDelete(profile);
      await auth.deleteUser(user.uid);
      return res.json({ ok: true });
    } catch (error) {
      console.error('[delete-account]', error.code || 'internal');
      return res.status(500).json({ error: 'Não foi possível concluir a exclusão. Tente novamente.' });
    }
  };
}
module.exports = { createDeleteAccount };
