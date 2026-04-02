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
      AND field_name = 'summary'
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
          confidence_level = ?,
          notes = ?
      WHERE id = ?
    `).run(
      entry.sourceType || 'knowledge_registry',
      entry.sourceUrl || null,
      timestamp,
      Number(entry.confidenceLevel ?? 0.8),
      entry.notes || null,
      existing.id
    )
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
      'summary',
      ?,
      ?,
      ?,
      NULL,
      'approved',
      ?,
      ?,
      ?,
      ?
    )
  `).run(
    entry.gameId,
    entry.sourceName,
    entry.sourceType || 'knowledge_registry',
    entry.sourceUrl || null,
    timestamp,
    timestamp,
    Number(entry.confidenceLevel ?? 0.8),
    entry.notes || null
  )

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, entry, sourceRecordId, summary, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'summary'
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId)

  const valueHash = hashValue(summary)
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = ?,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, Number(entry.confidenceLevel ?? 0.8), timestamp, existing.id)
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
    ) VALUES ('game', ?, 'summary', ?, ?, 0, ?, ?)
  `).run(entry.gameId, sourceRecordId, valueHash, Number(entry.confidenceLevel ?? 0.8), timestamp)
}

function upsertGameEditorialSummary(db, gameId, summary, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_editorial (
      game_id,
      summary,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      summary = excluded.summary,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(gameId, summary, sourceRecordId, timestamp, timestamp)
}

function createRun(db, batchKey, timestamp, dryRun, notes) {
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
    ) VALUES (?, ?, 'apply', 'manual_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(`${batchKey}-${timestamp}`, batchKey, dryRun ? 1 : 0, timestamp, notes)

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
    SELECT id, summary
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  return new Map(rows.map((row) => [String(row.id), String(row.summary || '')]))
}

function dryRun(db, payload) {
  const before = readBefore(db, payload)
  return {
    targetedGames: payload.length,
    summaryUpdates: payload.filter((entry) => before.get(entry.gameId) !== String(entry.summary || '')).length,
    targets: payload.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadSummaryBefore: Boolean(before.get(entry.gameId).trim()),
      sourceName: entry.sourceName,
    })),
  }
}

function applyBatch(db, batchKey, notes, payload) {
  const startedAt = nowIso()
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
      db.prepare(`
        UPDATE games
        SET summary = ?
        WHERE id = ?
      `).run(entry.summary, entry.gameId)
      upsertGameEditorialSummary(db, entry.gameId, entry.summary, sourceRecordId, startedAt)
      ensureFieldProvenance(db, entry, sourceRecordId, entry.summary, startedAt)
      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, metrics }
}

function runSummaryBatch({ batchKey, notes, payload, argv = process.argv }) {
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
  runSummaryBatch,
  SQLITE_PATH,
}
