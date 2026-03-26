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

## Catalog policy

- DS / 3DS run in `identity-first` mode during this tranche.
- Broad ingestion is blocked until provenance and scoring are written for each entity.
