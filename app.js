(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia && (window.matchMedia("(pointer: coarse)").matches || !window.matchMedia("(pointer: fine)").matches);

  /* ---------- copy buttons ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      copyText(text).then(function () {
        var original = btn.textContent;
        btn.textContent = "COPIED!";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("copied");
        }, 1500);
      });
    });
  });

  /* ---------- join tabs ---------- */
  var tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) {
        p.classList.remove("active");
      });
      btn.classList.add("active");
      var panel = document.getElementById("tab-" + btn.getAttribute("data-tab"));
      if (panel) panel.classList.add("active");
    });
  });

  /* ---------- live server status ---------- */
  var JAVA_ADDR = "della-workload.tun.ply.gg:25565";
  var dot = document.getElementById("dot");
  var statusText = document.getElementById("statusText");
  var statusChecked = document.getElementById("statusChecked");
  var footerStatus = document.getElementById("footerStatus");
  var footerGlow = document.querySelector(".footer-glow");
  var statPlayers = document.getElementById("statPlayers");
  var statVersion = document.getElementById("statVersion");
  var statChecked = document.getElementById("statChecked");
  var STALE_MS = 15 * 60 * 1000;

  function fmtAgo(ts) {
    if (!ts) return "—";
    var diff = Date.now() - new Date(ts).getTime();
    if (diff < 60 * 1000) return "just now";
    if (diff < 60 * 60 * 1000) return Math.max(1, Math.floor(diff / 60000)) + "m ago";
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + "h ago";
    return Math.floor(diff / 86400000) + "d ago";
  }

  function renderStatus(data, stale) {
    var fresh = !stale;
    var on = data && data.online === true;

    if (dot) {
      dot.className = "dot " + (fresh && on ? "online" : "offline");
    }
    if (statusText) {
      if (!fresh) {
        statusText.textContent = "Status may be stale — server likely online, just join!";
      } else if (on) {
        statusText.textContent = "ONLINE — " + data.players.online + "/" + data.players.max + " playing";
      } else {
        statusText.textContent = "OFFLINE right now";
      }
    }
    if (statusChecked) {
      statusChecked.textContent = stale ? "stale" : "checked";
    }
    if (footerStatus) {
      if (stale) {
        footerStatus.textContent = "Last known: " + (data && data.online ? "online" : "offline") + " — data is stale, server may be up";
      } else if (on) {
        var names = (data.players.names || []).join(", ");
        footerStatus.textContent = names
          ? "Online now: " + names + "  (" + (data.version || "") + ")"
          : "Server online — nobody in the world right now";
      } else {
        footerStatus.textContent = "Server is offline — check back soon";
      }
    }
    if (footerGlow) {
      footerGlow.className = "footer-glow" + (fresh && on ? " online" : "");
    }
    if (statPlayers) {
      if (!fresh || !on) {
        statPlayers.textContent = on ? "offline" : "—";
      } else {
        statPlayers.textContent = data.players.online + "/" + data.players.max;
      }
    }
    if (statVersion) {
      statVersion.textContent = data && data.version ? data.version : "—";
    }
    if (statChecked) {
      var label = stale ? "stale" : (on ? "up" : "down");
      statChecked.textContent = label;
    }
  }

  function applyMcsrv(data) {
    if (statusText && dot && data && typeof data.online === "boolean") {
      renderStatus({
        online: data.online,
        players: {
          online: data.players ? data.players.online : 0,
          max: data.players ? data.players.max : 0,
          names: (data.players && data.players.list ? data.players.list : []).map(function (p) { return p.name; })
        },
        version: data.version
      }, false);
      return true;
    }
    return false;
  }

  function fetchStatus() {
    fetch("./status.json?v=" + Date.now())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && typeof data.online === "boolean") {
          var stale = !data.updatedAt || (Date.now() - new Date(data.updatedAt).getTime()) > STALE_MS;
          renderStatus(data, stale);
        } else {
          throw new Error("bad shape");
        }
      })
      .catch(function () {
        return fetch("https://api.mcsrvstat.us/3/" + encodeURIComponent(JAVA_ADDR), {
          headers: { "Accept": "application/json" }
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!applyMcsrv(data)) {
              if (dot) dot.className = "dot offline";
              if (statusText) statusText.textContent = "Status unavailable";
              if (footerStatus) footerStatus.textContent = "Can't reach the status service — server may be up anyway (just join!)";
              if (statPlayers) statPlayers.textContent = "—";
            }
          })
          .catch(function () {
            if (dot) dot.className = "dot offline";
            if (statusText) statusText.textContent = "Status unavailable";
            if (footerStatus) footerStatus.textContent = "Can't reach the status service — server may be up anyway (just join!)";
            if (statPlayers) statPlayers.textContent = "—";
          });
      });
  }

  fetchStatus();
  setInterval(fetchStatus, 60000);

  /* ---------- particle canvas ---------- */
  var canvas = document.getElementById("particle-canvas");
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var particles = [];
    var COLORS = ["61, 220, 132", "34, 211, 238", "139, 92, 246", "251, 191, 36"];
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var running = true;

    function resize() {
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function seed() {
      var count = Math.min(90, Math.floor(window.innerWidth / 18));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push(makeParticle(true));
      }
    }

    function makeParticle(randomY) {
      return {
        x: Math.random() * window.innerWidth,
        y: randomY ? Math.random() * window.innerHeight : -10,
        size: Math.random() * 2 + 0.6,
        speed: Math.random() * 0.4 + 0.12,
        drift: Math.random() * 0.4 - 0.2,
        alpha: Math.random() * 0.45 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    }

    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.y -= p.speed;
        p.x += p.drift + Math.sin((p.y + i) / 200) * 0.2;
        if (p.y < -10) particles[i] = makeParticle(false);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.color + ", " + p.alpha.toFixed(3) + ")";
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", function () { resize(); seed(); });
    resize();
    seed();
    draw();
  }

  /* ---------- cursor glow ---------- */
  var glow = document.getElementById("cursor-glow");
  if (glow && !reduceMotion && !isTouch) {
    var gx = -300, gy = -300, tx = -300, ty = -300;
    document.addEventListener("pointermove", function (e) {
      tx = e.clientX;
      ty = e.clientY;
      glow.style.opacity = "1";
    });
    document.addEventListener("pointerleave", function () {
      glow.style.opacity = "0";
    });
    (function loop() {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = "translate(" + gx + "px, " + gy + "px)";
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- 3D tilt on bento cards ---------- */
  if (!reduceMotion && !isTouch) {
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(1000px) rotateX(" + (-py * 8) + "deg) rotateY(" + (px * 8) + "deg) translateY(-6px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* ---------- voxel cubes in hero ---------- */
  var voxelField = document.getElementById("voxelField");
  if (voxelField && !reduceMotion) {
    var VOXELS = 8;
    var FACE_COLORS = ["139, 92, 246", "34, 211, 238", "61, 220, 132", "251, 191, 36"];
    var FACE_NAMES = ["front", "back", "left", "right", "top", "bottom"];
    for (var v = 0; v < VOXELS; v++) {
      var size = 30 + (v % 4) * 10;
      var cube = document.createElement("div");
      cube.className = "voxel-cube";
      cube.style.setProperty("--sz", size + "px");
      cube.style.setProperty("--half", (size / 2) + "px");
      cube.style.setProperty("--c", FACE_COLORS[v % FACE_COLORS.length]);
      cube.style.left = (5 + (v * 13 + (v % 3) * 4) % 88) + "%";
      cube.style.top = (12 + ((v * 37) % 55)) + "%";
      cube.style.animationDelay = ((v % 5) * -2.4) + "s";
      cube.style.animationDuration = (11 + (v % 4) * 3) + "s";
      for (var f = 0; f < FACE_NAMES.length; f++) {
        var face = document.createElement("span");
        face.className = "voxel-face voxel-" + FACE_NAMES[f];
        cube.appendChild(face);
      }
      voxelField.appendChild(cube);
    }
  }

  /* ---------- scroll progress + nav state + scroll-spy ---------- */
  var progressBar = document.getElementById("scroll-progress-bar");
  var nav = document.getElementById("nav");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("#navLinks a"));
  var sections = navLinks
    .map(function (a) {
      var hash = a.getAttribute("href");
      return hash && hash.charAt(0) === "#" ? document.querySelector(hash) : null;
    })
    .filter(Boolean);

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? (window.scrollY / h) * 100 : 0;
    if (progressBar) progressBar.style.width = p + "%";
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);

    if (sections.length && navLinks.length) {
      var mid = window.scrollY + window.innerHeight * 0.35;
      var current = null;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= mid) current = i;
      }
      if (current === null) current = 0;
      navLinks.forEach(function (a, idx) {
        a.classList.toggle("active", idx === current);
      });
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile nav ---------- */
  var hamburger = document.getElementById("navHamburger");
  var mobileLinks = document.getElementById("navLinks");
  if (hamburger && mobileLinks) {
    hamburger.addEventListener("click", function () {
      var open = mobileLinks.classList.toggle("open");
      hamburger.classList.toggle("active", open);
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobileLinks.classList.remove("open");
        hamburger.classList.remove("active");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- gallery lightbox ---------- */
  var shots = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lbClose = document.getElementById("lightboxClose");
  var lbPrev = document.getElementById("lightboxPrev");
  var lbNext = document.getElementById("lightboxNext");
  var lbIndex = 0;

  function lbItems() {
    return shots.filter(function (s) {
      var img = s.querySelector("img");
      return img && img.style.display !== "none";
    });
  }

  function openLightbox(i) {
    var items = lbItems();
    if (!items.length || !lightbox) return;
    lbIndex = (i + items.length) % items.length;
    showLightbox();
    lightbox.hidden = false;
    setTimeout(function () { lightbox.hidden = false; }, 30);
  }

  function showLightbox() {
    var items = lbItems();
    if (!items.length) return;
    var img = items[lbIndex].querySelector("img");
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "";
    if (lbPrev) lbPrev.disabled = items.length < 2;
    if (lbNext) lbNext.disabled = items.length < 2;
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
  }

  if (lightbox && lightboxImg) {
    shots.forEach(function (shot, i) {
      shot.addEventListener("click", function () {
        var img = shot.querySelector("img");
        if (!img || img.style.display === "none") return;
        openLightbox(i);
      });
    });
    if (lbClose) lbClose.addEventListener("click", closeLightbox);
    if (lbPrev) lbPrev.addEventListener("click", function (e) { e.stopPropagation(); openLightbox(lbIndex - 1); });
    if (lbNext) lbNext.addEventListener("click", function (e) { e.stopPropagation(); openLightbox(lbIndex + 1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") openLightbox(lbIndex - 1);
      if (e.key === "ArrowRight") openLightbox(lbIndex + 1);
    });
  }

  /* ---------- hidden navigation dot baseline ---------- */
  if (window.location.hash) {
    var el = document.querySelector(window.location.hash);
    if (el) setTimeout(function () { el.scrollIntoView(); }, 50);
  }
})();

/* ---------- scroll reveal ---------- */
(function () {
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && items.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          setTimeout(function () {
            el.classList.add("visible");
          }, parseInt(el.getAttribute("data-reveal") || "0", 10));
          io.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("visible"); });
  }
})();

/* ---------- file input label ---------- */
(function () {
  var input = document.getElementById("f-file");
  if (input) {
    input.addEventListener("change", function () {
      var lbl = document.querySelector(".file-label");
      if (lbl) {
        lbl.textContent = input.files && input.files.length
          ? "Selected: " + input.files[0].name
          : "Choose an image…";
      }
    });
  }
})();