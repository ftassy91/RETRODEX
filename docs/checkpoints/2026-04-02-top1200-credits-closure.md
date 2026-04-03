# Top1200 Credits Closure

Date: 2026-04-02

## Objective

Close the remaining safe-yield credit debt inside the already stable `top1200` target without reopening broader enrichment tracks.

## Starting Point

- `top1200.complete_or_better = 1200/1200`
- `missingDevTeam = 5`
- `missingComposers = 85`
- no local `MusicBrainz` core snapshot present under `backend/data/musicbrainz`

## Changes Executed

### Open-source credit bootstrap

- Added [bootstrap-wikidata-credit-snapshot.js](../../backend/scripts/enrichment/bootstrap-wikidata-credit-snapshot.js)
- Added [generate-wikidata-credit-manifests.js](../../backend/scripts/enrichment/generate-wikidata-credit-manifests.js)
- Added [generate-top1200-credit-blocked-residue.js](../../backend/scripts/enrichment/generate-top1200-credit-blocked-residue.js)

### Safe-yield waves applied

- Published one `dev_team` closure wave for the 5 remaining safe cases:
  - `a-q-renkan-awa-sega-genesis`
  - `aleck-bordon-adventure-tower-and-shaft-game-boy-advance`
  - `alentejo-tinto-s-law-game-boy`
  - `auto-zone-game-boy-color`
  - `awogue-sega-genesis`
- Published one `composers` safe-yield wave for 8 games:
  - `19-03-ueno-hatsu-yakou-ressha-playstation`
  - `actua-pool-playstation`
  - `alien-syndrome-nes`
  - `anetto-futatabi-sega-genesis`
  - `arabian-nights-sabaku-no-seirei-o-super-nintendo`
  - `barbie-super-model-sega-genesis`
  - `bases-loaded-game-boy`
  - `chrono-resurrection-nintendo-64`

### Stability hardening

- Patched [backend/scripts/enrichment/_composer-batch-common.js](../../backend/scripts/enrichment/_composer-batch-common.js) to support non-Latin people names via deterministic hash fallback slugs.
- Patched [backend/scripts/enrichment/_dev-team-batch-common.js](../../backend/scripts/enrichment/_dev-team-batch-common.js) with the same fallback for future-proofing.

## Outcome

Measured with [report-top1200-progress.js](../../backend/scripts/enrichment/report-top1200-progress.js) against [2026-04-01T22-44-17-604Z_games.json](../../backend/data/audit/2026-04-01T22-44-17-604Z_games.json):

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 77`

Net gain:

- `dev_team`: `5 -> 0`
- `composers`: `85 -> 77`

## Blocked Residue

The remaining unresolved cases were written to:

- [2026-04-01T22-46-10-395Z_top1200_credit_blocked_residue.json](../../backend/data/enrichment/credits/2026-04-01T22-46-10-395Z_top1200_credit_blocked_residue.json)

Current blocked summary:

- `devTeamBlocked = 0`
- `composersBlocked = 77`

Each residue entry records:

- `gameId`
- debt type
- audit scores
- sources tested
- blocking reason

Common blocker for the remaining composer cases:

- no safe internal canonical yield
- no safe Wikidata/Wikipedia credit candidate
- no local `MusicBrainz` core snapshot available yet

## Notes

- This closure wave intentionally did not reopen `competitive`, `media`, or premium tracks.
- `MusicBrainz` remains the next credible open-source lane for the remaining 77 composer gaps, but only after installing a local core/canonical snapshot.
