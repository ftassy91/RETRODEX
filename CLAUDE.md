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
- Supabase = production truth (27 tables, all RLS-enabled — see SUPABASE_AUDIT.md)
- SQLite/Sequelize = local dev fallback only
- DATABASE_URL port 5432 blocked locally - use NODE_ENV=production + Supabase JS client over HTTPS

**Deploy:** Vercel (auto from main push). Repo: ftassy91/RETRODEX.

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
- Supabase (production, 29 tables), SQLite/Sequelize (local dev fallback)
- Vanilla JS frontend (no framework, no build step)
- Inline SVG charts (no Chart.js dependency)
- BigBlueTerminal + DepartureMono fonts
- Quiet Phosphor design system (zones: green default, cyan collection, amber qualification, gray hub)

### Key Context (updated 2026-04-10, end of session)
- 1,509 games cataloged across 25 consoles
- 15,400+ price entries from 3 sources (PriceCharting + Yahoo Auctions JP + eBay via Playwright)
- Confidence tiers: 1 high, 33 medium, 407 low, 1,068 unknown
- 29 Supabase tables (SUPABASE_AUDIT.md), all RLS-enabled, 0 health flags
- 5 collection items qualified, 0 duplicates, 1 sell signal active
- Collection canonical schema: user_id, list_type, added_at, purchase_date, etc.
- CSV import: POST /api/collection/import + UI button on collection page
- Pipeline: backfill-confidence-from-history.js, batch-ebay-fetch.js, capture-collection-snapshot.js
- Market connectors: Yahoo Auctions JP (live), eBay (Playwright headless), others (fixture-only)

### Vision A (COMPLETE)
- Action 1: collection_snapshots table + capture script + SVG evolution chart
- Action 2: game_anecdotes table + 48 anecdotes for 39 games + display on game-detail
- Action 3: BAZ-C terminal sprite (VT100) + user bust (Tron) + MGS Codec dialog

### BAZ System
- codec.js: MGS+PipBoy+BladeRunner+Nier codec window with face-to-face portraits
- baz-engine.js: conversation engine (31 intents, 93+ replies, game title matching)
- Input bar: user types → BAZ responds (keyword matching, easter eggs, FAQ)
- Sprites: baz.svg (64x64), baz-compact.svg (32x32), user-bust.svg (64x64)
- Voice guide: docs/BAZ_VOICE_GUIDE.md

### UI Layer
- zones.css: color zones + hover + completion bar + layout fixes + BAZ anecdote block + decision grid
- codec.css: MGS+PipBoy+BladeRunner+Nier codec redesign (grain, brackets, gradient dissolve)
- animations.js: rollTo counters, typewriter h1, loading dots
- Smoke test: backend/scripts/smoke-test.js (14 endpoints)
- UX score: 5.4 → 7.4 (50+ lots executed in session 2026-04-10)

### Ticket Conventions
Lot prefixes: LOT-OP-, LOT-PROD-, LOT-UI-, LOT-UX-, LOT-FIX-, LOT-CTRL-, LOT-VA-, LOT-BAZ-

---

## For Claude Code Sessions

On session start, run through:
1. What mode? (THINK / BUILD / CONTROL)
2. What model? (Opus / Sonnet / Opusplan)
3. What is the active lot?
4. What is the next command?

Available project commands: /session-start, /status, /operator-audit, /product-audit, /plan-lot, /execute-lot, /verify-lot
