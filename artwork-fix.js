(() => {
  "use strict";

  const SAFE_COVER = "assets/genesis-cover.svg?v=20260718-1";

  function isGenesisArtwork(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    const source = image.getAttribute("src") || "";
    const alt = image.getAttribute("alt") || "";
    return /genesis(?:-cover)?\.webp/i.test(source) || /genesis creation artwork/i.test(alt) || /genesis artwork/i.test(alt);
  }

  function useSafeCover(image) {
    if (!isGenesisArtwork(image)) return;
    if ((image.getAttribute("src") || "").includes("genesis-cover.svg")) return;
    image.removeAttribute("onerror");
    image.src = SAFE_COVER;
  }

  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) useSafeCover(event.target);
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLImageElement) useSafeCover(node);
        node.querySelectorAll?.("img").forEach(useSafeCover);
      }
    }
  });

  function start() {
    document.querySelectorAll("img").forEach(useSafeCover);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
