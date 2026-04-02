#!/usr/bin/env node
'use strict'

const path = require('path')
const { readManifest, SQLITE_PATH } = require('./_richness-batch-common')
const { ensureManifestRunnable } = require('./_batch-manifest-common')
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
const APPLY_SCRIPT = path.join(__dirname, 'apply-richness-batch.js')

const PUBLISHERS = {
  records: path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'),
  editorial: path.join(BACKEND_ROOT, 'scripts', 'publish-editorial-supabase.js'),
  media: path.join(BACKEND_ROOT, 'scripts', 'publish-media-references-supabase.js'),
  ui: path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'),
  competitive: path.join(BACKEND_ROOT, 'scripts', 'publish-competitive-supabase.js'),
}

function idsCsvFromDryRun(stdout) {
  const parsed = extractJson(stdout)
  const ids = (parsed.summary?.targets || []).map((target) => target.gameId).filter(Boolean)
  return { ids, idsCsv: ids.join(',') }
}

function runPublishers(domains, idsCsv) {
  const completed = []
  for (const domain of domains) {
    const scriptPath = PUBLISHERS[domain]
    if (!scriptPath) continue
    runPublishSequence(scriptPath, idsCsv, BACKEND_ROOT, `publish-${domain}`)
    completed.push(domain)
  }
  return completed
}

function main() {
  const args = parsePipelineArgs(process.argv)
  const manifest = readManifest(args.manifestPath)
  ensureManifestRunnable(manifest)

  runNode(['--check', APPLY_SCRIPT], REPO_ROOT, 'node --check apply-richness-batch')
  runNode(['--check', __filename], REPO_ROOT, 'node --check run-richness-batch-pipeline')

  const dryRunStdout = runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`], REPO_ROOT, 'richness batch dry-run')
  const { ids, idsCsv } = idsCsvFromDryRun(dryRunStdout)

  console.log(JSON.stringify({
    pipeline: 'richness-batch',
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
    publishDomains: manifest.publishDomains,
  }, null, 2))

  if (args.dryOnly) return

  return withBatchRegistry({
    pipeline: 'richness-batch',
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

    runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`, '--apply'], REPO_ROOT, 'richness batch apply')
    const auditStdout = runNode([path.join(BACKEND_ROOT, 'scripts', 'run-audit.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'run-audit')
    const auditSummaryPath = readAuditSummaryPath(auditStdout)
    const publishDomains = runPublishers(manifest.publishDomains || [], idsCsv)
    runPostValidation(BACKEND_ROOT, args.withTests)

    console.log(JSON.stringify({
      status: 'completed',
      batchKey: manifest.batchKey,
      targets: ids.length,
      backupPath,
      auditSummaryPath,
      publishDomains,
      withTests: args.withTests,
    }, null, 2))

    return {
      backupPath,
      auditSummaryPath,
      publishDomains,
      postChecks: manifest.postChecks || [],
    }
  })
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
