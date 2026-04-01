# 2026-04-01 — Runtime Consolidation Night

## Lot 1 — Boot runtime et discipline d'execution

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

## Lot 2 — Frontieres et scripts root

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

## Lot 3 — Premier gros module reduit

Objectif :
- reduire un vrai point de complexite admin sans changer l'API metier

Changements :
- extraction des chargeurs et agrégations de `coverage-service` vers `coverage-loaders.js`
- `coverage-service` garde son API :
  - `buildPremiumCoverageEntries`
  - `summarizePremiumCoverage`

Validation :
- `npm run smoke` : OK
- `cd backend && npm test -- --runInBand` : OK

## Blocages / limites restantes

- `backend/src/loadPrototypeData.js` et `backend/src/routes/admin/sync.js` restent des chemins admin/prototype explicites, pas retires cette nuit
- `frontend/` reste present comme prototype, non supprime
- `backend/src/services/admin/audit/entries.js` et `backend/src/services/admin/curation/dataset.js` restent a reduire lors d'un lot suivant
