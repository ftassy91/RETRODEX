# JTASSY Baseline Inventory

Reference baseline: `70eb99f64449ac6c2daa27f18b63597078ee13b5`

## Stable product baseline
- `backend/` is the runtime product surface.
- `backend/public/` is the primary UI surface.
- `frontend/` remains a secondary prototype.
- `RETRODEXseedV0/` is legacy and must stay read-only.
- `backend/enrich-database/` is the canonical enrichment path established by JTASSY.

## Divergences confirmed on 2026-03-30
- The current worktree is dirty across `backend/`, `scripts/`, `data/`, and `RETRODEXseedV0/`.
- The canonical enrichment path was displaced to `backend/enrich database/`.
- Additional data tooling exists outside the baseline:
  - `polish-retrodex/`
  - `data/audit/`
  - `data/manifests/`
  - `data/publish/`
- The game detail surface already loads more knowledge than it displays:
  - `summary`, `synopsis`, `lore`, `gameplay_description`
  - `characters`, `dev_team`, `dev_anecdotes`, `cheat_codes`
  - `manual_url`, `ost_composers`, `ost_notable_tracks`

## Reintegrated in this pass
- The game detail knowledge contract was normalized around existing endpoints:
  - `/api/games/:id`
  - `/api/games/:id/archive`
  - `/api/games/:id/encyclopedia`
- `archive` now carries:
  - `production`
  - `media`
  - `ost.releases`
- The UI change remains scoped to the game detail page only.

## Still outside the preserved baseline
- `RETRODEXseedV0/` local modifications
- non-baseline archives, logs, manifests, and ad hoc scripts
- `polish-retrodex/` as enrichment tooling until it is reintroduced through runtime-compatible adapters
