import {
  escapeHtml,
  getSharedEpisode,
  publicOrigin,
  setCommonSecurityHeaders,
} from "./_lib/hebrewEpisodeShare.js";

function htmlPage({ episode, canonicalUrl, origin }) {
  const title = escapeHtml(episode.title);
  const reference = escapeHtml(episode.reference);
  const description = escapeHtml(`Listen to ${episode.reference} in the Hebrew Bible Study audio library.`);
  const artwork = escapeHtml(episode.artworkUrl || `${origin}/assets/genesis-cover.webp`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#17120d" />
  <title>${title} · Hebrew Bible Study</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Hebrew Bible Study" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  ${artwork ? `<meta property="og:image" content="${artwork}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="/episode.css?v=20260802-share-v1" />
</head>
<body>
  <main class="shared-shell" id="sharedEpisode" aria-live="polite">
    <p class="brand">Hebrew Bible Study</p>
    <section class="episode-card">
      ${artwork ? `<img class="episode-artwork" src="${artwork}" alt="${reference} episode artwork" />` : ""}
      <div class="episode-copy">
        <p class="eyebrow">Shared audio sermon</p>
        <p class="reference">${reference}</p>
        <h1>${title}</h1>
        <p class="privacy-note">This page contains only the episode that was shared with you.</p>
      </div>

      <section class="player" aria-label="Shared episode player">
        <p class="section-label" id="sharedSectionLabel">Loading episode…</p>
        <div class="transport">
          <button id="sharedPrevious" type="button" aria-label="Previous section">‹</button>
          <button id="sharedPlayPause" class="main-play" type="button" aria-label="Play">▶</button>
          <button id="sharedNext" type="button" aria-label="Next section">›</button>
        </div>
        <div class="seek-row">
          <span id="sharedElapsed">0:00</span>
          <input id="sharedSeek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek through episode" />
          <span id="sharedTotal">0:00</span>
        </div>
        <div class="player-options">
          <label for="sharedSpeed">Speed</label>
          <select id="sharedSpeed">
            <option value="0.75">0.75×</option>
            <option value="1" selected>1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          <span id="sharedCounter">Section 1</span>
        </div>
        <audio id="sharedAudio" preload="metadata"></audio>
        <button id="reshareEpisode" class="reshare" type="button">Share this episode</button>
        <p id="sharedStatus" class="status" role="status"></p>
      </section>

      <section class="transcript-card">
        <p class="eyebrow">Full transcript</p>
        <div id="sharedTranscript"></div>
      </section>
    </section>
  </main>
  <script src="/episode.js?v=20260802-share-v1" defer></script>
</body>
</html>`;
}

function unavailablePage(message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>Episode unavailable</title><link rel="stylesheet" href="/episode.css?v=20260802-share-v1" /></head><body><main class="shared-shell"><section class="unavailable"><p class="eyebrow">Hebrew Bible Study</p><h1>Episode unavailable</h1><p>${escapeHtml(message)}</p></section></main></body></html>`;
}

export default async function handler(request, response) {
  setCommonSecurityHeaders(response, { cache: true });
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://*.supabase.co data:; media-src 'self' https://*.supabase.co blob:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );

  try {
    const token = String(request.query?.share || "");
    const episode = await getSharedEpisode(token);
    const origin = publicOrigin(request);
    const canonicalUrl = `${origin}/listen/${encodeURIComponent(token)}/${encodeURIComponent(episode.slug)}`;
    response.statusCode = 200;
    response.end(htmlPage({ episode, canonicalUrl, origin }));
  } catch (error) {
    console.error("Hebrew shared episode page failed.", error);
    response.statusCode = Number(error.status) || 500;
    response.end(unavailablePage(error.status === 404 ? error.message : "Please try the link again later."));
  }
}
