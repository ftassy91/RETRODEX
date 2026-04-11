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
- Supabase (production, 33 tables), SQLite/Sequelize (local dev fallback)
- Vanilla JS frontend (no framework, no build step)
- Inline SVG charts (no Chart.js dependency)
- BigBlueTerminal + DepartureMono fonts
- Quiet Phosphor design system (zones: green default, cyan collection, amber qualification, gray hub)

### Key Context (updated 2026-04-11, audit CTRL-03 PASS)
- 1,509 games cataloged across 25 consoles (19 platforms)
- 15,579 price entries from 3 sources (PriceCharting + Yahoo Auctions JP + eBay)
- eBay records: 250 (185 new via batch scraping, parallel Playwright)
- Confidence tiers: 1 high, 35 medium, 986 low, 487 unknown
- 161 BAZ anecdotes for ~100 games (contextual codec on game-detail)
- Cover URLs: 1,459/1,509 (97% coverage)
- 33 Supabase tables, all RLS-enabled, 0 health flags
- CSS architecture: core.css (131L) + components.css (14,545L) + effects.css (166L) + zones.css (643L) + codec.css (928L) = 16,413 total
- Smoke tests: 17/17 PASS
- Nav unified: 16/16 HTML files, canonical 3-tab (Hub/RetroDex/Collection)
- Responsive: 480px breakpoint covers all pages (nav 3-col, cards stack, table scroll)
- Skeleton loading: hub (3 cards) + index (5 rows)
- Micro-animations: hover feedback, button press, smooth scroll, page fade-in
- Boot screen: terminal sequence on hub (first visit per session)
- BAZ contextual: anecdote > price > metascore > silence (per game, once)
- Stats dashboard: 4 sections (overview, top 10, consoles, rarity)
- Consoles page: aligned with Quiet Phosphor (was: amber old style)
- Game-detail: decision panel visual hierarchy (price 1.6rem > context > collection)
- Backfill script: catalog-aware floor, never-downgrade, date fix
- Batch eBay: parallel scraping (--concurrency), Windows scheduled task, JSON ingestion
- Pipeline: batch-ebay-fetch.js → ingest-ebay-json.js → backfill-confidence-from-history.js
- backend/.env present locally (gitignored) with Supabase pooler credentials
- 38 commits this mega-session

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

## Backlog — UI Cleanup

Objectif : nettoyer l'interface pour un rendu pro, lisible, sans complexite inutile. Audit live du 2026-04-11.

### LOT-UI-CLEANUP-01 — Hub : simplifier drastiquement (PRIORITE)
- **Mode :** BUILD
- **Objectif :** Reduire le hub a l'essentiel. Supprimer le typewriter "RE", les 5 boutons redondants (INSPECTER/QUALIFIER/MESURER/DECIDER/FAIRE EVOLUER), la barre de workflow texte, le bandeau stats brut. Garder : barre de recherche, 3 cartes cliquables (RetroDex→index, Collection→collection, Marche→stats) avec compteurs integres. Supprimer le vide noir (min-height ou conteneur vide).
- **Scope :** backend/public/hub.html (ou index.html), backend/public/js/pages/hub.js, zones.css
- **Regle :** Chaque carte = lien cliquable sur toute sa surface (cursor:pointer, <a> wrapping)
- **Modele :** Sonnet

### LOT-UI-CLEANUP-02 — Cartes cliquables + labels utilisateur (PRIORITE)
- **Mode :** BUILD
- **Objectif :** (a) Toute carte avec bordure = cliquable sur toute sa surface, pas juste un lien texte dedans. (b) Remplacer les labels internes par des labels utilisateur : "PASS 1 curated"→supprimer, "LECTURE SOLIDE"→"Fiche complete", "EN PROGRESSION"→"En cours". (c) Fixer le glyphe accordeon casse (►Â−, → chevron CSS pur ou caractere ASCII safe).
- **Scope :** backend/public/js/pages/games-list.js, game-detail.html, zones.css
- **Modele :** Sonnet

### LOT-FIX-08 — Slug routing game-detail (PRIORITE)
- **Mode :** BUILD
- **Objectif :** game-detail.html accepte ?slug= en plus de ?id=. Actuellement ?slug=chrono-trigger-super-nes → "Aucun identifiant de jeu fourni".
- **Scope :** backend/public/js/pages/game-detail.js, backend/src/routes/games
- **Modele :** Sonnet

---

## BAZ Convergence (COMPLETE — 2026-04-11)

Resultat : 7 fichiers BAZ unifies en systeme unique — routeur central, pipeline de reponse unifie, memoire partagee.

### LOT-BAZ-CONV-01 — Routeur unique — Done
### LOT-BAZ-CONV-02 — Pipeline de reponse unique — Done
### LOT-BAZ-CONV-03 — Memoire unifiee — Done

---

## For Claude Code Sessions

On session start, run through:
1. What mode? (THINK / BUILD / CONTROL)
2. What model? (Opus / Sonnet / Opusplan)
3. What is the active lot?
4. What is the next command?

Available project commands: /session-start, /status, /operator-audit, /product-audit, /plan-lot, /execute-lot, /verify-lot
