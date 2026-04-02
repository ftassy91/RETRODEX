'use strict'

function getFreshnessInfo(lastDate) {
  if (!lastDate) {
    return 'outdated'
  }

  const parsed = new Date(lastDate)
  if (Number.isNaN(parsed.getTime())) {
    return 'outdated'
  }

  const days = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  if (days < 30) return 'recent'
  if (days < 90) return 'aging'
  if (days < 180) return 'stale'
  return 'outdated'
}

async function fetchMarketIndex(gameId) {
  const RetrodexIndex = require('../../models/RetrodexIndex')
  const indexEntries = await RetrodexIndex.findAll({
    where: {
      item_id: gameId,
    },
    order: [['condition', 'ASC']],
  })

  return {
    item_id: gameId,
    index: indexEntries.map((entry) => ({
      condition: entry.condition,
      index_value: entry.index_value,
      range_low: entry.range_low,
      range_high: entry.range_high,
      confidence_pct: entry.confidence_pct,
      trend: entry.trend,
      sources_editorial: entry.sources_editorial,
      last_sale_date: entry.last_sale_date,
      freshness: getFreshnessInfo(entry.last_sale_date || entry.last_computed_at),
    })),
  }
}

module.exports = {
  fetchMarketIndex,
}
