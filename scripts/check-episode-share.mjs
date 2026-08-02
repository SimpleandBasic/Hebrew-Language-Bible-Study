import { readFile } from 'node:fs/promises';

const checks = [
  ['library.html', ['shareEpisodeButton', 'shareEpisodeStatus']],
  ['library.js', ['shareCurrentEpisode', '/api/hebrew-episode-share', 'navigator.share', 'navigator.clipboard']],
  ['library.css', ['.share-episode-button', '.share-episode-status']],
  ['episode.js', ['tokenFromLocation', 'sharedTranscript', 'navigator.share']],
  ['episode.css', ['.shared-shell', '.privacy-note', '.transcript-segment']],
  ['api/hebrew-mcp.js', ['episode_share', 'episode_page', 'handleEpisodeShare', 'handleEpisodePage', 'Content-Security-Policy']],
  ['src/hebrewEpisodeShare.js', ['hebrew_episode_shares', "eq('is_published', true)", 'shareUrlFor']],
  ['src/hebrewEpisodePage.js', ['This page contains only the episode', 'og:title', 'sharedSpeed']],
  ['supabase/migrations/20260802_hebrew_episode_sharing.sql', ['enable row level security', 'revoke all', 'service_role']],
  ['vercel.json', ['/listen/:token/:slug', '/api/hebrew-mcp?episode_page=1&share=:token', '/api/hebrew-mcp?episode_share=1']],
];

for (const [file, required] of checks) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const token of required) {
    if (!text.includes(token)) throw new Error(`${file} is missing required token: ${token}`);
  }
}

console.log(`Episode sharing check passed (${checks.length} files).`);
