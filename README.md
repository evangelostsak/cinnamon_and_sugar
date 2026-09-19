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
vercel.json        build command, headers, redirects

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

Locally `/api/contact` and Vercel Analytics both 404; the form falls back to the
visitor's mail app.

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

Environment variables (Vercel, Production + Preview):

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

Pages are served from Vercel's CDN and never reach application code, so anything
beyond the contact form is configured in the dashboard, not here.

- DDoS mitigation is automatic and free on every plan
- A **challenge** WAF custom rule on `POST /api/contact` stops bots outright and
  is free on every plan; add a persistent action to block repeat offenders
- **Attack Challenge Mode** (Firewall tab) is the manual switch if the site is
  ever under load
- WAF **rate limiting** is a paid add-on — the in-function limit above covers the
  common case without it
- Set a spend limit under Billing so an attack cannot run up a bill

## Fonts

Fraunces, Karla, Noto Serif and Manrope are served from `source/fonts/`, not from
Google. That is deliberate: loading them from Google sends every visitor's IP
address to a third country before they can object, which German courts have
treated as a GDPR breach.

Only the Latin subsets load by default. Noto Serif and Manrope exist purely to
supply Greek glyphs that Fraunces and Karla lack, so the browser fetches them
only on a Greek page. To change a weight or family, regenerate the `@font-face`
block at the top of `style.css` and drop the new woff2 into `source/fonts/`.

## Deploy

Vercel, from `main`. Build command `node tools/build.js`, output at the repository
root. `vercel.json` sets a CSP plus the usual security headers; inline scripts are
allowed by hash, and the build fails if that hash is stale.

---

Built and maintained by Evangelos Tsakoudis.
