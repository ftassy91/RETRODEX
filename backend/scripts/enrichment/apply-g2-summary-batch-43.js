#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy — wave 1
  {
    gameId: '2nd-super-robot-wars-game-boy',
    title: '2nd Super Robot Wars',
    summary: 'Banpresto\'s Japan-only Game Boy strategy RPG continues the Super Robot Wars series\' tradition of assembling mecha from multiple anime franchises into tactical grid-based battles, offering a portable entry in the long-running crossover series.',
  },
  {
    gameId: '4-in-1-funpak-game-boy',
    title: '4-in-1 Funpak',
    summary: 'Interplay\'s Game Boy compilation packages four games — Blackjack, Checkers, Yacht, and Chess — into a single cartridge, targeting players seeking classic board and card game entertainment on the portable hardware.',
  },
  {
    gameId: 'aa-harimanada-game-boy',
    title: 'Aa Harimanada',
    summary: 'Bandai\'s Japan-only Game Boy sumo wrestling game adapts the Harimanada manga license into a portable fighting title, casting players as the stoic sumo protagonist through bout-based competition.',
  },
  {
    gameId: 'amida-game-boy',
    title: 'Amida',
    summary: 'A Japan-only Game Boy puzzle title built around the amida lottery lottery-style ladder diagram, translating the traditional paper-and-pencil number game into a portable interactive format.',
  },
  {
    gameId: 'banishing-racer-game-boy',
    title: 'Banishing Racer',
    summary: 'Jaleco\'s Game Boy top-down racer blends racing and shooting mechanics, tasking players with clearing track-based stages while managing weaponized vehicles against enemy cars in a compact portable action format.',
  },
  {
    gameId: 'barbie-game-girl-game-boy',
    title: 'Barbie: Game Girl',
    summary: 'Hi Tech Expressions\' Game Boy platformer starring Barbie moves the fashion doll through themed side-scrolling stages, targeting younger players with straightforward jump-and-collect gameplay in a licensed consumer product.',
  },
  {
    gameId: 'bases-loaded-game-boy',
    title: 'Bases Loaded',
    summary: 'Jaleco\'s Game Boy adaptation of the NES baseball series delivers the franchise\'s accessible pitching and batting mechanics in portable form, carrying the established Bases Loaded team roster and stadium format to Nintendo\'s handheld.',
  },
  {
    gameId: 'boulder-dash-game-boy',
    title: 'Boulder Dash',
    summary: 'Ocean\'s Game Boy port of the classic 1984 boulder-and-gem puzzle game tasks players with collecting diamonds while avoiding falling rocks and enemies across cave-based maze levels, faithfully translating the Peter Liepa original to the portable format.',
  },
  {
    gameId: 'brain-drain-game-boy',
    title: 'Brain Drain',
    summary: 'Rocket Science Games\' Game Boy action-puzzle title places players in control of a disembodied brain navigating platform-based stages by possessing enemy bodies to solve environmental obstacles and progress through stages.',
  },
  {
    gameId: 'captain-tsubasa-j-zenkoku-seiha-e-no-chousen-game-boy',
    title: 'Captain Tsubasa J: Zenkoku Seiha e no Chousen',
    summary: 'Bandai\'s Japan-only Game Boy football RPG continues the Captain Tsubasa J series with the anime\'s characteristic dramatic command-based soccer matches, following Tsubasa\'s national championship campaign in the licensed manga universe.',
  },
  {
    gameId: 'captain-tsubasa-vs-game-boy',
    title: 'Captain Tsubasa VS',
    summary: 'Bandai\'s Japan-only Game Boy soccer title from the Captain Tsubasa license delivers the series\' narrative-driven football matches in a compact portable format, featuring the anime\'s signature dramatic shot sequences.',
  },
  {
    gameId: 'championship-pool-game-boy',
    title: 'Championship Pool',
    summary: 'Mindscape\'s Game Boy billiards simulation offers multiple pool variants including 8-ball, 9-ball, and straight pool, delivering a portable top-down table experience with adjustable difficulty levels.',
  },
  {
    gameId: 'chikyu-kaiho-gun-zas-game-boy',
    title: 'Chikyuu Kaihou Gun ZAS',
    summary: 'Varie\'s Japan-only Game Boy shoot-\'em-up places players in a vertically scrolling space combat role, offering the platform\'s characteristic compact shooter experience with alien invasion theming.',
  },
  {
    gameId: 'cutthroat-island-game-boy',
    title: 'Cutthroat Island',
    summary: 'Acclaim\'s Game Boy tie-in for the 1995 pirate film offers side-scrolling action gameplay based on the movie\'s adventure narrative, delivering a standard licensed platformer for portable audiences in the era of the theatrical release.',
  },
  {
    gameId: 'dastardly-and-muttley-game-boy',
    title: 'Dastardly and Muttley',
    summary: 'Hi Tech Expressions\' Game Boy game based on the Hanna-Barbera cartoon characters places players as the classic villain duo in a compact action title, targeting fans of the Stop the Pigeon animated series.',
  },
  {
    gameId: 'dead-heat-scramble-game-boy',
    title: 'Dead Heat Scramble',
    summary: 'Taito\'s Game Boy racing title offers compact top-down race circuit competition in the publisher\'s portable format, providing a straightforward driving experience for the early Game Boy library.',
  },
  {
    gameId: 'dexterity-game-boy',
    title: 'Dexterity',
    summary: 'A Japan-only Game Boy puzzle title testing player reflexes and hand-eye coordination through increasingly fast reaction-based challenges, representative of the portable platform\'s strong puzzle genre output.',
  },
  {
    gameId: 'dino-breeder-2-game-boy',
    title: 'Dino Breeder 2',
    summary: 'J-Wing\'s Japan-only Game Boy monster-raising sequel tasks players with breeding and training dinosaurs across battle and care mechanics, participating in the portable creature-raising genre that thrived on the platform alongside Pocket Monsters.',
  },
  {
    gameId: 'dirty-racing-game-boy',
    title: 'Dirty Racing',
    summary: 'A compact Game Boy racing title with an emphasis on aggressive demolition derby-style competition, allowing players to bump and damage rival vehicles across circuit stages in an accessible portable format.',
  },
  // Game Boy Color — wave 1 (11 games)
  {
    gameId: '10-pin-bowling-game-boy-color',
    title: '10 Pin Bowling',
    summary: 'Ubi Soft\'s Game Boy Color bowling simulation offers standard ten-pin gameplay with adjustable spin and power mechanics across multiple lanes and difficulty settings, delivering a compact portable version of the classic alley sport.',
  },
  {
    gameId: '3-d-ultra-pinball-thrillride-game-boy-color',
    title: '3-D Ultra Pinball: Thrillride',
    summary: 'Sierra\'s Game Boy Color pinball title adapts the 3-D Ultra series with an amusement park theme, offering multi-table pinball action with ramps and themed bumpers in the publisher\'s established PC franchise.',
  },
  {
    gameId: '3d-pocket-pool-game-boy-color',
    title: '3D Pocket Pool',
    summary: 'Majesco\'s Game Boy Color billiards game delivers compact 8-ball and 9-ball pool with a pseudo-3D overhead perspective, targeting players who wanted a straightforward portable pool simulation on the color hardware.',
  },
  {
    gameId: '720-game-boy-color',
    title: '720°',
    summary: 'Hasbro Interactive\'s Game Boy Color port of the 1986 Atari arcade skateboarding classic preserves the ramp-based trick competition and city exploration of the original coin-op, bringing the pioneering extreme sports title to the portable platform.',
  },
  {
    gameId: 'arcade-classic-game-boy-color',
    title: 'Arcade Classic',
    summary: 'Nintendo\'s Game Boy Color compilation of arcade classics packages foundational titles for portable play, preserving historically significant games from the early era of the arcade industry in a handheld format.',
  },
  {
    gameId: 'b-b-daman-bakugaiden-victory-e-no-michi-game-boy-color',
    title: 'B-B Daman Bakugaiden: Victory e no Michi',
    summary: 'Hudson\'s Japan-only Game Boy Color title based on the B-B Daman marble-shooting toy franchise delivers battle gameplay tied to the associated anime, combining the licensed toy property with handheld portable action for the domestic Japanese market.',
  },
  {
    gameId: 'babe-and-friends-game-boy-color',
    title: 'Babe and Friends',
    summary: 'Ubi Soft\'s Game Boy Color licensed title based on the Babe pig film franchise delivers children\'s adventure gameplay centered on the farm animal characters, targeting young portable players with light puzzle-action content.',
  },
  {
    gameId: 'baby-felix-halloween-game-boy-color',
    title: 'Baby Felix Halloween',
    summary: 'Ubi Soft\'s Game Boy Color platformer stars a baby version of Felix the Cat through Halloween-themed stages, offering young-audience side-scrolling platformer content based on the classic cartoon character in a seasonal format.',
  },
  {
    gameId: 'barbie-magic-genie-adventure-game-boy-color',
    title: 'Barbie: Magic Genie Adventure',
    summary: 'Mattel Media\'s Game Boy Color game places Barbie in a genie-themed adventure with magic-based puzzle-platformer stages, targeting the franchise\'s primary young female demographic with fantasy-tinged portable gameplay.',
  },
  {
    gameId: 'bear-in-the-big-blue-house-game-boy-color',
    title: 'Bear in the Big Blue House',
    summary: 'NewKidCo\'s Game Boy Color licensed game based on the Jim Henson Company\'s preschool TV series delivers age-appropriate minigame content with the Bear character, targeting the youngest segment of the portable gaming audience.',
  },
  {
    gameId: 'beatmania-gb-gatchamix2-game-boy-color',
    title: 'Beatmania GB: GatchaMix 2',
    summary: 'Konami\'s Japan-only Game Boy Color sequel to the GatchaMix beatmania portable adaptation continues the DJ simulation series with a new track selection, using the Game Boy\'s button layout to approximate the turntable-and-key mechanics of the arcade original.',
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
          notes = 'G2 summary batch 43'
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
      'G2 summary batch 43'
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
    ) VALUES (?, 'g2_summary_batch_43', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 43 — Game Boy wave 1, Game Boy Color wave 1')

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
  const runKey = `g2-summary-batch-43-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 43 applied locally on staging sqlite',
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
