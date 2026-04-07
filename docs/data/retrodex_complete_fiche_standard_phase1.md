# RetroDex — Définition de la fiche complète (Phase 1)

**Référence :** `origin/main` @ `b4f3a2e` (2026-04-06)
**Date :** 2026-04-07
**Avertissement :** cette définition est dérivée de l'état réel observé dans le repo.
Elle n'est pas un idéal abstrait. Elle est conçue pour être mesurable et atteignable.

---

## Principe de construction

La définition est fondée sur :
1. ce que l'API expose réellement (`buildArchivePayload`, `toItemPayload`)
2. ce que les scripts d'enrichissement peuvent raisonnablement remplir
3. ce que le système de scoring premium existant (`scoring.js` / `rules.js`) évalue déjà

Elle s'aligne avec le scoring existant, sans le redéfinir.

---

## Standard minimum réaliste — Phase 1

C'est la définition opérationnelle pour valider qu'une fiche peut compter dans le cap des 4000.

### Champs obligatoires (bloquants — gate)

Ces champs doivent être présents et non vides :

| Champ | Source | Table / chemin |
|-------|--------|---------------|
| `id` | catalogue initial | games |
| `title` | catalogue initial | games |
| `console` | catalogue initial | games |
| `year` | catalogue initial | games |
| `cover_url` ou `coverImage` non vide | IGDB / ScreenScraper | games ou media_references |
| `summary` ou `synopsis` (≥70 caractères) | G2 batches | games ou game_editorial |
| `developer` (string) ou au moins 1 entrée dans game_companies rôle developer | G3 batches | games + game_companies |

Ces 7 critères correspondent au **gate identity** du système de scoring existant (`evaluateIdentityBlock` dans `scoring.js`) étendu à `editorial_seed` et `studio_seed`.

### Champs fortement recommandés (impact score fort)

Ces champs ne bloquent pas le seuil mais font passer la fiche de `growing` à `solid` :

| Champ | Impact scoring | Source probable |
|-------|---------------|-----------------|
| `genre` | identité | IGDB, MobyGames |
| `rarity` | identité | catalogue |
| `synopsis` long (≥120 caractères) | editorial | G2 batches |
| au moins 1 composer dans `game_people` ou `ost_composers` | music | G4 batches |
| au moins 1 entrée `media_references` (manual, map, ou archive_item) | media | lots médias |
| `price_history` : au moins 1 observation | marché | PriceCharting |

### Champs bonus (enrichissement éditorial non bloquant)

| Champ | Valeur éditoriale |
|-------|-------------------|
| `lore` (≥80 caractères) | contexte narratif |
| `characters` (≥1 entrée) | encyclopédie |
| `dev_anecdotes` | profondeur |
| `cheat_codes` | utilité pratique |
| `versions` | archive régionale |
| `avg_duration_main` (HLTB) | contexte lecture |
| records/speedrun (≥1 entrée) | compétitif |
| `game_achievement_profiles` | compétitif |

---

## Traduction en score existant

Le système `scoring.js` calcule déjà un `completenessScore` sur 5 blocs pondérés.

Une fiche satisfaisant le **standard minimum réaliste** ci-dessus correspond à :
- `isPublishable = true` (gate identity passé : tous les CORE_IDENTITY_KEYS présents)
- `completenessScore ≥ 55` (tier bronze minimum)

Une fiche **fortement recommandée** correspond à :
- `completenessScore ≥ 60` (candidat top100)
- `editorial.richEnough = true` (summary + au moins un autre champ éditorial)

Ces seuils sont déjà codifiés dans `TIER_THRESHOLDS` de `rules.js`. Ils n'ont pas à être redéfinis.

---

## Ce que signifie "4000 fiches canoniques"

4000 fiches comptent dans l'objectif si :
- `isPublishable = true`
- `completenessScore ≥ 55`

L'objectif "4000 fiches solides" montée de gamme serait :
- `completenessScore ≥ 70` (silver)
- au moins cover + summary/synopsis + developer/company confirmé

---

## Standard cible étendu — Post-consolidation

Ce standard n'est pas requis pour le cap 4000 mais définit l'ambition documentaire à terme.

### Identité complète
- `consoleId` effectivement renseigné (après transition string→FK)
- `developerId` + `publisherId` effectivement renseignés
- `releaseDate` précise (et non juste `year`)
- Releases régionales dans `releases`

### Editorial riche
- `summary` + `synopsis` (deux champs distincts non vides)
- `lore` substantiel
- `gameplay_description` substantiel
- `characters` structurés (≥3 entrées)
- `versions` documentées
- `dev_anecdotes` (≥1 anecdote)

### Crédits complets
- Developer + publisher + au moins 2 rôles individuels (director, composer, designer)
- Données dans `game_credits` (Phase 1 normalized) opérationnel

### Musique tracée
- `ost` + au moins 3 `ost_tracks` + 1 `ost_releases`
- Compositeurs dans `game_people` (rôle composer)
- Données dans `game_ost` + `game_ost_tracks` (Phase 1 normalized) opérationnel

### Médias complets
- Cover validée (`ui_allowed = true`)
- Manual (archive.org)
- Au moins 1 parmi : map, sprite_sheet, ending, archive_item
- `youtube_id` vérifié

### Marché tracé
- `price_history` avec ≥5 observations
- `price_summary` opérationnel (P25/P50/P75)
- `price_status` renseigné

### Compétitif (si pertinent)
- `game_competitive_profiles.speedrun_relevant` = true + au moins 1 record entry
- Ou `game_achievement_profiles` renseigné

---

## Note sur la dualité de structure éditoriale

Pendant la phase 1, `game_editorial` est canonique si présent, `games.*` est fallback.
Le standard minimum fonctionne dans les deux cas (les deux chemins sont couverts par `buildArchivePayload`).
À terme, `game_editorial` devrait être la source unique pour les champs éditoriaux.
