export const EXPERIENCE_FORMAT_VERSION = 'holy-curiosity-entertaining-sermon-v3';
export const MIN_STYLE_SCORE = 8;
export const MIN_STYLE_AVERAGE = 8.5;
export const MAX_STYLE_REWRITES = 2;

export const STYLE_SCORE_KEYS = [
  'opening_hook', 'storytelling', 'entertainment', 'wonder', 'natural_humor',
  'clarity', 'emotional_movement', 'hebrew_integration', 'spoken_flow',
  'jesus_connection', 'memorable_ending',
];

function words(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

export function spokenReadabilityReport(transcript) {
  const text = String(transcript || '');
  const allWords = words(text);
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const averageSentenceWords = sentences.length ? allWords.length / sentences.length : allWords.length;
  const longSentenceCount = sentences.filter((sentence) => words(sentence).length > 32).length;
  const lectureTransitions = (text.match(/\b(now let(?:'s| us)|next we will|in conclusion|the first point|the second point|moving on)\b/gi) || []).length;
  const jargonHits = (text.match(/\b(ontology|epistemology|hermeneutic(?:s|al)?|soteriology|eschatology|teleological|metaphysical)\b/gi) || []).length;
  return {
    word_count: allWords.length,
    sentence_count: sentences.length,
    average_sentence_words: Number(averageSentenceWords.toFixed(1)),
    long_sentence_count: longSentenceCount,
    lecture_transition_count: lectureTransitions,
    unexplained_jargon_hits: jargonHits,
    passed: averageSentenceWords <= 24 && longSentenceCount <= 8 && lectureTransitions <= 3 && jargonHits === 0,
  };
}

export function normalizeStyleEvaluation(raw) {
  const source = raw?.scores && typeof raw.scores === 'object' ? raw.scores : raw || {};
  const scores = {};
  for (const key of STYLE_SCORE_KEYS) {
    const value = Number(source?.[key]);
    scores[key] = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
  }
  const values = Object.values(scores);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const failedCategories = STYLE_SCORE_KEYS.filter((key) => scores[key] < MIN_STYLE_SCORE);
  return {
    scores,
    average: Number(average.toFixed(2)),
    failed_categories: failedCategories,
    strengths: Array.isArray(raw?.strengths) ? raw.strengths.slice(0, 5) : [],
    required_changes: Array.isArray(raw?.required_changes) ? raw.required_changes.slice(0, 8) : [],
    verdict: String(raw?.verdict || '').trim(),
    passed: average >= MIN_STYLE_AVERAGE && failedCategories.length === 0,
  };
}

export function assertExperienceQuality(evaluation, readability) {
  if (!readability?.passed) throw new Error(`Spoken readability failed: ${JSON.stringify(readability)}`);
  if (!evaluation?.passed) throw new Error(`Sermon experience failed: average ${evaluation?.average || 0}; weak categories: ${(evaluation?.failed_categories || []).join(', ')}.`);
}
