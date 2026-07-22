(() => {
  "use strict";

  const FALLBACK_COVER = "assets/genesis-cover.svg?v=20260718-1";
  const COVER_PARTS = [
    "assets/genesis-cover-parts/00.b64?v=20260722-1",
    "assets/genesis-cover-parts/01.b64?v=20260722-1",
    "assets/genesis-cover-parts/02.b64?v=20260722-1",
    "assets/genesis-cover-parts/03.b64?v=20260722-1",
    "assets/genesis-cover-parts/04.b64?v=20260722-1",
  ];

  let safeCover = FALLBACK_COVER;

  function isGenesisArtwork(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    const source = image.getAttribute("src") || "";
    const alt = image.getAttribute("alt") || "";
    return /genesis(?:-cover)?\.(?:webp|svg)/i.test(source)
      || /genesis creation artwork/i.test(alt)
      || /genesis artwork/i.test(alt);
  }

  function useSafeCover(image) {
    if (!isGenesisArtwork(image)) return;
    if ((image.getAttribute("src") || "") === safeCover) return;
    image.removeAttribute("onerror");
    image.src = safeCover;
  }

  function refreshArtwork() {
    document.querySelectorAll("img").forEach(useSafeCover);
  }

  async function loadApprovedCover() {
    try {
      const parts = await Promise.all(COVER_PARTS.map(async (url) => {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Genesis artwork part failed (${response.status})`);
        return (await response.text()).replace(/\s+/g, "");
      }));
      safeCover = `data:image/webp;base64,${parts.join("")}`;
      refreshArtwork();
    } catch (error) {
      console.warn("Using the Genesis fallback artwork.", error);
    }
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
    refreshArtwork();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    loadApprovedCover();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
