import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TRANSCRIPT_WORDS,
  MIN_TRANSCRIPT_WORDS,
  TARGET_TRANSCRIPT_WORDS,
  transcriptWordCount,
} from '../src/v4/episode-generator.js';
import { spokenLanguageChecks } from '../src/v4/release-manager.js';

test('V4 generator word range matches the atomic release spoken gate', () => {
  assert.ok(MIN_TRANSCRIPT_WORDS >= 950);
  assert.ok(MAX_TRANSCRIPT_WORDS <= 1350);
  assert.match(TARGET_TRANSCRIPT_WORDS, /1,180/);
});

test('V4 transcript counter handles whitespace without inflating the count', () => {
  assert.equal(transcriptWordCount('  one   two\nthree  '), 3);
});

test('a 1,120-word natural transcript is accepted by the release checker', () => {
  const sentence = 'God speaks with purpose and Hebrew words help ordinary listeners notice the beauty of Scripture today. ';
  const transcript = sentence.repeat(70);
  assert.equal(transcriptWordCount(transcript), 1120);
  const report = spokenLanguageChecks(transcript);
  assert.equal(report.passed, true);
  assert.equal(report.wordCount, 1120);
});
