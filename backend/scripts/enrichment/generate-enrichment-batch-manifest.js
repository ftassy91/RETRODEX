#!/usr/bin/env node
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const GENERATORS = {
  composers: path.join(__dirname, 'generate-composer-batch-manifest.js'),
  dev_team: path.join(__dirname, 'generate-dev-team-batch-manifest.js'),
  premium: path.join(__dirname, 'generate-premium-batch-manifest.js'),
  summary: path.join(__dirname, 'generate-summary-batch-manifest.js'),
  media: path.join(__dirname, 'generate-media-review-batch-manifest.js'),
}

function parseArgs(argv) {
  const typeToken = argv.find((value) => String(value).startsWith('--type='))
  if (!typeToken) {
    throw new Error('Missing required --type=<composers|premium>')
  }
  return {
    type: String(typeToken).slice('--type='.length).trim().toLowerCase(),
    forwarded: argv.slice(2).filter((value) => !String(value).startsWith('--type=')),
  }
}

function runNode(args, cwd, label) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }
}

function main() {
  const args = parseArgs(process.argv)
  const generator = GENERATORS[args.type]
  if (!generator) {
    throw new Error(`Unsupported generator type: ${args.type}`)
  }
  runNode([generator, ...args.forwarded], REPO_ROOT, `${args.type} manifest generator`)
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
