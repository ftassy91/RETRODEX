# RetroDex Setup Runbook

## Canonical repository root
All work happens inside `RETRODEXseed`.

This repository currently has two active execution surfaces:
- `backend/` as the canonical runtime and public UI surface
- `frontend/` as a secondary prototype surface only when a lot explicitly targets it

## How the repository is organized

### `backend/`
- Node.js / Express / Sequelize application
- SQLite storage in `backend/storage/retrodex.sqlite`
- Reads frontend source data from `frontend/data/`
- Serves the backend UI and API on port `3000`

### `frontend/`
- Secondary prototype / exploration area
- Main entry points:
  - `launcher.html`
  - `index.html`
  - `modules/retromarket/market.html`
- Serves on port `8080` when launched locally

### Root support folders
- `docs/` = repository docs and runbooks
- `scripts/` = repository-level helpers and future normalized automation
- `logs/` = checkpoints and audit logs
- `assets/` and `data/` = normalized root-level placeholders for future shared resources

These root support folders exist to stabilize the repo structure first. They are not yet the primary source of frontend data or assets.

## Local launch

### Backend
From the repo root, use:

```powershell
.\run_backend.bat
```

Backend URL:

```text
http://localhost:3000/home.html
```

Internal back-office surfaces:

```text
http://localhost:3000/debug.html
http://localhost:3000/completion.html
```

### Prototype frontend
From the repo root, use:

```powershell
.\run_frontend.bat
```

The script serves `frontend/` directly on port `8080`.

Frontend URL:

```text
http://localhost:8080/launcher.html
```

## Backend reseed
The backend reseed reads from:

```text
frontend/data/
```

Manual reseed command:

```powershell
cd .\backend
cmd /c npm run sync
```

## Minimal root automation

### `scripts/sync/`
The root sync module is now active for local-only event recording.

Use it to record:
- sync milestones
- task state changes
- progress checkpoints that may later be mirrored to Notion

Entry point:

```powershell
python scripts/sync/local_sync.py --event-kind progress --area automation --summary "Recorded a local automation milestone" --status completed --task-id DEV-TRINITY-001
```

Current outputs:
- `logs/sync/local_sync_log.jsonl`
- `logs/sync/task_progress_events.jsonl`
- `logs/sync/latest_sync_event.json`

Current limit:
- Notion is represented only by a disabled handoff block in the event payload.
- A separate Node gate now exists for staged Notion sync writes; see `docs/notion-sync-runbook.md`.

### `scripts/import/`
The root import module is now active for validation only.

Use it to:
- validate candidate game import files
- validate candidate asset import files
- record import attempt outcomes before any ingestion work starts

Entry point:

```powershell
python scripts/import/validate_import.py --kind games --input path\to\candidate_games.json
```

Current outputs:
- `logs/import/import_attempts.jsonl`
- `logs/import/latest_import_report.json`

Current limit:
- validation only; nothing is imported into runtime data yet

### Minimal Notion sync gate
The staged Notion sync path is now available for one explicit event at a time.

Use it to:
- stage one local payload
- list pending payloads
- generate a dry-run preview
- stop for manual review before any external write

Runbook:
- [docs/notion-sync-runbook.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/notion-sync-runbook.md)

## Contributor rules
- Treat `backend/public/` as the canonical frontend location.
- Treat `backend/` as the canonical runtime location.
- Treat `frontend/` as a prototype area, not the default product surface.
- Treat `/completion.html` and `/api/audit/completion` as the canonical internal completeness read surface.
- Do not introduce new dependencies on external workspaces.
- Do not assume the root `assets/` and `data/` folders have already absorbed the legacy frontend resources.
- Prefer targeted corrections over broad migration.
- Keep root automation explicit, local-only, and reviewable.

## Current limits
- Collection and Neo Retro are still placeholder modules.
- Root-level `scripts/sync/` and `scripts/import/` are intentionally minimal and do not replace legacy pipelines yet.
- Broad Notion write automation is not enabled.
- The Notion gate is manual and single-write only.
- Market import execution is not enabled at the root level.
- Autonomous watchers and loops are not enabled.
- Admin completeness routes are intended for local/admin runtime, not the main public product surface.
