import fs from 'node:fs';
import path from 'node:path';

const libraryPath = path.resolve(process.cwd(), 'library.html');
let html = fs.readFileSync(libraryPath, 'utf8');

const manualBuilderPattern = /\n\s*<section class="manual-generate-card"[\s\S]*?<\/section>\n/;
if (manualBuilderPattern.test(html)) {
  html = html.replace(manualBuilderPattern, '\n');
  fs.writeFileSync(libraryPath, html);
  console.log('Removed public manual lesson builder from the listener build.');
} else {
  console.log('Public manual lesson builder already absent.');
}
