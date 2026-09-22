(function () {
  "use strict";

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
  var footerStatus = document.getElementById("footerStatus");
  var STALE_MS = 15 * 60 * 1000;

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
            }
          })
          .catch(function () {
            if (dot) dot.className = "dot offline";
            if (statusText) statusText.textContent = "Status unavailable";
            if (footerStatus) footerStatus.textContent = "Can't reach the status service — server may be up anyway (just join!)";
          });
      });
  }

  fetchStatus();
  setInterval(fetchStatus, 60000);

  /* ---------- hidden navigation dot baseline ---------- */
  if (window.location.hash) {
    var el = document.querySelector(window.location.hash);
    if (el) el.scrollIntoView();
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