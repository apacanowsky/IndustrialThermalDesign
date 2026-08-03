document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Hero slideshow: randomized start + staggered loading ----------
//
// Each page load shuffles which photo leads the rotation (and what order the rest
// follow), so repeat visitors don't always see the same photo first. The DOM slots
// and their CSS animation-delay stay fixed (that's what drives the rotation timing);
// only which photo URL occupies which slot is randomized. Only the resulting lead
// slide loads eagerly — the rest share the same absolutely-positioned stack, so
// native loading="lazy" can't help (they're all geometrically in-viewport, just
// hidden via opacity) — instead we defer their network requests with a short
// stagger so they're ready well before their turn in the rotation.
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
