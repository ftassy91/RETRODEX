# SUPABASE_AUDIT.md — RetroDex

> **Generated:** 2026-04-09 | **Lot:** LOT-PROD-01 | **Status:** Point-in-time snapshot — will drift as schema evolves.
> Re-run audit after any migration that adds, removes, or restructures tables.

---

## Summary

| Metric | Value |
|---|---|
| Total tables (public schema) | 26 real + 1 internal |
| Tables with RLS enabled | 4 |
| Tables with 0 rows (empty scaffolds) | 4 |
| Total rows across all tables | ~79,000 |
| Migration tracking via Supabase CLI | Not active (list_migrations returns empty) |

> **CLAUDE.md discrepancy:** Known Project State says "13 undocumented Supabase tables". Actual count is 26. CLAUDE.md needs update (deferred to LOT-OP-03).

---

## Table Inventory by Layer

### Group 1 — Core Encyclopedia

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `games` | 1,509 | YES | `id` (text) | Master game record — central hub for all FK relationships |
| `consoles` | 25 | YES | `id` (text) | Platform reference — 25 consoles |
| `franchise_entries` | 15 | YES | `slug` (text) | Franchise groupings linked from games.franch_id |

**games** — 44 columns. Dense denormalized record combining identity, pricing, editorial status, media status, and confidence scoring. Notable fields:
- Price denormalization: `loose_price`, `cib_price`, `mint_price`, `price_currency`, `price_confidence_tier`, `price_status` — duplicated from market layer, kept for fast reads.
- Editorial status enum: `empty | partial | complete`
- Price status enum: `empty | synthetic | real`
- Confidence tier: `high | medium | low | unknown`
- Several JSON columns also exist in `game_editorial` (see Group 4 — duplication risk flagged).

**FK hub:** `games.id` is the foreign key target for 14 other tables. It is the spine of the schema.

---

### Group 2 — Collector Layer

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `collection_items` | 7 | YES | `id` (bigint, serial) | Personal collection entries |

**collection_items** — 15 columns. One row per owned item. Links to `games.id`. Key fields:
- `condition`: `loose | cib | mint | other`
- `region`: varchar (PAL / NTSC-U / NTSC-J etc.)
- `completeness`: varchar, default `unknown`
- `qualification_confidence`: varchar, default `unknown`
- `wishlist`: boolean flag (doubles as wishlist)
- `user_session`: text, default `local` — no auth model yet, session-scoped

**Health:** 7 rows = active collection is small. `user_session = 'local'` means no multi-user support. Wishlist mixed into same table as owned items — separation not yet implemented.

---

### Group 3 — Market Layer

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `price_history` | 15,278 | YES | `id` (bigint, serial) | Historical sold prices from all sources |
| `price_sources` | 11 | NO | `id` (int, serial) | Source registry (eBay, Yahoo JP, Catawiki, etc.) |
| `price_ingest_runs` | 0 | NO | `id` (int, serial) | Pipeline run log (scaffolded, empty) |
| `price_rejections` | 0 | NO | `id` (int, serial) | Rejection log (scaffolded, empty) |

**price_history** — 26 columns. The heaviest table by row count. Key fields:
- `source` / `source_id` / `source_market`: dual sourcing model (legacy text + FK to price_sources)
- `price_original` + `currency` + `price_eur`: FX-normalized prices
- `condition_normalized`: `Loose | CIB | Mint` (note: capitalized, differs from collection_items lowercase)
- `normalized_region`: `PAL | NTSC-U | NTSC-J | NTSC-B | MULTI | unknown`
- `sale_type`: `auction | fixed_price_sold | realized_price`
- `is_real_sale`: boolean gate distinguishing actual sold records from listings
- `payload_hash` + `raw_payload`: deduplication and raw storage
- `match_confidence` + `source_confidence`: dual confidence scoring

**price_sources** — 11 rows. Registry of active/approved data sources. Key fields:
- `market_bucket`: grouping (EU, JP, US...)
- `reliability_weight`: numeric weight for confidence scoring
- `is_primary_sold_truth`: marks sources that count as real sold data
- `publish_eligible`: controls whether source data can appear in UI
- `compliance_status`: default `approved_with_review`

**price_ingest_runs** — 0 rows. Full pipeline telemetry scaffold (fetched, normalized, inserted, deduped, matched, rejected counts). Not yet populated — pipeline is running but not logging runs.

**price_rejections** — 0 rows. Rejection audit log. Not yet populated.

**Health flags:**
- Condition enum casing inconsistency: `price_history` uses `Loose/CIB/Mint` (capitalized), `collection_items` uses `loose/cib/mint` (lowercase). Will cause join/comparison bugs.
- `price_ingest_runs` and `price_rejections` are zero — pipeline observability is blind.
- RLS missing on `price_sources`, `price_ingest_runs`, `price_rejections`.

---

### Group 4 — Editorial / Curation

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `game_editorial` | 1,506 | NO | `game_id` (text) | Long-form editorial content per game |
| `game_content_profiles` | 1,483 | NO | `game_id` (text) | Content completeness profile per game |
| `game_curation_states` | 1,483 | NO | `game_id` (text) | Curation workflow state machine per game |
| `game_curation_events` | 2,767 | NO | `id` (bigint, serial) | Immutable curation event log |
| `console_publication_slots` | 1,025 | NO | `id` (bigint, serial) | Ranked game slots per console pass |

**game_editorial** — Long-form content: `summary`, `synopsis`, `lore`, `gameplay_description`, `characters`, `dev_anecdotes`, `cheat_codes`, `versions`, `avg_duration_main`, `avg_duration_complete`, `speedrun_wr`.

> **DUPLICATION RISK:** `games` has the same fields (`summary`, `synopsis`, `lore`, `gameplay_description`, `characters`, `dev_anecdotes`, `cheat_codes`, `versions`, `avg_duration_main`, `avg_duration_complete`, `speedrun_wr`). This is a migration in progress — `game_editorial` is the target normalization but `games` still carries copies. Writers may update one and not the other. Resolution is OUT OF SCOPE for this lot.

**game_content_profiles** — Per-game content completeness model. Key fields:
- `profile_version`, `profile_mode` (default `heuristic`)
- `content_profile_json`: expected field coverage
- `profile_basis_json`: scoring basis
- `relevant_expected`: count of relevant sections

**game_curation_states** — State machine per game. Key fields:
- `pass_key`, `status` (the curation pass this state belongs to)
- `is_target`: whether this game is in scope for the current enrichment pass
- `completion_score`, `relevant_expected`, `relevant_filled`
- `missing_relevant_sections_json`, `critical_errors_json`, `validation_summary_json`
- `published_at`, `locked_at`: publication gates
- `immutable_hash`: content fingerprint at publish time

**game_curation_events** — Append-only log of state transitions. Key fields:
- `event_key` (unique): deduplication key
- `from_status` → `to_status`
- `reason`, `run_key`, `diff_summary_json`

**console_publication_slots** — Per-console ranked list of published games. Key fields:
- `slot_rank`: ordered position within console
- `pass_key`: which curation pass produced this slot
- `is_active`: soft delete / deactivation
- `published_at`

---

### Group 5 — People & OST

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `people` | 1,314 | NO | `id` (text) | Persons (developers, composers, directors) |
| `game_people` | 3,919 | NO | `id` (bigint, serial) | Game ↔ person relationships with role |
| `ost` | 978 | NO | `id` (text) | Soundtrack header per game |
| `ost_tracks` | 186 | NO | `id` (bigint, serial) | Individual OST tracks |
| `ost_releases` | 0 | NO | `id` (bigint, serial) | OST release/label info (empty scaffold) |

**people** — `name`, `normalized_name`, `primary_role`. Source-linked. 1,314 persons.

**game_people** — Junction table. `role`, `billing_order`, `confidence`, `is_inferred`. 3,919 relationships across 1,509 games = ~2.6 credits per game on average.

**ost** — One header per game soundtrack. `needs_release_enrichment` flag indicates backfill queue. 978 OSTs for 1,509 games = ~65% coverage.

**ost_tracks** — 186 tracks across 978 OSTs = sparse. Most OSTs have no tracks yet.

**ost_releases** — 0 rows. Scaffold for label/catalog enrichment. Not populated.

---

### Group 6 — Provenance & Quality

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `source_records` | 9,065 | NO | `id` (bigint, serial) | Source attribution records |
| `field_provenance` | 18,009 | NO | `id` (bigint, serial) | Field-level provenance per entity |
| `quality_records` | 1,516 | NO | `id` (bigint, serial) | Quality / completeness scores per entity |
| `media_references` | 4,932 | NO | `id` (bigint, serial) | Media URLs with compliance tracking |

**source_records** — Central provenance registry. Key fields:
- `entity_type`, `entity_id`: polymorphic reference (games, people, ost, etc.)
- `source_name`, `source_type`, `source_url`, `source_license`
- `compliance_status`, `confidence_level` (default 0.5)
- `ingested_at`, `last_verified_at`
Referenced by FK from 11 other tables.

**field_provenance** — 18,009 rows. Granular field-level tracking.
- `entity_type`, `entity_id`, `field_name` per row
- `source_record_id` FK
- `value_hash`: fingerprint to detect stale provenance
- `is_inferred`, `confidence_level`, `verified_at`

**quality_records** — 1,516 rows (≈ 1 per game).
- `completeness_score`, `confidence_score`, `source_coverage_score`, `freshness_score`, `overall_score`
- `tier`: quality tier label
- `missing_critical_fields`, `breakdown_json`, `priority_score`
This table drives enrichment prioritization.

**media_references** — 4,932 rows. Polymorphic (`entity_type` + `entity_id`). Key fields:
- `media_type`, `url`, `provider`, `preview_url`, `asset_subtype`
- `license_status` (default `reference_only`)
- `ui_allowed` (default false) — explicit gate before displaying media
- `compliance_status`, `healthcheck_status` (default `unchecked`)
- `last_checked_at`: freshness of health check

**Health flag:** `ui_allowed = false` default means no media renders in UI unless explicitly approved. 4,932 references but unknown how many are `ui_allowed = true`.

---

### Group 7 — Competitive & Records

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `game_competitive_profiles` | 10 | NO | `game_id` (text) | Competitive relevance flags per game |
| `game_record_categories` | 28 | NO | `id` (text) | Speedrun/score-attack categories |
| `game_record_entries` | 140 | NO | `id` (text) | Individual record holders |
| `game_achievement_profiles` | 0 | NO | `game_id` (text) | Achievement data (empty scaffold) |

**game_competitive_profiles** — 10 rows. Boolean flags: `speedrun_relevant`, `score_attack_relevant`, `leaderboard_relevant`, `achievement_competitive`. Very sparse — only 10 of 1,509 games tagged.

**game_record_categories** — 28 categories across those 10 games.

**game_record_entries** — 140 individual entries (player handle, score, rank, achieved_at, external URL). Linked to both category and game.

**game_achievement_profiles** — 0 rows. Scaffold for RetroAchievements or similar. Not populated.

---

### Internal

| Table | Rows | RLS | PK | Role |
|---|---|---|---|---|
| `_schema_migrations` | 1 | NO | `id` (text) | Internal migration tracker |

**_schema_migrations** — 1 row only. The Supabase CLI migration list (`list_migrations`) returns empty. Migrations have been applied ad-hoc (via dashboard or direct SQL) rather than through the CLI migration system. Commits reference migrations 014+015 but they are not tracked here.

---

## Cross-Cutting Findings

### F1 — True table count is 26, not 13
CLAUDE.md Known Project State says "13 undocumented Supabase tables discovered during audit." The real count is 26 real tables + 1 internal. CLAUDE.md needs updating (deferred to LOT-OP-03).

### F2 — RLS covers only 4 of 26 tables
Tables with RLS: `games`, `consoles`, `franchise_entries`, `collection_items`.
Tables without RLS (22): all provenance, editorial, market pipeline, people, OST, curation, competitive, and quality tables. These are readable by any authenticated or anonymous Supabase client depending on project policy. Not necessarily a production risk if the project uses Supabase service role exclusively from the backend — but it is an architectural assumption that is nowhere documented.

### F3 — Condition enum casing mismatch
`price_history.condition`: values are `loose | cib | mint` (lowercase) with a constraint.
`price_history.condition_normalized`: values are `Loose | CIB | Mint` (capitalized) with a separate constraint.
`collection_items.condition`: `loose | cib | mint` (lowercase).
Any query joining or comparing condition across these columns without normalization will silently mismatch. This is an active data integrity risk.

### F4 — games / game_editorial field duplication
`games` has: `summary`, `synopsis`, `lore`, `gameplay_description`, `characters`, `dev_anecdotes`, `cheat_codes`, `versions`, `avg_duration_main`, `avg_duration_complete`, `speedrun_wr`.
`game_editorial` has: the same fields. Migration toward normalization is in progress but not complete. Two sources of truth exist simultaneously. A write to `games` and a write to `game_editorial` are not synchronized.

### F5 — Migration tracking is not active
`list_migrations` returns empty. Commits reference migrations 014+015, which means migrations were applied via dashboard or raw SQL — not through the Supabase CLI migration system. There is no rollback path and no migration history queryable from the CLI. This is an operational risk for any schema change.

### F6 — Four empty scaffold tables
`ost_releases` (0), `price_ingest_runs` (0), `price_rejections` (0), `game_achievement_profiles` (0). These tables are schema-ready but have never received data. `price_ingest_runs` and `price_rejections` are particularly concerning — the market pipeline is running but not logging run telemetry or rejections.

### F7 — media_references: unknown ui_allowed ratio
4,932 media references exist but `ui_allowed` defaults to false. Unknown how many have been explicitly approved for UI display. If the ratio is low, the media layer is effectively dark in production.

---

## Next Steps (ranked by risk)

| Priority | Finding | Action | Lot |
|---|---|---|---|
| 1 | F3 — Condition casing mismatch | Audit query paths that join condition fields; normalize or add a view | LOT-FIX-01 |
| 2 | F5 — Migration tracking gap | Establish CLI migration discipline; document current ad-hoc state | LOT-OP-03 |
| 3 | F6 — Pipeline telemetry blind | Enable price_ingest_runs + price_rejections logging in pipeline | LOT-PROD-02 |
| 4 | F4 — Editorial duplication | Decide: games fields are cache (read from game_editorial) or remove from games | THINK lot |
| 5 | F2 — RLS gaps | Document intended security model; enable RLS where needed | THINK lot |
| 6 | F7 — media ui_allowed ratio | Run a count query; understand what is actually serving in UI | LOT-PROD-02 |
| 7 | F1 — CLAUDE.md table count | Update "13 tables" to "26 tables" in CLAUDE.md | LOT-OP-03 |
