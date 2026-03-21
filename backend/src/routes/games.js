'use strict'

const { Router } = require('express')
const { Op } = require('sequelize')
const Game = require('../models/Game')
const Franchise = require('../models/Franchise')
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

function normalizeFranchiseMatchValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildTitleKeywords(title) {
  const normalized = normalizeFranchiseMatchValue(title)
  if (!normalized) {
    return []
  }

  const romanNumeralPattern = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i
  const tokens = normalized
    .split(' ')
    .filter((token) => token && !romanNumeralPattern.test(token) && !/^\d+$/.test(token))

  const keywords = []
  for (let size = 3; size >= 1; size -= 1) {
    if (tokens.length >= size) {
      keywords.push(tokens.slice(0, size).join(' '))
    }
  }

  return Array.from(new Set(keywords.filter((keyword) => keyword.length >= 3)))
}

function scoreFranchiseMatch(title, franchiseName) {
  const normalizedTitle = normalizeFranchiseMatchValue(title)
  const normalizedName = normalizeFranchiseMatchValue(franchiseName)

  if (!normalizedTitle || !normalizedName) {
    return 0
  }

  let score = 0

  if (normalizedTitle.includes(normalizedName)) {
    score += 100 + normalizedName.length
  }

  if (normalizedName.includes(normalizedTitle)) {
    score += 80 + normalizedTitle.length
  }

  for (const keyword of buildTitleKeywords(title)) {
    const allowKeywordMatch = keyword.includes(' ') || !normalizedName.includes(' ')
    if (allowKeywordMatch && normalizedName.includes(keyword)) {
      score += 40 + keyword.length
    }
  }

  return score
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
  const limit = parseLimit(req.query.limit, 20, 1000)
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
  const game = await findGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(buildPriceHistoryPayload(game))
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
    attributes: ['id', 'title'],
  })

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const franchises = await Franchise.findAll({
    attributes: ['id', 'name', 'slug', 'first_game', 'last_game'],
    order: [['name', 'ASC']],
  })

  let bestMatch = null
  let bestScore = 0

  for (const franchise of franchises) {
    const score = scoreFranchiseMatch(game.title, franchise.name)
    if (score > bestScore) {
      bestScore = score
      bestMatch = franchise
    }
  }

  return res.json({
    ok: true,
    franchise: bestMatch ? {
      id: bestMatch.id,
      name: bestMatch.name,
      slug: bestMatch.slug,
      first_game: bestMatch.first_game ?? null,
      last_game: bestMatch.last_game ?? null,
    } : null,
  })
}))

module.exports = router
