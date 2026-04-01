#!/usr/bin/env node
'use strict'

const path = require('path')
const { readBatchManifest, ensureManifestRunnable } = require('./_batch-manifest-common')
const { runComposerBatch } = require('./_composer-batch-common')

function parseManifestArg(argv) {
  const token = argv.find((value) => value.startsWith('--manifest='))
  if (!token) {
    throw new Error('Missing required --manifest=<json-manifest>')
  }
  return token.slice('--manifest='.length)
}

const manifestPath = parseManifestArg(process.argv)
const manifest = readBatchManifest(
  path.isAbsolute(manifestPath)
    ? manifestPath
    : path.resolve(process.cwd(), manifestPath)
)
ensureManifestRunnable(manifest)

if (manifest.batchType !== 'composers') {
  throw new Error(`Composer batch expected batchType=composers, got ${manifest.batchType}`)
}

runComposerBatch({
  batchKey: manifest.batchKey,
  notes: manifest.notes,
  payload: manifest.payload,
  argv: process.argv,
})
