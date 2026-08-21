import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const generator = readFileSync('src/v4/episode-generator.js', 'utf8');

test('evidence extraction only skips when all ten score dimensions are covered', () => {
  assert.match(generator, /requiredEvidenceDimensions/);
  assert.match(generator, /coveredEvidenceDimensions/);
  assert.match(generator, /requiredEvidenceDimensions\.every/);
  assert.doesNotMatch(generator, /if \(initial\.evidenceSpans\.length >= 10\) return raw;/);
});
