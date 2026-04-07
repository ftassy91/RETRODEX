#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo DS — wave 2 (next 25)
  {
    gameId: '8ball-allstars-nintendo-ds',
    title: '8Ball Allstars',
    summary: 'Oxygen Games\' Nintendo DS billiards title delivers 8-ball pool competition using the touchscreen for aiming and shot power control, bringing accessible portable pool play to the handheld with a compact multiplayer-friendly format.',
  },
  {
    gameId: 'a-witch-s-tale-nintendo-ds',
    title: 'A Witch\'s Tale',
    summary: 'NIS America\'s Nintendo DS RPG follows a young witch through fairy-tale kingdoms using touch-based magic and a doll companion system, offering a female-protagonist fantasy adventure with a storybook visual aesthetic from the Hitmaker-developed original.',
  },
  {
    gameId: 'a-train-3d-city-simulator-nintendo-ds',
    title: 'A-Train 3D: City Simulator',
    summary: 'Artdink\'s Nintendo DS city and railroad simulation continues the long-running A-Train series with three-dimensional city building and rail network management, bringing the franchise\'s detailed transportation simulation to the portable platform.',
  },
  {
    gameId: 'a-train-ds-nintendo-ds',
    title: 'A-Train DS',
    summary: 'Artdink\'s Nintendo DS entry in the A-Train railroad simulation franchise delivers train network management and city development mechanics adapted for handheld play, maintaining the series\' signature depth of rail route planning on a portable screen.',
  },
  {
    gameId: 'afl-mascot-manor-nintendo-ds',
    title: 'AFL Mascot Manor',
    summary: 'IR Gurus\' Nintendo DS title based on the Australian Football League uses the league\'s team mascots in a property management and minigame format, targeting Australian domestic audiences with an AFL-licensed casual game for the handheld.',
  },
  {
    gameId: 'amf-bowling-pinbusters-nintendo-ds',
    title: 'AMF Bowling Pinbusters!',
    summary: 'Valusoft\'s Nintendo DS bowling simulation carries the AMF Bowling brand through a touchscreen-controlled lane experience with multiple ball types and lane conditions, delivering a compact portable bowling game with the established AMF league association.',
  },
  {
    gameId: 'ash-archaic-sealed-heat-nintendo-ds',
    title: 'Ash: Archaic Sealed Heat',
    summary: 'Mistwalker and Racjin\'s Nintendo DS tactical RPG from Final Fantasy creator Hironobu Sakaguchi follows princess Aisya through a time-loop narrative with grid-based combat and a unique protagonist-death mechanic, representing an ambitious Japan-only DS exclusive from a major industry figure.',
  },
  {
    gameId: 'atv-quad-frenzy-nintendo-ds',
    title: 'ATV Quad Frenzy',
    summary: 'Oxygen Games\' Nintendo DS ATV racing title delivers off-road quad bike competition across dirt tracks and terrain courses, offering a compact portable racing experience in the growing ATV sports genre of the mid-2000s.',
  },
  {
    gameId: 'ace-attorney-investigations-2-prosecutor-s-gambit-nintendo-ds',
    title: 'Ace Attorney Investigations 2: Prosecutor\'s Gambit',
    summary: 'Capcom\'s Japan-only Nintendo DS visual novel follows prosecutor Miles Edgeworth through a new set of interconnected cases using Logic Chess and investigative mechanics, considered by many to be among the strongest entries in the Ace Attorney series and long awaited for official Western localization.',
  },
  {
    gameId: 'actionloop-nintendo-ds',
    title: 'ActionLoop',
    summary: 'Nintendo\'s DS puzzle game challenges players to eliminate colored marble chains before they reach an exit, using the touchscreen stylus to aim and fire matching orbs in a circular marble-shooter format similar to Zuma but adapted specifically for the dual-screen handheld.',
  },
  {
    gameId: 'actua-pool-nintendo-ds',
    title: 'Actua Pool',
    summary: 'Reef Entertainment\'s Nintendo DS billiards game from the Actua Sports brand delivers pool simulation using the touch controls for cue aiming and power, offering a touchscreen-native approach to the classic table game on the handheld platform.',
  },
  {
    gameId: 'adventure-time-hey-ice-king-why-d-you-steal-our-garbage-nintendo-ds',
    title: 'Adventure Time: Hey Ice King! Why\'d You Steal Our Garbage?!',
    summary: 'WayForward\'s Nintendo DS action-platformer based on the Cartoon Network series pairs Finn and Jake against the Ice King across Ooo-set side-scrolling stages with the show\'s humor and character dynamics, produced by a developer known for quality licensed handheld titles.',
  },
  {
    gameId: 'again-nintendo-ds',
    title: 'Again',
    summary: 'Cing\'s Nintendo DS mystery adventure tasks FBI agent J investigating copycat crimes linked to a 19-year-old murder case, using a unique mechanic where the touchscreen reveals the past overlaid on crime scene photographs in a noir investigation format.',
  },
  {
    gameId: 'agatha-christie-the-abc-murders-nintendo-ds',
    title: 'Agatha Christie: The ABC Murders',
    summary: 'The Adventure Company\'s Nintendo DS adventure adapts the classic Hercule Poirot mystery novel into a point-and-click investigation game, placing players as the Belgian detective through the alphabetical murder case with the novel\'s original suspects and locations.',
  },
  {
    gameId: 'age-of-empires-mythologies-nintendo-ds',
    title: 'Age of Empires: Mythologies',
    summary: 'Griptonite Games\' Nintendo DS turn-based strategy title draws on Age of Empires: Mythology\'s Greek, Egyptian, and Norse civilizations for mythology-themed combat, translating the PC real-time strategy franchise into a portable hex-based turn-based format.',
  },
  {
    gameId: 'age-of-empires-the-age-of-kings-nintendo-ds',
    title: 'Age of Empires: The Age of Kings',
    summary: 'Griptonite Games\' Nintendo DS adaptation of the PC real-time strategy classic converts the medieval civilization-building gameplay into portable turn-based form, covering five historical civilizations across campaign and skirmish modes on the dual-screen handheld.',
  },
  {
    gameId: 'air-traffic-chaos-nintendo-ds',
    title: 'Air Traffic Chaos',
    summary: 'Majesco\'s Nintendo DS air traffic control simulation places players managing airport approach and departure lanes through increasingly congested airspace scenarios, using the touchscreen to direct aircraft safely while avoiding collision in a stress-escalating portable simulation.',
  },
  {
    gameId: 'air-traffic-controller-nintendo-ds',
    title: 'Air Traffic Controller',
    summary: 'A Japan-only Nintendo DS simulation title placing players in the tower controller role at major airports, managing flight paths and runway assignments through touchscreen interaction in the handheld adaptation of the ATC simulation genre.',
  },
  {
    gameId: 'alex-rider-stormbreaker-nintendo-ds',
    title: 'Alex Rider: Stormbreaker',
    summary: 'Ubisoft\'s Nintendo DS adaptation of the Anthony Horowitz spy-thriller novel and 2006 film follows teenage spy Alex Rider through stealth-action missions with gadgets based on the licensed property\'s adolescent 007 premise.',
  },
  {
    gameId: 'alice-in-wonderland-nintendo-ds',
    title: 'Alice in Wonderland',
    summary: 'Disney Interactive\'s Nintendo DS tie-in to the 2010 Tim Burton film follows Alice through Underland in a puzzle-platformer format based on the movie\'s character designs, delivering a children\'s adventure game timed to the theatrical release.',
  },
  {
    gameId: 'aliens-infestation-nintendo-ds',
    title: 'Aliens: Infestation',
    summary: 'WayForward\'s Nintendo DS action-platformer places a squad of four marines through a Sulaco infestation in a Metroidvania-structured Aliens game, notable for its meticulous attention to the film franchise\'s aesthetic and its permanent marine death mechanic from one of the better developers of DS-era licensed games.',
  },
  {
    gameId: 'aliens-in-the-attic-nintendo-ds',
    title: 'Aliens in the Attic',
    summary: 'Majesco\'s Nintendo DS tie-in to the 2009 family comedy film follows children repelling tiny alien invaders in a compact action game based on the Fox theatrical release, targeting young audiences with the movie\'s humor and characters.',
  },
  {
    gameId: 'all-kamen-rider-rider-generation-nintendo-ds',
    title: 'All Kamen Rider: Rider Generation',
    summary: 'Bandai Namco\'s Japan-only Nintendo DS beat-\'em-up assembles the complete roster of Kamen Rider characters through the franchise\'s history into side-scrolling action stages, celebrating the long-running Toei tokusatsu hero series in a portable crossover format.',
  },
  {
    gameId: 'all-kamen-rider-rider-generation-2-nintendo-ds',
    title: 'All Kamen Rider: Rider Generation 2',
    summary: 'Bandai Namco\'s Japan-only Nintendo DS sequel to Rider Generation expands the Kamen Rider crossover roster with additional characters and stages, continuing the celebration of Toei\'s tokusatsu franchise in a portable beat-\'em-up format for Japanese domestic audiences.',
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
          notes = 'G2 summary batch 46'
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
      'G2 summary batch 46'
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
    ) VALUES (?, 'g2_summary_batch_46', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 46 — NDS wave 2')

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
  const runKey = `g2-summary-batch-46-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 46 applied locally on staging sqlite',
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
