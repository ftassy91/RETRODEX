'use strict'

const { queryGames, getStats } = require('../../../db_supabase')
const { LRUCache } = require('../../lib/lru-cache')
const { parseLimit } = require('../../helpers/query')
const {
  hydrateGameCovers,
  toItemPayload,
} = require('../public-game-reader')
const {
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
  fetchPublishedGameScope,
} = require('../public-publication-service')

const statsBaseCache = new LRUCache(1, 60 * 1000)
const itemsPayloadCache = new LRUCache(300, 120 * 1000)

function normalizeStringParam(value) {
  return String(value || '').trim()
}

function normalizeIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildItemsPayloadCacheKey(scopeVersion, params) {
  return [
    'items:v3',
    `scope=${scopeVersion || 'none'}`,
    `q=${params.q}`,
    `console=${params.console}`,
    `platform=${params.platform}`,
    `sort=${params.sort}`,
    `rarity=${params.rarity}`,
    `genre=${params.genre}`,
    `limit=${params.limit}`,
    `offset=${params.offset}`,
    `yearMin=${params.yearMin ?? ''}`,
    `yearMax=${params.yearMax ?? ''}`,
  ].join(':')
}

async function fetchCachedStatsBase() {
  const cached = statsBaseCache.get('stats-base')
  if (cached) return cached

  const statsBase = await getStats().catch((err) => {
    console.warn('[stats] getStats failed:', err.message)
    return {}
  })

  statsBaseCache.set('stats-base', statsBase || {})
  return statsBase || {}
}

async function fetchItemsPayloadResult(query = {}) {
  const limit = parseLimit(query.limit, 20, 1000)
  const offset = normalizeIntParam(query.offset, 0) || 0
  const yearMin = normalizeIntParam(query.yearMin, null)
  const yearMax = normalizeIntParam(query.yearMax, null)
  const normalizedParams = {
    q: normalizeStringParam(query.q),
    console: normalizeStringParam(query.console),
    platform: normalizeStringParam(query.platform),
    sort: normalizeStringParam(query.sort) || 'title_asc',
    rarity: normalizeStringParam(query.rarity),
    genre: normalizeStringParam(query.genre),
    limit,
    offset,
    yearMin,
    yearMax,
  }
  const scope = await fetchPublishedGameScope()
  const cacheKey = buildItemsPayloadCacheKey(scope.version, normalizedParams)
  const cachedPayload = itemsPayloadCache.get(cacheKey)
  if (cachedPayload) {
    return { payload: cachedPayload, cacheStatus: 'hit' }
  }

  const [{ items = [], total = 0 }, statsBase] = await Promise.all([
    queryGames({
      sort: normalizedParams.sort,
      console: normalizedParams.console || normalizedParams.platform,
      rarity: normalizedParams.rarity,
      genre: normalizedParams.genre,
      limit,
      offset,
      search: normalizedParams.q,
      yearMin,
      yearMax,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    }),
    fetchCachedStatsBase(),
  ])

  const hydratedItems = await hydrateGameCovers(items)
  const [signalsMap, curationMap] = await Promise.all([
    fetchGameVisibilitySignals(hydratedItems.map((item) => item?.id)),
    fetchGameCurationStates(hydratedItems.map((item) => item?.id), scope),
  ])
  const visibleItems = attachVisibilityMetadata(hydratedItems, signalsMap, curationMap, scope)

  const payload = {
    ok: true,
    items: visibleItems.map(toItemPayload),
    total,
    limit,
    offset,
    publication: buildPublicationSummary(scope, statsBase),
  }

  itemsPayloadCache.set(cacheKey, payload)
  return { payload, cacheStatus: 'miss' }
}

async function fetchItemsPayload(query = {}) {
  const { payload } = await fetchItemsPayloadResult(query)
  return payload
}

module.exports = {
  fetchItemsPayload,
  fetchItemsPayloadResult,
}
