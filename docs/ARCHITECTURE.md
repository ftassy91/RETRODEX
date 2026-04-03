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
2. [server.js](./backend/src/server.js) mounts [index.js](./backend/src/routes/index.js).
3. [global.js](./backend/src/routes/search/global.js), [contextual.js](./backend/src/routes/search/contextual.js), and [dex.js](./backend/src/routes/search/dex.js) only parse HTTP inputs and delegate.
4. [public-search-service.js](./backend/src/services/public-search-service.js) and [public-contextual-search-service.js](./backend/src/services/public-contextual-search-service.js) orchestrate reads through [db_supabase.js](./backend/db_supabase.js).
5. [normalize.js](./backend/src/lib/normalize.js) aligns DTO shape.

### Games, Catalog, Consoles, Franchises

1. The browser calls `/api/games/*`, `/api/items`, `/api/consoles*`, `/api/franchises*`, or `/api/stats`.
2. [index.js](./backend/src/routes/index.js) mounts the canonical domain routers:
   - [backend/src/routes/games](./backend/src/routes/games)
   - [backend/src/routes/market](./backend/src/routes/market)
   - [backend/src/routes/franchises](./backend/src/routes/franchises)
3. Route files remain thin and only orchestrate HTTP.
4. Supabase readers live in:
   - [public-game-reader.js](./backend/src/services/public-game-reader.js)
   - [public-publication-service.js](./backend/src/services/public-publication-service.js)
   - [public-console-service.js](./backend/src/services/public-console-service.js)
   - [public-runtime-payload-service.js](./backend/src/services/public-runtime-payload-service.js)
5. Runtime normalization goes through [normalize.js](./backend/src/lib/normalize.js).

### Collection

1. The browser calls `/api/collection*`.
2. [crud.js](./backend/src/routes/collection/crud.js) and [stats.js](./backend/src/routes/collection/stats.js) only handle HTTP parsing and response codes.
3. [public-collection-service.js](./backend/src/services/public-collection-service.js) owns collection reads and writes.

### Prices

1. The browser calls `/api/prices/*`.
2. [index.js](./backend/src/routes/prices/index.js) delegates to [public-price-service.js](./backend/src/services/public-price-service.js).
3. The service reads `games` and `price_history` through [db_supabase.js](./backend/db_supabase.js), with SQLite fallback kept inside the service.

## Backend Structure

### Active Route Tree

- [index.js](./backend/src/routes/index.js)
- [backend/src/routes/games](./backend/src/routes/games)
- [backend/src/routes/search](./backend/src/routes/search)
- [backend/src/routes/collection](./backend/src/routes/collection)
- [backend/src/routes/market](./backend/src/routes/market)
- [backend/src/routes/franchises](./backend/src/routes/franchises)
- [backend/src/routes/prices](./backend/src/routes/prices)
- [backend/src/routes/admin](./backend/src/routes/admin)

No flat public or admin wrappers remain under `backend/src/routes`.

### Canonical Public Services

- [public-search-service.js](./backend/src/services/public-search-service.js)
- [public-contextual-search-service.js](./backend/src/services/public-contextual-search-service.js)
- [public-game-reader.js](./backend/src/services/public-game-reader.js)
- [public-publication-service.js](./backend/src/services/public-publication-service.js)
- [public-console-service.js](./backend/src/services/public-console-service.js)
- [public-runtime-payload-service.js](./backend/src/services/public-runtime-payload-service.js)
- [public-price-service.js](./backend/src/services/public-price-service.js)
- [public-collection-service.js](./backend/src/services/public-collection-service.js)
- [public-accessory-service.js](./backend/src/services/public-accessory-service.js)
- [public-market-index-service.js](./backend/src/services/public-market-index-service.js)
- [public-market-report-service.js](./backend/src/services/public-market-report-service.js)

### Back-Office Services

The retained back-office layer lives under [backend/src/services/admin](./backend/src/services/admin).

Current stabilized structure:

- facades:
  - [game-read-service.js](./backend/src/services/admin/game-read-service.js)
  - [curation-service.js](./backend/src/services/admin/curation-service.js)
  - [audit-service.js](./backend/src/services/admin/audit-service.js)
- isolated orchestrators:
  - [console-service.js](./backend/src/services/admin/console-service.js)
  - [enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)
- premium enrichment foundation:
  - [backend/src/services/admin/enrichment](./backend/src/services/admin/enrichment)
- implementation trees:
  - [backend/src/services/admin/game-read](./backend/src/services/admin/game-read)
  - [backend/src/services/admin/curation](./backend/src/services/admin/curation)
  - [backend/src/services/admin/audit](./backend/src/services/admin/audit)
- pure helper profiles:
  - [console-profile.js](./backend/src/services/admin/console-profile.js)
  - [enrichment-backlog-profile.js](./backend/src/services/admin/enrichment-backlog-profile.js)

The premium enrichment foundation remains additive and reuses existing canonical
tables such as `game_content_profiles`, `game_curation_states`,
`quality_records`, `source_records`, `field_provenance`, and
`enrichment_runs`. No new queue or evidence table is active by default.

### Middleware

- [auth.js](./backend/src/middleware/auth.js)
- [error.js](./backend/src/middleware/error.js)

### Config

- [env.js](./backend/src/config/env.js)
- [database.js](./backend/src/config/database.js)
- [backend/config/database.js](./backend/config/database.js)
- [backend/src/database.js](./backend/src/database.js)

## Frontend Structure

- [backend/public/js/core](./backend/public/js/core)
- [backend/public/js/features](./backend/public/js/features)
- [backend/public/js/pages](./backend/public/js/pages)
- [backend/public/js/components](./backend/public/js/components)

`renderGameRow` is mirrored in [render-game-row.js](./backend/public/js/components/render-game-row.js) without breaking the historical browser path [renderGameRow.js](./backend/public/js/renderGameRow.js).

## Data Layer Rules

- Active public route files may parse parameters, call services/readers, and map HTTP status codes.
- Active public DB reads must go through [db_supabase.js](./backend/db_supabase.js).
- Active public routes must not import Sequelize models directly.
- Sequelize remains allowed for models, migrations, local bootstrap, and explicitly isolated admin/back-office surfaces.

## DB State and Gates

- Production remains string-driven on `games.console` and `games.developer`.
- `console_id` and `developer_id` are not the effective runtime contract yet.
- `youtube_id`, `youtube_verified`, `archive_id`, `archive_verified`, `editorial_status`, `media_status`, and `price_status` already exist in production.
- The historical Phase 3 v1 status backfill is already applied in production.
- The future `price_status v2` rule stays suspended until real `ebay` ingestion exists in `price_history`.

References:

- [PHASE3_DB_READINESS.md](./docs/PHASE3_DB_READINESS.md)
- [PHASE3_BACKFILL_EXECUTION.md](./docs/PHASE3_BACKFILL_EXECUTION.md)
- [CONSOLE_DEVELOPER_TRANSITION.md](./docs/CONSOLE_DEVELOPER_TRANSITION.md)

## Out of Scope / Not Active

- [backend/src/_quarantine/collection-service.js](./backend/src/_quarantine/collection-service.js)
- [backend/src/_quarantine/runtime-db-context.js](./backend/src/_quarantine/runtime-db-context.js)
- [20260331_007_collection_runtime_canonical.js](./backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- [docs/_superseded](./docs/_superseded)
- unrelated dirty worktree items tracked in [LEGACY_AUDIT.md](./docs/LEGACY_AUDIT.md)

## Final State

- The public runtime is finalized and stabilized.
- The admin/services cleanup lot is closed on its approved perimeter.
- No technical refactor lot is active by default.
- Any further work must open as a new explicit lot.
