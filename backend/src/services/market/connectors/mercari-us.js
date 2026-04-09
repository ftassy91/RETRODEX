'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'mercari_us',
  sourceSlug: 'mercari_us',
  sourceMarket: 'us',
  sourceType: 'marketplace',
  saleType: 'fixed_price_sold',
  defaultCurrency: 'USD',
})
