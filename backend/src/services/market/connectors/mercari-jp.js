'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'mercari_jp',
  sourceSlug: 'mercari_jp',
  sourceMarket: 'jp',
  sourceType: 'marketplace',
  saleType: 'fixed_price_sold',
  defaultCurrency: 'JPY',
})
