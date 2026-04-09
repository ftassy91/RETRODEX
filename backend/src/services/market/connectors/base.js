'use strict'

const fs = require('fs')
const path = require('path')

const { createCanonicalRawSoldRecord } = require('../contract')
const { getMarketSource, normalizeMarketSourceSlug } = require('../source-registry')

function ensureSeed(seed = {}) {
  return {
    id: String(seed.id || seed.game_id || '').trim() || null,
    title: String(seed.title || '').trim() || null,
    platform: String(seed.platform || seed.console || '').trim() || null,
    query: String(seed.query || seed.title || '').trim() || null,
  }
}

function resolveFixturePath(sourceSlug, options = {}) {
  const explicitPath = String(options.fixture || '').trim()
  if (explicitPath) {
    return path.resolve(explicitPath)
  }

  const fixtureDir = String(options.fixtureDir || process.env.MARKET_CONNECTOR_FIXTURE_DIR || '').trim()
  if (!fixtureDir) {
    return null
  }

  return path.resolve(fixtureDir, `${normalizeMarketSourceSlug(sourceSlug)}.json`)
}

function loadFixtureRows(sourceSlug, options = {}) {
  const fixturePath = resolveFixturePath(sourceSlug, options)
  if (!fixturePath || !fs.existsSync(fixturePath)) {
    return []
  }

  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
}

function mapFixtureRowsToCanonical(rows = [], connectorMeta, seed) {
  const sourceMeta = getMarketSource(connectorMeta.sourceSlug)

  return rows.map((row, index) => createCanonicalRawSoldRecord({
    source_slug: connectorMeta.sourceSlug,
    source_market: connectorMeta.sourceMarket,
    source_name: sourceMeta?.name,
    source_type: connectorMeta.sourceType || sourceMeta?.sourceType || 'marketplace',
    listing_reference: row.listing_reference || row.id || `${seed.id || seed.query || 'seed'}-${index + 1}`,
    listing_url: row.listing_url || null,
    title_raw: row.title_raw || `${seed.title || seed.query || 'Unknown game'} ${seed.platform || ''}`.trim(),
    sale_type: row.sale_type || connectorMeta.saleType,
    sold_at: row.sold_at,
    currency: row.currency || sourceMeta?.defaultCurrency || connectorMeta.defaultCurrency || 'EUR',
    price_original: row.price_original ?? row.price_amount,
    country_code: row.country_code || null,
    platform_hint_raw: row.platform_hint_raw || seed.platform || null,
    region_hint_raw: row.region_hint_raw || null,
    condition_hint_raw: row.condition_hint_raw || null,
    seed_game_id: row.seed_game_id || seed.id,
    raw_payload: row,
  }))
}

function createFixtureBackedConnector(definition = {}) {
  const connectorMeta = {
    name: definition.name,
    sourceSlug: definition.sourceSlug,
    sourceMarket: definition.sourceMarket,
    sourceType: definition.sourceType || 'marketplace',
    saleType: definition.saleType || 'auction',
    defaultCurrency: definition.defaultCurrency || 'EUR',
  }

  return {
    ...connectorMeta,
    async fetchSoldRecords(seedInput = {}, options = {}) {
      const seed = ensureSeed(seedInput)
      const rows = loadFixtureRows(connectorMeta.sourceSlug, options)
      return mapFixtureRowsToCanonical(rows, connectorMeta, seed)
    },
  }
}

module.exports = {
  createFixtureBackedConnector,
  ensureSeed,
  loadFixtureRows,
  mapFixtureRowsToCanonical,
  resolveFixturePath,
}
