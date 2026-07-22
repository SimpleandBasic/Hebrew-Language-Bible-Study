(() => {
  "use strict";

  const STORAGE_PREFIX = "https://cmryhxnhnltrewvduico.supabase.co/storage/v1/object/public/hebrew-media/";
  const PROXY_PATH = "/api/hebrew-audio-stream?path=";

  const audio = document.querySelector("#audioElement");
  const status = document.querySelector("#statusCard");

  if (!audio) return;

  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.preload = "auto";

  const nativePlay = audio.play.bind(audio);
  let sourcePromise = null;
  let internalSourceChange = false;

  function setStatus(message, type = "ready") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type;
  }

  function pathFromSource(value) {
    const source = String(value || "");
    if (source.startsWith(STORAGE_PREFIX)) {
      return decodeURIComponent(source.slice(STORAGE_PREFIX.length).split("?")[0]);
    }
    if (source.startsWith(PROXY_PATH)) {
      return decodeURIComponent(source.slice(PROXY_PATH.length).split("&")[0]);
    }
    return "";
  }

  function validAudioPath(path) {
    return path.startsWith("audio/genesis/") && path.endsWith(".mp3") && !path.includes("..") && !path.includes("\\");
  }

  function proxyUrl(path) {
    return `${PROXY_PATH}${encodeURIComponent(path)}`;
  }

  function waitUntilPlayable(timeoutMs = 12000) {
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error("Audio took too long to become playable.")), timeoutMs);

      function cleanup() {
        window.clearTimeout(timer);
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("loadeddata", onReady);
        audio.removeEventListener("error", onError);
      }

      function finish(error) {
        cleanup();
        if (error) reject(error);
        else resolve();
      }

      function onReady() { finish(); }
      function onError() { finish(new Error("The audio file could not be decoded.")); }

      audio.addEventListener("canplay", onReady, { once: true });
      audio.addEventListener("loadeddata", onReady, { once: true });
      audio.addEventListener("error", onError, { once: true });
    });
  }

  async function prepareCurrentSource() {
    const current = audio.getAttribute("src") || "";
    const path = pathFromSource(current);
    if (!validAudioPath(path)) return;

    const desired = proxyUrl(path);
    if (current !== desired) {
      internalSourceChange = true;
      audio.setAttribute("src", desired);
      audio.load();
      internalSourceChange = false;
    }

    setStatus("Buffering audio…", "loading");
    await waitUntilPlayable();
    setStatus("Audio ready.", "ready");
  }

  function ensureCurrentSource() {
    if (!sourcePromise) {
      sourcePromise = prepareCurrentSource().finally(() => { sourcePromise = null; });
    }
    return sourcePromise;
  }

  audio.play = async function playHebrewAudio() {
    try {
      await ensureCurrentSource();
      const result = await nativePlay();
      setStatus("Audio is playing.", "ready");
      return result;
    } catch (error) {
      const name = error instanceof Error ? error.name : "PlaybackError";
      const message = error instanceof Error ? error.message : String(error);
      console.error("Hebrew audio play failed", { name, message, src: audio.currentSrc || audio.src });
      setStatus(`Audio could not start: ${message}`, "error");
      throw error;
    }
  };

  const observer = new MutationObserver(() => {
    if (internalSourceChange) return;
    const current = audio.getAttribute("src") || "";
    const path = pathFromSource(current);
    if (!validAudioPath(path)) return;
    void ensureCurrentSource().catch((error) => {
      console.error("Hebrew audio source preparation failed", error);
      setStatus(`Audio could not load: ${error.message}`, "error");
    });
  });

  observer.observe(audio, { attributes: true, attributeFilter: ["src"] });

  audio.addEventListener("loadstart", () => setStatus("Loading audio…", "loading"));
  audio.addEventListener("waiting", () => setStatus("Buffering audio…", "loading"));
  audio.addEventListener("canplay", () => setStatus("Audio ready.", "ready"));
  audio.addEventListener("playing", () => setStatus("Audio is playing.", "ready"));
  audio.addEventListener("stalled", () => setStatus("The connection paused. Tap Play to resume.", "error"));
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
