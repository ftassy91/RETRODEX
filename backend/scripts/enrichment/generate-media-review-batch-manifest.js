#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { writeGeneratedManifest } = require('./_manifest-output-common')

const REVIEW_QUEUE_PATH = path.join(__dirname, '..', '..', '..', 'polish-retrodex', 'outputs', 'review_queue.jsonl')

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

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

async function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Review queue not found: ${filePath}`)
  }

  const items = []
  const stream = fs.createReadStream(filePath, 'utf8')
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = String(line || '').trim()
    if (!trimmed) continue
    items.push(JSON.parse(trimmed))
  }
  return items
}

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 20)
  const source = parseStringFlag(process.argv, 'source', null)
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_media_review'))
  const rows = await readJsonLines(REVIEW_QUEUE_PATH)

  const selected = rows
    .filter((row) => !source || String(row.source_name || '').toLowerCase() === String(source).toLowerCase())
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No media review candidates matched the requested filters')
  }

  const manifest = {
    batchKey,
    batchType: 'media',
    reviewStatus: 'review_required',
    notes: `Generated media review batch from polish-retrodex review queue (${selected.length} targets)`,
    generatedFrom: {
      source: 'polish_retrodex_review_queue',
      filters: {
        limit,
        source,
      },
      generatedAt: new Date().toISOString(),
    },
    sources: ['polish_retrodex_review_queue'],
    writeTargets: ['media_references', 'source_records', 'field_provenance'],
    publishDomains: ['media'],
    postChecks: ['media'],
    ids: Array.from(new Set(selected.map((row) => String(row.game_id || row.proposed_game_id || '')).filter(Boolean))),
    payload: selected.map((row) => ({
      gameId: String(row.game_id || row.proposed_game_id || ''),
      sourceName: row.source_name || null,
      assetType: row.asset_type || null,
      sourceRecordId: row.source_record_id || null,
      externalUrl: row.external_url || null,
      previewUrl: row.preview_url || null,
      reason: row.reason || null,
      healthcheckStatus: row.healthcheck_status || null,
      raw: row,
    })),
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'media',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: selected.length,
    ids: manifest.ids,
  }, null, 2))
}

main().catch((error) => {
  console.error('[generate-media-review-batch-manifest]', error && error.stack ? error.stack : error)
  process.exit(1)
})
