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
  var activeDict = {};   // last applied, so the theme toggle can relabel

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

  /* ------------------------------------------------------------------ theme */

  /* The icon is swapped in JS, not CSS, so a stale stylesheet can never leave
     both glyphs showing. */
  var ICON = {
    light: "M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 14 11.69 1 1 0 0 0-.36-1.05Z",
    dark: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-6a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1ZM1 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Zm18 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1ZM4.22 4.22a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 0 1-1.42 1.41L4.22 5.64a1 1 0 0 1 0-1.42Zm12.73 12.73a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 0 1-1.42 1.41l-1.41-1.41a1 1 0 0 1 0-1.42ZM19.78 4.22a1 1 0 0 1 0 1.42l-1.41 1.41a1 1 0 0 1-1.42-1.41l1.42-1.42a1 1 0 0 1 1.41 0ZM7.05 16.95a1 1 0 0 1 0 1.42l-1.42 1.41a1 1 0 0 1-1.41-1.41l1.41-1.42a1 1 0 0 1 1.42 0Z"
  };

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  /* Everything that has to change with the theme: the brand mark (the artwork is
     dark line work, so dark mode uses a version on a white disc), plus the
     toggle's icon and label — the label depends on state, so it can't be a
     plain data-i18n binding. */
  function paintTheme() {
    var dark = currentTheme() === "dark";

    var mark = document.querySelector(".brand__mark");
    if (mark) {
      var src = dark ? mark.dataset.srcDark : mark.dataset.srcLight;
      if (src && mark.getAttribute("src") !== src) mark.setAttribute("src", src);
    }

    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    var text = activeDict[dark ? "base.switch-to-light-mode" : "base.switch-to-dark-mode"];
    btn.setAttribute("aria-pressed", String(dark));

    var path = btn.querySelector(".theme-toggle__icon path");
    if (path) path.setAttribute("d", dark ? ICON.dark : ICON.light);

    if (text) {
      btn.setAttribute("aria-label", text);
      btn.setAttribute("title", text);
    }
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("cs-theme", theme); } catch (e) { /* private mode */ }
    paintTheme();
  }

  function applyI18n(scope, dict, lang) {
    activeDict = dict;
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

    paintTheme();

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

    var theme = document.querySelector(".theme-toggle");
    if (theme) {
      theme.addEventListener("click", function () {
        setTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    }

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
