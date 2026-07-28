import generateNextVerse from './generate-next-verse.js';

export const maxDuration = 300;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed.' }));
  }

  req.method = 'POST';
  req.headers = { ...req.headers, 'sec-fetch-site': 'same-origin' };
  return generateNextVerse(req, res);
}
