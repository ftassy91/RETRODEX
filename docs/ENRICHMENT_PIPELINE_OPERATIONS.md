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

## Candidate manifest generators

Composer candidates from audit:

```powershell
node backend/scripts/enrichment/generate-enrichment-batch-manifest.js --type=composers --limit=15 --tier=Tier A
```

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

Generated manifests are written to:

- `backend/scripts/enrichment/manifests/generated`

They are created with `reviewStatus=review_required` and are intentionally not runnable until completed.
Use `--ready` only for a reviewed batch you intend to validate immediately.

## Manifest inspection

Check whether a manifest is actually runnable:

```powershell
node backend/scripts/enrichment/inspect-enrichment-manifest.js --manifest=backend/scripts/enrichment/manifests/generated/<file>.json
```

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

## Current rule

New enrichment work should prefer:

1. generated or hand-authored manifests
2. canonical runners
3. canonical tables first
4. targeted publication and post-checks
5. batch run registry in `backend/data/enrichment/batch_runs.jsonl` for pipeline lifecycle visibility

New one-off `apply-g*` scripts should be treated as legacy compatibility, not the default path.
