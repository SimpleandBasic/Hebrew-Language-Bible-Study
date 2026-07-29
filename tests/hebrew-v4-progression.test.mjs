import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReference, parseReference } from '../api/generate-next-verse.js';

test('Genesis chapter boundaries roll forward to verse one of the next chapter', () => {
  assert.deepEqual(nextReference(1, 31), {
    book: 'Genesis',
    chapter: 2,
    verse: 1,
    reference: 'Genesis 2:1',
  });
  assert.deepEqual(nextReference(2, 25), {
    book: 'Genesis',
    chapter: 3,
    verse: 1,
    reference: 'Genesis 3:1',
  });
});

test('Genesis references validate chapter-specific verse limits', () => {
  assert.equal(parseReference('Genesis 2:1')?.reference, 'Genesis 2:1');
  assert.equal(parseReference('Genesis 2:26'), null);
  assert.equal(parseReference('Exodus 1:1'), null);
});
