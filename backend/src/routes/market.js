'use strict'
// SYNC: B1 - migre le 2026-03-23 - fallback Supabase et recherche par annee alignes avec les tests
// Decision source : SYNC.md Â§ B1
// SYNC: A3 - migre le 2026-03-23 - recherche lue via Supabase
// Décision source : SYNC.md § A3

const { Router } = require('express')
const { Op } = require('sequelize')
const Game = require('../models/Game')
const Accessory = require('../models/Accessory')
const RetrodexIndex = require('../../models/RetrodexIndex')
const CommunityReport = require('../../models/CommunityReport')
const { fetchPublishedGameScope } = require('../services/public-publication-service')
const { handleAsync } = require('../helpers/query')
const { searchCatalog } = require('../services/public-search-service')
const {
  fetchStatsPayload,
  fetchItemsPayload,
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
} = require('../services/public-runtime-payload-service')
const {
  getHydratedGameByLookup,
} = require('../services/game-read-service')
const {
  buildConsolePayload,
} = require('../services/console-service')

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
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    metascore: game.metascore ?? null,
    coverImage: game.coverImage || game.cover_url || null,
    summary: game.summary || game.synopsis || null,
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

function getFreshnessInfo(lastDate) {
  if (!lastDate) {
    return 'outdated'
  }

  const parsed = new Date(lastDate)
  if (Number.isNaN(parsed.getTime())) {
    return 'outdated'
  }

  const days = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  if (days < 30) return 'recent'
  if (days < 90) return 'aging'
  if (days < 180) return 'stale'
  return 'outdated'
}

// SYNC: A5 - migre le 2026-03-23 - route /api/stats lue via Supabase
// Décision source : SYNC.md § A5
router.get('/api/stats', handleAsync(async (_req, res) => {
  res.json(await fetchStatsPayload())
}))

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseItemsLimit(req.query.limit, 20, 100)
  const scope = await fetchPublishedGameScope()
  return res.json(await searchCatalog(q, type, limit, scope))
}))

router.get('/api/items', handleAsync(async (req, res) => {
  const limit = parseItemsLimit(req.query.limit, 20, 100)
  const offset = parseItemsOffset(req.query.offset, 0)
  const type = String(req.query.type || '').trim().toLowerCase()

  if (type === 'console') {
    const payload = await fetchConsolesPayload()
    const consoles = payload.items || payload.consoles || []
    const query = String(req.query.q || '').trim().toLowerCase()
    const filtered = consoles.filter((item) => {
      if (!query) return true
      return [item.name, item.manufacturer, item.generation, item.slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })

    return res.json({
      ok: true,
      items: filtered.slice(offset, offset + limit).map((item) => ({
        id: item.id,
        title: item.name,
        platform: item.name,
        year: item.releaseYear,
        genre: null,
        rarity: null,
        type: 'console',
        slug: item.slug || null,
        loosePrice: null,
        cibPrice: null,
        mintPrice: null,
      })),
      total: filtered.length,
      limit,
      offset,
    })
  }

  const payload = await fetchItemsPayload({
    ...req.query,
    limit,
    offset,
    sort: 'title_asc',
  })

  res.json({
    ok: true,
    items: (payload.items || []).map(toItemPayload),
    total: payload.total,
    limit: payload.limit ?? limit,
    offset: payload.offset ?? offset,
  })
}))

router.get('/api/items/:id', handleAsync(async (req, res) => {
  const lookup = String(req.params.id || '').trim()
  const item = await getHydratedGameByLookup(lookup)

  if (!item) {
    const consolePayload = await buildConsolePayload(lookup, { gamesLimit: 24 }).catch(() => null)
    if (!consolePayload) {
      return res.status(404).json({ ok: false, error: 'Not found' })
    }

    return res.json({
      ok: true,
      item: {
        id: consolePayload.console.id,
        title: consolePayload.console.name,
        platform: consolePayload.console.name,
        year: consolePayload.console.releaseYear,
        genre: null,
        rarity: null,
        type: 'console',
        slug: consolePayload.console.slug || null,
        loosePrice: null,
        cibPrice: null,
        mintPrice: null,
      },
    })
  }

  return res.json({
    ok: true,
    item: toItemPayload(item),
  })
}))

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const payload = await fetchConsolesPayload()
  const consoles = payload.items || payload.consoles || []

  res.json({
    ok: true,
    consoles: consoles.map((item) => ({
      ...toConsolePayload({
        id: item.id,
        title: item.name,
        console: item.name,
        year: item.releaseYear,
        slug: item.slug || null,
      }, item.gamesCount || 0),
      manufacturer: item.manufacturer || null,
      generation: item.generation || null,
      overview: item.summary || null,
    })),
    count: payload.count ?? consoles.length,
  })
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const payload = await fetchConsoleDetailPayload(req.params.id)

  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Not found' })
  }

  const accessories = await Accessory.findAll({
    where: {
      console_id: payload.console.id,
    },
    order: [['name', 'ASC']],
    limit: 10,
  })

  return res.json({
    ok: true,
    console: {
      ...toConsolePayload({
        id: payload.console.id,
        title: payload.console.name,
        console: payload.console.name,
        year: payload.console.releaseYear,
        slug: payload.console.slug || null,
      }, payload.console.gamesCount || 0),
      manufacturer: payload.console.manufacturer || null,
    },
    games: (payload.games || []).map(toItemPayload),
    accessories: accessories.map((item) => ({
      id: item.id,
      name: item.name,
      accessory_type: item.accessory_type || null,
      slug: item.slug || null,
    })),
    encyclopedia: payload.overview || null,
    relatedConsoles: payload.relatedConsoles || [],
    notableGames: payload.notableGames || [],
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
      freshness: getFreshnessInfo(entry.last_sale_date || entry.last_computed_at),
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
