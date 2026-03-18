# Notion Sync Runbook

## Scope
This runbook covers the minimal gated Notion sync flow for `RETRODEXseed`.

The current gate is intentionally narrow:
- local stage only
- local list of pending events
- local dry-run payload preview
- one explicit approve command for one minimal Notion write

Broad automation remains disabled.

## Files
- `scripts/sync/notion.config.js`
- `scripts/sync/validate-payload.js`
- `scripts/sync/sync-gate.js`
- `.env`
- `.env.example`

## Environment
Populate `.env` with:
- `NOTION_API_KEY`
- `NOTION_DB_SYNC_LOG`
- `NOTION_DB_DEV_TASKS`

The current database IDs are already set in `.env.example`.

## Manual prerequisites
Before any approved write:
1. confirm the Notion integration is shared with the target database
2. confirm the API token is real and current
3. review the staged payload locally
4. approve only one pending file at a time

## Commands
Stage one sync log event:

```powershell
node scripts/sync/sync-gate.js stage sync_log '{\"session\":\"S17 - Phase 2 validation\",\"tool\":\"Manual\",\"type\":\"Validate data\",\"status\":\"Success\",\"area\":\"Notion Sync\",\"date\":\"2026-03-18\",\"summary\":\"Premier cycle stage-approve. Phase 2 Minimal Automation Enablement validee.\",\"errors\":\"\"}'
```

List pending staged events:

```powershell
node scripts/sync/sync-gate.js list
```

Show the dry-run preview for one staged event:

```powershell
node scripts/sync/sync-gate.js dryrun logs/audit/pending/sync_log_..._pending.json
```

Approve one staged event:

```powershell
node scripts/sync/sync-gate.js approve logs/audit/pending/sync_log_..._pending.json
```

## Current write scope
The approve command is intentionally minimal.

It resolves the target database title property at approval time and creates exactly one new page with:
- one parent database target
- one title value

It does not write the full payload into multiple Notion properties yet.

## What is intentionally not automated yet
- no polling or continuous sync loop
- no automatic approval
- no bulk staging or bulk writes
- no broad database fan-out
- no market pipeline sync
- no mass legacy metadata normalization
