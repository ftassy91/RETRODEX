#!/usr/bin/env node
'use strict'

/**
 * backfill-confidence-from-history.js
 *
 * Reads price_history from Supabase, transforms records to the format
 * expected by the scoring pipeline, runs buildScoredMarketSnapshots,
 * and writes the resulting confidence tiers back to the games table.
 *
 * Usage:
 *   node backend/scripts/market/backfill-confidence-from-history.js
 *   node backend/scripts/market/backfill-confidence-from-history.js --apply
 *   node backend/scripts/market/backfill-confidence-from-history.js --apply --limit=50
 */

const { parseArgs, createRemoteClient } = require('../_supabase-publish-common')
const { buildScoredMarketSnapshots } = require('../../src/services/market/score/index')

const BATCH_SIZE = 500

function transformHistoryToObservation(row) {
  // Map price_history row to the format buildScoredMarketSnapshots expects
  const conditionMap = { loose: 'Loose', cib: 'CIB', mint: 'Mint' }
  const rawCondition = String(row.condition_normalized || row.condition || '').trim()
  const normalized = conditionMap[rawCondition.toLowerCase()] || rawCondition || null

  return {
    match: {
      game: { id: row.game_id },
      score: Number(row.match_confidence) || 0.8,
    },
    normalized_condition: normalized,
    source_confidence: Number(row.source_confidence) || 0.5,
    source_market: row.source_market || 'us',
    source_name: row.source || null,
    source_slug: row.source || null,
    sold_at: row.sold_at || row.sale_date || null,
    is_real_sale: row.is_real_sale !== false,
    is_publishable: true,
    is_rejected: false,
    price_eur: Number(row.price_eur || row.price) || 0,
    price_original: Number(row.price_original || row.price) || 0,
    currency: row.currency || 'USD',
    title_raw: row.listing_title || row.title_raw || '',
    normalized_region: row.normalized_region || null,
    country_code: row.country_code || null,
    listing_url: row.listing_url || null,
    listing_reference: row.listing_reference || null,
    sale_type: row.sale_type || null,
    payload_hash: row.payload_hash || null,
    raw_payload: null,
  }
}

async function fetchAllPriceHistory(client, limit) {
  const limitClause = limit ? `LIMIT ${Number(limit)}` : ''
  const { rows } = await client.query(`
    SELECT ph.*
    FROM price_history ph
    JOIN games g ON ph.game_id = g.id AND g.type = 'game'
    ORDER BY ph.game_id, ph.sold_at DESC
    ${limitClause}
  `)
  return rows
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const apply = Boolean(args.apply)
  const limit = args.limit ? Number(args.limit) : null

  console.log(`[backfill] mode=${apply ? 'APPLY' : 'DRY-RUN'}${limit ? ` limit=${limit}` : ''}`)

  const client = createRemoteClient()
  await client.connect()

  try {
    // 1. Read price_history
    console.log('[backfill] Fetching price_history...')
    const historyRows = await fetchAllPriceHistory(client, limit)
    console.log(`[backfill] ${historyRows.length} price_history rows fetched`)

    if (!historyRows.length) {
      console.log('[backfill] No rows to process.')
      return
    }

    // 2. Transform to observation format
    const observations = historyRows.map(transformHistoryToObservation)
    console.log(`[backfill] ${observations.length} observations created`)

    // 3. Run scoring pipeline
    console.log('[backfill] Running scoring pipeline...')
    const { gameSnapshots } = buildScoredMarketSnapshots(observations)
    console.log(`[backfill] ${gameSnapshots.length} game snapshots produced`)

    // 4. Tier distribution
    const tierCounts = { high: 0, medium: 0, low: 0, unknown: 0 }
    for (const snapshot of gameSnapshots) {
      const tier = snapshot.confidenceTier || 'unknown'
      tierCounts[tier] = (tierCounts[tier] || 0) + 1
    }
    console.log('[backfill] Tier distribution:', JSON.stringify(tierCounts))

    // 5. Sample output
    const samples = gameSnapshots.slice(0, 5).map((s) => ({
      gameId: s.gameId,
      tier: s.confidenceTier,
      reason: s.confidenceReason,
      sources: s.sourceNames?.join(', '),
    }))
    console.log('[backfill] Samples:', JSON.stringify(samples, null, 2))

    if (!apply) {
      console.log('[backfill] DRY-RUN complete. Use --apply to write.')
      return
    }

    // 6. Write to games table
    console.log(`[backfill] Writing ${gameSnapshots.length} tier updates...`)
    let written = 0
    for (const snapshot of gameSnapshots) {
      const tier = snapshot.confidenceTier || 'unknown'
      const reason = snapshot.confidenceReason || null
      const sourceNames = (snapshot.sourceNames || []).join(', ')
      const latestSoldAt = snapshot.latestSoldAt
        ? String(snapshot.latestSoldAt).slice(0, 10)
        : null

      // Update tier + reason only (don't overwrite prices — those come from the full pipeline)
      await client.query(`
        UPDATE public.games
        SET price_confidence_tier = $2,
            price_confidence_reason = $3,
            source_names = COALESCE(NULLIF($4, ''), source_names),
            price_last_updated = COALESCE($5::date, price_last_updated)
        WHERE id = $1
      `, [snapshot.gameId, tier, reason, sourceNames, latestSoldAt])
      written += 1
    }

    console.log(`[backfill] ${written} games updated.`)

    // 7. Verify
    const { rows: verify } = await client.query(`
      SELECT price_confidence_tier, count(*)::int as count
      FROM games WHERE type = 'game'
      GROUP BY price_confidence_tier
      ORDER BY count DESC
    `)
    console.log('[backfill] Final tier distribution:', JSON.stringify(verify))

  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error('[backfill] FATAL:', error.message)
  process.exit(1)
})
