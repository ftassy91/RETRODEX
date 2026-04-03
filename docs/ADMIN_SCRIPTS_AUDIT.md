# RetroDex Admin Scripts Audit

State reviewed on March 31, 2026.

Closure note:

- this remains a reference audit only
- no script refactor lot is currently open
- the project has no active technical lot by default after the admin/services stabilization

Scope limited to:

- [backend/scripts/run-audit.js](./backend/scripts/run-audit.js)
- [backend/scripts/run-pass1-curation.js](./backend/scripts/run-pass1-curation.js)
- [backend/scripts/run-pass1-enrichment-backlog.js](./backend/scripts/run-pass1-enrichment-backlog.js)

No deletion is approved in this audit. This document classifies first; any cleanup lot must come later.

## Decision Matrix

| Script | Role | Side effects | Current usage | Proposed status |
| --- | --- | --- | --- | --- |
| [backend/scripts/run-audit.js](./backend/scripts/run-audit.js) | recompute audit outputs and `quality_records` | migrations, DB upserts, JSON files on disk | documented, chained by `publish-sandbox-to-supabase.js`, manually runnable | `refactor` |
| [backend/scripts/run-pass1-curation.js](./backend/scripts/run-pass1-curation.js) | PASS 1 curation dataset, reports, optional persistence | migrations, disk reports always, DB writes only with `--apply` | documented, root npm scripts, chained by `publish-sandbox-to-supabase.js` | `refactor` |
| [backend/scripts/run-pass1-enrichment-backlog.js](./backend/scripts/run-pass1-enrichment-backlog.js) | PASS 1 backlog report generation | migrations, JSON + Markdown reports on disk | documented, root npm script, manual workflow | `garder` |

## Script Fiches

### `run-audit.js`

- Path:
  [backend/scripts/run-audit.js](./backend/scripts/run-audit.js)
- Role:
  recompute the local audit snapshot after data changes, regenerate timestamped audit reports, and refresh `quality_records`
- Direct dependencies:
  - [backend/src/database.js](./backend/src/database.js)
  - [backend/src/services/migration-runner.js](./backend/src/services/migration-runner.js)
  - [backend/src/services/admin/audit-service.js](./backend/src/services/admin/audit-service.js)
- Real side effects:
  - `lecture DB`: yes
  - `ecriture disque`: yes, timestamped JSON files under `data/audit`
  - `ecriture DB`: yes, via `upsertQualityRecord()` into `quality_records`
  - `migrations`: yes, `runMigrations(sequelize)` may apply pending local migrations before the audit work runs
- Real idempotence:
  - DB state is only partially idempotent: `quality_records` is recomputed through upserts, so rerunning converges the table state
  - filesystem output is not idempotent: each run creates new timestamped files
  - migration side effects mean it is not a pure read-only report command
- Current usage:
  - `manuel`: yes
  - `documente`: yes, in [docs/ENRICHMENT.md](./docs/ENRICHMENT.md) and [docs/enrichment-pipeline.md](./docs/enrichment-pipeline.md)
  - `teste`: no direct test found
  - `orchestrated`: yes, called by [publish-sandbox-to-supabase.js](./backend/scripts/publish-sandbox-to-supabase.js)
- Proposed status:
  `refactor`
- Why:
  the script is still alive and useful, but its contract is too implicit:
  - no explicit dry-run mode
  - writes both DB and disk
  - silently runs migrations first
  it should survive, but under a clearer back-office contract in a future lot

### `run-pass1-curation.js`

- Path:
  [backend/scripts/run-pass1-curation.js](./backend/scripts/run-pass1-curation.js)
- Role:
  build the PASS 1 curation dataset, always emit report files, and optionally persist curation state when `--apply` is passed
- Direct dependencies:
  - [backend/src/database.js](./backend/src/database.js)
  - [backend/src/services/migration-runner.js](./backend/src/services/migration-runner.js)
  - [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
- Real side effects:
  - `lecture DB`: yes
  - `ecriture disque`: yes, reports are always written under `data/audit`
  - `ecriture DB`: only with `--apply`
  - `migrations`: yes, pending local migrations are applied first
- DB writes in `--apply` mode:
  - upsert into `game_content_profiles`
  - upsert into `game_curation_states`
  - deactivate then upsert `console_publication_slots`
  - insert into `game_curation_events` with `ON CONFLICT(event_key) DO NOTHING`
- Real idempotence:
  - default mode is not read-only because it still writes report files and may run migrations
  - `--apply` is mostly convergent on state tables because it uses upserts
  - event insertion is guarded by a stable `event_key`, so duplicate event rows are avoided if inputs are unchanged
  - filesystem output remains non-idempotent because timestamps change on each run
- Current usage:
  - `manuel`: yes
  - `documente`: yes, in [docs/ENRICHMENT.md](./docs/ENRICHMENT.md)
  - `teste`: no direct script test found
  - `npm script`: yes, via root [package.json](./package.json)
  - `orchestrated`: yes, called by [publish-sandbox-to-supabase.js](./backend/scripts/publish-sandbox-to-supabase.js)
- Proposed status:
  `refactor`
- Why:
  this script is still part of a real workflow, but it mixes three responsibilities:
  - build dataset
  - write audit reports
  - optionally mutate curation tables
  the mode split is real, but still too implicit for a stable back-office contract

### `run-pass1-enrichment-backlog.js`

- Path:
  [backend/scripts/run-pass1-enrichment-backlog.js](./backend/scripts/run-pass1-enrichment-backlog.js)
- Role:
  generate the PASS 1 enrichment backlog report and write JSON + Markdown backlog outputs
- Direct dependencies:
  - [backend/src/database.js](./backend/src/database.js)
  - [backend/src/services/migration-runner.js](./backend/src/services/migration-runner.js)
  - [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
  - [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)
- Real side effects:
  - `lecture DB`: yes
  - `ecriture disque`: yes, JSON + Markdown reports under `data/audit`
  - `ecriture DB`: no direct write found
  - `migrations`: yes, pending local migrations are applied first
- Real idempotence:
  - DB state is effectively unchanged apart from any migration runner side effect
  - filesystem output is non-idempotent because each run creates timestamped report files
  - within a stable migrated schema, this behaves as a reproducible report generator
- Current usage:
  - `manuel`: yes
  - `documente`: yes, in [docs/ENRICHMENT.md](./docs/ENRICHMENT.md)
  - `teste`: no direct script test found
  - `npm script`: yes, via root [package.json](./package.json)
  - `orchestrated`: no orchestrator call found outside manual/npm usage
- Proposed status:
  `garder`
- Why:
  among the three, it has the cleanest contract:
  - no direct DB write
  - explicit report role
  - clear CLI parameters for selection limits
  it can remain as-is for now, with a later improvement only if the back-office reporting layer is redesigned

## Immediate Conclusions

- None of the three scripts should be removed in this lot.
- Two scripts deserve a dedicated refactor later:
  - [backend/scripts/run-audit.js](./backend/scripts/run-audit.js)
  - [backend/scripts/run-pass1-curation.js](./backend/scripts/run-pass1-curation.js)
- One script is currently acceptable to keep:
  - [backend/scripts/run-pass1-enrichment-backlog.js](./backend/scripts/run-pass1-enrichment-backlog.js)

## Recommended Follow-up After Validation

If Option B is opened later, the first priority should be the services that make these scripts possible:

- [backend/src/services/admin/audit-service.js](./backend/src/services/admin/audit-service.js)
- [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
- [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)

The purpose of that next lot would not be deletion by default, but contract clarification:

- explicit dry-run vs apply
- clearer write boundaries
- better separation between dataset build, persistence, and report emission
