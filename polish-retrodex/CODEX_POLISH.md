# Polish RetroDex

Reference context for Codex work inside `polish-retrodex/`.

## Mission

Polish RetroDex is the isolated data pipeline for RetroDex.
It reads the existing local source, validates and prepares canonical data, and only later exports to Supabase.

## Absolute rules

- Never modify `backend/`, `frontend/`, or `RETRODEXseedV0/`
- Never write to Supabase without a dry-run-first workflow
- Never invent data; `null` is preferred over a false value
- Always log totals, errors, skipped rows, and null counts
- Keep all pipeline work isolated inside `polish-retrodex/`

## Real session facts

- Source SQLite path used by Sprint 1:
  - `./backend/storage/retrodex.sqlite`
- Real game rows read from `games` with `type='game'`:
  - `1491`
- `backend/src/lib/normalize.js` was not present at the path described in the brief
- `backend/enrich-database/` was not present as written in the brief
- A real bootstrap file exists at:
  - `./backend/enrich database/bootstrap.js`

## Sprint 1 outputs

- Ingest script:
  - `polish-retrodex/pipelines/01_ingest.js`
- Validation script:
  - `polish-retrodex/pipelines/02_validate.js`
- Normalize script:
  - `polish-retrodex/pipelines/03_normalize.js`
- Enrich script:
  - `polish-retrodex/pipelines/04_enrich.js`
- Export script:
  - `polish-retrodex/pipelines/05_export.js`
- Credits pipeline:
  - `polish-retrodex/pipelines/06_credits.js`
- Editorial pipeline:
  - `polish-retrodex/pipelines/07_editorial.js`
- Media docs pipeline:
  - `polish-retrodex/pipelines/08_media_docs.js`
- Music pipeline:
  - `polish-retrodex/pipelines/09_music.js`
- Domain publish dry-run:
  - `polish-retrodex/pipelines/10_publish_domains.js`
- Shared helpers:
  - `polish-retrodex/pipelines/_shared.js`
- Domain helpers:
  - `polish-retrodex/pipelines/_domain_shared.js`
- Source enrichment helpers:
  - `polish-retrodex/pipelines/_source_enrichment.js`
- Zod schema:
  - `polish-retrodex/schemas/game.schema.js`

## Current commands

```bash
cd polish-retrodex
npm run ingest
npm run validate
npm run normalize
npm run enrich
npm run export
npm run credits
npm run editorial
npm run media-docs
npm run music
npm run domains
npm run publish-domains
```

## Latest known artifacts

- Raw dump:
  - `polish-retrodex/data/raw/games_20260330.json`
- Ingest run log:
  - `polish-retrodex/logs/run_20260330T064506Z.json`
- Validation report:
  - `polish-retrodex/logs/validation_20260330_20260330T064516Z.json`
- Normalized output:
  - `polish-retrodex/data/processed/games_normalized_20260330.json`
- Normalize report:
  - `polish-retrodex/logs/normalize_20260330_20260330T065049Z.json`
- Enriched output:
  - `polish-retrodex/data/processed/games_enriched_20260330.json`
- Enrich report:
  - `polish-retrodex/logs/enrich_20260330_20260330T065453Z.json`
- Canonical items:
  - `polish-retrodex/data/canonical/items_20260330.json`
- Canonical market aggregates:
  - `polish-retrodex/data/canonical/market_aggregates_20260330.json`
- Canonical media references:
  - `polish-retrodex/data/canonical/media_references_20260330.json`
- Canonical manifest:
  - `polish-retrodex/data/canonical/manifest_20260330.json`
- Export dry-run report:
  - `polish-retrodex/logs/export_20260330_20260330T065837Z.json`
- Canonical credits:
  - `polish-retrodex/data/canonical/credits_20260330.json`
- Canonical companies:
  - `polish-retrodex/data/canonical/companies_20260330.json`
- Credits report:
  - `polish-retrodex/logs/credits_20260330_20260330T084659Z.json`
- Canonical editorial:
  - `polish-retrodex/data/canonical/editorial_20260330.json`
- Wikipedia editorial cache:
  - `polish-retrodex/data/raw/editorial_wikipedia_cache_20260330.json`
- Editorial report:
  - `polish-retrodex/logs/editorial_20260330_20260330T091556Z.json`
- Canonical media docs:
  - `polish-retrodex/data/canonical/media_docs_20260330.json`
- Media docs report:
  - `polish-retrodex/logs/media_docs_20260330_20260330T084710Z.json`
- Canonical music:
  - `polish-retrodex/data/canonical/music_20260330.json`
- Canonical composers:
  - `polish-retrodex/data/canonical/composers_20260330.json`
- Music report:
  - `polish-retrodex/logs/music_20260330_20260330T091330Z.json`
- Publish domains dry-run:
  - `polish-retrodex/data/canonical/publish_domains_20260330.json`
- Publish domains report:
  - `polish-retrodex/logs/publish_domains_20260330_20260330T091342Z.json`

## Latest normalization facts

- Rows normalized:
  - `1491`
- Canonical slug changes:
  - `13`
- Canonical slug collisions resolved:
  - `3`
- Structured parse failures:
  - `0`

## Latest enrichment facts

- Rows enriched:
  - `1491`
- Console links resolved:
  - `1491`
- Franchise links resolved:
  - `105`
- Market outliers filtered:
  - `13`
- Price backfills from aggregate:
  - `mintPrice: 2`

## Latest export facts

- Canonical items exported locally:
  - `1491`
- Canonical market aggregates exported locally:
  - `1491`
- Canonical media references exported locally:
  - `1462`
- Supabase dry-run:
  - connected: `true`
  - writable targets ready: `false`
- Missing remote tables confirmed by dry-run:
  - `items`
  - `market_aggregates`
  - `market_sales`
  - `game_releases`
  - `companies`
  - `regions`
  - `ost`
  - `collector_editions`

## Latest domain pipeline facts

- Credits:
  - items processed: `1491`
  - structured role entries: `2913`
  - unique companies/studios/publishers aggregated: `653`
  - items with at least one company reference: `1481`
- Editorial:
  - summary coverage: `1418`
  - synopsis coverage: `67`
  - lore coverage: `1416`
  - characters coverage: `1181`
  - summaries from Wikipedia cache: `57`
  - summaries derived from trusted synopsis/lore: `883`
  - confidence rules use `field_provenance` first, then seed/cache/derived fallback
- Media docs:
  - items with manuals/notices: `73`
  - items with asset variants: `1395`
  - local-only variants blocked from remote publish: `836`
  - compliance distribution:
    - `approved`: `825`
    - `reference_only`: `11`
    - `needs_review`: `66`
    - `mixed`: `504`
    - `missing`: `85`
- Music:
  - items with composers: `1026`
  - unique composers registry: `477`
  - OST notable tracks present: `62`
  - items needing release enrichment: `1028`
  - composers found via Wikipedia synopsis extraction: `1`
  - OST releases remain empty by design until a dedicated release-enrichment source exists

## Publish domains dry-run facts

- Supabase tables currently present for domain publish:
  - `media_references` only
- Blocked domain publishes:
  - `credits` blocked by missing `companies`, `people`, `game_people`
  - `editorial` blocked by missing `game_editorial`
  - `music` blocked by missing `people`, `game_people`, `ost`, `ost_tracks`, `ost_releases`
- Partially publishable domain:
  - `media_docs` is ready against existing `media_references`
  - publishable remote refs detected: `1462`
  - pending remote rows not yet present in Supabase: `60`

## Current known gaps

- `publisherId` and `developerId` are much stronger than the sparse `companies` master table
- `manual_url` coverage is still limited to `73` reference-only manuals
- `synopsis` remains the thinnest editorial field even after the first Wikipedia cache pass
- `music` currently models composers and notable tracks, but not release metadata
- No Supabase write has been performed from the new domain pipelines; `10_publish_domains.js` is dry-run only
