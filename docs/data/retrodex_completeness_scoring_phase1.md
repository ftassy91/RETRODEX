# Scoring de complétude fiche — Alignement Phase 1

**Date :** 2026-04-07

---

## Contexte

RetroDex dispose d'un système de scoring premium existant (`scoring.js` / `rules.js` / `coverage-loaders.js`). Ce document documente ce système et propose l'alignement avec le standard minimum réaliste Phase 1. **Ne pas recréer ce système — le référencer et l'aligner.**

---

## Système existant (confirmé)

### Fichiers

- `backend/src/services/admin/enrichment/scoring.js`
- `backend/src/services/admin/enrichment/rules.js`
- `backend/src/services/admin/enrichment/coverage-loaders.js`
- CLI: `backend/scripts/enrichment/recompute-enrichment-coverage.js`

### 5 blocs pondérés

| Bloc | Poids | Ce qu'il mesure |
|------|-------|-----------------|
| identity | 25% | title, console, year, cover, slug, developer, release date |
| editorial | 25% | summary, synopsis, lore, gameplay_description, characters |
| credits | 20% | game_people (directors, producers, composers), game_companies |
| media | 20% | media_references (covers, manuals, maps, sprites) |
| music | 10% | ost_composers, ost_notable_tracks, ost table |

### Tiers de scoring

| Tier | Seuil | Usage |
|------|-------|-------|
| Gold | ≥ 85 | Fiche référence |
| Silver | ≥ 70 | Fiche enrichie |
| Bronze | ≥ 55 | Fiche acceptable |
| Top100 candidate | publishable + score ≥ 60 | Sélection éditoriale |

### Gates isPublishable (6 signaux bloquants)

| Signal | Condition | État actuel |
|--------|-----------|-------------|
| title | Présent | 100% ✅ |
| console | Présent | 100% ✅ |
| release | year présent | 100% ✅ |
| cover | cover_url OU coverImage | 98% ✅ |
| editorial_seed | summary ≥20 chars OU synopsis ≥70 chars | 100% ✅ |
| studio_seed | developer OU publisherId OU game_companies | ~99% ✅ |

### Gates editorial_richness (gate de richesse)

Condition: `presentCount >= 2 AND (signals.summary OR signals.synopsis)`
Où `EDITORIAL_KEYS = ['summary', 'synopsis', 'lore', 'characters']`
État actuel: ~95% des jeux satisfont ce gate.

---

## Alignement avec le standard minimum Phase 1

Le scoring existant est **compatible** avec le standard minimum défini dans `retrodex_complete_fiche_standard_phase1.md`.

### Correspondance

| Standard minimum | Scoring système | Bloc | Poids partiel |
|-----------------|-----------------|------|---------------|
| title + console + year + slug | identity signals | identity | 25% |
| cover | cover signal | identity | ~5% |
| summary / synopsis | editorial seed | editorial | ~10% |
| lore | lore signal | editorial | ~5% |
| studio credit | developer/companies | identity + credits | ~10% |

### Lacunes du scoring vs standard réel

1. **ost_composers individuels vs compagnies** : le bloc music ne distingue pas un nom de compagnie d'un compositeur individuel. Un jeu avec `[{"name":"Nintendo"}]` score autant qu'un jeu avec `[{"name":"Koji Kondo"}]`.
2. **dev_team JSON qualité** : le bloc credits ne distingue pas `[{"name":"Capcom"}]` de `[{"name":"Keiji Inafune"}]`.
3. **versions = 0** : le champ versions est à 0% mais n'a pas de pénalité dans les règles actuelles.
4. **characters genre-dépendant** : un jeu de racing sans personnages est pénalisé inutilement dans le bloc editorial.

---

## Recommandations d'alignement (sans modifier le scoring existant)

1. **Court terme** : ajouter un flag `individual_composers_present` dans `coverage-loaders.js` (booléen: au moins 1 nom dans `ost_composers` n'est pas une compagnie). Cela permettrait une distinction sans changer les poids.

2. **Court terme** : même chose pour dev_team — flag `individual_team_present`.

3. **Moyen terme** : ajouter une exclusion genre (racing, puzzle, sports) pour le signal `characters_present` dans les règles.

4. **Ne pas toucher** aux poids ni aux tiers actuels — ils sont calibrés et fonctionnels.
