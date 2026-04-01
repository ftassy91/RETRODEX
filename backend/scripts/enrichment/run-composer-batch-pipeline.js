#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { readBatchManifest } = require('./_batch-manifest-common')
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

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const SQLITE_PATH = path.join(BACKEND_ROOT, 'storage', 'retrodex.sqlite')
const APPLY_MANIFEST_SCRIPT = path.join(__dirname, 'apply-composer-batch.js')

function resolveBatchScript(inputPath) {
  const candidate = path.isAbsolute(inputPath) ? inputPath : path.resolve(REPO_ROOT, inputPath)
  if (!fs.existsSync(candidate)) {
    throw new Error(`Batch script not found: ${candidate}`)
  }
  return candidate
}

function resolveManifest(inputPath) {
  const manifest = readBatchManifest(inputPath)
  if (manifest.batchType !== 'composers') {
    throw new Error(`Composer pipeline expected batchType=composers, got ${manifest.batchType}`)
  }
  return manifest
}

function main() {
  const args = parsePipelineArgs(process.argv, { allowScript: true })
  const manifest = args.manifestPath ? resolveManifest(args.manifestPath) : null
  const batchScript = manifest ? APPLY_MANIFEST_SCRIPT : resolveBatchScript(args.batchScript)
  const batchArgs = manifest ? [batchScript, `--manifest=${manifest.manifestPath}`] : [batchScript]
  const batchName = manifest ? manifest.batchKey : path.basename(batchScript, '.js')

  runNode(['--check', batchScript], REPO_ROOT, 'node --check')
  const dryRunStdout = runNode(batchArgs, REPO_ROOT, 'batch dry-run')
  const dryRun = extractJson(dryRunStdout, 'Unable to parse JSON output from batch dry-run')
  const ids = dryRun.summary.targets.map((target) => target.gameId)
  const idsCsv = ids.join(',')

  console.log(JSON.stringify({
    pipeline: 'composer-batch',
    batchScript: manifest ? manifest.manifestPath : batchScript,
    batchName,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
  }, null, 2))

  if (args.dryOnly) return

  return withBatchRegistry({
    pipeline: 'composer-batch',
    batchKey: batchName,
    batchType: 'composers',
    manifestPath: manifest ? manifest.manifestPath : null,
    targetCount: ids.length,
    ids,
    dryOnly: args.dryOnly,
    withTests: args.withTests,
  }, () => {
    const backupPath = createBackup(SQLITE_PATH, BACKEND_ROOT, batchName)
    console.log(JSON.stringify({ backupPath }, null, 2))

    runNode([...batchArgs, '--apply'], REPO_ROOT, 'batch apply')
    const auditStdout = runNode([path.join(BACKEND_ROOT, 'scripts', 'run-audit.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'run-audit')
    const auditSummaryPath = readAuditSummaryPath(auditStdout)

    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-records')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-credits-music-supabase.js'), idsCsv, BACKEND_ROOT, 'publish-credits-music')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), idsCsv, BACKEND_ROOT, 'sync-supabase-ui-fields')
    runPostValidation(BACKEND_ROOT, args.withTests)

    console.log(JSON.stringify({
      status: 'completed',
      batchName,
      targets: ids.length,
      backupPath,
      auditSummaryPath,
      withTests: args.withTests,
    }, null, 2))

    return {
      backupPath,
      auditSummaryPath,
      publishDomains: ['records', 'credits_music', 'ui'],
      postChecks: ['records', 'credits_music', 'ui'],
    }
  })
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
