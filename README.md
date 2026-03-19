# RetroDex

Hub centralise pour collectionneurs de jeux video retro.

## Lancement rapide

Backend (port 3000):
  run_backend.bat  ou  cd backend && node src/server.js

Frontend (port 8080):
  run_frontend.bat  ou  npx http-server frontend -p 8080

URLs:
  Hub         : http://localhost:3000/hub.html
  Catalogue   : http://localhost:3000/games-list.html
  RetroMarket : http://localhost:8080/modules/retromarket/market.html
  3DS Proto   : http://localhost:8080/modules/retrodex/index.html

## Stack
- Backend  : Node.js 24 + Express + SQLite
- Frontend : Vanilla JS + Canvas (Game Boy renderer)
- Sync     : Notion API (scripts/sync/)
- Data     : 507 jeux, 16 consoles, prix Loose/CIB/Mint

## Structure
backend/     → API REST port 3000
frontend/    → prototype 3DS + RetroMarket port 8080
scripts/     → audit, import, sync
docs/        → runbooks et documentation
logs/        → audit trail et checkpoints
data/        → market_candidates.json
