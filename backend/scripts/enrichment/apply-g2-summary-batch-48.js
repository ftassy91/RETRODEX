#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo 64 — wave 2 (remaining 18)
  {
    gameId: 'elmo-s-number-journey-nintendo-64',
    title: 'Elmo\'s Number Journey',
    summary: 'NewKidCo\'s Nintendo 64 educational companion to Elmo\'s Letter Adventure applies the Sesame Street character to number-learning activities, targeting preschool-age players with counting and arithmetic concepts through Elmo\'s friendly guidance.',
  },
  {
    gameId: 'fifa-soccer-64-nintendo-64',
    title: 'FIFA Soccer 64',
    summary: 'EA Sports\' Nintendo 64 FIFA launch entry brings the association football franchise to N64 hardware with licensed international teams and a fluid 3D on-pitch presentation, establishing the FIFA brand on Nintendo\'s 64-bit platform.',
  },
  {
    gameId: 'fifa-road-to-world-cup-98-nintendo-64',
    title: 'FIFA: Road to World Cup 98',
    summary: 'EA Sports\' Nintendo 64 World Cup edition focuses the FIFA franchise on qualifying campaigns and the full 1998 France tournament structure, using the World Cup license to drive sales around the quadrennial football event.',
  },
  {
    gameId: 'famista-64-nintendo-64',
    title: 'Famista 64',
    summary: 'Namco\'s Japan-only Nintendo 64 entry in the Famista baseball franchise updates the long-running Japanese baseball series for the 64-bit era with 3D stadiums and updated pro yakyu rosters, serving domestic baseball game fans on the home console.',
  },
  {
    gameId: 'fighting-force-nintendo-64',
    title: 'Fighting Force',
    summary: 'Core Design\'s Nintendo 64 port of the 3D beat-\'em-up sends up to two players through urban environments fighting criminal organizations, positioning itself as a 3D spiritual successor to the scrolling brawler genre as it transitioned to polygon-based hardware.',
  },
  {
    gameId: 'fox-sports-college-hoops-99-nintendo-64',
    title: 'Fox Sports College Hoops \'99',
    summary: 'Acclaim\'s Nintendo 64 NCAA college basketball simulation for the 1998-1999 season carries the Fox Sports television brand with collegiate teams and arena atmosphere, delivering a university-level alternative to the era\'s pro basketball simulation titles.',
  },
  {
    gameId: 'g-a-s-p-fighters-nextream-nintendo-64',
    title: 'G.A.S.P.!! Fighters\' NEXTream',
    summary: 'Konami\'s Japan-only Nintendo 64 3D fighting game delivered an early polygon-based fighter for the platform with a roster of stylized martial artists across competitive one-on-one bouts, representing the publisher\'s early N64 fighting game output.',
  },
  {
    gameId: 'gt-64-championship-edition-nintendo-64',
    title: 'GT 64: Championship Edition',
    summary: 'Ocean\'s Nintendo 64 circuit racing game positions itself in the Gran Turismo-influenced simulation segment with a car roster and track selection aimed at the driving sim enthusiast, competing in the N64\'s crowded late-1990s racing genre.',
  },
  {
    gameId: 'getter-love-nintendo-64',
    title: 'Getter Love!!',
    summary: 'Hudson\'s Japan-only Nintendo 64 party game blends a multiplayer romance competition with minigame challenges, casting players as rivals pursuing the same girl through social minigame victories in a domestic multiplayer party format.',
  },
  {
    gameId: 'gex-3-deep-cover-gecko-nintendo-64',
    title: 'Gex 3: Deep Cover Gecko',
    summary: 'Crystal Dynamics\' Nintendo 64 third entry in the Gex platformer series sends the media-referencing gecko through movie and television parody worlds in the franchise\'s established collect-a-thon format, continuing the 3D platformer series into the late N64 era.',
  },
  {
    gameId: 'gex-enter-the-gecko-nintendo-64',
    title: 'Gex: Enter the Gecko',
    summary: 'Crystal Dynamics\' Nintendo 64 3D platformer brings the media-satirizing gecko into the N64 generation with TV show-parody worlds and collectible remotes, translating the 2D original\'s pop-culture humor and mascot personality into a polygon-based platformer.',
  },
  {
    gameId: 'goemon-mononoke-sugoroku-nintendo-64',
    title: 'Goemon Mononoke Sugoroku',
    summary: 'Konami\'s Japan-only Nintendo 64 board game places the Goemon cast in a sugoroku dice-rolling party game format, providing a multiplayer spinoff from the Mystical Ninja franchise for domestic N64 audiences seeking group play.',
  },
  {
    gameId: 'golden-nugget-64-nintendo-64',
    title: 'Golden Nugget 64',
    summary: 'Black Pearl Software\'s Nintendo 64 casino simulation collects multiple Las Vegas casino games under the Golden Nugget brand, providing home console access to blackjack, roulette, slots, and other table games in an officially licensed casino format.',
  },
  {
    gameId: 'hamster-monogatari-64-nintendo-64',
    title: 'Hamster Monogatari 64',
    summary: 'Culture Brain\'s Japan-only Nintendo 64 hamster-raising simulation adapts the popular Game Boy Color pet-care franchise to home console, allowing players to raise, train, and race hamsters in a domestic Japan-only expansion of the beloved handheld series.',
  },
  {
    gameId: 'heiwa-pachinko-world-64-nintendo-64',
    title: 'Heiwa Pachinko World 64',
    summary: 'Sammy\'s Japan-only Nintendo 64 pachinko simulation adapts Heiwa Pachinko\'s branded machines into a home console format, targeting Japanese domestic players seeking authentic pachinko machine simulation from the established pachinko manufacturer.',
  },
  {
    gameId: 'hercules-the-legendary-journeys-nintendo-64',
    title: 'Hercules: The Legendary Journeys',
    summary: 'Titus Software\'s Nintendo 64 3D beat-\'em-up based on the Renaissance Pictures television series follows the syndicated TV Hercules through mythological enemies in a franchise-licensed brawler targeting fans of the popular late-1990s action-adventure show.',
  },
  {
    gameId: 'hexen-beyond-heretic-nintendo-64',
    title: 'Hexen: Beyond Heretic',
    summary: 'id Software and Raven Software\'s dark fantasy first-person shooter arrives on N64 with its three-character class system and hub-based exploration, adapting the 1995 PC sequel\'s medieval spellcasting and melee combat to Nintendo\'s 64-bit platform.',
  },
  {
    gameId: 'hey-you-pikachu-nintendo-64',
    title: 'Hey You, Pikachu!',
    summary: 'Ambella\'s Nintendo 64 virtual pet game uses the N64 Voice Recognition Unit microphone peripheral to let players talk directly to Pikachu, issuing voice commands during activities and building a relationship with the Pokémon mascot in a pioneering voice-interaction design.',
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
          notes = 'G2 summary batch 48'
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
      'G2 summary batch 48'
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
    ) VALUES (?, 'g2_summary_batch_48', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 48 — N64 wave 2')

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
  const runKey = `g2-summary-batch-48-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 48 applied locally on staging sqlite',
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
