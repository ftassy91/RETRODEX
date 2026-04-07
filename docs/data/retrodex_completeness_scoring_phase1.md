# RetroDex — Score de complétude (Phase 1)

**Référence :** `origin/main` @ `b4f3a2e` (2026-04-06)
**Date :** 2026-04-07

---

## Principe

Le système de scoring premium **existe déjà** dans le repo.
Ce document ne le recrée pas. Il le documente, l'aligne avec le standard de fiche complète Phase 1,
et indique comment l'utiliser pour piloter le cap des 4000.

---

## Système existant — Référence

| Fichier | Rôle |
|---------|------|
| `backend/src/services/admin/enrichment/rules.js` | Constantes : blocs, poids, clés, seuils |
| `backend/src/services/admin/enrichment/scoring.js` | Calcul du score par fiche |
| `backend/src/services/admin/enrichment/coverage-loaders.js` | Lecture des données nécessaires au scoring |
| `backend/src/services/admin/enrichment/coverage-service.js` | Orchestration du calcul de couverture |
| `backend/scripts/enrichment/recompute-enrichment-coverage.js` | CLI read-only de prévisualisation |

---

## Structure du score (confirmé dans rules.js / scoring.js)

### Blocs et pondération

| Bloc | Poids | Clés évaluées |
|------|-------|---------------|
| identity | 25% | title, console, release, cover, editorial_seed, studio_seed |
| editorial | 25% | summary, synopsis, lore, characters |
| credits | 20% | developer, publisher, distributor, soundtrack_label, director, composer, writer, producer, designer, programmer |
| media | 20% | manual, map, sprite_sheet, ending, archive_item, youtube_video, screenshot, scan |
| music | 10% | composers, tracks |

### Tiers (confirmés dans TIER_THRESHOLDS)

| Tier | Seuil | Critères additionnels |
|------|-------|----------------------|
| `gold` | ≥85 | gate identity + editorial ≥3 présents + credits ≥3 + media ≥3 + music ≥1 |
| `silver` | ≥70 | isPublishable |
| `bronze` | ≥55 | isPublishable |
| `none` | <55 ou non publishable | — |

### Candidat top100
- isPublishable = true
- completenessScore ≥60
- ET (credits ≥2 OU media ≥2 OU music ≥1)

---

## Alignement avec le standard minimum Phase 1

Le standard minimum réaliste (fiche complète pour le cap 4000) correspond à :
- `isPublishable = true` → gate identity passé (tous CORE_IDENTITY_KEYS présents)
- `completenessScore ≥ 55` → tier bronze minimum

Le score existant couvre exactement cette mesure. Aucun nouveau score n'est nécessaire.

---

## Filtre C2 (déjà implémenté côté UI — origin/main)

Le filtre archive density est déjà dans le produit :

| Niveau | Score approximatif | Description |
|--------|--------------------|-------------|
| `dense` | ≥85 (gold) | fiche très complète |
| `solid` | ≥70 (silver) | fiche complète |
| `growing` | ≥55 (bronze) | fiche en développement |
| `light` | <55 | fiche incomplète |

Ce filtre est déjà exposé à l'utilisateur dans `games-list.html`.
Il matérialise exactement les tiers existants du scoring premium.

---

## Comment utiliser le score pour piloter le cap 4000

### Mesure actuelle (à faire, nécessite accès prod)

Requête de référence à exécuter sur Supabase ou via le CLI :
```bash
node backend/scripts/enrichment/recompute-enrichment-coverage.js --candidate-limit=5000
```

Produit un JSON avec :
- `summary.totalGames`
- `summary.publishableCount` (isPublishable = true)
- `summary.tierCounts.bronze` / `.silver` / `.gold`
- `topCandidates` : fiches les plus proches du seuil

### Objectif cap 4000

Pour atteindre 4000 fiches `bronze` minimum :
1. Identifier les fiches avec `missingCoreRequirements` non vide → prioriser l'enrichissement sur ces champs manquants
2. Pour chaque fiche : le champ `missingDomainSignals` liste exactement ce qu'il faut remplir en priorité

### Priorité d'enrichissement dérivée du score

| Signal manquant fréquent | Action d'enrichissement |
|--------------------------|------------------------|
| `cover` | relancer IGDB / ScreenScraper cover fetch |
| `editorial_seed` (summary absent) | G2 summary batch sur fiches manquantes |
| `studio_seed` (developer absent) | G3 dev team batch + game_companies |
| `editorial.synopsis` | G2 batch ciblé |
| `credits.composer` | G4 batch ciblé |
| `media.manual` / `media.archive_item` | lots médias ciblés |

---

## Scores secondaires (déjà dans quality_records, usage back-office)

| Score | Table | Usage |
|-------|-------|-------|
| `confidence_score` | quality_records | fiabilité de la source |
| `source_coverage_score` | quality_records | diversité des sources |
| `freshness_score` | quality_records | fraîcheur des données |
| `overall_score` | quality_records | score global agrégé |

Ces scores existent dans `quality_records` mais ne sont pas raccordés au scoring premium actif.
Ils sont back-office uniquement. **Ne pas dupliquer.**

---

## Ce qui n'est PAS nécessaire en Phase 1

- Un nouveau système de scoring : le système existant est suffisant
- Un dashboard de pilotage graphique : le CLI produit déjà le JSON nécessaire
- Un score public exposé à l'utilisateur : le filtre C2 (archive density) remplit ce rôle
- Un score de marché dans le completeness score : la couverture marché est séparée
