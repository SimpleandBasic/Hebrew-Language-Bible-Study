import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const existingReaderFiles = [
  "index.html", "styles.css", "unified-app.css", "bible-reader-v2.css",
  "script.js", "data-loader.js", "bible-reader-v2.js", "unified-app.js", "supabase-config.js"
];
const audioLibraryFiles = [
  "library.html", "library.css", "library.js", "audio-admin.html", "audio-admin.js",
  "assets/genesis-cover.webp", "api/hebrew-audio.js", "AUDIO_LIBRARY.md", "vercel.json",
  "supabase/migrations/20260717_hebrew_audio_library.sql",
  "supabase/migrations/20260717_hebrew_audio_library_browser_grants.sql"
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
for (const file of ["library.css", "library.js", "supabase-config.js", "assets/genesis-cover.webp"]) {
  if (!libraryHtml.includes(file)) throw new Error(`library.html does not reference ${file}`);
}
const adminHtml = readFileSync("audio-admin.html", "utf8");
for (const file of ["library.css", "audio-admin.js"]) {
  if (!adminHtml.includes(file)) throw new Error(`audio-admin.html does not reference ${file}`);
}

for (const file of [...existingReaderFiles.filter((file) => file.endsWith(".js")), "library.js", "audio-admin.js", "api/hebrew-audio.js", "scripts/generate-hebrew-audio.mjs"]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
execFileSync(process.execPath, ["tests/audio-logic.test.mjs"], { stdio: "inherit" });

const migration = readFileSync("supabase/migrations/20260717_hebrew_audio_library.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) {
  if (!migration.includes(table)) throw new Error(`Migration is missing ${table}`);
}
const grantsMigration = readFileSync("supabase/migrations/20260717_hebrew_audio_library_browser_grants.sql", "utf8");
for (const table of ["hebrew_book_albums", "hebrew_audio_tracks", "hebrew_audio_segments"]) {
  if (!grantsMigration.includes(table)) throw new Error(`Browser grants migration is missing ${table}`);
}
for (const forbidden of [/sk-[A-Za-z0-9_-]{20,}/, /sb_secret_[A-Za-z0-9_-]{20,}/]) {
  for (const file of ["library.js", "audio-admin.js", "api/hebrew-audio.js", "library.html", "audio-admin.html", "AUDIO_LIBRARY.md"]) {
    if (forbidden.test(readFileSync(file, "utf8"))) throw new Error(`Possible secret found in ${file}`);
  }
}

console.log("Hebrew reader and audio-library checks passed.");
