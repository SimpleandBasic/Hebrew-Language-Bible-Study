import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const generator = readFileSync('src/v4/episode-generator.js', 'utf8');
const nextVerse = readFileSync('api/generate-next-verse.js', 'utf8');

test('sermon engine is versioned for a church-wide audience', () => {
  assert.match(generator, /sermon-experience-v4\.2\.0/);
  assert.match(generator, /church-audience-sermon-v4\.2\.0/);
  assert.match(generator, /mixed church room, not to one known person/);
  assert.match(generator, /first-time visitor/);
  assert.match(generator, /Never assume private knowledge of the listener/);
});

test('sermon style no longer requires Ace-shaped humor or personal callbacks', () => {
  assert.doesNotMatch(generator, /Michael-Scott-like/);
  assert.match(generator, /Humor is optional/);
  assert.match(generator, /no private-listener assumptions/);
  assert.match(generator, /do not know the listener personally/);
});

test('explicit sermon rebuilds can target older Genesis references without changing normal progression', () => {
  assert.match(nextVerse, /mode === 'sermon_rebuild'/);
  assert.match(nextVerse, /A valid Genesis reference is required for sermon_rebuild mode/);
  assert.match(nextVerse, /req\.body\?\.mode === 'sermon_rebuild'/);
});
