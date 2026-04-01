'use strict'

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function stringifyJson(value) {
  return JSON.stringify(value)
}

function readManifest(manifestPath) {
  const resolved = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.resolve(process.cwd(), manifestPath)

  if (!fs.existsSync(resolved)) {
    throw new Error(`Premium manifest not found: ${resolved}`)
  }

  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid premium manifest: ${resolved}`)
  }
  if (!parsed.batchKey || !Array.isArray(parsed.payload) || parsed.payload.length === 0) {
    throw new Error(`Premium manifest missing batchKey/payload: ${resolved}`)
  }

  return {
    manifestPath: resolved,
    batchKey: String(parsed.batchKey),
    notes: String(parsed.notes || `Premium uplift ${parsed.batchKey}`),
    payload: parsed.payload,
  }
}

function findGameIds(db, payload) {
  const rows = db.prepare(`
    SELECT id
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  return new Set(rows.map((row) => String(row.id)))
}

function getStateBefore(db, gameIds) {
  const rows = db.prepare(`
    SELECT
      id,
      summary,
      synopsis,
      manual_url,
      ost_notable_tracks
    FROM games
    WHERE id IN (${gameIds.map(() => '?').join(', ')})
  `).all(...gameIds)

  return rows.reduce((acc, row) => {
    acc[String(row.id)] = {
      summary: row.summary || null,
      synopsis: row.synopsis || null,
      manualUrl: row.manual_url || null,
      ostNotableTracks: row.ost_notable_tracks || null,
    }
    return acc
  }, {})
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
  if (!columns.includes(fieldName)) {
    return
  }

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
    'approved_with_review',
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
    ) VALUES (?, ?, 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
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

function buildPlannedSummary(db, payload) {
  const before = getStateBefore(db, payload.map((entry) => entry.gameId))
  const summary = {
    targetedGames: payload.length,
    summaryUpdates: 0,
    synopsisUpdates: 0,
    manualUrlsAdded: 0,
    ostTrackUpdates: 0,
    mediaReferencesPlanned: {},
    targets: [],
  }

  for (const entry of payload) {
    const state = before[entry.gameId] || {}
    const target = {
      gameId: entry.gameId,
      title: entry.title,
      summaryUpdate: Boolean(entry.summary && state.summary !== entry.summary),
      synopsisUpdate: Boolean(entry.synopsis && state.synopsis !== entry.synopsis),
      mediaTypes: (entry.media || []).map((media) => media.mediaType),
      ostTracks: Array.isArray(entry.ostTracks) ? entry.ostTracks.length : 0,
    }
    summary.targets.push(target)

    if (target.summaryUpdate) summary.summaryUpdates += 1
    if (target.synopsisUpdate) summary.synopsisUpdates += 1
    if (!state.manualUrl && (entry.media || []).some((media) => media.mediaType === 'manual')) {
      summary.manualUrlsAdded += 1
    }
    if (entry.ostTracks && (!state.ostNotableTracks || state.ostNotableTracks !== stringifyJson(entry.ostTracks))) {
      summary.ostTrackUpdates += 1
    }
    for (const media of entry.media || []) {
      summary.mediaReferencesPlanned[media.mediaType] = (summary.mediaReferencesPlanned[media.mediaType] || 0) + 1
    }
  }

  return summary
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

function applyPremiumUplift(db, { batchKey, notes, payload }) {
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
    summaryUpdates: 0,
    synopsisUpdates: 0,
    manualUrlsAdded: 0,
    ostTracksUpdated: 0,
    mediaReferencesTouched: {},
  }

  const transaction = db.transaction(() => {
    for (const entry of payload) {
      const row = db.prepare(`
        SELECT summary, synopsis, manual_url, ost_notable_tracks
        FROM games
        WHERE id = ?
      `).get(entry.gameId)

      if (!row) {
        metrics.itemsFlagged += 1
        continue
      }

      if (entry.summary && row.summary !== entry.summary) {
        applyTextField(db, entry.gameId, 'summary', entry.summary, buildSourceDescriptor({
          fieldName: 'summary',
          provider: 'internal',
          sourceType: 'knowledge_registry',
          complianceStatus: 'approved',
          confidenceLevel: 0.82,
          notes: `${batchKey} curated premium summary uplift`,
        }), timestamp, metrics)
        metrics.summaryUpdates += 1
      }

      if (entry.synopsis && row.synopsis !== entry.synopsis) {
        applyTextField(db, entry.gameId, 'synopsis', entry.synopsis, buildSourceDescriptor({
          fieldName: 'synopsis',
          provider: 'internal',
          sourceType: 'knowledge_registry',
          complianceStatus: 'approved',
          confidenceLevel: 0.82,
          notes: `${batchKey} curated premium synopsis uplift`,
        }), timestamp, metrics)
        metrics.synopsisUpdates += 1
      }

      if (entry.ostTracks) {
        const tracksJson = stringifyJson(entry.ostTracks)
        if (row.ost_notable_tracks !== tracksJson) {
          applyTextField(db, entry.gameId, 'ost_notable_tracks', tracksJson, buildSourceDescriptor({
            fieldName: 'ost_notable_tracks',
            provider: 'internal',
            sourceType: 'knowledge_registry',
            complianceStatus: 'approved',
            confidenceLevel: 0.78,
            notes: `${batchKey} curated notable tracks`,
          }), timestamp, metrics)
          metrics.ostTracksUpdated += 1
        }
      }

      for (const media of entry.media || []) {
        const sourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: media.sourceField,
          provider: media.provider,
          url: media.url,
          sourceType: media.sourceType || 'external_reference',
          complianceStatus: media.complianceStatus || 'approved_with_review',
          confidenceLevel: media.confidenceLevel || 0.76,
          notes: media.notes || `${batchKey} ${media.mediaType} reference`,
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
          ensureFieldProvenance(db, entry.gameId, 'manual_url', sourceId, media.url, timestamp, media.confidenceLevel || 0.76)
          metrics.provenanceTouched += 1
          metrics.manualUrlsAdded += 1
        }
      }

      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, metrics }
}

function runPremiumBatch({ manifestPath, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const manifest = readManifest(manifestPath)
  const db = new Database(SQLITE_PATH)

  try {
    const existingGameIds = findGameIds(db, manifest.payload)
    const missingGameIds = manifest.payload
      .map((entry) => entry.gameId)
      .filter((gameId) => !existingGameIds.has(gameId))

    if (missingGameIds.length) {
      throw new Error(`Missing target games in sqlite: ${missingGameIds.join(', ')}`)
    }

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

    const result = applyPremiumUplift(db, manifest)
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
  runPremiumBatch,
}
