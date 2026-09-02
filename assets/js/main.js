/* Mir Financial Services — site behaviour
   Vanilla JS, no dependencies. Progressive enhancement only. */
(function () {
  "use strict";

  /* ---- Mobile navigation ---- */
  var toggle = document.querySelector(".nav__toggle");
  var navInner = document.querySelector(".nav__inner");
  if (toggle && navInner) {
    toggle.addEventListener("click", function () {
      var open = navInner.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open && window.innerWidth <= 960 ? "hidden" : "";
    });
    navInner.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navInner.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 960) {
        navInner.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
  }

  /* ---- Header shadow on scroll ---- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reveals.length && "IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".faq__q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var expanded = btn.getAttribute("aria-expanded") === "true";
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", String(!expanded));
      if (panel) {
        panel.style.maxHeight = expanded ? "0px" : panel.scrollHeight + "px";
      }
    });
  });

  /* ---- Active nav link ---- */
  var path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path || (path === "index.html" && href === "index.html")) {
      a.setAttribute("aria-current", "page");
    }
  });

  /* ---- Current year in footer ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---- Reviews carousel (rotating sets of cards) ---- */
  var reviews = document.querySelector("[data-reviews]");
  if (reviews) {
    var sets = Array.prototype.slice.call(reviews.querySelectorAll(".reviews__set"));
    var dotWrap = reviews.querySelector(".reviews__dots");
    var idx = 0;
    var timer = null;
    var DELAY = 6000;

    sets.forEach(function (s, i) {
      var d = document.createElement("button");
      d.className = "reviews__dot" + (i === 0 ? " is-active" : "");
      d.type = "button";
      d.setAttribute("aria-label", "Show review set " + (i + 1));
      d.addEventListener("click", function () { go(i); restart(); });
      if (dotWrap) dotWrap.appendChild(d);
    });

    function go(n) {
      sets[idx].classList.remove("is-active");
      if (dotWrap) dotWrap.children[idx].classList.remove("is-active");
      idx = (n + sets.length) % sets.length;
      sets[idx].classList.add("is-active");
      if (dotWrap) dotWrap.children[idx].classList.add("is-active");
    }
    function next() { go(idx + 1); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() { stop(); if (!reduce && sets.length > 1) timer = setInterval(next, DELAY); }
    function restart() { start(); }

    reviews.addEventListener("mouseenter", stop);
    reviews.addEventListener("mouseleave", start);
    reviews.addEventListener("focusin", stop);
    reviews.addEventListener("focusout", start);
    start();
  }

  /* ---- Contact form ---- */
  var form = document.querySelector("form[data-ajax]");
  if (form) {
    var status = form.querySelector(".form-status");
    var CONTACT_EMAIL = "info@mirfinancialservices.com";
    form.addEventListener("submit", function (e) {
      var endpoint = form.getAttribute("action") || "";
      var notConfigured = endpoint.indexOf("YOUR_FORM_ID") !== -1 || endpoint.indexOf("REPLACE") !== -1 || endpoint === "" || endpoint.charAt(0) === "#";

      if (notConfigured) {
        // No form backend connected yet: open the visitor's email client
        // pre-filled with what they typed, so the message still reaches us.
        e.preventDefault();
        if (!form.reportValidity()) { return; }
        var get = function (n) { var el = form.elements[n]; return el ? String(el.value || "").trim() : ""; };
        var name = (get("first_name") + " " + get("last_name")).trim();
        var lines = [
          "Name: " + name,
          "Email: " + get("email"),
          "Phone: " + get("phone"),
          "Interested in: " + get("topic"),
          "",
          get("message")
        ].join("\n");
        var subject = "Website enquiry" + (name ? " from " + name : "");
        window.location.href = "mailto:" + CONTACT_EMAIL +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(lines);
        showStatus("ok", "Opening your email app so you can send this to us. If nothing happens, write to " + CONTACT_EMAIL + ".");
        return;
      }

      e.preventDefault();
      if (!form.reportValidity()) { return; }
      var btn = form.querySelector("button[type=submit]");
      var original = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      // Formspree: the Accept: application/json header makes it return JSON
      // instead of redirecting, so we can show an inline confirmation.
      fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            showStatus("ok", "Thank you — your message has been sent. We'll reply within one business day.");
          } else {
            return res.json().then(function (d) {
              var msg = d && d.errors && d.errors.length ? d.errors[0].message : "Submission failed";
              throw new Error(msg);
            });
          }
        })
        .catch(function () {
          showStatus("err", "Something went wrong. Please email us directly at " + CONTACT_EMAIL + ".");
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = original; }
        });
    });
    function showStatus(kind, msg) {
      if (!status) return;
      status.textContent = msg;
      status.className = "form-status is-visible form-status--" + kind;
      status.setAttribute("role", "status");
      status.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
  }
})();
