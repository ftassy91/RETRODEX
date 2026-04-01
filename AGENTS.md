# AGENTS.md -- RetroDex

## Status

This document is the repo-level operating frame for `RETRODEXseed`.

It is written for:
- human developers
- development agents (Codex, Claude, and similar assistants)

Its role is not to describe every subsystem.
Its role is to keep the project aligned and prevent drift.

When documents disagree:
1. this file sets product and structural direction
2. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md) sets the active architecture
3. [docs/DECISIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/DECISIONS.md) records validated decisions
4. older or conflicting documents must be treated as suspect until verified

## 1. What RetroDex Is

RetroDex is a retro-gaming knowledge terminal.

It is enriched by:
- market signals
- collection data
- provenance, scoring, curation, and controlled publication

RetroDex is not just a game catalog.
RetroDex is not a marketplace-first product.

Its core value is:
- structured game pages
- high data quality
- encyclopedic readability
- the ability to connect archive, context, media, credits, and market signals in one coherent surface

Short form:

> RetroDex = retro knowledge engine, with market and collection as context layers.

## 2. Main Priority

The main priority of the project is:

**improve the quality, readability, and coherence of public game pages and public knowledge surfaces.**

Priority order:
1. quality of published data
2. coherence of public surfaces
3. traceable enrichment
4. clarity of reading
5. market and collection signals in support

Every significant change should be tested against this question:

> Does this improve RetroDex as a system for reading, understanding, and navigating retro game knowledge?

If the answer is no, it is not a priority.

## 3. Product Hierarchy

### Primary universe

- **RetroDex**
  - catalog
  - game pages
  - encyclopedia
  - consoles
  - franchises
  - structured search

### Important secondary universes

- **RetroMarket**
  - value context
  - trust
  - trend reading
  - market signals

- **Collections**
  - personal tracking
  - ownership
  - wishlist
  - value projection

### Orchestration universe

- **Hub**
  - entry point
  - navigation layer
  - orientation cockpit

### Hierarchy rules

- market must never become more important than the game page
- collection must never become the core of the product
- hub must not compete with specialized surfaces
- search must traverse the system, not become a separate product

## 4. Canonical Surfaces

### Canonical

- [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/) = active public UI
- [backend/src/routes/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/) = canonical public runtime tree
- [backend/src/services/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/) = canonical public logic
- [backend/src/routes/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/) + [backend/src/services/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/) = canonical back-office
- [backend/db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js) = public runtime source of truth
- [backend/storage/retrodex.sqlite](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/storage/retrodex.sqlite) = staging/back-office only, never prod truth

### Secondary / non-canonical

- [frontend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/frontend/) = secondary prototype / exploration area
- [RETRODEXseedV0/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/) = legacy archive/reference
- [backend/src/_quarantine/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/) = inactive quarantine area
- [docs/_superseded/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded/) = non-canonical documentation

### Surface rule

No active product feature should start in `frontend/` by default.
Product work should start from the canonical surface unless a lot explicitly says otherwise.

## 5. Structural Rules

### Public backend

- public routes orchestrate HTTP only
- business logic belongs in services
- public routes do not read the database directly
- public routes do not import active Sequelize models directly

### Back-office

- audit, curation, scoring, enrichment, and controlled publication stay under `services/admin`
- back-office logic must not leak into public routes
- admin concerns stay isolated from public runtime concerns

### Data

- Supabase = runtime/prod truth
- local SQLite = staging, validation, enrichment, and audit
- provenance is mandatory for high-value fields
- legacy `games.*` fields remain compatibility fields until migration is explicitly closed
- specialized canonical tables should be preferred whenever they already exist

### Frontend / UI

- `backend/public/` should stay dense, readable, utilitarian, and terminal-like
- visuals must not degrade reading
- decoration must not compete with information
- pages must serve the data, not the reverse

## 6. Product Rules

### What each game page should become

A RetroDex page should move toward:
- clear identity
- fast reading
- editorial depth
- production context
- useful media and references
- music and credits when available
- market context without polluting the reading flow

### What RetroMarket should remain

RetroMarket is a qualification layer:
- useful
- credible
- traceable
- never sensationalist

### What Collections should remain

Collections is a personal-use layer:
- simple
- connected to the catalog
- never more structurally important than the archive itself

## 7. Readability Rules

Any addition should improve at least one of:
- path clarity
- useful information density
- visual hierarchy
- readability of knowledge blocks
- consistency across pages

Avoid:
- duplicated concepts across pages
- catch-all surfaces
- internal jargon exposed to users
- sections with no clear job
- enriched data displayed without real reading value

## 8. Anti-Drift Rules

### Do not

- do not reopen a broad refactor implicitly
- do not reintroduce a parallel public system
- do not treat `frontend/` as canonical by default
- do not let market features outrank knowledge features
- do not run large enrichment lots without publication or quality logic
- do not add new contradictory product narratives to the documentation

### Must do

- open significant work as an explicit lot
- define scope before editing
- preserve active architecture invariants
- update canonical docs when a real decision changes
- reduce documentary contradictions instead of adding new ones

## 9. Start Here

To resume the project correctly, read in this order:
1. [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/DECISIONS.md)

Then, depending on the lot:
- [docs/ENRICHMENT_LOT1_FOUNDATIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ENRICHMENT_LOT1_FOUNDATIONS.md)
- [docs/enrichment-pipeline.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/enrichment-pipeline.md)
- [docs/PHASE3_DB_READINESS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_DB_READINESS.md)
- [docs/FRONTEND.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/FRONTEND.md)
- [docs/source-compliance-matrix.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/source-compliance-matrix.md)

Older or divergent docs must be verified before they are used as decision inputs.

## 10. Final Rule

When a choice is ambiguous, choose the option that:
- strengthens RetroDex as a knowledge system
- keeps the public runtime readable and stable
- avoids parallel layers
- prioritizes quality over spread
- makes the repository more coherent, not more spectacular
