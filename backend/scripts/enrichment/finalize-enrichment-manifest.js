#!/usr/bin/env node
'use strict'

const fs = require('fs')
const { finalizeManifest, resolveManifestPath } = require('./_batch-manifest-common')

function parseArgs(argv) {
  const manifestToken = argv.find((value) => String(value).startsWith('--manifest='))
  if (!manifestToken) {
    throw new Error('Missing required --manifest=<json-manifest>')
  }

  const check = argv.includes('--check')
  const write = argv.includes('--write')
  const writeReady = argv.includes('--write-ready')
  const printJson = argv.includes('--print-json')

  if (write && writeReady) {
    throw new Error('Use either --write or --write-ready, not both')
  }

  return {
    manifestPath: manifestToken.slice('--manifest='.length),
    check: check || (!write && !writeReady),
    write,
    writeReady,
    printJson,
  }
}

function writeManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifestPath = resolveManifestPath(args.manifestPath)
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const finalized = finalizeManifest(parsed, manifestPath, { promoteReady: args.writeReady })

  if ((args.write || args.writeReady) && (!args.writeReady || finalized.runnable)) {
    writeManifest(manifestPath, finalized.manifest)
  }

  const output = {
    manifestPath,
    batchKey: finalized.manifest.batchKey,
    batchType: finalized.manifest.batchType,
    reviewStatus: finalized.manifest.reviewStatus,
    runnable: finalized.runnable,
    issueCount: finalized.issues.length,
    issues: finalized.issues,
    ids: finalized.manifest.ids,
  }

  if (args.printJson || args.check || args.write || args.writeReady) {
    console.log(JSON.stringify(output, null, 2))
  }

  if (args.writeReady && !finalized.runnable) {
    throw new Error('Manifest is not complete enough to mark as ready')
  }
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
