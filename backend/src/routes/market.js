'use strict'

const { Router } = require('express')
const { Op } = require('sequelize')
const Game = require('../models/Game')
const Accessory = require('../models/Accessory')
const RetrodexIndex = require('../../models/RetrodexIndex')
const CommunityReport = require('../../models/CommunityReport')
const Franchise = require('../models/Franchise')
const { handleAsync } = require('../helpers/query')

const router = Router()

function parseItemsLimit(value, defaultValue = 20, maxValue = 100) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue
  }
  return Math.min(parsed, maxValue)
}

function parseItemsOffset(value, defaultValue = 0) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue
  }
  return parsed
}

function buildItemsWhere(query = {}) {
  const where = {}
  const titleQuery = String(query.q || '').trim()
  const platform = String(query.platform || '').trim()
  const rarity = String(query.rarity || '').trim()
  const type = String(query.type || '').trim()

  if (titleQuery) {
    where.title = {
      [Op.like]: `%${titleQuery}%`,
    }
  }

  if (platform) {
    where.console = platform
  }

  if (rarity) {
    where.rarity = rarity
  }

  if (type) {
    where.type = type
  }

  return where
}

function toItemPayload(game) {
  return {
    id: game.id,
    title: game.title,
    platform: game.console,
    year: game.year,
    genre: game.genre,
    rarity: game.rarity,
    type: game.type || 'game',
    slug: game.slug || null,
    loosePrice: game.loosePrice,
    cibPrice: game.cibPrice,
    mintPrice: game.mintPrice,
  }
}

function toConsolePayload(game, gamesCount = 0) {
  return {
    id: game.id,
    title: game.title,
    platform: game.console,
    year: game.year,
    slug: game.slug || null,
    gamesCount,
  }
}

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseItemsLimit(req.query.limit, 20, 100)

  if (!q || q.length < 2) {
    return res.json({ ok: true, results: [], query: q })
  }

  const like = { [Op.like]: `%${q}%` }

  let games = []
  let franchises = []

  if (type === 'all' || type === 'game') {
    games = await Game.findAll({
      where: {
        type: 'game',
        [Op.or]: [
          { title: like },
          { console: like },
          { genre: like },
        ],
      },
      attributes: ['id', 'title', 'console', 'year', 'rarity', 'loosePrice', 'slug'],
      order: [['rarity', 'ASC'], ['title', 'ASC']],
      limit: type === 'all' ? Math.ceil(limit * 0.7) : limit,
    })
  }

  if (type === 'all' || type === 'franchise') {
    franchises = await Franchise.findAll({
      where: {
        [Op.or]: [
          { name: like },
          { description: like },
        ],
      },
      attributes: ['id', 'name', 'slug', 'first_game', 'last_game', 'developer'],
      order: [['name', 'ASC']],
      limit: type === 'all' ? Math.ceil(limit * 0.3) : limit,
    })
  }

  const results = [
    ...franchises.map((franchise) => ({ ...franchise.toJSON(), _type: 'franchise' })),
    ...games.map((game) => ({ ...game.toJSON(), _type: 'game' })),
  ]

  return res.json({
    ok: true,
    results,
    count: results.length,
    query: q,
  })
}))

router.get('/api/items', handleAsync(async (req, res) => {
  const where = buildItemsWhere(req.query)
  const limit = parseItemsLimit(req.query.limit, 20, 100)
  const offset = parseItemsOffset(req.query.offset, 0)

  const total = await Game.count({ where })
  const items = await Game.findAll({
    where,
    order: [['title', 'ASC']],
    limit,
    offset,
  })

  res.json({
    ok: true,
    items: items.map(toItemPayload),
    total,
    limit,
    offset,
  })
}))

router.get('/api/items/:id', handleAsync(async (req, res) => {
  const lookup = String(req.params.id || '').trim()
  const item = await Game.findOne({
    where: {
      [Op.or]: [
        { id: lookup },
        { slug: lookup },
      ],
    },
  })

  if (!item) {
    return res.status(404).json({ ok: false, error: 'Not found' })
  }

  return res.json({
    ok: true,
    item: toItemPayload(item),
  })
}))

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const consoles = await Game.findAll({
    where: { type: 'console' },
    order: [['year', 'ASC'], ['title', 'ASC']],
  })

  const counts = await Game.findAll({
    attributes: ['console'],
    where: {
      type: 'game',
      console: {
        [Op.in]: consoles.map((item) => item.console),
      },
    },
  })

  const gamesByPlatform = new Map()
  for (const game of counts) {
    gamesByPlatform.set(game.console, (gamesByPlatform.get(game.console) || 0) + 1)
  }

  res.json({
    ok: true,
    consoles: consoles.map((item) => toConsolePayload(item, gamesByPlatform.get(item.console) || 0)),
    count: consoles.length,
  })
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const lookup = String(req.params.id || '').trim()
  const consoleItem = await Game.findOne({
    where: {
      type: 'console',
      [Op.or]: [
        { id: lookup },
        { slug: lookup },
      ],
    },
  })

  if (!consoleItem) {
    return res.status(404).json({ ok: false, error: 'Not found' })
  }

  const games = await Game.findAll({
    where: {
      type: 'game',
      console: consoleItem.console,
    },
    order: [['title', 'ASC']],
    limit: 20,
  })

  const accessories = await Accessory.findAll({
    where: {
      console_id: consoleItem.id,
    },
    order: [['name', 'ASC']],
    limit: 10,
  })

  return res.json({
    ok: true,
    console: toConsolePayload(consoleItem, games.length),
    games: games.map(toItemPayload),
    accessories: accessories.map((item) => ({
      id: item.id,
      name: item.name,
      accessory_type: item.accessory_type || null,
      slug: item.slug || null,
    })),
  })
}))

router.get('/api/accessories/types', handleAsync(async (_req, res) => {
  const accessories = await Accessory.findAll({
    attributes: ['accessory_type'],
    order: [['accessory_type', 'ASC']],
  })

  const types = Array.from(new Set(
    accessories
      .map((item) => item.accessory_type)
      .filter(Boolean)
  ))

  res.json({
    ok: true,
    types,
  })
}))

router.get('/api/accessories', handleAsync(async (_req, res) => {
  const accessories = await Accessory.findAll({
    order: [['name', 'ASC']],
  })

  const consoleIds = Array.from(new Set(
    accessories
      .map((item) => item.console_id)
      .filter(Boolean)
  ))

  const consoles = consoleIds.length
    ? await Game.findAll({
      attributes: ['id', 'title'],
      where: {
        id: {
          [Op.in]: consoleIds,
        },
      },
    })
    : []

  const consoleTitles = new Map(consoles.map((item) => [item.id, item.title]))

  res.json({
    ok: true,
    accessories: accessories.map((item) => ({
      id: item.id,
      name: item.name,
      console_id: item.console_id || null,
      console_title: item.console_id ? consoleTitles.get(item.console_id) || null : null,
      accessory_type: item.accessory_type || null,
      release_year: item.release_year || null,
      slug: item.slug || null,
    })),
    count: accessories.length,
  })
}))

router.get('/api/index/:id', handleAsync(async (req, res) => {
  const indexEntries = await RetrodexIndex.findAll({
    where: {
      item_id: req.params.id,
    },
    order: [['condition', 'ASC']],
  })

  res.json({
    ok: true,
    item_id: req.params.id,
    index: indexEntries.map((entry) => ({
      condition: entry.condition,
      index_value: entry.index_value,
      range_low: entry.range_low,
      range_high: entry.range_high,
      confidence_pct: entry.confidence_pct,
      trend: entry.trend,
      sources_editorial: entry.sources_editorial,
      last_sale_date: entry.last_sale_date,
    })),
  })
}))

router.post('/api/reports', handleAsync(async (req, res) => {
  const { item_id, condition, reported_price, context, date_estimated, text_raw } = req.body || {}
  const normalizedItemId = String(item_id || '').trim()
  const allowedConditions = ['Loose', 'CIB', 'Mint']
  const normalizedPrice = Number(reported_price)
  const normalizedDate = date_estimated == null || date_estimated === '' ? null : String(date_estimated).trim()

  if (!normalizedItemId) {
    return res.status(400).json({
      ok: false,
      error: 'item_id requis',
    })
  }

  if (!allowedConditions.includes(condition)) {
    return res.status(400).json({
      ok: false,
      error: 'condition invalide: Loose, CIB ou Mint attendu',
    })
  }

  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'reported_price doit être supérieur à 0',
    })
  }

  if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return res.status(400).json({
      ok: false,
      error: 'date_estimated doit être au format YYYY-MM-DD ou null',
    })
  }

  const newReport = await CommunityReport.create({
    item_id: normalizedItemId,
    condition,
    reported_price: normalizedPrice,
    context: context || 'autre',
    date_estimated: normalizedDate,
    sale_title: text_raw || null,
    user_id: 'anonymous',
    user_trust_score: 0.40,
    is_editorial: false,
    report_confidence_score: 0.50,
  })

  return res.json({
    ok: true,
    id: newReport.id,
  })
}))

module.exports = router
