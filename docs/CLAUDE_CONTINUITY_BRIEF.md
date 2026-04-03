# RetroDex Continuity Brief For Claude

## Purpose

This document is the final handoff snapshot after the main refactor, legacy cleanup, and admin/services stabilization lots completed on March 31, 2026.

Use this as the fast-entry document when resuming the project.

Read order before opening older docs:
1. [AGENTS.md](./AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](./docs/DECISIONS.md)

## Current State

- Public runtime: stabilized and canonical
- Public routes: domain-based, no flat wrappers left
- Public data layer: Supabase-first through [db_supabase.js](../backend/db_supabase.js)
- Back-office routes: isolated under [backend/src/routes/admin](../backend/src/routes/admin)
- Back-office services: isolated under [backend/src/services/admin](../backend/src/services/admin)
- Active technical lot by default: none
- Canonical enrichment mission prompt: [CODEX_PROMPT_ENRICHMENT_PIPELINE.md](./CODEX_PROMPT_ENRICHMENT_PIPELINE.md)

## What Is Finished

### Phases 0 to 5

- Phase 0: real Git/filesystem discovery
- Phase 1: global audit and debt mapping
- Phase 2: public runtime refactor to `routes -> services -> Supabase`
- Phase 2 bis: legacy market dismantled and migrated
- Phase 3: factual DB status work documented, with v1 historically applied in prod
- Phase 4 revised: legacy route cleanup and stabilization
- Phase 5: frontend migration off legacy market endpoints and removal of remaining market legacy surfaces

### Post-Phase-5 Stabilization

- public flat wrappers removed
- admin flat wrappers removed
- route tree normalized
- back-office services moved under `services/admin`
- admin script audit completed
- admin service audit completed

### Admin / Services Lot

Closed on its approved perimeter:

- [game-read-service.js](../backend/src/services/admin/game-read-service.js): split, now façade
- [curation-service.js](../backend/src/services/admin/curation-service.js): split, now façade
- [audit-service.js](../backend/src/services/admin/audit-service.js): split, now façade
- [console-service.js](../backend/src/services/admin/console-service.js): isolated cleanly
- [enrichment-backlog-service.js](../backend/src/services/admin/enrichment-backlog-service.js): clarified and retained

### Enrichment Lot 1 Foundations

Opened and completed as an additive admin/back-office lot:

- premium foundation added under [backend/src/services/admin/enrichment](../backend/src/services/admin/enrichment)
- no new persistence table opened
- existing canonical tables reused for:
  - coverage
  - provenance
  - quality scoring
  - run logging
- read-only CLI added:
  - [recompute-enrichment-coverage.js](../backend/scripts/enrichment/recompute-enrichment-coverage.js)
- reference audit:
  - [ENRICHMENT_LOT1_FOUNDATIONS.md](./docs/ENRICHMENT_LOT1_FOUNDATIONS.md)

## Architecture Invariants

Do not break these:

- active public routes must not read DB directly
- active public routes must not import Sequelize models directly
- public runtime reads go through [db_supabase.js](../backend/db_supabase.js)
- `snake_case -> camelCase` normalization remains centralized in [normalize.js](../backend/src/lib/normalize.js)
- back-office logic stays under `routes/admin` and `services/admin`
- do not absorb admin services into public services without a dedicated lot
- no prod mutation without explicit human validation

## DB Truth

This is the factual state to trust:

- Phase 3 v1 status backfill is already applied in production
- production already contains:
  - `youtube_id`
  - `youtube_verified`
  - `archive_id`
  - `archive_verified`
  - `editorial_status`
  - `media_status`
  - `price_status`
- current stored `price_status` reflects historical v1

### `price_status v2`

This is future-only and suspended:

- `pricecharting` = estimate source
- `ebay` = only real sale source
- threshold `N = 3`
- do not reopen DB work for v2 until real `ebay` ingestion exists in `price_history`

Reference:

- [PHASE3_DB_READINESS.md](./docs/PHASE3_DB_READINESS.md)
- [PHASE3_BACKFILL_EXECUTION.md](./docs/PHASE3_BACKFILL_EXECUTION.md)

## What Is Not An Active Lot

These are not open projects by default:

- quarantine items under [backend/src/_quarantine](../backend/src/_quarantine)
- [20260331_007_collection_runtime_canonical.js](../backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- [docs/_superseded](./docs/_superseded)
- unrelated dirty worktree files listed in [LEGACY_AUDIT.md](./docs/LEGACY_AUDIT.md)

They may matter later, but they are not part of an active refactor.

## If New Work Opens

Do not continue implicitly.

Open a new explicit lot with:

- strict perimeter
- target files
- objective
- invariants to preserve
- exit criteria

## Recommended Source Documents

Read these first:

1. [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
2. [DECISIONS.md](./docs/DECISIONS.md)
3. [LEGACY_AUDIT.md](./docs/LEGACY_AUDIT.md)
4. [PHASE3_DB_READINESS.md](./docs/PHASE3_DB_READINESS.md)
5. [CONSOLE_DEVELOPER_TRANSITION.md](./docs/CONSOLE_DEVELOPER_TRANSITION.md)

## Bottom Line

RetroDex is no longer in a broad refactor phase.

The public runtime is stabilized, the admin/services perimeter is cleaned up, DB v2 work is gated on future `ebay` ingestion, and any further technical change must start as a fresh explicit lot.
