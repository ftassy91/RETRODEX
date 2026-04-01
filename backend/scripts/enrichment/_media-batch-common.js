'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const { readBatchManifest } = require('./_batch-manifest-common')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const FIELD_NAME_BY_MEDIA_TYPE = {
  cover: 'cover_image',
  manual: 'manual_reference',
  map: 'map_reference',
  sprite_sheet: 'sprite_sheet_reference',
  screenshot: 'screenshot_reference',
  ending: 'ending_reference',
  scan: 'scan_reference',
}

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function stringifyJson(value) {
  return value == null ? null : JSON.stringify(value)
}

function readManifest(manifestPath) {
  const manifest = readBatchManifest(manifestPath)
  if (manifest.batchType !== 'media') {
    throw new Error(`Media manifest expected batchType=media, got ${manifest.batchType}`)
  }

  return {
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    notes: manifest.notes,
    payload: manifest.payload.map((entry) => ({
      ...entry,
      mediaType: String(entry.mediaType || entry.assetType || '').trim().toLowerCase(),
      sourceField: String(entry.sourceField || FIELD_NAME_BY_MEDIA_TYPE[String(entry.mediaType || entry.assetType || '').trim().toLowerCase()] || '').trim(),
    })),
    ids: manifest.ids,
    publishDomains: manifest.publishDomains,
    postChecks: manifest.postChecks,
    writeTargets: manifest.writeTargets,
  }
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
      AND field_name = ?
      AND source_name = ?
      AND source_type = ?
      AND COALESCE(source_url, '') = COALESCE(?, '')
    ORDER BY id DESC
    LIMIT 1
  `).get(
    entry.gameId,
    entry.sourceField,
    entry.provider,
    entry.sourceType || 'external_reference',
    entry.sourceUrl || entry.url || null
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
      entry.licenseStatus || 'reference_only',
      entry.complianceStatus || 'approved_with_review',
      timestamp,
      Number(entry.confidenceLevel ?? 0.74),
      stringifyJson(entry.notes || null),
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
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    entry.gameId,
    entry.sourceField,
    entry.provider,
    entry.sourceType || 'external_reference',
    entry.sourceUrl || entry.url || null,
    entry.licenseStatus || 'reference_only',
    entry.complianceStatus || 'approved_with_review',
    timestamp,
    timestamp,
    Number(entry.confidenceLevel ?? 0.74),
    stringifyJson(entry.notes || null)
  )

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, entry, sourceRecordId, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId, entry.sourceField)

  const valueHash = hashValue(entry.url)
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = ?,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, Number(entry.confidenceLevel ?? 0.74), timestamp, existing.id)
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
    ) VALUES ('game', ?, ?, ?, ?, 0, ?, ?)
  `).run(entry.gameId, entry.sourceField, sourceRecordId, valueHash, Number(entry.confidenceLevel ?? 0.74), timestamp)
}

function upsertMediaReference(db, entry, sourceRecordId, timestamp) {
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
      title,
      preview_url,
      asset_subtype,
      license_status,
      ui_allowed,
      healthcheck_status,
      notes,
      last_checked_at,
      source_context
    ) VALUES (
      'game',
      ?, ?, ?, ?, ?, 'external_reference', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(entity_type, entity_id, media_type, url) DO UPDATE SET
      provider = excluded.provider,
      compliance_status = excluded.compliance_status,
      storage_mode = excluded.storage_mode,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at,
      title = excluded.title,
      preview_url = excluded.preview_url,
      asset_subtype = excluded.asset_subtype,
      license_status = excluded.license_status,
      ui_allowed = excluded.ui_allowed,
      healthcheck_status = excluded.healthcheck_status,
      notes = excluded.notes,
      last_checked_at = excluded.last_checked_at,
      source_context = excluded.source_context
  `).run(
    entry.gameId,
    entry.mediaType,
    entry.url,
    entry.provider,
    entry.complianceStatus || 'approved_with_review',
    sourceRecordId,
    timestamp,
    timestamp,
    entry.title || null,
    entry.previewUrl || null,
    entry.assetSubtype || null,
    entry.licenseStatus || 'reference_only',
    entry.uiAllowed ? 1 : 0,
    entry.healthcheckStatus || 'unchecked',
    stringifyJson(entry.notes || null),
    entry.lastCheckedAt || timestamp,
    stringifyJson(entry.sourceContext || null)
  )
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
    ) VALUES (?, ?, 'apply', 'polish_retrodex', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
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

function buildPlannedSummary(db, payload) {
  const existing = db.prepare(`
    SELECT entity_id, media_type, url
    FROM media_references
    WHERE entity_type = 'game'
      AND entity_id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  const existingKeys = new Set(existing.map((row) => `${row.entity_id}::${row.media_type}::${row.url}`))
  const byType = {}
  const targets = payload.map((entry) => {
    byType[entry.mediaType] = (byType[entry.mediaType] || 0) + 1
    return {
      gameId: entry.gameId,
      mediaType: entry.mediaType,
      provider: entry.provider,
      sourceField: entry.sourceField,
      alreadyPresent: existingKeys.has(`${entry.gameId}::${entry.mediaType}::${entry.url}`),
      url: entry.url,
    }
  })

  return {
    targetedGames: Array.from(new Set(payload.map((entry) => entry.gameId))).length,
    mediaEntries: payload.length,
    byType,
    targets,
  }
}

function applyMediaBatch(db, manifest) {
  const timestamp = nowIso()
  const runId = createRun(db, manifest.batchKey, timestamp, false, manifest.notes)
  const metrics = {
    itemsSeen: manifest.payload.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
    mediaReferencesTouched: 0,
    notes: manifest.notes,
  }

  const transaction = db.transaction(() => {
    for (const entry of manifest.payload) {
      const sourceRecordId = ensureSourceRecord(db, entry, timestamp)
      ensureFieldProvenance(db, entry, sourceRecordId, timestamp)
      upsertMediaReference(db, entry, sourceRecordId, timestamp)
      metrics.sourceRecordsTouched += 1
      metrics.provenanceTouched += 1
      metrics.mediaReferencesTouched += 1
      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)
  return { runId, metrics }
}

function runMediaBatch({ manifestPath, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const manifest = readManifest(manifestPath)
  const db = new Database(SQLITE_PATH)

  try {
    ensureGameIds(db, manifest.payload)
    const summary = buildPlannedSummary(db, manifest.payload)
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        manifestPath: manifest.manifestPath,
        batchKey: manifest.batchKey,
        summary,
      }, null, 2))
      return
    }

    const result = applyMediaBatch(db, manifest)
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      manifestPath: manifest.manifestPath,
      batchKey: manifest.batchKey,
      summary,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

module.exports = {
  FIELD_NAME_BY_MEDIA_TYPE,
  SQLITE_PATH,
  readManifest,
  runMediaBatch,
}
