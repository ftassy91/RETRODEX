# RetroDex — Score de match marché (Phase 1)

**Référence :** `origin/main` @ `b4f3a2e` (2026-04-06)
**Date :** 2026-04-07
**Périmètre :** score léger pour évaluer si une observation brute peut être rattachée à une fiche avec confiance.
Pas de moteur de pricing. Pas d'ingestion multi-source.

---

## Objectif du score de match marché

Répondre à la question :

> "Cette observation de prix brute (PriceCharting, future eBay) peut-elle être
> rattachée proprement à cette fiche / cette variante de cette fiche ?"

Le score de match n'est pas un prix. C'est une **confiance de rattachement**.

---

## Dimensions de match disponibles (fondées sur les champs réels)

### Dimension 1 — Identité du jeu (match fiche)

| Signal | Table / champ | Disponibilité |
|--------|--------------|---------------|
| Titre normalisé | games.title | plein |
| Plateforme | games.console | plein |
| Année | games.year | plein |
| Slug | games.slug | plein |
| Barcode | games.barcode | faible |

Un match fort nécessite au minimum : titre + plateforme.
Un match parfait : titre + plateforme + année.

### Dimension 2 — Variante (condition)

| Signal | Table / champ | Disponibilité |
|--------|--------------|---------------|
| Condition (loose/cib/mint) | price_history.condition | partiel |
| Condition (loose/cib/mint) | price_observations.condition | partiel |

La normalisation de condition est déjà dans `backfill_price_summary.js` : lowercase loose/cib/mint.

### Dimension 3 — Source connue

| Signal | Table / champ | Disponibilité |
|--------|--------------|---------------|
| Nom de la source | price_history.source | partiel |
| Sources lisibles | games.source_names | partiel |

Sources actuellement ingérées : PriceCharting. eBay à venir.

---

## Score de match minimal (Phase 1)

Trois niveaux, fondés uniquement sur les champs réels disponibles :

### Niveau `confirmed`
- Titre exact match (normalisé) + plateforme match + condition présente
- Source connue (PriceCharting)
- `price_last_updated` < 90 jours

### Niveau `probable`
- Titre match (avec tolérance fuzzy légère) + plateforme match
- Condition présente
- Source connue

### Niveau `uncertain`
- Titre match partiel OU plateforme manquante
- OU source inconnue
- OU condition absente

---

## Règle d'affichage dérivée

| Niveau match | Affichage recommandé |
|--------------|----------------------|
| `confirmed` | prix affiché avec confidence `high` ou `medium` |
| `probable` | prix affiché avec confidence `low`, mention "estimation" |
| `uncertain` | prix masqué ou affiché avec avertissement visible |
| absent | bloc prix masqué |

Cette règle est alignée avec `priceConfidenceTier` déjà dans `renderGameRow.js`.

---

## Ce que le score de match NE fait PAS en Phase 1

- Il ne dé-duplique pas les observations brutes entre sources
- Il ne gère pas les éditions régionales (cela nécessite `releases`)
- Il ne calcule pas un prix fair value
- Il ne fait pas de ML / embedding sur les titres
- Il ne gère pas eBay (pas encore ingéré)

---

## Préparation pour le score de match v2 (post-Phase 1)

Quand eBay sera ingéré dans `price_history`, le score v2 nécessitera :

1. **N = 3 observations eBay** (déjà validé dans DECISIONS.md comme seuil `price_status v2`)
2. Distinction `pricecharting` (estimation) vs `ebay` (vente réelle) dans le rattachement
3. `price_summary.confidence_score` comme signal de confiance agrégé (déjà dans le schéma)

Ces éléments sont préparés par les tables existantes. Aucune nouvelle table n'est nécessaire.

---

## Implémentation minimale suggérée (si justifiée)

Si un score de match doit être calculé programmatiquement, la fonction minimale est :

```javascript
function computeMarketMatchLevel(observation, game) {
  const titleMatch = normalizeTitle(observation.title) === normalizeTitle(game.title)
  const platformMatch = normalizePlatform(observation.platform) === normalizePlatform(game.console)
  const conditionPresent = ['loose', 'cib', 'mint'].includes(String(observation.condition || '').toLowerCase())
  const sourceKnown = Boolean(observation.source)

  if (titleMatch && platformMatch && conditionPresent && sourceKnown) return 'confirmed'
  if (titleMatch && platformMatch) return 'probable'
  return 'uncertain'
}
```

Cette fonction n'existe pas encore dans le repo. Elle serait additive et sans dette structurelle.
Elle n'est à créer que si un cas d'usage concret la justifie.
