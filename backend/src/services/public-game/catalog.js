'use strict'

const {
  db,
  getGameById,
} = require('../../../db_supabase')
const catalogCache = require('./games-catalog-cache')
const {
  normalizeGameRecord,
  compareGamesForSort,
} = require('../../lib/normalize')
const {
  buildArchivePayload: buildKnowledgeArchivePayload,
  buildEncyclopediaPayload: buildKnowledgeEncyclopediaPayload,
} = require('../../helpers/game-knowledge')
const { fetchRowsInBatches } = require('../public-supabase-utils')
const { fetchGameMediaMap } = require('./media')

async function hydrateGameCovers(items = []) {
  const mediaMap = await fetchGameMediaMap(items.map((item) => item?.id))
  return items.map((item) => {
    const normalized = normalizeGameRecord(item)
    const media = mediaMap.get(String(normalized?.id || '')) || {}
    const coverUrl = media.cover || normalized.cover_url || normalized.coverImage || null
    return {
      ...normalized,
      cover_url: coverUrl,
      coverImage: coverUrl,
    }
  })
}

function buildArchivePayload(game, domains = {}) {
  return buildKnowledgeArchivePayload({
    game: normalizeGameRecord(game) || {},
    editorial: domains.editorial,
    production: domains.production,
    media: domains.media,
    music: domains.music,
    competition: domains.competition,
    ostReleases: domains.music?.releases || [],
  })
}

function buildEncyclopediaPayload(game, domains = {}) {
  return buildKnowledgeEncyclopediaPayload({
    game: normalizeGameRecord(game) || {},
    editorial: domains.editorial,
    production: domains.production,
    music: domains.music,
    competition: domains.competition,
  })
}

async function fetchAllSupabaseGames() {
  return fetchRowsInBatches(
    'games',
    'id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,source_confidence,slug,cover_url,loose_price,cib_price,mint_price,price_last_updated,source_names',
    (query) => query.eq('type', 'game'),
    { column: 'title', options: { ascending: true } }
  )
}

async function fetchGamesMap(gameIds) {
  const uniqueIds = [...new Set((gameIds || []).filter(Boolean))]

  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,rarity,loose_price,cib_price,mint_price')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data || []).map((game) => [game.id, normalizeGameRecord(game)]))
}

async function fetchSeedPriceHistory(gameId) {
  const { data, error } = await db
    .from('price_history')
    .select('price,condition,sale_date')
    .eq('game_id', gameId)
    .order('sale_date', { ascending: true })
    .limit(2000)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

function toItemPayload(game) {
  const item = normalizeGameRecord(game)

  return {
    id: item.id,
    title: item.title,
    platform: item.console,
    console: item.console,
    year: item.year,
    genre: item.genre,
    rarity: item.rarity,
    type: item.type || 'game',
    slug: item.slug || null,
    loosePrice: item.loosePrice,
    cibPrice: item.cibPrice,
    mintPrice: item.mintPrice,
    coverImage: item.coverImage || item.cover_url || null,
    cover_url: item.cover_url || item.coverImage || null,
    synopsis: item.synopsis || null,
    summary: item.summary || null,
    developer: item.developer || null,
    metascore: item.metascore ?? null,
    trend: item.trend || null,
    sourceConfidence: item.source_confidence != null ? Number(item.source_confidence) : null,
    priceLastUpdated: item.price_last_updated || null,
    sourceNames: item.source_names || null,
    curation: {
      status: item.curation?.status || null,
      isPublished: Boolean(item.curation?.isPublished),
      passKey: item.curation?.passKey || null,
    },
    signals: {
      hasMaps: Boolean(item.signals?.hasMaps),
      hasManuals: Boolean(item.signals?.hasManuals),
      hasSprites: Boolean(item.signals?.hasSprites),
      hasEndings: Boolean(item.signals?.hasEndings),
    },
  }
}

async function fetchCanonicalGamesList(query = {}) {
  const limit = Math.min(Math.max(Number.parseInt(String(query.limit || '20'), 10) || 20, 1), 5000)
  const offset = Math.max(0, Number.parseInt(String(query.offset || '0'), 10) || 0)
  const includeTrend = String(query.include_trend || '') === '1'

  const search = String(query.q || '').trim().toLowerCase()
  const consoleFilter = String(query.console || '').trim()
  const rarityFilter = String(query.rarity || '').trim()

  const allItems = await catalogCache.getAll()

  const filteredItems = allItems
    .filter((item) => {
      if (consoleFilter && item.console !== consoleFilter) return false
      if (rarityFilter && item.rarity !== rarityFilter) return false
      if (search && !String(item.title || '').toLowerCase().includes(search)) return false
      return true
    })
    .sort((left, right) => compareGamesForSort(left, right, query.sort))

  const total = filteredItems.length
  const items = await hydrateGameCovers(
    filteredItems.slice(offset, offset + limit).map((item) => (
      includeTrend ? { ...item, trend: null } : item
    ))
  )

  return { items, returned: items.length, total }
}

async function fetchCanonicalGameById(id) {
  const [game] = await hydrateGameCovers([await getGameById(id)])
  return game || null
}

module.exports = {
  hydrateGameCovers,
  buildArchivePayload,
  buildEncyclopediaPayload,
  fetchAllSupabaseGames,
  fetchGamesMap,
  fetchSeedPriceHistory,
  toItemPayload,
  fetchCanonicalGamesList,
  fetchCanonicalGameById,
  warmUpCatalogCache: catalogCache.warmUp,
  invalidateCatalogCache: catalogCache.invalidate,
}
