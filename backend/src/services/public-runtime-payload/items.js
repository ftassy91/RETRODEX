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

async function fetchItemsPayload(query = {}) {
  const limit = parseLimit(query.limit, 20, 1000)
  const offset = Number.parseInt(String(query.offset || '0'), 10) || 0
  const yearMin = Number.parseInt(String(query.yearMin || ''), 10)
  const yearMax = Number.parseInt(String(query.yearMax || ''), 10)
  const scope = await fetchPublishedGameScope()

  const [{ items = [], total = 0 }, statsBase] = await Promise.all([
    queryGames({
      sort: query.sort || 'title_asc',
      console: query.console || query.platform,
      rarity: query.rarity,
      genre: query.genre,
      limit,
      offset,
      search: query.q,
      yearMin: Number.isFinite(yearMin) ? yearMin : null,
      yearMax: Number.isFinite(yearMax) ? yearMax : null,
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

  return {
    ok: true,
    items: visibleItems.map(toItemPayload),
    total,
    limit,
    offset,
    publication: buildPublicationSummary(scope, statsBase),
  }
}

module.exports = {
  fetchItemsPayload,
}
