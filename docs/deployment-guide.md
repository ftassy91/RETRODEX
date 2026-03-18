# RetroDex — Deployment Guide

## Backend -> Railway

1. Go to https://railway.app/new
2. Connect GitHub -> ftassy91/RETRODEX
3. Select "backend" as root directory OR let railway.json handle it
4. Add environment variable: DATABASE_URL (from Railway PostgreSQL plugin)
5. Deploy -> copy the generated URL (e.g. retrodex-backend.railway.app)

## Database -> Railway PostgreSQL

1. In Railway project -> Add Plugin -> PostgreSQL
2. Copy DATABASE_URL from plugin settings
3. Run migration: node scripts/db/migrate.js
4. Verify: GET https://your-app.railway.app/api/health

## Frontend -> Vercel

1. Go to https://vercel.com/new
2. Import ftassy91/RETRODEX
3. Framework: Other (static)
4. Root directory: frontend/
5. No build command needed
6. Deploy -> copy the Vercel URL

## Post-deploy checklist

- [ ] Railway backend responds on /api/health
- [ ] PostgreSQL has 507 games
- [ ] Vercel frontend loads index.html
- [ ] RetroMarket points to Railway backend URL
- [ ] PWA manifest accessible at /manifest.json
