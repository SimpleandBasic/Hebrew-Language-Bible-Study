import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvaluation, spokenLanguageChecks } from '../src/v4/release-manager.js';

function transcript(extra = '') {
  const sentence = 'You walk into the kitchen expecting coffee, but the empty pot has apparently chosen a wilderness season. Genesis invites us to slow down, notice what our Father is doing, and discover that the smallest Hebrew detail can open a window into the whole story of Scripture. ';
  return `${sentence.repeat(75)}${extra}`;
}

test('spoken checker rejects announced sermon sections', () => {
  const report = spokenLanguageChecks(`${transcript()} Now let us discuss our first point.`);
  assert.equal(report.passed, false);
  assert.ok(report.forbiddenMatches.length > 0);
});

test('spoken checker accepts a natural transcript in the production range', () => {
  const report = spokenLanguageChecks(transcript());
  assert.ok(report.wordCount >= 950 && report.wordCount <= 1350);
  assert.equal(report.forbiddenMatches.length, 0);
  assert.equal(report.duplicateParagraphCount, 0);
  assert.equal(report.passed, true);
});

test('evaluation requires every sermon dimension to remain strong', () => {
  const passing = normalizeEvaluation({ scores: {
    conversational_flow: 9, storytelling: 9, curiosity: 9, hebrew_integration: 9,
    biblical_faithfulness: 9.5, christ_centeredness: 9, emotional_movement: 9,
    educational_value: 9, spoken_naturalness: 9.2, listener_engagement: 9,
  }});
  assert.equal(passing.passed, true);
  assert.ok(passing.weightedScore >= 8.6);

  const lectureLike = normalizeEvaluation({ scores: {
    conversational_flow: 8.8, storytelling: 8.8, curiosity: 8.8, hebrew_integration: 8.8,
    biblical_faithfulness: 9.5, christ_centeredness: 9, emotional_movement: 8.8,
    educational_value: 9, spoken_naturalness: 7.9, listener_engagement: 8.8,
  }});
  assert.equal(lectureLike.passed, false);
});
