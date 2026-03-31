# RetroDex Legacy Audit

State consolidated on March 31, 2026.

This document now tracks only what still sits outside the canonical public runtime, plus what remains intentionally out of lot. It is not a signal that a cleanup lot is active.

## Current Position

- Public route cleanup: closed
- Legacy market cleanup: closed
- Admin/services cleanup: closed on its approved perimeter
- Active cleanup lot by default: none

## Remaining Non-Canonical Back-Office Services

These services remain intentionally outside the canonical public runtime and are now considered stabilized on their current perimeter.

| File | Real role | Current status | Next step |
| --- | --- | --- | --- |
| [backend/src/services/admin/game-read-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/game-read-service.js) | admin shared read-model facade | `stabilized_back_office_facade` | keep; reopen only in a dedicated admin/read-model lot |
| [backend/src/services/admin/curation-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/curation-service.js) | admin curation workflow facade | `stabilized_back_office_facade` | keep; reopen only in a dedicated editorial workflow lot |
| [backend/src/services/admin/audit-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/audit-service.js) | admin audit workflow facade | `stabilized_back_office_facade` | keep; reopen only in a dedicated audit/reporting lot |
| [backend/src/services/admin/console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/console-service.js) | admin console orchestrator | `stabilized_back_office_orchestrator` | keep isolated; do not absorb into public services |
| [backend/src/services/admin/enrichment-backlog-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/enrichment-backlog-service.js) | enrichment backlog orchestrator | `stabilized_back_office_orchestrator` | keep; revisit only if workflows change materially |

Implementation trees and pure helper profiles that support this stabilized state:

- [backend/src/services/admin/game-read](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/game-read)
- [backend/src/services/admin/curation](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/curation)
- [backend/src/services/admin/audit](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/audit)
- [console-profile.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/console-profile.js)
- [enrichment-backlog-profile.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/enrichment-backlog-profile.js)

Historical audit references:

- [ADMIN_SERVICES_AUDIT.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ADMIN_SERVICES_AUDIT.md)
- [ADMIN_SCRIPTS_AUDIT.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ADMIN_SCRIPTS_AUDIT.md)

## Explicit Admin / Back-Office Tree

These files now carry the real admin/back-office route logic, but remain unmounted by default in the public runtime:

- [backend/src/routes/admin/index.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/index.js)
- [backend/src/routes/admin/audit.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/audit.js)
- [backend/src/routes/admin/games.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/games.js)
- [backend/src/routes/admin/sync.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/sync.js)
- [backend/src/routes/admin/games-helpers.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/games-helpers.js)

Their existence is intentional and does not imply a public runtime regression.

## Out of Scope / Not an Active Lot

### Quarantine and Pending Review

- [backend/src/_quarantine/collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/collection-service.js)
- [backend/src/_quarantine/runtime-db-context.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/runtime-db-context.js)
- [20260331_007_collection_runtime_canonical.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- [docs/_superseded](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded)

### Dirty Worktree Outside the Completed Lots

- [README.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/README.md)
- [CollectionItem.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/models/CollectionItem.js)
- [syncGames.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/syncGames.js)
- [api.test.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/tests/api.test.js)
- [platform-aliases.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/polish-retrodex/config/platform-aliases.json)
- [sources.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/polish-retrodex/config/sources.json)
- [normalize-titles.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/polish-retrodex/core/normalize-titles.js)

These files were intentionally not mixed into the runtime/admin stabilization work.

## Historical Removals Already Verified

The following cleanup work is complete and should not be treated as an open question:

- flat public wrappers removed
- flat admin wrappers removed
- flat market and marketplace routes removed
- legacy market services removed
- inactive games legacy tree removed
- orphaned legacy games-detail helpers removed

The public route tree is now canonical and stable under [backend/src/routes](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes).
