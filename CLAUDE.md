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

### Key Context (updated 2026-04-12, end of session)
- 1,509 games cataloged across 25 consoles
- 15,579 price entries from 3 sources (PriceCharting + Yahoo Auctions JP + eBay via Playwright)
- Confidence tiers: 1 high, 35 medium, 986 low, 487 unknown (32%)
- 33 Supabase tables, all RLS-enabled, 0 health flags
- Design system: 45+ CSS variables, region tokens, z-index tokens
- CSS architecture: core.css (131L) + components.css (~14KL) + zones.css (260L) + codec.css (929L) + effects.css (111L)
- Nav unifiee sur 16 pages (LOT-ARCH-01)
- Boot screen terminal avec compteurs live (LOT-UI-HUB-02)
- Skeleton screens sur hub + index (LOT-PERF-03)
- Micro-animations : hover, press, scroll smooth, page fade (LOT-UI-ANIM-01)
- Responsive mobile 375px/480px (LOT-UI-MOBILE-01)
- Cron pipeline: /api/cron/snapshot (03:00 UTC) + /api/cron/tiers (04:00 UTC)
- Cron local Windows: batch eBay tous les 2 jours a 05:00 (100 jeux, 5 consoles rotation, parallele x5)
- Smoke tests: 17 endpoints
- Backfill script: catalog-aware floor, never-downgrade, date fix (LOT-FIX-12)
- backend/.env present locally (gitignored) with Supabase pooler credentials
- 5 collection items qualified, 0 duplicates, 1 sell signal active
- 459 anecdotes BAZ pour 272 jeux (+168 cette session)
- 1,113 jeux avec lien Archive.org (74% du catalogue)
- Editorial : 44 cheat codes, 38 speedrun WR, 135 updates (dev_team, ost_composers, characters)
- 97% couverture covers IGDB (50 manquantes non resolvables)
- UX score: 5.4 → 9.0

### BAZ System (converged — LOT-BAZ-CONV-01/02/03)
- baz-router.js: point d'entree unique, routage par contexte
- baz-engine.js: 31 intents, anti-repetition, session memory, /api/baz/titles (30KB)
- codec.js: 3-column codec, Game Boy palette, CRT effects
- baz-gen.js: 3 moteurs (templates + assembleur + Markov), 404 phrases corpus
- baz-kb.js: knowledge base (20 entries FAQ produit), lexical retrieval
- BAZ contextuel sur game-detail : anecdote > prix > metascore > silence (LOT-BAZ-04)
- Sprites: baz.png + user.png (DALL-E validated, Game Boy style)
- Supabase: baz_replies (58 replies, mood tags, usage_count), game_anecdotes (161)
- Memoire unifiee: single rdx-baz key (localStorage + Supabase usage_count)
- Lazy-loaded: 5 pages sans BAZ, 11 avec (LOT-PERF-01)
- API cache: /api/stats 5min, /api/consoles 10min, /api/baz/titles 10min (LOT-PERF-02)

### UI Layer
- zones.css: color zones, hover, completion bar, game evolution chart, region badges
- codec.css: Game Boy codec (#0F380F bg, #8BAC0F border, 80x80 pixelated portraits)
- effects.css: scanlines 3%, skeleton pulse, hover, press, scroll smooth, page fade, reduced-motion
- Hub: boot screen + 3 nav cards + 3 game cards IGDB portrait + stagger entrance
- Index: compact rows (cover + titre + prix + rarete), skeleton loading
- Collection: cockpit (summary bar hierarchisee, signal cards dim/accent, courbe evolution, grid :has fix)
- Game-detail: panneau DECISION hierarchise (prix dominant), accordeons +/-, sections vides cachees, bouton Archive.org
- Stats: 5 sections (compteurs, confiance, top 5, par console, par rarete)
- Consoles: aligne Quiet Phosphor, sidebar + detail
- Smoke test: 17 endpoints, audit final 8/8 PASS

### Archive.org Integration
- 71 jeux avec archive_id (30 LEGENDARY/EPIC + 41 RARE)
- Bouton "Voir sur Archive.org" sur game-detail si archive_id present
- Script: backend/scripts/enrich-archive-ids.js (--rarity, --limit, --apply)

### Pipeline eBay automatise
- batch-ebay-fetch.js: --console, --limit, --concurrency, --records, .stop-batch
- scheduled-batch.ps1: rotation 5 consoles, backfill apres fetch, log, timeout 30min
- install/uninstall-scheduled-task.ps1: Windows Task "RetroDex-BatchPrix" tous les 2j a 05:00
- ingest-ebay-json.js: JSON → price_history (filtre bruit, dedup)

### Ticket Conventions
Lot prefixes: LOT-OP-, LOT-PROD-, LOT-UI-, LOT-UX-, LOT-FIX-, LOT-CTRL-, LOT-VA-, LOT-BAZ-, LOT-ARCH-, LOT-PERF-, LOT-ENRICH-, LOT-ARCHIVE-

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
