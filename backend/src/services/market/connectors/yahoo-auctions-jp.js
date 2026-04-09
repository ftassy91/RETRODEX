'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'yahoo_auctions_jp',
  sourceSlug: 'yahoo_auctions_jp',
  sourceMarket: 'jp',
  sourceType: 'marketplace',
  saleType: 'auction',
  defaultCurrency: 'JPY',
})
