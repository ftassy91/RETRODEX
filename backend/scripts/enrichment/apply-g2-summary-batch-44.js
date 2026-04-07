#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy Color — wave 2 (9 remaining)
  {
    gameId: 'beatmania-gb2-gatchamix-game-boy-color',
    title: 'Beatmania GB2 GatchaMix',
    summary: 'Konami\'s Japan-only Game Boy Color DJ simulation continues the beatmania portable series, adapting the arcade rhythm game\'s key-and-turntable mechanics to the handheld with a new song selection for Japanese domestic audiences.',
  },
  {
    gameId: 'billy-bob-s-huntin-n-fishin-game-boy-color',
    title: 'Billy Bob\'s Huntin\' N\' Fishin\'',
    summary: 'Majesco\'s Game Boy Color outdoor sports title covers both hunting and fishing activities in separate gameplay modes, delivering a combined outdoor recreation experience targeting players interested in rural American sport simulation on the portable platform.',
  },
  {
    gameId: 'blue-s-clues-blue-s-alphabet-book-game-boy-color',
    title: 'Blue\'s Clues: Blue\'s Alphabet Book',
    summary: 'THQ\'s Game Boy Color educational title based on the Nickelodeon preschool series uses Blue and Steve to guide young players through alphabet-learning activities, targeting the earliest learning stages in an interactive portable format.',
  },
  {
    gameId: 'buck-and-the-cursed-cartridge-game-boy-color',
    title: 'Buck and the Cursed Cartridge',
    summary: 'Light & Shadow Production\'s Game Boy Color adventure title features a young gaming protagonist dealing with a haunted video game cartridge, blending meta-gaming references with puzzle-adventure gameplay in a compact portable format.',
  },
  {
    gameId: 'casper-game-boy-color',
    title: 'Casper',
    summary: 'Jaleco\'s Game Boy Color platformer based on the friendly ghost film license follows Casper through haunted environments, offering standard side-scrolling platform gameplay based on the Universal Pictures property for portable audiences.',
  },
  {
    gameId: 'catwoman-game-boy-color',
    title: 'Catwoman',
    summary: 'Kemco\'s Game Boy Color action title based on the DC Comics anti-heroine delivers platformer gameplay with the Catwoman character, targeting fans of the Batman universe in a portable action format released alongside the character\'s media presence.',
  },
  {
    gameId: 'centipede-game-boy-color',
    title: 'Centipede',
    summary: 'Hasbro Interactive\'s Game Boy Color port of the 1980 Atari arcade classic preserves the trackball-style shooter\'s centipede-clearing gameplay with color visuals, bringing one of the arcade era\'s iconic titles to the portable color platform.',
  },
  {
    gameId: 'championship-motocross-2001-featuring-ricky-carmichael-game-boy-color',
    title: 'Championship Motocross 2001 Featuring Ricky Carmichael',
    summary: 'THQ\'s Game Boy Color motocross racing title carries the endorsement of champion rider Ricky Carmichael, offering portable supercross competition across stadium tracks in the licensed extreme sports format popular in the late 2000 era.',
  },
  {
    gameId: 'chase-h-q-secret-police-game-boy-color',
    title: 'Chase H.Q.: Secret Police',
    summary: 'Taito\'s Game Boy Color entry in the Chase H.Q. pursuit racing series tasks undercover officers with running down criminal vehicles across highway stages, extending the arcade-originated police chase formula to the color portable platform.',
  },
  // Game Boy Advance — wave 1 (first 16)
  {
    gameId: '2006-fifa-world-cup-game-boy-advance',
    title: '2006 FIFA World Cup',
    summary: 'EA Sports\' Game Boy Advance tie-in to the 2006 Germany World Cup delivers the tournament mode with licensed national squads and the official competition bracket, providing portable football coverage of the quadrennial event.',
  },
  {
    gameId: '2nd-super-robot-wars-game-boy-advance',
    title: '2nd Super Robot Wars',
    summary: 'Banpresto\'s Game Boy Advance entry in the long-running super robot tactical RPG series assembles mecha from multiple classic anime including Getter Robo, Mazinger Z, and Gundam for grid-based strategic combat in a Japan-only portable release.',
  },
  {
    gameId: 'a-sound-of-thunder-game-boy-advance',
    title: 'A Sound of Thunder',
    summary: 'Ubisoft\'s Game Boy Advance tie-in to the 2005 Ray Bradbury adaptation film delivers action-platformer gameplay set in time-travel-altered prehistoric environments, offering a compact licensed game built around the movie\'s parallel-timeline narrative.',
  },
  {
    gameId: 'atv-quad-power-racing-game-boy-advance',
    title: 'ATV Quad Power Racing',
    summary: 'Acclaim\'s Game Boy Advance ATV racing title adapts the console franchise to portable hardware with top-down racing across off-road terrain, bringing the quad bike competition series to the handheld in a compact format.',
  },
  {
    gameId: 'ace-lightning-game-boy-advance',
    title: 'Ace Lightning',
    summary: 'THQ\'s Game Boy Advance action game based on the BBC/CBS live-action and CGI hybrid television series follows the superhero Ace Lightning through villain-filled levels, adapting the early-2000s children\'s TV property into a portable side-scrolling action game.',
  },
  {
    gameId: 'adventure-of-tokyo-disney-sea-game-boy-advance',
    title: 'Adventure of Tokyo Disney Sea',
    summary: 'A Japan-only Game Boy Advance title tied to the Tokyo Disney Sea theme park, delivering a park exploration game featuring the attractions and themed lands of the Japanese Disney resort in an officially licensed portable format.',
  },
  {
    gameId: 'agassi-tennis-generation-game-boy-advance',
    title: 'Agassi Tennis Generation',
    summary: 'Ubisoft\'s Game Boy Advance tennis simulation carries the Andre Agassi endorsement license, offering portable court competition across a tournament structure in the top-down perspective common to handheld tennis titles of the era.',
  },
  {
    gameId: 'air-traffic-controller-game-boy-advance',
    title: 'Air Traffic Controller',
    summary: 'A Japan-only Game Boy Advance simulation title placing players in the air traffic control role, managing aircraft approach and departure sequencing at airports through increasingly congested scenarios in a portable simulation format.',
  },
  {
    gameId: 'alienators-evolution-continues-game-boy-advance',
    title: 'Alienators: Evolution Continues',
    summary: 'Activision\'s Game Boy Advance action title based on the animated series sequel to the Evolution film delivers alien-fighting side-scrolling gameplay with the show\'s characters, adapting the licensed property to portable hardware.',
  },
  {
    gameId: 'all-grown-up-express-yourself-game-boy-advance',
    title: 'All Grown Up!: Express Yourself',
    summary: 'THQ\'s Game Boy Advance game based on the Nickelodeon animated series follows the Rugrats characters as teenagers through fashion and activity-based gameplay, targeting the show\'s young female audience with lifestyle-oriented portable content.',
  },
  {
    gameId: 'all-star-baseball-2003-game-boy-advance',
    title: 'All-Star Baseball 2003',
    summary: 'Acclaim Sports\' Game Boy Advance baseball simulation carries the MLB and MLBPA licenses for the 2003 season, delivering portable diamond competition with the established All-Star Baseball franchise\'s team rosters and season play format.',
  },
  {
    gameId: 'american-bass-challenge-game-boy-advance',
    title: 'American Bass Challenge',
    summary: 'Majesco\'s Game Boy Advance fishing simulation focuses on bass fishing competition across lakes and rivers, offering a portable angling experience with casting mechanics and fish-fighting gameplay for handheld fishing game enthusiasts.',
  },
  {
    gameId: 'american-idol-game-boy-advance',
    title: 'American Idol',
    summary: 'Ubisoft\'s Game Boy Advance game based on the Fox television talent competition delivers a portable music-themed experience tied to the show\'s format, offering rhythm or performance-based gameplay within the American Idol licensing framework.',
  },
  {
    gameId: 'animal-snap-rescue-them-2-by-2-game-boy-advance',
    title: 'Animal Snap: Rescue Them 2 by 2',
    summary: 'Majesco\'s Game Boy Advance puzzle game casts players in a Noah\'s Ark-inspired animal rescue scenario, using tile-matching or pairing mechanics to save animals two by two in a family-friendly portable puzzle format.',
  },
  {
    gameId: 'antz-extreme-racing-game-boy-advance',
    title: 'Antz Extreme Racing',
    summary: 'Empire Interactive\'s Game Boy Advance racing title based on the DreamWorks Antz animated film uses the ant colony setting for miniature-scale kart-style racing, adapting the licensed property into a portable racing game.',
  },
  {
    gameId: 'archer-maclean-s-3d-pool-game-boy-advance',
    title: 'Archer Maclean\'s 3D Pool',
    summary: 'Ignition Entertainment\'s Game Boy Advance billiards game carries the Archer Maclean brand associated with quality pool simulations, delivering portable 8-ball and 9-ball competition with the developer\'s established physics approach in a handheld format.',
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
          notes = 'G2 summary batch 44'
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
      'G2 summary batch 44'
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
    ) VALUES (?, 'g2_summary_batch_44', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 44 — Game Boy Color wave 2, GBA wave 1')

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
  const runKey = `g2-summary-batch-44-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 44 applied locally on staging sqlite',
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
