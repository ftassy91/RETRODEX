# RetroDex Architecture

## Status

State stabilized on March 31, 2026.

- Public runtime: finalized, Supabase-first via `db_supabase.js`
- Public route tree: canonical and stabilized under `backend/src/routes/*`
- Back-office: isolated under `backend/src/routes/admin` and `backend/src/services/admin`
- Active technical lot by default: none

## Request Flow

### Search

1. The browser calls `/api/search/*`, `/api/dex/search`, or `/api/collection/search`.
2. [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) mounts [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js).
3. [global.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search/global.js), [contextual.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search/contextual.js), and [dex.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search/dex.js) only parse HTTP inputs and delegate.
4. [public-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-search-service.js) and [public-contextual-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-contextual-search-service.js) orchestrate reads through [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js).
5. [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js) aligns DTO shape.

### Games, Catalog, Consoles, Franchises

1. The browser calls `/api/games/*`, `/api/items`, `/api/consoles*`, `/api/franchises*`, or `/api/stats`.
2. [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js) mounts the canonical domain routers:
   - [backend/src/routes/games](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games)
   - [backend/src/routes/market](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market)
   - [backend/src/routes/franchises](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises)
3. Route files remain thin and only orchestrate HTTP.
4. Supabase readers live in:
   - [public-game-reader.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-game-reader.js)
   - [public-publication-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-publication-service.js)
   - [public-console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-console-service.js)
   - [public-runtime-payload-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-runtime-payload-service.js)
5. Runtime normalization goes through [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js).

### Collection

1. The browser calls `/api/collection*`.
2. [crud.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/collection/crud.js) and [stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/collection/stats.js) only handle HTTP parsing and response codes.
3. [public-collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-collection-service.js) owns collection reads and writes.

### Prices

1. The browser calls `/api/prices/*`.
2. [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices/index.js) delegates to [public-price-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-price-service.js).
3. The service reads `games` and `price_history` through [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js), with SQLite fallback kept inside the service.

## Backend Structure

### Active Route Tree

- [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js)
- [backend/src/routes/games](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games)
- [backend/src/routes/search](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search)
- [backend/src/routes/collection](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/collection)
- [backend/src/routes/market](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market)
- [backend/src/routes/franchises](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises)
- [backend/src/routes/prices](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices)
- [backend/src/routes/admin](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin)

No flat public or admin wrappers remain under `backend/src/routes`.

### Canonical Public Services

- [public-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-search-service.js)
- [public-contextual-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-contextual-search-service.js)
- [public-game-reader.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-game-reader.js)
- [public-publication-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-publication-service.js)
- [public-console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-console-service.js)
- [public-runtime-payload-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-runtime-payload-service.js)
- [public-price-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-price-service.js)
- [public-collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-collection-service.js)
- [public-accessory-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-accessory-service.js)
- [public-market-index-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-market-index-service.js)
- [public-market-report-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-market-report-service.js)

### Back-Office Services

The retained back-office layer lives under [backend/src/services/admin](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin).

Current stabilized structure:

- facades:
  - [game-read-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/game-read-service.js)
  - [curation-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/curation-service.js)
  - [audit-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/audit-service.js)
- isolated orchestrators:
  - [console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/console-service.js)
  - [enrichment-backlog-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/enrichment-backlog-service.js)
- implementation trees:
  - [backend/src/services/admin/game-read](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/game-read)
  - [backend/src/services/admin/curation](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/curation)
  - [backend/src/services/admin/audit](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/audit)
- pure helper profiles:
  - [console-profile.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/console-profile.js)
  - [enrichment-backlog-profile.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/enrichment-backlog-profile.js)

### Middleware

- [auth.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/middleware/auth.js)
- [error.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/middleware/error.js)

### Config

- [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js)
- [database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/database.js)
- [backend/config/database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/config/database.js)
- [backend/src/database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/database.js)

## Frontend Structure

- [backend/public/js/core](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/core)
- [backend/public/js/features](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/features)
- [backend/public/js/pages](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/pages)
- [backend/public/js/components](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/components)

`renderGameRow` is mirrored in [render-game-row.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/components/render-game-row.js) without breaking the historical browser path [renderGameRow.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/renderGameRow.js).

## Data Layer Rules

- Active public route files may parse parameters, call services/readers, and map HTTP status codes.
- Active public DB reads must go through [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js).
- Active public routes must not import Sequelize models directly.
- Sequelize remains allowed for models, migrations, local bootstrap, and explicitly isolated admin/back-office surfaces.

## DB State and Gates

- Production remains string-driven on `games.console` and `games.developer`.
- `console_id` and `developer_id` are not the effective runtime contract yet.
- `youtube_id`, `youtube_verified`, `archive_id`, `archive_verified`, `editorial_status`, `media_status`, and `price_status` already exist in production.
- The historical Phase 3 v1 status backfill is already applied in production.
- The future `price_status v2` rule stays suspended until real `ebay` ingestion exists in `price_history`.

References:

- [PHASE3_DB_READINESS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_DB_READINESS.md)
- [PHASE3_BACKFILL_EXECUTION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_EXECUTION.md)
- [CONSOLE_DEVELOPER_TRANSITION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CONSOLE_DEVELOPER_TRANSITION.md)

## Out of Scope / Not Active

- [backend/src/_quarantine/collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/collection-service.js)
- [backend/src/_quarantine/runtime-db-context.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/runtime-db-context.js)
- [20260331_007_collection_runtime_canonical.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- [docs/_superseded](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded)
- unrelated dirty worktree items tracked in [LEGACY_AUDIT.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/LEGACY_AUDIT.md)

## Final State

- The public runtime is finalized and stabilized.
- The admin/services cleanup lot is closed on its approved perimeter.
- No technical refactor lot is active by default.
- Any further work must open as a new explicit lot.
