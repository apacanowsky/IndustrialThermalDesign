document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Category tiles: prime the form, don't gate it ----------
//
// The form is usable with zero tile clicks — tiles are a shortcut that pre-fills
// context (category + tailored question label/placeholder) and scrolls the visitor
// straight to the field they care about. Gating the form behind a required category
// choice would cost leads from anyone who just wants to type and go.
(function () {
  const CATEGORIES = {
    "new-application": {
      pill: "New Application",
      heading: "Tell us about the new application",
      label: "What are you trying to heat, and what's the goal?",
      placeholder: "e.g. Keep a 500-gallon tote above 90°F through a Minnesota winter…",
    },
    "product-question": {
      pill: "Product & Spec Question",
      heading: "What do you need to know?",
      label: "What's the question?",
      placeholder: "e.g. Do you have a Class I Div 2 rated blanket for a 30-gallon drum?",
    },
    "troubleshooting": {
      pill: "Troubleshooting",
      heading: "Tell us what's going wrong",
      label: "What's the system doing — or not doing?",
      placeholder: "e.g. Our tank blanket is running but the tank isn't holding temperature…",
    },
    "custom-oem": {
      pill: "Custom & OEM Project",
      heading: "Tell us about the project",
      label: "What are you building?",
      placeholder: "e.g. We need heat trace integrated into an OEM skid, ~40 units/year…",
    },
  };
  const DEFAULT_HEADING = "Tell us about your application";
  const DEFAULT_LABEL = "What are you working on?";
  const DEFAULT_PLACEHOLDER = "Describe what you're trying to heat, solve, or troubleshoot…";

  const tiles = Array.from(document.querySelectorAll(".intake-tile"));
  const categoryInput = document.getElementById("category");
  const pill = document.getElementById("intake-category-pill");
  const heading = document.getElementById("intake-form-heading");
  const label = document.getElementById("intake-message-label");
  const textarea = document.getElementById("message");
  const formSection = document.getElementById("intake-form-section");

  function selectCategory(key, tile) {
    const alreadySelected = tile.classList.contains("is-selected");
    tiles.forEach((t) => t.classList.remove("is-selected"));

    if (alreadySelected) {
      categoryInput.value = "";
      pill.style.display = "none";
      heading.textContent = DEFAULT_HEADING;
      label.textContent = DEFAULT_LABEL;
      textarea.placeholder = DEFAULT_PLACEHOLDER;
      return;
    }

    tile.classList.add("is-selected");
    const cfg = CATEGORIES[key];
    categoryInput.value = cfg.pill;
    pill.textContent = cfg.pill;
    pill.style.display = "inline-block";
    heading.textContent = cfg.heading;
    label.textContent = cfg.label;
    textarea.placeholder = cfg.placeholder;

    formSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  tiles.forEach((tile) => {
    tile.addEventListener("click", () => selectCategory(tile.dataset.category, tile));
  });
})();

// ---------- Inline AJAX submit ----------
(function () {
  const form = document.getElementById("intake-form");
  const errorBox = document.getElementById("intake-error");
  const successBox = document.getElementById("intake-success");
  const successEmail = document.getElementById("intake-success-email");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorBox.classList.remove("is-visible");

    const submitBtn = form.querySelector("button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const result = await response.json();

      if (result.success) {
        successEmail.textContent = form.email.value;
        form.hidden = true;
        successBox.classList.add("is-visible");
        successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        throw new Error(result.message || "Submission failed");
      }
    } catch (err) {
      errorBox.textContent = "Something went wrong sending your message. Please try again, or email engineering@powerblanket.com directly.";
      errorBox.classList.add("is-visible");
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
})();
