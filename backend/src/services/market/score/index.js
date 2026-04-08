'use strict'

const { buildBucketSnapshots } = require('./buckets')
const { classifyConfidence, scoreLifecycle } = require('./confidence')

function roundScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4))
}

function scoreMetadata(record) {
  let score = 0.2
  if (record.listing_url) score += 0.15
  if (record.sold_at) score += 0.15
  if (record.condition_confidence >= 0.9) score += 0.2
  else if (record.condition_confidence >= 0.7) score += 0.12
  if (record.normalized_region) score += 0.1
  if (record.normalized_platform) score += 0.1
  if (record.is_verified_sale) score += 0.1
  return roundScore(score)
}

function scorePricePlausibility(record, snapshot, catalogBaseline = {}) {
  const price = Number(record.price_amount)
  if (!Number.isFinite(price) || price <= 0) return 0

  const preferredSnapshot = snapshot?.[record.normalized_condition]
  if (preferredSnapshot && preferredSnapshot.count >= 3 && preferredSnapshot.median > 0) {
    const median = Number(preferredSnapshot.median)
    const spread = Math.max(5, Number(preferredSnapshot.p75 || median) - Number(preferredSnapshot.p25 || median))
    const distance = Math.abs(price - median)
    return roundScore(Math.max(0, 1 - (distance / Math.max(spread * 2, median * 0.75))))
  }

  const baseline = ({
    Loose: Number(catalogBaseline.loose_price || catalogBaseline.loosePrice || 0),
    CIB: Number(catalogBaseline.cib_price || catalogBaseline.cibPrice || 0),
    Mint: Number(catalogBaseline.mint_price || catalogBaseline.mintPrice || 0),
  })[record.normalized_condition]

  if (baseline > 0) {
    const ratio = price / baseline
    if (ratio >= 0.5 && ratio <= 1.5) return 0.8
    if (ratio >= 0.35 && ratio <= 1.9) return 0.6
    if (ratio >= 0.2 && ratio <= 2.5) return 0.4
    return 0.15
  }

  return 0.5
}

function combineBalanced33(parts = {}) {
  const metadata = Number(parts.metadata || 0)
  const match = Number(parts.match || 0)
  const price = Number(parts.price || 0)
  return roundScore((metadata + match + price) / 3)
}

function scoreMatchedRecord(record, context = {}) {
  const matchScore = Number(record.match?.score || 0)
  const metadataScore = scoreMetadata(record)
  const snapshot = context.bucketSnapshots?.get(String(record.match?.game?.id || '')) || null
  const priceScore = scorePricePlausibility(record, snapshot, record.match?.game || {})
  const combined = combineBalanced33({
    metadata: metadataScore,
    match: matchScore,
    price: priceScore,
  })
  const lifecycle = scoreLifecycle(combined)
  const rejectionReason = record.is_rejected
    ? record.rejection_reasons[0] || 'rejected_by_normalizer'
    : !record.match?.game?.id
      ? 'no_catalog_match'
      : !lifecycle.keepRaw
        ? 'score_below_raw_threshold'
        : null

  return {
    ...record,
    confidence_score: combined,
    confidence_classifier: classifyConfidence(combined),
    confidenceTier: classifyConfidence(combined),
    score_breakdown: {
      metadata: metadataScore,
      match: roundScore(matchScore),
      price: priceScore,
    },
    include_in_snapshot: lifecycle.includeInSnapshot,
    keep_raw: lifecycle.keepRaw,
    isVerified: Boolean(record.is_verified_sale),
    accepted: rejectionReason == null,
    isRejected: rejectionReason != null,
    rejection_reason: rejectionReason,
  }
}

module.exports = {
  buildBucketSnapshots,
  combineBalanced33,
  scoreMatchedRecord,
}
