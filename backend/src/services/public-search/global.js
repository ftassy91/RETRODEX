'use strict'

const { queryGames, getStats } = require('../../../db_supabase')
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
      publication: buildPublicationSummary(scope, await getStats().catch(() => ({}))),
    }
  }

  const [gamesPayload, consoles, franchises, statsBase] = await Promise.all([
    queryGames({
      search: query,
      sort: 'title_asc',
      limit: Math.max(limit * 3, 20),
      offset: 0,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    }),
    fetchGlobalConsoleResults(query, limit),
    fetchGlobalFranchiseResults(query, limit),
    getStats().catch(() => ({})),
  ])

  let hydratedGames = await hydrateGameCovers(filterPublishedGames(gamesPayload.items || [], scope))
  if (!hydratedGames.length && query.length >= 4) {
    const fuzzyGamesPayload = await queryGames({
      sort: 'title_asc',
      limit: 5000,
      offset: 0,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    })

    hydratedGames = (await hydrateGameCovers(filterPublishedGames(fuzzyGamesPayload.items || [], scope)))
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
