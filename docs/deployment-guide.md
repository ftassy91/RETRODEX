# RetroDex -- Deployment Guide

## Status

This file is historical and must not be treated as the canonical deployment plan.

Current authority for deployment/runtime shape:
1. [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md)
4. [vercel.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/vercel.json)

## Current deployment reality

- public static surface is served from [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/)
- Vercel routes `/api/*` to [backend/src/server.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/server.js)
- Vercel routes `/` to [backend/public/hub.html](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/hub.html)
- public runtime is Supabase-first through [backend/db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js)
- local SQLite is staging/back-office only

## Historical note

Older Railway/PostgreSQL split instructions in previous versions of this file no longer represent the active canonical topology.
Keep this file only as a warning against using those old instructions blindly.
