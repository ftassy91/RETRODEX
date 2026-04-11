#!/usr/bin/env node
'use strict'

/**
 * batch-ebay-fetch.js — Fetch eBay sold data for multiple games via Playwright
 *
 * Usage:
 *   node backend/scripts/market/batch-ebay-fetch.js --limit=5
 *   node backend/scripts/market/batch-ebay-fetch.js --console="Super Nintendo" --limit=100 --concurrency=5
 *   node backend/scripts/market/batch-ebay-fetch.js --console="NES" --tier=unknown --limit=20 --dry-run
 *
 * Options:
 *   --console=NAME     Fetch games for this console from Supabase (unknown tier first)
 *   --tier=TIER        Filter by confidence tier (default: unknown, then low)
 *   --limit=N          Max games to fetch (default: 5)
 *   --records=N        Max eBay records per game (default: 5)
 *   --concurrency=N    Parallel tabs (default: 1, max: 10)
 *   --output=FILE      Write results to JSON file
 *   --dry-run          Show targets without fetching eBay
 *
 * Stop mechanism:
 *   Create .stop-batch file in this directory to request graceful stop.
 *   The current chunk finishes, results are saved, then exit.
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })
const ebay = require('../../src/services/market/connectors/ebay')
const { closeBrowser } = require('../../src/services/market/connectors/playwright-support')

const STOP_FILE = path.join(__dirname, '.stop-batch')

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [rawKey, ...rest] = String(token || '').split('=')
    const key = rawKey.replace(/^--/, '')
    const value = rest.length ? rest.join('=') : true
    if (key) acc[key] = value
    return acc
  }, {})
}

function shouldStop() {
  return fs.existsSync(STOP_FILE)
}

function clearStopFile() {
  try { fs.unlinkSync(STOP_FILE) } catch (_) {}
}

function randomDelay(minMs, maxMs) {
  return new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)))
}

// Fallback targets when no --console is provided
const FALLBACK_TARGETS = [
  { id: 'earthbound-super-nintendo', title: 'EarthBound', platform: 'Super Nintendo' },
  { id: 'metal-slug-3-neo-geo', title: 'Metal Slug 3', platform: 'Neo Geo' },
  { id: 'shantae-game-boy-color', title: 'Shantae', platform: 'Game Boy Color' },
  { id: 'suikoden-ii-playstation', title: 'Suikoden II', platform: 'PlayStation' },
  { id: 'demons-crest-super-nintendo', title: "Demon's Crest", platform: 'Super Nintendo' },
  { id: 'mega-man-x3-super-nintendo', title: 'Mega Man X3', platform: 'Super Nintendo' },
  { id: 'castlevania-dracula-x-super-nintendo', title: 'Castlevania Dracula X', platform: 'Super Nintendo' },
  { id: 'terranigma-super-nintendo', title: 'Terranigma', platform: 'Super Nintendo' },
  { id: 'duck-tales-2-nintendo-entertainment-system', title: 'DuckTales 2', platform: 'NES' },
  { id: 'little-samson-nintendo-entertainment-system', title: 'Little Samson', platform: 'NES' },
  { id: 'castlevania-rondo-of-blood-turbografx-16', title: 'Castlevania Rondo of Blood', platform: 'TurboGrafx-16' },
  { id: 'garou-mark-of-the-wolves-neo-geo', title: 'Garou Mark of the Wolves', platform: 'Neo Geo' },
  { id: 'metal-slug-neo-geo', title: 'Metal Slug', platform: 'Neo Geo' },
  { id: 'metal-slug-2-neo-geo', title: 'Metal Slug 2', platform: 'Neo Geo' },
  { id: 'the-king-of-fighters-98-neo-geo', title: 'King of Fighters 98', platform: 'Neo Geo' },
  { id: 'chrono-trigger-super-nintendo', title: 'Chrono Trigger', platform: 'Super Nintendo' },
  { id: 'super-metroid-super-nintendo', title: 'Super Metroid', platform: 'Super Nintendo' },
  { id: 'final-fantasy-iii-super-nintendo', title: 'Final Fantasy III', platform: 'Super Nintendo' },
  { id: 'secret-of-mana-super-nintendo', title: 'Secret of Mana', platform: 'Super Nintendo' },
  { id: 'the-legend-of-zelda-a-link-to-the-past-super-nintendo', title: 'Zelda Link to the Past', platform: 'Super Nintendo' },
]

async function fetchTargetsFromSupabase(consoleName, tier, limit) {
  const { Client } = require('pg')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const tiers = tier ? [tier] : ['unknown', 'low']
  const targets = []

  for (const t of tiers) {
    if (targets.length >= limit) break
    const remaining = limit - targets.length
    const { rows } = await client.query(
      `SELECT id, title, console as platform
       FROM games
       WHERE type = 'game' AND console = $1 AND price_confidence_tier = $2
       ORDER BY title
       LIMIT $3`,
      [consoleName, t, remaining]
    )
    targets.push(...rows)
  }

  await client.end()
  return targets
}

async function fetchOneGame(target, recordsPerGame) {
  const query = `${target.title} ${target.platform}`
  try {
    const records = await ebay.fetchSoldRecords(
      { ...target, query },
      { limit: recordsPerGame }
    )
    records.forEach(r => { r.seed_game_id = target.id })
    return { target, records, error: null }
  } catch (err) {
    return { target, records: [], error: err.message }
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const limit = Number(args.limit || 5)
  const outputFile = args.output || null
  const recordsPerGame = Number(args.records || 5)
  const concurrency = Math.min(Math.max(Number(args.concurrency || 1), 1), 10)
  const consoleName = args.console || null
  const tier = args.tier || null
  const dryRun = Boolean(args['dry-run'])

  // Clear leftover stop file
  clearStopFile()

  let targets
  if (consoleName) {
    console.log(`\n  Loading ${consoleName} games from Supabase (tier: ${tier || 'unknown->low'})...`)
    targets = await fetchTargetsFromSupabase(consoleName, tier, limit)
    console.log(`  Found ${targets.length} games`)
  } else {
    targets = FALLBACK_TARGETS.slice(0, limit)
  }

  console.log(`\n  EBAY BATCH FETCH${dryRun ? ' (DRY-RUN)' : ''}`)
  console.log(`  Games: ${targets.length} | Records/game: ${recordsPerGame} | Concurrency: ${concurrency}\n`)

  if (dryRun) {
    targets.forEach((t, i) => console.log(`  [${i + 1}] ${t.title} (${t.platform}) — ${t.id}`))
    console.log(`\n  Dry-run complete. Remove --dry-run to fetch.`)
    return
  }

  const startTime = Date.now()
  const allRecords = []
  let totalFetched = 0
  let gamesProcessed = 0
  let stopped = false

  // Process in chunks of concurrency size
  for (let chunkStart = 0; chunkStart < targets.length; chunkStart += concurrency) {
    // Check stop file before each chunk
    if (shouldStop()) {
      console.log(`\n  STOP requested by operator (.stop-batch detected)`)
      stopped = true
      clearStopFile()
      break
    }

    const chunk = targets.slice(chunkStart, chunkStart + concurrency)
    const chunkLabel = `[${chunkStart + 1}-${chunkStart + chunk.length}/${targets.length}]`

    if (concurrency === 1) {
      // Sequential mode
      for (const target of chunk) {
        gamesProcessed++
        console.log(`  [${gamesProcessed}/${targets.length}] ${target.title} (${target.platform})`)
        const result = await fetchOneGame(target, recordsPerGame)
        if (result.error) {
          console.log(`    -> ERROR: ${result.error}`)
        } else {
          console.log(`    -> ${result.records.length} records`)
          allRecords.push(...result.records)
          totalFetched += result.records.length
        }
      }
    } else {
      // Parallel mode
      console.log(`  ${chunkLabel} fetching ${chunk.length} games in parallel...`)
      const results = await Promise.allSettled(
        chunk.map(target => fetchOneGame(target, recordsPerGame))
      )

      for (const settled of results) {
        gamesProcessed++
        if (settled.status === 'rejected') {
          console.log(`    -> REJECTED: ${settled.reason}`)
          continue
        }
        const { target, records, error } = settled.value
        if (error) {
          console.log(`    ${target.title} -> ERROR: ${error}`)
        } else {
          console.log(`    ${target.title} -> ${records.length} records`)
          allRecords.push(...records)
          totalFetched += records.length
        }
      }
    }

    // Random delay between chunks (not after last chunk)
    if (chunkStart + concurrency < targets.length && !stopped) {
      await randomDelay(1000, 3000)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const avgPerGame = gamesProcessed > 0 ? ((Date.now() - startTime) / 1000 / gamesProcessed).toFixed(1) : 0
  console.log(`\n  Total: ${totalFetched} records from ${gamesProcessed} games`)
  console.log(`  Time: ${elapsed}s total | ${avgPerGame}s/game avg`)
  if (stopped) console.log(`  (Stopped early by operator)`)

  // Output
  const output = allRecords.map((r) => ({
    game_id: r.seed_game_id,
    title_raw: r.title_raw,
    price_original: r.price_original,
    currency: r.currency,
    sold_at: r.sold_at,
    source: 'eBay',
    source_market: 'us',
    condition_hint: r.condition_hint_raw,
    listing_reference: r.listing_reference,
  }))

  if (outputFile) {
    fs.writeFileSync(path.resolve(outputFile), JSON.stringify(output, null, 2))
    console.log(`  Written to: ${outputFile}`)
  } else if (output.length > 0) {
    console.log('\n  Sample output (first 5):')
    output.slice(0, 5).forEach((r) => {
      console.log(`    ${r.game_id} | ${(r.title_raw || '').substring(0, 50)} | $${r.price_original} | ${(r.sold_at || '').substring(0, 10)}`)
    })
    console.log(`\n  Use --output=file.json to save all records`)
  }

  await closeBrowser()
}

run().catch((err) => {
  console.error('FATAL:', err.message)
  closeBrowser().catch(() => {})
  process.exit(1)
})
