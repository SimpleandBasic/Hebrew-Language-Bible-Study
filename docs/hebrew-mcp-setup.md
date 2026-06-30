# Hebrew MCP Connector Setup

This repository stays the main GitHub Pages viewer for the Hebrew study app.

Vercel can also deploy this same repository as a backend connector because GitHub Pages ignores the `api/` and `src/` backend files.

## Runtime split

- GitHub Pages serves the learner-facing Hebrew viewer.
- Vercel serves the MCP backend at `/mcp`.
- Supabase stores Hebrew verses, words, lessons, and progress.
- The Supabase service role key must only live in Vercel environment variables.

## Vercel environment variables

Set these in the Vercel project that deploys this repository:

```text
HEBREW_SUPABASE_URL=https://cmryhxnhnltrewvduico.supabase.co
HEBREW_SUPABASE_SERVICE_ROLE_KEY=replace-with-server-side-secret-only
```

Do not place the service role key in `supabase-config.js`, browser code, screenshots, or GitHub Pages files.

## MCP tools

The connector exposes these tools:

```text
get_hebrew_app_status
draft_hebrew_lesson_bundle
preview_hebrew_lesson_bundle
publish_hebrew_lesson_bundle
list_pending_hebrew_lessons
```

## Safe workflow

1. Teach the lesson in ChatGPT.
2. Save it as a draft with `draft_hebrew_lesson_bundle`.
3. Preview it with `preview_hebrew_lesson_bundle`.
4. Only after Ace approves, add it to the study tables with `publish_hebrew_lesson_bundle`.
5. The GitHub Pages app reads the new data from Supabase through the existing loader.
