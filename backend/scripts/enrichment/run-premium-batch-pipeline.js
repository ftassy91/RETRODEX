#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { readManifest, SQLITE_PATH } = require('./_premium-uplift-common')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const APPLY_SCRIPT = path.join(__dirname, 'apply-premium-uplift-batch.js')

function parseArgs(argv) {
  const args = {
    manifestPath: null,
    withTests: false,
    dryOnly: false,
  }

  for (const token of argv.slice(2)) {
    if (token.startsWith('--manifest=')) {
      args.manifestPath = token.slice('--manifest='.length)
    } else if (token === '--with-tests') {
      args.withTests = true
    } else if (token === '--dry-only') {
      args.dryOnly = true
    }
  }

  if (!args.manifestPath) {
    throw new Error('Missing required --manifest=<json-manifest>')
  }

  return args
}

function runNode(args, cwd, label) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }
  return result.stdout || ''
}

function extractJson(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Unable to parse JSON output')
  }
  return JSON.parse(stdout.slice(start, end + 1))
}

function timestampForBackup() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

function createBackup(batchKey) {
  const backupPath = path.join(
    BACKEND_ROOT,
    'storage',
    `retrodex.sqlite.backup_${timestampForBackup()}_${batchKey}`
  )
  fs.copyFileSync(SQLITE_PATH, backupPath)
  return backupPath
}

function idsCsvFromDryRun(stdout) {
  const parsed = extractJson(stdout)
  const ids = (parsed.summary?.targets || []).map((target) => target.gameId)
  return { ids, idsCsv: ids.join(',') }
}

function main() {
  const args = parseArgs(process.argv)
  const manifest = readManifest(args.manifestPath)

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

  if (args.dryOnly) {
    return
  }

  const backupPath = createBackup(manifest.batchKey)
  console.log(JSON.stringify({ backupPath }, null, 2))

  runNode([APPLY_SCRIPT, `--manifest=${manifest.manifestPath}`, '--apply'], REPO_ROOT, 'premium batch apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'enrichment', 'recompute-enrichment-coverage.js'), '--candidate-limit=50', '--sample-limit=20'], BACKEND_ROOT, 'recompute-enrichment-coverage')

  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-records dry-run')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), `--ids=${idsCsv}`, '--apply'], BACKEND_ROOT, 'publish-records apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-records post-check')

  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-editorial-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-editorial dry-run')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-editorial-supabase.js'), `--ids=${idsCsv}`, '--apply'], BACKEND_ROOT, 'publish-editorial apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-editorial-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-editorial post-check')

  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-media-references-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-media dry-run')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-media-references-supabase.js'), `--ids=${idsCsv}`, '--apply'], BACKEND_ROOT, 'publish-media apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-media-references-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-media post-check')

  runNode([path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'sync-supabase-ui-fields dry-run')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), `--ids=${idsCsv}`, '--apply'], BACKEND_ROOT, 'sync-supabase-ui-fields apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'sync-supabase-ui-fields post-check')

  runNode([path.join(BACKEND_ROOT, 'src', 'smoke-test.js')], BACKEND_ROOT, 'smoke-test')
  if (args.withTests) {
    runNode([path.join(BACKEND_ROOT, 'node_modules', 'jest', 'bin', 'jest.js'), '--runInBand'], BACKEND_ROOT, 'jest')
  }

  console.log(JSON.stringify({
    status: 'completed',
    batchKey: manifest.batchKey,
    targets: ids.length,
    backupPath,
    withTests: args.withTests,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
