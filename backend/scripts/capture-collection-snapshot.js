#!/usr/bin/env node
'use strict'

/**
 * capture-collection-snapshot.js
 *
 * Captures a daily snapshot of the collection's value and inserts it
 * into collection_snapshots. One snapshot per day (UNIQUE constraint).
 *
 * Usage:
 *   node backend/scripts/capture-collection-snapshot.js              # dry run
 *   node backend/scripts/capture-collection-snapshot.js --apply      # write to DB
 *   node backend/scripts/capture-collection-snapshot.js --apply --date=2026-04-09
 */

const { parseArgs, createRemoteClient } = require('./_supabase-publish-common')

async function captureSnapshot(client, options = {}) {
  const apply = Boolean(options.apply)
  const snapshotDate = options.date || new Date().toISOString().slice(0, 10)

  console.log(`[snapshot] mode=${apply ? 'APPLY' : 'DRY-RUN'} date=${snapshotDate}`)

  // 1. Read collection items joined with games
  const { rows: items } = await client.query(`
    SELECT ci.game_id, ci.condition, ci.price_paid, ci.list_type,
           g.loose_price, g.cib_price, g.mint_price,
           g.price_confidence_tier, g.price_currency
    FROM collection_items ci
    JOIN games g ON ci.game_id = g.id
    WHERE ci.list_type != 'wanted' OR ci.list_type IS NULL
  `)

  console.log(`[snapshot] ${items.length} owned collection items`)

  if (!items.length) {
    console.log('[snapshot] No items to snapshot.')
    return null
  }

  // 2. Compute totals
  let totalLoose = 0, totalCib = 0, totalMint = 0, totalPaid = 0
  let lowConf = 0, medConf = 0, highConf = 0, unknownConf = 0
  const currencyCounts = {}

  for (const item of items) {
    totalLoose += Number(item.loose_price) || 0
    totalCib += Number(item.cib_price) || 0
    totalMint += Number(item.mint_price) || 0
    totalPaid += Number(item.price_paid) || 0

    const tier = String(item.price_confidence_tier || 'unknown').toLowerCase()
    if (tier === 'high') highConf++
    else if (tier === 'medium') medConf++
    else if (tier === 'low') lowConf++
    else unknownConf++

    const cur = item.price_currency
    if (cur) currencyCounts[cur] = (currencyCounts[cur] || 0) + 1
  }

  // Dominant currency
  let dominantCurrency = null
  let maxCount = 0
  for (const [cur, cnt] of Object.entries(currencyCounts)) {
    if (cnt > maxCount) { dominantCurrency = cur; maxCount = cnt }
  }

  const snapshot = {
    snapshot_date: snapshotDate,
    total_items: items.length,
    total_value_loose: Math.round(totalLoose * 100) / 100,
    total_value_cib: Math.round(totalCib * 100) / 100,
    total_value_mint: Math.round(totalMint * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    dominant_currency: dominantCurrency,
    total_low_confidence: lowConf,
    total_medium_confidence: medConf,
    total_high_confidence: highConf,
    total_unknown_confidence: unknownConf,
  }

  console.log('[snapshot] Computed:', JSON.stringify(snapshot, null, 2))

  if (!apply) {
    console.log('[snapshot] DRY-RUN complete. Use --apply to write.')
    return snapshot
  }

  // 3. Insert (ON CONFLICT skip if already exists for this date)
  const { rows: inserted } = await client.query(`
    INSERT INTO collection_snapshots
      (snapshot_date, total_items, total_value_loose, total_value_cib, total_value_mint,
       total_paid, dominant_currency, total_low_confidence, total_medium_confidence,
       total_high_confidence, total_unknown_confidence)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (snapshot_date) DO UPDATE SET
      total_items = EXCLUDED.total_items,
      total_value_loose = EXCLUDED.total_value_loose,
      total_value_cib = EXCLUDED.total_value_cib,
      total_value_mint = EXCLUDED.total_value_mint,
      total_paid = EXCLUDED.total_paid,
      dominant_currency = EXCLUDED.dominant_currency,
      total_low_confidence = EXCLUDED.total_low_confidence,
      total_medium_confidence = EXCLUDED.total_medium_confidence,
      total_high_confidence = EXCLUDED.total_high_confidence,
      total_unknown_confidence = EXCLUDED.total_unknown_confidence
    RETURNING id, snapshot_date
  `, [
    snapshot.snapshot_date, snapshot.total_items,
    snapshot.total_value_loose, snapshot.total_value_cib, snapshot.total_value_mint,
    snapshot.total_paid, snapshot.dominant_currency,
    snapshot.total_low_confidence, snapshot.total_medium_confidence,
    snapshot.total_high_confidence, snapshot.total_unknown_confidence,
  ])

  console.log(`[snapshot] Written: id=${inserted[0]?.id} date=${inserted[0]?.snapshot_date}`)

  // 4. Verify count
  const { rows: countRows } = await client.query(
    'SELECT count(*)::int as total FROM collection_snapshots'
  )
  console.log(`[snapshot] Total snapshots in DB: ${countRows[0]?.total}`)

  return snapshot
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const client = createRemoteClient()
  await client.connect()
  try {
    await captureSnapshot(client, args)
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error('[snapshot] FATAL:', error.message)
  process.exit(1)
})
