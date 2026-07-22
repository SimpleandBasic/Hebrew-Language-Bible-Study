const SUPABASE_AUDIO_BASE = "https://cmryhxnhnltrewvduico.supabase.co/storage/v1/object/public/hebrew-media/";

function copyHeader(upstream, response, name) {
  const value = upstream.headers.get(name);
  if (value) response.setHeader(name, value);
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Range");
    return response.status(204).end();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD, OPTIONS");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const rawPath = Array.isArray(request.query.path) ? request.query.path[0] : request.query.path;
  const audioPath = String(rawPath || "").trim();

  if (
    !audioPath.startsWith("audio/genesis/") ||
    !audioPath.endsWith(".mp3") ||
    audioPath.includes("..") ||
    audioPath.includes("\\")
  ) {
    return response.status(400).json({ error: "Invalid Hebrew audio path." });
  }

  const safePath = audioPath.split("/").map(encodeURIComponent).join("/");
  const upstreamUrl = `${SUPABASE_AUDIO_BASE}${safePath}`;
  const upstreamHeaders = {};
  if (request.headers.range) upstreamHeaders.Range = request.headers.range;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "follow",
    });

    response.status(upstream.status);
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    response.setHeader("Cache-Control", upstream.headers.get("cache-control") || "public, max-age=86400");
    response.setHeader("X-Hebrew-Audio-Source", "supabase-proxy");

    for (const name of [
      "content-type",
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ]) {
      copyHeader(upstream, response, name);
    }

    if (request.method === "HEAD") return response.end();

    const body = Buffer.from(await upstream.arrayBuffer());
    return response.end(body);
  } catch (error) {
    console.error("Hebrew audio stream failed", {
      audioPath,
      message: error instanceof Error ? error.message : String(error),
    });
    return response.status(502).json({ error: "The Hebrew audio stream could not be loaded." });
  }
}
