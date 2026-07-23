import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../library.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../library.js", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql", import.meta.url), "utf8");

test("visual tables fail gracefully without breaking audio", () => {
  assert.match(js, /async function fetchRowsOptional/);
  assert.match(js, /Optional visual table .* Audio remains active/);
  assert.match(js, /return \[\];/);
});

test("Explore is available for every ready audio lesson and has a clean missing-feed fallback", () => {
  assert.match(js, /elements\.exploreButton\.hidden = false/);
  assert.match(js, /renderVisualFeed\(feed\)/);
  assert.match(html, /id="visualFeedEmpty"/);
  assert.match(js, /visual study is being prepared/);
});

test("Explore screen and deeper card details reuse the same audio element", () => {
  assert.equal((html.match(/id="audioElement"/g) || []).length, 1);
  assert.match(js, /elements\.explorePlayPause\.addEventListener\("click", toggleAudio\)/);
  assert.match(js, /elements\.explorePreviousSegment\.addEventListener/);
  assert.match(js, /elements\.exploreNextSegment\.addEventListener/);
  assert.match(js, /Open deeper details/);
});

test("production iPhone playback helpers remain loaded", () => {
  assert.match(html, /audio-player-fix\.js/);
  assert.match(html, /preload="auto" playsinline webkit-playsinline/);
  assert.match(html, /artwork-fix\.js/);
});

test("Genesis 1:14 pilot contains five cards in deterministic order", () => {
  const cardTypes = ["hero", "hebrew_word", "timeline", "scripture_connection", "context"];
  for (const [index, cardType] of cardTypes.entries()) {
    assert.match(sql, new RegExp(`\\n\\s*${index + 1},\\n\\s*'${cardType}'::text`));
  }
  assert.match(sql, /card_count[\s\S]*5/);
});

test("evidence protection uses only the six approved labels", () => {
  for (const value of [
    "scripture_direct", "historical_background", "archaeological_finding",
    "probable_reconstruction", "scholarly_debate", "artistic_illustration",
  ]) assert.match(sql, new RegExp(`'${value}'`));
  assert.doesNotMatch(sql, /evidence_level[\s\S]{0,300}'scripture_connection'/);
  assert.match(js, /Established historical background/);
});

test("RLS gives browsers published reads but no writes", () => {
  assert.match(sql, /for select to anon, authenticated/);
  assert.match(sql, /is_published and status = 'published'/);
  assert.match(sql, /revoke all on public\.hebrew_visual_cards from anon, authenticated/);
  assert.match(sql, /Jobs are intentionally never publicly readable/);
});

test("asset reuse, versioning, checksums, retries, and requirement levels are represented", () => {
  for (const marker of ["reuse_tags", "asset_version", "content_hash", "checksum", "input_hash", "output_hash", "attempt_count", "max_attempts", "requirement_level"]) {
    assert.match(sql, new RegExp(marker));
  }
});
