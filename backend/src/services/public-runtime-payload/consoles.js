'use strict'

const { getStats } = require('../../../db_supabase')
const { compareGamesForSort } = require('../../lib/normalize')
const {
  fetchAllSupabaseGames,
  hydrateGameCovers,
} = require('../public-game-reader')
const {
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
  buildConsoleDemoGamesPayload,
  fetchPublishedGameScope,
  filterPublishedGames,
} = require('../public-publication-service')
const {
  buildConsoleGamesMap,
  buildConsoleMarketPayload,
  buildConsoleQualityPayload,
  buildConsoleSourcesPayload,
  buildConsoleOverviewPayload,
  buildConsoleHardwarePayload,
  buildRelatedConsolePayload,
  buildNotableGamesPayload,
  fetchPublishedConsoles,
  buildConsoleListItem,
  findConsoleInCatalog,
  getConsoleCatalogKey,
} = require('../public-console-service')

async function fetchConsolesPayload() {
  const [catalog, games, scope, statsBase] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
    getStats().catch(() => ({})),
  ])
  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope), catalog)
  const knownKeys = new Set()

  const items = catalog
    .map((consoleItem) => {
      const key = getConsoleCatalogKey(consoleItem)
      knownKeys.add(key)
      return buildConsoleListItem(consoleItem, gamesByConsole.get(key) || [])
    })
    .concat(
      Array.from(gamesByConsole.entries())
        .filter(([key]) => !knownKeys.has(key))
        .map(([key, consoleGames]) => buildConsoleListItem({
          id: key,
          slug: key,
          name: consoleGames[0]?.console || key,
          title: consoleGames[0]?.console || key,
          platform: consoleGames[0]?.console || key,
          manufacturer: null,
          releaseYear: null,
          generation: null,
          summary: null,
          knowledgeEntry: null,
          mediaType: null,
        }, consoleGames))
    )
    .sort((left, right) => {
      const byYear = Number(left.releaseYear || 9999) - Number(right.releaseYear || 9999)
      if (byYear !== 0) return byYear
      return String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' })
    })

  return {
    ok: true,
    items,
    consoles: items,
    count: items.length,
    publication: buildPublicationSummary(scope, statsBase),
  }
}

async function fetchConsoleDetailPayload(consoleId) {
  const [catalog, games, scope, statsBase] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
    getStats().catch(() => ({})),
  ])

  const consoleItem = findConsoleInCatalog(catalog, consoleId)
  if (!consoleItem) return null

  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope), catalog)
  const consoleGames = await hydrateGameCovers(
    (gamesByConsole.get(getConsoleCatalogKey(consoleItem)) || [])
      .sort((left, right) => compareGamesForSort(left, right, 'year_asc'))
  )

  const [signalsMap, curationMap] = await Promise.all([
    fetchGameVisibilitySignals(consoleGames.map((game) => game?.id)),
    fetchGameCurationStates(consoleGames.map((game) => game?.id), scope),
  ])
  const visibleConsoleGames = attachVisibilityMetadata(consoleGames, signalsMap, curationMap, scope)
  const market = buildConsoleMarketPayload(visibleConsoleGames)
  const quality = buildConsoleQualityPayload(consoleItem, market)
  const overview = buildConsoleOverviewPayload(consoleItem, market)
  const demoGames = buildConsoleDemoGamesPayload(consoleItem, visibleConsoleGames, scope)

  return {
    ok: true,
    console: {
      id: consoleItem.id,
      slug: consoleItem.slug || null,
      name: consoleItem.name,
      manufacturer: consoleItem.manufacturer || null,
      releaseYear: consoleItem.releaseYear || null,
      gamesCount: market.gamesCount,
    },
    overview,
    market,
    games: visibleConsoleGames.map((game) => ({
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      rarity: game.rarity || null,
      coverImage: game.coverImage || game.cover_url || null,
      cover_url: game.cover_url || null,
      loosePrice: game.loosePrice ?? null,
      cibPrice: game.cibPrice ?? null,
      mintPrice: game.mintPrice ?? null,
      developer: game.developer || null,
      summary: game.summary || null,
      curation: {
        status: game.curation?.status || null,
        isPublished: Boolean(game.curation?.isPublished),
        passKey: game.curation?.passKey || null,
      },
      signals: {
        hasMaps: Boolean(game.signals?.hasMaps),
        hasManuals: Boolean(game.signals?.hasManuals),
        hasSprites: Boolean(game.signals?.hasSprites),
        hasEndings: Boolean(game.signals?.hasEndings),
      },
    })),
    demoGames,
    hardware: buildConsoleHardwarePayload(consoleItem),
    quality,
    sources: buildConsoleSourcesPayload(consoleItem, market),
    relatedConsoles: buildRelatedConsolePayload(catalog, consoleItem),
    notableGames: buildNotableGamesPayload(consoleItem, visibleConsoleGames),
    publication: buildPublicationSummary(scope, statsBase, {
      demoGamesCount: demoGames.length,
      underfilled: demoGames.length < 3,
    }),
  }
}

module.exports = {
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
}
