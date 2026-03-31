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
- The old flat public wrappers `serverless.js`, `contextual-search.js`, `prices.js`, and `collection.js` were removed after verification that the canonical domain tree is the only mounted public runtime.
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

- `serverless.js` was reduced, then removed once the canonical domain route tree became the only mounted public runtime.
- `contextual-search.js`, `prices.js`, and `collection.js` were reduced, then removed once no tracked code consumer remained.
- Phase 5 migrated the remaining frontend consumers away from the flat legacy market endpoints.
- `legacy-market.js` has been removed after migration of:
  - `backend/public/js/pages/accessories.js`
  - `backend/public/js/pages/game-detail.js`
- The old flat `market.js` route has been removed after extraction of the retained legacy endpoints and verification that smoke still passes.
- Canonical market and game detail endpoints now cover:
  - converged:
    - `/api/stats`
    - `/api/search`
    - `/api/items`
    - `/api/consoles`
    - `/api/consoles/:id`
    - `/api/market/accessories/types`
    - `/api/market/accessories`
    - `/api/games/:id/index`
    - `/api/games/:id/reports`
  - legacy isolated:
    - none
  - removed as inactive legacy:
    - `/api/items/:id`
    - `/api/accessories/types`
    - `/api/accessories`
    - `/api/index/:id`
    - `/api/reports`

## DB Constraints Still Active

- Production runtime is still string-driven on `games.console` and `games.developer`.
- `console_id` and `developer_id` are not the effective public runtime contract.
- `youtube_id`, `youtube_verified`, `archive_id`, and `archive_verified` already exist in production.
- `editorial_status`, `media_status`, and `price_status` already exist in production.
- The historical `phase3-games-status-v1` backfill was executed in production on March 31, 2026 and remains the factual stored state.
- The future `price_status v2` rule is approved in principle only:
  - `pricecharting` becomes an estimate source
  - `ebay` is the only real sale source
  - threshold `N = 3`
- Phase DB must not reopen for `price_status v2` until a real `ebay` ingestion exists in `price_history`.
- Future `console` / `developer` work must stay additive until a dedicated parity and dual-read lot is approved.

Reference documents:

- [PHASE3_DB_READINESS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_DB_READINESS.md)
- [PHASE3_BACKFILL_EXECUTION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_EXECUTION.md)
- [CONSOLE_DEVELOPER_TRANSITION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CONSOLE_DEVELOPER_TRANSITION.md)
- [LEGACY_AUDIT.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/LEGACY_AUDIT.md)

## JTASSY Deviations

No additional formal JTASSY deviation was approved in this pass.

Changes made here are treated as:

- convergence of the active runtime
- explicit isolation of legacy surfaces
- documented placement of previously untracked or contradictory artifacts
