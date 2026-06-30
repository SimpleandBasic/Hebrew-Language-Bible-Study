import { runTool } from '../src/index.js';
import { chatTools } from '../src/tool-schemas.js';

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

async function handle(message, options) {
  const id = message?.id ?? null;
  if (message?.method === 'initialize') {
    return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'hebrew-developer-mcp', version: '1.0.0' } });
  }
  if (message?.method === 'tools/list') return ok(id, { tools: toolList() });
  if (message?.method === 'tools/call') {
    const output = await runTool(message?.params?.name, message?.params?.arguments ?? {}, options);
    return ok(id, { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output });
  }
  return fail(id, -32601, `Unknown method: ${message?.method}`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET') return send(res, 200, { ok: true, name: 'hebrew-developer-mcp', path: '/mcp', tools: chatTools.map((tool) => tool.name) });
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
