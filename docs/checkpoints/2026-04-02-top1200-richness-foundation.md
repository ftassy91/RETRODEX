# Top1200 Richness Foundation

Date: 2026-04-02

## Objective

Lay the execution foundation for `top1200` richness uplift so weak/intermediate domains can be driven by manifests, provenance, reporting, and scoped publication instead of ad hoc edits.

## Changes implemented

### Reporting

- Added [report-top1200-richness.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/report-top1200-richness.js).
- The reporter measures `top1200` coverage for:
  - `summary`
  - `synopsis`
  - `tagline`
  - `dev_team`
  - `ost_notable_tracks`
  - `manual`
  - `map`
  - `sprite`
  - `ending`
  - `dev_anecdotes`
  - `versions`
  - `crew_profile_complete`
  - expert-eligible placeholders for `cheat_codes`, `avg_duration`, `expert_signals`
- Added npm surface scripts:
  - root: `npm run enrichment:report-top1200-richness`
  - backend: `npm run enrichment:report-top1200-richness`

### Doctrine / source policy

- Added `StrategyWiki` to [source-policy.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/source-policy.js) as `approved_with_review`.
- Extended [source-compliance-matrix.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/source-compliance-matrix.md) with the allowed StrategyWiki scope for:
  - `cheat_codes`
  - `versions`
  - short editorial support
  - reference-style player utility notes

### New richness batch family

- Added `batchType=richness` support in [\_batch-manifest-common.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/_batch-manifest-common.js).
- Added [\_richness-batch-common.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/_richness-batch-common.js).
- Added [apply-richness-batch.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/apply-richness-batch.js).
- Added [run-richness-batch-pipeline.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/run-richness-batch-pipeline.js).

Supported writes:

- text fields:
  - `summary`
  - `synopsis`
  - `tagline`
- structured editorial fields:
  - `dev_anecdotes`
  - `cheat_codes`
  - `versions`
  - `speedrun_wr`
  - `ost_notable_tracks`
- numeric fields:
  - `avg_duration_main`
  - `avg_duration_complete`
- media references:
  - `manual`
  - `map`
  - `sprite_sheet`
  - `ending`

Write guarantees:

- canonical SQLite write
- `source_records`
- `field_provenance`
- `game_editorial` upsert when the column exists
- scoped publication by manifest domain
- audit refresh

### Runtime/UI sync

- Extended [sync-supabase-ui-fields.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/sync-supabase-ui-fields.js) so `tagline` is now part of the public runtime sync surface.

## First executed wave

Applied one real `expert-signals` wave with the existing competitive pipeline using a generated speedrun manifest for:

- `tetris-game-boy`
- `super-mario-bros-nintendo-entertainment-system`
- `mario-kart-64-nintendo-64`
- `the-legend-of-zelda-nintendo-entertainment-system`
- `sonic-the-hedgehog-sega-genesis`

Artifacts:

- manifest: [generated_competitive_speedrun_20260402070524.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/manifests/generated/generated_competitive_speedrun_20260402070524.json)
- backup: `backend/storage/retrodex.sqlite.backup_20260402_090552_generated_competitive_speedrun_20260402070524`

Applied gain:

- `competitiveProfiles`: `+5`
- `recordCategories`: `+13`
- `recordEntries`: `+65`
- `speedrun_wr` projections: `+5`

Top1200 state after the wave:

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 73`
- `expert_signals` filled count in `top1200`: `7 -> 12`

## Validation

Passed:

- `node --check` on all new/changed enrichment scripts
- `npm run enrichment:report-top1200-richness`
- `node backend/scripts/run-audit.js`
- `npm run enrichment:report-top1200`
- `npm run smoke`
- `cd backend && npm test -- --runInBand`

## Second executed wave

Applied one real `editorial-depth` wave using a new internal backfill generator that copies already-curated `game_editorial.summary` and `game_editorial.synopsis` into canonical `games.summary` / `games.synopsis` when the public game row is still empty.

New tooling:

- [generate-editorial-depth-internal-backfill-manifest.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/generate-editorial-depth-internal-backfill-manifest.js)
- npm scripts:
  - root: `npm run enrichment:generate-editorial-depth-internal-backfill`
  - backend: `npm run enrichment:generate-editorial-depth-internal-backfill`

Artifacts:

- manifest: [generated_editorial_depth_internal_backfill_20260402071141.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/manifests/generated/generated_editorial_depth_internal_backfill_20260402071141.json)
- backup: `backend/storage/retrodex.sqlite.backup_20260402_091146_generated_editorial_depth_internal_backfill_20260402071141`
- scoped audit: `backend/data/audit/2026-04-02T07-11-46-941Z_scoped_33_summary.json`

Applied gain:

- `summary`: `492 -> 525` in `top1200`
- `synopsis`: `22 -> 55` in `top1200`
- `source_records` touched: `66`
- `field_provenance` touched: `66`

Top1200 state after the wave:

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 73`
- `summary` remains weak in absolute coverage, but the internal safe delta is now exhausted for this exact backfill pattern

Operational note:

- this wave is intentionally strict:
  - no text generation
  - no source expansion
  - no editorial rewriting
  - only propagation of already-curated internal editorial content into the canonical public field surface

## Third executed wave

Applied one large `dev_team` structural backfill wave to make the `top1200` developer-team surface strong without introducing any new source family.

New tooling:

- [generate-dev-team-structured-backfill-manifest.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/generate-dev-team-structured-backfill-manifest.js)
- npm scripts:
  - root: `npm run enrichment:generate-dev-team-structured-backfill`
  - backend: `npm run enrichment:generate-dev-team-structured-backfill`

Backfill policy:

- prefer existing `game_companies` rows where `role = developer`
- fall back to existing `game_people` rows where `role = developer`
- serialize the result into the canonical `games.dev_team` JSON structure already used by RetroDex
- keep `source_records` and `field_provenance` aligned to `internal / structured_credits`

Artifacts:

- manifest: [generated_dev_team_structured_backfill_20260402071439.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/manifests/generated/generated_dev_team_structured_backfill_20260402071439.json)
- backup: `backend/storage/retrodex.sqlite.backup_20260402_091454_generated_dev_team_structured_backfill_20260402071439`
- full audit: `backend/data/audit/2026-04-02T07-15-20-362Z_summary.json`

Applied gain:

- `dev_team_text` in `top1200`: `154 -> 1200`
- `dev_team` coverage in full catalog: `265 -> 1311`
- `itemsUpdated`: `1046`
- `peopleUpserted`: `1046`
- `gamePeopleUpserted`: `1046`

Operational note:

- the existing `run-dev-team-batch-pipeline.js` applied the SQLite batch successfully, but the scoped `run-audit --ids=...` step exceeded practical CLI length for a `1046`-ID payload
- the wave was therefore finalized manually with:
  - full `run-audit`
  - full `publish-records-supabase.js --apply`
  - full `publish-credits-music-supabase.js --apply`
  - full `sync-supabase-ui-fields.js --apply`
  - `smoke`
  - backend Jest

Top1200 state after the wave:

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 73`
- `dev_team_text` is now classified `strong`

## Fourth executed wave

Applied one first external-source `cheat_codes` wave from a reviewed local StrategyWiki snapshot.

New assets:

- local snapshot: `backend/data/strategywiki/2026-04-02_top1200_cheats_snapshot.json`
- [generate-strategywiki-cheats-manifest.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/generate-strategywiki-cheats-manifest.js)
- npm scripts:
  - root: `npm run enrichment:generate-strategywiki-cheats`
  - backend: `npm run enrichment:generate-strategywiki-cheats`

Artifacts:

- manifest: [generated_strategywiki_cheats_20260402072649.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/manifests/generated/generated_strategywiki_cheats_20260402072649.json)
- backup: `backend/storage/retrodex.sqlite.backup_20260402_092656_generated_strategywiki_cheats_20260402072649`
- scoped audit: `backend/data/audit/2026-04-02T07-26-56-884Z_scoped_4_summary.json`

Applied targets:

- `goldeneye-007-nintendo-64`
- `perfect-dark-nintendo-64`
- `tenchu-stealth-assassins-playstation`
- `banjo-kazooie-nintendo-64`

Applied gain:

- `cheat_codes` in `top1200`: `10 -> 14`
- `itemsUpdated`: `4`
- `sourceRecordsTouched`: `4`
- `fieldProvenanceTouched`: `4`

Source discipline:

- snapshot reviewed locally before ingestion
- concise fact entries only
- no copied long-form prose
- source URLs persisted per game via `strategywiki_snapshot`

Top1200 state after the wave:

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 73`
- `cheat_codes` remains classified `weak`, but the source-backed external path is now operational

## Notes

- The new richness foundation is intentionally source-conservative:
  - no generated editorial truth
  - no new blocked source added
  - no image ingestion outside the documented media reference rules
- `richness` now covers the missing canonical pipeline for:
  - shortform editorial
  - development context
  - player utility
  - selected expert signals
- Large-scale StrategyWiki harvesting is not yet executed in this checkpoint; the source is now policy-approved and ready for a local reviewed snapshot pass.
