'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'rakuma',
  sourceSlug: 'rakuma',
  sourceMarket: 'jp',
  sourceType: 'marketplace',
  saleType: 'fixed_price_sold',
  defaultCurrency: 'JPY',
})
