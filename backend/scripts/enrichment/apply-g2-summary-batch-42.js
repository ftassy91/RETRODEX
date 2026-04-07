#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy — wave 4 (C through Z range, French-placeholder replacements)
  {
    gameId: 'donkey-kong-game-boy',
    title: 'Donkey Kong',
    summary: "Nintendo R&D1's 1994 Game Boy title expanded the original Donkey Kong arcade concept into a full puzzle-platformer with 101 stages across nine worlds, transforming the four-screen arcade game into an extended Mario-climbing adventure considered among the best original Game Boy titles.",
  },
  {
    gameId: 'donkey-kong-land-game-boy',
    title: 'Donkey Kong Land',
    summary: "Rare's 1995 Game Boy platformer adapted the Super NES Donkey Kong Country gameplay to the handheld with pre-rendered sprite graphics, animal buddy companions, and a complete world structure, demonstrating that the Game Boy could approximate the SNES visual style in a compact format.",
  },
  {
    gameId: 'dr-mario-game-boy',
    title: 'Dr. Mario',
    summary: "Nintendo's 1990 Game Boy puzzle game ports the NES capsule-dropping virus-clearing formula to handheld with full compatibility for two-player link cable competition, a portable adaptation of the multiplayer puzzle game that became one of the Game Boy's best-selling early titles.",
  },
  {
    gameId: 'final-fantasy-legend-ii-game-boy',
    title: 'Final Fantasy Legend II',
    summary: "Square's 1990 Game Boy RPG is the second SaGa series entry disguised under the Final Fantasy Legend banner for Western markets, featuring a robust ability mutation system where robot, human, and monster characters improve by consuming items, a mechanically inventive handheld RPG.",
  },
  {
    gameId: 'gargoyles-quest-game-boy',
    title: "Gargoyle's Quest",
    summary: "Capcom's 1990 Game Boy action-adventure spinoff of Ghosts 'n Goblins casts villain Firebrand as the protagonist in a hybrid of side-scrolling action stages and overworld RPG navigation, an early instance of a villain redemption game and the foundation of the Gargoyle's Quest trilogy.",
  },
  {
    gameId: 'kirby-tilt-n-tumble-game-boy',
    title: "Kirby Tilt 'n' Tumble",
    summary: "HAL Laboratory's 2001 Game Boy Color game embeds a tilt sensor in the cartridge to let players physically tilt the console to roll Kirby through maze stages, a motion-control pioneering title that predated widespread accelerometer gaming and remained a Japan-exclusive import in North America.",
  },
  {
    gameId: 'kirby-dream-land-game-boy',
    title: "Kirby's Dream Land",
    summary: "HAL Laboratory's 1992 Game Boy platformer introduced Kirby as a round inhaling hero saving Dream Land's food from King Dedede, a deliberately accessible debut designed for younger players that launched one of Nintendo's most durable franchises and sold over five million copies.",
  },
  {
    gameId: 'kirbys-pinball-land-game-boy',
    title: "Kirby's Pinball Land",
    summary: "HAL Laboratory's 1993 Game Boy pinball game uses Kirby as the ball across three full-table worlds each with a boss at the top, a polished handheld pinball spin-off that used the Kirby character's round form as a natural fit for the pinball format.",
  },
  {
    gameId: 'mario-golf-game-boy',
    title: 'Mario Golf',
    summary: "Camelot's 1999 Game Boy Color RPG-style golf game follows a junior golfer through a golf academy developing stats and unlocking courses, a handheld companion to the N64 Mario Golf that added an RPG progression layer to the core golf mechanics absent from the console version.",
  },
  {
    gameId: 'mario-tennis-game-boy',
    title: 'Mario Tennis',
    summary: "Camelot's 2001 Game Boy Color RPG-tennis game follows Alex and Nina through a tennis academy training to compete against Mario characters, with Transfer Pak support letting GBC players unlock them as playable characters in the N64 version of Mario Tennis.",
  },
  {
    gameId: 'metroid-ii-return-of-samus-game-boy',
    title: 'Metroid II: Return of Samus',
    summary: "Nintendo R&D1's 1991 Game Boy action-adventure sends Samus to the Metroid homeworld SR388 to exterminate all Metroids, introducing the spider ball and spring ball mobility upgrades in a compact handheld entry that bridged the NES original and Super Metroid's expanded universe.",
  },
  {
    gameId: 'mole-mania-game-boy',
    title: 'Mole Mania',
    summary: "Nintendo's 1996 Game Boy puzzle game designed with Shigeru Miyamoto involves a mole digging through soil layers to push barrel obstacles and reach exits in each stage, an overlooked Nintendo design exercise in underground traversal puzzle mechanics that was largely invisible outside Japan.",
  },
  {
    gameId: 'pokemon-trading-card-game-game-boy',
    title: 'Pokemon Trading Card Game',
    summary: "Hudson's 1998 Game Boy Color RPG simulates the collectible card game with AI opponents representing eight club masters whose decks must be defeated to earn legendary cards, a standalone game that taught card game mechanics through a full RPG framework and sold over 3.5 million copies.",
  },
  {
    gameId: 'pokemon-blue-game-boy',
    title: 'Pokemon Blue',
    summary: "Game Freak's 1996 Game Boy RPG launched the global Pokemon phenomenon as the version-exclusive companion to Pokemon Red, with the same 151 Pokemon creature-collecting and turn-based battling framework but with a different set of version-exclusive species for each cartridge.",
  },
  {
    gameId: 'pokemon-crystal-game-boy',
    title: 'Pokemon Crystal',
    summary: "Game Freak's 2000 Game Boy Color RPG is the enhanced third version of Gold and Silver, adding animated Pokemon sprites, a female protagonist option, and a Suicune-focused story arc that expanded the Battle Tower and made the Johto region debut the definitive second-generation experience.",
  },
  {
    gameId: 'pokemon-yellow-game-boy',
    title: 'Pokemon Yellow',
    summary: "Game Freak's 1998 Game Boy RPG is the anime-influenced third version of Red and Blue, starting players with Pikachu who follows the player on the overworld, adding Bulbasaur, Charmander, and Squirtle as gifts and revising gym leader teams to match the television series.",
  },
  {
    gameId: 'shantae-game-boy',
    title: 'Shantae',
    summary: "WayForward's 2002 Game Boy Color action-platformer stars a half-genie hair-whipping her way through belly-dancing transformation mechanics to stop pirate Risky Boots, a late GBC exclusive renowned for its hand-drawn animation quality and charming personality that sold poorly but inspired a full franchise.",
  },
  {
    gameId: 'super-mario-land-game-boy',
    title: 'Super Mario Land',
    summary: "Nintendo's 1989 Game Boy launch title miniaturized Mario's platforming across four kingdoms including Egypt and China, featuring submarine and airplane vehicle stages alongside the standard running and jumping, one of the most successful launch titles in gaming history with 18 million copies sold.",
  },
  {
    gameId: 'wario-land-super-mario-land-3-game-boy',
    title: 'Wario Land: Super Mario Land 3',
    summary: "Nintendo's 1994 Game Boy platformer starred Wario for the first time as a greed-driven antihero collecting coins to buy a castle, introducing the shoulder-charge and throw mechanics and multiple endings determined by coin accumulation that launched Wario's career as a separate Nintendo franchise.",
  },
  // Game Gear — wave 1 supplement (C-Z range)
  {
    gameId: 'columns-game-gear',
    title: 'Columns',
    summary: "Sega's 1990 Game Gear puzzle game ports the color-matching jewel-stacking arcade title to the handheld with its three-gem column rotation mechanic, an important early Game Gear pack-in title that served as Sega's Tetris counterpart in the portable puzzle game market.",
  },
  {
    gameId: 'crystal-warriors-game-gear',
    title: 'Crystal Warriors',
    summary: "Sega's 1991 Game Gear tactical RPG is one of the earliest games in the genre on a handheld, placing elemental-typed warriors across grid maps in turn-based combat, a compact strategy game that made the portable tactical RPG format accessible before Fire Emblem reached Western handheld audiences.",
  },
  {
    gameId: 'dragon-crystal-game-gear',
    title: 'Dragon Crystal',
    summary: "Sega's 1991 Game Gear roguelike sends a boy through a randomly generated fantasy dungeon growing a dragon companion that levels up passively as the player progresses, a portable Mystery Dungeon-adjacent design delivering early handheld procedural dungeon exploration.",
  },
  {
    gameId: 'earthworm-jim-game-gear',
    title: 'Earthworm Jim',
    summary: "Shiny Entertainment's Game Gear port of the acclaimed SNES and Genesis platformer adapts Jim's suit-powered action across the handheld's small screen, a scaled port of the 16-bit original that retained the character's whip-swinging and enemy-throwing mechanics in portable form.",
  },
  {
    gameId: 'sonic-chaos-game-gear',
    title: 'Sonic Chaos',
    summary: "Aspect's 1993 Game Gear Sonic platformer introduced Tails as a separate playable character alongside Sonic in one of the earliest native Game Gear Sonic titles, featuring zones designed for the handheld format rather than ported from console versions.",
  },
  {
    gameId: 'sonic-triple-trouble-game-gear',
    title: 'Sonic Triple Trouble',
    summary: "Aspect's 1994 Game Gear platformer pits Sonic and Tails against rival Knuckles and antagonist Fang the Sniper across six zones, one of the most technically polished Game Gear Sonic titles with larger sprites and smoother scrolling than earlier handheld entries in the series.",
  },
  {
    gameId: 'tails-adventure-game-gear',
    title: 'Tails Adventure',
    summary: "Aspect's 1995 Game Gear action-adventure removes Sonic to give Tails a solo Metroidvania-style mission collecting inventory items and remote bombs to explore Cocoa Island, one of the more mechanically ambitious Game Gear titles built around exploration and item-gated progression.",
  },
  {
    gameId: 'wonder-boy-game-gear',
    title: 'Wonder Boy',
    summary: "Sega's 1990 Game Gear port of the classic 1986 arcade platformer sends Tom-Tom through time-pressured stages collecting fruit and avoiding obstacles, a foundational handheld platformer that brought Sega's arcade legacy to the portable platform at the Game Gear's launch.",
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
          notes = 'G2 summary batch 42'
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
      'G2 summary batch 42'
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
    ) VALUES (?, 'g2_summary_batch_42', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 42 — Game Boy wave 4 (C-Z), Game Gear wave 1 supplement (C-Z)')

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
  const runKey = `g2-summary-batch-42-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 42 applied locally on staging sqlite',
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
