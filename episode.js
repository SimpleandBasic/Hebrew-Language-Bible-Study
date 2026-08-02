(() => {
  "use strict";

  const elements = {
    audio: document.querySelector("#sharedAudio"),
    playPause: document.querySelector("#sharedPlayPause"),
    previous: document.querySelector("#sharedPrevious"),
    next: document.querySelector("#sharedNext"),
    seek: document.querySelector("#sharedSeek"),
    elapsed: document.querySelector("#sharedElapsed"),
    total: document.querySelector("#sharedTotal"),
    speed: document.querySelector("#sharedSpeed"),
    counter: document.querySelector("#sharedCounter"),
    sectionLabel: document.querySelector("#sharedSectionLabel"),
    transcript: document.querySelector("#sharedTranscript"),
    status: document.querySelector("#sharedStatus"),
    reshare: document.querySelector("#reshareEpisode"),
  };

  const state = {
    episode: null,
    segments: [],
    index: 0,
    durations: [],
    seeking: false,
  };

  function tokenFromLocation() {
    const queryToken = new URLSearchParams(location.search).get("share");
    if (queryToken) return queryToken;
    const parts = location.pathname.split("/").filter(Boolean);
    return parts[0] === "listen" ? parts[1] || "" : "";
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.round(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function totalDuration() {
    return state.durations.reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function elapsedBeforeCurrent() {
    return state.durations.slice(0, state.index).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function updateSeek() {
    if (state.seeking) return;
    const elapsed = elapsedBeforeCurrent() + (Number(elements.audio.currentTime) || 0);
    const total = totalDuration();
    elements.seek.max = String(Math.max(total, 1));
    elements.seek.value = String(Math.min(elapsed, Math.max(total, 1)));
    elements.elapsed.textContent = formatTime(elapsed);
    elements.total.textContent = formatTime(total);
  }

  function updateSectionUi() {
    const segment = state.segments[state.index];
    if (!segment) return;
    elements.sectionLabel.textContent = segment.label;
    elements.counter.textContent = `Section ${state.index + 1} of ${state.segments.length}`;
    elements.previous.disabled = state.index === 0;
    elements.next.disabled = state.index >= state.segments.length - 1;
    document.querySelectorAll("[data-shared-segment]").forEach((item, index) => {
      item.classList.toggle("is-current", index === state.index);
    });
  }

  async function loadSegment(index, { autoplay = false, position = 0 } = {}) {
    const segment = state.segments[index];
    if (!segment?.audioUrl) return;
    const wasPlaying = !elements.audio.paused;
    state.index = index;
    elements.audio.src = segment.audioUrl;
    elements.audio.playbackRate = Number(elements.speed.value) || 1;
    elements.audio.load();
    elements.audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(elements.audio.duration)) state.durations[index] = elements.audio.duration;
      const maximum = Math.max(0, (elements.audio.duration || 0) - 0.1);
      elements.audio.currentTime = Math.min(Number(position) || 0, maximum);
      updateSeek();
    }, { once: true });
    updateSectionUi();
    if (autoplay || wasPlaying) {
      try { await elements.audio.play(); } catch { /* User gesture may be required. */ }
    }
  }

  function renderTranscript() {
    elements.transcript.innerHTML = "";
    state.segments.forEach((segment, index) => {
      const article = document.createElement("article");
      article.className = `transcript-segment${index === state.index ? " is-current" : ""}`;
      article.dataset.sharedSegment = String(index);
      const heading = document.createElement("h2");
      heading.textContent = segment.label;
      const paragraph = document.createElement("p");
      paragraph.textContent = segment.transcript || "";
      if (String(segment.type).includes("hebrew")) paragraph.classList.add("hebrew-display");
      article.append(heading, paragraph);
      article.addEventListener("click", () => loadSegment(index, { autoplay: true }));
      elements.transcript.append(article);
    });
  }

  async function toggleAudio() {
    if (!elements.audio.src) return;
    if (elements.audio.paused) {
      try { await elements.audio.play(); } catch { elements.status.textContent = "Tap play again to begin the episode."; }
    } else {
      elements.audio.pause();
    }
  }

  async function reshare() {
    const shareData = {
      title: state.episode?.title || document.title,
      text: `Listen to ${state.episode?.reference || "this Hebrew Bible Study episode"}.`,
      url: location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        elements.status.textContent = "Share sheet opened.";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(location.href);
        elements.status.textContent = "Episode link copied.";
      } else {
        window.prompt("Copy this episode link:", location.href);
      }
    } catch (error) {
      if (error?.name !== "AbortError") elements.status.textContent = "The link could not be shared. Please copy it from your browser.";
    }
  }

  async function loadEpisode() {
    const token = tokenFromLocation();
    if (!token) throw new Error("The shared episode token is missing.");
    const response = await fetch(`/api/hebrew-episode-share?share=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "This shared episode is unavailable.");
    state.episode = body.episode;
    state.segments = Array.isArray(body.episode?.segments) ? body.episode.segments : [];
    if (!state.segments.length) throw new Error("This episode does not have playable audio yet.");
    state.durations = state.segments.map((segment) => Number(segment.durationSeconds) || 0);
    renderTranscript();
    await loadSegment(0);
    elements.status.textContent = "";
  }

  elements.playPause.addEventListener("click", toggleAudio);
  elements.previous.addEventListener("click", () => loadSegment(Math.max(0, state.index - 1), { autoplay: true }));
  elements.next.addEventListener("click", () => loadSegment(Math.min(state.segments.length - 1, state.index + 1), { autoplay: true }));
  elements.reshare.addEventListener("click", reshare);

  elements.audio.addEventListener("play", () => {
    elements.playPause.textContent = "❚❚";
    elements.playPause.setAttribute("aria-label", "Pause");
  });
  elements.audio.addEventListener("pause", () => {
    elements.playPause.textContent = "▶";
    elements.playPause.setAttribute("aria-label", "Play");
  });
  elements.audio.addEventListener("timeupdate", updateSeek);
  elements.audio.addEventListener("ended", () => {
    if (state.index < state.segments.length - 1) loadSegment(state.index + 1, { autoplay: true });
  });
  elements.audio.addEventListener("error", () => {
    elements.status.textContent = "This audio section could not be loaded. Try the next section.";
  });
  elements.speed.addEventListener("change", () => {
    elements.audio.playbackRate = Number(elements.speed.value) || 1;
  });
  elements.seek.addEventListener("pointerdown", () => { state.seeking = true; });
  elements.seek.addEventListener("input", () => { elements.elapsed.textContent = formatTime(elements.seek.value); });
  elements.seek.addEventListener("change", () => {
    const target = Number(elements.seek.value) || 0;
    let running = 0;
    for (let index = 0; index < state.durations.length; index += 1) {
      const duration = Number(state.durations[index]) || 0;
      if (target <= running + duration || index === state.durations.length - 1) {
        const autoplay = !elements.audio.paused;
        state.seeking = false;
        loadSegment(index, { autoplay, position: Math.max(0, target - running) });
        return;
      }
      running += duration;
    }
    state.seeking = false;
  });

  loadEpisode().catch((error) => {
    console.error("Shared Hebrew episode failed to load.", error);
    elements.sectionLabel.textContent = "Episode unavailable";
    elements.status.textContent = error.message;
    elements.playPause.disabled = true;
    elements.previous.disabled = true;
    elements.next.disabled = true;
  });
})();
