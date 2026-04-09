'use strict'

const { CONDITION_VALUES, MARKET_BUCKETS } = require('../source-registry')

function numericSort(values = []) {
  return [...values].sort((left, right) => left - right)
}

function median(values = []) {
  if (!values.length) return null
  const sorted = numericSort(values)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function percentile(values = [], ratio) {
  if (!values.length) return null
  const sorted = numericSort(values)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))
  return sorted[index]
}

function buildBucketSnapshot(records = [], sourceMarket) {
  const prices = records
    .map((record) => Number(record.price_eur))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (!prices.length) {
    return {
      sourceMarket,
      count: 0,
      price: null,
      p25: null,
      p75: null,
      varianceRatio: null,
      latestSoldAt: null,
      sources: [],
    }
  }

  const p25 = percentile(prices, 0.25)
  const p75 = percentile(prices, 0.75)
  const price = median(prices)
  const varianceRatio = price && p75 != null && p25 != null
    ? Number(((p75 - p25) / Math.max(price, 1)).toFixed(4))
    : null

  return {
    sourceMarket,
    count: prices.length,
    price,
    p25,
    p75,
    varianceRatio,
    latestSoldAt: records
      .map((record) => record.sold_at)
      .filter(Boolean)
      .sort((left, right) => String(right).localeCompare(String(left)))[0] || null,
    sources: Array.from(new Set(records.map((record) => record.source_name || record.source_slug).filter(Boolean))),
  }
}

function buildBucketSnapshots(records = []) {
  const groups = new Map()

  for (const record of records) {
    if (!record.is_publishable || !record.match?.game?.id || !record.normalized_condition) {
      continue
    }

    const groupKey = `${record.match.game.id}::${record.normalized_condition}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        gameId: String(record.match.game.id),
        condition: record.normalized_condition,
        buckets: {
          jp: [],
          us: [],
          eu: [],
        },
      })
    }

    const group = groups.get(groupKey)
    if (MARKET_BUCKETS.includes(record.source_market)) {
      group.buckets[record.source_market].push(record)
    }
  }

  return [...groups.values()].map((group) => ({
    gameId: group.gameId,
    condition: group.condition,
    buckets: {
      jp: buildBucketSnapshot(group.buckets.jp, 'jp'),
      us: buildBucketSnapshot(group.buckets.us, 'us'),
      eu: buildBucketSnapshot(group.buckets.eu, 'eu'),
    },
  }))
}

function groupSnapshotsByGame(bucketSnapshots = []) {
  const grouped = new Map()

  for (const snapshot of bucketSnapshots) {
    if (!grouped.has(snapshot.gameId)) {
      grouped.set(snapshot.gameId, {
        gameId: snapshot.gameId,
        conditions: CONDITION_VALUES.reduce((acc, condition) => {
          acc[condition] = null
          return acc
        }, {}),
      })
    }

    grouped.get(snapshot.gameId).conditions[snapshot.condition] = snapshot
  }

  return grouped
}

module.exports = {
  buildBucketSnapshot,
  buildBucketSnapshots,
  groupSnapshotsByGame,
}
