'use strict'

const { createFixtureBackedConnector } = require('./base')

module.exports = createFixtureBackedConnector({
  name: 'catawiki',
  sourceSlug: 'catawiki',
  sourceMarket: 'eu',
  sourceType: 'auction_house',
  saleType: 'auction',
  defaultCurrency: 'EUR',
})
