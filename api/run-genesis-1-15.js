import hebrewAudio from "./hebrew-audio.js";

export default async function runGenesis115(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method not allowed." });
  }

  let statusCode = 200;
  let payload = null;
  const internalResponse = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return internalResponse;
    },
    json(value) {
      payload = value;
      return value;
    },
  };

  await hebrewAudio(
    {
      method: "POST",
      headers: { "x-hebrew-admin-key": process.env.HEBREW_AUDIO_ADMIN_KEY || "" },
      body: { operation: "generate-next", verseReference: "Genesis 1:15" },
    },
    internalResponse,
  );

  return response.status(statusCode).json(payload || { error: "No generation response." });
}
