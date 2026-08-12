import { getSupabaseAdminClient } from '../supabase-client.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const intValue = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function publicAudioUrl(path, env = process.env) {
  const supabaseUrl = text(env.HEBREW_SUPABASE_URL || env.SUPABASE_URL).replace(/\/$/, '');
  if (!supabaseUrl || !path) return '';
  const encoded = String(path).split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/public/hebrew-media/${encoded}`;
}

function spokenAudioApiUrl(env = process.env) {
  const explicit = text(env.HEBREW_SPOKEN_AUDIO_API_URL);
  if (explicit) return explicit;
  const host = text(env.VERCEL_PROJECT_PRODUCTION_URL)
    || text(env.VERCEL_URL)
    || 'hebrew-developer-mcp.vercel.app';
  return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/hebrew-spoken-audio`;
}

async function loadSettings(supabase, input = {}) {
  const requestedUserId = text(input.user_id ?? input.userId);
  let query = supabase.from('hebrew_spoken_settings').select('*').limit(1);
  if (requestedUserId) query = query.eq('user_id', requestedUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load spoken Hebrew settings: ${error.message}`);
  if (!data) throw new Error('Spoken Hebrew settings have not been initialized for this user.');
  return data;
}

async function loadLesson(supabase, input = {}, settings = null) {
  const lessonId = text(input.lesson_id ?? input.lessonId);
  const slug = text(input.slug ?? input.lesson_slug ?? input.lessonSlug);
  const fallbackId = settings?.current_lesson_id || null;
  if (!lessonId && !slug && !fallbackId) throw new Error('lesson_id, slug, or an initialized current lesson is required.');

  let query = supabase
    .from('hebrew_spoken_lessons')
    .select('id,track_id,slug,title,topic,summary,level,lesson_order,objectives,estimated_minutes,script_version,status,audio_status,total_duration_seconds,metadata,created_at,updated_at')
    .limit(1);
  if (lessonId || fallbackId) query = query.eq('id', lessonId || fallbackId);
  else query = query.eq('slug', slug);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load spoken Hebrew lesson: ${error.message}`);
  if (!data) throw new Error('Spoken Hebrew lesson was not found.');
  return data;
}

async function loadTrack(supabase, trackId) {
  if (!trackId) return null;
  const { data, error } = await supabase
    .from('hebrew_spoken_tracks')
    .select('id,slug,title,description,language_variety,level,status,sort_order,metadata')
    .eq('id', trackId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load spoken Hebrew track: ${error.message}`);
  return data || null;
}

async function loadProgress(supabase, userId, lessonId) {
  const { data, error } = await supabase
    .from('hebrew_spoken_lesson_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load spoken Hebrew progress: ${error.message}`);
  return data || null;
}

function segmentResult(segment, env) {
  return {
    id: segment.id,
    sortOrder: segment.sort_order,
    type: segment.segment_type,
    label: segment.label,
    spokenText: segment.spoken_text,
    displayText: segment.display_text,
    pauseAfterMs: segment.pause_after_ms,
    voice: segment.voice_profile,
    voiceInstructions: segment.voice_instructions,
    speechSettings: segment.speech_settings,
    status: segment.status,
    durationSeconds: numberValue(segment.duration_seconds, null),
    audioPath: segment.audio_path,
    audioUrl: publicAudioUrl(segment.audio_path, env),
    error: segment.error_information,
  };
}

export async function getSpokenHebrewLearningState(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const lesson = await loadLesson(supabase, {}, settings);
  const [track, progress] = await Promise.all([
    loadTrack(supabase, settings.track_id || lesson.track_id),
    loadProgress(supabase, settings.user_id, lesson.id),
  ]);

  const { data: lessonRows, error: lessonsError } = await supabase
    .from('hebrew_spoken_lessons')
    .select('id,slug,title,topic,lesson_order,status,audio_status')
    .eq('track_id', lesson.track_id)
    .order('lesson_order', { ascending: true });
  if (lessonsError) throw new Error(`Could not load spoken Hebrew curriculum: ${lessonsError.message}`);

  const currentIndex = Array.isArray(lessonRows) ? lessonRows.findIndex((row) => row.id === lesson.id) : -1;
  const nextLesson = currentIndex >= 0 ? lessonRows[currentIndex + 1] || null : null;

  return {
    ok: true,
    tool: 'get_spoken_hebrew_learning_state',
    learningGoal: settings.learning_goal,
    audioFirst: Boolean(settings.audio_first),
    preferredMode: settings.preferred_mode,
    preferredTtsProvider: settings.preferred_tts_provider,
    preferredVoice: settings.preferred_voice,
    targetSessionMinutes: settings.target_session_minutes,
    translationSupport: settings.translation_support,
    track,
    currentLesson: lesson,
    progress: progress ? {
      status: progress.status,
      masteryScore: numberValue(progress.mastery_score, 0),
      listenCount: progress.listen_count,
      practiceSessionCount: progress.practice_session_count,
      currentItemOrder: progress.current_item_order,
      lastHeardAt: progress.last_heard_at,
      lastPracticedAt: progress.last_practiced_at,
      nextReviewAt: progress.next_review_at,
      notes: progress.notes,
    } : null,
    nextLesson,
    curriculum: lessonRows || [],
  };
}

export async function listSpokenHebrewLessons(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const trackId = text(input.track_id ?? input.trackId) || settings.track_id;
  const { data, error } = await supabase
    .from('hebrew_spoken_lessons')
    .select('id,slug,title,topic,summary,level,lesson_order,objectives,estimated_minutes,status,audio_status,total_duration_seconds,updated_at')
    .eq('track_id', trackId)
    .order('lesson_order', { ascending: true });
  if (error) throw new Error(`Could not list spoken Hebrew lessons: ${error.message}`);
  return { ok: true, tool: 'list_spoken_hebrew_lessons', lessons: data || [] };
}

export async function getSpokenHebrewLesson(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const lesson = await loadLesson(supabase, input, settings);
  const [track, progress, itemsResult, segmentsResult] = await Promise.all([
    loadTrack(supabase, lesson.track_id),
    loadProgress(supabase, settings.user_id, lesson.id),
    supabase
      .from('hebrew_spoken_items')
      .select('id,sort_order,item_type,hebrew_text,transliteration,english_text,usage_note,speaker_context,tags,metadata')
      .eq('lesson_id', lesson.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('hebrew_spoken_segments')
      .select('id,item_id,sort_order,segment_type,label,spoken_text,display_text,voice_profile,voice_instructions,speech_settings,pause_after_ms,generation_model,audio_path,duration_seconds,checksum,status,error_information,generated_at,updated_at')
      .eq('lesson_id', lesson.id)
      .order('sort_order', { ascending: true }),
  ]);
  if (itemsResult.error) throw new Error(`Could not load spoken Hebrew lesson items: ${itemsResult.error.message}`);
  if (segmentsResult.error) throw new Error(`Could not load spoken Hebrew lesson audio script: ${segmentsResult.error.message}`);

  const segments = (segmentsResult.data || []).map((segment) => segmentResult(segment, env));
  const playable = segments.filter((segment) => segment.type !== 'silence');
  const readyCount = playable.filter((segment) => segment.status === 'ready' && segment.audioUrl).length;

  return {
    ok: true,
    tool: 'get_spoken_hebrew_lesson',
    track,
    lesson,
    progress,
    items: itemsResult.data || [],
    segments,
    audio: {
      ready: playable.length > 0 && readyCount === playable.length,
      playableSegmentCount: playable.length,
      readySegmentCount: readyCount,
      totalDurationSeconds: numberValue(lesson.total_duration_seconds, null),
    },
  };
}

export async function setSpokenHebrewCurrentLesson(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const lesson = await loadLesson(supabase, input, settings);
  const now = new Date().toISOString();

  const { error: settingsError } = await supabase
    .from('hebrew_spoken_settings')
    .update({
      track_id: lesson.track_id,
      current_lesson_id: lesson.id,
      current_item_order: Math.max(1, intValue(input.current_item_order ?? input.currentItemOrder, 1)),
      updated_at: now,
    })
    .eq('user_id', settings.user_id);
  if (settingsError) throw new Error(`Could not update current spoken Hebrew lesson: ${settingsError.message}`);

  const { error: progressError } = await supabase
    .from('hebrew_spoken_lesson_progress')
    .upsert({
      user_id: settings.user_id,
      lesson_id: lesson.id,
      status: 'learning',
      current_item_order: Math.max(1, intValue(input.current_item_order ?? input.currentItemOrder, 1)),
      updated_at: now,
    }, { onConflict: 'user_id,lesson_id' });
  if (progressError) throw new Error(`Could not initialize spoken Hebrew lesson progress: ${progressError.message}`);

  return {
    ok: true,
    tool: 'set_spoken_hebrew_current_lesson',
    currentLesson: { id: lesson.id, slug: lesson.slug, title: lesson.title, lessonOrder: lesson.lesson_order },
  };
}

function reviewDelayMs(masteryScore) {
  if (masteryScore >= 0.85) return 3 * 24 * 60 * 60 * 1000;
  if (masteryScore >= 0.6) return 24 * 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

export async function recordSpokenHebrewPractice(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const lesson = await loadLesson(supabase, input, settings);
  const existing = await loadProgress(supabase, settings.user_id, lesson.id);
  const completed = Boolean(input.completed);
  const recallAttempts = Math.max(0, intValue(input.recall_attempts ?? input.recallAttempts, 0));
  const recallCorrect = Math.max(0, Math.min(recallAttempts, intValue(input.recall_correct ?? input.recallCorrect, 0)));
  const suppliedMastery = Number(input.mastery_score ?? input.masteryScore);
  const inferredMastery = recallAttempts > 0 ? recallCorrect / recallAttempts : numberValue(existing?.mastery_score, 0);
  const mastery = Number.isFinite(suppliedMastery) ? Math.max(0, Math.min(1, suppliedMastery)) : inferredMastery;
  const now = new Date();
  const nextReviewAt = new Date(now.getTime() + reviewDelayMs(mastery)).toISOString();
  const currentItemOrder = Math.max(1, intValue(input.current_item_order ?? input.currentItemOrder, existing?.current_item_order || 1));
  const mode = text(input.mode) || settings.preferred_mode || 'drive';
  const provider = text(input.playback_provider ?? input.playbackProvider) || settings.preferred_tts_provider || 'openai';

  const { data: session, error: sessionError } = await supabase
    .from('hebrew_spoken_sessions')
    .insert({
      user_id: settings.user_id,
      lesson_id: lesson.id,
      mode,
      playback_provider: provider === 'openai' ? 'openai' : provider,
      started_at: text(input.started_at ?? input.startedAt) || now.toISOString(),
      ended_at: text(input.ended_at ?? input.endedAt) || now.toISOString(),
      completed,
      items_practiced: Math.max(0, intValue(input.items_practiced ?? input.itemsPracticed, 0)),
      recall_attempts: recallAttempts,
      recall_correct: recallCorrect,
      notes: input.notes && typeof input.notes === 'object' && !Array.isArray(input.notes) ? input.notes : {},
    })
    .select('id,started_at,ended_at,completed')
    .single();
  if (sessionError) throw new Error(`Could not record spoken Hebrew practice session: ${sessionError.message}`);

  const progressRow = {
    user_id: settings.user_id,
    lesson_id: lesson.id,
    status: completed ? 'review' : 'learning',
    mastery_score: mastery,
    listen_count: (existing?.listen_count || 0) + 1,
    practice_session_count: (existing?.practice_session_count || 0) + 1,
    current_item_order: currentItemOrder,
    last_heard_at: now.toISOString(),
    last_practiced_at: now.toISOString(),
    next_review_at: nextReviewAt,
    notes: text(input.progress_note ?? input.progressNote) || existing?.notes || '',
    updated_at: now.toISOString(),
  };

  const { error: progressError } = await supabase
    .from('hebrew_spoken_lesson_progress')
    .upsert(progressRow, { onConflict: 'user_id,lesson_id' });
  if (progressError) throw new Error(`Could not update spoken Hebrew progress: ${progressError.message}`);

  const { error: settingsError } = await supabase
    .from('hebrew_spoken_settings')
    .update({ current_lesson_id: lesson.id, current_item_order: currentItemOrder, updated_at: now.toISOString() })
    .eq('user_id', settings.user_id);
  if (settingsError) throw new Error(`Could not update spoken Hebrew resume position: ${settingsError.message}`);

  return {
    ok: true,
    tool: 'record_spoken_hebrew_practice',
    sessionId: session.id,
    lesson: { id: lesson.id, slug: lesson.slug, title: lesson.title },
    completed,
    masteryScore: mastery,
    nextReviewAt,
    currentItemOrder,
  };
}

export async function getSpokenHebrewAudioStatus(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const lesson = await loadLesson(supabase, input, settings);
  const { data, error } = await supabase
    .from('hebrew_spoken_segments')
    .select('id,sort_order,segment_type,label,status,audio_path,duration_seconds,generation_model,voice_profile,error_information,generated_at,pause_after_ms')
    .eq('lesson_id', lesson.id)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`Could not load spoken Hebrew audio status: ${error.message}`);
  const rows = data || [];
  const playable = rows.filter((row) => row.segment_type !== 'silence');
  const readyCount = playable.filter((row) => row.status === 'ready' && text(row.audio_path)).length;
  const failed = playable.filter((row) => row.status === 'failed');
  return {
    ok: true,
    tool: 'get_spoken_hebrew_audio_status',
    lesson: { id: lesson.id, slug: lesson.slug, title: lesson.title, audioStatus: lesson.audio_status },
    ready: playable.length > 0 && readyCount === playable.length && lesson.audio_status === 'ready',
    playableSegmentCount: playable.length,
    readyCount,
    remainingCount: playable.length - readyCount,
    failedCount: failed.length,
    totalDurationSeconds: numberValue(lesson.total_duration_seconds, null),
    segments: rows.map((row) => ({
      sortOrder: row.sort_order,
      type: row.segment_type,
      label: row.label,
      status: row.status,
      durationSeconds: numberValue(row.duration_seconds, null),
      audioUrl: publicAudioUrl(row.audio_path, env),
      model: row.generation_model,
      voice: row.voice_profile,
      error: row.error_information,
    })),
  };
}

export async function generateNextSpokenHebrewAudioSegment(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const adminKey = text(env.HEBREW_AUDIO_ADMIN_KEY);
  if (!adminKey) throw new Error('Missing HEBREW_AUDIO_ADMIN_KEY.');
  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase, input);
  const lesson = await loadLesson(supabase, input, settings);

  const response = await fetchFn(spokenAudioApiUrl(env), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hebrew-admin-key': adminKey,
    },
    body: JSON.stringify({ operation: 'generate-next', lessonId: lesson.id }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Spoken Hebrew audio request failed (${response.status}).`);
  return { ok: true, tool: 'generate_next_spoken_hebrew_audio_segment', ...payload };
}
