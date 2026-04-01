#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { writeGeneratedManifest } = require('./_manifest-output-common')
const { FIELD_NAME_BY_MEDIA_TYPE } = require('./_media-batch-common')

const EXTERNAL_ASSETS_PATH = path.join(__dirname, '..', '..', '..', 'polish-retrodex', 'outputs', 'external_assets.jsonl')
const UI_PAYLOADS_PATH = path.join(__dirname, '..', '..', '..', 'polish-retrodex', 'outputs', 'ui_payloads.jsonl')

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

function parseBooleanFlag(argv, name) {
  return argv.includes(`--${name}`)
}

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

async function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required JSONL file not found: ${filePath}`)
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

function normalizeUiAllowed(value) {
  if (value === true || value === false) return value
  const normalized = String(value || '').trim().toLowerCase()
  return ['1', 'true', 'yes'].includes(normalized)
}

function detectLatestRunId(rows) {
  const latest = rows
    .filter((row) => row.run_id)
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0]
  return latest ? String(latest.run_id) : null
}

function buildUiPayloadIndex(rows, runId) {
  const index = new Map()
  for (const row of rows) {
    if (runId && row.run_id !== runId) continue
    const gameId = String(row.game_id || '').trim()
    if (!gameId) continue
    const groups = ['maps', 'manuals', 'sprites', 'assets']
    for (const group of groups) {
      for (const item of Array.isArray(row.external_assets?.[group]) ? row.external_assets[group] : []) {
        const key = `${gameId}::${String(item.url || '').trim()}::${String(item.type || '').trim()}`
        index.set(key, {
          uiAllowed: normalizeUiAllowed(item.ui_allowed),
          previewUrl: item.preview_url || null,
          uiBucket: group,
        })
      }
    }
  }
  return index
}

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 20)
  const source = parseStringFlag(process.argv, 'source', null)
  const mediaType = parseStringFlag(process.argv, 'media-type', null)
  const explicitRunId = parseStringFlag(process.argv, 'run-id', null)
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_media_review'))
  const ready = parseBooleanFlag(process.argv, 'ready')

  const [externalRows, uiPayloadRows] = await Promise.all([
    readJsonLines(EXTERNAL_ASSETS_PATH),
    readJsonLines(UI_PAYLOADS_PATH),
  ])

  const runId = explicitRunId || detectLatestRunId(externalRows)
  const uiPayloadIndex = buildUiPayloadIndex(uiPayloadRows, runId)

  const selected = externalRows
    .filter((row) => !runId || row.run_id === runId)
    .filter((row) => !source || String(row.source_name || '').toLowerCase() === String(source).toLowerCase())
    .filter((row) => !mediaType || String(row.asset_type || '').toLowerCase() === String(mediaType).toLowerCase())
    .filter((row) => String(row.game_id || '').trim())
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No media review candidates matched the requested filters')
  }

  const payload = selected.map((row) => {
    const resolvedMediaType = String(row.asset_type || '').trim().toLowerCase()
    const resolvedSubtype = String(row.asset_subtype || resolvedMediaType).trim()
    const key = `${String(row.game_id || '').trim()}::${String(row.external_url || '').trim()}::${resolvedSubtype}`
    const uiEntry = uiPayloadIndex.get(key)
    return {
      gameId: String(row.game_id).trim(),
      title: row.title || null,
      mediaType: resolvedMediaType,
      sourceField: FIELD_NAME_BY_MEDIA_TYPE[resolvedMediaType] || `${resolvedMediaType}_reference`,
      provider: row.source_name || null,
      sourceType: 'external_reference',
      sourceUrl: row.source_page_url || row.external_url || null,
      url: row.external_url || null,
      previewUrl: row.preview_url || uiEntry?.previewUrl || null,
      assetSubtype: row.asset_subtype || null,
      complianceStatus: row.license_status === 'blocked' ? 'blocked' : 'approved_with_review',
      licenseStatus: row.license_status || 'reference_only',
      uiAllowed: uiEntry ? uiEntry.uiAllowed : normalizeUiAllowed(row.ui_allowed),
      healthcheckStatus: row.healthcheck_status || 'unchecked',
      confidenceLevel: 0.74,
      notes: row.notes || null,
      sourceContext: {
        run_id: row.run_id || null,
        source_record_id: row.source_record_id || null,
        asset_id: row.asset_id || null,
        ui_bucket: uiEntry?.uiBucket || null,
        schema_version: row.schema_version || null,
      },
      lastCheckedAt: row.published_at || row.created_at || null,
    }
  })

  const manifest = {
    batchKey,
    batchType: 'media',
    reviewStatus: ready ? 'ready' : 'review_required',
    notes: `Generated media review batch from polish-retrodex external assets (${payload.length} entries)`,
    generatedFrom: {
      source: 'polish_retrodex_external_assets',
      filters: {
        limit,
        source,
        mediaType,
        runId,
      },
      generatedAt: new Date().toISOString(),
    },
    sources: ['polish_retrodex_external_assets', 'polish_retrodex_ui_payloads'],
    writeTargets: ['media_references', 'source_records', 'field_provenance'],
    publishDomains: ['media'],
    postChecks: ['media'],
    ids: Array.from(new Set(payload.map((entry) => entry.gameId))),
    payload,
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'media',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: payload.length,
    ids: manifest.ids,
    runId,
  }, null, 2))
}

main().catch((error) => {
  console.error('[generate-media-review-batch-manifest]', error && error.stack ? error.stack : error)
  process.exit(1)
})
