# Connect the Hebrew App to the Shared Supabase Project

This setup keeps the Hebrew app in the same Supabase project as Levrynn while separating everything with `hebrew_` table names.

The existing Genesis 1:1–5 data in `script.js` remains the fallback. The app only switches to database content after Supabase contains at least five complete verses with words.

## 1. Create the Hebrew tables

1. Open the same Supabase project used by Levrynn.
2. Open **SQL Editor**.
3. Open `supabase/hebrew-learning-schema.sql` from this repository.
4. Copy the whole file into a new Supabase query.
5. Click **Run**.

The SQL is rerunnable. It only creates or updates objects beginning with `hebrew_` and does not rename or delete Levrynn tables.

## 2. Store the private import credentials in GitHub

The importer needs the service-role key, but that key must never appear in frontend code.

In this GitHub repository:

1. Open **Settings**.
2. Open **Secrets and variables**.
3. Choose **Actions**.
4. Create a repository secret named `SUPABASE_URL` containing the project URL.
5. Create a repository secret named `SUPABASE_SERVICE_ROLE_KEY` containing the service-role key.

## 3. Import the existing Genesis study data

1. Open the repository's **Actions** tab.
2. Select **Seed Hebrew Supabase**.
3. Choose **Run workflow**.
4. Open the completed run and confirm the import step is green.

The workflow reads the existing `verses` array from `script.js`. It imports all current verses and word notes without requiring duplicate hand-entry.

The importer is safe to run again. Stable source keys update the same Hebrew records instead of creating another copy.

## 4. Connect the public app

Open `supabase-config.js` and fill in:

```js
window.HEBREW_SUPABASE_CONFIG = Object.freeze({
  url: "YOUR_SUPABASE_PROJECT_URL",
  anonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY",
  minimumVerseCount: 5
});
```

Use only the public anon or publishable key here. Never use the service-role key.

After the GitHub Pages deployment refreshes, the app status line should say:

```text
Connected to Supabase. Loaded 5 Genesis verses.
```

If configuration, networking, or database content is incomplete, the app continues using the built-in Genesis data.

## What was added

- `hebrew_verses`
- `hebrew_words`
- `hebrew_verse_words`
- `hebrew_lessons`
- `hebrew_user_progress`
- `hebrew_flashcard_reviews`
- `hebrew_rpg_progress`
- Row Level Security policies
- A protected GitHub Action for importing Genesis 1:1–5
- A browser loader with automatic local fallback

## Security model

- Public visitors may read published Hebrew study content.
- Public visitors cannot edit the master Hebrew content.
- Authenticated users may only access their own progress, reviews, and RPG state.
- The service-role key is used only by the protected GitHub Action.
