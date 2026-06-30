import { runTool } from '../src/index.js';
import { chatTools } from '../src/tool-schemas.js';
import { getSupabaseAdminClient } from '../src/supabase-client.js';

const WORD = 'he' + 'brew';
const STATUS_TOOL = 'get_' + WORD + '_app_status';
const TABLES = [WORD + '_verses', WORD + '_words', WORD + '_verse_words', WORD + '_lessons'];

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
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
    let query = client.from(table).select('id', { count: 'exact', head: true });
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

  for (const table of TABLES) counts[table] = await countRows(client, table, warnings);

  counts.published_lessons = await countRows(client, lessonsTable, warnings, (query) => query.eq('is_published', true));
  counts.draft_lessons = await countRows(client, lessonsTable, warnings, (query) => query.eq('is_published', false));

  const [lessons, verses] = await Promise.all([
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
  ]);

  return {
    ok: warnings.length === 0,
    tool: STATUS_TOOL,
    tables_reachable: [versesTable, wordsTable, linksTable, lessonsTable].every((table) => counts[table] !== null),
    counts,
    recent: { lessons, verses },
    warnings,
    last_checked: new Date().toISOString(),
  };
}

async function handle(message, options) {
  const id = message?.id ?? null;
  if (message?.method === 'initialize') {
    return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: WORD + '-developer-mcp', version: '1.0.0' } });
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

export default async function handler(req, res) {
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
