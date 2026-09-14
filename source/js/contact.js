/* Contact form. Posts to /api/contact, which emails the shop. If that endpoint
   is missing or not configured yet, falls back to opening the visitor's mail
   app so the form still gets the message through. */

(function () {
  "use strict";

  var form = document.getElementById("enquiry-form");
  if (!form) return;

  var button = form.querySelector('button[type="submit"]');
  var note = form.querySelector(".form__note");
  var status = form.querySelector(".form__status");
  var label = button ? button.textContent : "";

  function say(key, fallback, tone) {
    if (!status) return;
    status.textContent = (window.csTranslate && window.csTranslate(key)) || fallback;
    status.dataset.tone = tone;
    status.hidden = false;
  }

  function mailtoFallback(data) {
    var body = data.message + "\n\n—\n" + data.name + "\n" + data.email;
    window.location.href =
      "mailto:" + form.dataset.mailto +
      "?subject=" + encodeURIComponent("[" + data.topic + "] " + data.name) +
      "&body=" + encodeURIComponent(body);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var raw = new FormData(form);
    var data = {
      name: raw.get("name") || "",
      email: raw.get("email") || "",
      topic: raw.get("topic") || "",
      message: raw.get("message") || "",
      company: raw.get("company") || "",    // honeypot
      lang: document.documentElement.lang || "de"   // reply in the language they wrote in
    };

    if (button) { button.disabled = true; button.textContent = ""; }
    say("contact.sending", "Sending…", "busy");
    if (button) button.textContent = label;
    if (note) note.hidden = true;

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          say("contact.thanks-we-ve-got-your-message",
              "Thanks — we've got your message and will reply soon.", "ok");
          return;
        }
        /* 501 means the mail provider isn't wired up yet; 404 means the function
           isn't deployed. Either way the visitor should not lose their message. */
        if (res.status === 501 || res.status === 404) throw new Error("fallback");
        return res.json().catch(function () { return {}; }).then(function (out) {
          say("contact.that-didn-t-go-through-please",
              "That didn't go through. Please call us, or try again.", "bad");
          throw new Error(out.error || "send-failed");
        });
      })
      .catch(function (err) {
        if (String(err.message) === "fallback" || err.name === "TypeError") {
          if (note) note.hidden = false;
          if (status) status.hidden = true;
          mailtoFallback(data);
        }
      })
      .then(function () {
        if (button) { button.disabled = false; button.textContent = label; }
      });
  });
})();
