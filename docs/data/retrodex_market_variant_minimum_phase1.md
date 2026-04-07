# Variante marché — Standard minimum Phase 1

**Référence :** `origin/main` @ 2026-04-07
**Périmètre :** RetroMarket — champs prix réellement présents en base

---

## Contexte

RetroDex expose une dimension marché (RetroMarket) fondée sur les données de prix réelles en base. Ce document définit ce qu'une fiche de marché minimale requiert, fondé exclusivement sur les champs réellement présents.

---

## Champs marché disponibles dans le schéma actuel

### Sur la table `games` (inline, legacy)

- `loose_price` (FLOAT) — prix en loose
- `cib_price` (FLOAT) — prix complet en boîte
- `mint_price` (FLOAT) — prix mint / scellé
- `price_last_updated` (TEXT) — date de dernière mise à jour
- `source_names` (TEXT) — sources des prix (JSON array)

### Table `price_history` (canonique, 136 895 lignes actives)

- `game_id`, `condition`, `price`, `currency`, `source`, `observed_at`
- Sert de source primaire pour les prix calculés

### Table `price_summary` (Phase 1, créée, non lue par services publics)

- `game_id`, `condition`, `p25`, `p50`, `p75`, `trend_90d`
- Scripts backfill prêts, pas encore intégrée dans le runtime public

### Table `market_snapshots` + `price_observations`

- Back-office uniquement — agrégats de marché, pas lus par API publique

---

## Variante marché minimale Phase 1

Une fiche est **viable marché** si :

- `loose_price` OU `cib_price` IS NOT NULL (prix disponible)
- `price_last_updated` présent et < 90 jours (donnée fraîche)
- `source_names` documenté (traçabilité source)

### État actuel estimé

~700 fiches ont des prix inline. Coverage exacte dépend de la fraîcheur des données (price_last_updated).

---

## Champs marché absents ou faibles

| Champ | État | Impact |
|-------|------|--------|
| `rarity` | Partiel | Affiché dans catalogue, source inconnue |
| `trend` | Calculé à la volée depuis price_history | Fragile si pas d'observations récentes |
| `price_summary` (p25/p50/p75) | Créé, non lu | Investissement inutilisé |
| `mint_price` | Partiel | Donnée rarement disponible |

---

## Variante marché cible — Post-consolidation

Une fiche marché cible satisfait :

- Prices (`loose_price`, `cib_price`, `mint_price`) issus de `price_history` avec ≥ 3 observations
- `price_summary` activé dans runtime public (remplace inline prices)
- `rarity` validé depuis source traçable (ex: PriceCharting rarity tier)
- `trend_90d` calculé depuis `price_summary.trend_90d` et exposé en API
- `source_names` avec ≥ 2 sources distinctes

---

## Migration vers price_summary

La table `price_summary` (migration 009) est déjà créée et backfillée. L'activation dans le runtime public nécessite :

1. Modifier `db_supabase.js` pour lire `price_summary` en priorité
2. Adapter `toItemPayload` pour exposer `p50` comme prix de référence
3. Exposer `trend_90d` dans le catalogue

**Effort estimé : faible** (modification de 2-3 fonctions dans db_supabase.js + toItemPayload).

---

## Relation avec le score de complétude

La variante marché minimale n'est PAS un critère du standard de fiche complète Phase 1.
Le cap des 4000 ne dépend pas de la couverture marché.
Le signal marché est un enrichissement de contexte, pas une condition de publication.
