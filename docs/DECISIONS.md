# RetroDex Decisions

## Références

- Baseline JTASSY : `70eb99f64449ac6c2daa27f18b63597078ee13b5`
- Date de consolidation Phase 0 / Phase 2 : 31 mars 2026

## Décisions JTASSY conservées

- Le pipeline `backend/enrich-database/` reste le baseline d'enrichissement Sprint 7.
- La fiche jeu conserve les trois Knowledge Domains et le bloc Production comme point de départ valide.
- La migration `8896316` et les décisions produit déjà livrées ne sont pas renversées dans cette passe.

## Décisions d'architecture validées

- Runtime public actif :
  - prod et local utilisent le même plan de routes publiques actives
  - [contextual-search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/contextual-search.js)
  - [serverless.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/serverless.js)
  - [prices.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices.js)
- Les routes publiques actives ne lisent plus directement la DB.
- La normalisation runtime passe par [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js).
- `db_supabase.js` est la référence des lectures runtime actives.
- Les routes legacy encore présentes ne sont pas la source de vérité du runtime public.

## Découvertes Phase 0 et décision finale

### `collection-service.js`

- Fichier : [backend/src/_quarantine/collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/collection-service.js)
- Décision : `quarantine`
- Raison : pousse un runtime `Sequelize + services` incompatible avec la cible prod `db_supabase.js`

### `20260331_007_collection_runtime_canonical.js`

- Fichier : [backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/migrations/_pending_review/20260331_007_collection_runtime_canonical.js)
- Décision : `pending_review`
- Raison : migration collection multi-user non validée pour la prod

### `runtime-db-architecture.md`

- Fichier : [docs/_superseded/runtime-db-architecture.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded/runtime-db-architecture.md)
- Décision : `superseded`
- Raison : document incompatible avec la cible canonique `db_supabase.js` en prod

### `runtime-db-context.js`

- Fichier : [backend/src/_quarantine/runtime-db-context.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/_quarantine/runtime-db-context.js)
- Décision : `quarantine`
- Raison : responsabilité absorbée par [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js), conservé seulement pour garder la quarantaine collection autoportée

## Décisions de refactor validées

- `serverless.js` a été réduit à un routeur d'orchestration.
- `contextual-search.js` et `prices.js` ont été vidés de leurs lectures DB directes.
- `market.js` n'est plus monté par défaut et a été ramené à un routeur legacy mince.
- Les endpoints de `market.js` sont maintenant classés :
  - converged :
    - `/api/stats`
    - `/api/search`
    - `/api/items`
    - `/api/consoles`
    - `/api/consoles/:id`
  - legacy isolated :
    - `/api/items/:id`
    - `/api/accessories/types`
    - `/api/accessories`
    - `/api/index/:id`
    - `/api/reports`

## Contraintes DB toujours actives

- Le runtime prod reste string-driven sur `games.console` et `games.developer`.
- `console_id` et `developer_id` ne sont pas le contrat runtime effectif actuel.
- Les colonnes `editorial_status`, `media_status`, `price_status` ne sont pas encore en prod.
- Les colonnes `youtube_id`, `youtube_verified`, `archive_id`, `archive_verified` ne sont pas encore en prod.

## Déviations JTASSY approuvées

Aucune déviation JTASSY formelle supplémentaire n'a été approuvée dans cette passe.

Les changements réalisés ont été traités comme :

- convergence du runtime actif
- isolement explicite du legacy
- documentation et rangement des découvertes non tracées
