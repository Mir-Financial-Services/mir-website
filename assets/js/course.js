/* Mir Financial Services — course player
   Vanilla JS. Drives the free video course on course.html.
   Video host: YouTube (IFrame Player API).
   No gate: every lesson is open. An optional opt-in form sits under the
   player, and a one-time popup appears after the visitor has spent a
   little time on the page. Neither ever blocks a video.

   ============================================================
   1. FILL IN THE COURSE CONTENT BELOW
   2. FORM_ENDPOINT can stay as-is or point to a dedicated Formspree form
   ============================================================ */
(function () {
  "use strict";

  /* ---- 1. Course content ------------------------------------------------ */
  /* `yt` is the YouTube video id (the part after v= or youtu.be/).
     Leaving it as REPLACE_ID_x shows a "coming soon" panel for that lesson,
     so you can publish lessons as you record them. */
  var COURSE = {
    title: "REPLACE: Course title",
    blurb: "REPLACE: one or two sentences on what this course covers and who it is for.",
    lessons: [
      { n: 1,  yt: "REPLACE_ID_1",  title: "REPLACE: Lesson 1 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 2,  yt: "REPLACE_ID_2",  title: "REPLACE: Lesson 2 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 3,  yt: "REPLACE_ID_3",  title: "REPLACE: Lesson 3 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 4,  yt: "REPLACE_ID_4",  title: "REPLACE: Lesson 4 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 5,  yt: "REPLACE_ID_5",  title: "REPLACE: Lesson 5 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 6,  yt: "REPLACE_ID_6",  title: "REPLACE: Lesson 6 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 7,  yt: "REPLACE_ID_7",  title: "REPLACE: Lesson 7 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 8,  yt: "REPLACE_ID_8",  title: "REPLACE: Lesson 8 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 9,  yt: "REPLACE_ID_9",  title: "REPLACE: Lesson 9 title",  len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 10, yt: "REPLACE_ID_10", title: "REPLACE: Lesson 10 title", len: "0:00", desc: "REPLACE: what this lesson covers." },
      { n: 11, yt: "REPLACE_ID_11", title: "REPLACE: Lesson 11 title", len: "0:00", desc: "REPLACE: what this lesson covers." }
    ]
  };

  /* ---- 2. Opt-in form ------------------------------------------------- */
  var FORM_ENDPOINT = "https://formspree.io/f/moeqwdvl"; // shared with contact form; swap for a dedicated one if wanted
  var PROGRESS_KEY = "mir_course_progress_v1";
  var OPTIN_KEY = "mir_course_optin_v1";     // unset | "done" (submitted) | "dismissed" (closed the popup)
  var POPUP_DELAY_MS = 45000;                // popup appears after this long on the page
  var SPEEDS = [1, 1.25, 1.5, 2];

  /* -------------------------------------------------------------------- */

  var root = document.querySelector("[data-course]");
  if (!root) return;

  var listEl = root.querySelector("#lesson-list");
  var playerWrap = root.querySelector("#player-wrap");
  var speedBar = root.querySelector("#speed-bar");
  var titleEl = root.querySelector("#lesson-title");
  var descEl = root.querySelector("#lesson-desc");
  var progressText = root.querySelector("#course-progress");
  var progressBar = root.querySelector("#course-bar > i");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var player = null;        // YT.Player instance
  var apiReady = false;
  var pendingCue = null;    // lesson to load once API is ready
  var current = null;       // current lesson number

  function optinState() {
    try { return localStorage.getItem(OPTIN_KEY) || ""; } catch (e) { return ""; }
  }
  function setOptin(v) {
    try { localStorage.setItem(OPTIN_KEY, v); } catch (e) {}
  }

  /* ---- progress ---- */
  function getProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || []; } catch (e) { return []; }
  }
  function markDone(n) {
    var p = getProgress();
    if (p.indexOf(n) === -1) { p.push(n); }
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
    renderList();
    renderProgress();
    maybeShowPopup();   // a finished lesson is a good moment to ask
  }

  function lessonByN(n) {
    for (var i = 0; i < COURSE.lessons.length; i++) {
      if (COURSE.lessons[i].n === n) return COURSE.lessons[i];
    }
    return null;
  }

  /* ---- lesson list ---- */
  function renderList() {
    if (!listEl) return;
    var done = getProgress();
    listEl.innerHTML = "";
    COURSE.lessons.forEach(function (l) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lesson";
      if (l.n === current) btn.setAttribute("aria-current", "true");
      if (done.indexOf(l.n) !== -1) btn.classList.add("is-done");
      btn.innerHTML =
        '<span class="lesson__n">' + l.n + '</span>' +
        '<span class="lesson__title">' + escapeHtml(l.title) + '</span>' +
        '<span class="lesson__meta">' + escapeHtml(l.len) + '</span>';
      btn.addEventListener("click", function () { goToLesson(l.n, true); });
      listEl.appendChild(btn);
    });
  }

  function renderProgress() {
    var doneCount = getProgress().length;
    var total = COURSE.lessons.length;
    if (progressText) progressText.textContent = doneCount + " of " + total + " lessons watched";
    if (progressBar) progressBar.style.width = (total ? (doneCount / total) * 100 : 0) + "%";
  }

  /* ---- player ---- */
  function clearPlayer() {
    playerWrap.innerHTML = '<div id="course-player"></div>';
    player = null;
  }
  function buildPlayer(videoId) {
    clearPlayer();
    player = new YT.Player("course-player", {
      videoId: videoId,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: function () { applyStoredSpeed(); },
        onPlaybackRateChange: syncSpeedButtons,
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED && current != null) markDone(current);
        }
      }
    });
  }
  function comingSoon() {
    playerWrap.innerHTML = '<div class="player__msg"><div>' +
      '<h3>Video coming soon</h3><p>This lesson has not been published yet.</p></div></div>';
  }
  function loadLesson(n, autoplay) {
    var l = lessonByN(n);
    if (!l) return;
    if (/^REPLACE/.test(l.yt)) { comingSoon(); return; }
    if (!apiReady) { pendingCue = { n: n, autoplay: autoplay }; return; }
    if (!player) { buildPlayer(l.yt); }
    else { autoplay ? player.loadVideoById(l.yt) : player.cueVideoById(l.yt); }
  }

  function goToLesson(n, userClick) {
    var l = lessonByN(n);
    if (!l) return;
    current = n;
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("lesson", String(n));
      history.replaceState(null, "", url);
    } catch (e) {}
    if (titleEl) titleEl.textContent = "Lesson " + n + ". " + l.title;
    if (descEl) descEl.textContent = l.desc;
    renderList();
    loadLesson(n, !!userClick);
    if (userClick && window.innerWidth < 940) {
      playerWrap.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  /* ---- speed controls ---- */
  function applyStoredSpeed() {
    var r = parseFloat(sessionStorage.getItem("mir_course_rate")) || 1;
    if (player && player.setPlaybackRate) player.setPlaybackRate(r);
    syncSpeedButtons();
  }
  function syncSpeedButtons() {
    var r = player && player.getPlaybackRate ? player.getPlaybackRate() : 1;
    speedBar.querySelectorAll(".speed-btn").forEach(function (b) {
      b.setAttribute("aria-pressed", String(parseFloat(b.dataset.rate) === r));
    });
  }
  function initSpeedBar() {
    if (!speedBar) return;
    speedBar.innerHTML = '<span class="speed-bar__label">Speed</span>';
    SPEEDS.forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "speed-btn";
      b.dataset.rate = String(r);
      b.textContent = (r === 1 ? "Normal" : r + "×");
      b.setAttribute("aria-pressed", String(r === 1));
      b.addEventListener("click", function () {
        if (player && player.setPlaybackRate) {
          player.setPlaybackRate(r);
          try { sessionStorage.setItem("mir_course_rate", String(r)); } catch (e) {}
        }
      });
      speedBar.appendChild(b);
    });
  }

  /* ---- opt-in (shared submit for inline card + popup) ---- */
  function wireOptinForm(form, onSuccess) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form._gotcha && form._gotcha.value) return;
      if (!form.reportValidity()) return;
      var btn = form.querySelector("button[type=submit]");
      var original = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      var data = new FormData(form);
      data.append("_subject", "Course resources opt-in");
      data.append("source", "Tax course opt-in");
      fetch(FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("bad response");
          setOptin("done");
          if (onSuccess) onSuccess();
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = original; }
          var s = form.querySelector(".form-status");
          if (s) {
            s.textContent = "Something went wrong. You can also email info@mirfinancialservices.com.";
            s.className = "form-status is-visible form-status--err";
          }
        });
    });
  }

  function initInlineOptin() {
    var box = root.querySelector("#course-optin");
    if (!box) return;
    if (optinState() === "done") { box.hidden = true; return; }
    var form = box.querySelector("form");
    if (!form) return;
    wireOptinForm(form, function () {
      box.innerHTML = '<p class="optin__done">Thanks. We will send our free bookkeeping and tax resources your way.</p>';
      closePopup();
    });
  }

  /* ---- one-time popup ---- */
  var popupEl = null;
  var popupTimer = null;
  var popupShown = false;

  function maybeShowPopup() {
    if (popupShown || optinState()) return;   // already shown, submitted, or dismissed
    showPopup();
  }

  function showPopup() {
    if (popupEl || popupShown) return;
    popupShown = true;
    popupEl = document.createElement("div");
    popupEl.className = "optin-modal";
    popupEl.setAttribute("role", "dialog");
    popupEl.setAttribute("aria-modal", "true");
    popupEl.setAttribute("aria-label", "Free resources sign up");
    popupEl.innerHTML =
      '<div class="optin-modal__card">' +
        '<button type="button" class="optin-modal__close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<h3>Want to hear more about our free resources?</h3>' +
        '<p>Checklists, guides, and short courses that help you manage your bookkeeping and tax. Optional, and we will not spam you.</p>' +
        '<form novalidate>' +
          '<input type="text" name="name" placeholder="Name" autocomplete="name" aria-label="Name">' +
          '<input type="email" name="email" placeholder="Email" autocomplete="email" required aria-label="Email">' +
          '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
          '<div class="form-status" aria-live="polite"></div>' +
          '<button type="submit" class="btn btn--gold">Send them my way</button>' +
          '<button type="button" class="optin-modal__later">No thanks</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(popupEl);
    document.body.style.overflow = "hidden";

    var card = popupEl.querySelector(".optin-modal__card");
    setTimeout(function () { if (popupEl) popupEl.classList.add("is-in"); }, 20);

    popupEl.querySelector(".optin-modal__close").addEventListener("click", dismissPopup);
    popupEl.querySelector(".optin-modal__later").addEventListener("click", dismissPopup);
    popupEl.addEventListener("click", function (e) { if (e.target === popupEl) dismissPopup(); });
    document.addEventListener("keydown", onEscape);
    var firstField = card.querySelector('input[name="name"]');
    if (firstField && !reduce) setTimeout(function () { firstField.focus(); }, 120);

    wireOptinForm(card.querySelector("form"), function () {
      card.innerHTML = '<p class="optin__done">Thanks. Check your inbox soon.</p>';
      var inline = root.querySelector("#course-optin");
      if (inline) inline.hidden = true;
      setTimeout(closePopup, 1600);
    });
  }

  function onEscape(e) { if (e.key === "Escape") dismissPopup(); }
  function dismissPopup() {
    if (optinState() !== "done") setOptin("dismissed");
    closePopup();
  }
  function closePopup() {
    if (popupTimer) { clearTimeout(popupTimer); popupTimer = null; }
    document.removeEventListener("keydown", onEscape);
    document.body.style.overflow = "";
    if (!popupEl) return;
    popupEl.classList.remove("is-in");
    var el = popupEl; popupEl = null;
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 250);
  }

  /* ---- utils ---- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function startLesson() {
    var n = 1;
    try {
      var q = new URL(window.location.href).searchParams.get("lesson");
      if (q && lessonByN(parseInt(q, 10))) n = parseInt(q, 10);
    } catch (e) {}
    goToLesson(n, false);
  }

  /* ---- YouTube API bootstrap ---- */
  window.onYouTubeIframeAPIReady = function () {
    apiReady = true;
    if (pendingCue) {
      var p = pendingCue; pendingCue = null;
      loadLesson(p.n, p.autoplay);
    }
  };
  (function loadYT() {
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  })();

  /* ---- init ---- */
  var heading = document.querySelector("#course-title");
  var blurb = document.querySelector("#course-blurb");
  if (heading && !/^REPLACE/.test(COURSE.title)) heading.textContent = COURSE.title;
  if (blurb && !/^REPLACE/.test(COURSE.blurb)) blurb.textContent = COURSE.blurb;

  initSpeedBar();
  initInlineOptin();
  renderList();
  renderProgress();
  startLesson();

  if (!optinState()) {
    popupTimer = setTimeout(maybeShowPopup, POPUP_DELAY_MS);
  }
})();
