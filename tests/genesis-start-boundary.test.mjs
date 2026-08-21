import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const generator = readFileSync('src/v4/episode-generator.js', 'utf8');
const orchestrator = readFileSync('api/run-generation-job.js', 'utf8');

test('Genesis 1:1 does not require a nonexistent previous verse', () => {
  assert.match(generator, /function validateLesson\(reference, lesson\)/);
  assert.match(generator, /isGenesisOpening/);
  assert.match(generator, /hasRequiredPrevious = isGenesisOpening/);
  assert.match(generator, /validateLesson\(reference, lesson\)/);
});

test('generation job events identify church-audience V4.2', () => {
  assert.match(orchestrator, /sermon-experience-v4\.2\.0/);
});
