/* Sends the enquiry form as an email. Runs as a Vercel Function — no packages,
   just fetch() against the mail provider's HTTP API.

   Configure these in Vercel → Settings → Environment Variables:
     CONTACT_TO       where enquiries land, e.g. bestellung@cinnamon-und-sugar.de
     CONTACT_FROM     verified sender, e.g. "Cinnamon & Sugar <noreply@cinnamon-und-sugar.de>"
     RESEND_API_KEY   from resend.com

   Until they are set this replies 501 and the page falls back to opening the
   visitor's mail app, so the form never dead-ends. */

"use strict";

const LIMITS = { name: 120, email: 200, topic: 120, message: 4000 };

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const escapeHtml = s => s.replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method-not-allowed" });
  }

  const body = await readBody(req);
  if (!body) return res.status(400).json({ error: "bad-json" });

  /* Hidden field no person can see. A filled one is a bot: accept and drop it,
     so the bot has nothing to learn from the response. */
  if (clean(body.company, 50)) return res.status(200).json({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const topic = clean(body.topic, LIMITS.topic) || "Anfrage";
  const message = clean(body.message, LIMITS.message);

  if (!name || !message) return res.status(400).json({ error: "missing-fields" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return res.status(400).json({ error: "bad-email" });

  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM;
  const key = process.env.RESEND_API_KEY;
  if (!to || !from || !key) return res.status(501).json({ error: "not-configured" });

  const text = `${message}\n\n—\n${name}\n${email}`;
  const html =
    `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` +
    `<hr><p>${escapeHtml(name)}<br><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`;

  try {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: [email],      // hitting reply answers the customer, not the robot
        subject: `[${topic}] ${name}`,
        text,
        html
      })
    });

    if (!sent.ok) {
      console.error("resend " + sent.status + ": " + (await sent.text()).slice(0, 500));
      return res.status(502).json({ error: "send-failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact: " + err);
    return res.status(502).json({ error: "send-failed" });
  }
};
