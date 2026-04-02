#!/usr/bin/env node
'use strict'

const fs = require('fs')
const { finalizeManifest, readBatchManifest } = require('./_batch-manifest-common')

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

function writeReadyManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifest = readBatchManifest(args.manifestPath)
  const rawManifest = JSON.parse(fs.readFileSync(manifest.manifestPath, 'utf8'))
  const finalized = finalizeManifest(rawManifest, manifest.manifestPath, { promoteReady: args.writeReady })
  const issues = finalized.issues
  const runnable = finalized.runnable

  if (args.writeReady) {
    if (!runnable) {
      throw new Error('Manifest is not complete enough to mark as ready')
    }
    writeReadyManifest(manifest.manifestPath, finalized.manifest)
  }

  console.log(JSON.stringify({
    manifestPath: manifest.manifestPath,
    batchKey: finalized.manifest.batchKey,
    batchType: finalized.manifest.batchType,
    reviewStatus: finalized.manifest.reviewStatus,
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
