#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation — wave 7 (G through M range, French-placeholder replacements)
  {
    gameId: 'intelligent-qube-playstation',
    title: 'Intelligent Qube',
    summary: "G-Artist's 1997 PlayStation puzzle game places a character on a shrinking platform who must neutralize incoming rolling cubes by marking and detonating floor squares in the correct sequence, a tense minimalist puzzle game that became a Sony flagship title in Japan.",
  },
  {
    gameId: 'klonoa-door-to-phantomile-playstation',
    title: 'Klonoa: Door to Phantomile',
    summary: "Namco's 1997 PlayStation 2.5D platformer follows the dream traveler Klonoa through a storybook world using a wind ring to grab and throw enemies as projectiles or platforms, a visually lush and emotionally resonant game that concluded with a surprisingly dark narrative turn.",
  },
  {
    gameId: 'legend-of-mana-playstation',
    title: 'Legend of Mana',
    summary: "Square's 2000 PlayStation action RPG abandons the linear narrative of prior Mana entries for a non-linear artifact-placement world-building system where players shape the map to unlock disconnected story arcs, an experimental design with striking watercolor artwork.",
  },
  {
    gameId: 'lunar-silver-star-story-playstation',
    title: 'Lunar: Silver Star Story',
    summary: "Game Arts' 1996 Sega CD remake arrived on PlayStation in 1999 via Working Designs with fully voiced anime cutscenes, orchestrated music, and expanded content, a beloved JRPG following Alex's journey to become Dragonmaster that defined Western expectations for Working Designs localizations.",
  },
  {
    gameId: 'medal-of-honor-playstation',
    title: 'Medal of Honor',
    summary: "DreamWorks Interactive's 1999 PlayStation first-person shooter set the template for World War II games with its immersive OSS agent missions, Hans Zimmer score, and emphasis on historical authenticity, a Spielberg-produced project that launched a significant franchise.",
  },
  {
    gameId: 'mega-man-legends-playstation',
    title: 'Mega Man Legends',
    summary: "Capcom's 1997 PlayStation action-adventure reimagines Mega Man as a 3D treasure-hunting Digger exploring ruins for energy crystals, shifting the series from action platformer to exploration RPG with a charming cast and a fully voiced narrative set centuries in the future.",
  },
  {
    gameId: 'mega-man-x4-playstation',
    title: 'Mega Man X4',
    summary: "Capcom's 1997 PlayStation action platformer is the first X game built natively for 32-bit hardware, introducing fully animated anime cutscenes and a dual-character campaign playable as either X or Zero with distinct combat systems for each character.",
  },
  {
    gameId: 'mr-driller-playstation',
    title: 'Mr. Driller',
    summary: "Namco's 1999 PlayStation arcade puzzle game challenges players to drill downward through colored block columns without being crushed, balancing oxygen management against speed in a deceptively deep puzzle game that spawned a long-running Namco series.",
  },
  // Nintendo 64 — wave 6 (remaining French-placeholder replacements)
  {
    gameId: 'conkers-bad-fur-day-nintendo-64',
    title: "Conker's Bad Fur Day",
    summary: "Rare's 2001 N64 platformer transformed a planned family game into a profanity-laden adult parody filled with film references, scatological humor, and technically impressive graphics, a late N64 exclusive that deliberately subverted Nintendo platform conventions.",
  },
  {
    gameId: 'lylat-wars-nintendo-64',
    title: 'Lylat Wars',
    summary: "Nintendo's 1997 on-rails space shooter known as Star Fox 64 in North America revived the Super FX-era series with the Rumble Pak accessory's debut, adding all-range free-roaming dogfights and branching mission paths across the Lylat system's asteroid fields and planets.",
  },
  {
    gameId: 'ogre-battle-64-nintendo-64',
    title: 'Ogre Battle 64',
    summary: "Quest's 2000 N64 real-time tactical RPG places military units across large maps with automated squad combat resolved through card-flip mechanics, continuing the political narrative depth of the Ogre Battle series in its only Nintendo 64 entry.",
  },
  {
    gameId: 'pilotwings-64-nintendo-64',
    title: 'Pilotwings 64',
    summary: "Nintendo's 1996 N64 launch title expanded the SNES flight simulation formula to three dimensions with hang gliding, rocketbelt, gyrocopter, and skydiving activities set in realistically scaled environments including a miniature Statue of Liberty island.",
  },
  {
    gameId: 'pokemon-puzzle-league-nintendo-64',
    title: 'Pokemon Puzzle League',
    summary: "Nintendo's 2000 N64 puzzle game applies a Pokemon visual theme to the Panel de Pon tile-swapping mechanics introduced in Tetris Attack, offering a story mode with gym leader progression that gave the puzzle game a Pokemon Tournament narrative wrapper.",
  },
  {
    gameId: 'pokemon-stadium-2-nintendo-64',
    title: 'Pokemon Stadium 2',
    summary: "Nintendo's 2001 N64 battle simulator expanded the original's Pokemon roster to the full Gold and Silver generation with 251 Pokemon, adding the Poke Cup and Challenge Cup modes alongside a Gym Leader Castle campaign and Transfer Pak compatibility with Game Boy titles.",
  },
  {
    gameId: 'pokemon-snap-nintendo-64',
    title: 'Pokemon Snap',
    summary: "HAL Laboratory's 1999 N64 photography game sends Professor Oak's assistant on an on-rails journey through Pokemon Island to photograph wild Pokemon in their habitats, a genre-unique exploration of the Pokemon universe focused on observation rather than combat.",
  },
  {
    gameId: 'pokemon-stadium-nintendo-64',
    title: 'Pokemon Stadium',
    summary: "Nintendo's 2000 N64 battle simulator brought the first 151 Pokemon to full 3D for Stadium mode tournament play, offering Transfer Pak support to use Game Boy teams and a Kids Club mini-game collection alongside the Gym Leader Castle challenge.",
  },
  {
    gameId: 'star-fox-64-nintendo-64',
    title: 'Star Fox 64',
    summary: "Nintendo's 1997 N64 on-rails space shooter introduced fully voiced characters, the Rumble Pak, branching mission routes through the Lylat system, and all-range mode dogfights, revitalizing the Star Fox franchise from the SNES Super FX original into a defining N64 action title.",
  },
  {
    gameId: 'super-smash-bros-nintendo-64',
    title: 'Super Smash Bros.',
    summary: "HAL Laboratory's 1999 N64 fighter launched the crossover platform-fighting genre by assembling twelve Nintendo mascots in percentage-damage brawls on destructible stages, a concept that began as an internal experiment and became one of Nintendo's most enduring competitive franchises.",
  },
  {
    gameId: 'turok-dinosaur-hunter-nintendo-64',
    title: 'Turok: Dinosaur Hunter',
    summary: "Iguana Entertainment's 1997 N64 launch-window first-person shooter brought the Dark Horse comic's jungle dinosaur hunter to 3D with a fog-limited but technically impressive engine, launching a series of N64 shooters that demonstrated the console's capabilities in the FPS genre.",
  },
  {
    gameId: 'yoshis-story-nintendo-64',
    title: "Yoshi's Story",
    summary: "Nintendo's 1997 N64 platformer follows baby Yoshis eating fruit across storybook stages illustrated in a picture-book aesthetic, a deliberately short and cheerful experience designed around score optimization through fruit variety rather than the difficulty of its SNES predecessor.",
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
          notes = 'G2 summary batch 36'
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
      'G2 summary batch 36'
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
    ) VALUES (?, 'g2_summary_batch_36', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 36 — PS1 wave 7 (G-M), N64 wave 6 (remaining)')

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
  const runKey = `g2-summary-batch-36-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 36 applied locally on staging sqlite',
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
