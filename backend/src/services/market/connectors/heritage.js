'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'heritage',
  sourceSlug: 'heritage',
  sourceMarket: 'us',
  sourceType: 'auction_house',
  saleType: 'realized_price',
  defaultCurrency: 'USD',
})
