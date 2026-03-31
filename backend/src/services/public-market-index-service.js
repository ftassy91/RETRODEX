'use strict'

const {
  fetchLegacyMarketIndex,
} = require('./legacy-market-index-service')

async function fetchMarketIndex(gameId) {
  return fetchLegacyMarketIndex(gameId)
}

module.exports = {
  fetchMarketIndex,
}
