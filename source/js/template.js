/* Assembles each page from source/pages/base.html + the page's fragment, then
   applies the language dictionary from source/i18n/<lang>.json.
   Needs to be served over HTTP — fetch() can't read file:// URLs. */

(function () {
  "use strict";

  var script = document.currentScript;
  var page = (script && script.dataset.page) || "index";
  var root = (script && script.dataset.root) || "source/";

  var BASE_URL = root + "pages/base.html";
  var PAGE_URL = root + "pages/" + page + ".html";

  var LANGS = ["de", "en", "el"];
  var FALLBACK = "en";      // dictionary consulted when a key is missing
  var DEFAULT = "de";       // what a first-time visitor sees

  /* Greek isn't in the Fraunces/Karla subsets, so pull faces that cover it. */
  var GREEK_FONTS =
    "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700" +
    "&family=Manrope:wght@400;500;600;700&display=swap";

  var dicts = {};

  /* ------------------------------------------------------------------ utils */

  function get(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
      return res.text();
    });
  }

  function getJSON(url) {
    return get(url).then(JSON.parse);
  }

  function readTitle(fragment) {
    var match = fragment.match(/<!--\s*title:\s*([^\n\-]+)/i);
    return match ? match[1].trim() : "Cinnamon & Sugar";
  }

  function fill(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole;
    });
  }

  /* --------------------------------------------------------------- language */

  function pickLang() {
    var fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (LANGS.indexOf(fromUrl) > -1) return fromUrl;

    var stored;
    try { stored = localStorage.getItem("cs-lang"); } catch (e) { /* private mode */ }
    if (LANGS.indexOf(stored) > -1) return stored;

    var nav = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) > -1 ? nav : DEFAULT;
  }

  function remember(lang) {
    try { localStorage.setItem("cs-lang", lang); } catch (e) { /* ignore */ }
  }

  function loadDict(lang) {
    if (dicts[lang]) return Promise.resolve(dicts[lang]);
    return getJSON(root + "i18n/" + lang + ".json").then(function (d) {
      dicts[lang] = d;
      return d;
    });
  }

  /* Target strings layered over English, so a missing key never blanks a node. */
  function dictFor(lang) {
    var jobs = [loadDict(FALLBACK)];
    if (lang !== FALLBACK) jobs.push(loadDict(lang));
    return Promise.all(jobs).then(function (parts) {
      var merged = {};
      parts.forEach(function (d) {
        Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
      });
      return merged;
    });
  }

  function loadGreekFonts() {
    if (document.getElementById("greek-fonts")) return;
    var link = document.createElement("link");
    link.id = "greek-fonts";
    link.rel = "stylesheet";
    link.href = GREEK_FONTS;
    document.head.appendChild(link);
  }

  function applyI18n(scope, dict, lang) {
    /* Dictionary values may carry {{year}} etc., same as the base template. */
    var vars = { year: String(new Date().getFullYear()), page: page };
    var t = function (key) {
      var v = dict[key];
      return v == null ? null : fill(v, vars);
    };

    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.dataset.i18n);
      if (v != null) el.textContent = v;
    });

    scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = t(el.dataset.i18nHtml);
      if (v != null) el.innerHTML = v;
    });

    scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.dataset.i18nAttr.split(",").forEach(function (pair) {
        var bits = pair.split(":");
        var v = t(bits.slice(1).join(":"));
        if (v != null) el.setAttribute(bits[0].trim(), v);
      });
    });

    document.documentElement.lang = lang;

    var title = t("meta.title." + page);
    if (title) document.title = title;

    var desc = t("meta.desc." + page);
    var tag = document.querySelector('meta[name="description"]');
    if (desc && tag) tag.setAttribute("content", desc);

    if (lang === "el") loadGreekFonts();

    scope.querySelectorAll(".lang__btn").forEach(function (btn) {
      var on = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function switchTo(lang) {
    dictFor(lang).then(function (dict) {
      applyI18n(document.body, dict, lang);
      remember(lang);
      var url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    });
  }

  /* -------------------------------------------------------------- behaviour */

  function initNav() {
    var current = document.querySelector('.nav__link[data-nav="' + page + '"]');
    if (current) {
      current.classList.add("is-active");
      current.setAttribute("aria-current", "page");
    }

    var bar = document.getElementById("site-nav");
    if (bar) {
      var onScroll = function () {
        bar.classList.toggle("is-stuck", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    document.querySelectorAll(".lang__btn").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTo(btn.dataset.lang); });
    });

    var toggle = document.querySelector(".nav__toggle");
    var menu = document.getElementById("nav-menu");
    if (!toggle || !menu) return;

    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  /* CSS shows a placeholder by default; only reveal an image that really loads. */
  function initPhotos() {
    document.querySelectorAll(".item-photo img").forEach(function (img) {
      var frame = img.closest(".item-photo");
      var reveal = function () { if (frame) frame.classList.add("has-photo"); };
      var discard = function () { img.remove(); };

      if (img.complete) {
        if (img.naturalWidth > 0) reveal();
        else discard();
      } else {
        img.addEventListener("load", reveal, { once: true });
        img.addEventListener("error", discard, { once: true });
      }
    });
  }

  /* innerHTML doesn't run <script> tags, so recreate any the fragment carries. */
  function runInlineScripts(scope) {
    scope.querySelectorAll("script").forEach(function (old) {
      var fresh = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (a) {
        fresh.setAttribute(a.name, a.value);
      });
      fresh.textContent = old.textContent;
      old.parentNode.replaceChild(fresh, old);
    });
  }

  function showError(err) {
    document.body.innerHTML =
      '<div class="tpl-error">' +
      "<h2>The template could not load</h2>" +
      "<p>This site assembles its pages with <code>fetch()</code>, which browsers " +
      "block on the <strong>file://</strong> protocol. Serve the folder over HTTP " +
      "instead — from the project root run:</p>" +
      "<code>python3 -m http.server 8000</code>" +
      '<p>…then open <a href="http://localhost:8000">http://localhost:8000</a>.</p>' +
      '<p class="form__note">Details: ' + String(err.message || err) + "</p>" +
      "</div>";
  }

  /* ------------------------------------------------------------------- boot */

  var lang = pickLang();

  Promise.all([get(BASE_URL), get(PAGE_URL), dictFor(lang)])
    .then(function (parts) {
      var base = parts[0], content = parts[1], dict = parts[2];

      document.title = readTitle(content);
      document.body.innerHTML = fill(base, {
        content: content,
        page: page,
        year: String(new Date().getFullYear())
      });

      /* Synchronous, so the browser never paints the untranslated markup. */
      applyI18n(document.body, dict, lang);

      initNav();
      initPhotos();
      runInlineScripts(document.body);

      if (window.location.hash) {
        var target = document.querySelector(window.location.hash);
        if (target) target.scrollIntoView();
      }

      document.body.dataset.page = page;
    })
    .catch(showError);
})();
