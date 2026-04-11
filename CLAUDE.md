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
- Supabase (production, 31 tables), SQLite/Sequelize (local dev fallback)
- Vanilla JS frontend (no framework, no build step)
- Inline SVG charts (no Chart.js dependency)
- BigBlueTerminal + DepartureMono fonts
- Quiet Phosphor design system (zones: green default, cyan collection, amber qualification, gray hub)

### Key Context (updated 2026-04-11, end of session)
- 1,509 games cataloged across 25 consoles
- 15,400+ price entries from 3 sources (PriceCharting + Yahoo Auctions JP + eBay via Playwright)
- Confidence tiers: 1 high, 33 medium, 407 low, 1,068 unknown
- 31 Supabase tables (+ baz_replies), all RLS-enabled, 0 health flags
- Design system: 45 CSS variables in :root, 1 hardcoded color remaining
- Cron pipeline: /api/cron/snapshot (03:00 UTC) + /api/cron/tiers (04:00 UTC)
- 5 collection items qualified, 0 duplicates, 1 sell signal active
- Collection: canonical schema, CSV import, region CHECK constraint (PAL/NTSC-U/NTSC-J/NTSC-B/MULTI)
- Pipeline: backfill-confidence-from-history.js, batch-ebay-fetch.js, capture-collection-snapshot.js
- Market connectors: Yahoo Auctions JP (live), eBay (Playwright headless), others (fixture-only)

### Vision A (COMPLETE) + Vision A v2 (2/3)
- Action 1: collection_snapshots + capture script + SVG evolution chart
- Action 2: game_anecdotes (48 for 39 games) + display on game-detail
- Action 3: BAZ codec (PNG sprites, 3-column layout, Game Boy palette)
- VA v2: regions normalisees ✓, snapshots par jeu ✓, photos perso (reportee)

### BAZ System
- codec.js: 3-column codec (BAZ | text | USER), Game Boy palette, CRT effects
- codec.css: scanlines, vignette, grain, glitch, FREQ pulse, asymmetric lighting
- baz-engine.js: 31 intents, anti-repetition, session memory, lore fragments
- erudit-engine.js: L'Erudit on collection page (patience gauge, localStorage memory)
- glossary.js: 30 retrogaming terms (hover=tooltip, click=BAZ speaks)
- search-detect.js: questions in search bars → codec redirect
- baz-gen.js: 3 moteurs (templates + assembleur + Markov), 404 phrases corpus
- baz-kb.js: knowledge base (20 entries FAQ produit), lexical retrieval
- Sprites: baz.png + user.png (DALL-E validated, Game Boy style)
- Supabase: baz_replies (58 replies, mood tags, usage_count), game_anecdotes (48)
- Pipeline: KB → corpus → templates → assembleur → Markov → statique

### UI Layer
- zones.css: color zones, hover, completion bar, game evolution chart, region badges
- codec.css: Game Boy codec (#0F380F bg, #8BAC0F border, 80x80 pixelated portraits)
- animations.js: rollTo counters, typewriter h1, loading dots
- Smoke test: backend/scripts/smoke-test.js (14 endpoints)
- UX score: 5.4 → 7.4

### New tables since initial audit
- collection_snapshots (global daily value tracking)
- game_anecdotes (BAZ fun facts per game)
- baz_replies (curated replies with mood + usage tracking)
- game_snapshots (per-game daily price tracking)

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
