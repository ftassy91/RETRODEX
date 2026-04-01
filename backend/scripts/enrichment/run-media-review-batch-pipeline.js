#!/usr/bin/env node
'use strict'

const path = require('path')
const { readManifest, SQLITE_PATH } = require('./_media-batch-common')
const { ensureManifestRunnable } = require('./_batch-manifest-common')
const {
  createBackup,
  extractJson,
  parsePipelineArgs,
  runNode,
  runPostValidation,
  runPublishSequence,
  withBatchRegistry,
} = require('./_batch-pipeline-common')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const APPLY_SCRIPT = path.join(__dirname, 'apply-media-batch.js')

function main() {
  const args = parsePipelineArgs(process.argv)
  const manifest = readManifest(args.manifestPath)
  ensureManifestRunnable(manifest)

  runNode(['--check', APPLY_SCRIPT], REPO_ROOT, 'node --check apply-media-batch')

  const dryRunStdout = runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`], REPO_ROOT, 'media batch dry-run')
  const dryRun = extractJson(dryRunStdout)
  const ids = Array.from(new Set((dryRun.summary?.targets || []).map((target) => target.gameId)))
  const idsCsv = ids.join(',')

  console.log(JSON.stringify({
    pipeline: 'media-batch',
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
  }, null, 2))

  if (args.dryOnly) return

  return withBatchRegistry({
    pipeline: 'media-batch',
    batchKey: manifest.batchKey,
    batchType: manifest.batchType,
    manifestPath: manifest.manifestPath,
    targetCount: ids.length,
    ids,
    dryOnly: args.dryOnly,
    withTests: args.withTests,
  }, () => {
    const backupPath = createBackup(SQLITE_PATH, BACKEND_ROOT, manifest.batchKey)
    console.log(JSON.stringify({ backupPath }, null, 2))

    runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`, '--apply'], REPO_ROOT, 'media batch apply')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-media-references-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-media')
    runPostValidation(BACKEND_ROOT, args.withTests)

    console.log(JSON.stringify({
      status: 'completed',
      batchKey: manifest.batchKey,
      targets: ids.length,
      backupPath,
      withTests: args.withTests,
    }, null, 2))

    return {
      backupPath,
      publishDomains: ['media'],
      postChecks: ['media'],
    }
  })
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
