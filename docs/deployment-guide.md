# RetroDex -- Deployment Guide

## Status

This file is historical and must not be treated as the canonical deployment plan.

Current authority for deployment/runtime shape:
1. [AGENTS.md](./AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. [vercel.json](./vercel.json)

## Current deployment reality

- public static surface is served from [backend/public/](./backend/public/)
- Vercel routes `/api/*` to [backend/src/server.js](./backend/src/server.js)
- Vercel routes `/` to [backend/public/hub.html](./backend/public/hub.html)
- public runtime is Supabase-first through [backend/db_supabase.js](./backend/db_supabase.js)
- local SQLite is staging/back-office only

## Historical note

Older Railway/PostgreSQL split instructions in previous versions of this file no longer represent the active canonical topology.
Keep this file only as a warning against using those old instructions blindly.
