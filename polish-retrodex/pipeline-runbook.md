# Polish RetroDex v1.0 — Pipeline Runbook

## Scope
This v1 pipeline discovers external source records, normalizes them, matches them against the local RetroDex corpus, publishes only safe external references, creates a review queue, stages visibility for Notion, and exports UI payloads.

## Commands
- `npm run prd:discover -- --source=pixel_warehouse --scope=platform:NES`
- `npm run prd:normalize -- --run-id=<id>`
- `npm run prd:match -- --run-id=<id>`
- `npm run prd:publish -- --run-id=<id> --dry-run`
- `npm run prd:review -- --run-id=<id>`
- `npm run prd:notion -- --run-id=<id> --dry-run`
- `npm run prd:ui-export -- --run-id=<id>`
- `npm run prd:pipeline -- --profile=dry-run-sample`

## Outputs
- `outputs/source_records.jsonl`
- `outputs/normalized_records.jsonl`
- `outputs/match_candidates.jsonl`
- `outputs/external_assets.jsonl`
- `outputs/review_queue.jsonl`
- `outputs/ui_payloads.jsonl`

## Persistence
- checkpoints: `logs/checkpoints/`
- markdown reports: `logs/run_reports/`
- human logs: `logs/pipeline.log`, `logs/errors.log`

## Safety
- No write to backend DB.
- No write to Supabase.
- No mass download of external assets.
- Notion stays preview/staging only.
