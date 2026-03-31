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

async function fetchGameKnowledgeDomains(game) {
  const [companyRows, mediaRows, editorial, peopleRows, ostRows, ostTracks, ostReleases] = await Promise.all([
    fetchGameCompanyRows(game),
    fetchGameMediaRows(game?.id),
    fetchGameEditorialRow(game?.id),
    fetchGamePeopleRows(game?.id),
    fetchGameOstRows(game?.id),
    fetchGameOstTracks(game?.id),
    fetchGameOstReleases(game?.id),
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
