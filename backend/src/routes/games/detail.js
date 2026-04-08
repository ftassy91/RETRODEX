'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const { setPublicEdgeCache } = require('../../helpers/cache-control')
const { toGameSummary } = require('../../lib/normalize')
const {
  fetchCanonicalGameById,
} = require('../../services/public-game-reader')
const { fetchGameDetailPayload } = require('../../services/public-runtime-payload/game-detail')
const {
  fetchGamePriceHistoryPayload,
} = require('../../services/public-runtime-payload-service')
const {
  fetchMarketIndex,
} = require('../../services/public-market-index-service')
const {
  fetchGameRegions,
} = require('../../services/public-game/regions')
const {
  createMarketReport,
} = require('../../services/public-market-report-service')

const router = Router()

async function readGame(id) {
  return fetchCanonicalGameById(id)
}

router.get('/games/:id', handleAsync(async (req, res) => {
  const game = await readGame(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const game = await readGame(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  setPublicEdgeCache(res, { cdnMaxAge: 300, staleWhileRevalidate: 900 })
  return res.json(game)
}))

router.get('/api/games/:id/summary', handleAsync(async (req, res) => {
  const game = await readGame(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  setPublicEdgeCache(res, { cdnMaxAge: 300, staleWhileRevalidate: 900 })
  return res.json({ ok: true, item: toGameSummary(game) })
}))

router.get('/api/games/:id/detail', handleAsync(async (req, res) => {
  const payload = await fetchGameDetailPayload(req.params.id, { scope: req.query.scope })
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }
  setPublicEdgeCache(res, { cdnMaxAge: 180, staleWhileRevalidate: 600 })
  return res.json(payload)
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const payload = await fetchGamePriceHistoryPayload(req.params.id)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  setPublicEdgeCache(res, { cdnMaxAge: 120, staleWhileRevalidate: 300 })
  return res.json(payload)
}))

router.get('/api/games/:id/regions', handleAsync(async (req, res) => {
  const game = await readGame(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const regions = await fetchGameRegions(req.params.id)
  setPublicEdgeCache(res, { cdnMaxAge: 300, staleWhileRevalidate: 900 })
  return res.json({ ok: true, regions })
}))

router.get('/api/games/:id/index', handleAsync(async (req, res) => {
  setPublicEdgeCache(res, { cdnMaxAge: 120, staleWhileRevalidate: 300 })
  return res.json({
    ok: true,
    ...(await fetchMarketIndex(req.params.id)),
  })
}))

router.post('/api/games/:id/reports', handleAsync(async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await createMarketReport(req.params.id, req.body || {})),
    })
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        error: error.message,
      })
    }

    throw error
  }
}))

module.exports = router
