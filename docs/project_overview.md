# RetroDex -- Project Overview

## Status

This document is an orientation map, not the canonical source of truth.

Read first:
1. [AGENTS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/DECISIONS.md)

If this file conflicts with those documents, this file loses.

## Current Project Shape

RetroDex is currently one repository with:
- one canonical public runtime
- one isolated back-office/admin layer
- one secondary prototype area
- one local staging database used for audit, curation, and enrichment

## Canonical workspace

- repository root: `RETRODEXseed`
- canonical public runtime: [backend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/)
- canonical public UI: [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/)
- canonical admin layer: [backend/src/routes/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/admin/) and [backend/src/services/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/)
- secondary prototype surface: [frontend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/frontend/)

## What lives where

- [backend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/) serves the active public runtime and the canonical back-office code
- [backend/public/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/public/) contains the active public pages and client-side code
- [backend/src/routes/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/routes/) contains the active public route tree
- [backend/src/services/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/) contains active public logic
- [backend/src/services/admin/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/services/admin/) contains audit, curation, enrichment, and other back-office logic
- [frontend/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/frontend/) is a prototype/exploration space, not the default product surface
- [docs/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/) contains active and historical documentation
- [docs/_superseded/](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/_superseded/) contains non-canonical historical documents

## Data reality

- public runtime/prod truth: [backend/db_supabase.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/db_supabase.js)
- local staging/back-office DB: [backend/storage/retrodex.sqlite](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/storage/retrodex.sqlite)

Local SQLite is not the production truth.
It is the staging environment for:
- audit
- curation
- enrichment
- validation before controlled publication

## Product reality

The public product exposes four universes:
- RetroDex
- RetroMarket
- Collections
- Recherche

But the real project center of gravity is:
- structured game pages
- archive/knowledge
- provenance and quality
- curation and enrichment

Market and collection matter, but they remain support layers around the knowledge core.

## Operational summary

- public runtime: active and stabilized
- back-office/admin: isolated and active
- premium enrichment foundations: active
- prototype frontend: secondary
- historical docs: present, must be treated carefully
