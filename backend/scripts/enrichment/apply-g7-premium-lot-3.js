#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G7_PAYLOAD = [
  {
    gameId: 'mario-and-luigi-bowsers-inside-story-nintendo-ds',
    title: "Mario & Luigi: Bowser's Inside Story",
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'yumpu',
        url: 'https://www.yumpu.com/en/document/view/21689222/bowsers-inside-story-my-pdf-manuals',
        sourceField: 'manual_reference',
        note: "Community mirror of the Nintendo DS manual for Mario & Luigi: Bowser's Inside Story",
      },
    ],
  },
  {
    gameId: 'makaimura-for-wonderswan-wonderswan',
    title: 'Makaimura for WonderSwan',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual_scan',
        provider: 'reddit_wonderswan_manuals',
        url: 'https://drive.google.com/open?id=1gy5sTHUtfq7sE2zO1YVmtXQqxlCU_Lae',
        sourceField: 'manual_reference',
        note: 'Community scan link shared in the WonderSwan manuals thread for Makaimura for WonderSwan',
      },
    ],
  },
]

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
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
    SELECT id, manual_url
    FROM games
    WHERE id IN (${gameIds.map(() => '?').join(', ')})
  `).all(...gameIds)

  return rows.reduce((acc, row) => {
    acc[String(row.id)] = {
      manualUrl: row.manual_url || null,
    }
    return acc
  }, {})
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

function ensureFieldProvenance(db, gameId, fieldName, sourceRecordId, value, timestamp, confidenceLevel = 0.78) {
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
    'g7-premium-lot-3'
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
    ) VALUES (?, 'g7_premium_lot_3', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'Premium lot 3 manual uplift')

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
    manualUrlsAdded: 0,
    mediaReferencesPlanned: {
      manual: 0,
    },
  }

  for (const entry of payload) {
    const state = before[entry.gameId] || {}
    if (!state.manualUrl) {
      summary.manualUrlsAdded += 1
    }
    summary.mediaReferencesPlanned.manual += entry.media.length
  }

  return summary
}

function applyEnrichment(db, payload) {
  const timestamp = nowIso()
  const runKey = `g7-premium-lot-3-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: payload.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G7 premium lot 3 applied locally on staging sqlite',
    manualUrlsAdded: 0,
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
    mediaReferencesTouched: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of payload) {
      const row = db.prepare(`
        SELECT manual_url
        FROM games
        WHERE id = ?
      `).get(entry.gameId)

      if (!row) {
        metrics.itemsFlagged += 1
        continue
      }

      for (const media of entry.media) {
        const sourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: media.sourceField,
          provider: media.provider,
          url: media.url,
          sourceType: 'external_reference',
          complianceStatus: 'approved_with_review',
          confidenceLevel: 0.76,
          notes: `G7 ${media.note}`,
        }), timestamp)
        metrics.sourceRecordsTouched += 1

        upsertMediaReference(db, entry.gameId, media, sourceId, timestamp)
        metrics.mediaReferencesTouched += 1

        db.prepare(`
          UPDATE games
          SET manual_url = ?
          WHERE id = ?
        `).run(media.url, entry.gameId)
        ensureFieldProvenance(db, entry.gameId, 'manual_url', sourceId, media.url, timestamp, 0.76)
        metrics.provenanceTouched += 1
        metrics.manualUrlsAdded += 1
      }

      metrics.itemsUpdated += 1
    }
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
    const existingGameIds = findGameIds(db, G7_PAYLOAD)
    const missingGameIds = G7_PAYLOAD
      .map((entry) => entry.gameId)
      .filter((gameId) => !existingGameIds.has(gameId))

    if (missingGameIds.length) {
      throw new Error(`Missing target games in sqlite: ${missingGameIds.join(', ')}`)
    }

    const planned = buildPlannedSummary(db, G7_PAYLOAD)
    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: planned,
      }, null, 2))
      return
    }

    const result = applyEnrichment(db, G7_PAYLOAD)
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: planned,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
