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
  audio.preload = "auto";

  let preparedBlobUrl = "";
  let sourceToken = 0;
  let loadingPromise = null;
  let pendingPlay = false;
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

  async function prepareSource(rawSource) {
    const path = pathFromSource(rawSource);
    if (!validAudioPath(path)) return;

    const token = ++sourceToken;
    pendingPlay = false;
    setStatus("Loading audio section…", "loading");

    loadingPromise = (async () => {
      try {
        const response = await fetch(proxyUrl(path), {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "audio/mpeg" },
        });

        if (!response.ok) throw new Error(`Audio request failed (${response.status})`);
        const blob = await response.blob();
        if (token !== sourceToken) return;
        if (!blob.size || !String(blob.type || "").startsWith("audio/")) {
          throw new Error(`Invalid audio response (${blob.type || "unknown type"}, ${blob.size} bytes)`);
        }

        if (preparedBlobUrl) URL.revokeObjectURL(preparedBlobUrl);
        preparedBlobUrl = URL.createObjectURL(blob);

        internalSourceChange = true;
        audio.src = preparedBlobUrl;
        audio.load();
        internalSourceChange = false;

        setStatus("Audio ready. Tap Play.", "ready");

        if (pendingPlay) {
          pendingPlay = false;
          try {
            await audio.play();
          } catch (error) {
            console.error("Hebrew audio deferred play failed", error);
            setStatus("Audio is ready. Tap Play once more.", "error");
          }
        }
      } catch (error) {
        if (token !== sourceToken) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error("Hebrew audio preparation failed", { message, path });
        setStatus(`Audio could not load: ${message}`, "error");
      } finally {
        if (token === sourceToken) loadingPromise = null;
      }
    })();

    await loadingPromise;
  }

  const observer = new MutationObserver(() => {
    if (internalSourceChange) return;
    const current = audio.getAttribute("src") || "";
    if (!pathFromSource(current)) return;
    void prepareSource(current);
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

    if (loadingPromise) {
      pendingPlay = true;
      setStatus("Finishing the audio download…", "loading");
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

  audio.addEventListener("canplay", () => setStatus("Audio ready. Tap Play.", "ready"));
  audio.addEventListener("playing", () => setStatus("Audio is playing.", "ready"));
  audio.addEventListener("stalled", () => setStatus("Audio paused while loading. Tap Play to retry.", "error"));
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

  window.addEventListener("pagehide", () => {
    if (preparedBlobUrl) URL.revokeObjectURL(preparedBlobUrl);
  });
})();