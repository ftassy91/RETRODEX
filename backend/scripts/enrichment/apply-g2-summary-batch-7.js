#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Saturn — priority missing summaries
  {
    gameId: 'contra-legacy-of-war-sega-saturn',
    title: 'Contra: Legacy of War',
    summary: 'Konami\'s 3D take on the Contra franchise shifts the series to an isometric perspective, trading the side-scrolling intensity of the classics for a top-down stage structure that divided the fanbase.',
  },
  // Game Boy — priority missing summaries
  {
    gameId: 'castlevania-legends-game-boy',
    title: 'Castlevania Legends',
    summary: 'Konami\'s Game Boy Castlevania introduces Sonia Belmont as the first playable Belmont, featuring traditional whip-based stages and a soul-collection subweapon system across five monster-filled chapters.',
  },
  {
    gameId: 'contra-iii-the-alien-wars-game-boy',
    title: 'Contra III: The Alien Wars',
    summary: 'A scaled-down portable adaptation of the SNES classic, retaining the franchise\'s run-and-gun action in a compact format while condensing the original\'s rotating overhead stages for Game Boy hardware.',
  },
  // PlayStation — strong candidates
  {
    gameId: 'alundra-playstation',
    title: 'Alundra',
    summary: 'Matrix Software\'s action RPG channels the spirit of Zelda with darker storytelling, pairing top-down dungeon puzzles with challenging combat as a dreamwalker investigates the curse consuming a remote village.',
  },
  {
    gameId: 'azure-dreams-playstation',
    title: 'Azure Dreams',
    summary: 'Konami\'s roguelike hybrid tasks a young monster tamer with ascending a procedural tower while managing town-building between runs, blending dungeon randomness with simulation and relationship mechanics.',
  },
  {
    gameId: 'breath-of-fire-iii-playstation',
    title: 'Breath of Fire III',
    summary: 'Capcom\'s third RPG entry spans two time periods with a dragon transformation system and a master-apprentice skill inheritance mechanic, building toward one of the series\' most narratively ambitious conclusions.',
  },
  // GBA — confirmed present in SQLite
  {
    gameId: 'castlevania-aria-of-sorrow-game-boy-advance',
    title: 'Castlevania: Aria of Sorrow',
    summary: 'Konami\'s GBA Castlevania introduces the soul-absorption system, letting players collect enemy powers across a soul-gated castle in one of the platform\'s strongest portable Metroidvania entries.',
  },
  {
    gameId: 'castlevania-harmony-of-dissonance-game-boy-advance',
    title: 'Castlevania: Harmony of Dissonance',
    summary: 'Konami\'s second GBA Castlevania features a dual-castle structure and expanded subweapon spell combos, continuing the Symphony-era design language in a more labyrinthine portable format.',
  },
  {
    gameId: 'castlevania-circle-of-the-moon-game-boy-advance',
    title: 'Castlevania: Circle of the Moon',
    summary: 'The GBA launch Castlevania introduces the DSS card-combo mechanic for stat building, delivering a dark and demanding Metroidvania with a different rhythmic feel from the Symphony of the Night line.',
  },
  // NDS — confirmed present in SQLite
  {
    gameId: 'advance-wars-days-of-ruin-nintendo-ds',
    title: 'Advance Wars: Days of Ruin',
    summary: 'The post-apocalyptic fourth Advance Wars rebuilds the formula with a continuous-growth CO system, more grounded mechanics, and a narrative tone sharply distinct from the franchise\'s prior entries.',
  },
  {
    gameId: 'castlevania-dawn-of-sorrow-nintendo-ds',
    title: 'Castlevania: Dawn of Sorrow',
    summary: 'Konami\'s DS Castlevania continues Aria of Sorrow\'s soul mechanics with dual-screen interfaces, seal-drawing boss finishers, and a sprawling castle that extends the GBA formula to handheld DS hardware.',
  },
  {
    gameId: 'castlevania-order-of-ecclesia-nintendo-ds',
    title: 'Castlevania: Order of Ecclesia',
    summary: 'Konami\'s most demanding DS Castlevania features the Glyph system for absorbing and equipping enemy abilities, placing Shanoa in a segmented world structure with the series\' greatest mechanical depth to date.',
  },
  // N64 — confirmed present in SQLite
  {
    gameId: 'body-harvest-nintendo-64',
    title: 'Body Harvest',
    summary: 'DMA Design\'s open-world action game places a soldier across five time periods to stop alien harvests, using free-roaming missions and vehicle acquisition that foreshadow the studio\'s later open-world work.',
  },
  {
    gameId: 'bomberman-64-nintendo-64',
    title: 'Bomberman 64',
    summary: 'Hudson\'s N64 Bomberman transitions the series to full 3D with multi-platform puzzle stages and a story mode, retaining the four-player battle mode that anchored the franchise\'s multiplayer appeal.',
  },
  {
    gameId: 'bomberman-hero-nintendo-64',
    title: 'Bomberman Hero',
    summary: 'Hudson\'s second N64 Bomberman leans into 3D platformer territory, sending Bomberman across a planet-hopping rescue mission with a stronger emphasis on exploration over arena combat.',
  },
  {
    gameId: 'bomberman-64-the-second-attack-nintendo-64',
    title: 'Bomberman 64: The Second Attack',
    summary: 'Hudson\'s third N64 entry adds an elemental upgrade system and a darker sci-fi narrative to the adventure platformer format, representing an ambitious late-era N64 title with a small audience.',
  },
  // Sega Saturn — confirmed present in SQLite
  {
    gameId: 'burning-rangers-sega-saturn',
    title: 'Burning Rangers',
    summary: 'Sonic Team\'s late Saturn action game casts players as futuristic firefighters navigating procedurally arranged rescue missions with audio-only navigation cues and a unique reputation-based revival system.',
  },
  {
    gameId: 'clockwork-knight-sega-saturn',
    title: 'Clockwork Knight',
    summary: 'Sega\'s Saturn launch platformer sends a toy soldier through oversized bedroom environments, using pre-rendered sprites and parallax scrolling to showcase the hardware alongside accessible 2D action.',
  },
  {
    gameId: 'bug-sega-saturn',
    title: 'Bug!',
    summary: 'Sega\'s isometric Saturn platformer follows an oversized ant through garden environments, serving as an early showcase of the hardware\'s 3D sprite-scaling with a deliberately exaggerated animation style.',
  },
  {
    gameId: 'clockwork-knight-2-sega-saturn',
    title: 'Clockwork Knight 2',
    summary: 'The Saturn sequel expands the toy-world environments with larger stages and new mechanics, improving pacing and correcting some structural limitations of the original launch title.',
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
          notes = 'G2 summary batch 7'
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
      'G2 summary batch 7'
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
    ) VALUES (?, 'g2_summary_batch_7', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 7 — multi-platform priority missing summaries')

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
  const runKey = `g2-summary-batch-7-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 7 applied locally on staging sqlite',
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
