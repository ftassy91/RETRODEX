# RetroDex — Phase 1 Fact Audit

**Date de production :** 2026-04-07
**Statut :** audit factuel — non spéculatif

---

## 1. Architecture stabilisée [confirmé]

- Public runtime : Supabase-first via `backend/db_supabase.js`
- Back-office : isolé sous `src/routes/admin` et `src/services/admin`
- Enrichissement premium : `src/services/admin/enrichment/`
- SQLite local : staging/back-office uniquement — NOT prod truth

---

## 2. Migrations appliquées — 13 au total

| Migration | Contenu |
|-----------|---------|
| 20260326_001 | Tables canoniques core : releases, game_editorial, people, game_people, game_companies, price_observations, market_snapshots, media_references, source_records, field_provenance, quality_records, enrichment_runs |
| 20260326_002 | Index runtime + dédup price_observations |
| 20260327_001 | Index de performance |
| 20260330_003 | Ajout sur games : youtube_id, youtube_verified, archive_id, archive_verified |
| 20260330_004 | Align game_editorial, people, game_people, ost, ost_tracks, ost_releases |
| 20260330_005 | Extend media_references : title, preview_url, asset_subtype, license_status, ui_allowed, healthcheck_status, notes, source_context, last_checked_at |
| 20260330_006 | Curation : game_content_profiles, game_curation_states, game_curation_events, console_publication_slots |
| 20260401_007 | Ajout sur games : tagline, cover_url, synopsis, dev_anecdotes, dev_team, cheat_codes + create price_history |
| 20260401_008 | Competitive : game_competitive_profiles, game_record_categories, game_record_entries, game_achievement_profiles |
| 20260402_009 | Phase 1 normalized : game_credits, price_summary, game_ost, game_ost_tracks, competitive_profiles, competitive_records |
| 20260402_010 | Index pour les 6 nouvelles tables normalisées |
| 20260404_011 | Ajout sur games : price_last_updated, source_names |
| 20260405_012 | Backfill games.source_names depuis price_history.source |

1 migration pending_review : `20260331_007_collection_runtime_canonical.js`

---

## 3. Tables — inventaire complet

### Table centrale

- **games** — Entité centrale. 40+ champs. Porte l'identité, le pricing inline, les médias de référence, les champs éditoriaux inline (fallback), et les statuts de curation.

### Tables canoniques actives (lues par services publics)

- **game_editorial** — Contenu éditorial structuré (summary, synopsis, lore, gameplay_description, characters, dev_anecdotes, cheat_codes, versions, durées, speedrun_wr). Canonique si présent ; games.* sert de fallback.
- **game_people** — Crédits individuels (game_id → person_id, role, billing_order, confidence).
- **game_companies** — Crédits sociétés (game_id → company_id, role, confidence).
- **people** — Entités personnes (id, name, normalized_name, primary_role).
- **companies** — Entités sociétés. Référencée dans credits.js ; pas de migration locale visible. [probable Supabase only]
- **media_references** — Tous types de médias externes avec compliance complète.
- **ost** — Albums OST (game_id, title, confidence, needs_release_enrichment).
- **ost_tracks** — Pistes OST (ost_id, track_title, track_number, composer_person_id, confidence).
- **ost_releases** — Éditions physiques OST (region_code, release_date, catalog_number, label).
- **game_competitive_profiles** — Profil compétitif (speedrun_relevant, score_attack_relevant, leaderboard_relevant, achievement_competitive).
- **game_record_categories** — Catégories de records (label, record_kind, source_name, is_primary).
- **game_record_entries** — Entrées de records (rank_position, player_handle, score_display).
- **game_achievement_profiles** — Profil RetroAchievements (points_total, achievement_count, leaderboard_count).
- **game_content_profiles** — Profils d'enrichissement (content_profile_json, profile_version, relevant_expected).
- **game_curation_states** — Lifecycle de curation (pass_key, status, completion_score, is_target, published_at).
- **quality_records** — Scoring qualité back-office (completeness_score, confidence_score, tier).
- **price_history** — Historique de prix (game_id, price, condition, sale_date, source).

### Tables normalisées Phase 1 (créées, non lues par services publics)

- **game_credits** — Unification de game_people + game_companies. Anciennes tables non supprimées.
- **price_summary** — Snapshot prix agrégés (P25/P50/P75 par condition, trend_90d, confidence_score).
- **game_ost** — Version clean de ost (title, track_count, primary_release_date, primary_label).
- **game_ost_tracks** — Version clean de ost_tracks (duration_seconds ajouté).
- **competitive_profiles** — Version simplifiée de game_competitive_profiles.
- **competitive_records** — Version plate de game_record_entries (category_label, record_kind).

### Tables gouvernance / enrichissement (back-office uniquement)

- **source_records** — Traçabilité source par champ/entité.
- **field_provenance** — Provenance par champ (value_hash, is_inferred, confidence_level).
- **enrichment_runs** — Log des runs d'enrichissement.
- **game_curation_events** — Événements lifecycle curation (from_status, to_status, diff_summary_json).
- **console_publication_slots** — Slots de publication par console (slot_rank, is_active).
- **market_snapshots** — Snapshots marché calculés (loose/cib/mint_price, trend_signal, confidence_score).
- **price_observations** — Observations brutes de prix (condition, price, source_name, listing_reference).
- **releases** — Releases régionales (game_id, console_id, region_code, release_date, edition_name).

### Tables model (admin)

- **retrodex_index** — Index marché. Modèle Sequelize présent localement. Usage routes non vérifié. [à vérifier]
- **collection_items** — Collection utilisateur (game_id, user_session).

---

## 4. Ce que l'API expose réellement

### Catalogue — toItemPayload

id, title, console, year, genre, rarity, slug, loosePrice, cibPrice, mintPrice, priceLastUpdated, sourceNames, coverImage, cover_url, synopsis, summary, developer, metascore, trend, curation.{status, isPublished, passKey}, signals.{hasMaps, hasManuals, hasSprites, hasEndings}

### Fiche archive — buildArchivePayload

id, title, reference_ids.{youtube_id, youtube_verified, archive_id, archive_verified}, lore, gameplay_description, characters, versions, ost.{composers, notable_tracks, releases}, duration.{main, complete}, speedrun_wr, production.{developers, publishers, studios, companies, dev_team}, media.{covers, manuals, maps, sprites, assets, screenshots, scans, endings, references}, competition.{profile, featuredRecords, achievementProfile}

### Encyclopédie — buildEncyclopediaPayload

summary, synopsis, lore, gameplay_description, characters, dev_anecdotes, dev_team, cheat_codes, versions, avg_duration_main, avg_duration_complete, speedrun_wr, ost_composers, ost_notable_tracks, competition

---

## 5. Système de scoring premium existant

- Fichiers : `rules.js`, `scoring.js`, `coverage-loaders.js`
- 5 blocs pondérés : identity 25%, editorial 25%, credits 20%, media 20%, music 10%
- Tiers : gold ≥85, silver ≥70, bronze ≥55
- Top100 candidate : publishable + score ≥60
- CLI : `recompute-enrichment-coverage.js`

---

## 6. Double-structure confirmée (ambiguïté critique)

| Domaine | Ancienne (lue par services publics) | Nouvelle (créée, backfillée, non lue) |
|---------|--------------------------------------|---------------------------------------|
| Credits | game_people + game_companies | game_credits |
| OST | ost + ost_tracks | game_ost + game_ost_tracks |
| Compétitif | game_competitive_profiles + game_record_entries | competitive_profiles + competitive_records |
| Prix agrégés | games.loose_price / cib_price / mint_price | price_summary |

---

## 7. Ambiguïtés actives

1. Champs éditoriaux dupliqués : `games.*` (fallback inline) vs `game_editorial` (canonique si présent) — les deux chemins actifs dans `buildArchivePayload` [confirmé]
2. `companies` table référencée dans `credits.js` mais sans migration locale — [probable Supabase only]
3. `franch_id` dans `Game.js` mais table `franchises` non visible dans migrations — [à vérifier]
4. `retrodex_index` model — usage routes non vérifié — [à vérifier]
5. `games.coverImage` (DataTypes.STRING) vs `games.cover_url` (TEXT) — ambiguïté active dans `normalizeCoverFields` [confirmé]
6. `consoleId` / `developerId` / `publisherId` présents dans `Game.js` mais pas le contrat runtime effectif (string-driven) [confirmé]
7. `ost_releases` (ancienne structure) vs `ost_releases` lié à `game_ost` (nouvelle) — fallback osts legacy aussi présent [confirmé]

---

## 8. État des scripts d'enrichissement [confirmé au 2026-04-07]

Scripts actifs dans `backend/scripts/enrichment/` :

- `apply-g2-summary-batch-{16..53}.js` — 38 batches G2 éditoriaux appliqués (summaries tous jeux)
- `apply-richness-batch.js` + `manifests/` — batches synopsis/lore/characters
- `fetch-igdb-covers.js`, `fetch-igdb-covers-pass2.js` — récupération covers IGDB (42 + 22 covers)
- `enrich-dev-team-individuals.js` — 42 jeux avec crédits individuels nommés
- `enrich-ost-corrections.js`, `enrich-ost-corrections-pass2.js` — 85 corrections compositeurs
- `push-ost-devteam-corrections-supabase.js` — push ciblé Supabase (overwrite)
- `publish-editorial-supabase.js`, `publish-credits-music-supabase.js`, `sync-supabase-ui-fields.js` — pipeline sync Supabase
