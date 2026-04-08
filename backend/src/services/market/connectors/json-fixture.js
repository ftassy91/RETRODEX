'use strict'

const fs = require('fs')
const path = require('path')

const { createCanonicalRawSoldRecord } = require('../contract')

async function fetchSoldRecords(_seed, options = {}) {
  const fixturePath = path.resolve(String(options.fixture || ''))
  if (!fixturePath || !fs.existsSync(fixturePath)) {
    return []
  }

  const rows = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  return rows.map((row) => createCanonicalRawSoldRecord({
    connector: 'json_fixture',
    source_name: row.source_name || 'fixture',
    listing_reference: row.listing_reference || row.id,
    listing_url: row.listing_url,
    title_raw: row.title_raw,
    price_amount: row.price_amount,
    price_currency: row.price_currency || 'USD',
    sold_at: row.sold_at,
    platform_hint_raw: row.platform_hint_raw,
    region_hint_raw: row.region_hint_raw,
    condition_hint_raw: row.condition_hint_raw,
    seed_game_id: row.seed_game_id,
    raw_payload: row,
  }))
}

module.exports = {
  name: 'json_fixture',
  fetchSoldRecords,
}
