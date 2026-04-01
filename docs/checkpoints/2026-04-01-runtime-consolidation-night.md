# 2026-04-01 - Runtime Consolidation Night

## Lot 1 - Boot runtime et discipline d'execution

Objectif :
- sortir les mutations de schema du runtime
- introduire des commandes explicites `migrate / check / bootstrap / seed prototype`

Changements :
- extraction du runtime dans `backend/src/runtime/*`
- `backend/src/server.js` reduit a un point d'entree non mutant
- ajout de :
  - `db:migrate`
  - `db:check-runtime`
  - `db:bootstrap-local`
  - `db:seed-prototype-local`
  - `check:runtime-boundaries`
  - `verify:runtime-nonmutating`
- `backend/src/services/public-price/queries.js` ne cree plus `price_history` en lecture
- `backend/src/syncGames.js` ne fait plus `sequelize.sync({ alter: true })`
- ajout de la migration `20260401_007_runtime_boot_cleanup.js`

Validation :
- `cd backend && npm run db:check-runtime` : OK
- `cd backend && npm run db:bootstrap-local` : OK
- `cd backend && npm run db:migrate` : OK
- `cd backend && npm run check:runtime-boundaries` : OK
- `cd backend && npm run verify:runtime-nonmutating` : OK
- `npm run smoke` : OK
- `cd backend && npm test -- --runInBand` : OK

## Lot 2 - Frontieres et scripts root

Objectif :
- cesser de promouvoir le prototype comme flux par defaut

Changements :
- `package.json` root :
  - `dev` pointe maintenant sur le backend officiel
  - `dev:frontend` devient `dev:frontend:prototype`
  - `start:frontend` devient `start:frontend:prototype`
  - wrappers root ajoutes pour les commandes DB/runtime

Validation :
- garde-fou runtime toujours vert

## Lot 3 - Premier gros module reduit

Objectif :
- reduire un vrai point de complexite admin sans changer l'API metier

Changements :
- extraction des chargeurs et agregations de `coverage-service` vers `coverage-loaders.js`
- `coverage-service` garde son API :
  - `buildPremiumCoverageEntries`
  - `summarizePremiumCoverage`

Validation :
- `npm run smoke` : OK
- `cd backend && npm test -- --runInBand` : OK

## Lot 4 - Audit admin reduit

Objectif :
- transformer `backend/src/services/admin/audit/entries.js` en facade mince
- conserver les exports et les shapes d'audit

Changements :
- ajout de :
  - `backend/src/services/admin/audit/source-support.js`
  - `backend/src/services/admin/audit/games.js`
  - `backend/src/services/admin/audit/consoles.js`
  - `backend/src/services/admin/audit/market.js`
- `backend/src/services/admin/audit/entries.js` devient une facade de composition
- aucune modification de contrat sur :
  - `getGameAuditEntries`
  - `getConsoleAuditEntries`
  - `getMarketAudit`

Validation :
- `node backend/scripts/run-audit.js --ids=tetris-game-boy` : OK
- `npm run smoke` : OK
- `cd backend && npm test -- --runInBand` : OK

## Lot 5 - Curation PASS1 reduite

Objectif :
- transformer `backend/src/services/admin/curation/dataset.js` en orchestrateur
- conserver les exports et la shape du dataset PASS1

Changements :
- ajout de :
  - `backend/src/services/admin/curation/dataset-loaders.js`
  - `backend/src/services/admin/curation/dataset-evaluator.js`
  - `backend/src/services/admin/curation/dataset-assembly.js`
- `backend/src/services/admin/curation/dataset.js` garde son API mais ne porte plus toute la logique

Validation :
- `node backend/scripts/run-pass1-curation.js` : OK
- `npm run smoke` : OK
- `cd backend && npm test -- --runInBand` : OK

## Lot 6 - Prototype local clarifie + routine runtime

Objectif :
- rendre explicite le statut local-only de `frontend/data`
- rendre les garde-fous runtime utilisables en une seule commande

Changements :
- ajout de `backend/src/prototype/loadPrototypeData.js`
- `backend/src/loadPrototypeData.js` devient un wrapper de compatibilite local-only
- `backend/src/syncGames.js` et `backend/scripts/seed.js` pointent vers le loader prototype dedie
- `backend/src/routes/admin/sync.js` est re-etiquete comme route admin/prototype non canonique
- ajout de `check:runtime` dans `backend/package.json` et `package.json`

Validation :
- `npm run check:runtime` : OK
- `npm run smoke` : OK
- `cd backend && npm test -- --runInBand` : OK

## Blocages / limites restantes

- `frontend/` reste present comme prototype, non supprime
- `backend/src/loadPrototypeData.js` et `backend/src/routes/admin/sync.js` restent des chemins admin/prototype explicites, mais ils sont maintenant recadres comme local-only et non canoniques
- `backend/src/services/admin/curation/dataset.js` peut encore etre affine si l'on veut un decoupage plus fin du ranking, mais il n'est plus monolithique
