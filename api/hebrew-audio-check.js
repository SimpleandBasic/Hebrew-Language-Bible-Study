const SUPABASE_AUDIO_BASE = "https://cmryhxnhnltrewvduico.supabase.co/storage/v1/object/public/hebrew-media/";

function findMpegFrame(bytes) {
  for (let index = 0; index < bytes.length - 4; index += 1) {
    if (bytes[index] !== 0xff || (bytes[index + 1] & 0xe0) !== 0xe0) continue;

    const versionBits = (bytes[index + 1] >> 3) & 0x03;
    const layerBits = (bytes[index + 1] >> 1) & 0x03;
    const bitrateIndex = (bytes[index + 2] >> 4) & 0x0f;
    const sampleRateIndex = (bytes[index + 2] >> 2) & 0x03;

    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;

    return {
      offset: index,
      headerHex: Array.from(bytes.slice(index, index + 4)).map((value) => value.toString(16).padStart(2, "0")).join(""),
      versionBits,
      layerBits,
      bitrateIndex,
      sampleRateIndex,
      channelMode: (bytes[index + 3] >> 6) & 0x03,
    };
  }
  return null;
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });

  const rawPath = Array.isArray(request.query.path) ? request.query.path[0] : request.query.path;
  const audioPath = String(rawPath || "audio/genesis/1/21/v2-supabase/010-opening.mp3").trim();

  if (!audioPath.startsWith("audio/genesis/") || !audioPath.endsWith(".mp3") || audioPath.includes("..") || audioPath.includes("\\")) {
    return response.status(400).json({ error: "Invalid Hebrew audio path." });
  }

  const safePath = audioPath.split("/").map(encodeURIComponent).join("/");
  const upstream = await fetch(`${SUPABASE_AUDIO_BASE}${safePath}`, {
    headers: { Range: "bytes=0-65535", Accept: "audio/mpeg" },
  });

  const buffer = new Uint8Array(await upstream.arrayBuffer());
  const firstBytesHex = Array.from(buffer.slice(0, 24)).map((value) => value.toString(16).padStart(2, "0")).join("");
  const hasId3 = buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  const frame = findMpegFrame(buffer);

  response.setHeader("Cache-Control", "no-store");
  return response.status(upstream.ok ? 200 : 502).json({
    ok: upstream.ok && Boolean(frame),
    audioPath,
    upstreamStatus: upstream.status,
    contentType: upstream.headers.get("content-type"),
    contentRange: upstream.headers.get("content-range"),
    contentLength: upstream.headers.get("content-length"),
    bytesInspected: buffer.length,
    hasId3,
    firstBytesHex,
    mpegFrame: frame,
  });
}
