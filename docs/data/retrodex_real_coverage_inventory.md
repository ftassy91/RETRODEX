# RetroDex — Inventaire de couverture réelle

**Référence :** `origin/main` @ `b4f3a2e` (2026-04-06)
**Date :** 2026-04-07
**Note :** les états de remplissage sont fondés sur des mesures directes en Supabase prod (2026-04-07)
sauf mention [estimé]. Total catalogue prod : **1 517 jeux**.

---

## Légende

- **Requis canonique** : nécessaire pour atteindre le standard minimum de fiche complète
- **Visible produit** : exposé côté UI publique
- **État** :
  - `plein` — champ systématiquement rempli selon les scripts et les données connues
  - `partiel` — rempli sur une fraction significative des jeux
  - `faible` — rempli sur peu de jeux ou enrichissement en cours
  - `inconnu` — pas de signal clair de remplissage sans accès prod

---

## Bloc Identité

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| id | games | Identifiant unique | oui | non | catalogue initial | plein |
| title | games | Titre du jeu | oui | oui | catalogue initial | plein |
| console | games | Plateforme (string) | oui | oui | catalogue initial | plein |
| year | games | Année de sortie | oui | oui | catalogue initial | plein |
| releaseDate | games | Date précise | non | non | IGDB, enrichissement | faible |
| genre | games | Genre | oui | oui | IGDB, MobyGames | partiel |
| developer | games | Studio (string) | oui | oui | IGDB, MobyGames | partiel |
| rarity | games | Rareté | oui | oui | catalogue initial | partiel |
| slug | games | URL friendly | oui | oui | auto-généré | plein |
| metascore | games | Score critique | non | oui | IGDB, Metacritic | faible |
| type | games | Type d'entité | oui | non | auto | plein |
| source_confidence | games | Fiabilité source | non | non | auto | partiel |

---

## Bloc Cover / Médias de référence

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| cover_url | games | Image de couverture | oui | oui | IGDB, ScreenScraper | **partiel — 1 389/1 517 (92%)** |
| coverImage | games | Alias JS de cover_url | — | oui | normalizeCoverFields (mémoire) | **pas une colonne Supabase** |
| manual_url | games | PDF manuel | non | oui | archive.org | faible |
| youtube_id | games | Vidéo YouTube | non | oui | enrichissement manuel | faible |
| youtube_verified | games | Vidéo validée | non | oui | enrichissement manuel | faible |
| archive_id | games | ID archive.org | non | oui | ScreenScraper, manuel | faible |
| archive_verified | games | Archive validée | non | oui | enrichissement manuel | faible |
| (media_references) | media_references | Couverture structurée | non | oui | enrichissement lots | partiel |

---

## Bloc Editorial

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| summary | games / game_editorial | Résumé court (≥70 car) | oui | oui | G2 summary batches | **partiel — 561/1 517 (37%)** |
| synopsis | games / game_editorial | Résumé long (≥70 car) | oui | oui | G2 summary batches | **faible — 178/1 517 (12%)** |
| lore | games / game_editorial | Contexte narratif (≥80 car) | non | oui | richness batches | **fort — 1 418/1 517 (93%)** |
| gameplay_description | games / game_editorial | Description gameplay | non | oui | G2, richness | faible [estimé] |
| characters | games / game_editorial | Personnages (JSON) | non | oui | wikidata, richness | faible [estimé] |
| dev_anecdotes | games / game_editorial | Anecdotes dev | non | oui | richness batches | faible [estimé] |
| versions | games / game_editorial | Variantes/régions | non | oui | wikidata | faible [estimé] |
| cheat_codes | games / game_editorial | Codes de triche | non | oui | StrategyWiki batches | faible [estimé] |
| avg_duration_main | games / game_editorial | Durée principale (HLTB) | non | oui | HLTB | **fort — 1 171/1 517 (77%)** |
| avg_duration_complete | games / game_editorial | Durée complète (HLTB) | non | oui | HLTB | partiel [estimé] |
| speedrun_wr | games / game_editorial | World record speedrun | non | oui | competitive batches | faible [estimé] |
| tagline | games | Accroche | non | non | inconnu | inconnu |

---

## Bloc Crédits

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| (developer role) | game_companies | Studio de développement | oui | oui | G3 batches | **absent Supabase — table inexistante en prod** |
| (publisher role) | game_companies | Éditeur | non | oui | G3 batches | **absent Supabase** |
| (director role) | game_people | Directeur | non | oui | G3 batches | faible [estimé] |
| (composer role) | game_people | Compositeur | non | oui | G4 batches (24) | **fort — 1 249/1 517 (82%) via ost_composers inline** |
| (programmer role) | game_people | Programmeur | non | oui | G3 batches | faible [estimé] |
| (designer role) | game_people | Designer | non | oui | G3 batches | faible [estimé] |
| (producer role) | game_people | Producteur | non | oui | G3 batches | faible [estimé] |
| dev_team | games | Dev team inline (JSON, fallback) | non | oui | G3 batches | partiel [estimé] |
| developer | games | Studio string (gate identity) | oui | oui | catalogue initial | **partiel — 1 234/1 517 (81%)** |
| (game_credits) | game_credits | Crédits unifiés (non lus) | — | non | backfill_game_credits | **non en Supabase (Phase 1 non migrée)** |

---

## Bloc Musique / OST

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| (ost rows) | ost | Albums OST | non | oui | G4 batches, MusicBrainz | faible [estimé] |
| (ost_tracks rows) | ost_tracks | Pistes individuelles | non | oui | G4 batches, MusicBrainz | **faible — ~62 jeux (4%)** |
| (ost_releases rows) | ost_releases | Éditions physiques | non | oui | MusicBrainz | **vide — 0 entrées en prod** |
| ost_composers | games | Compositeurs inline (JSON, fallback) | non | oui | G4 batches | **fort — 1 249/1 517 (82%)** |
| ost_notable_tracks | games | Pistes notables inline (fallback) | non | oui | G4 batches | faible [estimé] |

---

## Bloc Compétitif

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| (competitive profile) | game_competitive_profiles | Profil speedrun/score/achievement | non | oui | competitive batches | **très faible — ~10 jeux (<1%)** |
| (record entries) | game_record_entries | Records WR/leaderboard | non | oui | speedrun.com, RA | très faible [estimé] |
| (achievement profile) | game_achievement_profiles | Profil RetroAchievements | non | oui | RA batches | très faible [estimé] |

---

## Bloc Prix / Marché

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| loose_price | games | Prix loose (inline) | non | oui | PriceCharting | partiel |
| cib_price | games | Prix CIB (inline) | non | oui | PriceCharting | partiel |
| mint_price | games | Prix Mint (inline) | non | oui | PriceCharting | partiel |
| price_last_updated | games | Date MAJ prix | non | oui | migration 012 backfill | partiel |
| source_names | games | Attribution sources lisible | non | oui | migration 012 backfill | partiel |
| (price_history rows) | price_history | Historique prix | non | oui | PriceCharting | partiel |
| (price_summary) | price_summary | Agrégats P25/P50/P75 (non lu) | — | non | backfill_price_summary | inconnu |

---

## Bloc Statuts / Curation

| Champ | Table | Rôle métier | Requis canonique | Visible produit | Source connue | État |
|-------|-------|-------------|------------------|-----------------|---------------|------|
| editorial_status | games | Statut éditorial Phase 3 | non | non | phase3 v1 backfill | partiel |
| media_status | games | Statut médias Phase 3 | non | non | phase3 v1 backfill | partiel |
| price_status | games | Statut prix Phase 3 | non | non | phase3 v1 backfill | partiel |
| (curation_states) | game_curation_states | Lifecycle publication | non | non | admin/enrichment | partiel |
| (content_profiles) | game_content_profiles | Profil enrichissement | non | non | admin/enrichment | partiel |
| (quality_records) | quality_records | Score qualité back-office | non | non | admin/enrichment | faible |

---

## Synthèse par bloc (mesures réelles Supabase)

| Bloc | Champs requis canoniques | État global | Mesure réelle |
|------|--------------------------|-------------|---------------|
| Identité | id, title, console, year, genre, developer, rarity, slug | **partiel** | developer absent sur 283 jeux (19%) |
| Cover | cover_url | **fort** | 1 389/1 517 (92%) avec cover_url |
| Editorial | summary ou synopsis ≥70 | **critique** | **866/1 517 (57%) sans aucun editorial seed valide** |
| Crédits (gate) | developer string | **fort** | 1 234/1 517 (81%) avec developer |
| Crédits (société) | game_companies | **absent prod** | table inexistante en Supabase |
| Musique inline | ost_composers | **fort** | 1 249/1 517 (82%) |
| Musique structurée | ost_tracks | **faible** | ~62 jeux (4%), ost_releases = 0 |
| Compétitif | — (non requis seuil minimal) | **très faible** | ~10 jeux (<1%) |
| Prix | — (non requis seuil minimal) | partiel [estimé] | PriceCharting couvert, eBay absent |

**Gates identity passées (tous 3 : cover + editorial + developer) : 544/1 517 (36%)**

**Gap principal avant cap 4000 : catalogue insuffisant (1 517 vs 4 000) + 57% des jeux sans editorial seed**
