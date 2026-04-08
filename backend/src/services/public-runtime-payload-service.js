'use strict'

const { fetchGamePriceHistoryPayload } = require('./public-runtime-payload/game-price-history')
const { fetchItemsPayload, fetchItemsPayloadResult } = require('./public-runtime-payload/items')
const {
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
} = require('./public-runtime-payload/consoles')
const { fetchStatsPayload } = require('./public-runtime-payload/stats')

module.exports = {
  fetchGamePriceHistoryPayload,
  fetchItemsPayload,
  fetchItemsPayloadResult,
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
  fetchStatsPayload,
}
