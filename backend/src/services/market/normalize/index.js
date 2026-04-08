'use strict'

const { isCanonicalRawSoldRecord } = require('../contract')
const { normalizeCondition } = require('./condition')
const { normalizePlatform, normalizePlatformKey } = require('./platform')
const { normalizeRegion } = require('./region')
const { detectRejectionReasons, detectAggregateBlocks } = require('./rejections')

function slugifyText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(value) {
  return slugifyText(value)
    .split(/\s+/)
    .filter((token) => token && token.length > 1)
}

function normalizeRawSoldRecord(rawRecord) {
  if (!isCanonicalRawSoldRecord(rawRecord)) {
    throw new Error('normalizeRawSoldRecord expects a canonical raw sold record')
  }

  const conditionResult = normalizeCondition(rawRecord.title_raw, rawRecord.condition_hint_raw)
  const platformResult = normalizePlatform(rawRecord.title_raw, rawRecord.platform_hint_raw)
  const regionResult = normalizeRegion(rawRecord.title_raw, rawRecord.region_hint_raw, rawRecord.price_currency)
  const matchableTitle = slugifyText(rawRecord.title_raw)
  const titleTokens = tokenize(rawRecord.title_raw)

  const rejectionReasons = detectRejectionReasons(rawRecord, {
    condition: conditionResult.condition,
    matchableTitle,
  })
  const aggregateBlocks = detectAggregateBlocks(rawRecord, {
    condition: conditionResult.condition,
  })

  return {
    ...rawRecord,
    matchableTitle,
    titleTokens,
    normalized_platform: platformResult.platform,
    platform_confidence: platformResult.confidence,
    normalized_platform_key: normalizePlatformKey(platformResult.platform || rawRecord.platform_hint_raw || ''),
    normalized_region: regionResult.region,
    region_confidence: regionResult.confidence,
    normalized_condition: conditionResult.condition,
    condition_confidence: conditionResult.confidence,
    condition_keyword: conditionResult.keyword,
    rejection_reasons: rejectionReasons,
    aggregate_blocks: aggregateBlocks,
    is_rejected: rejectionReasons.length > 0,
    can_aggregate: rejectionReasons.length === 0 && aggregateBlocks.length === 0,
  }
}

module.exports = {
  normalizeRawSoldRecord,
  slugifyText,
  tokenize,
}
