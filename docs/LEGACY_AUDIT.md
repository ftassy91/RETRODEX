# RetroDex Legacy Audit

State reviewed on March 31, 2026.

This audit is intentionally narrow:

- active canonical public routes under [backend/src/routes](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes) domain folders are out of scope
- pre-existing dirty worktree items outside the current refactor lots remain out of scope
- no file listed here should be removed opportunistically without a dedicated lot

## Status Labels

- `keep_wrapper`: compatibility wrapper still tolerated
- `keep_non_canonical`: retained outside the canonical public runtime, but still has a real role
- `candidate_removal`: not mounted by default and appears redundant with canonical runtime
- `paired_review`: not mounted by default, but still coupled to a consumer or feature that needs a dedicated cleanup lot
- `orphaned_review`: no active runtime consumer found; keep only until a dedicated removal pass confirms deletion

## Remaining Flat Route Files

| File | Role | Active consumer or mount | Status | Next step |
| --- | --- | --- | --- | --- |
| [backend/src/routes/serverless.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/serverless.js) | Compatibility wrapper over canonical domain routers | historical import surface only; not mounted by [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_wrapper` | keep until a dedicated compatibility-removal lot proves no external dependency remains |
| [backend/src/routes/contextual-search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/contextual-search.js) | Compatibility wrapper over canonical search routers | historical import surface only | `keep_wrapper` | keep until wrapper-removal lot |
| [backend/src/routes/collection.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/collection.js) | Compatibility wrapper over canonical collection routers | historical import surface only | `keep_wrapper` | keep until wrapper-removal lot |
| [backend/src/routes/prices.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices.js) | Compatibility wrapper over canonical prices router | historical import surface only | `keep_wrapper` | keep until wrapper-removal lot |
| [backend/src/routes/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/audit.js) | compatibility wrapper over the explicit admin/back-office audit route | historical import surface only; no default mount in [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_wrapper` | keep until a dedicated compatibility-removal lot proves no external dependency remains |
| [backend/src/routes/sync.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/sync.js) | compatibility wrapper over the explicit admin/back-office sync route | historical import surface only; no default mount in [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_wrapper` | keep until a dedicated compatibility-removal lot proves no external dependency remains |
| [backend/src/routes/games-admin.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-admin.js) | compatibility wrapper over the explicit admin/back-office games route | historical import surface only; no default mount in [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_wrapper` | keep until a dedicated compatibility-removal lot proves no external dependency remains |
| [backend/src/routes/games-helpers.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-helpers.js) | helper bootstrap for [backend/src/routes/admin/games.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/games.js) | coupled to admin games back-office only | `keep_non_canonical` | keep coupled to the admin cleanup lot |

## Remaining Legacy or Non-Canonical Services

| File | Role | Active consumer | Status | Next step |
| --- | --- | --- | --- | --- |
| [backend/src/services/audit-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/audit-service.js) | audit, divergence, and priority reports over Sequelize/local runtime | [backend/src/routes/admin/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/audit.js) | `keep_non_canonical` | keep stable; split only in a dedicated audit/admin lot |
| [backend/src/services/game-read-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/game-read-service.js) | shared legacy hydrated game read model | `audit-service`, `console-service`, `curation-service` | `keep_non_canonical` | retain as shared legacy read model until a dedicated convergence lot exists |
| [backend/src/services/console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/console-service.js) | legacy/back-office console payload builder | `curation-service`, `enrichment-backlog-service` | `keep_non_canonical` | retain until console legacy/admin scope is reviewed separately |
| [backend/src/services/curation-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/curation-service.js) | enrichment and curation heuristics | `enrichment-backlog-service`, tests | `keep_non_canonical` | retain and split only inside a dedicated enrichment lot |
| [backend/src/services/enrichment-backlog-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/enrichment-backlog-service.js) | prioritization and backlog planning for enrichment | tests and manual enrichment workflows | `keep_non_canonical` | retain until enrichment admin workflows are redesigned |

## Explicit Admin / Back-Office Tree

These files now carry the real admin/back-office route logic, but remain unmounted by default in the public runtime:

- [backend/src/routes/admin/index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/index.js)
- [backend/src/routes/admin/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/audit.js)
- [backend/src/routes/admin/games.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/games.js)
- [backend/src/routes/admin/sync.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/sync.js)

## Immediate Conclusions

- The active public runtime is no longer the risky part of the codebase.
- The remaining legacy is concentrated in:
  - compatibility wrappers over older import surfaces
  - audit/admin/manual pipelines using Sequelize
- The next cleanup lot should be chosen explicitly:
  - compatibility wrappers
  - audit/admin routes
  - orphaned service scans

## Removed After Verification

- [backend/src/routes/consoles.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/consoles.js) was removed on March 31, 2026 after confirming that:
  - it was not mounted by [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
  - `/api/consoles*` is already served canonically by [backend/src/routes/market/catalog.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/catalog.js)
  - smoke stayed green after deletion
- [backend/src/routes/franchises.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises.js) was removed on March 31, 2026 after confirming that:
  - it was not mounted by [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
  - `/api/franchises*` is already served canonically by [backend/src/routes/franchises/index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises/index.js)
  - smoke stayed green after deletion
- [backend/src/routes/stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/stats.js) was removed on March 31, 2026 after confirming that:
  - it was not mounted by [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
  - `/api/stats` is already served canonically by [backend/src/routes/market/stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/stats.js)
  - smoke stayed green after deletion
- [backend/src/routes/marketplace.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/marketplace.js) was removed on March 31, 2026 after confirming that:
  - it was not mounted by [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
  - its only remaining frontend consumer [backend/public/js/pages/stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/pages/stats.js) was decoupled first
  - smoke stayed green after deletion
- [backend/src/services/legacy-games-detail-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/legacy-games-detail-service.js) and [backend/src/services/legacy-games-detail-queries.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/legacy-games-detail-queries.js) were removed on March 31, 2026 after confirming that:
  - no code consumer remained outside the pair itself
  - the canonical game detail runtime already flows through [backend/src/routes/games/detail.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games/detail.js)
  - smoke stayed green after deletion
- [backend/src/routes/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/audit.js), [backend/src/routes/sync.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/sync.js), and [backend/src/routes/games-admin.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-admin.js) were converted on March 31, 2026 into compatibility wrappers over the explicit [backend/src/routes/admin](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin) tree.
