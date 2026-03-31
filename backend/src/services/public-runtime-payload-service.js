'use strict'

const {
  db,
  queryGames,
  getStats,
} = require('../../db_supabase')
const { parseLimit } = require('../helpers/query')
const { buildPriceHistoryPayload } = require('../helpers/priceHistory')
const { compareGamesForSort, normalizeGameRecord } = require('../lib/normalize')
const {
  fetchCanonicalGameById,
  fetchAllSupabaseGames,
  hydrateGameCovers,
  fetchSeedPriceHistory,
  toItemPayload,
} = require('./public-game-reader')
const {
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
  buildConsoleDemoGamesPayload,
  fetchPublishedGameScope,
  filterPublishedGames,
} = require('./public-publication-service')
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
} = require('./public-console-service')
const { isMissingSupabaseRelationError } = require('./public-supabase-utils')

async function fetchGamePriceHistoryPayload(gameId) {
  const game = await fetchCanonicalGameById(gameId)
  if (!game) return null

  const seedHistory = await fetchSeedPriceHistory(gameId)
  return buildPriceHistoryPayload(game, {
    reports: [],
    indexEntries: [],
    seedHistory,
  })
}

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
    getStats().catch(() => ({})),
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

function median(values) {
  if (!values.length) return 0

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

async function fetchStatsPayload() {
  const statsBase = await getStats().catch(() => ({}))
  const games = await fetchAllSupabaseGames()
  const { count: rawFranchiseCount, error: franchiseError } = await db
    .from('franchise_entries')
    .select('*', { count: 'exact', head: true })

  if (franchiseError && !isMissingSupabaseRelationError(franchiseError)) {
    throw new Error(franchiseError.message)
  }
  const franchiseCount = franchiseError ? 0 : rawFranchiseCount

  const byRarity = { LEGENDARY: 0, EPIC: 0, RARE: 0, UNCOMMON: 0, COMMON: 0 }
  const byPlatformMap = new Map()
  const looseValues = []
  let withSynopsis = 0

  for (const rawGame of games) {
    const game = normalizeGameRecord(rawGame)
    const rarity = Object.prototype.hasOwnProperty.call(byRarity, game.rarity) ? game.rarity : 'COMMON'
    byRarity[rarity] += 1

    const platform = String(game.console || 'Unknown').trim() || 'Unknown'
    byPlatformMap.set(platform, (byPlatformMap.get(platform) || 0) + 1)

    if (String(game.synopsis || '').trim()) {
      withSynopsis += 1
    }

    const loose = Number(game.loosePrice)
    if (Number.isFinite(loose) && loose > 0) {
      looseValues.push(loose)
    }
  }

  const byPlatform = Array.from(byPlatformMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((left, right) => right.count - left.count || left.platform.localeCompare(right.platform))
    .slice(0, 10)

  const pricedGames = games
    .map((game) => normalizeGameRecord(game))
    .filter((game) => Number.isFinite(Number(game.loosePrice)) && Number(game.loosePrice) > 0)
    .sort((left, right) => Number(right.loosePrice) - Number(left.loosePrice))

  const top5Expensive = pricedGames.slice(0, 5).map((game) => ({
    id: game.id,
    title: game.title,
    platform: game.console,
    loosePrice: Number(game.loosePrice),
  }))

  const expensiveGame = pricedGames[0] || null
  const cheapestGame = [...pricedGames].sort((left, right) => Number(left.loosePrice) - Number(right.loosePrice))[0] || null

  const trustStats = { t1: 0, t3: 0, t4: 0 }
  pricedGames.forEach((game) => {
    const confidence = Number(game.source_confidence) || 0
    if (confidence >= 0.6) trustStats.t1 += 1
    else if (confidence >= 0.25) trustStats.t3 += 1
    else trustStats.t4 += 1
  })

  const avgLoose = looseValues.length
    ? looseValues.reduce((sum, value) => sum + value, 0) / looseValues.length
    : 0

  return {
    ok: true,
    total_games: Number(statsBase.total_games) || games.length,
    total_platforms: byPlatformMap.size,
    priced_games: pricedGames.length,
    with_synopsis: withSynopsis,
    by_rarity: byRarity,
    by_platform: byPlatform,
    median_loose: Math.round(median(looseValues) * 100) / 100,
    average_loose: Math.round(avgLoose * 100) / 100,
    top_5_expensive: top5Expensive,
    most_expensive: expensiveGame ? {
      id: expensiveGame.id,
      title: expensiveGame.title,
      platform: expensiveGame.console,
      loosePrice: Number(expensiveGame.loosePrice),
    } : null,
    cheapest_priced: cheapestGame ? {
      id: cheapestGame.id,
      title: cheapestGame.title,
      platform: cheapestGame.console,
      loosePrice: Number(cheapestGame.loosePrice),
    } : null,
    total_franchises: franchiseCount || 0,
    source_confidence: trustStats,
  }
}

module.exports = {
  fetchGamePriceHistoryPayload,
  fetchItemsPayload,
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
  fetchStatsPayload,
}
