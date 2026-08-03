document.getElementById("year").textContent = new Date().getFullYear();

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
