/* Assembles each page from source/pages/base.html + the page's fragment.
   Needs to be served over HTTP — fetch() can't read file:// URLs. */

(function () {
  "use strict";

  var script = document.currentScript;
  var page = (script && script.dataset.page) || "index";
  var root = (script && script.dataset.root) || "source/";

  var BASE_URL = root + "pages/base.html";
  var PAGE_URL = root + "pages/" + page + ".html";

  function get(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
      return res.text();
    });
  }

  /* Reads the `title:` line from the fragment's leading comment. */
  function readTitle(fragment) {
    var match = fragment.match(/<!--\s*title:\s*([^\n\-]+)/i);
    return match ? match[1].trim() : "Cinnamon & Sugar";
  }

  function fill(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : whole;
    });
  }

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
    var images = document.querySelectorAll(".item-photo img");

    Array.prototype.forEach.call(images, function (img) {
      var frame = img.closest(".item-photo");

      var reveal = function () {
        if (frame) frame.classList.add("has-photo");
      };

      var discard = function () {
        img.remove();
      };

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
    var scripts = scope.querySelectorAll("script");

    Array.prototype.forEach.call(scripts, function (old) {
      var fresh = document.createElement("script");

      Array.prototype.forEach.call(old.attributes, function (attr) {
        fresh.setAttribute(attr.name, attr.value);
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
      "<p class=\"form__note\">Details: " + String(err.message || err) + "</p>" +
      "</div>";
  }

  Promise.all([get(BASE_URL), get(PAGE_URL)])
    .then(function (parts) {
      var base = parts[0];
      var content = parts[1];

      document.title = readTitle(content);
      document.body.innerHTML = fill(base, {
        content: content,
        page: page,
        year: String(new Date().getFullYear())
      });

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
