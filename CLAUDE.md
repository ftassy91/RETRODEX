# RetroDex -- CLAUDE.md

## Status

This file is a lightweight entry document for Claude-style agents.

It is **not** the primary source of truth anymore.

Read in this order before acting:
1. [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/DECISIONS.md)

If this file conflicts with those documents, this file loses.

## Current Working Truth

- RetroDex is a **retro-gaming knowledge terminal**
- public runtime is stabilized and canonical under [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/) and [backend/src/routes/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/)
- public runtime reads are **Supabase-first** through [backend/db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js)
- local SQLite is a **staging/back-office environment**, not prod truth
- admin logic lives under [backend/src/routes/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/) and [backend/src/services/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/)
- [frontend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/frontend/) is a **secondary prototype/exploration area**, not the default product surface

## Product Orientation

RetroDex has four visible universes:
- RetroDex
- RetroMarket
- Collections
- Recherche

But the product center of gravity is:
- structured game pages
- knowledge/archive
- curation, audit, enrichment, provenance

Priority order:
1. improve public game pages and knowledge surfaces
2. improve published data quality
3. enrich traceably
4. keep market and collection as support layers

## Structural Invariants

- public routes orchestrate HTTP only
- public routes do not read DB directly
- public routes do not import active Sequelize models directly
- business logic belongs in services
- back-office concerns stay isolated from public runtime
- no prod mutation without explicit human approval

## Practical Resume Rule

When resuming work:
- do not start from old MVP assumptions
- do not assume `frontend/` is canonical
- do not assume local SQLite is runtime truth
- do not open broad refactors implicitly

Open explicit lots, keep scope narrow, and align with [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md).
