#!/usr/bin/env node
'use strict'

const path = require('path')
const { runPremiumBatch } = require('./_premium-uplift-common')

function parseManifestArg(argv) {
  const token = argv.find((value) => value.startsWith('--manifest='))
  if (!token) {
    throw new Error('Missing required --manifest=<json-manifest>')
  }
  return token.slice('--manifest='.length)
}

const manifestPath = parseManifestArg(process.argv)
runPremiumBatch({
  manifestPath: path.isAbsolute(manifestPath)
    ? manifestPath
    : path.resolve(process.cwd(), manifestPath),
  argv: process.argv,
})
