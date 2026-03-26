# RetroDex Data Architecture

## Canonical data strategy

- Canonical runtime during refactor: SQLite.
- Supabase role during refactor: mirror / compatibility target only.
- Public runtime compatibility: preserved through the existing `games`-centric read model while the canonical layer is introduced beside it.

## Domain separation

### Identity

- `games`
- `releases`
- `consoles`
- `franchises`
- `companies`

### Editorial

- `game_editorial`
- `people`
- `game_people`
- `game_companies`

### Market

- `price_observations`
- `market_snapshots`

### Assets

- `media_references`

### Audit and provenance

- `source_records`
- `field_provenance`
- `quality_records`
- `enrichment_runs`

## Transitional ownership

- `games` stays the public compatibility table for existing routes.
- New normalized tables become the source of truth for new enrichment and audit flows.
- Existing public routes read through adapters until the public surface can move to the canonical layer safely.

## Non-negotiable rules

- No blind overwrite of existing values.
- No high-value field without source context.
- No destructive migration without an explicit fallback path.
- No mixing of verified and inferred values without flags.
- No local storage of copyrighted assets unless explicitly permitted.
