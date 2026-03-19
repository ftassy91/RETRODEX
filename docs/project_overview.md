# RetroDex - Project Overview
RetroDex is currently organized around one repository root and two active app surfaces.

## Canonical workspace
- Repository root: `RETRODEXseed`
- Canonical backend: `backend/`
- Canonical frontend: `frontend/`

## What lives where
- `backend/` serves the API, the SQLite database, and the beginner HTML pages on port 3000.
- `frontend/` contains the static 3DS-style frontend, RetroMarket UI, local datasets, and frontend assets on port 8080.
- Root `docs/`, `scripts/`, `logs/`, `assets/`, and `data/` are repository-level support folders for the normalized Dev Trinity structure.

## Current data snapshot
- 507 catalog games
- 16 consoles
- 120 verified RetroMarket sales records

## Current module status
- `backend/`: operational
- `frontend/index.html`: operational
- `frontend/modules/retromarket/market.html`: operational
- `frontend/modules/collection/index.html`: placeholder
- `frontend/modules/neoretro/index.html`: placeholder

## Controlled automation status
- `scripts/sync/`: active for local JSONL sync and task/progress event logging
- `scripts/sync/sync-gate.js`: active for one staged Notion payload at a time
- `scripts/import/`: active for local import validation and attempt logging
- Notion writes: not active at the root level
- Autonomous loops: not active
