#!/usr/bin/env node
/* Prerenders each page from base.html + fragment + the German dictionary.
   --check fails on stale output instead of writing. */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "source");
const PAGES = ["index", "menu", "about", "contact", "impressum", "datenschutz"];
const DEFAULT_LANG = "de";
const FALLBACK_LANG = "en";

const read = (...p) => fs.readFileSync(path.join(...p), "utf8");
const json = (...p) => JSON.parse(read(...p));

/* Markers so a rebuild replaces its own output rather than nesting it. */
const OPEN = "<!-- build:content -->";
const CLOSE = "<!-- /build:content -->";

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = s => s.replace(/[&<>"]/g, c => ENTITIES[c]);

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole);
}

/* Same as template.js, on the HTML string. Attributes stay, so runtime switching
   still works. */
function localise(html, dict, vars) {
  const t = key => (dict[key] == null ? null : fill(dict[key], vars));

  // <tag ... data-i18n="key" ...>anything</tag>  ->  translated text
  html = html.replace(
    /(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (whole, open, tag, key, body, close) => {
      const v = t(key);
      return v == null ? whole : open + escapeHtml(v) + close;
    });

  html = html.replace(
    /(<(\w+)\b[^>]*\bdata-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (whole, open, tag, key, body, close) => {
      const v = t(key);
      return v == null ? whole : open + v + close;
    });

  // data-i18n-attr="alt:key,aria-label:key"
  html = html.replace(/<(\w+)\b[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>/g, openTag => {
    const spec = openTag.match(/data-i18n-attr="([^"]+)"/)[1];
    let out = openTag;
    for (const pair of spec.split(",")) {
      const i = pair.indexOf(":");
      if (i < 0) continue;
      const attr = pair.slice(0, i).trim();
      const v = t(pair.slice(i + 1).trim());
      if (v == null) continue;
      const re = new RegExp("\\b" + attr + '="[^"]*"');
      out = re.test(out) ? out.replace(re, attr + '="' + escapeHtml(v) + '"')
                         : out.replace(/^<(\w+)/, "<$1 " + attr + '="' + escapeHtml(v) + '"');
    }
    return out;
  });

  return html;
}

function buildPage(page, base, dict) {
  const fragment = read(SRC, "pages", page + ".html");
  const vars = { content: fragment, page, year: String(new Date().getFullYear()) };
  const body = localise(fill(base, vars), dict, vars);

  let caller = read(ROOT, page + ".html");
  const block = OPEN + "\n" + body + "\n" + CLOSE;

  // the shell must agree with the prerendered language
  caller = caller.replace(/<html lang="[^"]*"/, '<html lang="' + DEFAULT_LANG + '"');

  const title = dict["meta.title." + page];
  if (title) caller = caller.replace(/<title>[\s\S]*?<\/title>/,
    "<title>" + escapeHtml(title) + "</title>");

  const desc = dict["meta.desc." + page];
  if (desc) caller = caller.replace(/(<meta name="description" content=")[^"]*(")/,
    "$1" + escapeHtml(desc) + "$2");

  // replace a previous build, else insert into the empty <body>
  if (caller.includes(OPEN))
    return caller.replace(new RegExp(OPEN + "[\\s\\S]*?" + CLOSE), block);

  return caller.replace(/(<body[^>]*>)/, "$1\n" + block);
}

/* Inline scripts are allowed by hash. Vercel reads vercel.json before this runs,
   so a fix here lands on the next deploy — hence the non-zero exit. */
function inlineHashes(pages) {
  const seen = new Set();
  for (const html of pages)
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
      seen.add("'sha256-" + crypto.createHash("sha256").update(m[1]).digest("base64") + "'");
  return [...seen].sort();
}

function syncCsp(pages) {
  const file = path.join(ROOT, "vercel.json");
  const before = read(ROOT, "vercel.json");
  const wanted = inlineHashes(pages).join(" ");

  const after = before.replace(/(script-src 'self')((?: 'sha256-[^']*')*)/,
    (whole, head) => head + (wanted ? " " + wanted : ""));

  if (after === before) return true;
  fs.writeFileSync(file, after);
  console.error("\n  vercel.json: CSP script hashes were stale — rewritten.");
  console.error("  Commit vercel.json and redeploy; this build serves the old policy.");
  return false;
}

function main() {
  const check = process.argv.includes("--check");
  const base = read(SRC, "pages", "base.html");
  const dict = Object.assign({}, json(SRC, "i18n", FALLBACK_LANG + ".json"),
                                 json(SRC, "i18n", DEFAULT_LANG + ".json"));

  let stale = 0;
  for (const page of PAGES) {
    const out = buildPage(page, base, dict);
    const file = path.join(ROOT, page + ".html");
    const current = read(ROOT, page + ".html");

    if (current === out) { console.log(`  ${page}.html  unchanged`); continue; }
    if (check) { console.log(`  ${page}.html  STALE`); stale++; continue; }

    fs.writeFileSync(file, out);
    const items = (out.match(/class="menu-item"/g) || []).length;
    console.log(`  ${page}.html  built  ${(out.length / 1024).toFixed(0)}K` +
                (items ? `  ${items} menu items` : ""));
  }

  if (check && stale) {
    console.error(`\n${stale} page(s) stale — run: node tools/build.js`);
    process.exit(1);
  }

  const built = PAGES.map(p => read(ROOT, p + ".html"));
  if (!syncCsp(built) && !check) process.exit(1);
}

main();
