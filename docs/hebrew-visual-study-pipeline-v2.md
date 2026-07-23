# Daily Hebrew Visual Study Pipeline v2 — First Build Slice

This package is the additive first implementation slice for the existing Hebrew Audio Library.

## Included

- Additive Supabase schema for lesson manifests, visual feeds, cards, assets, sources, and resumable jobs.
- A seeded Genesis 1:14 pilot feed with five educational cards.
- A same-page **Explore This Verse** screen.
- A persistent mini-player that controls the existing audio element while the visual feed is open.
- Structured visual renderers for Hebrew words, timelines, Scripture connections, and comparisons.
- Graceful fallback: if the visual migration has not been applied, audio still loads and works.
- Read-only browser policies for published visual content.
- Service-role access for the future morning production worker.

## Safe deployment order

1. Create a feature branch from current `main`.
2. Apply `supabase/migrations/20260722_hebrew_visual_study_pipeline_v2.sql` to the existing Hebrew Supabase project.
3. Apply `supabase/migrations/20260722_hebrew_visual_study_pipeline_v2_hardening.sql`, then verify the new tables and Genesis 1:14 pilot rows.
4. Add the Explore screen to `library.html`, append the visual styles to `library.css`, and load the additive `visual-study.js` after the existing production `library.js`. Do not replace the audio player logic.
5. Add `scripts/check-visual-study.mjs` and `tests/visual-study-logic.test.mjs`.
6. Run:

```bash
node --check visual-study.js
node scripts/check-visual-study.mjs
node --test tests/visual-study-logic.test.mjs
```

7. Deploy Preview only.
8. Smoke test on iPhone:
   - Open Genesis 1:14.
   - Start audio.
   - Tap **Explore This Verse**.
   - Confirm audio continues.
   - Pause and resume with the mini-player.
   - Return to the full player without restarting the segment.
   - Confirm all five visual cards render.
9. Merge only after the existing reader, audio library, and generator checks also pass.

## What is intentionally not included yet

- AI image generation worker.
- Asset-reuse similarity search.
- Automated three-verse preparation queue.
- Morning publication orchestrator changes.
- Archaeology or historical cards requiring external scholarly source curation.

Those belong in the next slice after this UI and schema foundation passes Preview testing.

## Cutover rule

Do not modify the live 4:30 AM / 5:00 AM automation yet. The current audio workflow remains the production source of truth until three pilot visual-study runs succeed.

## Production-preservation notes

- The implementation uses the single existing `#audioElement`.
- The Explore screen, mini-player, and card-details dialog never create another audio element.
- `artwork-fix.js` and `audio-player-fix.js` remain loaded before the unchanged production `library.js`; `visual-study.js` loads afterward and delegates transport controls to the existing player.
- Every opened audio lesson exposes Explore; missing feeds show a clean, non-blocking fallback.
- The live morning automation is intentionally unchanged.
