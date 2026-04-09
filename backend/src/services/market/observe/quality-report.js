'use strict'

function incrementCounter(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function roundMetric(value, digits = 4) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  const factor = 10 ** digits
  return Math.round(numeric * factor) / factor
}

function buildMarketQualityReport(marketResult = {}, options = {}) {
  const scoredRecords = Array.isArray(marketResult.scoredRecords) ? marketResult.scoredRecords : []
  const gameSnapshots = Array.isArray(marketResult.gameSnapshots) ? marketResult.gameSnapshots : []
  const summary = {
    generatedAt: options.generatedAt || new Date().toISOString(),
    pipelineName: options.pipelineName || 'market_pipeline',
    sourceScope: options.sourceScope || null,
    totalRows: scoredRecords.length,
    acceptedRows: 0,
    rejectedRows: 0,
    publishedGames: gameSnapshots.length,
    confidenceDistribution: {},
    bySource: {},
    byBucket: {},
    byPlatform: {},
    rejectionReasons: {},
    oneBucketOnlyGames: 0,
    staleGames30: 0,
    staleGames60: 0,
    staleGames90: 0,
    divergenceAlerts: [],
  }

  let confidenceSum = 0

  for (const row of scoredRecords) {
    const sourceKey = String(row.source_slug || 'unknown')
    const bucketKey = String(row.source_market || 'unknown')
    const platformKey = String(row.normalized_platform || row.match?.game?.console || 'unknown')
    const confidenceTier = String(row.confidence_tier || 'unknown')
    const accepted = row.keep_raw === true && !row.is_rejected

    confidenceSum += toFiniteNumber(row.confidence_score)
    if (accepted) summary.acceptedRows += 1
    else summary.rejectedRows += 1

    incrementCounter(summary.confidenceDistribution, confidenceTier)
    incrementCounter(summary.rejectionReasons, accepted ? 'accepted' : (row.rejection_reasons?.[0] || 'rejected'))
    incrementCounter(summary.byBucket, bucketKey)
    incrementCounter(summary.byPlatform, platformKey)

    if (!summary.bySource[sourceKey]) {
      summary.bySource[sourceKey] = {
        totalRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        confidenceDistribution: {},
      }
    }
    summary.bySource[sourceKey].totalRows += 1
    if (accepted) summary.bySource[sourceKey].acceptedRows += 1
    else summary.bySource[sourceKey].rejectedRows += 1
    incrementCounter(summary.bySource[sourceKey].confidenceDistribution, confidenceTier)
  }

  summary.averageConfidenceScore = scoredRecords.length
    ? roundMetric(confidenceSum / scoredRecords.length)
    : 0

  for (const gameSnapshot of gameSnapshots) {
    const representedBuckets = Math.max(0, ...Object.values(gameSnapshot.conditions || {})
      .filter(Boolean)
      .map((conditionSnapshot) => Number(conditionSnapshot.representedBuckets || 0)))
    if (representedBuckets === 1) {
      summary.oneBucketOnlyGames += 1
    }

    const latestSoldAt = gameSnapshot.latestSoldAt ? new Date(gameSnapshot.latestSoldAt) : null
    if (latestSoldAt && !Number.isNaN(latestSoldAt.getTime())) {
      const days = Math.floor((Date.now() - latestSoldAt.getTime()) / (1000 * 60 * 60 * 24))
      if (days > 30) summary.staleGames30 += 1
      if (days > 60) summary.staleGames60 += 1
      if (days > 90) summary.staleGames90 += 1
    }

    for (const [condition, conditionSnapshot] of Object.entries(gameSnapshot.conditions || {})) {
      if (!conditionSnapshot || conditionSnapshot.crossBucketVariance == null) {
        continue
      }

      if (conditionSnapshot.crossBucketVariance >= 0.75) {
        summary.divergenceAlerts.push({
          gameId: gameSnapshot.gameId,
          condition,
          crossBucketVariance: conditionSnapshot.crossBucketVariance,
          publishedBuckets: conditionSnapshot.publishedBuckets,
        })
      }
    }
  }

  summary.acceptanceRate = summary.totalRows ? roundMetric(summary.acceptedRows / summary.totalRows) : 0
  summary.rejectionRate = summary.totalRows ? roundMetric(summary.rejectedRows / summary.totalRows) : 0

  return summary
}

module.exports = {
  buildMarketQualityReport,
}
