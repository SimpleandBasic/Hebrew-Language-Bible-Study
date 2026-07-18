import assert from "node:assert/strict";
import hebrewAudio, { __test } from "../api/hebrew-audio.js";

const { checksumFor, estimateMp3DurationSeconds, segmentAudioPath, serviceAuthHeaders } = __test;
const segment = { spoken_text: "Shalom", sort_order: 10, segment_type: "opening" };
const a = checksumFor(segment, "gpt-4o-mini-tts", "cedar", "Warm", { speed: 1 });
const b = checksumFor(segment, "gpt-4o-mini-tts", "cedar", "Warm", { speed: 1 });
const c = checksumFor({ ...segment, spoken_text: "Shalom!" }, "gpt-4o-mini-tts", "cedar", "Warm", { speed: 1 });
assert.equal(a, b, "unchanged generation inputs must reuse the same checksum");
assert.notEqual(a, c, "changed spoken text must produce a new checksum");
assert.equal(segmentAudioPath({ verse_reference: "Genesis 1:14", script_version: "v1" }, segment), "audio/genesis/1/14/v1/010-opening.mp3");
assert.equal(estimateMp3DurationSeconds(Buffer.from("not an mp3")), null);
assert.deepEqual(serviceAuthHeaders("sb_secret_example"), { apikey: "sb_secret_example" }, "modern Supabase secret keys must not be sent as Bearer tokens");
assert.deepEqual(serviceAuthHeaders("eyJlegacy"), { apikey: "eyJlegacy", Authorization: "Bearer eyJlegacy" }, "legacy JWT service-role keys keep Bearer compatibility");

function mockResponse() {
  return {
    headers: {},
    statusCode: null,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

const methodResponse = mockResponse();
await hebrewAudio({ method: "GET", headers: {} }, methodResponse);
assert.equal(methodResponse.statusCode, 405);
assert.equal(methodResponse.payload.error, "Method not allowed.");

const envNames = ["OPENAI_API_KEY", "HEBREW_SUPABASE_URL", "HEBREW_SUPABASE_SERVICE_ROLE_KEY", "HEBREW_AUDIO_ADMIN_KEY"];
const previousEnvironment = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
Object.assign(process.env, {
  OPENAI_API_KEY: "test-openai-key",
  HEBREW_SUPABASE_URL: "https://example.invalid",
  HEBREW_SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  HEBREW_AUDIO_ADMIN_KEY: "correct-admin-key",
});

try {
  const invalidCredentialResponse = mockResponse();
  await hebrewAudio({
    method: "POST",
    headers: { "x-hebrew-admin-key": "wrong--admin-key" },
    body: { operation: "generate-next" },
  }, invalidCredentialResponse);
  assert.equal(invalidCredentialResponse.statusCode, 401);
  assert.equal(invalidCredentialResponse.payload.error, "Invalid admin credential.");

  const invalidOperationResponse = mockResponse();
  await hebrewAudio({
    method: "POST",
    headers: { "x-hebrew-admin-key": "correct-admin-key" },
    body: { operation: "delete-all" },
  }, invalidOperationResponse);
  assert.equal(invalidOperationResponse.statusCode, 400);
  assert.match(invalidOperationResponse.payload.error, /generate-next/);
} finally {
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

console.log("audio logic, auth-header, and invalid-request tests passed");
