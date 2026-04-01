#!/usr/bin/env node
'use strict'

const { runMediaBatch } = require('./_media-batch-common')

function parseArgs(argv) {
  const token = argv.find((value) => String(value).startsWith('--manifest='))
  if (!token) {
    throw new Error('Missing required --manifest=<json-manifest>')
  }
  return token.slice('--manifest='.length)
}

try {
  const manifestPath = parseArgs(process.argv.slice(2))
  runMediaBatch({ manifestPath, argv: process.argv })
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
