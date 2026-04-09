'use strict'

function daysSince(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)))
}

function classifyConfidenceTier(metrics = {}) {
  const totalObservations = Number(metrics.totalObservations || 0)
  const representedBuckets = Number(metrics.representedBuckets || 0)
  const latestDays = daysSince(metrics.latestSoldAt)
  const crossBucketVariance = Number(metrics.crossBucketVariance ?? 1)
  const averageMatchConfidence = Number(metrics.averageMatchConfidence || 0)
  const averageSourceConfidence = Number(metrics.averageSourceConfidence || 0)

  if (
    totalObservations >= 4
    && representedBuckets >= 2
    && latestDays != null
    && latestDays <= 45
    && crossBucketVariance <= 0.45
    && averageMatchConfidence >= 0.7
    && averageSourceConfidence >= 0.7
  ) {
    return 'high'
  }

  if (
    totalObservations >= 2
    && representedBuckets >= 2
    && latestDays != null
    && latestDays <= 90
    && crossBucketVariance <= 0.75
    && averageMatchConfidence >= 0.55
    && averageSourceConfidence >= 0.55
  ) {
    return 'medium'
  }

  if (totalObservations >= 1) {
    return 'low'
  }

  return 'unknown'
}

module.exports = {
  classifyConfidenceTier,
  daysSince,
}
