import { getSupabaseAdminClient } from '../supabase-client.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const arrayValue = (value) => (Array.isArray(value) ? value : []);
const objectValue = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

function positiveInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSegments(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('audio_segments must be valid JSON when supplied as a string.');
    }
  }
  return value;
}

function normalizeSpeechSettings(value) {
  const settings = objectValue(value);
  const speed = Number(settings.speed);
  return {
    ...settings,
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
  };
}

export function normalizeAudioSegments(value, env = process.env) {
  const raw = arrayValue(parseSegments(value));
  if (!raw.length) throw new Error('At least one audio segment is required.');

  const defaultVoice = text(env.HEBREW_TTS_VOICE) || 'cedar';
  const seenOrders = new Set();

  return raw.map((entry, index) => {
    const segment = objectValue(entry);
    const sortOrder = positiveInt(segment.sort_order ?? segment.sortOrder ?? segment.order, (index + 1) * 10);
    if (seenOrders.has(sortOrder)) throw new Error(`Duplicate audio segment sort order: ${sortOrder}.`);
    seenOrders.add(sortOrder);

    const spokenText = text(segment.spoken_text ?? segment.spokenText ?? segment.spoken ?? segment.text);
    if (!spokenText) throw new Error(`Audio segment ${sortOrder} is missing spoken_text.`);

    return {
      sort_order: sortOrder,
      segment_type: text(segment.segment_type ?? segment.segmentType ?? segment.type) || 'section',
      label: text(segment.label ?? segment.title) || `Section ${index + 1}`,
      spoken_text: spokenText,
      display_transcript: text(segment.display_transcript ?? segment.displayTranscript ?? segment.transcript) || spokenText,
      voice_profile: text(segment.voice_profile ?? segment.voiceProfile ?? segment.voice) || defaultVoice,
      voice_instructions: text(segment.voice_instructions ?? segment.voiceInstructions ?? segment.instructions),
      speech_settings: normalizeSpeechSettings(segment.speech_settings ?? segment.speechSettings),
    };
  });
}

function sameJson(left, right) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function generationInputsChanged(existing, segment) {
  if (!existing) return true;
  return (
    text(existing.spoken_text) !== segment.spoken_text
    || text(existing.voice_profile) !== segment.voice_profile
    || text(existing.voice_instructions) !== segment.voice_instructions
    || !sameJson(existing.speech_settings, segment.speech_settings)
  );
}

async function loadTrack(supabase, input = {}) {
  const trackId = text(input.track_id ?? input.trackId);
  const verseReference = text(input.verse_reference ?? input.verseReference);
  if (!trackId && !verseReference) throw new Error('track_id or verse_reference is required.');

  let query = supabase
    .from('hebrew_audio_tracks')
    .select('id,verse_id,lesson_id,verse_reference,track_title,status,script_version,total_duration_seconds,is_published,published_at,created_at,updated_at')
    .limit(1);

  query = trackId ? query.eq('id', trackId) : query.eq('verse_reference', verseReference);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load Hebrew audio track: ${error.message}`);
  if (!data) throw new Error('Hebrew audio track was not found.');
  return data;
}

function audioApiUrl(env = process.env) {
  const explicit = text(env.HEBREW_AUDIO_API_URL);
  if (explicit) return explicit;

  const host = text(env.VERCEL_PROJECT_PRODUCTION_URL)
    || text(env.VERCEL_URL)
    || 'hebrew-developer-mcp.vercel.app';

  return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/hebrew-audio`;
}

function publicAudioUrl(path, env = process.env) {
  const supabaseUrl = text(env.HEBREW_SUPABASE_URL || env.SUPABASE_URL).replace(/\/$/, '');
  if (!supabaseUrl || !path) return '';
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/public/hebrew-media/${encodedPath}`;
}

export async function prepareHebrewAudioTrack(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const verseReference = text(input.verse_reference ?? input.verseReference);
  if (!verseReference) throw new Error('verse_reference is required.');

  const segments = normalizeAudioSegments(
    input.audio_segments ?? input.audioSegments ?? input.segments,
    env,
  );

  const { data: verse, error: verseError } = await supabase
    .from('hebrew_verses')
    .select('id,reference')
    .eq('reference', verseReference)
    .limit(1)
    .maybeSingle();

  if (verseError) throw new Error(`Could not load ${verseReference}: ${verseError.message}`);
  if (!verse) throw new Error(`${verseReference} must be published to hebrew_verses before preparing audio.`);

  const requestedLessonId = text(input.lesson_id ?? input.lessonId);
  let lessonId = requestedLessonId || null;
  if (lessonId) {
    const { data: lesson, error: lessonError } = await supabase
      .from('hebrew_lessons')
      .select('id')
      .eq('id', lessonId)
      .limit(1)
      .maybeSingle();
    if (lessonError) throw new Error(`Could not verify Hebrew lesson: ${lessonError.message}`);
    if (!lesson) throw new Error('The supplied lesson_id was not found.');
  }

  const trackTitle = text(input.track_title ?? input.trackTitle ?? input.title) || `${verseReference} Hebrew Audio Lesson`;
  const scriptVersion = text(input.script_version ?? input.scriptVersion) || 'v1';

  const { data: existingTrack, error: lookupError } = await supabase
    .from('hebrew_audio_tracks')
    .select('id,lesson_id')
    .eq('verse_reference', verseReference)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not check existing audio track: ${lookupError.message}`);

  const trackRow = {
    verse_id: verse.id,
    lesson_id: lessonId || existingTrack?.lesson_id || null,
    verse_reference: verseReference,
    track_title: trackTitle,
    status: 'ready_to_generate',
    script_version: scriptVersion,
    total_duration_seconds: null,
    is_published: false,
    published_at: null,
    updated_at: new Date().toISOString(),
  };

  const trackQuery = existingTrack?.id
    ? supabase.from('hebrew_audio_tracks').update(trackRow).eq('id', existingTrack.id)
    : supabase.from('hebrew_audio_tracks').insert(trackRow);

  const { data: track, error: trackError } = await trackQuery
    .select('id,verse_reference,track_title,status,script_version,is_published')
    .single();

  if (trackError) throw new Error(`Could not save Hebrew audio track: ${trackError.message}`);

  const { data: existingSegments, error: segmentLookupError } = await supabase
    .from('hebrew_audio_segments')
    .select('id,sort_order,segment_type,label,spoken_text,display_transcript,voice_profile,voice_instructions,speech_settings,generation_model,audio_path,duration_seconds,checksum,status,error_information,generated_at')
    .eq('track_id', track.id)
    .order('sort_order', { ascending: true });

  if (segmentLookupError) throw new Error(`Could not load existing audio segments: ${segmentLookupError.message}`);

  const existingByOrder = new Map(arrayValue(existingSegments).map((segment) => [segment.sort_order, segment]));
  const desiredOrders = new Set(segments.map((segment) => segment.sort_order));
  const obsoleteIds = arrayValue(existingSegments)
    .filter((segment) => !desiredOrders.has(segment.sort_order))
    .map((segment) => segment.id);

  if (obsoleteIds.length) {
    const { error: deleteError } = await supabase
      .from('hebrew_audio_segments')
      .delete()
      .in('id', obsoleteIds);
    if (deleteError) throw new Error(`Could not remove obsolete audio segments: ${deleteError.message}`);
  }

  const rows = segments.map((segment) => {
    const existing = existingByOrder.get(segment.sort_order);
    const changed = generationInputsChanged(existing, segment);

    return {
      track_id: track.id,
      ...segment,
      generation_model: changed ? null : existing?.generation_model ?? null,
      audio_path: changed ? null : existing?.audio_path ?? null,
      duration_seconds: changed ? null : existing?.duration_seconds ?? null,
      checksum: changed ? null : existing?.checksum ?? null,
      status: changed ? 'pending' : existing?.status ?? 'pending',
      error_information: changed ? null : existing?.error_information ?? null,
      generated_at: changed ? null : existing?.generated_at ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  const { data: savedSegments, error: saveError } = await supabase
    .from('hebrew_audio_segments')
    .upsert(rows, { onConflict: 'track_id,sort_order' })
    .select('id,sort_order,label,status,audio_path');

  if (saveError) throw new Error(`Could not save Hebrew audio segments: ${saveError.message}`);

  return {
    ok: true,
    tool: 'prepare_hebrew_audio_track',
    trackId: track.id,
    verseReference,
    trackTitle,
    status: track.status,
    isPublished: track.is_published,
    segmentCount: arrayValue(savedSegments).length,
    removedObsoleteSegments: obsoleteIds.length,
    nextAction: 'Call generate_next_hebrew_audio_segment repeatedly until get_hebrew_audio_status reports ready: true.',
  };
}

export async function getHebrewAudioStatus(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const fetchFn = options.fetchFn ?? fetch;
  const track = await loadTrack(supabase, input);

  const { data: segments, error } = await supabase
    .from('hebrew_audio_segments')
    .select('id,sort_order,segment_type,label,status,audio_path,duration_seconds,checksum,generation_model,voice_profile,error_information,generated_at,updated_at')
    .eq('track_id', track.id)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load Hebrew audio segments: ${error.message}`);

  const rows = arrayValue(segments);
  const readyCount = rows.filter((segment) => segment.status === 'ready').length;
  const failedCount = rows.filter((segment) => segment.status === 'failed').length;
  const generatingCount = rows.filter((segment) => segment.status === 'generating').length;
  const pendingCount = rows.length - readyCount - failedCount - generatingCount;

  const missingMetadata = rows
    .filter((segment) => (
      segment.status !== 'ready'
      || !text(segment.audio_path)
      || !(Number(segment.duration_seconds) > 0)
      || !text(segment.checksum)
      || !text(segment.generation_model)
      || !text(segment.voice_profile)
      || !segment.generated_at
    ))
    .map((segment) => ({
      sortOrder: segment.sort_order,
      label: segment.label,
      status: segment.status,
    }));

  const verifyStreams = Boolean(input.verify_streams ?? input.verifyStreams);
  const streamChecks = [];

  if (verifyStreams) {
    for (const segment of rows.filter((entry) => entry.status === 'ready' && text(entry.audio_path))) {
      const url = publicAudioUrl(segment.audio_path, env);
      try {
        const response = await fetchFn(url, { headers: { Range: 'bytes=0-2' } });
        const contentType = response.headers?.get?.('content-type') || '';
        streamChecks.push({
          sortOrder: segment.sort_order,
          ok: (response.status === 200 || response.status === 206) && contentType.includes('audio'),
          status: response.status,
          contentType,
        });
      } catch (streamError) {
        streamChecks.push({
          sortOrder: segment.sort_order,
          ok: false,
          status: null,
          error: streamError.message || String(streamError),
        });
      }
    }
  }

  const streamsReady = !verifyStreams || (streamChecks.length === rows.length && streamChecks.every((check) => check.ok));
  const ready = (
    track.status === 'ready'
    && Boolean(track.is_published)
    && rows.length > 0
    && readyCount === rows.length
    && missingMetadata.length === 0
    && streamsReady
  );

  return {
    ok: true,
    tool: 'get_hebrew_audio_status',
    trackId: track.id,
    verseReference: track.verse_reference,
    trackTitle: track.track_title,
    trackStatus: track.status,
    isPublished: Boolean(track.is_published),
    ready,
    segmentCount: rows.length,
    readyCount,
    pendingCount,
    generatingCount,
    failedCount,
    totalDurationSeconds: Number(track.total_duration_seconds) || rows.reduce((sum, segment) => sum + (Number(segment.duration_seconds) || 0), 0),
    missingMetadata,
    streamChecks,
    segments: rows.map((segment) => ({
      sortOrder: segment.sort_order,
      label: segment.label,
      status: segment.status,
      audioPath: segment.audio_path,
      durationSeconds: Number(segment.duration_seconds) || null,
      model: segment.generation_model,
      voice: segment.voice_profile,
      generatedAt: segment.generated_at,
      error: segment.error_information,
    })),
  };
}

export async function generateNextHebrewAudioSegment(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const verseReference = text(input.verse_reference ?? input.verseReference);
  const trackId = text(input.track_id ?? input.trackId);
  if (!verseReference && !trackId) throw new Error('track_id or verse_reference is required.');

  const adminKey = text(env.HEBREW_AUDIO_ADMIN_KEY);
  if (!adminKey) throw new Error('Missing HEBREW_AUDIO_ADMIN_KEY.');

  const response = await fetchFn(audioApiUrl(env), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hebrew-admin-key': adminKey,
    },
    body: JSON.stringify({
      operation: 'generate-next',
      ...(verseReference ? { verseReference } : {}),
      ...(trackId ? { trackId } : {}),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || response.statusText || 'Unknown audio generation error.';
    throw new Error(`Hebrew audio generation failed (${response.status}): ${message}`);
  }

  const status = await getHebrewAudioStatus(
    {
      ...(verseReference ? { verse_reference: verseReference } : {}),
      ...(trackId ? { track_id: trackId } : {}),
      verify_streams: false,
    },
    options,
  );

  return {
    ok: true,
    tool: 'generate_next_hebrew_audio_segment',
    generation: payload,
    ...status,
    nextAction: status.ready
      ? 'Audio is complete. Run one final get_hebrew_audio_status call with verify_streams: true.'
      : 'Call generate_next_hebrew_audio_segment again for the same verse.',
  };
}
