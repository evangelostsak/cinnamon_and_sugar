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
| **Address** | Lychener Straße 63, 10437 Berlin ||
| **Hours** | Mon closed · Tue–Thu 08:00–17:00 · Fri 08:00–18:00 · Sat–Sun 09:00–18:00 |
| **Order** | [Wolt](https://wolt.com/de/deu/berlin/restaurant/cinnamon-sugar) · [Uber Eats](https://www.ubereats.com/de-en/store/coffee-%26-bakery-cinnamon-and-sugar/b0k5kIpiRRClQ3yqFfLjxg) |
| **Follow** | [Instagram](https://www.instagram.com/greek_coffee_bakery/) · [Facebook](https://www.facebook.com/p/Cinnamon-and-Sugar-100090695405160/) · [TikTok](https://www.tiktok.com/@cinnamon.and.suga8) |

## The site

Four pages — home, menu, about, contact — carrying the full **60-item menu across
8 sections**, in **three languages**, with a **dark mode**.

**No build step, no dependencies, no backend, no database.** Plain HTML, one CSS
file and one 325-line vanilla-JS file. Point any static host at the repository
root and it deploys.

## How it works

Each page at the root is a thin *caller* — it sets the `<title>`, loads the
stylesheet, and names its content fragment:

```html
<script src="source/js/template.js?v=15" data-page="menu" data-root="source/"></script>
```

`template.js` then fetches `source/pages/base.html` (the shared navbar and
footer), fetches the page's own fragment, substitutes the `content` / `page` /
`year` placeholders, injects the result, and applies the language dictionary —
all before the first paint, so nothing flashes.

The practical upshot: **the navbar and footer live in exactly one file.** Change
`base.html` and all four pages follow.

## Structure

```
index.html  menu.html  about.html  contact.html   ← callers (title, meta, canonical)

source/
  pages/
    base.html      shared layout: sticky navbar + footer   ← edit once
    index.html     page content only
    menu.html      page content only (all 60 items)
    about.html     page content only
    contact.html   page content only
  css/style.css    the whole stylesheet — 107 design tokens at the top
  js/template.js   assembles pages, runs i18n, theme and photo logic
  i18n/
    de.json        185 keys — the default language
    en.json        185 keys — also the fallback for any missing key
    el.json        185 keys
  images/
    logo.png       navbar mark, transparent
    logo-dark.png  navbar mark for dark mode, on a cream disc
    favicon.jpg    browser tab icon
    shopfront.jpg  home hero
    bakery.jpg     about page
    menu/          one photo per menu item
```

## Features

### Three languages

German is the default; English and Greek are one tap away. Language comes from
`?lang=de|en|el`, then `localStorage`, then the browser's own setting.

Text carries `data-i18n` (plain text), `data-i18n-html` (the few strings with
inline `<em>`/`<strong>`) or `data-i18n-attr` (alt text, aria-labels,
placeholders). Each dictionary layers over English, so a missing key degrades to
English rather than blanking the page. `<html lang>`, `<title>` and the meta
description all switch too.

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
backgrounds glare against a dark page.

### Menu photos

Every item has a picture slot. Drop a file into `source/images/menu/` named after
the item's slug and it appears — no HTML change:

```
Bougatsa-Feta          →  source/images/menu/bougatsa-feta.jpg
Freddo Espresso 0,3 l  →  source/images/menu/freddo-espresso-0-3-l.jpg
```

Lowercase, accents flattened (`ö`→`o`, `ß`→`ss`), non-alphanumerics collapsed to
hyphens. While a file is missing the card shows a striped "Photo coming soon"
placeholder; `template.js` swaps it for the real image once it loads.

Slots are a fixed **4:3** and images are *contained*, never cropped — so tall
bottle shots stay whole. Since every photo has a near-white background, the
letterboxing reads as part of the shot.

## Editing

| To change… | Edit |
| --- | --- |
| Navbar, footer, opening hours | `source/pages/base.html` |
| A page's text | `source/pages/<page>.html` |
| Any wording, in any language | `source/i18n/<lang>.json` |
| Colours, spacing, fonts, dark palette | the tokens at the top of `source/css/style.css` |
| Menu items | `source/pages/menu.html` |
| Menu photos | add files to `source/images/menu/` |

Adding a menu item means one `<article class="menu-item">` block — copy a
neighbour and change the name, description and image path.

## Running locally

Pages are assembled with `fetch()`, which browsers block on `file://`. Serve the
folder over HTTP rather than double-clicking:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. If you do open it from the filesystem, the
page prints that instruction instead of failing silently.

**After changing CSS or JS, bump the `?v=` number** in all four caller pages.
Python's dev server sends no cache headers, so browsers hold on to the old files
otherwise. Production is unaffected — Vercel revalidates HTML.

## Deploying

Hosted on **Vercel**, served from `cinnamon-und-sugar.de`.

- **Build command:** none
- **Publish directory:** repository root
- **Runtime:** none

DNS: an `A` record on the apex plus a `CNAME` on `www`, both pointing at
Vercel. Both hostnames serve production directly, and every page carries a
`rel="canonical"` pointing at the bare domain so search engines index one URL.