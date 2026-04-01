# Runtime Consolidation Summary

## Avant / apres

- Avant :
  - le runtime web modifiait encore le schema
  - le bootstrap local et le seed prototype etaient implicites
  - la lecture locale de prix pouvait creer `price_history`
  - le prototype `frontend/` etait encore promu par les scripts root
- Apres :
  - le runtime est non mutant et verifie seulement l'etat de la DB
  - les mutations passent par migration ou commande explicite
  - le bootstrap local SQLite est explicite
  - un garde-fou de frontieres runtime est executable
  - un premier gros module admin (`coverage-service`) a ete reduit

## Decisions appliquees

- `Supabase/Postgres` reste la verite runtime/prod
- `SQLite` reste sandbox/admin/local
- `frontend/` est retrograde au niveau des scripts de dev root
- le runtime public ne cree plus de table/colonne au demarrage

## Commandes ajoutees

- `cd backend && npm run db:migrate`
- `cd backend && npm run db:check-runtime`
- `cd backend && npm run db:bootstrap-local`
- `cd backend && npm run db:seed-prototype-local`
- `cd backend && npm run check:runtime-boundaries`
- `cd backend && npm run verify:runtime-nonmutating`

Wrappers root :
- `npm run db:migrate`
- `npm run db:check-runtime`
- `npm run db:bootstrap-local`
- `npm run db:seed-prototype-local`
- `npm run check:runtime-boundaries`
- `npm run verify:runtime-nonmutating`

## Tests passes

- `cd backend && npm run db:check-runtime`
- `cd backend && npm run db:bootstrap-local`
- `cd backend && npm run db:migrate`
- `cd backend && npm run check:runtime-boundaries`
- `cd backend && npm run verify:runtime-nonmutating`
- `npm run smoke`
- `cd backend && npm test -- --runInBand`

## Fichiers touches

- `backend/src/server.js`
  - runtime boot reduit a un point d'entree non mutant
- `backend/src/runtime/*`
  - separation `app assembly / runtime readiness / local bootstrap / schema check`
- `backend/migrations/20260401_007_runtime_boot_cleanup.js`
  - formalise les mutations de schema auparavant cachees dans le runtime
- `backend/src/services/public-price/queries.js`
  - supprime la creation runtime de `price_history`
- `backend/src/syncGames.js`
  - retire la preparation implicite de schema du seed prototype
- `backend/package.json`
  - commandes explicites de migration/check/bootstrap/verifications
- `package.json`
  - wrappers root et retrogradation explicite du frontend prototype
- `backend/scripts/check-runtime-boundaries.js`
  - garde-fou simple des dependances runtime
- `backend/scripts/verify-runtime-nonmutating.js`
  - preuve executable que demarrer le runtime n'altere plus le schema
- `backend/src/services/admin/enrichment/coverage-service.js`
  - service allege sans changement d'API
- `backend/src/services/admin/enrichment/coverage-loaders.js`
  - extraction des chargeurs et agregations coverage

## Prochaines actions recommandees

1. reduire `backend/src/services/admin/audit/entries.js`
2. reduire `backend/src/services/admin/curation/dataset.js`
3. decoupler plus explicitement les scripts admin/prototype autour de `loadPrototypeData` et `routes/admin/sync`
