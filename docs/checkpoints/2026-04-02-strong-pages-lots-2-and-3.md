# Strong Pages Lots 2 and 3

Date: 2026-04-02
Branch: `codex/strong-pages-lot`

## Scope
- `lot 2`: 75 unique games
- `lot 3`: 75 unique games
- Combined with `lot 1`: 220 unique games total
- Overlap checks:
  - `lot1 ∩ lot2 = 0`
  - `lot1 ∩ lot3 = 0`
  - `lot2 ∩ lot3 = 0`

## Composition
### Lot 2
- `53` games via richness/editorial/media
- `10` games via composer uplift
- `12` games via developer-team uplift

### Lot 3
- `53` games via richness/editorial/media
- `5` games via composer uplift
- `17` games via developer-team uplift

## Pipeline hardening
Two robustness fixes were required in `backend/scripts/enrichment/_richness-batch-common.js`:
- normalize `media.notes` arrays before writing SQLite parameters
- align `ensureSourceRecord()` lookup with the real `source_records` uniqueness key, then update `source_url` on existing rows

This removed the `better-sqlite3` parameter mismatch from lot 1 continuation and the `UNIQUE constraint failed` crash that appeared when applying lot 2 richness.

## Apply and convergence
### Lot 2
- `run-richness-batch-pipeline`: apply completed, post-check converged
- `run-composer-batch-pipeline`: apply completed, post-check converged
- `run-dev-team-batch-pipeline`: apply completed, post-check converged

### Lot 3
- `run-richness-batch-pipeline`: apply completed, post-check converged
- `run-composer-batch-pipeline`: apply completed, post-check converged
- `run-dev-team-batch-pipeline`: apply completed, post-check converged

## Validation
- `npm run smoke`: OK
- `cd backend && npm test -- --runInBand`: OK

## Impact checks
Representative page-impact checks after apply:
- `Chrono Trigger (DS)`:
  - synopsis present
  - composers present
  - dev team present
- `Golden Sun (GBA)`:
  - synopsis present
  - manual present
  - ending present
  - map present
  - dev team present
- `007: Nightfire (GBA)`:
  - manual present
  - composer bindings reinforced
  - dev team present
- `Pokémon HeartGold (DS)`:
  - composer bindings reinforced
  - dev team present
- `Resident Evil 2 (PlayStation)`:
  - dev team present

## Result
The strong-pages program now covers three clean, non-overlapping lots:
- `lot 1`: 70 games
- `lot 2`: 75 games
- `lot 3`: 75 games

The new lots raise public-page value through a controlled mix of:
- synopsis backfill from existing internal summaries
- external reference media (`manual`, `map`, `ending`, `sprite_sheet`)
- composer reinforcement
- developer-team reinforcement

The branch is ready for commit, push, and integration after this checkpoint.
