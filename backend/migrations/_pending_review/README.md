# Pending Review

Ce dossier contient les artefacts DB gardes hors du flux automatique.

## `20260331_007_collection_runtime_canonical.js`

- Statut : `pending_review`
- Raison : la migration reconstruit `collection_items` vers un schema multi-user qui n'est pas deploye en prod et qui n'a pas encore ete valide dans la feuille de route canonique.
- Decision : la conserver hors du chemin de migrations actives.
- Revision prevue : Phase 4 `collection`, avec arbitrage explicite sur le modele final.

## `20260331_008_games_enrichment_status_columns.sql`

- Statut : `historical_applied`
- Raison : le DDL des colonnes `editorial_status`, `media_status` et `price_status` est deja applique en production.
- Decision : conserver ce fichier comme trace historique, pas comme action en attente.

## `20260331_009_games_status_backfill_preview.sql`

- Statut : `historical_validated`
- Raison : SQL de preview genere a partir de [games-status-rules.js](./backend/scripts/lib/games-status-rules.js) pour deriver les statuts et comparer `stored` vs `derived`.
- Decision : ne jamais l'editer a la main ; toute modification passe par le module canonique puis par [generate-games-status-sql.js](./backend/scripts/generate-games-status-sql.js).
- Resultat : utilise pour le preview pre-apply et le controle post-apply du backfill prod execute le 31 mars 2026.

## `20260331_010_games_status_backfill_apply.sql`

- Statut : `historical_applied`
- Raison : SQL d'`UPDATE` genere a partir de [games-status-rules.js](./backend/scripts/lib/games-status-rules.js) pour appliquer le backfill uniquement sur les lignes divergentes.
- Decision : execute manuellement en production le 31 mars 2026 apres validation humaine explicite.
- Resultat : `UPDATE 1517`, puis controle post-apply avec `divergenceCounts = 0`.

## Future `price_status` v2

- Statut : `deferred_future_rule`
- Raison : une revue preview-only du 31 mars 2026 a valide sur le principe une future regle `price_status` ou `pricecharting` est une estimation et `ebay` la seule vente reelle retenue, avec seuil `N = 3`.
- Decision : ne pas generer ni appliquer de nouveau SQL tant qu'aucune ingestion `ebay` n'existe dans `price_history`.
- Source de reference : la section future de [games-status-rules.js](./backend/scripts/lib/games-status-rules.js) et [PHASE3_DB_READINESS.md](./docs/PHASE3_DB_READINESS.md).
