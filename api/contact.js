/* Emails the enquiry form via Resend. Needs CONTACT_TO, CONTACT_FROM and
   RESEND_API_KEY; without them it replies 501 and the page falls back to the
   visitor's mail app. */

"use strict";

const LIMITS = { name: 120, email: 200, message: 4000 };

/* Rate limit. Serverless has no shared store, so this counts per warm instance:
   it blunts the ordinary case (one bot hammering the form) but is not a hard
   guarantee across a distributed flood. The WAF rule in front of /api/contact is
   what handles that — see README. */
const WINDOWS = [
  { ms: 10 * 60 * 1000, max: 3 },     // 3 per 10 minutes from one address
  { ms: 60 * 60 * 1000, max: 8 }      // 8 per hour
];
const GLOBAL = { ms: 60 * 60 * 1000, max: 60 };
const hits = new Map();
let global = [];

function clientIp(req) {
  const h = req.headers || {};
  const fwd = h["x-vercel-forwarded-for"] || h["x-real-ip"] || h["x-forwarded-for"] || "";
  return String(fwd).split(",")[0].trim() || "unknown";
}

/* Returns seconds to wait, or 0 when the request is allowed. */
function throttle(ip) {
  const now = Date.now();
  const longest = WINDOWS[WINDOWS.length - 1].ms;

  global = global.filter(t => now - t < GLOBAL.ms);
  if (global.length >= GLOBAL.max) return Math.ceil(GLOBAL.ms / 1000);

  let seen = (hits.get(ip) || []).filter(t => now - t < longest);
  for (const w of WINDOWS) {
    const inWindow = seen.filter(t => now - t < w.ms);
    if (inWindow.length >= w.max) {
      hits.set(ip, seen);
      return Math.ceil((w.ms - (now - inWindow[0])) / 1000);
    }
  }

  seen.push(now);
  hits.set(ip, seen);
  global.push(now);

  if (hits.size > 5000) {               // keep the map from growing without bound
    for (const [k, v] of hits) if (!v.some(t => now - t < longest)) hits.delete(k);
  }
  return 0;
}

/* Reply to the visitor. Never quotes their message: this endpoint is public, and
   mailing arbitrary text to arbitrary addresses would make it a spam relay. */
const ACK = {
  de: {
    subject: "Wir haben deine Nachricht erhalten",
    greeting: name => `Hallo ${name},`,
    body: () =>
      "danke für deine Nachricht! Sie ist bei uns angekommen und wir melden uns " +
      "so schnell wie möglich bei dir.",
    urgent: "Für alles Dringende ruf uns bitte an:",
    signoff: "Bis bald,"
  },
  en: {
    subject: "We've got your message",
    greeting: name => `Hi ${name},`,
    body: () =>
      "thanks for writing! Your message reached us and someone will get back to " +
      "you shortly.",
    urgent: "For anything urgent, please call:",
    signoff: "See you soon,"
  },
  el: {
    subject: "Λάβαμε το μήνυμά σου",
    greeting: name => `Γεια σου ${name},`,
    body: () =>
      "ευχαριστούμε για το μήνυμά σου! Το λάβαμε και θα επικοινωνήσουμε μαζί σου " +
      "πολύ σύντομα.",
    urgent: "Για κάτι επείγον, τηλεφώνησέ μας:",
    signoff: "Τα λέμε σύντομα,"
  }
};

const SHOP = {
  name: "Cinnamon & Sugar",
  phone: "+49 30 65863658",
  address: "Lychener Straße 63, 10437 Berlin",
  site: "https://cinnamon-und-sugar.de"
};

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

  const wait = throttle(clientIp(req));
  if (wait) {
    res.setHeader("Retry-After", String(wait));
    return res.status(429).json({ error: "rate-limited", retryAfter: wait });
  }

  const body = await readBody(req);
  if (!body) return res.status(400).json({ error: "bad-json" });

  /* Honeypot. Accept and drop, so the bot learns nothing. */
  if (clean(body.company, 50)) return res.status(200).json({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, LIMITS.message);
  const lang = ["de", "en", "el"].indexOf(clean(body.lang, 2)) >= 0 ? clean(body.lang, 2) : "de";

  if (!name || !message) return res.status(400).json({ error: "missing-fields" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return res.status(400).json({ error: "bad-email" });

  /* Trim: a pasted newline in the key breaks the Authorization header. */
  const env = n => (process.env[n] || "").trim();
  const to = env("CONTACT_TO");
  const from = env("CONTACT_FROM");
  const key = env("RESEND_API_KEY");

  const missing = ["CONTACT_TO", "CONTACT_FROM", "RESEND_API_KEY"].filter(n => !env(n));
  if (missing.length) return res.status(501).json({ error: "not-configured", missing });

  const text = `${message}\n\n—\n${name}\n${email}`;
  const html =
    `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` +
    `<hr><p>${escapeHtml(name)}<br><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`;

  const send = mail => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ from }, mail))
  });

  try {
    const sent = await send({
      to: [to],
      reply_to: [email],
      subject: `Anfrage von ${name}`,
      text,
      html
    });

    if (!sent.ok) {
      const detail = (await sent.text()).slice(0, 500);
      console.error("resend " + sent.status + ": " + detail);
      return res.status(502).json({ error: "send-failed", provider: sent.status });
    }
  } catch (err) {
    console.error("contact: " + err);
    return res.status(502).json({ error: "send-failed", provider: "unreachable" });
  }

  /* Enquiry is already delivered; a failed reply is a log line, not an error. */
  try {
    const ack = ACK[lang];
    const firstName = name.split(/\s+/)[0];
    const ackText =
      `${ack.greeting(firstName)}\n\n${ack.body()}\n\n` +
      `${ack.urgent} ${SHOP.phone}\n\n` +
      `${ack.signoff}\n${SHOP.name}\n${SHOP.address}\n${SHOP.site}`;
    const ackHtml =
      `<p>${escapeHtml(ack.greeting(firstName))}</p>` +
      `<p>${escapeHtml(ack.body())}</p>` +
      `<p>${escapeHtml(ack.urgent)} <a href="tel:+493065863658">${SHOP.phone}</a></p>` +
      `<p>${escapeHtml(ack.signoff)}<br><strong>${escapeHtml(SHOP.name)}</strong><br>` +
      `${escapeHtml(SHOP.address)}<br><a href="${SHOP.site}">${SHOP.site}</a></p>`;

    const acked = await send({
      to: [email],
      reply_to: [to],
      subject: `${ack.subject} — ${SHOP.name}`,
      text: ackText,
      html: ackHtml
    });
    if (!acked.ok) console.error("ack " + acked.status + ": " + (await acked.text()).slice(0, 300));
  } catch (err) {
    console.error("ack: " + err);
  }

  return res.status(200).json({ ok: true });
};
