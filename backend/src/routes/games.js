'use strict'
// SYNC: A2 - migre le 2026-03-23 - routes /api/games lues via Supabase
// Décision source : SYNC.md § A2

const { Router } = require('express')
const { Op, literal } = require('sequelize')
const Game = require('../models/Game')
const Franchise = require('../models/Franchise')
const CommunityReport = require('../../models/CommunityReport')
const RetrodexIndex = require('../../models/RetrodexIndex')
process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key
const { queryGames, getGameById } = require('../../db_supabase')
const { handleAsync, parseLimit, buildGameWhere } = require('../helpers/query')
const { withGameTrend, buildPriceHistoryPayload } = require('../helpers/priceHistory')

const router = Router()

function buildGamesOrder(sort) {
  const sortKey = String(sort || '').trim()

  const SORT_MAP = {
    title_asc: [['title', 'ASC']],
    title_desc: [['title', 'DESC']],
    price_asc: [
      [literal('CASE WHEN loose_price IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['loosePrice', 'ASC'],
      ['title', 'ASC'],
    ],
    price_desc: [
      [literal('CASE WHEN loose_price IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['loosePrice', 'DESC'],
      ['title', 'ASC'],
    ],
    year_asc: [
      [literal('CASE WHEN year IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['year', 'ASC'],
      ['title', 'ASC'],
    ],
    year_desc: [
      [literal('CASE WHEN year IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['year', 'DESC'],
      ['title', 'ASC'],
    ],
    meta_asc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'ASC'],
      ['title', 'ASC'],
    ],
    meta_desc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'DESC'],
      ['title', 'ASC'],
    ],
    metascore_asc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'ASC'],
      ['title', 'ASC'],
    ],
    metascore_desc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'DESC'],
      ['title', 'ASC'],
    ],
    rarity_desc: [
      [literal(`CASE rarity
        WHEN 'LEGENDARY' THEN 0
        WHEN 'EPIC' THEN 1
        WHEN 'RARE' THEN 2
        WHEN 'UNCOMMON' THEN 3
        WHEN 'COMMON' THEN 4
        ELSE 5
      END`), 'ASC'],
      [literal('CASE WHEN loose_price IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['loosePrice', 'DESC'],
      ['title', 'ASC'],
    ],
    rarity_asc: [
      [literal(`CASE rarity
        WHEN 'COMMON' THEN 0
        WHEN 'UNCOMMON' THEN 1
        WHEN 'RARE' THEN 2
        WHEN 'EPIC' THEN 3
        WHEN 'LEGENDARY' THEN 4
        ELSE 5
      END`), 'ASC'],
      ['title', 'ASC'],
    ],
  }

  return SORT_MAP[sortKey] || SORT_MAP.title_asc
}

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

function normalizeGameRecord(game) {
  if (!game || typeof game !== 'object') {
    return game
  }

  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
  }
}

function rarityRankDescending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'LEGENDARY': return 0
    case 'EPIC': return 1
    case 'RARE': return 2
    case 'UNCOMMON': return 3
    case 'COMMON': return 4
    default: return 5
  }
}

function rarityRankAscending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'COMMON': return 0
    case 'UNCOMMON': return 1
    case 'RARE': return 2
    case 'EPIC': return 3
    case 'LEGENDARY': return 4
    default: return 5
  }
}

function compareNullableNumbers(left, right, ascending = true) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftMissing = !Number.isFinite(leftNumber)
  const rightMissing = !Number.isFinite(rightNumber)

  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber
}

function compareGamesForSort(leftGame, rightGame, sortKey) {
  const left = normalizeGameRecord(leftGame)
  const right = normalizeGameRecord(rightGame)
  const leftTitle = String(left.title || '')
  const rightTitle = String(right.title || '')

  switch (String(sortKey || '').trim()) {
    case 'title_desc':
      return rightTitle.localeCompare(leftTitle, 'fr', { sensitivity: 'base' })
    case 'price_asc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'price_desc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_asc':
      return compareNullableNumbers(left.year, right.year, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_desc':
      return compareNullableNumbers(left.year, right.year, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_asc':
    case 'metascore_asc':
      return compareNullableNumbers(left.metascore, right.metascore, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_desc':
    case 'metascore_desc':
      return compareNullableNumbers(left.metascore, right.metascore, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_desc':
      return rarityRankDescending(left.rarity) - rarityRankDescending(right.rarity)
        || compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_asc':
      return rarityRankAscending(left.rarity) - rarityRankAscending(right.rarity)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'title_asc':
    default:
      return leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
  }
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
  const includeTrend = String(req.query.include_trend || '') === '1'
  const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0)
  const { items: rawItems = [] } = await queryGames({
    sort: req.query.sort,
    console: req.query.console,
    rarity: req.query.rarity,
    limit: 5000,
    offset: 0,
    search: req.query.q,
  })
  const filteredItems = rawItems
    .map(normalizeGameRecord)
    .sort((left, right) => compareGamesForSort(left, right, req.query.sort))
  const total = filteredItems.length
  const games = filteredItems.slice(offset, offset + limit)

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
  const game = normalizeGameRecord(await getGameById(req.params.id))

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
