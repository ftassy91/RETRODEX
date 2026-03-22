'use strict'

const { Router } = require('express')
const { Op } = require('sequelize')
const Game = require('../models/Game')
const Franchise = require('../models/Franchise')
const CommunityReport = require('../../models/CommunityReport')
const RetrodexIndex = require('../../models/RetrodexIndex')
const { handleAsync, parseLimit, buildGameWhere } = require('../helpers/query')
const { withGameTrend, buildPriceHistoryPayload } = require('../helpers/priceHistory')

const router = Router()

function toGameSummary(game) {
  return {
    id: game.id,
    title: game.title,
    console: game.console,
    year: game.year,
    genre: game.genre,
    developer: game.developer,
    metascore: game.metascore,
    rarity: game.rarity,
    summary: game.summary,
    prices: {
      loose: game.loosePrice,
      cib: game.cibPrice,
      mint: game.mintPrice,
    },
  }
}

function parseStoredJson(value) {
  if (value == null || value === '') {
    return null
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
}

async function findGameById(id) {
  return Game.findByPk(id)
}

router.get('/games', handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query)
  const query = { where, order: [['title', 'ASC']] }

  if (req.query.limit) {
    query.limit = parseLimit(req.query.limit)
  }

  const games = await Game.findAll(query)
  res.json(games)
}))

router.get('/games/:id', handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
}))

router.get('/api/games', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 5000)
  const where = buildGameWhere(req.query)
  const includeTrend = String(req.query.include_trend || '') === '1'

  const total = await Game.count({ where })
  const games = await Game.findAll({ where, order: [['title', 'ASC']], limit })

  res.json({
    items: includeTrend ? games.map(withGameTrend) : games,
    returned: games.length,
    total,
  })
}))

router.get('/api/games/random', handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query)
  const count = await Game.count({ where })

  if (count === 0) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  const offset = Math.floor(Math.random() * count)
  const items = await Game.findAll({ where, order: [['title', 'ASC']], limit: 1, offset })

  if (!items.length) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  return res.json(items[0])
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const [game, reports, indexEntries] = await Promise.all([
    findGameById(req.params.id),
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
  ])

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(buildPriceHistoryPayload(game, { reports, indexEntries }))
}))

router.get('/api/games/:id/summary', handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json({ ok: true, item: toGameSummary(game) })
}))

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const game = await Game.findByPk(req.params.id, {
    attributes: ['id', 'synopsis', 'dev_anecdotes', 'dev_team', 'cheat_codes'],
  })

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
  const currentGame = await Game.findByPk(req.params.id, {
    attributes: ['id', 'console', 'rarity'],
  })

  if (!currentGame) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const sameConsoleSameRarity = await Game.findAll({
    where: {
      type: 'game',
      id: { [Op.ne]: currentGame.id },
      console: currentGame.console,
      rarity: currentGame.rarity,
    },
    attributes: ['id', 'title', 'console', 'year', 'rarity', 'loosePrice'],
    order: [['loosePrice', 'DESC'], ['title', 'ASC']],
    limit: 6,
  })

  const selectedGames = [...sameConsoleSameRarity]

  if (selectedGames.length < 6) {
    const fallbackGames = await Game.findAll({
      where: {
        type: 'game',
        id: { [Op.notIn]: [currentGame.id, ...selectedGames.map((game) => game.id)] },
        console: currentGame.console,
        rarity: { [Op.ne]: currentGame.rarity },
      },
      attributes: ['id', 'title', 'console', 'year', 'rarity', 'loosePrice'],
      order: [['loosePrice', 'DESC'], ['title', 'ASC']],
      limit: 6 - selectedGames.length,
    })

    selectedGames.push(...fallbackGames)
  }

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
  const game = await Game.findByPk(req.params.id, {
    attributes: ['id', 'franch_id'],
  })

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
