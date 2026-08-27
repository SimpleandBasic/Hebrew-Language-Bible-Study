import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GREEK_PIPELINE_VERSION,
  PHILIPPIANS_VERSE_COUNTS,
  nextPhilippiansReference,
  parsePhilippiansReference,
  transcriptNeedsRepair,
  transcriptWordCount,
} from '../src/greek/philippians-sermon-engine.js';

test('parses valid Philippians references', () => {
  assert.deepEqual(parsePhilippiansReference('Philippians 1:1'), {
    book: 'Philippians',
    bookKey: 'philippians',
    chapter: 1,
    verse: 1,
    reference: 'Philippians 1:1',
  });
  assert.deepEqual(parsePhilippiansReference('philippians 4:23')?.reference, 'Philippians 4:23');
});

test('rejects invalid Philippians references', () => {
  assert.equal(parsePhilippiansReference('Philippians 1:31'), null);
  assert.equal(parsePhilippiansReference('Philippians 5:1'), null);
  assert.equal(parsePhilippiansReference('Genesis 1:1'), null);
});

test('advances verse-by-verse and chapter-by-chapter', () => {
  assert.equal(nextPhilippiansReference(1, 1).reference, 'Philippians 1:2');
  assert.equal(nextPhilippiansReference(1, 30).reference, 'Philippians 2:1');
  assert.equal(nextPhilippiansReference(2, 30).reference, 'Philippians 3:1');
  assert.equal(nextPhilippiansReference(3, 21).reference, 'Philippians 4:1');
  assert.throws(() => nextPhilippiansReference(4, 23), /complete/i);
});

test('verse counts match the four Philippians chapters', () => {
  assert.deepEqual(PHILIPPIANS_VERSE_COUNTS, [0, 30, 30, 21, 23]);
});

test('transcript gate enforces the sermon-engine range', () => {
  const short = Array.from({ length: 1000 }, () => 'word').join(' ');
  const good = Array.from({ length: 1200 }, () => 'word').join(' ');
  assert.equal(transcriptWordCount(good), 1200);
  assert.equal(transcriptNeedsRepair(short), true);
  assert.equal(transcriptNeedsRepair(good), false);
  assert.equal(GREEK_PIPELINE_VERSION, 'greek-sermon-experience-v1');
});
