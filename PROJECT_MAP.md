# RetroDex -- Project Map

## Status

This file is a quick orientation map.
It is not the canonical decision source.

Read first:
1. [AGENTS.md](./AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](./docs/DECISIONS.md)

## Canonical source map

- [backend/](./backend/) -> canonical public runtime + back-office code
- [backend/public/](./backend/public/) -> active public UI
- [backend/src/routes/](./backend/src/routes/) -> canonical public route tree
- [backend/src/services/](./backend/src/services/) -> canonical public logic
- [backend/src/routes/admin/](./backend/src/routes/admin/) -> admin route tree
- [backend/src/services/admin/](./backend/src/services/admin/) -> admin logic
- [backend/db_supabase.js](./backend/db_supabase.js) -> public runtime source of truth
- [backend/storage/](./backend/storage/) -> local staging data only

## Secondary and legacy areas

- [frontend/](./frontend/) -> secondary prototype / exploration area
- [RETRODEXseedV0/](./RETRODEXseedV0/) -> legacy visual/archive reference
- [backend/src/_quarantine/](./backend/src/_quarantine/) -> inactive quarantine area
- [docs/_superseded/](./docs/_superseded/) -> historical docs, non-canonical

## Do not modify casually

- `frontend/data/*.js` -> static prototype data
- `frontend/js/top-screen*.js` -> deterministic prototype generator logic
- `backend/storage/*.sqlite*` -> local DB artifacts, modify only through controlled scripts
- `RETRODEXseedV0/` -> archive/reference only

## Main entry points

- public entry: [backend/public/hub.html](./backend/public/hub.html)
- public server: [backend/src/server.js](./backend/src/server.js)
- public routes: [backend/src/routes/index.js](./backend/src/routes/index.js)
- main guidance: [AGENTS.md](./AGENTS.md)

## Quick rule

If unsure where work belongs:
- public product work starts in `backend/public` + public routes/services
- admin/enrichment work starts in `backend/src/services/admin`
- prototype exploration only goes into `frontend/` when the lot explicitly says so
