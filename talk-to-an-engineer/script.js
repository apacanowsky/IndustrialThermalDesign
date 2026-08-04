document.getElementById("year").textContent = new Date().getFullYear();

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
    { threshold: 0, rootMargin: "0px 0px -8% 0px" }
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

// ---------- Category tiles: each one reveals its own tailored form ----------
(function () {
  const tiles = Array.from(document.querySelectorAll(".intake-tile"));
  const placeholder = document.getElementById("intake-placeholder");
  const forms = Array.from(document.querySelectorAll(".intake-form"));

  function showForm(category) {
    forms.forEach((form) => form.classList.toggle("is-active", form.dataset.category === category));
    placeholder.style.display = "none";
  }

  function showPlaceholder() {
    forms.forEach((form) => form.classList.remove("is-active"));
    placeholder.style.display = "block";
  }

  tiles.forEach((tile) => {
    tile.addEventListener("click", () => {
      const alreadySelected = tile.classList.contains("is-selected");
      tiles.forEach((t) => t.classList.remove("is-selected"));

      if (alreadySelected) {
        showPlaceholder();
        return;
      }

      tile.classList.add("is-selected");
      showForm(tile.dataset.category);
      document.getElementById("intake-form-section").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();

// ---------- Progressive disclosure: "Add project details" toggles ----------
(function () {
  document.querySelectorAll(".intake-more-toggle").forEach((btn) => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    const label = btn.querySelector(".intake-more-label");
    const optionalTag = btn.querySelector(".optional");
    btn.addEventListener("click", () => {
      const isOpen = target.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(isOpen));
      if (label) label.textContent = isOpen ? "Hide extra details" : "Add project details";
      if (optionalTag) optionalTag.style.display = isOpen ? "none" : "inline";
    });
  });
})();

// ---------- Inline AJAX submit, shared across all three forms ----------
(function () {
  const forms = Array.from(document.querySelectorAll(".intake-form"));
  const successBox = document.getElementById("intake-success");
  const successEmail = document.getElementById("intake-success-email");

  forms.forEach((form) => {
    const errorBox = form.querySelector(".intake-error");

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
          form.classList.remove("is-active");
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
  });
})();
