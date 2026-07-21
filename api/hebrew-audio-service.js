import crypto from "node:crypto";
import hebrewAudio from "./hebrew-audio.js";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function hebrewAudioService(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const authorization = String(request.headers.authorization || "");
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const serviceRoleKey = process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!safeEqual(bearer, serviceRoleKey)) {
    return response.status(401).json({ error: "Invalid Supabase service credential." });
  }

  const adminKey = process.env.HEBREW_AUDIO_ADMIN_KEY || "";
  if (!adminKey) {
    return response.status(500).json({ error: "HEBREW_AUDIO_ADMIN_KEY is not configured." });
  }

  request.headers["x-hebrew-admin-key"] = adminKey;
  return hebrewAudio(request, response);
}
