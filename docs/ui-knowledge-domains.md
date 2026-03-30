# Game Detail Knowledge Domains

This document defines the knowledge blocks displayed on the game detail page.

## Production
Source:
- `archive.production`
- fallback legacy fields from `/api/games/:id`

Displayed fields:
- developers
- publishers
- studios
- role chips
- dev team / credits

Rules:
- no synthetic company names
- empty state when no production data is available

## Lore & Characters
Source:
- `encyclopedia.summary`
- `encyclopedia.synopsis`
- `archive.lore`
- `archive.gameplay_description`
- `archive.characters`
- `encyclopedia.dev_anecdotes`
- `encyclopedia.cheat_codes`
- `archive.versions`
- `archive.duration`
- `archive.speedrun_wr`

Rules:
- `summary` and `synopsis` may both render when they differ
- no generated editorial text in the UI layer

## Media & Manuals
Source:
- `archive.media`
- fallback `archive.manual_url`

Displayed fields:
- manual references
- media inventory rows
- compliance badges
- provider and storage metadata

Rules:
- URLs are displayed as references, not copied assets
- compliance is rendered from backend-provided values only

## Music & OST
Source:
- `archive.ost.composers`
- `archive.ost.notable_tracks`
- `archive.ost.releases`

Rules:
- composers remain visible even when no OST release exists
- missing OST release metadata stays empty, never inferred in the UI
