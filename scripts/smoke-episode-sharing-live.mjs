const origin = String(process.env.PUBLIC_SITE_URL || 'https://hebrew-developer-mcp.vercel.app').replace(/\/$/, '');
const newestTrackId = '03db45b6-0319-4c1f-956d-9fb6d3e22d86';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function textRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

const create = await textRequest(`${origin}/api/hebrew-episode-share`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ trackId: newestTrackId }),
});
assert(create.response.status === 200, `share POST failed (${create.response.status}): ${create.text}`);
const created = JSON.parse(create.text);
assert(created.url?.startsWith(`${origin}/listen/`), 'share POST did not return the production single-episode URL');
assert(!created.url.includes('genesis-2-5-genesis-2-5'), 'share URL repeated the Scripture reference');

const page = await textRequest(created.url, { headers: { accept: 'text/html' } });
assert(page.response.status === 200, `shared page failed (${page.response.status})`);
assert(page.response.headers.get('cache-control') === 'no-store', 'shared page must be no-store for immediate revocation');
assert(page.text.includes('Genesis 2:5 — Before the Rain: God’s Gift, Our Hands'), 'shared page title is incorrect');
assert(page.text.includes('This page contains only the episode that was shared with you.'), 'single-episode privacy notice is missing');
assert(page.text.includes('id="sharedSpeed"') && page.text.includes('id="sharedTranscript"'), 'public player controls or transcript mount are missing');
assert(!page.text.includes('bottom-nav') && !page.text.includes('Manual Lesson Builder'), 'private app navigation leaked into the public page');

const token = new URL(created.url).pathname.split('/').filter(Boolean)[1];
const episodeResponse = await fetch(`${origin}/api/hebrew-episode-share?share=${encodeURIComponent(token)}`, {
  headers: { accept: 'application/json' },
});
assert(episodeResponse.status === 200, `shared episode API failed (${episodeResponse.status})`);
const episodeBody = await episodeResponse.json();
const episode = episodeBody.episode;
assert(episode?.id === newestTrackId, 'shared API returned a different episode');
assert(episode.reference === 'Genesis 2:5', 'shared API returned the wrong Scripture reference');
assert(Array.isArray(episode.segments) && episode.segments.length === 8, 'shared API did not return the eight ready sections');
assert(episode.segments.every((segment) => segment.audioUrl && segment.transcript), 'audio or transcript data is missing');

const audioResponse = await fetch(episode.segments[0].audioUrl, {
  headers: { Range: 'bytes=0-1023' },
});
assert([200, 206].includes(audioResponse.status), `first MP3 did not respond (${audioResponse.status})`);
assert(String(audioResponse.headers.get('content-type') || '').includes('audio'), 'first segment is not served as audio');
const audioBytes = new Uint8Array(await audioResponse.arrayBuffer());
assert(audioBytes.length > 0, 'first MP3 response was empty');

const [libraryJs, episodeJs, episodeCss] = await Promise.all([
  fetch(`${origin}/library.js`).then((response) => response.text()),
  fetch(`${origin}/episode.js`).then((response) => response.text()),
  fetch(`${origin}/episode.css`).then((response) => response.text()),
]);
assert(libraryJs.includes('navigator.share') && libraryJs.includes('navigator.clipboard'), 'private player share sheet or copy fallback is missing');
assert(episodeJs.includes('navigator.share') && episodeJs.includes('renderTranscript'), 'public player sharing or transcript rendering is missing');
assert(episodeCss.includes('@media (max-width: 520px)') && page.text.includes('viewport-fit=cover'), 'iPhone-sized responsive support is missing');

console.log('Live episode sharing smoke passed: POST, clean canonical URL, public page, one-episode API, transcript, MP3, native-share path, fallback, and mobile CSS.');
