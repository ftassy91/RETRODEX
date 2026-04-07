#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation 2 — wave 1 (20 games)
  {
    gameId: 'ace-combat-04-shattered-skies-playstation-2',
    title: 'Ace Combat 04: Shattered Skies',
    summary: 'Namco\'s PlayStation 2 aerial combat game follows fictional Mobius One through the liberation of Usea from the ISAF occupation, combining tight arcade dogfighting with a cinematic story narrated from the perspective of a boy on the ground, regarded as the series\' high point for its emotional storytelling and responsive flight model.',
  },
  {
    gameId: 'atv-offroad-fury-playstation-2',
    title: 'ATV Offroad Fury',
    summary: 'Rainbow Studios\' PlayStation 2 ATV racing launch title delivered fast off-road quad bike competition across open-terrain tracks and freestyle arenas, becoming one of the PS2\'s early pack-in titles and establishing the ATV racing genre on Sony\'s platform.',
  },
  {
    gameId: 'atv-offroad-fury-2-playstation-2',
    title: 'ATV Offroad Fury 2',
    summary: 'Rainbow Studios\' PlayStation 2 sequel expands the original Offroad Fury\'s track count and rider roster with online play support through the PS2\'s network adapter, building on the franchise\'s strong PS2 launch presence with more content and competitive multiplayer.',
  },
  {
    gameId: 'atv-offroad-fury-3-playstation-2',
    title: 'ATV Offroad Fury 3',
    summary: 'Climax Racing\'s PlayStation 2 third entry in the ATV franchise adds motocross bikes alongside quad vehicles and refines the outdoor racing with improved course design, continuing the series\' strong PS2 sales record as one of the platform\'s reliably commercial racing franchises.',
  },
  {
    gameId: 'atv-offroad-fury-4-playstation-2',
    title: 'ATV Offroad Fury 4',
    summary: 'Climax Racing\'s PlayStation 2 final entry in the Offroad Fury franchise delivers the most complete version of the series with expanded vehicle options and online multiplayer refinements, closing the four-game PS2 run of the ATV off-road racing franchise.',
  },
  {
    gameId: 'atv-quad-power-racing-2-playstation-2',
    title: 'ATV Quad Power Racing 2',
    summary: 'Juiced Games\' PlayStation 2 ATV racing sequel adds new vehicles and terrain types to the original\'s off-road format, offering an alternative in the growing PS2 ATV racing genre alongside the dominant Offroad Fury franchise.',
  },
  {
    gameId: 'and-1-streetball-playstation-2',
    title: 'AND 1 Streetball',
    summary: 'Ubisoft\'s PlayStation 2 basketball game based on the AND 1 streetball tour culture delivers playground street basketball with an emphasis on flashy dribble moves and showmanship over simulation, capturing the mixtape era\'s urban basketball performance aesthetic.',
  },
  {
    gameId: 'amf-xtreme-bowling-2006-playstation-2',
    title: 'AMF Xtreme Bowling 2006',
    summary: 'Bethesda Softworks\' PlayStation 2 AMF-licensed bowling title updates the franchise with 2006 content and an xtreme format emphasizing customization and style alongside standard lane competition, delivering a consumer bowling simulation with the AMF brand.',
  },
  {
    gameId: 'afl-premiership-2005-playstation-2',
    title: 'AFL Premiership 2005',
    summary: 'IR Gurus\' PlayStation 2 Australian Football League simulation delivers the 2005 AFL season with licensed teams and players for the domestic Australian market, continuing the studio\'s AFL simulation series on Sony\'s hardware.',
  },
  {
    gameId: 'afl-premiership-2006-playstation-2',
    title: 'AFL Premiership 2006',
    summary: 'IR Gurus\' PlayStation 2 AFL simulation updates the franchise for the 2006 season with new rosters and refined gameplay, maintaining the licensed Australian rules football series for domestic PS2 audiences.',
  },
  {
    gameId: 'afl-premiership-2007-playstation-2',
    title: 'AFL Premiership 2007',
    summary: 'IR Gurus\' PlayStation 2 final AFL simulation in the series covers the 2007 Australian Football League season, closing the studio\'s multi-year licensed AFL franchise on Sony\'s platform with the final domestic Australian rules football simulation.',
  },
  {
    gameId: '7-sins-playstation-2',
    title: '7 Sins',
    summary: 'Monte Cristo\'s PlayStation 2 social simulation places the player as a social climber in Apple City, seducing and manipulating high-society characters through the seven deadly sins as gameplay mechanics in a tongue-in-cheek adult-themed life simulator.',
  },
  {
    gameId: '7-wonders-of-the-ancient-world-playstation-2',
    title: '7 Wonders of the Ancient World',
    summary: 'Mumbo Jumbo\'s PlayStation 2 puzzle game challenges players to construct the Seven Wonders of the ancient world through match-3 building puzzles with historically themed art, adapting the PC casual game franchise to console-friendly control for PS2 audiences.',
  },
  {
    gameId: '2010-fifa-world-cup-south-africa-playstation-2',
    title: '2010 FIFA World Cup South Africa',
    summary: 'EA Sports\' PlayStation 2 World Cup tie-in delivers the official 2010 South Africa tournament with licensed national squads and qualification campaign modes, continuing the FIFA World Cup tie-in franchise on PS2 hardware into its twilight commercial period.',
  },
  {
    gameId: '2002-fifa-world-cup-playstation-2',
    title: '2002 FIFA World Cup',
    summary: 'EA Sports\' PlayStation 2 official tie-in to the Korea/Japan tournament delivers the full World Cup bracket with licensed national teams and a qualifying campaign mode, capitalizing on the first co-hosted World Cup with a dedicated Sony platform release.',
  },
  {
    gameId: '1943-kai-midway-kaisen-playstation-2',
    title: '1943 Kai: Midway Kaisen',
    summary: 'Capcom\'s PlayStation 2 port of the 1984 arcade vertical shoot-\'em-up delivers the World War II Pacific theater air combat classic with its stamina health system and upgrade-collecting gameplay loop, preserving the original arcade title for modern hardware.',
  },
  {
    gameId: '12riven-the-psi-climinal-of-integral-playstation-2',
    title: '12Riven: The Psi-Climinal of Integral',
    summary: 'CyberFront\'s Japan-only PlayStation 2 science fiction visual novel follows a protagonist with memory loss uncovering a conspiracy involving psychic experimentation, delivering a text-driven narrative with branching routes in the Japanese adventure game visual novel tradition.',
  },
  {
    gameId: 'hack-fragment-playstation-2',
    title: '.hack//Fragment',
    summary: 'Bandai\'s Japan-only PlayStation 2 online action RPG set in the fictional The World MMORPG universe allowed players to connect to actual servers alongside other players, representing a unique hybrid between offline RPG story and genuine online multiplayer participation within the .hack media franchise.',
  },
  {
    gameId: 'aa-megami-sama-playstation-2',
    title: 'Aa! Megami-sama!',
    summary: 'Banpresto\'s Japan-only PlayStation 2 action game based on the Ah! My Goddess manga and anime franchise follows Keiichi and the goddess Belldandy through supernatural adventure missions, delivering a licensed action title for fans of Kousuke Fujishima\'s long-running romantic comedy series.',
  },
  {
    gameId: 'abarenbo-princess-playstation-2',
    title: 'Abarenbo Princess',
    summary: 'A Japan-only PlayStation 2 action title starring a rough-mannered princess in combat-focused stages, combining the princess character archetype with brawler gameplay in a domestic Japanese release.',
  },
  // Sega CD — wave 1
  {
    gameId: 'snatcher-sega-cd',
    title: 'Snatcher',
    summary: 'Hideo Kojima\'s Sega CD cyberpunk visual novel follows amnesiac JUNKER agent Gillian Seed hunting android assassins called Snatchers in a dystopian Neo Kobe City, featuring branching investigation dialogue, shooting sequences, and a richly detailed noir science fiction world widely regarded as one of the defining works of the adventure game genre.',
  },
]

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

function ensureSourceRecord(db, gameId, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'summary'
      AND source_name = 'internal'
      AND source_type = 'knowledge_registry'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET compliance_status = 'approved',
          last_verified_at = ?,
          confidence_level = 0.8,
          notes = 'G2 summary batch 51'
      WHERE id = ?
    `).run(timestamp, existing.id)
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
      'internal',
      'knowledge_registry',
      NULL,
      NULL,
      'approved',
      ?,
      ?,
      0.8,
      'G2 summary batch 51'
    )
  `).run(gameId, timestamp, timestamp)

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, sourceRecordId, summary, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'summary'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  const valueHash = hashValue(summary)
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = 0.8,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, timestamp, existing.id)
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
    ) VALUES ('game', ?, 'summary', ?, ?, 0, 0.8, ?)
  `).run(gameId, sourceRecordId, valueHash, timestamp)
  return true
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
    ) VALUES (?, 'g2_summary_batch_51', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 51 — PS2 wave 1, Sega CD wave 1')

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
  `).run(
    timestamp,
    metrics.itemsSeen,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    metrics.notes,
    runId
  )
}

function readBefore(db, payload) {
  const rows = db.prepare(`
    SELECT id, summary
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))
  return new Map(rows.map((row) => [String(row.id), String(row.summary || '')]))
}

function dryRun(db) {
  const before = readBefore(db, G2_BATCH)
  return {
    targetedGames: G2_BATCH.length,
    summaryUpdates: G2_BATCH.filter((entry) => !before.get(entry.gameId).trim()).length,
    targets: G2_BATCH.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadSummaryBefore: Boolean(before.get(entry.gameId).trim()),
    })),
  }
}

function applyBatch(db) {
  const timestamp = nowIso()
  const runKey = `g2-summary-batch-51-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 51 applied locally on staging sqlite',
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of G2_BATCH) {
      const sourceRecordId = ensureSourceRecord(db, entry.gameId, timestamp)
      metrics.sourceRecordsTouched += 1

      db.prepare(`
        UPDATE games
        SET summary = ?
        WHERE id = ?
      `).run(entry.summary, entry.gameId)

      upsertGameEditorialSummary(db, entry.gameId, entry.summary, sourceRecordId, timestamp)
      ensureFieldProvenance(db, entry.gameId, sourceRecordId, entry.summary, timestamp)
      metrics.provenanceTouched += 1
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
    ensureGameIds(db, G2_BATCH)

    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: dryRun(db),
      }, null, 2))
      return
    }

    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: dryRun(db),
      result: applyBatch(db),
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
