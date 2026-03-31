'use strict'

const {
  createLegacyMarketReport,
} = require('./legacy-market-report-service')

async function createMarketReport(gameId, payload = {}) {
  return createLegacyMarketReport({
    ...payload,
    item_id: String(gameId || '').trim(),
  })
}

module.exports = {
  createMarketReport,
}
