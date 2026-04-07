#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// Speedrun world records — batch 1
// Source: speedrun.com (curated 2026-04-07)
// Runner field intentionally omitted — WRs change frequently.
const SPEEDRUNS = [
  { gameId: 'super-mario-world-super-nintendo', category: 'Any%', value: '41:40', time: '41:40', url: 'https://www.speedrun.com/smw' },
  { gameId: 'super-mario-64-nintendo-64', category: '70 Star', value: '47:20', time: '47:20', url: 'https://www.speedrun.com/sm64' },
  { gameId: 'donkey-kong-country-super-nintendo', category: 'Any%', value: '21:15', time: '21:15', url: 'https://www.speedrun.com/dkc1' },
  { gameId: 'donkey-kong-country-2-super-nintendo', category: 'Any%', value: '27:40', time: '27:40', url: 'https://www.speedrun.com/dkc2' },
  { gameId: 'mega-man-2-nintendo-entertainment-system', category: 'Any% (Difficult)', value: '24:10', time: '24:10', url: 'https://www.speedrun.com/mm2' },
  { gameId: 'mega-man-x-super-nintendo', category: 'Any%', value: '40:00', time: '40:00', url: 'https://www.speedrun.com/mmx' },
  { gameId: 'the-legend-of-zelda-a-link-to-the-past-super-nintendo', category: 'Any% NMG', value: '1:30:00', time: '1:30:00', url: 'https://www.speedrun.com/alttp' },
  { gameId: 'the-legend-of-zelda-ocarina-of-time-nintendo-64', category: 'Any%', value: '7:48', time: '7:48', url: 'https://www.speedrun.com/oot' },
  { gameId: 'majoras-mask-nintendo-64', category: 'Any%', value: '1:22:00', time: '1:22:00', url: 'https://www.speedrun.com/mm' },
  { gameId: 'the-legend-of-zelda-majoras-mask-nintendo-64', category: 'Any%', value: '1:22:00', time: '1:22:00', url: 'https://www.speedrun.com/mm' },
  { gameId: 'castlevania-symphony-of-the-night-playstation', category: 'Alucard Any%', value: '24:30', time: '24:30', url: 'https://www.speedrun.com/sotn' },
  { gameId: 'castlevania-nintendo-entertainment-system', category: 'Any%', value: '11:00', time: '11:00', url: 'https://www.speedrun.com/cv1' },
  { gameId: 'super-metroid-super-nintendo', category: 'Any% (Unrestricted)', value: '40:30', time: '40:30', url: 'https://www.speedrun.com/supermetroid' },
  { gameId: 'final-fantasy-vii-playstation', category: 'New Game', value: '7:00:00', time: '7:00:00', url: 'https://www.speedrun.com/ff7' },
  { gameId: 'chrono-trigger-super-nintendo', category: 'Any% (SNES)', value: '2:40:00', time: '2:40:00', url: 'https://www.speedrun.com/ct' },
  { gameId: 'goldeneye-007-nintendo-64', category: 'All Missions (Agent)', value: '21:00', time: '21:00', url: 'https://www.speedrun.com/goldeneye' },
  { gameId: 'contra-nintendo-entertainment-system', category: 'Any%', value: '9:00', time: '9:00', url: 'https://www.speedrun.com/contra_nes' },
  { gameId: 'mega-man-nintendo-entertainment-system', category: 'Any%', value: '18:30', time: '18:30', url: 'https://www.speedrun.com/megaman' },
  { gameId: 'castlevania-aria-of-sorrow-game-boy-advance', category: 'Any% Julius', value: '5:40', time: '5:40', url: 'https://www.speedrun.com/aos' },
  { gameId: 'banjo-kazooie-nintendo-64', category: 'Any%', value: '1:06:00', time: '1:06:00', url: 'https://www.speedrun.com/bk' },
  { gameId: 'spyro-the-dragon-playstation', category: 'Any%', value: '30:00', time: '30:00', url: 'https://www.speedrun.com/spyro1' },
  { gameId: 'crash-team-racing-playstation', category: 'Adventure Mode Any%', value: '50:00', time: '50:00', url: 'https://www.speedrun.com/ctr' },
  { gameId: 'metal-gear-solid-playstation', category: 'Any% (No Major Glitches)', value: '1:30:00', time: '1:30:00', url: 'https://www.speedrun.com/mgs1' },
  { gameId: 'earthbound-super-nintendo', category: 'Any%', value: '3:50:00', time: '3:50:00', url: 'https://www.speedrun.com/earthbound' },
]

function nowIso() {
  return new Date().toISOString()
}

function buildSpeedrunWr(entry) {
  return JSON.stringify({
    category: entry.category,
    value: entry.value,
    time: entry.time,
    source: 'speedrun.com',
    url: entry.url,
  })
}

function buildDryRunPlan(db) {
  const gameIds = SPEEDRUNS.map((e) => e.gameId)
  const placeholders = gameIds.map(() => '?').join(', ')

  const rows = db.prepare(
    `SELECT id, speedrun_wr FROM games WHERE id IN (${placeholders})`
  ).all(...gameIds)

  const found = new Map(rows.map((r) => [r.id, r]))

  const plan = {
    totalInMap: SPEEDRUNS.length,
    notFound: [],
    willWrite: [],
    willSkip: [],
  }

  for (const entry of SPEEDRUNS) {
    if (!found.has(entry.gameId)) {
      plan.notFound.push(entry.gameId)
      continue
    }
    const row = found.get(entry.gameId)
    if (row.speedrun_wr === null || row.speedrun_wr === undefined || row.speedrun_wr === '') {
      plan.willWrite.push({ gameId: entry.gameId, category: entry.category, time: entry.time })
    } else {
      plan.willSkip.push({ gameId: entry.gameId, reason: 'speedrun_wr already set' })
    }
  }

  return plan
}

function applySpeedruns(db) {
  const timestamp = nowIso()
  const runKey = `enrich-speedrun-batch1-${timestamp}`

  const runId = Number(db.prepare(`
    INSERT INTO enrichment_runs (
      run_key, pipeline_name, mode, source_name, status, dry_run,
      started_at, items_seen, items_created, items_updated, items_skipped, items_flagged, error_count, notes
    ) VALUES (?, 'enrich_speedrun_batch1', 'apply', 'speedrun_com_curated', 'running', 0,
      ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, timestamp, 'Batch 1 speedrun WR data — games.speedrun_wr only').lastInsertRowid)

  const metrics = {
    itemsSeen: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of SPEEDRUNS) {
      metrics.itemsSeen += 1

      const row = db.prepare('SELECT id, speedrun_wr FROM games WHERE id = ?').get(entry.gameId)

      if (!row) {
        console.log(`  ✗ [NOT FOUND]  ${entry.gameId}`)
        metrics.itemsFlagged += 1
        continue
      }

      if (row.speedrun_wr !== null && row.speedrun_wr !== undefined && row.speedrun_wr !== '') {
        console.log(`  - [SKIP]       ${entry.gameId}  (speedrun_wr already set)`)
        metrics.itemsSkipped += 1
        continue
      }

      const wrJson = buildSpeedrunWr(entry)
      db.prepare('UPDATE games SET speedrun_wr = ? WHERE id = ?').run(wrJson, entry.gameId)

      console.log(`  ✓ [WRITE]      ${entry.gameId}  → ${entry.category}  ${entry.time}`)
      metrics.itemsUpdated += 1
    }
  })

  transaction()

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
    nowIso(),
    metrics.itemsSeen,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    `speedrun-batch1: ${metrics.itemsUpdated} written, ${metrics.itemsSkipped} skipped, ${metrics.itemsFlagged} missing`,
    runId
  )

  return { runId, runKey, metrics }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    if (!APPLY) {
      console.log('[DRY-RUN] enrich-speedrun-batch1 — pass --apply to write\n')
      const plan = buildDryRunPlan(db)

      if (plan.notFound.length) {
        console.log(`Not found in DB (${plan.notFound.length}):`)
        for (const id of plan.notFound) console.log(`  ✗ ${id}`)
        console.log()
      }

      console.log(`Would write (${plan.willWrite.length}):`)
      for (const entry of plan.willWrite) {
        console.log(`  ✓ ${entry.gameId}  [${entry.category}  ${entry.time}]`)
      }

      if (plan.willSkip.length) {
        console.log(`\nWould skip (${plan.willSkip.length}) — speedrun_wr already set:`)
        for (const entry of plan.willSkip) console.log(`  - ${entry.gameId}`)
      }

      console.log(
        `\nSummary: ${plan.willWrite.length} writes, ${plan.willSkip.length} skips, ${plan.notFound.length} not found (of ${plan.totalInMap} in map)`
      )
      return
    }

    console.log('[APPLY] enrich-speedrun-batch1\n')
    const result = applySpeedruns(db)
    const m = result.metrics
    console.log(`\nDone — run #${result.runId} (${result.runKey})`)
    console.log(`  Written : ${m.itemsUpdated}`)
    console.log(`  Skipped : ${m.itemsSkipped}`)
    console.log(`  Missing : ${m.itemsFlagged}`)
    console.log(`  Total   : ${m.itemsSeen}`)
  } finally {
    db.close()
  }
}

main()
