#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const SQLITE_PATH = path.join(BACKEND_ROOT, 'storage', 'retrodex.sqlite')

function parseArgs(argv) {
  const args = {
    batchScript: null,
    withTests: false,
    dryOnly: false,
  }

  for (const token of argv.slice(2)) {
    if (token.startsWith('--script=')) {
      args.batchScript = token.slice('--script='.length)
    } else if (token === '--with-tests') {
      args.withTests = true
    } else if (token === '--dry-only') {
      args.dryOnly = true
    }
  }

  if (!args.batchScript) {
    throw new Error('Missing required --script=<batch-script>')
  }

  return args
}

function resolveBatchScript(inputPath) {
  const candidate = path.isAbsolute(inputPath) ? inputPath : path.resolve(REPO_ROOT, inputPath)
  if (!fs.existsSync(candidate)) {
    throw new Error(`Batch script not found: ${candidate}`)
  }
  return candidate
}

function runNode(args, cwd, label) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }

  return result.stdout || ''
}

function runCommand(command, args, cwd, label) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }
}

function extractJson(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Unable to parse JSON output from batch dry-run')
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

function createBackup(batchName) {
  const backupPath = path.join(
    BACKEND_ROOT,
    'storage',
    `retrodex.sqlite.backup_${timestampForBackup()}_${batchName}`
  )
  fs.copyFileSync(SQLITE_PATH, backupPath)
  return backupPath
}

function readLastAuditSummaryPath(stdout) {
  const parsed = extractJson(stdout)
  return parsed.files && parsed.files.summary ? parsed.files.summary : null
}

function main() {
  const args = parseArgs(process.argv)
  const batchScript = resolveBatchScript(args.batchScript)
  const batchName = path.basename(batchScript, '.js')

  runNode(['--check', batchScript], REPO_ROOT, 'node --check')

  const dryRunStdout = runNode([batchScript], REPO_ROOT, 'batch dry-run')
  const dryRun = extractJson(dryRunStdout)
  const ids = dryRun.summary.targets.map((target) => target.gameId)
  const idsCsv = ids.join(',')

  console.log(JSON.stringify({
    pipeline: 'composer-batch',
    batchScript,
    batchName,
    dryOnly: args.dryOnly,
    targets: ids,
    targetedGames: ids.length,
  }, null, 2))

  if (args.dryOnly) {
    return
  }

  const backupPath = createBackup(batchName)
  console.log(JSON.stringify({ backupPath }, null, 2))

  runNode([batchScript, '--apply'], REPO_ROOT, 'batch apply')
  const auditStdout = runNode([path.join(BACKEND_ROOT, 'scripts', 'run-audit.js')], BACKEND_ROOT, 'run-audit')
  const auditSummaryPath = readLastAuditSummaryPath(auditStdout)

  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-records dry-run')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), `--ids=${idsCsv}`, '--apply'], BACKEND_ROOT, 'publish-records apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'publish-records-supabase.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'publish-records post-check')

  runNode([path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'sync-supabase-ui-fields dry-run')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), `--ids=${idsCsv}`, '--apply'], BACKEND_ROOT, 'sync-supabase-ui-fields apply')
  runNode([path.join(BACKEND_ROOT, 'scripts', 'sync-supabase-ui-fields.js'), `--ids=${idsCsv}`], BACKEND_ROOT, 'sync-supabase-ui-fields post-check')

  runCommand('npm', ['run', 'smoke'], REPO_ROOT, 'npm run smoke')
  if (args.withTests) {
    runCommand('npm', ['test', '--', '--runInBand'], BACKEND_ROOT, 'npm test')
  }

  console.log(JSON.stringify({
    status: 'completed',
    batchName,
    targets: ids.length,
    backupPath,
    auditSummaryPath,
    withTests: args.withTests,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
