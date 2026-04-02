#!/usr/bin/env node
'use strict'

const path = require('path')
const { readBatchManifest, ensureManifestRunnable } = require('./_batch-manifest-common')
const { runRichnessBatch } = require('./_richness-batch-common')

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

if (manifest.batchType !== 'richness') {
  throw new Error(`Richness batch expected batchType=richness, got ${manifest.batchType}`)
}

runRichnessBatch({
  manifestPath: manifest.manifestPath,
  argv: process.argv,
})
