#!/usr/bin/env node
'use strict'

const fs = require('fs')
const { readBatchManifest } = require('./_batch-manifest-common')

function parseArgs(argv) {
  const manifestToken = argv.find((value) => String(value).startsWith('--manifest='))
  if (!manifestToken) {
    throw new Error('Missing required --manifest=<json-manifest>')
  }
  return {
    manifestPath: manifestToken.slice('--manifest='.length),
    writeReady: argv.includes('--write-ready'),
  }
}

function addIssue(issues, scope, message) {
  issues.push({ scope, message })
}

function inspectPremiumPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    const hasWork = Boolean(
      (typeof entry.summary === 'string' && entry.summary.trim())
      || (typeof entry.synopsis === 'string' && entry.synopsis.trim())
      || (Array.isArray(entry.media) && entry.media.length)
      || (Array.isArray(entry.ostTracks) && entry.ostTracks.length)
    )
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!hasWork) addIssue(issues, scope, 'premium payload has no actionable content')
  })
}

function inspectSummaryPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!String(entry.summary || '').trim()) addIssue(issues, scope, 'missing summary text')
    if (!String(entry.sourceName || '').trim()) addIssue(issues, scope, 'missing sourceName')
  })
}

function inspectDevTeamPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!Array.isArray(entry.devTeam) || !entry.devTeam.length) {
      addIssue(issues, scope, 'missing devTeam members')
    }
    if (!String(entry.sourceName || '').trim()) addIssue(issues, scope, 'missing sourceName')
  })
}

function inspectComposerPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!Array.isArray(entry.ostComposers) || !entry.ostComposers.length) {
      addIssue(issues, scope, 'missing composer members')
    }
    if (!String(entry.sourceName || '').trim()) addIssue(issues, scope, 'missing sourceName')
  })
}

function inspectMediaPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!String(entry.mediaType || '').trim()) addIssue(issues, scope, 'missing mediaType')
    if (!String(entry.sourceField || '').trim()) addIssue(issues, scope, 'missing sourceField')
    if (!String(entry.provider || '').trim()) addIssue(issues, scope, 'missing provider')
    if (!String(entry.url || '').trim()) addIssue(issues, scope, 'missing url')
  })
}

function inspectManifest(manifest) {
  const issues = []

  if (!manifest.batchKey) addIssue(issues, 'manifest', 'missing batchKey')
  if (!manifest.batchType) addIssue(issues, 'manifest', 'missing batchType')
  if (!Array.isArray(manifest.payload) || !manifest.payload.length) {
    addIssue(issues, 'manifest', 'missing payload entries')
    return issues
  }

  if (manifest.batchType === 'premium') inspectPremiumPayload(manifest, issues)
  else if (manifest.batchType === 'summary') inspectSummaryPayload(manifest, issues)
  else if (manifest.batchType === 'dev_team') inspectDevTeamPayload(manifest, issues)
  else if (manifest.batchType === 'composers') inspectComposerPayload(manifest, issues)
  else if (manifest.batchType === 'media') inspectMediaPayload(manifest, issues)
  else addIssue(issues, 'manifest', `unsupported batchType: ${manifest.batchType}`)

  return issues
}

function writeReadyManifest(manifestPath, manifest) {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  parsed.reviewStatus = 'ready'
  fs.writeFileSync(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifest = readBatchManifest(args.manifestPath)
  const issues = inspectManifest(manifest)
  const runnable = issues.length === 0

  if (args.writeReady) {
    if (!runnable) {
      throw new Error('Manifest is not complete enough to mark as ready')
    }
    writeReadyManifest(manifest.manifestPath, manifest)
  }

  console.log(JSON.stringify({
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    batchType: manifest.batchType,
    reviewStatus: args.writeReady && runnable ? 'ready' : manifest.reviewStatus,
    runnable,
    issueCount: issues.length,
    issues,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
