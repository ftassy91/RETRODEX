# Enrichment Premium Lot 3

State opened on April 1, 2026.

## Objective

Lot 3 targets the two remaining premium `silver` candidates still blocked by a
single missing manual reference.

The goal is simple:

- close the remaining manual gap
- convert both entries from `silver` to `gold`
- publish the uplift with the restricted `--ids=` flow only

## Selection Rule

This lot is intentionally narrower than Lot 2.

Included games must be:

- already `published`
- already `Tier A`
- already `is_top100_candidate = true`
- still `silver`
- blocked mainly by `manual`

## Target Cohort

1. `mario-and-luigi-bowsers-inside-story-nintendo-ds`
   - Title: `Mario & Luigi: Bowser's Inside Story`
   - Console: `Nintendo DS`
   - Current tier before lot: `silver`
   - Main gap: `manual`

2. `makaimura-for-wonderswan-wonderswan`
   - Title: `Makaimura for WonderSwan`
   - Console: `WonderSwan`
   - Current tier before lot: `silver`
   - Main gap: `manual`

## Why This Group

This lot is the highest ROI premium follow-up after Lots 1 and 2 because:

- both games are already visible on the public runtime
- both games are already premium-adjacent
- both are blocked by the same missing domain signal
- the publication can stay perfectly atomic by `--ids=`

## Execution Rule

Lot 3 only adds:

- `manual_url`
- matching `media_references` rows
- matching `source_records`
- matching `field_provenance`

It does not reopen:

- editorial
- soundtrack tracks
- credits beyond existing state
- broad curation rewrites

## Publication Rule

Lot 3 must stay restricted and layered:

- `publish-records-supabase.js --ids=...`
- `publish-media-references-supabase.js --ids=...`
- `sync-supabase-ui-fields.js --ids=...`

No broad publish should be used.

## Success Condition

Lot 3 is successful if:

- both targeted games gain a manual reference locally
- premium coverage rerun moves them to `gold`
- restricted publish completes with post-checks at `0`
- runtime validation stays green
