# Top1200 Credits Restart Wave

Date: 2026-04-02

## Objective

Resume `top1200` credit enrichment after the initial closure wave, keep `1200/1200 complete-or-better`, and reduce composer debt only through safe open-source yield.

## Starting Point

Measured before this wave:

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 75`

## Changes Executed

### Tooling fixes

- Patched [generate-wikidata-credit-manifests.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/generate-wikidata-credit-manifests.js) so it only loads `*_wikidata_credit_snapshot.json` files and fails clearly if the snapshot shape is invalid.
- Extended [bootstrap-wikidata-credit-snapshot.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/bootstrap-wikidata-credit-snapshot.js) to include more Wikipedia language lanes in the base snapshot sweep.

### New safe-yield extender

- Added [extend-wikidata-composer-snapshot.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/extend-wikidata-composer-snapshot.js).
- The extender:
  - revisits blocked composer entries that already have a `wikidataQid`
  - scans all usable Wikipedia sitelinks, not just the base language subset
  - broadens composer field aliases
  - filters template-noise false positives before candidate promotion

### Wave applied

- Generated one reviewed safe delta manifest for:
  - `64-ozumo-nintendo-64`
  - `babe-and-friends-game-boy-color`
- Published via the composer pipeline with provenance, people bindings, record publication, UI sync, and tests.

## Outcome

Measured after the wave with [report-top1200-progress.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/scripts/enrichment/report-top1200-progress.js) against [2026-04-02T06-18-44-327Z_games.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/data/audit/2026-04-02T06-18-44-327Z_games.json):

- `top1200.complete_or_better = 1200/1200`
- `top1200.missingDevTeam = 0`
- `top1200.missingComposers = 73`

Net gain for this restart wave:

- `composers`: `75 -> 73`

## Residue

Updated blocked residue:

- [2026-04-02T06-19-07-487Z_top1200_credit_blocked_residue.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/data/enrichment/credits/2026-04-02T06-19-07-487Z_top1200_credit_blocked_residue.json)

Current blocked summary:

- `devTeamBlocked = 0`
- `composersBlocked = 73`

## Notes

- One additional localized composer candidate was intentionally left out of the applied batch because the recovered name was not yet canonicalized safely enough for production use.
- This wave stayed inside the same doctrine:
  - no `competitive` reopening
  - no media expansion
  - no speculative source usage
  - no MusicBrainz web-service fallback
