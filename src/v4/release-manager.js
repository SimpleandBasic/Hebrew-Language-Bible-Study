import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../supabase-client.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const arrayValue = (value) => (Array.isArray(value) ? value : []);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

export function spokenLanguageChecks(transcript) {
  const value = text(transcript);
  const forbiddenPatterns = [
    /\bnow let(?:'s| us) (?:discuss|examine|look at)\b/i,
    /\bour (?:first|second|third|next|final) point\b/i,
    /\bnext we(?:'ll| will) (?:discuss|examine|look at)\b/i,
    /\bin conclusion\b/i,
    /\bthe first thing (?:we|you) need to understand\b/i,
  ];
  const paragraphs = value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const normalizedParagraphs = paragraphs.map((item) => item.toLowerCase().replace(/\s+/g, ' '));
  const duplicateParagraphs = normalizedParagraphs.filter((item, index) => normalizedParagraphs.indexOf(item) !== index);
  const sentences = value.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const sentenceLengths = sentences.map((item) => item.split(/\s+/).length);
  const averageSentenceWords = sentenceLengths.length ? sentenceLengths.reduce((sum, item) => sum + item, 0) / sentenceLengths.length : 0;
  const longSentenceCount = sentenceLengths.filter((item) => item > 36).length;
  const questionCount = (value.match(/\?/g) || []).length;
  const wordCount = value ? value.split(/\s+/).length : 0;
  const forbiddenMatches = forbiddenPatterns.flatMap((pattern) => value.match(pattern)?.[0] || []);

  return {
    passed: Boolean(value)
      && wordCount >= 950
      && wordCount <= 1350
      && forbiddenMatches.length === 0
      && duplicateParagraphs.length === 0
      && averageSentenceWords <= 24
      && longSentenceCount <= Math.max(2, Math.floor(sentences.length * 0.05)),
    wordCount,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    averageSentenceWords: Number(averageSentenceWords.toFixed(2)),
    longSentenceCount,
    questionCount,
    forbiddenMatches,
    duplicateParagraphCount: duplicateParagraphs.length,
  };
}

function scoreNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(10, value));
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(10, parsed));
    }
  }
  return null;
}

function evaluationVerdictPassed(raw = {}) {
  if (raw.verdict === true || raw.passed === true) return true;
  if (raw.verdict && typeof raw.verdict === 'object' && raw.verdict.passed === true) return true;
  const verdict = text(
    typeof raw.verdict === 'string'
      ? raw.verdict
      : raw.verdict?.status || raw.verdict?.decision || raw.status || raw.decision,
  ).toLowerCase();
  return /\b(pass|passed|publish|publishable|approved|ready)\b/.test(verdict);
}

function hardGatesDoNotFail(raw = {}) {
  const gates = raw.hard_gate_results || raw.hardGateResults;
  if (!gates || typeof gates !== 'object') return true;
  return Object.values(gates).every((value) => {
    if (value === false) return false;
    if (typeof value === 'string' && /\b(fail|failed|false|no)\b/i.test(value)) return false;
    if (value && typeof value === 'object' && value.passed === false) return false;
    return true;
  });
}

export function normalizeEvaluation(raw = {}) {
  const source = raw.scores && typeof raw.scores === 'object' ? raw.scores : raw;
  const dimensions = [
    'conversational_flow', 'storytelling', 'curiosity', 'hebrew_integration',
    'biblical_faithfulness', 'christ_centeredness', 'emotional_movement',
    'educational_value', 'spoken_naturalness', 'listener_engagement',
  ];
  const aliases = {
    conversational_flow: ['conversational_flow', 'conversationalFlow'],
    storytelling: ['storytelling', 'story_telling'],
    curiosity: ['curiosity', 'curiosity_and_discovery'],
    hebrew_integration: ['hebrew_integration', 'hebrewIntegration'],
    biblical_faithfulness: ['biblical_faithfulness', 'biblicalFaithfulness', 'biblical_fidelity'],
    christ_centeredness: ['christ_centeredness', 'christCenteredness', 'christ_centered', 'christCentered'],
    emotional_movement: ['emotional_movement', 'emotionalMovement'],
    educational_value: ['educational_value', 'educationalValue'],
    spoken_naturalness: ['spoken_naturalness', 'spokenNaturalness'],
    listener_engagement: ['listener_engagement', 'listenerEngagement'],
  };

  const resolvedScores = Object.fromEntries(dimensions.map((key) => {
    const value = aliases[key].map((alias) => scoreNumber(source[alias])).find((item) => item !== null);
    return [key, value ?? null];
  }));
  const missingDimensions = dimensions.filter((key) => resolvedScores[key] === null);

  if (missingDimensions.length === 1 && evaluationVerdictPassed(raw) && hardGatesDoNotFail(raw)) {
    resolvedScores[missingDimensions[0]] = 8;
  }

  const scores = Object.fromEntries(dimensions.map((key) => [key, resolvedScores[key] ?? 0]));
  const weightedScore = dimensions.reduce((sum, key) => sum + scores[key], 0) / dimensions.length;
  const passed = scores.biblical_faithfulness >= 9
    && scores.hebrew_integration >= 8
    && scores.spoken_naturalness >= 9
    && scores.listener_engagement >= 8.5
    && dimensions.every((key) => scores[key] >= 8)
    && weightedScore >= 8.6;
  return {
    scores,
    weightedScore: Number(weightedScore.toFixed(2)),
    passed,
    hardGateResults: raw.hard_gate_results || raw.hardGateResults || {},
    evidenceSpans: arrayValue(raw.evidence_spans || raw.evidenceSpans),
    strengths: arrayValue(raw.strengths),
    rewriteDirectives: arrayValue(raw.rewrite_directives || raw.rewriteDirectives || raw.required_changes),
    missingDimensions: dimensions.filter((key) => resolvedScores[key] === null),
    verdictPassed: evaluationVerdictPassed(raw),
  };
}

async function upsertVerification(client, revisionId, checkName, category, passed, details, required = true) {
  const { error } = await client.from('hebrew_release_verifications').upsert({
    revision_id: revisionId,
    check_name: checkName,
    category,
    passed,
    required,
    details,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'revision_id,check_name' });
  if (error) throw error;
}

export async function verifyRevision(revisionId, options = {}) {
  const client = options.client || getSupabaseAdminClient(options.env || process.env);
  const { data: revision, error: revisionError } = await client
    .from('hebrew_episode_revisions')
    .select('*')
    .eq('id', revisionId)
    .single();
  if (revisionError) throw revisionError;

  const checks = [];
  async function check(name, category, passed, details = {}, required = true) {
    const item = { name, category, passed: Boolean(passed), required, details };
    checks.push(item);
    await upsertVerification(client, revisionId, name, category, item.passed, details, required);
  }

  const { data: draft } = revision.approved_sermon_draft_id
    ? await client.from('hebrew_sermon_drafts').select('*').eq('id', revision.approved_sermon_draft_id).maybeSingle()
    : { data: null };
  const { data: evaluations } = draft
    ? await client.from('hebrew_sermon_evaluations').select('*').eq('sermon_draft_id', draft.id).order('created_at', { ascending: false }).limit(1)
    : { data: [] };
  const evaluation = evaluations?.[0] || null;
  const spoken = spokenLanguageChecks(draft?.transcript || '');

  await check('approved_sermon', 'sermon', Boolean(draft && draft.status === 'approved'), { draft_id: draft?.id || null });
  await check('sermon_quality', 'sermon', Boolean(evaluation?.passed), { evaluation_id: evaluation?.id || null, weighted_score: evaluation?.weighted_score || 0 });
  await check('spoken_naturalness', 'sermon', spoken.passed, spoken);

  const { data: segments } = revision.audio_track_id
    ? await client.from('hebrew_audio_segments').select('id,status,audio_path,duration_seconds,checksum').eq('track_id', revision.audio_track_id)
    : { data: [] };
  const audioRows = arrayValue(segments);
  const audioReady = audioRows.length > 0 && audioRows.every((row) => row.status === 'ready' && text(row.audio_path) && Number(row.duration_seconds) > 0 && text(row.checksum));
  await check('audio_integrity', 'audio', audioReady, { expected: audioRows.length, ready: audioRows.filter((row) => row.status === 'ready').length });

  const { data: cards } = revision.visual_feed_id
    ? await client.from('hebrew_visual_cards').select('id,status,primary_asset_id,is_required').eq('feed_id', revision.visual_feed_id)
    : { data: [] };
  const cardRows = arrayValue(cards);
  const requiredCards = cardRows.filter((row) => row.is_required);
  const visualsReady = cardRows.length > 0 && cardRows.every((row) => row.status === 'ready') && requiredCards.length > 0;
  await check('visual_integrity', 'visual', visualsReady, { cards: cardRows.length, required_cards: requiredCards.length });

  const { data: art } = revision.album_art_asset_id
    ? await client.from('hebrew_visual_assets').select('id,status,storage_path,source_url,checksum,alt_text,width,height,mime_type').eq('id', revision.album_art_asset_id).maybeSingle()
    : { data: null };
  const artReady = Boolean(art && art.status === 'ready' && (text(art.storage_path) || text(art.source_url)) && text(art.checksum) && text(art.alt_text));
  await check('album_art_integrity', 'artwork', artReady, { asset_id: art?.id || null, width: art?.width || null, height: art?.height || null, mime_type: art?.mime_type || null });

  const relationshipReady = Boolean(revision.lesson_id && revision.audio_track_id && revision.visual_feed_id && revision.album_art_asset_id && revision.approved_sermon_draft_id);
  await check('database_relationships', 'database', relationshipReady, {
    lesson_id: revision.lesson_id,
    audio_track_id: revision.audio_track_id,
    visual_feed_id: revision.visual_feed_id,
    album_art_asset_id: revision.album_art_asset_id,
  });

  const requiredPassed = checks.filter((item) => item.required).every((item) => item.passed);
  const releaseDetails = { requiredPassed, checkCount: checks.length, checksum: sha256(JSON.stringify(checks)) };
  await check('release_integrity', 'release', requiredPassed, releaseDetails);

  const nextPatch = requiredPassed
    ? { status: 'ready_for_release', release_state: 'ready', verified_at: new Date().toISOString(), quality_score: Number(evaluation?.weighted_score) || null, failure_reason: null }
    : { status: 'verifying', release_state: 'private', failure_reason: checks.filter((item) => item.required && !item.passed).map((item) => item.name).join(', ') };
  const { error: updateError } = await client.from('hebrew_episode_revisions').update(nextPatch).eq('id', revisionId);
  if (updateError) throw updateError;

  return { ok: true, revisionId, readyForRelease: requiredPassed, checks };
}

export async function publishRevision(revisionId, options = {}) {
  const client = options.client || getSupabaseAdminClient(options.env || process.env);
  const verification = await verifyRevision(revisionId, { client });
  if (!verification.readyForRelease) {
    const failed = verification.checks.filter((item) => item.required && !item.passed).map((item) => item.name);
    throw new Error(`Revision is not releasable: ${failed.join(', ')}`);
  }
  const { data, error } = await client.rpc('publish_hebrew_episode_revision', {
    p_revision_id: revisionId,
    p_published_by: options.publishedBy || 'release_manager',
    p_reason: options.reason || 'All V4 release gates passed.',
  });
  if (error) throw error;
  return data;
}
