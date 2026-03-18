# Root Sync Module

This module records repository sync events locally and keeps the data explicit.

## What it does now
- writes a local sync log entry to `logs/sync/local_sync_log.jsonl`
- writes task/progress records to `logs/sync/task_progress_events.jsonl`
- refreshes `logs/sync/latest_sync_event.json`
- stores a Notion handoff placeholder in each event payload

## What it does not do yet
- no direct Notion writes
- no autonomous monitoring loop
- no deployment hooks
- no broad repository reconciliation

## Entry point
```powershell
python scripts/sync/local_sync.py --event-kind progress --area automation --summary "Recorded a controlled automation milestone" --status completed --task-id DEV-TRINITY-001
```

## Planned Notion plug-in point
Each sync event includes a `notion_sync` object with:
- `enabled: false`
- planned target databases
- activation requirements for later enablement

That keeps the contract visible without enabling live writes.

## Manual Notion gate
For one explicit staged payload at a time, use:
- `node scripts/sync/sync-gate.js stage <sync_log|dev_task> '<json>'`
- `node scripts/sync/sync-gate.js list`
- `node scripts/sync/sync-gate.js dryrun <stage-file>`
- `node scripts/sync/sync-gate.js approve <stage-file>`

The gate is still manual-first:
- no automatic approval
- no bulk write
- no background loop
