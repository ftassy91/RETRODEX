#!/usr/bin/env node
'use strict'

const path = require('path')
const { readBatchManifest, ensureManifestRunnable } = require('./_batch-manifest-common')
const {
  createBackup,
  extractJson,
  parsePipelineArgs,
  readAuditSummaryPath,
  runNode,
  runPostValidation,
  runPublishSequence,
  withBatchRegistry,
} = require('./_batch-pipeline-common')
const { SQLITE_PATH } = require('./_competitive-batch-common')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const APPLY_SCRIPT = path.join(__dirname, 'apply-competitive-batch.js')

function main() {
  const args = parsePipelineArgs(process.argv)
  const manifest = readBatchManifest(args.manifestPath)
  ensureManifestRunnable(manifest)

  if (manifest.batchType !== 'competitive') {
    throw new Error(`Competitive pipeline expected batchType=competitive, got ${manifest.batchType}`)
  }

  runNode(['--check', APPLY_SCRIPT], REPO_ROOT, 'node --check apply-competitive-batch')
  runNode(['--check', __filename], REPO_ROOT, 'node --check run-competitive-batch-pipeline')

  const dryRunStdout = runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`], REPO_ROOT, 'competitive batch dry-run')
  const dryRun = extractJson(dryRunStdout)
  const ids = Array.from(new Set((dryRun.summary?.targets || []).map((target) => target.gameId)))
  const idsCsv = ids.join(',')

  console.log(JSON.stringify({
    pipeline: 'competitive-batch',
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
  }, null, 2))

  if (args.dryOnly) return

  return withBatchRegistry({
    pipeline: 'competitive-batch',
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

    runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`, '--apply'], REPO_ROOT, 'competitive batch apply')
    const auditStdout = runNode([path.join(BACKEND_ROOT, 'scripts', 'run-audit.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'run-audit')
    const auditSummaryPath = readAuditSummaryPath(auditStdout)

    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-records')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-competitive-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-competitive')
    runPostValidation(BACKEND_ROOT, args.withTests)

    console.log(JSON.stringify({
      status: 'completed',
      batchKey: manifest.batchKey,
      targets: ids.length,
      backupPath,
      auditSummaryPath,
      withTests: args.withTests,
    }, null, 2))

    return {
      backupPath,
      auditSummaryPath,
      publishDomains: ['records', 'competitive'],
      postChecks: ['records', 'competitive'],
    }
  })
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
