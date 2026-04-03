# RetroDex Decisions

## References

- JTASSY baseline: `70eb99f64449ac6c2daa27f18b63597078ee13b5`
- Consolidation date: March 31, 2026

## JTASSY Decisions Kept

- `backend/enrich-database/` remains the Sprint 7 enrichment baseline.
- The game detail page keeps the three Knowledge Domains and the Production block as valid starting points.
- Migration `8896316` and already shipped product decisions are not reverted in this pass.

## Runtime Decisions Validated

- Production and local now use the same public route topology.
- The canonical active route tree is materialized under:
  - [backend/src/routes/games](../backend/src/routes/games)
  - [backend/src/routes/search](../backend/src/routes/search)
  - [backend/src/routes/collection](../backend/src/routes/collection)
  - [backend/src/routes/market](../backend/src/routes/market)
  - [backend/src/routes/franchises](../backend/src/routes/franchises)
  - [backend/src/routes/prices](../backend/src/routes/prices)
  - [backend/src/routes/admin](../backend/src/routes/admin)
- The active runtime is mounted through [index.js](../backend/src/routes/index.js).
- Active public routes no longer read the DB directly.
- Runtime normalization goes through [normalize.js](../backend/src/lib/normalize.js).
- `db_supabase.js` is the runtime source of truth for active public reads.
- The old flat route wrappers were removed after verification that the canonical domain tree is the only mounted runtime surface.
- `src/config` now exposes both [env.js](../backend/src/config/env.js) and [database.js](../backend/src/config/database.js).

## Market / Legacy Decisions Validated

- Phase 5 migrated the remaining frontend consumers away from the flat legacy market endpoints.
- [market.js](../backend/src/routes/market.js) and [legacy-market.js](../backend/src/routes/legacy-market.js) are removed.
- `legacy-market-*` services are removed.
- Canonical market and game detail endpoints now cover:
  - `/api/stats`
  - `/api/search`
  - `/api/items`
  - `/api/consoles`
  - `/api/consoles/:id`
  - `/api/market/accessories/types`
  - `/api/market/accessories`
  - `/api/games/:id/index`
  - `/api/games/:id/reports`
- Removed inactive legacy endpoints:
  - `/api/items/:id`
  - `/api/accessories/types`
  - `/api/accessories`
  - `/api/index/:id`
  - `/api/reports`

## Admin / Back-Office Decisions Validated

- The explicit back-office route tree lives under [backend/src/routes/admin](../backend/src/routes/admin) and remains unmounted by default in the public runtime.
- The retained back-office service layer lives under [backend/src/services/admin](../backend/src/services/admin).
- The admin/services lot is closed on its perimeter.

Stabilized service outcomes:

- [game-read-service.js](../backend/src/services/admin/game-read-service.js) is now a façade over [backend/src/services/admin/game-read](../backend/src/services/admin/game-read).
- [curation-service.js](../backend/src/services/admin/curation-service.js) is now a façade over [backend/src/services/admin/curation](../backend/src/services/admin/curation).
- [audit-service.js](../backend/src/services/admin/audit-service.js) is now a façade over [backend/src/services/admin/audit](../backend/src/services/admin/audit).
- [console-service.js](../backend/src/services/admin/console-service.js) remains an isolated orchestrator with pure helpers in [console-profile.js](../backend/src/services/admin/console-profile.js).
- [enrichment-backlog-service.js](../backend/src/services/admin/enrichment-backlog-service.js) remains a retained orchestrator with pure helpers in [enrichment-backlog-profile.js](../backend/src/services/admin/enrichment-backlog-profile.js).
- Lot 1 premium enrichment foundations are additive under [backend/src/services/admin/enrichment](../backend/src/services/admin/enrichment).
- Lot 1 premium enrichment foundations do not open new persistence tables.
- Existing canonical tables remain the authority for:
  - curation coverage
  - provenance / evidence
  - quality scoring
  - run logging
- Read-only premium coverage preview is exposed through [recompute-enrichment-coverage.js](../backend/scripts/enrichment/recompute-enrichment-coverage.js).

## Phase 0 Discoveries and Final Placement

### `collection-service.js`

- File: [backend/src/_quarantine/collection-service.js](../backend/src/_quarantine/collection-service.js)
- Decision: `quarantine`
- Reason: pushes a `Sequelize + services` runtime incompatible with the confirmed production target

### `20260331_007_collection_runtime_canonical.js`

- File: [backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js](../backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- Decision: `pending_review`
- Reason: collection multi-user migration not validated for production

### `runtime-db-architecture.md`

- File: [docs/_superseded/runtime-db-architecture.md](./docs/_superseded/runtime-db-architecture.md)
- Decision: `superseded`
- Reason: incompatible with the confirmed `db_supabase.js` production target

### `runtime-db-context.js`

- File: [backend/src/_quarantine/runtime-db-context.js](../backend/src/_quarantine/runtime-db-context.js)
- Decision: `quarantine`
- Reason: its environment-resolution responsibility is now absorbed by [env.js](../backend/src/config/env.js)

## DB State and Gates

- Production runtime is still string-driven on `games.console` and `games.developer`.
- `console_id` and `developer_id` are not the effective public runtime contract.
- `youtube_id`, `youtube_verified`, `archive_id`, `archive_verified`, `editorial_status`, `media_status`, and `price_status` already exist in production.
- The historical `phase3-games-status-v1` backfill was executed in production on March 31, 2026 and remains the factual stored state.
- The future `price_status v2` rule is approved in principle only:
  - `pricecharting` is an estimate source
  - `ebay` is the only real sale source
  - threshold `N = 3`
- Phase DB must not reopen for `price_status v2` until a real `ebay` ingestion exists in `price_history`.
- Future `console` / `developer` work must stay additive until a dedicated parity and dual-read lot is approved.

References:

- [PHASE3_DB_READINESS.md](./docs/PHASE3_DB_READINESS.md)
- [PHASE3_BACKFILL_EXECUTION.md](./docs/PHASE3_BACKFILL_EXECUTION.md)
- [CONSOLE_DEVELOPER_TRANSITION.md](./docs/CONSOLE_DEVELOPER_TRANSITION.md)

## Current Project State

- Public runtime: stabilized
- Admin/services lot: closed
- DB status work: factually closed for v1, gated for v2
- Active technical lot by default: none

Any further work must open as a new explicit lot with a bounded perimeter.

## JTASSY Deviations

No additional formal JTASSY deviation was approved in this pass.

Changes made here are treated as:

- convergence of the active runtime
- explicit isolation of back-office surfaces
- documented placement of previously untracked or contradictory artifacts
