# Hebrew Audio Library

The Vercel app opens `library.html` at `/` and keeps the existing Hebrew reader at `/index.html` under **Read**.

## Architecture

- Existing `hebrew_verses`, `hebrew_words`, `hebrew_verse_words`, and `hebrew_lessons` remain the canonical Scripture and lesson records.
- `hebrew_book_albums` stores visible Bible albums. Version 1 seeds only Genesis.
- `hebrew_audio_tracks` connects a canonical verse and lesson to one audio track.
- `hebrew_audio_segments` stores ordered spoken sections, display transcripts, generation settings, checksums, and media paths.
- `hebrew-media` is a Hebrew-only Supabase Storage bucket.
- Listening progress remains in iPhone `localStorage` under `hebrew-audio-progress-v1`.

## Required Vercel environment variables

All are server-side variables. Do not prefix them with `VITE_`, `NEXT_PUBLIC_`, or any other public marker.

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HEBREW_AUDIO_ADMIN_KEY`
- Optional: `HEBREW_TTS_MODEL` (defaults to `gpt-4o-mini-tts`)
- Optional: `HEBREW_TTS_VOICE` (defaults to `ash`)
- Optional: `HEBREW_TTS_INSTRUCTIONS`

## Generate Genesis 1:14

The protected endpoint generates no more than one changed, missing, or failed segment per request:

```http
POST /api/hebrew-audio
x-hebrew-admin-key: <HEBREW_AUDIO_ADMIN_KEY>
content-type: application/json

{"operation":"generate-next","verseReference":"Genesis 1:14"}
```

Repeat until the response reports `ready: true`. Successful segments are reused when their checksum still matches spoken text, model, voice, instructions, and speech settings.

## Add Genesis 1:15

1. Add Genesis 1:15 to the existing canonical Hebrew verse and word tables.
2. Publish its normal text lesson in `hebrew_lessons`.
3. Create one `hebrew_audio_tracks` row linked to that verse and lesson with status `ready_to_generate`.
4. Add ordered `hebrew_audio_segments` rows with separate `spoken_text` and `display_transcript`.
5. Include the standard **Did You Know? See Jesus Here** segment with careful whole-Bible grounding.
6. Call `generate-next` until all segments are ready.

No new chapter UI code is required. Chapters and verse rows are built from canonical verse records automatically.
