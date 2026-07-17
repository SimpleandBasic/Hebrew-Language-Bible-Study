import crypto from "node:crypto";

const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "cedar";
const DEFAULT_INSTRUCTIONS = "Speak warmly, clearly, reverently, and naturally. Pronounce Hebrew carefully. Do not add stage directions or commentary that is not present in the input.";

function json(response, status, payload) {
  response.status(status).json(payload);
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  if (Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString("utf8") || "{}");
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function requireEnvironment() {
  const required = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SUPABASE_URL: process.env.HEBREW_SUPABASE_URL || process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    HEBREW_AUDIO_ADMIN_KEY: process.env.HEBREW_AUDIO_ADMIN_KEY,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing server environment: ${missing.join(", ")}`);
}

function supabaseUrl() { return process.env.HEBREW_SUPABASE_URL || process.env.SUPABASE_URL; }
function serviceRoleKey() { return process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; }

function serviceHeaders(extra = {}) {
  return {
    apikey: serviceRoleKey(),
    Authorization: `Bearer ${serviceRoleKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl().replace(/\/$/, "")}${path}`, {
    ...options,
    headers: serviceHeaders(options.headers || {}),
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const message = body?.message || body?.error || body?.hint || String(body || response.statusText);
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return body;
}

function checksumFor(segment, model, voice, instructions, speechSettings) {
  const payload = JSON.stringify({
    spokenText: String(segment.spoken_text || "").trim(),
    model,
    voice,
    instructions,
    speechSettings,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function segmentAudioPath(track, segment) {
  const reference = String(track.verse_reference || "Genesis 1:14");
  const match = reference.match(/Genesis\s+(\d+):(\d+)/i);
  const chapter = match?.[1] || "1";
  const verse = match?.[2] || "14";
  const order = String(segment.sort_order).padStart(3, "0");
  const type = String(segment.segment_type || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `audio/genesis/${chapter}/${verse}/${track.script_version || "v1"}/${order}-${type}.mp3`;
}

function estimateMp3DurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  let offset = 0;
  if (buffer.slice(0, 3).toString("ascii") === "ID3" && buffer.length >= 10) {
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    offset = 10 + size;
  }
  const bitrates = {
    "1-1": [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
    "1-2": [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
    "1-3": [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
    "2-1": [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
    "2-2": [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
    "2-3": [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
  };
  for (let index = offset; index < Math.min(buffer.length - 4, offset + 65536); index += 1) {
    if (buffer[index] !== 0xff || (buffer[index + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (buffer[index + 1] >> 3) & 0x03;
    const layerBits = (buffer[index + 1] >> 1) & 0x03;
    const bitrateIndex = (buffer[index + 2] >> 4) & 0x0f;
    const version = versionBits === 3 ? "1" : versionBits === 2 || versionBits === 0 ? "2" : null;
    const layer = layerBits === 3 ? "1" : layerBits === 2 ? "2" : layerBits === 1 ? "3" : null;
    const bitrate = version && layer ? bitrates[`${version}-${layer}`]?.[bitrateIndex] : 0;
    if (!bitrate) continue;
    const audioBytes = buffer.length - index;
    return Math.round((audioBytes * 8) / (bitrate * 1000) * 100) / 100;
  }
  return null;
}

async function findTrack(body) {
  if (body.trackId) {
    const rows = await supabaseRequest(`/rest/v1/hebrew_audio_tracks?select=*&id=eq.${encodeURIComponent(body.trackId)}&limit=1`);
    return rows?.[0] || null;
  }
  const reference = String(body.verseReference || "Genesis 1:14");
  const rows = await supabaseRequest(`/rest/v1/hebrew_audio_tracks?select=*&verse_reference=eq.${encodeURIComponent(reference)}&limit=1`);
  return rows?.[0] || null;
}

async function patchRow(table, id, payload) {
  return supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
  });
}

async function uploadAudio(path, audioBuffer) {
  const response = await fetch(`${supabaseUrl().replace(/\/$/, "")}/storage/v1/object/hebrew-media/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey(),
      Authorization: `Bearer ${serviceRoleKey()}`,
      "Content-Type": "audio/mpeg",
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: audioBuffer,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Storage upload ${response.status}: ${body}`);
  }
}

async function generateSpeech(input, model, voice, instructions, speechSettings) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      instructions,
      response_format: "mp3",
      speed: Number(speechSettings.speed) || 1,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI speech request failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function updateTrackCompletion(track) {
  const segments = await supabaseRequest(`/rest/v1/hebrew_audio_segments?select=id,status,duration_seconds&track_id=eq.${encodeURIComponent(track.id)}&order=sort_order.asc`);
  const remaining = segments.filter((segment) => segment.status !== "ready").length;
  const duration = segments.reduce((sum, segment) => sum + (Number(segment.duration_seconds) || 0), 0);
  const ready = remaining === 0 && segments.length > 0;
  await patchRow("hebrew_audio_tracks", track.id, {
    status: ready ? "ready" : "generating",
    total_duration_seconds: duration || null,
    is_published: ready,
    published_at: ready ? (track.published_at || new Date().toISOString()) : null,
  });
  return { remaining, ready, duration };
}

export default async function hebrewAudio(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") return json(response, 204, {});
  if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." });

  try {
    requireEnvironment();
    const provided = String(request.headers["x-hebrew-admin-key"] || "");
    const expected = String(process.env.HEBREW_AUDIO_ADMIN_KEY || "");
    const valid = provided.length === expected.length && provided.length > 0 && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!valid) return json(response, 401, { error: "Invalid admin credential." });

    const body = await readJsonBody(request);
    if (body.operation !== "generate-next") return json(response, 400, { error: "Supported operation: generate-next." });

    const track = await findTrack(body);
    if (!track) return json(response, 404, { error: "Audio track not found." });

    const segments = await supabaseRequest(`/rest/v1/hebrew_audio_segments?select=*&track_id=eq.${encodeURIComponent(track.id)}&order=sort_order.asc`);
    if (!segments.length) return json(response, 409, { error: "Track has no audio segments." });

    const model = process.env.HEBREW_TTS_MODEL || DEFAULT_MODEL;
    const voice = process.env.HEBREW_TTS_VOICE || DEFAULT_VOICE;
    const baseInstructions = process.env.HEBREW_TTS_INSTRUCTIONS || DEFAULT_INSTRUCTIONS;

    let target = null;
    for (const segment of segments) {
      const speechSettings = segment.speech_settings || {};
      const instructions = segment.voice_instructions || baseInstructions;
      const checksum = checksumFor(segment, model, segment.voice_profile || voice, instructions, speechSettings);
      if (segment.status !== "ready" || !segment.audio_path || segment.checksum !== checksum) {
        target = { segment, checksum, instructions, speechSettings };
        break;
      }
    }

    if (!target) {
      const completion = await updateTrackCompletion(track);
      return json(response, 200, { trackId: track.id, generated: false, reusedAll: true, ...completion });
    }

    const { segment, checksum, instructions, speechSettings } = target;
    if (!String(segment.spoken_text || "").trim()) return json(response, 409, { error: `Segment ${segment.id} has no spoken text.` });

    await patchRow("hebrew_audio_tracks", track.id, { status: "generating" });
    await patchRow("hebrew_audio_segments", segment.id, {
      status: "generating",
      error_information: null,
      generation_model: model,
      voice_profile: segment.voice_profile || voice,
      voice_instructions: instructions,
      checksum,
    });

    try {
      const audioBuffer = await generateSpeech(segment.spoken_text, model, segment.voice_profile || voice, instructions, speechSettings);
      const audioPath = segmentAudioPath(track, segment);
      await uploadAudio(audioPath, audioBuffer);
      const duration = estimateMp3DurationSeconds(audioBuffer);
      await patchRow("hebrew_audio_segments", segment.id, {
        status: "ready",
        audio_path: audioPath,
        duration_seconds: duration,
        checksum,
        generation_model: model,
        voice_profile: segment.voice_profile || voice,
        voice_instructions: instructions,
        error_information: null,
        generated_at: new Date().toISOString(),
      });
      const completion = await updateTrackCompletion(track);
      return json(response, 200, {
        trackId: track.id,
        generated: true,
        segmentId: segment.id,
        segmentLabel: segment.label,
        audioPath,
        durationSeconds: duration,
        ...completion,
      });
    } catch (error) {
      await patchRow("hebrew_audio_segments", segment.id, {
        status: "failed",
        checksum,
        error_information: String(error.message || error).slice(0, 2000),
      }).catch(() => null);
      await patchRow("hebrew_audio_tracks", track.id, { status: "failed" }).catch(() => null);
      throw error;
    }
  } catch (error) {
    console.error("Hebrew audio generation failed.", { message: error.message });
    return json(response, 500, { error: error.message || "Audio generation failed." });
  }
}

export const __test = { checksumFor, estimateMp3DurationSeconds, segmentAudioPath };
