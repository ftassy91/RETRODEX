# Frontend Architecture - RetroDex

## Two frontends

- `backend/public/` -> Main UI (hub, games-list, game-detail, collection, stats, consoles) served by Express on port 3000. This is the production-ready UI.
- `frontend/` -> RetroDex Front prototype (3DS aesthetic, 40-game showcase, GB artworks) served separately on port 8080. Prototype only - do not merge into `backend/public/`.

## How to run locally

- Backend: `cd backend && node src/server.js` (port 3000)
- Frontend prototype: `npx http-server frontend -p 8080`

## Rules

- Never modify `frontend/data/*.js` (prototype data)
- Never modify `frontend/js/top-screen-generator.js` (deterministic algo)
- All new features go into `backend/public/`
