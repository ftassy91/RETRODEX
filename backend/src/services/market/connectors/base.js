'use strict'

function ensureSeed(seed = {}) {
  return {
    id: String(seed.id || seed.game_id || '').trim() || null,
    title: String(seed.title || '').trim() || null,
    platform: String(seed.platform || seed.console || '').trim() || null,
    query: String(seed.query || seed.ebay_query || seed.title || '').trim() || null,
  }
}

module.exports = {
  ensureSeed,
}
