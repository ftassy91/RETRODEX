'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function ensureGameIds(db, payload) {
  const rows = db.prepare(`
    SELECT id
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  const ids = new Set(rows.map((row) => String(row.id)))
  const missing = payload.map((entry) => entry.gameId).filter((id) => !ids.has(id))
  if (missing.length) {
    throw new Error(`Missing target games in sqlite: ${missing.join(', ')}`)
  }
}

function ensureSourceRecord(db, entry, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'ost_composers'
      AND source_name = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId, entry.sourceName)

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET source_type = ?,
          source_url = ?,
          compliance_status = 'approved',
          last_verified_at = ?,
          confidence_level = 0.88,
          notes = ?
      WHERE id = ?
    `).run(entry.sourceType, entry.sourceUrl, timestamp, entry.notes, existing.id)
    return Number(existing.id)
  }

  const result = db.prepare(`
    INSERT INTO source_records (
      entity_type,
      entity_id,
      field_name,
      source_name,
      source_type,
      source_url,
      source_license,
      compliance_status,
      ingested_at,
      last_verified_at,
      confidence_level,
      notes
    ) VALUES (
      'game',
      ?,
      'ost_composers',
      ?,
      ?,
      ?,
      NULL,
      'approved',
      ?,
      ?,
      0.88,
      ?
    )
  `).run(entry.gameId, entry.sourceName, entry.sourceType, entry.sourceUrl, timestamp, timestamp, entry.notes)

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, entry, sourceRecordId, composerJson, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'ost_composers'
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId)

  const valueHash = hashValue(composerJson)

  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = 0.88,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, timestamp, existing.id)
    return
  }

  db.prepare(`
    INSERT INTO field_provenance (
      entity_type,
      entity_id,
      field_name,
      source_record_id,
      value_hash,
      is_inferred,
      confidence_level,
      verified_at
    ) VALUES (
      'game',
      ?,
      'ost_composers',
      ?,
      ?,
      0,
      0.88,
      ?
    )
  `).run(entry.gameId, sourceRecordId, valueHash, timestamp)
}

function createRun(db, batchKey, startedAt, dryRun, notes) {
  const result = db.prepare(`
    INSERT INTO enrichment_runs (
      run_key,
      pipeline_name,
      mode,
      source_name,
      status,
      dry_run,
      started_at,
      items_seen,
      items_created,
      items_updated,
      items_skipped,
      items_flagged,
      error_count,
      notes
    ) VALUES (
      ?,
      ?,
      'apply',
      'manual_curated',
      'running',
      ?,
      ?,
      0,
      0,
      0,
      0,
      0,
      0,
      ?
    )
  `).run(batchKey, batchKey, dryRun ? 1 : 0, startedAt, notes)

  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = 0,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(timestamp, metrics.itemsSeen, metrics.itemsUpdated, metrics.itemsSkipped, metrics.itemsFlagged, metrics.notes, runId)
}

function readBefore(db, payload) {
  const rows = db.prepare(`
    SELECT id, ost_composers
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  return new Map(rows.map((row) => [String(row.id), String(row.ost_composers || '')]))
}

function dryRun(db, payload) {
  const before = readBefore(db, payload)
  return {
    targetedGames: payload.length,
    composerUpdates: payload.filter((entry) => !before.get(entry.gameId).trim()).length,
    targets: payload.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadComposersBefore: Boolean(before.get(entry.gameId).trim()),
      composers: entry.ostComposers.map((composer) => composer.name),
      sourceName: entry.sourceName,
    })),
  }
}

function applyBatch(db, batchKey, notes, payload) {
  const startedAt = nowIso()
  const runKey = `${batchKey}-${startedAt}`
  const runId = createRun(db, batchKey, startedAt, false, notes)
  const metrics = {
    itemsSeen: payload.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes,
  }

  const transaction = db.transaction(() => {
    for (const entry of payload) {
      const sourceRecordId = ensureSourceRecord(db, entry, startedAt)
      const composerJson = JSON.stringify(entry.ostComposers)
      db.prepare(`
        UPDATE games
        SET ost_composers = ?
        WHERE id = ?
      `).run(composerJson, entry.gameId)
      ensureFieldProvenance(db, entry, sourceRecordId, composerJson, startedAt)
      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, runKey, metrics }
}

function runComposerBatch({ batchKey, notes, payload, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, payload)
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: dryRun(db, payload),
      }, null, 2))
      return
    }
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: dryRun(db, payload),
      result: applyBatch(db, batchKey, notes, payload),
    }, null, 2))
  } finally {
    db.close()
  }
}

module.exports = {
  runComposerBatch,
}
