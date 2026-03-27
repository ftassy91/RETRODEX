# RetroDex — CLAUDE.md

> Retro-gaming knowledge engine with integrated market insights.
> Data-first architecture: SQLite (local) + Supabase (prod) + static frontend prototype.

## Quick Start

```bash
# Backend (Express API on port 3000)
cd backend && npm install && npm rebuild sqlite3 && node src/server.js

# Frontend prototype (static, port 3001)
npx serve frontend -l 3001

# Both at once (from root)
npm run dev
```

## Project Structure

```
RETRODEX/
├── backend/                    # Express API + served HTML pages
│   ├── src/
│   │   ├── server.js           # Entry point — mounts all routes
│   │   ├── routes/             # Express routers (games, collection, market, etc.)
│   │   ├── services/           # Business logic (audit, console, game-read, quality)
│   │   ├── helpers/            # Shared utilities (query, priceHistory, search)
│   │   ├── models/             # Sequelize models (Game, CollectionItem, Console, etc.)
│   │   ├── lib/                # Data libraries (consoles encyclopedia)
│   │   └── config/             # Source policy, env config
│   ├── public/                 # HTML pages served by Express (hub, game-detail, etc.)
│   │   ├── js/                 # Client-side JS (pages/, core/, features/)
│   │   ├── style.css           # Main stylesheet
│   │   └── assets/system/      # SVG icons, patterns, signatures
│   ├── config/database.js      # Dual-mode SQLite/PostgreSQL config
│   ├── db_supabase.js          # Supabase client and query layer
│   ├── migrations/             # Database migrations (canonical core)
│   ├── scripts/                # Data scripts (backfill, import, audit, sync)
│   ├── enrich-database/        # Enrichment pipeline (genres, prices, editorial, wiki)
│   └── storage/                # SQLite database (gitignored)
├── frontend/                   # 3DS prototype + RetroMarket terminal (static)
│   ├── index.html              # 3DS XL interface SPA
│   ├── css/                    # Extracted stylesheets
│   ├── js/                     # Vanilla JS modules (data-layer, views, illustration)
│   ├── modules/retromarket/    # CRT market terminal
│   └── data/                   # Static JSON catalogs
├── data/                       # Shared data files (consoles, strategic catalogs)
├── scripts/                    # Root-level automation (audit, import, sync, assets)
├── docs/                       # Architecture docs, runbooks, execution logs
└── RETRODEXseedV0/             # LEGACY — read-only prototype reference
```

## Architecture

### Backend Modes

The backend auto-detects its runtime:
- **Local dev**: SQLite via Sequelize (`backend/storage/retrodex.sqlite`)
- **Vercel serverless**: Supabase when `VERCEL` + `SUPABASE_URL` are set, no `DATABASE_URL`
- **Railway/Postgres**: When `DATABASE_URL` is set

### Key Data Flow

```
Request → server.js → route module → service layer → Sequelize/Supabase → Response
```

- Routes handle HTTP concerns (validation, response shaping)
- Services handle business logic (game reads, audit scoring, console lookups)
- Models define Sequelize schemas with associations in `models/associations.js`

### Dual Frontend

1. **`backend/public/`** — Production HTML pages served by Express (hub.html is the main entry)
2. **`frontend/`** — Standalone 3DS prototype with pixel art generator (static, optional)

## Conventions

### Code Style
- Use `'use strict'` in all backend JS files
- Route files export an Express Router
- Use `handleAsync()` wrapper for all async route handlers
- Response envelope: `{ ok: true/false, error?: string, items?: [], total?: number }`

### Git Workflow
- Branch from `main` for features: `feature/<name>` or `fix/<name>`
- Squash-merge to main — one clean commit per feature
- Delete branches after merge
- Commit format: `type(scope): description` (conventional commits)
  - Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`
  - Scopes: `ui`, `api`, `data`, `market`, `collection`, `runtime`, `serverless`

### What NOT to Modify
- `RETRODEXseedV0/` — legacy prototype, read-only reference
- `frontend/data/*.js` — static prototype data
- `frontend/js/top-screen-generator.js` — deterministic pixel art algorithm
- `backend/storage/*.sqlite` — only modify via scripts/migrations

### Environment Variables
- `PORT` — backend port (default: 3000)
- `DATABASE_URL` — PostgreSQL connection (enables Postgres mode)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` — Supabase connection
- `SYNC_SECRET` — required for `POST /api/sync` (fails closed if unset)
- `ALLOWED_ORIGINS` — comma-separated CORS origins (default: `*`)
- `NODE_ENV` — `production` on Vercel

### Testing
```bash
cd backend && npm run smoke    # 22-endpoint integration test on port 3100
```

## Project Tracking (Notion)
- **Hub**: https://www.notion.so/330e0fdcdce88181bde4ef9f927666ae
- **Sprint Tracker**: https://www.notion.so/9e5d1a18e1d84828ae843d2cad464143
- **Bug Tracker**: https://www.notion.so/23f9fe3cfecb427f90c585b0e8cf50ae

## Deployment
- **Production**: https://retrodex-beryl.vercel.app/
- **Backend**: Vercel serverless (`vercel.json` routes `/api/*` to `server.js`)
- **Frontend prototype**: Vercel static or `npx serve frontend`
- **Database**: Supabase (prod), SQLite (local dev)

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with game count |
| GET | `/api/games` | List games (supports `?q`, `?console`, `?limit`) |
| GET | `/api/games/:id` | Game detail |
| GET | `/api/games/:id/price-history` | 12-month price history |
| GET | `/api/collection` | User collection with game data |
| POST | `/api/collection` | Add to collection (`gameId`, `condition`, `notes`) |
| DELETE | `/api/collection/:id` | Remove from collection |
| GET | `/api/consoles` | Console list with game counts |
| GET | `/api/market/search` | Market search with price signals |
| GET | `/api/stats` | Summary statistics |
