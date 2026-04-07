#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // N64 — wave 3 (verified IDs only)
  {
    gameId: 'dr-mario-64-nintendo-64',
    title: 'Dr. Mario 64',
    summary: 'Nintendo\'s final N64 first-party release adapts the puzzle series to four-player multiplayer with a story mode and additional characters, delivering the virus-clearing capsule formula in an expanded competitive format.',
  },
  {
    gameId: 'excitebike-64-nintendo-64',
    title: 'Excitebike 64',
    summary: 'Left Field Productions\' N64 revival of the NES motocross classic shifts to full 3D with a season-based career mode, physics-driven track deformation, and a course editor that expanded the original\'s track-building concept.',
  },
  {
    gameId: 'f-1-world-grand-prix-nintendo-64',
    title: 'F-1 World Grand Prix',
    summary: 'Video System\'s N64 Formula 1 simulation delivers a licensed season mode across the official 1997 circuits with team management and setup options, targeting simulation depth in contrast to the era\'s more arcade-oriented racing competitors.',
  },
  {
    gameId: 'gauntlet-legends-nintendo-64',
    title: 'Gauntlet Legends',
    summary: 'Midway\'s N64 port of the arcade dungeon brawler supports four-player co-op through labyrinthine monster-filled stages with persistent character leveling, reviving the classic Gauntlet formula with RPG stat progression for a new hardware generation.',
  },
  {
    gameId: 'glover-nintendo-64',
    title: 'Glover',
    summary: 'Interactive Studios\' N64 platformer stars a living glove who guides a ball through three-dimensional environments by bouncing, dribbling, and bowling it across varied surface types, built around a physics-centric puzzle-platformer concept.',
  },
  {
    gameId: 'harvest-moon-64-nintendo-64',
    title: 'Harvest Moon 64',
    summary: 'Victor Interactive\'s N64 farming simulation expands the Super Famicom original with full 3D graphics, more characters, relationship depth, and seasonal events, bringing the pastoral life simulation franchise to North American audiences in its most ambitious console form.',
  },
  {
    gameId: 'air-boarder-64-nintendo-64',
    title: 'Air Boarder 64',
    summary: 'Hudson\'s N64 snowboarding game offers a compact roster of boards and courses in a straightforward extreme sports format, arriving early in the N64\'s library before the genre\'s definitive titles established the platform standard.',
  },
  {
    gameId: 'army-men-air-attack-nintendo-64',
    title: 'Army Men: Air Attack',
    summary: '3DO\'s N64 helicopter combat game sends plastic toy helicopters through aerial missions in the Army Men universe, offering third-person air combat across miniature-scale environments as a companion piece to the franchise\'s ground combat titles.',
  },
  // Sega Saturn — wave 4 (verified IDs)
  {
    gameId: 'alien-trilogy-sega-saturn',
    title: 'Alien Trilogy',
    summary: 'Probe Software\'s Saturn first-person shooter compresses all three original Alien films into a corridor-crawling mission set, putting a marine through xenomorph-infested environments with the franchise\'s characteristic industrial atmosphere.',
  },
  {
    gameId: 'albert-odyssey-legend-of-eldean-sega-saturn',
    title: 'Albert Odyssey: Legend of Eldean',
    summary: 'Sunsoft\'s Saturn action RPG follows a young boy raised by harpies discovering his human origins, offering real-time combat and aerial traversal in a fantasy narrative that received a Working Designs localization in North America.',
  },
  {
    gameId: 'area-51-sega-saturn',
    title: 'Area 51',
    summary: 'Atari Games\' Saturn port of the 1995 arcade light-gun shooter places soldiers through alien-infested government facility corridors, delivering the on-rails shooting gallery experience of the coin-op original to the home console.',
  },
  {
    gameId: 'assault-suit-leynos-2-sega-saturn',
    title: 'Assault Suit Leynos 2',
    summary: 'NCS\'s Japan-only Saturn sequel to the Genesis mecha shooter updates the series\' side-scrolling Assault Suit combat with improved visuals and new weapon systems, continuing the franchise\'s tradition of dense mechanical action.',
  },
  {
    gameId: 'baroque-sega-saturn',
    title: 'Baroque',
    summary: 'Sting\'s Japan-only Saturn roguelike dungeon crawler places an amnesiac protagonist through an ever-changing tower to reach the Archangel at its summit, with a cryptic narrative revealed piecemeal through death and rebirth cycles.',
  },
  {
    gameId: 'battle-arena-toshinden-sega-saturn',
    title: 'Battle Arena Toshinden',
    summary: 'Tamsoft\'s Saturn 3D fighting game was a PS1 launch showcase title whose Saturn port retained the weapon-based roster and ring-out mechanic, notable as an early weapon-fighting 3D title despite later criticism of its shallow mechanics.',
  },
  {
    gameId: 'batsugun-sega-saturn',
    title: 'Batsugun',
    summary: 'Toaplan\'s final arcade shoot-\'em-up receives a Saturn port with its original and Special versions, historically significant as a direct precursor to DonPachi and the birth of the bullet-hell scoring subgenre with its rank-based intensity scaling.',
  },
  {
    gameId: 'alone-in-the-dark-2-sega-saturn',
    title: 'Alone in the Dark 2',
    summary: 'Infogrames\' Saturn port of the horror adventure sequel shifts from Lovecraftian mystery to an action-focused gangster ghost story, replacing Carnby\'s investigative exploration with combat-centric gameplay across a haunted 1920s mansion.',
  },
  {
    gameId: 'batman-forever-the-arcade-game-sega-saturn',
    title: 'Batman Forever: The Arcade Game',
    summary: 'Acclaim\'s Saturn port of the 1996 arcade beat-\'em-up is a separate game from the film tie-in, offering two-player co-op brawling through Gotham with Batman and Robin against Two-Face and Riddler in a conventional scrolling fighter.',
  },
  // Genesis — wave 5 (verified IDs)
  {
    gameId: 'beyond-oasis-sega-genesis',
    title: 'Beyond Oasis',
    summary: 'Ancient\'s Genesis action RPG follows Prince Ali summoning elemental spirits across dungeon-filled environments in a top-down combat system, representing one of the platform\'s strongest late-era original RPGs with a fluid real-time combat design.',
  },
  {
    gameId: 'cannon-fodder-sega-genesis',
    title: 'Cannon Fodder',
    summary: 'Virgin Games\' Genesis port of the Sensible Software PC classic sends squads of soldiers through isometric military missions, combining dark satirical humor about the disposability of troops with demanding mission-based squad tactics.',
  },
  {
    gameId: 'captain-america-and-the-avengers-sega-genesis',
    title: 'Captain America and The Avengers',
    summary: 'Data East\'s Genesis port of the 1991 arcade brawler lets players choose from four Marvel heroes across stages fighting Red Skull\'s forces, offering the co-op beat-\'em-up action of the original coin-op in a scaled console adaptation.',
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
          notes = 'G2 summary batch 15'
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
      'G2 summary batch 15'
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
    ) VALUES (?, 'g2_summary_batch_15', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 15 — N64 wave 3, PS1 wave 5, SNES/Genesis wave 5')

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
  const runKey = `g2-summary-batch-15-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 15 applied locally on staging sqlite',
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
