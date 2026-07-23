import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../library.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../library.css", import.meta.url), "utf8");
const audioJs = readFileSync(new URL("../library.js", import.meta.url), "utf8");
const js = readFileSync(new URL("../visual-study.js", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql", import.meta.url), "utf8");

const approvedEvidenceLabels = [
  "Directly stated in Scripture",
  "Established historical background",
  "Archaeological finding",
  "Probable reconstruction",
  "Scholars disagree",
  "Artistic illustration",
];

test("visual tables fail gracefully without breaking audio", () => {
  assert.match(js, /async function loadVisualData/);
  assert.match(js, /Audio remains active/);
  assert.match(js, /state\.loadError = true/);
  assert.match(html, /id="visualFeedError"/);
});

test("Explore is present for every opened audio lesson", () => {
  assert.match(js, /el\.exploreButton\.hidden = false/);
  assert.match(js, /Visual study is being prepared · audio keeps playing/);
});

test("Explore and card details reuse the one existing audio element", () => {
  assert.equal((html.match(/<audio id="audioElement"/g) || []).length, 1);
  assert.match(js, /el\.miniPlay\.addEventListener\("click", \(\) => el\.playPause\.click\(\)\)/);
  assert.match(js, /function openDetails/);
  assert.match(html, /id="visualCardDialog"/);
});

test("mini player has full section transport", () => {
  for (const id of ["explorePreviousSegment", "explorePlayPause", "exploreNextSegment"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(js, /el\.miniPrevious\.addEventListener/);
  assert.match(js, /el\.miniNext\.addEventListener/);
});

test("exact approved evidence labels are rendered", () => {
  for (const label of approvedEvidenceLabels) assert.match(js, new RegExp(label));
  assert.doesNotMatch(js, /"Scripture connection"/);
  assert.doesNotMatch(js, /"Historical background"/);
});

test("pilot contains five ordered gold-standard cards", () => {
  const markers = [
    "'hero'::text",
    "'hebrew_word'::text",
    "'timeline'::text",
    "'scripture_connection'::text",
    "'context'::text",
  ];
  let prior = -1;
  for (const marker of markers) {
    const index = sql.indexOf(marker);
    assert.ok(index > prior, `${marker} must appear in pilot order`);
    prior = index;
  }
  assert.match(sql, /'published',\s*5,/);
});

test("structured templates cover reusable visual categories", () => {
  for (const layout of ["hebrew_word", "timeline", "connection", "comparison", "map", "family_tree", "diagram"]) {
    assert.match(js, new RegExp(`"${layout}"`));
  }
});

test("published content is browser-readable but browser writes are revoked", () => {
  assert.match(sql, /for select to anon, authenticated/);
  assert.match(sql, /revoke all on table public\.hebrew_visual_cards from public, anon, authenticated/);
  assert.match(sql, /revoke all on table public\.hebrew_visual_jobs from public, anon, authenticated/);
  assert.match(sql, /Jobs are intentionally never publicly readable/);
});

test("approved reusable hero artwork resolves through a safe local asset", () => {
  assert.match(sql, /assets\/genesis-cover\.svg\?v=20260718-1/);
  assert.match(js, /assets\\\//);
  assert.match(html, /artwork-fix\.js/);
});

test("production audio logic remains separate and iPhone resilience stays loaded", () => {
  assert.match(audioJs, /elements\.audio\.addEventListener\("ended"/);
  assert.match(html, /audio-player-fix\.js\?v=20260721-3/);
  assert.match(html, /preload="auto" playsinline webkit-playsinline/);
});

test("visual screen has clean loading empty and error states", () => {
  for (const id of ["visualFeedLoading", "visualFeedEmpty", "visualFeedError"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /visual-loading-art/);
});

test("the first slice does not change the morning automation", () => {
  assert.doesNotMatch(sql, /cron\.schedule|4:30 AM|5:00 AM/i);
});
