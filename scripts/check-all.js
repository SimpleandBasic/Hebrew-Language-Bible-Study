import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const existingReaderFiles = [
  "index.html", "styles.css", "unified-app.css", "bible-reader-v2.css",
  "script.js", "data-loader.js", "bible-reader-v2.js", "unified-app.js", "supabase-config.js"
];
const audioLibraryFiles = [
  "library.html", "library.css", "library.js", "artwork-fix.js", "audio-admin.html", "audio-admin.js",
  "assets/genesis-cover.svg", "api/hebrew-audio.js", "api/hebrew-mcp.js", "AUDIO_LIBRARY.md", "vercel.json",
  "src/actions/audio-tools.js", "src/index.js", "src/tool-schemas.js",
  "supabase/migrations/20260717_hebrew_audio_library.sql",
  "supabase/migrations/20260717_hebrew_audio_library_browser_grants.sql",
  "supabase/migrations/20260717_hebrew_audio_library_service_role_grants.sql"
];
const requiredFiles = [...existingReaderFiles, ...audioLibraryFiles];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing required app file: ${file}`);
}

const indexHtml = readFileSync("index.html", "utf8");
for (const file of existingReaderFiles.filter((file) => file !== "index.html")) {
  if (!["styles.css", "unified-app.css", "script.js", "unified-app.js"].includes(file) && !indexHtml.includes(file)) {
    throw new Error(`index.html does not reference ${file}`);
  }
}

const libraryHtml = readFileSync("library.html", "utf8");
for (const file of ["library.css", "library.js", "artwork-fix.js", "supabase-config.js", "assets/genesis-cover.svg"]) {
  if (!libraryHtml.includes(file)) throw new Error(`library.html does not reference ${file}`);
}
const adminHtml = readFileSync("audio-admin.html", "utf8");
for (const file of ["library.css", "audio-admin.js"]) {
  if (!adminHtml.includes(file)) throw new Error(`audio-admin.html does not reference ${file}`);
}

for (const file of [
  ...existingReaderFiles.filter((file) => file.endsWith(".js")),
  "library.js", "artwork-fix.js", "audio-admin.js", "api/hebrew-audio.js", "api/hebrew-mcp.js",
  "src/actions/audio-tools.js", "src/index.js", "src/tool-schemas.js",
  "scripts/generate-hebrew-audio.mjs"
]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
execFileSync(process.execPath, ["tests/audio-logic.test.mjs"], { stdio: "inherit" });

const requiredAudioTools = [
  "prepare_hebrew_audio_track",
  "generate_next_hebrew_audio_segment",
  "get_hebrew_audio_status"
];
const toolSchemas = readFileSync("src/tool-schemas.js", "utf8");
const toolRegistry = readFileSync("src/index.js", "utf8");
const mcpHandler = readFileSync("api/hebrew-mcp.js", "utf8");
for (const tool of requiredAudioTools) {
  if (!toolSchemas.includes(tool)) throw new Error(`Tool schema is missing ${tool}`);
  if (!toolRegistry.includes(tool)) throw new Error(`Tool registry is missing ${tool}`);
}
for (const tableSuffix of ["_audio_tracks", "_audio_segments"]) {
  if (!mcpHandler.includes(tableSuffix)) throw new Error(`MCP status is missing ${tableSuffix}`);
}

const migration = readFileSync("supabase/migrations/20260717_hebrew_audio_library.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) {
  if (!migration.includes(table)) throw new Error(`Migration is missing ${table}`);
}
const grantsMigration = readFileSync("supabase/migrations/20260717_hebrew_audio_library_browser_grants.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) {
  if (!grantsMigration.includes(table)) throw new Error(`Browser grants migration is missing ${table}`);
}
const serviceGrantsMigration = readFileSync("supabase/migrations/20260717_hebrew_audio_library_service_role_grants.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) {
  if (!serviceGrantsMigration.includes(table)) throw new Error(`Service-role grants migration is missing ${table}`);
}

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const rootRedirect = vercelConfig.redirects?.find((rule) => rule.source === "/");
if (rootRedirect?.destination !== "/library.html") throw new Error("Vercel root must open the Scripture Library at /library.html");
if (vercelConfig.cleanUrls === true) throw new Error("cleanUrls must stay disabled so /index.html remains the Hebrew reader");
if (!indexHtml.includes("Hebrew Bible Speaking Trainer")) throw new Error("Existing Hebrew reader must remain at index.html");

for (const forbidden of [/sk-[A-Za-z0-9_-]{20,}/, /sb_secret_[A-Za-z0-9_-]{20,}/]) {
  for (const file of [
    "library.js", "artwork-fix.js", "audio-admin.js", "api/hebrew-audio.js", "api/hebrew-mcp.js",
    "src/actions/audio-tools.js", "library.html", "audio-admin.html", "AUDIO_LIBRARY.md"
  ]) {
    if (forbidden.test(readFileSync(file, "utf8"))) throw new Error(`Possible secret found in ${file}`);
  }
}

console.log("Hebrew reader, audio-library, MCP audio pipeline, routing, artwork, and security checks passed.");
