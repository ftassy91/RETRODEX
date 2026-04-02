# Top 1000 Competitive Foundation

## Scope

Implementation checkpoint for the unified top-1000 enrichment plan.

This lot did not add a new product feature domain blindly. It added the minimum working foundation needed to:

- freeze the top-1000 working population
- open source compliance for competitive sources
- add a canonical competitive data model
- execute one real manifest-first competitive batch end-to-end
- expose the resulting data through the public knowledge payload

## What was added

- source policy entries for:
  - `speedrun.com`
  - `RetroAchievements`
- compliance matrix updates for both sources
- top-1000 work catalog generator:
  - `backend/scripts/enrichment/generate-top-1000-work-catalog.js`
- canonical competitive migration:
  - `game_competitive_profiles`
  - `game_record_categories`
  - `game_record_entries`
  - `game_achievement_profiles`
- manifest-first competitive pipeline:
  - generator `speedrun.com`
  - generator `RetroAchievements`
  - local apply
  - generic dispatcher support
  - dedicated publish script
- public knowledge exposure for competition:
  - public game service
  - archive/encyclopedia payload projection
  - record list rendering with source and leaderboard link

## Real batch proof

Validated on a real `speedrun.com` batch for:

- `f-zero-x-nintendo-64`
- `super-mario-64-nintendo-64`
- `super-mario-kart-super-nintendo`
- `super-metroid-super-nintendo`
- `wave-race-64-nintendo-64`

Generated manifest:

- `backend/scripts/enrichment/manifests/generated/generated_competitive_speedrun_20260401212619.json`

Observed local apply:

- `competitiveProfiles = 5`
- `recordCategories = 15`
- `recordEntries = 75`
- `projectionUpdates = 5`

Observed remote post-check after the publish fix:

- `competitiveProfiles.pendingRows = 0`
- `recordCategories.pendingRows = 0`
- `recordEntries.pendingRows = 0`
- `projection.pendingUpdates = 0`

## Important fix applied during validation

The first real publish failed because local `source_record_id` values were not translated to remote Supabase ids before inserting the canonical competitive tables.

The publisher now:

- fetches remote `source_records`
- builds a local -> remote source id mapping
- rewrites `source_record_id` references before upsert

Without this fix, the competitive tables fail on foreign-key checks even when `publish-records-supabase` has already succeeded.

## Public payload validation

Direct validation on `super-mario-64-nintendo-64` confirms:

- `competition.hasData = true`
- `featuredRecords.length = 3`
- projected `speedrun_wr` now reflects the canonical primary competitive record

Example primary record:

- category: `120 Star`
- value: `01:35:28`
- source: `speedrun.com`

## Current limits

- `RetroAchievements` generator is implemented but not yet validated against a real mapped batch
- public full-page validation through the complete reader path is still affected by a pre-existing SQLite `ost_tracks` query issue unrelated to the competitive lot
- no UI-specific competition block has been added yet beyond the current knowledge/record projection path

## Next recommended actions

1. validate one real `RetroAchievements` batch once the local mapping file and API key are ready
2. generate the first top-1000 debt batches from the frozen work catalog:
   - `dev_team`
   - `composers`
3. follow with homogeneous media batches:
   - `manual`
   - `map`
   - `sprite_sheet`
   - `ending`
4. only then add a compact dedicated `Competition` block in the public game page if the current records section is not enough
