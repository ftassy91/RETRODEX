# Enrichment Pipeline Operations

## Canonical batch unit

RetroDex enrichment batches now use a manifest-first model.

Required manifest fields:

- `batchKey`
- `batchType`
- `reviewStatus`
- `payload`

Optional operational fields:

- `ids`
- `sources`
- `writeTargets`
- `publishDomains`
- `postChecks`
- `generatedFrom`
- `notes`

`reviewStatus=ready` means the manifest can be executed.
`reviewStatus=review_required` means the manifest is a generated candidate and must be completed before apply/publish.

Supported `batchType` values today:

- `premium`
- `composers`
- `summary`
- `dev_team`
- `media`
- `competitive`

## Canonical runners

Generic dispatcher:

```powershell
node backend/scripts/enrichment/run-enrichment-batch-pipeline.js --manifest=backend/scripts/enrichment/manifests/<file>.json
```

With full tests:

```powershell
node backend/scripts/enrichment/run-enrichment-batch-pipeline.js --manifest=backend/scripts/enrichment/manifests/<file>.json --with-tests
```

Type-specific runners still exist:

- `run-composer-batch-pipeline.js`
- `run-premium-batch-pipeline.js`
- `run-summary-batch-pipeline.js`
- `run-dev-team-batch-pipeline.js`
- `run-media-review-batch-pipeline.js`
- `run-competitive-batch-pipeline.js`

## Top 1000 work catalog

Freeze the current working population from the latest audit:

```powershell
node backend/scripts/enrichment/generate-top-1000-work-catalog.js
```

The generated catalog is written under:

- `backend/data/audit/top1000`

It records:

- the selected `top1000`
- a `buffer` of the remaining Tier A candidates
- score and curation context needed to keep enrichment batches focused on the canonical 1000-game target

## Candidate manifest generators

Composer candidates from audit:

```powershell
node backend/scripts/enrichment/generate-enrichment-batch-manifest.js --type=composers --limit=15 --tier=Tier A
```

Composer candidates with strict internal autofill, directly runnable if every target is already covered by canonical or legacy local data:

```powershell
node backend/scripts/enrichment/generate-composer-batch-manifest.js --ids=art-of-fighting-sega-genesis,blackthorne-super-nintendo --allow-explicit-ids --autofill-safe --ready-if-complete
```

Strict internal autofill for `composers` is intentionally limited to:

- canonical local credits from `game_people(role=composer)` + `people`
- existing local `games.ost_composers`

It does not infer from `dev_team`, studios, sound teams, or any external heuristics.

Dev team candidates from audit:

```powershell
node backend/scripts/enrichment/generate-enrichment-batch-manifest.js --type=dev_team --limit=15 --tier=Tier A
```

Dev team candidates with safe master-data autofill, directly runnable if complete:

```powershell
node backend/scripts/enrichment/generate-dev-team-batch-manifest.js --ids=game-a,game-b --allow-explicit-ids --autofill-safe --ready-if-complete
```

Summary candidates from audit:

```powershell
node backend/scripts/enrichment/generate-enrichment-batch-manifest.js --type=summary --limit=15 --published-only
```

Premium candidates from coverage:

```powershell
node backend/scripts/enrichment/generate-enrichment-batch-manifest.js --type=premium --limit=10 --from-tier=bronze
```

Media review candidates from `polish-retrodex`:

```powershell
node backend/scripts/enrichment/generate-enrichment-batch-manifest.js --type=media --limit=20
```

Ready-to-run media candidate from `polish-retrodex external_assets`:

```powershell
node backend/scripts/enrichment/generate-media-review-batch-manifest.js --source=vgmuseum --media-type=ending --limit=10 --ready
```

Competitive candidates from `speedrun.com` for reviewed target ids:

```powershell
node backend/scripts/enrichment/generate-competitive-speedrun-batch-manifest.js --ids=super-mario-64-nintendo-64,wave-race-64-nintendo-64 --top-categories=3 --top-records=5 --ready-if-complete
```

Competitive candidates from `RetroAchievements` require an API key and an explicit local mapping file:

```powershell
node backend/scripts/enrichment/generate-competitive-ra-batch-manifest.js --ids=f-zero-x-nintendo-64 --mapping=backend/data/competitive/retroachievements-mapping.json --ready-if-complete
```

Requirements for the RetroAchievements generator:

- `RETROACHIEVEMENTS_API_KEY` must be set
- the mapping file must resolve RetroDex `gameId -> retroachievements game id`
- the generator remains non-mutating until the manifest is executed

Generated manifests are written to:

- `backend/scripts/enrichment/manifests/generated`

Generated manifests default to `reviewStatus=review_required` and are intentionally not runnable until completed.
Some generators can emit `ready` directly when every target is already fully auto-filled from safe internal data.
Use `--ready` or `--ready-if-complete` only for a reviewed batch you intend to validate immediately.

## Manifest inspection

Check whether a manifest is actually runnable:

```powershell
node backend/scripts/enrichment/inspect-enrichment-manifest.js --manifest=backend/scripts/enrichment/manifests/generated/<file>.json
```

## Manifest finalization

Normalize a generated manifest without changing its review state:

```powershell
node backend/scripts/enrichment/finalize-enrichment-manifest.js --manifest=backend/scripts/enrichment/manifests/generated/<file>.json --write
```

Normalize and promote to `ready` only if the manifest is fully runnable:

```powershell
node backend/scripts/enrichment/finalize-enrichment-manifest.js --manifest=backend/scripts/enrichment/manifests/generated/<file>.json --write-ready
```

Recommended workflow:

1. generate
2. inspect
3. finalize
4. execute through the generic dispatcher

The roles are now distinct:

- generator: prepares a candidate batch
- inspector: reports whether a manifest is runnable
- finalizer: normalizes and conditionally promotes to `ready`
- runner: executes `apply -> validation -> publish -> post-check`

## Batch registry reporting

Summarize recent pipeline executions:

```powershell
node backend/scripts/enrichment/report-enrichment-batch-runs.js --limit=10
```

## Scoped validation

Targeted audit:

```powershell
node backend/scripts/run-audit.js --ids=game-a,game-b
```

Targeted premium coverage:

```powershell
node backend/scripts/enrichment/recompute-enrichment-coverage.js --ids=game-a,game-b
```

Competitive publish post-check:

```powershell
node backend/scripts/publish-competitive-supabase.js --ids=game-a,game-b
```

## Current rule

New enrichment work should prefer:

1. generated or hand-authored manifests
2. canonical runners
3. canonical tables first
4. targeted publication and post-checks
5. batch run registry in `backend/data/enrichment/batch_runs.jsonl` for pipeline lifecycle visibility

New one-off `apply-g*` scripts should be treated as legacy compatibility, not the default path.
