import { readFile, writeFile } from 'node:fs/promises';

async function insert(path, anchor, addition, marker, { before = false } = {}) {
  let text = await readFile(path, 'utf8');
  if (text.includes(marker)) return false;
  if (!text.includes(anchor)) throw new Error(`${path}: episode-sharing anchor not found: ${anchor}`);
  text = text.replace(anchor, before ? addition + anchor : anchor + addition);
  await writeFile(path, text);
  return true;
}

const html = `
            <div class="episode-share-row">
              <button id="shareEpisodeButton" class="share-episode-button" type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 16V4"></path>
                  <path d="m7 9 5-5 5 5"></path>
                  <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"></path>
                </svg>
                <span>Share this episode</span>
              </button>
              <p id="shareEpisodeStatus" class="share-episode-status" role="status" aria-live="polite"></p>
            </div>

`;

const css = `
.episode-share-row { margin: 16px auto 4px; width: min(100%, 520px); }
.share-episode-button { width: 100%; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid rgba(239,198,116,.38); border-radius: 15px; padding: 11px 15px; background: linear-gradient(145deg, rgba(239,198,116,.15), rgba(255,255,255,.035)); color: var(--text); font: inherit; font-weight: 850; cursor: pointer; }
.share-episode-button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.share-episode-button:focus-visible { outline: 3px solid rgba(239,198,116,.42); outline-offset: 3px; }
.share-episode-button:disabled { opacity: .58; cursor: wait; }
.share-episode-status { min-height: 1.2em; margin: 8px 0 0; color: var(--muted); font-size: .78rem; }
`;

const functions = `

  async function copyShareLink(url) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
    const input = document.createElement("textarea");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  }

  async function shareCurrentEpisode() {
    const track = state.currentTrack;
    if (!track || !elements.shareEpisode) return;
    elements.shareEpisode.disabled = true;
    elements.shareEpisodeStatus.textContent = "Preparing a single-episode link…";
    try {
      const response = await fetch("/api/hebrew-episode-share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ trackId: track.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) throw new Error(body.error || "The episode link could not be created.");
      const shareData = {
        title: track.track_title,
        text: \`Listen to \${track.verse_reference} in the Hebrew Bible Study audio library.\`,
        url: body.url,
      };
      if (navigator.share) {
        await navigator.share(shareData);
        elements.shareEpisodeStatus.textContent = "Share sheet opened.";
      } else if (await copyShareLink(body.url)) {
        elements.shareEpisodeStatus.textContent = "Episode link copied.";
      } else {
        window.prompt("Copy this episode link:", body.url);
        elements.shareEpisodeStatus.textContent = "Episode link ready.";
      }
    } catch (error) {
      if (error?.name === "AbortError") elements.shareEpisodeStatus.textContent = "";
      else {
        console.error("Episode sharing failed.", error);
        elements.shareEpisodeStatus.textContent = error.message || "The episode could not be shared.";
      }
    } finally {
      elements.shareEpisode.disabled = false;
    }
  }
`;

let changed = false;
changed = await insert(
  'library.html',
  '            <audio id="audioElement" preload="auto" playsinline webkit-playsinline></audio>',
  html,
  'id="shareEpisodeButton"',
  { before: true },
) || changed;
changed = await insert(
  'library.css',
  '.player-options select { border: 1px solid var(--line); border-radius: 10px; padding: 6px; background: var(--panel); color: var(--text); }',
  css,
  '.share-episode-button',
) || changed;
changed = await insert(
  'library.js',
  '    segmentCounter: document.querySelector("#segmentCounter"),',
  '\n    shareEpisode: document.querySelector("#shareEpisodeButton"),\n    shareEpisodeStatus: document.querySelector("#shareEpisodeStatus"),',
  'shareEpisode: document.querySelector("#shareEpisodeButton")',
) || changed;
changed = await insert(
  'library.js',
  '    elements.openReader.href = `index.html?verse=${Math.max(1, Number(track.verse_reference.split(":")[1]) || 1)}`;',
  '\n    if (elements.shareEpisodeStatus) elements.shareEpisodeStatus.textContent = "";',
  'elements.shareEpisodeStatus.textContent = ""',
) || changed;
changed = await insert(
  'library.js',
  '  document.addEventListener("click", (event) => {',
  functions + '\n',
  'async function shareCurrentEpisode()',
  { before: true },
) || changed;

let libraryJs = await readFile('library.js', 'utf8');
if (!libraryJs.includes('elements.shareEpisode?.addEventListener("click", shareCurrentEpisode);')) {
  const anchors = [
    '  elements.playPause.addEventListener("click", async () => {',
    '  elements.playPause.addEventListener("click", toggleAudio);',
  ];
  const anchor = anchors.find((candidate) => libraryJs.includes(candidate));
  if (!anchor) throw new Error('library.js: player listener anchor not found');
  libraryJs = libraryJs.replace(anchor, '  elements.shareEpisode?.addEventListener("click", shareCurrentEpisode);\n' + anchor);
  await writeFile('library.js', libraryJs);
  changed = true;
}

console.log(changed ? 'Applied merge-safe episode sharing patch.' : 'Episode sharing patch already applied.');
