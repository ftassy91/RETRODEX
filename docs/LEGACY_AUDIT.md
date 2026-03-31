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
| [backend/src/routes/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/audit.js) | Audit and divergence endpoints backed by Sequelize audit pipeline | no default mount in [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_non_canonical` | retain for a dedicated audit/admin lot |
| [backend/src/routes/franchises.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises.js) | flat legacy duplicate of canonical franchise routes | canonical runtime already serves `/api/franchises*` from [backend/src/routes/franchises/index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises/index.js) | `candidate_removal` | remove only in an explicit legacy-routes lot |
| [backend/src/routes/marketplace.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/marketplace.js) | flat legacy marketplace route using Sequelize listings | frontend page [backend/public/js/pages/stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/js/pages/stats.js) still requests `/marketplace` | `paired_review` | review together with the remaining marketplace consumer in Phase 5 or a dedicated marketplace lot |
| [backend/src/routes/stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/stats.js) | flat legacy duplicate of canonical `/api/stats` | canonical runtime already serves `/api/stats` from [backend/src/routes/market/stats.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/stats.js) | `candidate_removal` | remove only in an explicit legacy-routes lot |
| [backend/src/routes/sync.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/sync.js) | manual sync endpoint using local bootstrap pipeline | no default mount in [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_non_canonical` | retain until sync/admin behavior is redesigned |
| [backend/src/routes/games-admin.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-admin.js) | manual admin repair endpoints for legacy/local data | no default mount in [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js) | `keep_non_canonical` | retain until admin cleanup lot |
| [backend/src/routes/games-helpers.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-helpers.js) | helper bootstrap for [games-admin.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-admin.js) | coupled to `games-admin.js` only | `keep_non_canonical` | keep coupled to the admin cleanup lot |

## Remaining Legacy or Non-Canonical Services

| File | Role | Active consumer | Status | Next step |
| --- | --- | --- | --- | --- |
| [backend/src/services/audit-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/audit-service.js) | audit, divergence, and priority reports over Sequelize/local runtime | [backend/src/routes/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/audit.js) | `keep_non_canonical` | keep stable; split only in a dedicated audit/admin lot |
| [backend/src/services/game-read-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/game-read-service.js) | shared legacy hydrated game read model | `audit-service`, `console-service`, `curation-service`, flat [franchises.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises.js) | `keep_non_canonical` | retain as shared legacy read model until a dedicated convergence lot exists |
| [backend/src/services/console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/console-service.js) | legacy/back-office console payload builder | `curation-service`, `enrichment-backlog-service` | `keep_non_canonical` | retain until console legacy/admin scope is reviewed separately |
| [backend/src/services/curation-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/curation-service.js) | enrichment and curation heuristics | `enrichment-backlog-service`, tests | `keep_non_canonical` | retain and split only inside a dedicated enrichment lot |
| [backend/src/services/enrichment-backlog-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/enrichment-backlog-service.js) | prioritization and backlog planning for enrichment | tests and manual enrichment workflows | `keep_non_canonical` | retain until enrichment admin workflows are redesigned |
| [backend/src/services/legacy-games-detail-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/legacy-games-detail-service.js) | extracted local fallback for the retired flat games detail tree | no active runtime consumer found | `orphaned_review` | verify one more time in a dedicated removal lot, then delete if still unused |
| [backend/src/services/legacy-games-detail-queries.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/legacy-games-detail-queries.js) | query helper for `legacy-games-detail-service` | `legacy-games-detail-service` only | `orphaned_review` | remove together with `legacy-games-detail-service` when orphaned removal is validated |

## Immediate Conclusions

- The active public runtime is no longer the risky part of the codebase.
- The remaining legacy is concentrated in:
  - flat route files not mounted by default
  - audit/admin/manual pipelines using Sequelize
  - one apparently orphaned `legacy-games-detail` pair
- The next cleanup lot should be chosen explicitly:
  - compatibility wrappers
  - audit/admin routes
  - marketplace consumer and route pair
  - orphaned `legacy-games-detail*`

## Removed After Verification

- [backend/src/routes/consoles.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/consoles.js) was removed on March 31, 2026 after confirming that:
  - it was not mounted by [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
  - `/api/consoles*` is already served canonically by [backend/src/routes/market/catalog.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market/catalog.js)
  - smoke stayed green after deletion
