'use strict'
// SYNC: B1 - migre le 2026-03-23 - fallback Supabase et recherche par annee alignes avec les tests
// Decision source : SYNC.md § B1
// SYNC: A3 - migre le 2026-03-23 - recherche lue via Supabase
// Decision source : SYNC.md § A3

const { Router } = require('express')
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
  listLegacyConsoleAccessories,
  listLegacyAccessoryTypes,
  listLegacyAccessories,
} = require('../services/legacy-market-accessory-service')
const {
  fetchLegacyMarketIndex,
} = require('../services/legacy-market-index-service')
const {
  createLegacyMarketReport,
} = require('../services/legacy-market-report-service')
const {
  fetchLegacyMarketItem,
} = require('../services/legacy-market-item-service')

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

// SYNC: A5 - migre le 2026-03-23 - route /api/stats lue via Supabase
// Decision source : SYNC.md § A5
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
  const item = await fetchLegacyMarketItem(req.params.id)
  if (!item) {
    return res.status(404).json({ ok: false, error: 'Not found' })
  }

  return res.json({
    ok: true,
    item,
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
  const accessories = await listLegacyConsoleAccessories(payload.console.id, { limit: 10 })

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
    accessories,
    encyclopedia: payload.overview || null,
    relatedConsoles: payload.relatedConsoles || [],
    notableGames: payload.notableGames || [],
  })
}))

router.get('/api/accessories/types', handleAsync(async (_req, res) => {
  const types = await listLegacyAccessoryTypes()

  res.json({
    ok: true,
    types,
  })
}))

router.get('/api/accessories', handleAsync(async (_req, res) => {
  res.json({
    ok: true,
    ...(await listLegacyAccessories()),
  })
}))

router.get('/api/index/:id', handleAsync(async (req, res) => {
  res.json({
    ok: true,
    ...(await fetchLegacyMarketIndex(req.params.id)),
  })
}))

router.post('/api/reports', handleAsync(async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await createLegacyMarketReport(req.body || {})),
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
