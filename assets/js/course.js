/* Mir Financial Services — course player
   Vanilla JS. Drives the gated video course on course.html.
   Video host: YouTube (IFrame Player API). Gate: client-side lead capture.
   Comments: giscus (GitHub Discussions), one thread per lesson.

   ============================================================
   1. FILL IN THE COURSE CONTENT BELOW
   2. Set GISCUS_* once the giscus GitHub app is installed
   3. FORM_ENDPOINT can stay as-is or point to a dedicated Formspree form
   ============================================================ */
(function () {
  "use strict";

  /* ---- 1. Course content ------------------------------------------------ */
  /* `yt` is the YouTube video id (the part after v= or youtu.be/).
     First 3 lessons: free = true. Lessons 4+: free = false (gated).
     Keep gated videos UNLISTED on YouTube so the link is not public. */
  var COURSE = {
    title: "REPLACE: Course title",
    blurb: "REPLACE: one or two sentences on what this course covers and who it is for.",
    lessons: [
      { n: 1,  yt: "REPLACE_ID_1",  title: "REPLACE: Lesson 1 title",  len: "0:00", free: true,
        desc: "REPLACE: what this lesson covers." },
      { n: 2,  yt: "REPLACE_ID_2",  title: "REPLACE: Lesson 2 title",  len: "0:00", free: true,
        desc: "REPLACE: what this lesson covers." },
      { n: 3,  yt: "REPLACE_ID_3",  title: "REPLACE: Lesson 3 title",  len: "0:00", free: true,
        desc: "REPLACE: what this lesson covers." },
      { n: 4,  yt: "REPLACE_ID_4",  title: "REPLACE: Lesson 4 title",  len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 5,  yt: "REPLACE_ID_5",  title: "REPLACE: Lesson 5 title",  len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 6,  yt: "REPLACE_ID_6",  title: "REPLACE: Lesson 6 title",  len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 7,  yt: "REPLACE_ID_7",  title: "REPLACE: Lesson 7 title",  len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 8,  yt: "REPLACE_ID_8",  title: "REPLACE: Lesson 8 title",  len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 9,  yt: "REPLACE_ID_9",  title: "REPLACE: Lesson 9 title",  len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 10, yt: "REPLACE_ID_10", title: "REPLACE: Lesson 10 title", len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." },
      { n: 11, yt: "REPLACE_ID_11", title: "REPLACE: Lesson 11 title", len: "0:00", free: false,
        desc: "REPLACE: what this lesson covers." }
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

  /* ---- 3. Lead-capture form ------------------------------------------- */
  var FORM_ENDPOINT = "https://formspree.io/f/moeqwdvl"; // shared with contact form; swap for a dedicated one if wanted
  var ACCESS_KEY = "mir_course_access_v1";
  var PROGRESS_KEY = "mir_course_progress_v1";
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

  /* ---- storage helpers ---- */
  function hasAccess() {
    try { return localStorage.getItem(ACCESS_KEY) === "yes"; } catch (e) { return false; }
  }
  function grantAccess() {
    try { localStorage.setItem(ACCESS_KEY, "yes"); } catch (e) {}
  }
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
  function isLocked(lesson) { return !lesson.free && !hasAccess(); }

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
      if (isLocked(l)) btn.classList.add("is-locked");

      var tag = l.free
        ? '<span class="lesson__tag">Free</span>'
        : (isLocked(l)
            ? '<svg class="lesson__icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
            : '<span class="lesson__meta">' + l.len + '</span>');

      btn.innerHTML =
        '<span class="lesson__n">' + l.n + '</span>' +
        '<span><span class="lesson__title">' + escapeHtml(l.title) + '</span>' +
        (l.free ? ' <span class="lesson__meta">' + l.len + '</span>' : '') + '</span>' +
        '<span>' + tag + '</span>';

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

  /* ---- gate ---- */
  function showGate() {
    clearPlayer();
    var g = document.createElement("div");
    g.className = "gate";
    g.innerHTML =
      '<div class="gate__inner">' +
        '<svg class="gate__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        '<h3>Keep watching, free</h3>' +
        '<p>Lessons 4 to ' + COURSE.lessons.length + ' unlock instantly. Just tell us where to send updates. No spam.</p>' +
        '<form novalidate>' +
          '<input type="text" name="name" placeholder="Your name" autocomplete="name" required>' +
          '<input type="email" name="email" placeholder="Your email" autocomplete="email" required>' +
          '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
          '<div class="form-status" aria-live="polite"></div>' +
          '<button type="submit" class="btn btn--gold">Unlock the rest of the course</button>' +
          '<p class="gate__fine">We store your name and email to send course updates, in line with our <a href="privacy.html">Privacy Policy</a>. Unsubscribe anytime.</p>' +
        '</form>' +
      '</div>';
    playerWrap.appendChild(g);

    var form = g.querySelector("form");
    var status = g.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form._gotcha && form._gotcha.value) return;         // bot
      if (!form.reportValidity()) return;
      var btn = form.querySelector("button");
      btn.disabled = true; btn.textContent = "Unlocking…";
      var data = new FormData(form);
      data.append("_subject", "Tax course access: " + (data.get("name") || "new viewer"));
      data.append("source", "Tax course (" + COURSE.title + ")");
      fetch(FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("bad response");
          grantAccess();
          goToLesson(current, true);   // re-render everything, replace gate with the video
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Unlock the rest of the course";
          if (status) {
            status.textContent = "Something went wrong. Email info@mirfinancialservices.com and we'll send you the link.";
            status.className = "form-status is-visible form-status--err";
          }
        });
    });
  }

  /* ---- player ---- */
  function clearPlayer() {
    // remove gate + any existing iframe, restore the mount div
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

  function loadLesson(n, autoplay) {
    var l = lessonByN(n);
    if (!l) return;
    if (isLocked(l)) { showGate(); return; }
    if (/^REPLACE/.test(l.yt)) {
      playerWrap.innerHTML = '<div class="gate"><div class="gate__inner">' +
        '<h3>Video coming soon</h3><p>This lesson has not been published yet.</p></div></div>';
      return;
    }
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
    // update URL so the lesson is shareable / refresh-safe
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("lesson", String(n));
      history.replaceState(null, "", url);
    } catch (e) {}

    if (titleEl) titleEl.textContent = "Lesson " + n + ". " + l.title;
    if (descEl) descEl.textContent = l.desc;
    if (speedBar) speedBar.hidden = isLocked(l);

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

  /* ---- giscus ---- */
  function mountGiscus(n) {
    if (!commentsMount) return;
    if (!GISCUS.enabled || /YOUR_|REPLACE/.test(GISCUS.repoId)) {
      commentsMount.innerHTML = '<p class="comments__note">Comments load once the giscus app is connected. See README.</p>';
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
  renderList();
  renderProgress();
  startLesson();
})();
