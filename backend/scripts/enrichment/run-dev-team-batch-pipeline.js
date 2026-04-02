#!/usr/bin/env node
'use strict'

const path = require('path')
const { readBatchManifest, ensureManifestRunnable } = require('./_batch-manifest-common')
const { SQLITE_PATH } = require('./_dev-team-batch-common')
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
const APPLY_SCRIPT = path.join(__dirname, 'apply-dev-team-batch.js')
const MAX_IDS_ARG_LENGTH = 7000

function shouldUseGlobalScope(idsCsv) {
  return !idsCsv || idsCsv.length > MAX_IDS_ARG_LENGTH
}

function main() {
  const args = parsePipelineArgs(process.argv)
  const manifest = readBatchManifest(args.manifestPath)
  ensureManifestRunnable(manifest)
  if (manifest.batchType !== 'dev_team') {
    throw new Error(`Dev team pipeline expected batchType=dev_team, got ${manifest.batchType}`)
  }

  runNode(['--check', APPLY_SCRIPT], REPO_ROOT, 'node --check')
  const dryRunStdout = runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`], REPO_ROOT, 'dev team batch dry-run')
  const dryRun = extractJson(dryRunStdout)
  const ids = dryRun.summary.targets.map((target) => target.gameId)
  const idsCsv = ids.join(',')
  const useGlobalScope = shouldUseGlobalScope(idsCsv)

  console.log(JSON.stringify({
    pipeline: 'dev-team-batch',
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
    useGlobalScope,
  }, null, 2))

  if (args.dryOnly) return

  return withBatchRegistry({
    pipeline: 'dev-team-batch',
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

    runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`, '--apply'], REPO_ROOT, 'dev team batch apply')
    const auditArgs = useGlobalScope
      ? [path.join(BACKEND_ROOT, 'scripts', 'run-audit.js')]
      : [path.join(BACKEND_ROOT, 'scripts', 'run-audit.js'), `--ids=${idsCsv}`]
    const auditStdout = runNode(auditArgs, BACKEND_ROOT, 'run-audit')
    const auditSummaryPath = readAuditSummaryPath(auditStdout)

    const publishIdsCsv = useGlobalScope ? null : idsCsv
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), publishIdsCsv, BACKEND_ROOT, 'publish-records')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'publish-credits-music-supabase.js'), publishIdsCsv, BACKEND_ROOT, 'publish-credits-music')
    runPublishSequence(path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), publishIdsCsv, BACKEND_ROOT, 'sync-supabase-ui-fields')
    runPostValidation(BACKEND_ROOT, args.withTests)

    console.log(JSON.stringify({
      status: 'completed',
      batchKey: manifest.batchKey,
      targets: ids.length,
      backupPath,
      auditSummaryPath,
      useGlobalScope,
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
