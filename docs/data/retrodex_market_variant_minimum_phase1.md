# RetroDex — Variante marché minimale (Phase 1)

**Référence :** `origin/main` @ `b4f3a2e` (2026-04-06)
**Date :** 2026-04-07
**Avertissement :** pas de moteur de pricing. Pas d'architecture multi-source. Minimal et fondé sur les champs réels.

---

## Principe

La "variante marché" n'est pas une fiche différente.
C'est la qualification minimale qui permet de dire :

> cette fiche a suffisamment de signal marché pour être affichée avec crédibilité dans RetroMarket.

Elle ne prétend pas calculer un prix juste. Elle sert à :
- décider si le bloc prix est affiché ou masqué
- décider du niveau de confiance à afficher
- préparer le futur moteur sans l'industrialiser

---

## Champs disponibles réellement (confirmés dans le repo)

| Champ | Table | État |
|-------|-------|------|
| `loose_price` | games | partiel |
| `cib_price` | games | partiel |
| `mint_price` | games | partiel |
| `price_last_updated` | games | partiel (backfill 012) |
| `source_names` | games | partiel (backfill 012) |
| `price_history` rows | price_history | partiel |
| `price_summary` (P25/P50/P75) | price_summary | inconnu (non lue) |
| `price_status` (v1) | games | partiel (phase3 backfill) |
| `rarity` | games | partiel |

---

## Variante marché minimale — Phase 1

Une fiche a une **variante marché minimale valide** si elle satisfait les conditions suivantes :

### Condition 1 — Prix disponible
Au moins un prix non nul parmi : `loose_price`, `cib_price`, `mint_price`

### Condition 2 — Date de fraîcheur acceptable
`price_last_updated` présent ET inférieur à 180 jours

Si `price_last_updated` est absent, la condition passe en mode dégradé ("prix disponible, date inconnue").

### Condition 3 — Source traçable
`source_names` non vide (ex : "PriceCharting")

---

## Niveaux de confiance affichables (fondés sur les champs réels)

Ces niveaux sont déjà partiellement codifiés côté UI (`priceConfidenceTier` dans `renderGameRow`) :

| Niveau | Critères | Affichage suggéré |
|--------|----------|-------------------|
| **high** | ≥10 observations `price_history`, `price_last_updated` < 90 jours | prix + date + badge confiance |
| **medium** | ≥3 observations, `price_last_updated` < 180 jours | prix + date |
| **low** | prix inline uniquement, pas d'historique ou date inconnue | prix affiché avec mention "estimation" |
| **absent** | aucun prix disponible | bloc prix masqué |

Le seuil N=3 pour `price_status v2` est déjà validé en principe (DECISIONS.md). Il s'applique ici comme seuil `medium`.

---

## Ce qui manque pour la variante marché complète [à ne pas lancer en Phase 1]

| Élément | Raison de report |
|---------|-----------------|
| `price_status v2` | gated sur ingestion eBay réelle (confirmé DECISIONS.md) |
| `price_summary` opérationnel | backfill créé mais non raccordé aux services publics |
| distinctions par condition (loose/CIB/mint) structurées | price_summary résoud ça mais nécessite raccordement |
| multi-source (eBay + PriceCharting) | eBay n'est pas encore ingéré en prod |
| éditions / variantes physiques | nécessite `releases` + édition data |

---

## Variante marché cible — Post-Phase 1

Une fois `price_summary` raccordé aux services publics et l'ingestion eBay active :

### Unité marchande complète

```
game_id
  + loose: { p25, p50, p75, sample_count, trend_90d }
  + cib:   { p25, p50, p75, sample_count }
  + mint:  { p25, p50, p75, sample_count }
  + confidence_score (0–100)
  + last_observed_at
  + sources: [pricecharting, ebay]
  + price_status: v2 (ebay_confirmed | pricecharting_only | insufficient)
```

Cette structure est déjà schématisée dans `price_summary` (migration 009).
Elle ne nécessite pas de nouvelle table — seulement le raccordement des services publics et l'ingestion eBay.

---

## Relation avec le score de complétude

La variante marché minimale n'est PAS un critère du standard de fiche complète (Phase 1).
Le cap des 4000 ne dépend pas de la couverture marché.
Le signal marché est un **enrichissement de contexte**, pas une condition de publication.
