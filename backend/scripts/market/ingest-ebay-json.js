#!/usr/bin/env node
'use strict'

/**
 * ingest-ebay-json.js — Import eBay batch JSON files into price_history
 *
 * Usage:
 *   node backend/scripts/market/ingest-ebay-json.js ebay-snes-batch1.json ebay-nes-batch1.json ...
 *   node backend/scripts/market/ingest-ebay-json.js --glob="ebay-*.json"
 *   node backend/scripts/market/ingest-ebay-json.js --dry-run ebay-snes-batch1.json
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

function parseArgs(argv) {
  const args = { files: [], dryRun: false }
  for (const token of argv) {
    if (token === '--dry-run') { args.dryRun = true; continue }
    if (token.startsWith('--')) continue
    args.files.push(token)
  }
  return args
}

async function run() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.files.length) {
    console.error('Usage: node ingest-ebay-json.js [--dry-run] file1.json file2.json ...')
    process.exit(1)
  }

  // Load all records from all files
  let allRecords = []
  for (const file of args.files) {
    const filePath = path.resolve(file)
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`)
      continue
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    console.log(`  ${path.basename(file)}: ${data.length} records`)
    allRecords.push(...data)
  }

  console.log(`\n  Total: ${allRecords.length} records from ${args.files.length} files`)

  // Filter out noise ("Expand Watch List" entries)
  const clean = allRecords.filter(r => {
    if (!r.game_id || !r.price_original) return false
    if ((r.title_raw || '').startsWith('Expand Watch')) return false
    return true
  })
  console.log(`  After filtering noise: ${clean.length} records (${allRecords.length - clean.length} removed)`)

  if (args.dryRun) {
    console.log('\n  DRY-RUN — sample:')
    clean.slice(0, 5).forEach(r => {
      console.log(`    ${r.game_id} | $${r.price_original} | ${(r.sold_at || '').substring(0, 10)} | ${(r.title_raw || '').substring(0, 50)}`)
    })
    console.log('\n  Remove --dry-run to write to price_history.')
    return
  }

  // Connect to Supabase
  const { Client } = require('pg')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  // Get existing count
  const { rows: beforeCount } = await client.query("SELECT count(*)::int as count FROM price_history WHERE source = 'eBay'")
  console.log(`\n  eBay records before: ${beforeCount[0].count}`)

  // Insert, skip duplicates by listing_reference
  let inserted = 0
  let skipped = 0

  for (const r of clean) {
    // Check duplicate
    if (r.listing_reference) {
      const { rows: existing } = await client.query(
        'SELECT 1 FROM price_history WHERE listing_reference = $1 LIMIT 1',
        [r.listing_reference]
      )
      if (existing.length) { skipped++; continue }
    }

    const price = Number(r.price_original) || 0
    await client.query(`
      INSERT INTO price_history (game_id, price, condition, sale_date, source, listing_url, listing_title, source_market, is_real_sale, sale_type, sold_at, currency, price_original, title_raw, listing_reference)
      VALUES ($1, $2::numeric, 'loose', $3, 'eBay', null, $4, $5, true, 'auction', $3, $6, $2::numeric, $4, $7)
    `, [
      r.game_id,
      price,
      r.sold_at || null,
      r.title_raw || null,
      r.source_market || 'us',
      r.currency || 'USD',
      r.listing_reference || null,
    ])
    inserted++
  }

  const { rows: afterCount } = await client.query("SELECT count(*)::int as count FROM price_history WHERE source = 'eBay'")
  console.log(`  Inserted: ${inserted} | Skipped (duplicates): ${skipped}`)
  console.log(`  eBay records after: ${afterCount[0].count}`)

  await client.end()
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
