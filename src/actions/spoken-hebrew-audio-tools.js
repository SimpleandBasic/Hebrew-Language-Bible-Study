import { getSupabaseAdminClient } from '../supabase-client.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function audioApiUrl(env = process.env) {
  const explicit = text(env.HEBREW_AUDIO_API_URL);
  if (explicit) return explicit;
  const host = text(env.VERCEL_PROJECT_PRODUCTION_URL)
    || text(env.VERCEL_URL)
    || 'hebrew-developer-mcp.vercel.app';
  return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/hebrew-audio`;
}

async function loadSettings(supabase) {
  const { data, error } = await supabase
    .from('hebrew_spoken_settings')
    .select('user_id,current_lesson_id')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load spoken Hebrew settings: ${error.message}`);
  if (!data) throw new Error('Spoken Hebrew settings have not been initialized.');
  return data;
}

async function loadLesson(supabase, input, settings) {
  const lessonId = text(input.lesson_id ?? input.lessonId) || settings.current_lesson_id;
  const slug = text(input.slug);
  let query = supabase
    .from('hebrew_spoken_lessons')
    .select('id,slug,title')
    .limit(1);
  query = slug ? query.eq('slug', slug) : query.eq('id', lessonId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load spoken Hebrew lesson: ${error.message}`);
  if (!data) throw new Error('Spoken Hebrew lesson was not found.');
  return data;
}

export async function generateNextSpokenHebrewAudioSegment(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const adminKey = text(env.HEBREW_AUDIO_ADMIN_KEY);
  if (!adminKey) throw new Error('Missing HEBREW_AUDIO_ADMIN_KEY.');

  const supabase = options.supabase ?? getSupabaseAdminClient(env);
  const settings = await loadSettings(supabase);
  const lesson = await loadLesson(supabase, input, settings);

  const response = await fetchFn(audioApiUrl(env), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hebrew-admin-key': adminKey,
    },
    body: JSON.stringify({
      operation: 'generate-spoken-next',
      lessonId: lesson.id,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Spoken Hebrew audio request failed (${response.status}).`);
  }

  return {
    ok: true,
    tool: 'generate_next_spoken_hebrew_audio_segment',
    lesson: { id: lesson.id, slug: lesson.slug, title: lesson.title },
    ...payload,
  };
}
