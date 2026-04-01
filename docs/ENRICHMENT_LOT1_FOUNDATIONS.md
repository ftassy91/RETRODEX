# Enrichment Lot 1 Foundations

State captured on April 1, 2026.

## Scope

Lot 1 formalizes the current enrichment pipeline without creating a parallel
system and without reopening runtime or Phase 3 DB work.

This lot is limited to:

- compatibility audit of the existing admin enrichment pipeline
- canonical premium scoring rules
- canonical premium coverage rules
- minimal additive `services/admin/enrichment` foundation
- one read-only CLI entry point for premium coverage recomputation

Not included:

- no public runtime changes
- no new route
- no queue/job worker orchestration
- no automatic publication flow
- no `price_status v2`
- no production mutation

## Audit Conclusion

No new persistence table is required to open the premium enrichment pipeline.

The current schema already covers the core Lot 1 responsibilities:

- coverage base:
  - `game_content_profiles`
  - `game_curation_states`
  - `console_publication_slots`
  - `quality_records`
- evidence / provenance base:
  - `source_records`
  - `field_provenance`
- run logging base:
  - `enrichment_runs`
- domain content base:
  - `game_editorial`
  - `media_references`
  - `game_people`
  - `game_companies`
  - `ost`
  - `ost_tracks`
  - `ost_releases`

Because these tables already exist, Lot 1 stays additive and read-mostly.

## Existing Pipeline Reused

### Services

- `backend/src/services/admin/curation-service.js`
- `backend/src/services/admin/audit-service.js`
- `backend/src/services/admin/enrichment-backlog-service.js`
- `backend/src/services/admin/game-read-service.js`
- `backend/src/services/admin/console-service.js`

### Scripts

- `backend/scripts/run-pass1-curation.js`
- `backend/scripts/run-audit.js`
- `backend/scripts/run-pass1-enrichment-backlog.js`
- `backend/scripts/publish-editorial-supabase.js`
- `backend/scripts/sync-supabase-ui-fields.js`
- existing `publish-*` scripts already used for explicit prod publication

### Runtime / data invariants preserved

- Supabase remains the runtime/prod source of truth
- SQLite remains the local back-office staging environment
- public routes stay thin and unchanged
- admin logic remains under `backend/src/services/admin`
- no second status system replaces `editorial_status`, `media_status`, or `price_status`

## Local Schema Snapshot Used For Lot 1

Observed in `backend/storage/retrodex.sqlite`:

- games: `1491`
- `game_curation_states`: `1491`
- `game_content_profiles`: `1491`
- `game_curation_events`: `1523`
- active `console_publication_slots`: `351`
- game `quality_records`: `1491`
- game `source_records`: `5375`
- game `field_provenance`: `14961`
- game `media_references`: `1462`
- `game_people`: `2910`
- `game_companies`: `2796`

Current curation statuses:

- `published`: `351`
- `locked`: `1092`
- `draft`: `48`

Evidence distribution highlights:

- `source_records.source_name` for games:
  - `internal`: `3913`
  - `igdb`: `1389`
  - `internet_archive`: `73`
- top `field_provenance.field_name` values for games include:
  - `title`
  - `console`
  - `year`
  - `slug`
  - `gameplay_description`
  - `lore`
  - `cover_image`
  - `characters`

Important local caveat:

- local SQLite does not currently store `editorial_status`, `media_status`, and
  `price_status` on `games`
- the premium foundation therefore treats those runtime statuses as optional
  hints, not as a required local dependency

## Lot 1 Implementation

New foundation added under:

- `backend/src/services/admin/enrichment/rules.js`
- `backend/src/services/admin/enrichment/scoring.js`
- `backend/src/services/admin/enrichment/evidence-service.js`
- `backend/src/services/admin/enrichment/coverage-service.js`
- `backend/src/services/admin/enrichment/target-selection-service.js`
- `backend/src/services/admin/enrichment/index.js`

Read-only CLI added:

- `backend/scripts/enrichment/recompute-enrichment-coverage.js`

## Canonical Premium Model

The premium layer is additive and does not replace existing stored statuses.

### Core outputs

- `completeness_score`
- `completion_tier`
- `is_top100_candidate`
- `is_publishable`

### Block weights

- identity: `25`
- editorial: `25`
- credits: `20`
- media: `20`
- music: `10`

### Identity gate

A game is not publishable and cannot be a top-100 premium candidate unless it
has all of:

- title
- console
- release year or release date
- cover
- summary or synopsis
- developer or publisher seed

### Tier rules

- `gold`: score `>= 85`, identity gate passed, and strong coverage across
  editorial, credits, media, and music
- `silver`: publishable and score `>= 70`
- `bronze`: publishable and score `>= 55`
- `none`: below the publishable premium floor

### Top 100 candidate rule

A game becomes `is_top100_candidate = true` only if:

- it is publishable
- `completeness_score >= 60`
- and it already shows meaningful richness in credits, media, or music

## Why No New Tables Yet

The requested future tables remain deferred for now:

- `game_enrichment_jobs`
- `game_enrichment_coverage`
- `game_enrichment_evidence`

Reason:

- `game_curation_states` already stores actionable per-game lifecycle and
  coverage-adjacent state
- `quality_records` already stores persistent audit scoring
- `source_records` and `field_provenance` already provide canonical evidence
- `enrichment_runs` already exists for future pipeline run logging

Lot 2 or Lot 3 may still justify an additive queue table, but Lot 1 does not.

## Known Gaps Left Open Intentionally

- no durable top-100 queue persisted yet
- no worker orchestration yet
- no new evidence write path yet
- no prod sync automation for premium coverage yet
- no queue/job retry model yet
- no price v2 work

These remain explicit future lots, not implicit continuation.

## Validation Entry Point

Read-only premium coverage preview:

```powershell
node backend/scripts/enrichment/recompute-enrichment-coverage.js
```

Optional flags:

- `--candidate-limit=100`
- `--sample-limit=10`

Expected use:

- recompute premium coverage snapshot locally
- inspect tier distribution
- inspect top premium candidates
- keep publication decisions separate and explicit
