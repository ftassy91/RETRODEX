# DECISION-001: games / game_editorial consolidation

**Date:** 2026-04-09
**Status:** Decided
**Lot:** LOT-THINK-01
**Decision:** Option A -- game_editorial is the source of truth for editorial fields

---

## Context

Two tables store editorial content for games:

| Table | Rows | Role |
|---|---|---|
| `games` | 1509 | Catalog + price denormalization + editorial fields (duplicated) |
| `game_editorial` | 1506 | Dedicated editorial table (migration 004) |

**11 fields are fully duplicated:**
summary, synopsis, lore, gameplay_description, characters, dev_anecdotes,
cheat_codes, versions, avg_duration_main, avg_duration_complete, speedrun_wr

**3-row gap:** 3 games have no corresponding game_editorial row.

---

## Current write patterns

| Writer | Target | Fields |
|---|---|---|
| `_premium-uplift-common.js` | **both** (games + game_editorial via upsertEditorialField) | synopsis, summary, dev_anecdotes, cheat_codes, etc. |
| `_richness-batch-common.js` | **both** | synopsis, summary, lore, gameplay_description, etc. |
| `_summary-batch-common.js` | **both** | summary, synopsis |
| `apply-g1-enrichment.js` | game_editorial only | synopsis, summary, lore |
| `apply-g2-summary-batch-*.js` | game_editorial only | summary, synopsis |
| `apply-g3-dev-team-batch-*.js` | games only | dev_team (not an editorial field) |
| `enrich_hltb.js` | game_editorial only | avg_duration_main, avg_duration_complete |
| `backfill-canonical.js` | game_editorial only | multiple fields |

**Observation:** Newer enrichment scripts (premium, richness, summary commons) already
dual-write. Older scripts write to one table only, creating divergence.

## Current read patterns

| Reader | Source | Priority |
|---|---|---|
| `publish-editorial-supabase.js` | both | game_editorial wins if not null, games as fallback |
| `sync-supabase-ui-fields.js` | both (LEFT JOIN) | game_editorial priority |
| `game-read/supplements.js` | game_editorial only | -- |
| `public-game/media.js` | game_editorial only | -- |
| `admin/audit/reads.js` | game_editorial only | -- |

**Key:** The integration layer (`publish-editorial-supabase.js`) already treats
game_editorial as authoritative with games as fallback.

---

## Options evaluated

### Option A: game_editorial = source of truth (CHOSEN)

Redirect all editorial writes to game_editorial. Remove editorial fields from
games over time. games keeps: catalog (title, console, year, developer, publisher,
genre, metascore, cover_url, type) + price denormalization + status fields.

**Pros:**
- Aligns with migration 004 intent
- publish layer already implements this priority
- Newer enrichment scripts already dual-write
- Clean separation: catalog vs editorial vs pricing
- game_editorial has source_record_id for provenance tracking

**Cons:**
- Requires updating older scripts that write games-only
- 3 orphaned games without editorial rows need backfill
- Read paths that hit games for editorial fields need redirect

### Option B: Reverse normalization -- merge back into games

Drop game_editorial, move all fields back to games.

**Pros:**
- Simpler schema (one table)
- No JOIN needed for reads
- No sync concern

**Cons:**
- games becomes a mega-table (30+ columns)
- Loses provenance via source_record_id
- Undoes migration 004 work
- Makes future editorial expansion harder

### Option C: Automated sync trigger

Any write to either table updates the other.

**Pros:**
- No code changes needed in writers
- Both tables always consistent

**Cons:**
- Adds complexity without solving the architectural question
- Trigger loops risk
- Masks the real problem: unclear ownership

---

## Decision

**Option A: game_editorial is the source of truth for editorial fields.**

Rationale:
1. The publish integration layer already treats it this way
2. Newer enrichment scripts already dual-write
3. game_editorial has source_record_id for traceability
4. Keeps games lean for catalog + pricing concerns
5. Aligns with original migration 004 design intent

---

## Migration plan

### Phase 1: Backfill gaps (1 lot)
- Create game_editorial rows for the 3 orphaned games
- Verify all 1509 games have a game_editorial row

### Phase 2: Redirect writes (1 lot)
- Older enrichment scripts that write games-only must also write game_editorial
  (or write game_editorial only and let publish sync to Supabase)
- Files to update: scripts that UPDATE games SET editorial fields without
  calling upsertEditorialField

### Phase 3: Redirect reads (1 lot)
- Any runtime read path that fetches editorial fields from games should
  read from game_editorial instead (or via JOIN as already done)
- Files: game-read/supplements.js already reads game_editorial -- verify others

### Phase 4: Deprecate editorial fields on games (future)
- Mark duplicated columns on games as deprecated
- Stop writing them in enrichment scripts
- Eventually drop them (breaking change, requires careful rollout)

**Phase 4 is NOT urgent.** The dual-write pattern is safe. The important thing
is that game_editorial is always populated (Phases 1-2) and always read first
(Phase 3, already mostly done).

---

## Files referenced in this analysis

| File | Role |
|---|---|
| `backend/scripts/enrichment/_premium-uplift-common.js` | Dual-write pattern (games + game_editorial) |
| `backend/scripts/enrichment/_richness-batch-common.js` | Dual-write pattern |
| `backend/scripts/enrichment/_summary-batch-common.js` | Dual-write pattern |
| `backend/scripts/publish-editorial-supabase.js` | Integration layer, game_editorial priority |
| `backend/scripts/sync-supabase-ui-fields.js` | LEFT JOIN, game_editorial priority |
| `backend/src/services/admin/game-read/supplements.js` | Reads game_editorial |
| `backend/src/services/public-game/media.js` | Reads game_editorial |
| `backend/scripts/enrichment/apply-g1-enrichment.js` | Writes game_editorial only |
| `backend/scripts/enrichment/apply-g2-summary-batch-*.js` | Writes game_editorial only |
| `backend/scripts/enrichment/apply-g3-dev-team-batch-*.js` | Writes games only (dev_team) |
| `backend/scripts/backfill-canonical.js` | Writes game_editorial only |
