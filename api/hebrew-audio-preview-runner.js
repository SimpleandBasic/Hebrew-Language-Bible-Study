import hebrewAudio from "./hebrew-audio.js";

export default async function previewRunner(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method not allowed." });
  }

  const isExpectedPreview = process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "feature/hebrew-audio-library-v1";

  if (!isExpectedPreview) {
    return response.status(404).json({ error: "Not found." });
  }

  let statusCode = 200;
  let payload = null;
  const internalResponse = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  await hebrewAudio({
    method: "POST",
    headers: { "x-hebrew-admin-key": process.env.HEBREW_AUDIO_ADMIN_KEY || "" },
    body: { operation: "generate-next", verseReference: "Genesis 1:14" },
  }, internalResponse);

  return response.status(statusCode).json(payload);
}
