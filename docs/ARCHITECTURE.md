# RetroDex Architecture

## Status

State consolidated on March 31, 2026.

- Public runtime: Supabase-first via `db_supabase.js`
- Local runtime: same public route topology as production
- Legacy Sequelize routes: kept in the repo, not mounted by default

## Request Flow

### Contextual Search

1. The browser calls `/api/market/search`, `/api/dex/search`, or `/api/collection/search`.
2. [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) mounts [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js).
3. [contextual.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search/contextual.js) and [dex.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search/dex.js) only parse HTTP parameters and delegate.
4. [public-contextual-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-contextual-search-service.js) orchestrates the search read model.
5. [public-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-search-service.js) and its readers call [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js).
6. [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js) aligns DTO shape.

### Catalog, Games, Consoles, Stats

1. The browser calls `/api/items`, `/api/games/*`, `/api/consoles*`, or `/api/stats`.
2. [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js) mounts the canonical domain routers:
   - [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games/index.js)
   - [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/index.js)
   - [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises/index.js)
3. Route files stay thin:
   - [list.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games/list.js)
   - [detail.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games/detail.js)
   - [archive.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games/archive.js)
   - [encyclopedia.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games/encyclopedia.js)
   - [items.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/items.js)
   - [catalog.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/catalog.js)
   - [stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/stats.js)
4. Supabase readers live in:
   - [public-game-reader.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-game-reader.js)
   - [public-publication-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-publication-service.js)
   - [public-console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-console-service.js)
   - [public-runtime-payload-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-runtime-payload-service.js)
5. Readers call [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js).
6. Runtime normalization goes through [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js).

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

### Compatibility Status

The old flat public route wrappers were removed after the canonical domain tree became the only mounted runtime surface.

Explicit admin/back-office routes continue to exist under [backend/src/routes/admin](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin), but they are not mounted by default in the public runtime.

### Canonical Services

- [public-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-search-service.js)
- [public-contextual-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-contextual-search-service.js)
- [public-game-reader.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-game-reader.js)
- [public-publication-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-publication-service.js)
- [public-console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-console-service.js)
- [public-runtime-payload-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-runtime-payload-service.js)
- [public-price-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-price-service.js)
- [public-collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-collection-service.js)

### Middleware

- [auth.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/middleware/auth.js)
- [error.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/middleware/error.js)

### Config

- [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js): Supabase environment resolution and runtime DB context
- [database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/database.js): canonical `src/config` DB entrypoint
- [backend/config/database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/config/database.js): underlying Sequelize bootstrap
- [backend/src/database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/database.js): compatibility shim

## Frontend Structure

Current Phase 2 structure now present in `public/js`:

- [backend/public/js/core](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/core)
- [backend/public/js/features](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/features)
- [backend/public/js/pages](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/pages)
- [backend/public/js/components](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/components)

`renderGameRow` is now mirrored in [render-game-row.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/components/render-game-row.js) so shared UI blocks have an explicit component directory without breaking the historical browser path [renderGameRow.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/renderGameRow.js).

## Verified Supabase Tables

Volumes observed in production during the Phase 1 audit.

| Table | Role | Volume |
| --- | --- | ---: |
| `games` | public compatibility table and runtime identity | 1517 |
| `collection_items` | user collection | 10 |
| `game_editorial` | detailed editorial data | 1418 |
| `media_references` | external media references | 2129 |
| `game_content_profiles` | content relevance profile | 1491 |
| `game_curation_states` | curation and publication status | 1491 |
| `game_curation_events` | curation journal | 1491 |
| `console_publication_slots` | published console showcases | 351 |
| `quality_records` | quality scoring | 1516 |
| `source_records` | source provenance | 5414 |
| `field_provenance` | field-level provenance | 15075 |
| `people` | people registry | 798 |
| `game_people` | game-person join table | 2957 |
| `ost` | OST entities | 979 |
| `ost_tracks` | OST tracks | 186 |
| `ost_releases` | OST releases | 0 |
| `price_history` | current runtime price history | 15182 |

## Naming Rules

- Database: `snake_case`
- Runtime DTOs: `camelCase`
- Normalization: [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js)
- Active routes must not reimplement `snake_case -> camelCase` locally

## Data Layer Rules

- Active route files may:
  - parse parameters
  - call services/readers
  - map HTTP status codes
- Active DB reads must go through [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js)
- Active routes must not import Sequelize models directly
- Sequelize remains allowed for:
  - models
  - migrations
  - local bootstrap
  - explicitly isolated legacy surfaces

## Important State

- The active public runtime is converged to Supabase-first readers.
- Production remains string-driven on `games.console` and `games.developer`.
- `console_id` and `developer_id` are not the effective runtime contract yet.
- Editorial and provenance canonical tables already exist in production and are already read by the backend.
- The historical Phase 3 v1 status backfill is already applied in production.
- The future `price_status v2` rule stays suspended until real `ebay` ingestion exists in `price_history`.

## Legacy and Transition References

- Remaining flat routes, retained legacy services, and removal candidates are tracked in [LEGACY_AUDIT.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/LEGACY_AUDIT.md).
- The additive future strategy for `console` and `developer` lives in [CONSOLE_DEVELOPER_TRANSITION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CONSOLE_DEVELOPER_TRANSITION.md).
- The factual DB state for Phase 3 status work lives in [PHASE3_DB_READINESS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_DB_READINESS.md).
