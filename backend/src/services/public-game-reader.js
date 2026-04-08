'use strict'

const { parseStoredJson } = require('../lib/normalize')
const { LRUCache } = require('../lib/lru-cache')
const {
  buildProductionPayload,
  buildMediaPayload,
} = require('../helpers/game-knowledge')
const {
  fetchGameMediaRows,
  fetchGameEditorialRow,
  fetchGameContentProfileRow,
} = require('./public-game/media')
const {
  fetchGamePeopleRows,
  fetchGameCompanyRows,
  fetchGameOstRows,
  fetchGameOstTracks,
  fetchGameOstReleases,
} = require('./public-game/credits')
const { fetchGameCompetitionDomain } = require('./public-game/competition')
const {
  hydrateGameCovers,
  buildArchivePayload,
  buildEncyclopediaPayload,
  fetchAllSupabaseGames,
  fetchGamesMap,
  fetchSeedPriceHistory,
  toItemPayload,
  fetchCanonicalGamesList,
  fetchCanonicalGameById,
} = require('./public-game/catalog')

const knowledgeDomainsCache = new LRUCache(300, 5 * 60 * 1000)
const knowledgeDomainPromises = new Map()

function buildKnowledgeDomainsCacheKey(game, options = {}) {
  const gameId = String(game?.id || '').trim()
  if (!gameId) {
    return ''
  }

  return [
    gameId,
    options.includeProduction !== false ? 'prod1' : 'prod0',
    options.includeMedia !== false ? 'media1' : 'media0',
    options.includeMusic !== false ? 'music1' : 'music0',
    options.includeCompetition !== false ? 'comp1' : 'comp0',
  ].join(':')
}

async function fetchGameKnowledgeDomains(game, options = {}) {
  const includeProduction = options.includeProduction !== false
  const includeMedia = options.includeMedia !== false
  const includeMusic = options.includeMusic !== false
  const includeCompetition = options.includeCompetition !== false
  const cacheKey = buildKnowledgeDomainsCacheKey(game, options)

  if (cacheKey) {
    const cached = knowledgeDomainsCache.get(cacheKey)
    if (cached) {
      return cached
    }

    if (knowledgeDomainPromises.has(cacheKey)) {
      return knowledgeDomainPromises.get(cacheKey)
    }
  }

  const promise = (async () => {
    const [companyRows, mediaRows, editorial, peopleRows, ostRows, ostTracks, ostReleases, competition] = await Promise.all([
      includeProduction ? fetchGameCompanyRows(game) : Promise.resolve([]),
      includeMedia ? fetchGameMediaRows(game?.id) : Promise.resolve([]),
      fetchGameEditorialRow(game?.id),
      includeProduction ? fetchGamePeopleRows(game?.id) : Promise.resolve([]),
      includeMusic ? fetchGameOstRows(game?.id) : Promise.resolve([]),
      includeMusic ? fetchGameOstTracks(game?.id) : Promise.resolve([]),
      includeMusic ? fetchGameOstReleases(game?.id) : Promise.resolve([]),
      includeCompetition ? fetchGameCompetitionDomain(game?.id) : Promise.resolve(null),
    ])

    const canonicalDevTeam = peopleRows
      .filter((entry) => !String(entry.role || '').toLowerCase().includes('composer'))
      .map((entry) => ({
        personId: entry.personId,
        name: entry.name,
        normalizedName: entry.normalizedName,
        role: entry.role,
        confidence: Number(entry.confidence || 0),
        isInferred: Boolean(entry.isInferred),
      }))

    const canonicalComposers = peopleRows
      .filter((entry) => String(entry.role || '').toLowerCase().includes('composer'))
      .map((entry) => ({
        personId: entry.personId,
        name: entry.name,
        normalizedName: entry.normalizedName,
        role: entry.role,
        confidence: Number(entry.confidence || 0),
        isInferred: Boolean(entry.isInferred),
      }))

    const result = {
      editorial,
      production: buildProductionPayload({
        game,
        companyRows,
        devTeam: canonicalDevTeam.length ? canonicalDevTeam : (parseStoredJson(game?.dev_team) || []),
      }),
      media: buildMediaPayload({
        game,
        mediaRows,
      }),
      music: {
        composers: canonicalComposers.length ? canonicalComposers : (parseStoredJson(game?.ost_composers) || []),
        tracks: ostTracks.length ? ostTracks : (parseStoredJson(game?.ost_notable_tracks) || []),
        releases: ostReleases,
        ostRows,
      },
      competition,
    }

    if (cacheKey) {
      knowledgeDomainsCache.set(cacheKey, result)
    }

    return result
  })()

  if (!cacheKey) {
    return promise
  }

  knowledgeDomainPromises.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    knowledgeDomainPromises.delete(cacheKey)
  }
}

module.exports = {
  fetchGameContentProfileRow,
  fetchGameKnowledgeDomains,
  hydrateGameCovers,
  buildArchivePayload,
  buildEncyclopediaPayload,
  fetchAllSupabaseGames,
  fetchGamesMap,
  fetchSeedPriceHistory,
  toItemPayload,
  fetchCanonicalGamesList,
  fetchCanonicalGameById,
}
