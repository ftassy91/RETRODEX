#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const REGISTRY_FILE = path.join(__dirname, '..', '..', 'data', 'enrichment', 'batch_runs.jsonl')

function parseNumberFlag(argv, name, fallback) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  const numeric = Number(String(token).split('=').slice(1).join('='))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function parseStringFlag(argv, name, fallback = null) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  return String(token).split('=').slice(1).join('=').trim() || fallback
}

async function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const rows = []
  const stream = fs.createReadStream(filePath, 'utf8')
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = String(line || '').trim()
    if (!trimmed) continue
    rows.push(JSON.parse(trimmed))
  }
  return rows
}

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 20)
  const pipeline = parseStringFlag(process.argv, 'pipeline', null)
  const rows = await readJsonLines(REGISTRY_FILE)

  const filtered = rows
    .filter((row) => !pipeline || String(row.pipeline || '') === pipeline)
    .sort((left, right) => String(right.recordedAt || '').localeCompare(String(left.recordedAt || '')))

  const latestByBatch = new Map()
  for (const row of filtered) {
    if (!latestByBatch.has(row.batchKey)) {
      latestByBatch.set(row.batchKey, row)
    }
  }

  const latest = [...latestByBatch.values()].slice(0, limit)
  const summary = {
    registryFile: REGISTRY_FILE,
    totalEvents: filtered.length,
    distinctBatches: latestByBatch.size,
    completed: [...latestByBatch.values()].filter((row) => row.status === 'completed').length,
    failed: [...latestByBatch.values()].filter((row) => row.status === 'failed').length,
    running: [...latestByBatch.values()].filter((row) => row.status === 'running').length,
    latest,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('[report-enrichment-batch-runs]', error && error.stack ? error.stack : error)
  process.exit(1)
})
