#!/usr/bin/env node
'use strict'

/**
 * enrich-cheat-codes-batch1.js
 *
 * Writes cheat_codes to BOTH games and game_editorial tables.
 * Only writes when the field is currently NULL or empty string.
 * Format: JSON array of { name, code, effect }
 *
 * Usage:
 *   node enrich-cheat-codes-batch1.js           # dry-run (default)
 *   node enrich-cheat-codes-batch1.js --apply   # write to DB
 */

const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// ---------------------------------------------------------------------------
// Payload — merged entries for the same gameId are combined below in PAYLOAD
// ---------------------------------------------------------------------------

const RAW_CHEAT_CODES = [
  {
    gameId: 'contra-nintendo-entertainment-system',
    codes: [
      { name: '30 Lives', code: 'Up Up Down Down Left Right Left Right B A (Start)', effect: 'Start the game with 30 lives instead of 3' },
      { name: 'Sound Test', code: 'Hold A+B on controller 2, then press Start on controller 1', effect: 'Access the in-game sound test' },
    ],
  },
  {
    gameId: 'contra-iii-alien-wars-super-nintendo',
    codes: [
      { name: '30 Lives', code: 'Up Up Down Down Left Right Left Right Y X on title screen', effect: 'Start with 30 lives' },
      { name: 'Stage Select', code: 'Hold L+R then press Start on title screen', effect: 'Choose starting stage' },
    ],
  },
  {
    gameId: 'mega-man-2-nintendo-entertainment-system',
    codes: [
      { name: 'Sound Test', code: 'Hold A+B, then press Start at the title screen', effect: 'Access the sound test mode' },
    ],
  },
  {
    gameId: 'mega-man-x-super-nintendo',
    codes: [
      { name: 'Hadouken', code: 'Obtain all upgrades and Heart Tanks, then enter the first armored armadillo stage. Climb the ladder at the start and perform Down, Down-Forward, Forward + shoot', effect: "Unlock Mega Man's Hadouken special move, which one-hit kills most enemies" },
      { name: 'Password System', code: 'Use the in-game password screen to save progress', effect: 'Record an 8-character password and re-enter it to restore all collected upgrades, sub-tanks, and stage completion' },
    ],
  },
  {
    gameId: 'goldeneye-007-nintendo-64',
    codes: [
      { name: 'Paintball Mode', code: 'Complete Dam in under 2:40 on Agent', effect: 'All bullets leave paint splatter marks' },
      { name: 'DK Mode', code: 'Complete Runway in under 5:00 on Agent', effect: 'All enemies have large heads and tiny bodies like Donkey Kong' },
      { name: 'Turbo Mode', code: 'Complete Jungle in under 3:45 on Secret Agent', effect: 'All characters run at high speed' },
      { name: 'Enemy Rockets', code: 'Complete Runway in under 5:00 on 00 Agent', effect: 'All enemies are armed with rocket launchers' },
      { name: 'All Guns', code: 'Complete Depot in under 1:40 on Secret Agent', effect: 'Unlocks all weapons in multiplayer' },
    ],
  },
  {
    gameId: 'super-mario-bros-nintendo-entertainment-system',
    codes: [
      { name: 'Continue from World 1', code: 'Hold A then press Start on Game Over screen', effect: 'Restart from world 1 with your current score' },
      { name: 'Warp to World 2, 3 or 4', code: 'Enter the warp zone hidden in World 1-2 behind the pipe exit', effect: 'Skip to worlds 2, 3, or 4' },
      { name: 'Warp to World 6, 7 or 8', code: 'Enter the warp zone in World 4-2 via the ceiling', effect: 'Skip to worlds 6, 7, or 8' },
      { name: 'Infinite Lives', code: 'Jump on the last Koopa before the flagpole in World 3-1 repeatedly', effect: 'Gain 1-ups rapidly from the enemy staircase chain' },
    ],
  },
  {
    gameId: 'super-mario-bros-3-nintendo-entertainment-system',
    codes: [
      { name: 'Skip World Map Cards', code: 'Hold A before entering a level from the World Map', effect: 'Continue from the level select in the previously saved state' },
      { name: 'White Mushroom Houses', code: 'Collect all coin totals in specific worlds (e.g. 44 in World 1)', effect: 'Unlocks White Mushroom Houses with P-Wings and anchors' },
    ],
  },
  {
    gameId: 'sonic-the-hedgehog-sega-genesis',
    codes: [
      { name: 'Level Select', code: 'Press Up Down Left Right on the title screen, then hold A and press Start', effect: 'Access the level select screen' },
      { name: 'Debug Mode', code: 'Access level select, then on the sound test play sounds 01 09 09 01 01 06 02 03. Hold A and press Start', effect: 'Enable debug mode — place objects anywhere in the level' },
    ],
  },
  {
    gameId: 'sonic-the-hedgehog-2-sega-genesis',
    codes: [
      { name: 'Level Select + All Emeralds', code: 'On the title screen: select Options, then go to Sound Test. Play tracks 19 65 09 17. Press Start, then hold A+Start at the title screen', effect: 'Access full level select and enable all Chaos Emeralds' },
    ],
  },
  {
    gameId: 'street-fighter-ii-turbo-super-nintendo',
    codes: [
      { name: '8-Star Speed', code: 'On the speed selection screen hold L+R+Y then press the direction for speed 4', effect: 'Unlock the hidden speed level 8 — much faster than normal maximum' },
    ],
  },
  {
    gameId: 'super-mario-64-nintendo-64',
    codes: [
      { name: 'Backwards Long Jump (BLJ)', code: 'Face away from a slope, hold back, and repeatedly press A to long jump', effect: 'Accumulate speed overflow to clip through doors and skip major sections — used in speedruns' },
      { name: 'First Person View', code: 'Hold R and press C-Up during gameplay', effect: 'Switch the camera to first-person perspective' },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-ocarina-of-time-nintendo-64',
    codes: [
      { name: 'Infinite Rupees', code: 'Sell a fish to King Zora repeatedly using a glitch', effect: 'Accumulate rupees quickly' },
      { name: 'Sword Glitch (Wrong Warp)', code: 'Advanced technique: backflip in specific doorways after defeating boss', effect: 'Used in speedruns to skip dungeon completion and warp directly to Ganon' },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-nintendo-entertainment-system',
    codes: [
      { name: 'Second Quest', code: 'Enter ZELDA as your save file name', effect: 'Start directly on the Second Quest with a remixed dungeon layout' },
    ],
  },
  {
    gameId: 'donkey-kong-country-super-nintendo',
    codes: [
      { name: '50 Lives', code: 'On the map screen, hold Down+Y+Select, then press Start', effect: 'Set life count to 50' },
      { name: 'Sound Test', code: 'Hold Down+Select+B+Y at the select screen', effect: 'Access sound test mode' },
    ],
  },
  {
    gameId: 'super-metroid-super-nintendo',
    codes: [
      { name: 'Sound Test', code: 'Hold L+R and press Start on the title screen', effect: 'Access the sound test' },
      { name: 'Skip Intro', code: 'Press Start at any point during the opening demo', effect: 'Go directly to the title screen' },
    ],
  },
  {
    gameId: 'chrono-trigger-super-nintendo',
    codes: [
      { name: 'New Game+', code: 'Load a cleared save file and choose New Game', effect: 'Restart the game with all characters, items, and levels carried over — unlock additional endings' },
    ],
  },
  {
    gameId: 'final-fantasy-vi-super-nintendo',
    codes: [
      { name: 'Sketch Glitch', code: "Use Relm's Sketch command on certain enemies when inventory is full", effect: 'Causes item overflow that can duplicate rare items or reset inventory — major glitch used in challenge runs' },
    ],
  },
  {
    gameId: 'castlevania-symphony-of-the-night-playstation',
    codes: [
      { name: "Start with Richter's Equipment", code: 'Enter RICHTER as your name', effect: "Begin the game with stats from Richter's inventory" },
      { name: 'Luck Mode', code: 'Enter X-X!V"Q as your name', effect: 'Start with 99 Luck and the Lapis Lazuli equipped' },
    ],
  },
  {
    gameId: 'earthbound-super-nintendo',
    codes: [
      { name: 'Copy Existing Save', code: 'During name entry, enter the same name as an existing file', effect: "Prompts the option to copy that save's data to the new file" },
    ],
  },
  {
    gameId: 'mortal-kombat-super-nintendo',
    codes: [
      { name: 'Blood Mode (SNES)', code: 'A B A C A B B on the select screen', effect: 'Activate blood mode — not removed in the SNES version when this code is entered' },
    ],
  },
  {
    gameId: 'castlevania-nintendo-entertainment-system',
    codes: [
      { name: 'Continue', code: 'Press A+B at the Game Over screen', effect: 'Continue from the beginning of the current stage without losing your score' },
    ],
  },
  {
    gameId: 'super-mario-world-super-nintendo',
    codes: [
      { name: 'Star World Exit Warp', code: 'Complete Star World stages to unlock warp paths across the world map', effect: 'Access any world on the map through the Star Road network, skipping major sections' },
    ],
  },
]

// Merge entries with the same gameId (e.g. mega-man-x appears twice in source)
const PAYLOAD = (() => {
  const map = new Map()
  for (const entry of RAW_CHEAT_CODES) {
    if (map.has(entry.gameId)) {
      const existing = map.get(entry.gameId)
      existing.codes = existing.codes.concat(entry.codes)
    } else {
      map.set(entry.gameId, { gameId: entry.gameId, codes: [...entry.codes] })
    }
  }
  return Array.from(map.values())
})()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString()
}

function isEmpty(val) {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  return false
}

function createRun(db, runKey, timestamp) {
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
    ) VALUES (?, 'enrich_cheat_codes_batch1', 'apply', 'internal_curated', 'running', 0, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, timestamp, 'Cheat codes batch 1 — 22 games across NES/SNES/Genesis/N64/PSX')
  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = ?,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(
    timestamp,
    metrics.itemsSeen,
    metrics.itemsCreated,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    `Cheat codes batch 1 completed. written=${metrics.itemsUpdated} skipped=${metrics.itemsSkipped} flagged=${metrics.itemsFlagged}`,
    runId
  )
}

// ---------------------------------------------------------------------------
// Dry-run planning
// ---------------------------------------------------------------------------

function buildDryRunPlan(db) {
  const plan = []

  for (const entry of PAYLOAD) {
    const gamesRow = db.prepare('SELECT id, cheat_codes FROM games WHERE id = ?').get(entry.gameId)
    const editorialRow = db.prepare('SELECT game_id, cheat_codes FROM game_editorial WHERE game_id = ?').get(entry.gameId)

    const gamesExists = Boolean(gamesRow)
    const gamesEmpty = gamesExists ? isEmpty(gamesRow.cheat_codes) : null
    const editorialExists = Boolean(editorialRow)
    const editorialEmpty = editorialExists ? isEmpty(editorialRow.cheat_codes) : null

    plan.push({
      gameId: entry.gameId,
      codeCount: entry.codes.length,
      games: {
        rowExists: gamesExists,
        fieldEmpty: gamesEmpty,
        action: !gamesExists ? 'skip-no-game-row' : gamesEmpty ? 'write' : 'skip-already-filled',
      },
      game_editorial: {
        rowExists: editorialExists,
        fieldEmpty: editorialEmpty,
        action: !editorialExists ? 'skip-no-editorial-row' : editorialEmpty ? 'write' : 'skip-already-filled',
      },
    })
  }

  return plan
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function applyEnrichment(db) {
  const timestamp = nowIso()
  const runKey = `enrich-cheat-codes-batch1-${timestamp}`
  const runId = createRun(db, runKey, timestamp)

  const metrics = {
    itemsSeen: PAYLOAD.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    gamesWritten: 0,
    editorialWritten: 0,
    gamesSkipped: 0,
    editorialSkipped: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of PAYLOAD) {
      const codesJson = JSON.stringify(entry.codes)

      // --- games table ---
      const gamesRow = db.prepare('SELECT id, cheat_codes FROM games WHERE id = ?').get(entry.gameId)
      if (!gamesRow) {
        console.log(`[FLAGGED] games row missing: ${entry.gameId}`)
        metrics.itemsFlagged += 1
      } else if (isEmpty(gamesRow.cheat_codes)) {
        db.prepare('UPDATE games SET cheat_codes = ? WHERE id = ?').run(codesJson, entry.gameId)
        console.log(`[WRITE] games.cheat_codes for ${entry.gameId} (${entry.codes.length} codes)`)
        metrics.gamesWritten += 1
      } else {
        console.log(`[SKIP] games.cheat_codes already filled for ${entry.gameId}`)
        metrics.gamesSkipped += 1
      }

      // --- game_editorial table ---
      const editorialRow = db.prepare('SELECT game_id, cheat_codes FROM game_editorial WHERE game_id = ?').get(entry.gameId)
      if (!editorialRow) {
        console.log(`[SKIP] game_editorial row missing for ${entry.gameId} — no insert attempted`)
        metrics.editorialSkipped += 1
      } else if (isEmpty(editorialRow.cheat_codes)) {
        db.prepare('UPDATE game_editorial SET cheat_codes = ?, updated_at = ? WHERE game_id = ?').run(codesJson, timestamp, entry.gameId)
        console.log(`[WRITE] game_editorial.cheat_codes for ${entry.gameId} (${entry.codes.length} codes)`)
        metrics.editorialWritten += 1
      } else {
        console.log(`[SKIP] game_editorial.cheat_codes already filled for ${entry.gameId}`)
        metrics.editorialSkipped += 1
      }

      // Count as updated if at least one table was written
      if (
        (gamesRow && isEmpty(gamesRow.cheat_codes)) ||
        (editorialRow && isEmpty(editorialRow.cheat_codes))
      ) {
        metrics.itemsUpdated += 1
      } else if (gamesRow || editorialRow) {
        metrics.itemsSkipped += 1
      }
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, runKey, metrics }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    if (!APPLY) {
      const plan = buildDryRunPlan(db)
      const willWrite = plan.filter((p) => p.games.action === 'write' || p.game_editorial.action === 'write').length
      const willSkip = plan.filter((p) => p.games.action !== 'write' && p.game_editorial.action !== 'write').length

      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: {
          totalGames: PAYLOAD.length,
          willWrite,
          willSkip,
        },
        plan,
      }, null, 2))
      console.log('\nRun with --apply to write.')
      return
    }

    const result = applyEnrichment(db)
    console.log('\n=== Summary ===')
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
