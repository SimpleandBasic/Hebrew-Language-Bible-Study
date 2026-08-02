import { runTool } from '../src/index.js';
import { chatTools } from '../src/tool-schemas.js';
import { getSupabaseAdminClient } from '../src/supabase-client.js';
import {
  getOrCreateEpisodeShare,
  getSharedEpisode,
  publicOrigin,
  setCommonSecurityHeaders,
  shareUrlFor,
} from '../src/hebrewEpisodeShare.js';
import { renderSharedEpisodePage, renderUnavailablePage } from '../src/hebrewEpisodePage.js';

const WORD = 'he' + 'brew';
const STATUS_TOOL = 'get_' + WORD + '_app_status';
const CORE_TABLES = [WORD + '_verses', WORD + '_words', WORD + '_verse_words', WORD + '_lessons'];
const AUDIO_TABLES = [WORD + '_book_albums', WORD + '_audio_tracks', WORD + '_audio_segments'];
const TABLES = [...CORE_TABLES, ...AUDIO_TABLES];

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.end(JSON.stringify(body));
}

function sendEpisodeJson(res, status, body) {
  setCommonSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : null;
  if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : null;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
}

const ok = (id, result) => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function toolList() {
  return chatTools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }));
}

function cleanLimit(value, fallback = 5) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 25));
}

function warn(warnings, table, action, error) {
  warnings.push(table + ': ' + action + ' failed: ' + (error?.message || 'Unknown database error.'));
}

async function countRows(client, table, warnings, filter = null) {
  try {
    let query = client.from(table).select('*', { count: 'exact', head: true });
    if (filter) query = filter(query);
    const { count, error } = await query;
    if (error) {
      warn(warnings, table, 'count', error);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    warn(warnings, table, 'count', error);
    return null;
  }
}

async function recentRows(client, table, select, limit, warnings, mapRow) {
  try {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) {
      warn(warnings, table, 'recent query', error);
      return [];
    }
    return Array.isArray(data) ? data.map(mapRow) : [];
  } catch (error) {
    warn(warnings, table, 'recent query', error);
    return [];
  }
}

async function cleanStatus(input = {}, options = {}) {
  const client = options.supabase ?? getSupabaseAdminClient(options.env);
  const limit = cleanLimit(input.limit, 5);
  const warnings = [];
  const counts = {};
  const versesTable = WORD + '_verses';
  const wordsTable = WORD + '_words';
  const linksTable = WORD + '_verse_words';
  const lessonsTable = WORD + '_lessons';
  const tracksTable = WORD + '_audio_tracks';

  for (const table of TABLES) counts[table] = await countRows(client, table, warnings);

  counts.published_lessons = await countRows(client, lessonsTable, warnings, (query) => query.eq('is_published', true));
  counts.draft_lessons = await countRows(client, lessonsTable, warnings, (query) => query.eq('is_published', false));
  counts.ready_audio_tracks = await countRows(client, tracksTable, warnings, (query) => query.eq('status', 'ready'));
  counts.published_audio_tracks = await countRows(client, tracksTable, warnings, (query) => query.eq('is_published', true));

  const [lessons, verses, audioTracks] = await Promise.all([
    recentRows(
      client,
      lessonsTable,
      'id,slug,title,is_published,updated_at',
      limit,
      warnings,
      (lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        is_published: Boolean(lesson.is_published),
        updated_at: lesson.updated_at,
      }),
    ),
    recentRows(
      client,
      versesTable,
      'book,chapter,verse_number,reference,updated_at',
      limit,
      warnings,
      (verse) => ({
        book: verse.book,
        chapter: verse.chapter,
        verse_number: verse.verse_number,
        reference: verse.reference,
        updated_at: verse.updated_at,
      }),
    ),
    recentRows(
      client,
      tracksTable,
      'id,verse_reference,track_title,status,total_duration_seconds,is_published,published_at,updated_at',
      limit,
      warnings,
      (track) => ({
        id: track.id,
        verse_reference: track.verse_reference,
        track_title: track.track_title,
        status: track.status,
        total_duration_seconds: Number(track.total_duration_seconds) || null,
        is_published: Boolean(track.is_published),
        published_at: track.published_at,
        updated_at: track.updated_at,
      }),
    ),
  ]);

  return {
    ok: warnings.length === 0,
    tool: STATUS_TOOL,
    tables_reachable: TABLES.every((table) => counts[table] !== null),
    counts,
    recent: { lessons, verses, audio_tracks: audioTracks },
    warnings,
    last_checked: new Date().toISOString(),
  };
}

async function handle(message, options) {
  const id = message?.id ?? null;
  if (message?.method === 'initialize') {
    return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: WORD + '-developer-mcp', version: '1.1.0' } });
  }
  if (message?.method === 'tools/list') return ok(id, { tools: toolList() });
  if (message?.method === 'tools/call') {
    const toolName = message?.params?.name;
    const toolInput = message?.params?.arguments ?? {};
    const output = toolName === STATUS_TOOL ? await cleanStatus(toolInput, options) : await runTool(toolName, toolInput, options);
    return ok(id, { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output });
  }
  return fail(id, -32601, 'Unknown method: ' + message?.method);
}

async function handleEpisodeShare(req, res) {
  if (req.method === 'OPTIONS') {
    setCommonSecurityHeaders(res);
    res.statusCode = 204;
    return res.end();
  }

  try {
    const options = { env: process.env };
    if (req.method === 'POST') {
      const body = await readJson(req);
      const { share, track } = await getOrCreateEpisodeShare(body?.trackId, options);
      return sendEpisodeJson(res, 200, {
        url: shareUrlFor(req, share),
        title: track.track_title,
        reference: track.verse_reference,
      });
    }
    if (req.method === 'GET') {
      const token = String(req.query?.share || req.query?.token || '');
      return sendEpisodeJson(res, 200, { episode: await getSharedEpisode(token, options) });
    }
    res.setHeader('Allow', 'GET, POST');
    return sendEpisodeJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Hebrew episode share API failed.', error);
    const status = Number(error.status) || (error instanceof SyntaxError ? 400 : 500);
    return sendEpisodeJson(res, status, {
      error: status >= 500 ? 'The shared episode service is temporarily unavailable.' : error.message,
    });
  }
}

async function handleEpisodePage(req, res) {
  setCommonSecurityHeaders(res, { cache: true });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://*.supabase.co data:; media-src 'self' https://*.supabase.co blob:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(renderUnavailablePage('Method not allowed.'));
  }

  try {
    const token = String(req.query?.share || '');
    const episode = await getSharedEpisode(token, { env: process.env });
    const origin = publicOrigin(req);
    const canonicalUrl = `${origin}/listen/${encodeURIComponent(token)}/${encodeURIComponent(episode.slug)}`;
    res.statusCode = 200;
    return res.end(renderSharedEpisodePage({ episode, canonicalUrl, origin }));
  } catch (error) {
    console.error('Hebrew shared episode page failed.', error);
    res.statusCode = Number(error.status) || 500;
    return res.end(renderUnavailablePage(error.status === 404 ? error.message : 'Please try the link again later.'));
  }
}

export default async function handler(req, res) {
  if (String(req.query?.episode_share || '') === '1') return handleEpisodeShare(req, res);
  if (String(req.query?.episode_page || '') === '1') return handleEpisodePage(req, res);

  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET') return send(res, 200, { ok: true, name: WORD + '-developer-mcp', path: '/mcp', tools: chatTools.map((tool) => tool.name) });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed.' });
  try {
    const body = await readJson(req);
    const options = { env: process.env, fetchFn: fetch };
    if (Array.isArray(body)) return send(res, 200, await Promise.all(body.map((item) => handle(item, options))));
    return send(res, 200, await handle(body, options));
  } catch (error) {
    return send(res, 200, fail(null, -32000, error.message || 'MCP server error.'));
  }
}
