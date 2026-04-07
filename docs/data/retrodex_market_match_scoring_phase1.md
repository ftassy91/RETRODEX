# Scoring de match marché — Phase 1

**Date :** 2026-04-07

---

## Contexte

Ce document définit un scoring de match marché léger, fondé exclusivement sur les champs marché réels présents dans le schéma. Objectif: identifier rapidement si une fiche est "viable marché" pour RetroMarket.

---

## Principe

Le scoring marché n'est PAS un score de qualité éditoriale. C'est un score de **fiabilité et fraîcheur des données de prix**. Il est indépendant du scoring de complétude existant.

---

## Champs disponibles pour le scoring marché

| Champ | Table | Disponibilité |
|-------|-------|--------------|
| `loose_price` | games | ~700 fiches |
| `cib_price` | games | ~700 fiches |
| `mint_price` | games | partiel |
| `price_last_updated` | games | ~700 fiches |
| `source_names` | games | ~700 fiches |
| `rarity` | games | partiel |
| `price_history` rows | price_history | 136 895 lignes total |
| `price_summary.trend_90d` | price_summary | créé, non lu |

---

## Scoring de match marché (0-100)

### Composantes

| Composante | Points | Condition |
|------------|--------|-----------|
| Prix loose disponible | 25 | `loose_price IS NOT NULL` |
| Prix CIB disponible | 15 | `cib_price IS NOT NULL` |
| Prix mint disponible | 10 | `mint_price IS NOT NULL` |
| Données fraîches | 20 | `price_last_updated` < 30 jours |
| Source documentée | 10 | `source_names` non vide, ≥ 1 source |
| ≥ 3 observations price_history | 15 | COUNT observations > 2 |
| Rarity défini | 5 | `rarity IS NOT NULL` |

**Total : 100 points**

### Tiers marché

| Tier | Seuil | Signification |
|------|-------|---------------|
| Hot | ≥ 75 | Prix complets, frais, multi-sources |
| Active | 50-74 | Prix partiels ou données < 60 jours |
| Stale | 25-49 | Prix présents mais anciens |
| Missing | < 25 | Données marché insuffisantes |

---

## État actuel estimé

- Fiches Hot : ~200-300 (games avec prix complets et récents)
- Fiches Active : ~400-500
- Fiches Stale : ~200
- Fiches Missing : ~600+ (pas de données prix)

---

## Évolution vers price_summary

Quand `price_summary` sera activé dans le runtime public, remplacer les composantes inline par :

- `p50 (loose) disponible` → 25 pts
- `p50 (cib) disponible` → 15 pts
- `trend_90d disponible` → 20 pts (remplace "données fraîches")
- `confidence_score ≥ 0.7` → 15 pts (remplace observations count)

---

## Implémentation recommandée

Ce scoring peut être calculé dans `coverage-service.js` comme nouveau bloc optionnel, sans interférer avec le scoring de complétude existant. Il peut aussi être exposé dans l'API admin comme `market_score`.
