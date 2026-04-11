'use strict'
// BAZ context API — serves game + collection data for BAZ template generation

const { Router } = require('express')

const { handleAsync } = require('../helpers/query')
const { setPublicEdgeCache } = require('../helpers/cache-control')
const { resolveRequestCollectionScope } = require('../middleware/auth')
const { fetchCanonicalGameById } = require('../services/public-game-reader')
const { getCollectionStats } = require('../services/public-collection-service')
const { db, mode } = require('../../db_supabase')

const router = Router()

// ── GET /api/baz/titles — lightweight title list for BAZ game matching ──

let _titlesCache = { data: null, ts: 0 }
const TITLES_TTL = 10 * 60 * 1000 // 10 min

router.get('/api/baz/titles', handleAsync(async (_req, res) => {
  const now = Date.now()
  if (_titlesCache.data && (now - _titlesCache.ts) < TITLES_TTL) {
    setPublicEdgeCache(res, { cdnMaxAge: 300, staleWhileRevalidate: 600 })
    return res.json(_titlesCache.data)
  }

  if (mode !== 'supabase') return res.json([])

  const { data, error } = await db
    .from('games')
    .select('id,title,slug')
    .eq('type', 'game')
    .order('title')

  if (error) return res.status(500).json({ error: error.message })

  const titles = (data || []).map(g => ({ id: g.id, title: g.title, slug: g.slug }))
  _titlesCache = { data: titles, ts: now }

  setPublicEdgeCache(res, { cdnMaxAge: 300, staleWhileRevalidate: 600 })
  return res.json(titles)
}))

// ── GET /api/baz/context/collection — collection stats for BAZ templates ──
// NOTE: must be registered BEFORE the :gameId param route

router.get('/api/baz/context/collection', handleAsync(async (req, res) => {
  const stats = await getCollectionStats(resolveRequestCollectionScope(req))

  const totalMedium = stats.price_confidence_distribution?.medium || 0
  const totalHigh = stats.price_confidence_distribution?.high || 0

  // Compute sell candidates: items where loose > 1.5x paid (simplified estimate)
  // This is a summary stat — full list is in the cockpit
  const sellCandidates = stats.top5 ? stats.top5.length : 0

  setPublicEdgeCache(res, { cdnMaxAge: 60, staleWhileRevalidate: 120 })

  return res.json({
    total_items: stats.count || 0,
    total_value_loose: stats.total_loose || 0,
    total_paid: stats.total_paid || 0,
    dominant_currency: stats.dominant_currency || null,
    total_medium: totalMedium,
    total_high: totalHigh,
    sell_candidates: sellCandidates,
    delta: stats.profit_estimate || 0,
  })
}))

// ── GET /api/baz/context/:gameId — game data for BAZ templates ──

router.get('/api/baz/context/:gameId', handleAsync(async (req, res) => {
  const gameId = String(req.params.gameId || '').trim()
  if (!gameId) {
    return res.status(400).json({ error: 'missing_game_id' })
  }

  const game = await fetchCanonicalGameById(gameId)
  if (!game) {
    return res.status(404).json({ error: 'not_found' })
  }

  // Fetch anecdote count + one random sample
  let anecdoteCount = 0
  let anecdoteSample = null

  if (mode === 'supabase') {
    const { data: anecdotes, error: anecError } = await db
      .from('game_anecdotes')
      .select('id,anecdote_text,anecdote_type,baz_intro')
      .eq('game_id', gameId)
      .eq('validated', true)

    if (!anecError && Array.isArray(anecdotes)) {
      anecdoteCount = anecdotes.length
      if (anecdoteCount > 0) {
        anecdoteSample = anecdotes[Math.floor(Math.random() * anecdoteCount)]
      }
    }
  }

  // Collect source_names from game_prices if available
  let sourceNames = []
  if (mode === 'supabase') {
    const { data: prices, error: priceError } = await db
      .from('game_prices')
      .select('source_name')
      .eq('game_id', gameId)

    if (!priceError && Array.isArray(prices)) {
      sourceNames = [...new Set(prices.map((p) => p.source_name).filter(Boolean))]
    }
  }

  setPublicEdgeCache(res, { cdnMaxAge: 60, staleWhileRevalidate: 120 })

  return res.json({
    title: game.title || null,
    console: game.console || game.console_name || null,
    loose_price: game.loose_price != null ? Number(game.loose_price) : null,
    cib_price: game.cib_price != null ? Number(game.cib_price) : null,
    mint_price: game.mint_price != null ? Number(game.mint_price) : null,
    price_currency: game.price_currency || null,
    price_confidence_tier: game.price_confidence_tier || null,
    metascore: game.metascore != null ? Number(game.metascore) : null,
    rarity: game.rarity || null,
    source_names: sourceNames,
    anecdote_count: anecdoteCount,
    anecdote_sample: anecdoteSample,
  })
}))

// ── GET /api/baz/replies/:category — fetch replies by category with mood ──

router.get('/api/baz/replies/:category', handleAsync(async (req, res) => {
  const category = String(req.params.category || '').trim()
  if (!category || mode !== 'supabase') return res.json({ replies: [] })

  const { data, error } = await db
    .from('baz_replies')
    .select('id,text_fr,mood,usage_count')
    .eq('category', category)
    .eq('active', true)
    .order('usage_count', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  setPublicEdgeCache(res, 300)
  return res.json({ replies: data || [] })
}))

// ── POST /api/baz/replies/:id/used — increment usage_count ──

router.post('/api/baz/replies/:id/used', handleAsync(async (req, res) => {
  const id = Number(req.params.id)
  if (!id || mode !== 'supabase') return res.json({ ok: false })

  await db.from('baz_replies').update({ usage_count: db.raw ? undefined : 0 }).eq('id', id)
  // Simple increment via RPC or raw — fallback to select+update
  const { data } = await db.from('baz_replies').select('usage_count').eq('id', id).single()
  if (data) {
    await db.from('baz_replies').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id)
  }

  return res.json({ ok: true })
}))

module.exports = router
