'use strict'

const catawiki = require('./catawiki')
const heritage = require('./heritage')
const jsonFixture = require('./json-fixture')
const mercariJp = require('./mercari-jp')
const mercariUs = require('./mercari-us')
const rakuma = require('./rakuma')
const shopgoodwill = require('./shopgoodwill')
const yahooAuctionsJp = require('./yahoo-auctions-jp')

const CONNECTORS = new Map([
  [yahooAuctionsJp.name, yahooAuctionsJp],
  [mercariUs.name, mercariUs],
  [rakuma.name, rakuma],
  [shopgoodwill.name, shopgoodwill],
  [catawiki.name, catawiki],
  [heritage.name, heritage],
  [mercariJp.name, mercariJp],
  [jsonFixture.name, jsonFixture],
])

function getMarketConnector(name = 'yahoo_auctions_jp') {
  const connector = CONNECTORS.get(String(name || '').trim())
  if (!connector) {
    throw new Error(`Unknown market connector: ${name}`)
  }
  return connector
}

function listMarketConnectors() {
  return [...CONNECTORS.keys()]
}

module.exports = {
  getMarketConnector,
  listMarketConnectors,
}
