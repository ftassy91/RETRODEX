# RetroDex — Phase 1 Audit Factuel

**Référence repo :** `origin/main` @ `b4f3a2e` (2026-04-06 12:12)
**Date de production :** 2026-04-07
**Statut :** audit de base — non spéculatif

---

## A. Tables / entités confirmées

### A1. Table centrale

| Table | Statut | Rôle |
|-------|--------|------|
| `games` | **[confirmé]** | Entité centrale. Porte l'identité, le pricing inline, les médias de référence, les champs éditoriaux inline (fallback), les statuts de curation. |

### A2. Tables canoniques actives (lues par les services publics)

| Table | Statut | Rôle |
|-------|--------|------|
| `game_editorial` | **[confirmé]** | Contenu éditorial structuré (summary, synopsis, lore, gameplay, characters, dev_anecdotes, cheat_codes, versions, durées, speedrun_wr). Canonique si présent — games.* sert de fallback. |
| `game_people` | **[confirmé]** | Crédits individuels (game_id → person_id, role, billing_order, confidence). |
| `game_companies` | **[confirmé]** | Crédits sociétés (game_id → company_id, role, confidence). |
| `people` | **[confirmé]** | Entités personnes (id, name, normalized_name, primary_role). |
| `companies` | **[probable]** | Entités sociétés. Référencée dans `credits.js` mais sans migration locale visible. Existe en Supabase. |
| `media_references` | **[confirmé]** | Tous types de médias externes avec compliance complète (cover, manual, map, sprite_sheet, ending, archive_item, youtube_video, screenshot, scan). |
| `ost` | **[confirmé]** | Albums OST (game_id, title, confidence, needs_release_enrichment). |
| `ost_tracks` | **[confirmé]** | Pistes OST (ost_id, track_title, track_number, composer_person_id, confidence). |
| `ost_releases` | **[confirmé]** | Éditions physiques OST (region_code, release_date, catalog_number, label). |
| `game_competitive_profiles` | **[confirmé]** | Profil compétitif (speedrun_relevant, score_attack_relevant, leaderboard_relevant, achievement_competitive). |
| `game_record_categories` | **[confirmé]** | Catégories de records (label, record_kind, source_name, is_primary). |
| `game_record_entries` | **[confirmé]** | Entrées de records (rank_position, player_handle, score_display). |
| `game_achievement_profiles` | **[confirmé]** | Profil RetroAchievements (points_total, achievement_count, leaderboard_count). |
| `game_content_profiles` | **[confirmé]** | Profils d'enrichissement (content_profile_json, profile_version, relevant_expected). |
| `game_curation_states` | **[confirmé]** | Lifecycle de curation (pass_key, status, completion_score, is_target, published_at). |
| `quality_records` | **[confirmé]** | Scoring qualité back-office (completeness_score, confidence_score, tier). |
| `price_history` | **[confirmé]** | Historique de prix (game_id, price, condition, sale_date, source). |

### A3. Tables normalisées "Phase 1" (migration 009 — créées, backfill prêt, NON lues par services publics)

| Table | Statut | Rôle prévu |
|-------|--------|------------|
| `game_credits` | **[confirmé]** | Unification de game_people + game_companies. Les anciennes tables ne sont PAS supprimées. |
| `price_summary` | **[confirmé]** | Snapshot prix agrégés (P25/P50/P75 par condition : loose/cib/mint, trend_90d, confidence_score). |
| `game_ost` | **[confirmé]** | Version clean de `ost` (title, track_count, primary_release_date, primary_label). |
| `game_ost_tracks` | **[confirmé]** | Version clean de `ost_tracks` (duration_seconds ajouté). |
| `competitive_profiles` | **[confirmé]** | Version simplifiée de game_competitive_profiles (is_speedrun_relevant, is_score_attack_relevant, is_achievement_relevant). |
| `competitive_records` | **[confirmé]** | Version plate de game_record_entries (category_label, record_kind : speedrun/score/achievement). |

### A4. Tables gouvernance / enrichissement (back-office uniquement)

| Table | Statut | Rôle |
|-------|--------|------|
| `source_records` | **[confirmé]** | Traçabilité source par champ/entité. |
| `field_provenance` | **[confirmé]** | Provenance par champ (value_hash, is_inferred, confidence_level). |
| `enrichment_runs` | **[confirmé]** | Log des runs d'enrichissement. |
| `game_curation_events` | **[confirmé]** | Événements lifecycle curation (from_status, to_status, diff_summary_json). |
| `console_publication_slots` | **[confirmé]** | Slots de publication par console (slot_rank, is_active). |
| `market_snapshots` | **[confirmé]** | Snapshots marché calculés (loose/cib/mint_price, trend_signal, confidence_score). |
| `price_observations` | **[confirmé]** | Observations brutes de prix (condition, price, source_name, listing_reference). |
| `releases` | **[confirmé]** | Releases régionales (game_id, console_id, region_code, release_date, edition_name). |

### A5. Tables admin / modèles

| Table | Statut | Rôle |
|-------|--------|------|
| `retrodex_index` | **[à vérifier]** | Index marché (item_id, condition, index_value, range_low/high, confidence_pct, trend). Modèle Sequelize présent mais usage routes non vérifié. |
| `collection_items` | **[confirmé]** | Collection utilisateur (game_id, user_session). |

---

## B. Champs confirmés par table

### B1. `games` (table centrale)

**Identité / core :**
- `id` TEXT PK
- `title` TEXT NOT NULL
- `console` TEXT NOT NULL — string libre, contrat runtime effectif
- `consoleId` TEXT — FK vers une future table consoles, PAS le contrat runtime actuel [confirmé]
- `year` INTEGER NOT NULL
- `releaseDate` DATEONLY — date précise, plus spécifique que year
- `developer` TEXT — string libre, contrat runtime effectif
- `developerId` TEXT — FK companies, PAS le contrat runtime actuel
- `publisherId` TEXT — FK companies, PAS le contrat runtime actuel
- `genre` TEXT
- `metascore` INTEGER
- `rarity` TEXT (LEGENDARY / EPIC / RARE / UNCOMMON / COMMON)
- `type` TEXT DEFAULT 'game' — game | console | accessory | ost | collector_edition
- `slug` TEXT UNIQUE — auto-généré
- `source_confidence` FLOAT DEFAULT 0.5
- `franch_id` TEXT — FK franchise non visible dans migrations [à vérifier]
- `barcode` TEXT — code-barres physique
- `tagline` TEXT

**Cover / médias de référence :**
- `cover_url` TEXT
- `coverImage` TEXT — ambiguïté : même valeur que cover_url dans normalizeCoverFields
- `manual_url` TEXT
- `youtube_id` TEXT **[confirmé prod]**
- `youtube_verified` BOOLEAN **[confirmé prod]**
- `archive_id` TEXT **[confirmé prod]**
- `archive_verified` BOOLEAN **[confirmé prod]**

**Editorial inline (fallback quand game_editorial absent) :**
- `summary` TEXT
- `synopsis` TEXT
- `lore` TEXT
- `gameplay_description` TEXT
- `characters` TEXT (JSON)
- `versions` TEXT (JSON)
- `dev_anecdotes` TEXT
- `dev_team` TEXT (JSON)
- `cheat_codes` TEXT (JSON)
- `speedrun_wr` TEXT (JSON)

**Music inline (fallback) :**
- `ost_composers` TEXT (JSON)
- `ost_notable_tracks` TEXT (JSON)
- `avg_duration_main` FLOAT
- `avg_duration_complete` FLOAT

**Pricing :**
- `loose_price` FLOAT (field: loosePrice dans Sequelize)
- `cib_price` FLOAT
- `mint_price` FLOAT

**Statuts Phase 3 [confirmés prod] :**
- `editorial_status` TEXT
- `media_status` TEXT
- `price_status` TEXT

**Nouveaux [confirmés prod, migration 011/012] :**
- `price_last_updated` DATEONLY — date dernière maj prix depuis sources marché
- `source_names` TEXT — sources attribution lisible (ex : "MobyGames, IGDB, PriceCharting")

### B2. `game_editorial`
summary, synopsis, lore, dev_notes, cheat_codes, characters, gameplay_description, dev_anecdotes, versions, avg_duration_main, avg_duration_complete, speedrun_wr, source_record_id

### B3. `people`
id, name, normalized_name, primary_role, source_record_id

### B4. `game_people`
game_id, person_id, role, billing_order, source_record_id, confidence (DEFAULT 0.5), is_inferred

### B5. `game_companies`
game_id, company_id, role, source_record_id, confidence, is_inferred

### B6. `media_references`
entity_type, entity_id, media_type, url, provider, compliance_status, storage_mode, title, preview_url, asset_subtype, license_status, ui_allowed, healthcheck_status, notes, source_context, last_checked_at, source_record_id

### B7. `ost`
id, game_id, title, source_record_id, confidence, needs_release_enrichment

### B8. `ost_tracks`
ost_id, track_title, track_number, composer_person_id, source_record_id, confidence

### B9. `ost_releases`
ost_id, region_code, release_date, catalog_number, label, source_record_id, confidence

### B10. `game_competitive_profiles`
game_id, speedrun_relevant, score_attack_relevant, leaderboard_relevant, achievement_competitive, primary_source, source_summary, freshness_checked_at

### B11. `game_record_categories`
game_id, category_key, label, record_kind, value_direction, external_url, source_name, source_type, is_primary, display_order

### B12. `game_record_entries`
category_id, game_id, rank_position, player_handle, score_raw, score_display, achieved_at, external_url, source_name

### B13. `game_achievement_profiles`
game_id, source_name, source_type, points_total, achievement_count, leaderboard_count, mastery_summary, high_score_summary, observed_at

### B14. `game_curation_states`
game_id, console_id, pass_key, status, selection_score, target_rank, is_target, completion_score, relevant_expected, relevant_filled, missing_relevant_sections_json, validation_summary_json, locked_at, published_at, content_version, immutable_hash

### B15. `price_history`
game_id, price, condition, sale_date, source, listing_title, listing_url

### B16. `price_summary` (Phase 1 normalized, non lue)
game_id, loose_price_p50, loose_price_p25, loose_price_p75, loose_sample_count, cib_price_p50/p25/p75, cib_sample_count, mint_price_p50/p25/p75, mint_sample_count, trend_90d, last_observed_at, confidence_score, computed_at

### B17. `game_credits` (Phase 1 normalized, non lue)
game_id, credited_entity_id, credited_entity_type (person|company), role, billing_order, source_record_id, confidence, is_inferred

---

## C. Champs lus par l'API publique

### C1. Catalogue — `fetchCanonicalGamesList` → `toItemPayload`

Lecture depuis `games` via `queryGames` + `fetchAllSupabaseGames` :
```
id, title, console, year, genre, developer, metascore, rarity, summary, synopsis,
source_confidence, slug, cover_url, loose_price, cib_price, mint_price,
price_last_updated, source_names
```

Transformé en payload :
- id, title, platform/console, year, genre, rarity, type, slug
- loosePrice, cibPrice, mintPrice
- priceLastUpdated, sourceNames
- coverImage, cover_url, synopsis, summary, developer, metascore, trend
- curation.{status, isPublished, passKey}
- signals.{hasMaps, hasManuals, hasSprites, hasEndings}

### C2. Fiche archive — `buildArchivePayload`

Lecture principale depuis `games` (tous champs `*` via `getGameById`).
Lecture secondaire depuis :
- `game_editorial` (summary, synopsis, lore, gameplay_description, characters, dev_anecdotes, cheat_codes, versions, avg_duration_main, avg_duration_complete, speedrun_wr)
- `media_references` (media_type, url, provider, compliance_status, storage_mode, title, preview_url, asset_subtype, license_status, ui_allowed, healthcheck_status, notes, source_context)
- `game_content_profiles` (content_profile_json, profile_version, profile_mode, relevant_expected)
- `game_people` → joint `people` (name, normalized_name, role, billing_order, confidence)
- `game_companies` → joint `companies` (name, country, role)
- `ost` (id, title)
- `ost_tracks` → joint `ost` (track_title, track_number, composer_person_id)
- `ost_releases` → joint `ost` (region_code, release_date, catalog_number, label)
- `game_competitive_profiles`, `game_record_categories`, `game_record_entries`, `game_achievement_profiles`

### C3. Encyclopédie — `buildEncyclopediaPayload`

Sous-ensemble de la fiche archive, sans media, sans OST releases.

### C4. Prix — `fetchSeedPriceHistory`

Lecture depuis `price_history` (price, condition, sale_date).

---

## D. Champs visibles / utilisés côté UI

### D1. Liste catalogue (`games-list.html`)
- Cover, titre, plateforme, année
- Rarity badge
- Prix loose / CIB / MINT (migration B5)
- Date dernière màj prix (`price_last_updated`)
- Sources attribution (`source_names`)
- Confidence tier (tooltip)
- Filtre C2 : archive density (dense / solid / growing / light)

### D2. Fiche détail (`game-detail.html`)
- Identité : titre, plateforme, année, genre, développeur
- Cover + références médias (archive.org, YouTube)
- Synopsis / lore / gameplay_description
- Bloc Production : companies + dev team
- Bloc Musique : composers, tracks, OST releases
- Bloc Compétitif : records, achievements
- Médias : manuals, maps, sprites, endings, screenshots
- Prix avec historique graphé (`feat/price-history-graph`)
- Timestamp dernière màj prix (Sprint A5+B3)

### D3. Hub (`hub.html`)
- Ingest viz feed (stream d'atomes de données enrichies)
- Discover grid

---

## E. Scripts qui enrichissent réellement les champs

### E1. Pipeline legacy (`backend/enrich-database/`)

| Script | Champs enrichis |
|--------|-----------------|
| `enrich_igdb.js` | cover_url, year, genre, developer, metascore, synopsis |
| `enrich_mobygames.js` | developer, publisher, year, genre |
| `enrich_wikipedia.js` / `enrich_wikidata_deep.js` | lore, characters, versions, dev_team, ost_composers |
| `enrich_hltb.js` | avg_duration_main, avg_duration_complete |
| `enrich_editorial.js` | summary, synopsis, gameplay_description |
| `enrich_screenscraper.js` | cover_url, manual_url, archive_id |
| `enrich_prices.js` | loose_price, cib_price, mint_price, price_history |
| `enrich_genres.js` | genre |
| `expand_catalog.js` | id, title, console, year — extension du catalogue |
| `backfill_game_credits.js` | game_credits (Phase 1) depuis game_people + game_companies |
| `backfill_game_ost.js` | game_ost + game_ost_tracks (Phase 1) depuis ost + ost_tracks |
| `backfill_price_summary.js` | price_summary (Phase 1) depuis price_observations |

### E2. Pipeline enrichissement structuré (`backend/scripts/enrichment/`)

| Série | Champs enrichis |
|-------|-----------------|
| G1 (apply-g1-enrichment) | enrichissement initial toutes catégories |
| G2 summary (4 batches) | games.summary, game_editorial.summary |
| G3 dev team (7 batches + autofill) | game_people (directeur, designer, programmeur, producteur), game_companies |
| G4 composers (24 batches) | game_people (composer), ost, ost_tracks |
| G5 premium lot 2 | enrichissement multi-domaines |
| G6 panzer gold | fiches premium ciblées |
| G7 premium lot 3 | enrichissement multi-domaines |
| G8 premium lot 4 | enrichissement multi-domaines |
| media batches | media_references |
| competitive batches (RA, speedrun) | game_competitive_profiles, game_record_categories, game_record_entries, game_achievement_profiles |
| richness batches | game_editorial (lore, characters, dev_anecdotes) |

### E3. Coverage et scoring (back-office)

- `recompute-enrichment-coverage.js` — CLI read-only, produit un rapport JSON de couverture premium par jeu

---

## F. Éléments ambigus ou contradictoires

### F1. Double chemin éditorial [confirmé, actif]
`games.*` (summary, synopsis, lore, etc.) ET `game_editorial.*` coexistent.
`buildArchivePayload` lit `game_editorial` en priorité, utilise `games.*` en fallback.
**Conséquence :** une fiche peut avoir des données dans l'un sans l'autre. La couverture réelle est plus difficile à mesurer.

### F2. Double structure credits [confirmé, phase de transition]
`game_people` + `game_companies` (lues par services publics) et `game_credits` (créée, backfillée, non lue).
Les anciennes tables ne seront PAS supprimées lors de la migration.
**Conséquence :** jusqu'au raccordement des services à `game_credits`, les deux coexistent sans collision mais avec risque de désynchronisation si enrichissement continue sur les anciennes tables.

### F3. Double structure OST [confirmé, phase de transition]
`ost` + `ost_tracks` (lus) et `game_ost` + `game_ost_tracks` (créés, non lus).
Même situation que F2.

### F4. Double structure compétitif [confirmé, phase de transition]
`game_competitive_profiles` + `game_record_entries` (lus) et `competitive_profiles` + `competitive_records` (créés, non lus).

### F5. Pricing double [confirmé, phase de transition]
`games.loose_price / cib_price / mint_price` (lus) et `price_summary` avec percentiles (créée, non lue).
`price_summary` est structurellement plus riche (P25/P50/P75, trend_90d, confidence_score).

### F6. `games.coverImage` vs `games.cover_url` [confirmé]
Deux champs pour la même donnée dans le modèle Sequelize. `normalizeCoverFields` les harmonise à la lecture mais la source canonique reste ambiguë.

### F7. `companies` sans migration locale [probable]
Référencée dans `credits.js` (`.from('companies').select('id,name,country')`).
Pas de migration CREATE TABLE visible pour `companies`. Existe en Supabase.
**Conséquence :** en mode SQLite local, les credits société tombent en fallback vide ou legacy string.

### F8. `franch_id` sans table franchises dans les migrations [confirmé résolu]
`Game.js` déclare `franch_id TEXT`. Aucune migration CREATE TABLE `franchises` visible localement.
En Supabase : la table s'appelle `franchise_entries` (pas `franchises`), avec 15 entrées.
Structure réelle : slug, name, synopsis, first_game_year, last_game_year, developer, genres (JSONB), platforms (JSONB), **game_ids (JSONB)** — liste des IDs de jeux liés, heritage.
104 jeux ont un `franch_id` renseigné. La route `/api/franchises*` pointe vers cette table en Supabase.

### F9. `retrodex_index` — absent en Supabase [confirmé absent]
Modèle Sequelize `RetrodexIndex.js` présent localement.
**Table inexistante en Supabase prod.** L'usage routes est sans effet en prod.

### F10. `consoleId` / `developerId` / `publisherId` — FKs inactifs en prod [confirmé, non en Supabase]
Déclarés dans `Game.js`, présents dans les champs Sequelize.
**Ces colonnes n'existent pas dans la table `games` en Supabase.** (44 colonnes confirmées en prod)
Confirmé dans DECISIONS.md : runtime toujours string-driven sur `games.console` et `games.developer`.

### F11. `game_companies` absent en Supabase [confirmé critique]
La table `game_companies` est présente dans les migrations locales et lue par `credits.js`.
**Elle n'existe pas en Supabase prod.**
Conséquence : en prod, `buildArchivePayload` ne remonte aucune société créditée depuis cette table.
Les crédits société tombent en fallback sur `games.dev_team` (JSON inline) ou restent vides.

### F12. `games` en Supabase : colonnes manquantes vs modèle local [confirmé]
Colonnes présentes localement (Game.js) mais absentes de `games` en Supabase (44 colonnes) :
- `consoleId`, `developerId`, `publisherId` — FKs non appliqués en prod
- `releaseDate` — date précise non migrée en prod
- `barcode` — code-barres non migré en prod
- `coverImage` — alias JavaScript uniquement, pas une colonne DB réelle (normalizeCoverFields le crée en mémoire depuis cover_url)

Colonnes présentes en Supabase mais non documentées dans le modèle local :
- `similar_ids` TEXT — IDs de jeux similaires (JSON)

---

## G. Mesures réelles Supabase (2026-04-07)

Ces chiffres sont issus de requêtes directes sur la base Supabase prod.

### G1. Volume catalogue

| Métrique | Valeur |
|----------|--------|
| Total jeux dans `games` | **1 517** |
| Jeux publiés (curation_states) | **351** |
| Gap vers objectif 4 000 | **−2 483 jeux minimum** (catalogue à créer) |

### G2. Couverture gates identity

| Condition | Jeux concernés | % |
|-----------|---------------|---|
| `cover_url` absent | 128 / 1 517 | 8% |
| `cover_url` présent | 1 389 / 1 517 | **92%** |
| Pas de summary NI synopsis ≥70 car | 866 / 1 517 | **57% bloqués** |
| `developer` absent | 283 / 1 517 | 19% |
| Passing all 3 gates (cover + editorial + developer) | **544 / 1 517** | **36%** |

### G3. Couverture champs éditoriaux

| Champ | Jeux couverts | % |
|-------|--------------|---|
| `summary` ≥70 car | 561 / 1 517 | 37% |
| `synopsis` ≥70 car | 178 / 1 517 | 12% |
| `lore` présent | 1 418 / 1 517 | **93%** |
| `ost_composers` (inline JSON) | 1 249 / 1 517 | **82%** |
| `avg_duration_main` (HLTB) | 1 171 / 1 517 | **77%** |
| `ost_tracks` (table ost_tracks) | ~62 jeux | 4% |
| `ost_releases` (table ost_releases) | **0** | 0% |
| Profils compétitifs | ~10 | <1% |

### G4. Quality records (back-office scoring, système séparé du scoring.js premium)

| Tier | Jeux | Note |
|------|------|------|
| Tier A | 1 005 | système Tier A/B/C ≠ gold/silver/bronze |
| Tier B | 251 | |
| Tier C | 235 | |
| Score moyen | **93 / 100** | basé sur completeness_score quality_records |
| Score min | 68 / 100 | |

**Important :** le système `quality_records` (Tier A/B/C) est distinct du système `scoring.js` premium (gold/silver/bronze ≥55). Ce sont deux évaluations parallèles back-office uniquement.

### G5. Autres tables Supabase confirmées

| Table | Lignes | Note |
|-------|--------|------|
| `franchise_entries` | 15 | game_ids JSONB, 104 jeux liés |
| `consoles` | 25 | id, title, platform, year, manufacturer, media_type |
| `game_companies` | **absent** | table manquante en Supabase prod |
| `retrodex_index` | **absent** | table inexistante en Supabase prod |

### G6. Top 10 consoles par nombre de jeux

| Console | Jeux |
|---------|------|
| PlayStation | 191 |
| Super Nintendo | 185 |
| Sega Genesis | 176 |
| Nintendo 64 | 151 |
| Game Boy | 141 |
| Sega Saturn | 119 |
| NES | 92 |
| Game Boy Advance | 91 |
| Nintendo DS | 74 |
| Game Boy Color | 64 |
