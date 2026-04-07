#!/usr/bin/env node
'use strict'

/**
 * apply-source-facts.js
 *
 * Applies a source-facts manifest to the local SQLite database.
 * Facts are extracted from external sources (podcasts, YouTube, forums)
 * and stored with full provenance (source_records + field_provenance).
 *
 * Manifest format: manifests/source-facts-*.json
 * Schema example:  manifests/source-facts-example.json
 *
 * Usage:
 *   node apply-source-facts.js --manifest=manifests/source-facts-batch-NAME.json
 *   node apply-source-facts.js --manifest=manifests/source-facts-batch-NAME.json --apply
 *
 * Supported targetFields:
 *   dev_anecdotes  — JSON array of { title, text }         (default for most categories)
 *   cheat_codes    — JSON array of { name, code, effect }
 *   versions       — JSON array of { title, description }
 *   dev_team       — JSON array of { name, role }
 *   ost_composers  — JSON array of { name, role }
 *   ost_notable_tracks — JSON array of strings
 *
 * Category → targetField defaults (overridden by explicit targetField):
 *   dev, technique, histoire, historique, contexte, OST, gameplay → dev_anecdotes
 *   cheat → cheat_codes
 *   version, edition → versions
 *   credits → dev_team
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// ---------------------------------------------------------------------------
// CLI — manifest path
// ---------------------------------------------------------------------------

function parseManifestPath() {
  const arg = process.argv.find((a) => a.startsWith('--manifest='))
  if (!arg) {
    console.error('Error: --manifest=<path> is required')
    console.error('Example: node apply-source-facts.js --manifest=manifests/source-facts-batch-retronauts.json')
    process.exit(1)
  }
  const rel = arg.slice('--manifest='.length)
  const abs = path.isAbsolute(rel) ? rel : path.resolve(__dirname, rel)
  if (!fs.existsSync(abs)) {
    console.error(`Error: manifest not found: ${abs}`)
    process.exit(1)
  }
  return abs
}

// ---------------------------------------------------------------------------
// Manifest loading + validation
// ---------------------------------------------------------------------------

function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(raw)

  if (!manifest.batchKey) throw new Error('manifest.batchKey is required')
  if (manifest.batchType !== 'source_facts') throw new Error(`Expected batchType=source_facts, got ${manifest.batchType}`)
  if (!Array.isArray(manifest.payload)) throw new Error('manifest.payload must be an array')

  return manifest
}

// ---------------------------------------------------------------------------
// Category → targetField mapping
// ---------------------------------------------------------------------------

const CATEGORY_FIELD_MAP = {
  dev: 'dev_anecdotes',
  technique: 'dev_anecdotes',
  histoire: 'dev_anecdotes',
  historique: 'dev_anecdotes',
  contexte: 'dev_anecdotes',
  history: 'dev_anecdotes',
  context: 'dev_anecdotes',
  gameplay: 'dev_anecdotes',
  OST: 'dev_anecdotes',
  ost: 'dev_anecdotes',
  audio: 'dev_anecdotes',
  cheat: 'cheat_codes',
  cheats: 'cheat_codes',
  version: 'versions',
  edition: 'versions',
  regional: 'versions',
  credits: 'dev_team',
}

const ALLOWED_FIELDS = new Set([
  'dev_anecdotes',
  'cheat_codes',
  'versions',
  'dev_team',
  'ost_composers',
  'ost_notable_tracks',
])

function resolveTargetField(fact) {
  if (fact.targetField && ALLOWED_FIELDS.has(fact.targetField)) return fact.targetField
  if (fact.category) {
    const mapped = CATEGORY_FIELD_MAP[fact.category] || CATEGORY_FIELD_MAP[String(fact.category).toLowerCase()]
    if (mapped) return mapped
  }
  return 'dev_anecdotes'
}

// ---------------------------------------------------------------------------
// Confidence mapping
// ---------------------------------------------------------------------------

const CONFIDENCE_MAP = { high: 0.85, medium: 0.75, low: 0.6 }

function resolveConfidence(confidence) {
  if (typeof confidence === 'number') return Math.max(0, Math.min(1, confidence))
  return CONFIDENCE_MAP[String(confidence).toLowerCase()] ?? 0.7
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function parseJsonSafe(value, fallback = []) {
  if (Array.isArray(value)) return value
  if (!value) return fallback
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function stringifyJson(value) {
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}

// ---------------------------------------------------------------------------
// Fact → entry conversion per targetField
// ---------------------------------------------------------------------------

function factToEntry(fact, targetField) {
  const text = String(fact.fact || '').trim()
  if (!text) return null

  switch (targetField) {
    case 'dev_anecdotes':
      return { title: String(fact.category || 'Note').trim(), text }

    case 'cheat_codes':
      return { name: String(fact.category || 'Code').trim(), code: '', effect: text }

    case 'versions':
      return { title: String(fact.reference || fact.category || 'Version').trim(), description: text }

    case 'dev_team':
      return { name: text, role: String(fact.category || '').trim() }

    case 'ost_composers':
      return { name: text, role: 'Composer' }

    case 'ost_notable_tracks':
      return text

    default:
      return { title: String(fact.category || 'Note').trim(), text }
  }
}

// ---------------------------------------------------------------------------
// Dedup — avoid adding the same fact twice (by text content)
// ---------------------------------------------------------------------------

function isAlreadyPresent(existing, entry, targetField) {
  if (targetField === 'ost_notable_tracks') {
    return existing.some((e) => String(e).trim().toLowerCase() === String(entry).trim().toLowerCase())
  }
  if (typeof entry === 'object' && entry !== null) {
    const entryText = entry.text || entry.description || entry.effect || entry.name || ''
    return existing.some((e) => {
      const eText = e.text || e.description || e.effect || e.name || ''
      return String(eText).trim().toLowerCase() === String(entryText).trim().toLowerCase()
    })
  }
  return false
}

// ---------------------------------------------------------------------------
// Source record + field provenance (mirrors _richness-batch-common.js)
// ---------------------------------------------------------------------------

function ensureSourceRecord(db, gameId, fieldName, fact, confidenceLevel, timestamp) {
  const sourceName = String(fact.sourceName || 'unknown').toLowerCase().replace(/\s+/g, '_')
  const sourceType = String(fact.sourceType || 'external_reference')
  const sourceUrl = fact.url || null
  const reference = [fact.reference, fact.timestamp !== 'n/a' ? fact.timestamp : null]
    .filter(Boolean).join(' @ ') || null
  const notes = reference

  const existing = db.prepare(`
    SELECT id FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = ?
      AND source_name = ?
      AND source_type = ?
    ORDER BY id DESC LIMIT 1
  `).get(gameId, fieldName, sourceName, sourceType)

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET source_url = ?,
          last_verified_at = ?,
          confidence_level = ?,
          notes = ?
      WHERE id = ?
    `).run(sourceUrl, timestamp, confidenceLevel, notes, existing.id)
    return Number(existing.id)
  }

  const result = db.prepare(`
    INSERT INTO source_records (
      entity_type, entity_id, field_name,
      source_name, source_type, source_url,
      source_license, compliance_status,
      ingested_at, last_verified_at,
      confidence_level, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'reference_only', 'approved_with_review', ?, ?, ?, ?)
  `).run(
    'game', gameId, fieldName,
    sourceName, sourceType, sourceUrl,
    timestamp, timestamp,
    confidenceLevel, notes
  )
  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, value, confidenceLevel, timestamp) {
  const valueHash = hashValue(value)
  const existing = db.prepare(`
    SELECT id FROM field_provenance
    WHERE entity_type = 'game' AND entity_id = ? AND field_name = ?
    ORDER BY id DESC LIMIT 1
  `).get(gameId, fieldName)

  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?, value_hash = ?, confidence_level = ?, verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, confidenceLevel, timestamp, existing.id)
  } else {
    db.prepare(`
      INSERT INTO field_provenance (
        entity_type, entity_id, field_name,
        source_record_id, value_hash, is_inferred, confidence_level, verified_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run('game', gameId, fieldName, sourceRecordId, valueHash, confidenceLevel, timestamp)
  }
}

// ---------------------------------------------------------------------------
// Enrichment run
// ---------------------------------------------------------------------------

function createRun(db, batchKey, timestamp) {
  const result = db.prepare(`
    INSERT INTO enrichment_runs (
      run_key, pipeline_name, mode, source_name, status, dry_run,
      started_at, items_seen, items_created, items_updated, items_skipped, items_flagged, error_count, notes
    ) VALUES (?, ?, 'apply', 'source_facts_pipeline', 'running', ?,
              ?, 0, 0, 0, 0, 0, 0, 'Source facts extraction pipeline')
  `).run(`${batchKey}-${timestamp}`, batchKey, APPLY ? 0 : 1, timestamp)
  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed', finished_at = ?,
        items_seen = ?, items_updated = ?, items_skipped = ?, items_flagged = ?, error_count = ?
    WHERE id = ?
  `).run(timestamp, metrics.seen, metrics.updated, metrics.skipped, metrics.flagged, metrics.errors, runId)
}

// ---------------------------------------------------------------------------
// Core apply logic
// ---------------------------------------------------------------------------

function applyManifest(db, manifest) {
  const timestamp = nowIso()
  const metrics = { seen: 0, updated: 0, skipped: 0, flagged: 0, errors: 0 }
  const runId = createRun(db, manifest.batchKey, timestamp)

  const plan = []

  for (const entry of manifest.payload) {
    const gameId = String(entry.gameId || '').trim()
    if (!gameId) { metrics.flagged++; continue }

    const game = db.prepare(`SELECT id, dev_anecdotes, cheat_codes, versions, dev_team, ost_composers, ost_notable_tracks FROM games WHERE id = ?`).get(gameId)
    if (!game) {
      metrics.flagged++
      plan.push({ gameId, title: entry.title, status: 'NOT_FOUND', facts: [] })
      continue
    }

    metrics.seen++
    const usableFacts = (entry.facts || []).filter((f) => f.status === 'usable')
    if (!usableFacts.length) {
      metrics.skipped++
      plan.push({ gameId, title: entry.title, status: 'NO_USABLE_FACTS', facts: [] })
      continue
    }

    const plannedFacts = []

    for (const fact of usableFacts) {
      const targetField = resolveTargetField(fact)
      const confidenceLevel = resolveConfidence(fact.confidence)
      const entry_ = factToEntry(fact, targetField)
      if (!entry_) continue

      const existing = parseJsonSafe(game[targetField])
      const alreadyPresent = isAlreadyPresent(existing, entry_, targetField)

      if (alreadyPresent) {
        plannedFacts.push({ field: targetField, status: 'already_present', entry: entry_ })
        continue
      }

      plannedFacts.push({ field: targetField, status: 'will_add', entry: entry_, confidenceLevel, fact })
    }

    plan.push({ gameId, title: entry.title, status: 'ok', facts: plannedFacts })

    if (!APPLY) continue

    // --- WRITE ---
    const fieldGroups = new Map()
    for (const pf of plannedFacts) {
      if (pf.status !== 'will_add') continue
      if (!fieldGroups.has(pf.field)) fieldGroups.set(pf.field, [])
      fieldGroups.get(pf.field).push(pf)
    }

    let gameUpdated = false
    for (const [targetField, items] of fieldGroups) {
      const existing = parseJsonSafe(game[targetField])
      const newEntries = items.map((i) => i.entry)
      const merged = [...existing, ...newEntries]
      const serialized = stringifyJson(merged)

      db.prepare(`UPDATE games SET ${targetField} = ? WHERE id = ?`).run(serialized, gameId)

      // Update game_editorial if the field exists there
      const editorialCols = db.prepare(`PRAGMA table_info(game_editorial)`).all().map((r) => r.name)
      if (editorialCols.includes(targetField)) {
        db.prepare(`
          INSERT INTO game_editorial (game_id, ${targetField}, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(game_id) DO UPDATE SET
            ${targetField} = excluded.${targetField},
            updated_at = excluded.updated_at
        `).run(gameId, serialized, timestamp, timestamp)
      }

      // Use first item's fact metadata for provenance (most representative source)
      const primaryItem = items[0]
      const sourceRecordId = ensureSourceRecord(
        db, gameId, targetField, primaryItem.fact, primaryItem.confidenceLevel, timestamp
      )
      ensureFieldProvenance(db, gameId, targetField, sourceRecordId, serialized, primaryItem.confidenceLevel, timestamp)

      gameUpdated = true
    }

    if (gameUpdated) metrics.updated++
    else metrics.skipped++
  }

  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, metrics, plan }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const manifestPath = parseManifestPath()
  const manifest = loadManifest(manifestPath)

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', batchKey: manifest.batchKey, payloadCount: manifest.payload.length }))

  const db = new Database(SQLITE_PATH)
  const result = applyManifest(db, manifest)
  db.close()

  const output = {
    mode: APPLY ? 'apply' : 'dry-run',
    batchKey: manifest.batchKey,
    metrics: result.metrics,
    plan: result.plan.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      status: entry.status,
      facts: entry.facts.map((f) => ({
        field: f.field,
        status: f.status,
        text: typeof f.entry === 'string' ? f.entry : (f.entry?.text || f.entry?.description || f.entry?.effect || f.entry?.name || ''),
      })),
    })),
  }

  console.log(JSON.stringify(output, null, 2))
}

main()
