# Phase 3 Backfill Approval Dossier

State prepared on March 31, 2026.

Historical note:

- this approval dossier was used for the human decision before production execution
- the production backfill was executed successfully on March 31, 2026
- see [PHASE3_BACKFILL_EXECUTION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_EXECUTION.md) for the executed result

This document is the human validation dossier for the production apply step of the `games` status backfill.

It does **not** authorize execution by itself.

Canonical source of truth for the rules:

- [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js)

Supporting readiness document:

- [PHASE3_DB_READINESS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_DB_READINESS.md)

Prepared SQL artifacts:

- preview: [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)
- apply: [20260331_010_games_status_backfill_apply.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_010_games_status_backfill_apply.sql)

## 1. Expected Derived Volumes

Audit baseline on March 31, 2026:

- `totalGamesAudited = 1517`
- `missingDerivedCount = 0`
- `allGamesHaveDerivedStatuses = true`

Expected derived counts:

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

Current stored counts before apply:

- `editorial_status`
  - `empty = 1517`
- `media_status`
  - `empty = 1517`
- `price_status`
  - `empty = 1517`

Current divergence counts before apply:

- `editorial_status = 1444`
- `media_status = 1400`
- `price_status = 1517`
- `any_status = 1517`

## 2. Short Rule Summary

This section is intentionally short. The exact canonical rules remain in [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js).

- `editorial_status`
  - `complete` if `summary` or `synopsis` is substantive and at least 2 additional editorial signals exist
  - `partial` if at least one editorial signal exists
  - `empty` otherwise
- `media_status`
  - `complete` if at least 2 distinct complete media signals exist
  - `partial` if at least one visible media or fallback media signal exists
  - `empty` otherwise
- `price_status`
  - `real` if at least one non-synthetic price source exists
  - `synthetic` if only synthetic sources exist
  - `empty` otherwise

Canonical `SYNTHETIC_PRICE_SOURCES`:

- `seed`
- `seed_local`
- `synthetic`
- `mock`
- `fixture`

Important interpretation already locked:

- `pricecharting` is treated as `real`

## 3. Points of Vigilance

- The apply step will touch all `1517` rows in `public.games` where `type = 'game'`, because `price_status` currently diverges on every audited row.
- The apply step does not change schema, indexes, FKs, or runtime routing. It only updates 3 existing columns:
  - `editorial_status`
  - `media_status`
  - `price_status`
- If any active payloads currently expose these fields, clients will start receiving derived values instead of the current blanket `empty`.
- `price_status` will become `real` for all audited games under the current production dataset because `price_history` currently contains only `pricecharting` rows, and the canonical rule treats `pricecharting` as a real source.
- This is not only a technical outcome. It is an explicit business assumption of the backfill:
  - current `pricecharting` coverage is considered sufficient evidence to mark `price_status = real`
  - if that interpretation is not accepted, the backfill must remain blocked and the rule must be revised first
- `media_status = complete` is intentionally rare in the current ruleset. Expected count is `4`.
- No `console` / `developer` transition is included here. This apply does not affect the current string-driven runtime compatibility model.

## 4. Expected Impact of the Production Apply

Expected database effect:

- update `1517` audited game rows
- leave non-`game` rows untouched
- move stored counts to the exact derived baseline
- reduce `divergenceCounts` to zero across all 3 status columns

Expected post-apply stored counts:

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

Business interpretation to validate explicitly before apply:

- the production team accepts that `price_status = real` for all `1517` audited games is the intended meaning of the current rule set
- this relies on treating `pricecharting` as a real source for status purposes
- if this business interpretation is disputed, stop before apply and revise the canonical rule

Expected post-apply divergence counts:

- `editorial_status = 0`
- `media_status = 0`
- `price_status = 0`
- `any_status = 0`

## 5. Exact Manual Apply Procedure

Only execute this after explicit human approval.

### Step 0 - Re-run the preview immediately before apply

In the Supabase SQL editor on the production project:

1. Open [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)
2. Copy its full contents
3. Paste into the SQL editor
4. Run it
5. Confirm the returned JSON still matches the expected baseline in section 1

Do **not** continue if the preview no longer matches the baseline.

### Step 1 - Execute the apply SQL manually

In the same production SQL editor:

1. Open [20260331_010_games_status_backfill_apply.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_010_games_status_backfill_apply.sql)
2. Copy its full contents
3. Paste into the SQL editor
4. Run it as `postgres` on the production database

No automation. No script wrapper. No background apply.

## 6. Post-Apply Verification Procedure

Immediately after the apply:

1. Re-run [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)
2. Confirm all of the following:

- `totalGamesAudited = 1517`
- `missingDerivedCount = 0`
- `allGamesHaveDerivedStatuses = true`
- `storedCounts` exactly match the expected post-apply counts in section 4
- `derivedCounts` remain unchanged
- `divergenceCounts.editorial_status = 0`
- `divergenceCounts.media_status = 0`
- `divergenceCounts.price_status = 0`
- `divergenceCounts.any_status = 0`

If any of these checks fail, stop and do not run any further DB changes.

## 7. Logical Rollback Procedure

This rollback is intentionally simple because the known pre-apply baseline is:

- all audited `games.editorial_status = 'empty'`
- all audited `games.media_status = 'empty'`
- all audited `games.price_status = 'empty'`

Use this rollback only if:

- the apply has just been executed
- the post-apply preview does not match the expected baseline
- no other concurrent writes to these 3 status columns have been performed

Manual rollback SQL:

```sql
UPDATE public.games
SET
  editorial_status = 'empty',
  media_status = 'empty',
  price_status = 'empty'
WHERE type = 'game';
```

Rollback verification:

1. Re-run [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)
2. Confirm that:

- `storedCounts.editorial_status.empty = 1517`
- `storedCounts.media_status.empty = 1517`
- `storedCounts.price_status.empty = 1517`
- `divergenceCounts` return to the pre-apply baseline from section 1

If concurrent writes happened after apply, do **not** use the blanket rollback above. Stop and investigate first.

## 8. Human Decision Gate

Approve the production apply only if all of the following are true:

- the preview still matches the baseline immediately before apply
- the expected impact of updating `1517` audited game rows is acceptable
- the team explicitly accepts the business assumption that `price_status = real` for all `1517` audited games is correct under the current dataset and rules
- the team accepts that these three status columns will stop being uniformly `empty`
- the rollback path is understood and acceptable

If one of these conditions is not met, keep [20260331_010_games_status_backfill_apply.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_010_games_status_backfill_apply.sql) blocked.
