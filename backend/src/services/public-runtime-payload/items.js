'use strict'

const { queryGames, getStats } = require('../../../db_supabase')
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

async function fetchItemsPayload(query = {}) {
  const limit = parseLimit(query.limit, 20, 1000)
  const offset = Number.parseInt(String(query.offset || '0'), 10) || 0
  const scope = await fetchPublishedGameScope()

  const [{ items = [], total = 0 }, statsBase] = await Promise.all([
    queryGames({
      sort: query.sort || 'title_asc',
      console: query.console || query.platform,
      rarity: query.rarity,
      limit,
      offset,
      search: query.q,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    }),
    getStats().catch((err) => { console.warn('[stats] getStats failed:', err.message); return {} }),
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
