#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy Advance — wave 2 (14 remaining)
  {
    gameId: 'arctic-tale-game-boy-advance',
    title: 'Arctic Tale',
    summary: 'Destineer\'s Game Boy Advance tie-in to the 2007 National Geographic documentary film follows polar bear and walrus characters through Arctic survival-themed gameplay, adapting the nature documentary\'s conservation themes into a children\'s portable adventure.',
  },
  {
    gameId: 'artifact-game-boy-advance',
    title: 'Artifact',
    summary: 'A Japan-only Game Boy Advance action-adventure title navigating dungeon environments with artifact collection as a central mechanic, representing the handheld\'s strong output of compact Japanese action-RPG titles through its commercial lifespan.',
  },
  {
    gameId: 'atomic-betty-game-boy-advance',
    title: 'Atomic Betty',
    summary: 'Activision\'s Game Boy Advance game based on the Atomic Betty Canadian animated series follows the Galactic Guardian protagonist through space-based side-scrolling action, adapting the children\'s TV property for portable play.',
  },
  {
    gameId: 'back-track-game-boy-advance',
    title: 'Back Track',
    summary: 'A Game Boy Advance puzzle title built around backtracking and path-reversal mechanics, challenging players to navigate maze-like levels by retracing steps and manipulating movement direction as the central gameplay concept.',
  },
  {
    gameId: 'back-to-stone-game-boy-advance',
    title: 'Back to Stone',
    summary: 'Vivendi Universal\'s Game Boy Advance puzzle-platformer tasks a stone-turning character with converting enemies and platforms to solve environmental challenges, offering compact fantasy-tinged puzzle gameplay on the portable hardware.',
  },
  {
    gameId: 'backyard-baseball-2006-game-boy-advance',
    title: 'Backyard Baseball 2006',
    summary: 'Humongous Entertainment\'s Game Boy Advance baseball title continues the family-friendly Backyard Sports series with cartoon neighborhood kids and a roster of MLB player cameos as child versions, delivering accessible portable baseball for younger audiences.',
  },
  {
    gameId: 'backyard-baseball-2007-game-boy-advance',
    title: 'Backyard Baseball 2007',
    summary: 'Humongous Entertainment\'s Game Boy Advance baseball game updates the Backyard Sports franchise for 2007 with refreshed rosters and the series\' characteristic cartoon neighborhood kids aesthetic, targeting the family gaming segment of the portable market.',
  },
  {
    gameId: 'backyard-basketball-2004-game-boy-advance',
    title: 'Backyard Basketball 2004',
    summary: 'Humongous Entertainment\'s Game Boy Advance basketball entry in the Backyard Sports series casts neighborhood kids and NBA player caricatures in playground-style five-on-five basketball, adapting the accessible cartoon sports franchise to handheld play.',
  },
  {
    gameId: 'backyard-basketball-2007-game-boy-advance',
    title: 'Backyard Basketball 2007',
    summary: 'Humongous Entertainment\'s Game Boy Advance basketball title updates the Backyard Sports series for 2007, continuing the franchise\'s child-friendly neighborhood sports format with updated rosters on Nintendo\'s portable platform.',
  },
  {
    gameId: 'backyard-football-2007-game-boy-advance',
    title: 'Backyard Football 2007',
    summary: 'Humongous Entertainment\'s Game Boy Advance football game adapts the Backyard Sports gridiron title to the handheld for 2007, maintaining the series\' cartoon kid roster and accessible play-calling structure for portable American football gameplay.',
  },
  {
    gameId: 'banshee-s-last-cry-game-boy-advance',
    title: 'Banshee\'s Last Cry',
    summary: 'Xing\'s Japan-only Game Boy Advance horror-themed adventure title draws on Japanese sound novel aesthetics, delivering a text-driven mystery narrative with horror atmosphere for the portable platform\'s Japanese domestic audience.',
  },
  {
    gameId: 'barbie-horse-adventures-blue-ribbon-race-game-boy-advance',
    title: 'Barbie Horse Adventures: Blue Ribbon Race',
    summary: 'Vivendi Universal\'s Game Boy Advance equestrian title places Barbie in show-jumping and horse racing competitions, targeting the franchise\'s core demographic with the horse-riding sub-brand that proved consistently popular across the mid-2000s.',
  },
  {
    gameId: 'barbie-horse-adventures-wild-horse-rescue-game-boy-advance',
    title: 'Barbie Horse Adventures: Wild Horse Rescue',
    summary: 'Vivendi Universal\'s Game Boy Advance equestrian adventure follows Barbie rescuing wild horses through exploration and care-based gameplay, extending the Barbie Horse Adventures sub-brand to portable hardware with a rescue mission structure.',
  },
  // Nintendo DS — wave 1 (first 11)
  {
    gameId: '007-quantum-of-solace-nintendo-ds',
    title: '007: Quantum of Solace',
    summary: 'Activision\'s Nintendo DS adaptation of the 2008 James Bond film delivers first-person and third-person action across missions based on the Daniel Craig outing, offering a portable stealth-action experience derived from the theatrical release.',
  },
  {
    gameId: '1-vs-100-nintendo-ds',
    title: '1 vs. 100',
    summary: 'Majesco\'s Nintendo DS adaptation of the NBC game show delivers the trivia competition format with the player facing a mob of 100 contestants, translating the television format\'s escalating stakes to handheld single and multiplayer trivia gameplay.',
  },
  {
    gameId: '100-all-time-favorites-nintendo-ds',
    title: '100 All-Time Favorites',
    summary: 'A Nintendo DS mini-game compilation assembling 100 classic-styled activities and games into a single cartridge, targeting players seeking variety content and a broad spread of compact interactive experiences on the handheld platform.',
  },
  {
    gameId: '1000-bornes-nintendo-ds',
    title: '1000 Bornes',
    summary: 'Ubisoft\'s Nintendo DS adaptation of the classic French card racing game faithfully translates the Mille Bornes card game\'s travel-and-hazard mechanics to the touchscreen, bringing the long-established board game to a new generation of portable players.',
  },
  {
    gameId: '101-in-1-explosive-megamix-nintendo-ds',
    title: '101-in-1 Explosive Megamix',
    summary: 'Nordcurrent\'s Nintendo DS mini-game compilation packs over a hundred compact games across genres into a single cartridge, offering a wide variety of quick-play content for DS owners seeking maximum game count per purchase.',
  },
  {
    gameId: '101-in-1-sports-party-megamix-nintendo-ds',
    title: '101-in-1 Sports Party Megamix',
    summary: 'Nordcurrent\'s Nintendo DS sports-themed companion to the Explosive Megamix focuses its 100-plus mini-game compilation on sports and athletic activities, using the DS touchscreen and buttons for accessible pick-up sporting challenges.',
  },
  {
    gameId: '12-family-games-nintendo-ds',
    title: '12 Family Games',
    summary: 'A Nintendo DS compilation packaging twelve traditional family-oriented board and card games for portable play, targeting households seeking a variety of classic tabletop experiences in a single handheld cartridge.',
  },
  {
    gameId: '1912-titanic-mystery-nintendo-ds',
    title: '1912: Titanic Mystery',
    summary: 'The Adventure Company\'s Nintendo DS hidden-object adventure sets a mystery investigation aboard the Titanic in the days before its sinking, blending historical atmosphere with the casual puzzle-adventure format that flourished on Nintendo\'s dual-screen handheld.',
  },
  {
    gameId: '2006-fifa-world-cup-nintendo-ds',
    title: '2006 FIFA World Cup',
    summary: 'EA Sports\' Nintendo DS coverage of the 2006 Germany World Cup delivers the official tournament bracket with licensed national teams and the DS touch controls, bringing portable football coverage of the quadrennial event to the handheld audience.',
  },
  {
    gameId: '4-elements-nintendo-ds',
    title: '4 Elements',
    summary: 'Mastiff\'s Nintendo DS puzzle game task players with restoring power to the four elemental kingdoms through match-3 tile puzzles with fantasy theming, adapting the PC casual game franchise for the handheld\'s touchscreen interface.',
  },
  {
    gameId: '7-wonders-of-the-ancient-world-nintendo-ds',
    title: '7 Wonders of the Ancient World',
    summary: 'Mumbo Jumbo\'s Nintendo DS puzzle game challenges players to build the Seven Wonders of the ancient world through match-3 and construction-based puzzles with historically themed backdrops, adapting the PC casual game to touchscreen portable play.',
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
          notes = 'G2 summary batch 45'
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
      'G2 summary batch 45'
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
    ) VALUES (?, 'g2_summary_batch_45', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 45 — GBA wave 2, NDS wave 1')

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
  const runKey = `g2-summary-batch-45-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 45 applied locally on staging sqlite',
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
