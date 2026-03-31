# Phase 3 Backfill Execution Report

Executed on March 31, 2026.

This document records the actual production execution of the `games` status backfill.

Canonical rules:

- [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js)

SQL artifacts used:

- preview: [20260331_009_games_status_backfill_preview.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_009_games_status_backfill_preview.sql)
- apply: [20260331_010_games_status_backfill_apply.sql](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_010_games_status_backfill_apply.sql)

## 1. Pre-Apply Preview

The production preview was re-run immediately before apply and matched the validated baseline:

- `totalGamesAudited = 1517`
- `missingDerivedCount = 0`
- `allGamesHaveDerivedStatuses = true`

Pre-apply stored counts:

- `editorial_status`
  - `empty = 1517`
- `media_status`
  - `empty = 1517`
- `price_status`
  - `empty = 1517`

Pre-apply divergence counts:

- `editorial_status = 1444`
- `media_status = 1400`
- `price_status = 1517`
- `any_status = 1517`

## 2. Apply Result

The production apply was executed manually against the approved SQL artifact.

Observed result:

- SQL command: `UPDATE`
- affected rows: `1517`

## 3. Post-Apply Verification

The production preview was re-run immediately after apply.

Verification result:

- `totalGamesAudited = 1517`
- `missingDerivedCount = 0`
- `allGamesHaveDerivedStatuses = true`

Stored counts after apply:

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

Derived counts after apply:

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

Post-apply divergence counts:

- `editorial_status = 0`
- `media_status = 0`
- `price_status = 0`
- `any_status = 0`

## 4. Outcome

The production database is now aligned with the canonical derived status rules for:

- `editorial_status`
- `media_status`
- `price_status`

No rollback was required.
