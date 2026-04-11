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

    // 3. Run scoring pipeline (sold-signal-based)
    console.log('[backfill] Running scoring pipeline...')
    const { gameSnapshots } = buildScoredMarketSnapshots(observations)
    console.log(`[backfill] ${gameSnapshots.length} game snapshots from sold signals`)

    // 3b. Catalog-aware tier floor: use games.loose_price + source_names
    //     The scoring pipeline only considers real sold signals (eBay, Yahoo JP).
    //     PriceCharting pricing guides are not "sold" data, but they ARE catalog data.
    //     A game with a catalog price deserves at least "low".
    console.log('[backfill] Fetching catalog data for tier floor...')
    const { rows: catalogRows } = await client.query(`
      SELECT id, loose_price, source_names, price_confidence_tier
      FROM games WHERE type = 'game'
    `)
    const catalogMap = new Map(catalogRows.map(r => [r.id, r]))

    const TIER_RANK = { unknown: 0, low: 1, medium: 2, high: 3 }

    // Build a merged snapshot list: scoring pipeline + catalog floor
    const snapshotMap = new Map(gameSnapshots.map(s => [s.gameId, s]))

    // For every game in catalog, ensure a tier floor
    for (const game of catalogRows) {
      const snapshot = snapshotMap.get(game.id)
      const pipelineTier = snapshot ? (snapshot.confidenceTier || 'unknown') : 'unknown'
      const existingTier = game.price_confidence_tier || 'unknown'

      let finalTier = pipelineTier
      let finalReason = snapshot ? snapshot.confidenceReason : null

      // Catalog floor: loose_price > 0 → at least "low"
      if (TIER_RANK[finalTier] < TIER_RANK['low'] && Number(game.loose_price) > 0) {
        finalTier = 'low'
        finalReason = 'Has catalog price data.'
      }

      // Multi-source floor: 2+ distinct sources → at least "medium"
      const sources = (game.source_names || '').split(',').map(s => s.trim()).filter(Boolean)
      if (TIER_RANK[finalTier] < TIER_RANK['medium'] && sources.length >= 2) {
        finalTier = 'medium'
        finalReason = `Multiple price sources: ${sources.join(', ')}.`
      }

      // Never downgrade: keep whichever is higher (existing vs computed)
      if (TIER_RANK[existingTier] > TIER_RANK[finalTier]) {
        finalTier = existingTier
        finalReason = null // keep existing reason
      }

      if (!snapshotMap.has(game.id)) {
        snapshotMap.set(game.id, {
          gameId: game.id,
          confidenceTier: finalTier,
          confidenceReason: finalReason,
          sourceNames: snapshot ? snapshot.sourceNames : [],
          latestSoldAt: snapshot ? snapshot.latestSoldAt : null,
        })
      } else {
        const s = snapshotMap.get(game.id)
        s.confidenceTier = finalTier
        if (finalReason) s.confidenceReason = finalReason
      }
    }

    const allSnapshots = [...snapshotMap.values()]

    // 4. Tier distribution
    const tierCounts = { high: 0, medium: 0, low: 0, unknown: 0 }
    for (const snapshot of allSnapshots) {
      const tier = snapshot.confidenceTier || 'unknown'
      tierCounts[tier] = (tierCounts[tier] || 0) + 1
    }
    console.log('[backfill] Tier distribution:', JSON.stringify(tierCounts))

    // 5. Sample output (show upgraded games)
    const upgraded = allSnapshots.filter(s => {
      const existing = catalogMap.get(s.gameId)
      return existing && TIER_RANK[s.confidenceTier] > TIER_RANK[existing.price_confidence_tier || 'unknown']
    })
    console.log(`[backfill] ${upgraded.length} games would be upgraded`)
    const samples = upgraded.slice(0, 8).map((s) => ({
      gameId: s.gameId,
      tier: s.confidenceTier,
      reason: s.confidenceReason,
      sources: s.sourceNames?.join(', ') || '',
    }))
    console.log('[backfill] Upgrade samples:', JSON.stringify(samples, null, 2))

    if (!apply) {
      console.log('[backfill] DRY-RUN complete. Use --apply to write.')
      return
    }

    // 6. Write to games table (only upgrades — never downgrade)
    console.log(`[backfill] Writing tier updates (upgrades only)...`)
    let written = 0
    for (const snapshot of allSnapshots) {
      const existing = catalogMap.get(snapshot.gameId)
      if (!existing) continue

      const existingRank = TIER_RANK[existing.price_confidence_tier || 'unknown']
      const newRank = TIER_RANK[snapshot.confidenceTier || 'unknown']
      if (newRank <= existingRank) continue // skip: no upgrade

      const tier = snapshot.confidenceTier || 'unknown'
      const reason = snapshot.confidenceReason || null
      const sourceNames = (snapshot.sourceNames || []).join(', ')

      // Fix: use toISOString for date format (was: String().slice(0,10) which gives "Sat Apr 04")
      const latestSoldAt = snapshot.latestSoldAt
        ? (snapshot.latestSoldAt instanceof Date
            ? snapshot.latestSoldAt.toISOString().slice(0, 10)
            : String(snapshot.latestSoldAt).slice(0, 10))
        : null

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

    console.log(`[backfill] ${written} games upgraded (downgrades skipped).`)

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
