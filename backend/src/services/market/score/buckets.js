'use strict'

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

function buildConditionBucketSnapshot(records = []) {
  const prices = records
    .map((record) => Number(record.price_amount))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (!prices.length) {
    return {
      count: 0,
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
    }
  }

  return {
    count: prices.length,
    median: median(prices),
    p25: percentile(prices, 0.25),
    p75: percentile(prices, 0.75),
    min: Math.min(...prices),
    max: Math.max(...prices),
  }
}

function buildBucketSnapshots(records = []) {
  const byGame = new Map()

  for (const record of records) {
    const gameId = String(record.match?.game?.id || record.game_id || '').trim()
    if (!gameId) continue

    if (!byGame.has(gameId)) {
      byGame.set(gameId, {
        gameId,
        all: [],
        Loose: [],
        CIB: [],
        Mint: [],
      })
    }

    const bucket = byGame.get(gameId)
    bucket.all.push(record)
    if (bucket[record.normalized_condition]) {
      bucket[record.normalized_condition].push(record)
    }
  }

  const snapshots = new Map()
  for (const [gameId, bucket] of byGame.entries()) {
    snapshots.set(gameId, {
      all: buildConditionBucketSnapshot(bucket.all),
      Loose: buildConditionBucketSnapshot(bucket.Loose),
      CIB: buildConditionBucketSnapshot(bucket.CIB),
      Mint: buildConditionBucketSnapshot(bucket.Mint),
    })
  }

  return snapshots
}

module.exports = {
  buildBucketSnapshots,
  buildConditionBucketSnapshot,
}
