import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };
const generatorUrl = "https://hebrew-developer-mcp.vercel.app/api/hebrew-audio-service";

function safeEqual(left: string, right: string): boolean {
  if (!left || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function referenceOrder(reference: unknown): number {
  const match = String(reference || "").match(/^Genesis\s+(\d+):(\d+)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 1000 + Number(match[2]);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase runtime credentials are missing." }), { status: 500, headers });
  }

  const authorization = request.headers.get("Authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!safeEqual(supplied, serviceRoleKey)) {
    return new Response(JSON.stringify({ error: "Invalid service credential." }), { status: 401, headers });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await request.json().catch(() => ({}));
    const requestedTrackId = String(body?.trackId || "").trim();

    let target = null;
    if (requestedTrackId) {
      const { data, error } = await supabase
        .from("hebrew_audio_tracks")
        .select("id,verse_reference,status,is_published,created_at")
        .eq("id", requestedTrackId)
        .maybeSingle();
      if (error) throw error;
      target = data;
    } else {
      const { data: tracks, error: trackError } = await supabase
        .from("hebrew_audio_tracks")
        .select("id,verse_reference,status,is_published,created_at")
        .ilike("verse_reference", "Genesis %:%");
      if (trackError) throw trackError;

      target = (Array.isArray(tracks) ? tracks : [])
        .filter((track) => track.status !== "ready")
        .sort((left, right) => referenceOrder(left.verse_reference) - referenceOrder(right.verse_reference))[0] || null;
    }

    if (!target) {
      return new Response(JSON.stringify({ ok: true, state: "waiting_for_prepared_track" }), { status: 200, headers });
    }

    const generations: unknown[] = [];
    let ready = target.status === "ready";

    for (let attempt = 1; attempt <= 14 && !ready; attempt += 1) {
      const response = await fetch(generatorUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operation: "generate-next", trackId: target.id }),
      });

      const result = await response.json().catch(() => ({ error: `Generator returned ${response.status}.` }));
      if (!response.ok) throw new Error(result?.error || `Generator returned ${response.status}.`);
      generations.push(result);
      ready = Boolean(result?.ready);
    }

    return new Response(JSON.stringify({
      ok: true,
      state: ready ? "ready" : "generating",
      verseReference: target.verse_reference,
      trackId: target.id,
      attempts: generations.length,
      generation: generations.at(-1) || null,
    }), { status: 200, headers });
  } catch (error) {
    console.error("Hebrew daily audio failed", error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), { status: 500, headers });
  }
});
