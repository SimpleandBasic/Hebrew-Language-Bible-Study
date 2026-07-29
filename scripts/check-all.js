import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const existingReaderFiles = [
  "index.html", "styles.css", "unified-app.css", "bible-reader-v2.css",
  "script.js", "data-loader.js", "bible-reader-v2.js", "unified-app.js", "supabase-config.js"
];
const audioLibraryFiles = [
  "library.html", "library.css", "library.js", "visual-study.js", "artwork-fix.js", "audio-player-fix.js", "audio-admin.html", "audio-admin.js",
  "assets/genesis-cover.svg", "api/hebrew-audio.js", "api/hebrew-mcp.js", "AUDIO_LIBRARY.md", "vercel.json",
  "src/actions/audio-tools.js", "src/index.js", "src/tool-schemas.js",
  "supabase/migrations/20260717_hebrew_audio_library.sql",
  "supabase/migrations/20260717_hebrew_audio_library_browser_grants.sql",
  "supabase/migrations/20260717_hebrew_audio_library_service_role_grants.sql"
];
const visualStudyFiles = [
  "scripts/check-visual-study.mjs", "tests/visual-study-logic.test.mjs",
  "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql",
  "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2_hardening.sql"
];
const v4Files = [
  "src/v4/release-manager.js", "api/run-generation-job.js", "tests/hebrew-v4-release.test.mjs",
  "supabase/migrations/20260729010000_add_hebrew_sermon_experience_v4.sql"
];
const requiredFiles = [...existingReaderFiles, ...audioLibraryFiles, ...visualStudyFiles, ...v4Files];

for (const file of requiredFiles) if (!existsSync(file)) throw new Error(`Missing required app file: ${file}`);

const indexHtml = readFileSync("index.html", "utf8");
for (const file of existingReaderFiles.filter((file) => file !== "index.html")) {
  if (!["styles.css", "unified-app.css", "script.js", "unified-app.js"].includes(file) && !indexHtml.includes(file)) throw new Error(`index.html does not reference ${file}`);
}

const libraryHtml = readFileSync("library.html", "utf8");
for (const file of ["library.css", "library.js", "visual-study.js", "artwork-fix.js", "audio-player-fix.js", "supabase-config.js", "assets/genesis-cover.svg"]) {
  if (!libraryHtml.includes(file)) throw new Error(`library.html does not reference ${file}`);
}
const adminHtml = readFileSync("audio-admin.html", "utf8");
for (const file of ["library.css", "audio-admin.js"]) if (!adminHtml.includes(file)) throw new Error(`audio-admin.html does not reference ${file}`);

for (const file of [
  ...existingReaderFiles.filter((file) => file.endsWith(".js")),
  "library.js", "visual-study.js", "artwork-fix.js", "audio-player-fix.js", "audio-admin.js", "api/hebrew-audio.js", "api/hebrew-mcp.js",
  "api/run-generation-job.js", "src/v4/release-manager.js", "src/actions/audio-tools.js", "src/index.js", "src/tool-schemas.js",
  "scripts/generate-hebrew-audio.mjs", "scripts/check-visual-study.mjs", "tests/visual-study-logic.test.mjs", "tests/hebrew-v4-release.test.mjs"
]) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });

execFileSync(process.execPath, ["tests/audio-logic.test.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/check-visual-study.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["--test", "tests/visual-study-logic.test.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["--test", "tests/hebrew-v4-release.test.mjs"], { stdio: "inherit" });

const requiredAudioTools = ["prepare_hebrew_audio_track", "generate_next_hebrew_audio_segment", "get_hebrew_audio_status"];
const toolSchemas = readFileSync("src/tool-schemas.js", "utf8");
const toolRegistry = readFileSync("src/index.js", "utf8");
const mcpHandler = readFileSync("api/hebrew-mcp.js", "utf8");
for (const tool of requiredAudioTools) {
  if (!toolSchemas.includes(tool)) throw new Error(`Tool schema is missing ${tool}`);
  if (!toolRegistry.includes(tool)) throw new Error(`Tool registry is missing ${tool}`);
}
for (const tableSuffix of ["_audio_tracks", "_audio_segments"]) if (!mcpHandler.includes(tableSuffix)) throw new Error(`MCP status is missing ${tableSuffix}`);

const migration = readFileSync("supabase/migrations/20260717_hebrew_audio_library.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) if (!migration.includes(table)) throw new Error(`Migration is missing ${table}`);
const grantsMigration = readFileSync("supabase/migrations/20260717_hebrew_audio_library_browser_grants.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) if (!grantsMigration.includes(table)) throw new Error(`Browser grants migration is missing ${table}`);
const serviceGrantsMigration = readFileSync("supabase/migrations/20260717_hebrew_audio_library_service_role_grants.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) if (!serviceGrantsMigration.includes(table)) throw new Error(`Service-role grants migration is missing ${table}`);

const visualMigration = readFileSync("supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql", "utf8");
for (const table of ["hebrew_lesson_manifests", "hebrew_visual_feeds", "hebrew_visual_cards", "hebrew_visual_assets", "hebrew_visual_sources", "hebrew_visual_jobs"]) if (!visualMigration.includes(table)) throw new Error(`Visual migration is missing ${table}`);

const v4Migration = readFileSync("supabase/migrations/20260729010000_add_hebrew_sermon_experience_v4.sql", "utf8");
for (const table of ["hebrew_episodes", "hebrew_episode_revisions", "hebrew_research_dossiers", "hebrew_sermon_drafts", "hebrew_sermon_evaluations", "hebrew_pipeline_runs", "hebrew_stage_runs", "hebrew_release_verifications", "hebrew_episode_publications"]) {
  if (!v4Migration.includes(`public.${table}`)) throw new Error(`V4 migration is missing ${table}`);
}
for (const marker of ["create_hebrew_episode_revision", "publish_hebrew_episode_revision", "ready_for_release", "release_integrity"]) if (!v4Migration.includes(marker)) throw new Error(`V4 migration is missing ${marker}`);
const releaseManager = readFileSync("src/v4/release-manager.js", "utf8");
for (const marker of ["spokenLanguageChecks", "normalizeEvaluation", "verifyRevision", "publishRevision", "audio_integrity", "visual_integrity", "album_art_integrity"]) if (!releaseManager.includes(marker)) throw new Error(`V4 release manager is missing ${marker}`);
const missionControl = readFileSync("api/run-generation-job.js", "utf8");
for (const marker of ["verify_revision", "publish_revision", "verifyRevision", "publishRevision"]) if (!missionControl.includes(marker)) throw new Error(`Mission Control is missing V4 action ${marker}`);

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const rootRedirect = vercelConfig.redirects?.find((rule) => rule.source === "/");
if (rootRedirect?.destination !== "/library.html") throw new Error("Vercel root must open the Scripture Library at /library.html");
if (vercelConfig.cleanUrls === true) throw new Error("cleanUrls must stay disabled so /index.html remains the Hebrew reader");
if (!indexHtml.includes("Hebrew Bible Speaking Trainer")) throw new Error("Existing Hebrew reader must remain at index.html");

for (const forbidden of [/sk-[A-Za-z0-9_-]{20,}/, /sb_secret_[A-Za-z0-9_-]{20,}/]) {
  for (const file of [
    "library.js", "visual-study.js", "artwork-fix.js", "audio-player-fix.js", "audio-admin.js", "api/hebrew-audio.js", "api/hebrew-mcp.js",
    "api/run-generation-job.js", "src/v4/release-manager.js", "src/actions/audio-tools.js", "library.html", "audio-admin.html", "AUDIO_LIBRARY.md",
    "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql", "supabase/migrations/20260722_hebrew_visual_study_pipeline_v2_hardening.sql",
    "supabase/migrations/20260729010000_add_hebrew_sermon_experience_v4.sql"
  ]) if (forbidden.test(readFileSync(file, "utf8"))) throw new Error(`Possible secret found in ${file}`);
}

console.log("Hebrew reader, audio, visual study, V4 atomic release, routing, artwork, and security checks passed.");
