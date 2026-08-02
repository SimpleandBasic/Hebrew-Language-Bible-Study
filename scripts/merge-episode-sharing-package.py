#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path.cwd()
ZIP_PATH = Path(sys.argv[1]).resolve()


def fail(message: str) -> None:
    raise SystemExit(f"episode-sharing merge failed: {message}")


def insert_once(path: Path, anchor: str, addition: str, *, before: bool = False, marker: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    if anchor not in text:
        fail(f"anchor not found in {path}: {anchor[:80]!r}")
    replacement = (addition + anchor) if before else (anchor + addition)
    text = text.replace(anchor, replacement, 1)
    path.write_text(text, encoding="utf-8")


with tempfile.TemporaryDirectory(prefix="hebrew-sharing-") as tmp:
    tmp_path = Path(tmp)
    with zipfile.ZipFile(ZIP_PATH) as archive:
        archive.extractall(tmp_path)
    candidates = [p for p in tmp_path.iterdir() if p.is_dir()]
    package = candidates[0] if len(candidates) == 1 else tmp_path

    additive = [
        "api/_lib/hebrewEpisodeShare.js",
        "api/hebrew-episode-share.js",
        "api/hebrew-episode-page.js",
        "episode.css",
        "episode.js",
        "scripts/check-episode-share.mjs",
        "supabase/migrations/20260802_hebrew_episode_sharing.sql",
        "tests/episode-share-logic.test.mjs",
    ]
    for rel in additive:
        source = package / rel
        target = ROOT / rel
        if not source.exists():
            fail(f"prepared file missing: {rel}")
        if target.exists() and target.read_bytes() != source.read_bytes():
            fail(f"refusing to overwrite a different existing file: {rel}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    docs = ROOT / "EPISODE-SHARING.md"
    if not docs.exists():
        shutil.copy2(package / "README.md", docs)

    html_addition = '''
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
'''
    insert_once(
        ROOT / "library.html",
        '            <audio id="audioElement" preload="auto" playsinline webkit-playsinline></audio>',
        html_addition,
        before=True,
        marker='id="shareEpisodeButton"',
    )

    css_addition = '''
.episode-share-row { margin: 16px auto 4px; width: min(100%, 520px); }
.share-episode-button { width: 100%; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid rgba(239,198,116,.38); border-radius: 15px; padding: 11px 15px; background: linear-gradient(145deg, rgba(239,198,116,.15), rgba(255,255,255,.035)); color: var(--text); font: inherit; font-weight: 850; cursor: pointer; }
.share-episode-button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.share-episode-button:focus-visible { outline: 3px solid rgba(239,198,116,.42); outline-offset: 3px; }
.share-episode-button:disabled { opacity: .58; cursor: wait; }
.share-episode-status { min-height: 1.2em; margin: 8px 0 0; color: var(--muted); font-size: .78rem; }
'''
    insert_once(
        ROOT / "library.css",
        '.player-options select { border: 1px solid var(--line); border-radius: 10px; padding: 6px; background: var(--panel); color: var(--text); }',
        css_addition,
        marker='.share-episode-button',
    )

    js_path = ROOT / "library.js"
    insert_once(
        js_path,
        '    segmentCounter: document.querySelector("#segmentCounter"),',
        '\n    shareEpisode: document.querySelector("#shareEpisodeButton"),\n    shareEpisodeStatus: document.querySelector("#shareEpisodeStatus"),',
        marker='shareEpisode: document.querySelector("#shareEpisodeButton")',
    )

    text = js_path.read_text(encoding="utf-8")
    if 'elements.shareEpisodeStatus.textContent = ""' not in text:
        anchor = '    elements.openReader.href = `index.html?verse=${Math.max(1, Number(track.verse_reference.split(":")[1]) || 1)}`;'
        if anchor not in text:
            fail("openTrack share-status anchor not found")
        text = text.replace(anchor, anchor + '\n    if (elements.shareEpisodeStatus) elements.shareEpisodeStatus.textContent = "";', 1)
        js_path.write_text(text, encoding="utf-8")

    share_functions = r'''

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
      if (error?.name === "AbortError") {
        elements.shareEpisodeStatus.textContent = "";
      } else {
        console.error("Episode sharing failed.", error);
        elements.shareEpisodeStatus.textContent = error.message || "The episode could not be shared.";
      }
    } finally {
      elements.shareEpisode.disabled = false;
    }
  }
'''
    text = js_path.read_text(encoding="utf-8")
    if "async function shareCurrentEpisode()" not in text:
        anchor = '  document.addEventListener("click", (event) => {'
        if anchor not in text:
            fail("listener insertion anchor not found in library.js")
        text = text.replace(anchor, share_functions + "\n" + anchor, 1)
        js_path.write_text(text, encoding="utf-8")

    text = js_path.read_text(encoding="utf-8")
    if 'elements.shareEpisode?.addEventListener("click", shareCurrentEpisode);' not in text:
        candidates = [
            '  elements.playPause.addEventListener("click", async () => {',
            '  elements.playPause.addEventListener("click", toggleAudio);',
        ]
        anchor = next((candidate for candidate in candidates if candidate in text), None)
        if not anchor:
            fail("share listener anchor not found in library.js")
        text = text.replace(anchor, '  elements.shareEpisode?.addEventListener("click", shareCurrentEpisode);\n' + anchor, 1)
        js_path.write_text(text, encoding="utf-8")

    package_path = ROOT / "package.json"
    package_json = json.loads(package_path.read_text(encoding="utf-8"))
    scripts = package_json.setdefault("scripts", {})
    episode_check = "node --check episode.js && node --check api/_lib/hebrewEpisodeShare.js && node --check api/hebrew-episode-share.js && node --check api/hebrew-episode-page.js && node scripts/check-episode-share.mjs"
    if episode_check not in scripts.get("check", ""):
        scripts["check"] = scripts.get("check", "node scripts/check-all.js") + " && " + episode_check
    episode_test = "node --test tests/episode-share-logic.test.mjs"
    if episode_test not in scripts.get("test", ""):
        scripts["test"] = scripts.get("test", "npm run check") + " && " + episode_test
    package_path.write_text(json.dumps(package_json, indent=2) + "\n", encoding="utf-8")

    vercel_path = ROOT / "vercel.json"
    vercel = json.loads(vercel_path.read_text(encoding="utf-8"))
    rewrites = vercel.setdefault("rewrites", [])
    new_rewrites = [
        {"source": "/listen/:token/:slug", "destination": "/api/hebrew-episode-page?share=:token"},
        {"source": "/listen/:token", "destination": "/api/hebrew-episode-page?share=:token"},
    ]
    existing_sources = {item.get("source") for item in rewrites}
    for item in new_rewrites:
        if item["source"] not in existing_sources:
            rewrites.append(item)
    headers = vercel.setdefault("headers", [])
    existing_header_sources = {item.get("source") for item in headers}
    for source in ("/episode.js", "/episode.css"):
        if source not in existing_header_sources:
            headers.append({"source": source, "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]})
    vercel_path.write_text(json.dumps(vercel, indent=2) + "\n", encoding="utf-8")

print("Episode-sharing package merged conservatively.")
