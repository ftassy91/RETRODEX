# Pending Review

Ce dossier contient des migrations locales découvertes pendant la Phase 0, mais non autorisées dans le flux actif.

## `20260331_007_collection_runtime_canonical.js`

- Statut : `pending_review`
- Raison : la migration reconstruit `collection_items` vers un schéma multi-user qui n'est pas déployé en prod et qui n'a pas encore été validé dans la feuille de route canonique.
- Décision : la conserver hors du chemin de migrations actives.
- Révision prévue : Phase 4 `collection`, avec arbitrage explicite sur le modèle final.

## `20260331_008_games_enrichment_status_columns.sql`

- Statut : `pending_review`
- Raison : le DDL prépare les colonnes `editorial_status`, `media_status` et `price_status` pour `public.games`, mais aucune mutation prod ne doit partir sans validation humaine explicite.
- Décision : conserver le SQL prêt a l'application, hors du flux automatique.
- Révision prévue : Phase 3 DB, apres validation humaine du plan d'application en production.
