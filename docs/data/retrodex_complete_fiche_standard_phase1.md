# Standard de complétude fiche canonique — Phase 1

**Référence :** `origin/main` @ 2026-04-07
**Périmètre :** 1491 jeux actuels — objectif 4000 fiches canoniques

---

## Contexte

RetroDex vise 4000 fiches canoniques complètes. Ce document définit le standard réaliste mesurable à partir des champs réellement présents dans le repo (base: origin/main @ 2026-04-07), pour 1491 jeux actuels.

---

## Standard minimum réaliste — Phase 1

Une fiche est considérée **canonique minimale** si elle satisfait tous les critères suivants.

### Identité (obligatoire)

- `title` présent
- `console` présent
- `year` présent
- `slug` unique et valide
- `cover_url` OU `coverImage` présent

### Signal éditorial (obligatoire)

- `summary` (≥ 20 chars) OU `synopsis` (≥ 70 chars) — au moins l'un des deux
- `lore` (≥ 50 chars) — contexte narratif minimum

### Crédit studio (obligatoire)

- `developer` OU entrée `game_companies` avec rôle developer/publisher

### État actuel vs standard minimum

| Critère | Actuel | Commentaire |
|---------|--------|-------------|
| Identité complète | 98% (cover) | 24 jeux sans cover — JP-only obscurs |
| Editorial seed | 100% | Complet |
| Lore | 95% | 73 manquants = tous obscurs, 0 métascore |
| Studio credit | ~99% | 5 vrais trous comblés, 123 via game_companies |

**Fiches satisfaisant le standard minimum : ~1418 / 1491 (95%)**

---

## Critères de qualité recommandés (non bloquants)

- `gameplay_description` (≥ 50 chars) — 95% couvert
- `characters` — 79% couvert (genre-dépendant : racing/puzzle sans personnages OK)
- `ost_composers` avec noms individuels — 84% couvert
- `genre` — partiel

---

## Standard cible étendu — Post-consolidation (objectif 4000 fiches)

### Niveau Silver (fiche enrichie)

Tout le minimum +

- `characters` avec au minimum 1-3 entrées structurées (nom + rôle)
- `ost_composers` avec noms individuels (pas noms de compagnies)
- `ost_notable_tracks` avec 3-5 pistes
- `game_people` : au moins 1 entrée director ou producer
- `dev_team` JSON avec noms individuels (pas studio seul)
- `tagline` (si applicable)

### Niveau Gold (fiche référence)

Tout le Silver +

- `dev_anecdotes` (au moins 1 entrée)
- `cheat_codes` (si applicable)
- `avg_duration_main` (source HLTB)
- `speedrun_wr` (si communauté active)
- `youtube_id` (gameplay vidéo)
- `versions` (variantes régionales documentées)
- `price_history` active (≥ 3 observations)

### Réalisme des niveaux cibles

| Niveau | Fiches actuelles | Effort restant |
|--------|-----------------|----------------|
| Minimum (95%) | ~1418 / 1491 | Fermer 73 lore vides (obscurs) |
| Silver | ~350 / 1491 | Enrichissement individuel par fiche |
| Gold | ~50 / 1491 | Données externes (HLTB, speedrun.com, YouTube) |

---

## Note sur les genres sans personnages

Les jeux de type racing (Gran Turismo, Daytona USA), puzzle (Tetris, Columns), sport (Power Golf) n'ont pas de personnages narratifs. Le champ `characters` vide pour ces jeux n'est **pas un manque** — c'est le comportement correct. Le standard minimum ne doit pas l'exiger pour ces genres.
