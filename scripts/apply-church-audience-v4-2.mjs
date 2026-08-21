import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Church-audience patch marker missing: ${label}`);
  return source.replace(search, replacement);
}

function patchGenerator() {
  const path = 'src/v4/episode-generator.js';
  let source = readFileSync(path, 'utf8');

  source = source.replace(
    /export const V4_PIPELINE_VERSION = 'sermon-experience-v4\.[^']+';/,
    "export const V4_PIPELINE_VERSION = 'sermon-experience-v4.2.0';",
  );
  source = source.replace(
    /export const V4_PROMPT_VERSION = 'premium-sermon-episode-v4\.[^']+';/,
    "export const V4_PROMPT_VERSION = 'church-audience-sermon-v4.2.0';",
  );

  source = source.replace(
    'Build a verified research dossier and narrative map for a premium Christian Hebrew Bible audio episode on ${reference}.',
    'Build a verified research dossier and narrative map for a church-wide Christian Hebrew Bible audio sermon on ${reference}.',
  );

  const researchAudienceRule = '- Build for a broad church audience: a first-time visitor, a new believer, a teenager, and a mature Christian should all be able to enter the message without private background knowledge.\n';
  if (!source.includes(researchAudienceRule.trim())) {
    source = replaceOnce(
      source,
      'Rules:\n- Never invent archaeology, Hebrew meanings, grammar, Strong\'s numbers, historical details, or quotations.\n',
      `Rules:\n${researchAudienceRule}- Never invent archaeology, Hebrew meanings, grammar, Strong's numbers, historical details, or quotations.\n`,
      'research audience rule',
    );
  }

  source = source.replace(
    'Write the complete premium daily Hebrew Bible teaching episode for ${reference} from the approved research and narrative map below.',
    'Write the complete church-wide Hebrew Bible sermon episode for ${reference} from the approved research and narrative map below.',
  );

  const audienceContract = [
    '- Audience: speak to a mixed church room, not to one known person. The listener may be visiting church for the first time, newly following Jesus, returning after years away, or deeply mature in the faith.',
    '- Never assume private knowledge of the listener. Do not refer to their spouse, children, work, routines, personality, recent conversations, current season, or personal history unless that information is explicitly contained in the biblical text itself.',
    '- Use welcoming Christian language. Explain church vocabulary, Hebrew terms, and theological ideas simply enough that a newcomer can follow without making mature believers feel talked down to.',
    '- Apply the passage through broadly human experiences: fear, work, family, loneliness, hope, temptation, worship, grief, joy, responsibility, rest, friendship, and ordinary life. Do not build application around a niche lifestyle or one person\'s habits.',
    '- The sermon should feel ready to play in a church gathering, small group, car, kitchen, or shared text message without needing an explanation of who it was originally made for.',
  ].join('\n');
  if (!source.includes('- Audience: speak to a mixed church room, not to one known person.')) {
    source = replaceOnce(
      source,
      'Experience contract:\n',
      `Experience contract:\n${audienceContract}\n`,
      'sermon audience contract',
    );
  }

  source = source.replace(
    '- Use one to three gentle Michael-Scott-like observational moments: relatable human awkwardness or overconfidence, never imitation, mockery, or jokes inside sacred material.',
    '- Use zero to two gentle observational-humor moments from ordinary life when they genuinely help the message. Humor is optional, must be broadly relatable, and must never become imitation, mockery, or a joke inside sacred material.',
  );
  source = source.replace(
    '- Explain deep ideas in language a fifth grader can follow.',
    '- Explain deep ideas in plain spoken language a broad church audience can follow. Define unfamiliar terms immediately and keep the theological substance strong.',
  );

  const repairAudience = ' Preserve the church-wide audience contract: no private listener assumptions, no Ace-specific references, and no niche personal examples that require knowing the original listener.';
  if (!source.includes(repairAudience.trim())) {
    source = source.replace(
      'Preserve the sermon title, central truth, biblical claims, supplied Hebrew, KJV wording, Christological guardrail, prayerful tone, and narrative map.',
      `Preserve the sermon title, central truth, biblical claims, supplied Hebrew, KJV wording, Christological guardrail, prayerful tone, and narrative map.${repairAudience}`,
    );
  }

  const evaluationAudienceGates = [
    '- church-audience accessibility: the sermon works for a mixed church room without knowing anything about the original listener',
    '- no private-listener assumptions, personal callbacks, or niche application that makes the sermon feel written for one specific person',
  ].join('\n');
  if (!source.includes('church-audience accessibility:')) {
    const evaluatorReturnMarker = 'Return JSON only with scores, hard_gate_results, evidence_spans, strengths, rewrite_directives, and verdict.';
    if (!source.includes(evaluatorReturnMarker)) {
      throw new Error('Church-audience patch marker missing: evaluation audience gates');
    }
    source = source.replace(
      evaluatorReturnMarker,
      `${evaluationAudienceGates}\n\n${evaluatorReturnMarker}`,
    );
  }

  source = source.replace(
    'You are a biblically faithful Christian Hebrew teacher and exceptional spoken-word storyteller. Return valid JSON only.',
    'You are a biblically faithful Christian Hebrew teacher and exceptional spoken-word preacher for a broad church audience. You know the biblical text, but you do not know the listener personally. Return valid JSON only.',
  );
  source = source.replace(
    'You are an independent Christian sermon producer and Hebrew accuracy reviewer. Return valid JSON only.',
    'You are an independent Christian sermon producer and Hebrew accuracy reviewer for a broad church audience. Penalize content that assumes private knowledge of the listener. Return valid JSON only.',
  );

  writeFileSync(path, source, 'utf8');
}

function patchRequestedReferenceRebuild() {
  const path = 'api/generate-next-verse.js';
  let source = readFileSync(path, 'utf8');

  if (!source.includes("mode === 'sermon_rebuild'")) {
    const newResolve = `async function resolveTarget(client, requestedReference, mode = 'publish') {
  const requested = String(requestedReference || '').trim();
  if (mode === 'sermon_rebuild') {
    const rebuildTarget = parseReference(requested);
    if (!rebuildTarget) {
      const invalid = new Error('A valid Genesis reference is required for sermon_rebuild mode.');
      invalid.statusCode = 400;
      throw invalid;
    }
    return rebuildTarget;
  }

  const { data: expectedReference, error } = await client.rpc('next_hebrew_v4_reference');
  if (error) throw error;
  const expected = parseReference(expectedReference);
  if (!expected) throw new Error(\`The next atomic Genesis reference is invalid: \${expectedReference || 'empty'}.\`);

  if (requested && requested.toLowerCase() !== expected.reference.toLowerCase()) {
    const stale = new Error(\`This job requested \${requested}, but the next incomplete episode is \${expected.reference}.\`);
    stale.statusCode = 409;
    throw stale;
  }
  return expected;
}`;
    const resolvePattern = /async function resolveTarget\([^)]*\) \{[\s\S]*?\n\}\n\nasync function fetchCanonicalVerse/;
    if (!resolvePattern.test(source)) {
      throw new Error('Church-audience patch marker missing: rebuild reference resolver');
    }
    source = source.replace(resolvePattern, `${newResolve}\n\nasync function fetchCanonicalVerse`);
  }

  if (!source.includes('resolveTarget(client, req.body?.requested_reference, req.body?.mode)')) {
    const targetCallPattern = /const target = await resolveTarget\(client,\s*req\.body\?\.requested_reference(?:,\s*req\.body\?\.mode)?\);/;
    if (!targetCallPattern.test(source)) {
      throw new Error('Church-audience patch marker missing: rebuild mode resolver call');
    }
    source = source.replace(
      targetCallPattern,
      'const target = await resolveTarget(client, req.body?.requested_reference, req.body?.mode);',
    );
  }

  if (!source.includes("const recovery = req.body?.mode === 'sermon_rebuild'")) {
    const recoveryPattern = /const recovery = await findRecoverableRevision\(client, target\.reference\);/;
    if (!recoveryPattern.test(source)) {
      throw new Error('Church-audience patch marker missing: fresh rebuild revision');
    }
    source = source.replace(
      recoveryPattern,
      "const recovery = req.body?.mode === 'sermon_rebuild'\n      ? null\n      : await findRecoverableRevision(client, target.reference);",
    );
  }

  writeFileSync(path, source, 'utf8');
}

function patchOrchestratorVersion() {
  const path = 'api/run-generation-job.js';
  let source = readFileSync(path, 'utf8');
  source = source.replaceAll("pipeline_version: 'sermon-experience-v4.1.1'", "pipeline_version: 'sermon-experience-v4.2.0'");
  writeFileSync(path, source, 'utf8');
}

patchGenerator();
patchRequestedReferenceRebuild();
patchOrchestratorVersion();
console.log('Church-audience sermon V4.2 patch applied.');
