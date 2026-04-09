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

- `price_history` for additive sold-observation ingestion during `LOT_MVP_REAL_SOLD_PRICES`
- `price_observations` remains a historical canonical market layer where already present
- `market_snapshots` remains a future/current-value canonical target outside the scope of this lot

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
- Transitional rule: **canonical first, legacy fallback**.
- Legacy columns in `games` remain readable only to preserve runtime compatibility while migration completes.
- No new enrichment should write product-critical values directly into legacy-only fields unless the canonical owner is also updated.

## Compatibility ownership matrix

| Field family | Canonical owner | Legacy compatibility field | Runtime rule |
| --- | --- | --- | --- |
| Game identity | `games`, `releases` | `games.title`, `games.console`, `games.year`, `games.slug` | Read allowed, canonical release layer extends identity |
| Editorial summary / synopsis / lore | `game_editorial` | `games.summary`, `games.synopsis`, `games.lore` | Canonical first, legacy fallback only |
| Contributors | `people`, `game_people` | `games.dev_team`, `games.ost_composers`, `games.developer` | Canonical first, legacy strings are fallback only |
| Company links | `companies`, `game_companies` | `games.developer`, `games.publisher` | Canonical first, legacy strings are fallback only |
| Market snapshot | `market_snapshots` (future target), additive lot publishes through `games.*` compatibility fields | `games.loosePrice`, `games.cibPrice`, `games.mintPrice` | Runtime compatibility first during `LOT_MVP_REAL_SOLD_PRICES` |
| Market history | `price_history` for sold-ingest in active lot, `price_observations` where already canonical | legacy `price_history` readers | Sold-only first, transitional dual-read allowed |
| Media references | `media_references` | `games.cover_url`, `games.coverImage`, `games.manual_url` | Canonical first, legacy URLs are fallback only |
| Source traceability | `source_records`, `field_provenance` | `games.source_confidence` | Canonical first, legacy confidence is fallback only |
| Quality / readiness | `quality_records` | none | Canonical only |

## Backfill policy

- Legacy `games` is no longer treated as the only meaningful storage layer.
- Canonical backfill must write:
  - identity into `releases`
  - editorial into `game_editorial`
  - people links into `people` and `game_people`
  - company links into `game_companies`
  - current market summaries into `market_snapshots` once that canonical layer is explicitly activated
  - historical market rows into `price_history` for `LOT_MVP_REAL_SOLD_PRICES`, with future migration to `price_observations` or successor canonical layer by explicit lot only
  - external asset pointers into `media_references`
  - provenance into `source_records` and `field_provenance`
- Legacy values remain readable during transition, but audit and quality logic must prefer canonical tables when they exist.
- Console knowledge stored in the versioned local registry is treated as an internal source and must also write provenance for console identity and overview fields.

## Field ownership rules

- `games.title`, `games.console`, `games.year`, `games.slug` remain compatibility identity fields.
- `releases` owns release identity granularity and must absorb future region / edition specific imports.
- `game_editorial` owns summary, synopsis, lore, development notes, cheat codes, characters, and gameplay description.
- `people` / `game_people` own named contributors and roles; `developer` string on `games` is transitional only.
- `game_companies` owns canonical developer / publisher links.
- `market_snapshots` remains the future canonical owner for product-facing current values and trend signal, but is not activated by `LOT_MVP_REAL_SOLD_PRICES`.
- `price_history` is the active sold-observation ingest and audit surface for `LOT_MVP_REAL_SOLD_PRICES`.
- `price_observations` remains a canonical historical market layer where already present and may be dual-read during transition.
- `media_references` owns asset pointers and compliance status; no product route should infer local asset ownership from a bare URL alone.
- `source_records` and `field_provenance` own the explanation of where a field came from and whether it can be trusted.
- `games.loosePrice`, `games.cibPrice`, `games.mintPrice`, `games.summary`, `games.synopsis`, `games.cover_url`, `games.coverImage`, `games.manual_url`, `games.dev_team`, and `games.ost_composers` are now **fallback-only** for public runtime compatibility.

## Non-negotiable rules

- No blind overwrite of existing values.
- No high-value field without source context.
- No destructive migration without an explicit fallback path.
- No mixing of verified and inferred values without flags.
- No local storage of copyrighted assets unless explicitly permitted.
