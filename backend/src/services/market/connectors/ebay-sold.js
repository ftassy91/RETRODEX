'use strict'

const { createCanonicalRawSoldRecord } = require('../contract')
const { ensureSeed } = require('./base')

const SAMPLE_PRICE_BY_TITLE = {
  'little samson': [1275, 1199, 1420],
  'the legend of zelda a link to the past': [32, 44, 58],
  'super mario 64': [35, 48, 64],
}

function pickSamplePrices(seed) {
  const key = String(seed.title || seed.query || '').trim().toLowerCase()
  return SAMPLE_PRICE_BY_TITLE[key] || [24, 36, 52]
}

async function fetchSoldRecords(seedInput = {}, options = {}) {
  const seed = ensureSeed(seedInput)
  const samplePrices = pickSamplePrices(seed)
  const soldAtBase = new Date()

  // Extension point: replace this deterministic sample feed with the real
  // sold-listings API implementation once credentials, throttling and
  // provenance policy are validated for the market lot.
  return samplePrices.slice(0, Number(options.limit || 3)).map((price, index) => createCanonicalRawSoldRecord({
    connector: 'ebay_sold',
    source_name: 'ebay',
    listing_reference: `${seed.id || 'seed'}-${index + 1}`,
    listing_url: `https://example.invalid/ebay/${seed.id || 'seed'}/${index + 1}`,
    title_raw: `${seed.title || seed.query || 'Unknown game'} ${seed.platform || ''} ${index === 0 ? 'CIB' : index === 1 ? 'Loose' : 'Sealed'}`.trim(),
    price_amount: price,
    price_currency: 'USD',
    sold_at: new Date(soldAtBase.getTime() - (index * 86400000 * 5)).toISOString(),
    platform_hint_raw: seed.platform,
    query_text: seed.query || seed.title,
    seed_game_id: seed.id,
    raw_payload: {
      stub: true,
      provider: 'ebay_sold',
      index,
    },
  }))
}

module.exports = {
  name: 'ebay_sold',
  fetchSoldRecords,
}
