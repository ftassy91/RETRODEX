#!/usr/bin/env node
'use strict'

const path = require('path')
const { readManifest, SQLITE_PATH } = require('./_premium-uplift-common')
const { ensureManifestRunnable } = require('./_batch-manifest-common')
const {
  createBackup,
  extractJson,
  parsePipelineArgs,
  readCoverageSummaryPath,
  runNode,
  runPostValidation,
  runPublishSequence,
  withBatchRegistry,
} = require('./_batch-pipeline-common')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const APPLY_SCRIPT = path.join(__dirname, 'apply-premium-uplift-batch.js')

function idsCsvFromDryRun(stdout) {
  const parsed = extractJson(stdout)
  const ids = (parsed.summary?.targets || []).map((target) => target.gameId)
  return { ids, idsCsv: ids.join(',') }
}

function main() {
  const args = parsePipelineArgs(process.argv)
  const manifest = readManifest(args.manifestPath)
  ensureManifestRunnable(manifest)

  runNode(['--check', APPLY_SCRIPT], REPO_ROOT, 'node --check apply-premium-uplift-batch')
  runNode(['--check', __filename], REPO_ROOT, 'node --check run-premium-batch-pipeline')

  const dryRunStdout = runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`], REPO_ROOT, 'premium batch dry-run')
  const { ids, idsCsv } = idsCsvFromDryRun(dryRunStdout)

  console.log(JSON.stringify({
    pipeline: 'premium-batch',
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
  }, null, 2))

  if (args.dryOnly) return

  return withBatchRegistry({
    pipeline: 'premium-batch',
    batchKey: manifest.batchKey,
    batchType: 'premium',
    manifestPath: manifest.manifestPath,
    targetCount: ids.length,
    ids,
    dryOnly: args.dryOnly,
    withTests: args.withTests,
  }, () => {
    const backupPath = createBackup(SQLITE_PATH, BACKEND_ROOT, manifest.batchKey)
    console.log(JSON.stringify({ backupPath }, null, 2))

    runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`, '--apply'], REPO_ROOT, 'premium batch apply')
    const coverageStdout = runNode([path.join(BACKEND_ROOT, 'scripts', 'enrichment', 'recompute-enrichment-coverage.js'), `--ids=${idsCsv}`, '--candidate-limit=50', '--sample-limit=20'], BACKEND_ROOT, 'recompute-enrichment-coverage')
    const coverageSummaryPath = readCoverageSummaryPath(coverageStdout)

    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-records')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-editorial-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-editorial')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-media-references-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-media')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), idsCsv, BACKEND_ROOT, 'sync-supabase-ui-fields')
    runPostValidation(BACKEND_ROOT, args.withTests)

    console.log(JSON.stringify({
      status: 'completed',
      batchKey: manifest.batchKey,
      targets: ids.length,
      backupPath,
      coverageSummaryPath,
      withTests: args.withTests,
    }, null, 2))

    return {
      backupPath,
      coverageSummaryPath,
      publishDomains: ['records', 'editorial', 'media', 'ui'],
      postChecks: ['records', 'editorial', 'media', 'ui'],
    }
  })
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
