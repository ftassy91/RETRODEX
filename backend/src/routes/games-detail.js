'use strict'
// DATA: legacy Sequelize path - not mounted by default in the canonical Supabase runtime

// LEGACY: this Sequelize-backed detail route tree is not mounted by default in the
// canonical Supabase runtime. The active public detail flow is served by
// `serverless.js` via `public-game-reader` and related Supabase readers.
// Do not add new product logic here during the canonical convergence.

const { Router } = require('express')
const Franchise = require('../models/Franchise')
const CommunityReport = require('../../models/CommunityReport')
const RetrodexIndex = require('../../models/RetrodexIndex')

const { handleAsync } = require('../helpers/query')
const { buildPriceHistoryPayload } = require('../helpers/priceHistory')
const {
  getHydratedGameById,
  listHydratedGamesByConsole,
} = require('../services/game-read-service')
const {
  toGameSummary,
  fetchSeedPriceHistory,
} = require('./games-helpers')
const {
  buildArchivePayload,
  buildEncyclopediaPayload,
} = require('../helpers/game-knowledge')
const { buildGameDetailDataLayer } = require('../helpers/game-detail-data-layer')
const {
  fetchLocalKnowledgeDomains,
  fetchLocalContentProfileRow,
} = require('../services/legacy-games-detail-service')

const router = Router()

router.get('/api/games/:id/archive', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) return res.status(404).json({ ok: false, error: 'Game not found' })
  const { editorial, production, media, music } = await fetchLocalKnowledgeDomains(game)

  res.json(buildArchivePayload({
    game,
    editorial,
    production,
    media,
    music,
    ostReleases: music.releases,
  }))
}))

router.get('/api/games/:id/detail', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const [domains, storedProfile] = await Promise.all([
    fetchLocalKnowledgeDomains(game),
    fetchLocalContentProfileRow(game.id),
  ])

  const archive = buildArchivePayload({
    game,
    editorial: domains.editorial,
    production: domains.production,
    media: domains.media,
    music: domains.music,
    ostReleases: domains.music?.releases || [],
  })
  const encyclopedia = buildEncyclopediaPayload({
    game,
    editorial: domains.editorial,
    production: domains.production,
    music: domains.music,
  })

  return res.json(buildGameDetailDataLayer({
    game,
    archive,
    encyclopedia,
    storedProfile,
  }))
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }
  return res.json(game)
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const [game, reports, indexEntries, seedHistory] = await Promise.all([
    getHydratedGameById(req.params.id),
    CommunityReport.findAll({
      where: {
        item_id: req.params.id,
        item_type: 'game',
        editorial_excluded: false,
      },
      order: [['date_estimated', 'ASC'], ['created_at', 'ASC'], ['id', 'ASC']],
    }),
    RetrodexIndex.findAll({
      where: {
        item_id: req.params.id,
        item_type: 'game',
      },
      order: [['condition', 'ASC']],
    }),
    fetchSeedPriceHistory(req.params.id),
  ])

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(buildPriceHistoryPayload(game, { reports, indexEntries, seedHistory }))
}))

router.get('/api/games/:id/summary', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json({ ok: true, item: toGameSummary(game) })
}))

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const { editorial, production, music } = await fetchLocalKnowledgeDomains(game)

  return res.json(buildEncyclopediaPayload({
    game,
    editorial,
    production,
    music,
  }))
}))

router.get('/api/games/:id/similar', handleAsync(async (req, res) => {
  const currentGame = await getHydratedGameById(req.params.id)

  if (!currentGame) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const consoleBundle = await listHydratedGamesByConsole({
    id: currentGame.consoleId || null,
  }, {
    nameVariants: [currentGame.console].filter(Boolean),
    limit: 5000,
    sort: 'price_desc',
  })

  const pool = (consoleBundle.items || []).filter((game) => game.id !== currentGame.id)
  const sameConsoleSameRarity = pool.filter((game) => game.rarity === currentGame.rarity)
  const fallbackGames = pool.filter((game) => game.rarity !== currentGame.rarity)
  const selectedGames = [...sameConsoleSameRarity, ...fallbackGames].slice(0, 6)

  return res.json({
    ok: true,
    games: selectedGames.map((game) => ({
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      rarity: game.rarity,
      loosePrice: game.loosePrice,
    })),
    count: selectedGames.length,
  })
}))

router.get('/api/games/:id/franchise', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  if (!game.franch_id) {
    return res.json({
      ok: true,
      franchise: null,
    })
  }

  const franchise = await Franchise.findOne({
    where: { id: game.franch_id },
    attributes: ['id', 'name', 'slug', 'first_game', 'last_game'],
  })

  return res.json({
    ok: true,
    franchise: franchise ? {
      id: franchise.id,
      name: franchise.name,
      slug: franchise.slug,
      first_game: franchise.first_game ?? null,
      last_game: franchise.last_game ?? null,
    } : null,
  })
}))

module.exports = router
