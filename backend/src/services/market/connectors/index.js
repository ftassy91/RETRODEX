'use strict'

const ebaySold = require('./ebay-sold')
const jsonFixture = require('./json-fixture')

const CONNECTORS = new Map([
  [ebaySold.name, ebaySold],
  [jsonFixture.name, jsonFixture],
])

function getMarketConnector(name = 'ebay_sold') {
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
