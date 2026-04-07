#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// Values are [avg_duration_main, avg_duration_complete] in hours (HLTB estimates).
// null = skip that field entirely (e.g. endless games like Tetris).
const DURATIONS = {
  // Short games (1-5h main)
  'super-mario-bros-nintendo-entertainment-system': [1.5, 2.5],
  'duck-hunt-nintendo-entertainment-system': [1, 2],
  'contra-nintendo-entertainment-system': [0.5, 1.5],
  'mega-man-nintendo-entertainment-system': [1.5, 3],
  'mega-man-2-nintendo-entertainment-system': [2, 4],
  'castlevania-nintendo-entertainment-system': [1, 3],
  'castlevania-iii-draculas-curse-nintendo-entertainment-system': [2, 5],
  'tetris-game-boy': [null, null],
  'sonic-the-hedgehog-sega-genesis': [1.5, 3],
  'sonic-the-hedgehog-2-sega-genesis': [2, 4],
  'sonic-the-hedgehog-3-sega-genesis': [2, 4],
  'super-castlevania-iv-super-nintendo': [2, 4],
  'contra-iii-alien-wars-super-nintendo': [1, 2],
  'castlevania-bloodlines-sega-genesis': [2, 4],
  'mega-man-x-super-nintendo': [3, 6],
  'mega-man-7-super-nintendo': [3, 7],
  'yoshi-island-super-nintendo': [8, 14],
  'donkey-kong-country-super-nintendo': [5, 10],
  'donkey-kong-country-2-super-nintendo': [6, 12],
  'donkey-kong-country-3-super-nintendo': [5, 10],
  'super-mario-kart-super-nintendo': [4, 8],
  'super-mario-world-super-nintendo': [6, 15],
  'super-mario-bros-3-nintendo-entertainment-system': [4, 8],
  'kirby-adventure-nintendo-entertainment-system': [4, 7],
  'castlevania-circle-of-the-moon-game-boy-advance': [8, 14],
  'castlevania-harmony-of-dissonance-game-boy-advance': [7, 13],
  'castlevania-aria-of-sorrow-game-boy-advance': [8, 15],
  'castlevania-dawn-of-sorrow-nintendo-ds': [10, 18],
  'castlevania-order-of-ecclesia-nintendo-ds': [12, 20],
  'metroid-zero-mission-game-boy-advance': [3, 7],
  'megaman-zero-game-boy-advance': [5, 9],
  'megaman-zero-2-game-boy-advance': [5, 9],
  'mega-man-zero-3-game-boy-advance': [5, 9],
  'mega-man-x4-playstation': [4, 8],
  'contra-hard-corps-sega-genesis': [1, 4],
  'castlevania-chronicles-playstation': [2, 5],
  'castlevania-symphony-of-the-night-playstation': [12, 20],
  // Medium games (5-20h main)
  'super-metroid-super-nintendo': [4, 9],
  'the-legend-of-zelda-nintendo-entertainment-system': [5, 9],
  'the-legend-of-zelda-a-link-to-the-past-super-nintendo': [10, 18],
  'the-legend-of-zelda-a-link-to-the-past-game-boy-advance': [10, 18],
  'majoras-mask-nintendo-64': [20, 35],
  'the-legend-of-zelda-majoras-mask-nintendo-64': [20, 35],
  'the-legend-of-zelda-ocarina-of-time-nintendo-64': [20, 35],
  'super-mario-64-nintendo-64': [10, 18],
  'banjo-kazooie-nintendo-64': [10, 15],
  'banjo-tooie-nintendo-64': [14, 22],
  'goldeneye-007-nintendo-64': [5, 14],
  'perfect-dark-nintendo-64': [6, 16],
  'super-mario-rpg-super-nintendo': [15, 22],
  'earthbound-super-nintendo': [22, 35],
  'paper-mario-nintendo-64': [22, 35],
  'secret-of-mana-super-nintendo': [20, 30],
  'panzer-dragoon-saga-sega-saturn': [20, 30],
  'radiant-silvergun-sega-saturn': [1.5, 5],
  'skies-of-arcadia-dreamcast': [40, 65],
  'shenmue-dreamcast': [12, 20],
  'jet-set-radio-dreamcast': [5, 9],
  'sonic-adventure-dreamcast': [8, 18],
  'guardian-heroes-sega-saturn': [2, 5],
  'soul-calibur-dreamcast': [3, 30],
  'tekken-3-playstation': [4, 30],
  'gran-turismo-playstation': [20, 80],
  'tony-hawks-pro-skater-2-playstation': [3, 12],
  'tony-hawks-pro-skater-2-dreamcast': [3, 12],
  'crash-team-racing-playstation': [8, 18],
  'spyro-the-dragon-playstation': [5, 10],
  'spyro-2-riptos-rage-playstation': [6, 12],
  'spyro-year-of-the-dragon-playstation': [8, 14],
  'resident-evil-3-nemesis-playstation': [6, 12],
  'silent-hill-playstation': [8, 14],
  'parasite-eve-playstation': [8, 14],
  'um-jammer-lammy-playstation': [2, 5],
  'metal-gear-solid-playstation': [12, 20],
  'suikoden-ii-playstation': [30, 45],
  'suikoden-playstation': [20, 35],
  // Long RPGs (20h+)
  'final-fantasy-nintendo-entertainment-system': [15, 30],
  'final-fantasy-ii-nintendo-entertainment-system': [20, 35],
  'final-fantasy-iii-nintendo-entertainment-system': [25, 40],
  'final-fantasy-iv-super-nintendo': [20, 35],
  'final-fantasy-v-super-nintendo': [25, 45],
  'final-fantasy-vi-super-nintendo': [35, 60],
  'final-fantasy-vi-advance-game-boy-advance': [35, 65],
  'final-fantasy-vii-playstation': [38, 80],
  'final-fantasy-viii-playstation': [35, 65],
  'final-fantasy-ix-playstation': [38, 65],
  'final-fantasy-tactics-playstation': [40, 60],
  'final-fantasy-tactics-advance-game-boy-advance': [35, 55],
  'final-fantasy-xii-revenant-wings-nintendo-ds': [25, 40],
  'chrono-trigger-super-nintendo': [22, 40],
  'chrono-cross-playstation': [30, 50],
  'bahamut-lagoon-super-nintendo': [25, 35],
  // GBA/DS RPGs
  'golden-sun-game-boy-advance': [20, 35],
  'golden-sun-the-lost-age-game-boy-advance': [25, 40],
  'fire-emblem-game-boy-advance': [20, 30],
  'mother-3-game-boy-advance': [20, 30],
  'the-world-ends-with-you-nintendo-ds': [25, 40],
  'mario-and-luigi-bowsers-inside-story-nintendo-ds': [22, 35],
  'professor-layton-and-the-curious-village-nintendo-ds': [10, 18],
  'new-super-mario-bros-nintendo-ds': [7, 14],
  'metroid-prime-hunters-nintendo-ds': [12, 20],
  'super-mario-advance-game-boy-advance': [4, 8],
}

function nowIso() {
  return new Date().toISOString()
}

// Build a plan of what would happen without touching the DB
function buildDryRunPlan(db) {
  const gameIds = Object.keys(DURATIONS)
  const placeholders = gameIds.map(() => '?').join(', ')

  const gameRows = db.prepare(
    `SELECT id, avg_duration_main, avg_duration_complete FROM games WHERE id IN (${placeholders})`
  ).all(...gameIds)
  const gameMap = new Map(gameRows.map((r) => [r.id, r]))

  const editorialRows = db.prepare(
    `SELECT game_id, avg_duration_main, avg_duration_complete FROM game_editorial WHERE game_id IN (${placeholders})`
  ).all(...gameIds)
  const editorialMap = new Map(editorialRows.map((r) => [r.game_id, r]))

  const plan = {
    totalInMap: gameIds.length,
    notFound: [],
    allNull: [],
    entries: [],
  }

  for (const gameId of gameIds) {
    const [main, complete] = DURATIONS[gameId]

    // Both values null → endless game, skip entirely
    if (main === null && complete === null) {
      plan.allNull.push(gameId)
      continue
    }

    if (!gameMap.has(gameId)) {
      plan.notFound.push(gameId)
      continue
    }

    const gRow = gameMap.get(gameId)
    const eRow = editorialMap.get(gameId) || null

    const gMainNull = gRow.avg_duration_main === null || gRow.avg_duration_main === undefined
    const gComplNull = gRow.avg_duration_complete === null || gRow.avg_duration_complete === undefined

    const eMainNull = !eRow || eRow.avg_duration_main === null || eRow.avg_duration_main === undefined
    const eComplNull = !eRow || eRow.avg_duration_complete === null || eRow.avg_duration_complete === undefined

    const willWriteGMain = main !== null && gMainNull
    const willWriteGCompl = complete !== null && gComplNull
    const willWriteEMain = main !== null && eMainNull
    const willWriteECompl = complete !== null && eComplNull

    if (!willWriteGMain && !willWriteGCompl && !willWriteEMain && !willWriteECompl) {
      plan.entries.push({ gameId, action: 'skip', reason: 'all fields already populated' })
    } else {
      plan.entries.push({
        gameId,
        action: 'write',
        games: { main: willWriteGMain ? main : 'kept', complete: willWriteGCompl ? complete : 'kept' },
        editorial: { main: willWriteEMain ? main : 'kept', complete: willWriteECompl ? complete : 'kept', exists: Boolean(eRow) },
      })
    }
  }

  return plan
}

function applyDurations(db) {
  const timestamp = nowIso()
  const runKey = `enrich-durations-batch1-${timestamp}`

  const runId = Number(db.prepare(`
    INSERT INTO enrichment_runs (
      run_key, pipeline_name, mode, source_name, status, dry_run,
      started_at, items_seen, items_created, items_updated, items_skipped, items_flagged, error_count, notes
    ) VALUES (?, 'enrich_durations_batch1', 'apply', 'hltb_curated', 'running', 0,
      ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, timestamp, 'Batch 1 HLTB duration estimates — games + game_editorial').lastInsertRowid)

  const metrics = {
    itemsSeen: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    gamesFieldsWritten: 0,
    editorialFieldsWritten: 0,
    editorialRowsCreated: 0,
  }

  const transaction = db.transaction(() => {
    for (const [gameId, [main, complete]] of Object.entries(DURATIONS)) {
      metrics.itemsSeen += 1

      // Endless/null entries — skip entirely
      if (main === null && complete === null) {
        metrics.itemsSkipped += 1
        continue
      }

      const gRow = db.prepare(
        'SELECT id, avg_duration_main, avg_duration_complete FROM games WHERE id = ?'
      ).get(gameId)

      if (!gRow) {
        console.log(`  ✗ [NOT FOUND]  ${gameId}`)
        metrics.itemsFlagged += 1
        continue
      }

      // ---- games table ----
      const gMainNull = gRow.avg_duration_main === null || gRow.avg_duration_main === undefined
      const gComplNull = gRow.avg_duration_complete === null || gRow.avg_duration_complete === undefined

      let gFieldsWritten = 0

      if (main !== null && gMainNull) {
        db.prepare('UPDATE games SET avg_duration_main = ? WHERE id = ?').run(main, gameId)
        gFieldsWritten += 1
        metrics.gamesFieldsWritten += 1
      }

      if (complete !== null && gComplNull) {
        db.prepare('UPDATE games SET avg_duration_complete = ? WHERE id = ?').run(complete, gameId)
        gFieldsWritten += 1
        metrics.gamesFieldsWritten += 1
      }

      // ---- game_editorial table ----
      const eRow = db.prepare(
        'SELECT game_id, avg_duration_main, avg_duration_complete FROM game_editorial WHERE game_id = ?'
      ).get(gameId)

      let eFieldsWritten = 0

      if (!eRow) {
        // Row doesn't exist yet — insert a minimal row with only duration fields
        db.prepare(`
          INSERT INTO game_editorial (game_id, avg_duration_main, avg_duration_complete, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          gameId,
          main !== null ? main : null,
          complete !== null ? complete : null,
          timestamp,
          timestamp
        )
        metrics.editorialRowsCreated += 1
        metrics.itemsCreated += 1
        eFieldsWritten = (main !== null ? 1 : 0) + (complete !== null ? 1 : 0)
        metrics.editorialFieldsWritten += eFieldsWritten
      } else {
        const eMainNull = eRow.avg_duration_main === null || eRow.avg_duration_main === undefined
        const eComplNull = eRow.avg_duration_complete === null || eRow.avg_duration_complete === undefined

        if (main !== null && eMainNull) {
          db.prepare(
            'UPDATE game_editorial SET avg_duration_main = ?, updated_at = ? WHERE game_id = ?'
          ).run(main, timestamp, gameId)
          eFieldsWritten += 1
          metrics.editorialFieldsWritten += 1
        }

        if (complete !== null && eComplNull) {
          db.prepare(
            'UPDATE game_editorial SET avg_duration_complete = ?, updated_at = ? WHERE game_id = ?'
          ).run(complete, timestamp, gameId)
          eFieldsWritten += 1
          metrics.editorialFieldsWritten += 1
        }
      }

      const totalFields = gFieldsWritten + eFieldsWritten

      if (totalFields === 0) {
        const mainVal = gRow.avg_duration_main
        const complVal = gRow.avg_duration_complete
        console.log(`  - [SKIP]       ${gameId}  (main=${mainVal}, complete=${complVal} already set)`)
        metrics.itemsSkipped += 1
      } else {
        const parts = []
        if (gFieldsWritten > 0) parts.push(`games(${gFieldsWritten})`)
        if (eFieldsWritten > 0) parts.push(`editorial(${eFieldsWritten})`)
        console.log(`  ✓ [WRITE]      ${gameId}  → ${parts.join(' + ')} | main=${main ?? 'n/a'}h  complete=${complete ?? 'n/a'}h`)
        metrics.itemsUpdated += 1
      }
    }
  })

  transaction()

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
    nowIso(),
    metrics.itemsSeen,
    metrics.itemsCreated,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    `durations-batch1: ${metrics.itemsUpdated} written, ${metrics.itemsSkipped} skipped, ${metrics.itemsFlagged} missing, ${metrics.editorialRowsCreated} editorial rows created`,
    runId
  )

  return { runId, runKey, metrics }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    if (!APPLY) {
      console.log('[DRY-RUN] enrich-durations-batch1 — pass --apply to write\n')
      const plan = buildDryRunPlan(db)

      if (plan.notFound.length) {
        console.log(`Not found in DB (${plan.notFound.length}):`)
        for (const id of plan.notFound) console.log(`  ✗ ${id}`)
        console.log()
      }

      if (plan.allNull.length) {
        console.log(`Skipped — endless/null durations (${plan.allNull.length}):`)
        for (const id of plan.allNull) console.log(`  - ${id}`)
        console.log()
      }

      const writes = plan.entries.filter((e) => e.action === 'write')
      const skips = plan.entries.filter((e) => e.action === 'skip')

      console.log(`Would write (${writes.length}):`)
      for (const entry of writes) {
        const { games: g, editorial: e } = entry
        const eLabel = e.exists ? 'update' : 'insert'
        console.log(
          `  ✓ ${entry.gameId}  games[main=${g.main}, compl=${g.complete}]  editorial[${eLabel}: main=${e.main}, compl=${e.complete}]`
        )
      }

      if (skips.length) {
        console.log(`\nWould skip (${skips.length}) — all fields already populated:`)
        for (const entry of skips) console.log(`  - ${entry.gameId}`)
      }

      console.log(`\nSummary: ${writes.length} writes, ${skips.length} skips, ${plan.notFound.length} not found, ${plan.allNull.length} endless/null (of ${plan.totalInMap} in map)`)
      return
    }

    console.log('[APPLY] enrich-durations-batch1\n')
    const result = applyDurations(db)
    const m = result.metrics
    console.log(`\nDone — run #${result.runId} (${result.runKey})`)
    console.log(`  Written         : ${m.itemsUpdated}`)
    console.log(`  Created editorial: ${m.editorialRowsCreated}`)
    console.log(`  games fields    : ${m.gamesFieldsWritten}`)
    console.log(`  editorial fields: ${m.editorialFieldsWritten}`)
    console.log(`  Skipped         : ${m.itemsSkipped}`)
    console.log(`  Missing         : ${m.itemsFlagged}`)
    console.log(`  Total seen      : ${m.itemsSeen}`)
  } finally {
    db.close()
  }
}

main()
