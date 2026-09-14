<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="source/images/logo-dark.png">
    <img src="source/images/logo.png" alt="Cinnamon &amp; Sugar — Greek Coffee Bakery" width="300">
  </picture>
</p>

<h1 align="center">Cinnamon &amp; Sugar</h1>

<p align="center">
  A small family-run Greek bakery and coffee shop in Prenzlauer Berg, Berlin.<br>
  <a href="https://cinnamon-und-sugar.de"><strong>cinnamon-und-sugar.de</strong></a>
</p>

---

## The shop

Bougatsa, fresh bagels, brioche sandwiches and proper freddo espresso — baked and
brewed every morning on Lychener Straße.

|  |  |
| --- | --- |
| **Address** | Lychener Straße 63, 10437 Berlin |
| **Phone** | [+49 30 65863658](tel:+493065863658) |
| **Hours** | Mon closed · Tue–Thu 08:00–17:00 · Fri 08:00–18:00 · Sat–Sun 09:00–18:00 |
| **Order** | [Wolt](https://wolt.com/de/deu/berlin/restaurant/cinnamon-sugar) · [Uber Eats](https://www.ubereats.com/de-en/store/coffee-%26-bakery-cinnamon-and-sugar/b0k5kIpiRRClQ3yqFfLjxg) |
| **Follow** | [Instagram](https://www.instagram.com/greek_coffee_bakery/) · [Facebook](https://www.facebook.com/p/Cinnamon-and-Sugar-100090695405160/) · [TikTok](https://www.tiktok.com/@cinnamon.and.suga8) |

## The site

Four pages — home, menu, about, contact — carrying the full **60-item menu across
8 sections**, in **three languages**, with a **dark mode**.

No framework, no package manager, no database. Plain HTML, one stylesheet, two
small vanilla-JS files, and a 161-line Node script that stitches the pages
together at deploy time. The only server-side code is a single function that
emails the contact form.

## How it works

Pages are **prerendered**. `tools/build.js` takes the shared layout, drops each
page's content into it, applies the German dictionary, and writes the finished
HTML into the four files at the repository root:

```
source/pages/base.html  +  source/pages/menu.html  +  source/i18n/de.json
                            ↓  node tools/build.js
                        menu.html
```

The output goes between `<!-- build:content -->` markers, so rebuilding replaces
it rather than nesting it.

What arrives in the browser is therefore a complete, readable page — no
JavaScript required to see the menu. `template.js` then *enhances* it: language
switching, the theme toggle, the mobile nav, and menu photos. If it never runs,
the site still works.

The practical upshot is unchanged: **the navbar and footer live in exactly one
file.** Edit `source/pages/base.html`, run the build, and all four pages follow.

> `template.js` keeps its old `fetch()`-based assembly as a fallback, for the
> case where someone opens an unbuilt checkout. On a built page that path never
> runs.

## Structure

```
index.html  menu.html  about.html  contact.html   ← generated; do not hand-edit the body

api/
  contact.js       Vercel Function — emails the enquiry form

tools/
  build.js         the prerenderer (no dependencies)

source/
  pages/
    base.html      shared layout: sticky navbar + footer   ← edit once
    index.html     page content only
    menu.html      page content only (all 60 items)
    about.html     page content only
    contact.html   page content only
  css/style.css    the whole stylesheet — 107 design tokens at the top
  js/
    template.js    language, theme, nav and photo behaviour
    contact.js     the enquiry form
  i18n/
    de.json        188 keys — the default language
    en.json        188 keys — also the fallback for any missing key
    el.json        188 keys
  images/
    logo.png       navbar mark, transparent
    logo-dark.png  navbar mark for dark mode, on a cream disc
    favicon.png    browser tab icon
    shopfront.jpg  home hero
    bakery.jpg     about page
    menu/          one photo per menu item (60)

vercel.json        build command, redirects, security headers, caching
```

The four root pages **are** build output, but they are committed. That keeps the
repository deployable by any plain static host, and means a failed build never
takes the site down.

## Features

### Three languages

German is the default; English and Greek are one tap away. Language comes from
`?lang=de|en|el`, then `localStorage`, then the browser's own setting.

Text carries `data-i18n` (plain text), `data-i18n-html` (the few strings with
inline `<em>`/`<strong>`) or `data-i18n-attr` (alt text, aria-labels,
placeholders). The build applies German to the HTML but **leaves the attributes
in place**, so switching at runtime still works. Each dictionary layers over
English, so a missing key degrades to English rather than blanking the page.
`<html lang>`, `<title>` and the meta description all switch too.

**Menu item names and descriptions are deliberately untranslated** — they carry
no key at all, so they stay exactly as the shop writes them, mixed German and
English. That's by construction, not by discipline.

### Dark mode

A moon button at the right of the navbar. The whole palette is tokenised, so the
theme is a token swap on `:root[data-theme="dark"]` — a warm near-black rather
than pure black. An inline script in each `<head>` sets the theme before first
paint, from `localStorage` or the visitor's OS preference, so the page never
flashes light.

Photos are dimmed in dark mode via `--photo-filter`, since product shots on white
backgrounds glare against a dark page. The navbar logo swaps to a variant on a
cream disc, so the mark keeps its own background instead of dissolving.

### Menu photos

Every item has a picture slot. Drop a file into `source/images/menu/` named after
the item's slug and it appears — no HTML change:

```
Bougatsa-Feta          →  source/images/menu/bougatsa-feta.jpg
Freddo Espresso 0,3 l  →  source/images/menu/freddo-espresso-0-3-l.jpg
```

Lowercase, accents flattened (`ö`→`o`, `ß`→`ss`), non-alphanumerics collapsed to
hyphens. While a file is missing the card shows a striped "Photo coming soon"
placeholder.

Slots are a fixed **4:3** and images are *contained*, never cropped — so tall
bottle shots stay whole. Since every photo has a near-white background, the
letterboxing reads as part of the shot.

A photo that fails to load is **retried three times with backoff**, and again
when the browser reports it is back online. On a flaky mobile connection the
menu fills in late rather than arriving half-empty.

### Contact form

`source/js/contact.js` posts the enquiry to `/api/contact`, a Vercel Function
that emails the shop via [Resend](https://resend.com)'s HTTP API. Replies go
straight back to the customer, because the mail sets `reply_to` to their address.

The visitor then gets an **automatic acknowledgement**, in whichever of the three
languages they were reading — "we've got your message, someone will be with you
shortly" — with the shop's phone number and address. Its `reply_to` is the shop,
so a reply to the robot still lands somewhere a person reads.

That acknowledgement deliberately **does not quote the visitor's message.** The
endpoint is public: an email carrying arbitrary text out to an arbitrary address
from the shop's own domain is how a contact form becomes a spam relay and gets
the domain blocklisted. Only the name and the topic are echoed, both length-capped
and HTML-escaped. The shop's copy has the full message.

If the acknowledgement fails, the request still returns `200` — the enquiry is
already delivered, and that is what matters.

A hidden field catches bots: anything that fills it gets a cheerful `200` and
nothing is sent.

**If the function is not configured, the form falls back** to opening the
visitor's mail app with the message ready — the same behaviour the site had
before. The enquiry never dead-ends.

Set these in **Vercel → Settings → Environment Variables**:

| Variable | Example |
| --- | --- |
| `CONTACT_TO` | `bestellung@cinnamon-und-sugar.de` — where enquiries land |
| `CONTACT_FROM` | `Cinnamon & Sugar <noreply@cinnamon-und-sugar.de>` — a sender verified with Resend |
| `RESEND_API_KEY` | from the Resend dashboard |

Values are trimmed before use — a newline pasted into the dashboard alongside the
API key would otherwise make the `Authorization` header invalid, and that failure
is silent from the outside.

While the domain is unverified you can set `CONTACT_FROM` to
`Cinnamon & Sugar <onboarding@resend.dev>`, Resend's shared test sender. It only
delivers to the address on your Resend account — fine for testing, not for
customers, since the acknowledgement to *them* will not arrive.

When something goes wrong the endpoint says what:

| Response | Meaning |
| --- | --- |
| `501 {"missing":[…]}` | those environment variables are not set on this deployment |
| `502 {"provider":401}` | Resend rejected the API key |
| `502 {"provider":403}` | sender not allowed — verify the domain |
| `502 {"provider":422}` | Resend rejected the payload |
| `502 {"provider":"unreachable"}` | could not reach Resend |

The mailto fallback address lives separately, on the form's `data-mailto`
attribute in `source/pages/contact.html`.

## Security headers

`vercel.json` sets a Content-Security-Policy plus `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS and
`Cross-Origin-Opener-Policy` on every response.

The policy allows **no inline scripts except one**: the theme script in each
`<head>`, which must run before first paint. It is permitted by SHA-256 hash, and
`tools/build.js` recomputes that hash on every build:

- if the hash in `vercel.json` is stale, the build **rewrites it and exits 1**
- Vercel reads `vercel.json` *before* running the build, so a fix only takes
  effect on the next deploy — the non-zero exit is what stops a broken policy
  from shipping silently

So if you edit the theme script: run `node tools/build.js`, commit the updated
`vercel.json`, and deploy.

Everything else the page needs is same-origin, except Google Fonts
(`fonts.googleapis.com` / `fonts.gstatic.com`) and the OpenStreetMap embed.

## Editing

| To change… | Edit |
| --- | --- |
| Navbar, footer, opening hours | `source/pages/base.html` |
| A page's text | `source/pages/<page>.html` |
| Any wording, in any language | `source/i18n/<lang>.json` |
| Colours, spacing, fonts, dark palette | the tokens at the top of `source/css/style.css` |
| Menu items | `source/pages/menu.html` |
| Menu photos | add files to `source/images/menu/` |
| Where enquiries are emailed | the `CONTACT_TO` environment variable |

Adding a menu item means one `<article class="menu-item">` block — copy a
neighbour and change the name, description and image path.

**Then run `node tools/build.js`** and commit the regenerated root pages.

## Running locally

```bash
node tools/build.js                 # regenerate the four root pages
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

`node tools/build.js --check` reports stale output without writing anything —
useful before committing.

Two things do not work off a plain static server, and both are expected:

- `/api/contact` returns 404, so the form falls back to the mail app
- `/_vercel/insights/script.js` returns 404 (analytics is Vercel-side only)

**After changing CSS or JS, bump the `?v=` number** in all four caller pages
(currently `v=18`). Python's dev server sends no cache headers, so browsers hold
on to the old files otherwise.

## Deploying

Hosted on **Vercel**, served from `cinnamon-und-sugar.de`.

| | |
| --- | --- |
| **Build command** | `node tools/build.js` |
| **Output directory** | repository root |
| **Functions** | `api/contact.js` (Node) |
| **Analytics** | Vercel Web Analytics, via the script tag in each `<head>` |

DNS: an `A` record on the apex plus a `CNAME` on `www`, both pointing at
Vercel. Both hostnames serve production directly, and every page carries a
`rel="canonical"` pointing at the bare domain so search engines index one URL.

`vercel.json` also keeps a temporary redirect from `/defaultsite` to `/`, so
visitors whose browsers cached the old registrar landing page — which carried a
meta-refresh to that path — self-heal instead of hitting a 404.

## Credits

Designed, built and maintained by **Evangelos Tsakoudis**.
