/* ──────────────────────────────────────────────
   Field Notes West — main.js
   All interactive features in one file.
   ────────────────────────────────────────────── */

(function () {
  "use strict";

  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  /* ── 1. Progress bar ── */

  const progressBar = document.querySelector(".progress-bar");

  window.addEventListener("scroll", function () {
    if (!progressBar) return;
    const pct =
      (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    progressBar.style.width = pct + "%";
  });

  /* ── 3. Card reveal animations ── */

  function revealCards() {
    const cards = document.querySelectorAll(".card:not(.visible):not(.hidden)");
    cards.forEach(function (card, i) {
      card.style.transitionDelay = i * 80 + "ms";
      card.classList.add("visible");
    });
  }

  // IntersectionObserver for scroll-triggered reveals
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const card = entry.target;
            const cards = Array.from(document.querySelectorAll(".card"));
            const idx = cards.indexOf(card);
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

  /* ── 4. Filter animations ── */

  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      document
        .querySelectorAll("[data-filter]")
        .forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");

      const filter = button.dataset.filter;
      const cards = document.querySelectorAll(".card");

      // Phase 1: fade out cards that don't match
      cards.forEach(function (card) {
        const matches = filter === "all" || card.dataset.cat === filter;
        if (!matches && !card.classList.contains("hidden")) {
          card.classList.add("filtering-out");
        }
      });

      // Phase 2: after fade out, hide them and show matching
      setTimeout(function () {
        let enterIndex = 0;
        cards.forEach(function (card) {
          const matches = filter === "all" || card.dataset.cat === filter;
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

        setTimeout(function () {
          cards.forEach(function (card) {
            card.classList.remove("filtering-in");
          });
        }, 400);
      }, 250);
    });
  });

  /* ── 5. Physics photo gallery ── */

  const scatterToggle = document.getElementById("scatter-toggle");
  let scatterActive = false;
  let physicsCards = [];
  let physicsRAF = null;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let dragCard = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  if (scatterToggle && !isTouchDevice) {
    scatterToggle.addEventListener("click", function () {
      scatterActive = !scatterActive;
      scatterToggle.classList.toggle("active", scatterActive);

      const grid = document.querySelector(".grid");
      const cards = document.querySelectorAll(".card");

      if (scatterActive) {
        // Capture current positions
        physicsCards = [];
        cards.forEach(function (card) {
          const rect = card.getBoundingClientRect();
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

    document.addEventListener("mousemove", function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (dragCard) {
        dragCard.x = e.clientX - dragOffsetX;
        dragCard.y = e.clientY - dragOffsetY;
        dragCard.vx = 0;
        dragCard.vy = 0;
      }
    });

    document.addEventListener("mousedown", function (e) {
      if (!scatterActive) return;
      const card = e.target.closest(".card.scattered");
      if (!card) return;

      e.preventDefault();
      const pc = physicsCards.find(function (p) { return p.el === card; });
      if (!pc) return;

      dragCard = pc;
      dragOffsetX = e.clientX - pc.x;
      dragOffsetY = e.clientY - pc.y;
      card.classList.add("dragging");
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    document.addEventListener("mouseup", function (e) {
      if (dragCard) {
        dragCard.vx = (e.clientX - lastMouseX) * 0.5;
        dragCard.vy = (e.clientY - lastMouseY) * 0.5;
        dragCard.el.classList.remove("dragging");
        dragCard = null;
      }
    });
  } else if (scatterToggle && isTouchDevice) {
    scatterToggle.style.display = "none";
  }

  function startPhysics() {
    function tick() {
      const W = window.innerWidth;
      const H = window.innerHeight;

      physicsCards.forEach(function (pc) {
        if (pc === dragCard) {
          pc.el.style.left = pc.x + "px";
          pc.el.style.top = pc.y + "px";
          return;
        }

        // Gravity
        pc.vy += 0.3;

        // Mouse repulsion
        const cx = pc.x + pc.w / 2;
        const cy = pc.y + pc.h / 2;
        const dx = cx - mouseX;
        const dy = cy - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          const force = (200 - dist) / 200 * 2;
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
          // Floor friction
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

  /* ── 6. GLightbox ── */

  if (typeof GLightbox !== "undefined") {
    GLightbox({
      selector: "[data-gallery]",
      touchNavigation: true,
      loop: true,
      closeOnOutsideClick: true,
    });
  }

  /* ── 7. Dark mode ── */

  const darkToggle = document.getElementById("dark-toggle");

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fnw-theme", theme);
    if (darkToggle) {
      darkToggle.textContent = theme === "dark" ? "\u263C" : "\u25D1";
    }
  }

  if (darkToggle) {
    // Check saved preference or OS preference
    const saved = localStorage.getItem("fnw-theme");
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    darkToggle.addEventListener("click", function () {
      const current = document.documentElement.getAttribute("data-theme");
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* ── 8. Variable font hero — removed ── */

  /* ── 9. Custom cursor ── */

  const cursor = document.querySelector(".custom-cursor");

  if (cursor && !isTouchDevice) {
    document.addEventListener("mousemove", function (e) {
      cursor.style.transform =
        "translate3d(" + e.clientX + "px, " + e.clientY + "px, 0)";
      if (!cursor.classList.contains("active")) {
        cursor.classList.add("active");
      }
    });

    document.addEventListener("mouseleave", function () {
      cursor.classList.remove("active");
    });

    // Hover effect on images and cards
    document.querySelectorAll(
      ".card-image, .feature-image, .product-card img, .article-image, .profile-portrait"
    ).forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        cursor.classList.add("custom-cursor--hover");
      });
      el.addEventListener("mouseleave", function () {
        cursor.classList.remove("custom-cursor--hover");
      });
    });
  }
})();
