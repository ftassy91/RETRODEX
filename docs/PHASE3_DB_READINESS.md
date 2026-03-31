# Phase 3 DB Readiness

State verified on March 31, 2026.

## Step 1 - Media Reference Columns on `public.games`

Production verification through `information_schema.columns` confirms that these columns already exist:

- `youtube_id` (`text`)
- `youtube_verified` (`boolean`)
- `archive_id` (`text`)
- `archive_verified` (`boolean`)

No production DDL is required for this step.

## Step 2 - Enrichment Status Columns

Production verification confirms that these columns are still absent from `public.games`:

- `editorial_status`
- `media_status`
- `price_status`

Prepared DDL:

- [20260331_008_games_enrichment_status_columns.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_008_games_enrichment_status_columns.sql)

This SQL is prepared only. It must not be applied in production without explicit human validation.

## Step 3 - Dry Run `sync-supabase-ui-fields.js`

Command executed on March 31, 2026:

```powershell
node backend\scripts\sync-supabase-ui-fields.js
```

Observed result:

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

- the script runs successfully in dry-run mode
- no pending UI field sync is currently detected
- no conflicts were reported

## Step 4 - Legacy `console` / `developer` Transition

Current production runtime still depends on:

- `games.console`
- `games.developer`

That dependency is active in public runtime behavior and must be preserved during any future FK transition.

Recommended compatibility-first sequence:

1. Keep `games.console` and `games.developer` as the public runtime contract during the first DB transition pass.
2. Introduce future FK columns only as additive schema changes, with no immediate runtime cutover.
3. Backfill FK references from normalized registries in a separate migration or script pass.
4. Update read models and services to support dual-read compatibility:
   - prefer FK-backed joins when data is complete
   - continue serving legacy string fields until parity is proven
5. Add audit queries to measure remaining rows without FK coverage.
6. Only after parity is complete:
   - switch canonical internal readers to FK-first
   - keep string fields as compatibility mirrors for one additional transition window
7. Consider removal of legacy strings only after production validation, smoke parity, and explicit human approval.

## Phase 3 Gate

Phase 3 can continue.

What remains blocked on human validation:

- applying the enrichment status DDL in production
- any wider migration that would change the runtime contract for `console` or `developer`
