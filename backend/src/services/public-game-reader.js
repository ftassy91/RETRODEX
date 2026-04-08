'use strict'

const { parseStoredJson } = require('../lib/normalize')
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

async function fetchGameKnowledgeDomains(game, options = {}) {
  const includeProduction = options.includeProduction !== false
  const includeMedia = options.includeMedia !== false
  const includeMusic = options.includeMusic !== false
  const includeCompetition = options.includeCompetition !== false

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

  return {
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
