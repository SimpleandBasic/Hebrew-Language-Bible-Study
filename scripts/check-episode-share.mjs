import { readFile } from "node:fs/promises";

const checks = [
  ["library.html", ["shareEpisodeButton", "shareEpisodeStatus"]],
  ["library.js", ["shareCurrentEpisode", "/api/hebrew-episode-share", "navigator.share"]],
  ["library.css", [".share-episode-button", ".share-episode-status"]],
  ["episode.js", ["tokenFromLocation", "sharedTranscript", "navigator.share"]],
  ["episode.css", [".shared-shell", ".privacy-note", ".transcript-segment"]],
  ["api/hebrew-episode-share.js", ["getOrCreateEpisodeShare", "getSharedEpisode"]],
  ["api/hebrew-episode-page.js", ["Content-Security-Policy", "This page contains only the episode"]],
  ["api/_lib/hebrewEpisodeShare.js", ["hebrew_episode_shares", "is_published", "shareUrlFor"]],
  ["supabase/migrations/20260802_hebrew_episode_sharing.sql", ["enable row level security", "revoke all", "service_role"]],
  ["vercel.json", ["/listen/:token/:slug", "/api/hebrew-episode-page?share=:token"]],
];

for (const [file, required] of checks) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  for (const token of required) {
    if (!text.includes(token)) throw new Error(`${file} is missing required token: ${token}`);
  }
}

console.log(`Episode sharing check passed (${checks.length} files).`);
