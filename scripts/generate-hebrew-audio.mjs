const endpoint = process.env.HEBREW_AUDIO_ENDPOINT;
const adminKey = process.env.HEBREW_AUDIO_ADMIN_KEY;
const verseReference = process.env.HEBREW_VERSE_REFERENCE || "Genesis 1:14";

if (!endpoint || !adminKey) {
  console.error("Set HEBREW_AUDIO_ENDPOINT and HEBREW_AUDIO_ADMIN_KEY.");
  process.exit(1);
}

for (let requestNumber = 1; requestNumber <= 30; requestNumber += 1) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hebrew-admin-key": adminKey,
    },
    body: JSON.stringify({ operation: "generate-next", verseReference }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  console.log(JSON.stringify(body));
  if (body.ready || body.remaining === 0) break;
}
