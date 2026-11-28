"use strict";
function createMarketingSender({
  env = process.env,
  fetch: request = fetch,
  simulated = false,
}) {
  const ready =
    simulated ||
    (env.MARKETING_SEND_ENABLED === "true" &&
      !!env.EMAILJS_TEMPLATE_MARKETING &&
      !!env.EMAILJS_SERVICE_ID &&
      !!env.EMAILJS_PUBLIC_KEY &&
      !!env.EMAILJS_PRIVATE_KEY);
  let tail = Promise.resolve(),
    last = 0;
  async function send(message) {
    if (!ready)
      throw Object.assign(Error("Marketing não configurado."), {
        definitelyNotSent: true,
      });
    if (simulated) return { simulated: true };
    const work = tail.then(async () => {
      await new Promise((r) =>
        setTimeout(r, Math.max(0, 1100 - (Date.now() - last))),
      );
      last = Date.now();
      const body = {
        service_id: env.EMAILJS_SERVICE_ID,
        template_id: env.EMAILJS_TEMPLATE_MARKETING,
        user_id: env.EMAILJS_PUBLIC_KEY,
        accessToken: env.EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email: message.to,
          email_subject: message.subject,
          email_html: message.html,
          email_text: message.text,
          reply_to: "budsolucoes@gmail.com",
          from_name: "Bud Soluções",
        },
      };
      if (Buffer.byteLength(JSON.stringify(body.template_params)) > 48000)
        throw Object.assign(Error("Conteúdo acima do limite."), {
          definitelyNotSent: true,
        });
      const response = await request(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        throw Object.assign(Error("Provedor recusou."), {
          definitelyNotSent: response.status >= 400 && response.status < 500,
        });
      return { accepted: true };
    });
    tail = work.catch(() => {});
    return work;
  }
  return { ready, send };
}
module.exports = { createMarketingSender };
