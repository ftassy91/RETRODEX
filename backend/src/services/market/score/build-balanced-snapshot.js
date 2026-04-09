'use strict'

const { getBucketWeightMap } = require('../source-registry')
const { classifyConfidenceTier } = require('./classify-confidence-tier')

function roundPrice(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null
}

function average(values = []) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function combineBalanced33(bucketSnapshots = {}) {
  const weights = getBucketWeightMap()
  const presentBuckets = Object.entries(bucketSnapshots)
    .filter(([, snapshot]) => snapshot && Number.isFinite(Number(snapshot.price)) && Number(snapshot.price) > 0)
    .map(([bucket, snapshot]) => ({ bucket, snapshot }))

  if (!presentBuckets.length) {
    return {
      balancedPrice: null,
      representedBuckets: 0,
      publishedBuckets: [],
      crossBucketVariance: null,
    }
  }

  const totalWeight = presentBuckets.reduce((sum, entry) => sum + Number(weights[entry.bucket] || 0), 0)
  const balancedPrice = totalWeight > 0
    ? presentBuckets.reduce((sum, entry) => sum + (Number(entry.snapshot.price) * Number(weights[entry.bucket] || 0)), 0) / totalWeight
    : average(presentBuckets.map((entry) => Number(entry.snapshot.price)))

  const prices = presentBuckets.map((entry) => Number(entry.snapshot.price))
  const priceAverage = average(prices)
  const crossBucketVariance = priceAverage
    ? Math.max(...prices.map((price) => Math.abs(price - priceAverage))) / Math.max(priceAverage, 1)
    : null

  return {
    balancedPrice: roundPrice(balancedPrice),
    representedBuckets: presentBuckets.length,
    publishedBuckets: presentBuckets.map((entry) => entry.bucket),
    crossBucketVariance: crossBucketVariance == null ? null : Number(crossBucketVariance.toFixed(4)),
  }
}

function buildBalancedSnapshot(conditionSnapshot, observations = []) {
  const combined = combineBalanced33(conditionSnapshot.buckets)
  const latestSoldAt = observations
    .map((record) => record.sold_at)
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)))[0] || null
  const sources = Array.from(new Set(
    observations.map((record) => record.source_name || record.source_slug).filter(Boolean)
  ))
  const averageMatchConfidence = average(observations
    .map((record) => Number(record.match?.score))
    .filter((value) => Number.isFinite(value)))
  const averageSourceConfidence = average(observations
    .map((record) => Number(record.source_confidence))
    .filter((value) => Number.isFinite(value)))
  const confidenceTier = classifyConfidenceTier({
    totalObservations: observations.length,
    representedBuckets: combined.representedBuckets,
    latestSoldAt,
    crossBucketVariance: combined.crossBucketVariance,
    averageMatchConfidence,
    averageSourceConfidence,
  })

  return {
    gameId: conditionSnapshot.gameId,
    condition: conditionSnapshot.condition,
    balancedPrice: combined.balancedPrice,
    representedBuckets: combined.representedBuckets,
    publishedBuckets: combined.publishedBuckets,
    crossBucketVariance: combined.crossBucketVariance,
    latestSoldAt,
    sourceNames: sources,
    sourceCount: sources.length,
    totalObservations: observations.length,
    averageMatchConfidence: averageMatchConfidence == null ? null : Number(averageMatchConfidence.toFixed(4)),
    averageSourceConfidence: averageSourceConfidence == null ? null : Number(averageSourceConfidence.toFixed(4)),
    confidenceTier,
    confidenceReason: buildConfidenceReason(confidenceTier, combined.representedBuckets, observations.length, combined.crossBucketVariance),
    buckets: conditionSnapshot.buckets,
  }
}

function buildConfidenceReason(confidenceTier, representedBuckets, observationCount, crossBucketVariance) {
  if (confidenceTier === 'high') {
    return `Balanced ${representedBuckets}-bucket sold signal across ${observationCount} observations.`
  }
  if (confidenceTier === 'medium') {
    return `Publishable sold signal with ${representedBuckets} market bucket(s) and ${observationCount} observations.`
  }
  if (confidenceTier === 'low') {
    return crossBucketVariance != null && crossBucketVariance > 0.6
      ? 'Low confidence due to high cross-market variance.'
      : `Low confidence sold signal with ${representedBuckets} market bucket(s).`
  }
  return 'No publishable sold signal available.'
}

module.exports = {
  buildBalancedSnapshot,
  combineBalanced33,
}
