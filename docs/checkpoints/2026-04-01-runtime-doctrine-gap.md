# 2026-04-01 — Runtime Doctrine Gap

## Ecarts confirmes avant consolidation

- `backend/src/server.js`
  - faisait encore `sequelize.sync({ alter })`
  - portait encore des mutations de schema runtime (`ensureGameEncyclopediaColumns`, `ensurePriceHistoryTable`)
  - seedait encore consoles + prototype au demarrage
- `backend/src/services/public-price/queries.js`
  - creait encore `price_history` a la demande en lecture runtime locale
- `backend/src/syncGames.js`
  - faisait encore `sequelize.sync({ alter: true })`
  - melangeait seed prototype et preparation de schema
- `backend/src/loadPrototypeData.js`
  - lit encore `frontend/data`
- `backend/src/routes/admin/sync.js`
  - depend encore du flux prototype
- `frontend/`
  - reste non canonique en doctrine
  - etait encore promu par les scripts root `dev`, `dev:frontend`, `start:frontend`

## Frontieres runtime

- Aucun import interdit trouve dans les routes/services publics vers :
  - `backend/scripts`
  - `polish-retrodex`
  - `frontend`
  - `_quarantine`
  - `_pending_review`
  - `docs/_superseded`

## Priorites retenues

1. sortir toute mutation de schema du runtime
2. rendre le bootstrap local explicite
3. ajouter un check de frontieres runtime executable
4. reduire au moins un gros module admin sans changer son API
