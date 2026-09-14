/* Contact form: hands the enquiry to the visitor's mail client.
   No backend, so nothing is stored or sent server-side. */

(function () {
  var form = document.getElementById("enquiry-form");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var data = new FormData(form);
    var subject = "[" + data.get("topic") + "] Enquiry from " + data.get("name");
    var body =
      data.get("message") +
      "\n\n—\n" +
      data.get("name") +
      "\n" +
      data.get("email");

    window.location.href =
      "mailto:" + form.dataset.mailto +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  });
})();
