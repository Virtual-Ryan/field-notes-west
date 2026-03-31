/* ──────────────────────────────────────────────
   Field Notes West — main.js
   All interactive features in one file.
   Optimized: rAF-throttled handlers, merged mousemove,
   fixed filter race conditions, fixed throw velocity.
   ────────────────────────────────────────────── */

(function () {
  "use strict";

  var isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  /* ── Shared mouse state (single mousemove handler) ── */

  var mouseX = window.innerWidth / 2;
  var mouseY = window.innerHeight / 2;
  var cursorRAF = false;

  /* ── 1. Progress bar (rAF-throttled) ── */

  var progressBar = document.querySelector(".progress-bar");
  var scrollTicking = false;

  window.addEventListener("scroll", function () {
    if (!progressBar) return;
    if (!scrollTicking) {
      requestAnimationFrame(function () {
        var pct =
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        progressBar.style.transform = "scaleX(" + (pct / 100) + ")";
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });

  /* ── 2. Card reveal (IntersectionObserver) ── */

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var card = entry.target;
            var allCards = Array.from(document.querySelectorAll(".card"));
            var idx = allCards.indexOf(card);
            card.style.transitionDelay = (idx % 3) * 80 + "ms";
            card.classList.add("visible");
            observer.unobserve(card);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".card").forEach(function (card) {
      observer.observe(card);
    });
  }

  /* ── 3. Filter animations (with race condition fix) ── */

  var filterTimeoutA = null;
  var filterTimeoutB = null;

  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      // Cancel any pending filter transitions
      if (filterTimeoutA) { clearTimeout(filterTimeoutA); filterTimeoutA = null; }
      if (filterTimeoutB) { clearTimeout(filterTimeoutB); filterTimeoutB = null; }

      document
        .querySelectorAll("[data-filter]")
        .forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");

      var filter = button.dataset.filter;
      var cards = document.querySelectorAll(".card");

      // Phase 1: fade out cards that don't match
      cards.forEach(function (card) {
        var matches = filter === "all" || card.dataset.cat === filter;
        if (!matches && !card.classList.contains("hidden")) {
          card.classList.add("filtering-out");
        }
      });

      // Phase 2: after fade out, hide them and show matching
      filterTimeoutA = setTimeout(function () {
        var enterIndex = 0;
        cards.forEach(function (card) {
          var matches = filter === "all" || card.dataset.cat === filter;
          if (!matches) {
            card.classList.add("hidden");
            card.classList.remove("filtering-out", "visible");
          } else {
            card.classList.remove("hidden", "filtering-out");
            card.classList.add("visible", "filtering-in");
            card.style.transitionDelay = enterIndex * 50 + "ms";
            enterIndex++;
          }
        });

        filterTimeoutB = setTimeout(function () {
          cards.forEach(function (card) {
            card.classList.remove("filtering-in");
          });
        }, 400);
      }, 250);
    });
  });

  /* ── 4. Physics photo gallery ── */

  var scatterToggle = document.getElementById("scatter-toggle");
  var scatterActive = false;
  var physicsCards = [];
  var physicsRAF = null;
  var dragCard = null;
  var dragOffsetX = 0;
  var dragOffsetY = 0;

  // Velocity history for accurate throw (tracks last 3 positions)
  var mouseHistory = [];
  var HISTORY_SIZE = 4;

  function recordMousePosition(x, y) {
    mouseHistory.push({ x: x, y: y, t: performance.now() });
    if (mouseHistory.length > HISTORY_SIZE) mouseHistory.shift();
  }

  function getThrowVelocity() {
    if (mouseHistory.length < 2) return { vx: 0, vy: 0 };
    var oldest = mouseHistory[0];
    var newest = mouseHistory[mouseHistory.length - 1];
    var dt = (newest.t - oldest.t) || 1;
    // Scale to roughly per-frame velocity (16ms)
    return {
      vx: ((newest.x - oldest.x) / dt) * 16 * 0.5,
      vy: ((newest.y - oldest.y) / dt) * 16 * 0.5,
    };
  }

  if (scatterToggle && !isTouchDevice) {
    scatterToggle.addEventListener("click", function () {
      scatterActive = !scatterActive;
      scatterToggle.classList.toggle("active", scatterActive);

      var grid = document.querySelector(".grid");
      var cards = document.querySelectorAll(".card");

      if (scatterActive) {
        physicsCards = [];
        cards.forEach(function (card) {
          var rect = card.getBoundingClientRect();
          physicsCards.push({
            el: card,
            x: rect.left,
            y: rect.top,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 4,
            rot: 0,
            rotV: (Math.random() - 0.5) * 3,
            w: rect.width,
            h: rect.height,
          });
        });

        grid.classList.add("scatter-active");

        physicsCards.forEach(function (pc) {
          pc.el.classList.add("scattered");
          pc.el.style.left = pc.x + "px";
          pc.el.style.top = pc.y + "px";
          pc.el.style.width = pc.w + "px";
        });

        startPhysics();
      } else {
        stopPhysics();
        grid.classList.remove("scatter-active");
        cards.forEach(function (card) {
          card.classList.remove("scattered", "dragging");
          card.style.left = "";
          card.style.top = "";
          card.style.width = "";
          card.style.transform = "";
        });
      }
    });

    document.addEventListener("mousedown", function (e) {
      if (!scatterActive) return;
      var card = e.target.closest(".card.scattered");
      if (!card) return;

      e.preventDefault();
      var pc = physicsCards.find(function (p) { return p.el === card; });
      if (!pc) return;

      dragCard = pc;
      dragOffsetX = e.clientX - pc.x;
      dragOffsetY = e.clientY - pc.y;
      card.classList.add("dragging");
      mouseHistory = [];
      recordMousePosition(e.clientX, e.clientY);
    });

    document.addEventListener("mouseup", function (e) {
      if (dragCard) {
        var vel = getThrowVelocity();
        dragCard.vx = vel.vx;
        dragCard.vy = vel.vy;
        dragCard.el.classList.remove("dragging");
        dragCard = null;
        mouseHistory = [];
      }
    });
  } else if (scatterToggle && isTouchDevice) {
    scatterToggle.style.display = "none";
  }

  function startPhysics() {
    function tick() {
      var W = window.innerWidth;
      var H = window.innerHeight;

      physicsCards.forEach(function (pc) {
        if (pc === dragCard) {
          pc.el.style.left = pc.x + "px";
          pc.el.style.top = pc.y + "px";
          return;
        }

        // Gravity
        pc.vy += 0.3;

        // Mouse repulsion
        var cx = pc.x + pc.w / 2;
        var cy = pc.y + pc.h / 2;
        var dx = cx - mouseX;
        var dy = cy - mouseY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          var force = (200 - dist) / 200 * 2;
          pc.vx += (dx / dist) * force;
          pc.vy += (dy / dist) * force;
        }

        // Damping
        pc.vx *= 0.88;
        pc.vy *= 0.88;
        pc.rotV *= 0.92;

        // Update position
        pc.x += pc.vx;
        pc.y += pc.vy;
        pc.rot += pc.rotV;

        // Wall bounce
        if (pc.x < 0) { pc.x = 0; pc.vx *= -0.6; pc.rotV += pc.vy * 0.02; }
        if (pc.x + pc.w > W) { pc.x = W - pc.w; pc.vx *= -0.6; pc.rotV -= pc.vy * 0.02; }
        if (pc.y < 0) { pc.y = 0; pc.vy *= -0.6; }
        if (pc.y + pc.h > H) {
          pc.y = H - pc.h;
          pc.vy *= -0.6;
          pc.rotV += pc.vx * 0.01;
          pc.vx *= 0.95;
        }

        pc.el.style.left = pc.x + "px";
        pc.el.style.top = pc.y + "px";
        pc.el.style.transform = "rotate(" + pc.rot + "deg)";
      });

      physicsRAF = requestAnimationFrame(tick);
    }

    physicsRAF = requestAnimationFrame(tick);
  }

  function stopPhysics() {
    if (physicsRAF) {
      cancelAnimationFrame(physicsRAF);
      physicsRAF = null;
    }
    physicsCards = [];
  }

  /* ── 5. Dark mode ── */

  var darkToggle = document.getElementById("dark-toggle");

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fnw-theme", theme);
    if (darkToggle) {
      darkToggle.textContent = theme === "dark" ? "\u263C" : "\u25D1";
    }
  }

  if (darkToggle) {
    var saved = localStorage.getItem("fnw-theme");
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    darkToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* ── 7. Custom cursor (unified mousemove, rAF-throttled) ── */

  var cursor = document.querySelector(".custom-cursor");
  var cursorX = 0;
  var cursorY = 0;
  var cursorVisible = false;

  // Single global mousemove handler — updates cursor, physics drag, and mouse position
  document.addEventListener("mousemove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorX = e.clientX;
    cursorY = e.clientY;

    // Track position history for physics throw
    if (dragCard) {
      recordMousePosition(e.clientX, e.clientY);
      dragCard.x = e.clientX - dragOffsetX;
      dragCard.y = e.clientY - dragOffsetY;
      dragCard.vx = 0;
      dragCard.vy = 0;
    }

    // rAF-throttled cursor update
    if (cursor && !isTouchDevice && !cursorRAF) {
      cursorRAF = true;
      requestAnimationFrame(function () {
        cursor.style.transform =
          "translate3d(" + cursorX + "px, " + cursorY + "px, 0)" +
          (cursor.classList.contains("custom-cursor--hover") ? " scale(2.4)" : "");
        if (!cursorVisible) {
          cursor.classList.add("active");
          cursorVisible = true;
        }
        cursorRAF = false;
      });
    }
  });

  if (cursor && !isTouchDevice) {
    document.addEventListener("mouseleave", function () {
      cursor.classList.remove("active");
      cursorVisible = false;
    });

    // Hover effect via event delegation on the page container
    var page = document.querySelector(".page");
    if (page) {
      page.addEventListener("mouseenter", function (e) {
        if (e.target.closest(".card-image, .feature-image, .product-card img, .article-image, .profile-portrait, picture")) {
          cursor.classList.add("custom-cursor--hover");
        }
      }, true);

      page.addEventListener("mouseleave", function (e) {
        if (e.target.closest(".card-image, .feature-image, .product-card img, .article-image, .profile-portrait, picture")) {
          cursor.classList.remove("custom-cursor--hover");
        }
      }, true);
    }
  }
})();
