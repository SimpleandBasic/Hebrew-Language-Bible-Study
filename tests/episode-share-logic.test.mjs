import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  isUuid,
  publicOrigin,
  shareUrlFor,
  slugify,
} from '../src/hebrewEpisodeShare.js';

test('isUuid accepts opaque share tokens and rejects guesses', () => {
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isUuid('genesis-2-3'), false);
  assert.equal(isUuid(''), false);
});

test('slugify creates a stable readable episode slug', () => {
  assert.equal(slugify('Genesis 2:3 — God Blessed the Seventh Day'), 'genesis-2-3-god-blessed-the-seventh-day');
  assert.equal(slugify('שָׁבַת'), 'hebrew-bible-study');
});

test('shareUrlFor keeps the token opaque and adds a readable slug', () => {
  const request = { headers: { host: 'hebrew.example.com', 'x-forwarded-proto': 'https' } };
  const share = {
    share_token: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'genesis-2-3-rest',
  };
  assert.equal(
    shareUrlFor(request, share),
    'https://hebrew.example.com/listen/550e8400-e29b-41d4-a716-446655440000/genesis-2-3-rest'
  );
});

test('PUBLIC_SITE_URL overrides proxy headers in production', () => {
  const originalSite = process.env.PUBLIC_SITE_URL;
  const originalEnv = process.env.VERCEL_ENV;
  process.env.PUBLIC_SITE_URL = 'https://study.example.com/';
  process.env.VERCEL_ENV = 'production';
  assert.equal(publicOrigin({ headers: { host: 'preview.invalid' } }), 'https://study.example.com');
  if (originalSite === undefined) delete process.env.PUBLIC_SITE_URL;
  else process.env.PUBLIC_SITE_URL = originalSite;
  if (originalEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalEnv;
});

test('preview links use the active Preview host', () => {
  const originalSite = process.env.PUBLIC_SITE_URL;
  const originalEnv = process.env.VERCEL_ENV;
  process.env.PUBLIC_SITE_URL = 'https://production.example.com';
  process.env.VERCEL_ENV = 'preview';
  assert.equal(publicOrigin({ headers: { host: 'preview.example.com', 'x-forwarded-proto': 'https' } }), 'https://preview.example.com');
  if (originalSite === undefined) delete process.env.PUBLIC_SITE_URL;
  else process.env.PUBLIC_SITE_URL = originalSite;
  if (originalEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalEnv;
});

test('escapeHtml protects dynamic social and page metadata', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
