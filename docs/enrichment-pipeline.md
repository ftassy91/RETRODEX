# Enrichment Pipeline

## Requirements

- dry-run first
- idempotent where possible
- restartable
- logged
- source-aware
- validation-first
- duplicate-safe

## Pipeline stages

1. intake
2. source policy check
3. schema validation
4. entity matching
5. duplication check
6. write to canonical tables
7. provenance write
8. quality recomputation
9. audit report refresh

## Validation gates

- title match confidence
- platform match
- year coherence
- region coherence when relevant
- source legality / contractual status
- asset storage policy compliance

## Output artifacts

- `enrichment_runs`
- structured error log
- summary JSON under `data/audit/`
- affected entity IDs
- counts by inserted / updated / skipped / blocked
- strategic manifest under `data/strategic_catalogs.json`
- import CLI: `backend/scripts/import-catalog.js`
- canonical backfill CLI: `backend/scripts/backfill-canonical.js`

## Catalog policy

- DS / 3DS run in `identity-first` mode during this tranche.
- Broad ingestion is blocked until provenance and scoring are written for each entity.

## Canonical backfill rules

- Legacy backfill is a controlled pipeline, not an ad hoc SQL patch.
- It must be:
  - rerunnable
  - duplicate-safe
  - logged in `enrichment_runs`
  - provenance-writing by default
- `price_history -> price_observations` uses stable `listing_reference` values derived from legacy row IDs so repeated runs do not duplicate observations.
- Canonical backfill writes internal provenance when upstream source detail is absent in the legacy dataset, and must state that limitation explicitly in `source_records.notes`.
- After any backfill or import run, `backend/scripts/run-audit.js` must be executed so `quality_records` and JSON audit outputs remain synchronized with the database.
