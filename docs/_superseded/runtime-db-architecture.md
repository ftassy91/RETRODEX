# Runtime DB Architecture (Superseded)

## Status

This document is preserved for history only.

It reflects a local runtime convergence direction explored during Phase 0 and is no longer canonical.

Use these documents instead:
1. [AGENTS.md](./AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](./docs/DECISIONS.md)

## Historical Summary

The archived direction described here was:
- public runtime through `Sequelize + services`
- production on Postgres through `DATABASE_URL`
- local runtime on SQLite through the same models and services
- `supabase-js` retained for publish, sync, audit, and admin scripts

This is not the active runtime rule anymore.

## Historical Collection Shape

The archived proposal expected `collection_items` to converge toward:
- `id`
- `user_id`
- `user_session`
- `game_id`
- `added_at`
- `condition`
- `notes`
- `list_type`
- `price_paid`
- `purchase_date`
- `personal_note`
- `price_threshold`
- `created_at`
- `updated_at`

It also assumed:
- unique `(user_id, game_id)`
- default owner `local`
- optional route headers such as `x-retrodex-user-id` or `x-user-id`

## Why It Is Superseded

This file is archived because it points to a runtime convergence path that is not the active canonical direction for RetroDex today.

Current canonical rules are:
- Supabase-first for runtime/prod truth
- SQLite local for staging/back-office only
- public runtime in `backend/public/`, `backend/src/routes/*`, and `backend/src/services/*`
- admin/back-office isolated under `backend/src/routes/admin` and `backend/src/services/admin`

## Archive Rule

Keep this file only for:
- migration archaeology
- comparison with previous runtime assumptions
- understanding why some quarantined or pending-review files exist

Do not use it as the basis for new runtime or deployment work.
