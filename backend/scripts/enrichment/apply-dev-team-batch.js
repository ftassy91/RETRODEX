#!/usr/bin/env node
'use strict'

const path = require('path')
const { readBatchManifest, ensureManifestRunnable } = require('./_batch-manifest-common')
const { runDevTeamBatch } = require('./_dev-team-batch-common')

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

if (manifest.batchType !== 'dev_team') {
  throw new Error(`Dev team batch expected batchType=dev_team, got ${manifest.batchType}`)
}

runDevTeamBatch({
  batchKey: manifest.batchKey,
  notes: manifest.notes,
  payload: manifest.payload,
  argv: process.argv,
})
