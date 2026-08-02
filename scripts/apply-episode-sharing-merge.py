#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path.cwd()


def fail(message: str) -> None:
    raise SystemExit(f"episode-sharing merge failed: {message}")


def insert(path: str, anchor: str, addition: str, marker: str, *, before: bool = False) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if marker in text:
        return
    if anchor not in text:
        fail(f"{path}: anchor missing: {anchor[:100]}")
    text = text.replace(anchor, addition + anchor if before else anchor + addition, 1)
    target.write_text(text, encoding="utf-8")

required = [
    "api/_lib/hebrewEpisodeShare.js",
    "api/hebrew-episode-share.js",
    "api/hebrew-episode-page.js",
    "episode.css",
    "episode.js",
    "scripts/check-episode-share.mjs",
    "supabase/migrations/20260802_hebrew_episode_sharing.sql",
    "tests/episode-share-logic.test.mjs",
]
for relative in required:
    if not (ROOT / relative).exists():
        fail(f"prepared additive file missing: {relative}")

html = '''\n            <div class="episode-share-row">\n              <button id="shareEpisodeButton" class="share-episode-button" type="button">\n                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">\n                  <path d="M12 16V4"></path>\n                  <path d="m7 9 5-5 5 5"></path>\n                  <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"></path>\n                </svg>\n                <span>Share this episode</span>\n              </button>\n              <p id="shareEpisodeStatus" class="share-episode-status" role="status" aria-live="polite"></p>\n            </div>\n\n'''
insert(
    "library.html",
    '            <audio id="audioElement" preload="auto" playsinline webkit-playsinline></audio>',
    html,
    'id="shareEpisodeButton"',
    before=True,
)

css = '''\n.episode-share-row { margin: 16px auto 4px; width: min(100%, 520px); }\n.share-episode-button { width: 100%; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid rgba(239,198,116,.38); border-radius: 15px; padding: 11px 15px; background: linear-gradient(145deg, rgba(239,198,116,.15), rgba(255,255,255,.035)); color: var(--text); font: inherit; font-weight: 850; cursor: pointer; }\n.share-episode-button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }\n.share-episode-button:focus-visible { outline: 3px solid rgba(239,198,116,.42); outline-offset: 3px; }\n.share-episode-button:disabled { opacity: .58; cursor: wait; }\n.share-episode-status { min-height: 1.2em; margin: 8px 0 0; color: var(--muted); font-size: .78rem; }\n'''
insert(
    "library.css",
    '.player-options select { border: 1px solid var(--line); border-radius: 10px; padding: 6px; background: var(--panel); color: var(--text); }',
    css,
    ".share-episode-button",
)

insert(
    "library.js",
    '    segmentCounter: document.querySelector("#segmentCounter"),',
    '\n    shareEpisode: document.querySelector("#shareEpisodeButton"),\n    shareEpisodeStatus: document.querySelector("#shareEpisodeStatus"),',
    'shareEpisode: document.querySelector("#shareEpisodeButton")',
)
insert(
    "library.js",
    '    elements.openReader.href = `index.html?verse=${Math.max(1, Number(track.verse_reference.split(":")[1]) || 1)}`;',
    '\n    if (elements.shareEpisodeStatus) elements.shareEpisodeStatus.textContent = "";',
    'elements.shareEpisodeStatus.textContent = ""',
)

functions = r'''

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
        text: `Listen to ${track.verse_reference} in the Hebrew Bible Study audio library.`,
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
'''
insert(
    "library.js",
    '  document.addEventListener("click", (event) => {',
    functions + "\n",
    "async function shareCurrentEpisode()",
    before=True,
)

library_js = (ROOT / "library.js").read_text(encoding="utf-8")
listener = '  elements.shareEpisode?.addEventListener("click", shareCurrentEpisode);\n'
if listener.strip() not in library_js:
    anchors = [
        '  elements.playPause.addEventListener("click", async () => {',
        '  elements.playPause.addEventListener("click", toggleAudio);',
    ]
    anchor = next((candidate for candidate in anchors if candidate in library_js), None)
    if not anchor:
        fail("library.js: player listener anchor missing")
    library_js = library_js.replace(anchor, listener + anchor, 1)
    (ROOT / "library.js").write_text(library_js, encoding="utf-8")

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
checks = "node --check episode.js && node --check api/_lib/hebrewEpisodeShare.js && node --check api/hebrew-episode-share.js && node --check api/hebrew-episode-page.js && node scripts/check-episode-share.mjs"
if checks not in package["scripts"]["check"]:
    package["scripts"]["check"] += " && " + checks
episode_test = "node --test tests/episode-share-logic.test.mjs"
if episode_test not in package["scripts"]["test"]:
    package["scripts"]["test"] += " && " + episode_test
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

vercel_path = ROOT / "vercel.json"
vercel = json.loads(vercel_path.read_text(encoding="utf-8"))
rewrites = vercel.setdefault("rewrites", [])
for item in [
    {"source": "/listen/:token/:slug", "destination": "/api/hebrew-episode-page?share=:token"},
    {"source": "/listen/:token", "destination": "/api/hebrew-episode-page?share=:token"},
]:
    if not any(row.get("source") == item["source"] for row in rewrites):
        rewrites.append(item)
headers = vercel.setdefault("headers", [])
for source in ("/episode.js", "/episode.css"):
    if not any(row.get("source") == source for row in headers):
        headers.append({"source": source, "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]})
vercel_path.write_text(json.dumps(vercel, indent=2) + "\n", encoding="utf-8")

print("Conservative episode-sharing merge complete.")
