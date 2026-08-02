document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Staggered hero image loading ----------
//
// Only the first hero slide loads eagerly (it's visible immediately). The rest
// share the same absolutely-positioned stack, so native loading="lazy" can't help
// (they're all geometrically in-viewport, just hidden via opacity) — instead we
// defer their network requests with a short stagger so they're ready well before
// their turn in the rotation, without competing with the initial page load.
(function () {
  const deferredSlides = document.querySelectorAll(".hero-slide[data-bg]");
  deferredSlides.forEach((slide, i) => {
    setTimeout(() => {
      slide.style.backgroundImage = `url('${slide.dataset.bg}')`;
      slide.removeAttribute("data-bg");
    }, 600 * (i + 1));
  });
})();
