# Phase 3 Backfill Decision Summary

State prepared on March 31, 2026.

Historical note:

- this decision summary was the final pre-apply decision sheet
- the production backfill was executed successfully on March 31, 2026
- see [PHASE3_BACKFILL_EXECUTION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_EXECUTION.md) for the executed result
- a later preview-only review on March 31, 2026 approved a future `price_status v2` rule in principle
- that future rule is suspended until the first `ebay` ingestion exists in `price_history`
- no second production backfill is authorized yet

## Expected Volumes

- `totalGamesAudited = 1517`
- `missingDerivedCount = 0`
- `allGamesHaveDerivedStatuses = true`

- `editorial_status`
  - `complete = 537`
  - `partial = 907`
  - `empty = 73`

- `media_status`
  - `complete = 4`
  - `partial = 1396`
  - `empty = 117`

- `price_status`
  - `real = 1517`
  - `synthetic = 0`
  - `empty = 0`

## Business Vigilance: `price_status`

The most sensitive point is `price_status`.

Under the current production dataset and canonical rule:

- `price_history` contains only `pricecharting` rows
- `pricecharting` is treated as a `real` source
- therefore `price_status = real` for all `1517` audited games

This must be accepted as an explicit business decision, not only as a technical outcome.

If that interpretation is not accepted, do **not** run the apply step. Revise the canonical rule first.

## Manual Procedure

### 1. Preview

Run:

- [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)

Confirm that the returned JSON still matches the expected volumes above.

### 2. Apply

Only after explicit human approval, run:

- [20260331_010_games_status_backfill_apply.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_010_games_status_backfill_apply.sql)

### 3. Re-preview

Immediately re-run:

- [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)

Confirm:

- `storedCounts` now match the expected derived volumes
- `derivedCounts` are unchanged
- `divergenceCounts.editorial_status = 0`
- `divergenceCounts.media_status = 0`
- `divergenceCounts.price_status = 0`
- `divergenceCounts.any_status = 0`

## Logical Rollback

If the apply has just been executed and post-apply verification does not match the preview baseline:

```sql
UPDATE public.games
SET
  editorial_status = 'empty',
  media_status = 'empty',
  price_status = 'empty'
WHERE type = 'game';
```

Then re-run the preview and confirm:

- `storedCounts.editorial_status.empty = 1517`
- `storedCounts.media_status.empty = 1517`
- `storedCounts.price_status.empty = 1517`

## Recommendation

Feu vert non recommande tant que la regle `price_status` n'est pas confirmee.
