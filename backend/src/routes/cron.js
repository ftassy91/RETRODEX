'use strict'

const { Router } = require('express')
const { handleAsync } = require('../helpers/query')
const { db, mode } = require('../../db_supabase')

const router = Router()

// Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>
function verifyCron(req, res, next) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured — allow in dev, block in prod
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'CRON_SECRET not configured' })
    }
    return next()
  }

  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// GET /api/cron/snapshot — daily collection + game snapshots
router.get('/api/cron/snapshot', verifyCron, handleAsync(async (_req, res) => {
  if (mode !== 'supabase') {
    return res.json({ ok: false, error: 'supabase mode required' })
  }

  const today = new Date().toISOString().slice(0, 10)

  // 1. Collection snapshot (global)
  const { data: items } = await db
    .from('collection_items')
    .select('game_id, condition, price_paid, list_type')

  const gameIds = (items || [])
    .filter((i) => i.list_type !== 'wanted')
    .map((i) => i.game_id)
    .filter(Boolean)

  let totalLoose = 0, totalCib = 0, totalMint = 0, totalPaid = 0
  let lowConf = 0, medConf = 0, highConf = 0, unknownConf = 0
  let dominantCurrency = null
  const currCounts = {}

  if (gameIds.length) {
    const { data: games } = await db
      .from('games')
      .select('id, loose_price, cib_price, mint_price, price_currency, price_confidence_tier')
      .in('id', gameIds)

    for (const g of (games || [])) {
      totalLoose += Number(g.loose_price) || 0
      totalCib += Number(g.cib_price) || 0
      totalMint += Number(g.mint_price) || 0
      const ci = (items || []).find((i) => i.game_id === g.id)
      if (ci) totalPaid += Number(ci.price_paid) || 0

      const tier = String(g.price_confidence_tier || 'unknown').toLowerCase()
      if (tier === 'high') highConf++
      else if (tier === 'medium') medConf++
      else if (tier === 'low') lowConf++
      else unknownConf++

      if (g.price_currency) currCounts[g.price_currency] = (currCounts[g.price_currency] || 0) + 1
    }

    let maxC = 0
    for (const [c, n] of Object.entries(currCounts)) {
      if (n > maxC) { dominantCurrency = c; maxC = n }
    }

    // Insert collection snapshot
    await db.from('collection_snapshots').upsert({
      snapshot_date: today,
      total_items: gameIds.length,
      total_value_loose: Math.round(totalLoose * 100) / 100,
      total_value_cib: Math.round(totalCib * 100) / 100,
      total_value_mint: Math.round(totalMint * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      dominant_currency: dominantCurrency,
      total_low_confidence: lowConf,
      total_medium_confidence: medConf,
      total_high_confidence: highConf,
      total_unknown_confidence: unknownConf,
    }, { onConflict: 'snapshot_date' })

    // 2. Game snapshots (per game in collection)
    for (const g of (games || [])) {
      await db.from('game_snapshots').upsert({
        game_id: g.id,
        snapshot_date: today,
        loose_price: g.loose_price,
        cib_price: g.cib_price,
        mint_price: g.mint_price,
        price_currency: g.price_currency,
        price_confidence_tier: g.price_confidence_tier,
      }, { onConflict: 'game_id,snapshot_date' })
    }
  }

  return res.json({
    ok: true,
    date: today,
    collectionSnapshot: { items: gameIds.length, loose: totalLoose, paid: totalPaid },
    gameSnapshots: gameIds.length,
  })
}))

// GET /api/cron/tiers — recompute confidence tiers from price_history
router.get('/api/cron/tiers', verifyCron, handleAsync(async (_req, res) => {
  if (mode !== 'supabase') {
    return res.json({ ok: false, error: 'supabase mode required' })
  }

  // Execute the tier computation query via Supabase RPC or raw
  // Using the same SQL as LOT-PROD-08 backfill
  const { data, error } = await db.rpc('exec_sql', {
    query: `
      WITH gm AS (
        SELECT ph.game_id, count(*) as obs, count(distinct ph.source_market) as buckets,
          EXTRACT(DAY FROM now()-max(ph.sold_at))::int as days,
          round(avg(ph.match_confidence)::numeric,4) as am,
          round(avg(ph.source_confidence)::numeric,4) as ac,
          string_agg(distinct ph.source,', ' order by ph.source) as src
        FROM price_history ph JOIN games g ON ph.game_id=g.id AND g.type='game'
        WHERE ph.sold_at IS NOT NULL GROUP BY ph.game_id
      ),
      t AS (
        SELECT *, CASE
          WHEN obs>=4 AND buckets>=2 AND days<=45 AND am>=0.7 AND ac>=0.7 THEN 'high'
          WHEN obs>=2 AND buckets>=2 AND days<=90 AND am>=0.55 AND ac>=0.55 THEN 'medium'
          WHEN obs>=1 THEN 'low' ELSE 'unknown' END as tier
        FROM gm
      )
      UPDATE games g SET price_confidence_tier=t.tier,
        price_confidence_reason=CASE t.tier
          WHEN 'high' THEN 'Balanced '||t.buckets||'-bucket signal, '||t.obs||' obs, '||t.days||'d ago.'
          WHEN 'medium' THEN 'Usable '||t.buckets||'-bucket signal, '||t.obs||' obs.'
          WHEN 'low' THEN 'Limited '||t.buckets||' bucket(s), '||t.obs||' obs.'
          ELSE 'No signal.' END,
        source_names=t.src
      FROM t WHERE g.id=t.game_id
    `
  })

  // If RPC not available, fall back to reading current state
  if (error) {
    // RPC might not exist — just report current tiers
    const { data: tiers } = await db
      .from('games')
      .select('price_confidence_tier')
      .eq('type', 'game')

    const counts = { high: 0, medium: 0, low: 0, unknown: 0 }
    for (const g of (tiers || [])) {
      const t = String(g.price_confidence_tier || 'unknown').toLowerCase()
      counts[t] = (counts[t] || 0) + 1
    }

    return res.json({
      ok: true,
      mode: 'read-only',
      note: 'RPC not available — tiers not recomputed. Use Supabase MCP for manual recompute.',
      tiers: counts,
    })
  }

  return res.json({ ok: true, mode: 'recomputed' })
}))

module.exports = router
