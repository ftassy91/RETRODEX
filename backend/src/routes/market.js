'use strict'
// SYNC: A3 - migre le 2026-03-23 - recherche lue via Supabase
// Décision source : SYNC.md § A3

const { Router } = require('express')
const { Op } = require('sequelize')
const Game = require('../models/Game')
const Accessory = require('../models/Accessory')
const RetrodexIndex = require('../../models/RetrodexIndex')
const CommunityReport = require('../../models/CommunityReport')
const Franchise = require('../models/Franchise')
process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key
const { db, getStats } = require('../../db_supabase')
const { handleAsync } = require('../helpers/query')
const { dedupeSearchResults } = require('../helpers/search')
const {
  getConsoleById,
  getRelatedConsoles,
  normalizeConsoleKey,
} = require('../lib/consoles')

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

function buildSearchFetchLimit(value, multiplier = 2, hardCap = 200) {
  return Math.min(Math.max(value * multiplier, value), hardCap)
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

function matchNotableGames(notableTitles = [], games = []) {
  const byTitle = new Map(
    games.map((game) => [normalizeConsoleKey(game.title), game])
  )

  return notableTitles.map((title) => {
    const match = byTitle.get(normalizeConsoleKey(title)) || null
    return {
      title,
      game: match ? toItemPayload(match) : null,
    }
  })
}

function median(values) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
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

async function fetchAllSupabaseGamesForStats() {
  const items = []
  const batchSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,rarity,loose_price,cib_price,mint_price,synopsis,source_confidence')
      .eq('type', 'game')
      .order('title', { ascending: true })
      .range(from, from + batchSize - 1)

    if (error) {
      throw new Error(error.message)
    }

    if (!Array.isArray(data) || data.length === 0) {
      break
    }

    items.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return items
}

function normalizeSearchGameRow(row) {
  return {
    id: row.id,
    title: row.title || row.name || null,
    console: row.console || null,
    year: row.year ?? null,
    rarity: row.rarity || null,
    loosePrice: row.loosePrice ?? row.loose_price ?? null,
    slug: row.slug || null,
    franch_id: row.franch_id || null,
    source_confidence: row.source_confidence ?? null,
    _type: 'game',
  }
}

function normalizeSearchFranchiseRow(row) {
  return {
    id: row.id || row.slug,
    name: row.name,
    slug: row.slug || null,
    first_game: row.first_game ?? row.first_game_year ?? null,
    last_game: row.last_game ?? row.last_game_year ?? null,
    developer: row.developer || null,
    _type: 'franchise',
  }
}

async function fetchSearchIndexResults(query, limit) {
  const { data, error } = await db
    .from('retrodex_search_index')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

async function fetchSearchFallbackResults(query, type, requestedGamesLimit, requestedFranchisesLimit) {
  const gamePromises = []
  const franchisePromises = []

  if (type === 'all' || type === 'game') {
    gamePromises.push(
      db
        .from('games')
        .select('id,title,console,year,rarity,loosePrice:loose_price,slug,franch_id,source_confidence')
        .eq('type', 'game')
        .ilike('title', `%${query}%`)
        .limit(buildSearchFetchLimit(requestedGamesLimit))
    )
  }

  if (type === 'all' || type === 'franchise') {
    franchisePromises.push(
      db
        .from('franchise_entries')
        .select('slug,name,first_game_year,last_game_year,developer')
        .ilike('name', `%${query}%`)
        .limit(requestedFranchisesLimit)
    )
  }

  const [gamesResult, franchisesResult] = await Promise.all([
    gamePromises[0] || Promise.resolve({ data: [], error: null }),
    franchisePromises[0] || Promise.resolve({ data: [], error: null }),
  ])

  if (gamesResult.error) throw new Error(gamesResult.error.message)
  if (franchisesResult.error) throw new Error(franchisesResult.error.message)

  return {
    games: (gamesResult.data || []).map(normalizeSearchGameRow),
    franchises: (franchisesResult.data || []).map((row) => normalizeSearchFranchiseRow({
      id: row.slug,
      slug: row.slug,
      name: row.name,
      first_game_year: row.first_game_year,
      last_game_year: row.last_game_year,
      developer: row.developer,
    })),
  }
}

// SYNC: A5 - migre le 2026-03-23 - route /api/stats lue via Supabase
// Décision source : SYNC.md § A5
router.get('/api/stats', handleAsync(async (_req, res) => {
  const statsBase = await getStats().catch(() => ({}))
  const games = await fetchAllSupabaseGamesForStats()
  const { count: franchiseCount, error: franchiseError } = await db
    .from('franchise_entries')
    .select('*', { count: 'exact', head: true })

  if (franchiseError) {
    throw new Error(franchiseError.message)
  }

  const byRarity = {
    LEGENDARY: 0,
    EPIC: 0,
    RARE: 0,
    UNCOMMON: 0,
    COMMON: 0,
  }

  const byPlatformMap = new Map()
  const looseValues = []
  let withSynopsis = 0

  for (const game of games) {
    const rarity = Object.prototype.hasOwnProperty.call(byRarity, game.rarity) ? game.rarity : 'COMMON'
    byRarity[rarity] += 1

    const platform = String(game.console || 'Unknown').trim() || 'Unknown'
    byPlatformMap.set(platform, (byPlatformMap.get(platform) || 0) + 1)

    if (String(game.synopsis || '').trim()) {
      withSynopsis += 1
    }

    const loose = Number(game.loose_price)
    if (Number.isFinite(loose) && loose > 0) {
      looseValues.push(loose)
    }
  }

  const byPlatform = Array.from(byPlatformMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((left, right) => right.count - left.count || left.platform.localeCompare(right.platform))
    .slice(0, 10)

  const pricedGames = games
    .filter((game) => Number.isFinite(Number(game.loose_price)) && Number(game.loose_price) > 0)
    .sort((left, right) => Number(right.loose_price) - Number(left.loose_price))

  const top5Expensive = pricedGames.slice(0, 5).map((game) => ({
    id: game.id,
    title: game.title,
    platform: game.console,
    loosePrice: Number(game.loose_price),
  }))

  const expensiveGame = pricedGames[0] || null
  const cheapestGame = [...pricedGames].sort((left, right) => Number(left.loose_price) - Number(right.loose_price))[0] || null

  const trustStats = { t1: 0, t3: 0, t4: 0 }
  games.forEach((game) => {
    const confidence = Number(game.source_confidence) || 0
    if (confidence >= 0.6) {
      trustStats.t1 += 1
    } else if (confidence >= 0.25) {
      trustStats.t3 += 1
    } else {
      trustStats.t4 += 1
    }
  })

  const avgLoose = looseValues.length
    ? looseValues.reduce((sum, value) => sum + value, 0) / looseValues.length
    : 0

  res.json({
    ok: true,
    total_games: Number(statsBase.total_games) || games.length,
    total_platforms: byPlatformMap.size,
    priced_games: pricedGames.length,
    by_rarity: byRarity,
    by_platform: byPlatform,
    price_stats: {
      avg_loose: Math.round(avgLoose * 100) / 100,
      max_loose: expensiveGame ? Number(expensiveGame.loosePrice) : 0,
      min_loose: cheapestGame ? Number(cheapestGame.loosePrice) : 0,
      median_loose: Math.round(median(looseValues) * 100) / 100,
    },
    trust_stats: trustStats,
    encyclopedia_stats: {
      with_synopsis: withSynopsis,
      total_franchises: franchiseCount || 0,
    },
    top5_expensive: top5Expensive,
    expensive_game: expensiveGame ? {
      id: expensiveGame.id,
      title: expensiveGame.title,
      platform: expensiveGame.console,
      loosePrice: Number(expensiveGame.loose_price),
      year: expensiveGame.year,
    } : null,
    cheapest_game: cheapestGame ? {
      id: cheapestGame.id,
      title: cheapestGame.title,
      platform: cheapestGame.console,
      loosePrice: Number(cheapestGame.loose_price),
      year: cheapestGame.year,
    } : null,
  })
}))

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseItemsLimit(req.query.limit, 20, 100)
  const numericYear = /^\d{4}$/.test(q) ? Number.parseInt(q, 10) : null

  if (!q || q.length < 2) {
    return res.json({ ok: true, results: [], query: q })
  }

  const requestedGamesLimit = type === 'all' ? Math.ceil(limit * 0.7) : limit
  const requestedFranchisesLimit = type === 'all' ? Math.ceil(limit * 0.3) : limit

  let results = []

  try {
    const indexRows = await fetchSearchIndexResults(q, buildSearchFetchLimit(limit))
    results = indexRows
      .filter((row) => type === 'all' || row._type === type)
      .map((row) => (row._type === 'franchise'
        ? normalizeSearchFranchiseRow(row)
        : normalizeSearchGameRow(row)))
  } catch (_error) {
    const fallback = await fetchSearchFallbackResults(q, type, requestedGamesLimit, requestedFranchisesLimit)
    results = [
      ...fallback.franchises,
      ...dedupeSearchResults(fallback.games).slice(0, requestedGamesLimit),
    ]
  }

  if (numericYear && (type === 'all' || type === 'game')) {
    results = results.filter((item) => item._type !== 'game' || item.year === numericYear)
  }

  function scoreResult(result, query) {
    const normalizedQuery = query.toLowerCase().trim()
    const name = String(result.name || result.title || '').toLowerCase()
    if (name === normalizedQuery) return 0
    if (name.startsWith(`${normalizedQuery} `)) return 1
    if (name.startsWith(normalizedQuery)) return 2
    if (name.endsWith(` ${normalizedQuery}`)) return 2
    if (name.includes(` ${normalizedQuery}`)) return 3
    if (name.includes(normalizedQuery)) return 4
    return 10
  }

  results.sort((a, b) => {
    const diff = scoreResult(a, q) - scoreResult(b, q)
    if (diff !== 0) return diff
    const aName = String(a.name || a.title || '').toLowerCase()
    const bName = String(b.name || b.title || '').toLowerCase()
    if (aName === bName) {
      if (a._type === 'franchise' && b._type !== 'franchise') return -1
      if (b._type === 'franchise' && a._type !== 'franchise') return 1
    }
    if (a._type === 'game' && b._type !== 'game') return -1
    if (b._type === 'game' && a._type !== 'game') return 1
    return 0
  })

  results = results.slice(0, limit)

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
    consoles: consoles.map((item) => {
      const encyclopedia = getConsoleById(item.id) || getConsoleById(item.console)
      return {
        ...toConsolePayload(item, gamesByPlatform.get(item.console) || 0),
        manufacturer: encyclopedia?.manufacturer || null,
        generation: encyclopedia?.generation || null,
        overview: encyclopedia?.overview || null,
      }
    }),
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

  const totalGames = await Game.count({
    where: {
      type: 'game',
      console: consoleItem.console,
    },
  })

  const catalog = await Game.findAll({
    where: {
      type: 'game',
      console: consoleItem.console,
    },
    order: [['title', 'ASC']],
  })
  const games = catalog.slice(0, 20)

  const accessories = await Accessory.findAll({
    where: {
      console_id: consoleItem.id,
    },
    order: [['name', 'ASC']],
    limit: 10,
  })

  const encyclopedia = getConsoleById(consoleItem.id) || getConsoleById(consoleItem.console)
  const relatedConsoles = encyclopedia
    ? getRelatedConsoles(encyclopedia, 4).map((entry) => ({
        id: entry.id,
        name: entry.name,
        manufacturer: entry.manufacturer,
        release_year: entry.release_year,
        generation: entry.generation,
      }))
    : []
  const notableGames = encyclopedia
    ? matchNotableGames(encyclopedia.legacy?.notable_games || [], catalog)
    : []

  return res.json({
    ok: true,
    console: {
      ...toConsolePayload(consoleItem, totalGames),
      manufacturer: encyclopedia?.manufacturer || null,
    },
    games: games.map(toItemPayload),
    accessories: accessories.map((item) => ({
      id: item.id,
      name: item.name,
      accessory_type: item.accessory_type || null,
      slug: item.slug || null,
    })),
    encyclopedia,
    relatedConsoles,
    notableGames,
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
