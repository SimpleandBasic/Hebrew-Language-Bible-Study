import { readFileSync, writeFileSync } from 'node:fs';

function fail(message) { throw new Error(`Hebrew cost optimization patch: ${message}`); }

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) fail(`missing end marker: ${endMarker}`);
  return { start, end, text: source.slice(start, end) };
}

function replaceInSection(source, startMarker, endMarker, mutate) {
  const part = section(source, startMarker, endMarker);
  return source.slice(0, part.start) + mutate(part.text) + source.slice(part.end);
}

function patchGenerator() {
  const path = 'src/v4/episode-generator.js';
  let source = readFileSync(path, 'utf8');

  if (!source.includes("export const HEBREW_COST_OPTIMIZATION_VERSION = 'cost-optimization-v1';")) {
    const anchor = "const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex');";
    if (!source.includes(anchor)) fail('generator helper anchor');
    const helpers = `
export const HEBREW_COST_OPTIMIZATION_VERSION = 'cost-optimization-v1';

const MODEL_PRICING_PER_MILLION = {
  'gpt-5.6-luna': { input: 0.20, cached: 0.02, output: 1.20 },
  'gpt-4.1': { input: 2.00, cached: 0.50, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, cached: 0.10, output: 1.60 },
};

function normalizeOpenAiUsage(raw, model) {
  const details = raw?.prompt_tokens_details || {};
  const inputTokens = Number(raw?.prompt_tokens) || 0;
  const cachedInputTokens = Number(details?.cached_tokens) || 0;
  const outputTokens = Number(raw?.completion_tokens) || 0;
  const totalTokens = Number(raw?.total_tokens) || inputTokens + outputTokens;
  const rates = MODEL_PRICING_PER_MILLION[model] || null;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const estimatedCostUsd = rates
    ? ((uncachedInputTokens * rates.input) + (cachedInputTokens * rates.cached) + (outputTokens * rates.output)) / 1_000_000
    : null;
  return { model, inputTokens, cachedInputTokens, outputTokens, totalTokens, estimatedCostUsd };
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
    };
  }
  return { record, summary };
}

async function verifyCostOptimizedResearch(reference, canonical, research, env, operation) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.HEBREW_RESEARCH_VERIFIER_MODEL || 'gpt-4.1-mini';
  const raw = await requestJson({
    apiKey,
    model,
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 65000,
    usageSink: env.__hebrewUsageSink,
    stageType: 'research_verify',
    operation,
    requestMetadata: { reference },
    messages: [
      { role: 'system', content: 'You are an independent conservative Christian Hebrew accuracy reviewer. Be strict about factual invention and calibrated about interpretation. Return valid JSON only.' },
      { role: 'user', content: \`Audit this research dossier for \${reference} against the supplied canonical verse.

Reject material problems: invented Hebrew facts, grammar, roots, Strong's numbers, quotations, history, archaeology, geography, cross-reference claims, or Christological claims that overstate the evidence. Distinguish a responsible interpretation from a factual error.

Return JSON only:
{"passed":true,"material_concerns":[{"claim":"...","reason":"...","severity":"low|medium|high","recommended_fix":"..."}],"verified_strengths":["..."],"verdict_reason":"..."}

Canonical KJV:
\${canonical.english}

Canonical Hebrew:
\${canonical.hebrew}

Research dossier:
\${JSON.stringify(research.dossier)}

Narrative map:
\${JSON.stringify(research.narrativeMap)}\` },
    ],
  });
  const concerns = asArray(raw?.material_concerns);
  const material = concerns.filter((item) => ['medium', 'high'].includes(cleanText(item?.severity).toLowerCase()));
  return { passed: raw?.passed === true && material.length === 0, model, raw };
}
`;
    source = source.replace(anchor, anchor + helpers);
  }

  source = replaceInSection(source, 'async function requestJson(', 'function normalizeResearch(', (block) => {
    if (!block.includes('usageSink = null')) {
      block = block.replace(
        /async function requestJson\(\{ apiKey, model, messages, temperature = 0\.5, maxTokens = 7000, timeoutMs = 90000 \}\)/,
        "async function requestJson({ apiKey, model, messages, temperature = 0.5, maxTokens = 7000, timeoutMs = 90000, reasoningEffort = 'none', usageSink = null, stageType = null, operation = null, requestMetadata = {} })",
      );
      if (!block.includes('usageSink = null')) fail('requestJson signature');
    }
    if (!block.includes('const requestBody = {')) {
      const oldBody = /body: JSON\.stringify\(\{\s*model,\s*temperature,\s*max_tokens: maxTokens,\s*response_format: \{ type: 'json_object' \},\s*messages,\s*\}\),/m;
      if (!oldBody.test(block)) fail('requestJson body');
      block = block.replace(
        "  const response = await fetch('https://api.openai.com/v1/chat/completions', {",
        `  const isGpt56 = String(model).startsWith('gpt-5.6');
  const requestBody = { model, response_format: { type: 'json_object' }, messages };
  if (isGpt56) {
    requestBody.max_completion_tokens = maxTokens;
    requestBody.reasoning_effort = reasoningEffort;
    if (reasoningEffort === 'none') requestBody.temperature = temperature;
  } else {
    requestBody.max_tokens = maxTokens;
    requestBody.temperature = temperature;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {`,
      );
      block = block.replace(oldBody, 'body: JSON.stringify(requestBody),');
    }
    if (!block.includes('normalizeOpenAiUsage(payload?.usage, model)')) {
      const oldReturn = "  return parseJsonContent(payload?.choices?.[0]?.message?.content);";
      if (!block.includes(oldReturn)) fail('requestJson return');
      block = block.replace(oldReturn, `  const usage = normalizeOpenAiUsage(payload?.usage, model);
  if (usageSink && stageType) await usageSink(stageType, operation || stageType, usage, requestMetadata);
  return parseJsonContent(payload?.choices?.[0]?.message?.content);`);
    }
    return block;
  });

  source = replaceInSection(source, 'async function createResearch(', 'async function writeSermon(', (block) => {
    block = block.replace(
      "env.HEBREW_RESEARCH_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-4.1'",
      "env.HEBREW_RESEARCH_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-5.6-luna'",
    );
    if (!block.includes("stageType: 'research'")) {
      block = block.replace('    messages: [', `    reasoningEffort: env.HEBREW_REASONING_EFFORT || 'none',
    usageSink: env.__hebrewUsageSink,
    stageType: 'research',
    operation: 'research_primary',
    requestMetadata: { reference },
    messages: [`);
    }
    if (!block.includes('researchUsedFallback')) {
      const oldReturn = '  return { ...normalizeResearch(raw, reference, canonical), model };';
      if (!block.includes(oldReturn)) fail('createResearch return');
      block = block.replace(oldReturn, `  const normalized = normalizeResearch(raw, reference, canonical);
  const verification = await verifyCostOptimizedResearch(reference, canonical, normalized, env, 'research_verify_primary');
  if (verification.passed) {
    return { ...normalized, model, researchVerifierModel: verification.model, researchVerification: verification.raw, researchUsedFallback: false };
  }

  const fallbackModel = env.HEBREW_RESEARCH_FALLBACK_MODEL || 'gpt-4.1';
  const fallbackRaw = await requestJson({
    apiKey,
    model: fallbackModel,
    temperature: 0.2,
    maxTokens: 5500,
    usageSink: env.__hebrewUsageSink,
    stageType: 'research',
    operation: 'research_fallback',
    requestMetadata: { reference, primary_model: model },
    messages: [
      { role: 'system', content: 'You are a conservative Christian Hebrew research editor. Accuracy outranks novelty. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  const fallbackNormalized = normalizeResearch(fallbackRaw, reference, canonical);
  const fallbackVerification = await verifyCostOptimizedResearch(reference, canonical, fallbackNormalized, env, 'research_verify_fallback');
  if (!fallbackVerification.passed) {
    throw new Error(\`Premium fallback research failed verification: \${cleanText(fallbackVerification.raw?.verdict_reason) || 'material concerns remain'}.\`);
  }
  return { ...fallbackNormalized, model: fallbackModel, researchVerifierModel: fallbackVerification.model, researchVerification: fallbackVerification.raw, researchUsedFallback: true };`);
    }
    return block;
  });

  source = replaceInSection(source, 'async function writeSermon(', 'async function repairTranscript(', (block) => {
    if (!block.includes("stageType: 'sermon_write'")) {
      block = block.replace('    messages: [', `    usageSink: env.__hebrewUsageSink,
    stageType: 'sermon_write',
    operation: 'sermon_write',
    requestMetadata: { reference },
    messages: [`);
    }
    if (!block.includes('Silently run this cost-saving preflight')) {
      const marker = 'Return JSON only with:\\ntitle, sermon_title, description, transliteration';
      if (!block.includes(marker)) return block;
      block = block.replace(marker, `Silently run this cost-saving preflight before returning:
- transcript word count is inside the hard range
- opening_hook matches the actual opening
- central_truth governs beginning, middle, and end
- at least four genuine discoveries have payoff
- Hebrew is woven into the sermon rather than stacked as mini-lectures
- no unsupported factual or theological claim was introduced
- the Jesus connection keeps its stated guardrail
- the ending lands emotionally, includes prayer, and creates next-verse anticipation

\${marker}`);
    }
    return block;
  });

  source = replaceInSection(source, 'async function repairTranscript(', 'async function completeEvaluationEvidence(', (block) => {
    if (!block.includes('__hebrewRepairBudget')) {
      const marker = '  const currentWords = transcriptWordCount(lesson.transcript);';
      if (!block.includes(marker)) fail('repair budget');
      block = block.replace(marker, `  const repairBudget = env.__hebrewRepairBudget;
  if (repairBudget && repairBudget.used >= repairBudget.max) {
    throw new Error(\`Hebrew cost guard stopped the episode after \${repairBudget.used} paid sermon repairs.\`);
  }
  if (repairBudget) repairBudget.used += 1;
\${marker}`);
    }
    if (!block.includes("stageType: 'sermon_repair'")) {
      block = block.replace('    messages: [', `    usageSink: env.__hebrewUsageSink,
    stageType: 'sermon_repair',
    operation: 'sermon_repair',
    requestMetadata: { reference, repair_number: env.__hebrewRepairBudget?.used || null },
    messages: [`);
    }
    return block;
  });

  if (source.includes('async function completeEvaluationEvidence(')) {
    source = replaceInSection(source, 'async function completeEvaluationEvidence(', 'async function evaluateSermon(', (block) => {
      if (!block.includes("stageType: 'evaluation_evidence'")) {
        block = block.replace('    messages: [', `    usageSink: env.__hebrewUsageSink,
    stageType: 'evaluation_evidence',
    operation: 'evaluation_evidence_extract',
    requestMetadata: { reference },
    messages: [`);
      }
      return block;
    });
  }

  source = replaceInSection(source, 'async function evaluateSermon(', 'export async function generateV4Episode(', (block) => {
    if (!block.includes("stageType: 'sermon_evaluate'")) {
      block = block.replace('    messages: [', `    usageSink: env.__hebrewUsageSink,
    stageType: 'sermon_evaluate',
    operation: 'sermon_evaluate',
    requestMetadata: { reference },
    messages: [`);
    }
    return block;
  });

  source = replaceInSection(source, 'export async function generateV4Episode(', 'async function recordStage(', (block) => {
    if (!block.includes('runtime = {}')) {
      block = block.replace(
        /export async function generateV4Episode\(reference, canonical, env = process\.env, reusableResearch = null\) \{/,
        'export async function generateV4Episode(reference, canonical, env = process.env, reusableResearch = null, runtime = {}) {',
      );
      if (!block.includes('runtime = {}')) fail('generation runtime signature');
    }
    if (!block.includes('const usage = createUsageRecorder(')) {
      const marker = '  const research = reusableResearch || await createResearch(reference, canonical, env);';
      if (!block.includes(marker)) fail('generation research marker');
      block = block.replace(marker, `  const usage = createUsageRecorder(runtime.client, runtime.context, runtime.telemetryEnabled !== false);
  const runtimeEnv = {
    ...env,
    __hebrewUsageSink: usage.record,
    __hebrewRepairBudget: { max: Number.isInteger(runtime.maxPaidRepairs) ? runtime.maxPaidRepairs : 3, used: 0 },
  };
  const research = reusableResearch || await createResearch(reference, canonical, runtimeEnv);`);
    }
    block = block.replaceAll('writeSermon(reference, canonical, research, env)', 'writeSermon(reference, canonical, research, runtimeEnv)');
    block = block.replaceAll('repairTranscript(reference, lesson, research, env,', 'repairTranscript(reference, lesson, research, runtimeEnv,');
    block = block.replaceAll('evaluateSermon(reference, lesson, research, env)', 'evaluateSermon(reference, lesson, research, runtimeEnv)');
    if (!block.includes('const usageSummary = usage.summary();')) {
      const marker = '  return {\\n    lesson,';
      if (!block.includes(marker)) fail('generation return');
      block = block.replace(marker, '  const usageSummary = usage.summary();\\n\\n' + marker);
    }
    if (!block.includes('researchVerifierModel: research.researchVerifierModel')) {
      block = block.replace(
        '    researchModel: research.model,\\n    evaluationModel: review.model,',
        `    researchModel: research.model,
    researchVerifierModel: research.researchVerifierModel || null,
    researchVerification: research.researchVerification || null,
    researchUsedFallback: Boolean(research.researchUsedFallback),
    evaluationModel: review.model,`,
      );
    }
    if (!block.includes('    usageSummary,')) {
      block = block.replace('    repairCount,\\n  };', '    repairCount,\\n    usageSummary,\\n  };');
    }
    if (!block.includes('estimated_text_cost_usd: usageSummary.estimated_cost_usd')) {
      block = block.replace('    rewrite_count: repairCount,', '    rewrite_count: repairCount,\\n    estimated_text_cost_usd: usageSummary.estimated_cost_usd,');
    }
    return block;
  });

  if (!source.includes('research_verifier_model: generated.researchVerifierModel')) {
    const marker = '        research_model: generated.researchModel,\\n        evaluation_model: generated.evaluationModel,';
    if (!source.includes(marker)) fail('generation metadata');
    source = source.replace(marker, `        research_model: generated.researchModel,
        research_verifier_model: generated.researchVerifierModel,
        research_used_fallback: Boolean(generated.researchUsedFallback),
        research_verification: generated.researchVerification,
        evaluation_model: generated.evaluationModel,
        estimated_text_cost_usd: generated.usageSummary?.estimated_cost_usd ?? null,
        usage_summary: generated.usageSummary || null,`);
  }

  writeFileSync(path, source, 'utf8');
}

function patchGenerateRoute() {
  const path = 'api/generate-next-verse.js';
  let source = readFileSync(path, 'utf8');

  if (!source.includes('async function loadHebrewCostControl(client) {')) {
    const anchor = 'export default async function handler(req, res) {';
    if (!source.includes(anchor)) fail('route handler');
    const helper = `async function loadHebrewCostControl(client) {
  const defaults = {
    enabled: true,
    research_model: 'gpt-5.6-luna',
    research_verifier_model: 'gpt-4.1-mini',
    research_fallback_model: 'gpt-4.1',
    sermon_model: 'gpt-4.1',
    evaluation_model: 'gpt-4.1-mini',
    repair_model: 'gpt-4.1',
    reasoning_effort: 'none',
    telemetry_enabled: true,
    max_paid_repairs: 3,
  };
  const { data, error } = await client.from('hebrew_cost_control').select('*').eq('config_key', 'production').maybeSingle();
  if (error) {
    console.error('Could not load Hebrew cost control; using safe defaults.', error);
    return defaults;
  }
  return { ...defaults, ...(data || {}) };
}

function applyHebrewCostControl(env, config) {
  if (!config?.enabled) return { ...env };
  return {
    ...env,
    HEBREW_RESEARCH_MODEL: config.research_model || 'gpt-5.6-luna',
    HEBREW_RESEARCH_VERIFIER_MODEL: config.research_verifier_model || 'gpt-4.1-mini',
    HEBREW_RESEARCH_FALLBACK_MODEL: config.research_fallback_model || 'gpt-4.1',
    HEBREW_SERMON_MODEL: config.sermon_model || 'gpt-4.1',
    HEBREW_REPAIR_MODEL: config.repair_model || config.sermon_model || 'gpt-4.1',
    HEBREW_EVALUATION_MODEL: config.evaluation_model || 'gpt-4.1-mini',
    HEBREW_EVIDENCE_MODEL: config.evaluation_model || 'gpt-4.1-mini',
    HEBREW_REASONING_EFFORT: config.reasoning_effort || 'none',
  };
}

`;
    source = source.replace(anchor, helper + anchor);
  }

  if (!source.includes('const costControl = await loadHebrewCostControl(client);')) {
    const pattern = /    const generated = await generateV4Episode\(target\.reference, canonical, process\.env, reusableResearch\);/;
    if (!pattern.test(source)) fail('generation route call');
    source = source.replace(pattern, `    const costControl = await loadHebrewCostControl(client);
    const generationEnv = applyHebrewCostControl(process.env, costControl);
    const generated = await generateV4Episode(
      target.reference,
      canonical,
      generationEnv,
      reusableResearch,
      {
        client,
        context: v4Context,
        telemetryEnabled: costControl.telemetry_enabled !== false,
        maxPaidRepairs: Number(costControl.max_paid_repairs) || 3,
      },
    );`);
  }

  if (!source.includes('estimated_text_cost_usd: Number(generated.usageSummary?.estimated_cost_usd) || 0')) {
    const marker = '    evaluation_model: generated.evaluationModel,\\n    status: audio.track.status,';
    if (!source.includes(marker)) fail('response metadata');
    source = source.replace(marker, `    evaluation_model: generated.evaluationModel,
    research_verifier_model: generated.researchVerifierModel || null,
    research_used_fallback: Boolean(generated.researchUsedFallback),
    estimated_text_cost_usd: Number(generated.usageSummary?.estimated_cost_usd) || 0,
    status: audio.track.status,`);
  }

  writeFileSync(path, source, 'utf8');
}

patchGenerator();
patchGenerateRoute();
console.log('Applied Hebrew cost optimization V1.');
