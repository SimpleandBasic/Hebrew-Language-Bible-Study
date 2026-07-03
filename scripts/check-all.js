import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "styles.css",
  "unified-app.css",
  "bible-reader-v2.css",
  "script.js",
  "data-loader.js",
  "bible-reader-v2.js",
  "unified-app.js",
  "supabase-config.js"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required app file: ${file}`);
  }
}

const indexHtml = readFileSync("index.html", "utf8");
for (const file of requiredFiles.filter((file) => file !== "index.html")) {
  if (!["styles.css", "unified-app.css", "script.js", "unified-app.js"].includes(file) && !indexHtml.includes(file)) {
    throw new Error(`index.html does not reference ${file}`);
  }
}

for (const file of requiredFiles.filter((file) => file.endsWith(".js"))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log("Hebrew app static checks passed.");
