#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G8_PAYLOAD = [
  {
    gameId: 'secret-of-mana-super-nintendo',
    title: 'Secret of Mana',
    summary: "Square transforme l'action-RPG 16-bit en aventure coopérative fluide, où l'exploration, la montée en puissance des armes et l'alchimie du trio principal donnent au voyage une ampleur exceptionnelle.",
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual_pdf',
        provider: 'nintendo',
        url: 'https://www.nintendo.co.jp/clvs/manuals/fr/pdf/CLV-P-SABRE_fr.pdf',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'world_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Secret_of_Mana',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/snes/secretofmana/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Fear of the Heavens', 'Into the Thick of It', 'Meridian Dance'],
  },
  {
    gameId: '999-nine-hours-nine-persons-nine-doors-nintendo-ds',
    title: '999: Nine Hours, Nine Persons, Nine Doors',
    synopsis: "Junpei se réveille enfermé sur un paquebot avec huit autres captifs et découvre qu'un certain Zero les force à participer au Nonary Game, une fuite sous compte à rebours où chaque porte, chaque alliance et chaque énigme rapprochent autant de la vérité que de la mort.",
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual_reference',
        provider: 'nintendo_ds_archive',
        url: 'https://nintendodsarchive.wordpress.com/2016/04/11/999-nine-hours-nine-persons-nine-doors/',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'flowchart_guide',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/999:_Nine_Hours,_Nine_Persons,_Nine_Doors/Walkthrough',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'screenshot',
        assetSubtype: 'screenshots_gallery',
        provider: 'mobygames',
        url: 'https://www.mobygames.com/game/49690/999-nine-hours-nine-persons-nine-doors/',
        sourceField: 'screenshot_reference',
      },
    ],
  },
  {
    gameId: '1080-snowboarding-nintendo-64',
    title: '1080° Snowboarding',
    synopsis: "Entre vitesse pure et maîtrise technique, 1080° Snowboarding suit une saison de compétitions sur des pistes de plus en plus exigeantes, où les descentes chronométrées et les runs freestyle servent avant tout à dompter l'inertie et le terrain.",
    media: [
      {
        mediaType: 'map',
        assetSubtype: 'course_guide',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/1080%C2%B0_Snowboarding',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'character_icons',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/nintendo_64/1080snowboarding/sheet/108336/',
        sourceField: 'sprite_sheet_reference',
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

function stringifyJson(value) {
  return JSON.stringify(value)
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

  const insertColumns = ['game_id', fieldName, 'source_record_id', 'created_at', 'updated_at']
  const updateClauses = [
    `${fieldName} = excluded.${fieldName}`,
    'source_record_id = excluded.source_record_id',
    'updated_at = excluded.updated_at',
  ]

  db.prepare(`
    INSERT INTO game_editorial (${insertColumns.join(', ')})
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      ${updateClauses.join(',\n      ')}
  `).run(gameId, value, sourceRecordId, timestamp, timestamp)
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
    'g8-premium-lot-4'
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
    ) VALUES (?, 'g8_premium_lot_4', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'Premium lot 4 bronze uplift on targeted games')

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
    mediaReferencesPlanned: {
      manual: 0,
      map: 0,
      sprite_sheet: 0,
      screenshot: 0,
    },
  }

  for (const entry of payload) {
    const state = before[entry.gameId] || {}
    if (entry.summary && state.summary !== entry.summary) {
      summary.summaryUpdates += 1
    }
    if (entry.synopsis && state.synopsis !== entry.synopsis) {
      summary.synopsisUpdates += 1
    }
    if (!state.manualUrl && entry.media.some((media) => media.mediaType === 'manual')) {
      summary.manualUrlsAdded += 1
    }
    if (entry.ostTracks && (!state.ostNotableTracks || state.ostNotableTracks !== stringifyJson(entry.ostTracks))) {
      summary.ostTrackUpdates += 1
    }
    for (const media of entry.media) {
      summary.mediaReferencesPlanned[media.mediaType] += 1
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

function applyEnrichment(db, payload) {
  const timestamp = nowIso()
  const runKey = `g8-premium-lot-4-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: payload.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G8 premium lot 4 applied locally on staging sqlite',
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
    summaryUpdates: 0,
    synopsisUpdates: 0,
    manualUrlsAdded: 0,
    ostTracksUpdated: 0,
    mediaReferencesTouched: {
      manual: 0,
      map: 0,
      sprite_sheet: 0,
      screenshot: 0,
    },
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
          notes: 'G8 curated premium summary uplift',
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
          notes: 'G8 curated premium synopsis uplift',
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
            notes: 'G8 curated notable tracks for premium uplift',
          }), timestamp, metrics)
          metrics.ostTracksUpdated += 1
        }
      }

      for (const media of entry.media) {
        const sourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: media.sourceField,
          provider: media.provider,
          url: media.url,
          sourceType: 'external_reference',
          complianceStatus: 'approved_with_review',
          confidenceLevel: 0.76,
          notes: `G8 ${media.mediaType} reference`,
        }), timestamp)
        metrics.sourceRecordsTouched += 1

        upsertMediaReference(db, entry.gameId, media, sourceId, timestamp)
        metrics.mediaReferencesTouched[media.mediaType] += 1

        if (media.mediaType === 'manual' && row.manual_url !== media.url) {
          db.prepare(`
            UPDATE games
            SET manual_url = ?
            WHERE id = ?
          `).run(media.url, entry.gameId)
          ensureFieldProvenance(db, entry.gameId, 'manual_url', sourceId, media.url, timestamp, 0.76)
          metrics.provenanceTouched += 1
          metrics.manualUrlsAdded += 1
        }
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
    const existingGameIds = findGameIds(db, G8_PAYLOAD)
    const missingGameIds = G8_PAYLOAD
      .map((entry) => entry.gameId)
      .filter((gameId) => !existingGameIds.has(gameId))

    if (missingGameIds.length) {
      throw new Error(`Missing target games in sqlite: ${missingGameIds.join(', ')}`)
    }

    const planned = buildPlannedSummary(db, G8_PAYLOAD)
    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: planned,
        targets: G8_PAYLOAD.map((entry) => ({
          gameId: entry.gameId,
          title: entry.title,
          summaryUpdate: Boolean(entry.summary),
          synopsisUpdate: Boolean(entry.synopsis),
          mediaTypes: entry.media.map((media) => media.mediaType),
          ostTracks: Array.isArray(entry.ostTracks) ? entry.ostTracks.length : 0,
        })),
      }, null, 2))
      return
    }

    const result = applyEnrichment(db, G8_PAYLOAD)
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
