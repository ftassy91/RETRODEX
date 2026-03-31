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

- Statut : `pending_review`
- Raison : SQL de preview généré à partir de [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js) pour dériver les statuts et comparer `stored` vs `derived`.
- Décision : ne jamais l'éditer à la main ; toute modification passe par le module canonique puis par [generate-games-status-sql.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/generate-games-status-sql.js).
- Révision prévue : validation humaine après concordance parfaite avec [audit-games-status-columns.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/audit-games-status-columns.js).

## `20260331_010_games_status_backfill_apply.sql`

- Statut : `pending_review`
- Raison : SQL d'`UPDATE` généré à partir de [games-status-rules.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/lib/games-status-rules.js) pour appliquer le backfill uniquement sur les lignes divergentes.
- Décision : préparé uniquement. Interdiction de l'exécuter sans validation humaine explicite.
- Révision prévue : après review du preview SQL, de l'audit dry-run et validation humaine de l'application prod.
