# Enrichment Premium Lot 2

State opened on April 1, 2026.
State executed and published on April 1, 2026.

## Objective

Lot 2 targets the next premium uplift group after the first restricted Supabase
publication batch.

The goal is to convert already published, already strong, non-gold candidates
into a tighter premium cohort with the best ratio:

- visible now on public runtime
- already publishable
- already `Tier A`
- already near top-100 premium threshold
- mostly blocked by premium media/archive gaps rather than structural identity

## Selection Rule

The cohort is intentionally restricted to games that are:

- `published`
- premium `silver` or strong `bronze`
- already `is_top100_candidate = true`
- missing mainly:
  - `manual`
  - `map`
  - `sprite_sheet`
  - sometimes `ending`
- not blocked by a broad foundational rewrite

Excluded for now:

- games still `locked`
- games still missing a more structural editorial fix
- variants that would dilute the lot without improving premium density

## Target Cohort

1. `castlevania-symphony-of-the-night-playstation`
   - Title: `Castlevania: Symphony of the Night`
   - Console: `PlayStation`
   - Current tier: `silver`
   - Main gaps: `manual`, `map`, `sprite_sheet`

2. `panzer-dragoon-saga-sega-saturn`
   - Title: `Panzer Dragoon Saga`
   - Console: `Sega Saturn`
   - Current tier: `silver`
   - Main gaps: `manual`, `map`, `sprite_sheet`

3. `earthbound-super-nintendo`
   - Title: `EarthBound`
   - Console: `Super Nintendo`
   - Current tier: `bronze`
   - Main gaps: `manual`, `map`

4. `mega-man-x3-super-nintendo`
   - Title: `Mega Man X3`
   - Console: `Super Nintendo`
   - Current tier: `bronze`
   - Main gaps: `manual`, `map`

5. `suikoden-ii-playstation`
   - Title: `Suikoden II`
   - Console: `PlayStation`
   - Current tier: `bronze`
   - Main gaps: `manual`, `map`

6. `castlevania-dracula-x-super-nintendo`
   - Title: `Castlevania: Dracula X`
   - Console: `Super Nintendo`
   - Current tier: `bronze`
   - Main gap: `manual`

7. `metal-slug-3-neo-geo`
   - Title: `Metal Slug 3`
   - Console: `Neo Geo`
   - Current tier: `bronze`
   - Main gap: `manual`

8. `gunstar-heroes-sega-genesis`
   - Title: `Gunstar Heroes`
   - Console: `Sega Genesis`
   - Current tier: `bronze`
   - Main gaps: `manual`, `map`

## Why This Group

This group is the cleanest next premium lot because:

- it stays on already published, already visible games
- it stays close to the premium top-100 frontier
- it is still media-first, so the uplift remains additive
- it avoids reopening broader editorial or collection work
- it can be published atomically using the new `--ids=` publication flow

## Execution Order

1. enrich local staging for the 8 game IDs above
2. prioritize:
   - `manual`
   - `map`
   - `sprite_sheet`
   - `ending` when clearly available
3. rerun:
   - `backend/scripts/run-audit.js`
   - `backend/scripts/run-pass1-curation.js`
   - `backend/scripts/enrichment/recompute-enrichment-coverage.js`
4. verify expected premium uplift
5. publish by `--ids=` only
6. run `sync-supabase-ui-fields.js --ids=...`

## Publication Rule

Lot 2 must remain restricted publication only.

No broad global publish should be used for this cohort.

Use only:

- `publish-records-supabase.js --ids=...`
- `publish-editorial-supabase.js --ids=...`
- `publish-credits-music-supabase.js --ids=...`
- `publish-media-references-supabase.js --ids=...`
- `publish-external-assets-supabase.js --ids=...`
- `publish-curation-supabase.js --ids=...`
- `sync-supabase-ui-fields.js --ids=...`

## Success Condition

Lot 2 is successful if it increases premium density without broad side effects:

- more `gold` or stronger `silver`
- no runtime regression
- no broad publication outside the cohort
- dry-run and apply both remain `ids`-scoped

## Result

Lot 2 was executed locally through:

- `backend/scripts/enrichment/apply-g5-premium-lot-2.js`

Local uplift after reruns:

- `gold`: `8 -> 15`
- `silver`: `4 -> 3`
- `top100Candidates`: `22 -> 22`

Promoted to `gold` in this lot:

- `castlevania-symphony-of-the-night-playstation`
- `earthbound-super-nintendo`
- `mega-man-x3-super-nintendo`
- `suikoden-ii-playstation`
- `castlevania-dracula-x-super-nintendo`
- `metal-slug-3-neo-geo`
- `gunstar-heroes-sega-genesis`

Remaining `silver` inside the cohort:

- `panzer-dragoon-saga-sega-saturn`
  - still missing `sprite_sheet`

Publication status:

- dry-run targeted by `--ids=`: completed
- Supabase restricted publish by `--ids=`: completed
- post-publication checks on the cohort:
  - `publish-records`: `pending = 0`
  - `publish-media-references`: `pending = 0`
  - `publish-external-assets`: `pending = 0`
  - `publish-curation`: `pending = 0`
  - `sync-supabase-ui-fields`: `pending = 0`

Backup taken before local apply:

- `backend/storage/retrodex.sqlite.backup_20260401_151401_g5-premium-lot-2`
