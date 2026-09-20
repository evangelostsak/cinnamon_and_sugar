<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="source/images/logo-dark.png">
    <img src="source/images/logo.png" alt="Cinnamon &amp; Sugar" width="220">
  </picture>
</p>

<h1 align="center">Cinnamon &amp; Sugar</h1>

<p align="center">
  Family-run Greek bakery and coffee shop in Prenzlauer Berg, Berlin.<br>
  <a href="https://cinnamon-und-sugar.de"><strong>cinnamon-und-sugar.de</strong></a>
</p>

---

| | |
| --- | --- |
| **Address** | Lychener Straße 63, 10437 Berlin |
| **Phone** | +49 30 65863658 |
| **Hours** | Mon closed · Tue–Thu 08:00–17:00 · Fri 08:00–18:00 · Sat–Sun 09:00–18:00 |
| **Order** | [Wolt](https://wolt.com/de/deu/berlin/restaurant/cinnamon-sugar) · [Uber Eats](https://www.ubereats.com/de-en/store/coffee-%26-bakery-cinnamon-and-sugar/b0k5kIpiRRClQ3yqFfLjxg) |
| **Follow** | [Instagram](https://www.instagram.com/greek_coffee_bakery/) · [Facebook](https://www.facebook.com/p/Cinnamon-and-Sugar-100090695405160/) · [TikTok](https://www.tiktok.com/@cinnamon.and.suga8) |

Four content pages plus Impressum and Datenschutz, 60 menu items,
German / English / Greek, dark mode. No framework, no database and no
third-party assets; the only server-side code emails the contact form.

## Structure

```
index.html  menu.html  about.html  contact.html
impressum.html  datenschutz.html                  ← all six are build output, committed

api/contact.js     emails the enquiry form
tools/build.js     the prerenderer
_headers           security headers and caching
_redirects         one legacy redirect

source/
  pages/base.html  shared navbar + footer   ← edit once, all pages follow
  pages/*.html     page content
  css/style.css    @font-face rules, then design tokens
  css/fonts-greek.css  injected only when the language is Greek
  fonts/           self-hosted woff2 + OFL licence
  js/template.js   language, theme, nav, photos
  js/contact.js    the enquiry form
  i18n/*.json      de (default) · en (fallback) · el
  images/menu/     one photo per item
```

`tools/build.js` renders `base.html` + each fragment + the German dictionary into
the four root pages, between `<!-- build:content -->` markers. `template.js` only
enhances the result, so the site works without JavaScript.

## Commands

```bash
node tools/build.js            # rebuild the root pages
node tools/build.js --check    # report stale output, write nothing
python3 -m http.server 8000
```

Run the build after editing anything under `source/pages/` or `source/i18n/`, and
commit the result. Bump `?v=` in the four callers after editing CSS or JS.

Under `python3 -m http.server` there is no `/api/contact`, so the form falls back
to the visitor's mail app. Use `wrangler pages dev` to exercise the function.

## Editing

| To change | Edit |
| --- | --- |
| Navbar, footer, hours | `source/pages/base.html` |
| Page text | `source/pages/<page>.html` |
| Wording in any language | `source/i18n/<lang>.json` |
| Colours, spacing, dark palette | tokens at the top of `source/css/style.css` |
| Menu items | `source/pages/menu.html` |
| Menu photos | add to `source/images/menu/` |

Menu item names and descriptions carry no `data-i18n` key — they stay exactly as
written, in any language.

`impressum.html` and `datenschutz.html` are German only: it is the language the
business trades in, and a translation that drifts out of step is worse than none.
Both still carry `[placeholders]` that need the legal entity's details.

Photos are matched by slug: lowercase, accents flattened, non-alphanumerics to
hyphens. `Freddo Espresso 0,3 l` → `freddo-espresso-0-3-l.jpg`. Missing files show
a placeholder.

## Contact form

Posts to `/api/contact`, which sends via [Resend](https://resend.com) and replies
to the visitor with a confirmation in their language. Unconfigured, it returns 501
and the form falls back to the mail app.

Environment variables (Pages → Settings → Variables, Production + Preview):

| | |
| --- | --- |
| `CONTACT_TO` | where enquiries land |
| `CONTACT_FROM` | verified Resend sender |
| `RESEND_API_KEY` | |

Diagnostics: `501 {"missing":[…]}` — variables absent. `502 {"provider":401}` —
bad key, `403` — sender not allowed, `422` — payload rejected.

Rate limited to 3 submissions per 10 minutes and 8 per hour per IP, plus a
per-instance ceiling; over the limit it returns `429`. Counters live in instance
memory, so this stops ordinary abuse but not a distributed flood — see below.

## Abuse protection

Pages are served from Cloudflare's edge and never reach application code, so
anything beyond the contact form is configured in the dashboard, not here.

What the free plan actually gives you:

- **DDoS mitigation** — automatic, unmetered, no configuration
- **WAF custom rules** — 5 rules. A *managed challenge* on `POST /api/contact`
  is the strongest single thing you can add: bots cannot solve it, people barely
  notice it
- **Under Attack Mode** (Security → Settings) — the manual switch if the site is
  ever being hammered
- **Rate limiting** — 1 rule, and the free tier allows only a 10-second counting
  window, a 10-second block and grouping by IP. That is burst protection, nothing
  more; it cannot express "3 messages per 10 minutes". The in-function limiter
  above remains the real policy, with the Cloudflare rule as a shield in front.

## Deploy

Cloudflare Pages, from `main`.

| | |
| --- | --- |
| Build command | `node tools/build.js` |
| Output directory | repository root |
| Function | `functions/api/contact.js` |
| Headers & redirects | `_headers`, `_redirects` |
| Analytics | Cloudflare Web Analytics, injected at the edge |

URLs are extensionless — `/menu`, not `/menu.html`. Cloudflare Pages enforces
this and it cannot be turned off; the old `.html` form 308s to the new one, so
existing links keep working.

`_headers` is edited by hand with one exception: the CSP allows a single inline
script — the pre-paint theme script — by SHA-256 hash, and `tools/build.js`
recomputes it. If the committed hash is stale the build rewrites it and exits
non-zero, failing the deploy rather than shipping a page whose theme script the
browser refuses to run.

Set `CONTACT_TO`, `CONTACT_FROM` and `RESEND_API_KEY` in the Pages project.

DNS runs on Cloudflare; IONOS is registrar only. The apex and `www` are proxied
CNAMEs managed by the Pages custom-domain setup. The records that must survive
any future DNS change are the Resend ones — `TXT send`, `MX send` and
`TXT resend._domainkey` — plus the Google Search Console `TXT` on the apex.

### Testing locally

```bash
node tools/build.js
npx wrangler pages dev . --port 8200
```

Put the three contact variables in `.dev.vars` (gitignored). This runs the real
Workers runtime, so `_headers`, `_redirects`, the 404 page and the function
behave as they will in production.

---

Built and maintained by Evangelos Tsakoudis.
