const crypto = require('node:crypto');
const COLLECTION = '_marketing_suppressions';
function createMarketingPreferences({db, secret, frontendURL, now = Date.now}) {
  function ready() {
    if (!db || !secret) throw Object.assign(Error('Preferências de e-mail indisponíveis.'), {status:503});
  }
  function identity(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value) || value.length > 254) throw Error('Destinatário inválido.');
    return crypto.createHash('sha256').update(value).digest('hex');
  }
  function signature(id) {
    return crypto.createHmac('sha256', secret).update('bud-marketing-unsubscribe:v1:' + id).digest('hex');
  }
  function verify(token) {
    ready();
    const match = /^m1\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(String(token || ''));
    if (!match || !crypto.timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(signature(match[1]), 'hex'))) {
      throw Object.assign(Error('Link de descadastramento inválido. Abra o link completo recebido por e-mail.'), {status:400});
    }
    return match[1];
  }
  async function prepare(email) {
    ready();
    const id = identity(email);
    const snapshot = await db.collection(COLLECTION).doc(id).get();
    if (snapshot.exists && snapshot.data().unsubscribed === true) return {allowed:false};
    const base = new URL(frontendURL);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname))) throw Error('Destino de preferências inválido.');
    const url = new URL(base.href.replace(/\/$/, '') + '/preferencias-email.html');
    url.hash = 'token=m1.' + id + '.' + signature(id);
    return {allowed:true, unsubscribeURL:url.href};
  }
  async function unsubscribe(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    try {
      const id = verify(req.body?.token);
      // Minimal suppression survives account deletion/recreation; no raw address or financial data.
      await db.collection(COLLECTION).doc(id).set({unsubscribed:true, updatedAt:now()}, {merge:true});
      return res.json({ok:true, unsubscribed:true});
    } catch (error) {
      return res.status(error.status || 503).json({error:error.status ? error.message : 'Não foi possível salvar. Tente novamente.'});
    }
  }
  async function render(email,{html,text}) {
    const result = await prepare(email);
    if (!result.allowed) return {allowed:false};
    const escaped = result.unsubscribeURL.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return {allowed:true, html:String(html).replaceAll('{{unsubscribe_url}}',escaped), text:String(text).replaceAll('{{unsubscribe_url}}',result.unsubscribeURL)};
  }
  return {prepare,unsubscribe,render};
}
module.exports = {createMarketingPreferences};
