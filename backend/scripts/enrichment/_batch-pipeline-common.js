'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { recordBatchEvent, sanitizeError } = require('./_batch-run-registry')

function parsePipelineArgs(argv, { allowScript = false } = {}) {
  const args = {
    manifestPath: null,
    batchScript: null,
    withTests: false,
    dryOnly: false,
  }

  for (const token of argv.slice(2)) {
    if (allowScript && token.startsWith('--script=')) {
      args.batchScript = token.slice('--script='.length)
    } else if (token.startsWith('--manifest=')) {
      args.manifestPath = token.slice('--manifest='.length)
    } else if (token === '--with-tests') {
      args.withTests = true
    } else if (token === '--dry-only') {
      args.dryOnly = true
    }
  }

  if (!args.manifestPath && !(allowScript && args.batchScript)) {
    throw new Error(allowScript
      ? 'Missing required --script=<batch-script> or --manifest=<json-manifest>'
      : 'Missing required --manifest=<json-manifest>')
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

function extractJson(stdout, errorLabel = 'Unable to parse JSON output') {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(errorLabel)
  }
  return JSON.parse(stdout.slice(start, end + 1))
}

function timestampForBackup() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function createBackup(sqlitePath, backendRoot, batchKey) {
  const backupPath = path.join(backendRoot, 'storage', `retrodex.sqlite.backup_${timestampForBackup()}_${batchKey}`)
  fs.copyFileSync(sqlitePath, backupPath)
  return backupPath
}

function readAuditSummaryPath(stdout) {
  const parsed = extractJson(stdout)
  return parsed.files && parsed.files.summary ? parsed.files.summary : null
}

function readCoverageSummaryPath(stdout) {
  const parsed = extractJson(stdout)
  return parsed.files && parsed.files.summary ? parsed.files.summary : null
}

function collectPendingMarkers(value, pathParts = []) {
  const entries = []
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      entries.push(...collectPendingMarkers(entry, [...pathParts, String(index)]))
    })
    return entries
  }

  if (!value || typeof value !== 'object') {
    return entries
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...pathParts, key]
    if ((key === 'pendingRows' || key === 'pendingUpdates') && Number.isFinite(Number(nested))) {
      entries.push({
        path: nextPath.join('.'),
        value: Number(nested),
      })
      continue
    }
    entries.push(...collectPendingMarkers(nested, nextPath))
  }

  return entries
}

function assertNoPendingMarkers(parsed, label) {
  const pending = collectPendingMarkers(parsed).filter((entry) => entry.value !== 0)
  if (pending.length) {
    throw new Error(`${label} left pending changes: ${pending.map((entry) => `${entry.path}=${entry.value}`).join(', ')}`)
  }
}

function runPublishSequence(scriptPath, idsCsv, cwd, label) {
  const baseArgs = idsCsv ? [scriptPath, `--ids=${idsCsv}`] : [scriptPath]
  runNode(baseArgs, cwd, `${label} dry-run`)
  runNode([...baseArgs, '--apply'], cwd, `${label} apply`)
  const postCheckStdout = runNode(baseArgs, cwd, `${label} post-check`)
  const postCheck = extractJson(postCheckStdout)
  assertNoPendingMarkers(postCheck, `${label} post-check`)
  return postCheck
}

function runPostValidation(backendRoot, withTests) {
  runNode([path.join(backendRoot, 'src', 'smoke-test.js')], backendRoot, 'smoke-test')
  if (withTests) {
    runNode([path.join(backendRoot, 'node_modules', 'jest', 'bin', 'jest.js'), '--runInBand'], backendRoot, 'jest')
  }
}

function withBatchRegistry(context, executor) {
  const baseEvent = {
    batchKey: context.batchKey,
    batchType: context.batchType,
    manifestPath: context.manifestPath || null,
    targetCount: context.targetCount || 0,
    ids: context.ids || [],
    dryOnly: Boolean(context.dryOnly),
    withTests: Boolean(context.withTests),
    pipeline: context.pipeline,
  }

  recordBatchEvent({
    ...baseEvent,
    event: 'pipeline_started',
    status: 'running',
  })

  try {
    const result = executor()
    recordBatchEvent({
      ...baseEvent,
      event: 'pipeline_completed',
      status: 'completed',
      backupPath: result?.backupPath || null,
      auditSummaryPath: result?.auditSummaryPath || null,
      coverageSummaryPath: result?.coverageSummaryPath || null,
      publishDomains: result?.publishDomains || [],
      postChecks: result?.postChecks || [],
    })
    return result
  } catch (error) {
    recordBatchEvent({
      ...baseEvent,
      event: 'pipeline_failed',
      status: 'failed',
      error: sanitizeError(error),
    })
    throw error
  }
}

module.exports = {
  assertNoPendingMarkers,
  createBackup,
  extractJson,
  parsePipelineArgs,
  readAuditSummaryPath,
  readCoverageSummaryPath,
  runNode,
  runPostValidation,
  runPublishSequence,
  withBatchRegistry,
}
