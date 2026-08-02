import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/hebrewEpisodeShare.js';
let source = await readFile(path, 'utf8');
const oldLine = "  const slug = slugify(`${track.verse_reference}-${track.track_title}`);";
const replacement = `  const reference = String(track.verse_reference || '').trim();
  const title = String(track.track_title || '').trim();
  const slugSource = title.toLowerCase().startsWith(reference.toLowerCase())
    ? title
    : \`${'${reference}'}-${'${title}'}\`;
  const slug = slugify(slugSource);`;

if (source.includes(oldLine)) {
  source = source.replace(oldLine, replacement);
  await writeFile(path, source);
  console.log('Normalized episode share slug without repeating the Scripture reference.');
} else if (source.includes('const slugSource = title.toLowerCase().startsWith(reference.toLowerCase())')) {
  console.log('Episode share slug normalization already applied.');
} else {
  throw new Error('Episode share slug anchor was not found.');
}
