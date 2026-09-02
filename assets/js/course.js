/* Mir Financial Services — course player
   Vanilla JS. Drives the free video course on course.html.
   Video host: YouTube (IFrame Player API).
   Comments: giscus (GitHub Discussions), one thread per lesson.
   No gate: every lesson is open. A soft, optional opt-in form sits under
   the player for people who want to hear about future resources.

   ============================================================
   1. FILL IN THE COURSE CONTENT BELOW
   2. Install the giscus GitHub app once (see COURSE-SETUP.md)
   3. FORM_ENDPOINT can stay as-is or point to a dedicated Formspree form
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

  /* ---- 2. giscus (comments) -------------------------------------------- */
  /* One-time setup: install https://github.com/apps/giscus on the
     Mir-Financial-Services/mir-website repo. The ids below are already
     correct for that repo + the "Q&A" discussion category. */
  var GISCUS = {
    repo: "Mir-Financial-Services/mir-website",
    repoId: "R_kgDOUMUQxg",
    category: "Q&A",
    categoryId: "DIC_kwDOUMUQxs4DEwCR",
    enabled: true   // set false to hide comments entirely
  };

  /* ---- 3. Opt-in form ------------------------------------------------- */
  var FORM_ENDPOINT = "https://formspree.io/f/moeqwdvl"; // shared with contact form; swap for a dedicated one if wanted
  var PROGRESS_KEY = "mir_course_progress_v1";
  var OPTIN_KEY = "mir_course_optin_v1";
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
  var commentsMount = root.querySelector("#comments-mount");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var player = null;        // YT.Player instance
  var apiReady = false;
  var pendingCue = null;    // lesson to load once API is ready
  var current = null;       // current lesson number

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
    playerWrap.innerHTML = '<div class="gate"><div class="gate__inner">' +
      '<h3>Video coming soon</h3><p>This lesson has not been published yet.</p></div></div>';
  }

  function loadLesson(n, autoplay) {
    var l = lessonByN(n);
    if (!l) return;
    if (/^REPLACE/.test(l.yt)) { comingSoon(); return; }
    if (!apiReady) { pendingCue = { n: n, autoplay: autoplay }; return; }
    if (!player) {
      buildPlayer(l.yt);
    } else {
      autoplay ? player.loadVideoById(l.yt) : player.cueVideoById(l.yt);
    }
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
    mountGiscus(n);

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

  /* ---- opt-in form (optional, never blocks anything) ---- */
  function initOptin() {
    var box = root.querySelector("#course-optin");
    if (!box) return;
    var form = box.querySelector("form");
    var status = box.querySelector(".form-status");
    var seen = false;
    try { seen = localStorage.getItem(OPTIN_KEY) === "done"; } catch (e) {}
    if (seen) { box.hidden = true; return; }
    if (!form) return;

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
          try { localStorage.setItem(OPTIN_KEY, "done"); } catch (e) {}
          box.innerHTML = '<p class="optin__done">Thanks. We will send our free bookkeeping and tax resources your way.</p>';
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = original; }
          if (status) {
            status.textContent = "Something went wrong. You can also email info@mirfinancialservices.com.";
            status.className = "form-status is-visible form-status--err";
          }
        });
    });
  }

  /* ---- giscus ---- */
  function mountGiscus(n) {
    if (!commentsMount) return;
    if (!GISCUS.enabled || /YOUR_|REPLACE/.test(GISCUS.repoId)) {
      commentsMount.innerHTML = '<p class="comments__note">Comments load once the giscus app is connected. See COURSE-SETUP.md.</p>';
      return;
    }
    commentsMount.innerHTML = "";
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.setAttribute("data-repo", GISCUS.repo);
    s.setAttribute("data-repo-id", GISCUS.repoId);
    s.setAttribute("data-category", GISCUS.category);
    s.setAttribute("data-category-id", GISCUS.categoryId);
    s.setAttribute("data-mapping", "specific");
    s.setAttribute("data-term", "course-lesson-" + n);
    s.setAttribute("data-strict", "1");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-emit-metadata", "0");
    s.setAttribute("data-input-position", "top");
    s.setAttribute("data-theme", "light");
    s.setAttribute("data-lang", "en");
    s.crossOrigin = "anonymous";
    s.async = true;
    commentsMount.appendChild(s);
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
  initOptin();
  renderList();
  renderProgress();
  startLesson();
})();
