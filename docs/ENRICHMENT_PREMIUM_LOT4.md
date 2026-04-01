# Enrichment Premium Lot 4

## Scope

Bronze uplift cible sur trois fiches deja publiees :

- `secret-of-mana-super-nintendo`
- `999-nine-hours-nine-persons-nine-doors-nintendo-ds`
- `1080-snowboarding-nintendo-64`

## Goal

Faire monter ces fiches de `bronze` vers `silver/gold` avec le minimum de deltas a forte valeur :

- enrichissement editorial court mais substantiel
- references media premium manquantes
- synchronisation propre vers Supabase sur les seuls IDs concernes

## Local changes

Script :

- `backend/scripts/enrichment/apply-g8-premium-lot-4.js`
- `backend/scripts/enrichment/apply-premium-uplift-batch.js`
- `backend/scripts/enrichment/run-premium-batch-pipeline.js`
- `backend/scripts/enrichment/manifests/premium-lot-4.json`

Champs ajoutes ou renforces :

- `Secret of Mana`
  - `summary` allonge
  - `manual`
  - `map`
  - `sprite_sheet`
  - `ost_notable_tracks`
- `999: Nine Hours, Nine Persons, Nine Doors`
  - `synopsis`
  - `manual`
  - `map`
  - `screenshot`
- `1080° Snowboarding`
  - `synopsis`
  - `map`
  - `sprite_sheet`

## Coverage result

Resultat apres recalcul premium :

- `secret-of-mana-super-nintendo`: `65 bronze -> 92 gold`
- `999-nine-hours-nine-persons-nine-doors-nintendo-ds`: `64 bronze -> 85 gold`
- `1080-snowboarding-nintendo-64`: `69 bronze -> 85 gold`

Impact global :

- `gold`: `18 -> 21`
- `silver`: `0 -> 0`
- `top100Candidates`: `22 -> 22`

## Publication

Publication restreinte faite sur les trois IDs :

- `publish-records-supabase --ids=...`
- `publish-editorial-supabase --ids=...`
- `publish-media-references-supabase --ids=...`
- `sync-supabase-ui-fields --ids=...`

Point important :

- `publish-media-references-supabase.js` a ete etendu pour publier aussi `map`, `sprite_sheet`, `screenshot`, `ending` et `scan`, en plus de `cover` et `manual`
- le systeme premium peut maintenant etre pilote par manifeste JSON, sans reecrire un script specifique a chaque lot

## Validation

- backup SQLite avant mutation
- recalcul premium local
- post-check publication a `0` sur records, editorial, media et UI sync
- `npm run smoke` vert
- `cd backend && npm test -- --runInBand` vert
