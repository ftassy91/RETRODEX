# RetroDex Decisions

## References

- JTASSY baseline: `70eb99f64449ac6c2daa27f18b63597078ee13b5`
- Phase 0 / Phase 2 consolidation date: March 31, 2026

## JTASSY Decisions Kept

- `backend/enrich-database/` remains the Sprint 7 enrichment baseline.
- The game detail page keeps the three Knowledge Domains and the Production block as valid starting points.
- Migration `8896316` and already shipped product decisions are not reverted in this pass.

## Validated Architecture Decisions

- Production and local now use the same public route topology.
- The canonical active route tree is materialized under:
  - [backend/src/routes/games](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games)
  - [backend/src/routes/search](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/search)
  - [backend/src/routes/collection](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/collection)
  - [backend/src/routes/market](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market)
  - [backend/src/routes/franchises](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises)
  - [backend/src/routes/prices](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices)
  - [backend/src/routes/admin](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin)
- The active runtime is mounted through [index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/index.js).
- Active public routes no longer read the DB directly.
- Runtime normalization goes through [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js).
- `db_supabase.js` is the runtime source of truth for active public reads.
- Flat historical files [serverless.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/serverless.js), [contextual-search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/contextual-search.js), [prices.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices.js), and [collection.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/collection.js) are now compatibility wrappers only.
- `src/config` now exposes both [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js) and [database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/database.js).

## Phase 0 Discoveries and Final Placement

### `collection-service.js`

- File: [backend/src/_quarantine/collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/collection-service.js)
- Decision: `quarantine`
- Reason: pushes a `Sequelize + services` runtime incompatible with the confirmed production target

### `20260331_007_collection_runtime_canonical.js`

- File: [backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- Decision: `pending_review`
- Reason: collection multi-user migration not validated for production

### `runtime-db-architecture.md`

- File: [docs/_superseded/runtime-db-architecture.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded/runtime-db-architecture.md)
- Decision: `superseded`
- Reason: incompatible with the confirmed `db_supabase.js` production target

### `runtime-db-context.js`

- File: [backend/src/_quarantine/runtime-db-context.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/runtime-db-context.js)
- Decision: `quarantine`
- Reason: its environment-resolution responsibility is now absorbed by [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js)

## Refactor Decisions Validated

- `serverless.js` was reduced, then converted into a compatibility wrapper over canonical domain routes.
- `contextual-search.js` and `prices.js` were reduced, then converted into compatibility wrappers.
- `market.js` is not mounted by default and is now an explicitly isolated legacy route.
- `market.js` endpoints are classified as:
  - converged:
    - `/api/stats`
    - `/api/search`
    - `/api/items`
    - `/api/consoles`
    - `/api/consoles/:id`
  - legacy isolated:
    - `/api/items/:id`
    - `/api/accessories/types`
    - `/api/accessories`
    - `/api/index/:id`
    - `/api/reports`

## DB Constraints Still Active

- Production runtime is still string-driven on `games.console` and `games.developer`.
- `console_id` and `developer_id` are not the effective public runtime contract.
- `editorial_status`, `media_status`, and `price_status` do not yet exist in production.
- `youtube_id`, `youtube_verified`, `archive_id`, and `archive_verified` do not yet exist in production.

## JTASSY Deviations

No additional formal JTASSY deviation was approved in this pass.

Changes made here are treated as:

- convergence of the active runtime
- explicit isolation of legacy surfaces
- documented placement of previously untracked or contradictory artifacts
