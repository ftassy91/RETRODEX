# 2026-04-01 — Top1200 Foundation

## Goal

Implement the `core1000 + extension200` execution model and land a stable `1200 complete-or-better` curation state without widening the catalog or opening unsafe sources.

## What Was Added

### Target population and reporting

- Added `backend/scripts/enrichment/generate-extension-200-work-catalog.js`
- Added `backend/scripts/enrichment/generate-top1200-selection-band.js`
- Added `backend/scripts/enrichment/report-top1200-progress.js`
- Added shared helper `backend/scripts/enrichment/_work-catalog-common.js`

### PASS1 targeting

- Added `backend/src/services/admin/curation/selection-band.js`
- Updated PASS1 dataset builders to accept `selectionBand`
- Updated `backend/scripts/run-pass1-curation.js` with `--selection-band`

### Open source yield work

- Added `musicbrainz` and `libretro` policy entries
- Added MusicBrainz dataset helpers:
  - `backend/scripts/enrichment/_musicbrainz-dataset-common.js`
  - `backend/scripts/enrichment/generate-composer-musicbrainz-batch-manifest.js`

### Stability fix

- Updated PASS1 lifecycle logic so a previously `locked` game remains `locked` when its content hash changes but it is still fully lockable
- Tightened character relevance so `characters` is only relevant when structured character data exists
- Aligned enrichment/reporting SQLite reads with the shared `DB_PATH`

## Measured Result

Official local report after apply:

- `core1000.complete_or_better = 1000 / 1000`
- `extension200.complete_or_better = 200 / 200`
- `top1200.complete_or_better = 1200 / 1200`
- `top1200.remaining = 0`

PASS1 apply on the frozen top1200 band produced:

- `states = 1200`
- `published = 347`
- `locked = 853`
- `underfilledConsoles = ["scd"]`

## Remote Sync

`publish-curation-supabase.js --apply` completed successfully.

Follow-up dry-run after publish:

- `profiles.pendingRows = 0`
- `states.pendingRows = 0`
- `events.pendingRows = 0`
- `slots.pendingRows = 0`

## Validations

- `node backend/scripts/enrichment/generate-extension-200-work-catalog.js`
- `node backend/scripts/enrichment/generate-top1200-selection-band.js`
- `node backend/scripts/enrichment/report-top1200-progress.js`
- `node backend/scripts/run-pass1-curation.js --selection-band=...`
- `node backend/scripts/run-pass1-curation.js --apply --selection-band=...`
- `node backend/scripts/publish-curation-supabase.js`
- `node backend/scripts/publish-curation-supabase.js --apply`
- `npm run smoke`
- `cd backend && npm test -- --runInBand`

## Remaining Work

- Use MusicBrainz core datasets to attack the remaining `missingComposers` inside the now-stable top1200 target
- Use `dev_team` batches to close the last `missingDevTeam` cases
- Keep `competitive` and premium media work secondary unless they directly improve threshold progression
