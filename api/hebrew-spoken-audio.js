import crypto from 'node:crypto';

const DEFAULT_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_VOICE = 'cedar';
const DEFAULT_INSTRUCTIONS = 'Speak clearly and naturally. For Hebrew text, use careful Modern Israeli Hebrew pronunciation. Do not add words that are not in the input.';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function json(res, status, body) {
  res.status(status).json(body);
}

function requiredEnv() {
  const values = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SUPABASE_URL: process.env.HEBREW_SUPABASE_URL || process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    HEBREW_AUDIO_ADMIN_KEY: process.env.HEBREW_AUDIO_ADMIN_KEY,
  };
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing server environment: ${missing.join(', ')}`);
}

function supabaseUrl() {
  return (process.env.HEBREW_SUPABASE_URL || process.env.SUPABASE_URL).replace(/\/$/, '');
}

function serviceKey() {
  return process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function serviceHeaders(extra = {}) {
  const key = serviceKey();
  return {
    apikey: key,
    ...(String(key).startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    ...extra,
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl()}${path}`, {
    ...options,
    headers: serviceHeaders(options.headers || {}),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const message = body?.message || body?.error || body?.hint || String(body || response.statusText);
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return body;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function validAdmin(req) {
  const provided = String(req.headers['x-hebrew-admin-key'] || '');
  const expected = String(process.env.HEBREW_AUDIO_ADMIN_KEY || '');
  return provided.length > 0
    && provided.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function loadLesson(body) {
  const id = text(body.lessonId || body.lesson_id);
  const slug = text(body.slug);
  if (!id && !slug) throw new Error('lessonId or slug is required.');
  const filter = id ? `id=eq.${encodeURIComponent(id)}` : `slug=eq.${encodeURIComponent(slug)}`;
  const rows = await supabaseRequest(`/rest/v1/hebrew_spoken_lessons?select=*&${filter}&limit=1`);
  if (!rows?.[0]) throw new Error('Spoken Hebrew lesson not found.');
  return rows[0];
}

function checksum(segment, model, voice, instructions, speed) {
  return crypto.createHash('sha256').update(JSON.stringify({
    spokenText: segment.spoken_text,
    model,
    voice,
    instructions,
    speed,
  })).digest('hex');
}

function estimateMp3DurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  let offset = 0;
  if (buffer.slice(0, 3).toString('ascii') === 'ID3' && buffer.length >= 10) {
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    offset = 10 + size;
  }
  const bitrates = {
    '1-1': [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
    '1-2': [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
    '1-3': [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
    '2-1': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
    '2-2': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
    '2-3': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
  };
  for (let i = offset; i < Math.min(buffer.length - 4, offset + 65536); i += 1) {
    if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (buffer[i + 1] >> 3) & 0x03;
    const layerBits = (buffer[i + 1] >> 1) & 0x03;
    const bitrateIndex = (buffer[i + 2] >> 4) & 0x0f;
    const version = versionBits === 3 ? '1' : (versionBits === 2 || versionBits === 0 ? '2' : null);
    const layer = layerBits === 3 ? '1' : (layerBits === 2 ? '2' : (layerBits === 1 ? '3' : null));
    const bitrate = version && layer ? bitrates[`${version}-${layer}`]?.[bitrateIndex] : 0;
    if (!bitrate) continue;
    return Math.round((((buffer.length - i) * 8) / (bitrate * 1000)) * 100) / 100;
  }
  return null;
}

async function generateSpeech(segment) {
  const model = text(process.env.HEBREW_TTS_MODEL) || DEFAULT_MODEL;
  const voice = text(segment.voice_profile) || text(process.env.HEBREW_TTS_VOICE) || DEFAULT_VOICE;
  const speed = Number(segment.speech_settings?.speed) || 1;
  const instructions = [DEFAULT_INSTRUCTIONS, text(segment.voice_instructions)].filter(Boolean).join(' ');
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, voice, input: segment.spoken_text, instructions, response_format: 'mp3', speed }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI speech request failed (${response.status}).`);
  }
  return { buffer: Buffer.from(await response.arrayBuffer()), model, voice, speed, instructions };
}

async function uploadAudio(path, buffer) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${supabaseUrl()}/storage/v1/object/hebrew-media/${encoded}`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'audio/mpeg',
      'x-upsert': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }),
    body: buffer,
  });
  if (!response.ok) throw new Error(`Storage upload failed (${response.status}): ${await response.text()}`);
}

async function patch(table, id, payload) {
  return supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
  });
}

async function updateLessonState(lesson) {
  const segments = await supabaseRequest(`/rest/v1/hebrew_spoken_segments?select=segment_type,status,duration_seconds,pause_after_ms&lesson_id=eq.${encodeURIComponent(lesson.id)}&order=sort_order.asc`);
  const playable = segments.filter((segment) => segment.segment_type !== 'silence');
  const ready = playable.length > 0 && playable.every((segment) => segment.status === 'ready');
  const duration = segments.reduce((sum, segment) => sum + (Number(segment.duration_seconds) || 0) + ((Number(segment.pause_after_ms) || 0) / 1000), 0);
  await patch('hebrew_spoken_lessons', lesson.id, {
    audio_status: ready ? 'ready' : 'generating',
    total_duration_seconds: duration || null,
  });
  return { ready, remaining: playable.filter((segment) => segment.status !== 'ready').length, duration };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    requiredEnv();
    if (!validAdmin(req)) return json(res, 401, { error: 'Invalid admin credential.' });
    const body = await readBody(req);
    if (body.operation !== 'generate-next') return json(res, 400, { error: 'Supported operation: generate-next.' });
    const lesson = await loadLesson(body);
    const segments = await supabaseRequest(`/rest/v1/hebrew_spoken_segments?select=*&lesson_id=eq.${encodeURIComponent(lesson.id)}&order=sort_order.asc`);
    const target = segments.find((segment) => segment.segment_type !== 'silence' && segment.status !== 'ready');
    if (!target) {
      const state = await updateLessonState(lesson);
      return json(res, 200, { lessonId: lesson.id, lessonSlug: lesson.slug, generated: false, ...state });
    }

    await patch('hebrew_spoken_segments', target.id, { status: 'generating', error_information: null });
    try {
      const speech = await generateSpeech(target);
      const type = String(target.segment_type || 'segment').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const order = String(target.sort_order).padStart(3, '0');
      const audioPath = `audio/spoken/${lesson.slug}/${lesson.script_version || 'v1'}/${order}-${type}.mp3`;
      await uploadAudio(audioPath, speech.buffer);
      const duration = estimateMp3DurationSeconds(speech.buffer);
      await patch('hebrew_spoken_segments', target.id, {
        status: 'ready',
        generation_model: speech.model,
        audio_path: audioPath,
        duration_seconds: duration,
        checksum: checksum(target, speech.model, speech.voice, speech.instructions, speech.speed),
        generated_at: new Date().toISOString(),
        error_information: null,
      });
      const state = await updateLessonState(lesson);
      return json(res, 200, {
        lessonId: lesson.id,
        lessonSlug: lesson.slug,
        generated: true,
        segment: { id: target.id, sortOrder: target.sort_order, label: target.label, audioPath, durationSeconds: duration },
        ...state,
      });
    } catch (error) {
      await patch('hebrew_spoken_segments', target.id, { status: 'failed', error_information: error.message || String(error) }).catch(() => null);
      throw error;
    }
  } catch (error) {
    console.error('Spoken Hebrew audio generation failed.', error);
    return json(res, 500, { error: error.message || 'Spoken Hebrew audio generation failed.' });
  }
}
