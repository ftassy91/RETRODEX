# RetroDex -- Project Map

## Status

This file is a quick orientation map.
It is not the canonical decision source.

Read first:
1. [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/DECISIONS.md)

## Canonical source map

- [backend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/) -> canonical public runtime + back-office code
- [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/) -> active public UI
- [backend/src/routes/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/) -> canonical public route tree
- [backend/src/services/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/) -> canonical public logic
- [backend/src/routes/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/) -> admin route tree
- [backend/src/services/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/) -> admin logic
- [backend/db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js) -> public runtime source of truth
- [backend/storage/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/storage/) -> local staging data only

## Secondary and legacy areas

- [frontend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/frontend/) -> secondary prototype / exploration area
- [RETRODEXseedV0/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/) -> legacy visual/archive reference
- [backend/src/_quarantine/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/) -> inactive quarantine area
- [docs/_superseded/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded/) -> historical docs, non-canonical

## Do not modify casually

- `frontend/data/*.js` -> static prototype data
- `frontend/js/top-screen*.js` -> deterministic prototype generator logic
- `backend/storage/*.sqlite*` -> local DB artifacts, modify only through controlled scripts
- `RETRODEXseedV0/` -> archive/reference only

## Main entry points

- public entry: [backend/public/hub.html](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/hub.html)
- public server: [backend/src/server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
- public routes: [backend/src/routes/index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js)
- main guidance: [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)

## Quick rule

If unsure where work belongs:
- public product work starts in `backend/public` + public routes/services
- admin/enrichment work starts in `backend/src/services/admin`
- prototype exploration only goes into `frontend/` when the lot explicitly says so
