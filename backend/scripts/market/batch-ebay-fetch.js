#!/usr/bin/env node
'use strict'

/**
 * batch-ebay-fetch.js — Fetch eBay sold data for multiple games via Playwright
 *
 * Usage:
 *   node backend/scripts/market/batch-ebay-fetch.js --limit=5
 *   node backend/scripts/market/batch-ebay-fetch.js --limit=20 --output=ebay-batch.json
 */

const path = require('path')
const fs = require('fs')
const ebay = require('../../src/services/market/connectors/ebay')
const { closeBrowser } = require('../../src/services/market/connectors/playwright-support')

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [rawKey, ...rest] = String(token || '').split('=')
    const key = rawKey.replace(/^--/, '')
    const value = rest.length ? rest.join('=') : true
    if (key) acc[key] = value
    return acc
  }, {})
}

// Games to fetch — top value games with PriceCharting data
const TARGETS = [
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

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const limit = Number(args.limit || 5)
  const outputFile = args.output || null
  const recordsPerGame = Number(args.records || 5)
  const targets = TARGETS.slice(0, limit)

  console.log(`\n  EBAY BATCH FETCH`)
  console.log(`  Games: ${targets.length} | Records/game: ${recordsPerGame}\n`)

  const allRecords = []
  let totalFetched = 0

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    const query = `${target.title} ${target.platform}`
    console.log(`  [${i + 1}/${targets.length}] ${target.title} (${target.platform})`)

    try {
      const records = await ebay.fetchSoldRecords(
        { ...target, query },
        { limit: recordsPerGame }
      )

      console.log(`    → ${records.length} records`)
      records.forEach((r) => {
        r.seed_game_id = target.id
        allRecords.push(r)
      })
      totalFetched += records.length
    } catch (err) {
      console.log(`    → ERROR: ${err.message}`)
    }

    // Brief pause between games to avoid rate limiting
    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }

  console.log(`\n  Total: ${totalFetched} records from ${targets.length} games`)

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
  } else {
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
