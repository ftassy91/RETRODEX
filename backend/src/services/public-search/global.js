'use strict'

const { getStats } = require('../../../db_supabase')
const { getAll: getCatalogCache } = require('../public-game/games-catalog-cache')
const { hydrateGameCovers } = require('../public-game-reader')
const {
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
  filterPublishedGames,
} = require('../public-publication-service')
const {
  fetchGlobalConsoleResults,
  fetchGlobalFranchiseResults,
} = require('../public-console-service')
const {
  SEARCH_CONTEXT_LABELS,
  scoreResult,
  compareGlobalResults,
  createGlobalGameResult,
} = require('./base')

async function searchGlobal(query, context, limit, scope) {
  if (query.length < 2) {
    return {
      ok: true,
      query,
      context,
      label: SEARCH_CONTEXT_LABELS[context] || SEARCH_CONTEXT_LABELS.all,
      items: [],
      count: 0,
      publication: buildPublicationSummary(scope, await getStats().catch((err) => { console.warn('[stats] getStats failed:', err.message); return {} })),
    }
  }

  const searchLower = query.toLowerCase()
  const searchLimit = Math.max(limit * 3, 20)
  const [allCachedGames, consoles, franchises, statsBase] = await Promise.all([
    getCatalogCache(),
    fetchGlobalConsoleResults(query, limit),
    fetchGlobalFranchiseResults(query, limit),
    getStats().catch((err) => { console.warn('[stats] getStats failed:', err.message); return {} }),
  ])

  const matchedGames = allCachedGames
    .filter((g) => String(g.title || '').toLowerCase().includes(searchLower))
    .filter((g) => !scope.enabled || !scope.ids.length || scope.ids.includes(g.id))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' }))
    .slice(0, searchLimit)

  let hydratedGames = await hydrateGameCovers(filterPublishedGames(matchedGames, scope))
  if (!hydratedGames.length && query.length >= 4) {
    const allGames = await getCatalogCache()
    const scopedGames = scope.enabled && scope.ids.length
      ? allGames.filter((g) => scope.ids.includes(g.id))
      : allGames

    hydratedGames = (await hydrateGameCovers(filterPublishedGames(scopedGames, scope)))
      .map((game) => ({ game, score: scoreResult(createGlobalGameResult(game, context), query) }))
      .filter((entry) => entry.score >= 60)
      .sort((left, right) => right.score - left.score
        || String(left.game?.title || '').localeCompare(String(right.game?.title || ''), 'fr', {
          sensitivity: 'base',
        }))
      .slice(0, Math.max(limit * 3, 20))
      .map((entry) => entry.game)
  }

  const [signalsMap, curationMap] = await Promise.all([
    fetchGameVisibilitySignals(hydratedGames.map((game) => game?.id)),
    fetchGameCurationStates(hydratedGames.map((game) => game?.id), scope),
  ])
  hydratedGames = attachVisibilityMetadata(hydratedGames, signalsMap, curationMap, scope)

  let items = [
    ...hydratedGames.map((game) => createGlobalGameResult(game, context)),
    ...consoles,
    ...franchises,
  ]

  if (context === 'retromarket' || context === 'collection') {
    items = items.filter((item) => item.type === 'game')
  }

  items = items
    .map((item) => ({ ...item, score: scoreResult(item, query) }))
    .sort(compareGlobalResults)
    .slice(0, limit)

  return {
    ok: true,
    query,
    context,
    label: SEARCH_CONTEXT_LABELS[context] || SEARCH_CONTEXT_LABELS.all,
    items,
    count: items.length,
    publication: buildPublicationSummary(scope, statsBase),
  }
}

module.exports = {
  searchGlobal,
}
