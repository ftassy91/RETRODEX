# RetroDex - Development Workflow

## Triangle Claude / Codex / Notion
- Claude = Architecture, audit, planning
- Codex = Code changes, validation, commits
- Notion = Project memory and tracking

## Canonical work locations
- Repository root work happens in `RETRODEXseed`.
- Backend work happens in `backend/`.
- Active public UI work happens in `backend/public/`.
- `frontend/` is a secondary prototype area and should only be touched explicitly.

## Session flow
1. Read [docs/setup_runbook.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/setup_runbook.md).
2. Confirm whether the task belongs to canonical runtime/back-office work in `backend/` or explicit prototype work in `frontend/`.
3. Make one focused change set at a time.
4. Test over `http://`, never `file://`.
5. If the work changes project state, record a local sync event with `scripts/sync/local_sync.py`.
6. If the work prepares a future import file, validate it first with `scripts/import/validate_import.py`.
7. Record a checkpoint after a meaningful stage.

## Absolute rules
- Backend port = 3000
- Prototype frontend port = 8080 when that surface is explicitly used
- Test on `http://`, never `file://`
- One focused task = one coherent commit
- Work inside `RETRODEXseed` only

## Controlled automation rules
- Root automation is local-only until explicitly expanded.
- Use `scripts/sync/` for logging and handoff preparation, not live Notion writes.
- Use `scripts/import/` for validation and audit trails, not ingestion.
- Use `scripts/sync/sync-gate.js` only for one staged payload at a time and only after manual dry-run review.
- Do not enable broader automation until schemas are stable, root scripts are verified, and manual review gates remain in place.
