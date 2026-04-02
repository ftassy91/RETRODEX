'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const { readBatchManifest } = require('./_batch-manifest-common')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function stringifyJson(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function readManifest(manifestPath) {
  const manifest = readBatchManifest(manifestPath)
  if (manifest.batchType !== 'richness') {
    throw new Error(`Richness manifest expected batchType=richness, got ${manifest.batchType}`)
  }

  return {
    manifestPath: manifest.manifestPath,
    batchKey: manifest.batchKey,
    notes: manifest.notes,
    payload: manifest.payload,
    ids: manifest.ids,
    publishDomains: manifest.publishDomains,
    postChecks: manifest.postChecks,
    writeTargets: manifest.writeTargets,
  }
}

function buildSourceDescriptor({
  fieldName,
  provider,
  url = null,
  sourceType,
  complianceStatus,
  confidenceLevel,
  notes,
}) {
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

function ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, value, timestamp, confidenceLevel = 0.8) {
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

function upsertEditorialField(db, gameId, fieldName, value, sourceRecordId, timestamp) {
  const columns = db.prepare(`PRAGMA table_info(game_editorial)`).all().map((row) => String(row.name))
  if (!columns.includes(fieldName)) return

  db.prepare(`
    INSERT INTO game_editorial (game_id, ${fieldName}, source_record_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      ${fieldName} = excluded.${fieldName},
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(gameId, value, sourceRecordId, timestamp, timestamp)
}

function upsertMediaReference(db, gameId, media, sourceRecordId, timestamp, batchKey) {
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
    media.complianceStatus || 'approved_with_review',
    sourceRecordId,
    timestamp,
    timestamp,
    media.assetSubtype || null,
    batchKey
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
    ) VALUES (?, ?, 'apply', 'curated_richness', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(`${batchKey}-${timestamp}`, batchKey, dryRun ? 1 : 0, timestamp, notes)

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

function getStateBefore(db, gameIds) {
  const rows = db.prepare(`
    SELECT
      id,
      summary,
      synopsis,
      tagline,
      dev_anecdotes,
      cheat_codes,
      versions,
      avg_duration_main,
      avg_duration_complete,
      speedrun_wr,
      ost_notable_tracks,
      manual_url
    FROM games
    WHERE id IN (${gameIds.map(() => '?').join(', ')})
  `).all(...gameIds)

  return rows.reduce((acc, row) => {
    acc[String(row.id)] = {
      summary: row.summary || null,
      synopsis: row.synopsis || null,
      tagline: row.tagline || null,
      dev_anecdotes: row.dev_anecdotes || null,
      cheat_codes: row.cheat_codes || null,
      versions: row.versions || null,
      avg_duration_main: row.avg_duration_main,
      avg_duration_complete: row.avg_duration_complete,
      speedrun_wr: row.speedrun_wr || null,
      ost_notable_tracks: row.ost_notable_tracks || null,
      manual_url: row.manual_url || null,
    }
    return acc
  }, {})
}

function buildPlannedSummary(db, payload) {
  const before = getStateBefore(db, payload.map((entry) => entry.gameId))
  const metrics = {
    targetedGames: payload.length,
    fieldUpdates: {},
    mediaReferencesPlanned: {},
    targets: [],
  }

  for (const entry of payload) {
    const state = before[entry.gameId] || {}
    const target = {
      gameId: entry.gameId,
      title: entry.title,
      fields: [],
      mediaTypes: (entry.media || []).map((media) => media.mediaType),
    }

    const candidates = [
      ['summary', entry.summary, state.summary],
      ['synopsis', entry.synopsis, state.synopsis],
      ['tagline', entry.tagline, state.tagline],
      ['dev_anecdotes', stringifyJson(entry.devAnecdotes), state.dev_anecdotes],
      ['cheat_codes', stringifyJson(entry.cheatCodes), state.cheat_codes],
      ['versions', stringifyJson(entry.versions), state.versions],
      ['avg_duration_main', entry.avgDurationMain, state.avg_duration_main],
      ['avg_duration_complete', entry.avgDurationComplete, state.avg_duration_complete],
      ['speedrun_wr', stringifyJson(entry.speedrunWr), state.speedrun_wr],
      ['ost_notable_tracks', stringifyJson(entry.ostTracks), state.ost_notable_tracks],
    ]

    for (const [fieldName, nextValue, previousValue] of candidates) {
      if (nextValue === null || nextValue === undefined || nextValue === '') continue
      if (String(nextValue) === String(previousValue ?? '')) continue
      target.fields.push(fieldName)
      metrics.fieldUpdates[fieldName] = (metrics.fieldUpdates[fieldName] || 0) + 1
    }

    for (const media of entry.media || []) {
      metrics.mediaReferencesPlanned[media.mediaType] = (metrics.mediaReferencesPlanned[media.mediaType] || 0) + 1
    }

    metrics.targets.push(target)
  }

  return metrics
}

function applyTextField(db, gameId, fieldName, value, sourceDescriptor, timestamp, metrics) {
  const sourceRecordId = ensureSourceRecord(db, gameId, sourceDescriptor, timestamp)
  metrics.sourceRecordsTouched += 1

  db.prepare(`
    UPDATE games
    SET ${fieldName} = ?
    WHERE id = ?
  `).run(value, gameId)

  upsertEditorialField(db, gameId, fieldName, value, sourceRecordId, timestamp)
  ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, value, timestamp, sourceDescriptor.confidenceLevel)
  metrics.provenanceTouched += 1
}

function applyStructuredField(db, gameId, fieldName, value, sourceDescriptor, timestamp, metrics) {
  const serialized = stringifyJson(value)
  if (serialized === null) return

  const sourceRecordId = ensureSourceRecord(db, gameId, sourceDescriptor, timestamp)
  metrics.sourceRecordsTouched += 1

  db.prepare(`
    UPDATE games
    SET ${fieldName} = ?
    WHERE id = ?
  `).run(serialized, gameId)

  upsertEditorialField(db, gameId, fieldName, serialized, sourceRecordId, timestamp)
  ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, serialized, timestamp, sourceDescriptor.confidenceLevel)
  metrics.provenanceTouched += 1
}

function applyNumericField(db, gameId, fieldName, value, sourceDescriptor, timestamp, metrics) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return

  const numericValue = Number(value)
  const sourceRecordId = ensureSourceRecord(db, gameId, sourceDescriptor, timestamp)
  metrics.sourceRecordsTouched += 1

  db.prepare(`
    UPDATE games
    SET ${fieldName} = ?
    WHERE id = ?
  `).run(numericValue, gameId)

  upsertEditorialField(db, gameId, fieldName, numericValue, sourceRecordId, timestamp)
  ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, numericValue, timestamp, sourceDescriptor.confidenceLevel)
  metrics.provenanceTouched += 1
}

function descriptorForEntry(entry, fieldName, fallbackNotes) {
  return buildSourceDescriptor({
    fieldName,
    provider: entry.sourceName,
    url: entry.sourceUrl || null,
    sourceType: entry.sourceType,
    complianceStatus: 'approved_with_review',
    confidenceLevel: entry.confidenceLevel || 0.8,
    notes: entry.notes || fallbackNotes,
  })
}

function applyRichness(db, { batchKey, notes, payload }) {
  const timestamp = nowIso()
  const runId = createRun(db, batchKey, timestamp, false, notes)
  const metrics = {
    itemsSeen: payload.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes,
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
    fieldUpdates: {},
    mediaReferencesTouched: {},
  }

  const transaction = db.transaction(() => {
    for (const entry of payload) {
      const row = db.prepare(`
        SELECT
          summary,
          synopsis,
          tagline,
          dev_anecdotes,
          cheat_codes,
          versions,
          avg_duration_main,
          avg_duration_complete,
          speedrun_wr,
          ost_notable_tracks,
          manual_url
        FROM games
        WHERE id = ?
      `).get(entry.gameId)

      if (!row) {
        metrics.itemsFlagged += 1
        continue
      }

      const scalarFields = [
        ['summary', entry.summary],
        ['synopsis', entry.synopsis],
        ['tagline', entry.tagline],
      ]

      for (const [fieldName, fieldValue] of scalarFields) {
        if (!fieldValue || row[fieldName] === fieldValue) continue
        applyTextField(db, entry.gameId, fieldName, fieldValue, descriptorForEntry(entry, fieldName, `${batchKey} ${fieldName} uplift`), timestamp, metrics)
        metrics.fieldUpdates[fieldName] = (metrics.fieldUpdates[fieldName] || 0) + 1
      }

      const structuredFields = [
        ['dev_anecdotes', entry.devAnecdotes],
        ['cheat_codes', entry.cheatCodes],
        ['versions', entry.versions],
        ['speedrun_wr', entry.speedrunWr],
        ['ost_notable_tracks', entry.ostTracks],
      ]

      for (const [fieldName, fieldValue] of structuredFields) {
        const serialized = stringifyJson(fieldValue)
        if (serialized === null || String(row[fieldName] || '') === serialized) continue
        applyStructuredField(db, entry.gameId, fieldName, fieldValue, descriptorForEntry(entry, fieldName, `${batchKey} ${fieldName} uplift`), timestamp, metrics)
        metrics.fieldUpdates[fieldName] = (metrics.fieldUpdates[fieldName] || 0) + 1
      }

      const numericFields = [
        ['avg_duration_main', entry.avgDurationMain],
        ['avg_duration_complete', entry.avgDurationComplete],
      ]

      for (const [fieldName, fieldValue] of numericFields) {
        if (fieldValue === null || fieldValue === undefined || !Number.isFinite(Number(fieldValue))) continue
        if (Number(row[fieldName] ?? NaN) === Number(fieldValue)) continue
        applyNumericField(db, entry.gameId, fieldName, fieldValue, descriptorForEntry(entry, fieldName, `${batchKey} ${fieldName} uplift`), timestamp, metrics)
        metrics.fieldUpdates[fieldName] = (metrics.fieldUpdates[fieldName] || 0) + 1
      }

      for (const media of entry.media || []) {
        const sourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: media.sourceField,
          provider: media.provider,
          url: media.url,
          sourceType: media.sourceType || 'external_reference',
          complianceStatus: media.complianceStatus || 'approved_with_review',
          confidenceLevel: media.confidenceLevel || entry.confidenceLevel || 0.76,
          notes: media.notes || entry.notes || `${batchKey} ${media.mediaType} reference`,
        }), timestamp)
        metrics.sourceRecordsTouched += 1

        upsertMediaReference(db, entry.gameId, media, sourceId, timestamp, batchKey)
        metrics.mediaReferencesTouched[media.mediaType] = (metrics.mediaReferencesTouched[media.mediaType] || 0) + 1

        if (media.mediaType === 'manual' && row.manual_url !== media.url) {
          db.prepare(`
            UPDATE games
            SET manual_url = ?
            WHERE id = ?
          `).run(media.url, entry.gameId)
          ensureFieldProvenance(db, entry.gameId, 'manual_url', sourceId, media.url, timestamp, media.confidenceLevel || entry.confidenceLevel || 0.76)
          metrics.provenanceTouched += 1
          metrics.fieldUpdates.manual_url = (metrics.fieldUpdates.manual_url || 0) + 1
        }
      }

      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)
  return { runId, metrics }
}

function runRichnessBatch({ manifestPath, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const manifest = readManifest(manifestPath)
  const db = new Database(SQLITE_PATH)

  try {
    const planned = buildPlannedSummary(db, manifest.payload)
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        manifestPath: manifest.manifestPath,
        batchKey: manifest.batchKey,
        summary: planned,
      }, null, 2))
      return
    }

    const result = applyRichness(db, manifest)
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      manifestPath: manifest.manifestPath,
      batchKey: manifest.batchKey,
      summary: planned,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

module.exports = {
  SQLITE_PATH,
  readManifest,
  runRichnessBatch,
}
