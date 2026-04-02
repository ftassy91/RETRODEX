# CODEX_CONTEXT.md -- RetroDex

## Status

This file remains as a Codex entry point, but the old MVP/database-v2 framing is obsolete.

Read in this order before doing any work:
1. [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/DECISIONS.md)

If this file conflicts with those documents, this file loses.

## Current Codex Baseline

- RetroDex is a **knowledge-first retro-gaming product**
- public runtime is stabilized
- canonical public surface is [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/)
- canonical public runtime tree is [backend/src/routes/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/)
- canonical public reads are **Supabase-first** through [backend/db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js)
- local SQLite at [backend/storage/retrodex.sqlite](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/storage/retrodex.sqlite) is staging/back-office only
- admin logic is isolated under [backend/src/routes/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/) and [backend/src/services/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/)
- [frontend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/frontend/) is a secondary prototype area by default

## Non-Negotiable Rules

- do not treat old MVP docs as authoritative
- do not treat `frontend/` as the default active product surface
- do not treat local SQLite as prod truth
- do not put business logic back into public routes
- do not let admin logic leak into public runtime
- do not mutate prod without explicit human validation

## Current Product Direction

RetroDex should be understood as:
- a retro knowledge terminal first
- a market-context product second
- a collection layer third

The public product has four visible universes:
- RetroDex
- RetroMarket
- Collections
- Recherche

But the main development priority is still:
- improve game pages
- improve data quality
- improve traceable enrichment
- keep the product readable and coherent

## Default Work Posture

When unclear, choose the option that:
- strengthens knowledge surfaces
- keeps runtime stable
- avoids parallel systems
- prefers quality over feature spread
- reduces contradiction instead of adding more
