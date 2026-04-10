# CLAUDE.md - RETRODEX

## What is RetroDex

RetroDex is a **collector operating system** for retro video games.
It transforms a personal collection into a system that is operable, measurable, and evolutive.

Core capabilities: buy/sell/upgrade decisions, qualification, confidence scoring, market context, completeness/condition/region logic.

The encyclopedia, market layer, and collection layer are coordinated parts of one system.

---

## Canonical Architecture

| Path | Role | Authority |
|---|---|---|
| backend/public/ | Production UI (HTML, JS, CSS) | **canonical** |
| backend/src/routes/ | Express route handlers | **canonical** |
| backend/src/services/ | Business logic | **canonical** |
| backend/db_supabase.js | Supabase data access layer | **canonical** |
| prototype_v2/ | Static vanilla JS prototype (offline/mobile) | reference only |
| frontend/ | Legacy / non-canonical | do not modify unless explicitly requested |

**Data authority:**
- Supabase = production truth (26 tables — see SUPABASE_AUDIT.md)
- SQLite/Sequelize = local dev fallback only
- DATABASE_URL port 5432 blocked locally - use NODE_ENV=production + Supabase JS client over HTTPS

**Deploy:** Vercel. Repo: ftassy91/RETRODEX.

---

## Operator Instructions

### Working Modes

Every task must be categorized before starting:

- **THINK** - strategy, architecture, prioritization, system reasoning. No code.
- **BUILD** - implementation, code edits, iteration. Code only within approved scope.
- **CONTROL** - audit, verification, validation, data integrity checks. No new features.

### Workflow Cycle

AUDIT - PLAN - VALIDATE - EXECUTE - VERIFY

Never skip PLAN. Never execute without validation.

### Model Strategy (Claude Code CLI)

| Model | Use for |
|---|---|
| **Opus** | Deep audits, architecture decisions, pipeline reasoning, high-risk analysis |
| **Sonnet** | Implementation, iteration, structured code changes |
| **Opusplan** | Default - Opus plans, Sonnet executes |

For every serious task: state recommended model, flag if a switch is needed, explain why.

### Hard Rules

1. No plan - no code. Never start coding without an approved plan.
2. Narrow scope only. No broad refactors unless explicitly requested.
3. Data integrity > UI polish. Always verify the data path before touching presentation.
4. Explain everything. Every change gets: what changed, why, what is at risk.
5. Call out drift. If work is going out of scope, stop and flag it.
6. Canonical paths only. Do not treat frontend/ as active unless told to.

### Output Standard

Every plan or report must include:
1. Objective
2. Scope (files, boundaries)
3. Risks
4. Next step
5. Model recommendation

---

## Known Project State

### Tech Stack
- Node.js / Express backend
- Supabase (production), SQLite/Sequelize (local dev)
- Vanilla JS frontend (no framework, no build step)
- Chart.js for data viz
- Press Start 2P + Share Tech Mono fonts
- Bloomberg terminal / CRT green phosphor aesthetic

### Key Context
- 507 games cataloged across 16 consoles (1983-2005)
- 579 price entries in market data
- 26 tables audited and documented (SUPABASE_AUDIT.md, 2026-04-09)
- Migration tracking: ad-hoc only — Supabase CLI list_migrations returns empty
- games.js refactored from 614-line monolith into 4 focused modules
- Boot screen: CRT Bezier curve overlay with 3-phase animation
- Hub concept: 3 floppy disk modules (RETRODEX green, RETROMARKET red, COLLECTION blue)

### Ticket Conventions
Prefixes: RDX-, UI-, UX-, LAYOUT-, HUB-

---

## For Claude Code Sessions

On session start, run through:
1. What mode? (THINK / BUILD / CONTROL)
2. What model? (Opus / Sonnet / Opusplan)
3. What is the active lot?
4. What is the next command?

Available project commands: /session-start, /status, /operator-audit, /product-audit, /plan-lot, /execute-lot, /verify-lot
