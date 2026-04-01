#!/usr/bin/env node
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')
const { readBatchManifest, ensureManifestRunnable } = require('./_batch-manifest-common')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const COMPOSER_PIPELINE = path.join(__dirname, 'run-composer-batch-pipeline.js')
const DEV_TEAM_PIPELINE = path.join(__dirname, 'run-dev-team-batch-pipeline.js')
const PREMIUM_PIPELINE = path.join(__dirname, 'run-premium-batch-pipeline.js')
const SUMMARY_PIPELINE = path.join(__dirname, 'run-summary-batch-pipeline.js')

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
}

function main() {
  const args = parseArgs(process.argv)
  const manifest = readBatchManifest(args.manifestPath)
  ensureManifestRunnable(manifest)
  const forwarded = [`--manifest=${manifest.manifestPath}`]
  if (args.withTests) forwarded.push('--with-tests')
  if (args.dryOnly) forwarded.push('--dry-only')

  if (manifest.batchType === 'composers') {
    runNode([COMPOSER_PIPELINE, ...forwarded], REPO_ROOT, 'composer pipeline')
    return
  }

  if (manifest.batchType === 'dev_team') {
    runNode([DEV_TEAM_PIPELINE, ...forwarded], REPO_ROOT, 'dev team pipeline')
    return
  }

  if (manifest.batchType === 'premium') {
    runNode([PREMIUM_PIPELINE, ...forwarded], REPO_ROOT, 'premium pipeline')
    return
  }

  if (manifest.batchType === 'summary') {
    runNode([SUMMARY_PIPELINE, ...forwarded], REPO_ROOT, 'summary pipeline')
    return
  }

  throw new Error(`Unsupported manifest batchType for generic pipeline: ${manifest.batchType}`)
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
