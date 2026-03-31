# Phase 3 DB Readiness

State re-verified on March 31, 2026.

## Production Verification

Production `information_schema.columns` confirms that `public.games` already contains these seven columns:

- `youtube_id` (`text`)
- `youtube_verified` (`boolean`)
- `archive_id` (`text`)
- `archive_verified` (`boolean`)
- `editorial_status` (`text`, default `'empty'`)
- `media_status` (`text`, default `'empty'`)
- `price_status` (`text`, default `'empty'`)

Phase 3 was therefore not a DDL phase for these fields. The DDL was already applied in production. The canonical backfill of the three status columns has now also been executed in production.

## Dry Run `sync-supabase-ui-fields.js`

Command executed on March 31, 2026:

```powershell
node backend\scripts\sync-supabase-ui-fields.js
```

Observed dry-run result:

```json
{
  "apply": false,
  "totalLocalRows": 1491,
  "matchedRemoteRows": 1517,
  "pendingUpdates": 0,
  "skippedConflicts": 0,
  "fallbackSlugUpdates": 0,
  "fieldCounts": {},
  "sample": [],
  "conflictSample": []
}
```

Interpretation:

- the script runs cleanly in dry-run mode
- no pending UI field sync is currently detected
- no conflicts were reported

## Backfill Artifacts

Canonical rules live in [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js).

Generated SQL artifacts:

- preview only: [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)
- apply prepared only: [20260331_010_games_status_backfill_apply.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_010_games_status_backfill_apply.sql)

Dry-run audit script:

- [audit-games-status-columns.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/audit-games-status-columns.js)
- human approval dossier: [PHASE3_BACKFILL_APPROVAL.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_APPROVAL.md)
- execution report: [PHASE3_BACKFILL_EXECUTION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_EXECUTION.md)

Rules:

- preview SQL is generated, never hand-edited
- apply SQL is generated, never hand-edited
- the audit script validates generated SQL against the canonical rules module
- the production `UPDATE` was executed on March 31, 2026 after explicit human validation

## Current Audit Snapshot

Post-apply audit on March 31, 2026:

- `totalGamesAudited = 1517`
- `missingDerivedCount = 0`
- `allGamesHaveDerivedStatuses = true`

Derived counts:

- `editorial_status`: `complete = 537`, `partial = 907`, `empty = 73`
- `media_status`: `complete = 4`, `partial = 1396`, `empty = 117`
- `price_status`: `real = 1517`, `synthetic = 0`, `empty = 0`

Stored counts after backfill:

- `editorial_status`: `complete = 537`, `partial = 907`, `empty = 73`
- `media_status`: `complete = 4`, `partial = 1396`, `empty = 117`
- `price_status`: `real = 1517`, `synthetic = 0`, `empty = 0`

Divergences after backfill:

- `editorial_status = 0`
- `media_status = 0`
- `price_status = 0`
- `any_status = 0`

## Canonical Status Rules

Rules version: `phase3-games-status-v1`

### `editorial_status`

- `complete` if `summary` or `synopsis` is substantive (minimum 70 chars) and at least 2 additional signals exist among:
- `lore`
- `gameplay_description`
- `characters`
- `dev_anecdotes`
- `cheat_codes`
- `versions`
- `avg_duration_main`
- `avg_duration_complete`
- `speedrun_wr`
- `partial` if at least one editorial signal exists
- `empty` otherwise

### `media_status`

- `complete` if at least 2 distinct media signals exist among:
- `manual`
- `map`
- `sprite_sheet`
- `ending`
- `archive_item`
- `youtube_video`
- `screenshot`
- `scan`
- `partial` if at least one visible media signal exists, including fallback via:
- `manual_url`
- `youtube_id`
- `archive_id`
- `cover_url`
- visible media rows exclude `ui_allowed = false`, `license_status = blocked`, and `healthcheck_status IN (broken, timeout)`
- `empty` otherwise

### `price_status`

- `real` if at least one `price_history` row exists with a non-synthetic source
- `synthetic` if `price_history` rows exist but only with synthetic sources
- `empty` otherwise

### `SYNTHETIC_PRICE_SOURCES`

- `seed`
- `seed_local`
- `synthetic`
- `mock`
- `fixture`

- `pricecharting` is treated as `real`

## Legacy `console` / `developer` Strategy

Current production runtime still depends on:

- `games.console`
- `games.developer`

That dependency remains active in public behavior and must be preserved during the transition. Phase 3 does not introduce FK columns, backfill FK values, or change the runtime contract.

Compatibility-first sequence:

1. Keep `games.console` and `games.developer` as the runtime contract during this phase.
2. Plan any future FK work as additive schema only.
3. Require a later dual-read phase before any runtime cutover.
4. Require coverage audit before any FK-first transition.
5. Consider removing legacy strings only after explicit human approval and proven production parity.

## Phase 3 Gate

Phase 3 is complete for the status backfill work.

Still separate and not covered by this execution:

- any future schema or FK transition for `console` or `developer`
