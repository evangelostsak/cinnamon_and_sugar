/* Cloudflare Pages Function — the same contract as api/contact.js, which serves
   the Vercel deployment. Both exist while the two platforms run side by side;
   delete the one that loses. */

const LIMITS = { name: 120, email: 200, message: 4000 };

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

/* Cloudflare's free rate-limiting rule is the real defence; this only blunts the
   ordinary case, and counts per isolate. */
const WINDOWS = [
  { ms: 10 * 60 * 1000, max: 3 },
  { ms: 60 * 60 * 1000, max: 8 }
];
const GLOBAL = { ms: 60 * 60 * 1000, max: 60 };
const hits = new Map();
let global = [];

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = s => s.replace(/[&<>"]/g, c => ENTITIES[c]);

const json = (status, body, extra) =>
  new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, extra)
  });

function throttle(ip) {
  const now = Date.now();
  const longest = WINDOWS[WINDOWS.length - 1].ms;

  global = global.filter(t => now - t < GLOBAL.ms);
  if (global.length >= GLOBAL.max) return Math.ceil(GLOBAL.ms / 1000);

  const seen = (hits.get(ip) || []).filter(t => now - t < longest);
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

  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some(t => now - t < longest)) hits.delete(k);
  }
  return 0;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST")
    return json(405, { error: "method-not-allowed" }, { Allow: "POST" });

  /* Cloudflare sets CF-Connecting-IP at the edge and it cannot be spoofed. */
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const wait = throttle(ip);
  if (wait)
    return json(429, { error: "rate-limited", retryAfter: wait }, { "Retry-After": String(wait) });

  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: "bad-json" }); }
  if (!body || typeof body !== "object") return json(400, { error: "bad-json" });

  if (clean(body.company, 50)) return json(200, { ok: true });      // honeypot

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, LIMITS.message);
  const lang = ACK[clean(body.lang, 2)] ? clean(body.lang, 2) : "de";

  if (!name || !message) return json(400, { error: "missing-fields" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(400, { error: "bad-email" });

  const pick = n => (env[n] || "").trim();
  const to = pick("CONTACT_TO"), from = pick("CONTACT_FROM"), key = pick("RESEND_API_KEY");
  const missing = ["CONTACT_TO", "CONTACT_FROM", "RESEND_API_KEY"].filter(n => !pick(n));
  if (missing.length) return json(501, { error: "not-configured", missing });

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
      text: `${message}\n\n—\n${name}\n${email}`,
      html: `<p style="white-space:pre-wrap">${escapeHtml(message)}</p><hr>` +
            `<p>${escapeHtml(name)}<br><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`
    });
    if (!sent.ok) {
      console.error("resend " + sent.status + ": " + (await sent.text()).slice(0, 500));
      return json(502, { error: "send-failed", provider: sent.status });
    }
  } catch (err) {
    console.error("contact: " + err);
    return json(502, { error: "send-failed", provider: "unreachable" });
  }

  /* The enquiry is delivered; a failed reply is a log line, not an error. */
  try {
    const ack = ACK[lang];
    const first = name.split(/\s+/)[0];
    const acked = await send({
      to: [email],
      reply_to: [to],
      subject: `${ack.subject} — ${SHOP.name}`,
      text: `${ack.greeting(first)}\n\n${ack.body()}\n\n${ack.urgent} ${SHOP.phone}\n\n` +
            `${ack.signoff}\n${SHOP.name}\n${SHOP.address}\n${SHOP.site}`,
      html: `<p>${escapeHtml(ack.greeting(first))}</p><p>${escapeHtml(ack.body())}</p>` +
            `<p>${escapeHtml(ack.urgent)} <a href="tel:+493065863658">${SHOP.phone}</a></p>` +
            `<p>${escapeHtml(ack.signoff)}<br><strong>${escapeHtml(SHOP.name)}</strong><br>` +
            `${escapeHtml(SHOP.address)}<br><a href="${SHOP.site}">${SHOP.site}</a></p>`
    });
    if (!acked.ok) console.error("ack " + acked.status + ": " + (await acked.text()).slice(0, 300));
  } catch (err) {
    console.error("ack: " + err);
  }

  return json(200, { ok: true });
}
