document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Hero slideshow: randomized start + staggered loading ----------
(function () {
  const slides = Array.from(document.querySelectorAll(".hero-slide"));
  if (!slides.length) return;

  const urlPattern = /url\(['"]?([^'")]+)['"]?\)/;
  const pool = slides
    .map((slide) => ({
      url: slide.dataset.bg || (slide.style.backgroundImage.match(urlPattern) || [])[1],
      position: slide.style.backgroundPosition || null,
    }))
    .filter((p) => p.url);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  slides.forEach((slide, i) => {
    slide.removeAttribute("data-bg");
    slide.style.backgroundImage = "";
    slide.style.backgroundPosition = pool[i].position || "";
    if (i === 0) {
      slide.style.backgroundImage = `url('${pool[i].url}')`;
    } else {
      setTimeout(() => {
        slide.style.backgroundImage = `url('${pool[i].url}')`;
      }, 600 * i);
    }
  });
})();

// ---------- Scroll reveal ----------
(function () {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -5% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add("is-visible");
    } else {
      revealObserver.observe(el);
    }
  });
})();