'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const { toGameSummary } = require('../../lib/normalize')
const { buildGameDetailDataLayer } = require('../../helpers/game-detail-data-layer')
const {
  fetchGameContentProfileRow,
  fetchGameKnowledgeDomains,
  buildArchivePayload,
  buildEncyclopediaPayload,
  fetchCanonicalGameById,
} = require('../../services/public-game-reader')
const {
  fetchGamePriceHistoryPayload,
} = require('../../services/public-runtime-payload-service')

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

  return res.json(game)
}))

router.get('/api/games/:id/summary', handleAsync(async (req, res) => {
  const game = await readGame(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json({ ok: true, item: toGameSummary(game) })
}))

router.get('/api/games/:id/detail', handleAsync(async (req, res) => {
  const game = await readGame(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const [domains, storedProfile] = await Promise.all([
    fetchGameKnowledgeDomains(game),
    fetchGameContentProfileRow(game.id).catch(() => null),
  ])

  const archive = buildArchivePayload(game, domains)
  const encyclopedia = buildEncyclopediaPayload(game, domains)

  return res.json(buildGameDetailDataLayer({
    game,
    archive,
    encyclopedia,
    storedProfile,
  }))
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const payload = await fetchGamePriceHistoryPayload(req.params.id)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(payload)
}))

module.exports = router
