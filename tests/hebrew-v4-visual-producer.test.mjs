import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisualPlan, VISUAL_PIPELINE_VERSION } from '../src/v4/visual-producer.js';

const lesson = {
  title: 'Seeds of Provision',
  sermon_title: 'From Seed to Table',
  description: 'God provides food and hope.',
  central_truth: 'God is the generous Creator who provides everything needed for life.',
  simple_summary: 'Genesis 1:29 reveals the Father as Provider.',
  memory_phrase: 'From the first garden to your kitchen table, God provides.',
  practical_reflection: 'Pause before your next meal and thank God.',
  did_you_know_see_jesus_here: {
    see_jesus_here: 'Jesus is the Bread of Life.',
    guardrail: 'This is a canonical theological connection, not a direct quotation of Genesis 1:29.',
    references: ['John 6:35'],
  },
};

const dossier = {
  literary_context: {
    narrative_map: {
      controlling_truth: lesson.central_truth,
      controlling_image: 'A table in a garden.',
      concrete_action: lesson.practical_reflection,
    },
  },
  hebrew_observations: [{
    word: 'זֶרַע',
    transliteration: 'zera',
    pronunciation_help: 'zeh-RAH',
    meaning_here: 'seed',
    grammar: 'noun',
    root: 'ז-ר-ע',
    strongs_number: 'H2233',
    recurring_biblical_scenes: 'Seeds, descendants, and promise.',
  }],
  cross_references: [{
    reference: 'Psalm 104:14–15',
    connection: 'God provides plants for food.',
    guardrail: 'The Psalm is a poetic echo, not a quotation of Genesis.',
    connection_type: 'theological echo',
  }],
};

test('V4 visual plan creates a complete six-card experience', () => {
  const plan = buildVisualPlan({ reference: 'Genesis 1:29', lesson, dossier });
  assert.equal(plan.cards.length, 6);
  assert.ok(plan.cards.filter((card) => card.is_required).length >= 4);
  assert.deepEqual(plan.cards.map((card) => card.sort_order), [1, 2, 3, 4, 5, 6]);
  assert.equal(plan.cards[0].card_type, 'hero');
  assert.equal(plan.cards[1].structured_data.layout, 'hebrew_word');
  assert.equal(plan.cards[4].structured_data.to, 'John 6:35');
});

test('V4 visual plan remains useful when optional research fields are sparse', () => {
  const plan = buildVisualPlan({ reference: 'Genesis 1:30', lesson: { title: 'Provision for Every Creature', central_truth: 'God cares for creation.' }, dossier: {} });
  assert.equal(plan.cards.length, 6);
  assert.ok(plan.cards.every((card) => card.title && card.summary));
  assert.ok(plan.cards.every((card) => typeof card.structured_data === 'object'));
});

test('visual producer has a versioned release contract', () => {
  assert.match(VISUAL_PIPELINE_VERSION, /^structured-visual-release-v4\./);
});
