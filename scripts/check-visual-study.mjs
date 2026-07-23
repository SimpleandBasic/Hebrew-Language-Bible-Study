import { existsSync, readFileSync } from "node:fs";

const required = [
  "library.html",
  "library.css",
  "library.js",
  "tests/visual-study-logic.test.mjs",
  "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql",
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`Missing visual-study file: ${file}`);
}

const html = readFileSync("library.html", "utf8");
const css = readFileSync("library.css", "utf8");
const js = readFileSync("library.js", "utf8");
const sql = readFileSync("supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql", "utf8");

for (const id of [
  "exploreVerseButton", "exploreScreen", "visualFeedList", "visualFeedEmpty", "exploreMiniPlayer",
  "explorePreviousSegment", "explorePlayPause", "exploreNextSegment", "audioElement",
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing Explore UI marker: ${id}`);
}

for (const preserved of ["artwork-fix.js", "audio-player-fix.js", "playsinline", "webkit-playsinline"]) {
  if (!html.includes(preserved)) throw new Error(`Production audio/artwork safeguard was removed: ${preserved}`);
}

for (const marker of [
  "fetchRowsOptional", "renderVisualFeed", "openExplore", "feedForTrack", "assetUrl",
  "Audio remains active", "audio keeps playing", "Open deeper details",
]) {
  if (!js.includes(marker)) throw new Error(`Missing visual-study JS behavior: ${marker}`);
}

for (const table of [
  "hebrew_lesson_manifests", "hebrew_visual_feeds", "hebrew_visual_cards",
  "hebrew_visual_assets", "hebrew_visual_sources", "hebrew_visual_jobs",
]) {
  if (!sql.includes(`public.${table}`)) throw new Error(`Missing SQL table: ${table}`);
}

for (const exactLabel of [
  "Directly stated in Scripture", "Established historical background", "Archaeological finding",
  "Probable reconstruction", "Scholars disagree", "Artistic illustration",
]) {
  if (!js.includes(exactLabel)) throw new Error(`Missing approved evidence label: ${exactLabel}`);
}
if (sql.includes("'scripture_connection','historical_background'")) {
  throw new Error("scripture_connection must remain a card type, not an evidence label.");
}
if (!sql.includes("revoke all on public.hebrew_visual_cards from anon, authenticated")) {
  throw new Error("Browser write revocation is missing.");
}
if (!css.includes(".visual-feed") || !css.includes(".explore-mini-player") || !css.includes(".visual-card-details")) {
  throw new Error("Visual feed CSS is incomplete.");
}

console.log("Hebrew Visual Study Pipeline v2 checks passed.");
