#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const TARGET = {
  gameId: 'panzer-dragoon-saga-sega-saturn',
  title: 'Panzer Dragoon Saga',
  media: {
    mediaType: 'screenshot',
    assetSubtype: 'gameplay_capture',
    provider: 'panzer_dragoon_legacy',
    url: 'https://panzerdragoonlegacy.com/pictures/3555-panzer-dragoon-saga-tower-screenshot',
    sourceField: 'screenshot_reference',
  },
}

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function ensureTarget(db) {
  const row = db.prepare('SELECT id FROM games WHERE id = ?').get(TARGET.gameId)
  if (!row) {
    throw new Error(`Missing target game in sqlite: ${TARGET.gameId}`)
  }
}

function buildSourceDescriptor({ fieldName, provider, url, sourceType, complianceStatus, confidenceLevel, notes }) {
  return {
    fieldName,
    sourceName: provider,
    sourceType,
    sourceUrl: url,
    sourceLicense: url ? 'reference_only' : null,
    complianceStatus,
    confidenceLevel,
    notes,
  }
}

function ensureSourceRecord(db, gameId, descriptor, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = ?
      AND source_name = ?
      AND source_type = ?
      AND COALESCE(source_url, '') = COALESCE(?, '')
    ORDER BY id DESC
    LIMIT 1
  `).get(
    gameId,
    descriptor.fieldName,
    descriptor.sourceName,
    descriptor.sourceType,
    descriptor.sourceUrl
  )

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET source_license = ?,
          compliance_status = ?,
          last_verified_at = ?,
          confidence_level = ?,
          notes = ?
      WHERE id = ?
    `).run(
      descriptor.sourceLicense,
      descriptor.complianceStatus,
      timestamp,
      descriptor.confidenceLevel,
      descriptor.notes,
      existing.id
    )
    return Number(existing.id)
  }

  const insert = db.prepare(`
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'game',
    gameId,
    descriptor.fieldName,
    descriptor.sourceName,
    descriptor.sourceType,
    descriptor.sourceUrl,
    descriptor.sourceLicense,
    descriptor.complianceStatus,
    timestamp,
    timestamp,
    descriptor.confidenceLevel,
    descriptor.notes
  )

  return Number(insert.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, value, timestamp, confidenceLevel = 0.76) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId, fieldName)

  const valueHash = hashValue(value)
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = ?,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, confidenceLevel, timestamp, existing.id)
    return false
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
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run('game', gameId, fieldName, sourceRecordId, valueHash, confidenceLevel, timestamp)

  return true
}

function upsertMediaReference(db, gameId, media, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO media_references (
      entity_type,
      entity_id,
      media_type,
      url,
      provider,
      compliance_status,
      storage_mode,
      source_record_id,
      created_at,
      updated_at,
      asset_subtype,
      license_status,
      ui_allowed,
      healthcheck_status,
      source_context
    ) VALUES (?, ?, ?, ?, ?, ?, 'external_reference', ?, ?, ?, ?, 'reference_only', 1, 'unchecked', ?)
    ON CONFLICT(entity_type, entity_id, media_type, url) DO UPDATE SET
      provider = excluded.provider,
      compliance_status = excluded.compliance_status,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at,
      asset_subtype = excluded.asset_subtype,
      license_status = excluded.license_status,
      ui_allowed = excluded.ui_allowed,
      healthcheck_status = excluded.healthcheck_status,
      source_context = excluded.source_context
  `).run(
    'game',
    gameId,
    media.mediaType,
    media.url,
    media.provider,
    'approved_with_review',
    sourceRecordId,
    timestamp,
    timestamp,
    media.assetSubtype || null,
    'g6-panzer-gold'
  )
}

function createRun(db, runKey, timestamp, dryRun) {
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
    ) VALUES (?, 'g6_panzer_gold', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'Panzer Dragoon Saga premium gold lift')

  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = ?,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(
    timestamp,
    metrics.itemsSeen,
    metrics.itemsCreated,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    metrics.notes,
    runId
  )
}

function buildPlannedSummary(db) {
  const row = db.prepare(`
    SELECT COUNT(*) count
    FROM media_references
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND media_type = 'screenshot'
      AND url = ?
  `).get(TARGET.gameId, TARGET.media.url)

  return {
    targetedGames: 1,
    screenshotPlanned: row.count === 0 ? 1 : 0,
  }
}

function applyEnrichment(db) {
  const timestamp = nowIso()
  const runKey = `g6-panzer-gold-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: 1,
    itemsCreated: 0,
    itemsUpdated: 1,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G6 Panzer screenshot uplift applied locally on staging sqlite',
  }

  const transaction = db.transaction(() => {
    const sourceId = ensureSourceRecord(db, TARGET.gameId, buildSourceDescriptor({
      fieldName: TARGET.media.sourceField,
      provider: TARGET.media.provider,
      url: TARGET.media.url,
      sourceType: 'external_reference',
      complianceStatus: 'approved_with_review',
      confidenceLevel: 0.76,
      notes: 'G6 Panzer screenshot reference',
    }), timestamp)

    ensureFieldProvenance(db, TARGET.gameId, TARGET.media.sourceField, sourceId, TARGET.media.url, timestamp, 0.76)
    upsertMediaReference(db, TARGET.gameId, TARGET.media, sourceId, timestamp)
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return {
    runId,
    runKey,
    metrics,
  }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    ensureTarget(db)
    const planned = buildPlannedSummary(db)
    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        target: TARGET,
        summary: planned,
      }, null, 2))
      return
    }

    const result = applyEnrichment(db)
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      target: TARGET,
      summary: planned,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
