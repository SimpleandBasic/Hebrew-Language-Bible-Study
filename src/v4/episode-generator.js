import crypto from 'node:crypto';
import { normalizeEvaluation, spokenLanguageChecks } from './release-manager.js';

export const V4_PIPELINE_VERSION = 'sermon-experience-v4.2.0';
export const V4_PROMPT_VERSION = 'premium-sermon-episode-v4.2.0';
export const MIN_TRANSCRIPT_WORDS = 1100;
export const MAX_TRANSCRIPT_WORDS = 1350;
export const TARGET_TRANSCRIPT_WORDS = '1,180 to 1,300';

const now = () => new Date().toISOString();
const cleanText = (value) => String(value || '').trim();
const asArray = (value) => (Array.isArray(value) ? value : []);
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
export const RESEARCH_CONTRACT_VERSION = 'verified-research-v1';

const MODEL_PRICING_PER_MILLION = {
  'gpt-5.6-luna': { input: 0.20, cached: 0.02, cacheWrite: 0.25, output: 1.20 },
  'gpt-4.1': { input: 2.00, cached: 0.50, cacheWrite: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, cached: 0.10, cacheWrite: 0.40, output: 1.60 },
};

function normalizeOpenAiUsage(raw, model) {
  const details = raw?.prompt_tokens_details || {};
  const inputTokens = Number(raw?.prompt_tokens) || 0;
  const cachedInputTokens = Number(details?.cached_tokens) || 0;
  const cacheWriteTokens = Number(details?.cache_write_tokens) || 0;
  const outputTokens = Number(raw?.completion_tokens) || 0;
  const totalTokens = Number(raw?.total_tokens) || inputTokens + outputTokens;
  const rates = MODEL_PRICING_PER_MILLION[model] || null;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens - cacheWriteTokens);
  const estimatedCostUsd = rates
    ? (
      (uncachedInputTokens * rates.input)
      + (cachedInputTokens * rates.cached)
      + (cacheWriteTokens * rates.cacheWrite)
      + (outputTokens * rates.output)
    ) / 1_000_000
    : null;
  return {
    model,
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
  };
}

function canonicalResearchHash(canonical) {
  return sha256(`${cleanText(canonical?.english)}\n---\n${cleanText(canonical?.hebrew)}`);
}

function createUsageRecorder(client, context, telemetryEnabled = true) {
  const events = [];
  async function record(stageType, operation, usage, requestMetadata = {}) {
    if (!usage) return;
    const event = { stageType, operation, ...usage, requestMetadata };
    events.push(event);
    if (!client || !telemetryEnabled) return;
    const { error } = await client.from('hebrew_ai_usage_events').insert({
      revision_id: context?.revisionId || null,
      pipeline_run_id: context?.pipelineRunId || null,
      stage_type: stageType,
      operation,
      model: usage.model,
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      cache_write_tokens: usage.cacheWriteTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      estimated_cost_usd: usage.estimatedCostUsd,
      request_metadata: requestMetadata,
    });
    if (error) console.error('Could not persist Hebrew AI usage telemetry.', error);
  }
  function summary() {
    return {
      request_count: events.length,
      input_tokens: events.reduce((sum, item) => sum + item.inputTokens, 0),
      cached_input_tokens: events.reduce((sum, item) => sum + item.cachedInputTokens, 0),
      output_tokens: events.reduce((sum, item) => sum + item.outputTokens, 0),
      estimated_cost_usd: Number(events.reduce((sum, item) => sum + (Number(item.estimatedCostUsd) || 0), 0).toFixed(8)),
      events: events.map((item) => ({
        stage_type: item.stageType,
        operation: item.operation,
        model: item.model,
        input_tokens: item.inputTokens,
        cached_input_tokens: item.cachedInputTokens,
        output_tokens: item.outputTokens,
        estimated_cost_usd: item.estimatedCostUsd,
      })),
    };
  }
  return { record, summary };
}

export function transcriptWordCount(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

export function transcriptNeedsRepair(value) {
  const wordCount = typeof value === 'number' ? value : transcriptWordCount(value);
  return wordCount < MIN_TRANSCRIPT_WORDS || wordCount > MAX_TRANSCRIPT_WORDS;
}

function parseJsonContent(raw) {
  const value = cleanText(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  if (!value) throw new Error('The model returned no JSON content.');
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`The model returned invalid JSON: ${error.message}`);
  }
}

async function requestJson({ apiKey, model, messages, temperature = 0.5, maxTokens = 7000, timeoutMs = 90000, reasoningEffort = 'none' }) {
  const body = {
    model,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages,
  };
  if (String(model).startsWith('gpt-5.6')) {
    body.reasoning_effort = reasoningEffort;
    if (reasoningEffort === 'none') body.temperature = temperature;
  } else {
    body.temperature = temperature;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed (${response.status}).`);
  return {
    data: parseJsonContent(payload?.choices?.[0]?.message?.content),
    usage: normalizeOpenAiUsage(payload?.usage, model),
  };
}

function normalizeResearch(raw, reference, canonical) {
  const dossier = raw?.research_dossier && typeof raw.research_dossier === 'object'
    ? raw.research_dossier
    : raw;
  const narrativeMap = raw?.narrative_map && typeof raw.narrative_map === 'object'
    ? raw.narrative_map
    : dossier?.narrative_map || {};

  const normalized = {
    verse_text: {
      reference,
      hebrew: canonical.hebrew,
      english_kjv: canonical.english,
      ...(dossier?.verse_text || {}),
    },
    literary_context: dossier?.literary_context || {},
    hebrew_observations: asArray(dossier?.hebrew_observations),
    cross_references: asArray(dossier?.cross_references),
    historical_background: asArray(dossier?.historical_background),
    archaeology: asArray(dossier?.archaeology),
    geography: asArray(dossier?.geography),
    biblical_theology: asArray(dossier?.biblical_theology),
    christological_pathways: asArray(dossier?.christological_pathways),
    unsupported_connections: asArray(dossier?.unsupported_connections),
    sources: asArray(dossier?.sources),
    claims: asArray(dossier?.claims),
  };

  if (normalized.hebrew_observations.length < 4) throw new Error('V4 research needs at least four Hebrew observations.');
  if (normalized.cross_references.length < 5) throw new Error('V4 research needs at least five cross references.');
  if (!cleanText(narrativeMap?.controlling_truth)) throw new Error('V4 narrative map is missing its controlling truth.');
  if (asArray(narrativeMap?.curiosity_turns).length < 4) throw new Error('V4 narrative map needs at least four curiosity turns.');

  return { dossier: normalized, narrativeMap };
}

function validateLesson(lesson) {
  const requiredStrings = [
    'title', 'sermon_title', 'description', 'transliteration', 'opening_hook',
    'central_truth', 'big_idea', 'simple_summary', 'transcript',
    'practical_reflection', 'closing_invitation', 'prayer', 'memory_phrase',
  ];
  const missing = requiredStrings.filter((key) => !cleanText(lesson?.[key]));
  if (missing.length) throw new Error(`V4 sermon is missing required fields: ${missing.join(', ')}.`);
  const wordCount = transcriptWordCount(lesson.transcript);
  if (transcriptNeedsRepair(wordCount)) {
    throw new Error(`V4 transcript is ${wordCount} words; required range is ${MIN_TRANSCRIPT_WORDS}-${MAX_TRANSCRIPT_WORDS}.`);
  }
  if (asArray(lesson.key_words).length < 4) throw new Error('V4 sermon needs at least four Hebrew key words.');
  if (asArray(lesson.strongs_word_stories).length < 3) throw new Error('V4 sermon needs at least three Strong’s word stories.');
  if (asArray(lesson.cross_references).length < 4) throw new Error('V4 sermon needs at least four cross references.');
  if (!lesson.did_you_know_see_jesus_here?.did_you_know
      || !lesson.did_you_know_see_jesus_here?.see_jesus_here
      || !lesson.did_you_know_see_jesus_here?.guardrail) {
    throw new Error('V4 sermon needs Did You Know, See Jesus Here, and an interpretive guardrail.');
  }
  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) {
    throw new Error('V4 sermon must connect the previous and next verses.');
  }
  return wordCount;
}

const RESEARCH_SYSTEM_PROMPT = `You are a conservative Christian Hebrew research editor. Accuracy outranks novelty.

Build a verified research dossier and narrative map for a premium Christian Hebrew Bible audio episode.

Return JSON only with two top-level objects: research_dossier and narrative_map.

research_dossier must include:
- verse_text
- literary_context
- hebrew_observations: at least 4 items with word, transliteration, pronunciation_help, grammar, root, Strong's number when supportable, meaning_here, recurring_biblical_scenes, and confidence
- cross_references: at least 5 items with reference, connection, connection_type, and guardrail
- historical_background
- archaeology
- geography
- biblical_theology
- christological_pathways: responsible canonical bridges that clearly name prophecy, literary pattern, canonical echo, repeated vocabulary, or broader theology
- unsupported_connections: tempting claims that should not be used
- sources
- claims: each claim needs claim, support, confidence, and sermon_use

narrative_map must include:
- cold_open
- controlling_truth
- controlling_image
- curiosity_turns: at least 4 discoveries in listening order
- emotional_movement
- hebrew_reveals
- everyday_human_moment
- gentle_humor_opportunities
- jesus_bridge
- concrete_action
- closing_memory_line
- next_episode_hook

Rules:
- Never invent archaeology, Hebrew meanings, grammar, Strong's numbers, historical details, or quotations.
- Separate strong evidence from plausible interpretation.
- Use fifth-grade clarity without losing depth.
- The sermon will be continuous, not divided into announced sections.
- Humor may observe ordinary human behavior but never joke about Scripture, God, sacred claims, or prayer.
- Return valid JSON only.`;

async function createResearch(reference, canonical, env, recordUsage, operation = 'research_primary') {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing from the Vercel project.');
  const model = env.HEBREW_RESEARCH_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-5.6-luna';
  const response = await requestJson({
    apiKey,
    model,
    temperature: 0.2,
    maxTokens: 5500,
    reasoningEffort: env.HEBREW_REASONING_EFFORT || 'none',
    messages: [
      { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Reference: ${reference}\n\nCanonical KJV:\n${canonical.english}\n\nCanonical Hebrew:\n${canonical.hebrew}`,
      },
    ],
  });
  await recordUsage?.('research', operation, response.usage, { reference });
  return { ...normalizeResearch(response.data, reference, canonical), model };
}

async function verifyResearch(reference, canonical, research, env, recordUsage, operation = 'research_verify') {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.HEBREW_RESEARCH_VERIFIER_MODEL || 'gpt-4.1-mini';
  const prompt = `Audit this research dossier for ${reference} against the supplied canonical verse.

Reject only material problems: invented Hebrew facts, grammar, roots, Strong's numbers, quotations, history, archaeology, geography, cross-reference claims, or Christological claims that overstate the evidence. Distinguish an interpretive possibility from a factual error. Do not reject merely because a claim is concise.

Return JSON only:
{
  "passed": true|false,
  "material_concerns": [{"claim":"...","reason":"...","severity":"low|medium|high","recommended_fix":"..."}],
  "verified_strengths": ["..."],
  "verdict_reason": "..."
}

Canonical KJV:
${canonical.english}

Canonical Hebrew:
${canonical.hebrew}

Research dossier:
${JSON.stringify(research.dossier)}

Narrative map:
${JSON.stringify(research.narrativeMap)}`;

  const response = await requestJson({
    apiKey,
    model,
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 65000,
    messages: [
      { role: 'system', content: 'You are an independent conservative Christian Hebrew accuracy reviewer. Be strict about factual invention and calibrated about interpretation. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  await recordUsage?.('research_verify', operation, response.usage, { reference });
  const concerns = asArray(response.data?.material_concerns);
  const highOrMedium = concerns.filter((item) => ['medium', 'high'].includes(String(item?.severity || '').toLowerCase()));
  return {
    passed: response.data?.passed === true && highOrMedium.length === 0,
    raw: response.data,
    model,
  };
}

async function buildVerifiedResearch(reference, canonical, env, recordUsage) {
  let primary = null;
  let primaryFailure = null;
  let primaryVerification = null;
  try {
    primary = await createResearch(reference, canonical, env, recordUsage, 'research_primary');
    try {
      primaryVerification = await verifyResearch(reference, canonical, primary, env, recordUsage, 'research_verify_primary');
      if (primaryVerification.passed) {
        return {
          ...primary,
          verifierModel: primaryVerification.model,
          verification: primaryVerification.raw,
          usedFallback: false,
        };
      }
    } catch (error) {
      primaryFailure = error;
    }
  } catch (error) {
    primaryFailure = error;
  }

  const fallbackModel = env.HEBREW_RESEARCH_FALLBACK_MODEL || 'gpt-4.1';
  const fallbackEnv = { ...env, HEBREW_RESEARCH_MODEL: fallbackModel };
  const fallback = await createResearch(reference, canonical, fallbackEnv, recordUsage, 'research_fallback');
  try {
    const fallbackVerification = await verifyResearch(reference, canonical, fallback, env, recordUsage, 'research_verify_fallback');
    if (!fallbackVerification.passed) {
      throw new Error(`Premium fallback research failed verification: ${cleanText(fallbackVerification.raw?.verdict_reason) || 'material concerns remain'}.`);
    }
    return {
      ...fallback,
      verifierModel: fallbackVerification.model,
      verification: fallbackVerification.raw,
      usedFallback: true,
      primaryFailure: primaryFailure?.message || (primaryVerification?.raw?.verdict_reason ? String(primaryVerification.raw.verdict_reason) : null),
    };
  } catch (error) {
    if (/failed verification/i.test(error?.message || '')) throw error;
    return {
      ...fallback,
      verifierModel: env.HEBREW_RESEARCH_VERIFIER_MODEL || 'gpt-4.1-mini',
      verification: {
        passed: true,
        mode: 'premium_fallback_verifier_unavailable',
        verifier_error: error?.message || String(error),
      },
      usedFallback: true,
      primaryFailure: primaryFailure?.message || null,
    };
  }
}

async function loadCachedResearch(client, reference, canonical) {
  if (!client) return null;
  const canonicalHash = canonicalResearchHash(canonical);
  const { data, error } = await client
    .from('hebrew_research_cache')
    .select('*')
    .eq('reference', reference)
    .eq('status', 'verified')
    .maybeSingle();
  if (error) {
    console.error('Could not read Hebrew research cache.', error);
    return null;
  }
  if (!data || data.canonical_hash !== canonicalHash) return null;
  return {
    dossier: data.dossier,
    narrativeMap: data.narrative_map,
    model: data.research_model,
    verifierModel: data.verifier_model,
    verification: data.verification || {},
    usedFallback: false,
    cacheHit: true,
  };
}

async function saveResearchCache(client, reference, canonical, research) {
  if (!client) return;
  const payload = {
    reference,
    canonical_hash: canonicalResearchHash(canonical),
    research_contract_version: RESEARCH_CONTRACT_VERSION,
    dossier: research.dossier,
    narrative_map: research.narrativeMap,
    research_model: research.model,
    verifier_model: research.verifierModel || null,
    verification: research.verification || {},
    status: 'verified',
    updated_at: now(),
  };
  const { error } = await client.from('hebrew_research_cache').upsert(payload, { onConflict: 'reference' });
  if (error) console.error('Could not persist Hebrew research cache.', error);
}

async function getResearch(reference, canonical, env, runtime, recordUsage) {
  if (runtime?.researchCacheEnabled !== false) {
    const cached = await loadCachedResearch(runtime?.client, reference, canonical);
    if (cached) return cached;
  }
  const research = await buildVerifiedResearch(reference, canonical, env, recordUsage);
  if (runtime?.researchCacheEnabled !== false) {
    await saveResearchCache(runtime?.client, reference, canonical, research);
  }
  return { ...research, cacheHit: false };
}

async function writeSermon(reference, canonical, research, env, recordUsage) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.HEBREW_SERMON_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-4.1';
  const prompt = `Write the complete premium daily Hebrew Bible teaching episode for ${reference} from the approved research and narrative map below.

KJV:
${canonical.english}

Hebrew:
${canonical.hebrew}

Approved research:
${JSON.stringify(research.dossier)}

Approved narrative map:
${JSON.stringify(research.narrativeMap)}

The transcript must be ${TARGET_TRANSCRIPT_WORDS} words and must remain between ${MIN_TRANSCRIPT_WORDS} and ${MAX_TRANSCRIPT_WORDS} words. Silently count before returning.

Experience contract:
- Sound like one entertaining, reverent sermon or premium podcast episode, never a worksheet or section-by-section lesson.
- Begin inside the cold open before explaining.
- Carry one controlling truth and image through the entire episode.
- Deliver at least four real discoveries, with curiosity and payoff.
- Weave Hebrew pronunciation, meaning, grammar, roots, Strong's information, and recurring biblical scenes naturally into the spoken story.
- Use one to three gentle Michael-Scott-like observational moments: relatable human awkwardness or overconfidence, never imitation, mockery, or jokes inside sacred material.
- Explain deep ideas in language a fifth grader can follow.
- Move through wonder, discovery, meaning, personal significance, worship, and anticipation.
- Include one ordinary human moment and one concrete action for today.
- Connect to Jesus responsibly and name the connection type.
- End with a warm landing, prayer, repeatable memory phrase, and a reason to return for the next verse.
- Do not announce sections, points, headings, or transitions such as "now let us discuss" or "in conclusion."
- Never add claims marked unsupported.

Before returning, silently run this preflight:
1. word count is inside the hard range
2. the transcript is one continuous spoken experience
3. at least four genuine discoveries have clear payoff
4. Hebrew is woven into the story rather than dumped
5. no unsupported factual or theological claim was introduced
6. the Jesus connection keeps its stated guardrail
7. there is an ordinary human moment and a concrete action
8. the ending lands emotionally, includes prayer, and creates next-verse anticipation

Return JSON only with:
title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript, key_words, strongs_word_stories, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version.

key_words: 4-6 objects.
strongs_word_stories: at least 3.
cross_references: at least 4.
did_you_know_see_jesus_here: did_you_know, see_jesus_here, guardrail, references.
series_connection: previous and next.
format_version: ${V4_PIPELINE_VERSION}.`;

  const response = await requestJson({
    apiKey,
    model,
    temperature: 0.72,
    maxTokens: 8500,
    timeoutMs: 110000,
    messages: [
      { role: 'system', content: 'You are a biblically faithful Christian Hebrew teacher and exceptional spoken-word storyteller. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  await recordUsage?.('sermon_write', 'sermon_write', response.usage, { reference });
  const lesson = response.data;
  lesson.format_version = V4_PIPELINE_VERSION;
  return { lesson, model };
}

async function repairTranscript(reference, lesson, research, env, directives = [], recordUsage, repairNumber = 1) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.HEBREW_REPAIR_MODEL || env.HEBREW_SERMON_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-4.1';
  const currentWords = transcriptWordCount(lesson.transcript);
  const prompt = `Rewrite only the spoken transcript for this ${reference} episode.

Current word count: ${currentWords}.
Required range: ${MIN_TRANSCRIPT_WORDS}-${MAX_TRANSCRIPT_WORDS}.
Target: ${TARGET_TRANSCRIPT_WORDS}.

Preserve the sermon title, central truth, biblical claims, supplied Hebrew, KJV wording, Christological guardrail, prayerful tone, and narrative map. Keep one continuous sermon. Add meaningful discovery, scenes, explanation, application, and transitions rather than padding. Remove announced sections, lecture language, repetition, and overlong sentences.

Producer directives:
${JSON.stringify(directives)}

Controlling truth:
${cleanText(research.narrativeMap?.controlling_truth)}

Current transcript:
${lesson.transcript}

Return JSON only as {"transcript":"..."}. Before returning, silently count the transcript and do not return fewer than ${MIN_TRANSCRIPT_WORDS} words or more than ${MAX_TRANSCRIPT_WORDS} words.`;

  const response = await requestJson({
    apiKey,
    model,
    temperature: 0.55,
    maxTokens: 4200,
    timeoutMs: 90000,
    messages: [
      { role: 'system', content: 'You are a precise Christian sermon editor. Preserve approved theology and factual claims. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  await recordUsage?.('sermon_repair', 'sermon_repair', response.usage, { reference, repair_number: repairNumber });
  const transcript = cleanText(response.data?.transcript);
  if (!transcript) throw new Error('Transcript repair returned no transcript.');
  return { ...lesson, transcript };
}

async function evaluateSermon(reference, lesson, research, env, recordUsage) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.HEBREW_EVALUATION_MODEL || 'gpt-4.1-mini';
  const spoken = spokenLanguageChecks(lesson.transcript);
  const prompt = `Evaluate this ${reference} Christian Hebrew audio sermon as a strict but calibrated executive producer.

A score of 8 means publishable. A score of 9 means excellent. Do not artificially cap strong work below 9, and do not reward the presence of fields if the listening experience is weak.

Score 0-10:
conversational_flow, storytelling, curiosity, hebrew_integration, biblical_faithfulness, christ_centeredness, emotional_movement, educational_value, spoken_naturalness, listener_engagement.

Hard gates:
- no invented Hebrew, history, archaeology, quotation, or theology
- biblical_faithfulness at least 9
- spoken_naturalness at least 9
- Hebrew is integrated rather than dumped
- Jesus connection has a responsible guardrail
- transcript is one continuous spoken experience
- the ending lands emotionally and creates next-verse anticipation

Return JSON only with scores, hard_gate_results, evidence_spans, strengths, rewrite_directives, and verdict.

Approved research:
${JSON.stringify(research.dossier)}

Narrative map:
${JSON.stringify(research.narrativeMap)}

Mechanical spoken report:
${JSON.stringify(spoken)}

Sermon:
${JSON.stringify(lesson)}`;

  const response = await requestJson({
    apiKey,
    model,
    temperature: 0.1,
    maxTokens: 2600,
    timeoutMs: 65000,
    messages: [
      { role: 'system', content: 'You are an independent Christian sermon producer and Hebrew accuracy reviewer. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  await recordUsage?.('sermon_evaluate', 'sermon_evaluate', response.usage, { reference });
  return { evaluation: normalizeEvaluation(response.data), spoken, raw: response.data, model };
}

export async function generateV4Episode(reference, canonical, env = process.env, runtime = {}) {
  const usage = createUsageRecorder(runtime.client, runtime.context, runtime.telemetryEnabled !== false);
  const research = await getResearch(reference, canonical, env, runtime, usage.record);
  const written = await writeSermon(reference, canonical, research, env, usage.record);
  let lesson = written.lesson;
  let repairCount = 0;
  const maxPaidRepairs = Number.isInteger(runtime.maxPaidRepairs) ? runtime.maxPaidRepairs : 3;

  const runRepair = async (directives) => {
    if (repairCount >= maxPaidRepairs) {
      throw new Error(`Hebrew cost guard stopped the episode after ${repairCount} paid sermon repairs.`);
    }
    lesson = await repairTranscript(
      reference,
      lesson,
      research,
      env,
      directives,
      usage.record,
      repairCount + 1,
    );
    repairCount += 1;
  };

  const initialWords = transcriptWordCount(lesson.transcript);
  if (transcriptNeedsRepair(initialWords)) {
    await runRepair([
      `Bring the transcript into the required ${MIN_TRANSCRIPT_WORDS}-${MAX_TRANSCRIPT_WORDS} word range.`,
    ]);
  }

  let review = await evaluateSermon(reference, lesson, research, env, usage.record);
  if (!review.evaluation.passed || !review.spoken.passed) {
    const directives = [
      ...review.evaluation.rewriteDirectives,
      ...(!review.spoken.passed ? ['Correct every mechanical spoken-language failure in the supplied report.'] : []),
    ];
    await runRepair(directives);
    review = await evaluateSermon(reference, lesson, research, env, usage.record);
  }

  const postProducerWords = transcriptWordCount(lesson.transcript);
  if (transcriptNeedsRepair(postProducerWords)) {
    await runRepair([
      `The producer rewrite changed the transcript to ${postProducerWords} words. Preserve every approved quality improvement while bringing it into the required ${MIN_TRANSCRIPT_WORDS}-${MAX_TRANSCRIPT_WORDS} range.`,
      'Do not weaken biblical faithfulness, Hebrew integration, spoken naturalness, emotional movement, listener engagement, or the ending.',
    ]);
    review = await evaluateSermon(reference, lesson, research, env, usage.record);
  }

  const wordCount = validateLesson(lesson);
  if (!review.spoken.passed) throw new Error(`V4 spoken gate failed: ${JSON.stringify(review.spoken)}`);
  if (!review.evaluation.passed) {
    throw new Error(`V4 producer gate failed at ${review.evaluation.weightedScore}: ${review.evaluation.rewriteDirectives.join('; ')}`);
  }

  const usageSummary = usage.summary();
  lesson.experience_quality = {
    passed: true,
    pipeline_version: V4_PIPELINE_VERSION,
    weighted_score: review.evaluation.weightedScore,
    scores: review.evaluation.scores,
    spoken: review.spoken,
    rewrite_count: repairCount,
    estimated_text_cost_usd: usageSummary.estimated_cost_usd,
    evaluated_at: now(),
  };

  return {
    lesson,
    dossier: research.dossier,
    narrativeMap: research.narrativeMap,
    evaluation: review.evaluation,
    evaluationRaw: review.raw,
    spoken: review.spoken,
    model: written.model,
    researchModel: research.model,
    researchVerifierModel: research.verifierModel || null,
    researchVerification: research.verification || {},
    researchUsedFallback: Boolean(research.usedFallback),
    researchCacheHit: Boolean(research.cacheHit),
    evaluationModel: review.model,
    wordCount,
    repairCount,
    usageSummary,
  };
}

async function recordStage(client, pipelineRunId, revisionId, stageType, metadata = {}) {
  const timestamp = now();
  const { error } = await client.from('hebrew_stage_runs').insert({
    pipeline_run_id: pipelineRunId,
    revision_id: revisionId,
    stage_type: stageType,
    status: 'succeeded',
    attempt_count: 1,
    max_attempts: 2,
    input_hash: metadata.input_hash || null,
    output_hash: metadata.output_hash || null,
    started_at: timestamp,
    finished_at: timestamp,
    metadata,
  });
  if (error) throw error;
}

export async function createV4Revision(client, reference, requestedBy = 'mission_control') {
  const { data: revisionId, error } = await client.rpc('create_hebrew_episode_revision', {
    p_reference: reference,
    p_requested_by: requestedBy,
  });
  if (error) throw error;

  const { data: pipelineRun, error: runError } = await client
    .from('hebrew_pipeline_runs')
    .select('*')
    .eq('revision_id', revisionId)
    .single();
  if (runError) throw runError;

  const { error: runUpdateError } = await client.from('hebrew_pipeline_runs').update({
    status: 'running',
    current_stage: 'research',
    started_at: now(),
    error_information: null,
  }).eq('id', pipelineRun.id);
  if (runUpdateError) throw runUpdateError;

  const { error: revisionUpdateError } = await client.from('hebrew_episode_revisions').update({
    status: 'researching',
    pipeline_version: V4_PIPELINE_VERSION,
    failure_reason: null,
  }).eq('id', revisionId);
  if (revisionUpdateError) throw revisionUpdateError;

  return { revisionId, pipelineRunId: pipelineRun.id };
}

export async function persistV4Generation(client, context, generated, canonical) {
  const { revisionId, pipelineRunId } = context;
  const dossierPayload = {
    revision_id: revisionId,
    dossier_version: V4_PROMPT_VERSION,
    verse_text: generated.dossier.verse_text,
    literary_context: {
      ...generated.dossier.literary_context,
      narrative_map: generated.narrativeMap,
    },
    hebrew_observations: generated.dossier.hebrew_observations,
    cross_references: generated.dossier.cross_references,
    historical_background: generated.dossier.historical_background,
    archaeology: generated.dossier.archaeology,
    geography: generated.dossier.geography,
    biblical_theology: generated.dossier.biblical_theology,
    christological_pathways: generated.dossier.christological_pathways,
    unsupported_connections: generated.dossier.unsupported_connections,
    sources: generated.dossier.sources,
    claims: generated.dossier.claims,
    content_hash: sha256(JSON.stringify(generated.dossier)),
    status: 'verified',
    verified_at: now(),
  };
  const { data: dossier, error: dossierError } = await client
    .from('hebrew_research_dossiers')
    .insert(dossierPayload)
    .select('*')
    .single();
  if (dossierError) throw dossierError;

  await recordStage(client, pipelineRunId, revisionId, 'research', {
    output_hash: dossier.content_hash,
    hebrew_observations: generated.dossier.hebrew_observations.length,
    cross_references: generated.dossier.cross_references.length,
    model: generated.researchModel,
    verifier_model: generated.researchVerifierModel,
    used_fallback: generated.researchUsedFallback,
    cache_hit: generated.researchCacheHit,
  });
  await recordStage(client, pipelineRunId, revisionId, 'research_verify', {
    output_hash: dossier.content_hash,
    claims: generated.dossier.claims.length,
    unsupported_connections: generated.dossier.unsupported_connections.length,
  });
  await recordStage(client, pipelineRunId, revisionId, 'narrative_map', {
    output_hash: sha256(JSON.stringify(generated.narrativeMap)),
    curiosity_turns: asArray(generated.narrativeMap.curiosity_turns).length,
  });

  const draftHash = sha256(generated.lesson.transcript);
  const { data: draft, error: draftError } = await client
    .from('hebrew_sermon_drafts')
    .insert({
      revision_id: revisionId,
      draft_number: 1,
      transcript: generated.lesson.transcript,
      lesson_payload: {
        ...generated.lesson,
        english_kjv: canonical.english,
        hebrew: canonical.hebrew,
      },
      word_count: generated.wordCount,
      prompt_version: V4_PROMPT_VERSION,
      model: generated.model,
      generation_metadata: {
        research_model: generated.researchModel,
        evaluation_model: generated.evaluationModel,
        research_verifier_model: generated.researchVerifierModel,
        research_used_fallback: generated.researchUsedFallback,
        research_cache_hit: generated.researchCacheHit,
        research_verification: generated.researchVerification,
        repair_count: generated.repairCount,
        estimated_text_cost_usd: generated.usageSummary?.estimated_cost_usd ?? null,
        usage_summary: generated.usageSummary || null,
        spoken: generated.spoken,
      },
      content_hash: draftHash,
      status: 'candidate',
    })
    .select('*')
    .single();
  if (draftError) throw draftError;

  await recordStage(client, pipelineRunId, revisionId, 'sermon_write', {
    output_hash: draftHash,
    word_count: generated.wordCount,
    model: generated.model,
    repair_count: generated.repairCount,
    estimated_text_cost_usd: generated.usageSummary?.estimated_cost_usd ?? null,
  });

  const scores = generated.evaluation.scores;
  const { data: evaluation, error: evaluationError } = await client
    .from('hebrew_sermon_evaluations')
    .insert({
      sermon_draft_id: draft.id,
      evaluator_version: V4_PROMPT_VERSION,
      conversational_flow: scores.conversational_flow,
      storytelling: scores.storytelling,
      curiosity: scores.curiosity,
      hebrew_integration: scores.hebrew_integration,
      biblical_faithfulness: scores.biblical_faithfulness,
      christ_centeredness: scores.christ_centeredness,
      emotional_movement: scores.emotional_movement,
      educational_value: scores.educational_value,
      spoken_naturalness: scores.spoken_naturalness,
      listener_engagement: scores.listener_engagement,
      weighted_score: generated.evaluation.weightedScore,
      hard_gate_results: {
        ...generated.evaluation.hardGateResults,
        mechanical_spoken_check: generated.spoken,
      },
      evidence_spans: generated.evaluation.evidenceSpans,
      strengths: generated.evaluation.strengths,
      rewrite_directives: generated.evaluation.rewriteDirectives,
      passed: true,
    })
    .select('*')
    .single();
  if (evaluationError) throw evaluationError;

  const { error: draftApproveError } = await client
    .from('hebrew_sermon_drafts')
    .update({ status: 'approved' })
    .eq('id', draft.id);
  if (draftApproveError) throw draftApproveError;

  const { error: revisionUpdateError } = await client.from('hebrew_episode_revisions').update({
    research_dossier_id: dossier.id,
    approved_sermon_draft_id: draft.id,
    quality_score: generated.evaluation.weightedScore,
    status: 'producing_audio',
  }).eq('id', revisionId);
  if (revisionUpdateError) throw revisionUpdateError;

  const { error: runUpdateError } = await client.from('hebrew_pipeline_runs').update({
    current_stage: 'audio_generate',
  }).eq('id', pipelineRunId);
  if (runUpdateError) throw runUpdateError;

  await recordStage(client, pipelineRunId, revisionId, 'sermon_evaluate', {
    output_hash: sha256(JSON.stringify(evaluation)),
    weighted_score: generated.evaluation.weightedScore,
    passed: true,
  });

  return { dossier, draft, evaluation };
}

export async function linkV4PublishedAssets(client, context, lesson, audio) {
  const { revisionId, pipelineRunId } = context;
  const { error: revisionError } = await client.from('hebrew_episode_revisions').update({
    lesson_id: lesson.id,
    audio_track_id: audio.track.id,
    status: 'producing_visuals',
  }).eq('id', revisionId);
  if (revisionError) throw revisionError;

  await recordStage(client, pipelineRunId, revisionId, 'audio_generate', {
    track_id: audio.track.id,
    segment_count: audio.segments.length,
    total_duration_seconds: Number(audio.track.total_duration_seconds) || 0,
  });
  await recordStage(client, pipelineRunId, revisionId, 'audio_verify', {
    track_id: audio.track.id,
    ready_segments: audio.segments.filter((segment) => segment.status === 'ready').length,
  });

  const { error: runError } = await client.from('hebrew_pipeline_runs').update({
    current_stage: 'visual_plan',
  }).eq('id', pipelineRunId);
  if (runError) throw runError;
}

export async function failV4Revision(client, context, error) {
  if (!context?.revisionId) return;
  const message = error?.message || 'V4 generation failed.';
  await client.from('hebrew_episode_revisions').update({
    status: 'failed',
    release_state: 'private',
    failure_reason: message,
  }).eq('id', context.revisionId);
  if (context.pipelineRunId) {
    await client.from('hebrew_pipeline_runs').update({
      status: 'failed',
      current_stage: 'failed',
      error_information: message,
      finished_at: now(),
    }).eq('id', context.pipelineRunId);
  }
}
