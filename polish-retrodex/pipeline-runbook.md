# Polish RetroDex v1.0 - Pipeline Runbook

## Scope

This pipeline builds a source-intelligence layer for RetroDex.

It is limited to:

- metadata
- provenance
- external URLs
- canonical matching
- safe external reference publication

It never stores source binaries locally and never mirrors external assets.

## Source roles

- `pixel_warehouse`
  - role: `catalog_seed`
  - output: `source_records` only
  - never publishes `external_assets`
- `vgmaps`
  - role: `external_asset_index`
  - publishable asset type: `map`
- `vgmuseum`
  - role: `mixed_source`
  - publishable asset types in v1: `manual`, `ending`, `sprite_sheet`
  - review-only in v1: `scan`, `screenshot`

## Commands

- `npm run prd:discover -- --source=pixel_warehouse --scope=platform:NES`
- `npm run prd:discover -- --source=vgmaps -- --scope=platform:NES`
- `npm run prd:discover -- --source=vgmuseum -- --scope=section:manuals_gameboy`
- `npm run prd:normalize -- --run-id=<id>`
- `npm run prd:match -- --run-id=<id>`
- `npm run prd:publish -- --run-id=<id>`
- `npm run prd:review -- --run-id=<id>`
- `npm run prd:ui-export -- --run-id=<id>`
- `npm run prd:pipeline -- --profile=dry-run-sample`

## Outputs

- `outputs/source_records.jsonl`
- `outputs/normalized_records.jsonl`
- `outputs/match_candidates.jsonl`
- `outputs/external_assets.jsonl`
- `outputs/review_queue.jsonl`
- `outputs/ui_payloads.jsonl`

## Persistence

- checkpoints: `logs/checkpoints/`
- markdown reports: `logs/run_reports/`
- human logs: `logs/pipeline.log`, `logs/errors.log`

## Safety rules

- no ZIP ingestion
- no inline sprite PNG ingestion
- no local asset copies
- no source-specific binary cache
- no UI publication without:
  - canonical match
  - healthcheck `ok` or `redirected`
  - allowed asset type
  - legal flag compatible with `reference_only`

## Publish policy

- `Pixel Warehouse`
  - always skipped at publish time
  - reason: `catalog seed only`
- `VGMaps`
  - publishes only `map`
  - `prototype`, `unlicensed`, `unmarked` variants go to review
- `VGMuseum`
  - publishes only `manual`, `ending`, `sprite_sheet`
  - `scan` and `screenshot` stay review-only

## Supadata handoff

Published external references are pushed to `public.media_references` only.

Required mapping:

- `entity_type = 'game'`
- `entity_id = canonical_game_id`
- `provider = source_name`
- `media_type = asset_type`
- `url = external_url`
- `preview_url = preview_url`
- `storage_mode = 'external_reference'`
- `ui_allowed = true` only for v1-publishable assets
- `source_context` keeps section, contributor, variant label, run id

## Runtime contract

Vercel keeps the current endpoints and reads `media_references` in priority for:

- `archive.media.maps[]`
- `archive.media.manuals[]`
- `archive.media.sprites[]`
- `archive.media.assets[]`

Rows with `ui_allowed = false`, `license_status = blocked`, `scan`, or `screenshot` are not exposed in UI v1.
