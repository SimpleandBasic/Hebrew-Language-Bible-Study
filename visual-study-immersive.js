(() => {
  "use strict";

  const list = document.querySelector("#visualFeedList");
  const exploreScreen = document.querySelector("#exploreScreen");
  const header = exploreScreen?.querySelector(".explore-header");
  if (!list || !exploreScreen || !header) return;

  document.body.classList.add("visual-immersive-enabled");

  let rail = null;
  let observer = null;

  function setActive(index) {
    const cards = [...list.querySelectorAll(".visual-card")];
    cards.forEach((card, cardIndex) => card.classList.toggle("is-visual-active", cardIndex === index));
    rail?.querySelectorAll("button").forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function createRail(cards) {
    rail?.remove();
    rail = document.createElement("nav");
    rail.className = "visual-chapter-rail";
    rail.setAttribute("aria-label", "Genesis 1:14 visual scenes");

    const label = document.createElement("span");
    label.className = "visual-chapter-rail-label";
    label.textContent = "Visual journey";
    rail.append(label);

    const controls = document.createElement("div");
    controls.className = "visual-chapter-rail-controls";

    cards.forEach((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Go to visual scene ${index + 1}`);
      button.innerHTML = `<span>${index + 1}</span>`;
      button.addEventListener("click", () => {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
        setActive(index);
      });
      controls.append(button);
    });

    rail.append(controls);
    header.insertAdjacentElement("afterend", rail);
  }

  function enhanceCards() {
    const cards = [...list.querySelectorAll(".visual-card")];
    if (!cards.length) return;

    cards.forEach((card, index) => {
      card.id = `visual-scene-${index + 1}`;
      card.classList.add("immersive-visual-card");
      card.style.setProperty("--visual-scene", String(index + 1));

      const copy = card.querySelector(".visual-card-copy");
      if (copy && !copy.querySelector(".visual-step-chip")) {
        const chip = document.createElement("span");
        chip.className = "visual-step-chip";
        chip.textContent = `Scene ${index + 1} of ${cards.length}`;
        copy.prepend(chip);
      }

      const image = card.querySelector(".visual-card-media img");
      if (image) {
        image.decoding = "async";
        if (index === 0) {
          image.loading = "eager";
          image.fetchPriority = "high";
        } else {
          image.loading = "lazy";
        }
      }
    });

    createRail(cards);
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setActive(cards.indexOf(visible.target));
    }, { rootMargin: "-20% 0px -46% 0px", threshold: [0.2, 0.45, 0.7] });

    cards.forEach((card) => observer.observe(card));
    setActive(0);
  }

  const mutationObserver = new MutationObserver(() => enhanceCards());
  mutationObserver.observe(list, { childList: true });
  enhanceCards();
})();
