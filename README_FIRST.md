# Hebrew Supabase Patch

This folder is an overlay for the repository:

`SimpleandBasic/Hebrew-Language-Bible-Study`

It adds the shared Supabase backend foundation while preserving the current Genesis 1:1–5 data as a working fallback.

## Files to copy into the repository

Copy every file and folder in this package into the repository root. Allow `index.html` to replace the existing file. No change to `script.js` is required.

After copying, run:

```powershell
git add index.html supabase-config.js data-loader.js SUPABASE_SETUP.md supabase .github/workflows/seed-hebrew-supabase.yml
git commit -m "Add shared Supabase backend for Hebrew study"
git push origin main
```

Then follow `SUPABASE_SETUP.md`.

## Safety

The app still works from local data before Supabase is configured. The service-role key belongs only in GitHub Actions secrets and never in `supabase-config.js`.
