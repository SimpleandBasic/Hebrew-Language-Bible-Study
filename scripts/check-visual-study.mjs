import { existsSync, readFileSync } from "node:fs";

const required = [
  "library.html",
  "library.css",
  "library.js",
  "visual-study.js",
  "audio-player-fix.js",
  "artwork-fix.js",
  "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql",
  "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2_hardening.sql",
  "tests/visual-study-logic.test.mjs",
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`Missing visual-study file: ${file}`);
}

const html = readFileSync("library.html", "utf8");
const css = readFileSync("library.css", "utf8");
const js = readFileSync("visual-study.js", "utf8");
const sql = readFileSync("supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql", "utf8");

for (const id of [
  "exploreVerseButton", "exploreScreen", "visualFeedList", "visualFeedLoading",
  "visualFeedEmpty", "visualFeedError", "explorePreviousSegment", "explorePlayPause",
  "exploreNextSegment", "visualCardDialog", "audioElement"
]) {
  if (!html.includes(id)) throw new Error(`Missing Explore UI marker: ${id}`);
}

for (const file of ["artwork-fix.js", "audio-player-fix.js", "library.js", "visual-study.js"]) {
  if (!html.includes(file)) throw new Error(`library.html must preserve ${file}`);
}

for (const marker of [
  "loadVisualData", "renderFeed", "feedForCurrentVerse", "openDetails",
  "el.exploreButton.hidden = false", "Audio remains active", "assetUrl"
]) {
  if (!js.includes(marker)) throw new Error(`Missing visual-study JS behavior: ${marker}`);
}

for (const table of [
  "hebrew_lesson_manifests", "hebrew_visual_feeds", "hebrew_visual_cards",
  "hebrew_visual_assets", "hebrew_visual_sources", "hebrew_visual_jobs"
]) {
  if (!sql.includes(`public.${table}`)) throw new Error(`Missing SQL table: ${table}`);
}

for (const label of [
  "Directly stated in Scripture", "Established historical background", "Archaeological finding",
  "Probable reconstruction", "Scholars disagree", "Artistic illustration"
]) {
  if (!js.includes(label)) throw new Error(`Missing approved evidence label: ${label}`);
}

if (!sql.includes("revoke all on table public.hebrew_visual_jobs from public, anon, authenticated")) {
  throw new Error("Browser write protection is incomplete.");
}
if (!css.includes(".visual-feed") || !css.includes(".explore-mini-player") || !css.includes(".visual-card-dialog")) {
  throw new Error("Visual feed CSS is incomplete.");
}
if (/cron\.schedule|morning automation|4:30 AM/i.test(sql)) {
  throw new Error("This first slice must not modify the morning automation.");
}

console.log("Hebrew Visual Study Pipeline v2 checks passed.");
