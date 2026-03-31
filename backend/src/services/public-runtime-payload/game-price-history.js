'use strict'

const { buildPriceHistoryPayload } = require('../../helpers/priceHistory')
const {
  fetchCanonicalGameById,
  fetchSeedPriceHistory,
} = require('../public-game-reader')

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

module.exports = {
  fetchGamePriceHistoryPayload,
}
