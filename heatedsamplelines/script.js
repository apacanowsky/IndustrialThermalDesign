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

// ---------- Contact form ----------

document.querySelectorAll(".lead-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type=submit]");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        form.innerHTML = "<p><strong>Thanks!</strong> We'll be in touch shortly.</p>";
        if (typeof gtag === "function") gtag("event", "generate_lead", { form_id: form.id || "contact_form" });
      } else {
        throw new Error("Submission failed");
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      alert("Something went wrong submitting the form. Please try again or email us directly.");
    }
  });
});

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

  function wattsPerSqFt(deltaT, k, tubeOD, thickness) {
    const Dp = tubeOD;
    const Di = Dp + 2 * thickness;
    const wPerFt = (2 * Math.PI * deltaT * k) / (3.42 * 12 * Math.log(Di / Dp));
    const circumferenceFt = (Math.PI * Dp) / 12;
    return wPerFt / circumferenceFt;
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

    const maxW = wattsPerSqFt(MAX_DELTA_T, k, tubeOD, thickness);
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

    // Data line (straight line through origin)
    const x0 = xToPx(0), y0 = yToPx(0, yMax);
    const x1 = xToPx(MAX_DELTA_T), y1 = yToPx(maxW, yMax);
    svg.appendChild(svgEl("path", { class: "power-chart-line", d: `M ${x0} ${y0} L ${x1} ${y1}` }));

    // Hover interaction
    const hitArea = svgEl("rect", { x: margin.left, y: margin.top, width: plotW, height: plotH, fill: "transparent" });
    svg.appendChild(hitArea);

    const crosshair = svgEl("line", { class: "power-chart-crosshair", visibility: "hidden" });
    svg.appendChild(crosshair);
    const dot = svgEl("circle", { class: "power-chart-dot", r: 5, visibility: "hidden" });
    svg.appendChild(dot);

    function handleMove(evt) {
      const rect = svg.getBoundingClientRect();
      const scaleX = W / rect.width;
      const px = (evt.clientX - rect.left) * scaleX;
      let deltaT = ((px - margin.left) / plotW) * MAX_DELTA_T;
      deltaT = Math.max(0, Math.min(MAX_DELTA_T, deltaT));
      const wsf = wattsPerSqFt(deltaT, k, tubeOD, thickness);
      const wft = wsf * (Math.PI * tubeOD) / 12;

      const cx = xToPx(deltaT);
      const cy = yToPx(wsf, yMax);
      crosshair.setAttribute("x1", cx);
      crosshair.setAttribute("x2", cx);
      crosshair.setAttribute("y1", margin.top);
      crosshair.setAttribute("y2", H - margin.bottom);
      crosshair.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", cy);
      dot.setAttribute("visibility", "visible");

      const wrapRect = wrap.getBoundingClientRect();
      tooltip.style.left = `${evt.clientX - wrapRect.left}px`;
      tooltip.style.top = `${(cy / H) * rect.height + (rect.top - wrapRect.top)}px`;
      tooltip.innerHTML = `<strong>${Math.round(deltaT)}°F rise</strong><br>${wsf.toFixed(1)} W/ft² &middot; ${wft.toFixed(1)} W/ft`;
      tooltip.hidden = false;
    }

    function handleLeave() {
      crosshair.setAttribute("visibility", "hidden");
      dot.setAttribute("visibility", "hidden");
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

// ---------- The engineering interview (specification configurator) ----------
//
// Field options and calculation logic below are reverse-engineered from
// Powerblanket's internal "HSL Quote Calculator REV A.3.xlsx" and the public
// Thermon HSL1000/HSL2000 datasheets. Pricing/cost/BOM data was deliberately
// excluded — this generates a preliminary technical specification only.

(function () {
  const REC = "__recommend__";
  const recommendOption = { value: REC, label: "Not sure — Powerblanket to recommend" };

  function withRec(list) {
    return [...list.map((v) => ({ value: v, label: v })), recommendOption];
  }

  // Real heater cable families and W/ft options (Material Info sheet).
  // Max maintenance temps: Tape Heater/HSL1000-style ~400°F (per Thermon datasheet);
  // self-regulating/power-limiting cable families ~356°F (per Material Info sheet).
  const HEATER_FAMILIES = {
    tape: { label: "Tape Heater (HSL1000-style, custom W/ft)", maxTempF: 400, maxExposureF: 500, custom: true, costTier: 3 },
    bsx: { label: "BSX (self-regulating)", maxTempF: 356, maxExposureF: 464, wattages: [3, 5, 8, 10], costTier: 1 },
    htsx: { label: "HTSX (self-regulating)", maxTempF: 356, maxExposureF: 464, wattages: [3, 6, 9, 12, 15, 20], costTier: 2 },
    vsxht: { label: "VSX-HT (self-regulating)", maxTempF: 356, maxExposureF: 464, wattages: [5, 10, 15, 20], costTier: 2 },
    hpt: { label: "HPT (power-limiting)", maxTempF: 356, maxExposureF: 464, wattages: [5, 10, 15, 20], costTier: 3 },
  };

  // Relative cost tiers (1=$ lowest ... 4=$$$$ highest), derived from real per-ft cost ordering
  // in the Material Info sheet. Never surfaced as actual pricing — tiers only.
  const TUBE_COST_TIER = {
    "Polyethylene": 1, "Nylon": 1,
    "PFA": 2, "FEP": 2, "PTFE": 2, "Copper": 2,
    "316 SS Welded": 1, "304 SS Welded": 1,
    "316 SS Seamless": 2, "304 SS Seamless": 2,
    "SilcoNert-Coated 316 SS": 4, "Monel": 4, "Titanium": 4, "Alloy C276": 4, "Alloy 825": 4, "Alloy 20": 4,
  };
  const INSULATION_COST_TIER = {
    "Meta-Aramid/Nomex Felt (up to 650°F)": 1,
    "Silicone Insulation": 3,
    "Neoprene (up to 250°F)": 3,
  };
  const JACKET_COST_TIER = {
    "Polyolefin Heat-Shrink": 1,
    "Abrasion-Resistant Sleeving": 1,
    "Corrugated Polyethylene/Polypropylene": 2,
    "Thermoplastic Rubber, Wire-Reinforced": 3,
    "Polyamide 6 Tubing": 4,
  };
  const COST_TIER_LABEL = { 1: "Economy ($)", 2: "Standard ($$)", 3: "Elevated ($$$)", 4: "Premium ($$$$)" };

  // Real plug options with rated max amps (Material Info sheet).
  const PLUG_OPTIONS = [
    { value: "nema5-15", label: "NEMA 5-15", maxAmps: 12 },
    { value: "nema5-20", label: "NEMA 5-20", maxAmps: 16 },
    { value: "nemaL5-30", label: "NEMA L5-30", maxAmps: 24 },
    { value: "nema6-15", label: "NEMA 6-15", maxAmps: 12 },
    { value: "nema6-20", label: "NEMA 6-20", maxAmps: 16 },
    { value: "nemaL6-30", label: "NEMA L6-30", maxAmps: 24 },
    { value: "leviton", label: "Leviton-style plug", maxAmps: 20 },
    { value: "molex", label: "Molex-style plug", maxAmps: 24 },
    { value: "amphenol", label: "Amphenol-style plug", maxAmps: 24 },
    { value: "none", label: "No plug / raw leads", maxAmps: Infinity },
  ];

  // ---------- Recommendation engine ----------
  //
  // Turns the functional requirements the customer already gave us (temperature,
  // chemical compatibility, hazardous area, flexibility, tolerance, exposure) into
  // a recommended technical spec, using the same real data and heat-transfer math
  // as the rest of the site (material comparison tables, the power-density chart,
  // the tolerance -> controller mapping already used in Sensing & Controls).

  // Representative k-value for Powerblanket's Meta-Aramid/Nomex felt (BTU-in/hr-ft2-F) —
  // fibrous insulation in the fiberglass/mineral-wool range, per the same disclaimer
  // used on the interactive power-density chart. Not a manufacturer-published exact value.
  const FELT_K = 0.28;

  function parseFractionIn(str) {
    if (!str) return null;
    const clean = str.replace(/"/g, "").trim();
    if (clean.includes("/")) {
      const [n, d] = clean.split("/").map(Number);
      return d ? n / d : null;
    }
    return parseFloat(clean) || null;
  }

  function requiredWattsPerFt(deltaT, tubeOD, wraps) {
    if (!deltaT || deltaT <= 0 || !tubeOD) return null;
    const thickness = 0.25 * wraps;
    const Di = tubeOD + 2 * thickness;
    const wPerFt = (2 * Math.PI * deltaT * FELT_K) / (3.42 * 12 * Math.log(Di / tubeOD));
    return wPerFt;
  }

  const CHEMICAL_TUBE_HINTS = [
    { pattern: /mercury|trace[- ]level|adsorption/i, material: "SilcoNert-Coated 316 SS", reason: "Trace-level or adsorption-sensitive media — an inert-coated surface protects accuracy." },
    { pattern: /hydrofluoric|\bhf\b/i, material: "Monel", reason: "Hydrofluoric acid — Monel has outstanding resistance to HF." },
    { pattern: /chlorine|wet chlorine|oxidiz/i, material: "Alloy C276", reason: "Chlorine/oxidizing chemistry — Alloy C276 (Hastelloy) has one of the broadest resistance profiles available." },
    { pattern: /sulfuric/i, material: "Alloy 20", reason: "Sulfuric acid — Alloy 20 was developed specifically for this service." },
    { pattern: /phosphoric|stress[- ]corrosion/i, material: "Alloy 825", reason: "Phosphoric acid / chloride stress-corrosion risk — Alloy 825 resists both." },
    { pattern: /chloride|seawater|corrosive|acid/i, material: "316 SS Seamless", reason: "Corrosive/chloride service — 316 stainless offers strong general corrosion resistance." },
  ];

  function computeRecommendations(state) {
    const reasons = {};
    const tubeOD = parseFractionIn(state.tubeOD) || 0.375;
    const maintainTemp = parseFloat(state.maintainTemp);
    const minAmbient = parseFloat(state.minAmbient);
    const deltaT = !isNaN(maintainTemp) && !isNaN(minAmbient) ? maintainTemp - minAmbient : (!isNaN(maintainTemp) ? maintainTemp - 70 : null);

    // Tube material — chemical/trace-level compatibility first, else broad-resistance default.
    const textToScan = `${state.compatibilityConcerns || ""} ${state.mediaType || ""} ${state.mediaDescription || ""}`;
    let tubeMaterial = "PFA";
    reasons.tubeMaterial = "PFA resists nearly all acids, bases, and solvents — a safe general-purpose default.";
    for (const hint of CHEMICAL_TUBE_HINTS) {
      if (hint.pattern.test(textToScan)) {
        tubeMaterial = hint.material;
        reasons.tubeMaterial = hint.reason;
        break;
      }
    }

    // Heater family — hazardous location and flexibility drive this first.
    const isHazloc = state.hazArea && state.hazArea !== "none" && state.hazArea !== "unsure" && state.hazArea !== "";
    const wantsFlex = state.flexibility === "High-flex";
    let heaterFamily = "htsx";
    if (isHazloc) {
      heaterFamily = "htsx";
      reasons.heaterFamily = "Hazardous-location work — self-regulating/power-limiting cable is available rated for classified locations.";
    } else if (wantsFlex) {
      heaterFamily = "tape";
      reasons.heaterFamily = "High-flex requirement — tape heater gives the highest flexibility and can be built to any watt density.";
    } else {
      reasons.heaterFamily = "Standard self-regulating cable — simple, repeatable, and self-limiting against burnout.";
    }

    // Watt density / wraps — from the real cylindrical-conduction formula, same as the power-density chart.
    let numWraps = 1;
    let targetWatts = deltaT ? requiredWattsPerFt(deltaT, tubeOD, numWraps) : null;
    if (targetWatts && targetWatts > 18) {
      numWraps = 2;
      targetWatts = requiredWattsPerFt(deltaT, tubeOD, numWraps);
      reasons.numWraps = "A second insulation wrap keeps the required watt density in a reasonable range for your target temperature rise.";
    } else {
      reasons.numWraps = "Standard single wrap covers your target temperature rise at a reasonable watt density.";
    }
    if (targetWatts) {
      reasons.heaterWatts = `Computed from a ${Math.round(deltaT)}°F rise on a ${state.tubeOD || '3/8"'} tube with ${numWraps} wrap(s) of felt insulation — the same math as the power-density chart above.`;
    }

    // Round up to the nearest real step for the recommended family (never round down — must meet the target).
    let heaterWattsValue = null;
    if (targetWatts && HEATER_FAMILIES[heaterFamily] && !HEATER_FAMILIES[heaterFamily].custom) {
      const steps = HEATER_FAMILIES[heaterFamily].wattages;
      heaterWattsValue = steps.find((w) => w >= targetWatts) || steps[steps.length - 1];
    }

    // Insulation type — oil/weather exposure or high-flex needs override the standard felt default.
    let insulationType = "Meta-Aramid/Nomex Felt (up to 650°F)";
    reasons.insulationType = "The standard choice on most builds — widest temperature headroom at the lowest relative cost.";
    if ((state.conditions || []).includes("Oil") && state.exposureType === "Outdoor") {
      insulationType = "Neoprene (up to 250°F)";
      reasons.insulationType = "Outdoor oil exposure — Neoprene is valued for oil, ozone, and weather resistance.";
    } else if (wantsFlex) {
      insulationType = "Silicone Insulation";
      reasons.insulationType = "High-flex requirement — silicone adds flexibility and moisture resistance over felt.";
    }

    // Controller / sensor / alarms — from the tolerance requirement already collected.
    let controllerType = "PID Controller";
    let sensorType = "RTD";
    let alarms = [];
    if (state.toleranceQuestion === "Loose") {
      controllerType = "Customer-supplied controls";
      sensorType = "Type J Thermocouple";
      reasons.controllerType = "Loose tolerance — a simple thermostatic or customer-supplied controller is usually enough.";
    } else if (state.toleranceQuestion === "Tight — critical") {
      controllerType = "PID Controller";
      sensorType = "RTD";
      alarms = ["High-temperature alarm", "Low-temperature alarm", "Data logging"];
      reasons.controllerType = "Tight/critical tolerance — PID control with alarming and data logging is recommended.";
    } else {
      reasons.controllerType = "Moderate tolerance — a digital PID controller is a solid fit.";
    }

    // Outer jacket — exposure conditions drive this.
    let outerJacketType = "Polyolefin Heat-Shrink";
    reasons.outerJacketType = "Indoor or lightly-exposed routing — lightweight heat-shrink is the economical choice.";
    if ((state.conditions || []).some((c) => ["Abrasion", "Crush"].includes(c))) {
      outerJacketType = "Thermoplastic Rubber, Wire-Reinforced";
      reasons.outerJacketType = "Abrasion/crush exposure — a wire-reinforced jacket adds mechanical protection.";
    } else if (state.exposureType === "Outdoor" || (state.conditions || []).some((c) => ["Rain", "Snow", "UV"].includes(c))) {
      outerJacketType = "Corrugated Polyethylene/Polypropylene";
      reasons.outerJacketType = "Outdoor exposure — corrugated jacket is flexible and weather-sealed.";
    }

    // Plug type — from computed amps at the recommended wattage.
    let plugType = null;
    const heatedLengthFt = parseFloat(state.heatedLength);
    const voltageMap = { "120V AC": 120, "208V AC": 208, "240V AC": 240, "277V AC": 277 };
    const voltage = voltageMap[state.voltage];
    if (heaterWattsValue && heatedLengthFt && voltage) {
      const amps = (heaterWattsValue * heatedLengthFt) / voltage;
      const fit = PLUG_OPTIONS.filter((p) => p.value !== "none").find((p) => p.maxAmps >= amps);
      if (fit) {
        plugType = fit.value;
        reasons.plugType = `Computed load of about ${amps.toFixed(1)} A fits a ${fit.label} plug.`;
      }
    }

    return {
      tubeMaterial, heaterFamily, heaterWattsValue, numWraps, insulationType,
      controllerType, sensorType, alarms, outerJacketType, plugType, targetWatts, reasons,
    };
  }

  const STEPS = [
    {
      id: "application",
      title: "Your Application",
      hint: "Let's start with the problem, not a category.",
      fields: [
        { id: "problemDescription", label: "What problem are you trying to solve?", type: "textarea",
          placeholder: "e.g. condensation before the analyzer, a chemical solidifying in transit, inconsistent sample readings, freezing in an outdoor run..." },
        { id: "mediaDescription", label: "What are you trying to heat, and why?", type: "text",
          placeholder: "e.g. a natural gas sample line to a CEMS analyzer, an adhesive transfer line to a dispensing head..." },
      ],
    },
    {
      id: "process",
      title: "Process & Media Conditions",
      fields: [
        { id: "mediaType", label: "Sample or media type", type: "text", placeholder: "e.g. natural gas, flue gas, adhesive" },
        { row: [
          { id: "inletTemp", label: "Normal inlet temperature (°F)", type: "number" },
          { id: "maintainTemp", label: "Required maintain temperature (°F)", type: "number", placeholder: "typical systems: up to 400°F (200°C)" },
        ]},
        { row: [
          { id: "maxTemp", label: "Maximum allowable temperature (°F)", type: "number" },
          { id: "dewPoint", label: "Dew point, if known (analytical sampling)", type: "text" },
        ]},
        { id: "viscosityBehavior", label: "How does the media behave as it cools or sits, if relevant (thickens, gels, sets up, etc.)", type: "text" },
        { row: [
          { id: "operatingPressure", label: "Operating pressure", type: "text" },
          { id: "maxPressure", label: "Maximum pressure", type: "text" },
        ]},
        { id: "flowRate", label: "Flow rate, if relevant", type: "text" },
        { id: "compatibilityConcerns", label: "Corrosive, reactive, permeable, or compatibility concerns", type: "textarea" },
      ],
    },
    {
      id: "tubing",
      title: "Tube Size & Bundle",
      note: () => "For trace-level or adsorption-sensitive sampling (mercury, RATA, etc.), we typically recommend inert-coated stainless tubing to protect accuracy — we'll factor that into your recommendation later.",
      fields: [
        { row: [
          { id: "numTubes", label: "Number of tubes", type: "select", options: withRec(["1", "2", "3", "4+"]) },
          { id: "tubeOD", label: "Tube outside diameter", type: "select", options: withRec(['1/8"', '1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"']) },
        ]},
        { id: "wallThickness", label: "Wall thickness", type: "select", options: withRec(['0.028"', '0.030"', '0.035"', '0.040"', '0.047"', '0.049"', '0.062"', '0.065"', '0.083"']) },
        { id: "extras", label: "Include in the bundle", type: "checkboxes", options: [
          "Calibration line", "Purge line", "Return line", "Heat trace redundancy", "Drain-back capability", "Spare tube", "Electrical / signal conductors",
        ]},
        { id: "tubeIdNotes", label: "Tube ID / color-coding notes", type: "text", condition: (state) => state.numTubes && state.numTubes !== "1" },
      ],
    },
    {
      id: "physical",
      title: "Physical Dimensions & Handling",
      fields: [
        { row: [
          { id: "heatedLength", label: "Heated length (ft)", type: "number", placeholder: "typical range 1.5–100 ft" },
          { id: "totalLength", label: "Total overall length (ft)", type: "number" },
        ]},
        { row: [
          { id: "heatedEndLength", label: "Power-side unheated lead (in)", type: "number" },
          { id: "unheatedEndLength", label: "Non-power-side unheated lead (in)", type: "number" },
        ]},
        { id: "installType", label: "Installation type", type: "pills", options: ["Fixed", "Portable", "Mobile", "Not sure"] },
        { row: [
          { id: "minBendRadius", label: "Minimum bend radius", type: "text", placeholder: "typical minimum: 4 in (100 mm)" },
          { id: "verticalRise", label: "Vertical rise", type: "text" },
        ]},
        { id: "delivery", label: "Delivery", type: "pills", options: ["Coiled", "Straight", "Not sure"] },
        { id: "flexibility", label: "Flexibility", type: "select", options: withRec(["Standard", "High-flex"]) },
        { id: "weightSensitivity", label: "Is weight a constraint?", type: "pills", options: ["Yes", "No", "Not sure"] },
        { id: "repeatedDeployment", label: "Repeated deployment or storage required", type: "checkbox", condition: (state) => state.installType !== "Fixed" },
      ],
    },
    {
      id: "electrical",
      title: "Electrical & Thermal Requirements",
      fields: [
        { row: [
          { id: "voltage", label: "Supply voltage", type: "select", options: withRec(["120V AC", "208V AC", "240V AC", "277V AC"]) },
          { id: "amperageAvailable", label: "Available amperage", type: "text" },
        ]},
        { row: [
          { id: "phase", label: "Phase", type: "pills", options: ["Single", "Three", "Not sure"] },
          { id: "heaterZones", label: "Number of heater zones", type: "select", options: withRec(["1", "2", "3+"]) },
        ]},
        { row: [
          { id: "minAmbient", label: "Minimum ambient temperature", type: "text" },
          { id: "maxAmbient", label: "Maximum ambient temperature", type: "text" },
        ]},
        { id: "exposure", label: "Exposure", type: "pills", options: ["Indoor", "Outdoor", "Both", "Not sure"] },
        { id: "windExposure", label: "Significant wind exposure", type: "checkbox" },
        { row: [
          { id: "heatUpTime", label: "Required heat-up time", type: "text" },
          { id: "operation", label: "Operation", type: "pills", options: ["Continuous", "Intermittent", "Not sure"] },
        ]},
        { id: "powerEntryLocation", label: "Power entry location", type: "text" },
      ],
    },
    {
      id: "controls",
      title: "Precision Requirements",
      fields: [
        {
          id: "toleranceQuestion", label: "How closely must temperature be maintained?", type: "pills",
          options: ["Loose", "Moderate", "Tight — critical", "Not sure"],
          suggestion: {
            "Loose": "Thermostatic or customer-supplied control is usually sufficient for loose tolerances.",
            "Moderate": "A digital PID controller typically fits moderate tolerance needs.",
            "Tight — critical": "Tight tolerances usually call for PID control with alarming and monitoring.",
          },
        },
      ],
    },
    {
      id: "environment",
      title: "Environment, Safety & Certification",
      warning: "Hazardous-location and certification selections are flagged for Powerblanket engineering review — we don't auto-certify compliance.",
      fields: [
        { id: "exposureType", label: "Installation environment", type: "pills", options: ["Indoor", "Outdoor", "Mobile", "Not sure"] },
        { id: "conditions", label: "Exposure conditions", type: "checkboxes", options: ["Rain", "Snow", "UV", "Oil", "Chemical", "Abrasion", "Crush", "Washdown"] },
        { id: "hazArea", label: "Hazardous area classification", type: "select", options: [
          { value: "none", label: "Not classified / general purpose" },
          { value: "fm-ci-d2", label: "FM — Class I, Division 2, Groups B, C, D" },
          { value: "fm-cii-d2", label: "FM — Class II, Division 2, Groups F, G" },
          { value: "fm-ciii", label: "FM — Class III, Divisions 1 and 2" },
          { value: "fm-zone", label: "FM — Class I, Zones 1 & 2, AEx eb IIC / AEx tb IIIC" },
          { value: "csa-ci-d1", label: "CSA — Class I, Division 1, Groups A, B, C, D" },
          { value: "csa-cii-d1", label: "CSA — Class II, Division 1, Groups E, F, G" },
          { value: "csa-ci-d2", label: "CSA — Class I, Division 2, Groups A, B, C, D" },
          { value: "csa-cii-d2", label: "CSA — Class II, Division 2, Groups E, F, G" },
          { value: "csa-ex", label: "CSA — Ex eb IIC / Ex tb IIIC" },
          { value: "unsure", label: "Not sure — flag for review" },
        ]},
        { id: "maxJacketTemp", label: "Maximum jacket surface temperature", type: "text" },
        { id: "installNotes", label: "Installation area notes", type: "textarea" },
      ],
    },
    {
      id: "recommendation",
      title: "Your Recommended Configuration",
      hint: "Based on everything you've told us so far — every field here is editable if you'd rather choose yourself.",
      isRecommendationStep: true,
      fields: [
        { id: "tubeMaterial", label: "Tube material", type: "select", recommendKey: "tubeMaterial", options: withRec([
          "PFA", "FEP", "PTFE", "Nylon", "Polyethylene",
          "316 SS Seamless", "316 SS Welded", "304 SS Seamless", "304 SS Welded",
          "SilcoNert-Coated 316 SS", "Copper", "Monel", "Titanium", "Alloy C276", "Alloy 825", "Alloy 20",
        ])},
        { row: [
          { id: "heaterFamily", label: "Heater construction", type: "select", recommendKey: "heaterFamily", options: [
            { value: "tape", label: HEATER_FAMILIES.tape.label },
            { value: "bsx", label: HEATER_FAMILIES.bsx.label },
            { value: "htsx", label: HEATER_FAMILIES.htsx.label },
            { value: "vsxht", label: HEATER_FAMILIES.vsxht.label },
            { value: "hpt", label: HEATER_FAMILIES.hpt.label },
            recommendOption,
          ]},
          { id: "heaterWatts", label: "Heater output", type: "select", recommendKey: "heaterWatts",
            options: (state) => {
              const fam = HEATER_FAMILIES[state.heaterFamily];
              if (!fam || fam.custom) return [recommendOption];
              return withRec(fam.wattages.map((w) => `${w} W/ft`));
            },
            condition: (state) => state.heaterFamily && state.heaterFamily !== REC && !HEATER_FAMILIES[state.heaterFamily]?.custom,
          },
          { id: "heaterWattsCustom", label: "Target W/ft (typical range 5–20)", type: "number",
            condition: (state) => HEATER_FAMILIES[state.heaterFamily]?.custom,
          },
        ]},
        { row: [
          { id: "insulationType", label: "Insulation type", type: "select", recommendKey: "insulationType", options: withRec([
            "Meta-Aramid/Nomex Felt (up to 650°F)", "Silicone Insulation", "Neoprene (up to 250°F)",
          ])},
          { id: "numWraps", label: "Number of insulation wraps", type: "select", recommendKey: "numWraps", options: withRec(["1", "2"]) },
        ]},
        { row: [
          { id: "sensorType", label: "Sensor type", type: "select", recommendKey: "sensorType", options: withRec(["RTD", "Thermistor", "Type K Thermocouple", "Type J Thermocouple", "No Sensor"]) },
          { id: "sensorPlugType", label: "Sensor plug type", type: "select", options: withRec(["Mini Type K flat", "RTD 3-wire round pin", "No Plug"]) },
        ]},
        { id: "controllerType", label: "Controller type", type: "select", recommendKey: "controllerType", options: withRec(["GHT2002J", "ExoTouch", "PID Controller", "Red Lion Controller (not NEMA 4X rated)", "Customer-supplied controls", "No Controller"]) },
        { id: "alarms", label: "Alarms & monitoring", type: "checkboxes", recommendKey: "alarms", options: ["High-temperature alarm", "Low-temperature alarm", "Data logging", "Remote monitoring"] },
        { row: [
          { id: "outerJacketType", label: "Outer jacket type", type: "select", recommendKey: "outerJacketType", options: withRec([
            "Polyolefin Heat-Shrink", "Abrasion-Resistant Sleeving",
            "Corrugated Polyethylene/Polypropylene", "Thermoplastic Rubber, Wire-Reinforced", "Polyamide 6 Tubing",
          ])},
          { id: "plugType", label: "Power cable plug", type: "select", recommendKey: "plugType", options: [...PLUG_OPTIONS.map((p) => ({ value: p.value, label: p.label })), recommendOption] },
        ]},
      ],
    },
    {
      id: "fittings",
      title: "Fittings, Ends & Terminations",
      fields: [
        { row: [
          { id: "processConnection", label: "Process connection", type: "text" },
          { id: "analyzerConnection", label: "Analyzer / destination connection", type: "text" },
        ]},
        { id: "fittingType", label: "Tube fitting type", type: "select", options: withRec([
          "Bare Tube – No Fitting", "Tube Stub Assembly", "Female JIC Fitting", "Cam & Groove (C&E) Fitting", "Compression Nut & Ferrules",
        ])},
        { id: "powerLeadType", label: "Power lead type", type: "select", options: withRec([
          "2-Wire (no ground), heatshrink-terminated — tape heater",
          "3-Wire SEOOW cord — tape heater",
          "PETK termination kit, no power lead — heating cable",
          "PETK termination kit + 3-wire SEOOW cord — heating cable",
          "No power lead, no PETK kit — heating cable",
        ])},
        { row: [
          { id: "endOrientation", label: "End orientation", type: "text" },
          { id: "connectorLocation", label: "Connector location", type: "text" },
        ]},
        { id: "fittingExtras", label: "Also include", type: "checkboxes", options: ["Strain relief", "Protective caps", "Mounting / support hardware"] },
      ],
    },
    {
      id: "project",
      title: "Project Details",
      fields: [
        { row: [
          { id: "quantity", label: "Quantity", type: "number" },
          { id: "neededBy", label: "Needed-by date", type: "date" },
        ]},
        { row: [
          { id: "location", label: "Project location", type: "text" },
          { id: "company", label: "Company", type: "text" },
        ]},
        { row: [
          { id: "contactName", label: "Contact name", type: "text" },
          { id: "contactEmail", label: "Contact email", type: "email" },
        ]},
        { id: "contactPhone", label: "Contact phone", type: "tel" },
        { id: "applicationCategory", label: "If it's helpful, which category is closest? (optional)", type: "pills",
          options: ["CEMS", "RATA / Field Testing", "Process Gas Analysis", "Mercury Monitoring", "Heated Transport & Transfer", "Other / Not sure"] },
        { id: "fileUpload", label: "Existing drawings or specification (optional)", type: "file" },
        { id: "notes", label: "Additional notes", type: "textarea" },
      ],
    },
  ];

  const shell = document.querySelector(".configurator-shell");
  if (!shell) return;

  const stepContainer = document.getElementById("configStepContainer");
  stepContainer.addEventListener("input", () => renderSummaryStrip());
  stepContainer.addEventListener("change", () => renderSummaryStrip());
  const progressFill = document.getElementById("configProgressFill");
  const progressLabel = document.getElementById("configProgressLabel");
  const backBtn = document.getElementById("configBackBtn");
  const nextBtn = document.getElementById("configNextBtn");
  const navRow = document.querySelector(".configurator-nav");

  const state = {};
  let currentIndex = 0;
  let currentRecommendations = null;

  function isUnset(v) {
    return v === undefined || v === null || v === "";
  }

  function applyRecommendationDefaults() {
    const rec = computeRecommendations(state);
    currentRecommendations = rec;

    if (isUnset(state.tubeMaterial)) state.tubeMaterial = rec.tubeMaterial;
    if (isUnset(state.heaterFamily)) state.heaterFamily = rec.heaterFamily;

    const fam = HEATER_FAMILIES[state.heaterFamily];
    if (fam && fam.custom) {
      if (isUnset(state.heaterWattsCustom) && rec.targetWatts) state.heaterWattsCustom = Math.round(rec.targetWatts);
    } else if (rec.heaterWattsValue) {
      if (isUnset(state.heaterWatts)) state.heaterWatts = `${rec.heaterWattsValue} W/ft`;
    }

    if (isUnset(state.insulationType)) state.insulationType = rec.insulationType;
    if (isUnset(state.numWraps)) state.numWraps = String(rec.numWraps);
    if (isUnset(state.sensorType)) state.sensorType = rec.sensorType;
    if (isUnset(state.controllerType)) state.controllerType = rec.controllerType;
    if (isUnset(state.alarms) || (Array.isArray(state.alarms) && state.alarms.length === 0)) {
      if (rec.alarms.length) state.alarms = rec.alarms;
    }
    if (isUnset(state.outerJacketType)) state.outerJacketType = rec.outerJacketType;
    if (isUnset(state.plugType) && rec.plugType) state.plugType = rec.plugType;
  }

  function fieldVisible(field) {
    return !field.condition || field.condition(state);
  }

  function fieldOptions(field) {
    return typeof field.options === "function" ? field.options(state) : field.options;
  }

  function optionLabel(field, value) {
    const options = fieldOptions(field);
    if (!options) return value;
    const opt = options.find((o) => (typeof o === "string" ? o === value : o.value === value));
    if (!opt) return value;
    return typeof opt === "string" ? opt : opt.label;
  }

  function renderField(field) {
    const wrap = document.createElement("div");
    wrap.className = "config-field";

    if (field.type !== "radio-cards" && field.type !== "checkbox") {
      const label = document.createElement("label");
      label.className = "field-label";
      label.textContent = field.label;
      wrap.appendChild(label);
    }

    if (field.type === "radio-cards") {
      const label = document.createElement("label");
      label.className = "field-label";
      label.textContent = field.label || "";
      if (field.label) wrap.appendChild(label);
      const group = document.createElement("div");
      group.className = "radio-cards";
      fieldOptions(field).forEach((opt) => {
        const card = document.createElement("div");
        card.className = "radio-card" + (state[field.id] === opt.value ? " is-selected" : "");
        card.innerHTML = `<div class="radio-card-title">${opt.label}</div>${opt.desc ? `<div class="radio-card-desc">${opt.desc}</div>` : ""}`;
        card.addEventListener("click", () => {
          state[field.id] = opt.value;
          renderStep(currentIndex);
        });
        group.appendChild(card);
      });
      wrap.appendChild(group);
    } else if (field.type === "pills") {
      const group = document.createElement("div");
      group.className = "pill-group";
      fieldOptions(field).forEach((opt) => {
        const value = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const pill = document.createElement("span");
        pill.className = "pill" + (state[field.id] === value ? " is-selected" : "");
        pill.textContent = label;
        pill.addEventListener("click", () => {
          state[field.id] = value;
          renderStep(currentIndex);
        });
        group.appendChild(pill);
      });
      wrap.appendChild(group);
      if (field.suggestion && state[field.id] && field.suggestion[state[field.id]]) {
        const hint = document.createElement("p");
        hint.className = "config-hint";
        hint.textContent = field.suggestion[state[field.id]];
        wrap.appendChild(hint);
      }
    } else if (field.type === "select") {
      const select = document.createElement("select");
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Select...";
      select.appendChild(blank);
      fieldOptions(field).forEach((opt) => {
        const value = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        if (state[field.id] === value) o.selected = true;
        select.appendChild(o);
      });
      select.addEventListener("change", (e) => {
        state[field.id] = e.target.value;
        if (["numTubes", "installType", "heaterFamily"].includes(field.id)) renderStep(currentIndex);
      });
      wrap.appendChild(select);
    } else if (field.type === "textarea") {
      const ta = document.createElement("textarea");
      ta.rows = 3;
      ta.value = state[field.id] || "";
      ta.addEventListener("input", (e) => { state[field.id] = e.target.value; });
      wrap.appendChild(ta);
    } else if (field.type === "checkboxes") {
      const group = document.createElement("div");
      group.className = "checkbox-group";
      const current = state[field.id] || [];
      fieldOptions(field).forEach((opt) => {
        const row = document.createElement("label");
        row.className = "checkbox-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = current.includes(opt);
        cb.addEventListener("change", () => {
          const arr = new Set(state[field.id] || []);
          if (cb.checked) arr.add(opt); else arr.delete(opt);
          state[field.id] = Array.from(arr);
        });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(opt));
        group.appendChild(row);
      });
      wrap.appendChild(group);
    } else if (field.type === "checkbox") {
      const row = document.createElement("label");
      row.className = "checkbox-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state[field.id];
      cb.addEventListener("change", () => { state[field.id] = cb.checked; });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(field.label));
      wrap.innerHTML = "";
      wrap.appendChild(row);
    } else if (field.type === "file") {
      const input = document.createElement("input");
      input.type = "file";
      input.addEventListener("change", (e) => { state[field.id] = e.target.files[0] || null; });
      wrap.appendChild(input);
    } else {
      const input = document.createElement("input");
      input.type = field.type;
      if (field.placeholder) input.placeholder = field.placeholder;
      input.value = state[field.id] || "";
      input.addEventListener("input", (e) => { state[field.id] = e.target.value; });
      wrap.appendChild(input);
    }

    if (field.recommendKey && currentRecommendations && currentRecommendations.reasons[field.recommendKey]) {
      const note = document.createElement("p");
      note.className = "config-recommend-note";
      note.innerHTML = `<strong>Recommended:</strong> ${currentRecommendations.reasons[field.recommendKey]}`;
      wrap.appendChild(note);
    }

    return wrap;
  }

  const summaryStrip = document.getElementById("configSummaryStrip");
  const SUMMARY_FIELDS = [
    { key: "mediaType", label: "Media" },
    { key: "tubeMaterial", label: "Tube" },
    { key: "heaterFamily", label: "Heater", format: (v) => (HEATER_FAMILIES[v] ? HEATER_FAMILIES[v].label.split(" (")[0] : v) },
    { key: "heatedLength", label: "Length", format: (v) => `${v} ft` },
    { key: "voltage", label: "Voltage" },
  ];

  function renderSummaryStrip() {
    if (!summaryStrip) return;
    const hasAnyAnswer = Object.keys(state).some((k) => state[k] !== undefined && state[k] !== "" && state[k] !== null);
    if (!hasAnyAnswer) {
      summaryStrip.hidden = true;
      return;
    }
    summaryStrip.hidden = false;
    summaryStrip.innerHTML = "";
    SUMMARY_FIELDS.forEach(({ key, label, format }) => {
      const raw = state[key];
      const item = document.createElement("span");
      const hasValue = raw !== undefined && raw !== null && raw !== "" && raw !== REC;
      item.className = "config-summary-item" + (hasValue ? "" : " is-pending");
      const value = hasValue ? (format ? format(raw) : raw) : "—";
      item.innerHTML = `<span class="summary-key">${label}:</span><span class="summary-value">${value}</span>`;
      summaryStrip.appendChild(item);
    });
  }

  function renderStep(index) {
    currentIndex = index;
    stepContainer.innerHTML = "";

    if (index >= STEPS.length) {
      if (summaryStrip) summaryStrip.hidden = true;
      renderReview();
      progressFill.style.width = "100%";
      progressLabel.textContent = "Review your specification";
      navRow.style.display = "none";
      if (typeof gtag === "function") gtag("event", "configurator_step", { step_name: "review" });
      return;
    }

    renderSummaryStrip();

    navRow.style.display = "flex";
    const step = STEPS[index];
    if (step.isRecommendationStep) applyRecommendationDefaults();
    else currentRecommendations = null;
    progressFill.style.width = `${Math.round(((index + 1) / (STEPS.length + 1)) * 100)}%`;
    progressLabel.textContent = `Step ${index + 1} of ${STEPS.length} — ${step.title}`;
    if (typeof gtag === "function") gtag("event", "configurator_step", { step_name: step.id, step_number: index + 1 });

    const heading = document.createElement("h3");
    heading.textContent = step.title;
    stepContainer.appendChild(heading);

    if (step.hint) {
      const hint = document.createElement("p");
      hint.className = "configurator-step-hint";
      hint.textContent = step.hint;
      stepContainer.appendChild(hint);
    }

    if (step.warning) {
      const warn = document.createElement("div");
      warn.className = "config-warning";
      warn.textContent = step.warning;
      stepContainer.appendChild(warn);
    }

    if (typeof step.note === "function") {
      const noteText = step.note(state);
      if (noteText) {
        const note = document.createElement("div");
        note.className = "config-note";
        note.textContent = noteText;
        stepContainer.appendChild(note);
      }
    }

    step.fields.forEach((item) => {
      if (item.row) {
        const visibleRowFields = item.row.filter(fieldVisible);
        if (!visibleRowFields.length) return;
        const rowWrap = document.createElement("div");
        rowWrap.className = "field-row";
        visibleRowFields.forEach((f) => rowWrap.appendChild(renderField(f)));
        stepContainer.appendChild(rowWrap);
      } else if (fieldVisible(item)) {
        stepContainer.appendChild(renderField(item));
      }
    });

    backBtn.disabled = index === 0;
    nextBtn.textContent = index === STEPS.length - 1 ? "Review Specification" : "Next";
  }

  function collectVisibleFields() {
    const out = [];
    STEPS.forEach((step) => {
      step.fields.forEach((item) => {
        const list = item.row ? item.row : [item];
        list.forEach((f) => { if (fieldVisible(f)) out.push({ step, field: f }); });
      });
    });
    return out;
  }

  // ---------- Real (non-pricing) spec calculations ----------
  // Reverse-engineered from 'Tape Heater calc' / 'insulation Calc' sheets.
  // For a helically-wrapped heater, total watts = target W/ft x heated length(ft)
  // (the diameter term cancels out of the geometry — see insulation/tape calc sheets).

  function parseFraction(str) {
    if (!str) return null;
    const clean = str.replace(/"/g, "").trim();
    if (clean.includes("/")) {
      const [num, den] = clean.split("/").map(Number);
      return den ? num / den : null;
    }
    return parseFloat(clean) || null;
  }

  function computeSpec() {
    const warnings = [];
    let totalWatts = null;
    let totalAmps = null;
    let outerDiameter = null;

    const fam = HEATER_FAMILIES[state.heaterFamily];
    let wPerFt = null;
    if (fam) {
      if (fam.custom) {
        wPerFt = parseFloat(state.heaterWattsCustom) || null;
      } else if (state.heaterWatts && state.heaterWatts !== REC) {
        wPerFt = parseFloat(state.heaterWatts) || null;
      }
    }

    const heatedLengthFt = parseFloat(state.heatedLength) || null;

    if (wPerFt && heatedLengthFt) {
      totalWatts = wPerFt * heatedLengthFt;
      const voltageMap = { "120V AC": 120, "208V AC": 208, "240V AC": 240, "277V AC": 277 };
      const voltage = voltageMap[state.voltage];
      if (voltage) {
        totalAmps = totalWatts / voltage;
        if (totalAmps > 20) {
          warnings.push("Calculated amperage exceeds 20A on a single circuit — consider a lower watt density, shorter run, multiple circuits, or engineering review.");
        }
        const plug = PLUG_OPTIONS.find((p) => p.value === state.plugType);
        if (plug && totalAmps > plug.maxAmps) {
          warnings.push(`Calculated amperage (${totalAmps.toFixed(1)}A) exceeds the selected plug's rating (${plug.maxAmps}A) — flagged for review.`);
        }
      }
    }

    const maintainTemp = parseFloat(state.maintainTemp);
    if (fam && !isNaN(maintainTemp) && maintainTemp > fam.maxTempF) {
      warnings.push(`Selected heater construction typically tops out around ${fam.maxTempF}°F — your target of ${maintainTemp}°F is flagged for engineering review.`);
    }

    if (state.heaterFamily === "tape" && state.numTubes && state.numTubes !== "1" && state.numTubes !== REC) {
      warnings.push("Tape heater construction with 2+ tubes needs engineering consultation — wattage/amperage calculations become less certain.");
    }

    const tubeOD = parseFraction(state.tubeOD);
    if (tubeOD) {
      const insulationThicknessIn = 0.25; // typical per Material Info sheet (Aramid/Nomex & Neoprene both 0.25")
      const wraps = parseFloat(state.numWraps) || 0;
      outerDiameter = tubeOD + wraps * insulationThicknessIn * 2 + 0.15; // + rough jacket allowance
    }

    if (state.hazArea && state.hazArea !== "none" && state.hazArea !== "") {
      warnings.push("Hazardous-area classification selected — this specification is flagged for Powerblanket engineering review before quotation.");
    }

    // Temperature class — driven by the heater family's real ceiling, not the tube.
    let tempClass = null;
    if (fam) {
      tempClass = {
        maintainF: fam.maxTempF,
        maintainC: Math.round(((fam.maxTempF - 32) * 5) / 9),
        exposureF: fam.maxExposureF,
      };
    }

    // Relative cost tier — qualitative only, never a dollar figure.
    const tierParts = [];
    if (state.tubeMaterial && TUBE_COST_TIER[state.tubeMaterial]) tierParts.push(TUBE_COST_TIER[state.tubeMaterial]);
    if (fam && fam.costTier) tierParts.push(fam.costTier);
    if (state.insulationType && INSULATION_COST_TIER[state.insulationType]) tierParts.push(INSULATION_COST_TIER[state.insulationType]);
    if (state.outerJacketType && JACKET_COST_TIER[state.outerJacketType]) tierParts.push(JACKET_COST_TIER[state.outerJacketType]);
    let costTier = null;
    if (tierParts.length >= 2) {
      const avg = tierParts.reduce((a, b) => a + b, 0) / tierParts.length;
      const rounded = Math.min(4, Math.max(1, Math.round(avg)));
      costTier = COST_TIER_LABEL[rounded];
    }

    return { totalWatts, totalAmps, outerDiameter, tempClass, costTier, warnings };
  }

  function renderReview() {
    const wrap = document.createElement("div");
    wrap.id = "printRoot";

    const title = document.createElement("h3");
    title.textContent = "Preliminary Heated Line Specification";
    wrap.appendChild(title);

    const calc = computeSpec();

    if (calc.tempClass || calc.costTier || calc.totalWatts) {
      const insight = document.createElement("div");
      insight.className = "spec-insight";
      const insightTitle = document.createElement("p");
      insightTitle.className = "spec-insight-title";
      insightTitle.textContent = "Your System at a Glance — Free, No Obligation";
      insight.appendChild(insightTitle);

      const stats = document.createElement("div");
      stats.className = "spec-insight-stats";

      const addStat = (label, value, sub) => {
        if (!value) return;
        const stat = document.createElement("div");
        stat.className = "spec-insight-stat";
        stat.innerHTML = `<span class="spec-insight-label">${label}</span><span class="spec-insight-value">${value}</span>${sub ? `<span class="spec-insight-sub">${sub}</span>` : ""}`;
        stats.appendChild(stat);
      };

      if (calc.tempClass) {
        addStat(
          "Temperature Class",
          `${calc.tempClass.maintainF}°F (${calc.tempClass.maintainC}°C)`,
          `Continuous maintain &middot; up to ${calc.tempClass.exposureF}°F short-term exposure`
        );
      }
      addStat("Relative Cost / ft", calc.costTier, "Based on your tube, heater, insulation & jacket selections");
      if (calc.totalWatts) {
        addStat(
          "Power Requirements",
          `${Math.round(calc.totalWatts)} W`,
          calc.totalAmps ? `&asymp; ${calc.totalAmps.toFixed(1)} A at ${state.voltage || "selected voltage"}` : null
        );
      }

      insight.appendChild(stats);
      const insightNote = document.createElement("p");
      insightNote.className = "spec-insight-note";
      insightNote.textContent = "Preliminary estimates based on your answers so far — not a quote. Final ratings and pricing are confirmed during engineering review.";
      insight.appendChild(insightNote);
      wrap.appendChild(insight);
    }

    calc.warnings.forEach((w) => {
      const warn = document.createElement("div");
      warn.className = "config-warning";
      warn.textContent = w;
      wrap.appendChild(warn);
    });

    if (calc.outerDiameter) {
      const calcGroup = document.createElement("div");
      calcGroup.className = "review-group";
      const h4 = document.createElement("h4");
      h4.textContent = "Calculated Results (preliminary)";
      calcGroup.appendChild(h4);
      const dl = document.createElement("dl");
      const row = document.createElement("div");
      row.className = "review-row";
      row.innerHTML = `<dt>Approx. finished outer diameter</dt><dd>${calc.outerDiameter.toFixed(2)} in</dd>`;
      dl.appendChild(row);
      calcGroup.appendChild(dl);
      wrap.appendChild(calcGroup);
    }

    let currentStepId = null;
    let currentGroup = null;
    let currentDl = null;

    collectVisibleFields().forEach(({ step, field: f }) => {
      if (step.id !== currentStepId) {
        currentStepId = step.id;
        currentGroup = document.createElement("div");
        currentGroup.className = "review-group";
        const h4 = document.createElement("h4");
        h4.textContent = step.title;
        currentGroup.appendChild(h4);
        currentDl = document.createElement("dl");
        currentGroup.appendChild(currentDl);
        wrap.appendChild(currentGroup);
      }

      const row = document.createElement("div");
      row.className = "review-row";
      const dt = document.createElement("dt");
      dt.textContent = f.label || f.id;
      const dd = document.createElement("dd");

      const raw = state[f.id];
      if (raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
        dd.textContent = "Not specified";
        dd.className = "is-empty";
      } else if (raw === REC || raw === "Not sure" || raw === "unsure") {
        dd.textContent = "Powerblanket to recommend";
        dd.className = "is-recommend";
      } else if (Array.isArray(raw)) {
        dd.textContent = raw.join(", ");
      } else if (f.type === "file") {
        dd.textContent = raw.name || "Attached";
      } else if (f.type === "checkbox") {
        dd.textContent = raw ? "Yes" : "Not specified";
        if (!raw) dd.className = "is-empty";
      } else {
        dd.textContent = optionLabel(f, raw);
      }

      row.appendChild(dt);
      row.appendChild(dd);
      currentDl.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.className = "review-actions";
    actions.innerHTML = `
      <button type="button" class="btn btn-outline-dark" id="actionPrint">Download / Print PDF</button>
      <button type="button" class="btn btn-outline-dark" id="actionSave">Save Specification</button>
      <button type="button" class="btn btn-primary" id="actionSubmit">Submit to Powerblanket for Engineering Review and Quote</button>
    `;
    wrap.appendChild(actions);

    const disclaimer = document.createElement("p");
    disclaimer.className = "review-disclaimer";
    disclaimer.textContent = "Submitting does not place an order. A Powerblanket specialist will review this specification, confirm feasibility, identify any remaining questions, and provide pricing and lead-time information. Final construction, ratings, compatibility, certifications, electrical design, and suitability remain subject to Powerblanket engineering review.";
    wrap.appendChild(disclaimer);

    const backToStart = document.createElement("button");
    backToStart.type = "button";
    backToStart.className = "btn btn-outline-dark";
    backToStart.style.marginTop = "16px";
    backToStart.textContent = "Back to Edit";
    backToStart.addEventListener("click", () => renderStep(STEPS.length - 1));
    wrap.appendChild(backToStart);

    stepContainer.appendChild(wrap);

    document.getElementById("actionPrint").addEventListener("click", () => window.print());
    document.getElementById("actionSave").addEventListener("click", saveSpecification);
    document.getElementById("actionSubmit").addEventListener("click", submitSpecification);
  }

  function buildSummaryText() {
    let out = "PRELIMINARY HEATED LINE SPECIFICATION\n\n";
    const calc = computeSpec();
    if (calc.totalWatts) out += `Approx. total watts: ${Math.round(calc.totalWatts)} W\n`;
    if (calc.totalAmps) out += `Approx. total amps: ${calc.totalAmps.toFixed(1)} A\n`;
    if (calc.outerDiameter) out += `Approx. finished outer diameter: ${calc.outerDiameter.toFixed(2)} in\n`;
    if (calc.warnings.length) out += `\nFlagged for review:\n` + calc.warnings.map((w) => `  - ${w}`).join("\n") + "\n";
    out += "\n";

    let currentStepId = null;
    collectVisibleFields().forEach(({ step, field: f }) => {
      if (step.id !== currentStepId) {
        currentStepId = step.id;
        out += `${step.title.toUpperCase()}\n`;
      }
      const raw = state[f.id];
      let val = "Not specified";
      if (raw === REC || raw === "Not sure" || raw === "unsure") val = "Powerblanket to recommend";
      else if (Array.isArray(raw) && raw.length) val = raw.join(", ");
      else if (raw && f.type === "file") val = raw.name || "Attached";
      else if (raw !== undefined && raw !== null && raw !== "") val = optionLabel(f, raw);
      out += `  ${f.label || f.id}: ${val}\n`;
    });
    out += "\nSubmitting does not place an order. Final construction, ratings, compatibility,\ncertifications, electrical design, and suitability remain subject to Powerblanket\nengineering review.\n";
    return out;
  }

  function saveSpecification() {
    const blob = new Blob([buildSummaryText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heated-line-specification.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitSpecification() {
    const submitBtn = document.getElementById("actionSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const formData = new FormData();
    formData.append("_subject", "New heated line specification");
    formData.append("summary", buildSummaryText());
    if (state.fileUpload) formData.append("attachment", state.fileUpload);
    if (state.contactEmail) formData.append("email", state.contactEmail);

    try {
      const response = await fetch("https://formspree.io/f/YOUR_FORM_ID", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Submission failed");
      stepContainer.innerHTML = `
        <div class="config-success">
          <h3>Specification Submitted</h3>
          <p>Thanks — a Powerblanket specialist will review this specification, confirm feasibility,
          and follow up with pricing and lead-time information. This did not place an order.</p>
        </div>`;
      navRow.style.display = "none";
      if (typeof gtag === "function") gtag("event", "generate_lead", { form_id: "configurator_spec" });
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit to Powerblanket for Engineering Review and Quote";
      alert("Something went wrong submitting your specification. Please try again or use Talk to the Engineering Team below.");
    }
  }

  backBtn.addEventListener("click", () => {
    if (currentIndex > 0) renderStep(Math.min(currentIndex - 1, STEPS.length - 1));
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex === 0 && !state.problemDescription && !state.mediaDescription) {
      alert("Tell us at least a little about the problem or what you're heating — that's what everything else builds from.");
      return;
    }
    renderStep(currentIndex + 1);
  });

  const APPLICATION_CATEGORY_LABELS = {
    cems: "CEMS",
    rata: "RATA / Field Testing",
    process: "Process Gas Analysis",
    mercury: "Mercury Monitoring",
    transfer: "Heated Transport & Transfer",
  };

  document.querySelectorAll(".configure-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.applicationCategory = APPLICATION_CATEGORY_LABELS[btn.dataset.app] || null;
      renderStep(0);
      document.getElementById("configurator").scrollIntoView({ behavior: "smooth" });
    });
  });

  renderStep(0);
})();
