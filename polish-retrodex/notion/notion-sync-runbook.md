# Polish RetroDex — Notion Sync Runbook

## Principle
- No direct uncontrolled Notion writes.
- All operational visibility must pass through the existing RetroDex sync governance.
- Default mode is preview only.

## Modes
- `npm run prd:notion -- --run-id=<id> --dry-run`
  - generates a local preview payload
  - does not create Notion staging files
- `npm run prd:notion -- --run-id=<id> --stage`
  - stages a single `sync_log` summary through `scripts/sync/sync-gate.js`
  - keeps richer PRD payloads local until mapping is validated

## Current v1 behavior
- Generates local preview for:
  - PRD Sources
  - PRD Ingestion Runs
  - PRD Review Queue
  - PRD Assets Ready
  - PRD Coverage Dashboard
- Uses the existing sync gate only for safe summary staging.

## Approval workflow
1. Run preview locally.
2. Inspect the generated preview JSON.
3. If needed, run with `--stage`.
4. Review staged pending files with the existing sync-gate commands.
5. Approve manually outside the pipeline.

## Constraints
- No assumption that dedicated PRD databases already exist in Notion.
- No background auto-approval.
- No production write without an explicit human approval step.
