'use strict'

const { classifyConfidenceTier, daysSince } = require('./classify-confidence-tier')

function scoreObservation(record) {
  const sourceConfidence = Number(record.source_confidence || 0)
  const matchConfidence = Number(record.match?.score || 0)
  const regionConfidence = Number(record.region_confidence || 0)
  const conditionConfidence = Number(record.condition_confidence || 0)
  const latestDays = daysSince(record.sold_at)

  let score = (sourceConfidence * 0.35) + (matchConfidence * 0.35) + (regionConfidence * 0.15) + (conditionConfidence * 0.15)

  if (latestDays != null) {
    if (latestDays > 90) score -= 0.15
    else if (latestDays > 45) score -= 0.05
  }

  if (!record.is_real_sale) score = 0
  if (record.is_rejected) score = 0

  return Math.max(0, Math.min(1, Number(score.toFixed(4))))
}

function enrichObservationConfidence(record) {
  const confidenceScore = scoreObservation(record)
  return {
    ...record,
    confidence_score: confidenceScore,
    confidence_tier: classifyConfidenceTier({
      totalObservations: confidenceScore > 0 ? 1 : 0,
      representedBuckets: record.source_market ? 1 : 0,
      latestSoldAt: record.sold_at,
      crossBucketVariance: null,
      averageMatchConfidence: Number(record.match?.score || 0),
      averageSourceConfidence: Number(record.source_confidence || 0),
    }),
    keep_raw: confidenceScore > 0,
    include_in_snapshot: confidenceScore >= 0.55 && record.is_publishable === true,
  }
}

module.exports = {
  classifyConfidenceTier,
  daysSince,
  enrichObservationConfidence,
  scoreObservation,
}
