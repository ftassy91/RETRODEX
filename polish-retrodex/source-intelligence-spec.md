# Polish RetroDex - Source Intelligence Spec

## Scope

This document freezes the canonical source-intelligence model for:

- `Pixel Warehouse`
- `VGMaps`
- `VGMuseum`

The system is URL-only by design:

- no binary downloads in bulk
- no mirrored images
- no local asset storage
- no source-specific asset tables outside the existing canonical Supadata model

## Roles

### Pixel Warehouse

- role: `catalog_seed`
- retained content:
  - game list rows
  - game detail metadata (`contributors`, `sprite_count`, `zip_url` stored as metadata only)
- ignored content:
  - inline sprite PNGs
  - ZIP archives
  - contributor pages
- publish rule:
  - never generates `external_assets`
  - never writes asset rows to `media_references`

### VGMaps

- role: `external_asset_index`
- retained content:
  - game block title
  - platform page context
  - direct map asset URL
  - variant label
  - dimensions / file size / format / contributor
- ignored content:
  - ads, sponsor frames, nav scaffolding
  - rows without recoverable parent game title
- publish rule:
  - only `map`
  - prototype / unlicensed / unmarked variants stay review-only

### VGMuseum

- role: `mixed_source`
- retained content:
  - `manual`
  - `ending`
  - `sprite_sheet`
  - `scan` and `screenshot` only for review-stage discovery
- ignored content:
  - one-off GIF poses
  - still rips
  - system pages
  - series-level ambiguous pages
- publish rule:
  - v1 publishes only `manual`, `ending`, `sprite_sheet`
  - `scan` and `screenshot` are review-only and stay out of UI

## Discover Contract

Every raw source record produced by the pipeline must include:

- `source_record_id`
- `source_name`
- `source_type`
- `content_type`
- `title_raw`
- `platform_raw`
- `variant_label`
- `record_url`
- `detail_url`
- `contributor_raw`
- `preview_url_raw`
- `asset_type_guess`
- `asset_subtype`
- `raw_payload_json`
- `source_context`
- `first_seen_at`
- `last_seen_at`
- `status`

## Normalize Contract

Every normalized row must preserve the discover contract and add:

- `title_normalized`
- `title_match_key`
- `platform_normalized`
- `platform_family`
- `franchise_normalized`
- `edition_hint`
- `region_hint`
- `content_type_normalized`
- `canonical_lookup_key`
- `normalization_notes`

## Filtering Rules

### Keep

- Pixel Warehouse game rows with explicit title/platform/detail URL
- VGMaps direct map rows with parent game block title
- VGMuseum manual rows
- VGMuseum endings rows
- VGMuseum structured sprite-sheet rows (`character_rips`, `monster_chart`, `assorted_sprites`, `character_pose_sheet`)

### Review

- VGMaps rows flagged `prototype`, `unlicensed`, `unmarked`
- VGMuseum `scan`
- VGMuseum `screenshot`
- records with ambiguous regional/series matching

### Reject

- Pixel Warehouse ZIP archives
- Pixel Warehouse inline sprite PNGs
- VGMuseum one-off pose GIFs
- VGMuseum animation-frame GIFs
- VGMuseum still rips
- source rows whose recovered title is only an asset label

## Canonical Supadata Mapping

### Provenance

- raw source intelligence -> `source_records`
- field / asset traceability -> `field_provenance`
- quality envelope -> `quality_records`

### Assets

All published external references go to `public.media_references` only:

- `entity_type = 'game'`
- `entity_id = canonical_game_id`
- `provider = source_name`
- `media_type in ('map', 'manual', 'sprite_sheet', 'ending')`
- `url = external_url`
- `preview_url = preview_url`
- `storage_mode = 'external_reference'`
- `license_status = 'reference_only' | 'needs_review' | 'blocked'`
- `ui_allowed = true` only for publishable v1 assets
- `source_context` keeps section, variant label, contributor, page URL, run id and schema version

## Runtime Rules

The runtime keeps the existing endpoints:

- `/api/games/:id`
- `/api/games/:id/archive`
- `/api/games/:id/encyclopedia`

The public payload reads external assets from `media_references` and exposes only:

- rows with `ui_allowed = true`
- rows not `blocked`
- `map`, `manual`, `sprite_sheet`, `ending`

`scan` and `screenshot` remain hidden from UI v1 even if discovered.

## Operational Notes

- `publish-external-assets-supabase.js` must work on the latest PRD run, not on the union of historical JSONL rows.
- stale managed rows for `vgmaps`, `vgmuseum`, `pixel_warehouse` must be pruned from Supadata on apply if they are no longer present in the current PRD run.
- Vercel consumes `media_references` only; it must not read `polish-retrodex/outputs` directly.
