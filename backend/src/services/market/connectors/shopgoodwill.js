'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'shopgoodwill',
  sourceSlug: 'shopgoodwill',
  sourceMarket: 'us',
  sourceType: 'auction_house',
  saleType: 'auction',
  defaultCurrency: 'USD',
})
