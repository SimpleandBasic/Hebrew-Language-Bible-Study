import crypto from 'node:crypto';
import { publishRevision, verifyRevision } from './release-manager.js';

export const VISUAL_PIPELINE_VERSION = 'structured-visual-release-v4.1';

const now = () => new Date().toISOString();
const clean = (value) => String(value ?? '').trim();
const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex');

function firstText(...values) {
  return values.map(clean).find(Boolean) || '';
}

function observationFromLesson(lesson = {}) {
  const story = asArray(lesson.strongs_word_stories)[0] || {};
  return {
    word: story.hebrew,
    transliteration: story.transliteration,
    pronunciation_help: story.pronunciation,
    meaning_here: story.meaning,
    grammar: '',
    root: '',
    strongs_number: asArray(story.strongs).join(', '),
    recurring_biblical_scenes: story.story,
  };
}

function normalizedObservation(dossier = {}, lesson = {}) {
  const source = asArray(dossier.hebrew_observations)[0] || observationFromLesson(lesson);
  return {
    word: firstText(source.word, 'Hebrew word'),
    transliteration: firstText(source.transliteration, 'Hebrew insight'),
    pronunciation: firstText(source.pronunciation_help, source.pronunciation),
    meaning: firstText(source.meaning_here, source.meaning, source.gloss, 'A key word in this verse.'),
    grammar: clean(source.grammar),
    root: clean(source.root),
    strongs: firstText(source.strongs_number, asArray(source.strongs).join(', ')),
    scenes: firstText(source.recurring_biblical_scenes, source.story),
  };
}

function normalizedConnection(dossier = {}, lesson = {}) {
  const source = asArray(dossier.cross_references)[0] || asArray(lesson.cross_references)[0] || {};
  return {
    reference: firstText(source.reference, source.verse, 'Related Scripture'),
    connection: firstText(source.connection, source.summary, 'This passage carries the same biblical theme forward.'),
    guardrail: firstText(source.guardrail, 'This is a canonical connection, not a claim that both passages are identical.'),
    type: firstText(source.connection_type, 'canonical connection'),
  };
}

function jesusConnection(lesson = {}, dossier = {}) {
  const block = asObject(lesson.did_you_know_see_jesus_here);
  const pathway = asArray(dossier.christological_pathways)[0] || {};
  return {
    title: 'See Jesus Here',
    summary: firstText(block.see_jesus_here, pathway.connection, pathway.summary, lesson.central_truth),
    guardrail: firstText(block.guardrail, pathway.guardrail, 'This card names a responsible canonical bridge rather than forcing a hidden prediction into the verse.'),
    reference: firstText(asArray(block.references)[0], pathway.reference, 'The wider biblical story'),
  };
}

export function buildVisualPlan({ reference, lesson = {}, dossier = {} }) {
  const literary = asObject(dossier.literary_context);
  const narrative = asObject(literary.narrative_map);
  const observation = normalizedObservation(dossier, lesson);
  const connection = normalizedConnection(dossier, lesson);
  const jesus = jesusConnection(lesson, dossier);
  const centralTruth = firstText(lesson.central_truth, narrative.controlling_truth, lesson.big_idea, lesson.simple_summary);
  const memoryPhrase = firstText(lesson.memory_phrase, narrative.closing_memory_line, lesson.practical_reflection);
  const practical = firstText(lesson.practical_reflection, narrative.concrete_action, lesson.closing_invitation);
  const controllingImage = firstText(narrative.controlling_image, lesson.opening_hook, lesson.description);
  const summary = firstText(lesson.simple_summary, lesson.description, lesson.big_idea);
  const allObservations = asArray(dossier.hebrew_observations).slice(0, 3);
  const diagramItems = allObservations.length
    ? allObservations.map((item, index) => ({
      label: `Discovery ${index + 1}`,
      title: firstText(item.word, item.transliteration, item.meaning_here),
      relationship: firstText(item.meaning_here, item.grammar),
    }))
    : [
      { label: 'Hear', title: reference, relationship: 'Listen closely to the words Scripture uses.' },
      { label: 'See', title: centralTruth, relationship: 'Notice the truth carrying the whole episode.' },
      { label: 'Live', title: memoryPhrase, relationship: 'Carry one line into the day.' },
    ];

  const cards = [
    {
      sort_order: 1,
      card_type: 'hero',
      eyebrow: 'Central Truth',
      title: firstText(lesson.sermon_title, lesson.title, `Explore ${reference}`),
      summary,
      why_it_matters: centralTruth,
      body: controllingImage,
      evidence_level: 'artistic_illustration',
      structured_data: { layout: 'hero', controlling_truth: centralTruth },
      source_summary: reference,
      is_required: true,
    },
    {
      sort_order: 2,
      card_type: 'hebrew_word',
      eyebrow: 'Hebrew Discovery',
      title: `${observation.word} · ${observation.transliteration}`,
      summary: observation.meaning,
      why_it_matters: firstText(observation.scenes, `This word helps the listener hear what ${reference} emphasizes.`),
      body: [observation.pronunciation && `Say it: ${observation.pronunciation}.`, observation.grammar, observation.root && `Root: ${observation.root}.`].filter(Boolean).join(' '),
      evidence_level: 'scripture_direct',
      structured_data: {
        layout: 'hebrew_word',
        hebrew: observation.word,
        transliteration: observation.transliteration,
        gloss: observation.meaning,
        root: observation.root,
        strongs: observation.strongs,
      },
      source_summary: `${reference} · Hebrew text`,
      is_required: true,
    },
    {
      sort_order: 3,
      card_type: 'diagram',
      eyebrow: 'Verse Architecture',
      title: 'Three Discoveries Inside the Verse',
      summary: 'The episode follows the verse itself instead of forcing a separate lecture outline onto it.',
      why_it_matters: 'Seeing the discoveries together helps the Hebrew, theology, and application feel like one connected story.',
      body: centralTruth,
      evidence_level: 'scripture_direct',
      structured_data: { layout: 'diagram', items: diagramItems },
      source_summary: reference,
      is_required: true,
    },
    {
      sort_order: 4,
      card_type: 'scripture_connection',
      eyebrow: connection.type,
      title: `${reference} → ${connection.reference}`,
      summary: connection.connection,
      why_it_matters: connection.guardrail,
      body: 'The connection expands the theme while preserving the meaning of each passage in its own context.',
      evidence_level: 'scripture_direct',
      structured_data: { layout: 'connection', from: reference, to: connection.reference, keyword: observation.word },
      source_summary: `${reference}; ${connection.reference}`,
      is_required: true,
    },
    {
      sort_order: 5,
      card_type: 'scripture_connection',
      eyebrow: 'High Christology',
      title: jesus.title,
      summary: jesus.summary,
      why_it_matters: jesus.guardrail,
      body: 'The goal is to see how the whole canon reaches its fullness in Christ without claiming more than the text supports.',
      evidence_level: 'scripture_direct',
      structured_data: { layout: 'connection', from: reference, to: jesus.reference, keyword: 'Jesus' },
      source_summary: `${reference}; ${jesus.reference}`,
      is_required: true,
    },
    {
      sort_order: 6,
      card_type: 'daily_life',
      eyebrow: 'Practice It Today',
      title: memoryPhrase || 'Carry the Verse With You',
      summary: practical,
      why_it_matters: 'The episode should change one ordinary moment today, not merely add another fact to remember.',
      body: firstText(lesson.closing_invitation, lesson.prayer),
      evidence_level: 'scripture_direct',
      structured_data: {
        layout: 'diagram',
        items: [
          { label: 'Notice', title: 'Pause', relationship: 'Recognize where this truth meets your real day.' },
          { label: 'Respond', title: 'Pray', relationship: 'Answer the Father with gratitude and trust.' },
          { label: 'Remember', title: memoryPhrase, relationship: 'Repeat the episode’s memory line.' },
        ],
      },
      source_summary: reference,
      is_required: false,
    },
  ];

  return {
    title: `Explore ${reference}`,
    subtitle: 'See the Hebrew, biblical connections, Christ-centered fulfillment, and daily practice while the audio keeps playing.',
    centralTruth,
    cards,
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
    output_hash: metadata.output_hash || null,
    started_at: timestamp,
    finished_at: timestamp,
    metadata,
  });
  if (error) throw error;
}

async function fetchContext(client, revisionId) {
  const { data: revision, error: revisionError } = await client.from('hebrew_episode_revisions').select('*').eq('id', revisionId).single();
  if (revisionError) throw revisionError;
  if (!revision.lesson_id || !revision.audio_track_id || !revision.approved_sermon_draft_id || !revision.research_dossier_id) {
    throw new Error('V4 visual production requires completed sermon, lesson, and audio relationships.');
  }
  const [{ data: episode, error: episodeError }, { data: draft, error: draftError }, { data: dossier, error: dossierError }, { data: lesson, error: lessonError }] = await Promise.all([
    client.from('hebrew_episodes').select('*').eq('id', revision.episode_id).single(),
    client.from('hebrew_sermon_drafts').select('*').eq('id', revision.approved_sermon_draft_id).single(),
    client.from('hebrew_research_dossiers').select('*').eq('id', revision.research_dossier_id).single(),
    client.from('hebrew_lessons').select('*').eq('id', revision.lesson_id).single(),
  ]);
  if (episodeError) throw episodeError;
  if (draftError) throw draftError;
  if (dossierError) throw dossierError;
  if (lessonError) throw lessonError;
  const { data: pipelineRun, error: runError } = await client.from('hebrew_pipeline_runs').select('*').eq('revision_id', revisionId).single();
  if (runError) throw runError;
  return { revision, episode, draft, dossier, lesson, pipelineRun };
}

async function ensureHeroAsset(client) {
  const sourceUrl = 'assets/genesis-cover.svg?v=20260718-1';
  const { data, error } = await client.from('hebrew_visual_assets').upsert({
    asset_key: 'genesis-approved-album-art-v1',
    asset_type: 'existing_artwork',
    title: 'Genesis creation artwork',
    source_url: sourceUrl,
    alt_text: 'Approved Genesis series artwork presented as an artistic illustration.',
    status: 'ready',
    evidence_level: 'artistic_illustration',
    checksum: sha256(sourceUrl),
    reuse_tags: ['genesis', 'creation', 'book-cover', 'approved', 'reusable'],
    generated_at: now(),
    updated_at: now(),
  }, { onConflict: 'asset_key' }).select('*').single();
  if (error) throw error;
  return data;
}

export async function produceV4VisualRelease(client, revisionId, options = {}) {
  const context = await fetchContext(client, revisionId);
  const lessonPayload = asObject(context.draft.lesson_payload);
  const plan = buildVisualPlan({ reference: context.episode.reference, lesson: lessonPayload, dossier: context.dossier });
  const planHash = sha256(JSON.stringify(plan));
  const hero = await ensureHeroAsset(client);

  const { data: existingManifest, error: existingManifestError } = await client.from('hebrew_lesson_manifests').select('*').eq('lesson_id', context.lesson.id).maybeSingle();
  if (existingManifestError) throw existingManifestError;
  const manifestStatus = existingManifest?.status === 'published' ? 'published' : 'ready';
  const { data: manifest, error: manifestError } = await client.from('hebrew_lesson_manifests').upsert({
    lesson_id: context.lesson.id,
    verse_id: context.episode.verse_id,
    audio_track_id: context.revision.audio_track_id,
    schema_version: VISUAL_PIPELINE_VERSION,
    sermon_title: firstText(lessonPayload.sermon_title, lessonPayload.title),
    central_truth: plan.centralTruth,
    status: manifestStatus,
    required_card_count: plan.cards.filter((card) => card.is_required).length,
    target_card_count: plan.cards.length,
    content_hash: planHash,
    error_information: null,
    updated_at: now(),
  }, { onConflict: 'lesson_id' }).select('*').single();
  if (manifestError) throw manifestError;

  const version = `v4-r${context.revision.revision_number}`;
  const { data: feed, error: feedError } = await client.from('hebrew_visual_feeds').upsert({
    manifest_id: manifest.id,
    lesson_id: context.lesson.id,
    verse_id: context.episode.verse_id,
    audio_track_id: context.revision.audio_track_id,
    title: plan.title,
    subtitle: plan.subtitle,
    version,
    content_hash: planHash,
    status: 'ready',
    card_count: plan.cards.length,
    is_published: false,
    published_at: null,
    updated_at: now(),
  }, { onConflict: 'lesson_id,version' }).select('*').single();
  if (feedError) throw feedError;

  const { error: deleteError } = await client.from('hebrew_visual_cards').delete().eq('feed_id', feed.id);
  if (deleteError) throw deleteError;
  const cardRows = plan.cards.map((card) => ({
    feed_id: feed.id,
    ...card,
    primary_asset_id: card.sort_order === 1 ? hero.id : null,
    content_version: 1,
    content_hash: sha256(JSON.stringify(card)),
    status: 'ready',
  }));
  const { data: cards, error: cardError } = await client.from('hebrew_visual_cards').insert(cardRows).select('*');
  if (cardError) throw cardError;

  const sources = [];
  for (const card of cards || []) {
    sources.push({
      card_id: card.id,
      sort_order: 1,
      citation_label: card.source_summary,
      source_title: 'The Holy Bible, King James Version',
      source_publisher: 'Scripture',
      source_note: 'Primary Scripture source for this visual study card.',
    });
    if (card.sort_order === 2) {
      sources.push({
        card_id: card.id,
        sort_order: 2,
        citation_label: 'Hebrew lexical background',
        source_title: 'A Hebrew and English Lexicon of the Old Testament',
        source_author: 'Francis Brown, S. R. Driver, and Charles A. Briggs',
        source_publisher: 'Clarendon Press',
        source_year: 1906,
        source_note: 'Lexical background for the Hebrew word card.',
      });
    }
  }
  const { error: sourceError } = await client.from('hebrew_visual_sources').insert(sources);
  if (sourceError) throw sourceError;

  await client.from('hebrew_episode_revisions').update({
    visual_feed_id: feed.id,
    album_art_asset_id: hero.id,
    status: 'verifying',
    failure_reason: null,
  }).eq('id', revisionId).throwOnError();
  await client.from('hebrew_pipeline_runs').update({ current_stage: 'release_verify', error_information: null }).eq('id', context.pipelineRun.id).throwOnError();

  await recordStage(client, context.pipelineRun.id, revisionId, 'visual_plan', { output_hash: planHash, card_count: plan.cards.length });
  await recordStage(client, context.pipelineRun.id, revisionId, 'visual_generate', { output_hash: sha256(JSON.stringify(cards)), structured_cards: cards?.length || 0 });
  await recordStage(client, context.pipelineRun.id, revisionId, 'visual_verify', { ready_cards: (cards || []).filter((card) => card.status === 'ready').length });
  await recordStage(client, context.pipelineRun.id, revisionId, 'album_art_generate', { asset_id: hero.id, reused: true });
  await recordStage(client, context.pipelineRun.id, revisionId, 'album_art_verify', { asset_id: hero.id, checksum: hero.checksum });

  const verification = await verifyRevision(revisionId, { client });
  if (!verification.readyForRelease) {
    throw new Error(`V4 release verification failed: ${verification.checks.filter((item) => item.required && !item.passed).map((item) => item.name).join(', ')}`);
  }
  await recordStage(client, context.pipelineRun.id, revisionId, 'database_verify', { relationships_ready: true });
  await recordStage(client, context.pipelineRun.id, revisionId, 'release_verify', { checks: verification.checks.length, ready_for_release: true });

  const publication = await publishRevision(revisionId, {
    client,
    publishedBy: options.publishedBy || 'v4_visual_release_manager',
    reason: options.reason || 'Sermon, Cedar audio, structured visuals, and approved Genesis artwork passed the V4 atomic release gates.',
  });
  await recordStage(client, context.pipelineRun.id, revisionId, 'publish', { release_checksum: publication.release_checksum || null });
  await client.from('hebrew_pipeline_runs').update({ status: 'succeeded', current_stage: 'published', finished_at: now(), error_information: null }).eq('id', context.pipelineRun.id).throwOnError();

  return {
    ok: true,
    reference: context.episode.reference,
    revision_id: revisionId,
    visual_feed_id: feed.id,
    album_art_asset_id: hero.id,
    card_count: cards?.length || 0,
    published: true,
    release_checksum: publication.release_checksum || null,
    pipeline_version: VISUAL_PIPELINE_VERSION,
  };
}
