# 2026-04-02 — Strong Pages Lot 1

## Goal
- Deliver a first `strong pages` batch on high-value game pages.
- Keep the lot bounded, publish it cleanly, and verify visible impact on public pages.

## Scope
- `70` unique targeted games.
- `53` editorial + media upgrades via richness manifest.
- `12` composer / OST credit upgrades.
- `5` developer-team credit upgrades.

## Selection
- Editorial/media targets were limited to high-priority, franchise-linked pages in the top1200 selection band.
- Only games with missing `synopsis` and at least one usable external media asset were included.
- Credit targets came from the latest Wikidata/Wikipedia credit snapshots and were kept small enough to publish safely.

## Manifests
- `backend/scripts/enrichment/manifests/strong-pages-lot-1-editorial-seed.json`
- `backend/scripts/enrichment/manifests/strong-pages-lot-1-richness.json`
- `backend/scripts/enrichment/manifests/strong-pages-lot-1-composers.json`
- `backend/scripts/enrichment/manifests/strong-pages-lot-1-dev-team.json`

## Apply Summary
### Richness
- `53` targeted pages.
- `53` new synopsis uplifts in SQLite staging.
- `79` media references refreshed or added across:
  - `12` manuals
  - `18` maps
  - `48` endings
  - `1` sprite sheet
- Publish domains run and rechecked:
  - `records`
  - `editorial`
  - `media`
  - `ui`

### Credits
- Composer lot:
  - `12` games
  - `21` people bindings
- Dev-team lot:
  - `5` games
  - `7` people bindings

## Fixes Needed During Execution
- `run-richness-batch-pipeline` initially failed on apply with `RangeError: Too few parameter values were provided`.
- Root cause: `media.notes` entries from the generated manifest were `[]`, and `better-sqlite3` treated them as parameter arrays instead of scalar text values.
- Fix applied in `backend/scripts/enrichment/_richness-batch-common.js`:
  - normalize batch `notes` to either text or `null` before inserting/updating `source_records`.

## Publication Verification
- All three batch pipelines completed.
- Post-apply rechecks returned `pendingRows = 0` on the targeted subsets for:
  - `publish-records`
  - `publish-media`
  - `publish-credits-music`

## Page Impact Checks
Public API spot checks on:
- `final-fantasy-vi-super-nintendo`
- `super-metroid-super-nintendo`
- `castlevania-aria-of-sorrow-game-boy-advance`
- `1-vs-100-nintendo-ds`
- `aleck-bordon-adventure-tower-and-shaft-game-boy-advance`

Observed impact:
- enriched editorial targets now expose `synopsis` on public detail payloads
- media-rich pages now expose manuals / endings / maps where targeted
- credit-only pages expose stronger `OST` or `Dev Team` sections without forcing unrelated editorial changes

## Validation
- `npm run smoke`
- `cd backend && npm test -- --runInBand`

Both passed after the lot.
