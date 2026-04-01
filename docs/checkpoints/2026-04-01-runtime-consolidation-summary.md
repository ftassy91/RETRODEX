# Runtime Consolidation Summary

## Avant / apres

- Avant :
  - le runtime web modifiait encore le schema
  - le bootstrap local et le seed prototype etaient implicites
  - la lecture locale de prix pouvait creer `price_history`
  - le prototype `frontend/` etait encore promu par les scripts root
  - `audit/entries` et `curation/dataset` restaient monolithiques
- Apres :
  - le runtime est non mutant et verifie seulement l'etat de la DB
  - les mutations passent par migration ou commande explicite
  - le bootstrap local SQLite est explicite
  - le chemin `frontend/data` est explicitement local/prototype-only
  - `audit/entries` et `curation/dataset` sont reduits en facades/orchestrateurs
  - une routine `check:runtime` regroupe les verifications critiques

## Decisions appliquees

- `Supabase/Postgres` reste la verite runtime/prod
- `SQLite` reste sandbox/admin/local
- `frontend/` reste un prototype secondaire
- le runtime public ne cree plus de table/colonne au demarrage
- le prototype local reste autorise uniquement via commandes/scripts explicites

## Commandes ajoutees

- `cd backend && npm run db:migrate`
- `cd backend && npm run db:check-runtime`
- `cd backend && npm run db:bootstrap-local`
- `cd backend && npm run db:seed-prototype-local`
- `cd backend && npm run check:runtime`
- `cd backend && npm run check:runtime-boundaries`
- `cd backend && npm run verify:runtime-nonmutating`

Wrappers root :
- `npm run db:migrate`
- `npm run db:check-runtime`
- `npm run db:bootstrap-local`
- `npm run db:seed-prototype-local`
- `npm run check:runtime`
- `npm run check:runtime-boundaries`
- `npm run verify:runtime-nonmutating`

## Tests passes

- `node backend/scripts/run-audit.js --ids=tetris-game-boy`
- `node backend/scripts/run-pass1-curation.js`
- `cd backend && npm run db:check-runtime`
- `cd backend && npm run check:runtime`
- `npm run smoke`
- `cd backend && npm test -- --runInBand`

## Fichiers touches

- `backend/src/services/admin/audit/entries.js`
  - facade mince qui compose les nouveaux modules d'audit
- `backend/src/services/admin/audit/source-support.js`
  - detection des sources et politiques de support
- `backend/src/services/admin/audit/games.js`
  - audit des jeux et assemblage canonical game
- `backend/src/services/admin/audit/consoles.js`
  - audit des consoles
- `backend/src/services/admin/audit/market.js`
  - synthese market
- `backend/src/services/admin/curation/dataset.js`
  - orchestrateur PASS1 allege sans changement de shape
- `backend/src/services/admin/curation/dataset-loaders.js`
  - chargeurs SQL et maps PASS1
- `backend/src/services/admin/curation/dataset-evaluator.js`
  - evaluation par jeu, validation, score, hash
- `backend/src/services/admin/curation/dataset-assembly.js`
  - assemblage final `consoleMatrix / profiles / states / events / publicationSlots`
- `backend/src/prototype/loadPrototypeData.js`
  - loader local-only explicite pour `frontend/data`
- `backend/src/loadPrototypeData.js`
  - wrapper de compatibilite vers le loader prototype dedie
- `backend/src/routes/admin/sync.js`
  - route re-etiquetee comme admin/prototype non canonique
- `backend/src/syncGames.js`
  - seed local recadre vers le loader prototype dedie
- `backend/scripts/seed.js`
  - seed local aligne sur le chemin prototype explicite
- `backend/package.json`
  - ajoute `check:runtime`
- `package.json`
  - ajoute le wrapper root `check:runtime`

## Prochaines actions recommandees

1. reprendre l'enrichissement manifest-first sur cette base plus stable
2. ne toucher `audit/entries` ou `curation/dataset` a nouveau que si une douleur concrete reapparait
3. garder `check:runtime` dans la routine normale des futurs lots de consolidation
