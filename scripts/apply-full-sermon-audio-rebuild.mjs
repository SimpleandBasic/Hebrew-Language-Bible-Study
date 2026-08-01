import { readFileSync, writeFileSync } from 'node:fs';

const path = 'api/run-generation-job.js';
let source = readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Full sermon audio patch marker missing: ${label}`);
  source = source.replace(search, replacement);
}

if (!source.includes('async function runPublishedAudioRebuild(')) {
  const helper = `
function parseGenesisReference(reference) {
  const match = String(reference || '').trim().match(/^Genesis\\s+(\\d+):(\\d+)$/i);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  if (!Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1) return null;
  return { chapter, verse, reference: \`Genesis \${chapter}:\${verse}\` };
}

function lessonOrderForReference(reference) {
  return reference.chapter === 1
    ? reference.verse
    : Number(\`\${reference.chapter}\${String(reference.verse).padStart(3, '0')}\`);
}

async function generatePreparedAudioTrack(origin, trackId, serviceRoleKey) {
  const attempts = [];
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const response = await fetch(\`\${origin}/api/hebrew-audio-service\`, {
      method: 'POST',
      headers: {
        authorization: \`Bearer \${serviceRoleKey}\`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ operation: 'generate-next', trackId }),
      signal: AbortSignal.timeout(110000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || \`Audio generator failed (\${response.status}).\`);
    attempts.push(result);
    if (result.ready) return { ready: true, attempts };
  }
  return { ready: false, attempts };
}

async function runPublishedAudioRebuild(origin, job, jobId, client) {
  const target = parseGenesisReference(job.requested_reference);
  if (!target) throw new Error(\`Invalid Genesis reference: \${job.requested_reference || 'empty'}.\`);
  const lessonOrder = lessonOrderForReference(target);

  await addEvent(
    client,
    jobId,
    'prepare_full_sermon_audio',
    'started',
    \`\${target.reference} full sermon audio rebuild started.\`,
    { lesson_order: lessonOrder },
  );

  const { data: trackId, error: prepareError } = await client.rpc(
    'prepare_hebrew_audio_track_from_private_lesson',
    { p_lesson_order: lessonOrder },
  );
  if (prepareError) throw prepareError;
  if (!trackId) throw new Error('Audio preparation returned no track ID.');

  const serviceRoleKey = process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('Supabase service role key is missing from Vercel.');

  const generation = await generatePreparedAudioTrack(origin, trackId, serviceRoleKey);
  if (!generation.ready) throw new Error('The full sermon audio did not finish within the rebuild run.');

  const timestamp = new Date().toISOString();
  const { data: track, error: trackError } = await client
    .from('hebrew_audio_tracks')
    .update({
      status: 'ready',
      is_published: true,
      published_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', trackId)
    .select('*')
    .single();
  if (trackError) throw trackError;

  const { error: lessonError } = await client
    .from('hebrew_lessons')
    .update({ is_published: true, updated_at: timestamp })
    .eq('id', track.lesson_id);
  if (lessonError) throw lessonError;

  const { data: segments, error: segmentError } = await client
    .from('hebrew_audio_segments')
    .select('id,segment_type,sort_order,status,audio_path,duration_seconds,checksum')
    .eq('track_id', trackId)
    .order('sort_order');
  if (segmentError) throw segmentError;

  const readySegments = (segments || []).filter((segment) => (
    segment.status === 'ready'
    && String(segment.audio_path || '').trim()
    && Number(segment.duration_seconds) > 0
    && String(segment.checksum || '').trim()
  ));
  if (!segments?.length || readySegments.length !== segments.length) {
    throw new Error('The rebuilt audio failed final segment verification.');
  }

  const result = {
    ok: true,
    reference: target.reference,
    lesson_order: lessonOrder,
    track_id: trackId,
    script_version: track.script_version,
    segment_count: segments.length,
    sermon_segment_count: segments.filter((segment) => segment.segment_type.startsWith('sermon-part-')).length,
    total_duration_seconds: Number(track.total_duration_seconds) || 0,
    generation_attempts: generation.attempts.length,
    v4_next_stage: 'published_audio_rebuilt',
    published: true,
  };

  await addEvent(
    client,
    jobId,
    'published_audio_rebuilt',
    'completed',
    \`\${target.reference} now uses the complete V4 sermon transcript in Cedar audio.\`,
    result,
  );
  return result;
}

`;

  replaceOnce(
    'async function handleV4ReleaseAction(req, res) {',
    `${helper}async function handleV4ReleaseAction(req, res) {`,
    'rebuild helper insertion',
  );
}

if (!source.includes("const isAudioRebuild = job.mode === 'audio_rebuild';")) {
  replaceOnce(
    "    await updateJob(client, jobId, {\n      status: 'running',",
    "    const isAudioRebuild = job.mode === 'audio_rebuild';\n\n    await updateJob(client, jobId, {\n      status: 'running',",
    'audio rebuild mode declaration',
  );
}

source = source.replace(
  "      current_stage: 'v4_episode_pipeline',",
  "      current_stage: isAudioRebuild ? 'prepare_full_sermon_audio' : 'v4_episode_pipeline',",
);
source = source.replace(
  "      'Production V4 generation and complete release pipeline started.',",
  "      isAudioRebuild\n        ? 'Published V4 sermon audio rebuild started.'\n        : 'Production V4 generation and complete release pipeline started.',",
);
source = source.replace(
  '    const result = await runGeneration(origin, job, jobId, client);',
  "    const result = isAudioRebuild\n      ? await runPublishedAudioRebuild(origin, job, jobId, client)\n      : await runGeneration(origin, job, jobId, client);",
);
source = source.replace(
  '      `${result.reference} generated and atomically published with sermon, audio, visuals, and artwork.`,',
  "      isAudioRebuild\n        ? `${result.reference} published audio rebuilt from the complete sermon transcript.`\n        : `${result.reference} generated and atomically published with sermon, audio, visuals, and artwork.`,",
);

writeFileSync(path, source, 'utf8');
console.log('Applied full V4 sermon audio rebuild mode.');
