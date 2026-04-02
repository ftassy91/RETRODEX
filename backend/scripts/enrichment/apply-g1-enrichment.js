#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G1_PAYLOAD = [
  {
    gameId: 'castlevania-rondo-of-blood-turbografx-16',
    title: 'Castlevania: Rondo of Blood',
    synopsis: 'Set in 1792 after Shaft revives Dracula, Richter Belmont storms the burning village outskirts and the vampire\'s castle to rescue four kidnapped maidens before the ritual is complete. Branching stages, secret routes, and Maria Renard\'s later arrival turn the game into a faster, more theatrical Castlevania built around alternate paths and repeated boss variations.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/rob-manual-text/',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/rob-maps/',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'castlevania_crypt',
        url: 'https://www.castlevaniacrypt.com/rob-sprites/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Overture', 'Divine Bloodlines', 'Dracula\'s Castle'],
    ostComposers: [{ name: 'Akira Souji', role: 'composer' }],
    composerSource: {
      provider: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Castlevania:_Rondo_of_Blood',
    },
  },
  {
    gameId: 'super-mario-bros-3-nintendo-entertainment-system',
    title: 'Super Mario Bros. 3',
    synopsis: 'After the Koopalings seize the seven Mushroom World kingdoms, Mario and Luigi cross a stage-play version of the realm to break their spell and reclaim the royal magic wands. The journey expands the series into an overworld adventure full of suits, minigames, airship battles, and route-based secrets that reward experimentation as much as raw platform skill.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'gaming_alexandria',
        url: 'https://www.gamingalexandria.com/wp/2019/04/super-mario-bros-3-2/',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/maps-nes-smb3/',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/sprites-nes-smb3/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['World Map 1', 'Athletic Theme', 'Airship Theme'],
  },
  {
    gameId: 'super-mario-64-nintendo-64',
    title: 'Super Mario 64',
    synopsis: 'Bowser invades Peach\'s Castle, traps its Power Stars inside living paintings, and dares Mario to recover them room by room before the castle falls completely under his control. Each course works like a compact 3D playground whose mission variants, movement tech, and layered secrets made free-roaming collection the heart of the adventure.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'internet_archive',
        url: 'https://ia601206.us.archive.org/27/items/Nintendo64GameManuals/SuperMario64a_text.pdf',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Super_Mario_64/Walkthrough',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/nintendo_64/supermario64/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Bob-omb Battlefield', 'Dire, Dire Docks', 'Slider'],
  },
  {
    gameId: 'kirby-adventure-nintendo-entertainment-system',
    title: 'Kirby\'s Adventure',
    synopsis: 'When the Fountain of Dreams stops working and Dream Land loses the power to sleep, Kirby sets out to recover the shattered Star Rod from King Dedede and the seven worlds beyond his castle. The quest slowly reveals that Dedede\'s theft was a desperate seal against Nightmare, giving the journey a more purposeful arc than the series\' earlier episodes.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'nintendo',
        url: 'https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NAAPE_en.pdf',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Kirby%27s_Adventure/Walkthrough',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/fullview/49192/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Vegetable Valley', 'Butter Building', 'Rainbow Resort'],
  },
  {
    gameId: 'super-mario-bros-nintendo-entertainment-system',
    title: 'Super Mario Bros.',
    synopsis: 'Bowser\'s army overruns the Mushroom Kingdom and turns its people into blocks, stones, and plants, leaving Princess Toadstool imprisoned in the final castle. Mario pushes through eight worlds of increasingly punishing stages to undo the transformation and establish the blueprint for console platformers.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'nintendo',
        url: 'https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NAAAE_en.pdf',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/maps-nes-smb/',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/sprites-nes-smb/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Ground Theme', 'Underground Theme', 'Underwater Theme'],
  },
  {
    gameId: 'earthworm-jim-sega-genesis',
    title: 'Earthworm Jim',
    synopsis: 'After a super-suit crashes onto an ordinary worm, Jim mutates into an elastic action hero and chases the stolen technology across a string of grotesque cartoon worlds. The campaign leaps from slapstick platforming to surreal set pieces, using bizarre enemies and one-off gimmicks to make every stage feel like a different animated short.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'manuals_plus',
        url: 'https://manuals.plus/m/ea661c9c9bb5e0ef48e023047d25467e731e1e51a30dc3b68af3e9a14ad27524',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'vgmaps',
        url: 'https://www.vgmaps.com/NewsArchives/MapsOfTheMonth-2020.htm',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/sega_genesis_32x/earthwormjim/sheet/67919/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['New Junk City', 'What the Heck?', 'For Pete\'s Sake!'],
  },
  {
    gameId: 'mario-and-luigi-bowsers-inside-story-nintendo-ds',
    title: 'Mario & Luigi: Bowser\'s Inside Story',
    synopsis: 'A plague of the Blorbs throws the Mushroom Kingdom into chaos just as Fawful manipulates Bowser into inhaling Mario, Luigi, Peach, and half the court. The adventure alternates between Bowser\'s body and the outside world, turning the brothers\' microscopic repairs and Bowser\'s brute-force rampage into two halves of the same RPG campaign.',
    media: [
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'strategywiki',
        url: 'https://strategywiki.org/wiki/Mario_%26_Luigi%3A_Bowser%27s_Inside_Story/Walkthrough',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/sprites-ds-mlbis/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['The Grand Finale', 'Deep Castle', 'In the Final'],
  },
  {
    gameId: 'super-mario-land-2-game-boy',
    title: 'Super Mario Land 2: 6 Golden Coins',
    synopsis: 'While Mario is away, Wario seizes Mario Land and locks the castle behind six golden coins hidden in separate themed zones. The game replaces the first Super Mario Land\'s straight arcade pacing with a hub-world structure, stranger enemy designs, and a clearer sense of Mario exploring territory that has been taken over and twisted.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'vimms_lair',
        url: 'https://vimm.net/manual/2470',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/maps-gb-sml2/',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'mario_universe',
        url: 'https://www.mariouniverse.com/sprites-gb-sml2/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Overworld Theme', 'Athletic Theme', 'Wario\'s Castle'],
  },
  {
    gameId: 'alex-kidd-in-miracle-world-sega-master-system',
    title: 'Alex Kidd in Miracle World',
    synopsis: 'A dying stranger sends Alex Kidd back toward Radactian with a map fragment and a warning that Janken the Great is preparing to conquer the city. What starts as a simple rescue mission turns into a globe-spanning quest of vehicles, boss duels, and royal family secrets that establish the series\' odd fairy-tale tone.',
    media: [
      {
        mediaType: 'manual',
        assetSubtype: 'manual',
        provider: 'smspower',
        url: 'https://www.smspower.org/Manuals/AlexKiddInMiracleWorld-SMS-US',
        sourceField: 'manual_reference',
      },
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'smspower',
        url: 'https://www.smspower.org/Maps/AlexKiddInMiracleWorld-SMS',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'assorted_sprites',
        provider: 'smspower',
        url: 'https://www.smspower.org/Sprites/AlexKiddInMiracleWorld-SMS',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Main Theme', 'Lake Fathom', 'Janken Castle'],
  },
  {
    gameId: 'makaimura-for-wonderswan-wonderswan',
    title: 'Makaimura for WonderSwan',
    synopsis: 'Arthur once again descends into a demon-haunted countryside after the forces of the underworld seize Princess Prin-Prin, but this WonderSwan version reframes the arcade original as a portable reinterpretation rather than a straight port. Its smaller screen and revised pacing keep the same armor-stripping brutality while compressing the journey into a tighter handheld loop.',
    media: [
      {
        mediaType: 'map',
        assetSubtype: 'atlas_map',
        provider: 'vgmaps',
        url: 'https://www.vgmaps.com/Atlas/WS-WSC/index.htm',
        sourceField: 'map_reference',
      },
      {
        mediaType: 'sprite_sheet',
        assetSubtype: 'character_pose_sheet',
        provider: 'spriters_resource',
        url: 'https://www.spriters-resource.com/wonderswan_wsc/makaimura/sheet/13719/',
        sourceField: 'sprite_sheet_reference',
      },
    ],
    ostTracks: ['Stage 1 & 2', 'Stage 3 & 4', 'Theme of the Giant'],
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

function getSummaryBefore(db, gameIds) {
  const rows = db.prepare(`
    SELECT
      id,
      synopsis,
      manual_url,
      ost_notable_tracks,
      ost_composers
    FROM games
    WHERE id IN (${gameIds.map(() => '?').join(', ')})
  `).all(...gameIds)

  return rows.reduce((acc, row) => {
    acc[String(row.id)] = {
      synopsis: row.synopsis || null,
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

function upsertGameEditorialSynopsis(db, gameId, synopsis, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_editorial (
      game_id,
      synopsis,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      synopsis = excluded.synopsis,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(gameId, synopsis, sourceRecordId, timestamp, timestamp)
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
    'g1-premium-media'
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
    ) VALUES (?, 'g1_enrichment', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G1A/G1B/G1C premium enrichment lot')

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
  const before = getSummaryBefore(db, payload.map((entry) => entry.gameId))
  const summary = {
    targetedGames: payload.length,
    synopsisUpdates: 0,
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
    if (!state.synopsis) {
      summary.synopsisUpdates += 1
    }
    if (!state.manualUrl && entry.media.some((media) => media.mediaType === 'manual')) {
      summary.manualUrlsAdded += 1
    }
    if (!state.ostNotableTracks) {
      summary.ostTrackUpdates += 1
    }
    if (entry.ostComposers && !state.ostComposers) {
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
  const runKey = `g1-enrichment-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: payload.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G1A/G1B/G1C applied locally on staging sqlite',
    synopsisUpdated: 0,
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
        SELECT synopsis, manual_url, ost_notable_tracks, ost_composers
        FROM games
        WHERE id = ?
      `).get(entry.gameId)

      if (!row) {
        metrics.itemsFlagged += 1
        continue
      }

      const synopsisSourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
        fieldName: 'synopsis',
        provider: 'internal',
        sourceType: 'knowledge_registry',
        complianceStatus: 'approved',
        confidenceLevel: 0.82,
        notes: 'G1A curated synopsis',
      }), timestamp)
      metrics.sourceRecordsTouched += 1

      upsertGameEditorialSynopsis(db, entry.gameId, entry.synopsis, synopsisSourceId, timestamp)
      db.prepare(`
        UPDATE games
        SET synopsis = ?
        WHERE id = ?
      `).run(entry.synopsis, entry.gameId)
      ensureFieldProvenance(db, entry.gameId, 'synopsis', synopsisSourceId, entry.synopsis, timestamp, 0.82)
      metrics.provenanceTouched += 1
      metrics.synopsisUpdated += 1

      const tracksJson = stringifyJson(entry.ostTracks)
      const tracksSourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
        fieldName: 'ost_notable_tracks',
        provider: 'internal',
        sourceType: 'knowledge_registry',
        complianceStatus: 'approved',
        confidenceLevel: 0.78,
        notes: 'G1C curated notable tracks',
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

      if (entry.ostComposers) {
        const composersJson = stringifyJson(entry.ostComposers)
        const composerSourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: 'ost_composers',
          provider: entry.composerSource.provider,
          url: entry.composerSource.url,
          sourceType: 'external_reference',
          complianceStatus: 'approved_with_review',
          confidenceLevel: 0.74,
          notes: 'G1C composer correction',
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
      }

      for (const media of entry.media) {
        const sourceId = ensureSourceRecord(db, entry.gameId, buildSourceDescriptor({
          fieldName: media.sourceField,
          provider: media.provider,
          url: media.url,
          sourceType: 'external_reference',
          complianceStatus: 'approved_with_review',
          confidenceLevel: 0.76,
          notes: `G1B ${media.mediaType} reference`,
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
    const existingGameIds = findGameIds(db, G1_PAYLOAD)
    const missingGameIds = G1_PAYLOAD
      .map((entry) => entry.gameId)
      .filter((gameId) => !existingGameIds.has(gameId))

    if (missingGameIds.length) {
      throw new Error(`Missing target games in sqlite: ${missingGameIds.join(', ')}`)
    }

    const planned = buildPlannedSummary(db, G1_PAYLOAD)
    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: planned,
        targets: G1_PAYLOAD.map((entry) => ({
          gameId: entry.gameId,
          title: entry.title,
          mediaTypes: entry.media.map((media) => media.mediaType),
          ostTracks: entry.ostTracks.length,
          composerUpdate: Boolean(entry.ostComposers),
        })),
      }, null, 2))
      return
    }

    const result = applyEnrichment(db, G1_PAYLOAD)
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
