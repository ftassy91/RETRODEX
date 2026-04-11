# SUPABASE_AUDIT.md

**Project:** ftassy91's Project (doipqgkhfzqvmzrdfvuq)
**Region:** eu-west-1 | **Postgres:** 17.6.1
**Audit date:** 2026-04-11
**Tables:** 33 (27 original + collection_snapshots, game_anecdotes, baz_replies, game_snapshots added 2026-04-10/11)

---

## Table of Contents

1. [Summary](#summary)
2. [Domain Map](#domain-map)
3. [Relationship Graph](#relationship-graph)
4. [Table Reference](#table-reference)
5. [Health Flags](#health-flags)
6. [Out-of-Scope Observations](#out-of-scope-observations)

---

## Summary

| Metric | Value |
|---|---|
| Total tables | 33 |
| Total rows (approx) | ~60,000 |
| Tables with RLS | 31/31 (all protected — LOT-PROD-06 + new tables) |
| Tables without RLS | 0 |
| Empty tables (0 rows) | 3 (game_achievement_profiles, ost_releases, price_ingest_runs, price_rejections) |
| Tables with no service reference | 12 |
| Duplicated field groups | 1 (games <> game_editorial: 11 shared columns) |

---

## Domain Map

### ENCYCLOPEDIA (core catalog)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| games | 1,509 | yes | dex.js, queries.js, catalog.js, storage.js, search |
| consoles | 25 | yes | fetchers.js |
| franchise_entries | 15 | yes | catalog.js, franchises.js, stats.js, fetchers.js |
| game_editorial | 1,509 | no | media.js |
| people | 1,314 | no | **none** |
| game_people | 3,919 | no | credits.js |

### MARKET (pricing layer)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| price_history | 15,278 | yes | queries.js, catalog.js, games-helpers.js |
| price_sources | 11 | no | **none** (registry in source-registry.js) |
| price_ingest_runs | 0 | no | **none** |
| price_rejections | 0 | no | **none** |

### COLLECTION (user layer)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| collection_items | 8 | yes | storage.js, write.js, collection-service.js |
| collection_snapshots | ~30 | yes | cron.js (daily), collection routes |
| game_snapshots | ~150 | yes | cron.js (daily), game-detail routes |

### PROVENANCE (sourcing + quality)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| source_records | 9,065 | no | **none** (pipeline-only) |
| field_provenance | 18,009 | no | **none** (pipeline-only) |
| quality_records | 1,516 | no | **none** (pipeline-only) |
| media_references | 4,932 | no | media.js, public-publication-service.js |

### CURATION (editorial pipeline)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| game_content_profiles | 1,483 | no | media.js |
| game_curation_states | 1,483 | no | public-publication-service.js |
| game_curation_events | 2,767 | no | **none** (pipeline-only) |
| console_publication_slots | 1,025 | no | **none** (pipeline-only) |

### COMPETITIVE (records + achievements)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| game_competitive_profiles | 10 | no | **none** |
| game_record_categories | 28 | no | **none** |
| game_record_entries | 140 | no | **none** |
| game_achievement_profiles | 0 | no | **none** |

### OST (soundtracks)

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| ost | 978 | no | credits.js |
| ost_tracks | 186 | no | credits.js |
| ost_releases | 0 | no | credits.js |

### BAZ COMPANION

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| baz_replies | 58 | yes | baz routes (curated replies, mood tags, usage_count) |
| game_anecdotes | 48 | yes | game-detail routes (BAZ fun facts per game) |

### INFRASTRUCTURE

| Table | Rows | RLS | Service refs |
|---|---|---|---|
| _schema_migrations | 1 | no | **none** (migration tooling) |

---

## Relationship Graph

```
games (1,509) ──PK: id
  ├── game_editorial.game_id
  ├── game_people.game_id
  ├── price_history.game_id
  ├── collection_items.game_id
  ├── game_snapshots.game_id
  ├── game_anecdotes.game_id
  ├── game_content_profiles.game_id
  ├── game_curation_states.game_id
  ├── game_curation_events.game_id
  ├── game_competitive_profiles.game_id
  ├── game_record_categories.game_id
  ├── game_record_entries.game_id
  ├── game_achievement_profiles.game_id
  ├── console_publication_slots.game_id
  ├── ost.game_id
  └── games.franch_id → franchise_entries.slug

consoles (25) ──PK: id
  └── console_publication_slots.console_id

franchise_entries (15) ──PK: slug
  └── games.franch_id

people (1,314) ──PK: id
  ├── game_people.person_id
  └── ost_tracks.composer_person_id

source_records (9,065) ──PK: id
  ├── field_provenance.source_record_id
  ├── game_editorial.source_record_id
  ├── game_people.source_record_id
  ├── game_competitive_profiles.source_record_id
  ├── game_record_categories.source_record_id
  ├── game_record_entries.source_record_id
  ├── game_achievement_profiles.source_record_id
  ├── ost.source_record_id
  ├── ost_tracks.source_record_id
  ├── ost_releases.source_record_id
  └── people.source_record_id

ost (978) ──PK: id
  ├── ost_tracks.ost_id
  └── ost_releases.ost_id

game_record_categories (28) ──PK: id
  └── game_record_entries.category_id
```

**Hub tables** (most FK references): `games` (16 inbound FKs), `source_records` (11 inbound FKs)

---

## Table Reference

### games

**Role:** Central encyclopedia entity. Every game in the catalog.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| title | text | no | |
| console | text | yes | |
| year | integer | yes | |
| developer | text | yes | |
| genre | text | yes | |
| metascore | integer | yes | |
| rarity | text | yes | CHECK: LEGENDARY, EPIC, RARE, UNCOMMON, COMMON |
| type | text | yes | default 'game' |
| slug | text | yes | UNIQUE |
| franch_id | text | yes | FK → franchise_entries.slug |
| loose_price | numeric | yes | |
| cib_price | numeric | yes | |
| mint_price | numeric | yes | |
| source_confidence | numeric | yes | default 0.30 |
| price_confidence_tier | text | yes | CHECK: high, medium, low, unknown |
| price_confidence_reason | text | yes | |
| price_last_updated | date | yes | |
| price_currency | varchar | yes | |
| source_names | text | yes | |
| editorial_status | text | yes | CHECK: complete, partial, empty. Default 'empty' |
| media_status | text | yes | CHECK: complete, partial, empty. Default 'empty' |
| price_status | text | yes | CHECK: real, synthetic, empty. Default 'empty' |
| summary | text | yes | **DUPLICATED in game_editorial** |
| synopsis | text | yes | **DUPLICATED in game_editorial** |
| tagline | text | yes | |
| lore | text | yes | **DUPLICATED in game_editorial** |
| gameplay_description | text | yes | **DUPLICATED in game_editorial** |
| characters | jsonb | yes | **DUPLICATED in game_editorial** |
| dev_anecdotes | jsonb | yes | **DUPLICATED in game_editorial** |
| dev_team | jsonb | yes | |
| cheat_codes | jsonb | yes | **DUPLICATED in game_editorial** |
| similar_ids | jsonb | yes | |
| versions | jsonb | yes | **DUPLICATED in game_editorial** |
| avg_duration_main | numeric | yes | **DUPLICATED in game_editorial** |
| avg_duration_complete | numeric | yes | **DUPLICATED in game_editorial** |
| speedrun_wr | jsonb | yes | **DUPLICATED in game_editorial** |
| cover_url | text | yes | |
| youtube_id | text | yes | |
| youtube_verified | boolean | yes | |
| archive_id | text | yes | |
| archive_verified | boolean | yes | |
| manual_url | text | yes | |
| ost_composers | jsonb | yes | |
| ost_notable_tracks | jsonb | yes | |
| created_at | timestamptz | yes | default now() |
| updated_at | timestamptz | yes | default now() |

**Notes:** 44 columns. 11 columns duplicated with game_editorial. The games table serves as both catalog index and denormalized read model.

---

### consoles

**Role:** Platform reference data.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| title | text | no | |
| platform | text | no | UNIQUE |
| year | integer | yes | |
| manufacturer | text | yes | |
| media_type | text | yes | |
| created_at | timestamptz | yes | default now() |

---

### franchise_entries

**Role:** Game franchise groupings (e.g., Zelda, Mario, Final Fantasy).

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| slug | text | no | PK |
| name | text | no | |
| synopsis | text | yes | |
| first_game_year | integer | yes | |
| last_game_year | integer | yes | |
| developer | text | yes | |
| genres | jsonb | yes | |
| platforms | jsonb | yes | |
| game_ids | jsonb | yes | |
| heritage | text | yes | |
| created_at | timestamptz | yes | default now() |
| updated_at | timestamptz | yes | default now() |

---

### game_editorial

**Role:** Normalized editorial content per game (split from games table).

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| game_id | text | no | PK, FK → games.id |
| summary | text | yes | |
| synopsis | text | yes | |
| lore | text | yes | |
| gameplay_description | text | yes | |
| characters | jsonb | yes | |
| dev_anecdotes | text | yes | Note: text here vs jsonb in games |
| cheat_codes | jsonb | yes | |
| versions | jsonb | yes | |
| avg_duration_main | numeric | yes | |
| avg_duration_complete | numeric | yes | |
| speedrun_wr | jsonb | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

**Notes:** `dev_anecdotes` is text here but jsonb in games table — type mismatch across the duplication.

---

### people

**Role:** People involved in game development/production.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| name | text | no | |
| normalized_name | text | no | |
| primary_role | text | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### game_people

**Role:** Junction table linking games to people with roles.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| game_id | text | no | FK → games.id |
| person_id | text | no | FK → people.id |
| role | text | no | |
| billing_order | integer | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| confidence | numeric | no | default 0.5 |
| is_inferred | boolean | no | default false |

---

### collection_items

**Role:** User collection entries (owned, wanted, for_sale).

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| game_id | text | no | FK → games.id |
| user_session | text | yes | default 'local' |
| condition | text | yes | CHECK: loose, cib, mint, other |
| price_paid | numeric | yes | |
| date_acquired | date | yes | |
| notes | text | yes | |
| wishlist | boolean | yes | default false |
| edition_note | text | yes | |
| region | varchar | yes | |
| completeness | varchar | yes | default 'unknown' |
| qualification_confidence | varchar | yes | default 'unknown' |
| qualification_updated_at | timestamptz | yes | |
| created_at | timestamptz | yes | default now() |
| updated_at | timestamptz | yes | default now() |

**Notes:** Missing `user_id`, `list_type`, `purchase_date`, `personal_note`, `price_threshold` columns that the service layer expects (storage.js queries for them). The service has a legacy fallback path using `wishlist` boolean.

---

### price_history

**Role:** Individual price observations from market sources.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| game_id | text | no | FK → games.id |
| price | numeric | no | |
| condition | text | yes | CHECK: loose, cib, mint |
| sale_date | timestamptz | yes | |
| source | text | yes | default 'ebay' |
| listing_url | text | yes | |
| ebay_item_id | text | yes | |
| listing_title | text | yes | |
| source_id | integer | yes | |
| source_market | text | yes | |
| is_real_sale | boolean | yes | |
| sale_type | text | yes | CHECK: auction, fixed_price_sold, realized_price |
| listing_reference | text | yes | |
| sold_at | timestamptz | yes | |
| currency | varchar | yes | |
| price_original | float8 | yes | |
| price_eur | float8 | yes | |
| title_raw | text | yes | |
| condition_normalized | text | yes | CHECK: Loose, CIB, Mint |
| normalized_region | text | yes | CHECK: PAL, NTSC-U, NTSC-J, NTSC-B, MULTI, unknown |
| country_code | varchar | yes | |
| match_confidence | float8 | yes | |
| source_confidence | float8 | yes | |
| payload_hash | varchar | yes | |
| raw_payload | jsonb | yes | |
| created_at | timestamptz | yes | default now() |

**Notes:** 27 columns. Dual condition fields (`condition` lowercase + `condition_normalized` capitalized). Dual price fields (`price` + `price_original` + `price_eur`). Data sources: pricecharting (15,178 rows), Yahoo Auctions Japan (100 rows).

---

### price_sources

**Role:** Registry of market data sources with reliability weights.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | integer | no | PK (serial) |
| slug | text | no | UNIQUE |
| name | text | no | |
| market_bucket | text | no | |
| source_type | text | no | |
| reliability_weight | float8 | no | default 0 |
| default_currency | varchar | yes | |
| compliance_status | text | no | default 'approved_with_review' |
| is_active | boolean | no | default true |
| is_primary_sold_truth | boolean | no | default false |
| publish_eligible | boolean | no | default false |
| notes | text | yes | |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

**Notes:** Also hardcoded in source-registry.js — dual source of truth.

---

### price_ingest_runs

**Role:** Pipeline run tracking for market data ingestion. **EMPTY.**

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | integer | no | PK (serial) |
| source_id | integer | yes | |
| source_market | text | yes | |
| status | text | no | |
| started_at | timestamptz | no | |
| finished_at | timestamptz | yes | |
| fetched_count | integer | no | default 0 |
| normalized_count | integer | no | default 0 |
| inserted_count | integer | no | default 0 |
| deduped_count | integer | no | default 0 |
| matched_count | integer | no | default 0 |
| rejected_count | integer | no | default 0 |
| published_games_count | integer | no | default 0 |
| notes | text | yes | |
| error_summary | text | yes | |
| run_key | text | yes | |
| pipeline_name | text | yes | |
| source_scope | text | yes | |
| dry_run | boolean | yes | |

---

### price_rejections

**Role:** Rejected price observations from pipeline. **EMPTY.**

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | integer | no | PK (serial) |
| source_id | integer | yes | |
| source_market | text | yes | |
| listing_reference | text | yes | |
| title_raw | text | yes | |
| rejection_reason | text | no | |
| rejection_stage | text | no | |
| raw_payload | text | yes | |
| created_at | timestamptz | no | default now() |

---

### source_records

**Role:** Provenance tracking — which external source provided data.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| entity_type | text | no | |
| entity_id | text | no | |
| field_name | text | yes | |
| source_name | text | no | |
| source_type | text | no | |
| source_url | text | yes | |
| source_license | text | yes | |
| compliance_status | text | no | |
| ingested_at | timestamptz | no | |
| last_verified_at | timestamptz | yes | |
| confidence_level | numeric | no | default 0.5 |
| notes | text | yes | |

---

### field_provenance

**Role:** Per-field provenance — which source provided which field value.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| entity_type | text | no | |
| entity_id | text | no | |
| field_name | text | no | |
| source_record_id | bigint | yes | FK → source_records.id |
| value_hash | text | yes | |
| is_inferred | boolean | no | default false |
| confidence_level | numeric | no | default 0.5 |
| verified_at | timestamptz | yes | |

---

### quality_records

**Role:** Computed quality scores per entity.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| entity_type | text | no | |
| entity_id | text | no | |
| completeness_score | integer | no | |
| confidence_score | integer | no | |
| source_coverage_score | integer | no | |
| freshness_score | integer | yes | |
| overall_score | integer | no | |
| tier | text | no | |
| missing_critical_fields | jsonb | yes | |
| breakdown_json | jsonb | yes | |
| priority_score | numeric | yes | |
| updated_at | timestamptz | no | |

---

### media_references

**Role:** Links to external media (covers, screenshots, videos) with compliance tracking.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| entity_type | text | no | |
| entity_id | text | no | |
| media_type | text | no | |
| url | text | no | |
| provider | text | yes | |
| compliance_status | text | yes | |
| storage_mode | text | yes | |
| source_record_id | bigint | yes | |
| title | text | yes | |
| preview_url | text | yes | |
| asset_subtype | text | yes | |
| license_status | text | no | default 'reference_only' |
| ui_allowed | boolean | no | default false |
| healthcheck_status | text | no | default 'unchecked' |
| notes | text | yes | |
| last_checked_at | timestamptz | yes | |
| source_context | jsonb | yes | |
| created_at | timestamptz | yes | default now() |
| updated_at | timestamptz | yes | default now() |

---

### game_content_profiles

**Role:** Content completeness profiles per game (heuristic or computed).

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| game_id | text | no | PK, FK → games.id |
| console_id | text | yes | |
| profile_version | text | no | |
| profile_mode | text | no | default 'heuristic' |
| content_profile_json | jsonb | no | |
| profile_basis_json | jsonb | yes | |
| relevant_expected | integer | no | default 0 |
| updated_at | timestamptz | no | default now() |

---

### game_curation_states

**Role:** Curation workflow state machine per game.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| game_id | text | no | PK, FK → games.id |
| console_id | text | yes | |
| pass_key | text | no | |
| status | text | no | |
| selection_score | numeric | yes | |
| target_rank | integer | yes | |
| is_target | boolean | no | default false |
| completion_score | numeric | no | default 0 |
| relevant_expected | integer | no | default 0 |
| relevant_filled | integer | no | default 0 |
| missing_relevant_sections_json | jsonb | yes | |
| critical_errors_json | jsonb | yes | |
| validation_summary_json | jsonb | yes | |
| last_validated_at | timestamptz | yes | |
| locked_at | timestamptz | yes | |
| published_at | timestamptz | yes | |
| content_version | text | yes | |
| immutable_hash | text | yes | |
| updated_at | timestamptz | no | default now() |

---

### game_curation_events

**Role:** Audit log for curation state transitions.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| event_key | text | no | UNIQUE |
| game_id | text | no | FK → games.id |
| from_status | text | yes | |
| to_status | text | no | |
| reason | text | no | |
| run_key | text | yes | |
| diff_summary_json | jsonb | yes | |
| created_at | timestamptz | no | default now() |

---

### console_publication_slots

**Role:** Which games are published (visible) per console, with ranking.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| console_id | text | no | FK → consoles.id |
| game_id | text | no | FK → games.id |
| pass_key | text | no | |
| slot_rank | integer | no | |
| is_active | boolean | no | default true |
| published_at | timestamptz | yes | |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### game_competitive_profiles

**Role:** Competitive gaming relevance flags per game. 10 rows.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| game_id | text | no | PK, FK → games.id |
| speedrun_relevant | boolean | no | default false |
| score_attack_relevant | boolean | no | default false |
| leaderboard_relevant | boolean | no | default false |
| achievement_competitive | boolean | no | default false |
| primary_source | text | yes | |
| source_summary | jsonb | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| freshness_checked_at | timestamptz | yes | |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### game_record_categories

**Role:** Speedrun/high-score category definitions per game.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| game_id | text | no | FK → games.id |
| category_key | text | yes | |
| label | text | no | |
| record_kind | text | yes | |
| value_direction | text | yes | |
| external_url | text | yes | |
| source_name | text | no | |
| source_type | text | no | |
| source_url | text | yes | |
| observed_at | timestamptz | yes | |
| is_primary | boolean | no | default false |
| display_order | integer | no | default 0 |
| source_record_id | bigint | yes | FK → source_records.id |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### game_record_entries

**Role:** Individual records (speedrun times, high scores) per category.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| category_id | text | no | FK → game_record_categories.id |
| game_id | text | no | FK → games.id |
| rank_position | integer | yes | |
| player_handle | text | yes | |
| score_raw | text | yes | |
| score_display | text | no | |
| achieved_at | timestamptz | yes | |
| external_url | text | yes | |
| source_name | text | no | |
| source_type | text | no | |
| source_url | text | yes | |
| observed_at | timestamptz | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### game_achievement_profiles

**Role:** Achievement/trophy system metadata per game. **EMPTY.**

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| game_id | text | no | PK, FK → games.id |
| source_name | text | no | |
| source_type | text | no | |
| source_url | text | yes | |
| points_total | integer | yes | |
| achievement_count | integer | yes | |
| leaderboard_count | integer | yes | |
| mastery_summary | text | yes | |
| high_score_summary | text | yes | |
| observed_at | timestamptz | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### ost

**Role:** Original soundtrack entries per game.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| game_id | text | no | FK → games.id |
| title | text | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| confidence | numeric | no | default 0.5 |
| needs_release_enrichment | boolean | no | default false |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

---

### ost_tracks

**Role:** Individual tracks within an OST.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| ost_id | text | no | FK → ost.id |
| track_title | text | no | |
| track_number | integer | yes | |
| composer_person_id | text | yes | FK → people.id |
| source_record_id | bigint | yes | FK → source_records.id |
| confidence | numeric | no | default 0.5 |

---

### ost_releases

**Role:** Physical/digital release metadata for OSTs. **EMPTY.**

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| ost_id | text | no | FK → ost.id |
| region_code | text | yes | |
| release_date | date | yes | |
| catalog_number | text | yes | |
| label | text | yes | |
| source_record_id | bigint | yes | FK → source_records.id |
| confidence | numeric | no | default 0.5 |

---

### _schema_migrations

**Role:** Migration tracking.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | text | no | PK |
| file_name | text | no | |
| applied_at | text | no | |

---

### collection_snapshots

**Role:** Daily snapshot of total collection value for evolution chart.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| snapshot_date | date | no | UNIQUE |
| total_items | integer | no | |
| total_value_loose | numeric | yes | |
| total_value_cib | numeric | yes | |
| created_at | timestamptz | yes | default now() |

**Notes:** Populated daily by /api/cron/snapshot. Powers SVG evolution chart on collection page.

---

### game_snapshots

**Role:** Daily per-game price snapshot for individual price evolution.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| game_id | text | no | FK → games.id |
| snapshot_date | date | no | |
| loose_price | numeric | yes | |
| cib_price | numeric | yes | |
| created_at | timestamptz | yes | default now() |

**Notes:** Populated daily by /api/cron/snapshot. UNIQUE(game_id, snapshot_date).

---

### baz_replies

**Role:** Curated BAZ replies with mood tags and usage tracking.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| intent | text | no | |
| text | text | no | |
| mood | text | yes | |
| usage_count | integer | yes | default 0 |
| created_at | timestamptz | yes | default now() |

**Notes:** 58 curated replies. Used by baz-engine for personality-consistent responses.

---

### game_anecdotes

**Role:** BAZ fun facts / anecdotes per game.

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| id | bigint | no | PK (serial) |
| game_id | text | no | FK → games.id |
| baz_intro | text | yes | |
| anecdote_text | text | no | |
| source | text | yes | |
| created_at | timestamptz | yes | default now() |

**Notes:** 48 anecdotes for 39 games. Displayed on game-detail page, BAZ speaks once per game.

---

## Health Flags

### FLAG-01: Field duplication — games <> game_editorial — RESOLVED (LOT-PROD-05)

11 columns exist in both `games` and `game_editorial`.
`dev_anecdotes` type mismatch (jsonb vs text) remains — not synced.

**Status:** Data synced bidirectionally (2026-04-10). 0 divergences on 10/11 fields.
**Remaining:** `dev_anecdotes` type mismatch. Structural duplication persists (11 columns in two tables).

### FLAG-02: RLS inconsistency — RESOLVED (LOT-PROD-06)

**Status:** All 27/27 tables now have RLS enabled (2026-04-10).

| Policy pattern | Tables |
|---|---|
| SELECT only (public read) | 25 catalog/provenance/market tables |
| Full CRUD (public) | collection_items |
| Locked (no policy, service-key only) | _schema_migrations |

All writes via anon key are now blocked except collection_items. Backend service key bypasses RLS.

### FLAG-03: Empty tables — CLOSED (non-issue)

| Table | Purpose | Verdict |
|---|---|---|
| game_achievement_profiles | RetroAchievements data | Schema ready, pipeline infrastructure for future enrichment |
| ost_releases | Physical OST release info | Schema ready, pipeline infrastructure for future enrichment |
| price_ingest_runs | Pipeline run tracking | Pipeline uses ad-hoc tracking — formal logging not yet wired |
| price_rejections | Rejected price observations | Same as above |

**Status:** No action needed. These are forward-looking schema. Retaining for future pipeline use.

### FLAG-04: Tables with no service reference — CLOSED (pipeline-only)

All 12 tables confirmed as **pipeline-only** — referenced by 57 scripts in `backend/scripts/` (enrichment, publishing, auditing, migration). None are orphaned.

`_schema_migrations`, `console_publication_slots`, `field_provenance`, `game_achievement_profiles`, `game_competitive_profiles`, `game_record_categories`, `game_record_entries`, `people`, `price_ingest_runs`, `price_rejections`, `price_sources`, `quality_records`, `source_records`

**Status:** No action needed. Runtime services read denormalized data from `games`; pipeline scripts write to normalized tables.

### FLAG-05: price_sources dual source of truth — CLOSED (documented)

`price_sources` table (11 rows) mirrors `MARKET_SOURCE_REGISTRY` in `source-registry.js`.

**Architecture:** `source-registry.js` is the **code-authoritative** source (read at import time, used by all pipeline logic). `price_sources` table is the **DB-authoritative** copy (seeded from registry, used by SQL-only queries). No runtime conflict exists — the JS registry is the primary consumer, and the table is populated by `PRICE_SOURCE_SEED_ROWS` from the same registry.

**Status:** Dual source is by design. Risk of drift is low (seed is generated from registry). No action needed.

### FLAG-06: collection_items schema mismatch — RESOLVED (LOT-PROD-04)

**Status:** 6 missing columns added (2026-04-10). Service now runs on canonical path.
Columns added: `user_id`, `list_type`, `added_at`, `purchase_date`, `personal_note`, `price_threshold`.
Legacy columns retained: `wishlist`, `date_acquired`.

---

## Out-of-Scope Observations

1. **No indexes audited** — query performance unknown (would require `pg_indexes` analysis)
2. **No RLS policy content audited** — only checked enabled/disabled flag
3. **Supabase auth tables** not included (auth schema)
4. **Storage buckets** not audited
5. **Edge functions** not audited
6. **games table has 44 columns** — candidate for further normalization beyond the editorial split
7. **price_history has dual condition columns** (`condition` lowercase, `condition_normalized` capitalized) — potential confusion in queries
