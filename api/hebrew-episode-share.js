import {
  getOrCreateEpisodeShare,
  getSharedEpisode,
  setCommonSecurityHeaders,
  shareUrlFor,
} from "./_lib/hebrewEpisodeShare.js";

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return request.body ? JSON.parse(request.body) : {};
  if (Buffer.isBuffer(request.body)) return request.body.length ? JSON.parse(request.body.toString("utf8")) : {};
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error("Request body is too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(request, response) {
  setCommonSecurityHeaders(response);

  try {
    if (request.method === "POST") {
      const body = await readJson(request);
      const { share, track } = await getOrCreateEpisodeShare(body.trackId);
      return sendJson(response, 200, {
        url: shareUrlFor(request, share),
        title: track.track_title,
        reference: track.verse_reference,
      });
    }

    if (request.method === "GET") {
      const token = String(request.query?.share || request.query?.token || "");
      const episode = await getSharedEpisode(token);
      return sendJson(response, 200, { episode });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error("Hebrew episode share API failed.", error);
    const status = Number(error.status) || (error instanceof SyntaxError ? 400 : 500);
    const message = status >= 500 ? "The shared episode service is temporarily unavailable." : error.message;
    return sendJson(response, status, { error: message });
  }
}
