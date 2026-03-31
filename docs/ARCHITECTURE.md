# RetroDex Architecture

## Statut

État figé au 31 mars 2026.

- Runtime public canonique : routes Supabase via `db_supabase.js`
- Runtime local : même plan de routes publiques qu'en prod
- Legacy : routes Sequelize conservées mais non montées par défaut

## Flux d'une requête

### Recherche contextuelle

1. Le navigateur appelle `/api/market/search`, `/api/dex/search` ou `/api/collection/search`.
2. [contextual-search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/contextual-search.js) parse les paramètres HTTP.
3. [public-contextual-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-contextual-search-service.js) orchestre la lecture métier.
4. [public-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-search-service.js) et les lecteurs associés interrogent [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js).
5. [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js) aligne le shape de sortie.
6. La route renvoie le JSON final.

### Catalogue / détail / consoles

1. Le navigateur appelle `/api/items`, `/api/games/*`, `/api/consoles*`, `/api/stats`.
2. [serverless.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/serverless.js) ne garde que le parsing, l'orchestration et le mapping HTTP.
3. Les services de lecture Supabase appelés sont principalement :
   - [public-game-reader.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-game-reader.js)
   - [public-publication-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-publication-service.js)
   - [public-console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-console-service.js)
   - [public-runtime-payload-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-runtime-payload-service.js)
4. Les lecteurs interrogent [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js).
5. La normalisation passe par [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js).

### Historique prix

1. Le navigateur appelle `/api/prices/*`.
2. [prices.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices.js) délègue à [public-price-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-price-service.js).
3. Le service lit `games` et `price_history` via [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js), avec fallback SQLite encapsulé côté service.

## Backend

### Surface active

- [server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
- [contextual-search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/contextual-search.js)
- [serverless.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/serverless.js)
- [prices.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/prices.js)

### Services canoniques

- [public-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-search-service.js)
- [public-contextual-search-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-contextual-search-service.js)
- [public-game-reader.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-game-reader.js)
- [public-publication-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-publication-service.js)
- [public-console-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-console-service.js)
- [public-runtime-payload-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-runtime-payload-service.js)
- [public-price-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-price-service.js)
- [public-collection-service.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/public-collection-service.js)

### Legacy isolé

Ces fichiers existent encore mais ne sont pas la référence du runtime public actif.

- [market.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/market.js)
- [games-detail.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-detail.js)
- [games-list.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/games-list.js)
- [global-search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/global-search.js)
- [consoles.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/consoles.js)
- [franchises.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/franchises.js)

### Middleware

- [auth.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/middleware/auth.js)
- [error.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/middleware/error.js)

### Config

- [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js) : résolution d'environnement Supabase et contexte runtime
- [backend/config/database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/config/database.js) : bootstrap Sequelize/SQLite/Postgres
- [backend/src/database.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/database.js) : shim de compatibilité vers la configuration DB canonique

## Tables Supabase vérifiées

Volumes observés en prod lors de l'audit Phase 1.

| Table | Rôle | Volume |
| --- | --- | ---: |
| `games` | table publique de compatibilité et identité runtime | 1517 |
| `collection_items` | collection utilisateur | 10 |
| `game_editorial` | éditorial détaillé | 1418 |
| `media_references` | références média et assets externes | 2129 |
| `game_content_profiles` | profil de contenu / pertinence | 1491 |
| `game_curation_states` | statut de curation/publication | 1491 |
| `game_curation_events` | journal de curation | 1491 |
| `console_publication_slots` | vitrines consoles publiées | 351 |
| `quality_records` | scoring qualité | 1516 |
| `source_records` | provenance source | 5414 |
| `field_provenance` | provenance fine par champ | 15075 |
| `people` | référentiel personnes | 798 |
| `game_people` | jointure jeu/personne | 2957 |
| `ost` | entités OST | 979 |
| `ost_tracks` | pistes OST | 186 |
| `ost_releases` | releases OST | 0 |
| `price_history` | historique prix runtime actuel | 15182 |

## Règles de nommage

- Base : `snake_case`
- DTO runtime : `camelCase`
- Normalisation : [normalize.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/lib/normalize.js)
- Interdiction de refaire localement le mapping `snake_case -> camelCase` dans une route active

## Règles data layer

- Route active autorisée :
  - parse les paramètres
  - appelle un service/lecteur
  - mappe les codes HTTP
- Lecture DB active :
  - via [db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js)
  - jamais via import direct de modèle Sequelize dans une route active
- Sequelize reste autorisé pour :
  - modèles
  - migrations
  - bootstrap local
  - surfaces legacy explicitement isolées

## État structurant à retenir

- Le runtime public actif est déjà convergé Supabase-first.
- La prod reste string-driven sur `games.console` et `games.developer`.
- `console_id` et `developer_id` ne sont pas le contrat runtime actuel.
- Les tables canoniques éditoriales et de provenance existent déjà en prod et sont déjà lues par le backend.
