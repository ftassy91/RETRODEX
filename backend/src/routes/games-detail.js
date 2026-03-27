'use strict'

const { Router } = require('express')
require('../models/associations')
const Franchise = require('../models/Franchise')
const CommunityReport = require('../../models/CommunityReport')
const RetrodexIndex = require('../../models/RetrodexIndex')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key

const { handleAsync } = require('../helpers/query')
const { buildPriceHistoryPayload } = require('../helpers/priceHistory')
const {
  getHydratedGameById,
  listHydratedGamesByConsole,
} = require('../services/game-read-service')
const {
  toGameSummary,
  parseStoredJson,
  fetchSeedPriceHistory,
} = require('./games-helpers')

const router = Router()

router.get('/api/games/:id/archive', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) return res.status(404).json({ ok: false, error: 'Game not found' })

  const safe = (field) => {
    if (!game[field]) return null
    try { return JSON.parse(game[field]) } catch (e) { return game[field] }
  }

  res.json({
    ok: true,
    id: game.id,
    title: game.title,
    manual_url: game.manual_url || null,
    lore: game.lore || null,
    gameplay_description: game.gameplay_description || null,
    characters: safe('characters'),
    versions: safe('versions'),
    ost: {
      composers: safe('ost_composers'),
      notable_tracks: safe('ost_notable_tracks'),
    },
    duration: {
      main: game.avg_duration_main || null,
      complete: game.avg_duration_complete || null,
    },
    speedrun_wr: safe('speedrun_wr'),
  })
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
      limit: 500,
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

  return res.json({
    ok: true,
    synopsis: game.synopsis ?? null,
    dev_anecdotes: parseStoredJson(game.dev_anecdotes),
    dev_team: parseStoredJson(game.dev_team),
    cheat_codes: parseStoredJson(game.cheat_codes),
  })
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
