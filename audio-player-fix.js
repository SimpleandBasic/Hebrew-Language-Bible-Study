(() => {
  "use strict";

  const STORAGE_PREFIX = "https://cmryhxnhnltrewvduico.supabase.co/storage/v1/object/public/hebrew-media/";
  const PROXY_PATH = "/api/hebrew-audio-stream?path=";

  const audio = document.querySelector("#audioElement");
  const playButton = document.querySelector("#playPause");
  const status = document.querySelector("#statusCard");

  if (!audio || !playButton) return;

  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");

  function setStatus(message, type = "ready") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type;
  }

  function proxyUrl(value) {
    const source = String(value || "");
    if (!source.startsWith(STORAGE_PREFIX)) return "";
    const path = decodeURIComponent(source.slice(STORAGE_PREFIX.length).split("?")[0]);
    if (!path.startsWith("audio/genesis/") || !path.endsWith(".mp3")) return "";
    return `${PROXY_PATH}${encodeURIComponent(path)}`;
  }

  const observer = new MutationObserver(() => {
    const current = audio.getAttribute("src") || "";
    const proxied = proxyUrl(current);
    if (!proxied || current === proxied) return;

    audio.setAttribute("src", proxied);
    audio.load();
    setStatus("Audio loaded. Tap Play.", "ready");
  });

  observer.observe(audio, { attributes: true, attributeFilter: ["src"] });

  document.addEventListener("click", async (event) => {
    const control = event.target.closest("#playPause");
    if (!control) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!audio.getAttribute("src")) {
      setStatus("Choose an audio lesson first.", "error");
      return;
    }

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      setStatus("Starting audio…", "loading");
      await audio.play();
      setStatus("Audio is playing.", "ready");
    } catch (error) {
      const name = error instanceof Error ? error.name : "PlaybackError";
      const message = error instanceof Error ? error.message : String(error);
      console.error("Hebrew audio play failed", { name, message, src: audio.currentSrc || audio.src });
      setStatus(`Audio could not start (${name}). Tap Play once more.`, "error");
    }
  }, true);

  audio.addEventListener("loadstart", () => setStatus("Loading audio…", "loading"));
  audio.addEventListener("canplay", () => setStatus("Audio ready. Tap Play.", "ready"));
  audio.addEventListener("playing", () => setStatus("Audio is playing.", "ready"));
  audio.addEventListener("stalled", () => setStatus("The audio connection paused. Tap Play to retry.", "error"));
  audio.addEventListener("error", (event) => {
    event.stopImmediatePropagation();
    const codes = {
      1: "Playback was stopped",
      2: "Network error",
      3: "Audio decoding error",
      4: "Audio format not supported",
    };
    const detail = codes[audio.error?.code] || "Unknown playback error";
    console.error("Hebrew audio element error", {
      code: audio.error?.code || 0,
      detail,
      src: audio.currentSrc || audio.src,
    });
    setStatus(`${detail}. Tap Play to retry.`, "error");
  }, true);
})();
