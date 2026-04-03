# RetroDex -- Project Overview

## Status

This document is an orientation map, not the canonical source of truth.

Read first:
1. [AGENTS.md](./AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](./docs/DECISIONS.md)

If this file conflicts with those documents, this file loses.

## Current Project Shape

RetroDex is currently one repository with:
- one canonical public runtime
- one isolated back-office/admin layer
- one secondary prototype area
- one local staging database used for audit, curation, and enrichment

## Canonical workspace

- repository root: `RETRODEXseed`
- canonical public runtime: [backend/](../backend/)
- canonical public UI: [backend/public/](../backend/public/)
- canonical admin layer: [backend/src/routes/admin/](../backend/src/routes/admin/) and [backend/src/services/admin/](../backend/src/services/admin/)
- secondary prototype surface: [frontend/](./frontend/)

## What lives where

- [backend/](../backend/) serves the active public runtime and the canonical back-office code
- [backend/public/](../backend/public/) contains the active public pages and client-side code
- [backend/src/routes/](../backend/src/routes/) contains the active public route tree
- [backend/src/services/](../backend/src/services/) contains active public logic
- [backend/src/services/admin/](../backend/src/services/admin/) contains audit, curation, enrichment, and other back-office logic
- [frontend/](./frontend/) is a prototype/exploration space, not the default product surface
- [docs/](./docs/) contains active and historical documentation
- [docs/_superseded/](./docs/_superseded/) contains non-canonical historical documents

## Data reality

- public runtime/prod truth: [backend/db_supabase.js](../backend/db_supabase.js)
- local staging/back-office DB: [backend/storage/retrodex.sqlite](../backend/storage/retrodex.sqlite)

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
