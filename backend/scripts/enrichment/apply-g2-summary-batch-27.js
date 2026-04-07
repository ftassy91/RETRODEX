#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // NES — wave 4 (remaining B titles, verified IDs)
  {
    gameId: 'bakushou-kinsey-gekijou-nes',
    title: 'Bakushou!! Kinsey Gekijou',
    summary: 'Taito\'s 1989 Japan-only NES game is a comedy quiz show simulation based on a Japanese television program, challenging players with trivia questions in a licensed entertainment format exclusive to the domestic Famicom market.',
  },
  {
    gameId: 'bakusho-star-monomane-shitenno-nes',
    title: 'Bakushō! Star Monomane Shitennō',
    summary: 'CBS Sony\'s 1989 Japan-only NES party game is based on a Japanese celebrity impression TV show, tasking players with mimicry mini-games in a licensed entertainment title that never left the domestic Famicom market.',
  },
  {
    gameId: 'baltron-nes',
    title: 'Baltron',
    summary: 'Nippon Soft\'s 1985 Japan-only NES shooter is an early Famicom horizontal shoot-\'em-up with a modular spacecraft navigating enemy formations, representing the platform\'s foundational space shooter genre before licensed arcade ports dominated the market.',
  },
  {
    gameId: 'banana-prince-nes',
    title: 'Banana Prince',
    summary: 'T&E Soft\'s 1992 Japan-only NES platformer follows a young prince on a colorful adventure through tropical environments, offering late-era Famicom platform action that arrived as the console\'s lifecycle was drawing to a close.',
  },
  {
    gameId: 'bandai-golf-challenge-pebble-beach-nes',
    title: 'Bandai Golf: Challenge Pebble Beach',
    summary: 'Bandai\'s 1989 NES golf simulation features the famous Pebble Beach course in a licensed recreation, offering 18 holes with a top-down course view and wind simulation in one of the NES library\'s more course-authentic golf titles.',
  },
  {
    gameId: 'barcode-world-nes',
    title: 'Barcode World',
    summary: 'Epoch\'s 1992 Japan-only NES game used the Barcode Boy accessory to scan real-world barcodes and generate game characters, representing an early and unusual example of real-world data integration as a core game mechanic on home console hardware.',
  },
  {
    gameId: 'barker-bill-s-trick-shooting-nes',
    title: "Barker Bill's Trick Shooting",
    summary: 'Nintendo\'s 1990 NES Zapper light-gun game features a carnival shooting gallery host presenting target challenges across multiple skill levels, expanding the NES Zapper\'s software library with a dedicated trick-shooting challenge collection.',
  },
  {
    gameId: 'baseball-simulator-1-000-nes',
    title: 'Baseball Simulator 1.000',
    summary: 'Culture Brain\'s 1989 NES baseball game introduced superhuman special pitches and batting powers that allowed players to curve baseballs in physically impossible ways, blending realistic statistical baseball management with fantasy sport spectacle.',
  },
  {
    gameId: 'baseball-stars-2-nes',
    title: 'Baseball Stars 2',
    summary: 'SNK\'s 1992 NES sequel to Baseball Stars expands the team-building franchise format with additional players and improved animations, continuing the battery-save roster management system that made the original a landmark in NES sports game design.',
  },
  {
    gameId: 'bases-loaded-3-nes',
    title: 'Bases Loaded 3',
    summary: 'Jaleco\'s third NES Bases Loaded installment continues the pitching-perspective baseball franchise with refined rosters and improved presentation, maintaining the series\' characteristic detailed player statistics and full season management options.',
  },
  {
    gameId: 'bases-loaded-4-nes',
    title: 'Bases Loaded 4',
    summary: 'Jaleco\'s fourth and final NES entry in the Bases Loaded series represents the culmination of the franchise\'s NES run, refining the established pitching-camera baseball mechanics with the deepest statistical management of any title in the series.',
  },
  {
    gameId: 'bases-loaded-ii-second-season-nes',
    title: 'Bases Loaded II: Second Season',
    summary: 'Jaleco\'s 1990 NES sequel to the original Bases Loaded introduces a second season of play with updated rosters, expanding the pitching-perspective baseball formula with new teams and improved fielding mechanics over its predecessor.',
  },
  {
    gameId: 'bats-terry-nes',
    title: 'Bats & Terry',
    summary: 'Tecmo\'s 1987 Japan-only NES action game casts players as a bat and a young boy navigating cave environments, an early Famicom release combining animal companion gameplay with platforming in an unusual co-operative premise.',
  },
  // Super Nintendo — wave 3 (A-B range, verified IDs)
  {
    gameId: '3-ninjas-kick-back-super-nintendo',
    title: '3 Ninjas Kick Back',
    summary: 'DTMC\'s SNES adaptation of the 1994 family film sends three young ninjas through side-scrolling stages across Japan, offering a competent but conventional licensed platformer based on the martial arts comedy film sequel.',
  },
  {
    gameId: 'a-train-iii-super-version-super-nintendo',
    title: 'A-Train III - Super Version',
    summary: 'Artdink\'s SNES port of the PC construction simulator challenges players to build and manage a profitable rail network, translating the complex train empire management simulation to console with mouse-peripheral support for the Super Famicom.',
  },
  {
    gameId: 'acme-animation-factory-super-nintendo',
    title: 'Acme Animation Factory',
    summary: 'Sunsoft\'s SNES creative tool lets players produce their own cartoons using Looney Tunes characters and backgrounds, providing a sprite animation studio application for the Super Nintendo with a library of Bugs Bunny and Daffy Duck assets.',
  },
  {
    gameId: 'adventures-of-yogi-bear-super-nintendo',
    title: 'Adventures of Yogi Bear',
    summary: 'Cybersoft\'s SNES platformer based on the Hanna-Barbera cartoon sends Yogi Bear through Jellystone Park environments, offering a standard licensed platformer built around the iconic picnic-basket-stealing bear in an early 1990s television tie-in.',
  },
  {
    gameId: 'air-cavalry-super-nintendo',
    title: 'Air Cavalry',
    summary: 'Cybersoft\'s SNES helicopter simulation sends players on military rescue and combat missions with a first-person cockpit perspective, offering a flight-combat hybrid that combined arcade action with enough simulation depth to stand apart from pure action games.',
  },
  {
    gameId: 'andre-agassi-tennis-super-nintendo',
    title: 'Andre Agassi Tennis',
    summary: 'Absolute Entertainment\'s SNES tennis game uses the tennis superstar\'s likeness in an officially licensed sports title, providing standard court tennis gameplay across multiple surface types in a mid-era licensed sports release.',
  },
  {
    gameId: 'barbie-super-model-super-nintendo',
    title: 'Barbie: Super Model',
    summary: 'HI-TECH Expressions\' SNES Barbie game has the fashion doll navigating stages related to the modeling industry, offering a girl-targeted platformer adventure marketed alongside the toy line in a licensed product aimed at the Super Nintendo\'s broader demographic.',
  },
  {
    gameId: 'barbie-vacation-adventure-super-nintendo',
    title: 'Barbie: Vacation Adventure',
    summary: 'Hi Tech Expressions\' SNES Barbie title follows the fashion doll through holiday resort environments, providing a sequel to Super Model with similar marketing positioning as a licensed adventure game for younger female players on the platform.',
  },
  {
    gameId: 'bass-masters-classic-super-nintendo',
    title: 'Bass Masters Classic',
    summary: 'Black Pearl Software\'s SNES bass fishing simulation features licensed tournament venues and realistic bass behavior modeling, targeting the substantial North American fishing simulation audience with a focus on competitive angling tournament formats.',
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
          notes = 'G2 summary batch 27'
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
      'G2 summary batch 27'
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
    ) VALUES (?, 'g2_summary_batch_27', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 27 — NES wave 4 (B range final) + SNES wave 3 (A-B)')

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
  const runKey = `g2-summary-batch-27-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 27 applied locally on staging sqlite',
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
