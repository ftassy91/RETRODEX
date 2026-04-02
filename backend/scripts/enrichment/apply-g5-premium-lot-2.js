#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G5_PAYLOAD = [
  {
    gameId: 'castlevania-symphony-of-the-night-playstation',
    title: 'Castlevania: Symphony of the Night',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'datassette',
        url: 'https://datassette.org/manuais/us-estados-unidos-jogos-playstation-sony-manuais/castlevania-symphony-night-usa',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'revned77',
        url: 'https://revned77.github.io/games/SymphonyOfTheNight.html',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/sotn-sprites/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Dracula\'s Castle', 'Marble Gallery', 'Lost Painting'],
    ostComposers: [{ name: 'Michiru Yamane', role: 'composer' }],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Castlevania:_Symphony_of_the_Night',
    },
  },
  {
    gameId: 'panzer-dragoon-saga-sega-saturn',
    title: 'Panzer Dragoon Saga',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'panzer_dragoon_legacy',
        url: 'https://panzerdragoonlegacy.com/downloads/49-panzer-dragoon-saga-manual',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'world_map',
        provider: 'pdsoasis',
        url: 'https://pdsoasis.github.io/pdsguide.html',
        sourceField: 'map_reference',
      },
    ],
    ostTracks: ['Sona Mi Areru Ec Sancitu', 'The Empire', 'A Premonition'],
    ostComposers: [
      { name: 'Saori Kobayashi', role: 'composer' },
      { name: 'Mariko Nanba', role: 'composer' },
    ],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Panzer_Dragoon_Saga',
    },
  },
  {
    gameId: 'earthbound-super-nintendo',
    title: 'EarthBound',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'nintendo',
        url: 'https://www.nintendo.co.jp/clvs/manuals/common/pdf/CLV-P-SAAJE.pdf',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'fantasyanime',
        url: 'https://fantasyanime.com/legacy/earthb_maps.htm',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/snes/earthbound/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Onett Theme', 'Because I Love You', 'Pokey Means Business!'],
    ostComposers: [{ name: 'Keiichi Suzuki', role: 'composer' }],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/EarthBound',
    },
  },
  {
    gameId: 'mega-man-x3-super-nintendo',
    title: 'Mega Man X3',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'vimms_lair',
        url: 'https://vimm.net/manual/4530',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Mega_Man_X3/Walkthrough',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/snes/megamanx3/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Opening Stage', 'Gravity Beetle', 'Doppler Stage 1'],
    ostComposers: [{ name: 'Kinuyo Yamashita', role: 'composer' }],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Mega_Man_X3',
    },
  },
  {
    gameId: 'suikoden-ii-playstation',
    title: 'Suikoden II',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'datassette',
        url: 'https://datassette.org/manuais/us-estados-unidos-jogos-playstation-sony-manuais/suikoden-ii-usa',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Suikoden_II/Walkthrough',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/playstation/suikodenii/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Into a World of Illusions', 'Gothic Neclord', 'La passione commuove la storia'],
    ostComposers: [
      { name: 'Miki Higashino', role: 'composer' },
      { name: 'Keiko Fukami', role: 'composer' },
    ],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Suikoden_II',
    },
  },
  {
    gameId: 'castlevania-dracula-x-super-nintendo',
    title: 'Castlevania: Dracula X',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/dx-manual-snes/',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/dx-maps/',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/dx-sprites/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Beginning', 'Bloodlines', 'Blood Tears'],
    ostComposers: [{ name: 'Tomoya Tomita', role: 'composer' }],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Castlevania:_Dracula_X',
    },
  },
  {
    gameId: 'metal-slug-3-neo-geo',
    title: 'Metal Slug 3',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'tosec_pix',
        url: 'https://data.spludlow.co.uk/tosec/tosec-pix/SNK%20Neo-Geo%20AES%20-%20Manuals%20-%20Games/Metal%20Slug%203%20%282000%29%28SNK%29%28JP%29',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Metal_Slug_3',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/neo_geo_ngcd/ms3/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Blue Water Fangs', 'Midnight Wandering', 'Final Attack'],
    ostComposers: [{ name: 'SNK Sound Team', role: 'composer' }],
    composerSource: {
      provider: 'apple_music',
      url: 'https://music.apple.com/us/album/metal-slug-3/1142115849',
    },
  },
  {
    gameId: 'gunstar-heroes-sega-genesis',
    title: 'Gunstar Heroes',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'sega_retro',
        url: 'https://segaretro.org/File%3AGunstarheroes_md_us_manual.pdf',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Gunstar_Heroes/Table_of_Contents',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/genesis_32x_scd/gunstarheroes/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['The Brave Hero', 'Flying Battleship', 'The End of the Battle'],
    ostComposers: [{ name: 'Norio Hanzawa', role: 'composer' }],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Gunstar_Heroes',
    },
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
      manual_url,
      ost_notable_tracks,
      ost_composers
    FROM games
    WHERE id IN (${gameIds.map(() => '?').join(', ')})
  `).all(...gameIds)

  return rows.reduce((acc, row) => {
    acc[String(row.id)] = {
      manualUrl: row.manual_url || null,
      ostNotableTracks: row.ost_notable_tracks || null,
      ostComposers: row.ost_composers || null,
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
    'g5-premium-lot-2'
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
    ) VALUES (?, 'g5_premium_lot_2', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'Premium lot 2 media and music uplift')

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
    ostTrackUpdates: 0,
    composerUpdates: 0,
    mediaReferencesPlanned: {
      manual: 0,
      map: 0,
      sprite_sheet: 0,
    },
  }

  for (const entry of payload) {
    const state = before[entry.gameId] || {}
    if (!state.manualUrl && entry.media.some((media) => media.mediaType === 'manual')) {
      summary.manualUrlsAdded += 1
    }
    if (!state.ostNotableTracks) {
      summary.ostTrackUpdates += 1
    }
    if (entry.ostComposers && (!state.ostComposers || state.ostComposers !== stringifyJson(entry.ostComposers))) {
      summary.composerUpdates += 1
    }
    for (const media of entry.media) {
      summary.mediaReferencesPlanned[media.mediaType] += 1
    }
  }

  return summary
}

function applyEnrichment(db, payload) {
  const timestamp = nowIso()
  const runKey = `g5-premium-lot-2-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: payload.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G5 premium lot 2 applied locally on staging sqlite',
    manualUrlsAdded: 0,
    ostTracksUpdated: 0,
    composersUpdated: 0,
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
    mediaReferencesTouched: {
      manual: 0,
      map: 0,
      sprite_sheet: 0,
    },
  }

  const transaction = db.transaction(() => {
    for (const entry of payload) {
      const row = db.prepare(`
        SELECT manual_url, ost_notable_tracks, ost_composers
        FROM games
        WHERE id = ?
      `).get(entry.gameId)

      if (!row) {
        metrics.itemsFlagged += 1
        continue
      }

      const tracksJson = stringifyJson(entry.ostTracks)
      const tracksSourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
        fieldName: 'ost_notable_tracks',
        provider: 'internal',
        sourceType: 'knowledge_registry',
        complianceStatus: 'approved',
        confidenceLevel: 0.78,
        notes: 'G5 curated notable tracks for premium lot 2',
      }), timestamp)
      metrics.sourceRecordsTouched += 1

      db.prepare(`
        UPDATE games
        SET ost_notable_tracks = ?
        WHERE id = ?
      `).run(tracksJson, entry.gameId)
      ensureFieldProvenance(db, entry.gameId, 'ost_notable_tracks', tracksSourceId, tracksJson, timestamp, 0.78)
      metrics.provenanceTouched += 1
      metrics.ostTracksUpdated += 1

      const composersJson = stringifyJson(entry.ostComposers)
      const composerSourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
        fieldName: 'ost_composers',
        provider: entry.composerSource.provider,
        url: entry.composerSource.url,
        sourceType: 'external_reference',
        complianceStatus: 'approved_with_review',
        confidenceLevel: 0.74,
        notes: 'G5 composer correction for premium lot 2',
      }), timestamp)
      metrics.sourceRecordsTouched += 1

      db.prepare(`
        UPDATE games
        SET ost_composers = ?
        WHERE id = ?
      `).run(composersJson, entry.gameId)
      ensureFieldProvenance(db, entry.gameId, 'ost_composers', composerSourceId, composersJson, timestamp, 0.74)
      metrics.provenanceTouched += 1
      metrics.composersUpdated += 1

      for (const media of entry.media) {
        const sourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: media.sourceField,
          provider: media.provider,
          url: media.url,
          sourceType: 'external_reference',
          complianceStatus: 'approved_with_review',
          confidenceLevel: 0.76,
          notes: `G5 ${media.mediaType} reference`,
        }), timestamp)
        metrics.sourceRecordsTouched += 1

        upsertMediaReference(db, entry.gameId, media, sourceId, timestamp)
        metrics.mediaReferencesTouched[media.mediaType] += 1

        if (media.mediaType === 'manual') {
          db.prepare(`
            UPDATE games
            SET manual_url = ?
            WHERE id = ?
          `).run(media.url, entry.gameId)
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
    const existingGameIds = findGameIds(db, G5_PAYLOAD)
    const missingGameIds = G5_PAYLOAD
      .map((entry) => entry.gameId)
      .filter((gameId) => !existingGameIds.has(gameId))

    if (missingGameIds.length) {
      throw new Error(`Missing target games in sqlite: ${missingGameIds.join(', ')}`)
    }

    const planned = buildPlannedSummary(db, G5_PAYLOAD)
    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: planned,
        targets: G5_PAYLOAD.map((entry) => ({
          gameId: entry.gameId,
          title: entry.title,
          mediaTypes: entry.media.map((media) => media.mediaType),
          ostTracks: entry.ostTracks.length,
          composerUpdate: Boolean(entry.ostComposers),
        })),
      }, null, 2))
      return
    }

    const result = applyEnrichment(db, G5_PAYLOAD)
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
