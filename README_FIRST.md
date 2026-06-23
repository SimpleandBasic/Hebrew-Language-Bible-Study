# Hebrew Supabase Patch

This patch adds the shared Supabase backend foundation to:

`SimpleandBasic/Hebrew-Language-Bible-Study`

The current Genesis 1:1–5 data remains in `script.js` as a working fallback, so the reader still works before Supabase is configured.

## Included files

- `index.html`
- `supabase-config.js`
- `data-loader.js`
- `SUPABASE_SETUP.md`
- `supabase/hebrew-learning-schema.sql`
- `supabase/import-genesis.js`
- `.github/workflows/seed-hebrew-supabase.yml`

No change to `script.js` is required.

## Next step

Follow `SUPABASE_SETUP.md` after these files are merged into `main`.

## Safety

Only the public publishable key belongs in `supabase-config.js`. The private `sb_secret_` key belongs only in GitHub Actions repository secrets and must never be committed to the repository.
