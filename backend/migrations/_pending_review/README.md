# Pending Review

Ce dossier contient les artefacts DB gardés hors du flux automatique.

## `20260331_007_collection_runtime_canonical.js`

- Statut : `pending_review`
- Raison : la migration reconstruit `collection_items` vers un schéma multi-user qui n'est pas déployé en prod et qui n'a pas encore été validé dans la feuille de route canonique.
- Décision : la conserver hors du chemin de migrations actives.
- Révision prévue : Phase 4 `collection`, avec arbitrage explicite sur le modèle final.

## `20260331_008_games_enrichment_status_columns.sql`

- Statut : `historical_applied`
- Raison : le DDL des colonnes `editorial_status`, `media_status` et `price_status` est déjà appliqué en production.
- Décision : conserver ce fichier comme trace historique, pas comme action en attente.

## `20260331_009_games_status_backfill_preview.sql`

- Statut : `historical_validated`
- Raison : SQL de preview généré à partir de [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js) pour dériver les statuts et comparer `stored` vs `derived`.
- Décision : ne jamais l'éditer à la main ; toute modification passe par le module canonique puis par [generate-games-status-sql.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/generate-games-status-sql.js).
- Résultat : utilisé pour le preview pré-apply et le contrôle post-apply du backfill prod exécuté le 31 mars 2026.

## `20260331_010_games_status_backfill_apply.sql`

- Statut : `historical_applied`
- Raison : SQL d'`UPDATE` généré à partir de [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js) pour appliquer le backfill uniquement sur les lignes divergentes.
- Décision : exécuté manuellement en production le 31 mars 2026 après validation humaine explicite.
- Résultat : `UPDATE 1517`, puis contrôle post-apply avec `divergenceCounts = 0`.
