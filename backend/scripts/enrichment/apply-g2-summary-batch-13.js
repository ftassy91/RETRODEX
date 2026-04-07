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
    gameId: 'alleyway-game-boy',
    title: 'Alleyway',
    summary: "Nintendo's Game Boy launch breakout game, a Breakout/Arkanoid variant featuring Mario on the paddle sprite across 24 stages, notable as one of the first Game Boy titles and demonstrating the hardware's compact arcade potential at launch.",
  },
  {
    gameId: 'adventures-of-lolo-game-boy',
    title: 'Adventures of Lolo',
    summary: "HAL Laboratory's Game Boy port of the NES puzzle platformer shrinks Lolo's enemy-freezing floor-puzzle structure to handheld, preserving the methodical room-by-room logic that defined the original series.",
  },
  {
    gameId: 'alien-3-game-boy',
    title: 'Alien 3',
    summary: "LJN's Game Boy adaptation of the film-based license scales the console versions' rescue mission structure to the handheld with compressed stage design and the characteristic xenomorph threat of the third film.",
  },
  {
    gameId: 'alien-vs-predator-the-last-of-his-clan-game-boy',
    title: 'Alien vs Predator: The Last of His Clan',
    summary: "Activision's Game Boy action game places a lone Predator against a xenomorph invasion in side-scrolling combat, using the franchise conflict in a compact portable format ahead of the arcade and SNES crossover releases.",
  },
  {
    gameId: 'animaniacs-game-boy',
    title: 'Animaniacs',
    summary: "Konami's Game Boy licensed game adapts the Warner Bros. cartoon in a compact portable format, offering the Warner siblings' comedic energy in a simplified handheld structure that targets the youngest segment of the franchise's audience.",
  },
  {
    gameId: 'balloon-kid-game-boy',
    title: 'Balloon Kid',
    summary: "Nintendo's Game Boy original stars Alice floating through stages on balloons, with the ability to grab and release balloons mid-flight as a traversal mechanic in a sequel to Balloon Fight that never received a Western NES release.",
  },
  {
    gameId: 'bart-simpson-s-escape-from-camp-deadly-game-boy',
    title: "Bart Simpson's Escape from Camp Deadly",
    summary: "Acclaim's Game Boy platformer traps Bart at a prison-like summer camp run by the scheming Mr. Black, tasking him with sabotaging camp activities and escaping through side-scrolling stages built around the show's visual language.",
  },
  {
    gameId: 'batman-the-video-game-game-boy',
    title: 'Batman: The Video Game',
    summary: "Sunsoft's Game Boy adaptation of the 1989 Batman film delivers the platformer combat of its NES counterpart in compressed handheld form, retaining the Joker-confrontation structure and grapple-hook traversal of the full console release.",
  },
  {
    gameId: 'batman-the-animated-series-game-boy',
    title: 'Batman: The Animated Series',
    summary: "Konami's Game Boy licensed game adapts the Bruce Timm cartoon with the platform's limited palette, translating the series' noir aesthetic into handheld side-scrolling action across Gotham environments.",
  },
  {
    gameId: 'battletoads-game-boy',
    title: 'Battletoads',
    summary: "Rare's Game Boy entry compresses the franchise's punishing brawler and vehicle stages into a handheld format, retaining the trademark difficulty and sprite-scaling showpiece sequences in a condensed portable package.",
  },
  {
    gameId: 'battletoads-double-dragon-game-boy',
    title: 'Battletoads & Double Dragon',
    summary: 'The Game Boy port of the console crossover brawler unites both franchises in a reduced two-player-capable handheld version, compressing the vehicle stages and brawling combat of the console original.',
  },
  {
    gameId: 'bionic-commando-game-boy',
    title: 'Bionic Commando',
    summary: "Capcom's Game Boy adaptation of the NES classic preserves the grapple-arm traversal mechanic in a compact portable format, condensing the anti-gravity swing-based platforming that defined the franchise's identity.",
  },
  {
    gameId: 'blaster-master-jr-game-boy',
    title: 'Blaster Master Jr.',
    summary: "Sunsoft's Game Boy spin-off of the NES series retains the franchise's tank combat and top-down on-foot sections in a portable format, offering a compressed version of the dual-mode gameplay that distinguished the original Blaster Master.",
  },
  {
    gameId: 'bomberman-gb-game-boy',
    title: 'Bomberman GB',
    summary: "Hudson's first dedicated Game Boy Bomberman uses the handheld's link cable for two-player bomb battles, translating the franchise's arena bomb-placement formula into a portable format with a single-player puzzle campaign alongside the multiplayer core.",
  },
  {
    gameId: 'castlevania-the-adventure-game-boy',
    title: 'Castlevania: The Adventure',
    summary: "Konami's first Game Boy Castlevania introduces Christopher Belmont in a four-stage vampire hunt that predates the NES series' timeline, noted for its deliberately slow movement speed and the absence of the subweapon system from the main series.",
  },
  {
    gameId: 'castlevania-ii-belmont-s-revenge-game-boy',
    title: "Castlevania II: Belmont's Revenge",
    summary: "Konami's superior Game Boy Castlevania sequel improves significantly on its predecessor with selectable starting stages, restored subweapons, and a more responsive movement system across four castle environments.",
  },
  {
    gameId: 'chase-h-q-game-boy',
    title: 'Chase H.Q.',
    summary: "Taito's Game Boy port of the arcade pursuit-driving game scales the police chase formula to the handheld, delivering rear-view pursuit racing against criminal vehicles through compressed city course sections.",
  },
  {
    gameId: 'cool-spot-game-boy',
    title: 'Cool Spot',
    summary: "Virgin Games' Game Boy adaptation of the 7-Up mascot platformer places the red spot through side-scrolling beach and amusement environments, translating the console version's tight collectible-hunting structure to the portable format.",
  },
  {
    gameId: 'darkwing-duck-game-boy',
    title: 'Darkwing Duck',
    summary: "Capcom's Game Boy licensed game follows the terror-that-flaps-in-the-night through compact side-scrolling action stages, adapting the Disney Afternoon cartoon's caped crime-fighter in a handheld format parallel to the NES release.",
  },
  {
    gameId: 'desert-strike-game-boy',
    title: 'Desert Strike',
    summary: "EA's Game Boy port of the isometric helicopter shooter scales the original's Gulf War rescue-and-destroy missions to the handheld, condensing the fuel management and multi-objective mission structure of the original in portable form.",
  },
  {
    gameId: 'dig-dug-game-boy',
    title: 'Dig Dug',
    summary: "Namco's Game Boy adaptation of the arcade classic preserves the underground pump-and-pop enemy mechanic across portable maze stages, delivering the essential Dig Dug formula on the original Game Boy hardware.",
  },
  {
    gameId: 'disney-s-aladdin-game-boy',
    title: "Disney's Aladdin",
    summary: "The Game Boy adaptation of the Disney film follows Aladdin through Agrabah in a side-scrolling platformer, offering a compressed take on the movie's action sequences in the handheld's monochrome format.",
  },
  {
    gameId: 'darius-game-boy',
    title: 'Darius',
    summary: "Taito's Game Boy entry in the marine-creature boss shooter franchise delivers the series' iconic mechanical sea-beast confrontations in a portable side-scrolling format scaled to the handheld hardware's capabilities.",
  },
  {
    gameId: 'burai-fighter-deluxe-game-boy',
    title: 'Burai Fighter Deluxe',
    summary: "Taxan's Game Boy version of the NES omnidirectional shooter expands the original's enemy gauntlets with new stages, bringing the multi-directional bullet-hell formula to the portable format.",
  },
  {
    gameId: 'bubble-bobble-part-2-game-boy',
    title: 'Bubble Bobble Part 2',
    summary: "Taito's Game Boy sequel to the beloved arcade bubble-trapping game introduces additional puzzle elements and a branching stage structure, continuing the cooperative single-screen arcade formula in a dedicated handheld release.",
  },
  {
    gameId: 'burgertime-deluxe-game-boy',
    title: 'Burgertime Deluxe',
    summary: "Data East's Game Boy expansion of the arcade classic adds new stages and enemy types to the original's burger-assembly platform puzzle formula, extending the pepper-throwing cook's kitchen adventures in portable form.",
  },
  {
    gameId: 'batman-return-of-the-joker-game-boy',
    title: 'Batman: Return of the Joker',
    summary: "Sunsoft's Game Boy sequel to their Batman adaptation delivers an original story with Joker as antagonist, expanding the first handheld game's action with improved animation and a larger stage set.",
  },
  {
    gameId: 'batman-forever-game-boy',
    title: 'Batman Forever',
    summary: "Acclaim's Game Boy adaptation of the Schumacher film compresses the digitized-sprite brawling of the console versions into a handheld format, offering Batman and Robin against Two-Face and Riddler in simplified portable combat.",
  },
  {
    gameId: 'beavis-and-butt-head-game-boy',
    title: 'Beavis and Butt-Head',
    summary: "Viacom's Game Boy adaptation of the MTV cartoon compresses the duo's misadventures into a handheld platformer, carrying the show's crude humor through simplified mechanics and the characters' recognizable visual design.",
  },
  {
    gameId: 'bomberman-gb-2-game-boy',
    title: 'Bomberman GB 2',
    summary: "Hudson's second Game Boy Bomberman improves the arena bomb formula with new power-ups and stage layouts, reinforcing the series' link cable multiplayer appeal in a refined portable follow-up.",
  },
  {
    gameId: 'bomberman-gb-3-game-boy',
    title: 'Bomberman GB 3',
    summary: "Hudson's third and final original Game Boy Bomberman delivers additional arena variants and power-up combinations, completing the trilogy of dedicated monochrome handheld entries in the franchise.",
  },
  {
    gameId: 'battletoads-in-ragnarok-s-world-game-boy',
    title: "Battletoads in Ragnarok's World",
    summary: "Rare's second Game Boy Battletoads reuses assets from the original handheld game in a compressed remix format, offering a different stage arrangement for players seeking another run through the franchise's punishing portable combat.",
  },
  {
    gameId: 'boomer-s-adventure-in-asmik-world-game-boy',
    title: "Boomer's Adventure in ASMIK World",
    summary: "Asmik's early Game Boy action game sends a young explorer through trap-filled mazes collecting items, serving as an early example of the handheld's puzzle-adventure genre in a Japan-centered mascot format.",
  },
  {
    gameId: 'captain-america-and-the-avengers-game-boy',
    title: 'Captain America and The Avengers',
    summary: "Data East's Game Boy port of the arcade brawler scales the four-hero Marvel lineup and stage structure to the handheld, compressing the horizontal beat-'em-up combat of the arcade original for portable play.",
  },
  {
    gameId: 'adventure-island-game-boy',
    title: 'Adventure Island',
    summary: "Hudson's Game Boy entry in the Master Higgins platformer series translates the consumable food-based health system and skateboard power-ups of the console series to a compact handheld stage structure.",
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
          notes = 'G2 summary batch 13'
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
      'G2 summary batch 13'
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
    ) VALUES (?, 'g2_summary_batch_13', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 13 — Game Boy wave 1')

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
  const runKey = `g2-summary-batch-13-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 13 applied locally on staging sqlite',
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
