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

// ---------- Scroll reveal ----------

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

// ---------- Autoplay video on scroll into view ----------

const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll(".autoplay-on-scroll").forEach((el) => videoObserver.observe(el));

// ---------- Interactive cutaway diagram ----------

document.querySelectorAll(".cutaway-layer, .diagram-legend li").forEach((el) => {
  const wrap = el.closest(".cutaway-wrap");
  if (!wrap) return;
  const layerName = el.dataset.layer;
  if (!layerName) return;

  const activate = () => {
    wrap.querySelectorAll("[data-layer]").forEach((n) => n.classList.remove("is-active"));
    wrap.querySelectorAll(`[data-layer="${layerName}"]`).forEach((n) => n.classList.add("is-active"));
    const caption = wrap.querySelector(".diagram-caption");
    if (caption) {
      const source = wrap.querySelector(`.cutaway-layer[data-layer="${layerName}"]`);
      caption.textContent = (source && source.dataset.caption) || caption.dataset.default;
    }
  };
  const deactivate = () => {
    wrap.querySelectorAll("[data-layer]").forEach((n) => n.classList.remove("is-active"));
    const caption = wrap.querySelector(".diagram-caption");
    if (caption) caption.textContent = caption.dataset.default;
  };

  el.addEventListener("mouseenter", activate);
  el.addEventListener("mouseleave", deactivate);
  el.addEventListener("focus", activate);
  el.addEventListener("blur", deactivate);
});

// ---------- Power density vs. temperature rise chart ----------
//
// Solves the standard cylindrical-conduction heat-transfer equation for insulated
// pipe (as taught in professional heat-tracing design courses, e.g. CEDengineering.com's
// "Heat Tracing Systems," Course E04-019): for a thin outer jacket, the jacket's own
// thermal resistance is negligible (its OD is nearly equal to the insulation's OD), so
// it's dropped here. Formula verified by reproducing that course's own worked example
// (1.32" pipe OD, 1" fiberglass insulation, deltaT=100F -> 4.1 W/ft, reproduced here to
// within rounding).
//
//   W/ft  = (2 * pi * deltaT * k) / (3.42 * 12 * ln(Di / Dp))
//   W/ft2 = W/ft / (pi * Dp / 12)
//
// k in BTU-in/(hr-ft2-F), Dp/Di (pipe/insulation OD) in inches, deltaT in degrees F.
(function () {
  const svg = document.getElementById("powerChartSvg");
  if (!svg) return;

  const insulationSelect = document.getElementById("chartInsulation");
  const thicknessSelect = document.getElementById("chartThickness");
  const tubeSelect = document.getElementById("chartTubeOD");
  const tooltip = document.getElementById("powerChartTooltip");
  const wrap = svg.closest(".power-chart-wrap");

  // Real, published thermal conductivities (BTU-in/hr-ft2-F), Table 2,
  // CEDengineering.com "Heat Tracing Systems," Course E04-019.
  const INSULATION_K = {
    Polyurethane: 0.165,
    Polyisocyanurate: 0.18,
    Polystyrene: 0.22,
    Fiberglass: 0.25,
    "Foamed Elastomer": 0.29,
    "Mineral Wool": 0.3,
    "Expanded Perlite": 0.375,
    "Calcium Silicate": 0.375,
    "Cellular Glass": 0.4,
  };

  const MAX_DELTA_T = 400; // deg F, matches the site's stated temperature ceiling

  // Real design margin over the theoretical steady-state loss: heater cables draw less
  // power as they heat up (positive-temperature-coefficient resistance), so a cable rated
  // to cover the loss at ambient can fall well short at the hot end. Calibrated to
  // Powerblanket's own reference point — a 3/8" tube, 2 wraps of Nomex felt, sized to
  // 24 W/ft to reach 400F from a ~70-80F ambient — where the theoretical loss is only
  // ~10.7 W/ft, a ~2.25x margin. Applied here as a flat multiplier across all cases; the
  // real margin varies somewhat by heater cable and run length.
  const DESIGN_MARGIN_FACTOR = 2.25;

  function wattsPerSqFt(deltaT, k, tubeOD, thickness) {
    const Dp = tubeOD;
    const Di = Dp + 2 * thickness;
    const wPerFt = (2 * Math.PI * deltaT * k) / (3.42 * 12 * Math.log(Di / Dp));
    const circumferenceFt = (Math.PI * Dp) / 12;
    return wPerFt / circumferenceFt;
  }

  function recommendedWattsPerSqFt(deltaT, k, tubeOD, thickness) {
    return wattsPerSqFt(deltaT, k, tubeOD, thickness) * DESIGN_MARGIN_FACTOR;
  }

  const W = 680, H = 380;
  const margin = { top: 20, right: 24, bottom: 48, left: 64 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  function xToPx(deltaT) { return margin.left + (deltaT / MAX_DELTA_T) * plotW; }
  function yToPx(val, maxVal) { return margin.top + plotH - (val / maxVal) * plotH; }

  function niceMax(n) {
    if (n <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
    const residual = n / magnitude;
    let step;
    if (residual > 5) step = 10;
    else if (residual > 2) step = 5;
    else if (residual > 1) step = 2;
    else step = 1;
    return step * magnitude;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function render() {
    const k = INSULATION_K[insulationSelect.value];
    const thickness = parseFloat(thicknessSelect.value);
    const tubeOD = parseFloat(tubeSelect.value);

    const maxW = recommendedWattsPerSqFt(MAX_DELTA_T, k, tubeOD, thickness);
    const yMax = niceMax(maxW);

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    // Gridlines + y-axis labels (5 steps)
    for (let i = 0; i <= 5; i++) {
      const val = (yMax / 5) * i;
      const y = yToPx(val, yMax);
      svg.appendChild(svgEl("line", { class: "power-chart-gridline", x1: margin.left, x2: W - margin.right, y1: y, y2: y }));
      const label = svgEl("text", { class: "power-chart-label", x: margin.left - 10, y: y + 4, "text-anchor": "end" });
      label.textContent = Math.round(val);
      svg.appendChild(label);
    }

    // X-axis labels (0, 100, 200, 300, 400)
    for (let t = 0; t <= MAX_DELTA_T; t += 100) {
      const x = xToPx(t);
      const label = svgEl("text", { class: "power-chart-label", x, y: H - margin.bottom + 20, "text-anchor": "middle" });
      label.textContent = t;
      svg.appendChild(label);
    }

    // Axes
    svg.appendChild(svgEl("line", { class: "power-chart-axis", x1: margin.left, x2: margin.left, y1: margin.top, y2: H - margin.bottom }));
    svg.appendChild(svgEl("line", { class: "power-chart-axis", x1: margin.left, x2: W - margin.right, y1: H - margin.bottom, y2: H - margin.bottom }));

    // Axis titles
    const xTitle = svgEl("text", { class: "power-chart-axis-title", x: margin.left + plotW / 2, y: H - 6, "text-anchor": "middle" });
    xTitle.textContent = "Temperature Rise Above Ambient (°F)";
    svg.appendChild(xTitle);
    const yTitle = svgEl("text", { class: "power-chart-axis-title", x: -(margin.top + plotH / 2), y: 16, "text-anchor": "middle", transform: "rotate(-90)" });
    yTitle.textContent = "Required Power Density (W/ft²)";
    svg.appendChild(yTitle);

    // Data lines (straight lines through origin) — theoretical minimum and, above it,
    // the engineering-recommended power that includes real design margin.
    const x0 = xToPx(0), y0 = yToPx(0, yMax);
    const xEnd = xToPx(MAX_DELTA_T);
    const yTheoretical = yToPx(wattsPerSqFt(MAX_DELTA_T, k, tubeOD, thickness), yMax);
    const yRecommended = yToPx(maxW, yMax);
    svg.appendChild(svgEl("path", { class: "power-chart-line power-chart-line-theoretical", d: `M ${x0} ${y0} L ${xEnd} ${yTheoretical}` }));
    svg.appendChild(svgEl("path", { class: "power-chart-line power-chart-line-recommended", d: `M ${x0} ${y0} L ${xEnd} ${yRecommended}` }));

    // Hover interaction
    const hitArea = svgEl("rect", { x: margin.left, y: margin.top, width: plotW, height: plotH, fill: "transparent" });
    svg.appendChild(hitArea);

    const crosshair = svgEl("line", { class: "power-chart-crosshair", visibility: "hidden" });
    svg.appendChild(crosshair);
    const dotTheoretical = svgEl("circle", { class: "power-chart-dot power-chart-dot-theoretical", r: 5, visibility: "hidden" });
    svg.appendChild(dotTheoretical);
    const dotRecommended = svgEl("circle", { class: "power-chart-dot power-chart-dot-recommended", r: 5, visibility: "hidden" });
    svg.appendChild(dotRecommended);

    function handleMove(evt) {
      const rect = svg.getBoundingClientRect();
      const scaleX = W / rect.width;
      const px = (evt.clientX - rect.left) * scaleX;
      let deltaT = ((px - margin.left) / plotW) * MAX_DELTA_T;
      deltaT = Math.max(0, Math.min(MAX_DELTA_T, deltaT));
      const wsfTheoretical = wattsPerSqFt(deltaT, k, tubeOD, thickness);
      const wsfRecommended = wsfTheoretical * DESIGN_MARGIN_FACTOR;
      const circumferenceFt = (Math.PI * tubeOD) / 12;
      const wftTheoretical = wsfTheoretical * circumferenceFt;
      const wftRecommended = wsfRecommended * circumferenceFt;

      const cx = xToPx(deltaT);
      const cyTheoretical = yToPx(wsfTheoretical, yMax);
      const cyRecommended = yToPx(wsfRecommended, yMax);
      crosshair.setAttribute("x1", cx);
      crosshair.setAttribute("x2", cx);
      crosshair.setAttribute("y1", margin.top);
      crosshair.setAttribute("y2", H - margin.bottom);
      crosshair.setAttribute("visibility", "visible");
      dotTheoretical.setAttribute("cx", cx);
      dotTheoretical.setAttribute("cy", cyTheoretical);
      dotTheoretical.setAttribute("visibility", "visible");
      dotRecommended.setAttribute("cx", cx);
      dotRecommended.setAttribute("cy", cyRecommended);
      dotRecommended.setAttribute("visibility", "visible");

      const wrapRect = wrap.getBoundingClientRect();
      tooltip.style.left = `${evt.clientX - wrapRect.left}px`;
      tooltip.style.top = `${(cyRecommended / H) * rect.height + (rect.top - wrapRect.top)}px`;
      tooltip.innerHTML = `<strong>${Math.round(deltaT)}°F rise</strong>` +
        `<br><span class="power-chart-tooltip-recommended">Recommended: ${wftRecommended.toFixed(1)} W/ft &middot; ${wsfRecommended.toFixed(1)} W/ft²</span>` +
        `<br><span class="power-chart-tooltip-theoretical">Theoretical min: ${wftTheoretical.toFixed(1)} W/ft &middot; ${wsfTheoretical.toFixed(1)} W/ft²</span>`;
      tooltip.hidden = false;
    }

    function handleLeave() {
      crosshair.setAttribute("visibility", "hidden");
      dotTheoretical.setAttribute("visibility", "hidden");
      dotRecommended.setAttribute("visibility", "hidden");
      tooltip.hidden = true;
    }

    hitArea.addEventListener("mousemove", handleMove);
    hitArea.addEventListener("mouseleave", handleLeave);
    hitArea.addEventListener("touchmove", (e) => { handleMove(e.touches[0]); e.preventDefault(); }, { passive: false });
    hitArea.addEventListener("touchend", handleLeave);
  }

  [insulationSelect, thicknessSelect, tubeSelect].forEach((sel) => sel.addEventListener("change", render));
  render();
})();
