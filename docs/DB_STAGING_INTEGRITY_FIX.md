# DB Staging Integrity Fix

## Scope
- local staging only: `backend/storage/retrodex.sqlite`
- no Supabase / prod mutation
- no runtime public change

## Problem addressed
- `foreign_key_check` returned `2082` violations before the fix
- root cause:
  - missing `companies.id` entries referenced by `games.developerId` / `games.publisherId`
  - stale orphan rows in `game_genres`

## Conservative strategy
- preserve the current admin/enrichment pipeline
- prefer creating missing `companies` rows over rewriting `games`
- delete only pure orphans in `game_genres`
- add a read-only integrity audit script for future lots

## Official backup
- `C:\Users\ftass\OneDrive\Bureau\RETRODEXseed\backend\storage\retrodex.sqlite.backup_20260401_113805_db-integrity`

## Applied result
- before:
  - `integrity_check = ok`
  - `foreign_key_check = 2082`
  - `missingCompanies = 523`
  - `orphanGameGenres = 39`
- repair:
  - `523` `companies` rows created
  - `39` pure orphans deleted from `game_genres`
  - conservative naming:
    - `311` rows from trustworthy in-db names
    - `212` rows from slug-humanized fallback
- after:
  - `integrity_check = ok`
  - `foreign_key_check = 0`
  - `missingCompanies = 0`
  - `orphanGameGenres = 0`
  - `companies = 545`
  - `game_genres = 0`

## Non-regression checks
- `node scripts/audit-db-integrity.js` : OK
- `node scripts/enrichment/recompute-enrichment-coverage.js --candidate-limit=100 --sample-limit=5` : OK
- `node scripts/run-pass1-curation.js` : OK
- `node scripts/run-audit.js` : OK
- `node scripts/run-pass1-enrichment-backlog.js` : OK
- `npm run smoke` : OK

## Scripts
- read-only audit: [audit-db-integrity.js](/../backend/scripts/audit-db-integrity.js)
- one-shot repair used for this lot: [repair-staging-db-integrity.js](/../backend/scripts/repair-staging-db-integrity.js)

## Notes
- some missing companies had no reliable text name in `games`; for those, the repair script used a conservative humanized version of the existing slug ID
- ambiguous company IDs were not remapped across games; they were resolved conservatively by creating a compatible local master-data row instead of rewriting references
- `retrodex.sqlite` is a local staging artifact and is not currently versioned by Git in this workspace; the structural fix is therefore applied locally, while the repeatable logic lives in the scripts above
